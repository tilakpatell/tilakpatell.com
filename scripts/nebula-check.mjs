/* global window, document */
// The nebulae measured in the browser: that a nebula is a place, not a
// picture riding the camera (the endless universe's design, section D and
// "What done looks like" 5):
//
//   node scripts/nebula-check.mjs [--url http://127.0.0.1:5173] [--quality high] [--out lab/universe/nebula-check.json] [--shots <dir>] [--chromium /path]
//
// 1. Parallax: at the veil-side pose, the Veil shot with the nebulae on
//    and off (the difference is the cloud), then again with the camera
//    moved 5,000 to its right. The cloud's centroid must move as its
//    projection says it does (at least 100 px predicted, measured within
//    max(8 px, 10 %)).
// 2. Roll: the same pose with the view turned 30° about its own axis. The
//    stars (the shot without the nebulae) turn 30 ± 3°, and the cloud
//    within 3° of them.
// 3. Inside: at the in-nebula pose, the fog covers at least 60 % of the frame.
//
// It starts the dev server (the poses are a DEV hook) unless --url names
// one. Exit 1 on a failed measure or a page error. No threshold moves to
// pass: a failure is the renderer's (src/components/universe/nebula/).
import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { bestRotation, centroid, diffMask } from './lib/nebula-measure.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[argv[i].slice(2)] = true;
  else args[argv[i].slice(2)] = argv[++i];
}
const tier = typeof args.quality === 'string' ? args.quality : 'high';
const outPath = resolve(ROOT, typeof args.out === 'string' ? args.out : 'lab/universe/nebula-check.json');
const W = 1280, H = 720;

// ── the server: the dev server, as universe-check.mjs starts it ──
let server = null;
let base = typeof args.url === 'string' ? args.url.replace(/\/$/, '') : null;
if (!base) {
  const port = await new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
  const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  const up = Date.now();
  for (;;) {
    if (Date.now() - up > 120000) throw new Error('the dev server did not come up');
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).flatMap((n) => [`/opt/pw-browsers/${n}/chrome-linux/chrome`, `/opt/pw-browsers/${n}/chrome-linux64/chrome`]).find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-quality', q);
  window.localStorage.setItem('tp-universe-ship', '"falcon"');
  window.__tpKeepFrames = true;
}, tier);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message ?? e)));
page.on('console', (m) => {
  if (m.type() === 'error' && /shader|program|GLSL|WebGL/i.test(m.text())) errors.push(m.text().slice(0, 400));
});

