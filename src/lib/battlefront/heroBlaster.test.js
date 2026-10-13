// The blaster heroes on the sim: each one's own weapon, and its three
// abilities at the numbers abilities.json reads from the game's records.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { buildNav } from './nav.js';
import { field } from './fixtures/field.js';
import { addPlayer, createSim, step } from './sim.js';
import { state } from './abilities.js';
import { resolve } from './affectors.js';
import { heroAbilities, heroClass } from './hero.js';
import { BLASTER, KINDS } from './heroBlaster.js';
import { createGun, dispersionFor, fire, tick } from './weapons.js';

const rb = loadRulebook();
const nav = buildNav(field());
// (a flat stretch of the field, clear of its wall, crate and hill)
const AT = [-40, 0, -40];
const AHEAD = [AT[0], 1.4, AT[2] + 50];
const fresh = () => createSim({ rulebook: rb, nav, seed: 7 });
const hero = (sim, id, team = 1) => sim.entities.get(addPlayer(sim, { team, hero: id, at: AT }));
// a body that stands and takes it: no brain, no healing, health to spare
const dummy = (sim, at, { team = 2, hero: h = null } = {}) => {
  const s = sim.entities.get(addPlayer(sim, { team, at, yaw: Math.PI, ...(h ? { hero: h } : { classId: team === 2 ? 'd-orig-assault' : 'l-orig-assault' }) }));
  s.hp = s.hpMax = 5000;
  s.cls = { ...s.cls, regen: null };
  return s;
};
// steps of the sim with the hero's buttons: `press` a slot on the first step, `again` on a later one
const run = (sim, s, seconds, { press = 0, again = null, fire: trigger = false, aim = AHEAD } = {}) => {
  const ev = [];
  const n = Math.round(seconds / 0.05);
  for (let i = 0; i < n; i++) ev.push(...step(sim, [{ id: s.id, move: [0, 0], look: 0, aim, fire: trigger, ability: i === 0 ? press : again && i === again.step ? again.slot : 0 }]));
  return ev;
};
const taken = (s) => resolve(s.stack, 'ArmorMultiplier', 1);
const BLASTERS = ['hansolo', 'leia', 'lando', 'chewbacca', 'bobafett', 'bossk', 'iden'];

describe('a blaster hero’s kit', () => {
  it('is its own gun from the heroes’ rulebook and three abilities, each a kind this file plays', () => {
    const base = rb.classes['l-orig-assault'];
    expect(BLASTERS.map((id) => heroClass(rb, id, base).weapon)).toEqual(['hansolo', 'leia', 'x8nightsniper', 'chewbacca', 'boba', 'v10', 'iden']);
    expect(Object.keys(BLASTER).sort()).toEqual([...KINDS].sort());
    for (const id of BLASTERS) {
      const rows = heroAbilities(rb, id).slice(1);
      expect(rows.map((r) => r.slot), id).toEqual([1, 2, 3]);
      for (const r of rows) {
        expect(KINDS, `${id} ${r.id}`).toContain(r.hero.kind);
        expect(r.hero._missing, r.id).toEqual([]);
      }
    }
  });

  it('opens the DL-44’s cone on the move and closes it again once it is still', () => {
    const gun = createGun(rb.weapons.hansolo, { rand: () => 0.5 });
    let t = 0;
    for (let i = 0; i < 4; i++) {
      fire(gun, t, { stance: 'stand', moving: true });
      t += 0.35;
      tick(gun, 0.05, t - 0.3);
    }
    expect(dispersionFor(gun, 'stand', true)).toBeGreaterThan(0.03);
    for (let i = 0; i < 20; i++) tick(gun, 0.05, (t += 0.05));
    expect(gun.spread).toBe(0);
  });
});

