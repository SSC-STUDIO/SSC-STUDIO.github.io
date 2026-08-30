/**
 * 站点运行时核心 —— 信号与帧循环
 *
 * 设计立场与中心化的「大管家类」相反：不设全局发号台，
 * 每一类信号（帧 / 视口 / 滚动 / 指针）自己管理原生监听的挂载与摘除——
 * 首个订阅者出现才挂监听，最后一个退订即摘除，闲置时零开销。
 * 所有订阅一律返回取消函数，换页清理就是把取消函数逐个执行，
 * 与自定义元素的 disconnectedCallback 天然对齐。
 */

export type Cleanup = () => void

/* ------------------------------------------------------------------ *
 * 帧循环：原生 rAF 驱动。标签页隐藏时 rAF 自动挂起，
 * 恢复可见后的首帧 delta 会被钳制，动画不会瞬间跳变。
 * ------------------------------------------------------------------ */

/** 单帧间隔上限（毫秒）：切回标签页时把积压时间折叠掉 */
const MAX_DELTA = 100
const FALLBACK_DELTA = 1000 / 60

const frameHandlers = new Set<(time: number, delta: number) => void>()
let rafId = 0
let lastTime = 0
let currentDelta = FALLBACK_DELTA

function frameLoop(now: number) {
  currentDelta = Math.min(now - lastTime || FALLBACK_DELTA, MAX_DELTA)
  lastTime = now

  frameHandlers.forEach((fn) => {
    try {
      fn(now, currentDelta)
    } catch (error) {
      console.error('[core] frame handler failed:', error)
    }
  })

  rafId = frameHandlers.size ? requestAnimationFrame(frameLoop) : 0
}

/** 每帧回调，返回取消函数；最后一个订阅者退订后循环自动停摆 */
export function onFrame(fn: (time: number, delta: number) => void): Cleanup {
  frameHandlers.add(fn)

  if (!rafId) {
    lastTime = performance.now()
    rafId = requestAnimationFrame(frameLoop)
  }

  return () => {
    frameHandlers.delete(fn)
    if (!frameHandlers.size && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}

/** 当前帧间隔（毫秒），供拿不到闭包 delta 的场合读取 */
export function frameDelta(): number {
  return currentDelta
}

/** 下一帧执行一次 */
export function nextFrame(fn: () => void): void {
  requestAnimationFrame(() => {
    try {
      fn()
    } catch (error) {
      console.error('[core] nextFrame callback failed:', error)
    }
  })
}

/* ------------------------------------------------------------------ *
 * 信号工厂：把一个原生事件包装成可多播的订阅点。
 * 挂载/摘除由订阅计数驱动，派发时单个订阅者抛错不炸整条链。
 * ------------------------------------------------------------------ */

function multicast<T>(mount: (push: (value: T) => void) => Cleanup) {
  const listeners = new Set<(value: T) => void>()
  let unmount: Cleanup | null = null

  return (fn: (value: T) => void): Cleanup => {
    listeners.add(fn)

    if (!unmount) {
      unmount = mount((value) => {
        listeners.forEach((listener) => {
          try {
            listener(value)
          } catch (error) {
            console.error('[core] signal handler failed:', error)
          }
        })
      })
    }

    return () => {
      listeners.delete(fn)
      if (!listeners.size && unmount) {
        unmount()
        unmount = null
      }
    }
  }
}

export type ViewportSize = { width: number; height: number }

/** 视口尺寸变化（rAF 合帧，一帧至多派发一次） */
export const onResize = multicast<ViewportSize>((push) => {
  let scheduled = false

  const handler = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      push({ width: window.innerWidth, height: window.innerHeight })
    })
  }

  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
})

/** 页面滚动，参数为 window.scrollY（passive + rAF 合帧） */
export const onScroll = multicast<number>((push) => {
  let scheduled = false

  const handler = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      push(window.scrollY)
    })
  }

  window.addEventListener('scroll', handler, { passive: true })
  return () => window.removeEventListener('scroll', handler)
})

export type PointerPos = { x: number; y: number }

/** 指针移动（不合帧：消费方常要即时坐标，节流自行决定） */
export const onPointer = multicast<PointerPos>((push) => {
  const handler = (e: PointerEvent) => push({ x: e.clientX, y: e.clientY })

  window.addEventListener('pointermove', handler, { passive: true })
  return () => window.removeEventListener('pointermove', handler)
})

/* ------------------------------------------------------------------ *
 * 就绪闩：首屏入场落幕后由壳层扳动一次，此后保持闩合。
 * 依赖首屏完成再启动的组件用 whenReady 排队，
 * 闩合之后到达的回调立即执行（SPA 换页后新元素也能正常初始化）。
 * ------------------------------------------------------------------ */

let ready = false
const readyQueue: Array<() => void> = []

export function markReady(): void {
  if (ready) return
  ready = true

  while (readyQueue.length) {
    const fn = readyQueue.shift()!
    try {
      fn()
    } catch (error) {
      console.error('[core] ready callback failed:', error)
    }
  }
}

export function whenReady(fn: () => void): void {
  if (ready) {
    try {
      fn()
    } catch (error) {
      console.error('[core] ready callback failed:', error)
    }
    return
  }

  readyQueue.push(fn)
}

export function isReady(): boolean {
  return ready
}

/* ------------------------------------------------------------------ *
 * 翻色信号：主题明暗切换动画完成后广播，
 * canvas 类组件据此重新取样 CSS 颜色。
 * ------------------------------------------------------------------ */

export type ThemeScheme = 'light' | 'dark'

const themeListeners = new Set<(scheme: ThemeScheme) => void>()

export function onThemeFlip(fn: (scheme: ThemeScheme) => void): Cleanup {
  themeListeners.add(fn)
  return () => themeListeners.delete(fn)
}

export function signalThemeFlip(scheme: ThemeScheme): void {
  themeListeners.forEach((listener) => {
    try {
      listener(scheme)
    } catch (error) {
      console.error('[core] theme handler failed:', error)
    }
  })
}

/* ------------------------------------------------------------------ */

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
