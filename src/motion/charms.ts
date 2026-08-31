/**
 * 彩头 —— 荣誉区弹出物：笑脸为主角（回归老版手感），
 * 混入铜钱 / 梅花 / 朱砂印 / 墨星，随机抛洒。
 *
 * 物理沿用老版笑脸：上抛初速 + 重力下坠 + 随机旋转，
 * 铜钱一系带落地回弹。绘制全走 canvas，主题只调明度或换位图。
 */

import { drawGoldCoin } from './gold-coin'

export type CharmKind = 'smiley' | 'coin' | 'plum' | 'seal' | 'star'

export type CharmBody = {
  kind: CharmKind
  /** 印章上钤的字（仅 seal 用） */
  char?: string
  x: number
  y: number
  r: number
  vx: number
  vy: number
  vr: number
  spin: number
  life: number
  maxLife: number
  bounce: number
  floor: number
}

export type CharmImages = {
  main: HTMLImageElement
  contrasted: HTMLImageElement
}

/** 抛洒权重：笑脸是主角，其余作彩头点缀 */
const KIND_POOL: { kind: CharmKind; weight: number }[] = [
  { kind: 'smiley', weight: 42 },
  { kind: 'coin', weight: 20 },
  { kind: 'plum', weight: 13 },
  { kind: 'seal', weight: 13 },
  { kind: 'star', weight: 12 },
]

const SEAL_CHARS = ['佳', '妙', '赞', '润', '森']

const INK = { r: 28, g: 42, b: 34 }
const INK_LIGHT = { r: 239, g: 230, b: 212 }
const ZHUSHA = { r: 194, g: 58, b: 43 }
const XUAN = { r: 244, g: 234, b: 216 }

