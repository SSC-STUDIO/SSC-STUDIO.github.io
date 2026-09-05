/**
 * 立体「森」—— three.js 程序化挤出
 *
 * 把 SenMark 十二笔（三木：横 / 竖 / 撇 / 捺）收成圆角条，
 * ExtrudeGeometry 推出墨体。不读外部模型或字体。
 * 本模块只被 InkSen3D 动态 import，three 走独立 chunk。
 */

import * as THREE from 'three'

export type SenHandle = {
  setPointer: (nx: number, ny: number) => void
  dragBy: (dx: number, dy: number) => void
  setTheme: (contrasted: boolean) => void
  resize: () => void
  wake: () => void
  pause: () => void
  renderOnce: () => void
  dispose: () => void
}

type Stroke = {
  x1: number
  y1: number
  x2: number
  y2: number
  weight: number
  z: number
}

/** SenMark viewBox 0–280，与 SVG 十二笔同一套坐标 */
const STROKES: Stroke[] = [
  { x1: 96, y1: 62, x2: 184, y2: 62, weight: 0.168, z: 0.07 },
  { x1: 140, y1: 24, x2: 140, y2: 128, weight: 0.172, z: 0.07 },
  { x1: 138, y1: 68, x2: 100, y2: 116, weight: 0.138, z: 0.05 },
  { x1: 142, y1: 68, x2: 180, y2: 116, weight: 0.138, z: 0.05 },
  { x1: 40, y1: 190, x2: 128, y2: 190, weight: 0.168, z: -0.04 },
  { x1: 84, y1: 146, x2: 84, y2: 262, weight: 0.172, z: -0.04 },
  { x1: 82, y1: 196, x2: 46, y2: 250, weight: 0.138, z: -0.06 },
  { x1: 86, y1: 196, x2: 122, y2: 250, weight: 0.138, z: -0.06 },
  { x1: 152, y1: 190, x2: 240, y2: 190, weight: 0.168, z: 0.02 },
  { x1: 196, y1: 146, x2: 196, y2: 262, weight: 0.172, z: 0.02 },
  { x1: 194, y1: 196, x2: 158, y2: 250, weight: 0.138, z: 0 },
  { x1: 198, y1: 196, x2: 234, y2: 250, weight: 0.138, z: 0 },
]

const UNIT = 88
const DEPTH = 0.46
const REST_RX = -0.28
const REST_RY = 0.48

function mapX(x: number) {
  return (x - 140) / UNIT
}

function mapY(y: number) {
  return (140 - y) / UNIT
}

function roundedBar(length: number, width: number): THREE.Shape {
  const shape = new THREE.Shape()
  const hw = width / 2
  const hl = length / 2
  const r = Math.min(hw * 0.92, hl * 0.45)

  shape.moveTo(-hw + r, -hl)
  shape.lineTo(hw - r, -hl)
  shape.absarc(hw - r, -hl + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(hw, hl - r)
  shape.absarc(hw - r, hl - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-hw + r, hl)
  shape.absarc(-hw + r, hl - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-hw, -hl + r)
  shape.absarc(-hw + r, -hl + r, r, Math.PI, Math.PI * 1.5, false)
  shape.closePath()
  return shape
}

function inkCanvas(contrasted: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = contrasted ? '#d8cfc0' : '#1a241c'
  ctx.fillRect(0, 0, 64, 64)

  for (let i = 0; i < 90; i++) {
    const a = contrasted ? 0.08 + Math.random() * 0.1 : 0.05 + Math.random() * 0.12
    ctx.fillStyle = contrasted
      ? `rgba(244, 234, 216, ${a})`
      : `rgba(42, 58, 48, ${a})`
    ctx.beginPath()
    ctx.arc(Math.random() * 64, Math.random() * 64, 1.2 + Math.random() * 7, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvas
}

function readCssColor(name: string, fallback: string): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  if (!raw) return new THREE.Color(fallback).getHex()
  return new THREE.Color(raw).getHex()
}

export function canUseWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

/** 触屏 / 省流 / 少核：不拉 three，留给静态森标 */
export function isLowPower(): boolean {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean }
  }).connection
  if (connection?.saveData) return true
  if (window.matchMedia('(pointer: coarse)').matches) return true
  if ((navigator.hardwareConcurrency || 8) <= 3) return true
  return false
}

