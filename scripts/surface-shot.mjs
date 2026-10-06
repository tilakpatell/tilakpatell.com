/* global window */
// Pictures of a galaxy world from where you choose to stand (the
// checkpoints' before/after shots of the planets overhaul): each view is a
// thing to look at, how far off to stand and from which side (degrees,
// 0 = from +z), the player teleported there facing it, the world given a
// few seconds to settle. Through the dev server (npx vite --port 5188).
//
//   OUT=lab/shots node scripts/surface-shot.mjs <world> <x,z,dist,deg[,label]> …
//   QUALITY=low …  (the device tier)
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
  const held = Date.UTC(2026, 9, 5, 12);
  Date.now = () => held;
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?quality=${quality}#/galaxy/${world}/surface`);
await page.waitForFunction(() => window.__surface?.()?.phase, null, { timeout: 180000 });
await page.waitForTimeout(4000);
// (past the landing: out of the ship and walking)
await page.evaluate(() => window.__surfaceDo('advance', 40));
await page.waitForTimeout(3000);
for (const v of views) {
  const [x, z, dist = 40, deg = 0, label] = v.split(',');
  const a = (Number(deg) * Math.PI) / 180;
  const sx = Number(x) + Math.sin(a) * Number(dist);
  const sz = Number(z) + Math.cos(a) * Number(dist);
  const yaw = Math.atan2(Number(x) - sx, Number(z) - sz);
  await page.evaluate(([sx, sz, yaw]) => window.__surfaceDo('teleport', sx, sz, yaw), [sx, sz, yaw]);
  await page.waitForTimeout(7000);
  const file = `${out}/${world}-${label ?? `${x}_${z}_${deg}`}-${quality}.png`;
  await page.screenshot({ path: file });
  console.log(file);
}
if (errors.length) console.log('errors:', errors.slice(0, 3).join(' | '));
await browser.close();
