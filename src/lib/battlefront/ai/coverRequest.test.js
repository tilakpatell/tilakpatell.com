import { describe, expect, it } from 'vitest';
import { aiOf, loadRulebook } from '../rulebook.js';
import { asksNewCover, coverTimes, hideCoverTurned, inPreferredRange } from './coverRequest.js';

const ai = aiOf(loadRulebook());
const k = (over = {}) => ({ inCover: true, timeInCover: 5, stay: 2, inRange: true, sinceSeen: 0, lost: 2, tooClose: false, ...over });

describe('when a bot asks for a new cover, as the source has it', () => {
  it('draws its times from the row’s default block', () => {
    const t = coverTimes(ai.tactics.Heavy_Tactics.attack, () => 0);
    expect(t).toEqual({ stay: 2, lost: 1 });
    expect(coverTimes(ai.tactics.Rifleman_Tactics.attack, () => 1)).toEqual({ stay: 3, lost: 3 });
  });

  it('keeps a cover inside its weapon’s range of a target it sees, however long it has been there', () => {
    expect(asksNewCover(k({ timeInCover: 60 }))).toBe(false);
  });

  it('asks once out of range or with its target lost its time, past its time in cover, never too close or on the way', () => {
    expect(asksNewCover(k({ inRange: false }))).toBe(true);
    expect(asksNewCover(k({ sinceSeen: 2.5 }))).toBe(true);
    // (the target out of sight since before it came: counted from its arrival)
    expect(asksNewCover(k({ sinceSeen: 9, timeInCover: 1.5, stay: 1 }))).toBe(false);
    expect(asksNewCover(k({ inRange: false, timeInCover: 1 }))).toBe(false);
    expect(asksNewCover(k({ inRange: false, tooClose: true }))).toBe(false);
    expect(asksNewCover(k({ inRange: false, inCover: false }))).toBe(false);
  });

  it('measures the range from the cover to the target against the weapon’s preferred range', () => {
    const r = ai.weapons.AI_Rifle.outdoorPreferredRange;
    expect(inPreferredRange(r, [0, 0], [0, 30])).toBe(true);
    expect(inPreferredRange(r, [0, 0], [0, 45])).toBe(false);
    expect(inPreferredRange(null, [0, 0], [0, 450])).toBe(true);
  });

  it('gives a hide cover up once its target has come round past half the row’s angle', () => {
    // (the slot faces north: its solid lies north of it)
    const slot = { at: [0, 0, 0], normal: [0, -1] };
    expect(hideCoverTurned(slot, [5, 20], 180)).toBe(false);
    expect(hideCoverTurned(slot, [5, -20], 180)).toBe(true);
    expect(hideCoverTurned(slot, [20, 15], 90)).toBe(true);
  });
});
