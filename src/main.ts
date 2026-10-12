import './styles/base.css'
import './styles/landing.css'
import './styles/hud.css'

import { launchGame } from './app'
import { Position } from './core'
import { BoardView } from './scene/boardView'
import { createStage } from './scene/stage'
import { showLanding } from './ui/landing/landing'

// The 3D scene is built right away and sits behind the home page, so picking a
// mode feels instant.
const container = document.querySelector<HTMLElement>('#app')
if (!container) throw new Error('Missing #app container')

const stage = createStage(container)
const board = new BoardView(stage)
board.setPosition(Position.start())

showLanding((mode) => launchGame(mode, stage, board))
