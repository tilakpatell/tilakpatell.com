// Middle-earth, the world module: the whole route on the runtime's one
// renderer and its one loop. The page is many pictures at once (the map
// behind it, a town's stage, the kitchen under the town, the bridge in
// Moria, Gorgoroth and the Ring in Mordor), each in its own box, laid out
// and listened to by its own component as before; each is a view of the
// runtime's canvas (runtime/views.js): the one drawing the most of the
// screen has the canvas, the others a copy of what was drawn for them. The
// world's host is the map's box (fixed, the size of the window), so the
// buffer is the window's size and every view fits inside it.
//
// The components keep their frames as they wrote them: a frame loop is a
// tick (useTick, ./tick.js), run by this world's step in the runtime's
// loop, with the milliseconds since its own last frame as lib/hooks'
// useFrameLoop gave them (16 for its first). A tick that names its canvas
// runs with its view's renderer state on (views.enter); the ticks run in the
// order they were started, as requestAnimationFrame's callbacks did (the
// lead view's draw is held to the frame's end by the views instead). A tick
// that returns false stops until it's started again. The
// stages (./stage.js) draw through their views; their quality steps are
// the runtime's governor's (lowerQuality), in the old watchdog's order.
//
// The world is published for the components (engine(), engineNow()) at its
// first frame, once the runtime's loop runs it (a tick started before that
// stood still until it did, and the map's easing came out of step): a
// component waits for it before making its scene on the shared renderer;
// when there is none (no 3D, or the world failed), refuse() tells them, and
// they show their drawings as they did when WebGL couldn't be had.

import { WORLD_MB } from '../worlds/worlds';

let up = null;
let refused = null;
const waiting = new Set();
const watchers = new Set();
const tell = () => {
  for (const fn of watchers) fn(up);
};

// the world, once it's up: resolves with it, or rejects when it can't be had
export function engine() {
  if (up) return Promise.resolve(up);
  if (refused) return Promise.reject(refused);
  return new Promise((resolve, reject) => waiting.add({ resolve, reject }));
}
export const engineNow = () => up;
// fn(world | null) now and whenever the world comes up or goes (a loss, the
// page let go): a frame loop follows it, never a world that's gone
export function watch(fn) {
  watchers.add(fn);
  fn(up);
  return () => watchers.delete(fn);
}
export function refuse(why = new Error('Middle-earth’s world could not be had')) {
  if (up) return;
  refused = why;
  for (const w of waiting) w.reject(why);
  waiting.clear();
}
// (the page asks again, a new mount on its way: the next answer is the world's)
export function askAgain() {
  refused = null;
}
function publish(world) {
  up = world;
  refused = null;
  for (const w of waiting) w.resolve(world);
  waiting.clear();
  tell();
}

// The world on the runtime: views of the canvas, the ticks, the stages.
// `views` is made by runtime/views.js's createViews (passed in: the tests
// give their own).
export function makeWorld(rt, { createViews, doc = typeof document !== 'undefined' ? document : null } = {}) {
  const gfx = rt.gfx;
  const views = createViews(gfx);
  const ticks = new Set();
  const stages = new Set();
  let level = 0;
  let disposed = false;
  const dev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

  // a hidden tab stops every tick, and the first frame back is a first frame
  // again (16 ms), as useFrameLoop's restart was
  const onVis = () => {
    if (doc?.hidden) for (const t of ticks) t.last = 0;
    else rt.invalidate?.();
  };
  doc?.addEventListener?.('visibilitychange', onVis);

  const world = {
    rt,
    views,
    get renderer() {
      return gfx.renderer;
    },
    get level() {
      return level;
    },
    // fn(ms, now) each frame while started; `el`, its view's canvas.
    // start(last): its last frame's time, for a loop handed over from a
    // requestAnimationFrame of its own (its next ms as that loop's)
    tick(fn, { el = null } = {}) {
      const t = { fn, el, on: false, last: 0 };
      ticks.add(t);
      return {
        start(last = 0) {
          if (t.on || disposed) return;
          t.on = true;
          t.last = last;
          // (to the back of the queue, as a frame asked for again was)
          ticks.delete(t);
          ticks.add(t);
          rt.invalidate?.();
        },
        stop() {
          t.on = false;
          t.last = 0;
        },
        get on() {
          return t.on;
        },
        dispose() {
          t.on = false;
          ticks.delete(t);
        },
      };
    },
    // a stage made on this world (./stage.js): its quality and its loss
    stage(s) {
      stages.add(s);
      s.setLevel?.(level);
      return () => stages.delete(s);
    },
    resize() {
      views.resize();
    },
    step(dt, input, now) {
      if (disposed) return;
      if (up !== world && !refused) publish(world);
      views.frame();
      // (in the order they were started, as requestAnimationFrame ran its
      // callbacks: what each takes from Math.random comes in the same turn)
      const due = [...ticks].filter((t) => t.on);
      for (const t of due) {
        // (one handed over this very frame has had it)
        if (!t.on || t.last === now) continue;
        const ms = t.last ? Math.min(50, now - t.last) : 16;
        t.last = now;
        if (t.el) views.enter(t.el);
        let more;
        try {
          more = t.fn(ms, now);
        } catch (err) {
          // (one picture's failure is its own: its loop stops, as a frame
          // callback that threw did, and the rest draw on)
          if (dev) console.error('[middleearth] a frame failed', err);
          more = false;
        }
        if (more === false) {
          t.on = false;
          t.last = 0;
        }
      }
    },
    draw() {
      if (!disposed) views.flush();
    },
    wants: () => [...ticks].some((t) => t.on),
    lowerQuality(l) {
      level = l;
      for (const s of stages) s.setLevel?.(l);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      doc?.removeEventListener?.('visibilitychange', onVis);
      if (up === world) {
        up = null;
        tell();
      }
      // (the context gone: every picture shows its drawing again, as each
      // used to when its own context went)
      const lost = Boolean(gfx?.lost);
      for (const s of [...stages]) {
        if (lost) s.lose?.();
        s.dispose?.();
      }
      stages.clear();
      ticks.clear();
      views.dispose();
    },
  };
  return world;
}

export default {
  id: 'middleearth',
  shading: 'glsl',
  mb: WORLD_MB['/middle-earth'],
  label: 'Middle-earth: the map on a desk, the towns of the road from the Shire to Mordor in 3D, and the kitchen, the bridge and the Ring along the way.',
  // (the sharpest a picture asks for: the stages' 1.75, lib/stage3d's
  // stageRatio; each view draws at its own inside it)
  ratio: 1.75,
  // (each stage softens itself through its own passes, lowerQuality: the
  // canvas, the window's size, keeps its size)
  sharpness: 'own',
  // (no calibration walk: the stages started at their sharpest and only
  // stepped down when frames ran long, which the governor still does)
  calibrate: false,
  async create(rt) {
    const { createViews } = await import('../../runtime/views');
    return makeWorld(rt, { createViews });
  },
};
