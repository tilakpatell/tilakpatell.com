// Edoras, made in code: the kit the hidden chapter is built from. The hill in
// the plain of Rohan ringed by its stockade of sharpened logs, the one gate
// between its two log towers, the road up between the thatched halls, the
// great stair with the stream running down beside it to the horse-head
// fountain, the terrace, and Meduseld on the top: the Golden Hall, its high
// roof thatched with gold, its gables crossed with carved boards that end in
// horses' heads, its porch of painted pillars and its great carved doors. The
// banners of the white horse on green, streaming in the wind. Then the hall
// inside, dark carved timber and gold in the firelight: the pillars, the long
// hearth, the dais and the throne, the tables for the feast, the shields and
// the tapestries of the kings, light falling in shafts from the high windows.
// The barrows of the kings outside the gate, white with simbelmynë; and the
// beacon peaks away east along the White Mountains.
//
// The coordinates are ./layout.js's: metres, +x east, +z south, y up, the
// hill's middle the origin (the hall inside is its own place, its floor at
// y = 0). Fixed parts are merged one mesh per material; the stockade's logs,
// the grass and the flowers are instanced. What glows is brighter than 1, so
// the bloom takes it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../../../../lib/stage3d';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, ridge, smooth } from '../../../../lib/paint';
import { boxUV, fillColor, lathe, rng, tf, tube } from '../../shire/props';
import { BARROWS, DAIS, FLOWERS, HALL, HEARTH, HILL, HOUSES, MEDUSELD, PEAKS, PILLARS, ROAD, STAIR, STOCKADE, TABLES, TERRACE, THRONE, WATCH, groundAt, hillHeight, stretchOf } from './layout';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const V2 = (x, y = x) => new THREE.Vector2(x, y);

// How much each tier draws: texture sizes, how finely the roofs are cut,
// how many flowers and tufts of grass.
const QUALITY = {
  high: { tex: 512, step: 1, flowers: 1, tufts: 1, around: 1 },
  mid: { tex: 384, step: 1.3, flowers: 0.6, tufts: 0.6, around: 0.75 },
  low: { tex: 256, step: 1.7, flowers: 0.35, tufts: 0.3, around: 0.6 },
};

// The wind, hard out of the south-west: every banner streams away north-
// north-east of its pole, and the grass leans the same way.
const WIND = V3(0.32, 0, -0.95).normalize();
const ACROSS = V3().crossVectors(WIND, UP).normalize();
const F5 = (v) => v.toFixed(5);

// Where the floor of Meduseld is, outside: its plinth's top.
const FLOOR = 28.3;

// ── small helpers ──

// An integer hash to [0, 1).
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise that repeats every px across and py down, so a streak can be
// long one way and short the other and still tile.
function stretchNoise(seed) {
  const w = (i, p) => ((i % p) + p) % p;
  return (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x0 = w(xi, px);
    const x1 = w(xi + 1, px);
    const y0 = w(yi, py);
    const y1 = w(yi + 1, py);
    return mix(mix(hash2(x0, y0, seed), hash2(x1, y0, seed), sx), mix(hash2(x0, y1, seed), hash2(x1, y1, seed), sx), sy);
  };
}
function sfbm(n, x, y, px, py, octaves = 3) {
  let s = 0;
  let a = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    s += n(x * f, y * f, px * f, py * f) * a;
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return s / norm;
}

// A model's fixed parts gathered by material, then merged into one mesh
// each. `uv` maps a part by the metre from whichever side of a box each
// face looks to, in the frame it was added in (so a house's boards stand up
// whichever way the house is turned); `color` gives it a colour where the
// material reads one, `tint` darkens one it has. `at` adds parts as if the
// origin were elsewhere, turned by ry.
const KEEP = new Set(['position', 'normal', 'uv', 'color']);
const _tint = new THREE.Color();
function bucket() {
  const lists = new Map();
  const stack = [];
  const bk = {
    add(mat, geo, o = {}) {
      tf(geo, o);
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.attributes.normal) g.computeVertexNormals();
      const count = g.attributes.position.count;
      if (o.uv) boxUV(g, o.uv, o.uvOff ?? 0);
      else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      if (mat.vertexColors) {
        if (!g.attributes.color || o.color != null) fillColor(g, o.color ?? 0xffffff);
        if (o.tint != null) {
          _tint.set(o.tint);
          const c = g.attributes.color;
          for (let i = 0; i < count; i++) c.setXYZ(i, c.getX(i) * _tint.r, c.getY(i) * _tint.g, c.getZ(i) * _tint.b);
        }
      }
      for (const k of Object.keys(g.attributes)) if (!KEEP.has(k) || (k === 'color' && !mat.vertexColors)) g.deleteAttribute(k);
      g.morphAttributes = {};
      g.clearGroups();
      if (stack.length) g.applyMatrix4(stack[stack.length - 1]);
      if (!lists.has(mat)) lists.set(mat, []);
      lists.get(mat).push(g);
      return bk;
    },
    at(p, ry, fn) {
      const m = new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromAxisAngle(UP, ry), V3(1, 1, 1));
      stack.push(stack.length ? stack[stack.length - 1].clone().multiply(m) : m);
      fn();
      stack.pop();
      return bk;
    },
    build(parent, prefix) {
      const out = [];
      for (const [mat, geos] of lists) {
        const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos);
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `${prefix}-${mat.name}`;
        parent.add(mesh);
        out.push(mesh);
      }
      lists.clear();
      return out;
    },
  };
  return bk;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// A beam from point a to point b ([x, y, z] each), `w` wide across and `h`
// deep, its depth kept upright.
function beam(a, b, w, h) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new THREE.BoxGeometry(len, h, w);
  g.rotateZ(Math.atan2(dy, Math.hypot(dx, dz)));
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}
// A sheet of quads through rows of points (rows[i][j] = [x, y, z]), with
// texture coordinates uvs[i][j] and a grey (or [r, g, b]) shade cols[i][j];
// smooth across. Rows run along +x (or round), the points of a row across:
// wound so the face looks to the left of the row as it goes.
function grid(rows, uvs, cols) {
  const nr = rows.length;
  const nc = rows[0].length;
  const pos = new Float32Array(nr * nc * 3);
  const uv = new Float32Array(nr * nc * 2);
  const col = new Float32Array(nr * nc * 3);
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const k = i * nc + j;
      pos.set(rows[i][j], k * 3);
      uv.set(uvs[i][j], k * 2);
      const c = cols ? cols[i][j] : 1;
      if (Array.isArray(c)) col.set(c, k * 3);
      else col.set([c, c, c], k * 3);
    }
  }
  const idx = [];
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < nc - 1; j++) {
      const a = i * nc + j;
      const b = a + nc;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// A flat outline ([x, y] points) made `depth` thick from z = 0.
function slabOf(pts, depth) {
  const s = new THREE.Shape(pts.map(([x, y]) => V2(x, y)));
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 2 });
}
// A triangle of wall (a gable) standing on y = 0, `half` wide each side and
// `rise` high, in the z-y plane, `depth` thick from x = 0 back to x = -depth.
function gableTri(half, rise, depth) {
  return slabOf(
    [
      [-half, 0],
      [half, 0],
      [0, rise],
    ],
    depth,
  ).rotateY(-Math.PI / 2);
}
// A disc's texture coordinates moved into one cell of an n × n atlas.
function atlasUV(geo, cx, cy, n = 2) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / n, (cy + uv.getY(i)) / n);
  return geo;
}

// A horse's head and neck, carved flat (the gable boards' ends, the arms of
// the throne, the fountain's spout): the neck's foot at the origin, rising
// up y, the head looking along +x; a unit high, `depth` thick in z.
function horseHeadGeo(depth = 0.16) {
  const s = new THREE.Shape();
  s.moveTo(0.02, 0);
  s.bezierCurveTo(-0.06, 0.28, -0.02, 0.6, 0.16, 0.84);
  // the mane, in three locks down the crest
  s.lineTo(0.12, 0.9);
  s.lineTo(0.19, 0.93);
  s.lineTo(0.17, 1.04);
  s.lineTo(0.26, 0.93);
  s.bezierCurveTo(0.36, 0.9, 0.52, 0.76, 0.68, 0.56);
  s.quadraticCurveTo(0.8, 0.46, 0.73, 0.38);
  s.lineTo(0.62, 0.4);
  s.quadraticCurveTo(0.54, 0.42, 0.48, 0.5);
  s.quadraticCurveTo(0.38, 0.58, 0.36, 0.44);
  s.bezierCurveTo(0.36, 0.3, 0.44, 0.12, 0.52, 0);
  s.lineTo(0.02, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.18, bevelSize: 0.025, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ── textures ──

// Weathered boards, upright: each its own shade, the grain running along, a
// dark gap between, a butt joint here and there, a few knots, silvered
// where the weather has had them.
function planksCanvas(S, { seed = 1, boards = 8, light = [166, 140, 110], dark = [72, 58, 44], silver = 0.5 } = {}) {
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 3);
  const cells = makeCells(seed + 7);
  const r = rng(seed);
  const tone = Array.from({ length: boards }, () => r());
  const cut = Array.from({ length: boards }, () => r());
  const grey = (light[0] + dark[0] + light[1] + dark[1] + light[2] + dark[2]) / 6;
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const fb = u * boards;
    const b = Math.min(boards - 1, Math.floor(fb));
    const fx = fb - b;
    const gap = smooth(0.01, 0.07, Math.min(fx, 1 - fx));
    const jv = (v + cut[b]) % 1;
    const butt = smooth(0.002, 0.012, Math.min(jv, 1 - jv));
    const grain = sfbm(sn, u * boards * 6, v * 2, boards * 6, 2, 4);
    const fine = sfbm(sn, u * boards * 20 + 7, v * 8, boards * 20, 8, 2);
    const m = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const k = cells(u * boards, v * boards, boards);
    const knot = k.id < 0.08 ? 1 - smooth(0.04, 0.14, k.f1) : 0;
    const t = clamp01(0.5 + (tone[b] - 0.5) * 0.45 + (grain - 0.5) * 0.8 + (fine - 0.5) * 0.35 + (m - 0.5) * 0.35 - knot * 0.6);
    const sv = silver * smooth(0.35, 0.75, m * 0.7 + tone[b] * 0.3);
    const shade = (0.3 + 0.7 * gap) * (0.45 + 0.55 * butt);
    for (let i = 0; i < 3; i++) out[i] = mix(mix(dark[i], light[i], t), grey * (0.6 + t * 0.8), sv) * shade;
    field[y * S + x] = gap * butt * (0.7 + 0.3 * grain) + fine * 0.06 - knot * 0.25;
  });
  return { c, field };
}

// The stockade's logs, the bark long gone: grey-brown, split along the grain,
// bark left on in patches. Across is round the log, down is along it.
function logCanvas(S, seed = 13) {
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 1);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const split = Math.pow(1 - Math.abs(sfbm(sn, u * 10, v * 2, 10, 2, 3) * 2 - 1), 12);
    const grain = sfbm(sn, u * 40 + 3, v * 3, 40, 3, 3);
    const m = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const bark = smooth(0.58, 0.7, fbm(n, u * 3 + 5, v * 6, { period: 3, octaves: 3 })) * 0.6;
    const t = clamp01(0.5 + (grain - 0.5) * 0.7 + (m - 0.5) * 0.5 - split * 0.55);
    out[0] = mix(mix(72, 156, t), mix(44, 84, t), bark);
    out[1] = mix(mix(60, 138, t), mix(34, 66, t), bark);
    out[2] = mix(mix(50, 118, t), mix(26, 50, t), bark);
    field[y * S + x] = clamp01(0.6 + grain * 0.25 - split * 0.6 + bark * 0.25 * m);
  });
  return { c, field };
}

// Thatch: courses of straw, each lying over the one below, darker where the
// course above shades it and bright at its butt edge, the straws streaking
// down the slope; greyed where it has weathered. Up the picture is up the
// roof. Neutral straw, so each roof can tint it (the Golden Hall's gold).
function thatchCanvas(S, seed = 21) {
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 1);
  const rows = 6;
  const field = new Float32Array(S * S);
  const light = [234, 202, 136];
  const dark = [120, 90, 52];
  const old = [134, 126, 110];
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const wav = (fbm(n, u * 6, v * 6, { period: 6, octaves: 2 }) - 0.5) * 0.28 + (sfbm(sn, u * 12 + 9, v * 6, 12, 6, 2) - 0.5) * 0.18;
    const fr = v * rows + wav;
    const fy = fr - Math.floor(fr);
    const straw = sfbm(sn, u * 128, v * 8, 128, 8, 3);
    const clump = sfbm(sn, u * 16 + 3, v * 6, 16, 6, 3);
    const m = fbm(n, u * 3 + 9, v * 3, { period: 3, octaves: 4 });
    const lip = smooth(0, 0.85, fy) * (1 - 0.6 * smooth(0.9, 1, fy));
    const t = clamp01(0.28 + lip * 0.5 + (straw - 0.5) * 0.9 + (clump - 0.5) * 0.35);
    const grey = smooth(0.45, 0.8, m) * 0.45;
    for (let i = 0; i < 3; i++) out[i] = mix(mix(dark[i], light[i], t), old[i] * (0.5 + t * 0.7), grey);
    field[y * S + x] = clamp01(fy * 0.55 + straw * 0.4 + clump * 0.15 - smooth(0.9, 1, fy) * 0.55);
  });
  return { c, field };
}

// Laid stone: rows of blocks, each its own shade, the joints cut in, a chip
// off an edge here and there.
function blocksCanvas(S, { seed = 1, rows = 8, len = [0.16, 0.36], joint = 1.6, bevel = 3, light, dark, mortar, spread = 0.5 }) {
  const r = rng(seed);
  const n = makeNoise(seed);
  const lay = [];
  for (let i = 0; i < rows; i++) {
    const lens = [];
    let sum = 0;
    while (sum < 1 - len[0] * 0.5) {
      const l = len[0] + r() * (len[1] - len[0]);
      lens.push(l);
      sum += l;
    }
    const edges = [0];
    let acc = 0;
    for (const l of lens) edges.push((acc += l / sum));
    edges[edges.length - 1] = 1;
    lay.push({ edges, off: r(), tone: lens.map(() => r()) });
  }
  const field = new Float32Array(S * S);
  const rowH = S / rows;
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const ri = Math.min(rows - 1, Math.floor(y / rowH));
    const row = lay[ri];
    const fy = y + 0.5 - ri * rowH;
    const dy = Math.min(fy, rowH - fy);
    const uu = (u + row.off) % 1;
    let bi = 0;
    while (row.edges[bi + 1] <= uu) bi++;
    const dx = Math.min(uu - row.edges[bi], row.edges[bi + 1] - uu) * S;
    const d = Math.min(dx, dy);
    const face = smooth(joint * 0.5, joint + bevel, d);
    const m = fbm(n, u * 8, v * 8, { period: 8, octaves: 4 });
    const fine = n(u * 128, v * 128, 128);
    const chip = d < joint + bevel * 1.8 && n(u * 48 + 3, v * 48, 48) > 0.7 ? 0.14 : 0;
    const t = clamp01(0.55 + (row.tone[bi] - 0.5) * spread + (m - 0.5) * 0.55 + (fine - 0.5) * 0.14 - chip);
    for (let k = 0; k < 3; k++) out[k] = mix(mortar[k] * (0.85 + m * 0.3), mix(dark[k], light[k], t), face);
    field[y * S + x] = face * (0.72 + 0.28 * m) - chip * 0.6 + fine * 0.05;
  });
  return { c, field };
}

// Flagstones, laid crazy: each stone its own shade, the joints dark with
// earth and moss, worn smooth in the middle.
function flagsCanvas(S, seed = 33) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 1);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const w = (fbm(n, u * 4, v * 4, { period: 4, octaves: 2 }) - 0.5) * 0.3;
    const k = cells(u * 5 + w, v * 5 - w, 5);
    const face = smooth(0.02, 0.11, k.f2 - k.f1);
    const m = fbm(n, u * 8, v * 8, { period: 8, octaves: 4 });
    const t = clamp01(0.48 + (k.id - 0.5) * 0.45 + (m - 0.5) * 0.5 + face * 0.08);
    const moss = (1 - face) * smooth(0.4, 0.7, fbm(n, u * 6 + 3, v * 6, { period: 6, octaves: 2 }));
    const stone = [mix(116, 196, t), mix(110, 186, t), mix(98, 166, t)];
    const joint = [mix(56, 60, moss), mix(52, 76, moss), mix(46, 40, moss)];
    for (let i = 0; i < 3; i++) out[i] = mix(joint[i], stone[i], face);
    field[y * S + x] = face * (0.75 + m * 0.25);
  });
  return { c, field };
}

// The road: packed earth, two ruts worn along it, pebbles trodden in, the
// grass coming in at its ragged edges (and past them, nothing: the edge is
// cut out by alpha). Across the picture is across the road.
function earthCanvas(S, seed = 41) {
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 1);
  const cells = makeCells(seed + 2);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const m = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const along = sfbm(sn, u * 8, v * 1, 8, 1, 3);
    const wob = (along - 0.5) * 0.05;
    const rut = Math.max(0, 1 - Math.abs(u - 0.31 - wob) / 0.06) + Math.max(0, 1 - Math.abs(u - 0.69 - wob) / 0.06);
    const pk = cells(u * 10 + (along - 0.5) * 0.6, v * 10, 10);
    const pebble = pk.id > 0.84 ? smooth(0.0, 0.12, pk.f2 - pk.f1) * smooth(0.45, 0.2, pk.f1) * 0.3 : 0;
    const edge = Math.abs(u - 0.5) + (fbm(n, u * 16, v * 16, { period: 16, octaves: 2 }) - 0.5) * 0.12;
    const grassy = smooth(0.34, 0.44, edge);
    const t = clamp01(0.5 + (m - 0.5) * 0.6 + (along - 0.5) * 0.4 - rut * 0.22 + pebble * 0.32);
    out[0] = mix(mix(96, 168, t), mix(84, 152, t), grassy);
    out[1] = mix(mix(78, 140, t), mix(96, 148, t), grassy);
    out[2] = mix(mix(56, 106, t), mix(42, 72, t), grassy);
    out[3] = edge < 0.47 ? 255 : 0;
    field[y * S + x] = clamp01(0.5 + m * 0.2 - rut * 0.25 + pebble * 0.4 + along * 0.1);
  });
  return { c, field };
}

// The barrows' turf: long grass combed by the wind, green going gold, a
// darker clump here and there.
function turfCanvas(S, seed = 51) {
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 1);
  const cells = makeCells(seed + 2);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const blade = sfbm(sn, u * 96, v * 12, 96, 12, 3);
    const clump = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const dry = smooth(0.5, 0.75, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 3 }));
    const t = clamp01(0.45 + (blade - 0.5) * 0.9 + (clump - 0.5) * 0.5);
    const fk = cells(u * 40, v * 40, 40);
    const fleck = fk.id > 0.86 ? 1 - smooth(0.08, 0.2, fk.f1) : 0;
    out[0] = mix(mix(mix(52, 118, t), mix(116, 178, t), dry * 0.6), 236, fleck);
    out[1] = mix(mix(mix(80, 140, t), mix(108, 160, t), dry * 0.6), 238, fleck);
    out[2] = mix(mix(mix(30, 62, t), mix(56, 86, t), dry * 0.6), 228, fleck);
    field[y * S + x] = blade * 0.6 + clump * 0.4 + fleck * 0.3;
  });
  return { c, field };
}

