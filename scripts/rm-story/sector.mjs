// The browser check's scenarios for episode 11, The sector
// (../rm-story-check.mjs): its four planets dialled from the garage and each
// game played, with a loss and a retry where there's one to lose; and a
// returner whose old ticks pass their parts, whose games rest, and whose
// last escape on Planet Squanch's own page holds for Morty's line. Either way
// the sector ends on episode 12's card.
/* global window, document */
import { OUT, check, use, inArea, reads, story, at, opens, toast, playTo, game, standOn, later, warpUse, caught, spotAt, wayInOf, homeOf, goalIs, noLink, meter, meterSays, warp, hunting, open, openOnCard, cardFor, dial, home, notDone, ticked, low, PLACES, CITADEL, SECTOR, SCORE } from './helpers.mjs';

const [BIRD, GEAR, PLUTO, SQUANCH] = SECTOR.steps[0].steps;
const COGS = PLACES.dest('gearworld').sequence.items;
// Bird World's crystals drawn now (its builder's own count), in pick order
const drawnAre = (page, ids, where) =>
  page.waitForFunction((ids) => JSON.stringify(window.__C137__.api.act('birdworld', 'crystals')) === JSON.stringify(ids), ids, { timeout: 10000, polling: 100 }).catch(async () => {
    throw new Error(`${where} the crystals drawn are ${JSON.stringify(await page.evaluate(() => window.__C137__.api.act('birdworld', 'crystals')))}`);
  });
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
    // Pluto dialled first, Bird World's part still to do: the marker's on Pluto's game, not its way out
    await dial(page, 'pluto');
    await reads(page, PLUTO.text);
    await goalIs(page, 'claim-growing', 'on Pluto, dialled first');
    await home(page, 'pluto');

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
    const FIVE = PLACES.dest('birdworld').climb.picks;
    await drawnAre(page, FIVE.slice(1), 'with the path’s crystal picked up,');
    const path = PLACES.spot('birdworld', 'bcrystal-path');
    await warp(page, 'birdworld', path.x, path.z);
    await later(page, 0.5);
    check((await page.evaluate(() => window.__C137__.sim.near?.id)) !== 'bcrystal-path', 'a crystal picked up could be picked up again');
    // on a crumbling drum mid-crumble: back at the way in, the crystal back where it was
    await page.evaluate(() => window.__C137__.api.act('birdworld', 'setClimb', { t: 3.6 }));
    await standOn(page, 'birdworld', 'tower-a-4');
    await caught(page, wayInOf('birdworld'));
    check((await game(page, 'birdworld', 'climb')).picked.length === 0, 'the crystals picked up stayed picked after a crumble');
    await drawnAre(page, FIVE, 'after a crumble,');
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
    await drawnAre(page, [], 'with Bird World won,');
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
    // (the stage sets them on the frame after the cog's press, and each turns on its own next step)
    await page.waitForFunction(() => window.__C137__.api.act('gearworld', 'npcs').filter((n) => n.hunting).length === 2, null, { timeout: 5000, polling: 50 }).catch(() => {
      throw new Error('the gear police didn’t both come after him');
    });
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
    await cardFor(page, 11);
    await at(page, 11, 0, 'after the sector');
    await opens(page, SECTOR.unlocks, true, 'after episode 11');
    await opens(page, SCORE.unlocks, false, 'after episode 11');
    await reads(page, SCORE.steps[0].text);
    await noLink(page, 'after episode 11');
    await goalIs(page, 'garage-portal', 'in the garage after episode 11');
  },

  // a returner who'd done three of the sector's planets before episode 11
  // was built: their parts passed at once, their games at rest; then Planet
  // Squanch on its own page, whose escape ends the episode and holds the
  // page for Morty's line, episode 12's card over it, before it leaves; and
  // the card again in C-137, the episode not begun
  'sector-page': Object.assign(
    async (page) => {
      await open(page, '#/c-137/gearworld');
      check(JSON.stringify((await story(page)).got) === '[0,1,2]', `the old ticks passed parts ${JSON.stringify((await story(page)).got)}`);
      await reads(page, PLACES.allDone);
      await later(page, 1);
      check((await meter(page, 'The city’s cogs').count()) === 0, 'a wound city showed its meter');
      check((await hunting(page, 'gearworld')).length === 0, 'the gear police hunted in a wound city');
      // Planet Squanch's own page: its part, then the escape that ends the episode
      await open(page, '#/c-137/squanch');
      await reads(page, SQUANCH.text);
      await warpUse(page, 'squanch', 'toast', ...spotAt('squanch', 'toast'));
      await page.waitForFunction(() => window.__C137__.sim.escape?.area === 'squanch', null, { timeout: 10000, polling: 100 }).catch(() => {
        throw new Error('the toast didn’t start the clock');
      });
      await warpUse(page, 'squanch', 'squanch-portal', ...homeOf('squanch'));
      await toast(page, SECTOR.outro[0][1]);
      check((await page.locator('.rm-fade[data-on]').count()) === 0, 'the portal’s fade covered Morty’s line');
      // (episode 12's card, there on the planet's own page with no key pressed)
      await page.locator('.rm-episode', { hasText: 'Episode 12' }).waitFor({ timeout: 5000 }).catch(() => {
        throw new Error('no card for episode 12 on Squanch’s own page');
      });
      const card = await page.locator('.rm-episode').textContent();
      check(card.includes(SCORE.title) && card.includes(SCORE.intro[0][1]), `episode 12’s card on Squanch’s own page says “${card}”`);
      await page.waitForFunction(() => !document.querySelector('.rm-clock'), null, { timeout: 1500, polling: 50 }).catch(() => {
        throw new Error('the escape’s clock ran on under Morty’s line');
      });
      await page.waitForTimeout(2000);
      check(new URL(page.url()).hash === '#/c-137/squanch', `the page left before Morty’s line was read (${new URL(page.url()).hash})`);
      await page.waitForFunction(() => window.location.hash === '#/universe/squanch', null, { timeout: 20000, polling: 100 }).catch(() => {
        throw new Error(`the page never left for the universe (${new URL(page.url()).hash})`);
      });
      await at(page, 11, 0, 'after the escape');
      // and C-137: episode 12's card again (it's not begun), Heist-Con's line, and Morty's line not said again
      await openOnCard(page, '#/c-137', 11);
      await reads(page, SCORE.steps[0].text);
      await page.waitForTimeout(2000);
      check((await page.locator('.rm-episode').count()) === 0, 'episode 12’s card came back in C-137');
      check((await page.locator('.rm-toast', { hasText: SECTOR.outro[0][1] }).count()) === 0, 'Morty’s line was said again in C-137');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 10, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['birdworld', 'gearworld', 'pluto'] } },
  ),
};
