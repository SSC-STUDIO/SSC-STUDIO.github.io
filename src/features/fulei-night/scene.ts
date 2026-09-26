import * as THREE from 'three'

export type CampusSceneHandle = {
  goTo: (index: number) => void
  resize: () => void
  dispose: () => void
}

type SceneOptions = {
  onReady?: () => void
  onError?: () => void
}

type Stop = {
  camera: THREE.Vector3
  target: THREE.Vector3
  visitors: THREE.Vector3
  heading: number
}

const NOOP_HANDLE: CampusSceneHandle = {
  goTo() {},
  resize() {},
  dispose() {},
}

function makeSignTexture(): THREE.CanvasTexture {
  const surface = document.createElement('canvas')
  surface.width = 1536
  surface.height = 224
  const context = surface.getContext('2d')
  if (!context) throw new Error('Unable to draw the campus sign')

  context.fillStyle = '#bcc6c6'
  context.fillRect(0, 0, surface.width, surface.height)
  context.strokeStyle = 'rgba(65, 82, 87, 0.26)'
  context.lineWidth = 2
  for (let x = 0; x <= surface.width; x += 256) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, surface.height)
    context.stroke()
  }
  context.fillStyle = 'rgba(255, 255, 255, 0.08)'
  context.fillRect(0, 0, surface.width, 12)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = '#1c2627'
  context.font = 'bold 140px "STKaiti", "KaiTi", "SimSun", serif'
  for (const [index, character] of [...'上海市傅雷中学'].entries()) {
    context.fillText(character, 188 + index * 165, 116)
  }

  const texture = new THREE.CanvasTexture(surface)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeGlowTexture(): THREE.CanvasTexture {
  const surface = document.createElement('canvas')
  surface.width = 128
  surface.height = 128
  const context = surface.getContext('2d')
  if (!context) throw new Error('Unable to draw the light glow')
  const glow = context.createRadialGradient(64, 64, 2, 64, 64, 64)
  glow.addColorStop(0, 'rgba(255, 217, 145, 0.52)')
  glow.addColorStop(0.3, 'rgba(247, 183, 99, 0.25)')
  glow.addColorStop(1, 'rgba(255, 182, 86, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(surface)
}

function createStops(portrait: boolean): Stop[] {
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  return [
    {
      camera: point(portrait ? 0.2 : -2.6, portrait ? 3.7 : 3.8, 34),
      target: point(portrait ? 0 : -2.6, portrait ? 3.5 : 3.1, 10.8),
      visitors: point(-0.8, 0, 16.7),
      heading: Math.PI,
    },
    {
      camera: point(0.2, 3.1, 7.7),
      target: point(0, 1.7, -11.5),
      visitors: point(-0.25, 0, -1.4),
      heading: Math.PI,
    },
    {
      camera: point(portrait ? -7.2 : -6.2, 3.3, -14.2),
      target: point(-18, 1.1, -32.4),
      visitors: point(portrait ? -10.3 : -7.6, 0, portrait ? -21 : -19.2),
      heading: -2.6,
    },
    {
      camera: point(portrait ? 2.3 : 0.3, portrait ? 2.2 : 3.5, -18.7),
      target: point(8.2, portrait ? 3.7 : 4.9, -30.5),
      visitors: point(portrait ? 5 : 3.1, 0, -22.8),
      heading: 2.6,
    },
  ]
}

export function mountCampusScene(
  canvas: HTMLCanvasElement,
  options: SceneOptions = {}
): CampusSceneHandle {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'low-power',
      stencil: false,
    })
  } catch {
    options.onError?.()
    return NOOP_HANDLE
  }

  const resources: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(resource: T): T => {
    resources.push(resource)
    return resource
  }
  const boxGeometry = keep(new THREE.BoxGeometry(1, 1, 1))
  const sphereGeometry = keep(new THREE.SphereGeometry(1, 12, 8))
  const cylinderGeometry = keep(new THREE.CylinderGeometry(1, 1, 1, 8))
  const planeGeometry = keep(new THREE.PlaneGeometry(1, 1))

  const standard = (color: number, roughness = 0.9, emissive = 0, strength = 0) =>
    keep(new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: strength }))
  const plain = (color: number, opacity = 1) =>
    keep(new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity === 1,
      side: THREE.DoubleSide,
    }))

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.32
  renderer.shadowMap.enabled = false

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111b26)
  scene.fog = new THREE.FogExp2(0x111b26, 0.009)
  const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 165)

  const materials = {
    grass: standard(0x233b34),
    grassField: standard(0x315a43),
    pavement: standard(0x697273),
    path: standard(0x8d918b),
    pavingJoint: standard(0x737d79),
    road: standard(0x303b3f),
    wall: standard(0xc2cbca),
    wallSide: standard(0x899c9e),
    building: standard(0xb64b38),
    column: standard(0x9d402f),
    band: standard(0xe5e3d7),
    trim: standard(0xf1efe6),
    roof: standard(0x596262),
    glass: standard(0x243944, 0.22),
    windowWarm: standard(0xd6aa65, 0.28, 0xffbd68, 0.55),
    windowSoft: standard(0x758890, 0.25, 0x85a0a4, 0.2),
    metal: standard(0x56605c, 0.48),
    metalLight: standard(0x88918a, 0.45),
    roadMark: plain(0xd6ac55),
    track: standard(0xa34d43),
    trackLine: plain(0xe8e7da),
    treeTrunk: standard(0x514b3c),
    leafDeep: standard(0x21483c),
    leafMid: standard(0x315748),
    leafLight: standard(0x47664c),
    lamp: keep(new THREE.MeshBasicMaterial({ color: 0xffd08a, toneMapped: false })),
    moon: plain(0xf7edcc),
    darkClothing: standard(0x2b3a46),
    warmClothing: standard(0xa65d55),
    skin: standard(0xc99577),
    hair: standard(0x272926),
    shoes: standard(0x252b2c),
  }

  const addBox = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number
  ) => {
    const mesh = new THREE.Mesh(boxGeometry, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(width, height, depth)
    parent.add(mesh)
    return mesh
  }

  const addSphere = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number
  ) => {
    const mesh = new THREE.Mesh(sphereGeometry, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    parent.add(mesh)
    return mesh
  }

  const addCylinder = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx: number,
    height: number,
    rz = rx
  ) => {
    const mesh = new THREE.Mesh(cylinderGeometry, material)
    mesh.position.set(x, y, z)
    mesh.scale.set(rx, height, rz)
    parent.add(mesh)
    return mesh
  }

  const addGroundPlane = (
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    length: number
  ) => {
    const plane = new THREE.Mesh(planeGeometry, material)
    plane.rotation.x = -Math.PI / 2
    plane.position.set(x, y, z)
    plane.scale.set(width, length, 1)
    scene.add(plane)
    return plane
  }

  const addPath = (startX: number, startZ: number, endX: number, endZ: number, width: number) => {
    const dx = endX - startX
    const dz = endZ - startZ
    const length = Math.hypot(dx, dz)
    const path = addBox(
      scene,
      materials.path,
      (startX + endX) / 2,
      0.035,
      (startZ + endZ) / 2,
      width,
      0.07,
      length
    )
    path.rotation.y = Math.atan2(dx, dz)
  }

  // The routes and field connect all four camera stops within one continuous campus.
  addGroundPlane(materials.grass, 0, -0.025, -18, 86, 89)
  addGroundPlane(materials.road, 0, -0.012, 22, 86, 15)
  addGroundPlane(materials.pavement, 0, 0.005, 15.7, 86, 4.5)
  const paintRoadLine = (x1: number, z1: number, x2: number, z2: number) => {
    const dx = x2 - x1
    const dz = z2 - z1
    const line = addBox(
      scene,
      materials.roadMark,
      (x1 + x2) / 2,
      0.042,
      (z1 + z2) / 2,
      0.12,
      0.015,
      Math.hypot(dx, dz)
    )
    line.rotation.y = Math.atan2(dx, dz)
  }
  for (const z of [17.4, 22.4]) paintRoadLine(-8, z, 8, z)
  for (const x of [-8, 8]) paintRoadLine(x, 17.4, x, 22.4)
  paintRoadLine(-8, 17.4, 8, 22.4)
  paintRoadLine(-8, 22.4, 8, 17.4)
  addPath(0, 13.4, 0, -20.5, 5.4)
  addPath(-0.5, -18.3, -7.2, -23.2, 2.6)
  addPath(0.8, -18.5, 8.7, -25.7, 3.2)
  for (let z = 10; z > -19; z -= 3.2) {
    addBox(scene, materials.pavingJoint, 0, 0.076, z, 5.37, 0.009, 0.055)
  }

  // Tiled beam, calligraphy and open metal gate follow the supplied entrance photographs.
  for (const x of [-9.4, 9.4]) {
    addBox(scene, materials.wallSide, x, 3.07, 13.2, 1.64, 6.14, 1.78)
    addBox(scene, materials.wall, x, 3.07, 14.105, 1.55, 6.08, 0.07)
    for (const y of [1.48, 2.97, 4.45]) {
      addBox(scene, materials.wallSide, x, y, 14.15, 1.58, 0.025, 0.04)
    }
    addBox(scene, materials.wallSide, x, 3.07, 14.15, 0.025, 6.1, 0.04)
  }
  addBox(scene, materials.wall, 0, 5.48, 13.2, 20.3, 1.56, 1.8)
  addBox(scene, materials.wallSide, 0, 4.69, 13.2, 20.36, 0.13, 1.82)
  addBox(scene, materials.wallSide, 0, 6.3, 13.2, 20.36, 0.055, 1.82)
  const signTexture = keep(makeSignTexture())
  const signMaterial = keep(new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: false }))
  const sign = new THREE.Mesh(planeGeometry, signMaterial)
  sign.scale.set(16.7, 1.46, 1)
  sign.position.set(0, 5.49, 14.112)
  scene.add(sign)

  // The folding gate is gathered to the left, as in the street-side photograph.
  for (let i = 0; i <= 9; i += 1) {
    addBox(scene, materials.metalLight, -8.1 + i * 0.54, 0.69, 14.16, 0.055, 1.28, 0.055)
  }
  for (let i = 0; i < 9; i += 1) {
    const centerX = -7.83 + i * 0.54
    const forward = addBox(scene, materials.metalLight, centerX, 0.69, 14.19, 0.04, 1.14, 0.04)
    const backward = addBox(scene, materials.metalLight, centerX, 0.69, 14.19, 0.04, 1.14, 0.04)
    forward.rotation.z = 0.49
    backward.rotation.z = -0.49
  }
  addBox(scene, materials.metalLight, -5.67, 0.16, 14.18, 5.13, 0.06, 0.08)
  addBox(scene, materials.metalLight, -5.67, 1.31, 14.18, 5.13, 0.06, 0.08)

  // The kiosk stands just beyond the right gate pier.
  addBox(scene, materials.wallSide, 12.1, 1.53, 11.9, 3.25, 3.06, 2.94)
  addBox(scene, materials.wall, 12.1, 1.53, 13.4, 3.15, 3, 0.07)
  addBox(scene, materials.roof, 12.1, 3.14, 11.9, 3.62, 0.2, 3.28)
  addBox(scene, materials.trim, 12.1, 1.69, 13.46, 2.52, 1.47, 0.05)
  addBox(scene, materials.glass, 12.1, 1.69, 13.5, 2.27, 1.22, 0.04)
  addBox(scene, materials.trim, 12.1, 1.69, 13.54, 0.075, 1.22, 0.04)

  for (const [start, end] of [[-32, -11], [14, 32]]) {
    addBox(scene, materials.metal, (start + end) / 2, 0.77, 13.3, end - start, 0.06, 0.08)
    addBox(scene, materials.metal, (start + end) / 2, 1.27, 13.3, end - start, 0.06, 0.08)
    for (let x = start; x <= end; x += 2.2) {
      addBox(scene, materials.metal, x, 0.68, 13.3, 0.07, 1.36, 0.08)
    }
  }

  // Four orange-red floors, white window frames and horizontal bands echo the photographs.
  const buildingX = 8.1
  const buildingFront = -26.5
  addBox(scene, materials.building, buildingX, 5.5, -30.2, 25.3, 11, 7.4)
  addBox(scene, materials.roof, buildingX, 11.1, -30.2, 26, 0.3, 8)
  for (const y of [2.35, 5.12, 7.9, 10.68]) {
    addBox(scene, materials.band, buildingX, y, buildingFront + 0.08, 25.55, 0.24, 0.24)
  }
  for (let col = 0; col <= 8; col += 1) {
    const x = -3.95 + col * 3.03
    addBox(scene, materials.column, x, 5.5, buildingFront + 0.09, 0.47, 10.85, 0.34)
  }
  for (let floor = 0; floor < 4; floor += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = -2.45 + col * 3.03
      const y = 1.42 + floor * 2.74
      const lit = (col * 7 + floor * 3) % 5 < 3
      addBox(scene, materials.trim, x, y, buildingFront + 0.23, 2.05, 1.62, 0.08)
      addBox(
        scene,
        lit ? materials.windowWarm : materials.windowSoft,
        x,
        y,
        buildingFront + 0.29,
        1.78,
        1.36,
        0.05
      )
      addBox(scene, materials.trim, x, y, buildingFront + 0.325, 0.075, 1.36, 0.04)
    }
  }
  addBox(scene, materials.roof, 8.1, 1.38, buildingFront + 0.49, 3.1, 2.76, 0.08)
  addBox(scene, materials.glass, 8.1, 1.35, buildingFront + 0.55, 2.48, 2.42, 0.045)
  addBox(scene, materials.band, 8.1, 2.88, buildingFront + 0.85, 4, 0.22, 1.6)
  addBox(scene, materials.trim, 8.1, 1.35, buildingFront + 0.59, 0.1, 2.42, 0.05)
  for (let step = 0; step < 3; step += 1) {
    addBox(scene, materials.pavement, 8.1, 0.08 + step * 0.09, -25.15 + step * 0.3, 4.5, 0.16, 1.4)
  }

  const trackX = -19.2
  const trackZ = -34.2
  const discGeometry = keep(new THREE.CircleGeometry(1, 96))
  const outerTrack = new THREE.Mesh(discGeometry, materials.track)
  outerTrack.rotation.x = -Math.PI / 2
  outerTrack.position.set(trackX, 0.024, trackZ)
  outerTrack.scale.set(12.2, 18.1, 1)
  scene.add(outerTrack)
  const innerField = new THREE.Mesh(discGeometry, materials.grassField)
  innerField.rotation.x = -Math.PI / 2
  innerField.position.set(trackX, 0.035, trackZ)
  innerField.scale.set(7.7, 13.7, 1)
  scene.add(innerField)
  for (let lane = 0; lane <= 4; lane += 1) {
    const rx = 7.85 + lane * 1.05
    const rz = 13.85 + lane * 1.02
    const points: THREE.Vector3[] = []
    for (let i = 0; i < 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2
      points.push(new THREE.Vector3(trackX + Math.cos(angle) * rx, 0.065, trackZ + Math.sin(angle) * rz))
    }
    const geometry = keep(new THREE.BufferGeometry().setFromPoints(points))
    scene.add(new THREE.LineLoop(geometry, materials.trackLine))
  }
  addBox(scene, materials.trackLine, trackX, 0.075, trackZ, 14.5, 0.015, 0.07)
  addBox(scene, materials.trackLine, trackX, 0.075, trackZ - 10.4, 5.4, 0.015, 0.06)
  addBox(scene, materials.trackLine, trackX, 0.075, trackZ + 10.4, 5.4, 0.015, 0.06)
  for (const goalZ of [trackZ - 11, trackZ + 11]) {
    addBox(scene, materials.trim, trackX - 1.6, 0.58, goalZ, 0.075, 1.15, 0.08)
    addBox(scene, materials.trim, trackX + 1.6, 0.58, goalZ, 0.075, 1.15, 0.08)
    addBox(scene, materials.trim, trackX, 1.16, goalZ, 3.25, 0.08, 0.08)
  }

  const glowTexture = keep(makeGlowTexture())
  const poolMaterial = keep(new THREE.MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }))

  const makeTree = (x: number, z: number, size: number) => {
    addCylinder(scene, materials.treeTrunk, x, size * 1.45, z, size * 0.11, size * 2.9)
    addSphere(scene, materials.leafDeep, x, size * 3.35, z, size * 1.04, size * 0.98, size * 0.95)
    addSphere(scene, materials.leafMid, x - size * 0.45, size * 3.05, z + size * 0.16, size * 0.79, size * 0.72, size * 0.7)
    addSphere(scene, materials.leafLight, x + size * 0.37, size * 3.0, z - size * 0.2, size * 0.71, size * 0.69, size * 0.73)
  }
  for (const z of [8, 1, -6, -13, -20]) {
    makeTree(-6.5, z, 1.09 + (Math.abs(z) % 3) * 0.07)
    makeTree(6.3, z - 3.3, 1.13 + (Math.abs(z + 1) % 3) * 0.06)
  }
  makeTree(-13.8, 16.4, 1.85)
  makeTree(15.6, 18.2, 2.12)
  makeTree(13.8, 23.8, 2.4)
  makeTree(24.2, 18.8, 1.35)
  makeTree(31.4, 18.2, 1.3)
  makeTree(-8.4, -35, 1.35)
  makeTree(-32.8, -23, 1.28)
  makeTree(23.5, -24, 1.3)

  const makeLamp = (x: number, z: number, height = 3.8) => {
    addCylinder(scene, materials.metal, x, height / 2, z, 0.07, height)
    addBox(scene, materials.metal, x + 0.22, height, z, 0.48, 0.08, 0.12)
    addSphere(scene, materials.lamp, x + 0.42, height - 0.12, z, 0.18, 0.2, 0.18)
    const pool = new THREE.Mesh(planeGeometry, poolMaterial)
    pool.rotation.x = -Math.PI / 2
    pool.position.set(x + 0.4, 0.08, z)
    pool.scale.set(7.4, 7.4, 1)
    scene.add(pool)
  }
  for (const z of [6, -6, -18]) {
    makeLamp(-4.3, z)
    makeLamp(4.4, z - 5)
  }
  makeLamp(1.9, 11.5, 3.2)
  makeLamp(-7.7, -29.5, 4.5)
  makeLamp(17.7, -22.6, 4.1)

  const makeVisitor = (parent: THREE.Group, x: number, height: number, coat: THREE.Material) => {
    const person = new THREE.Group()
    person.position.x = x
    person.scale.setScalar(height)
    parent.add(person)
    addCylinder(person, materials.shoes, -0.13, 0.35, 0, 0.09, 0.72)
    addCylinder(person, materials.shoes, 0.13, 0.35, 0, 0.09, 0.72)
    addBox(person, coat, 0, 1.06, 0, 0.57, 0.72, 0.29)
    addCylinder(person, coat, -0.35, 1.05, 0, 0.08, 0.6)
    addCylinder(person, coat, 0.35, 1.05, 0, 0.08, 0.6)
    addSphere(person, materials.skin, 0, 1.57, 0, 0.22, 0.24, 0.21)
    addSphere(person, materials.hair, 0, 1.74, -0.04, 0.235, 0.1, 0.22)
  }
  const visitors = new THREE.Group()
  makeVisitor(visitors, -0.38, 1, materials.darkClothing)
  makeVisitor(visitors, 0.38, 0.93, materials.warmClothing)
  scene.add(visitors)

  const ambient = new THREE.HemisphereLight(0xc8d4dc, 0x334032, 1.42)
  scene.add(ambient)
  const moonLight = new THREE.DirectionalLight(0xc0d2dd, 1.35)
  moonLight.position.set(-22, 29, -33)
  scene.add(moonLight)
  const entranceLight = new THREE.PointLight(0xffcd88, 17, 22, 2)
  entranceLight.position.set(2.8, 4.2, 11.5)
  scene.add(entranceLight)
  const pathLight = new THREE.PointLight(0xffc67e, 14, 18, 2)
  pathLight.position.set(3.6, 4.2, -9)
  scene.add(pathLight)
  const buildingLight = new THREE.PointLight(0xffcf94, 16, 19, 2)
  buildingLight.position.set(9, 3.5, -24)
  scene.add(buildingLight)

  const moon = addSphere(scene, materials.moon, -22, 17.5, -66, 2.35, 2.35, 2.35)
  moon.material.fog = false
  const moonGlowTexture = keep(new THREE.CanvasTexture((() => {
    const surface = document.createElement('canvas')
    surface.width = surface.height = 128
    const ctx = surface.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64)
      gradient.addColorStop(0, 'rgba(230, 237, 218, 0.32)')
      gradient.addColorStop(1, 'rgba(230, 237, 218, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 128, 128)
    }
    return surface
  })()))
  const moonHalo = new THREE.Sprite(keep(new THREE.SpriteMaterial({
    map: moonGlowTexture,
    transparent: true,
    depthWrite: false,
    fog: false,
  })))
  moonHalo.position.copy(moon.position)
  moonHalo.scale.set(12, 12, 1)
  scene.add(moonHalo)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let activeStop = 0
  let alive = true
  let frame = 0
  let movement: {
    started: number
    fromCamera: THREE.Vector3
    fromTarget: THREE.Vector3
    fromVisitors: THREE.Vector3
    fromHeading: number
    to: Stop
  } | null = null
  const cameraTarget = new THREE.Vector3()

  const sizeScene = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5, 1800 / width, 1200 / height)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.fov = camera.aspect < 0.8 ? 82 : 53
    camera.updateProjectionMatrix()
    moon.position.set(width <= 370 ? 16 : -22, width <= 370 ? 22 : width < 800 ? 25 : 17.5, -66)
    moonHalo.position.copy(moon.position)
  }

  const applyStop = (stop: Stop) => {
    camera.position.copy(stop.camera)
    cameraTarget.copy(stop.target)
    camera.lookAt(cameraTarget)
    visitors.position.copy(stop.visitors)
    visitors.rotation.y = stop.heading
    renderer.render(scene, camera)
  }

  const tick = (now: number) => {
    frame = 0
    if (!alive || document.hidden || !movement) return
    const progress = Math.min(1, (now - movement.started) / 950)
    const eased = progress * progress * (3 - 2 * progress)
    camera.position.lerpVectors(movement.fromCamera, movement.to.camera, eased)
    cameraTarget.lerpVectors(movement.fromTarget, movement.to.target, eased)
    camera.lookAt(cameraTarget)
    visitors.position.lerpVectors(movement.fromVisitors, movement.to.visitors, eased)
    visitors.position.y = Math.sin(eased * Math.PI * 6) * 0.025 * (1 - progress)
    const turn = Math.atan2(
      Math.sin(movement.to.heading - movement.fromHeading),
      Math.cos(movement.to.heading - movement.fromHeading)
    )
    visitors.rotation.y = movement.fromHeading + turn * eased
    renderer.render(scene, camera)
    if (progress < 1) frame = requestAnimationFrame(tick)
    else movement = null
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    } else if (movement && !frame) {
      frame = requestAnimationFrame(tick)
    }
  }

  const onReducedMotionChange = () => {
    if (!reducedMotion.matches || !movement) return
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    applyStop(movement.to)
    movement = null
  }

  sizeScene()
  applyStop(createStops(camera.aspect < 0.8)[0])
  document.addEventListener('visibilitychange', onVisibilityChange)
  reducedMotion.addEventListener?.('change', onReducedMotionChange)
  options.onReady?.()

  return {
    goTo(index) {
      if (!alive || !Number.isInteger(index) || index < 0 || index > 3) return
      const destination = createStops(camera.aspect < 0.8)[index]
      activeStop = index
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      if (reducedMotion.matches) {
        movement = null
        applyStop(destination)
        return
      }
      movement = {
        started: performance.now(),
        fromCamera: camera.position.clone(),
        fromTarget: cameraTarget.clone(),
        fromVisitors: visitors.position.clone(),
        fromHeading: visitors.rotation.y,
        to: destination,
      }
      if (!document.hidden) frame = requestAnimationFrame(tick)
    },
    resize() {
      if (!alive) return
      const wasPortrait = camera.aspect < 0.8
      sizeScene()
      if (wasPortrait !== (camera.aspect < 0.8)) {
        movement = null
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        applyStop(createStops(camera.aspect < 0.8)[activeStop])
      } else {
        renderer.render(scene, camera)
      }
    },
    dispose() {
      if (!alive) return
      alive = false
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      reducedMotion.removeEventListener?.('change', onReducedMotionChange)
      scene.clear()
      for (const resource of resources) resource.dispose()
      renderer.dispose()
    },
  }
}
