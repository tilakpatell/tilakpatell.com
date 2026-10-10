// A level's ground layers, read from the game (lane Q2: docs/superpowers/
// specs/2026-10-10-bf2017-surfaces-design.md, "The ground"). A terrain's
// `surfaceShaders` (web/maps/terrain_scatter/<terrain>.json) list, per paint
// layer combination, the tiling textures the game blends there: a stack of
// detail normals over a sparkle map on the snow worlds. Which layer lies
// where is the game's mask, not decoded yet, so ground.json says
// `mask: 'derived'` and carries the rules src/lib/three/ground/masks.js
// derives it by; when the desktop decodes the real masks it says 'game' and
// the PNG comes from the export, and nothing that reads it changes.
//
// Pure: scripts/bf2017-ground.mjs reads the files and writes them.
//
//   readTextureIndex(jsonl) → Map(name → { width, height, format, file })
//   layersOf(scatterJson, index, { tileM }) → [{ id, normals: [names], sparkle, tile }]
//   groundJson({ world, scatter, index, masks, have }) → ground.json
//   packMasks([Float32Array × ≤ 4], n) → Uint8Array (RGB: three layers a channel, the last the rest)
//   slugOf(name) → the bucket's file name, lower case, no folder
//   kindOf(name) → 'packed' | 'rocky' | 'rough' | 'chunky' | …

// metres a 2,048 px detail normal tiles over, per world. The game's terrain
// detail is 0.5 m a pixel at its finest tile; the layer shader's own tiling
// is in the shader block the desktop has not read, so this is judged on the
// shot against the game's ground (the owner's screenshot) until it does.
export const TILE_M = {
  hoth: {
    m: 4,
    _source: 'TILE_M: judged on the shot (lane Q2); the layer shader’s tiling unread',
  },
};
const TILE_PX = 2048;
// the sparkle's own tile: its 512 px over a metre, a glint a couple of millimetres
export const SPARKLE_TILE_M = 1;
// roughness per layer kind, until the layer shaders' smoothness maps are read
// (packed snow is wind-polished, rock and chunks rougher)
export const ROUGHNESS = {
  packed: 0.55,
  rocky: 0.7,
  rough: 0.6,
  chunky: 0.65,
  snow: 0.6,
};
// metres: past `start` the detail stack fades to the macro colour, gone by
// `end` (a 4 m tile is under a pixel by then at 1080p)
export const FADE = {
  start: 300,
  end: 450,
  _source: 'FADE: the design’s 300 m (spec §4, Q2); the end judged on the shot',
};
// how sharp the height blend is: (mask × height)^4, normalised (Review Focus 2)
export const HEIGHT_SHARPNESS = 4;

// Each world's layers, in rule order (the first rule that holds claims a
// pixel; the last takes the rest), and the colour of its ground far off.
export const RULES = {
  hoth: {
    layers: {
      rocky: 'T_ArcticBase_SnowRockyPacked_04_N',
      chunky: 'T_ArcticBase_SnowChunkyWind_01_N',
      rough: 'T_ArcticBase_SnowRoughPacked_03_N',
      packed: 'T_ArcticBase_SnowPacked_04_N',
    },
    rules: [
      // the ridges' faces
      { layer: 'rocky', slope: [30, null] },
      // the trenches: 2 m under the field and near level
      { layer: 'chunky', slope: [null, 15], height: [null, -2] },
      // the hangar's apron: where the level places its meshes thickly
      { layer: 'rough', density: 'high' },
      // the open field
      { layer: 'packed' },
    ],
    _source: 'RULES.hoth: lane Q2’s plan, Review Focus 1 (slope from the heightmap, height against the field, the placed meshes’ density); the game’s masks undecoded',
    // the weather's EnlightenComponentData (VE_Sky_Arctic_Sunny_01): the
    // ground's colour as the game's bounce sees it, until the colour map is decoded
    macro: {
      color: [0.547, 0.594, 0.644],
      _source: 'VE_Sky_Arctic_Sunny_01 EnlightenComponentData.TerrainColor (spec §3)',
    },
    sparkle: true,
  },
};

export const slugOf = (name) => name.split('/').pop().toLowerCase();
const short = (name) => name.split('/').pop();

export function kindOf(name) {
  const n = short(name).toLowerCase();
  for (const k of ['rocky', 'chunky', 'rough', 'packed']) if (n.includes(k)) return k;
  return 'snow';
}

export function readTextureIndex(jsonl) {
  const out = new Map();
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    out.set(short(r.name), {
      width: r.width,
      height: r.height,
      format: r.format,
      file: r.file,
    });
  }
  return out;
}

export const tileOf = (px, tileM) => (px ? (tileM * px) / TILE_PX : tileM);

const isNormal = (name) => /_N$/.test(short(name));
const isSparkle = (name) => /sparkle/i.test(short(name));

