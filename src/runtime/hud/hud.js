// Where a world's HUD puts things: rules only, so that what overlapped before
// can't. Every world's HUD (./Hud.jsx and the parts beside it) is laid out by
// these; the numbers match ./hud.css's tokens, which say the same in CSS.
// Grown from the Invincible world's (its compass, its title chip, its
// objective line, its markers), which was the one HUD laid out by tested
// rules (docs/research/2026-10-07-tours-and-ui-audit/ui-worlds-verified.md).

// --hud-pad: clamp(0.75rem, 2vw, 1.25rem), in px for a stage `width` px wide
export const padFor = (width) => Math.min(20, Math.max(12, width * 0.02));
// --guide-reserve: the site's "?" (right 16 px, 42 px wide) and a gap
export const GUIDE_RESERVE = 16 + 42 + 0.9 * 16;
// the gap between things stacked in one column
export const GAP = 8;

// The three rows, in px from the stage's edges: `top`, how far down the
// first thing under the top row may start (under the buttons however many
// rows they wrap to: `buttonsBottom`, measured); `thumbs`, how far up the
// touch row sits; `foot`, how far up the prompt's row sits. Whichever of the
// two is lower sits at the pad (or the phone's home bar, if that's more);
// the other over it, by its measured height and a gap. `order`:
// 'thumbs-under' (the thumbs low, the prompt over them) or 'thumbs-over'
// (the foot low, the thumbs over it: a world whose foot is an instrument).
export function layoutRows({ width, touch = false, order = 'thumbs-under', buttonsBottom = 0, thumbsHeight = 0, footHeight = 0, safeBottom = 0 }) {
  const pad = padFor(width);
  const low = Math.max(pad, safeBottom);
  const top = Math.max(pad + 2.45 * 16, buttonsBottom + 6);
  let foot = low;
  let thumbs = low;
  if (touch && order === 'thumbs-over') thumbs = footHeight > 0 ? low + footHeight + GAP : low;
  else if (touch && thumbsHeight > 0) foot = low + thumbsHeight + GAP;
  return { pad, top: Math.round(top), foot: Math.round(foot), thumbs: Math.round(thumbs) };
}

// Things stacked down a column from `from` px, `gap` apart: the top of each.
export function stackUnder(heights, { from = 0, gap = GAP } = {}) {
  const tops = [];
  let y = from;
  for (const h of heights) {
    tops.push(Math.round(y));
    y += Math.max(0, h || 0) + gap;
  }
  return tops;
}

// 'full' (the world's title in its own face) until 2.5 s after the player
// first moves, or at once when there's an objective: then 'chip', out of the
// way of what's under it. (Invincible's signature, which its tests keep.)
export const titleMode = (t, movedAt, objectiveOn) => (objectiveOn || (movedAt != null && t - movedAt >= 2.5) ? 'chip' : 'full');

// metres under a kilometre, kilometres to a decimal over it
export const far = (d) => (d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);

// The objective line: the step's words and how far it is ("Get to the bank
// · 250 m"). `step`: { text }, or null for none.
export function objectiveText(step, dist) {
  if (!step) return '';
  return [step.text, dist == null || !Number.isFinite(dist) ? null : far(dist)].filter(Boolean).join(' · ');
}

// The prompt, key first as the guide writes its rows ("E Go in · Burger
// Mart"); on touch there's no key, the prompt is the button.
export function promptText({ key = 'E', verb = '', thing = '', touch = false } = {}) {
  const words = [verb, thing].filter(Boolean).join(' · ');
  return touch || !key ? words : `${key} ${words}`.trim();
}

// "N others here" (the glossary's players chip), or null when you're alone;
// with your allies among them (the roster's: the same key in every room),
// "· 1 ally", "· 2 allies", or "· your ally" when they're the only one here.
export const alliesText = (allies, count = Infinity) => (allies > 0 ? (allies === 1 && count === 1 ? 'your ally' : `${allies} ${allies === 1 ? 'ally' : 'allies'}`) : null);
export const othersText = (count, allies = 0) => {
  if (!(count > 0)) return null;
  const others = `${count} ${count === 1 ? 'other' : 'others'} here`;
  const who = alliesText(allies, count);
  return who ? `${others} · ${who}` : others;
};

export const COMPASS = { span: Math.PI * 0.9, gap: 72, reserve: 220, markerMin: 24, markerMax: 72, fov: 64 };

