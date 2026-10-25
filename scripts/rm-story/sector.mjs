// The browser check's scenarios for episode 11, The sector
// (../rm-story-check.mjs): its four planets dialled from the garage and each
// game played, with a loss and a retry where there's one to lose; and a
// returner whose old ticks pass their parts, whose games rest, and whose
// last escape on Planet Squanch's own page holds for Morty's line; and
// Pluto's own page left with that line still waiting, the next page saying
// it. Either way the sector ends on episode 12's card. And on a phone, a
// place's meter clear of the prompt card.
/* global window, document */
import { OUT, check, use, built, inArea, reads, story, at, opens, toast, playTo, game, standOn, later, warpUse, caught, spotAt, wayInOf, homeOf, goalIs, noLink, meter, meterSays, warp, hunting, open, openHeld, openOnCard, cardFor, dial, home, notDone, ticked, low, promptIs, dotted, cameraAt, PLACES, CITADEL, SECTOR, SCORE } from './helpers.mjs';

const [BIRD, GEAR, PLUTO, SQUANCH] = SECTOR.steps[0].steps;
const COGS = PLACES.dest('gearworld').sequence.items;
// Bird World's crystals drawn now (its builder's own count), in pick order
const drawnAre = (page, ids, where) =>
  page.waitForFunction((ids) => JSON.stringify(window.__C137__.api.act('birdworld', 'crystals')) === JSON.stringify(ids), ids, { timeout: 10000, polling: 100 }).catch(async () => {
    throw new Error(`${where} the crystals drawn are ${JSON.stringify(await page.evaluate(() => window.__C137__.api.act('birdworld', 'crystals')))}`);
  });
