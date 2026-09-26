import * as THREE from 'three'

export type SurfaceTextures = {
  asphalt: THREE.CanvasTexture
  stucco: THREE.CanvasTexture
  wood: THREE.CanvasTexture
  roof: THREE.CanvasTexture
  blossomCarpet: THREE.CanvasTexture
  bark: THREE.CanvasTexture
  dispose(): void
}

type Rgb = readonly [number, number, number]
type PaintedCanvas = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

const TAU = Math.PI * 2

function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function hash(x: number, y: number, seed: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function canvas(size: number, alpha = false): PaintedCanvas {
  const element = document.createElement('canvas')
  element.width = element.height = size
  const ctx = element.getContext('2d', { alpha })
  if (!ctx) throw new Error('Canvas 2D context is unavailable')
  return { canvas: element, ctx }
}

function pixelBase(
  painted: PaintedCanvas,
  color: Rgb,
  seed: number,
  tone: (x: number, y: number, size: number) => number,
) {
  const { ctx } = painted
  const size = painted.canvas.width
  const image = ctx.createImageData(size, size)
  const data = image.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4
      const value = tone(x, y, size) + (hash(x, y, seed) - 0.5) * 13
      data[offset] = color[0] + value
      data[offset + 1] = color[1] + value
      data[offset + 2] = color[2] + value
      data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

function texture(painted: PaintedCanvas): THREE.CanvasTexture {
  const map = new THREE.CanvasTexture(painted.canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.magFilter = THREE.LinearFilter
  map.anisotropy = 4
  return map
}

function asphaltCanvas(): PaintedCanvas {
  const painted = canvas(512)
  pixelBase(painted, [70, 82, 94], 1187, (x, y, size) =>
    Math.sin(TAU * x * 3 / size) * Math.cos(TAU * y * 2 / size) * 3.8
    + Math.sin(TAU * (x * 11 + y * 7) / size) * 1.4,
  )
  const { ctx } = painted
  const next = random(504)
  for (let i = 0; i < 4200; i++) {
    const x = next() * 512
    const y = next() * 512
    ctx.fillStyle = next() > 0.48 ? 'rgba(204,211,210,.10)' : 'rgba(20,30,41,.12)'
    ctx.fillRect(x, y, 0.4 + next() * 1.6, 0.4 + next() * 1.3)
  }
  for (let i = 0; i < 7; i++) {
    let x = 50 + next() * 410
    let y = 50 + next() * 410
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let segment = 0; segment < 5; segment++) {
      x += (next() - 0.5) * 18
      y += 7 + next() * 8
      ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(24,34,44,.17)'
    ctx.lineWidth = 0.7 + next() * 0.5
    ctx.stroke()
  }
  return painted
}

function stuccoCanvas(): PaintedCanvas {
  const painted = canvas(512)
  pixelBase(painted, [220, 224, 220], 833, (x, y, size) =>
    Math.sin(TAU * x * 4 / size) * Math.cos(TAU * y * 3 / size) * 1.7,
  )
  const { ctx } = painted
  for (let y = 0; y < 512; y += 32) {
    ctx.fillStyle = 'rgba(73,89,94,.12)'
    ctx.fillRect(0, y, 512, 1)
    ctx.fillStyle = 'rgba(255,255,250,.23)'
    ctx.fillRect(0, y + 1, 512, 1)
  }
  return painted
}

function woodCanvas(): PaintedCanvas {
  const painted = canvas(512)
  pixelBase(painted, [231, 223, 207], 1701, (x, y, size) => {
    const board = Math.floor(x / 128)
    const wave = Math.sin(TAU * (x * 25 / size + Math.sin(TAU * y * 2 / size) * 0.12))
    return wave * 4.1 + Math.sin(TAU * x * 62 / size) * 1.7 + (board % 2 ? -3 : 2)
  })
  const { ctx } = painted
  for (let x = 0; x < 512; x += 128) {
    ctx.fillStyle = 'rgba(71,65,59,.2)'
    ctx.fillRect(x, 0, 2, 512)
    ctx.fillStyle = 'rgba(244,211,176,.18)'
    ctx.fillRect(x + 3, 0, 1, 512)
  }
  const next = random(752)
  for (let i = 0; i < 26; i++) {
    const x = 12 + next() * 486
    const y = next() * 512
    ctx.beginPath()
    ctx.ellipse(x, y, 2 + next() * 3, 9 + next() * 15, (next() - 0.5) * 0.16, 0, TAU)
    ctx.strokeStyle = 'rgba(83,70,61,.13)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  return painted
}

function roofCanvas(): PaintedCanvas {
  const painted = canvas(512)
  pixelBase(painted, [70, 76, 79], 355, (x, y, size) =>
    Math.sin(TAU * x * 7 / size) * Math.cos(TAU * y * 5 / size) * 2.1,
  )
  const { ctx } = painted
  const next = random(322)
  for (let row = 0; row < 8; row++) {
    const y = row * 64
    const shift = row % 2 ? 32 : 0
    ctx.fillStyle = 'rgba(17,28,35,.28)'
    ctx.fillRect(0, y, 512, 2)
    ctx.fillStyle = 'rgba(210,212,203,.12)'
    ctx.fillRect(0, y + 3, 512, 2)
    for (let x = -64 + shift; x < 512; x += 64) {
      ctx.fillStyle = next() > 0.5 ? 'rgba(173,179,174,.06)' : 'rgba(26,36,42,.08)'
      ctx.fillRect(x + 2, y + 6, 60, 54)
      ctx.fillStyle = 'rgba(21,30,36,.22)'
      ctx.fillRect(x, y + 2, 1, 58)
    }
  }
  return painted
}

function blossomCarpetCanvas(): PaintedCanvas {
  const painted = canvas(1024, true)
  const { ctx } = painted
  const next = random(1725)
  const size = 1024
  const clusters: Array<[number, number, number, number, number]> = [
    [95, 116, 210, 130, 640], [446, 91, 240, 108, 580], [818, 135, 196, 124, 650],
    [235, 358, 200, 152, 680], [675, 375, 230, 126, 650], [990, 490, 160, 200, 450],
    [44, 695, 190, 160, 570], [402, 662, 260, 154, 780], [798, 734, 246, 160, 770],
    [227, 953, 208, 130, 590], [612, 1010, 228, 136, 670],
  ]

  // Discrete petals leave asphalt between the clusters, including up close.
  const shades: Rgb[] = [[255, 226, 235], [248, 194, 212], [241, 161, 190], [255, 239, 240], [235, 170, 199]]
  function petal(x: number, y: number, width: number, height: number, angle: number, shade: Rgb, alpha: number) {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const points: Array<[number, number]> = [
      [-0.52 * width, -0.25 * height], [-0.14 * width, -0.58 * height],
      [0.58 * width, -0.32 * height], [0.47 * width, 0.44 * height],
      [-0.3 * width, 0.53 * height],
    ]
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      const px = x + points[i][0] * cosine - points[i][1] * sine
      const py = y + points[i][0] * sine + points[i][1] * cosine
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = `rgba(${shade[0]},${shade[1]},${shade[2]},${alpha})`
    ctx.fill()
  }

  function wrappedPetal(x: number, y: number, width: number, height: number, angle: number, shade: Rgb, alpha: number) {
    const xs = x < 8 ? [0, size] : x > size - 8 ? [0, -size] : [0]
    const ys = y < 8 ? [0, size] : y > size - 8 ? [0, -size] : [0]
    for (const dx of xs) for (const dy of ys) petal(x + dx, y + dy, width, height, angle, shade, alpha)
  }

  for (const [cx, cy, rx, ry, count] of clusters) {
    for (let i = 0; i < Math.round(count * 3.8); i++) {
      const radius = Math.sqrt(-2 * Math.log(Math.max(next(), 0.00001)))
      const angle = next() * TAU
      const dx = Math.cos(angle) * radius * rx * 0.46
      const dy = Math.sin(angle) * radius * ry * 0.46
      const distance = Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
      if (distance > 1.23) continue
      const x = ((cx + dx) % size + size) % size
      const y = ((cy + dy) % size + size) % size
      const alpha = distance < 1 ? 0.74 + next() * 0.26 : 0.35 + next() * 0.35
      wrappedPetal(x, y, 3.2 + next() * 5.2, 1.9 + next() * 3.2, next() * TAU, shades[Math.floor(next() * shades.length)], alpha)
    }
  }
  for (let i = 0; i < 480; i++) {
    wrappedPetal(next() * size, next() * size, 1.3 + next() * 2.4, 0.8 + next() * 1.5,
      next() * TAU, shades[Math.floor(next() * shades.length)], 0.32 + next() * 0.3)
  }
  return painted
}

function barkCanvas(): PaintedCanvas {
  const painted = canvas(512)
  pixelBase(painted, [205, 197, 197], 905, (x, y, size) => {
    const bend = Math.sin(TAU * y * 2 / size) * 3.4 + Math.sin(TAU * y * 5 / size) * 1.2
    return Math.sin(TAU * (x + bend) * 19 / size) * 5.2
      + Math.sin(TAU * (x - bend * 0.6) * 43 / size) * 2.4
  })
  const { ctx } = painted
  const next = random(144)
  for (let i = 0; i < 44; i++) {
    const base = next() * 512
    const phase = next() * TAU
    for (const shift of [-512, 0, 512]) {
      ctx.beginPath()
      for (let y = 0; y <= 512; y += 9) {
        const x = base + shift + Math.sin(TAU * y * 2 / 512 + phase) * 3.2 + Math.sin(TAU * y * 5 / 512 + phase) * 1.1
        if (y === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = i % 3 ? 'rgba(34,30,36,.17)' : 'rgba(194,170,163,.13)'
      ctx.lineWidth = 0.6 + next() * 1.3
      ctx.stroke()
    }
  }
  return painted
}

export function makeSurfaceTextures(): SurfaceTextures {
  const asphalt = texture(asphaltCanvas())
  const stucco = texture(stuccoCanvas())
  const wood = texture(woodCanvas())
  const roof = texture(roofCanvas())
  const blossomCarpet = texture(blossomCarpetCanvas())
  const bark = texture(barkCanvas())
  const maps = [asphalt, stucco, wood, roof, blossomCarpet, bark]
  return { asphalt, stucco, wood, roof, blossomCarpet, bark, dispose: () => maps.forEach(map => map.dispose()) }
}
