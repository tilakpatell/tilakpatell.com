// The picture a texture box of the game's screens shows (the 2026-10-13
// canvas design, decision 6), from the UI bitmaps the site ships
// (src/data/bf2017/bitmaps.json, cut by scripts/bf2017-ui.mjs bitmaps from
// the Frosty export's TextureAssets):
//   1. the name a screen gives a box the game's code fills (`image`);
//   2. the box's TextureRef (its own, or its widget's mapping's) by the
//      table below: the export does not carry a texture's resource id yet,
//      so each ref is named by hand from the one texture the screen can mean
//      (until the export's resource ids, the design's phase 5);
//   3. its Id, Frostbite's field hash of the texture's short name in lower
//      case (`vignette`, -1768429805).
//
// pictureOf(item, rows) → { name, url, size } | null

import BITMAPS from '../../../data/bf2017/bitmaps.json';

// TextureRef → texture, by hand (each: the screen, and why that texture)
export const REFS = {
  // StartFlow/PairingScreen's Background, its automapping's one output: the press-start key art
  '3D80EC7618F789C7': 'UI/Bitmaps/Frontend/4k_KeyArtPairingScreen',
};

const fieldHash = (s) => {
  let h = 5381;
  for (const c of s) h = Math.imul(h, 33) ^ c.charCodeAt(0);
  return h | 0;
};

const byId = new WeakMap();
function idsOf(rows) {
  if (!byId.has(rows)) byId.set(rows, new Map(Object.keys(rows).map((n) => [fieldHash(n.slice(n.lastIndexOf('/') + 1).toLowerCase()), n])));
  return byId.get(rows);
}

const found = (name, rows) => (name && rows[name] ? { name, url: `/${rows[name].path}`, size: rows[name].size } : null);

export function pictureOf(item, rows = BITMAPS.rows) {
  if (item.image) return found(item.image, rows);
  const t = item.texture;
  if (!t) return null;
  return found(REFS[t.ref], rows) ?? (t.id ? found(idsOf(rows).get(t.id), rows) : null);
}
