// Quick chat over a pilot drawn on the page (the ship tags on the universe
// map and the galaxy, the page pointers): a bubble inside their tag, which
// pilots.js and its node twin set every frame they draw the tag, so it
// touches the page only when the line changes. The line comes from
// client.quip(id) (quips.js: a set line, or null once it's old). Its look is
// online.css's .quip-bubble, which sits it above the tag it's inside without
// changing the tag's size; in a world it's lib/three/quipSprite.js instead.
// Out of the tag’s flow, it isn’t kept on screen with the tag: the map’s
// tags measure it into their own room (tagRules.js’s keepIn), and a page
// pointer moves it across with quipShift, its tail still on the tag.
//
// quipEl(doc) → a span.quip-bubble, hidden, for a tag to hold
// setQuip(el, text | null) → whether it changed the bubble: the line shown,
//   or the bubble hidden (null, or anything that isn’t a line)
// quipLine(text) → the line, or null for anything setQuip would hide
// quipShift(mid, w, boxW) → px to move a bubble `w` wide, centred at `mid`,
//   so all of it is inside a box `boxW` wide (QUIP_PAD clear of each edge)
// shiftQuip(el, px): that shift, written (as --quip-shift) only on a change

export const QUIP_PAD = 4; // px kept clear of the box’s edge (as tagRules.js keeps a tag)

export function quipEl(doc) {
  const el = doc.createElement('span');
  el.className = 'quip-bubble';
  // (it's set every frame the tag is drawn, and a mate's line is in the feed
  // already: a screen reader isn't read each one again from over a ship)
  el.setAttribute('aria-live', 'off');
  el.hidden = true;
  return el;
}

export const quipLine = (text) => (typeof text === 'string' && text ? text : null);

export function setQuip(el, text) {
  if (!el) return false;
  const line = quipLine(text);
  if (line === null) {
    // the words stay while it fades out (online.css), so it doesn't shrink as it goes
    if (el.hidden) return false;
    el.hidden = true;
    return true;
  }
  let changed = false;
  if (el.textContent !== line) {
    el.textContent = line;
    changed = true;
  }
  if (el.hidden) {
    el.hidden = false;
    changed = true;
  }
  return changed;
}

export function quipShift(mid, w, boxW, pad = QUIP_PAD) {
  if (!(boxW > 0)) return 0; // (no box measured yet: nothing to keep it in)
  const start = mid - w / 2;
  // (wider than the box: its start kept in, where a line is read from)
  if (start < pad || w + pad * 2 >= boxW) return pad - start;
  const over = start + w - (boxW - pad);
  return over > 0 ? -over : 0;
}

// (what each bubble was last moved by, so a frame that moves it no further writes nothing)
const shifted = new WeakMap();
export function shiftQuip(el, px) {
  if (!el) return;
  const v = `${Math.round(px)}px`;
  if (shifted.get(el) === v) return;
  shifted.set(el, v);
  el.style.setProperty('--quip-shift', v);
}
