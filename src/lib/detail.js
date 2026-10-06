// How fine to make what's drawn, from lib/device's detail level: the tier
// (phones 'mid', weak devices 'low', desktops 'high'), moved by how strong
// the graphics chip is (lib/gpuGrade): 'ultra' for a strong card, down to
// 'mid' for a weak built-in one. One table, so every texture painted in code,
// every curve built in code and every model loaded scales the same way:
//
//   level   texture scale  ceiling  segments  model maps kept  LOD reach  clearcoat
//   low     ½              512      ½         512              0.6        –
//   mid     1              1024     ¾         1024             0.8        –
//   high    1              2048     1         4096             1          –
//   ultra   2              4096     2         8192             1.5        on
//
// So an RTX 5090 paints the ships' panel skins at four times the texels of a
// desktop's, turns their engines and domes with twice the segments (no flat
// facets catching the light where something should be round) and keeps every
// map a model came with, while a phone keeps a painted texture at the size it
// was designed at but no model map over 1024, and a weak device halves both.
//
//   detailLevel() → 'low' | 'mid' | 'high' | 'ultra' (this device's)
//   detail(level) → that level's row
//   texScale(design, { level, max }) → the power of two to paint a texture
//       designed at `design` texels (its longer side) by
//   seg(n, { level, min }) → segments round a curve built with `n` at high
//   modelTexCap(level) → the largest map a loaded model keeps (bigger ones
//       are halved until they fit: lib/three/gltf's `prepare`)
//   lodScale(level) → how much further detail holds before stepping down
//   strained() → the frames stayed late with nothing left to soften: hold a
//       strong card at high from now on (lib/device's `capDetail`)
//
// The level is read once the graphics chip has been looked at (lib/gpu), so
// a scene that asks before anything else has still gets the chip's grade.

import { capDetail, device } from './device';
import { gpu } from './gpu';

export const DETAIL = {
  low: { tex: 0.5, texMax: 512, seg: 0.5, modelTex: 512, lod: 0.6, clearcoat: 0 },
  mid: { tex: 1, texMax: 1024, seg: 0.75, modelTex: 1024, lod: 0.8, clearcoat: 0 },
  high: { tex: 1, texMax: 2048, seg: 1, modelTex: 4096, lod: 1, clearcoat: 0 },
  ultra: { tex: 2, texMax: 4096, seg: 2, modelTex: 8192, lod: 1.5, clearcoat: 1 },
};

// The smallest a painted texture is shrunk to, in texels on its longer side:
// below this a texture stops reading as anything.
const MIN_TEXELS = 32;

export function detailLevel() {
  gpu(); // (looked at once; it tells lib/device, which grades the chip)
  return device().detail;
}

export const detail = (level = detailLevel()) => DETAIL[level] ?? DETAIL.high;

// A power of two (½, 1, 2…) so a texture designed at a power of two stays
// one, and a painter can draw in its design units under ctx.scale(k, k).
export function texScale(design, { level, max = Infinity } = {}) {
  if (!(design > 0)) return 1;
  const row = detail(level);
  const ceiling = Math.min(row.texMax, max);
  let k = row.tex;
  // halved until it fits under the ceiling, but never below the smallest
  // worth painting (a design already that small keeps its size)
  while (design * k > ceiling && design * k * 0.5 >= MIN_TEXELS) k /= 2;
  while (k < 1 && design * k < MIN_TEXELS) k *= 2;
  return k;
}

// Segments for a curve built with `n` at high. A curve is never trimmed
// below six sides (a rod would turn into a square), nor below `min`; a
// shape built with fewer than six (a square, a hexagon's six) is never
// trimmed at all, only doubled at ultra.
export function seg(n, { level, min = Math.min(n, 6) } = {}) {
  return Math.max(min, Math.round(n * detail(level).seg));
}

export const modelTexCap = (level) => detail(level).modelTex;

export const lodScale = (level) => detail(level).lod;

// Called when a scene's frames stayed late at ultra with its pixel ratio
// already as soft as it goes: this chip is held at high from now on.
export function strained() {
  if (device().detail === 'ultra') capDetail('high');
}
