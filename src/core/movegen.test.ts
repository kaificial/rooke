import { describe, expect, it } from 'vitest'
import { perft } from './movegen'
import { Position } from './position'

// Reference node counts from https://www.chessprogramming.org/Perft_Results.
// If any of these drift, the move generator has a bug: castling, en passant,
// promotion and pins are all exercised by these positions.
const CASES: { name: string; fen: string; counts: number[] }[] = [
  {
    name: 'starting position',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    counts: [20, 400, 8902, 197281],
  },
  {
    name: 'kiwipete (castling, pins, en passant everywhere)',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    counts: [48, 2039, 97862],
  },
  {
    name: 'position 3 (en passant discovered checks)',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts: [14, 191, 2812, 43238],
  },
  {
    name: 'position 4 (promotions and castling into check)',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9467],
  },
  {
    name: 'position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts: [44, 1486, 62379],
  },
]

describe('perft', () => {
  for (const { name, fen, counts } of CASES) {
    it(name, () => {
      const pos = Position.fromFen(fen)
      counts.forEach((expected, i) => {
        expect(perft(pos, i + 1), `depth ${i + 1}`).toBe(expected)
      })
      // Making and unmaking must leave the position exactly as it was.
      expect(pos.toFen()).toBe(fen)
    })
  }
})
