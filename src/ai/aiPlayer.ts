import { CONFIG } from '../config'
import type { Color, Move, Position } from '../core'
import type { BestMoveEvent, SearchEvent, ThinkingEvent } from '../engine/protocol'
import type { AiClient } from './aiClient'
import { narrate } from './narrator'
import type { Sentiment } from './narrator'
import type { AiVisualizer } from './visualizer'

interface ThoughtLog {
  add(text: string, sentiment: Sentiment): void
}

export class AiCancelled extends Error {
  constructor() {
    super('The engine search was cancelled')
    this.name = 'AiCancelled'
  }
}

interface Dependencies {
  client: AiClient
  visualizer: AiVisualizer
  log: ThoughtLog
  color: Color
  maxDepth: number
  thinkTimeMs: number
  /** Asked each time, since the player can toggle the thought display mid-game. */
  thoughtsVisible: () => boolean
}

/**
 * Plays one side. For each turn it asks the worker for a move and shows the
 * search to the player as it goes: the engine's best move so far at each depth,
 * with an arrow, a ghost line and a log entry, so the decision is something
 * you can follow.
 *
 * The replay is kept short on purpose. Thoughts for the same depth collapse
 * into the latest one, only the newest few are kept, and they play while the
 * engine is still searching, so watching never makes it slower to move.
 */
export class AiPlayer {
  private readonly deps: Dependencies
  private requestId = 0
  private abort: (() => void) | null = null

  constructor(deps: Dependencies) {
    this.deps = deps
  }

  get color(): Color {
    return this.deps.color
  }

  /**
   * Resolves with the chosen move (null when there is none) once its thinking has been shown.
   * `history` is `Game.previousPositionHashes()`, so the engine can see repetitions.
   */
  chooseMove(position: Position, history: number[]): Promise<Move | null> {
    this.cancel()
    const { client, maxDepth, thinkTimeMs } = this.deps
    const id = ++this.requestId
    const mover = position.turn

    return new Promise<Move | null>((resolve, reject) => {
      const queue: (ThinkingEvent | BestMoveEvent)[] = []
      let playbackTimer: number | undefined
      let finishTimer: number | undefined

      const stop = () => {
        window.clearTimeout(playbackTimer)
        window.clearTimeout(finishTimer)
        playbackTimer = finishTimer = undefined
        client.forget(id)
        this.abort = null
      }
      const finish = (move: Move | null) => {
        stop()
        this.deps.visualizer.clear()
        resolve(move)
      }
      this.abort = () => {
        stop()
        reject(new AiCancelled())
      }

      const decideSoon = (event: BestMoveEvent, delayMs: number) => {
        window.clearTimeout(finishTimer)
        finishTimer = window.setTimeout(() => finish(event.move), delayMs)
      }

      // Shows one event, then schedules the next after a beat.
      const playNext = () => {
        playbackTimer = undefined
        const event = queue.shift()
        if (!event) return

        if (!this.deps.thoughtsVisible()) {
          if (event.type === 'bestMove') decideSoon(event, CONFIG.ai.quietMoveDelayMs)
          else playNext()
          return
        }

        this.present(event, mover)
        if (event.type === 'bestMove') {
          decideSoon(event, CONFIG.ai.decisionPauseMs)
        } else {
          playbackTimer = window.setTimeout(playNext, CONFIG.ai.playbackIntervalMs)
        }
      }

      client.search({ id, fen: position.toFen(), maxDepth, timeMs: thinkTimeMs, history }, (event: SearchEvent) => {
        if (event.type === 'error') {
          stop()
          reject(new Error(event.message))
          return
        }

        if (event.type === 'thinking') {
          // A newer idea at the same depth replaces the one that hasn't been shown yet.
          const last = queue[queue.length - 1]
          if (last?.type === 'thinking' && last.depth === event.depth) queue[queue.length - 1] = event
          else queue.push(event)
          // Only the newest few are worth the screen time.
          if (queue.length > CONFIG.ai.maxReplayLines) queue.splice(0, queue.length - CONFIG.ai.maxReplayLines)
        } else {
          queue.push(event)
        }
        if (playbackTimer === undefined && finishTimer === undefined) playNext()
      })
    })
  }

  /** Abandons the current search, if any. The pending `chooseMove` rejects with `AiCancelled`. */
  cancel(): void {
    this.abort?.()
  }

  private present(event: ThinkingEvent | BestMoveEvent, mover: Color): void {
    if (!event.move) return
    const { visualizer, log, color } = this.deps
    const final = event.type === 'bestMove'

    if (final) visualizer.showDecision(event.move, event.pv)
    else visualizer.showCandidate(event.move, event.pv)

    const { text, sentiment } = narrate(event.move, event.score, { mover, aiColor: color, final, depth: event.depth })
    log.add(text, sentiment)
  }
}
