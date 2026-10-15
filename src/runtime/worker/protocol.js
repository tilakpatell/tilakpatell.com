// The messages between the page and a world run in a worker (lane FL5,
// the engine floor's §4.8): the page keeps what cannot cross (React, the
// HUD's DOM, the AudioContext, localStorage, the input's listeners) and
// posts the rest; the worker makes the runtime on an OffscreenCanvas and
// draws there. Pure, so the shapes are tested without a worker.
//
// Up (page → worker): init { canvas, module, props, search, hash, dpr, w, h,
//   level, saves }, input { snapshot }, resize { w, h, ratio }, visible { on },
//   quality { level }, props { props }, kick, unmount, result { id, value, error }.
// Down (worker → page): ready { backend }, failed { message }, event { type,
//   data }, hud { values }, frame { ms, gpu, at }, lost { reason, kind },
//   call { id, name, args }, bind { actions, axes }.
//
// packInput(snapshot) → what structured clone carries (input.js's sample()
// with its Sets as arrays and its functions left behind); unpackInput(packed,
// { actions, axes }) → the snapshot again, `action` and `axis` answered from
// the bindings the world made in the worker; mergeInput(a, b) → one packed
// snapshot for two page samples the worker had only one frame for.

export const MESSAGES = Object.freeze({
  up: Object.freeze({ init: 'init', input: 'input', resize: 'resize', visible: 'visible', quality: 'quality', props: 'props', kick: 'kick', unmount: 'unmount', result: 'result' }),
  down: Object.freeze({ ready: 'ready', failed: 'failed', event: 'event', hud: 'hud', frame: 'frame', lost: 'lost', call: 'call', bind: 'bind' }),
});

// The page's services a world in the worker may ask for, by name. Only the
// ones whose answer can be cloned: `saves.watch` takes a callback and
// `audio.bus` hands back an AudioNode, so neither crosses (README).
export const CALLS = Object.freeze(['saves.set', 'saves.remove', 'saves.session.set', 'saves.session.remove', 'store.get', 'store.set', 'store.remove', 'store.list', 'audio.fadeOut']);

const plainPointer = (p) => ({ x: p?.x ?? 0, y: p?.y ?? 0, down: Boolean(p?.down), drag: p?.drag ? { dx: p.drag.dx, dy: p.drag.dy } : null });

export function packInput(s) {
  return {
    keys: [...(s?.keys ?? [])],
    pressed: [...(s?.pressed ?? [])],
    pad: s?.pad ? { ...s.pad } : null,
    tapped: { ...(s?.tapped ?? {}) },
    pointer: plainPointer(s?.pointer),
    stick: { x: s?.stick?.x ?? 0, y: s?.stick?.y ?? 0 },
  };
}

// (the same answers as input.js's sample(): a bound action is on while any
// of its codes is held; an axis is its positive action less its negative)
export function unpackInput(p, { actions = {}, axes = {} } = {}) {
  const keys = new Set(p?.keys ?? []);
  const action = (name) => (actions[name] ?? []).some((code) => keys.has(code));
  const axis = (name) => {
    const pair = axes[name];
    if (!pair) return 0;
    return (action(pair[1]) ? 1 : 0) - (action(pair[0]) ? 1 : 0);
  };
  return { keys, pressed: new Set(p?.pressed ?? []), pad: p?.pad ?? null, tapped: { ...(p?.tapped ?? {}) }, pointer: plainPointer(p?.pointer), stick: { x: p?.stick?.x ?? 0, y: p?.stick?.y ?? 0 }, action, axis };
}

// Held is what's held in the later sample; a press, a pad's tap and the
// drag are what happened in either, so a press the page saw in a frame the
// worker never drew still reaches the world once.
export function mergeInput(a, b) {
  if (!a) return b;
  if (!b) return a;
  const da = a.pointer.drag;
  const db = b.pointer.drag;
  const drag = da || db ? { dx: (da?.dx ?? 0) + (db?.dx ?? 0), dy: (da?.dy ?? 0) + (db?.dy ?? 0) } : null;
  return {
    keys: b.keys,
    pressed: [...new Set([...a.pressed, ...b.pressed])],
    pad: b.pad,
    tapped: { ...a.tapped, ...b.tapped },
    pointer: { ...b.pointer, drag: b.pointer.down ? drag : null },
    stick: b.stick,
  };
}
