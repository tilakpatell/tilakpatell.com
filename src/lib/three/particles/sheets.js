// The effects' sprite sheets: which file a tier loads and what a level's
// set weighs. Pure; scripts/bf2017-emitters.mjs --sheets writes the files
// and `fx.json` by these names, effects.js reads them.
//
// A sheet is the game's texture (`FX/Textures/Snow/T_SnowFlake_4x1_01_D`)
// as WebP at 512, 1024 and 2048 across, under SHEET_CAP each, in
// public/models/galaxy/bf2017/fx/<stem>.<size>.webp; `fx.json` beside them
// lists { format, sheets: { <texture>: { stem, grid, sizes, bytes: { size:
// n }, additive } } }.
//
// sheetStem(texture) → 't_snowflake_4x1_01_d'
// sheetFile(texture, size) → '<stem>.<size>.webp'
// SHEET_SIZE[tier] ; sizeFor(entry, tier) → the width that tier loads
// setWeight(manifest, textures, tier) → { bytes, missing } for a level's textures

export const SHEET_DIR = '/models/galaxy/bf2017/fx/';
export const SHEET_CAP = 256 * 1024; // a sheet's file
export const SET_CAP = 6 * 1024 * 1024; // the sheets a level needs, at one tier
export const SHEET_SIZE = { ultra: 2048, high: 1024, mid: 512, low: 512 };

export const sheetStem = (texture) =>
  String(texture)
    .split('/')
    .pop()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_');
export const sheetFile = (texture, size) => `${sheetStem(texture)}.${size}.webp`;

// the tier's width, or the largest the sheet has under it (a small texture
// is written at its own size only)
export function sizeFor(entry, tier = 'high') {
  const want = SHEET_SIZE[tier] ?? 1024;
  const sizes = [...(entry?.sizes ?? [])].sort((a, b) => a - b);
  if (!sizes.length) return null;
  return sizes.filter((s) => s <= want).pop() ?? sizes[0];
}

export function setWeight(manifest, textures, tier = 'high') {
  let bytes = 0;
  const missing = [];
  for (const t of new Set(textures)) {
    const e = manifest?.sheets?.[t];
    const size = sizeFor(e, tier);
    if (!size) missing.push(t);
    else bytes += e.bytes?.[size] ?? 0;
  }
  return { bytes, missing };
}
