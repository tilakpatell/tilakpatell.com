// The ground war played through in Node, on the rules alone (no three.js):
// the population made round you, every soldier stepped by the fight at 30
// Hz on the game's brain (brain.js, its navgrid round you on the world's own
// ground), their bolts flown, the far fights settled, the director's clock
// run, for simulated minutes on real worlds. `npm run test:ai -- ground`.
import { describe, expect, test } from 'vitest';
import { createTokens } from '../../../../lib/ai/squad';
import { siteOf } from '../sites';
import { heightFor, standable } from '../sites/validity';
import { weaponOf } from '../weaponRules';
import { createBolts, farExchange } from './bolts';
import { createDirector } from './director';
import { flatMinds } from './fixtures/minds';
import { aimError, felt, fightStep, grudge, squadsOf } from './fight';
import { covertFor } from './landing';
import { createPopulation } from './population';
import { standingOf } from './standing';
import { BURST, burstOf, damageOf, hurt } from './troops';
import { turfsOf } from './turf';

const DT = 1 / 30;
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

// a world at war round you: step(secs, you) → what happened in that time
function playOn(id, effects, { seed = 11 } = {}) {
  const site = siteOf(id);
  const rand = seeded(seed);
  const ok = (p) => standable(site, p);
  const kit = { standable: ok, height: heightFor(site) };
  const turfs = turfsOf(site, effects, kit);
  const pop = createPopulation({ site, turfs, effects, tier: 'high', seed: site.ground.seed ?? 1, rand, standable: ok });
  const squads = squadsOf(pop.soldiers, { reach: 18, war: effects.war });
  const tokens = createTokens({ pools: { shot: 3, melee: 1 }, timeout: 0.9 });
  const bolts = createBolts({ speed: 90, life: 2 });
  const director = createDirector({ turfs, effects, tier: 'high', rand });
  // (the brain's module and its navgrid on this world's ground, round you: as groundScene.js makes them)
  const { minds, window: navWin } = flatMinds({ heightAt: kit.height, standable: ok, at: site.land.at });
  let t = 0;
  let squadAt = 0;
  const log = { atYou: 0, targetedYou: new Set(), events: [], kills: 0, bolts: 0, far: 0 };
  const kill = (s) => {
    pop.died(s.id);
    squads.died(s.id);
    log.kills += 1;
  };
  const step = (you) => {
    t += DT;
    pop.update({ x: you.x, z: you.z, heading: null });
    navWin.update(you.x, you.z);
    const far = t - squadAt >= 0.5;
    if (far) squads.update(t - squadAt);
    const live = [...pop.soldiers.values()].filter((s) => s.alive);
    const bodies = live.map((s) => ({ id: s.id, x: s.b.x, y: kit.height(s.b.x, s.b.z) + 1.1, z: s.b.z, vel: null, side: s.side, kind: s.kind, squad: s.squad, firingAt: t - (s.firedAt ?? -9) < 1 ? s.firingAt : null }));
    bodies.push({ id: 'you', x: you.x, y: kit.height(you.x, you.z) + 1.1, z: you.z, vel: [0, 0], side: effects.side ?? null, kind: 'you', you: true });
    const world = { t, war: effects.war, bodies, seesThrough: () => true, tokens, squads, soldiers: pop.soldiers, minds };
    let seen = false;
    const settle = new Map();
    for (const s of live) {
      const d = Math.hypot(s.b.x - you.x, s.b.z - you.z);
      if (d > 120) continue;
      const out = fightStep(s, world, DT, rand);
      if (ok([out.x, out.z])) {
        s.b.x = out.x;
        s.b.z = out.z;
      }
      s.b.yaw = out.yaw;
      if (out.target === 'you') {
        log.targetedYou.add(s.id);
        if (!out.guessed && standingOf(s.side, { side: effects.side, war: effects.war }) === 'enemy') seen = true;
      }
      const foe = out.target && out.target !== 'you' ? pop.soldiers.get(out.target) : null;
      if (foe && d > 60 && Math.hypot(foe.b.x - you.x, foe.b.z - you.z) > 60) {
        settle.set(s.squad, foe.squad);
        continue;
      }
      // (its gun as the scene fires it: a bolt each time its brain fires, by the gun's own spread; lost, a burst where it last had it)
      s.cool = (s.cool ?? 0) - DT;
      if (out.fire && out.suppressive && s.cool <= 0 && !(s.burst > 0)) {
        s.burst = burstOf(s.weapon);
        s.burstAt = { aim: out.aim, target: out.target };
      }
      let shot = null;
      if (out.fire && !out.suppressive && out.aim) shot = { aim: out.aim, target: out.target, e: weaponOf(s.weapon).spread };
      else if (s.burst > 0 && s.cool <= 0 && s.burstAt) {
        s.burst -= 1;
        s.cool = s.burst > 0 ? Math.max(BURST.gap, weaponOf(s.weapon).every) : BURST.pause[0] + rand() * (BURST.pause[1] - BURST.pause[0]);
        const far = Math.hypot(s.burstAt.aim.x - s.b.x, s.burstAt.aim.z - s.b.z);
        shot = { ...s.burstAt, e: aimError(s, foe ? { x: foe.b.x, z: foe.b.z, vel: null } : { vel: null }, far, { now: t }) * 2.5 };
      }
      if (!shot) continue;
      s.firedAt = t;
      s.firingAt = shot.target;
      const dist = Math.hypot(shot.aim.x - s.b.x, shot.aim.z - s.b.z);
      if (shot.target === 'you') {
        log.atYou += 1;
        continue;
      }
      const e = shot.e;
      const l = dist || 1;
      bolts.fire({ from: [s.b.x, 1.4, s.b.z], dir: [(shot.aim.x - s.b.x) / l + (rand() - 0.5) * e * 2, 0, (shot.aim.z - s.b.z) / l + (rand() - 0.5) * e * 2], side: s.side, owner: s.id, damage: damageOf(s.weapon, dist, s), range: weaponOf(s.weapon).range, target: shot.target });
      log.bolts += 1;
    }
    const targets = [...pop.soldiers.values()].filter((s) => s.alive).map((s) => ({ id: s.id, x: s.b.x, y: 0, z: s.b.z, r: 0.45, h: 1.8, side: s.side }));
    for (const e of bolts.step(DT, { bodies: targets })) {
      const v = e.type === 'hit' || e.type === 'near' ? pop.soldiers.get(e.target) : null;
      // (a hit or a near miss tells it where the shot came from: fight.js's felt, as the scene has it)
      if (v?.alive) felt(v, pop.soldiers.get(e.bolt.owner), e.bolt.from, minds);
      if (e.type === 'hit' && v?.alive && hurt(v, e.bolt.damage) === 'down') kill(v);
    }
    if (far) {
      const squadOf = (q) => [...pop.soldiers.values()].filter((s) => s.squad === q && s.alive);
      for (const [a, b] of settle)
        for (const h of farExchange(squadOf(a), squadOf(b), t - squadAt, rand, { aimError, damageOf }).hits) {
          const v = pop.soldiers.get(h.to);
          log.far += 1;
          if (v?.alive && hurt(v, h.damage) === 'down') kill(v);
        }
      squadAt = t;
    }
    log.events.push(...director.update(DT, { you, population: pop, seen }));
    tokens.audit(DT, (who) => Boolean(pop.soldiers.get(who)?.alive));
  };
  return {
    site,
    turfs,
    pop,
    squads,
    director,
    log,
    minds,
    play(secs, you) {
      for (let k = 0; k < secs / DT; k++) step(typeof you === 'function' ? you(t) : you);
      return log;
    },
  };
}
const types = (log) => log.events.map((e) => e.type);

