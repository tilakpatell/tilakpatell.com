/* global window, requestAnimationFrame */
// A browser check of the galaxy (/galaxy) and its worlds (/galaxy/:id/surface):
// for each system or world it loads the page fresh, waits for the scene, lets
// it run, and reports one frame's renderer counts (draw calls, triangles,
// geometries, textures, programs) and the frame times over a few seconds,
// with a screenshot. With the dev server up (npx vite --port 5188) and
// Chromium where Playwright keeps it:
//   OUT=/tmp/shots node scripts/galaxy-check.mjs space endor,coruscant
//   OUT=/tmp/shots node scripts/galaxy-check.mjs surface tatooine,hoth
//   QUALITY=mid … (the device tier: ?quality=), SHIP=falcon …, JSON=1 …
//   BUDGET=lab/baseline/surface-high.json …: each world held to the planets
//     overhaul's budget (docs/superpowers/specs/2026-10-06-planets-overhaul-
//     design.md): draw calls and triangles no more than that run's +10%,
//     never over 600 calls or 2.5M triangles, its models (every .glb it
//     fetched) no more than 40 MB; a line per world, and exit 1 on a breach
//     (BUDGET_SCALE=0.5 tightens it, to see it fail)
// Headless Chromium draws in software (SwiftShader), slowly: the frame times
// only mean something compared with another run on the same machine, the
// counts mean the same anywhere. So that two runs see the same thing, the
// page's clock is held at one moment (the set pieces move by the wall
// clock) and its random numbers are seeded (where the ship starts), unless
// LIVE=1.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [mode = 'space', list = 'tatooine'] = process.argv.slice(2);
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const ship = process.env.SHIP ?? 'xwing';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const settle = Number(process.env.WAIT ?? 9000);
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
for (const id of list.split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((s) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
    window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
  }, ship);
  if (!process.env.LIVE) {
    await ctx.addInitScript(() => {
      let a = 0x2f6b9c1d;
      Math.random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const held = Date.UTC(2026, 9, 5, 12);
      Date.now = () => held;
    });
  }
  const page = await ctx.newPage();
  // what its models weigh: every .glb it fetched (a fresh context: nothing cached)
  let glbBytes = 0;
  page.on('requestfinished', async (req) => {
    if (!/\.glb(\?|$)/.test(req.url())) return;
    const sizes = await req.sizes().catch(() => null);
    glbBytes += sizes?.responseBodySize ?? 0;
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const t0 = Date.now();
  const path = mode === 'surface' ? `/galaxy/${id}/surface` : `/galaxy/${id}`;
  await page.goto(`${base}/?quality=${quality}#${path}`, { waitUntil: 'domcontentloaded' });
  const ready = mode === 'surface' ? () => Boolean(window.__surfaceScene?.renderer) : () => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system);
  try {
    await page.waitForFunction(ready, null, { timeout: 180000 });
  } catch {
    results.push({ id, error: 'timed out waiting for the scene', errors });
    await ctx.close();
    continue;
  }
  const loaded = (Date.now() - t0) / 1000;
  await page.waitForTimeout(settle);
  // (in space, the ship put in one place, the same for every run: off the
  // planet on its sun side, facing it, stopped. The seeded randomness alone
  // can't hold it there: three.js draws on Math.random for every object's
  // id, so a change that makes more objects moves the ship.)
  if (mode !== 'surface' && !process.env.LIVE) {
    await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
    await page.evaluate(() => {
      const { state } = window.__galaxyDebug;
      const r = state.world?.body?.radius ?? 30;
      const sun = state.sys.suns[0].dir;
      const l = Math.hypot(sun[0], sun[2]) || 1;
      const [sx, sz] = [sun[0] / l, sun[2] / l];
      const d = r * 3.2 + 26;
      const pose = { x: sx * d, y: d * 0.12, z: sz * d, heading: Math.atan2(sx, sz), pitch: -Math.atan(0.12), bank: 0 };
      // (pin puts the camera straight behind it too: put there by hand, the camera would still be easing round to it, to a different view for every frame the software GL happened to draw)
      if (window.__galaxyDebug.pin) window.__galaxyDebug.pin(pose);
      else {
        state.auto = null;
        state.ship = { ...state.ship, ...pose, speed: 0, rate: 0, tipRate: 0, rollRate: 0 };
      }
    });
    await page.waitForTimeout(2500);
  }
  // one whole frame's counts (every pass), and the frame times over 4 s
  const stats = await page.evaluate(
    (surface) =>
      new Promise((done) => {
        const renderer = surface ? window.__surfaceScene.renderer : window.__galaxyDebug.renderer;
        const info = renderer.info;
        const wasAuto = info.autoReset;
        info.autoReset = false;
        const times = [];
        let frame = null;
        let last = performance.now();
        const t0 = last;
        const tick = (now) => {
          times.push(now - last);
          last = now;
          frame = { calls: info.render.calls, triangles: info.render.triangles, points: info.render.points, lines: info.render.lines };
          info.reset();
          if (now - t0 < 4000) requestAnimationFrame(tick);
          else {
            info.autoReset = wasAuto;
            times.sort((a, b) => a - b);
            const pick = (q) => +times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(1);
            done({
              ...frame,
              geometries: info.memory.geometries,
              textures: info.memory.textures,
              programs: info.programs?.length ?? null,
              frames: times.length,
              p50: pick(0.5),
              p95: pick(0.95),
              ratio: renderer.getPixelRatio(),
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    mode === 'surface',
  );
  const name = `${mode}-${id}-${quality}`;
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
  results.push({ id, loaded: +loaded.toFixed(1), ...stats, glbMB: +(glbBytes / 1e6).toFixed(1), errors: errors.slice(0, 5) });
  console.log(`${id.padEnd(10)} calls ${String(stats.calls).padStart(4)}  tris ${String(stats.triangles).padStart(7)}  geo ${String(stats.geometries).padStart(4)}  tex ${String(stats.textures).padStart(3)}  prog ${String(stats.programs).padStart(3)}  frame p50 ${stats.p50} p95 ${stats.p95} ms  load ${loaded.toFixed(1)} s${errors.length ? `  errors ${errors.length}` : ''}`);
  await ctx.close();
}
await browser.close();
if (process.env.JSON) writeFileSync(`${out}/${mode}-${quality}.json`, JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.error || r.errors?.length);
for (const r of bad) console.log('problem', r.id, r.error ?? '', r.errors);
if (process.env.BUDGET) {
  const base = JSON.parse(readFileSync(process.env.BUDGET, 'utf8'));
  const k = Number(process.env.BUDGET_SCALE ?? 1);
  for (const r of results) {
    if (r.error) continue;
    const b = base.find((x) => x.id === r.id);
    const calls = Math.min(600, (b?.calls ?? 600) * 1.1) * k;
    const tris = Math.min(2.5e6, (b?.triangles ?? 2.5e6) * 1.1) * k;
    const mb = 40 * k;
    const over = [r.calls > calls && `calls ${r.calls} > ${Math.round(calls)}`, r.triangles > tris && `tris ${r.triangles} > ${Math.round(tris)}`, r.glbMB > mb && `models ${r.glbMB} MB > ${mb}`].filter(Boolean);
    console.log(`budget ${r.id.padEnd(10)} calls ${r.calls}/${Math.round(calls)}  tris ${r.triangles}/${Math.round(tris)}  models ${r.glbMB}/${mb} MB  ${over.length ? `FAIL (${over.join(', ')})` : 'pass'}`);
    if (over.length) process.exitCode = 1;
  }
}
if (bad.length) process.exitCode = 1;
