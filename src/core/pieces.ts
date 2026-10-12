import type { Color, Piece, PieceType } from './types'

const TYPES: readonly PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k']

// Pieces are immutable, so one shared object per (type, color) is enough.
// This keeps move making allocation-free.
const CACHE = new Map<string, Piece>()
for (const color of ['w', 'b'] as const) {
  for (const type of TYPES) CACHE.set(color + type, Object.freeze({ type, color }))
}

export function getPiece(type: PieceType, color: Color): Piece {
  return CACHE.get(color + type)!
}

export function pieceFromFenChar(char: string): Piece | null {
  const type = char.toLowerCase() as PieceType
  if (!TYPES.includes(type)) return null
  return getPiece(type, char === char.toUpperCase() ? 'w' : 'b')
}

export function fenChar(piece: Piece): string {
  return piece.color === 'w' ? piece.type.toUpperCase() : piece.type
}
