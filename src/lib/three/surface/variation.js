// A mesh's variation over its recipe (lane colour: docs/superpowers/specs/
// 2026-10-10-bf2017-accuracy-design.md, §3 "Lane colour"). A level pack's
// variations.json (scripts/lib/bf2017-variations.mjs) gives each material
// of a varied mesh the ObjectVariation's plain-named vectors and
// conditionals; this reads them through the recipe's own parameter and flag
// names (families.js's PARAMS and FLAGS), so a variation tints, lights or
// wrecks a material exactly where the dump's own parameter would. Pure.
//
//   variationParams(params, variation) → params with the variation's numbers
//     (variation: { vectors?: { name: [x, y, z, w] }, conditionals?: { name: 'True' | 'False' }, snow? })
//   SNOW_FULL: weather.js's params for snow already settled (a `_Snow`
//     variation is snowed from the start, not over the weather's seconds)

import { FLAGS, PARAMS } from './families.js';

// the params that are a colour, a tiling, or one number
const RGB = new Set(['paint', 'metal', 'tint', 'emissive.color', 'grunge.color', 'aoDirt', 'hair.tip']);
const TILING = /\.tiling$/;

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] = { ...(o[k] ?? {}) };
  o[keys.at(-1)] = value;
}

export function variationParams(params, variation) {
  if (!variation) return params;
  const out = { ...params };
  const v = variation.vectors ?? {};
  for (const [path, names] of Object.entries(PARAMS)) {
    const name = names.find((n) => v[n]);
    if (!name) continue;
    const [x, y, z, w] = v[name];
    if (path === 'emissive.intensity' && (y || z || w)) {
      // (a colour-typed intensity, the variations' EmissiveIntensety, w 1
      // where a scalar's is 0: the brightest channel, the colour its share)
      const peak = Math.max(x, y, z);
      setPath(out, 'emissive.intensity', peak);
      if (peak > 0) setPath(out, 'emissive.color', [x / peak, y / peak, z / peak]);
    } else if (RGB.has(path)) setPath(out, path, [x, y, z]);
    else if (TILING.test(path)) setPath(out, path, [x, y || x]);
    else setPath(out, path, x);
  }
  const c = variation.conditionals ?? {};
  for (const [path, name] of Object.entries(FLAGS)) {
    if (c[name] === undefined || !['wreck', 'weather.top', 'weather.sand', 'weather.rain'].includes(path)) continue;
    setPath(out, path, c[name] === 'True');
  }
  if (variation.snow) setPath(out, 'weather.snow', true);
  return out;
}

export const SNOW_FULL = { range: [0, 1], exponent: 1, indoor: 0, disableIndoor: false, initial: 1, target: 1, seconds: 0, keep: false };
