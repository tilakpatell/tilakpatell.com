/* global window, document */
// The nebulae measured in a browser: that a cloud stays put in the world
// (the endless-universe spec's "done" item 5), not just that it's drawn:
//
//   node scripts/nebula-check.mjs --url http://127.0.0.1:5173 [--quality high]
//     [--out lab/universe/nebula-check.json] [--chromium /path]
//
// It needs a dev server (`npx vite`: the poses are a DEV hook, which a
// production build leaves out) and opens /universe as universe-check.mjs
// does, the same storage keys and the same two waits. Each shot is taken
// with the nebulae drawn and again without them (the 'nebulae' group
// hidden), so their difference is the clouds alone (lib/nebula-measure.mjs):
// - parallax: held at the 'veil-side' pose (poses.js), then the camera
//   moved 5,000 to its right. The Veil's difference moves on screen as far
//   as its middle, projected through the camera, does: at least 100 px, and
//   measured within max(8 px, 10 %) of it. (The Cradle is in view from
//   there too, about 15° left, so each middle is the difference's within
//   twice the Veil's radius of where the camera puts it: a cloud that
//   didn't move as far would sit off that window's middle, or out of it.)
// - roll: held there again and the view turned 30° about its own axis. The
//   stars (the shots without the clouds) turn 30 ± 3° about the lens's
//   middle, and the Veil's difference turns within 3° of them about its own.
//   A landmark drawn square to the screen moved round but never turned.
// - inside: held at 'in-nebula', in the Cradle. The fog's difference covers
//   at least 60 % of the frame.
// The numbers go to the JSON. Exit 1 on a failed measure, a page error or a
// console error that isn't known noise (lib/noise.mjs, as autopilot-check's);
// no threshold moves to pass (a fault is the renderer's).
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { bestRotation, centroid, diffMask, luminance } from './lib/nebula-measure.mjs';
import { noisy } from './lib/noise.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TIERS = ['high', 'mid', 'low'];

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[key] = true;
  else args[key] = argv[++i];
}
if (typeof args.url !== 'string') throw new Error('a dev server is needed: --url http://127.0.0.1:5173 (npx vite)');
const base = args.url.replace(/\/$/, '');
const tier = typeof args.quality === 'string' ? args.quality : 'high';
if (!TIERS.includes(tier)) throw new Error(`no tier ${tier} (high, mid or low)`);
const out = join(ROOT, typeof args.out === 'string' ? args.out : 'lab/universe/nebula-check.json');

const SIDEWAYS = 5000;
const ROLL = 30;
const r1 = (v) => Number(v.toFixed(1));
await mkdir(dirname(out), { recursive: true });

const exe = args.chromium ?? process.env.CHROMIUM ?? (await readdir('/opt/pw-browsers').catch(() => [])).filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
if (!exe) throw new Error('no Chromium (set CHROMIUM=/path/to/chrome)');
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--max-old-space-size=4096'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript((q) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-quality', q);
  window.localStorage.setItem('tp-universe-ship', '"falcon"');
  window.__tpKeepFrames = true;
}, tier);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`page: ${String(e.message ?? e).split('\n')[0]}`));
const noise = [];
page.on('console', (m) => m.type() === 'error' && (noisy(m.text()) ? noise : errors).push(`console: ${m.text().split('\n')[0]}`));

