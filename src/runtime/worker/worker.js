// The runtime in a module worker (lane FL5): the page transfers its
// world's canvas as an OffscreenCanvas and this makes the runtime on it,
// imports the module by id, mounts it and runs its loop on the worker's
// own requestAnimationFrame, so a long task on the page (React, the HUD, a
// garbage collection) no longer holds the frame back. What cannot cross
// stays on the page (host.js) behind the same faces: the input is a
// snapshot store the page feeds each of its frames; the saves read what
// the page sent at init and write through; the store and the audio's fade
// are calls the page answers; `rt.hud(values)` posts a world's numbers for
// the page to write. Protocol: protocol.js.
//
// serve(scope, { load, now }) wires `scope.onmessage`; `load()` brings the
// runtime's parts in at the first init (so the test hands fakes, and a
// worker that is never asked to draw never downloads three.js).

import { CALLS, MESSAGES, mergeInput, unpackInput } from './protocol';

const { up, down } = MESSAGES;

// The worlds a worker can draw, by id. Only a module whose `create` touches
// neither `document` nor `window` is a candidate (the README lists what
// Battlefront's touches); a page asking for another gets `failed`, and its
// host mounts it on the page instead.
export const MODULES = {
  litWorld: () => import('../fixtures/litWorld.js'),
};

// The input's face as the runtime and a world use it (input.js's), fed by
// the page's snapshots. A press or a drag the page saw between two of this
// worker's frames is merged, never dropped, and handed over once.
export function createInputStore(post) {
  let pending = null;
  let held = null; // the last snapshot, held keys and pointer, once its presses are taken
  let actions = {};
  let axes = {};
  return {
    attach() {},
    detach() {
      pending = held = null;
    },
    at: null, // the page's clock (on the epoch) at the sample the last frame read
    seen: null, // and at the newest it was sent
    take(packed, at = null) {
      pending = mergeInput(pending, packed);
      this.seen = at;
    },
    bind(names, { axes: ax = {} } = {}) {
      actions = { ...names };
      axes = { ...ax };
      post({ type: down.bind, actions, axes });
    },
    unbind() {
      actions = {};
      axes = {};
      post({ type: down.bind, actions, axes });
    },
    bindings: () => ({ actions: { ...actions }, axes: { ...axes } }),
    setStick() {}, // (the page's touch stick writes the page's input)
    sample() {
      this.at = this.seen;
      const now = pending ?? held;
      if (pending) held = { ...pending, pressed: [], tapped: {}, pointer: { ...pending.pointer, drag: null } };
      pending = null;
      return unpackInput(now, { actions, axes });
    },
  };
}

// (`epoch`: the clock the page's input times are on, timeOrigin the two share
// though each starts its own performance.now)
// What three reaches for that a worker has not: `new Image()` (SMAANode's
// two look-up tables, given as data: URLs). Without it the game light's
// chain failed to build and the worker drew black. The stand-in is an
// OffscreenCanvas, which three uploads as it would an image, with `src`
// decoded into it and `onload` called after, as an image's is.
export function imageShim(scope, { decode = (url) => fetch(url).then((r) => r.blob()).then((b) => scope.createImageBitmap(b)) } = {}) {
  if (typeof scope.Image !== 'undefined' || typeof scope.OffscreenCanvas !== 'function') return false;
  scope.Image = function WorkerImage() {
    const el = new scope.OffscreenCanvas(1, 1);
    let src = '';
    el.onload = null;
    el.onerror = null;
    el.complete = false;
    Object.defineProperty(el, 'src', {
      get: () => src,
      set(url) {
        src = url;
        decode(url).then(
          (bitmap) => {
            el.width = bitmap.width;
            el.height = bitmap.height;
            el.getContext('2d').drawImage(bitmap, 0, 0);
            bitmap.close?.();
            el.complete = true;
            el.onload?.({ target: el });
          },
          (err) => el.onerror?.(err),
        );
      },
    });
    return el;
  };
  return true;
}

