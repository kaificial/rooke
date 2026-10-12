import { isAttacked } from './attacks'
import { fenChar, getPiece, pieceFromFenChar } from './pieces'
import { parseSquare, squareName } from './squares'
import { opposite } from './types'
import type { Color, Move, Piece, Square } from './types'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Castling rights bitmask. */
export const WHITE_KINGSIDE = 1
export const WHITE_QUEENSIDE = 2
export const BLACK_KINGSIDE = 4
export const BLACK_QUEENSIDE = 8

// Moving from or to one of these squares revokes the matching rights, which
// covers king moves, rook moves and rooks being captured at home.
const RIGHTS_AFTER_TOUCHING: Record<number, number> = {
  60: ~(WHITE_KINGSIDE | WHITE_QUEENSIDE) & 15,
  63: ~WHITE_KINGSIDE & 15,
  56: ~WHITE_QUEENSIDE & 15,
  4: ~(BLACK_KINGSIDE | BLACK_QUEENSIDE) & 15,
  7: ~BLACK_KINGSIDE & 15,
  0: ~BLACK_QUEENSIDE & 15,
}

// [rook from, rook to] for each castling move, keyed by king destination.
const CASTLE_ROOK_MOVES: Record<number, readonly [Square, Square]> = {
  62: [63, 61],
  58: [56, 59],
  6: [7, 5],
  2: [0, 3],
}

interface Undo {
  move: Move
  castling: number
  epSquare: Square
  halfmove: number
}

/**
 * A chess position that can make and unmake moves in place.
 *
 * It trusts the moves it is given (they should come from `legalMoves`), which
 * keeps the search fast. Use `Game` when moves arrive from outside.
 */
export class Position {
  readonly board: (Piece | null)[] = new Array<Piece | null>(64).fill(null)
  turn: Color = 'w'
  castling = 0
  /** En passant target square, or -1 when there is none. */
  epSquare: Square = -1
  halfmove = 0
  fullmove = 1

  private readonly kings: Record<Color, Square> = { w: -1, b: -1 }
  private readonly undoStack: Undo[] = []

  static fromFen(fen: string): Position {
    const pos = new Position()
    const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/)
    const rows = placement?.split('/')
    if (!rows || rows.length !== 8) throw new Error(`Invalid FEN placement: "${fen}"`)

    rows.forEach((row, r) => {
      let c = 0
      for (const char of row) {
        if (/\d/.test(char)) {
          c += Number(char)
          continue
        }
        const piece = pieceFromFenChar(char)
        if (!piece || c > 7) throw new Error(`Invalid FEN placement: "${fen}"`)
        pos.board[r * 8 + c] = piece
        if (piece.type === 'k') pos.kings[piece.color] = r * 8 + c
        c++
      }
      if (c !== 8) throw new Error(`Invalid FEN placement: "${fen}"`)
    })
    if (pos.kings.w < 0 || pos.kings.b < 0) throw new Error(`FEN is missing a king: "${fen}"`)

