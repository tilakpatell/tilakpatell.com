// The front end's room in its own thread (the 2026-10-13 backdrop design,
// decision 4): scene.js on the canvas the page handed over. Messages from
// the page:
//   { type: 'start', canvas, width, height, ratio, level, step, reduced }
//   { type: 'size', width, height, ratio }
//   { type: 'visible', on }
//   { type: 'view', view } (development: another camera, scene.js's HOME's shape)
//   { type: 'stop' }
// and back: { type: 'ready' } (the room and the figure are in),
// { type: 'step', step } (the governor moved), { type: 'failed', why } (no
// WebGL here: the page draws it instead).

import { createBackdrop } from './scene';

const raf = typeof self.requestAnimationFrame === 'function' ? (f) => self.requestAnimationFrame(f) : (f) => setTimeout(() => f(performance.now()), 1000 / 60);
const caf = typeof self.cancelAnimationFrame === 'function' ? (id) => self.cancelAnimationFrame(id) : (id) => clearTimeout(id);
let room = null;

self.onmessage = (e) => {
  const m = e.data ?? {};
  if (m.type === 'start' && !room) {
    try {
      room = createBackdrop(m.canvas, { ...m, raf, caf, onStep: (step) => self.postMessage({ type: 'step', step }), onReady: () => self.postMessage({ type: 'ready' }) });
    } catch (err) {
      room = null;
      self.postMessage({ type: 'failed', why: String(err?.message ?? err) });
      return;
    }
    if (!room) self.postMessage({ type: 'failed', why: 'no WebGL in the worker' });
  } else if (m.type === 'size') room?.resize(m.width, m.height, m.ratio);
  else if (m.type === 'visible') room?.visible(m.on);
  else if (m.type === 'view') room?.view(m.view);
  else if (m.type === 'stop') {
    room?.dispose();
    room = null;
    self.close();
  }
};
