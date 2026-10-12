import type { Color, PieceType, Square } from './types'

/**
 * Zobrist hashing: every (piece, square), the side to move, the castling
 * rights and the en passant file get a random number, and a position's hash is
 * the XOR of the ones that apply. Making a move only XORs what changed, so the
 * hash is cheap to keep up to date, and equal positions get equal hashes.
 *
 * Each hash is 64 bits, held as two 32-bit halves because that is much faster
 * in JavaScript than BigInt. The numbers come from a fixed seed so hashes are
 * the same on the main thread and in the worker.
 */

function xorshift32(seed: number): () => number {
  let state = seed | 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state | 0
  }
}

const next = xorshift32(0x2545f491)
const table = (size: number) => Int32Array.from({ length: size }, next)

export const PIECE_LO = table(12 * 64)
export const PIECE_HI = table(12 * 64)
export const CASTLING_LO = table(16)
export const CASTLING_HI = table(16)
export const EP_FILE_LO = table(8)
export const EP_FILE_HI = table(8)
export const SIDE_LO = next()
export const SIDE_HI = next()

const TYPE_INDEX: Readonly<Record<PieceType, number>> = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 }

/** Index into PIECE_LO / PIECE_HI for a piece standing on a square. */
export function pieceKey(type: PieceType, color: Color, square: Square): number {
  return (TYPE_INDEX[type] * 2 + (color === 'w' ? 0 : 1)) * 64 + square
}
