#!/usr/bin/env node
/* global window */
// The lit fixture on both of the node renderer's kinds, headless: lane R's
// proof (docs/superpowers/plans/2026-10-10-galaxy-engine-laneR-light.md).
//
//   node scripts/light-fixture.mjs [--tier ultra] [--post on|off] [--sky on|off]
//     [--grid] [--only render,ao,…] [--label name] [--size 1600x900] [--ms 5000] [--legs webgpu,webgl]
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
// Lane Q4 (docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ4-weathering.md)
// adds two shot sets, into docs/superpowers/evidence/bf2017-surfaces/Q4/,
// in place of the checks above:
//   --weather [--seconds 0,12.5,30]  the weathering crates under Hoth's snow
//     at each time into the weather (the record reaches its target at 25 s):
//     weather-<s>s-<leg>.png, the accumulation moved on a uniform, no rebuild
//   --decals  ten of Naboo's placed decals on the fixture's wall and floor:
//     decals-<leg>.png, the ground from above decals-floor-<leg>.png, and the grazing pair decals-grazing-{a,b}-<leg>.png,
//     the camera 3 mm higher in b (no flicker: the change the decals add
//     between the two, against the change without them, is in the json)
//
// On Linux without a display both legs draw on SwiftShader (CPU): the
// shots are the check, the frame times are the CPU's and only compare one
// leg with the other. The owner's laptop gives the real table. In the
// cloud container the WebGPU device is lost even under a bare cube (Dawn:
// "A valid external Instance reference no longer exists";
// scripts/gpu-parity/README.md), so there the webgpu leg fails, says so
// and does not gate; the webgl leg gates.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const OUT = join(ROOT, argv.includes('--weather') || argv.includes('--decals') ? 'docs/superpowers/evidence/bf2017-surfaces/Q4' : 'docs/superpowers/evidence/galaxy-engine/R');
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const tier = arg('tier', 'ultra');
const post = arg('post', 'off') === 'on';
const label = arg('label', argv.includes('--weather') ? 'weather' : argv.includes('--decals') ? 'decals' : post ? `post-${tier}` : `lit-${tier}`);
const [W, H] = arg('size', '1600x900').split('x').map(Number);
const ms = Number(arg('ms', 5000));
const legs = arg('legs', 'webgpu,webgl').split(',');
const sky = arg('sky', 'on') === 'on';
const grid = argv.includes('--grid');
const only = arg('only', null)?.split(',');
const weather = argv.includes('--weather');
const decals = argv.includes('--decals');
const seconds = arg('seconds', '0,12.5,30').split(',').map(Number);
const q4 = weather || decals;
// metres the camera rises between the grazing pair's two frames
const GRAZE_JITTER = 0.003;
const fixture = { tier, post, sky, env: true, only, ...(q4 ? { placed: false } : {}), ...(weather ? { weather: seconds[0] } : {}), ...(decals ? { decals: await decalPack() } : {}) };

