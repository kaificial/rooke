import { generatePseudoLegal } from '../core'
import type { Move, Position } from '../core'
import { evaluate, PIECE_VALUES } from './evaluate'
import { MATE, MATE_THRESHOLD } from './score'
import { BOUND_EXACT, BOUND_LOWER, BOUND_UPPER, TranspositionTable, moveKey } from './transposition'

const INFINITY = 1_000_000
const MAX_PLY = 64
const MAX_QUIESCENCE_DEPTH = 8

// Search tuning. These are the usual textbook values; none are precious.
const ASPIRATION_WINDOW = 30
const NULL_MOVE_MIN_DEPTH = 3
const REVERSE_FUTILITY_MARGIN = 120 // per ply of remaining depth
const FUTILITY_MARGIN = 150 // per ply of remaining depth
const LMR_MIN_DEPTH = 3
const LMR_AFTER_MOVES = 3
const TEMPO_BONUS = 10

// Move ordering scores. Higher is searched first.
const ORDER_TABLE_MOVE = 10_000_000
const ORDER_PROMOTION = 1_500_000
const ORDER_CAPTURE = 1_000_000
const ORDER_KILLER_1 = 900_000
const ORDER_KILLER_2 = 800_000

export interface Progress {
  /** The best move found so far at this depth. */
  move: Move
  /** Centipawns from white's point of view. */
  score: number
  pv: Move[]
  depth: number
  nodes: number
  elapsedMs: number
}

export interface SearchOptions {
  /** Never search deeper than this many plies. */
  maxDepth: number
  /** Stop thinking after about this long. `Infinity` for a pure depth-limited search. */
  timeMs: number
  /**
   * Hashes of every earlier position in the game (not including the current
   * one), as flat [lo, hi, lo, hi, ...] pairs, so the engine can see repetitions.
   */
  history?: readonly number[]
  /** Called whenever the engine finds a new best move at some depth. */
  onProgress?: (progress: Progress) => void
  table?: TranspositionTable
  now?: () => number
}

export interface SearchResult {
  move: Move | null
  /** Centipawns from white's point of view. Forced mates are beyond MATE_THRESHOLD. */
  score: number
  pv: Move[]
  /** The deepest iteration that produced the chosen move. */
  depth: number
  nodes: number
  elapsedMs: number
}

/**
 * Iterative-deepening alpha-beta search.
 *
 * It searches one ply deep, then two, then three and so on until it runs out
 * of time or depth. Each pass is cheap compared to the next, and the best move
 * and the transposition table from one pass make the next far more efficient,
 * so a time limit can be honored without ever being left with no answer.
 *
 * On top of plain alpha-beta it uses:
 *  - a transposition table (a position reached by two move orders is searched once),
 *  - principal variation search (only the first move gets a full window),
 *  - null-move pruning, reverse futility and futility pruning,
 *  - late move reductions (later quiet moves are searched shallower first),
 *  - killer and history move ordering, plus MVV-LVA for captures,
 *  - aspiration windows at the root,
 *  - check extensions, quiescence search and repetition detection.
 */
export function search(pos: Position, options: SearchOptions): SearchResult {
  return new Searcher(pos, options).run()
}

class Searcher {
  private readonly pos: Position
  private readonly options: SearchOptions
  private readonly table: TranspositionTable
  private readonly now: () => number
  private readonly startedAt: number
  private readonly deadline: number

  private nodes = 0
  private stopped = false

  private readonly killers = new Int32Array(MAX_PLY * 2)
  private readonly historyScores = new Int32Array(2 * 64 * 64)
  private readonly lines: Move[][] = Array.from({ length: MAX_PLY + 2 }, () => [])

  // Hashes of positions before the current one: the game so far, then the search path.
  private readonly seenLo: number[] = []
  private readonly seenHi: number[] = []

  private rootMoves: Move[] = []
  private best: { move: Move; score: number; pv: Move[]; depth: number } | null = null

  constructor(pos: Position, options: SearchOptions) {
    this.pos = pos
    this.options = options
    this.table = options.table ?? new TranspositionTable(18)
    this.now = options.now ?? (() => Date.now())
    this.startedAt = this.now()
    this.deadline = this.startedAt + options.timeMs

    const history = options.history ?? []
    for (let i = 0; i + 1 < history.length; i += 2) {
      this.seenLo.push(history[i])
      this.seenHi.push(history[i + 1])
    }
  }

