import type { Move } from '../core'

export const BOUND_EXACT = 1
export const BOUND_LOWER = 2 // the real score is at least this (a cutoff happened)
export const BOUND_UPPER = 3 // the real score is at most this (nothing beat alpha)
const EMPTY = 0

const PROMOTION_CODE = { q: 1, r: 2, b: 3, n: 4 } as const

/** Packs a move into a small integer: 6 bits from, 6 bits to, 3 bits promotion. 0 means "no move". */
export function moveKey(move: Move): number {
  return move.from | (move.to << 6) | ((move.promotion ? PROMOTION_CODE[move.promotion] : 0) << 12) | (1 << 15)
}

/**
 * Remembers what the search already worked out about positions it has seen,
 * so it doesn't redo the same work when different move orders reach the same
 * position, and so the best move from the previous, shallower pass can be
 * tried first.
 *
 * Entries live in parallel typed arrays instead of objects, which keeps lookups
 * allocation-free. Positions are found by their Zobrist hash.
 */
export class TranspositionTable {
  readonly keyLo: Int32Array
  readonly keyHi: Int32Array
  readonly score: Int32Array
  readonly move: Int32Array
  readonly depth: Int8Array
  readonly bound: Uint8Array
  private readonly mask: number

  /** `sizeBits`: the table holds 2^sizeBits entries (about 18 bytes each). */
  constructor(sizeBits = 20) {
    const size = 1 << sizeBits
    this.mask = size - 1
    this.keyLo = new Int32Array(size)
    this.keyHi = new Int32Array(size)
    this.score = new Int32Array(size)
    this.move = new Int32Array(size)
    this.depth = new Int8Array(size)
    this.bound = new Uint8Array(size)
  }

  clear(): void {
    this.bound.fill(EMPTY)
  }

  /** Index of the entry for this position, or -1 if it isn't stored. */
  probe(lo: number, hi: number): number {
    const index = lo & this.mask
    return this.bound[index] !== EMPTY && this.keyLo[index] === lo && this.keyHi[index] === hi ? index : -1
  }

  store(lo: number, hi: number, depth: number, score: number, bound: number, move: number): void {
    const index = lo & this.mask
    const sameStored = this.bound[index] !== EMPTY && this.keyLo[index] === lo && this.keyHi[index] === hi
    // Keep a deeper result for the same position, but never let a slot go stale forever.
    if (sameStored && this.depth[index] > depth + 2 && bound !== BOUND_EXACT) return

    this.keyLo[index] = lo
    this.keyHi[index] = hi
    this.score[index] = score
    this.depth[index] = depth
    this.bound[index] = bound
    // Keep the old best move if this search didn't find one.
    if (move !== 0 || !sameStored) this.move[index] = move
  }
}
