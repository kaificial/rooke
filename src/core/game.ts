import { hasLegalMove, legalMoves } from './movegen'
import { Position, START_FEN } from './position'
import { toSan } from './san'
import { isLightSquare } from './squares'
import { opposite } from './types'
import type { Color, Move, PromotionType, Square } from './types'

export type DrawReason = 'stalemate' | 'fifty-move' | 'repetition' | 'insufficient-material'

export type Outcome =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }

export interface PlayedMove {
  move: Move
  san: string
  color: Color
  /** Full move number the move was played on. */
  moveNumber: number
  check: boolean
}

/**
 * One game of chess: the position plus everything that depends on how we got
 * there (move list, repetition counts, result).
 */
export class Game {
  readonly position: Position
  readonly history: PlayedMove[] = []

  private readonly seen = new Map<string, number>()
  private result: Outcome | null = null

  constructor(fen: string = START_FEN) {
    this.position = Position.fromFen(fen)
    this.seen.set(this.position.key(), 1)
    this.result = this.evaluateOutcome()
  }

  get turn(): Color {
    return this.position.turn
  }

  get outcome(): Outcome | null {
    return this.result
  }

  get inCheck(): boolean {
    return this.position.inCheck()
  }

  legalMoves(): Move[] {
    return legalMoves(this.position)
  }

  legalMovesFrom(square: Square): Move[] {
    return this.legalMoves().filter((move) => move.from === square)
  }

  /** Looks a move up by its endpoints, so callers don't have to build flags. */
  findLegal(from: Square, to: Square, promotion?: PromotionType): Move | undefined {
    return this.legalMoves().find(
      (move) => move.from === from && move.to === to && move.promotion === promotion,
    )
  }

  /** Plays a move. Throws if it isn't legal in the current position. */
  play(candidate: Pick<Move, 'from' | 'to' | 'promotion'>): PlayedMove {
    if (this.result) throw new Error('The game is already over')
    const move = this.findLegal(candidate.from, candidate.to, candidate.promotion)
    if (!move) throw new Error(`Illegal move: ${candidate.from} -> ${candidate.to}`)

    const color = this.position.turn
    const moveNumber = this.position.fullmove
    const san = toSan(this.position, move)

    this.position.makeMove(move)
    const key = this.position.key()
    this.seen.set(key, (this.seen.get(key) ?? 0) + 1)

    const played: PlayedMove = { move, san, color, moveNumber, check: san.endsWith('+') || san.endsWith('#') }
    this.history.push(played)
    this.result = this.evaluateOutcome()
    return played
  }

  /** Ends the game because a player ran out of time. */
  flag(loser: Color): Outcome {
    this.result = { kind: 'timeout', winner: opposite(loser) }
    return this.result
  }

  private evaluateOutcome(): Outcome | null {
    const pos = this.position
    if (!hasLegalMove(pos)) {
      return pos.inCheck()
        ? { kind: 'checkmate', winner: opposite(pos.turn) }
        : { kind: 'draw', reason: 'stalemate' }
    }
    if (hasInsufficientMaterial(pos)) return { kind: 'draw', reason: 'insufficient-material' }
    if (pos.halfmove >= 100) return { kind: 'draw', reason: 'fifty-move' }
    if ((this.seen.get(pos.key()) ?? 0) >= 3) return { kind: 'draw', reason: 'repetition' }
    return null
  }
}

/** K vs K, K+minor vs K, or bishops that all live on one square color. */
export function hasInsufficientMaterial(pos: Position): boolean {
  const minors: { type: 'n' | 'b'; square: Square }[] = []
  for (let sq = 0; sq < 64; sq++) {
    const piece = pos.board[sq]
    if (!piece || piece.type === 'k') continue
    if (piece.type === 'n' || piece.type === 'b') minors.push({ type: piece.type, square: sq })
    else return false // any pawn, rook or queen can still mate
  }

  if (minors.length <= 1) return true
  if (minors.every((m) => m.type === 'b')) {
    const firstColor = isLightSquare(minors[0].square)
    return minors.every((m) => isLightSquare(m.square) === firstColor)
  }
  return false
}
