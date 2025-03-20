/**
 * Refactored Chess Game using Microsoft MakeCode Arcade
 *
 * Features:
 * - Consistent, easy-to-read color scheme (white border, pastel blue squares).
 * - Move history with B button to undo the last move.
 * - Improved AI: chooses the highest-value capture if available (using a consistent board snapshot).
 * - Hover text shows the piece type over a cell (using a 60px–wide image to avoid cutting off longer text)
 *   and is immediately removed when the cursor moves.
 * - Custom centered messages appear over the board.
 * 
 * TODO: 
 * - Add a timer for each player. Customizable time limits.
 * - Better AI logic for non-capturing moves. And better overall strategy.
 * 
 */

// ===========================
// === Constants & Globals ===
// ===========================

// Map colors to their numbers
enum Color {
    Transparent = 0,
    White = 1,
    Red = 2,
    Pink = 3,
    Orange = 4,
    Yellow = 5,
    Teal = 6,
    Green = 7,
    Blue = 8,
    LightBlue = 9,
    Purple = 10,
    LightPurple = 11,
    DarkPurple = 12,
    Tan = 13,
    Brown = 14,
    Black = 15
}

enum PieceType {
    Pawn,
    Rook,
    Knight,
    Bishop,
    Queen,
    King
}

enum PieceColor {
    White,
    Black
}

enum GameType {
    TwoPlayer,
    AI
}

enum GameState {
    MainMenu,
    Playing,
    GameOver
}

class Piece {
    type: PieceType;
    color: PieceColor;
    hasMoved: boolean;
    sprite: Sprite;
    constructor(type: PieceType, color: PieceColor) {
        this.type = type;
        this.color = color;
        this.hasMoved = false;
    }
}

// Move history record for undo functionality
interface MoveRecord {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    piece: {
        piece: Piece;
        oldType: PieceType;
        oldHasMoved: boolean;
    };
    captured?: {
        type: PieceType;
        color: PieceColor;
        hasMoved: boolean;
        row: number;
        col: number;
    };
    castling?: {
        rookFrom: number;
        rookTo: number;
        rook: Piece;
        oldHasMoved: boolean;
    };
    oldEnPassantTarget: { row: number, col: number } | null;
}
let moveHistory: MoveRecord[] = [];

// Board configuration
let squareSize = 14;
let boardOffsetX = 24;
let boardOffsetY = 4;
let board: (Piece | null)[][] = [];

// En passant tracking
let enPassantTarget: { row: number, col: number } | null = null;

// Cursor & turn tracking
let cursorRow = 0;
let cursorCol = 0;
let selectedPiece: { row: number, col: number } | null = null;
let currentTurn: PieceColor = PieceColor.White;

// Game state
let gameOver = false;
let gameType = GameType.TwoPlayer;
let gameState: GameState = GameState.MainMenu;
let menuSelection = 0;  // 0: 2-Player, 1: AI Mode
let aiThinking = false;

// Score tracking – piece values: Pawn=1, Knight/Bishop=3, Rook=5, Queen=9.
let whiteScore = 0;
let blackScore = 0;

// Status indicators – vertical 20x16 images placed at the far left and right.
let leftStatusSprite: Sprite;
let rightStatusSprite: Sprite;
// AI indicator (shown while AI computes)
let aiIndicatorSprite: Sprite = null;
// Global variable for active custom message so it can be cleared on cursor move.
let activeMessage: Sprite = null;
// Hover piece indicator (displayed over a cell)
let hoverSprite: Sprite = null;
// Highlighted squares for legal moves
let moveHighlights: Sprite[] = [];

// ==========================
// === Sprite Kinds       ===
// ==========================
namespace SpriteKind {
    export const Piece = SpriteKind.create();
    export const Cursor = SpriteKind.create();
    export const Status = SpriteKind.create();
    export const AIIndicator = SpriteKind.create();
    export const Message = SpriteKind.create();
    export const Hover = SpriteKind.create();
}

// =========================
// === Piece Graphics UI ===
// =========================

// Global piece images (swapped so that White pieces appear bright)
let wPawnImg: Image;
let bPawnImg: Image;
let wRookImg: Image;
let bRookImg: Image;
let wKnightImg: Image;
let bKnightImg: Image;
let wBishopImg: Image;
let bBishopImg: Image;
let wQueenImg: Image;
let bQueenImg: Image;
let wKingImg: Image;
let bKingImg: Image;

// Cursor sprite for board play
let cursorSprite: Sprite;

