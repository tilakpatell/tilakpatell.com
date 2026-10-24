// The browser check's scenarios for episode 11, The sector
// (../rm-story-check.mjs): its four planets dialled from the garage and each
// game played, with a loss and a retry where there's one to lose; and a
// returner whose old ticks pass their parts, whose games rest, and whose
// last escape on Planet Squanch's own page holds for Morty's line.
/* global window, document */
import { BASE, N, OUT, check, done, built, use, reads, story, at, opens, toast, inArea, throughPortal, playTo, game, standOn, later, warpUse, caught, spotAt, wayInOf, homeOf, PLACES, CITADEL, SECTOR } from './helpers.mjs';

const [BIRD, GEAR, PLUTO, SQUANCH] = SECTOR.steps[0].steps;
const COGS = PLACES.dest('gearworld').sequence.items;
const CABLE = 'Go into the Smith house and put interdimensional cable on the TV.';
// (a label in the middle of a line, as Gear World's words have it)
const low = (l) => l[0].toLowerCase() + l.slice(1);

// the marker's point (the sim's `goal`): a link's or a spot's id
const goalIs = (page, id, where) =>
  page.waitForFunction((id) => window.__C137__.sim.goal?.id === id, id, { timeout: 15000, polling: 100 }).catch(async () => {
    throw new Error(`${where} the marker’s on ${await page.evaluate(() => window.__C137__.sim.goal?.id ?? null)}, not ${id}`);
  });
// the objective line isn't a link
const noLink = async (page, where) => check((await page.locator('.rm-hud .rm-objective-link').count()) === 0, `${where} the line is a link`);
// a task not done after a few seconds of the game's own time
const notDone = async (page, id, what) => {
  await later(page, 3.5);
  check(!(await done(page)).includes(id), what);
};
// the place's meter, by its title, and its line
const meter = (page, title) => page.locator(`.rm-cluster[aria-label="${title}"][data-on]`);
const meterSays = (page, title, text) =>
  page.waitForFunction(([t, s]) => document.querySelector(`.rm-cluster[aria-label="${t}"][data-on]`)?.textContent.includes(s), [title, text], { timeout: 15000, polling: 100 }).catch(async () => {
    throw new Error(`the meter reads “${await meter(page, title).first().textContent().catch(() => '(none)')}”, not “${text}”`);
  });
// Morty moved within the place (its game going on) and stood there a moment
const warp = (page, area, x, z, face = N) => page.evaluate(([a, x, z, f]) => window.__C137__.warp(a, x, z, f), [area, x, z, face]);
// the place's hunters after him now
const hunting = (page, area) => page.evaluate((a) => window.__C137__.api.act(a, 'npcs').filter((n) => n.hunting).map((n) => n.id), area);
// the Story tab: one of the sector's parts ticked
async function ticked(page, text) {
  await page.keyboard.press('m');
  const list = page.locator('#rm-list');
  await list.waitFor({ timeout: 10000 });
  const n = await list.locator('li[data-done]', { hasText: text }).count();
  await page.keyboard.press('m');
  await list.waitFor({ state: 'detached', timeout: 5000 });
  return n > 0;
}
// dialled from the garage, and through its portal
async function dial(page, id) {
  check((await page.evaluate((id) => window.__C137__.dial(id), id)) === id, `the dial wouldn’t take ${id}`);
  await throughPortal(page);
  await inArea(page, id);
}
// home through the place's own portal
const home = async (page, id) => {
  await warpUse(page, id, `${id}-portal`, ...homeOf(id));
  await inArea(page, 'garage');
};

