// The mountains on the horizon: each stage’s ranges (stages/ranges.js)
// drawn as real ground, a band of peaks kilometres off, lit by the sun so
// their faces and gullies show, snow lying above the stage’s snow line and
// off the steepest rock, and the sky’s haze in them by their distance (the
// air’s colour mixed over their light: the scene’s fog would have taken
// them whole). The band is kept round the camera, as the sky is: a range two
// kilometres off doesn’t come nearer for the metres walked. Under it at night
// they are black against the stars; in Moria’s dark, nothing.
//
//   rangeGeometry(range, { segments, rows }) → BufferGeometry (position, color, aHaze, aGlow); pure
//     (a volcano’s width is its footprint’s, whatever its row says; its glow the fire at its crater and down a flank)
//   foothills(range) → the lower, greener band before a big range (null for a small one or a volcano)
//   stageGeometry(stage, opts) → the stage’s ranges and their foothills in one geometry (null for none)
//   towerGeometry({ height }) → Barad-dûr’s mass, its foot at 0 (EYE_AT: the Eye’s height, a share of it); pure
//   createBackdrop({ road, tier, load }) → { mesh, at(stage), set(light), update(camera), dispose() }
//     load(url) → a glTF (the runtime’s asset cache), for a landmark that is a model

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, float, uniform, vec3 } from 'three/tsl';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2 } from '../../../lib/land/layers.js';
import { landmarksOf, rangesOf } from './stages/ranges';

const DEG = Math.PI / 180;
const SNOW = new THREE.Color(0xffffff);
const CREVICE = 0.62; // the gullies’ shade of the rock
const HAZE_FAR = 5200; // m: the distance the haze is two thirds of everything at

// ridged noise from the value noise: sharp crests, soft hollows (0…1)
function ridged(x, y, seed, octaves = 5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise2(x * f, y * f, seed + o * 17));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.1;
  }
  return sum / norm;
}

// a range’s band across, metres: its slopes about as steep as real ones (a cone’s steeper)
export const depthOf = ({ height, cone = false }) => Math.max(260, height * (cone ? 2.8 : 2.6));

