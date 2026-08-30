/**
 * idle-anim — 视口外暂停装饰性无限动画
 *
 * 站点的水墨装饰（雾霭漂移、竹影摇晃、涟漪扩散、梅枝呼吸、云纹流动…）
 * 都是 CSS infinite 循环。长页滚动离开视口后它们仍在每帧提交合成，
 * 白白消耗 CPU/GPU。这里用 Web Animations API 找出 iterations = Infinity
 * 的动画，由 IntersectionObserver 在离屏时置为 paused、回屏时恢复。
 *
 * 注意：伪元素动画（::before / ::after）的 effect.target 是宿主元素，
 * 对宿主设置 animation-play-state 会一并暂停，符合预期。
 */

/** 暂停标记：写在行内样式上，优先级高于任何类选择器 */
const PAUSED = 'paused'

/** 观察缓冲：提前 180px 恢复，避免滚入瞬间才启动的突兀感 */
const DEFAULT_ROOT_MARGIN = '180px 0px'

/** 不应对其做全局暂停的宿主（这些元素上的动画几乎总在视口内） */
const SKIP_TAGS = new Set(['HTML', 'BODY'])

type Cleanup = () => void

/**
 * 收集页面上所有无限循环动画的宿主元素
 */
function collectInfiniteHosts(): Set<HTMLElement> {
  const hosts = new Set<HTMLElement>()

  if (typeof document.getAnimations !== 'function') return hosts

  for (const animation of document.getAnimations()) {
    const effect = animation.effect

    if (!effect) continue

    const timing = effect.getComputedTiming?.() ?? null
    const iterations = timing ? timing.iterations : 1

    if (iterations !== Infinity) continue

    const target = effect.target

    if (!(target instanceof HTMLElement)) continue
    if (SKIP_TAGS.has(target.tagName)) continue

    hosts.add(target)
  }

  return hosts
}

/**
 * 建立「离屏暂停」观察。返回清理函数（切页 / 卸载时调用）。
 * @param rootMargin 视口缓冲
 */
export function watchIdleAnimations(
  rootMargin: string = DEFAULT_ROOT_MARGIN
): Cleanup {
  const observed = new Set<HTMLElement>()
  let stopped = false

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const el = entry.target as HTMLElement

              el.style.animationPlayState = entry.isIntersecting ? '' : PAUSED
            })
          },
          { rootMargin }
        )
      : null

  const scan = () => {
    if (stopped || !observer) return

    for (const host of collectInfiniteHosts()) {
      if (observed.has(host)) continue

      observed.add(host)
      observer.observe(host)
    }
  }

  scan()

  // 延迟复扫：React 孤岛与骨架屏在挂载后才产生动画
  const rescan = window.setTimeout(scan, 1000)

  return () => {
    stopped = true
    window.clearTimeout(rescan)

    if (observer) {
      observed.forEach((host) => {
        // 复原行内状态，避免把 paused 留在被替换前的旧节点上
        host.style.animationPlayState = ''
        observer.unobserve(host)
      })

      observer.disconnect()
    }

    observed.clear()
  }
}

/**
 * 是否支持该能力（用于优雅降级判断）
 */
export function supportsIdleAnimations(): boolean {
  return (
    typeof document.getAnimations === 'function' &&
    typeof IntersectionObserver === 'function'
  )
}
