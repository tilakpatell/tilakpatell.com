// Which LOD of the game's chain an instance draws, and whether it draws at
// all (lane L). Frostbite halves a mesh's triangles at each step of its chain
// and picks the step by how big the thing is on screen; so does this: LOD n
// once the distance passes L0 × radius × 2^n (of three steps: stepsOf), never more triangles than the
// tier's cap (the plan's plain cut: the first LOD within 12,000 on high), and
// nothing beyond K radii, K fitted per level and tier (fit.js) so the row
// holds where you stand. Pure: the pack builder and the scene both read it.
//
//   LOD[tier] = { L0, cap }
//   capIndex(chain, cap), stepsOf(chain, tier), lodAt(chain, d, r, tier) → n; seenAt(d, r, K)
//   texSizeFor(r, tier, data) → a map's size for the biggest thing that wears it

export const LOD = Object.freeze({
  low: Object.freeze({ L0: 0.5, cap: 2500 }),
  mid: Object.freeze({ L0: 0.75, cap: 6000 }),
  high: Object.freeze({ L0: 1, cap: 12000 }),
  ultra: Object.freeze({ L0: 2, cap: Infinity }),
});

// (a speck still counts as a quarter metre: decals and cables stay a while)
export const MIN_RADIUS = 0.25;

export function capIndex(chain, cap) {
  const i = chain.findIndex((t) => t <= cap);
  return i < 0 ? chain.length - 1 : i;
}

// A mesh draws three of its LODs at most (its cap's, the middle one, its
// last), as the plan's three cuts did: each LOD in view is a draw call, and a
// step a doubling would spread a mesh over five. The size picks among them,
// the lighter one when it falls between.
export function stepsOf(chain, tier) {
  const c = capIndex(chain, (LOD[tier] ?? LOD.high).cap);
  const last = chain.length - 1;
  return [...new Set([c, Math.ceil((c + last) / 2), last])];
}

export function lodAt(chain, d, r, tier) {
  const t = LOD[tier] ?? LOD.high;
  const size = Math.max(0, Math.floor(Math.log2(Math.max(1, d / (t.L0 * Math.max(MIN_RADIUS, r))))));
  for (const n of stepsOf(chain, tier)) if (n >= size) return n;
  return chain.length - 1;
}

export const seenAt = (d, r, K) => d <= K * Math.max(MIN_RADIUS, r);

// A map is sized by the biggest thing that wears it, as its LODs are: on
// high and mid 1024 for a thing 8 m from its middle to its edge or more,
// 512 from 2 m, 256 below, a normal or ORM map a step under its colour (the
// uploader's derived `__normal` and `__orm` maps: shading detail reads at
// half the colour's size); low half of that (128 at least). Ultra a step
// over high with its normal and ORM at the colour's size (2048, 2048,
// 1024): lane D2's step up, given to ultra alone, since high's maps a step
// up put main's Hoth at about 290 MB fetched against the 160 MB bucket row
// (galaxy-budget.mjs's BUCKET_MB; the D2 evidence has the sums). A tier over
// its row is cut by fitCull; the GPU-memory contract (256 MB desktop, 128 MB
// phone) is fitTextures' at load.
export function texSizeFor(r, tier, data = false) {
  const colour = r >= 8 ? 1024 : r >= 2 ? 512 : 256;
  if (tier === 'ultra') return Math.min(2048, colour * 4);
  const high = data ? Math.max(128, colour / 2) : colour;
  if (tier === 'low') return Math.max(128, high / 2);
  return high;
}

// A tier's maps held to its bytes (lane D2): a pack's maps are bound after
// the GLB is parsed, so fitTextures never sees them, and ultra's step up
// took Endor's maps to 685 MB. TEX_MB is each tier's share of the GPU-memory
// contract (null: unfitted, as main's sizes always held); over it, the
// biggest map steps down a size, a normal or ORM map before a colour one
// (shading detail reads at half the colour's size), never below `floor` (the
// size high takes), until the tier fits.
//   fitMaps(maps, budget) → { [slug]: size }
//   maps: [{ slug, data, size, floor, bytes: { [size]: n } }]
export const TEX_MB = Object.freeze({
  low: null,
  mid: null,
  high: null,
  ultra: 256,
  _source: "the GPU-memory contract (256 MB desktop): lod.js's own note, measured on Hoth for lane L; ultra alone is fitted, the others keep main's sizes (Endor high 117 MB)",
});

export function fitMaps(maps, budget) {
  const size = Object.fromEntries(maps.map((m) => [m.slug, m.size]));
  if (!Number.isFinite(budget)) return size;
  const bytesOf = (m) => m.bytes[size[m.slug]] ?? 0;
  let total = maps.reduce((a, m) => a + bytesOf(m), 0);
  while (total > budget) {
    let pick = null;
    for (const m of maps) {
      if (size[m.slug] / 2 < m.floor || m.bytes[size[m.slug] / 2] == null) continue;
      if (!pick || (m.data && !pick.data) || (m.data === pick.data && (bytesOf(m) > bytesOf(pick) || (bytesOf(m) === bytesOf(pick) && m.slug < pick.slug)))) pick = m;
    }
    if (!pick) break;
    total -= bytesOf(pick);
    size[pick.slug] /= 2;
    total += bytesOf(pick);
  }
  return size;
}
