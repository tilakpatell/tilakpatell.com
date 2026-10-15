#!/usr/bin/env node
/* global window, requestAnimationFrame */
// The 2017 soldier's walk in a headless browser on the machine's own GPU:
// the Battlefront world through its dev door (window.__battlefront), an
// assault trooper deployed on Hoth, then W held, W and D, S, and nothing,
// two seconds each, while every drawn frame records the body's place and
// the feet's (the Walrus rig's LeftFoot/RightFoot and the toes). The
// measure is foot slide: the planted foot (the lower of the two, in both
// of two frames) should not move over the ground while it carries the
// body, so its horizontal speed is the slide (mean and 95th centile a
// window), and a jump of over POP metres in one frame is a pop. One shot
// a window. With the dev server up (npx vite --port 5577 --strictPort --host 127.0.0.1):
//
//   node scripts/bf2017-walk-check.mjs [--tag after] [--out docs/superpowers/evidence/bf2017-walk-2026-10-12] [--base http://127.0.0.1:5577] [--hold 2000]
//   CHROME=<chrome or edge>   (Edge's msedge.exe by default on Windows)
//
// It writes <out>/<tag>.json (the numbers, the frames) and <out>/<tag>-<window>.jpg.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const TAG = arg('tag', 'after');
const OUT = arg('out', 'docs/superpowers/evidence/bf2017-walk-2026-10-12');
const BASE = arg('base', 'http://127.0.0.1:5577');
const HOLD = Number(arg('hold', 2000));
const ROUTE = '/battlefront/hoth/galacticAssault';
const WAIT = Number(process.env.PHASE_WAIT ?? 600000);
export const POP = 0.05; // m: a planted foot's jump in one frame that shows
const exe = process.env.CHROME ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
mkdirSync(OUT, { recursive: true });

// W, then W and D (ahead and right), then S (back), then still
const WINDOWS = [
  { name: 'w', keys: ['KeyW'] },
  { name: 'wd', keys: ['KeyW', 'KeyD'] },
  { name: 's', keys: ['KeyS'] },
  { name: 'stop', keys: [] },
];

// The slide and the pops over a window's frames. The ground the feet
// should hold is the body's steady course (the window's mean velocity in
// the world's own time: the runtime hands a world at most MAX_DT a frame,
// so a slow frame moves the sim and the clips by that, not by the clock),
// each foot read in the body's frame and carried by that course. The
// planted foot of a frame is the one moving less over the ground (the
// swinging one goes at about twice the body's speed); a stance is a run of
// frames with the same foot planted, and only its middle counts (the first
// and last fifth are the landing and the push-off, where a clip's own feet
// move): the planted foot's speed there is the slide, its move over POP in
// one frame a pop. `raw` is the same on the drawn body's own moves.
export const MAX_DT = 0.05; // runtime.js's
export const STANCE_EDGE = 0.2; // the share of a stance left out at each end
export function measure(frames, { pop = POP, maxDt = MAX_DT } = {}) {
  const n = frames.length;
  if (n < 2) return { frames: n, frameMs: 0, bodySpeed: 0, toe: null, ankle: null };
  const step = (i) => Math.min(maxDt, (frames[i].t - frames[i - 1].t) / 1000);
  let span = 0;
  for (let i = 1; i < n; i++) span += step(i);
  const course = span > 0 ? [(frames[n - 1].at[0] - frames[0].at[0]) / span, (frames[n - 1].at[2] - frames[0].at[2]) / span] : [0, 0];
  const out = {};
  for (const foot of ['toe', 'ankle']) {
    // each frame pair: the planted foot, its move over the ground and in the world
    const pairs = [];
    for (let i = 1; i < n; i++) {
      const a = frames[i - 1];
      const b = frames[i];
      const dt = step(i);
      if (!(dt > 0)) continue;
      let best = null;
      for (const side of ['L', 'R']) {
        const pa = a[`${side}${foot}`];
        const pb = b[`${side}${foot}`];
        const dx = pb[0] - b.at[0] - (pa[0] - a.at[0]) + course[0] * dt;
        const dz = pb[2] - b.at[2] - (pa[2] - a.at[2]) + course[1] * dt;
        const d = Math.hypot(dx, dz);
        const world = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]);
        if (!best || d < best.d) best = { side, d, world, dt };
      }
      pairs.push(best);
    }
    // the stances, and the middle of each
    const steady = [];
    const raw = [];
    let pops = 0;
    let maxStep = 0;
    let stances = 0;
    for (let i = 0; i < pairs.length; ) {
      let j = i;
      while (j < pairs.length && pairs[j].side === pairs[i].side) j++;
      const m = j - i;
      if (m >= 3) {
        stances++;
        const edge = Math.ceil(m * STANCE_EDGE);
        for (let k = i + edge; k < j - edge; k++) {
          const p = pairs[k];
          steady.push(p.d / p.dt);
          raw.push(p.world / p.dt);
          maxStep = Math.max(maxStep, p.d);
          if (p.d > pop) pops++;
        }
      }
      i = j;
    }
    const stats = (xs) => {
      const s = [...xs].sort((x, y) => x - y);
      const mean = s.length ? s.reduce((t, v) => t + v, 0) / s.length : 0;
      return { mean: +mean.toFixed(3), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(3), max: +(s[s.length - 1] ?? 0).toFixed(3) };
    };
    out[foot] = { stances, planted: steady.length, ...stats(steady), pops, maxStep: +maxStep.toFixed(3), raw: stats(raw) };
  }
  const clock = (frames[n - 1].t - frames[0].t) / (n - 1);
  return { frames: n, frameMs: +clock.toFixed(1), bodySpeed: +Math.hypot(course[0], course[1]).toFixed(2), ...out };
}

