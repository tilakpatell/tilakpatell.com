/* global window */
// Shots of the galaxy surface's effects before and after the 2017 game's
// look (lib/three/fx/gameFx.js), each fired through the dev hook
// window.__surface.fx(name, { look }) at a spot before a held view, once
// with the site's own look alone (`site`, the before) and once in the
// game's (`game`). With the dev server up (npx vite --port 5188):
//   OUT=docs/superpowers/evidence/bf2017-effects node scripts/bf2017-fx-shots.mjs [world] [effect,…]
//   QUALITY=high (the tier), AFTER=0.12 (scene seconds after firing that it is shot)
// One JPEG a world, effect and look: <world>-<effect>-<site|game>.jpg, and
// shots.json with each one's draw calls.

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [world = 'hoth', list = 'impact.snow,impact.stone,impact.metal,impact.sand,blast.grenade,blast.speeder,blast.walker,blast.fighter,push'] = process.argv.slice(2);
const out = process.env.OUT ?? '.';
const quality = process.env.QUALITY ?? 'high';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const after = Number(process.env.AFTER ?? 0.12);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', JSON.stringify('xwing'));
  window.localStorage.setItem('tp-galaxy-panel', JSON.stringify('tucked'));
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
});
const page = await ctx.newPage();
// (a heavy world draws a frame in tens of seconds in software GL)
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
await page.goto(`${base}/?quality=${quality}&calibrate=off#/galaxy/${world}/surface`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__surfaceScene?.renderer && window.__surface), null, { timeout: 240000 });
await page.waitForFunction(() => !window.__RUNTIME__ || window.__RUNTIME__.status === 'on', null, { timeout: 600000, polling: 2000 }).catch(() => {});
await page.waitForTimeout(4000);

// you, set down, and a spot 5 m before a camera 1.9 m up
const spot = await page.evaluate(() => {
  const s = window.__surfaceScene;
  const you = s.you();
  s.put(you.x, you.z);
  const at = [you.x + 4.5, you.z];
  s.view([you.x - 0.5, 1.9, you.z + 0.6], [at[0], 0.3, at[1]]);
  return at;
});
await page.evaluate(() => window.__surface.gameFx.ready);
await page.waitForTimeout(1500);

const rows = [];
for (const name of list.split(',')) {
  for (const look of ['site', 'game']) {
    await page.evaluate(() => window.__surface.gameFx.clear());
    await page.evaluate(() => new Promise((r) => { const f = window.__surfaceScene.renderer.info.render.frame; const w = () => (window.__surfaceScene.renderer.info.render.frame > f + 1 ? r() : setTimeout(w, 50)); w(); }));
    const f0 = await page.evaluate(([n, l, at]) => (window.__surface.fx(n, { look: l, at }), window.__surfaceScene.renderer.info.render.frame), [name, look, spot]);
    // (software GL takes a second or more a frame, and a frame steps the
    // scene 0.05 s at most: wait by its frames, not the wall clock)
    const frames = Math.max(2, Math.round(after / 0.05) + 1);
    await page.waitForFunction(([from, n]) => window.__surfaceScene.renderer.info.render.frame >= from + n, [f0, frames], { timeout: 120000, polling: 50 });
    const file = join(out, `${world}-${name}-${look}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82, timeout: 180000 });
    const calls = await page.evaluate(() => window.__surfaceScene.renderer.info.render.drawCalls ?? window.__surfaceScene.renderer.info.render.calls);
    rows.push({ world, name, look, calls, file });
    console.log(world, name, look, 'calls', calls);
  }
}
writeFileSync(join(out, `shots-${world}.json`), JSON.stringify({ quality, rows, errors }, null, 2));
if (errors.length) console.log('errors:', errors.slice(0, 5));
await browser.close();
