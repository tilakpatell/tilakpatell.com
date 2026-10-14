// The layout core of the game's screens on the canvas (the 2026-10-13 canvas
// design, docs/superpowers/specs/2026-10-13-bf2017-ui-canvas-design.md): the
// game's 1920 Ã— 1080 frame in a window, and the trees screen() resolves at
// that size made into one flat list to draw and the cells to press. Pure: the
// painter (./paint.js) draws the list, the kit's ScreenCanvas puts a button
// over each cell, so what is drawn and what is pressed come from one place.
//
// frameOf({ width, height }) â†’ { k, x, y, w, h }: the frame scaled to fit the
//   window and centred in it
// drawList(layers, { selected, open, values }) â†’ [{ id, layer, type, x, y, w, h,
//   alpha, colour, text, font, align, wrap, shape, film, fill, line, bleed,
//   cell }] in frame px, in drawing order; `id` is `<layer>:<box id>`, `cell`
//   the navigable it is in (or null)
// navigables(layers, { values }) â†’ [{ id, layer, x, y, w, h, label, link,
//   screen, group, index, horizontal, coming, tile }]: `tile` a widget the
//   game walks by its navigation zone (a Play tile), not a list's cell
// values(box, path) â†’ { text?, hidden?, film?, image?, coming? } | null: what a screen
//   fills a box with (the game's code does it at run time), `path` the ids'
//   last parts from the layer's root down to the box
// stateOf({ focus, open, off }) â†’ { show, look }: the state (0 normal, 1
//   selected, 2 focused, 3 disabled) a box's `states` are read at
// A box with `states` (the widget's logic, from the rulebook) is drawn in
// its cell's state: its colour, alpha, line, corners and whether it shows;
// a film in a widget the logic colours carries that colour as `tint`.

import { filmNamed } from '../films';

export const FRAME = [1920, 1080];

export function frameOf({ width, height }) {
  const k = Math.min(width / FRAME[0], height / FRAME[1]);
  return { k, x: (width - FRAME[0] * k) / 2, y: (height - FRAME[1] * k) / 2, w: FRAME[0] * k, h: FRAME[1] * k };
}

// what only listens or measures (drawn by nothing), and what only holds
const PASSIVE = new Set(['input', 'measurement', 'navigatableElementCollection', 'navigatableElementZone', 'inputConceptIcon', 'spacer', 'analogInput', 'circularAnalogInput']);
const HOLDS = new Set(['widget', 'container', 'stack', 'staticList', 'staticTabList', 'standardList', 'standardTabList', 'grid', 'cell', 'luaList', 'creditsList', 'dynamicScreen', 'popupDisplay', 'objectiveDisplay']);
// the game's highlight layers, shown on the selected cell (hand: the DOM
// screens' rule, made exact, until the cells' schematics are read)
const SELECT = /^Select|Selected/;
// (an open cell that is not the focus, the tab whose page is shown, is lit
// without the focus's own edges and dots: hand, the capture's HOME)
const FOCUS_MARK = /Line|Dot/;
const NEW_MARK = 'UI/Frontend/Widgets/Shared/NewThingAvailable';
const KEEP = ['type', 'x', 'y', 'w', 'h', 'colour', 'text', 'font', 'align', 'wrap', 'shape', 'svg', 'film', 'fill', 'line', 'points', 'bleed', 'texture', 'blend', 'image', 'cap', 'corners', 'follow', 'relative', 'linear'];

