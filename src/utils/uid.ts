/**
 * uid — 生成跨组件实例唯一的 DOM id（SVG defs/pattern/clipPath 用）
 * Astro frontmatter 每个实例独立执行，实例级计数器会同页撞号；
 * 模块级自增 + 随机后缀兜底（防 dev HMR 重渲染撞号）。
 */
let counter = 0

export const uid = (prefix: string): string =>
  `${prefix}-${++counter}-${Math.random().toString(36).slice(2, 7)}`
