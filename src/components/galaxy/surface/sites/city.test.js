import { describe, expect, it } from 'vitest';
import { cityOf, rowsOf } from './city';

const KIT = [
  { kind: 'house', foot: [12, 10] },
  { kind: 'block', foot: [16, 14], weight: 2 },
  { kind: 'tower', foot: [30, 30] },
];
const grid = (more = {}) => cityOf({ plan: 'grid', r: 150, kit: KIT, plaza: 30, ...more }, { seed: 7 });
const rings = (more = {}) => cityOf({ plan: 'rings', r: 150, kit: KIT, plaza: 30, ...more }, { seed: 7 });
const buildings = (c) => c.things.filter((t) => KIT.some((k) => k.kind === t.kind));
const footOf = (t) => KIT.find((k) => k.kind === t.kind).foot.map((v) => v * t.scale);

describe('cityOf: a grid', () => {
  it('fills its blocks with the kit’s buildings, the same for the same seed', () => {
    const c = grid();
    expect(buildings(c).length).toBeGreaterThan(30);
    expect(c.lots).toBe(buildings(c).length);
    expect(grid()).toEqual(c);
    expect(cityOf({ plan: 'grid', r: 150, kit: KIT, plaza: 30 }, { seed: 8 })).not.toEqual(c);
    expect(c.flat.r).toBeGreaterThanOrEqual(150);
  });

  it('keeps every building inside the city, off its plaza and its kept spots, and out of the streets', () => {
    const keep = [{ at: [60, -40], r: 20 }];
    const c = grid({ keep, street: 9, block: 36 });
    const pitch = 45;
    for (const t of buildings(c)) {
      const [w, d] = footOf(t);
      const r = Math.hypot(w, d) / 2;
      expect(Math.hypot(...t.at) + r, t.kind).toBeLessThan(150 + 1);
      expect(Math.hypot(...t.at)).toBeGreaterThan(30);
      expect(Math.hypot(t.at[0] - 60, t.at[1] + 40)).toBeGreaterThan(20);
      // (its middle within a block, not on a street line)
      for (const v of t.at) {
        const off = Math.abs(((v / pitch) % 1) + 1) % 1;
        const fromLine = Math.abs(off - 0.5) * pitch;
        expect(fromLine).toBeGreaterThan(4.5);
      }
    }
  });

  it('turns each building to face a street', () => {
    for (const t of buildings(grid())) {
      // (its front, its own +z turned by yaw, points along an axis)
      const fx = Math.sin(t.yaw);
      const fz = Math.cos(t.yaw);
      expect(Math.min(Math.abs(fx), Math.abs(fz))).toBeLessThan(1e-6);
    }
  });

  it('lights its streets, clutters its pavements, and walks and flies them', () => {
    const c = grid({ crowd: { kinds: ['villager', 'officer'], n: 12, name: 'Townsfolk' }, traffic: { kind: 'airspeeder', n: 4, y: 16 } });
    const lamps = c.things.filter((t) => t.kind === 'lamp');
    expect(lamps.length).toBeGreaterThan(20);
    expect(c.things.some((t) => t.kind === 'crates' || t.kind === 'barrels')).toBe(true);
    const walkers = c.life.filter((a) => a.kind !== 'airspeeder');
    expect(walkers).toHaveLength(12);
    expect(walkers.every((a) => a.path.length === 4 && a.name === 'Townsfolk' && a.speed > 0.8)).toBe(true);
    const craft = c.life.filter((a) => a.kind === 'airspeeder');
    expect(craft).toHaveLength(4);
    expect(craft.every((a) => a.y >= 16 && a.solid === false && a.pause === 0 && a.path.every((q) => Math.hypot(...q) < 150 * 1.42))).toBe(true);
  });

  it('splits its blocks only as its kit can fill them: a kit of towers takes whole blocks', () => {
    const towers = buildings(grid({ kit: [{ kind: 'tower', foot: [30, 30] }] }));
    expect(towers.length).toBeGreaterThan(8);
  });

  it('paves its streets and its plaza for the ground', () => {
    const c = grid({ street: 9, block: 36 });
    expect(c.paving[0]).toEqual({ at: [0, 0], r: 30 });
    const streets = c.paving.filter((s) => s.a);
    expect(streets.length).toBeGreaterThan(8);
    for (const s of streets) {
      expect(s.w).toBe(9);
      // (each on a line between the blocks, end to end across the city)
      const line = s.a[0] === s.b[0] ? s.a[0] : s.a[1];
      expect(Math.abs(((((line / 45) % 1) + 1) % 1) - 0.5)).toBeLessThan(1e-9);
      expect(Math.hypot(...s.a)).toBeCloseTo(150, 6);
    }
  });

  it('lays no lamps when told not to, and stands nothing where nothing fits', () => {
    expect(grid({ lamps: null }).things.some((t) => t.kind === 'lamp')).toBe(false);
    expect(buildings(grid({ kit: [{ kind: 'tower', foot: [80, 80] }] }))).toEqual([]);
  });
});

