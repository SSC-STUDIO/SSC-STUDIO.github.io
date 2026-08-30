/**
 * 册页翻页 —— 卡片随指针沿中缝轻翻
 *
 * 不是常见的 3D 大角度倾斜：只沿「册页中缝」做极小幅度的翻转与受光变化，
 * 像手指拂过一册装裱好的册页。角度上限刻意压得很低（默认 3.2deg），
 * 保证低端机上也不掉帧。
 */

const DEG = 3.2

export function initLeafFlip(selector = '[data-leaf]'): () => void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))

  if (!elements.length) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // 触屏没有 hover，指针跟随无意义
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches

  if (reduced || !finePointer) return () => {}

  const cleanups: Array<() => void> = []

  elements.forEach((el) => {
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()

      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5

      el.style.setProperty('--leaf-ry', `${(x * DEG * 2).toFixed(2)}deg`)
      el.style.setProperty('--leaf-rx', `${(-y * DEG).toFixed(2)}deg`)
      el.style.setProperty('--leaf-sheen', `${(0.5 - x).toFixed(3)}`)
    }

    const onEnter = () => el.classList.add('is-leaf-live')

    const onLeave = () => {
      el.classList.remove('is-leaf-live')
      el.style.setProperty('--leaf-ry', '0deg')
      el.style.setProperty('--leaf-rx', '0deg')
    }

    el.addEventListener('pointerenter', onEnter, { passive: true })
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })

    cleanups.push(() => {
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    })
  })

  return () => cleanups.forEach((fn) => fn())
}
