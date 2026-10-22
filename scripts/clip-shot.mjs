/* global window */
// A figure's clips at four moments each, a row a clip, for judging how a
// Meshy figure moves (scripts/meshy-invincible.mjs's anims), through the dev
// server (npx vite --port 5188) and scripts/preview/clip-shot.html.
//
//   node scripts/clip-shot.mjs <file.glb> <out.png> [clip,clip…] [--pack <clips.glb>] [--cell 240x320] [--still]
//
//   pack   the clips from this pack rather than the file (a 2017 figure’s
//          body has none: its rig’s clips-<rig>.glb, played on it by bone
//          name, as the site plays them). A file with no clips at all is
//          shot as one row from four sides, to stand beside one that walks.
//   cell   each picture’s size (a beast, longer than it is tall: 360x240)
//   still  the file as a statue whatever clips it has (one that turns it
//          off its feet without the site’s own placing, the remaster’s bantha)
//
// The browser: CHROMIUM or CHROME, else the machine’s own (scripts/lib/
// chromium.mjs), else the cloud’s; always on SwiftShader, so a sheet is the
// same picture wherever it is made.

import { chromium } from 'playwright-core';
import { join, relative } from 'node:path';
import { parseArgs } from './lib/args.mjs';
import { findChromium } from './lib/chromium.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = findChromium() ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = parseArgs(process.argv.slice(2));
const [file, out, clips = ''] = args._;
// a file’s address on the dev server: public/’s at the site’s root
const siteUrl = (f) => {
  const rel = relative(process.cwd(), join(process.cwd(), f)).split('\\').join('/');
  return `/${rel.startsWith('public/') ? rel.slice('public/'.length) : rel}`;
};
const url = siteUrl(file);
const [cw, ch] = typeof args.cell === 'string' ? args.cell.split('x').map(Number) : [240, 320];
const cell = `&w=${cw}&h=${ch}${args.still ? '&still' : ''}`;
const pack = typeof args.pack === 'string' ? `&pack=${encodeURIComponent(siteUrl(args.pack))}` : '';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: cw * 4, height: 2400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/scripts/preview/clip-shot.html?url=${encodeURIComponent(url)}${pack}${cell}${clips ? `&clips=${clips}` : ''}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 300000 }).catch((e) => {
    throw new Error(errors[0] ?? e.message);
  });
  const canvas = await page.$('canvas');
  await canvas.screenshot({ path: out });
  console.log(out, await page.title());
} finally {
  await browser.close();
}
