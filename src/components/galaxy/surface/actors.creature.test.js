import { describe, expect, it } from 'vitest';
import { brain, think } from './actors';

const DT = 0.05;

describe('a placed actor on the game’s creature settings', () => {
  it('walks its path at the settings’ slow speed, and runs from you inside their range', () => {
    const spec = { kind: 'jawa', creature: 'Actor_Jawa_01', path: [[0, 0], [20, 0]] };
    const b = brain(spec, [0, 0], () => 0.5);
    expect(b.creature).toBeTruthy();
    for (let t = 0; t < 4; t += DT) think(b, spec, DT, () => 0.5, { t });
    expect(b.x).toBeGreaterThan(1);
    const before = [b.x, b.z];
    const you = { x: b.x, z: b.z + 3, y: 0 };
    for (let t = 4; t < 5; t += DT) think(b, spec, DT, () => 0.5, { t, you });
    // (away from you: south, as you came from the north)
    expect(b.z).toBeLessThan(before[1] - 0.2);
  });

  it('changes nothing for an actor without one', () => {
    const b = brain({ kind: 'bantha' }, [0, 0], () => 0.5);
    expect(b.creature).toBeUndefined();
  });
});
