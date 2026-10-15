// Star cards at the deploy: the Collection's picks carried into the sim, each card's modifiers on the hero once.
import { describe, expect, it } from 'vitest';
import { loadRulebook } from './rulebook.js';
import { hothFlatNav } from './fixtures/hothFlat.js';
import { addPlayer, createSim, deploy, removeEntity, step } from './sim.js';
import { earn } from './battlePoints.js';
import { resolve } from './affectors.js';
import { equip } from './cards.js';
import { fire } from './weapons.js';

const rb = loadRulebook();
const nav = hothFlatNav(rb);
const make = (bots = { 1: 0, 2: 0 }) => createSim({ rulebook: rb, nav, seed: 3, bots, mode: 'galacticAssault' });
// a player on the deploy screen with a hero's price in hand
function waiting(sim, team = 1) {
  const id = addPlayer(sim, { team, classId: team === 1 ? 'l-orig-assault' : 'd-orig-assault', at: [0, 0, -1300] });
  again(sim, id, team);
  return id;
}
function again(sim, id, team = 1, bot = false) {
  removeEntity(sim, id);
  sim.deploying.set(id, { id, team, bot, since: sim.time });
  earn(sim.bp, id, 'kill', 40);
}
const as = (sim, id, hero, cards) => {
  expect(deploy(sim, id, { kind: 'hero', id: hero, cards })).toEqual({ ok: true });
  return sim.entities.get(id);
};
// shots, one after another with no cooling between, until the gun overheats
function shotsToOverheat(gun) {
  let n = 0;
  for (let t = 0; gun.state === 'ready' && n < 50; t += 1) n += fire(gun, t) ? 1 : 0;
  return n;
}
const ability = (s, id) => s.abilities.list.find((a) => a.row.id === id).row;

describe('a hero deployed with its star cards', () => {
  it('Han Solo with card 1 heats his DL-44 0.75 as much a shot, and overheats after more shots', () => {
    const plain = make();
    const a = as(plain, waiting(plain), 'hansolo', []);
    const carded = make();
    const b = as(carded, waiting(carded), 'hansolo', ['hansolo.1']);
    expect(a.gun.row.heat.perBullet).toBe(0.13);
    expect(b.gun.row.heat.perBullet).toBeCloseTo(0.13 * 0.75, 12);
    expect(b.cards.list).toEqual([{ id: 'hansolo.1', name: '#7182FC16' }]);
    // (0.13 a shot to the 0.8 it overheats at is 7 shots; 0.0975 is 9)
    expect([shotsToOverheat(a.gun), shotsToOverheat(b.gun)]).toEqual([7, 9]);
    // (the rulebook's own row is no one's to change)
    expect(rb.weapons.hansolo.heat.perBullet).toBe(0.13);
  });

  it('has each modifier once when he is deployed again: nothing is carried from the life before', () => {
    const sim = make();
    const id = waiting(sim);
    const first = as(sim, id, 'hansolo', ['hansolo.1']);
    expect(first.stack.entries.filter((e) => e.id.startsWith('card:'))).toHaveLength(1);
    again(sim, id);
    const second = as(sim, id, 'hansolo', ['hansolo.1']);
    expect(second).not.toBe(first);
    expect(second.stack.entries.filter((e) => e.id.startsWith('card:'))).toHaveLength(1);
    expect(second.gun.row.heat.perBullet).toBeCloseTo(0.13 * 0.75, 12);
    again(sim, id);
    expect(as(sim, id, 'hansolo', []).gun.row.heat.perBullet).toBe(0.13);
  });

  it('a bot’s hero carries none, whatever its deploy is handed', () => {
    const sim = make({ 1: 1, 2: 0 });
    const bot = [...sim.entities.values()].find((e) => e.bot && e.kind === 'soldier').id;
    again(sim, bot, 1, true);
    const s = as(sim, bot, 'hansolo', ['hansolo.1']);
    expect(s.bot).toBe(true);
    expect(s.cards).toBeUndefined();
    expect(s.gun.row.heat.perBullet).toBe(0.13);
    expect(sim.entities.get(addPlayer(sim, { team: 1, hero: 'hansolo', at: [0, 0, -1300], bot: true })).cards).toBeUndefined();
  });

  it('wears three at most, in the store’s order, and leaves out what is not its own', () => {
    const sim = make();
    const four = as(sim, waiting(sim), 'hansolo', ['hansolo.4', 'hansolo.2', 'hansolo.1', 'hansolo.3']);
    expect(four.cards.list.map((c) => c.id)).toEqual(['hansolo.4', 'hansolo.2', 'hansolo.1']);
    const other = make();
    const stale = as(other, waiting(other), 'hansolo', ['leia.1', 'hansolo.99', null, 'hansolo.1']);
    expect(stale.cards.list.map((c) => c.id)).toEqual(['hansolo.1']);
    const none = make();
    for (const junk of [undefined, null, 'hansolo.1', {}]) {
      const id = waiting(none);
      expect(as(none, id, 'hansolo', junk).cards.list).toEqual([]);
      removeEntity(none, id);
    }
  });

  it('a card on an ability the hero does not have, or a number its ability has not, changes nothing and throws nothing', () => {
    const sim = make();
    const s = as(sim, waiting(sim), 'hansolo', []);
    const before = JSON.stringify(s.abilities.list.map((a) => a.row));
    equip(s, [
      { id: 'x.1', name: 'x', effect: { type: 'T1', target: 'Ability_Leia_BubbleShield', property: 'recharge', op: 'set', values: [1, 1, 1, 1] } },
      { id: 'x.2', name: 'x', effect: { type: 'T5', target: 'Ability_HanSolo_ShoulderCharges', property: 'nothing.here', op: 'mul', values: [2, 2, 2, 2] } },
      { id: 'x.3', name: 'x', effect: { type: 'T7', target: 'self', property: 'damageTaken', op: 'mul', while: 'Ability_Nope', values: [0, 0, 0, 0] } },
    ]);
    expect(JSON.stringify(s.abilities.list.map((a) => a.row))).toBe(before);
    expect(s.cards.taken).toEqual({});
  });
});

