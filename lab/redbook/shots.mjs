// The Red Book’s screenshots: the arrival, the open book, a page mid-book,
// the Ring on, the stone up, desktop (1440 × 900) and phone (390 × 844),
// with the draws and triangles of each, from the dev server (BASE, else
// localhost:5173), on the container’s software GL. Writes to OUT (else
// lab/redbook/out). `node lab/redbook/shots.mjs [phone]`.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'lab/redbook/out';
const phone = process.argv.includes('phone');
mkdirSync(OUT, { recursive: true });

const exe = process.env.CHROME ?? readdirSync('/opt/pw-browsers').filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

async function open(path, { reduced = true } = {}) {
  const ctx = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((q) => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', q);
    localStorage.setItem('tp-worlds', JSON.stringify('load'));
  }, process.env.QUALITY ?? 'high');
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => (errors.push(e.message), console.log('pageerror', e.message)));
  page.on('framenavigated', (f) => f === page.mainFrame() && console.log('navigated', f.url()));
  page.on('console', (m) => m.type() === 'error' && (errors.push(m.text()), console.log('console.error', m.text().slice(0, 400))));
  await page.goto(`${BASE}/?calibrate=off#${path}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__REDBOOK__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
  return { ctx, page, errors };
}

const frames = (page, n) => page.evaluate((k) => new Promise((done) => { let i = 0; const f = () => (++i >= k ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const tag = phone ? 'phone' : 'desk';
const shot = async (page, name) => {
  await frames(page, 3);
  const info = await page.evaluate(() => window.__REDBOOK__.info());
  await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  console.log(name, JSON.stringify(info));
};

// the arrival, as it plays
{
  const { ctx, page, errors } = await open('/middle-earth', { reduced: false });
  await page.waitForTimeout(Number(process.env.ARRIVE ?? 6000));
  await shot(page, 'arrival');
  if (errors.length) console.log('errors', errors.slice(0, 5));
  await ctx.close();
}
// the rest, set at once
{
  const { ctx, page, errors } = await open('/middle-earth');
  const set = (s) => page.evaluate((x) => window.__REDBOOK__.world.set(x), s);
  await frames(page, 4);
  await shot(page, 'bag-end');
  for (const p of (process.env.PAGES ?? 'bree,moria,beacons').split(',')) {
    await set({ page: p });
    await frames(page, 4);
    await shot(page, p);
  }
  // a page in the air, going over from Bree to Weathertop
  await set({ turning: [2, 3, 0.55] });
  await frames(page, 4);
  await shot(page, 'turn');
  await set({ page: 'weathertop', worn: true });
  await frames(page, 4);
  await shot(page, 'ring');
  await set({ worn: false, stone: true, gaze: 3 });
  await page.waitForTimeout(1500);
  await shot(page, 'stone');
  await set({ stone: true, gaze: 12 });
  await page.waitForTimeout(800);
  await shot(page, 'stone-seen');
  await set({ stone: false, view: 'look' });
  await page.waitForTimeout(2500);
  await shot(page, 'look');
  await page.evaluate(() => window.__REDBOOK__.world.drag(-420, 0));
  await page.waitForTimeout(1500);
  await shot(page, 'look-hearth');
  await page.evaluate(() => window.__REDBOOK__.world.drag(840, 0));
  await page.waitForTimeout(1500);
  await shot(page, 'look-door');
  await set({ view: 'window' });
  await page.waitForTimeout(6000);
  await shot(page, 'window');
  await set({ view: 'book', ringHeld: true });
  await page.waitForTimeout(2000);
  await shot(page, 'ring-held');
  await set({ ringFire: true, view: 'look' });
  await page.waitForTimeout(2500);
  await shot(page, 'ring-fire');
  if (errors.length) console.log('errors', errors.slice(0, 5));
  await ctx.close();
}
await b.close();