// The white horse of Rohan, galloping, drawn on a 2D context: its middle at
// (cx, cy), `s` canvas pixels to its unit (it is about 100 units long), its
// head to the right (dir 1) or the left (-1).
function drawHorse(g, cx, cy, s, dir = 1, fill = '#f2efe6') {
  g.save();
  g.translate(cx, cy);
  g.scale(s * dir, s);
  g.fillStyle = fill;
  g.strokeStyle = fill;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const blob = (x, y, rx, ry, rot) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, TAU);
    g.fill();
  };
  blob(0, 0, 25, 10.5, -0.05);
  blob(-18, -1, 12.5, 11.5, 0.2);
  blob(15, 1, 11.5, 11, -0.2);
  g.beginPath();
  for (const [x, y] of [
    [2, -9],
    [12, -20],
    [21, -30],
    [22, -37],
    [27, -32],
    [33, -30],
    [43, -19],
    [48, -14],
    [46, -9],
    [39, -10],
    [33, -14],
    [29, -11],
    [26, -1],
    [21, 8],
    [8, 6],
  ])
    g.lineTo(x, y);
  g.closePath();
  g.fill();
  g.lineWidth = 2;
  g.stroke();
  const leg = (pts, w = 4.6) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(...pts[0]);
    g.quadraticCurveTo(...pts[1], ...pts[2]);
    g.stroke();
  };
  leg([
    [17, 6],
    [29, 13],
    [39, 8],
  ]);
  leg([
    [11, 8],
    [19, 20],
    [11, 27],
  ]);
  leg([
    [-22, 4],
    [-33, 14],
    [-46, 16],
  ]);
  leg([
    [-15, 7],
    [-11, 19],
    [-2, 22],
  ]);
  // the tail streaming, and the mane
  leg(
    [
      [-29, -6],
      [-44, -15],
      [-53, -5],
    ],
    5,
  );
  leg(
    [
      [-29, -4],
      [-41, -7],
      [-50, 4],
    ],
    3.5,
  );
  g.lineWidth = 2.6;
  for (let k = 0; k < 6; k++) {
    const x = mix(3, 21, k / 5);
    const y = mix(-10, -31, k / 5);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 6, y + 2 - k * 0.3);
    g.stroke();
  }
  g.restore();
}

// The banner of Rohan: the white horse running on green, a gold band at the
// pole, the fly end cut in a swallowtail. Across the picture is along the
// cloth from the pole.
function bannerCanvas(W = 256) {
  const H = Math.round(W * 0.38);
  const c = makeCanvas(W, H);
  const n = makeNoise(61);
  paintPixels(c, (u, v, out) => {
    const weave = (n(u * W * 0.5, v * H * 0.5) - 0.5) * 0.12;
    const fold = fbm(n, u * 3 + 4, v * 1.5, { octaves: 3 });
    const k = 0.78 + fold * 0.32 + weave;
    out[0] = 40 * k;
    out[1] = 92 * k;
    out[2] = 44 * k;
  });
  const g = c.getContext('2d');
  g.fillStyle = '#c8a24a';
  g.fillRect(0, 0, W * 0.045, H);
  g.fillStyle = 'rgba(232, 224, 190, 0.85)';
  g.fillRect(0, H * 0.03, W, H * 0.025);
  g.fillRect(0, H * 0.945, W, H * 0.025);
  drawHorse(g, W * 0.43, H * 0.56, (H / 72) * 0.92, -1);
  g.globalCompositeOperation = 'destination-in';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W * 0.84, H / 2);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'source-over';
  return c;
}

// The great doors of Meduseld (one leaf): dark oak boards, a carved gold
// border, the sun in a ring above, a lattice of gold bands below with studs
// where they cross.
function doorCanvas(S) {
  const W = S;
  const H = S * 2;
  const c = makeCanvas(W, H);
  const sn = stretchNoise(73);
  paintPixels(c, (u, v, out) => {
    const fb = u * 5;
    const fx = fb - Math.floor(fb);
    const gap = smooth(0.01, 0.06, Math.min(fx, 1 - fx));
    const grain = sfbm(sn, u * 30, v * 2, 30, 2, 3);
    const k = (0.6 + grain * 0.5) * (0.4 + 0.6 * gap);
    out[0] = 92 * k;
    out[1] = 60 * k;
    out[2] = 36 * k;
  });
  const g = c.getContext('2d');
  const gold = '#d6aa4e';
  const groove = '#2c1a0c';
  const rect = (x, y, w, h, lw, col) => {
    g.lineWidth = lw;
    g.strokeStyle = col;
    g.strokeRect(x, y, w, h);
  };
  rect(W * 0.07, W * 0.07, W * 0.86, H - W * 0.14, W * 0.06, gold);
  rect(W * 0.07, W * 0.07, W * 0.86, H - W * 0.14, W * 0.014, groove);
  // the sun in its ring
  const cx = W / 2;
  const cy = H * 0.27;
  g.fillStyle = groove;
  g.beginPath();
  g.arc(cx, cy, W * 0.34, 0, TAU);
  g.fill();
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * TAU;
    const a1 = a0 + TAU / 32;
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(cx + Math.cos(a0) * W * 0.1, cy + Math.sin(a0) * W * 0.1);
    g.lineTo(cx + Math.cos((a0 + a1) / 2) * W * 0.29, cy + Math.sin((a0 + a1) / 2) * W * 0.29);
    g.lineTo(cx + Math.cos(a1) * W * 0.1, cy + Math.sin(a1) * W * 0.1);
    g.closePath();
    g.fill();
  }
  g.lineWidth = W * 0.045;
  g.strokeStyle = gold;
  g.beginPath();
  g.arc(cx, cy, W * 0.32, 0, TAU);
  g.stroke();
  g.fillStyle = gold;
  g.beginPath();
  g.arc(cx, cy, W * 0.08, 0, TAU);
  g.fill();
  g.lineWidth = W * 0.012;
  g.strokeStyle = groove;
  g.beginPath();
  g.arc(cx, cy, W * 0.05, 0, TAU);
  g.stroke();
  // a band across, studded
  g.fillStyle = gold;
  g.fillRect(W * 0.07, H * 0.47, W * 0.86, W * 0.05);
  // the lattice
  g.save();
  g.beginPath();
  g.rect(W * 0.1, H * 0.5, W * 0.8, H * 0.43);
  g.clip();
  g.lineWidth = W * 0.026;
  g.strokeStyle = gold;
  const step = W * 0.2;
  for (let k = -6; k < 12; k++) {
    g.beginPath();
    g.moveTo(k * step, H * 0.5);
    g.lineTo(k * step + H * 0.5, H);
    g.stroke();
    g.beginPath();
    g.moveTo(k * step, H * 0.5);
    g.lineTo(k * step - H * 0.5, H);
    g.stroke();
  }
  g.restore();
  g.fillStyle = '#e8c66a';
  for (let k = -6; k < 12; k++) {
    for (let j = 0; j < 8; j++) {
      const x = k * step + (j * step) / 2;
      const y = H * 0.5 + (j * step) / 2;
      if (x < W * 0.1 || x > W * 0.9 || y > H * 0.93) continue;
      g.beginPath();
      g.arc(x, y, W * 0.022, 0, TAU);
      g.fill();
    }
  }
  for (let i = 0; i < 14; i++) {
    for (const x of [W * 0.07, W * 0.93]) {
      g.beginPath();
      g.arc(x, W * 0.1 + ((H - W * 0.2) * i) / 13, W * 0.018, 0, TAU);
      g.fill();
    }
  }
  return c;
}

// Two strands of interlace across a band of the canvas (y0 to y1), on a
// painted ground, gold edged with a dark cut: `waves` times round.
function interlace(g, W, y0, y1, ground, waves = 6) {
  const h = y1 - y0;
  g.fillStyle = ground;
  g.fillRect(0, y0, W, h);
  const mid = (y0 + y1) / 2;
  for (const ph of [0, Math.PI]) {
    for (const [lw, col] of [
      [h * 0.3, '#24160c'],
      [h * 0.17, '#d8ac52'],
    ]) {
      g.lineWidth = lw;
      g.strokeStyle = col;
      g.beginPath();
      for (let x = -4; x <= W + 4; x += 2) {
        const y = mid + Math.sin((x / W) * TAU * waves + ph) * h * 0.28;
        if (x === -4) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  g.fillStyle = '#d8ac52';
  g.fillRect(0, y0, W, h * 0.08);
  g.fillRect(0, y1 - h * 0.08, W, h * 0.08);
}

// A carved and painted pillar, unrolled: round it across, up it upward.
// Gold rings, bands of interlace at the foot and the head (red and green),
// fluted dark wood between with gold set in every fourth flute.
function carveCanvas(S) {
  const W = S;
  const H = S * 2;
  const c = makeCanvas(W, H);
  const sn = stretchNoise(83);
  paintPixels(c, (u, v, out) => {
    const f = u * 16;
    const fx = f - Math.floor(f);
    const flute = 0.55 + 0.45 * Math.sin(Math.PI * fx);
    const grain = sfbm(sn, u * 48, v * 2, 48, 2, 3);
    const k = flute * (0.7 + grain * 0.5);
    out[0] = 84 * k;
    out[1] = 56 * k;
    out[2] = 34 * k;
  });
  const g = c.getContext('2d');
  const ring = (y, h) => {
    g.fillStyle = '#d4a64c';
    g.fillRect(0, y, W, h);
    g.fillStyle = 'rgba(40, 24, 10, 0.6)';
    g.fillRect(0, y + h * 0.45, W, h * 0.1);
  };
  ring(0, H * 0.035);
  interlace(g, W, H * 0.035, H * 0.15, '#7a2418', 6);
  ring(H * 0.15, H * 0.02);
  ring(H * 0.81, H * 0.02);
  interlace(g, W, H * 0.83, H * 0.95, '#24502e', 6);
  ring(H * 0.95, H * 0.05);
  // gold lozenges down every fourth flute
  g.fillStyle = '#d4a64c';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 4 + 0.5) / 16) * W;
    for (let y = H * 0.19; y < H * 0.79; y += W * 0.08) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + W * 0.018, y + W * 0.03);
      g.lineTo(x, y + W * 0.06);
      g.lineTo(x - W * 0.018, y + W * 0.03);
      g.closePath();
      g.fill();
    }
  }
  return c;
}

// The hall's floor: long boards, dark and worn, with straw strewn on them.
function hallFloorCanvas(S) {
  const { c, field } = planksCanvas(S, { seed: 91, boards: 6, light: [118, 92, 64], dark: [54, 40, 28], silver: 0.1 });
  const g = c.getContext('2d');
  const r = rng(93);
  for (let i = 0; i < 1600; i++) {
    const x = r() * S;
    const y = r() * S;
    const a = r() * TAU;
    const l = S * (0.008 + r() * 0.022);
    const k = r();
    g.strokeStyle = k < 0.4 ? 'rgba(196, 164, 92, 0.42)' : k < 0.8 ? 'rgba(150, 120, 64, 0.38)' : 'rgba(220, 190, 120, 0.5)';
    g.lineWidth = S * (0.0012 + r() * 0.0018);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return { c, field };
}

// The hall's hangings, three side by side: Eorl the Young on the white horse,
// on red; the white horse under the sun, on green; and a knot of gold on
// blue. Each P wide and 1.5 P high.
function tapestryCanvas(P) {
  const Hp = Math.round(P * 1.5);
  const c = makeCanvas(P * 3, Hp);
  const g = c.getContext('2d');
  const frame = (x0, bg, edge) => {
    g.fillStyle = bg;
    g.fillRect(x0, 0, P, Hp);
    g.save();
    g.beginPath();
    g.rect(x0, 0, P, Hp);
    g.clip();
    interlace(g, P * 3, Hp * 0.0, Hp * 0.06, edge, 18);
    interlace(g, P * 3, Hp * 0.94, Hp, edge, 18);
    g.restore();
    g.fillStyle = edge;
    g.fillRect(x0, 0, P * 0.06, Hp);
    g.fillRect(x0 + P * 0.94, 0, P * 0.06, Hp);
    g.fillStyle = '#d8ac52';
    g.fillRect(x0 + P * 0.06, Hp * 0.06, P * 0.012, Hp * 0.88);
    g.fillRect(x0 + P * 0.928, Hp * 0.06, P * 0.012, Hp * 0.88);
  };
  const sun = (x, y, r) => {
    g.fillStyle = '#d8ac52';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      g.beginPath();
      g.moveTo(x + Math.cos(a - 0.12) * r * 0.8, y + Math.sin(a - 0.12) * r * 0.8);
      g.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5);
      g.lineTo(x + Math.cos(a + 0.12) * r * 0.8, y + Math.sin(a + 0.12) * r * 0.8);
      g.fill();
    }
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  // Eorl
  frame(0, '#5c1c16', '#22402a');
  sun(P * 0.22, Hp * 0.17, P * 0.06);
  const s = P / 128;
  g.fillStyle = '#2e5a2a';
  g.beginPath();
  g.moveTo(P * 0.06, Hp * 0.84);
  for (let i = 0; i <= 12; i++) g.lineTo(P * 0.06 + (P * 0.88 * i) / 12, Hp * 0.8 + Math.sin(i * 1.7) * Hp * 0.012);
  g.lineTo(P * 0.94, Hp * 0.94);
  g.lineTo(P * 0.06, Hp * 0.94);
  g.fill();
  const hx = P * 0.5;
  const hy = Hp * 0.6;
  drawHorse(g, hx, hy, s * 0.95, -1);
  g.save();
  g.translate(hx, hy);
  g.scale(-s * 0.95, s * 0.95);
  // the cloak, the rider and his spear
  g.fillStyle = '#1e3a22';
  g.beginPath();
  g.moveTo(4, -31);
  g.quadraticCurveTo(-14, -30, -30, -15);
  g.lineTo(-8, -13);
  g.closePath();
  g.fill();
  g.strokeStyle = '#3a2a1c';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(1, -12);
  g.lineTo(9, 3);
  g.stroke();
  g.fillStyle = '#3c6e3a';
  g.beginPath();
  g.moveTo(-3, -11);
  g.lineTo(6, -11);
  g.lineTo(11, -30);
  g.lineTo(2, -32);
  g.closePath();
  g.fill();
  g.fillStyle = '#d8b090';
  g.beginPath();
  g.arc(9, -37, 4.4, 0, TAU);
  g.fill();
  g.fillStyle = '#d8ac52';
  g.beginPath();
  g.arc(9, -38.5, 4.6, Math.PI, TAU);
  g.fill();
  g.strokeStyle = '#efe8d8';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(7, -43);
  g.quadraticCurveTo(-2, -47, -8, -41);
  g.stroke();
  g.fillStyle = '#d8ac52';
  g.beginPath();
  g.arc(-2, -22, 6, 0, TAU);
  g.fill();
  g.strokeStyle = '#d8c8a0';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-14, -14);
  g.lineTo(52, -40);
  g.stroke();
  g.fillStyle = '#e8d8a8';
  g.beginPath();
  g.moveTo(52, -40);
  g.lineTo(46, -40);
  g.lineTo(58, -44);
  g.lineTo(48, -36);
  g.closePath();
  g.fill();
  g.restore();
  // the horse under the sun
  frame(P, '#24502a', '#5a1a16');
  sun(P * 1.5, Hp * 0.24, P * 0.1);
  drawHorse(g, P * 1.5, Hp * 0.6, s * 1.05, 1);
  // the knot
  frame(P * 2, '#1c2846', '#5a1a16');
  g.lineWidth = P * 0.035;
  for (const [col, w] of [
    ['#120c06', P * 0.06],
    ['#d8ac52', P * 0.034],
  ]) {
    g.strokeStyle = col;
    g.lineWidth = w;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      g.beginPath();
      g.arc(P * 2.5 + dx * P * 0.14, Hp * 0.42 + dy * P * 0.14, P * 0.17, 0, TAU);
      g.stroke();
    }
    g.beginPath();
    g.arc(P * 2.5, Hp * 0.42, P * 0.33, 0, TAU);
    g.stroke();
  }
  drawHorse(g, P * 2.3, Hp * 0.8, s * 0.42, 1);
  drawHorse(g, P * 2.7, Hp * 0.8, s * 0.42, -1);
  // the weave over all of it
  const n = makeNoise(97);
  const img = g.getImageData(0, 0, P * 3, Hp);
  const d = img.data;
  for (let y = 0; y < Hp; y++) {
    for (let x = 0; x < P * 3; x++) {
      const k = 0.82 + ((x + y) % 2) * 0.06 + n(x * 0.08, y * 0.08) * 0.16;
      const i = (y * P * 3 + x) * 4;
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Four painted shields in a 2 × 2 atlas: the sun in green and gold, the
// horse's head on green, red and white quartered, and rings.
function shieldCanvas(S) {
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const C = S / 2;
  const R = C * 0.47;
  const cells = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  cells.forEach(([i, j], k) => {
    const x = C * i + C / 2;
    const y = C * j + C / 2;
    g.save();
    g.beginPath();
    g.arc(x, y, R, 0, TAU);
    g.clip();
    if (k === 0) {
      for (let w = 0; w < 12; w++) {
        g.fillStyle = w % 2 ? '#d8ac52' : '#2c5a2a';
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, R, (w / 12) * TAU, ((w + 1) / 12) * TAU);
        g.fill();
      }
    } else if (k === 1) {
      g.fillStyle = '#2a5228';
      g.fillRect(x - R, y - R, R * 2, R * 2);
      drawHorse(g, x + R * 0.04, y + R * 0.12, (R / 60) * 0.82, 1);
    } else if (k === 2) {
      for (let q = 0; q < 4; q++) {
        g.fillStyle = q % 2 ? '#e6e0d0' : '#8a2418';
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, R, (q / 4) * TAU + 0.6, ((q + 1) / 4) * TAU + 0.6);
        g.fill();
      }
    } else {
      for (const [rr, col] of [
        [1, '#2c5a2a'],
        [0.78, '#e6e0d0'],
        [0.6, '#8a2418'],
        [0.4, '#2c5a2a'],
      ]) {
        g.fillStyle = col;
        g.beginPath();
        g.arc(x, y, R * rr, 0, TAU);
        g.fill();
      }
    }
    g.restore();
    g.lineWidth = R * 0.12;
    g.strokeStyle = '#3a3634';
    g.beginPath();
    g.arc(x, y, R * 0.94, 0, TAU);
    g.stroke();
    g.fillStyle = '#9a9488';
    g.beginPath();
    g.arc(x, y, R * 0.14, 0, TAU);
    g.fill();
  });
  return c;
}

// Embers: glowing cracks and hot spots in the dark, for an emissive map.
function emberCanvas(S) {
  const n = makeNoise(107);
  const cells = makeCells(109);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const k = cells(u * 6, v * 6, 6);
    const crack = 1 - smooth(0, 0.08, k.f2 - k.f1);
    const heat = smooth(0.4, 0.85, fbm(n, u * 4, v * 4, { period: 4, octaves: 3 }));
    const e = clamp01(crack * (0.4 + heat) + heat * 0.55);
    out[0] = 255 * e;
    out[1] = 255 * e * e * 0.8;
    out[2] = 255 * e * e * e * 0.4;
  });
}
// Ripples, for water: a height field of soft rings and swell.
function rippleField(S) {
  const n = makeNoise(101);
  const field = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      field[y * S + x] = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 }) * 0.7 + Math.sin((u + fbm(n, u * 3, v * 3, { period: 3 }) * 0.4) * TAU * 4) * 0.08;
    }
  }
  return field;
}
// Falling water: bright streaks running down.
function fallCanvas(S) {
  const sn = stretchNoise(103);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const s = sfbm(sn, u * 24, v * 2, 24, 2, 3);
    const k = smooth(0.3, 0.9, s);
    out[0] = 200 + 55 * k;
    out[1] = 220 + 35 * k;
    out[2] = 232 + 23 * k;
    out[3] = 70 + 170 * k;
  });
}
// A shaft of light: soft across, brightest just inside the window and
// fading down to the floor, dusty.
function shaftCanvas(W = 64, H = 128) {
  const n = makeNoise(5);
  return paintPixels(makeCanvas(W, H), (u, v, out) => {
    const across = Math.pow(Math.sin(Math.PI * u), 1.6);
    const along = smooth(0, 0.08, v) * (1 - smooth(0.35, 1, v));
    const dust = 0.7 + 0.3 * fbm(n, u * 4, v * 9, { octaves: 3 });
    const k = across * along * dust;
    out[0] = 255 * k;
    out[1] = 236 * k;
    out[2] = 204 * k;
  });
}

// What shiny things see: a room, dark below and paler above, with panels of
// light in it (the sky and the sun outside, the fire within).
function envRoom(renderer, low, high, lamps) {
  const room = new THREE.Scene();
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(low[0] + (high[0] - low[0]) * k, low[1] + (high[1] - low[1]) * k, low[2] + (high[2] - low[2]) * k);
  }
  walls.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  room.add(new THREE.Mesh(walls, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [hex, k, w, h, at] of lamps) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 0, 0);
    room.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// ── shaders ──

