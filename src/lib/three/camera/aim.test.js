import { describe, expect, it } from 'vitest';
import cameras from '../../../data/bf2017/cameras.json';
import { FOV_DEFAULT, ZOOM_TIME, aimFov, zoomLevel } from './aim';

const rows = cameras.rows;

describe('aimFov', () => {
  it('starts at the default and eases to the weapon level’s field', () => {
    const s = {};
    expect(aimFov(s, rows, 0, {})).toBe(FOV_DEFAULT);
    let fov;
    for (let i = 0; i < 60; i++) fov = aimFov(s, rows, 1 / 60, { aiming: true, weaponId: 'a280c' });
    expect(fov).toBe(55);
  });

  it('a weapon with no rows aims at the default', () => {
    const s = {};
    expect(aimFov(s, rows, 1, { aiming: true, weaponId: 'nope' })).toBe(FOV_DEFAULT);
    expect(zoomLevel(rows, 'nope')).toBeNull();
    expect(zoomLevel(rows, 'a280c', 9)).toBe(rows.aim.a280c.at(-1));
  });

  it('eases with no step at either end', () => {
    const s = {};
    aimFov(s, rows, 0, {});
    const a = aimFov(s, rows, ZOOM_TIME / 100, { aiming: true, weaponId: 'a280c' });
    expect(FOV_DEFAULT - a).toBeLessThan(0.01);
  });
});