const report = { tier, viewport: [W, H], measures: {}, errors };
let failed = 0;
const verdict = (name, ok, detail) => {
  report.measures[name] = { ok, ...detail };
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(9)} ${JSON.stringify(detail)}`);
};

// the map's canvas alone, as raw RGBA
const shotsDir = typeof args.shots === 'string' ? resolve(ROOT, args.shots) : null;
let shotN = 0;
const shot = async () => {
  const png = await page.screenshot({ type: 'png', timeout: 180000 });
  // (--shots <dir>: each shot kept, numbered, to look at)
  if (shotsDir) {
    await mkdir(shotsDir, { recursive: true });
    await writeFile(join(shotsDir, `${String(++shotN).padStart(2, '0')}.png`), png);
  }
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) throw new Error(`a shot of ${info.width} × ${info.height}`);
  return data;
};
const frames = (n = 2) => page.evaluate((k) => window.__universe().frames(k), n);
const nebulae = (on) =>
  page.evaluate((v) => {
    const g = window.__universeDebug.scene.getObjectByName('nebulae');
    if (!g) throw new Error('no nebulae group in the scene');
    g.visible = v;
  }, on);
const both = async () => {
  await nebulae(true);
  await frames();
  const on = await shot();
  await nebulae(false);
  await frames();
  const off = await shot();
  await nebulae(true);
  return { on, off };
};
// where a nebula's middle is on screen, in pixels (deep space keeps a
// group at each wonder's place: deepspace.js's place)
const project = (id) =>
  page.evaluate((nid) => {
    const { scene, camera, THREE } = window.__universeDebug;
    const g = scene.getObjectByName(`deep-${nid}`);
    if (!g) throw new Error(`no deep-${nid} in the scene`);
    const v = g.getWorldPosition(new THREE.Vector3()).project(camera);
    return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
  }, id);
const pose = async (name) => {
  await page.evaluate((n) => window.__universe().pose(n), name);
  await page.evaluate(() => window.__universeDebug.post?.grain?.(0));
  await frames();
};

try {
  await page.goto(`${base}/?quality=${tier}#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
  await page.waitForFunction(() => window.__universeDebug.renderer.domElement.parentElement?.dataset.gl === 'on', null, { timeout: 600000, polling: 500 });
  await page.waitForTimeout(2000);
  // the picture alone: the page's bar, panel and HUD hidden
  await page.evaluate(() => {
    const canvas = window.__universeDebug.renderer.domElement;
    canvas.setAttribute('data-measured', '');
    const style = document.createElement('style');
    style.textContent = 'body * { visibility: hidden !important; } canvas[data-measured] { visibility: visible !important; }';
    document.head.append(style);
  });

  // 1. parallax
  await pose('veil-side');
  const a = await both();
  const pa = await project('veil');
  await page.evaluate(() => {
    const { state, THREE } = window.__universeDebug;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(state.held.view.quat);
    state.held.view.target.addScaledVector(right, 5000);
  });
  await frames();
  const b = await both();
  const pb = await project('veil');
  const ca = centroid(diffMask({ ...a, width: W, height: H }), W);
  const cb = centroid(diffMask({ ...b, width: W, height: H }), W);
  const predicted = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
  const measured = Math.hypot(cb.x - ca.x, cb.y - ca.y);
  verdict('parallax', ca.n > 50 && cb.n > 50 && predicted >= 100 && Math.abs(measured - predicted) <= Math.max(8, 0.1 * predicted), { predicted: +predicted.toFixed(1), measured: +measured.toFixed(1), pixels: [ca.n, cb.n] });

  // 2. roll
  await pose('veil-side');
  const r0 = await both();
  await page.evaluate(() => {
    const { state, THREE } = window.__universeDebug;
    const v = state.held.view;
    v.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (30 * Math.PI) / 180));
  });
  await frames();
  const r1 = await both();
  const cloud0 = centroid(diffMask({ ...r0, width: W, height: H }), W);
  const cloudOnly = (s) => {
    const m = diffMask({ ...s, width: W, height: H });
    const d = Buffer.alloc(W * H * 4);
    for (let p = 0; p < W * H; p++) if (m[p]) for (let c = 0; c < 3; c++) d[p * 4 + c] = Math.max(0, s.on[p * 4 + c] - s.off[p * 4 + c]);
    return d;
  };
  // the stars turn about the view's middle; the cloud with them, so about the middle too
  const stars = bestRotation(r0.off, r1.off, { width: W, height: H, about: [W / 2, H / 2], radius: 300, range: 45, step: 1 });
  const cloud = bestRotation(cloudOnly(r0), cloudOnly(r1), { width: W, height: H, about: [W / 2, H / 2], radius: Math.min(340, Math.hypot(cloud0.x - W / 2, cloud0.y - H / 2) + 120), range: 45, step: 1 });
  verdict('roll', Math.abs(Math.abs(stars) - 30) <= 3 && Math.abs(cloud - stars) <= 3, { stars, cloud });

  // 3. inside
  await pose('in-nebula');
  const i = await both();
  const share = centroid(diffMask({ ...i, width: W, height: H }, 6), W).n / (W * H);
  verdict('inside', share >= 0.6, { share: +share.toFixed(3) });
} catch (e) {
  failed++;
  errors.push(String(e?.message ?? e));
  console.log(`FAIL ${e?.message ?? e}`);
}
if (errors.length) {
  failed++;
  console.log(`FAIL page errors: ${errors.join(' | ').slice(0, 800)}`);
}
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
server?.kill();
process.exit(failed ? 1 : 0);
