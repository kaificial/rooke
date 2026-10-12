import * as THREE from 'three'
import type { Color, PieceType } from '../core'
import type { Materials } from './materials'

/** One mesh of a piece: a shared geometry plus where it sits. */
interface Part {
  geometry: THREE.BufferGeometry
  y: number
  /** Lathe bodies cast and receive shadows; the small details only cast them. */
  receiveShadow?: boolean
  /** Knight heads face forward, which depends on the side. */
  facing?: Record<Color, number>
}

const v = (x: number, y: number) => new THREE.Vector2(x, y)

// Half-profile of the common round base. LatheGeometry spins these (radius, height)
// points around the vertical axis.
const BASE_PROFILE = [v(0, 0), v(0.35, 0), v(0.35, 0.05), v(0.3, 0.1), v(0.25, 0.15), v(0, 0.15)]

const lathe = (points: THREE.Vector2[]): Part => ({
  geometry: new THREE.LatheGeometry(points, 32),
  y: 0,
  receiveShadow: true,
})

function buildKnightHead(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(0.3, 0) // neck base, front
  shape.lineTo(0.3, 0.4) // lower neck
  shape.quadraticCurveTo(0.35, 0.4, 0.5, 0.35) // under the chin
  shape.lineTo(0.55, 0.4) // lip
  shape.lineTo(0.55, 0.5) // tip of the nose
  shape.quadraticCurveTo(0.55, 0.6, 0.4, 0.6) // top of the nose
  shape.quadraticCurveTo(0.35, 0.65, 0.3, 0.8) // forehead
  shape.lineTo(0.25, 0.95) // front ear tip
  shape.lineTo(0.15, 0.85) // between the ears
  shape.lineTo(0.05, 0.95) // back ear tip
  shape.lineTo(0, 0.75) // back of the head
  shape.quadraticCurveTo(-0.15, 0.6, -0.25, 0.4) // mane
  shape.lineTo(-0.25, 0) // neck base, back
  shape.lineTo(0, 0)

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04 })
  geometry.translate(0, 0, -0.08) // center the thickness on the base
  return geometry
}

const BUILDERS: Record<PieceType, () => Part[]> = {
  p: () => [
    lathe([...BASE_PROFILE, v(0.2, 0.2), v(0.15, 0.4), v(0.2, 0.5), v(0.25, 0.6), v(0, 0.8)]),
    { geometry: new THREE.SphereGeometry(0.18, 16, 16), y: 0.7 },
  ],
  r: () => [
    lathe([...BASE_PROFILE, v(0.25, 0.2), v(0.25, 0.7), v(0.3, 0.8), v(0.3, 0.9), v(0, 0.9)]),
    { geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.15, 32), y: 0.95 },
  ],
  n: () => [
    lathe([v(0, 0), v(0.4, 0), v(0.4, 0.08), v(0.35, 0.12), v(0.3, 0.18), v(0.25, 0.22), v(0, 0.22)]),
    { geometry: buildKnightHead(), y: 0.2, facing: { w: Math.PI / 2, b: -Math.PI / 2 } },
  ],
  b: () => [
    lathe([...BASE_PROFILE, v(0.2, 0.2), v(0.15, 0.6), v(0.2, 0.8), v(0.1, 1.1), v(0, 1.2)]),
    { geometry: new THREE.SphereGeometry(0.05, 8, 8), y: 1.2 },
  ],
  q: () => [
    lathe([...BASE_PROFILE, v(0.25, 0.2), v(0.15, 0.8), v(0.3, 1.2), v(0.35, 1.3), v(0, 1.4)]),
    { geometry: new THREE.SphereGeometry(0.08, 16, 16), y: 1.45 },
  ],
  k: () => [
    lathe([...BASE_PROFILE, v(0.25, 0.2), v(0.2, 0.9), v(0.3, 1.3), v(0.3, 1.4), v(0, 1.5)]),
    { geometry: new THREE.BoxGeometry(0.2, 0.05, 0.05), y: 1.6 },
    { geometry: new THREE.BoxGeometry(0.05, 0.2, 0.05), y: 1.6 },
  ],
}

// Geometry is identical for both colors and every piece of a type, so build each once.
const partCache = new Map<PieceType, Part[]>()

function partsFor(type: PieceType): Part[] {
  let parts = partCache.get(type)
  if (!parts) {
    parts = BUILDERS[type]()
    partCache.set(type, parts)
  }
  return parts
}

/** Builds the 3D model of a piece. No imported assets: it is all lathes, spheres and boxes. */
export function createPieceMesh(type: PieceType, color: Color, materials: Materials): THREE.Group {
  const group = new THREE.Group()
  for (const part of partsFor(type)) {
    const mesh = new THREE.Mesh(part.geometry, materials.piece[color])
    mesh.position.y = part.y
    mesh.castShadow = true
    mesh.receiveShadow = part.receiveShadow ?? false
    if (part.facing) mesh.rotation.y = part.facing[color]
    group.add(mesh)
  }
  return group
}
