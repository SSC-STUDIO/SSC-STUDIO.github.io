/**
 * 印章钤印 —— 交互反馈如落印
 *
 * 给 [data-seal] 元素挂上按下的涟漪：朱砂圈自触点扩散、轻淡退去，
 * 同时元素本身有一记极短的「压印」位移（按下沉、弹起回）。
 */

const SEAL_RIPPLE = 'seal-ripple'

export function initSealPress(selector = '[data-seal]'): () => void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))

  if (!elements.length) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced) return () => {}

  const cleanups: Array<() => void> = []

  elements.forEach((el) => {
    if (el.dataset.sealReady === '1') return

    el.dataset.sealReady = '1'
    el.style.position = el.style.position || 'relative'
    el.style.overflow = el.style.overflow || 'hidden'

    const onPointerDown = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const ripple = document.createElement('span')

      ripple.className = SEAL_RIPPLE
      ripple.style.left = `${event.clientX - rect.left}px`
      ripple.style.top = `${event.clientY - rect.top}px`

      const size = Math.max(rect.width, rect.height) * 2
      ripple.style.width = `${size}px`
      ripple.style.height = `${size}px`

      el.appendChild(ripple)

      ripple.addEventListener('animationend', () => ripple.remove(), {
        once: true,
      })

      el.classList.add('is-pressed')
    }

    const onPointerUp = () => {
      el.classList.remove('is-pressed')
    }

    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointerleave', onPointerUp, { passive: true })
    el.addEventListener('pointercancel', onPointerUp, { passive: true })

    cleanups.push(() => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointerleave', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.dataset.sealReady = ''
    })
  })

  return () => cleanups.forEach((fn) => fn())
}
