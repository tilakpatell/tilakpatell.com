/* global window, document */
// The Rick and Morty adventure played in a browser: each scenario on a fresh
// profile, driven through the dev hooks (window.__C137__: goto, act,
// complete, ready, dial, sim, warp (Morty moved within a place, which keeps
// its game going, where goto starts the place afresh), api (a place's own
// actions: the Microverse's power, setPower), the cruiser's board and the
// street's fight (sim.chase is the cruiser's chase), Needful Things' deal
// and the vat's freeze (the places' actions deal, setDeal, freeze, setFreeze),
// the Jerryboree's find (find, setFind),
// and Total Rickall's rickall,
// lookAt, shoot, stopRickall; window.__RMSTORY__: get, feed, dialOpen, jump,
// reset; the games' own, window.__CABINET__ and window.__SEWER__), as
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
// the first world takes a while to build. The steps the scenarios share are
// ./rm-story/helpers.mjs's.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { READY } from '../src/components/rickmorty/adventure/episodes.js';
import { COURSE, chaseStart, newChase } from '../src/components/rickmorty/world/games/chase.js';
import { BASE, OUT, N, exe, check, done, c137, built, goto, use, place, story, reads, WIPED, ARCADE, GUESTS, SMALL, HEAT, DEALS, JERRY, throughPortal, gun, toast, inArea, cardFor, at, opens, shootAt, warpUse, caught, before, chasing, playTo, game, rickallOn } from './rm-story/helpers.mjs';

