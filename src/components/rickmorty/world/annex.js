// The alien street outside Blips and Chitz, for ./scene.js: a tiled plaza in
// teal and purple under a magenta dusk with two moons and a ringed planet,
// rocks floating over the town, bulbous alien buildings round the edge with
// lit windows and signs in an alien script, curly lamp posts with glowing
// bulbs, strange plants, hover cars parked along the road and more flying
// over, a pylon with the arcade's planet on it, a couple of locals, the
// arcade itself (/models/c137/arcade.glb, or a stand-in) with BLIPS AND CHITZ
// lit on its board and its doorway glowing, and the green portal home.
// Everything solid stands outside the walkable plaza (./rules.js keeps Morty
// in it and out of the arcade), so what's in the way is what you see.
//
// buildAnnex(kit) → { group, update, noInk, light }.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../stage';
import { ARCADE, AREAS, LINKS } from './rules';
import { at, batch, coloured, fitModel, glowMaterial, logoText, neonCopy, paint, rng, speckle } from './kit';
import { ANNEX_LIGHT, ANNEX_SKY, makeSky } from './sky';
import { attend } from './living';

const A = AREAS.annex;
const MX = (A.x0 + A.x1) / 2; // 400
const PORTAL = LINKS.find((l) => l.id === 'annex-portal');
const DOOR = LINKS.find((l) => l.id === 'arcade-door');
const KERB = A.z1 + 2.4; // the kerb: a verge of beds and lamps past the plaza's south edge, then the road
const ROAD = { z0: KERB + 0.2, z1: KERB + 11.6 };
const TAU = Math.PI * 2;
const BOX = new THREE.BoxGeometry(1, 1, 1);
// how much each tier draws: how round the round things are, the rocks, the
// skyline's towers, the flying cars, and whether the locals come
const PLAN = {
  high: { ball: [20, 14], dome: [28, 14], cyl: 18, seg: 40, rocks: 22, skyline: 34, flyers: 5, locals: true },
  mid: { ball: [14, 10], dome: [20, 10], cyl: 12, seg: 28, rocks: 16, skyline: 24, flyers: 4, locals: false },
  low: { ball: [10, 7], dome: [16, 8], cyl: 10, seg: 20, rocks: 10, skyline: 14, flyers: 3, locals: false },
};
const PAL = { purple: 0x7b4bc4, violet: 0x5a2f99, teal: 0x23b5a8, sea: 0x3fd6c1, pink: 0xff6fc0, rose: 0xe2559c, orange: 0xff9a3c, lime: 0x9fe04a, cream: 0xf2e2c4, dark: 0x2a1745 };
const LIT = [0xffe27a, 0x7af5ff, 0xff8ae0, 0xb6ff6a];

