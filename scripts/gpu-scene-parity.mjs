#!/usr/bin/env node
/* global window */
// The GPU scene's cull on a WebGPU device beside its CPU twin (GPU-first
// lane N1): opens scripts/gpu-scene/parity.html on a Vite dev server in
// Chromium and prints, frame by frame, the keys whose GPU list differs from
// cull.js's cullCpu (0 is the bar), the shadow lists, the files drawn and
// the slots' indirect arguments. Compute only, so SwiftShader's device
// serves in the cloud; the laptop runs it on its own chip.
//
//   node scripts/gpu-scene-parity.mjs [--json out.json]

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { adapterFor, findChromium, launchArgs } from './lib/chromium.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const exe = findChromium();
if (!exe) {
  console.error('no Chromium (set CHROMIUM=/path/to/chrome)');
  process.exit(2);
}
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args: launchArgs({ webgpu: true, adapter: adapterFor() }) });
let failed = false;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 400)));
  await page.goto(`${base}/scripts/gpu-scene/parity.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__parity, null, { timeout: 240000 });
  const out = await page.evaluate(() => window.__parity);
  if (out.error) throw new Error(out.error);
  console.log('| frame | keys | listed | of them fading | shadow | lists differ | shadow lists differ | files differ | args wrong | stats GPU / CPU (tested, culled, occluded, drawn) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const f of out.frames) {
    console.log(`| ${f.name} | ${f.keys} | ${f.drawn} | ${f.fading} | ${f.shadow} | ${f.rowsDiffer} | ${f.shadowDiffer} | ${f.lodsDiffer} | ${f.args} | ${f.stats.gpu.join(', ')} / ${f.stats.cpu.join(', ')} |`);
    if (f.rowsDiffer || f.shadowDiffer || f.lodsDiffer || f.args) failed = true;
  }
  if (errors.length) console.log('errors:', errors.slice(0, 5));
  const i = argv.indexOf('--json');
  if (i >= 0) writeFileSync(argv[i + 1], `${JSON.stringify(out, null, 2)}\n`);
} catch (e) {
  console.error(String(e.message ?? e).slice(0, 2000));
  failed = true;
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