export function serve(scope, { load, now = () => performance.now(), epoch = () => performance.timeOrigin + performance.now() }) {
  const post = (m, transfer) => {
    try {
      scope.postMessage(m, transfer ?? []);
    } catch (err) {
      // (a world's event with something in it that cannot be cloned: said once, not thrown into its frame)
      scope.postMessage({ type: down.failed, message: `could not post ${m?.type}: ${err?.message ?? err}`, soft: true });
    }
  };
  const input = createInputStore(post);
  let rt = null;
  let size = { w: 1, h: 1 };
  let visible = true;
  let calls = 0;
  const waiting = new Map(); // a call's id → its resolve and reject
  const call = (name, args) =>
    new Promise((resolve, reject) => {
      const id = ++calls;
      waiting.set(id, { resolve, reject });
      post({ type: down.call, id, name, args });
    });
  const tell = (name, args) => {
    if (CALLS.includes(name)) post({ type: down.call, id: 0, name, args });
  };

  // the saves as a world reads them: synchronous, so from a copy the page
  // sent at init (the keys its module names, host.js), written through
  const savesOf = (kept) => {
    const local = new Map(Object.entries(kept ?? {}));
    const session = new Map();
    const face = (map, prefix) => ({
      get: (key, fallback = null) => (map.has(key) ? map.get(key) : fallback),
      set(key, value) {
        map.set(key, value);
        tell(`${prefix}set`, [key, value]);
      },
      remove(key) {
        map.delete(key);
        tell(`${prefix}remove`, [key]);
      },
    });
    return { ...face(local, 'saves.'), session: face(session, 'saves.session.'), watch: () => () => {}, register: () => {} };
  };
  const store = {
    ready: Promise.resolve(),
    get: (...a) => call('store.get', a),
    read: (...a) => call('store.get', a),
    set: (...a) => call('store.set', a),
    remove: (...a) => call('store.remove', a),
    list: (...a) => call('store.list', a),
  };
  const audio = {
    bus() {
      throw new Error('the AudioContext is the page’s: a world in a worker has no audio bus');
    },
    fadeOut: (ms) => tell('audio.fadeOut', [ms]),
  };

  let closed = false; // told to let go: a start still on its way stops at its next await
  // (the worker's own beats where it has them, as Chromium's and Firefox's
  // dedicated workers do; a timer's where it has not)
  const beats = typeof scope.requestAnimationFrame === 'function' ? {} : { raf: (f) => setTimeout(() => f(now()), 16), caf: (id) => clearTimeout(id) };
  const start = async (m) => {
    const open = MODULES[m.module] ?? null;
    if (!open) {
      post({ type: down.failed, message: `no worker door for the module ${m.module}` });
      return;
    }
    size = { w: m.w ?? 1, h: m.h ?? 1 };
    const parts = await load();
    if (closed) return;
    const modules = parts.modules ?? MODULES;
    const canvas = m.canvas;
    // (three's setSize writes the canvas's style, which an OffscreenCanvas has not)
    if (canvas && !canvas.style) canvas.style = {};
    // (ready once a frame is drawn, as the page runtime's 'on' is: the page's
    // box keeps its canvas clear till then)
    let told = false;
    const tellReady = () => {
      if (told || rt?.status !== 'on') return;
      told = true;
      post({ type: down.ready, backend: rt.gfx?.backend ?? null });
    };
    const timed = (step, opts) =>
      parts.createLoop((t) => {
        const began = now();
        const more = step(t);
        tellReady();
        const clock = rt?.gpuClock;
        post({ type: down.frame, ms: now() - began, at: t, gpu: clock?.available ? (clock.last ?? null) : null, inputAt: input.at, drawnAt: epoch() });
        return more;
      }, { ...opts, ...beats });
    rt = parts.createRuntime({
      makeBackend: (kind, opts) => parts.makeBackend(kind, { ...opts, canvas, invalidate: () => rt?.invalidate() }),
      loop: timed,
      input,
      quality: parts.createQuality({ dpr: m.dpr || 1, detail: m.detail, sharp: m.sharp ?? 1, pace: parts.createPace?.({ climb: false }) }),
      saves: savesOf(m.saves),
      store,
      assets: parts.createAssets(() => rt?.gfx?.renderer ?? null),
      audio,
      video: m.video ?? null,
      gpu: Boolean(scope.navigator?.gpu),
      override: m.override ?? null,
      lost: Boolean(m.lost),
      fps: m.fps ?? null,
      calibrate: m.calibrate !== false,
      visible: () => visible,
      tier: m.tier ? async () => m.tier : null,
      gpuClock: parts.createGpuTime ? (r) => parts.createGpuTime(r) : null,
      onLoss: (loss) => post({ type: down.lost, kind: loss?.kind ?? null, reason: String(loss?.reason ?? loss?.message ?? 'lost') }),
    });
    rt.hud = (values) => post({ type: down.hud, values });
    rt.events.onAny((name, data) => post({ type: down.event, name, data }));
    // (the box the runtime measures and puts the canvas in: the page's, by its size)
    const host = { dataset: {}, prepend() {}, appendChild() {}, getBoundingClientRect: () => ({ width: size.w, height: size.h }) };
    try {
      const module = (await (modules[m.module] ?? open)()).default;
      if (closed) return;
      const shown = await rt.mount(module, m.props, host);
      if (closed) return;
      if (shown) tellReady();
      else post({ type: down.failed, message: rt.failure?.message ?? 'not shown' });
    } catch (err) {
      post({ type: down.failed, message: String(err?.message ?? err) });
    }
  };

  scope.onmessage = ({ data: m }) => {
    switch (m?.type) {
      case up.init:
        start(m).catch((err) => post({ type: down.failed, message: String(err?.message ?? err) }));
        break;
      case up.input:
        input.take(m.snapshot, m.at ?? null);
        break;
      case up.resize:
        size = { w: m.w, h: m.h };
        rt?.resize(m.w, m.h);
        break;
      case up.visible:
        visible = Boolean(m.on);
        rt?.setVisible(visible);
        break;
      case up.quality:
        rt?.requality(m.level);
        break;
      case up.props:
        rt?.current?.world?.update?.(m.props);
        rt?.invalidate();
        break;
      case up.kick:
        rt?.invalidate();
        break;
      case up.result: {
        const w = waiting.get(m.id);
        waiting.delete(m.id);
        if (m.error) w?.reject(new Error(m.error));
        else w?.resolve(m.value);
        break;
      }
      case up.unmount:
        closed = true;
        rt?.dispose();
        rt = null;
        scope.close();
        break;
      default:
    }
  };
}

// In a worker: the real parts, brought in at the first init
/* global WorkerGlobalScope */
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  imageShim(self);
  serve(self, {
    load: async () => {
      const [{ createRuntime }, { makeBackend, loaders, forget }, { createQuality }, { createPace }, { createAssets }, { createLoop }, { createGpuTime }] = await Promise.all([import('../runtime'), import('../browser'), import('../quality'), import('../../lib/three/pace'), import('../assets'), import('../../lib/three/loop'), import('../../lib/three/gpuTime')]);
      return { createRuntime, makeBackend, createQuality, createPace, // (the loaders given the renderer that's up, as index.js's are)
        createAssets: (renderer) => createAssets({ loaders: { texture: (url, opts) => loaders.texture(url, { renderer: renderer(), ...opts }), gltf: (url, opts) => loaders.gltf(url, { renderer: renderer(), ...opts }), audio: () => Promise.reject(new Error('audio is decoded on the page')) }, forget }), createLoop, createGpuTime };
    },
  });
}
