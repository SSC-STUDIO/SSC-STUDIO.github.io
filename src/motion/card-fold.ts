/**
 * 册页折角 —— 项目 / 文章目录卡的真 3D 倾斜
 *
 * 比 leaf-flip 的中缝轻翻更大一档：perspective + preserve-3d，
 * 指针带动整张卡侧转，右上折角随受光掀起。只写 CSS 变量，
 * 具体角度与折页交给样式。触屏 / reduced-motion 不绑。
 */

import { prefersReducedMotion } from './core'

const RX = 11
const RY = 14

export function initCardFold(selector = '[data-fold]'): () => void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
  if (!elements.length) return () => {}

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (prefersReducedMotion() || !fine) return () => {}

  const cleanups: Array<() => void> = []

  elements.forEach((el) => {
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const x = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5
      const y = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5

      const sheen = (0.5 - x).toFixed(3)
      el.style.setProperty('--fold-ry', `${(x * RY * 2).toFixed(2)}deg`)
      el.style.setProperty('--fold-rx', `${(-y * RX).toFixed(2)}deg`)
      el.style.setProperty('--fold-sheen', sheen)
      el.style.setProperty('--leaf-sheen', sheen)
      el.style.setProperty('--fold-ear', (0.35 + Math.max(0, x) * 0.9).toFixed(3))
      el.classList.add('is-fold-live', 'is-sheen-live')
    }

    const onLeave = () => {
      el.classList.remove('is-fold-live', 'is-sheen-live')
      el.style.setProperty('--fold-ry', '0deg')
      el.style.setProperty('--fold-rx', '0deg')
      el.style.setProperty('--fold-sheen', '0.5')
      el.style.setProperty('--leaf-sheen', '0.5')
      el.style.setProperty('--fold-ear', '0')
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })

    cleanups.push(() => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.classList.remove('is-fold-live', 'is-sheen-live')
      el.style.removeProperty('--fold-ry')
      el.style.removeProperty('--fold-rx')
      el.style.removeProperty('--fold-sheen')
      el.style.removeProperty('--leaf-sheen')
      el.style.removeProperty('--fold-ear')
    })
  })

  return () => cleanups.forEach((fn) => fn())
}
