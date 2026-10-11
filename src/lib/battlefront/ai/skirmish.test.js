import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, classOf, loadRulebook, weaponOf } from '../rulebook.js';
import { newSoldier } from '../soldier.js';
import { charges, tick } from '../abilities.js';
import { abilitiesFor, ABILITY_LOGIC, pollEvery, skirmishRole, pressAbility } from './skirmish.js';

const rb = loadRulebook();
const ai = aiOf(rb);

function heavy(over = {}) {
  const cls = classOf(rb, 'd-orig-heavy');
  const s = newSoldier(cls, { id: 'h', team: 2, at: [0, 0, 0], weapon: weaponOf(rb, cls.weapon), rand: seeded(1), abilities: abilitiesFor(rb, cls) });
  return { s, rand: seeded(3), role: skirmishRole(cls), skirmish: ai.skirmish, ...over };
}
const seen = (dist, visible = true) => ({ id: 'e', at: { x: 0, y: 1.2, z: dist }, visible, confidence: 1, hostile: true });

describe('the Skirmish bots’ abilities', () => {
  it('gives a class its three abilities after the roll, each with its record’s recharge', () => {
    const cls = classOf(rb, 'd-orig-heavy');
    const rows = abilitiesFor(rb, cls);
    expect(rows.map((r) => r.id)).toEqual(['Ability_Assault_CombatRoll_CharacterState', 'DefaultAbility_Heavy_ImpactGrenade', 'DefaultAbility_Heavy_Sentry', 'DefaultAbility_Heavy_CombatShield']);
    expect(rows[2].recharge).toBeGreaterThan(0);
    expect(skirmishRole(cls)).toBe('heavy');
  });

  it('polls at the ability logic’s own interval', () => {
    const [lo, hi] = pollEvery(ai.skirmish);
    expect([lo, hi]).toEqual([3, 6]);
    expect(ABILITY_LOGIC.DefaultAbility_Heavy_Sentry).toBe('Sentry');
  });

  it('a heavy fires an ability at a seen enemy in range, and not again while it recharges', () => {
    const b = heavy();
    const first = pressAbility(b, { target: seen(20), now: 10 });
    expect(first).not.toBe(null);
    expect(charges(b.s.abilities, first.slot)).toBe(0);
    // (its next poll, three to six seconds on, finds that one recharging: it fires another or nothing)
    const again = pressAbility(b, { target: seen(20), now: 10 + 6.01 });
    expect(again?.slot).not.toBe(first.slot);
    // nothing between polls
    const b2 = heavy();
    pressAbility(b2, { target: seen(20), now: 10 });
    expect(pressAbility(b2, { target: seen(20), now: 10.5 })).toBe(null);
  });

  it('holds its abilities with no enemy seen, and holds the shield until it is hurt below the logic’s half', () => {
    const b = heavy();
    expect(pressAbility(b, { target: seen(20, false), now: 10 })).toBe(null);
    const shield = heavy();
    for (const slot of [1, 2]) shield.s.abilities.list[slot].bar = 0;
    expect(pressAbility(shield, { target: seen(20), now: 10 })).toBe(null);
    shield.s.hp = shield.s.hpMax * 0.4;
    expect(pressAbility(shield, { target: seen(20), now: 20 })?.id).toBe('DefaultAbility_Heavy_CombatShield');
    tick(shield.s.abilities, 0.1, 20.1);
  });
});