function loadPieceImages() {
    let center = Math.idiv(squareSize, 2);
    let radius = center - 2;
    // --- Pawn ---
    wPawnImg = image.create(squareSize, squareSize);
    wPawnImg.fill(0);
    wPawnImg.fillCircle(center, center, radius, 15);
    wPawnImg.drawCircle(center, center, radius, 0);
    bPawnImg = image.create(squareSize, squareSize);
    bPawnImg.fill(0);
    bPawnImg.fillCircle(center, center, radius, 1);
    bPawnImg.drawCircle(center, center, radius, 0);
    // --- Rook ---
    wRookImg = image.create(squareSize, squareSize);
    wRookImg.fill(0);
    wRookImg.fillRect(2, 4, squareSize - 4, squareSize - 6, 15);
    wRookImg.drawRect(2, 4, squareSize - 4, squareSize - 6, 0);
    wRookImg.fillRect(4, 2, squareSize - 8, 4, 15);
    wRookImg.drawRect(4, 2, squareSize - 8, 4, 0);
    bRookImg = image.create(squareSize, squareSize);
    bRookImg.fill(0);
    bRookImg.fillRect(2, 4, squareSize - 4, squareSize - 6, 1);
    bRookImg.drawRect(2, 4, squareSize - 4, squareSize - 6, 0);
    bRookImg.fillRect(4, 2, squareSize - 8, 4, 1);
    bRookImg.drawRect(4, 2, squareSize - 8, 4, 0);
    // --- Knight ---
    wKnightImg = image.create(squareSize, squareSize);
    wKnightImg.fill(0);
    wKnightImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15);
    wKnightImg.drawLine(2, squareSize - 3, squareSize - 3, 2, 0);
    wKnightImg.drawLine(2, squareSize - 5, squareSize - 5, 2, 0);
    bKnightImg = image.create(squareSize, squareSize);
    bKnightImg.fill(0);
    bKnightImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1);
    bKnightImg.drawLine(2, squareSize - 3, squareSize - 3, 2, 0);
    bKnightImg.drawLine(2, squareSize - 5, squareSize - 5, 2, 0);
    // --- Bishop ---
    wBishopImg = image.create(squareSize, squareSize);
    wBishopImg.fill(0);
    wBishopImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15);
    wBishopImg.drawLine(2, 2, squareSize - 3, squareSize - 3, 0);
    wBishopImg.drawLine(squareSize - 3, 2, 2, squareSize - 3, 0);
    wBishopImg.setPixel(center, center, 0);
    bBishopImg = image.create(squareSize, squareSize);
    bBishopImg.fill(0);
    bBishopImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1);
    bBishopImg.drawLine(2, 2, squareSize - 3, squareSize - 3, 0);
    bBishopImg.drawLine(squareSize - 3, 2, 2, squareSize - 3, 0);
    bBishopImg.setPixel(center, center, 0);
    // --- Queen ---
    wQueenImg = image.create(squareSize, squareSize);
    wQueenImg.fill(0);
    wQueenImg.fillCircle(center, center, radius, 15);
    wQueenImg.drawCircle(center, center, radius, 0);
    wQueenImg.drawLine(center, 2, center, squareSize - 3, 0);
    wQueenImg.drawLine(2, center, squareSize - 3, center, 0);
    bQueenImg = image.create(squareSize, squareSize);
    bQueenImg.fill(0);
    bQueenImg.fillCircle(center, center, radius, 1);
    bQueenImg.drawCircle(center, center, radius, 0);
    bQueenImg.drawLine(center, 2, center, squareSize - 3, 0);
    bQueenImg.drawLine(2, center, squareSize - 3, center, 0);
    // --- King ---
    wKingImg = image.create(squareSize, squareSize);
    wKingImg.fill(0);
    wKingImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15);
    wKingImg.drawRect(2, 2, squareSize - 4, squareSize - 4, 0);
    wKingImg.drawLine(center, 2, center, squareSize - 3, 0);
    wKingImg.drawLine(2, center, squareSize - 3, center, 0);
    wKingImg.fillRect(center - 2, 0, 5, 2, 15);
    wKingImg.drawRect(center - 2, 0, 5, 2, 0);
    bKingImg = image.create(squareSize, squareSize);
    bKingImg.fill(0);
    bKingImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1);
    bKingImg.drawRect(2, 2, squareSize - 4, squareSize - 4, 0);
    bKingImg.drawLine(center, 2, center, squareSize - 3, 0);
    bKingImg.drawLine(2, center, squareSize - 3, center, 0);
    bKingImg.fillRect(center - 2, 0, 5, 2, 1);
    bKingImg.drawRect(center - 2, 0, 5, 2, 0);
}

// Move Highlighting
function clearMoveHighlights() {
    for (let highlight of moveHighlights) {
        highlight.destroy();
    }
    moveHighlights = [];
}

function showMoveHighlights(row: number, col: number) {
    clearMoveHighlights();
    let piece = board[row][col];
    if (!piece) return;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isLegalMove(row, col, r, c)) {
                let highlight = sprites.create(image.create(squareSize, squareSize), SpriteKind.Hover);
                //highlight.image.fill(2); // Light color for move highlights
                highlight.image.drawRect(0, 0, squareSize, squareSize, 3);
                highlight.setFlag(SpriteFlag.Ghost, true);
                highlight.setPosition(
                    boardOffsetX + c * squareSize + Math.idiv(squareSize, 2),
                    boardOffsetY + r * squareSize + Math.idiv(squareSize, 2)
                );
                moveHighlights.push(highlight);
            }
        }
    }
}

function getPieceImage(piece: Piece): Image {
    // Swap images: White pieces use the bright image (originally built for Black)
    if (piece.color == PieceColor.White) {
        switch (piece.type) {
            case PieceType.Pawn: return bPawnImg;
            case PieceType.Rook: return bRookImg;
            case PieceType.Knight: return bKnightImg;
            case PieceType.Bishop: return bBishopImg;
            case PieceType.Queen: return bQueenImg;
            case PieceType.King: return bKingImg;
        }
    } else {
        switch (piece.type) {
            case PieceType.Pawn: return wPawnImg;
            case PieceType.Rook: return wRookImg;
            case PieceType.Knight: return wKnightImg;
            case PieceType.Bishop: return wBishopImg;
            case PieceType.Queen: return wQueenImg;
            case PieceType.King: return wKingImg;
        }
    }
    return image.create(squareSize, squareSize);
}

function pieceTypeName(type: PieceType): string {
    switch (type) {
        case PieceType.Pawn: return "Pawn";
        case PieceType.Rook: return "Rook";
        case PieceType.Knight: return "Knight";
        case PieceType.Bishop: return "Bishop";
        case PieceType.Queen: return "Queen";
        case PieceType.King: return "King";
    }
}

// Return piece value (for scoring)
function pieceValue(piece: Piece): number {
    switch (piece.type) {
        case PieceType.Pawn: return 1;
        case PieceType.Knight: return 3;
        case PieceType.Bishop: return 3;
        case PieceType.Rook: return 5;
        case PieceType.Queen: return 9;
        default: return 0;
    }
}

// =============================
// === Game Initialization   ===
// =============================

function createPiece(type: PieceType, color: PieceColor, row: number, col: number): Piece {
    let piece = new Piece(type, color);
    piece.sprite = sprites.create(getPieceImage(piece), SpriteKind.Piece);
    piece.sprite.setPosition(
        boardOffsetX + col * squareSize + Math.idiv(squareSize, 2),
        boardOffsetY + row * squareSize + Math.idiv(squareSize, 2)
    );
    return piece;
}

