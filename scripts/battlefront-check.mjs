#!/usr/bin/env node
/* global window, requestAnimationFrame */
// The Battlefront world in headless Chromium, through its dev door
// (window.__battlefront: src/components/battlefront/module.js), on one or
// both of the node renderer's kinds:
//
//   node scripts/battlefront-check.mjs [--gpu webgl|webgpu|both] [--out dir] [--size 1280x720] [--wait 900000] [--ms 10000] [--quality low|mid|high|ultra]
//
// Each leg opens /battlefront/hoth/galacticAssault?gpu=<leg> on a Vite dev
// server, waits for the level's far list (the map whole), then shoots the
// deploy screen over the overview camera, deploys an assault trooper,
// advances the battle 30 s without drawing, shoots the field and the HUD,
// records the frame time over --ms, forces a win and shoots the end card.
// With both legs, the field shots are diffed: the share of pixels that
// differ by more than 24 of 255 on any channel (the design's 2 per cent
// bound for the same scene on both kinds).
//
// It fails on a console error. The frame time is recorded, not gated: on
// Linux without a display both legs draw on SwiftShader (the CPU), and in
// the cloud container SwiftShader's WebGPU device is lost on its first
// frame (scripts/gpu-parity/README.md), so the webgpu leg there says so
// and does not gate. The owner's desktop gives the real numbers.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const gpu = arg('gpu', 'both');
const legs = gpu === 'both' ? ['webgl', 'webgpu'] : [gpu];
const OUT = join(ROOT, arg('out', 'docs/superpowers/evidence/battlefront-lane5'));
const [W, H] = arg('size', '1280x720').split('x').map(Number);
const WAIT = Number(arg('wait', process.env.PHASE_WAIT ?? 900000));
const MS = Number(arg('ms', 10000));
const QUALITY = arg('quality', null); // a tier forced through tp-quality (low on a software GL), else the device's
const ROUTE = '/battlefront/hoth/galacticAssault';
mkdirSync(OUT, { recursive: true });

const { chromium } = await import('playwright-core');
const sharp = (await import('sharp')).default;
const exe = process.env.CHROMIUM ?? readdirSync('/opt/pw-browsers', { withFileTypes: true }).filter((d) => /^chromium-\d+$/.test(d.name)).map((d) => `/opt/pw-browsers/${d.name}/chrome-linux/chrome`).find(existsSync);
if (!exe) {
  console.error('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const swift = process.platform === 'linux' && !process.env.DISPLAY;
const args = [
  ...(process.platform === 'darwin' ? ['--use-angle=metal'] : swift ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
  '--enable-unsafe-webgpu',
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

const frames = (page, n) => page.evaluate((k) => new Promise((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

async function leg(kind) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  // (past the front door's first-visit asks, as galaxy-check does)
  await ctx.addInitScript((q) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    if (q) window.localStorage.setItem('tp-quality', q);
  }, QUALITY);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const out = { leg: kind, quality: QUALITY ?? 'device', errors, shots: {} };
  const t0 = Date.now();
  await page.goto(`${base}/#${ROUTE}?gpu=${kind}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  // (the world up, or the runtime saying its 3D failed: a lost WebGPU
  // device on SwiftShader ends the leg at once rather than at the wait)
  for (const until = Date.now() + WAIT; ; ) {
    const failed = errors.find((e) => /3D failed|device.*lost/i.test(e));
    if (failed) throw new Error(failed.split('\n')[0]);
    if (await page.evaluate(() => Boolean(window.__battlefront?.view))) break;
    if (Date.now() > until) throw new Error('the world never came up');
    await page.waitForTimeout(1000);
  }
  out.backend = await page.evaluate(() => window.__battlefront.do('gpu'));
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  out.loadedMs = Date.now() - t0;
  await frames(page, 30);
  const shoot = async (name) => {
    const file = join(OUT, `${name}-${kind}.png`);
    await page.screenshot({ path: file, timeout: WAIT });
    out.shots[name] = file.slice(ROOT.length + 1);
    return file;
  };
  await shoot('deploy');
  out.deploy = await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  out.advance = await page.evaluate(() => window.__battlefront.do('advance', 30));
  // (the cells round the player come in: wait for the stream again)
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  await frames(page, 60);
  const field = await shoot('field');
  out.view = await page.evaluate(() => {
    const v = window.__battlefront.view();
    return { player: v.player, stage: v.mode?.stageName, level: v.level, weather: v.weather };
  });
  out.frame = await page.evaluate((ms) => new Promise((done) => {
    const dts = [];
    let last = performance.now();
    const end = last + ms;
    const tick = (t) => {
      dts.push(t - last);
      last = t;
      if (t < end) requestAnimationFrame(tick);
      else {
        dts.sort((a, b) => a - b);
        const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
        done({ frames: dts.length, mean: +mean.toFixed(1), median: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1) });
      }
    };
    requestAnimationFrame(tick);
  }), MS);
  await page.evaluate(() => window.__battlefront.do('win'));
  await frames(page, 10);
  await page.waitForTimeout(500);
  await shoot('end');
  await ctx.close();
  return { ...out, field };
}

const results = [];
for (const kind of legs) {
  try {
    results.push(await leg(kind));
  } catch (e) {
    results.push({ leg: kind, failed: String(e).split('\n')[0], gates: kind !== 'webgpu' || !swift });
  }
}

const done = results.filter((r) => r.field);
if (done.length === 2) {
  const [a, b] = await Promise.all(done.map((r) => sharp(r.field).raw().toBuffer({ resolveWithObject: true })));
  let differ = 0;
  const px = a.info.width * a.info.height;
  for (let i = 0; i < px; i++) {
    const k = i * a.info.channels;
    if (Math.abs(a.data[k] - b.data[k]) > 24 || Math.abs(a.data[k + 1] - b.data[k + 1]) > 24 || Math.abs(a.data[k + 2] - b.data[k + 2]) > 24) differ++;
  }
  results.push({ diff: { share: +(differ / px).toFixed(4), bound: 0.02 } });
}
for (const r of results) delete r.field;
writeFileSync(join(OUT, 'check.json'), `${JSON.stringify({ route: ROUTE, size: [W, H], swiftshader: swift, results }, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

await browser.close();
await server.close();
const bad = results.some((r) => (r.failed && r.gates) || r.errors?.length);
process.exit(bad ? 1 : 0);
