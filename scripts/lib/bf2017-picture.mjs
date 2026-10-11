// The pure half of scripts/bf2017-picture.mjs (lane Q6): a VisualEnvironment
// record's objects by component, the textures its picture names, and the
// painted sky's horizon row measured off the decoded texture.

import { cloudShadowOf, panoramaOf } from '../../src/lib/three/light/grade.js';

// the bucket's VE record ({ objects: [{ $type, … }] }) as entry.record takes
// it: each component's first object in a one-element array; later records
// (a weather's overrides) win field by field
export function recordOf(...raws) {
  const out = {};
  for (const raw of raws) {
    for (const o of raw?.objects ?? []) {
      const t = o?.$type;
      if (!t || !t.endsWith('ComponentData')) continue;
      out[t] = [{ ...(out[t]?.[0] ?? {}), ...o }];
    }
  }
  return out;
}

// the textures the record's picture names: { panorama, gradient, cloudShadow } → name | null
export function picturedNames(record) {
  const p = panoramaOf(record);
  return { panorama: p?.name ?? null, gradient: p?.gradient ?? null, cloudShadow: cloudShadowOf(record)?.name ?? null };
}

// a row's mean colour, 0…1, from RGBA bytes w wide (the texture's own linear values)
export function rowMean(rgba, w, y) {
  const s = [0, 0, 0];
  for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) s[c] += rgba[(y * w + x) * 4 + c];
  return s.map((v) => Number((v / w / 255).toFixed(4)));
}
