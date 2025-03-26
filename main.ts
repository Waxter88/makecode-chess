/**
 * Chess Game using Microsoft MakeCode Arcade
 *
 * Improvements:
 * - Caches cell positions for quick lookups.
 * - Centralizes z-index layer constants.
 * - Updates status UI only when needed.
 * - Implements basic object pooling for move highlight sprites.
 * - Enhanced AI:
 *    • Evaluation now uses piece–square tables (positional bonus),
 *      plus extra heuristics like king safety and bishop pair.
 *    • Moves are ordered (capturing moves prioritized) to improve alpha–beta pruning.
 *    • Implements quiescence search to reduce horizon effect.
 *    • Uses iterative deepening to gradually improve move choice.
 *
 * TODO:
 * - Add player timers.
 * - Further refine king movement rules.
 * - Enhance game over menu and add animations.
 */

// ===========================
// === Constants & Enums   ===
// ===========================
const BOARD_SIZE = 8;
const SQUARE_SIZE = 14;
const BOARD_OFFSET_X = 24;
const BOARD_OFFSET_Y = 4;
const MAX_STACK = 2;      // Maximum stack for captured piece icons
const YIELD_THRESHOLD = 25; // Yield in minimax

// Z-index layers for sprite ordering
const Z_BACKGROUND    = 0;
const Z_BOARD         = 5;
const Z_PIECE         = 10;
const Z_STATUS        = 15;
const Z_HIGHLIGHT     = 20;
const Z_CURSOR        = 30;
const Z_HOVER         = 40;
const Z_MENU          = 50;
const Z_AI_INDICATOR  = 60;
const Z_MESSAGE       = 70;

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

// ===========================
// === Global Variables    ===
// ===========================
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
let board: (Piece | null)[][] = [];
let enPassantTarget: { row: number, col: number } | null = null;

let cursorRow = 0;
let cursorCol = 0;
let selectedPiece: { row: number, col: number } | null = null;
let currentTurn: PieceColor = PieceColor.White;

let gameOver = false;
let gameType: GameType = GameType.TwoPlayer;
let gameState: GameState = GameState.MainMenu;
let menuSelection = 0;
let gameOverMenuSprite: Sprite = null;

// AI variables
let aiThinking = false;
let aiSearchDepth = 3;
let nodesEvaluated = 0;
let estimatedTotalNodes = 1000;
let yieldCounter = 0;
let lastAIMove: { fromRow: number, fromCol: number, toRow: number, toCol: number } | null = null;

let whiteScore = 0;
let blackScore = 0;

// For status UI update optimization
// (Note: removed early-return check to always update captured pieces.)
let lastWhiteScore = -1;
let lastBlackScore = -1;

let leftStatusSprite: Sprite;
let rightStatusSprite: Sprite;
let aiIndicatorSprite: Sprite = null;
let activeMessage: Sprite = null;
let hoverSprite: Sprite = null;
let moveHighlights: Sprite[] = [];

// Object pool for move highlight sprites
let highlightPool: Sprite[] = [];

// Cache of cell positions (precomputed for speed)
let cellPositions: { x: number, y: number }[][] = [];

// ===========================
// === Sprite Kinds        ===
// ===========================
namespace SpriteKind {
    export const Piece = SpriteKind.create();
    export const Cursor = SpriteKind.create();
    export const Status = SpriteKind.create();
    export const AIIndicator = SpriteKind.create();
    export const Message = SpriteKind.create();
    export const Hover = SpriteKind.create();
}

// ===========================
// === Utility Functions   ===
// ===========================
/** Returns the center position for a given board cell */
function getCellPosition(row: number, col: number): { x: number, y: number } {
    return cellPositions[row][col];
}

/** Precompute cell center positions for all board cells */
function initCellPositions(): void {
    cellPositions = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        let rowPos: { x: number, y: number }[] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            const x = BOARD_OFFSET_X + col * SQUARE_SIZE + Math.idiv(SQUARE_SIZE, 2);
            const y = BOARD_OFFSET_Y + row * SQUARE_SIZE + Math.idiv(SQUARE_SIZE, 2);
            rowPos.push({ x, y });
        }
        cellPositions.push(rowPos);
    }
}

/** Helper to print centered text on an image */
function printCenter(img: Image, text: string, y: number, color: number = 0, font: image.Font = image.font5) {
    const textWidth = text.length * 6;
    const xOffset = Math.idiv(img.width - textWidth, 2);
    img.print(text, xOffset, y, color, font);
}

/** Clears any active message from the screen */
function clearActiveMessage() {
    if (activeMessage) {
        activeMessage.destroy();
        activeMessage = null;
    }
}

// ===========================
// === Piece Graphics      ===
// ===========================
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
let cursorSprite: Sprite;

