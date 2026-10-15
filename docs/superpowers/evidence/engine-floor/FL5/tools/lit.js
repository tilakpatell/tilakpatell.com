// Lane FL5's harness: the lit fixture mounted through the site's own
// runtime() (src/runtime/index.js), so ?worker=on takes the path a page
// takes, and the frames timed the same way either side. ?load=30 adds the
// deliberate main-thread load of lane P7's plan: a 30 ms task every 100 ms,
// the page's React and HUD at their worst. measure.mjs drives it.
//
// window.__fl5: { ready, error, inWorker, backend, take(ms) → { page, world, lag } }
//   page: the page's requestAnimationFrame intervals (what the visitor's
//   page does: scrolling, the HUD); world: the world's own frame intervals
//   (the worker's beats in a worker, the page's on the page); lag: ms from
//   the input's sample to the frame's draw having been issued.

import { runtime } from '../../../../../../src/runtime/index.js';
import lit from '../../../../../../src/runtime/fixtures/litWorld.js';

const q = new URLSearchParams(location.search);
const state = { ready: false, error: null };
window.__fl5 = state;
window.addEventListener('error', (e) => (state.error ??= String(e.message)));
window.addEventListener('unhandledrejection', (e) => (state.error ??= String(e.reason?.stack ?? e.reason)));

const load = Number(q.get('load') ?? 0);
if (load > 0) {
  setInterval(() => {
    const end = performance.now() + load;
    while (performance.now() < end) {
      /* the page busy, as React re-rendering a HUD is */
    }
  }, 100);
}

const pageBeats = [];
let lastBeat = null;
const beat = (t) => {
  if (lastBeat !== null) pageBeats.push(t - lastBeat);
  lastBeat = t;
  requestAnimationFrame(beat);
};
requestAnimationFrame(beat);

try {
  const rt = runtime();
  const host = document.getElementById('world');
  const shown = await rt.mount(lit, {}, host);
  if (!shown) throw new Error(`not shown: ${rt.failure?.message ?? rt.status}`);
  // (on the page: each frame's sample to its draw, the same span the worker reports)
  const pageWorld = [];
  const pageLag = [];
  if (!rt.inWorker) {
    const { world } = rt.current;
    const { input } = rt;
    const sample = input.sample.bind(input);
    let sampledAt = null;
    let lastAt = null;
    input.sample = (t) => {
      sampledAt = performance.now();
      if (lastAt !== null) pageWorld.push(t - lastAt);
      lastAt = t;
      return sample(t);
    };
    const draw = world.draw.bind(world);
    world.draw = (a) => {
      const out = draw(a);
      if (sampledAt !== null) pageLag.push(performance.now() - sampledAt);
      return out;
    };
  }
  Object.assign(state, {
    ready: true,
    inWorker: Boolean(rt.inWorker),
    backend: rt.inWorker ? 'worker' : (rt.gfx?.backend ?? null),
    async take(ms) {
      pageBeats.length = 0;
      pageWorld.length = 0;
      pageLag.length = 0;
      rt.workerFrames?.();
      await new Promise((r) => setTimeout(r, ms));
      if (rt.inWorker) {
        const frames = rt.workerFrames();
        const world = frames.slice(1).map((f, i) => f.at - frames[i].at);
        return { page: [...pageBeats], world, lag: frames.map((f) => f.lag).filter((x) => x != null) };
      }
      return { page: [...pageBeats], world: [...pageWorld], lag: [...pageLag] };
    },
  });
} catch (e) {
  state.error = String(e?.stack ?? e);
}
