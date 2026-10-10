#!/usr/bin/env node
/* global window */
// Shoots chain-check.html with the chains given: node scripts/light-fixture/chain-check.mjs "render,traa,output" "render,ssr,output" [--gpu webgl] [--out dir]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const chains = argv.filter((a, i) => !a.startsWith('--') && (i === 0 || !argv[i - 1].startsWith('--')));
const gpu = arg('gpu', 'webgpu');
const raf = arg('raf', '0');
const out = arg('out', join(ROOT, 'docs/superpowers/evidence/galaxy-engine/R/chain-check'));
mkdirSync(out, { recursive: true });
const { chromium } = await import('playwright-core');
const exe = process.env.CHROMIUM ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const angle = process.env.ANGLE ?? (process.platform === 'win32' ? 'd3d11' : 'swiftshader');
const args = ['--use-gl=angle', `--use-angle=${angle}`, '--enable-unsafe-webgpu', '--disable-blink-features=WebGPUExperimentalFeatures', '--ignore-gpu-blocklist', '--enable-webgl'];
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ executablePath: exe, args });
for (const chain of chains) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 240)));
  const row = { chain, gpu };
  try {
    await page.goto(`${base}/scripts/light-fixture/chain-check.html?chain=${chain}&gpu=${gpu}&raf=${raf}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__chk?.ready || window.__chk?.error, null, { timeout: 120000 });
    const err = await page.evaluate(() => window.__chk.error);
    if (err) throw new Error(err);
    row.backend = await page.evaluate(() => window.__chk.backend);
    await page.evaluate(() => window.__chk.draw(40));
    const file = join(out, `${chain.replace(/,/g, '-')}-${gpu}${raf === '1' ? '-raf' : ''}.png`);
    writeFileSync(file, await page.locator('canvas').screenshot());
    row.shot = file;
  } catch (e) {
    row.error = String(e.message ?? e).split('\n')[0];
  }
  if (errors.length) row.errors = [...new Set(errors)].slice(0, 4);
  console.log(JSON.stringify(row));
  await page.close();
}
await browser.close();
await server.close();
