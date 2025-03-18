/**
 * This is the main file for your project.
 *
 * Create images, tilemaps, animations, and songs using the
 * asset explorer in VS Code. You can reference those assets
 * using the tagged templates on the assets namespace:
 *
 *     assets.image`myImageName`
 *     assets.tilemap`myTilemapName`
 *     assets.tile`myTileName`
 *     assets.animation`myAnimationName`
 *     assets.song`mySongName`
 *
 * New to MakeCode Arcade? Try creating a new project using one
 * of the templates to learn about Sprites, Tilemaps, Animations,
 * and more! Or check out the reference docs here:
 *
 * https://arcade.makecode.com/reference
 */

game.onUpdate(() => {
    // Code in this function will run once per frame. MakeCode
    // Arcade games run at 30 FPS
    
});

// ----- Constants & Global Variables -----
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

class Piece {
    type: PieceType
    color: PieceColor
    hasMoved: boolean
    sprite: Sprite
    constructor(type: PieceType, color: PieceColor) {
        this.type = type
        this.color = color
        this.hasMoved = false
        // sprite will be assigned when the piece is created on the board
    }
}

// Board configuration
let squareSize = 14
let boardOffsetX = 24
let boardOffsetY = 4
let board: (Piece | null)[][] = []

// Track additional state for en passant:
// When a pawn moves two squares, store its landing square
let enPassantTarget: { row: number, col: number } | null = null

// Cursor and selection tracking
let cursorRow = 0
let cursorCol = 0
let selectedPiece: { row: number, col: number } | null = null
let currentTurn: PieceColor = PieceColor.White

// Game state flags
let gameOver = false

// Sprite Kinds
namespace SpriteKind {
    export const Piece = SpriteKind.create()
    export const Cursor = SpriteKind.create()
}

// Global piece images (simple icons)
let wPawnImg: Image
let bPawnImg: Image
let wRookImg: Image
let bRookImg: Image
let wKnightImg: Image
let bKnightImg: Image
let wBishopImg: Image
let bBishopImg: Image
let wQueenImg: Image
let bQueenImg: Image
let wKingImg: Image
let bKingImg: Image

// Cursor sprite
let cursorSprite: Sprite

