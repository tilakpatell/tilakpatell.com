// Scratch: the GL calls a frame of the planet flight makes, by name, with
// the ship held at its parity view (world.view('start'), development's), so
// the classic renderer and the node renderer over WebGL 2 can be compared
// by what they ask of the driver rather than by time: in the cloud the GL is
// SwiftShader, whose GPU process is far behind, so a call's time there is
// the wait for it, not its cost. Counts are the same on any machine.
// Also the JavaScript a render, the GL calls' own time taken out. Counted
// a render, not a rAF frame: the runtime's cadence may draw every other one.
//
//   node docs/superpowers/evidence/engine-floor/FL3-fly/tools/gl-calls.mjs [planet]
//   (run from a checkout's root; QUALITY=low|high, PORT=5298, FRAMES=60)
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { chromium } = await import(pathToFileURL(resolve('node_modules/playwright-core/index.mjs')).href);
const { findChromium, launchArgs, angleFor } = await import(pathToFileURL(resolve('scripts/lib/chromium.mjs')).href);
const { createServer } = await import(pathToFileURL(resolve('node_modules/vite/dist/node/index.js')).href);
const PORT = Number(process.env.PORT ?? 5298);
const FRAMES = Number(process.env.FRAMES ?? 60);
const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: findChromium(), args: launchArgs({ angle: angleFor(), webgpu: false, uncapped: true }) });
try {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 300 } });
  await ctx.addInitScript(() => {
    const set = (k, v) => window.localStorage.setItem(k, v);
    set('tp-intro', '1');
    set('tp-sound', 'off');
    set('tp-worlds', JSON.stringify('load'));
    set('tp-software', JSON.stringify('on'));
    set('tp-tour', 'skipped');
    window.__tpNoShaderChecks = true;
    // every WebGL 2 method counted and timed, between two marks
    const calls = new Map();
    let on = false;
    let glMs = 0;
    const proto = WebGL2RenderingContext.prototype;
    for (const k of Object.getOwnPropertyNames(proto)) {
      const d = Object.getOwnPropertyDescriptor(proto, k);
      if (typeof d.value !== 'function') continue;
      const f = d.value;
      proto[k] = function (...a) {
        if (k.startsWith('draw') && window.__glCur) window.__glDraws[window.__glCur] = (window.__glDraws[window.__glCur] ?? 0) + 1;
        if (!on) return f.apply(this, a);
        const t0 = performance.now();
        try {
          return f.apply(this, a);
        } finally {
          glMs += performance.now() - t0;
          calls.set(k, (calls.get(k) ?? 0) + 1);
        }
      };
    }
    const raf = window.requestAnimationFrame.bind(window);
    let rafMs = 0;
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        const t0 = performance.now();
        try {
          return cb(t);
        } finally {
          if (on) rafMs += performance.now() - t0;
        }
      });
    window.__gl = {
      start() {
        calls.clear();
        glMs = rafMs = 0;
        on = true;
      },
      stop: () => {
        on = false;
        return { calls: Object.fromEntries(calls), glMs, rafMs };
      },
    };
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?quality=${process.env.QUALITY ?? 'low'}&gpu=webgl#/fly/${process.argv[2] ?? 'hoth'}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => window.__FLIGHT__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
  await page.evaluate(() => window.__RUNTIME__.current.world.view('start'));
  await page.waitForFunction(() => window.__RUNTIME__.current.world.settled(), null, { timeout: 240000, polling: 500 });
  await page.waitForTimeout(6000);
  // (frames counted by the page's own rAF, so a slow frame is still one frame)
  const out = await page.evaluate(
    (n) =>
      new Promise((done) => {
        // (renders, not rAF frames: the runtime's cadence may draw every
        // other one; the sky dome draws once a render)
        const dome = window.__FLIGHT__.scene.children.find((o) => o.isMesh && o.renderOrder === -1);
        window.__renders = 0;
        const was = dome.onBeforeRender;
        dome.onBeforeRender = function (...a) {
          window.__renders++;
          return was.apply(this, a);
        };
        window.__gl.start();
        let k = 0;
        const tick = () => (++k >= n ? done({ ...window.__gl.stop(), renders: window.__renders }) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    FRAMES,
  );
  const backend = await page.evaluate(() => window.__RUNTIME__.gfx?.backend);
  // (which objects draw: each mesh's onBeforeRender counted over 10 frames,
  // by the scene's top-level subtree it is under; DRAWN=1)
  const drawn = process.env.DRAWN
    ? await page.evaluate(
        () =>
          new Promise((done) => {
            const scene = window.__FLIGHT__.scene;
            const by = {};
            window.__glDraws = {};
            for (const top of scene.children)
              top.traverse((o) => {
                if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
                const key = `${top.name || top.type}/${o.isInstancedMesh ? 'inst' : 'mesh'}${o.material?.transparent ? '/t' : ''}`;
                const was = o.onBeforeRender;
                o.onBeforeRender = function (...a) {
                  by[key] = (by[key] ?? 0) + 1;
                  window.__glCur = key;
                  return was.apply(this, a);
                };
                const after = o.onAfterRender;
                o.onAfterRender = function (...a) {
                  window.__glCur = null;
                  return after.apply(this, a);
                };
              });
            let k = 0;
            const tick = () => (++k >= 10 ? done({ objects: Object.fromEntries(Object.entries(by).map(([n, v]) => [n, v / 10])), glDraws: Object.fromEntries(Object.entries(window.__glDraws).map(([n, v]) => [n, v / 10])) }) : requestAnimationFrame(tick));
            requestAnimationFrame(tick);
          }),
      )
    : null;
  const R = Math.max(1, out.renders);
  const per = Object.entries(out.calls)
    .map(([k, v]) => [k, v / R])
    .sort((a, b) => b[1] - a[1]);
  const total = per.reduce((s, [, v]) => s + v, 0);
  const draws = per.filter(([k]) => k.startsWith('draw')).reduce((s, [, v]) => s + v, 0);
  console.log(JSON.stringify({ backend, frames: FRAMES, renders: out.renders, callsPerRender: Math.round(total), drawsPerRender: Math.round(draws), callsPerDraw: +(total / draws).toFixed(2), jsMsPerRender: +((out.rafMs - out.glMs) / R).toFixed(2), glMsPerRender: +(out.glMs / R).toFixed(2), top: per.slice(0, 16).map(([k, v]) => [k, +v.toFixed(1)]), drawn }));
} finally {
  await browser.close();
  await server.close();
}
