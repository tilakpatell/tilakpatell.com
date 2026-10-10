// The page scripts/light-fixture.mjs opens: the lit fixture
// (src/runtime/fixtures/litWorld.js) on the node renderer, WebGPU or
// (?gpu=webgl) the same renderer on WebGL 2, drawn frame by frame when the
// script asks, so it can draw a set number of frames and time them.
// ?fixture=<json> passes the fixture's options (tier, env, post, sky; with
// `volume`, lane V's hangar in volumeWorld.js instead).

import { createWebGPU } from '../../src/runtime/webgpu.js';
import lit from '../../src/runtime/fixtures/litWorld.js';
import volume from './volumeWorld.js';

const q = new URLSearchParams(location.search);
const fixture = JSON.parse(q.get('fixture') || '{}');
const world = fixture.volume != null ? volume : lit; // (--volume: lane V's hangar)
const canvas = document.querySelector('canvas');
const state = { error: null, ready: false };
window.__lit = state;
window.addEventListener('error', (e) => (state.error ??= String(e.message)));
window.addEventListener('unhandledrejection', (e) => (state.error ??= String(e.reason?.stack ?? e.reason)));

try {
  // (TRAA wants no multisampling, and the post chain draws into its own targets)
  const gfx = await createWebGPU(canvas, { forceWebGL: q.get('gpu') === 'webgl', budget: { antialias: !fixture.post }, alpha: false });
  gfx.setSize(innerWidth, innerHeight);
  gfx.setRatio(1);
  const w = world.create({ gfx, fixture });
  w.resize(innerWidth, innerHeight);
  await w.ready;
  const frame = (dt) => {
    w.step(dt);
    w.draw({ renderer: gfx.renderer });
  };
  // the GPU waited on: the queue on WebGPU, one pixel read on WebGL 2
  const px = new Uint8Array(4);
  const sync = async () => {
    const b = gfx.renderer.backend;
    if (b?.device) await b.device.queue.onSubmittedWorkDone();
    else b?.gl?.readPixels(0, 0, 1, 1, b.gl.RGBA, b.gl.UNSIGNED_BYTE, px);
  };
  Object.assign(state, {
    ready: true,
    backend: gfx.backend,
    probe: w.probe,
    // n frames of a fixed step, then the GPU waited on
    async draw(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) frame(dt);
      await sync();
    },
    // the probe grid made and baked, the GPU waited on (A3)
    async bakeGrid() {
      const t = performance.now();
      const cpu = await w.probe.bakeGrid();
      await sync();
      return { cpu, total: performance.now() - t };
    },
    // frames drawn back to back for ms (at least five), each waited on:
    // the time each took, CPU and GPU (a headless page's animation frames
    // are throttled, so this is not the loop's interval)
    async time(ms) {
      const out = [];
      const end = performance.now() + ms;
      while (performance.now() < end || out.length < 5) {
        const t = performance.now();
        frame(1 / 60);
        await sync();
        out.push(performance.now() - t);
      }
      return out;
    },
  });
} catch (e) {
  state.error = String(e?.stack ?? e);
}