// Banners in the wind: each vertex rides a wave running out from the pole,
// bigger the further out it is (aWave: how far out, a phase, how much, the
// cloth's length), the end dipping as the gusts slacken. The normal leans
// with the wave, so the folds catch the light.
function windBanner(mat, U) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    const W = `vec3(${F5(WIND.x)}, 0.0, ${F5(WIND.z)})`;
    const A = `vec3(${F5(ACROSS.x)}, 0.0, ${F5(ACROSS.z)})`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aWave;\nuniform float uTime;')
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        float bk = aWave.x;
        float gust = 0.72 + 0.28 * sin(uTime * 0.83 + aWave.y) * sin(uTime * 0.37 + aWave.y * 2.1);
        float bs1 = uTime * 7.0 - bk * 8.5 + aWave.y;
        float bs2 = uTime * 12.0 - bk * 17.0 + aWave.y * 1.7;
        float bf = sin(bs1) * 0.7 + sin(bs2) * 0.22;
        float bw = bf * bk * aWave.z * gust;
        float bd = (bf + (-8.5 * 0.7 * cos(bs1) - 17.0 * 0.22 * cos(bs2)) * bk) * aWave.z * gust;
        objectNormal = normalize(objectNormal - ${W} * bd / aWave.w);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed += ${A} * bw;
        transformed -= ${W} * abs(bw) * 0.4;
        transformed.y += sin(bs1 * 0.8 + 1.3 + position.y * 0.6) * bk * aWave.z * 0.35 * gust;
        transformed.y -= bk * bk * aWave.w * 0.07 * (1.25 - gust);`,
      );
  };
  mat.customProgramCacheKey = () => 'edoras-banner';
}
// Grass (instanced, unturned) bends with the wind, more at the tip, gusting.
function windGrass(mat, U, k = 0.5) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 root = instanceMatrix[3].xyz;
      #else
        vec3 root = vec3(0.0);
      #endif
      float bend = position.y * position.y;
      float sway = 0.55 + 0.45 * sin(uTime * 2.3 + root.x * 0.21 + root.z * 0.13) * sin(uTime * 0.9 + root.x * 0.05);
      transformed.x += ${F5(WIND.x)} * bend * ${F5(k)} * (0.6 + sway);
      transformed.z += ${F5(WIND.z)} * bend * ${F5(k)} * (0.6 + sway);
      transformed.y -= bend * ${F5(k * 0.25)} * sway;`,
    );
  };
  mat.customProgramCacheKey = () => `edoras-grass${k}`;
}

// ── roofs ──

// A thatched roof along x: `len` gable to gable and `over` beyond each,
// its eaves `span` apart at y = 0, its ridge `rise` above; `t` thick, the
// thatch rolled round at the eaves and lumpy, a roll along the ridge.
// Texture coordinates by the metre (u along, v up the slope from the eave),
// and colours for the shade: darker in the roll and underneath, weathered
// in patches (by `weather`).
function thatchRoof({ len, span, rise, t = 0.5, over = 0.5, seed = 1, lump = 0.06, step = 0.8, uvK = 0.5, weather = 0.3 }) {
  const n = makeNoise(seed);
  const a = span / 2;
  const sl = Math.hypot(a, rise);
  const nz = rise / sl;
  const ny = a / sl;
  const dz = a / sl;
  const dy = -rise / sl;
  const K = Math.max(2, Math.ceil(sl / step));
  const e = 0.07;
  const e1 = Math.sqrt(1 + e * e) - e;
  // the section: [z, y, normal z, normal y, distance up from the eave]
  const sec = [];
  const rollPts = (side) => {
    const pz = side * a;
    const uz = side * (a - t * nz);
    const uy = -t * ny;
    const cz = (pz + uz) / 2;
    const cy = uy / 2;
    const out = [];
    for (let k = 0; k <= 4; k++) {
      const th = (k / 4) * Math.PI;
      const ca = Math.cos(th);
      const sa = Math.sin(th);
      const mz = side * nz * ca + side * dz * sa * 1.0;
      const my = ny * ca + dy * sa;
      out.push([cz + side * nz * (t / 2) * ca + side * dz * (t * 0.6) * sa, cy + ny * (t / 2) * ca + dy * (t * 0.6) * sa, mz, my, -t * 0.5 * (k / 4)]);
    }
    return out;
  };
  const left = rollPts(-1).reverse();
  sec.push(...left.slice(0, 4));
  for (let j = 0; j <= 2 * K; j++) {
    const f = j / K - 1;
    const z = a * f;
    const y = rise * (1 - (Math.sqrt(f * f + e * e) - e) / e1);
    const s = Math.sign(f);
    sec.push([z, y, s * nz, s ? ny : 1, (1 - Math.abs(f)) * sl]);
  }
  sec.push(...rollPts(1).slice(1));
  const uRidge = [0, rise - (t * sl) / a];
  const nx = Math.max(2, Math.ceil((len + 2 * over) / step));
  const xs = Array.from({ length: nx + 1 }, (_, i) => -len / 2 - over + ((len + 2 * over) * i) / nx);
  const rows = [];
  const uvs = [];
  const cols = [];
  for (const x of xs) {
    const row = [];
    const uv = [];
    const col = [];
    for (const [z, y, mz, my, v] of sec) {
      const side = z > 0 ? 50 : 0;
      const d = lump * 2 * (fbm(n, x * 0.55 + seed, v * 0.8 + side, { octaves: 2 }) - 0.5) + lump * 0.5 * Math.sin(x * 1.7 + v * 0.4 + seed);
      row.push([x, y + my * d, z + mz * d]);
      uv.push([x * uvK, v * uvK]);
      const wv = smooth(0.5, 0.78, fbm(n, x * 0.11 + 3, v * 0.25 + side + 7, { octaves: 3 }));
      const k = (v < 0 ? 0.62 : 0.72 + 0.28 * smooth(0, 1.6, v)) * (1 - weather * wv);
      col.push([k * (1 - weather * wv * 0.15), k, k * (1 - weather * wv * 0.35)]);
    }
    rows.push(row);
    uvs.push(uv);
    cols.push(col);
  }
  const parts = [grid(rows, uvs, cols)];
  // the underside: from the right eave's inside up to the ridge and down
  const last = sec.length - 1;
  {
    const r2 = [];
    const u2 = [];
    const c2 = [];
    rows.forEach((row) => {
      const x = row[0][0];
      const pr = row[last];
      const pl = row[0];
      r2.push([pr, [x, uRidge[1], 0], pl]);
      u2.push([
        [x * uvK, 0],
        [x * uvK, (a * uvK) / ny],
        [x * uvK, 0],
      ]);
      c2.push([0.38, 0.32, 0.38]);
    });
    parts.push(grid(r2, u2, c2));
  }
  // the ends: the section filled in
  for (const [i, sx] of [
    [0, -1],
    [rows.length - 1, 1],
  ]) {
    const ring = [...rows[i], [xs[i], uRidge[1], 0]];
    const contour = ring.map((p) => V2(p[2], p[1]));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const pos = [];
    for (const [ia, ib, ic] of faces) {
      const A = ring[ia];
      let B = ring[ib];
      let C = ring[ic];
      const nxv = (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]);
      if (Math.sign(nxv) !== sx) [B, C] = [C, B];
      pos.push(...A, ...B, ...C);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const uv = [];
    const cl = [];
    for (let k = 0; k < pos.length; k += 3) {
      uv.push(pos[k + 2] * uvK, pos[k + 1] * uvK);
      cl.push(0.5, 0.45, 0.4);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    parts.push(g);
  }
  // the roll along the ridge
  {
    const RS = 9;
    const rr = t * 0.75;
    const r3 = [];
    const u3 = [];
    const c3 = [];
    for (const x of xs) {
      const row = [];
      const uv = [];
      const col = [];
      for (let k = 0; k <= RS; k++) {
        const th = Math.PI * 0.92 - (Math.PI * 0.84 * k) / RS;
        const bump = 1 + (n(x * 0.9 + 11, k * 0.7) - 0.5) * 0.25;
        row.push([x, rise - t * 0.35 + Math.sin(th) * rr * bump, Math.cos(th) * rr * 1.25 * bump]);
        uv.push([x * uvK, k * 0.12]);
        col.push(0.8);
      }
      r3.push(row);
      u3.push(uv);
      c3.push(col);
    }
    parts.push(grid(r3, u3, c3));
  }
  return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
}

// Boards along a gable's verges, crossing over its apex and running on
// beyond it into a carved horse's head on each, looking out. In the plane
// x = `x`, the eaves `half` either side of z = 0 at y = y0, the apex `rise`
// above. `strip` lays a strip of gold along each board's face.
function crossBoards(bk, K, { x, y0, half, rise, ext = 1, w = 0.3, d = 0.12, mat, headMat, size = 0.8, strip = null, out = 1 }) {
  const len = Math.hypot(half, rise);
  const ez = half / len;
  const ey = rise / len;
  const lean = Math.atan2(ez, ey) * 0.75;
  for (const s of [-1, 1]) {
    const a = [x, y0, s * half];
    const b = [x, y0 + rise + ey * ext, -s * ez * ext];
    bk.add(mat, beam(a, b, d, w), { uv: 0.5 });
    if (strip) {
      const ox = out * (d / 2 + 0.012);
      const oy = ez * w * 0.28;
      const oz = s * ey * w * 0.28;
      bk.add(strip, beam([a[0] + ox, a[1] + oy, a[2] + oz], [b[0] + ox, b[1] + oy, b[2] + oz], 0.03, w * 0.2));
    }
    const hg = K.head.clone().scale(size, size, size * 1.4);
    hg.rotateY((s * Math.PI) / 2);
    hg.rotateX(-s * lean);
    hg.translate(b[0], b[1] - size * 0.12, b[2]);
    bk.add(headMat, hg, { uv: 0.6 });
  }
}

// ── lamps, banners, small things ──

// A torch in an iron cup on a bracket, out from a wall facing `turn` (its +x
// out of the wall). Returns where its flame is.
function bracketTorch(bk, mats, x, y, z, turn) {
  const c = Math.cos(turn);
  const s = -Math.sin(turn);
  const out = (d, dy = 0) => [x + c * d, y + dy, z + s * d];
  bk.add(mats.iron, tube([out(0, -0.5), out(0.25, -0.3), out(0.38, 0)], 0.035, 0.03, { seg: 4, radial: 5 }));
  bk.add(mats.beam, new THREE.CylinderGeometry(0.045, 0.035, 0.7, 6), { p: out(0.4, 0.1) });
  bk.add(mats.iron, lathe([[0.04, 0], [0.11, 0.1], [0.12, 0.2]], 8), { p: out(0.4, 0.35) });
  bk.add(mats.coals, new THREE.CircleGeometry(0.1, 8).rotateX(-Math.PI / 2), { p: out(0.4, 0.53) });
  return V3(...out(0.4, 0.68));
}
// A torch in an iron basket on a wooden post.
function torchPost(bk, mats, x, y, z, h = 2.2) {
  bk.add(mats.beam, new THREE.CylinderGeometry(0.07, 0.1, h, 6), { p: [x, y + h / 2, z] });
  bk.add(mats.iron, lathe([[0.04, 0], [0.16, 0.12], [0.2, 0.3]], 8), { p: [x, y + h, z] });
  bk.add(mats.coals, new THREE.CircleGeometry(0.17, 8).rotateX(-Math.PI / 2), { p: [x, y + h + 0.26, z] });
  return V3(x, y + h + 0.4, z);
}
// An iron brazier on three legs.
function brazier(bk, mats, x, y, z, h = 1.0) {
  for (let i = 0; i < 3; i++) {
    const an = (i / 3) * TAU + 0.3;
    bk.add(mats.iron, tube([[x + Math.cos(an) * 0.42, y, z + Math.sin(an) * 0.42], [x + Math.cos(an) * 0.26, y + h * 0.65, z + Math.sin(an) * 0.26], [x + Math.cos(an) * 0.34, y + h, z + Math.sin(an) * 0.34]], 0.04, 0.03, { seg: 5, radial: 5 }));
  }
  bk.add(mats.iron, lathe([[0.05, 0], [0.38, 0.1], [0.52, 0.3], [0.56, 0.34], [0.48, 0.34]], 12), { p: [x, y + h - 0.1, z] });
  bk.add(mats.coals, new THREE.CircleGeometry(0.48, 12).rotateX(-Math.PI / 2), { p: [x, y + h + 0.2, z] });
  return V3(x, y + h + 0.38, z);
}
// A banner's pole (a wooden staff with a gold knob), and the banner's place
// at its top: pushed onto `list` for bannerMesh.
function bannerPole(bk, mats, list, x, y, z, h, { len = 4.2, tall = 1.6, amp = 0.55 } = {}) {
  bk.add(mats.beam, new THREE.CylinderGeometry(0.07, 0.1, h, 6), { p: [x, y + h / 2, z] });
  bk.add(mats.gold, new THREE.SphereGeometry(0.13, 8, 6), { p: [x, y + h + 0.08, z] });
  list.push({ x, y: y + h - 0.2, z, len, tall, amp, phase: list.length * 1.93 });
}
// All the banners as one mesh, streaming in the wind.
function bannerMesh(mats, list) {
  const pos = [];
  const nor = [];
  const uv = [];
  const wave = [];
  const idx = [];
  const NX = 14;
  const NY = 4;
  for (const b of list) {
    const base = pos.length / 3;
    for (let j = 0; j <= NY; j++) {
      for (let i = 0; i <= NX; i++) {
        const k = i / NX;
        pos.push(b.x + WIND.x * k * b.len + ACROSS.x * 0.02, b.y - (j / NY) * b.tall, b.z + WIND.z * k * b.len + ACROSS.z * 0.02);
        nor.push(ACROSS.x, 0, ACROSS.z);
        uv.push(k, 1 - j / NY);
        wave.push(k, b.phase, b.amp, b.len);
      }
    }
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = base + j * (NX + 1) + i;
        const c = a + NX + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWave', new THREE.Float32BufferAttribute(wave, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.boundingSphere.radius += 2;
  const mesh = new THREE.Mesh(g, mats.banner);
  mesh.name = 'edoras-banners';
  return mesh;
}

// ── the stockade ──

// Marks round the stockade's ring (where hypot(x / stretch, z) is its r),
// about `gap` metres apart: [x, z, outward x, outward z] each.
function alongRing(gap, r = STOCKADE.r) {
  const N = 3000;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const an = (i / N) * TAU;
    const c = Math.cos(an);
    pts.push([c * r * stretchOf(c), Math.sin(an) * r]);
  }
  const out = [];
  let acc = 0;
  let next = 0;
  for (let i = 0; i < N; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[(i + 1) % N];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    while (next <= acc + seg) {
      const k = (next - acc) / seg;
      const x = mix(x0, x1, k);
      const z = mix(z0, z1, k);
      const s = stretchOf(x);
      const gx = x / (s * s);
      const gl = Math.hypot(gx, z);
      out.push([x, z, gx / gl, z / gl]);
      next += gap;
    }
    acc += seg;
  }
  return out;
}
const GATE_HALF = STOCKADE.gateW / 2;
const GATE_X = STOCKADE.r * HILL.east;
const TOWER = 3.6;
const inGateGap = (x, z) => x > 0 && Math.abs(z) < GATE_HALF + TOWER - 0.1;

// One log: sunk a metre, standing four, sharpened at the top.
function logGeometry(seg = 7) {
  const body = new THREE.CylinderGeometry(0.22, 0.25, 5, seg, 1, true).translate(0, 1.5, 0);
  const tip = new THREE.ConeGeometry(0.22, 0.75, seg, 1, true).translate(0, 4.375, 0);
  const uvb = body.attributes.uv;
  for (let i = 0; i < uvb.count; i++) uvb.setY(i, uvb.getY(i) * 3.3);
  const uvt = tip.attributes.uv;
  for (let i = 0; i < uvt.count; i++) uvt.setXY(i, uvt.getX(i), 3.3 + uvt.getY(i) * 0.5);
  const g = mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()]);
  g.computeBoundingSphere();
  return g;
}

function stockade(bk, K, logs, lamps, banners) {
  const { mats } = K;
  const r = rng(301);
  // the logs, shoulder to shoulder round the ring
  for (const [x, z] of alongRing(0.47)) {
    if (inGateGap(x, z)) continue;
    logs.push({ x, y: groundAt(x, z) - 0.05 + (r() - 0.5) * 0.25, z, s: 0.9 + r() * 0.22, sy: 0.92 + r() * 0.16, rx: (r() - 0.5) * 0.05, ry: r() * TAU, rz: (r() - 0.5) * 0.05, k: r() });
  }
  // two rails along the inside, and props against them
  const marks = alongRing(2.9).filter(([x, z]) => !inGateGap(x, z));
  const inner = (m, d) => [m[0] - m[2] * d, m[1] - m[3] * d];
  for (let i = 0; i < marks.length; i++) {
    const m0 = marks[i];
    const m1 = marks[(i + 1) % marks.length];
    if (Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) > 4) continue;
    const [ax, az] = inner(m0, 0.38);
    const [bx, bz] = inner(m1, 0.38);
    const ga = groundAt(ax, az);
    const gb = groundAt(bx, bz);
    for (const hh of [1.3, 3.2]) bk.add(mats.logs, beam([ax, ga + hh, az], [bx, gb + hh, bz], 0.2, 0.24), { uv: 0.6 });
    if (i % 3 === 0) {
      const [px, pz] = inner(m0, 2.3);
      bk.add(mats.logs, beam([px, groundAt(px, pz) - 0.2, pz], [ax - m0[2] * 0.12, ga + 3.0, az - m0[3] * 0.12], 0.17, 0.17), { uv: 0.6 });
    }
  }
  gatehouse(bk, K, logs, lamps, banners);
}

