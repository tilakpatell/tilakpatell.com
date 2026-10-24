// The browser check's scenarios for episode 13, Evil Rick, the last
// (../rm-story-check.mjs): a new visitor's way from episode 13's card through
// the Blood Dome's fight, Evil Rick's pods and fight, the Morty with the
// eyepatch and the gun put back on Rick's bench, which ends the story; each
// fight lost, walked out of through the portal and won, and what's left of it
// after; a returner who'd done all three places before it was built, and one
// who'd done the lair first.
/* global window, document */
import { check, use, reads, at, opens, toast, playTo, later, warpUse, warp, caught, spotAt, wayInOf, goalIs, noLink, hunting, inArea, open, openOnCard, dial, home, notDone, ticked, done, isDone, achieved, gun, PLACES, EVIL, SCORE, CABLE } from './helpers.mjs';

const [DOME, LAIR, EYEPATCH, BENCH_STEP] = EVIL.steps;
// a stand in Rick's garage where the bench (the dial) is the nearest thing
const BENCH = [-301.75, 100.15, Math.PI];
const WHO = { blooddome: 'hemorrhage', evilrick: 'evilrick' };
const huntOf = (area) => PLACES.dest(area).people.find((p) => p.id === WHO[area]).ai.hunt;
const him = (page, area) => page.evaluate(([a, w]) => window.__C137__.api.act(a, 'npcs').find((n) => n.id === w), [area, WHO[area]]);
const said = (area, id) => PLACES.dest(area).say[id].text;
// the fight on: its panel up, and the sim's duel his
const fightOn = (page, area) =>
  page.waitForFunction((w) => window.__C137__.sim.duel?.who === w && Boolean(document.querySelector('.rm-fight')), WHO[area], { timeout: 15000, polling: 100 }).catch(() => {
    throw new Error(`the fight with ${WHO[area]} didn’t start`);
  });
