/**
 * 研墨开卷 —— 首页入场编排
 *
 * 四幕：墨滴落纸 → 森字「木→林→森」错峰长出 → 落款钤印 → 卷帘收起。
 * 全程 Web Animations API，任何一步异常都立刻放行页面，
 * 绝不让访客被卡在开场后面。
 *
 * 只在本次浏览的首次硬加载播放；站内 SPA 换页不再全屏开场。
 */

import { prefersReducedMotion } from './core'

const INTRO_SEEN_KEY = 'site-intro-seen'

/** 缓动：落墨（快出缓收）/ 钤印（微回弹）/ 收卷（两头缓）/ 长出（笔锋落纸） */
const EASE_BLOT = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EASE_STAMP = 'cubic-bezier(0.34, 1.4, 0.64, 1)'
const EASE_ROLL = 'cubic-bezier(0.65, 0, 0.35, 1)'
const EASE_GROW = 'cubic-bezier(0.4, 0.02, 0.2, 1)'

/** 森标 CSS 生长总时长（末笔 880ms + 170ms），给气口 */
const SEN_GROW_MS = 1120

let hardLoadConsumed = false

export function hasSeenIntro(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 消耗「本次浏览的硬加载」资格。astro:page-load 首次为硬载，之后皆为 SPA。
 * 必须无条件调用一次，避免短路上首页时误播全屏森字。
 */
export function consumeHardLoad(): boolean {
  if (hardLoadConsumed) return false
  hardLoadConsumed = true
  return true
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
    const sen = sheet.querySelector<HTMLElement>('.js-intro-sen')
    const name = sheet.querySelector<HTMLElement>('.js-intro-name')
    const seal = sheet.querySelector<HTMLElement>('.js-intro-seal')
    const stages = sheet.querySelectorAll<HTMLElement>('.js-intro-stage [data-glyph]')
    const specks = sheet.querySelectorAll<HTMLElement>('.js-intro-bleed .ink-intro__speck')

    /* 第一幕：墨滴落纸，洇成一团 */
    const acts: Promise<unknown>[] = [
      play(
        blot,
        [
          { opacity: 0, transform: 'scale(0.18) rotate(-8deg)' },
          { opacity: 0.9, transform: 'scale(1) rotate(0deg)' },
        ],
        { duration: 400, easing: EASE_BLOT, fill: 'forwards' }
      ),
    ]

    /* 第二幕：森标淡入（不缩放整字），三木按 CSS 笔顺错峰长出 */
    acts.push(
      play(
        mark,
        [
          { opacity: 0 },
          { opacity: 1 },
        ],
        { duration: 200, delay: 70, easing: EASE_GROW, fill: 'forwards' }
      )
    )

    sen?.classList.add('sen-mark--grow')

    /* 木 → 林 → 森：题字与墨点跟着三木错峰洇开 */
    const stageAt = [280, 680, 980]
    stages.forEach((el, i) => {
      acts.push(
        play(
          el,
          [
            { opacity: 0, transform: 'translateY(0.35em)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 280,
            delay: stageAt[i] ?? 280,
            easing: EASE_BLOT,
            fill: 'forwards',
          }
        )
      )
    })

    specks.forEach((el, i) => {
      acts.push(
        play(
          el,
          [
            { opacity: 0, transform: 'scale(0.2)' },
            { opacity: 0.72, transform: 'scale(1)' },
            { opacity: 0.38, transform: 'scale(1.12)' },
          ],
          {
            duration: 520,
            delay: stageAt[i] ?? 280,
            easing: EASE_BLOT,
            fill: 'forwards',
          }
        )
      )
    })

    /* 第三幕：落款竖排，小印钤在森成之后 */
    acts.push(
      play(
        name,
        [
          { opacity: 0, transform: 'translateY(0.4rem)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 300, delay: 1000, easing: EASE_BLOT, fill: 'forwards' }
      )
    )

    acts.push(
      play(
        seal,
        [
          { opacity: 0, transform: 'scale(1.18) rotate(6deg)' },
          { opacity: 1, transform: 'scale(1) rotate(-1.4deg)' },
        ],
        { duration: 300, delay: 1080, easing: EASE_STAMP, fill: 'forwards' }
      )
    )

    acts.push(wait(SEN_GROW_MS))

    await Promise.all(acts)

    /* 森成、钤印之后留半息，再收卷，避免刚看清就被卷走 */
    await wait(220)

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