export const SECTOR_CHECKS = {
  // a new visitor plays episode 11: each planet dialled from the garage, its
  // part the line there and its game the marker; Bird World's crystals (a
  // pick up, a crumble and the picks back, then all five, two up the
  // towers), Gear World's cogs (a wrong one, a gear cop's catch, the city run
  // down, then the dealt order), Pluto's claims (a lie told blind, then the
  // two true ones) and Squanch's escape, the last part, home to C-137
  async 'episode-11'(page) {
    await playTo(page, 10, ['cabinet', 'chase']);
    await at(page, 10, 0, 'at episode 11');
    await opens(page, CITADEL.unlocks, true, 'at episode 11');
    await opens(page, [...SECTOR.unlocks, 'evilrick'], false, 'at episode 11');
    await reads(page, SECTOR.steps[0].text);
    await noLink(page, 'in C-137');
    await page.evaluate(() => window.__C137__.goto('garage', -302.3, 101.4, Math.PI));
    await inArea(page, 'garage');
    await goalIs(page, 'garage-portal', 'in the garage');

    // Bird World: its part, its meter; the knock ticks nothing
    await dial(page, 'birdworld');
    await reads(page, BIRD.text);
    await noLink(page, 'on Bird World');
    await meterSays(page, 'Bird World’s crystals', '0 of 5 crystals found');
    await goalIs(page, 'bcrystal-path', 'on Bird World');
    await warpUse(page, 'birdworld', 'door', ...spotAt('birdworld', 'door'));
    await notDone(page, 'birdworld', 'Birdperson’s door ticked Bird World');
    // a crystal picked up: counted, and gone from reach where it was
    await warpUse(page, 'birdworld', 'bcrystal-path', ...spotAt('birdworld', 'bcrystal-path'));
    await page.waitForFunction(() => window.__C137__.api.act('birdworld', 'climb').picked.includes('bcrystal-path'), null, { timeout: 10000, polling: 100 }).catch(() => {
      throw new Error('the path’s crystal wasn’t picked up');
    });
    await meterSays(page, 'Bird World’s crystals', '1 of 5 crystals found');
    const path = PLACES.spot('birdworld', 'bcrystal-path');
    await warp(page, 'birdworld', path.x, path.z);
    await later(page, 0.5);
    check((await page.evaluate(() => window.__C137__.sim.near?.id)) !== 'bcrystal-path', 'a crystal picked up could be picked up again');
    // on a crumbling drum mid-crumble: back at the way in, the crystal back where it was
    await page.evaluate(() => window.__C137__.api.act('birdworld', 'setClimb', { t: 3.6 }));
    await standOn(page, 'birdworld', 'tower-a-4');
    await caught(page, wayInOf('birdworld'));
    check((await game(page, 'birdworld', 'climb')).picked.length === 0, 'the crystals picked up stayed picked after a crumble');
    await warp(page, 'birdworld', ...spotAt('birdworld', 'bcrystal-path'));
    await page.waitForFunction(() => window.__C137__.sim.near?.id === 'bcrystal-path', null, { timeout: 10000, polling: 100 }).catch(() => {
      throw new Error('the path’s crystal didn’t come back after a crumble');
    });
    // all five: the three in the grass, and one on each tower's top
    for (const id of ['bcrystal-path', 'bcrystal-trees', 'bcrystal-grass']) await warpUse(page, 'birdworld', id, ...spotAt('birdworld', id));
    for (const [tower, id] of [
      ['tower-b', 'bcrystal-east'],
      ['tower-a', 'bcrystal-west'],
    ]) {
      const [tx, tz] = PLACES.ledge('birdworld', tower);
      const c = PLACES.spot('birdworld', id);
      await standOn(page, 'birdworld', tower, { dx: c.x - tx, dz: c.z - tz });
      if (OUT && id === 'bcrystal-east') await page.screenshot({ path: `${OUT}/episode-11-claytower.png` });
      await use(page, id);
    }
    await page.waitForFunction(() => JSON.parse(window.localStorage.getItem('tp-c137-done') ?? '[]').includes('birdworld'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('the five crystals didn’t win Bird World');
    });
    check(await ticked(page, BIRD.text), 'the Story tab doesn’t tick Bird World');
    await reads(page, SECTOR.steps[0].text);
    await goalIs(page, 'birdworld-portal', 'on Bird World, done');
    await home(page, 'birdworld');

    // Gear World: the marker on the first cog, Gearhead's hello ticks nothing
    await dial(page, 'gearworld');
    await reads(page, GEAR.text);
    const order = (await game(page, 'gearworld', 'sequence')).order;
    await goalIs(page, order[0], 'on Gear World');
    await meterSays(page, 'The city’s cogs', `0 of 4 wound: next, ${low(PLACES.spot('gearworld', order[0]).label)}`);
    await warpUse(page, 'gearworld', 'gearhead', ...spotAt('gearworld', 'gearhead'));
    await notDone(page, 'gearworld', 'Gearhead’s hello ticked Gear World');
    // a wrong cog first: the clock's started, and the police after him
    const wrong = COGS.find((id) => id !== order[0]);
    await warpUse(page, 'gearworld', wrong, ...spotAt('gearworld', wrong));
    await toast(page, 'The gear police heard the city turn, and they’re coming for you.');
    const run = await game(page, 'gearworld', 'sequence');
    check(run.phase === 'run' && run.on === 0, `a wrong first cog left the city ${run.phase} with ${run.on} on`);
    check((await hunting(page, 'gearworld')).length === 2, 'the gear police didn’t both come after him');
    // beside a gear cop: caught, the police home, the city still
    const cop = await page.evaluate(() => window.__C137__.api.act('gearworld', 'npcs').find((n) => n.id === 'gpolice-a'));
    await warp(page, 'gearworld', cop.x + 0.6, cop.z);
    await toast(page, 'He clamps a hand on your shoulder and marches you back to the portal, and every cog stops.');
    check((await page.locator('.rm-toast', { hasText: 'A gear cop' }).count()) === 1, 'the catch wasn’t a gear cop’s');
    await caught(page, wayInOf('gearworld'));
    await later(page, 1);
    check((await hunting(page, 'gearworld')).length === 0 && (await game(page, 'gearworld', 'sequence')).phase === 'idle', 'the police kept hunting, or the city kept turning, after a catch');
    // the city run down: its own line, back at the way in
    const again = (await game(page, 'gearworld', 'sequence')).order;
    await warpUse(page, 'gearworld', again[0], ...spotAt('gearworld', again[0]));
    await page.evaluate(() => window.__C137__.api.act('gearworld', 'setSequence', { left: 0.05 }));
    await toast(page, 'The city ran down before every cog was wound: back to the portal, and wind them again.');
    await caught(page, wayInOf('gearworld'));
    // then the dealt order, wound in turn
    for (const id of (await game(page, 'gearworld', 'sequence')).order) await warpUse(page, 'gearworld', id, ...spotAt('gearworld', id));
    await page.waitForFunction(() => JSON.parse(window.localStorage.getItem('tp-c137-done') ?? '[]').includes('gearworld'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('the dealt order didn’t win Gear World');
    });
    await later(page, 1);
    check((await hunting(page, 'gearworld')).length === 0, 'the gear police kept hunting once the city was wound');
    await home(page, 'gearworld');

    // Pluto: the podium ticks nothing; a lie told blind is Scroopy's to call out
    await dial(page, 'pluto');
    await reads(page, PLUTO.text);
    await warpUse(page, 'pluto', 'podium', ...spotAt('pluto', 'podium'));
    await notDone(page, 'pluto', 'the podium ticked Pluto');
    const tell = async (id, n) => {
      await warpUse(page, 'pluto', id, ...spotAt('pluto', id));
      for (let i = 1; i < n; i++) {
        await later(page, 0.5);
        await use(page, id);
      }
    };
    await tell('claim-moons', 1);
    await tell('claim-planet', 1);
    await tell('claim-growing', 2);
    await toast(page, 'That’s a lie, kid, and the whole plain heard it: back to the portal with you.');
    check((await page.locator('.rm-toast', { hasText: 'Scroopy Noopers' }).count()) === 1, 'the lie wasn’t Scroopy’s to call out');
    await caught(page, wayInOf('pluto'));
    check(Object.keys((await game(page, 'pluto', 'deal')).seen).length === 0, 'the claims weighed stayed weighed after a lie');
    // the two true claims, weighed and told
    await tell('claim-moons', 2);
    await tell('claim-planet', 2);
    await page.waitForFunction(() => JSON.parse(window.localStorage.getItem('tp-c137-done') ?? '[]').includes('pluto'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('the two true claims didn’t win Pluto');
    });
    await home(page, 'pluto');

    // Planet Squanch: a glass raised, and home inside the minute: the last part, episode 11 over
    await dial(page, 'squanch');
    await reads(page, SQUANCH.text);
    await warpUse(page, 'squanch', 'toast', ...spotAt('squanch', 'toast'));
    await page.waitForFunction(() => window.__C137__.sim.escape?.area === 'squanch', null, { timeout: 10000, polling: 100 }).catch(() => {
      throw new Error('the toast didn’t start the clock');
    });
    await home(page, 'squanch');
    await toast(page, SECTOR.outro[0][1]);
    await page.waitForTimeout(1500);
    check((await page.locator('.rm-episode').count()) === 0, 'a card showed for an episode that isn’t built');
    await at(page, 11, 0, 'after the sector');
    await opens(page, PLACES.dial, true, 'after episode 11');
    await reads(page, CABLE);
  },

  // a returner who'd done three of the sector's planets before episode 11
  // was built: their parts passed at once, their games at rest; then Planet
  // Squanch on its own page, whose escape ends the episode and holds the
  // page for Morty's line before it leaves
  'sector-page': Object.assign(
    async (page) => {
      await page.goto(`${BASE}/#/c-137/gearworld`, { waitUntil: 'domcontentloaded' });
      await built(page);
      check(JSON.stringify((await story(page)).got) === '[0,1,2]', `the old ticks passed parts ${JSON.stringify((await story(page)).got)}`);
      await reads(page, PLACES.allDone);
      await later(page, 1);
      check((await meter(page, 'The city’s cogs').count()) === 0, 'a wound city showed its meter');
      check((await hunting(page, 'gearworld')).length === 0, 'the gear police hunted in a wound city');
      // Planet Squanch's own page: its part, then the escape that ends the episode
      await page.goto(`${BASE}/#/c-137/squanch`, { waitUntil: 'domcontentloaded' });
      await built(page);
      await reads(page, SQUANCH.text);
      await warpUse(page, 'squanch', 'toast', ...spotAt('squanch', 'toast'));
      await page.waitForFunction(() => window.__C137__.sim.escape?.area === 'squanch', null, { timeout: 10000, polling: 100 }).catch(() => {
        throw new Error('the toast didn’t start the clock');
      });
      await warpUse(page, 'squanch', 'squanch-portal', ...homeOf('squanch'));
      await toast(page, SECTOR.outro[0][1]);
      check((await page.locator('.rm-fade[data-on]').count()) === 0, 'the portal’s fade covered Morty’s line');
      await page.waitForTimeout(2000);
      check(new URL(page.url()).hash === '#/c-137/squanch', `the page left before Morty’s line was read (${new URL(page.url()).hash})`);
      await page.waitForFunction(() => window.location.hash === '#/universe/squanch', null, { timeout: 20000, polling: 100 }).catch(() => {
        throw new Error(`the page never left for the universe (${new URL(page.url()).hash})`);
      });
      await at(page, 11, 0, 'after the escape');
      // and C-137: no card, the checklist's line, and Morty's line not said again
      await page.goto(`${BASE}/#/c-137`, { waitUntil: 'domcontentloaded' });
      await built(page);
      await reads(page, CABLE);
      await page.waitForTimeout(2000);
      check((await page.locator('.rm-episode').count()) === 0, 'a card showed after the last built episode');
      check((await page.locator('.rm-toast', { hasText: SECTOR.outro[0][1] }).count()) === 0, 'Morty’s line was said again in C-137');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 10, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['birdworld', 'gearworld', 'pluto'] } },
  ),
};
