#!/usr/bin/env node
/* global window */
// The lit fixture on both of the node renderer's kinds, headless: lane R's
// proof (docs/superpowers/plans/2026-10-10-galaxy-engine-laneR-light.md).
//
//   node scripts/light-fixture.mjs [--tier ultra] [--post on|off] [--sky on|off]
//     [--grid] [--only render,ao,…] [--label name] [--size 1600x900] [--ms 5000] [--legs webgpu,webgl]
//   node scripts/light-fixture.mjs --materials [--legs webgl]
//
// --materials (lane Q1, docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ1-materials.md):
// the seven fixture rows' recipes (the five families, hair and a head) (scripts/fixtures/bf2017/materials/), each
// on a cube over its mesh's own GLB material, and a wall under the first,
// their maps fetched from the bucket by name into lab/assets/bf2017/ (the
// keys from the environment; NODE_USE_ENV_PROXY=1 in a cloud session). Shot
// at the GLB's own material and at each tier into
// docs/superpowers/evidence/bf2017-surfaces/Q1/fixture-<tier>-<leg>.png and
// wall-<tier>-<leg>.png; the low tier against the GLB's (the design's
// "low equals the GLB": mean and largest difference, 0…255) and each cube's
// features into materials-<leg>.json.
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
const OUT = join(ROOT, 'docs/superpowers/evidence/galaxy-engine/R');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const tier = arg('tier', 'ultra');
const post = arg('post', 'off') === 'on';
const label = arg('label', post ? `post-${tier}` : `lit-${tier}`);
const [W, H] = arg('size', '1600x900').split('x').map(Number);
const ms = Number(arg('ms', 5000));
const legs = arg('legs', 'webgpu,webgl').split(',');
const sky = arg('sky', 'on') === 'on';
const grid = argv.includes('--grid');
const only = arg('only', null)?.split(',');
const fixture = { tier, post, sky, env: true, only };

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