// A compass strip: `marks` [{ id, label, bearing }] nearest first, bearing in
// radians from straight ahead (+ to the right) → [{ id, label, x, row,
// clipped, side }]: x px along the strip; side 'left' or 'right' when it's
// off that end (x at the end) or under the buttons (the `reserve` px at the
// strip's right end), 'crowd' when both rows are full there. Labels keep
// `gap` px apart, stacking on a second row when they'd touch. `taken`: x of
// what's already on the first row (the headings, a letter each), which a
// name keeps half a gap clear of.
export function layoutCompass(marks, width, { span = COMPASS.span, gap = COMPASS.gap, reserve = COMPASS.reserve, taken = [] } = {}) {
  const rows = [[], []];
  const fixed = taken.map((x) => ({ x, gap: gap / 2 }));
  return marks.map((m) => {
    const x = width / 2 + (m.bearing / span) * width;
    const out = { id: m.id, label: m.label, x, row: 0, clipped: false, side: null };
    if (x < 0) return { ...out, x: 0, clipped: true, side: 'left' };
    if (x > width) return { ...out, x: width, clipped: true, side: 'right' };
    // (the buttons' corner: the menu sits over the strip's right end when the stage is narrow)
    if (reserve > 0 && reserve < width && x > width - reserve) return { ...out, clipped: true, side: 'right' };
    const clear = (r, i) => r.every((p) => Math.abs(p - x) >= gap) && (i > 0 || fixed.every((f) => Math.abs(f.x - x) >= f.gap));
    const row = rows.findIndex(clear);
    if (row < 0) return { ...out, clipped: true, side: 'crowd' };
    rows[row].push(x);
    return { ...out, row };
  });
}

// The marker's size on screen (px) for a target `dist` m off on a canvas
// `height` px tall: a 6 m chevron as the camera sees it, never under 24 px.
export function markerSize(dist, height, { min = COMPASS.markerMin, max = COMPASS.markerMax, fov = COMPASS.fov } = {}) {
  const px = (6 / (2 * Math.max(0.1, dist) * Math.tan((fov * Math.PI) / 360))) * height;
  return Math.round(Math.min(max, Math.max(min, px)));
}

// A touch stick's reading from where the thumb went down (`x0`, `y0`) to
// where it is: a vector no longer than 1 (a diagonal is no faster than
// straight on) over `reach` px, nothing inside the `dead` zone (a resting
// thumb's jitter doesn't creep), and the knob's offset in px, inside the ring.
export const STICK = { ring: 116, knob: 46, throw: 44, travel: 26, dead: 0.1 };
export function stickRead(x0, y0, x, y, { reach = STICK.throw, travel = STICK.travel, dead = STICK.dead } = {}) {
  const dx = (x - x0) / reach;
  const dy = (y - y0) / reach;
  const m = Math.hypot(dx, dy);
  const k = m > 1 ? 1 / m : 1;
  const kx = dx * k;
  const ky = dy * k;
  const knob = [Math.round(kx * travel * 100) / 100, Math.round(ky * travel * 100) / 100];
  if (m <= dead) return { x: 0, y: 0, knob };
  const out = (Math.min(1, m) - dead) / (1 - dead) / Math.min(1, m);
  return { x: kx * out, y: ky * out, knob };
}

// A minimap's disc, in CSS px: 240 on a wide screen, 160 on a phone or a
// narrow one (the guide's "?" and the touch row keep their room), under the
// top row on the right, the guide's corner's opposite end of that column.
export const MINIMAP = { size: 240, phone: 160, narrow: 640, hz: 10 };
export const minimapSize = (width, touch = false) => (touch || width < MINIMAP.narrow ? MINIMAP.phone : MINIMAP.size);

// A world's level paused by its data budget (lane N4: the stream stops asking
// for finer rows and LODs past the quality level's `visitMB`): the toast's
// one line when the pause begins, null otherwise (its end says nothing)
export const DETAIL_PAUSED = Object.freeze({ title: 'Detail paused', text: 'Detail paused by the data budget; a higher quality level raises it.' });
export const detailToast = (was, now) => (now && !was ? DETAIL_PAUSED : null);

// The letterbox (./Letterbox.jsx): two bars, top and bottom, while a scene
// holds. Never on a phone held upright (the picture is narrow enough), under
// reduced motion, or when the visitor has turned it off. A bar is BAR of the
// height (the kit's --hud-bar), under the prompt's reserve at the foot.
export const LETTERBOX = { bar: 0.07 };
export const letterbox = ({ holding = false, portrait = false, reduced = false, off = false } = {}) => Boolean(holding) && !portrait && !reduced && !off;
