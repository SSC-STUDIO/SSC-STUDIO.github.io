/**
 * 洇墨显影 —— 元素入场如墨落宣纸
 *
 * 与常见的「上移淡入」不同：内容自中心以圆形墨迹向外洇开，
 * 边缘带着极轻的位移，像一滴墨在纸上慢慢化开。
 * 动画结束后移除 clip-path，避免裁掉卡片悬停时的投影。
 */

import { onReducedMotion, prefersReducedMotion } from './core'

const INK_CLASS = 'is-inked'
const INK_DONE = 'is-inked-done'
const READY_CLASS = 'is-ink-ready'
/** 同屏多个元素时错峰落墨，最多 6 档 */
const STAGGER_STEP = 70

export type InkRevealOptions = {
  selector?: string
  threshold?: number
  rootMargin?: string
}

function markReady(): void {
  document.documentElement.classList.add(READY_CLASS)
}

function unmarkReady(): void {
  document.documentElement.classList.remove(READY_CLASS)
}

function finish(el: HTMLElement): void {
  el.classList.add(INK_DONE)
}

function inkNow(el: HTMLElement): void {
  el.classList.add(INK_CLASS, INK_DONE)
}

export function initInkReveal(options: InkRevealOptions = {}): () => void {
  const {
    selector = '[data-reveal]',
    threshold = 0.12,
    rootMargin = '0px 0px -6% 0px',
  } = options

  // 宣告显影管线已接管：撤掉 CSS 侧「未挂门」的 3s 兜底。
  // 未 .is-inked 的元素仍走 2.4s 超时淡入，换页失败也不会永久透明。
  markReady()

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(selector)
  ).filter((el) => !el.classList.contains(INK_CLASS))

  if (!elements.length) return unmarkReady

  const reduced = prefersReducedMotion()

  if (reduced || typeof IntersectionObserver !== 'function') {
    elements.forEach(inkNow)
    return unmarkReady
  }

  const pending = new Set(elements)
  const abort = new AbortController()

  const settle = (el: HTMLElement) => {
    if (!pending.has(el)) return
    pending.delete(el)
    el.classList.add(INK_CLASS)
    observer.unobserve(el)
    el.addEventListener('animationend', () => finish(el), {
      once: true,
      signal: abort.signal,
    })
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        // 比首屏还高的区块永远凑不满比例阈值（一屏只占它的几分之一），
        // 死守 threshold 会让它一辈子显影不了、内容永久隐身。
        const taller = entry.boundingClientRect.height > window.innerHeight

        if (!taller && entry.intersectionRatio < threshold) return

        settle(entry.target as HTMLElement)
      })
    },
    { threshold: [0, threshold], rootMargin }
  )

  elements.forEach((el, index) => {
    el.style.setProperty(
      '--reveal-delay',
      `${Math.min(index % 6, 5) * STAGGER_STEP}ms`
    )
    observer.observe(el)
  })

  /**
   * View Transition 期间旧/新页会被 visibility:hidden，
   * IntersectionObserver 会当成「不在屏」；几何框仍在，按矩形补一次。
   */
  const flushVisible = () => {
    const vh = window.innerHeight || 1
    const vw = window.innerWidth || 1

    pending.forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      if (rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw) {
        settle(el)
      }
    })
  }

  flushVisible()
  const rafA = requestAnimationFrame(() => {
    flushVisible()
    requestAnimationFrame(flushVisible)
  })
  const loadFlush = () => {
    flushVisible()
    window.setTimeout(flushVisible, 80)
  }
  document.addEventListener('astro:page-load', loadFlush)

  const stopReduced = onReducedMotion((prefersReduced) => {
    if (!prefersReduced) return
    pending.forEach(inkNow)
    pending.clear()
    observer.disconnect()
  })

  return () => {
    abort.abort()
    stopReduced()
    observer.disconnect()
    cancelAnimationFrame(rafA)
    document.removeEventListener('astro:page-load', loadFlush)
    pending.clear()
    unmarkReady()
  }
}
