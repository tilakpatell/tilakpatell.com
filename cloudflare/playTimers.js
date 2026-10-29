// The engine's load kept going while its tab is in the background (docs/decisions/2026-10-28-hoth-on-bf2-web.md).
// bf2-web's play page runs stages that only move when it polls them, each poll a setTimeout of 0 or 2 ms, under a
// deadline of the clock's: the effects' atlases (one resource update per poll, 60 s: tests/original-game-frame.mjs's
// atlas poll, original-world-effects.inc's fg_world_atlas_poll), the warm-up's frames (180 s each, runtime/
// world-startup.mjs). A browser runs a hidden tab's timers once a second at most, and once a minute after five minutes
// hidden (another tab in front, or on Windows another window over the browser's), so the poll misses its deadline and
// the round goes back to the menu (world-play.mjs's finish: play-instance-failed: atlas load timed out). While the page
// is hidden, this answers a short timer (4 ms or less) through a MessageChannel, which the browser doesn't hold back;
// a longer one, and every timer while the page is shown, is the browser's own.
//
//   steadyTimers(win)   the page's side: win.setTimeout and win.clearTimeout, wrapped
//
// steadyTimers runs in the page as its source text, so it may not reach outside itself.

export function steadyTimers(win) {
  if (typeof win.MessageChannel !== 'function' || typeof win.setTimeout !== 'function') return;
  const doc = win.document;
  const later = win.setTimeout;
  const cancel = win.clearTimeout;
  const channel = new win.MessageChannel();
  const due = new Map();
  const order = [];
  // (ids of their own, above any the browser hands out in a page's life)
  let next = 2 ** 30;
  channel.port1.onmessage = () => {
    const id = order.shift();
    const run = due.get(id);
    if (!run) return;
    due.delete(id);
    run();
  };
  win.setTimeout = function (fn, ms, ...args) {
    if (!doc.hidden || typeof fn !== 'function' || ms > 4) return later.call(win, fn, ms, ...args);
    const id = next++;
    due.set(id, () => fn(...args));
    order.push(id);
    channel.port2.postMessage(0);
    return id;
  };
  win.clearTimeout = function (id) {
    if (due.delete(id)) return;
    return cancel.call(win, id);
  };
}
