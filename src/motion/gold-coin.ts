/**
 * 弹金币 —— 外圆内方的金铜钱，给荣誉区抛洒用。
 * 纯路径，不读位图；明暗主题用同一套金赭，只调明度。
 */

export type CoinStyle = {
  x: number
  y: number
  r: number
  rotation: number
  alpha: number
  contrasted?: boolean
}

export type CoinBody = {
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

const GOLD_LIGHT = { r: 232, g: 201, b: 106 }
const GOLD_MID = { r: 196, g: 152, b: 42 }
const GOLD_DARK = { r: 122, g: 86, b: 18 }
const GOLD_EDGE = { r: 88, g: 58, b: 10 }

function rgba(
  c: { r: number; g: number; b: number },
  a: number,
  lift = 0
): string {
  const k = 1 + lift
  return `rgba(${Math.min(255, c.r * k)}, ${Math.min(255, c.g * k)}, ${Math.min(255, c.b * k)}, ${a})`
}

/** 在 ctx 当前坐标系画一枚铜钱（中心在 origin 之前需自行 translate） */
export function drawGoldCoin(
  ctx: CanvasRenderingContext2D,
  style: CoinStyle
): void {
  const { x, y, r, rotation, alpha, contrasted } = style
  const radius = Math.max(6, r)
  const a = Math.max(0, Math.min(1, alpha))
  const lift = contrasted ? 0.18 : 0
  const hole = radius * 0.28

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.globalAlpha = a

  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fillStyle = rgba(GOLD_MID, 1, lift)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.strokeStyle = rgba(GOLD_EDGE, 0.95, lift)
  ctx.lineWidth = Math.max(1.1, radius * 0.08)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2)
  ctx.strokeStyle = rgba(GOLD_LIGHT, 0.72, lift)
  ctx.lineWidth = Math.max(0.8, radius * 0.045)
  ctx.stroke()

  ctx.beginPath()
  ctx.rect(-hole, -hole, hole * 2, hole * 2)
  ctx.fillStyle = rgba(GOLD_DARK, 1, lift * 0.4)
  ctx.fill()
  ctx.strokeStyle = rgba(GOLD_EDGE, 0.9, lift)
  ctx.lineWidth = Math.max(0.9, radius * 0.06)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(-radius * 0.28, -radius * 0.32, radius * 0.42, Math.PI * 1.05, Math.PI * 1.75)
  ctx.strokeStyle = rgba(GOLD_LIGHT, 0.55, lift)
  ctx.lineWidth = Math.max(1, radius * 0.09)
  ctx.lineCap = 'round'
  ctx.stroke()

  ctx.restore()
}

/** 从一点炸开若干枚金币，带弹跳与重力 */
export function spawnCoinBurst(
  x: number,
  y: number,
  count: number,
  floor: number
): CoinBody[] {
  const coins: CoinBody[] = []

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.35
    const speed = 6 + Math.random() * 9

    coins.push({
      x,
      y,
      r: 9 + Math.random() * 11,
      vx: Math.cos(angle) * speed * (0.55 + Math.random() * 0.7),
      vy: Math.sin(angle) * speed - 4,
      vr: (Math.random() * 2 - 1) * 14,
      spin: Math.random() * 360,
      life: 0,
      maxLife: 70 + Math.random() * 40,
      bounce: 0,
      floor: floor + Math.random() * 18,
    })
  }

  return coins
}

export function stepCoin(coin: CoinBody): boolean {
  coin.life += 1
  coin.vy += 0.42
  coin.x += coin.vx
  coin.y += coin.vy
  coin.spin += coin.vr
  coin.vx *= 0.992

  if (coin.y + coin.r > coin.floor && coin.vy > 0 && coin.bounce < 3) {
    coin.y = coin.floor - coin.r
    coin.vy *= -0.52
    coin.vx *= 0.78
    coin.vr *= 0.7
    coin.bounce += 1
  }

  return coin.life < coin.maxLife && coin.y < coin.floor + 220
}

export function coinAlpha(coin: CoinBody): number {
  const t = coin.life / coin.maxLife
  if (t < 0.12) return t / 0.12
  if (t > 0.72) return Math.max(0, 1 - (t - 0.72) / 0.28)
  return 1
}

export function isContrastedTheme(): boolean {
  return document.documentElement.classList.contains('theme-contrasted')
}
