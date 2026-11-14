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
// 2. Roll: the Veil 16,500 off, centred, the view turned 30° about its own
//    axis. The picture's turn is read from two of the map's points
//    projected before and after; the cloud must turn within 3° of it (on
//    main the landmark's picture didn't turn at all).
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
import { bestRotation, centroid, diffMask, largestBlob } from './lib/nebula-measure.mjs';

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
  // (the cloud is the difference's biggest part: a star that twinkled between the shots isn't)
  const ca = centroid(largestBlob(diffMask({ ...a, width: W, height: H }), W, H), W);
  const cb = centroid(largestBlob(diffMask({ ...b, width: W, height: H }), W, H), W);
  const predicted = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
  const measured = Math.hypot(cb.x - ca.x, cb.y - ca.y);
  verdict('parallax', ca.n > 50 && cb.n > 50 && predicted >= 100 && Math.abs(measured - predicted) <= Math.max(8, 0.1 * predicted), { predicted: +predicted.toFixed(1), measured: +measured.toFixed(1), pixels: [ca.n, cb.n] });

  // 2. roll: the Veil brought to 16,500 off and centred, so it fills the
  // frame's middle; the view turned 30° about its own axis. What the turn
  // should do to the picture is read from two of the map's points (the
  // Veil's middle and a point above it) projected before and after; the
  // cloud must turn by that, within 3°.
  await pose('veil-side');
  await page.evaluate(() => {
    const { state, scene, THREE } = window.__universeDebug;
    const veil = scene.getObjectByName('deep-veil').position.clone();
    const v = state.held.view;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(v.quat);
    const eye = v.target.clone().addScaledVector(fwd, -v.dist);
    const at = veil.clone().add(eye.sub(veil).setLength(16500)); // (three of its gas's radii, deep.js's cloud: outside it, filling the middle)
    v.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(at, veil, new THREE.Vector3(0, 1, 0)));
    const dir = veil.clone().sub(at).normalize();
    v.target.copy(at).addScaledVector(dir, v.dist);
  });
  await frames();
  // where the Veil's middle and a point above it are on screen
  const marks = () =>
    page.evaluate(() => {
      const { scene, camera, THREE } = window.__universeDebug;
      const g = scene.getObjectByName('deep-veil');
      const px = (v) => {
        v.project(camera);
        return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
      };
      const mid = g.getWorldPosition(new THREE.Vector3());
      const above = g.localToWorld(new THREE.Vector3(0, 300, 0));
      return [px(mid), px(above)];
    });
  const r0 = await both();
  const m0 = await marks();
  await page.evaluate(() => {
    const { state, THREE } = window.__universeDebug;
    state.held.view.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (30 * Math.PI) / 180));
  });
  await frames();
  const r1 = await both();
  const m1 = await marks();
  const angleOf = ([a, b]) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  let turn = ((angleOf(m1) - angleOf(m0)) * 180) / Math.PI;
  turn = ((turn + 540) % 360) - 180;
  const cloudOnly = (sh) => {
    const m = diffMask({ ...sh, width: W, height: H });
    const d = Buffer.alloc(W * H * 4);
    for (let q = 0; q < W * H; q++) if (m[q]) for (let c = 0; c < 3; c++) d[q * 4 + c] = Math.max(0, sh.on[q * 4 + c] - sh.off[q * 4 + c]);
    return d;
  };
  // (the picture's turn about the Veil's middle: its centre on screen moves too, so
  // the image before is moved onto it first, by turning about the middle of the two)
  const before = cloudOnly(r0), after = cloudOnly(r1);
  const shiftTo = (img, dx, dy) => {
    const d = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const sx = Math.round(x - dx), sy = Math.round(y - dy);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        img.copy(d, (y * W + x) * 4, (sy * W + sx) * 4, (sy * W + sx) * 4 + 4);
      }
    return d;
  };
  const moved = shiftTo(before, m1[0][0] - m0[0][0], m1[0][1] - m0[0][1]);
  const cloud = bestRotation(moved, after, { width: W, height: H, about: m1[0], radius: 260, range: 45, step: 1 });
  const seen = centroid(diffMask({ ...r0, width: W, height: H }), W).n / (W * H);
  verdict('roll', Math.abs(Math.abs(turn) - 30) <= 1 && Math.abs(cloud - turn) <= 3 && seen * W * H > 2000, { turn: +turn.toFixed(1), cloud, cloudShare: +seen.toFixed(3) });

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
