#!/usr/bin/env node
/* global window, requestAnimationFrame, AudioBufferSourceNode, HTMLMediaElement */
// The Battlefront world's sounds in a headless browser, through its dev door
// (window.__battlefront: src/components/battlefront/module.js): the page
// opens Hoth's Galactic Assault, deploys an assault trooper, walks (W),
// fires (the mouse held), dies and wins, and the script counts what played:
// the player's own counter by name (`sounds()`), and, apart from it, every
// AudioBufferSourceNode started and every <audio> element played, hooked
// before the page's scripts run. It fails on a console error, on a 404
// under /audio/, and when nothing played.
//
//   node scripts/bf2017-sound-check.mjs [--browser <exe>] [--port 5611] [--out docs/superpowers/evidence/bf2017-sound] [--wait 600000] [--seconds 20]
//
// The browser is Edge on the owner's desktop (its path below; CHROMIUM or
// --browser names another), on d3d11 with WebGPU on, autoplay allowed so the
// context runs with no gesture.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const exe = arg('browser', process.env.CHROMIUM ?? EDGE);
const PORT = Number(arg('port', 5611));
const OUT = join(ROOT, arg('out', 'docs/superpowers/evidence/bf2017-sound'));
const WAIT = Number(arg('wait', 600000));
const SECONDS = Number(arg('seconds', 20));
const ROUTE = '/battlefront/hoth/galacticAssault';
mkdirSync(OUT, { recursive: true });
if (!existsSync(exe)) {
  console.error(`no browser at ${exe} (--browser names one)`);
  process.exit(2);
}

const { chromium } = await import('playwright-core');
const { createServer } = await import('vite');
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => {
  window.localStorage.setItem('tp-intro', '1');
  window.localStorage.setItem('tp-start', JSON.stringify('universe'));
  window.localStorage.setItem('tp-worlds', JSON.stringify('load'));
  window.localStorage.setItem('tp-quality', 'high');
  // the independent counter: every buffer source started, every <audio> played
  const hook = { buffers: 0, elements: 0, elementUrls: [] };
  window.__audioHook = hook;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) {
    hook.buffers += 1;
    return start.apply(this, a);
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    if (this.tagName === 'AUDIO') {
      hook.elements += 1;
      hook.elementUrls.push(String(this.currentSrc || this.src).replace(/^.*\/audio\//, '/audio/'));
    }
    return play.apply(this, a);
  };
});
const page = await ctx.newPage();
const errors = [];
const missing = [];
const audioRequests = new Set();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => {
  const url = r.url();
  if (!/\/audio\//.test(url)) return;
  audioRequests.add(url.replace(/^.*\/audio\//, '/audio/'));
  if (r.status() >= 400) missing.push({ url: url.replace(/^.*\/audio\//, '/audio/'), status: r.status() });
});
const frames = (n) => page.evaluate((k) => new Promise((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const sounds = () => page.evaluate(() => window.__battlefront?.sounds?.() ?? null);
const hook = () => page.evaluate(() => window.__audioHook);
const out = { route: ROUTE, browser: exe, errors, missing, phases: {} };
const t0 = Date.now();
try {
  await page.goto(`${base}/#${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: WAIT });
  for (const until = Date.now() + WAIT; ; ) {
    const failed = errors.find((e) => /3D failed|device.*lost/i.test(e));
    if (failed) throw new Error(failed.split('\n')[0]);
    if (await page.evaluate(() => Boolean(window.__battlefront?.view))) break;
    if (Date.now() > until) throw new Error('the world never came up');
    await page.waitForTimeout(1000);
  }
  out.backend = await page.evaluate(() => window.__battlefront.do('gpu'));
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  out.loadedMs = Date.now() - t0;
  await frames(30);
  out.phases.loaded = { sounds: await sounds(), hook: await hook() };
  out.deploy = await page.evaluate(() => window.__battlefront.do('deploy', { classId: 'd-orig-assault' }));
  await page.waitForFunction(() => window.__battlefront.view().level.loaded, null, { timeout: WAIT, polling: 1000 });
  await frames(30);
  // (the canvas takes the look and the mouse)
  await page.mouse.click(640, 360);
  await frames(10);
  // walk: W held, the footsteps come
  await page.keyboard.down('KeyW');
  await page.waitForTimeout((SECONDS * 1000) / 4);
  await page.keyboard.up('KeyW');
  out.phases.walked = { sounds: await sounds(), hook: await hook() };
  // fire: the mouse held, the blaster's layers, the overheat
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.waitForTimeout((SECONDS * 1000) / 4);
  await page.mouse.up();
  out.phases.fired = { sounds: await sounds(), hook: await hook() };
  // the bots' battle round the player
  await page.waitForTimeout((SECONDS * 1000) / 2);
  out.phases.battle = { sounds: await sounds(), hook: await hook() };
  await page.evaluate(() => window.__battlefront.do('die'));
  await page.waitForTimeout(2500);
  out.phases.died = { sounds: await sounds(), hook: await hook(), duck: await page.evaluate(() => window.__battlefront.view().player?.state) };
  await page.evaluate(() => window.__battlefront.do('win'));
  await page.waitForTimeout(2500);
  out.phases.won = { sounds: await sounds(), hook: await hook() };
  await page.screenshot({ path: join(OUT, 'field.png') });
  out.view = await page.evaluate(() => {
    const v = window.__battlefront.view();
    return { player: v.player && { state: v.player.state, heat: v.player.heat, overheated: v.player.overheated, weapon: v.player.weapon }, stage: v.mode?.stageName, result: v.mode?.result, entities: v.entities?.length };
  });
} catch (e) {
  out.failed = String(e).split('\n')[0];
}
out.audioRequests = [...audioRequests].sort();
const last = out.phases.won ?? out.phases.died ?? out.phases.battle ?? out.phases.fired ?? out.phases.walked ?? out.phases.loaded ?? null;
out.summary = last && {
  starts: last.sounds?.starts ?? 0,
  names: Object.keys(last.sounds?.played ?? {}).length,
  late: last.sounds?.late ?? 0,
  failed: last.sounds?.failed ?? 0,
  buffers: last.sounds?.buffers ?? 0,
  hookBuffers: last.hook?.buffers ?? 0,
  hookElements: last.hook?.elements ?? 0,
  requests: out.audioRequests.length,
  missing: missing.length,
  errors: errors.length,
};
writeFileSync(join(OUT, 'check.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ summary: out.summary, played: last?.sounds?.played ?? null, failed: out.failed ?? null, errors: errors.slice(0, 5), missing: missing.slice(0, 5) }, null, 2));
await browser.close();
await server.close();
const ok = !out.failed && !errors.length && !missing.length && (out.summary?.starts ?? 0) > 0;
process.exit(ok ? 0 : 1);
