// Scratch measure for lane P8: the main thread's ms a frame spent in
// requestAnimationFrame callbacks, and the callbacks a frame, for a page
// put into a state (a small loop on screen, then scrolled or put away).
// Run from a checkout: node loops-measure.mjs <case ...>  (BASE = a dev server)
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// (the checkout's own packages: this script lives outside it)
const { chromium } = await import(pathToFileURL(resolve('node_modules/playwright-core/index.mjs')).href);

const { findChromium, launchArgs, angleFor } = await import(pathToFileURL(resolve('scripts/lib/chromium.mjs')).href);
let BASE = process.env.BASE;
let server = null;
if (!BASE) {
  const { createServer } = await import(pathToFileURL(resolve('node_modules/vite/dist/node/index.js')).href);
  server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 5295, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
  BASE = 'http://127.0.0.1:5295';
}
const SECS = Number(process.env.SECS ?? 6);

function rafMeter() {
  const raf = window.requestAnimationFrame.bind(window);
  const frames = [];
  let cur = { ms: 0, n: 0 };
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const t0 = performance.now();
      try {
        return cb(t);
      } finally {
        cur.ms += performance.now() - t0;
        cur.n += 1;
      }
    });
  const tick = () => {
    frames.push(cur);
    cur = { ms: 0, n: 0 };
    raf(tick);
  };
  raf(tick);
  window.__meter = {
    reset: () => (frames.length = 0),
    take: () => frames.slice(),
  };
}

const wait = (page, ms) => page.waitForTimeout(ms);
const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : null;
};
async function measure(page, label) {
  await page.evaluate(() => window.__meter.reset());
  await wait(page, SECS * 1000);
  const fs = await page.evaluate(() => window.__meter.take());
  const ms = fs.map((f) => f.ms);
  const n = fs.map((f) => f.n);
  const mean = ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length);
  const sum = ms.reduce((a, b) => a + b, 0);
  const row = { label, frames: fs.length, fps: Math.round(fs.length / SECS), mainMsPerSec: Math.round((sum / SECS) * 10) / 10, medianMs: Math.round(median(ms) * 1000) / 1000, meanMs: Math.round(mean * 1000) / 1000, callbacks: median(n) };
  console.log(JSON.stringify(row));
  return row;
}

const scrollTo = (page, sel, block = 'center') => page.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ block: b }), [sel, block]);
const bottom = (page) => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

const CASES = {
  // the Rick and Morty page: the portal swirl in its hero, then scrolled away
  async portal(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rm-world-canvas[data-on]', { timeout: 240000 });
    await scrollTo(page, '.rm-hero-portal');
    await page.waitForSelector('.rm-hero-portal canvas', { timeout: 60000 });
    await wait(page, 3000);
    await measure(page, 'portal: in view');
    await scrollTo(page, '#rm-board-title', 'start');
    await wait(page, 1500);
    await measure(page, 'portal: scrolled away');
  },
  // the wardrobe over the Rick and Morty world, open
  async wardrobe(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rm-world-canvas[data-on]', { timeout: 240000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(page, 3000);
    await measure(page, 'wardrobe: shut, the world');
    await page.click('button.rm-chip[aria-label^="Wardrobe"]');
    await page.waitForSelector('.rm-wardrobe-panel canvas.rm-wardrobe-canvas', { timeout: 60000 });
    await wait(page, 3000);
    await measure(page, 'wardrobe: open');
  },
  // the universe map's hangar, open
  async hangar(page) {
    await page.goto(`${BASE}/#/universe`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__universe === 'function' && window.__universe().ship, null, { timeout: 240000 });
    await wait(page, 3000);
    await measure(page, 'hangar: shut, the map');
    await page.click('.universe-hangar-btn');
    await page.waitForSelector('canvas.yard-canvas', { timeout: 60000 });
    await wait(page, 3000);
    await measure(page, 'hangar: open');
  },
  // Battlefront's Collection, a hero on its stage
  async collection(page) {
    await page.goto(`${BASE}/#/battlefront`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.bf-start .bf-start-press', { timeout: 240000 });
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-screen$="/MainMenuScreen"]', { timeout: 120000 });
    await wait(page, 2000);
    await measure(page, 'collection: the main menu');
    await page.click('[data-link$="/CharacterScreen"]');
    await page.waitForSelector('.bf-collection-tile[data-character="darthvader"]', { timeout: 60000 });
    await page.click('.bf-collection-tile[data-character="darthvader"]');
    await page.waitForSelector('.bf-collection-stage[data-staged="stage"] canvas', { timeout: 120000 });
    await wait(page, 4000);
    await measure(page, 'collection: Vader on the stage');
  },
};

const browser = await chromium.launch({ executablePath: findChromium(), args: launchArgs({ angle: angleFor(), uncapped: false }) });
try {
  for (const name of process.argv.slice(2)) {
    const ctx = await browser.newContext({ viewport: { width: 1470, height: 956 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      const set = (k, v) => window.localStorage.setItem(k, v);
      set('tp-intro', '1');
      set('tp-start', '"universe"');
      set('tp-sound', 'off');
      set('tp-worlds', JSON.stringify('load'));
      set('tp-software', JSON.stringify('on'));
      set('tp-tour', 'skipped');
      set('tp-universe-ship', JSON.stringify('xwing'));
      window.sessionStorage.setItem('tp-galaxy-intro', '1');
    });
    await ctx.addInitScript(rafMeter);
    const page = await ctx.newPage();
    try {
      await CASES[name](page);
    } catch (e) {
      console.log(JSON.stringify({ label: name, failed: String(e).split('\n')[0] }));
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await server?.close();
}