// ----- Helper Functions -----
// Load simple images for each piece
function loadPieceImages() {
    // White Pawn: white filled circle
    bPawnImg = image.create(squareSize, squareSize)
    bPawnImg.fill(0)
    bPawnImg.fillCircle(Math.idiv(squareSize, 2), Math.idiv(squareSize, 2), Math.idiv(squareSize, 2) - 1, 15)
    // Black Pawn: black filled circle
    wPawnImg = image.create(squareSize, squareSize)
    wPawnImg.fill(0)
    wPawnImg.fillCircle(Math.idiv(squareSize, 2), Math.idiv(squareSize, 2), Math.idiv(squareSize, 2) - 1, 1)

    // White Rook: white square with a horizontal line
    bRookImg = image.create(squareSize, squareSize)
    bRookImg.fill(0)
    bRookImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15)
    bRookImg.drawLine(2, 4, squareSize - 3, 4, 0)
    // Black Rook:
    wRookImg = image.create(squareSize, squareSize)
    wRookImg.fill(0)
    wRookImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1)
    wRookImg.drawLine(2, 4, squareSize - 3, 4, 0)

    // White Knight: white square with a diagonal line
    bKnightImg = image.create(squareSize, squareSize)
    bKnightImg.fill(0)
    bKnightImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15)
    bKnightImg.drawLine(2, squareSize - 3, squareSize - 3, 2, 0)
    // Black Knight:
    wKnightImg = image.create(squareSize, squareSize)
    wKnightImg.fill(0)
    wKnightImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1)
    wKnightImg.drawLine(2, squareSize - 3, squareSize - 3, 2, 0)

    // White Bishop: white square with an X
    bBishopImg = image.create(squareSize, squareSize)
    bBishopImg.fill(0)
    bBishopImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15)
    bBishopImg.drawLine(2, 2, squareSize - 3, squareSize - 3, 0)
    bBishopImg.drawLine(squareSize - 3, 2, 2, squareSize - 3, 0)
    // Black Bishop:
    wBishopImg = image.create(squareSize, squareSize)
    wBishopImg.fill(0)
    wBishopImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1)
    wBishopImg.drawLine(2, 2, squareSize - 3, squareSize - 3, 0)
    wBishopImg.drawLine(squareSize - 3, 2, 2, squareSize - 3, 0)

    // White Queen: white circle with a cross
    bQueenImg = image.create(squareSize, squareSize)
    bQueenImg.fill(0)
    bQueenImg.fillCircle(Math.idiv(squareSize, 2), Math.idiv(squareSize, 2), Math.idiv(squareSize, 2) - 1, 15)
    bQueenImg.drawLine(Math.idiv(squareSize, 2), 2, Math.idiv(squareSize, 2), squareSize - 3, 0)
    bQueenImg.drawLine(2, Math.idiv(squareSize, 2), squareSize - 3, Math.idiv(squareSize, 2), 0)
    // Black Queen:
    wQueenImg = image.create(squareSize, squareSize)
    wQueenImg.fill(0)
    wQueenImg.fillCircle(Math.idiv(squareSize, 2), Math.idiv(squareSize, 2), Math.idiv(squareSize, 2) - 1, 1)
    wQueenImg.drawLine(Math.idiv(squareSize, 2), 2, Math.idiv(squareSize, 2), squareSize - 3, 0)
    wQueenImg.drawLine(2, Math.idiv(squareSize, 2), squareSize - 3, Math.idiv(squareSize, 2), 0)

    // White King: white square with a plus sign
    bKingImg = image.create(squareSize, squareSize)
    bKingImg.fill(0)
    bKingImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 15)
    bKingImg.drawLine(Math.idiv(squareSize, 2), 2, Math.idiv(squareSize, 2), squareSize - 3, 0)
    bKingImg.drawLine(2, Math.idiv(squareSize, 2), squareSize - 3, Math.idiv(squareSize, 2), 0)
    // Black King:
    wKingImg = image.create(squareSize, squareSize)
    wKingImg.fill(0)
    wKingImg.fillRect(2, 2, squareSize - 4, squareSize - 4, 1)
    wKingImg.drawLine(Math.idiv(squareSize, 2), 2, Math.idiv(squareSize, 2), squareSize - 3, 0)
    wKingImg.drawLine(2, Math.idiv(squareSize, 2), squareSize - 3, Math.idiv(squareSize, 2), 0)
}

// Return the appropriate image for a piece
function getPieceImage(piece: Piece): Image {
    if (piece.color == PieceColor.White) {
        switch (piece.type) {
            case PieceType.Pawn: return wPawnImg
            case PieceType.Rook: return wRookImg
            case PieceType.Knight: return wKnightImg
            case PieceType.Bishop: return wBishopImg
            case PieceType.Queen: return wQueenImg
            case PieceType.King: return wKingImg
        }
    } else {
        switch (piece.type) {
            case PieceType.Pawn: return bPawnImg
            case PieceType.Rook: return bRookImg
            case PieceType.Knight: return bKnightImg
            case PieceType.Bishop: return bBishopImg
            case PieceType.Queen: return bQueenImg
            case PieceType.King: return bKingImg
        }
    }
    return image.create(squareSize, squareSize)
}

// Helper function to get the name of a piece type
function pieceTypeName(type: PieceType): string {
    switch (type) {
        case PieceType.Pawn: return "Pawn"
        case PieceType.Rook: return "Rook"
        case PieceType.Knight: return "Knight"
        case PieceType.Bishop: return "Bishop"
        case PieceType.Queen: return "Queen"
        case PieceType.King: return "King"
    }
}

// Create a sprite for a piece and place it on the board
function createPiece(type: PieceType, color: PieceColor, row: number, col: number): Piece {
    let piece = new Piece(type, color)
    piece.sprite = sprites.create(getPieceImage(piece), SpriteKind.Piece)
    piece.sprite.setPosition(boardOffsetX + col * squareSize + Math.idiv(squareSize, 2),
        boardOffsetY + row * squareSize + Math.idiv(squareSize, 2))
    return piece
}

// Draw the board background (static)
function drawBoardBackground() {
    let bg = image.create(160, 120)
    bg.fill(7)
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            let x = boardOffsetX + col * squareSize
            let y = boardOffsetY + row * squareSize
            if ((row + col) % 2 == 0) {
                bg.fillRect(x, y, squareSize, squareSize, 6)
            } else {
                bg.fillRect(x, y, squareSize, squareSize, 2)
            }
        }
    }
    scene.setBackgroundImage(bg)
}