  run(): SearchResult {
    const { pos } = this
    const sign = pos.turn === 'w' ? 1 : -1

    this.rootMoves = this.legalRootMoves()
    if (this.rootMoves.length === 0) {
      const score = pos.inCheck() ? -MATE : 0
      return { move: null, score: sign * score || 0, pv: [], depth: 0, nodes: 0, elapsedMs: this.elapsed() }
    }

    // A forced move needs no thought. Still report it so the screen has something to show.
    if (this.rootMoves.length === 1) {
      const only = this.rootMoves[0]
      pos.makeMove(only)
      const score = -this.quiescence(-INFINITY, INFINITY, 1, 0)
      pos.unmakeMove()
      this.report(only, score, [only], 1)
      return { move: only, score: sign * score, pv: [only], depth: 1, nodes: this.nodes, elapsedMs: this.elapsed() }
    }

    let previousScore = 0
    for (let depth = 1; depth <= Math.min(this.options.maxDepth, MAX_PLY - 1); depth++) {
      const score = this.searchWithAspiration(depth, previousScore)
      if (this.stopped) break
      previousScore = score

      if (Math.abs(score) >= MATE_THRESHOLD && depth >= 4) break // a forced mate is found; more depth adds nothing
      // The next pass takes roughly twice as long. Don't begin one we can't finish.
      if (this.elapsed() > this.options.timeMs * 0.45) break
    }

    const best = this.best ?? { move: this.rootMoves[0], score: 0, pv: [this.rootMoves[0]], depth: 0 }
    return {
      move: best.move,
      score: sign * best.score,
      pv: best.pv,
      depth: best.depth,
      nodes: this.nodes,
      elapsedMs: this.elapsed(),
    }
  }

  private elapsed(): number {
    return this.now() - this.startedAt
  }

  private checkTime(): void {
    if (this.now() >= this.deadline) this.stopped = true
  }

  private legalRootMoves(): Move[] {
    const { pos } = this
    const color = pos.turn
    const legal: Move[] = []
    for (const move of generatePseudoLegal(pos)) {
      pos.makeMove(move)
      if (!pos.inCheck(color)) legal.push(move)
      pos.unmakeMove()
    }
    return legal
  }

  /** Searches with a narrow window around the last score and widens it if the result falls outside. */
  private searchWithAspiration(depth: number, previousScore: number): number {
    if (depth < 4 || Math.abs(previousScore) >= MATE_THRESHOLD) {
      return this.searchRoot(depth, -INFINITY, INFINITY)
    }

    let window = ASPIRATION_WINDOW
    let alpha = previousScore - window
    let beta = previousScore + window
    for (;;) {
      const score = this.searchRoot(depth, alpha, beta)
      if (this.stopped) return score
      if (score <= alpha) alpha = Math.max(-INFINITY, score - window)
      else if (score >= beta) beta = Math.min(INFINITY, score + window)
      else return score
      window *= 2
    }
  }

  private searchRoot(depth: number, alphaStart: number, beta: number): number {
    const { pos } = this
    let alpha = alphaStart
    let bestScore = -INFINITY
    let bestIndex = 0
    const scores = new Array<number>(this.rootMoves.length).fill(-INFINITY)

    for (let i = 0; i < this.rootMoves.length; i++) {
      const move = this.rootMoves[i]
      this.seenLo.push(pos.hashLo)
      this.seenHi.push(pos.hashHi)
      pos.makeMove(move)

      let score: number
      if (i === 0) {
        score = -this.negamax(depth - 1, -beta, -alpha, 1, true)
      } else {
        score = -this.negamax(depth - 1, -alpha - 1, -alpha, 1, true)
        if (score > alpha && score < beta && !this.stopped) score = -this.negamax(depth - 1, -beta, -alpha, 1, true)
      }

      pos.unmakeMove()
      this.seenLo.pop()
      this.seenHi.pop()
      if (this.stopped) return bestScore

      scores[i] = score
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
        if (score > alpha) {
          alpha = score
          const pv = [move, ...this.lines[1]]
          this.best = { move, score, pv, depth }
          if (score < beta) this.report(move, score, pv, depth)
        }
        if (alpha >= beta) break
      }
    }

