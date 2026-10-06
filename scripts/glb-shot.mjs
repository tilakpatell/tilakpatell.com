/* global window */
// A model from around it, for judging one (the galaxy's surface models
// against their reference pictures: scripts/meshy-galaxy-buildings.mjs
// sheet): each view a PNG, through the dev server (npx vite --port 5188)
// and scripts/preview/glb-shot.html, in headless Chromium.
//
//   node scripts/glb-shot.mjs <file.glb> <out.png> [three,close,front,side,back,top]
//   shoot(file, views) → [PNG Buffer, …] (one per view), and the model's
//                        size and triangles as `shoot.last`
// The file is any GLB under the project (public/ is served at the root).

import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5188';
const CHROME = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const W = 640;
const H = 480;

export async function shoot(file, views = ['three', 'close']) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const url = `/${rel.startsWith('public/') ? rel.slice('public/'.length) : rel}`;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: W * views.length, height: H } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/scripts/preview/glb-shot.html?url=${encodeURIComponent(url)}&views=${views.join(',')}&w=${W}&h=${H}`);
    await page.waitForFunction(() => window.__done, null, { timeout: 600000 }).catch((e) => {
      throw new Error(`${url}: ${errors[0] ?? e.message}`);
    });
    shoot.last = JSON.parse(await page.title());
    const png = await page.screenshot();
    return Promise.all(views.map((_, i) => sharp(png).extract({ left: i * W, top: 0, width: W, height: H }).png().toBuffer()));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, out, views = 'three,close'] = process.argv.slice(2);
  const shots = await shoot(join(process.cwd(), file), views.split(','));
  await sharp({ create: { width: W * shots.length, height: H, channels: 3, background: '#111' } })
    .composite(shots.map((input, i) => ({ input, left: i * W, top: 0 })))
    .png()
    .toFile(out);
  console.log(out, JSON.stringify(shoot.last));
}
