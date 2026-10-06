// Iacon, drawn: the Autobots' capital at night in the last days of the war,
// the way Fall of Cybertron shows it. Plated towers stepping back as they
// climb, lit along their edges and in bands of windows; energon running in
// the gutters of the boulevard and the cross streets; the Hall of Records
// across the end of the plaza with its columns and the Autobots' mark over
// the door, Autobot HQ beside it; the gate's pylons burning, barricades and
// crates where the Autobots hold the line; the pad to the west with the
// space bridge standing on it, its portal turning; Metroplex on the skyline
// and Trypticon far off; fires, smoke, searchlights, Jetfire going over, and
// Soundwave watching from a roof. Everything here comes from the area's own
// data (areas/iacon.js), so the walls you walk into are the walls you see.
//
// buildStage(area, { renderer, tier }) → Promise<{ group, update(t, dt, camera), dispose }>

import * as THREE from 'three';
import { makeFigure, makeThing } from '../bots';
import { buildSkyline, drum, hash, makeFires, makeSky, makeStrips, merged, platedMaterial, slab, tower } from './common';

const ENERGON = '#3fd2ff';
const FIRE = '#ff7a2a';

// A soft round glow, for eyes and lamps seen from far off
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The Autobots' mark, painted once on a canvas, to glow over the Hall's door
function insignia(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.fillStyle = color;
  g.beginPath();
  // a face in planes: brow, cheeks, mouth, as the Autobots' mark has it
  const pts = [[-90, -100], [-30, -60], [30, -60], [90, -100], [100, -10], [70, 10], [80, 90], [30, 110], [0, 70], [-30, 110], [-80, 90], [-70, 10], [-100, -10]];
  pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(-8, -60, 16, 70);
  g.beginPath();
  g.moveTo(-55, -20);
  g.lineTo(-15, 0);
  g.lineTo(-55, 15);
  g.fill();
  g.beginPath();
  g.moveTo(55, -20);
  g.lineTo(15, 0);
  g.lineTo(55, 15);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The space bridge's portal: a swirl of energon, turning
const PORTAL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float a = atan(q.y, q.x);
    float swirl = 0.5 + 0.5 * sin(a * 6.0 + r * 18.0 - uTime * 6.0);
    float rim = smoothstep(1.0, 0.85, r) * smoothstep(0.55, 0.95, r);
    float core = smoothstep(0.7, 0.0, r);
    vec3 col = uColor * (swirl * 1.8 * rim + core * (0.6 + 0.4 * sin(uTime * 3.0)) * 1.5) + vec3(1.0) * pow(core, 4.0) * 1.5;
    float alpha = smoothstep(1.0, 0.9, r);
    gl_FragColor = vec4(col * alpha, alpha);
  }`;

export async function buildStage(area, { tier = 'high' } = {}) {
  const S = area.stage;
  const group = new THREE.Group();
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);
  const small = tier === 'low';

  // the sky, and the light: the moons' cold light, the sky's, the fires'
  const sky = makeSky('iacon', { fire: FIRE });
  group.add(sky);
  const hemi = new THREE.HemisphereLight('#3a4a76', '#120e0c', 0.55);
  const moon = new THREE.DirectionalLight('#a8bcff', 1.15);
  moon.position.set(-300, 420, -500);
  moon.target.position.set(0, 0, 0);
  group.add(hemi, moon, moon.target);
  if (tier === 'high') {
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = sc.bottom = -120;
    sc.right = sc.top = 120;
    sc.near = 10;
    sc.far = 1400;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.6;
  }

  // the ground: plated deck, finer than the walls
  const B = area.bounds;
  const groundMat = keep(platedMaterial({ base: '#20242b', alt: '#2a3039', trim: '#3a4250', windows: 0, panel: [7, 7], roughness: 0.78, metalness: 0.35 }));
  const groundGeo = slab(0, 0, B.maxX + 600, B.maxZ + 600, -1, 0, 0, 0.5);
  const ground = new THREE.Mesh(keep(groundGeo), groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // the city: every tower, the Hall, HQ, the pylons and the rest, in one draw
  const parts = [];
  const strips = [];
  const warn = []; // the barricades' warning lights, amber
  const fire = [];
  let ti = 0;
  for (const s of area.solids) {
    const seed = hash(ti + 0.5);
    switch (s.tag) {
      case 'tower':
        tower(s, ti++, parts, strips);
        break;
      case 'hall': {
        // stepped base, the long block with its columns, a dome and spire
        for (let k = 0; k < 3; k++) parts.push(slab(s.x, s.z + 6, s.hw + 12 - k * 4, s.hd + 10 - k * 3, k * 1.2, (k + 1) * 1.2, 0, 0.9));
        parts.push(slab(s.x, s.z, s.hw, s.hd, 3.6, s.top * 0.72, 0, 0.91));
        parts.push(slab(s.x, s.z - 6, s.hw * 0.8, s.hd * 0.7, s.top * 0.72, s.top * 0.86, 0, 0.92));
        parts.push(drum(s.x, s.z - 4, 22, 10, s.top * 0.86, s.top, 16, 0.93));
        parts.push(drum(s.x, s.z - 4, 3, 0.4, s.top, s.top + 40, 8, 0.93));
        for (let k = -4; k <= 4; k++) parts.push(drum(s.x + k * 15, s.z + s.hd + 4, 2.6, 2.2, 3.6, s.top * 0.62, 10, 0.94));
        strips.push([s.x - s.hw, s.z + s.hd + 0.3, s.x + s.hw, s.z + s.hd + 0.3, s.top * 0.62, 0.5, 0.8]);
        break;
      }
      case 'hq':
        parts.push(slab(s.x, s.z, s.hw, s.hd, 0, s.top * 0.55, 0, 0.8));
        parts.push(slab(s.x, s.z, s.hw * 0.7, s.hd * 0.65, s.top * 0.55, s.top, 0, 0.81));
        parts.push(drum(s.x, s.z, s.hw * 0.9, s.hw * 0.9, s.top * 0.55, s.top * 0.55 + 2, 24, 0.82));
        parts.push(drum(s.x, s.z, 1.2, 0.3, s.top, s.top + 50, 6, 0.83));
        strips.push([s.x - s.hw, s.z - s.hd - 0.2, s.x - s.hw, s.z + s.hd + 0.2, s.top * 0.55 - 1, 0.6, 0.6]);
        break;
      case 'pylon':
        parts.push(slab(s.x, s.z, s.hw, s.hd, 0, s.top * 0.8, 0.0, 0.3 + seed * 0.1));
        parts.push(drum(s.x, s.z, Math.min(s.hw, s.hd), 1, s.top * 0.8, s.top, 4, 0.3));
        fire.push([s.x + (s.x < 0 ? 14 : -14), s.top * 0.55, s.z - 10, 16]);
        break;
      case 'barricade':
        parts.push(slab(s.x, s.z, s.hw, s.hd, 0, s.top, s.yaw ?? 0, 0.6));
        warn.push([s.x - Math.cos(s.yaw ?? 0) * s.hw, s.z + Math.sin(s.yaw ?? 0) * s.hw, s.x + Math.cos(s.yaw ?? 0) * s.hw, s.z - Math.sin(s.yaw ?? 0) * s.hw, s.top, 0.3, 0.15]);
        break;
      case 'crate':
        parts.push(slab(s.x, s.z, s.hw, s.hd, 0, s.top, s.yaw ?? 0, 0.65 + seed * 0.2));
        break;
      case 'pad':
        parts.push(drum(s.x, s.z, s.r, s.r, 0, s.top, 48, 0.7));
        parts.push(drum(s.x, s.z, s.r * 0.35, s.r * 0.35, s.top, s.top + 0.3, 32, 0.72));
        break;
      case 'plinth':
        parts.push(drum(s.x, s.z, s.r, s.r * 0.85, 0, s.top, 24, 0.75));
        break;
      default:
        parts.push(s.kind === 'circle' ? drum(s.x, s.z, s.r, s.r, s.base ?? 0, s.top, 16, 0.5) : slab(s.x, s.z, s.hw, s.hd, s.base ?? 0, s.top, s.yaw ?? 0, 0.5));
    }
  }
  // sky-bridges across the streets between towers facing each other, lit
  // underneath; energon pylons down both sides of the boulevard
  const towers = area.solids.filter((x) => x.tag === 'tower');
  for (const [k, a] of towers.entries()) {
    if (hash(k * 1.7) > 0.35) continue;
    // the nearest tower across a street (a gap of 12 to 70 m)
    let best = null;
    let bestD = Infinity;
    for (const b of towers) {
      if (b === a) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const gapX = Math.abs(dx) - a.hw - b.hw;
      const gapZ = Math.abs(dz) - a.hd - b.hd;
      const across = (gapX > 12 && gapX < 70 && Math.abs(dz) < Math.min(a.hd, b.hd)) || (gapZ > 12 && gapZ < 70 && Math.abs(dx) < Math.min(a.hw, b.hw));
      const d = Math.hypot(dx, dz);
      if (across && d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) continue;
    const y = 30 + hash(k * 3.1) * Math.min(a.top, best.top) * 0.5;
    const len = bestD;
    const yaw = Math.atan2(best.x - a.x, best.z - a.z);
    const mx = (a.x + best.x) / 2;
    const mz = (a.z + best.z) / 2;
    parts.push(slab(mx, mz, 3.2, len / 2, y, y + 2.4, yaw, 0.55));
    parts.push(slab(mx, mz, 3.6, len / 2, y + 2.4, y + 3.2, yaw, 0.56));
    strips.push([a.x + Math.sin(yaw) * 0, a.z, best.x, best.z, y - 0.2, 0.6, 0.15]);
  }
  const posts = [];
  for (let z = -170; z < 390; z += 42)
    for (const x of [-S.boulevard + 4, S.boulevard - 4]) {
      parts.push(drum(x, z, 0.9, 0.5, 0, 14, 6, 0.45));
      posts.push([x, z]);
    }
  // wreckage in the streets: plates torn off, girders, a burnt-out car or two
  for (let k = 0; k < (small ? 40 : 110); k++) {
    const onBoulevard = hash(k * 9.1) < 0.6;
    const x = onBoulevard ? (hash(k * 2.3) - 0.5) * S.boulevard * 1.8 : (hash(k * 2.3) - 0.5) * 760;
    const z = onBoulevard ? 60 + hash(k * 4.7) * 340 : S.streets[k % 2] + (hash(k * 5.9) - 0.5) * 24;
    const big = hash(k * 7.7);
    const h = 0.4 + big * 2.2;
    // (tipped over where it lies: turned about its own middle, then put there)
    const g = slab(0, 0, 0.6 + big * 2.6, 0.4 + hash(k) * 1.6, -0.3, h, 0, 0.6);
    g.rotateX((hash(k * 8.8) - 0.5) * 0.5);
    g.rotateY(hash(k * 1.3) * 6);
    g.translate(x, 0, z);
    parts.push(g);
  }
  const cityMat = keep(platedMaterial({ lights: 'slits', windows: 0.22, base: '#2a303a', alt: '#3a4250', trim: '#6a7484', panel: [6, 3.6], metalness: 0.75, roughness: 0.45 }));
  const city = new THREE.Mesh(keep(merged(parts)), cityMat);
  city.castShadow = tier === 'high';
  city.receiveShadow = true;
  group.add(city);

  // the megastructures beyond the city
  for (const m of buildSkyline(S.skyline, { cool: ENERGON, hot: '#ff8a2a', keep })) group.add(m);

  // light along the towers' edges, the setbacks, the barricades' tops
  const edges = makeStrips(strips, ENERGON, 1.6);
  if (edges) group.add(edges) && keep(edges.material);
  const amber = makeStrips(warn, '#ffa23a', 2);
  if (amber) group.add(amber) && keep(amber.material);

  // energon in the gutters: along the boulevard and both cross streets
  const W = S.boulevard;
  const gutters = [
    [-W, -190, -W, B.maxZ],
    [W, -190, W, B.maxZ],
    ...S.streets.flatMap((z) => [
      [B.minX, z - 15, -W, z - 15],
      [W, z - 15, B.maxX, z - 15],
      [B.minX, z + 15, -W, z + 15],
      [W, z + 15, B.maxX, z + 15],
    ]),
  ].map(([x0, z0, x1, z1]) => [x0, z0, x1, z1, 0.02, 0.5, 0.06]);
  // the plaza's ring and the pad's
  const ring = (cx, cz, r, n) => Array.from({ length: n }, (_, k) => {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    return [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cz + Math.sin(a1) * r, 0.02, 0.5, 0.08];
  });
  const padTop = 1;
  const floorLights = makeStrips([...gutters, ...ring(S.plaza.x, S.plaza.z, S.plaza.r - 6, 48), ...ring(S.pad.x, S.pad.z, S.pad.r - 4, 48).map((g) => [...g.slice(0, 4), padTop + 0.02, ...g.slice(5)])], ENERGON, 1.6);
  group.add(floorLights);
  keep(floorLights.material);
  const tops = new THREE.InstancedMesh(keep(new THREE.OctahedronGeometry(1.1, 0)), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(ENERGON).multiplyScalar(3), toneMapped: false })), posts.length);
  posts.forEach(([x, z], k) => tops.setMatrixAt(k, new THREE.Matrix4().makeTranslation(x, 15, z)));
  group.add(tops);
  // the Autobots' mark glowing high on a few towers
  const markTex = keep(insignia('#5fd8ff'));
  const markMat = keep(new THREE.MeshBasicMaterial({ map: markTex, transparent: true, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8), depthWrite: false }));
  for (const [k, t] of towers.entries()) {
    if (hash(k * 5.3) > 0.12 || t.top < 140) continue;
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(18, 18)), markMat);
    const face = Math.abs(t.x) > S.boulevard ? -Math.sign(t.x) : 1; // the side toward the boulevard
    m.position.set(t.x + face * (t.hw + 0.6), t.top * 0.62, t.z);
    m.rotation.y = face * (Math.PI / 2);
    group.add(m);
  }

  // the Autobots' mark over the Hall's door
  const hall = area.solids.find((s) => s.tag === 'hall');
  if (hall) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), keep(new THREE.MeshBasicMaterial({ map: keep(insignia('#ff4b4b')), transparent: true, toneMapped: false, color: new THREE.Color(2.2, 2.2, 2.2) })));
    mark.position.set(hall.x, hall.top * 0.75, hall.z + hall.hd + 0.5);
    group.add(mark);
  }

  // the space bridge on its pad, the portal turning in it
  const portalU = { uTime: { value: 0 }, uColor: { value: new THREE.Color(ENERGON) } };
  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(15, 64),
    keep(new THREE.ShaderMaterial({ uniforms: portalU, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: PORTAL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })),
  );
  portal.position.set(S.pad.x, padTop + 20, S.pad.z);
  portal.rotation.y = Math.PI / 4;
  group.add(portal);
  makeThing('space-bridge').then((bridge) => {
    bridge.position.set(S.pad.x, padTop, S.pad.z);
    bridge.rotation.y = Math.PI / 4;
    group.add(bridge);
  });

  // energon pooled in the plinth at the plaza's middle
  makeThing('energon').then((e) => {
    e.scale.setScalar(3.2);
    e.position.set(S.plaza.x, 6, S.plaza.z);
    e.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(ENERGON);
        o.material.emissiveIntensity = 1.4;
        disposables.push(o.material);
      }
    });
    group.add(e);
  });

  const glowMat = keep(new THREE.SpriteMaterial({ map: keep(glowTexture()), color: new THREE.Color(ENERGON).multiplyScalar(3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false }));
  // Metroplex on the skyline, Trypticon far off. Metroplex sleeps till
  // Jetfire's beacons wake him: then his eyes and his chest light, he turns
  // to look over the city, and a searchlight sweeps from his head
  const metroplex = { model: null, eyes: null, beam: null, woke: -1, at: S.metroplex };
  for (const [kind, at] of [
    ['metroplex', S.metroplex],
    ['trypticon', S.trypticon],
  ]) {
    makeThing(kind).then((m) => {
      m.position.set(at.x, 0, at.z);
      m.rotation.y = at.yaw;
      group.add(m);
      if (kind !== 'metroplex') return;
      metroplex.model = m;
      // (where his head and chest are, from his size: he faces along his yaw)
      const box = new THREE.Box3().setFromObject(m);
      const h = box.max.y - box.min.y;
      const front = Math.min(box.max.x - box.min.x, box.max.z - box.min.z) * 0.32;
      const eyes = new THREE.Group();
      for (const [y, x, s] of [
        [0.9, -0.035, 0.05],
        [0.9, 0.035, 0.05],
        [0.66, 0, 0.16],
      ]) {
        const glow = new THREE.Sprite(keep(glowMat.clone()));
        glow.position.set(x * h, y * h, front);
        glow.scale.setScalar(s * h);
        eyes.add(glow);
      }
      m.add(eyes);
      eyes.scale.setScalar(1 / m.scale.x); // (the model's own scale undone: these are in metres)
      eyes.visible = false;
      metroplex.eyes = eyes;
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(at.x + Math.sin(at.yaw) * front, h * 0.9, at.z + Math.cos(at.yaw) * front);
      beam.scale.set(3, 2.4, 3);
      beam.visible = false;
      group.add(beam);
      metroplex.beam = beam;
    });
  }

  // cars parked, Soundwave on a roof by the gate
  for (const p of S.parked ?? []) {
    makeThing(p.kind).then((m) => {
      m.position.set(p.x, 0, p.z);
      m.rotation.y = p.yaw;
      group.add(m);
    });
  }
  const roofs = area.solids.filter((s) => s.tag === 'tower');
  const perch = roofs.sort((a, b) => Math.hypot(a.x - 70, a.z - 300) - Math.hypot(b.x - 70, b.z - 300))[0];
  let soundwave = null;
  if (perch)
    makeFigure('soundwave-foc').then((f) => {
      f.group.position.set(perch.x, perch.top, perch.z);
      f.group.rotation.y = Math.atan2(0 - perch.x, 250 - perch.z);
      group.add(f.group);
      soundwave = f;
    });

  // the fires: the gate, and wherever the fighting has been
  for (const [x, z] of S.fires) fire.push([x, 0, z, 10 + hash(x + z) * 12]);
  const fires = makeFires(fire, { smoke: !small });
  group.add(fires.mesh);
  const fireLights = fire.slice(0, small ? 1 : 3).map(([x, y, z]) => {
    const l = new THREE.PointLight(FIRE, 900, 120, 1.6);
    l.position.set(x, y + 8, z);
    group.add(l);
    return l;
  });

  // searchlights sweeping the sky from the towers
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd8ff').multiplyScalar(0.25), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const beamGeo = keep(new THREE.CylinderGeometry(9, 0.6, 600, 16, 1, true));
  beamGeo.translate(0, 300, 0);
  const beams = roofs.filter((_, k) => k % 9 === 0).slice(0, small ? 2 : 5).map((s, k) => {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(s.x, s.top, s.z);
    b.userData.phase = k * 1.7;
    group.add(b);
    return b;
  });

  // Jetfire going over, round the city
  let jet = null;
  makeThing('jetfire-jet').then((j) => {
    jet = j;
    group.add(j);
  });

  return {
    group,
    update(t, dt, camera, sim) {
      sky.userData.uniforms.uTime.value = t;
      // Metroplex, woken: at once if he already was when you came, slowly
      // the moment it happens
      const awake = sim?.missions?.done?.includes('wake-metroplex');
      if (awake && metroplex.model) {
        metroplex.woke = metroplex.woke < 0 ? (sim.clock < 1 ? 1 : 0) : Math.min(1, metroplex.woke + (dt ?? 1 / 60) / 7);
        const k = metroplex.woke * metroplex.woke * (3 - 2 * metroplex.woke);
        metroplex.model.rotation.y = metroplex.at.yaw + 0.22 * k + Math.sin(t * 0.07) * 0.03 * k;
        metroplex.eyes.visible = true;
        metroplex.eyes.children.forEach((g, i) => (g.material.opacity = Math.min(1, k * (i < 2 ? 1.6 : 1)) * (0.85 + 0.15 * Math.sin(t * 2 + i))));
        metroplex.beam.visible = k > 0.3;
        const a = t * 0.18;
        // (tipped down from his head over the city, sweeping across it)
        metroplex.beam.rotation.set(1.72 + 0.06 * Math.sin(a * 0.8), metroplex.model.rotation.y + 0.45 * Math.sin(a), 0, 'YXZ');
      }
      fires.update(t);
      portalU.uTime.value = t;
      fireLights.forEach((l, k) => (l.intensity = 700 + 300 * Math.sin(t * 9 + k) * Math.sin(t * 5.3 + k * 2)));
      for (const b of beams) {
        const a = t * 0.3 + b.userData.phase;
        b.rotation.set(0.45 + 0.25 * Math.sin(a * 0.7), 0, 0.35 * Math.sin(a));
        b.rotation.y = a;
      }
      if (jet) {
        const a = t * 0.12;
        jet.position.set(Math.cos(a) * 360, 140 + Math.sin(a * 3) * 20, Math.sin(a) * 360);
        jet.rotation.set(0, -a, -0.5);
      }
      soundwave?.update(1 / 60);
    },
    dispose() {
      group.traverse((o) => {
        if (o.isMesh) {
          o.geometry?.dispose?.();
        }
      });
      for (const d of disposables) d.dispose?.();
      fires.dispose();
      soundwave?.dispose();
    },
  };
}
