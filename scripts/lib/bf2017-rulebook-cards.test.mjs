// What a star card changes, read from the card's and the ability's records (fixtures cut from the export).
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cardEffect, cardRecord } from './bf2017-rulebook-cards.mjs';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'data');
const HAN = 'Gameplay/Kits/Hero/HanSolo/';
const LEIA = 'Gameplay/Kits/Hero/Leia/';
const META = 'UI/Metadata/HanAbilityUIMetaData#UIPlayerAbilityMetaData.77';

function rootWith(name, edit) {
  const dir = mkdtempSync(join(tmpdir(), 'bf2017-'));
  cpSync(ROOT, dir, { recursive: true });
  const file = join(dir, 'data', `${name}.json`);
  writeFileSync(file, JSON.stringify(edit(JSON.parse(readFileSync(file, 'utf8')))));
  return dir;
}

describe('a star card’s record', () => {
  it('holds the unlock id each level grants and its own values a level', () => {
    const r = cardRecord(ROOT, `${LEIA}StarCards/StarCard_Leia_1_ShieldLifetime`);
    expect(Object.keys(r.unlocks)).toEqual(['1', '2', '3', '4']);
    expect(r.unlocks[4]).toBe(248817666);
    expect(r.outputs).toContainEqual([10, 15, 20, 30]);
    expect(cardRecord(ROOT, `${LEIA}StarCards/Nope`)).toBe(null);
  });
});

describe('what a card changes', () => {
  it('a card behind which an ability holds four recharge times sets that time: the record’s values, not the text’s percentage', () => {
    const e = cardEffect(ROOT, 'leia.1', { levels: [10, 15, 20, 30], _source: META }, { name: `${LEIA}StarCards/StarCard_Leia_1_ShieldLifetime`, abilities: [`${LEIA}Ability_Leia_BubbleShield`] });
    expect(e).toMatchObject({ type: 'T1', target: 'Ability_Leia_BubbleShield', property: 'recharge', op: 'set', values: [18, 17, 16, 15] });
    expect(e.values_source).toMatch(/^Gameplay\/Kits\/Hero\/Leia\/Ability_Leia_BubbleShield#PlayerAbilityPropertyModifierRechargeValue\.RechargeTime /);
  });

  it('a card that makes every recharge longer for something else is not a sooner recharge: no effect', () => {
    // (Han Solo's card 9: an extra dodge, every cooldown longer; Sharpshooter's 15 s becomes 18.5 to 17)
    const e = cardEffect(ROOT, 'hansolo.9', { levels: [3.5, 3, 2.5, 2], _source: META }, { name: `${HAN}StarCards/StarCard_HanSolo_9_AGoodBlaster`, abilities: [`${HAN}Ability_HanSolo_Sharpshooterz`] });
    expect(e).toBe(null);
  });

  it('the DL-44’s heat a bullet is the card’s own four factors', () => {
    const e = cardEffect(ROOT, 'hansolo.1', { levels: [10, 14, 18, 25], _source: META }, { name: `${HAN}StarCards/StarCard_HanSolo_1_LessOverheat`, abilities: [] });
    expect(e).toEqual({ type: 'T10', target: 'primary', property: 'heat.perBullet', op: 'mul', values: [0.9, 0.86, 0.82, 0.75], values_source: `${HAN}StarCards/StarCard_HanSolo_1_LessOverheat#PlayerAbilityPropertyOutputModifier.Values` });
  });

  it('a factor made from the card’s percentage, where its record holds no such values, says it is derived', () => {
    const root = rootWith(`${HAN}StarCards/StarCard_HanSolo_1_LessOverheat`, (a) => {
      for (const o of a.objects) if (typeof o?.Value === 'number' && o.Value < 1) o.Value = 0;
      return a;
    });
    const e = cardEffect(root, 'hansolo.1', { levels: [10, 14, 18, 25], _source: META }, { name: `${HAN}StarCards/StarCard_HanSolo_1_LessOverheat`, abilities: [] });
    expect(e.values).toEqual([0.9, 0.86, 0.82, 0.75]);
    expect(e.values_source).toBe(`derived: 1 − p / 100 of the card's four levels (${META}.StarCardData.ModifiersMetaData.0.StatParams)`);
  });

  it('the damage taken while an ability lasts is the four ranks of the affector that ability applies', () => {
    const e = cardEffect(ROOT, 'hansolo.4', { levels: [25, 30, 35, 40], _source: META }, { name: `${HAN}StarCards/StarCard_HanSolo_4_ShoulderResilience`, abilities: [] });
    expect(e).toMatchObject({ type: 'T7', target: 'self', property: 'damageTaken', op: 'mul', while: 'Ability_HanSolo_ShoulderCharges', values: [0.75, 0.7, 0.65, 0.6] });
    expect(e.values_source).toContain('Affector_HanSolo_SharpshooterDMGReduction1#DamageMultiplierAffectorAsset.RankData.{0..3}.DamageMultiplier');
  });

  it('a card the table does not list, with no time behind it, has no effect', () => {
    expect(cardEffect(ROOT, 'hansolo.3', { levels: [20, 30, 40, 50], _source: META }, { name: `${HAN}StarCards/StarCard_HanSolo_4_ShoulderResilience`, abilities: [] })).toBe(null);
    expect(cardEffect(ROOT, 'hansolo.1', { levels: null, _source: META }, { name: `${HAN}StarCards/StarCard_HanSolo_1_LessOverheat`, abilities: [] })).toBe(null);
    expect(cardEffect(ROOT, 'hansolo.1', { levels: [10, 14, 18, 25] }, { name: null })).toBe(null);
  });
});
