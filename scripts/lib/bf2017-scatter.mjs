// The game's terrain scatter, read and placed (fidelity lane N: docs/
// superpowers/specs/2026-10-10-battlefront-fidelity-design.md, "Lane N"; the
// plan laneN-scatter). The game grows grass, ferns, twigs, stones and
// backdrop trees at run time over its terrain's paint layers, from
// `maps/terrain_scatter/<terrain>.json`: per layer (its index in the
// TerrainData's `TerrainLayers`) a list of types, each a mesh, a density per
// quality level (instances a square metre), a scale range, wind numbers and
// dissolve factors. Where each layer is painted is the terrain's layer
// masks, which the export has not decoded (web/maps/README.md, "Terrain
// scattering"), so the mask is derived and scatter.json says
// `mask: 'derived'`:
//
// - which surface texture a layer is: the `surfaceShaders` keys are
//   `<bits>m_<bits><kind>__…`, a bit per paint layer, so a layer's texture is
//   the one that is in a combination exactly when its bit is (`surfaceOf`);
// - what that texture is (`kindOf`: rock, river, roots, mud, burnt, fern,
//   cover, floor, snow, sand…);
// - where such ground lies on this world (`RULES[world]`, in order, the
//   first that holds claims a texel): the heightmap's slope and height
//   against the field (lane Q2's src/lib/three/ground/masks.js, so the
//   scatter and the ground's layers agree), the canopy (the level's placed
//   trees a square metre), the play area (where the level places anything)
//   and the ground the game painted (not the pack's fill beyond it).
//   Nothing grows under a placed piece that stands above the ground (a
//   bunker's roof, a rock, a wall).
//
// Pure: scripts/bf2017-scatter.mjs reads the files and writes them.
//
//   surfaceOf(table) → [{ layer, texture, score }] (a texture per paint-layer bit)
//   kindOf(texture) → 'rock' | 'river' | …
//   typesOf(table) → [{ index, types: [{ mesh, file, density, scale, randomness, wind, dissolve }] }]
//   paintedOf(heights, frame) → Uint8Array (1 where the game painted the ground)
//   footprintOf(pieces, frame) → Uint8Array (1 under a placed piece standing above the ground)
//   claimOf(rules, ctx) → Uint8Array (a layer's index + 1 per texel, 0 for none)
//   scatterJson({ world, table, rules, mask, tex, meshes }) → scatter.json
//
// Every number from the records carries its `_source`; a number of the
// site's is a named constant here with its why.

import { softRange } from '../../src/lib/three/ground/masks.js';

// the game's quality levels to the site's tiers (the record's `Medium` is mid)
export const QUALITY = { low: 'Low', mid: 'Medium', high: 'High', ultra: 'Ultra' };
// a layer's texture is taken only when its bit and the texture go together
// in at least this share of the combinations (1 = always together)
export const SURFACE_SCORE = 0.5;
// the soft edges of a rule's ranges, as Q2's FEATHER: degrees, metres, and
// shares of the canopy and the play area
export const FEATHER = { slope: 4, height: 0.75, canopy: 0.1, play: 0.1 };
// the canopy: the level's placed trees within `radius` m, a tree every
// 1 / `full` square metres counting as a closed canopy (Endor's redwoods
// stand 20 to 25 m apart where the forest is thick)
export const CANOPY = { radius: 24, full: 0.002 };
// the play area: anything the level places within `radius` m, `full` pieces
// a square metre counting as wholly inside it
export const PLAY = { radius: 48, full: 0.004 };
// the pack's fill beyond the painted ground runs as straight streaks (the
// level script's fillEmpty copies the nearest painted texel along a row,
// a column or a diagonal): a run this long of one exact value is fill
export const FILL_RUN = 4;

const short = (name) => String(name).split('/').pop();
// a texture's name without its channel suffix (_NOH, _CS, _H, _N, _RGB…)
const stem = (name) => short(name).replace(/_(NOH|NS|NAM|CS|CA|N|H|R|RGB|RGBA|RGBM)(_\d+)?$/i, '');

