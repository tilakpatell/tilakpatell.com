/* global window, document */
// A browser check of the map's connections (Universe.jsx, NavMap.jsx): with
// the dev server up (npx vite --port 5173) and Chrome at $CHROME:
//   OUT=/tmp/shots [BASE=http://localhost:5173] node scripts/links-check.mjs
// BASE is where the dev server is.
// A link out to a wonder starts the ship beside it; a star system picked on
// the nav map goes to the gate and on through into the galaxy; the grand
// tour starts, says where it's up to, and Escape stops it.
import { chromium } from 'playwright-core';

const out = process.env.OUT ?? '.';
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/google/chrome/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [];
const problems = [];
const check = (ok, what) => {
  console.log(ok ? 'ok  ' : 'FAIL', what);
  if (!ok) problems.push(what);
};
const open = async (hash, drive = 'hyper') => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((d) => {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"universe"');
    window.localStorage.setItem('tp-universe-ship', '"falcon"');
    window.localStorage.setItem('tp-universe-drive', JSON.stringify(d));
    window.localStorage.setItem('tp-universe-panel', '"open"');
  }, drive);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${process.env.BASE ?? 'http://localhost:5173'}/?quality=low#${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  return page;
};
const click = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error(`nothing at ${s}`);
    el.click();
  }, sel);

// 1. a link out to a wonder
{
  const page = await open('/universe/aurelia');
  const d = await page.evaluate(() => {
    const w = window.__universeDebug.wonders.find((o) => o.id === 'aurelia');
    const s = window.__universe().ship;
    return { d: Math.hypot(s.x - w.at[0], s.y - w.at[1], s.z - w.at[2]), reach: w.reach };
  });
  check(d.d < d.reach + 80, `/universe/aurelia starts the ship beside Aurelia (${d.d.toFixed(0)} out, reach ${d.reach.toFixed(0)})`);
  const card = await page.evaluate(() => document.querySelector('.universe-panel')?.textContent ?? '');
  check(card.includes('Aurelia') && card.includes('Fly here'), 'the panel shows Aurelia, with Fly here');
  await page.screenshot({ path: `${out}/link-aurelia.png`, timeout: 120000 });
  await page.context().close();
}

// 2. a star system through the gate, at hyperspeed
{
  const page = await open('/universe');
  await click(page, '.universe-navmap-btn');
  await page.waitForSelector('.navmap', { timeout: 60000 });
  await page.evaluate(() => [...document.querySelectorAll('.navmap-kinds button')].find((b) => b.textContent.includes('Star systems'))?.click());
  await page.waitForTimeout(300);
  const listed = await page.evaluate(() => [...document.querySelectorAll('.navmap-list button')].map((b) => b.textContent));
  check(listed.some((t) => t.includes('Hoth')) && listed.length === 18, `the nav map lists the galaxy's systems (${listed.length})`);
  await page.evaluate(() => [...document.querySelectorAll('.navmap-list button')].find((b) => b.textContent.includes('Hoth'))?.click());
  await page.waitForTimeout(500);
  const go = await page.textContent('.navmap-go');
  check(go.includes('gate') && go.includes('Hoth'), `the go button reads “${go.trim()}”`);
  await click(page, '.navmap-go');
  await page.waitForFunction(() => window.location.hash.startsWith('#/galaxy/hoth'), null, { timeout: 120000 }).catch(() => {});
  const hash = await page.evaluate(() => window.location.hash);
  check(hash.startsWith('#/galaxy/hoth'), `through the gate: the page is at ${hash}`);
  await page.context().close();
}

// 3. the grand tour
{
  const page = await open('/universe', 'super');
  await click(page, '.universe-navmap-btn');
  await page.waitForSelector('.navmap', { timeout: 60000 });
  const hasTour = await page.evaluate(() => Boolean([...document.querySelectorAll('.navmap-tool')].find((b) => b.textContent.includes('Fly past'))));
  check(hasTour, 'the nav map offers to fly past everything');
  await page.evaluate(() => [...document.querySelectorAll('.navmap-tool')].find((b) => b.textContent.includes('Fly past'))?.click());
  await page.waitForSelector('.universe-tour', { timeout: 30000 }).catch(() => {});
  const pill = await page.evaluate(() => document.querySelector('.universe-tour')?.textContent ?? '');
  check(pill.includes('1 of'), `the tour's pill: “${pill.trim()}”`);
  const going = await page.evaluate(() => window.__universe().auto);
  check(Boolean(going), `the ship is on its way to ${going}`);
  await page.screenshot({ path: `${out}/tour.png`, timeout: 120000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  check(!(await page.evaluate(() => document.querySelector('.universe-tour'))), 'Escape stops the tour');
  await page.context().close();
}

console.log('errors:', errors); // (logged, not failed on: the sandbox's blocked sockets and 404s aren't the map's)
console.log(problems.length ? `FAILED: ${problems.length}` : 'ALL OK');
await browser.close();
process.exit(problems.length ? 1 : 0);
