import { describe, expect, it } from 'vitest';
import { CHART_VIEWS, DESTINATIONS, DRIVES, HYPER, KINDS, TRANSIT, canGo, chartAt, legOf, portalBetween, tourIdsIn, viewFor, chartHeading, destinationById, distanceTo, findDestinations, formatDistance, formatTime, shortDistance, hyperState, onChart, findDestination, goalOf, parkFor, parseDrive, riftExit, riftSpot, tourFrom, tripTime, TOUR_IDS } from './nav';
import { GOALS, OVERDRIVE, SHIP, SOLIDS, autopilot, inTrench, orbiting, parkAt, spawn, startAt, step } from './ship';
import { ORDER, SECTORS, sectorOf } from './layout';
import { portalHit, transit } from './portals';
import { WONDERS } from './deep';
import { MAW } from './maw';
import { byId, MOONS } from './universes';
import { sunFor } from './lighting';
import { fullSector, UNIVERSE } from '../expanse/shared/gen';
import { lookupOf, resolvePlace } from './places/resolve';
import { parkPlace } from './places/park';
import { longTrip } from './places/trip';

const inside = (s) => SOLIDS.some((p) => Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) < (inTrench(p, s.x, s.y, s.z) ? p.band.floor : p.r) + SHIP.radius - 1e-6);
const worlds = [...ORDER.filter((id) => byId(id).kind !== 'core'), ...MOONS.map((m) => m.id)];
const stations = ORDER.filter((id) => byId(id).kind === 'core');
// (a place in the Rick and Morty sector is flown to from the Citadel: the
// main map's edge turns the ship back long before it; the portal comes next)
const inMain = (id) => destinationById(id).sector === 'main';
const RM = SECTORS.rickmorty.origin;
const startFor = (id) => (inMain(id) ? spawn('home') : { ...spawn(null), ...parkAt(id === 'citadel' ? 'curvesun' : 'citadel', [RM[0], RM[2] + 500]), speed: 0 });

// flown there by the autopilot on `od` of overdrive: how long it took, the
// top speed, and anything it hit or went into on the way
function fly(from, id, od, limit = 120) {
  let s = from;
  const park = parkFor(id, [s.x, s.z]);
  let top = 0;
  let hits = 0;
  let t = 0;
  let done = false;
  for (; t < limit && !done; t += 1 / 60) {
    const a = autopilot(s, id, park, undefined, od);
    done = a.done;
    const r = step(s, a.input, 1 / 60);
    s = r.ship;
    top = Math.max(top, s.speed);
    hits += r.events.filter((e) => e.type === 'crash' || e.type === 'bump').length + (inside(s) ? 1 : 0);
  }
  return { s, t, top, hits, done };
}

describe('where there is to go', () => {
  it('lists every station, every world and every wonder once, each somewhere the autopilot can go', () => {
    const ids = DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...ORDER, ...WONDERS.map((w) => w.id)]) expect(ids, id).toContain(id);
    for (const d of DESTINATIONS) {
      expect(GOALS[goalOf(d.id)], d.id).toBeTruthy(); // (a system's trip goes to the gate)
      expect(d.name, d.id).toBeTruthy();
      expect(d.about, d.id).toBeTruthy();
      expect(d.color, d.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(['station', 'world', 'wonder', 'system']).toContain(d.kind);
    }
    expect(DESTINATIONS.filter((d) => d.kind === 'station').map((d) => d.id)).toEqual(stations);
    expect(DESTINATIONS.filter((d) => d.kind === 'world').map((d) => d.id)).toEqual(worlds);
    expect(DESTINATIONS.filter((d) => d.kind === 'wonder').map((d) => d.id)).toEqual(WONDERS.map((w) => w.id));
    // a world has its page; a wonder has none
    expect(destinationById('marvel').to).toBe('/avengers');
    expect(destinationById('aurelia').to).toBeNull();
    expect(destinationById('nope')).toBeNull();
  });

  it('filters by kind and finds by name, fandom or what it is, whatever the case or accents', () => {
    expect(findDestinations('wonder').every((d) => d.kind === 'wonder')).toBe(true);
    expect(findDestinations('all')).toHaveLength(DESTINATIONS.length);
    expect(findDestinations('all', 'resume').map((d) => d.id)).toEqual(['resume']);
    expect(findDestinations('all', 'RICK').map((d) => d.id)).toContain('rickmorty'); // (its fandom)
    expect(findDestinations('all', 'nebula').map((d) => d.id).sort()).toEqual(['cradle', 'veil']);
    expect(findDestinations('station', 'nebula')).toEqual([]);
  });

  it('parks at the edge of the Maw’s pull, never in it, and off everything else', () => {
    const p = parkFor(MAW.id, [0, 0]);
    expect(Math.hypot(p.x - MAW.at[0], p.z - MAW.at[2])).toBeLessThan(MAW.reach);
    expect(Math.hypot(p.x - MAW.at[0], p.z - MAW.at[2])).toBeGreaterThan(MAW.reach * 0.8);
    for (const id of worlds) {
      const q = parkFor(id, [0, 0]);
      expect(orbiting({ ...q }, null), id).toBe(id);
    }
  });

  it('measures the distance to the edge of a place, not its middle', () => {
    const d = destinationById('marvel');
    expect(distanceTo({ x: d.at[0], y: d.at[1], z: d.at[2] }, 'marvel')).toBe(0);
    const far = distanceTo({ x: 0, y: 0, z: 0 }, 'marvel');
    expect(far).toBeCloseTo(Math.hypot(...d.at) - d.reach, 3);
    expect(distanceTo(null, 'marvel')).toBeNull();
  });
});

