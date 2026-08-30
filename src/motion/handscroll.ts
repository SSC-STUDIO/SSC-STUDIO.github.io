/**
 * 长卷平移 —— 区块级的「展卷」进度
 *
 * 给 [data-handscroll] 区块持续写入两份 CSS 变量：
 *   --scroll-progress  0→1，区块在视口中走过的比例
 *   --scroll-shift     已展开的像素位移（用于内部图层的视差）
 * 只写自定义属性，不直接改 transform —— 具体怎么展卷交给 CSS 决定，
 * 这样每个区块可以有自己的开卷方式。
 */

export type HandscrollOptions = {
  selector?: string
  /** 视差强度：区块内部图层相对滚动的位移系数（vh） */
  parallax?: number
}

type Entry = {
  el: HTMLElement
  parallax: number
}

export function initHandscroll(options: HandscrollOptions = {}): () => void {
  const { selector = '[data-handscroll]', parallax = 12 } = options

  const entries: Entry[] = Array.from(
    document.querySelectorAll<HTMLElement>(selector)
  ).map((el) => ({
    el,
    parallax: Number(el.dataset.handscrollParallax) || parallax,
  }))

  if (!entries.length) return () => {}

  let frame = 0
  let running = true

  const measure = () => {
    const viewport = window.innerHeight || 1

    entries.forEach(({ el, parallax: strength }) => {
      const rect = el.getBoundingClientRect()
      const total = rect.height + viewport

      // 0：区块顶部刚进入视口底部；1：区块底部离开视口顶部
      const passed = viewport - rect.top
      const progress = Math.min(Math.max(passed / total, 0), 1)

      el.style.setProperty('--scroll-progress', progress.toFixed(4))
      el.style.setProperty(
        '--scroll-shift',
        `${((progress - 0.5) * strength).toFixed(3)}vh`
      )
    })
  }

  const loop = () => {
    if (!running) return

    measure()
    frame = requestAnimationFrame(loop)
  }

  const onScroll = () => {
    if (frame) return

    frame = requestAnimationFrame(() => {
      frame = 0
      measure()
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })

  // 首帧立即量一次，避免刚进页面时变量为空
  measure()

  return () => {
    running = false

    if (frame) cancelAnimationFrame(frame)

    window.removeEventListener('scroll', onScroll)
  }
}
