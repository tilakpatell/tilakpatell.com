// The browser check's scenarios for episode 12, Big score
// (../rm-story-check.mjs): Heist-Con's job on a fresh save (the plan and a
// booth before the crew, the crew alone ticking nothing, home mid-crew and
// mid-job, a wrong booth, one lifted again, a catch by the cat burglar, the
// keynote run out, then the job, its last booth lifted as the cat burglar
// catches him), and Rick's rooms on the Vindicators' ship
// played through their overlay (a room by keys, a wrong pick by click, Esc
// mid-trial, the rest by clicks), the episode's end; a returner whose old
// crew ticked Heist-Con; and one who did the Vindicators first. Each ends on
// episode 13's card.
/* global window, document */
import { check, use, reads, at, opens, toast, playTo, game, later, warpUse, caught, spotAt, wayInOf, goalIs, noLink, meter, meterSays, warp, hunting, inArea, openOnCard, cardFor, cardOnLine, dial, home, notDone, ticked, done, isDone, achieved, PLACES, N, SECTOR, SCORE, EVIL, ROOMS } from './helpers.mjs';

const H = PLACES.dest('heistcon');
const JOB = H.sequence;
const CREW = H.collect.spots;
const [HEIST, VIND] = SCORE.steps;
const SAY = PLACES.roomsSay;
const TITLE = JOB.meter.title;
const label = (id) => PLACES.spot('heistcon', id).label;
// (where he faces each spot from, so he never stands inside a counter)
const FACE = { heistbadge: -N, heistbooth: -N, heisthire: -N, heistskull: 0, heistcars: Math.PI };

// E at one of Heist-Con's spots; the crew, in turn; the job started at the plan
const press = (page, id) => warpUse(page, 'heistcon', id, ...spotAt('heistcon', id, FACE[id] ?? N));
const crewUp = async (page) => {
  for (const id of CREW) await press(page, id);
};
const start = (page) => press(page, 'heistplan');
const job = (page) => game(page, 'heistcon', 'sequence');
const jobIs = (page, want, what) =>
  page.waitForFunction((w) => Object.entries(w).every(([k, v]) => window.__C137__.api.act('heistcon', 'sequence')[k] === v), want, { timeout: 10000, polling: 100 }).catch(async () => {
    throw new Error(`${what}: the job is ${JSON.stringify(await job(page))}`);
  });
// a toast saying `text` gone (they're up 4.4 s), so the next one saying it is fresh
const gone = (page, text) => page.locator('.rm-toast', { hasText: text }).waitFor({ state: 'detached', timeout: 15000 });
// no toast saying `text` for `ms` of the page's own time
const never = async (page, text, ms, what) =>
  page
    .locator('.rm-toast', { hasText: text })
    .waitFor({ timeout: ms })
    .then(
      () => {
        throw new Error(what);
      },
      () => {},
    );
// the booths' alarms, lit (1) or dark (0.15), by booth
const lampsAre = (page, want, what) =>
  page.waitForFunction((w) => JSON.stringify(window.__C137__.api.act('heistcon', 'lamps')) === JSON.stringify(w), want, { timeout: 10000, polling: 100 }).catch(async () => {
    throw new Error(`${what} the alarms are ${JSON.stringify(await page.evaluate(() => window.__C137__.api.act('heistcon', 'lamps')))}`);
  });
const lit = (on) => Object.fromEntries(JOB.items.map((id) => [id, on.includes(id) ? 1 : 0.15]));
const noMeter = async (page, what) => check((await meter(page, TITLE).count()) === 0, `${what} the job’s meter showed`);
const nobodyHunting = async (page, what) => check((await hunting(page, 'heistcon')).length === 0, `${what} the crew hunted him`);
const crewHunting = (page) =>
  page.waitForFunction(() => JSON.stringify(window.__C137__.api.act('heistcon', 'npcs').filter((n) => n.hunting).map((n) => n.id).sort()) === '["heister-a1","heister-b1"]', null, { timeout: 5000, polling: 50 }).catch(() => {
    throw new Error('Miles’s crew didn’t both come after him');
  });
