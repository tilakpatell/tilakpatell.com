import { describe, expect, it } from 'vitest';
import { AREAS, HOTSPOTS, MORTY, PEOPLE, START, TASKS, canLand, floorAt, newCruiser, solidIn, wallsIn } from '../rules';
import { SAY } from '../say';
import { TOWN_ROOFS, TOWN_TASKS, BACK, BANDSTAND, CROSS, LIGHTS, LOT, LOT_CARS, PARK, POND, POSTERS, ROADS, SHOPS, SHOPS_BLOCK, SIGNS, SKIP_AT, STATUE, TOWN, TOWN_HOUSES, TOWN_SOLIDS, TOWN_TREES, WATER_TOWER, inPond, onRoad, treeFitsTown } from './plan';

const overlap = (a, b, gap = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap;
const within = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

// Where Morty can get to on foot from where he starts: a flood over half-metre
// squares, a square open if he'd fit there (his radius clear of everything
// solid and every fence), the solids sorted into 8 m buckets so it's quick.
function reach() {
  const S = 0.5;
  const R = MORTY.radius;
  const B = 8;
  const buckets = new Map();
  const put = (key, o) => (buckets.get(key) ?? buckets.set(key, []).get(key)).push(o);
  const extent = (o) => (o.kind === 'circle' ? o.r : Math.hypot(o.w, o.d) / 2) + R;
  for (const o of solidIn('street')) {
    const e = extent(o);
    for (let i = Math.floor((o.x - e) / B); i <= Math.floor((o.x + e) / B); i++) for (let j = Math.floor((o.z - e) / B); j <= Math.floor((o.z + e) / B); j++) put(`${i},${j}`, o);
  }
  const walls = wallsIn('street');
  const seg = (px, pz, [x0, z0, x1, z1]) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
  };
  const hits = (o, x, z) => {
    if (o.kind === 'circle') return Math.hypot(x - o.x, z - o.z) < o.r + R;
    const t = o.turn || 0;
    const dx = x - o.x;
    const dz = z - o.z;
    const lx = dx * Math.cos(t) - dz * Math.sin(t);
    const lz = dx * Math.sin(t) + dz * Math.cos(t);
    return Math.abs(lx) < o.w / 2 + R && Math.abs(lz) < o.d / 2 + R;
  };
  const A = AREAS.street;
  const free = (x, z) => x > A.x0 + R && x < A.x1 - R && z > A.z0 + R && z < A.z1 - R && !(buckets.get(`${Math.floor(x / B)},${Math.floor(z / B)}`) ?? []).some((o) => hits(o, x, z)) && !walls.some((w) => seg(x, z, w) < R);
  const seen = new Set();
  const key = (i, j) => i * 100000 + j;
  const queue = [[Math.round(START.x / S), Math.round(START.z / S)]];
  seen.add(key(...queue[0]));
  for (let q = 0; q < queue.length; q++) {
    const [i, j] = queue[q];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k) || !free((i + di) * S, (j + dj) * S)) continue;
      seen.add(k);
      queue.push([i + di, j + dj]);
    }
  }
  // (near enough: an open square within `r` of the point)
  return (x, z, r = 1.2) => {
    for (let i = Math.floor((x - r) / S); i <= Math.ceil((x + r) / S); i++) for (let j = Math.floor((z - r) / S); j <= Math.ceil((z + r) / S); j++) if (seen.has(key(i, j)) && Math.hypot(i * S - x, j * S - z) <= r) return true;
    return false;
  };
}
const reachable = reach();

