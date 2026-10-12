import { CONFIG } from '../../config'
import type { GameMode } from '../../game/mode'
import { fromHtml, query } from '../dom'
import { mountVoxelRook } from './voxelRook'

const FADE_OUT_MS = 800

const MARKUP = `
  <div id="landing-page">
    <div class="ambient-glow"></div>

    <nav>
      <div class="nav-logo">
        <div class="nav-logo-icon">
          <img src="/logo-new.svg" alt="Rooke logo">
        </div>
      </div>
      <div class="nav-links">
        <a href="${CONFIG.links.github}" target="_blank" rel="noopener">GitHub</a>
        <a href="${CONFIG.links.github}#readme" target="_blank" rel="noopener">About</a>
        <a href="${CONFIG.links.portfolio}" target="_blank" rel="noopener">Portfolio</a>
      </div>
      <div class="nav-actions">
        <button data-mode="sandbox" class="nav-btn ghost">Sandbox</button>
        <button data-mode="ai" class="nav-btn filled">Play vs AI</button>
      </div>
    </nav>

    <div class="hero-wrap">
      <div class="hero-text">
        <div class="tagline">3D Chess Engine. See the AI think.</div>
        <h1>Rooke<span class="accent">Engine</span></h1>
        <p class="subtitle">A 3D chess experience built with TypeScript, Three.js, and Vite. Challenge the AI or play in sandbox mode.</p>
        <div class="actions">
          <button data-mode="ai" class="landing-btn filled">Versus AI</button>
          <button data-mode="sandbox" class="landing-btn primary">Sandbox Game</button>
        </div>
      </div>

      <div class="hero-visual">
        <svg data-ref="rook" id="svg-rook-canvas" viewBox="-200 -250 400 500"></svg>
      </div>
    </div>

    <div class="landing-footer">
      <div class="footer-label">Built with</div>
      <div class="footer-techs">
        <span class="tech-badge"><span class="tech-icon">&#9670;</span> TypeScript</span>
        <span class="tech-badge"><span class="tech-icon">&#9650;</span> Three.js</span>
        <span class="tech-badge"><span class="tech-icon">&#9671;</span> Vite</span>
        <span class="tech-badge"><span class="tech-icon">&#9820;</span> GSAP</span>
      </div>
    </div>
  </div>
`

/**
 * Shows the home page. When the player picks a mode it fades out, removes
 * itself and calls `onSelect`.
 */
export function showLanding(onSelect: (mode: GameMode) => void): void {
  const page = fromHtml(MARKUP)
  document.body.appendChild(page)
  mountVoxelRook(query(page, '[data-ref="rook"]'))

  let chosen = false
  page.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (chosen) return
      chosen = true
      const mode = button.dataset.mode as GameMode

      page.style.transition = `opacity ${FADE_OUT_MS}ms ease`
      page.style.opacity = '0'
      window.setTimeout(() => {
        page.remove()
        onSelect(mode)
      }, FADE_OUT_MS)
    })
  })
}
