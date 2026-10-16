/* global window, document, performance, PerformanceObserver, requestAnimationFrame */
// Frame times on a route once its world is up, for a before and an after on
// the same machine: scripts/perf-probe.mjs's c137 journey waits 300 s for
// the world, and in the container's software renderer C-137 takes about
// 200 s to come up at 960 × 600 before the probe's own counting slows it
// past that, on main as on this branch. Here: the route opened on a built
// site, its world's box waited for ([data-on], ten minutes at most), then
// `secs` seconds of frames with W held (Morty walks, the camera follows),
// every frame's interval and the main thread's long tasks counted.
//
//   node frames.mjs --dist dist --route /c-137 [--on .rm-world-canvas]
//     [--quality low|high] [--secs 20] [--size 960x600]
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[argv[i].slice(2)] = true;
  else args[argv[i].slice(2)] = argv[++i];
}
const dist = resolve(ROOT, args.dist ?? 'dist');
const route = args.route ?? '/c-137';
const on = args.on ?? '.rm-world-canvas';
const quality = args.quality ?? 'high';
const secs = Number(args.secs) || 20;
const [w, h] = String(args.size ?? '960x600').split('x').map(Number);

const { chromium } = await import('playwright-core');
const port = 5700 + Math.floor(Math.random() * 200);
const vite = join(dirname(createRequire(join(ROOT, 'package.json')).resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, 'preview', '--outDir', dist, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
for (let t = 0; ; t++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
  } catch {
    /* not yet */
  }
  if (t > 100) throw new Error('vite preview never answered');
  await new Promise((r) => setTimeout(r, 300));
}
const exe = (await readdir('/opt/pw-browsers')).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
try {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript((q) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-quality', q);
  }, quality);
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/#${route}`, { waitUntil: 'load', timeout: 120000 });
  // (in software at Low the site asks before it loads a world: the same answer either side)
  await page.getByRole('button', { name: /Open without installing/ }).click({ timeout: 20000 }).catch(() => {});
  await page.waitForFunction((sel) => document.querySelector(`${sel}[data-on]`), on, { timeout: 600000, polling: 1000 });
  const ready = (Date.now() - t0) / 1000;
  await page.waitForTimeout(3000); // (its first frames: shaders, the cover's fade)
  await page.mouse.click(w / 2, h / 2);
  await page.keyboard.down('KeyW');
  const r = await page.evaluate(
    (ms) =>
      new Promise((done) => {
        const gaps = [];
        const long = [];
        const po = typeof PerformanceObserver !== 'undefined' ? new PerformanceObserver((l) => long.push(...l.getEntries().map((e) => e.duration))) : null;
        try {
          po?.observe({ type: 'longtask', buffered: false });
        } catch {
          /* not here */
        }
        let last = 0;
        const end = performance.now() + ms;
        const tick = (t) => {
          if (last) gaps.push(t - last);
          last = t;
          if (t < end) requestAnimationFrame(tick);
          else {
            po?.disconnect();
            done({ gaps, long });
          }
        };
        requestAnimationFrame(tick);
      }),
    secs * 1000,
  );
  await page.keyboard.up('KeyW');
  const s = [...r.gaps].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
  const mean = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  const busy = r.long.reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ route, quality, ready: Math.round(ready), frames: s.length, fps: +(1000 / mean).toFixed(2), p50: +at(0.5).toFixed(1), p99: +at(0.99).toFixed(1), worst: +(s.at(-1) ?? 0).toFixed(1), longTasks: r.long.length, longMs: Math.round(busy) }));
} finally {
  await browser.close();
  server.kill();
}
