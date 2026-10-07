/* global window, document */
// Cybertron's Decepticons on their actors, checked in a browser: a wave of
// five brought in round Optimus through the dev hook (two of them hurt, as a
// fight leaves them), watched for twenty seconds of the sim's own clock
// while he stands his ground (he isn't let go down: it's them being
// watched). Some should reach cover and crouch there, no more than three
// should fire in any one step (the shot tokens), the AI should cost no more
// than 2 ms a step, and nothing should go to the console. Then one of them
// in cover is photographed from the side, the sim held still for it.
// Headless Chromium on the dev server (software WebGL on Linux), as
// scripts/universe-npc-check.mjs does: software WebGL runs a few frames a
// second, so the check goes by the sim's clock, and steps the sim a little
// itself between looks so twenty seconds don't take ten minutes.
//
//   node scripts/cybertron-check.mjs [seed=7]
// BASE set (a dev server already up) it uses that; CHROME is the Chromium to
// use (the Playwright one by default).

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { noisy } from './lib/noise.mjs';

const out = 'docs/superpowers/shots';
const shot = `${out}/2026-10-07-cybertron-cover.webp`;
const seed = Number(process.argv[2] ?? 7);
const SIM = 20; // seconds of the sim's clock
const PORT = 5296;
mkdirSync(out, { recursive: true });

