import { describe, expect, it, vi } from 'vitest';
import { pushOut } from '../../middleearth/towns/walker';
import { DESTINATIONS } from './dimensions/destinations';
import { TOWN_TASKS } from './town/plan';
import { createPress } from '../../../lib/press';
import {
  AREAS,
  ARCADE,
  BANISTER,
  BOARD,
  BUILDINGS,
  COLLIDERS,
  CRUISER,
  DECOR,
  DINER,
  DRIVEWAY,
  GOV_PORTAL,
  FENCES,
  FRONT_WALK,
  FURNITURE,
  GARAGE,
  HATCH,
  HOTSPOTS,
  HOUSE,
  HOUSE_GARAGE,
  HOUSE_PARTS,
  HOUSE_SPOTS,
  INNER_WALLS,
  LIMO,
  LINKS,
  MEMORIES,
  MEMORY_COLORS,
  MORTY,
  MOTORCADE,
  NEIGHBOURS,
  WONG_HOUSE,
  VEHICLES,
  OUTDOOR,
  PEOPLE,
  PLAN,
  QUIZ,
  RINGS,
  ROAD,
  ROOM_IDS,
  RUGS,
  SCHOOL,
  SCHOOL_PARTS,
  START,
  TASKS,
  TREES,
  WALLS,
  YARDS,
  areaAt,
  canLand,
  collidersIn,
  solidIn,
  supportAt,
  CLIMB,
  CEILING,
  STOOP,
  standable,
  FLY,
  OUTSKIRTS,
  dropAt,
  exitCruiser,
  floorAt,
  grade,
  inArea,
  linkOpen,
  nearHotspot,
  nearLink,
  newCruiser,
  newMorty,
  peopleIn,
  present,
  progress,
  ringWalls,
  stepCruiser,
  cruiserOf,
  stepMorty,
  wallsIn,
} from './rules';

const DT = 1 / 60;
const link = (id) => LINKS.find((l) => l.id === id);
const centre = (a) => ({ x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2 });
const street = [...BUILDINGS];

// is a Morty-sized circle at (x, z) standing in the area, clear of everything in it?
// (pushOut cannot tell which way to push a point exactly on a wall, so that is not clear)
// (`opts`: collidersIn's, the motorcade in the street or not)
const free = (area, x, z, rad = MORTY.radius, opts) => {
  if (!inArea(area, x, z, -rad)) return false;
  if (wallsIn(area).some((w) => segDist(x, z, w) < 1e-6)) return false;
  // (what's low enough to get up onto is somewhere to stand)
  const [px, pz] = pushOut(x, z, rad, solidIn(area, opts), wallsIn(area));
  return Math.hypot(px - x, pz - z) < 1e-6;
};

// Every spot Morty can walk to from a, over half-metre squares (stopping early
// if `stop(x, z)` says so)
function flood(area, a, stop = () => false, opts) {
  const S = 0.5;
  const key = (i, j) => `${i},${j}`;
  const cells = [];
  const seen = new Set([key(0, 0)]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [i, j] = queue.shift();
    const x = a.x + i * S;
    const z = a.z + j * S;
    cells.push({ x, z });
    if (stop(x, z)) return { cells, hit: true };
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k)) continue;
      seen.add(k);
      if (free(area, a.x + (i + di) * S, a.z + (j + dj) * S, MORTY.radius, opts)) queue.push([i + di, j + dj]);
    }
  }
  return { cells, hit: false };
}
// can Morty walk from a to b (to within `r` of it)?
const canWalk = (area, a, b, r, opts) => flood(area, a, (x, z) => Math.hypot(x - b.x, z - b.z) < r, opts).hit;
const inRoom = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
// where a room is first walked into, and out of
const WAY_IN = { house: 'house-door', upstairs: 'stairs-up', garage: 'garage-door', school: 'school-door', arcade: 'arcade-door', basement: 'garage-hatch', mindblowers: 'basement-mind', oval: 'garage-oval', diner: 'diner-door', wong: 'wong-door' };
const WAY_OUT = { house: 'front', upstairs: 'stairs-down', garage: 'garage-exit', school: 'school-exit', arcade: 'arcade-exit', basement: 'basement-ladder', mindblowers: 'mind-door', oval: 'oval-portal', diner: 'diner-exit', wong: 'wong-exit' };
const startOf = (area) => (area === 'street' ? START : DEST.has(area) ? DESTINATIONS.find((d) => d.id === area).arrive : link(WAY_IN[area]).arrive);
// the doorways between the rooms of the plan, by pair
const DOORS = {
  house: [['kitchen', 'dining'], ['kitchen', 'living'], ['living', 'dining'], ['living', 'den'], ['dining', 'entry'], ['entry', 'hall'], ['hall', 'den'], ['hall', 'rickroom']],
  upstairs: [['summer', 'upHall'], ['morty', 'upHall'], ['master', 'upHall'], ['master', 'balcony']],
};

// how near a point is to a box footprint (0 inside it)
const boxDist = (b, x, z) => Math.hypot(Math.max(Math.abs(x - b.x) - b.w / 2, 0), Math.max(Math.abs(z - b.z) - b.d / 2, 0));
const segDist = (px, pz, [x0, z0, x1, z1]) => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
};
// the line two rooms share, if they touch along one
const shared = (a, b) => {
  const ox = [Math.max(a.x0, b.x0), Math.min(a.x1, b.x1)];
  const oz = [Math.max(a.z0, b.z0), Math.min(a.z1, b.z1)];
  if (ox[0] === ox[1] && oz[0] < oz[1]) return { axis: 'x', at: ox[0], from: oz[0], to: oz[1] };
  if (oz[0] === oz[1] && ox[0] < ox[1]) return { axis: 'z', at: oz[0], from: ox[0], to: ox[1] };
  return null;
};
// the open stretches of a line, between the wall pieces laid on it, as [from, to]
const gapsAt = (walls, { axis, at, from, to }) => {
  const runs = walls
    .filter(([x0, z0, x1, z1]) => (axis === 'x' ? x0 === at && x1 === at : z0 === at && z1 === at))
    .map(([x0, z0, x1, z1]) => (axis === 'x' ? [Math.min(z0, z1), Math.max(z0, z1)] : [Math.min(x0, x1), Math.max(x0, x1)]))
    .sort((p, q) => p[0] - q[0]);
  const gaps = [];
  let at0 = from;
  for (const [a, b] of runs) {
    if (at0 >= to) break;
    if (a > at0) gaps.push([at0, Math.min(a, to)]);
    at0 = Math.max(at0, b);
  }
  if (to > at0) gaps.push([at0, to]);
  return gaps;
};
// how wide each is
const openings = (walls, line) => gapsAt(walls, line).map(([a, b]) => b - a);
// can Morty stand somewhere on the line?
const stands = (area, { axis, at, from, to }) => {
  for (let t = from; t <= to; t += 0.05) if (free(area, axis === 'x' ? at : t, axis === 'x' ? t : at)) return true;
  return false;
};
// how near a point is to a piece of furniture, turned as it is (0 inside it)
const pieceDist = (f, x, z) => {
  const dx = x - f.x;
  const dz = z - f.z;
  const lx = dx * Math.cos(f.turn) - dz * Math.sin(f.turn);
  const lz = dx * Math.sin(f.turn) + dz * Math.cos(f.turn);
  return Math.hypot(Math.max(Math.abs(lx) - f.w / 2, 0), Math.max(Math.abs(lz) - f.d / 2, 0));
};
// do the segments a-b and c-d cross?
const crosses = (ax, az, bx, bz, [cx, cz, dx, dz]) => {
  const side = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  return side(ax, az, bx, bz, cx, cz) * side(ax, az, bx, bz, dx, dz) < 0 && side(cx, cz, dx, dz, ax, az) * side(cx, cz, dx, dz, bx, bz) < 0;
};

const walk = (m, move, seconds, area = 'street', opts) => {
  for (let t = 0; t < seconds; t += DT) m = stepMorty(m, move, DT, area, opts);
  return m;
};

// the built-in world, without the multiverse's destinations (./dimensions/destinations.test.js has those)
const DEST = new Set(DESTINATIONS.map((d) => d.id));
// (the rooms' own cast: not a destination's, not the street's walkers, who
// roam and have no hotspot, and not the town round the street's, which
// ./town/plan.test.js has)
const builtIn = (list) => list.filter((o) => !DEST.has(o.area) && !o.roams && !o.town);

describe('C-137: the areas', () => {
  it('finds each area from its centre, and nothing between them', () => {
    for (const id of [...OUTDOOR, ...ROOM_IDS]) expect(areaAt(centre(AREAS[id]).x, centre(AREAS[id]).z), id).toBe(id);
    expect(areaAt(-200, 0)).toBe(null);
    expect(areaAt(200, 0)).toBe(null);
    expect(areaAt(-300, 50)).toBe(null);
    // (the town round the street runs out to its hedges, 150 m either side of the road)
    expect(areaAt(0, 100)).toBe('street');
    expect(areaAt(0, 200)).toBe(null);
    expect(areaAt(-300, 350)).toBe(null);
    expect(areaAt(-300, 450)).toBe(null);
    expect(areaAt(-300, 520)).toBe(null);
    for (const z of [550, 650, 750, 850]) expect(areaAt(-300, z), z).toBe(null);
  });

  it('knows the rooms from the outdoors, and pads in and out of an area', () => {
    expect(ROOM_IDS).toEqual(['house', 'upstairs', 'garage', 'school', 'arcade', 'basement', 'mindblowers', 'oval', 'diner', 'wong']);
    expect(OUTDOOR.filter((id) => !DEST.has(id))).toEqual(['street', 'annex']);
    expect(inArea('street', 150, 0)).toBe(true);
    expect(inArea('street', 150.1, 0)).toBe(false);
    expect(inArea('street', 150, 0, -0.4)).toBe(false);
    expect(inArea('street', 150.3, 0, 0.4)).toBe(true);
  });
});

describe('C-137: the layout', () => {
  it('has the road run east to west along the middle, with sidewalks either side', () => {
    expect(ROAD).toEqual({ z: 0, w: 10, sidewalk: 2 });
  });

  it('keeps every footprint inside its own area', () => {
    for (const b of street) {
      expect(b.x - b.w / 2, b.id).toBeGreaterThanOrEqual(AREAS.street.x0);
      expect(b.x + b.w / 2, b.id).toBeLessThanOrEqual(AREAS.street.x1);
      expect(b.z - b.d / 2, b.id).toBeGreaterThanOrEqual(AREAS.street.z0);
      expect(b.z + b.d / 2, b.id).toBeLessThanOrEqual(AREAS.street.z1);
      expect(b.roof, b.id).toBeGreaterThanOrEqual(b.h);
    }
    expect(ARCADE.x - ARCADE.w / 2).toBeGreaterThanOrEqual(AREAS.annex.x0);
    expect(ARCADE.x + ARCADE.w / 2).toBeLessThanOrEqual(AREAS.annex.x1);
    expect(ARCADE.z - ARCADE.d / 2).toBeGreaterThanOrEqual(AREAS.annex.z0);
    expect(ARCADE.z + ARCADE.d / 2).toBeLessThanOrEqual(AREAS.annex.z1);
  });

  it('keeps every building off the road and its sidewalks, and apart from the others', () => {
    for (const b of street) expect(Math.abs(b.z) - b.d / 2, b.id).toBeGreaterThanOrEqual(ROAD.w / 2 + ROAD.sidewalk);
    for (const a of street)
      for (const b of street)
        if (a !== b) {
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2;
          expect(apart, `${a.id} / ${b.id}`).toBe(true);
        }
  });

  it('has six neighbours, three a side, and the house and garage within one footprint', () => {
    expect(NEIGHBOURS).toHaveLength(6);
    expect(NEIGHBOURS.filter((n) => n.z < 0).map((n) => n.x)).toEqual([-42, 24, 46]);
    expect(NEIGHBOURS.filter((n) => n.z > 0).map((n) => n.x)).toEqual([-42, -18, 4]);
    expect(BUILDINGS).toEqual([HOUSE, GARAGE, SCHOOL, ...NEIGHBOURS]);
    for (const b of [HOUSE, GARAGE]) {
      expect(b.x - b.w / 2, b.id).toBeGreaterThanOrEqual(HOUSE_GARAGE.x0);
      expect(b.x + b.w / 2, b.id).toBeLessThanOrEqual(HOUSE_GARAGE.x1);
      expect(b.z - b.d / 2, b.id).toBeGreaterThanOrEqual(HOUSE_GARAGE.z0);
      expect(b.z + b.d / 2, b.id).toBeLessThanOrEqual(HOUSE_GARAGE.z1);
    }
  });

  it('puts the garage on the west, the house on the east, the two joined, the garage standing forward', () => {
    expect(GARAGE).toEqual({ id: 'garage', x: -19, z: -21, w: 8, d: 14, h: 3.4, roof: 6.2 });
    expect(HOUSE).toEqual({ id: 'house', x: -5, z: -22.6, w: 20, d: 10.8, h: 3.2, roof: 8.6 });
    expect(HOUSE_GARAGE).toEqual({ x0: -23, x1: 5, z0: -28, z1: -14 });
    // they share a wall, with no gap between
    expect(GARAGE.x + GARAGE.w / 2).toBe(HOUSE.x - HOUSE.w / 2);
    expect(GARAGE.x).toBeLessThan(HOUSE.x);
    // the garage runs the whole depth and stands 3 m forward of the two-storey front (-17.2)
    expect(GARAGE.z + GARAGE.d / 2).toBe(-14);
    expect(GARAGE.z - GARAGE.d / 2).toBe(-28);
    expect(HOUSE.z + HOUSE.d / 2).toBeCloseTo(-17.2, 9);
    expect(HOUSE.z - HOUSE.d / 2).toBeCloseTo(-28, 9);
    // the combined footprint is exactly the two
    expect(HOUSE_GARAGE.x0).toBe(GARAGE.x - GARAGE.w / 2);
    expect(HOUSE_GARAGE.x1).toBe(HOUSE.x + HOUSE.w / 2);
    expect(HOUSE_GARAGE.z0).toBe(HOUSE.z - HOUSE.d / 2);
    expect(HOUSE_GARAGE.z1).toBe(GARAGE.z + GARAGE.d / 2);
  });

  it('runs the driveway from the garage door to the sidewalk, and the front walk from the front door to it', () => {
    expect(DRIVEWAY).toEqual({ x0: -23, x1: -15, z0: -14, z1: -7 });
    expect(DRIVEWAY.x0).toBe(GARAGE.x - GARAGE.w / 2);
    expect(DRIVEWAY.x1).toBe(GARAGE.x + GARAGE.w / 2);
    expect(DRIVEWAY.z1).toBe(-(ROAD.w / 2 + ROAD.sidewalk));
    expect(FRONT_WALK).toEqual({ x0: -7.8, x1: -6.6, z0: -17.4, z1: -7 });
    const door = link('house-door');
    // centred on the door, which is where it ends
    expect((FRONT_WALK.x0 + FRONT_WALK.x1) / 2).toBeCloseTo(door.x, 9);
    expect(FRONT_WALK.z0).toBe(door.z);
    expect(FRONT_WALK.z1).toBe(DRIVEWAY.z1);
  });

  it('follows the Smith house as the model has it: a two-storey wing, a set-back middle, the porch gable', () => {
    const part = (id) => HOUSE_PARTS.find((p) => p.id === id);
    expect(HOUSE_PARTS.map((p) => p.id)).toEqual(['wing', 'middle', 'porch']);
    const edges = (p) => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 });
    // the two-storey wing is the east 8 m, front at -17.2; the middle is set back to -19.3; both are the house's depth
    const close = (got, want) => Object.keys(want).forEach((k) => expect(got[k], k).toBeCloseTo(want[k], 9));
    close(edges(part('wing')), { x0: -3, x1: 5, z0: -28, z1: -17.2 });
    close(edges(part('middle')), { x0: -15, x1: -3, z0: -28, z1: -19.3 });
    // the porch is on the middle, over the door, its step (the porch's south face) at -17.8
    const porch = edges(part('porch'));
    expect(porch.z1).toBeCloseTo(-17.8, 9);
    expect(porch.z0).toBeCloseTo(-19.3, 9);
    expect(porch.x1 - porch.x0).toBeGreaterThan(2);
    expect(Math.abs(part('porch').x - link('house-door').x)).toBeLessThan(0.05);
    // and every part is inside the house's footprint (the box the model is fitted to)
    for (const p of HOUSE_PARTS) {
      const e = edges(p);
      expect(e.x0, p.id).toBeGreaterThanOrEqual(HOUSE.x - HOUSE.w / 2 - 1e-9);
      expect(e.x1, p.id).toBeLessThanOrEqual(HOUSE.x + HOUSE.w / 2 + 1e-9);
      expect(e.z0, p.id).toBeGreaterThanOrEqual(HOUSE.z - HOUSE.d / 2 - 1e-9);
      expect(e.z1, p.id).toBeLessThanOrEqual(HOUSE.z + HOUSE.d / 2 + 1e-9);
    }
  });

  it('parks the cruiser on the driveway, in front of the garage, nose to the road', () => {
    expect(BOARD.x).toBeGreaterThan(DRIVEWAY.x0 + CRUISER.radius);
    expect(BOARD.x).toBeLessThan(DRIVEWAY.x1 - CRUISER.radius);
    expect(BOARD.z).toBeGreaterThan(DRIVEWAY.z0 + CRUISER.radius);
    expect(BOARD.z).toBeLessThan(DRIVEWAY.z1 - CRUISER.radius);
    expect(Math.cos(BOARD.yaw)).toBe(1);
    expect(BOARD).toEqual({ x: -19, z: -10.5, yaw: 0 });
  });

  it('plants about eighteen trees, the same every visit, clear of buildings, road, driveway and doors', () => {
    expect(TREES.length).toBeGreaterThanOrEqual(14);
    expect(TREES.length).toBeLessThanOrEqual(24);
    const doors = LINKS.filter((l) => l.area === 'street');
    const landings = LINKS.filter((l) => l.to === 'street').map((l) => l.arrive);
    for (const t of TREES) {
      expect(inArea('street', t.x, t.z, -1), 'in the street').toBe(true);
      for (const b of street) expect(boxDist(b, t.x, t.z), `${b.id}`).toBeGreaterThanOrEqual(2);
      expect(Math.abs(t.z - ROAD.z), 'road').toBeGreaterThanOrEqual(ROAD.w / 2 + ROAD.sidewalk);
      const d = { x: Math.max(DRIVEWAY.x0 - t.x, 0, t.x - DRIVEWAY.x1), z: Math.max(DRIVEWAY.z0 - t.z, 0, t.z - DRIVEWAY.z1) };
      expect(Math.hypot(d.x, d.z), 'driveway').toBeGreaterThanOrEqual(2);
      for (const l of doors) expect(Math.hypot(t.x - l.x, t.z - l.z), l.id).toBeGreaterThanOrEqual(2);
      for (const a of landings) expect(Math.hypot(t.x - a.x, t.z - a.z), 'landing').toBeGreaterThanOrEqual(2);
      expect(Math.hypot(t.x - START.x, t.z - START.z), 'start').toBeGreaterThanOrEqual(2);
      for (const d of DECOR) expect(Math.hypot(t.x - d.x, t.z - d.z), d.id).toBeGreaterThanOrEqual(1.5);
      for (const f of FENCES) expect(segDist(t.x, t.z, f), 'fence').toBeGreaterThanOrEqual(1);
    }
    vi.resetModules();
    return import('./rules').then((again) => expect(again.TREES).toEqual(TREES));
  });

  it('runs low picket fences round the back yards, behind the houses', () => {
    expect(FENCES.length).toBeGreaterThan(6);
    for (const [x0, z0, x1, z1, thick, low] of FENCES) {
      expect(low).toBe(true);
      expect(thick).toBeGreaterThan(0);
      for (const z of [z0, z1]) expect(z <= -25 || z >= 26).toBe(true);
      for (const x of [x0, x1]) expect(Math.abs(x)).toBeLessThanOrEqual(AREAS.street.x1);
    }
    expect(WALLS.street).toBe(FENCES);
    expect(wallsIn('street')).toBe(FENCES);
    expect(wallsIn('annex')).toEqual([]);
    for (const id of ['garage', 'school', 'arcade', 'diner']) expect(wallsIn(id), id).toEqual([]);
    // the round rooms are walled all round, on their ellipse
    for (const id of ['basement', 'mindblowers', 'oval']) expect(wallsIn(id), id).toHaveLength(32);
  });

  it('puts a collider on every building, the annex arcade included, and on every tree', () => {
    const boxes = collidersIn('street').filter((c) => c.kind === 'box');
    const hasBox = (b) => boxes.some((c) => c.x === b.x && c.z === b.z && c.w === b.w && c.d === b.d);
    // the Smith house and the school are boxes for each part, not for their footprints
    for (const b of street.filter((o) => o !== HOUSE && o !== SCHOOL)) expect(hasBox(b), b.id).toBe(true);
    for (const p of [...HOUSE_PARTS, ...SCHOOL_PARTS]) expect(hasBox(p), p.id ?? 'school part').toBe(true);
    expect(hasBox(HOUSE)).toBe(false);
    expect(hasBox(SCHOOL)).toBe(false);
    expect(collidersIn('street').filter((c) => c.kind === 'circle' && c.id.startsWith('tree'))).toHaveLength(TREES.length);
    expect(collidersIn('annex').some((c) => c.x === ARCADE.x && c.z === ARCADE.z && c.w === ARCADE.w && c.d === ARCADE.d)).toBe(true);
    expect(COLLIDERS.street).toBe(collidersIn('street'));
  });

  it('keeps the parked cruiser out of the colliders: it is added by whoever walks', () => {
    for (const c of collidersIn('street')) expect(c.kind === 'circle' && c.r === CRUISER.radius, c.id).toBe(false);
    expect(collidersIn('street')).toBe(collidersIn('street'));
  });

  it('puts something in every room, inside it', () => {
    for (const id of ROOM_IDS) {
      const room = AREAS[id];
      expect(collidersIn(id).length, id).toBeGreaterThanOrEqual(3);
      for (const c of collidersIn(id).filter((o) => o.kind === 'box')) {
        // a box turned a quarter swaps its sides
        const quarter = Math.abs(Math.sin(c.turn)) > 0.5;
        const w = quarter ? c.d : c.w;
        const d = quarter ? c.w : c.d;
        expect(c.x - w / 2, `${id} ${c.id}`).toBeGreaterThanOrEqual(room.x0 - 1e-9);
        expect(c.x + w / 2, `${id} ${c.id}`).toBeLessThanOrEqual(room.x1 + 1e-9);
        expect(c.z - d / 2, `${id} ${c.id}`).toBeGreaterThanOrEqual(room.z0 - 1e-9);
        expect(c.z + d / 2, `${id} ${c.id}`).toBeLessThanOrEqual(room.z1 + 1e-9);
      }
    }
  });
});

