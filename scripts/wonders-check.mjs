/* global window, document */
// A browser check of deep space's wonders (deepspace.js): with the dev server
// up (npx vite --port 5173) and Chrome at $CHROME:
//   OUT=/tmp/shots [BASE=http://localhost:5173] node scripts/wonders-check.mjs [id …]
// BASE is where the dev server is.
// It jumps to each wonder named (every one, given none) from the nav map at
// hyperspeed, checks the ship comes out parked by it, and takes a picture.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', '"universe"');
  window.localStorage.setItem('tp-universe-ship', '"falcon"');
  window.localStorage.setItem('tp-universe-drive', '"hyper"');
  window.localStorage.setItem('tp-universe-panel', '"tucked"');
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${process.env.BASE ?? 'http://localhost:5173'}/?quality=low#/universe`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
await page.waitForTimeout(2000);
const click = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`nothing at ${s}`);
    el.click();
  }, sel);
const WONDERS = await page.evaluate(() => window.__universeDebug.wonders); // ({ id, name, at, reach }: deep.js's, through the scene)
const ids = process.argv.length > 2 ? process.argv.slice(2) : WONDERS.map((w) => w.id);
for (const id of ids) {
  const w = WONDERS.find((o) => o.id === id);
  if (!w) continue;
  // the hyperdrive charges ten seconds between jumps (wall clock)
  await page.waitForFunction(() => { const s = window.__universeDebug.state; return !s.jump && (s.hyperAt === null || performance.now() / 1000 - s.hyperAt > 10.2); }, null, { timeout: 30000 }).catch(() => {});
  await click('.universe-navmap-btn');
  await page.waitForSelector('.navmap', { timeout: 60000 });
  await page.evaluate((n) => [...document.querySelectorAll('.navmap-list button')].find((b) => b.textContent.includes(n))?.click(), w.name);
  await page.waitForTimeout(500);
  await click('.navmap-go');
  const near = w.reach + 80;
  await page.waitForFunction(([at, r]) => { const s = window.__universe().ship; return Math.hypot(s.x - at[0], s.y - at[1], s.z - at[2]) < r; }, [w.at, near], { timeout: 60000 }).catch(() => {});
  const d = await page.evaluate((at) => { const s = window.__universe().ship; return Math.hypot(s.x - at[0], s.y - at[1], s.z - at[2]); }, w.at);
  check(d < near, `${w.name}: parked ${d.toFixed(0)} out (reach ${w.reach.toFixed(0)})`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/wonder-${id}.png`, timeout: 120000 });
}
console.log('errors:', errors);
console.log(problems.length ? `FAILED: ${problems.length}` : 'ALL OK');
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
