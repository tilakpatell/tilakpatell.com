// The voxel castle's geometry, read and made ready (scripts/hogwarts-castle.mjs):
// Jzax's MagicaVoxel Hogwarts (CC-BY) paints every face from a strip of 256
// colours, so a face's colour says what it is. Each class becomes its own
// primitive, painted in the world with a scan by world position
// (src/components/hogwarts/world/castle/), so the model needs neither UVs
// nor normals: three draws a mesh without normals flat-shaded, which is
// how stone planes should read. Pure: no files, no three.

// what each class is, and the colour it is drawn in on a sheet (sRGB)
export const CLASSES = {
  stone: { colour: [0.56, 0.54, 0.5], what: 'the walls, towers and bridges' },
  slate: { colour: [0.22, 0.24, 0.27], what: 'the roofs and the cones' },
  rock: { colour: [0.36, 0.33, 0.25], what: 'the cliff and the knolls' },
  earth: { colour: [0.38, 0.29, 0.15], what: 'paths and beds' },
  grass: { colour: [0.2, 0.32, 0.12], what: 'the courtyards’ lawns' },
  wood: { colour: [0.33, 0.22, 0.14], what: 'doors, beams, the boathouse jetty' },
  window: { colour: [0.06, 0.07, 0.08], what: 'the windows, dark by day and lit at night' },
  glass: { colour: [0.6, 0.7, 0.68], what: 'the greenhouses’ glass' },
  lamp: { colour: [1, 0.85, 0.55], what: 'lanterns and lit windows' },
};

// The model's 50 colours, read off its palette, named by looking at where
// each falls on the sheet; any other colour by its hue and value (classOf).
const NAMED = {
  '2c2f30': 'slate', '343435': 'slate', '3c3e3e': 'slate', '384443': 'slate',
  '2b2818': 'rock', '2a2818': 'rock', '2c2718': 'rock', '2b2718': 'rock',
  '372b12': 'earth', '28200d': 'earth', '36280d': 'earth', '35270d': 'earth',
  '473626': 'wood', '1f1916': 'wood', '302722': 'wood', '302925': 'wood', '532f0e': 'wood', '544230': 'wood', '221f1a': 'wood', '8a7058': 'wood',
  '92afaa': 'glass',
  b7ad89: 'stone',
};

