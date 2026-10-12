import type { Move } from '../core'

/**
 * Messages between the main thread and the engine worker. Scores are in
 * centipawns from white's point of view: positive means white is ahead.
 */

export interface SearchRequest {
  /** Echoed back on every event so stale results can be ignored. */
  id: number
  fen: string
  /** The deepest the engine may search, in plies. */
  maxDepth: number
  /** About how long it may think. It stops earlier when it has seen enough. */
  timeMs: number
  /** Hashes of earlier positions in the game as flat [lo, hi, ...] pairs, so it can see repetitions. */
  history: number[]
}

export interface ThinkingEvent {
  type: 'thinking'
  id: number
  /** The best move the engine has found so far. It can change as the search gets deeper. */
  move: Move
  score: number
  /** The line the engine expects to follow from `move`. */
  pv: Move[]
  /** How many plies deep the engine had searched when it found this. */
  depth: number
  nodes: number
  elapsedMs: number
}

export interface BestMoveEvent {
  type: 'bestMove'
  id: number
  /** `null` when the side to move has no legal move. */
  move: Move | null
  score: number
  pv: Move[]
  depth: number
  nodes: number
  elapsedMs: number
}

export interface ErrorEvent {
  type: 'error'
  id: number
  message: string
}

export type SearchEvent = ThinkingEvent | BestMoveEvent | ErrorEvent
