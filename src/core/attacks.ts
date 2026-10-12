import type { Color, Piece, Square } from './types'

/** [rowDelta, colDelta] steps. Row 0 is the eighth rank (see squares.ts). */
export type Step = readonly [number, number]

export const KNIGHT_STEPS: readonly Step[] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
]

export const KING_STEPS: readonly Step[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
]

export const ROOK_DIRECTIONS: readonly Step[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
export const BISHOP_DIRECTIONS: readonly Step[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

type Board = ReadonlyArray<Piece | null>

/** Is `sq` attacked by any piece of color `by`? Pure function of the board. */
export function isAttacked(board: Board, sq: Square, by: Color): boolean {
  const row = sq >> 3
  const col = sq & 7

  // Pawns. White pawns move toward row 0, so a white pawn attacking this
  // square sits one row further from it (row + 1); black is the mirror image.
  const pawnRow = by === 'w' ? row + 1 : row - 1
  if (pawnRow >= 0 && pawnRow < 8) {
    for (let dc = -1; dc <= 1; dc += 2) {
      const c = col + dc
      if (c < 0 || c > 7) continue
      const p = board[pawnRow * 8 + c]
      if (p && p.color === by && p.type === 'p') return true
    }
  }

  for (const [dr, dc] of KNIGHT_STEPS) {
    const r = row + dr
    const c = col + dc
    if (r < 0 || r > 7 || c < 0 || c > 7) continue
    const p = board[r * 8 + c]
    if (p && p.color === by && p.type === 'n') return true
  }

  for (const [dr, dc] of KING_STEPS) {
    const r = row + dr
    const c = col + dc
    if (r < 0 || r > 7 || c < 0 || c > 7) continue
    const p = board[r * 8 + c]
    if (p && p.color === by && p.type === 'k') return true
  }

  if (slidingAttack(board, row, col, by, ROOK_DIRECTIONS, 'r')) return true
  if (slidingAttack(board, row, col, by, BISHOP_DIRECTIONS, 'b')) return true
  return false
}

function slidingAttack(
  board: Board,
  row: number,
  col: number,
  by: Color,
  directions: readonly Step[],
  slider: 'r' | 'b',
): boolean {
  for (const [dr, dc] of directions) {
    let r = row + dr
    let c = col + dc
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r * 8 + c]
      if (p) {
        if (p.color === by && (p.type === slider || p.type === 'q')) return true
        break
      }
      r += dr
      c += dc
    }
  }
  return false
}
