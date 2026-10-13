// What a hero's star card changes (the hero-kit lane), for the Collection's
// card rows. A card is its own `PassivePlayerAbilityAsset` with two kinds of
// modifier: a `PlayerAbilityModifierUnlockModifier` grants an unlock id a
// level, and a `PlayerAbilityPropertyOutputModifier` sets a named float a
// level. An ability then holds `PlayerAbilityPropertyModifier`s behind those
// unlock ids, each a replacement for one of its three times (the game's
// ability reloads its timer from the bound value outright: it is the new
// time, not a factor on the old one).
//
// So a card that shortens a recharge or lengthens an active time is read
// whole from the records (`op: 'set'`, the four replacement times). What a
// card changes inside an ability's prefab (a radius, a heat, a health) is a
// float the prefab's graph reads, which nothing here walks: `HAND` says, for
// the four heroes whose cards the design lists, which number of which
// ability's `effect` the card's text names, and the values are the card's own
// (its output's where the record holds them, else its four levels from the
// Collection's row, a percentage turned into a factor marked `derived:`).
//
//   KINDS                       T1 … T13, the design's thirteen kinds of card
//   cardRecord(root, name) → { name, unlocks: { level: id }, outputs: [[v1, v2, v3, v4]…] } | null
//   cardEffect(root, id, card, { name, abilities }) → { type, target, property, op, values, values_source, while? } | null
//     (id: 'hansolo.1'; card: the Collection's row, with its `levels`; name: the card's record; abilities: the hero's ability records)

import { deref, follow, rootOf, shortName } from './bf2017-ebx.mjs';
import { effectOf } from './bf2017-rulebook-effects.mjs';

export const KINDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13'];

const levelOf = (s) => Number(String(s ?? '').replace(/^PlayerAbilityLevel_/, '')) || 0;
const LEVELS = [1, 2, 3, 4];

// `how`: 'less' a percentage off (a factor 1 − p/100), 'more' a percentage on (1 + p/100), 'add' the levels as they
// are, 'rank' the ranks of the damage-taken affector the ability applies while it lasts
const HAND = {
  'hansolo.1': { type: 'T10', target: 'primary', property: 'heat.perBullet', op: 'mul', how: 'less' },
  'hansolo.4': { type: 'T7', target: 'self', property: 'damageTaken', op: 'mul', how: 'rank', while: 'Ability_HanSolo_ShoulderCharges' },
  'leia.2': { type: 'T9', target: 'Ability_Leia_BubbleShield', property: 'health', op: 'mul', how: 'more' },
  'leia.4': { type: 'T5', target: 'Ability_Leia_ThermalDetonator_Fake', property: 'radius', op: 'add', how: 'add' },
  'leia.6': { type: 'T7', target: 'self', property: 'damageTaken', op: 'mul', how: 'rank', while: 'Ability_BlasterRifle_E11_Leia' },
  'lando.1': { type: 'T3', target: 'Ability_GrenadeSmoke_Lando', property: 'hand.seconds', op: 'add', how: 'add' },
  'lando.2': { type: 'T5', target: 'Ability_GrenadeSmoke_Lando', property: 'radius', op: 'mul', how: 'more' },
  'lando.6': { type: 'T5', target: 'Ability_Lando_SharpShot', property: 'range', op: 'mul', how: 'more' },
  'lando.9': { type: 'T9', target: 'self', property: 'maxHealth', op: 'add', how: 'add' },
  'bossk.1': { type: 'T5', target: 'Ability_Bossk_GrenadeDioxis', property: 'reach', op: 'mul', how: 'more' },
  'bossk.2': { type: 'T3', target: 'Ability_Bossk_GrenadeDioxis', property: 'seconds', op: 'add', how: 'add' },
  'bossk.9': { type: 'T7', target: 'self', property: 'damageTaken', op: 'mul', how: 'rank', while: 'Ability_Bossk_PredatorInstincts' },
};

