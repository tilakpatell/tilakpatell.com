// The layout core of the game's screens on the canvas (the 2026-10-13 canvas
// design, docs/superpowers/specs/2026-10-13-bf2017-ui-canvas-design.md): the
// game's 1920 × 1080 frame in a window, and the trees screen() resolves at
// that size made into one flat list to draw and the cells to press. Pure: the
// painter (./paint.js) draws the list, the kit's ScreenCanvas puts a button
// over each cell, so what is drawn and what is pressed come from one place.
//
// frameOf({ width, height }) → { k, x, y, w, h }: the frame scaled to fit the
//   window and centred in it
// drawList(layers, { selected, values }) → [{ id, layer, type, x, y, w, h,
//   alpha, colour, text, font, align, wrap, shape, film, fill, line, bleed,
//   cell }] in frame px, in drawing order; `id` is `<layer>:<box id>`, `cell`
//   the navigable it is in (or null)
// navigables(layers, { values }) → [{ id, layer, x, y, w, h, label, link,
//   screen, group, index, horizontal, coming }]
// values(box, path) → { text?, hidden?, film?, coming? } | null: what a screen
//   fills a box with (the game's code does it at run time), `path` the ids'
//   last parts from the layer's root down to the box

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
const NEW_MARK = 'UI/Frontend/Widgets/Shared/NewThingAvailable';
const KEEP = ['type', 'x', 'y', 'w', 'h', 'colour', 'text', 'font', 'align', 'wrap', 'shape', 'svg', 'film', 'fill', 'line', 'points', 'bleed'];

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

export function drawList(layers, { selected = new Set(), values = null } = {}) {
  const items = [];
  layers.forEach((tree, layer) => {
    const navs = navIds(tree);
    const walk = (boxes, path, alpha, cell, on) => {
      const kids = (boxes ?? []).map((b) => patched(b, [...path, nameOf(b.id)], values));
      const names = new Set(kids.map((b) => nameOf(b.id)));
      for (const b of kids) {
        const name = nameOf(b.id);
        const here = navs.has(b.id) ? `${layer}:${b.id}` : cell;
        const lit = navs.has(b.id) ? selected.has(here) : on;
        const inCell = here !== null;
        const highlight = inCell && SELECT.test(name);
        if (highlight && !lit) continue;
        if (inCell && lit && (names.has(`${name}Selected`) || names.has(`Selected${name}`))) continue;
        if (b.hidden && !(highlight && lit && !b.forced)) continue;
        if (b.widget === NEW_MARK && b.hidden !== false) continue;
        // (an enter animation's end: a widget faded in from 0, a revealed box)
        const own = b.reveal || (b.type === 'widget' && b.alpha === 0) || (highlight && b.alpha === 0) ? 1 : (b.alpha ?? 1);
        const a = alpha * own;
        if (!PASSIVE.has(b.type) && !HOLDS.has(b.type)) {
          const item = { id: `${layer}:${b.id}`, layer, alpha: a, cell: here };
          for (const k of KEEP) if (b[k] !== undefined) item[k] = b[k];
          items.push(item);
        }
        walk(b.children, [...path, name], a, here, lit);
      }
    };
    walk(tree?.boxes, [], 1, null, false);
  });
  return items;
}

// a navigable's words: the cell's own, else its Title, else its first words
function labelOf(b) {
  if (b.label) return b.label;
  const texts = [];
  const walk = (bs) => bs?.forEach((c) => (c.type === 'text' && c.text && !c.hidden && texts.push(c), walk(c.children)));
  walk(b.children);
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
          out.push({ id: `${layer}:${b.id}`, layer, x: b.x, y: b.y, w: b.w, h: b.h, label: labelOf(b), link: b.link ?? null, screen: b.screen ?? null, group: `${layer}:${parent}`, coming: Boolean(b.coming) });
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
