import { describe, expect, it } from 'vitest';
import { seeded } from '../../seeded.js';
import { aiOf, loadRulebook } from '../rulebook.js';
import { CLOSE_HOLD, aheadOf, available, closeCombat, hideClock, hideHold, stillHiding, turnFrom } from './tactics.js';

const ai = aiOf(loadRulebook());
const rifle = ai.tactics.Rifleman_Tactics.closeCombat;
// a bot that may enter close combat: its target seen 4 m off with a line of fire, level, the bot standing
const near = (over = {}) => ({ since: null, now: 10, inCover: false, toCover: false, seen: true, lineOfFire: true, sinceSeen: 0, ahead: 4, height: 0, turn: 0, inVehicle: false, ...over });

describe('the tactics a bot has', () => {
  it('are the ones its template’s row holds settings for', () => {
    expect(['closeCombat', 'hide', 'flee'].map((k) => available(ai.tactics.Rifleman_Tactics, k))).toEqual([true, true, true]);
    // (the Skirmish rows: no hide and no close combat; the melee row no hide; the grunts no flee)
    const pve = ai.skirmish.tactics.Assault_PvE_Tactics;
    expect([available(pve, 'hide'), available(pve, 'closeCombat'), available(pve, 'flee')]).toEqual([false, false, true]);
    expect(available(ai.tactics.Melee_Tactics, 'hide')).toBe(false);
    expect(available(ai.tactics.Imperial_Grunt_Rifle_Tactics, 'flee')).toBe(false);
  });
});

describe('close combat, by the source’s test', () => {
  it('is entered with the target seen, a line of fire, inside the row’s distance and height, the bot not moving away', () => {
    expect(rifle).toMatchObject({ Distance: 6, HeightDistance: 15, DistanceLimit: 12, LostVisibilityTimeout: 2 });
    expect(closeCombat(rifle, near())).toBe(true);
    expect(closeCombat(rifle, near({ ahead: 6.5 }))).toBe(false);
    expect(closeCombat(rifle, near({ height: 16 }))).toBe(false);
    expect(closeCombat(rifle, near({ seen: false }))).toBe(false);
    expect(closeCombat(rifle, near({ lineOfFire: false }))).toBe(false);
    expect(closeCombat(rifle, near({ turn: 100 }))).toBe(false);
    expect(closeCombat(rifle, near({ inVehicle: true }))).toBe(false);
  });

  it('is never begun in cover or on the way to a cover that still serves', () => {
    expect(closeCombat(rifle, near({ inCover: true }))).toBe(false);
    expect(closeCombat(rifle, near({ toCover: true }))).toBe(false);
    expect(closeCombat(null, near())).toBe(false);
  });

  it('is held three seconds whatever happens, then kept inside the distance limit while it sees and has a line', () => {
    const held = (over) => closeCombat(rifle, near({ since: 0, ...over }));
    expect(CLOSE_HOLD).toBe(3);
    expect(held({ now: 2.9, ahead: 30, seen: false, sinceSeen: 9, lineOfFire: false })).toBe(true);
    expect(held({ now: 4, ahead: 11 })).toBe(true);
    expect(held({ now: 4, ahead: 12.5 })).toBe(false);
    expect(held({ now: 4, lineOfFire: false })).toBe(false);
    // (unseen, it stays for the row’s lost-sight timeout)
    expect(held({ now: 4, seen: false, sinceSeen: 1.5 })).toBe(true);
    expect(held({ now: 4, seen: false, sinceSeen: 2.5 })).toBe(false);
    // (five degrees more of turn than on the way in)
    expect(held({ now: 4, turn: 93 })).toBe(true);
    expect(held({ now: 4, turn: 96 })).toBe(false);
    // (in cover it ends at once)
    expect(held({ now: 1, inCover: true })).toBe(false);
  });

  it('measures to where the target will be 1.5 s on while it is seen, and to where it was when not', () => {
    expect(aheadOf([0, 1, 10], [0, 0, -4], true)).toEqual([0, 1, 4]);
    expect(aheadOf([0, 1, 10], [0, 0, -4], false)).toEqual([0, 1, 10]);
  });

  it('reads the turn from the way the bot goes, none when it stands', () => {
    expect(turnFrom([0, 0, 0], [0, 5])).toBe(0);
    expect(turnFrom([0, 0, 3], [0, 5])).toBeCloseTo(0, 6);
    expect(turnFrom([3, 0, 0], [0, 5])).toBeCloseTo(90, 6);
    expect(turnFrom([0, 0, -3], [0, 5])).toBeCloseTo(180, 6);
  });
});

describe('a hide’s time', () => {
  it('draws its hold between the row’s least and most time active', () => {
    const row = ai.tactics.Rifleman_Tactics.hide;
    const rand = seeded(3);
    for (let i = 0; i < 50; i++) {
      const h = hideHold(row, rand);
      expect(h).toBeGreaterThanOrEqual(5);
      expect(h).toBeLessThanOrEqual(10);
    }
  });

  it('lasts while its cause holds and the drawn hold after', () => {
    const row = { MinimumTimeActive: 6, MaximumTimeActive: 6 };
    const clock = {};
    hideClock(clock, { cause: true, was: false, now: 0, row, rand: () => 0.5 });
    expect(stillHiding(clock, { cause: true, was: true, now: 3 })).toBe(true);
    hideClock(clock, { cause: true, was: true, now: 3, row, rand: () => 0.5 });
    // (the cause gone at 3 s: six seconds more)
    expect(stillHiding(clock, { cause: false, was: true, now: 8.9 })).toBe(true);
    expect(stillHiding(clock, { cause: false, was: true, now: 9.1 })).toBe(false);
    // (a bot not hiding is not kept hiding by an old clock)
    expect(stillHiding(clock, { cause: false, was: false, now: 4 })).toBe(false);
  });
});
