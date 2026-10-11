import { describe, expect, it } from 'vitest';
import { DRAW, HOLD_MS, holdPose, howToDraw } from './pilotsRules';

describe('holdPose', () => {
  const live = { x: 1, y: 2, z: 3, heading: 0.5, name: 'Bravo' };
  it('takes the pose they send now, stamped with when', () => {
    expect(holdPose(null, live, 1000)).toEqual({ ...live, at: 1000 });
    expect(holdPose({ ...live, x: 9, at: 0 }, live, 1000)).toEqual({ ...live, at: 1000 });
  });
  it('holds where they last were through a gap shorter than HOLD_MS (a slow frame on their side, late packets)', () => {
    const held = holdPose(null, live, 1000);
    expect(holdPose(held, null, 1000 + HOLD_MS - 1)).toBe(held);
    expect(holdPose(held, null, 1000 + HOLD_MS)).toBe(held);
  });
  it('lets go past HOLD_MS, and at once when they have gone (hidden, down, shot down)', () => {
    const held = holdPose(null, live, 1000);
    expect(holdPose(held, null, 1000 + HOLD_MS + 1)).toBeNull();
    expect(holdPose(held, null, 1001, { gone: true })).toBeNull();
    expect(holdPose(null, null, 1001)).toBeNull();
    expect(holdPose(held, null, 1100, { hold: 50 })).toBeNull();
  });
});

// a pose where they are (`lane`: what an old client still says when it rode a hyperlane)
const pose = (x, y, z, lane = false) => ({ x, y, z, lane });

describe('howToDraw', () => {
  it('draws a pilot within DRAW of you as a ship', () => {
    expect(DRAW).toBe(3000);
    const me = { x: 0, y: 0, z: 0 };
    expect(howToDraw(pose(100, 0, 0), me)).toBe('ship');
    expect(howToDraw(pose(0, 0, DRAW - 1), me)).toBe('ship');
  });
  it('draws one beyond it as a blip on the chart alone, whatever its lane bit says (the lanes are gone)', () => {
    const me = { x: 0, y: 0, z: 0 };
    expect(howToDraw(pose(20000, 0, 20000), me)).toBe('blip');
    expect(howToDraw(pose(20000, 0, 20000, true), me)).toBe('blip');
  });
  it('treats you as far from everyone when you are not flying', () => {
    expect(howToDraw(pose(1, 0, 0), null)).toBe('blip');
    expect(howToDraw(pose(1, 0, 0, true), null)).toBe('blip');
  });
});
