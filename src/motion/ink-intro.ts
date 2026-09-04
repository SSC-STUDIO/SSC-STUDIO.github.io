/**
 * 研墨开卷 —— 首页入场编排
 *
 * 宣纸与「木→林→森」由 CSS 随首屏 is-intro-active 开演，不等人模块。
 * JS 只负责森成之后钤印、卷帘。任何一步异常都立刻放行页面。
 *
 * 只在本次浏览的首次硬加载播放；站内 SPA 换页不再全屏开场。
 */

import { prefersReducedMotion } from './core'

declare global {
  interface Window {
    __siteRevealed?: number
    __siteHardLoadConsumed?: boolean
  }
}

const INTRO_SEEN_KEY = 'site-intro-seen'

/** 缓动：落款 / 钤印（微回弹）/ 收卷（两头缓） */
const EASE_BLOT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_STAMP = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const EASE_ROLL = 'cubic-bezier(0.65, 0, 0.35, 1)'

/** 对齐导航起点：森成后再钤，避免只看见印 */
const SEAL_AT_MS = 1220
const ROLL_AT_MS = 1680

export function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markRevealed(): void {
  try {
    window.__siteRevealed = 1
  } catch {
    /* ignore */
  }
}

export function wasRevealed(): boolean {
  try {
    return window.__siteRevealed === 1
  } catch {
    return false
  }
}

/**
 * 消耗「本次浏览的硬加载」资格。挂在 window 上，避免模块热更后资格被重置、
 * SPA 回首页又播全屏森字。必须无条件调用一次。
 */
export function consumeHardLoad(): boolean {
  try {
    if (window.__siteHardLoadConsumed) return false
    window.__siteHardLoadConsumed = true
    return true
  } catch {
    return false
  }
}

function rememberIntro(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* 隐私模式下记不住就每次都播，无伤 */
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 放行页面（幂等）：撤掉开场层与滚动锁，正文立即可见。
 * 也是开场的兜底出口 —— 无论哪一幕失败都落到这里。
 */
export function revealSiteNow(): void {
  const root = document.documentElement

  markRevealed()
  root.classList.add('is-site-ready')
  root.classList.remove('is-scroll-blocked', 'is-intro-active')

  const wrapper = document.querySelector<HTMLElement>('.js-site-wrapper')
  if (wrapper) {
    wrapper.style.opacity = '1'
    wrapper.classList.remove('is-preparing')
  }

  for (const selector of ['.site-head', '.s-hero', '.js-mount']) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) el.style.opacity = '1'
  }

  document.querySelector('.js-intro')?.remove()

  document.dispatchEvent(new CustomEvent('intro'))
}

/** 单段动画：包一层 try，失败当作立即完成 */
function play(
  el: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions
): Promise<unknown> {
  if (!el) return Promise.resolve()

  try {
    return el.animate(keyframes, options).finished.catch(() => {})
  } catch {
    return Promise.resolve()
  }
}

/**
 * 播放开场。返回的 Promise 在页面放行后兑现。
 * 元素缺失 / 已看过 / 减少动态 → 直接放行。
 */
export async function playInkIntro(): Promise<void> {
  const intro = document.querySelector<HTMLElement>('.js-intro')
  const sheet = intro?.querySelector<HTMLElement>('.js-intro-sheet')
  const rod = intro?.querySelector<HTMLElement>('.js-intro-rod')

  if (!intro || !sheet || !rod || hasSeenIntro() || prefersReducedMotion()) {
    revealSiteNow()
    return
  }

  try {
    const name = sheet.querySelector<HTMLElement>('.js-intro-name')
    const seal = sheet.querySelector<HTMLElement>('.js-intro-seal')

    /* 宣纸 / 墨洇 / 三木生长已由 CSS 从首帧开演。等森成再钤印。 */
    await wait(Math.max(0, SEAL_AT_MS - performance.now()))

    await Promise.all([
      play(
        name,
        [
          { opacity: 0, transform: 'translateY(0.4rem)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 280, easing: EASE_BLOT, fill: 'forwards' }
      ),
      play(
        seal,
        [
          { opacity: 0, transform: 'scale(1.18) rotate(6deg)' },
          { opacity: 1, transform: 'scale(1) rotate(-1.4deg)' },
        ],
        { duration: 300, easing: EASE_STAMP, fill: 'forwards' }
      ),
    ])

    await wait(Math.max(120, ROLL_AT_MS - performance.now()))

    /* 第四幕：卷帘上收。纸面自下而上卷走，轴杆随卷边上行 */
    document.documentElement.classList.add('is-site-ready')

    const wrapper = document.querySelector<HTMLElement>('.js-site-wrapper')
    if (wrapper) {
      wrapper.style.opacity = '1'
      wrapper.classList.remove('is-preparing')
    }

    document.dispatchEvent(new CustomEvent('intro'))

    const fadeTargets = ['.site-head', '.s-hero', '.js-mount']
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((el): el is HTMLElement => !!el)

    fadeTargets.forEach((el) => {
      play(el, [{ opacity: 0 }, { opacity: 1 }], {
        duration: 480,
        delay: 120,
        easing: 'ease-out',
        fill: 'forwards',
      }).then(() => {
        el.style.opacity = '1'
      })
    })

    const ROLL_MS = 480

    await Promise.all([
      play(
        sheet,
        [
          { clipPath: 'inset(0 0 0 0)' },
          { clipPath: 'inset(0 0 100% 0)' },
        ],
        { duration: ROLL_MS, easing: EASE_ROLL, fill: 'forwards' }
      ),
      play(
        rod,
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-100vh)', opacity: 1 },
        ],
        { duration: ROLL_MS, easing: EASE_ROLL, fill: 'forwards' }
      ),
    ])
  } catch (error) {
    console.error('[ink-intro] 开场中断，直接放行：', error)
  }

  rememberIntro()
  revealSiteNow()
}