// The gate: two towers of upright logs with a lookout on each under a small
// thatched roof, a bridge between them over the gateway, the beam over the
// gate with its carved crest, and the gates standing open.
function gatehouse(bk, K, logs, lamps, banners) {
  const { mats } = K;
  const R = STOCKADE.r;
  const half = GATE_HALF;
  const r = rng(311);
  const gG = groundAt(GATE_X, 0);
  for (const s of [-1, 1]) {
    const tz = s * (half + TOWER / 2);
    const tx = Math.sqrt(R * R - tz * tz) * HILL.east;
    const g = groundAt(tx, tz);
    // the walls, of logs cut off under the lookout's floor
    const h2 = TOWER / 2;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 8; i++) {
        const t = -h2 + 0.22 + ((TOWER - 0.44) * i) / 7;
        const [lx, lz] = k === 0 ? [h2 - 0.22, t] : k === 1 ? [-h2 + 0.22, t] : k === 2 ? [t, h2 - 0.22] : [t, -h2 + 0.22];
        logs.push({ x: tx + lx, y: g - 0.05, z: tz + lz, s: 1.05, sy: 5.1 / 4.75, rx: 0, ry: r() * TAU, rz: 0, k: r() });
      }
    }
    bk.at([tx, 0, tz], 0, () => {
      const top = g + 5.3;
      bk.add(mats.beam, box(TOWER + 0.9, 0.3, TOWER + 0.9), { p: [0, top + 0.15, 0], uv: 0.5 });
      // joists' ends under it
      for (let i = 0; i < 5; i++) bk.add(mats.beam, box(TOWER + 1.1, 0.22, 0.22), { p: [0, top - 0.11, -1.6 + i * 0.8], uv: 0.5 });
      // the railing round the lookout
      const e = TOWER / 2 + 0.38;
      for (const [cx, cz] of [
        [e, e],
        [-e, e],
        [e, -e],
        [-e, -e],
      ]) {
        bk.add(mats.beam, box(0.22, 2.4, 0.22), { p: [cx, top + 1.3, cz], uv: 0.5 });
      }
      for (const yy of [0.55, 1.05]) {
        for (const sd of [-1, 1]) {
          bk.add(mats.beam, box(2 * e, 0.12, 0.1), { p: [0, top + 0.3 + yy, sd * e], uv: 0.5 });
          bk.add(mats.beam, box(0.1, 0.12, 2 * e), { p: [sd * e, top + 0.3 + yy, 0], uv: 0.5 });
        }
      }
      for (let i = 0; i < 9; i++) {
        const t = -e + (2 * e * (i + 0.5)) / 9;
        for (const sd of [-1, 1]) {
          bk.add(mats.timber, box(0.18, 0.95, 0.06), { p: [t, top + 0.78, sd * e], uv: 0.4, color: 0xa09080 });
          bk.add(mats.timber, box(0.06, 0.95, 0.18), { p: [sd * e, top + 0.78, t], uv: 0.4, color: 0xa09080 });
        }
      }
      // the little roof over it, its gables east and west with their horses
      const yE = top + 2.4;
      const roof = thatchRoof({ len: 2 * e, span: 2 * e + 1.1, rise: 2.4, t: 0.32, over: 0.3, seed: 40 + s, lump: 0.04, step: 0.7 * K.Q.step });
      bk.add(mats.thatch, roof, { p: [0, yE, 0], tint: 0xd8c8a8 });
      for (const sx of [-1, 1]) {
        crossBoards(bk, K, { x: sx * (e + 0.32), y0: yE + 0.05, half: e + 0.55, rise: 2.4, ext: 0.7, w: 0.24, d: 0.1, mat: mats.beam, headMat: mats.beam, size: 0.6 });
        bk.add(mats.timber, gableTri(e + 0.2, 2.0, 0.08), { p: [sx * (e + 0.05) + (sx > 0 ? 0.08 : 0), yE + 0.0, 0], uv: 0.4, color: 0x8a7a6a });
      }
    });
    // torches either side of the gateway, out and in
    lamps.push(bracketTorch(bk, mats, tx + h2 + 0.02, g + 3.4, s * (half + 0.55), 0));
    lamps.push(bracketTorch(bk, mats, tx - h2 - 0.02, g + 3.4, s * (half + 0.55), Math.PI));
    // a banner over each tower
    bannerPole(bk, mats, banners, tx + h2 + 0.28, g + 5.45, s * (half + TOWER + 0.1), 6.6, { len: 4.4, tall: 1.6 });
    // the gate, standing open inward
    const hx = tx - 0.15;
    const hz = s * (half - 0.05);
    const ang = 0.18;
    const dir = [-Math.cos(ang), s * Math.sin(ang)];
    const leaf = (d) => [hx + dir[0] * d, hz + dir[1] * d];
    const [ex, ez] = leaf(3.35);
    bk.add(mats.timber, beam([hx, gG + 2.4, hz], [ex, gG + 2.4, ez], 0.16, 4.6), { uv: 0.42, color: 0xb0a090 });
    const nrm = [-dir[1] * s, dir[0] * s];
    const off = (d, k) => [leaf(d)[0] + nrm[0] * k * 0.12, leaf(d)[1] + nrm[1] * k * 0.12];
    for (const sd of [-1, 1]) {
      for (const yy of [0.6, 2.4, 4.2]) {
        const [a0, a1] = off(0.1, sd);
        const [b0, b1] = off(3.25, sd);
        bk.add(mats.beam, beam([a0, gG + yy, a1], [b0, gG + yy, b1], 0.1, 0.3), { uv: 0.5 });
      }
      const [c0, c1] = off(0.2, sd);
      const [d0, d1] = off(3.1, sd);
      bk.add(mats.beam, beam([c0, gG + 0.75, c1], [d0, gG + 4.05, d1], 0.09, 0.26), { uv: 0.5 });
    }
    for (const yy of [0.9, 3.9]) {
      const [a0, a1] = off(0.0, s);
      const [b0, b1] = off(1.6, s);
      bk.add(mats.iron, beam([a0, gG + yy, a1], [b0, gG + yy, b1], 0.04, 0.12));
    }
  }
  // the bridge between the towers, the beam over the gate and its crest
  const tz0 = half + TOWER / 2;
  const tx0 = Math.sqrt(R * R - tz0 * tz0) * HILL.east;
  const top = gG + 5.3;
  bk.add(mats.beam, box(2.8, 0.3, 2 * half + 0.6), { p: [tx0, top + 0.15, 0], uv: 0.5 });
  bk.add(mats.beam, box(0.75, 0.75, 2 * half + 1.6), { p: [tx0 + 1.0, top - 0.42, 0], uv: 0.5 });
  bk.add(mats.beam, box(0.75, 0.75, 2 * half + 1.6), { p: [tx0 - 1.0, top - 0.42, 0], uv: 0.5 });
  for (const sx of [-1, 1]) {
    for (const yy of [0.55, 1.05]) bk.add(mats.beam, box(0.1, 0.12, 2 * half + 0.4), { p: [tx0 + sx * 1.3, top + 0.3 + yy, 0], uv: 0.5 });
    for (let i = 0; i < 5; i++) bk.add(mats.beam, box(0.18, 1.1, 0.18), { p: [tx0 + sx * 1.3, top + 0.85, -half + (2 * half * i) / 4], uv: 0.5 });
  }
  // the crest over the gate: a carved board with two horses' heads looking out
  bk.add(mats.timber, box(0.14, 0.7, 2 * half + 1.0), { p: [tx0 + 1.42, top + 1.75, 0], uv: 0.4, color: 0x9a8a7a });
  bk.add(mats.gold, box(0.05, 0.08, 2 * half + 1.0), { p: [tx0 + 1.5, top + 1.55, 0] });
  for (const s of [-1, 1]) {
    const hg = K.head.clone().scale(1.1, 1.1, 1.0);
    hg.rotateY((-s * Math.PI) / 2);
    hg.translate(tx0 + 1.42, top + 1.95, s * (half + 0.2));
    bk.add(mats.gold, hg);
  }
}
// ── the road ──

// A ribbon of trodden earth from the barrows to the foot of the stair, just
// over the ground, its edges ragged into the grass.
function road(bk, K) {
  const { mats } = K;
  const W = ROAD.w + 1.4;
  const nz = 6;
  const rows = [];
  const uvs = [];
  for (let x = ROAD.x0 + 1; x >= ROAD.x1 - 0.6; x -= 1) {
    const row = [];
    const uv = [];
    for (let j = 0; j <= nz; j++) {
      const z = W / 2 - (W * j) / nz;
      row.push([x, groundAt(x, z) + 0.06, z]);
      uv.push([j / nz, x / 4]);
    }
    rows.push(row);
    uvs.push(uv);
  }
  bk.add(mats.road, grid(rows, uvs, null));
}

// ── the great stair, its stream and the horse-head fountain ──

function stair(bk, K, lamps) {
  const { mats } = K;
  const xa = STAIR.x0;
  const xb = STAIR.x1;
  const hw = STAIR.w / 2;
  const ya = groundAt(xa, 0);
  const yb = groundAt(xb, 0);
  const N = Math.round((yb - ya) / 0.19);
  const run = (xa - xb) / N;
  for (let i = 0; i < N; i++) {
    const front = xa - i * run;
    const back = front - run;
    const top = Math.max(ya + ((i + 1) * (yb - ya)) / N + 0.06, groundAt(back, 0) + 0.08);
    bk.add(mats.stone, box(run + 0.06, 1.0, 2 * hw), { p: [(front + back) / 2 - 0.03, top - 0.5, 0], uv: 0.5 });
  }
  // the walls either side, their coping, and a pier at each end with a torch
  const wl = [xa + 0.9, ya];
  const wh = [xb - 0.5, yb];
  const lineY = (x) => mix(ya, yb, (xa - x) / (xa - xb));
  for (const s of [-1, 1]) {
    const zc = s * (hw + 0.3);
    const g = slabOf(
      [
        [wl[0], lineY(wl[0]) - 1.2],
        [wh[0], lineY(wh[0]) - 1.2],
        [wh[0], lineY(wh[0]) + 0.8],
        [wl[0], lineY(wl[0]) + 0.8],
      ],
      0.6,
    );
    bk.add(mats.stone, g, { p: [0, 0, zc - 0.3], uv: 0.5 });
    bk.add(mats.stone, beam([wl[0], lineY(wl[0]) + 0.86, zc], [wh[0], lineY(wh[0]) + 0.86, zc], 0.78, 0.14), { uv: 0.5 });
    for (const [px, py] of [
      [xa + 0.4, groundAt(xa + 0.4, zc)],
      [xb - 0.5, groundAt(xb - 0.5, zc)],
    ]) {
      bk.add(mats.stone, box(1.1, 2.4, 1.1), { p: [px, py + 0.3, zc], uv: 0.5 });
      bk.add(mats.stone, box(1.3, 0.18, 1.3), { p: [px, py + 1.58, zc], uv: 0.5 });
      lamps.push(torchPost(bk, mats, px, py + 1.67, zc, 0.5));
    }
    lamps.push(torchPost(bk, mats, (xa + xb) / 2, lineY((xa + xb) / 2) + 0.93, zc, 0.45));
  }
  // the stream: a stone channel down the north side, falling pool to pool
  const z0 = -(hw + 0.62);
  const z1 = z0 - 1.0;
  const zm = (z0 + z1) / 2;
  const p0 = xb - 0.2;
  const p1 = xa - 0.1;
  const J = 8;
  const Lp = (p1 - p0) / J;
  const lvl = (j) => groundAt(p0 + (j + 1) * Lp, zm) + 0.22;
  for (let j = 0; j < J; j++) {
    const xA = p0 + j * Lp;
    const xB = xA + Lp;
    const w = lvl(j);
    bk.add(mats.water, new THREE.PlaneGeometry(Lp, z0 - z1).rotateX(-Math.PI / 2), { p: [(xA + xB) / 2, w, zm] });
    bk.add(mats.stone, box(Lp, 0.3, z0 - z1), { p: [(xA + xB) / 2, w - 0.4, zm], uv: 0.5 });
    if (j < J - 1) {
      const w2 = lvl(j + 1);
      bk.add(mats.fall, new THREE.PlaneGeometry(z0 - z1, w - w2 + 0.04).rotateY(Math.PI / 2), { p: [xB + 0.03, (w + w2) / 2, zm] });
      bk.add(mats.stone, box(0.22, 0.24, z0 - z1 + 0.1), { p: [xB - 0.11, w - 0.1, zm], uv: 0.5 });
    }
  }
  // its outer wall
  bk.add(
    mats.stone,
    slabOf(
      [
        [p0 - 0.4, groundAt(p0, z1) - 1.6],
        [p1 + 0.1, groundAt(p1, z1) - 1.6],
        [p1 + 0.1, groundAt(p1, z1) + 0.45],
        [p0 - 0.4, groundAt(p0, z1) + 0.45],
      ],
      0.5,
    ),
    { p: [0, 0, z1 - 0.5], uv: 0.5 },
  );
  // where it comes from under the terrace: a spout in a block of stone
  bk.add(mats.stone, box(0.8, 1.6, 1.6), { p: [p0 - 0.4, lvl(0) + 0.5, zm], uv: 0.5 });
  bk.add(mats.fall, new THREE.PlaneGeometry(0.5, 0.5).rotateY(Math.PI / 2), { p: [p0 + 0.02, lvl(0) + 0.24, zm] });
  // the fountain at the foot: the horse's head spouting into a basin
  const gF = groundAt(xa + 0.5, zm);
  bk.add(mats.stone, box(1.0, 2.3, 1.6), { p: [xa + 0.4, gF + 0.55, zm], uv: 0.5 });
  bk.add(mats.stone, box(1.2, 0.16, 1.8), { p: [xa + 0.4, gF + 1.75, zm], uv: 0.5 });
  const hs = 1.15;
  const head = K.head.clone().scale(hs, hs, 1.6);
  bk.add(mats.stone, head, { p: [xa + 0.62, gF + 0.32, zm], uv: 0.5 });
  const mouth = [xa + 0.62 + 0.7 * hs, gF + 0.32 + 0.4 * hs, zm];
  const bx = mouth[0] + 1.25;
  const gB = Math.min(groundAt(bx - 1.1, zm), groundAt(bx + 1.1, zm), groundAt(bx, zm - 0.9), groundAt(bx, zm + 0.9));
  const top = groundAt(bx, zm) + 0.5;
  for (const [w, d, ox, oz] of [
    [2.4, 0.26, 0, -0.87],
    [2.4, 0.26, 0, 0.87],
    [0.26, 2.0, -1.07, 0],
    [0.26, 2.0, 1.07, 0],
  ])
    bk.add(mats.stone, box(w, top - gB + 0.4, d), { p: [bx + ox, (top + gB - 0.4) / 2, zm + oz], uv: 0.5 });
  bk.add(mats.water, new THREE.PlaneGeometry(2.0, 1.5).rotateX(-Math.PI / 2), { p: [bx, top - 0.12, zm] });
  bk.add(mats.fall, tube([mouth, [mouth[0] + 0.3, mouth[1] - 0.05, zm], [mouth[0] + 0.55, top - 0.1, zm]], 0.06, 0.08, { seg: 6, radial: 6 }));
}

// ── the terrace before the doors ──

function terrace(bk, K, lamps, banners) {
  const { mats } = K;
  const { x0, x1, z0, z1 } = TERRACE;
  const nx = 20;
  const nz = 32;
  const rows = [];
  const uvs = [];
  for (let i = 0; i <= nx; i++) {
    const x = x0 - 0.6 + ((x1 - x0 + 0.6) * i) / nx;
    const row = [];
    const uv = [];
    for (let j = 0; j <= nz; j++) {
      const z = z0 + ((z1 - z0) * j) / nz;
      row.push([x, groundAt(x, z) + 0.07, z]);
      uv.push([x / 3.2, z / 3.2]);
    }
    rows.push(row);
    uvs.push(uv);
  }
  bk.add(mats.paving, grid(rows, uvs, null));
  // a kerb round it, and low walls on three sides (open to the stair)
  const run = (xa, za, xb, zb, h, w, mat = mats.stone, dy = 0) => {
    const n = Math.max(1, Math.round(Math.hypot(xb - xa, zb - za) / 1.2));
    for (let i = 0; i < n; i++) {
      const ax = mix(xa, xb, i / n);
      const az = mix(za, zb, i / n);
      const bx = mix(xa, xb, (i + 1) / n);
      const bz = mix(za, zb, (i + 1) / n);
      bk.add(mat, beam([ax, groundAt(ax, az) + dy + h / 2 - 0.5, az], [bx, groundAt(bx, bz) + dy + h / 2 - 0.5, bz], w, h + 1), { uv: 0.5 });
    }
  };
  for (const s of [-1, 1]) {
    run(x0 + 0.4, s * (z1 + 0.35), x1 + 0.35, s * (z1 + 0.35), 0.62, 0.55);
    run(x0 + 0.4, s * (z1 + 0.35), x1 + 0.35, s * (z1 + 0.35), 0.1, 0.7, mats.stone, 0.62);
    run(x1 + 0.35, s * 3.65, x1 + 0.35, s * (z1 + 0.6), 0.62, 0.55);
    run(x1 + 0.35, s * 3.65, x1 + 0.35, s * (z1 + 0.6), 0.1, 0.7, mats.stone, 0.62);
    // braziers at the stair's head and by the porch; a banner at each corner
    lamps.push(brazier(bk, mats, x1 - 0.8, groundAt(x1 - 0.8, s * 4.6), s * 4.6));
    lamps.push(brazier(bk, mats, 19.2, groundAt(19.2, s * 7.0), s * 7.0));
    bannerPole(bk, mats, banners, x1 - 0.4, groundAt(x1 - 0.4, s * (z1 - 0.4)), s * (z1 - 0.4), 9.5, { len: 4.8, tall: 1.7 });
  }
}

// ── Meduseld ──

