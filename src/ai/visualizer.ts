import * as THREE from 'three'
import type { Move } from '../core'
import { BOARD_TOP, squareToWorld } from '../scene/coords'
import type { BoardView } from '../scene/boardView'
import type { Stage } from '../scene/stage'

const CYAN = 0x00ffff
const GOLD = 0xccb066

/**
 * Draws what the engine is thinking onto the 3D board:
 *  - an arrow for the move being considered (gold once it is decided),
 *  - a wireframe "ghost" of the piece after that move, plus a line through the
 *    rest of the line the engine expects.
 */
export class AiVisualizer {
  private readonly board: BoardView
  private readonly arrows = new THREE.Group()
  private readonly ghosts = new THREE.Group()
  private readonly ghostMaterial = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
    blending: THREE.AdditiveBlending,
  })

  constructor(stage: Stage, board: BoardView) {
    this.board = board
    stage.scene.add(this.arrows, this.ghosts)
  }

  /** A move the engine is still weighing. */
  showCandidate(move: Move, pv: Move[]): void {
    this.clear()
    this.addArrow(move, CYAN, 0.4)
    this.showLine(pv)
  }

  /** The move the engine settled on. */
  showDecision(move: Move, pv: Move[]): void {
    this.clear()
    this.addArrow(move, GOLD, 0.8)
    this.showLine(pv)
  }

  clear(): void {
    this.arrows.clear()
    this.ghosts.clear()
  }

  setVisible(visible: boolean): void {
    this.arrows.visible = this.ghosts.visible = visible
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
}
