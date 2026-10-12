import * as THREE from 'three'
import { isLightSquare } from '../core'
import { BOARD_SIZE, BOARD_TOP, TILE_SIZE, squareToWorld } from './coords'
import type { Materials } from './materials'

/** An extruded rectangle with softly beveled edges, lying flat. */
function createBeveledBox(width: number, height: number, depth: number, bevel: number, material: THREE.Material) {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, -depth / 2)
  shape.lineTo(width / 2, -depth / 2)
  shape.lineTo(width / 2, depth / 2)
  shape.lineTo(-width / 2, depth / 2)
  shape.lineTo(-width / 2, -depth / 2)

  const geometry = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: height,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 3,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** The 64 squares on their dark base. */
export function createBoard(materials: Materials): THREE.Group {
  const board = new THREE.Group()

  const base = createBeveledBox(
    BOARD_SIZE * TILE_SIZE + 0.6,
    BOARD_TOP,
    BOARD_SIZE * TILE_SIZE + 0.6,
    0.05,
    materials.boardBase,
  )
  base.position.y = -0.05
  board.add(base)

  for (let square = 0; square < 64; square++) {
    const material = isLightSquare(square) ? materials.lightSquare : materials.darkSquare
    const tile = createBeveledBox(TILE_SIZE, 0.05, TILE_SIZE, 0.01, material)
    tile.position.copy(squareToWorld(square, BOARD_TOP - 0.02))
    board.add(tile)
  }
  return board
}
