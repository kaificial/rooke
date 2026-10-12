import { AiLog } from './aiLog'
import { Clocks } from './clocks'
import { MaterialTray } from './materialTray'
import { Sidebar } from './sidebar'
import type { SidebarEvents } from './sidebar'

interface HudOptions {
  clockSeconds: number
  /** Only the AI mode has thoughts to hide. */
  showThoughtsToggle: boolean
}

/** Everything drawn over the 3D scene while a game is on. */
export class Hud {
  readonly sidebar: Sidebar
  readonly clocks: Clocks
  readonly material: MaterialTray
  readonly log: AiLog

  constructor(events: SidebarEvents, options: HudOptions) {
    this.sidebar = new Sidebar(events, { showThoughtsToggle: options.showThoughtsToggle })
    this.clocks = new Clocks(options.clockSeconds)
    this.material = new MaterialTray()
    this.log = new AiLog()
  }

  mount(): void {
    this.sidebar.mount()
    this.clocks.mount()
    this.material.mount()
    this.log.mount()
  }
}