function drawBoardBackground() {
    let bg = image.create(160, 120);
    // White border with alternating pastel blue squares.
    bg.fill(6); // Color of the background
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let x = boardOffsetX + col * squareSize;
            let y = boardOffsetY + row * squareSize;
            if ((row + col) % 2 == 0) {
                bg.fillRect(x, y, squareSize, squareSize, 12);
            } else {
                bg.fillRect(x, y, squareSize, squareSize, 11);
            }
        }
    }
    scene.setBackgroundImage(bg);
}

function initBoard() {
    board = [];
    for (let row = 0; row < 8; row++) {
        let rowArray: (Piece | null)[] = [];
        for (let col = 0; col < 8; col++) {
            rowArray.push(null);
        }
        board.push(rowArray);
    }
    enPassantTarget = null;
    // Place pawns
    for (let col = 0; col < 8; col++) {
        board[1][col] = createPiece(PieceType.Pawn, PieceColor.Black, 1, col);
        board[6][col] = createPiece(PieceType.Pawn, PieceColor.White, 6, col);
    }
    // Place rooks
    board[0][0] = createPiece(PieceType.Rook, PieceColor.Black, 0, 0);
    board[0][7] = createPiece(PieceType.Rook, PieceColor.Black, 0, 7);
    board[7][0] = createPiece(PieceType.Rook, PieceColor.White, 7, 0);
    board[7][7] = createPiece(PieceType.Rook, PieceColor.White, 7, 7);
    // Place knights
    board[0][1] = createPiece(PieceType.Knight, PieceColor.Black, 0, 1);
    board[0][6] = createPiece(PieceType.Knight, PieceColor.Black, 0, 6);
    board[7][1] = createPiece(PieceType.Knight, PieceColor.White, 7, 1);
    board[7][6] = createPiece(PieceType.Knight, PieceColor.White, 7, 6);
    // Place bishops
    board[0][2] = createPiece(PieceType.Bishop, PieceColor.Black, 0, 2);
    board[0][5] = createPiece(PieceType.Bishop, PieceColor.Black, 0, 5);
    board[7][2] = createPiece(PieceType.Bishop, PieceColor.White, 7, 2);
    board[7][5] = createPiece(PieceType.Bishop, PieceColor.White, 7, 5);
    // Place queens
    board[0][3] = createPiece(PieceType.Queen, PieceColor.Black, 0, 3);
    board[7][3] = createPiece(PieceType.Queen, PieceColor.White, 7, 3);
    // Place kings
    board[0][4] = createPiece(PieceType.King, PieceColor.Black, 0, 4);
    board[7][4] = createPiece(PieceType.King, PieceColor.White, 7, 4);
}

// =============================
// === Rule Enforcement     ===
// =============================

function cloneBoard(b: (Piece | null)[][]): (Piece | null)[][] {
    let newBoard: (Piece | null)[][] = [];
    for (let row = 0; row < 8; row++) {
        let newRow: (Piece | null)[] = [];
        for (let col = 0; col < 8; col++) {
            let p = b[row][col];
            if (p) {
                let newPiece = new Piece(p.type, p.color);
                newPiece.hasMoved = p.hasMoved;
                newRow.push(newPiece);
            } else {
                newRow.push(null);
            }
        }
        newBoard.push(newRow);
    }
    return newBoard;
}