describe('Han Solo', () => {
  it('throws a Detonite Charge that waits for the second press: 200 at its centre, nothing past 10 m', () => {
    const sim = fresh();
    const han = hero(sim, 'hansolo');
    run(sim, han, 3, { press: 1, aim: [AT[0], 0.5, AT[2] + 12] });
    const g = sim.kit.grenades.find((x) => x.owner === han.id);
    expect(g).toMatchObject({ resting: true, row: { damage: 200, inner: 5, radius: 10 } });
    expect(state(han.abilities, 1)).toBe('active');
    const on = dummy(sim, [g.at[0], 0, g.at[2]]);
    const far = dummy(sim, [g.at[0], 0, g.at[2] + 10.5]);
    const ev = run(sim, han, 0.5, { press: 1 });
    expect(ev.find((e) => e.type === 'hit' && e.target === on.id)).toMatchObject({ part: 'blast', damage: 200 });
    expect(ev.find((e) => e.type === 'hit' && e.target === far.id)).toBeUndefined();
    expect(sim.kit.grenades).toHaveLength(0);
    expect(state(han.abilities, 1)).toBe('recharge');
  });

  it('fires Sharpshooter at 350 a minute, and it ends by its heat', () => {
    const sim = fresh();
    const han = hero(sim, 'hansolo');
    run(sim, han, 0.05, { press: 2 });
    const first = run(sim, han, 1, { fire: true });
    expect(han.gun.row).toMatchObject({ id: 'W_Pistol_DL44_HanSolo_Sharpshooterz', firing: { rof: 350 } });
    // (a shot every 60 / 350 s: six in the first second)
    expect(first.filter((e) => e.type === 'shot' && e.by === han.id)).toHaveLength(6);
    const rest = run(sim, han, 3, { fire: true });
    const over = rest.find((e) => e.type === 'ability' && e.id === 'Ability_HanSolo_Sharpshooterz' && e.phase === 'end');
    expect(over).toMatchObject({ why: 'heat' });
    expect(han.gun.row.id).toBe('hansolo');
    // (0.08 a bullet and 0.04 a second to the 0.8 it overheats at: ten bullets, no more)
    expect([...first, ...rest].filter((e) => e.type === 'shot' && e.by === han.id && e.t <= over.t)).toHaveLength(10);
  });

  it('shoulder-charges a trooper for 200 and a hero for 150, taking 0.75 of the damage while he does', () => {
    for (const [target, damage] of [
      [{}, 200],
      [{ hero: 'bossk' }, 150],
    ]) {
      const sim = fresh();
      const han = hero(sim, 'hansolo');
      const t = dummy(sim, [AT[0], 0, AT[2] + 5], target);
      expect(taken(han)).toBe(1);
      const ev = [];
      let least = 1;
      for (let i = 0; i < 40; i++) {
        ev.push(...step(sim, [{ id: han.id, move: [0, 0], look: 0, aim: AHEAD, ability: i === 0 ? 3 : 0 }]));
        least = Math.min(least, taken(han));
      }
      expect(ev.find((e) => e.type === 'hit' && e.target === t.id)).toMatchObject({ damage });
      expect(least).toBe(0.75);
      expect(taken(han)).toBe(1);
    }
  });
});

describe('Leia', () => {
  it('holds the E-11 for Rapid Fire’s 13 s, then her own blaster again', () => {
    const sim = fresh();
    const leia = hero(sim, 'leia');
    run(sim, leia, 12.9, { press: 2 });
    expect(state(leia.abilities, 2)).toBe('active');
    expect(leia.gun.row).toMatchObject({ id: 'W_BlasterRifle_E11_Leia', firing: { rof: 650 } });
    run(sim, leia, 0.2);
    expect(state(leia.abilities, 2)).toBe('recharge');
    expect(leia.gun.row.id).toBe('leia');
  });

  it('sets down a Squad Shield of 3,000 health that takes the bolts from outside it', () => {
    const sim = fresh();
    const leia = hero(sim, 'leia');
    run(sim, leia, 1, { press: 3 });
    expect(leia.hero.dome).toMatchObject({ hp: 3000, radius: 4 });
    const shooter = sim.entities.get(addPlayer(sim, { team: 2, classId: 'd-orig-assault', at: [AT[0], 0, AT[2] + 15], yaw: Math.PI }));
    for (let i = 0; i < 40; i++) step(sim, [{ id: shooter.id, move: [0, 0], look: Math.PI, fire: true, aim: [AT[0], 1.2, AT[2]] }]);
    expect(leia.hp).toBe(650);
    expect(leia.hero.dome.hp).toBeLessThan(3000);
  });

  it('throws her three detonators, one a press, each 250 at its centre', () => {
    const sim = fresh();
    const leia = hero(sim, 'leia');
    const ev = [];
    for (let i = 0; i < 40; i++) ev.push(...step(sim, [{ id: leia.id, move: [0, 0], look: 0, aim: AHEAD, ability: i % 10 === 0 ? 1 : 0 }]));
    expect(ev.filter((e) => e.type === 'throw' && e.by === leia.id)).toHaveLength(3);
    expect(sim.kit.grenades[0].row).toMatchObject({ damage: 250, inner: 2.5, radius: 7 });
    expect(state(leia.abilities, 1)).toBe('recharge');
  });
});