// Create a simple cursor image (outlined square)
function createCursorImage(): Image {
    let imgCursor = image.create(squareSize, squareSize)
    imgCursor.fill(0)
    imgCursor.drawRect(0, 0, squareSize, squareSize, 5)
    return imgCursor
}

// Update cursor sprite’s position
function updateCursorSprite() {
    cursorSprite.setPosition(boardOffsetX + cursorCol * squareSize + Math.idiv(squareSize, 2),
        boardOffsetY + cursorRow * squareSize + Math.idiv(squareSize, 2))
}

// ----- Board Setup & Piece Movement Logic -----

// Initialize the board with starting positions
function initBoard() {
    board = []
    for (let row = 0; row < 8; row++) {
        let rowArray: (Piece | null)[] = []
        for (let col = 0; col < 8; col++) {
            rowArray.push(null)
        }
        board.push(rowArray)
    }
    enPassantTarget = null
    // Place pawns
    for (let col = 0; col < 8; col++) {
        board[1][col] = createPiece(PieceType.Pawn, PieceColor.Black, 1, col)
        board[6][col] = createPiece(PieceType.Pawn, PieceColor.White, 6, col)
    }
    // Place rooks
    board[0][0] = createPiece(PieceType.Rook, PieceColor.Black, 0, 0)
    board[0][7] = createPiece(PieceType.Rook, PieceColor.Black, 0, 7)
    board[7][0] = createPiece(PieceType.Rook, PieceColor.White, 7, 0)
    board[7][7] = createPiece(PieceType.Rook, PieceColor.White, 7, 7)
    // Place knights
    board[0][1] = createPiece(PieceType.Knight, PieceColor.Black, 0, 1)
    board[0][6] = createPiece(PieceType.Knight, PieceColor.Black, 0, 6)
    board[7][1] = createPiece(PieceType.Knight, PieceColor.White, 7, 1)
    board[7][6] = createPiece(PieceType.Knight, PieceColor.White, 7, 6)
    // Place bishops
    board[0][2] = createPiece(PieceType.Bishop, PieceColor.Black, 0, 2)
    board[0][5] = createPiece(PieceType.Bishop, PieceColor.Black, 0, 5)
    board[7][2] = createPiece(PieceType.Bishop, PieceColor.White, 7, 2)
    board[7][5] = createPiece(PieceType.Bishop, PieceColor.White, 7, 5)
    // Place queens
    board[0][3] = createPiece(PieceType.Queen, PieceColor.Black, 0, 3)
    board[7][3] = createPiece(PieceType.Queen, PieceColor.White, 7, 3)
    // Place kings
    board[0][4] = createPiece(PieceType.King, PieceColor.Black, 0, 4)
    board[7][4] = createPiece(PieceType.King, PieceColor.White, 7, 4)
}

// --- Rule Enforcement Helpers ---
// Create a copy of board (ignoring sprite references) for simulation
function cloneBoard(b: (Piece | null)[][]): (Piece | null)[][] {
    let newBoard: (Piece | null)[][] = []
    for (let row = 0; row < 8; row++) {
        let newRow: (Piece | null)[] = []
        for (let col = 0; col < 8; col++) {
            let p = b[row][col]
            if (p) {
                let newPiece = new Piece(p.type, p.color)
                newPiece.hasMoved = p.hasMoved
                newRow.push(newPiece)
            } else {
                newRow.push(null)
            }
        }
        newBoard.push(newRow)
    }
    return newBoard
}

// Check if a square is attacked by any piece of a given color on board b
function isSquareAttacked(row: number, col: number, byColor: PieceColor, b: (Piece | null)[][]): boolean {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = b[r][c]
            if (p != null && p.color == byColor) {
                if (p.type == PieceType.Pawn) {
                    let direction = p.color == PieceColor.White ? -1 : 1
                    if (row == r + direction && (col == c - 1 || col == c + 1)) {
                        return true
                    }
                } else {
                    if (canPieceAttack(r, c, row, col, p, b)) {
                        return true
                    }
                }
            }
        }
    }
    return false
}