export function surfaceOf(table) {
  const rows = [];
  for (const [key, names] of Object.entries(table?.surfaceShaders ?? {})) {
    const m = /^(\d+)m_/.exec(key);
    if (m) rows.push({ bits: Number(m[1]), names: new Set(names.map(short)) });
  }
  if (!rows.length) return [];
  const textures = [...new Set(rows.flatMap((r) => [...r.names]))];
  const top = Math.max(...rows.map((r) => r.bits));
  const out = [];
  for (let b = 0; 1 << b <= top; b++) {
    const on = rows.filter((r) => (r.bits >> b) & 1);
    const off = rows.length - on.length;
    if (!on.length) continue;
    let best = null;
    for (const t of textures) {
      const with_ = on.filter((r) => r.names.has(t)).length / on.length;
      const without = off ? rows.filter((r) => !((r.bits >> b) & 1) && r.names.has(t)).length / off : 0;
      const score = with_ - without;
      // (a tie goes to the layer's own normal set, the `_NOH` or `_N` its
      // combinations stack, over a height or mask map shared with it)
      const own = /_(NOH|N)(_\d+)?$/i.test(t);
      if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && own && !best.own)) best = { texture: t, score, own };
    }
    out.push({ layer: b, texture: best.score >= SURFACE_SCORE ? stem(best.texture) : null, score: +best.score.toFixed(3) });
  }
  return out;
}

const KINDS = [
  ['rock', /rock|stone|cliff|gravel|pebble/i],
  ['river', /river|water|wet|shore/i],
  ['roots', /root/i],
  ['mud', /mud|dirt|soil|path/i],
  ['burnt', /burnt|soot|ash/i],
  ['fern', /fern/i],
  ['cover', /clover|grass|moss|meadow/i],
  ['floor', /lea(f|ves)|needle|forest/i],
  ['snow', /snow|ice/i],
  ['sand', /sand|dune/i],
];
export function kindOf(texture) {
  if (!texture) return null;
  for (const [k, re] of KINDS) if (re.test(short(texture))) return k;
  return 'other';
}

const xy = (v) => [v?.x ?? 1, v?.y ?? 1];
const r4 = (n) => +Number(n).toFixed(4);

export function typesOf(table) {
  const name = table?.terrain ?? '?';
  return (table?.layers ?? []).map((l) => ({
    index: l.index,
    types: (l.scatter ?? [])
      .filter((s) => s.mesh)
      .map((s) => ({
        mesh: s.mesh,
        file: s.file,
        id: s.Identifier ?? null,
        density: Object.fromEntries(Object.entries(QUALITY).map(([tier, q]) => [tier, r4(s.Density?.[q] ?? 0)])),
        scale: { min: xy(s.MinScale), max: xy(s.MaxScale) },
        randomness: s.ScaleRandomness ?? 1,
        firstSpawnLevel: s.FirstSpawnLevel ?? 0,
        wind: { scale: s.WindScale ?? 0, stiffness: s.Stiffness ?? 8, damping: s.Damping ?? 1, wiggle: s.WindWiggle ?? 0, mass: s.Mass ?? 1 },
        dissolve: {
          range: s.DissolveRangeRatio ?? 0.4,
          lod0Out: s.Lod0DissolveOutDistanceFactor ?? 0,
          lod1In: s.Lod1DissolveInDistanceFactor ?? 0,
          lod1Out: s.Lod1DissolveOutDistanceFactor ?? 0,
        },
        _source: `${name} layer ${l.index} TerrainMeshScatteringType ${s.Identifier ?? '?'} (Density.${Object.values(QUALITY).join('/')}, Min/MaxScale, ScaleRandomness, WindScale, Stiffness, Damping, WindWiggle, Mass, DissolveRangeRatio, Lod*Dissolve*)`,
      })),
    // (a layer whose types have no mesh in the visual resource: the README's problems)
    meshless: (l.scatter ?? []).filter((s) => !s.mesh).length,
  }));
}

// The ground the game painted: not a texel inside a run of FILL_RUN equal
// heights along a row, a column or a diagonal (the pack's fill), nor a hole
export function paintedOf(heights, { w, h }) {
  const out = new Uint8Array(w * h);
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  const at = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? NaN : heights[z * w + x]);
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const v = heights[z * w + x];
      if (Number.isNaN(v)) continue;
      let fill = false;
      for (const [dx, dz] of dirs) {
        // (the run through this texel, both ways)
        let n = 1;
        for (let k = 1; k < FILL_RUN && at(x + dx * k, z + dz * k) === v; k++) n++;
        for (let k = 1; k < FILL_RUN && at(x - dx * k, z - dz * k) === v; k++) n++;
        if (n >= FILL_RUN) {
          fill = true;
          break;
        }
      }
      out[z * w + x] = fill ? 0 : 1;
    }
  }
  return out;
}