// The moons and the ringed planet, drawn on a shell inside the sky (which
// follows the camera too): a big pale-green moon over the arcade's right
// shoulder, a small peach one to its left, the planet low in the south-east,
// and a few early stars overhead.
function heavensMaterial() {
  const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { m1: { value: dir(0.55, 0.25, -0.8) }, m2: { value: dir(-0.6, 0.36, -0.7) }, pl: { value: dir(0.32, 0.2, 0.93) }, t: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 m1, m2, pl;
      uniform float t;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      // where d falls on a disc of angular radius rad round c: -1..1 across it
      vec2 onDisc(vec3 d, vec3 c, float rad) {
        vec3 tx = normalize(cross(vec3(0.0, 1.0, 0.0), c));
        vec3 ty = cross(c, tx);
        return vec2(dot(d, tx), dot(d, ty)) / sin(rad) * sign(dot(d, c));
      }
      vec4 moon(vec3 d, vec3 c, float rad, vec3 col, vec3 pit, float seed) {
        vec2 p = onDisc(d, c, rad);
        float r = length(p);
        if (r > 1.02 || dot(d, c) < 0.0) return vec4(0.0);
        vec3 n = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
        vec3 k = col;
        for (int i = 0; i < 7; i++) {
          vec2 o = vec2(hash(vec2(seed, float(i))), hash(vec2(float(i), seed))) * 1.4 - 0.7;
          float s = 0.12 + hash(vec2(seed + float(i), 3.0)) * 0.16;
          float q = length(p - o) / s;
          k = mix(k, pit, (1.0 - smoothstep(0.9, 1.0, q)) * 0.7);
          k = mix(k, col * 1.12, smoothstep(0.95, 1.0, q) * (1.0 - smoothstep(1.0, 1.15, q)) * 0.6);
        }
        float lit = dot(n, normalize(vec3(-0.6, 0.3, 0.75)));
        k *= mix(0.55, 1.0, smoothstep(-0.1, 0.15, lit));
        return vec4(k, 1.0 - smoothstep(0.97, 1.0, r));
      }
      vec4 ringed(vec3 d, vec3 c, float rad) {
        vec2 p = onDisc(d, c, rad);
        if (dot(d, c) < 0.0) return vec4(0.0);
        float r = length(p);
        vec2 e = vec2(p.x * cos(0.35) + p.y * sin(0.35), -p.x * sin(0.35) + p.y * cos(0.35));
        float er = length(e * vec2(1.0, 3.6));
        float band = smoothstep(1.3, 1.34, er) * (1.0 - smoothstep(2.1, 2.15, er)) * (0.75 + 0.25 * sin(er * 40.0));
        vec4 ringC = vec4(vec3(0.95, 0.78, 0.92) * (0.8 + 0.2 * step(1.7, er)), band * 0.85);
        vec4 body = vec4(0.0);
        if (r < 1.0) {
          float lat = p.y * 0.9 + p.x * 0.25;
          vec3 k = mix(vec3(0.36, 0.78, 0.72), vec3(0.22, 0.55, 0.6), step(0.5, fract(lat * 3.5)));
          k = mix(k, vec3(0.62, 0.9, 0.8), 1.0 - smoothstep(0.0, 0.1, abs(lat - 0.2)));
          vec3 n = vec3(p, sqrt(1.0 - r * r));
          k *= mix(0.5, 1.0, smoothstep(-0.2, 0.3, dot(n, normalize(vec3(-0.7, 0.4, 0.6)))));
          body = vec4(k, 1.0 - smoothstep(0.97, 1.0, r));
        }
        // the ring passes behind the planet on its upper side
        bool behind = e.y > 0.0;
        if (body.a > 0.0 && behind) return body;
        return vec4(mix(body.rgb, ringC.rgb, ringC.a), max(body.a, ringC.a));
      }
      void main() {
        vec3 d = normalize(vDir);
        vec4 c = vec4(0.0);
        vec2 sp = d.xz / (abs(d.y) + 0.2) * 40.0;
        vec2 id = floor(sp);
        float star = step(0.985, hash(id)) * (1.0 - smoothstep(0.0, 0.35, length(fract(sp) - 0.5))) * smoothstep(0.35, 0.7, d.y);
        c = vec4(vec3(1.0, 0.92, 0.98) * 1.6, star * (0.6 + 0.4 * sin(t * 2.0 + id.x * 13.0)));
        vec4 a = ringed(d, pl, 0.16);
        c = mix(c, vec4(a.rgb, 1.0), a.a);
        vec4 b = moon(d, m1, 0.115, vec3(0.86, 0.92, 0.64), vec3(0.6, 0.7, 0.45), 1.7);
        c = mix(c, vec4(b.rgb, 1.0), b.a);
        vec4 e = moon(d, m2, 0.06, vec3(1.0, 0.76, 0.66), vec3(0.8, 0.5, 0.5), 4.3);
        c = mix(c, vec4(e.rgb, 1.0), e.a);
        // long pink streaks of cloud low over the town, lit gold along their tops
        if (d.y > 0.0) {
          vec2 cp = vec2(atan(d.x, d.z) * 4.0 + t * 0.01, d.y * 30.0);
          float n = noise(cp * vec2(1.1, 0.5)) * 0.62 + noise(cp * vec2(3.3, 1.4) + 4.0) * 0.38;
          float band = smoothstep(0.025, 0.07, d.y) * (1.0 - smoothstep(0.12, 0.3, d.y));
          float cl = smoothstep(0.56, 0.58, n) * band;
          vec3 cc = mix(vec3(0.93, 0.47, 0.72), vec3(1.0, 0.8, 0.68), smoothstep(0.64, 0.7, n));
          c = mix(c, vec4(cc, 1.0), cl);
        }
        gl_FragColor = c;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// soft round light on the ground (under the lamps, by the door, round the portal)
function poolTexture(renderer) {
  return paint(
    renderer,
    128,
    128,
    (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,0.9)');
      r.addColorStop(0.4, 'rgba(255,255,255,0.4)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    },
    { wrap: false },
  );
}

// eight signs in an alien script, a row each: glyphs of bars, dots and rings
// in neon on a dark plate
function drawGlyphs(g, w, h) {
  const r = rng(77);
  const cols = ['#ff6fe0', '#6ff7ff', '#ffe26f', '#b6ff6a', '#ff9a5a', '#c9a0ff', '#6fffc0', '#ff7a9a'];
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y0 = (i * h) / rows;
    const rh = h / rows;
    g.fillStyle = '#160a28';
    g.fillRect(0, y0, w, rh);
    g.strokeStyle = cols[i];
    g.fillStyle = cols[i];
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.strokeRect(6, y0 + 6, w - 12, rh - 12);
    const n = 4 + Math.floor(r() * 4);
    const gw = (w - 60) / n;
    for (let k = 0; k < n; k++) {
      const cx = 30 + gw * (k + 0.5);
      const cy = y0 + rh / 2;
      const s = rh * 0.28;
      g.beginPath();
      const kind = Math.floor(r() * 5);
      if (kind === 0) {
        g.arc(cx, cy, s * 0.8, 0, TAU);
        g.moveTo(cx, cy - s);
        g.lineTo(cx, cy + s);
      } else if (kind === 1) {
        g.moveTo(cx - s, cy + s);
        g.lineTo(cx, cy - s);
        g.lineTo(cx + s, cy + s);
        g.moveTo(cx - s * 0.5, cy + s * 0.2);
        g.lineTo(cx + s * 0.5, cy + s * 0.2);
      } else if (kind === 2) {
        g.moveTo(cx - s, cy - s);
        g.quadraticCurveTo(cx + s * 1.5, cy, cx - s, cy + s);
        g.moveTo(cx + s * 0.6, cy - s);
        g.arc(cx + s * 0.6, cy - s, 2, 0, TAU);
      } else if (kind === 3) {
        g.moveTo(cx - s, cy);
        g.lineTo(cx + s, cy);
        g.moveTo(cx - s * 0.6, cy - s);
        g.lineTo(cx - s * 0.6, cy + s);
        g.moveTo(cx + s * 0.6, cy - s);
        g.lineTo(cx + s * 0.6, cy + s * 0.4);
      } else {
        g.arc(cx, cy, s, Math.PI * 0.2, Math.PI * 1.6);
        g.moveTo(cx + s * 0.3, cy);
        g.arc(cx, cy, s * 0.3, 0, TAU);
      }
      g.stroke();
    }
  }
}

export async function buildAnnex(kit) {
  const { renderer, models, mats, tier = 'high' } = kit;
  const need = kit.need ?? ((n, o) => kit.cast.load(null, n, o));
  const plan = PLAN[tier] ?? PLAN.high;
  const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, plan.cyl);
  const BALL = new THREE.SphereGeometry(0.5, ...plan.ball);
  const CONE = new THREE.ConeGeometry(0.5, 1, plan.cyl);
  const FAR_BALL = new THREE.SphereGeometry(0.5, 10, 6);
  const FAR_CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1, true);
  const group = new THREE.Group();
  group.name = 'annex';
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const VC = mats.toon(0xffffff, { vertexColors: true });
  const glow = own(glowMaterial(2.2));
  const solid = batch(); // the town: casts and takes shadows
  const far = batch(); // the skyline: no shadows, no ink
  const neon = batch();
  const pools = batch();
  const glyphs = batch();
  const cache = new Map();
  const C = (geo, color) => {
    const k = `${geo.uuid}${color}`;
    if (!cache.has(k)) cache.set(k, coloured(geo, color));
    return cache.get(k);
  };
  const r = rng(11);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const poolMat = own(new THREE.MeshBasicMaterial({ map: own(poolTexture(renderer)), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const pool = (x, z, size, color, k = 1) => pools.add(C(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.Color(color).multiplyScalar(k).getHex()), poolMat, at(x, 0.03, z, 0, size, 1, size));

  // ── the sky, the moons and the floating rocks ──
  const sky = makeSky(560, ANNEX_SKY);
  group.add(sky.dome);
  const heavensMat = own(heavensMaterial());
  const heavens = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 24), heavensMat);
  heavens.frustumCulled = false;
  heavens.renderOrder = -9;
  group.add(heavens);
  const rockGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    const q = rng(3);
    const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.8 + q() * 0.4);
      const k = seen.get(key);
      const y = p.getY(i);
      // flat-topped, coming to a point underneath
      p.setXYZ(i, p.getX(i) * k, y > 0.3 ? 0.3 + (y - 0.3) * 0.2 : y * (y < 0 ? 1.6 : 1) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    const rock = coloured(g, 0x7a5c8c);
    const top = coloured(new THREE.CylinderGeometry(0.92, 0.85, 0.16, 9).translate(0, 0.38, 0), 0x33c4a0);
    for (const x of [rock, top]) x.deleteAttribute('uv');
    return mergeGeometries([rock, top]);
  })();
  const ROCKS = [];
  for (let i = 0; i < plan.rocks; i++) {
    const a = r() * TAU;
    const near = i < 5;
    const d = near ? 60 + r() * 30 : 120 + r() * 150;
    ROCKS.push({ x: MX + Math.sin(a) * d, z: Math.cos(a) * d, y: near ? 34 + r() * 16 : 40 + r() * 60, s: near ? 1.6 + r() * 1.8 : 6 + r() * 10, turn: r() * TAU, bob: r() * TAU });
  }
  // two over the shops, either side of the arcade, in the first view
  ROCKS[0] = { ...ROCKS[0], x: MX - 36, z: -66, y: 34, s: 4 };
  ROCKS[1] = { ...ROCKS[1], x: MX + 44, z: -78, y: 42, s: 6 };
  const rocks = new THREE.InstancedMesh(rockGeo, VC, ROCKS.length);
  rocks.frustumCulled = false;
  group.add(rocks);

  // ── the ground: alien soil to the horizon, the plaza's tiles, the kerb and the road ──
  const soil = mats.painted('annex-soil', 256, 256, (g, w, h) => speckle(g, w, h, { base: '#6a4a8e', specks: ['#5e4080', '#7a58a0', '#8a62a8', '#54386f'], n: 2200, size: 3, seed: 31 }), { repeat: [240, 240] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), soil);
  ground.position.set(MX, -0.16, 0);
  ground.receiveShadow = true;
  group.add(ground);
  const tiles = mats.painted(
    'annex-tiles',
    256,
    256,
    (g, w, h) => {
    // hexagons, teal and purple, with pale grout
    g.fillStyle = '#7e68ad';
    g.fillRect(0, 0, w, h);
    const s = w / 4;
    const hx = (cx, cy, col) => {
      g.fillStyle = col;
      g.beginPath();
      for (let k = 0; k < 6; k++) g.lineTo(cx + Math.cos((k / 6) * TAU) * s * 0.55, cy + Math.sin((k / 6) * TAU) * s * 0.55);
      g.fill();
    };
    const cols = ['#2a8a86', '#5b3c9a', '#32968f', '#6a48a8', '#267f7c', '#634299'];
    let n = 0;
    for (let row = -1; row <= 5; row++)
      for (let col = -1; col <= 3; col++) {
        const cx = col * s * 1.5 + (row % 2 ? s * 0.75 : 0);
        hx(cx * 1.333, row * s * 0.866 * 1.155, cols[n++ % cols.length]);
      }
    },
    { tile: 3 },
  );
  solid.add(BOX, tiles, at(MX, -0.05, (KERB - 70) / 2, 0, 160, 0.1, KERB + 70));
  solid.add(C(BOX, 0xd8c9ef), VC, at(MX, -0.02, KERB, 0, 320, 0.2, 0.42)); // the kerb
  const asphalt = mats.painted('annex-road', 128, 128, (g, w, h) => speckle(g, w, h, { base: '#2e1f45', specks: ['#3a2a55', '#26193b', '#40305e'], n: 900, size: 2, seed: 8 }), { tile: 4 });
  solid.add(BOX, asphalt, at(MX, -0.12, (ROAD.z0 + ROAD.z1) / 2, 0, 320, 0.06, ROAD.z1 - ROAD.z0));
  solid.add(BOX, tiles, at(MX, -0.05, ROAD.z1 + 4, 0, 320, 0.1, 8));
  for (let x = MX - 150; x < MX + 150; x += 7) neon.add(C(BOX, 0x4ff5e8), glow, at(x, -0.085, (ROAD.z0 + ROAD.z1) / 2, 0, 3, 0.02, 0.18));
  for (const z of [ROAD.z0 + 0.5, ROAD.z1 - 0.5]) neon.add(C(BOX, 0xff5fd0), glow, at(MX, -0.085, z, 0, 320, 0.02, 0.12));

  // ── the arcade ──
  const model = models.get('arcade');
  const front = ARCADE.z + ARCADE.d / 2;
  let board; // { x, y, z, w, h }: where its sign goes
  let door; // the same, its doorway
  if (model) {
    const { holder, sx, sy } = fitModel(model, { x0: ARCADE.x - ARCADE.w / 2, x1: ARCADE.x + ARCADE.w / 2, z0: ARCADE.z - ARCADE.d / 2, z1: front }, { h: 9.5 });
    const copies = new Map();
    model.traverse((o) => {
      if (!o.isMesh) return;
      if (!copies.has(o.material)) copies.set(o.material, own(neonCopy(o.material, { mode: 'neon', k: 1.8 })));
      o.material = copies.get(o.material);
      o.castShadow = true;
      o.receiveShadow = true;
    });
    group.add(holder);
    holder.updateMatrixWorld(true);
    // the board and the doorway, measured off the model: their sizes from
    // its front view, how far forward they stand from where a ray meets it
    const ray = new THREE.Raycaster();
    const hitZ = (x, y) => {
      ray.set(new THREE.Vector3(x, y, front + 10), new THREE.Vector3(0, 0, -1));
      return ray.intersectObject(holder, true)[0]?.point.z ?? front;
    };
    const my = (v) => holder.position.y + v * sy; // the model's own y to the world's
    board = { x: ARCADE.x, y: my(0.005), w: 0.64 * sx, h: 0.17 * sy };
    board.z = hitZ(board.x, board.y);
    door = { x: ARCADE.x, y: my(-0.48), w: 0.5 * sx, h: 0.64 * sy };
    door.z = hitZ(door.x, my(-0.6));
  } else {
    const s = arcadeStandIn(solid, neon, C, VC, glow);
    board = s.board;
    door = s.door;
  }
  // BLIPS AND CHITZ on the board, lit
  const signTex = own(
    paint(renderer, 1024, Math.round((1024 * board.h) / board.w), (g, w, h) => {
      g.fillStyle = '#1a0830';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ff3fd0';
      g.lineWidth = h * 0.07;
      g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h * 0.9);
      g.fillStyle = '#2ff5e0';
      for (let i = 0; i < 18; i++) {
        g.beginPath();
        g.arc(h * 0.14 + ((w - h * 0.28) * i) / 17, h * 0.14, h * 0.025, 0, TAU);
        g.arc(h * 0.14 + ((w - h * 0.28) * i) / 17, h * 0.86, h * 0.025, 0, TAU);
        g.fill();
      }
      logoText(g, 'BLIPS AND CHITZ', w / 2, h * 0.53, h * 0.56, { maxW: w * 0.9 });
    }),
  );
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(board.w, board.h), own(new THREE.MeshBasicMaterial({ map: signTex, color: hot(0xffffff, 1.45) })));
  sign.position.set(board.x, board.y, board.z + 0.04);
  group.add(sign);
  // the doorway: the arcade's light inside, cabinets in silhouette
  const doorTex = own(
    paint(
      renderer,
      256,
      256,
      (g, w, h) => {
        g.beginPath();
        g.moveTo(0, h);
        g.lineTo(0, h * 0.42);
        g.ellipse(w / 2, h * 0.42, w / 2, h * 0.42, 0, Math.PI, 0);
        g.lineTo(w, h);
        g.closePath();
        g.save();
        g.clip();
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#7a2fd0');
        gr.addColorStop(0.55, '#ff4fc0');
        gr.addColorStop(1, '#ffd0f0');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(30,8,50,0.85)';
        for (const [x, cw, ch] of [
          [0.08, 0.16, 0.42],
          [0.3, 0.14, 0.36],
          [0.56, 0.14, 0.36],
          [0.76, 0.16, 0.42],
        ]) {
          g.fillRect(x * w, h * (1 - ch), cw * w, ch * h);
          g.fillStyle = '#6ff7ff';
          g.fillRect((x + 0.025) * w, h * (1 - ch + 0.05), (cw - 0.05) * w, h * 0.1);
          g.fillStyle = 'rgba(30,8,50,0.85)';
        }
        g.restore();
      },
      { wrap: false },
    ),
  );
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(door.w, door.h), own(new THREE.MeshBasicMaterial({ map: doorTex, color: hot(0xffffff, 1.3), transparent: true, alphaTest: 0.5 })));
  doorway.position.set(door.x, door.y, door.z + 0.03);
  group.add(doorway);
  pool(DOOR.x, front + 2.6, 9, 0xff4fc0, 0.7);

  // ── the portal home ──
  const portalMat = kit.portal();
  own(portalMat);
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 3.3), portalMat);
  portal.position.set(PORTAL.x, 1.75, PORTAL.z);
  group.add(portal);
  pool(PORTAL.x, PORTAL.z, 6, 0x6dff4a, 0.9);

  // flush lights in the tiles from the portal to the door, and the arcade's
  // planet laid in the paving in front of it
  for (let z = PORTAL.z - 2.6; z > front + 1.2; z -= 1.7) for (const x of [DOOR.x - 2.6, DOOR.x + 2.6]) neon.add(C(new THREE.CircleGeometry(0.16, 10).rotateX(-Math.PI / 2), 0xfff0a0), glow, at(x, 0.012, z));
  const medal = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 48).rotateX(-Math.PI / 2),
    mats.painted(
      'annex-medal',
      256,
      256,
      (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = '#2a1745';
        g.beginPath();
        g.arc(w / 2, h / 2, w / 2, 0, TAU);
        g.fill();
        g.strokeStyle = '#ffd34a';
        g.lineWidth = 8;
        g.beginPath();
        g.arc(w / 2, h / 2, w / 2 - 8, 0, TAU);
        g.stroke();
        g.fillStyle = '#ff8b1f';
        g.beginPath();
        g.arc(w / 2, h / 2, w * 0.24, 0, TAU);
        g.fill();
        g.strokeStyle = '#2ff5e0';
        g.lineWidth = 7;
        g.beginPath();
        g.ellipse(w / 2, h / 2, w * 0.38, h * 0.1, -0.35, 0, TAU);
        g.stroke();
        g.fillStyle = '#ff7ad9';
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          g.beginPath();
          g.arc(w / 2 + Math.cos(a) * w * 0.42, h / 2 + Math.sin(a) * h * 0.42, 4, 0, TAU);
          g.fill();
        }
      },
      { transparent: true },
    ),
  );
  medal.position.set(DOOR.x, 0.01, front + 4.4);
  medal.receiveShadow = true;
  group.add(medal);

  // ── the town round the plaza ──
  const window_ = (x, y, z, turn, s, color) => neon.add(C(new THREE.CircleGeometry(0.5, 16), color), glow, at(x, y, z, turn, s, s, 1));
  const plates = [];
  const glyph = (x, y, z, turn, w, row) => plates.push([x, y, z, turn, w, row]);
  const front3 = (x, z, turn, out, y = 0) => [x + Math.sin(turn) * out, y, z + Math.cos(turn) * out];
  // a dome with a round door, round windows lit
  const dome = (x, z, rad, color, turn) => {
    solid.add(C(new THREE.SphereGeometry(1, plan.dome[0], plan.dome[1], 0, TAU, 0, Math.PI / 2), color), VC, at(x, 0, z, 0, rad, rad * 0.85, rad));
    solid.add(C(new THREE.TorusGeometry(1, 0.08, 5, plan.seg).rotateX(Math.PI / 2), PAL.cream), VC, at(x, 0.1, z, 0, rad, 1, rad));
    const [dx, , dz] = front3(x, z, turn, rad - 0.35);
    solid.add(C(BOX, PAL.dark), VC, at(dx, 1.25, dz, turn, 2, 2.5, 1));
    solid.add(C(new THREE.TorusGeometry(1, 0.1, 6, 20, Math.PI), PAL.cream), VC, at(...front3(x, z, turn, rad + 0.17, 2.5), turn, 1.05, 0.6, 1));
    for (const s of [-1, 1]) {
      const a = turn + s * 0.62;
      const [wx, , wz] = front3(x, z, a, rad * 0.905);
      window_(wx, rad * 0.42, wz, a, 1.1, pick(LIT));
    }
    glyph(...front3(x, z, turn, rad * 0.8, rad * 0.55), turn, rad * 0.75, Math.floor(r() * 8));
  };
  // a mushroom: a fat stem with a band of windows, a broad spotted cap
  const mushroom = (x, z, h, color, cap, turn) => {
    solid.add(C(CYL, color), VC, at(x, h / 2, z, 0, 5.2, h, 5.2));
    neon.add(C(new THREE.CylinderGeometry(2.62, 2.62, 0.5, plan.cyl + 6, 1, true), pick(LIT)), glow, at(x, h * 0.55, z));
    solid.add(C(new THREE.SphereGeometry(1, plan.dome[0], plan.dome[1], 0, TAU, 0, Math.PI / 2), cap), VC, at(x, h - 0.2, z, 0, 5.2, 2.6, 5.2));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      solid.add(C(BALL, PAL.cream), VC, at(x + Math.sin(a) * 3.3, h + 1.05, z + Math.cos(a) * 3.3, 0, 1.1, 0.5, 1.1));
    }
    solid.add(C(BOX, PAL.dark), VC, at(...front3(x, z, turn, 2.55, 1.15), turn, 1.3, 2.3, 0.2));
    glyph(...front3(x, z, turn, 2.75, h * 0.8), turn, 3.6, Math.floor(r() * 8));
  };
  // stacked pods on a stalk
  const pods = (x, z, color, turn) => {
    solid.add(C(CYL, PAL.dark), VC, at(x, 4.5, z, 0, 1.2, 9, 1.2));
    [
      [2.2, 3.4, 1],
      [6.0, 2.8, 0.82],
      [9.2, 2.1, 0.64],
    ].forEach(([y, rad], i) => {
      solid.add(C(BALL, i % 2 ? PAL.sea : color), VC, at(x, y, z, 0, rad * 2, rad * 1.4, rad * 2));
      neon.add(C(new THREE.TorusGeometry(rad * 0.98, 0.07, 5, plan.seg).rotateX(Math.PI / 2), pick(LIT)), glow, at(x, y, z));
    });
    solid.add(C(CYL, PAL.cream), VC, at(x, 11.2, z, 0, 0.12, 2, 0.12));
    neon.add(C(BALL, 0xff5f9a), glow, at(x, 12.3, z, 0, 0.4));
    glyph(...front3(x, z, turn, 3.5, 3.2), turn, 3.4, Math.floor(r() * 8));
  };
  // a shop: a rounded block, a striped awning, a sign over the door
  const shop = (x, z, w, d, h, color, turn) => {
    const m = at(x, 0, z, turn);
    const put = (geo, col, lx, ly, lz, sx, sy, sz) => solid.add(C(geo, col), VC, m.clone().multiply(at(lx, ly, lz, 0, sx, sy, sz)));
    put(BOX, color, 0, h / 2, 0, w - d, h, d);
    for (const s of [-1, 1]) put(CYL, color, (s * (w - d)) / 2, h / 2, 0, d, h, d);
    put(BOX, PAL.cream, 0, h + 0.15, 0, w - d, 0.3, d + 0.2);
    for (const s of [-1, 1]) put(CYL, PAL.cream, (s * (w - d)) / 2, h + 0.15, 0, d + 0.2, 0.3, d + 0.2);
    put(BOX, PAL.dark, 0, 1.25, d / 2, 2, 2.5, 0.12);
    for (let i = 0; i < 6; i++) put(BOX, i % 2 ? PAL.cream : PAL.pink, -w / 2 + 1.4 + ((w - 2.8) * (i + 0.5)) / 6, 2.95, d / 2 + 0.6, (w - 2.8) / 6, 0.12, 1.3);
    for (const s of [-1, 1]) {
      const [wx, wy, wz] = new THREE.Vector3(s * (w / 2 - 1.8), 1.7, d / 2 + 0.02).applyMatrix4(m).toArray();
      neon.add(C(BOX, pick(LIT)), glow, at(wx, wy, wz, turn, 1.6, 1.2, 0.04));
    }
    const p = new THREE.Vector3(0, h - 1.1, d / 2 + 0.06).applyMatrix4(m);
    glyph(p.x, p.y, p.z, turn, w - 3, Math.floor(r() * 8));
  };
  // a tower: a stem and a ball on top, lit round its middle, an aerial
  const tower = (x, z, h, color, b = solid) => {
    const near = b === solid;
    b.add(C(near ? CYL : FAR_CYL, PAL.violet), VC, at(x, h / 2, z, 0, 2.6, h, 2.6));
    b.add(C(near ? BALL : FAR_BALL, color), VC, at(x, h + 2.2, z, 0, 6.4, 5.4, 6.4));
    if (near) b.add(C(CYL, PAL.cream), VC, at(x, h + 6, z, 0, 0.14, 3, 0.14));
    if (near) {
      neon.add(C(new THREE.TorusGeometry(3.22, 0.12, 5, plan.seg).rotateX(Math.PI / 2), pick(LIT)), glow, at(x, h + 2.2, z));
      neon.add(C(BALL, 0xff5f9a), glow, at(x, h + 7.6, z, 0, 0.5));
    }
  };
  // a spire: a tall cone, rings of neon up it
  const spire = (x, z, h, color) => {
    solid.add(C(CONE, color), VC, at(x, h / 2, z, 0, 5, h, 5));
    for (let k = 1; k < 5; k++) {
      const y = (h * k) / 5.5;
      neon.add(C(new THREE.TorusGeometry(1, 0.06, 5, plan.seg).rotateX(Math.PI / 2), pick(LIT)), glow, at(x, y, z, 0, 2.5 * (1 - y / h) + 0.05, 1, 2.5 * (1 - y / h) + 0.05));
    }
  };
  const N = A.z0;
  // the north side, either side of the arcade, fronts facing the plaza
  dome(375, N - 6.5, 6, PAL.teal, 0);
  mushroom(386.2, N - 4.5, 6.5, PAL.cream, PAL.rose, 0);
  shop(417.5, N - 4.6, 11, 8, 6, PAL.orange, 0);
  pods(427.5, N - 4, PAL.purple, 0);
  spire(400, N - 26, 34, PAL.purple);
  tower(381, N - 22, 17, PAL.pink);
  tower(421, N - 24, 22, PAL.sea);
  // the west side and the east, facing in
  shop(A.x0 - 4.6, -12, 10, 8, 5.5, PAL.sea, Math.PI / 2);
  mushroom(A.x0 - 4.2, 2, 7, PAL.purple, PAL.lime, Math.PI / 2);
  dome(A.x0 - 6.4, 15.5, 5.5, PAL.rose, Math.PI / 2);
  pods(A.x1 + 4.2, -13, PAL.orange, -Math.PI / 2);
  shop(A.x1 + 4.6, 1, 10, 8, 6, PAL.violet, -Math.PI / 2);
  mushroom(A.x1 + 4.4, 15, 6, PAL.teal, PAL.orange, -Math.PI / 2);
  tower(A.x0 - 22, -4, 20, PAL.orange);
  tower(A.x1 + 20, 8, 24, PAL.lime);
  // across the road
  shop(380, ROAD.z1 + 8.5, 12, 8, 6, PAL.pink, Math.PI);
  dome(395, ROAD.z1 + 10, 6, PAL.violet, Math.PI);
  shop(410, ROAD.z1 + 8.5, 11, 8, 5, PAL.teal, Math.PI);
  mushroom(424, ROAD.z1 + 8, 7, PAL.cream, PAL.purple, Math.PI);
  tower(388, ROAD.z1 + 26, 21, PAL.teal);
  tower(414, ROAD.z1 + 30, 16, PAL.rose);
  // and the rest of the town, far off in the haze
  for (let i = 0; i < plan.skyline; i++) {
    const a = (i / plan.skyline) * TAU + r() * 0.1;
    const d = 110 + r() * 120;
    tower(MX + Math.sin(a) * d, Math.cos(a) * d, 14 + r() * 30, pick([PAL.pink, PAL.teal, PAL.orange, PAL.purple, PAL.sea]), far);
  }
  // the signs, all one atlas
  const glyphTex = own(paint(renderer, 512, 512, drawGlyphs));
  const glyphGeo = plates.map(([x, y, z, turn, w, row]) => {
    const g = new THREE.PlaneGeometry(w, w / 4.2);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, (7 - row + uv.getY(k)) / 8);
    return g.applyMatrix4(at(x, y, z, turn));
  });
  glyphs.add(mergeGeometries(glyphGeo), own(new THREE.MeshBasicMaterial({ map: glyphTex, color: hot(0xffffff, 1.4) })));

  // ── lamp posts round the plaza: a curl of stem, the bulb hanging over the tiles ──
  const LAMPS = [];
  for (const x of [376, 388, 412, 424]) LAMPS.push([x, A.z1 + 0.6, Math.PI]);
  for (const x of [372, 389, 411, 428]) LAMPS.push([x, N - 0.15, 0]);
  for (const z of [-9, 6]) LAMPS.push([A.x0 - 0.15, z, Math.PI / 2], [A.x1 + 0.15, z, -Math.PI / 2]);
  const stem = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.6, -0.1), new THREE.Vector3(0.1, 4.2, 0.4), new THREE.Vector3(0, 4.9, 1.3), new THREE.Vector3(0, 4.5, 1.9)]),
    24,
    0.09,
    6,
  );
  for (const [x, z, turn] of LAMPS) {
    // `turn` faces the lamp's curl into the plaza
    const m = at(x, 0, z, turn);
    solid.add(C(stem, 0x3a2a55), VC, m);
    solid.add(C(CYL, 0x3a2a55), VC, m.clone().multiply(at(0, 0.15, 0, 0, 0.5, 0.3, 0.5)));
    const bulb = new THREE.Vector3(0, 4.15, 1.9).applyMatrix4(m);
    const col = pick([0xffe27a, 0x7af5ff, 0xff8ae0]);
    neon.add(C(BALL, col), glow, at(bulb.x, bulb.y, bulb.z, 0, 0.55));
    solid.add(C(CONE, 0x3a2a55), VC, at(bulb.x, bulb.y + 0.38, bulb.z, 0, 0.7, 0.35, 0.7));
    pool(bulb.x, bulb.z, 5.5, col, 0.5);
  }

  // ── plants, in round beds just off the plaza ──
  const plant = (x, z, kind, bed = 2.4) => {
    solid.add(C(CYL, PAL.cream), VC, at(x, 0.2, z, 0, bed, 0.4, bed));
    solid.add(C(CYL, 0x3b2a20), VC, at(x, 0.36, z, 0, bed - 0.3, 0.1, bed - 0.3));
    if (kind === 0) {
      // a cactus of stacked balls, pink spikes
      [
        [0.9, 1.3],
        [2.0, 1.0],
        [2.9, 0.7],
      ].forEach(([y, s]) => {
        solid.add(C(BALL, 0x2fbf8f), VC, at(x, y, z, 0, s, s * 1.2, s));
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + y;
          solid.add(C(CONE, 0xff6fc0), VC, at(x + Math.sin(a) * s * 0.5, y, z + Math.cos(a) * s * 0.5, a, 0.12, 0.35, 0.12, Math.PI / 2));
        }
      });
    } else if (kind === 1) {
      // stalks bending out, glowing pods on the ends
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + r();
        const h = 1.8 + r() * 1.6;
        const tip = new THREE.Vector3(x + Math.sin(a) * 0.9, h, z + Math.cos(a) * 0.9);
        const stalk = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0.4, z), new THREE.Vector3(x, h * 0.8, z), tip), 8, 0.05, 5);
        solid.add(C(stalk, 0x4a9a3a), VC, at(0, 0, 0));
        neon.add(C(BALL, pick([0xb6ff6a, 0xff8ae0, 0x7af5ff])), glow, at(tip.x, tip.y, tip.z, 0, 0.32, 0.42, 0.32));
      }
    } else {
      // a fat bulb with fronds curling up
      solid.add(C(BALL, 0x8a4fd0), VC, at(x, 0.9, z, 0, 1.3, 1.1, 1.3));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const u = i / 10;
          pts.push(new THREE.Vector3(x + Math.sin(a) * (0.3 + u * 1.1), 1.2 + u * 1.6 - u * u * 0.6, z + Math.cos(a) * (0.3 + u * 1.1)));
        }
        solid.add(C(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.07, 5), 0x36c48a), VC, at(0, 0, 0));
      }
    }
  };
  [
    [A.x0 - 1.4, -20, 0],
    [A.x0 - 1.4, -3, 1],
    [A.x0 - 1.4, 10, 2],
    [A.x1 + 1.4, -20, 1],
    [A.x1 + 1.4, -5, 2],
    [A.x1 + 1.4, 10, 0],
    [382, A.z1 + 1.3, 2, 2],
    [394, A.z1 + 1.3, 1, 2],
    [406, A.z1 + 1.3, 0, 2],
    [418, A.z1 + 1.3, 1, 2],
    [370.5, A.z1 + 1.3, 0, 2],
    [409.6, N - 1.4, 2],
  ].forEach(([x, z, k, bed]) => plant(x, z, k, bed));

  // ── hover cars parked along the road, and more flying over the town ──
  const carGeo = (body) => {
    const parts = [
      [new THREE.CapsuleGeometry(0.85, 2.4, 6, 14).rotateZ(Math.PI / 2), body, at(0, 0, 0, 0, 1, 0.62, 1)],
      [BOX, 0x2a1745, at(0, -0.28, 0, 0, 3.3, 0.12, 1.5)],
      [BOX, body, at(-1.9, 0.45, 0, 0, 0.7, 0.7, 0.12)],
      [BOX, PAL.cream, at(0.2, 0.05, 0, 0, 4.4, 0.08, 1.75)],
    ];
    return mergeGeometries(
      parts.map(([g, c, m]) => {
        const x = coloured(g, c).applyMatrix4(m);
        x.deleteAttribute('uv');
        return x;
      }),
    );
  };
  const glass = mats.glass;
  const PARKED = [
    [377, 0xff4a4a],
    [391.5, 0xffd21a],
    [415, 0x4ff5e8],
    [428, 0x9fe04a],
  ];
  for (const [x, c] of PARKED) {
    const z = ROAD.z0 + 1.6;
    solid.add(carGeo(c), VC, at(x, 0.85, z));
    solid.add(BALL, glass, at(x + 0.3, 1.25, z, 0, 1.8, 1.0, 1.3));
    neon.add(C(new THREE.TorusGeometry(0.9, 0.08, 6, 24).rotateX(Math.PI / 2), 0x7af5ff), glow, at(x, 0.32, z, 0, 1.5, 1, 0.85));
    neon.add(C(BOX, 0xfff2b0), glow, at(x + 2.25, 0.85, z, 0, 0.06, 0.16, 0.9));
    pool(x, z, 4, 0x7af5ff, 0.6);
  }
  const FLYERS = [
    { y: 16, z: -70, speed: 9, color: 0xff6fc0, at: 0 },
    { y: 22, z: -95, speed: -7, color: 0x4ff5e8, at: 90 },
    { y: 13, z: -60, speed: 11, color: 0xffd21a, at: 190 },
    { y: 19, z: 75, speed: -10, color: 0x9fe04a, at: 40 },
    { y: 26, z: -130, speed: 6, color: 0xff8a2a, at: 140 },
  ].slice(0, plan.flyers);
  const flyerBody = new THREE.InstancedMesh(carGeo(0xffffff), VC, FLYERS.length);
  const flyerGlow = new THREE.InstancedMesh(coloured(new THREE.TorusGeometry(0.9, 0.12, 6, 24).rotateX(Math.PI / 2), 0xffffff).scale(1.5, 1, 0.85).translate(0, -0.5, 0), glow, FLYERS.length);
  FLYERS.forEach((f, i) => {
    flyerBody.setColorAt(i, new THREE.Color(f.color));
    flyerGlow.setColorAt(i, new THREE.Color(0x7af5ff));
  });
  for (const m of [flyerBody, flyerGlow]) {
    m.frustumCulled = false;
    group.add(m);
  }

  // ── the pylon: the arcade's planet on a pole at the corner, pointing the way ──
  const PY = { x: A.x0 - 1.8, z: KERB - 1.6, h: 9 };
  solid.add(C(CYL, 0x3a2a55), VC, at(PY.x, PY.h / 2, PY.z, 0, 0.5, PY.h, 0.5));
  solid.add(C(CYL, PAL.cream), VC, at(PY.x, 0.2, PY.z, 0, 1.6, 0.4, 1.6));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.5, ...plan.dome), mats.toon(0xff8b1f, { emissive: 0x5a2200 }));
  ball.position.set(PY.x, PY.h + 1.3, PY.z);
  group.add(ball);
  neon.add(C(new THREE.TorusGeometry(2.1, 0.09, 5, plan.seg + 8).rotateX(Math.PI / 2 - 0.35), 0x2ff5e0), glow, at(PY.x, PY.h + 1.3, PY.z));
  for (let k = 0; k < 3; k++) neon.add(C(BOX, 0xffd21a), glow, at(PY.x + 0.9 + k * 0.5, PY.h - 1.2, PY.z, 0, 0.3, 0.12, 0.08, 0, 0.6 * (k % 2 ? -1 : 1)));

  // ── the merged meshes ──
  solid.build(group, { cast: true, receive: true });
  const skyline = far.build(group, { cast: false, receive: false });
  const glowMeshes = neon.build(group, { cast: false, receive: false });
  const poolMeshes = pools.build(group, { cast: false, receive: false });
  const glyphMeshes = glyphs.build(group, { cast: false, receive: false });
  for (const g of cache.values()) g.dispose();

  // ── a couple of locals, by the shops either side of the arcade ──
  const locals = [];
  if (plan.locals) {
    // (they only stand, but the walk comes too: the cast turns each idle to face the way it does)
    await need(['gromflomite', 'gazorpian'], { clips: ['idle', 'walk'] }).catch(() => {});
    for (const [kind, x, z, turn] of [
      ['gromflomite', 380.5, N - 0.7, 0.35],
      ['gazorpian', 421.5, N - 0.9, -0.3],
    ]) {
      const c = kit.cast.make(kind);
      if (!c) continue;
      c.group.position.set(x, 0, z);
      c.group.rotation.y = turn;
      group.add(c.group);
      locals.push(c);
    }
  }
  const heads = locals.map(() => ({}));

  const tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    group,
    noInk: [sky.dome, heavens, sign, doorway, portal, medal, ...skyline, ...glowMeshes, ...poolMeshes, ...glyphMeshes, flyerGlow],
    light: ANNEX_LIGHT,
    update(t, dt, state, camera) {
      sky.update(t, camera);
      // the portal faces the camera, and shrinks away while the camera is
      // right by it (arriving, it stands between Morty and the camera)
      const pd = Math.hypot(camera.position.x - portal.position.x, camera.position.z - portal.position.z);
      portal.rotation.y = Math.atan2(camera.position.x - portal.position.x, camera.position.z - portal.position.z);
      portalMat.uniforms.open.value = Math.min(1, Math.max(0, (pd - 2.2) / 2.4));
      heavens.position.copy(camera.position);
      heavensMat.uniforms.t.value = t;
      portalMat.uniforms.t.value = t;
      for (let i = 0; i < ROCKS.length; i++) {
        const k = ROCKS[i];
        p.set(k.x, k.y + Math.sin(t * 0.4 + k.bob) * 0.8, k.z);
        q.setFromEuler(e.set(0, k.turn + t * 0.02, 0));
        rocks.setMatrixAt(i, tmp.compose(p, q, s.set(k.s, k.s * 0.8, k.s)));
      }
      rocks.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < FLYERS.length; i++) {
        const f = FLYERS[i];
        const x = MX - 160 + ((((f.at + t * f.speed) % 320) + 320) % 320);
        p.set(x, f.y + Math.sin(t * 1.3 + i) * 0.3, f.z);
        q.setFromEuler(e.set(0, f.speed > 0 ? 0 : Math.PI, Math.sin(t * 0.9 + i) * 0.06));
        tmp.compose(p, q, s.set(1, 1, 1));
        flyerBody.setMatrixAt(i, tmp);
        flyerGlow.setMatrixAt(i, tmp);
      }
      flyerBody.instanceMatrix.needsUpdate = true;
      flyerGlow.instanceMatrix.needsUpdate = true;
      ball.rotation.y = t * 0.5;
      // (each in their own time, their heads turning to Morty as he passes)
      for (let i = 0; i < locals.length; i++) {
        locals[i].update?.(t, 0, 0, { dt });
        attend(locals[i], heads[i], null, t, state, { near: 4.5 });
      }
    },
    dispose() {
      for (const o of owned) o.dispose?.();
    },
  };
}

