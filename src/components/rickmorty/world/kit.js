// The C-137 world's shared kit, for the street (./street.js) and the rooms:
// toon materials by role (walls, floors, wood, metal, glass, glows), each
// made once and shared; canvas-painted textures; roof shapes; the gentle
// light steps for Meshy models; a batch that merges the parts that never
// move by material, so a whole street is a few dozen draw calls; and the
// arcade's lettering and glows (Blips and Chitz and the street outside it).
//
// The materials are shared by everything that asks for the same colour: never
// change one you were given (its colour, side, map, a texture's repeat); ask
// for another (toon() with `extra`, or painted() under a new name).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../stage';
import { rng } from '../../../lib/texture';
import { toon } from '../portal/toon';

export { rng };

const key = (c) => new THREE.Color(c).getHexString();

// Materials by role, one per colour (and per `extra` options, for toon()).
// painted() keeps one per name, drawn the first time. `renderer` is for the
// painted ones' filtering. dispose() frees them all and their textures.
export function kitMaterials(renderer) {
  const made = new Map();
  const once = (k, make) => {
    if (!made.has(k)) made.set(k, make());
    return made.get(k);
  };
  return {
    toon: (color, extra = null) => once(`t${key(color)}${extra ? JSON.stringify(extra, (k, v) => (v?.isTexture ? v.uuid : v)) : ''}`, () => toon(color, extra ?? {})),
    wall: (color = 0xeee0bf) => once(`t${key(color)}`, () => toon(color)),
    floor: (color = 0xc4a77a) => once(`t${key(color)}`, () => toon(color)),
    get wood() {
      return once('wood', () => toon(0x8a5a34));
    },
    get metal() {
      return once('metal', () => toon(0xa3acb5));
    },
    get glass() {
      return once('glass', () => toon(0x9fd4e6, { transparent: true, opacity: 0.6 }));
    },
    // bright enough for the bloom to catch
    glow: (color = 0x9dff5a, k = 2.4) => once(`g${key(color)}${k}`, () => new THREE.MeshBasicMaterial({ color: hot(color, k) })),
    // a toon material painted on a canvas: draw(ctx, w, h) once
    // (`tile`: metres to a repeat, for batch()'s world-space uvs)
    painted: (name, w, h, draw, { repeat = [1, 1], color = 0xffffff, transparent = false, side = THREE.FrontSide, tile = 0 } = {}) =>
      once(`p${name}`, () => {
        const m = toon(color, { map: paint(renderer, w, h, draw, { repeat }), transparent, alphaTest: transparent ? 0.4 : 0, side });
        if (tile) m.userData.tile = tile;
        return m;
      }),
    dispose() {
      for (const m of made.values()) {
        m.map?.dispose();
        m.dispose();
      }
      made.clear();
    },
  };
}

// A canvas texture drawn once by draw(ctx, w, h).
export function paint(renderer, w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return canvasTexture(c, renderer, opts);
}