const nameOf = (id) => id.slice(id.lastIndexOf('/') + 1).replace(/#\d+$/, '');

// The navigables' box ids: every cell, and for every navigatableElementZone
// the nearest widget reference above it (a Play tile's zone sits in its
// AnimContainer); one inside a cell or inside another is the outer one's.
function navIds(tree) {
  const out = new Set();
  const walk = (boxes, above) => {
    for (const b of boxes ?? []) {
      if (b.type === 'cell' && !above.some((a) => out.has(a.id))) out.add(b.id);
      if (b.type === 'navigatableElementZone') {
        const w = [...above].reverse().find((a) => a.widget);
        if (w && !above.some((a) => out.has(a.id))) out.add(w.id);
      }
      walk(b.children, [...above, b]);
    }
  };
  walk(tree?.boxes, []);
  return out;
}

// a box with a screen's values laid on it, and whether they hid it
const patched = (b, path, values) => {
  const p = values?.(b, path);
  return p ? { ...b, ...p, forced: p.hidden === true } : b;
};

// The state a box is drawn in, by the cell it is in (the widget's logic,
// scripts/lib/bf2017-ui-logic.mjs: normal 0, selected 1, focused 2,
// disabled 3). What shows goes by the selection first (an open tab shows
// its open parts while the pointer is on it), how it looks by the focus
// first (the game's state is `focused ? 2 : selected ? 1 : 0` for its
// colours); a cell that cannot be pressed is disabled.
export const stateOf = ({ focus = false, open = false, off = false }) => ({ show: off ? 3 : open ? 1 : focus ? 2 : 0, look: off ? 3 : focus ? 2 : open ? 1 : 0 });

// a box's own look in its state: its colour, alpha, line and corners as the
// logic sets them
function inState(b, s) {
  const st = b.states;
  if (!st) return b;
  const out = { ...b };
  if (st.colour) out.colour = st.colour[s.look];
  if (st.line) out.line = st.line[s.look];
  if (st.corners) out.corners = st.corners[s.look];
  if (st.alpha) out.alpha = st.alpha[s.look];
  // (a colour fill the logic shows with no colour of its own is the record's
  // white: the open tab's SelectedBackgroundLight; the game shades the UI in
  // linear space, GameRenderSettings.UIShadeInLinearSpaceEnabled, so its 2 %
  // lights the panel as 2 % of light does, not 2 % of the 8-bit value)
  if ((b.type === 'rectangle' || b.type === 'fill') && b.fill === 'color' && !out.colour) out.colour = 'rgb(255 255 255)';
  out.linear = true;
  return out;
}

export function drawList(layers, { selected = new Set(), open = new Set(), values = null } = {}) {
  const items = [];
  layers.forEach((tree, layer) => {
    const navs = navIds(tree);
    const walk = (boxes, path, alpha, cell, on, focused, opened, off, tint, trail) => {
      const kids = (boxes ?? []).map((b) => patched(b, [...path, nameOf(b.id)], values));
      const names = new Set(kids.map((b) => nameOf(b.id)));
      for (const raw of kids) {
        const name = nameOf(raw.id);
        const nav = navs.has(raw.id);
        const here = nav ? `${layer}:${raw.id}` : cell;
        const isFocus = nav ? selected.has(here) : focused;
        const isOpen = nav ? open.has(here) : opened;
        const isOff = nav ? Boolean(raw.coming) : off;
        const lit = nav ? isFocus || isOpen : on;
        const s = stateOf({ focus: isFocus, open: isOpen, off: isOff });
        const b = inState(raw, s);
        const inCell = here !== null;
        const highlight = inCell && SELECT.test(name);
        if (b.states?.visible) {
          // (the logic says what shows: the hand rules below are for the cells it does not reach)
          if (!b.states.visible[s.show] || b.forced) continue;
        } else {
          if (highlight && !lit) continue;
          if (highlight && !isFocus && FOCUS_MARK.test(name)) continue;
          if (inCell && lit && (names.has(`${name}Selected`) || names.has(`Selected${name}`))) continue;
          if (b.hidden && !(highlight && lit && !b.forced)) continue;
        }
        if (b.widget === NEW_MARK && b.hidden !== false) continue;
        // (an enter animation's end: a widget faded in from 0, a revealed box)
        const own = b.reveal || (b.type === 'widget' && b.alpha === 0) || (highlight && b.alpha === 0 && !b.states?.alpha) ? 1 : (b.alpha ?? 1);
        const a = alpha * own;
        if (!PASSIVE.has(b.type) && !HOLDS.has(b.type)) {
          const item = { id: `${layer}:${b.id}`, layer, alpha: a, cell: here };
          for (const k of KEEP) if (b[k] !== undefined) item[k] = b[k];
          if (typeof item.film === 'string') item.film = filmNamed(item.film) ?? undefined;
          if (item.film === undefined) delete item.film;
          // (a film inside a widget the logic colours: drawn in that colour, the tile's yellow line drawing)
          if (tint && b.type === 'video') item.tint = tint;
          // (the CRT trail container it is in, unless it is left out of it)
          if (trail && !b.noTrail) item.trail = trail;
          items.push(item);
        }
        // (a widget the logic colours colours what it holds: its Color multiplies theirs)
        const holds = b.type === 'widget' && b.states?.colour ? b.colour : tint;
        walk(b.children, [...path, name], a, here, lit, isFocus, isOpen, isOff, holds, b.noTrail ? null : (b.trail ?? trail));
      }
    };
    walk(tree?.boxes, [], 1, null, false, false, false, false, null, null);
  });
  return items;
}

// a navigable's words: the cell's own, else its Title, else its first
// words, as the screen's values fill them
function labelOf(b, path, values) {
  if (b.label) return b.label;
  const texts = [];
  const walk = (bs, at) =>
    bs?.forEach((raw) => {
      const here = [...at, nameOf(raw.id)];
      const c = patched(raw, here, values);
      if (c.hidden) return;
      if (c.type === 'text' && c.text) texts.push(c);
      walk(c.children, here);
    });
  walk(b.children, path);
  return (texts.find((t) => nameOf(t.id) === 'Title') ?? texts[0])?.text ?? nameOf(b.id);
}

export function navigables(layers, { values = null } = {}) {
  const out = [];
  layers.forEach((tree, layer) => {
    const navs = navIds(tree);
    const walk = (boxes, path, parent) => {
      for (const raw of boxes ?? []) {
        const b = patched(raw, [...path, nameOf(raw.id)], values);
        if (b.hidden === true) continue;
        if (navs.has(b.id)) {
          out.push({ id: `${layer}:${b.id}`, layer, x: b.x, y: b.y, w: b.w, h: b.h, label: labelOf(b, [...path, nameOf(raw.id)], values), link: b.link ?? null, screen: b.screen ?? null, group: `${layer}:${parent}`, coming: Boolean(b.coming), tile: b.type !== 'cell' });
          continue;
        }
        walk(b.children, [...path, nameOf(b.id)], b.id);
      }
    };
    walk(tree?.boxes, [], '');
  });
  // each group's order, and whether it runs across
  const groups = new Map();
  for (const n of out) groups.set(n.group, [...(groups.get(n.group) ?? []), n]);
  for (const g of groups.values()) {
    const across = g.length < 2 || g[1].x !== g[0].x;
    g.forEach((n, i) => Object.assign(n, { index: i, horizontal: across }));
  }
  return out;
}
