import type { Color } from '../../core'
import { fromHtml, query } from '../dom'

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds)
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** The two countdowns at the top of the screen. */
export class Clocks {
  readonly element: HTMLElement
  private readonly values: Record<Color, HTMLElement>

  constructor(initialSeconds: number) {
    this.element = fromHtml(`
      <div id="top-timer-display">
        <div class="timer-container">
          <div class="timer-side">
            <div class="timer-label">WHITE</div>
            <div class="timer-value" data-color="w"></div>
          </div>
          <div class="timer-divider">:</div>
          <div class="timer-side">
            <div class="timer-label">BLACK</div>
            <div class="timer-value" data-color="b"></div>
          </div>
        </div>
      </div>
    `)
    this.values = {
      w: query(this.element, '[data-color="w"]'),
      b: query(this.element, '[data-color="b"]'),
    }
    this.setTime('w', initialSeconds)
    this.setTime('b', initialSeconds)
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.element)
  }

  setTime(color: Color, seconds: number): void {
    this.values[color].textContent = formatClock(seconds)
  }

  /** Highlights the clock that is running. Pass null when neither is. */
  setActive(color: Color | null): void {
    this.values.w.classList.toggle('active', color === 'w')
    this.values.b.classList.toggle('active', color === 'b')
  }
}