describe('the town round the street', () => {
  it('is the street now, out to its hedges, with the main road as it was', () => {
    expect(AREAS.street).toBe(TOWN);
    expect(TOWN).toEqual({ x0: -150, x1: 150, z0: -150, z1: 150 });
    // (the cross roads stop at the main road's sidewalk; the back roads run hedge to hedge and on)
    for (const r of ROADS) expect(r.z1 <= -7 || r.z0 >= 7 || Math.abs(r.z1 - r.z0) < 13, r.id).toBe(true);
    for (const c of CROSS) for (const b of BACK) expect(onRoad(c, b), `${c}, ${b}`).toBe(true);
    expect(onRoad(0, 0)).toBe(false); // (the main road is rules.js's)
  });

  it('puts every house, shop and car where nothing else is, off the roads and inside the hedges', () => {
    const all = [...TOWN_HOUSES, ...SHOPS, ...LOT_CARS];
    for (const [i, a] of all.entries()) {
      expect(within({ x0: TOWN.x0 + 1, x1: TOWN.x1 - 1, z0: TOWN.z0 + 1, z1: TOWN.z1 - 1 }, a.x - a.w / 2, a.z - a.d / 2) && within(TOWN, a.x + a.w / 2, a.z + a.d / 2), a.id).toBe(true);
      for (const b of all.slice(i + 1)) expect(overlap(a, b, 1), `${a.id} and ${b.id}`).toBe(false);
      for (let x = a.x - a.w / 2; x <= a.x + a.w / 2; x += 1) for (let z = a.z - a.d / 2; z <= a.z + a.d / 2; z += 1) expect(onRoad(x, z), `${a.id} on a road at ${x}, ${z}`).toBe(false);
    }
    expect(TOWN_HOUSES.length).toBeGreaterThan(50);
  });

  it('gives every house a drive from its front to the sidewalk, and every house faces its road', () => {
    for (const h of TOWN_HOUSES) {
      const d = h.drive;
      // (it touches a sidewalk at one end and the house's front at the other)
      const ends = [
        [d.x0, (d.z0 + d.z1) / 2],
        [d.x1, (d.z0 + d.z1) / 2],
        [(d.x0 + d.x1) / 2, d.z0],
        [(d.x0 + d.x1) / 2, d.z1],
      ];
      expect(ends.some(([x, z]) => onRoad(x, z, 0.05)), `${h.id}'s drive reaches the sidewalk`).toBe(true);
      expect(Math.min(...ends.map(([x, z]) => Math.hypot(Math.max(Math.abs(x - h.x) - h.w / 2, 0), Math.max(Math.abs(z - h.z) - h.d / 2, 0)))), `${h.id}'s drive reaches its front`).toBeLessThan(0.05);
      // a house's front (turn 0 faces +z) looks at the drive
      const fx = Math.sin(h.turn);
      const fz = Math.cos(h.turn);
      expect(((d.x0 + d.x1) / 2 - h.x) * fx + ((d.z0 + d.z1) / 2 - h.z) * fz, h.id).toBeGreaterThan(0);
    }
  });

  it('lays the park and the shops out in their blocks', () => {
    for (const p of [POND, BANDSTAND, STATUE]) expect(within(PARK, p.x, p.z)).toBe(true);
    expect(within(PARK, POND.x - POND.rx, POND.z - POND.rz) && within(PARK, POND.x + POND.rx, POND.z + POND.rz)).toBe(true);
    for (const s of SHOPS) expect(within(SHOPS_BLOCK, s.x - s.w / 2, s.z - s.d / 2) && within(SHOPS_BLOCK, s.x + s.w / 2, s.z + s.d / 2), s.id).toBe(true);
    for (const c of LOT_CARS) expect(within(LOT, c.x, c.z), c.id).toBe(true);
    expect(within(SHOPS_BLOCK, WATER_TOWER.x, WATER_TOWER.z)).toBe(true);
    // the shops' fronts face the back road, with room to stand in front of them
    for (const s of SHOPS) expect(s.front - Math.max(...BACK) >= 6 + 3, s.id).toBe(true);
    expect(inPond(POND.x, POND.z)).toBe(true);
    expect(inPond(POND.x + POND.rx + 0.5, POND.z)).toBe(false);
  });

  it('stands the street lights and the stop signs on sidewalks', () => {
    expect(LIGHTS.length).toBeGreaterThan(24);
    for (const l of [...LIGHTS, ...SIGNS]) {
      const r = ROADS.find((o) => l.x >= o.x0 && l.x <= o.x1 && l.z >= o.z0 && l.z <= o.z1);
      expect(r?.kind ?? (Math.abs(l.z) <= 7 && Math.abs(l.z) >= 5 ? 'walk' : null), l.id).toBe('walk');
    }
  });

  it('plants its trees clear of everything', () => {
    expect(TOWN_TREES.length).toBeGreaterThan(80);
    for (const t of TOWN_TREES) expect(treeFitsTown(t.x, t.z), `${t.x}, ${t.z}`).toBe(true);
  });

  it('can all be walked to from where Morty starts: every drive, the shops’ doors, the park, the posters and the pond’s shore', () => {
    for (const h of TOWN_HOUSES) expect(reachable((h.drive.x0 + h.drive.x1) / 2, (h.drive.z0 + h.drive.z1) / 2, 2), h.id).toBe(true);
    for (const s of SHOPS) expect(reachable(s.x, s.front - 1.5), s.id).toBe(true);
    for (const p of POSTERS) expect(reachable(p.x, p.z), p.id).toBe(true);
    expect(reachable(SKIP_AT.x, SKIP_AT.z)).toBe(true);
    expect(reachable(BANDSTAND.x, BANDSTAND.z - BANDSTAND.r - 1)).toBe(true);
    expect(reachable(STATUE.x - 2.5, STATUE.z)).toBe(true);
    expect(reachable(WATER_TOWER.x, WATER_TOWER.z - WATER_TOWER.r - 2)).toBe(true);
    // every hotspot of the town's, where Morty's within its reach of it
    for (const h of HOTSPOTS.filter((o) => o.town)) expect(reachable(h.x, h.z, h.r - 0.1), h.id).toBe(true);
        // (the pond itself isn't)
    expect(reachable(POND.x, POND.z, 0.5)).toBe(false);
  });

  it('keeps its solids plain shapes with ids of their own', () => {
    const ids = TOWN_SOLIDS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of TOWN_SOLIDS) expect(o.kind === 'box' ? o.w > 0 && o.d > 0 : o.r > 0, o.id).toBe(true);
  });

  it('has a word for everything to touch, but the pond, whose stone does the talking', () => {
    const spots = HOTSPOTS.filter((h) => h.town);
    expect(spots.length).toBeGreaterThan(12);
    for (const h of spots) {
      expect(h.area).toBe('street');
      if (h.id === 'pond') expect(SAY[h.id]).toBeUndefined();
      else expect(SAY[h.id]?.text, h.id).toBeTruthy();
    }
    expect(new Set(spots.map((h) => h.id)).size).toBe(spots.length);
  });

  it('adds its things to do on the end of the list, where a save can’t mind them', () => {
    expect(TASKS.slice(-TOWN_TASKS.length)).toEqual(TOWN_TASKS);
    for (const t of TOWN_TASKS) expect(t.name && t.hint, t.id).toBeTruthy();
  });

  it('walks its people along lines that cross nothing solid, and stands its agent where he’s talked to', () => {
    const solids = solidIn('street');
    const blocked = (x, z) => solids.some((o) => (o.kind === 'circle' ? Math.hypot(x - o.x, z - o.z) < o.r + 0.3 : Math.abs(x - o.x) < o.w / 2 + 0.3 && Math.abs(z - o.z) < o.d / 2 + 0.3));
    for (const p of PEOPLE.filter((o) => o.town && o.ai)) {
      const pts = p.ai.wander;
      for (let i = 0; i < pts.length; i++) {
        const [x0, z0] = pts[i];
        const [x1, z1] = pts[(i + 1) % pts.length];
        const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25);
        for (let k = 0; k <= n; k++) expect(blocked(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n), `${p.id} leg ${i}`).toBe(false);
      }
      for (const line of p.ai.bark.lines) expect(line).not.toMatch(/'/);
    }
    const agent = PEOPLE.find((o) => o.id === 'cinemaagent');
    const h = HOTSPOTS.find((o) => o.id === 'cinemaagent');
    expect(Math.hypot(agent.x - h.x, agent.z - h.z)).toBeLessThan(h.r + 0.3);
  });

  it('stands its roofs in the cruiser’s way: it flies over them, and never sets down on one', () => {
    for (const r of TOWN_ROOFS) {
      expect(floorAt(r.x, r.z), r.id).toBeGreaterThanOrEqual(r.roof + 2);
      expect(canLand({ ...newCruiser(), x: r.x, z: r.z }), r.id).toBe(false);
    }
    // (the park's open lawn is somewhere to land)
    expect(canLand({ ...newCruiser(), x: -50, z: -88 })).toBe(true);
  });
});
