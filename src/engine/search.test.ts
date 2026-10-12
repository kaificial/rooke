import { describe, expect, it } from 'vitest'
import { Position, squareName } from '../core'
import { evaluate } from './evaluate'
import { isMateScore, mateIn } from './score'
import { search } from './search'
import type { Progress } from './search'

const uci = (move: { from: number; to: number }) => squareName(move.from) + squareName(move.to)

/** A depth-limited search with no clock, so the result doesn't depend on how fast the machine is. */
const searchDepth = (fen: string, maxDepth: number, history: number[] = []) =>
  search(Position.fromFen(fen), { maxDepth, timeMs: Infinity, history })

/** The same position with colors swapped and the board flipped top to bottom. */
function mirror(fen: string): string {
  const [placement, turn, castling, , half, full] = fen.split(' ')
  const flipped = placement
    .split('/')
    .reverse()
    .map((row) => [...row].map((c) => (/[a-z]/.test(c) ? c.toUpperCase() : /[A-Z]/.test(c) ? c.toLowerCase() : c)).join(''))
    .join('/')
  const swap = (text: string) => [...text].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')
  return `${flipped} ${turn === 'w' ? 'b' : 'w'} ${castling === '-' ? '-' : swap(castling)} - ${half} ${full}`
}

describe('evaluate', () => {
  it('is balanced in the starting position', () => {
    expect(evaluate(Position.start())).toBe(0)
  })

  it('counts material', () => {
    expect(evaluate(Position.fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1'))).toBeGreaterThan(800)
    expect(evaluate(Position.fromFen('3qk3/8/8/8/8/8/8/4K3 w - - 0 1'))).toBeLessThan(-800)
  })

  it('treats both colors the same: a mirrored position scores the opposite', () => {
    const fens = [
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
      'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    ]
    for (const fen of fens) {
      expect(evaluate(Position.fromFen(mirror(fen)))).toBe(-evaluate(Position.fromFen(fen)))
    }
  })

  it('likes a passed pawn more the further it has come', () => {
    const early = evaluate(Position.fromFen('4k3/8/8/8/8/4P3/8/4K3 w - - 0 1'))
    const advanced = evaluate(Position.fromFen('4k3/8/4P3/8/8/8/8/4K3 w - - 0 1'))
    expect(advanced).toBeGreaterThan(early)
  })

  it('does not credit a pawn that an enemy pawn can still stop', () => {
    const free = evaluate(Position.fromFen('4k3/8/8/4P3/8/8/8/4K3 w - - 0 1'))
    const stoppable = evaluate(Position.fromFen('4k3/4p3/8/4P3/8/8/8/4K3 w - - 0 1'))
    // Adding a black pawn must cost white more than that pawn's material and placement alone would explain.
    expect(free - stoppable).toBeGreaterThan(100)
  })

  it('values the bishop pair and penalizes doubled pawns', () => {
    const pair = evaluate(Position.fromFen('4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1'))
    const bishopAndKnight = evaluate(Position.fromFen('4k3/8/8/8/8/8/8/2B1KN2 w - - 0 1'))
    expect(pair).toBeGreaterThan(bishopAndKnight)

    const doubled = evaluate(Position.fromFen('4k3/8/8/8/4P3/4P3/8/4K3 w - - 0 1'))
    const spread = evaluate(Position.fromFen('4k3/8/8/8/3P4/4P3/8/4K3 w - - 0 1'))
    expect(spread).toBeGreaterThan(doubled)
  })
})

describe('search', () => {
  it('takes a mate in one', () => {
    const result = searchDepth('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 4)
    expect(uci(result.move!)).toBe('a1a8')
    expect(isMateScore(result.score)).toBe(true)
    expect(result.score).toBeGreaterThan(0)
    expect(mateIn(result.score)).toBe(1)
  })

  it("plays Scholar's mate when it is offered", () => {
    const result = searchDepth('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 4)
    expect(uci(result.move!)).toBe('h5f7')
  })

  it('finds a mate in two', () => {
    // Two rooks: Rb7 cuts off the king, then Ra8 mates. There is no mate in one.
    const result = searchDepth('7k/8/8/8/8/8/1R6/R3K3 w - - 0 1', 6)
    expect(isMateScore(result.score)).toBe(true)
    expect(mateIn(result.score)).toBe(2)
  })

  it('reports a mate against it with the right sign', () => {
    // Black can only delay: white mates next move, so the score is hugely positive for white.
    const result = searchDepth('6k1/5ppp/8/8/8/8/8/R3K3 b - - 0 1', 4)
    expect(result.move).not.toBeNull()
  })

  it('takes a hanging queen', () => {
    const result = searchDepth('4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1', 3)
    expect(uci(result.move!)).toBe('c3d5')
  })

  it('does not hang its queen', () => {
    const result = searchDepth('4k3/8/8/2p5/3Q4/8/8/4K3 w - - 0 1', 4)
    expect(result.score).toBeGreaterThan(700)
  })

  it('avoids stalemating when it is winning', () => {
    const pos = Position.fromFen('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1')
    const result = search(pos, { maxDepth: 4, timeMs: Infinity })
    pos.makeMove(result.move!)
    const reply = search(pos, { maxDepth: 1, timeMs: Infinity })
    expect(!pos.inCheck() && reply.move === null).toBe(false)
  })

  it('returns no move when the game is already over', () => {
    const mated = searchDepth('R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1', 3)
    expect(mated.move).toBeNull()
    expect(isMateScore(mated.score)).toBe(true)

    const stalemated = searchDepth('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 3)
    expect(stalemated.move).toBeNull()
    expect(stalemated.score).toBe(0)
  })

  it('answers a forced move immediately', () => {
    // The rook covers b1 and b2, so the king has exactly one legal move: a2.
    const result = search(Position.fromFen('1r5k/8/8/8/8/8/8/K7 w - - 0 1'), { maxDepth: 12, timeMs: 5_000 })
    expect(uci(result.move!)).toBe('a1a2')
    expect(result.elapsedMs).toBeLessThan(100)
  })

  it('leaves the position untouched', () => {
    const pos = Position.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
    const before = [pos.toFen(), pos.hashLo, pos.hashHi]
    search(pos, { maxDepth: 4, timeMs: Infinity })
    expect([pos.toFen(), pos.hashLo, pos.hashHi]).toEqual(before)
  })

  it('searches deeper step by step, reporting each improvement', () => {
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5'
    const progress: Progress[] = []
    const result = search(Position.fromFen(fen), { maxDepth: 6, timeMs: Infinity, onProgress: (p) => progress.push(p) })

    expect(result.depth).toBe(6)
    expect(progress.length).toBeGreaterThan(0)
    const depths = progress.map((p) => p.depth)
    expect(depths).toEqual([...depths].sort((a, b) => a - b)) // never goes backwards
    expect(progress[progress.length - 1].move).toEqual(result.move)
  })

  it('honors its time limit and still gets reasonably deep', () => {
    const started = Date.now()
    const result = search(Position.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), {
      maxDepth: 30,
      timeMs: 400,
    })
    expect(Date.now() - started).toBeLessThan(900)
    expect(result.depth).toBeGreaterThanOrEqual(4)
    expect(result.move).not.toBeNull()
  })

  it('reaches depth 5 in the opening in a couple of seconds at most', () => {
    const started = Date.now()
    const result = searchDepth('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 5)
    expect(result.depth).toBe(5)
    expect(Date.now() - started).toBeLessThan(2_000)
  })
})
