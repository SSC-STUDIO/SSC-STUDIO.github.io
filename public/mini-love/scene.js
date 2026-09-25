/**
 * 夜色方块小岛。three 按需从 CDN 加载，失败时由页面继续显示信纸。
 * 镜头只按表白流程切换，不接受拖拽。
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const SHOTS = {
  arrive: { p: [0.2, 5.2, 11], l: [0, 1.3, 0] },
  mv1: { p: [-3.2, 3.2, 8.2], l: [0.1, 1.3, 0.2] },
  mv2: { p: [2.4, 2.4, 5.6], l: [0.3, 1.2, 0.1] },
  mv3: { p: [-4.2, 3.4, 6.4], l: [-1.2, 1.2, 0] },
  mv4: { p: [0.2, 2.05, 4.6], l: [0, 1.2, 0] },
  mv5: { p: [1.2, 4.6, 12], l: [0.2, 2.4, -4] },
  yes: { p: [0, 2.15, 4.8], l: [0, 1.2, 0] },
};

function canvasTexture(THREE, draw, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function mountIsland(canvas, { reduced = false } = {}) {
  if (!canvas) return null;
  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch {
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1030, 0.028);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
  const look = new THREE.Vector3(0, 6, -20);
  camera.position.set(0, 8, 12);

  const moonPos = new THREE.Vector3(6, 18, -36);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 48, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uMoon: { value: moonPos.clone() },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDir = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uMoon;
        uniform float uTime;
        varying vec3 vDir;
        float hash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z);
        }
        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y * 0.55 + 0.08, 0.0, 1.0);
          vec3 zenith = vec3(0.025, 0.03, 0.09);
          vec3 mid = vec3(0.09, 0.07, 0.20);
          vec3 horizon = vec3(0.36, 0.18, 0.28);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.42, h));
          col = mix(col, zenith, smoothstep(0.28, 0.9, h));
          float band = exp(-pow((dir.x * 0.25 + dir.y * 0.92 - 0.05) / 0.16, 2.0));
          float n1 = noise(dir * 5.0 + vec3(uTime * 0.008, 0.0, 0.0));
          float n2 = noise(dir * 14.0);
          col += vec3(0.55, 0.40, 0.72) * band * (0.18 + 0.7 * n1) * 0.85;
          col += vec3(0.95, 0.55, 0.62) * band * n2 * 0.08;
          float veil = noise(dir * 2.2 + 4.0);
          col += vec3(0.18, 0.10, 0.22) * veil * 0.18 * (1.0 - h);
          vec3 m = normalize(uMoon);
          float md = dot(dir, m);
          col += vec3(1.0, 0.86, 0.58) * pow(max(md, 0.0), 28.0) * 0.7;
          col += vec3(1.0, 0.72, 0.48) * pow(max(md, 0.0), 6.0) * 0.16;
          col += vec3(0.55, 0.35, 0.55) * pow(max(md, 0.0), 2.0) * 0.05;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  scene.add(sky);

  const starCount = reduced ? 400 : 1100;
  const starPos = new Float32Array(starCount * 3);
  const starPhase = new Float32Array(starCount);
  const starSize = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = Math.random() * 0.92 + 0.02;
    const ring = Math.sqrt(1 - y * y);
    const radius = 90 + Math.random() * 40;
    starPos[i * 3] = Math.cos(theta) * ring * radius;
    starPos[i * 3 + 1] = (y - 0.15) * radius;
    starPos[i * 3 + 2] = Math.sin(theta) * ring * radius;
    starPhase[i] = Math.random() * 6.28;
    starSize[i] = Math.random() < 0.08 ? 2.4 + Math.random() * 1.6 : 0.6 + Math.random() * 1.1;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
  const stars = new THREE.Points(
    starGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aPhase;
        attribute float aSize;
        uniform float uTime;
        varying float vTw;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vTw = 0.45 + 0.55 * sin(uTime * (0.8 + aSize * 0.15) + aPhase);
          gl_PointSize = aSize * vTw * (220.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vTw;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = dot(p, p);
          if (d > 0.25) discard;
          float a = smoothstep(0.25, 0.02, d) * vTw;
          gl_FragColor = vec4(1.0, 0.95, 0.86, a);
        }
      `,
    })
  );
  scene.add(stars);

  const moonMap = canvasTexture(THREE, (g, s) => {
    g.fillStyle = '#f7e7c4';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 2 + Math.random() * 16;
      g.fillStyle = `rgba(${150 + Math.random() * 40}, ${120 + Math.random() * 30}, ${80}, ${0.15 + Math.random() * 0.35})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,236,200,0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x - r * 0.2, y - r * 0.2, r * 0.72, 0, Math.PI * 2);
      g.stroke();
    }
  });
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.1, 48, 48),
    new THREE.MeshStandardMaterial({
      map: moonMap,
      color: 0xfff6e4,
      emissive: 0xffe3b0,
      emissiveIntensity: 0.55,
      roughness: 1,
      fog: false,
    })
  );
  moon.position.copy(moonPos);
  scene.add(moon);

  const glowTex = canvasTexture(THREE, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.5);
    grd.addColorStop(0, 'rgba(255,236,190,0.95)');
    grd.addColorStop(0.25, 'rgba(255,214,150,0.35)');
    grd.addColorStop(0.6, 'rgba(255,180,140,0.08)');
    grd.addColorStop(1, 'rgba(255,180,140,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }, 512);
  [7.5, 14, 22].forEach((scale, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0.55 - i * 0.14,
      blending: THREE.AdditiveBlending,
    }));
    sprite.position.copy(moonPos);
    sprite.scale.setScalar(scale);
    scene.add(sprite);
  });

  const cloudTex = canvasTexture(THREE, (g, s) => {
    g.clearRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      const x = s * (0.2 + Math.random() * 0.6);
      const y = s * (0.35 + Math.random() * 0.3);
      const grd = g.createRadialGradient(x, y, 4, x, y, 28 + Math.random() * 30);
      grd.addColorStop(0, 'rgba(255,236,220,0.55)');
      grd.addColorStop(1, 'rgba(255,236,220,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, 50, 0, Math.PI * 2);
      g.fill();
    }
  }, 256);
  const clouds = [];
  for (let i = 0; i < (reduced ? 3 : 7); i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.22 + Math.random() * 0.18,
      fog: false,
    }));
    sprite.position.set((Math.random() - 0.5) * 40, 6 + Math.random() * 8, -8 - Math.random() * 24);
    const sc = 8 + Math.random() * 10;
    sprite.scale.set(sc * 1.8, sc, 1);
    sprite.userData.speed = 0.15 + Math.random() * 0.25;
    scene.add(sprite);
    clouds.push(sprite);
  }

  scene.add(new THREE.AmbientLight(0x8ea0c8, 0.42));
  const moonLight = new THREE.DirectionalLight(0xfff1d2, 1.35);
  moonLight.position.copy(moonPos);
  scene.add(moonLight);
  scene.add(new THREE.HemisphereLight(0x6a78b4, 0x2a2018, 0.35));

  const mats = new Map();
  const matFor = (color, emissive = 0) => {
    const key = `${color}-${emissive}`;
    if (!mats.has(key)) {
      mats.set(key, new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0,
        emissive,
        emissiveIntensity: emissive ? 0.85 : 0,
      }));
    }
    return mats.get(key);
  };
  const block = (w, h, d, color, x, y, z, emissive = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matFor(color, emissive));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  const grassColors = [0x3c7a4e, 0x4d8c5c, 0x2f6842, 0x5a9464];
  const dirtColors = [0x6a5040, 0x5c4638, 0x7a5c48];
  const tiles = [];
  for (let gx = -6; gx <= 6; gx++) {
    for (let gz = -6; gz <= 6; gz++) {
      const dist = gx * gx + gz * gz;
      if (dist > 28) continue;
      const h = 0.22 + Math.max(0, Math.sin(gx * 0.85) * 0.28 + Math.cos(gz * 0.7) * 0.22) + (dist < 8 ? 0.18 : 0);
      const x = gx * 0.92;
      const z = gz * 0.92;
      block(0.88, h, 0.88, dirtColors[(gx + gz + 12) % 3], x, h * 0.5 - 0.15, z);
      const top = block(0.88, 0.16, 0.88, grassColors[(gx * 3 + gz + 20) % 4], x, h - 0.02, z);
      tiles.push(top.position.y);
      if (Math.random() < 0.18 && dist > 3 && dist < 22) {
        block(0.08, 0.22 + Math.random() * 0.15, 0.08, 0x2d6a40, x + 0.2, h + 0.12, z);
      }
      if (Math.random() < 0.08) {
        block(0.1, 0.1, 0.1, Math.random() < 0.5 ? 0xe7a0b4 : 0xf2d48a, x - 0.15, h + 0.08, z + 0.1);
      }
    }
  }

  for (let i = -2; i <= 2; i++) {
    block(0.34, 0.08, 0.34, 0xd9c7a4, i * 0.42, 0.62, 0.85);
  }
  block(1.15, 0.08, 0.85, 0x1d4c66, 0.15, 0.5, -1.55, 0x12384c);

  const trunk = (x, z, h) => block(0.26, h, 0.26, 0x6d4934, x, h * 0.5 + 0.35, z);
  trunk(2.15, -1.05, 1.35);
  const leaf = [0x2c6840, 0x3d7c50, 0x245836, 0x4e8a5a];
  const blobs = [
    [2.15, 2.05, -1.05, 1.05], [1.65, 1.85, -0.65, 0.78], [2.65, 1.9, -1.4, 0.8],
    [2.0, 2.45, -1.35, 0.62], [2.45, 2.35, -0.7, 0.58], [1.8, 1.7, -1.45, 0.5],
  ];
  blobs.forEach(([x, y, z, s], i) => block(s, s * 0.7, s, leaf[i % leaf.length], x, y, z));
  for (let i = 0; i < 18; i++) {
    block(0.07, 0.07, 0.07, 0xf6c453, 1.5 + Math.random() * 1.5, 1.7 + Math.random() * 0.9, -1.6 + Math.random() * 1.1, 0xf0b429);
  }
  trunk(-3.1, 1.4, 0.9);
  block(0.7, 0.5, 0.7, 0x346848, -3.1, 1.35, 1.4);

  block(1.25, 0.95, 1.05, 0xc9a888, -2.05, 0.95, 0.45);
  block(1.55, 0.22, 1.35, 0x8c4c44, -2.05, 1.5, 0.45);
  block(1.15, 0.12, 0.95, 0x9a564c, -2.05, 1.66, 0.45);
  block(0.22, 0.28, 0.22, 0x6a4038, -1.7, 1.72, 0.15);
  block(0.34, 0.55, 0.06, 0x6e4a38, -2.05, 0.72, 0.99);
  const windowPanes = [
    block(0.26, 0.3, 0.05, 0xffd27a, -1.62, 1.02, 0.98, 0xffb347),
    block(0.22, 0.26, 0.05, 0xffd9a0, -2.4, 1.08, 0.98, 0xffc46a),
  ];
  const windowLight = new THREE.PointLight(0xffb060, 1.6, 8);
  windowLight.position.set(-2.0, 1.15, 1.4);
  scene.add(windowLight);
  block(0.7, 0.1, 0.4, 0xb08968, -2.05, 0.52, 1.15);

  const lanterns = [];
  const addLantern = (x, z, hue = 0xffb45c) => {
    block(0.05, 0.85, 0.05, 0x3a2c24, x, 0.9, z);
    const glow = block(0.16, 0.22, 0.16, hue, x, 1.38, z, hue);
    const light = new THREE.PointLight(hue, 0.85, 4.2);
    light.position.set(x, 1.38, z);
    scene.add(light);
    lanterns.push({ glow, light });
  };
  addLantern(-0.85, -1.35);
  addLantern(0.95, 1.55);
  addLantern(2.55, 0.4, 0xff8f6a);
  addLantern(-2.7, -0.8, 0xffd27a);

  for (let i = 0; i < 6; i++) {
    const x = -1.2 + i * 0.55;
    const y = 2.15 + Math.sin(i) * 0.12;
    const z = -0.2 + i * 0.08;
    block(0.07, 0.07, 0.07, i % 2 ? 0xffd0a0 : 0xff9eb4, x, y, z, i % 2 ? 0xffc46a : 0xff8aa8);
  }

  const person = (x, z, cloth, hair) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.2), matFor(cloth));
    body.position.y = 0.28;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.2), matFor(0xf3d2c2));
    head.position.y = 0.62;
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.22), matFor(hair));
    hairMesh.position.y = 0.74;
    group.add(body, head, hairMesh);
    group.position.set(x, 0.55, z);
    scene.add(group);
    return group;
  };
  const him = person(-0.48, 1.25, 0x3c342f, 0x2a2420);
  const her = person(0.42, 1.15, 0xc46b7c, 0x4a3038);

  [[-14, 1.2, -6], [16, 0.6, -10], [-8, 0.4, 14]].forEach(([x, y, z]) => {
    block(1.4, 0.7, 1.4, 0x4a6a48, x, y, z);
    block(0.8, 0.45, 0.8, 0x3d5c3c, x + 0.4, y + 0.4, z - 0.2);
  });

  const dustCount = reduced ? 0 : 80;
  const dustPos = new Float32Array(dustCount * 3);
  const dustHome = [];
  for (let i = 0; i < dustCount; i++) {
    const p = [(Math.random() - 0.5) * 8, 0.8 + Math.random() * 2.4, (Math.random() - 0.5) * 8];
    dustPos.set(p, i * 3);
    dustHome.push(p);
  }
  let dust = null;
  if (dustCount) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffe1a8,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }));
    scene.add(dust);
  }

  const shots = [];
  const spawnShot = () => {
    if (shots.length > 4) return;
    const y = 8 + Math.random() * 10;
    const x = (Math.random() - 0.5) * 30;
    const z = -10 - Math.random() * 20;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x - 1.6, y - 0.45, z + 0.2),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xfff6e0,
      transparent: true,
      opacity: 0.9,
      fog: false,
    }));
    scene.add(line);
    shots.push({ line, life: 1, vx: -8 - Math.random() * 6, vy: -2.2 });
  };

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
  };
  resize();

  const desiredPos = new THREE.Vector3().copy(camera.position);
  const desiredLook = new THREE.Vector3().copy(look);
  let beat = 'moon';
  let running = !reduced;
  let frame = 0;
  let nextShot = 2.5;

  const applyShot = (instant) => {
    if (beat === 'moon') return;
    const shot = SHOTS[beat] || SHOTS.arrive;
    desiredPos.set(shot.p[0], shot.p[1], shot.p[2]);
    desiredLook.set(shot.l[0], shot.l[1], shot.l[2]);
    if (instant) {
      camera.position.copy(desiredPos);
      look.copy(desiredLook);
    }
  };

  const render = (now) => {
    const t = (now || 0) / 1000;
    sky.material.uniforms.uTime.value = t;
    stars.material.uniforms.uTime.value = t;
    if (beat === 'moon') {
      const a = t * 0.12;
      desiredPos.set(Math.sin(a) * 7, 7.2 + Math.sin(t * 0.25) * 0.3, Math.cos(a) * 7 + 4);
      desiredLook.copy(moonPos);
    }
    const k = reduced ? 1 : 0.03;
    camera.position.lerp(desiredPos, k);
    look.lerp(desiredLook, k);
    camera.lookAt(look);

    clouds.forEach((cloud) => {
      cloud.position.x += cloud.userData.speed * 0.01;
      if (cloud.position.x > 28) cloud.position.x = -28;
    });
    if (dust) {
      const arr = dust.geometry.attributes.position.array;
      for (let i = 0; i < dustCount; i++) {
        const home = dustHome[i];
        arr[i * 3] = home[0] + Math.sin(t * 0.7 + i) * 0.18;
        arr[i * 3 + 1] = home[1] + Math.sin(t * 1.3 + i * 0.5) * 0.12;
        arr[i * 3 + 2] = home[2] + Math.cos(t * 0.6 + i) * 0.18;
      }
      dust.geometry.attributes.position.needsUpdate = true;
    }
    if (!reduced && t > nextShot) {
      spawnShot();
      nextShot = t + 4 + Math.random() * 5;
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      shot.life -= 0.02;
      const pos = shot.line.geometry.attributes.position;
      for (let v = 0; v < 2; v++) {
        pos.setX(v, pos.getX(v) + shot.vx * 0.016);
        pos.setY(v, pos.getY(v) + shot.vy * 0.016);
      }
      pos.needsUpdate = true;
      shot.line.material.opacity = Math.max(0, shot.life);
      if (shot.life <= 0) {
        scene.remove(shot.line);
        shot.line.geometry.dispose();
        shots.splice(i, 1);
      }
    }

    const yes = beat === 'yes' ? 1 : 0;
    him.position.x += ((-0.48 + yes * 0.32) - him.position.x) * 0.02;
    her.position.x += ((0.42 - yes * 0.32) - her.position.x) * 0.02;
    const glow = 1.4 + yes * 2.6 + Math.sin(t * 2.2) * 0.08;
    windowLight.intensity += (glow - windowLight.intensity) * 0.03;
    windowPanes.forEach((pane) => { pane.material.emissiveIntensity = 0.65 + yes * 0.7; });
    lanterns.forEach((lantern, i) => {
      const flicker = 0.8 + Math.sin(t * 3.1 + i * 1.7) * 0.08;
      lantern.light.intensity += (flicker + yes * 1.5 - lantern.light.intensity) * 0.04;
      lantern.glow.position.y = 1.38 + Math.sin(t * 1.5 + i) * 0.025;
    });
    renderer.render(scene, camera);
  };

  const loop = (now) => {
    if (!running) return;
    render(now);
    frame = requestAnimationFrame(loop);
  };

  applyShot(true);
  if (beat === 'moon') {
    desiredPos.set(0, 7.4, 10);
    desiredLook.copy(moonPos);
    camera.position.copy(desiredPos);
    look.copy(desiredLook);
    camera.lookAt(look);
  }
  render(0);
  if (!reduced) frame = requestAnimationFrame(loop);

  const onHide = () => {
    if (reduced) return;
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
    } else if (!running) {
      running = true;
      frame = requestAnimationFrame(loop);
    }
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('resize', resize);

  return {
    setBeat(next) {
      if (!SHOTS[next] && next !== 'moon') return;
      beat = next;
      applyShot(reduced);
      if (reduced) render(0);
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
