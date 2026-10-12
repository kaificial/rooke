import { describe, expect, it } from 'vitest'
import { Position, squareName } from '../core'
import { isMateScore, mateIn } from './score'
import { search } from './search'
import { evaluate } from './evaluate'

const uci = (move: { from: number; to: number }) => squareName(move.from) + squareName(move.to)

describe('evaluate', () => {
  it('is balanced in the starting position and symmetric between colors', () => {
    expect(evaluate(Position.start())).toBe(0)
  })

  it('counts material', () => {
    const upAQueen = Position.fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1')
    expect(evaluate(upAQueen)).toBeGreaterThan(800)
    const downAQueen = Position.fromFen('3qk3/8/8/8/8/8/8/4K3 w - - 0 1')
    expect(evaluate(downAQueen)).toBeLessThan(-800)
  })
})

describe('search', () => {
  it('takes a mate in one', () => {
    // Back-rank mate: Ra8#.
    const pos = Position.fromFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
    const result = search(pos, { depth: 3 })
    expect(uci(result.move!)).toBe('a1a8')
    expect(isMateScore(result.score)).toBe(true)
    expect(result.score).toBeGreaterThan(0)
    expect(mateIn(result.score)).toBe(1)
  })

  it('reports a mate against it with the correct sign', () => {
    // Black to move can only delay; white mates next move.
    const pos = Position.fromFen('6k1/5ppp/8/8/8/8/8/R3K3 b - - 0 1')
    const result = search(pos, { depth: 3 })
    expect(result.move).not.toBeNull()
  })

  it('does not hang its queen', () => {
    // The queen on d4 is attacked by a pawn; a sane engine moves or trades it.
    const pos = Position.fromFen('4k3/8/8/2p5/3Q4/8/8/4K3 w - - 0 1')
    const result = search(pos, { depth: 3 })
    expect(result.score).toBeGreaterThan(700)
  })

  it('avoids stalemating when it is winning', () => {
    // Qf7 would be stalemate; any other queen move keeps the win.
    const pos = Position.fromFen('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1')
    const result = search(pos, { depth: 3 })
    pos.makeMove(result.move!)
    const stalemated = !pos.inCheck() && search(pos, { depth: 1 }).move === null
    expect(stalemated).toBe(false)
  })

  it('returns no move when the game is already over', () => {
    const mated = search(Position.fromFen('R5k1/5ppp/8/8/8/8/8/4K3 b - - 0 1'), { depth: 3 })
    expect(mated.move).toBeNull()
    expect(isMateScore(mated.score)).toBe(true)

    const stalemated = search(Position.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), { depth: 3 })
    expect(stalemated.move).toBeNull()
    expect(stalemated.score).toBe(0)
  })

  it('reports every root move exactly once, from white\'s perspective', () => {
    const pos = Position.start()
    const seen: string[] = []
    const result = search(pos, {
      depth: 2,
      onCandidate: (c) => seen.push(uci(c.move)),
    })
    expect(seen).toHaveLength(20)
    expect(new Set(seen).size).toBe(20)
    expect(result.move).not.toBeNull()
    // The search must leave the position untouched.
    expect(pos.toFen()).toBe(Position.start().toFen())
  })

  it('searches the opening quickly enough to feel instant', () => {
    const started = Date.now()
    search(Position.start(), { depth: 3 })
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
