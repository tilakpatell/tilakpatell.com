#!/usr/bin/env node
/* global window, document, getComputedStyle, requestAnimationFrame */
// The Battlefront world in headless Chromium, through its dev door
// (window.__battlefront: src/components/battlefront/module.js), on one or
// both of the node renderer's kinds:
//
//   node scripts/battlefront-check.mjs [--gpu webgl|webgpu|both] [--out dir] [--size 1280x720] [--wait 900000] [--ms 10000] [--quality low|mid|high|ultra]
//   node scripts/battlefront-check.mjs --screens [--gpu webgl] [--out docs/superpowers/evidence/bf2017-screens] …
//
// --screens walks the game's own screens instead (the sixth design's lane
// screens): /battlefront → Start → the main menu → Play → Multiplayer → the
// multiplayer modes → Galactic Assault's levels → the Hoth card → the
// loading screen → the spawn screen → deploy → the HUD → Escape → the
// in-game menu → Resume → do('die') → the kill screen → do('win') → the end
// of round, a shot of each; three screens' boxes read from the DOM against
// the resolver's (src/lib/bf2017/ui/screens.js) within 1 px; no console error.
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
const gpu = arg('gpu', argv.includes('--screens') ? 'webgl' : 'both');
const legs = gpu === 'both' ? ['webgl', 'webgpu'] : [gpu];
const OUT = join(ROOT, arg('out', argv.includes('--screens') ? 'docs/superpowers/evidence/bf2017-screens' : 'docs/superpowers/evidence/battlefront-lane5'));
const [W, H] = arg('size', '1280x720').split('x').map(Number);
const WAIT = Number(arg('wait', process.env.PHASE_WAIT ?? 900000));
const MS = Number(arg('ms', 10000));
const QUALITY = arg('quality', null); // a tier forced through tp-quality (low on a software GL), else the device's
const ROUTE = '/battlefront/hoth/galacticAssault';
const SCREENS = argv.includes('--screens');
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
  // (GPU-first lane N2: the frame times' spread, and the dynamic-resolution
  // controller's source and the internal scales it reached, quality.js)
  out.frame = await page.evaluate((ms) => new Promise((done) => {
    const dts = [];
    const q = window.__RUNTIME__?.quality;
    const scales = [];
    let last = performance.now();
    const end = last + ms;
    const tick = (t) => {
      dts.push(t - last);
      last = t;
      if (q?.internal != null) scales.push(q.internal);
      if (t < end) requestAnimationFrame(tick);
      else {
        const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
        const stdev = Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / dts.length);
        dts.sort((a, b) => a - b);
        const controller = q ? { source: q.source ?? null, scale: scales.length ? [Math.min(...scales), Math.max(...scales)] : null } : null;
        done({ frames: dts.length, mean: +mean.toFixed(1), median: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), stdev: +stdev.toFixed(2), controller });
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

// ── the screens' walk ────────────────────────────────────────────────────

// Every drawn box of a screen in the page against the resolver's at the same
// size: the worst difference in pixels, over the boxes both have.
async function measure(page, name) {
  const { screen } = await server.ssrLoadModule('/src/lib/bf2017/ui/screens.js');
  const tree = screen(name, { viewport: { width: W, height: H } });
  const want = new Map();
  const walk = (bs) => bs.forEach((b) => (want.has(b.id) || want.set(b.id, b), walk(b.children ?? [])));
  walk(tree.boxes);
  const got = await page.evaluate((full) => {
    const root = document.querySelector(`[data-screen="${full}"]`);
    return [...(root?.querySelectorAll('[data-id]') ?? [])].map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.id, x: r.x, y: r.y, w: r.width, h: r.height, shown: r.width > 0 && getComputedStyle(el).display !== 'none' };
    });
  }, tree.name);
  let worst = 0;
  let compared = 0;
  for (const g of got) {
    const b = want.get(g.id);
    if (!b || !g.shown) continue;
    compared++;
    worst = Math.max(worst, Math.abs(g.x - b.x), Math.abs(g.y - b.y), Math.abs(g.w - b.w), Math.abs(g.h - b.h));
  }
  return { screen: tree.name, compared, worst: +worst.toFixed(2), within: worst <= 1 };
}

