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
//   OATH='{"since":1,"war":"gcw","oaths":{"gcw":{"side":"rebel","sworn":1}}}' … (sworn, at the held clock's campaign)
//   ANGLE=d3d11 … (draw on the graphics chip, not in software)
//   PHASE_WAIT=900000 … (ms for the world to come up: a level pack in software GL takes minutes)
//   DIAG=1 … (each of the scene's top groups' share of the calls, hidden in turn)
//   BUDGET=1 … (or BUDGET=path/to/baseline.json): each world held to its
//     quality level's row of the budget table (src/lib/budgets.js, the
//     quality modes design: docs/superpowers/specs/2026-10-07-quality-modes-
//     design.md §2), against that level's baseline, lab/baseline/surface-
//     <QUALITY>.json: draw calls and triangles no more than the baseline's
//     +10% and never over the row's ceiling, its models (every .glb it
//     fetched) no more than the row's megabytes; a line per world, and exit
//     1 on a breach (BUDGET_SCALE=0.5 tightens it, to see it fail).
//     QUALITY=ultra has no triangle ceiling: its triangles are reported, and
//     it is held to the draw calls and the megabytes, and, drawn on a real
//     graphics chip (ANGLE=d3d11 or metal), to a frame p95 of 16.7 ms at
//     1440p (the viewport grows to 2560×1440 for it). In software GL the
//     ultra frame times are only reported. A world already over its row as
//     main stands (galaxy-budget.mjs KNOWN_OVER: Endor) is held to its own
//     baseline +10% instead, and the line says so, until it's trimmed.
//   A baseline is this script's own JSON (JSON=1) for the level, kept as
//     lab/baseline/surface-<level>.json:
//       QUALITY=high JSON=1 OUT=/tmp/b node scripts/galaxy-check.mjs surface <all landable ids>
//       cp /tmp/b/surface-high.json lab/baseline/surface-high.json
//     (TODO, the owner's desktop: lab/baseline/surface-ultra.json, made with
//     ANGLE=d3d11 QUALITY=ultra, so the ultra run has calls to compare.)
// Headless Chromium draws in software (SwiftShader), slowly: the frame times
// only mean something compared with another run on the same machine, the
// counts mean the same anywhere. So that two runs see the same thing, the
// page's clock is held at one moment (the set pieces move by the wall
// clock) and its random numbers are seeded (where the ship starts), unless
// LIVE=1. The runtime's calibration is switched off (?calibrate=off), so every
// run draws at the sharpest step, as the baselines were made, instead of a
// software GL's walk down to the softest.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { budget } from '../src/lib/budgets.js';
import { limitsFor, overBy } from './galaxy-budget.mjs';

