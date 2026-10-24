import { describe, expect, it } from 'vitest';
import { CLAY_TOWERS, TOWERS, claytowers } from './claytowers';
import { destinationById } from './destinations';
import { CLIMB, COLLIDERS, MORTY, nearHotspot, newMorty, solidIn, stepMorty } from '../rules';
import { standingOn } from '../games/climb';

const { solids, stairs, paths, spots } = CLAY_TOWERS;
const byId = (id) => solids.find((s) => s.id === id);
const ledges = solids.filter((s) => s.ledge);
// two circles' gap (below zero: they overlap)
const gap = (a, b) => Math.hypot(a.dx - b.dx, a.dz - b.dz) - a.r - b.r;
const bearing = (t, c) => (Math.atan2(c.dz - t.dz, c.dx - t.dx) * 180) / Math.PI;

// Bird World's other solids beside the towers (./rows1.js)
const CLEARING = [
  { id: 'house', dx: 0, dz: -16, r: 4 },
  { id: 'tree-a', dx: -16, dz: 10, r: 1.2 },
  { id: 'tree-b', dx: 18, dz: 6, r: 1.2 },
  { id: 'crystals', dx: -12, dz: 6, r: 1.2 },
];

describe('Bird World’s clay towers: a flight of drums round each, and its top', () => {
  it('lays each tower out as the plan has it', () => {
    expect(TOWERS.map((t) => t.id)).toEqual(['tower-a', 'tower-b']);
    expect(paths['tower-a']).toEqual([...Array.from({ length: 9 }, (_, i) => `tower-a-${i + 1}`), 'tower-a']);
    expect(paths['tower-b']).toEqual([...Array.from({ length: 11 }, (_, i) => `tower-b-${i + 1}`), 'tower-b']);
    expect(byId('tower-a')).toEqual({ id: 'tower-a', dx: -22, dz: -15, r: 2, top: 8, ledge: true });
    expect(byId('tower-b')).toEqual({ id: 'tower-b', dx: 20, dz: -17, r: 2.2, top: 9.6, ledge: true });
    // the trunks the towers are grown round, up through their tops: in the way at any height
    expect(byId('tower-a-trunk')).toEqual({ id: 'tower-a-trunk', dx: -22, dz: -15, r: 0.4 });
    expect(byId('tower-b-trunk')).toEqual({ id: 'tower-b-trunk', dx: 20, dz: -17, r: 0.4 });
    // each drum a column from the ground, on its tower's ring, a step round from the last
    for (const t of TOWERS)
      paths[t.id].slice(0, -1).forEach((id, k) => {
        const d = byId(id);
        expect(d, id).toMatchObject({ r: 0.9, top: +(0.8 * (k + 1)).toFixed(3), ledge: true });
        expect(Math.hypot(d.dx - t.dx, d.dz - t.dz), id).toBeCloseTo(t.ring, 2);
        const want = t.from + t.turn * k * t.step;
        expect(Math.abs(((bearing(t, d) - want + 540) % 360) - 180), id).toBeLessThan(0.1);
      });
    expect(stairs).toEqual([
      { id: 'crumble-a', steps: ['tower-a-3', 'tower-a-4', 'tower-a-5'] },
      { id: 'crumble-b', steps: ['tower-b-3', 'tower-b-4', 'tower-b-5'] },
    ]);
    // (the same layout every time it's made)
    expect(claytowers()).toEqual(CLAY_TOWERS);
  });

  it('rises a hop at a time, and only each tower’s first drum is in reach from the ground', () => {
    for (const path of Object.values(paths)) {
      const tops = path.map((id) => byId(id).top);
      for (let i = 1; i < tops.length; i++) expect(+(tops[i] - tops[i - 1]).toFixed(3)).toBe(0.8);
    }
    expect(ledges.filter((l) => l.top <= CLIMB + 1e-9).map((l) => l.id)).toEqual(['tower-a-1', 'tower-b-1']);
  });

  it('touches each next drum, and offers no hop past the next one', () => {
    for (const path of Object.values(paths)) for (let i = 1; i < path.length; i++) expect(gap(byId(path[i - 1]), byId(path[i])), path[i]).toBeLessThan(0);
    const next = new Map(Object.values(paths).flatMap((p) => p.slice(0, -1).map((id, i) => [id, p[i + 1]])));
    const skips = [];
    for (const a of ledges)
      for (const b of ledges) {
        const rise = b.top - a.top;
        if (rise <= 0 || rise > CLIMB + 1e-9 || next.get(a.id) === b.id) continue;
        if (gap(a, b) < 1.5) skips.push(`${a.id} to ${b.id}`);
      }
    expect(skips).toEqual([]);
  });

  it('can’t be climbed to either top without going up its crumbling stair', () => {
    const reaches = (top, without) => {
      const open = ledges.filter((l) => !without.includes(l.id));
      const seen = new Set(open.filter((l) => l.top <= CLIMB + 1e-9).map((l) => l.id));
      const todo = [...seen];
      while (todo.length) {
        const a = byId(todo.pop());
        for (const b of open) if (!seen.has(b.id) && b.top - a.top <= CLIMB + 1e-9 && gap(a, b) <= 1.5) todo.push(seen.add(b.id) && b.id);
      }
      return seen.has(top);
    };
    for (const [t, s] of [
      ['tower-a', 'crumble-a'],
      ['tower-b', 'crumble-b'],
    ]) {
      expect(reaches(t, []), t).toBe(true);
      expect(reaches(t, stairs.find((x) => x.id === s).steps), t).toBe(false);
    }
  });

  it('winds each flight less than once round its tower, inside the box and clear of the clearing’s solids', () => {
    for (const t of TOWERS) expect((t.drums - 1) * t.step).toBeLessThan(360);
    for (const s of solids) {
      expect(Math.abs(s.dx) + s.r, s.id).toBeLessThanOrEqual(35);
      expect(Math.abs(s.dz) + s.r, s.id).toBeLessThanOrEqual(25);
      for (const c of CLEARING) expect(gap(s, c), `${s.id} and ${c.id}`).toBeGreaterThan(2 * MORTY.radius);
    }
  });

  it('puts a crystal on each top, a metre off its trunk toward the last drum, out of reach from off it', () => {
    expect(Object.keys(spots)).toEqual(['bcrystal-west', 'bcrystal-east']);
    for (const [id, t, last] of [
      ['bcrystal-west', byId('tower-a'), byId('tower-a-9')],
      ['bcrystal-east', byId('tower-b'), byId('tower-b-11')],
    ]) {
      const c = spots[id];
      expect(c.y, id).toBe(t.top);
      expect(Math.hypot(c.dx - t.dx, c.dz - t.dz), id).toBeCloseTo(1, 2);
      expect(Math.abs(((bearing(t, c) - bearing(t, last) + 540) % 360) - 180), id).toBeLessThan(0.5);
      // (off the top, the tower's own column keeps him its radius and his own from its middle: a picking reach of 1 m falls short)
      expect(t.r + MORTY.radius - 1, id).toBeGreaterThan(1);
      // (and on it, clear of the trunk, it's in reach)
      expect(1 - (0.4 + MORTY.radius), id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the clay towers on the walker', () => {
  const b = destinationById('birdworld');
  const A = 'birdworld';
  const DT = 1 / 60;
  const ledge = (id) => b.solids.find((o) => o.id === id);
  const onIt = (m, c) => !m.air && Math.abs(m.y - c.top) < 1e-3 && standingOn([c], m) === c.id;
  const crystal = (t) => b.hotspots.find((h) => h.id === t.crystal);
  // (a crystal Morty's near enough to pick up there, the task not done)
  const picks = (m) => nearHotspot(A, m.x, m.z, [])?.id;

  it('has the drums and tops in the walker’s solids with their tops, and the trunks in its way', () => {
    const ids = new Set(ledges.map((s) => s.id));
    const walls = new Set(solidIn(A).map((c) => c.id));
    for (const c of COLLIDERS.birdworld.filter((o) => ids.has(o.id))) {
      expect(c, c.id).toMatchObject({ top: byId(c.id).top, ledge: true });
      expect(walls.has(c.id), c.id).toBe(false);
    }
    expect(COLLIDERS.birdworld.filter((o) => ids.has(o.id))).toHaveLength(ids.size);
    for (const t of TOWERS) expect(walls.has(`${t.id}-trunk`), t.id).toBe(true);
  });

  it('is climbed by a runner who aims for each drum in turn, to the crystal on each top', () => {
    for (const dt of [DT, 0.05])
      for (const t of TOWERS) {
        const legs = paths[t.id].map(ledge);
        // (from the ground a few metres out past the first drum)
        const first = legs[0];
        const ox = first.x - ledge(t.id).x;
        const oz = first.z - ledge(t.id).z;
        const k = 3 / Math.hypot(ox, oz);
        let m = newMorty({ x: first.x + ox * k, z: first.z + oz * k, face: 0 });
        let time = 0;
        for (const c of legs) {
          // (the last leg: across the top to its crystal, clear of the trunk)
          const a = c.id === t.id ? crystal(t) : c;
          for (let s = 0; s < 4 && !onIt(m, c); s += dt, time += dt) {
            const dx = a.x - m.x;
            const dz = a.z - m.z;
            const d = Math.hypot(dx, dz) || 1;
            m = stepMorty(m, { x: dx / d, z: dz / d, jump: !m.air && c.top - m.y > MORTY.step && d < 2.6 }, dt, A);
          }
          expect(onIt(m, c), `${c.id} at dt ${dt} (y ${m.y.toFixed(2)})`).toBe(true);
        }
        const c = crystal(t);
        for (let s = 0; s < 2 && Math.hypot(c.x - m.x, c.z - m.z) > 0.3; s += dt) {
          const dx = c.x - m.x;
          const dz = c.z - m.z;
          const d = Math.hypot(dx, dz) || 1;
          m = stepMorty(m, { x: dx / d, z: dz / d }, dt, A);
        }
        expect(m.y, t.id).toBeCloseTo(ledge(t.id).top, 6);
        expect(picks(m), t.id).toBe(t.crystal);
        expect(time, t.id).toBeLessThan(20);
      }
  });

  it('holds him on a top, and keeps each top’s crystal out of reach from every drum and the ground', () => {
    for (const t of TOWERS) {
      const top = ledge(t.id);
      let m = { ...newMorty({ x: crystal(t).x, z: crystal(t).z }), y: top.top };
      for (let s = 0; s < 1; s += DT) m = stepMorty(m, {}, DT, A);
      expect(m, t.id).toMatchObject({ y: top.top, air: false });
      // from every drum, walked at the crystal (no hop) till he stops or falls: never near enough to pick it up
      for (const id of paths[t.id].slice(0, -1)) {
        const c = ledge(id);
        let w = stepMorty({ ...newMorty({ x: c.x, z: c.z }), y: c.top }, {}, DT, A);
        for (let s = 0; s < 3; s += DT) {
          const dx = crystal(t).x - w.x;
          const dz = crystal(t).z - w.z;
          const d = Math.hypot(dx, dz) || 1;
          w = stepMorty(w, { x: dx / d, z: dz / d, run: true }, DT, A);
          expect(picks(w), `${t.id} from ${id}`).not.toBe(t.crystal);
        }
      }
      // and round the tower on the ground, pressed in at it
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * 2 * Math.PI;
        let g = newMorty({ x: top.x + 6 * Math.cos(a), z: top.z + 6 * Math.sin(a) });
        for (let s = 0; s < 3; s += DT) g = stepMorty(g, { x: -Math.cos(a), z: -Math.sin(a), run: true }, DT, A);
        expect(picks(g), `${t.id} from the ground at ${i}`).not.toBe(t.crystal);
      }
    }
  });

  it('leaves no ground cut off by the towers: all of it is reached from the way in', () => {
    const area = b.area;
    const S = 0.5;
    const nx = Math.round((area.x1 - area.x0) / S);
    const nz = Math.round((area.z1 - area.z0) / S);
    const all = [...solidIn(A), ...b.solids.filter((o) => o.ledge)];
    // (within a body's width of a solid or a ledge: the ground there is out of his reach)
    const near = (c, x, z) => (c.r != null ? Math.hypot(x - c.x, z - c.z) < c.r + MORTY.radius : Math.abs(x - c.x) < c.w / 2 + MORTY.radius && Math.abs(z - c.z) < c.d / 2 + MORTY.radius);
    const free = (x, z) => x > area.x0 + 0.4 && x < area.x1 - 0.4 && z > area.z0 + 0.4 && z < area.z1 - 0.4 && !all.some((c) => near(c, x, z));
    const grid = new Uint8Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) grid[i * nz + j] = free(area.x0 + (i + 0.5) * S, area.z0 + (j + 0.5) * S) ? 1 : 0;
    const start = Math.floor((b.arrive.x - area.x0) / S) * nz + Math.floor((b.arrive.z - area.z0) / S);
    const seen = new Uint8Array(nx * nz);
    const todo = [start];
    seen[start] = 1;
    while (todo.length) {
      const k = todo.pop();
      const i = Math.floor(k / nz);
      const j = k % nz;
      for (const [u, v] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + u;
        const jj = j + v;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const q = ii * nz + jj;
        if (grid[q] && !seen[q]) {
          seen[q] = 1;
          todo.push(q);
        }
      }
    }
    const cut = [];
    for (let k = 0; k < nx * nz; k++) if (grid[k] && !seen[k]) cut.push(k);
    expect(grid.reduce((a, v) => a + v, 0)).toBeGreaterThan(10000);
    expect(cut).toEqual([]);
  });
});
