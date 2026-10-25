import { describe, expect, it } from 'vitest';
import { PARK_GAP } from '../ship';
import { UNIVERSE, fullSector, moonAt, orbitAt, thingRow } from '../../expanse/shared/gen';
import { resolvePlace } from './resolve';
import { parkDistance, parkPlace } from './park';
import { AROUND, aimStars, hereZone, orbitingPlace, placesAround } from './around';

const sectors = new Map([[1, 0, 0], [2, 0, 0], [1, 1, 0]].map(([x, y, z]) => fullSector(UNIVERSE, x, y, z)).map((s) => [s.id, s]));
const s = sectors.get('E:1,0');
const one = new Map([['E:1,0', s]]);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const xyz = (k) => [k.x, k.y, k.z];
const still = (k) => ({ x: k.x, y: k.y, z: k.z, speed: 0 });
const all = { ...AROUND, max: Infinity };

describe('what’s round the ship', () => {
  it('lists every star within the far plane, nearest first, and stops at its cap', () => {
    const cam = [s.systems[5].at[0] + s.systems[5].reach + 500, s.systems[5].at[1], s.systems[5].at[2]]; // (in system 5's span + inside)
    const rows = placesAround(sectors, cam, 0, all);
    const want = [...sectors.values()].flatMap((x) => x.systems).filter((x) => len(x.at, cam) - x.star.size * 2 <= AROUND.far).map((x) => x.id);
    expect(rows.filter((r) => r.place === 'system').map((r) => r.id).sort()).toEqual(want.sort());
    for (let i = 1; i < rows.length; i++) expect(rows[i].dist).toBeGreaterThanOrEqual(rows[i - 1].dist);
    // (the cap keeps the nearest by distance from the middle, as the disc layer does; every body of a
    // system the camera is in, which near.js builds and the disc layer gives way to, rides outside it)
    const home = (r) => (r.place === 'system' ? r.src.row : r.src.system);
    const inside = (r) => Boolean(home(r)) && len(home(r).at, cam) <= home(r).reach + AROUND.inside;
    const mid = (r) => len(r.at, cam);
    expect(rows.some(inside)).toBe(true);
    const capped = placesAround(sectors, cam, 0, { ...AROUND, max: 10 });
    expect(capped.filter(inside).map((r) => r.id).sort()).toEqual(rows.filter(inside).map((r) => r.id).sort());
    const rest = rows.filter((r) => !inside(r)).sort((a, b) => mid(a) - mid(b));
    expect(capped.filter((r) => !inside(r)).map((r) => r.id).sort()).toEqual(rest.slice(0, 10).map((r) => r.id).sort());
  });
  it('puts planets and moons where their orbits have them, as discs from far off, and the station and the parks only once near the system', () => {
    const sys = s.systems.find((x) => s.stations.some((st) => st.i === x.i) && x.planets.some((p) => p.moonList.length));
    const p = sys.planets.find((q) => q.moonList.length);
    const inside = placesAround(sectors, [sys.at[0] + sys.reach * 0.5, sys.at[1], sys.at[2]], 777, all);
    expect(inside.find((r) => r.id === p.id)).toMatchObject({ at: orbitAt(p, 777), park: parkDistance(resolvePlace(p.id, { t: 777 })) });
    expect(inside.find((r) => r.id === p.moonList[0].id).at).toEqual(moonAt(p.moonList[0], p, 777));
    expect(inside.some((r) => r.place === 'station' && r.src.row.i === sys.i)).toBe(true);
    const outside = placesAround(sectors, [sys.at[0] + sys.reach + AROUND.inside + 5000, sys.at[1], sys.at[2]], 777, all);
    expect(outside.find((r) => r.id === p.id).park).toBeNull();
    expect(outside.find((r) => r.id === sys.id).park).toBe(parkDistance(resolvePlace(sys.id, { t: 777 })));
    // (discs.js draws a moon as a disc wherever its system's are, so out here it has a row, with no park)
    expect(outside.find((r) => r.id === p.moonList[0].id)).toMatchObject({ place: 'moon', at: moonAt(p.moonList[0], p, 777), park: null });
    expect(outside.some((r) => r.place === 'station' && r.src.row.i === sys.i)).toBe(false);
    // (a planet and its moon 30,000 off are discs on screen, so they have rows too)
    const far = placesAround(sectors, [sys.at[0] + 30000, sys.at[1], sys.at[2]], 777, all);
    expect(far.find((r) => r.id === p.id)).toMatchObject({ at: orbitAt(p, 777), park: null });
    expect(far.some((r) => r.id === p.moonList[0].id)).toBe(true);
  });
  it('lists every lattice thing out to the far plane, as lane 2 draws them, and none past it', () => {
    const row = thingRow(s, 40);
    for (const off of [5000, 30000]) {
      const got = placesAround(sectors, [row.at[0] + off, row.at[1], row.at[2]], 0, all).find((r) => r.id === row.id);
      expect(got, String(off)).toMatchObject({ place: 'thing', name: row.name, at: row.at, move: null });
    }
    // (today's lattice kinds are all solid, so a thing's reach is 1.2 × its size)
    expect(placesAround(sectors, [row.at[0] + AROUND.far + 1.2 * row.size + 1, row.at[1], row.at[2]], 0, all).some((r) => r.id === row.id)).toBe(false);
    // (every one within the far plane of a point, counted straight from the sectors' own arrays)
    const cam = [s.origin[0] + 7000, s.origin[1] + 3000, s.origin[2] - 2000];
    const want = [];
    for (const x of sectors.values()) {
      for (let i = 0; i < x.things.count; i++) {
        const at = [0, 1, 2].map((k) => x.origin[k] + x.things.at[3 * i + k]);
        if (len(at, cam) - 1.2 * x.things.size[i] <= AROUND.far) want.push(thingRow(x, i).id);
      }
    }
    expect(want.length).toBeGreaterThan(1000);
    expect(placesAround(sectors, cam, 0, all).filter((r) => r.place === 'thing').map((r) => r.id).sort()).toEqual(want.sort());
  });
  it('says which station the ship is at, and gives it back to the system once it has clearly left', () => {
    const st = s.stations[0];
    const rows = placesAround(sectors, st.at, 0, all);
    const row = rows.find((r) => r.id === st.id);
    const sys = rows.find((r) => r.id === st.system);
    expect(hereZone(row)).toEqual({ in: row.reach + PARK_GAP.near + PARK_GAP.in, out: row.reach + PARK_GAP.near + PARK_GAP.out });
    const at = (d) => ({ x: st.at[0] + d, y: st.at[1], z: st.at[2], speed: 0 });
    // (the system, where its own zone holds you: every station of E:1,0 sits inside its system's)
    const sysOr = (d) => (len(xyz(at(d)), sys.at) < hereZone(sys).in ? sys.id : null);
    expect(orbitingPlace(at(row.reach + PARK_GAP.near), null, rows)).toBe(st.id);
    expect(orbitingPlace(at(row.reach + PARK_GAP.near + PARK_GAP.out - 1), st.id, rows)).toBe(st.id);
    const gone = row.reach + PARK_GAP.near + PARK_GAP.out + 1;
    expect(orbitingPlace(at(gone), st.id, rows)).not.toBe(st.id);
    expect(orbitingPlace(at(gone), st.id, rows)).toBe(sysOr(gone));
    expect(orbitingPlace(at(row.reach + PARK_GAP.near + PARK_GAP.in + 1), null, rows)).toBe(sysOr(row.reach + PARK_GAP.near + PARK_GAP.in + 1));
    for (const x of s.stations) {
      const park = parkPlace(resolvePlace(x.id, { t: 0 }), [x.at[0], x.at[2] + 1000], 0);
      const near = placesAround(sectors, x.at, 0, all);
      const home = near.find((r) => r.id === x.system);
      expect(orbitingPlace(still(park), null, near), x.id).toBe(x.id);
      expect(len(xyz(park), home.at), x.id).toBeLessThan(hereZone(home).in);
    }
  });
  it('counts a ship parked at a system, or at a planet, even one that parks past its moons, as there', () => {
    for (const sys of s.systems.slice(0, 60)) {
      const park = parkPlace(resolvePlace(sys.id, { t: 0 }), [sys.at[0] + 9000, sys.at[2]], 0);
      expect(orbitingPlace(still(park), null, placesAround(one, xyz(park), 0, all)), sys.id).toBe(sys.id);
    }
    const planets = s.systems.flatMap((x) => x.planets);
    const past = planets.filter((p) => {
      const d = resolvePlace(p.id, { t: 0 });
      return parkDistance(d) > d.reach + PARK_GAP.near + 1e-9;
    });
    expect(past.length).toBeGreaterThan(0);
    for (const p of [...s.systems.slice(0, 60).flatMap((x) => x.planets), ...past]) {
      const d = resolvePlace(p.id, { t: 0 });
      const park = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
      expect(orbitingPlace(still(park), null, placesAround(one, xyz(park), 0, all), p.id), p.id).toBe(p.id);
    }
  });
  it('keeps a parked ship at its planet as a moon goes by, and gives it to the moon when it flies in', () => {
    const planet = { id: 'P', place: 'planet', at: [0, 0, 0], reach: 100, park: 104 };
    const moon = { id: 'M', place: 'moon', at: [104, 10, 0], reach: 19, park: 23 };
    const ship = (speed) => ({ x: 104, y: 0.3, z: 0, speed });
    expect(orbitingPlace(ship(0), 'P', [planet, moon])).toBe('P');
    expect(orbitingPlace(ship(AROUND.underWay), 'P', [planet, moon])).toBe('M');
    expect(orbitingPlace(ship(0), null, [planet, moon], 'P')).toBe('P');
    expect(orbitingPlace(ship(0), null, [planet, moon])).toBe('M');
    expect(orbitingPlace(ship(0), 'P', [planet, { ...moon, park: null }])).toBe('P');
  });
  it('names the stars to aim at, nearest first, each by its card’s reach', () => {
    const cam = s.systems[0].at;
    const stars = aimStars(sectors, cam, { max: 50 });
    expect(stars).toHaveLength(50);
    for (let i = 1; i < 50; i++) expect(len(stars[i].at, cam)).toBeGreaterThanOrEqual(len(stars[i - 1].at, cam));
    expect(stars[0]).toEqual({ id: s.systems[0].id, at: s.systems[0].at, reach: s.systems[0].star.size * 2 });
  });
});

