// The browser check's first scenarios (../rm-story-check.mjs): episode 1
// from the street to Customs and back, the dial's lock, the ways home, Free
// roam, a returner, the Citadel, a planet landed on, and the toys ticking
// when they're played.
/* global window, document */
import { READY } from '../../src/components/rickmorty/adventure/episodes.js';
import { BASE, OUT, N, check, done, c137, built, goto, use, place, story, reads, WIPED, ARCADE, throughPortal, gun, toast, inArea, game, arriveOf, standOn, PLACES } from './helpers.mjs';

export const BASICS = {
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
      await goto(page, 'vat', ...arriveOf('vat'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('vat'), null, { timeout: 30000, polling: 250 }).catch(() => {
        throw new Error('a returner who’d faked the death never got its achievement');
      });
      check((await page.evaluate(() => window.__C137__.api.act('vat', 'freeze'))).phase === 'idle', 'a returner’s vat started its game again');
      // Jerry picked up before the find was built: a Jerry picked does nothing, and no meter shows
      await goto(page, 'jerryboree', ...arriveOf('jerryboree'));
      await page.evaluate(() => ['find-jerrytv', 'find-jerrytv'].forEach((a) => window.__C137__.api.act('jerryboree', a)));
      await page.waitForTimeout(1000);
      check((await game(page, 'jerryboree', 'find')).phase === 'idle' && !(await page.locator('.rm-cluster[aria-label="Pick-up time"][data-on]').count()), 'a returner’s Jerryboree started its game again');
      // the channels watched before the countdown was built: the booth starts nothing, no meter shows, and its achievement comes on the visit
      await goto(page, 'cablestudio', ...arriveOf('cablestudio'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('cablestudio'), null, { timeout: 30000, polling: 250 }).catch(() => {
        throw new Error('a returner who’d watched the channels never got the studio’s achievement');
      });
      await page.evaluate(() => window.__C137__.api.act('cablestudio', 'sequence-start'));
      await page.waitForTimeout(1000);
      check((await game(page, 'cablestudio', 'sequence')).phase === 'idle' && !(await page.locator('.rm-cluster[aria-label="Going live"][data-on]').count()), 'a returner’s cable studio started its game again');
      // the village helped before the climb was built: no meter at the stairs, the stairs never bite, and its achievement comes on the visit
      await goto(page, 'fantasy', ...arriveOf('fantasy'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('fantasy'), null, { timeout: 30000, polling: 250 }).catch(() => {
        throw new Error('a returner who’d helped the village never got its achievement');
      });
      const foot = PLACES.spot('fantasy', 'goblins');
      await page.evaluate(([x, z]) => window.__C137__.warp('fantasy', x, z, Math.PI / 2), [foot.x, foot.z + 1]);
      await page.waitForTimeout(1000);
      check(!(await page.locator('.rm-cluster[aria-label="Up the beanstalk"][data-on]').count()), 'a returner saw the climb’s meter');
      await page.evaluate(() => window.__C137__.api.act('fantasy', 'setClimb', { t: 3.45 }));
      await standOn(page, 'fantasy', 'g1-top');
      await page.waitForTimeout(1500);
      check((await game(page, 'fantasy', 'climb')).phase === 'idle' && (await page.evaluate(() => window.__C137__.sim.area)) === 'fantasy' && !(await page.evaluate(() => window.__C137__.sim.fading)), 'a returner’s stairs bit him');
    },
    { seed: { 'tp-c137-done': ['cable', 'vat', 'jerryboree', 'cablestudio', 'fantasy'] } },
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
};
