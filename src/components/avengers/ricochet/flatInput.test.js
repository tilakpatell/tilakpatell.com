import { describe, expect, it } from 'vitest';
import { ROOMS, STEP, newRoom, simulateThrow, starsFor, throwShield } from './rules';
import { clearReward } from './save';
import { VIEW, aimFromDrag, aimWords, assistFor, createFlat, discAt, keyAim, previewPath, toWorld, viewBox } from './flatInput';

const deg = (d) => (d * Math.PI) / 180;
const land = (c, dt = 1 / 60) => { const ev = []; for (let i = 0; i < 4000 && c.room.phase === 'flying'; i++) ev.push(...c.tick(dt)); return ev; };
const started = (i) => { const c = createFlat(i); c.enter(i); return c; };

describe('Ricochet from above: geometry and aim', () => {
  it('holds every room inside the view box, metres as the SVG’s units', () => {
    expect(viewBox).toBe('-8.6 -6.6 17.2 13.2');
    for (const r of ROOMS) for (const w of r.walls) for (const [x, z] of [w.a, w.b]) {
      expect(x).toBeGreaterThanOrEqual(VIEW.x); expect(x).toBeLessThanOrEqual(VIEW.x + VIEW.w);
      expect(z).toBeGreaterThanOrEqual(VIEW.y); expect(z).toBeLessThanOrEqual(VIEW.y + VIEW.h);
    }
  });
  it('turns the point under the pointer into the room’s metres, letterboxed', () => {
    const rect = { left: 0, top: 0, width: 860, height: 1000 };
    const [x, z] = toWorld(rect, 430, 500);
    expect(x).toBeCloseTo(0); expect(z).toBeCloseTo(0);
    const [x0, z0] = toWorld(rect, 0, 170);
    expect(x0).toBeCloseTo(-8.6); expect(z0).toBeCloseTo(-6.6);
  });
  it('aims along the drag from the thrower: 0 up the room, positive to the right, as the 3D’s angleAt', () => {
    expect(aimFromDrag([0, 4.6], [0, 0])).toBe(0);
    expect(aimFromDrag([0, 4.6], [1, 3.6])).toBeCloseTo(Math.PI / 4);
    expect(aimFromDrag([0, 4.6], [-5, 5])).toBe(-1.55);
    expect(aimFromDrag([0, 4.6], [0.1, 4.6])).toBeNull();
  });
  it('nudges the aim with the arrow keys as the 3D game does, and says it in words', () => {
    expect(keyAim(0, 'ArrowRight')).toBeCloseTo(0.012);
    expect(keyAim(0, 'd')).toBeCloseTo(0.012);
    expect(keyAim(0, 'ArrowLeft', true)).toBeCloseTo(-0.002);
    expect(keyAim(1.545, 'ArrowRight')).toBe(1.55);
    expect(keyAim(-1.55, 'a')).toBe(-1.55);
    expect(keyAim(0, 'x')).toBeNull();
    expect([aimWords(0), aimWords(deg(0.4)), aimWords(deg(12.4)), aimWords(deg(-30))]).toEqual(['straight ahead', 'straight ahead', '12° right', '30° left']);
  });
  it('previews as far as the 3D game does in that room', () => {
    expect([assistFor(2), assistFor(3)]).toEqual([true, false]);
    const r = newRoom(0);
    const f = simulateThrow(r, deg(30));
    const p = previewPath(r, deg(30), true);
    expect(p).toHaveLength(4);
    expect(p[0]).toEqual([0, 4.6]);
    expect(p[2][0]).toBeCloseTo(f.path[2].x);
    expect(Math.hypot(p[3][0] - p[2][0], p[3][1] - p[2][1])).toBeCloseTo(2.6);
    const q = previewPath(r, deg(30), false);
    expect(q).toHaveLength(3);
    expect(Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])).toBeCloseTo(2.6);
    const short = previewPath(newRoom(0), 0, true); // caught at z 3.6 on the way back
    expect(short).toHaveLength(3);
    expect(short[2][1]).toBeCloseTo(3.6);
  });
  it('puts the disc where the flight is', () => {
    const r = newRoom(0);
    expect(discAt(r.flight)).toBeNull();
    throwShield(r, 0);
    expect(discAt(r.flight)).toEqual([0, 4.6]);
    r.flight.elapsed = 0.3;
    const [x, z] = discAt(r.flight);
    expect(x).toBeCloseTo(0); expect(z).toBeCloseTo(4.6 - 17 * 0.3);
  });
});

describe('Ricochet from above: the controller on the real rules', () => {
  it('takes no input until a room is entered, nor after it ends', () => {
    const c = createFlat(0);
    expect(c.live).toBe(false);
    expect(c.key(' ')).toEqual({ handled: false, flight: null });
    c.press([0.6, -3.5]);
    expect(c.dragging).toBe(false);
    expect([c.throw(), c.tick(1), c.room.t]).toEqual([null, [], 0]);
    c.enter(0);
    expect(c.live).toBe(true);
    c.aim(Math.atan2(0.6, 8.1)); c.throw(); land(c);
    expect([c.room.phase, c.live, c.key(' ').handled]).toEqual(['cleared', false, false]);
  });
  it('a scripted player clears room 1 by dragging at the bot and letting go', () => {
    const c = started(0);
    c.press([0, 4]);
    c.move([0.6, -3.5]);
    expect(c.angle).toBeCloseTo(Math.atan2(0.6, 8.1));
    expect(c.release([0.6, -3.5])).toBeTruthy();
    const ev = land(c);
    expect(c.room.phase).toBe('cleared');
    expect(ev.at(-1)).toMatchObject({ type: 'cleared', throws: 1, stars: 3 });
  });
  it('a scripted player clears room 1 from the keyboard: three nudges right, then Space', () => {
    const c = started(0);
    for (let i = 0; i < 3; i++) expect(c.key('ArrowRight').handled).toBe(true);
    expect(c.angle).toBeCloseTo(0.036);
    expect(c.key(' ').flight).toBeTruthy();
    expect(c.key(' ')).toEqual({ handled: true, flight: null });
    land(c);
    expect([c.room.phase, starsFor(c.room)]).toEqual(['cleared', 3]);
  });
  it('letting go on the thrower, or losing the pointer, throws nothing', () => {
    const c = started(0);
    c.press([0.6, -3.5]);
    expect(c.release([0, 4.6])).toBeNull();
    c.press([0.6, -3.5]);
    c.cancel();
    expect(c.release([0.6, -3.5])).toBeNull();
    expect([c.room.throws, c.room.phase, c.dragging]).toEqual([0, 'aim', false]);
  });
  it('steps the room at the rules’ fixed step, never more than 0.05 s a frame', () => {
    expect(STEP).toBe(1 / 120);
    const c = started(5);
    c.tick(1);
    expect(c.room.t).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(c.room.t).toBeGreaterThanOrEqual(0.05 - STEP);
    for (let i = 0; i < 60; i++) c.tick(1 / 60);
    expect(Math.abs(c.room.t - 1.05)).toBeLessThanOrEqual(STEP);
  });
  it('a scripted player clears room 12 in three throws at any frame rate and earns the Mind Stone', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      const c = started(11);
      for (const a of [40, 67.3, -12.9]) { c.aim(deg(a)); expect(c.throw()).toBeTruthy(); land(c, dt); }
      expect([c.room.phase, c.room.throws, starsFor(c.room)]).toEqual(['cleared', 3, 3]);
      expect(clearReward(c.room.index)).toEqual({ stone: 'mind', achievement: 'captain' });
    }
  });
});
