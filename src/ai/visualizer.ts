import gsap from 'gsap'
import * as THREE from 'three'
import type { Color, Move } from '../core'
import { BOARD_TOP, squareToWorld } from '../scene/coords'
import type { BoardView } from '../scene/boardView'
import type { Stage } from '../scene/stage'

const CYAN = 0x00ffff
const GOLD = 0xccb066

const AURA_WINNING = 0x00ff00
const AURA_LOSING = 0xff3300
const AURA_EVEN = 0x0088ff
const AURA_THRESHOLD = 100 // centipawns

/**
 * Draws what the engine is thinking onto the 3D board:
 *  - an arrow for the move being considered (gold once it is decided),
 *  - a wireframe "ghost" of the piece after that move, plus a line through the
 *    rest of the line the engine expects,
 *  - a glowing ring around the engine king, colored by how it feels about the position.
 */
export class AiVisualizer {
  private readonly board: BoardView
  private readonly aiColor: Color
  private readonly arrows = new THREE.Group()
  private readonly ghosts = new THREE.Group()
  private readonly aura = new THREE.Group()
  private readonly auraRing: THREE.Mesh
  private readonly auraGlow: THREE.Mesh
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
    blending: THREE.AdditiveBlending,
  })

  constructor(stage: Stage, board: BoardView, aiColor: Color) {
    this.board = board
    this.aiColor = aiColor

    const auraMaterial = () =>
      new THREE.MeshBasicMaterial({
        color: AURA_EVEN,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      })
    this.auraRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 32), auraMaterial())
    this.auraGlow = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.6, 32), auraMaterial())
    this.auraRing.rotation.x = this.auraGlow.rotation.x = -Math.PI / 2
    this.auraRing.position.y = 0.01
    this.auraGlow.position.y = 0
    this.aura.add(this.auraRing, this.auraGlow)

    stage.scene.add(this.arrows, this.ghosts, this.aura)
    stage.onFrame(() => this.followKing())
  }

  /** A move the engine is still weighing. */
  showCandidate(move: Move, pv: Move[], score: number): void {
    this.clear()
    this.addArrow(move, CYAN, 0.4)
    this.showLine(pv)
    this.updateAura(score)
  }

  /** The move the engine settled on. */
  showDecision(move: Move, pv: Move[], score: number): void {
    this.clear()
    this.addArrow(move, GOLD, 0.8)
    this.showLine(pv)
    this.updateAura(score)
  }

  /** Removes arrows and ghosts. The aura stays so the engine mood is still visible. */
  clear(): void {
    this.arrows.clear()
    this.ghosts.clear()
  }

  setVisible(visible: boolean): void {
    this.arrows.visible = this.ghosts.visible = this.aura.visible = visible
  }

  private addArrow(move: Move, color: number, opacity: number): void {
    const start = squareToWorld(move.from, BOARD_TOP + 0.1)
    const end = squareToWorld(move.to, BOARD_TOP + 0.1)
    const length = start.distanceTo(end)
    const headLength = 0.25

    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, length - headLength, 8), material)
    shaft.rotation.x = Math.PI / 2
    shaft.position.z = -(length - headLength) / 2
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, headLength, 8), material)
    head.rotation.x = Math.PI / 2
    head.position.z = -length + headLength / 2

    const arrow = new THREE.Group()
    arrow.add(shaft, head)
    arrow.position.copy(start)
    arrow.lookAt(end)
    this.arrows.add(arrow)
  }

  private showLine(pv: Move[]): void {
    const first = pv[0]
    if (!first) return

    // The first move gets a full wireframe copy of the piece at its destination...
    const model = this.board.cloneModel(first.from)
    if (model) {
      model.position.copy(squareToWorld(first.to))
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) child.material = this.ghostMaterial
      })
      this.ghosts.add(model)
    }

    // ...and the replies that follow are traced as a line over the squares they land on.
    if (pv.length > 1) {
      const points = pv.map((move) => squareToWorld(move.to, BOARD_TOP + 0.5))
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: CYAN, opacity: 0.3, transparent: true }),
      )
      this.ghosts.add(line)
    }
  }

  private updateAura(score: number): void {
    // Positive scores favor white; flip so that positive always means "the engine is ahead".
    const advantage = this.aiColor === 'w' ? score : -score

    let color = AURA_EVEN
    let intensity = 0.3
    if (advantage > AURA_THRESHOLD) {
      color = AURA_WINNING
      intensity = 0.8
    } else if (advantage < -AURA_THRESHOLD) {
      color = AURA_LOSING
      intensity = 0.6
    }

    const ring = this.auraRing.material as THREE.MeshBasicMaterial
    const glow = this.auraGlow.material as THREE.MeshBasicMaterial
    ring.color.set(color)
    glow.color.set(color)
    gsap.to(ring, { opacity: intensity, duration: 0.5 })
    gsap.to(glow, { opacity: intensity * 0.3, duration: 0.5 })
  }

  private followKing(): void {
    const square = this.board.findPiece('k', this.aiColor)
    const position = square === null ? null : this.board.worldPositionOf(square)
    if (position) this.aura.position.set(position.x, BOARD_TOP + 0.03, position.z)
  }
}