function isSquareAttacked(row: number, col: number, byColor: PieceColor, b: (Piece | null)[][]): boolean {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = b[r][c];
            if (p != null && p.color == byColor) {
                if (p.type == PieceType.Pawn) {
                    let direction = p.color == PieceColor.White ? -1 : 1;
                    if (row == r + direction && (col == c - 1 || col == c + 1)) {
                        return true;
                    }
                } else {
                    if (canPieceAttack(r, c, row, col, p, b)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function canPieceAttack(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece, b: (Piece | null)[][]): boolean {
    let oldBoard = board;
    board = b;
    let legal = false;
    switch (piece.type) {
        case PieceType.Pawn:
            let direction = piece.color == PieceColor.White ? -1 : 1;
            if (Math.abs(toCol - fromCol) == 1 && toRow == fromRow + direction) {
                legal = true;
            }
            break;
        case PieceType.Rook:
            legal = isLegalRookMove(fromRow, fromCol, toRow, toCol);
            break;
        case PieceType.Knight:
            legal = isLegalKnightMove(fromRow, fromCol, toRow, toCol);
            break;
        case PieceType.Bishop:
            legal = isLegalBishopMove(fromRow, fromCol, toRow, toCol);
            break;
        case PieceType.Queen:
            legal = isLegalQueenMove(fromRow, fromCol, toRow, toCol);
            break;
        case PieceType.King:
            legal = Math.abs(toRow - fromRow) <= 1 && Math.abs(toCol - fromCol) <= 1;
            break;
    }
    board = oldBoard;
    return legal;
}

function findKing(color: PieceColor, b: (Piece | null)[][]): { row: number, col: number } | null {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = b[r][c];
            if (p != null && p.color == color && p.type == PieceType.King) {
                return { row: r, col: c };
            }
        }
    }
    return null;
}

function isKingInCheck(color: PieceColor, b: (Piece | null)[][]): boolean {
    let kingPos = findKing(color, b);
    if (kingPos == null) return true;
    return isSquareAttacked(kingPos.row, kingPos.col, color == PieceColor.White ? PieceColor.Black : PieceColor.White, b);
}

function isLegalMoveSimulated(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let piece = board[fromRow][fromCol];
    if (!piece) return false;
    if (!isLegalMoveBasic(fromRow, fromCol, toRow, toCol, piece)) return false;
    let simBoard = cloneBoard(board);
    let simPiece = simBoard[fromRow][fromCol];
    if (simPiece == null) return false;
    if (simPiece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 && simBoard[toRow][toCol] == null) {
        simBoard[fromRow][toCol] = null;
    } else {
        simBoard[toRow][toCol] = null;
    }
    simBoard[toRow][toCol] = simPiece;
    simBoard[fromRow][fromCol] = null;
    if (simPiece.type == PieceType.King && Math.abs(toCol - fromCol) == 2) {
        if (toCol > fromCol) {
            let rook = simBoard[fromRow][7];
            simBoard[fromRow][fromCol + 1] = rook;
            simBoard[fromRow][7] = null;
        } else {
            let rook = simBoard[fromRow][0];
            simBoard[fromRow][fromCol - 1] = rook;
            simBoard[fromRow][0] = null;
        }
    }
    return !isKingInCheck(piece.color, simBoard);
}

function isLegalMoveBasic(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece): boolean {
    if (piece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 && toRow == fromRow + (piece.color == PieceColor.White ? -1 : 1)) {
        if (board[toRow][toCol] == null && enPassantTarget && enPassantTarget.row == toRow && enPassantTarget.col == toCol) {
            return true;
        }
    }
    switch (piece.type) {
        case PieceType.Pawn:
            return isLegalPawnMove(fromRow, fromCol, toRow, toCol, piece);
        case PieceType.Rook:
            return isLegalRookMove(fromRow, fromCol, toRow, toCol);
        case PieceType.Knight:
            return isLegalKnightMove(fromRow, fromCol, toRow, toCol);
        case PieceType.Bishop:
            return isLegalBishopMove(fromRow, fromCol, toRow, toCol);
        case PieceType.Queen:
            return isLegalQueenMove(fromRow, fromCol, toRow, toCol);
        case PieceType.King:
            if (Math.abs(toCol - fromCol) == 2 && toRow == fromRow) {
                if (isKingInCheck(piece.color, board)) return false;
                let step = toCol > fromCol ? 1 : -1;
                if (isSquareAttacked(fromRow, fromCol + step, piece.color == PieceColor.White ? PieceColor.Black : PieceColor.White, board)) return false;
                if (isSquareAttacked(toRow, toCol, piece.color == PieceColor.White ? PieceColor.Black : PieceColor.White, board)) return false;
                return true;
            } else {
                return isLegalKingMove(fromRow, fromCol, toRow, toCol);
            }
    }
    return false;
}

function isLegalMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let piece = board[fromRow][fromCol];
    if (piece == null) return false;
    if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false;
    let dest = board[toRow][toCol];
    if (dest != null && dest.color == piece.color) return false;
    return isLegalMoveSimulated(fromRow, fromCol, toRow, toCol);
}

// ============================
// === Piece Movement Logic ===
// ============================

function isLegalPawnMove(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece): boolean {
    let direction = piece.color == PieceColor.White ? -1 : 1;
    if (toCol == fromCol && toRow == fromRow + direction && board[toRow][toCol] == null) {
        return true;
    }
    if (toCol == fromCol && !piece.hasMoved && toRow == fromRow + 2 * direction &&
        board[fromRow + direction][fromCol] == null && board[toRow][toCol] == null) {
        return true;
    }
    if (Math.abs(toCol - fromCol) == 1 && toRow == fromRow + direction) {
        if (board[toRow][toCol] != null && board[toRow][toCol].color != piece.color) {
            return true;
        }
    }
    return false;
}

function isLegalRookMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    if (fromRow != toRow && fromCol != toCol) return false;
    if (fromRow == toRow) {
        let step = toCol > fromCol ? 1 : -1;
        for (let c = fromCol + step; c != toCol; c += step) {
            if (board[fromRow][c] != null) return false;
        }
    } else {
        let step = toRow > fromRow ? 1 : -1;
        for (let r = fromRow + step; r != toRow; r += step) {
            if (board[r][fromCol] != null) return false;
        }
    }
    return true;
}

function isLegalKnightMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let dr = Math.abs(toRow - fromRow);
    let dc = Math.abs(toCol - fromCol);
    return (dr == 2 && dc == 1) || (dr == 1 && dc == 2);
}

function isLegalBishopMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    if (Math.abs(toRow - fromRow) != Math.abs(toCol - fromCol)) return false;
    let stepRow = toRow > fromRow ? 1 : -1;
    let stepCol = toCol > fromCol ? 1 : -1;
    let r = fromRow + stepRow;
    let c = fromCol + stepCol;
    while (r != toRow) {
        if (r < 0 || r >= 8 || c < 0 || c >= 8) return false;
        if (board[r][c] != null) return false;
        r += stepRow;
        c += stepCol;
    }
    return true;
}

function isLegalQueenMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    return isLegalRookMove(fromRow, fromCol, toRow, toCol) ||
        isLegalBishopMove(fromRow, fromCol, toRow, toCol);
}

function isLegalKingMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let dr = Math.abs(toRow - fromRow);
    let dc = Math.abs(toCol - fromCol);
    return dr <= 1 && dc <= 1;
}

