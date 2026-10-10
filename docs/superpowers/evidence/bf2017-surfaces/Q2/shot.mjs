// Lane Q2's shots: ground.html (beside this) through the dev server, each
// view with the flat material (before/) and the layered one (after/), per
// tier, and the frame table into frames-<tiers>-<gpu>.json. Headless Chromium on SwiftShader:
// the WebGL 2 leg; the WebGPU leg runs on the owner's laptop (GPU=webgpu).
//
//   npx vite --port 5188 --strictPort --host 127.0.0.1 &
//   node docs/superpowers/evidence/bf2017-surfaces/Q2/shot.mjs [views] [tiers]

import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const views = (process.argv[2] ?? 'field2,field50,trench,ridge').split(',');
const tiers = (process.argv[3] ?? 'ultra').split(',');
const gpu = process.env.GPU ?? 'webgl';
const base = process.env.BASE ?? 'http://127.0.0.1:5188';
const chrome = process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
for (const d of ['before', 'after']) mkdirSync(join(here, d), { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 300)));
const rows = [];
for (const tier of tiers) {
  for (const view of views) {
    for (const mat of ['flat', 'layered']) {
      await page.goto(`${base}/docs/superpowers/evidence/bf2017-surfaces/Q2/ground.html?gpu=${gpu}&mat=${mat}&tier=${tier}&view=${view}`);
      await page.waitForFunction(() => window.__q2?.ready, null, { timeout: 600000 });
      const r = await page.evaluate(() => window.__q2);
      const file = join(here, mat === 'flat' ? 'before' : 'after', `${view}-${tier}-${gpu}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 85 });
      rows.push(r);
      console.log(JSON.stringify(r));
    }
  }
}
writeFileSync(join(here, `frames-${tiers.join('-')}-${gpu}.json`), JSON.stringify(rows, null, 1) + '\n');
await browser.close();
