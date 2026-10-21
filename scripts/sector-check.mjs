/* global window, document */
// A browser check of the Rick and Morty sector (universe/portals.js). With
// the dev server up (npx vite --port 5173):
//   OUT=/tmp/shots [BASE=http://localhost:5173] node scripts/sector-check.mjs [--ship cruiser]
// BASE is where the dev server is.
// It looks at the portal by the Rick and Morty planet, has the autopilot fly
// from the home system to Gazorpazorp (through the portal on the way, out by
// the Citadel, on from there on super speed), opens the nav map there, sets
// the ship down, flies to the Citadel, then home in one go back through the
// Citadel's portal: a screenshot at each (in OUT, else a folder of its own
// in the system's temp, never the checkout), what failed, and any errors.
// Headless Chromium draws in software, slowly: the waits are long.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const ship = flag('--ship', 'cruiser');
const out = process.env.OUT ?? join(tmpdir(), 'sector-check');
mkdirSync(out, { recursive: true });
console.log('shots in', out);
const URL = `${process.env.BASE ?? 'http://localhost:5173'}/?quality=low#/universe`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript((s) => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify(s));
}, ship);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(`${m.type()}: ${m.text()}`));
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
let failed = 0;
const say = (ok, what) => {
  if (!ok) failed++;
  console.log(ok ? 'ok  ' : 'FAIL', what);
};
const where = () => page.evaluate(() => {
  const s = window.__universeDebug.state;
  return { x: s.ship.x, y: s.ship.y, z: s.ship.z, at: s.at, auto: s.auto?.id ?? null, note: s.note?.text ?? null };
});
const until = (fn, arg, seconds) => page.waitForFunction(fn, arg, { timeout: seconds * 1000, polling: 500 }).then(() => true, () => false);

// a look at a portal: the ship put still a way off it, facing it
const lookAt = (id) => page.evaluate((pid) => {
  const d = window.__universeDebug;
  const w = d.wonders.find((x) => x.id === pid);
  const s = d.state.ship;
  d.state.ship = { ...s, x: w.at[0] + 60, y: w.at[1] + 4, z: w.at[2] + 20, heading: Math.atan2(60, 20), speed: 0, vy: 0, pitch: 0, bank: 0 };
}, id);
await lookAt('rmportal');
await page.waitForTimeout(4000);
await shot('sector-0-portal');

// 1. from the home system to Gazorpazorp in one go: the autopilot takes the
// portal on the way (nav.js legOf), and on from the Citadel's side
say(await page.evaluate(() => window.__universeDebug.travel('gazorpazorp', 'super')), 'autopilot to Gazorpazorp, from home');
say(await until(() => window.__universeDebug.state.ship.z < -20000, null, 400), 'through the portal into the sector on the way');
let w = await where();
console.log('     out at', w.x.toFixed(0), w.y.toFixed(0), w.z.toFixed(0), '·', w.note, '· going on to', w.auto);
say(w.auto === 'gazorpazorp', 'going on to Gazorpazorp from the far side');
say(await until(() => window.__universeDebug.state.at === 'gazorpazorp' && !window.__universeDebug.state.auto, null, 400), 'at Gazorpazorp');
await shot('sector-2-gazorpazorp');

// the nav map, in the sector: its own chart
await page.keyboard.press('m');
await page.waitForTimeout(2500);
say(await page.evaluate(() => document.querySelector('.navmap-views [aria-pressed="true"]')?.textContent === 'The Curve'), 'the nav map opens on the sector’s chart');
await shot('sector-2-navmap');
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);

// down onto Gazorpazorp
const landed = await page.evaluate(() => window.__universeDebug.startFoot());
say(landed, 'landing on Gazorpazorp');
if (landed) {
  say(await until(() => window.__universeDebug.foot.phase === 'walk', null, 180), 'crew out on Gazorpazorp');
  await page.waitForTimeout(4000);
  await shot('sector-2-down');
  await page.evaluate(() => window.__universeDebug.foot.end());
  await until(() => !window.__universeDebug.foot.phase, null, 60);
  await page.waitForTimeout(2000);
}

// 2. the Citadel, close
say(await page.evaluate(() => window.__universeDebug.travel('citadel', 'super')), 'autopilot to the Citadel');
// (a wonder isn't somewhere the ship's `at`, as a planet is: parked off it, the autopilot done)
say(
  await until(() => {
    const d = window.__universeDebug;
    const w = d.wonders.find((x) => x.id === 'citadel');
    const s = d.state.ship;
    return !d.state.auto && Math.hypot(s.x - w.at[0], s.y - w.at[1], s.z - w.at[2]) < w.reach + 60;
  }, null, 300),
  'at the Citadel',
);
await page.waitForTimeout(2000);
await shot('sector-1-citadel');

// 3. home in one go, back through the Citadel's portal
await lookAt('rmportal-back');
await page.waitForTimeout(4000);
await shot('sector-3-portal-home');
say(await page.evaluate(() => window.__universeDebug.travel('home', 'super')), 'autopilot home');
say(await until(() => window.__universeDebug.state.ship.z > -20000, null, 400), 'back through into the main map');
w = await where();
console.log('     out at', w.x.toFixed(0), w.y.toFixed(0), w.z.toFixed(0), '·', w.note);
// (the longest leg: out of the portal by the Rick and Morty planet, and the whole way in; slow in software GL)
say(await until(() => window.__universeDebug.state.at === 'home' && !window.__universeDebug.state.auto, null, 1200), 'home');
await shot('sector-4-home');

console.log(errors.length ? `${errors.length} errors:\n${[...new Set(errors)].slice(0, 30).join('\n')}` : 'no errors');
await browser.close();
process.exit(failed ? 1 : 0);