async function walkScreens(kind) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
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
  const out = { leg: kind, walk: 'screens', quality: QUALITY ?? 'device', errors, shots: {}, boxes: [], steps: [] };
  const shoot = async (name) => {
    const file = join(OUT, `${name}.png`);
    await page.screenshot({ path: file, timeout: WAIT });
    out.shots[name] = file.slice(ROOT.length + 1);
  };
  const at = async (name, sel, timeout = 60000) => {
    await page.waitForSelector(sel, { timeout, state: 'visible' });
    await page.waitForTimeout(400);
    out.steps.push(name);
    await shoot(name);
  };
  // (the world's modules once first: the dev server finds three's node
  // build late and re-bundles it, which breaks an import already under way)
  await page.goto(`${base}/#${ROUTE}?gpu=${kind}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  await page.waitForFunction(() => Boolean(window.__battlefront), null, { timeout: WAIT, polling: 1000 }).catch(() => {});
  errors.length = 0;
  // (the post chain off: the walk is the screens', and software GL draws the field in tens of seconds a frame with it)
  await page.goto(`${base}/#/battlefront?gpu=${kind}&post=off`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: WAIT });
  await at('start', '.bf-start .bf-start-press');
  await page.keyboard.press('Enter');
  await at('main-menu', '[data-screen$="/MainMenuScreen"]');
  out.boxes.push(await measure(page, 'MainMenuScreen'));
  await page.click('[data-link$="/PlayScreen"]');
  await at('play', '[data-tile="Multiplayer"]');
  out.boxes.push(await measure(page, 'PlayScreen'));
  await page.click('[data-tile="Multiplayer"]');
  await at('multiplayer-category', '[data-tile="Assault Cat"]');
  await page.click('[data-tile="Assault Cat"]');
  await at('multiplayer', '[data-mode="PlanetaryBattles"]');
  out.boxes.push(await measure(page, 'PlayMultiplayerScreen'));
  await page.click('[data-mode="PlanetaryBattles"]');
  await at('levels', '[data-level="hoth"]');
  await page.click('[data-level="hoth"]');
  await at('loading', '[data-game-screen$="/LoadingScreenWrapperWidget"]', WAIT);
  for (const until = Date.now() + WAIT; ; ) {
    const failed = errors.find((e) => /3D failed|device.*lost/i.test(e));
    if (failed) throw new Error(failed.split('\n')[0]);
    if (await page.evaluate(() => Boolean(window.__battlefront?.view?.().level?.loaded))) break;
    if (Date.now() > until) throw new Error('the world never came up');
    await page.waitForTimeout(1000);
  }
  await frames(page, 4);
  await at('spawn', '[data-screen$="/SpawnOverlayScreen"]', WAIT);
  out.deploy = await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  out.advance = await page.evaluate(() => window.__battlefront.do('advance', 5));
  // (in the battle each screen waits on a drawn frame; in software GL the
  // field after deploying may draw none for many minutes, so there the rest
  // of the walk is recorded, not gated)
  try {
    await screensInWorld(page, at, swift ? Math.min(WAIT, 300000) : WAIT);
  } catch (e) {
    if (!swift) throw e;
    out.inWorld = `not reached in software GL: ${String(e).split('\n')[0]}`;
  }
  await ctx.close();
  return out;
}

// the battle's screens: the HUD's crosshair, the pause menu, the kill
// screen, the end of round
async function screensInWorld(page, at, wait) {
  await at('hud', '.bf-hud .hud-reticle-shape', wait, 'attached');
  await page.keyboard.press('Escape');
  await at('ingame-menu', '[data-screen$="/IngameMenuMPScreen"]', wait);
  await page.click('[data-item="RESUME"]');
  await page.waitForSelector('[data-screen$="/IngameMenuMPScreen"]', { state: 'detached', timeout: wait });
  await page.evaluate(() => window.__battlefront.do('die'));
  await at('kill-screen', '.bf-kill-screen', wait);
  await page.evaluate(() => window.__battlefront.do('win'));
  await at('end-of-round', '.bf-eor [data-step="outcome"]', wait);
}

const results = [];
if (SCREENS) {
  for (const kind of legs) {
    try {
      results.push(await walkScreens(kind));
    } catch (e) {
      results.push({ leg: kind, walk: 'screens', failed: String(e).split('\n')[0], gates: true });
    }
  }
}
for (const kind of SCREENS ? [] : legs) {
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
writeFileSync(join(OUT, 'check.json'), `${JSON.stringify({ route: SCREENS ? '/battlefront' : ROUTE, size: [W, H], swiftshader: swift, results }, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

await browser.close();
await server.close();
const bad = results.some((r) => (r.failed && r.gates) || r.errors?.length || r.boxes?.some((b) => !b.within));
process.exit(bad ? 1 : 0);
