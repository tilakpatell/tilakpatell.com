import { describe, expect, it } from 'vitest';
import { PARK_GAP } from '../ship';
import { DOCK, dockState } from './dock';

const station = { id: 'E:1,0:w10003', place: 'station', at: [0, 0, 0], reach: 30 };
// a ship d out from the station's middle, along a slant (1, 4, 8) / 9, at a
// speed: 36 out is (4, 16, 32), exactly
const at = (d, speed = 0) => ({ x: d / 9, y: (4 * d) / 9, z: (8 * d) / 9, speed });

describe('docking at a station', () => {
  it('docks within reach + 4 + 2 at under a unit a second', () => {
    expect(PARK_GAP.near).toBe(4);
    expect(DOCK).toEqual({ speed: 1, in: 2, out: 30 });
    expect(dockState(at(30 + 4 + 2, 0.5), station, false)).toBe(true);
    expect(dockState(at(30 + 4 + 2, -0.5), station, false)).toBe(true);
    expect(dockState(at(30 + 4 + 2, 1.5), station, false)).toBe(false);
    expect(dockState(at(30 + 4 + 3, 0.5), station, false)).toBe(false);
  });

  it('stays docked out to reach + 4 + 30, at any speed', () => {
    expect(dockState(at(30 + 4 + 29, 0.5), station, true)).toBe(true);
    expect(dockState(at(30 + 4 + 29, 3), station, true)).toBe(true);
    expect(dockState(at(30 + 4 + 31, 0.5), station, true)).toBe(false);
  });

  it('never docks at what isn’t a station', () => {
    const planet = { ...station, id: 'E:1,0:0:0', place: 'planet' };
    for (const d of [0, 10, 36, 63, 100]) {
      expect(dockState(at(d), planet, false)).toBe(false);
      expect(dockState(at(d), planet, true)).toBe(false);
    }
    expect(dockState(at(0), null, true)).toBe(false);
  });

  it('doesn’t flicker for a docked ship drifting at the edge', () => {
    let docked = true;
    for (let i = 0; i < 100; i++) {
      const d = 30 + 4 + 29 + (Math.sin(i * 0.7) + 1) / 2; // between 29 and 30 past the park
      docked = dockState(at(d, 3 * Math.sin(i * 1.3)), station, docked);
      expect(docked, `step ${i}, ${d.toFixed(2)} off`).toBe(true);
    }
  });
});