// Specks over a flat colour (grass, asphalt, concrete): `n` dots of the
// colours given, each up to `size` px.
export function speckle(g, w, h, { base, specks, n = 2000, size = 2, seed = 1 }) {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = specks[Math.floor(r() * specks.length)];
    const s = 0.6 + r() * size;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

// Brick: courses of `rows` across the canvas, mortar lines between.
export function bricks(g, w, h, { base = '#8e2f25', mortar = '#5c1d18', rows = 8, cols = 6, seed = 3 } = {}) {
  const r = rng(seed);
  g.fillStyle = mortar;
  g.fillRect(0, 0, w, h);
  const bh = h / rows;
  const bw = w / cols;
  for (let y = 0; y < rows; y++) {
    for (let x = -1; x <= cols; x++) {
      const k = 0.9 + r() * 0.2;
      const c = new THREE.Color(base).multiplyScalar(k);
      g.fillStyle = `#${c.getHexString()}`;
      g.fillRect(x * bw + (y % 2) * bw * 0.5 + 1.5, y * bh + 1.5, bw - 3, bh - 3);
    }
  }
}

// The light steps for a Meshy model toon-painted (portal/toon.js's toonify
// with this as its gradientMap): its texture carries its own shading, so the
// steps are gentle (two thirds of the way down at most).
let gentle = null;
export function gentleRamp() {
  if (gentle) return gentle;
  gentle = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  gentle.minFilter = gentle.magFilter = THREE.NearestFilter;
  gentle.generateMipmaps = false;
  gentle.needsUpdate = true;
  return gentle;
}

// Fit a model over a footprint: x0..x1 by z0..z1 on the ground, its height
// scaled by `ky` (a share of the footprint's x scale; 1 keeps its shape) or to
// `h` metres. Turned by `turn` first (pi faces it north). Returns the scales.
export function fitModel(model, { x0, x1, z0, z1 }, { turn = 0, ky = null, h = null } = {}) {
  const holder = new THREE.Group();
  model.rotation.y = turn;
  holder.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const sx = (x1 - x0) / size.x;
  const sz = (z1 - z0) / size.z;
  const sy = h != null ? h / size.y : sx * (ky ?? 1);
  holder.scale.set(sx, sy, sz);
  holder.position.set((x0 + x1) / 2 - ((box.min.x + box.max.x) / 2) * sx, -box.min.y * sy, (z0 + z1) / 2 - ((box.min.z + box.max.z) / 2) * sz);
  return { holder, sx, sy, sz, box };
}

// ── shapes ──

// A hipped roof over w × d (x by z), `rise` high, its ridge along the longer
// side; flat-shaded.
export function hipRoof(w, d, rise) {
  const hw = w / 2;
  const hd = d / 2;
  const alongX = w >= d;
  const r = alongX ? [-(hw - hd), 0, hw - hd, 0] : [0, -(hd - hw), 0, hd - hw];
  const A = [-hw, 0, -hd];
  const B = [hw, 0, -hd];
  const C = [hw, 0, hd];
  const D = [-hw, 0, hd];
  const R0 = alongX ? [r[0], rise, 0] : [0, rise, r[1]];
  const R1 = alongX ? [r[2], rise, 0] : [0, rise, r[3]];
  const tris = alongX
    ? [
        [D, C, R1], [D, R1, R0], // front
        [B, A, R0], [B, R0, R1], // back
        [C, B, R1], // east
        [A, D, R0], // west
      ]
    : [
        [D, C, R1], // front
        [B, A, R0], // back
        [C, B, R0], [C, R0, R1], // east
        [A, D, R1], [A, R1, R0], // west
      ];
  return flatGeometry(tris, w, d);
}

// A gable: a prism `w` long on x, `d` across, `rise` high (the attic and its
// end walls); the roof's slabs go on top (gableSlabs).
export function gablePrism(w, d, rise) {
  const hw = w / 2;
  const hd = d / 2;
  const P = (x, y, z) => [x, y, z];
  const tris = [
    [P(-hw, 0, hd), P(-hw, rise, 0), P(-hw, 0, -hd)],
    [P(hw, 0, -hd), P(hw, rise, 0), P(hw, 0, hd)],
  ];
  return flatGeometry(tris, w, d);
}

// The two slabs of a gable roof over a prism like gablePrism's, with eaves
// `over` out all round and `thick` thick: [geometry, matrix] pairs.
export function gableSlabs(w, d, rise, { over = 0.4, thick = 0.18 } = {}) {
  const half = d / 2;
  const slope = Math.atan2(rise, half);
  const len = Math.hypot(half, rise) + over;
  const [c, s0] = [Math.cos(slope), Math.sin(slope)];
  const out = [];
  for (const s of [-1, 1]) {
    // down the slope from the ridge, the middle of the slab, lifted half its
    // thickness off the prism
    const g = new THREE.BoxGeometry(w + over * 2, thick, len);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(0, rise - (len / 2) * s0 + (thick / 2) * c, s * ((len / 2) * c + (thick / 2) * s0)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(s * slope, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    out.push([g, m]);
  }
  return out;
}

// triangles [[a, b, c], …] (counter-clockwise seen from outside) as a
// non-indexed geometry with flat normals and planar uvs (metres / 4)
function flatGeometry(tris, w, d) {
  const pos = [];
  const uv = [];
  for (const t of tris)
    for (const p of t) {
      pos.push(...p);
      uv.push((p[0] + w / 2) / 4, (p[2] + d / 2 + p[1]) / 4);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ── the batch ──

// Parts that never move, merged into one mesh per material. add() takes a
// geometry (it is copied, so one can be added many times) and where it goes:
// a matrix, or x, y, z, a turn about y and a scale.
export function batch() {
  const byMat = new Map();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const add = (geo, mat, at = 0, y = 0, z = 0, turn = 0, sx = 1, sy = sx, sz = sx) => {
    const m = at?.isMatrix4 ? at : m4.compose(new THREE.Vector3(at, y, z), q.setFromAxisAngle(up, turn), new THREE.Vector3(sx, sy, sz));
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(g);
    return g;
  };
  // the merged meshes, into `parent`
  const build = (parent, { cast = true, receive = true } = {}) => {
    const out = [];
    for (const [mat, list] of byMat) {
      if (mat.userData.tile) for (const g of list) worldUV(g, mat.userData.tile);
      const colour = list.some((g) => g.attributes.color);
      if (colour) for (const g of list) if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      parent.add(mesh);
      out.push(mesh);
    }
    byMat.clear();
    return out;
  };
  return { add, build };
}

// uvs from where each vertex is, `tile` metres to a repeat, projected along
// the way its face faces (so brick and shingle keep their size on any box)
function worldUV(g, tile) {
  const p = g.attributes.position.array;
  const n = g.attributes.normal.array;
  const uv = g.attributes.uv.array;
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    const ax = Math.abs(n[i]);
    const ay = Math.abs(n[i + 1]);
    const az = Math.abs(n[i + 2]);
    if (ay >= ax && ay >= az) {
      uv[j] = p[i] / tile;
      uv[j + 1] = p[i + 2] / tile;
    } else if (ax >= az) {
      uv[j] = p[i + 2] / tile;
      uv[j + 1] = p[i + 1] / tile;
    } else {
      uv[j] = p[i] / tile;
      uv[j + 1] = p[i + 1] / tile;
    }
  }
  g.attributes.uv.needsUpdate = true;
}

// A geometry with every vertex one colour (for merging parts of one
// instanced model drawn with vertex colours).
export function coloured(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Parts (each { geo, color, matrix }) merged into one vertex-coloured geometry.
export function mergeParts(parts) {
  const list = parts.map(({ geo, color, matrix }) => {
    const g = coloured(geo, color);
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    return g;
  });
  const merged = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  return merged;
}

// a matrix from position, turn about y (and x, z) and scale
const mq = new THREE.Quaternion();
const me = new THREE.Euler();
export function at(x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  me.set(rx, ry, rz, 'YXZ');
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), mq.setFromEuler(me), new THREE.Vector3(sx, sy, sz));
}

// ── lettering and glows ──

// Text in Blips and Chitz's lettering (its sign, its planet, its board): fat
// capitals, yellow going orange at the foot, a dark outline and a hard
// shadow; squeezed to `maxW` if it's wider.
export function logoText(g, text, x, y, size, { maxW = Infinity, outline = '#2a0f4a', shadow = '#12061f', fill = ['#fff8b0', '#ffd21a', '#ff8a00'], weight = 900 } = {}) {
  g.save();
  g.font = `${weight} ${size}px 'Arial Black', 'Arial Bold', 'Helvetica Neue', Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const w = g.measureText(text).width + size * 0.3;
  g.translate(x, y);
  g.scale(Math.min(1, maxW / w), 1);
  g.lineWidth = size * 0.24;
  g.strokeStyle = shadow;
  g.strokeText(text, size * 0.05, size * 0.09);
  g.strokeStyle = outline;
  g.strokeText(text, 0, 0);
  const gr = g.createLinearGradient(0, -size * 0.42, 0, size * 0.42);
  fill.forEach((c, i) => gr.addColorStop(i / (fill.length - 1), c));
  g.fillStyle = gr;
  g.fillText(text, 0, 0);
  g.restore();
}

// A copy of a model's toon material that glows where its texture is neon:
// bright saturated colour ('neon'), or bright green only ('green', Roy's
// screen). The copy is the builder's to dispose.
export function neonCopy(src, { k = 2.2, mode = 'neon' } = {}) {
  const m = src.clone();
  const test = mode === 'green' ? 'step(0.3, c.g) * step(c.r * 1.8, c.g) * step(c.b * 1.8, c.g)' : 'smoothstep(0.4, 0.55, hi) * smoothstep(0.55, 0.72, (hi - lo) / max(hi, 1e-3))';
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      { vec3 c = diffuseColor.rgb; float hi = max(c.r, max(c.g, c.b)); float lo = min(c.r, min(c.g, c.b));
        totalEmissiveRadiance += c * (${test}) * ${k.toFixed(2)}; }`,
    );
  };
  m.customProgramCacheKey = () => `c137-neon-${mode}-${k}`;
  return m;
}

// Glow, one colour per vertex (so every neon tube in an area is one mesh)
export const glowMaterial = (k = 2.2) => new THREE.MeshBasicMaterial({ color: hot(0xffffff, k), vertexColors: true });
