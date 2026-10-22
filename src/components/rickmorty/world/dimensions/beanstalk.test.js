import { describe, expect, it } from 'vitest';
import { BEANSTALK, CASTLE, CLOUD, GOBLIN, beanstalk } from './beanstalk';

// (MORTY's reach in ../rules.js: a step, and the top of a jump; pinned against it with the walker, below)
const CLIMB = 0.3 + 5.4 ** 2 / (2 * 18);
const RADIUS = 0.4;
const { solids, stairs, path, spots, top } = BEANSTALK;
const ledges = solids.filter((s) => s.ledge);
const byId = (id) => solids.find((s) => s.id === id);

// a footprint's outline, sampled, and whether a point is in one (a turned box or a circle), in place metres
const outline = (c, n = 16) => {
  if (c.r != null) return Array.from({ length: 4 * n }, (_, i) => [c.dx + c.r * Math.cos((Math.PI * i) / (2 * n)), c.dz + c.r * Math.sin((Math.PI * i) / (2 * n))]);
  const t = c.turn || 0;
  const out = [];
  for (let i = 0; i <= n; i++)
    for (const [u, v] of [
      [-0.5 + i / n, -0.5],
      [-0.5 + i / n, 0.5],
      [-0.5, -0.5 + i / n],
      [0.5, -0.5 + i / n],
    ]) {
      const lx = u * c.w;
      const lz = v * c.d;
      out.push([c.dx + lx * Math.cos(t) + lz * Math.sin(t), c.dz - lx * Math.sin(t) + lz * Math.cos(t)]);
    }
  return out;
};
const inside = (c, x, z) => {
  if (c.r != null) return Math.hypot(x - c.dx, z - c.dz) < c.r;
  const t = c.turn || 0;
  const dx = x - c.dx;
  const dz = z - c.dz;
  return Math.abs(dx * Math.cos(t) - dz * Math.sin(t)) < c.w / 2 && Math.abs(dx * Math.sin(t) + dz * Math.cos(t)) < c.d / 2;
};
// the gap between two footprints (below zero: they overlap)
const gap = (a, b) => {
  const A = outline(a);
  const B = outline(b);
  if (A.some(([x, z]) => inside(b, x, z)) || B.some(([x, z]) => inside(a, x, z))) return -1;
  let best = Infinity;
  for (const [x, z] of A) for (const [x2, z2] of B) best = Math.min(best, Math.hypot(x - x2, z - z2));
  return best;
};

// Fantasy World's own solids beside the climb (./rows1.js), the privy moved off the stairs' foot
const VILLAGE = [
  { id: 'tavern', dx: -6, dz: -19, w: 11, d: 9 },
  { id: 'well', dx: 5, dz: -1.4, r: 1.1 },
  { id: 'privy', dx: -15.6, dz: -3.5, w: 1.7, d: 1.7 },
  { id: 'giant', dx: 16, dz: -20, r: 2.6 },
  { id: 'cottage-a', dx: -25, dz: -6, w: 7, d: 6 },
  { id: 'cottage-b', dx: -25, dz: 8, w: 7, d: 6 },
  { id: 'cottage-c', dx: 24, dz: 4, w: 7, d: 6 },
];