if (argv.includes('--materials')) {
  const code = await materialsRun();
  await browser.close();
  await server.close();
  process.exit(code);
}

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
console.log(`| leg | backend | passes | clustered | env diff | programs before → after | mean ms | median ms | p95 ms | grid bake ms | mean with grid |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of rows) {
  if (r.error) console.log(`| ${r.leg} | failed: ${r.error} |`);
  else console.log(`| ${r.leg} | ${r.backend} | ${(r.passes ?? []).join(' ') || 'none'} | ${r.clustered} | ${r.envDiff} | ${r.programsBefore} → ${r.programsAfter} | ${r.mean} | ${r.median} | ${r.p95} | ${r.gridBakeMs ?? '–'} | ${r.gridMean ?? '–'} |`);
  if (r.errors) console.log(`  errors: ${r.errors.join(' / ')}`);
}
process.exit(rows.some((r) => r.error && r.leg !== 'webgpu') ? 1 : 0);

// ---- --materials (lane Q1)

async function materialList() {
  const { readFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const { candidatesOf, recipeOf } = await import('./lib/bf2017-recipes.mjs');
  const { MAP_KINDS } = await import('../src/lib/three/surface/families.js');
  const { keys, getObject } = await import('./bf2017-fetch.mjs');
  const env = keys();
  const cache = join(ROOT, 'lab/assets/bf2017');
  const list = [];
  // (each row's material shown: the head's is its second, the face; the first is its eyes)
  for (const [label, index] of [
    ['props', 0],
    ['vehicle', 0],
    ['character', 0],
    ['vegetation', 0],
    ['emissive', 0],
    ['hair', 0],
    ['head', 1],
  ]) {
    const row = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/bf2017/materials', `${label}.jsonl`), 'utf8').trim());
    const recipe = recipeOf(row, index);
    const glbFile = join(cache, 'web/models', `${row.mesh}.glb`);
    if (!existsSync(glbFile)) spawnSync(process.execPath, [join(ROOT, 'scripts/bf2017-fetch.mjs'), row.mesh, '--lod', '0'], { stdio: 'inherit', env: process.env });
    const maps = {};
    const flat = { ...recipe.maps, breakupColor: recipe.maps.breakup?.color, breakupNormal: recipe.maps.breakup?.normal };
    for (const [key, name] of Object.entries(flat)) {
      if (typeof name !== 'string' || !MAP_KINDS[key]) continue;
      const into = key === 'detailArray' ? 'detail' : key;
      maps[into] = null;
      for (const c of candidatesOf(name, MAP_KINDS[key])) {
        const got = await getObject(env, cache, `web/${c}`);
        if (got.state === 'fetched' || got.state === 'kept') {
          maps[into] = `/lab/assets/bf2017/web/${c}`;
          break;
        }
      }
      if (!maps[into]) console.log(`missing: ${label} ${key} ${name}`);
    }
    // (the URL carries the recipe: its sources stay behind)
    const lean = { ...recipe, _source: undefined };
    list.push({ label, recipe: lean, glb: existsSync(glbFile) ? `/lab/assets/bf2017/web/models/${row.mesh}.glb` : null, maps });
  }
  return list;
}

async function materialsRun() {
  const out = join(ROOT, 'docs/superpowers/evidence/bf2017-surfaces/Q1');
  mkdirSync(out, { recursive: true });
  const list = await materialList();
  const configs = [
    ['glb', 'low'],
    ['game', 'low'],
    ['game', 'mid'],
    ['game', 'high'],
    ['game', 'ultra'],
  ];
  let failed = false;
  for (const leg of legs) {
    const result = { leg, adapter: swift ? 'swiftshader' : 'system', shots: {}, features: null, lowVsGlb: {}, errors: [] };
    const raws = {};
    for (const [mode, t] of configs) {
      const name = mode === 'glb' ? 'glb' : t;
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      page.setDefaultTimeout(240000);
      page.on('pageerror', (e) => result.errors.push(e.message.split('\n')[0]));
      try {
        const f = { tier: t, post: false, sky: true, env: true, materials: { mode, list } };
        await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&fixture=${encodeURIComponent(JSON.stringify(f))}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
        await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 300000 });
        const err = await page.evaluate(() => window.__lit.error);
        if (err) throw new Error(err);
        if (name === 'ultra') result.features = await page.evaluate(() => window.__lit.probe.recipes());
        for (const view of ['row', 'wall']) {
          await page.evaluate((v) => (window.__lit.probe.view(v), window.__lit.draw(60)), view);
          const png = await page.locator('canvas').screenshot();
          const file = `${view === 'row' ? 'fixture' : 'wall'}-${name}-${leg}.png`;
          writeFileSync(join(out, file), png);
          result.shots[`${view}-${name}`] = file;
          raws[`${view}-${name}`] = await raw(png);
        }
      } catch (e) {
        result.errors.push(`${name}: ${String(e.message ?? e).split('\n')[0]}`);
        if (leg !== 'webgpu') failed = true;
      }
      await page.close();
    }
    for (const view of ['row', 'wall']) {
      const a = raws[`${view}-glb`];
      const b = raws[`${view}-low`];
      if (!a || !b) continue;
      let max = 0;
      let over = 0;
      for (let i = 0; i < a.length; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d > max) max = d;
        if (d > 1) over++;
      }
      result.lowVsGlb[view] = { mean: Number(meanDiff(a, b).toFixed(3)), max, overOne: over };
    }
    writeFileSync(join(out, `materials-${leg}.json`), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${leg}: low vs the GLB ${JSON.stringify(result.lowVsGlb)}; ${Object.keys(result.shots).length} shots${result.errors.length ? `; errors: ${[...new Set(result.errors)].slice(0, 4).join(' / ')}` : ''}`);
    for (const c of result.features ?? []) console.log(`  ${c.label.padEnd(11)} ${c.features.join(', ') || '(none)'}`);
  }
  return failed ? 1 : 0;
}
