#!/usr/bin/env node
/* global window */
// The lit fixture on both of the node renderer's kinds, headless: lane R's
// proof (docs/superpowers/plans/2026-10-10-galaxy-engine-laneR-light.md).
//
//   node scripts/light-fixture.mjs [--tier ultra] [--post on|off] [--sky on|off]
//     [--grid] [--only render,ao,…] [--label name] [--size 1600x900] [--ms 5000] [--legs webgpu,webgl]
//     [--volume [on|off]] [--weather interior|sunny|felucia] [--view wide|edge|sun] [--pan]
//
// For each leg (?gpu=webgpu, and ?gpu=webgl: the node renderer on a WebGL 2
// context) it opens scripts/light-fixture/index.html on a Vite dev server
// and:
// - shoots the fixture after 60 fixed frames into
//   docs/superpowers/evidence/galaxy-engine/R/<label>-<leg>.png;
// - the environment (A2): the frame with scene.environment and without,
//   the mean difference per channel (0…255); none means the placed lights'
//   lighting dropped the environment;
// - no recompile: the renderer's pipelines counted before and after a
//   placed light moves and changes colour over 30 frames;
// - the frame time: frames drawn back to back for --ms, each waited on,
//   the mean, the median and the 95th percentile (the mean is the one to
//   read: a post chain's frames queue behind one another, so a few carry
//   the wait for the rest);
// - with --grid (A3): an arena-sized probe grid baked, the bake's time to
//   the GPU's end, a shot with it and the frame time again.
// - with --volume (lane V): the hangar of scripts/light-fixture/volumeWorld.js
//   instead, its shots and numbers into galaxy-engine/V/, a second shot at
//   the figure's edge inside a lit cone (<label>-<leg>-edge.png) and the
//   volumes drawn; `--volume off` is the same hangar without them, the
//   before to compare with; --weather and --view pick the hangar's weather
//   (lane V's fog with media) and its first view; --pan shoots the walk
//   toward the wall that covers the sun (<label>-<leg>-pan<t>.png at t 0,
//   0.5, 0.75, 1: the sun flare's occluder curve).
// The numbers go to <label>.json beside the shots and to stdout as a table.
//
// On Linux without a display both legs draw on SwiftShader (CPU): the
// shots are the check, the frame times are the CPU's and only compare one
// leg with the other. The owner's laptop gives the real table. In the
// cloud container the WebGPU device is lost even under a bare cube (Dawn:
// "A valid external Instance reference no longer exists";
// scripts/gpu-parity/README.md), so there the webgpu leg fails, says so
// and does not gate; the webgl leg gates.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const volumeAt = argv.indexOf('--volume');
const volume = volumeAt < 0 ? null : argv[volumeAt + 1] !== 'off';
const OUT = join(ROOT, 'docs/superpowers/evidence/galaxy-engine', volume == null ? 'R' : 'V');
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const tier = arg('tier', 'ultra');
const post = volume != null ? arg('post', 'on') === 'on' : arg('post', 'off') === 'on';
const label = arg('label', volume != null ? `${volume ? 'volume' : 'novolume'}-${tier}` : post ? `post-${tier}` : `lit-${tier}`);
const [W, H] = arg('size', '1600x900').split('x').map(Number);
const ms = Number(arg('ms', 5000));
const legs = arg('legs', 'webgpu,webgl').split(',');
const sky = arg('sky', 'on') === 'on';
const grid = argv.includes('--grid');
const only = arg('only', null)?.split(',');
const fixture = { tier, post, sky, env: true, only, ...(volume != null ? { volume, weather: arg('weather', 'interior'), view: arg('view', 'wide') } : {}) };