// The Golden Hall from outside: on its plinth of stone, its walls of dark
// timber framed in heavy posts, its high roof thatched with gold, the gables
// crossed with boards ending in golden horses, the porch on the east on its
// painted pillars with its own gable and horses, the great doors.
function meduseld(bk, K, lamps, banners) {
  const { mats, Q } = K;
  const F = FLOOR;
  const WX0 = MEDUSELD.x0 + 0.8;
  const WX1 = MEDUSELD.x1 - 0.4;
  const WZ = MEDUSELD.z1 - 1.1;
  const E = F + 5.0;
  const RIDGE = groundAt(0, 0) + MEDUSELD.h + 0.3;
  const EZ = MEDUSELD.z1 + 0.6;
  const yE = (E + 0.12 - RIDGE * (1 - (WZ + 0.4) / EZ)) / ((WZ + 0.4) / EZ);
  const RISE = RIDGE - yE;
  const L = WX1 - WX0;
  const CX = (WX0 + WX1) / 2;
  const OVER = 0.8;
  const tw = 0xeee0cc;
  // the plinth
  bk.add(mats.stone, box(L + 0.8, 1.7, 2 * WZ + 1.4), { p: [CX - 0.2, F - 0.85, 0], uv: 0.45 });
  bk.add(mats.stone, box(L + 1.4, 3.0, 2 * WZ + 2.0), { p: [CX - 0.4, F - 3.15, 0], uv: 0.45 });
  bk.add(mats.stone, box(L + 1.0, 0.16, 2 * WZ + 1.6), { p: [CX - 0.2, F - 0.08, 0], uv: 0.45 });
  // the walls, and their frame
  bk.add(mats.timber, box(L, E - F, 2 * WZ), { p: [CX, (F + E) / 2, 0], uv: 1 / 2.4, color: tw });
  const nb = Math.round(L / 3.6);
  for (let i = 0; i <= nb; i++) {
    const x = WX0 + (L * i) / nb;
    for (const s of [-1, 1]) bk.add(mats.beam, box(i === 0 || i === nb ? 0.6 : 0.42, E - F + 0.1, 0.3), { p: [x, (F + E) / 2, s * (WZ + 0.08)], uv: 0.5 });
    // a window in every other bay
    if (i < nb && i % 2 === 1) {
      const xm = x + L / nb / 2;
      for (const s of [-1, 1]) {
        bk.add(mats.glass, box(0.9, 1.0, 0.1), { p: [xm, F + 2.75, s * (WZ + 0.02)] });
        for (const [w, h, dx, dy] of [
          [1.2, 0.16, 0, 0.58],
          [1.2, 0.2, 0, -0.6],
          [0.14, 1.2, 0.52, 0],
          [0.14, 1.2, -0.52, 0],
        ])
          bk.add(mats.beam, box(w, h, 0.14), { p: [xm + dx, F + 2.75 + dy, s * (WZ + 0.08)], uv: 0.5 });
        for (const sd of [-1, 1]) bk.add(mats.timber, box(0.5, 1.05, 0.06), { p: [xm + sd * 0.86, F + 2.75, s * (WZ + 0.14)], uv: 0.4, color: 0x8a7a6a });
      }
    }
  }
  for (const s of [-1, 1]) {
    bk.add(mats.beam, box(L + 0.4, 0.34, 0.36), { p: [CX, F + 0.17, s * (WZ + 0.1)], uv: 0.5 });
    bk.add(mats.beam, box(L + 0.4, 0.42, 0.42), { p: [CX, E - 0.2, s * (WZ + 0.1)], uv: 0.5 });
    bk.add(mats.beam, box(L, 0.22, 0.26), { p: [CX, F + 1.7, s * (WZ + 0.06)], uv: 0.5 });
    bk.add(mats.gold, box(L, 0.07, 0.04), { p: [CX, F + 1.7, s * (WZ + 0.2)] });
  }
  for (const x of [WX0, WX1]) {
    const s = x > CX ? 1 : -1;
    bk.add(mats.beam, box(0.4, 0.34, 2 * WZ), { p: [x + s * 0.1, F + 0.17, 0], uv: 0.5 });
    bk.add(mats.beam, box(0.44, 0.42, 2 * WZ + 0.4), { p: [x + s * 0.1, E - 0.2, 0], uv: 0.5 });
    for (const z of [-WZ / 2, WZ / 2]) bk.add(mats.beam, box(0.3, E - F, 0.4), { p: [x + s * 0.08, (F + E) / 2, z], uv: 0.5 });
  }
  // the gables, and the roof
  for (const x of [WX0, WX1]) {
    const s = x > CX ? 1 : -1;
    bk.add(mats.timber, gableTri(WZ, RIDGE - 1.0 - E, 0.3), { p: [x + (s > 0 ? 0.3 : 0), E, 0], uv: 1 / 2.4, color: tw });
    bk.add(mats.beam, box(0.34, 0.32, 2 * WZ * 0.5), { p: [x + s * 0.2, E + (RIDGE - E) * 0.48, 0], uv: 0.5 });
    bk.add(mats.beam, box(0.3, RIDGE - E - 1.2, 0.3), { p: [x + s * 0.18, (E + RIDGE - 1.2) / 2, 0], uv: 0.5 });
  }
  const roof = thatchRoof({ len: L, span: 2 * EZ, rise: RISE, t: 0.8, over: OVER, seed: 7, lump: 0.1, step: 0.8 * Q.step, uvK: 0.5, weather: 0.1 });
  bk.add(mats.goldThatch, roof, { p: [CX, yE, 0] });
  bk.add(mats.gold, box(L + 2 * OVER + 0.6, 0.3, 0.24), { p: [CX, RIDGE + 0.3, 0] });
  for (let i = 0; i <= 8; i++) bk.add(mats.gold, new THREE.ConeGeometry(0.14, 0.5, 6), { p: [WX0 - OVER + ((L + 2 * OVER) * i) / 8, RIDGE + 0.65, 0] });
  // dormers on the long sides, each with its own gable and golden horses
  for (const dx of [-15.5, -3.5]) {
    for (const s of [-1, 1]) {
      const dy0 = E - 0.3;
      const dR = 2.3;
      const dS = 3.6;
      bk.at([dx, 0, 0], s > 0 ? 0 : Math.PI, () => {
        bk.add(mats.timber, box(dS - 0.6, 2.5, 4.4), { p: [0, dy0 + 1.25, WZ - 2.0], uv: 1 / 2.4, color: tw });
        bk.add(mats.timber, gableTri(dS / 2 - 0.3, dR - 0.45, 0.2).rotateY(-Math.PI / 2), { p: [0, dy0 + 2.5, WZ + 0.2], uv: 1 / 2.4, color: tw });
        bk.add(mats.glass, box(1.2, 1.1, 0.1), { p: [0, dy0 + 1.25, WZ + 0.22] });
        for (const [w, h, ox, oy] of [
          [1.6, 0.18, 0, 0.64],
          [1.6, 0.2, 0, -0.64],
          [0.16, 1.4, 0.7, 0],
          [0.16, 1.4, -0.7, 0],
        ])
          bk.add(mats.beam, box(w, h, 0.16), { p: [ox, dy0 + 1.25 + oy, WZ + 0.27], uv: 0.5 });
        for (const q of [-1, 1]) bk.add(mats.beam, box(0.3, 2.6, 0.3), { p: [q * (dS / 2 - 0.3), dy0 + 1.3, WZ + 0.12], uv: 0.5 });
        const dr = thatchRoof({ len: 4.6, span: dS + 0.6, rise: dR, t: 0.45, over: 0.35, seed: 70 + dx + s, lump: 0.05, step: 0.6 * Q.step, weather: 0.08 });
        dr.rotateY(Math.PI / 2);
        bk.add(mats.goldThatch, dr, { p: [0, dy0 + 2.45, WZ - 2.0] });
        // its boards, in the plane of its gable (turned so crossBoards' x is out)
        bk.at([0, 0, WZ + 0.72], -Math.PI / 2, () => {
          crossBoards(bk, K, { x: 0, y0: dy0 + 2.53, half: (dS + 0.6) / 2 + 0.05, rise: dR, ext: 0.9, w: 0.34, d: 0.14, mat: mats.beam, headMat: mats.gold, size: 0.95, strip: mats.gold, out: 1 });
        });
      });
    }
  }
  // the great boards and their horses, at both ends
  for (const s of [-1, 1]) {
    const x = s > 0 ? WX1 + OVER + 0.14 : WX0 - OVER - 0.14;
    crossBoards(bk, K, { x, y0: yE + 0.15, half: EZ + 0.1, rise: RISE, ext: 3.2, w: 0.75, d: 0.26, mat: mats.beam, headMat: mats.gold, size: 2.2, strip: mats.gold, out: s });
  }
  // the sun on the east gable, over the porch, and on the west
  const sunDisc = (x, y, r, s) => {
    const rot = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    bk.add(mats.gold, new THREE.RingGeometry(r * 0.78, r, 28).rotateY(rot), { p: [x, y, 0] });
    bk.add(mats.gold, new THREE.CircleGeometry(r * 0.32, 18).rotateY(rot), { p: [x, y, 0] });
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * TAU;
      bk.add(mats.gold, box(0.05, r * 0.42, 0.08), { p: [x, y + Math.cos(an) * r * 0.56, Math.sin(an) * r * 0.56], r: [an, 0, 0] });
    }
  };
  sunDisc(WX1 + 0.34, RIDGE - 3.6, 1.25, 1);
  sunDisc(WX0 - 0.34, RIDGE - 4.2, 1.0, -1);
  // the porch
  const PX = 16.6;
  const PZ = [-6.6, -2.8, 2.8, 6.6];
  const PB = F + 4.0;
  const seg = Math.round(14 * Q.around);
  bk.add(mats.beam, box(0.6, 0.62, 2 * 7.3), { p: [PX, PB + 0.31, 0], uv: 0.5 });
  bk.add(mats.gold, box(0.04, 0.1, 2 * 7.3), { p: [PX + 0.31, PB + 0.31, 0] });
  for (const s of [-1, 1]) bk.add(mats.beam, box(PX - WX1, 0.5, 0.42), { p: [(PX + WX1) / 2, PB + 0.36, s * 6.6], uv: 0.5 });
  bk.add(mats.timber, box(PX - WX1 + 0.3, 0.08, 13.6), { p: [(PX + WX1) / 2, PB + 0.66, 0], uv: 0.5, color: 0x8a7a6a });
  for (const z of PZ) {
    const g = groundAt(PX, z) + 0.07;
    bk.add(mats.stone, box(0.95, 0.4, 0.95), { p: [PX, g + 0.2, z], uv: 0.5 });
    bk.add(mats.beam, lathe([[0.42, 0], [0.42, 0.1], [0.36, 0.22], [0.33, 0.32]], seg), { p: [PX, g + 0.4, z] });
    bk.add(mats.gold, new THREE.TorusGeometry(0.34, 0.035, 5, seg).rotateX(Math.PI / 2), { p: [PX, g + 0.74, z] });
    const h = PB - 0.55 - (g + 0.72);
    bk.add(mats.carve, new THREE.CylinderGeometry(0.31, 0.34, h, seg, 1, true), { p: [PX, g + 0.72 + h / 2, z] });
    bk.add(mats.gold, new THREE.TorusGeometry(0.315, 0.035, 5, seg).rotateX(Math.PI / 2), { p: [PX, PB - 0.55, z] });
    bk.add(mats.beam, lathe([[0.32, 0], [0.4, 0.2], [0.5, 0.42], [0.5, 0.55]], seg), { p: [PX, PB - 0.55, z] });
    for (const sd of [-1, 1]) {
      if (Math.abs(z + sd * 1.1) > 7.2) continue;
      bk.add(mats.beam, beam([PX, PB - 1.3, z], [PX, PB, z + sd * 1.1], 0.18, 0.22), { uv: 0.5 });
    }
    bk.add(mats.beam, beam([PX, PB - 1.3, z], [PX - 1.1, PB, z], 0.18, 0.22), { uv: 0.5 });
  }
  // its roof, running back into the great gable, its own gable and horses
  const pEZ = 8.0;
  const pR = 5.8;
  const pyE = 32.0;
  const pEnd = PX + 0.9;
  const pRoof = thatchRoof({ len: pEnd - WX1, span: 2 * pEZ, rise: pR, t: 0.6, over: 0, seed: 9, lump: 0.08, step: 0.7 * Q.step, weather: 0.1 });
  bk.add(mats.goldThatch, pRoof, { p: [(pEnd + WX1) / 2, pyE, 0] });
  bk.add(mats.gold, box(pEnd - WX1, 0.26, 0.2), { p: [(pEnd + WX1) / 2, pyE + pR + 0.24, 0] });
  bk.add(mats.timber, gableTri(6.55, pyE + pR - 0.4 - (PB + 0.62), 0.2), { p: [PX + 0.42, PB + 0.62, 0], uv: 1 / 2.4, color: tw });
  sunDisc(PX + 0.46, PB + 2.25, 0.8, 1);
  crossBoards(bk, K, { x: pEnd + 0.12, y0: pyE + 0.12, half: pEZ + 0.1, rise: pR, ext: 2.0, w: 0.56, d: 0.22, mat: mats.beam, headMat: mats.gold, size: 1.5, strip: mats.gold, out: 1 });
  // the doors, in their carved frame under a golden lintel, and the step
  const DW = 2.2;
  const DH = 4.3;
  for (const s of [-1, 1]) {
    const leaf = box(0.22, DH, DW - 0.04);
    bk.add(mats.door, leaf, { p: [WX1 + 0.12, F + DH / 2, s * (DW / 2)] });
    bk.add(mats.gold, new THREE.TorusGeometry(0.2, 0.04, 6, 14).rotateY(Math.PI / 2), { p: [WX1 + 0.26, F + 2.0, s * 0.35] });
    bk.add(mats.carve, box(0.45, DH + 0.5, 0.5), { p: [WX1 + 0.22, F + (DH + 0.5) / 2, s * (DW + 0.25)], uv: 0.0 });
  }
  bk.add(mats.beam, box(0.55, 0.62, 2 * DW + 1.4), { p: [WX1 + 0.25, F + DH + 0.62, 0], uv: 0.5 });
  bk.add(mats.gold, box(0.05, 0.18, 2 * DW + 1.4), { p: [WX1 + 0.54, F + DH + 0.62, 0] });
  for (const s of [-1, 1]) {
    const hg = K.head.clone().scale(0.75, 0.75, 1.1);
    hg.rotateY((s * Math.PI) / 2);
    hg.translate(WX1 + 0.3, F + DH + 0.92, s * 1.2);
    bk.add(mats.gold, hg);
  }
  bk.add(mats.stone, box(1.4, 0.5, 2 * DW + 1.6), { p: [WX1 + 0.6, F - 0.25 + 0.01, 0], uv: 0.5 });
  // torches either side of the doors, and the banner on the roof
  for (const s of [-1, 1]) lamps.push(bracketTorch(bk, mats, WX1 + 0.05, F + 2.9, s * 3.6, 0));
  bannerPole(bk, mats, banners, WX1 - 0.6, RIDGE + 0.3, 0, 6.2, { len: 5.2, tall: 1.9, amp: 0.65 });
}

// ── the town's houses ──

const THATCH_TINTS = [0xfff4dc, 0xf6e4c2, 0xe4d2b0, 0xfff0c4, 0xd2c4a8, 0xecdab6, 0xfae6b0];
const WALL_TINTS = [0xe8dccf, 0xcfc2b4, 0xf0dcc2, 0xc0b8b0, 0xdccab4];

// A hall of the Rohirrim: walls of dark weathered boards in a frame of
// posts on a footing of stone, a steep thatched roof, gables crossed with
// boards ending in horses' heads, a door in one gable, small shuttered
// windows. Built in its own frame (its long side along x) and set down
// turned to its `face`.
function house(bk, K, h, i) {
  const { mats, Q } = K;
  const r = rng(1000 + i);
  const D = h.d;
  const W = h.w;
  const H = h.h;
  const c = Math.cos(h.face);
  const s = -Math.sin(h.face);
  const zx = Math.sin(h.face);
  const zz = Math.cos(h.face);
  let gMin = Infinity;
  for (const [lx, lz] of [
    [-D / 2, -W / 2],
    [D / 2, -W / 2],
    [D / 2, W / 2],
    [-D / 2, W / 2],
  ]) {
    const g = groundAt(h.x + c * lx + zx * lz, h.z + s * lx + zz * lz);
    gMin = Math.min(gMin, g);
  }
  const F = h.y + 0.3;
  const e = 0.75;
  const S = W + 2 * e;
  const R = 0.8 * W;
  const yE = F + H - ((e - 0.26) * R) / (S / 2) + 0.08;
  const over = 0.5;
  const tint = WALL_TINTS[Math.floor(r() * WALL_TINTS.length)];
  const thatch = THATCH_TINTS[Math.floor(r() * THATCH_TINTS.length)];
  const door = r() < 0.5 ? 1 : -1;
  bk.at([h.x, 0, h.z], h.face, () => {
    // a course of stone just out of the ground; where the slope falls away
    // the boards come down to it
    const fb = gMin - 0.5;
    const ft = F - gMin > 0.7 ? gMin + 0.45 : F + 0.2;
    bk.add(mats.stone, box(D + 0.4, ft - fb, W + 0.4), { p: [0, (ft + fb) / 2, 0], uv: 0.45, color: 0x958d80 });
    if (F - gMin > 0.7) bk.add(mats.timber, box(D - 0.06, F - gMin - 0.3, W - 0.06), { p: [0, (F + gMin + 0.4) / 2, 0], uv: 1 / 2.4, color: 0x8a8076 });
    // the walls and their frame
    bk.add(mats.timber, box(D, H, W), { p: [0, F + H / 2, 0], uv: 1 / 2.4, color: tint });
    for (const [x, z] of [
      [D / 2, W / 2],
      [-D / 2, W / 2],
      [D / 2, -W / 2],
      [-D / 2, -W / 2],
    ])
      bk.add(mats.beam, box(0.34, H + 0.1, 0.34), { p: [x, F + H / 2, z], uv: 0.5 });
    const nb = Math.max(2, Math.round(D / 2.8));
    for (let k = 1; k < nb; k++) {
      for (const sd of [-1, 1]) bk.add(mats.beam, box(0.24, H, 0.14), { p: [-D / 2 + (D * k) / nb, F + H / 2, sd * (W / 2 + 0.06)], uv: 0.5 });
    }
    for (const sd of [-1, 1]) {
      bk.add(mats.beam, box(D + 0.3, 0.26, 0.3), { p: [0, F + 0.13, sd * (W / 2 + 0.05)], uv: 0.5 });
      bk.add(mats.beam, box(D + 0.4, 0.28, 0.32), { p: [0, F + H - 0.12, sd * (W / 2 + 0.05)], uv: 0.5 });
      bk.add(mats.beam, box(0.3, 0.26, W + 0.3), { p: [sd * (D / 2 + 0.05), F + 0.13, 0], uv: 0.5 });
      bk.add(mats.beam, box(0.32, 0.28, W + 0.4), { p: [sd * (D / 2 + 0.05), F + H - 0.12, 0], uv: 0.5 });
      // a shuttered window or two along each side
      const nw = D > 12 ? 2 : 1;
      for (let k = 0; k < nw; k++) {
        const x = nw === 1 ? (r() - 0.5) * D * 0.3 : (k ? 1 : -1) * D * 0.24;
        const z = sd * (W / 2 + 0.04);
        bk.add(mats.glass, box(0.75, 0.62, 0.06), { p: [x, F + 2.0, z] });
        bk.add(mats.beam, box(1.0, 0.12, 0.12), { p: [x, F + 2.36, z + sd * 0.03], uv: 0.5 });
        bk.add(mats.beam, box(1.0, 0.12, 0.12), { p: [x, F + 1.64, z + sd * 0.03], uv: 0.5 });
        if (r() < 0.7) for (const q of [-1, 1]) bk.add(mats.timber, box(0.4, 0.66, 0.05), { p: [x + q * 0.6, F + 2.0, z + sd * 0.06], uv: 0.4, color: 0x7a6a5a });
      }
    }
    // the gables
    const apex = yE + R - 0.55;
    for (const sd of [-1, 1]) {
      bk.add(mats.timber, gableTri(W / 2, apex - (F + H), 0.16), { p: [sd * (D / 2) + (sd > 0 ? 0.16 : 0), F + H, 0], uv: 1 / 2.4, color: tint });
      bk.add(mats.beam, box(0.2, apex - (F + H) - 0.3, 0.2), { p: [sd * (D / 2 + 0.1), (F + H + apex - 0.3) / 2, 0], uv: 0.5 });
      bk.add(mats.glass, gableTri(0.38, 0.55, 0.05), { p: [sd * (D / 2 + 0.17) + (sd > 0 ? 0.05 : 0), apex - 1.6, 0] });
    }
    // the roof, and the boards and horses at its ends
    const roof = thatchRoof({ len: D, span: S, rise: R, t: 0.45, over, seed: 50 + i, lump: 0.07, step: 0.85 * Q.step, weather: 0.35 });
    bk.add(mats.thatch, roof, { p: [0, yE, 0], tint: thatch });
    for (const sd of [-1, 1]) crossBoards(bk, K, { x: sd * (D / 2 + over + 0.07), y0: yE + 0.1, half: S / 2 + 0.05, rise: R, ext: 1.0, w: 0.32, d: 0.11, mat: mats.beam, headMat: mats.beam, size: 0.85 });
    // the door, in the gable end
    const dx = door * (D / 2 + 0.06);
    bk.add(mats.beam, box(0.1, 2.2, 1.3), { p: [dx, F + 1.1, 0], uv: 0.0 });
    bk.add(mats.timber, box(0.06, 2.1, 1.2), { p: [dx + door * 0.05, F + 1.05, 0], uv: 0.4, color: 0x6a5a4a });
    bk.add(mats.beam, box(0.24, 0.28, 1.9), { p: [dx + door * 0.05, F + 2.36, 0], uv: 0.5 });
    for (const q of [-1, 1]) bk.add(mats.beam, box(0.2, 2.3, 0.2), { p: [dx + door * 0.05, F + 1.15, q * 0.78], uv: 0.5 });
    bk.add(mats.stone, box(0.8, 0.5, 1.6), { p: [dx + door * 0.4, F - 0.15, 0], uv: 0.5 });
    // a canopy over the door on posts, on some
    if (r() < 0.55) {
      const cx = door * (D / 2 + 0.85);
      for (const q of [-1, 1]) bk.add(mats.beam, box(0.16, 2.5, 0.16), { p: [door * (D / 2 + 1.55), F + 1.25 - 0.3, q * 1.05], uv: 0.5 });
      bk.add(mats.beam, box(1.7, 0.16, 0.16), { p: [cx, F + 2.45, -1.05], uv: 0.5 });
      bk.add(mats.beam, box(1.7, 0.16, 0.16), { p: [cx, F + 2.45, 1.05], uv: 0.5 });
      bk.add(mats.timber, beam([door * (D / 2 + 0.05), F + 3.0, 0], [door * (D / 2 + 1.75), F + 2.55, 0], 2.6, 0.1), { uv: 0.4, color: 0x9a8a7a });
    }
    // a louvre on the ridge for the smoke, on some
    if (r() < 0.6) {
      const lx = (r() - 0.5) * D * 0.4;
      const ly = yE + R - 0.1;
      bk.add(mats.beam, box(1.0, 0.7, 0.7), { p: [lx, ly + 0.3, 0], uv: 0.5 });
      bk.add(mats.glass, box(0.8, 0.36, 0.74), { p: [lx, ly + 0.36, 0] });
      for (const q of [-1, 1]) bk.add(mats.timber, box(1.5, 0.08, 0.72).rotateX(-q * 0.62), { p: [lx, ly + 0.78, q * 0.3], uv: 0.4, color: 0x7a6a5a });
    }
  });
  // a lean-to shed along one side, on some, where there's room
  if (r() < 0.35) {
    const side = r() < 0.5 ? -1 : 1;
    const sl = D * (0.35 + r() * 0.25);
    const sx = (r() - 0.5) * (D - sl) * 0.8;
    const sd = 2.2;
    const lz = side * (W / 2 + sd / 2 + 0.05);
    const corners = [
      [sx - sl / 2, side * (W / 2 + sd + 0.3)],
      [sx + sl / 2, side * (W / 2 + sd + 0.3)],
    ].map(([a, b]) => [h.x + c * a + zx * b, h.z + s * a + zz * b]);
    const roomy = corners.every(([x, z]) => clear(x, z, 0.4, h));
    if (roomy) {
      const g0 = Math.min(...corners.map(([x, z]) => groundAt(x, z)), F) - 0.3;
      bk.at([h.x, 0, h.z], h.face, () => {
        bk.add(mats.timber, box(sl, F + 2.2 - g0, sd), { p: [sx, (F + 2.2 + g0) / 2, lz], uv: 1 / 2.4, color: tint });
        bk.add(mats.timber, beam([sx, F + 2.95, side * (W / 2 - 0.05)], [sx, F + 2.1, side * (W / 2 + sd + 0.35)], sl + 0.4, 0.1), { uv: 0.4, color: 0x8a7a6a });
        for (const q of [-1, 1]) bk.add(mats.beam, box(0.2, F + 2.2 - g0, 0.2), { p: [sx + q * (sl / 2), (F + 2.2 + g0) / 2, side * (W / 2 + sd + 0.05)], uv: 0.5 });
        bk.add(mats.beam, box(0.1, 1.8, 1.0), { p: [sx + sl / 2 + 0.03, F + 0.9, lz], uv: 0.0 });
      });
    }
  }
  return { door: [h.x + c * door * (D / 2 + 1.2), h.z + s * door * (D / 2 + 1.2)] };
}

// ── the town's small things ──

