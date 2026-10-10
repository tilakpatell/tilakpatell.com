// The game's screens, resolved for the page (src/data/bf2017/screens.json,
// scripts/lib/bf2017-rulebook-ui.mjs's screensOf): a screen's widget tree
// placed on the viewport as the game places it on its 1920 × 1080
// reference, its texts in the game's words, its faces on the open fonts
// (fontFor), its colours from the game's palette, its shapes by name, its
// cells' links to the screens they go to. And the loading screens: a
// level's film and one of the game's hints for the mode.
//
// screen(name, { viewport, data, strings }) → { name, size, boxes, links,
//   states, navigation } | null, by the screen's full or short name.
//   boxes: [{ id, type, x, y, w, h, colour, alpha, hidden, font, text, key,
//   align, shape, svg, film, widget, link, screen, label, children }] in the
//   viewport's pixels; a text whose string is missing shows its key; `data`
//   gives an element's text by its id (data.MenuText) and the {0} fills
//   (data.args)
// loading(mode, level, { seed }) → { screen, film, hint, loadTime }: the
//   site's mode ('galacticAssault') and world ('hoth') or the game's ids
// word(key, args) → one of the game's words the screens rulebook carries
// SCREENS, WIDGETS_IN_SCREENS: the names there are

import BOOK from '../../../data/bf2017/screens.json';
import LOADING from '../../../data/bf2017/loading.json';
import { FILMS, filmFor, filmOf } from '../films';
import { STRINGS, text } from '../strings';
import { colour, css, fontFor, placeIn } from './index';
import { info, levelFor, modeFor } from './info';

const ROWS = BOOK.rows;
export const SCREENS = Object.keys(ROWS.screens);
export const WIDGETS_IN_SCREENS = Object.keys(ROWS.widgets);
const TABLE = { ...STRINGS, ...ROWS.strings, ...LOADING.rows.strings };
const MAX_DEPTH = 16;

const findScreen = (name) => ROWS.screens[name] ?? ROWS.screens[SCREENS.find((n) => n.endsWith(`/${name}`))] ?? null;
const fullName = (name) => (ROWS.screens[name] ? name : SCREENS.find((n) => n.endsWith(`/${name}`)));

function say(key, ctx) {
  return text(key, ctx.data?.args ?? [], { strings: ctx.strings });
}

// the elements a widget's slots feed, by id → the string key the reference binds
function slotTexts(binds, slots) {
  const out = {};
  for (const [field, key] of Object.entries(binds ?? {})) for (const id of slots?.[field] ?? []) out[id] = key;
  return out;
}

function boxOf(el, at, path, ctx, slots) {
  const box = { id: `${path}/${el.id}`, type: el.type, x: at.x, y: at.y, w: at.w, h: at.h };
  const ink = typeof el.palette === 'number' ? colour(el.palette) : el.colour ? css(el.colour) : null;
  if (ink) box.colour = ink;
  if (el.alpha !== undefined) box.alpha = el.alpha;
  if (el.visible === false) box.hidden = true;
  if (el.type === 'text') {
    const key = slots[el.id] ?? el.text ?? null;
    if (key) box.key = key;
    box.text = ctx.data?.[el.id] ?? (key ? say(key, ctx) : (el.literal ?? ''));
    if (el.font) box.font = fontFor(el.font);
    if (el.align) box.align = el.align;
    if (el.wrap) box.wrap = true;
  }
  for (const k of ['shape', 'svg', 'film', 'fill', 'line', 'points']) if (el[k] !== undefined) box[k] = el[k];
  return box;
}

function expand(elements, parent, path, ctx, slots = {}, seen = new Set(), depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const out = [];
  // (a stack lays its children one after another along its direction)
  let cursor = 0;
  for (const el of elements ?? []) {
    let at;
    if (parent.stack) {
      const size = (widgetSized(el).size ?? [0, 0]).map((v) => v * ctx.k);
      const down = /TopDown|BottomUp/i.test(parent.stack.direction);
      const free = placeIn(el, parent, ctx.k);
      at = down ? { x: free.x, y: parent.y + cursor, w: size[0], h: size[1] } : { x: parent.x + cursor, y: free.y, w: size[0], h: size[1] };
      cursor += (down ? size[1] : size[0]) + parent.stack.spacing * ctx.k;
    } else at = placeIn(widgetSized(el), parent, ctx.k);
    const box = boxOf(el, at, path, ctx, slots);
    const inner = { ...at, ...(el.stack ? { stack: el.stack } : {}) };
    if (el.widget) {
      const w = ROWS.widgets[el.widget];
      box.widget = el.widget;
      if (w && !seen.has(el.widget)) box.children = expand(w.elements, inner, box.id, ctx, slotTexts(el.binds, w.slots), new Set([...seen, el.widget]), depth + 1);
    } else if (el.list) {
      box.children = cellsOf(el.list, inner, box.id, ctx, seen, depth);
    } else if (el.children?.length) {
      box.children = expand(el.children, inner, box.id, ctx, slots, seen, depth + 1);
    }
    out.push(box);
  }
  return out;
}

// a widget reference takes its widget's own size unless it says otherwise
function widgetSized(el) {
  if (!el.widget || el.useElementSize) return el;
  const w = ROWS.widgets[el.widget];
  if (w?.size) return { ...el, size: w.size };
  // (a widget with no size of its own is as big as what it holds)
  const ext = extent(w?.elements);
  return ext ? { ...el, size: ext } : el;
}

