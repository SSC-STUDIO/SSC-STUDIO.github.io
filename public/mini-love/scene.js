/**
 * 夜色方块小岛。three 按需从 CDN 加载，失败时由页面继续显示信纸。
 * 镜头只按表白流程切换，不接受拖拽。
 */

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js';

const SHOTS = {
  arrive: { p: [0.2, 4.4, 9.2], l: [0, 1.15, 0] },
  mv1: { p: [-2.4, 2.5, 6.6], l: [0.1, 1.2, 0.2] },
  mv2: { p: [1.8, 1.9, 4.4], l: [0.35, 1.15, 0.15] },
  mv3: { p: [-3.4, 2.7, 5.2], l: [-1.15, 1.05, 0.1] },
  mv4: { p: [0.15, 1.55, 3.5], l: [0, 1.15, 0.05] },
  mv5: { p: [0.6, 3.4, 8.4], l: [0.4, 2.2, -2] },
  yes: { p: [0, 1.75, 3.9], l: [0, 1.15, 0] },
};

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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1430);
  scene.fog = new THREE.FogExp2(0x0c1430, 0.045);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  const look = new THREE.Vector3(0, 8, -12);
  camera.position.set(0, 7, 10);
  camera.lookAt(look);

  scene.add(new THREE.AmbientLight(0x6d7eab, 0.55));
  const moonLight = new THREE.DirectionalLight(0xfff0cc, 1.15);
  moonLight.position.set(2, 12, -14);
  scene.add(moonLight);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 28, 28),
    new THREE.MeshStandardMaterial({
      color: 0xfff3d4,
      emissive: 0xffe0a4,
      emissiveIntensity: 0.85,
      roughness: 1,
    })
  );
  moon.position.set(1.2, 9.2, -15);
  scene.add(moon);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(2.35, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.08 })
  );
  halo.position.copy(moon.position);
  scene.add(halo);

  const starPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 70;
    starPositions[i * 3 + 1] = 4 + Math.random() * 22;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 6;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6e4, size: 0.07, sizeAttenuation: true })));

  const block = (w, h, d, color, x, y, z, emissive = 0) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.94,
        metalness: 0,
        emissive,
        emissiveIntensity: emissive ? 0.9 : 0,
      })
    );
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  const grass = [0x3f7d52, 0x4c8d5e, 0x356b46];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (gx * gx + gz * gz > 10.5) continue;
      const x = gx * 0.96;
      const z = gz * 0.96;
      block(0.92, 0.42, 0.92, 0x6a5140, x, 0.02, z);
      block(0.92, 0.2, 0.92, grass[(gx + gz + 6) % 3], x, 0.32, z);
    }
  }

  block(0.28, 1.15, 0.28, 0x6b4632, 1.9, 0.95, -0.85);
  const canopy = [
    [1.9, 1.85, -0.85, 0.95, 0x2f6a40],
    [1.45, 1.7, -0.55, 0.7, 0x3d7a4c],
    [2.3, 1.72, -1.15, 0.72, 0x275c38],
    [1.7, 2.15, -1.05, 0.55, 0x4e8a58],
    [2.15, 2.05, -0.55, 0.5, 0x347248],
  ];
  canopy.forEach(([x, y, z, s, color]) => block(s, s * 0.72, s, color, x, y, z));
  [[1.55, 2.05, -0.7], [2.15, 1.95, -0.95], [1.85, 2.25, -1.1], [2.35, 1.8, -0.6]].forEach(([x, y, z]) => {
    block(0.08, 0.08, 0.08, 0xf6c453, x, y, z, 0xf0b429);
  });

  block(1.15, 0.85, 0.95, 0xc4a27a, -1.85, 0.82, 0.35);
  block(1.35, 0.28, 1.15, 0x8d4d45, -1.85, 1.32, 0.35);
  const windowPane = block(0.28, 0.32, 0.06, 0xffd27a, -1.45, 0.9, 0.84, 0xffb347);
  const windowLight = new THREE.PointLight(0xffb060, 1.3, 6);
  windowLight.position.set(-1.45, 0.95, 1.15);
  scene.add(windowLight);

  const lanterns = [];
  const addLantern = (x, z) => {
    block(0.05, 0.72, 0.05, 0x3a2c24, x, 0.85, z);
    const glow = block(0.16, 0.2, 0.16, 0xffb45c, x, 1.28, z, 0xff8c32);
    const light = new THREE.PointLight(0xffb45c, 0.9, 3.8);
    light.position.set(x, 1.28, z);
    scene.add(light);
    lanterns.push({ glow, light, x });
  };
  addLantern(-0.7, -1.15);
  addLantern(0.85, 1.35);

  const person = (x, z, cloth) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.22), new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.9 }));
    body.position.y = 0.21;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.22), new THREE.MeshStandardMaterial({ color: 0xf3d2c2, roughness: 0.85 }));
    head.position.y = 0.54;
    group.add(body, head);
    group.position.set(x, 0.42, z);
    scene.add(group);
    return group;
  };
  const him = person(-0.42, 1.15, 0x3c342f);
  const her = person(0.38, 1.05, 0xc46b7c);

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
    if (beat === 'moon') {
      const a = t * 0.18;
      desiredPos.set(Math.sin(a) * 5.5, 6.4 + Math.sin(t * 0.3) * 0.25, Math.cos(a) * 5.5 + 2);
      desiredLook.set(moon.position.x, moon.position.y, moon.position.z);
    }
    const k = reduced ? 1 : 0.035;
    camera.position.lerp(desiredPos, k);
    look.lerp(desiredLook, k);
    camera.lookAt(look);

    const yes = beat === 'yes' ? 1 : 0;
    him.position.x += ((-0.42 + yes * 0.28) - him.position.x) * 0.02;
    her.position.x += ((0.38 - yes * 0.28) - her.position.x) * 0.02;
    const glow = 1.1 + yes * 2.4;
    windowLight.intensity += (glow - windowLight.intensity) * 0.03;
    windowPane.material.emissiveIntensity = 0.7 + yes * 0.8;
    lanterns.forEach((lantern, i) => {
      lantern.light.intensity += (0.85 + yes * 1.6 - lantern.light.intensity) * 0.03;
      lantern.glow.position.y = 1.28 + Math.sin(t * 1.6 + i) * 0.03;
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
    desiredPos.set(0, 6.6, 8);
    desiredLook.copy(moon.position);
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
