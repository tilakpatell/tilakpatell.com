// What the Road's lab scripts share: a Chromium on the container's software
// GL (or CHROME), a page on the dev server (BASE, else localhost:5173), the
// house's first-visit keys set so no intro or Load 3D card stands in front, and the Road's
// save cleared so no resume card holds the ride.
import { chromium } from 'playwright-core';
import { readdirSync, existsSync } from 'node:fs';

export const BASE = process.env.BASE ?? 'http://localhost:5173';
export const STAGE_IDS = ['hobbiton', 'shire-edge', 'bree', 'weathertop', 'ford', 'rivendell', 'caradhras', 'moria', 'lorien', 'anduin', 'marshes', 'ithilien', 'cirith-ungol', 'gorgoroth', 'minas-tirith', 'havens'];

export async function browser() {
  const exe = process.env.CHROME ?? readdirSync('/opt/pw-browsers').filter((n) => /^chromium-\d+$/.test(n)).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`).find(existsSync);
  return chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
}

export async function open(b, path, { phone = false, quality = process.env.QUALITY ?? 'high' } = {}) {
  const ctx = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 1 });
  await ctx.addInitScript((q) => {
    localStorage.setItem('tp-intro', '1');
    localStorage.setItem('tp-start', '"universe"');
    localStorage.setItem('tp-quality', q);
    localStorage.setItem('tp-map3d', 'force');
    // (at low the site holds a heavy world behind its Load 3D card: always load, as the probe does)
    localStorage.setItem('tp-worlds', JSON.stringify('load'));
    localStorage.removeItem('tp-road');
  }, quality);
  const page = await ctx.newPage();
  // the assets' bytes as they arrive (the models come through workers and
  // the loaders' own fetches, which the page's resource timings miss; the
  // code is left out: on the dev server it's hundreds of unbundled modules)
  const assets = { bytes: 0 };
  page.on('response', async (r) => {
    if (!/\/(models|textures|audio|cc0|kit|hdri)\//.test(new URL(r.url()).pathname)) return;
    const body = await r.body().catch(() => null);
    if (body) assets.bytes += body.length;
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?calibrate=off#${path}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__ROAD__ && window.__RUNTIME__?.status === 'on', null, { timeout: 240000 });
  return { ctx, page, errors, assets };
}
