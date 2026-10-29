/* global window, document, crossOriginIsolated */
// A bf2-web build, opened the way a visitor's browser opens it, before the site adopts it
// (docs/decisions/2026-10-28-bf2web-pipeline.md): the Worker's own code (cloudflare/play.js) on a local server over
// the private bucket, and headless Chromium on the engine's page until the game's front end is up (window.__playFlow
// at 'menu'), cross-origin isolated, the way back in its corner. It proves the build is whole and served as the
// contract says, not that it plays: the round needs a real GPU, which the desktop's play-flow check is.
//
//   node --env-file=.env.local scripts/bf2web-smoke.mjs [--build <id>] [--port 8622] [--wait 240000]
//     --build: the build to open (default: the one src/data/bf2web/play.json names)
// Exit 1 on a failure: the menu not reached, the page not isolated, a request answered 4xx or 5xx that isn't one of
// the two the page asks for and does without (the player's /profile/ files, the front end's backdrop stills).

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { ENGINE, servePlay } from '../cloudflare/play.js';
import { open } from './lib/bf2web-r2.mjs';
import { optionalPlayPath } from './lib/bf2web-smoke.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const play = JSON.parse(readFileSync(join(ROOT, 'src/data/bf2web/play.json'), 'utf8'));
const build = option('--build', play.build);
// (run after the adopt step, play.json names the build and its rulebooks already)
const config = { ...play, build, site: `sites/${build}/`, uiData: option('--ui-data', play.uiData) };
const port = Number(option('--port', 8622));
const wait = Number(option('--wait', 240000));

const r2 = open();
const manifests = new Map();
const server = createServer(async (req, res) => {
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers });
  const out = await servePlay(request, { PLAY: r2.binding }, config, manifests).catch((e) => new Response(String(e), { status: 500 }));
  if (!out) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const failed = [];
page.on('response', (r) => {
  const path = new URL(r.url()).pathname;
  if (r.status() >= 400 && !optionalPlayPath(path)) failed.push(`${r.status()} ${path}`);
});
page.on('pageerror', (e) => failed.push(`page error: ${e.message.slice(0, 200)}`));
const problems = [];
const t0 = Date.now();
try {
  await page.goto(`http://127.0.0.1:${port}${ENGINE}${build}/?from=%2Fgalaxy%2Fhoth`, { waitUntil: 'load', timeout: 120000 });
  const up = await page.waitForFunction(() => window.__playFlow?.state === 'menu', null, { timeout: wait, polling: 500 }).then(() => true, () => false);
  const facts = await page.evaluate(() => ({ isolated: crossOriginIsolated, gpu: !!navigator.gpu, back: document.querySelector('.tp-return')?.getAttribute('href') ?? null }));
  if (!up) problems.push(`the front end did not reach its menu in ${wait / 1000} s (state ${await page.evaluate(() => window.__playFlow?.state ?? 'none')})`);
  if (!facts.isolated) problems.push('the page is not cross-origin isolated');
  if (facts.back !== '/#/galaxy/hoth') problems.push(`the way back is ${JSON.stringify(facts.back)}, not /#/galaxy/hoth`);
} catch (error) {
  problems.push(`the page: ${error.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.close();
}
problems.push(...failed);
console.log(`${build}: ${problems.length ? `failed\n  - ${problems.join('\n  - ')}` : `the front end is up in ${Math.round((Date.now() - t0) / 1000)} s, isolated, the way back in its corner`}`);
process.exit(problems.length ? 1 : 0);
