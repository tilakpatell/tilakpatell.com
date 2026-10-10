#!/usr/bin/env node
/* global window, document, requestAnimationFrame */
// The game's world shot for the gallery (the sixth design's picture lane):
// the Battlefront world at each tier asked, on one or both of the node
// renderer's kinds, from lane 5's three shots (the deploy screen over the
// overview camera, the field after deploying, the end card) and the nine
// spots of src/components/battlefront/spots.js (under the AT-AT's path,
// the uplink, the hangar mouth in the low sun and from inside, five of the
// level's own cameras): twelve a leg and tier, each a shot and a row of
// the whole frame's draw calls, triangles and textures (the renderer's
// info over one frame), the level's own counts, the passes on, and the
// frame times over --frames frames.
//
//   node scripts/battlefront-shots.mjs [--gpu webgl|webgpu|both] [--quality ultra,high]
//     [--size 1920x1080] [--frames 60] [--out docs/superpowers/evidence/bf2017-picture] [--hidden]
//     [--spots deploy,field,…] (only these; default all twelve)
//
// On the owner's laptop (an RTX 5090): ANGLE=d3d11 CHROME=<path to msedge.exe>
// with PLAYWRIGHT_BROWSERS_PATH unset; there both legs draw on the GPU and
// the frame times are the gallery's. On a machine without one (Linux with no
// display) both draw on SwiftShader: the counts hold, the times are the
// CPU's and are written as such, and the WebGPU leg's device is lost on its
// first frame (scripts/gpu-parity/README.md), which the row says.
//
// --hidden: one extra run, the world's tab put behind another as the world
// loads (the fidelity design's background-tab rule, lane F's `nextFrame`):
// how long the world took to come up and its level to load, whether the
// page really was hidden, and whether the effects came. Nothing is shot.
//
// It fails on a console error.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const gpu = arg('gpu', 'both');
const legs = gpu === 'both' ? ['webgl', 'webgpu'] : [gpu];
const tiers = arg('quality', 'ultra,high').split(',');
const OUT = resolve(ROOT, arg('out', 'docs/superpowers/evidence/bf2017-picture'));
const [W, H] = arg('size', '1920x1080').split('x').map(Number);
const FRAMES = Number(arg('frames', 60));
const WAIT = Number(arg('wait', process.env.PHASE_WAIT ?? 1800000));
const HIDDEN = argv.includes('--hidden');
const ONLY = arg('spots', null)?.split(',') ?? null;
const wanted = (name) => !ONLY || ONLY.includes(name);
const say = (...a) => console.error(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const ROUTE = '/battlefront/hoth/galacticAssault';
mkdirSync(OUT, { recursive: true });

const { chromium } = await import('playwright-core');
const exe =
  process.env.CHROME ??
  process.env.CHROMIUM ??
  (existsSync('/opt/pw-browsers')
    ? readdirSync('/opt/pw-browsers', { withFileTypes: true })
        .filter((d) => /^chromium-\d+$/.test(d.name))
        .map((d) => `/opt/pw-browsers/${d.name}/chrome-linux/chrome`)
        .find(existsSync)
    : undefined);
if (!exe) {
  console.error('no browser (set CHROME=/path/to/msedge or chrome)');
  process.exit(2);
}
const swift = process.platform === 'linux' && !process.env.DISPLAY;
const angle = process.env.ANGLE;
const args = [
  ...(angle ? [`--use-angle=${angle}`] : process.platform === 'darwin' ? ['--use-angle=metal'] : swift ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan',
  ...(swift && !angle ? ['--use-webgpu-adapter=swiftshader'] : []),
  '--ignore-gpu-blocklist',
  '--enable-webgl',
];

const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args });