// The --decals pack: the decal fixtures' records (ten of Naboo_01's
// projected, Endor_01's textured volume decal) read by
// scripts/lib/bf2017-decals.mjs, then laid on the fixture's wall (the
// blaster holes, facing the camera) and the ground before it (the streaks,
// each turned about its normal), the volume box over the wall's foot; each
// keeps its own size, the holes' cut to the wall's height. The textures
// come from lab/assets/bf2017/web/ (bf2017-fetch.mjs --raw <file>).
async function decalPack() {
  const { decalsOf } = await import('./lib/bf2017-decals.mjs');
  const read = (f) => JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/bf2017/decals', f), 'utf8'));
  const flat = (x) => Object.values(decalsOf(x).cells).flat();
  const [naboo, endor] = [read('naboo.extras.json'), read('endor.extras.json')];
  const recs = [...flat(naboo), ...flat(endor)];
  const files = { ...naboo.textureFiles, ...endor.textureFiles };
  const yawQ = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
  const qmul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
  // a projected box projects along its X (bf2017-decals.mjs's AXIS): on
  // the wall X → −Z (off its face), Y → −X, Z → up; on the ground X → up,
  // Y → Z, Z → X, then turned about the up
  const WALL = [-0.5, 0.5, 0.5, 0.5];
  const GROUND = [0.5, 0.5, 0.5, 0.5];
  const holes = recs.filter((d) => d.kind === 'projected' && /BlasterHole/.test(d.texture));
  const streaks = recs.filter((d) => d.kind === 'projected' && !/BlasterHole/.test(d.texture));
  // (the streaks' boxes are 5 to 13 m across on Naboo's floors: scaled to
  // 4.5 m at most so six fit before the wall, their shape kept)
  const fit = ([, y, z], most) => {
    const k = Math.min(1, most / Math.max(y, z));
    return [2, y * k, z * k];
  };
  const laid = [
    ...holes.map((d, i) => ({ ...d, position: [-4.2 + i * 2.8, 2.6, 25.8], quaternion: WALL, normal: [0, 0, -1], size: fit(d.size, 2.4) })),
    ...streaks.map((d, i) => ({ ...d, position: [-4.5 + (i % 3) * 4.5, 0, 23.4 - Math.floor(i / 3) * 3.6], quaternion: qmul(yawQ(i * 0.9), GROUND), normal: [0, 1, 0], size: fit(d.size, 4.5) })),
    ...recs.filter((d) => d.kind === 'volume').map((d) => ({ ...d, position: [5.6, 0, 24.6], quaternion: yawQ(0.3), size: [3.6, 2.5, 3.6] })),
  ];
  const cells = {};
  for (const d of laid) (cells[`${Math.floor(d.position[0] / 128)},${Math.floor(d.position[2] / 128)}`] ??= []).push(d);
  const textures = [...new Set(laid.map((d) => d.texture))];
  for (const t of textures) {
    if (!existsSync(join(ROOT, 'lab/assets/bf2017/web', files[t]))) {
      console.error(`no ${files[t]} under lab/assets/bf2017/web: NODE_USE_ENV_PROXY=1 node scripts/bf2017-fetch.mjs --raw ${files[t]}`);
      process.exit(2);
    }
  }
  const kinds = { projected: laid.filter((d) => d.kind === 'projected').length, volume: laid.filter((d) => d.kind === 'volume').length };
  return { format: 1, cell: 128, count: laid.length, kinds, textures, files: Object.fromEntries(textures.map((t) => [t, `lab/assets/bf2017/web/${files[t]}`])), cells };
}

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
    if (q4) {
      row.shots = [];
      const save = async (name) => {
        const png = await shot();
        writeFileSync(join(OUT, `${name}-${leg}.png`), png);
        row.shots.push(`${name}-${leg}.png`);
        return png;
      };
      if (weather) {
        await page.evaluate(() => window.__lit.probe.view('crate'));
        row.amounts = {};
        for (const s of seconds) {
          row.amounts[s] = await page.evaluate((t) => window.__lit.probe.setWeather(t), s);
          await page.evaluate(() => window.__lit.draw(8));
          await save(`weather-${s}s`);
          // (counted once the view has drawn: the rest move a uniform only)
          row.programsBefore ??= await page.evaluate(() => window.__lit.probe.programs());
        }
        row.programsAfter = await page.evaluate(() => window.__lit.probe.programs());
      }
      if (decals) {
        Object.assign(row, await page.evaluate(() => window.__lit.probe.decals()));
        await page.evaluate(() => (window.__lit.probe.view('decals'), window.__lit.draw(8)));
        await save('decals');
        await page.evaluate(() => (window.__lit.probe.view('floor'), window.__lit.draw(8)));
        await save('decals-floor');
        // Z-fighting (Review Focus 5): the grazing view and the same view with
        // the camera raised GRAZE_JITTER; the change between them with the
        // decals, less the change without them, is what the decals add: a
        // decal that fights its surface speckles there
        const graze = async (jitter, on, name) => {
          await page.evaluate(([j, o]) => (window.__lit.probe.view('grazing', j), window.__lit.probe.showDecals(o), window.__lit.draw(4)), [jitter, on]);
          return raw(name ? await save(name) : await shot());
        };
        const a = await graze(0, true, 'decals-grazing-a');
        const b = await graze(GRAZE_JITTER, true, 'decals-grazing-b');
        const a0 = await graze(0, false);
        const b0 = await graze(GRAZE_JITTER, false);
        let s = 0;
        for (let i = 0; i < a.length; i++) s += Math.abs(Math.abs(a[i] - b[i]) - Math.abs(a0[i] - b0[i]));
        row.grazingFlicker = Number((s / a.length).toFixed(3));
        row.grazingMove = Number(meanDiff(a0, b0).toFixed(3));
      }
    } else {
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
if (q4) {
  for (const r of rows) console.log(r.error ? `${r.leg}: failed: ${r.error}` : `${r.leg} (${r.backend}): ${r.shots.join(', ')}${r.amounts ? ` · accumulation ${JSON.stringify(r.amounts)} · programs ${r.programsBefore} → ${r.programsAfter}` : ''}${r.draws != null ? ` · decals ${r.count} in ${r.draws} draws (${r.textures} textures) · grazing: the scene moves ${r.grazingMove} between the pair, the decals add ${r.grazingFlicker}` : ''}`);
  for (const r of rows) if (r.errors) console.log(`  ${r.leg} errors: ${r.errors.join(' / ')}`);
  process.exit(rows.some((r) => r.error && r.leg !== 'webgpu') ? 1 : 0);
}
console.log(`| leg | backend | passes | clustered | env diff | programs before → after | mean ms | median ms | p95 ms | grid bake ms | mean with grid |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const r of rows) {
  if (r.error) console.log(`| ${r.leg} | failed: ${r.error} |`);
  else console.log(`| ${r.leg} | ${r.backend} | ${(r.passes ?? []).join(' ') || 'none'} | ${r.clustered} | ${r.envDiff} | ${r.programsBefore} → ${r.programsAfter} | ${r.mean} | ${r.median} | ${r.p95} | ${r.gridBakeMs ?? '–'} | ${r.gridMean ?? '–'} |`);
  if (r.errors) console.log(`  errors: ${r.errors.join(' / ')}`);
}
process.exit(rows.some((r) => r.error && r.leg !== 'webgpu') ? 1 : 0);