describe('the drives', () => {
  it('keeps the drive picked, and falls back to the jump for anything else (a stored lanes drive among them)', () => {
    for (const d of DRIVES) expect(parseDrive(d.id)).toBe(d.id);
    expect(parseDrive(undefined)).toBe('hyper');
    expect(parseDrive('lanes')).toBe('hyper');
    expect(parseDrive('warp')).toBe('hyper');
    expect(parseDrive('cruise')).toBe('cruise');
  });

  it('has the jump first, the everyday way, then super speed and cruise', () => {
    expect(DRIVES.map((d) => d.id)).toEqual(['hyper', 'super', 'cruise']);
    expect(DRIVES[0]).toMatchObject({ id: 'hyper', name: 'Jump', verb: 'Jump' });
  });

  it('lets the hyperdrive jump once it has charged, and never while interdicted', () => {
    expect(hyperState()).toEqual({ ready: true, wait: 0, why: null });
    expect(hyperState({ last: 100, now: 103 })).toMatchObject({ ready: false, why: 'charging', wait: HYPER.recharge - 3 });
    // (a hot drive's quicker recharge: the skill tree's)
    expect(hyperState({ last: 100, now: 103, recharge: HYPER.recharge * 0.75 }).wait).toBeCloseTo(HYPER.recharge * 0.75 - 3);
    expect(hyperState({ last: 100, now: 100 + HYPER.recharge }).ready).toBe(true);
    expect(hyperState({ interdicted: true })).toMatchObject({ ready: false, why: 'interdicted' });
  });

  it('gets to every world on super speed in well under the time cruising takes, without touching anything', () => {
    for (const id of worlds) {
      const cruise = fly(startFor(id), id, 1);
      const quick = fly(startFor(id), id, OVERDRIVE);
      expect(quick.done, id).toBe(true);
      expect(quick.hits, id).toBe(0);
      expect(orbiting(quick.s, null), id).toBe(id);
      expect(quick.t, id).toBeLessThan(cruise.t * 0.65);
      expect(quick.t, id).toBeLessThan(60); // (about 1.5 times the 34 s it took the Caribbean, the furthest, at the spread to four: scale.js's SPREAD, six since 2026-10-09; under 20 before either)
      if (id !== 'starwars') expect(quick.top, id).toBeGreaterThan(SHIP.pulse * (inMain(id) ? 2 : 1)); // (well past the pulse drive; the gate's close to home, and the sector's first worlds to the Citadel)
    }
  }, 60000); // (every world twice over, minutes of flight at 60 steps a second)

  it('flies out to every wonder on super speed, and from world to world all the way round, without touching anything', () => {
    for (const w of WONDERS.filter((w) => w.id !== MAW.id)) {
      const r = fly(startFor(w.id), w.id, OVERDRIVE);
      expect(r.done, w.id).toBe(true);
      expect(r.hits, w.id).toBe(0);
    }
    let s = spawn(ORDER[0]);
    for (let i = 1; i <= ORDER.length; i++) {
      const id = ORDER[i % ORDER.length];
      const r = fly(s, id, OVERDRIVE);
      expect(r.done, id).toBe(true);
      expect(r.hits, id).toBe(0);
      s = r.s;
    }
  }, 60000); // (every wonder and all the way round: minutes of flight at 60 steps a second)

  it('is no slower between the home system’s stations (it doesn’t kick in there)', () => {
    for (const id of stations.slice(1)) expect(fly(spawn('home'), id, OVERDRIVE).t, id).toBeCloseTo(fly(spawn('home'), id, 1).t, 5);
  });

  it('drops out of super speed in a couple of seconds once the pilot takes the stick', () => {
    // flying out at super speed, then let go of the autopilot (no overdrive)
    let s = spawn('home');
    const park = parkFor('invincible', [s.x, s.z]);
    for (let t = 0; t < 7; t += 1 / 60) s = step(s, autopilot(s, 'invincible', park, undefined, OVERDRIVE).input, 1 / 60).ship;
    expect(s.speed).toBeGreaterThan(SHIP.pulse * 2);
    for (let t = 0; t < 2; t += 1 / 60) s = step(s, { throttle: 1, boost: true }, 1 / 60).ship;
    expect(s.speed).toBeLessThanOrEqual(SHIP.pulse + 1);
  });

  it('is cut back to the boost while hunters have it interdicted', () => {
    let s = { ...spawn('home'), x: 0, z: 2600, heading: 0, speed: 0 }; // out in the open
    for (let t = 0; t < 4; t += 1 / 60) s = step(s, { throttle: 1, boost: true, overdrive: OVERDRIVE, interdicted: true }, 1 / 60).ship;
    expect(s.speed).toBeLessThanOrEqual(SHIP.boost + 0.01);
  });

  it('times a trip on the real physics: the jump the same however far, super speed under cruising', () => {
    const from = spawn('home');
    expect(tripTime(from, 'invincible', 'hyper')).toBe(HYPER.length);
    expect(tripTime(from, 'experience', 'hyper')).toBe(HYPER.length);
    const cruise = tripTime(from, 'invincible', 'cruise');
    const quick = tripTime(from, 'invincible', 'super');
    expect(cruise).toBeGreaterThan(15);
    expect(quick).toBeLessThan(cruise * 0.65);
    expect(tripTime(from, 'nope', 'super')).toBeNull();
    expect(tripTime(null, 'marvel', 'super')).toBeNull();
  });
});

