// The page's face of a world drawn in a worker (lane FL5, a spike behind
// ?worker=on): createWorkerRuntime wraps the page's runtime and keeps its
// face (useWorld's: mount, unmount, adopt, resize, setVisible, invalidate,
// status, on, current, loading, events, input, saves, audio). A module the
// worker has a door for (protocol.js's DOORS) is drawn there: its canvas
// is transferred as an OffscreenCanvas, the page's input is sampled in the
// page's own frame and posted before the worker's, a resize, visibility and
// the props are posted, and what comes back (events, HUD numbers, the
// world's bindings, its calls on the page's services, each frame's time) is
// handed to the page's own. Every other module, and every one after the
// worker failed or lost its device, goes to the page runtime unchanged.
//
// What a worker world gives up (the README's list): a handover's cover
// (the old world is let go and the new one mounted), the settings panel's
// sharpness and video while it is up, the calibrate walk's kept level for
// the page, a world's audio bus.
//
// workerAsked(win) → whether ?worker=on (or tp-worker 'on' kept); canWorker(win)
// → whether the browser can (OffscreenCanvas and transferControlToOffscreen).
// createWorkerRuntime({ page, win, doc, makeWorker, can, raf, caf, detail, sharp }) → rt

import { CALLS, DOORS, MESSAGES, packInput } from './protocol';
import { readOverride } from '../backend';
import { readFps } from '../cadence';
import { device, sharpness } from '../../lib/device';

const { up, down } = MESSAGES;
const KEY = 'tp-worker';
const RING = 600; // frames kept for a probe that reads them (workerFrames)

export function workerAsked(win) {
  const where = `${win?.location?.search ?? ''}&${win?.location?.hash ?? ''}`;
  const asked = /[?&]worker=(on|off)\b/.exec(where)?.[1];
  if (asked) return asked === 'on';
  try {
    return win?.localStorage?.getItem(KEY) === 'on';
  } catch {
    return false; // (storage blocked: asked by the address alone)
  }
}

export const canWorker = (win) => typeof win?.OffscreenCanvas === 'function' && typeof win?.Worker === 'function' && typeof win?.HTMLCanvasElement?.prototype?.transferControlToOffscreen === 'function';

const clonable = (v) => {
  try {
    return structuredClone(v ?? null);
  } catch {
    return null; // (a prop with a function or a node in it: the world gets none, the README says so)
  }
};

