// The browser check's scenarios for episodes 2 to 4 (../rm-story-check.mjs):
// Roy and Plumbus Smash, the house guests and the sewer run, the Microverse
// and Anatomy Park.
/* global window */
import { BASE, OUT, N, check, done, built, goto, use, place, story, reads, WIPED, ARCADE, GUESTS, SMALL, HEAT, throughPortal, toast, inArea, cardFor, at, opens, shootAt, warpUse, caught, rickallOn, PLACES, homeOf, spotAt, wayInOf } from './helpers.mjs';

export const EARLY = {
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
    await goto(page, 'agency', ...spotAt('agency', 'sewer', -0.36, 1.7)); // (clear of the guards at the portal's arrival)
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
    await warpUse(page, 'microverse', 'zeepcells', ...spotAt('microverse', 'zeepcells', N, 1));
    // (a press is the place's to take on its next frame)
    await page.waitForFunction(() => window.__C137__.api.act('microverse', 'power').phase === 'run', null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('taking a cell didn’t start the run');
    });
    await page.locator('.rm-cluster[aria-label="The world’s charge"][data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no charge meter on the HUD');
    });
    if (OUT) await page.screenshot({ path: `${OUT}/episode-4-microverse.png` });
    await page.evaluate(() => window.__C137__.api.act('microverse', 'setPower', { charge: 0.05 }));
    await caught(page, wayInOf('microverse'));
    check((await power()).phase === 'idle', 'the run didn’t start afresh');
    check(!(await done(page)).includes('microverse'), 'a lost run counted');
    // four cells to the gooble boxes
    for (let i = 0; i < 4; i++) {
      await warpUse(page, 'microverse', 'zeepcells', ...spotAt('microverse', 'zeepcells', N, 1));
      await warpUse(page, 'microverse', 'gooble', ...spotAt('microverse', 'gooble', Math.PI, 1));
    }
    await toast(page, 'Power Zeep’s world');
    await reads(page, SMALL.steps[1].text);
    await at(page, 3, 1, 'after the Microverse');
    await warpUse(page, 'microverse', 'microverse-portal', ...homeOf('microverse'));
    await inArea(page, 'garage');
    // Anatomy Park: caught, the pieces are lost; all four found, out through the portal on the clock
    check((await page.evaluate(() => window.__C137__.dial('anatomy'))) === 'anatomy', 'the dial wouldn’t take Anatomy Park');
    await throughPortal(page);
    await inArea(page, 'anatomy');
    await page.waitForFunction(() => (window.__C137__.api.act('anatomy', 'npcs') ?? []).some((n) => n.id === 'loose-tuberculosis'), null, { timeout: 120000, polling: 500 });
    const tb = await page.evaluate(() => window.__C137__.api.act('anatomy', 'npcs').find((n) => n.id === 'loose-tuberculosis'));
    await page.evaluate(([x, z]) => window.__C137__.warp('anatomy', x + 0.6, z, Math.PI), [tb.x, tb.z]);
    await caught(page, wayInOf('anatomy'));
    check(!(await done(page)).includes('anatomy'), 'a catch counted');
    // (a disease may catch him at a piece: each catch a reset, checked, and round again)
    let found = false;
    for (let round = 0; round < 4 && !found; round++) {
      for (const id of PLACES.dest('anatomy').collect.spots) await warpUse(page, 'anatomy', id, ...spotAt('anatomy', id)).catch(() => {});
      found = await page.evaluate(() => window.__C137__.sim.escape?.task === 'anatomy');
      if (!found) await caught(page, wayInOf('anatomy'));
    }
    check(found, 'the park map’s four pieces never started the clock');
    if (OUT) await page.screenshot({ path: `${OUT}/episode-4-anatomy.png` });
    await warpUse(page, 'anatomy', 'anatomy-portal', ...homeOf('anatomy'));
    await toast(page, SMALL.outro[0][1]);
    // and on into episode 5: its card, the places episode 4 opened, the next ones still shut
    await cardFor(page, 4);
    await at(page, 4, 0, 'after Anatomy Park');
    await opens(page, SMALL.unlocks, true, 'after episode 4');
    await opens(page, HEAT.unlocks, false, 'after episode 4');
    await reads(page, HEAT.steps[0].text);
  },
};
