/* global window */
// A capital ship close, four ways, as the battles draw it (scripts/preview/
// capitals.html through the dev server: npx vite --port 5188 --strictPort,
// with VITE_ASSET_BASE set so a desktop's cuts come from the bucket). For a
// change to the capitals' look or their parts: shoot before, shoot after.
//
//   node scripts/capitals-shot.mjs <out.png> --kind destroyer [--quality high] [--break gen-port,bridge] [--split 12] [--views nose] [--with xwing] [--hits]
//
// It prints the file the kind drew, whether it loaded, and the parts it has
// (galaxy/capitalParts.js), and saves the four views as one picture.

import { chromium } from 'playwright-core';
import { parseArgs } from './lib/args.mjs';

const args = parseArgs(process.argv.slice(2));
const [out] = args._;
if (!out) {
  console.log('node scripts/capitals-shot.mjs <out.png> --kind destroyer [--quality high] [--break gen-port]');
  process.exit(1);
}
const W = Number(args.w ?? 640);
const H = Number(args.h ?? 360);
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W * 2, height: H * 2 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const q = new URLSearchParams({ kind: String(args.kind ?? 'destroyer'), quality: String(args.quality ?? 'high'), w: String(W), h: String(H), break: String(args.break ?? ''), views: String(args.views ?? ''), split: String(args.split ?? 0) });
if (args.with) q.set('with', String(args.with));
if (args.hits) q.set('hits', '1');
await page.goto(`${base}/scripts/preview/capitals.html?${q}`);
await page.waitForFunction(() => window.__done, null, { timeout: 600000 });
const said = JSON.parse(await page.title());
console.log(`${said.kind.padEnd(12)} ${said.real ? 'loaded' : 'NOT LOADED'}  ${said.url}  parts: ${said.parts.join(', ') || 'none'}`);
await page.screenshot({ path: out });
if (errors.length) console.log(`page errors: ${errors.slice(0, 5).join(' | ')}`);
await browser.close();
