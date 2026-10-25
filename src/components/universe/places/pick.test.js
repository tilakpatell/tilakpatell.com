import { describe, expect, it } from 'vitest';
import { NAME_CONE } from '../aim';
import { pickPlace, tagsFor } from './pick';

// a camera at z = 1000 looking down -z, a unit to a pixel
const project = (x, y, z, out) => Object.assign(out, { x: 640 + x, y: 360 - y, z: 1000 - z });
const view = { tanHalf: 1, height: 720 };
const R = (id, at, reach = 10) => ({ id, at, reach, place: 'thing', dist: 0 });

describe('picking a generated place', () => {
  it('takes the nearest under the point, at least 24 px round a small one, at most 160 round a big one', () => {
    const rows = [R('far', [0, 0, 0]), R('near', [5, 0, 500]), R('behind', [300, 0, 1200]), R('huge', [-400, 0, 900], 1000)];
    expect(pickPlace(rows, project, 643, 360, view)).toBe('near');
    expect(pickPlace(rows, project, 640 + 30, 360, view)).toBeNull();
    expect(pickPlace(rows, project, 940, 360, view)).toBeNull();
    expect(pickPlace(rows, project, 240 + 150, 360, view)).toBe('huge');
    expect(pickPlace(rows, project, 240 + 170, 360, view)).toBeNull();
    expect(pickPlace([], project, 640, 360, view)).toBeNull();
  });
});

describe('which places are named', () => {
  const ship = { x: 0, y: 0, z: 0 };
  const nose = [0, 0, -1];
  const rows = [
    { id: 'ahead', at: [0, 0, -1000], dist: 1000 },
    { id: 'aheadFar', at: [100, 0, -5000], dist: 5000 },
    { id: 'side', at: [3000, 0, 0], dist: 3000 },
    { id: 'behind', at: [0, 0, 4000], dist: 4000 },
    { id: 'picked', at: [20000, 0, 0], dist: 20000 },
  ];
  it('names what you picked, then where you are, then what’s on the nose, nearest first', () => {
    const cone = NAME_CONE;
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'ahead', 'aheadFar']);
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], here: 'side', max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'side', 'ahead', 'aheadFar']);
    expect(tagsFor(rows, { ship, nose, focus: ['picked'], max: 2, cone }).map((r) => r.id)).toEqual(['picked', 'ahead']);
    expect(tagsFor(rows, { ship, nose: [1, 0, 0], max: 6, cone }).map((r) => r.id)).toEqual(['side', 'picked']);
    expect(tagsFor(rows, { ship, nose, focus: [null, 'gone', 'picked', 'picked'], here: 'picked', max: 6, cone }).map((r) => r.id)).toEqual(['picked', 'ahead', 'aheadFar']);
  });
});
