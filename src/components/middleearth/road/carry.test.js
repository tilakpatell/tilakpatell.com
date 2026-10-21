import { describe, expect, it } from 'vitest';
import { LEAD, carryFrom } from './carry';
import { at, sOf } from './line';
import { STAGES } from './stages/index';
import { BEATS_OF } from './stages/registry';

const beat = (stage, id) => BEATS_OF[stage].find((b) => b.id === id);

describe('where Carry on picks the ride up', () => {
  it('a few metres before a moment the ride was left inside, so it plays again', () => {
    const tomb = beat('moria', 'tomb');
    const s = carryFrom(sOf(STAGES, 'moria', tomb.at + 5));
    expect(at(STAGES, s)).toMatchObject({ stage: 'moria' });
    expect(at(STAGES, s).local).toBeCloseTo(tomb.at - LEAD, 6);
    // (left right on its mark is inside it too)
    expect(at(STAGES, carryFrom(sOf(STAGES, 'moria', tomb.at))).local).toBeCloseTo(tomb.at - LEAD, 6);
  });
  it('before the whole of moments that run on into each other: the Bridge, then Fly, you fools', () => {
    const bridge = beat('moria', 'bridge');
    const fly = beat('moria', 'fly');
    // (left after the Bridge's own reach, inside its last words: both ahead again)
    expect(at(STAGES, carryFrom(sOf(STAGES, 'moria', fly.at + 3))).local).toBeLessThan(bridge.at);
  });
  it('where it was left between moments, or in a walk that takes nothing over', () => {
    const s = sOf(STAGES, 'moria', 10); // (the dark: the walk on in, the staff lit)
    expect(carryFrom(s)).toBe(s);
    expect(carryFrom(0)).toBe(0);
  });
  it('never before the stage it was left in', () => {
    for (const st of STAGES) for (const b of BEATS_OF[st.id] ?? []) expect(at(STAGES, carryFrom(sOf(STAGES, st.id, b.at + 1))).stage).toBe(st.id);
  });
});
