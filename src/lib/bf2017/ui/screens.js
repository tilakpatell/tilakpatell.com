// The game's screens, resolved for the page (src/data/bf2017/screens.json,
// scripts/lib/bf2017-rulebook-ui.mjs's screensOf): a screen's widget tree
// placed on the viewport as the game places it on its 1920 × 1080
// reference, its texts in the game's words, its faces on the open fonts
// (fontFor), its colours from the game's palette, its shapes by name, its
// cells' links to the screens they go to. And the loading screens: a
// level's film and one of the game's hints for the mode.
//
// screen(name, { viewport, data, strings, items, drop }) → { name, size, boxes, links,
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

import BOOK from 'virtual:bf2017-screens';
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

// A text's face: lane M's fontFor for the faces it maps (Univers, RaxusPrime,
// Roboto); the game's Aurebesh on the site's own open Aurebesh; any other
// (News Gothic, the EULA's Asian fix) on the text face.
export function faceFor(name) {
  const n = String(name ?? '');
  if (/^(Univers|RaxusPrime|Roboto)/.test(n)) return fontFor(n);
  const size = Number(n.match(/(\d+)(?:px)?$/)?.[1] ?? 18);
  return { family: /^Aurebesh/i.test(n) ? 'var(--font-aurebesh)' : 'var(--font-bf-text)', size, weight: 400 };
}

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

// an element's words as the box will show them
function textFor(el, ctx, slots) {
  const key = slots[el.id] ?? el.text ?? null;
  return (ctx.data?.[el.id] ?? (key ? say(key, ctx) : (el.literal ?? ''))) || ctx.blank || '';
}

// The width a line of words takes in the game's condensed face: 0.48 em a
// letter (hand: the capture's SINGLE PLAYER, 146 px at 24 px, and PLAY, 47 px)
const LETTER_EM = 0.48;
const wordsWidth = (text, font) => String(text).length * LETTER_EM * (faceFor(font).size ?? 18);

function boxOf(el, at, path, ctx, slots) {
  const box = { id: `${path}/${el.id}`, type: el.type, x: at.x, y: at.y, w: at.w, h: at.h };
  const ink = typeof el.palette === 'number' ? colour(el.palette) : el.colour ? css(el.colour) : null;
  if (ink) box.colour = ink;
  // (an enter animation's container is recorded at alpha 0, the game
  // fading it in: drawn as a reveal, not as nothing)
  if (el.alpha === 0 && /^Anim/i.test(el.id)) box.reveal = true;
  else if (el.alpha !== undefined) box.alpha = el.alpha;
  if (el.visible === false) box.hidden = true;
  if (el.type === 'text') {
    const key = slots[el.id] ?? el.text ?? null;
    if (key) box.key = key;
    box.text = ctx.data?.[el.id] ?? (key ? say(key, ctx) : (el.literal ?? ''));
    // (a cell of a list the code fills: its empty words are the datum's)
    if (!box.text && ctx.blank) box.text = ctx.blank;
    if (el.font) box.font = faceFor(el.font);
    if (el.align) box.align = el.align;
    if (el.wrap) box.wrap = true;
  }
  for (const k of ['shape', 'svg', 'film', 'fill', 'line', 'points', 'texture', 'blend']) if (el[k] !== undefined) box[k] = el[k];
  return box;
}

// a padded container's inner box: its parts are laid inside the padding
// (left, top, right, bottom, in the reference's pixels), and its recorded
// size less the padding is what they grow past
function padded(at, pad, k) {
  if (!pad) return at;
  const [l, t, r, b] = pad.map((v) => v * k);
  return { ...at, x: at.x + l, y: at.y + t, w: Math.max(0, at.w - l - r), h: Math.max(0, at.h - t - b) };
}
const paddedSize = (size, pad) => (pad ? [size[0] - pad[0] - pad[2], size[1] - pad[1] - pad[3]] : size);

// A box's id among its siblings: the export names siblings alike (a
// footer's two Select cells, a stack's DecoLineSeparation lines, 405 pairs
// over the screens), and a second of a name is `name#2`, so no two boxes
// under one parent share an id (the page keys its children by it; a
// duplicate key was a warning a render and a box drawn twice or not at all).
const unique = (sibs, id) => {
  const n = (sibs.get(id) ?? 0) + 1;
  sibs.set(id, n);
  return n > 1 ? `${id}#${n}` : id;
};

// A part a screen drops (`drop`, by the name of the box it is inside: the
// footer's cells the PC's game does not show) takes no room: counted among
// its siblings' names, then left out.
function dropped(sibs, key, name, ctx) {
  if (!ctx.dropping) return false;
  const n = (sibs.get(key) ?? 0) + 1;
  if (!ctx.dropping.has(n > 1 ? `${name}#${n}` : name)) return false;
  sibs.set(key, n);
  return true;
}
const scoped = (el, ctx) => (ctx.drop?.[el.id] ? { ...ctx, dropping: new Set(ctx.drop[el.id]) } : ctx);

