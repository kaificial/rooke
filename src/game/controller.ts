import { AiCancelled } from '../ai/aiPlayer'
import type { AiPlayer } from '../ai/aiPlayer'
import type { AiVisualizer } from '../ai/visualizer'
import { CONFIG } from '../config'
import { Game } from '../core'
import type { Color, Move, Outcome, Square } from '../core'
import type { BoardView } from '../scene/boardView'
import type { Hud } from '../ui/hud/hud'
import { ChessClock } from './clock'

interface Dependencies {
  board: BoardView
  hud: Hud
  /** Null in sandbox mode, where the human plays both sides. */
  ai: AiPlayer | null
  visualizer: AiVisualizer | null
}

const sideName = (color: Color) => (color === 'w' ? 'White' : 'Black')

function describeOutcome(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'checkmate':
      return `Checkmate! ${sideName(outcome.winner)} wins!`
    case 'timeout':
      return `${sideName(outcome.winner)} wins on time`
    case 'draw':
      return {
        stalemate: 'Draw by stalemate',
        'fifty-move': 'Draw by the fifty-move rule',
        repetition: 'Draw by repetition',
        'insufficient-material': 'Draw: not enough material',
      }[outcome.reason]
  }
}

/**
 * Runs one game: turns player input into moves, keeps the rules, the 3D
 * board, the clocks and the HUD in step, and hands the engine its turn.
 *
 * The rules live in `Game`, the pictures in `BoardView`; this class only
 * decides what happens when, and is the one place that knows about both.
 */
export class GameController {
  private readonly game = new Game()
  private readonly board: BoardView
  private readonly hud: Hud
  private readonly ai: AiPlayer | null
  private readonly visualizer: AiVisualizer | null
  private readonly clock: ChessClock

  private started = false
  /** True while a move is animating, the engine is thinking or a promotion is being chosen. */
  private busy = false
  private selected: Square | null = null
  private selectedMoves: Move[] = []
  private thoughtsShown = true

  constructor(deps: Dependencies) {
    this.board = deps.board
    this.hud = deps.hud
    this.ai = deps.ai
    this.visualizer = deps.visualizer

    this.clock = new ChessClock(CONFIG.clock.seconds, {
      onTick: (color, seconds) => this.hud.clocks.setTime(color, seconds),
      onFlag: (color) => this.endGame(this.game.flag(color)),
    })

    this.board.setPosition(this.game.position)
    this.hud.material.update(this.game.position)
    this.hud.sidebar.setStatus('Press Start to play')
  }

  /** The Start button: begins the clocks and allows moves. */
  start(): void {
    if (this.started) return
    this.started = true
    this.hud.sidebar.markStarted()
    this.hud.sidebar.setStatus(this.statusText())
    this.clock.start(this.game.turn)
    this.hud.clocks.setActive(this.game.turn)
  }

  get thoughtsVisible(): boolean {
    return this.thoughtsShown
  }

  toggleThoughts(): void {
    this.thoughtsShown = !this.thoughtsShown
    this.hud.sidebar.setThoughtsShown(this.thoughtsShown)
    this.hud.log.setEnabled(this.thoughtsShown)
    this.visualizer?.setVisible(this.thoughtsShown)
  }

  /** A tap on the 3D canvas, in client coordinates. */
  handleTap(clientX: number, clientY: number): void {
    if (!this.playerCanMove()) return

    const pick = this.board.pick(clientX, clientY)

    if (pick?.kind === 'target' && this.selected !== null) {
      void this.playerMove(pick.square)
      return
    }

    if (pick?.kind === 'piece') {
      const piece = this.board.pieceAt(pick.square)
      if (piece && piece.color === this.game.turn) {
        this.select(pick.square)
        return
      }
    }
    this.deselect()
  }

  private playerCanMove(): boolean {
    if (!this.started || this.busy || this.game.outcome) return false
    return this.ai === null || this.game.turn !== this.ai.color
  }

  private select(square: Square): void {
    this.selected = square
    this.selectedMoves = this.game.legalMovesFrom(square)
    this.board.select(square)
    this.board.showTargets([...new Set(this.selectedMoves.map((move) => move.to))])
  }

  private deselect(): void {
    this.selected = null
    this.selectedMoves = []
    this.board.select(null)
    this.board.clearTargets()
  }

  private async playerMove(target: Square): Promise<void> {
    const options = this.selectedMoves.filter((move) => move.to === target)
    if (options.length === 0) return

    let move = options[0]
    if (options.some((option) => option.promotion)) {
      this.busy = true
      const choice = await this.hud.sidebar.askPromotion(this.game.turn)
      move = options.find((option) => option.promotion === choice) ?? move
      this.busy = false
    }

    await this.commit(move)
    await this.continueGame()
  }

  /** Plays a legal move in the rules, then shows it on the board. */
  private async commit(move: Move): Promise<void> {
    if (this.game.outcome) return // e.g. a flag fell while a promotion was being chosen
    this.busy = true
    this.deselect()

    const played = this.game.play(move)
    this.hud.sidebar.addMove(played)

    if (this.game.outcome) {
      this.endGame(this.game.outcome)
    } else {
      this.clock.switchTo(this.game.turn)
      this.hud.clocks.setActive(this.game.turn)
      this.hud.sidebar.setStatus(this.statusText())
    }

    await this.board.applyMove(played.move)
    this.hud.material.update(this.game.position)
    this.busy = false
  }

  /** After a move: if it is the engine's turn, let it play. */
  private async continueGame(): Promise<void> {
    if (!this.ai || this.game.outcome || this.game.turn !== this.ai.color) return

    this.busy = true
    this.hud.sidebar.setStatus(`${this.statusText()} - thinking...`)
    try {
      const move = await this.ai.chooseMove(this.game.position, this.game.previousPositionHashes())
      if (!move || this.game.outcome) return
      await this.commit(move)
    } catch (error) {
      if (error instanceof AiCancelled) return
      console.error('The engine failed to move:', error)
      this.hud.sidebar.setStatus('The engine ran into an error')
    } finally {
      this.busy = false
    }
  }

  private endGame(outcome: Outcome): void {
    this.clock.stop()
    this.ai?.cancel()
    this.visualizer?.clear()
    this.hud.clocks.setActive(null)
    this.hud.sidebar.setStatus(describeOutcome(outcome))
  }

  private statusText(): string {
    return `${sideName(this.game.turn)}'s Turn${this.game.inCheck ? ' (CHECK)' : ''}`
  }
}
