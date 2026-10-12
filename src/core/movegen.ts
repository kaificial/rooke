import {
  BISHOP_DIRECTIONS,
  KING_STEPS,
  KNIGHT_STEPS,
  ROOK_DIRECTIONS,
} from './attacks'
import {
  BLACK_KINGSIDE,
  BLACK_QUEENSIDE,
  WHITE_KINGSIDE,
  WHITE_QUEENSIDE,
} from './position'
import type { Position } from './position'
import { opposite } from './types'
import type { Color, Move, PieceType, PromotionType, Square } from './types'
import type { Step } from './attacks'

const PROMOTIONS: readonly PromotionType[] = ['q', 'r', 'b', 'n']

interface GenerateOptions {
  /** Only captures and promotions, for quiescence search. */
  noisyOnly?: boolean
}

/**
 * Pseudo-legal moves: every move a piece could make, ignoring whether it
 * leaves its own king in check. Castling is the exception, since its rules
 * about attacked squares are part of the move itself.
 */
export function generatePseudoLegal(pos: Position, options: GenerateOptions = {}): Move[] {
  const moves: Move[] = []
  const color = pos.turn
  const noisyOnly = options.noisyOnly ?? false

  for (let sq = 0; sq < 64; sq++) {
    const piece = pos.board[sq]
    if (!piece || piece.color !== color) continue

    switch (piece.type) {
      case 'p':
        generatePawn(pos, sq, color, noisyOnly, moves)
        break
      case 'n':
        generateStepper(pos, sq, 'n', KNIGHT_STEPS, color, noisyOnly, moves)
        break
      case 'k':
        generateStepper(pos, sq, 'k', KING_STEPS, color, noisyOnly, moves)
        if (!noisyOnly) generateCastling(pos, sq, color, moves)
        break
      case 'b':
        generateSlider(pos, sq, 'b', BISHOP_DIRECTIONS, color, noisyOnly, moves)
        break
      case 'r':
        generateSlider(pos, sq, 'r', ROOK_DIRECTIONS, color, noisyOnly, moves)
        break
      case 'q':
        generateSlider(pos, sq, 'q', ROOK_DIRECTIONS, color, noisyOnly, moves)
        generateSlider(pos, sq, 'q', BISHOP_DIRECTIONS, color, noisyOnly, moves)
        break
    }
  }
  return moves
}

/** Fully legal moves for the side to move. */
export function legalMoves(pos: Position): Move[] {
  const color = pos.turn
  const legal: Move[] = []
  for (const move of generatePseudoLegal(pos)) {
    pos.makeMove(move)
    if (!pos.inCheck(color)) legal.push(move)
    pos.unmakeMove()
  }
  return legal
}

export function hasLegalMove(pos: Position): boolean {
  const color = pos.turn
  for (const move of generatePseudoLegal(pos)) {
    pos.makeMove(move)
    const legal = !pos.inCheck(color)
    pos.unmakeMove()
    if (legal) return true
  }
  return false
}

/** Counts leaf nodes of the legal move tree. The standard move generator test. */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1
  const moves = legalMoves(pos)
  if (depth === 1) return moves.length
  let nodes = 0
  for (const move of moves) {
    pos.makeMove(move)
    nodes += perft(pos, depth - 1)
    pos.unmakeMove()
  }
  return nodes
}

