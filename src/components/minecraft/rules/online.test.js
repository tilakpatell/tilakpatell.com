import { describe, expect, it } from 'vitest';
import { ABOVE, areaOf, stepOf } from './online';

const flat = () => 70; // (a world whose surface is at 70 everywhere)

describe('where you are, to the others online in the same world', () => {
  it('names the world by its seed, short enough for the room link', () => {
    expect(areaOf(123456789)).toMatch(/^[a-z0-9-]{1,24}$/);
    expect(areaOf(123456789)).not.toBe(areaOf(987654321));
  });

  it('sends your height over the world’s own ground, which every visitor to the seed has alike', () => {
    const [h, flags] = stepOf({ x: 10.5, y: 71, z: -3.25, yaw: 0, vx: 0, vz: 0 }, flat, 42);
    expect(h).toMatchObject({ x: 10.5, z: -3.25 });
    expect(h.y).toBeCloseTo(0, 6);
    expect(flags).toEqual({ area: areaOf(42) });
    // up a tower, or mid-jump
    expect(stepOf({ x: 0, y: 75.5, z: 0, yaw: 0, vx: 0, vz: 0 }, flat, 42)[0].y).toBeCloseTo(4.5, 6);
    // down a cave: on the ground over it, never below naught
    expect(stepOf({ x: 0, y: 30, z: 0, yaw: 0, vx: 0, vz: 0 }, flat, 42)[0].y).toBe(0);
    expect(ABOVE(flat, 3, 4)).toBe(71);
  });

  it('turns the game’s yaw (naught looking north, −z, turning left as it grows) to a figure’s face, kept small', () => {
    const face = (yaw) => stepOf({ x: 0, y: 71, z: 0, yaw, vx: 0, vz: 0 }, flat, 1)[0].face;
    // a figure turned by `face` looks along (sin face, cos face)
    const along = (f) => [Math.sin(f), Math.cos(f)];
    expect(along(face(0))[0]).toBeCloseTo(0, 6);
    expect(along(face(0))[1]).toBeCloseTo(-1, 6);
    // a quarter turn left from north is west, −x
    expect(along(face(Math.PI / 2))[0]).toBeCloseTo(-1, 6);
    expect(Math.abs(face(40))).toBeLessThanOrEqual(Math.PI);
  });

  it('says how fast you go, in metres a second, from a tick’s blocks', () => {
    expect(stepOf({ x: 0, y: 71, z: 0, yaw: 0, vx: 0.15, vz: 0.2 }, flat, 1)[0].speed).toBeCloseTo(5, 6);
  });
});