describe('the chart', () => {
  it('puts the sun in the middle and everything on it, further out the further away', () => {
    expect(chartAt(0, 0)).toEqual([0.5, 0.5]);
    for (const d of DESTINATIONS.filter((x) => x.sector === 'main')) expect(onChart(chartAt(d.at[0], d.at[2])), d.id).toBe(true);
    for (const d of DESTINATIONS) expect(sectorOf(...d.at), d.id).toBe(d.sector);
    const r = (id) => {
      const d = destinationById(id);
      const [u, v] = chartAt(d.at[0], d.at[2]);
      return Math.hypot(u - 0.5, v - 0.5);
    };
    expect(r('music')).toBeLessThan(r('invincible')); // (the spiral grows)
    expect(r('home')).toBeLessThan(r('music'));
    expect(r('home')).toBeGreaterThan(0.04); // the home system opens up enough to see
  });

  it('shows the home system on its own, to scale, with deep space off it', () => {
    for (const id of stations) expect(onChart(chartAt(POS(id)[0], POS(id)[2], CHART_VIEWS.home)), id).toBe(true);
    for (const id of worlds) expect(onChart(chartAt(POS(id)[0], POS(id)[2], CHART_VIEWS.home)), id).toBe(false);
  });

  it('points the ship marker the way the nose points, north up', () => {
    expect(chartHeading(0)).toBeCloseTo(-90); // up the chart
    expect(chartHeading(-Math.PI / 2)).toBeCloseTo(0); // to the right (+x)
    expect(Math.abs(chartHeading(Math.PI))).toBeCloseTo(90); // down
  });
});

