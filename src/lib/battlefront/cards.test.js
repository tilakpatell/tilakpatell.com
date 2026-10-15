// A star card as modifiers: the Collection's card rows (their `effect`, read
// from the game's records) at the top rank, and which of a store's picks a
// unit carries.
import { describe, expect, it } from 'vitest';
import BOOK from '../../data/bf2017/collection.json';
import { loadRulebook } from './rulebook.js';
import { CARD_SLOTS, MODELLED, cardsFor, modifiersOf } from './cards.js';

const rb = loadRulebook();
const card = (id) => ({ id, ...BOOK.cards[id] });

describe('a card’s modifiers, at the top rank', () => {
  it('Han Solo’s card 1 multiplies the DL-44’s heat a bullet by 0.75', () => {
    expect(modifiersOf(card('hansolo.1'))).toEqual([{ on: 'primary', property: 'heat.perBullet', op: 'mul', value: 0.75 }]);
    expect(modifiersOf(card('hansolo.1'), 0)).toEqual([{ on: 'primary', property: 'heat.perBullet', op: 'mul', value: 0.9 }]);
  });

  it('a card that is one of an ability’s times sets it, as the game reloads its timer: the record’s own replacement', () => {
    // (Squad Shield's 20 s: the record holds 18, 17, 16 and 15 behind the card's four unlocks; its text's 30 % would be 14)
    expect(modifiersOf(card('leia.1'))).toEqual([{ on: 'Ability_Leia_BubbleShield', property: 'recharge', op: 'set', value: 15 }]);
    // (1.5 s off the detonators' 13)
    expect(modifiersOf(card('leia.5'))).toEqual([{ on: 'Ability_Leia_ThermalDetonator_Fake', property: 'recharge', op: 'set', value: 11.5 }]);
    // (15 s on the Disabler's 25)
    expect(modifiersOf(card('lando.3'))).toEqual([{ on: 'Ability_Lando_Disruptor', property: 'active', op: 'set', value: 40 }]);
    expect(rb.abilities.Ability_Leia_BubbleShield.recharge).toBe(20);
    expect(rb.abilities.Ability_Leia_ThermalDetonator_Fake.recharge).toBe(13);
    expect(rb.abilities.Ability_Lando_Disruptor.active).toBe(25);
    // (every card that sets a time names the ability's own record for its four values)
    for (const c of Object.values(BOOK.cards)) if (c.effect?.op === 'set') expect(c.effect.values_source, c.ability).toMatch(/#PlayerAbilityPropertyModifier(Recharge|Active)Value\.(RechargeTime|ActiveTime) /);
  });

  it('Lando’s card 9 adds 150 to his health, Leia’s card 4 a metre to her detonators’ blast', () => {
    expect(modifiersOf(card('lando.9'))).toEqual([{ on: 'self', property: 'maxHealth', op: 'add', value: 150 }]);
    expect(modifiersOf(card('leia.4'))).toEqual([{ on: 'Ability_Leia_ThermalDetonator_Fake', property: 'radius', op: 'add', value: 1 }]);
  });

  it('Han Solo’s card 4 multiplies the damage he takes by 0.6 while Shoulder Charge is active', () => {
    expect(modifiersOf(card('hansolo.4'))).toEqual([{ on: 'self', property: 'damageTaken', op: 'mul', value: 0.6, while: 'Ability_HanSolo_ShoulderCharges' }]);
    // (the fourth rank of the affector the ability applies: the ability's own row holds the four)
    expect(rb.abilities.Ability_HanSolo_ShoulderCharges.effect.takenByRank).toEqual(BOOK.cards['hansolo.4'].effect.values);
  });

  it('gives nothing for a card whose kind is not modelled, or that has no effect read', () => {
    expect(BOOK.cards['hansolo.3'].effect).toBeUndefined();
    expect(modifiersOf(card('hansolo.3'))).toEqual([]);
    expect(modifiersOf({ id: 'x', effect: { type: 'T2', target: 'self', property: 'maxHealth', op: 'add', values: [1, 2, 3, 4] } })).toEqual([]);
    expect(modifiersOf({ id: 'x', effect: { type: 'T9', target: 'self', property: 'maxHealth', op: 'add' } })).toEqual([]);
    expect(modifiersOf(null)).toEqual([]);
    expect(MODELLED).toEqual(['T1', 'T3', 'T5', 'T6', 'T7', 'T9', 'T10']);
    // (every effect the book holds is of a kind this file models, and names four values and where they are from)
    for (const [id, c] of Object.entries(BOOK.cards)) {
      if (!c.effect) continue;
      expect(MODELLED, id).toContain(c.effect.type);
      expect(c.effect.values, id).toHaveLength(4);
      expect(c.effect.values_source, id).toMatch(/^(derived: \S|[^#\s]+#\S)/);
    }
  });
});

describe('the cards a unit carries', () => {
  it('are its own of the store’s picks, in the store’s order, three at most', () => {
    expect(CARD_SLOTS).toBe(3);
    expect(cardsFor('hansolo', ['hansolo.4', 'hansolo.1']).map((c) => c.id)).toEqual(['hansolo.4', 'hansolo.1']);
    expect(cardsFor('hansolo', ['hansolo.9', 'hansolo.4', 'hansolo.1', 'hansolo.2']).map((c) => c.id)).toEqual(['hansolo.9', 'hansolo.4', 'hansolo.1']);
    expect(cardsFor('hansolo', ['hansolo.1'])[0]).toMatchObject({ id: 'hansolo.1', effect: { type: 'T10' } });
  });

  it('leave out a card of another hero’s, one that is not there, and a pick twice; nothing throws on a store that is not a list', () => {
    expect(cardsFor('hansolo', ['leia.1', 'hansolo.99', 'hansolo.1', 'hansolo.1', null, 7]).map((c) => c.id)).toEqual(['hansolo.1']);
    for (const junk of [null, undefined, 'hansolo.1', {}, 3]) expect(cardsFor('hansolo', junk)).toEqual([]);
    expect(cardsFor('nobody', ['hansolo.1'])).toEqual([]);
    expect(cardsFor('l-orig-assault', ['hansolo.1'])).toEqual([]);
  });
});
