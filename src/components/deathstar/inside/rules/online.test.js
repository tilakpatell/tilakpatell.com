import { describe, expect, it } from 'vitest';
import { areaOf, createStepper, floorOf } from './online';

describe('where you are, to the others online aboard', () => {
  it('names the room you are in on the station you are on', () => {
    expect(areaOf('ds1', 'bay327')).toBe('ds1-bay327');
    expect(areaOf('ds2', 'towerlift-top')).toBe('ds2-towerlift-top');
  });

  it('keeps a room’s name to what the room link reads (short, letters, digits and dashes)', () => {
    const a = areaOf('ds2', 'a_very_long_room_name_indeed_and_more');
    expect(a).toMatch(/^[a-z0-9-]{1,24}$/);
    expect(areaOf('ds1', null)).toBe('ds1');
  });

  it('sends where you stand and which way you face, as a figure turned to face −z draws it', () => {
    const step = createStepper();
    const [h, flags] = step({ x: 3, y: 12, z: -20, yaw: 0.5, room: 'hold' }, 'ds1', 1 / 30);
    expect(h).toMatchObject({ x: 3, z: -20, face: -0.5, speed: 0 });
    expect(flags).toEqual({ area: 'ds1-hold' });
  });

  it('wraps a face turned round and round, which the link would otherwise clip', () => {
    const [h] = createStepper()({ x: 0, y: 0, z: 0, yaw: 4 * Math.PI + 0.25, room: 'hold' }, 'ds1', 0.1);
    expect(h.face).toBeCloseTo(-0.25, 6);
  });

  it('sends your height over the room’s lowest floor, which everyone in the room has alike', () => {
    const step = createStepper();
    // (up the bay's stairs, a room whose deck is at −2)
    expect(step({ x: 0, y: 1.5, z: 0, yaw: 0, room: 'bay327' }, 'ds1', 0.1, -2)[0].y).toBeCloseTo(3.5, 6);
    // (never under naught: the link keeps it from there up)
    expect(step({ x: 0, y: -3, z: 0, yaw: 0, room: 'bay327' }, 'ds1', 0.1, -2)[0].y).toBe(0);
    expect(floorOf({ y: 12, floors: [{ y: 12 }, { y: 10.5 }] })).toBe(10.5);
    expect(floorOf(null)).toBe(0);
  });

  it('says how fast you go from how far you went, eased, and naught for a jump to a new place', () => {
    const step = createStepper();
    step({ x: 0, y: 0, z: 0, yaw: 0, room: 'hold' }, 'ds1', 0.1);
    let h;
    for (let i = 1; i <= 30; i++) [h] = step({ x: i * 0.3, y: 0, z: 0, yaw: 0, room: 'hold' }, 'ds1', 0.1);
    expect(h.speed).toBeCloseTo(3, 1);
    // (a lift, a checkpoint: there at once, not running there)
    [h] = step({ x: 80, y: 0, z: 0, yaw: 0, room: 'hold' }, 'ds1', 0.1);
    expect(h.speed).toBeLessThan(3.1);
  });
});