describe('in words', () => {
  it('says how long and how far', () => {
    expect(formatTime(2.45)).toBe('2.5 s');
    expect(formatTime(14.2)).toBe('14 s');
    expect(formatTime(65)).toBe('1 min 5 s');
    expect(formatTime(null)).toBe('—');
    expect(formatDistance(0)).toBe('Here');
    // the HUD's short form: the same measure, no unit word, thousands as k
    expect(shortDistance(0.26 * 46)).toBe('46');
    expect(shortDistance(0.26 * 460)).toBe('460');
    expect(shortDistance(0.26 * 4600)).toBe('4.6k');
    expect(shortDistance(0.26 * 46000)).toBe('46k');
    expect(formatDistance(26)).toBe('100 ship-lengths');
    expect(formatDistance(4000)).toBe('15,400 ship-lengths');
  });
});

function POS(id) {
  return destinationById(id).at;
}

const seededAt = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('a rift', () => {
  it('opens ahead of the ship and off to one side, clear of anything solid, from anywhere', () => {
    let seed = 5;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const clear = (p) => SOLIDS.every((o) => Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) > o.r + 8);
    const ahead = (s, p) => {
      const [fx, fz] = [-Math.sin(s.heading), -Math.cos(s.heading)];
      return (p[0] - s.x) * fx + (p[2] - s.z) * fz;
    };
    // parked at every place (facing it), everywhere a new ship starts, and out in the open
    const ships = [...ORDER.map((id) => ({ ...parkFor(id, [0, 0]), y: 0, speed: 0 })), ...Array.from({ length: 80 }, (_, i) => ({ ...startAt(seededAt(i + 1)), speed: 0 })), { x: 0, y: 0.3, z: 400, heading: 0, speed: 0 }, { x: 2000, y: 100, z: -1500, heading: 2.2, speed: 0 }];
    for (const s of ships) {
      const p = riftSpot(s, rand);
      expect(p, `${s.x},${s.z}`).not.toBeNull();
      expect(clear(p), `${s.x},${s.z}: clear`).toBe(true);
      expect(ahead(s, p)).toBeGreaterThan(20);
      expect(ahead(s, p)).toBeLessThan(100);
      expect(Math.abs(p[1] - s.y)).toBeLessThan(1e-9);
    }
  });

  it('comes out at a place or a wonder, never where you are and never the Maw', () => {
    const seen = new Set();
    let seed = 3;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 300; i++) {
      const from = i % 2 ? 'marvel' : null;
      const id = riftExit(from, rand);
      expect(GOALS[id], id).toBeTruthy();
      expect(id).not.toBe(from);
      expect(id).not.toBe(MAW.id);
      expect(id.includes('-')).toBe(false);
      seen.add(id);
    }
    expect(seen.has('aurelia')).toBe(true);
    expect(seen.has('home')).toBe(true);
  });

  it('takes you somewhere you haven’t been, while there is somewhere left', () => {
    const all = [...new Set(Array.from({ length: 4000 }, (_, i) => riftExit(null, () => (i + 0.5) / 4000)))];
    expect(all.length).toBeGreaterThan(5);
    const [left, ...been] = all;
    for (let i = 0; i < 50; i++) expect(riftExit(been[0], () => i / 50, 'main', new Set(been))).toBe(left);
    // (been everywhere: anywhere but here)
    for (let i = 0; i < 50; i++) expect(riftExit(been[0], () => i / 50, 'main', new Set(all))).not.toBe(been[0]);
  });
});

describe('the galaxy’s systems, through the gate', () => {
  it('lists every system once, after the wonders, reached through the Star Wars gate', async () => {
    const { SYSTEM_NAMES } = await import('../galaxy/names');
    const systems = DESTINATIONS.filter((d) => d.kind === 'system');
    expect(systems.map((d) => d.id).sort()).toEqual(Object.keys(SYSTEM_NAMES).map((id) => `sys:${id}`).sort());
    for (const d of systems) {
      expect(d.via).toBe('starwars');
      expect(d.to).toBe(`/galaxy/${d.id.slice(4)}`);
      expect(d.name).toBe(SYSTEM_NAMES[d.id.slice(4)]);
      expect(d.at).toEqual(destinationById('starwars').at);
      expect(d.about).toContain(d.name);
    }
    const ids = DESTINATIONS.map((d) => d.id);
    expect(ids.indexOf('sys:hoth')).toBeGreaterThan(ids.indexOf('citadel'));
    expect(findDestinations('system', 'hoth').map((d) => d.id)).toEqual(['sys:hoth']);
    expect(KINDS.map((k) => k.id)).toContain('system');
  });

  it('goes to the gate for a system: the same trip, the same distance, the same parking', () => {
    const s = spawn(null);
    expect(goalOf('sys:hoth')).toBe('starwars');
    expect(goalOf('marvel')).toBe('marvel');
    expect(tripTime(s, 'sys:hoth', 'super')).toBe(tripTime(s, 'starwars', 'super'));
    expect(distanceTo(s, 'sys:hoth')).toBe(distanceTo(s, 'starwars'));
    expect(parkFor('sys:hoth', [0, 0])).toEqual(parkFor('starwars', [0, 0]));
  });
});