// Check if a piece at (fromRow, fromCol) can attack target square on board b
function canPieceAttack(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece, b: (Piece | null)[][]): boolean {
    let oldBoard = board
    board = b
    let legal = false
    switch (piece.type) {
        case PieceType.Pawn:
            let direction = piece.color == PieceColor.White ? -1 : 1
            if (Math.abs(toCol - fromCol) == 1 && toRow == fromRow + direction) {
                legal = true
            }
            break
        case PieceType.Rook:
            legal = isLegalRookMove(fromRow, fromCol, toRow, toCol)
            break
        case PieceType.Knight:
            legal = isLegalKnightMove(fromRow, fromCol, toRow, toCol)
            break
        case PieceType.Bishop:
            legal = isLegalBishopMove(fromRow, fromCol, toRow, toCol)
            break
        case PieceType.Queen:
            legal = isLegalQueenMove(fromRow, fromCol, toRow, toCol)
            break
        case PieceType.King:
            legal = Math.abs(toRow - fromRow) <= 1 && Math.abs(toCol - fromCol) <= 1
            break
    }
    board = oldBoard
    return legal
}

// Find the king's position for a given color on board b
function findKing(color: PieceColor, b: (Piece | null)[][]): { row: number, col: number } | null {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = b[r][c]
            if (p != null && p.color == color && p.type == PieceType.King) {
                return { row: r, col: c }
            }
        }
    }
    return null
}

// Check if the king of the given color is in check on board b
function isKingInCheck(color: PieceColor, b: (Piece | null)[][]): boolean {
    let kingPos = findKing(color, b)
    if (kingPos == null) return true
    return isSquareAttacked(kingPos.row, kingPos.col, color == PieceColor.White ? PieceColor.Black : PieceColor.White, b)
}

// Validate a move by simulating it and checking that own king is not left in check
function isLegalMoveSimulated(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let piece = board[fromRow][fromCol]
    if (!piece) return false
    if (!isLegalMoveBasic(fromRow, fromCol, toRow, toCol, piece)) return false

    let simBoard = cloneBoard(board)
    let simPiece = simBoard[fromRow][fromCol]
    if (simPiece == null) return false

    // Handle en passant capture in simulation
    if (simPiece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 && simBoard[toRow][toCol] == null) {
        // Remove captured pawn in en passant
        simBoard[fromRow][toCol] = null
    } else {
        simBoard[toRow][toCol] = null
    }
    // Move the piece in simulation
    simBoard[toRow][toCol] = simPiece
    simBoard[fromRow][fromCol] = null

    // For castling, also simulate moving the rook
    if (simPiece.type == PieceType.King && Math.abs(toCol - fromCol) == 2) {
        if (toCol > fromCol) {
            let rook = simBoard[fromRow][7]
            simBoard[fromRow][fromCol + 1] = rook
            simBoard[fromRow][7] = null
        } else {
            let rook = simBoard[fromRow][0]
            simBoard[fromRow][fromCol - 1] = rook
            simBoard[fromRow][0] = null
        }
    }
    return !isKingInCheck(piece.color, simBoard)
}

// Basic move legality (ignores king safety) including special moves
function isLegalMoveBasic(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece): boolean {
    // En passant: if pawn diagonal move and destination empty, and target equals enPassantTarget:
    if (piece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 && toRow == fromRow + (piece.color == PieceColor.White ? -1 : 1)) {
        if (board[toRow][toCol] == null && enPassantTarget && enPassantTarget.row == toRow && enPassantTarget.col == toCol) {
            return true
        }
    }
    switch (piece.type) {
        case PieceType.Pawn:
            return isLegalPawnMove(fromRow, fromCol, toRow, toCol, piece)
        case PieceType.Rook:
            return isLegalRookMove(fromRow, fromCol, toRow, toCol)
        case PieceType.Knight:
            return isLegalKnightMove(fromRow, fromCol, toRow, toCol)
        case PieceType.Bishop:
            return isLegalBishopMove(fromRow, fromCol, toRow, toCol)
        case PieceType.Queen:
            return isLegalQueenMove(fromRow, fromCol, toRow, toCol)
        case PieceType.King:
            if (Math.abs(toCol - fromCol) == 2) {
                if (isKingInCheck(piece.color, board)) return false
                let step = toCol > fromCol ? 1 : -1
                if (isSquareAttacked(fromRow, fromCol + step, piece.color == PieceColor.White ? PieceColor.Black : PieceColor.White, board)) return false
                if (isSquareAttacked(toRow, toCol, piece.color == PieceColor.White ? PieceColor.Black : PieceColor.White, board)) return false
                return true
            } else {
                return isLegalKingMove(fromRow, fromCol, toRow, toCol)
            }
    }
    return false
}

