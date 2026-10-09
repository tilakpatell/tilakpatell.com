// Who has the floor: every voice the site plays (a line in its speaker's own
// voice, lib/voiced.js; a crew's line on the comms; a speaking clip) asks
// here first, so only one voice is ever heard at a time.
//
// How a line asks (`mode`):
//   cut      the visitor just asked for it (a click, the next line of a
//            conversation): what's being said fades, and this starts
//   queue    it came by itself (a toast, a story beat, the intercom): it waits
//            for the one being said to finish and a breath after; only the
//            newest waits, and one kept waiting too long isn't said at all
//   ambient  a passing remark (a bark, a hover): said only into a quiet that
//            has lasted, else not at all
// Left out, it's `cut` if the visitor has just pressed something and `queue`
// otherwise, so a line set off by a click answers it and one set off by the
// world waits its turn.
//
// say(key, start, { mode, tag, keep }) asks for the floor. `start(alive)`
// loads and plays the line, checking `alive()` before it makes a sound, and
// resolves to a handle ({ stop(), ended }) or null. The promise say returns
// resolves to that handle, or to null if the line isn't said (overtaken,
// stale, muted, failed); its stop() takes the line back, waiting or playing.
// The same `key` asked for again while it's said or waiting is the same line.
// `tag` says whose lines they are, for stop(tag); `keep` lines go on across
// pages (stopPage).

import { onVoicesChange, voicesOn } from './audio';

export const FADE = 150; // ms: a line cut short fades for 0.12 s (lib/clips)
export const GAP = 300; // ms of quiet between one line and the next
export const REST = 1200; // ms of quiet before a passing remark
export const WAIT = 4000; // ms a line may wait before it's too late to say it
export const PRESSED = 500; // ms after a press that a line counts as asked for

export function createSpeech({ now = () => performance.now(), recentInput = () => false, muted = () => false } = {}) {
  let floor = null; // the line being said (or loading)
  let pending = null; // the one line waiting
  let lastEnd = -Infinity; // when the last line was over
  let quietAt = -Infinity; // when a cut line has faded

  const settle = (req, h) => {
    if (req.settled) return;
    req.settled = true;
    req.resolve(h);
  };

  function release(req, said = true) {
    if (floor !== req) return;
    floor = null;
    if (said) lastEnd = now();
    pump();
  }

  function cancel(req) {
    if (req.cancelled) return;
    req.cancelled = true;
    if (pending === req) {
      pending = null;
      clearTimeout(req.expiry);
      settle(req, null);
    } else if (floor === req) {
      if (req.handle) {
        req.handle.stop();
        quietAt = now() + FADE;
      }
      settle(req, null);
      release(req, !!req.handle);
    } else settle(req, null);
  }

  async function begin(req, delay) {
    floor = req;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    if (req.cancelled) return;
    let h = null;
    try {
      h = await req.start(() => !req.cancelled);
    } catch {
      h = null;
    }
    if (req.cancelled) {
      h?.stop();
      return;
    }
    if (!h) {
      settle(req, null);
      release(req, false);
      return;
    }
    req.handle = h;
    settle(req, h);
    Promise.resolve(h.ended).then(
      () => release(req),
      () => release(req),
    );
  }

  function pump() {
    if (floor || !pending) return;
    const req = pending;
    pending = null;
    clearTimeout(req.expiry);
    begin(req, Math.max(lastEnd + GAP, quietAt) - now());
  }

  function say(key, start, { mode, tag = null, keep = false } = {}) {
    if (floor && floor.key === key && !floor.cancelled) return floor.promise;
    if (pending && pending.key === key) return pending.promise;
    const req = { key, start, tag, keep };
    req.promise = new Promise((resolve) => (req.resolve = resolve));
    req.promise.stop = () => cancel(req);
    if (muted()) {
      settle(req, null);
      return req.promise;
    }
    const how = mode ?? (recentInput() ? 'cut' : 'queue');
    if (how === 'cut') {
      if (pending) cancel(pending);
      if (floor) cancel(floor);
      begin(req, quietAt - now());
    } else if (how === 'ambient') {
      if (floor || pending || now() - lastEnd < REST) settle(req, null);
      else begin(req, quietAt - now());
    } else {
      if (pending) cancel(pending);
      pending = req;
      req.expiry = setTimeout(() => pending === req && cancel(req), WAIT);
      pump();
    }
    return req.promise;
  }

  // Stops what's said and what's waiting: every line, or a `tag`'s.
  function stop(tag) {
    const mine = (req) => req && (tag === undefined || req.tag === tag);
    if (mine(pending)) cancel(pending);
    if (mine(floor)) cancel(floor);
  }

  // A new page: the lines that don't go on across pages stop.
  function stopPage() {
    if (pending && !pending.keep) cancel(pending);
    if (floor && !floor.keep) cancel(floor);
  }

  // `mode` left out, as say would take it now: for a caller that asks later
  // (after a lookup) but was set off by whatever happened just now
  const mode = () => (recentInput() ? 'cut' : 'queue');

  return { say, stop, stopPage, mode, busy: () => !!floor };
}

// The site's one floor. A press counts as asking (a click, a tap, a key) but
// not a key held down or one that only moves you about, so the lines the
// world says while you walk wait their turn.
const MOVES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Tab', 'CapsLock']);
let pressedAt = -Infinity;
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  const press = (e) => {
    if (e.type === 'keydown' && (e.repeat || MOVES.has(e.code))) return;
    pressedAt = performance.now();
  };
  window.addEventListener('pointerup', press, { capture: true, passive: true });
  window.addEventListener('keydown', press, { capture: true, passive: true });
}
export const speech = createSpeech({ recentInput: () => performance.now() - pressedAt < PRESSED, muted: () => !voicesOn() });
onVoicesChange((on) => on || speech.stop());