function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    let piece = board[fromRow][fromCol];
    if (piece == null) return;
    let moveRecord: MoveRecord = {
        fromRow: fromRow,
        fromCol: fromCol,
        toRow: toRow,
        toCol: toCol,
        piece: {
            piece: piece,
            oldType: piece.type,
            oldHasMoved: piece.hasMoved
        },
        oldEnPassantTarget: enPassantTarget ? { row: enPassantTarget.row, col: enPassantTarget.col } : null
    };
    if (piece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 &&
        board[toRow][toCol] == null && enPassantTarget &&
        enPassantTarget.row == toRow && enPassantTarget.col == toCol) {
        if (board[fromRow][toCol] != null) {
            let cap = board[fromRow][toCol];
            moveRecord.captured = {
                type: cap.type,
                color: cap.color,
                hasMoved: cap.hasMoved,
                row: fromRow,
                col: toCol
            };
            cap.sprite.destroy();
            board[fromRow][toCol] = null;
        }
    }
    let destPiece = board[toRow][toCol];
    if (destPiece != null) {
        moveRecord.captured = {
            type: destPiece.type,
            color: destPiece.color,
            hasMoved: destPiece.hasMoved,
            row: toRow,
            col: toCol
        };

        // Increase the score for the capturing player
        let capturedValue = pieceValue(destPiece);
        if (piece.color == PieceColor.White) {
            whiteScore += capturedValue;
        } else {
            blackScore += capturedValue;
        }

        // Update the UI after the capture
        updateStatusUI();
        destPiece.sprite.destroy();
    }

    if (piece.type == PieceType.King && Math.abs(toCol - fromCol) == 2) {
        if (toCol > fromCol) {
            let rook = board[fromRow][7];
            if (rook) {
                moveRecord.castling = {
                    rookFrom: 7,
                    rookTo: fromCol + 1,
                    rook: rook,
                    oldHasMoved: rook.hasMoved
                };
                rook.sprite.setPosition(
                    boardOffsetX + (fromCol + 1) * squareSize + Math.idiv(squareSize, 2),
                    boardOffsetY + fromRow * squareSize + Math.idiv(squareSize, 2)
                );
                board[fromRow][7] = null;
                board[fromRow][fromCol + 1] = rook;
            }
        } else {
            let rook = board[fromRow][0];
            if (rook) {
                moveRecord.castling = {
                    rookFrom: 0,
                    rookTo: fromCol - 1,
                    rook: rook,
                    oldHasMoved: rook.hasMoved
                };
                rook.sprite.setPosition(
                    boardOffsetX + (fromCol - 1) * squareSize + Math.idiv(squareSize, 2),
                    boardOffsetY + fromRow * squareSize + Math.idiv(squareSize, 2)
                );
                board[fromRow][0] = null;
                board[fromRow][fromCol - 1] = rook;
            }
        }
    }
    moveHistory.push(moveRecord);
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    piece.hasMoved = true;
    piece.sprite.setPosition(
        boardOffsetX + toCol * squareSize + Math.idiv(squareSize, 2),
        boardOffsetY + toRow * squareSize + Math.idiv(squareSize, 2)
    );
    if (piece.type == PieceType.Pawn) {
        if ((piece.color == PieceColor.White && toRow == 0) ||
            (piece.color == PieceColor.Black && toRow == 7)) {
            piece.type = PieceType.Queen;
            piece.sprite.setImage(getPieceImage(piece));
        }
    }
    if (piece.type == PieceType.Pawn && Math.abs(toRow - fromRow) == 2) {
        enPassantTarget = { row: fromRow + (toRow - fromRow) / 2, col: fromCol };
    } else {
        enPassantTarget = null;
    }
    updateGameStatus();
}

// ==========================
// === Undo Move Function ===
// ==========================
function undoLastMove() {
    if (gameState == GameState.MainMenu) return;
    if (gameState == GameState.GameOver) return;
    if (moveHistory.length == 0) {
        displayCustomText("No moves to undo");
        return;
    }

    let move = moveHistory.pop();
    if (!move) return;
    let movedPiece = board[move.toRow][move.toCol];
    if (movedPiece) {
        movedPiece.type = move.piece.oldType;
        movedPiece.hasMoved = move.piece.oldHasMoved;
        movedPiece.sprite.setPosition(
            boardOffsetX + move.fromCol * squareSize + Math.idiv(squareSize, 2),
            boardOffsetY + move.fromRow * squareSize + Math.idiv(squareSize, 2)
        );
        board[move.fromRow][move.fromCol] = movedPiece;
        board[move.toRow][move.toCol] = null;
    }
    if (move.captured) {
        let cap = move.captured;
        let restored = createPiece(cap.type, cap.color, cap.row, cap.col);
        restored.hasMoved = cap.hasMoved;
        board[cap.row][cap.col] = restored;
        // Decrease the score for the capturing player
        let capturedValue = pieceValue(restored);
        if (restored.color == PieceColor.White) {
            blackScore -= capturedValue;
        } else {
            whiteScore -= capturedValue;
        }
        updateStatusUI();
    }
    if (move.castling) {
        let cast = move.castling;
        let rook = cast.rook;
        rook.hasMoved = cast.oldHasMoved;
        rook.sprite.setPosition(
            boardOffsetX + cast.rookFrom * squareSize + Math.idiv(squareSize, 2),
            boardOffsetY + move.fromRow * squareSize + Math.idiv(squareSize, 2)
        );
        board[move.fromRow][cast.rookFrom] = rook;
        board[move.fromRow][cast.rookTo] = null;
    }
    enPassantTarget = move.oldEnPassantTarget;
    currentTurn = currentTurn == PieceColor.White ? PieceColor.Black : PieceColor.White;
    displayCustomText("Undo move");
}

// ==========================
// === Game Status        ===
// ==========================
function hasAnyLegalMove(color: PieceColor): boolean {
    let legalMovesFound = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c];
            if (p != null && p.color == color) {
                for (let r2 = 0; r2 < 8; r2++) {
                    for (let c2 = 0; c2 < 8; c2++) {
                        if (isLegalMove(r, c, r2, c2)) {
                            console.log(`Legal move for ${pieceTypeName(p.type)} from (${r}, ${c}) to (${r2}, ${c2})`);
                            legalMovesFound = true;
                        }
                    }
                }
            }
        }
    }
    return legalMovesFound;
}

function updateGameStatus() {
    console.log("Current Turn: " + (currentTurn == PieceColor.White ? "White" : "Black"));
    if (gameOver) return;
    
    // Check if current player is in check
    let inCheck = isKingInCheck(currentTurn, board);
    if (inCheck) {
        displayCustomText("Check!");
    }
    
    // Check if current player has any legal moves
    if (!hasAnyLegalMove(currentTurn)) {
        if (inCheck) {
            // Checkmate - king is in check and no legal moves
            let winner = currentTurn === PieceColor.White ? "Black" : "White";
            displayCustomText(`Checkmate! ${winner} wins!`);
            
            // Determine win/lose from White player's perspective for consistency with AI mode
            let result: "win" | "lose" | "tie" = currentTurn === PieceColor.White ? "lose" : "win";
            createGameOverMenu(result);
        } else {
            // Stalemate - not in check but no legal moves
            displayCustomText("Stalemate! Game ends in a draw.");
            createGameOverMenu("tie");
        }
        gameOver = true;
        gameState = GameState.GameOver;
    }
}

// ==========================
// === Custom Text Display ===
// ==========================
function displayCustomText(msg: string, duration: number = 2000) {
    let img = image.create(160, 20);
    let textWidth = msg.length * 6;
    let xOffset = Math.floor((img.width - textWidth) / 2);
    img.print(msg, xOffset, 0, 0);
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
    activeMessage = sprites.create(img, SpriteKind.Message);
    activeMessage.setFlag(SpriteFlag.Ghost, true);
    activeMessage.setPosition(80, 60);
    control.runInParallel(function () {
        pause(duration);
        if (activeMessage) {
            activeMessage.destroy();
            activeMessage = null;
        }
    });
}

