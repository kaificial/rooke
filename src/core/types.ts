/**
 * Shared chess vocabulary. Nothing in `core/` touches the DOM or Three.js, so
 * the same code runs on the main thread (rules for the UI) and inside the
 * engine worker (search).
 */

export type Color = 'w' | 'b'

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'

export type PromotionType = 'q' | 'r' | 'b' | 'n'

export interface Piece {
  readonly type: PieceType
  readonly color: Color
}

/**
 * Board index 0..63 with a8 = 0 and h1 = 63, i.e. the order a FEN lists squares.
 * See `squares.ts` for conversions to file/rank.
 */
export type Square = number

export interface Move {
  from: Square
  to: Square
  /** The piece that moves (a pawn, even when it promotes). */
  piece: PieceType
  captured?: PieceType
  promotion?: PromotionType
  enPassant?: true
  castle?: 'k' | 'q'
  doublePush?: true
}

export const opposite = (color: Color): Color => (color === 'w' ? 'b' : 'w')

export const PIECE_NAMES: Readonly<Record<PieceType, string>> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}
