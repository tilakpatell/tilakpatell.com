// How fast Middle-earth draws, before and after lane FL2, in this
// container's browser (SwiftShader: software, so the numbers are for the
// comparison, never for a real chip). A production build is served; each
// place is loaded at a quality level (?quality, as perf-probe's QUALITY),
// scrolled to its part, left to settle, then measured for a window of real
// time: the page's frame intervals (a requestAnimationFrame loop of the
// probe's own: what the visitor sees, however many loops the page runs)
// and the main thread's time (CDP's TaskDuration over the window, a frame's
// share). Runs alternate between the two builds, `--runs` times, so a
// container that slows down mid-way slows both.
//
//   node docs/superpowers/evidence/engine-floor/FL2-middleearth/pace.mjs \
//     --before <built site> --after <built site> [--quality low] [--runs 3]
//     [--only bree,mordor-ring] [--window 12000]

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { freePort } from '../../../../../scripts/lib/noise.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const quality = opt('quality', 'low');
const runs = Number(opt('runs', 3));
const windowMs = Number(opt('window', 12000));
const only = opt('only')?.split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLACES = [
  { id: 'hub', route: '/middle-earth', part: null, ready: '.me-atlas canvas' },
  { id: 'bree', route: '/middle-earth/bree', part: null, ready: '.shire-world .shire-canvas[data-on]' },
  { id: 'shire', route: '/middle-earth/shire', part: null, ready: '.shire-world .shire-canvas[data-on]' },
  { id: 'moria', route: '/middle-earth/moria', part: null, ready: '.shire-world .shire-canvas[data-on]' },
  { id: 'bree-rush', route: '/middle-earth/bree', part: '.rush', ready: '.rush .shire-canvas[data-on]' },
  { id: 'moria-bridge', route: '/middle-earth/moria', part: '#khazad-dum', ready: '#khazad-dum .me-gl canvas[data-on]' },
  { id: 'mordor-ring', route: '/middle-earth/mordor', part: '#ring', ready: '#ring .me-gl canvas[data-on]' },
];

const serve = async (dist) => {
  const port = await freePort();
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--outDir', dist, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (i > 100) throw new Error('vite preview never answered');
    await sleep(300);
  }
  return { base, stop: () => server.kill() };
};

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};

async function measure(browser, base, place) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((q) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-quality', q);
    window.sessionStorage.setItem('tp-me-opening', '1');
  }, quality);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  try {
    await page.goto(`${base}/#${place.route}`, { waitUntil: 'load', timeout: 120000 });
    const deadline = Date.now() + 240000;
    for (;;) {
      if (place.part) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), place.part);
      if (await page.evaluate((sel) => Boolean(document.querySelector(sel)), place.ready)) break;
      if (Date.now() > deadline) return null;
      await sleep(500);
    }
    await sleep(4000); // (the first frames compile what they draw)
    const task = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value * 1000;
    const t0 = await task();
    const gaps = await page.evaluate(
      (ms) =>
        new Promise((done) => {
          const out = [];
          let last = 0;
          const end = performance.now() + ms;
          const loop = (t) => {
            if (last) out.push(t - last);
            last = t;
            if (t < end) requestAnimationFrame(loop);
            else done(out);
          };
          requestAnimationFrame(loop);
        }),
      windowMs,
    );
    const busy = (await task()) - t0;
    return { frames: gaps.length, p50: pct(gaps, 0.5), p95: pct(gaps, 0.95), worst1: pct(gaps, 0.99), main: busy / Math.max(1, gaps.length) };
  } finally {
    await ctx.close();
  }
}

const exe = process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers')).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const builds = { before: await serve(resolve(opt('before'))), after: await serve(resolve(opt('after'))) };
const rows = {};
for (let r = 0; r < runs; r++) {
  for (const place of PLACES) {
    if (only && !only.includes(place.id)) continue;
    for (const which of r % 2 ? ['after', 'before'] : ['before', 'after']) {
      const m = await measure(browser, builds[which].base, place);
      ((rows[place.id] ??= { before: [], after: [] })[which]).push(m);
      console.log(`${place.id.padEnd(14)} ${which.padEnd(6)} run ${r + 1}: ${m ? `${m.frames} frames, p50 ${m.p50.toFixed(1)} ms, p95 ${m.p95.toFixed(1)}, worst 1 % ${m.worst1.toFixed(1)}, main ${m.main.toFixed(1)} ms a frame` : 'never ready'}`);
    }
  }
}
// the median run's of each column, a row a place
const med = (list, k) => pct(list.filter(Boolean).map((m) => m[k]), 0.5);
console.log(`\n| place | build | frames in ${windowMs / 1000} s | p50 (ms) | p95 (ms) | worst 1 % (ms) | main thread a frame (ms) |\n| --- | --- | --- | --- | --- | --- | --- |`);
for (const [id, both] of Object.entries(rows)) {
  for (const which of ['before', 'after']) console.log(`| ${id} | ${which} | ${med(both[which], 'frames')} | ${med(both[which], 'p50').toFixed(1)} | ${med(both[which], 'p95').toFixed(1)} | ${med(both[which], 'worst1').toFixed(1)} | ${med(both[which], 'main').toFixed(1)} |`);
}
await browser.close();
builds.before.stop();
builds.after.stop();
