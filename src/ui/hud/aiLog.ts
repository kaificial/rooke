import type { Sentiment } from '../../ai/narrator'
import { fromHtml } from '../dom'

const MAX_ENTRIES = 100

/** Scrolling commentary on what the engine is considering. */
export class AiLog {
  readonly element: HTMLElement
  private enabled = true
  private hasEntries = false

  constructor() {
    this.element = fromHtml(`
      <div id="ai-log">
        <div class="log-header">
          AI Thought Process
          <div class="log-subtitle">(+ White ahead | - Black ahead)</div>
        </div>
      </div>
    `)
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.element)
  }

  add(text: string, sentiment: Sentiment = 'info'): void {
    const entry = document.createElement('div')
    entry.className = 'log-entry'
    const span = document.createElement('span')
    span.className = `log-${sentiment}`
    span.textContent = text
    entry.appendChild(span)
    this.element.appendChild(entry)
    this.element.scrollTop = this.element.scrollHeight

    // Keep the header (first child) and trim the oldest entries.
    while (this.element.children.length > MAX_ENTRIES + 1) this.element.children[1].remove()

    this.hasEntries = true
    this.render()
  }

  /** Whether the log may be shown at all. It still stays hidden until there is something in it. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.render()
  }

  private render(): void {
    this.element.style.display = this.enabled && this.hasEntries ? 'block' : 'none'
  }
}
