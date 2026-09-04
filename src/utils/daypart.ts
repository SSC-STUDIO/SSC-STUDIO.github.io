/**
 * 时段灯色：晨光 / 白昼 / 暮色 / 夜灯。
 * StudioClock 写钟面，SiteFoot 在全站维持 data-daypart，StudioCard 读同一份。
 */

export type DaypartKey = 'dawn' | 'day' | 'dusk' | 'night'

export type Daypart = {
  key: DaypartKey
  label: string
}

export const DAYPART_DUTY: Record<DaypartKey, string> = {
  dawn: '陈润森 · 晨光值守',
  day: '陈润森 · 白昼在线',
  dusk: '陈润森 · 暮色在班',
  night: '陈润森 · 夜灯值守',
}

export function getDaypart(date: Date = new Date()): Daypart {
  const hour = date.getHours()
  if (hour >= 5 && hour < 8) return { key: 'dawn', label: '晨光' }
  if (hour >= 8 && hour < 17) return { key: 'day', label: '白昼' }
  if (hour >= 17 && hour < 20) return { key: 'dusk', label: '暮色' }
  return { key: 'night', label: '夜灯' }
}

export function formatClockTime(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function applyDaypart(date: Date = new Date()): Daypart {
  const part = getDaypart(date)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-daypart', part.key)
  }
  return part
}

type TickListener = (part: Daypart, date: Date) => void

let started = false
const listeners = new Set<TickListener>()

function emit() {
  const now = new Date()
  const part = applyDaypart(now)
  listeners.forEach((fn) => fn(part, now))
}

/**
 * 整站只走一套分钟对齐的定时器。ClientRouter 下模块只执行一次，
 * 多次调用只是登记回调，不会叠 interval。
 */
export function startDaypartTicker(onTick?: TickListener): void {
  if (onTick) listeners.add(onTick)
  if (typeof window === 'undefined') return

  if (started) {
    emit()
    return
  }

  started = true
  emit()

  const delay = 60000 - (Date.now() % 60000)
  window.setTimeout(() => {
    emit()
    window.setInterval(emit, 60000)
  }, delay)

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) emit()
  })

  /* ClientRouter 会换掉 <html>，属性要在每次换页后写回 */
  document.addEventListener('astro:page-load', emit)
}

export function resolveDaypartKey(): DaypartKey {
  const raw = document.documentElement.getAttribute('data-daypart')
  if (raw === 'dawn' || raw === 'day' || raw === 'dusk' || raw === 'night') {
    return raw
  }
  return getDaypart().key
}
