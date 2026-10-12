import gsap from 'gsap'

interface Voxel {
  x: number
  y: number
  z: number
}

const CUBE_WIDTH = 22
const CUBE_HEIGHT = 12
const SVG_NS = 'http://www.w3.org/2000/svg'

// Three face shades per state give each cube its fake lighting.
const SHADES = {
  rest: { top: '#dcb756', left: '#b48d3c', right: '#856322' },
  hover: { top: '#f6d173', left: '#d2a64b', right: '#a47e33' },
} as const

/** A 5x5 slab with its four corners cut off. */
function roundedSlab(z: number): Voxel[] {
  const voxels: Voxel[] = []
  for (let x = -2; x <= 2; x++) {
    for (let y = -2; y <= 2; y++) {
      if (Math.abs(x) === 2 && Math.abs(y) === 2) continue
      voxels.push({ x, y, z })
    }
  }
  return voxels
}

function solidSlab(z: number): Voxel[] {
  const voxels: Voxel[] = []
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) voxels.push({ x, y, z })
  }
  return voxels
}

/** The rook, built layer by layer from the ground up. */
function rookVoxels(): Voxel[] {
  const voxels: Voxel[] = [...roundedSlab(0), ...solidSlab(1)]

  // The shaft is a plus shape rather than a full block.
  for (let z = 2; z <= 5; z++) {
    voxels.push({ x: 0, y: 0, z }, { x: -1, y: 0, z }, { x: 1, y: 0, z }, { x: 0, y: -1, z }, { x: 0, y: 1, z })
  }

  voxels.push(...solidSlab(6), ...roundedSlab(7))

  // Battlements around the top.
  const merlons = [
    [-1, -2], [1, -2], [-1, 2], [1, 2], [-2, -1], [-2, 1], [2, -1], [2, 1],
  ]
  for (const [x, y] of merlons) voxels.push({ x, y, z: 8 })

  // Painter's algorithm: draw back to front so nearer cubes cover farther ones.
  return voxels.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z))
}

function polygon(points: string, fill: string): SVGPolygonElement {
  const face = document.createElementNS(SVG_NS, 'polygon')
  face.setAttribute('points', points)
  face.setAttribute('fill', fill)
  face.setAttribute('stroke', 'rgba(0, 0, 0, 0.25)')
  face.setAttribute('stroke-width', '1')
  return face
}

/**
 * Draws the isometric voxel rook into `svg`: every cube drops in with a
 * staggered GSAP tween and lifts when hovered.
 */
export function mountVoxelRook(svg: SVGElement): void {
  const W = CUBE_WIDTH
  const H = CUBE_HEIGHT

  rookVoxels().forEach((voxel, index) => {
    const cx = (voxel.x - voxel.y) * W
    const cy = (voxel.x + voxel.y) * H - voxel.z * 2 * H + 80 // +80 centers the rook in the viewBox

    const top = polygon(`0,${-2 * H} ${W},${-H} 0,0 ${-W},${-H}`, SHADES.rest.top)
    const left = polygon(`0,0 ${-W},${-H} ${-W},${H} 0,${2 * H}`, SHADES.rest.left)
    const right = polygon(`0,0 ${W},${-H} ${W},${H} 0,${2 * H}`, SHADES.rest.right)

    const cube = document.createElementNS(SVG_NS, 'g')
    cube.setAttribute('class', 'isocube')
    cube.append(top, left, right)
    svg.appendChild(cube)

    gsap.set(cube, { x: cx, y: cy - 250, opacity: 0 })
    gsap.to(cube, { y: cy, opacity: 1, duration: 1.5, delay: 0.015 * index, ease: 'back.out(1)' })

    cube.addEventListener('mouseenter', () => {
      gsap.to(cube, { y: cy - 12, duration: 0.3, ease: 'power2.out' })
      gsap.to(top, { fill: SHADES.hover.top, duration: 0.3 })
      gsap.to(left, { fill: SHADES.hover.left, duration: 0.3 })
      gsap.to(right, { fill: SHADES.hover.right, duration: 0.3 })
    })
    cube.addEventListener('mouseleave', () => {
      gsap.to(cube, { y: cy, duration: 0.6, ease: 'bounce.out' })
      gsap.to(top, { fill: SHADES.rest.top, duration: 0.5 })
      gsap.to(left, { fill: SHADES.rest.left, duration: 0.5 })
      gsap.to(right, { fill: SHADES.rest.right, duration: 0.5 })
    })
  })
}