function loadPieceImages() {
    const center = Math.idiv(SQUARE_SIZE, 2);
    const radius = center - 2;
    // Pawn images
    wPawnImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    wPawnImg.fill(0);
    wPawnImg.fillCircle(center, center, radius, 15);
    wPawnImg.drawCircle(center, center, radius, 0);
    bPawnImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    bPawnImg.fill(0);
    bPawnImg.fillCircle(center, center, radius, 1);
    bPawnImg.drawCircle(center, center, radius, 0);
    // Rook images
    wRookImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    wRookImg.fill(0);
    wRookImg.fillRect(2, 4, SQUARE_SIZE - 4, SQUARE_SIZE - 6, 15);
    wRookImg.drawRect(2, 4, SQUARE_SIZE - 4, SQUARE_SIZE - 6, 0);
    wRookImg.fillRect(4, 2, SQUARE_SIZE - 8, 4, 15);
    wRookImg.drawRect(4, 2, SQUARE_SIZE - 8, 4, 0);
    bRookImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    bRookImg.fill(0);
    bRookImg.fillRect(2, 4, SQUARE_SIZE - 4, SQUARE_SIZE - 6, 1);
    bRookImg.drawRect(2, 4, SQUARE_SIZE - 4, SQUARE_SIZE - 6, 0);
    bRookImg.fillRect(4, 2, SQUARE_SIZE - 8, 4, 1);
    bRookImg.drawRect(4, 2, SQUARE_SIZE - 8, 4, 0);
    // Knight images
    wKnightImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    wKnightImg.fill(0);
    wKnightImg.fillRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 15);
    wKnightImg.drawLine(2, SQUARE_SIZE - 3, SQUARE_SIZE - 3, 2, 0);
    wKnightImg.drawLine(2, SQUARE_SIZE - 5, SQUARE_SIZE - 5, 2, 0);
    bKnightImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    bKnightImg.fill(0);
    bKnightImg.fillRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 1);
    bKnightImg.drawLine(2, SQUARE_SIZE - 3, SQUARE_SIZE - 3, 2, 0);
    bKnightImg.drawLine(2, SQUARE_SIZE - 5, SQUARE_SIZE - 5, 2, 0);
    // Bishop images
    wBishopImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    wBishopImg.fill(0);
    wBishopImg.fillRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 15);
    wBishopImg.drawLine(2, 2, SQUARE_SIZE - 3, SQUARE_SIZE - 3, 0);
    wBishopImg.drawLine(SQUARE_SIZE - 3, 2, 2, SQUARE_SIZE - 3, 0);
    wBishopImg.setPixel(center, center, 0);
    bBishopImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    bBishopImg.fill(0);
    bBishopImg.fillRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 1);
    bBishopImg.drawLine(2, 2, SQUARE_SIZE - 3, SQUARE_SIZE - 3, 0);
    bBishopImg.drawLine(SQUARE_SIZE - 3, 2, 2, SQUARE_SIZE - 3, 0);
    bBishopImg.setPixel(center, center, 0);
    // Queen images
    wQueenImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    wQueenImg.fill(0);
    wQueenImg.fillCircle(center, center, radius, 15);
    wQueenImg.drawCircle(center, center, radius, 0);
    wQueenImg.drawLine(center, 2, center, SQUARE_SIZE - 3, 0);
    wQueenImg.drawLine(2, center, SQUARE_SIZE - 3, center, 0);
    bQueenImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    bQueenImg.fill(0);
    bQueenImg.fillCircle(center, center, radius, 1);
    bQueenImg.drawCircle(center, center, radius, 0);
    bQueenImg.drawLine(center, 2, center, SQUARE_SIZE - 3, 0);
    bQueenImg.drawLine(2, center, SQUARE_SIZE - 3, center, 0);
    // King images
    wKingImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    wKingImg.fill(0);
    wKingImg.fillRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 15);
    wKingImg.drawRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 0);
    wKingImg.drawLine(center, 2, center, SQUARE_SIZE - 3, 0);
    wKingImg.drawLine(2, center, SQUARE_SIZE - 3, center, 0);
    wKingImg.fillRect(center - 2, 0, 5, 2, 15);
    wKingImg.drawRect(center - 2, 0, 5, 2, 0);
    bKingImg = image.create(SQUARE_SIZE, SQUARE_SIZE);
    bKingImg.fill(0);
    bKingImg.fillRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 1);
    bKingImg.drawRect(2, 2, SQUARE_SIZE - 4, SQUARE_SIZE - 4, 0);
    bKingImg.drawLine(center, 2, center, SQUARE_SIZE - 3, 0);
    bKingImg.drawLine(2, center, SQUARE_SIZE - 3, center, 0);
    bKingImg.fillRect(center - 2, 0, 5, 2, 1);
    bKingImg.drawRect(center - 2, 0, 5, 2, 0);
}

/** Returns the appropriate image for a piece */
function getPieceImage(piece: Piece): Image {
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
    return image.create(SQUARE_SIZE, SQUARE_SIZE);
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

/** Returns piece base value (for AI evaluation) */
function pieceValue(piece: Piece): number {
    switch (piece.type) {
        case PieceType.Pawn: return 1;
        case PieceType.Knight: return 3;
        case PieceType.Bishop: return 3;
        case PieceType.Rook: return 5;
        case PieceType.Queen: return 9;
        case PieceType.King: return 20;
        default: return 0;
    }
}

// ===========================
// === AI Enhancements     ===
// ===========================

// *** Improved AI: Piece–Square Tables for positional bonuses.
const pawnTable = [
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  5,  5,  5,  5,  5,  5,  5,  5 ],
    [  1,  1,  2,  3,  3,  2,  1,  1 ],
    [  0,  0,  0, 10, 10,  0,  0,  0 ],
    [  0,  0,  0, -5, -5,  0,  0,  0 ],
    [  1, -1, -2,  0,  0, -2, -1,  1 ],
    [  1,  2,  2, -2, -2,  2,  2,  1 ],
    [  0,  0,  0,  0,  0,  0,  0,  0 ]
];
const knightTable = [
    [ -5, -4, -3, -3, -3, -3, -4, -5 ],
    [ -4, -2,  0,  0,  0,  0, -2, -4 ],
    [ -3,  0,  1,  1,  1,  1,  0, -3 ],
    [ -3,  0,  1,  2,  2,  1,  0, -3 ],
    [ -3,  0,  1,  2,  2,  1,  0, -3 ],
    [ -3,  0,  1,  1,  1,  1,  0, -3 ],
    [ -4, -2,  0,  0,  0,  0, -2, -4 ],
    [ -5, -4, -3, -3, -3, -3, -4, -5 ]
];
const bishopTable = [
    [ -2, -1, -1, -1, -1, -1, -1, -2 ],
    [ -1,  0,  0,  0,  0,  0,  0, -1 ],
    [ -1,  0,  1,  1,  1,  1,  0, -1 ],
    [ -1,  0,  1,  2,  2,  1,  0, -1 ],
    [ -1,  0,  1,  2,  2,  1,  0, -1 ],
    [ -1,  0,  1,  1,  1,  1,  0, -1 ],
    [ -1,  0,  0,  0,  0,  0,  0, -1 ],
    [ -2, -1, -1, -1, -1, -1, -1, -2 ]
];
const rookTable = [
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  5,  5,  5,  5,  5,  5,  5,  5 ],
    [  0,  0,  0, 10, 10,  0,  0,  0 ]
];
const queenTable = [
    [ -2, -1, -1,  0,  0, -1, -1, -2 ],
    [ -1,  0,  0,  0,  0,  0,  0, -1 ],
    [ -1,  0,  1,  1,  1,  1,  0, -1 ],
    [  0,  0,  1,  1,  1,  1,  0,  0 ],
    [  0,  0,  1,  1,  1,  1,  0,  0 ],
    [ -1,  0,  1,  1,  1,  1,  0, -1 ],
    [ -1,  0,  0,  0,  0,  0,  0, -1 ],
    [ -2, -1, -1,  0,  0, -1, -1, -2 ]
];
const kingTable = [
    [ -3, -4, -4, -5, -5, -4, -4, -3 ],
    [ -3, -4, -4, -5, -5, -4, -4, -3 ],
    [ -3, -4, -4, -5, -5, -4, -4, -3 ],
    [ -3, -4, -4, -5, -5, -4, -4, -3 ],
    [ -2, -3, -3, -4, -4, -3, -3, -2 ],
    [ -1, -2, -2, -2, -2, -2, -2, -1 ],
    [  2,  2,  0,  0,  0,  0,  2,  2 ],
    [  2,  3,  1,  0,  0,  1,  3,  2 ]
];

