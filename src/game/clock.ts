import type { Color } from '../core'

interface ClockEvents {
  onTick(color: Color, remainingSeconds: number): void
  onFlag(color: Color): void
}

/**
 * A two-player chess clock that counts down whole seconds for whoever is on
 * the move. It only keeps time; the game decides what a flag fall means.
 */
export class ChessClock {
  private readonly remaining: Record<Color, number>
  private readonly events: ClockEvents
  private active: Color | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(seconds: number, events: ClockEvents) {
    this.remaining = { w: seconds, b: seconds }
    this.events = events
  }

  secondsLeft(color: Color): number {
    return this.remaining[color]
  }

  get running(): boolean {
    return this.timer !== null
  }

  /** Starts counting down for `color`. */
  start(color: Color): void {
    this.active = color
    if (this.timer === null) this.timer = setInterval(() => this.tick(), 1000)
  }

  /** Hands the clock to the other player without resetting the tick phase. */
  switchTo(color: Color): void {
    if (this.timer !== null) this.active = color
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    this.active = null
  }

  private tick(): void {
    if (!this.active) return
    const color = this.active
    this.remaining[color] = Math.max(0, this.remaining[color] - 1)
    this.events.onTick(color, this.remaining[color])
    if (this.remaining[color] === 0) {
      this.stop()
      this.events.onFlag(color)
    }
  }
}
