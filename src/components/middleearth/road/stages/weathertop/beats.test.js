import { describe, expect, it } from 'vitest';
import { BEATS } from './beats';
import { sweepBeats } from '../fixtures/beats';

describe('Weathertop’s beats', () => {
  sweepBeats('weathertop', BEATS);

  it('the brief’s moments: the dell’s fire, five on the skyline, twelve seconds under the Ring, the fire, the kingsfoil', () => {
    const by = Object.fromEntries(BEATS.map((b) => [b.id, b]));
    expect(BEATS.map((b) => b.id)).toEqual(['lonelands', 'dell', 'summit', 'ring', 'fire', 'kingsfoil']);
    expect(by.dell).toMatchObject({ rig: 'seat', hold: 8 });
    expect(by.summit).toMatchObject({ rig: 'crane', hold: 6 });
    expect(by.ring).toMatchObject({ rig: 'seat', hold: 14, cut: 0, clip: 'nazgul' });
    expect(by.ring.fx).toContainEqual(expect.objectContaining({ kind: 'vision', seconds: 12 }));
    // (the vision is over before the hold is: the Ring comes off while you still watch)
    const v = by.ring.fx.find((f) => f.kind === 'vision');
    expect(v.at + v.seconds).toBeLessThanOrEqual(by.ring.hold);
    expect(by.kingsfoil).toMatchObject({ rig: 'seat', hold: 10 });
    expect(by.kingsfoil.params.at[1]).toBeLessThan(1.5);
    expect(by.kingsfoil.lines).toEqual(['weathertop-kingsfoil']);
  });
});