    pos.turn = turn === 'b' ? 'b' : 'w'
    if (castling?.includes('K')) pos.castling |= WHITE_KINGSIDE
    if (castling?.includes('Q')) pos.castling |= WHITE_QUEENSIDE
    if (castling?.includes('k')) pos.castling |= BLACK_KINGSIDE
    if (castling?.includes('q')) pos.castling |= BLACK_QUEENSIDE
    pos.epSquare = ep && ep !== '-' ? parseSquare(ep) : -1
    pos.halfmove = Number(half) || 0
    pos.fullmove = Number(full) || 1
    return pos
  }

  static start(): Position {
    return Position.fromFen(START_FEN)
  }

  toFen(): string {
    const rows: string[] = []
    for (let r = 0; r < 8; r++) {
      let row = ''
      let empty = 0
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r * 8 + c]
        if (!piece) {
          empty++
          continue
        }
        if (empty) row += empty
        empty = 0
        row += fenChar(piece)
      }
      if (empty) row += empty
      rows.push(row)
    }

    let rights = ''
    if (this.castling & WHITE_KINGSIDE) rights += 'K'
    if (this.castling & WHITE_QUEENSIDE) rights += 'Q'
    if (this.castling & BLACK_KINGSIDE) rights += 'k'
    if (this.castling & BLACK_QUEENSIDE) rights += 'q'

    const ep = this.epSquare >= 0 ? squareName(this.epSquare) : '-'
    return `${rows.join('/')} ${this.turn} ${rights || '-'} ${ep} ${this.halfmove} ${this.fullmove}`
  }

  /** Copy of the position without its undo history. */
  clone(): Position {
    return Position.fromFen(this.toFen())
  }

  pieceAt(sq: Square): Piece | null {
    return this.board[sq]
  }

  kingSquare(color: Color): Square {
    return this.kings[color]
  }

  isAttackedBy(sq: Square, by: Color): boolean {
    return isAttacked(this.board, sq, by)
  }

  inCheck(color: Color = this.turn): boolean {
    return isAttacked(this.board, this.kings[color], opposite(color))
  }

  /**
   * Identity of the position for repetition detection: placement, side to
   * move, castling rights, and an en passant square only when it matters.
   */
  key(): string {
    const [placement, turn, rights] = this.toFen().split(' ')
    return `${placement} ${turn} ${rights} ${this.epCapturePossible() ? this.epSquare : '-'}`
  }

  private epCapturePossible(): boolean {
    if (this.epSquare < 0) return false
    // The side to move captures with a pawn standing next to the pushed pawn,
    // i.e. one row "behind" the target square from the mover's point of view.
    const row = (this.epSquare >> 3) + (this.turn === 'w' ? 1 : -1)
    const col = this.epSquare & 7
    for (const c of [col - 1, col + 1]) {
      if (c < 0 || c > 7) continue
      const p = this.board[row * 8 + c]
      if (p && p.type === 'p' && p.color === this.turn) return true
    }
    return false
  }

  makeMove(move: Move): void {
    const color = this.turn
    const them = opposite(color)

    this.undoStack.push({
      move,
      castling: this.castling,
      epSquare: this.epSquare,
      halfmove: this.halfmove,
    })

    const moving = this.board[move.from]!
    this.board[move.from] = null

    if (move.enPassant) {
      this.board[move.to + (color === 'w' ? 8 : -8)] = null
    }
    this.board[move.to] = move.promotion ? getPiece(move.promotion, color) : moving

    if (move.castle) {
      const [rookFrom, rookTo] = CASTLE_ROOK_MOVES[move.to]
      this.board[rookTo] = this.board[rookFrom]
      this.board[rookFrom] = null
    }

    if (move.piece === 'k') this.kings[color] = move.to

    this.castling &= (RIGHTS_AFTER_TOUCHING[move.from] ?? 15) & (RIGHTS_AFTER_TOUCHING[move.to] ?? 15)
    this.epSquare = move.doublePush ? (move.from + move.to) >> 1 : -1
    this.halfmove = move.piece === 'p' || move.captured ? 0 : this.halfmove + 1
    if (color === 'b') this.fullmove++
    this.turn = them
  }

  unmakeMove(): void {
    const undo = this.undoStack.pop()
    if (!undo) throw new Error('unmakeMove: nothing to undo')
    const { move } = undo

    this.turn = opposite(this.turn)
    const color = this.turn
    const them = opposite(color)
    if (color === 'b') this.fullmove--

    this.board[move.from] = getPiece(move.piece, color)
    this.board[move.to] = null

    if (move.enPassant) {
      this.board[move.to + (color === 'w' ? 8 : -8)] = getPiece('p', them)
    } else if (move.captured) {
      this.board[move.to] = getPiece(move.captured, them)
    }

    if (move.castle) {
      const [rookFrom, rookTo] = CASTLE_ROOK_MOVES[move.to]
      this.board[rookFrom] = this.board[rookTo]
      this.board[rookTo] = null
    }

    if (move.piece === 'k') this.kings[color] = move.from

    this.castling = undo.castling
    this.epSquare = undo.epSquare
    this.halfmove = undo.halfmove
  }
}