describe('C-137: Harry Herpson High, the neighbours and the street’s small things', () => {
  const hit = (p, x, z) => Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2;
  const overParts = (x, z) => SCHOOL_PARTS.some((p) => hit(p, x, z));

  it('keeps the school’s footprint for the model to be fitted to', () => {
    expect(SCHOOL).toEqual({ id: 'school', x: 40, z: 23, w: 30, d: 16, h: 8, roof: 8.5 });
  });

  it('follows the model’s L: a front bar the whole width, the tall entrance block on the door, a rear wing on the west', () => {
    expect(SCHOOL_PARTS).toHaveLength(3);
    for (const p of SCHOOL_PARTS) {
      for (const k of ['x', 'z', 'w', 'd', 'h']) expect(Number.isFinite(p[k]), `${p.id} ${k}`).toBe(true);
      // inside the footprint, and under the roof the footprint has
      expect(p.x - p.w / 2, p.id).toBeGreaterThanOrEqual(SCHOOL.x - SCHOOL.w / 2 - 1e-9);
      expect(p.x + p.w / 2, p.id).toBeLessThanOrEqual(SCHOOL.x + SCHOOL.w / 2 + 1e-9);
      expect(p.z - p.d / 2, p.id).toBeGreaterThanOrEqual(SCHOOL.z - SCHOOL.d / 2 - 1e-9);
      expect(p.z + p.d / 2, p.id).toBeLessThanOrEqual(SCHOOL.z + SCHOOL.d / 2 + 1e-9);
      expect(p.h, p.id).toBeLessThanOrEqual(SCHOOL.roof + 0.3);
    }
    // one spans the footprint
    expect(SCHOOL_PARTS.some((p) => p.w >= SCHOOL.w - 1e-9)).toBe(true);
    // the entrance block stands over the door, and is the tallest, and comes furthest forward
    const door = link('school-door');
    const tallest = SCHOOL_PARTS.reduce((a, b) => (b.h > a.h ? b : a));
    expect(Math.abs(tallest.x - door.x)).toBeLessThan(1);
    expect(tallest.x - tallest.w / 2).toBeLessThan(door.x);
    expect(tallest.x + tallest.w / 2).toBeGreaterThan(door.x);
    expect(tallest.z - tallest.d / 2).toBeLessThan(Math.min(...SCHOOL_PARTS.filter((p) => p !== tallest).map((p) => p.z - p.d / 2)));
    expect(tallest.z - tallest.d / 2).toBeGreaterThan(door.z);
    // an L: the west wing goes on back, the east does not
    expect(overParts(30, 28)).toBe(true);
    expect(overParts(50, 20)).toBe(true);
    expect(overParts(50, 28)).toBe(false);
    expect(overParts(40, 28)).toBe(true);
    expect(overParts(44, 28)).toBe(false);
  });

  it('puts a box in the way for each part and none for the whole footprint, with the notch and the front step to walk in', () => {
    // the notch east of the rear wing is open ground to stand in; so is the way up to the doors
    expect(free('street', 50, 28)).toBe(true);
    expect(free('street', 40, 15.2)).toBe(true);
    const door = link('school-door');
    const entrance = SCHOOL_PARTS.reduce((a, b) => (b.h > a.h ? b : a));
    // walking from the road up to the entrance block stops at its front, inside the door's reach
    const up = walk(newMorty({ x: door.x, z: 9, face: -Math.PI / 2 }), { x: 0, z: 1 }, 3);
    expect(up.z).toBeCloseTo(entrance.z - entrance.d / 2 - MORTY.radius, 1);
    expect(Math.hypot(up.x - door.x, up.z - door.z)).toBeLessThan(door.r);
  });

  it('flies over each part at its own height: the entrance block highest, the notch not at all', () => {
    const topOf = (x, z) => Math.max(CRUISER.hover, ...SCHOOL_PARTS.filter((p) => Math.abs(x - p.x) <= p.w / 2 + CRUISER.radius && Math.abs(z - p.z) <= p.d / 2 + CRUISER.radius).map((p) => p.h + 2));
    for (const p of SCHOOL_PARTS) expect(floorAt(p.x, p.z), p.id).toBe(topOf(p.x, p.z));
    const entrance = SCHOOL_PARTS.reduce((a, b) => (b.h > a.h ? b : a));
    expect(floorAt(entrance.x, entrance.z)).toBe(entrance.h + 2);
    // over the far end of the rear wing and the far east of the bar, it is lower than over the block
    expect(floorAt(27, 29)).toBeLessThan(floorAt(entrance.x, entrance.z));
    expect(floorAt(53, 20)).toBeLessThan(floorAt(entrance.x, entrance.z));
    // out over the notch it is the hover height; it can land there and not on the wings
    expect(floorAt(52, 29)).toBe(CRUISER.hover);
    expect(canLand({ ...newCruiser(), x: 52, z: 29 })).toBe(true);
    expect(canLand({ ...newCruiser(), x: 30, z: 28 })).toBe(false);
    expect(canLand({ ...newCruiser(), x: 50, z: 20 })).toBe(false);
  });

  it('has the house next door to the west pink, and every neighbour a different colour', () => {
    const [r, g, b] = [(NEIGHBOURS[0].tint >> 16) & 255, (NEIGHBOURS[0].tint >> 8) & 255, NEIGHBOURS[0].tint & 255];
    expect(r).toBeGreaterThanOrEqual(0xe8);
    expect(g).toBeLessThanOrEqual(0xb8);
    expect(b).toBeLessThanOrEqual(0xc0);
    expect(r - g).toBeGreaterThan(0x30);
    expect(NEIGHBOURS[0].x).toBe(-42);
    expect(new Set(NEIGHBOURS.map((n) => n.tint)).size).toBe(6);
  });

  it('gives every neighbour a design and a roof colour for the scene', () => {
    for (const n of NEIGHBOURS) {
      expect(['colonial', 'ranch', 'diner'], n.id).toContain(n.look);
      expect(Number.isInteger(n.roofTint) && n.roofTint >= 0 && n.roofTint <= 0xffffff, n.id).toBe(true);
    }
    expect(new Set(NEIGHBOURS.map((n) => n.look))).toEqual(new Set(['colonial', 'ranch', 'diner']));
    // Shoney's is the north-east one, lower than a house
    expect(NEIGHBOURS.filter((n) => n.look === 'diner').map((n) => n.id)).toEqual(['n2']);
    expect(DINER).toMatchObject({ id: 'n2', x: 46, z: -20 });
    expect(DINER.roof).toBeLessThan(NEIGHBOURS[0].roof);
  });

  it('lists the street’s small things, each a thing in the way: the flagpole, the marquee, the school tree, poles, mailboxes, the hydrant', () => {
    const at = (id) => DECOR.find((d) => d.id === id);
    expect(at('flagpole')).toEqual({ id: 'flagpole', kind: 'pole', x: 47.5, z: 11.8, r: 0.15 });
    expect(at('marquee')).toEqual({ id: 'marquee', kind: 'box', x: 31.5, z: 9.4, w: 2.4, d: 0.5, turn: -2.75 });
    expect(at('school-tree')).toEqual({ id: 'school-tree', kind: 'tree', x: 27.5, z: 11.5, r: 0.35 });
    expect(at('hydrant')).toEqual({ id: 'hydrant', kind: 'hydrant', x: -2.2, z: -7.45, r: 0.25 });
    // telephone poles every 32 m along the south sidewalk, inside the street
    const poles = DECOR.filter((d) => d.kind === 'pole' && d.id !== 'flagpole');
    expect(poles.map((d) => d.x)).toEqual([-44, -12, 20, 52]);
    for (const d of poles) expect(d).toMatchObject({ z: 7.6, r: 0.15 });
    // a mailbox by each house's driveway, on its own side of the street, at the sidewalk's edge
    const boxes = DECOR.filter((d) => d.kind === 'mailbox');
    expect(boxes.map((d) => d.id).sort()).toEqual(['mailbox-n0', 'mailbox-n1', 'mailbox-s0', 'mailbox-s1', 'mailbox-s2', 'mailbox-smith']);
    for (const d of boxes) {
      expect(d.r, d.id).toBe(0.25);
      expect(Math.abs(d.z), d.id).toBe(7.5);
    }
    expect(at('mailbox-smith')).toMatchObject({ x: DRIVEWAY.x1 + 0.7, z: -7.5 });
    // Shoney's has its sign where a house has its mailbox, and two cars in its lot, either side of the way to its door
    expect(at('shoneys-sign')).toMatchObject({ kind: 'sign', z: -7.5, r: 0.3 });
    const cars = DECOR.filter((d) => d.kind === 'car');
    expect(cars.map((d) => d.id)).toEqual(['car1', 'car2']);
    for (const c of cars) {
      expect(c, c.id).toMatchObject({ w: 2.2, d: 4.6, turn: 0 });
      expect(c.z - c.d / 2, c.id).toBeGreaterThan(DINER.z + DINER.d / 2);
      expect(Math.abs(c.x - DINER.x), c.id).toBeGreaterThan(c.w / 2 + MORTY.radius + 0.5);
    }
    for (const n of NEIGHBOURS.filter((o) => o !== DINER)) {
      const d = at(`mailbox-${n.id}`);
      expect(Math.sign(d.z), n.id).toBe(Math.sign(n.z));
      expect(Math.abs(d.x - n.x), n.id).toBeLessThan(n.w / 2 + 5);
    }
    expect(new Set(DECOR.map((d) => d.id)).size).toBe(DECOR.length);
    // each is in the way, as a round thing (the marquee, a turned box)
    for (const d of DECOR) {
      const c = collidersIn('street').find((o) => o.id === d.id);
      expect(c, d.id).toBeTruthy();
      if (d.w) expect(c).toMatchObject({ kind: 'box', x: d.x, z: d.z, w: d.w, d: d.d, turn: d.turn });
      else expect(c).toMatchObject({ kind: 'circle', x: d.x, z: d.z, r: d.r });
    }
  });

  it('keeps the cruiser from setting down on any of them', () => {
    for (const d of DECOR) {
      expect(canLand({ ...newCruiser(), x: d.x, z: d.z }), d.id).toBe(false);
      // but it can land close by, clear of it
      const reach = CRUISER.radius + (d.w ? Math.hypot(d.w, d.d) / 2 : d.r) + 0.3;
      const near = [0, 1, 2, 3, 4, 5, 6, 7].some((k) => canLand({ ...newCruiser(), x: d.x + Math.cos((k * Math.PI) / 4) * reach, z: d.z + Math.sin((k * Math.PI) / 4) * reach }));
      expect(near, `${d.id}, close by`).toBe(true);
    }
  });

  it('stands them clear of the buildings, the road, the doors and the front walk, and nothing is cut off', () => {
    const edge = (b, x, z) => Math.hypot(Math.max(Math.abs(x - b.x) - b.w / 2, 0), Math.max(Math.abs(z - b.z) - b.d / 2, 0));
    const solids = [...street.filter((b) => b !== HOUSE && b !== SCHOOL), ...HOUSE_PARTS, ...SCHOOL_PARTS];
    for (const d of DECOR) {
      const r = d.w ? Math.max(d.w, d.d) / 2 : d.r;
      expect(inArea('street', d.x, d.z, -r), `${d.id} in the street`).toBe(true);
      expect(Math.abs(d.z - ROAD.z) - r, `${d.id} off the road`).toBeGreaterThan(ROAD.w / 2);
      for (const b of solids) expect(edge(b, d.x, d.z), `${d.id} in ${b.id}`).toBeGreaterThan(r);
      for (const l of LINKS.filter((o) => o.area === 'street')) expect(Math.hypot(d.x - l.x, d.z - l.z), `${d.id} by ${l.id}`).toBeGreaterThan(r + MORTY.radius + 0.5);
      for (const l of LINKS.filter((o) => o.to === 'street')) expect(Math.hypot(d.x - l.arrive.x, d.z - l.arrive.z), `${d.id} by the landing from ${l.id}`).toBeGreaterThan(r + MORTY.radius + 0.5);
      // not on the front walk, nor in the way of the lane to a door
      expect(d.x + r < FRONT_WALK.x0 - 0.4 || d.x - r > FRONT_WALK.x1 + 0.4 || d.z > FRONT_WALK.z1 + 0.5 || d.z < FRONT_WALK.z0 - 0.5, `${d.id} off the front walk`).toBe(true);
    }
    // the lane from the sidewalk to each street door stays clear of them, with Morty's width
    for (const l of LINKS.filter((o) => o.area === 'street')) {
      const edgeZ = Math.sign(l.z) * (ROAD.w / 2 + ROAD.sidewalk);
      for (let k = 0; k <= 1; k += 0.02) expect(free('street', l.x, edgeZ + (l.z - edgeZ) * k), `${l.id} lane`).toBe(true);
    }
  });
});

describe('C-137: the furniture', () => {
  it('lists each piece once, with what the scene needs to draw it', () => {
    expect(FURNITURE.length).toBeGreaterThan(30);
    expect(new Set(FURNITURE.map((f) => `${f.area}/${f.id}`)).size).toBe(FURNITURE.length);
    for (const f of FURNITURE) {
      expect(ROOM_IDS, f.id).toContain(f.area);
      expect(typeof f.kind, f.id).toBe('string');
      for (const k of ['x', 'z', 'w', 'd', 'h', 'turn']) expect(Number.isFinite(f[k]), `${f.id} ${k}`).toBe(true);
      expect(f.w, f.id).toBeGreaterThan(0);
      expect(f.d, f.id).toBeGreaterThan(0);
      expect(f.h, f.id).toBeGreaterThan(0);
    }
  });

  it('has the kinds the scene draws', () => {
    const kinds = new Set(FURNITURE.map((f) => f.kind));
    for (const k of ['couch', 'tv', 'dining-table', 'counter', 'sink', 'stove', 'fridge', 'nook-table', 'chair', 'armchair', 'coffee-table', 'bookcase', 'dog-bed', 'clock', 'bed', 'nightstand', 'desk', 'dresser', 'stairs', 'workbench', 'shelf', 'laundry', 'arcade', 'roy', 'goldenfold-desk', 'school-desk', 'chalkboard', 'govportal', 'clone-machine', 'lab-desk', 'ladder', 'mind-chair', 'mind-cart', 'vials', 'resolute', 'flag', 'fireplace', 'booth', 'booth-table', 'diner-counter', 'stool'])
      expect(kinds.has(k), k).toBe(true);
    expect(FURNITURE.filter((f) => f.kind === 'bed').map((f) => f.id)).toEqual(expect.arrayContaining(['bed-summer', 'bed-morty', 'bed-master']));
  });

  it('makes each piece a box in the way, where it stands, turned as it is drawn', () => {
    for (const f of FURNITURE) {
      const c = collidersIn(f.area).find((o) => o.id === f.id);
      expect(c, f.id).toMatchObject({ kind: 'box', x: f.x, z: f.z, w: f.w, d: f.d, turn: f.turn, top: f.h });
    }
    // a turned piece is in the way (of his feet, on the floor) along its turned sides: the couch is long on z, facing the TV
    const couch = FURNITURE.find((f) => f.id === 'couch');
    const onFloor = (x, z) => Math.hypot(...((p) => [p[0] - x, p[1] - z])(pushOut(x, z, MORTY.radius, collidersIn('house'), wallsIn('house')))) < 1e-6;
    expect(Math.abs(Math.sin(couch.turn))).toBeCloseTo(1, 6);
    expect(onFloor(couch.x, couch.z - couch.w / 2 + 0.05)).toBe(false);
    expect(onFloor(couch.x, couch.z - couch.w / 2 - MORTY.radius - 0.05)).toBe(true);
    expect(onFloor(couch.x, couch.z - couch.w / 2 - MORTY.radius + 0.05)).toBe(false);
    expect(onFloor(couch.x + couch.d / 2 + MORTY.radius - 0.05, couch.z)).toBe(false);
  });

  it('keeps every piece of furniture clear of the walls inside the house: none stands on a wall line', () => {
    for (const f of FURNITURE.filter((o) => INNER_WALLS[o.area])) {
      for (const [x0, z0, x1, z1] of INNER_WALLS[f.area]) {
        // (a wall further from the piece's middle than the piece is wide, and the margin, cannot be on it)
        if (segDist(f.x, f.z, [x0, z0, x1, z1]) > Math.hypot(f.w, f.d) / 2 + 0.06) continue;
        const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05);
        for (let k = 0; k <= n; k++) expect(pieceDist(f, x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n), `${f.id} on a wall at ${x0}, ${z0}`).toBeGreaterThanOrEqual(0.06 - 1e-9);
      }
    }
  });

  it('has the TV on the living room’s east wall, the couch facing it, the dining table and the red rug where they belong', () => {
    const at = (id) => FURNITURE.find((f) => f.id === id);
    const living = PLAN.find((r) => r.id === 'living');
    const tv = at('tv');
    // its back is against the wall but off the wall's own line (the wall is 0.12 thick)
    expect(living.x1 - (tv.x + tv.d / 2)).toBeGreaterThanOrEqual(0.06);
    expect(living.x1 - (tv.x + tv.d / 2)).toBeLessThan(0.3);
    expect(inRoom(living, tv.x, tv.z)).toBe(true);
    expect(at('couch').x).toBeLessThan(tv.x);
    expect(inRoom(living, at('couch').x, at('couch').z)).toBe(true);
    // the couch faces east (its front turned to +x), the TV west
    expect(Math.sin(at('couch').turn)).toBeCloseTo(1, 6);
    expect(Math.sin(tv.turn)).toBeCloseTo(-1, 6);
    const dining = PLAN.find((r) => r.id === 'dining');
    expect(inRoom(dining, at('table').x, at('table').z)).toBe(true);
    expect(at('table').kind).toBe('dining-table');
    const entry = PLAN.find((r) => r.id === 'entry');
    const rug = RUGS.find((r) => r.id === 'entry');
    expect(rug).toMatchObject({ area: 'house', color: 0xa23a2e });
    expect(rug.x - rug.w / 2).toBeGreaterThanOrEqual(entry.x0);
    expect(rug.x + rug.w / 2).toBeLessThanOrEqual(entry.x1);
    expect(rug.z - rug.d / 2).toBeGreaterThanOrEqual(entry.z0);
    expect(rug.z + rug.d / 2).toBeLessThanOrEqual(entry.z1);
  });
});

