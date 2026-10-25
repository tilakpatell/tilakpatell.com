// C-137 on a controller: a pad of the page's own (games/pad.js reads
// navigator.getGamepads, which it stands in for), its buttons pressed from
// here. A new visitor's card, a jump, Things to do and the portal gun's dial;
// then, on Free roam, the Blood Dome's fight locked on and fired at, and the
// sewer run's cards rolled, paused and left.
/* global window */

import { BASE, check, built, c137, warp, dial, home, spotAt, place } from './helpers.mjs';
import { WHO, huntOf, him, fightOn, standOff } from './evil.mjs';

const BUTTON = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, start: 9, up: 12, down: 13, left: 14, right: 15 };
const BENCH = [-301.75, 100.15, Math.PI];

// the page's pad, every button up
async function fakePad(page) {
  await page.evaluate(() => {
    window.__PAD__ = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__PAD__] });
  });
}
// a button pressed and let go, each held till the world's tick has seen it
// (its last reading, sim.padBefore; before the world's up, a while), for a
// slow frame not to miss it
async function padPress(page, name) {
  const set = (on) => page.evaluate(([i, on]) => (window.__PAD__.buttons[i] = { pressed: on, value: on ? 1 : 0 }), [BUTTON[name], on]);
  const seen = (on) => page.waitForFunction(([k, on]) => (window.__C137__?.sim ? Boolean(window.__C137__.sim.padBefore?.[k]) === on : true), [name, on], { timeout: 10000, polling: 30 }).catch(() => {});
  await set(true);
  await seen(true);
  await page.waitForTimeout(150);
  await set(false);
  await seen(false);
  await page.waitForTimeout(150);
}
const waitFor = (page, fn, arg, what, timeout = 5000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 50 }).catch(() => {
    throw new Error(what);
  });

export const PAD_CHECKS = {
  async 'pad-walk'(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.rm-episode');
    await card.waitFor({ timeout: 600000 });
    const t0 = Date.now();
    await fakePad(page);
    await padPress(page, 'a');
    await card.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {
      throw new Error('A didn’t close the episode’s card');
    });
    check(Date.now() - t0 < 6000, 'the card went by itself, not at the pad');
    await built(page);
    // X jumps
    await padPress(page, 'x');
    await waitFor(page, () => window.__C137__.sim.m.y > 0.05, null, 'X didn’t jump', 3000);
    // Y opens Things to do, B shuts it
    await padPress(page, 'y');
    await page.locator('#rm-list').waitFor({ timeout: 5000 }).catch(() => {
      throw new Error('Y didn’t open Things to do');
    });
    await padPress(page, 'b');
    await page.locator('#rm-list').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
      throw new Error('B didn’t shut Things to do');
    });
    // the portal gun's dial: A at the bench opens it, the d-pad turns it, B puts it down
    await warp(page, 'garage', ...BENCH);
    await waitFor(page, () => window.__C137__.sim.near?.id === 'dial', null, 'Morty isn’t by the bench', 20000);
    await padPress(page, 'a');
    const box = page.locator('.rm-dial-box');
    await box.waitFor({ timeout: 5000 }).catch(() => {
      throw new Error('A at the bench didn’t open the dial');
    });
    const on = () => page.locator('.rm-dial-row[data-on] b').textContent();
    const first = await on();
    await padPress(page, 'down');
    check((await on()) !== first, `the d-pad didn’t turn the dial (still on ${first})`);
    await padPress(page, 'b');
    await box.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
      throw new Error('B didn’t put the gun down');
    });
  },

  'pad-fight': Object.assign(
    async (page) => {
      await c137(page);
      await fakePad(page);
      // the Blood Dome: A at the ring starts the fight, LT locks on, RT lands a shot
      await dial(page, 'blooddome');
      await warp(page, 'blooddome', ...spotAt('blooddome', 'ring'));
      await waitFor(page, () => window.__C137__.sim.near?.id === 'ring', null, 'Morty isn’t by the ring', 20000);
      await padPress(page, 'a');
      await fightOn(page, 'blooddome');
      await padPress(page, 'lt');
      await waitFor(page, () => window.__C137__.sim.lockShown === true, null, 'LT didn’t lock on');
      const max = huntOf('blooddome').duel.hp;
      await warp(page, 'blooddome', ...standOff('blooddome', await him(page, 'blooddome'), 6));
      await page.waitForTimeout(600);
      await padPress(page, 'rt');
      await waitFor(page, ([w, max]) => (window.__C137__.api.act('blooddome', 'npcs').find((n) => n.id === w).hp ?? max) < max, [WHO.blooddome, max], 'RT didn’t land a shot on Hemorrhage');
      await home(page, 'blooddome');
      // the sewer: A at the hole opens it, A rolls, Start pauses, B goes back up
      await dial(page, 'agency');
      await warp(page, 'agency', ...spotAt('agency', 'sewer', -0.36, 1.7));
      await waitFor(page, () => window.__C137__.sim.near?.id === 'sewer', null, 'Morty isn’t by the hole', 20000);
      await padPress(page, 'a');
      const hole = place(page, 'sewer');
      const anyway = hole.getByRole('button', { name: 'Play anyway (slow)' });
      await Promise.race([hole.locator('.sewer').waitFor({ timeout: 120000 }), anyway.waitFor({ timeout: 120000 })]).catch(() => {
        throw new Error('A at the hole didn’t open the sewer run');
      });
      if (await anyway.count()) await anyway.click();
      await waitFor(page, () => window.__SEWER__?.phase === 'intro', null, 'the sewer run’s first card didn’t show', 120000);
      await padPress(page, 'a');
      await waitFor(page, () => window.__SEWER__?.phase === 'play', null, 'A didn’t roll');
      await padPress(page, 'start');
      await waitFor(page, () => window.__SEWER__?.phase === 'paused', null, 'Start didn’t pause');
      await padPress(page, 'b');
      await hole.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {
        throw new Error('B didn’t go back up the hole');
      });
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 0, step: 0, got: [], wins: [], freeRoam: true } } } },
  ),
};
