// Quick chat over a pilot drawn on the page (the ship tags on the universe
// map and the galaxy, the page pointers): a bubble inside their tag, which
// pilots.js and its node twin set every frame they draw the tag, so it
// touches the page only when the line changes. The line comes from
// client.quip(id) (quips.js: a set line, or null once it's old). Its look is
// online.css's .quip-bubble, which sits it above the tag it's inside without
// changing the tag's size; in a world it's lib/three/quipSprite.js instead.
//
// quipEl(doc) → a span.quip-bubble, hidden, for a tag to hold
// setQuip(el, text | null): the line shown, or the bubble hidden (null, or
//   anything that isn't a line)

export function quipEl(doc) {
  const el = doc.createElement('span');
  el.className = 'quip-bubble';
  // (it's set every frame the tag is drawn, and a mate's line is in the feed
  // already: a screen reader isn't read each one again from over a ship)
  el.setAttribute('aria-live', 'off');
  el.hidden = true;
  return el;
}

export function setQuip(el, text) {
  if (!el) return;
  const line = typeof text === 'string' && text ? text : null;
  if (line === null) {
    // the words stay while it fades out (online.css), so it doesn't shrink as it goes
    if (!el.hidden) el.hidden = true;
    return;
  }
  if (el.textContent !== line) el.textContent = line;
  if (el.hidden) el.hidden = false;
}
