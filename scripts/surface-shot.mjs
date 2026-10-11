/* global window */
// Pictures of a galaxy world from where you choose to stand (the
// checkpoints' before/after shots of the planets overhaul): each view is a
// thing to look at, how far off to stand and from which side (degrees,
// 0 = from +z), the player teleported there facing it, the world given a
// few seconds to settle. Through the dev server (npx vite --port 5188).
//
//   OUT=lab/shots node scripts/surface-shot.mjs <world> <x,z,dist,deg[,label]> …
//   QUALITY=low …  (the device tier)
//   PHASE_WAIT=600000 …  (ms to wait for the landing: a level pack under
//                  software rendering takes minutes)
//   ZONE=<id> …    (inside a zone: its id, the views then in the room's own
//                  frame, through the dev hook __surfaceDo('zone', id))
//   LOAD_WAIT=<ms> …  (how long a heavy world may take to load: 180000 by default)
//   ROUTE_QUERY=<k=v&…> … (the route's own query, after the hash: district=base)
//   LEVEL_WAIT=<ms> … (how long a game level may take to stream in round a view)
//   QUERY=<k=v&…> …  (more of the page's query: gamelight=off, the site's
//                  own light, for a before shot)
//   WEATHER=<state> …  (clear, dusk, overcast, storm: the level's weather,
//                  where the game lights the world, at once)
// The clock is held and the random numbers seeded as galaxy-check does, so
// two runs see the same.

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [world, ...views] = process.argv.slice(2);
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-universe-ship', '"xwing"');
  localStorage.setItem('tp-galaxy-panel', '"tucked"');
  sessionStorage.setItem('tp-galaxy-intro', '1');
  localStorage.setItem('tp-worlds', JSON.stringify('load')); // (the 3D, without the gate's asking)
  const held = Date.UTC(2026, 9, 5, 12);
  Date.now = () => held;
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?quality=${quality}${process.env.QUERY ? `&${process.env.QUERY}` : ''}#/galaxy/${world}/surface${process.env.ROUTE_QUERY ? `?${process.env.ROUTE_QUERY}` : ''}`);
await page.waitForFunction(() => window.__surface?.()?.phase, null, { timeout: Number(process.env.PHASE_WAIT ?? process.env.LOAD_WAIT ?? 180000) });
await page.waitForTimeout(4000);
// (past the landing: out of the ship and walking)
await page.evaluate(() => window.__surfaceDo('advance', 40));
await page.waitForTimeout(3000);
// (still landing: on a world with a long way down, more of it)
for (let i = 0; i < 4 && (await page.evaluate(() => window.__surface?.()?.phase)) !== 'walk'; i++) {
  await page.evaluate(() => window.__surfaceDo('advance', 30));
  await page.waitForTimeout(2000);
}
console.log('phase', await page.evaluate(() => window.__surface?.()?.phase));
// (the floor's light baked, if the world has one: a shot before it lands is
// the world without its shadows; one with no ground runs out the clock)
await page.waitForFunction(() => Boolean(window.__surfaceScene?.api?.ground?.stats?.baked), null, { timeout: Number(process.env.BAKE_WAIT ?? 150000), polling: 1000 }).catch(() => {});
if (process.env.WEATHER) console.log('weather', JSON.stringify(await page.evaluate((w) => window.__surfaceDo('weather', w, 0), process.env.WEATHER)));
const zone = process.env.ZONE ?? null;
let origin = [0, 0];
if (zone) {
  origin = await page.evaluate((id) => {
    window.__surfaceDo('zone', id);
    const z = window.__surface().zoneOrigin ?? [0, 0, 0];
    return [z[0], z[2]];
  }, zone);
  await page.waitForTimeout(4000);
}
for (const v of views) {
  const [x0, z0, dist = 40, deg = 0, label] = v.split(',');
  const x = Number(x0) + origin[0];
  const z = Number(z0) + origin[1];
  const a = (Number(deg) * Math.PI) / 180;
  const sx = x + Math.sin(a) * Number(dist);
  const sz = z + Math.cos(a) * Number(dist);
  const yaw = Math.atan2(x - sx, z - sz);
  await page.evaluate(([sx, sz, yaw]) => window.__surfaceDo('teleport', sx, sz, yaw), [sx, sz, yaw]);
  await page.waitForTimeout(7000);
  // (on a game level: its cells round the new spot streamed in, LEVEL_WAIT ms at most)
  await page.waitForFunction(() => window.__surfaceScene?.level?.()?.ready !== false, null, { timeout: Number(process.env.LEVEL_WAIT ?? 600000) }).catch(() => console.log('  (the level still streaming: shot as it stands)'));
  const file = `${out}/${world}-${zone ? `${zone}-` : ''}${label ?? `${x0}_${z0}_${deg}`}-${quality}.png`;
  await page.screenshot({ path: file, timeout: 180000 });
  console.log(file);
}
if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | '));
await browser.close();
