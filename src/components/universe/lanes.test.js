import { describe, expect, it } from 'vitest';
import { bezier, clearance, dockScale, dockable, flybyLane, laneBetween, laneDock, laneLength, meteorLane, tangent } from './lanes';
import { SHIP, parkAt, spawn } from './ship';
import { MAP_RADIUS, ORDER, UNIVERSE_RADIUS } from './layout';

// the same "random" every run
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('a lane', () => {
  it('runs from its first point to its last, along its tangent', () => {
    const pts = [
      [0, 0, 0],
      [5, 2, 0],
      [10, 0, 0],
    ];
    expect(bezier(pts, 0)).toEqual([0, 0, 0]);
    expect(bezier(pts, 1)).toEqual([10, 0, 0]);
    expect(bezier(pts, 0.5)).toEqual([5, 1, 0]);
    expect(tangent(pts, 0.5)).toEqual([10, 0, 0]);
    expect(laneLength(pts)).toBeGreaterThan(10);
    expect(laneLength(pts)).toBeLessThan(11);
  });
});

describe('everyday traffic', () => {
  it('never meets a planet, a station or the sun, and stays off the disc you fly on', () => {
    const rand = seeded(7);
    let made = 0;
    for (let n = 0; n < 300; n++) {
      const high = n % 5 === 0;
      const pts = laneBetween(rand, { high });
      if (!pts) continue; // (no clear way between the two it picked: nothing flies)
      made++;
      expect(clearance(pts), `lane ${n}`).toBeGreaterThan(0.5);
      for (let i = 0; i <= 20; i++) expect(Math.abs(bezier(pts, i / 20)[1] - SHIP.height), `lane ${n}`).toBeGreaterThan(2.5);
    }
    expect(made).toBeGreaterThan(250);
  });

  it('flies between places inside the map, and the big ships right across it', () => {
    const rand = seeded(3);
    for (let n = 0; n < 50; n++) {
      const pts = laneBetween(rand);
      if (pts) for (const p of [pts[0], pts[2]]) expect(Math.hypot(p[0], p[2])).toBeLessThan(UNIVERSE_RADIUS + 24); // (the worlds are out in their neighbourhoods)
      const big = laneBetween(rand, { high: true });
      if (big) expect(laneLength(big)).toBeGreaterThan(MAP_RADIUS);
    }
  });
});

describe('traffic where you are', () => {
  it('curves round the place and leaves it, clear of everything, within sight', async () => {
    const { laneLocal, laneDepart } = await import('./lanes');
    const { PLACES } = await import('./deep');
    let made = 0;
    PLACES.forEach((place, i) => {
      const rand = seeded(20 + i);
      for (let n = 0; n < 12; n++) {
        for (const [make, within] of [
          [laneLocal, place.reach + 24.5 + place.reach * 0.35],
          [laneDepart, place.reach + 17.5],
        ]) {
          const pts = make(place, rand, { high: n % 4 === 0 });
          if (!pts) continue;
          made++;
          expect(clearance(pts), `${place.id} ${n}`).toBeGreaterThan(0.5);
          // it starts or ends beside the place
          const near = Math.min(...[pts[0], pts[2]].map((p) => Math.hypot(p[0] - place.at[0], p[2] - place.at[2])));
          expect(near, `${place.id} ${n}`).toBeLessThan(within);
        }
      }
    });
    expect(made).toBeGreaterThan(PLACES.length * 12);
  });
});