// Main move legality function that simulates moves to ensure king safety
function isLegalMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let piece = board[fromRow][fromCol]
    if (piece == null) return false
    if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) return false
    let dest = board[toRow][toCol]
    if (dest != null && dest.color == piece.color) return false
    return isLegalMoveSimulated(fromRow, fromCol, toRow, toCol)
}

// ----- Piece Movement Functions -----
// Pawn movement: one or two steps forward, diagonal capture, and en passant
function isLegalPawnMove(fromRow: number, fromCol: number, toRow: number, toCol: number, piece: Piece): boolean {
    let direction = piece.color == PieceColor.White ? -1 : 1
    if (toCol == fromCol && toRow == fromRow + direction && board[toRow][toCol] == null) {
        return true
    }
    if (toCol == fromCol && !piece.hasMoved && toRow == fromRow + 2 * direction &&
        board[fromRow + direction][fromCol] == null && board[toRow][toCol] == null) {
        return true
    }
    if (Math.abs(toCol - fromCol) == 1 && toRow == fromRow + direction) {
        if (board[toRow][toCol] != null && board[toRow][toCol].color != piece.color) {
            return true
        }
        // En passant handled above
    }
    return false
}

function isLegalRookMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    if (fromRow != toRow && fromCol != toCol) return false
    if (fromRow == toRow) {
        let step = toCol > fromCol ? 1 : -1
        for (let c = fromCol + step; c != toCol; c += step) {
            if (board[fromRow][c] != null) return false
        }
    } else {
        let step = toRow > fromRow ? 1 : -1
        for (let r = fromRow + step; r != toRow; r += step) {
            if (board[r][fromCol] != null) return false
        }
    }
    return true
}

function isLegalKnightMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let dr = Math.abs(toRow - fromRow)
    let dc = Math.abs(toCol - fromCol)
    return (dr == 2 && dc == 1) || (dr == 1 && dc == 2)
}

function isLegalBishopMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    if (Math.abs(toRow - fromRow) != Math.abs(toCol - fromCol)) return false
    let stepRow = toRow > fromRow ? 1 : -1
    let stepCol = toCol > fromCol ? 1 : -1
    let r = fromRow + stepRow
    let c = fromCol + stepCol
    while (r != toRow && c != toCol) {
        if (board[r][c] != null) return false
        r += stepRow
        c += stepCol
    }
    return true
}

function isLegalQueenMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    return isLegalRookMove(fromRow, fromCol, toRow, toCol) ||
           isLegalBishopMove(fromRow, fromCol, toRow, toCol)
}

function isLegalKingMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    let dr = Math.abs(toRow - fromRow)
    let dc = Math.abs(toCol - fromCol)
    return dr <= 1 && dc <= 1
}

// Move a piece (update board and sprite); handles en passant, castling, and promotion
function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    let piece = board[fromRow][fromCol]
    if (piece == null) return

    // Handle en passant capture
    if (piece.type == PieceType.Pawn && Math.abs(toCol - fromCol) == 1 &&
        board[toRow][toCol] == null && enPassantTarget &&
        enPassantTarget.row == toRow && enPassantTarget.col == toCol) {
        if (board[fromRow][toCol] != null) {
            board[fromRow][toCol].sprite.destroy()
            board[fromRow][toCol] = null
        }
    }

    // Capture destination piece if exists
    let destPiece = board[toRow][toCol]
    if (destPiece != null) {
        destPiece.sprite.destroy()
    }

    // Handle castling: move the rook accordingly
    if (piece.type == PieceType.King && Math.abs(toCol - fromCol) == 2) {
        if (toCol > fromCol) {
            let rook = board[fromRow][7]
            board[fromRow][7] = null
            board[fromRow][fromCol + 1] = rook
            if (rook) {
                rook.hasMoved = true
                rook.sprite.setPosition(boardOffsetX + (fromCol + 1) * squareSize + Math.idiv(squareSize, 2),
                    boardOffsetY + fromRow * squareSize + Math.idiv(squareSize, 2))
            }
        } else {
            let rook = board[fromRow][0]
            board[fromRow][0] = null
            board[fromRow][fromCol - 1] = rook
            if (rook) {
                rook.hasMoved = true
                rook.sprite.setPosition(boardOffsetX + (fromCol - 1) * squareSize + Math.idiv(squareSize, 2),
                    boardOffsetY + fromRow * squareSize + Math.idiv(squareSize, 2))
            }
        }
    }

    board[toRow][toCol] = piece
    board[fromRow][fromCol] = null
    piece.hasMoved = true
    piece.sprite.setPosition(boardOffsetX + toCol * squareSize + Math.idiv(squareSize, 2),
                              boardOffsetY + toRow * squareSize + Math.idiv(squareSize, 2))
    // Pawn promotion: auto-promote to queen
    if (piece.type == PieceType.Pawn) {
        if ((piece.color == PieceColor.White && toRow == 0) ||
            (piece.color == PieceColor.Black && toRow == 7)) {
            piece.type = PieceType.Queen
            piece.sprite.setImage(getPieceImage(piece))
        }
    }
    // Update en passant target:
    if (piece.type == PieceType.Pawn && Math.abs(toRow - fromRow) == 2) {
        enPassantTarget = { row: fromRow + (toRow - fromRow) / 2, col: fromCol }
    } else {
        enPassantTarget = null
    }
}

