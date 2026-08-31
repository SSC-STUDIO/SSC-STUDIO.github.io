/**
 * 洇墨显影 —— 元素入场如墨落宣纸
 *
 * 与常见的「上移淡入」不同：内容自中心以圆形墨迹向外洇开，
 * 边缘带着极轻的位移，像一滴墨在纸上慢慢化开。
 * 动画结束后移除 clip-path，避免裁掉卡片悬停时的投影。
 */

const INK_CLASS = 'is-inked'
const INK_DONE = 'is-inked-done'
/** 同屏多个元素时错峰落墨，最多 6 档 */
const STAGGER_STEP = 70

export type InkRevealOptions = {
  selector?: string
  threshold?: number
  rootMargin?: string
}

export function initInkReveal(options: InkRevealOptions = {}): () => void {
  const {
    selector = '[data-reveal]',
    threshold = 0.12,
    rootMargin = '0px 0px -6% 0px',
  } = options

  // 宣告显影管线已接管：撤掉 CSS 侧的 inkFallback 兜底动画。
  // 若模块脚本在此之前崩溃，该类不会被加上，内容 3 秒后自动淡入。
  document.documentElement.classList.add('is-ink-ready')

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(selector)
  )

  if (!elements.length) return () => {}

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduced || typeof IntersectionObserver !== 'function') {
    elements.forEach((el) => {
      el.classList.add(INK_CLASS, INK_DONE)
    })

    return () => {}
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const el = entry.target as HTMLElement

        el.classList.add(INK_CLASS)
        observer.unobserve(el)

        // 墨迹化开后撤去裁切，悬停投影才不会被切掉
        el.addEventListener(
          'animationend',
          () => el.classList.add(INK_DONE),
          { once: true }
        )
      })
    },
    { threshold, rootMargin }
  )

  elements.forEach((el, index) => {
    el.style.setProperty(
      '--reveal-delay',
      `${Math.min(index % 6, 5) * STAGGER_STEP}ms`
    )

    observer.observe(el)
  })

  return () => observer.disconnect()
}
