// Lane FL5's measure: the lit fixture (lit.html) on the page and in a
// worker, with and without lane P7's deliberate main-thread load,
// interleaved, RUNS times each; the world's frame intervals (p50, the worst
// 1 %), the page's own, and the input's sample to the draw.
//
//   node docs/superpowers/evidence/engine-floor/FL5/tools/measure.mjs
//   RUNS=3 SECS=10 GPU=webgpu QUALITY=high VIEW=1920x1080@1 node …/measure.mjs
//
// With BASE unset it starts its own Vite (on 5296). GPU=webgpu asks for
// WebGPU (the owner's machines; the container has SwiftShader's WebGL 2
// only). OUT is where results.json goes.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { adapterFor, angleFor, findChromium, launchArgs } from '../../../../../../scripts/lib/chromium.mjs';

const runs = Number(process.env.RUNS ?? 2);
const secs = Number(process.env.SECS ?? 8);
const gpu = process.env.GPU === 'webgpu' ? 'webgpu' : null;
const quality = process.env.QUALITY ?? 'low';
const out = process.env.OUT ?? 'docs/superpowers/evidence/engine-floor/FL5';
const [vw, vh, vdpr] = (process.env.VIEW ?? '1280x720@1').match(/(\d+)x(\d+)(?:@([\d.]+))?/).slice(1).map(Number);

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))] * 10) / 10;
};
const sum = (r) => ({ frames: r.world.length, p50: pct(r.world, 0.5), worst1: pct(r.world, 0.99), pageP50: pct(r.page, 0.5), pageWorst1: pct(r.page, 0.99), lagP50: pct(r.lag, 0.5), lagWorst1: pct(r.lag, 0.99) });

let server = null;
let base = process.env.BASE;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: 5296, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  base = 'http://127.0.0.1:5296';
}
const chrome = findChromium();
if (!chrome) throw new Error('no Chromium (set CHROME=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: chrome, args: launchArgs({ angle: angleFor(), webgpu: gpu === 'webgpu', adapter: adapterFor(), uncapped: false }) });
const rows = [];
try {
  for (let run = 0; run < runs; run++) {
    for (const load of [0, 30]) {
      for (const worker of ['off', 'on']) {
        const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vdpr || 1 });
        ctx.setDefaultNavigationTimeout(240000);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
        const q = new URLSearchParams({ worker, load: String(load), quality, calibrate: 'off', ...(gpu ? { gpu } : {}) });
        await page.goto(`${base}/docs/superpowers/evidence/engine-floor/FL5/tools/lit.html?${q}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__fl5?.ready || window.__fl5?.error, null, { timeout: 240000 });
        const err = await page.evaluate(() => window.__fl5.error);
        if (err) throw new Error(`worker=${worker} load=${load}: ${err}`);
        await page.waitForTimeout(3000); // (past the first frames' links)
        const taken = await page.evaluate((ms) => window.__fl5.take(ms), secs * 1000);
        const inWorker = await page.evaluate(() => window.__fl5.inWorker);
        const row = { run, load, worker, inWorker, ...sum(taken), errors };
        rows.push(row);
        console.log(JSON.stringify(row));
        await ctx.close();
      }
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/results.json`, JSON.stringify({ view: { vw, vh, vdpr }, gpu: gpu ?? 'default', quality, secs, rows }, null, 1));
console.log('\n| load ms / 100 ms | worker | world p50 ms | world worst 1 % ms | page worst 1 % ms | input to draw p50 ms | input to draw worst 1 % ms |\n| --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.load} | ${r.worker}${r.inWorker ? '' : r.worker === 'on' ? ' (fell back)' : ''} | ${r.p50} | ${r.worst1} | ${r.pageWorst1} | ${r.lagP50} | ${r.lagWorst1} |`);