export function cardRecord(root, name) {
  const asset = follow(root, name);
  if (!asset) return null;
  const unlocks = {};
  const outputs = [];
  for (const ref of rootOf(asset).AbilityModifiers ?? []) {
    const m = deref(asset, ref);
    if (m?.$type === 'PlayerAbilityModifierUnlockModifier') for (let l = levelOf(m.MinAbilityLevel); l <= levelOf(m.MaxAbilityLevel); l++) unlocks[l] = m.UnlockId >>> 0;
    if (m?.$type !== 'PlayerAbilityPropertyOutputModifier') continue;
    const values = [];
    for (const vref of m.Values ?? []) {
      const v = deref(asset, vref);
      if (typeof v?.Value === 'number') for (let l = levelOf(v.MinAbilityLevel); l <= levelOf(v.MaxAbilityLevel); l++) values[l - 1] = v.Value;
    }
    if (LEVELS.every((l) => typeof values[l - 1] === 'number')) outputs.push(values.slice(0, 4));
  }
  return { name: asset.name, unlocks, outputs };
}

// the times an ability holds behind a card's four unlock ids: [{ ability, property, values, base, source }]
const TIMES = { RechargeTime: 'recharge', ActiveTime: 'active', ActivationTime: 'activation' };
function replacements(root, rec, abilities) {
  const out = [];
  for (const name of abilities) {
    const asset = follow(root, name);
    if (!asset) continue;
    const r = rootOf(asset);
    const byKey = {};
    for (const ref of r.AbilityModifiers ?? []) {
      const m = deref(asset, ref);
      if (m?.$type !== 'PlayerAbilityPropertyModifier') continue;
      const level = LEVELS.find((l) => rec.unlocks[l] === m.RequiredUnlockId >>> 0);
      if (!level) continue;
      for (const vref of m.Values ?? []) {
        const v = deref(asset, vref);
        for (const key of Object.keys(TIMES)) if (typeof v?.[key] === 'number') ((byKey[key] ??= { type: v.$type, values: [] }).values[level - 1] = v[key]);
      }
    }
    for (const [key, { type, values }] of Object.entries(byKey)) {
      if (!LEVELS.every((l) => typeof values[l - 1] === 'number')) continue;
      out.push({ ability: shortName(asset.name), property: TIMES[key], values, base: r[key], source: `${asset.name}#${type}.${key}` });
    }
  }
  return out;
}

const close = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

export function cardEffect(root, id, card, { name, abilities = [] } = {}) {
  const rec = name ? cardRecord(root, name) : null;
  if (!rec) return null;
  // a card that is one ability's time, replaced: sooner back (T1), or longer lasting (T3)
  const times = replacements(root, rec, abilities);
  if (times.length === 1) {
    const t = times[0];
    const better = t.property === 'recharge' ? t.values[3] < t.base : t.property === 'active' ? t.values[3] > t.base : false;
    if (better) return { type: t.property === 'recharge' ? 'T1' : 'T3', target: t.ability, property: t.property, op: 'set', values: t.values, values_source: `${t.source} (the four values behind ${rec.name}'s unlock ids)` };
  }
  const hand = HAND[id];
  if (!hand) return null;
  const { how, ...row } = hand;
  if (how === 'rank') {
    const fx = effectOf(root, hand.while);
    return fx?.takenByRank ? { ...row, values: fx.takenByRank, values_source: fx.takenByRank_source } : null;
  }
  const levels = card?.levels;
  if (!Array.isArray(levels) || levels.length !== 4 || !levels.every((v) => typeof v === 'number')) return null;
  const want = how === 'less' ? levels.map((p) => Math.round((1 - p / 100) * 1e6) / 1e6) : how === 'more' ? levels.map((p) => Math.round((1 + p / 100) * 1e6) / 1e6) : levels;
  // (the card's own record where it holds those four values; else the Collection's row, a factor made from its percentage)
  const held = rec.outputs.some((o) => close(o, want));
  const source = held ? `${rec.name}#PlayerAbilityPropertyOutputModifier.Values` : how === 'add' ? `${card._source}.StarCardData.ModifiersMetaData.0.StatParams` : `derived: ${how === 'less' ? '1 − p / 100' : '1 + p / 100'} of the card's four levels (${card._source}.StarCardData.ModifiersMetaData.0.StatParams)`;
  return { ...row, values: want, values_source: source };
}