function expand(elements, parent, path, ctx, slots = {}, seen = new Set(), depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const out = [];
  const sibs = new Map();
  // (a stack lays its children one after another along its direction)
  let cursor = 0;
  for (const el of elements ?? []) {
    // (a part a list's datum leaves out takes no room: the crumb's divider before the first)
    if (ctx.hide?.has(el.id) || dropped(sibs, `${path}/${el.id}`, el.id, ctx)) continue;
    let at;
    if (parent.stack) {
      const size = (widgetSized(el).size ?? [0, 0]).map((v) => v * ctx.k);
      const down = /TopDown|BottomUp/i.test(parent.stack.direction);
      // (in a cell sized to its words, a word takes its own width along the stack)
      if (!down && ctx.blank && el.type === 'text') size[0] = Math.max(size[0], wordsWidth(textFor(el, ctx, slots), el.font) * ctx.k);
      const free = placeIn(el, parent, ctx.k);
      at = down ? { x: free.x, y: parent.y + cursor, w: size[0], h: size[1] } : { x: parent.x + cursor, y: free.y, w: size[0], h: size[1] };
      cursor += (down ? size[1] : size[0]) + parent.stack.spacing * ctx.k;
    } else at = placeIn(widgetSized(el), parent, ctx.k);
    const box = boxOf(el, at, path, ctx, slots);
    box.id = unique(sibs, box.id);
    // (a root box the tree expands over the whole frame: drawn over the whole window)
    if (depth === 0 && !path && el.layout?.fill && String(el.layout.expansion) === '0,0,1,1') box.bleed = true;
    const inner = { ...padded(at, el.padding, ctx.k), ...(el.stack ? { stack: el.stack } : {}), ...(el.size ? { design: paddedSize(el.size, el.padding) } : {}) };
    const sub = scoped(el, ctx);
    if (el.widget) {
      const w = ROWS.widgets[el.widget];
      box.widget = el.widget;
      if (w && !seen.has(el.widget)) box.children = expand(w.elements, { ...inner, design: w.size ?? inner.design }, box.id, sub, slotTexts(el.binds, w.slots), new Set([...seen, el.widget]), depth + 1);
    } else if (el.dynamic && ctx.items?.[el.id]) {
      box.children = itemsOf(el.dynamic, ctx.items[el.id], inner, box.id, sub, seen, depth);
    } else if (el.list) {
      box.children = cellsOf(el.list, inner, box.id, sub, seen, depth);
    } else if (el.children?.length) {
      box.children = expand(el.children, inner, box.id, sub, slots, seen, depth + 1);
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
  const sibs = new Map();
  return list.cells.flatMap((c) => {
    if (dropped(sibs, `${path}/${c.id}`, c.id, ctx)) return [];
    const w = ROWS.widgets[c.widget];
    const key = Object.values(c.binds ?? {})[0];
    const label = key ? say(key, ctx) : c.id;
    const [cw, ch] = cellSize(w, label).map((v) => v * ctx.k);
    const box = list.horizontal ? { x: at.x + cursor, y: at.y, w: cw, h: Math.min(ch, at.h || ch) } : { x: at.x, y: at.y + cursor, w: Math.min(cw, at.w || cw), h: ch };
    cursor += (list.horizontal ? cw : ch) + list.spacing * ctx.k;
    const cell = { id: unique(sibs, `${path}/${c.id}`), type: 'cell', ...box, label, ...(key ? { key } : {}) };
    if (c.link) {
      cell.link = c.link;
      cell.screen = ROWS.links[c.link] ?? null;
    }
    if (w && !seen.has(c.widget)) cell.children = expand(w.elements, { ...box, ...(w.size ? { design: w.size } : {}) }, cell.id, ctx, slotTexts(c.binds, w.slots), new Set([...seen, c.widget]), depth + 1);
    return cell;
  });
}

// A list the game's code fills (the breadcrumb): one cell a datum
// ({ id, label, link?, hide? }: `hide` the template's parts it leaves out),
// each made from the list's template, sized to what it draws where the
// list's cells are sized so, laid along the list
// (a datum's cell draws every part it keeps, the ones its tree records hidden
// too: the code shows them; what it does not draw is its `hide`, left out)
const DRAWN = new Set(['text', 'fill', 'vectorShape', 'svg', 'texture', 'rectangle']);
function drawnRight(boxes) {
  let r = -Infinity;
  for (const b of boxes ?? []) {
    if (DRAWN.has(b.type)) r = Math.max(r, b.x + b.w);
    r = Math.max(r, drawnRight(b.children));
  }
  return r;
}

function itemsOf(dyn, items, at, path, ctx, seen, depth) {
  const w = ROWS.widgets[dyn.template];
  let cursor = 0;
  const sibs = new Map();
  return items.map((it) => {
    const [cw, ch] = (dyn.sized ? [cellSize(null, it.label)[0], dyn.cellSize[1]] : dyn.cellSize).map((v) => v * ctx.k);
    const box = dyn.horizontal ? { x: at.x + cursor, y: at.y, w: cw, h: ch } : { x: at.x, y: at.y + cursor, w: cw, h: ch };
    cursor += (dyn.horizontal ? cw : ch) + dyn.spacing * ctx.k;
    const cell = { id: unique(sibs, `${path}/${it.id}`), type: 'cell', ...box, label: it.label, ...(it.link ? { link: it.link } : {}) };
    if (w && !seen.has(dyn.template)) cell.children = expand(w.elements, { ...box, ...(w.size ? { design: w.size } : {}) }, cell.id, { ...ctx, blank: it.label, hide: new Set(it.hide ?? []) }, {}, new Set([...seen, dyn.template]), depth + 1);
    // (sized to what it draws: the right edge of its words and marks)
    if (dyn.sized && dyn.horizontal && cell.children) {
      const right = drawnRight(cell.children);
      if (right > cell.x) {
        cursor += right - cell.x - cell.w;
        cell.w = right - cell.x;
      }
    }
    return cell;
  });
}

export function screen(name, { viewport = { width: 1920, height: 1080 }, data = null, strings = null, items = null, drop = null } = {}) {
  const s = findScreen(name);
  if (!s) return null;
  const { width, height } = viewport;
  const ctx = { k: Math.min(width, height) / 1080, data, strings: strings ?? TABLE, items, drop };
  const full = fullName(name);
  const boxes = expand(s.elements, { x: 0, y: 0, w: width, h: height, ...(s.size ? { design: s.size } : {}) }, '', ctx, {}, new Set([full]));
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
