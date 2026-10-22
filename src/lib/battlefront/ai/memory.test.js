import { describe, expect, it } from 'vitest';
import { createSenses, sense } from '../../ai/perception.js';
import { holdLastSeen } from './memory.js';

describe('what a bot keeps of an enemy out of sight', () => {
  it('holds it where it was last seen, where the senses alone would follow it and then coast', () => {
    const senses = createSenses({ sight: { range: 60, cone: -1, far: 0.1 }, memory: 10, intuition: 2.5 });
    const me = { pos: { x: 0, y: 1.6, z: 0 }, dir: { x: 0, y: 0, z: 1 }, beliefs: {} };
    const at = (z) => ({ id: 'e', at: { x: 0, y: 1.2, z }, vel: { x: 0, y: 0, z: 4 } });
    sense(senses, me, { targets: [at(10)] }, 0.1);
    holdLastSeen(me);
    expect(me.beliefs.e.visible).toBe(true);
    // (behind a wall from here on: the senses would follow it to 12 m in the next half second)
    for (let i = 0; i < 5; i++) {
      sense(senses, me, { targets: [at(10.4 + i * 0.4)] }, 0.1, { seesThrough: () => false });
      holdLastSeen(me);
    }
    expect(me.beliefs.e.at.z).toBe(10);
    expect(me.beliefs.e.vel).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('lets a sound heard since move it', () => {
    const me = { now: 3, beliefs: { e: { id: 'e', at: { x: 5, y: 0, z: 5 }, vel: { x: 0, y: 0, z: 0 }, visible: false, seenPlace: { x: 0, y: 0, z: 0 }, heardAt: 3 } } };
    holdLastSeen(me);
    expect(me.beliefs.e.at).toEqual({ x: 5, y: 0, z: 5 });
    expect(me.beliefs.e.seenPlace).toBeUndefined();
  });
});
