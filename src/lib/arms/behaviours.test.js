import { describe, expect, it } from 'vitest';
import { shotRadius } from '../combat/contact';
import { HAND_FX, SHIP_FX, beamTicks, blastOf, burstDirs, chain, chargeOf, climbOf, dropAt, firstFor, inRing, jagged, orbsInFlight, pierce, punchAfter, throwOf } from './behaviours';
import { WEAPONS } from './hand';
import { WEAPONS as SHIP_WEAPONS } from './ship';

const at = (x, y = 0, z = 0) => ({ x, y, z });
const ship = (id, x, y = 0, z = 0, size = 1) => ({ id, at: at(x, y, z), size });
const len = (v) => Math.hypot(...v);

describe('the seismic charge', () => {
  it('leaves the ship behind it, drifting on with a share of its way', () => {
    const d = dropAt(at(0, 0, 0), [0, 0, -1], 20);
    expect(d.at.z).toBeCloseTo(SHIP_FX.seismic.back);
    expect(d.v[2]).toBeCloseTo(-20 * SHIP_FX.seismic.drift);
    expect(dropAt(at(0, 0, 0), [0, 0, -1], -5).v[2]).toBeCloseTo(0);
  });
  it('takes everything in its flat ring, and nothing past its edge or above its slab', () => {
    const R = SHIP_FX.seismic.radius;
    const list = [ship('in', R - 1), ship('edge', R + 0.4), ship('out', R + 2), ship('high', 1, SHIP_FX.seismic.slab + 2), ship('low', 0, -1)];
    expect(inRing(at(0, 0, 0), list, R, SHIP_FX.seismic.slab).map((t) => t.id)).toEqual(['in', 'edge', 'low']);
  });
});

describe('concentrated dark matter', () => {
  it('goes through every ship in its line, nearest first, and never the same one twice', () => {
    const list = [ship('far', 0, 0, -20), ship('near', 0, 0, -5), ship('wide', 4, 0, -10)];
    const hit = new Set();
    const first = pierce(at(0, 0, 0), at(0, 0, -30), list, hit);
    expect(first.map((t) => t.id)).toEqual(['near', 'far']);
    for (const t of first) hit.add(t.id);
    expect(pierce(at(0, 0, 0), at(0, 0, -30), list, hit)).toEqual([]);
  });
  it('loses a third of what it has at each', () => {
    expect(punchAfter(9, 0)).toBeCloseTo(9);
    expect(punchAfter(9, 1)).toBeCloseTo(6);
    expect(punchAfter(9, 2)).toBeCloseTo(4);
  });
});

describe('the blue sky cluster', () => {
  it('bursts into its shards round the way it was going, each unit length and a cone out', () => {
    const dirs = burstDirs([0, 0, -1], SHIP_FX.crystal.shards, SHIP_FX.crystal.cone, () => 0.3);
    expect(dirs).toHaveLength(6);
    for (const d of dirs) {
      expect(len(d)).toBeCloseTo(1);
      expect(Math.acos(-d[2])).toBeCloseTo(SHIP_FX.crystal.cone, 5);
    }
    // (straight up, where there's no level side to take: still round it)
    for (const d of burstDirs([0, 1, 0], 4, 0.3)) expect(Math.acos(d[1])).toBeCloseTo(0.3, 5);
  });
});