describe('what the cards change', () => {
  it('Leia: Squad Shield back in 15 s, the detonators in 11.5 s and their blast a metre wider', () => {
    const sim = make();
    const leia = as(sim, waiting(sim), 'leia', ['leia.1', 'leia.5', 'leia.4']);
    expect(ability(leia, 'Ability_Leia_BubbleShield').recharge).toBe(15);
    expect(ability(leia, 'Ability_Leia_ThermalDetonator_Fake').recharge).toBe(11.5);
    expect(ability(leia, 'Ability_Leia_ThermalDetonator_Fake').hero.radius).toBe(8);
    const ev = [];
    for (let i = 0; i < 4; i++) ev.push(...step(sim, [{ id: leia.id, move: [0, 0], look: 0, ability: i === 0 ? 1 : 0 }]));
    expect(sim.kit.grenades[0].row).toMatchObject({ damage: 250, radius: 8 });
    expect(rb.abilities.Ability_Leia_BubbleShield.recharge).toBe(20);
    expect(rb.abilities.Ability_Leia_ThermalDetonator_Fake.effect.radius).toBe(7);
  });

  it('Lando: 150 more health, and the Disabler out for 40 s', () => {
    const sim = make();
    const lando = as(sim, waiting(sim), 'lando', ['lando.9', 'lando.3']);
    expect([lando.hp, lando.hpMax]).toEqual([800, 800]);
    expect(ability(lando, 'Ability_Lando_Disruptor').active).toBe(40);
  });

  it('Han Solo with card 4 takes 0.6 of the damage while he charges: the card’s rank in the ability’s place, not on top of it', () => {
    const sim = make();
    const han = as(sim, waiting(sim), 'hansolo', ['hansolo.4']);
    expect(han.cards.taken).toEqual({ Ability_HanSolo_ShoulderCharges: 0.6 });
    let least = 1;
    for (let i = 0; i < 30; i++) {
      step(sim, [{ id: han.id, move: [0, 0], look: 0, ability: i === 0 ? 3 : 0 }]);
      least = Math.min(least, resolve(han.stack, 'ArmorMultiplier', 1));
    }
    expect(least).toBe(0.6);
    expect(resolve(han.stack, 'ArmorMultiplier', 1)).toBe(1);
  });
});
