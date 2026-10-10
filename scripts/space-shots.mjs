/* global window */
// Shots of a system's space level from Battlefront II (the space lane of the
// fifth design: scripts/bf2017-space.mjs, galaxy/spacePieces.js) and of its
// sky's star field at the panorama's seam (galaxy/sky.js, skyPanorama.js),
// through the dev server (npx vite --port 5188 --strictPort --host 127.0.0.1)
// in headless Chromium, the page's clock held as galaxy-check.mjs holds it.
//
//   node scripts/space-shots.mjs <system> <out dir> [--quality high] [--seam]
//
//   the level: the ship put off the level's middle (places.js's SPACE_LEVELS),
//   facing it, at three distances; --seam: the ship at the system's middle
//   facing −x, where the panorama's u = 0 is (its two edges meet there)

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from './lib/args.mjs';

const args = parseArgs(process.argv.slice(2));
const [id, out = '.'] = args._;
const quality = args.quality ?? 'high';
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
    window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
    window.sessionStorage.setItem('tp-galaxy-intro', '1');
    window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
    const held = Date.UTC(2026, 9, 5, 12);
    Date.now = () => held;
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // (which star field the sky asked for, if any)
  page.on('response', (r) => /\/textures\/galaxy\/sky\/space\//.test(r.url()) && console.log(`star field ${r.status()} ${r.url().split('/').pop()}`));
  page.on('console', async (m) => {
    if (m.type() !== 'error') return;
    const stacks = await Promise.all(m.args().map((a) => a.evaluate((v) => (v instanceof Error ? v.stack : String(v))).catch(() => '')));
    errors.push(`${m.text()} ${stacks.join(' ')}`);
  });
  process.on('exit', () => errors.length && console.log(`errors: ${errors.slice(0, 8).join(' | ')}`));
  await page.goto(`${BASE}/?quality=${quality}&calibrate=off#/galaxy/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__galaxy === 'function' && Boolean(window.__galaxy().system), null, { timeout: 300000 });
  await page.waitForFunction(() => !window.__galaxy().jump, null, { timeout: 120000 }).catch(() => {});
  // (the world up and drawing, as galaxy-check.mjs waits for it)
  await page.waitForFunction(() => !window.__RUNTIME__ || window.__RUNTIME__.status === 'on', null, { timeout: 900000, polling: 2000 });
  await page.waitForTimeout(Number(process.env.WAIT ?? 20000));
  await page.waitForFunction(() => Boolean(window.__galaxyDebug?.state?.world), null, { timeout: 300000, polling: 1000 });
  // (the level's goal, world.js's from places.js's SPACE_LEVELS: its middle, and its reach of a level's 0.6)
  const level = await page.evaluate(() => {
    const g = window.__galaxyDebug.state.world?.goals?.find((x) => x.id === 'space-level');
    return g ? { at: g.at, r: g.reach / 0.6 } : null;
  });
  // (the keys card shut, as a pilot who's flown would have it)
  if ((await page.getAttribute('.galaxy-keysbtn', 'aria-expanded').catch(() => null)) === 'true') await page.click('.galaxy-keysbtn').catch(() => {});
  const poses = [];
  if (args.seam) {
    // (facing −x, the panorama's u = 0: the ship's nose is its −z, so a heading of π/2; level, then a little up and down)
    for (const pitch of [0, 0.35, -0.35]) poses.push({ name: `seam-${pitch}`, x: 0, y: 0, z: 0, heading: Math.PI / 2, pitch });
  } else if (level) {
    for (const k of [2.2, 1.2, 0.5]) {
      const d = level.r * k + 10;
      const [cx, cy, cz] = level.at;
      const x = cx + d * 0.7;
      const z = cz + d * 0.7;
      const y = cy + d * 0.25;
      poses.push({ name: `level-${k}`, x, y, z, heading: Math.atan2(x - cx, z - cz), pitch: -Math.atan2(y - cy, Math.hypot(cx - x, cz - z)) });
    }
  }
  for (const { name, ...pose } of poses) {
    await page.evaluate((p) => {
      const { state } = window.__galaxyDebug;
      const full = { ...p, bank: 0 };
      if (window.__galaxyDebug.pin) window.__galaxyDebug.pin(full);
      else {
        state.auto = null;
        state.ship = { ...state.ship, ...full, speed: 0, rate: 0, tipRate: 0, rollRate: 0 };
      }
      window.__RUNTIME__?.invalidate();
    }, pose);
    await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 8000));
    const file = join(out, `${id}-${quality}-${name}.png`);
    await page.screenshot({ path: file, timeout: 120000 });
    console.log(file);
  }
  if (errors.length) console.log(`errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
} finally {
  await browser.close();
}
