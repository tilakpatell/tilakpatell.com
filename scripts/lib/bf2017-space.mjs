// The game's space levels as the space layer's set pieces (lane Q of the
// fifth design: docs/superpowers/specs/2026-10-10-bf2017-every-asset-
// design.md §3). A space map (`SB_*`, read by bf2017-level.mjs's readMap)
// places its capital ships as kits of dozens of parts (the Star Destroyer's
// hull, bridge, engines and side details are each a model), its dry dock and
// its platforms as hundreds, and its debris one rock at a time. This groups
// them: a kit's parts round the nearest of its anchors (a hull) become one
// model in that hull's frame, placed wherever the map places the hull; an
// area kit (the Fondor dry dock, the Kamino platforms) is one model about
// its own middle; anything else is a model of its own. Pure: the CLI
// (scripts/bf2017-space.mjs) fetches, imports and writes.
//
//   SPACE: system → { map, subs } (the five usable maps; the era rule keeps
//     SB_Resurgent_01 and SB_SpaceBear_01 out)
//   KITS: the kits, in the order they're tried
//   kindOf(file) → 'capital' | 'station' | 'backdrop' | 'rock' | null (left out)
//   piecesOf(map, { subs, kindOf, kits, system, minSize }) →
//     { centre, radius, models: { slug: { kind, as, kit, size, parts: [{ file, at, quaternion, scale }] } },
//       pieces: [{ model, kind, at, quaternion, scale, track? }], dropped }
//   a piece is in the space layer's units (UNIT: a metre is a hundredth of
//   one, so the game's 1,600 m Star Destroyer is the site's 16) about the
//   level's middle; a model's parts in metres in the model's own frame.

import { isSequel } from './bf2017-manifest.mjs';

export const UNIT = 0.01;

// which map each system's space is (the Separatist blockade, the droid
// battleship map, is Naboo's: the Trade Federation's blockade of it) and
// which of its sub-levels: the scenery (`Art`, `Art_LargeGameMode`), the
// starfighter assault's fleets (`SpaceBattle`) and the hero starfighters'
// (`Mode7`); never the lobby, the intros and outros, the split screen
export const SPACE = {
  endor: { map: 'levels/space/sb_endor_01/sb_endor_01', title: 'the Imperial fleet over Endor' },
  fondor: { map: 'levels/space/sb_fondor_01/sb_fondor_01', title: 'the Fondor shipyards' },
  kamino: { map: 'levels/space/sb_kamino_01/sb_kamino_01', title: 'the Republic fleet over Kamino' },
  naboo: { map: 'levels/space/sb_droidbattleship_01/sb_droidbattleship_01', title: 'the Separatist blockade' },
};
export const SUBS = ['art', 'art_largegamemode', 'spacebattle'];

