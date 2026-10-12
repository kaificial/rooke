import type { Square } from './types'

const FILE_NAMES = 'abcdefgh'

/** 0 = a-file ... 7 = h-file. */
export const fileOf = (sq: Square): number => sq & 7

/** 0 = first rank ... 7 = eighth rank (so white's back rank is 0). */
export const rankOf = (sq: Square): number => 7 - (sq >> 3)

export const toSquare = (file: number, rank: number): Square => (7 - rank) * 8 + file

export const squareName = (sq: Square): string => FILE_NAMES[fileOf(sq)] + (rankOf(sq) + 1)

export function parseSquare(name: string): Square {
  const file = FILE_NAMES.indexOf(name[0])
  const rank = Number(name[1]) - 1
  if (name.length !== 2 || file < 0 || !(rank >= 0 && rank < 8)) {
    throw new Error(`Invalid square: "${name}"`)
  }
  return toSquare(file, rank)
}

export const isLightSquare = (sq: Square): boolean => (fileOf(sq) + rankOf(sq)) % 2 === 1
