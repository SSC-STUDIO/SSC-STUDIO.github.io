/**
 * 画布上的「森」印 —— 朱砂方章，给关于区抛洒用。
 * 纯路径，不读位图，明暗主题都跟 currentColor。
 */

export type ChopStyle = {
  fill: string
  size: number
  x: number
  y: number
  rotation: number
  alpha: number
}

const STEM = [
  // 上木：横、竖、撇、捺
  [
    [0.18, 0.28, 0.82, 0.28],
    [0.5, 0.1, 0.5, 0.48],
    [0.5, 0.3, 0.28, 0.48],
    [0.5, 0.3, 0.72, 0.48],
  ],
  // 左下木
  [
    [0.08, 0.68, 0.46, 0.68],
    [0.27, 0.5, 0.27, 0.9],
    [0.27, 0.7, 0.1, 0.9],
    [0.27, 0.7, 0.44, 0.9],
  ],
  // 右下木
  [
    [0.54, 0.68, 0.92, 0.68],
    [0.73, 0.5, 0.73, 0.9],
    [0.73, 0.7, 0.56, 0.9],
    [0.73, 0.7, 0.9, 0.9],
  ],
] as const

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** 在 ctx 当前变换下画一枚森印（中心在 origin） */
export function drawSenChop(
  ctx: CanvasRenderingContext2D,
  style: ChopStyle
): void {
  const { fill, size, x, y, rotation, alpha } = style
  const s = Math.max(8, size)

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.strokeStyle = fill
  ctx.fillStyle = fill
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const half = s / 2
  roundRect(ctx, -half, -half, s, s, s * 0.08)
  ctx.lineWidth = Math.max(1.2, s * 0.055)
  ctx.stroke()

  ctx.beginPath()
  ctx.lineWidth = Math.max(1.4, s * 0.07)
  for (const wood of STEM) {
    for (const [x1, y1, x2, y2] of wood) {
      ctx.moveTo(-half + x1 * s, -half + y1 * s)
      ctx.lineTo(-half + x2 * s, -half + y2 * s)
    }
  }
  ctx.stroke()

  ctx.restore()
}

/** 读当前主题的朱砂色，抛洒时跟页面一起翻色 */
export function chopAccentColor(el: Element = document.documentElement): string {
  const raw = getComputedStyle(el).getPropertyValue('--color-accent').trim()
  return raw || '#c23a2b'
}