const noFight = async (page, when) => {
  check((await page.locator('.rm-fight').count()) === 0, `${when} the fight’s panel showed`);
  check((await page.evaluate(() => window.__C137__.sim.duel)) == null, `${when} the fight was still on`);
};
// a stand `r` m from him, facing him: from the way in round, the first of
// eight bearings inside the place, a metre clear of its solids and with
// none between them (a figure facing f looks along (cos f, −sin f))
function standOff(area, h, r) {
  const d = PLACES.dest(area);
  const inside = (x, z, m) => d.solids.some((o) => (o.r != null ? Math.hypot(x - o.x, z - o.z) < o.r + m : Math.abs(x - o.x) < o.w / 2 + m && Math.abs(z - o.z) < o.d / 2 + m));
  for (const b of [0, 1, -1, 2, -2, 3, -3, 4].map((k) => (k * Math.PI) / 4)) {
    const [dx, dz] = [r * Math.sin(b), r * Math.cos(b)];
    const [x, z] = [h.x + dx, h.z + dz];
    if (x < d.area.x0 + 1 || x > d.area.x1 - 1 || z < d.area.z0 + 1 || z > d.area.z1 - 1 || inside(x, z, 1)) continue;
    if (Array.from({ length: 8 }, (_, i) => (i + 1) / 9).some((k) => inside(x - dx * k, z - dz * k, 0))) continue;
    return [x, z, Math.atan2(dz, -dx)];
  }
  throw new Error(`nowhere to stand ${r} m from ${WHO[area]} at ${h.x}, ${h.z}`);
}
// won: fired at from a fresh stand 6 m off, each shot that lands one off him
async function win(page, area) {
  await fightOn(page, area);
  await later(page, 0.3);
  const max = huntOf(area).duel.hp;
  for (let i = 0; i < 3 * max; i++) {
    const h = await him(page, area);
    if (h.dead) break;
    const before = h.hp ?? max;
    await warp(page, area, ...standOff(area, h, 6));
    await page.keyboard.press('f');
    await page.waitForFunction(([a, w, hp]) => window.__C137__.api.act(a, 'npcs').find((n) => n.id === w).hp < hp, [area, WHO[area], before], { timeout: 3000, polling: 50 }).catch(() => {});
    const after = await him(page, area);
    check(after.hp == null || after.hp >= before - 1, `a shot took ${before - after.hp} off ${WHO[area]}`);
    await later(page, 0.55);
  }
  check((await him(page, area)).dead, `${WHO[area]} wasn’t beaten`);
}
// lost: stood a metre off him till the fade, his line, back at the way in, the fight over
async function lose(page, area) {
  await fightOn(page, area);
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__C137__.sim.fading)); i++) {
    await warp(page, area, ...standOff(area, await him(page, area), 1));
    await later(page, 0.3);
  }
  await toast(page, huntOf(area).line);
  await caught(page, wayInOf(area));
  await later(page, 0.5);
  await noFight(page, 'after a loss,');
  check((await hunting(page, area)).length === 0, `${WHO[area]} kept hunting after a loss`);
  const h = await him(page, area);
  check(h.hp == null && !h.dead, `${WHO[area]} after a loss: ${JSON.stringify(h)}`);
  await notDone(page, huntOf(area).duel.task, `a loss ticked ${area}`);
}
// a fight walked out of through the portal: over, and the gun works again
async function fled(page, area) {
  await home(page, area);
  await later(page, 0.5);
  await noFight(page, 'home from a fight,');
  check(await page.getByRole('button', { name: /Portal gun/ }).first().isVisible(), 'the portal gun’s chip didn’t come back');
  const shot = await page.evaluate(() => window.__C137__.sim.firedAt ?? null);
  await page.keyboard.press('f');
  await later(page, 0.3);
  check((await page.evaluate(() => window.__C137__.sim.firedAt ?? null)) === shot, 'F still fired in the garage');
  await page.keyboard.press('p');
  await page.locator('.rm-dial-box').waitFor({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.locator('.rm-dial-box').waitFor({ state: 'detached', timeout: 5000 });
  await warp(page, 'garage', ...BENCH);
  await use(page, 'dial');
  await page.locator('.rm-dial-box').waitFor({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.locator('.rm-dial-box').waitFor({ state: 'detached', timeout: 5000 });
}
// the gun put back on Rick's bench, the press that ends the story: Rick's last line in the clear
async function theEnd(page) {
  await goalIs(page, 'dial', 'home with the gun');
  await warp(page, 'garage', ...BENCH);
  await use(page, 'dial');
  await toast(page, EVIL.outro[0][1]);
  check((await page.locator('.rm-dial-box').count()) === 0, 'the dial opened over Rick’s last line');
  // (nothing over it while it's up)
  const top = await page.evaluate((text) => {
    const t = [...document.querySelectorAll('.rm-toast')].find((o) => o.textContent.includes(text));
    const r = t?.getBoundingClientRect();
    return Boolean(r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.rm-toast') === t);
  }, EVIL.outro[0][1]);
  check(top, 'something lay over Rick’s last line');
  await later(page, 1.5);
  check((await page.locator('.rm-dial-box').count()) === 0, 'the dial opened over Rick’s last line');
  await at(page, 13, 0, 'at the end');
  await reads(page, CABLE);
  await noLink(page, 'at the end');
  await opens(page, PLACES.dial, true, 'at the end');
  await page.waitForTimeout(2000);
  check((await page.locator('.rm-episode').count()) === 0, 'a card showed after the last episode');
}

export const EVIL_CHECKS = {
  // a new visitor plays episode 13 start to finish: the Dome's fight, the
  // lair's pods and fight, the Morty with the eyepatch, the bench
  async 'episode-13'(page) {
    await playTo(page, 12, ['cabinet', 'chase']);
    await at(page, 12, 0, 'at episode 13');
    await opens(page, SCORE.unlocks, true, 'at episode 13');
    await reads(page, DOME.text);
    await noLink(page, 'in C-137');
    check(!(await page.locator('.rm-list-rest', { hasText: 'whole story' }).count()), 'the story read as over at episode 13');
    await page.evaluate(() => window.__C137__.goto('garage', -302.3, 101.4, Math.PI));
    await inArea(page, 'garage');
    await goalIs(page, 'garage-portal', 'in the garage');

    // the Blood Dome: the ring, the hint, the fight won
    await dial(page, 'blooddome');
    await goalIs(page, 'ring', 'in the Blood Dome');
    await warpUse(page, 'blooddome', 'ring', ...spotAt('blooddome', 'ring'));
    await fightOn(page, 'blooddome');
    const hint = await page.locator('.rm-fight').textContent();
    check(hint.includes('F fires. Keep out of reach.') && hint.includes('Tab locks on'), `the fight’s hint reads “${hint}”`);
    await later(page, 0.3);
    check((await page.evaluate(() => window.__C137__.sim.near?.id ?? null)) !== 'ring', 'the ring stayed in reach mid-fight');
    await win(page, 'blooddome');
    await isDone(page, 'blooddome', 'Hemorrhage beaten didn’t tick the Blood Dome');
    await achieved(page, 'blooddome', 'A man now wasn’t earned');
    await toast(page, huntOf('blooddome').duel.won.text);
    await page.locator('.rm-fight').waitFor({ state: 'detached', timeout: 6000 });
    await at(page, 12, 1, 'after the Blood Dome');
    await reads(page, LAIR.text);
    await goalIs(page, 'blooddome-portal', 'in the Blood Dome, won');
    await home(page, 'blooddome');

    // the lair: the pods in turn, then Evil Rick
    await dial(page, 'evilrick');
    for (const [i, id] of ['pod1', 'pod2', 'pod3'].entries()) {
      await goalIs(page, id, `at the lair’s pod ${i + 1}`);
      await warpUse(page, 'evilrick', id, ...spotAt('evilrick', id, Math.PI));
      await later(page, 0.3);
      check((await page.evaluate(() => window.__C137__.sim.near?.id ?? null)) !== id, `${id} stayed in reach once freed`);
    }
    await win(page, 'evilrick');
    await isDone(page, 'evilrick', 'Evil Rick beaten didn’t tick his lair');
    await achieved(page, 'evilrick', 'Close Rick-counters wasn’t earned');
    await at(page, 12, 2, 'after Evil Rick');
    await goalIs(page, 'evilmorty', 'with Evil Rick down');

    // the Morty with the eyepatch: his reveal read before it counts
    await warpUse(page, 'evilrick', 'evilmorty', ...spotAt('evilrick', 'evilmorty'));
    await toast(page, said('evilrick', 'evilmorty'));
    await page.waitForTimeout(4000);
    check((await page.locator('.rm-toast', { hasText: said('evilrick', 'evilmorty') }).count()) === 1, 'the reveal was covered before it was read');
    check(!(await done(page)).includes('evilmorty'), 'the talk counted before the reveal was read');
    await isDone(page, 'evilmorty', 'the talk didn’t tick the Morty with the eyepatch');
    await achieved(page, 'evilmorty', 'The one behind him wasn’t earned');
    await at(page, 12, 3, 'after the talk');
    await reads(page, BENCH_STEP.text);
    await goalIs(page, 'evilrick-portal', 'in the lair, everything done');
    await later(page, 1);
    check((await page.evaluate(() => window.__C137__.sim.near?.id ?? null)) !== 'evilmorty', 'the Morty with the eyepatch could be talked to again');

    // the bench: the end
    await home(page, 'evilrick');
    await theEnd(page);
    await goalIs(page, 'garage-kitchen', 'at the end');
    await page.keyboard.press('m');
    const list = page.locator('#rm-list');
    await list.waitFor({ timeout: 10000 });
    check((await list.locator('li.rm-story-ep[data-done]').count()) === 13, 'the Story tab doesn’t tick all thirteen');
    check((await list.locator('.rm-list-rest', { hasText: 'That’s the whole story: the Checklist tab has the rest.' }).count()) === 1, 'the Story tab doesn’t close the story');
    check((await list.getByText('More of the story soon.').count()) === 0, 'the Story tab says there’s more to come');
    await page.keyboard.press('m');
    await list.waitFor({ state: 'detached', timeout: 5000 });
    await gun(page);
    const n = PLACES.dial.length;
    check((await page.locator('.rm-dial-box').textContent()).includes(`Coordinates home: ${n} of ${n}`), 'the dial doesn’t read every coordinate home');
    await page.keyboard.press('Escape');
    await page.locator('.rm-dial-box').waitFor({ state: 'detached', timeout: 5000 });
    await use(page, 'dial');
    await page.locator('.rm-dial-box').waitFor({ timeout: 10000 });
    await page.keyboard.press('Escape');
  },

  // the Blood Dome's fight lost, walked out of and won, and what's left of it after
  'dome-fights': Object.assign(
    async (page) => {
      await openOnCard(page, '#/c-137', 12);
      await dial(page, 'blooddome');
      const ring = spotAt('blooddome', 'ring');
      await warpUse(page, 'blooddome', 'ring', ...ring);
      await fightOn(page, 'blooddome');
      check(JSON.stringify(await hunting(page, 'blooddome')) === '["hemorrhage"]', 'Hemorrhage didn’t come for him');
      await lose(page, 'blooddome');
      await at(page, 12, 0, 'after a loss');
      await goalIs(page, 'ring', 'after a loss');
      await warpUse(page, 'blooddome', 'ring', ...ring);
      await fightOn(page, 'blooddome');
      await fled(page, 'blooddome');
      await dial(page, 'blooddome');
      check((await him(page, 'blooddome')).hp == null, 'Hemorrhage wasn’t whole again after a flight');
      await warpUse(page, 'blooddome', 'ring', ...ring);
      await win(page, 'blooddome');
      await achieved(page, 'blooddome', 'A man now wasn’t earned');
      await at(page, 12, 1, 'after the win');
      // (his place hunts no more: the ring's own act, then a revisit)
      await page.evaluate(() => window.__C137__.api.act('blooddome', 'fight'));
      await later(page, 1);
      check((await hunting(page, 'blooddome')).length === 0, 'a body hunted him after the win');
      await page.locator('.rm-fight').waitFor({ state: 'detached', timeout: 6000 });
      await home(page, 'blooddome');
      await dial(page, 'blooddome');
      await warpUse(page, 'blooddome', 'ring', ...ring);
      await later(page, 1);
      check((await hunting(page, 'blooddome')).length === 0 && (await him(page, 'blooddome')).dead, 'Hemorrhage came back from the dead');
      await noFight(page, 'at the ring after the win,');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 12, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } } } },
  ),

  // the lair: the Morty with the eyepatch not yet, the fight lost, walked out of and won, then him
  'lair-fights': Object.assign(
    async (page) => {
      await open(page, '#/c-137');
      await dial(page, 'evilrick');
      await goalIs(page, 'pod1', 'in the lair');
      const eye = PLACES.spot('evilrick', 'evilmorty');
      await warp(page, 'evilrick', eye.x, eye.z + 0.8);
      await later(page, 0.5);
      check((await page.evaluate(() => window.__C137__.sim.near?.id ?? null)) !== 'evilmorty', 'the Morty with the eyepatch talked before Evil Rick was down');
      const pods = async () => {
        for (const id of ['pod1', 'pod2', 'pod3']) await warpUse(page, 'evilrick', id, ...spotAt('evilrick', id, Math.PI));
      };
      await pods();
      await lose(page, 'evilrick');
      await goalIs(page, 'pod1', 'after a loss');
      await warp(page, 'evilrick', ...spotAt('evilrick', 'pod1', Math.PI));
      await page.waitForFunction(() => window.__C137__.sim.near?.id === 'pod1', null, { timeout: 10000, polling: 100 }).catch(() => {
        throw new Error('the pods weren’t back after a loss');
      });
      await pods();
      await fightOn(page, 'evilrick');
      await fled(page, 'evilrick');
      await dial(page, 'evilrick');
      await pods();
      await win(page, 'evilrick');
      await achieved(page, 'evilrick', 'Close Rick-counters wasn’t earned');
      await toast(page, huntOf('evilrick').duel.won.text);
      await at(page, 12, 2, 'after the win');
      await goalIs(page, 'evilmorty', 'after the win');
      await page.evaluate(() => window.__C137__.api.act('evilrick', 'collected'));
      await later(page, 1);
      check((await hunting(page, 'evilrick')).length === 0, 'a body hunted him after the win');
      await warpUse(page, 'evilrick', 'evilmorty', ...spotAt('evilrick', 'evilmorty'));
      await achieved(page, 'evilmorty', 'The one behind him wasn’t earned');
      await at(page, 12, 3, 'after the talk');
      await goalIs(page, 'evilrick-portal', 'after the talk');
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 12, step: 1, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['blooddome'] } },
  ),

  // a returner who'd done all three places before episode 13 was built
  'evil-returner': Object.assign(
    async (page) => {
      await openOnCard(page, '#/c-137', 12);
      await at(page, 12, 3, 'for a returner');
      await reads(page, BENCH_STEP.text);
      for (const s of [DOME, LAIR, EYEPATCH]) check(await ticked(page, s.text), `the Story tab doesn’t tick “${s.text}”`);
      check(!(await ticked(page, BENCH_STEP.text)), 'the Story tab ticks the bench');
      await goalIs(page, 'garage-door', 'in the street');
      await dial(page, 'blooddome');
      await achieved(page, 'blooddome', 'A man now wasn’t given on the visit');
      await home(page, 'blooddome');
      await dial(page, 'evilrick');
      await achieved(page, 'evilrick', 'Close Rick-counters wasn’t given on the visit');
      await achieved(page, 'evilmorty', 'The one behind him wasn’t given on the visit');
      await home(page, 'evilrick');
      await theEnd(page);
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 12, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['blooddome', 'evilrick', 'evilmorty'] } },
  ),

  // the lair done first: the Dome's win takes the story straight to the bench
  'evil-backwards': Object.assign(
    async (page) => {
      await openOnCard(page, '#/c-137', 12);
      await at(page, 12, 0, 'with the lair done first');
      await reads(page, DOME.text);
      check((await ticked(page, LAIR.text)) && (await ticked(page, EYEPATCH.text)), 'the Story tab doesn’t tick the lair’s two');
      check(!(await ticked(page, DOME.text)) && !(await ticked(page, BENCH_STEP.text)), 'the Story tab ticks the Dome or the bench');
      await dial(page, 'blooddome');
      await warpUse(page, 'blooddome', 'ring', ...spotAt('blooddome', 'ring'));
      await win(page, 'blooddome');
      await at(page, 12, 3, 'after the Dome, the lair done first');
      await page.waitForTimeout(1500);
      check((await page.locator('.rm-episode').count()) === 0, 'a card showed mid-episode');
      await reads(page, BENCH_STEP.text);
      await achieved(page, 'blooddome', 'A man now wasn’t earned');
      await goalIs(page, 'blooddome-portal', 'in the Blood Dome, everything done');
      await home(page, 'blooddome');
      await theEnd(page);
    },
    { seed: { 'tp-rm-story': { v: 1, data: { episode: 12, step: 0, got: [], wins: ['cabinet', 'chase'], freeRoam: false } }, 'tp-c137-done': ['evilrick', 'evilmorty'] } },
  ),
};
