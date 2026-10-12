import type { Color } from './core'

/** Tunables and constants in one place, so magic numbers don't hide in the code. */
export const CONFIG = {
  clock: {
    /** Per-player time, in seconds. */
    seconds: 600,
  },
  ai: {
    /** The engine always plays this side; the human plays the other. */
    color: 'b' as Color,
    /** Search depth in plies. */
    depth: 3,
    /** How long each candidate move stays on screen while the engine "thinks". */
    playbackIntervalMs: 800,
    /** If the engine gets further ahead than this many events, skip to the latest few. */
    maxQueuedEvents: 20,
    keepWhenTrimmed: 5,
    /** Pause between showing the final decision and actually making the move. */
    decisionPauseMs: 2000,
    /** Short pause before moving when the thought visuals are switched off. */
    quietMoveDelayMs: 500,
  },
  animation: {
    moveSeconds: 0.5,
    liftSeconds: 0.15,
    captureSeconds: 0.25,
  },
  links: {
    github: 'https://github.com/kaificial/rooke',
    portfolio: 'https://kaificial.vercel.app',
  },
} as const