export function createWorkerRuntime({
  page,
  win = typeof window !== 'undefined' ? window : undefined,
  doc = typeof document !== 'undefined' ? document : undefined,
  makeWorker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }),
  can = () => canWorker(win),
  raf = (fn) => win.requestAnimationFrame(fn),
  caf = (id) => win.cancelAnimationFrame(id),
  detail = () => device().detail,
  sharp = () => sharpness(),
}) {
  let mode = 'page'; // whose world is up: the page runtime's or the worker's
  let status = 'idle'; // the worker's world's (the page's is the page runtime's own)
  let fallen = false; // the worker failed or lost its device once: the page draws from here on
  let worker = null;
  let canvas = null; // the page's canvas element, its drawing transferred
  let current = null;
  let loading = null;
  let lostModule = null;
  let failure = null;
  let pump = 0; // the page frame that posts the input
  let lastGpu = null;
  let frames = [];
  let shownAt = null; // resolve(true) once the worker draws, or mount on the page if it fails first
  const listeners = new Set();
  const now = () => (win?.performance?.timeOrigin ?? 0) + (win?.performance?.now?.() ?? Date.now());

  const setStatus = (s) => {
    if (s === status) return;
    status = s;
    for (const fn of listeners) fn(s);
  };
  page.on((s) => {
    if (mode === 'page') for (const fn of listeners) fn(s);
  });

  const post = (m, transfer) => worker?.postMessage(m, transfer ?? []);
  const frame = () => {
    pump = 0;
    if (!worker) return;
    post({ type: up.input, snapshot: packInput(page.input.sample()), at: now() });
    pump = raf(frame);
  };
  const stop = () => {
    if (pump) caf(pump);
    pump = 0;
    if (worker) {
      worker.onmessage = worker.onerror = null;
      // (it lets its world go when told; terminated after, whatever it was doing)
      const w = worker;
      post({ type: up.unmount });
      setTimeout(() => w.terminate(), 0);
    }
    worker = null;
    page.input.unbind?.();
    page.input.detach();
    canvas?.remove();
    canvas = null;
    current = null;
    loading = null;
  };

  // a call the worker made on the page's services, by name (protocol.js's CALLS)
  const answer = async ({ id, name, args }) => {
    let value;
    let error = null;
    try {
      if (!CALLS.includes(name)) throw new Error(`${name} is not a call a worker may make`);
      const path = name.split('.');
      const fn = path.pop();
      const owner = path.reduce((o, k) => o?.[k], page);
      value = await owner[fn](...(args ?? []));
    } catch (err) {
      error = String(err?.message ?? err);
    }
    if (id) post(error ? { type: up.result, id, error } : { type: up.result, id, value: clonable(value) });
  };

  const onDown = ({ data: m }) => {
    switch (m?.type) {
      case down.ready:
        delete current?.host?.dataset?.fresh;
        failure = null;
        loading = null;
        setStatus('on');
        shownAt?.(true);
        break;
      case down.failed:
        if (m.soft) return;
        failure = { world: current?.module?.id ?? null, name: 'WorkerError', message: m.message, module: null };
        giveUp();
        break;
      case down.event:
        page.events.emit(m.name, m.data);
        break;
      case down.hud:
        page.events.emit('hud', m.values);
        break;
      case down.bind:
        page.input.bind(m.actions, { axes: m.axes });
        break;
      case down.call:
        answer(m);
        break;
      case down.frame:
        lastGpu = m.gpu ?? null;
        frames.push({ ms: m.ms, at: m.at, gpu: m.gpu ?? null, lag: m.inputAt != null && m.drawnAt != null ? m.drawnAt - m.inputAt : null });
        if (frames.length > RING) frames.shift();
        break;
      case down.lost:
        lostModule = current?.module?.id ?? null;
        fallen = true;
        stop();
        setStatus('lost');
        break;
      default:
    }
  };

  // failed before it drew: the page draws it instead, and every world after
  let again = null; // the mount to make on the page
  const giveUp = () => {
    fallen = true;
    const redo = again;
    const done = shownAt;
    shownAt = null;
    stop();
    if (redo && done) {
      mode = 'page';
      setStatus('idle');
      done(page.mount(...redo));
    } else setStatus('failed');
  };

  const toWorker = (module, props, host) => {
    if (page.current) page.unmount();
    stop();
    mode = 'worker';
    lostModule = null;
    frames = [];
    const el = doc.createElement('canvas');
    el.className = 'world-canvas';
    host.prepend(el);
    if (host.dataset) host.dataset.fresh = '';
    canvas = el;
    const offscreen = el.transferControlToOffscreen();
    worker = makeWorker();
    worker.onmessage = onDown;
    worker.onerror = (e) => onDown({ data: { type: down.failed, message: String(e?.message ?? 'the worker failed') } });
    const r = host.getBoundingClientRect?.();
    const search = win?.location?.search ?? '';
    const hash = win?.location?.hash ?? '';
    let stored = null;
    try {
      stored = win?.localStorage?.getItem('tp-gpu') ?? null;
    } catch {
      /* storage unavailable */
    }
    const saves = Object.fromEntries((module.saves ?? []).map((k) => [k, page.saves.get(k)]));
    current = {
      module,
      host,
      props,
      // (the world's face on the page: useWorld hands it the page's props)
      world: { update: (p) => post({ type: up.props, props: clonable(p) }) },
    };
    loading = module;
    setStatus('loading');
    post(
      {
        type: up.init,
        canvas: offscreen,
        module: DOORS[module.id],
        props: clonable(props),
        w: Math.max(1, Math.round(r?.width ?? 1)),
        h: Math.max(1, Math.round(r?.height ?? 1)),
        dpr: win?.devicePixelRatio || 1,
        detail: detail(),
        sharp: sharp(),
        video: clonable(page.video),
        override: readOverride(search, hash, stored),
        fps: readFps(win),
        calibrate: !/[?&]calibrate=off\b/.test(`${search}&${hash}`),
        tier: page.tier ?? null,
        saves,
      },
      [offscreen],
    );
    page.input.attach({ win, host });
    pump = raf(frame);
    again = [module, props, host];
    return new Promise((resolve) => {
      shownAt = resolve;
    });
  };

  const rt = Object.create(page, {
    // (a value set on the face is the page's: index.js's held() sets the video)
    video: {
      get: () => page.video,
      set: (v) => {
        page.video = v;
      },
    },
    status: { get: () => (mode === 'worker' ? status : page.status) },
    current: { get: () => (mode === 'worker' ? current : page.current) },
    loading: { get: () => (mode === 'worker' ? loading : page.loading) },
    failure: { get: () => (mode === 'worker' ? failure : page.failure) },
    recoverable: { get: () => (mode === 'worker' ? status === 'lost' : page.recoverable) },
    lostModule: { get: () => (mode === 'worker' ? lostModule : page.lostModule) },
    // (the worker's GPU time, for the probe's column: scripts/perf-probe.mjs reads __RUNTIME__.gpuClock)
    gpuClock: { get: () => (mode === 'worker' ? { available: lastGpu != null, last: lastGpu } : page.gpuClock) },
    // whether the world up is drawn in the worker (the README's harness asks)
    inWorker: { get: () => mode === 'worker' && Boolean(worker) },
  });
  Object.assign(rt, {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    mount(module, props, host) {
      if (DOORS[module?.id] && !fallen && can()) return toWorker(module, props, host);
      if (mode === 'worker') {
        stop();
        mode = 'page';
        setStatus('idle');
      }
      return page.mount(module, props, host);
    },
    // (no cover across a handover to or from the worker: the old world goes first)
    handover(module, props, host, opts) {
      if (mode === 'worker' || DOORS[module?.id]) return rt.mount(module, props, host);
      return page.handover(module, props, host, opts);
    },
    adopt(module, host) {
      if (mode !== 'worker') return page.adopt(module, host);
      if (current?.module !== module || !host) return false;
      if (current.host !== host) {
        current.host = host;
        if (canvas && canvas.parentNode !== host) host.prepend(canvas);
        page.input.attach({ win, host });
      }
      const r = host.getBoundingClientRect?.();
      if (r) rt.resize(r.width, r.height);
      return true;
    },
    resize(w, h) {
      if (mode !== 'worker') return page.resize(w, h);
      post({ type: up.resize, w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), ratio: win?.devicePixelRatio || 1 });
      return undefined;
    },
    setVisible(on) {
      if (mode !== 'worker') return page.setVisible(on);
      post({ type: up.visible, on: Boolean(on) });
      return undefined;
    },
    invalidate() {
      if (mode !== 'worker') return page.invalidate();
      post({ type: up.kick });
      return undefined;
    },
    requality(level) {
      if (mode !== 'worker') return page.requality(level);
      post({ type: up.quality, level });
      return current ? 'tuned' : 'idle';
    },
    revideo(values) {
      if (mode !== 'worker') return page.revideo(values);
      page.video = values ?? null;
      return current ? 'reload' : 'idle';
    },
    sharpen(k) {
      if (mode !== 'worker') page.sharpen(k);
    },
    reload() {
      if (mode !== 'worker') return page.reload();
      if (!current) return Promise.resolve(false);
      return rt.mount(current.module, current.props, current.host);
    },
    unmount() {
      if (mode !== 'worker') return page.unmount();
      shownAt?.(false);
      shownAt = null;
      stop();
      setStatus('idle');
      mode = 'page';
      return undefined;
    },
    dispose() {
      if (mode === 'worker') rt.unmount();
      page.dispose?.();
    },
    // the worker's frames since the last asking: { ms, at, gpu, lag } (lag:
    // ms from the page's input sample to the worker's draw having been sent)
    workerFrames() {
      const out = frames;
      frames = [];
      return out;
    },
  });
  return rt;
}
