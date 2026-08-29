/**
 * motion — 动效偏好工具
 * CSS 侧已有 prefers-reduced-motion 覆盖；此处供 GSAP 等 JS 动画在
 * 创建时间线前做同一判断，保证 reduced-motion 下不播长时间轴。
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
