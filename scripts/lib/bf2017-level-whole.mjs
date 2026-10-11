// A whole level (lane G2: docs/superpowers/specs/2026-10-10-bf2017-galaxy-
// on-the-game-design.md, decision 4): the game world draws the level as the
// game has it, in the map's own frame, so a spawn, a volume or a light from
// the rulebooks lands where the game put it. Beside the roam packs (cut
// round a spot in the site's frame, lane E0's), a whole pack keeps every
// sub-level of the level but the ones the game draws somewhere else (the
// lobby, the end of round, the cinematics and outros, the automation
// layers) and the other times of day; the mode layers are kept for their
// art, and the meshes only a mode layer places are listed by layer
// (`modeOnly`) so a mode can hide the others' props. No budget row: a
// thing is drawn out to WHOLE_K radii (low to LOW_K: its far cut beyond a
// few hundred metres). Pure: scripts/bf2017-level.mjs --whole reads, fetches
// and writes.
//
//   wholeSubs(map, { weather }) → { subs, weather, skipped }  (subs by their last name, lower case)
//   modeOnlyOf(map, subs) → { [sub]: [mesh] } (the mode layers' own meshes)
//   wholeExtent(map, indices, { trim, pad }) → { min: [x, z], max: [x, z] } (the pieces' middle mass)
//   wholeCull(tiers) → { [tier]: { K, dropped: [] } }
//   WHOLE_ROWS: the rows a whole pack is measured against (none binds)

const last = (path) => String(path?.name ?? path).split('/').pop().toLowerCase();

// what the game draws somewhere else: the lobby and its split screen, the
// end of round, cinematics, the intros and outros, and the automation layers
export const ELSEWHERE = /^(lobby.*|eor.*|cinematics.*|outro.*|.*_automation|.*intro)$/;
// the times of day and the weathers a level carries as their own layers
// (Endor's Sunny and Night, Tatooine's Lighting_Night, Naboo's Cloudy,
// Sunset and Dusk, Kamino's Stormy): one is drawn
export const WEATHER = /^(lighting_)?(sunny|sunset|night|stormy|cloudy|dusk|dawn|foggy|fog|rain|snow|overcast)$/;
// the mode layers: kept, their own meshes listed by layer
export const MODE = /^(fantasybattle|fb_|mode|heroarena|heroesvsvillains|teamdeathmatch|planetarymissions|domination|gamemodes|extraction|smallmodesprops)/;

export const WHOLE_K = 1000; // radii: a 1 m thing to a kilometre
export const LOW_K = 400; // radii on low: beyond, a thing is its far cut or gone
// (no row binds: the table measures what a place costs, nothing is fitted)
export const WHOLE_ROWS = Object.fromEntries(['low', 'mid', 'high', 'ultra'].map((t) => [t, { tris: Infinity, calls: Infinity }]));

export function wholeSubs(map, { weather = 'sunny' } = {}) {
  const names = [...new Set(map.subworlds.map(last))];
  const skipped = names.filter((s) => ELSEWHERE.test(s));
  const weathers = names.filter((s) => WEATHER.test(s));
  // (the asked one; else the first the map has: Naboo has no sunny layer)
  const want = String(weather).toLowerCase();
  const picked = weathers.find((s) => s.replace(/^lighting_/, '') === want) ?? weathers[0] ?? null;
  skipped.push(...weathers.filter((s) => s !== picked));
  return { subs: names.filter((s) => !skipped.includes(s)), weather: picked, skipped };
}

export function modeOnlyOf(map, subs) {
  const want = new Set(subs.map(last));
  const bySub = new Map(); // sub → meshes it places
  for (const g of map.groups) {
    const sub = last(map.subworlds[g.sub]);
    if (!want.has(sub) || g.kind === 'actor') continue;
    if (!bySub.has(sub)) bySub.set(sub, new Set());
    bySub.get(sub).add(g.mesh);
  }
  const art = new Set();
  for (const [sub, meshes] of bySub) if (!MODE.test(sub)) for (const m of meshes) art.add(m);
  const out = {};
  for (const [sub, meshes] of [...bySub].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!MODE.test(sub)) continue;
    const own = [...meshes].filter((m) => !art.has(m)).sort((a, b) => a - b);
    if (own.length) out[sub] = own;
  }
  return out;
}

// The middle mass of the pieces (a `trim` share cut off each side, so a
// skybox ring or a far mountain does not set it), padded: where the ground
// is drawn fine and the navgrid laid
export function wholeExtent(map, indices, { trim = 0.01, pad = 128 } = {}) {
  if (!indices.length) return { min: [-pad, -pad], max: [pad, pad] };
  const xs = Float64Array.from(indices, (i) => map.instances.position[i * 3]).sort();
  const zs = Float64Array.from(indices, (i) => map.instances.position[i * 3 + 2]).sort();
  const at = (a, q) => a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))];
  return { min: [Math.floor(at(xs, trim) - pad), Math.floor(at(zs, trim) - pad)], max: [Math.ceil(at(xs, 1 - trim) + pad), Math.ceil(at(zs, 1 - trim) + pad)] };
}

export const wholeCull = (tiers) => Object.fromEntries(tiers.map((t) => [t, { K: t === 'low' ? LOW_K : WHOLE_K, dropped: [] }]));

// The arena a whole pack needs: every piece inside it (the pack's frame is
// the map's, so the arena is round the map's 0, not the pieces' middle)
export function wholeArena(map, indices) {
  let r = 0;
  for (const i of indices) r = Math.max(r, Math.abs(map.instances.position[i * 3]), Math.abs(map.instances.position[i * 3 + 2]));
  return Math.ceil(r + 1);
}