describe('cityOf: rings', () => {
  it('rings its plaza with rows of buildings back to back, facing their streets', () => {
    const c = rings();
    const bs = buildings(c);
    expect(bs.length).toBeGreaterThan(30);
    for (const t of bs) {
      const d = Math.hypot(...t.at);
      expect(d).toBeGreaterThan(30);
      expect(d).toBeLessThan(150);
      // (its front along the radius, in or out)
      const fx = Math.sin(t.yaw);
      const fz = Math.cos(t.yaw);
      const along = Math.abs((fx * t.at[0] + fz * t.at[1]) / d);
      expect(along).toBeGreaterThan(0.99);
    }
    expect(c.things.some((t) => t.kind === 'lamp')).toBe(true);
  });

  it('lays one row a ring, facing out, where its kit is too deep for two', () => {
    const deep = buildings(rings({ kit: [{ kind: 'house', foot: [14, 24] }] }));
    expect(deep.length).toBeGreaterThan(10);
    for (const t of deep) expect(Math.sin(t.yaw) * t.at[0] + Math.cos(t.yaw) * t.at[1]).toBeGreaterThan(0);
  });

  it('cuts a ring’s lots long enough for every kind of its kit, whatever the seed', () => {
    const kit = [
      { kind: 'house', foot: [16, 15], weight: 3 },
      { kind: 'tower', foot: [27, 30], weight: 0.4, scale: [0.5, 0.7] },
    ];
    for (const seed of [3, 5, 7171, 12])
      expect(cityOf({ plan: 'rings', r: 160, block: 32, plaza: 88, kit }, { seed }).things.filter((t) => t.kind === 'house').length, `seed ${seed}`).toBeGreaterThan(10);
  });

  it('paves its ring streets and its plaza for the ground', () => {
    const c = rings({ street: 9 });
    expect(c.paving[0]).toEqual({ at: [0, 0], r: 30 });
    const roads = c.paving.slice(1);
    expect(roads.length).toBeGreaterThan(1);
    expect(roads.every((s) => s.w === 9 && s.r > 30 && s.r <= 150)).toBe(true);
  });

  it('walks and flies its ring streets', () => {
    const c = rings({ crowd: { kinds: ['villager'], n: 6 }, traffic: { kind: 'airspeeder', n: 2 } });
    expect(c.life.filter((a) => a.kind === 'villager')).toHaveLength(6);
    expect(c.life.filter((a) => a.kind === 'airspeeder').every((a) => a.path.length === 16 && a.y >= 14)).toBe(true);
  });
});

describe('rowsOf: a city as scatter rows', () => {
  it('gathers its things a kind a row, each building solid over nine tenths of its footprint', () => {
    const c = grid();
    const rows = rowsOf(c.things, { house: [12, 10], block: [16, 14] });
    expect(new Set(rows.map((r) => r.kind)).size).toBe(rows.length);
    expect(rows.reduce((s, r) => s + r.items.length, 0)).toBe(c.things.length);
    const house = rows.find((r) => r.kind === 'house');
    expect(house.items.every((it) => it.box[0] === 5.4 && it.box[1] === 4.5 && it.scale > 0)).toBe(true);
    expect(rows.find((r) => r.kind === 'lamp').items.every((it) => !it.box)).toBe(true);
    expect(rows.every((r) => r.solid && r.city)).toBe(true);
  });
});
