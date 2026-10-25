// The browser check's first scenarios (../rm-story-check.mjs): episode 1
// from the street to Customs and back (and its card kept for a visitor who
// scrolled away while it loaded), the dial's lock, the ways home, Free
// roam, a returner, the Citadel, a planet landed on, and the toys ticking
// when they're played.
/* global window, document, StorageEvent */
import { READY } from '../../src/components/rickmorty/adventure/episodes.js';
import { BASE, OUT, N, check, done, c137, built, goto, use, place, story, reads, WIPED, ARCADE, throughPortal, gun, toast, inArea, game, arriveOf, standOn, PLACES, CITADEL_LINE, citadelUp, citadelReads, warp, goalIs, dial, warpUse, spotAt, home, cardOnLine, cardFor, achieved, promptIs } from './helpers.mjs';

export const BASICS = {
  // another tab's ticks: kept when this one ticks, and this one's list
  // following as they're kept; and the last missing-cat poster ticks at once,
  // so a page left straight after can't lose it
  async tabs(page) {
    await c137(page);
    const keep = (ids) => page.evaluate((ids) => window.localStorage.setItem('tp-c137-done', JSON.stringify([...JSON.parse(window.localStorage.getItem('tp-c137-done') ?? '[]'), ...ids])), ids);
    await keep(['birdworld']);
    await page.evaluate(() => window.__C137__.complete('butter'));
    const d = await done(page);
    check(d.includes('birdworld') && d.includes('butter'), `another tab’s tick was lost as this one ticked: ${JSON.stringify(d)}`);
    await keep(['cable']);
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'tp-c137-done' })));
    await page.evaluate(() => window.__C137__.complete('cable'));
    await page.waitForTimeout(1500);
    check((await page.locator('.rm-toast', { hasText: 'Watch interdimensional cable' }).count()) === 0, 'this tab ticked again what another tab had kept');
    // the posters, all five read, and the page left at once
    const posters = await page.evaluate(async () => (await import('/src/components/rickmorty/world/town/plan.js')).POSTERS.map(({ id, x, z }) => ({ id, x, z })));
    for (const p of posters) {
      await goto(page, 'street', p.x, p.z, N);
      await use(page, p.id);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await built(page);
    check((await done(page)).includes('posters'), 'the posters, all read, didn’t count once the page was left at once');
  },
  // on a phone (390 × 664: a browser's own bars taken), episode 2's card
  // comes up with episode 1's closing line, and not over it
  'c137-phone': Object.assign(
    async (page) => {
      await page.setViewportSize({ width: 390, height: 664 });
      await c137(page);
      await page.evaluate(() => window.__C137__.complete('customs'));
      await cardOnLine(page, WIPED.outro[0][1]);
      await cardFor(page, 1);
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 0, step: 3, got: [], wins: [], freeRoam: false } }, 'tp-c137-done': ['diner', 'basement', 'mindblowers'] } },
  ),
  // Rick says Blips and Chitz is through the portal; dialled elsewhere, what
  // follows his line (once it's read) says where it goes
  'rick-aside': Object.assign(
    async (page) => {
      await c137(page);
      check((await page.evaluate(() => window.__C137__.dial('customs'))) === 'customs', 'the dial wouldn’t take Customs');
      const rick = await page.evaluate(async () => (await import('/src/components/rickmorty/world/rules.js')).HOTSPOTS.find((h) => h.id === 'rick'));
      await goto(page, 'garage', rick.x + 0.6, rick.z, Math.PI);
      await use(page, 'rick');
      await toast(page, 'Blips and Chitz is through there');
      await toast(page, 'Dialled to Interdimensional Customs. Step through the portal.');
    },
    { seed: { 'tp-c137-done': ['cable'] } },
  ),
  // a place whose task is done (here before its achievement could be earned:
  // an old save) hands the achievement over on the next visit
  'achieve-later': Object.assign(
    async (page) => {
      await c137(page);
      await dial(page, 'storytrain');
      await achieved(page, 'storytrain', 'the Story Train, done before, didn’t hand over its achievement');
    },
    { seed: { 'tp-c137-done': ['storytrain'] } },
  ),
  // a phone held sideways (844 × 390: a browser's own bars taken): the stick
  // and the buttons on screen, and the top row clear of them
  'c137-landscape': Object.assign(
    async (page) => {
      await c137(page);
      await page.locator('.rm-stick').waitFor({ timeout: 10000 });
      const at = await page.evaluate(() => {
        const box = (el) => el && (({ top, bottom, left, right }) => ({ top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), right: Math.round(right) }))(el.getBoundingClientRect());
        const under = (sel) => Array.from(document.querySelectorAll(sel), box);
        return { h: window.innerHeight, w: window.innerWidth, thumbs: [...under('.rm-hud-bottom .rm-stick'), ...under('.rm-hud-bottom .rm-pad button')], top: [...under('.rm-hud-top .rm-brand'), ...under('.rm-hud-top .rm-side')] };
      });
      check(at.thumbs.length >= 2, `sideways, the stick and buttons are ${JSON.stringify(at.thumbs)}`);
      for (const t of at.thumbs) check(t.top >= 0 && t.bottom <= at.h && t.right <= at.w, `sideways, a thumb’s control is off the screen (${JSON.stringify(t)} in ${at.w} × ${at.h})`);
      for (const r of at.top) for (const t of at.thumbs) check(!(r.top < t.bottom && t.top < r.bottom && r.left < t.right && t.left < r.right), `sideways, the top row (${JSON.stringify(r)}) runs into a thumb’s control (${JSON.stringify(t)})`);
    },
    { context: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } },
  ),
  // on a phone held upright (390 × 664, a touch screen): the portal gun's
  // chip keeps its word (the first hint names it), its dial's foot says tap,
  // not the keys, and the Checklist's pond row says its button, not E; and
  // what's tapped is a finger's 44 px: the dial's close and the list's, the
  // list's ways back, and each chip's hit area, over and under what's drawn
  'touch-words': Object.assign(
    async (page) => {
      await c137(page);
      await page.locator('.rm-stick').waitFor({ timeout: 10000 });
      const chip = page.locator('.rm-chip-gun');
      check(await chip.locator('span', { hasText: 'Portal gun' }).isVisible(), 'on a phone the portal gun’s chip has lost its word');
      // (its word doesn't widen the column under the map, so the title keeps its room)
      const at = await page.evaluate(() => ({ map: document.querySelector('.rm-map').getBoundingClientRect().width, gun: document.querySelector('.rm-chip-gun').getBoundingClientRect().width }));
      check(at.gun <= at.map, `on a phone the portal gun’s chip (${Math.round(at.gun)} px) is wider than the map (${Math.round(at.map)} px)`);
      await chip.tap();
      const foot = await page.locator('.rm-dial-foot').textContent();
      const tap = await page.evaluate(async () => (await import('/src/components/rickmorty/world/dimensions/dialKey.js')).TOUCH_FOOT.gun);
      check(foot === tap, `on a phone the dial’s foot says “${foot}”`);
      const size = (sel) =>
        page.evaluate((s) => {
          const r = document.querySelector(s).getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height) };
        }, sel);
      const x = await size('.rm-dial-x');
      check(x.w >= 44 && x.h >= 44, `on a phone the dial’s close is ${x.w} × ${x.h} px`);
      await page.locator('.rm-dial-x').tap();
      await page.locator('.rm-dial-box').waitFor({ state: 'detached', timeout: 5000 });
      await page.getByRole('button', { name: /Things to do/ }).first().tap();
      const list = page.locator('#rm-list');
      await list.waitFor({ timeout: 10000 });
      await list.getByRole('tab', { name: 'Checklist' }).tap();
      const pond = await page.evaluate(async () => (await import('/src/components/rickmorty/world/town/plan.js')).TOWN_TASKS.find((t) => t.id === 'pond'));
      const said = await list.locator('li', { hasText: pond.name }).locator('.rm-list-sub').textContent();
      check(said === pond.touch, `on a phone the pond’s row says “${said}”`);
      const close = await size('#rm-list .rm-icon-btn');
      check(close.w >= 44 && close.h >= 44, `on a phone the list’s close is ${close.w} × ${close.h} px`);
      const backs = await page.evaluate(() => Array.from(document.querySelectorAll('#rm-list .rm-list-back'), (a) => Math.round(a.getBoundingClientRect().height)));
      check(backs.length > 0 && backs.every((h) => h >= 44), `on a phone the list’s ways back are ${backs.join(', ')} px tall`);
      // (a chip's drawn 36 px: a tap 3 px over or under it still lands on it, not on the next)
      const hits = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.rm-side .rm-chip'))
          .filter((c) => c.getClientRects().length)
          .map((c) => {
            const r = c.getBoundingClientRect();
            return [r.top - 3, r.bottom + 3].every((y) => c.contains(document.elementFromPoint(r.left + r.width / 2, y)));
          }),
      );
      check(hits.length > 0 && hits.every(Boolean), `on a phone a tap just off a chip misses it (${JSON.stringify(hits)})`);
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 0, step: 3, got: [], wins: [], freeRoam: false } }, 'tp-c137-done': ['diner', 'basement', 'mindblowers'] }, context: { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true } },
  ),
  // at 1280 × 720 (a laptop) a toast hangs under the objective however many
  // lines it runs to (Customs' step runs to three), never over their ends
  'toast-under-line': Object.assign(
    async (page) => {
      await c137(page);
      await reads(page, WIPED.steps[3].text);
      const rick = await page.evaluate(async () => (await import('/src/components/rickmorty/world/rules.js')).HOTSPOTS.find((h) => h.id === 'rick'));
      await goto(page, 'garage', rick.x + 0.6, rick.z, Math.PI);
      await use(page, 'rick');
      await page.locator('.rm-toast').waitFor({ timeout: 10000 });
      await page.waitForTimeout(600); // (its rise in)
      const at = await page.evaluate(() => {
        const a = document.querySelector('.rm-toast').getBoundingClientRect();
        const b = document.querySelector('.rm-hud .rm-objective').getBoundingClientRect();
        return { over: a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right, toast: Math.round(a.top), line: Math.round(b.bottom), lines: Math.round(b.height) };
      });
      check(at.lines >= 50, `Customs’ step should run to two lines or more (the objective is ${at.lines} px tall)`);
      check(!at.over, `the toast (from ${at.toast}) is over the objective (to ${at.line})`);
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 0, step: 3, got: [], wins: [], freeRoam: false } }, 'tp-c137-done': ['diner', 'basement', 'mindblowers'] } },
  ),
  // Customs' alarm: the pads' swirls ahead of him shut while it's on, so the
  // only portal open is the way home behind him; open again on his next visit
  'customs-alarm': Object.assign(
    async (page) => {
      await c137(page);
      const padsAre = (open, when) =>
        page.waitForFunction((o) => window.__C137__.api.act('customs', 'pads').every((v) => v === o), open, { timeout: 10000, polling: 100 }).catch(async () => {
          throw new Error(`${when} the pads are ${JSON.stringify(await page.evaluate(() => window.__C137__.api.act('customs', 'pads')))}`);
        });
      await dial(page, 'customs');
      await padsAre(1, 'before the alarm');
      await warpUse(page, 'customs', 'seeds', ...spotAt('customs', 'seeds'));
      await warpUse(page, 'customs', 'scanner', ...spotAt('customs', 'scanner'));
      await padsAre(0, 'with the alarm on');
      await home(page, 'customs');
      await dial(page, 'customs');
      await padsAre(1, 'back in Customs after the alarm');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 0, step: 3, got: [], wins: [], freeRoam: false } }, 'tp-c137-done': ['diner', 'basement', 'mindblowers'] } },
  ),
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
    // (the Checklist lights the story's task, Shoney's, not the list's first thing)
    await page.keyboard.press('m');
    const list = page.locator('#rm-list');
    await list.waitFor({ timeout: 10000 });
    await list.getByRole('tab', { name: 'Checklist' }).click();
    const lit = await list.locator('li[data-next] .rm-list-name').textContent();
    const diner = await page.evaluate(async () => (await import('/src/components/rickmorty/world/rules.js')).TASKS.find((t) => t.id === 'diner').name);
    check(lit === diner, `the Checklist lights “${lit}”, not the story’s task`);
    await page.keyboard.press('m');
    await list.waitFor({ state: 'detached', timeout: 5000 });
    // the first step's marker: inside Shoney's, on the agent in his booth, not the way back out
    await warp(page, 'diner', -300, 800, N);
    await inArea(page, 'diner');
    await goalIs(page, 'dineragent', 'inside Shoney’s at the first step');
    for (const [i, { id }] of WIPED.steps.slice(0, 3).entries()) {
      await page.evaluate((id) => window.__C137__.complete(id), id);
      await reads(page, WIPED.steps[i + 1].text);
      const s = await story(page);
      check(s.episode === 0 && s.step === i + 1, `after ${id} the story is at ${s.episode}.${s.step}`);
    }
    // the last step: Customs, the marker on the seeds, then (taken) on the scanner, not the bare table
    await dial(page, 'customs');
    await goalIs(page, 'seeds', 'in Customs before the seeds');
    await warpUse(page, 'customs', 'seeds', ...spotAt('customs', 'seeds'));
    await goalIs(page, 'scanner', 'in Customs with the seeds');
    await home(page, 'customs');
    // out of Customs with the seeds; the episode's closing line, then episode 2's card
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
  // a new visitor who scrolls down to Portal panic while the street loads:
  // episode 1's card waits till the world's seen, not shown out of view and
  // gone by the time they're back
  async 'episode-1-away'(page) {
    await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
    await page.locator('#portal-panic').waitFor({ timeout: 60000 });
    await page.evaluate(() => document.getElementById('portal-panic').scrollIntoView({ block: 'start' }));
    check(!(await page.evaluate(() => Boolean(window.__C137__?.goto))), 'the world was on before the page could scroll away from it');
    await page.waitForFunction(() => window.__C137__?.goto, null, { timeout: 600000, polling: 1000 });
    // (longer than the card's own seven seconds)
    await page.waitForTimeout(8000);
    check((await page.locator('.rm-episode').count()) === 0, 'episode 1’s card showed with the world out of view');
    await page.evaluate(() => document.querySelector('.rm-world')?.scrollIntoView({ block: 'start' }));
    await cardFor(page, 0);
    await built(page);
    await reads(page, WIPED.steps[0].text);
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
    check((await page.locator('.rm-dial-lead').textContent()) === 'Coordinates on the gun: 1 of 32', 'the dial doesn’t count the coordinates home');
    await rows.filter({ hasText: 'vat of acid' }).click();
    await toast(page, 'Opens after episode 5, “Heat”. Free roam, in Things to do, opens it now.');
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
    await page.evaluate((n) => window.__RMSTORY__.jump(n), READY); // (the story's end: every place open)
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
      // (and the booth only says its line: its prompt says so, not 'Start the countdown')
      await warp(page, 'cablestudio', ...spotAt('cablestudio', 'cablebooth'));
      await promptIs(page, PLACES.spot('cablestudio', 'cablebooth').label, 'Look', 'with a returner’s channels on air,');
      // the village helped before the climb was built: no meter at the stairs, the stairs never bite, and its achievement comes on the visit
      await goto(page, 'fantasy', ...arriveOf('fantasy'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('fantasy'), null, { timeout: 30000, polling: 250 }).catch(() => {
        throw new Error('a returner who’d helped the village never got its achievement');
      });
      const foot = PLACES.spot('fantasy', 'goblins');
      await page.evaluate(([x, z]) => window.__C137__.warp('fantasy', x, z, Math.PI / 2), [foot.x, foot.z + 1]);
      await page.waitForTimeout(1000);
      check(!(await page.locator('.rm-cluster[aria-label="Up the beanstalk"][data-on]').count()), 'a returner saw the climb’s meter');
      // (the first stair mid-bite and Morty on its top tread: a done climb is never stepped, so its clock stays where
      // it was set and he stays on the tread; a bite would have put him back at the way in and dealt the climb afresh)
      await page.evaluate(() => window.__C137__.api.act('fantasy', 'setClimb', { t: 3.45 }));
      await standOn(page, 'fantasy', 'g1-top');
      await page.waitForTimeout(1500);
      const kept = await page.evaluate(() => ({ climb: window.__C137__.api.act('fantasy', 'climb'), y: window.__C137__.sim.m.y, area: window.__C137__.sim.area, fading: window.__C137__.sim.fading }));
      check(kept.climb.phase === 'idle' && kept.climb.t === 3.45 && Math.abs(kept.y - PLACES.ledge('fantasy', 'g1-top')[2]) < 1e-3 && kept.area === 'fantasy' && !kept.fading, `a returner’s stairs bit him (${JSON.stringify(kept)})`);
    },
    { seed: { 'tp-c137-done': ['cable', 'vat', 'jerryboree', 'cablestudio', 'fantasy'] } },
  ),
  // the Citadel tells the story where it is and what's done there (a
  // returner on Free roam, whose story is at episode 1: nothing moves, no
  // card and its own line), and its steps still save
  citadel: Object.assign(
    async (page, errors) => {
      await page.goto(`${BASE}/#/c-137/citadel`, { waitUntil: 'domcontentloaded' });
      await citadelUp(page);
      check(await page.evaluate(() => Boolean(window.__RMSTORY__)), 'the Citadel doesn’t read the story');
      const s = await story(page);
      check(s.freeRoam && s.episode === 0 && s.step === 0, `entering the Citadel moved the story to ${s.episode}.${s.step}`);
      await page.waitForTimeout(1500);
      check((await page.locator('.rm-episode').count()) === 0, 'a card showed at the Citadel on Free roam');
      await citadelReads(page, null, CITADEL_LINE([]));
      const before = errors.length;
      await page.evaluate(() => window.__CITADEL__.complete('daycare'));
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-citadel-done') ?? '[]').includes('daycare'), null, { timeout: 5000 }).catch(() => {
        throw new Error('the Citadel didn’t keep the day care done');
      });
      await citadelReads(page, null, CITADEL_LINE(['daycare']));
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