export function layersOf(scatter, index, { tileM = TILE_M.hoth.m } = {}) {
  const shaders = scatter?.surfaceShaders ?? {};
  const fallback = (shaders.defaultterrainsurfaceshader ?? []).map(short).find(isSparkle) ?? null;
  return Object.entries(shaders)
    .filter(([id]) => id !== 'defaultterrainsurfaceshader')
    .map(([id, names]) => {
      const normals = names.filter(isNormal).map(short);
      return {
        id,
        normals,
        sparkle: names.map(short).find(isSparkle) ?? fallback,
        tile: tileOf(index.get(normals[0])?.width, tileM),
      };
    });
}

export function groundJson({ world, scatter, index, masks, have = {}, stats = {} }) {
  const spec = RULES[world];
  if (!spec) throw new Error(`no ground rules for ${world}: add them to RULES`);
  const tile = TILE_M[world] ?? TILE_M.hoth;
  const combos = layersOf(scatter, index, { tileM: tile.m });
  const named = new Set(combos.flatMap((c) => c.normals));
  const missing = [];
  if (spec.rules.length > 4) throw new Error(`${world}: four layers at most (three channels and the rest)`);
  const layers = spec.rules.map((r, i) => {
    const channel = i < spec.rules.length - 1 ? i : null;
    const name = spec.layers[r.layer];
    if (!named.has(name)) throw new Error(`${world}: the terrain names no ${name} (rule ${r.layer})`);
    const t = index.get(name) ?? {};
    const map = have[slugOf(name)] ?? null;
    if (!map) missing.push(name);
    const kind = kindOf(name);
    // (the map's blue a height where it varies; its alpha a smoothness
    // where it varies and is not the encoder's constant white)
    const st = stats[slugOf(name)] ?? null;
    const height = Boolean(st && st.b.sd > BLUE_FLAT);
    const smoothness = st && st.a.sd > BLUE_FLAT && st.a.mean < 0.98 ? +st.a.mean.toFixed(3) : null;
    return {
      id: r.layer,
      name,
      channel,
      map,
      size: t.width ?? null,
      format: t.format ?? null,
      tile: tileOf(t.width, tile.m),
      combos: combos.filter((c) => c.normals.includes(name)).length,
      height,
      smoothness,
      roughness: {
        value: ROUGHNESS[kind],
        _source: `ROUGHNESS.${kind}: named until the layer shaders are read`,
      },
    };
  });
  const sparkleName = spec.sparkle ? (combos.find((c) => c.sparkle)?.sparkle ?? null) : null;
  if (sparkleName && !have[slugOf(sparkleName)]) missing.push(sparkleName);
  return {
    world,
    terrain: scatter.terrain,
    _source: 'web/maps/terrain_scatter/<terrain>.json surfaceShaders (scripts/bf2017-ground.mjs); masks by src/lib/three/ground/masks.js',
    mask: 'derived',
    masks,
    rules: spec.rules,
    rulesSource: spec._source,
    tile: { m: tile.m, _source: tile._source },
    layers,
    sparkle: sparkleName && {
      name: sparkleName,
      map: have[slugOf(sparkleName)] ?? null,
      tile: SPARKLE_TILE_M,
      _source: 'the terrain’s defaultterrainsurfaceshader; SPARKLE_TILE_M named',
    },
    macro: spec.macro,
    fade: FADE,
    // (by height where a layer map's blue carries one, read from the maps
    // fetched; the mask alone until they are)
    blend: {
      mode: layers.some((l) => l.height) ? 'height' : 'mask',
      sharpness: HEIGHT_SHARPNESS,
      _source: 'HEIGHT_SHARPNESS; mode from the layer maps’ blue channel (BLUE_FLAT), the mask alone where no map is read',
    },
    channels: { _source: 'the Arctic _N maps decoded: R, G the normal; B a height (the combinations’ displacement2d); A a smoothness, a constant 255 in some' },
    combos: combos.length,
    missing,
  };
}

// Review Focus 2: a blue channel that varies carries a height (the Arctic
// `_N` maps carry a height in blue); a constant one carries nothing
export const BLUE_FLAT = 4 / 255;
export function blendModeOf(blue) {
  let s = 0;
  let s2 = 0;
  for (const v of blue) {
    s += v;
    s2 += v * v;
  }
  const n = blue.length || 1;
  const sd = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
  return sd > BLUE_FLAT ? 'height' : 'mask';
}

// RGB, the first three layers a channel each; the last layer is what they
// leave (1 − r − g − b), so no layer lives in alpha, which a browser's
// decoder may premultiply into the colour and lose where it is 0
export function packMasks(masks, n) {
  const out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = masks[c] ? Math.round(Math.min(1, Math.max(0, masks[c][i])) * 255) : 0;
  return out;
}
