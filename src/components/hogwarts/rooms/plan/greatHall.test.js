import { describe, expect, it } from 'vitest';
import { HALL, STAFF, TABLES, hallPlan } from './greatHall';

const inside = (b, [x, z]) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
const blocked = (colliders, [x, z], r = 0.35) => colliders.some((c) => Math.hypot(x - c.at[0], z - c.at[1]) < c.r + r);

describe('the Great Hall’s plan', () => {
  const p = hallPlan();

  it('runs four house tables the length of the hall, a bench either side', () => {
    expect(p.tables.map((t) => t.house)).toEqual(TABLES.map((t) => t.house));
    expect(new Set(p.tables.map((t) => t.house)).size).toBe(4);
    expect(p.benches).toHaveLength(8);
    for (const t of p.tables) {
      expect(inside(p.bounds, [t.x, t.z0])).toBe(true);
      expect(inside(p.bounds, [t.x, t.z1])).toBe(true);
    }
  });

  it('seats a whole school: over two hundred places, each on a bench facing its table', () => {
    expect(p.seats.length).toBeGreaterThan(200);
    for (const s of p.seats) {
      const b = p.benches.find((x) => x.house === s.house && Math.abs(x.x - s.at[0]) < 1e-9);
      expect(b).toBeTruthy();
      expect(s.at[2]).toBeGreaterThanOrEqual(b.z0);
      expect(s.at[2]).toBeLessThanOrEqual(b.z1);
      // (facing the table: the yaw turns +z toward it)
      const t = p.tables.find((x) => x.house === s.house);
      expect(Math.sign(Math.sin(s.yaw))).toBe(Math.sign(t.x - s.at[0]));
    }
  });

  it('sits the staff on the dais behind the high table, the Headmaster in the middle in gold', () => {
    expect(p.staff.map((s) => s.who)).toEqual(STAFF);
    const head = p.staff.find((s) => s.gold);
    expect(head.who).toBe('dumbledore');
    expect(Math.abs(head.at[0])).toBeLessThan(1.5);
    for (const s of p.staff) {
      expect(s.at[2]).toBeLessThan(HALL.dais.z);
      expect(p.floorAt(s.at[0], s.at[2])).toBe(HALL.dais.height);
    }
  });

  it('raises the dais by steps, and is flat floor elsewhere', () => {
    expect(p.floorAt(0, 0)).toBe(0);
    expect(p.floorAt(0, 20)).toBe(0);
    expect(p.floorAt(0, -25)).toBe(HALL.dais.height);
    let last = HALL.dais.height;
    for (let z = HALL.dais.z; z < HALL.dais.z + 1.4; z += 0.05) {
      const y = p.floorAt(0, z);
      expect(y).toBeLessThanOrEqual(last + 1e-9);
      expect(last - y).toBeLessThanOrEqual(HALL.dais.height / HALL.dais.steps + 1e-9);
      last = y;
    }
  });

  it('leaves the aisles between the tables open to walk, from the doors to the dais', () => {
    const aisles = [-8.6, -4.4, 0, 4.4, 8.6];
    for (const x of aisles) for (let z = -19; z <= 24; z += 0.5) expect(blocked(p.colliders, [x, z]), `${x}, ${z}`).toBe(false);
    // and up the middle to the lectern, then past it onto the dais
    for (let z = -19; z >= -20.6; z -= 0.2) expect(blocked(p.colliders, [0, z])).toBe(false);
    for (let z = -20.6; z >= HALL.dais.z - 0.2; z -= 0.2) expect(blocked(p.colliders, [1.1, z])).toBe(false);
  });

  it('keeps the doors, the start and every place inside the walls, the start clear', () => {
    expect(inside(p.bounds, p.start.at)).toBe(true);
    expect(blocked(p.colliders, p.start.at)).toBe(false);
    for (const d of p.doors) expect(inside(p.bounds, d.at)).toBe(true);
    for (const pl of p.places) expect(inside(p.bounds, pl.at)).toBe(true);
  });

  it('floats more candles the higher the tier, all under the vault and over the heads', () => {
    const n = ['low', 'mid', 'high', 'ultra'].map((tier) => hallPlan({ tier }).candles.count);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeGreaterThan(n[i - 1]);
    expect(n[0]).toBe(100);
    expect(p.candles.box.y[0]).toBeGreaterThan(3);
    expect(p.candles.box.y[1]).toBeLessThan(HALL.wall);
  });

  it('stands four hourglasses by the doors, three banners over each table and twelve trees for Christmas', () => {
    expect(p.hourglasses.map((h) => h.house).sort()).toEqual(['gryffindor', 'hufflepuff', 'ravenclaw', 'slytherin']);
    for (const h of p.hourglasses) expect(h.at[2]).toBeGreaterThan(HALL.length / 2 - 3);
    expect(p.banners).toHaveLength(12);
    expect(p.trees).toHaveLength(12);
    for (const t of p.trees) expect(blocked(p.colliders, [t.at[0], t.at[2]], 0)).toBe(false);
  });
});
