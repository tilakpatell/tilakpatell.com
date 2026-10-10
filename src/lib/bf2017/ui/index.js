// The 2017 game's HUD widgets, ready for its own world (the game's lane 5
// draws its HUD from these): lane 0's widget trees (src/data/bf2017/ui.json:
// each widget's elements with their anchors, sizes, offsets, colours from
// the game's palette, fonts and string ids), with the text resolved through
// the game's strings, the fonts mapped onto the open faces the site ships,
// and the UI bitmaps the cut has (src/data/bf2017/bitmaps.json; none yet:
// the bucket has not got UI/Bitmaps) and the icons (../icons.js).
//
// widget(name) → { name, asset, layout, children, texts: { [id]: text },
//   bitmaps: [url] } | null
// WIDGETS: the names there are
// colour(index) → 'rgb(…)' from the game's palette (linear, as the record
//   keeps it, made sRGB), or null
// fontFor(gameFont) → { family, size, weight }: the game's face and size by
//   its name ('Univers620BoldCondensed30px'), on the game's own file
//   (src/lib/bf2017/fonts.css: Univers Condensed by its grade, RaxusPrime
//   for the numerals, Roboto)
// placeWidget(element, viewport) → { x, y, w, h }: an element's box on the
//   game's 1920 × 1080 reference, scaled to the viewport's shorter side
// bitmap(name) → url | null; portrait(who) → url | null

import UI from '../../../data/bf2017/ui.json';
import BITMAPS from '../../../data/bf2017/bitmaps.json';
import { STRINGS } from '../strings';

const ROWS = UI.rows;
export const WIDGETS = Object.keys(ROWS.widgets);

const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function colour(index, palette = ROWS.palette) {
  const c = palette?.[index];
  if (!c) return null;
  const [r, g, b] = c.map((v) => Math.round(255 * Math.min(1, Math.max(0, toSrgb(v)))));
  return `rgb(${r} ${g} ${b})`;
}

export function fontFor(name) {
  const n = String(name ?? '');
  const size = Number(n.match(/(\d+)(?:px)?$/)?.[1] ?? 18);
  if (/^RaxusPrime/.test(n)) return { family: 'var(--font-bf-numerals)', size, weight: /Bold/.test(n) ? 700 : /Light/.test(n) ? 300 : 400, numeric: 'tabular-nums' };
  if (/^Roboto/.test(n)) return { family: "'Roboto BF', var(--font-bf-text)", size, weight: 400 };
  // (Univers' grades, as fonts.css weighs them: 420 regular, 520 medium,
  // 620 bold, 720 heavy, 820 black)
  const grade = Number(n.match(/^Univers(\d{3})/)?.[1] ?? 520);
  const weight = { 420: 400, 520: 500, 620: 700, 720: 800, 820: 900 }[grade] ?? 500;
  return { family: 'var(--font-bf-hud)', size, weight };
}

export function placeWidget(el, { width, height }) {
  const k = Math.min(width, height) / 1080;
  const [ax, ay] = el.anchor ?? [0, 0];
  const [w, h] = (el.size ?? [0, 0]).map((v) => v * k);
  const [ox, oy] = (el.offset ?? [0, 0]).map((v) => v * k);
  return { x: ax * width - ax * w + ox, y: ay * height - ay * h + oy, w, h };
}

const textsOf = (node, out = {}) => {
  if (Array.isArray(node)) node.forEach((n) => textsOf(n, out));
  else if (node && typeof node === 'object') {
    for (const id of node.texts ?? []) if (STRINGS[id] !== undefined) out[id] = STRINGS[id];
    for (const v of Object.values(node)) if (v && typeof v === 'object') textsOf(v, out);
  }
  return out;
};

export const bitmap = (name) => {
  const row = BITMAPS.rows[name];
  return row ? `/${row.path}` : null;
};
export const portrait = (who) => bitmap(`UI/Bitmaps/Portraits/Portrait_${who}`);

export function widget(name) {
  const w = ROWS.widgets[name];
  if (!w) return null;
  const bitmaps = Object.keys(BITMAPS.rows)
    .filter((n) => n.split('/').pop().toLowerCase().includes(name.toLowerCase()))
    .map(bitmap);
  return { name, asset: w.asset, layout: { anchor: w.anchor ?? [0, 0], size: w.size ?? null, offset: w.offset ?? [0, 0] }, children: w.children ?? [], texts: textsOf(w), bitmaps };
}
