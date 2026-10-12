import { PIECE_NAMES, squareName } from '../core'
import type { Color, Move } from '../core'
import { isMateScore, mateIn } from '../engine/score'

export type Sentiment = 'info' | 'good' | 'bad' | 'action'

export interface Narration {
  text: string
  sentiment: Sentiment
}

interface NarrateOptions {
  /** The side making the move being described. */
  mover: Color
  /** The side the engine plays, to decide what counts as good news. */
  aiColor: Color
  /** True for the engine's final choice, false for a line it is still working on. */
  final: boolean
  /** How many plies deep the engine had looked. */
  depth?: number
}

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5'])
const ADVANTAGE_THRESHOLD = 50 // centipawns

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** "+0.35", "-1.20", or "White mates in 3" for forced mates. */
export function formatScore(score: number): string {
  if (isMateScore(score)) return `${score > 0 ? 'White' : 'Black'} mates in ${mateIn(score)}`
  return `${score > 0 ? '+' : ''}${(score / 100).toFixed(2)}`
}

/**
 * Turns a move and its score into the one-line commentary shown in the AI log.
 *
 * The reasons are simple heuristics (is it a capture, does it take the
 * center...). The score is the real search result; the "why" is a friendly gloss.
 */
export function narrate(move: Move, score: number, { mover, aiColor, final, depth }: NarrateOptions): Narration {
  const piece = capitalize(PIECE_NAMES[move.piece])
  const destination = squareName(move.to)
  const opponent = mover === 'w' ? 'Black' : 'White'

  let reason = 'to improve its position'
  if (move.promotion) reason = `and promotes to a ${PIECE_NAMES[move.promotion]}`
  else if (move.castle) reason = `to castle ${move.castle === 'k' ? 'kingside' : 'queenside'} and tuck the king away`
  else if (move.captured) reason = `to capture ${opponent}'s ${PIECE_NAMES[move.captured]}`
  else if (CENTER_SQUARES.has(destination)) reason = 'to control the center'

  // From the engine's point of view: positive means the engine is ahead.
  const advantage = aiColor === 'w' ? score : -score

  let label = final ? 'Decided to move' : 'Thinking about moving'
  let sentiment: Sentiment = final ? 'action' : 'info'
  if (!final && advantage > ADVANTAGE_THRESHOLD) {
    label = 'Aggressive move:'
    sentiment = 'good'
  } else if (!final && advantage < -ADVANTAGE_THRESHOLD) {
    label = 'Defending:'
    sentiment = 'bad'
  }

  const detail = depth ? `${formatScore(score)}, depth ${depth}` : formatScore(score)
  return { text: `${label} ${piece} to ${destination} ${reason} (${detail})`, sentiment }
}