// Whether a spot is clear for something small: inside the stockade, off the
// road, the stair, the terrace and the hall, and not in a house.
const hillR = (x, z) => Math.hypot(x / stretchOf(x), z);
function clear(x, z, m = 0.8, self = null) {
  if (hillR(x, z) > STOCKADE.r - 3) return false;
  if (x > ROAD.x1 - 4 && Math.abs(z) < ROAD.w / 2 + 2 + m) return false;
  if (x > MEDUSELD.x0 - 4 && x < TERRACE.x1 + 6 && Math.abs(z) < 13) return false;
  for (const h of HOUSES) {
    if (h === self) continue;
    const dx = x - h.x;
    const dz = z - h.z;
    const lx = dx * Math.cos(h.face) - dz * Math.sin(h.face);
    const lz = dx * Math.sin(h.face) + dz * Math.cos(h.face);
    if (Math.abs(lx) < h.d / 2 + m + 0.6 && Math.abs(lz) < h.w / 2 + m + 0.6) return false;
  }
  return true;
}
function haystack(bk, mats, x, z, s) {
  const g = groundAt(x, z);
  bk.add(mats.hay, lathe([[0.01, 0], [1.5, 0], [1.6, 0.5], [1.5, 1.3], [1.1, 2.0], [0.55, 2.45], [0.1, 2.6]], 10), { p: [x, g - 0.1, z], s: [s, s, s] });
  bk.add(mats.beam, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), { p: [x, g + 2.6 * s, z] });
}
function barrel(bk, mats, x, z, ry = 0) {
  const g = groundAt(x, z);
  bk.add(mats.beam, lathe([[0.01, 0], [0.27, 0], [0.33, 0.25], [0.34, 0.45], [0.33, 0.65], [0.27, 0.88], [0.01, 0.88]], 10), { p: [x, g - 0.02, z], r: [0, ry, 0] });
  for (const y of [0.16, 0.72]) bk.add(mats.iron, new THREE.TorusGeometry(0.31, 0.018, 4, 12).rotateX(Math.PI / 2), { p: [x, g + y, z] });
}
function cart(bk, mats, x, z, ry) {
  const g = groundAt(x, z);
  bk.at([x, g, z], ry, () => {
    bk.add(mats.timber, box(2.4, 0.12, 1.3), { p: [0, 0.82, 0], uv: 0.4, color: 0x9a8a78 });
    for (const sd of [-1, 1]) {
      bk.add(mats.timber, box(2.4, 0.42, 0.07), { p: [0, 1.06, sd * 0.62], uv: 0.4, color: 0x9a8a78 });
      bk.add(mats.beam, new THREE.TorusGeometry(0.55, 0.06, 4, 14), { p: [0.1, 0.56, sd * 0.78] });
      for (let k = 0; k < 4; k++) bk.add(mats.beam, box(1.04, 0.05, 0.05), { p: [0.1, 0.56, sd * 0.78], r: [0, 0, (k / 4) * Math.PI] });
    }
    bk.add(mats.beam, new THREE.CylinderGeometry(0.05, 0.05, 1.7, 5).rotateX(Math.PI / 2), { p: [0.1, 0.56, 0] });
    for (const sd of [-1, 1]) bk.add(mats.beam, beam([1.1, 0.8, sd * 0.45], [3.2, 0.12, sd * 0.35], 0.08, 0.08), { uv: 0.5 });
    bk.add(mats.hay, new THREE.SphereGeometry(0.62, 8, 5).scale(1.6, 0.5, 0.85), { p: [0, 1.05, 0] });
  });
}
function fence(bk, mats, x0, z0, x1, z1) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2.4));
  for (let i = 0; i <= n; i++) {
    const x = mix(x0, x1, i / n);
    const z = mix(z0, z1, i / n);
    bk.add(mats.beam, new THREE.CylinderGeometry(0.07, 0.08, 1.5, 5), { p: [x, groundAt(x, z) + 0.55, z] });
  }
  for (let i = 0; i < n; i++) {
    const ax = mix(x0, x1, i / n);
    const az = mix(z0, z1, i / n);
    const bx = mix(x0, x1, (i + 1) / n);
    const bz = mix(z0, z1, (i + 1) / n);
    for (const hh of [0.55, 1.05]) bk.add(mats.beam, beam([ax, groundAt(ax, az) + hh, az], [bx, groundAt(bx, bz) + hh, bz], 0.07, 0.09), { uv: 0.5 });
  }
}
function woodpile(bk, mats, x, z, ry) {
  const g = groundAt(x, z);
  bk.at([x, g, z], ry, () => {
    for (let l = 0; l < 4; l++) {
      for (let k = 0; k < 6 - l; k++) bk.add(mats.logs, new THREE.CylinderGeometry(0.13, 0.13, 1.1, 6).rotateX(Math.PI / 2), { p: [-0.75 + l * 0.14 + k * 0.28, 0.13 + l * 0.24, 0] });
    }
  });
}
function trough(bk, mats, x, z, ry) {
  const g = groundAt(x, z);
  bk.at([x, g, z], ry, () => {
    for (const [w, h, d, px, pz] of [
      [2.0, 0.55, 0.08, 0, 0.32],
      [2.0, 0.55, 0.08, 0, -0.32],
      [0.08, 0.55, 0.72, 0.96, 0],
      [0.08, 0.55, 0.72, -0.96, 0],
      [2.0, 0.08, 0.72, 0, 0],
    ])
      bk.add(mats.beam, box(w, h, d), { p: [px, h === 0.08 ? 0.12 : 0.3, pz], uv: 0.5 });
    bk.add(mats.water, new THREE.PlaneGeometry(1.84, 0.56).rotateX(-Math.PI / 2), { p: [0, 0.45, 0] });
  });
}

function clutter(bk, K, doors) {
  const { mats } = K;
  const r = rng(505);
  const taken = [];
  const free = (x, z, rad) => clear(x, z, rad) && !taken.some(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) < tr + rad);
  const tryPlace = (rad, near, fn) => {
    for (let k = 0; k < 30; k++) {
      let x;
      let z;
      if (near) {
        const a = r() * TAU;
        const d = 1.5 + r() * 4;
        x = near[0] + Math.cos(a) * d;
        z = near[1] + Math.sin(a) * d;
      } else {
        const a = r() * TAU;
        const rr = 30 + r() * 42;
        x = Math.cos(a) * rr * stretchOf(Math.cos(a));
        z = Math.sin(a) * rr;
      }
      if (!free(x, z, rad)) continue;
      taken.push([x, z, rad]);
      fn(x, z);
      return true;
    }
    return false;
  };
  // by the doors: barrels, woodpiles, a trough now and then
  doors.forEach((d, i) => {
    if (i % 2 === 0) tryPlace(0.5, d, (x, z) => barrel(bk, mats, x, z, r() * TAU));
    if (i % 3 === 0) tryPlace(0.5, d, (x, z) => barrel(bk, mats, x, z, r() * TAU));
    if (i % 4 === 1) tryPlace(1.0, d, (x, z) => woodpile(bk, mats, x, z, r() * TAU));
    if (i % 7 === 3) tryPlace(1.2, d, (x, z) => trough(bk, mats, x, z, r() * TAU));
  });
  // about the slopes: haystacks, carts, fenced paddocks
  for (let i = 0; i < 14; i++) tryPlace(1.8, null, (x, z) => haystack(bk, mats, x, z, 0.8 + r() * 0.4));
  for (let i = 0; i < 7; i++) tryPlace(2.0, null, (x, z) => cart(bk, mats, x, z, r() * TAU));
  for (let i = 0; i < 10; i++) {
    tryPlace(3.0, null, (x, z) => {
      const a = r() * TAU;
      const l = 5 + r() * 5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const pts = [
        [x - ca * l * 0.5, z - sa * l * 0.5],
        [x + ca * l * 0.5, z + sa * l * 0.5],
      ];
      if (!clear(pts[0][0], pts[0][1], 0.3) || !clear(pts[1][0], pts[1][1], 0.3)) return;
      fence(bk, mats, pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
      const ex = pts[1][0] - sa * 3.5;
      const ez = pts[1][1] + ca * 3.5;
      if (clear(ex, ez, 0.3)) fence(bk, mats, pts[1][0], pts[1][1], ex, ez);
    });
  }
}

// ── the hill ──

