import { generatePseudoLegal, legalMoves } from '../core'
import type { Move, Position } from '../core'
import { evaluate, PIECE_VALUES } from './evaluate'
import { MATE } from './score'

const INFINITY = 1_000_000
const MAX_QUIESCENCE_PLY = 10
/** Check extensions stop beyond this ply so a long run of checks can't blow up the tree. */
const MAX_EXTENSION_PLY = 8

export interface Candidate {
  move: Move
  /** Centipawns from white's point of view. */
  score: number
  pv: Move[]
  nodes: number
  elapsedMs: number
}

export interface SearchOptions {
  depth: number
  /** Called after each root move has been searched to completion. */
  onCandidate?: (candidate: Candidate) => void
  now?: () => number
}

export interface SearchResult {
  move: Move | null
  score: number
  pv: Move[]
  nodes: number
  elapsedMs: number
}

/**
 * Fixed-depth alpha-beta search (negamax form) with quiescence search at the
 * leaves and MVV-LVA move ordering.
 *
 * Each root move is searched with a full window on purpose. That costs more
 * than a shared window, but it gives every candidate an exact score, and those
 * scores are what the UI visualizes.
 */
export function search(pos: Position, options: SearchOptions): SearchResult {
  return new Searcher(pos, options).run()
}

class Searcher {
  private nodes = 0
  private readonly pos: Position
  private readonly depth: number
  private readonly onCandidate?: (candidate: Candidate) => void
  private readonly now: () => number
  private readonly startedAt: number

  constructor(pos: Position, options: SearchOptions) {
    this.pos = pos
    this.depth = Math.max(1, options.depth)
    this.onCandidate = options.onCandidate
    this.now = options.now ?? (() => Date.now())
    this.startedAt = this.now()
  }

  run(): SearchResult {
    const { pos } = this
    const sign = pos.turn === 'w' ? 1 : -1
    const moves = orderMoves(legalMoves(pos))

    if (moves.length === 0) {
      const mated = pos.inCheck()
      return { move: null, score: mated ? -sign * MATE : 0, pv: [], nodes: this.nodes, elapsedMs: this.elapsed() }
    }

    let best: Move = moves[0]
    let bestScore = -INFINITY // from the mover's point of view
    let bestPv: Move[] = []

    for (const move of moves) {
      const line: Move[] = []
      pos.makeMove(move)
      const score = -this.negamax(this.depth - 1, -INFINITY, INFINITY, 1, line)
      pos.unmakeMove()

      const pv = [move, ...line]
      this.onCandidate?.({
        move,
        score: sign * score,
        pv,
        nodes: this.nodes,
        elapsedMs: this.elapsed(),
      })

      if (score > bestScore) {
        bestScore = score
        best = move
        bestPv = pv
      }
    }

    return { move: best, score: sign * bestScore, pv: bestPv, nodes: this.nodes, elapsedMs: this.elapsed() }
  }

  private elapsed(): number {
    return this.now() - this.startedAt
  }

  /** Score from the point of view of the side to move. `line` receives the principal variation. */
  private negamax(depth: number, alpha: number, beta: number, ply: number, line: Move[]): number {
    this.nodes++
    const { pos } = this
    if (depth === 0) {
      // Don't stop in the middle of a check: look one ply further so a mate at
      // the horizon is seen as mate instead of an ordinary position.
      if (ply >= MAX_EXTENSION_PLY || !pos.inCheck()) return this.quiescence(alpha, beta, 0)
      depth = 1
    }

    const moves = orderMoves(legalMoves(pos))
    if (moves.length === 0) return pos.inCheck() ? -(MATE - ply) : 0
    if (pos.halfmove >= 100) return 0

    let best = -INFINITY
    for (const move of moves) {
      const childLine: Move[] = []
      pos.makeMove(move)
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, childLine)
      pos.unmakeMove()

      if (score > best) {
        best = score
        line.length = 0
        line.push(move, ...childLine)
      }
      if (score > alpha) alpha = score
      if (alpha >= beta) break
    }
    return best
  }

  /**
   * Keeps searching captures and promotions until the position is quiet, so
   * a half-finished exchange is never scored as if it were over (the horizon effect).
   */
  private quiescence(alpha: number, beta: number, qply: number): number {
    this.nodes++
    const { pos } = this

    const stand = pos.turn === 'w' ? evaluate(pos) : -evaluate(pos)
    if (stand >= beta) return beta
    if (stand > alpha) alpha = stand
    if (qply >= MAX_QUIESCENCE_PLY) return alpha

    const mover = pos.turn
    for (const move of orderMoves(generatePseudoLegal(pos, { noisyOnly: true }))) {
      pos.makeMove(move)
      if (pos.inCheck(mover)) {
        pos.unmakeMove()
        continue
      }
      const score = -this.quiescence(-beta, -alpha, qply + 1)
      pos.unmakeMove()

      if (score >= beta) return beta
      if (score > alpha) alpha = score
    }
    return alpha
  }
}

/**
 * MVV-LVA: look at captures first, most valuable victim first and cheapest
 * attacker first, so alpha-beta can cut the rest of the tree off early.
 */
function orderMoves(moves: Move[]): Move[] {
  const keyed = moves.map((move) => {
    let key = 0
    if (move.captured) key += 10_000 + 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece] / 10
    if (move.promotion) key += 9_000 + PIECE_VALUES[move.promotion]
    return { move, key }
  })
  keyed.sort((a, b) => b.key - a.key)
  return keyed.map((entry) => entry.move)
}