/**
 * Returns the additional bonus (or penalty) based on piece–square table.
 * For White pieces, we flip the board.
 */
function getPieceSquareBonus(piece: Piece, row: number, col: number): number {
    let tableRow = piece.color == PieceColor.Black ? row : (BOARD_SIZE - 1 - row);
    let tableCol = piece.color == PieceColor.Black ? col : (BOARD_SIZE - 1 - col);
    switch (piece.type) {
        case PieceType.Pawn: return pawnTable[tableRow][tableCol];
        case PieceType.Knight: return knightTable[tableRow][tableCol];
        case PieceType.Bishop: return bishopTable[tableRow][tableCol];
        case PieceType.Rook: return rookTable[tableRow][tableCol];
        case PieceType.Queen: return queenTable[tableRow][tableCol];
        case PieceType.King: return kingTable[tableRow][tableCol];
    }
    return 0;
}

/**
 * Static evaluation function.
 * Positive values favor Black (AI) and negative favor White.
 * Combines material, positional (piece–square bonus), bishop pair and king safety.
 */
function staticEvaluation(b: (Piece | null)[][]): number {
    let score = 0;
    let whiteBishops = 0;
    let blackBishops = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            let piece = b[r][c];
            if (piece) {
                let base = pieceValue(piece);
                let posBonus = getPieceSquareBonus(piece, r, c) / 10;
                if (piece.color == PieceColor.Black) {
                    score += base + posBonus;
                    if (piece.type == PieceType.Bishop) blackBishops++;
                } else {
                    score -= base + posBonus;
                    if (piece.type == PieceType.Bishop) whiteBishops++;
                }
            }
        }
    }
    if (whiteBishops >= 2) score -= 0.5;
    if (blackBishops >= 2) score += 0.5;
    if (isKingInCheck(PieceColor.White, b)) score += 0.75;
    if (isKingInCheck(PieceColor.Black, b)) score -= 0.75;
    return score;
}

// ===========================
// === Game Initialization ===
// ===========================
function createPiece(type: PieceType, color: PieceColor, row: number, col: number): Piece {
    let piece = new Piece(type, color);
    piece.sprite = sprites.create(getPieceImage(piece), SpriteKind.Piece);
    piece.sprite.z = Z_PIECE;
    let pos = getCellPosition(row, col);
    piece.sprite.setPosition(pos.x, pos.y);
    return piece;
}

function drawBoardBackground() {
    let bg = image.create(160, 120);
    bg.fill(6);
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            let x = BOARD_OFFSET_X + col * SQUARE_SIZE;
            let y = BOARD_OFFSET_Y + row * SQUARE_SIZE;
            let colorFill = ((row + col) % 2 == 0) ? 11 : 12;
            bg.fillRect(x, y, SQUARE_SIZE, SQUARE_SIZE, colorFill);
        }
    }
    scene.setBackgroundImage(bg);
}

function initBoard() {
    board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        let rowArray: (Piece | null)[] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            rowArray.push(null);
        }
        board.push(rowArray);
    }
    enPassantTarget = null;
    for (let col = 0; col < BOARD_SIZE; col++) {
        board[1][col] = createPiece(PieceType.Pawn, PieceColor.Black, 1, col);
        board[6][col] = createPiece(PieceType.Pawn, PieceColor.White, 6, col);
    }
    board[0][0] = createPiece(PieceType.Rook, PieceColor.Black, 0, 0);
    board[0][7] = createPiece(PieceType.Rook, PieceColor.Black, 0, 7);
    board[7][0] = createPiece(PieceType.Rook, PieceColor.White, 7, 0);
    board[7][7] = createPiece(PieceType.Rook, PieceColor.White, 7, 7);
    board[0][1] = createPiece(PieceType.Knight, PieceColor.Black, 0, 1);
    board[0][6] = createPiece(PieceType.Knight, PieceColor.Black, 0, 6);
    board[7][1] = createPiece(PieceType.Knight, PieceColor.White, 7, 1);
    board[7][6] = createPiece(PieceType.Knight, PieceColor.White, 7, 6);
    board[0][2] = createPiece(PieceType.Bishop, PieceColor.Black, 0, 2);
    board[0][5] = createPiece(PieceType.Bishop, PieceColor.Black, 0, 5);
    board[7][2] = createPiece(PieceType.Bishop, PieceColor.White, 7, 2);
    board[7][5] = createPiece(PieceType.Bishop, PieceColor.White, 7, 5);
    board[0][3] = createPiece(PieceType.Queen, PieceColor.Black, 0, 3);
    board[7][3] = createPiece(PieceType.Queen, PieceColor.White, 7, 3);
    board[0][4] = createPiece(PieceType.King, PieceColor.Black, 0, 4);
    board[7][4] = createPiece(PieceType.King, PieceColor.White, 7, 4);
}

// ===========================
// === Rule Enforcement    ===
// ===========================
function cloneBoard(b: (Piece | null)[][]): (Piece | null)[][] {
    let newBoard: (Piece | null)[][] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        let newRow: (Piece | null)[] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
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
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
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
            legal = (Math.abs(toCol - fromCol) == 1 && toRow == fromRow + direction);
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
            legal = (Math.abs(toRow - fromRow) <= 1 && Math.abs(toCol - fromCol) <= 1);
            break;
    }
    board = oldBoard;
    return legal;
}

function findKing(color: PieceColor, b: (Piece | null)[][]): { row: number, col: number } | null {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
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
    let enemyColor = (color == PieceColor.White) ? PieceColor.Black : PieceColor.White;
    return isSquareAttacked(kingPos.row, kingPos.col, enemyColor, b);
}