function townOf(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'edoras';
  const lamps = [];
  const banners = [];
  const logs = [];
  const bk = bucket();
  stockade(bk, K, logs, lamps, banners);
  road(bk, K);
  stair(bk, K, lamps);
  terrace(bk, K, lamps, banners);
  meduseld(bk, K, lamps, banners);
  const doors = HOUSES.map((h, i) => house(bk, K, h, i).door);
  clutter(bk, K, doors);
  // banners along the road inside the gate, a torch on every other pole
  [44, 58, 72].forEach((x, i) => {
    for (const s of [-1, 1]) {
      const z = s * (ROAD.w / 2 + 1.3);
      const y = groundAt(x, z);
      bannerPole(bk, mats, banners, x, y, z, 7.5, { len: 3.8, tall: 1.4 });
      if ((i + (s > 0 ? 1 : 0)) % 2 === 0) lamps.push(bracketTorch(bk, mats, x - s * 0.0, y + 2.9, z, s > 0 ? Math.PI / 2 : -Math.PI / 2));
    }
  });
  bk.build(g, 'edoras');
  // the logs, instanced
  const lg = new THREE.InstancedMesh(logGeometry(Math.max(5, Math.round(7 * Q.around))), mats.logs, logs.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const col = new THREE.Color();
  logs.forEach((l, i) => {
    q.setFromEuler(e.set(l.rx, l.ry, l.rz));
    m.compose(V3(l.x, l.y, l.z), q, V3(l.s, l.sy, l.s));
    lg.setMatrixAt(i, m);
    const k = 0.78 + l.k * 0.32;
    lg.setColorAt(i, col.setRGB(k, k * (0.96 + l.k * 0.04), k * (0.9 + l.k * 0.08)));
  });
  lg.instanceMatrix.needsUpdate = true;
  lg.instanceColor.needsUpdate = true;
  lg.computeBoundingSphere();
  lg.name = 'edoras-stockade';
  g.add(lg);
  const flag = bannerMesh(mats, banners);
  g.add(flag);
  return { group: g, lamps, flags: [flag] };
}

// ── Meduseld, inside ──

// Dim and warm: the long hall of dark carved timber, the painted pillars
// down both sides holding up the beams of the roof, the long hearth glowing
// in the middle, the dais at the far end with the throne on it, the tables
// along the walls laid for the feast, the shields and the hangings of the
// kings, the doors shut at the south end, light falling in shafts from the
// high windows on the east and down through the smoke hole.
function hallInside(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'meduseld-hall';
  const bk = bucket();
  const lamps = [];
  const X = HALL.w / 2;
  const Z0 = HALL.z0;
  const Z1 = HALL.z1;
  const L = Z1 - Z0;
  const ZC = (Z0 + Z1) / 2;
  const H = HALL.h;
  const WH = 5.6;
  const T = 0.4;
  const roofY = (x) => WH + (H - WH) * (1 - Math.abs(x) / X);
  const seg = Math.round(16 * Q.around);
  const wood = 0x9a8a7a;
  // the floor
  {
    const fg = new THREE.PlaneGeometry(HALL.w, L, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, ZC);
    const uv = fg.attributes.uv;
    const p = fg.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3, p.getZ(i) / 3);
    bk.add(mats.hallFloor, fg);
  }
  // the long walls, broken by the high windows; posts, rails, the wall plate
  const WIN = [-12.5, -7.5, -2.5, 7.5, 12.5];
  const wy0 = 4.0;
  const wy1 = 5.1;
  const ww = 1.3;
  const shafts = [];
  for (const s of [-1, 1]) {
    const xw = s * (X + T / 2);
    bk.add(mats.hallWood, box(T, wy0, L + 2 * T), { p: [xw, wy0 / 2, ZC], uv: 1 / 2.4, color: wood });
    bk.add(mats.hallWood, box(T, WH - wy1, L + 2 * T), { p: [xw, (wy1 + WH) / 2, ZC], uv: 1 / 2.4, color: wood });
    const wins = WIN.filter((z) => !(s < 0 && z === -12.5));
    const cuts = [Z0 - T, ...wins.flatMap((z) => [z - ww / 2, z + ww / 2]), Z1 + T];
    for (let i = 0; i < cuts.length; i += 2) bk.add(mats.hallWood, box(T, wy1 - wy0, cuts[i + 1] - cuts[i]), { p: [xw, (wy0 + wy1) / 2, (cuts[i] + cuts[i + 1]) / 2], uv: 1 / 2.4, color: wood });
    for (const z of wins) {
      bk.add(mats.pane, new THREE.PlaneGeometry(ww, wy1 - wy0).rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2), { p: [s * (X + T * 0.8), (wy0 + wy1) / 2, z] });
      bk.add(mats.hallBeam, box(0.12, wy1 - wy0, 0.1), { p: [s * (X + T * 0.6), (wy0 + wy1) / 2, z], uv: 0.5 });
      bk.add(mats.hallBeam, box(0.5, 0.16, ww + 0.4), { p: [s * (X - 0.05), wy0 - 0.08, z], uv: 0.5 });
      if (s > 0) shafts.push([s * X, (wy0 + wy1) / 2, z]);
    }
    for (const z of [-20, -15, -10, -5, 0, 5, 10, 15, 20]) bk.add(mats.hallBeam, box(0.5, WH, 0.5), { p: [s * (X - 0.2), WH / 2, z], uv: 0.5 });
    bk.add(mats.hallBeam, box(0.5, 0.5, L), { p: [s * (X - 0.22), WH - 0.25, ZC], uv: 0.5 });
    bk.add(mats.hallBeam, box(0.14, 0.24, L), { p: [s * (X - 0.06), 1.2, ZC], uv: 0.5 });
    bk.add(mats.goldIn, box(0.04, 0.06, L), { p: [s * (X - 0.14), 1.2, ZC] });
    bk.add(mats.hallBeam, box(0.12, 0.3, L), { p: [s * (X - 0.06), 0.15, ZC], uv: 0.5 });
  }
  // the end walls and their gables: the north behind the throne, the south
  // with the doors
  bk.add(mats.hallWood, box(HALL.w + 2 * T, WH, T), { p: [0, WH / 2, Z0 - T / 2], uv: 1 / 2.4, color: wood });
  const dw = 3.6;
  const dh = 4.4;
  for (const s of [-1, 1]) bk.add(mats.hallWood, box(X + T - dw / 2, WH, T), { p: [s * ((X + T + dw / 2) / 2), WH / 2, Z1 + T / 2], uv: 1 / 2.4, color: wood });
  bk.add(mats.hallWood, box(dw, WH - dh, T), { p: [0, (WH + dh) / 2, Z1 + T / 2], uv: 1 / 2.4, color: wood });
  for (const z of [Z0 - T, Z1]) bk.add(mats.hallWood, slabOf([[-X - T, 0], [X + T, 0], [0, H - WH + 0.3]], T), { p: [0, WH, z], uv: 1 / 2.4, color: 0x7a6a5a });
  for (const s of [-1, 1]) {
    const leaf = box(dw / 2 - 0.03, dh, 0.2);
    bk.add(mats.doorIn, leaf, { p: [s * (dw / 4), dh / 2, Z1 - 0.05] });
    bk.add(mats.carveIn, box(0.4, dh + 0.4, 0.4), { p: [s * (dw / 2 + 0.2), (dh + 0.4) / 2, Z1 - 0.1] });
  }
  bk.add(mats.hallBeam, box(dw + 1.4, 0.5, 0.45), { p: [0, dh + 0.25, Z1 - 0.1], uv: 0.5 });
  bk.add(mats.goldIn, box(dw + 1.4, 0.08, 0.05), { p: [0, dh + 0.25, Z1 - 0.34] });
  // daylight at the doors' foot and between them
  bk.add(mats.pane, box(dw - 0.1, 0.035, 0.05), { p: [0, 0.02, Z1 - 0.17] });
  bk.add(mats.pane, box(0.03, dh - 0.1, 0.05), { p: [0, dh / 2, Z1 - 0.17] });
  // the roof: boards on the rafters, the purlins on the pillars, the tie
  // beams across, the ridge, the smoke hole over the hearth
  for (const s of [-1, 1]) {
    bk.add(mats.hallWood, beam([s * (X + T), WH - 0.1, ZC], [0, H + 0.2, ZC], L + 2 * T, 0.2), { uv: 1 / 2.4, color: 0x6a5c50 });
    bk.add(mats.hallBeam, box(0.45, 0.45, L), { p: [s * 4.8, roofY(4.8) - 0.4, ZC], uv: 0.5 });
  }
  bk.add(mats.hallBeam, box(0.4, 0.5, L), { p: [0, H - 0.3, ZC], uv: 0.5 });
  for (let z = Z0 + 1; z <= Z1 - 1; z += 2.5) {
    for (const s of [-1, 1]) bk.add(mats.hallBeam, beam([s * X, WH - 0.1, z], [0, H - 0.25, z], 0.24, 0.3), { uv: 0.5 });
  }
  const tieY = roofY(4.8) - 0.85;
  for (const z of [...new Set(PILLARS.map(([, pz]) => pz))]) {
    bk.add(mats.hallBeam, box(9.6, 0.45, 0.42), { p: [0, tieY, z], uv: 0.5 });
    bk.add(mats.goldIn, box(9.2, 0.06, 0.44), { p: [0, tieY - 0.12, z] });
    bk.add(mats.hallBeam, box(0.3, H - 0.3 - tieY, 0.3), { p: [0, (H - 0.3 + tieY) / 2, z], uv: 0.5 });
    for (const s of [-1, 1]) {
      bk.add(mats.hallBeam, box(X - 4.8, 0.36, 0.34), { p: [s * (4.8 + (X - 4.8) / 2), WH - 0.4, z], uv: 0.5 });
      bk.add(mats.hallBeam, beam([s * 4.8, tieY, z], [s * 2.2, roofY(2.2) - 0.25, z], 0.22, 0.26), { uv: 0.5 });
    }
  }
  bk.add(mats.hallBeam, box(1.8, 0.8, 4.4), { p: [0, H - 0.1, HEARTH.z], uv: 0.5 });
  bk.add(mats.pane, new THREE.PlaneGeometry(1.2, 3.6).rotateX(Math.PI / 2), { p: [0, H - 0.52, HEARTH.z] });
  // the pillars: a stone foot, a turned base, the carved and painted shaft,
  // gold rings, the capital and knee braces up to the beams; a torch on the
  // nave side of eight of them
  for (const [x, z] of PILLARS) {
    const s = Math.sign(x);
    const top = tieY - 0.225;
    bk.add(mats.hearthStone, box(1.3, 0.25, 1.3), { p: [x, 0.125, z], uv: 0.5 });
    bk.add(mats.hallBeam, lathe([[0.62, 0], [0.62, 0.1], [0.56, 0.2], [0.52, 0.34]], seg), { p: [x, 0.25, z] });
    bk.add(mats.goldIn, new THREE.TorusGeometry(0.52, 0.04, 5, seg).rotateX(Math.PI / 2), { p: [x, 0.6, z] });
    const h = top - 0.75 - 0.6;
    bk.add(mats.carveIn, new THREE.CylinderGeometry(0.46, 0.5, h, seg, 1, true), { p: [x, 0.6 + h / 2, z] });
    bk.add(mats.goldIn, new THREE.TorusGeometry(0.47, 0.04, 5, seg).rotateX(Math.PI / 2), { p: [x, 0.6 + h, z] });
    bk.add(mats.hallBeam, lathe([[0.47, 0], [0.56, 0.2], [0.66, 0.5], [0.66, 0.75]], seg), { p: [x, 0.6 + h, z] });
    bk.add(mats.goldIn, box(1.36, 0.08, 1.36), { p: [x, top - 0.04, z] });
    for (const sd of [-1, 1]) bk.add(mats.hallBeam, beam([x, top - 1.6, z], [x, top + 0.3, z + sd * 1.4], 0.22, 0.26), { uv: 0.5 });
    bk.add(mats.hallBeam, beam([x, top - 1.6, z], [x - s * 1.5, top + 0.1, z], 0.22, 0.26), { uv: 0.5 });
    // a little gold horse on the capital, looking into the nave
    const hg = K.head.clone().scale(0.6, 0.6, 1.2);
    hg.rotateY(s > 0 ? Math.PI : 0);
    hg.translate(x - s * 0.62, top - 1.05, z);
    bk.add(mats.goldIn, hg);
    if (Math.abs(z) > 2 && Math.abs(z) < 12) lamps.push(bracketTorch(bk, mats, x - s * 0.5, 2.9, z, s > 0 ? Math.PI : 0));
  }
  // the long hearth: a kerb of stone, a bed of embers, logs burning on it
  {
    const { x, z, w, d } = HEARTH;
    for (const s of [-1, 1]) {
      bk.add(mats.hearthStone, box(0.32, 0.42, d), { p: [x + s * (w / 2 - 0.16), 0.21, z], uv: 0.5 });
      bk.add(mats.hearthStone, box(w, 0.42, 0.32), { p: [x, 0.21, z + s * (d / 2 - 0.16)], uv: 0.5 });
    }
    bk.add(mats.hearthStone, box(w + 0.8, 0.05, d + 0.8), { p: [x, 0.025, z], uv: 0.5 });
    const bed = new THREE.PlaneGeometry(w - 0.6, d - 0.6).rotateX(-Math.PI / 2);
    const uv = bed.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 2.2);
    bk.add(mats.embers, bed, { p: [x, 0.22, z] });
    const r = rng(19);
    for (let i = 0; i < 9; i++) {
      const lz = z - d / 2 + 0.6 + ((d - 1.2) * (i + 0.5)) / 9;
      const lg = new THREE.CylinderGeometry(0.08 + r() * 0.04, 0.09 + r() * 0.04, 0.8 + r() * 0.35, 7).rotateZ(Math.PI / 2).rotateY((r() - 0.5) * 1.6);
      bk.add(mats.embers, lg, { p: [x + (r() - 0.5) * 0.3, 0.3 + (i % 2) * 0.08, lz] });
    }
    for (const s of [-1, 1]) bk.add(mats.iron, box(0.7, 0.36, 0.06), { p: [x, 0.42, z + s * (d / 2 - 0.45)] });
  }
  // the dais, its steps, its carved front; the throne on it
  {
    const { x, z, w, d, h } = DAIS;
    bk.add(mats.hallWood, box(w, h, d), { p: [x, h / 2, z], uv: 1 / 2.4, color: 0x8a7a6a });
    const front = new THREE.PlaneGeometry(w, h - 0.2);
    const uv = front.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, 0.835 + uv.getY(i) * 0.115);
    bk.add(mats.carveIn, front, { p: [x, h / 2, z + d / 2 + 0.01] });
    bk.add(mats.goldIn, box(w + 0.1, 0.08, 0.08), { p: [x, h - 0.04, z + d / 2 + 0.02] });
    for (const [sh, sd] of [
      [h * 0.66, 0.42],
      [h * 0.33, 0.84],
    ]) {
      bk.add(mats.hallWood, box(w * 0.7, sh, sd), { p: [x, sh / 2, z + d / 2 + sd / 2], uv: 1 / 1.6, color: 0x9a8a7a });
      bk.add(mats.goldIn, box(w * 0.7 + 0.02, 0.05, 0.05), { p: [x, sh - 0.025, z + d / 2 + sd + 0.005] });
    }
    bk.add(mats.fur, new THREE.BoxGeometry(2.6, 0.05, 1.8), { p: [x, h + 0.025, z + 0.5] });
  }
  {
    const { x, z } = THRONE;
    const y = DAIS.h;
    bk.add(mats.hallBeam, box(1.5, 0.14, 1.15), { p: [x, y + 0.07, z], uv: 0.5 });
    bk.add(mats.hallBeam, box(1.1, 0.4, 0.9), { p: [x, y + 0.34, z + 0.05], uv: 0.5 });
    bk.add(mats.fur, box(1.0, 0.1, 0.84), { p: [x, y + 0.59, z + 0.05] });
    // the high back, carved, the sun on it, two gold horses crowning it
    const back = new THREE.BoxGeometry(1.3, 3.0, 0.2);
    const uv = back.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.42, 0.17 + uv.getY(i) * 0.64);
    bk.add(mats.carveIn, back, { p: [x, y + 1.85, z - 0.42] });
    bk.add(mats.goldIn, new THREE.RingGeometry(0.3, 0.42, 24), { p: [x, y + 2.7, z - 0.31] });
    bk.add(mats.goldIn, new THREE.CircleGeometry(0.14, 16), { p: [x, y + 2.7, z - 0.31] });
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * TAU;
      bk.add(mats.goldIn, box(0.04, 0.16, 0.03), { p: [x + Math.sin(an) * 0.22, y + 2.7 + Math.cos(an) * 0.22, z - 0.31], r: [0, 0, -an] });
    }
    bk.add(mats.goldIn, box(1.42, 0.1, 0.26), { p: [x, y + 3.38, z - 0.42] });
    bk.add(mats.hallBeam, slabOf([[-0.72, 0], [0.72, 0], [0, 0.62]], 0.2), { p: [x, y + 3.43, z - 0.52], uv: 0.5 });
    bk.add(mats.goldIn, new THREE.SphereGeometry(0.09, 8, 6), { p: [x, y + 4.1, z - 0.42] });
    for (const s of [-1, 1]) {
      bk.add(mats.hallBeam, new THREE.CylinderGeometry(0.075, 0.085, 3.5, 8), { p: [x + s * 0.68, y + 1.75, z - 0.42] });
      bk.add(mats.goldIn, new THREE.SphereGeometry(0.11, 8, 6), { p: [x + s * 0.68, y + 3.54, z - 0.42] });
      const hg = K.head.clone().scale(0.55, 0.55, 0.9);
      hg.rotateY(s > 0 ? 0 : Math.PI);
      hg.translate(x + s * 0.72, y + 3.6, z - 0.42);
      bk.add(mats.goldIn, hg);
      // the arms, ending in horses' heads looking down the hall
      bk.add(mats.hallBeam, box(0.12, 0.42, 0.12), { p: [x + s * 0.6, y + 0.75, z + 0.38], uv: 0.5 });
      bk.add(mats.hallBeam, box(0.14, 0.1, 0.86), { p: [x + s * 0.6, y + 1.0, z], uv: 0.5 });
      const ah = K.head.clone().scale(0.3, 0.3, 0.7);
      ah.rotateY(-Math.PI / 2);
      ah.translate(x + s * 0.6, y + 0.98, z + 0.36);
      bk.add(mats.goldIn, ah);
    }
    bk.add(mats.hallBeam, box(0.8, 0.2, 0.42), { p: [x, y + 0.1, z + 0.85], uv: 0.5 });
    lamps.push(brazier(bk, mats, -3.0, y, -20.4, 1.05), brazier(bk, mats, 3.0, y, -20.4, 1.05));
  }
  // the tables, the benches, the feast on them
  {
    const r = rng(23);
    TABLES.forEach((t) => {
      bk.add(mats.tableWood, box(t.w, 0.09, t.d), { p: [t.x, 0.84, t.z], uv: 0.5 });
      for (const k of [-1, 0, 1]) {
        const tz = t.z + k * (t.d / 2 - 1.4);
        for (const sd of [-1, 1]) bk.add(mats.hallBeam, beam([t.x + sd * 0.45, 0, tz], [t.x, 0.8, tz], 0.1, 0.12), { uv: 0.5 });
        bk.add(mats.hallBeam, box(1.0, 0.08, 0.12), { p: [t.x, 0.06, tz], uv: 0.5 });
      }
      for (const sd of [-1, 1]) {
        const bx = t.x + sd * (t.w / 2 + 0.36);
        bk.add(mats.tableWood, box(0.36, 0.07, t.d), { p: [bx, 0.46, t.z], uv: 0.5 });
        for (const k of [-1, -0.33, 0.33, 1]) bk.add(mats.hallBeam, box(0.08, 0.43, 0.08), { p: [bx, 0.215, t.z + k * (t.d / 2 - 0.4)], uv: 0.5 });
      }
      const y = 0.885;
      for (let z = t.z - t.d / 2 + 0.6; z < t.z + t.d / 2 - 0.4; z += 0.55 + r() * 0.35) {
        const kind = r();
        const px = t.x + (r() - 0.5) * 0.5;
        if (kind < 0.35) {
          bk.add(mats.pewter, lathe([[0.001, 0], [0.065, 0], [0.07, 0.04], [0.062, 0.18], [0.066, 0.2]], 10), { p: [px, y, z] });
          bk.add(mats.pewter, new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI).rotateZ(-Math.PI / 2), { p: [px + 0.07, y + 0.1, z] });
        } else if (kind < 0.65) {
          bk.add(mats.pewter, lathe([[0.001, 0], [0.16, 0.005], [0.22, 0.03], [0.23, 0.04]], 14), { p: [px, y, z] });
          const food = r();
          if (food < 0.4) bk.add(mats.food, new THREE.SphereGeometry(0.1, 8, 6).scale(1.5, 0.7, 0.9), { p: [px, y + 0.07, z], color: 0xa06a32 });
          else if (food < 0.75) bk.add(mats.food, new THREE.SphereGeometry(0.1, 8, 6).scale(1.3, 0.75, 1), { p: [px, y + 0.08, z], color: 0x7a3a22 });
          else for (let k = 0; k < 4; k++) bk.add(mats.food, new THREE.SphereGeometry(0.045, 7, 5), { p: [px + (r() - 0.5) * 0.16, y + 0.06, z + (r() - 0.5) * 0.16], color: r() < 0.5 ? 0x9a2a18 : 0x8a9a2a });
        } else if (kind < 0.8) {
          bk.add(mats.food, lathe([[0.001, 0], [0.08, 0], [0.11, 0.1], [0.09, 0.22], [0.05, 0.28], [0.06, 0.32]], 10), { p: [px, y, z], color: 0x7a5a3a });
        } else {
          bk.add(mats.food, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), { p: [px, y + 0.04, z], color: 0xd8b860 });
        }
      }
      // candles on iron stands down each table
      for (const k of [-0.32, 0, 0.32]) {
        const z = t.z + k * t.d;
        bk.add(mats.iron, lathe([[0.1, 0], [0.04, 0.03], [0.025, 0.2], [0.06, 0.22]], 8), { p: [t.x, y, z] });
        bk.add(mats.wax, new THREE.CylinderGeometry(0.035, 0.04, 0.22, 8), { p: [t.x, y + 0.33, z] });
        lamps.push(V3(t.x, y + 0.5, z));
      }
    });
  }
  // the hangings and the shields on the walls, the hangings behind the throne
  const hang = (cell, x, z, w, h, y0, turn) => {
    const pg = new THREE.PlaneGeometry(w, h);
    const uv = pg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cell + uv.getX(i)) / 3, uv.getY(i));
    pg.rotateY(turn);
    bk.add(mats.tapestry, pg, { p: [x, y0 + h / 2, z] });
    const dx = Math.cos(turn);
    const dz = -Math.sin(turn);
    bk.add(mats.goldIn, beam([x - dx * (w / 2 + 0.2), y0 + h + 0.08, z - dz * (w / 2 + 0.2)], [x + dx * (w / 2 + 0.2), y0 + h + 0.08, z + dz * (w / 2 + 0.2)], 0.06, 0.06));
  };
  hang(0, -X + 0.06, -12.5, 3.2, 4.8, 0.7, Math.PI / 2);
  hang(1, X - 0.06, -12.5, 2.4, 3.6, 1.2, -Math.PI / 2);
  hang(2, -X + 0.06, 2.5, 2.2, 3.3, 1.4, Math.PI / 2);
  hang(1, 0, Z0 + 0.06, 3.2, 4.8, 3.6, 0);
  hang(2, X - 0.06, 12.5, 2.2, 3.3, 1.4, -Math.PI / 2);
  for (const z of [-10, 0, 10]) {
    for (const s of [-1, 1]) {
      const pg = new THREE.PlaneGeometry(1.3, 2.5);
      const uv = pg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (1 + 0.08 + uv.getX(i) * 0.84) / 3, 0.18 + uv.getY(i) * 0.78);
      pg.rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
      bk.add(mats.tapestry, pg, { p: [s * 6.4, WH - 0.62 - 1.25, z + 0.3] });
      bk.add(mats.goldIn, new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6).rotateX(Math.PI / 2), { p: [s * 6.4, WH - 0.6, z + 0.3] });
    }
  }
  const shields = [
    [-1, -17.5],
    [1, -17.5],
    [-1, -7.5],
    [1, -2.5],
    [-1, 7.5],
    [1, 7.5],
    [-1, 17.5],
    [1, 17.5],
  ];
  shields.forEach(([s, z], i) => {
    const dg = atlasUV(new THREE.CircleGeometry(0.5, 20), i % 2, Math.floor(i / 2) % 2).rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
    bk.add(mats.shield, dg, { p: [s * (X - 0.1), 3.0, z] });
    bk.add(mats.iron, new THREE.TorusGeometry(0.5, 0.03, 4, 20).rotateY(Math.PI / 2), { p: [s * (X - 0.11), 3.0, z] });
  });
  bk.build(g, 'hall');
  // the shafts of light: from the east windows down across the floor, and
  // down from the smoke hole on to the hearth
  {
    const quads = [];
    const add = (from, dir, len, w) => {
      const d = V3(...dir).normalize();
      const side = V3().crossVectors(d, UP).normalize();
      const up2 = V3().crossVectors(side, d).normalize();
      for (const a of [side, side.clone().add(up2).normalize(), side.clone().sub(up2).normalize()]) {
        const p0 = V3(...from);
        const p1 = p0.clone().addScaledVector(d, len);
        const hw = (w / 2) * (a === side ? 1 : 0.8);
        quads.push([p0.clone().addScaledVector(a, -hw), p0.clone().addScaledVector(a, hw), p1.clone().addScaledVector(a, hw * 1.25), p1.clone().addScaledVector(a, -hw * 1.25)]);
      }
    };
    for (const [x, y, z] of shafts) add([x - 0.3, y, z], [-0.78, -0.56, 0.16], 9.5, 1.15);
    add([0, H - 0.6, HEARTH.z], [0.0001, -1, 0.0001], H - 1.2, 1.3);
    const pos = [];
    const uv = [];
    for (const [a, b, c, d] of quads) {
      pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
      uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const sm = new THREE.Mesh(sg, mats.shaft);
    sm.name = 'hall-shafts';
    sm.renderOrder = 2;
    g.add(sm);
  }
  return { group: g, lamps, fire: V3(HEARTH.x, 0.4, HEARTH.z) };
}

// ── the barrows ──

