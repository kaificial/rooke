import type { Move } from '../core'

/**
 * Messages between the main thread and the engine worker. Scores are in
 * centipawns from white's point of view: positive means white is ahead.
 */

export interface SearchRequest {
  /** Echoed back on every event so stale results can be ignored. */
  id: number
  fen: string
  depth: number
}

export interface ThinkingEvent {
  type: 'thinking'
  id: number
  /** The root move that was just searched. */
  move: Move
  score: number
  /** The line the engine expects to follow from `move`. */
  pv: Move[]
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
