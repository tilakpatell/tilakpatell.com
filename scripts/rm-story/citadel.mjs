// The browser check's scenarios at the Citadel (../rm-story-check.mjs), past
// episode 10's own (./late.mjs): a new visitor who lands there first, the
// visit's card when the Citadel's is to show (held under it, a pad's press
// closing it, the story come to its door again), an escape made before the
// story sent him, and the Citadel with no 3D.
/* global window */
import { BASE, OUT, check, built, reads, story, at, cardFor, inArea, WIPED, CITADEL, CITADEL_LINE, citadelUp, citadelReads, citadelToast } from './helpers.mjs';

const ALL = ['daycare', 'wafers', 'council', 'votemorty', 'citadelout', 'locos'];
const AT_DOOR = { v: 1, data: { episode: 9, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } };
const noCard = async (page, ms, what) => {
  await page.waitForTimeout(ms);
  check((await page.locator('.rm-episode').count()) === 0, what);
};
const home = async (page) => {
  await page.getByRole('link', { name: 'Back to Dimension C-137' }).click();
  await inArea(page, 'garage');
};

export const AT_THE_CITADEL = {
  // a new visitor lands on the Citadel first (the map, a link): no card and
  // no story there, its own line; home, episode 1's card is C-137's still
  async 'citadel-first'(page) {
    await page.goto(`${BASE}/#/c-137/citadel`, { waitUntil: 'domcontentloaded' });
    await citadelUp(page);
    await noCard(page, 2000, 'episode 1’s card showed at the Citadel');
    const s = await story(page);
    check(!s.freeRoam && s.episode === 0 && s.step === 0, `a new visitor's story is at ${s.episode}.${s.step}${s.freeRoam ? ' on Free roam' : ''}`);
    await citadelReads(page, null, CITADEL_LINE([]));
    await home(page);
    await cardFor(page, 0);
    await reads(page, WIPED.steps[0].text);
  },
  // the visit's card is the Citadel's (the story at its door, on a visit
  // that starts there): shown on red alert with the world held under it, a
  // pad's press closes it; a reload shows none; the story come to the door
  // while the page is open is told it's there; home, no second card
  'citadel-door': Object.assign(
    async (page) => {
      await page.goto(`${BASE}/#/c-137/citadel`, { waitUntil: 'domcontentloaded' });
      await citadelUp(page);
      await page.locator('.citadel-stage[data-mood="red"] .rm-episode').waitFor({ timeout: 20000 }).catch(() => {
        throw new Error('no card for episode 10 at the Citadel');
      });
      const said = await page.locator('.rm-episode').textContent();
      check(said.includes('Episode 10') && said.includes(CITADEL.title) && said.includes(CITADEL.intro[0][1]), `episode 10’s card says “${said}”`);
      // held: no clock runs and no Cop Rick sees him
      const t0 = await page.evaluate(() => window.__CITADEL__.sim.t);
      await page.waitForTimeout(1000);
      check((await page.evaluate(() => window.__CITADEL__.sim.t)) === t0, 'the Citadel ran on under the card');
      check((await page.locator('.citadel-wanted').textContent()).includes('Wanted: Rick C-137'), 'a Cop Rick saw him under the card');
      if (OUT) {
        await page.screenshot({ path: `${OUT}/citadel-door-1280.png` });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/citadel-door-390.png` });
        await page.setViewportSize({ width: 1280, height: 720 });
      }
      // a pad: at rest it's no move; X (nothing at the Citadel) is
      await page.evaluate(() => {
        const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
        window.__pad = pad;
        Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
      });
      await page.waitForTimeout(600);
      check((await page.locator('.rm-episode').count()) === 1, 'a pad at rest closed the card');
      await page.evaluate(() => {
        window.__pad.buttons[2].pressed = true;
      });
      await page.locator('.rm-episode').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {
        throw new Error('a pad’s press didn’t close the card');
      });
      await page.waitForFunction((t) => window.__CITADEL__.sim.t > t, t0, { timeout: 10000 }).catch(() => {
        throw new Error('the Citadel stayed held after the card');
      });
      // a reload: the card was this visit's
      await page.reload({ waitUntil: 'domcontentloaded' });
      await citadelUp(page);
      await noCard(page, 2000, 'the card showed again on a reload');
      await at(page, 9, 1, 'at the Citadel');
      // the story come back to the door while the page is open (another tab, a jump): told it's here
      await page.evaluate(() => window.__RMSTORY__.jump(9));
      await page.waitForFunction(() => window.__RMSTORY__.get().step === 1, null, { timeout: 2000 }).catch(() => {
        throw new Error('the Citadel didn’t tell the story it’s at its door');
      });
      await citadelReads(page, CITADEL.steps[1].text, CITADEL_LINE(['daycare', 'wafers', 'council', 'votemorty']));
      await home(page);
      await noCard(page, 2500, 'episode 10’s card showed again in C-137');
      await reads(page, CITADEL.steps[1].text);
    },
    { seed: { 'tp-rm-story': AT_DOOR, 'tp-citadel-done': ['daycare', 'wafers', 'council', 'votemorty'] } },
  ),
  // the escape made before the story sent him: the Story tab ticks it, and
  // walking in ends the episode with Morty's line, said once, and no card
  'citadel-early': Object.assign(
    async (page) => {
      await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
      await page.locator('.rm-episode').waitFor({ timeout: 600000 });
      await cardFor(page, 9);
      await built(page);
      await page.keyboard.press('m');
      const list = page.locator('#rm-list');
      await list.waitFor({ timeout: 10000 });
      const ticked = (text) => list.locator('li[data-done]', { hasText: text }).count();
      check((await ticked('Get through the Citadel’s business')) === 1, 'the Story tab doesn’t tick an escape already made');
      check((await ticked('Dial the Citadel')) === 0, 'the Story tab ticks walking in before it’s done');
      await page.keyboard.press('m');
      await list.waitFor({ state: 'detached', timeout: 5000 });
      await page.locator('.rm-hud .rm-objective-link').click();
      await citadelUp(page);
      await citadelToast(page, CITADEL.outro[0][1], CITADEL.outro[0][0]);
      await at(page, 10, 0, 'walked in with the escape made');
      await noCard(page, 1000, 'a card showed for an episode that isn’t built');
      // said once
      await page.locator('.citadel-stage .shire-toast', { hasText: CITADEL.outro[0][1] }).waitFor({ state: 'detached', timeout: 15000 });
      await page.waitForTimeout(5000);
      check((await page.locator('.citadel-stage .shire-toast', { hasText: CITADEL.outro[0][1] }).count()) === 0, 'Morty’s line was said twice');
      await citadelReads(page, null, CITADEL_LINE(ALL));
    },
    { seed: { 'tp-rm-story': AT_DOOR, 'tp-citadel-done': ALL } },
  ),
  // with no 3D: the Citadel's own line in its lead, no card; turning the 3D
  // on brings the visit's card
  'citadel-cards': Object.assign(
    async (page) => {
      // (3D off is a bare word, not the seeds' JSON: set on a page of the site's that isn't the app)
      await page.goto(`${BASE}/icon.svg`);
      await page.evaluate(() => window.localStorage.setItem('tp-3d', 'off'));
      await page.goto(`${BASE}/#/c-137/citadel`, { waitUntil: 'domcontentloaded' });
      await page.locator('.citadel-world[data-mode="cards"]').waitFor({ timeout: 60000 });
      await page.waitForFunction(() => window.__RMSTORY__?.get().step === 1, null, { timeout: 10000 }).catch(() => {
        throw new Error('the Citadel with no 3D didn’t tell the story it’s here');
      });
      await noCard(page, 1500, 'a card showed with no 3D');
      const lead = await page.locator('.citadel-world .lead').first().textContent();
      check(lead.includes(CITADEL_LINE([])) && !lead.includes(CITADEL.steps[1].text), `the Citadel’s lead with no 3D reads “${lead}”`);
      await page.getByRole('button', { name: 'Turn 3D on' }).click();
      await citadelUp(page);
      await cardFor(page, 9);
    },
    { seed: { 'tp-rm-story': AT_DOOR } },
  ),
};
