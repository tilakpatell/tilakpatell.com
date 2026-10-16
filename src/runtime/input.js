// One input snapshot a frame: the keys held (never while typing in a field,
// never a modifier combo), the ones pressed since the last sample, the
// gamepad and its presses, the pointer in the host box with its drag since
// the last sample, and the touch stick a page writes. A module binds names
// to codes once (`bind`), and the snapshot answers `action(name)` and
// `axis(name)`; the default is prevented only for bound keys, so the page's
// own shortcuts keep working. Everything is cleared on blur and on detach,
// so no key is held across a world change.
//
// createInput({ readPad, typing }) → { attach({ win, host }), detach(),
//   bind(actions, { axes }), unbind(), bindings(), setStick(x, y), sample(now) }
// The snapshot: { keys, pressed, pad, tapped, pointer: { x, y, down, drag },
//   stick: { x, y }, action(name), axis(name) }

import { edges, readPad as readGamepad, typing as inField } from '../components/games/pad';

// (typing needs the DOM: in Node nothing is a field)
const safeTyping = (t) => typeof HTMLElement !== 'undefined' && inField(t);
const NO_TAPS = Object.freeze({});

export function createInput({ readPad = readGamepad, typing = safeTyping, capture = true } = {}) {
  const keys = new Set();
  let pressed = new Set();
  let actions = {}; // name → codes
  let axes = {}; // name → [negative action, positive action]
  let bound = new Set(); // every bound code
  const stick = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0, down: false, id: null, lastX: 0, lastY: 0, dx: 0, dy: 0 };
  let padBefore = null;
  let win = null;
  let host = null;
  // The snapshot, one for the input's life and refreshed by each sample: a
  // new Set, the pointer's and the stick's objects and two closures every
  // frame were garbage on the runtime's path (the every-world hand-off's
  // performance item 2). It is the frame's: a world reads it in its step and
  // keeps nothing of it.
  const held = new Set();
  let spare = new Set();
  const drag = { dx: 0, dy: 0 };
  const action = (name) => {
    const codes = actions[name];
    if (!codes) return false;
    for (const code of codes) if (held.has(code)) return true;
    return false;
  };
  const axis = (name) => {
    const pair = axes[name];
    if (!pair) return 0;
    return (action(pair[1]) ? 1 : 0) - (action(pair[0]) ? 1 : 0);
  };
  const snap = { keys: held, pressed: null, pad: null, tapped: NO_TAPS, pointer: { x: 0, y: 0, down: false, drag: null }, stick: { x: 0, y: 0 }, action, axis };

  const onKeyDown = (e) => {
    if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (bound.has(e.code)) e.preventDefault();
    if (!e.repeat && !keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const clear = () => {
    keys.clear();
    pressed.clear();
    stick.x = stick.y = 0;
    pointer.down = false;
    pointer.id = null;
    pointer.dx = pointer.dy = 0;
    padBefore = null;
  };
  const place = (e) => {
    const r = host.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
  };
  const onPointerDown = (e) => {
    if (pointer.down) return;
    place(e);
    pointer.down = true;
    pointer.id = e.pointerId;
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
    pointer.dx = pointer.dy = 0;
    // Not when the press is on something in the box that took the pointer
    // itself (a fromScene module's canvas, for its own drag: the galaxy's)
    // or on one of the page's controls over the world: captured to the box,
    // their moves, their release and their click all went to the box, so the
    // galaxy's drag never steered and its buttons never answered
    const t = e.target;
    const theirs = t && t !== host && (t.hasPointerCapture?.(e.pointerId) || t.closest?.('button, a, input, select, textarea, label, [role="button"]'));
    if (capture && e.pointerId != null && !theirs) {
      try {
        host.setPointerCapture?.(e.pointerId);
      } catch {
        /* a pointer that's gone already */
      }
    }
  };
  const onPointerMove = (e) => {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    place(e);
    pointer.dx += pointer.x - pointer.lastX;
    pointer.dy += pointer.y - pointer.lastY;
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  };
  const onPointerUp = (e) => {
    if (e.pointerId !== pointer.id) return;
    place(e);
    pointer.down = false;
    pointer.id = null;
    try {
      if (host.hasPointerCapture?.(e.pointerId)) host.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return {
    attach(targets) {
      this.detach();
      win = targets.win;
      host = targets.host;
      win.addEventListener('keydown', onKeyDown);
      win.addEventListener('keyup', onKeyUp);
      win.addEventListener('blur', clear);
      host.addEventListener('pointerdown', onPointerDown);
      host.addEventListener('pointermove', onPointerMove);
      host.addEventListener('pointerup', onPointerUp);
      host.addEventListener('pointercancel', onPointerUp);
    },
    detach() {
      if (win) {
        win.removeEventListener('keydown', onKeyDown);
        win.removeEventListener('keyup', onKeyUp);
        win.removeEventListener('blur', clear);
      }
      if (host) {
        host.removeEventListener('pointerdown', onPointerDown);
        host.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerup', onPointerUp);
        host.removeEventListener('pointercancel', onPointerUp);
      }
      win = host = null;
      clear();
    },
    bind(names, { axes: ax = {} } = {}) {
      actions = { ...names };
      axes = { ...ax };
      bound = new Set(Object.values(actions).flat());
    },
    unbind() {
      actions = {};
      axes = {};
      bound = new Set();
    },
    // what's bound now, to bind again later (a handover that fails gives the old world its keys back)
    bindings: () => ({ actions: { ...actions }, axes: { ...axes } }),
    setStick(x, y) {
      stick.x = x;
      stick.y = y;
    },
    sample() {
      const pad = readPad() ?? null;
      // (no pad, nothing tapped: the one empty answer, not a new one a frame)
      snap.tapped = pad ? edges(pad, padBefore) : NO_TAPS;
      snap.pad = pad;
      padBefore = pad;
      held.clear();
      for (const code of keys) held.add(code);
      // the presses since the last sample handed out; the other set,
      // emptied, fills until the next (they take turns)
      snap.pressed = pressed;
      pressed = spare;
      pressed.clear();
      spare = snap.pressed;
      // the drag: how far the pointer moved since the last sample, while it's down
      const p = snap.pointer;
      p.x = pointer.x;
      p.y = pointer.y;
      p.down = pointer.down;
      if (pointer.down && (pointer.dx || pointer.dy)) {
        drag.dx = pointer.dx;
        drag.dy = pointer.dy;
        p.drag = drag;
      } else p.drag = null;
      pointer.dx = pointer.dy = 0;
      snap.stick.x = stick.x;
      snap.stick.y = stick.y;
      return snap;
    },
  };
}
