import gsap from 'gsap'
import * as THREE from 'three'
import { rankOf, toSquare } from '../core'
import type { Color, Move, PieceType, Position, Square } from '../core'
import { CONFIG } from '../config'
import { createBoard } from './board'
import { BOARD_TOP, squareToWorld } from './coords'
import { createMaterials } from './materials'
import type { Materials } from './materials'
import { createPieceMesh } from './pieceMeshes'
import type { Stage } from './stage'

interface PieceView {
  group: THREE.Group
  type: PieceType
  color: Color
  square: Square
}

export type Pick =
  | { kind: 'target'; square: Square }
  | { kind: 'piece'; square: Square }

const LIFT = 0.3

/**
 * The 3D board and the pieces on it. It owns the meshes and animations and
 * knows nothing about the rules: callers say which moves happened and it makes
 * them visible.
 */
export class BoardView {
  private readonly stage: Stage
  private readonly materials: Materials
  private readonly pieces = new Map<Square, PieceView>()
  private readonly raycaster = new THREE.Raycaster()
  private readonly targetMarkers: THREE.Mesh[] = []
  private readonly markerGeometry = new THREE.PlaneGeometry(0.8, 0.8)
  private readonly markerMaterial: THREE.MeshBasicMaterial
  private lifted: PieceView | null = null

  constructor(stage: Stage) {
    this.stage = stage
    this.materials = createMaterials(stage.envMap)
    stage.scene.add(createBoard(this.materials))
    this.markerMaterial = new THREE.MeshBasicMaterial({
      map: createGlowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }

  /** Clears the board and places a piece for everything in `position`. */
  setPosition(position: Position): void {
    this.clearTargets()
    this.lifted = null
    for (const view of this.pieces.values()) this.stage.scene.remove(view.group)
    this.pieces.clear()

    position.board.forEach((piece, square) => {
      if (piece) this.addPiece(piece.type, piece.color, square)
    })
  }

  pieceAt(square: Square): { type: PieceType; color: Color } | null {
    return this.pieces.get(square) ?? null
  }

  /** World position of a piece's mesh, for effects that follow it. */
  worldPositionOf(square: Square): THREE.Vector3 | null {
    return this.pieces.get(square)?.group.position ?? null
  }

  findPiece(type: PieceType, color: Color): Square | null {
    for (const [square, view] of this.pieces) {
      if (view.type === type && view.color === color) return square
    }
    return null
  }

  /** A copy of the piece on `square` that can be restyled without touching the original. */
  cloneModel(square: Square): THREE.Group | null {
    return this.pieces.get(square)?.group.clone() ?? null
  }

  /** Raises a piece to show it is selected. Pass null to put it back down. */
  select(square: Square | null): void {
    if (this.lifted) {
      gsap.to(this.lifted.group.position, { y: BOARD_TOP, duration: CONFIG.animation.liftSeconds })
      this.lifted = null
    }
    const view = square === null ? undefined : this.pieces.get(square)
    if (view) {
      gsap.to(view.group.position, { y: BOARD_TOP + LIFT, duration: CONFIG.animation.liftSeconds })
      this.lifted = view
    }
  }

  showTargets(squares: Square[]): void {
    this.clearTargets()
    for (const square of squares) {
      const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial)
      marker.rotation.x = -Math.PI / 2
      marker.position.copy(squareToWorld(square, BOARD_TOP + 0.12))
      marker.userData.square = square
      this.stage.scene.add(marker)
      this.targetMarkers.push(marker)
    }
  }

  clearTargets(): void {
    for (const marker of this.targetMarkers) this.stage.scene.remove(marker)
    this.targetMarkers.length = 0
  }

  /** What is under the pointer: a highlighted target square, or a piece. */
  pick(clientX: number, clientY: number): Pick | null {
    const pointer = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    )
    this.raycaster.setFromCamera(pointer, this.stage.camera)

    const marker = this.raycaster.intersectObjects(this.targetMarkers, false)[0]
    if (marker) return { kind: 'target', square: marker.object.userData.square as Square }

    const meshes = [...this.pieces.values()].flatMap((view) => view.group.children)
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    if (hit) {
      for (const [square, view] of this.pieces) {
        if (view.group.children.includes(hit.object)) return { kind: 'piece', square }
      }
    }
    return null
  }

  /**
   * Animates a move that has already been applied to the game: slides the
   * piece, takes the captured piece off the board, swings the rook for
   * castling and swaps the model on promotion. Resolves when it's all done.
   */
  applyMove(move: Move): Promise<void> {
    const mover = this.pieces.get(move.from)
    if (!mover) return Promise.reject(new Error(`No piece on square ${move.from}`))

    this.select(null)
    this.clearTargets()

    const animations: Promise<void>[] = []

    const capturedSquare = move.enPassant
      ? toSquare(move.to & 7, rankOf(move.from)) // the pawn stands beside the mover, not on the target
      : move.to
    const captured = move.captured ? this.pieces.get(capturedSquare) : undefined
    if (captured) {
      this.pieces.delete(capturedSquare)
      animations.push(this.remove(captured))
    }

    this.pieces.delete(move.from)
    mover.square = move.to
    this.pieces.set(move.to, mover)
    animations.push(this.slide(mover.group, move.to, CONFIG.animation.moveSeconds))

    if (move.castle) {
      const rank = rankOf(move.from)
      const rookFrom = toSquare(move.castle === 'k' ? 7 : 0, rank)
      const rookTo = toSquare(move.castle === 'k' ? 5 : 3, rank)
      const rook = this.pieces.get(rookFrom)
      if (rook) {
        this.pieces.delete(rookFrom)
        rook.square = rookTo
        this.pieces.set(rookTo, rook)
        animations.push(this.slide(rook.group, rookTo, CONFIG.animation.moveSeconds))
      }
    }

    return Promise.all(animations).then(() => {
      if (move.promotion) this.replaceModel(mover, move.promotion)
    })
  }

  private addPiece(type: PieceType, color: Color, square: Square): PieceView {
    const group = createPieceMesh(type, color, this.materials)
    group.position.copy(squareToWorld(square))
    this.stage.scene.add(group)
    const view: PieceView = { group, type, color, square }
    this.pieces.set(square, view)
    return view
  }

  private replaceModel(view: PieceView, type: PieceType): void {
    this.stage.scene.remove(view.group)
    view.type = type
    view.group = createPieceMesh(type, view.color, this.materials)
    view.group.position.copy(squareToWorld(view.square))
    this.stage.scene.add(view.group)
  }

  private slide(group: THREE.Group, to: Square, seconds: number): Promise<void> {
    const target = squareToWorld(to)
    gsap.killTweensOf(group.position) // e.g. a lift that is still settling
    return new Promise((resolve) => {
      gsap.to(group.position, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: seconds,
        ease: 'power2.inOut',
        onComplete: resolve,
      })
    })
  }

  private remove(view: PieceView): Promise<void> {
    return new Promise((resolve) => {
      gsap.to(view.group.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: CONFIG.animation.captureSeconds,
        ease: 'power2.in',
        onComplete: () => {
          this.stage.scene.remove(view.group)
          resolve()
        },
      })
    })
  }
}

/** Soft gold radial glow used for the "you can move here" markers. */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(204, 176, 102, 0.6)')
  gradient.addColorStop(0.5, 'rgba(204, 176, 102, 0.3)')
  gradient.addColorStop(1, 'rgba(204, 176, 102, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

