// The study’s light and surfaces, shot from the chair (the look view): the
// room, Sting on its peg and drawn, the mithril coat touched, the hearth,
// a candle out, the lantern swinging. With the draws of each, from the dev
// server (BASE, else localhost:5173) on the container’s software GL. Writes
// to OUT (else lab/redbook/out), each name prefixed with TAG (else room).
// `node lab/redbook/room.mjs`.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = process.env.OUT ?? 'lab/redbook/out';
const TAG = process.env.TAG ?? 'room';
mkdirSync(OUT, { recursive: true });

const exe = process.env.CHROME ?? readdirSync('/opt/pw-browsers').filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
const b = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
await ctx.addInitScript((q) => {
  localStorage.setItem('tp-intro', '1');
  localStorage.setItem('tp-start', '"universe"');
  localStorage.setItem('tp-quality', q);
  localStorage.setItem('tp-worlds', JSON.stringify('load'));
}, process.env.QUALITY ?? 'high');
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${BASE}/?calibrate=off#/middle-earth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__REDBOOK__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });

const set = (s) => page.evaluate((x) => window.__REDBOOK__.world.set(x), s);
const frames = (n) => page.evaluate((k) => new Promise((done) => { let i = 0; const f = () => (++i >= k ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name, wait = 600) => {
  await page.waitForTimeout(wait);
  await frames(3);
  const info = await page.evaluate(() => window.__REDBOOK__.info());
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  console.log(name, JSON.stringify({ calls: info.calls, triangles: info.triangles }));
};

await set({ view: 'look' });
await page.waitForTimeout(2500);
await set({ aim: [0, 0] });
await shot('look');
await set({ aim: [-0.45, 0.06] });
await shot('sting');
await set({ act: 'sting' });
await shot('sting-drawn', 900);
await set({ act: 'sting' });
await set({ aim: [-0.62, -0.22] });
await shot('mithril', 1200);
await set({ act: 'mithril' });
await shot('mithril-touched', 500);
await set({ aim: [0.95, -0.3] });
await shot('hearth');
await set({ aim: [0, -0.2], act: 'candles' });
await shot('candle-out');
await set({ act: 'candles' });
await set({ aim: [0.08, 0.2], act: 'lantern' });
await shot('lantern', 700);
if (errors.length) console.log('errors', errors.slice(0, 5));
await b.close();
