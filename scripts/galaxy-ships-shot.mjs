/* global window */
// The galaxy's ships as its battles draw them, one row a kind: the model in
// flight close up and its far copy past LOD_NEAR times its length, from the
// same pose, through galaxy/models.js's own slots (scripts/preview/ships.html,
// the dev server: npx vite --port 5188 --strictPort, with VITE_ASSET_BASE set
// so the game's native cuts come from the bucket). For a change to the
// ships' files: shoot on main, shoot on the branch, then lay the two side by
// side, a row a kind: before close, after close, before far, after far.
//
//   node scripts/galaxy-ships-shot.mjs shoot <out.png> --kinds tie,ywing [--quality mid]
//   node scripts/galaxy-ships-shot.mjs sheet <before.png> <after.png> <out.webp> --kinds tie,ywing [--names mid,high]
//
// (--names heads the two shots' columns, before and after unless given: two
// tiers of one tree are laid side by side the same way)
// shoot prints each row's file, whether it loaded, and its far copy's
// triangles (the page's title).

import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { parseArgs } from './lib/args.mjs';

const W = 320;
const H = 240;
const args = parseArgs(process.argv.slice(2));
const [mode, ...files] = args._;
const kinds = String(args.kinds ?? 'tie').split(',');

if (mode === 'shoot') {
  const [out] = files;
  const base = process.env.BASE ?? 'http://127.0.0.1:5188';
  const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W * 2, height: H * kinds.length } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/scripts/preview/ships.html?kinds=${kinds.join(',')}&quality=${args.quality ?? 'mid'}&w=${W}&h=${H}`);
  await page.waitForFunction(() => window.__done, null, { timeout: 600000 });
  for (const row of JSON.parse(await page.title())) console.log(`${row.kind.padEnd(12)} ${row.real ? 'loaded' : 'NOT LOADED'}${row.lod ? '' : ', no far copy'}  ${row.url}  far ${row.farTris} triangles`);
  await page.screenshot({ path: out });
  if (errors.length) console.log(`page errors: ${errors.slice(0, 5).join(' | ')}`);
  await browser.close();
} else if (mode === 'sheet') {
  const [before, after, out] = files;
  const cell = (png, row, col) => sharp(png).extract({ left: col * W, top: row * H, width: W, height: H }).png().toBuffer();
  const TOP = 28;
  const label = (text) => Buffer.from(`<svg width="${W}" height="${TOP}"><text x="8" y="19" font-family="sans-serif" font-size="15" fill="#d8dee9">${text}</text></svg>`);
  const [a, b] = String(args.names ?? 'before,after').split(',');
  const heads = [`${a}, close`, `${b}, close`, `${a}, far copy`, `${b}, far copy`];
  const layers = heads.map((t, i) => ({ input: label(t), left: i * W, top: 0 }));
  for (const [row, kind] of kinds.entries()) {
    const cells = await Promise.all([cell(before, row, 0), cell(after, row, 0), cell(before, row, 1), cell(after, row, 1)]);
    cells.forEach((input, i) => layers.push({ input, left: i * W, top: TOP + row * H }));
    layers.push({ input: label(kind), left: 0, top: TOP + row * H + H - TOP });
  }
  await sharp({ create: { width: W * 4, height: TOP + H * kinds.length, channels: 3, background: '#05070b' } })
    .composite(layers)
    .webp({ quality: 82 })
    .toFile(out);
  console.log(out);
} else {
  console.log('node scripts/galaxy-ships-shot.mjs shoot <out.png> --kinds … | sheet <before.png> <after.png> <out.webp> --kinds …');
  process.exit(1);
}
