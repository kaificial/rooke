import * as THREE from 'three'
import { fileOf, rankOf } from '../core'
import type { Square } from '../core'

export const BOARD_SIZE = 8
export const TILE_SIZE = 1
/** Height of the playing surface. Pieces stand on this. */
export const BOARD_TOP = 0.2

/**
 * World position of a square's center. White sits on the +z side (nearest the
 * default camera) and the a-file is on the -x side, so the board reads the
 * same way it does from white's chair.
 */
export function squareToWorld(square: Square, y: number = BOARD_TOP): THREE.Vector3 {
  const half = (BOARD_SIZE - 1) / 2
  return new THREE.Vector3((fileOf(square) - half) * TILE_SIZE, y, (half - rankOf(square)) * TILE_SIZE)
}
