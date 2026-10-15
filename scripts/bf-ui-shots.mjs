#!/usr/bin/env node
/* global document */
// The front end's screens on the canvas, walked and shot in a headless
// browser (the 2026-10-13 canvas design, docs/superpowers/specs/
// 2026-10-13-bf2017-ui-canvas-design.md, its Checks): Start, the main menu
// (HOME), the PLAY tab, SINGLE PLAYER, each at every size asked for (the
// frame's bars show at 2560 × 1080), each picture beside the next for the
// evidence README to set against the game's captures.
//
//   node scripts/bf-ui-shots.mjs [--base http://127.0.0.1:5431] [--out .scratch/bf-ui] [--sizes 1920x1080,2560x1080]
//
// It prints one JSON line: { screens: [{ name, size, firstMs, paintMs,
// missing, errors }] }: `firstMs` the longest paint as the screen arrives
// (its glyphs and pictures drawn the first time), `paintMs` the 95th
// percentile of its paints after (the pointer walked over its cells, each a
// paint: the painter's `bf-ui-paint`), `missing` what the canvas could not
// draw (its `data-missing`: skipped types, unknown shapes, textures with no
// picture). It exits 1 on a page error, or on a screen whose paints after
// arriving pass 2 ms at 1920 × 1080 (the design's number; in the cloud's
// software GL the paints are the CPU's, so read them as an upper bound).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const one = (name, d = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : d;
};
const base = one('base', 'http://127.0.0.1:5431');
const out = one('out', '.scratch/bf-ui');
const sizes = one('sizes', '1920x1080,2560x1080')
  .split(',')
  .map((s) => s.split('x').map(Number));
const BUDGET_MS = 2;
const exe = process.env.CHROME ?? (process.platform === 'linux' ? '/opt/pw-browsers/chromium' : undefined);

// the walk: a screen's name, how to reach it from the one before, the mark it stands on
const WALK = [
  { name: 'start', go: null, mark: '[data-screen$="/PairingScreen"]' },
  { name: 'main-menu', go: (p) => p.keyboard.press('Enter'), mark: '[data-layers*="/StartScreen"]' },
  { name: 'play', go: (p) => p.click('[data-link$="/PlayScreen"]'), mark: '[data-screen$="/PlayScreen"]' },
  { name: 'single-player', go: (p) => p.click('[data-tile="Campaign"]'), mark: '[data-screen$="/PlaySinglePlayerCategoryScreen"]' },
];

const p95 = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))] : null);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: exe, headless: true });
const screens = [];
let failed = false;
for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  await page.goto(`${base}/#/battlefront`, { waitUntil: 'load', timeout: 120000 });
  for (const step of WALK) {
    // (the screen's own paints: from the step that brings it)
    await page.evaluate(() => performance.clearMeasures('bf-ui-paint'));
    if (step.go) await step.go(page);
    await page.waitForSelector(step.mark, { timeout: 60000 });
    // (the fonts, the pictures and the films land, each a paint)
    await page.waitForTimeout(4000);
    const first = await page.evaluate(() => performance.getEntriesByName('bf-ui-paint').map((e) => e.duration));
    const missing = await page.evaluate(() => Number(document.querySelector('.hud-screen-canvas-paint')?.dataset.missing ?? NaN));
    const file = join(out, `${step.name}-${w}x${h}.png`);
    await page.screenshot({ path: file });
    // (then the pointer over its cells, twice round: each a paint of the screen as it stands)
    await page.evaluate(() => performance.clearMeasures('bf-ui-paint'));
    const cells = await page.$$eval('.hud-screen-hit', (bs) => bs.slice(0, 6).map((b) => b.getBoundingClientRect()).map((r) => [r.x + r.width / 2, r.y + r.height / 2]));
    for (let round = 0; round < 2; round++)
      for (const [x, y] of cells) {
        await page.mouse.move(x, y);
        await page.waitForTimeout(80);
      }
    await page.mouse.move(1, 1);
    const after = await page.evaluate(() => performance.getEntriesByName('bf-ui-paint').map((e) => e.duration));
    const r2 = (v) => (v === null ? null : Math.round(v * 100) / 100);
    const paintMs = p95(after);
    screens.push({ name: step.name, size: `${w}x${h}`, firstMs: r2(first.length ? Math.max(...first) : null), paintMs: r2(paintMs), missing, errors: errors.splice(0) });
    if (w === 1920 && h === 1080 && paintMs !== null && paintMs > BUDGET_MS) failed = true;
  }
  if (screens.some((s) => s.errors.length)) failed = true;
  await page.close();
}
await browser.close();
console.log(JSON.stringify({ screens }));
process.exit(failed ? 1 : 0);
