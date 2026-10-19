/* global window, document, requestAnimationFrame */
// Screenshots of the cockpit and its launch, for checking how the intro
// looks at a quality level. The cockpit is opened as ⌘K's "Back to the
// cockpit" opens it (a 'tp:cockpit' event, on a light page), drawn a
// graphics chip's way even in software GL (window.__tpRich), and the launch
// held at each moment through its dev hook (window.__tpCockpit.seek). With
// the dev server up:
//
//   OUT=<dir> node scripts/cockpit-shots.mjs [vehicle …]
//
// One PNG a moment, <OUT>/<vehicle>-<moment>.png: `seated` (looking where
// it rests), `sun` (looking up at its sun, where it has one), and the
// launch at MOMENTS. BASE sets the dev server (default http://127.0.0.1:5173),
// QUALITY the level (?quality=, default ultra), CHROME the browser, W and H
// the window (1280 × 720). INFO=1 prints the renderer's counts at each.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173';
const OUT = process.env.OUT ?? '.';
const QUALITY = process.env.QUALITY ?? 'ultra';
const W = Number(process.env.W ?? 1280);
const H = Number(process.env.H ?? 720);
// the launch's moments (ms from Space): the push, the stars stretching, the
// tunnel, just before the flash (the Falcon's plan; cockpit/timeline.js)
const MOMENTS = { push: 1400, stretch: 2050, tunnel: 2500, peak: 2900 };
const VEHICLES = ['falcon', 'xwing', 'cruiser', 'rv'];

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['falcon', 'xwing'];
for (const n of names) if (!VEHICLES.includes(n)) throw new Error(`no vehicle ${n} (there are ${VEHICLES.join(', ')})`);
mkdirSync(OUT, { recursive: true });

const exe = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const settle = (page, ms) => page.waitForTimeout(ms);
// (two frames drawn after a change, so what's shot is what was asked for)
const frames = (page, n = 3) => page.evaluate((k) => new Promise((done) => { let i = 0; const step = () => (++i >= k ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }), n);
try {
  for (const vehicle of names) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      window.localStorage.setItem('tp-intro', '1');
      window.localStorage.setItem('tp-sound', 'off');
      window.localStorage.setItem('tp-tour', 'skipped');
      window.__tpRich = true;
      window.__tpKeepFrames = true;
      window.__tpNoShaderChecks = true;
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`  page error: ${String(e).slice(0, 200)}`));
    await page.goto(`${BASE}/?quality=${QUALITY}#/changes`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    await page.waitForFunction(() => document.querySelector('main'), null, { timeout: 240000 });
    await settle(page, 1500);
    await page.evaluate((v) => window.dispatchEvent(new CustomEvent('tp:cockpit', { detail: { vehicle: v } })), vehicle);
    await page.waitForSelector('.cockpit[data-ready]', { timeout: 300000 });
    // (the black lifted, and the crew's first line said and gone)
    await settle(page, 2500);
    const shot = async (moment) => {
      await frames(page);
      await page.screenshot({ path: `${OUT}/${vehicle}-${moment}.png` });
      if (process.env.INFO) console.log(`  ${vehicle} ${moment}`, JSON.stringify(await page.evaluate(() => window.__tpCockpit?.info?.())));
      console.log(`${OUT}/${vehicle}-${moment}.png`);
    };
    await page.mouse.move(W / 2, H / 2);
    await shot('seated');
    if (vehicle === 'xwing' || vehicle === 'falcon') {
      // (the mouse up and over to where the vehicle's sun is)
      await page.mouse.move(vehicle === 'xwing' ? W * 0.99 : W * 0.25, vehicle === 'xwing' ? H * 0.2 : H * 0.3);
      await settle(page, 1800);
      await shot('sun');
      await page.mouse.move(W / 2, H / 2);
      await settle(page, 1500);
    }
    for (const [moment, ms] of Object.entries(MOMENTS)) {
      await page.evaluate((t) => window.__tpCockpit.seek(t), ms);
      await shot(moment);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
