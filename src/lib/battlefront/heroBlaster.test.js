// The blaster heroes on the sim: each one's own weapon, and its three
// abilities at the numbers abilities.json reads from the game's records.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { buildNav } from './nav.js';
import { field } from './fixtures/field.js';
import { addPlayer, createSim, step, view } from './sim.js';
import { press, state } from './abilities.js';
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
// steps until an event comes that `want` takes, at most ten seconds: that event
const until = (sim, s, want, opts = {}) => {
  for (let i = 0; i < 200; i++) {
    const hit = run(sim, s, 0.05, i === 0 ? opts : { aim: opts.aim }).find(want);
    if (hit) return hit;
  }
  throw new Error('the event never came');
};
const taken = (s) => resolve(s.stack, 'ArmorMultiplier', 1);
const ended = (ev, id) => ev.find((e) => e.type === 'ability' && e.id === id && e.phase === 'end');
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
  it('holds the E-11 for Rapid Fire until its heat ends it: no timed length, 20 s of its own rise with the trigger up', () => {
    const sim = fresh();
    const leia = hero(sim, 'leia');
    run(sim, leia, 19.8, { press: 2 });
    expect(state(leia.abilities, 2)).toBe('active');
    expect(leia.gun.row).toMatchObject({ id: 'W_BlasterRifle_E11_Leia', firing: { rof: 650 } });
    expect(rb.abilities.Ability_BlasterRifle_E11_Leia.effect.seconds).toBeUndefined();
    expect(run(sim, leia, 0.5).find((e) => e.type === 'ability' && e.id === 'Ability_BlasterRifle_E11_Leia' && e.phase === 'end')).toMatchObject({ why: 'heat' });
    expect(state(leia.abilities, 2)).toBe('recharge');
    expect(leia.gun.row.id).toBe('leia');
  });

  it('takes two damage-taken effects at once as their product: Rapid Fire’s 0.9 under a dodge’s 0.8', () => {
    const sim = fresh();
    const leia = hero(sim, 'leia');
    run(sim, leia, 0.5, { press: 2 });
    expect(taken(leia)).toBe(0.9);
    step(sim, [{ id: leia.id, move: [0, 1], look: 0, roll: true }]);
    expect(taken(leia)).toBeCloseTo(0.9 * 0.8, 12);
  });

  it('regenerates by her own record, 50 a second after 4.5 s, not her side’s class’s', () => {
    expect(heroClass(rb, 'leia', rb.classes['l-orig-assault']).regen).toMatchObject({ rate: 50, delay: 4.5 });
    expect(rb.heroes.leia.regen.rate_source).toBe('Gameplay/Kits/Hero/Leia/Affector_LeiaHealthRegen#SoldierHealthRegenerationAffectorAsset.RankData.0.RegenerationRate');
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
  it('throws a Dioxis grenade whose cloud takes 15 at once, then 5 a second, and stays 6 s after it bursts', () => {
    const sim = fresh();
    const bossk = hero(sim, 'bossk', 2);
    const cloud = until(sim, bossk, (e) => e.type === 'explosion' && e.by === bossk.id, { press: 1, aim: [AT[0], 0.5, AT[2] + 10] });
    const t = dummy(sim, [cloud.at[0], 0, cloud.at[2]], { team: 1 });
    // (the cloud bites every half second: the first bite is the 15, each after it half a second's 5)
    run(sim, bossk, 0.5);
    expect(5000 - t.hp).toBe(15);
    run(sim, bossk, 4);
    expect(5000 - t.hp).toBe(15 + 5 * 4);
    // (its last bite is 5.5 s after the burst: eleven bites on the one who came a step late)
    run(sim, bossk, 4);
    expect(5000 - t.hp).toBe(15 + 2.5 * 10);
    expect(sim.kit.fields).toHaveLength(0);
  });

  it('fires micro-grenades in Predator Instincts: nothing from the round itself, 80 from its burst', () => {
    const sim = fresh();
    const bossk = hero(sim, 'bossk', 2);
    const t = dummy(sim, [AT[0], 0, AT[2] + 12], { team: 1 });
    run(sim, bossk, 1.3, { press: 2 });
    expect(bossk.gun.row.id).toBe('W_Bossk_Relby_V10_Microgrenades');
    const hits = run(sim, bossk, 1, { fire: true, aim: [AT[0], 1.2, AT[2] + 12] }).filter((e) => e.type === 'hit' && e.target === t.id);
    expect(hits.find((h) => h.part !== 'blast')).toMatchObject({ damage: 0 });
    expect(hits.find((h) => h.part === 'blast')).toMatchObject({ damage: 80 });
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
    // (every rocket onto the aim point, where the body stands inside each one's full blast: no scatter for the count)
    const a = boba.abilities.list.find((x) => x.slot === 3);
    a.row = { ...a.row, hero: { ...a.row.hero, hand: { ...a.row.hero.hand, spread: 0 } } };
    const ev = run(sim, boba, 5, { press: 3, aim: [AT[0], 0, AT[2] + 20] });
    expect(ev.filter((e) => e.type === 'throw' && e.by === boba.id && e.kind === 'barrage')).toHaveLength(10);
    expect(ev.filter((e) => e.type === 'hit' && e.target === t.id).map((h) => h.damage)).toEqual(Array(10).fill(75));
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

describe('a swapped weapon, to its end', () => {
  // (the middle ability of each: the gun its overheat ends, or that a second press puts away)
  const SWAPS = [
    ['hansolo', 1, 'Ability_HanSolo_Sharpshooterz'],
    ['leia', 1, 'Ability_BlasterRifle_E11_Leia'],
    ['chewbacca', 1, 'Ability_Weapon_FuriousBowcaster'],
    ['bossk', 2, 'Ability_Bossk_PredatorInstincts'],
    ['iden', 2, 'Ability_Iden_Pulse_Cannon'],
  ];

  it.each(SWAPS)('%s: a player’s runs out with the trigger held and with it up, and no step throws', (id, team, ability) => {
    for (const trigger of [true, false]) {
      const sim = fresh();
      const h = hero(sim, id, team);
      dummy(sim, [AT[0], 0, AT[2] + 15], { team: 3 - team });
      const ev = run(sim, h, 25, { press: 2, fire: trigger, aim: [AT[0], 1.2, AT[2] + 15] });
      const heats = Boolean(rb.abilities[ability].effect.weapon.heat);
      // (a weapon with no heat, Iden's pulse cannon, stays until it is put away)
      if (heats) expect(ended(ev, ability), `${id} ${trigger}`).toMatchObject({ why: 'heat' });
      else {
        expect(state(h.abilities, 2)).toBe('active');
        expect(ended(run(sim, h, 0.2, { press: 2 }), ability)).toMatchObject({ why: 'retrigger' });
      }
      expect(h.gun.row.id).toBe(rb.heroes[id].weapon);
      expect(Number.isFinite(h.gun.heat)).toBe(true);
    }
  });

  it.each(SWAPS)('%s: a bot’s runs out too, with no step throwing', (id, team, ability) => {
    const sim = fresh();
    const bot = sim.entities.get(addPlayer(sim, { team, hero: id, at: AT, bot: true }));
    addPlayer(sim, { team: 3 - team, classId: team === 1 ? 'd-orig-assault' : 'l-orig-assault', at: [AT[0], 0, AT[2] + 20], yaw: Math.PI, bot: true });
    expect(press(bot.abilities, 2, sim.time).fired).toBe(true);
    const ev = [];
    for (let i = 0; i < 600 && bot.alive; i++) ev.push(...step(sim));
    if (bot.alive) expect(ended(ev, ability), id).toBeTruthy();
  });

  it('Sharpshooter with the trigger up ends by its own heat after 20 s: 0.04 a second to the 0.8 it overheats at', () => {
    const sim = fresh();
    const han = hero(sim, 'hansolo');
    run(sim, han, 19.8, { press: 2 });
    expect(state(han.abilities, 2)).toBe('active');
    expect(han.gun.heat).toBeCloseTo(0.04 * 19.75, 2);
    expect(ended(run(sim, han, 0.5), 'Ability_HanSolo_Sharpshooterz')).toMatchObject({ why: 'heat' });
  });
});

describe('what blocks what, by the records', () => {
  it('Lando throws the Disabler, and three seconds on the smoke: the Disabler blocks the others through its activation alone', () => {
    const sim = fresh();
    const lando = hero(sim, 'lando');
    run(sim, lando, 0.05, { press: 3 });
    expect([1, 2].map((slot) => state(lando.abilities, slot))).toEqual(['blocked', 'blocked']);
    run(sim, lando, 3);
    expect([1, 2, 3].map((slot) => state(lando.abilities, slot))).toEqual(['ready', 'ready', 'active']);
    const ev = run(sim, lando, 1, { press: 1 });
    expect(ev.some((e) => e.type === 'throw' && e.by === lando.id && e.kind === 'smoke')).toBe(true);
    expect(state(lando.abilities, 3)).toBe('active');
  });

  it('Sharp Shot blocks the Disabler and the smoke while it is active; Leia’s detonators in the hand block no one', () => {
    const sim = fresh();
    const lando = hero(sim, 'lando');
    run(sim, lando, 0.5, { press: 2 });
    expect([1, 2, 3].map((slot) => state(lando.abilities, slot))).toEqual(['blocked', 'active', 'blocked']);
    const other = fresh();
    const leia = hero(other, 'leia');
    run(other, leia, 0.5, { press: 1 });
    expect([1, 2, 3].map((slot) => state(leia.abilities, slot))).toEqual(['active', 'ready', 'ready']);
    for (const id of BLASTERS) for (const r of heroAbilities(rb, id)) expect(r.channels, r.id).toEqual([]);
  });

  it('the dodge pressed while an ability is activating rolls nothing and spends nothing', () => {
    const sim = fresh();
    const han = hero(sim, 'hansolo');
    let rolled = false;
    for (let i = 0; i < 20; i++) {
      step(sim, [{ id: han.id, move: [0, 1], look: 0, aim: AHEAD, ability: i === 0 ? 3 : 0, roll: i === 3 }]);
      rolled ||= han.state === 'roll';
    }
    expect(rolled).toBe(false);
    expect(han.abilities.list.find((a) => a.slot === 0).bar).toBe(1);
  });
});

describe('a round that bursts, under the rules its bolt obeys', () => {
  it('a bot Chewbacca on a human 12 m off: a blast only with a bolt that landed, and at the bot’s half', () => {
    const sim = fresh();
    addPlayer(sim, { team: 1, hero: 'chewbacca', at: AT, bot: true });
    const human = dummy(sim, [AT[0], 0, AT[2] + 12]);
    const ev = [];
    for (let i = 0; i < 400; i++) ev.push(...step(sim, [{ id: human.id, move: [0, 0], look: Math.PI }]));
    const hits = ev.filter((e) => e.type === 'hit' && e.target === human.id);
    const bolts = hits.filter((h) => h.part !== 'blast');
    const blasts = hits.filter((h) => h.part === 'blast');
    expect(bolts.length).toBeGreaterThan(0);
    expect(blasts.length).toBeGreaterThan(0);
    // (25 in a player's hand: 12.5 from the AI's bolt, and none where the buckets held the bolt itself to nothing)
    for (const b of blasts) expect(b.damage).toBeLessThanOrEqual(12.5);
    expect(blasts.length).toBeLessThanOrEqual(bolts.filter((h) => h.damage > 0).length);
  });

  it('a bolt a saber’s block turns bursts nothing', () => {
    const sim = fresh();
    const chewie = hero(sim, 'chewbacca');
    const luke = sim.entities.get(addPlayer(sim, { team: 2, hero: 'luke', at: [AT[0], 0, AT[2] + 12], yaw: Math.PI }));
    const ev = [];
    for (let i = 0; i < 60; i++)
      ev.push(
        ...step(sim, [
          { id: chewie.id, move: [0, 0], look: 0, fire: true, aim: [AT[0], 1.2, AT[2] + 12] },
          { id: luke.id, move: [0, 0], look: Math.PI, aiming: true },
        ]),
      );
    expect(ev.filter((e) => e.type === 'deflect' && e.by === luke.id).length).toBeGreaterThan(0);
    expect(ev.filter((e) => e.type === 'hit' && e.target === luke.id)).toEqual([]);
    expect(luke.hp).toBe(750);
  });
});

describe('Lando', () => {
  it('his smoke stands 7 s from where it first lands and hides whoever is within 6 m of it, of either side', () => {
    const sim = fresh();
    const lando = hero(sim, 'lando');
    const smoke = until(sim, lando, (e) => e.type === 'explosion' && e.by === lando.id && e.kind === 'smoke', { press: 1, aim: [AT[0], 0.5, AT[2] + 10] });
    const inside = dummy(sim, [smoke.at[0] + 5, 0, smoke.at[2]]);
    const friend = dummy(sim, [smoke.at[0] - 5, 0, smoke.at[2]], { team: 1 });
    const outside = dummy(sim, [smoke.at[0] + 7, 0, smoke.at[2]]);
    const smoked = (s) => view(sim).entities.find((e) => e.id === s.id).smoked;
    run(sim, lando, 1);
    expect([inside, friend, outside].map(smoked)).toEqual([true, true, false]);
    expect([inside.hp, friend.hp]).toEqual([5000, 5000]);
    run(sim, lando, 5.4);
    expect(smoked(inside)).toBe(true);
    run(sim, lando, 1.6);
    expect([inside, friend, outside].map(smoked)).toEqual([false, false, false]);
  });

  it('marks those in view with Sharp Shot and, on the second press, sends one shot of 200 at each, 0.15 s apart', () => {
    const sim = fresh();
    const lando = hero(sim, 'lando');
    const marks = [-4, 0, 4].map((x) => dummy(sim, [AT[0] + x, 0, AT[2] + 20]));
    const behind = dummy(sim, [AT[0], 0, AT[2] - 20]);
    // (not before the retrigger cooldown's second: the press half a second in does nothing)
    const early = run(sim, lando, 2, { press: 2, again: { step: 10, slot: 2 } });
    expect(early.filter((e) => e.type === 'hit')).toEqual([]);
    expect(state(lando.abilities, 2)).toBe('active');
    expect(marks.every((m) => m.markedUntil > sim.time)).toBe(true);
    const ev = run(sim, lando, 1.5, { press: 2 });
    const hits = ev.filter((e) => e.type === 'hit' && e.by === lando.id);
    expect(hits.map((h) => h.damage)).toEqual([200, 200, 200]);
    expect(new Set(hits.map((h) => h.target))).toEqual(new Set(marks.map((m) => m.id)));
    expect(hits.slice(1).map((h, i) => Math.round((h.t - hits[i].t) * 100) / 100)).toEqual([0.15, 0.15]);
    expect(behind.hp).toBe(5000);
    expect(state(lando.abilities, 2)).toBe('recharge');
  });

  it('lets the flurry go when Sharp Shot’s 7 s run out, at those still in view', () => {
    const sim = fresh();
    const lando = hero(sim, 'lando');
    const mark = dummy(sim, [AT[0], 0, AT[2] + 20]);
    const ev = run(sim, lando, 7.5, { press: 2 });
    expect(ev.filter((e) => e.type === 'hit' && e.target === mark.id).map((h) => [h.damage, h.t > 7])).toEqual([[200, true]]);
  });

  it('his Disabler shocks those near it when its time runs out, as when it is set off', () => {
    const sim = fresh();
    const lando = hero(sim, 'lando');
    run(sim, lando, 3, { press: 3, aim: [AT[0], 0.5, AT[2] + 8] });
    const g = sim.kit.grenades.find((x) => x.owner === lando.id);
    expect(g).toMatchObject({ resting: true, row: { id: 'disabler' } });
    const near = dummy(sim, [g.at[0] + 3, 0, g.at[2]]);
    const ev = run(sim, lando, 23);
    expect(ev.find((e) => e.type === 'explosion' && e.kind === 'disabler')).toBeTruthy();
    expect(near.stunnedUntil - sim.time).toBeGreaterThan(0);
    expect(sim.kit.grenades).toHaveLength(0);
  });
});

describe('Chewbacca’s Shock Grenade and Iden’s droid', () => {
  it('splits into six where it lands; each shocks 0.75 s within 3 m, no one again for 3.5 s; ready 16.4 s after the press', () => {
    const sim = fresh();
    const chewie = hero(sim, 'chewbacca');
    const split = until(sim, chewie, (e) => e.type === 'split' && e.by === chewie.id, { press: 1, aim: [AT[0], 0.5, AT[2] + 10] });
    const t = dummy(sim, [split.at[0], 0, split.at[2]]);
    const far = dummy(sim, [split.at[0] + 8, 0, split.at[2]]);
    const bursts = [];
    let shockedAt = null;
    let longest = 0;
    for (let i = 0; i < 40; i++) {
      bursts.push(...run(sim, chewie, 0.05).filter((e) => e.type === 'explosion' && e.kind === 'shockSub'));
      if (shockedAt === null && t.stunnedUntil > sim.time) shockedAt = sim.time;
      longest = Math.max(longest, (t.stunnedUntil ?? 0) - (shockedAt ?? Infinity));
    }
    expect(bursts).toHaveLength(6);
    // (shocked once, for the 0.75 s: the five other bursts find it immune)
    expect(longest).toBeCloseTo(0.75, 9);
    expect(t.stunImmuneUntil - shockedAt).toBeCloseTo(3.5, 9);
    expect(far.stunnedUntil).toBeUndefined();
    expect([t.hp, far.hp]).toEqual([5000, 5000]);
    // (0.4 s of activation, its own second of Active, 15 s of recharge)
    const at = (seconds) => run(sim, chewie, seconds - sim.time);
    at(16.4);
    expect(state(chewie.abilities, 1)).toBe('recharge');
    at(16.5);
    expect(state(chewie.abilities, 1)).toBe('ready');
  });

  it('Iden’s droid finds its mark at the press: the record’s 10 s of activation is by hand none', () => {
    expect(rb.abilities.Ability_Iden_Droid_Stun).toMatchObject({ activation: 10, effect: { hand: { source: 'hand', activation: 0 } } });
    expect(heroAbilities(rb, 'iden').find((r) => r.id === 'Ability_Iden_Droid_Stun').activation).toBe(0);
  });
});