// a task done, and an achievement earned
// the booths lifted in the order dealt, from the job's start
const lift = async (page) => {
  await crewUp(page);
  await start(page);
  await jobIs(page, { phase: 'run' }, 'the plan didn’t start the job');
  for (const id of (await job(page)).order) await press(page, id);
};
// the episode over: its closing line and episode 13's card, every place open
const over = async (page, when) => {
  await cardOnLine(page, SCORE.outro[0][1]);
  await cardFor(page, 12);
  await at(page, 12, 0, when);
  await opens(page, PLACES.dial, true, when);
};
// Rick's rooms: the overlay, the room it's on, and a room's right answer picked by click
const rooms = (page) => page.getByRole('dialog', { name: 'Rick’s rooms' });
const roomIs = (page, n) =>
  page.waitForFunction((t) => document.querySelector('.rm-dial-box[aria-label="Rick’s rooms"] .rm-dial-head span')?.textContent === t, `Rick’s rooms · ${n} of ${ROOMS.length}`, { timeout: 10000, polling: 100 }).catch(async () => {
    throw new Error(`Rick’s rooms aren’t on room ${n} (${await rooms(page).locator('.rm-dial-head span').textContent().catch(() => 'shut')})`);
  });
const right = (r) => ROOMS[r].choices.find((c) => c.right);
const click = (page, text) => rooms(page).getByRole('button', { name: text, exact: true }).click();