// White flowers of simbelmynë, a few together: each a six-pointed star (two
// triangles) with a gold eye, on a thin stem, coloured in its vertices.
function flowerGeometry(n = 5, r = 0.055, seed = 1) {
  const rr = rng(seed);
  const pos = [];
  const col = [];
  const nor = [];
  const W = [0.97, 0.98, 0.95];
  const Y = [0.95, 0.88, 0.55];
  const G = [0.26, 0.4, 0.16];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rr();
    const d = i ? 0.05 + rr() * 0.08 : 0;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const h = 0.1 + rr() * 0.14;
    const ss = r * (0.75 + rr() * 0.45);
    const lean = (rr() - 0.5) * 0.06;
    pos.push(x - 0.007, 0, z, x + 0.007, 0, z, x + lean, h, z);
    col.push(...G, ...G, ...G);
    nor.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
    const tx = x + lean;
    for (const off of [0, Math.PI / 3]) {
      const p = [0, 1, 2].map((k) => {
        const an = a + off + (k * TAU) / 3;
        return [tx + Math.cos(an) * ss, h + 0.004 * k, z + Math.sin(an) * ss];
      });
      // wound to face up: corners going clockwise seen from above
      pos.push(...p[0], ...p[2], ...p[1]);
      col.push(...W, ...W, ...W);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }
    // the eye
    const e = ss * 0.32;
    pos.push(tx + e, h + 0.006, z, tx - e * 0.5, h + 0.006, z - e * 0.87, tx - e * 0.5, h + 0.006, z + e * 0.87);
    col.push(...Y, ...Y, ...Y);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
// A tuft of long grass: a few blades, dark at the root, pale gold-green at
// the tip.
function tuftGeometry() {
  const pos = [];
  const col = [];
  const base = [0.22, 0.32, 0.1];
  const mid = [0.4, 0.5, 0.18];
  const tip = [0.62, 0.64, 0.3];
  const r = rng(5);
  for (let b = 0; b < 7; b++) {
    const a = r() * TAU;
    const ox = (r() - 0.5) * 0.12;
    const oz = (r() - 0.5) * 0.12;
    const w = 0.018 + r() * 0.012;
    const ca = Math.cos(a) * w;
    const sa = Math.sin(a) * w;
    const h = 0.14 + r() * 0.2;
    const lean = 0.06 + r() * 0.1;
    const lx = Math.cos(a + 1.57) * lean;
    const lz = Math.sin(a + 1.57) * lean;
    const m = [ox + lx * 0.35, h * 0.55, oz + lz * 0.35];
    const t = [ox + lx, h, oz + lz];
    pos.push(ox - ca, 0, oz - sa, ox + ca, 0, oz + sa, m[0] + ca * 0.6, m[1], m[2] + sa * 0.6);
    pos.push(ox - ca, 0, oz - sa, m[0] + ca * 0.6, m[1], m[2] + sa * 0.6, m[0] - ca * 0.6, m[1], m[2] - sa * 0.6);
    pos.push(m[0] - ca * 0.6, m[1], m[2] - sa * 0.6, m[0] + ca * 0.6, m[1], m[2] + sa * 0.6, ...t);
    col.push(...base, ...base, ...mid, ...base, ...mid, ...mid, ...mid, ...mid, ...tip);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

function barrowsOf(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'barrows';
  // the mounds, each on its own profile, a skirt tucked under the ground
  const NR = 12;
  const NS = Math.round(36 * Q.around);
  const n = makeNoise(711);
  const geos = BARROWS.map((b, bi) => {
    const rows = [];
    const uvs = [];
    const cols = [];
    for (let i = 0; i <= NR + 1; i++) {
      const d = i <= NR ? b.r * Math.pow(i / NR, 0.85) : b.r + 0.7;
      const row = [];
      const uv = [];
      const col = [];
      for (let j = 0; j <= NS; j++) {
        const an = (j / NS) * TAU;
        const x = b.x + Math.cos(an) * d;
        const z = b.z + Math.sin(an) * d;
        const y = i <= NR ? hillHeight(x, z) + b.h * Math.cos((d / b.r) * (Math.PI / 2)) ** 1.5 : hillHeight(x, z) - 0.35;
        row.push([x, y + (i === NR ? -0.02 : 0), z]);
        uv.push([x / 2.5, z / 2.5]);
        const k = (0.78 + 0.22 * smooth(0, b.r, b.r - d)) * (0.9 + n(x * 0.4, z * 0.4) * 0.2);
        // Théodred's is new: the turf fresher and greener
        col.push(bi === 0 ? [k * 0.92, k * 1.08, k * 0.86] : [k, k, k]);
      }
      rows.push(row);
      uvs.push(uv);
      cols.push(col);
    }
    return grid(rows, uvs, cols).toNonIndexed();
  });
  const turf = new THREE.Mesh(mergeGeometries(geos), mats.turf);
  turf.name = 'barrow-turf';
  g.add(turf);
  // simbelmynë all over them, and in the grass round about
  const r = rng(77);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = V3();
  const place = [];
  const per = Math.round(420 * Q.flowers);
  for (const b of BARROWS) {
    for (let k = 0; k < per; k++) {
      const a = r() * TAU;
      const d = (b.r + 1.6) * Math.sqrt(r());
      if (d > b.r && r() < 0.65) continue;
      const x = b.x + Math.cos(a) * d;
      const z = b.z + Math.sin(a) * d;
      if (Math.abs(z) < ROAD.w / 2 + 0.4) continue;
      place.push([x, groundAt(x, z) - 0.015, z, r() * TAU, 0.8 + r() * 0.5]);
    }
  }
  const fl = new THREE.InstancedMesh(flowerGeometry(5, 0.05, 3), mats.flower, place.length);
  place.forEach(([x, y, z, a, s], i) => {
    q.setFromAxisAngle(UP, a);
    m.compose(V3(x, y, z), q, sc.set(s, s, s));
    fl.setMatrixAt(i, m);
  });
  fl.instanceMatrix.needsUpdate = true;
  fl.computeBoundingSphere();
  fl.name = 'barrow-flowers';
  g.add(fl);
  // long grass on the mounds, leaning in the wind
  const tufts = [];
  const tn = Math.round(200 * Q.tufts);
  for (const b of BARROWS) {
    for (let k = 0; k < tn; k++) {
      const a = r() * TAU;
      const d = (b.r + 0.8) * Math.sqrt(r());
      const x = b.x + Math.cos(a) * d;
      const z = b.z + Math.sin(a) * d;
      if (Math.abs(z) < ROAD.w / 2 + 0.6) continue;
      tufts.push([x, groundAt(x, z) - 0.02, z, 0.8 + r() * 0.6, r()]);
    }
  }
  const tm = new THREE.InstancedMesh(tuftGeometry(), mats.tuft, tufts.length);
  const tc = new THREE.Color();
  tufts.forEach(([x, y, z, s, k], i) => {
    m.compose(V3(x, y, z), q.identity(), sc.set(s, s * (0.8 + k * 0.5), s));
    tm.setMatrixAt(i, m);
    tm.setColorAt(i, tc.setRGB(0.8 + k * 0.35, 0.85 + k * 0.2, 0.75 + k * 0.15));
  });
  tm.instanceMatrix.needsUpdate = true;
  tm.instanceColor.needsUpdate = true;
  tm.computeBoundingSphere();
  tm.name = 'barrow-grass';
  g.add(tm);
  // the clusters to gather: thick and bright, a little glowing, each its own
  const cg = flowerGeometry(7, 0.08, 9);
  const flowers = FLOWERS.map((f, i) => {
    const fg = new THREE.Group();
    fg.name = `flowers-${i}`;
    const gy = groundAt(f.x, f.z);
    fg.position.set(f.x, gy, f.z);
    const cr = rng(900 + i);
    const N = 40;
    const im = new THREE.InstancedMesh(cg, mats.flowerGlow, N);
    for (let k = 0; k < N; k++) {
      const a = cr() * TAU;
      const d = f.r * 0.8 * Math.pow(cr(), 0.7);
      const x = f.x + Math.cos(a) * d;
      const z = f.z + Math.sin(a) * d;
      const s = 0.9 + cr() * 0.5;
      q.setFromAxisAngle(UP, cr() * TAU);
      m.compose(V3(x - f.x, groundAt(x, z) - 0.02 - gy, z - f.z), q, sc.set(s, s, s));
      im.setMatrixAt(k, m);
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = `flowers-${i}-blooms`;
    fg.add(im);
    g.add(fg);
    return fg;
  });
  return { group: g, flowers };
}

// ── the White Mountains and the beacon peaks ──

// A mountain: a square of ground around (px, pz) raised into a massif by
// ridged noise under a falling-off cone, so it has spurs, gullies and
// lesser tops round the main one, the main one exactly at (px, pz) (the
// beacon's place, on its bearing from the terrace); scaled so that summit
// is Y, and sunk below the plain at its edges. Snow on the heights and down
// the gullies, rock between. Vertex coloured; returns where its summit is.
function peakGeometry(px, pz, Y, seed, N = 40) {
  const n = makeNoise(seed);
  const R = Y * 1.9;
  const H = [];
  let top = 0;
  let ti = 0;
  N += N % 2;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const dx = (i / N - 0.5) * 2 * R;
      const dz = (j / N - 0.5) * 2 * R;
      const warp = (fbm(n, dx / R + 4, dz / R + 9, { octaves: 2 }) - 0.5) * 0.5;
      const r = Math.hypot(dx, dz) / R + warp;
      const cone = Math.pow(Math.max(0, 1 - r), 1.35);
      const m = ridge(n, dx / (R * 0.35) + 3, dz / (R * 0.35) + 7, { octaves: 5 });
      const core = Math.pow(Math.max(0, 1 - Math.hypot(dx, dz) / (R * 0.4)), 1.6);
      H.push(cone * (0.5 + 0.55 * m * m) + core * 0.45);
    }
  }
  // the summit, in the middle, standing a little above all the rest
  const mid = (N / 2) * (N + 1) + N / 2;
  for (const h of H) top = Math.max(top, h);
  top *= 1.05;
  H[mid] = top;
  ti = mid;
  const rows = [];
  const uvs = [];
  const cols = [];
  for (let j = 0; j <= N; j++) {
    const row = [];
    const uv = [];
    const col = [];
    for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      const t = H[k] / top;
      const y = -60 + (Y + 60) * t;
      row.push([px + (i / N - 0.5) * 2 * R, y, pz + (j / N - 0.5) * 2 * R]);
      uv.push([0, 0]);
      const lump = n(i * 0.31 + 5, j * 0.31);
      const steep = Math.abs(H[k] - (H[k + 1] ?? H[k])) + Math.abs(H[k] - (H[k + N + 1] ?? H[k]));
      const snow = smooth(0.5, 0.64, t + (lump - 0.5) * 0.18) * (1 - smooth(0.06, 0.13, steep * (N / 10)) * 0.6);
      const rock = 0.2 + lump * 0.08 + (1 - t) * 0.05;
      col.push([mix(rock, 0.88, snow), mix(rock * 0.96, 0.9, snow), mix(rock * 0.9, 0.96, snow)]);
    }
    rows.push(row);
    uvs.push(uv);
    cols.push(col);
  }
  const si = ti % (N + 1);
  const sj = Math.floor(ti / (N + 1));
  // rows run south, points east: wound so the faces look up
  rows.reverse();
  cols.reverse();
  return { geo: grid(rows, uvs, cols), top: [px + (si / N - 0.5) * 2 * R, pz + (sj / N - 0.5) * 2 * R] };
}
// A ridge along a path of [x, z] points, its crest at height(i, t) (t along
// it, 0..1), its foot `wide` either side: a long sheet over five lines.
function ridgeGeometry(path, height, { wide = 600, seed = 1, snow = 600 } = {}) {
  const n = makeNoise(seed);
  const rows = [];
  const uvs = [];
  const cols = [];
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    const [ax, az] = path[Math.max(0, i - 1)];
    const [bx, bz] = path[Math.min(path.length - 1, i + 1)];
    const tx = bx - ax;
    const tz = bz - az;
    const tl = Math.hypot(tx, tz) || 1;
    // across the ridge, to its left as it goes
    const nx = -tz / tl;
    const nz = tx / tl;
    const t = i / (path.length - 1);
    const h = height(i, t);
    const w1 = wide * (0.8 + fbm(n, i * 0.07, 3.1, { octaves: 2 }) * 0.5);
    const w2 = wide * (0.8 + fbm(n, i * 0.07, 7.7, { octaves: 2 }) * 0.5);
    const prof = [
      [-w1 * 1.1, -40],
      [-w1 * 0.42, h * (0.42 + fbm(n, i * 0.13, 1.3) * 0.2)],
      [0, h],
      [w2 * 0.4, h * (0.45 + fbm(n, i * 0.13, 5.3) * 0.2)],
      [w2 * 1.1, -40],
    ];
    const row = [];
    const col = [];
    for (const [o, y] of prof) {
      row.push([x + nx * o, y, z + nz * o]);
      const k = smooth(snow - 80, snow + 60, y + (n(i * 0.21, o * 0.004) - 0.5) * 160);
      const rk = 0.22 + n(i * 0.17, o * 0.01) * 0.1;
      col.push([mix(rk, 0.9, k), mix(rk * 0.97, 0.92, k), mix(rk * 0.94, 0.97, k)]);
    }
    rows.push(row);
    uvs.push(prof.map(() => [0, 0]));
    cols.push(col);
  }
  return grid(rows, uvs, cols);
}

function peaksOf(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'white-mountains';
  const geos = [];
  const fires = [];
  const tops = [];
  const pile = (x, y, z) => {
    for (let l = 0; l < 4; l++) {
      for (let i = 0; i < 3; i++) {
        const t = -2.4 + i * 2.4;
        const lg = new THREE.BoxGeometry(7, 0.9, 0.9);
        if (l % 2) lg.rotateY(Math.PI / 2);
        lg.translate(l % 2 ? x + t : x, y + 0.45 + l * 0.9, l % 2 ? z : z + t);
        fillColor(lg, 0x4a3628);
        lg.deleteAttribute('uv');
        geos.push(lg.toNonIndexed());
      }
    }
  };
  const NP = Q.tex >= 512 ? 44 : Q.tex >= 384 ? 34 : 26;
  PEAKS.forEach((p, i) => {
    const px = WATCH.x + Math.cos(p.bearing) * p.dist;
    const pz = WATCH.z - Math.sin(p.bearing) * p.dist;
    const Y = Math.max(p.h, hillHeight(px, pz) + p.h * 0.45);
    const { geo: pg, top } = peakGeometry(px, pz, Y, 500 + i, NP);
    pg.deleteAttribute('uv');
    geos.push(pg.toNonIndexed());
    pile(top[0], Y - 0.6, top[1]);
    fires.push(V3(top[0], Y - 0.6 + 3.6 + 0.6, top[1]));
    tops.push([top[0], top[1], Y]);
  });
  // the chain they stand on, lower between them
  {
    const n = makeNoise(733);
    const path = [];
    const way = [[tops[0][0] - 700, tops[0][1] + 500], ...tops.map(([x, z]) => [x, z]), [tops[tops.length - 1][0] + 600, tops[tops.length - 1][1] - 420]];
    const hs = [tops[0][2] * 0.7, ...tops.map((tp) => tp[2]), tops[tops.length - 1][2] * 0.6];
    const hh = [];
    for (let k = 0; k < way.length - 1; k++) {
      const [ax, az] = way[k];
      const [bx, bz] = way[k + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 30);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        path.push([mix(ax, bx, t), mix(az, bz, t)]);
        const low = Math.min(hs[k], hs[k + 1]) * (0.42 + 0.3 * Math.pow(Math.abs(t - 0.5) * 2, 2));
        hh.push(low + ridge(n, path.length * 0.11, 2.2, { octaves: 3 }) * 50);
      }
    }
    path.push(way[way.length - 1]);
    hh.push(hs[hs.length - 1] * 0.4);
    const rg = ridgeGeometry(path, (i) => hh[i], { wide: 380, seed: 735, snow: 250 });
    rg.deleteAttribute('uv');
    geos.push(rg.toNonIndexed());
  }
  // the White Mountains along the south, far and snowy behind the hill
  {
    const n = makeNoise(741);
    const way = [
      [-4200, 2100],
      [-2000, 2400],
      [0, 2500],
      [1500, 2400],
      [2800, 2200],
      [4200, 1900],
    ];
    const path = [];
    for (let k = 0; k < way.length - 1; k++) {
      const [ax, az] = way[k];
      const [bx, bz] = way[k + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 30);
      for (let s = 0; s < steps; s++) path.push([mix(ax, bx, s / steps), mix(az, bz, s / steps) + (fbm(n, path.length * 0.02, 1.5, { octaves: 3 }) - 0.5) * 260]);
    }
    const rg = ridgeGeometry(path, (i) => 420 + Math.pow(ridge(n, i * 0.045, 4.4, { octaves: 4 }), 2.2) * 620 + fbm(n, i * 0.3, 9.1, { octaves: 3 }) * 90, { wide: 700, seed: 743, snow: 520 });
    rg.deleteAttribute('uv');
    geos.push(rg.toNonIndexed());
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), mats.peak);
  mesh.name = 'white-mountains';
  g.add(mesh);
  return { group: g, fires };
}

// ── the kit ──

export function createEdorasKit(renderer, { tier = 'high' } = {}) {
  const Q = QUALITY[tier] ?? QUALITY.high;
  const S = Q.tex;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const N = (field, s, k, o = {}) => T(normalFromField(field, s, s, k), { srgb: false, ...o });
  const pl = planksCanvas(S, { seed: 3 });
  const lg = logCanvas(S >> 1);
  const th = thatchCanvas(S);
  const ash = blocksCanvas(S >> 1, { seed: 5, rows: 4, len: [0.22, 0.55], joint: 1.2, bevel: 5, light: [190, 182, 164], dark: [112, 106, 94], mortar: [96, 90, 80], spread: 0.6 });
  const fl = flagsCanvas(S);
  const ea = earthCanvas(S >> 1);
  const tu = turfCanvas(S >> 1);
  const hf = hallFloorCanvas(S);
  const ripple = rippleField(128);
  const tex = {
    planks: T(pl.c),
    planksN: N(pl.field, S, 2.6),
    log: T(lg.c),
    logN: N(lg.field, S >> 1, 2.4),
    thatch: T(th.c),
    thatchN: N(th.field, S, 3),
    stone: T(ash.c),
    stoneN: N(ash.field, S >> 1, 2.4),
    flags: T(fl.c),
    flagsN: N(fl.field, S, 2.2),
    earth: T(ea.c),
    earthN: N(ea.field, S >> 1, 2),
    turf: T(tu.c),
    turfN: N(tu.field, S >> 1, 1.6),
    banner: T(bannerCanvas(S >> 1), { wrap: false }),
    door: T(doorCanvas(S >> 1), { wrap: false }),
    carve: T(carveCanvas(S >> 1)),
    hallFloor: T(hf.c),
    hallFloorN: N(hf.field, S, 2),
    tapestry: T(tapestryCanvas(S >> 1), { wrap: false }),
    shield: T(shieldCanvas(S), { wrap: false }),
    embers: T(emberCanvas(128)),
    waterN: N(ripple, 128, 3, { repeat: [1.5, 1.5] }),
    fall: T(fallCanvas(128), { repeat: [1, 1] }),
    shaft: T(shaftCanvas(), { wrap: false }),
  };
  tex.skyEnv = envRoom(renderer, [0.16, 0.15, 0.1], [0.78, 0.82, 0.9], [
    [0xfff2d8, 3.2, 7, 7, [-6, 7, 5]],
    [0xdde6f0, 1.4, 14, 5, [7, 4, -4]],
  ]);
  tex.hallEnv = envRoom(renderer, [0.02, 0.015, 0.01], [0.09, 0.065, 0.045], [
    [0xff9a48, 2.2, 3, 1.5, [0, -2, 6]],
    [0xff9a48, 1.4, 2, 2, [6, 1, -5]],
    [0xfff0d8, 1.6, 2.5, 1.2, [8, 6, 0]],
  ]);
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const U = { uTime: { value: 0 } };
  const mats = {
    // the hill
    timber: M({ map: tex.planks, normalMap: tex.planksN, normalScale: V2(0.9), vertexColors: true, roughness: 0.9 }),
    beam: M({ map: tex.planks, normalMap: tex.planksN, normalScale: V2(0.7), color: 0x7a6656, roughness: 0.82 }),
    logs: M({ map: tex.log, normalMap: tex.logN, normalScale: V2(1.1), roughness: 0.92 }),
    thatch: M({ map: tex.thatch, normalMap: tex.thatchN, normalScale: V2(1.3), vertexColors: true, roughness: 0.96 }),
    goldThatch: M({ map: tex.thatch, normalMap: tex.thatchN, normalScale: V2(1.1), color: 0xe6b448, vertexColors: true, metalness: 0.55, roughness: 0.55, envMap: tex.skyEnv, envMapIntensity: 1.0 }),
    gold: M({ color: 0xc8901e, metalness: 0.95, roughness: 0.32, envMap: tex.skyEnv, envMapIntensity: 1.15 }),
    stone: M({ map: tex.stone, normalMap: tex.stoneN, normalScale: V2(0.9), vertexColors: true, roughness: 0.9 }),
    paving: M({ map: tex.flags, normalMap: tex.flagsN, normalScale: V2(0.8), roughness: 0.88 }),
    road: M({ map: tex.earth, normalMap: tex.earthN, normalScale: V2(0.9), alphaTest: 0.5, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    water: M({ color: 0x1a2a2a, normalMap: tex.waterN, normalScale: V2(0.35), roughness: 0.16, metalness: 0.05, envMap: tex.skyEnv, envMapIntensity: 0.32 }),
    fall: M({ map: tex.fall, color: 0xc8d4d4, transparent: true, opacity: 0.7, depthWrite: false, roughness: 0.15, side: THREE.DoubleSide }),
    iron: M({ color: 0x2c2a28, roughness: 0.5, metalness: 0.7 }),
    coals: new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 2.2) }),
    banner: M({ map: tex.banner, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82 }),
    door: M({ map: tex.door, roughness: 0.5, metalness: 0.25, envMap: tex.skyEnv, envMapIntensity: 0.7 }),
    carve: M({ map: tex.carve, roughness: 0.5, metalness: 0.1, envMap: tex.skyEnv, envMapIntensity: 0.6 }),
    hay: M({ map: tex.thatch, color: 0xf6dc90, roughness: 1 }),
    glass: M({ color: 0x12100e, roughness: 0.35, metalness: 0.2 }),
    // the barrows
    turf: M({ map: tex.turf, normalMap: tex.turfN, vertexColors: true, roughness: 0.96 }),
    tuft: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    flower: M({ vertexColors: true, emissive: 0x262624, roughness: 0.7, side: THREE.DoubleSide }),
    flowerGlow: M({ vertexColors: true, emissive: hot(0xeef4ff, 0.42), roughness: 0.6, side: THREE.DoubleSide }),
    // far off
    peak: M({ vertexColors: true, roughness: 1, flatShading: true }),
    // the hall
    hallWood: M({ map: tex.planks, normalMap: tex.planksN, normalScale: V2(0.8), vertexColors: true, roughness: 0.72, envMap: tex.hallEnv, envMapIntensity: 0.6 }),
    hallBeam: M({ map: tex.planks, normalMap: tex.planksN, normalScale: V2(0.6), color: 0x6a5444, roughness: 0.66, envMap: tex.hallEnv, envMapIntensity: 0.6 }),
    tableWood: M({ map: tex.planks, color: 0x9a7e62, roughness: 0.6, envMap: tex.hallEnv, envMapIntensity: 0.7 }),
    carveIn: M({ map: tex.carve, roughness: 0.42, metalness: 0.15, envMap: tex.hallEnv, envMapIntensity: 1.2 }),
    goldIn: M({ color: 0xdcae50, metalness: 0.9, roughness: 0.28, envMap: tex.hallEnv, envMapIntensity: 1.8 }),
    doorIn: M({ map: tex.door, roughness: 0.5, metalness: 0.25, envMap: tex.hallEnv, envMapIntensity: 1.2 }),
    hallFloor: M({ map: tex.hallFloor, normalMap: tex.hallFloorN, normalScale: V2(0.5), roughness: 0.82, envMap: tex.hallEnv, envMapIntensity: 0.4 }),
    hearthStone: M({ map: tex.stone, normalMap: tex.stoneN, color: 0x8a8278, roughness: 0.9 }),
    embers: M({ color: 0x2a2018, emissive: hot(0xff7a30, 1.6), emissiveMap: tex.embers, roughness: 1 }),
    tapestry: M({ map: tex.tapestry, roughness: 1, side: THREE.DoubleSide }),
    shield: M({ map: tex.shield, roughness: 0.55, envMap: tex.hallEnv, envMapIntensity: 0.6, side: THREE.DoubleSide }),
    fur: M({ color: 0x6a5240, roughness: 1 }),
    pewter: M({ color: 0xa09a90, metalness: 0.7, roughness: 0.35, envMap: tex.hallEnv, envMapIntensity: 1.4, side: THREE.DoubleSide }),
    food: M({ vertexColors: true, roughness: 0.6, envMap: tex.hallEnv, envMapIntensity: 0.4, side: THREE.DoubleSide }),
    wax: M({ color: 0xf0e4c8, emissive: 0x4a3a20, roughness: 0.5 }),
    pane: new THREE.MeshBasicMaterial({ color: hot(0xfff0d8, 1.6), side: THREE.DoubleSide }),
    shaft: new THREE.MeshBasicMaterial({ map: tex.shaft, color: 0xffe2b8, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  };
  windBanner(mats.banner, U);
  windGrass(mats.tuft, U, 0.5);
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const K = { mats, tex, renderer, Q, head: horseHeadGeo() };
  const shiny = ['goldThatch', 'gold', 'water', 'door', 'carve'].map((k) => [mats[k], mats[k].envMapIntensity]);
  return {
    mats,
    tex,
    tick: (t) => {
      U.uTime.value = t;
      tex.waterN.offset.set(t * 0.05, -t * 0.12);
      tex.fall.offset.y = t * 0.9;
    },
    // how much daylight the sky gives what shines outside (1 by day, ~0.2 at
    // night), so the gold doesn't glow in the dark
    daylight: (k = 1) => {
      for (const [m, base] of shiny) m.envMapIntensity = base * k;
    },
    town: () => townOf(K),
    hall: () => hallInside(K),
    barrows: () => barrowsOf(K),
    peaks: () => peaksOf(K),
  };
}