const frames = (page, n) =>
  page.evaluate(
    (k) =>
      new Promise((done) => {
        let left = k;
        const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );

// one whole frame's counts (every pass), then the frame times over n frames
const measure = (page, n) =>
  page.evaluate(
    (k) =>
      new Promise((done) => {
        const info = window.__battlefront.renderer.info;
        const wasAuto = info.autoReset;
        info.autoReset = false;
        info.reset();
        const times = [];
        let frame = null;
        let last = performance.now();
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (!frame) frame = { calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures, geometries: info.memory.geometries };
          info.reset();
          if (times.length < k + 1) requestAnimationFrame(tick);
          else {
            info.autoReset = wasAuto;
            const t = times.slice(1).sort((a, b) => a - b);
            const pick = (q) => +t[Math.min(t.length - 1, Math.floor(q * t.length))].toFixed(1);
            done({ ...frame, frames: t.length, median: pick(0.5), p95: pick(0.95) });
          }
        };
        requestAnimationFrame(tick);
      }),
    n,
  );

async function open(kind, tier, { hidden = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript((q) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.localStorage.setItem('tp-quality', q);
  }, tier);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(`${base}/#${ROUTE}?gpu=${kind}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  let front = null;
  if (hidden) {
    front = await ctx.newPage();
    await front.goto('about:blank');
    await front.bringToFront();
  }
  for (const until = Date.now() + WAIT; ; ) {
    const failed = errors.find((e) => /3D failed|device.*lost/i.test(e));
    if (failed) throw new Error(failed.split('\n')[0]);
    if (await page.evaluate(() => Boolean(window.__battlefront?.view))) break;
    if (Date.now() > until) throw new Error('the world never came up');
    await page.waitForTimeout(1000);
  }
  const upMs = Date.now() - t0;
  say(kind, tier, `the world up in ${upMs} ms; waiting for the level`);
  const visibility = await page.evaluate(() => document.visibilityState);
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  return { ctx, page, errors, front, upMs, loadedMs: Date.now() - t0, visibility };
}

const loaded = (page) => page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });

async function leg(kind, tier) {
  const { ctx, page, errors, upMs, loadedMs } = await open(kind, tier);
  const out = { leg: kind, tier, backend: await page.evaluate(() => window.__battlefront.do('gpu')), upMs, loadedMs, errors, rows: [] };
  say(kind, tier, `up in ${upMs} ms, the level loaded in ${loadedMs} ms`);
  const shot = async (name, extra = {}) => {
    if (!wanted(name)) return;
    say(kind, tier, name);
    await loaded(page);
    await frames(page, 3);
    const file = join(OUT, `${name}-${tier}-${kind}.png`);
    await page.screenshot({ path: file, timeout: WAIT });
    const m = await measure(page, FRAMES);
    const v = await page.evaluate(() => {
      const s = window.__battlefront.view();
      return { level: s.level, passes: s.passes, weather: s.weather };
    });
    out.rows.push({ spot: name, shot: relative(ROOT, file), ...m, level: { calls: v.level.calls, tris: Math.round(v.level.tris), instances: v.level.instances }, passes: v.passes, weather: v.weather, ...extra });
  };
  await shot('deploy');
  await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  await page.evaluate(() => window.__battlefront.do('advance', 30));
  await shot('field');
  const names = (await page.evaluate(() => window.__battlefront.do('spot', '?').spots)).filter(wanted);
  for (const name of names) {
    const r = await page.evaluate((n) => window.__battlefront.do('spot', n), name);
    await shot(name, { source: r.spot.source });
  }
  await page.evaluate(() => window.__battlefront.do('spot', null));
  await page.evaluate(() => window.__battlefront.do('win'));
  await page.waitForTimeout(500);
  await shot('end');
  await ctx.close();
  return out;
}

async function hiddenRun(kind, tier) {
  const { ctx, page, errors, upMs, loadedMs, visibility } = await open(kind, tier, { hidden: true });
  const view = await page.evaluate(() => window.__battlefront.view());
  const deploy = await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  await ctx.close();
  return { hidden: true, leg: kind, tier, visibility, upMs, loadedMs, deploy, effects: view.passes?.effects ?? null, errors };
}

const results = [];
for (const tier of tiers) {
  for (const kind of legs) {
    try {
      results.push(await leg(kind, tier));
    } catch (e) {
      results.push({ leg: kind, tier, failed: String(e).split('\n')[0], gates: kind !== 'webgpu' || !swift });
    }
  }
}
if (HIDDEN) {
  try {
    results.push(await hiddenRun(legs[0], tiers[0]));
  } catch (e) {
    results.push({ hidden: true, leg: legs[0], tier: tiers[0], failed: String(e).split('\n')[0], gates: true });
  }
}
const note = swift && !angle ? 'SwiftShader: the counts hold; the times are the CPU’s, not a GPU’s' : `the GPU (${angle ?? 'default ANGLE'})`;
writeFileSync(join(OUT, `shots${swift && !angle ? '-swiftshader' : ''}.json`), `${JSON.stringify({ route: ROUTE, size: [W, H], frames: FRAMES, where: note, results }, null, 2)}\n`);
for (const r of results) {
  if (r.failed) console.log(`${r.leg} ${r.tier}: failed — ${r.failed}`);
  else if (r.hidden) console.log(`hidden ${r.leg} ${r.tier}: ${r.visibility}, up ${r.upMs} ms, loaded ${r.loadedMs} ms, effects ${JSON.stringify(r.effects)}`);
  else for (const row of r.rows) console.log(`${r.leg} ${r.tier} ${row.spot}: ${row.calls} calls, ${row.triangles} tris, ${row.textures} textures, ${row.median} ms (p95 ${row.p95}); passes ${row.passes?.post?.join(' ')}`);
}
console.log(note);

await browser.close();
await server.close();
const bad = results.some((r) => (r.failed && r.gates) || r.errors?.length);
process.exit(bad ? 1 : 0);
