/**
 * 研墨开卷 —— 首页入场编排
 *
 * 三幕：墨滴落纸洇开 → 「润森」印钤下并落款 → 卷帘收起放出正文。
 * 全程 Web Animations API，任何一步异常都立刻放行页面，
 * 绝不让访客被卡在开场后面。
 */

import { prefersReducedMotion } from './core'

const INTRO_SEEN_KEY = 'site-intro-seen'

/** 缓动曲线：落墨（快出缓收）/ 钤印（带一点回弹）/ 收卷（两头缓） */
const EASE_BLOT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_STAMP = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const EASE_ROLL = 'cubic-bezier(0.65, 0, 0.35, 1)'

export function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
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

/**
 * 放行页面（幂等）：撤掉开场层与滚动锁，正文立即可见。
 * 也是开场的兜底出口 —— 无论哪一幕失败都落到这里。
 */
export function revealSiteNow(): void {
  const root = document.documentElement

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
    const blot = sheet.querySelector<HTMLElement>('.js-intro-blot')
    const mark = sheet.querySelector<HTMLElement>('.js-intro-mark')
    const name = sheet.querySelector<HTMLElement>('.js-intro-name')

    /* 第一幕：墨滴落纸，洇成一团 */
    const acts: Promise<unknown>[] = []

    acts.push(
      play(
        blot,
        [
          { opacity: 0, transform: 'scale(0.18) rotate(-10deg)' },
          { opacity: 0.92, transform: 'scale(1) rotate(0deg)' },
        ],
        { duration: 560, easing: EASE_BLOT, fill: 'forwards' }
      )
    )

    /* 第二幕：印章钤下（略大按小，微微回正），落款竖排浮现 */
    acts.push(
      play(
        mark,
        [
          { opacity: 0, transform: 'scale(1.32) rotate(4deg)' },
          { opacity: 1, transform: 'scale(1) rotate(-1.2deg)' },
        ],
        { duration: 420, delay: 260, easing: EASE_STAMP, fill: 'forwards' }
      )
    )

    acts.push(
      play(
        name,
        [
          { opacity: 0, transform: 'translateY(0.4rem)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 380, delay: 480, easing: EASE_BLOT, fill: 'forwards' }
      )
    )

    await Promise.all(acts)

    /* 幕间气口 */
    await new Promise((resolve) => setTimeout(resolve, 320))

    /* 第三幕：卷帘上收。纸面自下而上卷走，轴杆随卷边上行；
       正文在纸后同步显影 */
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
        duration: 520,
        delay: 140,
        easing: 'ease-out',
        fill: 'forwards',
      }).then(() => {
        el.style.opacity = '1'
      })
    })

    const ROLL_MS = 680

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
