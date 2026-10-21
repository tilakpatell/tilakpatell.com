// The pure half of the kit pipeline (scripts/kit/import.mjs, which turns the
// Quaternius packs into a GLB a family, and scripts/kit/manifest.mjs, which
// describes them; docs/superpowers/specs/2026-10-08-kit-worlds-design.md):
// what a pack file's name says it is, a crown's leaf cards thinned for its
// far LOD, the wind weight the nature pack paints into its vertex colour, a
// model's footprint and trunk, and a leaf map's two tones for the far band's
// puffs. No three.js, no DOM: plain arrays in, plain arrays out, so all of it
// is tested in Node (lib.test.mjs).
//
//   familyOf(name) → 'birch'             (the name before its first `_`, lower-cased)
//   kindOf(name, pack) → 'tree' | 'bush' | 'grass' | 'flower' | 'plant' |
//     'mushroom' | 'rock' | 'path' | 'pebble' | 'planet' | 'character' |
//     'vehicle' | 'street' | 'decal' | 'building' | 'prop'
//   thinCards(positions: Float32Array, indices: Uint32Array, keep, seed)
//     → { positions: Float32Array, indices: Uint32Array, map: Uint32Array }
//   windFromColor(color0: Float32Array, stride: 3 | 4) → Uint8Array
//   boundsOf(positions, { trunkFraction = 0.08, trunk = positions }) → { radius, height, trunk }
//   tonesOf(rgba: Uint8Array, w, h) → [[r, g, b], [r, g, b]]   (linear, 0..1)

// A seeded random, so a crown thins the same way every import: mulberry32,
// src/lib/seeded.js's, copied so this module stays free of the app's.
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A family is what the packs name before the first underscore: Birch_3,
// Flower_1_Group, RockPath_Round_Wide, Astronaut_FinnTheFrog,
// Building_Large_2. The number or size word that tells a family's models
// apart always comes after it, so the first word is the family whole.
export function familyOf(name) {
  return name.split('_')[0].toLowerCase();
}

// The spec's kinds, each with the families that are it; any other family
// is a prop.
const KINDS = {
  // (the older Stylized Nature Pack names its trees BirchTree_1, MapleTree_1 …)
  tree: ['birch', 'birchtree', 'cherryblossom', 'commontree', 'deadtree', 'giantpine', 'mapletree', 'palmtree', 'pine', 'tallthick', 'twistedtree', 'tree'],
  bush: ['bush'],
  grass: ['grass'],
  flower: ['flower', 'petal'],
  plant: ['fern', 'clover', 'plant'],
  mushroom: ['mushroom'],
  rock: ['rock'],
  path: ['rockpath'],
  pebble: ['pebble'],
  planet: ['planet'],
  character: ['astronaut', 'mech', 'enemy', 'cow', 'horse', 'zebra', 'llama', 'pig', 'pug', 'sheep'],
  vehicle: ['rover', 'spaceship'],
  street: ['street', 'sidewalk'],
  decal: ['decal'],
  building: ['building'],
};
const KIND_OF = new Map(Object.entries(KINDS).flatMap(([kind, families]) => families.map((f) => [f, kind])));

// (callers pass the pack too, for the day two packs mean different things
// by one family name; none does yet, so it isn't read)
export function kindOf(name) {
  return KIND_OF.get(familyOf(name)) ?? 'prop';
}

