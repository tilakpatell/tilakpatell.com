/* global window */
// The endless universe flown in a browser, on a fixed route, checking what
// can't be checked in Node: that generated space comes in round the ship in
// every direction with nothing popping, that the old rim and a sector's face
// are crossed without a seam, that a generated system is built whole as the
// ship comes in, and that the ship climbs 50,000 straight up and is never
// turned back.
//
//   node scripts/universe-endless-check.mjs [--quality mid|low] [--url http://127.0.0.1:5173]
//
// Steps, each waited for on a condition, never a time: `start` (the default
// start with a ship), `old-rim` (from inside where the rim was to past it, on
// the pulse drive), `boundary` (across x = 60,000, till the new face is in),
// `system` (into the nearest generated system, till it's built whole) and
// `climb` (up to 50,000 above home, a few thousand a step). Each records the
// pops (the far layer's: a disc from nothing to whole in a frame), the
// Expanse's own time a frame, the draw calls and triangles, the generated
// places within 9,000 and the nearest, and the page's errors.
//
// Exit 1 on a pop over 4 px, an error, a step that never arrives, fewer than
// three places within 9,000 or none within 6,000 (the spec's numbers), or the
// ship pushed back down on the climb. The Expanse's time is printed, not
// judged: headless Chromium draws in software here, so it says little of a
// real chip (its budget is universe/budget.js's `expanseMs`).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium } from './lib/chromium.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const QUALITY = arg('quality', 'mid');
const freePort = () =>
  new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });

let server = null;
let base = arg('url', null)?.replace(/\/$/, '') ?? null;
if (!base) {
  const port = await freePort();
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    if (Date.now() - up > 60000) throw new Error('the dev server never answered');
    await new Promise((r) => setTimeout(r, 300));
  }
}

const exe = findChromium() ?? ['/opt/pw-browsers/chromium'].find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-quality', q);
  window.localStorage.setItem('tp-universe-ship', '"falcon"');
  window.__tpKeepFrames = true;
}, QUALITY);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let failed = 0;
const fail = (what) => {
  failed++;
  console.log(`FAIL ${what}`);
};
const until = (fn, arg, timeout = 240000) =>
  page
    .waitForFunction(fn, arg, { timeout, polling: 500 })
    .then(() => true)
    .catch(() => false);
const read = () =>
  page.evaluate(() => {
    const d = window.__universeDebug;
    const ex = d.expanse;
    const s = d.state.ship;
    const here = s ? [s.x, s.y, s.z] : [0, 0, 0];
    return { at: here.map(Math.round), sector: ex.sector(), loaded: ex.loaded().length, built: [...ex.built()], workMs: +ex.workMs().toFixed(2), discs: d.farStars.discs.count(), calls: d.renderer.info.render.calls, tris: d.renderer.info.render.triangles, around: ex.around(here, 9000), pops: d.farStars.pops() };
  });
const step = async (name, go, arrived) => {
  await page.evaluate(() => window.__universeDebug.farStars.pops()); // (counted from here)
  if (go) await page.evaluate(go);
  const ok = await until(arrived);
  if (!ok) return fail(`${name}: never arrived`);
  await page.waitForTimeout(1500);
  const r = await read();
  console.log(`${name.padEnd(9)} ${JSON.stringify(r)}`);
  if (r.pops.px > 4) fail(`${name}: a pop of ${Math.round(r.pops.px)} px`);
  if (r.around.count < 3) fail(`${name}: ${r.around.count} places within 9,000 (want 3)`);
  if (r.around.nearest > 6000) fail(`${name}: the nearest place is ${Math.round(r.around.nearest)} off (want 6,000 or less)`);
  return r;
};

try {
  await page.goto(`${base}/?quality=${QUALITY}#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (!(await until(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.state?.model, null, 300000))) throw new Error('the map never came up');
  const loaded27 = () => window.__universeDebug.expanse.loaded().length >= 27;
  await step('start', null, loaded27);
  await step('old-rim', () => window.__universeDebug.teleport(47000, 0, 0, -Math.PI / 2, 0), () => window.__universeDebug.state.ship.x > 47000 && window.__universeDebug.expanse.loaded().length >= 27);
  await page.evaluate(() => window.__universeDebug.teleport(53000, 0, 0, -Math.PI / 2, 0));
  await step('boundary', () => window.__universeDebug.teleport(61000, 0, 0, -Math.PI / 2, 0), () => window.__universeDebug.expanse.sector() === 'E:1,0' && window.__universeDebug.expanse.loaded().length >= 27);
  await step(
    'system',
    () => {
      const d = window.__universeDebug;
      const s = d.state.ship;
      const n = d.expanse.nearestSystem([s.x, s.y, s.z]);
      const a = n.system.at;
      d.teleport(a[0], a[1] + n.system.reach * 0.3, a[2] + n.system.reach * 0.8, 0, -0.25);
    },
    () => window.__universeDebug.expanse.built().size > 0,
  );
  // the climb: 5,000 at a time, never pushed back down
  let lowest = Infinity;
  for (let y = 5000; y <= 50000; y += 5000) {
    await page.evaluate((y) => window.__universeDebug.teleport(0, y, 3000, 0, 0.6), y);
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => window.__universeDebug.state.ship.y);
    if (at < y - 50) lowest = Math.min(lowest, at - y);
  }
  if (lowest < 0) fail(`climb: pushed back down by ${Math.round(-lowest)}`);
  await step('climb', null, loaded27);
} catch (e) {
  fail(String(e.message ?? e));
} finally {
  if (errors.length) fail(`errors: ${JSON.stringify(errors.slice(0, 8))}`);
  await browser.close();
  server?.kill();
}
console.log(failed ? `${failed} failed` : 'ok');
process.exit(failed ? 1 : 0);
