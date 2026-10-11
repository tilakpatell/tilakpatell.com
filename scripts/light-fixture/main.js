// The page scripts/light-fixture.mjs opens: the lit fixture
// (src/runtime/fixtures/litWorld.js) on the node renderer, WebGPU or
// (?gpu=webgl) the same renderer on WebGL 2, drawn frame by frame when the
// script asks, so it can draw a set number of frames and time them.
// ?fixture=<json> passes the fixture's options (tier, env, post, sky,
// exposure, lane S's hoth, shadows, …; with `volume`, lane V's hangar in
// volumeWorld.js instead).

import { createWebGPU } from '../../src/runtime/webgpu.js';
import { createGpuTime } from '../../src/lib/three/gpuTime.js';
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
  // (?traa=off: the reference shots' chain, without its temporal pass; scripts/reference-frames.mjs)
  const gfx = await createWebGPU(canvas, { forceWebGL: q.get('gpu') === 'webgl', budget: { antialias: !fixture.post }, alpha: false, exposure: fixture.exposure ?? 1, temporal: q.get('traa') !== 'off' });
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
  const tick = () => new Promise((r) => requestAnimationFrame(r));
  const px = new Uint8Array(4);
  const sync = async () => {
    const b = gfx.renderer.backend;
    if (b?.device) await b.device.queue.onSubmittedWorkDone();
    else if (b?.gl) {
      // (the screen's framebuffer, then a pixel read: the read waits for
      // everything queued before it, which a read of a post target does not)
      b.gl.bindFramebuffer(b.gl.FRAMEBUFFER, null);
      b.gl.finish();
      b.gl.readPixels(0, 0, 1, 1, b.gl.RGBA, b.gl.UNSIGNED_BYTE, px);
    }
  };
  Object.assign(state, {
    ready: true,
    backend: gfx.backend,
    probe: w.probe,
    // the camera moved by shot i's sub-pixel offset (lib/three/jitter), null to stop
    jitter: (i) => gfx.jitter(i),
    // n frames of a fixed step, each on its own animation frame (a node
    // that updates once a frame, TRAA's history above all, resolves on the
    // next frame: drawn back to back in one task it never does, and the
    // screen stays the clear colour), then the GPU waited on
    async draw(n = 1, dt = 1 / 60) {
      for (let i = 0; i < n; i++) {
        await tick();
        frame(dt);
      }
      await sync();
    },
    // the probe grid made and baked, the GPU waited on (A3)
    async bakeGrid() {
      const t = performance.now();
      const cpu = await w.probe.bakeGrid();
      await sync();
      return { cpu, total: performance.now() - t };
    },
    // the GPU clock against the frame waited on (the GPU-first design's G1
    // gate: within 10 % on the laptop), frames drawn back to back for ms:
    // each one's GPU time from the timestamps (lib/three/gpuTime) and its
    // time from the draw call to the queue done; the medians of both, or
    // gpu null where the adapter has no timestamp-query
    async gpuClock(ms) {
      const clock = createGpuTime(gfx.renderer);
      const cpu = [];
      const gpu = [];
      const end = performance.now() + ms;
      while (performance.now() < end || cpu.length < 10) {
        await tick();
        const t = performance.now();
        frame(1 / 60);
        await sync();
        cpu.push(performance.now() - t);
        await clock.frame();
        if (clock.last != null) gpu.push(clock.last);
      }
      const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null);
      return { available: clock.available, frames: cpu.length, cpuMedian: med(cpu), gpuMedian: med(gpu), gpuRing: clock.median };
    },
    // frames drawn back to back for ms (at least five), each waited on:
    // the time each took, CPU and GPU (a headless page's animation frames
    // are throttled, so this is not the loop's interval)
    async time(ms) {
      const out = [];
      const end = performance.now() + ms;
      while (performance.now() < end || out.length < 5) {
        await tick();
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
