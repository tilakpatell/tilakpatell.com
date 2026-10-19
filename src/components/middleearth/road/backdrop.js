// The mountains on the horizon: each stage’s ranges (stages/ranges.js)
// drawn as real ground, a band of peaks kilometres off, lit by the sun so
// their faces and gullies show, snow lying above the stage’s snow line and
// off the steepest rock, and the sky’s haze in them by their distance (the
// air’s colour mixed over their light: the scene’s fog would have taken
// them whole). The band is kept round the camera, as the sky is: a range two
// kilometres off doesn’t come nearer for the metres walked. Under it at night
// they are black against the stars; in Moria’s dark, nothing.
//
//   rangeGeometry(range, { segments, rows }) → BufferGeometry (position, color, aHaze); pure
//   stageGeometry(stage, opts) → the stage’s ranges in one geometry (null for none)
//   createBackdrop({ road, tier }) → { mesh, at(stage), set(light), update(camera), dispose() }

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, uniform, vec3 } from 'three/tsl';
import { noise2 } from '../../../lib/land/layers.js';
import { rangesOf } from './stages/ranges';

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
  const a0 = (az - width / 2) * DEG;
  const a1 = (az + width / 2) * DEG;
  const rock = new THREE.Color(range.colour ?? 0x6e6a60);
  // (a snowy range a little clearer: its snow reads through the haze, as snow does)
  const haze = range.haze ?? (1 - Math.exp(-dist / HAZE_FAR)) * (snow != null ? 0.82 : 1);
  const cols = segments + 1;
  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const hz = new Float32Array(cols * rows);
  const hs = new Float32Array(cols * rows);
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
        const gully = 0.85 + 0.15 * ridged(Math.atan2(x - cx, z - cz) * 3, d * 2, seed);
        h = height * Math.min(flank, 0.94) * gully;
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
  g.computeBoundingSphere();
  return g;
}

export function stageGeometry(stage, opts) {
  const parts = rangesOf(stage).map((r) => rangeGeometry(r, opts));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  // (one geometry a stage: one draw)
  const count = parts.reduce((s, p) => s + p.attributes.position.count, 0);
  const out = { position: new Float32Array(count * 3), normal: new Float32Array(count * 3), color: new Float32Array(count * 3), aHaze: new Float32Array(count) };
  const idx = [];
  let base = 0;
  for (const p of parts) {
    for (const name of ['position', 'normal', 'color']) out[name].set(p.attributes[name].array, base * 3);
    out.aHaze.set(p.attributes.aHaze.array, base);
    for (const i of p.index.array) idx.push(i + base);
    base += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(out)) g.setAttribute(name, new THREE.BufferAttribute(a, name === 'aHaze' ? 1 : 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export function createBackdrop({ road = null, tier = 'high' } = {}) {
  const opts = tier === 'low' ? { segments: 110, rows: 14 } : { segments: 220, rows: 28 };
  const uHaze = uniform(new THREE.Color(0.75, 0.8, 0.85));
  const material = road ? road.material({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true });
  material.fog = false;
  // (the air’s colour over their light, by how far off they are: their own light lessened, the haze’s added)
  const h = attribute('aHaze', 'float');
  material.colorNode = vec3(1).mul(h.oneMinus());
  material.emissiveNode = uHaze.mul(h);
  // (until a stage is set, a geometry with every attribute the material reads, drawn by nothing)
  const none = new THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['color', 3], ['aHaze', 1]]) none.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3), n));
  const mesh = new THREE.Mesh(none, material);
  mesh.visible = false;
  mesh.name = 'road:mountains';
  mesh.frustumCulled = false;
  mesh.renderOrder = -0.5;
  const made = new Map(); // stage → geometry (or null)
  let current = null;
  return {
    mesh,
    at(stage) {
      if (stage === current) return;
      current = stage;
      if (!made.has(stage)) made.set(stage, stageGeometry(stage, opts));
      const g = made.get(stage);
      mesh.visible = Boolean(g);
      if (g) mesh.geometry = g;
    },
    // the day’s air: the haze is the fog’s colour (black in Moria’s dark and at night: a silhouette)
    set(light) {
      uHaze.value.setRGB(...light.fog.colour);
    },
    update(camera) {
      mesh.position.set(camera.position.x, 0, camera.position.z);
    },
    dispose() {
      for (const g of made.values()) g?.dispose();
      none.dispose();
      made.clear();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}
