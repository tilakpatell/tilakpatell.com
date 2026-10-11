#!/usr/bin/env node
/* global window */
// The reference frames every GPU-first lane is scored against (the design’s
// G1, docs/superpowers/specs/2026-10-11-gpu-first-renderer-design.md §4):
// each world shot eight times at its pose, the camera moved by a different
// sub-pixel offset each time (Halton 2, 3: lib/three/jitter), with no
// temporal pass, and the shots averaged in linear light. What comes out is
// the world’s own stack supersampled: the picture a candidate frame would
// be with perfect anti-aliasing, which scripts/frame-score.mjs scores
// against with FLIP.
//
//   node scripts/reference-frames.mjs <world…> [--pose open|<view>] [--size 1600x900]
//     [--jitter 8] [--gpu webgpu|webgl] [--quality ultra] [--adapter auto|swiftshader|system]
//     [--out docs/superpowers/evidence/gpu-first/reference] [--label name] [--keep]
//
// A world is `litWorld` (the lit fixture: scripts/light-fixture/index.html,
// at the tier --quality names), `battlefront:<id>` (/battlefront/<id>/galacticAssault),
// a route starting with / as it is, or a galaxy world’s id (/galaxy/<id>/surface).
// Each is opened on Vite’s dev server with ?quality=<q>&calibrate=off&gpu=<leg>&traa=off
// (the dev-only hooks: ?traa=off leaves the chain’s TRAA out,
// window.__RUNTIME__.gfx.jitter(i) or the fixture’s window.__lit.jitter(i)
// offsets the camera); a route’s page clock is installed and stopped, as
// scripts/gpu-parity.mjs stops it, so a world that moves on its own (a sun,
// a tide) is where it was on every run and only the 16 ms frames let run
// move it; the fixture draws fixed steps of its own, and its shots are
// drawn at a step of 0, so nothing moves between them. --pose names a
// world’s view(name) (‘open’, the default, is the world as it opens; a
// world without the hook is shot as it opens, and the JSON says so).
//
// Out: <out>/<world>[.<backend>].png (no suffix for webgpu, the laptop’s
// reference; .nodes-webgl for the node renderer over WebGL 2, the cloud’s
// software-GL leg) and the same name .json: { _source, world, route, pose,
// size, backend, three, jitter, quality, commit, date }. --keep writes each
// shot beside it. --label replaces <world> in the names (a second run to
// compare with the first: Review Focus 4 of the G1 plan).
// The canvas’s size never changes for a measurement: the viewport is
// --size at a device scale of 1, so the reference is at the screen’s own
// pixels (the design’s §5: the ratio capped at 2 is the world’s, not this
// script’s).

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { averageLinear } from './lib/frame-metrics.mjs';
import { NOISE } from './lib/noise.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLOCK = new Date('2026-10-08T12:00:00Z'); // _source: scripts/gpu-parity.mjs’s CLOCK, so the two scripts see the same moment
const WARM = 60; // _source: scripts/light-fixture.mjs’s 60 fixed frames before a shot; frames before the first shot
const FRAMES = 120; // _source: scripts/gpu-parity.mjs’s FRAMES; a route’s frames after it is on, two seconds of its time

const args = parseArgs(process.argv.slice(2));
const worlds = args._;
if (!worlds.length) {
  console.log('usage: node scripts/reference-frames.mjs <world…> [--pose open|<view>] [--size 1600x900] [--jitter 8] [--gpu webgpu|webgl] [--quality ultra] [--out dir] [--label name] [--keep]');
  process.exit(2);
}
const [width, height] = String(args.size ?? '1600x900').split('x').map(Number);
const jitter = Math.max(1, Number(args.jitter) || 8);
const leg = args.gpu === 'webgl' ? 'webgl' : 'webgpu';
const quality = ['low', 'mid', 'high', 'ultra'].includes(args.quality) ? args.quality : 'ultra';
const pose = typeof args.pose === 'string' ? args.pose : 'open';
const settle = Number(args.settle) || 8000;
const OUT = typeof args.out === 'string' && isAbsolute(args.out) ? args.out : join(ROOT, typeof args.out === 'string' ? args.out : 'docs/superpowers/evidence/gpu-first/reference');
mkdirSync(OUT, { recursive: true });

const routeOf = (w) => (w === 'litWorld' ? null : w.startsWith('/') ? w : w.startsWith('battlefront:') ? `/battlefront/${w.slice(12)}/galacticAssault` : `/galaxy/${w}/surface`);
const slug = (w) => w.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-');
const three = JSON.parse(readFileSync(join(ROOT, 'node_modules/three/package.json'), 'utf8')).version;
let commit = null;
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
} catch {
  /* not a checkout */
}