    // Try the best move first next time, then the rest by how they scored.
    const order = this.rootMoves.map((move, i) => ({ move, score: i === bestIndex ? INFINITY : scores[i] }))
    order.sort((a, b) => b.score - a.score)
    this.rootMoves = order.map((entry) => entry.move)
    return bestScore
  }

  private report(move: Move, score: number, pv: Move[], depth: number): void {
    const sign = this.pos.turn === 'w' ? 1 : -1
    this.options.onProgress?.({ move, score: sign * score, pv, depth, nodes: this.nodes, elapsedMs: this.elapsed() })
  }

  /** Static evaluation from the point of view of the side to move. */
  private evaluateForMover(): number {
    const score = evaluate(this.pos)
    return (this.pos.turn === 'w' ? score : -score) + TEMPO_BONUS
  }

  private isRepetition(): boolean {
    const { pos } = this
    const count = this.seenLo.length
    // Only positions since the last capture or pawn move can match, and only every second one (same side to move).
    for (let i = count - 2; i >= 0 && i >= count - pos.halfmove; i -= 2) {
      if (this.seenLo[i] === pos.hashLo && this.seenHi[i] === pos.hashHi) return true
    }
    return false
  }

  private hasNonPawnMaterial(color: 'w' | 'b'): boolean {
    for (let sq = 0; sq < 64; sq++) {
      const piece = this.pos.board[sq]
      if (piece && piece.color === color && piece.type !== 'p' && piece.type !== 'k') return true
    }
    return false
  }

  private negamax(depth: number, alphaIn: number, betaIn: number, ply: number, allowNull: boolean): number {
    const { pos, table } = this
    let alpha = alphaIn
    let beta = betaIn
    this.lines[ply].length = 0

    if ((++this.nodes & 2047) === 0) this.checkTime()
    if (this.stopped) return 0

    if (pos.halfmove >= 100 || this.isRepetition()) return 0
    if (ply >= MAX_PLY - 1) return this.evaluateForMover()

    // If a mate is already known, a slower mate or a later loss is no use here.
    alpha = Math.max(alpha, -MATE + ply)
    beta = Math.min(beta, MATE - ply - 1)
    if (alpha >= beta) return alpha

    const inCheck = pos.inCheck()
    if (inCheck) depth++ // never stop in the middle of a check
    if (depth <= 0) return this.quiescence(alpha, beta, ply, 0)

    const pvNode = beta - alpha > 1
    const color = pos.turn

    let tableMove = 0
    const hit = table.probe(pos.hashLo, pos.hashHi)
    if (hit >= 0) {
      tableMove = table.move[hit]
      if (!pvNode && table.depth[hit] >= depth) {
        const stored = fromTable(table.score[hit], ply)
        const bound = table.bound[hit]
        if (bound === BOUND_EXACT) return stored
        if (bound === BOUND_LOWER && stored >= beta) return stored
        if (bound === BOUND_UPPER && stored <= alpha) return stored
      }
    }

    const staticEval = inCheck ? 0 : this.evaluateForMover()

    if (!pvNode && !inCheck) {
      // Reverse futility: far enough ahead already that a shallow search won't change anything.
      if (depth <= 3 && staticEval - REVERSE_FUTILITY_MARGIN * depth >= beta) return staticEval

      // Null move: if passing still leaves us above beta, a real move surely would too.
      if (allowNull && depth >= NULL_MOVE_MIN_DEPTH && staticEval >= beta && this.hasNonPawnMaterial(color)) {
        const reduction = 2 + (depth >= 6 ? 1 : 0)
        this.seenLo.push(pos.hashLo)
        this.seenHi.push(pos.hashHi)
        pos.makeNullMove()
        const score = -this.negamax(depth - 1 - reduction, -beta, -beta + 1, ply + 1, false)
        pos.unmakeMove()
        this.seenLo.pop()
        this.seenHi.pop()
        if (this.stopped) return 0
        if (score >= beta) return score >= MATE_THRESHOLD ? beta : score
      }
    }

    const moves = generatePseudoLegal(pos)
    const order = this.scoreMoves(moves, tableMove, ply, color)
    const futile = !pvNode && !inCheck && depth <= 2 && staticEval + FUTILITY_MARGIN * depth <= alpha

    let best = -INFINITY
    let bestMove: Move | null = null
    let legalCount = 0

    for (let i = 0; i < moves.length; i++) {
      const move = pickBest(moves, order, i)

      this.seenLo.push(pos.hashLo)
      this.seenHi.push(pos.hashHi)
      pos.makeMove(move)
      if (pos.inCheck(color)) {
        pos.unmakeMove()
        this.seenLo.pop()
        this.seenHi.pop()
        continue
      }
      legalCount++

      const quiet = !move.captured && !move.promotion
      if (futile && quiet && legalCount > 1 && !pos.inCheck()) {
        pos.unmakeMove()
        this.seenLo.pop()
        this.seenHi.pop()
        continue
      }

      let score: number
      if (legalCount === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true)
      } else {
        // Later quiet moves are unlikely to matter, so look at them a little shallower first.
        let reduction = 0
        if (depth >= LMR_MIN_DEPTH && legalCount > LMR_AFTER_MOVES && quiet && !inCheck) {
          reduction = legalCount > 8 ? 2 : 1
          if (pvNode) reduction--
        }
        score = -this.negamax(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true)
        if (score > alpha && reduction > 0) score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true)
        if (score > alpha && score < beta) score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true)
      }

      pos.unmakeMove()
      this.seenLo.pop()
      this.seenHi.pop()
      if (this.stopped) return 0

      if (score > best) {
        best = score
        bestMove = move
        if (score > alpha) {
          alpha = score
          const line = this.lines[ply]
          line.length = 0
          line.push(move, ...this.lines[ply + 1])

          if (alpha >= beta) {
            if (quiet) this.rememberQuiet(move, depth, ply, color)
            break
          }
        }
      }
    }

    if (legalCount === 0) return inCheck ? -(MATE - ply) : 0

    const bound = best >= beta ? BOUND_LOWER : best > alphaIn ? BOUND_EXACT : BOUND_UPPER
    table.store(pos.hashLo, pos.hashHi, depth, toTable(best, ply), bound, bestMove ? moveKey(bestMove) : 0)
    return best
  }

  /** Searches only captures and promotions, so a trade that is half over isn't scored as if it were done. */
  private quiescence(alphaIn: number, beta: number, ply: number, qdepth: number): number {
    const { pos } = this
    let alpha = alphaIn

    if ((++this.nodes & 2047) === 0) this.checkTime()
    if (this.stopped) return 0
    if (ply >= MAX_PLY - 1) return this.evaluateForMover()

    const inCheck = pos.inCheck()
    let best = -INFINITY
    let stand = 0
    if (!inCheck) {
      stand = this.evaluateForMover()
      if (stand >= beta) return stand
      if (stand > alpha) alpha = stand
      best = stand
      if (qdepth >= MAX_QUIESCENCE_DEPTH) return stand
    }

    const color = pos.turn
    const moves = inCheck ? generatePseudoLegal(pos) : generatePseudoLegal(pos, { noisyOnly: true })
    const order = this.scoreMoves(moves, 0, ply, color, true)
    let legalCount = 0

    for (let i = 0; i < moves.length; i++) {
      const move = pickBest(moves, order, i)

      // Delta pruning: even winning this piece outright can't lift us back to alpha.
      if (!inCheck && !move.promotion && move.captured && stand + PIECE_VALUES[move.captured] + 200 < alpha) continue

      pos.makeMove(move)
      if (pos.inCheck(color)) {
        pos.unmakeMove()
        continue
      }
      legalCount++
      const score = -this.quiescence(-beta, -alpha, ply + 1, qdepth + 1)
      pos.unmakeMove()
      if (this.stopped) return 0

      if (score > best) {
        best = score
        if (score > alpha) {
          alpha = score
          if (alpha >= beta) break
        }
      }
    }

    if (inCheck && legalCount === 0) return -(MATE - ply)
    return best
  }

  /** Orders moves: the table move, then promotions and captures (best trades first), then killers, then by history. */
  private scoreMoves(moves: Move[], tableMove: number, ply: number, color: 'w' | 'b', noisyOnly = false): number[] {
    const killer1 = this.killers[ply * 2]
    const killer2 = this.killers[ply * 2 + 1]
    const side = color === 'w' ? 0 : 1

    return moves.map((move) => {
      const key = moveKey(move)
      if (key === tableMove) return ORDER_TABLE_MOVE
      if (move.promotion) return ORDER_PROMOTION + PIECE_VALUES[move.promotion]
      if (move.captured) return ORDER_CAPTURE + PIECE_VALUES[move.captured] * 10 - PIECE_VALUES[move.piece] / 10
      if (noisyOnly) return 0
      if (key === killer1) return ORDER_KILLER_1
      if (key === killer2) return ORDER_KILLER_2
      return this.historyScores[(side * 64 + move.from) * 64 + move.to]
    })
  }

  /** A quiet move that caused a cutoff is probably good in sibling positions too. */
  private rememberQuiet(move: Move, depth: number, ply: number, color: 'w' | 'b'): void {
    const key = moveKey(move)
    if (this.killers[ply * 2] !== key) {
      this.killers[ply * 2 + 1] = this.killers[ply * 2]
      this.killers[ply * 2] = key
    }
    const index = ((color === 'w' ? 0 : 1) * 64 + move.from) * 64 + move.to
    this.historyScores[index] = Math.min(this.historyScores[index] + depth * depth, 500_000)
  }
}

/** Selection-sort step: swaps the best remaining move into position `from` and returns it. */
function pickBest(moves: Move[], scores: number[], from: number): Move {
  let best = from
  for (let i = from + 1; i < moves.length; i++) if (scores[i] > scores[best]) best = i
  if (best !== from) {
    ;[moves[from], moves[best]] = [moves[best], moves[from]]
    ;[scores[from], scores[best]] = [scores[best], scores[from]]
  }
  return moves[from]
}

// Mate scores are relative to the node that found them ("mate in 3 from here"), but a table
// entry may be reused at a different depth in the tree, so it is stored relative to the root.
function toTable(score: number, ply: number): number {
  if (score >= MATE_THRESHOLD) return score + ply
  if (score <= -MATE_THRESHOLD) return score - ply
  return score
}

function fromTable(score: number, ply: number): number {
  if (score >= MATE_THRESHOLD) return score - ply
  if (score <= -MATE_THRESHOLD) return score + ply
  return score
}
