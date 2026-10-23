// The browser check's scenarios for episodes 5 to 8 (../rm-story-check.mjs):
// the cruiser's chase and the Gromflomite base, Needful Things and the vat,
// the Jerryboree and St. Gloopy Noops, the cable studio and Get Schwifty.
/* global window, document */
import { COURSE, chaseStart, newChase } from '../../src/components/rickmorty/world/games/chase.js';
import { BASE, OUT, N, check, done, built, goto, use, story, reads, WIPED, SMALL, HEAT, DEALS, JERRY, throughPortal, toast, inArea, cardFor, at, opens, warpUse, caught, before, chasing, playTo, game, homeOf, spotAt, wayInOf, place, PRIME, FAIRY, standOn, later, PLACES } from './helpers.mjs';

export const LATE = {
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
    await caught(page, wayInOf('gromflomites'));
    check(!(await done(page)).includes('gromflomites'), 'a catch counted');
    // (a guard may catch him at the cell: each catch a reset, checked, and round again)
    let opened = false;
    for (let round = 0; round < 4 && !opened; round++) {
      await warpUse(page, 'gromflomites', 'fartcell', ...spotAt('gromflomites', 'fartcell')).catch(() => {});
      opened = await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('gromflomites'), null, { timeout: 30000, polling: 250 }).then(
        () => true,
        () => false,
      );
      if (!opened) await caught(page, wayInOf('gromflomites'));
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
    await warpUse(page, 'needful', 'typewriter', ...spotAt('needful', 'typewriter', Math.PI));
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
    await warpUse(page, 'needful', 'aftershave', ...spotAt('needful', 'aftershave', 0));
    await seen('aftershave', 'bad');
    await warpUse(page, 'needful', 'cream', ...spotAt('needful', 'cream', 0));
    await seen('cream', 'bad');
    check((await game(page, 'needful', 'deal')).left === 0, 'three looks didn’t use the looks up');
    // no looks left: the clock chanced, and cursed
    await warpUse(page, 'needful', 'shopclock', ...spotAt('needful', 'shopclock', N, 0));
    await seen('shopclock', 'blind');
    await use(page, 'shopclock');
    await caught(page, wayInOf('needful'));
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
    await warpUse(page, 'needful', 'needful-portal', ...homeOf('needful'));
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
    await caught(page, wayInOf('vat'));
    check((await game(page, 'vat', 'freeze')).phase === 'idle' && !(await done(page)).includes('vat'), 'a move while they looked counted');
    await page.evaluate(() => window.__C137__.api.act('vat', 'setFreeze', { phase: 'run', eyes: 'away', left: 30, len: 30 }));
    await warpUse(page, 'vat', 'vatrim', ...spotAt('vat', 'vatrim', N, 1.4));
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
    await warpUse(page, 'jerryboree', 'jerrytv', ...spotAt('jerryboree', 'jerrytv'));
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
    await caught(page, wayInOf('jerryboree'));
    check((await game(page, 'jerryboree', 'find')).phase === 'idle' && !(await done(page)).includes('jerryboree'), 'a find run out of time counted');
    // dealt afresh: ours the Jerry by the door, talked to and picked
    await ours('jerryreal');
    await warpUse(page, 'jerryboree', 'jerryreal', ...spotAt('jerryboree', 'jerryreal', Math.PI));
    await use(page, 'jerryreal');
    await toast(page, 'Pick up the right Jerry');
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]'))).includes('jerryboree'), 'the right Jerry’s achievement wasn’t earned');
    await at(page, 6, 1, 'after the Jerryboree');
    await reads(page, JERRY.steps[1].text);
    await warpUse(page, 'jerryboree', 'jerryboree-portal', ...homeOf('jerryboree'));
    await inArea(page, 'garage');
    // St. Gloopy Noops: a doctor's catch; then Shrimply and Jerry's things, and out on the clock
    check((await page.evaluate(() => window.__C137__.dial('gloopynoops'))) === 'gloopynoops', 'the dial wouldn’t take St. Gloopy Noops');
    await throughPortal(page);
    await inArea(page, 'gloopynoops');
    await page.waitForFunction(() => (window.__C137__.api.act('gloopynoops', 'npcs') ?? []).some((n) => n.id === 'gdoctor-b'), null, { timeout: 120000, polling: 500 });
    const doc = await page.evaluate(() => window.__C137__.api.act('gloopynoops', 'npcs').find((n) => n.id === 'gdoctor-b'));
    await page.evaluate(([x, z]) => window.__C137__.warp('gloopynoops', x + 0.6, z, Math.PI), [doc.x, doc.z]);
    await caught(page, wayInOf('gloopynoops'));
    check(!(await done(page)).includes('gloopynoops'), 'a catch counted');
    const THINGS = [
      ['shrimply', N],
      ['jerrysthings', Math.PI],
    ];
    // (a doctor may catch him in the theatre: each catch a reset, checked, and round again)
    let taken = false;
    for (let round = 0; round < 4 && !taken; round++) {
      for (const [id, f] of THINGS) await warpUse(page, 'gloopynoops', id, ...spotAt('gloopynoops', id, f)).catch(() => {});
      taken = await page.evaluate(() => window.__C137__.sim.escape?.task === 'gloopynoops');
      if (!taken) await caught(page, wayInOf('gloopynoops'));
    }
    check(taken, 'Jerry’s things taken back never started the clock');
    if (OUT) await page.screenshot({ path: `${OUT}/episode-7-gloopynoops.png` });
    await warpUse(page, 'gloopynoops', 'gloopynoops-portal', ...homeOf('gloopynoops'));
    // (the episode's last step: its closing line is the toast, and the way out earns its achievement)
    await toast(page, JERRY.outro[0][1]);
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]'))).includes('gloopynoops'), 'the hospital’s achievement wasn’t earned');
    // and on into episode 8: its card, the places episode 7 opened, the next ones still shut
    await cardFor(page, 7);
    await at(page, 7, 0, 'after St. Gloopy Noops');
    await opens(page, JERRY.unlocks, true, 'after episode 7');
    await opens(page, PRIME.unlocks, false, 'after episode 7');
    await reads(page, PRIME.steps[0].text);
  },
  // a new visitor plays episode 8: the cable studio's running order (a set
  // before the countdown does nothing; two on, then a wrong one and all dark;
  // the clock run out and back at the door; then every set in its turn) and
  // Get Schwifty's song at the mic (lost once, then won: counted while the
  // show's up, the episode's end told once it closes)
  async 'episode-8'(page) {
    await playTo(page, 7, ['cabinet', 'chase']);
    await at(page, 7, 0, 'at episode 8');
    await reads(page, PRIME.steps[0].text);
    check((await page.evaluate(() => window.__C137__.dial('cablestudio'))) === 'cablestudio', 'the dial wouldn’t take the cable studio');
    await throughPortal(page);
    await inArea(page, 'cablestudio');
    // (each set faces the floor: the flats and the doors from the south, the counter and the couch from the north)
    const FACE = { 'set-ants': N, 'set-legs': N, 'set-sneezy': N, 'set-field': N, 'set-doors': N, 'set-bits': -N, 'set-shmlo': -N };
    const sets = () => game(page, 'cablestudio', 'sequence');
    const switchOn = (id) => warpUse(page, 'cablestudio', id, ...spotAt('cablestudio', id, FACE[id]));
    const countdown = async () => {
      await warpUse(page, 'cablestudio', 'cablebooth', ...spotAt('cablestudio', 'cablebooth', -N, 1));
      await page.waitForFunction(() => window.__C137__.api.act('cablestudio', 'sequence').phase === 'run', null, { timeout: 30000, polling: 100 }).catch(() => {
        throw new Error('the booth didn’t start the countdown');
      });
    };
    const on = (n, what) =>
      page.waitForFunction((n) => window.__C137__.api.act('cablestudio', 'sequence').on === n, n, { timeout: 30000, polling: 100 }).catch(() => {
        throw new Error(what);
      });
    // a set used before the countdown: nothing on, no clock, and the studio says to start it
    const first = (await sets()).order[0];
    await switchOn(first);
    await toast(page, 'The studio isn’t counting down yet');
    await page.waitForTimeout(1500);
    check((await sets()).phase === 'idle' && (await sets()).on === 0, 'a set went on before the countdown');
    // the countdown at the booth: the clock on and the meter up; the first two of the running order on
    await countdown();
    await page.locator('.rm-cluster[aria-label="Going live"][data-on]').waitFor({ timeout: 10000 }).catch(() => {
      throw new Error('no countdown meter on the HUD');
    });
    const { order } = await sets();
    for (const id of order.slice(0, 2)) await switchOn(id);
    await on(2, 'the first two sets of the running order didn’t go on');
    if (OUT) await page.screenshot({ path: `${OUT}/episode-8-cablestudio.png` });
    // a wrong set: every one dark again, nothing done
    await switchOn(Object.keys(FACE).find((id) => !order.slice(0, 3).includes(id)));
    await on(0, 'a wrong set didn’t turn them all dark');
    check(!(await done(page)).includes('cablestudio'), 'a wrong set counted');
    // out of time: back at the door, the studio idle, nothing done
    await page.evaluate(() => window.__C137__.api.act('cablestudio', 'setSequence', { left: 0.05 }));
    await caught(page, wayInOf('cablestudio'));
    check((await sets()).phase === 'idle' && !(await done(page)).includes('cablestudio'), 'a countdown run out counted');
    // the countdown again (a running order dealt afresh), and every set in its turn
    await countdown();
    for (const id of (await sets()).order) await switchOn(id);
    await toast(page, 'Put the channels on air');
    check((await page.evaluate(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]'))).includes('cablestudio'), 'the studio’s achievement wasn’t earned');
    await at(page, 7, 1, 'after the cable studio');
    await reads(page, PRIME.steps[1].text);
    await warpUse(page, 'cablestudio', 'cablestudio-portal', ...homeOf('cablestudio'));
    await inArea(page, 'garage');
    // Get Schwifty: the mic opens the show over the page, and opening it counts nothing
    check((await page.evaluate(() => window.__C137__.dial('schwifty'))) === 'schwifty', 'the dial wouldn’t take Get Schwifty');
    await throughPortal(page);
    await inArea(page, 'schwifty');
    await warpUse(page, 'schwifty', 'mic', ...spotAt('schwifty', 'mic', N, 1));
    const show = place(page, 'mic');
    await show.waitFor({ timeout: 60000 }).catch(() => {
      throw new Error('the mic didn’t open the show');
    });
    await page.waitForFunction(() => window.__SCHWIFTY__, null, { timeout: 60000 });
    check(!(await done(page)).includes('schwifty'), 'the show counted as it opened');
    // a run one miss from empty, the note let past: disqualified, nothing counted
    await page.evaluate(() => {
      const S = window.__SCHWIFTY__;
      const n = S.state.notes[0];
      S.set({ ...S.state, t: n.t + 0.125, heads: 0.05 });
      S.step({});
    });
    await show.getByRole('button', { name: 'Again', exact: true }).waitFor({ timeout: 5000 });
    check((await show.locator('.schwifty-card').textContent()).includes('DISQUALIFIED.'), 'a lost song wasn’t disqualified');
    check(!(await done(page)).includes('schwifty'), 'a lost song counted');
    await page.waitForTimeout(700);
    await show.getByRole('button', { name: 'Again', exact: true }).click();
    if (OUT) {
      // (a song part-way, set rather than played: a headless browser draws a few frames a second)
      await page.evaluate(() => {
        const S = window.__SCHWIFTY__;
        S.set({ ...S.state, t: 21.2, heads: 0.72, notes: S.state.notes.map((n) => (n.t < 21 ? { ...n, hit: 'great' } : n)) });
      });
      await page.screenshot({ path: `${OUT}/episode-8-schwifty.png` });
    }
    // the song at its last note: one press wins, and the task counts while the show's still up
    await page.evaluate(() => {
      const S = window.__SCHWIFTY__;
      const last = S.state.notes.at(-1);
      S.set({ ...S.state, t: last.t - 1 / 60, heads: 0.6, notes: S.state.notes.map((n) => (n === last ? n : { ...n, hit: 'great' })) });
      S.step({ hit: last.lane });
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('schwifty'), null, { timeout: 10000 }).catch(() => {
      throw new Error('the song’s win didn’t count');
    });
    check(await show.isVisible(), 'the show closed on the win');
    check((await page.locator('.rm-toast', { hasText: PRIME.outro[0][1] }).count()) === 0, 'the closing line was said under the show');
    check((await page.locator('.rm-episode').count()) === 0, 'a card showed under the show');
    await page.waitForTimeout(700);
    await show.locator('.schwifty-card').getByRole('button', { name: 'Leave', exact: true }).click();
    await show.waitFor({ state: 'detached', timeout: 10000 });
    // (the episode's last step: its closing line is the toast, and the song won earns its achievement once the show's closed)
    await toast(page, PRIME.outro[0][1]);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('schwifty'), null, { timeout: 30000, polling: 250 }).catch(() => {
      throw new Error('the song’s achievement wasn’t earned');
    });
    // and on into episode 9: its card, the places episode 8 opened, the next ones still shut
    await cardFor(page, 8);
    await at(page, 8, 0, 'after Get Schwifty');
    await opens(page, PRIME.unlocks, true, 'after episode 8');
    await opens(page, FAIRY.unlocks, false, 'after episode 8');
    await reads(page, FAIRY.steps[0].text);
  },
  // a new visitor plays episode 9: Fantasy World's climb (no meter at the
  // way in, the stair's mood near its foot; up on a landing; bitten on a
  // tread mid-bite and back at the way in; then the last hop to the crown
  // with the keys, the win and its achievement) and Froopyland's Tommy
  async 'episode-9'(page) {
    await playTo(page, 8, ['cabinet', 'chase']);
    await at(page, 8, 0, 'at episode 9');
    await reads(page, FAIRY.steps[0].text);
    check((await page.evaluate(() => window.__C137__.dial('fantasy'))) === 'fantasy', 'the dial wouldn’t take Fantasy World');
    await throughPortal(page);
    await inArea(page, 'fantasy');
    const climb = () => game(page, 'fantasy', 'climb');
    const meter = () => page.locator('.rm-cluster[aria-label="Up the beanstalk"][data-on]').count();
    check((await climb()).phase === 'idle', 'the climb started before Morty was on a stair');
    check((await meter()) === 0, 'the climb’s meter showed at the way in');
    // by the stairs' foot: the meter, with the stair's mood
    const foot = PLACES.spot('fantasy', 'goblins');
    await page.evaluate(([x, z]) => window.__C137__.warp('fantasy', x, z, Math.PI / 2), [foot.x, foot.z + 1]);
    await page.waitForFunction(() => document.querySelector('.rm-cluster[aria-label="Up the beanstalk"][data-on]'), null, { timeout: 30000, polling: 100 }).catch(() => {
      throw new Error('no climb meter at the stairs’ foot');
    });
    // up on the first landing: it holds him, and the climb's on
    await standOn(page, 'fantasy', 'landing-1', { dz: 0.7 });
    await later(page, 1);
    const up = await page.evaluate(() => ({ y: window.__C137__.sim.m.y, phase: window.__C137__.api.act('fantasy', 'climb').phase }));
    check(Math.abs(up.y - PLACES.ledge('fantasy', 'landing-1')[2]) < 1e-3 && up.phase === 'run', `the landing didn’t hold him (${JSON.stringify(up)})`);
    // the second stair mid-bite with Morty on its top tread: bitten, back at the way in, nothing done
    const [bx, bz, by] = PLACES.ledge('fantasy', 'g2-top');
    await page.evaluate(([x, z, y]) => {
      window.__C137__.api.act('fantasy', 'setClimb', { t: 4.65 });
      const s = window.__C137__.sim;
      s.m = { ...s.m, x, z, y, vy: 0, vx: 0, vz: 0, speed: 0, air: false };
    }, [bx, bz + 0.25, by]);
    await caught(page, wayInOf('fantasy'));
    check((await climb()).phase === 'idle' && !(await done(page)).includes('fantasy'), 'a bite didn’t start the climb afresh');
    // the last hop, with the keys: from the top shoot onto the crown
    const [cx, cz] = PLACES.ledge('fantasy', 'beanstalk');
    await standOn(page, 'fantasy', 'shoot-16');
    await page.evaluate(([cx, cz]) => {
      const s = window.__C137__.sim;
      s.yaw = Math.atan2(-(cx - s.m.x), -(cz - s.m.z));
      s.dragAt = s.t;
    }, [cx, cz]);
    await later(page, 0.2);
    await page.keyboard.down('ArrowUp');
    await later(page, 0.25);
    await page.keyboard.down('Space');
    await later(page, 0.1);
    await page.keyboard.up('Space');
    await later(page, 0.5);
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-c137-done') ?? '[]').includes('fantasy'), null, { timeout: 30000 }).catch(() => {
      throw new Error('the crown didn’t win the climb');
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('fantasy'), null, { timeout: 30000, polling: 250 }).catch(() => {
      throw new Error('the climb’s achievement wasn’t earned');
    });
    check((await page.evaluate(() => window.__C137__.sim.near?.id)) === 'giants', 'the giants weren’t by him on the crown');
    await at(page, 8, 1, 'after Fantasy World');
    await reads(page, FAIRY.steps[1].text);
    // Froopyland: Tommy, past the Froopylanders, and his achievement
    check((await page.evaluate(() => window.__C137__.dial('froopyland'))) === 'froopyland', 'the dial wouldn’t take Froopyland');
    await throughPortal(page);
    await inArea(page, 'froopyland');
    await warpUse(page, 'froopyland', 'tommy', ...spotAt('froopyland', 'tommy', N));
    // (the episode's last step: its closing line is the toast)
    await toast(page, FAIRY.outro[0][1]);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('tp-achievements') ?? '[]').includes('froopyland'), null, { timeout: 30000, polling: 250 }).catch(() => {
      throw new Error('Tommy’s achievement wasn’t earned');
    });
    await at(page, 9, 0, 'after Froopyland');
    await opens(page, [...FAIRY.unlocks, 'squanch', 'evilrick'], true, 'after episode 9');
    await page.waitForTimeout(1500);
    check((await page.locator('.rm-episode').count()) === 0, 'a card showed for an episode that isn’t built');
  },
};
