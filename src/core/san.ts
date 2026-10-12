import { legalMoves, hasLegalMove } from './movegen'
import type { Position } from './position'
import { fileOf, rankOf, squareName } from './squares'
import type { Move } from './types'

const FILE_LETTERS = 'abcdefgh'

/**
 * Standard algebraic notation for a legal move in `pos`, e.g. "Nbd7", "exd5",
 * "O-O", "e8=Q#". Does not leave `pos` changed.
 */
export function toSan(pos: Position, move: Move): string {
  let san: string

  if (move.castle) {
    san = move.castle === 'k' ? 'O-O' : 'O-O-O'
  } else if (move.piece === 'p') {
    san = (move.captured ? FILE_LETTERS[fileOf(move.from)] + 'x' : '') + squareName(move.to)
    if (move.promotion) san += '=' + move.promotion.toUpperCase()
  } else {
    san = move.piece.toUpperCase() + disambiguation(pos, move)
    if (move.captured) san += 'x'
    san += squareName(move.to)
  }

  pos.makeMove(move)
  if (pos.inCheck()) san += hasLegalMove(pos) ? '+' : '#'
  pos.unmakeMove()
  return san
}

/** The extra file/rank needed when two identical pieces can reach the square. */
function disambiguation(pos: Position, move: Move): string {
  const rivals = legalMoves(pos).filter(
    (other) => other.piece === move.piece && other.to === move.to && other.from !== move.from,
  )
  if (rivals.length === 0) return ''

  const sharesFile = rivals.some((other) => fileOf(other.from) === fileOf(move.from))
  const sharesRank = rivals.some((other) => rankOf(other.from) === rankOf(move.from))
  const file = FILE_LETTERS[fileOf(move.from)]
  const rank = String(rankOf(move.from) + 1)

  if (!sharesFile) return file
  if (!sharesRank) return rank
  return file + rank
}