describe('C-137: the rooms as the show draws them', () => {
  const room = (id) => PLAN.find((r) => r.id === id);
  const piece = (id) => FURNITURE.find((f) => f.id === id);
  const kindIn = (r, kind) => FURNITURE.filter((f) => f.area === r.area && f.kind === kind && inRoom(r, f.x, f.z));
  // a piece's footprint on the floor (a quarter turn swaps its sides)
  const foot = (f) => {
    const q = Math.abs(Math.sin(f.turn)) > 0.5;
    const w = q ? f.d : f.w;
    const d = q ? f.w : f.d;
    return { x0: f.x - w / 2, x1: f.x + w / 2, z0: f.z - d / 2, z1: f.z + d / 2 };
  };
  const within = (f, r) => {
    const e = foot(f);
    return e.x0 >= r.x0 - 1e-9 && e.x1 <= r.x1 + 1e-9 && e.z0 >= r.z0 - 1e-9 && e.z1 <= r.z1 + 1e-9;
  };
  // where a piece faces, and whether that is towards (x, z)
  const faces = (f) => [Math.sin(f.turn), Math.cos(f.turn)];
  const toward = (f, x, z) => faces(f)[0] * (x - f.x) + faces(f)[1] * (z - f.z) > 0.3;
  // how far a piece's back is from the wall (or the room's edge) behind it
  const backGap = (f, r) => {
    const [fx, fz] = faces(f);
    const e = foot(f);
    return fx > 0.5 ? e.x0 - r.x0 : fx < -0.5 ? r.x1 - e.x1 : fz > 0.5 ? e.z0 - r.z0 : r.z1 - e.z1;
  };
  const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-9 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 1e-9;

  it('turns every piece a quarter, so its box is the footprint the scene draws', () => {
    for (const f of FURNITURE) expect(Math.abs(Math.sin(2 * f.turn)), f.id).toBeLessThan(1e-9);
  });

  it('stands every piece of the house, upstairs and the lab whole inside one room of its plan', () => {
    for (const f of FURNITURE.filter((o) => PLAN.some((r) => r.area === o.area))) expect(PLAN.some((r) => r.area === f.area && within(f, r)), `${f.id} in a room`).toBe(true);
  });

  it('puts no two pieces in the same place', () => {
    for (const a of FURNITURE)
      for (const b of FURNITURE) if (a.id < b.id && a.area === b.area) expect(overlap(foot(a), foot(b)), `${a.id} / ${b.id}`).toBe(false);
  });

  it('furnishes the kitchen: counters along the walls with the sink and the stove, the fridge, a breakfast nook', () => {
    const k = room('kitchen');
    expect(kindIn(k, 'counter').length).toBeGreaterThanOrEqual(3);
    for (const kind of ['sink', 'stove', 'fridge', 'nook-table']) expect(kindIn(k, kind), kind).toHaveLength(1);
    expect(kindIn(k, 'chair')).toHaveLength(2);
    for (const f of FURNITURE.filter((o) => o.area === 'house' && inRoom(k, o.x, o.z))) expect(within(f, k), f.id).toBe(true);
    // each run stands against a wall, facing into the room
    for (const f of FURNITURE.filter((o) => ['counter', 'sink', 'stove', 'fridge'].includes(o.kind) && inRoom(k, o.x, o.z))) {
      expect(backGap(f, k), `${f.id} against the wall`).toBeLessThan(0.3);
      expect(backGap(f, k), `${f.id} off the wall line`).toBeGreaterThanOrEqual(-1e-9);
      expect(toward(f, (k.x0 + k.x1) / 2, (k.z0 + k.z1) / 2), `${f.id} faces in`).toBe(true);
    }
    // the sink is on the back wall, under its window; Beth cooks at the stove
    expect(piece('sink').z - piece('sink').d / 2).toBeCloseTo(k.z0, 6);
    expect(Math.hypot(PEOPLE.find((p) => p.id === 'beth').x - piece('stove').x, PEOPLE.find((p) => p.id === 'beth').z - piece('stove').z)).toBeLessThan(1.2);
    // the nook: its two chairs face the small table, by the front window
    for (const c of kindIn(k, 'chair')) {
      expect(toward(c, piece('nook-table').x, piece('nook-table').z), c.id).toBe(true);
      expect(pieceDist(piece('nook-table'), c.x, c.z), c.id).toBeLessThan(0.7);
    }
    expect(k.z1 - foot(piece('nook-table')).z1).toBeLessThan(1);
  });

  it('furnishes the living room: the couch facing the TV with the coffee table between, an armchair, a bookcase, the dog bed', () => {
    const l = room('living');
    for (const kind of ['tv', 'couch', 'coffee-table', 'armchair', 'bookcase', 'dog-bed']) expect(kindIn(l, kind), kind).toHaveLength(1);
    const [tv, couch, table, chair, books, bed] = ['tv', 'couch', 'coffee-table', 'armchair', 'bookcase', 'dog-bed'].map((k) => kindIn(l, k)[0]);
    for (const f of [tv, couch, table, chair, books, bed]) expect(within(f, l), f.id).toBe(true);
    // the table is in front of the couch, in the way to the TV, and the couch has room to be walked up to
    expect(couch.x).toBeLessThan(table.x);
    expect(table.x).toBeLessThan(tv.x);
    expect(Math.abs(table.z - couch.z)).toBeLessThan(couch.w / 2);
    expect(foot(table).x0 - foot(couch).x1).toBeGreaterThanOrEqual(1.1);
    // the armchair looks at it; the bookcase is against a wall; the dog bed is low and by the back wall
    expect(toward(chair, table.x, table.z)).toBe(true);
    expect(backGap(books, l)).toBeLessThan(0.3);
    expect(bed.h).toBeLessThanOrEqual(0.3);
    expect(backGap(bed, l)).toBeLessThan(0.3);
    expect(table.h).toBeLessThanOrEqual(0.5);
  });

  it('sets the dining table for six, two a side and one at each end, each facing it', () => {
    const d = room('dining');
    const table = piece('table');
    const chairs = kindIn(d, 'chair');
    expect(table).toMatchObject({ kind: 'dining-table' });
    expect(inRoom(d, table.x, table.z)).toBe(true);
    expect(chairs).toHaveLength(6);
    const t = foot(table);
    expect(chairs.filter((c) => c.z < t.z0)).toHaveLength(2);
    expect(chairs.filter((c) => c.z > t.z1)).toHaveLength(2);
    expect(chairs.filter((c) => c.x < t.x0)).toHaveLength(1);
    expect(chairs.filter((c) => c.x > t.x1)).toHaveLength(1);
    for (const c of chairs) {
      expect(toward(c, table.x, table.z), c.id).toBe(true);
      expect(pieceDist(table, c.x, c.z), c.id).toBeGreaterThan(0.2);
      expect(pieceDist(table, c.x, c.z), c.id).toBeLessThan(0.7);
      expect(within(c, d), c.id).toBe(true);
    }
  });

  it('stands the grandfather clock in the entry, against a wall', () => {
    const e = room('entry');
    const clock = piece('clock');
    expect(clock).toMatchObject({ area: 'house', kind: 'clock' });
    expect(within(clock, e)).toBe(true);
    expect(clock.h).toBeGreaterThanOrEqual(1.8);
    expect(backGap(clock, e)).toBeLessThan(0.3);
    expect(backGap(clock, e)).toBeGreaterThanOrEqual(0.06 - 1e-9);
  });

  it('furnishes Morty’s room: the bed with its nightstand, the bookshelf, the desk and its chair', () => {
    const m = room('morty');
    for (const kind of ['bed', 'nightstand', 'bookcase', 'desk', 'chair']) expect(kindIn(m, kind), kind).toHaveLength(1);
    const [bed, stand, books, desk, chair] = ['bed', 'nightstand', 'bookcase', 'desk', 'chair'].map((k) => kindIn(m, k)[0]);
    for (const f of [bed, stand, books, desk, chair]) expect(within(f, m), f.id).toBe(true);
    expect(bed.id).toBe('bed-morty');
    expect(desk.id).toBe('desk-morty');
    // the nightstand is at the head of the bed, low
    expect(pieceDist(bed, stand.x, stand.z)).toBeLessThan(0.5);
    expect(stand.h).toBeLessThanOrEqual(0.7);
    // the bookshelf and desk are against the back wall; the chair is pulled up to the desk
    expect(backGap(books, m)).toBeLessThan(0.3);
    expect(backGap(desk, m)).toBeLessThan(0.3);
    expect(toward(chair, desk.x, desk.z)).toBe(true);
    expect(pieceDist(desk, chair.x, chair.z)).toBeLessThan(0.7);
  });

  it('lays the rugs flat, each inside its room: the entry’s red one, the living room’s olive one, Morty’s round space rug', () => {
    expect(RUGS.map((r) => r.id).sort()).toEqual(['entry', 'living', 'morty', 'office']);
    for (const r of RUGS) {
      const rm = room(r.id);
      expect(rm.area, r.id).toBe(r.area);
      expect(r.x - r.w / 2, r.id).toBeGreaterThanOrEqual(rm.x0);
      expect(r.x + r.w / 2, r.id).toBeLessThanOrEqual(rm.x1);
      expect(r.z - r.d / 2, r.id).toBeGreaterThanOrEqual(rm.z0);
      expect(r.z + r.d / 2, r.id).toBeLessThanOrEqual(rm.z1);
      expect(Number.isInteger(r.color), r.id).toBe(true);
      // a rug is not in the way: it is no collider
      expect(collidersIn(r.area).some((c) => c.id === `rug-${r.id}` || c.id === r.id), r.id).toBe(false);
    }
    const round = RUGS.find((r) => r.id === 'morty');
    expect(round.round).toBe(true);
    expect(round.w).toBe(round.d);
  });

  it('leaves every doorway clear: nothing stands in the band a body’s width either side of a door', () => {
    const band = 0.8;
    let doors = 0;
    for (const area of Object.keys(DOORS))
      for (const [a, b] of DOORS[area]) {
        const line = shared(room(a), room(b));
        for (const [from, to] of gapsAt(INNER_WALLS[area], line)) {
          if (to - from < 1.1) continue;
          doors++;
          const zone = line.axis === 'x' ? { x0: line.at - band, x1: line.at + band, z0: from, z1: to } : { x0: from, x1: to, z0: line.at - band, z1: line.at + band };
          for (const f of FURNITURE.filter((o) => o.area === area)) expect(overlap(foot(f), zone), `${f.id} in the ${a} / ${b} door`).toBe(false);
        }
      }
    expect(doors).toBe(12);
  });

  it('keeps a body’s width clear of every outside door, exit and the way down, but for the ladder you climb', () => {
    for (const l of LINKS.filter((o) => ['door', 'exit', 'hatch'].includes(o.kind) && ROOM_IDS.includes(o.area)))
      for (const f of FURNITURE.filter((o) => o.area === l.area && o.kind !== 'ladder')) expect(pieceDist(f, l.x, l.z), `${f.id} by ${l.id}`).toBeGreaterThanOrEqual(MORTY.radius * 2);
  });
});

