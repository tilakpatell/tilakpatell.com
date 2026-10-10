// A game material's recipe, from its row in the export's material dump
// (web/materials.jsonl: per mesh, per material, its shader, its texture
// slots, vectors, bools and conditionals). Lane Q1:
// docs/superpowers/specs/2026-10-10-bf2017-surfaces-design.md, "Q1".
// Pure: the family table, the slot and parameter names and the defaults are
// src/lib/three/surface/families.js, which the material reads too.
//
//   recipeOf(row, materialIndex) → { family, shader, maps, params, _source }
//   recipesOf(row) → recipe[] (one per material, in the dump's order)
//   mapsWanted(recipes) → [{ name, kind }] (each map once; kind ∈ detail,
//     overlay, height, mask, emissive, array)
//   countFamilies(rows) → { family: materials }
//   candidatesOf(name, kind) → the map's objects in the bucket under web/, best first
//   colourIndex(rows) → Map(colour texture file name → { row, i }): each
//     material by the colour map it names
//   crewRecipes(glbJson, index) → { <material name>: recipe }: a crew pack's
//     materials (scripts/bf2017-import.mjs keeps the game's names and names
//     each image after its game texture), each found by its colour map
//
// Every leaf of `maps` and `params` has a `_source` keyed by its path:
// 'materials.jsonl:<mesh>#<i>.<slot or parameter>' when it is the dump's, or
// 'families.js:<CONSTANT>' when it is a named default. A material with no
// texture slots (the game bound it through its variation database; the GLB
// already carries its maps) is `family: 'glb'` with nothing on top.

import {
  ALPHA_CUTOFF,
  AOSLICE_LEVELS,
  COLOR_SLOTS,
  DETAIL_NORMAL,
  DETAIL_SMOOTHNESS,
  DETAIL_STRENGTH,
  DETAIL_TILING,
  FLAGS,
  GRUNGE_INTENSITY,
  MAP_KINDS,
  MAPS,
  OVERLAY_TILING,
  PARALLAX_SCALE,
  PARAMS,
  familyOf,
  slotsOf,
} from '../../src/lib/three/surface/families.js';

// where a map key sits in the recipe's `maps`
const MAP_PATHS = {
  breakupColor: 'breakup.color',
  breakupNormal: 'breakup.normal',
};
// families whose detail vectors carry one component per array slice
const PER_SLICE = new Set(['character', 'head', 'creature']);
const KIND_ORDER = ['detail', 'array', 'height', 'overlay', 'emissive', 'mask'];

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = value;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

// a conditional's value by its short name (the dump keys them by path)
function flagOf(m, name) {
  for (const [k, v] of Object.entries(m.conditionals ?? {})) if (k.split('/').pop() === name) return v;
  return undefined;
}