const { chromium } = await import('playwright-core');
const sharp = (await import('sharp')).default;
const { adapterFor, angleFor, findChromium, launchArgs } = await import('./lib/chromium.mjs');
const exe = args.chromium ?? findChromium();
if (!exe) {
  console.log('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args: [...launchArgs({ angle: angleFor(), webgpu: true, adapter: adapterFor({ adapter: args.adapter }) }), '--js-flags=--max-old-space-size=4096'] });

const raw = async (png) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
};

// the fixture: its own page, drawn in fixed steps
async function shootFixture(page) {
  const fixture = { tier: quality };
  await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&traa=off&fixture=${encodeURIComponent(JSON.stringify(fixture))}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__lit.error);
  if (err) throw new Error(err);
  const { backend, passes, posed } = await page.evaluate((p) => {
    const lit = window.__lit;
    // (the fixture’s view() knows its named framings and falls back to the open one)
    if (p !== 'open') lit.probe.view(p);
    return { backend: lit.backend, passes: lit.probe.passes, posed: true };
  }, pose);
  await page.evaluate((n) => window.__lit.draw(n, 1 / 60), WARM);
  const shots = [];
  for (let i = 0; i < jitter; i++) {
    // (a step of 0: the cube’s turn and the weather’s clock stand still between shots)
    await page.evaluate((k) => (window.__lit.jitter(k), window.__lit.draw(2, 0)), i);
    shots.push(await page.locator('canvas').screenshot({ type: 'png' }));
  }
  await page.evaluate(() => window.__lit.jitter(null));
  return { backend, passes, posed, shots };
}

// a world on the site: the runtime’s page, its clock stopped
async function shootRoute(page, route) {
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(new Date(CLOCK.getTime() + 1000));
  await page.goto(`${base}/?quality=${quality}&calibrate=off&gpu=${leg}&traa=off#${route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const started = Date.now();
  for (;;) {
    const on = await page.evaluate(() => window.__RUNTIME__?.status === 'on' && Boolean(window.__RUNTIME__.current?.world));
    if (on) break;
    if (Date.now() - started > Number(args.wait ?? 600000)) throw new Error('the world never came on');
    await page.clock.runFor(16);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(settle);
  for (let n = 0; n < FRAMES; n++) {
    await page.clock.runFor(16);
    await page.waitForTimeout(50);
  }
  const info = await page.evaluate(async (p) => {
    const rt = window.__RUNTIME__;
    const w = rt.current.world;
    let posed = p === 'open';
    if (!posed && typeof w.view === 'function') {
      await Promise.resolve(w.view(p));
      posed = true;
    }
    return { backend: rt.gfx?.backend ?? null, jitters: typeof rt.gfx?.jitter === 'function', posed };
  }, pose);
  if (!info.jitters) throw new Error(`the world is on ${info.backend}, which has no jitter hook (a 'nodes' world only: the classic renderer is not a reference)`);
  const shots = [];
  for (let i = 0; i < jitter; i++) {
    await page.evaluate((k) => window.__RUNTIME__.gfx.jitter(k), i);
    // (two frames: the jittered one drawn, then on screen at the compositor’s next)
    for (let n = 0; n < 2; n++) await page.clock.runFor(16);
    await page.waitForTimeout(300);
    shots.push(await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide', timeout: 120000 }));
  }
  await page.evaluate(() => window.__RUNTIME__.gfx.jitter(null));
  return { ...info, shots };
}

let failed = 0;
try {
  for (const world of worlds) {
    const route = routeOf(world);
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      const set = (k, v) => window.localStorage.setItem(k, v);
      set('tp-intro', '1');
      set('tp-start', '"universe"');
      set('tp-sound', 'off');
      set('tp-worlds', JSON.stringify('load'));
      set('tp-tour', 'skipped');
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
    page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(m.text().slice(0, 200)));
    const started = Date.now();
    try {
      const got = route ? await shootRoute(page, route) : await shootFixture(page);
      const name = `${typeof args.label === 'string' ? args.label : slug(world)}${got.backend === 'webgpu' ? '' : `.${got.backend}`}`;
      const images = await Promise.all(got.shots.map(raw));
      const avg = averageLinear(images);
      await sharp(Buffer.from(avg.data), { raw: { width: avg.width, height: avg.height, channels: 3 } }).png().toFile(join(OUT, `${name}.png`));
      if (args.keep) got.shots.forEach((png, i) => writeFileSync(join(OUT, `${name}-shot${i}.png`), png));
      const meta = {
        _source: `node scripts/reference-frames.mjs ${process.argv.slice(2).join(' ')} (${new Date().toISOString().slice(0, 10)}, ${process.platform}, ANGLE ${angleFor()})`,
        world,
        route,
        pose: got.posed ? pose : `open (the world has no view('${pose}'))`,
        size: `${avg.width}x${avg.height}`,
        backend: got.backend,
        passes: got.passes,
        three,
        jitter: { shots: jitter, sequence: 'Halton (2, 3) from its first point, centred on the pixel (src/lib/three/jitter.js)' },
        quality,
        commit,
        seconds: Math.round((Date.now() - started) / 1000),
        errors: [...new Set(errors)],
      };
      writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(meta, null, 1)}\n`);
      console.log(`ok   ${world}: ${name}.png (${meta.size}, ${got.backend}, ${jitter} shots, ${meta.seconds} s)${errors.length ? `, errors: ${meta.errors.join('; ')}` : ''}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${world}: ${String(e.message ?? e).split('\n')[0]}`);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