// ==========================
// === UI & Status Bar    ===
// ==========================
function createStatusUI() {
    let leftImg = image.create(20, 16);
    leftImg.fill(15);
    leftImg.print("W", 4, 0, 0);
    leftImg.print("" + whiteScore, 4, 8, 0);
    leftStatusSprite = sprites.create(leftImg, SpriteKind.Status);
    leftStatusSprite.setFlag(SpriteFlag.Ghost, true);
    leftStatusSprite.setPosition(10, boardOffsetY + 6);

    let rightImg = image.create(20, 16);
    rightImg.fill(15);
    rightImg.print("B", 4, 0, 0);
    rightImg.print("" + blackScore, 4, 8, 0);
    rightStatusSprite = sprites.create(rightImg, SpriteKind.Status);
    rightStatusSprite.setFlag(SpriteFlag.Ghost, true);
    rightStatusSprite.setPosition(150, boardOffsetY + 6);
}

function updateStatusUI() {
    // 1) Collect captured pieces
    let capturedWhitePieces: PieceType[] = [];
    let capturedBlackPieces: PieceType[] = [];

    for (let i = 0; i < moveHistory.length; i++) {
        let move = moveHistory[i];
        if (move.captured) {
            if (move.captured.color == PieceColor.White) {
                capturedWhitePieces.push(move.captured.type);
            } else {
                capturedBlackPieces.push(move.captured.type);
            }
        }
    }

    // 2) Group them by piece type
    function groupByType(pieces: PieceType[]): { [pt: number]: number } {
        let groups: { [pt: number]: number } = {};
        for (let i = 0; i < pieces.length; i++) {
            let pt = pieces[i];
            if (!groups[pt]) {
                groups[pt] = 0;
            }
            groups[pt]++;
        }
        return groups;
    }

    let blackGroups = groupByType(capturedBlackPieces); // black pieces captured by White
    let whiteGroups = groupByType(capturedWhitePieces); // white pieces captured by Black

    // 3) Panel setup
    let panelWidth = 60;
    let panelHeight = 80;

    // 4) List of all piece types in numeric order
    let allPieceTypes = [
        PieceType.Pawn,
        PieceType.Rook,
        PieceType.Knight,
        PieceType.Bishop,
        PieceType.Queen,
        PieceType.King
    ];

    // 5) LEFT PANEL: White’s score + black pieces captured
    let leftImg = image.create(panelWidth, panelHeight);
    leftImg.fill(0);

    // Score at the top
    leftImg.print("W", 4, 0, 1);
    leftImg.print("" + whiteScore, 4, 8, 1);

    let leftYOffset = 16;

    for (let i = 0; i < allPieceTypes.length; i++) {
        let pType = allPieceTypes[i];
        let count = blackGroups[pType] ? blackGroups[pType] : 0;
        if (count > 0) {
            let mini = getPieceImage(new Piece(pType, PieceColor.Black));

            // Overlap horizontally by some small offset (e.g., 4px)
            // so if count>1, you see multiple stacked
            let overlapX = 4; // adjust this to change overlap (larger = more overlap)

            // Draw each captured piece slightly offset
            for (let c = 0; c < count; c++) {
                let xPos = 2 + c * overlapX;
                leftImg.drawTransparentImage(mini, xPos, leftYOffset);
            }

            // If more than 1 was captured, display a "×N" label
            if (count > 1) {
                // Center the label on top of the group of pieces
                let groupCenter = 2 + (count - 1) * overlapX + Math.idiv(mini.width, 2);
                let labelX = groupCenter - Math.idiv(("x" + count).length * 6, 2); // Adjust the multiplier if needed based on font size
                leftImg.print("x" + count, labelX, leftYOffset, Color.Red, image.font5);
            }

            // Move down one row for the next piece type
            leftYOffset += mini.height + 2;
        }
    }

    leftStatusSprite.setImage(leftImg);

    // 6) RIGHT PANEL: Black’s score + white pieces captured
    let rightImg = image.create(panelWidth, panelHeight);
    rightImg.fill(0);

    // Score at the top
    rightImg.print("B", 4, 0, 1);
    rightImg.print("" + blackScore, 4, 8, 1);

    let rightYOffset = 16;

    for (let i = 0; i < allPieceTypes.length; i++) {
        let pType = allPieceTypes[i];
        let count = whiteGroups[pType] ? whiteGroups[pType] : 0;
        if (count > 0) {
            let mini = getPieceImage(new Piece(pType, PieceColor.White));
            let overlapX = 4; // adjust for how much you want them to overlap

            for (let c = 0; c < count; c++) {
                let xPos = 2 + c * overlapX;
                rightImg.drawTransparentImage(mini, xPos, rightYOffset);
            }

            if (count > 1) {
                // Center the label on top of the group of pieces
                let groupCenter = 2 + (count - 1) * overlapX + Math.idiv(mini.width, 2);
                let labelX = groupCenter - Math.idiv(("x" + count).length * 6, 2); // Adjust the multiplier if needed based on font size
                rightImg.print("x" + count, labelX, rightYOffset, Color.Red, image.font5);
            }

            rightYOffset += mini.height + 2;
        }
    }

    rightStatusSprite.setImage(rightImg);
}


function showAIIndicator() {
    if (aiIndicatorSprite) {
        aiIndicatorSprite.destroy();
    }
    let img = image.create(80, 10);
    let text = "AI Thinking...";
    let offset = Math.floor((img.width - text.length * 6) / 2);
    img.print(text, offset, 0, 0);
    aiIndicatorSprite = sprites.create(img, SpriteKind.AIIndicator);
    aiIndicatorSprite.setFlag(SpriteFlag.Ghost, true);
    aiIndicatorSprite.setPosition(80, 20);
}

function hideAIIndicator() {
    if (aiIndicatorSprite) {
        aiIndicatorSprite.destroy();
        aiIndicatorSprite = null;
    }
}

