import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChessClock } from './clock'

describe('ChessClock', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('counts down only the side to move', () => {
    const ticks: string[] = []
    const clock = new ChessClock(10, { onTick: (c, s) => ticks.push(`${c}${s}`), onFlag: () => {} })
    clock.start('w')
    vi.advanceTimersByTime(2000)
    clock.switchTo('b')
    vi.advanceTimersByTime(1000)
    expect(ticks).toEqual(['w9', 'w8', 'b9'])
    expect(clock.secondsLeft('w')).toBe(8)
    expect(clock.secondsLeft('b')).toBe(9)
  })

  it('flags a player who runs out of time and stops', () => {
    const flagged: string[] = []
    const clock = new ChessClock(2, { onTick: () => {}, onFlag: (c) => flagged.push(c) })
    clock.start('b')
    vi.advanceTimersByTime(10_000)
    expect(flagged).toEqual(['b'])
    expect(clock.running).toBe(false)
  })

  it('stops ticking when stopped', () => {
    const onTick = vi.fn()
    const clock = new ChessClock(10, { onTick, onFlag: () => {} })
    clock.start('w')
    clock.stop()
    vi.advanceTimersByTime(5000)
    expect(onTick).not.toHaveBeenCalled()
  })
})
