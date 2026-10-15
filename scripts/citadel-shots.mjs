/* global window, document */
// Screenshots of the Citadel of Ricks (#/c-137/citadel) and Mortytown under
// it, from where Rick stands, for checking how a place looks. Rick is put at
// each view through the dev hook (window.__CITADEL__: its `down()` takes the
// lift to Mortytown, which is built the first time), and each shot waits a
// few frames once he's there. With the dev server up:
//
//   OUT=<dir> node scripts/citadel-shots.mjs [name …]
//
// One PNG a view, <OUT>/<name>.png, of the world without its HUD (HUD=1
// keeps it). BASE sets the dev server (default http://127.0.0.1:5197),
// CHROME the browser (else the sandbox's Chromium, else a local Edge or
// Chrome), W and H the window (1280 × 720), FRAMES how many frames to wait.
// INFO=1 prints the renderer's counts at each view.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197';
const OUT = process.env.OUT ?? '.';
const W = Number(process.env.W ?? 1280);
const H = Number(process.env.H ?? 720);
const FRAMES = Number(process.env.FRAMES ?? 14);
const N = Math.PI / 2; // facing north (a heading turns +x round to (cos face, -sin face))
const E = 0;

// Where Rick stands for each view: `where` (the concourse or Mortytown, each
// in its own frame), [x, z, face], and the camera's [turn from behind him,
// pitch] if it's swung round. `done`: quests to mark done first (the Locos
// are out once the day care's done); `hunt`: walk the hunt's Locos out of
// their alleys to follow him, as if he'd found them.
export const VIEWS = {
  // on the concourse, the lift's doors ahead in the south-west shopfronts
  lift: { where: 'concourse', at: [-22, 22, -2.36], cam: [0, 0.25] },
  // out of the lift, looking east down Mortytown's street
  mortytown: { where: 'mortytown', at: [-52, 0, E], cam: [0, 0.2] },
  // in the road by The Creepy Morty, Big Morty on his stool at its door
  club: { where: 'mortytown', at: [-21, 1.5, N + 0.25], cam: [0.15, 0.22] },
  // Morty Mart from across the road, Cop Morty and his partner at the kerb
  mart: { where: 'mortytown', at: [41, -3.5, -N], cam: [0, 0.2] },
  // up the side street to Simple Rick's back door
  dock: { where: 'mortytown', at: [-8, -12, N], cam: [0, 0.22] },
  // at an alley's mouth, looking down it to the dead end
  alley: { where: 'mortytown', at: [-36, -11, N], cam: [0, 0.25] },
  // the length of the street from the east end, back to the lift
  east: { where: 'mortytown', at: [52, 0, Math.PI], cam: [0, 0.3] },
  // three Locos following him up the road to Cop Morty
  hunt: { where: 'mortytown', at: [20, 1.5, E], cam: [0.5, 0.3], done: ['daycare'], hunt: true },
};

const names = process.argv.slice(2);
for (const n of names) if (!VIEWS[n]) throw new Error(`no view ${n} (there are ${Object.keys(VIEWS).join(', ')})`);
mkdirSync(OUT, { recursive: true });

const exe = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"home"');
  window.localStorage.setItem('tp-worlds', '"load"');
  window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
await page.goto(`${BASE}/#/c-137/citadel`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__CITADEL__?.api || document.querySelector('.citadel-world')?.dataset.mode === 'cards', null, { timeout: 600000, polling: 1000 });
if (!(await page.evaluate(() => Boolean(window.__CITADEL__?.api)))) throw new Error(`the 3D Citadel didn't start (${errors.slice(0, 3).join('; ') || 'no errors'})`);
await page.evaluate(() => document.querySelector('.citadel-world')?.scrollIntoView({ block: 'start' }));
if (!process.env.HUD) await page.addStyleTag({ content: '.citadel-stage > :not(.shire-canvas), .guide-btn, .guide-nudge { visibility: hidden !important; }' });

const frames = async (n) => {
  const f0 = await page.evaluate(() => window.__CITADEL__.sim.frame);
  await page.waitForFunction((f) => window.__CITADEL__.sim.frame >= f, f0 + n, { timeout: 300000, polling: 100 });
};

for (const name of names.length ? names : Object.keys(VIEWS)) {
  const v = VIEWS[name];
  if (v.done) await page.evaluate((ids) => ids.forEach((id) => window.__CITADEL__.complete(id)), v.done);
  const where = await page.evaluate(() => window.__CITADEL__.sim.where);
  if (v.where === 'mortytown' && where !== 'mortytown') {
    await page.evaluate(() => window.__CITADEL__.down());
    await page.waitForFunction(() => window.__CITADEL__.sim.where === 'mortytown', null, { timeout: 600000, polling: 250 });
  } else if (v.where === 'concourse' && where !== 'concourse') await page.evaluate(() => window.__CITADEL__.up());
  await page.evaluate(
    ([x, z, face, cam, hunt]) => {
      const s = window.__CITADEL__.sim;
      s.h = { ...s.h, x, z, face, vx: 0, vz: 0, speed: 0 };
      s.yaw = Math.atan2(-Math.cos(face), Math.sin(face)) + (cam?.[0] ?? 0);
      s.pitch = cam?.[1] ?? 0.32;
      s.dragAt = s.t + 30; // (the camera stays where it's put)
      if (hunt) {
        // the Locos out of their alleys, in a line behind him
        s.hunt.locos.forEach((l, i) => Object.assign(l, { state: 'following', order: i, x: x - 1.6 * (i + 1) * Math.cos(face), z: z + 1.6 * (i + 1) * Math.sin(face) + (i % 2 ? 0.4 : -0.4), face }));
        s.hunt.found = 3;
      }
    },
    [...v.at, v.cam ?? null, Boolean(v.hunt)],
  );
  await frames(FRAMES);
  await page.waitForTimeout(800);
  await page.locator('.citadel-stage .shire-canvas').screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  if (process.env.INFO) console.log(name, JSON.stringify(await page.evaluate(() => window.__CITADEL__.api.info())));
  console.log(`${OUT}/${name}.png`);
}
if (errors.length) console.log('errors', errors.slice(0, 8));
await browser.close();