export function mountSen3D(
  canvas: HTMLCanvasElement,
  opts: { reduced?: boolean } = {}
): SenHandle | null {
  if (!canUseWebGL()) return null

  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item)
    return item
  }

  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
      stencil: false,
    })
  } catch {
    return null
  }

  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 24)
  camera.position.set(0, 0.12, 5.35)
  camera.lookAt(0, 0.04, 0)

  const root = new THREE.Group()
  scene.add(root)

  let inkTex = track(new THREE.CanvasTexture(inkCanvas(false)))
  inkTex.colorSpace = THREE.SRGBColorSpace
  inkTex.wrapS = THREE.RepeatWrapping
  inkTex.wrapT = THREE.RepeatWrapping

  const faceMat = track(
    new THREE.MeshLambertMaterial({
      color: 0x1c2a22,
      map: inkTex,
    })
  )
  const sideMat = track(
    new THREE.MeshLambertMaterial({
      color: 0x3a4a40,
    })
  )

  const strokeGroup = new THREE.Group()
  root.add(strokeGroup)

  for (const stroke of STROKES) {
    const x1 = mapX(stroke.x1)
    const y1 = mapY(stroke.y1)
    const x2 = mapX(stroke.x2)
    const y2 = mapY(stroke.y2)
    const length = Math.hypot(x2 - x1, y2 - y1)
    const geo = track(
      new THREE.ExtrudeGeometry(roundedBar(length, stroke.weight), {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: stroke.weight * 0.14,
        bevelSize: stroke.weight * 0.1,
        bevelSegments: 2,
        curveSegments: 7,
      })
    )
    geo.center()
    const mesh = new THREE.Mesh(geo, [faceMat, sideMat])
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, stroke.z)
    mesh.rotation.z = Math.atan2(x2 - x1, y2 - y1)
    strokeGroup.add(mesh)
  }

  const plinthGeo = track(new THREE.BoxGeometry(3.05, 0.1, 1.55))
  const plinthMat = track(
    new THREE.MeshLambertMaterial({
      color: 0xeee1c4,
    })
  )
  const plinth = new THREE.Mesh(plinthGeo, plinthMat)
  plinth.position.set(0, -1.62, 0)
  root.add(plinth)

  const paper = new THREE.AmbientLight(0xf4ead8, 0.7)
  const key = new THREE.DirectionalLight(0xefe6d4, 0.48)
  key.position.set(-2.1, 3.2, 3.4)
  const fill = new THREE.DirectionalLight(0x3d5a66, 0.1)
  fill.position.set(2.6, 0.2, 1.4)
  scene.add(paper, key, fill)

  let contrasted = false
  const applyTheme = (next: boolean) => {
    contrasted = next
    inkTex.dispose()
    inkTex = track(new THREE.CanvasTexture(inkCanvas(next)))
    inkTex.colorSpace = THREE.SRGBColorSpace
    faceMat.map = inkTex
    faceMat.color.setHex(next ? 0xefe6d4 : 0x1c2a22)
    faceMat.needsUpdate = true
    sideMat.color.setHex(next ? 0x8a9a90 : 0x3a4a40)
    plinthMat.color.setHex(readCssColor('--color-paper-warm', next ? '#2c2718' : '#eee1c4'))
    paper.color.setHex(next ? 0x3d4a44 : 0xf4ead8)
    paper.intensity = next ? 0.42 : 0.7
    key.intensity = next ? 0.38 : 0.48
  }

  applyTheme(document.documentElement.classList.contains('theme-contrasted'))

  let aimRx = REST_RX
  let aimRy = REST_RY
  let curRx = REST_RX
  let curRy = REST_RY
  let extraRx = 0
  let extraRy = 0
  let raf = 0
  let alive = true
  let paused = false

  const fit = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const paint = () => {
    root.rotation.x = curRx + extraRx
    root.rotation.y = curRy + extraRy
    renderer.render(scene, camera)
  }

  const tick = () => {
    raf = 0
    if (!alive || paused) return

    curRx += (aimRx - curRx) * 0.12
    curRy += (aimRy - curRy) * 0.12
    paint()

    const settled =
      Math.abs(aimRx - curRx) < 0.0008 && Math.abs(aimRy - curRy) < 0.0008
    if (!settled) raf = requestAnimationFrame(tick)
  }

  const wake = () => {
    if (!alive) return
    paused = false
    if (raf) return
    raf = requestAnimationFrame(tick)
  }

  fit()
  paint()
  if (!opts.reduced) wake()

  return {
    setPointer(nx, ny) {
      if (opts.reduced) return
      aimRx = REST_RX - ny * 0.62
      aimRy = REST_RY + nx * 0.92
      wake()
    },
    dragBy(dx, dy) {
      if (opts.reduced) return
      extraRy += dx * 0.012
      extraRx += dy * 0.01
      extraRx = Math.max(-0.7, Math.min(0.7, extraRx))
      wake()
    },
    setTheme: applyTheme,
    resize() {
      fit()
      paint()
    },
    wake,
    pause() {
      paused = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    },
    renderOnce() {
      paused = false
      paint()
    },
    dispose() {
      alive = false
      paused = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      scene.clear()
      disposables.forEach((item) => {
        try {
          item.dispose()
        } catch {
          /* 几何或材质可能已随 renderer 释放 */
        }
      })
      renderer.dispose()
      renderer.forceContextLoss()
      const gl = renderer.getContext()
      const lose = gl.getExtension('WEBGL_lose_context')
      lose?.loseContext()
    },
  }
}