function extent(elements) {
  let w = 0;
  let h = 0;
  for (const e of elements ?? []) {
    if (!e.size) continue;
    w = Math.max(w, (e.anchor?.[0] ? 0 : (e.offset?.[0] ?? 0)) + e.size[0]);
    h = Math.max(h, (e.anchor?.[1] ? 0 : (e.offset?.[1] ?? 0)) + e.size[1]);
  }
  return w && h ? [w, h] : null;
}

// A cell the game sizes to its text (its widget a placeholder of a pixel or
// two): about 0.6 em a letter at the 24 px the cells write in, padded.
const CELL_EM = 0.6;
const CELL_TEXT = 24;
function cellSize(w, label) {
  const [cw, ch] = w?.size ?? [0, 0];
  if (cw > 8 && ch > 8) return [cw, ch];
  return [Math.max(64, Math.round(String(label).length * CELL_EM * CELL_TEXT + 32)), ch > 8 ? ch : 48];
}

function cellsOf(list, at, path, ctx, seen, depth) {
  let cursor = 0;
  return list.cells.map((c) => {
    const w = ROWS.widgets[c.widget];
    const key = Object.values(c.binds ?? {})[0];
    const label = key ? say(key, ctx) : c.id;
    const [cw, ch] = cellSize(w, label).map((v) => v * ctx.k);
    const box = list.horizontal ? { x: at.x + cursor, y: at.y, w: cw, h: Math.min(ch, at.h || ch) } : { x: at.x, y: at.y + cursor, w: Math.min(cw, at.w || cw), h: ch };
    cursor += (list.horizontal ? cw : ch) + list.spacing * ctx.k;
    const cell = { id: `${path}/${c.id}`, type: 'cell', ...box, label, ...(key ? { key } : {}) };
    if (c.link) {
      cell.link = c.link;
      cell.screen = ROWS.links[c.link] ?? null;
    }
    if (w && !seen.has(c.widget)) cell.children = expand(w.elements, box, cell.id, ctx, slotTexts(c.binds, w.slots), new Set([...seen, c.widget]), depth + 1);
    return cell;
  });
}

export function screen(name, { viewport = { width: 1920, height: 1080 }, data = null, strings = null } = {}) {
  const s = findScreen(name);
  if (!s) return null;
  const { width, height } = viewport;
  const ctx = { k: Math.min(width, height) / 1080, data, strings: strings ?? TABLE };
  const full = fullName(name);
  const boxes = expand(s.elements, { x: 0, y: 0, w: width, h: height }, '', ctx, {}, new Set([full]));
  return {
    name: full,
    size: [width, height],
    boxes,
    links: (s.links ?? []).map((l) => ({ ...l, screen: ROWS.links[l.to] ?? null })),
    states: s.states ?? [],
    navigation: s.navigation ?? null,
  };
}

// ── the loading screen ───────────────────────────────────────────────────

const HINTS = LOADING.rows.hints;
const short = (n) => String(n ?? '').slice(String(n ?? '').lastIndexOf('/') + 1);

// The tips the game would draw for a mode on a level: the bundles from the
// root down, a bundle whose filter does not take the mode, map or planet
// left out with what is under it.
export function hintsFor(modeAsset, levelId, planet, root = 'HintsBundle', seen = new Set()) {
  const b = HINTS[root];
  if (!b || seen.has(root) || b.enabled === false) return [];
  seen.add(root);
  const f = b.filter;
  if (f && !(f.modes.includes(modeAsset) || f.maps.includes(levelId) || f.planets.includes(planet))) return [];
  return [...b.tips, ...b.sub.flatMap((s) => hintsFor(modeAsset, levelId, planet, s, seen))];
}

const pick = (list, seed) => list[(((Math.imul(seed + 1, 2654435761) >>> 0) % list.length) + list.length) % list.length];

export function loading(mode, level, { seed = 0 } = {}) {
  const lv = levelFor(level) ?? info('level', level);
  const m = info('mode', modeFor(mode));
  const planet = lv?.planet ?? null;
  const screens = LOADING.rows.screens;
  const key = lv?.key?.replace(/_0\d$/, '');
  const name = [`MPLoadLevel${key}Asset`, `MPLoadLevel${planet}Asset`].find((n) => screens[n]) ?? null;
  const row = name ? screens[name] : null;
  const named = row?.film ? FILMS.find((f) => short(f.name) === row.film) : null;
  const film = named ? filmOf(named) : planet ? filmFor({ system: planet.toLowerCase() }) : null;
  const keys = hintsFor(short(m?.asset), lv?.id, planet);
  const tips = keys.map((k) => text(k, [], { strings: TABLE })).filter((t) => t && !/[{%]/.test(t) && !/^ID_/.test(t));
  return { screen: name, film, hint: tips.length ? pick(tips, seed) : null, loadTime: row?.loadTime ?? null, bar: row?.bar ?? true };
}

// One of the game's words the screens carry, by its key ('ID_…' or
// '#XXXXXXXX'), its {0} filled; the key itself where the table lacks it.
export const word = (key, args = []) => text(key, args, { strings: TABLE });