describe('a flyby', () => {
  it('crosses in front of the nose, close enough to hit with a shot', () => {
    const rand = seeded(13);
    let made = 0;
    for (const id of ORDER) {
      const at = parkAt(id);
      const ship = { ...spawn(null), x: at.x, z: at.z, heading: at.heading + Math.PI };
      const pts = flybyLane(ship, rand, { cross: true });
      if (!pts) continue;
      made++;
      expect(clearance(pts)).toBeGreaterThan(0.6);
      // somewhere along it, it's right in front of the ship: on the line a shot flies
      const fwd = [-Math.sin(ship.heading), -Math.cos(ship.heading)];
      let best = Infinity;
      for (let i = 0; i <= 200; i++) {
        const p = bezier(pts, i / 200);
        const along = (p[0] - ship.x) * fwd[0] + (p[2] - ship.z) * fwd[1];
        const off = Math.abs((p[0] - ship.x) * fwd[1] - (p[2] - ship.z) * fwd[0]);
        if (along > 2) best = Math.min(best, off);
      }
      expect(best).toBeLessThan(0.2);
    }
    expect(made).toBeGreaterThan(ORDER.length / 2);
  });

  it('comes from ahead, passes close beside the ship without touching it, and goes on behind', () => {
    const rand = seeded(11);
    let made = 0;
    for (const id of ORDER) {
      const at = parkAt(id);
      const ship = { ...spawn(null), x: at.x, z: at.z, heading: at.heading + Math.PI }; // facing away from the planet
      for (let n = 0; n < 4; n++) {
        const pts = flybyLane(ship, rand, { cross: false });
        if (!pts) continue;
        made++;
        expect(clearance(pts)).toBeGreaterThan(0.6);
        let closest = Infinity;
        for (let i = 0; i <= 100; i++) {
          const p = bezier(pts, i / 100);
          closest = Math.min(closest, Math.hypot(p[0] - ship.x, p[1] - ship.y, p[2] - ship.z));
        }
        expect(closest).toBeGreaterThan(0.7);
        expect(closest).toBeLessThan(2.4);
        // starts in front of the ship, ends behind it
        const fwd = [-Math.sin(ship.heading), -Math.cos(ship.heading)];
        const along = (p) => (p[0] - ship.x) * fwd[0] + (p[2] - ship.z) * fwd[1];
        expect(along(pts[0])).toBeGreaterThan(10);
        expect(along(pts[2])).toBeLessThan(-3);
      }
    }
    expect(made).toBeGreaterThan(ORDER.length * 3); // nearly always there's a way past
  });

  it('is skipped when it would go through a planet', () => {
    const at = parkAt('marvel');
    const ship = { ...spawn(null), x: at.x, z: at.z, heading: at.heading }; // facing the planet, close
    const rand = seeded(5);
    for (let n = 0; n < 20; n++) {
      const pts = flybyLane(ship, rand);
      if (pts) expect(clearance(pts)).toBeGreaterThan(0.6);
    }
  });
});

describe('lanes out in deep space', () => {
  it('finds lanes near the ship out there, clear of everything', async () => {
    const { laneNear, convoyLane, clearance, bezier } = await import('./lanes');
    const { DEEP } = await import('./deep');
    let rand = seeded(5);
    let made = 0;
    for (let i = 0; i < 40; i++) {
      const a = i * 0.7;
      const ship = { x: Math.cos(a) * (DEEP.open + 60 + i * 9), y: (i % 5) * 10 - 20, z: Math.sin(a) * (DEEP.open + 60 + i * 9), heading: a };
      for (const make of [laneNear, convoyLane]) {
        const pts = make(ship, rand);
        if (!pts) continue;
        made++;
        expect(clearance(pts)).toBeGreaterThan(1.4);
        // it passes within sight of the ship
        let near = Infinity;
        for (let k = 0; k <= 50; k++) {
          const p = bezier(pts, k / 50);
          near = Math.min(near, Math.hypot(p[0] - ship.x, p[1] - ship.y, p[2] - ship.z));
        }
        expect(near).toBeLessThan(60);
        expect(near).toBeGreaterThan(3);
      }
      rand = seeded(5 + i);
    }
    expect(made).toBeGreaterThan(60);
  });
});

describe('a meteor stream', () => {
  it('runs straight across the ship’s path ahead, at its height, clear of everything, or not at all', () => {
    const rand = seeded(29);
    let made = 0;
    const ships = [...ORDER.map((id) => ({ ...parkAt(id), y: 0, speed: 0 })), { x: 0, y: 0.3, z: 400, heading: 0, speed: 0 }, { x: -2500, y: 120, z: 3000, heading: 1.1, speed: 0 }];
    for (const s of ships) {
      for (let n = 0; n < 6; n++) {
        const lane = meteorLane(s, rand);
        if (!lane) continue;
        made++;
        const [from, to] = lane;
        const pts = [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], to];
        expect(clearance(pts), `${s.x},${s.z}`).toBeGreaterThan(3);
        // ahead of the nose, from one side to the other, level with the ship
        const [fx, fz] = [-Math.sin(s.heading), -Math.cos(s.heading)];
        for (const p of [from, to]) {
          expect((p[0] - s.x) * fx + (p[2] - s.z) * fz).toBeGreaterThan(40);
          expect(Math.abs(p[1] - s.y)).toBeLessThan(2.01);
        }
        const side = (p) => (p[0] - s.x) * -fz + (p[2] - s.z) * fx;
        expect(Math.sign(side(from))).not.toBe(Math.sign(side(to)));
        expect(Math.hypot(to[0] - from[0], to[2] - from[2])).toBeGreaterThan(100);
      }
    }
    expect(made).toBeGreaterThan(ships.length * 3);
  });
});

