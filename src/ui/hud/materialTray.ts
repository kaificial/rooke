import type { Color, PieceType, Position } from '../../core'

const ORDER: readonly PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p']

const ICONS: Readonly<Record<PieceType, string>> = {
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
}

/** The pieces each side still has, shown in the top corners of the screen. */
export class MaterialTray {
  private readonly trays: Record<Color, HTMLElement>

  constructor() {
    this.trays = { w: this.createTray('white-material'), b: this.createTray('black-material') }
  }

  mount(parent: HTMLElement = document.body): void {
    parent.append(this.trays.w, this.trays.b)
  }

  update(position: Position): void {
    const remaining: Record<Color, PieceType[]> = { w: [], b: [] }
    for (const piece of position.board) {
      if (piece) remaining[piece.color].push(piece.type)
    }
    for (const color of ['w', 'b'] as const) {
      remaining[color].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
      this.trays[color].textContent = remaining[color].map((type) => ICONS[type]).join('')
    }
  }

  private createTray(id: string): HTMLElement {
    const tray = document.createElement('div')
    tray.id = id
    return tray
  }
}
