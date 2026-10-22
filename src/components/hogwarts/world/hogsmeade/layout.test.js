import { describe, expect, it } from 'vitest';
import { BUILDINGS, SHACK, VILLAGE, buildingAt } from '../../rules/hogsmeade';
import { fromRoom } from '../../rules/paths';
import { EDGE, S, SITES, bounds, colliders, doorsOf, exitFor, floorAt, lamps, poses, site, spawn, spotsOf, streetFrame, terrainAt, walls, yawFacing } from './layout';

const near = (a, b, eps = 1e-6) => Math.hypot(a[0] - b[0], a[1] - b[1]) < eps;
// (a point turned back into the street’s frame: how far along, how far across)
const frame = ([x, z]) => {
  const [ux, uz] = VILLAGE.axis;
  return { along: x * ux + z * uz, across: -x * uz + z * ux };
};
const inBox = (p, b) => {
  const c = Math.cos(b.turn);
  const s = Math.sin(b.turn);
  const dx = p[0] - b.at[0];
  const dz = p[1] - b.at[1];
  // (the box’s own frame: its width along its turned x)
  const u = dx * c - dz * s;
  const v = dx * s + dz * c;
  return Math.abs(u) < b.w / 2 && Math.abs(v) < b.d / 2;
};

describe('Hogsmeade’s set', () => {
  it('stands in the Map’s own frame, the street’s middle at its origin', () => {
    expect(S(0, 0)).toEqual([0, 0]);
    for (const b of BUILDINGS) {
      const s = site(b.id);
      const map = buildingAt(b.id);
      expect(near(fromRoom('hogsmeade', s.door), map.door), b.id).toBe(true);
      expect(near(fromRoom('hogsmeade', s.at), map.at), b.id).toBe(true);
    }
  });

  it('puts the shops’ doors where the rules have them, and a road back at the station’s end', () => {
    const doors = doorsOf();
    expect(doors.map((d) => d.to).sort()).toEqual(['broomsticks', 'hogshead', 'honeydukes', 'out']);
    for (const d of doors.filter((x) => x.to !== 'out')) {
      const b = BUILDINGS.find((x) => x.room === d.to);
      expect(near(d.at, [buildingAt(b.id).door[0] - VILLAGE.at[0], buildingAt(b.id).door[1] - VILLAGE.at[1]]), d.id).toBe(true);
    }
    const road = doors.find((d) => d.to === 'out');
    expect(road.verb).toBe('Go back');
    expect(frame(road.at).along).toBeLessThan(frame(spawn.at.filter((_, i) => i !== 1)).along);
  });

  it('gives every front without an inside its line at the door', () => {
    const spots = spotsOf();
    expect(spots).toHaveLength(9);
    for (const s of spots) {
      expect(s.verb).toBe('Try');
      expect(s.line).toMatch(/[.”]$/);
    }
  });

  it('lets you out of each shop a step into the street, facing it', () => {
    for (const room of ['honeydukes', 'broomsticks', 'hogshead']) {
      const s = SITES.find((b) => b.room === room);
      const e = exitFor(room);
      expect(Math.hypot(e.at[0] - s.door[0], e.at[1] - s.door[1])).toBeCloseTo(1.6);
      // (out of the door is what you face)
      expect(-Math.sin(e.yaw) * s.out[0] - Math.cos(e.yaw) * s.out[1]).toBeCloseTo(1);
      // (and not inside the building you came out of, nor any other)
      for (const c of colliders().filter((x) => x.kind === 'box')) expect(inBox(e.at, c), `${room} in a box`).toBe(false);
    }
    expect(exitFor('nowhere')).toBeNull();
  });

  it('starts you at the station’s end, looking up the street, clear of everything', () => {
    const at = [spawn.at[0], spawn.at[2]];
    expect(frame(at).along).toBeLessThan(-60);
    expect(Math.abs(frame(at).across)).toBeLessThan(1);
    expect(-Math.sin(spawn.yaw) * VILLAGE.axis[0] - Math.cos(spawn.yaw) * VILLAGE.axis[1]).toBeCloseTo(1);
    for (const c of colliders()) {
      if (c.kind === 'box') expect(inBox(at, c)).toBe(false);
      else expect(Math.hypot(at[0] - c.at[0], at[1] - c.at[1])).toBeGreaterThan(c.r + 0.4);
    }
  });

  it('keeps every door clear of the lamps, and every lamp on a kerb', () => {
    const ls = lamps();
    expect(ls.length).toBeGreaterThan(5);
    for (const l of ls) {
      expect(Math.abs(Math.abs(frame(l.at).across) - (VILLAGE.width / 2 - 0.9))).toBeLessThan(1e-6);
      for (const d of [...doorsOf(), ...spotsOf()]) expect(Math.hypot(l.at[0] - d.at[0], l.at[1] - d.at[1]), d.id).toBeGreaterThan(2.5);
    }
  });

  it('is level in the street, and the Shack stands up its hill behind the fence, out of reach', () => {
    for (let a = EDGE.a0; a <= EDGE.a1; a += 7) for (let c = EDGE.c0; c <= EDGE.c1; c += 6) expect(floorAt(...S(a, c))).toBe(0);
    const shack = [SHACK.at[0] - VILLAGE.at[0], SHACK.at[1] - VILLAGE.at[1]];
    expect(floorAt(...shack)).toBeCloseTo(SHACK.hill);
    // (no step on it steeper than a hillside)
    for (let i = 0; i < 60; i++) {
      const p = [shack[0] + i, shack[1] + i * 0.3];
      expect(Math.abs(floorAt(p[0] + 0.5, p[1]) - floorAt(...p))).toBeLessThan(0.5);
    }
    expect(frame(shack).across).toBeLessThan(EDGE.c0 - 20);
  });

  it('draws the land level where you walk and rising beyond the yards', () => {
    for (let a = EDGE.a0; a <= EDGE.a1; a += 9) for (let c = EDGE.c0; c <= EDGE.c1; c += 7) expect(terrainAt(...S(a, c))).toBe(0);
    expect(terrainAt(...S(0, 160))).toBeGreaterThan(10);
    expect(terrainAt(...S(0, -170))).toBeGreaterThan(10);
    expect(streetFrame(S(12, -3)).along).toBeCloseTo(12);
    expect(streetFrame(S(12, -3)).across).toBeCloseTo(-3);
  });

  it('rings the walk round, and the bounds hold every wall', () => {
    const w = walls();
    expect(w.length).toBeGreaterThan(100);
    for (const c of w) {
      expect(c.at[0]).toBeGreaterThanOrEqual(bounds.x0 - 1e-6);
      expect(c.at[0]).toBeLessThanOrEqual(bounds.x1 + 1e-6);
      expect(c.at[1]).toBeGreaterThanOrEqual(bounds.z0 - 1e-6);
      expect(c.at[1]).toBeLessThanOrEqual(bounds.z1 + 1e-6);
    }
    // (every door inside the walls)
    for (const d of doorsOf().filter((x) => x.to !== 'out')) {
      const f = frame(d.at);
      expect(f.across).toBeGreaterThan(EDGE.c0);
      expect(f.across).toBeLessThan(EDGE.c1);
    }
  });

  it('names its views for the checks', () => {
    for (const k of ['street', 'honeydukes', 'broomsticks', 'shack']) {
      expect(poses[k].at).toHaveLength(3);
      expect(poses[k].look).toHaveLength(3);
    }
    expect(yawFacing([0, -1])).toBeCloseTo(0);
  });
});