describe('the ground war, played through', () => {
  test('a Rebel on Imperial Endor: set down out of sight, found near the pad, hunted, and lost again', () => {
    const effects = { owner: 'empire', side: 'rebel', war: 'gcw', control: 1, front: false, attack: false };
    const w0 = playOn('endor', effects);
    const posts = w0.turfs[0].posts;
    const covert = covertFor(w0.site, { standable: (p) => standable(w0.site, p), seesThrough: () => true, posts });
    expect(covert).not.toBeNull();
    const w = playOn('endor', { ...effects, covertAt: covert });
    w.play(20, { x: covert[0], z: covert[1] });
    expect(w.log.targetedYou.size).toBe(0);
    const pad = w.site.land.at;
    w.play(20, { x: pad[0] + 20, z: pad[1] + 20 });
    expect(w.log.targetedYou.size).toBeGreaterThan(0);
    expect(w.log.atYou).toBeGreaterThan(0);
    // (the ones who fought you thought with the game's brain)
    expect(w.minds.stats.thinks).toBeGreaterThan(0);
    expect(types(w.log)).toContain('hunt');
    w.play(40, { x: covert[0], z: covert[1] });
    expect(types(w.log)).toContain('calm');
  });
  test('a Rebel on Rebel Hoth: walked through the pad, nobody fires', () => {
    const w = playOn('hoth', { owner: 'rebel', side: 'rebel', war: 'gcw', control: 1, front: false, attack: false });
    const pad = w.site.land.at;
    w.play(60, (t) => ({ x: pad[0] - 60 + t * 2, z: pad[1] + 5 }));
    expect(w.pop.soldiers.size).toBeGreaterThan(0);
    expect(w.log.targetedYou.size).toBe(0);
    expect(w.log.atYou).toBe(0);
  });
  test('unsworn on Tatooine: neutral till you shoot one, then its squad comes for you', () => {
    const w = playOn('tatooine', { owner: 'empire', side: null, war: 'gcw', control: 1, front: false, attack: false });
    const pad = w.site.land.at;
    const you = { x: pad[0] + 10, z: pad[1] + 10 };
    w.play(20, you);
    expect(w.pop.soldiers.size).toBeGreaterThan(0);
    expect(w.log.targetedYou.size).toBe(0);
    const near = [...w.pop.soldiers.values()].sort((a, b) => Math.hypot(a.b.x - you.x, a.b.z - you.z) - Math.hypot(b.b.x - you.x, b.b.z - you.z))[0];
    grudge(near, w.squads, 20, you);
    w.play(10, you);
    expect(w.log.targetedYou.has(near.id)).toBe(true);
    expect(w.log.atYou).toBeGreaterThan(0);
  });
  test('a front on Hoth: a raid reaches a post, the post is lost, and its reinforcement takes it back', () => {
    const w = playOn('hoth', { owner: 'empire', side: null, war: 'gcw', control: 0.15, front: true, attack: false }, { seed: 5 });
    const pad = w.turfs.find((t) => t.id === 'pad');
    expect(pad.front).toBeTruthy();
    // (you watch from between the pad and the front: the fight's within the brains' reach)
    const you = { x: pad.at[0] + pad.front.dir[0] * 60, z: pad.at[1] + pad.front.dir[1] * 60 };
    w.play(1200, you);
    const seen = types(w.log);
    expect(seen).toContain('raid');
    expect(w.minds.stats.thinks).toBeGreaterThan(0);
    expect(seen).toContain('post-lost');
    expect(seen.lastIndexOf('post-held')).toBeGreaterThan(seen.indexOf('post-lost'));
  });
  test('two patrols meeting on the front with you out past the bolts: settled by farExchange, the dead counted', () => {
    const w = playOn('hoth', { owner: 'empire', side: null, war: 'gcw', control: 0.5, front: true, attack: false }, { seed: 3 });
    const front = w.turfs.find((t) => t.id === 'pad').front;
    // (90 m off the front, across it: past the bolts' 60 m, inside the brains' 120 m, where they're stepped)
    const you = { x: front.at[0] - front.dir[1] * 90, z: front.at[1] + front.dir[0] * 90 };
    w.play(1, you);
    const patrol = (side, kind, k, sign) => ({ id: `${side}:${k}`, kind, side, role: 'patrol', at: [front.at[0] + front.dir[0] * 14 * sign + k * 2, front.at[1] + front.dir[1] * 14 * sign], yaw: 0, home: front.at, beat: [front.at], turf: sign < 0 ? 'pad' : 'far', squad: `${side}-patrol` });
    w.pop.reinforce(w.pop.cellOf(...front.at), [0, 1, 2].flatMap((k) => [patrol('empire', 'stormtrooper', k, -1), patrol('rebel', 'rebel', k, 1)]));
    w.play(120, you);
    expect(w.log.far).toBeGreaterThan(0);
    expect(w.log.kills).toBeGreaterThan(0);
  });
});
