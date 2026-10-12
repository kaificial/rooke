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
    /** The deepest it will ever search, in plies. It usually stops sooner, when its time is up. */
    maxDepth: 10,
    /** How long it may think about a move. */
    thinkTimeMs: 1200,
    /**
     * The thoughts are replayed so you can follow them, but the replay is capped:
     * at most this many lines are shown, each for up to `playbackIntervalMs`.
     */
    maxReplayLines: 5,
    playbackIntervalMs: 600,
    /** Pause between showing the final decision and actually making the move. */
    decisionPauseMs: 1000,
    /** Short pause before moving when the thought visuals are switched off. */
    quietMoveDelayMs: 300,
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