export const SCORE_CHECKS = {
  // a new visitor plays episode 12: Heist-Con's job with every way it can
  // go wrong, then Rick's rooms, the last step
  async 'episode-12'(page) {
    await playTo(page, 11, ['cabinet', 'chase']);
    await at(page, 11, 0, 'at episode 12');
    await opens(page, SECTOR.unlocks, true, 'at episode 12');
    await opens(page, SCORE.unlocks, false, 'at episode 12');
    await reads(page, HEIST.text);
    await noLink(page, 'in C-137');
    await page.evaluate(() => window.__C137__.goto('garage', -302.3, 101.4, Math.PI));
    await inArea(page, 'garage');
    await goalIs(page, 'dial', 'in the garage, the gun set elsewhere');
    check((await page.evaluate(() => window.__C137__.dial('blooddome'))) !== 'blooddome', 'the dial took Blood Dome at episode 12');

    // Heist-Con before anything: the badge marked, no job, nobody after him
    await dial(page, 'heistcon');
    await reads(page, HEIST.text);
    await noLink(page, 'in Heist-Con');
    await goalIs(page, 'heistbadge', 'in Heist-Con');
    await later(page, 1);
    await noMeter(page, 'before the job,');
    await nobodyHunting(page, 'before the job,');
    // a booth before the crew: what's missing is the crew, not the job's start
    await press(page, 'heistbooth');
    await toast(page, JOB.before);
    check((await page.locator('.rm-toast', { hasText: JOB.early }).count()) === 0, 'a booth before the crew sent him to the plan');
    await gone(page, JOB.before);
    // the plan before the crew: it waits, and says why
    await start(page);
    await toast(page, JOB.before);
    await later(page, 1);
    await jobIs(page, { phase: 'idle', ready: false }, 'the plan started the job before the crew');
    await noMeter(page, 'with no crew,');
    await nobodyHunting(page, 'with no crew,');
    await lampsAre(page, lit([]), 'before the job,');
    // the crew alone ticks nothing, and readies the job
    for (const id of CREW) {
      await goalIs(page, id, 'signing the crew');
      await press(page, id);
    }
    await notDone(page, 'heistcon', 'the badge and the crew alone ticked Heist-Con');
    await jobIs(page, { ready: true }, 'the crew didn’t ready the job');
    await goalIs(page, 'heistplan', 'with the crew in');
    // a booth with the crew in, the job not started: to the plan
    await press(page, 'heistbooth');
    await toast(page, JOB.early);

    // home with the crew in, then mid-crew: the crew to sign again each time
    await home(page, 'heistcon');
    await dial(page, 'heistcon');
    await goalIs(page, 'heistbadge', 'back after the crew');
    await jobIs(page, { ready: false }, 'the crew outlived the way home');
    await press(page, CREW[0]);
    await press(page, CREW[1]);
    await home(page, 'heistcon');
    await dial(page, 'heistcon');
    await goalIs(page, 'heistbadge', 'back mid-crew');
    // home mid-job: the clock gone, the crew home, the job not ready
    await crewUp(page);
    await start(page);
    await toast(page, JOB.spotted);
    await crewHunting(page);
    await home(page, 'heistcon');
    await dial(page, 'heistcon');
    await later(page, 1);
    await jobIs(page, { phase: 'idle', ready: false }, 'back mid-job');
    await nobodyHunting(page, 'back mid-job,');
    await noMeter(page, 'back mid-job,');
    check(!(await done(page)).includes('heistcon'), 'the way home mid-job ticked Heist-Con');

    // the job: the meter's next booth and the marker on it, the crew after him
    await crewUp(page);
    await start(page);
    await jobIs(page, { phase: 'run' }, 'the plan didn’t start the job');
    const order = (await job(page)).order;
    await meterSays(page, TITLE, JOB.words.next(label(order[0]), 0, 4));
    await crewHunting(page);
    await goalIs(page, order[0], 'on the job');
    // one right, its alarm lit; then a wrong booth: back to the first, every alarm dark
    await press(page, order[0]);
    await lampsAre(page, lit([order[0]]), 'with the first booth lifted,');
    await press(page, order[2]);
    await meterSays(page, TITLE, JOB.words.dark(label(order[0])));
    await jobIs(page, { phase: 'run', on: 0 }, 'a wrong booth');
    await lampsAre(page, lit([]), 'after a wrong booth,');
    // a booth lifted again costs nothing
    await press(page, order[0]);
    await press(page, order[0]);
    await meterSays(page, TITLE, JOB.words.again(label(order[1])));
    // beside the cat burglar: caught, the crew home, the badge first again, the plan waiting
    const cat = await page.evaluate(() => window.__C137__.api.act('heistcon', 'npcs').find((n) => n.id === 'heister-b1'));
    await warp(page, 'heistcon', cat.x + 0.6, cat.z);
    await toast(page, H.caught);
    check((await page.locator('.rm-toast', { hasText: 'A cat burglar' }).count()) === 1, 'the catch wasn’t the cat burglar’s');
    await caught(page, wayInOf('heistcon'));
    await later(page, 1);
    await nobodyHunting(page, 'after a catch,');
    await jobIs(page, { phase: 'idle', ready: false }, 'after a catch');
    await goalIs(page, 'heistbadge', 'after a catch');
    await start(page);
    await toast(page, JOB.before);

    // the keynote run out: its own line, back at the door
    await crewUp(page);
    await start(page);
    await jobIs(page, { phase: 'run' }, 'the plan didn’t start the job again');
    await page.evaluate(() => window.__C137__.api.act('heistcon', 'setSequence', { left: 0.05 }));
    await toast(page, JOB.lost);
    await caught(page, wayInOf('heistcon'));

    // the job, done, its last booth lifted in the frame the cat burglar reaches
    // him: caught, and the win still his; the achievement at last, the crew
    // home, the Vindicators next
    await crewUp(page);
    await start(page);
    await jobIs(page, { phase: 'run' }, 'the plan didn’t start the job');
    const dealt = (await job(page)).order;
    for (const id of dealt.slice(0, -1)) await press(page, id);
    await crewHunting(page);
    await page.evaluate((last) => {
      const c = window.__C137__;
      const cat = c.api.act('heistcon', 'npcs').find((n) => n.id === 'heister-b1');
      c.warp('heistcon', cat.x + 0.6, cat.z);
      c.api.act('heistcon', `sequence-${last}`);
    }, dealt.at(-1));
    await toast(page, H.caught);
    await isDone(page, 'heistcon', 'the last booth lifted as the cat burglar caught him didn’t win Heist-Con');
    await achieved(page, 'heistcon', 'The con is the heist wasn’t earned');
    await caught(page, wayInOf('heistcon'));
    await later(page, 1);
    await nobodyHunting(page, 'with the job done,');
    await noMeter(page, 'with the job done,');
    await lampsAre(page, lit(JOB.items), 'with the job done,');
    await at(page, 11, 1, 'after Heist-Con');
    await reads(page, VIND.text);
    await noLink(page, 'after Heist-Con');
    await goalIs(page, 'heistcon-portal', 'in Heist-Con, done');
    await opens(page, SCORE.unlocks, false, 'after Heist-Con alone');
    await home(page, 'heistcon');

    // Rick's rooms: the first by keys
    await dial(page, 'vindicators');
    await reads(page, VIND.text);
    await noLink(page, 'on the Vindicators’ ship');
    await goalIs(page, 'saw', 'on the Vindicators’ ship');
    await warpUse(page, 'vindicators', 'saw', ...spotAt('vindicators', 'saw'));
    await roomIs(page, 1);
    check((await rooms(page).locator('.rm-dial-lead').textContent()) === ROOMS[0].prompt, 'the first room asks something else');
    const k = ROOMS[0].choices.indexOf(right(0));
    for (let n = 0; n < k; n++) await page.keyboard.press('ArrowDown');
    await rooms(page).locator('.rm-dial-row[data-on]', { hasText: right(0).text }).waitFor({ timeout: 5000 });
    await page.keyboard.press('Enter');
    await roomIs(page, 2);
    // a wrong pick by click: the lot lost, by the door still
    await click(page, ROOMS[1].choices.find((c) => !c.right).text);
    await rooms(page).waitFor({ state: 'detached', timeout: 5000 });
    await toast(page, SAY.lost.text);
    check(!(await done(page)).includes('vindicators'), 'a wrong pick ticked the Vindicators');
    await at(page, 11, 1, 'after a wrong pick');
    check((await page.evaluate(() => window.__C137__.sim.near?.id)) === 'saw', 'a wrong pick moved him from the door');
    // again from the first room; Esc mid-trial keeps the room
    await use(page, 'saw');
    await roomIs(page, 1);
    await click(page, right(0).text);
    await roomIs(page, 2);
    await page.keyboard.press('Escape');
    await rooms(page).waitFor({ state: 'detached', timeout: 5000 });
    await use(page, 'saw');
    await roomIs(page, 2);
    await click(page, right(1).text);
    await roomIs(page, 3);
    await click(page, right(2).text);
    // the rooms won: the last step (its closing line over the rooms' own)
    await isDone(page, 'vindicators', 'the rooms won didn’t tick the Vindicators');
    await achieved(page, 'vindicators', 'Rick’s rooms’ achievement wasn’t earned');
    check((await rooms(page).count()) === 0, 'the rooms stayed open once won');
    await over(page, 'after episode 12');
    await home(page, 'vindicators');
    await reads(page, EVIL.steps[0].text);
    for (const id of SCORE.unlocks) check((await page.evaluate((id) => window.__C137__.dial(id), id)) === id, `the dial wouldn’t take ${id} after episode 12`);
  },

  // a returner whose old collect ticked Heist-Con: past it at once, its
  // achievement given on the visit, the job at rest; the Vindicators end it
  'score-returner': Object.assign(
    async (page) => {
      await openOnCard(page, '#/c-137', 11);
      await at(page, 11, 1, 'for a returner with Heist-Con done');
      await reads(page, VIND.text);
      check(await ticked(page, HEIST.text), 'the Story tab doesn’t tick Heist-Con');
      await dial(page, 'heistcon');
      await achieved(page, 'heistcon', 'The con is the heist wasn’t given on the visit');
      await later(page, 1);
      await noMeter(page, 'with the job done,');
      await nobodyHunting(page, 'with the job done,');
      await crewUp(page);
      await start(page);
      // (its own line said, and no word of a crew after it)
      await toast(page, H.say.heistplan.text);
      await never(page, JOB.before, 1500, 'the plan asked for a crew for a job already done');
      await jobIs(page, { phase: 'idle' }, 'the plan started a job already done');
      await page.evaluate(() => window.__C137__.complete('vindicators'));
      await over(page, 'after the Vindicators');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 11, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['heistcon'] } },
  ),

  // the Vindicators done first: Heist-Con's line still, the Vindicators
  // ticked ahead; the job's win ends the episode
  'score-backwards': Object.assign(
    async (page) => {
      await openOnCard(page, '#/c-137', 11);
      await at(page, 11, 0, 'with the Vindicators done first');
      await reads(page, HEIST.text);
      check(await ticked(page, VIND.text), 'the Story tab doesn’t tick the Vindicators');
      check(!(await ticked(page, HEIST.text)), 'the Story tab ticks Heist-Con');
      await dial(page, 'heistcon');
      await lift(page);
      await achieved(page, 'heistcon', 'The con is the heist wasn’t earned');
      await over(page, 'after Heist-Con, the Vindicators done first');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 11, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['vindicators'] } },
  ),
};