// ----- Game Status & User Feedback -----

// Check if current player has any legal moves
function hasAnyLegalMove(color: PieceColor): boolean {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = board[r][c]
            if (p != null && p.color == color) {
                for (let r2 = 0; r2 < 8; r2++) {
                    for (let c2 = 0; c2 < 8; c2++) {
                        if (isLegalMove(r, c, r2, c2)) {
                            return true
                        }
                    }
                }
            }
        }
    }
    return false
}

function updateGameStatus() {
    if (gameOver) return
    if (isKingInCheck(currentTurn, board)) {
        game.splash("Check!")
    }
    if (!hasAnyLegalMove(currentTurn)) {
        if (isKingInCheck(currentTurn, board)) {
            game.splash("Checkmate! " + (currentTurn == PieceColor.White ? "Black" : "White") + " wins!")
        } else {
            game.splash("Stalemate!")
        }
    }
}

// ----- Input Handling -----
// Button A: select piece or attempt move
controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    if (gameOver) return
    if (selectedPiece == null) {
        let piece = board[cursorRow][cursorCol]
        if (piece != null && piece.color == currentTurn) {
            selectedPiece = { row: cursorRow, col: cursorCol }
            game.splash("Selected " + (piece.color == PieceColor.White ? "White" : "Black") + " " + pieceTypeName(piece.type))
        }
    } else {
        let fromRow = selectedPiece.row
        let fromCol = selectedPiece.col
        if (isLegalMove(fromRow, fromCol, cursorRow, cursorCol)) {
            movePiece(fromRow, fromCol, cursorRow, cursorCol)
            currentTurn = currentTurn == PieceColor.White ? PieceColor.Black : PieceColor.White
            updateGameStatus()
        } else {
            game.splash("Illegal Move!")
        }
        selectedPiece = null
    }
})

// Arrow keys to move the cursor
controller.left.onEvent(ControllerButtonEvent.Pressed, function () {
    if (cursorCol > 0) {
        cursorCol--
        updateCursorSprite()
    }
})
controller.right.onEvent(ControllerButtonEvent.Pressed, function () {
    if (cursorCol < 7) {
        cursorCol++
        updateCursorSprite()
    }
})
controller.up.onEvent(ControllerButtonEvent.Pressed, function () {
    if (cursorRow > 0) {
        cursorRow--
        updateCursorSprite()
    }
})
controller.down.onEvent(ControllerButtonEvent.Pressed, function () {
    if (cursorRow < 7) {
        cursorRow++
        updateCursorSprite()
    }
})

// Button B: restart game
controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    gameOver = false
    currentTurn = PieceColor.White
    cursorRow = 0
    cursorCol = 0
    updateCursorSprite()
    // Destroy existing piece sprites
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] != null) {
                let piece = board[r][c]
                piece.sprite.destroy()
            }
        }
    }
    initBoard()
    game.splash("New Game: White's turn")
})

// ----- Initialization -----
loadPieceImages()
drawBoardBackground()
initBoard()

cursorSprite = sprites.create(createCursorImage(), SpriteKind.Cursor)
cursorSprite.setFlag(SpriteFlag.Ghost, true)
cursorSprite.z = 100
updateCursorSprite()

game.splash("White's turn")