async function main() {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', JSON.stringify('universe'));
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    window.localStorage.setItem('tp-software', JSON.stringify('on')); // (past the Star Wars worlds' GPU gate, lib/fit: a software GL is the point here)
    window.localStorage.setItem('tp-quality', 'ultra');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  // (the clip packs the page fetched: the stance pack is the bucket's, so whether it landed is said)
  const packs = [];
  page.on('response', (r) => /clips-[a-z0-9-]+\.glb/.test(r.url()) && packs.push({ url: r.url().replace(/^.*\/(clips-[^/]+)$/, '$1'), status: r.status() }));
  await page.goto(`${BASE}/#${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  await page.waitForFunction(() => Boolean(window.__battlefront?.view), null, { timeout: WAIT, polling: 1000 });
  const backend = await page.evaluate(() => window.__battlefront.do('gpu'));
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  const deploy = await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  await page.evaluate(() => window.__battlefront.do('advance', 10));
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  // (the player's figure drawn, its stance pack landed or given up on)
  await page.waitForTimeout(4000);
  // the recorder: each drawn frame, after the world's own step
  const found = await page.evaluate(() => {
    const bf = window.__battlefront;
    const scene = bf.chain?.find?.((p) => p?.scene)?.scene ?? bf.level?.group?.parent ?? null;
    const figures = scene?.getObjectByName('figures');
    if (!figures) return { ok: false, why: `no figures group (scene ${Boolean(scene)}, chain ${bf.chain?.length ?? 'none'})` };
    const at = bf.view().player?.at;
    let model = null;
    let best = Infinity;
    for (const m of figures.children) {
      const d = Math.hypot(m.position.x - at[0], m.position.z - at[2]);
      if (d < best) {
        best = d;
        model = m;
      }
    }
    if (!model || best > 1) return { ok: false, why: `no figure at the player (nearest ${best.toFixed(2)} m of ${figures.children.length})` };
    const bone = (n) => model.getObjectByName(n);
    const bones = { Ltoe: bone('LeftToeBase'), Rtoe: bone('RightToeBase'), Lankle: bone('LeftFoot'), Rankle: bone('RightFoot') };
    const missing = Object.entries(bones).filter(([, b]) => !b).map(([k]) => k);
    if (missing.length) return { ok: false, why: `no bones ${missing.join(', ')}` };
    let mesh = null;
    model.traverse((o) => o.isSkinnedMesh && !mesh && (mesh = o));
    if (!mesh) return { ok: false, why: 'no skinned mesh on the figure' };
    const rec = { frames: [], marks: [], on: true, window: null, armed: false };
    window.__walk = rec;
    const read = (b) => {
      const e = b.matrixWorld.elements;
      return [+e[12].toFixed(4), +e[13].toFixed(4), +e[14].toFixed(4)];
    };
    // (one sample a frame, taken as the body is first drawn: after the
    // world's step and the matrices' update, whichever order the frame's
    // callbacks run in; the arm is set each animation frame)
    mesh.onAfterRender = () => {
      if (!rec.armed || !rec.on) return;
      rec.armed = false;
      if (rec.window) rec.frames.push({ t: performance.now(), w: rec.window, at: [+model.position.x.toFixed(4), +model.position.y.toFixed(4), +model.position.z.toFixed(4)], yaw: +model.rotation.y.toFixed(4), Ltoe: read(bones.Ltoe), Rtoe: read(bones.Rtoe), Lankle: read(bones.Lankle), Rankle: read(bones.Rankle) });
    };
    const tick = () => {
      if (!rec.on) return;
      rec.armed = true;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { ok: true, figures: figures.children.length };
  });
  if (!found.ok) {
    console.error(found.why);
    await browser.close();
    process.exit(2);
  }
  // (a warm-up on the move: the clips' first frames and the level's cells ahead come in before anything is measured)
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(HOLD);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);
  const shots = {};
  for (const w of WINDOWS) {
    for (const k of w.keys) await page.keyboard.down(k);
    await page.evaluate((name) => {
      window.__walk.window = name;
      window.__walk.marks.push({ t: performance.now(), name });
    }, w.name);
    await page.waitForTimeout(HOLD / 2);
    const file = join(OUT, `${TAG}-${w.name}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    shots[w.name] = file;
    // (and the feet: the camera held off the body's side for one shot,
    // through its matrix update after the rig has placed it, as the guns'
    // evidence did; the dev door has no camera verb)
    const hooked = await page.evaluate(() => {
      const bf = window.__battlefront;
      const camera = bf.chain?.find?.((p) => p?.kind === 'render' && p.camera)?.camera ?? bf.chain?.find?.((p) => p?.camera)?.camera;
      const scene = bf.chain?.find?.((p) => p?.scene)?.scene ?? bf.level?.group?.parent ?? null;
      const figures = scene?.getObjectByName('figures');
      const at = bf.view().player?.at;
      const model = figures?.children.reduce((best, m) => (!best || Math.hypot(m.position.x - at[0], m.position.z - at[2]) < Math.hypot(best.position.x - at[0], best.position.z - at[2]) ? m : best), null);
      if (!camera || !model) return false;
      const was = camera.updateMatrixWorld;
      camera.updateMatrixWorld = function (force) {
        const yaw = model.rotation.y;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        this.position.set(model.position.x - fx * 3.4 + fz * 1.6, model.position.y + 1.1, model.position.z - fz * 3.4 - fx * 1.6);
        this.lookAt(model.position.x, model.position.y + 0.7, model.position.z);
        was.call(this, force);
      };
      window.__walkUnhook = () => (camera.updateMatrixWorld = was);
      return true;
    });
    if (hooked) {
      await page.waitForTimeout(120);
      await page.screenshot({ path: join(OUT, `${TAG}-${w.name}-wide.jpg`), type: 'jpeg', quality: 82 });
      await page.evaluate(() => window.__walkUnhook?.());
      shots[`${w.name}-wide`] = join(OUT, `${TAG}-${w.name}-wide.jpg`);
    }
    await page.waitForTimeout(HOLD / 2);
    await page.evaluate(() => (window.__walk.window = null));
    for (const k of w.keys) await page.keyboard.up(k);
  }
  const rec = await page.evaluate(() => {
    window.__walk.on = false;
    return { frames: window.__walk.frames, marks: window.__walk.marks };
  });
  const figure = await page.evaluate(() => {
    const bf = window.__battlefront;
    const v = bf.view();
    return { player: v.player && { at: v.player.at, yaw: v.player.yaw, weapon: v.player.weapon }, level: v.level };
  });
  await browser.close();
  const windows = {};
  for (const w of WINDOWS) windows[w.name] = measure(rec.frames.filter((f) => f.w === w.name));
  const report = { tag: TAG, backend, deploy, figure, figures: found.figures, packs, windows, errors, shots, frames: rec.frames };
  writeFileSync(join(OUT, `${TAG}.json`), `${JSON.stringify(report, null, 1)}\n`);
  for (const [name, m] of Object.entries(windows)) console.log(`${TAG} ${name.padEnd(4)} frames ${String(m.frames).padStart(3)} (${m.frameMs} ms) body ${m.bodySpeed} m/s | toe: ${m.toe?.stances} stances, ${m.toe?.planted} planted frames, slide mean ${m.toe?.mean} p95 ${m.toe?.p95} max ${m.toe?.max} m/s, pops ${m.toe?.pops} (max step ${m.toe?.maxStep} m), raw mean ${m.toe?.raw.mean} | ankle mean ${m.ankle?.mean} p95 ${m.ankle?.p95} pops ${m.ankle?.pops}`);
  console.log(`backend ${backend}; packs ${packs.map((p) => `${p.url} ${p.status}`).join(', ')}; errors ${errors.length}${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
}

if (process.argv[1] && /bf2017-walk-check\.mjs$/.test(process.argv[1])) main().catch((e) => {
  console.error(e);
  process.exit(1);
});