export const hexOf = ([r, g, b]) => [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

// a palette colour (0–255 sRGB) → its class
export function classOf(rgb) {
  const named = NAMED[hexOf(rgb)];
  if (named) return named;
  const [r, g, b] = rgb;
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  if (hi >= 200) return 'lamp';
  if (g > r + 8 && g > b + 8) return 'grass';
  if (hi - lo <= 10) return hi < 0x2d ? 'window' : 'stone';
  return r > b ? 'wood' : 'slate';
}

// Positions welded where they meet (a voxel export repeats a corner for
// every face that uses it): `step` is the grid they're snapped to.
// → { verts: Float32Array (x, y, z a vertex), remap: Uint32Array (input vertex → welded) }
export function weldPositions(positions, step) {
  const n = positions.length / 3;
  const remap = new Uint32Array(n);
  const seen = new Map();
  const out = [];
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(positions[i * 3] / step)},${Math.round(positions[i * 3 + 1] / step)},${Math.round(positions[i * 3 + 2] / step)}`;
    let at = seen.get(key);
    if (at === undefined) {
      at = out.length / 3;
      seen.set(key, at);
      out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    }
    remap[i] = at;
  }
  return { verts: Float32Array.from(out), remap };
}

// A class's triangles as their own compact mesh: → { positions, indices }
export function compact(verts, tris) {
  const map = new Map();
  const positions = [];
  const indices = new Uint32Array(tris.length);
  for (let i = 0; i < tris.length; i++) {
    let at = map.get(tris[i]);
    if (at === undefined) {
      at = positions.length / 3;
      map.set(tris[i], at);
      positions.push(verts[tris[i] * 3], verts[tris[i] * 3 + 1], verts[tris[i] * 3 + 2]);
    }
    indices[i] = at;
  }
  return { positions: Float32Array.from(positions), indices };
}

// The windows. The model paints its windows and its roofs the same slate,
// so a window is told by where it is: an upright patch of slate (or of the
// near-black) set into a wall of another class in the same plane, and small
// (a roof's gable end is slate in a slate plane, or large). Faces are
// axis-aligned in a voxel model, so a face's plane is exact. → the classes
// with those faces turned to 'window' (and upright near-black faces that
// touch no wall, and flat near-black ones, to slate)
export function findWindows(verts, tris, cls, names, { most = 96, step = 1, wide = 5, tall = 24 } = {}) {
  const W = names.indexOf('window');
  const S = names.indexOf('slate');
  const n = cls.length;
  const axis = new Int8Array(n); // ±1 x, ±2 y, ±3 z
  const plane = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    const [a, b, c] = [tris[t * 3] * 3, tris[t * 3 + 1] * 3, tris[t * 3 + 2] * 3];
    const u = [verts[b] - verts[a], verts[b + 1] - verts[a + 1], verts[b + 2] - verts[a + 2]];
    const v = [verts[c] - verts[a], verts[c + 1] - verts[a + 1], verts[c + 2] - verts[a + 2]];
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const k = [0, 1, 2].reduce((m, i) => (Math.abs(nn[i]) > Math.abs(nn[m]) ? i : m), 0);
    axis[t] = Math.sign(nn[k]) * (k + 1);
    plane[t] = Math.round(verts[a + k] * 1e4);
  }
  const edges = new Map();
  const key = (p, q) => (p < q ? p * 4194304 + q : q * 4194304 + p);
  for (let t = 0; t < n; t++)
    for (let e = 0; e < 3; e++) {
      const k = key(tris[t * 3 + e], tris[t * 3 + ((e + 1) % 3)]);
      const list = edges.get(k);
      if (list) list.push(t);
      else edges.set(k, [t]);
    }
  const upright = (t) => Math.abs(axis[t]) !== 2;
  const candidate = (t) => (cls[t] === S || cls[t] === W) && upright(t);
  const out = Uint8Array.from(cls);
  const seen = new Uint8Array(n);
  for (let t0 = 0; t0 < n; t0++) {
    if (seen[t0] || !candidate(t0)) continue;
    const region = [t0];
    seen[t0] = 1;
    let walled = false;
    for (let i = 0; i < region.length; i++) {
      const t = region[i];
      for (let e = 0; e < 3; e++)
        for (const o of edges.get(key(tris[t * 3 + e], tris[t * 3 + ((e + 1) % 3)]))) {
          if (o === t) continue;
          // (a window set back a voxel: its reveal, a wall's class at right angles)
          if (Math.abs(axis[o]) !== Math.abs(axis[t])) {
            if (cls[o] !== S && cls[o] !== W) walled = true;
            continue;
          }
          if (axis[o] !== axis[t] || plane[o] !== plane[t]) continue;
          if (candidate(o)) {
            if (!seen[o]) {
              seen[o] = 1;
              region.push(o);
            }
          } else walled = true;
        }
    }
    // (and window-shaped: no wider than `wide` voxels, no taller than
    // `tall`, and taller than it is wide; a dark band along a wall's foot
    // or a whole gable is neither, and would glow as a bar at night)
    let window = walled && region.length <= most;
    if (window) {
      const h = Math.abs(axis[t0]) === 1 ? 2 : 0;
      let lo = [Infinity, Infinity];
      let hi = [-Infinity, -Infinity];
      for (const t of region)
        for (let k = 0; k < 3; k++) {
          const v = tris[t * 3 + k] * 3;
          lo = [Math.min(lo[0], verts[v + h]), Math.min(lo[1], verts[v + 1])];
          hi = [Math.max(hi[0], verts[v + h]), Math.max(hi[1], verts[v + 1])];
        }
      const w = (hi[0] - lo[0]) / step;
      const ht = (hi[1] - lo[1]) / step;
      window = w <= wide + 0.01 && ht <= tall + 0.01 && ht >= w * 0.9;
    }
    for (const t of region) out[t] = window ? W : S;
  }
  for (let t = 0; t < n; t++) if (out[t] === W && !upright(t)) out[t] = S;
  return out;
}