// ==========================
// === Hover Piece Display ===
// ==========================
game.onUpdateInterval(200, function () {
    // Update Status UI
    if (gameState == GameState.Playing) {
        updateStatusUI();
    }
    // If a piece is selected, clear hover text.
    if (gameState == GameState.Playing && selectedPiece == null) {
        let piece = board[cursorRow][cursorCol];
        if (piece != null) {
            let msg = (piece.color == PieceColor.White ? "W " : "B ") + pieceTypeName(piece.type);
            // Create a wider image (60 pixels) for hover text.
            let img = image.create(60, 10);
            img.fill(15);
            let offset = Math.floor((img.width - msg.length * 6) / 2);
            img.print(msg, offset, 0, 6, image.font5);


            if (hoverSprite == null) {
                hoverSprite = sprites.create(img, SpriteKind.Hover);
            } else {
                hoverSprite.setImage(img);
            }
            hoverSprite.setPosition(
                boardOffsetX + cursorCol * squareSize + Math.idiv(squareSize, 2),
                boardOffsetY + cursorRow * squareSize + Math.idiv(squareSize, 2) - 8
            );
        } else {
            if (hoverSprite != null) {
                hoverSprite.destroy();
                hoverSprite = null;
            }
        }
    } else {
        if (hoverSprite != null) {
            hoverSprite.destroy();
            hoverSprite = null;
        }
    }
});

// ==========================
// === Cursor & Menu UI   ===
// ==========================
function createCursor(color: number = 5) {
    cursorSprite = sprites.create(createCursorImage(color), SpriteKind.Cursor);
    cursorSprite.setFlag(SpriteFlag.Ghost, true);
    cursorSprite.z = 100;
    updateCursorSprite();
}

function createCursorImage(color: number = 5): Image {
    let imgCursor = image.create(squareSize, squareSize);
    imgCursor.drawRect(0, 0, squareSize, squareSize, color);
    return imgCursor;
}

function updateCursorSprite() {
    cursorSprite.setPosition(
        boardOffsetX + cursorCol * squareSize + Math.idiv(squareSize, 2),
        boardOffsetY + cursorRow * squareSize + Math.idiv(squareSize, 2)
    );
}

function updateMenuDisplay() {
    let menu = image.create(160, 120);
    menu.fill(15);
    menu.printCenter("Chess", 10, 0, image.font8);
    if (menuSelection == 0) {
        menu.print("-> 2-Player", 20, 50, 0);
        menu.print("   AI Mode", 20, 70, 0);
    } else {
        menu.print("   2-Player", 20, 50, 0);
        menu.print("-> AI Mode", 20, 70, 0);
    }
    scene.setBackgroundImage(menu);
}

function createMainMenu() {
    gameState = GameState.MainMenu;
    updateMenuDisplay();
}

function createGameOverMenu(result: "win" | "lose" | "tie") {
    
    gameState = GameState.GameOver;
    
    // 1) Draw the background image
    let img = image.create(120, 100);
    img.fill(Color.Transparent);  // fill with a background color (white / light gray)

    // 2) Print outcome text at the top
    if (result === "win") {
        img.printCenter("You Win!", 10, Color.Green, image.font8);
    } else if (result === "lose") {
        img.printCenter("You Lose!", 10, Color.Red, image.font8);
    } else if (result === "tie") {
        img.printCenter("Tie Game!", 10, Color.Yellow, image.font8);
    }

    // 3) Print instructions for Main Menu (A) and Restart (B)
    img.printCenter("Press A:", 50, 0, image.font8);
    img.printCenter("Main Menu", 60, 0, image.font8);
    
    img.printCenter("Press B:", 80, 0, image.font8);
    img.printCenter("Restart", 90, 0, image.font8);

    // 4) Show this image as the background
    scene.setBackgroundImage(img);

    // 5) Listen for button presses
    //    These actions only work when on the Game Over screen
    controller.A.onEvent(ControllerButtonEvent.Pressed, function() {
        if (gameState == GameState.GameOver) {
            // Go back to main menu
            createMainMenu(); 
        }
    });

    controller.B.onEvent(ControllerButtonEvent.Pressed, function() {
        if (gameState == GameState.GameOver) {
            // Restart the game
            newGame();
        }
    });
}


// ==========================
// === Basic AI Mode      ===
// ==========================
function aiMove() {
    if (aiThinking) return;
    aiThinking = true;
    showAIIndicator();
    control.runInParallel(function () {
        // Clone the board to get a consistent snapshot.
        let backup = cloneBoard(board);
        let savedBoard = board;
        board = backup;
        let moves: { fromRow: number, fromCol: number, toRow: number, toCol: number }[] = [];
        let captureMoves: { fromRow: number, fromCol: number, toRow: number, toCol: number }[] = [];
        console.log("AI scanning for moves...");
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                let piece = board[r][c];
                if (piece != null && piece.color == PieceColor.Black) {
                    console.log("Evaluating piece at (" + r + "," + c + "): " + pieceTypeName(piece.type));
                    for (let r2 = 0; r2 < 8; r2++) {
                        for (let c2 = 0; c2 < 8; c2++) {
                            if (isLegalMove(r, c, r2, c2)) {
                                let moveDescription = "Found legal move for " + pieceTypeName(piece.type) + " from (" + r + "," + c + ") to (" + r2 + "," + c2 + ")";
                                if (board[r2][c2] != null) {
                                    moveDescription += " capturing " + pieceTypeName(board[r2][c2].type);
                                }
                                console.log(moveDescription);
                                moves.push({ fromRow: r, fromCol: c, toRow: r2, toCol: c2 });
                                if (board[r2][c2] != null) {
                                    captureMoves.push({ fromRow: r, fromCol: c, toRow: r2, toCol: c2 });
                                }
                            }
                        }
                    }
                }
            }
        }
        board = savedBoard; // Restore global board

        let chosenMove: { fromRow: number, fromCol: number, toRow: number, toCol: number } | null = null;
        if (captureMoves.length > 0) {
            let bestValue = -1;
            let bestMoves: { fromRow: number, fromCol: number, toRow: number, toCol: number }[] = [];
            for (let m of captureMoves) {
                let target = board[m.toRow][m.toCol];
                if (target == null) continue;
                let val = pieceValue(target);
                if (val > bestValue) {
                    bestValue = val;
                    bestMoves = [m];
                } else if (val == bestValue) {
                    bestMoves.push(m);
                }
            }
            chosenMove = bestMoves[Math.randomRange(0, bestMoves.length - 1)];
        } else if (moves.length > 0) {
            chosenMove = moves[Math.randomRange(0, moves.length - 1)];
        }
        if (chosenMove) {
            console.log("AI executing move: from (" + chosenMove.fromRow + "," + chosenMove.fromCol + ") to (" + chosenMove.toRow + "," + chosenMove.toCol + ")");
            let movingPiece = board[chosenMove.fromRow][chosenMove.fromCol];
            if (movingPiece) {
                console.log("Moving piece: " + pieceTypeName(movingPiece.type));
            }
            movePiece(chosenMove.fromRow, chosenMove.fromCol, chosenMove.toRow, chosenMove.toCol);
            currentTurn = PieceColor.White;
            console.log("AI moved from " + chosenMove.fromRow + "," + chosenMove.fromCol + " to " + chosenMove.toRow + "," + chosenMove.toCol);
        } else {
            gameOver = true;
            gameState = GameState.GameOver;

            if (isKingInCheck(PieceColor.Black, board)) {
                console.log("AI is in check and has no legal moves!");
                displayCustomText("AI is in checkmate!");
                createGameOverMenu("win");
                
            } else {
                console.log("AI has no legal moves! - But is not in check, so stalemate.");
                createGameOverMenu("tie");
                displayCustomText("AI has no legal moves!");
            }
            
            return;
        }
        updateGameStatus();
        hideAIIndicator();
        // Indicate where the AI moved
        cursorRow = chosenMove.toRow;
        cursorCol = chosenMove.toCol;

        updateCursorSprite();
        aiThinking = false;
    });
}