// pieces: [{ x, z, yaw (radians), half: [hx, hz], top }] in the frame's
// metres; `top` the piece's highest point. A piece whose top is under the
// ground there (the bunker's buried halls) covers nothing.
export function footprintOf(pieces, { w, h, minX, minZ, metresPerPixel }, groundAt = null) {
  const out = new Uint8Array(w * h);
  for (const p of pieces) {
    if (groundAt && p.top < groundAt(p.x, p.z) + 0.05) continue;
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    const ex = Math.abs(c) * p.half[0] + Math.abs(s) * p.half[1];
    const ez = Math.abs(s) * p.half[0] + Math.abs(c) * p.half[1];
    const x0 = Math.max(0, Math.floor((p.x - ex - minX) / metresPerPixel));
    const x1 = Math.min(w - 1, Math.ceil((p.x + ex - minX) / metresPerPixel));
    const z0 = Math.max(0, Math.floor((p.z - ez - minZ) / metresPerPixel));
    const z1 = Math.min(h - 1, Math.ceil((p.z + ez - minZ) / metresPerPixel));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        // (the texel's centre in the piece's own axes)
        const dx = minX + x * metresPerPixel - p.x;
        const dz = minZ + z * metresPerPixel - p.z;
        const u = c * dx + s * dz;
        const v = -s * dx + c * dz;
        if (Math.abs(u) <= p.half[0] && Math.abs(v) <= p.half[1]) out[z * w + x] = 1;
      }
    }
  }
  return out;
}

// a texel's own number in 0…1, the same every run: the soft edges of the
// rules are dithered by it rather than blended (a texel is one layer's)
export function hash01(x, z) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// A rule: { layer (the paint layer's index), slope: [lo, hi] (degrees),
// height: [lo, hi] (metres against the field), canopy: [lo, hi] (0…1),
// play: [lo, hi] (0…1) }; a null end is open, a missing range always holds.
// ctx: { heights, slope, field, canopy, play, painted, built, frame }.
export function claimOf(rules, { heights, slope, field, canopy = null, play = null, painted = null, built = null, frame }) {
  const { w, h } = frame;
  const out = new Uint8Array(w * h);
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {
      const i = z * w + x;
      if (Number.isNaN(heights[i]) || (painted && !painted[i]) || (built && built[i])) continue;
      const rel = Number.isNaN(field[i]) ? 0 : heights[i] - field[i];
      const roll = hash01(x, z);
      for (const r of rules) {
        const hold = softRange(slope[i], r.slope, FEATHER.slope) * softRange(rel, r.height, FEATHER.height) * softRange(canopy ? canopy[i] : 0, r.canopy, FEATHER.canopy) * softRange(play ? play[i] : 0, r.play, FEATHER.play);
        if (hold > roll) {
          out[i] = r.layer + 1;
          break;
        }
      }
    }
  }
  return out;
}

// Each world's rules, in order (the first that holds claims a texel), by the
// layer's surface texture (`kind`, checked against surfaceOf when the JSON is
// written). A layer no rule names grows nothing, and the hand-off says so.
export const RULES = {
  // Hoth_01's terrain scatters nothing (0 types in the table): its rocks
  // and drifts are placed pieces, which the pack draws.
  hoth: { rules: [], _source: 'Hoth_01_Terrain: no TerrainMeshScatteringType in any layer' },
  endor: {
    rules: [
      // the stream beds beyond the battle (in it, the trail runs as low
      // under its field as a stream would): big stones where the ground lies
      // 4 m under its field
      { layer: 9, kind: 'river', height: [null, -4], slope: [null, 20], play: [null, 0.3] },
      // their banks: stones and logs
      { layer: 1, kind: 'river', height: [null, -2], slope: [null, 25], play: [null, 0.3] },
      // steep ground: the roots' twigs on the banks and hillsides
      { layer: 2, kind: 'roots', slope: [30, null] },
      // under the closed canopy: ferns and roots
      { layer: 6, kind: null, canopy: [0.5, null], play: [0.3, null] },
      // the forest's edge: the leaf litter's twigs and logs
      { layer: 0, kind: 'floor', canopy: [0.15, 0.5], play: [0.3, null] },
      // the clearings in the battle: clover and ferns
      { layer: 4, kind: 'cover', play: [0.3, null] },
      // the forest beyond the battle: the distant ferns and backdrop trees
      { layer: 7, kind: 'fern', play: [null, 0.3] },
    ],
    _source:
      'RULES.endor: derived (lane N). Layers by their surface textures (surfaceOf: 0 Leaves, 1 River, 2 Roots, 3 Mud, 4 Clover, 5 Burnt, 7 Ferns_Distance; 6 unmatched, named by what it grows: ferns and roots), placed by slope and height against the field (masks.js), the placed trees’ canopy and the play area; 3 (mud), 5 (burnt) and 8 left unplaced',
  },
};

