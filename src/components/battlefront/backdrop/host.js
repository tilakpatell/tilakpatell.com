// The one room for the whole front end (the 2026-10-13 backdrop design,
// decision 5): made the first time a screen asks for it, its canvas moved
// into each screen's backdrop as the screen opens, let go LINGER_MS after
// the last one closes, so going from HOME to PLAY loads nothing again. It
// draws in backdrop.worker.js where the browser can hand a canvas to a
// worker; else, or when the worker can't draw, scene.js on the page, one
// step down. A hidden tab, or no screen holding it, draws nothing.
//
// adopt(box, { level, reduced }) → release(): the room's canvas in `box`
//   (filling it) until release
// roomState() → { mode: 'worker' | 'page' | null, step, ready } (the checks)

import { pixelRatio } from '../../../lib/device';
import { startStep } from './governor';

export const LINGER_MS = 15000;
let room = null;

const canWorker = () => typeof Worker === 'function' && typeof HTMLCanvasElement !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
const sizeOf = (box) => ({ width: box?.clientWidth || window.innerWidth || 1920, height: box?.clientHeight || window.innerHeight || 1080, ratio: pixelRatio(1.5) });

function makeCanvas() {
  const c = document.createElement('canvas');
  c.className = 'bf-room-canvas';
  c.setAttribute('aria-hidden', 'true');
  return c;
}

function onPage(r, step) {
  r.mode = 'page';
  r.canvas = makeCanvas();
  r.box?.appendChild(r.canvas);
  import('./scene.js')
    .then(({ createBackdrop }) => {
      if (room !== r) return;
      r.scene = createBackdrop(r.canvas, {
        ...sizeOf(r.box),
        level: r.level,
        step,
        reduced: r.reduced,
        raf: (f) => requestAnimationFrame(f),
        caf: (id) => cancelAnimationFrame(id),
        onStep: (s) => (r.step = s),
        onReady: () => (r.ready = true),
      });
      if (!r.scene) r.mode = null;
      else r.scene.visible(r.seen());
    })
    .catch(() => (r.mode = null));
}

function make({ level, reduced }) {
  const r = { mode: null, canvas: null, worker: null, scene: null, box: null, timer: 0, step: 0, ready: false, level, reduced, ro: null };
  r.seen = () => Boolean(r.box) && document.visibilityState !== 'hidden';
  r.send = (msg) => r.worker?.postMessage(msg);
  r.resize = () => {
    const s = sizeOf(r.box);
    if (r.worker) r.send({ type: 'size', ...s });
    else r.scene?.resize(s.width, s.height, s.ratio);
  };
  r.show = () => {
    const on = r.seen();
    if (r.worker) r.send({ type: 'visible', on });
    else r.scene?.visible(on);
  };
  r.onVis = () => r.show();
  document.addEventListener('visibilitychange', r.onVis);
  r.onResize = () => r.resize();
  window.addEventListener('resize', r.onResize);
  r.ro = typeof ResizeObserver === 'function' ? new ResizeObserver(r.onResize) : null;

  const step = startStep({ level, reduced });
  r.step = step;
  if (canWorker()) {
    try {
      r.canvas = makeCanvas();
      const off = r.canvas.transferControlToOffscreen();
      r.worker = new Worker(new URL('./backdrop.worker.js', import.meta.url), { type: 'module' });
      r.mode = 'worker';
      r.worker.onmessage = (e) => {
        const m = e.data ?? {};
        if (m.type === 'ready') r.ready = true;
        else if (m.type === 'step') r.step = m.step;
        else if (m.type === 'failed') fallBack(r);
      };
      r.worker.onerror = () => fallBack(r);
      r.worker.postMessage({ type: 'start', canvas: off, ...sizeOf(null), level, step, reduced }, [off]);
      return r;
    } catch {
      r.worker?.terminate();
      r.worker = null;
    }
  }
  onPage(r, startStep({ level, reduced, page: true }));
  return r;
}

// the worker can't draw: the page draws it, on a canvas of its own (the first was handed over)
function fallBack(r) {
  if (room !== r || r.mode !== 'worker') return;
  r.worker?.terminate();
  r.worker = null;
  r.canvas?.remove();
  onPage(r, startStep({ level: r.level, reduced: r.reduced, page: true }));
}

function drop(r) {
  document.removeEventListener('visibilitychange', r.onVis);
  window.removeEventListener('resize', r.onResize);
  r.ro?.disconnect();
  if (r.worker) {
    r.send({ type: 'stop' });
    // (and gone for good a moment after, whether or not it heard)
    const w = r.worker;
    setTimeout(() => w.terminate(), 500);
  }
  r.scene?.dispose();
  r.canvas?.remove();
}

export function adopt(box, { level = 'high', reduced = false } = {}) {
  if (!box || typeof document === 'undefined') return () => {};
  if (room && (room.level !== level || room.reduced !== reduced)) {
    clearTimeout(room.timer);
    drop(room);
    room = null;
  }
  room ??= make({ level, reduced });
  const r = room;
  clearTimeout(r.timer);
  r.box = box;
  if (r.canvas) box.appendChild(r.canvas);
  r.ro?.disconnect();
  r.ro?.observe(box);
  r.resize();
  r.show();
  return () => {
    if (r.box !== box) return;
    r.box = null;
    r.ro?.disconnect();
    r.show();
    r.timer = setTimeout(() => {
      if (room !== r || r.box) return;
      drop(r);
      room = null;
    }, LINGER_MS);
  };
}

export const roomState = () => ({ mode: room?.mode ?? null, step: room?.step ?? null, ready: Boolean(room?.ready) });
// (the checks read it in development: scripts/bf-ui-shots.mjs)
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__bfRoom = roomState;
  window.__bfRoomView = (view) => (room?.worker ? room.send({ type: 'view', view }) : room?.scene?.view(view));
}