export function recipeOf(row, i) {
  const m = row.materials[i];
  const at = (p) => `materials.jsonl:${row.mesh}#${i}.${p}`;
  const slots = slotsOf(m.textures);
  const family = familyOf(m.shader, slots);
  const recipe = {
    family,
    shader: m.shader ?? null,
    maps: {},
    params: {},
    _source: {},
  };
  if (family === 'glb') return recipe;
  const set = (path, value, source) => {
    setPath(recipe, path, value);
    recipe._source[path] = source;
  };
  const vec = (path) => {
    for (const n of PARAMS[path]) if (m.vectors?.[n]) return [n, m.vectors[n]];
    return null;
  };
  const scalar = (path, into = `params.${path}`) => {
    const v = vec(path);
    if (v) set(into, v[1][0], at(v[0]));
    return v;
  };
  const rgb = (path, into = `params.${path}`) => {
    const v = vec(path);
    if (v) set(into, v[1].slice(0, 3), at(v[0]));
    return v;
  };
  const tiling = (path, into = `params.${path}`) => {
    const v = vec(path);
    if (v) set(into, [v[1][0], v[1][1] || v[1][0]], at(v[0]));
    return v;
  };
  const orDefault = (path, value, name) => {
    if (getPath(recipe, path) === undefined) set(path, value, `families.js:${name}`);
  };

  // the maps on top of the GLB's three
  // (a bare NS slot is a detail map only beside another normal slot, or when
  // its texture says Detail: a head's or a catwalk's own normal is NS too)
  const mainNormal = slots.some((x) => /^_?(Normals?|NW|NM|NMR|NAM|NA|N|T_Normal)(_texcoord\d)?$/i.test(x));
  const nsIsDetail = mainNormal || /Detail/i.test(m.textures.NS ?? '');
  for (const [key, names] of Object.entries(MAPS)) {
    const slot = names.find((n) => slots.includes(n) && (n !== 'NS' || nsIsDetail));
    if (slot) set(`maps.${MAP_PATHS[key] ?? key}`, m.textures[slot], at(slot));
  }
  // (every slice, each texel the one AOSlice's green names: four levels,
  // three slices and none; without an AOSlice map, the first)
  if (recipe.maps.detailArray) set('maps.detailSlice', recipe.maps.aoSlice ? 'aoSlice' : 0, at(recipe.maps.aoSlice ? 'AOSlice' : 'NormalDetailTextureArray'));
  // An emissive slot holds what its texture's suffix says: an emissive (_E,
  // _EM, _Emissive) is drawn as one, a mask (_M) as one channel; a colour
  // map (_C, _CA, _CS) or a packed normal is not drawn (the base colour glows)
  let emissiveKind = null;
  if (recipe.maps.emissive) {
    const name = recipe.maps.emissive;
    emissiveKind = /_E(M)?$|_Emissive$/i.test(name) ? 'texture' : /_M(ask)?$/i.test(name) ? 'mask' : null;
    if (!emissiveKind) {
      delete recipe.maps.emissive;
      delete recipe._source['maps.emissive'];
    }
  }

  // the detail normal
  const t = vec('detail.tiling');
  if (t && PER_SLICE.has(family) && recipe.maps.detailArray) {
    // (one component per slice: the slice's own once the median is known)
    set('params.detail.tiling', [t[1][0], t[1][0]], at(t[0]));
    set('params.detail.perSlice.tiling', t[1].slice(0, AOSLICE_LEVELS.length), at(t[0]));
    for (const p of ['normal', 'smoothness']) {
      const v = vec(`detail.${p}`);
      if (v) {
        set(`params.detail.${p}`, v[1][0], at(v[0]));
        set(`params.detail.perSlice.${p}`, v[1].slice(0, AOSLICE_LEVELS.length), at(v[0]));
      }
    }
  } else {
    tiling('detail.tiling');
    scalar('detail.normal');
    scalar('detail.smoothness');
  }
  scalar('detail.strength');
  if (recipe.maps.detail || recipe.maps.detailArray) {
    orDefault('params.detail.tiling', [DETAIL_TILING, DETAIL_TILING], 'DETAIL_TILING');
    orDefault('params.detail.normal', DETAIL_NORMAL, 'DETAIL_NORMAL');
    orDefault('params.detail.smoothness', DETAIL_SMOOTHNESS, 'DETAIL_SMOOTHNESS');
    orDefault('params.detail.strength', DETAIL_STRENGTH, 'DETAIL_STRENGTH');
    const uv1 = flagOf(m, FLAGS.uvSet) === 'TexCoord1' || m.bools?.Detail_UseUV2 === true;
    set('params.uvSet', uv1 ? 1 : 0, uv1 ? at(m.bools?.Detail_UseUV2 ? 'Detail_UseUV2' : FLAGS.uvSet) : 'families.js:MAPS');
  }

  // emissive: colour × intensity; a vector of three intensities is a colour
  const ei = vec('emissive.intensity');
  const ec = rgb('emissive.color');
  if (ei) {
    const [x, y, z] = ei[1];
    if (!ec && (y || z)) {
      const peak = Math.max(x, y, z) || 1;
      set('params.emissive.intensity', peak, at(ei[0]));
      set('params.emissive.color', [x / peak, y / peak, z / peak], at(ei[0]));
    } else set('params.emissive.intensity', x, at(ei[0]));
  }
  // (BlinkLength01 on, BlinkLength02 off, in seconds)
  const b1 = m.vectors?.BlinkLength01;
  const b2 = m.vectors?.BlinkLength02;
  if (b1) set('params.emissive.blink', b1[0], at('BlinkLength01'));
  if (b2) set(b1 ? 'params.emissive.blinkOff' : 'params.emissive.blink', b2[0], at('BlinkLength02'));
  if (ei || ec || emissiveKind) {
    const mode = flagOf(m, FLAGS.emissiveMode);
    const from = flagOf(m, FLAGS.emissiveFrom);
    if (mode === 'OneChannelMask' && recipe.maps.emissive) set('params.emissive.mode', 'mask', at(FLAGS.emissiveMode));
    else if (from === 'FromBaseColor') set('params.emissive.mode', 'baseColor', at(FLAGS.emissiveFrom));
    else if (emissiveKind) set('params.emissive.mode', emissiveKind, recipe._source['maps.emissive']);
    else set('params.emissive.mode', 'baseColor', 'families.js:MAPS');
    orDefault('params.emissive.color', [1, 1, 1], 'EMISSIVE_WHITE');
    orDefault('params.emissive.intensity', 1, 'EMISSIVE_ONE');
  }

  // colours
  rgb('paint');
  rgb('metal');
  rgb('tint');
  rgb('aoDirt');

  // overlays
  rgb('grunge.color');
  scalar('grunge.intensity');
  tiling('grunge.tiling');
  // (a grunge slot holding a normal map, named _N, _NM or _NW, is drawn as a normal)
  if (recipe.maps.grunge && /_N[MW]?$/i.test(recipe.maps.grunge)) set('params.grunge.normal', true, recipe._source['maps.grunge']);
  if (recipe.maps.grunge || recipe.params.grunge) {
    orDefault('params.grunge.color', [1, 1, 1], 'GRUNGE_WHITE');
    orDefault('params.grunge.intensity', GRUNGE_INTENSITY, 'GRUNGE_INTENSITY');
    orDefault('params.grunge.tiling', [OVERLAY_TILING, OVERLAY_TILING], 'OVERLAY_TILING');
  }
  tiling('scorch.tiling');
  scalar('scorch.ember');
  if (recipe.maps.scorch) orDefault('params.scorch.tiling', [OVERLAY_TILING, OVERLAY_TILING], 'OVERLAY_TILING');
  tiling('breakup.tiling');
  if (recipe.maps.breakup) orDefault('params.breakup.tiling', [OVERLAY_TILING, OVERLAY_TILING], 'OVERLAY_TILING');

  // flags
  const wreck = flagOf(m, FLAGS.wreck);
  if (wreck !== undefined) set('params.wreck', wreck === 'True', at(FLAGS.wreck));
  const pom = flagOf(m, FLAGS.parallax);
  if (recipe.maps.height) {
    const on = pom === 'True' || m.bools?.UsePOM === true || (pom === undefined && m.bools?.UsePOM !== false);
    set('params.parallax.on', on, pom !== undefined ? at(FLAGS.parallax) : m.bools?.UsePOM !== undefined ? at('UsePOM') : recipe._source['maps.height']);
    scalar('parallax.scale');
    orDefault('params.parallax.scale', PARALLAX_SCALE, 'PARALLAX_SCALE');
  }
  scalar('reflectance.up');
  scalar('reflectance.down');
  scalar('backface.subsurface');
  scalar('backface.smoothness');

  // cut-outs: the AlphaOnOff switch, else a colour + alpha map (_CA)
  const alpha = m.vectors?.AlphaOnOff;
  const caSlot = COLOR_SLOTS.find((s) => slots.includes(s) && /_CA$/i.test(m.textures[s]));
  if (alpha) set('params.alphaTest', alpha[0] > 0, at('AlphaOnOff'));
  else if (caSlot) set('params.alphaTest', true, at(caSlot));
  else set('params.alphaTest', false, 'families.js:COLOR_SLOTS');
  if (recipe.params.alphaTest) set('params.alphaCutoff', ALPHA_CUTOFF, 'families.js:ALPHA_CUTOFF');
  const twoSided = family === 'vegetation' || family === 'hair' || /DoubleSided|TwoSided/i.test(m.shader ?? '');
  set('params.doubleSided', twoSided, at('shader'));

  // hair: melanin (eumelanin, pheomelanin), the tip's tint along v, the strands' smoothness
  if (family === 'hair') {
    const mel = vec('hair.melanin');
    if (mel) set('params.hair.melanin', mel[1].slice(0, 2), at(mel[0]));
    const on = flagOf(m, FLAGS.melanin);
    if (on !== undefined) set('params.hair.melaninOn', on === 'True', at(FLAGS.melanin));
    rgb('hair.tip');
    scalar('hair.tipMin');
    scalar('hair.tipMax');
    scalar('hair.smoothness');
    scalar('hair.normalScale');
  }

  const blend = flagOf(m, FLAGS.terrainBlend) === 'True' || m.bools?.EnableTerrainBlend === true;
  if (blend) set('params.terrainBlend', true, at(m.bools?.EnableTerrainBlend ? 'EnableTerrainBlend' : FLAGS.terrainBlend));
  const weather = {
    top: [flagOf(m, FLAGS['weather.top']) === 'True', FLAGS['weather.top']],
    sand: [flagOf(m, FLAGS['weather.sand']) === 'True', FLAGS['weather.sand']],
    rain: [flagOf(m, FLAGS['weather.rain']) === 'True' || /Rain/i.test((m.shader ?? '').split('/').pop()), FLAGS['weather.rain']],
    use: [m.bools?.UseWeather === true, 'UseWeather'],
  };
  if (Object.values(weather).some(([on]) => on)) for (const [k, [on, name]] of Object.entries(weather)) set(`params.weather.${k}`, on, at(name));
  return recipe;
}