describe('Bossk', () => {
  it('throws a Dioxis grenade whose cloud takes 15 at once, then 5 a second', () => {
    const sim = fresh();
    const bossk = hero(sim, 'bossk', 2);
    const ev = run(sim, bossk, 4, { press: 1, aim: [AT[0], 0.5, AT[2] + 10] });
    const cloud = ev.find((e) => e.type === 'explosion' && e.by === bossk.id);
    expect(cloud).toBeTruthy();
    const t = dummy(sim, [cloud.at[0], 0, cloud.at[2]], { team: 1 });
    // (the cloud bites every half second: the first bite is the 15, each after it half a second's 5)
    run(sim, bossk, 0.5);
    expect(5000 - t.hp).toBe(15);
    run(sim, bossk, 4);
    expect(5000 - t.hp).toBe(15 + 5 * 4);
  });

  it('lays three mines that arm in 3 s and go off for an enemy inside 5 m', () => {
    const sim = fresh();
    const bossk = hero(sim, 'bossk', 2);
    run(sim, bossk, 1, { press: 3 });
    expect(bossk.hero.mines).toHaveLength(3);
    const t = dummy(sim, [bossk.hero.mines[0].at[0] + 2, 0, bossk.hero.mines[0].at[2]], { team: 1 });
    expect(run(sim, bossk, 1.5).some((e) => e.type === 'hit' && e.target === t.id)).toBe(false);
    const ev = run(sim, bossk, 1.5);
    expect(ev.find((e) => e.type === 'hit' && e.target === t.id)).toMatchObject({ part: 'blast', damage: 76 });
  });
});

describe('Boba Fett, Iden and Chewbacca', () => {
  it('Boba’s barrage is ten rockets of 75', () => {
    const sim = fresh();
    const boba = hero(sim, 'bobafett', 2);
    const t = dummy(sim, [AT[0], 0, AT[2] + 20], { team: 1 });
    const ev = run(sim, boba, 5, { press: 3, aim: [AT[0], 0.2, AT[2] + 20] });
    expect(ev.filter((e) => e.type === 'throw' && e.by === boba.id && e.kind === 'barrage')).toHaveLength(10);
    const hits = ev.filter((e) => e.type === 'hit' && e.target === t.id);
    expect(hits.length).toBeGreaterThan(0);
    expect(Math.max(...hits.map((h) => h.damage))).toBeLessThanOrEqual(75);
    expect(ev.find((e) => e.type === 'explosion' && e.by === boba.id)).toMatchObject({ radius: 3 });
  });

  it('Iden’s droid shield is 250 health for its 12 s', () => {
    const sim = fresh();
    const iden = hero(sim, 'iden', 2);
    run(sim, iden, 0.1, { press: 3 });
    expect(iden.over).toMatchObject({ hp: 250, max: 250 });
    run(sim, iden, 11.8);
    expect(iden.over?.hp).toBe(250);
    run(sim, iden, 0.3);
    expect(iden.over).toBe(null);
  });

  it('Chewbacca’s slam deals 200 to a trooper and 150 to a hero', () => {
    for (const [target, damage] of [
      [{}, 200],
      [{ hero: 'bossk' }, 150],
    ]) {
      const sim = fresh();
      const chewie = hero(sim, 'chewbacca');
      const t = dummy(sim, [AT[0], 0, AT[2] + 9], target);
      const ev = run(sim, chewie, 3, { press: 3 });
      expect(ev.find((e) => e.type === 'hit' && e.target === t.id)).toMatchObject({ damage });
    }
  });

  it('the bowcaster’s bolt bursts where it lands: 25 more inside its blast', () => {
    const sim = fresh();
    const chewie = hero(sim, 'chewbacca');
    const t = dummy(sim, [AT[0], 0, AT[2] + 15]);
    const ev = run(sim, chewie, 1, { fire: true, aim: [AT[0], 1.2, AT[2] + 15] });
    const hits = ev.filter((e) => e.type === 'hit' && e.target === t.id);
    expect(hits.some((h) => h.part !== 'blast' && h.damage === 40)).toBe(true);
    expect(hits.some((h) => h.part === 'blast' && h.damage === 25)).toBe(true);
  });
});