describe('the energon arc', () => {
  const list = [ship('a', 0, 0, -20), ship('b', 8, 0, -20), ship('c', 16, 0, -20), ship('d', 40, 0, -20), ship('e', 6, 0, -26)];
  it('goes for the lock when it’s in reach, else the nearest ahead of the nose', () => {
    expect(firstFor(at(0, 0, 0), [0, 0, -1], list, { lock: list[2] }).id).toBe('c');
    expect(firstFor(at(0, 0, 0), [0, 0, -1], list).id).toBe('a');
    expect(firstFor(at(0, 0, 0), [0, 0, 1], list)).toBeNull();
    expect(firstFor(at(0, 0, 0), [0, 0, -1], list, { lock: ship('gone', 0, 0, -5) }).id).toBe('a');
  });
  it('jumps on to the nearest it hasn’t reached, each weaker, and stops with none in a hop', () => {
    const r = chain(list[0], list, { jumps: 3, hop: 12, falloff: 0.7, punch: 10 });
    expect(r.map((h) => h.t.id)).toEqual(['a', 'b', 'e', 'c']);
    expect(r.map((h) => +h.punch.toFixed(2))).toEqual([10, 7, 4.9, 3.43]);
    expect(chain(list[3], list, { jumps: 3, hop: 12, punch: 10 }).map((h) => h.t.id)).toEqual(['d']);
    expect(chain(null, list)).toEqual([]);
  });
  it('is drawn from end to end, rough in the middle', () => {
    const p = jagged(at(0, 0, 0), at(0, 0, -10), 6, () => 1);
    expect(p).toHaveLength(7);
    expect(p[0]).toEqual(at(0, 0, 0));
    expect(p[6]).toEqual(at(0, 0, -10));
    expect(p[3].x).toBeGreaterThan(0);
  });
});

describe('the particle beam', () => {
  it('lands ten hits a second however the frames fall', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.25]) {
      const beam = { acc: 0 };
      let n = 0;
      for (let t = 0; t < 1 - 1e-9; t += dt) n += beamTicks(beam, dt, WEAPONS.particle.every);
      expect(n, `${dt}`).toBe(10);
    }
  });
});

describe('the M60', () => {
  it('walks the aim up more the longer a run goes, less down the sights, and not at all for a gun that doesn’t', () => {
    const w = WEAPONS.m60;
    expect(climbOf(w, 0, false)).toBeCloseTo(w.climb);
    expect(climbOf(w, 10, false)).toBeGreaterThan(climbOf(w, 1, false));
    expect(climbOf(w, 1000, false)).toBeCloseTo(w.climb * HAND_FX.m60.most);
    expect(climbOf(w, 5, true)).toBeLessThan(climbOf(w, 5, false));
    expect(climbOf(WEAPONS.rifle, 5, false)).toBe(0);
  });
});

describe('the repulsor gauntlet', () => {
  it('charges to full over its time, and no further', () => {
    const w = WEAPONS.gauntlet;
    expect(chargeOf(0, w)).toBe(0);
    expect(chargeOf(w.charge / 2, w)).toBeCloseTo(0.5);
    expect(chargeOf(w.charge * 3, w)).toBe(1);
    expect(chargeOf(1, WEAPONS.rifle)).toBe(0);
  });
  it('hits harder, throws further and blasts bigger charged', () => {
    const w = WEAPONS.gauntlet;
    const tap = blastOf(w, 0);
    const full = blastOf(w, 1);
    expect(tap.damage).toBe(w.damage);
    expect(full.damage).toBe(w.damage * HAND_FX.gauntlet.damage);
    expect(full.push).toBeGreaterThan(tap.push);
    expect(full.scale).toBeGreaterThan(tap.scale);
  });
  it('throws whoever it hits away from the palm', () => {
    const v = throwOf(at(0, 0, 0), at(3, 0, 4), 10, 2);
    expect(v.vx).toBeCloseTo(6);
    expect(v.vz).toBeCloseTo(8);
    expect(v.vy).toBe(2);
  });
});

describe('dark matter (B9)', () => {
  it('pierce as a bolt given shotRadius; the most orbs in flight', () => {
    const passing = ship('a', 5, 0.3, 0, 0.5);
    expect(pierce(at(0), at(10), [passing], new Set())).toEqual([]);
    expect(pierce(at(0), at(10), [passing], new Set(), (t) => shotRadius(t.size))).toEqual([passing]);
    expect(orbsInFlight(SHIP_WEAPONS.darkmatter, 0.12, { life: 0.85 })).toBe(5);
    expect(orbsInFlight(SHIP_WEAPONS.darkmatter, 0.12, { shots: 1, life: 0.85 })).toBe(10);
  });
});
