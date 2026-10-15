/* global window, document */
// Aboard the Death Star (#/deathstar/inside), checked in a browser: each
// station started from its address, you put in each named room through the
// dev hook (window.__deathstar: teleport, info), a few frames drawn there,
// a screenshot taken, and the frame’s draw calls and triangles held to the
// budget. Fails on any page error, console error or failed request. With
// the dev server up:
//
//   OUT=<dir> node scripts/deathstar-check.mjs [station:room …]
//
// One PNG a room, <OUT>/<station>-<room>.png, of the world without its HUD
// (HUD=1 keeps it). BASE sets the dev server (default http://127.0.0.1:5197),
// CHROME the browser (else the sandbox’s Chromium), W and H the window
// (1280 × 720), WAIT the milliseconds to let a room build (2500), SIDE the
// side to come aboard as (imperial, so nobody shoots while you look).
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197';
const OUT = process.env.OUT ?? '.';
const W = Number(process.env.W ?? 1280);
const H = Number(process.env.H ?? 720);
const WAIT = Number(process.env.WAIT ?? 2500);
const SIDE = process.env.SIDE ?? 'imperial';
// the frame’s budget (the spec’s): draw calls and triangles, bloom’s passes and all
export const BUDGET = { calls: 600, triangles: 1_500_000 };

export const ROOMS = {
  ds1: ['hold', 'bay327', 'ctl327', 'ring2', 'tiebay', 'deck1', 'conference', 'archive', 'overbridge', 'meditation', 'firecontrol', 'lobby5', 'aa23', 'cellbay', 'cell2187', 'core6', 'tractor', 'maint', 'compactor', 'chasm'],
  ds2: ['dock', 'hangar272', 'corridors2', 'command', 'holding', 'throne', 'gallery', 'superstructure'],
};

const asked = process.argv.slice(2).map((a) => a.split(':'));
const list = asked.length ? asked : Object.entries(ROOMS).flatMap(([s, rooms]) => rooms.map((r) => [s, r]));
mkdirSync(OUT, { recursive: true });

const exe = [process.env.CHROME, '/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
await ctx.addInitScript(() => {
  // (about:blank, between stations, has no storage to set)
  try {
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"home"');
    window.localStorage.setItem('tp-worlds', '"load"');
    window.localStorage.setItem('tp-software', '"on"'); // (past the Star Wars worlds' GPU gate, lib/fit)
  } catch {
    /* nothing to keep on a blank page */
  }
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

const failed = [];
let station = null;
for (const [s, room] of list) {
  if (s !== station) {
    station = s;
    // (a new address in the same document keeps the world that is up: start the page afresh)
    await page.goto('about:blank');
    await page.goto(`${BASE}/#/deathstar/inside?station=${s}&side=${SIDE}&mode=roam`, { waitUntil: 'domcontentloaded' });
    // (the world is made before its first rooms are in: the docking cover stays up until they are)
    await page.waitForFunction(() => window.__deathstar?.g && !document.querySelector('.ds-cover'), null, { timeout: 600000, polling: 500 });
    if (!process.env.HUD) await page.addStyleTag({ content: '.ds-hud, .ds-touch, .guide-btn, .guide-nudge { visibility: hidden !important; }' });
  }
  const ok = await page.evaluate((r) => window.__deathstar.teleport(r), room);
  if (!ok) {
    failed.push(`${s}:${room}: no such room or spot`);
    continue;
  }
  await page.waitForTimeout(WAIT);
  const info = await page.evaluate(() => window.__deathstar.info());
  await page.screenshot({ path: `${OUT}/${s}-${room}.png` });
  const over = info.calls > BUDGET.calls || info.triangles > BUDGET.triangles;
  console.log(`${s}:${room}  ${info.calls} calls, ${info.triangles} triangles${over ? '  OVER BUDGET' : ''}  (in ${info.room})`);
  if (over) failed.push(`${s}:${room}: ${info.calls} calls, ${info.triangles} triangles`);
}
await browser.close();
for (const e of errors) console.error(`error: ${e}`);
for (const f of failed) console.error(`failed: ${f}`);
process.exit(errors.length || failed.length ? 1 : 0);
