import type { Color, PlayedMove, PromotionType } from '../../core'
import { fromHtml, query } from '../dom'

export interface SidebarEvents {
  onStart(): void
  onExit(): void
  onToggleThoughts(): void
}

const PROMOTION_CHOICES: { type: PromotionType; label: string }[] = [
  { type: 'q', label: 'Queen' },
  { type: 'r', label: 'Rook' },
  { type: 'b', label: 'Bishop' },
  { type: 'n', label: 'Knight' },
]

/** Match panel: start/exit, status line, move list, thought toggle and the promotion picker. */
export class Sidebar {
  readonly element: HTMLElement
  private readonly startButton: HTMLButtonElement
  private readonly thoughtsButton: HTMLButtonElement
  private readonly status: HTMLElement
  private readonly moveList: HTMLElement
  private readonly promotionPanel: HTMLElement
  private readonly promotionOptions: HTMLElement

  constructor(events: SidebarEvents, options: { showThoughtsToggle: boolean }) {
    this.element = fromHtml(`
      <div id="ui-sidebar">
        <h2>Match Details</h2>
        <div class="sidebar-actions">
          <button data-ref="start" class="game-btn filled">Start</button>
          <button data-ref="exit" class="game-btn ghost">Exit</button>
        </div>
        <div class="status" data-ref="status"></div>
        <div id="move-history">
          <table>
            <thead><tr><th>#</th><th>W</th><th>B</th></tr></thead>
            <tbody data-ref="moves"></tbody>
          </table>
        </div>
        <div class="sidebar-section" data-ref="thoughts-section">
          <button data-ref="thoughts" class="game-btn gold">Hide AI Thoughts</button>
        </div>
        <div data-ref="promotion" class="promotion-panel" hidden>
          <div class="promotion-title">Pawn Promotion</div>
          <div class="promotion-options" data-ref="promotion-options"></div>
        </div>
      </div>
    `)

    this.startButton = query(this.element, '[data-ref="start"]')
    this.thoughtsButton = query(this.element, '[data-ref="thoughts"]')
    this.status = query(this.element, '[data-ref="status"]')
    this.moveList = query(this.element, '[data-ref="moves"]')
    this.promotionPanel = query(this.element, '[data-ref="promotion"]')
    this.promotionOptions = query(this.element, '[data-ref="promotion-options"]')

    if (!options.showThoughtsToggle) query(this.element, '[data-ref="thoughts-section"]').hidden = true

    this.startButton.addEventListener('click', events.onStart)
    this.thoughtsButton.addEventListener('click', events.onToggleThoughts)
    query(this.element, '[data-ref="exit"]').addEventListener('click', events.onExit)
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.element)
    this.element.style.display = 'block'
  }

  setStatus(text: string): void {
    this.status.textContent = text
  }

  markStarted(): void {
    this.startButton.textContent = 'Game in progress'
    this.startButton.disabled = true
  }

  setThoughtsShown(shown: boolean): void {
    this.thoughtsButton.textContent = shown ? 'Hide AI Thoughts' : 'Show AI Thoughts'
    this.thoughtsButton.style.opacity = shown ? '1' : '0.6'
  }

  addMove(played: Pick<PlayedMove, 'san' | 'color' | 'moveNumber'>): void {
    if (played.color === 'w') {
      const row = document.createElement('tr')
      for (const text of [`${played.moveNumber}.`, played.san, '']) {
        const cell = document.createElement('td')
        cell.textContent = text
        row.appendChild(cell)
      }
      this.moveList.appendChild(row)
    } else {
      const last = this.moveList.lastElementChild
      if (last) last.children[2].textContent = played.san
    }
    this.moveList.parentElement?.parentElement?.scrollTo({ top: Number.MAX_SAFE_INTEGER })
  }

  /** Shows the piece picker and resolves with the player's choice. */
  askPromotion(color: Color): Promise<PromotionType> {
    return new Promise((resolve) => {
      this.promotionOptions.replaceChildren()
      for (const { type, label } of PROMOTION_CHOICES) {
        const option = document.createElement('div')
        option.className = 'promotion-btn'
        option.dataset.color = color
        option.textContent = label
        option.addEventListener('click', () => {
          this.promotionPanel.hidden = true
          resolve(type)
        })
        this.promotionOptions.appendChild(option)
      }
      this.promotionPanel.hidden = false
    })
  }
}