describe('finding a place by name', () => {
  it('takes an id first, then the first match by name, fandom or kind', () => {
    expect(findDestination('hoth')?.id).toBe('sys:hoth');
    expect(findDestination('marvel')?.id).toBe('marvel');
    expect(findDestination('Avengers HQ')?.id).toBe('marvel');
    expect(findDestination('  the maw ')?.id).toBe('maw');
    expect(findDestination('nebula')?.id).toBe('veil');
    expect(findDestination('nope')).toBeNull();
    expect(findDestination('')).toBeNull();
    // (never a prototype's key: the lookup is not a plain object's)
    for (const bad of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(findDestination(bad), bad).toBeNull();
      expect(destinationById(bad), bad).toBeNull();
      expect(goalOf(bad), bad).toBe(bad);
    }
  });
});

describe('the grand tour', () => {
  it('visits every station, world and wonder once, nearest first, from wherever you are', () => {
    const s = spawn(null);
    const tour = tourFrom(s);
    expect(new Set(tour).size).toBe(tour.length);
    // (the places in its own sector: the Rick and Morty sector's are through the portal)
    expect(tour.sort()).toEqual(tourIdsIn('main').sort());
    expect(tourIdsIn('main').length + tourIdsIn('rickmorty').length).toBe(TOUR_IDS.length);
    expect(tourIdsIn('rickmorty')).toContain('citadel');
    const first = tourFrom(s)[0];
    const nearest = TOUR_IDS.reduce((a, b) => (distanceTo(s, a) <= distanceTo(s, b) ? a : b));
    expect(first).toBe(nearest);
    expect(TOUR_IDS.some((id) => id.startsWith('sys:'))).toBe(false);
    // from out by the Maw, the Maw's neighbours come first and home comes later
    const far = { ...parkFor('maw', [0, 0]), y: 0, speed: 0 };
    const t2 = tourFrom(far);
    expect(t2.indexOf('home')).toBeGreaterThan(3);
  });
});

