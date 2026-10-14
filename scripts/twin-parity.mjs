/* global window */
// Does a lane T twin draw what its GLSL original drew? Each case in
// scripts/twin-parity/cases.js is built twice in Chromium, once with the
// original on WebGLRenderer and once with the twin on three's node renderer,
// through the same post chain, and the two pictures are diffed (PSNR, the
// share of pixels more than 16/255 off); the floor bake's case diffs its
// mask instead. The world-level check is scripts/gpu-parity.mjs; this one
// says which shader is off when a world is.
//
//   node scripts/twin-parity.mjs                    every case, the node side on WebGL 2
//   node scripts/twin-parity.mjs house sky          the cases whose names hold these
//   GPU=webgpu node scripts/twin-parity.mjs         the node side on WebGPU, where Chromium has an adapter
//   ANGLE=d3d11 GPU=webgpu node scripts/twin-parity.mjs   the same on Windows, where it has one only on the chip
//   CHROMIUM=/path/to/chrome, PORT=5198, OUT=dir (default scripts/twin-parity/out: the pictures)
//
// Exit 1 when a case errors or throws; the numbers are for the reader (a
// twin passes at the parity check's line: 32 dB and under 2 % off).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import librarySlice from './library-slice.mjs';
import { findChromium } from './lib/chromium.mjs';
import { readPng } from './twin-parity/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HERE = join(ROOT, 'scripts/twin-parity');
const OUT = process.env.OUT ?? join(HERE, 'out');
const webgpu = process.env.GPU === 'webgpu';
const want = process.argv.slice(2);
const PORT = Number(process.env.PORT ?? 5198); // (PORT=…: two runs at once)

const psnr = (a, b) => {
  let se = 0;
  let off = 0;
  for (let i = 0; i < a.length; i += 4) {
    let bad = false;
    for (let c = 0; c < 3; c++) {
      const d = a[i + c] - b[i + c];
      se += d * d;
      if (Math.abs(d) > 16) bad = true;
    }
    if (bad) off++;
  }
  const mse = se / ((a.length / 4) * 3);
  return { psnr: mse === 0 ? Infinity : 10 * Math.log10(65025 / mse), off: (100 * off) / (a.length / 4) };
};

const server = await createServer({
  root: HERE,
  publicDir: join(ROOT, 'public'),
  server: { port: PORT, strictPort: true, fs: { allow: [ROOT] } },
  resolve: { dedupe: ['three'] },
  // (the site's virtual:bf2017-published, which a case reaching the
  // galaxy's catalogue imports: without it the whole page failed to load)
  plugins: [librarySlice()],
  logLevel: 'error',
});
await server.listen();
// (ANGLE=d3d11 on Windows for the WebGPU leg: Chromium there offers no
// WebGPU adapter while its GL is SwiftShader's, and three's renderer falls
// back to WebGL 2 without a word, so the "WebGPU" pictures were WebGL 2's)
const angle = process.env.ANGLE ?? 'swiftshader';
const args = ['--use-gl=angle', `--use-angle=${angle}`, '--ignore-gpu-blocklist'];
if (angle === 'swiftshader') args.push('--enable-unsafe-swiftshader');
if (webgpu) args.push('--enable-unsafe-webgpu', '--disable-blink-features=WebGPUExperimentalFeatures');
// (the machine's own Chromium where CHROMIUM is not set: Edge or Chrome on
// Windows, Playwright's on a Mac, /opt/pw-browsers in the cloud; the
// pictures are compared, not timed, so the GL stays SwiftShader's)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? findChromium() ?? '/opt/pw-browsers/chromium', args });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 520, height: 260 } });
  page.on('pageerror', (e) => {
    failed = true;
    console.log('page error:', String(e).slice(0, 2000));
  });
  await page.goto(`http://localhost:${PORT}/${webgpu ? '?gpu=webgpu' : ''}`);
  await page.waitForFunction(() => window.__out?.ready, null, { timeout: 60000 });
  const names = (await page.evaluate(() => window.names)).filter((n) => !want.length || want.some((w) => n.includes(w)));
  const backend = await page.evaluate(() => window.backend);
  console.log(`the node side on ${backend}${webgpu && backend !== 'WebGPU' ? ' (no WebGPU adapter: on Windows, ANGLE=d3d11)' : ''}\n`);
  mkdirSync(OUT, { recursive: true });
  console.log('| Case | Status | PSNR | Off |\n|---|---|---|---|');
  for (const name of names) {
    const r = await page.evaluate((n) => window.runCase(n), name);
    const file = name.replace(/[^a-z0-9-]+/gi, '_');
    let cells = ['', ''];
    if (r.stats) cells = [JSON.stringify(r.stats), ''];
    else {
      const a = await page.locator('#a').screenshot();
      writeFileSync(join(OUT, `${file}-node.png`), a);
      if (r.classic) {
        const b = await page.locator('#b').screenshot();
        writeFileSync(join(OUT, `${file}-glsl.png`), b);
        const d = psnr(readPng(a), readPng(b));
        cells = [`${d.psnr.toFixed(1)} dB`, `${d.off.toFixed(2)} %`];
      }
    }
    if (r.status !== 'ok') failed = true;
    console.log(`| ${name} | ${r.status} | ${cells[0]} | ${cells[1]} |${r.err ? `\n${r.err}` : ''}`);
  }
  const out = await page.evaluate(() => window.__out);
  for (const l of out.log) if (l[0] === 'error') console.log(l.join(' | '));
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