export const recipesOf = (row) => row.materials.map((_, i) => recipeOf(row, i));

export function mapsWanted(recipes) {
  const seen = new Map();
  for (const r of recipes) {
    for (const [key, path] of Object.entries(MAPS).map(([k]) => [k, MAP_PATHS[k] ?? k])) {
      const name = getPath(r.maps, path);
      if (typeof name === 'string' && !seen.has(name)) seen.set(name, MAP_KINDS[key]);
    }
  }
  return [...seen].map(([name, kind]) => ({ name, kind })).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
}

export function countFamilies(rows) {
  const out = {};
  for (const row of rows) for (const r of recipesOf(row)) out[r.family] = (out[r.family] ?? 0) + 1;
  return out;
}

// A game texture's objects in the bucket, best first: a detail map as the
// export rebuilt it (__normal), else as encoded; an array's first slice (one
// texture per material: the spec's C2); any other map only as encoded (a
// packed normal + emissive rebuilt as a normal has lost its emissive)
export function candidatesOf(name, kind) {
  const base = `textures/${name.toLowerCase()}`;
  if (kind === 'array') return [`${base}_000__normal.ktx2`, `${base}_000.ktx2`];
  if (kind === 'detail') return [`${base}__normal.ktx2`, `${base}.ktx2`];
  return [`${base}.ktx2`];
}

// a texture's file name as the index keys it: lower case, no folder, no
// extension and none of the export's suffixes (__normal, __orm_<hash>)
const fileKey = (name) =>
  String(name ?? '')
    .split('/')
    .pop()
    .toLowerCase()
    .replace(/\.(ktx2|png|webp|jpe?g)$/, '')
    .replace(/__(normal|orm_[0-9a-f]+)$/, '');

export function colourIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    row.materials.forEach((m, i) => {
      for (const slot of COLOR_SLOTS) {
        const t = m.textures?.[slot];
        if (t && !index.has(fileKey(t))) index.set(fileKey(t), { row, i });
      }
    });
  }
  return index;
}

export function crewRecipes(glb, index) {
  const out = {};
  for (const m of glb.materials ?? []) {
    const ref = m.pbrMetallicRoughness?.baseColorTexture;
    if (!ref || !m.name) continue;
    const t = glb.textures?.[ref.index];
    const src = t?.extensions?.KHR_texture_basisu?.source ?? t?.source;
    const img = glb.images?.[src];
    const hit = index.get(fileKey(img?.name ?? img?.uri));
    if (hit) out[m.name] = recipeOf(hit.row, hit.i);
  }
  return out;
}