const { chromium } = await import('playwright-core');
const sharp = (await import('sharp')).default;
const exe = process.env.CHROMIUM ?? readdirSync('/opt/pw-browsers', { withFileTypes: true }).filter((d) => /^chromium-\d+$/.test(d.name)).map((d) => `/opt/pw-browsers/${d.name}/chrome-linux/chrome`).find(existsSync);
if (!exe) {
  console.error('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const swift = process.platform === 'linux' && !process.env.DISPLAY;
const args = [
  ...(process.platform === 'darwin' ? ['--use-angle=metal'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  '--enable-unsafe-webgpu',
  '--disable-blink-features=WebGPUExperimentalFeatures',
  '--enable-features=Vulkan',
  ...(swift ? ['--use-webgpu-adapter=swiftshader'] : []),
  '--ignore-gpu-blocklist',
  '--enable-webgl',
];

const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args });

const raw = async (png) => sharp(png).raw().toBuffer();
const meanDiff = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
};

mkdirSync(OUT, { recursive: true });
const rows = [];
for (const leg of legs) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.setDefaultTimeout(180000);
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 300)));
  const row = { leg, tier, post };
  try {
    await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&fixture=${encodeURIComponent(JSON.stringify(fixture))}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 240000 });
    const err = await page.evaluate(() => window.__lit.error);
    if (err) throw new Error(err);
    Object.assign(row, await page.evaluate(() => ({ backend: window.__lit.backend, clustered: window.__lit.probe.light?.clustered ?? null, passes: window.__lit.probe.passes })));
    const shot = async () => page.locator('canvas').screenshot();
    await page.evaluate(() => window.__lit.draw(60));
    const png = await shot();
    writeFileSync(join(OUT, `${label}-${leg}.png`), png);
    row.shot = `${label}-${leg}.png`;
    if (volume != null) {
      row.volumesLit = await page.evaluate(() => window.__lit.probe.lit());
      await page.evaluate(() => (window.__lit.probe.view('edge'), window.__lit.draw(8)));
      writeFileSync(join(OUT, `${label}-${leg}-edge.png`), await shot());
      if (argv.includes('--pan')) {
        for (const t of [0, 0.5, 0.75, 1]) {
          await page.evaluate((x) => (window.__lit.probe.pan(x), window.__lit.draw(6)), t);
          writeFileSync(join(OUT, `${label}-${leg}-pan${t}.png`), await shot());
        }
      }
      await page.evaluate((v) => (window.__lit.probe.view(v), window.__lit.draw(4)), fixture.view);
    }
    // A2: with and without the environment
    await page.evaluate(() => (window.__lit.probe.setEnv(false), window.__lit.draw(8)));
    const without = await raw(await shot());
    await page.evaluate(() => (window.__lit.probe.setEnv(true), window.__lit.draw(8)));
    const withEnv = await raw(await shot());
    row.envDiff = Number(meanDiff(withEnv, without).toFixed(2));
    // no recompile when a placed light moves
    row.programsBefore = await page.evaluate(() => window.__lit.probe.programs());
    await page.evaluate(async () => {
      for (let i = 0; i < 30; i++) {
        window.__lit.probe.nudge(i / 10);
        await window.__lit.draw(1);
      }
    });
    row.programsAfter = await page.evaluate(() => window.__lit.probe.programs());
    const intervals = await page.evaluate((t) => window.__lit.time(t), ms);
    row.frames = intervals.length;
    row.mean = Number((intervals.reduce((a, b) => a + b, 0) / Math.max(1, intervals.length)).toFixed(1));
    row.median = Number(pct(intervals, 0.5)?.toFixed(1));
    row.p95 = Number(pct(intervals, 0.95)?.toFixed(1));
    if (grid) {
      const bake = await page.evaluate(() => window.__lit.bakeGrid());
      row.gridBakeMs = Number(bake.total.toFixed(1));
      await page.evaluate(() => window.__lit.draw(4));
      writeFileSync(join(OUT, `${label}-${leg}-grid.png`), await shot());
      const after = await page.evaluate((t) => window.__lit.time(t), ms);
      row.gridMedian = Number(pct(after, 0.5)?.toFixed(1));
      row.gridMean = Number((after.reduce((a, b) => a + b, 0) / Math.max(1, after.length)).toFixed(1));
    }
  } catch (e) {
    row.error = String(e.message ?? e).split('\n')[0];
  }
  if (errors.length) row.errors = [...new Set(errors)].slice(0, 5);
  rows.push(row);
  await page.close();
}
await browser.close();
await server.close();

writeFileSync(join(OUT, `${label}.json`), `${JSON.stringify({ size: `${W}x${H}`, adapter: swift ? 'swiftshader' : 'system', rows }, null, 2)}\n`);
console.log(`| leg | backend | passes | clustered | env diff | programs before → after | mean ms | median ms | p95 ms | grid bake ms | mean with grid | volumes lit |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of rows) {
  if (r.error) console.log(`| ${r.leg} | failed: ${r.error} |`);
  else console.log(`| ${r.leg} | ${r.backend} | ${(r.passes ?? []).join(' ') || 'none'} | ${r.clustered} | ${r.envDiff} | ${r.programsBefore} → ${r.programsAfter} | ${r.mean} | ${r.median} | ${r.p95} | ${r.gridBakeMs ?? '–'} | ${r.gridMean ?? '–'} | ${r.volumesLit ?? '–'} |`);
  if (r.errors) console.log(`  errors: ${r.errors.join(' / ')}`);
}
process.exit(rows.some((r) => r.error && r.leg !== 'webgpu') ? 1 : 0);