game.onUpdate(function () {
    if (gameState == GameState.Playing && gameType == GameType.AI &&
        currentTurn == PieceColor.Black && !aiThinking && !gameOver) {
        aiMove();
    }
});

// ==========================
// === Input Handling     ===
// ==========================
controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
    if (gameState == GameState.MainMenu) {
        if (menuSelection == 0) {
            gameType = GameType.TwoPlayer;
            displayCustomText("2-Player Mode");
        } else {
            gameType = GameType.AI;
            displayCustomText("AI Mode");
        }
        createCursor();
        loadPieceImages();
        drawBoardBackground();
        initBoard();
        createStatusUI();
        displayCustomText("White's turn");
        gameState = GameState.Playing;
    } else if (gameState == GameState.Playing) {
        if (gameOver) return;
        if (selectedPiece == null) {
            let piece = board[cursorRow][cursorCol];
            if (piece != null && piece.color == currentTurn) {
                selectedPiece = { row: cursorRow, col: cursorCol };
                displayCustomText("Selected " + pieceTypeName(piece.type));
                //change cursor color
                cursorSprite.setImage(createCursorImage(4));
                showMoveHighlights(cursorRow, cursorCol);
            }
        } else {
            let fromRow = selectedPiece.row;
            let fromCol = selectedPiece.col;
            if (isLegalMove(fromRow, fromCol, cursorRow, cursorCol)) {
                // debug print show legal move and type of piece
                let piece = board[fromRow][fromCol];
                console.log("Legal move for " + pieceTypeName(piece.type) + " from (" + fromRow + "," + fromCol + ") to (" + cursorRow + "," + cursorCol + ")");
                movePiece(fromRow, fromCol, cursorRow, cursorCol);
                currentTurn = currentTurn == PieceColor.White ? PieceColor.Black : PieceColor.White;

            } else {
                displayCustomText("Illegal Move!");
            }
            selectedPiece = null;
            cursorSprite.setImage(createCursorImage(5));
            clearMoveHighlights();
        }
    }
});


controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    undoLastMove();
        // if the last move was by the AI then undo twice
        if (GameType.AI) {
            undoLastMove();
            return;
        }
});

controller.left.onEvent(ControllerButtonEvent.Pressed, function () {
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
    if (gameState == GameState.MainMenu) {
        if (menuSelection > 0) {
            menuSelection--;
            updateMenuDisplay();
        }
    } else if (gameState == GameState.Playing) {
        if (cursorCol > 0) {
            cursorCol--;
            updateCursorSprite();
        }
    }
});

controller.right.onEvent(ControllerButtonEvent.Pressed, function () {
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
    if (gameState == GameState.MainMenu) {
        if (menuSelection < 1) {
            menuSelection++;
            updateMenuDisplay();
        }
    } else if (gameState == GameState.Playing) {
        if (cursorCol < 7) {
            cursorCol++;
            updateCursorSprite();
        }
    }
});

controller.up.onEvent(ControllerButtonEvent.Pressed, function () {
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
    if (gameState == GameState.MainMenu) {
        if (menuSelection > 0) {
            menuSelection--;
            updateMenuDisplay();
        }
    } else if (gameState == GameState.Playing && cursorRow > 0) {
        cursorRow--;
        updateCursorSprite();
    }
});

controller.down.onEvent(ControllerButtonEvent.Pressed, function () {
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
    if (gameState == GameState.MainMenu) {
        if (menuSelection < 1) {
            menuSelection++;
            updateMenuDisplay();
        }
    } else if (gameState == GameState.Playing && cursorRow < 7) {
        cursorRow++;
        updateCursorSprite();
    }
});

function newGame() {
    if (gameState == GameState.Playing) {
        gameOver = false;
        currentTurn = PieceColor.White;
        cursorRow = 0;
        cursorCol = 0;
        updateCursorSprite();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] != null) {
                    board[r][c].sprite.destroy();
                }
            }
        }
        initBoard();
        whiteScore = 0;
        blackScore = 0;
        updateStatusUI();
        displayCustomText("New Game: White's turn");
    }
}

controller.menu.onEvent(ControllerButtonEvent.Pressed, function () {
    newGame();
});

// ==========================
// === Initialization     ===
// ==========================
createMainMenu();
