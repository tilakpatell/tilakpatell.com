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
    if (capture && e.pointerId != null) {
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
      const tapped = edges(pad, padBefore);
      padBefore = pad;
      const held = new Set(keys);
      const now = pressed;
      pressed = new Set();
      const action = (name) => (actions[name] ?? []).some((code) => held.has(code));
      const axis = (name) => {
        const pair = axes[name];
        if (!pair) return 0;
        return (action(pair[1]) ? 1 : 0) - (action(pair[0]) ? 1 : 0);
      };
      // the drag: how far the pointer moved since the last sample, while it's down
      const drag = pointer.down && (pointer.dx || pointer.dy) ? { dx: pointer.dx, dy: pointer.dy } : null;
      pointer.dx = pointer.dy = 0;
      return { keys: held, pressed: now, pad, tapped, pointer: { x: pointer.x, y: pointer.y, down: pointer.down, drag }, stick: { x: stick.x, y: stick.y }, action, axis };
    },
  };
}