function isLegalMoveSimulated(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let piece = board[fromRow][fromCol];
    if (!piece) return false;
    if (!isLegalMoveBasic(fromRow, fromCol, toRow, toCol, piece)) return false;
    let simBoard = cloneBoard(board);
    let simPiece = simBoard[fromRow][fromCol];
    if (!simPiece) return false;
    if (simPiece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 && simBoard[toRow][toCol] == null) {
        simBoard[fromRow][toCol] = null;
    } else {
        simBoard[toRow][toCol] = null;
    }
    simBoard[toRow][toCol] = simPiece;
    simBoard[fromRow][fromCol] = null;
    if (simPiece.type == PieceType.King && Math.abs(toCol - fromCol) == 2) {
        if (toCol > fromCol) {
            let rook = simBoard[fromRow][BOARD_SIZE - 1];
            simBoard[fromRow][fromCol + 1] = rook;
            simBoard[fromRow][BOARD_SIZE - 1] = null;
        } else {
            let rook = simBoard[fromRow][0];
            simBoard[fromRow][fromCol - 1] = rook;
            simBoard[fromRow][0] = null;
        }
    }
    return !isKingInCheck(piece.color, simBoard);
}

function isLegalMoveBasic(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece): boolean {
    if (piece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 &&
        toRow == fromRow + (piece.color == PieceColor.White ? -1 : 1)) {
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
                let enemyColor = (piece.color == PieceColor.White) ? PieceColor.Black : PieceColor.White;
                let step = toCol > fromCol ? 1 : -1;
                if (isSquareAttacked(fromRow, fromCol + step, enemyColor, board)) return false;
                if (isSquareAttacked(toRow, toCol, enemyColor, board)) return false;
                if (toCol > fromCol) {
                    for (let c = fromCol + 1; c <= toCol; c++) {
                        if (board[fromRow][c] != null) return false;
                    }
                    let rook = board[fromRow][BOARD_SIZE - 1];
                    if (!rook || rook.hasMoved) return false;
                } else {
                    for (let c = toCol; c < fromCol; c++) {
                        if (board[fromRow][c] != null) return false;
                    }
                    let rook = board[fromRow][0];
                    if (!rook || rook.hasMoved) return false;
                }
                return true;
            } else {
                return isLegalKingMove(fromRow, fromCol, toRow, toCol);
            }
    }
    return false;
}

function isLegalMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let piece = board[fromRow][fromCol];
    if (!piece) return false;
    if (toRow < 0 || toRow >= BOARD_SIZE || toCol < 0 || toCol >= BOARD_SIZE) return false;
    let dest = board[toRow][toCol];
    if (dest != null && dest.color == piece.color) return false;
    return isLegalMoveSimulated(fromRow, fromCol, toRow, toCol);
}

// ===========================
// === Movement Logic      ===
// ===========================
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
        let step = (toCol > fromCol) ? 1 : -1;
        for (let c = fromCol + step; c != toCol; c += step) {
            if (board[fromRow][c] != null) return false;
        }
    } else {
        let step = (toRow > fromRow) ? 1 : -1;
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
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
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
    if (!piece) return;
    let moveRecord: MoveRecord = {
        fromRow, fromCol, toRow, toCol,
        piece: {
            piece: piece,
            oldType: piece.type,
            oldHasMoved: piece.hasMoved
        },
        oldEnPassantTarget: enPassantTarget ? { row: enPassantTarget.row, col: enPassantTarget.col } : null
    };

    // En passant capture
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

    // Normal capture
    let destPiece = board[toRow][toCol];
    if (destPiece != null) {
        moveRecord.captured = {
            type: destPiece.type,
            color: destPiece.color,
            hasMoved: destPiece.hasMoved,
            row: toRow,
            col: toCol
        };
        let capturedValue = pieceValue(destPiece);
        if (piece.color == PieceColor.White) {
            whiteScore += capturedValue;
        } else {
            blackScore += capturedValue;
        }
        updateStatusUI();
        destPiece.sprite.destroy();
    }

    // Castling move
    if (piece.type == PieceType.King && Math.abs(toCol - fromCol) == 2) {
        if (toCol > fromCol) {
            let rook = board[fromRow][BOARD_SIZE - 1];
            if (rook) {
                moveRecord.castling = {
                    rookFrom: BOARD_SIZE - 1,
                    rookTo: fromCol + 1,
                    rook: rook,
                    oldHasMoved: rook.hasMoved
                };
                rook.sprite.setPosition(getCellPosition(fromRow, fromCol + 1).x, getCellPosition(fromRow, fromCol + 1).y);
                board[fromRow][BOARD_SIZE - 1] = null;
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
                rook.sprite.setPosition(getCellPosition(fromRow, fromCol - 1).x, getCellPosition(fromRow, fromCol - 1).y);
                board[fromRow][0] = null;
                board[fromRow][fromCol - 1] = rook;
            }
        }
    }

    moveHistory.push(moveRecord);
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    piece.hasMoved = true;
    let newPos = getCellPosition(toRow, toCol);
    piece.sprite.setPosition(newPos.x, newPos.y);

    // Pawn promotion
    if (piece.type == PieceType.Pawn) {
        if ((piece.color == PieceColor.White && toRow == 0) ||
            (piece.color == PieceColor.Black && toRow == BOARD_SIZE - 1)) {
            piece.type = PieceType.Queen;
            piece.sprite.setImage(getPieceImage(piece));
        }
    }

    // Update en passant target
    if (piece.type == PieceType.Pawn && Math.abs(toRow - fromRow) == 2) {
        enPassantTarget = { row: fromRow + (toRow - fromRow) / 2, col: fromCol };
    } else {
        enPassantTarget = null;
    }
    updateGameStatus();
    highlightLastMove();
}

// ===========================
// === Undo Move Function  ===
// ===========================
function undoLastMove() {
    if (gameState == GameState.MainMenu || gameState == GameState.GameOver) return;
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
        let pos = getCellPosition(move.fromRow, move.fromCol);
        movedPiece.sprite.setPosition(pos.x, pos.y);
        board[move.fromRow][move.fromCol] = movedPiece;
        board[move.toRow][move.toCol] = null;
    }
    if (move.captured) {
        let cap = move.captured;
        let restored = createPiece(cap.type, cap.color, cap.row, cap.col);
        restored.hasMoved = cap.hasMoved;
        board[cap.row][cap.col] = restored;
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
        rook.sprite.setPosition(getCellPosition(move.fromRow, cast.rookFrom).x, getCellPosition(move.fromRow, cast.rookFrom).y);
        board[move.fromRow][cast.rookFrom] = rook;
        board[move.fromRow][cast.rookTo] = null;
    }
    enPassantTarget = move.oldEnPassantTarget;
    currentTurn = (currentTurn == PieceColor.White) ? PieceColor.Black : PieceColor.White;
    displayCustomText("Undo move");
}