describe('the beanstalk’s ledges: the Stair Goblins, the landings, the shoots and the crown', () => {
  it('lays the climb out as the plan has it', () => {
    const at = (id) => {
      const s = byId(id);
      return [s.dx, s.dz, s.top].map((v) => +v.toFixed(2));
    };
    expect(path).toEqual(['g1-low', 'g1-mid', 'g1-top', 'landing-1', 'g2-low', 'g2-mid', 'g2-top', 'landing-2', 'g3-low', 'g3-mid', 'g3-top', ...Array.from({ length: 16 }, (_, i) => `shoot-${i + 1}`), 'beanstalk']);
    expect(at('g1-low')).toEqual([-14.3, -8.84, 0.49]);
    expect(at('g1-top')).toEqual([-14.3, -9.69, 1.5]);
    expect(at('landing-1')).toEqual([-14.3, -11.12, 2.3]);
    expect(at('g2-low')).toEqual([-14.3, -12.37, 2.93]);
    expect(at('g2-top')).toEqual([-14.3, -13.45, 4.2]);
    expect(at('landing-2')).toEqual([-14.3, -15.06, 5]);
    expect(at('g3-low')).toEqual([-14.3, -16.46, 5.76]);
    expect(at('g3-top')).toEqual([-14.3, -17.76, 7.3]);
    expect(at('shoot-1')).toEqual([-15.16, -19.34, 8.1]);
    expect(at('shoot-2')).toEqual([-18.11, -19.34, 8.9]);
    expect(at('shoot-6')).toEqual([-22.83, -14.1, 12.1]);
    expect(at('shoot-11')).toEqual([-27.51, -20.91, 16.1]);
    expect(at('shoot-12')).toEqual([-25.7, -19.73, 16.9]);
    expect(at('shoot-16')).toEqual([-21.09, -16.95, 20.1]);
    expect(at('beanstalk')).toEqual([-23, -19, 20.9]);
    expect(byId('beanstalk').r).toBe(1.8);
    expect([byId('landing-1').w, byId('landing-1').d]).toEqual([2.3, 2.4]);
    // (to the centimetre, as the plan's table has them)
    const cm = (v, want) => expect(Math.abs(v - want)).toBeLessThanOrEqual(0.005 + 1e-9);
    cm(byId('shoot-1').w, 4.12);
    cm(byId('shoot-2').w, 2.44);
    cm(byId('shoot-12').w, 2.52);
    expect([byId('shoot-1').d, byId('shoot-2').d, byId('shoot-2').turn, byId('shoot-12').d, byId('shoot-12').turn]).toEqual([2.4, 2.2, 1.641, 2.2, -1.833]);
    // the stalk's tip, up from the crown into the cloud: in the way at any height
    expect(byId('beanstalk-tip')).toEqual({ id: 'beanstalk-tip', dx: -23, dz: -19, r: 0.5 });
    expect(top).toBe(20.9);
    expect(spots).toEqual({ goblins: { dx: -15.8, dz: -7.49 }, giants: { dx: -23, dz: -19, y: 20.9 } });
    // (the same layout every time it's made)
    expect(beanstalk()).toEqual(BEANSTALK);
  });

  it('rises a hop at a time, and only the first stair’s lower treads are in reach from the ground', () => {
    const tops = path.map((id) => byId(id).top);
    const rises = tops.slice(1).map((t, i) => +(t - tops[i]).toFixed(3));
    expect(Math.min(...rises)).toBeGreaterThanOrEqual(0.48);
    expect(Math.max(...rises)).toBeLessThanOrEqual(0.805);
    expect(ledges.filter((l) => l.top <= CLIMB + 1e-9).map((l) => l.id)).toEqual(['g1-low', 'g1-mid']);
    for (const l of ledges) expect(l.ledge, l.id).toBe(true);
  });

  it('touches each next ledge, and offers no hop past the next one', () => {
    for (let i = 1; i < path.length; i++) expect(gap(byId(path[i - 1]), byId(path[i])), `${path[i - 1]} to ${path[i]}`).toBeLessThanOrEqual(0.05);
    const order = new Map(path.map((id, i) => [id, i]));
    const stairOf = (id) => stairs.find((s) => s.steps.includes(id))?.id ?? null;
    const skips = [];
    for (const a of ledges)
      for (const b of ledges) {
        const rise = b.top - a.top;
        if (rise <= 0 || rise > CLIMB + 1e-9 || order.get(b.id) === order.get(a.id) + 1) continue;
        // (a stair's treads skip each other: it's one stair)
        if (stairOf(a.id) && stairOf(a.id) === stairOf(b.id)) continue;
        if (gap(a, b) < 1.5) skips.push(`${a.id} to ${b.id}`);
      }
    expect(skips).toEqual([]);
  });

  it('can’t be climbed without going up every Stair Goblin', () => {
    // from the ground, up what's in reach (a rise no more than CLIMB, a gap no more than 3 m), down anything
    const reaches = (without) => {
      const open = ledges.filter((l) => !without.includes(l.id));
      const seen = new Set(open.filter((l) => l.top <= CLIMB + 1e-9).map((l) => l.id));
      const todo = [...seen];
      while (todo.length) {
        const a = byId(todo.pop());
        for (const b of open) if (!seen.has(b.id) && b.top - a.top <= CLIMB + 1e-9 && gap(a, b) <= 3) todo.push(seen.add(b.id) && b.id);
      }
      return seen.has('beanstalk');
    };
    expect(reaches([])).toBe(true);
    for (const s of stairs) expect(reaches(s.steps), s.id).toBe(false);
  });

  it('cuts each goblin’s treads to the model’s own three steps', () => {
    expect(stairs.map((s) => [s.id, s.h, s.base])).toEqual([
      ['g1', 1.5, 0],
      ['g2', 1.9, 2.3],
      ['g3', 2.3, 5],
    ]);
    for (const s of stairs) {
      expect(s.steps).toEqual(['low', 'mid', 'top'].map((n) => `${s.id}-${n}`));
      GOBLIN.treads.forEach(([name, from, to, share]) => {
        const t = byId(`${s.id}-${name}`);
        expect(t.top, t.id).toBeCloseTo(s.base + share * s.h, 2);
        expect(t.w, t.id).toBeCloseTo(GOBLIN.wide * s.h, 2);
        expect(t.d, t.id).toBeCloseTo((to - from) * GOBLIN.len * s.h, 2);
        // (from the goblin's back, which faces the beanstalk: north)
        expect(t.dz, t.id).toBeCloseTo(s.back + ((from + to) / 2) * GOBLIN.len * s.h, 2);
      });
    }
  });

  it('stands inside the box and clear of the village', () => {
    for (const l of ledges)
      for (const [x, z] of outline(l)) {
        expect(Math.abs(x), l.id).toBeLessThan(35 - RADIUS);
        expect(Math.abs(z), l.id).toBeLessThan(25 - RADIUS);
      }
    for (const l of ledges) for (const v of VILLAGE) expect(gap(l, v), `${l.id} by ${v.id}`).toBeGreaterThanOrEqual(0.9);
  });

  it('puts the crown level with the giants’ cloud, inside its disc, with the castle beyond', () => {
    const crown = byId('beanstalk');
    expect(crown.top).toBe(+(CLOUD.y + 0.45 * CLOUD.h).toFixed(2));
    // (the cloud's south rim reaches 0.6 m into the crown: he steps off the stalk onto its edge)
    const r = Math.min(CLOUD.w, CLOUD.d) / 2;
    const off = Math.hypot(crown.dx - CLOUD.at[0], crown.dz - CLOUD.at[1]);
    expect(crown.r - (off - r)).toBeCloseTo(0.6, 2);
    // (both up out of the box's way, as the worlds' rule has a landmark over 20 m)
    expect(CLOUD.y).toBeGreaterThanOrEqual(20);
    expect(CASTLE.y).toBeGreaterThanOrEqual(20);
    // the castle north of the crown, clear of Morty standing on it
    expect(CASTLE.at[1] + CASTLE.d / 2).toBeLessThan(crown.dz - crown.r - RADIUS);
  });

  it('keeps the shoots under the cloud clear of its underside, with room for the camera', () => {
    const r = Math.min(CLOUD.w, CLOUD.d) / 2;
    const underside = CLOUD.y - 0.1 * CLOUD.h;
    const under = ledges.filter((l) => l.id !== 'beanstalk' && outline(l).some(([x, z]) => Math.hypot(x - CLOUD.at[0], z - CLOUD.at[1]) < r));
    expect(under.map((l) => l.id)).toEqual(['shoot-11', 'shoot-12']);
    for (const l of under) expect(l.top + 2.75, l.id).toBeLessThanOrEqual(underside);
  });
});
