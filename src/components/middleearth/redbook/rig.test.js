import { describe, expect, it } from 'vitest';
import { damp, poseFor } from './rig';

describe('the camera’s rig', () => {
  it('stands back in the room on arrival and leans over the book after', () => {
    const room = poseFor('room', 1.6);
    const book = poseFor('book', 1.6);
    expect(room.at[2]).toBeGreaterThan(book.at[2]);
    expect(book.look[1]).toBeLessThan(0.1);
  });

  it('frames the book upright on a phone: closer to above, wider', () => {
    const wide = poseFor('book', 1.6);
    const tall = poseFor('book', 0.46);
    expect(tall.fov).toBeGreaterThan(wide.fov);
    expect(tall.at[1] / tall.at[2]).toBeGreaterThan(wide.at[1] / wide.at[2]);
  });

  it('leans in to the stone where it stands', () => {
    const p = poseFor('stone', 1.6, { stone: [0.4, 0.13, -0.02] });
    expect(p.look).toEqual([0.4, 0.13, -0.02]);
    expect(Math.hypot(p.at[0] - 0.4, p.at[1] - 0.13, p.at[2] + 0.02)).toBeLessThan(0.4);
  });

  it('eases toward a pose without passing it, and lands under reduced motion', () => {
    const v = damp([0, 0, 0], [1, 1, 1], 0.1, 2);
    expect(v[0]).toBeGreaterThan(0);
    expect(v[0]).toBeLessThan(1);
    expect(damp([0, 0, 0], [1, 1, 1], 0.1, 2, true)).toEqual([1, 1, 1]);
  });
});
