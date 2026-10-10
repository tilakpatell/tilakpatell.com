/* global window */
// Does a world draw the same picture on its new materials? A route shot in
// headless Chromium on main (or any ref) and on the branch's two node
// backends, each diffed against main's, view by view, and judged by the
// spec's bar (docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md):
// PSNR ≥ 32 dB and under 2 % of pixels off by more than 16/255.
//
//   node scripts/gpu-parity.mjs <route> --before [ref]        (main's pictures, from a worktree at ref; default origin/main)
//   node scripts/gpu-parity.mjs <route> [--view a,b] [--quality high] [--settle 8000]
//     [--adapter auto|swiftshader|system] [--chromium /path/to/chrome]
//
// Each leg runs the route on Vite's dev server (the dev hooks are the
// point: window.__RUNTIME__, and a ported world's `view(name)`), at a page
// clock pinned to 2026-10-08T12:00:00Z and stopped, so a sun or a tide is
// where it was, with ?quality=<q>&calibrate=off. The page's time moves
// only in frames let run: one at a time until the world is on, then 120
// with real time between them; then each view is asked for
// (window.__RUNTIME__.current.world.view(name)), 100 ms of frames run, and
// the page is shot at 1280 × 800.
// With no --view, the one view is the world as it opens ('open').
//
// The branch legs are `webgl` (?gpu=webgl: 'nodes-webgl' for a 'nodes'
// module, the classic renderer for a 'glsl' one) and `webgpu` (?gpu=webgpu).
// The webgpu leg is marked skipped when the page had no WebGPU device
// (three's renderer fell back to WebGL 2) or the module is 'glsl'; the
// webgl leg gates. Pictures and report.json go to
// scripts/gpu-parity/out/<route>/ (gitignored). Exit codes: 0 pass, 1 a
// webgl row failed, 2 could not run (no browser, no before pictures).
//
// --adapter: 'swiftshader' asks Chromium for its software WebGPU adapter
// (what a cloud container has: it has no GPU); 'system' leaves the choice to
// Chromium (a desktop's own chip); 'auto' is swiftshader on Linux without a
// display, system elsewhere.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diff, passes } from './gpu-parity/diff.mjs';
import { NOISE } from './lib/noise.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLOCK = new Date('2026-10-08T12:00:00Z');
const VIEWPORT = { width: 1280, height: 800 };
const FRAMES = 120; // run on every leg once the world is on: two seconds of its time
const SYNC = 60000; // ms of the page's time every leg is moved on to before its views are shot

const argv = process.argv.slice(2);
const route = argv.find((a, i) => a.startsWith('/') && !(argv[i - 1] ?? '').startsWith('--'));
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  args[argv[i].slice(2)] = next === undefined || next.startsWith('--') || next.startsWith('/') ? true : argv[++i];
}
if (!route) {
  console.log('usage: node scripts/gpu-parity.mjs <route> [--before [ref]] [--view a,b] [--quality high] [--settle 8000] [--adapter auto|swiftshader|system]');
  process.exit(2);
}
const views = typeof args.view === 'string' ? args.view.split(',').map((s) => s.trim()).filter(Boolean) : ['open'];
const quality = ['high', 'mid', 'low'].includes(args.quality) ? args.quality : 'high';
const settle = Number(args.settle) || 8000;
const before = args.before ? (args.before === true ? 'origin/main' : args.before) : null;
const { adapterFor, angleFor, findChromium, launchArgs: chromiumArgs } = await import('./lib/chromium.mjs');
const adapter = adapterFor({ adapter: args.adapter });
const slug = route.replace(/^\/+/, '').replace(/[^a-z0-9]+/gi, '-') || 'home';
const OUT = join(ROOT, 'scripts/gpu-parity/out', slug);
mkdirSync(OUT, { recursive: true });

const say = (s) => console.log(s);
const stop = (code, why) => {
  if (why) say(why);
  process.exit(code);
};

