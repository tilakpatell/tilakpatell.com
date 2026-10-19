// The Dead Marshes: tussocks, reeds, drowned snags, the candle-lights and
// the dead faces under the water. Moved out of props.js as they were; the
// faces’ shader comes from the kit (K.shaders).

import * as THREE from 'three';
import { hot } from '../../../../lib/three/canvasTexture';
import { clamp01, makeNoise, smooth } from '../../../../lib/paint';
import { rng, tube } from '../../shire/build';
import { _kc, along, C, lump, noise3, oneGeo, solid, TAU, tint, V3 } from './helpers';

// ── the Dead Marshes ──

const MARSH = { mud: C(0x2a261a), khaki: C(0x8a8250), straw: C(0xa49464), dead: C(0x6a5a38), green: C(0x56603a), olive: C(0x6c6c3c) };

// One blade of grass or a reed leaf: a strip from its root up and out,
// bending over, coloured root to tip.
function bladeGeo(root, dir, len, wid, droop, segs, colour) {
  const pos = [];
  const col = [];
  const idx = [];
  const side = V3(-dir.z, 0, dir.x).normalize();
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = root.clone().addScaledVector(dir, len * t);
    p.y -= droop * len * t * t;
    const w = wid * (1 - t * 0.92);
    pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w);
    colour(t, _kc);
    col.push(_kc.r, _kc.g, _kc.b, _kc.r, _kc.g, _kc.b);
    if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // lit as if round, from its own lean
  const nr = g.attributes.normal;
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, dir.x * 0.4, 0.9, dir.z * 0.4);
  return g;
}

// A tussock of marsh grass, about 0.7 m: a dark mound bristling with dull
// khaki blades, dead straw at their tips. One geometry.
export function tussockGeo(seed = 1) {
  const r = rng(seed * 7 + 2);
  const list = [];
  const mound = lump(0.26, { p: [0, 0.02, 0], s: [1.2, 0.45, 1.1] }, { detail: 1, amp: 0.2, seed });
  list.push(solid(mound, MARSH.mud));
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU;
    const rr = Math.sqrt(r()) * 0.22;
    const root = V3(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
    const out = 0.25 + r() * 0.6;
    const dir = V3(Math.cos(a) * out, 1, Math.sin(a) * out).normalize();
    const tipC = r() < 0.5 ? MARSH.straw : MARSH.khaki;
    const midC = r() < 0.3 ? MARSH.green : MARSH.olive;
    list.push(bladeGeo(root, dir, 0.4 + r() * 0.42, 0.012 + r() * 0.008, 0.25 + r() * 0.45, 3, (t, o) => (t < 0.5 ? o.copy(MARSH.mud).lerp(midC, t * 2) : o.copy(midC).lerp(tipC, (t - 0.5) * 2))));
  }
  return oneGeo(list);
}

// Reeds, up to 2 m: dead brown-green stalks, a few bent and snapped, some
// with their brown heads, leaves trailing from their feet. One geometry.
export function reedsGeo(seed = 1) {
  const r = rng(seed * 5 + 9);
  const list = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const rr = Math.sqrt(r()) * 0.4;
    const root = V3(Math.cos(a) * rr, -0.1, Math.sin(a) * rr);
    const H = 1.1 + r() * 1.0;
    const lean = V3(Math.cos(a) * 0.12 + (r() - 0.5) * 0.1, 1, Math.sin(a) * 0.12 + (r() - 0.5) * 0.1).normalize();
    const c0 = r() < 0.5 ? MARSH.green : MARSH.olive;
    const c1 = r() < 0.6 ? MARSH.dead : MARSH.straw;
    const broken = r() < 0.2;
    if (broken) {
      const k = 0.45 + r() * 0.2;
      list.push(bladeGeo(root, lean, H * k, 0.012, 0, 2, (t, o) => o.copy(MARSH.mud).lerp(c0, t)));
      const kink = root.clone().addScaledVector(lean, H * k);
      const down = V3(Math.cos(a + 1) * 0.8, -0.35, Math.sin(a + 1) * 0.8).normalize();
      list.push(bladeGeo(kink, down, H * (1 - k), 0.01, 0.05, 2, (t, o) => o.copy(c0).lerp(c1, t)));
    } else {
      list.push(bladeGeo(root, lean, H, 0.013, 0.04, 3, (t, o) => (t < 0.4 ? o.copy(MARSH.mud).lerp(c0, t / 0.4) : o.copy(c0).lerp(c1, (t - 0.4) / 0.6))));
      if (r() < 0.35) {
        const top = root.clone().addScaledVector(lean, H * 0.82);
        list.push(solid(along(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 5), lean, top.clone().addScaledVector(lean, 0.1)), C(0x4a3220)));
      }
    }
    // a leaf off its foot, trailing over
    const la = a + (r() - 0.5) * 2;
    const ld = V3(Math.cos(la) * 0.5, 1, Math.sin(la) * 0.5).normalize();
    list.push(bladeGeo(root.clone().add(V3(0, 0.05, 0)), ld, 0.6 + r() * 0.5, 0.018, 0.55 + r() * 0.3, 3, (t, o) => o.copy(c0).lerp(c1, t)));
  }
  return oneGeo(list);
}

