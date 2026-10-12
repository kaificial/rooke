const MAX_TAP_MS = 300
const MAX_TAP_DISTANCE_PX = 10

/**
 * Calls `onTap` for a quick press-and-release in roughly the same spot, and
 * ignores drags. That keeps orbiting the camera from being read as a click,
 * and works the same for mouse and touch.
 */
export function listenForTaps(target: HTMLElement, onTap: (clientX: number, clientY: number) => void): void {
  let downAt = 0
  let downX = 0
  let downY = 0

  target.addEventListener('pointerdown', (event) => {
    downAt = Date.now()
    downX = event.clientX
    downY = event.clientY
  })

  target.addEventListener('pointerup', (event) => {
    const quick = Date.now() - downAt < MAX_TAP_MS
    const still = Math.hypot(event.clientX - downX, event.clientY - downY) < MAX_TAP_DISTANCE_PX
    if (quick && still) onTap(event.clientX, event.clientY)
  })
}