// ===========================
// === Game Status & Checks ===
// ===========================
function hasAnyLegalMove(color: PieceColor): boolean {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            let p = board[row][col];
            if (p != null && p.color == color) {
                for (let r2 = 0; r2 < BOARD_SIZE; r2++) {
                    for (let c2 = 0; c2 < BOARD_SIZE; c2++) {
                        if (isLegalMove(row, col, r2, c2)) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

function updateGameStatus() {
    if (gameOver) return;
    let inCheck = isKingInCheck(currentTurn, board);
    if (inCheck) {
        displayCustomText("Check!");
    }
    if (!hasAnyLegalMove(currentTurn)) {
        if (inCheck) {
            let winner = (currentTurn === PieceColor.White) ? "Black" : "White";
            displayCustomText(`Checkmate! ${winner} wins!`);
            createGameOverMenu((currentTurn === PieceColor.White) ? "lose" : "win");
        } else {
            displayCustomText("Stalemate! Game ends in a draw.");
            createGameOverMenu("tie");
        }
        gameOver = true;
        gameState = GameState.GameOver;
    }
}

// ===========================
// === Custom Text Display ===
// ===========================
function displayCustomText(msg: string, duration: number = 2000) {
    let img = image.create(160, 20);
    const textWidth = msg.length * 6;
    const xOffset = Math.floor((img.width - textWidth) / 2);
    img.print(msg, xOffset, 0, 0);
    clearActiveMessage();
    activeMessage = sprites.create(img, SpriteKind.Message);
    activeMessage.z = Z_MESSAGE;
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

// ===========================
// === UI & Status Bar     ===
// ===========================
function createStatusUI() {
    let leftImg = image.create(20, 16);
    leftImg.fill(15);
    leftImg.print("W", 4, 0, 0);
    leftImg.print(whiteScore.toString(), 4, 8, 0);
    leftStatusSprite = sprites.create(leftImg, SpriteKind.Status);
    leftStatusSprite.z = Z_STATUS;
    leftStatusSprite.setFlag(SpriteFlag.Ghost, true);
    leftStatusSprite.setPosition(12, BOARD_OFFSET_Y + 6);

    let rightImg = image.create(20, 16);
    rightImg.fill(15);
    rightImg.print("B", 4, 0, 0);
    rightImg.print(blackScore.toString(), 4, 8, 0);
    rightStatusSprite = sprites.create(rightImg, SpriteKind.Status);
    rightStatusSprite.z = Z_STATUS;
    rightStatusSprite.setFlag(SpriteFlag.Ghost, true);
    rightStatusSprite.setPosition(150, BOARD_OFFSET_Y + 6);
}

// *** FIXED updateStatusUI: removed early-return so that pieces and scores update correctly.
function updateStatusUI() {
    lastWhiteScore = whiteScore;
    lastBlackScore = blackScore;
    function groupByType(pieces: PieceType[]): { [pt: number]: number } {
        let groups: { [pt: number]: number } = {};
        for (let pt of pieces) {
            groups[pt] = (groups[pt] || 0) + 1;
        }
        return groups;
    }
    let capturedWhitePieces: PieceType[] = [];
    let capturedBlackPieces: PieceType[] = [];
    for (let move of moveHistory) {
        if (move.captured) {
            if (move.captured.color == PieceColor.Black) {
                capturedBlackPieces.push(move.captured.type);
            } else {
                capturedWhitePieces.push(move.captured.type);
            }
        }
    }
    let whiteGroups = groupByType(capturedBlackPieces);
    let blackGroups = groupByType(capturedWhitePieces);
    const panelWidth = 60, panelHeight = 80;
    let allPieceTypes = [PieceType.Pawn, PieceType.Rook, PieceType.Knight, PieceType.Bishop, PieceType.Queen, PieceType.King];

    let leftImg = image.create(panelWidth, panelHeight);
    leftImg.fill(0);
    leftImg.print("W", 0, 0, 1);
    leftImg.print(whiteScore.toString(), 8, 0, 1);
    let leftYOffset = 16;
    for (let pType of allPieceTypes) {
        let count = whiteGroups[pType] || 0;
        if (count > 0) {
            let mini = getPieceImage(new Piece(pType, PieceColor.Black));
            let overlapX = 4;
            let stackCount = Math.min(count, MAX_STACK);
            for (let c = 0; c < stackCount; c++) {
                let xPos = 2 + c * overlapX;
                leftImg.drawTransparentImage(mini, xPos, leftYOffset);
            }
            if (count > 1) {
                let labelWidth = ("x" + count).length * 6;
                let labelX = Math.idiv(panelWidth - labelWidth, 2) - 24;
                leftImg.print("x" + count, labelX, leftYOffset, Color.Red, image.font5);
            }
            leftYOffset += mini.height + 2;
        }
    }
    leftStatusSprite.setImage(leftImg);

    let rightImg = image.create(panelWidth, panelHeight);
    rightImg.fill(0);
    rightImg.print("B", 0, 0, 1);
    rightImg.print(blackScore.toString(), 8, 0, 1);
    let rightYOffset = 16;
    for (let pType of allPieceTypes) {
        let count = blackGroups[pType] || 0;
        if (count > 0) {
            let mini = getPieceImage(new Piece(pType, PieceColor.White));
            let overlapX = 4;
            let stackCount = Math.min(count, MAX_STACK);
            for (let c = 0; c < stackCount; c++) {
                let xPos = 2 + c * overlapX;
                rightImg.drawTransparentImage(mini, xPos, rightYOffset);
            }
            if (count > 1) {
                let labelWidth = ("x" + count).length * 6;
                let labelX = Math.idiv(panelWidth - labelWidth, 2) - 24;
                rightImg.print("x" + count, labelX, rightYOffset, Color.Red, image.font5);
            }
            rightYOffset += mini.height + 2;
        }
    }
    rightStatusSprite.setImage(rightImg);
}

function showAIIndicator() {
    nodesEvaluated = 0;
    let indicatorImg = image.create(100, 20);
    indicatorImg.fill(15);
    indicatorImg.drawRect(0, 10, 100, 10, Color.Black);
    indicatorImg.print("AI Thinking...", 6, 0, Color.Orange, image.font5);
    aiIndicatorSprite = sprites.create(indicatorImg, SpriteKind.AIIndicator);
    aiIndicatorSprite.z = Z_AI_INDICATOR;
    aiIndicatorSprite.setFlag(SpriteFlag.Ghost, true);
    aiIndicatorSprite.setPosition(80, 20);
    control.runInParallel(function () {
        while (aiThinking) {
            let progressRatio = Math.min(nodesEvaluated / estimatedTotalNodes, 1);
            let fillWidth = Math.idiv(progressRatio * 98, 1);
            let img = image.create(100, 20);
            img.fill(15);
            img.drawRect(0, 10, 100, 10, Color.Black);
            img.fillRect(1, 11, fillWidth, 8, Color.Orange);
            img.print("AI Thinking...", 2, 0, Color.Orange, image.font5);
            if (aiIndicatorSprite) {
                aiIndicatorSprite.setImage(img);
            }
            pause(100);
        }
    });
}

function hideAIIndicator() {
    if (aiIndicatorSprite) {
        aiIndicatorSprite.destroy();
        aiIndicatorSprite = null;
    }
}

// ===========================
// === Hover Piece Display ===
// ===========================
function createHoverSprite() {
    hoverSprite = sprites.create(image.create(60, 10), SpriteKind.Hover);
    hoverSprite.z = Z_HOVER;
}

game.onUpdateInterval(50, function () {
    if (gameState == GameState.Playing) {
        updateStatusUI();
    }
    if (gameState == GameState.Playing && selectedPiece == null) {
        let piece = board[cursorRow][cursorCol];
        if (piece != null) {
            let msg = (piece.color == PieceColor.White ? "W " : "B ") + pieceTypeName(piece.type);
            let img = image.create(50, 8);
            img.fill(Color.Black);
            let offset = Math.floor((img.width - msg.length * 6) / 2);
            img.print(msg, offset, 1, 6, image.font5);
            if (hoverSprite == null) {
                hoverSprite = sprites.create(img, SpriteKind.Hover);
                hoverSprite.z = Z_HOVER;
            } else {
                hoverSprite.setImage(img);
                hoverSprite.z = Z_HOVER;
            }
            let pos = getCellPosition(cursorRow, cursorCol);
            hoverSprite.setPosition(pos.x, pos.y - 8);
        } else {
            if (hoverSprite) {
                hoverSprite.destroy();
                hoverSprite = null;
            }
        }
    } else {
        if (hoverSprite) {
            hoverSprite.destroy();
            hoverSprite = null;
        }
    }
});

// ===========================
// === Cursor & Menu UI    ===
// ===========================
function createCursor(color: number = 5) {
    cursorSprite = sprites.create(createCursorImage(color), SpriteKind.Cursor);
    cursorSprite.setFlag(SpriteFlag.Ghost, true);
    cursorSprite.z = Z_CURSOR;
    updateCursorSprite();
}

function createCursorImage(color: number = 5): Image {
    let imgCursor = image.create(SQUARE_SIZE, SQUARE_SIZE);
    imgCursor.drawRect(0, 0, SQUARE_SIZE, SQUARE_SIZE, color);
    return imgCursor;
}

function updateCursorSprite() {
    let pos = getCellPosition(cursorRow, cursorCol);
    cursorSprite.setPosition(pos.x, pos.y);
}

function updateMenuDisplay() {
    let menu = image.create(160, 120);
    menu.fill(Color.Black);
    printCenter(menu, "CHESS", 5, Color.White, image.font8);
    menu.drawLine(0, 20, 160, 20, Color.White);
    if (menuSelection == 0) {
        menu.print("-> 2-Player", 10, 30, Color.White, image.font8);
        menu.print("   AI Mode", 10, 40, Color.White, image.font8);
    } else {
        menu.print("   2-Player", 10, 30, Color.White, image.font8);
        menu.print("-> AI Mode", 10, 40, Color.White, image.font8);
        menu.print("Depth: " + aiSearchDepth, 10, 50, Color.Orange, image.font8);
        printCenter(menu, "Higher depth", 60, Color.Orange, image.font8);
        printCenter(menu, "= stronger AI", 70, Color.Orange, image.font8);
        printCenter(menu, "Menu: Change AI Depth", 85, Color.White, image.font8);
    }
    printCenter(menu, "Arrows: Move   A: Confirm", 100, Color.White, image.font8);
    scene.setBackgroundImage(menu);
}

function createMainMenu() {
    gameState = GameState.MainMenu;
    updateMenuDisplay();
}

function createGameOverMenu(result: "win" | "lose" | "tie") {
    gameState = GameState.GameOver;
    let menuImg = image.create(120, 100);
    menuImg.fill(Color.Transparent);
    menuImg.drawRect(0, 0, menuImg.width, menuImg.height, Color.Black);
    if (result === "win") {
        printCenter(menuImg, "You Win!", 10, Color.Green, image.font8);
    } else if (result === "lose") {
        printCenter(menuImg, "You Lose!", 10, Color.Red, image.font8);
    } else {
        printCenter(menuImg, "Tie Game!", 10, Color.Yellow, image.font8);
    }
    printCenter(menuImg, "Press A: Main Menu", 50, Color.Blue, image.font8);
    printCenter(menuImg, "Press B: Restart", 70, Color.Blue, image.font8);
    gameOverMenuSprite = sprites.create(menuImg, SpriteKind.Message);
    gameOverMenuSprite.z = Z_MENU;
    gameOverMenuSprite.setFlag(SpriteFlag.Ghost, true);
    gameOverMenuSprite.setPosition(80, 60);
}

// ===========================
// === AI Functions        ===
// ===========================
function isLegalMoveForBoard(b: (Piece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let oldBoard = board;
    board = b;
    let legal = isLegalMove(fromRow, fromCol, toRow, toCol);
    board = oldBoard;
    return legal;
}

function getAllLegalMoves(b: (Piece | null)[][], color: PieceColor): { fromRow: number, fromCol: number, toRow: number, toCol: number }[] {
    let moves: { fromRow: number, fromCol: number, toRow: number, toCol: number }[] = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            let piece = b[row][col];
            if (piece != null && piece.color == color) {
                for (let r2 = 0; r2 < BOARD_SIZE; r2++) {
                    for (let c2 = 0; c2 < BOARD_SIZE; c2++) {
                        if (isLegalMoveForBoard(b, row, col, r2, c2)) {
                            moves.push({ fromRow: row, fromCol: col, toRow: r2, toCol: c2 });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function quiesce(b: (Piece | null)[][], alpha: number, beta: number, maximizingPlayer: boolean): number {
    nodesEvaluated++;
    yieldCounter++;
    if (yieldCounter >= YIELD_THRESHOLD) {
        pause(1);
        yieldCounter = 0;
    }
    let standPat = staticEvaluation(b);
    if (maximizingPlayer) {
        if (standPat > alpha) alpha = standPat;
    } else {
        if (standPat < beta) beta = standPat;
    }
    if (alpha >= beta) {
        return maximizingPlayer ? alpha : beta;
    }
    let color = maximizingPlayer ? PieceColor.Black : PieceColor.White;
    let moves = getAllLegalMoves(b, color).filter(m => {
        let target = b[m.toRow][m.toCol];
        return (target != null);
    });
    moves.sort((a, bMove) => {
        let pieceA = b[a.toRow][a.toCol];
        let pieceB = b[bMove.toRow][bMove.toCol];
        let valA = pieceA ? pieceValue(pieceA) : 0;
        let valB = pieceB ? pieceValue(pieceB) : 0;
        return maximizingPlayer ? (valB - valA) : (valA - valB);
    });
    for (let m of moves) {
        let cloneB = cloneBoard(b);
        simulateMove(cloneB, m.fromRow, m.fromCol, m.toRow, m.toCol);
        let score = quiesce(cloneB, alpha, beta, !maximizingPlayer);
        if (maximizingPlayer) {
            if (score > alpha) {
                alpha = score;
                if (alpha >= beta) break;
            }
        } else {
            if (score < beta) {
                beta = score;
                if (beta <= alpha) break;
            }
        }
    }
    return maximizingPlayer ? alpha : beta;
}

function minimax(b: (Piece | null)[][], depth: number, alpha: number, beta: number, maximizingPlayer: boolean): { score: number, move?: { fromRow: number, fromCol: number, toRow: number, toCol: number } } {
    nodesEvaluated++;
    yieldCounter++;
    if (yieldCounter >= YIELD_THRESHOLD) {
        pause(1);
        yieldCounter = 0;
    }
    let color = maximizingPlayer ? PieceColor.Black : PieceColor.White;
    let moves = getAllLegalMoves(b, color);
    moves.sort((m1, m2) => {
        let pieceA = b[m1.toRow][m1.toCol];
        let pieceB = b[m2.toRow][m2.toCol];
        let valA = pieceA ? pieceValue(pieceA) : 0;
        let valB = pieceB ? pieceValue(pieceB) : 0;
        return maximizingPlayer ? (valB - valA) : (valA - valB);
    });
    if (depth == 0 || moves.length == 0) {
        let qScore = quiesce(b, alpha, beta, maximizingPlayer);
        return { score: qScore };
    }
    let bestMove: { fromRow: number, fromCol: number, toRow: number, toCol: number } | undefined;
    if (maximizingPlayer) {
        let maxEval = -100000;
        for (let m of moves) {
            let cloneB = cloneBoard(b);
            simulateMove(cloneB, m.fromRow, m.fromCol, m.toRow, m.toCol);
            let result = minimax(cloneB, depth - 1, alpha, beta, false);
            let evalScore = result.score;
            if (evalScore > maxEval) {
                maxEval = evalScore;
                bestMove = m;
            }
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = 100000;
        for (let m of moves) {
            let cloneB = cloneBoard(b);
            simulateMove(cloneB, m.fromRow, m.fromCol, m.toRow, m.toCol);
            let result = minimax(cloneB, depth - 1, alpha, beta, true);
            let evalScore = result.score;
            if (evalScore < minEval) {
                minEval = evalScore;
                bestMove = m;
            }
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
}

function simulateMove(b: (Piece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number): void {
    let piece = b[fromRow][fromCol];
    if (!piece) return;
    b[toRow][toCol] = piece;
    b[fromRow][fromCol] = null;
}

function aiMove() {
    if (aiThinking) return;
    aiThinking = true;
    showAIIndicator();
    control.runInParallel(function () {
        nodesEvaluated = 0;
        let bestSoFar: { fromRow: number, fromCol: number, toRow: number, toCol: number } | null = null;
        let bestScore = -100000;
        for (let d = 1; d <= aiSearchDepth; d++) {
            let start = control.millis();
            let result = minimax(board, d, -100000, 100000, true);
            let elapsed = control.millis() - start;
            if (result.move) {
                bestSoFar = result.move;
                bestScore = result.score;
            }
            estimatedTotalNodes = Math.max(estimatedTotalNodes, nodesEvaluated);
        }
        if (bestSoFar) {
            movePiece(bestSoFar.fromRow, bestSoFar.fromCol, bestSoFar.toRow, bestSoFar.toCol);
            currentTurn = PieceColor.White;
            lastAIMove = bestSoFar;
        } else {
            gameOver = true;
            gameState = GameState.GameOver;
            if (isKingInCheck(PieceColor.Black, board)) {
                displayCustomText("AI is in checkmate!");
                createGameOverMenu("win");
            } else {
                displayCustomText("AI has no legal moves!");
                createGameOverMenu("tie");
            }
            return;
        }
        updateGameStatus();
        hideAIIndicator();
        aiThinking = false;
    });
}

game.onUpdate(function () {
    if (gameState == GameState.Playing && gameType == GameType.AI &&
        currentTurn == PieceColor.Black && !aiThinking && !gameOver) {
        aiMove();
    }
});

// ===========================
// === Input Handling      ===
// ===========================
controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    clearActiveMessage();
    if (gameState == GameState.GameOver && gameOverMenuSprite) {
        gameOverMenuSprite.destroy();
        createMainMenu();
    } else if (gameState == GameState.MainMenu) {
        gameType = (menuSelection == 0) ? GameType.TwoPlayer : GameType.AI;
        displayCustomText(gameType == GameType.TwoPlayer ? "2-Player Mode" : "AI Mode");
        createCursor();
        loadPieceImages();
        drawBoardBackground();
        initBoard();
        createStatusUI();
        displayCustomText("White's turn");
        gameState = GameState.Playing;
    } else if (gameState == GameState.Playing) {
        if (gameOver) return;
        if (!selectedPiece) {
            let piece = board[cursorRow][cursorCol];
            if (piece != null && piece.color == currentTurn) {
                selectedPiece = { row: cursorRow, col: cursorCol };
                displayCustomText("Selected " + pieceTypeName(piece.type));
                cursorSprite.setImage(createCursorImage(4));
                showMoveHighlights(cursorRow, cursorCol);
            }
        } else {
            let fromRow = selectedPiece.row;
            let fromCol = selectedPiece.col;
            if (fromRow == cursorRow && fromCol == cursorCol) {
                let piece = board[fromRow][fromCol];
                displayCustomText(pieceTypeName(piece.type) + " deselected");
            } else if (isLegalMove(fromRow, fromCol, cursorRow, cursorCol)) {
                let piece = board[fromRow][fromCol];
                movePiece(fromRow, fromCol, cursorRow, cursorCol);
                currentTurn = (currentTurn == PieceColor.White) ? PieceColor.Black : PieceColor.White;
                updateGameStatus();
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
    if (gameState == GameState.GameOver && gameOverMenuSprite) {
        gameOverMenuSprite.destroy();
        newGame();
    } else if (gameState == GameState.Playing) {
        undoLastMove();
        if (gameType == GameType.AI) {
            undoLastMove();
        }
    }
});

controller.left.onEvent(ControllerButtonEvent.Pressed, function () {
    clearActiveMessage();
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
    clearActiveMessage();
    if (gameState == GameState.MainMenu) {
        if (menuSelection < 1) {
            menuSelection++;
            updateMenuDisplay();
        }
    } else if (gameState == GameState.Playing) {
        if (cursorCol < BOARD_SIZE - 1) {
            cursorCol++;
            updateCursorSprite();
        }
    }
});

controller.up.onEvent(ControllerButtonEvent.Pressed, function () {
    clearActiveMessage();
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
    clearActiveMessage();
    if (gameState == GameState.MainMenu) {
        if (menuSelection < 1) {
            menuSelection++;
            updateMenuDisplay();
        }
    } else if (gameState == GameState.Playing && cursorRow < BOARD_SIZE - 1) {
        cursorRow++;
        updateCursorSprite();
    }
});

// ===========================
// === Highlight Object Pool ===
// ===========================
function getHighlightSprite(): Sprite {
    if (highlightPool.length > 0) {
        let spr = highlightPool.pop();
        spr.setFlag(SpriteFlag.Invisible, false);
        return spr;
    }
    let spr = sprites.create(image.create(SQUARE_SIZE, SQUARE_SIZE), SpriteKind.Hover);
    spr.z = Z_HIGHLIGHT;
    spr.setFlag(SpriteFlag.Ghost, true);
    return spr;
}

function clearMoveHighlights() {
    for (let hl of moveHighlights) {
        hl.setFlag(SpriteFlag.Invisible, true);
        highlightPool.push(hl);
    }
    moveHighlights = [];
}

function showMoveHighlights(row: number, col: number) {
    clearMoveHighlights();
    let piece = board[row][col];
    if (!piece) return;
    let hl = getHighlightSprite();
    hl.image.drawRect(0, 0, SQUARE_SIZE, SQUARE_SIZE, Color.Red);
    let pos = getCellPosition(row, col);
    hl.setPosition(pos.x, pos.y);
    moveHighlights.push(hl);
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (isLegalMove(row, col, r, c)) {
                let hlMove = getHighlightSprite();
                hlMove.image.drawRect(0, 0, SQUARE_SIZE, SQUARE_SIZE, 3);
                let pos2 = getCellPosition(r, c);
                hlMove.setPosition(pos2.x, pos2.y);
                moveHighlights.push(hlMove);
            }
        }
    }
}

function highlightLastMove() {
    if (moveHistory.length == 0) return;
    let lastMove = moveHistory[moveHistory.length - 1];
    let path: { row: number, col: number }[] = [];
    let dRow = lastMove.toRow - lastMove.fromRow;
    let dCol = lastMove.toCol - lastMove.fromCol;
    let stepRow = dRow === 0 ? 0 : dRow / Math.abs(dRow);
    let stepCol = dCol === 0 ? 0 : dCol / Math.abs(dCol);
    
    if (dRow === 0 || dCol === 0 || Math.abs(dRow) === Math.abs(dCol)) {
        let currentRow = lastMove.fromRow;
        let currentCol = lastMove.fromCol;
        path.push({ row: currentRow, col: currentCol });
        while (currentRow !== lastMove.toRow || currentCol !== lastMove.toCol) {
            currentRow += stepRow;
            currentCol += stepCol;
            path.push({ row: currentRow, col: currentCol });
        }
    } else {
        path.push({ row: lastMove.fromRow, col: lastMove.fromCol });
        path.push({ row: lastMove.toRow, col: lastMove.toCol });
    }
    
    for (let pos of path) {
        let hl = getHighlightSprite();
        hl.image.drawRect(0, 0, SQUARE_SIZE, SQUARE_SIZE, 2);
        let cellPos = getCellPosition(pos.row, pos.col);
        hl.setPosition(cellPos.x, cellPos.y);
        moveHighlights.push(hl);
    }
}

function newGame() {
    if (gameState == GameState.Playing) {
        gameOver = false;
        currentTurn = PieceColor.White;
        cursorRow = 0;
        cursorCol = 0;
        updateCursorSprite();
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (board[row][col] != null) {
                    board[row][col].sprite.destroy();
                }
            }
        }
        moveHistory = [];
        whiteScore = 0;
        blackScore = 0;
        if (leftStatusSprite) leftStatusSprite.destroy();
        if (rightStatusSprite) rightStatusSprite.destroy();
        initBoard();
        createStatusUI();
        updateStatusUI();
        displayCustomText("New Game: White's turn");
    }
}

controller.menu.onEvent(ControllerButtonEvent.Pressed, function () {
    if (gameState == GameState.MainMenu && menuSelection == 1) {
        aiSearchDepth = (aiSearchDepth < 5) ? aiSearchDepth + 1 : 2;
        estimatedTotalNodes = aiSearchDepth * 1000;
        updateMenuDisplay();
        return;
    }
    if (gameState == GameState.GameOver || gameState == GameState.Playing) {
        newGame();
    }
});

// ===========================
// === Initialization      ===
// ===========================
initCellPositions();
createMainMenu();