const SCENARIOS = {
  // a new visitor plays episode 1 from the street to Customs and back
  async 'episode-1'(page) {
    // the card: episode 1, as the world comes on, gone at the next key
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.rm-episode');
    await card.waitFor({ timeout: 600000 }).catch(() => {
      throw new Error('no episode card for a new visitor');
    });
    const said = await card.textContent();
    check(said.includes('Episode 1') && said.includes(WIPED.title) && said.includes(WIPED.intro[0][1]), `the card says “${said}”`);
    await page.keyboard.press('Shift');
    await card.waitFor({ state: 'detached', timeout: 5000 });
    await built(page);
    check((await story(page)).freeRoam === false, 'a new visitor started on free roam');
    await reads(page, WIPED.steps[0].text);
    for (const [i, { id }] of WIPED.steps.slice(0, 3).entries()) {
      await page.evaluate((id) => window.__C137__.complete(id), id);
      await reads(page, WIPED.steps[i + 1].text);
      const s = await story(page);
      check(s.episode === 0 && s.step === i + 1, `after ${id} the story is at ${s.episode}.${s.step}`);
    }
    // the last step: out of Customs with the seeds; the episode's closing line, then episode 2's card
    await page.evaluate(() => window.__C137__.complete('customs'));
    await toast(page, WIPED.outro[0][1]);
    await card.waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no card for episode 2 once episode 1 ended');
    });
    const next = await card.textContent();
    check(next.includes('Episode 2') && next.includes(ARCADE.title) && next.includes(ARCADE.intro[0][1]), `episode 2’s card says “${next}”`);
    await page.keyboard.press('Shift');
    await card.waitFor({ state: 'detached', timeout: 5000 });
    const s = await story(page);
    check(s.episode === 1 && s.step === 0, `after episode 1 the story is at ${s.episode}.${s.step}`);
    for (const id of ['annex', 'meeseeksgolf']) check(await page.evaluate((id) => window.__RMSTORY__.dialOpen(id), id), `${id} isn’t open after episode 1`);
    for (const id of ['agency', 'vat']) check(!(await page.evaluate((id) => window.__RMSTORY__.dialOpen(id), id)), `${id} is open after episode 1`);
    await reads(page, ARCADE.steps[0].text);
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
    await page.evaluate((n) => window.__RMSTORY__.jump(n), READY); // (past the built episodes: every place open)
    check((await page.evaluate(() => window.__C137__.dial('citadel'))) === 'citadel', 'the dial wouldn’t take the Citadel');
    await throughPortal(page);
    await page.waitForFunction(() => window.location.hash.startsWith('#/c-137/citadel'), null, { timeout: 20000 }).catch(() => {
      throw new Error('the portal didn’t open on the Citadel');
    });
    await page.getByRole('link', { name: 'Back to Dimension C-137' }).click();
    await inArea(page, 'garage');
    await page.goto(`${BASE}/#/c-137/squanch`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Home to C-137' }).first().click({ timeout: 600000 });
    await page.waitForFunction(() => window.location.hash === '#/c-137', null, { timeout: 20000 });
    await inArea(page, 'garage');
  },
  // Things to do (M): the Story tab first, the Checklist beside it, and Free
  // roam, which opens every place on the dial
  async 'free-roam'(page) {
    await c137(page);
    await page.getByRole('button', { name: /Things to do/ }).first().click();
    const list = page.locator('#rm-list');
    await list.waitFor({ timeout: 10000 });
    check((await list.getByRole('tab', { name: 'Story' }).getAttribute('aria-selected')) === 'true', 'the Story tab isn’t first');
    check((await list.textContent()).includes(WIPED.steps[0].text), 'the Story tab doesn’t show the first step');
    await list.getByRole('tab', { name: 'Checklist' }).click();
    check((await list.textContent()).includes('Watch interdimensional cable'), 'the Checklist tab doesn’t show the checklist');
    check(!(await page.evaluate(() => window.__RMSTORY__.dialOpen('vat'))), 'the vat was open before Free roam');
    await list.getByRole('checkbox', { name: /Free roam/ }).check();
    check(await page.evaluate(() => window.__RMSTORY__.dialOpen('vat') && window.__RMSTORY__.get().freeRoam), 'Free roam didn’t open the vat');
    if (OUT) await page.screenshot({ path: `${OUT}/free-roam-list.png` });
    await list.getByRole('button', { name: 'Close the list' }).click();
    await gun(page);
    check((await page.locator('.rm-dial-row[data-locked]').count()) === 0, 'places stayed locked on Free roam');
  },
  // a visitor with progress already saved keeps every place, and sees no card
  returner: Object.assign(
    async (page) => {
      await c137(page);
      const s = await story(page);
      check(s.freeRoam === true, 'a returner isn’t on free roam');
      check(await page.evaluate(() => window.__RMSTORY__.dialOpen('vat')), 'a returner’s vat is locked');
      check((await page.locator('.rm-episode').count()) === 0, 'a returner was shown the episode card');
      check((await done(page)).includes('cable'), 'a returner lost what they’d done');
      // the vat faked before its game was built: the game stays idle, and its achievement comes on the visit
      await goto(page, 'vat', -400, 4207.4);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('vat'), null, { timeout: 30000, polling: 250 }).catch(() => {
        throw new Error('a returner who’d faked the death never got its achievement');
      });
      check((await page.evaluate(() => window.__C137__.api.act('vat', 'freeze'))).phase === 'idle', 'a returner’s vat started its game again');
      // Jerry picked up before the find was built: a Jerry picked does nothing, and no meter shows
      await goto(page, 'jerryboree', -400, 1703.4);
      await page.evaluate(() => ['find-jerrytv', 'find-jerrytv'].forEach((a) => window.__C137__.api.act('jerryboree', a)));
      await page.waitForTimeout(1000);
      check((await game(page, 'jerryboree', 'find')).phase === 'idle' && !(await page.locator('.rm-cluster[aria-label="Pick-up time"][data-on]').count()), 'a returner’s Jerryboree started its game again');
    },
    { seed: { 'tp-c137-done': ['cable', 'vat', 'jerryboree'] } },
  ),
  // the Citadel tells the story where it is and what's done there (episode 10
  // isn't built yet, so on Free roam nothing moves), and its steps still save
  citadel: Object.assign(
    async (page, errors) => {
      await page.goto(`${BASE}/#/c-137/citadel`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__CITADEL__?.api || document.querySelector('.citadel-world')?.dataset.mode === 'cards', null, { timeout: 600000, polling: 1000 });
      check(await page.evaluate(() => Boolean(window.__CITADEL__?.api)), 'the Citadel’s 3D world didn’t start');
      check(await page.evaluate(() => Boolean(window.__RMSTORY__)), 'the Citadel doesn’t read the story');
      const s = await story(page);
      check(s.freeRoam && s.episode === 0 && s.step === 0, `entering the Citadel moved the story to ${s.episode}.${s.step}`);
      const before = errors.length;
      await page.evaluate(() => window.__CITADEL__.complete('daycare'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-citadel-done') ?? '[]').includes('daycare'), null, { timeout: 5000 }).catch(() => {
        throw new Error('the Citadel didn’t keep the day care done');
      });
      await page.waitForTimeout(1000);
      check(errors.length === before, `errors after a Citadel step: ${errors.slice(before, before + 3).join('; ')}`);
    },
    { seed: { 'tp-c137-done': ['cable'] } },
  ),
  // a new visitor who lands on a planet from the map reads what to do there,
  // and episode 1's card waits for C-137
  async planet(page) {
    await c137(page, '#/c-137/birdworld');
    await page.waitForTimeout(2500);
    check((await page.locator('.rm-episode').count()) === 0, 'episode 1’s card showed on a planet');
    const said = (await page.locator('.rm-hud .rm-objective').first().textContent()).trim();
    check(said !== WIPED.steps[0].text && /Bird|Birdperson/.test(said), `the planet’s objective reads “${said}”`);
    await page.getByRole('link', { name: 'Home to C-137' }).first().click();
    await inArea(page, 'garage');
    await page.locator('.rm-episode').waitFor({ timeout: 20000 }).catch(() => {
      throw new Error('no episode card once home in C-137');
    });
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
  // a new visitor plays episode 2: Roy, then Plumbus Smash on the walkway
  // cabinet, its win told once the cabinet's overlay closes
  async 'episode-2'(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('.rm-episode');
    await card.waitFor({ timeout: 600000 });
    await page.keyboard.press('Shift');
    await card.waitFor({ state: 'detached', timeout: 5000 });
    await built(page);
    for (const { id } of WIPED.steps) await page.evaluate((id) => window.__C137__.complete(id), id);
    await card.waitFor({ timeout: 10000 });
    await page.keyboard.press('Shift');
    await card.waitFor({ state: 'detached', timeout: 5000 });
    await reads(page, ARCADE.steps[0].text);
    await page.evaluate(() => window.__C137__.complete('roy'));
    await reads(page, ARCADE.steps[1].text);
    // the cabinet: up over the page, and nothing won by opening it
    await goto(page, 'arcade', -292.6, 300, 0);
    await use(page, 'cabinet2');
    const cab = place(page, 'cabinet2');
    await cab.locator('.cabinet').waitFor({ timeout: 60000 }).catch(() => {
      throw new Error('the walkway cabinet didn’t open Plumbus Smash');
    });
    const wins = async () => (await story(page)).wins;
    check(!(await wins()).includes('cabinet'), 'the cabinet counted as won when it opened');
    // a run lost counts nothing
    await cab.getByRole('button', { name: 'Start' }).click();
    await page.evaluate(() => {
      const c = window.__CABINET__;
      c.set({ ...c.state, lives: 1, drops: [{ id: 999, lane: 0, y: 0.999 }] });
      c.step({});
    });
    await cab.getByRole('button', { name: 'Again' }).waitFor({ timeout: 5000 });
    check(!(await wins()).includes('cabinet'), 'a lost run counted');
    await cab.getByRole('button', { name: 'Again' }).click();
    if (OUT) {
      // (a run part-way, set rather than played: a headless browser draws a few frames a second)
      await page.evaluate(() => {
        const c = window.__CABINET__;
        c.set({ ...c.state, score: 4250, smashed: 17, lives: 2, drops: [{ id: 901, lane: 0, y: 0.18 }, { id: 902, lane: 1, y: 0.7 }, { id: 903, lane: 2, y: 0.44 }] });
      });
      await page.screenshot({ path: `${OUT}/episode-2-cabinet.png` });
    }
    // one smash short of the target, a plumbus in reach: one press wins, while the overlay's still up
    await page.evaluate(() => {
      const c = window.__CABINET__;
      c.set({ ...c.state, score: c.state.target - 250, stuck: 0, drops: [{ id: 999, lane: 1, y: 0.8 }] });
      c.step({ smash: 1 });
    });
    await page.waitForFunction(() => window.__RMSTORY__.get().wins.includes('cabinet'), null, { timeout: 5000 }).catch(() => {
      throw new Error('the cabinet’s win didn’t count');
    });
    check(await cab.isVisible(), 'the overlay closed on the win');
    check((await page.locator('.rm-toast', { hasText: ARCADE.outro[0][1] }).count()) === 0, 'the closing line was said under the overlay');
    check((await page.locator('.rm-episode').count()) === 0, 'episode 3’s card showed under the overlay');
    await cab.getByRole('button', { name: 'Leave' }).first().click();
    await cab.waitFor({ state: 'detached', timeout: 10000 });
    await toast(page, ARCADE.outro[0][1]);
    // and on into episode 3: its card, the places episode 2 opened, the next ones still shut
    await cardFor(page, 2);
    await at(page, 2, 0, 'after episode 2');
    await opens(page, ['agency', 'simulation'], true, 'after episode 2');
    await opens(page, ['microverse', 'anatomy', 'storytrain', 'vat'], false, 'after episode 2');
    await reads(page, GUESTS.steps[0].text);
  },
  // a new visitor plays episode 3: Total Rickall from the egg, Dr. Wong's
  // therapy, and the sewer run under the agency, counted the moment it's won
  // and told once its overlay closes
  async 'episode-3'(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    await page.locator('.rm-episode').waitFor({ timeout: 600000 });
    await page.keyboard.press('Shift');
    await page.locator('.rm-episode').waitFor({ state: 'detached', timeout: 5000 });
    await built(page);
    // episodes 1 and 2 (the cabinet's played in episode-2: won here before its step)
    await page.evaluate(() => window.__RMSTORY__.feed({ type: 'win', game: 'cabinet' }));
    for (const { id } of WIPED.steps) await page.evaluate((id) => window.__C137__.complete(id), id);
    await cardFor(page, 1);
    await page.evaluate(() => window.__C137__.complete('roy'));
    await toast(page, ARCADE.outro[0][1]);
    await cardFor(page, 2);
    await at(page, 2, 0, 'at episode 3');
    await reads(page, GUESTS.steps[0].text);
    // Total Rickall: stopped, or lost, it counts nothing; won, it does
    await goto(page, 'house', -305.7, -7.1, -0.5);
    await use(page, 'egg');
    await rickallOn(page);
    check(!(await done(page)).includes('rickall'), 'Total Rickall counted when it started');
    await page.evaluate(() => window.__C137__.stopRickall());
    await page.evaluate(() => window.__C137__.rickall(23));
    await rickallOn(page);
    await shootAt(page, 'jerry');
    await page.locator('.rm-ending', { hasText: 'Not a parasite' }).waitFor({ timeout: 10000 });
    check(!(await done(page)).includes('rickall'), 'a lost Total Rickall counted');
    await at(page, 2, 0, 'after a lost Total Rickall');
    await page.evaluate(() => window.__C137__.rickall(23));
    await rickallOn(page);
    const parasites = await page.evaluate(() => window.__C137__.sim.rickall.game.people.filter((p) => p.parasite).map((p) => p.id));
    for (const id of parasites) await shootAt(page, id);
    await toast(page, 'Survive Total Rickall');
    await page.locator('.rm-ending', { hasText: 'Survived' }).getByRole('button', { name: 'Leave it there' }).click();
    await reads(page, GUESTS.steps[1].text);
    await at(page, 2, 1, 'after Total Rickall');
    // Dr. Wong: next door to Shoney's; the talk counts a moment after
    await goto(page, 'street', 24, -13.2, N);
    await use(page, 'wong-door');
    await inArea(page, 'wong');
    await goto(page, 'wong', -300, 897.2, N);
    await use(page, 'therapy');
    await toast(page, 'Go to family therapy');
    await reads(page, GUESTS.steps[2].text);
    await at(page, 2, 2, 'after therapy');
    // the sewer: dialled, the hole in the agency's floor, won, and left with a real Esc
    check((await page.evaluate(() => window.__C137__.dial('agency'))) === 'agency', 'the dial wouldn’t take the agency');
    await goto(page, 'agency', -417.6, 4011.4, -1.02); // (clear of the guards at the portal's arrival)
    await use(page, 'sewer');
    const hole = place(page, 'sewer');
    const anyway = hole.getByRole('button', { name: 'Play anyway (slow)' });
    await Promise.race([hole.locator('.sewer').waitFor({ timeout: 120000 }), anyway.waitFor({ timeout: 120000 })]).catch(() => {
      throw new Error('the hole didn’t open the sewer run');
    });
    if (await anyway.count()) await anyway.click();
    await hole.getByRole('button', { name: 'Roll', exact: true }).click({ timeout: 120000 });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-3-sewer.png` });
    check(!(await done(page)).includes('sewer'), 'the sewer counted before it was won');
    await page.evaluate(() => {
      const w = window.__SEWER__;
      w.set({ ...w.state, x: 419.9, items: [], next: 1e6 });
    });
    await hole.getByRole('heading', { name: 'Made it' }).waitFor({ timeout: 60000 });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('sewer'), null, { timeout: 5000 }).catch(() => {
      throw new Error('the sewer didn’t count once it was won');
    });
    check((await page.locator('.rm-toast', { hasText: GUESTS.outro[0][1] }).count()) === 0, 'the closing line was said under the overlay');
    await page.keyboard.press('Escape');
    await hole.waitFor({ state: 'detached', timeout: 10000 });
    await toast(page, GUESTS.outro[0][1]);
    // and on into episode 4: its card, the places episode 3 opened, the next ones still shut
    await cardFor(page, 3);
    await at(page, 3, 0, 'after the sewer');
    await opens(page, GUESTS.unlocks, true, 'after episode 3');
    await opens(page, ['gromflomites', 'fortress', 'vat'], false, 'after episode 3');
    await reads(page, SMALL.steps[0].text);
  },
  // a new visitor plays episode 4: the Microverse's power run (lost once,
  // then won) and Anatomy Park's chase (caught once, then out on the clock)
  async 'episode-4'(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    await page.locator('.rm-episode').waitFor({ timeout: 600000 });
    await page.keyboard.press('Shift');
    await page.locator('.rm-episode').waitFor({ state: 'detached', timeout: 5000 });
    await built(page);
    // episodes 1 to 3, each played in its own scenario (the cabinet's won here before its step)
    await page.evaluate(() => window.__RMSTORY__.feed({ type: 'win', game: 'cabinet' }));
    for (const { id } of WIPED.steps) await page.evaluate((id) => window.__C137__.complete(id), id);
    await cardFor(page, 1);
    await page.evaluate(() => window.__C137__.complete('roy'));
    await cardFor(page, 2);
    for (const id of ['rickall', 'wong', 'sewer']) await page.evaluate((id) => window.__C137__.complete(id), id);
    await toast(page, GUESTS.outro[0][1]);
    await cardFor(page, 3);
    await at(page, 3, 0, 'at episode 4');
    await reads(page, SMALL.steps[0].text);
    // the Microverse: the charge runs from the first cell taken; run out, Morty's back at the way in
    check((await page.evaluate(() => window.__C137__.dial('microverse'))) === 'microverse', 'the dial wouldn’t take the Microverse');
    await throughPortal(page);
    await inArea(page, 'microverse');
    const power = () => page.evaluate(() => window.__C137__.api.act('microverse', 'power'));
    check((await power()).phase === 'idle', 'the charge ran before a cell was taken');
    await warpUse(page, 'microverse', 'zeepcells', -404.2, 1395.4);
    // (a press is the place's to take on its next frame)
    await page.waitForFunction(() => window.__C137__.api.act('microverse', 'power').phase === 'run', null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('taking a cell didn’t start the run');
    });
    await page.locator('.rm-cluster[aria-label="The world’s charge"][data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no charge meter on the HUD');
    });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-4-microverse.png` });
    await page.evaluate(() => window.__C137__.api.act('microverse', 'setPower', { charge: 0.05 }));
    await caught(page, 1403.4);
    check((await power()).phase === 'idle', 'the run didn’t start afresh');
    check(!(await done(page)).includes('microverse'), 'a lost run counted');
    // four cells to the gooble boxes
    for (let i = 0; i < 4; i++) {
      await warpUse(page, 'microverse', 'zeepcells', -404.2, 1395.4);
      await warpUse(page, 'microverse', 'gooble', -406, 1401);
    }
    await toast(page, 'Power Zeep’s world');
    await reads(page, SMALL.steps[1].text);
    await at(page, 3, 1, 'after the Microverse');
    await warpUse(page, 'microverse', 'microverse-portal', -400, 1405.6, -N);
    await inArea(page, 'garage');
    // Anatomy Park: caught, the pieces are lost; all four found, out through the portal on the clock
    check((await page.evaluate(() => window.__C137__.dial('anatomy'))) === 'anatomy', 'the dial wouldn’t take Anatomy Park');
    await throughPortal(page);
    await inArea(page, 'anatomy');
    await page.waitForFunction(() => (window.__C137__.api.act('anatomy', 'npcs') ?? []).some((n) => n.id === 'loose-tuberculosis'), null, { timeout: 120000, polling: 500 });
    const tb = await page.evaluate(() => window.__C137__.api.act('anatomy', 'npcs').find((n) => n.id === 'loose-tuberculosis'));
    await page.evaluate(([x, z]) => window.__C137__.warp('anatomy', x + 0.6, z, Math.PI), [tb.x, tb.z]);
    await caught(page, 1508.4);
    check(!(await done(page)).includes('anatomy'), 'a catch counted');
    const PIECES = [
      ['mapkiosk', -414, 1504.4],
      ['mapspleen', -403.5, 1495.4],
      ['maprib', -382.2, 1489.4],
      ['mapboat', -381.6, 1501],
    ];
    // (a disease may catch him at a piece: each catch a reset, checked, and round again)
    let found = false;
    for (let round = 0; round < 4 && !found; round++) {
      for (const [id, x, z] of PIECES) await warpUse(page, 'anatomy', id, x, z).catch(() => {});
      found = await page.evaluate(() => window.__C137__.sim.escape?.task === 'anatomy');
      if (!found) await caught(page, 1508.4);
    }
    check(found, 'the park map’s four pieces never started the clock');
    if (OUT) await page.screenshot({ path: `${OUT}/episode-4-anatomy.png` });
    await warpUse(page, 'anatomy', 'anatomy-portal', -400, 1510.6, -N);
    await toast(page, SMALL.outro[0][1]);
    // and on into episode 5: its card, the places episode 4 opened, the next ones still shut
    await cardFor(page, 4);
    await at(page, 4, 0, 'after Anatomy Park');
    await opens(page, SMALL.unlocks, true, 'after episode 4');
    await opens(page, HEAT.unlocks, false, 'after episode 4');
    await reads(page, HEAT.steps[0].text);
  },
  // a new visitor plays episode 5: the cruiser's chase (taking off ticks
  // nothing; lost once, then won) and the Gromflomite base (caught once,
  // then the cell opened)
  async 'episode-5'(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    await page.locator('.rm-episode').waitFor({ timeout: 600000 });
    await page.keyboard.press('Shift');
    await page.locator('.rm-episode').waitFor({ state: 'detached', timeout: 5000 });
    await built(page);
    // episodes 1 to 4, each played in its own scenario
    await page.evaluate(() => window.__RMSTORY__.feed({ type: 'win', game: 'cabinet' }));
    for (const { id } of WIPED.steps) await page.evaluate((id) => window.__C137__.complete(id), id);
    await cardFor(page, 1);
    await page.evaluate(() => window.__C137__.complete('roy'));
    await cardFor(page, 2);
    for (const id of ['rickall', 'wong', 'sewer']) await page.evaluate((id) => window.__C137__.complete(id), id);
    await cardFor(page, 3);
    for (const id of ['microverse', 'anatomy']) await page.evaluate((id) => window.__C137__.complete(id), id);
    await toast(page, SMALL.outro[0][1]);
    await cardFor(page, 4);
    await at(page, 4, 0, 'at episode 5');
    await reads(page, HEAT.steps[0].text);
    // the cruiser boarded and taken up: that's not the chase, and ticks nothing
    await goto(page, 'street', -19, -8.3, -N);
    await use(page, 'cruiser');
    await page.waitForFunction(() => window.__C137__.sim.flying, null, { timeout: 10000, polling: 100 });
    await page.evaluate(() => {
      const s = window.__C137__.sim;
      s.c = { ...s.c, y: 8 };
    });
    await page.waitForTimeout(1000);
    check(!(await done(page)).includes('fly'), 'taking off ticked the fly task');
    await page.waitForFunction(() => Boolean(window.__C137__.fight()), null, { timeout: 60000, polling: 250 });
    // through the first ring: the run's on, the Federation ship on the cruiser, the meter up
    await before(page, COURSE[0]);
    await chasing(page, 'run', 'flying through the first ring didn’t start the chase');
    check((await page.evaluate(() => window.__C137__.fight().patrol.mode)) === 'fight', 'the Federation ship wasn’t turned on the cruiser');
    await page.locator('.rm-chase[data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no chase meter on the HUD');
    });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-5-chase.png` });
    // three hits: lost, and back before the first ring, the ship let go
    await page.evaluate(() => {
      const s = window.__C137__.sim;
      s.chase = { ...s.chase, hits: s.chase.max };
    });
    await toast(page, 'Three hits');
    const start = chaseStart(newChase());
    await page
      .waitForFunction(([x, z]) => {
        const s = window.__C137__.sim;
        return !s.fading && s.chase.phase === 'idle' && Math.hypot(s.c.x - x, s.c.z - z) < 0.5;
      }, [start.x, start.z], { timeout: 30000, polling: 100 })
      .catch(() => {
        throw new Error('a lost chase didn’t start again before the first ring');
      });
    check((await page.evaluate(() => window.__C137__.fight().patrol.mode)) === 'calm', 'the Federation ship kept on after a lost chase');
    check(!(await story(page)).wins.includes('chase') && !(await done(page)).includes('fly'), 'a lost chase counted');
    // through the first ring again, and on to the last: won
    await before(page, COURSE[0]);
    await chasing(page, 'run', 'the first ring didn’t start the chase again');
    await page.evaluate((r) => {
      const s = window.__C137__.sim;
      s.chase = { ...s.chase, next: s.chase.rings.length - 1, hits: 0 };
      s.c = { ...s.c, x: r.x - Math.sin(r.yaw), y: r.y, z: r.z - Math.cos(r.yaw), yaw: r.yaw, speed: 10, vy: 0 };
    }, COURSE.at(-1));
    await page.waitForFunction(() => window.__RMSTORY__.get().wins.includes('chase'), null, { timeout: 60000, polling: 100 }).catch(() => {
      throw new Error('the last ring didn’t win the chase');
    });
    await toast(page, 'Fly the cruiser');
    check((await done(page)).includes('fly'), 'the chase won didn’t tick the fly task');
    await at(page, 4, 1, 'after the chase');
    await reads(page, HEAT.steps[1].text);
    await page.waitForFunction(() => window.__C137__.sim.fed.mode === 'loop', null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('the Federation ship stayed on the cruiser once shaken');
    });
    // the Gromflomite base: caught once, back at the way in; then the cell opened
    check((await page.evaluate(() => window.__C137__.dial('gromflomites'))) === 'gromflomites', 'the dial wouldn’t take the Gromflomite base');
    await throughPortal(page);
    await inArea(page, 'gromflomites');
    await page.waitForFunction(() => (window.__C137__.api.act('gromflomites', 'npcs') ?? []).some((n) => n.id === 'guard-a'), null, { timeout: 120000, polling: 500 });
    const guard = await page.evaluate(() => window.__C137__.api.act('gromflomites', 'npcs').find((n) => n.id === 'guard-a'));
    await page.evaluate(([x, z]) => window.__C137__.warp('gromflomites', x + 0.6, z, Math.PI), [guard.x, guard.z]);
    await caught(page, 2713.4);
    check(!(await done(page)).includes('gromflomites'), 'a catch counted');
    // (a guard may catch him at the cell: each catch a reset, checked, and round again)
    let opened = false;
    for (let round = 0; round < 4 && !opened; round++) {
      await warpUse(page, 'gromflomites', 'fartcell', -400, 2688.4, -N).catch(() => {});
      opened = await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('gromflomites'), null, { timeout: 30000, polling: 250 }).then(
        () => true,
        () => false,
      );
      if (!opened) await caught(page, 2713.4);
    }
    check(opened, 'Fart’s cell never opened');
    if (OUT) await page.screenshot({ path: `${OUT}/episode-5-gromflomites.png` });
    await toast(page, HEAT.outro[0][1]);
    // and on into episode 6: its card, the places episode 5 opened, the next ones still shut
    await cardFor(page, 5);
    await at(page, 5, 0, 'after the Gromflomite base');
    await opens(page, HEAT.unlocks, true, 'after episode 5');
    await opens(page, DEALS.unlocks, false, 'after episode 5');
    await reads(page, DEALS.steps[0].text);
  },
  // a new visitor plays episode 6: Needful Things' deal (a curse seen and
  // left, a curse chanced and caught, then the clean thing taken) and the
  // vat's freeze (caught moving while they look, then in behind their backs
  // and played dead)
  async 'episode-6'(page) {
    await playTo(page, 5, ['cabinet', 'chase']);
    await at(page, 5, 0, 'at episode 6');
    await reads(page, DEALS.steps[0].text);
    // Needful Things: four of the five cursed, as the check sets it
    check((await page.evaluate(() => window.__C137__.dial('needful'))) === 'needful', 'the dial wouldn’t take Needful Things');
    await throughPortal(page);
    await inArea(page, 'needful');
    check((await game(page, 'needful', 'deal')).phase === 'idle', 'the deal started before anything was looked at');
    await page.evaluate(() => window.__C137__.api.act('needful', 'setDeal', { bad: ['typewriter', 'aftershave', 'cream', 'shopclock'] }));
    const seen = (id, saw) =>
      page.waitForFunction(([id, saw]) => window.__C137__.api.act('needful', 'deal').seen[id] === saw, [id, saw], { timeout: 30000, polling: 100 }).catch(() => {
        throw new Error(`looking at ${id} didn’t see it ${saw}`);
      });
    await warpUse(page, 'needful', 'typewriter', -403.8, 1598, Math.PI);
    await seen('typewriter', 'bad');
    await page.locator('.rm-cluster[aria-label="The deal"][data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no deal meter on the HUD');
    });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-6-needful.png` });
    // (a curse seen, used again at once: nothing taken, and no catch)
    await use(page, 'typewriter');
    await page.waitForTimeout(1000);
    const after = await game(page, 'needful', 'deal');
    check(after.phase === 'run' && after.taken.length === 0 && !(await page.evaluate(() => window.__C137__.sim.fading)), 'a curse seen and left was taken');
    await warpUse(page, 'needful', 'aftershave', -396.2, 1598, 0);
    await seen('aftershave', 'bad');
    await warpUse(page, 'needful', 'cream', -396.2, 1601.5, 0);
    await seen('cream', 'bad');
    check((await game(page, 'needful', 'deal')).left === 0, 'three looks didn’t use the looks up');
    // no looks left: the clock chanced, and cursed
    await warpUse(page, 'needful', 'shopclock', -402.5, 1595.6, N);
    await seen('shopclock', 'blind');
    await use(page, 'shopclock');
    await caught(page, 1600.9);
    check((await game(page, 'needful', 'deal')).phase === 'idle' && !(await done(page)).includes('needful'), 'a cursed thing taken counted');
    // dealt afresh: the mirror the clean one, looked over and taken by two presses in one frame (both count)
    await page.evaluate(() => {
      const act = (...a) => window.__C137__.api.act('needful', ...a);
      act('setDeal', { bad: ['typewriter', 'aftershave', 'cream', 'shopclock'] });
      act('deal-shopmirror');
      act('deal-shopmirror');
    });
    await toast(page, 'Take something free from Mr. Needful');
    await at(page, 5, 1, 'after Needful Things');
    await reads(page, DEALS.steps[1].text);
    await warpUse(page, 'needful', 'needful-portal', -400, 1603.1, -N);
    await inArea(page, 'garage');
    // the vat: caught moving (a real step) while they look; then in behind their backs, and played dead
    check((await page.evaluate(() => window.__C137__.dial('vat'))) === 'vat', 'the dial wouldn’t take the vat');
    await throughPortal(page);
    await inArea(page, 'vat');
    check((await game(page, 'vat', 'freeze')).phase === 'idle', 'the freeze started before Morty moved');
    await page.evaluate(() => window.__C137__.api.act('vat', 'setFreeze', { phase: 'run', eyes: 'look', left: 30, len: 30 }));
    await page.locator('.rm-cluster[aria-label="Who’s looking"][data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no freeze meter on the HUD');
    });
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__C137__.sim.fading, null, { timeout: 30000, polling: 50 }).catch(() => {
      throw new Error('moving while they looked wasn’t seen');
    });
    await page.keyboard.up('KeyW');
    await caught(page, 4207.4);
    check((await game(page, 'vat', 'freeze')).phase === 'idle' && !(await done(page)).includes('vat'), 'a move while they looked counted');
    await page.evaluate(() => window.__C137__.api.act('vat', 'setFreeze', { phase: 'run', eyes: 'away', left: 30, len: 30 }));
    await warpUse(page, 'vat', 'vatrim', -400, 4199.4, N);
    await page.waitForFunction(() => window.__C137__.api.act('vat', 'freeze').phase === 'in', null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('jumping in behind their backs didn’t take him in');
    });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-6-vat.png` });
    await page.evaluate(() => window.__C137__.api.act('vat', 'setFreeze', { left: 0.05 }));
    // (the episode's last step: its closing line is the toast, as the base's and Anatomy Park's are)
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('vat'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('playing dead in the vat didn’t count');
    });
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]'))).includes('vat'), 'the fake death’s achievement wasn’t earned');
    await toast(page, DEALS.outro[0][1]);
    // and on into episode 7: its card, the places episode 6 opened, the next ones still shut
    await cardFor(page, 6);
    await at(page, 6, 0, 'after the vat');
    await opens(page, DEALS.unlocks, true, 'after episode 6');
    await opens(page, JERRY.unlocks, false, 'after episode 6');
    await reads(page, JERRY.steps[0].text);
  },
  // a new visitor plays episode 7: the Jerryboree's find (a wrong Jerry
  // picked costs time, the clock run out and back at the door, then ours
  // picked) and St. Gloopy Noops (a doctor's catch, then Shrimply and
  // Jerry's things in the theatre, and out through the portal on the clock)
  async 'episode-7'(page) {
    await playTo(page, 6, ['cabinet', 'chase']);
    await at(page, 6, 0, 'at episode 7');
    await reads(page, JERRY.steps[0].text);
    // the Jerryboree: ours dealt as the check sets it
    check((await page.evaluate(() => window.__C137__.dial('jerryboree'))) === 'jerryboree', 'the dial wouldn’t take the Jerryboree');
    await throughPortal(page);
    await inArea(page, 'jerryboree');
    check((await game(page, 'jerryboree', 'find')).phase === 'idle', 'the find started before a Jerry was talked to');
    const ours = (id) => page.evaluate((id) => window.__C137__.api.act('jerryboree', 'setFind', { ours: id }), id);
    await ours('jerryreal');
    // the Jerry at the TV: talked to (the clock on, the meter up), then picked: not ours, and time off the clock
    await warpUse(page, 'jerryboree', 'jerrytv', -402, 1695.8, N);
    await page.waitForFunction(() => window.__C137__.api.act('jerryboree', 'find').heard.includes('jerrytv'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('talking to a Jerry didn’t start the find');
    });
    await page.locator('.rm-cluster[aria-label="Pick-up time"][data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no find meter on the HUD');
    });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-7-jerryboree.png` });
    await use(page, 'jerrytv');
    await page.waitForFunction(() => window.__C137__.api.act('jerryboree', 'find').wrong.includes('jerrytv'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('a wrong Jerry picked wasn’t counted wrong');
    });
    const left = (await game(page, 'jerryboree', 'find')).left;
    check(left <= 30 && !(await done(page)).includes('jerryboree'), `a wrong Jerry picked left ${left} s, or counted`);
    // out of time: back at the door, the find idle, nothing done
    await page.evaluate(() => window.__C137__.api.act('jerryboree', 'setFind', { left: 0.05 }));
    await caught(page, 1703.4);
    check((await game(page, 'jerryboree', 'find')).phase === 'idle' && !(await done(page)).includes('jerryboree'), 'a find run out of time counted');
    // dealt afresh: ours the Jerry by the door, talked to and picked
    await ours('jerryreal');
    await warpUse(page, 'jerryboree', 'jerryreal', -405.7, 1704.5, Math.PI);
    await use(page, 'jerryreal');
    await toast(page, 'Pick up the right Jerry');
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]'))).includes('jerryboree'), 'the right Jerry’s achievement wasn’t earned');
    await at(page, 6, 1, 'after the Jerryboree');
    await reads(page, JERRY.steps[1].text);
    await warpUse(page, 'jerryboree', 'jerryboree-portal', -400, 1705.6, -N);
    await inArea(page, 'garage');
    // St. Gloopy Noops: a doctor's catch; then Shrimply and Jerry's things, and out on the clock
    check((await page.evaluate(() => window.__C137__.dial('gloopynoops'))) === 'gloopynoops', 'the dial wouldn’t take St. Gloopy Noops');
    await throughPortal(page);
    await inArea(page, 'gloopynoops');
    await page.waitForFunction(() => (window.__C137__.api.act('gloopynoops', 'npcs') ?? []).some((n) => n.id === 'gdoctor-b'), null, { timeout: 120000, polling: 500 });
    const doc = await page.evaluate(() => window.__C137__.api.act('gloopynoops', 'npcs').find((n) => n.id === 'gdoctor-b'));
    await page.evaluate(([x, z]) => window.__C137__.warp('gloopynoops', x + 0.6, z, Math.PI), [doc.x, doc.z]);
    await caught(page, 3112.4);
    check(!(await done(page)).includes('gloopynoops'), 'a catch counted');
    const THINGS = [
      ['shrimply', -400, 3090.2, N],
      ['jerrysthings', -396.6, 3086.8, Math.PI],
    ];
    // (a doctor may catch him in the theatre: each catch a reset, checked, and round again)
    let taken = false;
    for (let round = 0; round < 4 && !taken; round++) {
      for (const [id, x, z, f] of THINGS) await warpUse(page, 'gloopynoops', id, x, z, f).catch(() => {});
      taken = await page.evaluate(() => window.__C137__.sim.escape?.task === 'gloopynoops');
      if (!taken) await caught(page, 3112.4);
    }
    check(taken, 'Jerry’s things taken back never started the clock');
    if (OUT) await page.screenshot({ path: `${OUT}/episode-7-gloopynoops.png` });
    await warpUse(page, 'gloopynoops', 'gloopynoops-portal', -400, 3114.6, -N);
    // (the episode's last step: its closing line is the toast, and the way out earns its achievement)
    await toast(page, JERRY.outro[0][1]);
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]'))).includes('gloopynoops'), 'the hospital’s achievement wasn’t earned');
    await at(page, 7, 0, 'after St. Gloopy Noops');
    await opens(page, [...JERRY.unlocks, 'citadel', 'squanch', 'evilrick'], true, 'after episode 7');
    await page.waitForTimeout(1500);
    check((await page.locator('.rm-episode').count()) === 0, 'a card showed for an episode that isn’t built');
    await reads(page, 'Go into the Smith house and put interdimensional cable on the TV.');
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