// A drowned tree, about 4 m: a twisted bare snag, black and wet below,
// silver-grey above, limbs broken short, the top snapped. One geometry.
export function deadTreeGeo(seed = 1) {
  const r = rng(seed * 7 + 3);
  const n = makeNoise(seed + 17);
  const list = [];
  const H = 3.6 + r() * 0.8;
  const trunk = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunk.push(V3(x, -0.5 + t * H * 0.85, z));
    x += (r() - 0.5) * 0.55 + (i > 3 ? 0.12 : 0);
    z += (r() - 0.5) * 0.55;
  }
  const curve = new THREE.CatmullRomCurve3(trunk);
  list.push(tube(trunk, 0.26, 0.09, { seg: 12, radial: 8, gnarl: 0.35, seed }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + r() * 0.6;
    const l = 0.6 + r() * 0.5;
    list.push(tube([[0, 0.35, 0], [Math.cos(a) * l * 0.5, 0.0, Math.sin(a) * l * 0.5], [Math.cos(a) * l, -0.45, Math.sin(a) * l]], 0.12, 0.04, { seg: 4, radial: 5, gnarl: 0.25, seed: seed + i }));
  }
  const branch = (from, dir, len, r0, depth) => {
    const pts = [from.clone()];
    const d = dir.clone();
    let p = from.clone();
    for (let i = 0; i < 3; i++) {
      d.x += (r() - 0.5) * 0.9;
      d.z += (r() - 0.5) * 0.9;
      d.y += (r() - 0.45) * 0.6;
      d.normalize();
      p = p.clone().addScaledVector(d, len / 3);
      pts.push(p);
    }
    list.push(tube(pts, r0, Math.max(0.01, r0 * 0.3), { seg: depth ? 3 : 5, radial: depth ? 3 : 5, gnarl: 0.2, seed: seed + depth * 9 + pts.length }));
    if (depth >= 1) return;
    for (let k = 0; k < 2; k++) {
      const at = new THREE.CatmullRomCurve3(pts).getPointAt(0.4 + r() * 0.5);
      branch(at, V3(r() - 0.5, 0.3 + r() * 0.5, r() - 0.5).normalize().add(d.clone().multiplyScalar(0.5)).normalize(), len * 0.45, r0 * 0.45, depth + 1);
    }
  };
  const limbs = 3 + Math.floor(r() * 2);
  for (let i = 0; i < limbs; i++) {
    const t = 0.4 + (i / limbs) * 0.45;
    const a = (i / limbs) * TAU + r() * 0.9;
    const from = curve.getPointAt(t);
    const dir = V3(Math.cos(a), 0.2 + r() * 0.6, Math.sin(a)).normalize();
    if (i === 0) {
      list.push(tube([from, from.clone().addScaledVector(dir, 0.35), from.clone().addScaledVector(dir, 0.6)], 0.08, 0.06, { seg: 3, radial: 5, gnarl: 0.3 }));
      continue;
    }
    branch(from, dir, H * (0.32 + r() * 0.15), 0.085 - t * 0.03, 0);
  }
  // the top, snapped off in splinters
  const top = trunk[trunk.length - 1];
  for (let i = 0; i < 3; i++) list.push(new THREE.ConeGeometry(0.035, 0.3 + r() * 0.25, 4).translate((r() - 0.5) * 0.08, 0.15, (r() - 0.5) * 0.08).rotateZ((r() - 0.5) * 0.3).translate(top.x, top.y, top.z));
  const g = oneGeo(list);
  const base = H * 0.85 - 0.5;
  tint(g, (px, py, pz, out) => {
    const v = noise3(n, px * 3, py * 1.2, pz * 3);
    out.setRGB(0.22, 0.2, 0.17).multiplyScalar(0.75 + v * 0.5);
    out.lerp(_kc2.setRGB(0.44, 0.43, 0.4), smooth(0.3, base, py) * 0.85);
    out.lerp(_kc2.setRGB(0.05, 0.06, 0.03), (1 - smooth(-0.4, 0.5, py)) * 0.75);
    out.lerp(_kc2.setRGB(0.12, 0.16, 0.07), (1 - smooth(0.0, 1.1, py)) * smooth(0.45, 0.6, v) * 0.6);
  });
  return g;
}
export const _kc2 = new THREE.Color();

