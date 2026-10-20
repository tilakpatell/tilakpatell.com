import { describe, expect, it } from 'vitest';
import { CORE } from '../systems';
import { FAR, HIGH, LOW, NEAR, WHOLE, ease, eye, fitTo, focus, lensOf, pan, pitchFor, planeAt, project, settled, turn, zoomAt } from './holoCamera';

const near = (a, b, d = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < d);

describe('the holotable’s camera', () => {
  it('starts over the core, the north at the top, looking straight down at the whole disc', () => {
    const p = WHOLE(16 / 9);
    // (at the bulged rings' middle: a little south of the core)
    expect(p.x).toBe(CORE[0]);
    expect(p.z - CORE[1]).toBeGreaterThan(0);
    expect(p.z - CORE[1]).toBeLessThan(2.2);
    expect(p.yaw).toBe(0);
    expect(p.pitch).toBeGreaterThan(1);
    const { at, look } = eye(p);
    expect(look[0]).toBe(0);
    // (from the south and above: the north is up the screen)
    expect(at[2]).toBeGreaterThan(0);
    expect(at[1]).toBeGreaterThan(0);
    // a narrower window stands further off to fit the disc's width, and so does one with less of it free
    expect(WHOLE(0.6).dist).toBeGreaterThan(WHOLE(16 / 9).dist);
    expect(WHOLE(16 / 9, undefined, { fx: 0.4 }).dist).toBeGreaterThan(WHOLE(16 / 9).dist);
  });
  it('fits every point of the disc’s edge on the screen, the near side too', () => {
    const p = WHOLE(16 / 9);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 10.6 * (1 + 0.18 * Math.sin(a));
      const [nx, ny, depth] = project(p, [Math.cos(a) * r, 0, Math.sin(a) * r]);
      expect(depth).toBeGreaterThan(0);
      expect(Math.abs(nx)).toBeLessThanOrEqual(0.97);
      expect(Math.abs(ny)).toBeLessThanOrEqual(0.94);
    }
    // (and the point it looks at is the screen's middle)
    const [cx, cy] = project(p, eye(p).look);
    expect(Math.abs(cx) + Math.abs(cy)).toBeLessThan(1e-9);
  });
  it('shows the whole disc flat, from straight overhead: its near side drawn no bigger than its far', () => {
    // (at 64° the near side loomed a third bigger than the far, and the names along the east and west lay on their sides)
    for (const aspect of [16 / 9, 1108 / 900, 390 / 520]) {
      const p = WHOLE(aspect);
      expect(p.pitch).toBeCloseTo(Math.PI / 2, 2);
      // (a grid square's width across the north rim and across the south, as drawn)
      const across = (z) => project(p, [1, 0, z], { aspect })[0] - project(p, [-1, 0, z], { aspect })[0];
      expect(across(10.6 * 1.18) / across(-10.6 * 0.82)).toBeCloseTo(1, 2);
    }
  });
  it('fits the whole disc into a phone’s strip between its header and an opened sheet', () => {
    // (390 × 844, a system picked: the header and the crumb down to 327 px, the sheet up from 432; fitted to a fifth of its
    // frame at the least and from 90 squares off at the most, the disc spilled past the strip and Tatooine's YOU tag went unnamed)
    const size = { w: 390, h: 844 };
    const inset = { top: 327, bottom: 412 };
    const f = lensOf(size, inset);
    const p = WHOLE(f.aspect, undefined, f);
    expect(p.dist).toBeLessThan(FAR);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 10.6 * (1 + 0.18 * Math.sin(a));
      const [, ny] = project(p, [Math.cos(a) * r, 0, Math.sin(a) * r], { aspect: f.aspect });
      const y = ((1 - ny) / 2) * f.H - f.y;
      expect(y).toBeGreaterThanOrEqual(inset.top);
      expect(y).toBeLessThanOrEqual(size.h - inset.bottom);
    }
  });
  it('centres its frame on the part of the stage the panels leave free', () => {
    // (a side panel at the right: the frame wider by it, the stage its right part, so the frame's middle is the free part's)
    const side = lensOf({ w: 1440, h: 900 }, { right: 332 });
    expect([side.W, side.H, side.x, side.y]).toEqual([1772, 900, 332, 0]);
    expect(side.W / 2 - side.x).toBeCloseTo((1440 - 332) / 2);
    expect(side.fx).toBeCloseTo(1108 / 1772);
    // (a phone: a header over the top and a sheet along the foot; the middle between them)
    const phone = lensOf({ w: 390, h: 844 }, { top: 180, bottom: 320 });
    expect(phone.H / 2 - phone.y).toBeCloseTo((180 + 844 - 320) / 2);
    expect(phone.fy).toBeCloseTo((844 - 500) / phone.H);
    const head = lensOf({ w: 390, h: 844 }, { top: 300, bottom: 100 });
    expect(head.y).toBe(0);
    expect(head.H / 2 - head.y).toBeCloseTo((300 + 844 - 100) / 2);
    expect(lensOf({ w: 800, h: 600 })).toEqual({ W: 800, H: 600, x: 0, y: 0, aspect: 800 / 600, fx: 1, fy: 1 });
  });
  it('looks at the point under the middle of the screen, and at nothing above the horizon', () => {
    const p = { ...WHOLE(), x: 14, z: 8 };
    expect(near(planeAt(p, 0, 0), [14, 8], 1e-9)).toBe(true);
    // (a pose looking shallowly enough to see a horizon, which the hands never give the flat map)
    expect(planeAt({ ...p, pitch: 0.4 }, 0, 5)).toBeNull();
  });
  it('zooms about a point, closer and as flat, held between its nearest and its furthest', () => {
    const p = WHOLE();
    const anchor = [16, 12];
    const z = zoomAt(p, 2, anchor);
    expect(z.dist).toBeCloseTo(p.dist / 2);
    expect(z.pitch).toBe(p.pitch);
    // (its point slides half the way to the anchor: the anchor holds still on the screen)
    expect(near([z.x, z.z], [(p.x + anchor[0]) / 2, (p.z + anchor[1]) / 2], 1e-9)).toBe(true);
    expect(zoomAt(p, 1e6).dist).toBe(NEAR);
    expect(zoomAt(p, 1e-6).dist).toBe(FAR);
    expect(pitchFor(NEAR)).toBe(pitchFor(30));
  });
  it('turns round its point, and never tips the flat map', () => {
    const p = WHOLE();
    const t = turn(p, 0.5, 10);
    expect(t.yaw).toBeCloseTo(0.5);
    expect(t.pitch).toBe(HIGH);
    expect(turn(p, 0, -10).pitch).toBe(LOW);
    expect(LOW).toBe(HIGH);
    expect([t.x, t.z]).toEqual([p.x, p.z]);
  });
  it('pans against the drag: the plane moves with the hand', () => {
    const p = { ...WHOLE(), dist: 10 };
    const right = pan(p, 100, 0);
    expect(right.x).toBeLessThan(p.x);
    expect(right.z).toBeCloseTo(p.z);
    const down = pan(p, 0, 100);
    expect(down.z).toBeLessThan(p.z); // (dragged down, it looks further north)
    // turned half round, the same drag goes the other way on the map
    expect(pan({ ...p, yaw: Math.PI }, 100, 0).x).toBeGreaterThan(p.x);
    // and it never leaves the galaxy
    const far = pan(p, -1e7, 0);
    expect(Math.hypot(far.x - CORE[0], far.z - CORE[1])).toBeLessThan(13);
  });
  it('frames a course’s ends: both on the free part of the screen, from no closer than it shows one', () => {
    const p = { ...WHOLE(), dist: 4, x: 20, z: 6 };
    const ends = [[17.6, 15.4], [6.2, 7.1]];
    const f = fitTo(p, ends, { aspect: 1108 / 900, fx: 1, fy: 1 });
    expect([f.x, f.z]).toEqual([(17.6 + 6.2) / 2, (15.4 + 7.1) / 2]);
    for (const [x, z] of ends) {
      const [nx, ny, depth] = project(f, [x - CORE[0], 0, z - CORE[1]], { aspect: 1108 / 900 });
      expect(depth).toBeGreaterThan(0);
      expect(Math.max(Math.abs(nx), Math.abs(ny))).toBeLessThanOrEqual(0.78);
    }
    // (a narrower free part stands further off; one system alone, from its closest)
    expect(fitTo(p, ends, { aspect: 1108 / 900, fx: 0.5 }).dist).toBeGreaterThan(f.dist);
    expect(fitTo(p, [[17.6, 15.4]]).dist).toBeCloseTo(7);
    // (a sector opened as flat as the rest, whatever tilt it's asked for)
    expect(fitTo(p, ends).pitch).toBe(p.pitch);
    expect(fitTo(p, ends, { pitch: 0.84 }).pitch).toBe(HIGH);
  });
  it('flies to a system, no further off than it asks, and eases there the short way round', () => {
    const p = WHOLE();
    const f = focus(p, [17.6, 15.4], { dist: 7 });
    expect([f.x, f.z]).toEqual([17.6, 15.4]);
    expect(f.dist).toBe(7);
    expect(focus({ ...p, dist: 4 }, [17.6, 15.4]).dist).toBe(4);
    let at = { ...p, yaw: 3 };
    const to = { ...f, yaw: -3 };
    for (let i = 0; i < 200; i++) at = ease(at, to, 1 / 60);
    expect(settled(at, to)).toBe(true);
    // (from 3 to −3 radians is 0.28 the short way, not 6)
    const step = ease({ ...p, yaw: 3 }, { ...p, yaw: -3 }, 1 / 60);
    expect(step.yaw).toBeGreaterThan(3);
  });
});
