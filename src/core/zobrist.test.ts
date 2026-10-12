import { describe, expect, it } from 'vitest'
import { legalMoves } from './movegen'
import { Position } from './position'

// A small deterministic generator so failures are reproducible.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0
    return (s >>> 0) / 2 ** 32
  }
}

const STARTS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', // castling, en passant, promotions
  'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
]

describe('zobrist hashing', () => {
  it('stays equal to a full recompute through random games, including unmaking', () => {
    for (const [i, fen] of STARTS.entries()) {
      const random = rng(i + 1)
      for (let game = 0; game < 20; game++) {
        const pos = Position.fromFen(fen)
        const trail: [number, number][] = []

        for (let ply = 0; ply < 60; ply++) {
          const moves = legalMoves(pos)
          if (moves.length === 0) break
          trail.push([pos.hashLo, pos.hashHi])
          pos.makeMove(moves[Math.floor(random() * moves.length)])

          const { hashLo, hashHi } = pos
          pos.recomputeHash()
          expect([pos.hashLo, pos.hashHi]).toEqual([hashLo, hashHi])
        }

        while (trail.length) {
          pos.unmakeMove()
          expect([pos.hashLo, pos.hashHi]).toEqual(trail.pop())
        }
        expect(pos.toFen()).toBe(fen)
      }
    }
  })

  it('gives different hashes to different positions and the same hash to the same one', () => {
    const a = Position.start()
    const b = Position.start()
    expect([a.hashLo, a.hashHi]).toEqual([b.hashLo, b.hashHi])

    b.makeMove(legalMoves(b)[0])
    expect([a.hashLo, a.hashHi]).not.toEqual([b.hashLo, b.hashHi])
  })

  it('reaches the same hash through different move orders (transposition)', () => {
    const find = (pos: Position, from: number, to: number) =>
      legalMoves(pos).find((m) => m.from === from && m.to === to)!
    // Nf3 Nf6 Nc3 Nc6  versus  Nc3 Nc6 Nf3 Nf6
    const a = Position.start()
    const b = Position.start()
    const sq = (name: string) => 'abcdefgh'.indexOf(name[0]) + (8 - Number(name[1])) * 8
    for (const [f, t] of [['g1', 'f3'], ['g8', 'f6'], ['b1', 'c3'], ['b8', 'c6']]) a.makeMove(find(a, sq(f), sq(t)))
    for (const [f, t] of [['b1', 'c3'], ['b8', 'c6'], ['g1', 'f3'], ['g8', 'f6']]) b.makeMove(find(b, sq(f), sq(t)))
    expect([a.hashLo, a.hashHi]).toEqual([b.hashLo, b.hashHi])
  })

  it('restores everything after a null move', () => {
    const pos = Position.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq e3 0 1')
    const before = { fen: pos.toFen(), lo: pos.hashLo, hi: pos.hashHi }
    pos.makeNullMove()
    expect(pos.turn).toBe('w')
    pos.recomputeHash()
    const recomputed = [pos.hashLo, pos.hashHi]
    pos.makeNullMove()
    pos.unmakeMove()
    pos.unmakeMove()
    expect(pos.toFen()).toBe(before.fen)
    expect([pos.hashLo, pos.hashHi]).toEqual([before.lo, before.hi])
    expect(recomputed).not.toEqual([before.lo, before.hi])
  })
})