function rgba(c: { r: number; g: number; b: number }, a: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`
}

function pickKind(): CharmKind {
  const total = KIND_POOL.reduce((sum, item) => sum + item.weight, 0)
  let roll = Math.random() * total

  for (const item of KIND_POOL) {
    roll -= item.weight
    if (roll <= 0) return item.kind
  }

  return 'smiley'
}

/** 预载两套主题的笑脸位图 */
export function loadCharmImages(): CharmImages {
  const main = new Image(100, 100)
  main.src = '/images/asset-smiley--main.svg'

  const contrasted = new Image(100, 100)
  contrasted.src = '/images/asset-smiley--contrasted.svg'

  return { main, contrasted }
}

/**
 * 从一点炸开一簇彩头。
 * 手感对齐老版笑脸：横向 ±5、上抛 5~15、旋转 ±10°/帧；
 * 第一颗强制笑脸，保证「回归笑脸」的记忆点。
 */
export function spawnCharmBurst(
  x: number,
  y: number,
  count: number,
  floor: number
): CharmBody[] {
  const charms: CharmBody[] = []

  for (let i = 0; i < count; i++) {
    const kind = i === 0 ? 'smiley' : pickKind()
    const sizeBase =
      kind === 'smiley' ? 12 + Math.random() * 12 : 9 + Math.random() * 10

    charms.push({
      kind,
      char:
        kind === 'seal'
          ? SEAL_CHARS[Math.floor(Math.random() * SEAL_CHARS.length)]
          : undefined,
      x,
      y,
      r: sizeBase,
      vx: (Math.random() * 2 - 1) * 5,
      vy: Math.random() * -10 - 5,
      vr: (Math.random() * 2 - 1) * 10,
      spin: Math.random() * 360,
      life: 0,
      maxLife: 75 + Math.random() * 45,
      bounce: 0,
      floor: floor + Math.random() * 18,
    })
  }

  return charms
}

/** 步进：重力 + 旋转；铜钱与印章带一次落地回弹 */
export function stepCharm(charm: CharmBody): boolean {
  charm.life += 1
  charm.vy += 0.45
  charm.x += charm.vx
  charm.y += charm.vy
  charm.spin += charm.vr
  charm.vx *= 0.992

  const bouncy = charm.kind === 'coin' || charm.kind === 'seal'
  if (
    bouncy &&
    charm.y + charm.r > charm.floor &&
    charm.vy > 0 &&
    charm.bounce < 2
  ) {
    charm.y = charm.floor - charm.r
    charm.vy *= -0.5
    charm.vx *= 0.78
    charm.vr *= 0.7
    charm.bounce += 1
  }

  return charm.life < charm.maxLife && charm.y < charm.floor + 260
}

/** 生灭透明度：快进快出，别让残影拖手感 */
export function charmAlpha(charm: CharmBody): number {
  const t = charm.life / charm.maxLife
  if (t < 0.1) return t / 0.1
  if (t > 0.7) return Math.max(0, 1 - (t - 0.7) / 0.3)
  return 1
}

function drawPlum(
  ctx: CanvasRenderingContext2D,
  r: number,
  contrasted: boolean
): void {
  const petal = r * 0.62

  ctx.fillStyle = rgba(ZHUSHA, contrasted ? 0.92 : 0.85)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.arc(Math.cos(angle) * r * 0.52, Math.sin(angle) * r * 0.52, petal, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.beginPath()
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
  ctx.fillStyle = rgba(contrasted ? INK_LIGHT : XUAN, 0.95)
  ctx.fill()
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  r: number,
  char: string,
  contrasted: boolean
): void {
  const half = r * 0.92
  const radius = r * 0.22

  ctx.beginPath()
  ctx.roundRect(-half, -half, half * 2, half * 2, radius)
  ctx.fillStyle = rgba(ZHUSHA, contrasted ? 0.95 : 0.9)
  ctx.fill()
  ctx.strokeStyle = rgba({ r: 148, g: 38, b: 26 }, 0.9)
  ctx.lineWidth = Math.max(1, r * 0.09)
  ctx.stroke()

  ctx.fillStyle = rgba(XUAN, 0.96)
  ctx.font = `700 ${Math.round(r * 1.15)}px "Noto Serif SC", "SimSun", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(char, 0, r * 0.06)
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  r: number,
  contrasted: boolean
): void {
  const ink = contrasted ? INK_LIGHT : INK

  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const outer = (i / 5) * Math.PI * 2 - Math.PI / 2
    const inner = outer + Math.PI / 5
    const ox = Math.cos(outer) * r
    const oy = Math.sin(outer) * r
    if (i === 0) ctx.moveTo(ox, oy)
    else ctx.lineTo(ox, oy)
    ctx.lineTo(Math.cos(inner) * r * 0.46, Math.sin(inner) * r * 0.46)
  }
  ctx.closePath()

  ctx.fillStyle = rgba(ink, 0.16)
  ctx.fill()
  ctx.strokeStyle = rgba(ink, 0.85)
  ctx.lineWidth = Math.max(1.1, r * 0.11)
  ctx.lineJoin = 'round'
  ctx.stroke()
}

/** 绘制一枚彩头（含平移 / 旋转 / 透明度） */
export function drawCharm(
  ctx: CanvasRenderingContext2D,
  charm: CharmBody,
  images: CharmImages,
  contrasted: boolean
): void {
  const alpha = charmAlpha(charm)
  if (alpha <= 0) return

  if (charm.kind === 'coin') {
    drawGoldCoin(ctx, {
      x: charm.x,
      y: charm.y,
      r: charm.r,
      rotation: charm.spin,
      alpha,
      contrasted,
    })
    return
  }

  ctx.save()
  ctx.translate(charm.x, charm.y)
  ctx.rotate((charm.spin * Math.PI) / 180)
  ctx.globalAlpha = alpha

  if (charm.kind === 'smiley') {
    const image = contrasted ? images.contrasted : images.main
    const size = charm.r * 2
    if (image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, -charm.r, -charm.r, size, size)
    }
  } else if (charm.kind === 'plum') {
    drawPlum(ctx, charm.r, contrasted)
  } else if (charm.kind === 'seal') {
    drawSeal(ctx, charm.r, charm.char ?? '佳', contrasted)
  } else {
    drawStar(ctx, charm.r, contrasted)
  }

  ctx.restore()
}

export function isContrastedTheme(): boolean {
  return document.documentElement.classList.contains('theme-contrasted')
}