// The arcade in shapes, if its model won't load: a long rounded hall of
// purple under teal arches, neon tubes curving up its front, an arched door
// and the board over it. Returns where the board and the doorway go.
function arcadeStandIn(b, neon, C, VC, glow) {
  const { x, z, w, d } = ARCADE;
  const rad = w / 2;
  const front = z + d / 2;
  const hall = new THREE.CylinderGeometry(1, 1, 1, 40, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
  b.add(C(hall, 0x6a3a9e), VC, at(x, 0, z, 0, rad, rad * 1.0, d * 0.92));
  for (const k of [-0.5, 0, 0.5]) b.add(C(new THREE.TorusGeometry(1, 0.06, 8, 40, Math.PI), 0x1f9e96), VC, at(x, 0, z + (k * d) / 1.05, 0, rad + 0.25, rad + 0.25, 1));
  b.add(C(new THREE.TorusGeometry(1, 0.05, 8, 40, Math.PI), 0x6a1f6a), VC, at(x, 0, front - 0.2, 0, rad - 1.4, rad - 1.4, 1));
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI / 2 + s * (0.3 + (0.8 * i) / 16);
      pts.push(new THREE.Vector3(Math.cos(a) * (rad - 2.6), Math.sin(a) * (rad - 2.6), 0));
    }
    neon.add(C(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.12, 6), 0xffe24a), glow, at(x, 0, front + 0.05));
    neon.add(C(BOX, 0x9dff5a), glow, at(x + s * 3.4, 2.2, front + 0.05, 0, 0.16, 3.6, 0.1));
  }
  const door = { x, y: 2.1, z: front + 0.02, w: 4.6, h: 4.2 };
  b.add(C(BOX, 0x2a5a66), VC, at(x, door.h / 2, front - 0.1, 0, door.w + 0.6, door.h + 0.3, 0.3));
  const board = { x, y: 5.6, z: front + 0.08, w: 6, h: 1.05 };
  b.add(C(BOX, 0x3a2050), VC, at(x, board.y, front - 0.05, 0, board.w + 0.3, board.h + 0.3, 0.3));
  return { board, door };
}
