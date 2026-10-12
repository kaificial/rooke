import type { Color, PieceType, Position } from '../core'

/** Centipawn value of each piece. Kings are never captured, so they carry none. */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
}

// Piece-square tables, from the "Simplified Evaluation Function" on the Chess
// Programming Wiki. They are written from white's point of view with index 0 = a8,
// which is how this project numbers squares. Black reads them flipped with `sq ^ 56`.
const PAWN = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
]
const KNIGHT = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
]
const BISHOP = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
]
const ROOK = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0,
]
const QUEEN = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
]
const KING_MIDDLEGAME = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20,
]
// With the queens off the board a king should walk to the middle and help.
const KING_ENDGAME = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
]
// Pawns matter more the closer they are to promoting once pieces come off.
const PAWN_ENDGAME = [
  0, 0, 0, 0, 0, 0, 0, 0,
  80, 80, 80, 80, 80, 80, 80, 80,
  50, 50, 50, 50, 50, 50, 50, 50,
  30, 30, 30, 30, 30, 30, 30, 30,
  20, 20, 20, 20, 20, 20, 20, 20,
  10, 10, 10, 10, 10, 10, 10, 10,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
]

const MIDDLEGAME_TABLES: Readonly<Record<PieceType, readonly number[]>> = {
  p: PAWN,
  n: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
  k: KING_MIDDLEGAME,
}
const ENDGAME_TABLES: Readonly<Record<PieceType, readonly number[]>> = {
  ...MIDDLEGAME_TABLES,
  p: PAWN_ENDGAME,
  k: KING_ENDGAME,
}

/** How much each piece counts toward "how far into the middlegame are we". Full board = 24. */
const PHASE_WEIGHT: Readonly<Record<PieceType, number>> = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 }
const FULL_PHASE = 24

// Bonuses by how far a passed pawn has come (index = ranks from its own back rank).
const PASSED_MIDDLEGAME = [0, 5, 8, 15, 25, 40, 60, 0]
const PASSED_ENDGAME = [0, 10, 20, 35, 60, 100, 150, 0]
const BISHOP_PAIR = [30, 45] // [middlegame, endgame]
const DOUBLED_PAWN = [-12, -18]
const ISOLATED_PAWN = [-10, -15]
const ROOK_OPEN_FILE = 20
const ROOK_SEMI_OPEN_FILE = 10
const PAWN_SHIELD = 8 // per pawn sheltering the king, middlegame only

interface Tally {
  middlegame: number
  endgame: number
  phase: number
}

// Scratch space reused by every call, so evaluating a position allocates nothing.
// (The evaluator is synchronous and never re-entered, so sharing is safe.)
const whitePawns = new Int8Array(8)
const blackPawns = new Int8Array(8)
const whiteHighestRow = new Int8Array(8)
const blackLowestRow = new Int8Array(8)

/**
 * Static evaluation in centipawns, positive when white is better.
 *
 * Material and piece placement, blended between a middlegame and an endgame
 * version by how much material is left, plus the usual structural terms:
 * passed, doubled and isolated pawns, the bishop pair, rooks on open files
 * and pawns sheltering the king.
 */
export function evaluate(pos: Position): number {
  const board = pos.board

  // Per file: how many pawns each side has, plus the extreme pawn rows needed to spot passed pawns.
  // Rows count down from the eighth rank, so a white pawn advances toward row 0.
  const pawnCount = { w: whitePawns, b: blackPawns }
  whitePawns.fill(0)
  blackPawns.fill(0)
  whiteHighestRow.fill(-1) // white pawn closest to white's own back rank
  blackLowestRow.fill(8) // black pawn closest to black's own back rank
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq]
    if (piece?.type !== 'p') continue
    const file = sq & 7
    const row = sq >> 3
    pawnCount[piece.color][file]++
    if (piece.color === 'w') whiteHighestRow[file] = Math.max(whiteHighestRow[file], row)
    else blackLowestRow[file] = Math.min(blackLowestRow[file], row)
  }

  const tally: Record<Color, Tally> = {
    w: { middlegame: 0, endgame: 0, phase: 0 },
    b: { middlegame: 0, endgame: 0, phase: 0 },
  }
  let whiteBishops = 0
  let blackBishops = 0

  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq]
    if (!piece) continue
    const { type, color } = piece
    const mine = tally[color]
    const tableIndex = color === 'w' ? sq : sq ^ 56
    const file = sq & 7
    const row = sq >> 3

    mine.middlegame += PIECE_VALUES[type] + MIDDLEGAME_TABLES[type][tableIndex]
    mine.endgame += PIECE_VALUES[type] + ENDGAME_TABLES[type][tableIndex]
    mine.phase += PHASE_WEIGHT[type]

    switch (type) {
      case 'p': {
        const ownRank = color === 'w' ? 7 - row : row // ranks travelled from the back rank

        // Passed: no enemy pawn ahead of it on its own file or a neighboring one.
        let passed = true
        for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
          const blocked = color === 'w' ? blackLowestRow[f] < row : whiteHighestRow[f] > row
          if (blocked) passed = false
        }
        if (passed) {
          mine.middlegame += PASSED_MIDDLEGAME[ownRank]
          mine.endgame += PASSED_ENDGAME[ownRank]
        }

        const friends = pawnCount[color]
        if (friends[file] > 1) {
          mine.middlegame += DOUBLED_PAWN[0] / friends[file]
          mine.endgame += DOUBLED_PAWN[1] / friends[file]
        }
        const isolated = (file === 0 || friends[file - 1] === 0) && (file === 7 || friends[file + 1] === 0)
        if (isolated) {
          mine.middlegame += ISOLATED_PAWN[0]
          mine.endgame += ISOLATED_PAWN[1]
        }
        break
      }
      case 'b':
        if (color === 'w') whiteBishops++
        else blackBishops++
        break
      case 'r': {
        const friends = pawnCount[color][file]
        const enemies = pawnCount[color === 'w' ? 'b' : 'w'][file]
        if (friends === 0) {
          const bonus = enemies === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE
          mine.middlegame += bonus
          mine.endgame += bonus
        }
        break
      }
      case 'k': {
        // Pawns on the king's file and its neighbors, in the two rows in front of it.
        const forward = color === 'w' ? -1 : 1
        let shield = 0
        for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
          for (let step = 1; step <= 2; step++) {
            const r = row + forward * step
            if (r < 0 || r > 7) continue
            const near = board[r * 8 + f]
            if (near?.type === 'p' && near.color === color) {
              shield++
              break
            }
          }
        }
        mine.middlegame += shield * PAWN_SHIELD
        break
      }
    }
  }

  if (whiteBishops >= 2) {
    tally.w.middlegame += BISHOP_PAIR[0]
    tally.w.endgame += BISHOP_PAIR[1]
  }
  if (blackBishops >= 2) {
    tally.b.middlegame += BISHOP_PAIR[0]
    tally.b.endgame += BISHOP_PAIR[1]
  }

  const phase = Math.min(FULL_PHASE, tally.w.phase + tally.b.phase)
  const middlegame = tally.w.middlegame - tally.b.middlegame
  const endgame = tally.w.endgame - tally.b.endgame
  return Math.round((middlegame * phase + endgame * (FULL_PHASE - phase)) / FULL_PHASE)
}
