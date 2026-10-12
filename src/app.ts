import { AiClient } from './ai/aiClient'
import { AiPlayer } from './ai/aiPlayer'
import { AiVisualizer } from './ai/visualizer'
import { CONFIG } from './config'
import { GameController } from './game/controller'
import type { GameMode } from './game/mode'
import { listenForTaps } from './game/tapInput'
import type { BoardView } from './scene/boardView'
import type { Stage } from './scene/stage'
import { Hud } from './ui/hud/hud'

/** Assembles everything a game needs for the chosen mode and starts listening for input. */
export function launchGame(mode: GameMode, stage: Stage, board: BoardView): void {
  const vsAi = mode === 'ai'

  let controller: GameController | null = null
  const hud = new Hud(
    {
      onStart: () => controller?.start(),
      onExit: () => window.location.reload(),
      onToggleThoughts: () => controller?.toggleThoughts(),
    },
    { clockSeconds: CONFIG.clock.seconds, showThoughtsToggle: vsAi },
  )
  hud.mount()

  let ai: AiPlayer | null = null
  let visualizer: AiVisualizer | null = null
  if (vsAi) {
    visualizer = new AiVisualizer(stage, board)
    ai = new AiPlayer({
      client: new AiClient(),
      visualizer,
      log: hud.log,
      color: CONFIG.ai.color,
      maxDepth: CONFIG.ai.maxDepth,
      thinkTimeMs: CONFIG.ai.thinkTimeMs,
      thoughtsVisible: () => controller?.thoughtsVisible ?? true,
    })
  }

  controller = new GameController({ board, hud, ai, visualizer })
  const game = controller
  listenForTaps(stage.renderer.domElement, (x, y) => game.handleTap(x, y))
}