describe('coming out of a jump', () => {
  // (a jump parks as the autopilot does: on the world's day side, so what
  // you come out to is lit, not a black disc)
  it('a jump comes out on the day side', () => {
    for (const id of worlds.filter((w) => !byId(w).portal)) {
      const g = GOALS[id];
      const s = sunFor(id);
      const behind = [g.at[0] - s[0] * 1200, g.at[2] - s[2] * 1200];
      const k = parkFor(id, behind);
      expect((k.x - g.at[0]) * s[0] + (k.z - g.at[2]) * s[2], id).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});

describe('across the sectors', () => {
  const home = () => spawn('home');
  it('goes to a place in the other sector through the portal between them', () => {
    expect(portalBetween('main', 'rickmorty').id).toBe('rmportal');
    expect(portalBetween('rickmorty', 'main').id).toBe('rmportal-back');
    expect(portalBetween('main', 'main')).toBeNull();
    expect(legOf(home(), 'gazorpazorp')).toBe('rmportal');
    expect(legOf(home(), 'citadel')).toBe('rmportal');
    expect(legOf(home(), 'marvel')).toBe('marvel');
    expect(legOf(home(), 'sys:hoth')).toBe('starwars'); // (a system: its gate, in this sector)
    const there = startFor('gazorpazorp');
    expect(legOf(there, 'gazorpazorp')).toBe('gazorpazorp');
    expect(legOf(there, 'marvel')).toBe('rmportal-back');
    expect(legOf(there, 'home')).toBe('rmportal-back');
  });

  it('a pilot goal in the other sector goes by the portal', () => {
    // (where they are says which sector: their pose, not a place on the map)
    const inCurve = { x: RM[0] + 300, y: 2, z: RM[2] + 120, heading: 0 };
    const atHome = { x: 40, y: 2, z: 300, heading: 1 };
    expect(legOf(home(), 'pilot:ab12', inCurve)).toBe('rmportal');
    expect(legOf(home(), 'pilot:ab12', atHome)).toBe('pilot:ab12');
    const there = startFor('gazorpazorp');
    expect(legOf(there, 'pilot:ab12', atHome)).toBe('rmportal-back');
    expect(legOf(there, 'pilot:ab12', inCurve)).toBe('pilot:ab12');
    // with no pose, nowhere to route by: the goal as it is
    expect(legOf(home(), 'pilot:ab12', null)).toBe('pilot:ab12');
  });

  it('counts the way through the portal in the distance and the trip time', () => {
    for (const id of ['gazorpazorp', 'citadel', 'curvesun']) {
      const d = distanceTo(home(), id);
      expect(Number.isFinite(d), id).toBe(true);
      expect(d, id).toBeLessThan(30000); // (nothing like the 60000 straight across)
      for (const drive of ['hyper', 'super']) {
        const t = tripTime(home(), id, drive);
        expect(t, `${id} by ${drive}`).not.toBeNull();
        expect(t, `${id} by ${drive}`).toBeGreaterThan(TRANSIT);
      }
    }
    expect(tripTime(home(), 'gazorpazorp', 'super')).toBeLessThan(60);
    expect(tripTime(startFor('gazorpazorp'), 'marvel', 'super')).not.toBeNull();
  });

  it('flies from the home system through the portal to Gazorpazorp, and lands there', () => {
    let s = home();
    const first = legOf(s, 'gazorpazorp');
    let park = parkFor(first, [s.x, s.z]);
    let through = null;
    let t = 0;
    for (; t < 90 && !through; t += 1 / 60) {
      const next = step(s, autopilot(s, first, park, undefined, OVERDRIVE).input, 1 / 60).ship;
      through = portalHit(s, next);
      s = next;
    }
    expect(through).toBe('rmportal');
    s = transit(s, through).ship;
    expect(sectorOf(s.x, s.y, s.z)).toBe('rickmorty');
    const r = fly(s, 'gazorpazorp', OVERDRIVE);
    expect(r.done).toBe(true);
    expect(r.hits).toBe(0);
    expect(orbiting(r.s, null)).toBe('gazorpazorp');
    expect(t + r.t).toBeLessThan(60);
  });

  it('charts the Rick and Morty sector round its own middle', () => {
    expect(viewFor('main')).toBe('all');
    expect(viewFor('rickmorty')).toBe('rickmorty');
    const v = CHART_VIEWS.rickmorty;
    expect(chartAt(...[SECTORS.rickmorty.origin[0], SECTORS.rickmorty.origin[2]], v)).toEqual([0.5, 0.5]);
    for (const d of DESTINATIONS.filter((x) => x.sector === 'rickmorty')) expect(onChart(chartAt(d.at[0], d.at[2], v)), d.id).toBe(true);
    // (the main map's places are far off it)
    expect(onChart(chartAt(0, 0, v))).toBe(false);
  });
});

describe('generated places', () => {
  const U = lookupOf({ t: 0 });
  const s = fullSector(UNIVERSE, 1, 0, 0);
  const sys = s.systems[0];
  const home = () => ({ ...spawn('home') });
  const curve = () => ({ ...spawn(null), x: RM[0], y: 0, z: RM[2] + 500 });

  it('are destinations by any spelling, through the caller’s lookup, never listed', () => {
    expect(destinationById('e:1,0:0', U)).toMatchObject({ id: sys.id, generated: true, name: sys.name });
    expect(goalOf('e:1,0,0:0')).toBe(sys.id);
    expect([canGo(sys.id, U), canGo(`E:1,0:${s.systems.length}`, U), canGo('marvel'), canGo('nope')]).toEqual([true, false, true, false]);
    expect(DESTINATIONS.some((d) => d.generated)).toBe(false);
  });
  it('are nowhere without a lookup, or with one that hasn’t the sector', () => {
    expect([destinationById(sys.id), canGo(sys.id), tripTime(home(), sys.id, 'super'), parkFor(sys.id, [0, 0])]).toEqual([null, false, null, null]);
    const none = lookupOf({ t: 0, sectors: new Map(), build: false });
    expect([destinationById(sys.id, none), canGo(sys.id, none), findDestination(sys.id, none)]).toEqual([null, false, null]);
  });
  it('are nothing for an id that isn’t there, or junk, and never throw', () => {
    for (const id of ['E:1,0:0:99', 'E:1,0:w60', 'E:1,0:w10003', 'beacon:E:1,0:n', '', null, undefined, 42]) {
      expect([destinationById(id, U), canGo(id, U), parkFor(id, [0, 0], U), tripTime(home(), id, 'hyper', U), distanceTo(home(), id, U), findDestination(id, U)], String(id)).toEqual([null, false, null, null, null, null]);
    }
    expect(findDestination(' e:1,0,0:0:1 ', U)).toMatchObject({ id: 'E:1,0:0:1', name: sys.planets[1].name });
  });
  it('are parked at, measured, and reached from the Curve by its portal', () => {
    const d = resolvePlace(sys.id, { t: 0 });
    expect(parkFor('e:1,0:0', [0, 0], U)).toEqual(parkPlace(d, [0, 0], 0));
    expect(distanceTo({ x: d.at[0] + d.reach + 5000, y: d.at[1], z: d.at[2] }, sys.id, U)).toBeCloseTo(5000, 6);
    expect(legOf(home(), sys.id)).toBe(sys.id);
    expect(legOf(curve(), sys.id)).toBe('rmportal-back');
    expect(Number.isFinite(distanceTo(curve(), sys.id, U))).toBe(true);
  });
  it('take their park from the lookup, so the nav carries none of its own', () => {
    const P = { x: 1, y: 2, z: 3, heading: 0, offset: [0, 0, 0] };
    const own = { place: U.place, park: () => P };
    expect(parkFor(sys.id, [0, 0], own)).toBe(P);
    expect(tripTime(home(), sys.id, 'super', own)).toBeCloseTo(longTrip(home(), P, 'super'), 9);
    expect(parkFor(sys.id, [0, 0], { place: U.place })).toBeNull();
  });
  it('are timed by the formula, the jump as ever, and never a dash', () => {
    const far = 'E:5,-3:0';
    expect(tripTime(home(), far, 'hyper', U)).toBe(HYPER.length);
    expect(tripTime(home(), far, 'super', U)).toBeCloseTo(longTrip(home(), parkFor(far, [home().x, home().z], U), 'super'), 9);
    expect(tripTime(home(), `E:1,0:${s.systems.length}`, 'super', U)).toBeNull();
    expect(tripTime(curve(), sys.id, 'super', U)).toBeGreaterThan(TRANSIT);
  });
  it('gives a hand-made place out of the simulation’s reach a time, not null', () => {
    const out = { ...spawn(null), x: 600000, y: 0, z: 0, heading: 0 };
    expect(tripTime(out, 'marvel', 'super')).toBeGreaterThan(600000 / 900 - 60);
  });
  it('gives a place through the portal a time from out of the simulation’s reach too', () => {
    const out = { ...spawn(null), x: 600000, y: 0, z: 0, heading: 0 };
    expect(legOf(out, 'gazorpazorp')).toBe('rmportal');
    expect(tripTime(out, 'gazorpazorp', 'cruise')).toBeGreaterThan(600000 / 300 - 60);
  });
  it('are searched with the places in view, by name, type or id', () => {
    const more = [resolvePlace(sys.id, { t: 0 }), resolvePlace(sys.planets[0].id, { t: 0 })];
    expect(findDestinations('all', sys.name, { more }).map((x) => x.id)).toContain(sys.id);
    expect(findDestinations('star', '', { more }).map((x) => x.id)).toEqual([sys.id]);
    const gates = DESTINATIONS.filter((d) => d.kind === 'system').map((d) => d.id);
    expect(findDestinations('system', '', { more }).map((x) => x.id).sort()).toEqual([...gates, sys.id].sort());
    expect(findDestinations('system', '').map((x) => x.id)).toEqual(gates);
    expect(findDestinations('all', 'e:1,0:0', { more }).map((x) => x.id)).toContain(sys.id);
    expect(findDestinations('all', 'e:1,0:1', { more, ...U }).map((x) => x.id)).toEqual(['E:1,0:1']);
    expect(findDestinations('all', 'resume', { more }).map((x) => x.id)).toEqual(['resume']);
    expect(findDestinations('all', '', { more: [...more, more[0]] }).filter((x) => x.id === sys.id)).toHaveLength(1);
    expect(findDestination('e:1,0:0', U)?.id).toBe(sys.id);
    expect(findDestination(`E:1,0:${s.systems.length}`, U)).toBeNull();
  });
});
