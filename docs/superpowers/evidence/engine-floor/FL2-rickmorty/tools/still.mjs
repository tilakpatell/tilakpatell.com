/* global window, document, Math */
// A still of a route that comes out the same every time it is shot, so a
// before and an after can be compared pixel for pixel: autopilot-check's
// shots are a live page after eight seconds of wall time, through a lossy
// WebP, and two of them of the same build never match. Here time stands
// still while the page loads (performance.now, Date and the frames'
// timestamps held; the timers on real time so the loading ends), then the
// script steps the frames itself, 16 ms each, the same number every run,
// with Math.random seeded. The picture is the PNG. (Playwright's own clock
// was tried first: how many of its frames the loading took varied from run
// to run, and so did the picture.)
//
//   node still.mjs --dist dist --routes /c-137,/c-137/citadel --out dir
//     [--frames 480] [--phone] [--quality high|mid|low] [--tag before]
//     [--scroll 0] (a page scrolled to y before the shot) [--size 1440x900]
//     [--local key=json;…] [--wait 300]
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
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
const routes = String(args.routes ?? '/c-137').split(',').filter(Boolean);
const out = resolve(args.out ?? '.');
const frames = Number(args.frames) || 480;
const phone = Boolean(args.phone);
const quality = args.quality ?? 'high';
const tag = args.tag ?? 'shot';
const scroll = Number(args.scroll) || 0;
// (--local key=json;key=json: put in the page's storage before it loads, the
// same for the before and the after: a returning visitor, say, whose
// first-visit flourish draws its sparks at random while the page loads)
const stored = String(args.local ?? '').split(';').filter(Boolean).map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]);
const waitMax = Number(args.wait) || 300; // s at most for the loading veils
await mkdir(out, { recursive: true });

const { chromium } = await import('playwright-core');
const port = 4800 + Math.floor(Math.random() * 900);
const vite = join(dirname(createRequire(join(ROOT, 'package.json')).resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, 'preview', '--outDir', dist, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let t = 0; ; t++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not yet */
  }
  if (t > 100) throw new Error('vite preview never answered');
  await new Promise((r) => setTimeout(r, 300));
}
const exe = (await readdir('/opt/pw-browsers')).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
const [vw, vh] = String(args.size ?? '1440x900').split('x').map(Number); // (smaller is quicker in software)
const viewport = phone ? { width: 390, height: 844 } : { width: vw, height: vh };
const idle = Number(args.idle) || 150; // ms of real time a frame waits, for the work off the page (workers, decoders, shaders)
const quiet = (ms = 25) => new Promise((r) => setTimeout(r, ms));
try {
  for (const route of routes) {
    const ctx = await browser.newContext({ viewport, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await ctx.addInitScript((kept) => {
      for (const [k, v] of kept) window.localStorage.setItem(k, v);
    }, stored);
    await ctx.addInitScript((q) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-quality', q);
      // (mulberry32: the same sequence each run; reseeded when the counted
      // frames start, so what loading drew doesn't move it)
      let a = 0;
      const seed = (n) => (a = n);
      seed(0x9e3779b9);
      Math.random = () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      // Time stands still while the page loads (performance.now, Date and
      // the frames' timestamps held at one moment, the timers running on
      // real time so the loading finishes), so however long it takes, the
      // worlds see none of it pass; then the script steps the frames itself,
      // 16 ms each, the same number every run.
      let vt = 1000;
      const EPOCH = Date.UTC(2026, 9, 15, 12);
      const RealDate = Date;
      performance.now = () => vt;
      Date = class extends RealDate {
        constructor(...x) {
          if (x.length) super(...x);
          else super(EPOCH + vt);
        }
        static now() {
          return EPOCH + vt;
        }
      };
      const realRaf = window.requestAnimationFrame.bind(window);
      const realCancel = window.cancelAnimationFrame.bind(window);
      let stepping = false;
      let queue = new Map();
      let id = 1e6;
      window.requestAnimationFrame = (fn) => {
        if (!stepping) return realRaf(() => fn(vt));
        const n = ++id;
        queue.set(n, fn);
        return n;
      };
      window.cancelAnimationFrame = (n) => (n > 1e6 ? queue.delete(n) : realCancel(n));
      // The grade's grain (lib/stage3d's GRADE, ../../../../src/components/
      // rickmorty/stage.js's) counts its clock from the frames it's drawn,
      // and a frame loop started again during the loading (a box scrolled
      // into view, a status come back) starts on 16 ms of its own: how many
      // times that happens is the machine's. So the grain's clock, in a
      // program with both uTime and uGrain and in no other, is the stepped
      // time, in the before and the after alike.
      const grainAt = new WeakSet();
      for (const Gl of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
        const where = Gl.prototype.getUniformLocation;
        const set1 = Gl.prototype.uniform1f;
        Gl.prototype.getUniformLocation = function (program, name) {
          const at = where.call(this, program, name);
          if (at && name === 'uTime' && where.call(this, program, 'uGrain')) grainAt.add(at);
          return at;
        };
        Gl.prototype.uniform1f = function (at, v) {
          return set1.call(this, at, at && grainAt.has(at) ? vt / 1000 : v);
        };
      }
      // (and no CSS animation or transition, before or after: theirs run on
      // the compositor's clock)
      const still = document.createElement('style');
      still.textContent = '*, *::before, *::after { animation: none !important; transition: none !important; }';
      // (no document yet when this runs: added as soon as there is one)
      const add = () => (document.head ?? document.documentElement).appendChild(still);
      if (document.documentElement) add();
      else new MutationObserver((_, o) => document.documentElement && (o.disconnect(), add())).observe(document, { childList: true });
      window.__still = {
        start() {
          stepping = true;
          seed(0x2545f491);
        },
        frame() {
          vt += 16;
          const run = queue;
          queue = new Map();
          for (const fn of run.values()) fn(vt);
        },
      };
    }, quality);
    const page = await ctx.newPage();
    let pending = 0;
    page.on('request', () => pending++);
    page.on('requestfinished', () => pending--);
    page.on('requestfailed', () => pending--);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/#${route}`, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    // until every loading veil on the page is done, in real time (--wait s at most)
    let loading = 0;
    for (; loading < waitMax * 10; loading++) {
      await quiet(100);
      if (loading > 10 && (await page.evaluate(() => !document.querySelector('.loading-veil:not(.is-done)')))) break;
    }
    await quiet(idle * 10);
    if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await page.evaluate(() => window.__still.start());
    await quiet(idle);
    for (let f = 0; f < frames; f++) {
      await page.evaluate(() => window.__still.frame());
      await quiet(idle);
      for (let w = 0; w < 400 && pending > 0; w++) await quiet();
    }
    const name = `${route.replace(/^\//, '').replace(/[/:]/g, '_') || 'root'}${phone ? '-phone' : ''}-${tag}.png`;
    await writeFile(join(out, name), await page.screenshot({ type: 'png', timeout: 120000 }));
    console.log(`${route} → ${name} (ready after ${loading / 10} s)${errors.length ? ` (errors: ${errors.join(' | ').slice(0, 300)})` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
