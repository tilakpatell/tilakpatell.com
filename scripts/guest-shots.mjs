/* global window */
// Pictures of a guest on the 2017 game's skeleton beside one of the game's
// own troopers, both on the same clips: for judging with the eye what the
// tests say in numbers (a foot under the floor, a gun out of the hand, a
// collapsed sleeve, a head off the neck). It drives scripts/preview/
// guest.html through the dev server, which must be up in the bucket check's
// mode (the trooper's pistol stance and the host hero's pack are in the
// asset bucket):
//
//   node node_modules/vite/bin/vite.js --mode bucketcheck --port 5460 --strictPort --host 127.0.0.1
//   node scripts/guest-shots.mjs <who> <out.png> [--host han] [--shots rest,walk@0,…]
//     [--views front,side] [--look lit|toon|ink] [--gun rk3|none] [--beside <url>|none]
//     [--w 420] [--h 460] [--bones] [--body <id>]
//
// BASE names the server (http://127.0.0.1:5460). It prints, for each
// moment, each figure's lowest foot joint and its weapon socket's distance
// from its wrist.

import { chromium } from 'playwright-core';
import { parseArgs } from './lib/args.mjs';
import { angleFor, findChromium, launchArgs } from './lib/chromium.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5460';
const args = parseArgs(process.argv.slice(2));
const [who, out] = args._;
if (!who || !out) {
  console.error('usage: node scripts/guest-shots.mjs <who> <out.png> [--host han] [--shots rest,walk@0,…] [--views front,side] [--look lit|toon|ink] [--gun rk3|none]');
  process.exit(1);
}
const query = new URLSearchParams({ who });
for (const k of ['host', 'shots', 'views', 'look', 'gun', 'beside', 'w', 'h', 'body', 'tall', 'spread', 'focus']) if (typeof args[k] === 'string') query.set(k, args[k]);
if (args.bones) query.set('bones', '1');

const browser = await chromium.launch({ executablePath: findChromium(), args: launchArgs({ angle: angleFor() }) });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  // (not for the page's load: the dev server builds the site's modules on the first ask, a minute cold)
  await page.goto(`${BASE}/scripts/preview/guest.html?${query}`, { waitUntil: 'commit' });
  await page
    .waitForFunction(() => window.__done, null, { timeout: 300000 })
    .catch((e) => {
      throw new Error(errors[0] ?? e.message);
    });
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: out });
  for (const line of JSON.parse(await page.title())) console.log(line);
  if (errors.length) console.log('errors:', errors.join('\n'));
} finally {
  await browser.close();
}