const [mode = 'space', list = 'tatooine'] = process.argv.slice(2);
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const ship = process.env.SHIP ?? 'xwing';
const oath = process.env.OATH ?? null; // (allegiance.js's saved oath, as JSON: the side you land as)
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const settle = Number(process.env.WAIT ?? 9000);
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const angle = process.env.ANGLE ?? 'swiftshader'; // (d3d11, metal or vulkan: the machine's own graphics chip, for frame times that mean something)
const realGpu = angle !== 'swiftshader';
// (ultra's frame-time test is at 1440p, on a real graphics chip)
const viewport = quality === 'ultra' && realGpu ? { width: 2560, height: 1440 } : { width: 1280, height: 720 };
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', `--use-angle=${angle}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
for (const id of list.split(',')) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(({ ship: s, oath }) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
    window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking: a software GL is slow, and that's the point)
    if (oath) window.localStorage.setItem('tp-gcw-side', oath);
  }, { ship, oath });
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
  await page.goto(`${base}/?quality=${quality}&calibrate=off#${path}`, { waitUntil: 'domcontentloaded' });
  const ready = mode === 'surface' ? () => Boolean(window.__surfaceScene?.renderer) : () => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system);
  try {
    await page.waitForFunction(ready, null, { timeout: Number(process.env.PHASE_WAIT ?? 180000) });
  } catch {
    results.push({ id, error: 'timed out waiting for the scene', errors });
    await ctx.close();
    continue;
  }
  const loaded = (Date.now() - t0) / 1000;
  // (on the surface, the floor's light baked first: the bake's passes are a
  // one-off, not a frame anyone plays. A world with no ground, cloud-borne,
  // has none to wait for: it runs out the clock)
  if (mode === 'surface') await page.waitForFunction(() => Boolean(window.__surfaceScene.api?.ground?.stats?.baked), null, { timeout: Number(process.env.BAKE_WAIT ?? 150000), polling: 1000 }).catch(() => {});
  await page.waitForTimeout(settle);
  // (the world up before it's measured: a world is prepared out of sight,
  // every picture and shader sent a slice a frame behind its loading screen,
  // and only then shown, the runtime's status 'on'; in software GL that can
  // outlast the settle wait. Measured before, it drew nothing of itself, and
  // the gate fails it)
  await page.waitForFunction(() => !window.__RUNTIME__ || window.__RUNTIME__.status === 'on', null, { timeout: Number(process.env.DRAW_WAIT ?? 600000), polling: 2000 }).catch(() => errors.push('the world never came up (runtime status not on)'));
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
        window.__RUNTIME__?.invalidate();
        // (a frame asked for every tick, and three ticks at least, whatever a
        // software GL's frame takes: the runtime draws only when something
        // changes, and with the clock held a still world isn't drawn again)
        const tick = (now) => {
          window.__RUNTIME__?.invalidate();
          times.push(now - last);
          last = now;
          frame = { calls: info.render.calls, triangles: info.render.triangles, points: info.render.points, lines: info.render.lines };
          info.reset();
          if (now - t0 < 4000 || times.length < 3) requestAnimationFrame(tick);
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
              // (the ground war's update, smoothed: ground/groundScene.js's ms)
              ground: surface && window.__surfaceScene.groundWar ? +window.__surfaceScene.groundWar.ms.toFixed(2) : null,
              // (a level world's collision: surface/level/levelPhysics.js's stats, when it has an engine)
              level: surface && typeof window.__surfaceScene.level === 'function' ? window.__surfaceScene.level() : null,
              physics: surface && typeof window.__surfaceScene.physics === 'function' ? (({ dropped, ...rest }) => ({ ...rest, dropped: dropped?.length ?? 0 }))(window.__surfaceScene.physics() ?? {}) : null,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
    mode === 'surface',
  );
  // (DIAG=1: what each of the scene's top groups costs, by drawing a frame
  // with it hidden: the calls and triangles it takes, largest first)
  if (process.env.DIAG && mode === 'surface') {
    const parts = await page.evaluate(async () => {
      const { scene, renderer } = window.__surfaceScene;
      const info = renderer.info;
      const frame = () =>
        new Promise((r) => {
          window.__RUNTIME__?.invalidate();
          info.autoReset = false;
          info.reset();
          requestAnimationFrame(() => requestAnimationFrame(() => r({ calls: info.render.calls, tris: info.render.triangles })));
        });
      const all = await frame();
      const out = [];
      for (const [i, c] of scene.children.entries()) {
        if (!c.visible) continue;
        c.visible = false;
        const f = await frame();
        c.visible = true;
        out.push({ name: `${c.name || c.type}#${i}`, calls: all.calls - f.calls, tris: all.tris - f.tris });
      }
      info.autoReset = true;
      return { all, out: out.filter((o) => o.calls > 0).sort((a, b) => b.calls - a.calls) };
    });
    console.log(`${''.padEnd(10)} diag all ${parts.all.calls} calls: ${parts.out.map((o) => `${o.name} ${o.calls} (${Math.round(o.tris / 1000)}k)`).join(', ')}`);
  }
  const name = `${mode}-${id}-${quality}`;
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 });
  results.push({ id, loaded: +loaded.toFixed(1), ...stats, glbMB: +(glbBytes / 1e6).toFixed(1), errors: errors.slice(0, 5) });
  console.log(`${id.padEnd(10)} calls ${String(stats.calls).padStart(4)}  tris ${String(stats.triangles).padStart(7)}  geo ${String(stats.geometries).padStart(4)}  tex ${String(stats.textures).padStart(3)}  prog ${String(stats.programs).padStart(3)}  frame p50 ${stats.p50} p95 ${stats.p95} ms${stats.ground != null ? `  ground ${stats.ground} ms` : ''}  load ${loaded.toFixed(1)} s${errors.length ? `  errors ${errors.length}` : ''}`);
  if (stats.level) {
    const l = stats.level;
    console.log(`${''.padEnd(10)} level calls ${l.calls}  tris ${l.tris}  instances ${l.instances}  lights ${l.lights ?? 0}  probe ${l.probe ?? '–'}`);
  }
  if (stats.physics) {
    const p = stats.physics;
    console.log(`${''.padEnd(10)} physics cells ${p.cells}  bodies ${p.bodies}  colliders ${p.colliders}  shapes ${p.uniqueShapes}  trimesh tris ${p.triangles}  heightfields ${p.heightfields}  dropped ${p.dropped}  step ${(+p.stepMs || 0).toFixed(2)} ms`);
  }
  await ctx.close();
}
await browser.close();
if (process.env.JSON) writeFileSync(`${out}/${mode}-${quality}.json`, JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.error || r.errors?.length);
for (const r of bad) console.log('problem', r.id, r.error ?? '', r.errors);
if (process.env.BUDGET) {
  const file = process.env.BUDGET === '1' ? `lab/baseline/${mode}-${quality}.json` : process.env.BUDGET;
  // (no baseline for the level yet, ultra's until the owner's desktop makes one: the row's ceilings alone)
  const base = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  if (!base.length) console.log(`budget: no baseline at ${file}; holding to the ${quality} row alone`);
  const row = budget(quality);
  const k = Number(process.env.BUDGET_SCALE ?? 1);
  for (const r of results) {
    if (r.error) continue;
    const l = limitsFor({ id: r.id, quality, row, base: base.find((x) => x.id === r.id) ?? null, scale: k, realGpu });
    const over = overBy(r, l);
    const say = (v) => (v === Infinity ? '–' : Math.round(v));
    console.log(`budget ${r.id.padEnd(10)} calls ${r.calls}/${say(l.calls)}  tris ${r.triangles}/${say(l.tris)}  models ${r.glbMB}/${l.mb} MB${quality === 'ultra' ? `  p95 ${r.p95}/${realGpu ? l.frame.toFixed(1) : 'reported'} ms` : ''}  ${over.length ? `FAIL (${over.join(', ')})` : 'pass'}${l.known ? `  (known over the row, held to its baseline: ${l.known})` : ''}`);
    if (over.length) process.exitCode = 1;
  }
}
if (bad.length) process.exitCode = 1;