// how near a post comes to the line from a to b, across the ground
const gapTo = (p, a, b) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
export const SECTOR_CHECKS = {
  // a new visitor plays episode 11: each planet dialled from the garage, its
  // part the line there and its game the marker; Bird World's crystals (a
  // pick up, a crumble and the picks back, then all five, two up the
  // towers, the map's dots going with them and the camera kept round a
  // tower's trunk), Gear World's cogs (a wrong one, a gear cop's catch, the city run
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
    await goalIs(page, 'dial', 'in the garage, the gun set elsewhere');
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
    // and gone from the map: no dot where it was, the next one's still there (Morty off by the door, his arrow with him)
    await warp(page, 'birdworld', ...spotAt('birdworld', 'door'));
    await later(page, 0.3);
    const trees = PLACES.spot('birdworld', 'bcrystal-trees');
    check(!(await dotted(page, 'birdworld', path.x, path.z)), 'the map still dots a crystal picked up');
    check(await dotted(page, 'birdworld', trees.x, trees.z), 'the map lost a crystal still to pick up');
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
      // (on the west tower's top, the camera turned to the trunk behind him: it swings round it, so he's in sight)
      if (id === 'bcrystal-west') {
        const trunk = PLACES.dest('birdworld').solids.find((o) => o.id === 'tower-a-trunk');
        const cam = await cameraAt(page, Math.atan2(trunk.x - c.x, trunk.z - c.z));
        check(gapTo(trunk, c, cam) > trunk.r, `the camera sat behind the west tower’s trunk, at ${cam.x.toFixed(2)}, ${cam.z.toFixed(2)}`);
      }
      await use(page, id);
    }
    await page.waitForFunction(() => JSON.parse(window.localStorage.getItem('tp-c137-done') ?? '[]').includes('birdworld'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('the five crystals didn’t win Bird World');
    });
    await drawnAre(page, [], 'with Bird World won,');
    check(await ticked(page, BIRD.text), 'the Story tab doesn’t tick Bird World');
    await reads(page, SECTOR.steps[0].text);
    await goalIs(page, 'birdworld-portal', 'on Bird World, done');
    // (and the map with them: no crystal dotted but the one he's stood by)
    for (const id of ['bcrystal-path', 'bcrystal-trees', 'bcrystal-grass', 'bcrystal-east']) {
      const c = PLACES.spot('birdworld', id);
      check(!(await dotted(page, 'birdworld', c.x, c.z)), `with Bird World won, the map still dots ${id}`);
    }
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
    // (weighed true: the next press tells the king, and the prompt says so)
    const planet = PLACES.spot('pluto', 'claim-planet').label;
    await promptIs(page, planet, PLACES.dest('pluto').deal.take, 'with a claim weighed true,');
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
    // (the king told: a claim's press only says its line now)
    await promptIs(page, planet, 'Look', 'with Pluto won,');
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
    await goalIs(page, 'dial', 'in the garage after episode 11, the gun still on Squanch');
  },

  // a returner who'd done three of the sector's planets before episode 11
  // was built: their parts passed at once, their games at rest (no meter on
  // a done Bird World or Gear World, even before its people stand); then Planet
  // Squanch on its own page, whose escape ends the episode and holds the
  // page for Morty's line, episode 12's card over it, before it leaves; and
  // the card again in C-137, the episode not begun
  'sector-page': Object.assign(
    async (page) => {
      // each arrived at with its people's files held back: no fresh game's meter while they're on the way
      for (const [id, title] of [
        ['birdworld', 'Bird World’s crystals'],
        ['gearworld', 'The city’s cogs'],
      ]) {
        const free = await openHeld(page, `#/c-137/${id}`, id, PLACES.dest(id).people.map((p) => p.who ?? p.id));
        await later(page, 1);
        check(await page.evaluate(() => window.__C137__.api.loading() > 0), `${id}’s people stood before its meter was read`);
        check((await meter(page, title).count()) === 0, `a done ${id} showed its meter while its people were on the way`);
        await free();
      }
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
  // on a phone with a home bar (390 × 664, its 34 px inset), a place's meter
  // stays clear of the prompt card at a spot: Bird World's, there from the
  // start, by Birdperson's door
  'sector-phone': Object.assign(
    async (page) => {
      await open(page, '#/c-137/birdworld');
      // (the home bar's inset, as a phone's env(safe-area-inset-bottom) gives it: Playwright's touch emulation has none)
      await page.evaluate(() => document.documentElement.style.setProperty('--hud-safe-b', '34px'));
      await meterSays(page, 'Bird World’s crystals', '0 of 5 crystals found');
      await warp(page, 'birdworld', ...spotAt('birdworld', 'door'));
      await page.locator('.rm-prompt[data-kind="spot"]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(400); // (its rise in)
      const at = await page.evaluate(() => {
        const a = document.querySelector('.rm-cluster.rm-meter[data-on] .hud-vitals-block').getBoundingClientRect();
        const b = document.querySelector('.rm-prompt').getBoundingClientRect();
        return { over: a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right, meter: Math.round(a.bottom), prompt: Math.round(b.top) };
      });
      check(!at.over, `on a phone the meter (to ${at.meter}) is over the prompt card (from ${at.prompt})`);
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 10, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } } }, context: { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true } },
  ),
  // Pluto's own page the sector's last part: the two true claims told and its
  // portal pressed while the king's line is still being read, Morty's line
  // waiting behind it. The page goes with that line unsaid, so the next page
  // in the visit (Bird World's own, as the map lands there) says it with
  // episode 12's card, and C-137 after it shows neither again
  'sector-leave': Object.assign(
    async (page) => {
      await open(page, '#/c-137/pluto');
      await reads(page, PLUTO.text);
      for (const id of ['claim-moons', 'claim-planet']) {
        await warpUse(page, 'pluto', id, ...spotAt('pluto', id));
        await later(page, 0.5);
        await use(page, id);
      }
      await page.waitForFunction(() => JSON.parse(window.localStorage.getItem('tp-c137-done') ?? '[]').includes('pluto'), null, { timeout: 30000, polling: 100 }).catch(() => {
        throw new Error('the two true claims didn’t win Pluto');
      });
      await warpUse(page, 'pluto', 'pluto-portal', ...homeOf('pluto'));
      check((await page.locator('.rm-toast', { hasText: SECTOR.outro[0][1] }).count()) === 0, 'Morty’s line went up before the portal was pressed (the king’s line was read already)');
      await page.waitForFunction(() => window.location.hash === '#/universe/pluto', null, { timeout: 20000, polling: 100 }).catch(() => {
        throw new Error(`Pluto’s page never left for the universe (${new URL(page.url()).hash})`);
      });
      await at(page, 11, 0, 'after Pluto’s page');
      // (a hash change, not a reload: the same visit)
      await page.evaluate(() => {
        window.location.hash = '#/c-137/birdworld';
      });
      await built(page);
      await toast(page, SECTOR.outro[0][1]);
      await cardFor(page, 11);
      await page.getByRole('link', { name: 'Home to C-137' }).first().click();
      await inArea(page, 'garage');
      await page.waitForTimeout(2500);
      check((await page.locator('.rm-episode').count()) === 0, 'episode 12’s card showed again in C-137');
      check((await page.locator('.rm-toast', { hasText: SECTOR.outro[0][1] }).count()) === 0, 'Morty’s line was said again in C-137');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 10, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['birdworld', 'gearworld', 'squanch'] } },
  ),
};
