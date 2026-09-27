/**
 * 中秋夜里的方块水乡：桂花、灯笼、水面、圆月与蒲公英。
 * three 只从同目录 vendor/ 加载，不依赖 CDN。
 * 镜头随阅读进度缓移；交互会点亮月亮、放孔明灯、放烟花。
 */

const THREE_LOCAL = './vendor/three.module.js';

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const hexRGB = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/* 阅读进度 s：0 卷首，1 短信，2 月饼，3 月相，4 放灯，5 落款 */
const PATH = [
  { s: 0, p: [9.2, 6.4, 6.8], l: [0.4, 2.2, -7.5] },
  { s: 1, p: [9.0, 6.0, 0.2], l: [0.2, 1.9, -12.5] },
  { s: 2, p: [8.6, 5.9, -6.8], l: [0.1, 1.85, -17.0] },
  { s: 3, p: [8.4, 6.6, -5.5], l: [2.8, 8.5, -30.0] },
  { s: 4, p: [8.0, 6.2, -4.2], l: [0.3, 3.6, -15.0] },
  { s: 5, p: [8.4, 6.3, -1.8], l: [0.4, 2.9, -16.5] },
];
const MOON_POS = [10, 22, -56];

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
const segmentOf = (s) => {
  const n = PATH.length;
  if (s <= PATH[0].s) return [0, 0];
  if (s >= PATH[n - 1].s) return [n - 2, 1];
  let k = 0;
  while (k < n - 2 && s > PATH[k + 1].s) k++;
  return [k, (s - PATH[k].s) / (PATH[k + 1].s - PATH[k].s)];
};
const along = (s, key) => {
  const n = PATH.length;
  const [k, t] = segmentOf(s);
  const P = (i) => PATH[Math.max(0, Math.min(n - 1, i))][key];
  return [0, 1, 2].map((c) => catmull(P(k - 1)[c], P(k)[c], P(k + 1)[c], P(k + 2)[c], t));
};

