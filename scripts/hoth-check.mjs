/* global window */
// Hoth, every one of them a model (docs/superpowers/specs/2026-10-09-hoth-design.md,
// section 1.7): lands on Hoth, waits, and counts its people by kind (made,
// rigged) and every object in the scene built in code (`userData.built`,
// surface/cast.js's mark); goes into Echo Base and counts again; then
// opens the Battle of Hoth, picks a side, deploys, and counts again. Fails
// (exit 1) if anything built is drawn, a person has no figure after the
// wait, or a ride has none. Through the dev server (npm run dev).
//
// Since 2026-10-13 Hoth's surface address goes on to the game's menu
// (src/components/galaxy/gameLevels.js): the surface is kept in the tree for
// the free roam to come and has no route until then, so this says so and
// stops (exit 2) rather than wait out the landing.
//
//   node scripts/hoth-check.mjs
//   QUALITY=low …   BASE=http://localhost:5173 …   CHROME=<chromium> …
//   WAIT=30000 …    (ms each count waits for the figures to come in)
//   PHASE_WAIT=900000 …  (ms for the landing: the level pack in software GL takes minutes)
// The clock is held and the random numbers seeded as surface-shot.mjs does.

import { chromium } from 'playwright-core';
import { homedir } from 'node:os';

const quality = process.env.QUALITY ?? 'high';
const base = process.env.BASE ?? 'http://localhost:5173';
const chrome = process.env.CHROME ?? `${homedir()}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const wait = Number(process.env.WAIT ?? 30000);

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=metal', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-universe-ship', '"xwing"');
  localStorage.setItem('tp-galaxy-panel', '"tucked"');
  sessionStorage.setItem('tp-galaxy-intro', '1');
  localStorage.setItem('tp-worlds', JSON.stringify('load'));
  const held = Date.UTC(2026, 9, 5, 12);
  Date.now = () => held;
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const collect = () =>
  page.evaluate(() => {
    const by = {};
    for (const a of window.__surface().people) {
      by[a.kind] ??= { n: 0, fig: 0, rigged: 0 };
      by[a.kind].n++;
      if (a.fig) by[a.kind].fig++;
      if (a.rigged) by[a.kind].rigged++;
    }
    const built = [];
    window.__surfaceScene.scene.traverse((o) => {
      if (!o.userData?.built) return;
      const path = [];
      for (let p = o; p && path.length < 4; p = p.parent) if (p.name) path.push(p.name);
      built.push(path.join('<') || '(unnamed)');
    });
    return { by, built, rides: window.__surface().rides };
  });

let failed = false;
const report = (label, got) => {
  console.log(`\n── ${label} (${quality}) ──`);
  for (const [kind, c] of Object.entries(got.by).sort()) console.log(`${kind.padEnd(14)} ${String(c.n).padStart(3)} made ${String(c.fig).padStart(3)} rigged ${String(c.rigged).padStart(3)}${c.fig < c.n ? '  ← missing' : ''}`);
  console.log(`built: ${got.built.length ? got.built.join(', ') : 'none'}`);
  const bare = got.rides.filter((r) => !r.built);
  if (bare.length) console.log(`rides with no figure: ${bare.map((r) => r.kind).join(', ')}`);
  if (got.built.length || bare.length || Object.values(got.by).some((c) => c.fig < c.n)) failed = true;
};

const land = async (hash) => {
  await page.goto(`${base}/?quality=${quality}#${hash}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => window.__surface?.()?.phase || !window.location.hash.includes('/surface'), null, { timeout: Number(process.env.PHASE_WAIT ?? 180000) });
  if (!page.url().includes('/surface')) {
    console.log(`\nNo surface at ${hash}: it went on to ${page.url().replace(base, '')} (the game's menu). Nothing to count until Hoth's free roam has a route.`);
    await browser.close();
    process.exit(2);
  }
};

// ── out on the ice ──
await land('/galaxy/hoth/surface');
await page.waitForTimeout(4000);
for (let i = 0; i < 5 && (await page.evaluate(() => window.__surface?.()?.phase)) !== 'walk'; i++) {
  await page.evaluate(() => window.__surfaceDo('advance', 40));
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(wait);
report('the ice fields', await collect());

// ── inside Echo Base ──
await page.evaluate(() => window.__surfaceDo('zone', 'echo'));
await page.waitForTimeout(wait / 2);
report('Echo Base', await collect());

// ── the Battle of Hoth ──
await land('/galaxy/hoth/surface?mission=assault');
const started = await page
  .waitForFunction(() => window.__surface?.()?.mission?.phase === 'choose', null, { timeout: 240000 })
  .then(() => true)
  .catch(() => false);
if (!started) {
  console.log('\nFAIL: the Battle of Hoth never opened');
  failed = true;
}
await page.evaluate(() => window.__surfaceDo('missionDo', 'side', 'defend'));
await page.waitForTimeout(1500);
await page.evaluate(() => window.__surfaceDo('missionDo', 'deploy', 'trenches'));
await page.waitForTimeout(wait);
report('the Battle of Hoth', await collect());

if (errors.length) console.log('\npage errors:', errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? '\nFAIL: something on Hoth is built, or missing' : '\nOK: everyone on Hoth is a model');
process.exit(failed ? 1 : 0);