const report = { tier, viewport: [1280, 720], url: base, measures: {}, errors };
let failed = 0;
const say = (ok, what, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what.padEnd(9)} ${detail}`);
};

// the map's canvas alone, as the renderer drew it: RGBA, its own size
let clip = null;
const shoot = async () => {
  await page.evaluate(() => window.__universe().frames(2));
  const png = await page.screenshot({ type: 'png', clip, timeout: 180000 });
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};
// with the nebulae and without: the pair whose difference is the clouds
const pair = async () => {
  await page.evaluate(() => (window.__universeDebug.scene.getObjectByName('nebulae').visible = true));
  const on = await shoot();
  await page.evaluate(() => (window.__universeDebug.scene.getObjectByName('nebulae').visible = false));
  const off = await shoot();
  await page.evaluate(() => (window.__universeDebug.scene.getObjectByName('nebulae').visible = true));
  return { on, off };
};
// a nebula's middle through the camera, in the canvas's pixels; its radius
// there; and where the lens's own axis meets the screen (the view's offset
// moves it off the canvas's middle)
const project = (id) =>
  page.evaluate(
    ([id, w, h]) => {
      const { scene, camera, THREE } = window.__universeDebug;
      camera.updateMatrixWorld();
      const px = (v) => [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
      const g = scene.getObjectByName(`deep-${id}`);
      const at = g.getWorldPosition(new THREE.Vector3());
      const dist = at.distanceTo(camera.getWorldPosition(new THREE.Vector3()));
      const r = window.__universeDebug.wonders.find((x) => x.id === id).reach;
      const fwd = camera.getWorldDirection(new THREE.Vector3());
      const axis = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 10).project(camera);
      return { at: px(at.clone().project(camera)), dist, radius: (r / dist) * (h / 2) * camera.projectionMatrix.elements[5], axis: px(axis) };
    },
    [id, clip.width, clip.height],
  );
// the clouds' difference, one luminance a pixel
const diffImage = ({ on, off }) => {
  const a = luminance(on.data, on.width, on.height);
  const b = luminance(off.data, off.width, off.height);
  return Float32Array.from(a, (v, i) => Math.abs(v - b[i]));
};
const hold = async (name) => {
  await page.evaluate((n) => window.__universe().pose(n), name);
  // the grain moves frame to frame; a difference of two frames shouldn't (post.js)
  await page.evaluate(() => window.__universeDebug.post?.grain?.(0));
};

try {
  await page.goto(`${base}/?quality=${tier}#/universe`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship && window.__universeDebug?.state?.model, null, { timeout: 300000, polling: 250 });
  await page.waitForFunction(() => window.__universeDebug.renderer.domElement.parentElement?.dataset.gl === 'on', null, { timeout: 600000, polling: 500 });
  await page.waitForTimeout(2000);
  // the picture alone: the page's bar, panel and HUD hidden (universe-check.mjs)
  clip = await page.evaluate(() => {
    const canvas = window.__universeDebug.renderer.domElement;
    canvas.setAttribute('data-measured', '');
    const style = document.createElement('style');
    style.textContent = 'body * { visibility: hidden !important; } canvas[data-measured] { visibility: visible !important; }';
    document.head.append(style);
    const b = canvas.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) };
  });
  const { width: W, height: H } = clip;

  // ── parallax ──
  await hold('veil-side');
  const a = await pair();
  const pa = await project('veil');
  await page.evaluate((k) => {
    const { state, THREE } = window.__universeDebug;
    const v = state.held.view;
    v.target.addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(v.quat), k);
  }, SIDEWAYS);
  const b = await pair();
  const pb = await project('veil');
  // (the Veil's alone: the window is where the camera puts it, twice its size)
  const veilOf = (p, { on, off }) => centroid(diffMask({ on: on.data, off: off.data, width: W, height: H }), W, { about: p.at, radius: Math.max(16, 2 * p.radius) });
  const ca = veilOf(pa, a);
  const cb = veilOf(pb, b);
  const predicted = [pb.at[0] - pa.at[0], pb.at[1] - pa.at[1]];
  const measured = [cb.x - ca.x, cb.y - ca.y];
  const miss = Math.hypot(measured[0] - predicted[0], measured[1] - predicted[1]);
  const shift = Math.hypot(...predicted);
  const allowed = Math.max(8, 0.1 * shift);
  report.measures.parallax = { sideways: SIDEWAYS, predicted: predicted.map(r1), measured: measured.map(r1), miss: r1(miss), allowed: r1(allowed), cloudPx: [ca.n, cb.n], radiusPx: [r1(pa.radius), r1(pb.radius)], at: [pa.at.map(r1), pb.at.map(r1)], centroid: [[r1(ca.x), r1(ca.y)], [r1(cb.x), r1(cb.y)]] };
  say(shift >= 100 && ca.n > 0 && cb.n > 0 && miss <= allowed, 'parallax', `predicted ${r1(shift)} px (${predicted.map(r1).join(', ')}), measured (${measured.map(r1).join(', ')}), off by ${r1(miss)} px of ${r1(allowed)} allowed; the cloud ${ca.n} then ${cb.n} px`);
  await writeFile(join(dirname(out), 'nebula-check-veil.webp'), await sharp(a.on.data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88 }).toBuffer()).catch(() => {});

  // ── roll ──
  await hold('veil-side');
  const s = await pair();
  const ps = await project('veil');
  await page.evaluate((deg) => {
    const { state, THREE } = window.__universeDebug;
    state.held.view.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (deg * Math.PI) / 180));
  }, ROLL);
  const r = await pair();
  const pr = await project('veil');
  const da = diffImage(s);
  const dr = diffImage(r);
  const cs = veilOf(ps, s);
  const cr = veilOf(pr, r);
  // the stars: everything but the clouds turns about the lens's axis
  const starsAbout = ps.axis;
  const stars = bestRotation(s.off.data, r.off.data, { width: W, height: H, about: starsAbout, radius: Math.min(W, H) * 0.45 });
  const cloudR = Math.max(12, ps.radius * 1.4);
  const cloud = bestRotation(da, dr, { width: W, height: H, about: [cs.x, cs.y], to: [cr.x, cr.y], radius: cloudR });
  report.measures.roll = { roll: ROLL, stars, cloud, about: { stars: starsAbout.map(r1), cloud: [[r1(cs.x), r1(cs.y)], [r1(cr.x), r1(cr.y)]] }, cloudRadiusPx: r1(cloudR), cloudPx: [cs.n, cr.n], axisAfter: pr.axis.map(r1) };
  say(Math.abs(Math.abs(stars) - ROLL) <= 3 && cs.n > 0 && cr.n > 0 && Math.abs(cloud - stars) <= 3, 'roll', `the stars turned ${stars}°, the cloud ${cloud}° (within 3° of them; the stars 30 ± 3)`);

  // ── inside ──
  await hold('in-nebula');
  const inside = await pair();
  const m = diffMask({ on: inside.on.data, off: inside.off.data, width: W, height: H });
  const share = centroid(m, W).n / (W * H);
  const where = await page.evaluate(() => {
    const { scene } = window.__universeDebug;
    return { fog: scene.getObjectByName('nebula-fog')?.visible ?? null, layers: scene.getObjectByName('nebula-fog')?.geometry.instanceCount ?? null };
  });
  report.measures.inside = { share: Number(share.toFixed(3)), ...where };
  say(share >= 0.6, 'inside', `the fog covers ${(share * 100).toFixed(1)} % of the frame (at least 60 %), ${where.layers} layers`);
  await writeFile(join(dirname(out), 'nebula-check-inside.webp'), await sharp(inside.on.data, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 88 }).toBuffer()).catch(() => {});
} catch (e) {
  failed++;
  report.error = String(e.message ?? e).split('\n')[0];
  console.log(`FAIL ${report.error}`);
}

if (errors.length) {
  failed++;
  console.log(`FAIL errors   ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
}
await writeFile(out, `${JSON.stringify({ ...report, errors: [...new Set(errors)].slice(0, 20), noise: [...new Set(noise)].slice(0, 20), failed }, null, 2)}\n`);
console.log(`wrote ${out}`);
await browser.close();
process.exit(failed ? 1 : 0);