// a kit: the parts its `test` names, gathered round the nearest `anchor`
// (null: one model of each lot, about its middle; `span`: the ship's length
// in metres, its parts gathered within 0.6 of it of the anchor; `minPart`: metres, the
// parts under it left out). Kamino's platforms are not one: they stand on
// the sea under SB_Kamino_01's fleets, and the sea is the surface's (lane E2)
export const KITS = [
  { kit: 'isd', kind: 'capital', span: 1650, as: 'Imperial Star Destroyer', test: /_galacticempire\/stardestroyer_01\//, anchor: /stardestroyer_hull_01(_sb_endor)?_mesh/ },
  { kit: 'mc80', kind: 'capital', span: 1250, as: 'MC80 Mon Calamari cruiser', test: /capital\/mc80\//, anchor: /mc80_mainhull_01_mesh/ },
  { kit: 'arquitens', kind: 'capital', span: 420, as: 'Arquitens-class light cruiser', test: /capital\/imperialcruiser\//, anchor: /imperialcruiser_hull_01_mesh/ },
  { kit: 'venator', kind: 'capital', span: 1450, as: 'Venator-class Star Destroyer', test: /venatorclass_stardestroyer\//, anchor: /venatorstardestroyer_hull_01_mesh/ },
  { kit: 'lucrehulk', kind: 'capital', span: 3300, as: 'Lucrehulk-class droid control ship', test: /lucrehulkclass_droidbattleship\//, anchor: /lucrehulkclass_droidbattleship_mainhull_01_mesh/ },
  { kit: 'jedicruiser', kind: 'capital', span: 420, as: 'Arquitens-class command cruiser (the Republic’s)', test: /capital\/jedicruiser\//, anchor: /jedicruiser_hull_01_mesh|jedicruiser_[a-z]*hull[a-z_0-9]*_mesh/ },
  { kit: 'drydock', kind: 'dock', as: 'Fondor orbital dry dock', test: /capital\/fondor_drydock\//, anchor: null, minPart: 40 },
];

// what never draws as itself: the game's collision stand-ins, the shields'
// and lights' effect shells, decals, the lobby's set, the pilots
const NEVER = /collision|occluder|healthstate|vfx_shield|fx\/|_decals?\/|capital\/decals|frontend|pilots\/|enlighten|despawn|leftover|lightcone|shadowplane/i;

// a model's kind by its path (null: left out). The planets' own meshes are
// the site's bodies.js's to draw (lane K's skins): a map's moon is left out.
export function kindOf(file) {
  const f = String(file).toLowerCase();
  if (NEVER.test(f) || isSequel(f)) return null;
  if (/\/planet\/(moon|planet)_/.test(f)) return null;
  if (/deathstar_debris|asteroid|\/rocks?\//.test(f)) return 'rock';
  if (/\/planet\/|backdropassets|destruction|_battlebeyond|cinematics\/spacebattles/.test(f)) return 'backdrop';
  if (/satellite|spacebattles\/endor_mine|silo_xl/.test(f)) return 'station';
  if (/gameplay\/vehicles\/(capital|corvette)\/|landmarks\/_separatists\/|landmarks\/_rebelalliance\//.test(f)) return 'capital';
  return null;
}

// ── quaternions, [x, y, z, w] ──
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
export const rotate = (q, v) => {
  const t = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q));
  return [t[0], t[1], t[2]];
};
const r = (x, k = 1000) => Math.round(x * k) / k;
const nonZero = (x) => (Math.abs(x) < 1e-9 ? 1e-9 : x);

// an instance's transform out of readMap's arrays
export function instanceOf(map, i) {
  const { position: P, quaternion: Q, scale: S } = map.instances;
  const q = [Q[i * 4] / 32767, Q[i * 4 + 1] / 32767, Q[i * 4 + 2] / 32767, Q[i * 4 + 3] / 32767];
  const n = Math.hypot(...q) || 1;
  return { i, mesh: map.meshOf[i], at: [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], quaternion: q.map((v) => v / n), scale: [S[i * 3], S[i * 3 + 1], S[i * 3 + 2]] };
}
// a mesh's biggest side, metres
export const sizeOf = (mesh) => (mesh?.min && mesh?.max ? Math.max(...mesh.max.map((v, k) => v - mesh.min[k])) : 0);
const last = (p) => String(p).split('/').pop().toLowerCase();
export const slugOf = (file) => last(file).replace(/\.glb$/, '').replace(/_mesh$/, '').replace(/[^a-z0-9]+/g, '-');

// a member in its anchor's frame (the anchor's scale taken as it is, per axis)
function relative(anchor, m) {
  const inv = qinv(anchor.quaternion);
  const d = rotate(inv, [m.at[0] - anchor.at[0], m.at[1] - anchor.at[1], m.at[2] - anchor.at[2]]);
  return { at: d.map((v, k) => r(v / nonZero(anchor.scale[k]))), quaternion: qmul(inv, m.quaternion).map((v) => r(v, 1e4)), scale: m.scale.map((v, k) => r(v / nonZero(anchor.scale[k]))) };
}

// an area kit's parts in lots, each part within `link` metres of another of
// its lot (the dry dock and a second one the map stands far off are two)
export function clusters(xs, link) {
  const up = xs.map((_, i) => i);
  const find = (i) => (up[i] === i ? i : (up[i] = find(up[i])));
  const cell = new Map();
  const key = (a) => a.map((v) => Math.floor(v / link)).join(',');
  xs.forEach((x, i) => (cell.get(key(x.at)) ?? cell.set(key(x.at), []).get(key(x.at))).push(i));
  xs.forEach((x, i) => {
    const c = x.at.map((v) => Math.floor(v / link));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of cell.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) ?? []) {
            if (j <= i) continue;
            const y = xs[j];
            if (Math.hypot(x.at[0] - y.at[0], x.at[1] - y.at[1], x.at[2] - y.at[2]) <= link) up[find(j)] = find(i);
          }
  });
  const lots = new Map();
  xs.forEach((x, i) => (lots.get(find(i)) ?? lots.set(find(i), []).get(find(i))).push(x));
  return [...lots.values()].sort((a, b) => b.length - a.length);
}

// the asteroid track a rock turns on, by its size (the game's three:
// animtracks/a3/objects/props/objectsets/_generic/asteroid_{large,medium,small}_01)
export const trackOf = (metres) => (metres > 200 ? 'large' : metres > 60 ? 'medium' : 'small');

export function piecesOf(map, { subs = SUBS, kits = KITS, kind = kindOf, system = '', minSize = 20 } = {}) {
  const want = new Set([...subs, last(map.name)]);
  const files = map.meshes.map((m) => String(m.file ?? ''));
  const dropped = { sub: 0, never: 0, small: 0, stray: 0, twice: 0 };
  // every kept instance, once (Mode7 and SpaceBattle place most of a fleet twice, at one spot)
  const seen = new Set();
  const kept = [];
  for (const g of map.groups) {
    if (!want.has(last(map.subworlds[g.sub]))) {
      dropped.sub += g.count;
      continue;
    }
    for (let i = g.first; i < g.first + g.count; i++) {
      const x = instanceOf(map, i);
      const key = `${x.mesh}:${x.at.map((v) => Math.round(v)).join(',')}`;
      if (seen.has(key)) {
        dropped.twice++;
        continue;
      }
      seen.add(key);
      if (g.kind === 'actor') {
        dropped.never++;
        continue;
      }
      kept.push(x);
    }
  }
  const kitOf = (file) => (NEVER.test(file) || isSequel(file) ? null : kits.find((k) => k.test.test(file.toLowerCase())) ?? null);
  const byKit = new Map();
  const loose = [];
  for (const x of kept) {
    const k = kitOf(files[x.mesh]);
    if (k) (byKit.get(k) ?? byKit.set(k, []).get(k)).push(x);
    else loose.push(x);
  }
  const models = {};
  const pieces = [];
  const groups = []; // [{ kit, anchor, members }]
  for (const [k, xs] of byKit) {
    if (!k.anchor) {
      // (an area kit's parts under `minPart` metres are under a pixel from
      // anywhere the space layer flies; a lot of fewer than four is the
      // map's stray effect plane, not a structure)
      const big = xs.filter((x) => sizeOf(map.meshes[x.mesh]) * Math.max(...x.scale.map(Math.abs)) >= (k.minPart ?? 0));
      dropped.small += xs.length - big.length;
      for (const lot of clusters(big, k.link ?? 600)) {
        if (lot.length < 4) {
          dropped.stray += lot.length;
          continue;
        }
        const c = [0, 1, 2].map((a) => lot.reduce((s, x) => s + x.at[a], 0) / lot.length);
        groups.push({ kit: k, anchor: { at: c, quaternion: [0, 0, 0, 1], scale: [1, 1, 1], mesh: -1 }, members: lot });
      }
      continue;
    }
    const anchors = xs.filter((x) => k.anchor.test(files[x.mesh]));
    const own = anchors.map((a) => ({ kit: k, anchor: a, members: [a] }));
    for (const x of xs) {
      if (anchors.includes(x)) continue;
      let best = null;
      let bd = Infinity;
      for (const g of own) {
        const d = Math.hypot(x.at[0] - g.anchor.at[0], x.at[1] - g.anchor.at[1], x.at[2] - g.anchor.at[2]);
        const reach = 0.6 * (k.span ?? sizeOf(map.meshes[g.anchor.mesh])) * Math.max(...g.anchor.scale.map(Math.abs));
        if (d < bd && d <= reach) [best, bd] = [g, d];
      }
      if (best) best.members.push(x);
      else dropped.stray++;
    }
    groups.push(...own);
  }
  // a kit's groups of the same parts share one model (the second and third
  // Star Destroyers are the first one's, placed again)
  const variants = new Map();
  for (const g of groups) {
    const sig = `${g.kit.kit}|${g.members.map((m) => files[m.mesh]).sort().join(',')}`;
    if (!variants.has(sig)) {
      const n = [...variants.values()].filter((v) => v.kit === g.kit.kit).length;
      const slug = [system, g.kit.kit, n ? String(n + 1) : ''].filter(Boolean).join('-');
      const parts = g.members.map((m) => ({ file: files[m.mesh], ...relative(g.anchor, m) }));
      const extent = Math.max(...parts.map((p) => Math.hypot(...p.at) + (sizeOf(map.meshes[map.meshes.findIndex((mm) => mm.file === p.file)]) * Math.max(...p.scale.map(Math.abs))) / 2));
      models[slug] = { kind: g.kit.kind, kit: g.kit.kit, as: g.kit.as, size: r(extent * 2, 1), parts };
      variants.set(sig, { kit: g.kit.kit, slug });
    }
    pieces.push({ model: variants.get(sig).slug, kind: g.kit.kind, from: g.anchor });
  }
  for (const x of loose) {
    const file = files[x.mesh];
    const k = kind(file);
    if (!k) {
      dropped.never++;
      continue;
    }
    const metres = sizeOf(map.meshes[x.mesh]) * Math.max(...x.scale.map(Math.abs));
    if (metres < minSize) {
      dropped.small++;
      continue;
    }
    const slug = slugOf(file);
    models[slug] ??= { kind: k, kit: null, as: null, size: r(sizeOf(map.meshes[x.mesh]), 1), parts: [{ file, at: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }] };
    pieces.push({ model: slug, kind: k, from: x, ...(k === 'rock' ? { track: trackOf(metres) } : {}) });
  }
  // about the middle of what isn't backdrop or rock (the fleets, the dock, the
  // platforms), in the space layer's units
  const core = pieces.filter((p) => p.kind !== 'rock' && p.kind !== 'backdrop');
  const mid = core.length ? core : pieces;
  const centre = [0, 1, 2].map((a) => (mid.length ? mid.reduce((s, p) => s + p.from.at[a], 0) / mid.length : 0));
  const out = pieces.map(({ from, ...p }) => ({
    ...p,
    at: from.at.map((v, a) => r((v - centre[a]) * UNIT, 100)),
    quaternion: from.quaternion.map((v) => r(v, 1e4)),
    scale: from.scale.map((v) => r(v * UNIT, 1e6)),
  }));
  const radius = out.filter((p) => p.kind !== 'backdrop').reduce((m, p) => Math.max(m, Math.hypot(...p.at) + (models[p.model].size * Math.max(...p.scale.map(Math.abs))) / 2), 0);
  return { centre: centre.map((v) => r(v, 10)), radius: r(radius, 10), models, pieces: out, dropped };
}