// A crown's far LOD: a seeded `keep` of its leaf cards, each grown about its
// own centroid by 1 / sqrt(the share actually kept) (at most ×1.25) so the
// thinner crown still covers about what it did; a crown of one card keeps it
// and does not grow. A card is a clump: the triangles joined by the
// vertices they share, wherever they stand in the index list. A broadleaf
// card in the nature pack is a quad of two; a pine's needle clump is up to
// twenty-two, its triangles scattered through the list, and is kept or
// dropped, and grown, whole. Exactly round(keep × cards) are kept, never
// fewer than one, in the order they first stood, and each card's triangles
// in their old order; `map` is each new vertex's old one, to gather the
// other attributes (normals, UVs, _WIND) by.
export function thinCards(positions, indices, keep, seed) {
  const tris = Math.floor(indices.length / 3);
  // the clumps: a union-find over the vertices each triangle joins
  const root = Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
  const find = (v) => {
    while (root[v] !== v) v = root[v] = root[root[v]];
    return v;
  };
  for (let i = 0; i < tris * 3; i += 3) {
    const a = find(indices[i]);
    root[find(indices[i + 1])] = a;
    root[find(indices[i + 2])] = a;
  }
  const cardOf = new Map();
  const cards = [];
  for (let t = 0; t < tris; t++) {
    const r = find(indices[t * 3]);
    if (!cardOf.has(r)) cardOf.set(r, cards.push([]) - 1);
    cards[cardOf.get(r)].push(t);
  }

  const kept = cards.length && Math.min(cards.length, Math.max(1, Math.round(keep * cards.length)));
  // which: the first `kept` of a seeded shuffle, put back in order
  const order = Uint32Array.from(cards, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = 0; i < kept; i++) {
    const j = i + Math.floor(rand() * (cards.length - i));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const chosen = order.subarray(0, kept).sort();
  // (by the share kept, not the share asked: one card of one keeps its size)
  const grow = kept ? Math.min(1 / Math.sqrt(kept / cards.length), 1.25) : 1;

  const map = [];
  const out = [];
  const pos = [];
  for (const card of chosen) {
    const first = map.length;
    const local = new Map();
    for (const t of cards[card]) {
      for (let i = t * 3; i < t * 3 + 3; i++) {
        const v = indices[i];
        if (!local.has(v)) {
          local.set(v, map.length);
          map.push(v);
        }
        out.push(local.get(v));
      }
    }
    const centre = [0, 0, 0];
    for (let n = first; n < map.length; n++) {
      for (let k = 0; k < 3; k++) centre[k] += positions[map[n] * 3 + k] / (map.length - first);
    }
    for (let n = first; n < map.length; n++) {
      for (let k = 0; k < 3; k++) pos.push(centre[k] + (positions[map[n] * 3 + k] - centre[k]) * grow);
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(out), map: new Uint32Array(map) };
}

// The nature pack paints a wind weight into COLOR_0 (0.03 to 0.14 at a
// trunk's foot, tree by tree, to 1 at the crown, the same in every channel):
// its red channel as a byte, a vertex at a time, held to 0..255.
export function windFromColor(color0, stride) {
  const wind = new Uint8Array(Math.floor(color0.length / stride));
  for (let i = 0; i < wind.length; i++) wind[i] = Math.round(Math.min(1, Math.max(0, color0[i * stride])) * 255);
  return wind;
}

// A model's size for the manifest: `radius` half the diagonal of its XZ
// footprint, `height` its highest y, and `trunk` how far the vertices below
// trunkFraction × height reach across from their own middle (the far band
// draws the trunk as a cylinder that thick, and a placer makes it solid).
// The trunk is measured over `trunk`'s positions (a tree's bark: a leaf card
// that hangs below the line is not its trunk), the line and the rest over
// all of them.
export function boundsOf(positions, { trunkFraction = 0.08, trunk: under = positions } = {}) {
  const n = Math.floor(positions.length / 3);
  if (!n) return { radius: 0, height: 0, trunk: 0 };
  let [x0, x1, z0, z1, height] = [Infinity, -Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const [x, y, z] = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    [x0, x1, z0, z1, height] = [Math.min(x0, x), Math.max(x1, x), Math.min(z0, z), Math.max(z1, z), Math.max(height, y)];
  }
  const radius = Math.hypot(x1 - x0, z1 - z0) / 2;

  const cut = trunkFraction * height;
  const m = Math.floor(under.length / 3);
  let [a0, a1, b0, b1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < m; i++) {
    if (under[i * 3 + 1] >= cut) continue;
    const [x, z] = [under[i * 3], under[i * 3 + 2]];
    [a0, a1, b0, b1] = [Math.min(a0, x), Math.max(a1, x), Math.min(b0, z), Math.max(b1, z)];
  }
  if (a0 === Infinity) return { radius, height, trunk: 0 };
  const [cx, cz] = [(a0 + a1) / 2, (b0 + b1) / 2];
  let trunk = 0;
  for (let i = 0; i < m; i++) {
    if (under[i * 3 + 1] >= cut) continue;
    trunk = Math.max(trunk, Math.hypot(under[i * 3] - cx, under[i * 3 + 2] - cz));
  }
  return { radius, height, trunk };
}

// An sRGB byte to linear light, for each of the 256.
const LINEAR = Float64Array.from({ length: 256 }, (_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

// A leaf map's two tones for the far band's puffs: the mean colour of the
// texels the leaf keeps (alpha over 128), meaned in linear light as a far
// crown's mips would blur it, then ×0.88 and ×1.12 (the same in each
// channel, so its luma moves ±12 % and its hue stays), held to 1. Black if
// the map keeps nothing.
export function tonesOf(rgba, w, h) {
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (rgba[i * 4 + 3] <= 128) continue;
    for (let k = 0; k < 3; k++) sum[k] += LINEAR[rgba[i * 4 + k]];
    count++;
  }
  const mean = sum.map((s) => (count ? s / count : 0));
  return [0.88, 1.12].map((f) => mean.map((c) => Math.min(1, c * f)));
}