export async function mountAutumn(canvas, { reduced = false } = {}) {
  if (!canvas) return null;
  let THREE;
  try {
    THREE = await import(THREE_LOCAL);
  } catch (err) {
    console.error('three local import failed', err);
    throw err;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  } catch (err) {
    console.error('WebGLRenderer failed', err);
    throw err;
  }
  renderer.setClearColor(0x090f2c, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;

  const lite = reduced
    || (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const rng = mulberry32(20260925);
  const R = (a, b) => a + (b - a) * rng();
  const pick = (list) => list[Math.floor(rng() * list.length)];

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1230, 0.018);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 520);
  const display = (rgb, target = new THREE.Color()) => target.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);

  const lit = [];
  const glow = { warm: [], gold: [] };
  const halos = [];
  const osmanthusTrees = [];
  const box = (x, y, z, sx, sy, sz, color, j = 0.05) => lit.push([x, y, z, sx, sy, sz, color, j]);
  const gbox = (group, x, y, z, sx, sy, sz, color) => glow[group].push([x, y, z, sx, sy, sz, color, 0]);
  const halo = (x, y, z, w, h, color, k = 1, order = 0) => halos.push([x, y, z, w, h, color, k, order]);

  const TILE = 0.5;
  const isCanal = (x, z) => Math.abs(x) < 1.15 && z < -4.5 && z > -26.5;
  const isPool = (x, z) => z > -4.5 && z < 2.2 && Math.abs(x) < 2.4 && Math.hypot(x, z + 1.2) < 2.6;
  const isWater = (x, z) => isCanal(x, z) || isPool(x, z) || z < -27.2 || Math.abs(x) > 7.4;
  const GRASS = ['#2f4a3c', '#355447', '#2a4236', '#3a5c4c'];
  const BANK = ['#4a4a58', '#3e3e4c', '#565666', '#484858'];
  const PAVE = ['#6a6660', '#5c5852', '#78746c', '#524e48'];
  const blocked = [];
  const block = (x0, z0, x1, z1) => blocked.push([x0, z0, x1, z1]);
  const isBlocked = (x, z) => blocked.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);

  /* 地基与地面 */
  box(0, -0.7, -10, 18, 1.6, 40, '#3a2e28', 0.02);
  for (let x = -7.5; x <= 7.5001; x += TILE) {
    for (let z = -27.0; z <= 5.5001; z += TILE) {
      if (isWater(x, z)) continue;
      const nearWater = isWater(x + TILE, z) || isWater(x - TILE, z) || isWater(x, z + TILE) || isWater(x, z - TILE);
      let color;
      let top = 0.5;
      if (nearWater) {
        color = pick(BANK);
        top = 0.54;
      } else if (Math.abs(x) < 3.8 && z < -8 && z > -24) {
        color = pick(PAVE);
      } else {
        color = pick(GRASS);
      }
      const h = top - 0.2;
      box(x, 0.2 + h / 2, z, TILE, h, TILE, color, 0.08);
    }
  }

  /* 通用零件 */
  let lanternOrder = 0;
  const redLantern = (x, y, z, reflectX = null) => {
    const order = lanternOrder++;
    box(x, y + 0.14, z, 0.03, 0.28, 0.03, '#2a1c16', 0);
    box(x, y - 0.02, z, 0.2, 0.05, 0.2, '#d9a441', 0.03);
    gbox('warm', x, y - 0.21, z, 0.27, 0.32, 0.27, '#ff4a36');
    box(x, y - 0.4, z, 0.18, 0.05, 0.18, '#d9a441', 0.03);
    box(x, y - 0.5, z, 0.04, 0.14, 0.04, '#e8b44a', 0);
    halo(x, y - 0.21, z, 1.55, 1.55, '#ff6a3c', 1.0, order);
    if (reflectX !== null) halo(reflectX, 0.36, z, 0.55, 1.9, '#ff7a48', 0.42, order);
  };
  const stoneLamp = (x, z, reflect = false) => {
    const order = lanternOrder++;
    box(x, 0.75, z, 0.22, 0.5, 0.22, '#7c7872', 0.05);
    box(x, 1.04, z, 0.36, 0.08, 0.36, '#6a6660', 0.04);
    gbox('warm', x, 1.2, z, 0.2, 0.22, 0.2, '#ffc978');
    box(x, 1.37, z, 0.38, 0.1, 0.38, '#5f5b56', 0.04);
    halo(x, 1.2, z, 1.25, 1.25, '#ffb760', 0.95, order);
    if (reflect) halo(x * 0.55, 0.36, z, 0.5, 1.7, '#ffb760', 0.38, order);
  };
  const glowWindow = (x, y, z, w, h, facingX = false) => {
    gbox('warm', x, y, z, facingX ? 0.05 : w, h, facingX ? w : 0.05, '#ffd27a');
    halo(x + (facingX ? 0.15 : 0), y, z + (facingX ? 0 : 0.15), w * 2.2, h * 2.2, '#ffcf7a', 0.55);
  };

  const osmanthus = (x, z, size = 1) => {
    const trunkH = 1.35 * size;
    for (let i = 0; i < 4; i++) {
      box(x + (i === 3 ? 0.05 : 0), 0.5 + trunkH * (i + 0.5) / 4, z, 0.28 * size, trunkH / 4 + 0.02, 0.28 * size, i % 2 ? '#5a4028' : '#4e3722');
    }
    box(x + 0.32 * size, 0.5 + trunkH * 0.9, z, 0.48 * size, 0.12 * size, 0.12 * size, '#4e3722');
    box(x - 0.28 * size, 0.5 + trunkH * 0.98, z + 0.08, 0.4 * size, 0.1 * size, 0.1 * size, '#5a4028');
    const cy = 0.5 + trunkH + 0.5 * size;
    const n = Math.round(52 * size * size * (lite ? 0.7 : 1));
    for (let i = 0; i < n; i++) {
      let u; let v; let w;
      do { u = R(-1, 1); v = R(-1, 1); w = R(-1, 1); } while (u * u + v * v + w * w > 1);
      const s = R(0.28, 0.46) * size;
      const roll = rng();
      const color = roll < 0.18 ? '#ffe08a' : roll < 0.32 ? '#c8a038' : pick(['#f6c453', '#e8b44a', '#ffd76a', '#d9a441']);
      const px = x + u * 1.2 * size;
      const py = cy + v * 0.7 * size;
      const pz = z + w * 1.2 * size;
      if (roll > 0.88) gbox('gold', px, py, pz, s * 0.7, s * 0.7, s * 0.7, '#ffe6a0');
      else box(px, py, pz, s, s * 0.9, s, color, 0.04);
    }
    halo(x, cy, z, 2.4 * size, 2.0 * size, '#ffd48a', 0.28);
    osmanthusTrees.push([x, cy, z, size]);
    block(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
  };

  const huiHouse = (cx, cz, w, d, floors, facing) => {
    const y0 = 0.5;
    const hgt = floors * 1.35;
    block(cx - w / 2 - 0.4, cz - d / 2 - 0.3, cx + w / 2 + 0.4, cz + d / 2 + 0.3);
    box(cx, y0 + 0.12, cz, w + 0.24, 0.24, d + 0.24, '#6b6760', 0.05);
    box(cx, y0 + 0.24 + hgt / 2, cz, w, hgt, d, '#e4e2dc', 0.02);
    const top = y0 + 0.24 + hgt;
    for (const sz of [-1, 1]) {
      const gz = cz + sz * (d / 2 + 0.05);
      box(cx, top + 0.34, gz, w + 0.12, 0.68, 0.14, '#e4e2dc', 0.02);
      box(cx, top + 0.84, gz, w * 0.56, 0.34, 0.14, '#e4e2dc', 0.02);
      box(cx, top + 1.04, gz, w * 0.56 + 0.2, 0.08, 0.3, '#2f333a', 0.03);
    }
    for (let i = 0; i < 4; i++) {
      const width = w + 0.72 - i * 0.62;
      if (width < 0.3) break;
      box(cx, top + 0.1 + i * 0.22, cz, width, 0.2, d + 0.2, i % 2 ? '#3b4048' : '#33373e', 0.05);
    }
    const fx = cx + facing * (w / 2 + 0.03);
    box(fx, y0 + 0.24 + 0.62, cz, 0.06, 1.24, 0.94, '#5e2f1c', 0.03);
    gbox('warm', fx + facing * 0.01, y0 + 0.24 + 0.62, cz, 0.05, 1.06, 0.72, '#ffb65c');
    halo(fx + facing * 0.25, y0 + 0.9, cz, 1.2, 1.4, '#ffb65c', 0.55);
    for (let f = 0; f < floors; f++) {
      for (const oz of [-d * 0.32, d * 0.32]) {
        const wy = y0 + 0.24 + (f === 0 ? 1.0 : 1.35 * f + 0.75);
        if (f === 0 && Math.abs(oz) < 0.6) continue;
        box(fx, wy, cz + oz, 0.07, 0.54, 0.52, '#6d3a22', 0.03);
        gbox('warm', fx + facing * 0.015, wy, cz + oz, 0.05, 0.4, 0.38, '#ffc27a');
      }
    }
    const eave = top - 0.02;
    const lanternX = cx + facing * (w / 2 + 0.36);
    redLantern(lanternX, eave, cz - d * 0.3, Math.abs(lanternX) < 3.2 ? lanternX * 0.45 : null);
    redLantern(lanternX, eave, cz + d * 0.3, Math.abs(lanternX) < 3.2 ? lanternX * 0.45 : null);
  };

  /* 水乡房屋（东侧走镜头，所以房子偏西岸与远处） */
  huiHouse(-4.6, -10.5, 2.8, 2.8, 1, 1);
  huiHouse(-4.8, -16.8, 2.8, 3.0, 2, 1);
  huiHouse(-4.5, -22.8, 2.6, 2.6, 1, 1);
  huiHouse(4.4, -12.4, 2.6, 2.6, 1, -1);
  huiHouse(4.5, -19.2, 3.0, 3.0, 2, -1);
  huiHouse(4.3, -25.0, 2.6, 2.6, 1, -1);

  /* 小木屋（卷首近处，对应原来的 SVG 岛） */
  {
    const cx = 1.6; const cz = -1.2;
    block(cx - 1.6, cz - 1.4, cx + 1.6, cz + 1.6);
    box(cx, 0.62, cz, 2.4, 1.4, 2.0, '#c9a06a', 0.03);
    box(cx, 1.55, cz, 2.7, 0.7, 2.3, '#8a5530', 0.04);
    box(cx, 1.95, cz, 1.6, 0.35, 1.2, '#7a4a28', 0.04);
    box(cx + 0.2, 0.85, cz + 1.05, 0.55, 0.9, 0.08, '#6d3a22', 0.03);
    glowWindow(cx - 0.55, 1.05, cz + 1.03, 0.4, 0.4);
    glowWindow(cx + 1.22, 1.05, cz, 0.35, 0.35, true);
    redLantern(cx - 0.9, 1.85, cz + 0.9);
    redLantern(cx + 0.9, 1.85, cz + 0.85);
  }

  /* 拱桥跨运河 */
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = -2.2 + 4.4 * t;
    const h = 0.58 + Math.sin(Math.PI * t) * 0.95;
    box(x, h, -14.5, 0.38, 0.14, 1.2, pick(['#6b6660', '#77726b', '#5f5b56']), 0.05);
    box(x, h + 0.18, -15.05, 0.34, 0.22, 0.1, '#5a5650', 0.04);
    box(x, h + 0.18, -13.95, 0.34, 0.22, 0.1, '#5a5650', 0.04);
    if (t < 0.18 || t > 0.82) box(x, 0.28 + h / 2, -14.5, 0.38, h, 1.2, '#66615b', 0.05);
  }

  /* 横跨灯笼串 */
  box(0, 2.55, -9.2, 5.6, 0.03, 0.03, '#2a1c16', 0);
  for (let i = 0; i < 5; i++) redLantern(-2.0 + i * 1.0, 2.5 - Math.sin((i / 4) * Math.PI) * 0.16, -9.2, -2.0 + i * 1.0);
  box(0, 2.55, -20.5, 5.6, 0.03, 0.03, '#2a1c16', 0);
  for (let i = 0; i < 5; i++) redLantern(-2.0 + i * 1.0, 2.5 - Math.sin((i / 4) * Math.PI) * 0.16, -20.5, -2.0 + i * 1.0);

  for (const z of [-7.5, -11.5, -17.5, -23.5]) {
    stoneLamp(-1.7, z, true);
    stoneLamp(1.7, z, true);
  }

  osmanthus(-2.8, -0.4, 1.15);
  osmanthus(4.8, 1.6, 1.0);
  osmanthus(-6.0, -8.5, 0.95);
  osmanthus(6.2, -15.0, 1.1);
  osmanthus(-6.2, -20.5, 1.05);
  osmanthus(2.2, -27.8, 0.9);
  osmanthus(-1.2, 3.6, 0.85);

  /* 荷叶 */
  [[-0.4, -6.2], [0.5, -8.0], [-0.3, -15.6], [0.45, -18.2], [-0.5, -24.0], [0.3, -25.5]].forEach(([x, z], i) => {
    box(x, 0.35, z, 0.48, 0.04, 0.48, pick(['#3f7340', '#4a8248', '#356838']), 0.05);
    if (i % 2 === 0) {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        box(x + Math.cos(a) * 0.09, 0.46, z + Math.sin(a) * 0.09, 0.09, 0.12, 0.09, pick(['#f0a8c0', '#f6bfd0']), 0.03);
      }
      box(x, 0.47, z, 0.07, 0.05, 0.07, '#f6d96a', 0);
      halo(x, 0.55, z, 0.65, 0.65, '#ffb0c8', 0.3);
    }
  });

  /* 岸边矮草、桂花碎屑与蒲公英 */
  for (let i = 0; i < 34; i++) {
    const x = R(-7.0, 7.0);
    const z = R(-26, 5);
    if (isWater(x, z) || isBlocked(x, z)) continue;
    box(x, 0.58, z, 0.22, 0.16, 0.22, pick(['#3d6a48', '#4a7a52']), 0.08);
    if (rng() < 0.25) gbox('gold', x, 0.72, z, 0.08, 0.08, 0.08, '#ffe08a');
  }
  const dandelionSpots = [];
  const swayStems = [];
  const fluffMat = new THREE.MeshBasicMaterial({ color: 0xf8f4ea, transparent: true, opacity: 0.92, depthWrite: false });
  const spokeMat = new THREE.MeshBasicMaterial({ color: 0xece6d8, transparent: true, opacity: 0.5, depthWrite: false });
  const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false });
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x5a7a42 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xe8d8a0 });
  const seedSphere = new THREE.SphereGeometry(1, 6, 6);
  const tipSphere = new THREE.SphereGeometry(1, 5, 5);
  const makeFluffyHead = (radius = 0.28) => {
    const head = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), coreMat);
    head.add(core);
    const n = lite ? 48 : 72;
    for (let k = 0; k < n; k++) {
      const u = rng();
      const v = rng();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const rr = radius * (0.62 + 0.38 * Math.pow(rng(), 0.45));
      const px = Math.sin(phi) * Math.cos(theta) * rr;
      const py = Math.cos(phi) * rr;
      const pz = Math.sin(phi) * Math.sin(theta) * rr;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, rr * 0.95, 4), spokeMat);
      spoke.position.set(px * 0.48, py * 0.48, pz * 0.48);
      spoke.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(px, py, pz).normalize(),
      );
      head.add(spoke);
      const seed = new THREE.Mesh(seedSphere, fluffMat);
      const sr = 0.026 + rng() * 0.016;
      seed.scale.set(sr * 1.2, sr * 0.85, sr * 1.2);
      seed.position.set(px, py, pz);
      head.add(seed);
      if (rng() < 0.75) {
        const tip = new THREE.Mesh(tipSphere, tipMat);
        tip.position.set(px * 1.16, py * 1.16, pz * 1.16);
        tip.scale.set(0.038, 0.014, 0.038);
        tip.lookAt(0, 0, 0);
        head.add(tip);
      }
    }
    return head;
  };
  const plantDandelion = (x, z, h = R(0.55, 0.95), radius = R(0.22, 0.32)) => {
    if (isWater(x, z) || isBlocked(x, z)) return;
    const cy = 0.5 + h;
    dandelionSpots.push([x, cy, z, h]);
    const group = new THREE.Group();
    group.position.set(x, 0.5, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, h, 6), stemMat);
    stem.position.y = h / 2;
    const head = makeFluffyHead(radius);
    head.position.y = h;
    group.add(stem, head);
    scene.add(group);
    if (swayStems.length < (lite ? 14 : 22)) {
      swayStems.push({ group, head, phase: rng() * 6.28, amp: R(0.08, 0.16) });
    }
  };
  // 镜头近处几株，保证一眼能认出蒲公英
  [[-2.4, 1.2], [-1.6, -0.6], [1.8, 0.4], [2.6, -2.2], [-3.2, -3.5], [3.4, -5.0], [-4.0, -7.5], [0.9, -4.8]].forEach(([x, z], i) => {
    plantDandelion(x, z, 0.62 + (i % 3) * 0.1, 0.26 + (i % 2) * 0.04);
  });
  for (let i = 0; i < (lite ? 14 : 22); i++) {
    const x = R(-6.8, 6.8);
    const z = R(-24, 4.8);
    if (Math.abs(x) < 1.35) continue;
    plantDandelion(x, z);
  }

  /* 远丘 */
  [[-12, -6, 3.6, 2.8], [12.5, -10, 3.4, 2.6], [-13, -22, 4.0, 3.2], [13, -24, 3.8, 3.0], [-11, 4, 2.8, 2.2], [11.5, 3, 2.6, 2.0]]
    .forEach(([hx, hz, r, height]) => {
      for (let x = -r; x <= r; x += 1) {
        for (let z = -r; z <= r; z += 1) {
          const d = Math.hypot(x, z) / r;
          if (d > 1) continue;
          const h = Math.max(0.5, height * (1 - d * d) + R(-0.2, 0.2));
          box(hx + x, h / 2 - 0.1, hz + z, 1, h, 1, pick(['#2a3548', '#243042']), 0.04);
          box(hx + x, h - 0.05, hz + z, 1, 0.28, 1, pick(GRASS), 0.08);
        }
      }
    });

  /* 两人在近岸看月 */
  const lambert = (color) => new THREE.MeshLambertMaterial({ color });
  const person = (x, z, cloth, hair, skirt = false) => {
    const group = new THREE.Group();
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.16), lambert(0x2e2a36));
    legs.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.BoxGeometry(skirt ? 0.34 : 0.3, 0.34, 0.2), lambert(cloth));
    body.position.y = 0.37;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.22), lambert(0xf6d6c6));
    head.position.y = 0.68;
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.24), lambert(hair));
    hairTop.position.y = 0.82;
    group.add(legs, body, head, hairTop);
    if (skirt) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), lambert(hair));
      back.position.set(0, 0.66, -0.12);
      group.add(back);
    }
    group.position.set(x, 0.5, z);
    scene.add(group);
    return group;
  };
  person(-0.55, 1.8, 0x3d4a6a, 0x221c1a);
  person(0.45, 1.7, 0xf2a7bc, 0x3a2626, true);

  /* 实例网格：局部坐标颗粒哈希，避免世界缩放条纹 */
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpPos = new THREE.Vector3();
  const tmpScale = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  const withGrain = (material, amount = 0.08) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGrainAmt = { value: amount };
      shader.vertexShader = `varying vec3 vLocalPos;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvLocalPos = position;`);
      shader.fragmentShader = `uniform float uGrainAmt;\nvarying vec3 vLocalPos;\n${shader.fragmentShader}`
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 cell = floor(vLocalPos * 28.0 + 0.5);
          float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
          diffuseColor.rgb *= mix(1.0 - uGrainAmt * 0.025, 1.0 + uGrainAmt * 0.025, h);`
        );
    };
    material.customProgramCacheKey = () => `ma-grain-${amount}`;
    return material;
  };
  const instanced = (list, material) => {
    const mesh = new THREE.InstancedMesh(cube, material, Math.max(1, list.length));
    list.forEach((b, i) => {
      tmpPos.set(b[0], b[1], b[2]);
      tmpScale.set(b[3], b[4], b[5]);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      mesh.setMatrixAt(i, tmpMatrix);
      tmpColor.set(b[6]);
      if (b[7]) tmpColor.multiplyScalar(1 + (rng() - 0.5) * b[7] * 2);
      mesh.setColorAt(i, tmpColor);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  };
  instanced(lit, withGrain(new THREE.MeshLambertMaterial({ color: 0xffffff }), 1.0));
  const warmMat = withGrain(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.7);
  const goldMat = withGrain(new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.55);
  instanced(glow.warm, warmMat);
  instanced(glow.gold, goldMat);

  /* 夜空 */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 40, 28),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uZenith: { value: new THREE.Vector3(0.01, 0.02, 0.09) },
        uMid: { value: new THREE.Vector3(0.03, 0.07, 0.2) },
        uHorizon: { value: new THREE.Vector3(0.12, 0.14, 0.28) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uZenith, uMid, uHorizon;
        varying vec3 vDir;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uHorizon, mix(uMid, uZenith, smoothstep(0.35, 0.95, h)), smoothstep(0.0, 0.55, h));
          float milky = pow(max(0.0, 1.0 - abs(vDir.x * 0.35 + vDir.z * 0.9 + 0.15)), 8.0);
          col += vec3(0.35, 0.4, 0.7) * milky * 0.18;
          float curtain = pow(0.5 + 0.5 * sin(vDir.x * 8.0 + uTime * 0.12), 3.0) * hash(vec3(vDir.xz * 9.0, floor(uTime)));
          col += vec3(0.25, 0.35, 0.7) * curtain * 0.08 * smoothstep(0.2, 0.7, vDir.y);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.renderOrder = -2;
  scene.add(sky);

  const starCount = lite ? 500 : 1100;
  const starPos = new Float32Array(starCount * 3);
  const starSeed = new Float32Array(starCount * 2);
  for (let i = 0; i < starCount; i++) {
    const theta = rng() * Math.PI * 2;
    const y = rng() * 0.92 + 0.06;
    const ring = Math.sqrt(1 - y * y);
    const radius = 140 + rng() * 25;
    starPos[i * 3] = Math.cos(theta) * ring * radius;
    starPos[i * 3 + 1] = y * radius - 6;
    starPos[i * 3 + 2] = Math.sin(theta) * ring * radius - 20;
    starSeed[i * 2] = rng() * 6.28;
    starSeed[i * 2 + 1] = rng() < 0.08 ? 2.4 + rng() * 1.6 : 0.7 + rng() * 1.1;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeed, 2));
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute vec2 aSeed;
      uniform float uTime;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.5 + 0.5 * sin(uTime * (0.7 + aSeed.y * 0.2) + aSeed.x);
        vA = 0.35 + 0.65 * tw;
        gl_PointSize = aSeed.y * (0.6 + 0.4 * tw) * 2.0;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = dot(p, p);
        if (d > 0.25) discard;
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.9), smoothstep(0.25, 0.0, d) * vA);
      }
    `,
  }));
  stars.renderOrder = -1;
  scene.add(stars);

  const radialTexture = (stops, size = 128) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => grd.addColorStop(o, col));
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.55)'], [0.55, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);

  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 256;
  {
    const mg = moonCanvas.getContext('2d');
    mg.fillStyle = '#f7e7c4';
    mg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const x = rng() * 256;
      const y = rng() * 256;
      const r = 2 + rng() * 16;
      mg.fillStyle = `rgba(160,130,90,${0.14 + rng() * 0.3})`;
      mg.beginPath();
      mg.arc(x, y, r, 0, Math.PI * 2);
      mg.fill();
    }
  }
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4.6, 40, 40),
    new THREE.MeshBasicMaterial({ map: moonTex, fog: false })
  );
  moonMesh.position.set(...MOON_POS);
  scene.add(moonMesh);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffe6b0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.82,
  }));
  moonGlow.position.set(...MOON_POS);
  moonGlow.scale.setScalar(44);
  scene.add(moonGlow);
  const moonBlush = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffa0b8, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  moonBlush.position.set(...MOON_POS);
  moonBlush.scale.setScalar(28);
  scene.add(moonBlush);

  scene.add(new THREE.AmbientLight(0xb8c6ec, 0.32));
  const moonLight = new THREE.DirectionalLight(0xffe8c0, 1.05);
  moonLight.position.set(...MOON_POS);
  scene.add(moonLight);
  scene.add(moonLight.target);
  const fillLight = new THREE.DirectionalLight(0x8899cc, 0.22);
  fillLight.position.set(-12, 10, 8);
  scene.add(fillLight);
  const hemi = new THREE.HemisphereLight(0x7a8ac8, 0x1a2030, 0.78);
  scene.add(hemi);

  /* 水面：大到雾里看不见边 */
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 520, 1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uLamp: { value: 1 },
        uMoonPulse: { value: 0 },
        uSky: { value: new THREE.Vector3(0.05, 0.1, 0.24) },
        uFog: { value: new THREE.Vector3(0.04, 0.07, 0.16) },
        uFogDensity: { value: 0.018 },
      },
      vertexShader: `
        varying vec3 vWorld;
        varying float vDist;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vec4 mv = viewMatrix * w;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime, uLamp, uMoonPulse, uFogDensity;
        uniform vec3 uSky, uFog;
        varying vec3 vWorld;
        varying float vDist;
        void main() {
          vec2 xz = vWorld.xz;
          float w1 = sin(xz.x * 3.4 + uTime * 1.15) * sin(xz.y * 2.6 - uTime * 0.9);
          float w2 = sin((xz.x - xz.y) * 6.8 + uTime * 1.9) * 0.45;
          float w3 = sin(xz.x * 10.5 - xz.y * 9.0 + uTime * 2.6) * 0.2;
          float wave = w1 * 0.5 + w2 * 0.3 + w3 * 0.12;
          float k = 0.5 + 0.4 * wave;
          vec3 deep = mix(vec3(0.03, 0.05, 0.14), vec3(0.08, 0.12, 0.28), k);
          vec3 canal = mix(vec3(0.06, 0.1, 0.2), vec3(0.14, 0.2, 0.36), k);
          float canalMask = smoothstep(2.4, 0.6, abs(vWorld.x)) * smoothstep(-4.0, -8.0, vWorld.z) * smoothstep(-28.0, -24.0, -vWorld.z);
          vec3 col = mix(deep, canal, canalMask);
          col = mix(col, uSky, 0.16);
          float dx = cos(xz.x * 3.4 + uTime * 1.15) * sin(xz.y * 2.6 - uTime * 0.9) * 3.4;
          float dz = sin(xz.x * 3.4 + uTime * 1.15) * cos(xz.y * 2.6 - uTime * 0.9) * 2.6;
          vec3 nrm = normalize(vec3(-dx * 0.04, 1.0, -dz * 0.04));
          vec3 viewDir = normalize(cameraPosition - vWorld);
          vec3 moonDir = normalize(vec3(0.35, 0.72, -0.55));
          float spec = pow(max(0.0, dot(reflect(-moonDir, nrm), viewDir)), 36.0);
          float streak = pow(max(0.0, 1.0 - abs(nrm.x * 2.0 + nrm.z * 0.5)), 8.0) * (0.55 + 0.45 * wave);
          vec3 spark = mix(vec3(0.85, 0.9, 1.0), vec3(1.0, 0.82, 0.55), uLamp);
          col += spark * (spec * (0.42 + 0.48 * uLamp + uMoonPulse * 0.4) + streak * (0.18 + 0.24 * uLamp));
          /* soft moon path on canal */
          float moonPath = exp(-pow((vWorld.x - 0.6) * 1.4, 2.0)) * smoothstep(-4.0, -26.0, vWorld.z);
          col += vec3(1.0, 0.92, 0.72) * moonPath * (0.12 + 0.18 * uMoonPulse);
          vec2 cell = floor(xz * 6.2);
          float sp = step(0.997, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
          col += vec3(0.9, 0.92, 1.0) * sp * (0.45 + 0.55 * sin(uTime * 3.0 + cell.x));
          float f = 1.0 - exp(-pow(uFogDensity * vDist, 2.0));
          gl_FragColor = vec4(mix(col, uFog, f), 0.94);
        }
      `,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.32, -12);
  scene.add(water);

  /* 光晕 billboards */
  const quad = new THREE.PlaneGeometry(1, 1);
  const buildBillboards = (count) => {
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    geo.instanceCount = count;
    return geo;
  };
  const haloGeo = buildBillboards(Math.max(1, halos.length));
  const hPos = new Float32Array(halos.length * 3);
  const hSize = new Float32Array(halos.length * 2);
  const hColor = new Float32Array(halos.length * 3);
  const hMeta = new Float32Array(halos.length * 2);
  const hOrder = new Float32Array(halos.length);
  halos.forEach(([x, y, z, w, h, color, k, order], i) => {
    hPos.set([x, y, z], i * 3);
    hSize.set([w, h], i * 2);
    hColor.set(hexRGB(color), i * 3);
    hMeta.set([k, rng() * 6.28], i * 2);
    hOrder[i] = order;
  });
  haloGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(hPos, 3));
  haloGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(hSize, 2));
  haloGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(hColor, 3));
  haloGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(hMeta, 2));
  haloGeo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(hOrder, 1));
  const haloUniforms = { uTime: { value: 0 }, uPulse: { value: 0 }, uWave: { value: -99 } };
  const halosMesh = new THREE.Mesh(haloGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: haloUniforms,
    vertexShader: `
      attribute vec3 aPos;
      attribute vec2 aSize;
      attribute vec3 aColor;
      attribute vec2 aMeta;
      attribute float aOrder;
      uniform float uTime, uPulse, uWave;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vK;
      void main() {
        vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
        mv.xy += position.xy * aSize;
        mv.z += 0.3;
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vColor = aColor;
        float k = aMeta.x * (0.86 + 0.14 * sin(uTime * 2.6 + aMeta.y));
        k *= 1.0 + uPulse * 0.4;
        float t = (uTime - uWave) * 3.5 - aOrder * 0.15;
        k += 0.9 * exp(-t * t) * step(0.0, uTime - uWave);
        vK = k;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vK;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 2.4);
        gl_FragColor = vec4(vColor * vK, a);
      }
    `,
  }));
  halosMesh.frustumCulled = false;
  scene.add(halosMesh);

  /* 桂花飘落 */
  const petalQuad = new THREE.PlaneGeometry(1, 1);
  const perTree = lite ? 22 : 42;
  const fallCount = Math.max(1, osmanthusTrees.length * perTree);
  const fallGeo = buildBillboards(fallCount);
  fallGeo.index = petalQuad.index;
  fallGeo.setAttribute('position', petalQuad.getAttribute('position'));
  const fOrigin = new Float32Array(fallCount * 3);
  const fSeed = new Float32Array(fallCount * 4);
  const fColor = new Float32Array(fallCount * 3);
  const GOLD_PETAL = ['#f6c453', '#ffe08a', '#e8b44a', '#ffd76a', '#f0d080'].map(hexRGB);
  osmanthusTrees.forEach(([x, cy, z, size], ti) => {
    for (let k = 0; k < perTree; k++) {
      const i = ti * perTree + k;
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 1.35 * size;
      fOrigin.set([x + Math.cos(a) * r, cy, z + Math.sin(a) * r], i * 3);
      fSeed.set([rng(), rng(), rng(), rng()], i * 4);
      fColor.set(GOLD_PETAL[Math.floor(rng() * GOLD_PETAL.length)], i * 3);
    }
  });
  fallGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(fOrigin, 3));
  fallGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fSeed, 4));
  fallGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(fColor, 3));
  const fallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uWind: { value: 0 } },
    vertexShader: `
      attribute vec3 aOrigin;
      attribute vec4 aSeed;
      attribute vec3 aColor;
      uniform float uTime, uWind;
      varying vec3 vColor;
      varying float vFade;
      varying vec2 vUv;
      void main() {
        float height = aOrigin.y - 0.45;
        float speed = 0.18 + aSeed.x * 0.28 + uWind * 0.3;
        float drop = mod(aSeed.y * height + uTime * speed, height);
        vec3 p = aOrigin;
        p.y -= drop;
        p.x += sin(uTime * (0.55 + aSeed.z) + aSeed.w * 6.28) * 0.3 + drop * 0.28 + uWind * 0.5;
        p.z += cos(uTime * (0.45 + aSeed.x) + aSeed.z * 6.28) * 0.25;
        float ang = uTime * (1.1 + aSeed.x * 2.0) + aSeed.y * 6.28;
        float c = cos(ang), s = sin(ang);
        vec3 local = vec3(position.x * 0.12 * c - position.y * 0.08 * s, position.x * 0.12 * s + position.y * 0.08 * c, 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
        vFade = smoothstep(0.0, 0.2, drop) * smoothstep(height, height - 0.25, drop);
        vColor = aColor;
        vUv = uv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vFade;
      varying vec2 vUv;
      void main() {
        vec2 q = (vUv - 0.5) * vec2(1.0, 1.3);
        if (length(q) > 0.5) discard;
        gl_FragColor = vec4(vColor * (0.9 + 0.2 * (0.5 - length(q))), vFade);
      }
    `,
  });
  const fallMesh = new THREE.Mesh(fallGeo, fallMat);
  fallMesh.frustumCulled = false;
  scene.add(fallMesh);

  /* 蒲公英飞絮：伞状绒毛 + 细茎，随风与钢琴律动飘起 */
  const seedCount = lite ? 56 : 110;
  const seedGeo = buildBillboards(Math.max(1, seedCount));
  seedGeo.index = petalQuad.index;
  seedGeo.setAttribute('position', petalQuad.getAttribute('position'));
  const sOrigin = new Float32Array(seedCount * 3);
  const sSeed = new Float32Array(seedCount * 4);
  for (let i = 0; i < seedCount; i++) {
    const spot = dandelionSpots[i % Math.max(1, dandelionSpots.length)] || [R(-5, 5), 1.2, R(-18, 2), 0.5];
    sOrigin.set([spot[0] + R(-0.15, 0.15), spot[1] + R(-0.05, 0.08), spot[2] + R(-0.15, 0.15)], i * 3);
    sSeed.set([rng(), rng(), rng(), rng()], i * 4);
  }
  seedGeo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(sOrigin, 3));
  seedGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sSeed, 4));
  const seedMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uWind: { value: 0 }, uMusic: { value: 0 } },
    vertexShader: `
      attribute vec3 aOrigin;
      attribute vec4 aSeed;
      uniform float uTime, uWind, uMusic;
      varying float vFade;
      varying vec2 vUv;
      void main() {
        float life = mod(aSeed.x + uTime * (0.06 + aSeed.y * 0.09 + uMusic * 0.1), 1.0);
        vec3 p = aOrigin;
        p.y += life * (2.8 + uMusic * 2.0) + sin(uTime * 1.1 + aSeed.z * 6.28) * 0.14;
        p.x += life * (1.9 + uWind * 1.6 + uMusic * 1.0) * (0.35 + aSeed.w);
        p.z += sin(uTime * 0.65 + aSeed.z * 6.28) * life * 1.35;
        float ang = uTime * (0.55 + aSeed.x * 0.8) + aSeed.y * 6.28;
        float c = cos(ang), s = sin(ang);
        float size = 0.11 + aSeed.z * 0.06;
        vec3 local = vec3(position.x * size * c - position.y * size * 0.85 * s, position.x * size * s + position.y * size * 0.85 * c, 0.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p + local, 1.0);
        vFade = smoothstep(0.0, 0.06, life) * smoothstep(1.0, 0.72, life) * (0.5 + 0.5 * uMusic + 0.25);
        vUv = uv;
      }
    `,
    fragmentShader: `
      varying float vFade;
      varying vec2 vUv;
      void main() {
        vec2 q = (vUv - 0.5) * vec2(1.0, 1.25);
        float d = length(q);
        if (d > 0.52) discard;
        float angle = atan(q.y, q.x);
        float spokes = abs(sin(angle * 6.0));
        float parasol = smoothstep(0.48, 0.12, d) * (0.28 + 0.72 * pow(spokes, 0.65));
        float stem = smoothstep(0.08, 0.0, abs(q.x)) * smoothstep(0.05, -0.42, q.y) * 0.55;
        float core = smoothstep(0.12, 0.0, d) * 0.9;
        float a = clamp(parasol + stem + core, 0.0, 1.0);
        vec3 col = mix(vec3(0.92, 0.9, 0.84), vec3(1.0, 0.99, 0.96), core);
        gl_FragColor = vec4(col, a * vFade);
      }
    `,
  });
  const seedMesh = new THREE.Mesh(seedGeo, seedMat);
  seedMesh.frustumCulled = false;
  scene.add(seedMesh);

  /* 孔明灯与烟花 */
  const skyLanterns = [];
  const lanternBody = new THREE.BoxGeometry(0.28, 0.36, 0.28);
  let clock = 0;
  const spawnSkyLantern = (x, y, z) => {
    if (skyLanterns.length > 10) return;
    const mesh = new THREE.Mesh(lanternBody, new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true }));
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffa050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glowSprite.scale.setScalar(1.8);
    mesh.position.set(x, y, z);
    glowSprite.position.set(x, y, z);
    scene.add(mesh, glowSprite);
    skyLanterns.push({ mesh, glowSprite, born: clock, seed: rng() * 6.28, x, y, z });
  };

  const fireworks = [];
  const FW_COLORS = [0xffb7c8, 0xffe0a0, 0xff9a72, 0x9adfff, 0xfff6ea, 0xffd48a];
  const rocketGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const spawnFirework = (x, z, delay = 0, color) => {
    const col = color ?? pick(FW_COLORS);
    const rocket = new THREE.Mesh(rocketGeo, new THREE.MeshBasicMaterial({ color: col }));
    const trail = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9,
    }));
    trail.scale.setScalar(1.2);
    rocket.position.set(x, 1.2, z);
    trail.position.copy(rocket.position);
    scene.add(rocket, trail);
    fireworks.push({
      x, z,
      y0: 1.2,
      y1: R(8.5, 13.5),
      born: clock + delay,
      rise: R(0.75, 1.1),
      color: col,
      rocket,
      trail,
      sparks: null,
      life: 0,
    });
  };
  const burstFirework = (shell) => {
    const count = lite ? 40 : 72;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      const theta = R(0, Math.PI * 2);
      const phi = Math.acos(R(-1, 1));
      const speed = R(1.5, 4.4);
      velocities.push([
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.85,
        Math.sin(phi) * Math.sin(theta) * speed,
      ]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: shell.color,
      size: 0.16,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 1,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    shell.sparks = { points, velocities, positions };
    shell.life = 0;
    pulse = Math.min(1.4, pulse + 0.35);
  };

  let pixelRatio = Math.min(lite ? 1 : 1.5, window.devicePixelRatio || 1);
  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 56 : 46;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
  };
  resize();

  let storyTarget = 0;
  let story = 0;
  let pulse = 0;
  let moonPulse = 0;
  let blush = 0;
  let blushTarget = 0;
  let wind = 0;
  let musicPulse = 0;
  let musicTarget = 0;
  let last = 0;
  let running = !reduced;
  let frame = 0;
  let slowFrames = 0;
  let sampled = 0;
  const camPos = new THREE.Vector3(...PATH[0].p);
  const camLook = new THREE.Vector3(...PATH[0].l);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const skyColor = new THREE.Color(0x0a1230);

  const pickTarget = () => {
    wantPos.set(...along(story, 'p'));
    wantLook.set(...along(story, 'l'));
    const portrait = clamp01((0.92 - camera.aspect) / 0.55);
    if (portrait) {
      forward.subVectors(wantLook, wantPos).normalize();
      wantPos.addScaledVector(forward, -portrait * 2.8);
      wantPos.y += portrait * 0.8;
      wantLook.y += portrait * 0.45;
    }
  };

  const step = (now) => {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    clock += reduced ? 0 : dt;
    story += (storyTarget - story) * (reduced ? 1 : Math.min(1, dt * 2.2));
    pulse *= Math.exp(-dt * 3.2);
    moonPulse *= Math.exp(-dt * 1.8);
    blush += (blushTarget - blush) * Math.min(1, dt * 2.5);
    musicPulse += (musicTarget - musicPulse) * Math.min(1, dt * 8);
    musicTarget *= Math.exp(-dt * 2.4);
    wind *= Math.exp(-dt * 0.7);
    wind = Math.min(2.2, wind + musicPulse * dt * 1.6);
    pickTarget();
    camPos.lerp(wantPos, reduced ? 1 : Math.min(1, dt * 1.8));
    camLook.lerp(wantLook, reduced ? 1 : Math.min(1, dt * 1.8));
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    moonLight.target.position.set(0, 1.5, -12);
    moonGlow.material.opacity = 0.55 + moonPulse * 0.45 + pulse * 0.15;
    moonGlow.scale.setScalar(34 + moonPulse * 10);
    moonBlush.material.opacity = blush * 0.55;
    moonMesh.rotation.y = clock * 0.02;

    warmMat.color.setScalar(0.85 + pulse * 0.35 + moonPulse * 0.15);
    goldMat.color.setScalar(0.9 + pulse * 0.25);
    haloUniforms.uTime.value = clock;
    haloUniforms.uPulse.value = pulse + moonPulse * 0.5;
    fallMat.uniforms.uTime.value = clock;
    fallMat.uniforms.uWind.value = wind;
    seedMat.uniforms.uTime.value = clock;
    seedMat.uniforms.uWind.value = wind;
    seedMat.uniforms.uMusic.value = musicPulse;
    for (const s of swayStems) {
      const lean = Math.sin(clock * (1.45 + s.amp * 3) + s.phase) * s.amp + musicPulse * 0.22 + wind * 0.04;
      s.group.rotation.z = lean;
      s.group.rotation.x = lean * 0.35;
      if (s.head) {
        s.head.rotation.y = Math.sin(clock * 0.9 + s.phase) * 0.12;
        s.head.scale.setScalar(1 + musicPulse * 0.04);
      }
    }
    water.material.uniforms.uTime.value = clock;
    water.material.uniforms.uMoonPulse.value = moonPulse;
    sky.material.uniforms.uTime.value = clock;
    stars.material.uniforms.uTime.value = clock;
    scene.fog.density = 0.017 + 0.003 * Math.sin(clock * 0.15);

    for (let i = fireworks.length - 1; i >= 0; i--) {
      const shell = fireworks[i];
      const age = clock - shell.born;
      if (age < 0) continue;
      if (!shell.sparks) {
        const t = clamp01(age / shell.rise);
        const y = mix(shell.y0, shell.y1, t * t * (3 - 2 * t));
        if (shell.rocket) {
          shell.rocket.position.set(shell.x, y, shell.z);
          shell.trail.position.set(shell.x, y, shell.z);
          shell.trail.material.opacity = 0.55 + 0.4 * t;
        }
        if (t >= 1) {
          if (shell.rocket) {
            scene.remove(shell.rocket, shell.trail);
            shell.rocket.material.dispose();
            shell.trail.material.dispose();
            shell.rocket = null;
            shell.trail = null;
          }
          burstFirework(shell);
        } else if (t > 0.92) pulse = Math.max(pulse, 0.4);
      } else {
        shell.life += dt;
        const { points, velocities, positions } = shell.sparks;
        const arr = points.geometry.attributes.position.array;
        for (let k = 0; k < velocities.length; k++) {
          velocities[k][1] -= 4.2 * dt;
          velocities[k][0] *= 0.985;
          velocities[k][2] *= 0.985;
          if (shell.life < dt * 1.5) {
            positions[k * 3] = shell.x;
            positions[k * 3 + 1] = shell.y1;
            positions[k * 3 + 2] = shell.z;
          }
          positions[k * 3] += velocities[k][0] * dt;
          positions[k * 3 + 1] += velocities[k][1] * dt;
          positions[k * 3 + 2] += velocities[k][2] * dt;
          arr[k * 3] = positions[k * 3];
          arr[k * 3 + 1] = positions[k * 3 + 1];
          arr[k * 3 + 2] = positions[k * 3 + 2];
        }
        points.geometry.attributes.position.needsUpdate = true;
        points.material.opacity = Math.max(0, 1 - shell.life * 0.55);
        if (shell.life > 2.2) {
          scene.remove(points);
          points.geometry.dispose();
          points.material.dispose();
          fireworks.splice(i, 1);
        }
      }
    }

    for (let i = skyLanterns.length - 1; i >= 0; i--) {
      const l = skyLanterns[i];
      const age = clock - l.born;
      const rise = age * 0.55;
      const sway = Math.sin(age * 0.7 + l.seed) * 0.35;
      l.mesh.position.set(l.x + sway, l.y + rise, l.z + Math.cos(age * 0.5 + l.seed) * 0.25);
      l.glowSprite.position.copy(l.mesh.position);
      const fade = 1 - smooth(12, 18, age);
      l.mesh.material.opacity = fade;
      l.glowSprite.material.opacity = fade * (0.8 + 0.2 * Math.sin(age * 4));
      if (age > 18) {
        scene.remove(l.mesh, l.glowSprite);
        l.mesh.material.dispose();
        l.glowSprite.material.dispose();
        skyLanterns.splice(i, 1);
      }
    }

    renderer.setClearColor(skyColor);
    renderer.render(scene, camera);

    if (!reduced && sampled < 120) {
      sampled++;
      if (dt > 0.034) slowFrames++;
      if (sampled === 120 && slowFrames > 50 && pixelRatio > 0.8) {
        pixelRatio = pixelRatio > 1 ? 1 : 0.8;
        fallGeo.instanceCount = Math.floor(fallCount * 0.55);
        resize();
        sampled = 0;
        slowFrames = 0;
      }
    }
  };

  const loop = (now) => {
    if (!running) return;
    step(now);
    frame = requestAnimationFrame(loop);
  };
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  step(performance.now());
  if (!reduced) frame = requestAnimationFrame(loop);
  const renderStill = () => { if (reduced) step(performance.now()); };

  const onHide = () => {
    if (reduced) return;
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
    } else if (!running) {
      running = true;
      last = 0;
      frame = requestAnimationFrame(loop);
    }
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('resize', resize);

  /* 开场几朵烟花 */
  if (!reduced) {
    [[-1.5, -8], [2.0, -12], [0.2, -18], [-2.5, -15]].forEach(([x, z], i) => {
      spawnFirework(x, z, 0.6 + i * 0.55);
    });
  }

  return {
    setProgress(s) {
      storyTarget = Math.min(5, Math.max(0, s));
      renderStill();
    },
    pulseMoon(amount = 1) {
      moonPulse = Math.min(1.6, moonPulse + amount);
      pulse = Math.min(1.4, pulse + 0.35 * amount);
      renderStill();
    },
    blushMoon(on = true) {
      blushTarget = on ? 1 : 0;
      moonPulse = Math.min(1.6, moonPulse + 0.8);
      renderStill();
    },
    releaseLantern(opts = {}) {
      const x = opts.x ?? R(-2.2, 2.2);
      const y = opts.y ?? 1.2;
      const z = opts.z ?? R(-16, -6);
      spawnSkyLantern(x, y, z);
      wind = Math.min(1.6, wind + 0.35);
      pulse = Math.min(1.2, pulse + 0.25);
      renderStill();
    },
    launchFirework(opts = {}) {
      const x = opts.x ?? R(-3, 3);
      const z = opts.z ?? R(-20, -6);
      spawnFirework(x, z, opts.delay ?? 0, opts.color);
      renderStill();
    },
    cakeSplit() {
      wind = Math.min(2, wind + 0.9);
      pulse = Math.min(1.4, pulse + 0.55);
      haloUniforms.uWave.value = clock;
      moonPulse = Math.min(1.2, moonPulse + 0.35);
      renderStill();
    },
    setMusicPulse(amount = 0.6) {
      musicTarget = Math.min(1.4, Math.max(musicTarget, amount));
      wind = Math.min(2.2, wind + amount * 0.35);
      renderStill();
    },
    finale() {
      for (let i = 0; i < 5; i++) {
        spawnSkyLantern(R(-2.5, 2.5), 1.0 + R(0, 0.6), R(-18, -8));
        spawnFirework(R(-3.5, 3.5), R(-22, -8), 0.2 + i * 0.35);
      }
      moonPulse = 1.4;
      pulse = 1.2;
      renderStill();
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
