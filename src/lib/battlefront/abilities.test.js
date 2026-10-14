import { describe, expect, it } from 'vitest';
import { abilityOf, loadRulebook } from './rulebook.js';
import { QUEUE, ROLL, STATES, blocked, charges, createAbilities, current, end, hold, press, recharge, setChannel, state, tick } from './abilities.js';

describe('abilities', () => {
  it('gives the roll two charges a bar and refills them over the recharge', () => {
    const abs = createAbilities([ROLL]);
    expect(charges(abs, 0)).toBe(2);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(press(abs, 0, 0.01).fired).toBe(true);
    expect(press(abs, 0, 0.02)).toEqual({ fired: false, why: 'recharging' });
    tick(abs, 2, 2);
    expect(charges(abs, 0)).toBe(1);
    tick(abs, 2, 4);
    expect(charges(abs, 0)).toBe(2);
  });

  // the record's BlockedPlayerAbilityIds, by Identifier, with ApplyBlockPlayerAbilitiesDuringActivation only
  it('blocks the abilities a record names, only in the phases it says', () => {
    const rb = loadRulebook();
    const row = (id, slot) => ({ ...abilityOf(rb, id), slot });
    const abs = createAbilities([row('DefaultAbility_Assault_ThermalDetonator', 1), row('DefaultAbility_Assault_Vanguard', 2), row('DefaultAbility_Assault_ScanDart', 3)]);
    expect(press(abs, 2, 0).fired).toBe(true);
    // (the vanguard's own activation is 0: it blocks the detonator and the dart through its activation alone)
    expect(state(abs, 2)).toBe('active');
    expect(blocked(abs, 1)).toBe(false);
    expect(blocked(abs, 3)).toBe(false);
    expect(press(abs, 1, 0.1).fired).toBe(true);
    // (the detonator's pull blocks the vanguard's slot and the dart's)
    expect(state(abs, 1)).toBe('activating');
    expect(blocked(abs, 3)).toBe(true);
    tick(abs, 0.32, 0.42);
    expect(state(abs, 1)).toBe('active');
    expect(blocked(abs, 3)).toBe(false);
  });

  // the sentry's BlockPlayerAbilitiesRules: the impact grenade while it activates and while it is up, the shield only while it deploys
  it('reads a block rule’s own phases', () => {
    const rb = loadRulebook();
    const row = (id, slot) => ({ ...abilityOf(rb, id), slot });
    const abs = createAbilities([row('DefaultAbility_Heavy_ImpactGrenade', 1), { ...row('DefaultAbility_Heavy_Sentry', 2), activation: 0.9 }, row('DefaultAbility_Heavy_CombatShield', 3)]);
    press(abs, 2, 0);
    expect(state(abs, 1)).toBe('blocked');
    expect(state(abs, 3)).toBe('blocked');
    tick(abs, 0.9, 0.9);
    expect(state(abs, 2)).toBe('active');
    expect(state(abs, 1)).toBe('blocked');
    expect(state(abs, 3)).toBe('ready');
  });

  // BlockingChannels: a grenade is blocked while CurrentAbility is not 0, which the roll's state holds (17)
  it('keeps the grenades out of a roll, and one hero move out of another', () => {
    const rb = loadRulebook();
    const row = (id, slot) => ({ ...abilityOf(rb, id), slot });
    const abs = createAbilities([{ ...ROLL, slot: 0, active: 0.6 }, row('DefaultAbility_Assault_ThermalDetonator', 1)]);
    press(abs, 0, 0);
    expect(current(abs)).toBe(17);
    expect(state(abs, 1)).toBe('blocked');
    tick(abs, 0.6, 0.6);
    expect(current(abs)).toBe(0);
    expect(state(abs, 1)).toBe('ready');
    const luke = createAbilities([row('Ability_Luke_ForcePush', 1), row('Ability_Luke_ForceRepulse', 2), row('Ability_Luke_Dash', 3)]);
    expect(press(luke, 3, 0).fired).toBe(true);
    expect(current(luke)).toBe(14);
    expect(press(luke, 1, 0.1)).toEqual({ fired: false, why: 'queued' });
    tick(luke, 1.8, 1.8, { held: null });
    expect(current(luke)).toBe(0);
  });

  it('blocks every ability that waits on BlockAbilities while the soldier is disabled', () => {
    const rb = loadRulebook();
    const abs = createAbilities([{ ...abilityOf(rb, 'DefaultAbility_Heavy_CombatShield'), slot: 3 }, { ...abilityOf(rb, 'DefaultAbility_Officer_BattleCommand'), slot: 2 }]);
    setChannel(abs, 'BlockAbilities', true);
    expect(state(abs, 3)).toBe('blocked');
    // (the officer's presence lists the channel with no value: nothing blocks it)
    expect(state(abs, 2)).toBe('ready');
  });

  // RequireHoldDuringActivationTime (Luke's push): let go in the wind-up and it is called off, the charge back
  it('calls off a hold-to-charge ability let go in its activation', () => {
    const rb = loadRulebook();
    const abs = createAbilities([{ ...abilityOf(rb, 'Ability_Luke_ForcePush'), slot: 1 }]);
    press(abs, 1, 0);
    expect(tick(abs, 0.2, 0.2, { held: 1 }).map((e) => e.phase)).toEqual(['start']);
    expect(tick(abs, 0.05, 0.25, { held: 0 })).toEqual([{ type: 'ability', id: 'Ability_Luke_ForcePush', slot: 1, phase: 'end', why: 'released' }]);
    expect(state(abs, 1)).toBe('ready');
    press(abs, 1, 1);
    const ev = tick(abs, 0.5, 1.5, { held: 1 });
    expect(ev.map((e) => e.phase)).toEqual(['start', 'end']);
    expect(state(abs, 1)).toBe('recharge');
  });

  // the turret's RequireHoldDuringRetrigger 0.5 s: the second press must be held to pick it up
  it('wants the key held to retrigger a turret', () => {
    const rb = loadRulebook();
    const abs = createAbilities([{ ...abilityOf(rb, 'DefaultAbility_Officer_BlasterTurret'), slot: 3, active: Infinity }]);
    press(abs, 3, 0);
    tick(abs, 0.4, 0.4, { held: 0 });
    expect(state(abs, 3)).toBe('active');
    expect(press(abs, 3, 3).why).toBe('held');
    tick(abs, 0.2, 3.2, { held: 0 });
    expect(state(abs, 3)).toBe('active');
    expect(press(abs, 3, 4).why).toBe('held');
    tick(abs, 0.3, 4.3, { held: 3 });
    expect(state(abs, 3)).toBe('active');
    expect(tick(abs, 0.25, 4.55, { held: 3 }).map((e) => [e.phase, e.why])).toEqual([['end', 'retrigger']]);
  });

  it('queues a press during an activation and fires it on the next tick', () => {
    const slow = { id: 'slow', activation: 0.1, active: 0, recharge: 4, cost: 0.5, channels: [] };
    const abs = createAbilities([slow, { ...ROLL, slot: 1 }]);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(press(abs, 1, 0.05)).toEqual({ fired: false, why: 'queued' });
    for (let i = 1; i < QUEUE; i++) press(abs, 1, 0.05);
    expect(press(abs, 1, 0.05).why).toBe('blocked');
    const ev = tick(abs, 0.1, 0.1);
    expect(ev.filter((e) => e.id === ROLL.id && e.phase === 'start')).toHaveLength(2);
  });

  it('lets a queued press lapse after half a second', () => {
    const slow = { id: 'slow', activation: 1, active: 0, recharge: 4, cost: 1, channels: [] };
    const abs = createAbilities([slow, { ...ROLL, slot: 1 }]);
    press(abs, 0, 0);
    press(abs, 1, 0);
    const ev = tick(abs, 1, 1);
    expect(ev.some((e) => e.id === ROLL.id)).toBe(false);
  });

  // finding 33: PlayerAbilityState Disabled/Recharge/Blocked/Ready/Activating/Active, BlockedPlayerAbilityIds
  it('names the game’s six states, and a grenade in the hand blocks the slots it names through its pull', () => {
    expect(STATES).toEqual(['disabled', 'recharge', 'blocked', 'ready', 'activating', 'active']);
    const grenade = { id: 'nade', activation: 0.32, active: 0.7, recharge: 35, channels: [], blocks: ['mid'] };
    const mid = { id: 'mid', activation: 0, active: Infinity, recharge: 25, channels: [] };
    const abs = createAbilities([grenade, mid]);
    expect(state(abs, 0)).toBe('ready');
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(state(abs, 0)).toBe('activating');
    expect(state(abs, 1)).toBe('blocked');
    tick(abs, 0.32, 0.32);
    expect(state(abs, 0)).toBe('active');
    expect(press(abs, 1, 0.4)).toEqual({ fired: false, why: 'blocked' });
    tick(abs, 0.7, 1.02);
    expect(state(abs, 0)).toBe('recharge');
    expect(state(abs, 1)).toBe('ready');
    expect(state(abs, 9)).toBe('disabled');
  });

  it('holds an infinite ability active until its own event ends it, and only then recharges', () => {
    const sentry = { id: 'sentry', activation: 0.9, active: Infinity, recharge: 30, channels: [] };
    const abs = createAbilities([sentry]);
    press(abs, 0, 0);
    tick(abs, 0.9, 0.9);
    expect(state(abs, 0)).toBe('active');
    tick(abs, 19, 19.9);
    expect(state(abs, 0)).toBe('active');
    expect(charges(abs, 0)).toBe(0);
    expect(end(abs, 0, 19.9, 'heat')).toBe(true);
    expect(end(abs, 0, 19.9, 'heat')).toBe(false);
    const ev = tick(abs, 0.05, 19.95);
    expect(ev).toEqual([{ type: 'ability', id: 'sentry', slot: 0, phase: 'end', why: 'heat' }]);
    expect(state(abs, 0)).toBe('recharge');
    expect(recharge(abs, 0)).toBeCloseTo(0.05 / 30, 9);
    tick(abs, 30, 49.95);
    expect(state(abs, 0)).toBe('ready');
    expect(recharge(abs, 0)).toBe(1);
  });

  it('lowers a toggle on its second press once the retrigger cooldown has passed', () => {
    const shield = { id: 'shield', activation: 0, active: Infinity, recharge: 30, channels: [], retrigger: { cooldown: 2 } };
    const abs = createAbilities([shield]);
    expect(press(abs, 0, 0).fired).toBe(true);
    expect(tick(abs, 0.05, 0.05).map((e) => e.phase)).toEqual(['start', 'active']);
    expect(press(abs, 0, 1)).toEqual({ fired: false, why: 'blocked' });
    expect(state(abs, 0)).toBe('active');
    expect(press(abs, 0, 2)).toEqual({ fired: false, why: 'retriggered' });
    expect(tick(abs, 0.05, 2.05).map((e) => e.phase)).toEqual(['retrigger', 'end']);
    expect(state(abs, 0)).toBe('recharge');
  });

  it('keeps a held ability active past its active time until it is let go', () => {
    const grenade = { id: 'nade', activation: 0.32, active: 0.7, recharge: 35, channels: [] };
    const abs = createAbilities([grenade]);
    press(abs, 0, 0);
    tick(abs, 0.32, 0.32);
    hold(abs, 0, true);
    tick(abs, 2, 2.32);
    expect(state(abs, 0)).toBe('active');
    hold(abs, 0, false);
    expect(tick(abs, 0.05, 2.37).map((e) => e.phase)).toEqual(['end']);
    expect(state(abs, 0)).toBe('recharge');
  });
});
