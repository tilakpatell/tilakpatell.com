#!/usr/bin/env node
/* global window */
// The GPU clock checked against the frame (the GPU-first design’s G1 gate:
// the fixture’s GPU time within 10 % of its frame on the laptop): the lit
// fixture drawn back to back for --ms, each frame’s GPU time read from the
// renderer’s timestamps (src/lib/three/gpuTime.js) beside its time from the
// draw call to the queue done, the medians of both and their ratio.
//
//   node scripts/gpu-clock.mjs [--size 1600x900] [--ms 5000] [--gpu webgpu|webgl] [--tier ultra] [--adapter auto|swiftshader|system]
//
// The frame waited on includes the CPU’s encoding and the wait for the
// queue, so it is the ceiling of the GPU’s share: a GPU time well under it
// is a CPU-bound frame, one over it a clock that is wrong. The cloud’s
// SwiftShader has no timestamp-query (gpu: null); the laptop runs it.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = parseArgs(process.argv.slice(2));
const [width, height] = String(args.size ?? '1600x900').split('x').map(Number);
const leg = args.gpu === 'webgl' ? 'webgl' : 'webgpu';
const ms = Number(args.ms) || 5000;
const { chromium } = await import('playwright-core');
const { adapterFor, angleFor, findChromium, launchArgs } = await import('./lib/chromium.mjs');
const exe = args.chromium ?? findChromium();
if (!exe) {
  console.log('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args: launchArgs({ angle: angleFor(), webgpu: true, adapter: adapterFor({ adapter: args.adapter }), uncapped: true }) });
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const fixture = { tier: typeof args.tier === 'string' ? args.tier : 'ultra' };
  await page.goto(`${base}/scripts/light-fixture/index.html?gpu=${leg}&fixture=${encodeURIComponent(JSON.stringify(fixture))}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__lit?.ready || window.__lit?.error, null, { timeout: 240000 });
  const err = await page.evaluate(() => window.__lit.error);
  if (err) throw new Error(err);
  await page.evaluate(() => window.__lit.draw(60));
  const got = await page.evaluate((t) => window.__lit.gpuClock(t), ms);
  const backend = await page.evaluate(() => window.__lit.backend);
  const ratio = got.gpuMedian != null && got.cpuMedian ? got.gpuMedian / got.cpuMedian : null;
  console.log(JSON.stringify({ _source: `node scripts/gpu-clock.mjs ${process.argv.slice(2).join(' ')} (${new Date().toISOString().slice(0, 10)}, ${process.platform}, ANGLE ${angleFor()})`, backend, size: `${width}x${height}`, ...got, ratio }));
} catch (e) {
  console.log(`FAIL ${String(e.message ?? e).split('\n')[0]}`);
  code = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
