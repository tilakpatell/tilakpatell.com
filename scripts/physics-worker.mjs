#!/usr/bin/env node
/* global window */
// GPU-first lane N5: the physics worker in a real browser. One scene (a
// floor and `--bodies` boxes and balls dropped on it) stepped `--frames`
// frames on the main thread and through createPhysics({ worker: true }) in
// headless Chromium's module Worker: what a step costs the main thread
// each way, the hop (a step posted to its poses back, status().hopMs), and
// the two runs' worst difference at the end (the same engine: it should be
// float32's). The worker stays off until a world's step is measured over
// 2 ms a frame on the laptop (src/lib/physics/worker.js); this is the hop's
// half of that sum.
//
//   node scripts/physics-worker.mjs [--bodies 200] [--frames 600] [--out dir]
//
// Writes <out>/physics-worker-<bodies>.json (default docs/superpowers/
// evidence/gpu-first/N5) and prints the row.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const BODIES = Number(arg('bodies', 200));
const FRAMES = Number(arg('frames', 600));
const OUT = resolve(ROOT, arg('out', 'docs/superpowers/evidence/gpu-first/N5'));
mkdirSync(OUT, { recursive: true });

const { chromium } = await import('playwright-core');
const { findChromium } = await import('./lib/chromium.mjs');
const exe = findChromium();
if (!exe) {
  console.error('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe });
let code = 0;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  await page.goto(`${base}/scripts/physics-worker/index.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const row = await page.evaluate((o) => window.__run(o), { bodies: BODIES, frames: FRAMES });
  const out = { _source: 'scripts/physics-worker.mjs in headless Chromium on this machine', browser: browser.version(), ...row, errors };
  writeFileSync(join(OUT, `physics-worker-${BODIES}.json`), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${BODIES} bodies, ${FRAMES} frames, Chromium ${browser.version()}`);
  console.log(`main thread: worker ${row.main.worker}, step p50 ${row.main.stepMs.p50} ms, p95 ${row.main.stepMs.p95} ms`);
  console.log(`through the worker: worker ${row.off.worker}, the main thread's share p50 ${row.off.stepMs.p50} ms, p95 ${row.off.stepMs.p95} ms; the hop p50 ${row.off.hopMs.p50} ms, p95 ${row.off.hopMs.p95} ms`);
  console.log(`the two at the end: worst difference ${row.worstDiff}`);
  if (!row.off.worker || errors.length) code = 1;
  if (errors.length) console.log(`errors: ${errors.join(' / ')}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