export function rangeGeometry(range, { segments = 220, rows = 28 } = {}) {
  const { az, width, dist, height, jag = 0.6, snow = null, cone = false, seed = 1 } = range;
  const depth = depthOf(range);
  // (a cone spans what its foot does, a little over, so its flanks are never cut)
  const span = cone ? (2 * Math.atan(depth / 2 / dist) * 1.12) / DEG : width;
  const a0 = (az - span / 2) * DEG;
  const a1 = (az + span / 2) * DEG;
  const rock = new THREE.Color(range.colour ?? 0x6e6a60);
  // (a snowy range a little clearer: its snow reads through the haze, as snow does)
  const haze = range.haze ?? (1 - Math.exp(-dist / HAZE_FAR)) * (snow != null ? 0.82 : 1);
  const cols = segments + 1;
  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const hz = new Float32Array(cols * rows);
  const hs = new Float32Array(cols * rows);
  const glow = new Float32Array(cols * rows);
  // the peaks: a crest every few hundred metres along it and across, closer with the jag
  const spacing = 520 + 460 * (1 - Math.min(1, jag));
  for (let j = 0; j < rows; j++) {
    const v = j / (rows - 1); // 0 the near foot, 1 the far
    const r = dist - depth / 2 + v * depth;
    for (let i = 0; i < cols; i++) {
      const u = i / segments;
      const a = a0 + (a1 - a0) * u;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      let h;
      if (cone) {
        // a volcano: one steep cone, its flanks gullied, its crater lip broken
        const cx = Math.sin(az * DEG) * dist;
        const cz = Math.cos(az * DEG) * dist;
        const d = Math.hypot(x - cx, z - cz) / (depth / 2);
        const flank = Math.max(0, 1 - d) ** 1.25;
        const round = Math.atan2(x - cx, z - cz);
        const gully = 0.85 + 0.15 * ridged(round * 3, d * 2, seed);
        h = height * Math.min(flank, 0.94) * gully;
        // the fire: the crater’s lip, and a runnel of it down the flank toward the road
        const lip = THREE.MathUtils.smoothstep(flank, 0.86, 0.94);
        const toward = Math.atan2(-cx, -cz);
        const off = Math.abs(((round - toward + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const runnel = THREE.MathUtils.smoothstep(0.09 + 0.05 * noise2(d * 6, 0, seed), 0, off) * THREE.MathUtils.smoothstep(flank, 0.2, 0.6);
        glow[j * cols + i] = Math.max(lip, runnel * 0.8);
      } else {
        // the range’s ends tapering, its middle highest, the peaks wandering
        // over it in two sizes (the crests sharpened by the jag), gullies finer still
        const ends = THREE.MathUtils.smoothstep(u, 0, 0.2) * THREE.MathUtils.smoothstep(1 - u, 0, 0.2);
        const across = 1 - Math.abs(v * 2 - 1) ** 1.6;
        const s = (a - a0) * dist;
        const t = (v - 0.5) * depth;
        // (sharpened by the jag, but a peak’s shoulders kept: massifs, not needles)
        const crest = ridged(s / spacing, t / spacing, seed) ** (1 + 0.5 * Math.min(1, jag));
        const roll = 0.5 + 0.5 * noise2(s / (spacing * 1.7), t / (spacing * 1.7), seed + 3);
        const fine = ridged(s / (spacing * 0.3), t / (spacing * 0.3), seed + 5, 3);
        h = height * ends * across * (0.3 + 0.7 * (jag * crest + (1 - jag) * roll)) + height * 0.07 * across * ends * fine;
      }
      const k = j * cols + i;
      // (its foot a little under the horizon’s ground, so no edge shows)
      pos.set([x, h - height * 0.08, z], k * 3);
      hs[k] = h / height;
      hz[k] = haze;
    }
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < segments; i++) {
      const p = j * cols + i;
      idx.push(p, p + cols, p + 1, p + 1, p + cols, p + cols + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the colours: the rock by its height and its slope, the snow above the line and off the steepest
  const n = g.attributes.normal;
  const c = new THREE.Color();
  for (let k = 0; k < cols * rows; k++) {
    const up = Math.max(0, n.getY(k));
    const x = pos[k * 3];
    const z = pos[k * 3 + 2];
    const grain = noise2(x / 90, z / 90, seed + 9) * 0.5 + 0.5;
    c.copy(rock).multiplyScalar(CREVICE + (1 - CREVICE) * (0.55 * up + 0.45 * grain) + hs[k] * 0.12);
    if (snow != null) {
      const line = snow + (grain - 0.5) * 0.18;
      const lies = THREE.MathUtils.smoothstep(hs[k], line, line + 0.06) * THREE.MathUtils.smoothstep(up, 0.22, 0.5);
      c.lerp(SNOW, lies);
    }
    c.toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aHaze', new THREE.BufferAttribute(hz, 1));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  g.computeBoundingSphere();
  return g;
}

// (a big range doesn’t stand straight out of the plain: lower hills before it, wooded or grassed, its rock coming through)
const GREEN = new THREE.Color(0x4e6644);
export function foothills(range) {
  if (range.cone || range.height < 400) return null;
  const colour = new THREE.Color(range.colour ?? 0x6e6a60).lerp(GREEN, 0.55).getHex();
  return { az: range.az, width: Math.min(180, range.width * 1.15), dist: range.dist - depthOf(range) * 0.5, height: range.height * 0.24, colour, jag: 0.35, snow: null, seed: (range.seed ?? 1) + 100 };
}

export function stageGeometry(stage, opts) {
  const rows = rangesOf(stage).flatMap((r) => [r, foothills(r)].filter(Boolean));
  const parts = rows.map((r) => rangeGeometry(r, opts));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  // (one geometry a stage: one draw)
  const count = parts.reduce((s, p) => s + p.attributes.position.count, 0);
  const SIZES = { position: 3, normal: 3, color: 3, aHaze: 1, aGlow: 1 };
  const out = Object.fromEntries(Object.entries(SIZES).map(([name, n]) => [name, new Float32Array(count * n)]));
  const idx = [];
  let base = 0;
  for (const p of parts) {
    for (const [name, n] of Object.entries(SIZES)) out[name].set(p.attributes[name].array, base * n);
    for (const i of p.index.array) idx.push(i + base);
    base += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(out)) g.setAttribute(name, new THREE.BufferAttribute(a, SIZES[name]));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export const EYE_AT = 0.93;

export function towerGeometry({ height: h }) {
  const parts = [];
  const add = (geo, x, y, z, ry = 0) => {
    geo.rotateY(ry);
    geo.translate(x, y, z);
    parts.push(geo.index ? geo.toNonIndexed() : geo);
  };
  // the foot, broad and buttressed
  add(new THREE.CylinderGeometry(h * 0.15, h * 0.24, h * 0.2, 8), 0, h * 0.1, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(new THREE.BoxGeometry(h * 0.05, h * 0.34, h * 0.13), Math.cos(a) * h * 0.17, h * 0.17, Math.sin(a) * h * 0.17, -a);
  }
  // the shaft in tiers, narrowing, spiked at each
  add(new THREE.CylinderGeometry(h * 0.095, h * 0.14, h * 0.42, 8), 0, h * 0.4, 0);
  add(new THREE.CylinderGeometry(h * 0.065, h * 0.095, h * 0.3, 8), 0, h * 0.75, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2;
    const tier = i % 3;
    const r = h * (0.13 - tier * 0.03);
    const spike = new THREE.ConeGeometry(h * 0.012, h * 0.11, 4);
    spike.rotateZ(-0.35);
    add(spike, Math.cos(a) * r, h * (0.56 + tier * 0.12), Math.sin(a) * r, -a);
  }
  // the crown: two horns curving up either side of the Eye
  for (const sx of [-1, 1]) {
    const horn = new THREE.ConeGeometry(h * 0.028, h * 0.2, 5);
    horn.rotateZ(-sx * 0.22);
    add(horn, sx * h * 0.05, h * 0.98, 0);
  }
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  g.computeVertexNormals();
  return g;
}

export function createBackdrop({ road = null, tier = 'high', load = null } = {}) {
  const opts = tier === 'low' ? { segments: 110, rows: 14 } : { segments: 220, rows: 28 };
  const uHaze = uniform(new THREE.Color(0.75, 0.8, 0.85));
  const material = road ? road.material({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true });
  material.fog = false;
  // (the air’s colour over their light, by how far off they are: their own light lessened, the haze’s added)
  const h = attribute('aHaze', 'float');
  material.colorNode = vec3(1).mul(h.oneMinus());
  // (and a volcano’s fire, glowing through its own haze)
  material.emissiveNode = uHaze.mul(h).add(vec3(2.2, 0.6, 0.1).mul(attribute('aGlow', 'float')).mul(h.oneMinus().mul(0.6).add(0.4)));
  // (until a stage is set, a geometry with every attribute the material reads, drawn by nothing)
  const none = new THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['color', 3], ['aHaze', 1], ['aGlow', 1]]) none.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3), n));
  const mesh = new THREE.Mesh(none, material);
  mesh.visible = false;
  mesh.name = 'road:mountains';
  mesh.frustumCulled = false;
  mesh.renderOrder = -0.5;
  const group = new THREE.Group();
  group.name = 'road:horizon';
  group.add(mesh);
  // a landmark’s material: its stone in the same haze as the ranges at its distance
  const mats = [];
  const stoneOf = (colour, dist) => {
    const m = road ? road.material({ color: colour }) : new MeshLambertNodeMaterial({ color: colour });
    m.fog = false;
    const h = float(1 - Math.exp(-dist / HAZE_FAR));
    m.colorNode = vec3(1).mul(h.oneMinus());
    m.emissiveNode = uHaze.mul(h);
    mats.push(m);
    return m;
  };
  const built = []; // the landmarks’ geometry made here
  const eyeMat = new MeshBasicNodeMaterial({ color: new THREE.Color(3.2, 1.1, 0.25) });
  eyeMat.fog = false;
  // each stage’s landmarks, made the first time it’s walked
  const marks = new Map(); // stage → THREE.Group
  const landmarks = (stage) => {
    const out = new THREE.Group();
    for (const l of landmarksOf(stage)) {
      const a = (l.az * Math.PI) / 180;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * l.dist, -l.height * 0.04, Math.cos(a) * l.dist);
      // (its face to the road)
      g.rotation.y = Math.atan2(-g.position.x, -g.position.z);
      if (l.kind === 'tower') {
        const tower = towerGeometry(l);
        const ball = new THREE.SphereGeometry(1, 12, 8);
        built.push(tower, ball);
        g.add(new THREE.Mesh(tower, stoneOf(0x1e1a1a, l.dist)));
        const eye = new THREE.Mesh(ball, eyeMat);
        eye.scale.set(l.height * 0.034, l.height * 0.05, l.height * 0.012);
        eye.position.y = l.height * EYE_AT;
        g.add(eye);
      } else if (l.kind === 'city' && load) {
        const stone = stoneOf(0xe2ddd2, l.dist);
        Promise.resolve(load(l.model))
          .then((gltf) => {
            if (!gltf?.scene || !out.parent) return;
            const city = gltf.scene.clone(true);
            const box = new THREE.Box3().setFromObject(city);
            const size = box.getSize(new THREE.Vector3());
            city.scale.setScalar(l.height / Math.max(1e-3, size.y));
            city.position.y = -box.min.y * city.scale.y;
            city.traverse((o) => o.isMesh && (o.material = stone));
            g.add(city);
          })
          .catch(() => {});
      }
      out.add(g);
    }
    return out;
  };
  const made = new Map(); // stage → geometry (or null)
  let current = null;
  return {
    mesh: group,
    at(stage) {
      if (stage === current) return;
      if (current != null) marks.get(current)?.removeFromParent();
      current = stage;
      if (!made.has(stage)) made.set(stage, stageGeometry(stage, opts));
      const g = made.get(stage);
      mesh.visible = Boolean(g);
      if (g) mesh.geometry = g;
      if (!marks.has(stage)) marks.set(stage, landmarks(stage));
      group.add(marks.get(stage));
    },
    // the day’s air: the haze is the fog’s colour (black in Moria’s dark and at night: a silhouette)
    set(light) {
      uHaze.value.setRGB(...light.fog.colour);
    },
    update(camera) {
      group.position.set(camera.position.x, 0, camera.position.z);
    },
    dispose() {
      for (const g of made.values()) g?.dispose();
      none.dispose();
      made.clear();
      // (a model’s geometry is the asset cache’s: only what was built here is freed)
      for (const g of built) g.dispose();
      material.dispose();
      for (const m of mats) m.dispose();
      eyeMat.dispose();
      group.removeFromParent();
    },
  };
}