describe('a row round the ship, against its card', () => {
  it('is the place the resolver finds for its id, at the same time, by the same look', () => {
    const sys = s.systems.find((x) => s.stations.some((st) => st.i === x.i) && x.planets.some((p) => p.moonList.length));
    const rows = [
      ...placesAround(sectors, [sys.at[0] + sys.reach * 0.5, sys.at[1], sys.at[2]], 777, all),
      ...placesAround(sectors, [sys.at[0] + 30000, sys.at[1], sys.at[2]], 777, all),
    ];
    const by = (place) => rows.filter((r) => r.place === place);
    for (const place of ['system', 'planet', 'moon', 'station', 'thing']) expect(by(place).length, place).toBeGreaterThan(0);
    // (a sample of each, and every station and moon: a whole card is the slow way to read a row)
    const sample = [...by('system').slice(0, 30), ...by('planet').slice(0, 40), ...by('moon'), ...by('station'), ...by('thing').slice(0, 40), ...by('wonder')];
    for (const r of sample) {
      const d = resolvePlace(r.id, { t: 777, sectors });
      expect(d, r.id).not.toBeNull();
      const look = ({ id, place, kind, name, at, r: size, reach, deep, color, move }) => ({ id, place, kind, name, at, r: size, reach, deep, color, move });
      expect(look(r), r.id).toEqual(look(d));
      expect(r.dist, r.id).toBeGreaterThanOrEqual(0);
      expect(r.src.row, r.id).toEqual(d.src.row);
    }
  });
});
