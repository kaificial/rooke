/// Entry point of the engine Web Worker. Searching happens here so the 3D
/// scene on the main thread never stalls while the engine thinks.

import { Position } from '../core'
import type { BestMoveEvent, SearchEvent, SearchRequest } from './protocol'
import { search } from './search'
import { TranspositionTable } from './transposition'

// The project compiles against the DOM lib, so give `self` the worker shape we use.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SearchRequest>) => void) | null
  postMessage(message: SearchEvent): void
}

// Kept between searches: positions worked out for one move are often still useful on the next.
const table = new TranspositionTable(20)

worker.onmessage = (event) => {
  const { id, fen, maxDepth, timeMs, history } = event.data

  try {
    const position = Position.fromFen(fen)

    const result = search(position, {
      maxDepth,
      timeMs,
      history,
      table,
      onProgress: (progress) =>
        worker.postMessage({
          type: 'thinking',
          id,
          move: progress.move,
          score: progress.score,
          pv: progress.pv,
          depth: progress.depth,
          nodes: progress.nodes,
          elapsedMs: progress.elapsedMs,
        }),
    })

    const done: BestMoveEvent = {
      type: 'bestMove',
      id,
      move: result.move,
      score: result.score,
      pv: result.pv,
      depth: result.depth,
      nodes: result.nodes,
      elapsedMs: result.elapsedMs,
    }
    worker.postMessage(done)
  } catch (error) {
    worker.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) })
  }
}
