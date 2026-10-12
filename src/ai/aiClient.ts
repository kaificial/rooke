import type { SearchEvent, SearchRequest } from '../engine/protocol'

type Listener = (event: SearchEvent) => void

/** Typed wrapper around the engine worker. */
export class AiClient {
  private readonly worker: Worker
  private readonly listeners = new Map<number, Listener>()

  constructor() {
    this.worker = new Worker(new URL('../engine/engine.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (message: MessageEvent<SearchEvent>) => {
      this.listeners.get(message.data.id)?.(message.data)
    }
  }

  /** Starts a search. Events for this request go to `listener` until `forget` is called. */
  search(request: SearchRequest, listener: Listener): void {
    this.listeners.set(request.id, listener)
    this.worker.postMessage(request)
  }

  forget(id: number): void {
    this.listeners.delete(id)
  }

  dispose(): void {
    this.worker.terminate()
    this.listeners.clear()
  }
}