describe('C-137: the Smith house, room by room', () => {
  it('has the ground floor and the first floor as areas, with the rooms of the plan', () => {
    expect(AREAS.house).toEqual({ x0: -312, x1: -288, z0: -8, z1: 8.5 });
    expect(AREAS.upstairs).toEqual({ x0: -306, x1: -294.7, z0: 394, z1: 410.3 });
    expect(PLAN.map((r) => r.id)).toEqual(['kitchen', 'living', 'den', 'dining', 'entry', 'hall', 'stairs', 'rickroom', 'summer', 'morty', 'upHall', 'master', 'balcony', 'stairTop', 'clonelab', 'mind', 'office', 'shoneys', 'wongoffice']);
    const room = (id) => PLAN.find((r) => r.id === id);
    expect(room('kitchen')).toMatchObject({ area: 'house', name: 'The kitchen', x0: -312, x1: -306.7, z0: -8, z1: 3.4 });
    expect(room('living')).toMatchObject({ x0: -306.7, x1: -296.9, z0: -8, z1: -1.9 });
    expect(room('den')).toMatchObject({ name: 'The den', x0: -296.9, x1: -288, z0: -8, z1: -1.6 });
    expect(room('dining')).toMatchObject({ x0: -306.7, x1: -299.5, z0: -1.9, z1: 3.4 });
    expect(room('entry')).toMatchObject({ x0: -299.5, x1: -295.7, z0: -1.9, z1: 3.4 });
    expect(room('hall')).toMatchObject({ x0: -295.7, x1: -288, z0: -1.6, z1: 0.5 });
    expect(room('stairs')).toMatchObject({ x0: -295.7, x1: -294.5, z0: 0.5, z1: 3.4 });
    expect(room('rickroom')).toMatchObject({ name: 'The back room', x0: -294.5, x1: -288, z0: 0.5, z1: 8.5 });
    expect(room('summer')).toMatchObject({ area: 'upstairs', x0: -306, x1: -299.8, z0: 394, z1: 399.9 });
    expect(room('morty')).toMatchObject({ x0: -299.8, x1: -294.7, z0: 394, z1: 399.9 });
    expect(room('upHall')).toMatchObject({ x0: -306, x1: -294.7, z0: 399.9, z1: 401.7 });
    expect(room('master')).toMatchObject({ x0: -302.4, x1: -294.7, z0: 401.7, z1: 408.8 });
    expect(room('balcony')).toMatchObject({ x0: -302.4, x1: -294.7, z0: 408.8, z1: 410.3 });
    // the rooms of their own are each one room the size of its area
    expect(room('clonelab')).toMatchObject({ area: 'basement', name: 'Rick’s clone lab', x0: -310, x1: -290, z0: 494, z1: 510 });
    for (const [id, area] of [['mind', 'mindblowers'], ['office', 'oval'], ['shoneys', 'diner']]) expect(room(id), id).toMatchObject({ area, ...AREAS[area] });
    for (const r of PLAN) {
      expect(r.name.length, r.id).toBeGreaterThan(3);
      expect(Number.isInteger(r.floor) && r.floor >= 0 && r.floor <= 0xffffff, r.id).toBe(true);
      const a = AREAS[r.area];
      expect(r.x0, r.id).toBeGreaterThanOrEqual(a.x0);
      expect(r.x1, r.id).toBeLessThanOrEqual(a.x1);
      expect(r.z0, r.id).toBeGreaterThanOrEqual(a.z0);
      expect(r.z1, r.id).toBeLessThanOrEqual(a.z1);
    }
  });

  it('has no two rooms of a floor overlapping, but for the sliver where the den and the entry meet', () => {
    const overlaps = [];
    for (const a of PLAN)
      for (const b of PLAN) {
        if (a.id >= b.id || a.area !== b.area) continue;
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
        if (ox > 1e-9 && oz > 1e-9) overlaps.push({ rooms: [a.id, b.id], x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) });
      }
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].rooms).toEqual(['den', 'entry']);
    expect([overlaps[0].x0, overlaps[0].x1, overlaps[0].z0, overlaps[0].z1].map((v) => +v.toFixed(6))).toEqual([-296.9, -295.7, -1.9, -1.6]);
  });

  it('gives the master bedroom a single door onto the hall, and keeps the top of the stairs open to the hall', () => {
    const room = (id) => PLAN.find((r) => r.id === id);
    const line = shared(room('master'), room('upHall'));
    const gaps = openings(INNER_WALLS.upstairs, line);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toBeGreaterThanOrEqual(1.1);
    // the top of the stairs is the hall's: no wall across it
    const top = shared(room('stairTop'), room('upHall'));
    expect(openings(INNER_WALLS.upstairs, top)).toEqual([top.to - top.from]);
    expect(stands('upstairs', top)).toBe(true);
  });

  it('has nowhere to stand in the house or upstairs outside a room of the plan', () => {
    for (const area of ['house', 'upstairs']) {
      const a = AREAS[area];
      let stood = 0;
      for (let x = a.x0; x <= a.x1; x += 0.25)
        for (let z = a.z0; z <= a.z1; z += 0.25) {
          if (!free(area, x, z)) continue;
          stood++;
          expect(
            PLAN.some((r) => r.area === area && inRoom(r, x, z)),
            `${area} ${x}, ${z}`
          ).toBe(true);
        }
      expect(stood, area).toBeGreaterThan(300);
    }
  });

  it('walls the rooms off from each other, with a door where the plan has one and none where it has not', () => {
    const room = (id) => PLAN.find((r) => r.id === id);
    const doors = DOORS;
    const shut = { house: [['living', 'entry'], ['stairs', 'rickroom'], ['stairs', 'hall']], upstairs: [['summer', 'morty']] };
    for (const area of Object.keys(doors)) {
      for (const [a, b] of doors[area]) {
        const line = shared(room(a), room(b));
        expect(line, `${a} / ${b} touch`).toBeTruthy();
        expect(Math.max(...openings(INNER_WALLS[area], line)), `${a} / ${b} door`).toBeGreaterThanOrEqual(1.1);
        expect(stands(area, line), `${a} / ${b} can be walked through`).toBe(true);
      }
      for (const [a, b] of shut[area]) {
        const line = shared(room(a), room(b));
        expect(line, `${a} / ${b} touch`).toBeTruthy();
        expect(stands(area, line), `${a} / ${b} is shut`).toBe(false);
      }
    }
  });

  it('keeps every wall piece a thin, straight, level line, and every opening from being squeezed', () => {
    for (const area of Object.keys(INNER_WALLS)) {
      expect(INNER_WALLS[area].length, area).toBeGreaterThan(5);
      for (const [x0, z0, x1, z1, thick] of INNER_WALLS[area]) {
        expect(x0 === x1 || z0 === z1, `${area} ${x0},${z0}`).toBe(true);
        expect(Math.hypot(x1 - x0, z1 - z0)).toBeGreaterThan(0);
        expect(thick).toBe(0.12);
      }
    }
    // the house's walls are its inner walls and the stairs' low banister
    expect(WALLS.house).toEqual([...INNER_WALLS.house, BANISTER]);
    expect(wallsIn('house')).toBe(WALLS.house);
    expect(BANISTER[5]).toBe(true);
    expect(wallsIn('upstairs')).toEqual(expect.arrayContaining(INNER_WALLS.upstairs));
    // the balcony has its railing on the south edge, low
    const rail = wallsIn('upstairs').find((w) => w[5] === true);
    expect(rail).toBeTruthy();
    expect(rail[1]).toBe(rail[3]);
    expect(rail[1]).toBeGreaterThan(AREAS.upstairs.z1 - 0.5);
  });

  it('keeps Morty off the stairs: the flight and its banister are in the way, and the foot is where you go up', () => {
    const run = FURNITURE.find((f) => f.id === 'stair-run');
    const stairs = PLAN.find((r) => r.id === 'stairs');
    expect(run).toMatchObject({ area: 'house', kind: 'stairs', turn: 0 });
    // in the stairs' own room, rising from the foot by the link to the hall's wall
    expect(run.x - run.w / 2).toBeGreaterThanOrEqual(stairs.x0);
    expect(run.x + run.w / 2).toBeLessThanOrEqual(stairs.x1);
    expect(run.z - run.d / 2).toBeGreaterThanOrEqual(stairs.z0);
    expect(run.z + run.d / 2).toBeLessThan(link('stairs-up').z - MORTY.radius);
    // nowhere on the steps to stand
    for (let x = stairs.x0 + 0.05; x < stairs.x1; x += 0.1) for (let z = run.z - run.d / 2; z <= run.z + run.d / 2; z += 0.1) expect(free('house', x, z), `${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(false);
    // walking east from the entry into the side of the flight, he stops at the banister
    const m = walk(newMorty({ x: -297.2, z: 1.3, face: 0 }), { x: 1, z: 0, run: false }, 2, 'house');
    expect(m.x).toBeLessThanOrEqual(BANISTER[0] - MORTY.radius + 1e-6);
    expect(Math.abs(BANISTER[0] - (run.x - run.w / 2))).toBeLessThan(1e-9);
    expect(BANISTER[1]).toBeCloseTo(run.z - run.d / 2, 6);
    expect(BANISTER[3]).toBeCloseTo(run.z + run.d / 2, 6);
    // the foot of the stairs, where the link is, is clear, and walked to from the front door, the hall and the kitchen
    const up = link('stairs-up');
    expect(free('house', up.x, up.z)).toBe(true);
    // (to within half its reach, on the half-metre walking grid)
    for (const from of [link('house-door').arrive, { x: -292.1, z: -0.4 }, link('garage-kitchen').arrive, link('stairs-down').arrive]) expect(canWalk('house', from, up, up.r / 2), `${from.x}, ${from.z}`).toBe(true);
  });

  it('has no way out of the house’s outline: the blocked part south of the kitchen, and the void by the stairs', () => {
    expect(free('house', -303, 4)).toBe(false);
    expect(free('house', -297.6, 3.0)).toBe(true);
    expect(free('house', -297.6, 3.2)).toBe(false);
    expect(free('house', -294.0, 5)).toBe(true);
    expect(free('upstairs', -305, 405)).toBe(false);
    expect(free('upstairs', -303, 407)).toBe(false);
    expect(free('upstairs', -303, 403)).toBe(true);
    expect(free('upstairs', -300, 405)).toBe(true);
  });

  it('can be walked: every room of the ground floor from the front door, every room upstairs from the stairs', () => {
    const down = flood('house', link('house-door').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'house')) expect(down.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
    const up = flood('upstairs', link('stairs-up').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'upstairs')) expect(up.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
    // and from the foot of the stairs too
    const back = flood('house', link('stairs-down').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'house')) expect(back.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
    // and in from the garage, through the kitchen
    const kitchen = flood('house', link('garage-kitchen').arrive).cells;
    for (const r of PLAN.filter((r) => r.area === 'house')) expect(kitchen.some((c) => inRoom(r, c.x, c.z)), r.id).toBe(true);
  });
});

describe('C-137: walking about as Morty', () => {
  it('starts on the sidewalk in front of the house, facing it', () => {
    expect(START.area).toBe('street');
    expect(Math.abs(START.z - ROAD.z)).toBeGreaterThanOrEqual(ROAD.w / 2);
    expect(Math.abs(START.z - ROAD.z)).toBeLessThanOrEqual(ROAD.w / 2 + ROAD.sidewalk);
    // on the house's side of the road, between it and the asphalt
    expect(START.z).toBeLessThan(ROAD.z);
    expect(START.z).toBeGreaterThan(HOUSE.z + HOUSE.d / 2);
    expect(Math.abs(START.x - link('house-door').x)).toBeLessThan(1.5);
    expect(Math.cos(START.face)).toBeCloseTo(0, 6);
    expect(Math.sin(START.face)).toBeCloseTo(1, 6);
    expect(free('street', START.x, START.z)).toBe(true);
    const m = newMorty();
    expect(m).toMatchObject({ x: START.x, z: START.z, face: START.face, vx: 0, vz: 0, speed: 0, running: false });
    expect(newMorty({ x: 1, z: 2, face: 3 })).toMatchObject({ x: 1, z: 2, face: 3 });
  });

  it('walks north for a second at walking pace, and stays out of everything', () => {
    let m = newMorty();
    for (let t = 0; t < 1; t += DT) {
      m = stepMorty(m, { x: 0, z: -1 }, DT, 'street');
      expect(free('street', m.x, m.z)).toBe(true);
    }
    const went = START.z - m.z;
    expect(went).toBeGreaterThan(1.5);
    expect(went).toBeLessThan(MORTY.walk + 0.1);
    expect(Math.abs(m.x - START.x)).toBeLessThan(1e-6);
    expect(m.speed).toBeGreaterThan(MORTY.walk - 0.5);
    expect(m.running).toBe(false);
  });

  it('runs faster than it walks', () => {
    const a = walk(newMorty(), { x: 1, z: 0 }, 1);
    const b = walk(newMorty(), { x: 1, z: 0, run: true }, 1);
    expect(b.x - START.x).toBeGreaterThan(a.x - START.x + 1.5);
    expect(b.running).toBe(true);
  });

  it('walks up the front walk to the porch step, with no invisible wall in front of it', () => {
    const door = link('house-door');
    const porch = HOUSE_PARTS.find((p) => p.id === 'porch');
    const step = porch.z + porch.d / 2;
    const m = walk(newMorty({ x: door.x, z: -9, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    // within half a metre of the step, and at the door
    expect(m.z - step).toBeGreaterThanOrEqual(MORTY.radius - 1e-6);
    expect(m.z - step).toBeLessThanOrEqual(0.5);
    expect(m.x).toBeCloseTo(door.x, 1);
    expect(Math.hypot(m.x - door.x, m.z - door.z)).toBeLessThan(0.1);
    expect(free('street', m.x, m.z)).toBe(true);
    // and along the whole walk, the middle of it is clear
    for (let z = FRONT_WALK.z1; z >= FRONT_WALK.z0; z -= 0.1) expect(free('street', (FRONT_WALK.x0 + FRONT_WALK.x1) / 2, z), `walk at ${z.toFixed(1)}`).toBe(true);
  });

  it('stops at the Smith house’s own walls: the middle’s, the wing’s and the porch’s', () => {
    const part = (id) => HOUSE_PARTS.find((p) => p.id === id);
    const go = (x) => walk(newMorty({ x, z: -9, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    // (up the lawn where it's clear: Jerry's car-ship and Space Beth's ship are parked on the rest)
    expect(go(-4.2).z).toBeCloseTo(part('middle').z + part('middle').d / 2 + MORTY.radius, 1);
    expect(go(4).z).toBeCloseTo(part('wing').z + part('wing').d / 2 + MORTY.radius, 1);
    // and into the corner of the middle and the wing, he is pushed out, never into either
    for (const x of [-4, -3, -2.8]) expect(free('street', go(x).x, go(x).z), String(x)).toBe(true);
  });

  it('stops at the garage door, 3 m ahead of the house’s front, and walks round the garage’s corner', () => {
    const door = link('garage-door');
    const m = walk(newMorty({ x: door.x, z: -8, face: Math.PI / 2 }), { x: 0, z: -1 }, 4);
    expect(m.z).toBeCloseTo(GARAGE.z + GARAGE.d / 2 + MORTY.radius, 1);
    const round = walk(m, { x: 1, z: 0 }, 2.5);
    expect(round.x).toBeGreaterThan(GARAGE.x + GARAGE.w / 2 + MORTY.radius);
    expect(free('street', round.x, round.z)).toBe(true);
  });

  it('stops dead soon after the keys are let go, even from a run', () => {
    let m = walk(newMorty(), { x: 1, z: 0, run: true }, 2);
    expect(m.speed).toBeGreaterThan(MORTY.walk);
    m = walk(m, { x: 0, z: 0 }, 0.5);
    expect(m.speed).toBeLessThan(0.05);
  });

  it('keeps to its own area: the edge of the street, and the walls of a room', () => {
    const west = walk(newMorty(), { x: -1, z: 0, run: true }, 30);
    expect(west.x).toBeCloseTo(AREAS.street.x0 + MORTY.radius, 1);
    const arrive = link('garage-door').arrive;
    // (east down the clear lane between the washer and the worktable, to the kitchen door's wall)
    const east = walk(newMorty({ x: arrive.x, z: 100.9 }), { x: 1, z: 0, run: true }, 6, 'garage');
    expect(east.x).toBeCloseTo(AREAS.garage.x1 - MORTY.radius, 1);
    const south = walk(newMorty(arrive), { x: 0, z: 1, run: true }, 3, 'garage');
    expect(south.z).toBeCloseTo(AREAS.garage.z1 - MORTY.radius, 1);
  });

  it('keeps to the house’s outline: out the back of the entry is the street, so it stops at the front wall', () => {
    const m = walk(newMorty(link('house-door').arrive), { x: 0, z: 1, run: true }, 3, 'house');
    expect(m.z).toBeCloseTo(PLAN.find((r) => r.id === 'entry').z1 - MORTY.radius, 1);
    // and up the hall, through the door gaps, into the back room
    let g = newMorty({ x: -291, z: -0.5, face: 0 });
    g = walk(g, { x: 0, z: 1, run: true }, 2, 'house');
    expect(g.z).toBeGreaterThan(5);
  });

  it('stops at the TV stand in the living room, and at a wall between the rooms', () => {
    const tv = FURNITURE.find((f) => f.id === 'tv');
    // (along the TV's north end, past the coffee table)
    const m = walk(newMorty({ x: -300, z: tv.z - 1.2, face: 0 }), { x: 1, z: 0 }, 4, 'house');
    // the TV is turned a quarter, so its depth is across x
    expect(m.x).toBeCloseTo(tv.x - tv.d / 2 - MORTY.radius, 1);
    // east along the wall between the living room and the entry, from the living room, stops at it
    const wall = walk(newMorty({ x: -299, z: -4, face: -Math.PI / 2 }), { x: 0, z: 1 }, 3, 'house');
    expect(wall.z).toBeCloseTo(-1.9 - 0.12 - MORTY.radius, 1);
  });

  it('is stopped by the parked cruiser only when it is told it is there', () => {
    const near = { x: BOARD.x + 1, z: BOARD.z, face: 0 };
    const without = stepMorty(newMorty(near), { x: 0, z: 0 }, DT, 'street');
    expect(without.x).toBeCloseTo(near.x, 6);
    const withIt = stepMorty(newMorty(near), { x: 0, z: 0 }, DT, 'street', { cruiser: { x: BOARD.x, z: BOARD.z } });
    expect(Math.hypot(withIt.x - BOARD.x, withIt.z - BOARD.z)).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius - 1e-6);
    // walking at it from the road: it stands in the way, then lets go again
    let m = newMorty({ x: BOARD.x, z: -5, face: Math.PI / 2 });
    for (let t = 0; t < 3; t += DT) m = stepMorty(m, { x: 0, z: -1 }, DT, 'street', { cruiser: BOARD });
    expect(m.z).toBeGreaterThanOrEqual(BOARD.z + CRUISER.radius + MORTY.radius - 1e-6);
    m = walk(newMorty({ x: BOARD.x, z: -5 }), { x: 0, z: -1 }, 3);
    expect(m.z).toBeLessThan(BOARD.z);
    // not in a room, and not when it is gone
    const room = link('house-door').arrive;
    expect(stepMorty(newMorty(room), { x: 1, z: 0 }, DT, 'house', { cruiser: room })).toEqual(stepMorty(newMorty(room), { x: 1, z: 0 }, DT, 'house'));
    // and walking out of the garage door never shoves him: he comes out beside the parked cruiser, not in it
    for (const l of LINKS.filter((o) => o.to === 'street')) {
      const out = stepMorty(newMorty(l.arrive), { x: 0, z: 0 }, DT, 'street', { cruiser: BOARD });
      expect(Math.hypot(out.x - l.arrive.x, out.z - l.arrive.z), l.id).toBeLessThan(1e-9);
    }
    expect(stepMorty(newMorty(near), { x: 0, z: 0 }, DT, 'street', { cruiser: null }).x).toBeCloseTo(near.x, 6);
  });

  it('can be walked: from the start to every door in the street, and straight from the road to each', () => {
    const doors = LINKS.filter((l) => l.area === 'street');
    expect(doors.length).toBeGreaterThanOrEqual(3);
    for (const l of doors) {
      expect(canWalk('street', START, l, l.r), l.id).toBe(true);
      // the lane from the sidewalk's far edge to the door is clear
      const edge = Math.sign(l.z) * (ROAD.w / 2 + ROAD.sidewalk);
      for (let k = 0; k <= 1; k += 0.02) expect(free('street', l.x, edge + (l.z - edge) * k), `${l.id} lane`).toBe(true);
    }
  });

  it('can be walked in the annex: from the portal to the arcade and back', () => {
    const arrive = link('garage-portal').arrive;
    expect(canWalk('annex', arrive, link('arcade-door'), link('arcade-door').r)).toBe(true);
    expect(canWalk('annex', link('arcade-exit').arrive, link('annex-portal'), link('annex-portal').r)).toBe(true);
  });
});

describe('C-137: doors, exits and portals', () => {
  it('has the links the world needs, with their labels', () => {
    expect(builtIn(LINKS).map((l) => l.id).sort()).toEqual([
      'annex-portal',
      'arcade-door',
      'arcade-exit',
      'basement-ladder',
      'basement-mind',
      'diner-door',
      'diner-exit',
      'front',
      'garage-door',
      'garage-exit',
      'garage-hatch',
      'garage-kitchen',
      'garage-oval',
      'garage-portal',
      'house-door',
      'kitchen-garage',
      'mind-door',
      'oval-portal',
      'school-door',
      'school-exit',
      'stairs-down',
      'stairs-up',
      'wong-door',
      'wong-exit',
    ]);
    expect(link('diner-door')).toMatchObject({ area: 'street', x: 46, z: -14.4, r: 1.6, to: 'diner', kind: 'door', label: 'Shoney’s' });
    expect(link('diner-exit')).toMatchObject({ area: 'diner', to: 'street', kind: 'exit', label: 'Back outside' });
    expect(link('basement-mind')).toMatchObject({ area: 'basement', to: 'mindblowers', kind: 'door', label: 'Morty’s Mind Blowers' });
    expect(link('mind-door')).toMatchObject({ area: 'mindblowers', to: 'basement', kind: 'door', label: 'Rick’s clone lab' });
    expect(link('garage-oval')).toMatchObject({ area: 'garage', to: 'oval', kind: 'portal', label: 'The Oval Office', needs: 'president' });
    expect(link('oval-portal')).toMatchObject({ area: 'oval', to: 'garage', kind: 'portal', label: 'Back to the garage' });
    // only the President's portal waits on anything
    expect(LINKS.filter((l) => l.needs).map((l) => l.id)).toEqual(['garage-oval']);
    expect(link('house-door')).toMatchObject({ area: 'street', x: -7.2, z: -17.4, r: 1.6, to: 'house', kind: 'door', label: 'Smith house' });
    expect(link('garage-door')).toMatchObject({ area: 'street', x: -19, z: -13.4, r: 1.6, to: 'garage', label: 'Rick’s garage' });
    expect(link('school-door')).toMatchObject({ area: 'street', x: 40, z: 14.4, to: 'school', label: 'Harry Herpson High' });
    expect(link('arcade-door')).toMatchObject({ area: 'annex', x: 400, z: -3.4, to: 'arcade', label: 'Blips and Chitz' });
    expect(link('front')).toMatchObject({ area: 'house', x: -297.6, z: 3, r: 0.9, to: 'street', kind: 'exit', label: 'Back outside' });
    expect(link('kitchen-garage')).toMatchObject({ area: 'house', x: -311.6, z: 1.1, r: 0.9, to: 'garage', kind: 'door' });
    expect(link('garage-kitchen')).toMatchObject({ area: 'garage', r: 0.9, to: 'house', kind: 'door' });
    expect(link('stairs-up')).toMatchObject({ area: 'house', x: -295.1, z: 2.6, to: 'upstairs' });
    expect(link('stairs-down')).toMatchObject({ area: 'upstairs', x: -303, z: 403.4, to: 'house' });
    expect(link('garage-portal')).toMatchObject({ area: 'garage', x: -303, z: 101.4, to: 'annex', kind: 'portal', label: 'Through the portal', arrive: { x: 400, z: 9 } });
    expect(link('annex-portal')).toMatchObject({ area: 'annex', x: 400, z: 13, to: 'garage', kind: 'portal', label: 'Back to the garage', arrive: { x: -301.2, z: 101.4, face: 0 } });
    for (const id of ['garage', 'school', 'arcade']) expect(link(`${id}-exit`)).toMatchObject({ area: id, kind: 'exit', label: 'Back outside' });
    for (const l of LINKS) expect(['door', 'exit', 'portal', 'stairs', 'hatch'], l.id).toContain(l.kind);
  });

  it('lands you in the area it leads to, standing clear, and never on another link', () => {
    for (const l of LINKS) {
      const a = l.arrive;
      expect(areaAt(a.x, a.z), l.id).toBe(l.to);
      expect(free(l.to, a.x, a.z), `${l.id} lands clear`).toBe(true);
      for (const o of LINKS.filter((o) => o.area === l.to)) expect(Math.hypot(a.x - o.x, a.z - o.z), `${l.id} lands by ${o.id}`).toBeGreaterThan(o.r + 0.3);
      expect(nearLink(l.to, a.x, a.z), `${l.id} ping-pong`).toBe(null);
    }
  });

  it('never lands you inside the parked cruiser, wherever you come out into the street', () => {
    const landings = LINKS.filter((l) => l.to === 'street');
    expect(landings.map((l) => l.id).sort()).toEqual(['diner-exit', 'front', 'garage-exit', 'school-exit', 'wong-exit']);
    for (const l of landings) expect(Math.hypot(l.arrive.x - BOARD.x, l.arrive.z - BOARD.z), l.id).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius + 0.3);
  });

  it('turns you to face away from the link you came through', () => {
    for (const l of LINKS) {
      const back = LINKS.filter((o) => o.area === l.to).sort((p, q) => Math.hypot(l.arrive.x - p.x, l.arrive.z - p.z) - Math.hypot(l.arrive.x - q.x, l.arrive.z - q.z))[0];
      const dx = l.arrive.x - back.x;
      const dz = l.arrive.z - back.z;
      const d = Math.hypot(dx, dz);
      const heading = [Math.cos(l.arrive.face), -Math.sin(l.arrive.face)];
      expect((heading[0] * dx + heading[1] * dz) / d, `${l.id} faces`).toBeGreaterThan(0.9);
    }
  });

  it('gives every door from outside an exit back, arriving a little way outside it', () => {
    const doors = LINKS.filter((l) => l.kind === 'door' && OUTDOOR.includes(l.area));
    expect(doors.map((d) => d.id).sort()).toEqual(['arcade-door', 'diner-door', 'garage-door', 'house-door', 'school-door', 'wong-door']);
    for (const door of doors) {
      const exit = LINKS.find((l) => l.kind === 'exit' && l.area === door.to);
      expect(exit, door.id).toBeTruthy();
      expect(exit.to).toBe(door.area);
      const out = Math.hypot(exit.arrive.x - door.x, exit.arrive.z - door.z);
      expect(out, `${door.id} exit`).toBeGreaterThan(door.r + 0.3);
      expect(out, `${door.id} exit`).toBeLessThan(3.5);
    }
  });

  it('puts you at the south end of the garage, the school and the arcade, and in the front entry of the house', () => {
    for (const id of ['garage', 'school', 'arcade']) {
      const door = link(`${id}-door`);
      const exit = link(`${id}-exit`);
      const room = AREAS[id];
      expect(door.arrive.z, id).toBeCloseTo(room.z1 - 2, 6);
      expect(exit.z, id).toBeCloseTo(room.z1 - 0.6, 6);
      expect(door.arrive.x).toBe(-300);
      expect(door.arrive.face).toBeCloseTo(Math.PI / 2, 6);
    }
    expect(link('garage-door').arrive.z).toBe(104);
    expect(link('school-door').arrive.z).toBe(204);
    expect(link('arcade-door').arrive.z).toBe(306);
    const entry = PLAN.find((r) => r.id === 'entry');
    const front = link('house-door').arrive;
    expect(inRoom(entry, front.x, front.z)).toBe(true);
    expect(link('front').x).toBeGreaterThan(entry.x0);
    expect(link('front').x).toBeLessThan(entry.x1);
    expect(link('front').z).toBeCloseTo(entry.z1 - 0.4, 6);
    expect(link('stairs-up').x).toBeGreaterThan(PLAN.find((r) => r.id === 'stairs').x0);
    expect(inRoom(PLAN.find((r) => r.id === 'stairs'), link('stairs-up').x, link('stairs-up').z)).toBe(true);
    expect(inRoom(PLAN.find((r) => r.id === 'stairTop'), link('stairs-down').x, link('stairs-down').z)).toBe(true);
    expect(inRoom(PLAN.find((r) => r.id === 'stairTop'), link('stairs-up').arrive.x, link('stairs-up').arrive.z)).toBe(true);
  });

  it('puts you at the top of the stairs with the hall straight ahead, and a walk north goes on into it', () => {
    const top = link('stairs-up').arrive;
    // a metre or so either way of where you land, the walls slide you into the hall
    for (const dx of [-0.3, 0, 0.3]) {
      const m = walk(newMorty({ ...top, x: top.x + dx }), { x: 0, z: -1 }, 1.5, 'upstairs');
      expect(m.z, `from ${dx}`).toBeLessThan(PLAN.find((r) => r.id === 'upHall').z1);
    }
  });

  it('joins the kitchen to the garage lab both ways, on the kitchen’s west wall and the garage’s east side', () => {
    const k = link('kitchen-garage');
    const g = link('garage-kitchen');
    expect(k.to).toBe(g.area);
    expect(g.to).toBe(k.area);
    expect(k.x).toBeCloseTo(AREAS.house.x0 + MORTY.radius, 6);
    expect(g.x).toBeGreaterThan(AREAS.garage.x1 - 1);
    expect(inRoom(PLAN.find((r) => r.id === 'kitchen'), k.x, k.z)).toBe(true);
    // each puts you well in, clear of the other's reach
    expect(Math.hypot(k.arrive.x - g.x, k.arrive.z - g.z)).toBeGreaterThan(g.r + 0.3);
    expect(Math.hypot(g.arrive.x - k.x, g.arrive.z - k.z)).toBeGreaterThan(k.r + 0.3);
    expect(Math.hypot(k.arrive.x - link('garage-portal').x, k.arrive.z - link('garage-portal').z)).toBeGreaterThan(link('garage-portal').r + 0.3);
  });

  it('keeps every link where Morty can reach and stand, in its own area', () => {
    for (const l of LINKS) {
      expect(areaAt(l.x, l.z), l.id).toBe(l.area);
      expect(free(l.area, l.x, l.z), l.id).toBe(true);
    }
  });

  it('finds the house door at its spot and nothing at the start', () => {
    const door = link('house-door');
    expect(nearLink('street', door.x, door.z).id).toBe('house-door');
    expect(nearLink('street', door.x + 1.5, door.z).id).toBe('house-door');
    expect(nearLink('street', door.x + 1.7, door.z)).toBe(null);
    expect(nearLink('street', START.x, START.z)).toBe(null);
    expect(nearLink('house', door.x, door.z)).toBe(null);
    expect(nearLink('garage', -302.4, 101.4).id).toBe('garage-portal');
    expect(nearLink('house', -297.6, 3).id).toBe('front');
    expect(nearLink('house', -295.1, 2.6).id).toBe('stairs-up');
  });

  it('keeps the President’s portal shut till he’s been met, and the rest open whatever’s done', () => {
    const p = link('garage-oval');
    expect(nearLink('garage', p.x, p.z, []), 'nothing done').toBe(null);
    expect(nearLink('garage', p.x, p.z, ['cable', 'fly']), 'other things done').toBe(null);
    expect(nearLink('garage', p.x, p.z, ['president']).id).toBe('garage-oval');
    expect(nearLink('garage', p.x, p.z).id, 'told nothing: every link counts').toBe('garage-oval');
    for (const l of LINKS.filter((o) => !o.needs)) expect(nearLink(l.area, l.x, l.z, []).id, l.id).toBe(l.id);
    expect(linkOpen(p, [])).toBe(false);
    expect(linkOpen(p, ['president'])).toBe(true);
    expect(linkOpen(link('front'))).toBe(true);
  });

  it('drops Morty down the hatch when he walks out over it, and nowhere else', () => {
    expect(dropAt('garage', HATCH.x, HATCH.z).id).toBe('garage-hatch');
    expect(dropAt('garage', HATCH.x + HATCH.w / 2 - 0.2, HATCH.z - HATCH.d / 2 + 0.2).id).toBe('garage-hatch');
    // on the rim, not yet; and nowhere but the garage
    expect(dropAt('garage', HATCH.x + HATCH.w / 2 - 0.1, HATCH.z)).toBe(null);
    expect(dropAt('garage', HATCH.x, HATCH.z + HATCH.d / 2 + 0.3)).toBe(null);
    expect(dropAt('basement', HATCH.x, HATCH.z)).toBe(null);
    // and where the ladder brings him back up is off it
    const up = link('basement-ladder').arrive;
    expect(dropAt('garage', up.x, up.z)).toBe(null);
    // walking over it from beside it, he drops
    let m = newMorty({ x: HATCH.x + 1.7, z: HATCH.z, face: Math.PI });
    let fell = false;
    for (let t = 0; t < 1 && !fell; t += DT) {
      m = stepMorty(m, { x: -1, z: 0 }, DT, 'garage');
      fell = !!dropAt('garage', m.x, m.z);
    }
    expect(fell).toBe(true);
  });
});

describe('C-137: the things to touch', () => {
  it('has the hotspots the rooms need, with their words', () => {
    expect(builtIn(HOTSPOTS).map((h) => h.id)).toEqual([
      'cable',
      'jerry',
      'beth',
      'butter',
      'egg',
      'summer',
      'mortyroom',
      'rick',
      'meeseeks',
      'plumbus',
      'portalpanic',
      'dial',
      'quiz',
      'principal',
      'jessica',
      'brad',
      'tammy',
      'ethan',
      'tinyrick',
      'roy',
      'cabinet1',
      'cabinet2',
      'cabinet3',
      'clone',
      'console',
      'pickle',
      'chair',
      'president',
      'secretservice',
      'agent1',
      'agent2',
      'agent3',
      'ovalpresident',
      'general1',
      'general2',
      'dineragent',
      'poopybutthole',
      'snuffles',
      'spacebeth',
      'nancy',
      'tricia',
      'diane',
      'therapy',
    ]);
    const at = (id) => HOTSPOTS.find((h) => h.id === id);
    expect(at('cable')).toMatchObject({ area: 'house', r: 1.4, label: 'Watch interdimensional cable', verb: 'Watch' });
    expect(at('jerry')).toMatchObject({ area: 'house', label: 'Jerry', verb: 'Talk' });
    expect(at('beth')).toMatchObject({ area: 'house', label: 'Beth', verb: 'Talk' });
    expect(at('butter')).toMatchObject({ area: 'house', label: 'The butter robot', verb: 'Switch on' });
    expect(at('summer')).toMatchObject({ area: 'upstairs', label: 'Summer', verb: 'Talk' });
    expect(at('mortyroom')).toMatchObject({ area: 'upstairs', label: 'Morty’s room', verb: 'Look round' });
    expect(at('rick')).toMatchObject({ area: 'garage', x: -301.9, z: 99.2, label: 'Rick', verb: 'Talk' });
    expect(at('meeseeks')).toMatchObject({ area: 'garage', x: -301.4, z: 102.4, label: 'Mr. Meeseeks box', verb: 'Press' });
    expect(at('plumbus')).toMatchObject({ area: 'garage', x: -297.45, z: 99, label: 'The plumbus factory', verb: 'Watch' });
    expect(at('portalpanic')).toMatchObject({ area: 'garage', x: -302.45, z: 103.1, label: 'Portal panic cabinet', verb: 'Play' });
    expect(at('quiz')).toMatchObject({ area: 'school', x: -300, z: 196.4, label: 'Mr. Goldenfold’s pop quiz', verb: 'Sit the quiz' });
    expect(at('roy')).toMatchObject({ area: 'arcade', x: -300, z: 293.6, label: 'Roy: A Life Well Lived', verb: 'Put the headset on' });
    for (const id of ['cabinet1', 'cabinet2', 'cabinet3']) expect(at(id)).toMatchObject({ area: 'arcade', verb: 'Play', r: 1.4 });
    for (const h of builtIn(HOTSPOTS)) expect(h.r, h.id).toBe(1.4);
  });

  it('puts everyone where the show has them: Jerry on the couch facing the TV, Beth at the stove, Summer in her room', () => {
    const at = (id) => HOTSPOTS.find((h) => h.id === id);
    const room = (id) => PLAN.find((r) => r.id === id);
    const piece = (id) => FURNITURE.find((f) => f.id === id);
    expect(inRoom(room('living'), at('cable').x, at('cable').z)).toBe(true);
    // the TV is the east wall's, the cable hotspot is just in front of it
    expect(at('cable').x).toBeLessThan(piece('tv').x);
    expect(at('cable').x).toBeGreaterThan(piece('tv').x - piece('tv').d / 2 - 0.6);
    expect(Math.abs(at('cable').z - piece('tv').z)).toBeLessThan(piece('tv').w / 2);
    // Jerry is at the couch, which faces the TV
    expect(Math.hypot(at('jerry').x - piece('couch').x, at('jerry').z - piece('couch').z)).toBeLessThan(1);
    expect(at('jerry').x).toBeLessThan(at('cable').x);
    expect(inRoom(room('kitchen'), at('beth').x, at('beth').z)).toBe(true);
    expect(Math.hypot(at('beth').x - piece('stove').x, at('beth').z - piece('stove').z)).toBeLessThan(1.4);
    expect(inRoom(room('dining'), at('butter').x, at('butter').z)).toBe(true);
    expect(Math.hypot(at('butter').x - piece('table').x, at('butter').z - piece('table').z)).toBeLessThan(piece('table').w / 2 + 0.2);
    expect(inRoom(room('summer'), at('summer').x, at('summer').z)).toBe(true);
    expect(inRoom(room('morty'), at('mortyroom').x, at('mortyroom').z)).toBe(true);
  });

  it('puts every hotspot in front of what it is for, not inside it, but for the ones that sit on a piece', () => {
    // Jerry is on the couch and the butter robot is on the dining table; and
    // Phase 2's sitters, each on what they sit on
    const on = { jerry: 'couch', butter: 'table', dineragent: 'booth2n', poopybutthole: 'couch', spacebeth: 'stool-garage', nancy: 'bed-summer', tricia: 'bed-summer', therapy: 'wong-armchair' };
    for (const h of HOTSPOTS) {
      const inside = FURNITURE.filter((f) => f.area === h.area && pieceDist(f, h.x, h.z) < 1e-9).map((f) => f.id);
      expect(inside, h.id).toEqual(on[h.id] ? [on[h.id]] : []);
    }
    // the others stand clear in front, close enough to have been put there for it
    for (const id of ['cable', 'beth', 'rick', 'meeseeks', 'plumbus', 'portalpanic', 'quiz', 'roy', 'clone', 'console', 'pickle', 'chair', 'ovalpresident', 'egg']) {
      const h = HOTSPOTS.find((o) => o.id === id);
      const nearest = Math.min(...FURNITURE.filter((f) => f.area === h.area).map((f) => pieceDist(f, h.x, h.z)));
      expect(nearest, id).toBeGreaterThan(0.05);
      expect(nearest, id).toBeLessThan(0.7);
    }
  });

  it('finds each at its own spot, and nothing out in the street', () => {
    for (const h of HOTSPOTS) {
      expect(areaAt(h.x, h.z), h.id).toBe(h.area);
      // (with what's done as it is while it's there: one that comes `after`
      // something can stand where another stood `until` it)
      expect(nearHotspot(h.area, h.x, h.z, h.after ? [h.after] : []).id, h.id).toBe(h.id);
    }
    const cable = HOTSPOTS.find((h) => h.id === 'cable');
    expect(nearHotspot('street', START.x, START.z)).toBe(null);
    expect(nearHotspot('house', -300, 3)).toBe(null);
    expect(nearHotspot('house', cable.x + 1.5, cable.z)).toBe(null);
  });

  it('lets Morty stand close enough to every hotspot, and walk there from the way in', () => {
    // (the town round the street's, out to its hedges, ./town/plan.test.js walks to)
    for (const h of HOTSPOTS.filter((o) => !o.town)) {
      let found = false;
      for (let dx = -h.r; dx <= h.r && !found; dx += 0.1) for (let dz = -h.r; dz <= h.r && !found; dz += 0.1) if (Math.hypot(dx, dz) <= h.r - 0.1 && free(h.area, h.x + dx, h.z + dz)) found = true;
      expect(found, `${h.id} can be stood at`).toBe(true);
      expect(canWalk(h.area, startOf(h.area), h, h.r - 0.1, { motorcade: !!h.until }), `${h.id} can be walked to`).toBe(true);
    }
  });

  it('lets Morty walk from the way in to the way out of every room', () => {
    for (const id of ROOM_IDS) expect(canWalk(id, link(WAY_IN[id]).arrive, link(WAY_OUT[id]), link(WAY_OUT[id]).r), id).toBe(true);
    expect(canWalk('garage', link('annex-portal').arrive, link('garage-exit'), 0.9)).toBe(true);
    expect(canWalk('garage', link('garage-door').arrive, link('garage-portal'), link('garage-portal').r)).toBe(true);
    // the garage's kitchen door, in from the kitchen and back
    expect(canWalk('garage', link('kitchen-garage').arrive, link('garage-exit'), 0.9)).toBe(true);
    expect(canWalk('garage', link('garage-door').arrive, link('garage-kitchen'), 0.9)).toBe(true);
    expect(canWalk('house', link('garage-kitchen').arrive, link('stairs-up'), 0.9)).toBe(true);
    expect(canWalk('house', link('garage-kitchen').arrive, link('front'), 0.9)).toBe(true);
    expect(canWalk('house', link('stairs-down').arrive, link('kitchen-garage'), 0.9)).toBe(true);
    expect(canWalk('upstairs', link('stairs-up').arrive, link('stairs-down'), 0.9)).toBe(true);
  });
});

describe('C-137: Rick’s clone lab, under the garage, and Morty’s Mind Blowers', () => {
  const piece = (id) => FURNITURE.find((f) => f.id === id);
  const spot = (id) => HOTSPOTS.find((h) => h.id === id);
  // is (x, z) inside a ring, `pad` in from its wall?
  const inRing = (r, x, z, pad = 0) => ((x - r.x) / (r.a - pad)) ** 2 + ((z - r.z) / (r.b - pad)) ** 2 <= 1;
  // a piece's corners, turned as it is
  const corners = (f) =>
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const lx = (u * f.w) / 2;
      const lz = (v * f.d) / 2;
      return [f.x + lx * Math.cos(f.turn) + lz * Math.sin(f.turn), f.z - lx * Math.sin(f.turn) + lz * Math.cos(f.turn)];
    });

  it('is a round lab, 20 by 16 m, far from the others, walled on its ellipse', () => {
    expect(AREAS.basement).toEqual({ x0: -310, x1: -290, z0: 494, z1: 510 });
    expect(RINGS.basement).toEqual({ x: -300, z: 502, a: 10, b: 8 });
    expect(AREAS.mindblowers).toEqual({ x0: -306, x1: -294, z0: 594, z1: 606 });
    expect(RINGS.mindblowers).toEqual({ x: -300, z: 600, a: 6, b: 6 });
    for (const [id, r] of Object.entries(RINGS)) {
      const walls = ringWalls(r);
      expect(wallsIn(id), id).toEqual(walls);
      // every corner of the ring on the ellipse, and the ellipse inside the area
      for (const [x0, z0] of walls) expect(((x0 - r.x) / r.a) ** 2 + ((z0 - r.z) / r.b) ** 2, id).toBeCloseTo(1, 9);
      expect(r.x - r.a, id).toBeGreaterThanOrEqual(AREAS[id].x0);
      expect(r.x + r.a, id).toBeLessThanOrEqual(AREAS[id].x1);
      expect(r.z - r.b, id).toBeGreaterThanOrEqual(AREAS[id].z0);
      expect(r.z + r.b, id).toBeLessThanOrEqual(AREAS[id].z1);
    }
  });

  it('holds the clone machine in the middle of the back, the desks down both sides, and the ladder', () => {
    const lab = FURNITURE.filter((f) => f.area === 'basement');
    expect(lab.map((f) => f.id)).toEqual(['clone-machine', 'desk-w1', 'desk-w2', 'desk-e1', 'desk-e2', 'ladder']);
    expect(piece('clone-machine')).toMatchObject({ kind: 'clone-machine', x: -300 });
    expect(piece('clone-machine').z).toBeLessThan(RINGS.basement.z);
    for (const id of ['desk-w1', 'desk-w2']) expect(piece(id).x, id).toBeLessThan(-306);
    for (const id of ['desk-e1', 'desk-e2']) expect(piece(id).x, id).toBeGreaterThan(-294);
    // everything stands inside the round wall (but the ladder, against it)
    for (const f of lab.filter((o) => o.kind !== 'ladder')) for (const [x, z] of corners(f)) expect(inRing(RINGS.basement, x, z, 0.1), f.id).toBe(true);
  });

  it('holds the Mind Blowers chair in the middle, the helmet’s cart by it, and vials either side of the way in', () => {
    const room = FURNITURE.filter((f) => f.area === 'mindblowers');
    expect(room.map((f) => f.id)).toEqual(['mind-chair', 'mind-cart', 'vials1', 'vials2']);
    expect(Math.hypot(piece('mind-chair').x - RINGS.mindblowers.x, piece('mind-chair').z - RINGS.mindblowers.z)).toBeLessThan(0.5);
    for (const f of room) for (const [x, z] of corners(f)) expect(inRing(RINGS.mindblowers, x, z, 0.1), f.id).toBe(true);
    // the chair's hotspot at its foot, towards the door
    expect(spot('chair')).toMatchObject({ area: 'mindblowers', label: 'Morty’s Mind Blowers', verb: 'Sit in the chair' });
    expect(spot('chair').z).toBeGreaterThan(piece('mind-chair').z);
  });

  it('goes on from the clone lab’s east door to Morty’s Mind Blowers, and back', () => {
    const door = link('basement-mind');
    expect(door.x).toBeGreaterThan(RINGS.basement.x + RINGS.basement.a - 2.5);
    expect(inRing(RINGS.basement, door.x, door.z)).toBe(true);
    expect(link('mind-door').arrive).toMatchObject({ face: Math.PI });
    expect(Math.hypot(link('mind-door').arrive.x - door.x, link('mind-door').arrive.z - door.z)).toBeLessThan(2);
  });

  it('can be walked: from the foot of the ladder to the tube, the desks and the door on, and in the Mind Blowers to the chair', () => {
    const foot = link('garage-hatch').arrive;
    for (const id of ['clone', 'console', 'pickle']) expect(canWalk('basement', foot, spot(id), 1.3), id).toBe(true);
    expect(canWalk('basement', foot, link('basement-mind'), 0.9)).toBe(true);
    expect(canWalk('mindblowers', link('basement-mind').arrive, spot('chair'), 1.3)).toBe(true);
    // and nobody walks out through the round wall
    for (const id of Object.keys(RINGS)) {
      const { cells } = flood(id, startOf(id));
      for (const c of cells) expect(inRing(RINGS[id], c.x, c.z, MORTY.radius - 0.1), `${id} ${c.x},${c.z}`).toBe(true);
    }
  });

  it('has the tube, the console and Pickle Rick to look at in the lab', () => {
    expect(spot('clone')).toMatchObject({ area: 'basement', label: 'The clone tube', verb: 'Look' });
    expect(spot('console')).toMatchObject({ area: 'basement', label: 'Rick’s console', verb: 'Look' });
    expect(spot('pickle')).toMatchObject({ area: 'basement', label: 'Pickle Rick', verb: 'Look' });
    expect(spot('vats')).toBeUndefined();
  });

  it('plays the memories in their vials’ colours, each a line of its own', () => {
    expect(MEMORIES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(MEMORIES.map((m) => m.id)).size).toBe(MEMORIES.length);
    for (const m of MEMORIES) {
      expect(Object.keys(MEMORY_COLORS), m.id).toContain(m.color);
      expect(m.caption.length, m.id).toBeGreaterThan(20);
      expect(m.caption, m.id).not.toMatch(/!/);
    }
    // every colour the room racks is played, and they don't come two of a colour in a row too often
    expect(new Set(MEMORIES.map((m) => m.color))).toEqual(new Set(Object.keys(MEMORY_COLORS)));
  });
});

describe('C-137: the multiverse’s vehicles on the street', () => {
  // a box's corners, turned, and the rectangle round them
  const corners = (v) =>
    [-1, 1].flatMap((a) =>
      [-1, 1].map((b) => {
        const [u, w] = [(a * v.w) / 2, (b * v.d) / 2];
        return [v.x + u * Math.cos(v.turn) + w * Math.sin(v.turn), v.z - u * Math.sin(v.turn) + w * Math.cos(v.turn)];
      }),
    );
  const rect = (v) => {
    const c = corners(v);
    return { x0: Math.min(...c.map((p) => p[0])), x1: Math.max(...c.map((p) => p[0])), z0: Math.min(...c.map((p) => p[1])), z1: Math.max(...c.map((p) => p[1])) };
  };
  const gap = (r, x, z) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  const apart = (r, q) => r.x1 < q.x0 || r.x0 > q.x1 || r.z1 < q.z0 || r.z0 > q.z1;

  it('parks Space Beth’s ship, Jerry’s car-ship, the Gotron and a ferret, each a model that stands its height', () => {
    expect(VEHICLES.map((v) => v.id)).toEqual(['spacebeth-ship', 'jerry-ship', 'gotron', 'gotron-ferret']);
    expect(VEHICLES.find((v) => v.id === 'gotron').h).toBe(24);
    for (const v of VEHICLES) expect(v.w > 0 && v.d > 0 && v.h > 0, v.id).toBe(true);
  });

  it('keeps them off the road and the sidewalks, clear of every door, landing, person, tree, building, yard and each other', () => {
    for (const v of VEHICLES) {
      const r = rect(v);
      expect(inArea('street', r.x0, r.z0) && inArea('street', r.x1, r.z1), v.id).toBe(true);
      expect(Math.min(Math.abs(r.z0), Math.abs(r.z1)), v.id).toBeGreaterThan(ROAD.w / 2 + ROAD.sidewalk);
      for (const l of LINKS.filter((o) => o.area === 'street')) expect(gap(r, l.x, l.z), `${v.id} at ${l.id}`).toBeGreaterThan(l.r + MORTY.radius);
      for (const l of LINKS.filter((o) => o.to === 'street')) expect(gap(r, l.arrive.x, l.arrive.z), `${v.id} at the landing of ${l.id}`).toBeGreaterThan(MORTY.radius + 0.3);
      expect(gap(r, START.x, START.z), v.id).toBeGreaterThan(1);
      for (const p of PEOPLE.filter((o) => o.area === 'street')) expect(gap(r, p.x, p.z), `${v.id} and ${p.id}`).toBeGreaterThan(1);
      for (const t of TREES) expect(gap(r, t.x, t.z), `${v.id} and the tree at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`).toBeGreaterThan(1);
      for (const b of [...BUILDINGS, ...OUTSKIRTS]) expect(apart(r, { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }), `${v.id} and ${b.id}`).toBe(true);
      for (const y of YARDS) expect(apart(r, y), `${v.id} in a yard`).toBe(true);
      for (const o of VEHICLES.filter((w) => w !== v)) expect(apart(r, rect(o)), `${v.id} and ${o.id}`).toBe(true);
    }
    // the front walk's middle is still clear, all the way to the door
    for (let z = FRONT_WALK.z1; z >= FRONT_WALK.z0; z -= 0.25) expect(free('street', (FRONT_WALK.x0 + FRONT_WALK.x1) / 2, z), `walk at ${z.toFixed(2)}`).toBe(true);
  });

  it('stops Morty at them, and the cruiser flies over them, the Gotron’s head and all, and never lands on one', () => {
    for (const v of VEHICLES) {
      expect(free('street', v.x, v.z), v.id).toBe(false);
      expect(floorAt(v.x, v.z), v.id).toBeGreaterThanOrEqual(v.h + 2);
      expect(canLand({ ...newCruiser(), x: v.x, z: v.z, speed: 0 }), v.id).toBe(false);
    }
  });
});

describe('C-137: the multiverse’s Phase 2, in the house, the garage, upstairs, the clone lab and Dr. Wong’s office', () => {
  const at = (id) => PEOPLE.find((p) => p.id === id);
  const piece = (id) => FURNITURE.find((f) => f.id === id);
  it('opens Dr. Wong’s office in the house west of Shoney’s, with its own way back out', () => {
    expect(WONG_HOUSE).toBe(NEIGHBOURS.find((n) => n.x === 24 && n.z === -20));
    expect(WONG_HOUSE).not.toBe(DINER);
    const door = link('wong-door');
    expect(door).toMatchObject({ area: 'street', x: WONG_HOUSE.x, z: WONG_HOUSE.z + WONG_HOUSE.d / 2 + 0.6, to: 'wong', kind: 'door', label: 'Dr. Wong’s office' });
    expect(link('wong-exit')).toMatchObject({ area: 'wong', to: 'street', kind: 'exit' });
    // the exit's arrival is on the street, outside the door, clear of it
    const out = link('wong-exit').arrive;
    expect(Math.hypot(out.x - door.x, out.z - door.z)).toBeGreaterThan(door.r);
    expect(free('street', out.x, out.z)).toBe(true);
  });
  it('furnishes the office as the show does, with Dr. Wong in her armchair facing the couch', () => {
    const kinds = FURNITURE.filter((f) => f.area === 'wong').map((f) => f.kind);
    expect(kinds).toEqual(['armchair', 'side-table', 'coffee-table', 'couch', 'armchair', 'plant', 'desk']);
    expect(at('drwong')).toMatchObject({ area: 'wong', sits: true });
    expect(pieceDist(piece('wong-armchair'), at('drwong').x, at('drwong').z)).toBe(0);
    // she looks across the table at the couch
    expect(piece('wong-couch').z).toBeGreaterThan(piece('wong-table').z);
    expect(piece('wong-table').z).toBeGreaterThan(at('drwong').z);
    expect(-Math.sin(at('drwong').face)).toBeCloseTo(1, 6);
  });
  it('sits each of Phase 2’s sitters on something, and keeps the hologram out of the way', () => {
    const on = { poopybutthole: 'couch', spacebeth: 'stool-garage', nancy: 'bed-summer', tricia: 'bed-summer', drwong: 'wong-armchair' };
    for (const [id, seat] of Object.entries(on)) {
      expect(at(id).sits, id).toBe(true);
      expect(pieceDist(piece(seat), at(id).x, at(id).z), id).toBe(0);
    }
    // Mr. Poopybutthole shares the couch with Jerry, not his seat
    expect(Math.abs(at('poopybutthole').z - at('jerry').z)).toBeGreaterThan(0.9);
    expect(at('diane')).toMatchObject({ area: 'basement', holo: true });
    expect(collidersIn('basement').find((c) => c.id === 'diane')).toBeUndefined();
    expect(free('basement', at('diane').x, at('diane').z, 0.05)).toBe(true);
  });
});

describe('C-137: the President, the Federation, the Oval Office and Shoney’s', () => {
  const piece = (id) => FURNITURE.find((f) => f.id === id);
  const spot = (id) => HOTSPOTS.find((h) => h.id === id);
  const person = (id) => PEOPLE.find((p) => p.id === id);

  it('parks the limo at the kerb, the President and his agent on the sidewalk beside it, there till he’s met', () => {
    expect(LIMO.z - LIMO.w / 2).toBeGreaterThan(-ROAD.w / 2);
    expect(LIMO.z + LIMO.w / 2).toBeLessThan(0);
    for (const id of ['president', 'secretservice']) {
      const p = person(id);
      expect(p, id).toMatchObject({ area: 'street', until: 'president' });
      expect(Math.abs(p.z), id).toBeGreaterThan(ROAD.w / 2);
      expect(Math.abs(p.z), id).toBeLessThan(ROAD.w / 2 + ROAD.sidewalk);
      expect(Math.abs(p.x - LIMO.x), id).toBeLessThan(LIMO.d / 2);
      expect(spot(id).until, id).toBe('president');
    }
    expect(MOTORCADE.map((c) => c.id)).toEqual(['limo', 'president', 'secretservice']);
    // gone once he's met: not there, not in the way, nothing to talk to
    const standing = (done) => peopleIn('street', done).filter((p) => !p.roams && !p.town).map((p) => p.id);
    expect(standing([])).toEqual(['president', 'secretservice', 'agent1', 'agent2', 'agent3']);
    expect(standing(['president'])).toEqual(['agent1', 'agent2', 'agent3']);
    // the walkers roam the sidewalks, and are never in the way
    for (const p of peopleIn('street', []).filter((p) => p.roams && !p.town)) {
      expect(p.ai?.wander?.length, p.id).toBeGreaterThan(1);
      for (const [, z] of p.ai.wander) expect(Math.abs(z) > ROAD.w / 2 && Math.abs(z) < ROAD.w / 2 + ROAD.sidewalk, `${p.id} on the sidewalk`).toBe(true);
      expect(solidIn('street', {}).some((c) => c.id === p.id), p.id).toBe(false);
    }
    expect(present(person('president'))).toBe(true);
    const s = spot('president');
    expect(nearHotspot('street', s.x, s.z, []).id).toBe('president');
    expect(nearHotspot('street', s.x, s.z, ['president'])).toBe(null);
    expect(nearHotspot('street', s.x, s.z).id).toBe('president');
  });

  it('puts the motorcade in the way only while it’s there, for walking and for landing', () => {
    expect(collidersIn('street').some((c) => c.id === 'limo')).toBe(false);
    expect(collidersIn('street', { motorcade: true }).filter((c) => ['limo', 'president', 'secretservice'].includes(c.id))).toHaveLength(3);
    // walking east along the north lane, into the limo's back
    const from = { x: LIMO.x - LIMO.d / 2 - 2, z: LIMO.z, face: 0 };
    expect(walk(newMorty(from), { x: 1, z: 0 }, 1.5, 'street', { motorcade: true }).x).toBeCloseTo(LIMO.x - LIMO.d / 2 - MORTY.radius, 1);
    expect(walk(newMorty(from), { x: 1, z: 0 }, 1.5, 'street', { motorcade: false }).x).toBeGreaterThan(LIMO.x);
    // and with the cruiser parked too
    expect(walk(newMorty(from), { x: 1, z: 0 }, 1.5, 'street', { cruiser: newCruiser(), motorcade: true }).x).toBeCloseTo(LIMO.x - LIMO.d / 2 - MORTY.radius, 1);
    const onLimo = { ...newCruiser(), x: LIMO.x, z: LIMO.z };
    expect(canLand(onLimo, { motorcade: true })).toBe(false);
    expect(canLand(onLimo)).toBe(true);
  });

  it('posts three Federation agents on the sidewalks, each with a word to say, and in the way', () => {
    const agents = PEOPLE.filter((p) => p.who === 'fedagent' && p.area === 'street' && !p.town);
    expect(agents.map((p) => p.id)).toEqual(['agent1', 'agent2', 'agent3']);
    for (const a of agents) {
      expect(Math.abs(a.z), a.id).toBeGreaterThan(ROAD.w / 2);
      expect(Math.abs(a.z), a.id).toBeLessThan(ROAD.w / 2 + ROAD.sidewalk);
      expect(collidersIn('street').some((c) => c.id === a.id), a.id).toBe(true);
      expect(spot(a.id)).toMatchObject({ area: 'street', label: 'Federation agent', verb: 'Talk' });
      expect(canLand({ ...newCruiser(), x: a.x, z: a.z }), a.id).toBe(false);
    }
    // one of them is outside Shoney's
    expect(agents.some((a) => Math.abs(a.x - DINER.x) < DINER.w / 2 && a.z < 0)).toBe(true);
  });

  it('puts the President’s portal on the garage’s east wall by the garage door, facing in, lit only once he’s met', () => {
    expect(piece('govportal')).toMatchObject({ area: 'garage', kind: 'govportal', x: GOV_PORTAL.x, z: GOV_PORTAL.z, turn: -Math.PI / 2 });
    expect(GOV_PORTAL.x).toBeGreaterThan(AREAS.garage.x1 - 0.3);
    expect(GOV_PORTAL.z).toBeGreaterThan(104);
    const p = link('garage-oval');
    expect(p.x).toBeLessThan(GOV_PORTAL.x - 1);
    expect(p.z).toBe(GOV_PORTAL.z);
    expect(canWalk('garage', link('garage-door').arrive, p, p.r - 0.1)).toBe(true);
  });

  it('furnishes the Oval Office: the desk before the windows with the flags, the President behind it, a general each side, the couches facing', () => {
    expect(RINGS.oval).toEqual({ x: -300, z: 700, a: 8, b: 6 });
    const desk = piece('resolute');
    expect(desk.z).toBeLessThan(RINGS.oval.z - 2);
    expect(person('ovalpresident')).toMatchObject({ who: 'president', area: 'oval', x: desk.x });
    expect(person('ovalpresident').z).toBeLessThan(desk.z - desk.d / 2);
    for (const id of ['flag1', 'flag2']) expect(piece(id).z, id).toBeLessThan(person('ovalpresident').z);
    for (const id of ['general1', 'general2']) expect(person(id), id).toMatchObject({ who: 'general', area: 'oval' });
    expect(person('general1').x).toBeLessThan(desk.x - desk.w / 2);
    expect(person('general2').x).toBeGreaterThan(desk.x + desk.w / 2);
    // the couches face each other over the coffee table
    expect(piece('couch-oval1').turn).toBeCloseTo(Math.PI / 2, 9);
    expect(piece('couch-oval2').turn).toBeCloseTo(-Math.PI / 2, 9);
    expect(piece('couch-oval1').x).toBeLessThan(piece('table-oval').x);
    expect(piece('couch-oval2').x).toBeGreaterThan(piece('table-oval').x);
    // the portal back is at the south end, opposite the desk; the President's spot across the desk from him
    expect(link('oval-portal').z).toBeGreaterThan(RINGS.oval.z + 4);
    expect(spot('ovalpresident').z).toBeGreaterThan(desk.z + desk.d / 2);
    expect(canWalk('oval', link('garage-oval').arrive, spot('ovalpresident'), 1.3)).toBe(true);
  });

  it('opens Shoney’s on the street, with booths by the windows, the counter and its stools, and the agent in the middle booth', () => {
    const door = link('diner-door');
    expect(door.x).toBe(DINER.x);
    expect(door.z).toBeGreaterThan(DINER.z + DINER.d / 2);
    const tables = FURNITURE.filter((f) => f.kind === 'booth-table');
    expect(tables.map((f) => f.id)).toEqual(['booth1', 'booth2', 'booth3']);
    expect(FURNITURE.filter((f) => f.kind === 'booth')).toHaveLength(6);
    for (const t of tables) expect(t.x, t.id).toBeLessThan(-305);
    expect(FURNITURE.filter((f) => f.kind === 'stool' && f.area === 'diner')).toHaveLength(4);
    expect(piece('diner-counter').x).toBeGreaterThan(-294.5);
    const agent = person('dineragent');
    expect(agent).toMatchObject({ who: 'fedagent', area: 'diner', sits: true });
    expect(pieceDist(piece('booth2n'), agent.x, agent.z)).toBe(0);
    expect(collidersIn('diner').some((c) => c.id === 'dineragent')).toBe(false);
    expect(spot('dineragent')).toMatchObject({ label: 'Federation agent', verb: 'Sit down' });
    expect(canWalk('diner', link('diner-door').arrive, spot('dineragent'), 1.3)).toBe(true);
  });
});

describe('C-137: the people', () => {
  it('leaves no one in the way where a dial place’s crowd started, once they roam; who stands still stays solid', () => {
    let roamers = 0;
    for (const d of DESTINATIONS) {
      // (a step off the middle: pushOut can't tell which way to push a point dead on a circle's centre)
      const near = (e, o) => Math.hypot(o.x - e.x, o.z - e.z) < 2.5;
      for (const e of d.extras) {
        if (!e.roams) {
          expect(free(d.id, e.x + 0.1, e.z), `${d.id}: ${e.kind} stands still`).toBe(false);
          continue;
        }
        // (where nothing else stands near)
        if (d.solids.some((o) => near(e, o)) || d.people.some((o) => near(e, o)) || d.extras.some((o) => o !== e && !o.roams && near(e, o))) continue;
        roamers += 1;
        expect(free(d.id, e.x + 0.1, e.z), `${d.id}: ${e.kind} roams`).toBe(true);
      }
    }
    expect(roamers).toBeGreaterThan(10);
  });

  // whose hotspot each is
  const HOTSPOT_OF = { jerry: 'jerry', beth: 'beth', summer: 'summer', rick: 'rick', teacher: 'quiz', drwong: 'therapy' };
  // the people behind a desk, across it from their hotspot
  const ACROSS = ['teacher', 'ovalpresident'];
  // (the class, sat at their desks, are talked to from the aisle beside them)
  const CLASS = ['jessica', 'brad', 'tammy', 'ethan', 'tinyrick'];
  const hotspotOf = (p) => HOTSPOT_OF[p.id] ?? p.id;

  it('has Jerry, Beth, Summer, Rick and the teacher, each in their own room, and the visitors in theirs', () => {
    expect(builtIn(PEOPLE).map((p) => p.id)).toEqual(['jerry', 'beth', 'summer', 'rick', 'teacher', 'president', 'secretservice', 'agent1', 'agent2', 'agent3', 'ovalpresident', 'general1', 'general2', 'principal', 'jessica', 'brad', 'tammy', 'ethan', 'tinyrick', 'dineragent', 'poopybutthole', 'spacebeth', 'nancy', 'tricia', 'diane', 'drwong']);
    expect(builtIn(PEOPLE).map((p) => p.area)).toEqual(['house', 'house', 'upstairs', 'garage', 'school', 'street', 'street', 'street', 'street', 'street', 'oval', 'oval', 'oval', 'school', 'school', 'school', 'school', 'school', 'school', 'diner', 'house', 'garage', 'upstairs', 'upstairs', 'basement', 'wong']);
    // each new one says which model they are, where it's not their id
    for (const p of builtIn(PEOPLE).filter((o) => o.who)) expect(['president', 'fedagent', 'general', 'secretservice'], p.id).toContain(p.who);
    const room = (id) => PLAN.find((r) => r.id === id);
    const at = (id) => PEOPLE.find((p) => p.id === id);
    expect(inRoom(room('living'), at('jerry').x, at('jerry').z)).toBe(true);
    expect(inRoom(room('kitchen'), at('beth').x, at('beth').z)).toBe(true);
    expect(inRoom(room('summer'), at('summer').x, at('summer').z)).toBe(true);
    for (const p of PEOPLE) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.z) && Number.isFinite(p.face), p.id).toBe(true);
      expect(inArea(p.area, p.x, p.z, -0.3), p.id).toBe(true);
    }
    // Jerry is on the couch, facing the TV; the teacher stands behind Goldenfold's desk
    expect(at('jerry').sits).toBe(true);
    expect(pieceDist(FURNITURE.find((f) => f.id === 'couch'), at('jerry').x, at('jerry').z)).toBe(0);
    expect(Math.cos(at('jerry').face)).toBeCloseTo(1, 6);
    const desk = FURNITURE.find((f) => f.id === 'goldenfold-desk');
    expect(at('teacher').z).toBeLessThan(desk.z - desk.d / 2);
    expect(PEOPLE.filter((p) => p.sits).map((p) => p.id)).toEqual(['jerry', ...CLASS, 'dineragent', 'poopybutthole', 'spacebeth', 'nancy', 'tricia', 'drwong']);
  });

  it('puts each one at the hotspot that talks to them: just behind it, or Jerry on the couch', () => {
    for (const p of builtIn(PEOPLE)) {
      const h = HOTSPOTS.find((o) => o.id === hotspotOf(p));
      expect(h, p.id).toBeTruthy();
      expect(h.area, p.id).toBe(p.area);
      expect(h.until, p.id).toBe(p.until);
      // the teacher and the President are across their desks from theirs, with the whole desk between
      expect(Math.hypot(p.x - h.x, p.z - h.z), p.id).toBeLessThan(ACROSS.includes(p.id) || CLASS.includes(p.id) ? 2.2 : 0.4);
      if (!CLASS.includes(p.id)) expect(nearHotspot(p.area, p.x, p.z)?.id, p.id).toBe(ACROSS.includes(p.id) ? undefined : h.id);
    }
  });

  it('makes each who stands a small round thing in the way, clear of the furniture, and Jerry none', () => {
    for (const p of PEOPLE) {
      const c = collidersIn(p.area, { motorcade: true }).find((o) => o.id === p.id);
      // (and a hologram, Diane, is in nobody's way; nor is anyone who roams, the street's walkers)
      if (p.sits || p.holo || p.roams) {
        expect(c, p.id).toBeUndefined();
        continue;
      }
      expect(c, p.id).toMatchObject({ kind: 'circle', x: p.x, z: p.z });
      expect(c.r, p.id).toBeCloseTo(0.3, 6);
      for (const f of FURNITURE.filter((o) => o.area === p.area)) expect(pieceDist(f, p.x, p.z), `${p.id} in ${f.id}`).toBeGreaterThanOrEqual(c.r - 1e-9);
    }
    // Morty cannot walk through Rick
    const rick = PEOPLE.find((p) => p.id === 'rick');
    const m = walk(newMorty({ x: rick.x, z: rick.z + 3, face: Math.PI / 2 }), { x: 0, z: -1 }, 3, 'garage');
    expect(m.z).toBeCloseTo(rick.z + 0.3 + MORTY.radius, 1);
  });
});

describe('C-137: Total Rickall’s floor', () => {
  const living = PLAN.find((r) => r.id === 'living');
  const room = (id) => PLAN.find((r) => r.id === id);
  // is a circle of `rad` at (x, z) clear of the house's walls and of everything
  // in the way of feet there (the dog's bed and the coffee table too), and of `more`?
  const clearOf = (x, z, rad, more = []) => {
    const [px, pz] = pushOut(x, z, rad, [...collidersIn('house'), ...more], wallsIn('house'));
    return Math.hypot(px - x, pz - z) < 1e-6;
  };
  const at = (s) => `${s.x}, ${s.z}`;

  it('has a spot for each of the fourteen in the living room, its floor clear of the furniture, the walls and the next spot’s', () => {
    expect(HOUSE_SPOTS.length).toBeGreaterThanOrEqual(14);
    for (const s of HOUSE_SPOTS) {
      // (a person is 0.3 round, as PEOPLE stand)
      expect(s.r, at(s)).toBeGreaterThanOrEqual(0.3);
      expect(s.x - s.r >= living.x0 && s.x + s.r <= living.x1 && s.z - s.r >= living.z0 && s.z + s.r <= living.z1, at(s)).toBe(true);
      expect(clearOf(s.x, s.z, s.r), at(s)).toBe(true);
      for (const o of HOUSE_SPOTS) if (o !== s) expect(Math.hypot(o.x - s.x, o.z - s.z), `${at(s)} and ${at(o)}`).toBeGreaterThanOrEqual(s.r + o.r - 1e-9);
    }
    // two out on the open floor, with room for the Photography Raptor's tail and Mrs. Refrigerator's arms
    const roomiest = HOUSE_SPOTS.map((s) => s.r).sort((a, b) => b - a);
    expect(roomiest[0]).toBeGreaterThanOrEqual(0.9);
    expect(roomiest[1]).toBeGreaterThanOrEqual(0.65);
  });

  it('keeps them out of the doorways and off the front of the bookcase', () => {
    const band = 0.8;
    let doors = 0;
    for (const [a, b] of DOORS.house.filter((pair) => pair.includes('living'))) {
      const line = shared(room(a), room(b));
      for (const [from, to] of gapsAt(INNER_WALLS.house, line)) {
        doors++;
        const zone = line.axis === 'x' ? { x0: line.at - band, x1: line.at + band, z0: from, z1: to } : { x0: from, x1: to, z0: line.at - band, z1: line.at + band };
        for (const s of HOUSE_SPOTS) expect(Math.hypot(Math.max(zone.x0 - s.x, 0, s.x - zone.x1), Math.max(zone.z0 - s.z, 0, s.z - zone.z1)), `${at(s)} in the ${a} / ${b} door`).toBeGreaterThanOrEqual(s.r);
      }
    }
    expect(doors).toBe(3);
    // where Morty stands to reach its shelves
    const shelf = FURNITURE.find((f) => f.id === 'bookcase-living');
    const out = shelf.d / 2 + MORTY.radius + 0.05;
    const front = { x: shelf.x + Math.sin(shelf.turn) * out, z: shelf.z + Math.cos(shelf.turn) * out };
    expect(clearOf(front.x, front.z, MORTY.radius)).toBe(true);
    for (const s of HOUSE_SPOTS) expect(Math.hypot(front.x - s.x, front.z - s.z), at(s)).toBeGreaterThanOrEqual(s.r + MORTY.radius);
  });

  it('turns each one to face into the room', () => {
    const mid = centre(living);
    for (const s of HOUSE_SPOTS) expect(Math.cos(s.face) * (mid.x - s.x) - Math.sin(s.face) * (mid.z - s.z), at(s)).toBeGreaterThan(0.9 * Math.hypot(mid.x - s.x, mid.z - s.z));
  });

  it('leaves Morty a way in from the dining room and up to each of them, with someone as big as the spot allows on every one', () => {
    const crowd = HOUSE_SPOTS.map((s, i) => ({ kind: 'circle', id: `spot${i}`, x: s.x, z: s.z, r: s.r }));
    const S = 0.1;
    // from the arch to the dining room, over tenth-of-a-metre squares of the living room's floor
    const a = { x: -303.7, z: -2 };
    const ok = (x, z) => inRoom(living, x, z) && inArea('house', x, z, -MORTY.radius) && clearOf(x, z, MORTY.radius, crowd);
    expect(ok(a.x, a.z)).toBe(true);
    const seen = new Set(['0,0']);
    const queue = [[0, 0]];
    const cells = [];
    while (queue.length) {
      const [i, j] = queue.shift();
      cells.push({ x: a.x + i * S, z: a.z + j * S });
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${i + di},${j + dj}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (ok(a.x + (i + di) * S, a.z + (j + dj) * S)) queue.push([i + di, j + dj]);
      }
    }
    // near enough to look each of them in the eye: within a little over a metre of them
    for (const s of HOUSE_SPOTS) expect(Math.min(...cells.map((c) => Math.hypot(c.x - s.x, c.z - s.z))), at(s)).toBeLessThanOrEqual(s.r + 1.2);
  });

  it('has the egg on the bookcase: a thing to touch that starts it, clear of everyone’s spot, and not to be reached from the kitchen', () => {
    const egg = HOTSPOTS.find((h) => h.id === 'egg');
    expect(egg).toMatchObject({ area: 'house', label: 'A strange egg', verb: 'Pick it up', kind: 'rickall', r: 1.4 });
    expect(inRoom(living, egg.x, egg.z)).toBe(true);
    // the bookcase the nearest thing to it, and Morty clear of everything there
    const near = FURNITURE.filter((f) => f.area === 'house')
      .map((f) => [f.id, pieceDist(f, egg.x, egg.z)])
      .sort((a, b) => a[1] - b[1]);
    expect(near[0][0]).toBe('bookcase-living');
    expect(clearOf(egg.x, egg.z, MORTY.radius)).toBe(true);
    // with someone on every spot, he can still stand at it
    for (const s of HOUSE_SPOTS) expect(Math.hypot(egg.x - s.x, egg.z - s.z), at(s)).toBeGreaterThanOrEqual(s.r + MORTY.radius);
    // and from nowhere in the kitchen, through the wall, is it the thing he's next to
    const kitchen = room('kitchen');
    for (let x = kitchen.x0; x <= kitchen.x1; x += 0.1) for (let z = kitchen.z0; z <= kitchen.z1; z += 0.1) if (free('house', x, z)) expect(nearHotspot('house', x, z)?.id, `${x}, ${z}`).not.toBe('egg');
  });

  it('keeps Morty in the living room while it’s on, among the crowd', () => {
    expect(newMorty().mode).toBe(null);
    expect(newMorty({ x: -301, z: -4.5 }, 'rickall').mode).toBe('rickall');
    expect(stepMorty(newMorty({ x: -303.7, z: -2.6 }, 'rickall'), { x: 0, z: 0 }, DT, 'house').mode).toBe('rickall');
    expect(stepMorty(newMorty({ x: -303.7, z: -2.6 }), { x: 0, z: 0 }, DT, 'house').mode).toBe(null);
    // out through the arch to the dining room, the kitchen door and the den's: not while it's on
    for (const [from, move] of [
      [{ x: -303.7, z: -2.6 }, { x: 0, z: 1 }],
      [{ x: -305.6, z: -5.1 }, { x: -1, z: 0 }],
      [{ x: -297.8, z: -7.1 }, { x: 1, z: 0 }],
    ]) {
      const away = walk(newMorty(from), move, 2, 'house');
      expect(inRoom(living, away.x, away.z), `${from.x}, ${from.z}`).toBe(false);
      const kept = walk(newMorty(from, 'rickall'), move, 2, 'house');
      expect(inRoom(living, kept.x, kept.z), `${from.x}, ${from.z}`).toBe(true);
      expect(kept.mode).toBe('rickall');
    }
    // brought in, if he's outside it when it starts
    const back = stepMorty(newMorty({ x: -303, z: -1.2 }, 'rickall'), { x: 0, z: 0 }, DT, 'house');
    expect(inRoom(living, back.x, back.z)).toBe(true);
    expect(free('house', back.x, back.z)).toBe(true);
    // and someone standing in his way stops him, as they stand in the game
    const from = { x: -304, z: -3.8, face: Math.PI / 2 };
    expect(walk(newMorty(from, 'rickall'), { x: 0, z: -1 }, 1.5, 'house').z).toBeLessThan(-6.5);
    const crowd = [{ id: 'hamurai', x: -304, z: -5.6, r: 0.3 }];
    const stopped = walk(newMorty(from, 'rickall'), { x: 0, z: -1 }, 1.5, 'house', { crowd });
    expect(stopped.z).toBeGreaterThan(-5.6 + 0.3 + MORTY.radius - 0.05);
  });
});

describe('C-137: the cruiser', () => {
  const fly = (c, input, seconds, each) => {
    for (let t = 0; t < seconds; t += DT) {
      c = stepCruiser(c, input, DT);
      each?.(c);
    }
    return c;
  };

  it('starts parked on its spot, at hover height, at rest', () => {
    expect(newCruiser()).toEqual({ x: BOARD.x, z: BOARD.z, y: CRUISER.hover, yaw: BOARD.yaw, speed: 0, vy: 0, bank: 0, bankV: 0 });
  });

  it('reaches its top speed under full throttle, and never leaves where it flies (well past the street)', () => {
    const inside = (c) => expect(c.x >= FLY.x0 + 2 - 1e-9 && c.x <= FLY.x1 - 2 + 1e-9 && c.z >= FLY.z0 + 2 - 1e-9 && c.z <= FLY.z1 - 2 + 1e-9).toBe(true);
    expect(FLY.x1).toBeGreaterThan(AREAS.street.x1 + 100);
    expect(FLY.z1).toBeGreaterThan(AREAS.street.z1 + 100);
    // along the road, from the west end, with room to get there
    let c = fly({ ...newCruiser(), x: -57, z: 0, yaw: Math.PI / 2 }, { throttle: 1, steer: 0, lift: 0 }, 5, inside);
    expect(Math.abs(c.speed - CRUISER.top)).toBeLessThanOrEqual(1);
    // and out in every direction from the driveway, into the edge and past it
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI, 0.7, -2.4]) {
      c = fly({ ...newCruiser(), yaw }, { throttle: 1, steer: 0, lift: 1 }, 8, inside);
      expect(c.speed).toBeLessThanOrEqual(CRUISER.top + 1e-6);
    }
  });

  it('slows to nothing when nosed into the edge of where it flies, and slides on along it when it only skims it', () => {
    const edge = FLY.x1 - 2;
    const head = fly({ ...newCruiser(), x: edge - 8, z: 0, yaw: Math.PI / 2 }, { throttle: 1 }, 4);
    expect(head.x).toBeCloseTo(edge, 6);
    expect(head.z).toBeCloseTo(0, 6);
    expect(head.speed).toBeLessThan(0.5);
    // skimming: nose a little east of south along the east edge
    const skim = fly({ ...newCruiser(), x: edge, z: -30, yaw: 0.15 }, { throttle: 1 }, 3);
    expect(skim.x).toBeCloseTo(edge, 6);
    expect(skim.z).toBeGreaterThan(-30 + 15);
    expect(skim.speed).toBeGreaterThan(5);
    expect(skim.speed).toBeLessThan(CRUISER.top);
    // and when it flies free, nothing scales it
    const free = fly({ ...newCruiser(), x: -57, z: 0, yaw: Math.PI / 2, speed: 10 }, { throttle: 1 }, 1);
    expect(free.speed).toBeCloseTo(10 + CRUISER.accel, 0);
    // the same at the other edges
    expect(fly({ ...newCruiser(), z: FLY.z1 - 10, yaw: 0 }, { throttle: 1 }, 3).speed).toBeLessThan(0.5);
    expect(fly({ ...newCruiser(), x: FLY.x0 + 10, z: 0, yaw: -Math.PI / 2 }, { throttle: 1 }, 3).speed).toBeLessThan(0.5);
  });

  it('speeds up and slows down at its own pace, and can go back', () => {
    const a = fly(newCruiser(), { throttle: 1 }, 1);
    expect(a.speed).toBeCloseTo(CRUISER.accel, 0);
    const b = fly({ ...newCruiser(), yaw: Math.PI / 2, x: -20 }, { throttle: 0 }, 1);
    expect(b.speed).toBe(0);
    const slowing = fly({ ...newCruiser(), speed: CRUISER.top }, { throttle: 0 }, 1);
    expect(slowing.speed).toBeCloseTo(CRUISER.top - CRUISER.accel, 0);
    const back = fly({ ...newCruiser(), yaw: Math.PI / 2, x: 20 }, { throttle: -1 }, 3);
    expect(back.speed).toBeLessThan(0);
  });

  it('flies the way its nose points: yaw 0 is south, a quarter turn is east, and steering turns it', () => {
    const south = fly({ ...newCruiser(), z: -20 }, { throttle: 1 }, 1);
    expect(south.z).toBeGreaterThan(-20);
    expect(south.x).toBeCloseTo(BOARD.x, 6);
    const east = fly({ ...newCruiser(), x: -40, yaw: Math.PI / 2 }, { throttle: 1 }, 1);
    expect(east.x).toBeGreaterThan(-40);
    expect(east.z).toBeCloseTo(BOARD.z, 6);
    const left = fly(newCruiser(), { steer: 1 }, 1);
    const right = fly(newCruiser(), { steer: -1 }, 1);
    expect(left.yaw).toBeCloseTo(CRUISER.turn, 6);
    expect(right.yaw).toBeCloseTo(-CRUISER.turn, 6);
    expect(fly(newCruiser(), {}, 1)).toEqual({ ...newCruiser(), bump: 0 });
  });

  it('leans into a turn at speed, and not when it is still', () => {
    const still = fly(newCruiser(), { steer: 1 }, 1);
    expect(still.bank).toBeCloseTo(0, 6);
    const fast = fly({ ...newCruiser(), x: -40, z: -30, yaw: Math.PI / 2, speed: CRUISER.top }, { throttle: 1, steer: 1 }, 0.5);
    expect(fast.bank).toBeGreaterThan(0.2);
    const other = fly({ ...newCruiser(), x: -40, z: -30, yaw: Math.PI / 2, speed: CRUISER.top }, { throttle: 1, steer: -1 }, 0.5);
    expect(other.bank).toBeLessThan(-0.2);
  });

  it('leans on a spring: let go of the turn and it swings a little past level, then settles', () => {
    let c = fly({ ...newCruiser(), x: -40, z: -30, yaw: Math.PI / 2, speed: CRUISER.top }, { throttle: 1, steer: 1 }, 1);
    let least = Infinity;
    for (let t = 0; t < 2; t += DT) {
      c = stepCruiser(c, { throttle: 1 }, DT);
      least = Math.min(least, c.bank);
    }
    expect(least).toBeLessThan(-0.005);
    expect(least).toBeGreaterThan(-0.1);
    expect(Math.abs(c.bank)).toBeLessThan(0.01);
    // as steady at a 30th of a second
    let slow = { ...newCruiser(), x: -40, z: -30, yaw: Math.PI / 2, speed: CRUISER.top };
    for (let t = 0; t < 3; t += 1 / 30) slow = stepCruiser(slow, { throttle: 1, steer: t < 1 ? 1 : 0 }, 1 / 30);
    expect(Math.abs(slow.bank)).toBeLessThan(0.02);
  });

  it('climbs under lift and stops at the ceiling', () => {
    const c = fly(newCruiser(), { lift: 1 }, 20);
    expect(c.y).toBeCloseTo(CRUISER.ceiling, 6);
    expect(CRUISER.ceiling).toBeGreaterThanOrEqual(100);
    const a = fly(newCruiser(), { lift: 1 }, 1);
    expect(a.y).toBeGreaterThan(CRUISER.hover + 3);
    expect(a.y).toBeLessThan(CRUISER.hover + CRUISER.climb + 0.01);
    // and it comes back down, but not below its hover
    const down = fly(c, { lift: -1 }, 20);
    expect(down.y).toBeCloseTo(CRUISER.hover, 6);
  });

  it('keeps above the roofs: two metres over the top of whatever it is over', () => {
    expect(floorAt(0, 0)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z)).toBe(HOUSE.roof + 2);
    expect(floorAt(GARAGE.x, GARAGE.z)).toBe(GARAGE.roof + 2);
    // (the school's floor is its parts', below)
    expect(floorAt(SCHOOL.x, SCHOOL.z)).toBeGreaterThan(SCHOOL.roof);
    for (const n of NEIGHBOURS) expect(floorAt(n.x, n.z), n.id).toBe(n.roof + 2);
    // padded by the cruiser's own size, so it clears the eaves
    expect(floorAt(HOUSE.x + HOUSE.w / 2 + CRUISER.radius - 0.1, HOUSE.z)).toBe(HOUSE.roof + 2);
    expect(floorAt(HOUSE.x + HOUSE.w / 2 + CRUISER.radius + 0.1, HOUSE.z)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z + HOUSE.d / 2 + CRUISER.radius + 0.1)).toBe(CRUISER.hover);
    expect(floorAt(HOUSE.x, HOUSE.z - HOUSE.d / 2 - CRUISER.radius - 0.1)).toBe(CRUISER.hover);
    // where the garage and the house both lie under it, the higher roof wins
    expect(floorAt(GARAGE.x + GARAGE.w / 2, GARAGE.z)).toBe(HOUSE.roof + 2);
    expect(floorAt(GARAGE.x, GARAGE.z)).toBe(GARAGE.roof + 2);

    let over = 0;
    // from the west along the house's own line, at the lowest it will go
    fly({ ...newCruiser(), x: -40, z: HOUSE.z, yaw: Math.PI / 2 }, { throttle: 1 }, 5, (c) => {
      if (Math.abs(c.x - HOUSE.x) < HOUSE.w / 2 && Math.abs(c.z - HOUSE.z) < HOUSE.d / 2) {
        over++;
        expect(c.y).toBeGreaterThanOrEqual(HOUSE.roof + 2 - 0.01);
      }
      expect(c.y).toBeGreaterThanOrEqual(floorAt(c.x, c.z) - 1e-9);
    });
    expect(over).toBeGreaterThan(5);
    // pressing down over a roof does not take it through
    const held = fly({ ...newCruiser(), x: HOUSE.x, z: HOUSE.z, y: HOUSE.roof + 4 }, { lift: -1 }, 5);
    expect(held.y).toBeCloseTo(HOUSE.roof + 2, 6);
  });

  it('only lands slowly, on open ground in the street', () => {
    expect(canLand(newCruiser())).toBe(true);
    expect(canLand({ ...newCruiser(), speed: 2.9 })).toBe(true);
    expect(canLand({ ...newCruiser(), speed: 3.1 })).toBe(false);
    expect(canLand({ ...newCruiser(), speed: -3.1 })).toBe(false);
    for (const b of [HOUSE, GARAGE, SCHOOL, ...NEIGHBOURS]) expect(canLand({ ...newCruiser(), x: b.x, z: b.z, y: b.roof + 2 }), b.id).toBe(false);
    expect(canLand({ ...newCruiser(), x: HOUSE.x, z: HOUSE.z + HOUSE.d / 2 + CRUISER.radius - 0.1 })).toBe(false);
    expect(canLand({ ...newCruiser(), x: -30, z: 0 })).toBe(true);
    expect(canLand({ ...newCruiser(), x: 200, z: 0 })).toBe(false);
    for (const o of OUTSKIRTS) expect(canLand({ ...newCruiser(), x: o.x, z: o.z, y: o.roof + 2 }), o.id).toBe(false);
  });

  it('never lands in a fenced back yard', () => {
    expect(YARDS).toHaveLength(7);
    for (const y of YARDS) {
      // a fence runs along the back of each
      expect(FENCES.some(([x0, z0, x1, z1]) => x0 === y.x0 && x1 === y.x1 && z0 === z1 && (z0 === y.z0 || z0 === y.z1)), `${y.x0}, ${y.z0}`).toBe(true);
      for (let x = y.x0; x <= y.x1; x += 1) for (let z = y.z0; z <= y.z1; z += 1) expect(canLand({ ...newCruiser(), x, z }), `${x}, ${z}`).toBe(false);
      // but it can land just outside the back fence
      const out = y.z0 < 0 ? y.z0 - 2.5 : y.z1 + 2.5;
      let landed = false;
      for (let x = y.x0; x <= y.x1; x += 1) landed ||= canLand({ ...newCruiser(), x, z: out });
      expect(landed, `behind ${y.x0}`).toBe(true);
    }
  });

  it('never lands on a tree, but can land beside one', () => {
    const sidewalk = TREES.filter((t) => Math.abs(t.z) < 10);
    expect(sidewalk.length).toBeGreaterThan(5);
    for (const t of sidewalk) {
      expect(canLand({ ...newCruiser(), x: t.x, z: t.z }), 'on it').toBe(false);
      const reach = CRUISER.radius + 0.45 * t.s;
      const toward = -Math.sign(t.z);
      expect(canLand({ ...newCruiser(), x: t.x, z: t.z + toward * (reach - 0.05) }), 'touching it').toBe(false);
      expect(canLand({ ...newCruiser(), x: t.x, z: t.z + toward * (reach + 0.05) }), 'beside it').toBe(true);
    }
  });

  // the street's doors, and where Morty comes out into the street
  const DOORS = LINKS.filter((l) => l.area === 'street');
  const ARRIVALS = LINKS.filter((l) => l.to === 'street').map((l) => ({ id: l.id, ...l.arrive }));
  // how near the cruiser's middle Morty's can be without his being inside it
  const BODY = CRUISER.radius + MORTY.radius;

  it('never sets down where Morty comes out of a door, nor on a door', () => {
    expect(DOORS.map((l) => l.id).sort()).toEqual(['diner-door', 'garage-door', 'house-door', 'school-door', 'wong-door']);
    for (const a of ARRIVALS) expect(canLand({ ...newCruiser(), x: a.x, z: a.z }), a.id).toBe(false);
    for (const l of DOORS) expect(canLand({ ...newCruiser(), x: l.x, z: l.z + Math.sign(-l.z) * (l.r - 0.1) }), l.id).toBe(false);
    // the ones the review found: over the house's way out, and hard by the garage's and the school's doors
    expect(canLand({ ...newCruiser(), x: -9.3, z: -15 })).toBe(false);
    expect(canLand({ ...newCruiser(), x: -19.2, z: -12.3 })).toBe(false);
    expect(canLand({ ...newCruiser(), x: 39.7, z: 14 })).toBe(false);
    // and it still parks on its spot in the driveway
    expect(canLand(newCruiser())).toBe(true);
  });

  it('wherever it can land, leaves every street door somewhere to stand and every way out into the street clear', () => {
    // each door's spots Morty can stand on within its reach, the door's own first
    const spots = DOORS.map((l) => {
      const out = [];
      for (let i = -16; i <= 16; i++)
        for (let j = -16; j <= 16; j++) {
          const x = l.x + i * 0.1;
          const z = l.z + j * 0.1;
          if (Math.hypot(x - l.x, z - l.z) < l.r && free('street', x, z)) out.push({ x, z, d: Math.hypot(x - l.x, z - l.z) });
        }
      return { id: l.id, out: out.sort((p, q) => p.d - q.d) };
    });
    for (const s of spots) expect(s.out.length, s.id).toBeGreaterThan(0);
    // every 10 cm within 4.5 m of each door and each way out
    const blocked = [];
    const onTop = [];
    let landed = 0;
    for (const p of [...DOORS, ...ARRIVALS])
      for (let i = -45; i <= 45; i++)
        for (let j = -45; j <= 45; j++) {
          const c = { ...newCruiser(), x: p.x + i * 0.1, z: p.z + j * 0.1 };
          if (!canLand(c)) continue;
          landed++;
          for (const s of spots) if (!s.out.some((o) => Math.hypot(o.x - c.x, o.z - c.z) >= BODY)) blocked.push(`${s.id} by ${c.x.toFixed(1)}, ${c.z.toFixed(1)}`);
          for (const a of ARRIVALS) if (Math.hypot(a.x - c.x, a.z - c.z) < BODY) onTop.push(`${a.id} under ${c.x.toFixed(1)}, ${c.z.toFixed(1)}`);
        }
    expect(blocked.slice(0, 3)).toEqual([]);
    expect(onTop.slice(0, 3)).toEqual([]);
    // (and there was somewhere to land round them all the same)
    expect(landed).toBeGreaterThan(1000);
  });

  // Where it might be set down, and where Morty steps out: a 2 m grid across the street, and a band
  // along both sides of every fence (where an exit could end up across it), at four headings. Worked
  // out once, and only the failures are written down, so a pass costs nothing to report.
  let exits = null;
  const exitsFrom = () => {
    if (exits) return exits;
    const spots = [];
    for (let x = -57; x <= 57; x += 2) for (let z = -37; z <= 37; z += 2) spots.push([x, z]);
    for (const [x0, z0, x1, z1] of FENCES) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      for (let t = 0; t <= len; t += 1)
        for (const off of [-3.5, -2.5, -1.5, -0.8, -0.3, 0.3, 0.8, 1.5, 2.5, 3.5]) spots.push([x0 + ((x1 - x0) * t) / len + nx * off, z0 + ((z1 - z0) * t) / len + nz * off]);
    }
    exits = [];
    for (const [x, z] of spots)
      for (const yaw of [0, 1, 2.5, -2]) {
        const c = { ...newCruiser(), x, z, yaw };
        if (canLand(c)) exits.push({ c, out: exitCruiser(c) });
      }
    return exits;
  };
  const where = ({ c, out }) => `from ${c.x.toFixed(2)}, ${c.z.toFixed(2)}, ${c.yaw} to ${out.x.toFixed(2)}, ${out.z.toFixed(2)}`;

  it('lets Morty out beside it, standing clear, wherever it can land', () => {
    const e = exitCruiser(newCruiser());
    expect(free('street', e.x, e.z)).toBe(true);
    expect(Math.hypot(e.x - BOARD.x, e.z - BOARD.z)).toBeGreaterThanOrEqual(CRUISER.radius + MORTY.radius);
    expect(Math.hypot(e.x - BOARD.x, e.z - BOARD.z)).toBeLessThan(4);
    expect(Math.cos(e.face)).toBeCloseTo(Math.sin(BOARD.yaw), 6);
    expect(-Math.sin(e.face)).toBeCloseTo(Math.cos(BOARD.yaw), 6);
    const bad = exitsFrom().filter((o) => !free('street', o.out.x, o.out.z) || Math.hypot(o.out.x - o.c.x, o.out.z - o.c.z) < CRUISER.radius + MORTY.radius - 1e-6);
    expect(bad.slice(0, 3).map(where)).toEqual([]);
    expect(exitsFrom().length).toBeGreaterThan(5000);
  });

  it('lets Morty out on the cruiser’s own side of every fence, on ground he can walk back to the start from', () => {
    // every spot the start can walk to, on half-metre squares
    const S = 0.5;
    const reach = new Set(flood('street', START).cells.map((c) => `${Math.round((c.x - START.x) / S)},${Math.round((c.z - START.z) / S)}`));
    const connected = (x, z) => {
      const i0 = Math.round((x - START.x) / S);
      const j0 = Math.round((z - START.z) / S);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (reach.has(`${i0 + di},${j0 + dj}`) && Math.hypot(START.x + (i0 + di) * S - x, START.z + (j0 + dj) * S - z) < 0.7) return true;
      return false;
    };
    const across = exitsFrom().filter((o) => FENCES.some((f) => crosses(o.c.x, o.c.z, o.out.x, o.out.z, f)));
    expect(across.slice(0, 3).map(where)).toEqual([]);
    const stuck = exitsFrom().filter((o) => !connected(o.out.x, o.out.z));
    expect(stuck.slice(0, 3).map(where)).toEqual([]);
  }, 30000);
});

describe('C-137: what there is to do', () => {
  it('lists the seventeen things, in order, each with a name and a hint', () => {
    expect(TASKS.filter((t) => !DESTINATIONS.some((d) => d.tasks.includes(t)) && !TOWN_TASKS.includes(t)).map((t) => t.id)).toEqual(['cable', 'butter', 'meeseeks', 'plumbus', 'portalpanic', 'quiz', 'fly', 'president', 'oval', 'diner', 'portal', 'basement', 'mindblowers', 'roy', 'roy55', 'rickall', 'wong']);
    // meeting the President comes before his office, which his portal needs
    expect(TASKS.findIndex((t) => t.id === 'president')).toBeLessThan(TASKS.findIndex((t) => t.id === 'oval'));
    expect(TASKS.find((t) => t.id === 'basement')).toEqual({ id: 'basement', name: 'Find Rick’s secret lab', hint: 'There’s a hatch in the garage floor.' });
    expect(TASKS.find((t) => t.id === 'rickall').name).toBe('Survive Total Rickall');
    for (const t of TASKS) {
      expect(t.name.length, t.id).toBeGreaterThan(3);
      expect(t.hint.length, t.id).toBeGreaterThan(10);
      expect(t.hint, t.id).not.toMatch(/!/);
    }
  });

  it('ticks the cruiser on its first chase won, as the fly task’s hint says', () => {
    expect(TASKS.find((t) => t.id === 'fly')).toEqual({ id: 'fly', name: 'Fly the cruiser', hint: 'Board Rick’s space cruiser in the driveway, then fly it through the rings over the street with the Federation ship on your tail.' });
  });

  it('starts at the cable, and moves on as things are done, in whatever order', () => {
    const p = progress([]);
    expect(p).toMatchObject({ done: [], count: 0, total: TASKS.length });
    expect(p.next.id).toBe('cable');
    expect(p.objective).toBe(TASKS[0].hint);
    expect(progress().next.id).toBe('cable');
    const q = progress(['roy', 'cable']);
    expect(q.count).toBe(2);
    expect(q.done).toEqual(['cable', 'roy']);
    expect(q.next.id).toBe('butter');
    expect(q.objective).toBe(TASKS[1].hint);
    // strangers and repeats do not count
    expect(progress(['cable', 'cable', 'nonsense']).count).toBe(1);
  });

  it('says so when it is all done', () => {
    const p = progress(TASKS.map((t) => t.id));
    expect(p.count).toBe(TASKS.length);
    expect(p.total).toBe(TASKS.length);
    expect(p.next).toBe(null);
    expect(p.objective).toBe('Everything’s done. Wubba lubba dub dub.');
  });
});

describe('C-137: the pop quiz', () => {
  it('has ten questions, each with four different answers and one right one', () => {
    expect(QUIZ).toHaveLength(10);
    for (const q of QUIZ) {
      expect(q.q.endsWith('?'), q.q).toBe(true);
      expect(q.options, q.q).toHaveLength(4);
      expect(new Set(q.options).size, q.q).toBe(4);
      expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, q.q).toBe(true);
    }
    expect(new Set(QUIZ.map((q) => q.answer)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(QUIZ.map((q) => q.q)).size).toBe(10);
  });

  it('gets the show right', () => {
    const right = (re) => {
      const q = QUIZ.find((x) => re.test(x.q));
      expect(q, String(re)).toBeTruthy();
      return q.options[q.answer];
    };
    expect(right(/home dimension/i)).toBe('C-137');
    expect(right(/arcade/i)).toBe('Blips and Chitz');
    expect(right(/how old was Roy/i)).toBe('55');
    expect(right(/family therapy/i)).toBe('a pickle');
    expect(right(/Meeseeks/i)).toBe('complete one task, then vanish');
    expect(right(/butter robot/i)).toBe('pass the butter');
    expect(right(/Birdperson/i)).toBe('Bird World');
    expect(right(/floating heads/i)).toBe('Show me what you got');
    expect(right(/Jerry/i)).toBe('Hungry for apples?');
    expect(right(/Morty’s sister/i)).toBe('Summer');
  });

  it('grades the answer key ten out of ten and a pass, and all wrong as nought and a fail', () => {
    expect(grade(QUIZ.map((q) => q.answer))).toEqual({ right: 10, total: 10, pass: true });
    expect(grade(QUIZ.map((q) => (q.answer + 1) % 4))).toEqual({ right: 0, total: 10, pass: false });
  });

  it('passes at seven, and counts unanswered questions as wrong', () => {
    const key = QUIZ.map((q) => q.answer);
    const wrong = (n) => key.map((a, i) => (i < n ? (a + 1) % 4 : a));
    expect(grade(wrong(3))).toMatchObject({ right: 7, pass: true });
    expect(grade(wrong(4))).toMatchObject({ right: 6, pass: false });
    expect(grade([])).toEqual({ right: 0, total: 10, pass: false });
    expect(grade(key.slice(0, 7))).toMatchObject({ right: 7, pass: true });
    expect(grade(undefined)).toMatchObject({ right: 0, pass: false });
  });
});

describe('C-137: jumping', () => {
  // a jump (on the first step only), then `seconds` more of `move`
  const hop = (m, move, seconds, area = 'street', opts) => {
    m = stepMorty(m, { ...move, jump: true }, DT, area, opts);
    return walk(m, move, seconds, area, opts);
  };
  const at = (area, x, z) => newMorty({ x, z, face: 0 });
  const thing = (id) => FURNITURE.find((f) => f.id === id);

  it('goes up and comes down where he stood, about 0.8 m at the top', () => {
    let m = stepMorty(newMorty(), { jump: true }, DT, 'street');
    expect(m.air).toBe(true);
    let top = 0;
    for (let t = 0; t < 1.5; t += DT) {
      m = stepMorty(m, {}, DT, 'street');
      top = Math.max(top, m.y);
    }
    expect(top).toBeGreaterThan(0.7);
    expect(top).toBeLessThan(0.9);
    expect(m).toMatchObject({ x: START.x, z: START.z, y: 0, vy: 0, air: false });
    expect(CLIMB).toBeCloseTo(MORTY.step + top, 1);
  });

  it('jumps only from his feet', () => {
    let m = stepMorty(newMorty(), { jump: true }, DT, 'street');
    m = walk(m, {}, 0.2, 'street');
    const vy = m.vy;
    m = stepMorty(m, { jump: true }, DT, 'street');
    expect(m.vy).toBeLessThan(vy);
  });

  it('walks up the stoop’s steps to the front door, and jumps off its side to the lawn', () => {
    const [stoop] = STOOP;
    let m = walk(at('street', -7.2, -14.6), { x: 0, z: -1 }, 3);
    expect(m.y).toBe(stoop.top);
    expect(m.z).toBeLessThan(stoop.z);
    expect(nearLink('street', m.x, m.z).id).toBe('house-door');
    // off the side: down to the lawn
    m = walk(m, { x: 1, z: 0 }, 0.9);
    expect(m.x).toBeGreaterThan(stoop.x + stoop.w / 2);
    expect(m.y).toBe(0);
    // and back up it only by jumping
    const blocked = walk(m, { x: -1, z: 0 }, 1);
    expect(blocked.x).toBeGreaterThan(stoop.x + stoop.w / 2);
    expect(blocked.y).toBe(0);
    const up = hop(m, { x: -1, z: 0 }, 0.7);
    expect(up.y).toBe(stoop.top);
    expect(up.x).toBeLessThan(stoop.x + stoop.w / 2);
  });

  it('jumps up onto the kitchen counter, the couch and Morty’s bed, and walks off them', () => {
    const counter = thing('counter');
    let m = hop(at('house', counter.x + 1.3, counter.z), { x: -1, z: 0 }, 1, 'house');
    expect(m.y).toBe(counter.h);
    expect(m.x).toBeLessThan(counter.x + counter.d / 2);
    m = walk(m, { x: 1, z: 0 }, 1, 'house');
    expect(m.y).toBe(0);
    const couch = thing('couch');
    expect(hop(at('house', couch.x + 1.4, couch.z - 1), { x: -1, z: 0 }, 0.45, 'house').y).toBe(couch.h);
    const bed = thing('bed-morty');
    expect(hop(at('upstairs', bed.x - bed.d / 2 - 0.6, bed.z), { x: 1, z: 0 }, 0.45, 'upstairs').y).toBe(bed.h);
    // walking into them, he doesn't climb them
    expect(walk(at('house', counter.x + 1.3, counter.z), { x: -1, z: 0 }, 1, 'house').y).toBe(0);
  });

  it('can’t get onto anything taller than a jump, or with no room under the ceiling', () => {
    const fridge = thing('fridge');
    expect(fridge.h).toBeGreaterThan(CLIMB);
    const m = hop(at('house', fridge.x, fridge.z + 1.4), { x: 0, z: -1 }, 1, 'house');
    expect(m.y).toBe(0);
    expect(m.z).toBeGreaterThan(fridge.z + fridge.d / 2);
    for (const c of solidIn('house')) expect(c.top == null || c.top > CLIMB || c.top + MORTY.height > CEILING.house, c.id).toBe(true);
  });

  it('never puts his head through a ceiling', () => {
    const counter = thing('counter');
    let m = hop(at('house', counter.x + 1.3, counter.z), { x: -1, z: 0 }, 1, 'house');
    let top = 0;
    m = stepMorty(m, { jump: true }, DT, 'house');
    for (let t = 0; t < 1; t += DT) {
      m = stepMorty(m, {}, DT, 'house');
      top = Math.max(top, m.y);
    }
    expect(top + MORTY.height).toBeLessThanOrEqual(CEILING.house + 1e-9);
    expect(m.y).toBe(counter.h);
  });

  it('stands on the highest thing under him, and the floor elsewhere', () => {
    const [stoop, step1, step2] = STOOP;
    expect(supportAt('street', stoop.x, stoop.z, stoop.top)).toBe(stoop.top);
    expect(supportAt('street', step2.x, step2.z + 0.1, 0)).toBe(step2.top);
    // too high to step up onto from the lawn
    expect(supportAt('street', stoop.x, stoop.z, 0)).toBe(0);
    expect(supportAt('street', step1.x, step1.z, step2.top)).toBe(step1.top);
    expect(supportAt('street', START.x, START.z, 0)).toBe(0);
  });

  it('only drops down the hatch on his feet', () => {
    expect(dropAt('garage', HATCH.x, HATCH.z, 0)?.id).toBe('garage-hatch');
    expect(dropAt('garage', HATCH.x, HATCH.z, 0.5)).toBe(null);
  });
});


describe('C-137: a jump that lands (lib/press.js)', () => {
  const off = () => {
    // walked off the stoop’s side, the step he leaves it on
    const [stoop] = STOOP;
    let m = newMorty({ x: stoop.x + 1, z: stoop.z, face: 0 });
    m = { ...m, y: stoop.top };
    for (let t = 0; t < 2 && !m.air; t += DT) m = stepMorty(m, { x: 1, z: 0 }, DT, 'street');
    expect(m.air).toBe(true);
    return m;
  };
  const late = (seconds) => {
    const press = createPress();
    press.ground(true, 0);
    let m = off();
    for (let t = 0; t < seconds - 1e-9; t += DT) m = stepMorty(m, {}, DT, 'street', { press });
    press.press();
    return stepMorty(m, {}, DT, 'street', { press });
  };

  it('jumps when the press came a moment before his feet touched (the buffer)', () => {
    const press = createPress();
    let m = stepMorty(newMorty(), { jump: true }, DT, 'street');
    // down until he’s a moment from the ground
    while (m.vy > 0 || m.y > 0.3) m = stepMorty(m, {}, DT, 'street', { press });
    press.press();
    let jumped = false;
    for (let t = 0; t < 0.12 && !jumped; t += DT) {
      m = stepMorty(m, {}, DT, 'street', { press });
      jumped = m.vy > 0;
    }
    expect(jumped).toBe(true);
  });

  it('jumps a moment after he walked off an edge (coyote time), and not long after', () => {
    expect(late(0.06).vy).toBeCloseTo(MORTY.jump - MORTY.gravity * DT, 6);
    expect(late(0.15).vy).toBeLessThan(0);
  });

  it('jumps once a press, and not again from the air', () => {
    const press = createPress();
    press.press();
    let m = stepMorty(newMorty(), {}, DT, 'street', { press });
    expect(m.vy).toBeGreaterThan(0);
    press.press();
    m = stepMorty(m, {}, DT, 'street', { press });
    expect(m.vy).toBeLessThan(MORTY.jump - MORTY.gravity * DT);
  });

  it('says how hard he landed, on the step he lands', () => {
    let m = stepMorty(newMorty(), { jump: true }, DT, 'street');
    let land = 0;
    for (let t = 0; t < 1.5; t += DT) {
      m = stepMorty(m, {}, DT, 'street');
      if (m.land) land = m.land;
    }
    expect(land).toBeGreaterThan(MORTY.jump * 0.9);
    expect(land).toBeLessThan(MORTY.jump * 1.1);
    expect(m.land).toBe(0);
  });
});

describe('C-137: the cruiser’s bump', () => {
  it('says how much speed the edge of where it flies took, and nothing in open air', () => {
    let c = { ...newCruiser(), x: FLY.x1 - 2.2, z: 0, y: 40, yaw: Math.PI / 2, speed: CRUISER.top };
    c = stepCruiser(c, { throttle: 1 }, DT);
    c = stepCruiser(c, { throttle: 1 }, DT);
    expect(c.bump).toBeGreaterThan(CRUISER.top * 0.5);
    expect(stepCruiser({ ...newCruiser(), x: 0, z: 0, y: 40, speed: 10 }, { throttle: 1 }, DT).bump).toBe(0);
  });

  it('says how fast it came down onto a roof or the ground', () => {
    const c = stepCruiser({ ...newCruiser(), x: 0, z: 0, y: CRUISER.hover + 0.05, vy: -8 }, { lift: -1 }, DT);
    expect(c.bump).toBeGreaterThan(5);
  });
});

describe('the cruiser on its loadout and the skill tree (the pages hand it statsOf’s numbers)', () => {
  const stock = { boost: 1, accel: 1, cruise: 1, agility: 1 };
  it('is the stock cruiser with stock numbers, or none', () => {
    expect(cruiserOf(stock)).toEqual(CRUISER);
    expect(cruiserOf(null)).toEqual(CRUISER);
  });
  it('takes the cruise and the boost on its top speed, the accel on its pick-up, the agility on its turn and climb', () => {
    const k = cruiserOf({ boost: 1.2, accel: 1.15, cruise: 1.1, agility: 1.08 });
    expect(k.top).toBeCloseTo(CRUISER.top * 1.2 * 1.1);
    expect(k.accel).toBeCloseTo(CRUISER.accel * 1.15);
    expect(k.turn).toBeCloseTo(CRUISER.turn * 1.08);
    expect(k.climb).toBeCloseTo(CRUISER.climb * 1.08);
    expect(k.hover).toBe(CRUISER.hover);
    expect(k.ceiling).toBe(CRUISER.ceiling);
  });
  it('keeps a wild number to between 0.7 and 1.6 of stock', () => {
    expect(cruiserOf({ boost: 3, cruise: 3, accel: 0.1, agility: Number.NaN }).top).toBeCloseTo(CRUISER.top * 1.6);
    expect(cruiserOf({ boost: 3, cruise: 3, accel: 0.1 }).accel).toBeCloseTo(CRUISER.accel * 0.7);
    expect(cruiserOf({ agility: Number.NaN }).turn).toBe(CRUISER.turn);
  });
  it('flies further in a second on faster numbers', () => {
    let a = newCruiser();
    let b = newCruiser();
    const fast = cruiserOf({ boost: 1.3, cruise: 1.2, accel: 1.3 });
    for (let i = 0; i < 60; i++) {
      a = stepCruiser(a, { throttle: 1 }, 1 / 60);
      b = stepCruiser(b, { throttle: 1 }, 1 / 60, fast);
    }
    expect(b.speed).toBeGreaterThan(a.speed);
  });
});

describe('a place’s ledges', () => {
  const PLACES = new Set(DESTINATIONS.map((d) => d.id));
  const C137 = Object.keys(AREAS).filter((id) => !PLACES.has(id));

  it('keeps C-137’s reach: nothing there is a ledge, and what’s too tall to jump onto stays in the way', () => {
    expect(C137).toEqual(expect.arrayContaining(['street', 'house', 'upstairs', 'garage', 'school', 'arcade', 'basement', 'mindblowers', 'oval', 'diner', 'wong', 'annex']));
    for (const area of C137) {
      for (const c of collidersIn(area)) expect(c.ledge, `${area} ${c.id}`).toBeUndefined();
      const solid = new Set(solidIn(area).map((c) => c.id));
      for (const c of collidersIn(area).filter((o) => o.top != null && o.top > CLIMB)) expect(solid.has(c.id), `${area} ${c.id} (${c.top} m)`).toBe(true);
    }
  });

  it('stands Morty on a ledge however high, under the ceiling, and on anything else only within his reach', () => {
    expect(standable('street', { top: 1.5, ledge: true })).toBe(true);
    expect(standable('street', { top: 20.9, ledge: true })).toBe(true);
    expect(standable('street', { top: 1.5 })).toBe(false);
    expect(standable('street', { top: 0.45 })).toBe(true);
    expect(standable('street', { ledge: true })).toBe(false);
    // (in the house a 1.2 m ledge leaves him 2.8 m to the top of his hair, under a 2.6 m ceiling)
    expect(standable('house', { top: 1.2, ledge: true })).toBe(false);
  });

  it('leaves a place with no ledges as it was', () => {
    const froopy = collidersIn('froopyland');
    expect(froopy.length).toBeGreaterThan(0);
    expect(froopy.some((c) => c.ledge || c.top != null)).toBe(false);
    expect(solidIn('froopyland').map((c) => c.id)).toEqual(froopy.map((c) => c.id));
  });
});