export function scatterJson({ world, table, rules, mask, tex = {}, meshes = {}, surface = surfaceOf(table) }) {
  const layers = typesOf(table);
  const used = new Set(rules.rules.map((r) => r.layer));
  const byLayer = new Map(surface.map((s) => [s.layer, s]));
  return {
    format: 1,
    world,
    terrain: table?.terrain ?? null,
    _source: 'web/maps/terrain_scatter/<terrain>.json (scripts/bf2017-scatter.mjs); the mask derived by scripts/lib/bf2017-scatter.mjs',
    mask: 'derived',
    masks: mask,
    rules: rules.rules,
    rulesSource: rules._source,
    layers: layers.map((l) => {
      const s = byLayer.get(l.index);
      return {
        index: l.index,
        texture: s?.texture ?? null,
        kind: kindOf(s?.texture),
        placed: used.has(l.index),
        types: l.types.map((t) => ({ ...t, glb: meshes[t.mesh] ?? null })),
        meshless: l.meshless,
      };
    }),
    tex,
  };
}

// A type's look before its own maps are in the bucket: a card (a frond, a
// clover leaf, a twig, a backdrop tree's quad) is its colour map's alpha and
// is nothing without it, so it waits; a solid piece (a stone, a log, a dirt
// pile) draws in its kind's colour (linear RGB, judged against the forest
// floor's own textures) until its maps land and a re-run binds them.
export const CARD = /fern|clover|grass|twig|lea(f|ves)|backdroptree|plant|bush|flower/i;
export const SOLID_RGB = {
  stone: [0.2, 0.19, 0.17],
  wood: [0.13, 0.085, 0.055],
  dirt: [0.11, 0.075, 0.05],
  _source: 'SOLID_RGB: named (lane N) until the scatter meshes’ maps are encoded into the bucket',
};
export function lookOf(mesh, maps) {
  if (maps?.color) return { look: 'maps' };
  if (CARD.test(short(mesh))) return { look: 'waits', why: 'its colour map (a card’s alpha) is not in the bucket yet' };
  const kind = /stone|rock|pebble/i.test(short(mesh)) ? 'stone' : /dirt|mud|soil/i.test(short(mesh)) ? 'dirt' : 'wood';
  return { look: 'colour', rgb: SOLID_RGB[kind] };
}

// the textures.jsonl rows in a mesh's own folder: its colour and normal maps
// (a `_LOD_` map is the far card's, not drawn by the cuts shipped)
export function mapsOf(meshFile, index) {
  const folder = meshFile.split('/').slice(0, -1).join('/').toLowerCase().replace(/^models\//, '');
  const out = {};
  for (const [name, row] of index) {
    const file = String(row.file ?? '').toLowerCase();
    if (!file.startsWith(`textures/${folder}/`) || /_lod_/i.test(name)) continue;
    if (/_(c|cs|ca)$/i.test(name)) out.color ??= file.replace(/\.png$/, '.ktx2');
    else if (/_(n|ns|nam)$/i.test(name)) out.normal ??= file.replace(/\.png$/, '__normal.ktx2');
  }
  return out;
}

// A GLB whose materials take a colour and a normal map at the given URIs
// (KTX2 through KHR_texture_basisu, as the pack's other meshes name theirs):
// the scatter meshes bind theirs inside a shader asset the GLB does not
// carry. Alpha-tested where the colour is a card's. The binary chunk is
// untouched. Needs node's Buffer (the script's side).
export function bindMaps(glb, { color = null, normal = null, card = false }) {
  const head0 = 20 + glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, head0));
  json.images = [];
  json.textures = [];
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  const add = (uri) => {
    json.images.push({ uri, mimeType: 'image/ktx2' });
    json.textures.push({ sampler: 0, extensions: { KHR_texture_basisu: { source: json.images.length - 1 } } });
    return json.textures.length - 1;
  };
  const c = color ? add(color) : null;
  const n = normal ? add(normal) : null;
  for (const m of json.materials ?? []) {
    m.pbrMetallicRoughness ??= {};
    if (c !== null) m.pbrMetallicRoughness.baseColorTexture = { index: c };
    if (n !== null) m.normalTexture = { index: n };
    if (card) {
      m.alphaMode = 'MASK';
      m.alphaCutoff = 0.5;
      m.doubleSided = true;
    }
  }
  json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), ...(c !== null || n !== null ? ['KHR_texture_basisu'] : [])])];
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (text.length % 4)) % 4;
  if (pad) text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const rest = glb.subarray(head0);
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.write('JSON', 16, 'ascii');
  return Buffer.concat([head, text, rest]);
}