function generatePawn(pos: Position, from: Square, color: Color, noisyOnly: boolean, out: Move[]): void {
  const row = from >> 3
  const col = from & 7
  const forward = color === 'w' ? -1 : 1
  const startRow = color === 'w' ? 6 : 1
  const promotionRow = color === 'w' ? 0 : 7
  const nextRow = row + forward

  const push = (to: Square, extra: Partial<Move>) => {
    if (nextRow === promotionRow) {
      for (const promotion of PROMOTIONS) out.push({ from, to, piece: 'p', promotion, ...extra })
    } else {
      out.push({ from, to, piece: 'p', ...extra })
    }
  }

  const ahead = nextRow * 8 + col
  if (!pos.board[ahead]) {
    if (nextRow === promotionRow || !noisyOnly) push(ahead, {})
    if (!noisyOnly && row === startRow && !pos.board[ahead + forward * 8]) {
      out.push({ from, to: ahead + forward * 8, piece: 'p', doublePush: true })
    }
  }

  for (const dc of [-1, 1]) {
    const c = col + dc
    if (c < 0 || c > 7) continue
    const to = nextRow * 8 + c
    const target = pos.board[to]
    if (target && target.color !== color) {
      push(to, { captured: target.type })
    } else if (!target && to === pos.epSquare) {
      out.push({ from, to, piece: 'p', captured: 'p', enPassant: true })
    }
  }
}

function generateStepper(
  pos: Position,
  from: Square,
  piece: PieceType,
  steps: readonly Step[],
  color: Color,
  noisyOnly: boolean,
  out: Move[],
): void {
  const row = from >> 3
  const col = from & 7
  for (const [dr, dc] of steps) {
    const r = row + dr
    const c = col + dc
    if (r < 0 || r > 7 || c < 0 || c > 7) continue
    const to = r * 8 + c
    const target = pos.board[to]
    if (!target) {
      if (!noisyOnly) out.push({ from, to, piece })
    } else if (target.color !== color) {
      out.push({ from, to, piece, captured: target.type })
    }
  }
}

function generateSlider(
  pos: Position,
  from: Square,
  piece: PieceType,
  directions: readonly Step[],
  color: Color,
  noisyOnly: boolean,
  out: Move[],
): void {
  const row = from >> 3
  const col = from & 7
  for (const [dr, dc] of directions) {
    let r = row + dr
    let c = col + dc
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const to = r * 8 + c
      const target = pos.board[to]
      if (!target) {
        if (!noisyOnly) out.push({ from, to, piece })
      } else {
        if (target.color !== color) out.push({ from, to, piece, captured: target.type })
        break
      }
      r += dr
      c += dc
    }
  }
}

/** Squares the king and rook must have empty / the king must not cross attacked. */
interface CastleSpec {
  rights: number
  kingFrom: Square
  kingTo: Square
  rookFrom: Square
  empty: readonly Square[]
  safe: readonly Square[]
  side: 'k' | 'q'
}

const CASTLES: Record<Color, readonly CastleSpec[]> = {
  w: [
    { rights: WHITE_KINGSIDE, kingFrom: 60, kingTo: 62, rookFrom: 63, empty: [61, 62], safe: [60, 61, 62], side: 'k' },
    { rights: WHITE_QUEENSIDE, kingFrom: 60, kingTo: 58, rookFrom: 56, empty: [57, 58, 59], safe: [60, 59, 58], side: 'q' },
  ],
  b: [
    { rights: BLACK_KINGSIDE, kingFrom: 4, kingTo: 6, rookFrom: 7, empty: [5, 6], safe: [4, 5, 6], side: 'k' },
    { rights: BLACK_QUEENSIDE, kingFrom: 4, kingTo: 2, rookFrom: 0, empty: [1, 2, 3], safe: [4, 3, 2], side: 'q' },
  ],
}

function generateCastling(pos: Position, from: Square, color: Color, out: Move[]): void {
  const them = opposite(color)
  for (const spec of CASTLES[color]) {
    if (from !== spec.kingFrom || !(pos.castling & spec.rights)) continue
    const rook = pos.board[spec.rookFrom]
    if (!rook || rook.type !== 'r' || rook.color !== color) continue
    if (spec.empty.some((sq) => pos.board[sq])) continue
    if (spec.safe.some((sq) => pos.isAttackedBy(sq, them))) continue
    out.push({ from, to: spec.kingTo, piece: 'k', castle: spec.side })
  }
}