// ── the browser ──
const { chromium } = await import('playwright-core');
const sharp = (await import('sharp')).default;
const exe = args.chromium ?? findChromium();
if (!exe) stop(2, 'no Chromium (set CHROMIUM=/path/to/chrome)');
// (WebGL on the machine's own chip where there is one, as the fixture and
// the perf probe draw; WebGPU on the adapter asked for; scripts/lib/chromium.mjs)
const launchArgs = [...chromiumArgs({ angle: angleFor(), webgpu: true, adapter }), '--js-flags=--max-old-space-size=4096'];

// ── a dev server on a checkout ──
// (a worktree's node_modules is a link to this checkout's: its fonts are let through)
async function serve(root, cacheDir) {
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: join(root, 'vite.config.js'), cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, join(ROOT, 'node_modules')] } }, logLevel: 'error' });
  await server.listen();
  const { port } = server.httpServer.address();
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

// ── one leg: the route opened, each view shot ──
async function shoot(browser, base, leg) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    const set = (k, v) => window.localStorage.setItem(k, v);
    set('tp-intro', '1');
    set('tp-start', '"universe"');
    set('tp-sound', 'off');
    set('tp-worlds', JSON.stringify('load'));
    set('tp-tour', 'skipped');
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.__tpKeepFrames = true; // (the classic renderer's last frame kept readable)
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page error: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => m.type() === 'error' && !NOISE.some((n) => n.test(m.text())) && errors.push(`console: ${m.text().slice(0, 200)}`));
  // The page's clock is stopped from its first script: time in it moves
  // only in the 16 ms frames let run here, so a world that moves on its
  // own (a plane flying, a sun turning) is in the same place on every leg
  // however long the loading took in real time.
  await page.clock.install({ time: CLOCK });
  await page.clock.pauseAt(new Date(CLOCK.getTime() + 1000));
  const frames = async (ms) => {
    for (let t = 0; t < ms; t += 16) await page.clock.runFor(16);
  };
  const query = `?quality=${quality}&calibrate=off&gpu=${leg === 'webgpu' ? 'webgpu' : 'webgl'}`;
  await page.goto(`${base}/${query}#${route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const started = Date.now();
  let gated = false;
  // (one frame at a time until the world is on, so it's on at the same
  // moment of the page's time, to a frame)
  for (;;) {
    const on = await page.evaluate(() => window.__RUNTIME__?.status === 'on' && Boolean(window.__RUNTIME__.current?.world));
    if (on) break;
    if (Date.now() - started > 240000) throw new Error(`${leg}: the world never came on`);
    // (a world behind a gate with a way through for everyone: Minecraft's password, past to the tribute)
    if (!gated) gated = await page.getByRole('button', { name: /Walk the tribute/ }).click({ timeout: 200 }).then(() => true, () => false);
    await page.clock.runFor(16);
    await page.waitForTimeout(25);
  }
  // What it loads after it's on (pictures, tiles) comes in real time, with
  // the clock stopped. Then the same number of frames on every leg, each
  // with real time behind it (a shader links on the chip's time, not the
  // page's), so a world that moves on its own (Earth's clouds drift) has
  // moved as far on each. Should the frame guard still be holding
  // something back after them (window.__tpGuardPending, development's),
  // more frames run till it isn't, and the leg says how many: its 'open'
  // picture may then have moved on from the other legs'.
  await page.waitForTimeout(settle);
  const held = () => page.evaluate(() => window.__tpGuardPending?.() ?? 0);
  for (let n = 0; n < FRAMES; n++) {
    await page.clock.runFor(16);
    await page.waitForTimeout(50);
  }
  let extra = 0;
  while ((await held()) && extra < 600) {
    await page.clock.runFor(16);
    await page.waitForTimeout(50);
    extra++;
  }
  if (extra) say(`  note: ${leg}: ${extra} frames more than the ${FRAMES} before nothing was held back`);
  // The frames it took to come on were as many as the loading took, so
  // the page's time (performance.now, which a world's drift reads: Earth's
  // clouds) is now wherever that left it. It's moved on to the same moment
  // on every leg, and then the frames that are shot run from there.
  const at = await page.evaluate(() => performance.now());
  if (at < SYNC) await page.clock.fastForward(Math.ceil(SYNC - at));
  else say(`  note: ${leg}: the page's time was ${Math.round(at)} ms, past the ${SYNC} it's put at; its picture may have moved on`);
  await page.clock.setSystemTime(new Date(CLOCK.getTime() + SYNC));
  for (let n = 0; n < 4; n++) {
    await page.clock.runFor(16);
    await page.waitForTimeout(50);
  }
  if (process.env.PARITY_DEBUG) say(`  page time ${Math.round(at)} → ${await page.evaluate(() => `${Math.round(performance.now())} ms, ${new Date().toISOString()}`)}`);
  const info = await page.evaluate(async () => {
    const rt = window.__RUNTIME__;
    const adapterFound = navigator.gpu ? Boolean(await navigator.gpu.requestAdapter().catch(() => null)) : false;
    return { extra: 0, backend: rt.gfx?.backend ?? null, onWebGPU: Boolean(rt.gfx?.renderer?.backend?.isWebGPUBackend), shading: rt.current?.module?.shading ?? 'glsl', adapter: adapterFound };
  });
  info.extra = extra;
  const shots = {};
  for (const view of views) {
    if (view !== 'open') {
      const asked = await page.evaluate((v) => {
        const w = window.__RUNTIME__.current?.world;
        if (typeof w?.view !== 'function') return false;
        return Promise.resolve(w.view(v)).then(() => true);
      }, view);
      if (!asked) {
        say(`  note: ${leg}: the world has no view('${view}') hook; skipped`);
        continue;
      }
      // A world that streams what it shows (Minecraft's chunks, made in
      // workers) says when it's all in (`settled()`, development's): frames,
      // each with real time behind it, till it has been for ten in a row. The
      // view holds the world still, so how many it took doesn't show.
      const settles = await page.evaluate(() => typeof window.__RUNTIME__.current?.world?.settled === 'function');
      if (settles) {
        let calm = 0;
        let n = 0;
        for (; calm < 10 && n < 1500; n++) {
          await page.clock.runFor(16);
          await page.waitForTimeout(60);
          calm = (await page.evaluate(() => window.__RUNTIME__.current.world.settled())) ? calm + 1 : 0;
        }
        if (calm < 10) say(`  note: ${leg}: '${view}' never settled in ${n} frames; its picture may be part-loaded`);
      }
    }
    await frames(100);
    // (the frames drawn in that 100 ms reach the screen on the compositor's
    // next frame, in real time: the page's own rAF is the stopped clock's)
    await page.waitForTimeout(300);
    const file = join(OUT, `${view}-${leg}.png`);
    await page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide', timeout: 120000 });
    shots[view] = file;
  }
  await ctx.close();
  return { info, shots, errors: [...new Set(errors)] };
}

const raw = async (file) => {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
};
const fmt = (n, d = 1) => (n === Infinity ? '∞' : n.toFixed(d));

const reportFile = join(OUT, 'report.json');
const report = existsSync(reportFile) ? JSON.parse(readFileSync(reportFile, 'utf8')) : {};
report.route = route;
report.clock = CLOCK.toISOString();
report.quality = quality;
report.adapterFlag = adapter;

const browser = await chromium.launch({ executablePath: exe, args: launchArgs });
try {
  if (before) {
    // main's pictures, from a worktree of it with this checkout's packages
    const wt = mkdtempSync(join(tmpdir(), 'gpu-parity-'));
    rmSync(wt, { recursive: true, force: true });
    // (long paths on: a fixture under scripts/fixtures/bf2017 is past Windows's 260)
    execFileSync('git', ['-c', 'core.longpaths=true', 'worktree', 'add', '--detach', wt, before], { cwd: ROOT, stdio: 'ignore' });
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: wt }).toString().trim();
    symlinkSync(join(ROOT, 'node_modules'), join(wt, 'node_modules'), 'junction');
    let server = null;
    try {
      server = await serve(wt, join(tmpdir(), `gpu-parity-vite-${sha}`));
      say(`before: ${before} (${sha})`);
      const leg = await shoot(browser, server.base, 'before');
      say(`  backend ${leg.info.backend}, ${Object.keys(leg.shots).length} view(s)${leg.errors.length ? `, errors: ${leg.errors.join('; ')}` : ''}`);
      report.before = { ref: before, sha, ...leg.info, errors: leg.errors, views: Object.keys(leg.shots) };
    } finally {
      await server?.close();
      // (on Windows a file the browser or Vite still holds makes git refuse
      // the removal: the folder is then deleted directly and the worktree
      // pruned, and the before pictures are kept either way)
      try {
        execFileSync('git', ['-c', 'core.longpaths=true', 'worktree', 'remove', '--force', wt], { cwd: ROOT, stdio: 'ignore' });
      } catch {
        rmSync(wt, { recursive: true, force: true });
        try {
          execFileSync('git', ['worktree', 'prune'], { cwd: ROOT, stdio: 'ignore' });
        } catch {
          /* (pruned on the next run) */
        }
      }
    }
    writeFileSync(reportFile, JSON.stringify(report, null, 1));
    stop(0);
  }

  const server = await serve(ROOT, undefined);
  const rows = [];
  try {
    for (const legName of ['webgl', 'webgpu']) {
      say(`${legName}:`);
      let leg;
      try {
        leg = await shoot(browser, server.base, legName);
      } catch (e) {
        // (a leg that never came on is a row that fails, not the end of the run)
        const why = String(e.message ?? e).split('\n')[0];
        say(`  FAIL ${why}`);
        report[legName] = { failed: why };
        for (const view of views) rows.push({ view, leg: legName, backend: '?', note: `failed: ${why}` });
        continue;
      }
      const { backend, onWebGPU, shading } = leg.info;
      // (a WebGPU leg that never reached a WebGPU device says nothing about WebGPU)
      const skipped = legName === 'webgpu' && !onWebGPU ? (shading !== 'nodes' ? 'the module is glsl' : leg.info.adapter ? 'WebGPU did not start' : 'no WebGPU adapter') : null;
      say(`  backend ${backend}${onWebGPU ? ' (a WebGPU device)' : ''}, shading ${shading}${leg.errors.length ? `, errors: ${leg.errors.join('; ')}` : ''}${skipped ? `, skipped: ${skipped}` : ''}`);
      report[legName] = { ...leg.info, errors: leg.errors, skipped };
      for (const view of views) {
        const b = join(OUT, `${view}-before.png`);
        if (!existsSync(b)) {
          rows.push({ view, leg: legName, backend, note: 'no before picture (run with --before first)' });
          continue;
        }
        if (!leg.shots[view]) {
          rows.push({ view, leg: legName, backend, note: 'not shot' });
          continue;
        }
        const d = diff(await raw(b), await raw(leg.shots[view]));
        rows.push({ view, leg: legName, backend, ...d, pass: passes(d), skipped, errors: leg.errors.length });
      }
    }
  } finally {
    await server.close();
  }
  report.rows = rows;
  writeFileSync(reportFile, JSON.stringify(report, null, 1));

  say('\n| view | leg | backend | PSNR dB | off % | mean diff (r, g, b) | result |');
  say('| --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    if (r.note) say(`| ${r.view} | ${r.leg} | ${r.backend} | | | | ${r.note} |`);
    else say(`| ${r.view} | ${r.leg} | ${r.backend} | ${fmt(r.psnr, 2)} | ${fmt(r.off * 100, 2)} | ${r.mad.map((m) => m.toFixed(2)).join(', ')} | ${r.skipped ? `skipped: ${r.skipped}` : r.pass ? 'pass' : 'FAIL'}${r.errors ? ` (${r.errors} errors)` : ''} |`);
  }
  say(`\npictures and report.json: ${OUT}`);
  if (rows.some((r) => r.note === 'no before picture (run with --before first)')) stop(2);
  // (the webgl leg gates, as the spec says; a webgpu leg that failed is said
  // loudly, for the desktop with a real chip to run, but SwiftShader's
  // WebGPU in a container drops its device even under a bare cube)
  const gate = rows.filter((r) => r.leg === 'webgl');
  if (rows.some((r) => r.leg === 'webgpu' && (r.note?.startsWith('failed') || r.pass === false))) say('FAIL: the webgpu leg (run it where there is a real chip before trusting WebGPU)');
  if (!gate.length || gate.some((r) => r.note || !r.pass || r.errors)) stop(1, 'FAIL: the webgl leg is not the same picture');
  stop(0, 'ok   the webgl leg passes');
} finally {
  await browser.close();
}
