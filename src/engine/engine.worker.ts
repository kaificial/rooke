/// Entry point of the engine Web Worker. Searching happens here so the 3D
/// scene on the main thread never stalls while the engine thinks.

import { Position } from '../core'
import type { BestMoveEvent, SearchEvent, SearchRequest } from './protocol'
import { search } from './search'

// The project compiles against the DOM lib, so give `self` the worker shape we use.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SearchRequest>) => void) | null
  postMessage(message: SearchEvent): void
}

worker.onmessage = (event) => {
  const { id, fen, depth } = event.data

  try {
    const position = Position.fromFen(fen)

    const result = search(position, {
      depth,
      onCandidate: (candidate) =>
        worker.postMessage({
          type: 'thinking',
          id,
          move: candidate.move,
          score: candidate.score,
          pv: candidate.pv,
          depth,
          nodes: candidate.nodes,
          elapsedMs: candidate.elapsedMs,
        }),
    })

    const done: BestMoveEvent = {
      type: 'bestMove',
      id,
      move: result.move,
      score: result.score,
      pv: result.pv,
      depth,
      nodes: result.nodes,
      elapsedMs: result.elapsedMs,
    }
    worker.postMessage(done)
  } catch (error) {
    worker.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) })
  }
}
