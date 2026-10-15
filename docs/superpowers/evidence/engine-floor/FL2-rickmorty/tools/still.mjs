/* global window, document, Math */
// A still of a route that comes out the same every time it is shot, so a
// before and an after can be compared pixel for pixel: autopilot-check's
// shots are a live page after eight seconds of wall time, through a lossy
// WebP, and two of them of the same build never match. Here the page's
// clock is Playwright's (Date, performance.now, timers and animation frames
// all advanced by the script, a frame of 16 ms at a time), Math.random is
// seeded, and each frame waits for the network to be quiet before the next,
// so an asset lands on the same frame each run. The picture is the PNG.
//
//   node still.mjs --dist dist --routes /c-137,/c-137/citadel --out dir
//     [--frames 480] [--phone] [--quality high|mid|low] [--tag before]
//     [--scroll 0] (a page scrolled to y before the shot)
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
const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const quiet = () => new Promise((r) => setTimeout(r, 25));
try {
  for (const route of routes) {
    const ctx = await browser.newContext({ viewport, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    await ctx.addInitScript((q) => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-start', '"universe"');
      window.localStorage.setItem('tp-quality', q);
      // (mulberry32: the same sequence each run)
      let a = 0x9e3779b9;
      Math.random = () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, quality);
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date('2026-10-15T12:00:00Z') });
    let pending = 0;
    page.on('request', () => pending++);
    page.on('requestfinished', () => pending--);
    page.on('requestfailed', () => pending--);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/#${route}`, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    for (let f = 0; f < frames; f++) {
      await page.clock.runFor(16);
      for (let w = 0; w < 400 && pending > 0; w++) await quiet();
      await quiet();
      if (scroll && f === 10) await page.evaluate((y) => window.scrollTo(0, y), scroll);
    }
    const name = `${route.replace(/^\//, '').replace(/[/:]/g, '_') || 'root'}${phone ? '-phone' : ''}-${tag}.png`;
    await writeFile(join(out, name), await page.screenshot({ type: 'png', timeout: 120000 }));
    console.log(`${route} → ${name}${errors.length ? ` (errors: ${errors.join(' | ').slice(0, 300)})` : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
