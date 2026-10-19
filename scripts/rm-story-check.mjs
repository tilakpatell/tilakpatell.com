/* global window, document */
// The Rick and Morty adventure played in a browser: each scenario on a fresh
// profile, driven through the dev hooks (window.__C137__: goto, act,
// complete, ready; window.__RMSTORY__: get, feed, dialOpen, jump, reset), as
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
// the first world takes a while to build.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { EPISODES } from '../src/components/rickmorty/adventure/episodes.js';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5197';
const OUT = process.env.OUT ?? null;
const N = Math.PI / 2;

const exe = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));

const check = (ok, what) => {
  if (!ok) throw new Error(what);
};
const done = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]'));

// C-137 loaded and its world built, Morty in the garage
async function c137(page, hash = '#/c-137') {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__C137__?.goto || document.querySelector('.rm-world')?.dataset.mode === 'cards', null, { timeout: 600000, polling: 1000 });
  check(await page.evaluate(() => Boolean(window.__C137__?.goto)), 'the 3D world didn’t start');
  await page.evaluate(() => document.querySelector('.rm-world')?.scrollIntoView({ block: 'start' }));
  await page.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
}
// Morty sent somewhere, as a door sends him, and stood till it's built
async function goto(page, area, x, z, face = N) {
  check(await page.evaluate(([a, x, z, f]) => window.__C137__.goto(a, x, z, f), [area, x, z, face]), `Morty wouldn’t go to ${area}`);
  await page.waitForFunction(() => window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
}
// E at a hotspot, once he's by it
async function use(page, id) {
  await page.waitForFunction((id) => window.__C137__.sim.near?.id === id, id, { timeout: 20000, polling: 100 }).catch(async () => {
    const at = await page.evaluate(() => ({ x: window.__C137__.sim.m.x, z: window.__C137__.sim.m.z, near: window.__C137__.sim.near?.id ?? null }));
    throw new Error(`Morty isn’t by ${id} (he’s at ${at.x.toFixed(2)}, ${at.z.toFixed(2)}, by ${at.near})`);
  });
  await page.evaluate(() => window.__C137__.act());
}
const place = (page, id) => page.locator(`.rm-place[data-place="${id}"]`);
const story = (page) => page.evaluate(() => window.__RMSTORY__.get());
// the objective line reads `text` (it's the story's, or the checklist's)
async function reads(page, text) {
  await page.waitForFunction((t) => document.querySelector('.rm-hud .rm-objective')?.textContent.trim() === t, text, { timeout: 10000 }).catch(async () => {
    throw new Error(`the objective reads “${await page.locator('.rm-hud .rm-objective').first().textContent()}”, not “${text}”`);
  });
}
const WIPED = EPISODES[0];
// Morty by the garage portal, stepped through it, and stood where it took him
async function throughPortal(page) {
  await goto(page, 'garage', -302.3, 101.4, Math.PI);
  await use(page, 'garage-portal');
}
const gun = async (page) => {
  await page.getByRole('button', { name: /Portal gun/ }).first().click();
  await page.locator('.rm-dial-box').waitFor({ timeout: 10000 });
};
const toast = (page, text) =>
  page.locator('.rm-toast', { hasText: text }).waitFor({ timeout: 10000 }).catch(() => {
    throw new Error(`no toast saying “${text}”`);
  });
const inGarage = (page) =>
  page.waitForFunction(() => window.__C137__?.sim?.area === 'garage' && window.__C137__.ready(), null, { timeout: 300000, polling: 250 }).catch(async () => {
    throw new Error(`C-137 didn’t start in the garage (${await page.evaluate(() => window.__C137__?.sim?.area)})`);
  });

const SCENARIOS = {
  // a new visitor plays episode 1 from the street to Customs and back
  async 'episode-1'(page) {
    await c137(page);
    check((await story(page)).freeRoam === false, 'a new visitor started on free roam');
    await reads(page, WIPED.steps[0].text);
    for (const [i, { id }] of WIPED.steps.slice(0, 3).entries()) {
      await page.evaluate((id) => window.__C137__.complete(id), id);
      await reads(page, WIPED.steps[i + 1].text);
      const s = await story(page);
      check(s.episode === 0 && s.step === i + 1, `after ${id} the story is at ${s.episode}.${s.step}`);
    }
    // the last step: out of Customs with the seeds; the episode's closing line, and (only episode 1 built) every place open
    await page.evaluate(() => window.__C137__.complete('customs'));
    await page.locator('.rm-toast', { hasText: WIPED.outro[0][1] }).waitFor({ timeout: 10000 });
    check((await story(page)).episode === 1, 'episode 1 didn’t end');
    for (const id of ['annex', 'vat', 'citadel', 'squanch', 'evilrick']) check(await page.evaluate((id) => window.__RMSTORY__.dialOpen(id), id), `${id} isn’t open after episode 1`);
    await reads(page, 'Go into the Smith house and put interdimensional cable on the TV.');
  },
  // a new visitor's dial: Customs open, the rest dimmed with the episode that
  // opens them; a locked pick says so and changes nothing; a dial left set to
  // a locked place (tp-rm-dial) still opens the portal on an open one
  async dial(page) {
    await c137(page);
    await gun(page);
    const rows = page.locator('.rm-dial-row');
    check((await rows.count()) === 32, `the dial has ${await rows.count()} places, not 32`);
    check((await page.locator('.rm-dial-row[data-locked]').count()) === 31, 'the dial doesn’t have 31 places locked');
    check(!(await rows.filter({ hasText: 'Interdimensional Customs' }).getAttribute('data-locked')), 'Customs is locked');
    check((await page.locator('.rm-dial-lead').textContent()) === 'Coordinates home: 1 of 32', 'the dial doesn’t count the coordinates home');
    await rows.filter({ hasText: 'vat of acid' }).click();
    await toast(page, 'Opens after episode 5, “Heat”.');
    check((await page.evaluate(() => localStorage.getItem('tp-rm-dial'))) !== 'vat', 'a locked pick set the dial');
    await page.evaluate(() => localStorage.setItem('tp-rm-dial', 'vat'));
    await throughPortal(page);
    await page.waitForFunction(() => window.__C137__.sim.area !== 'garage' && window.__C137__.ready(), null, { timeout: 300000, polling: 250 });
    const area = await page.evaluate(() => window.__C137__.sim.area);
    check(area === 'customs', `a dial left on the vat opened the portal on ${area}`);
  },
  // no place is a dead end: the Citadel through the garage portal and back
  // to the garage, and a planet landed on from the map has a way home
  async ways(page) {
    await c137(page);
    await page.evaluate(() => window.__RMSTORY__.jump(1)); // (past the built episodes: every place open)
    check((await page.evaluate(() => window.__C137__.dial('citadel'))) === 'citadel', 'the dial wouldn’t take the Citadel');
    await throughPortal(page);
    await page.waitForFunction(() => window.location.hash.startsWith('#/c-137/citadel'), null, { timeout: 20000 }).catch(() => {
      throw new Error('the portal didn’t open on the Citadel');
    });
    await page.getByRole('link', { name: 'Back to Dimension C-137' }).click();
    await inGarage(page);
    await page.goto(`${BASE}/#/c-137/squanch`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Home to C-137' }).first().click({ timeout: 600000 });
    await page.waitForFunction(() => window.location.hash === '#/c-137', null, { timeout: 20000 });
    await inGarage(page);
  },
  // C-137's toys tick their task when they're played, not when they open
  async toys(page) {
    await c137(page);
    // cable: three channels watched
    await goto(page, 'house', -298.1, -4.5, -N);
    await use(page, 'cable');
    await place(page, 'cable').waitFor({ timeout: 20000 });
    check(!(await done(page)).includes('cable'), 'cable ticked when it opened');
    const up = place(page, 'cable').locator('button[aria-label="Channel up"]');
    for (let i = 0; i < 2; i++) await up.click();
    check(!(await done(page)).includes('cable'), 'cable ticked before three channels');
    await up.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('cable'), null, { timeout: 5000 }).catch(() => {
      throw new Error('cable didn’t tick after three channels');
    });
    await page.keyboard.press('Escape');
    await place(page, 'cable').waitFor({ state: 'detached', timeout: 10000 });
    // the plumbus: to the end of its line
    await goto(page, 'garage', -298.3, 98.6, 0);
    await use(page, 'plumbus');
    await place(page, 'plumbus').waitFor({ timeout: 20000 });
    check(!(await done(page)).includes('plumbus'), 'the plumbus ticked when it opened');
    const steps = place(page, 'plumbus').locator('.rm-pf-step');
    await steps.nth(0).click();
    check(!(await done(page)).includes('plumbus'), 'the plumbus ticked before its last step');
    await steps.last().click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('plumbus'), null, { timeout: 5000 }).catch(() => {
      throw new Error('the plumbus didn’t tick at the end of its line');
    });
    await page.keyboard.press('Escape');
    await place(page, 'plumbus').waitFor({ state: 'detached', timeout: 10000 });
    // the butter robot: once the butter's passed
    await goto(page, 'house', -302.6, -0.2, -N);
    await use(page, 'butter');
    await place(page, 'butter').waitFor({ timeout: 20000 });
    check(!(await done(page)).includes('butter'), 'the butter robot ticked when it opened');
    await place(page, 'butter').getByRole('button', { name: 'Switch it on' }).click();
    await place(page, 'butter').getByRole('button', { name: 'Pass the butter' }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('butter'), null, { timeout: 10000 }).catch(() => {
      throw new Error('the butter robot didn’t tick once the butter was passed');
    });
  },
};

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
    await run(page);
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