describe('coming in to land, and launching', () => {
  it('knows where a ship can land: a planet, a station, a giant; not a star, the black hole, a nebula, the Citadel or a gate', async () => {
    const { PLACES } = await import('./deep');
    const kinds = Object.fromEntries(PLACES.map((p) => [p.id, dockable(p)]));
    expect(kinds.maw).toBe(false);
    expect(kinds.ember).toBe(false);
    expect(kinds.veil).toBe(false);
    expect(kinds.aurelia).toBe(true);
    expect(kinds.citadel).toBe(false); // (its solid is far rounder than the station drawn)
    expect(kinds.starwars).toBe(false); // (a gate, flown through)
    expect(PLACES.filter((p) => p.kind === 'planet' && p.id !== 'starwars').every((p) => dockable(p))).toBe(true);
    expect(dockable({ id: 'x', at: [0, 0, 0], reach: 5 })).toBe(true); // (a planet, as it comes)
  });

  it('ends on the place, high on one side of it, from well out, clear of everything else, and launches the other way', async () => {
    const { PLACES } = await import('./deep');
    const { SOLIDS } = await import('./ship');
    let made = 0;
    for (const place of PLACES.filter(dockable)) {
      const body = SOLIDS.find((o) => o.id === place.id)?.r ?? place.reach * 0.5;
      const others = SOLIDS.filter((o) => o.id !== place.id && !o.id.startsWith(`${place.id}-`));
      const rand = seeded(40 + made);
      for (let n = 0; n < 6; n++) {
        const out = n % 2 === 1;
        const pts = laneDock(place, rand, { out });
        if (!pts) continue;
        made++;
        const [start, end] = out ? [pts[2], pts[0]] : [pts[0], pts[2]];
        const dist = (p) => Math.hypot(p[0] - place.at[0], p[1] - place.at[1], p[2] - place.at[2]);
        expect(dist(end), `${place.id} ${n}: on the body`).toBeLessThan(body * 1.1);
        expect(dist(end), `${place.id} ${n}: not inside it`).toBeGreaterThan(body * 0.99);
        expect(Math.abs(end[1] - place.at[1]), `${place.id} ${n}: high on one side`).toBeGreaterThan(body * 0.4);
        expect(dist(start), `${place.id} ${n}: from well out`).toBeGreaterThan(place.reach + 7);
        expect(clearance(pts, others), `${place.id} ${n}: clear of the rest`).toBeGreaterThan(0.5);
        // clear of the place itself until the last stretch (the first, launching)
        for (let i = 0; i <= 20; i++) {
          const k = out ? 0.35 + (i / 20) * 0.65 : (i / 20) * 0.65;
          expect(dist(bezier(pts, k)), `${place.id} ${n}: clear till the end`).toBeGreaterThan(body + 0.2);
        }
      }
    }
    expect(made).toBeGreaterThan(PLACES.filter(dockable).length * 3);
    expect(laneDock(PLACES.find((p) => p.id === 'maw'), seeded(1))).toBeNull();
  });

  it('shrinks a ship into the place over the last stretch, and grows one out of it over the first', () => {
    expect(dockScale('in', 0)).toBe(1);
    expect(dockScale('in', 0.5)).toBe(1);
    expect(dockScale('in', 0.95)).toBeGreaterThan(0);
    expect(dockScale('in', 0.95)).toBeLessThan(1);
    expect(dockScale('in', 1)).toBe(0);
    expect(dockScale('out', 0)).toBe(0);
    expect(dockScale('out', 0.05)).toBeGreaterThan(0);
    expect(dockScale('out', 0.5)).toBe(1);
    expect(dockScale(null, 0.99)).toBe(1);
  });
});