// A candle-light over the pools: a small pale flame about 0.2 m above the
// group's origin (the scene sets it 0.2 over the water), its soft green-white
// glow, and the glow lying on the water under it. update(t) flickers and
// bobs it.
export function wisp(K) {
  const g = new THREE.Group();
  g.name = 'wisp';
  const sprite = (map, colour, opacity, sx, sy) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: colour, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(sx, sy, 1);
    g.add(s);
    return s;
  };
  const halo = sprite(K.tex.glow, hot(0x9cffc8, 0.7), 0.55, 1.7, 1.7);
  const flame = sprite(K.tex.flame, hot(0xe8fff0, 2.4), 1, 0.13, 0.27);
  const core = sprite(K.tex.glow, hot(0xffffff, 2.6), 0.9, 0.09, 0.09);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0x8affc0, 0.5), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.position.y = -0.185;
  pool.renderOrder = 2;
  g.add(pool);
  const update = (t) => {
    const f = 0.82 + 0.1 * Math.sin(t * 13.3) * Math.sin(t * 7.1 + 1) + 0.08 * Math.sin(t * 29.7);
    const y = 0.21 + Math.sin(t * 1.3) * 0.05 + Math.sin(t * 3.1) * 0.012;
    const x = Math.sin(t * 0.7) * 0.04;
    for (const s of [halo, flame, core]) s.position.set(x, y, 0);
    flame.position.y = y + 0.04;
    flame.scale.set(0.12 * (0.9 + f * 0.15), 0.26 * f, 1);
    flame.material.opacity = 0.75 + f * 0.25;
    halo.material.opacity = 0.42 * f;
    core.material.opacity = 0.7 * f;
    pool.material.opacity = 0.38 * f;
    pool.scale.setScalar(0.9 + f * 0.15);
  };
  update(0);
  return { group: g, flame, update };
}

// A drowned face under the water, about 0.5 m, looking up: pale, ghostly,
// half there. Drawn where it lies, but tested for depth as if `lift` m
// higher, so the opaque water over it (up to 0.7 m above) doesn't hide it.
// update(t, k): k 0..1 how clearly it shows.
export function faceGeo() {
  const g = new THREE.PlaneGeometry(0.46, 0.46, 14, 14);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) - 0.5;
    const v = uv.getY(i) - 0.48;
    const oval = Math.max(0, 1 - Math.hypot(u / 0.26, v / 0.33));
    let h = Math.sqrt(oval) * 0.06;
    h += Math.exp(-((u / 0.035) ** 2) - (((v + 0.0) / 0.08) ** 2)) * 0.02;
    h -= Math.exp(-(((Math.abs(u) - 0.09) / 0.05) ** 2) - (((v - 0.03) / 0.035) ** 2)) * 0.015;
    h -= Math.exp(-((u / 0.06) ** 2) - (((v + 0.19) / 0.03) ** 2)) * 0.01;
    p.setZ(i, h);
  }
  g.computeVertexNormals();
  return g.rotateX(-Math.PI / 2);
}
export function face(K, seed = 1) {
  const kind = ((seed % 3) + 3) % 3;
  const g = new THREE.Group();
  g.name = 'face';
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uK: { value: 0 }, uLift: { value: 0.72 }, uTint: { value: new THREE.Color(0xa4c4b8) } }]);
  uniforms.uMap = { value: K.tex.faces[kind] };
  const m = K.shaders.face(uniforms);
  const mesh = new THREE.Mesh(K.faceGeo, m);
  mesh.rotation.y = ((seed * 1.7) % 1) * TAU;
  mesh.renderOrder = 3;
  g.add(mesh);
  const update = (t, k = 0) => {
    uniforms.uTime.value = t;
    const flick = 0.85 + 0.15 * Math.sin(t * 2.1 + seed);
    uniforms.uK.value = (0.06 + 0.66 * clamp01(k)) * flick;
    mesh.position.y = Math.sin(t * 0.5 + seed) * 0.03;
  };
  update(0, 0);
  return { group: g, mesh, kind, update };
}