let server = null;
let base = process.env.BASE;
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  base = `http://127.0.0.1:${PORT}`;
}
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? chromium.executablePath(), args });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-sound', 'off');
    window.localStorage.setItem('tp-3d', 'on'); // (software WebGL: drawn all the same)
    window.localStorage.setItem('tp-worlds', '"load"'); // (and not asked first)
    // (Iacon, the Autobots' side, nothing done yet)
    window.localStorage.removeItem('tp-cybertron-world');
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !noisy(m.text()) && errors.push(m.text()));
  // (?ai and ?seed before the hash: lib/ai/inspect reads the page's own search)
  await page.goto(`${base}/?ai=1&seed=${seed}#/cybertron?autoplay`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__CY__?.sim, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('.cyw')?.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => window.__CY__?.api?.current && window.__CY__.sim.clock > 0.2, null, { timeout: 240000 });
  const dbg = (fn, arg) => page.evaluate(fn, arg);

  // every step watched: the most shots fired in one, who reached cover, the
  // states seen; Optimus kept on his feet; and a hold for the photograph
  await dbg(() => {
    const s = window.__CY__.sim;
    const w = (window.__cyw = { most: 0, steps: 0, fired: 0, cover: [], states: {}, held: false, ms: 0, from: null });
    const step = s.step;
    s.step = (input, dt) => {
      if (w.held) return [];
      const out = step(input, dt);
      const n = out.filter((e) => e.type === 'enemyFire').length;
      w.most = Math.max(w.most, n);
      w.fired += n;
      w.steps += 1;
      s.player.hp = s.player.maxHp;
      for (const e of s.enemies) {
        if (e.dead) continue;
        w.states[e.state] = (w.states[e.state] ?? 0) + 1;
        if (e.inCover && !w.cover.some((c) => c.id === e.id)) w.cover.push({ id: e.id, x: e.x, z: e.z, from: { x: s.player.x, z: s.player.z } });
      }
      // (the cost once they're warm: the first steps of a wave are the engine compiling them)
      if (w.from != null && s.clock - w.from > 2) w.ms = Math.max(w.ms, window.__CY__.ai.stats().ms);
      return out;
    };
  });
  // the wave: five troopers round him, forty metres off, and two of them
  // hurt, beside the crates out in the open south of the plaza (where the
  // gate's fight is); he stands a little north of them
  const wave = await dbg((seed) => {
    const s = window.__CY__.sim;
    const p = s.player;
    Object.assign(p, { x: 0, z: 215, vx: 0, vz: 0, yaw: 0, y: s.world.floorAt(0, 215, 50, 60) });
    window.__CY__.ctl.current.view.yaw = 0;
    const crates = s.world.solids.filter((x) => x.top > 3.5 && x.top < 20 && x.reach < 10).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z));
    const made = [];
    window.__cyw.from = s.clock;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed * 0.1;
      const c = i < 2 ? crates[i] : null;
      // (the hurt ones off a crate's side, a few steps from behind it)
      const at = c ? { x: c.x + (c.x >= p.x ? 7 : -7), z: c.z + 3 } : { x: p.x + Math.sin(a) * 40, z: p.z + Math.cos(a) * 40 };
      const e = window.__CY__.spawn('trooper', at.x, at.z, { id: `check-${i}` });
      if (c) e.hp = 12;
      made.push(e.id);
    }
    return made;
  }, seed);
  check(wave.length === 5, 'a wave of five comes in');
  const t0 = await dbg(() => window.__CY__.sim.clock);
  let now = t0;
  for (let i = 0; i < 400 && now - t0 < SIM; i++) {
    await page.waitForTimeout(250);
    // (a little more of the sim's clock than the page's slow frames give)
    now = await dbg(() => {
      const s = window.__CY__.sim;
      const still = { moveX: 0, moveZ: 0, run: false, jump: false, throttle: 0, steer: 0, boost: false, fire: false, transform: false, use: false, aimYaw: s.player.yaw, aimPitch: 0 };
      for (let k = 0; k < 6; k++) s.step(still, 1 / 30);
      return s.clock;
    });
  }
  const seen = await dbg(() => {
    const w = window.__cyw;
    return { most: w.most, fired: w.fired, steps: w.steps, cover: w.cover, states: w.states, ms: w.ms, stats: window.__CY__.ai.stats(), traced: window.__CY__.ai.trace.agents().length };
  });
  console.log(`seed ${seed}, ${Math.round(now - t0)} sim seconds, ${seen.steps} steps:`, JSON.stringify({ states: seen.states, fired: seen.fired, mostInAStep: seen.most, inCover: seen.cover.map((c) => c.id), traced: seen.traced }));
  console.log('ai stats:', JSON.stringify({ ...seen.stats, ms: Number(seen.stats.ms.toFixed(3)), last: Number(seen.stats.last.toFixed(3)), worstSmoothedMs: Number(seen.ms.toFixed(3)) }));
  check(now - t0 >= SIM, `ran ${SIM} seconds of the sim`);
  check(seen.cover.length > 0, 'some Decepticon reached cover');
  check(seen.fired > 0, 'they fired');
  check(seen.most <= 3, 'never more than three shots in a step (the tokens)');
  check(seen.ms <= 2, `the AI costs at most 2 ms a step (smoothed, after the first two seconds; worst seen ${seen.ms.toFixed(3)})`);
  check(seen.traced >= 5, 'every one of them is traced');

  // the photograph: one crouched in cover, seen from the side, the sim held
  const posed = await dbg(() => {
    const s = window.__CY__.sim;
    const e = s.enemies.find((x) => !x.dead && x.inCover) ?? null;
    if (!e) return null;
    window.__cyw.held = true;
    // (a quarter turn round from where he was, so the solid and the one behind it both show)
    const dx = e.x - s.player.x;
    const dz = e.z - s.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const [nx, nz] = [-dz / d, dx / d];
    const px = e.x + nx * 24 - (dx / d) * 6;
    const pz = e.z + nz * 24 - (dz / d) * 6;
    Object.assign(s.player, { x: px, z: pz, vx: 0, vz: 0, y: s.world.floorAt(px, pz, 50, 60) });
    const view = window.__CY__.ctl.current.view;
    view.yaw = Math.atan2(e.x - px, e.z - pz);
    s.player.yaw = view.yaw;
    // (the camera up and back, looking down past him)
    view.pitch = 0.45;
    view.zoom = 1.5;
    return { id: e.id, state: e.state, body: e.body };
  });
  check(Boolean(posed), `one in cover to photograph${posed ? ` (${posed.id}, ${posed.state}, ${JSON.stringify(posed.body)})` : ''}`);
  if (posed) {
    // (a few of the page's frames, the camera swung round; the inspector's panel put away)
    await page.getByRole('button', { name: 'Hide' }).first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(6000);
    const png = await page.locator('.cyw').screenshot({ timeout: 90000 });
    await sharp(png).webp({ quality: 82 }).toFile(shot);
    console.log('shot:', shot);
  }
} finally {
  await browser.close();
  await server?.close();
}
check(errors.length === 0, `no errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : '\neverything green');
process.exit(problems.length ? 1 : 0);
