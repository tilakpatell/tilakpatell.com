/* global window */
// The Rick and Morty adventure played in a browser: each scenario on a fresh
// profile, driven through the dev hooks (window.__C137__: goto, act,
// complete, ready, dial, sim, warp (Morty moved within a place, which keeps
// its game going, where goto starts the place afresh), api (a place's own
// actions: the Microverse's power, setPower), the cruiser's board and the
// street's fight (sim.chase is the cruiser's chase), Needful Things' deal
// and the vat's freeze (the places' actions deal, setDeal, freeze, setFreeze),
// the Jerryboree's find (find, setFind), the cable studio's running order
// (sequence, setSequence, sequence-start), Fantasy World's climb (climb,
// setClimb; sim.m and sim.t: Morty stood on a ledge, and the game's own
// time), and Total Rickall's rickall,
// lookAt, shoot, stopRickall; window.__RMSTORY__: get, feed, dialOpen, jump,
// reset; the Citadel's, window.__CITADEL__: api, sim, complete, enter (E at a
// spot: the hangar's the real escape), down, up, cue, emote; the games' own,
// window.__CABINET__, window.__SEWER__ and window.__SCHWIFTY__), as
// scripts/c137-shots.mjs drives C-137. With the dev server up (or a preview of
// a DEV-hooked build):
//
//   node scripts/rm-story-check.mjs [scenario …]
//
// Prints `ok <scenario>` for each that passes; exits 1 naming the first that
// fails (a step that didn't advance, a dial place opened out of turn, a toy
// that ticked before it was played, an error on the page). BASE sets the
// server (default http://127.0.0.1:5197), CHROME the browser, OUT a folder for
// a shot of each scenario's end. Headless browsers draw in software, slowly:
// the first world takes a while to build. The scenarios are ./rm-story/'s
// (basics.mjs, early.mjs, late.mjs, citadel.mjs, sector.mjs), the steps they share its helpers.mjs, and
// where they stand Morty in a place through the portal its places.mjs, read
// from the places' own data.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { OUT, exe, check } from './rm-story/helpers.mjs';
import { BASICS } from './rm-story/basics.mjs';
import { EARLY } from './rm-story/early.mjs';
import { LATE } from './rm-story/late.mjs';
import { AT_THE_CITADEL } from './rm-story/citadel.mjs';
import { SECTOR_CHECKS } from './rm-story/sector.mjs';

const SCENARIOS = { ...BASICS, ...EARLY, ...LATE, ...AT_THE_CITADEL, ...SECTOR_CHECKS };

const only = process.argv.slice(2);
for (const n of only) if (!SCENARIOS[n]) throw new Error(`no scenario ${n} (there are ${Object.keys(SCENARIOS).join(', ')})`);
if (OUT) mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let failed = null;
for (const [name, run] of Object.entries(SCENARIOS)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((seed) => {
    // (only on the first load: a scenario that reloads keeps what it's done)
    if (window.sessionStorage.getItem('rm-check')) return;
    window.sessionStorage.setItem('rm-check', '1');
    window.localStorage.setItem('tp-intro', '1');
    window.localStorage.setItem('tp-start', '"home"');
    window.localStorage.setItem('tp-worlds', '"load"');
    window.localStorage.setItem('tp-software', '"on"');
    for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, JSON.stringify(v));
  }, run.seed ?? {});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  try {
    await run(page, errors);
    check(!errors.length, `errors on the page: ${errors.slice(0, 3).join('; ')}`);
    if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`ok ${name}`);
  } catch (e) {
    if (OUT) await page.screenshot({ path: `${OUT}/${name}-failed.png` }).catch(() => {});
    console.log(`FAIL ${name}: ${e.message}`);
    failed = name;
  }
  await ctx.close();
  if (failed) break;
}
await browser.close();
if (failed) process.exit(1);
