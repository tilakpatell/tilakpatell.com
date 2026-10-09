import { describe, expect, it } from 'vitest';
import { EDGE, GOALS, OVERDRIVE, PLANETS, SHIP, SOLIDS, SPACE, STARTS, autopilot, boostAt, brakeAt, ceilingAt, clearPark, crashLoud, driveAt, forward, holdReach, inTrench, noseOf, orbiting, parkAt, spawn, startAt, step, turnAt } from './ship';
import { DEEP, WONDERS, easeOpen, gapAlong, trenchBand } from './deep';
import { MAW } from './maw';
import { NOSE, UP, fromAngles, rotate } from './orient';
import { HOME_RADIUS, ORDER, POSITIONS, REACH, SECTORS, SUN, sectorOf } from './layout';

const inMain = (at) => sectorOf(...at) === 'main';
import { byId } from './universes';
import { ENTRY, LANDABLE, airTop } from './entry';
import { sunFor } from './lighting';

const fly = (s, input, seconds, solids = SOLIDS) => {
  let ship = s;
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = step(ship, input, 1 / 60, solids);
    ship = r.ship;
    events.push(...r.events);
  }
  return { ship, events };
};
// in something solid (a trench, where one's laid, is open down to its floor)
const inside = (s) => SOLIDS.some((p) => Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) < (inTrench(p, s.x, s.y, s.z) ? p.band.floor : p.r) + SHIP.radius - 1e-6);

describe('flying the ship', () => {
  it('speeds up to cruise, faster with boost, and coasts to a stop', () => {
    // in open space for this one, nothing to bump into, up under the home
    // system's ceiling (and the boost with the pulse drive held down, as
    // hunters hold it, so it's the boost itself)
    const s = { ...spawn(null), y: SHIP.ceiling - 6 };
    expect(fly(s, { throttle: 1 }, 3, []).ship.speed).toBeCloseTo(SHIP.cruise, 1);
    expect(fly(s, { throttle: 1, boost: true, interdicted: true }, 4, []).ship.speed).toBeCloseTo(SHIP.boost, 1);
    const going = fly(s, { throttle: 1 }, 3, []).ship;
    expect(fly(going, {}, 4, []).ship.speed).toBeCloseTo(0, 3);
  });

  it('goes the way it points, and turns right when told to', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0 };
    const ahead = fly(s, { throttle: 1 }, 0.5, []).ship;
    expect(ahead.z).toBeLessThan(0); // heading 0 is −z
    const right = fly(s, { throttle: 1, turn: 1 }, 0.5, []).ship;
    expect(forward(right.heading)[0]).toBeGreaterThan(0); // nose toward +x
  });

  it('rolls into a turn and out of it, leaning with it, rather than snapping', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0 };
    // the first few frames turn less than a full-rate turn would
    const early = fly(s, { throttle: 1, turn: 1 }, 0.05, []).ship;
    expect(Math.abs(early.heading)).toBeLessThan(SHIP.turn * 0.05 * 0.6);
    expect(early.rate).toBeLessThan(0);
    // a moment on, it's at the full rate, leaning over to the right (and still level)
    const going = fly(s, { throttle: 1, turn: 1 }, 1, []).ship;
    expect(going.rate).toBeCloseTo(-SHIP.turn * turnAt(going.speed), 1);
    expect(going.lean).toBeGreaterThan(0.3);
    expect(Math.abs(going.bank)).toBeLessThan(1e-6);
    // let go: the turn eases off, and it levels out
    const settled = fly(going, { throttle: 1 }, 0.8, []).ship;
    expect(Math.abs(settled.rate)).toBeLessThan(0.01);
    expect(Math.abs(settled.lean)).toBeLessThan(0.02);
  });

  it('leans into a turn on a spring: past where it settles, and back', () => {
    // (held at a steady turn the lean's target stands still; the lean
    // overshoots it a little and rings back, which reads as the ship's weight)
    const s = { ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.cruise };
    let w = s;
    let peak = 0;
    for (let t = 0; t < 3; t += 1 / 60) {
      w = step(w, { throttle: 1, turn: 1 }, 1 / 60, []).ship;
      peak = Math.max(peak, Math.abs(w.lean));
    }
    const rest = Math.abs(w.lean);
    expect(rest).toBeGreaterThan(0.3);
    expect(peak).toBeGreaterThan(rest * 1.02);
    expect(peak).toBeLessThan(rest * 1.25);
    expect(Math.abs(w.leanV)).toBeLessThan(0.01);
    // and the same at 30 Hz: bounded, settling where 60 Hz did
    let h = s;
    for (let t = 0; t < 3; t += 1 / 30) h = step(h, { throttle: 1, turn: 1 }, 1 / 30, []).ship;
    expect(Math.abs(h.lean)).toBeCloseTo(rest, 2);
  });

  it('turns wider the faster it goes', () => {
    expect(turnAt(0)).toBe(1);
    expect(turnAt(SHIP.cruise)).toBe(1);
    expect(turnAt(SHIP.boost)).toBeCloseTo(SHIP.turnFast, 6);
    expect(turnAt(SHIP.pulse)).toBeLessThan(SHIP.turnFast);
    const slow = fly({ ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.cruise }, { throttle: 1, turn: 1 }, 1, []).ship;
    const fast = fly({ ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.boost }, { throttle: 1, boost: true, turn: 1 }, 1, []).ship;
    expect(Math.abs(fast.heading)).toBeLessThan(Math.abs(slow.heading) * 0.75);
  });

  it('never goes through a planet, and says when it hits one', () => {
    for (const id of ORDER) {
      const park = parkAt(id);
      // pointed straight at the planet, full boost, for as long as it takes to get there
      const { ship, events } = fly({ ...spawn(null), x: park.x, y: park.y, z: park.z, heading: park.heading }, { throttle: 1, boost: true }, 3 + (REACH[id] - byId(id).size) / 8);
      expect(orbiting({ ...ship, ...park }, null), id).toBe(id); // the parking spot is at this planet, not a neighbour
      expect(inside(ship), id).toBe(false);
      expect(events.some((e) => (e.type === 'bump' || e.type === 'crash') && e.id === id), id).toBe(true);
    }
  });

  it('crashes into a planet when it hits it fast, and only bumps when slow', () => {
    const park = parkAt('marvel');
    const at = { ...spawn(null), x: park.x, y: park.y, z: park.z, heading: park.heading };
    // (long enough to reach it from where it parks, however big the planet's drawn)
    const p = PLANETS.find((o) => o.id === 'marvel');
    const gap = Math.hypot(park.x - p.at[0], park.y - p.at[1], park.z - p.at[2]) - p.r;
    const fast = fly(at, { throttle: 1, boost: true }, gap / SHIP.boost + 3).events;
    expect(fast.some((e) => e.type === 'crash' && e.id === 'marvel')).toBe(true);
    const crash = fast.find((e) => e.type === 'crash');
    expect(crash.speed).toBeGreaterThan(SHIP.crash);
    expect(Math.hypot(...crash.normal)).toBeCloseTo(1, 6);
    const slow = fly(at, { throttle: 0.3 }, gap / (0.3 * SHIP.cruise) + 6).events;
    expect(slow.some((e) => e.type === 'bump' && e.id === 'marvel')).toBe(true);
    expect(slow.some((e) => e.type === 'crash')).toBe(false);
    // a bump says how hard it was, and where, for its thud and its puff (Comms.jsx, scene.js)
    const bump = slow.find((e) => e.type === 'bump');
    expect(bump.speed).toBeGreaterThan(0);
    expect(bump.speed).toBeLessThanOrEqual(SHIP.crash);
    expect(bump.force).toBeCloseTo(bump.speed * SHIP.mass, 9);
    expect(bump.at).toHaveLength(3);
    expect(Math.hypot(...bump.normal)).toBeCloseTo(1, 6);
  });

  it('says how loud a crash is by how fast it went in', () => {
    expect(crashLoud(SHIP.crash)).toBeCloseTo(0.45, 9);
    expect(crashLoud(SHIP.boost)).toBe(1);
    expect(crashLoud(SHIP.boost * 3)).toBe(1);
    expect(crashLoud((SHIP.crash + SHIP.boost) / 2)).toBeGreaterThan(crashLoud(SHIP.crash));
    // (a crash with no speed, shot down or into the sun, is as loud as ever)
    expect(crashLoud(undefined)).toBe(1);
  });

  it('bumps at the crash speed as hard as the hit law’s full', () => {
    // (lib/impact.js: quiet under 15, full at 120; a bump just under a crash is full)
    expect(SHIP.crash * SHIP.mass).toBeGreaterThanOrEqual(120);
    expect(SHIP.crash * SHIP.mass).toBeLessThan(150);
  });

  it('turns, pitches and rolls quicker with the sensitivity turned up', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0, speed: SHIP.cruise };
    const turned = (k) => fly(s, { throttle: 1, turn: 1, turnRate: k }, 0.5, []).ship.heading;
    expect(Math.abs(turned(1.5))).toBeGreaterThan(Math.abs(turned(1)) * 1.3);
    const pitched = (k) => fly(s, { throttle: 1, climb: 1, pitchRate: k }, 0.15, []).ship.pitch;
    expect(pitched(1.5)).toBeGreaterThan(pitched(1) * 1.2);
    const rolled = (k) => fly(s, { throttle: 1, roll: 1, rollRate: k }, 0.15, []).ship.bank;
    expect(rolled(1.5)).toBeGreaterThan(rolled(1) * 1.2);
  });
});

describe('up and down, and all the way round', () => {
  const level = { ...spawn(null), x: 0, y: 0, z: 0, heading: 0, speed: SHIP.cruise };
  // the ship's path, frame by frame
  const path = (s, input, seconds) => {
    const out = [];
    for (let t = 0; t < seconds; t += 1 / 60) out.push((s = step(s, input, 1 / 60, []).ship));
    return out;
  };
  const way = (s, v) => rotate(fromAngles(s.heading, s.pitch, s.bank), v);

  it('pulls the nose up with the stick and flies up along it, as a fighter does', () => {
    const { ship } = fly(level, { throttle: 1, climb: 1 }, 0.5, []);
    expect(ship.pitch).toBeGreaterThan(0.5);
    expect(ship.vy).toBeCloseTo(ship.speed * Math.sin(ship.pitch), 6);
    expect(ship.y).toBeGreaterThan(level.y + 0.5);
  });

  it('dives the same way, nose down', () => {
    const { ship } = fly(level, { throttle: 1, climb: -1 }, 0.5, []);
    expect(ship.pitch).toBeLessThan(-0.5);
    expect(ship.y).toBeLessThan(level.y - 0.5);
  });

  it('climbs and dives faster the faster it flies', () => {
    const slow = fly(level, { throttle: 1, climb: 1 }, 0.4, []).ship.vy;
    const fast = fly({ ...level, speed: SHIP.boost }, { throttle: 1, climb: 1, boost: true }, 0.4, []).ship.vy;
    expect(fast).toBeGreaterThan(slow * 1.5);
  });

  it('loops all the way over, upside down across the top, and comes out where it went in, the right way up', () => {
    const frames = path(level, { throttle: 1, climb: 1 }, (2 * Math.PI) / SHIP.pitch + 0.12);
    // straight up on the way, and over the top on its back, going the other way
    expect(Math.max(...frames.map((f) => f.pitch))).toBeGreaterThan(Math.PI / 2 - 0.05);
    const top = frames.reduce((a, b) => (b.y > a.y ? b : a));
    expect(way(top, UP)[1]).toBeLessThan(-0.9);
    expect(way(top, NOSE)[2]).toBeGreaterThan(0.9);
    // and round again, level and upright, heading the way it started, about where it started
    const end = frames.at(-1);
    const [, ny, nz] = way(end, NOSE);
    expect(nz).toBeLessThan(-0.97);
    expect(Math.abs(ny)).toBeLessThan(0.25);
    expect(way(end, UP)[1]).toBeGreaterThan(0.95);
    expect(Math.abs(end.y - level.y)).toBeLessThan(1);
  });

  it('never snaps the nose round, however hard the stick goes over', () => {
    const up = [level, ...path(level, { throttle: 1, climb: 1 }, 0.6)];
    const over = [up.at(-1), ...path(up.at(-1), { throttle: 1, climb: -1 }, 1)];
    for (const frames of [up, over]) {
      for (let i = 1; i < frames.length; i++) expect(Math.abs(frames[i].tipRate - frames[i - 1].tipRate)).toBeLessThan(SHIP.pitch * 0.3);
      for (const f of frames) expect(Math.abs(f.tipRate)).toBeLessThanOrEqual(SHIP.pitch + 1e-9);
    }
    // (the first frames tip less than the full rate would)
    expect(up[3].pitch).toBeLessThan(SHIP.pitch * (3 / 60) * 0.6);
  });

  it('keeps the nose where it was left, rather than levelling it', () => {
    const up = fly(level, { throttle: 1, climb: 1 }, 0.3, []).ship;
    const after = fly(up, { throttle: 1 }, 1, []).ship;
    expect(Math.abs(after.tipRate)).toBeLessThan(0.01);
    expect(after.pitch).toBeGreaterThan(up.pitch);
    expect(after.y).toBeGreaterThan(up.y + 1);
  });

  it('turns about on the spot, stopped, without going anywhere', () => {
    const s = { ...spawn(null), x: 0, y: 0, z: 0 };
    expect(fly(s, { climb: 1 }, 0.6, []).ship.pitch).toBeGreaterThan(0.6);
    const { ship } = fly(s, { climb: 1, turn: 1, roll: 1 }, 0.6, []);
    expect(Math.hypot(ship.x, ship.y, ship.z)).toBeLessThan(1e-9);
  });

  it('rolls right over with the roll, and with self-levelling off flies on upside down', () => {
    const over = fly(level, { throttle: 1, roll: 1, level: 0 }, Math.PI / SHIP.roll + 0.1, []).ship;
    expect(way(over, UP)[1]).toBeLessThan(-0.9);
    expect(way(over, NOSE)[2]).toBeLessThan(-0.99); // still going the way it was
    const on = fly(over, { throttle: 1, level: 0 }, 2, []).ship;
    expect(way(on, UP)[1]).toBeLessThan(-0.9);
    expect(Math.abs(on.y - over.y)).toBeLessThan(0.3);
  });

  it('rolls itself back upright when let go, quicker the higher the setting, the shorter way round', () => {
    const inverted = { ...level, bank: Math.PI - 0.3 };
    const upright = fly(inverted, { throttle: 1 }, 3, []).ship;
    expect(Math.abs(upright.bank)).toBeLessThan(0.05);
    const banked = { ...level, bank: 0.8 };
    const slow = fly(banked, { throttle: 1, level: 0.5 }, 0.4, []).ship.bank;
    const quick = fly(banked, { throttle: 1, level: 1.5 }, 0.4, []).ship.bank;
    expect(quick).toBeLessThan(slow);
    expect(slow).toBeLessThan(0.8);
    expect(Math.min(...path(banked, { throttle: 1 }, 2).map((f) => f.bank))).toBeGreaterThan(-0.05); // never past it
  });

  it('holds a roll while the stick pulls (bank and pull to turn hard), and comes upright after', () => {
    const banked = fly(level, { throttle: 1, roll: 1 }, 0.5, []).ship;
    expect(banked.bank).toBeGreaterThan(1.0);
    const pulling = fly(banked, { throttle: 1, climb: 1 }, 0.5, []).ship;
    expect(pulling.bank).toBeGreaterThan(1.0);
    expect(way(pulling, NOSE)[0]).toBeGreaterThan(0.3); // pulled round to the right
    expect(Math.abs(fly(pulling, { throttle: 1 }, 3, []).ship.bank)).toBeLessThan(0.05);
  });

  it('steers the way the pilot sees it, upside down too', () => {
    const inverted = { ...level, bank: Math.PI };
    // the stick to the right: the nose goes to the ship's right, the map's left
    const right = fly(inverted, { throttle: 1, turn: 1, level: 0 }, 0.4, []).ship;
    expect(way(right, NOSE)[0]).toBeLessThan(-0.1);
    // pulled back: the nose goes over its top, toward the ground
    const pulled = fly(inverted, { throttle: 1, climb: 1, level: 0 }, 0.4, []).ship;
    expect(way(pulled, NOSE)[1]).toBeLessThan(-0.3);
  });

  it('rounds out before the ceiling at speed, rather than punching through it', () => {
    for (const side of [1, -1]) {
      const s = { ...level, y: side * (SHIP.ceiling - 5), speed: SHIP.boost };
      const frames = path(s, { throttle: 1, climb: side, boost: true }, 3);
      const top = Math.max(...frames.map((f) => side * f.y));
      expect(top).toBeLessThan(SHIP.ceiling + 0.75);
      expect(Math.abs(way(frames.at(-1), NOSE)[1])).toBeLessThan(0.2);
    }
  });

  it('comes round level at the ceiling and the floor going straight at them flat out, without a word', () => {
    for (const side of [1, -1]) {
      const s = { ...level, pitch: side * (Math.PI / 2 - 0.01), speed: SHIP.boost };
      // (long enough to get there at the boost, and round out)
      const long = SHIP.ceiling / SHIP.boost + 2;
      const frames = path(s, { throttle: 1, boost: true }, long);
      const ys = frames.map((f) => side * f.y);
      expect(Math.max(...ys)).toBeLessThan(SHIP.ceiling + 1);
      // (up under it: the drive opens on the way up and stays open as the
      // nose comes round, so it rounds out a little lower, still flying)
      expect(ys.at(-1)).toBeGreaterThan(SHIP.ceiling * 0.7);
      expect(Math.abs(way(frames.at(-1), NOSE)[1])).toBeLessThan(0.1);
      expect(fly(s, { throttle: 1, boost: true }, long, []).events.filter((e) => e.type === 'edge')).toHaveLength(0);
    }
  });

  it('is eased back in from past the ceiling, even stopped', () => {
    const s = { ...spawn(null), x: 0, z: 0, y: SHIP.ceiling + 6 };
    const { ship } = fly(s, {}, 6, []);
    expect(ship.y).toBeLessThan(SHIP.ceiling + 0.5);
  });

  it('never goes through a planet from above or below either', () => {
    for (const id of ['marvel', 'home', ORDER.at(-1)]) {
      const p = PLANETS.find((o) => o.id === id);
      for (const side of [1, -1]) {
        // straight over (or under) it, nose at it, flat out
        const s = { ...spawn(null), x: p.at[0], y: p.at[1] + side * (p.r + 3), z: p.at[2], pitch: -side * (Math.PI / 2 - 0.01) };
        const { ship, events } = fly(s, { throttle: 1, boost: true }, 3);
        expect(inside(ship), id).toBe(false);
        const hit = events.find((e) => (e.type === 'bump' || e.type === 'crash') && e.id === id);
        expect(hit, id).toBeTruthy();
        if (hit.type === 'crash') expect(hit.normal[1] * side).toBeGreaterThan(0.9); // it went in from that side
      }
    }
  });

  it('is turned back at the edge of the map', () => {
    const s = { ...spawn(null), z: EDGE - 3, heading: Math.PI }; // facing out, near the edge
    const { ship, events } = fly(s, { throttle: 1 }, 3, []);
    expect(Math.hypot(ship.x, ship.z)).toBeLessThanOrEqual(EDGE + 1e-9);
    expect(events.filter((e) => e.type === 'edge')).toHaveLength(1);
    const [fx, fz] = forward(ship.heading);
    expect((-fx * ship.x - fz * ship.z) / Math.hypot(ship.x, ship.z)).toBeGreaterThan(0.5); // nose back toward the middle
  });
});

// Flat out on the pulse drive (nothing solid in the way) from `s`, for
// `seconds` or until `until(ship)`: the slowest it went, and the hardest it
// slowed (map units a second, a second)
const pulseRun = (s, seconds, until = () => false) => {
  let ship = s;
  let slowest = Infinity;
  let hardest = 0;
  for (let t = 0; t < seconds && !until(ship); t += 1 / 60) {
    const next = step(ship, { throttle: 1, boost: true }, 1 / 60, []).ship;
    hardest = Math.max(hardest, (ship.speed - next.speed) * 60);
    ship = next;
    slowest = Math.min(slowest, ship.speed);
  }
  return { ship, slowest, hardest };
};

describe('the pulse drive near a place: no wall to hit', () => {
  it('keeps its speed flying past a world, wide of it', () => {
    for (const id of ['marvel', 'starwars', 'middleearth']) {
      const p = PLANETS.find((o) => o.id === id);
      // level with it, 100 out past its reach to one side, flying by
      const s = { ...spawn(null), x: p.at[0] + p.reach + 100, y: p.at[1], z: p.at[2] + 900, heading: 0, speed: SHIP.pulse };
      expect(pulseRun(s, 1800 / SHIP.pulse).slowest, id).toBeGreaterThan(SHIP.pulse * 0.85);
    }
  });

  it('slows smoothly coming straight at one, and gets there at the boost', () => {
    for (const id of ['marvel', 'starwars', 'middleearth']) {
      const p = PLANETS.find((o) => o.id === id);
      const s = { ...spawn(null), x: p.at[0], y: p.at[1], z: p.at[2] + p.reach + 900, heading: 0, speed: SHIP.pulse };
      const run = pulseRun(s, 30, (o) => Math.hypot(o.x - p.at[0], o.y - p.at[1], o.z - p.at[2]) < p.reach);
      expect(run.hardest, id).toBeLessThan(260); // (it used to brake at SHIP.drop, 470, from where the drive started closing)
      expect(run.ship.speed, id).toBeLessThanOrEqual(SHIP.boost + 1);
    }
  });

  it('flies straight through a nebula on the drive', () => {
    const w = WONDERS.find((o) => o.id === 'veil');
    const s = { ...spawn(null), x: w.at[0], y: w.at[1], z: w.at[2] + w.r + 300, heading: 0, speed: SHIP.pulse };
    expect(pulseRun(s, (w.r * 2 + 300) / SHIP.pulse).slowest).toBeGreaterThan(SHIP.pulse * 0.9);
  });

  it('brakes at least as hard as its brakes just over the limit, as under it', () => {
    const at = { ...spawn(null), x: 0, z: 2600, heading: Math.PI }; // (out in the open, going further out)
    const limit = boostAt(at.x, at.y, at.z);
    for (const over of [-1, 1, 5, 40]) {
      const s = { ...at, speed: limit + over };
      const next = step(s, { throttle: -1 }, 1 / 60, []).ship;
      expect((s.speed - next.speed) * 60, `${over} over`).toBeGreaterThanOrEqual(brakeAt(at.x, at.y, at.z) - 1e-6);
    }
  });

  it('flies in on super speed from deep space and parks at a station, as it did', () => {
    for (const [from, to] of [
      ['glacia', 'contact'],
      ['twins', 'home'],
      ['aurelia', 'contact'],
    ]) {
      let s = { ...spawn(null), ...parkAt(from) };
      const park = parkAt(to, [s.x, s.z]);
      let done = false;
      let hit = null;
      for (let t = 0; t < 90 && !done; t += 1 / 60) {
        const a = autopilot(s, to, park, undefined, OVERDRIVE);
        done = a.done;
        const r = step(s, a.input, 1 / 60);
        s = r.ship;
        hit ??= r.events.find((e) => e.type === 'crash' || e.type === 'bump') ?? null;
      }
      expect(hit, `${from} to ${to}`).toBeNull();
      expect(done, `${from} to ${to}`).toBe(true);
    }
  });

  it('parks at a battle on super speed without flying through it, held down as it comes in', () => {
    const at = [5542, 139, 133];
    const reach = 208;
    const hold = (x, y, z, f = null) => 1 - easeOpen(gapAlong(x, y, z, f, at, 260), 640);
    const space = { ...SPACE, goals: { ...SPACE.goals, front: { id: 'front', at, r: 30, reach } } };
    let s = { ...spawn(null), x: at[0] + 2500, y: at[1], z: at[2], heading: Math.PI / 2 }; // (facing it, along −x)
    const park = { x: at[0] + reach + 16, y: at[1], z: at[2], heading: Math.PI / 2 };
    let done = false;
    let closest = Infinity;
    let t = 0;
    for (; t < 60 && !done; t += 1 / 60) {
      const a = autopilot(s, 'front', park, space, OVERDRIVE, hold);
      done = a.done;
      s = step(s, { ...a.input, interdicted: hold(s.x, s.y, s.z, noseOf(s)) }, 1 / 60, [], space).ship;
      closest = Math.min(closest, Math.hypot(s.x - at[0], s.y - at[1], s.z - at[2]));
    }
    expect(done).toBe(true);
    expect(t).toBeLessThan(25);
    expect(closest).toBeGreaterThan(reach);
  });

  it('parks in a nebula at a low frame rate too', () => {
    for (const dt of [1 / 30, 1 / 45]) {
      let s = { ...spawn(null), x: 0, z: 2600, heading: Math.PI };
      const id = 'veil';
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      for (let t = 0; t < 120 && !done; t += dt) {
        const a = autopilot(s, id, park, undefined, OVERDRIVE);
        done = a.done;
        s = step(s, a.input, dt).ship;
      }
      expect(done, `dt ${dt}`).toBe(true);
    }
  });

  it('comes off its top speed smoothly between two stations, flown by hand', () => {
    const [a, b] = ['home', 'experience'].map((id) => PLANETS.find((p) => p.id === id));
    let s = { ...spawn('home') };
    s = { ...s, heading: Math.atan2(-(b.at[0] - s.x), -(b.at[2] - s.z)) };
    let hardest = 0;
    for (let t = 0; t < 8; t += 1 / 60) {
      const next = step(s, { throttle: 1, boost: true }, 1 / 60, []).ship;
      hardest = Math.max(hardest, (s.speed - next.speed) * 60);
      s = next;
      if (Math.hypot(s.x - b.at[0], s.z - b.at[2]) < b.r + 10) break;
    }
    expect(a.id).toBe('home');
    expect(hardest).toBeLessThan(440); // (no single frame braking harder than the old drive did at its worst)
  });

  it('opens between a sun and its planets, and is down by each of them', () => {
    const w = WONDERS.find((o) => o.id === 'ember');
    // well clear of its sun and of both its planets, inside the system
    const at = [w.at[0] + Math.cos(2) * (w.r + 220), w.at[1], w.at[2] + Math.sin(2) * (w.r + 220)];
    expect(boostAt(...at)).toBeGreaterThan(SHIP.boost * 3);
    expect(boostAt(w.at[0] + w.r * 1.4 + 5, w.at[1], w.at[2])).toBe(SHIP.boost);
  });
});

describe('deep space', () => {
  const open = { ...spawn(null), x: 0, z: DEEP.open + 200, heading: Math.PI }; // out past the system, facing further out

  it('knows how far it carries on while hunters pull the pulse drive down, flown as the scene flies it', () => {
    const fast = fly(open, { throttle: 1, boost: true }, 6, []).ship;
    const reach = holdReach(fast, { ramp: 2, solids: [] });
    // (the same, flown: the hold eased in over the ramp, the boost held)
    let s = fast;
    let gone = 0;
    for (let t = 0; t < 2.5; t += 1 / 60) {
      const p = Math.min(1, t / 2);
      s = step(s, { throttle: 1, boost: true, interdicted: p * p * (3 - 2 * p) }, 1 / 60, []).ship;
      gone += s.speed / 60;
    }
    expect(s.speed).toBeLessThan(SHIP.boost + 1);
    expect(reach).toBeGreaterThan(150);
    expect(Math.abs(reach - gone)).toBeLessThan(25);
    // (and the faster it's going, the further)
    expect(holdReach({ ...open, speed: SHIP.boost }, { ramp: 2, solids: [] })).toBeLessThan(reach - 50);
  });

  it('boosts up to the pulse drive out there, and at home opens it between the stations, down by any of them', () => {
    expect(fly(open, { throttle: 1, boost: true }, 6, []).ship.speed).toBeGreaterThan(SHIP.pulse - 2);
    // halfway between two stations it's open some way; right by one, and under the ceiling, it's down
    const [a, b] = ['home', 'experience'].map((id) => PLANETS.find((p) => p.id === id));
    const mid = a.at.map((v, i) => (v + b.at[i]) / 2);
    expect(boostAt(...mid)).toBeGreaterThan(SHIP.boost * 2);
    expect(boostAt(a.at[0], a.at[1] + a.r + 5, a.at[2])).toBe(SHIP.boost);
    expect(boostAt(0, SHIP.ceiling - 5, HOME_RADIUS)).toBe(SHIP.boost);
    expect(driveAt(...mid)).toBeLessThan(1);
  });

  it('falls back to the boost by the time it comes home at pulse speed, and up on the sun', () => {
    let s = { ...open, heading: 0, speed: SHIP.pulse }; // facing home, flat out
    for (let t = 0; t < 30 && Math.hypot(s.x, s.z) > SUN.r + 20; t += 1 / 60) s = step(s, { throttle: 1, boost: true }, 1 / 60, []).ship;
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(SUN.r + 20);
    expect(s.speed).toBeLessThanOrEqual(SHIP.boost + 0.5);
  });

  // (the next station along, and the one across the sun: round it, without
  // stalling by it)
  it.each([
    [1, 10],
    [3, 17],
  ])('hops %i stations along in a few seconds, and comes up on it at the boost', (along, most) => {
    const order = ORDER.filter((id) => byId(id).kind === 'core');
    for (let i = 0; i < order.length; i++) {
      const id = order[(i + along) % order.length];
      let s = spawn(order[i]);
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      let t = 0;
      let bump = null;
      for (; t < 30 && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        const r = step(s, a.input, 1 / 60);
        s = r.ship;
        bump ??= r.events.find((e) => e.type === 'bump' || e.type === 'crash') ?? null;
      }
      expect(done, id).toBe(true);
      expect(bump, id).toBeNull();
      expect(t, `${order[i]} to ${id}`).toBeLessThan(most);
    }
  });

  it('boosts harder at home with boosters fitted, and gets there sooner, but no faster out there', () => {
    const tune = { boost: 1.55, accel: 1.3 };
    // (in the home system, up under its ceiling, with the drive held down, so it's the boost itself)
    const home = { ...spawn(null), y: SHIP.ceiling - 6 };
    const held = { throttle: 1, boost: true, interdicted: true };
    expect(fly(home, { ...held, tune }, 3.5, []).ship.speed).toBeCloseTo(SHIP.boost * 1.55, 1);
    const stock = fly(home, held, 1, []).ship.speed;
    expect(fly(home, { ...held, tune }, 1, []).ship.speed).toBeGreaterThan(stock * 1.2);
    expect(fly(open, { throttle: 1, boost: true, tune }, 8, []).ship.speed).toBeLessThanOrEqual(SHIP.pulse + 0.01);
    // (and a tune that's out of reach of any fit is held to what one can do)
    expect(fly(home, { ...held, tune: { boost: 50 } }, 3.5, []).ship.speed).toBeLessThanOrEqual(SHIP.boost * 1.6 + 0.01);
  });

  it('turns quicker with thrusters fitted, and cruises faster with racing exhausts', () => {
    const s = { ...spawn(null), x: 0, z: 0, heading: 0 };
    const stock = fly(s, { throttle: 1, turn: 1 }, 1, []).ship;
    const agile = fly(s, { throttle: 1, turn: 1, tune: { agility: 1.3 } }, 1, []).ship;
    expect(Math.abs(agile.rate)).toBeGreaterThan(Math.abs(stock.rate) * 1.25);
    expect(fly(s, { throttle: 1, tune: { cruise: 1.15 } }, 4, []).ship.speed).toBeCloseTo(SHIP.cruise * 1.15, 1);
  });

  it('falls back to the boost by the time it comes up on a planet at pulse speed', () => {
    for (const id of ['marvel', 'starwars', 'home']) {
      const p = PLANETS.find((o) => o.id === id);
      // a long way off, flat out straight at it: it hits at no more than the boost
      let s = { ...spawn(null), x: p.at[0], y: p.at[1], z: p.at[2] + p.r + 900, heading: 0, speed: SHIP.pulse };
      let hit = null;
      for (let t = 0; t < 30 && !hit; t += 1 / 60) {
        const r = step(s, { throttle: 1, boost: true }, 1 / 60);
        s = r.ship;
        hit = r.events.find((e) => e.type === 'crash' || e.type === 'bump') ?? null;
      }
      expect(hit?.id, id).toBe(id);
      expect(hit.speed, id).toBeLessThanOrEqual(SHIP.boost + 1);
    }
  });

  it('is held part way down while a battle holds it part way', () => {
    const pulsing = fly(open, { throttle: 1, boost: true }, 6, []).ship;
    const half = fly(pulsing, { throttle: 1, boost: true, interdicted: 0.5 }, 4, []).ship;
    expect(half.speed).toBeGreaterThan(SHIP.boost * 2);
    expect(half.speed).toBeLessThan(SHIP.pulse * 0.6);
  });

  it('is cut back to the boost while hunters have it interdicted', () => {
    const pulsing = fly(open, { throttle: 1, boost: true }, 6, []).ship;
    expect(pulsing.speed).toBeGreaterThan(SHIP.pulse - 2);
    const cut = fly(pulsing, { throttle: 1, boost: true, interdicted: true }, 2, []).ship;
    expect(cut.speed).toBeLessThanOrEqual(SHIP.boost + 0.5);
    expect(cut.speed).toBeGreaterThan(SHIP.cruise);
    expect(fly(cut, { throttle: 1, boost: true }, 6, []).ship.speed).toBeGreaterThan(SHIP.pulse - 2); // and off again once they're gone
  });

  it('brakes and coasts harder out there, to match the speeds', () => {
    expect(brakeAt(open.x, open.y, open.z)).toBeGreaterThan(SHIP.brake * 3.5);
    expect(brakeAt(0, 0, 0)).toBe(SHIP.brake);
    const flat = { ...open, speed: SHIP.pulse };
    expect(fly(flat, { throttle: -1 }, 3, []).ship.speed).toBeLessThanOrEqual(0);
    expect(fly(flat, {}, 4, []).ship.speed).toBeLessThan(SHIP.pulse * 0.6);
  });

  it('can climb far higher out there than at home', () => {
    expect(ceilingAt(open.x, open.z)).toBe(DEEP.ceiling);
    expect(ceilingAt(0, 0)).toBe(SHIP.ceiling);
    // pointed straight up on the pulse drive, it goes most of the way and rounds out under it
    let top = 0;
    let s = { ...open, pitch: Math.PI / 2 - 0.01 };
    for (let t = 0; t < 8; t += 1 / 60) top = Math.max(top, (s = step(s, { throttle: 1, boost: true }, 1 / 60, []).ship).y);
    expect(top).toBeGreaterThan(DEEP.ceiling - 125);
    expect(top).toBeLessThan(DEEP.ceiling + 25);
  });

  it('lets the ship down into a Death Star’s trench, and only there', () => {
    // (the galaxy's, at Yavin: galaxy/world.js lays its trench all the way round)
    const place = { id: 'deathstar', at: POSITIONS.starwars, r: byId('starwars').size, trench: { segments: 85 } };
    const ds = { ...place, band: trenchBand(place) };
    expect(ds.band).toBeTruthy();
    // level with the trench (it's laid all the way round), heading straight
    // in, slowly: it stops near the floor, whichever side it comes in on
    const toward = (a, dy, out) => {
      const x = ds.at[0] + Math.cos(a) * (ds.r + out);
      const z = ds.at[2] + Math.sin(a) * (ds.r + out);
      return { ...spawn(null), x, y: ds.at[1] + dy, z, heading: Math.atan2(-(ds.at[0] - x), -(ds.at[2] - z)), speed: 2 };
    };
    for (const side of [0, Math.PI / 2, Math.PI]) {
      const into = fly(toward(ds.band.home + side, 0, 3), { throttle: 0.3 }, 6, [ds]).ship;
      const d = Math.hypot(into.x - ds.at[0], into.y - ds.at[1], into.z - ds.at[2]);
      expect(d, `${side}`).toBeLessThan(ds.r - 1.5);
      expect(d, `${side}`).toBeGreaterThanOrEqual(ds.band.floor + SHIP.radius - 1e-6);
    }
    // above the trench or below it, it's the surface that stops it
    for (const s of [toward(ds.band.home, ds.band.half + 2, 3), toward(ds.band.home + Math.PI, -ds.band.half - 2, 3)]) {
      const off = fly(s, { throttle: 0.3 }, 6, [ds]).ship;
      expect(Math.hypot(off.x - ds.at[0], off.y - ds.at[1], off.z - ds.at[2])).toBeGreaterThanOrEqual(ds.r + SHIP.radius - 1e-6);
    }
  });

  it('crashes into a wonder, never through it', () => {
    for (const w of WONDERS.filter((o) => o.solid !== false)) {
      // from 120 out, level with it, flat out at it (slowed by the drive dropping out as it nears)
      const s = { ...spawn(null), x: w.at[0], y: w.at[1], z: w.at[2] + w.r + 120, heading: 0, speed: SHIP.pulse };
      const { ship, events } = fly(s, { throttle: 1, boost: true }, 9);
      expect(inside(ship), w.id).toBe(false);
      // (or a part of it: the Citadel's rim, say, which is the Citadel)
      expect(events.some((e) => e.type === 'crash' && e.id.split('-')[0] === w.id), w.id).toBe(true);
    }
  });

  it('is swallowed by the black hole at any speed, with no bounce, and only there', () => {
    const maw = SOLIDS.find((o) => o.id === 'maw');
    expect(SOLIDS.filter((o) => o.swallow).map((o) => o.id)).toEqual(['maw']);
    // creeping up on it, far slower than any crash
    const creep = (o) => ({ ...spawn(null), x: o.at[0], y: o.at[1], z: o.at[2] + o.r + 2, heading: 0, speed: 1 });
    const { ship, events } = fly(creep(maw), { throttle: 0.15 }, 6);
    const fall = events.find((e) => e.id === 'maw');
    expect(fall).toMatchObject({ type: 'crash', swallowed: true });
    expect(fall.speed).toBeLessThan(SHIP.crash);
    expect(events.some((e) => e.type === 'bump' && e.id === 'maw')).toBe(false);
    expect(inside(ship)).toBe(false); // held at its edge for the scene to take over, not through it
    // the same creep at anything else is only a bump
    const glacia = SOLIDS.find((o) => o.id === 'glacia');
    const slow = fly(creep(glacia), { throttle: 0.15 }, 6).events;
    expect(slow.some((e) => e.type === 'bump' && e.id === 'glacia')).toBe(true);
    expect(slow.some((e) => e.type === 'crash')).toBe(false);
  });
});

describe('arriving on the day side', () => {
  // a world parked at from its night side would be a black disc: the
  // autopilot comes round to its lit side, as near the way it came as it can
  it('parks at every world on its day side, wherever it comes from', () => {
    for (const p of PLANETS.filter((q) => byId(q.id).kind !== 'core' && !byId(q.id).portal)) {
      const s = sunFor(p.id);
      const sl = Math.hypot(s[0], s[2]);
      for (const from of [[p.at[0] - s[0] * 900, p.at[2] - s[2] * 900], [p.at[0] + s[0] * 900, p.at[2] + s[2] * 900], [p.at[0] - s[2] * 900, p.at[2] + s[0] * 900]]) {
        const k = parkAt(p.id, from);
        const dx = k.x - p.at[0];
        const dz = k.z - p.at[2];
        expect((dx * s[0] + dz * s[2]) / (Math.hypot(dx, dz) * sl), `${p.id} from ${from}`).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });
});

describe('starting off a world', () => {
  it('starts on its day side', () => {
    const draws = (...v) => () => v.shift();
    for (let i = 0; i < STARTS.length; i++) {
      const s = STARTS[i];
      const u = byId(s.id);
      if (!u || u.kind === 'core' || u.portal) continue;
      const sun = sunFor(s.id);
      for (const k of [0, 0.25, 0.5, 0.75]) {
        const at = startAt(draws((i + 0.5) / STARTS.length, k));
        expect((at.x - s.at[0]) * sun[0] + (at.z - s.at[2]) * sun[2], `${s.id} ${k}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });
});

describe('coming in to land', () => {
  // the worlds are drawn big (scale.js) and parked at a way out past their
  // moons: holding the throttle on toward one, it comes in at the approach
  // speed, still slow enough that flying into the air is a landing
  it('gets from where it parks at any world into its air in good time, slow enough to land', () => {
    for (const p of LANDABLE) {
      const k = parkAt(p.id);
      let s = { ...spawn(null), x: k.x, y: k.y, z: k.z, heading: k.heading };
      let t = 0;
      for (; t < 30; t += 1 / 60) {
        s = step(s, { throttle: 1 }, 1 / 60).ship;
        if (Math.hypot(s.x - p.at[0], s.y - p.at[1], s.z - p.at[2]) < airTop(p)) break;
      }
      expect(t, p.id).toBeLessThan(6);
      expect(s.speed, p.id).toBeLessThan(ENTRY.fast);
      expect(s.speed, p.id).toBeGreaterThan(SHIP.cruise);
    }
  });

  it('cruises at its cruise everywhere else, and at part throttle near a world too', () => {
    const open = { ...spawn(null), x: 0, z: 0, y: SHIP.ceiling - 6, heading: 0 };
    expect(step({ ...open, speed: SHIP.cruise }, { throttle: 1 }, 1 / 60).ship.speed).toBeCloseTo(SHIP.cruise, 6);
    const p = LANDABLE[0];
    const k = parkAt(p.id);
    let s = { ...spawn(null), x: k.x, y: k.y, z: k.z, heading: k.heading };
    for (let t = 0; t < 2; t += 1 / 60) s = step(s, { throttle: 0.5 }, 1 / 60).ship;
    expect(s.speed).toBeLessThanOrEqual(0.5 * SHIP.cruise + 1e-6);
    expect(SHIP.approach).toBeLessThan(ENTRY.fast);
  });
});

describe('being at a universe', () => {
  it('starts parked at a linked universe, and at the edge otherwise', () => {
    for (const id of ORDER) expect(orbiting(spawn(id), null)).toBe(id);
    expect(orbiting(spawn(null), null)).toBeNull();
  });

  it('holds on to the universe until the ship has clearly left', () => {
    const p = PLANETS[0];
    const at = parkAt(p.id);
    // out along the way it parks, 12 past its reach: further than counts as
    // arriving (ORBIT_IN), not as far as counts as leaving (ORBIT_OUT)
    const k = (p.reach + 12) / Math.hypot(at.x - p.at[0], at.z - p.at[2]);
    const nearEdge = { x: p.at[0] + (at.x - p.at[0]) * k, z: p.at[2] + (at.z - p.at[2]) * k };
    expect(orbiting({ ...spawn(null), ...nearEdge }, p.id)).toBe(p.id);
    // (and coming in from outside, the same spot isn't at it yet)
    expect(orbiting({ ...spawn(null), ...nearEdge }, null)).toBeNull();
  });
});

describe('where a new ship starts', () => {
  const draws = (...v) => () => v.shift(); // a rand that gives these, in turn
  // each start, from sides all the way round it
  const every = STARTS.flatMap((s, i) => Array.from({ length: 16 }, (_, k) => ({ s, at: startAt(draws((i + 0.5) / STARTS.length, k / 16)) })));

  it('can be at the home system, or off any fandom planet or any wonder but the Maw', () => {
    const ids = STARTS.map((s) => s.id);
    expect(ids).toContain('sun');
    for (const id of ORDER) expect(ids.includes(id), id).toBe(byId(id).kind !== 'core');
    // (the Rick and Morty sector's are through its portal: nobody starts there; nor in a portal)
    for (const w of WONDERS) expect(ids.includes(w.id), w.id).toBe(w.id !== MAW.id && w.kind !== 'portal' && inMain(w.at));
  });

  it('is clear of everything, at no universe yet, out of the Maw’s pull and facing what it starts by', () => {
    for (const { s, at } of every) {
      const ship = spawn(null, at);
      const label = `${s.id} at ${at.x.toFixed(1)}, ${at.z.toFixed(1)}`;
      expect(Math.hypot(at.x - s.at[0], at.z - s.at[2]), label).toBeCloseTo(s.d, 6);
      expect(inside(ship), label).toBe(false);
      expect(orbiting(ship, null), label).toBeNull();
      expect(Math.hypot(at.x - MAW.at[0], at.y - MAW.at[1], at.z - MAW.at[2]), label).toBeGreaterThan(MAW.reach);
      expect(Math.hypot(at.x, at.z), label).toBeLessThan(EDGE);
      expect(Math.abs(at.y), label).toBeLessThan(ceilingAt(at.x, at.z));
      const [fx, fz] = forward(at.heading);
      const dx = s.at[0] - at.x;
      const dz = s.at[2] - at.z;
      expect((fx * dx + fz * dz) / Math.hypot(dx, dz), label).toBeCloseTo(1, 6);
    }
  });

  it('puts the pilots joining in different places, none on top of another', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const picked = new Set();
    const starts = Array.from({ length: 30 }, () => {
      const which = rand();
      picked.add(STARTS[Math.floor(which * STARTS.length)].id);
      return startAt(draws(which, rand()));
    });
    expect(picked.size).toBeGreaterThan(STARTS.length / 2);
    for (let i = 0; i < starts.length; i++) {
      for (let j = i + 1; j < starts.length; j++) expect(Math.hypot(starts[i].x - starts[j].x, starts[i].y - starts[j].y, starts[i].z - starts[j].z)).toBeGreaterThan(1);
    }
  });

  it('gives way to a universe that’s been picked', () => {
    for (const id of ORDER) expect(spawn(id, startAt(draws(0.99, 0.5)))).toEqual(spawn(id));
  });
});

// (the autopilot's trips are minutes of flight since the spread, scale.js's
// SPREAD, flown at 60 steps a second: more than vitest's 5 s under load)
const LONG = 20000;

describe('clearPark', () => {
  const park = { x: 10, y: 0, z: 0, heading: 1 };
  it('leaves a stop no big ship has come down on', () => {
    expect(clearPark(park, [])).toBe(park);
    expect(clearPark(park, [{ at: [40, 0, 0], r: 3 }])).toBe(park);
    expect(clearPark(park, [{ at: [10, 30, 0], r: 3 }])).toBe(park); // (well above it)
  });
  it('pushes a stop out level from the middle of one it’s inside, facing the same way', () => {
    const p = clearPark(park, [{ at: [8, 0, 0], r: 3 }]);
    expect(p.x).toBeCloseTo(8 + 3 + SHIP.radius + 1 + 1, 6);
    expect(p.z).toBe(0);
    expect(p.y).toBe(0);
    expect(p.heading).toBe(1);
  });
});

describe('autopilot', () => {
  // a capital ship dropped in on the way (or on the stop): a big ship's
  // solid, as capitalRules.js's chain is made of
  const capital = (at, r = 2.7) => ({ id: 'capital', at, r, reach: r, ship: true });
  const tripWith = (moving, { told = true, id = ORDER[0] } = {}) => {
    let s = spawn(null);
    const park = parkAt(id, [s.x, s.z]);
    const ships = moving(s, park); // (where they are: put down once)
    const solids = [...SOLIDS, ...ships];
    let done = false;
    let crashed = false;
    for (let t = 0; t < 100 && !done && !crashed; t += 1 / 60) {
      const a = autopilot(s, id, park, undefined, 1, null, told ? ships : undefined);
      done = a.done;
      const r = step(s, a.input, 1 / 60, solids);
      s = r.ship;
      crashed = r.events.some((e) => e.type === 'crash');
    }
    return { s, park, done, crashed };
  };
  it('steers round a big ship that’s come in across the way, told of it', () => {
    // (on the straight line, two thirds of the way there, at the stop's height)
    const across = (s, park) => [capital([s.x + (park.x - s.x) * 0.66, park.y ?? SHIP.height, s.z + (park.z - s.z) * 0.66])];
    expect(tripWith(across, { told: false }).crashed).toBe(true);
    const r = tripWith(across);
    expect(r.crashed).toBe(false);
    expect(r.done).toBe(true);
  }, LONG);
  it('stops clear of a big ship that’s come down on its stop', () => {
    const on = (s, park) => [capital([park.x, park.y ?? SHIP.height, park.z])];
    const r = tripWith(on);
    expect(r.crashed).toBe(false);
    expect(r.done).toBe(true);
    const [o] = on(null, r.park);
    expect(Math.hypot(r.s.x - o.at[0], r.s.z - o.at[2])).toBeGreaterThan(o.r + SHIP.radius);
  }, LONG);

  it('flies from the edge to every universe without hitting anything', () => {
    for (const id of ORDER) {
      let s = spawn(null);
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      let bumps = 0;
      for (let t = 0; t < 100 && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        const r = step(s, a.input, 1 / 60);
        s = r.ship;
        bumps += r.events.filter((e) => e.type === 'bump' || e.type === 'crash').length;
      }
      expect(done, id).toBe(true);
      expect(bumps, id).toBe(0);
      expect(orbiting(s, null), id).toBe(id);
    }
  }, LONG);

  it('flies down (or up) to a universe from high above (or below) the map, level with it', () => {
    for (const id of ORDER) {
      for (const y of [12, -12]) {
        let s = { ...spawn(null), y };
        const park = parkAt(id, [s.x, s.z]);
        let done = false;
        for (let t = 0; t < 100 && !done; t += 1 / 60) {
          const a = autopilot(s, id, park);
          done = a.done;
          s = step(s, a.input, 1 / 60).ship;
          expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
        }
        expect(done, `${id} from ${y}`).toBe(true);
        expect(s.y).toBeCloseTo(park.y, 0);
        expect(orbiting(s, null), id).toBe(id);
      }
    }
  }, LONG);

  it('flies out from the home system to every wonder in deep space, and back, without hitting anything', () => {
    const trip = (from, id, limit) => {
      let s = from;
      const park = parkAt(id, [s.x, s.z]);
      expect(park, id).toBeTruthy();
      let done = false;
      let top = 0;
      let t = 0;
      for (; t < limit && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        const r = step(s, a.input, 1 / 60);
        s = r.ship;
        top = Math.max(top, s.speed);
        expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
        expect(r.events.some((e) => e.type === 'crash' || e.type === 'bump'), `${id} at ${t.toFixed(2)}s`).toBe(false);
      }
      expect(done, id).toBe(true);
      return { s, top, t };
    };
    // (a wonder in the Rick and Morty sector flown to from its Citadel, the Citadel from its sun)
    for (const w of WONDERS) {
      const o = SECTORS.rickmorty.origin;
      const from = inMain(w.at) ? spawn(ORDER[0]) : { ...spawn(null), ...parkAt(w.id === 'citadel' ? 'curvesun' : 'citadel', [o[0], o[2] + 500]), speed: 0 };
      const { s, top } = trip(from, w.id, 135);
      expect(top, w.id).toBeGreaterThan(SHIP.boost * 2); // on the pulse drive out there
      const g = GOALS[w.id];
      const d = Math.hypot(s.x - g.at[0], s.z - g.at[2]);
      expect(d, w.id).toBeGreaterThan(g.reach); // parked off it, not in it
      expect(d, w.id).toBeLessThan(g.reach + 24);
      expect(Math.abs(s.y - g.at[1]), w.id).toBeLessThan(0.5); // level with it
    }
    // and home again from the furthest, at the home system's speeds by the end
    const far = WONDERS.filter((w) => inMain(w.at)).reduce((a, b) => (Math.hypot(a.at[0], a.at[2]) > Math.hypot(b.at[0], b.at[2]) ? a : b));
    const there = { ...spawn(null), ...parkAt(far.id), speed: 0 };
    const back = trip(there, ORDER[0], 135);
    expect(orbiting(back.s, null)).toBe(ORDER[0]);
  }, LONG);

  it('takes over from upside down and nose down, and parks the right way up', () => {
    for (const id of [ORDER[0], ORDER.at(-1)]) {
      let s = { ...spawn(null), pitch: -1.2, bank: Math.PI - 0.2, speed: SHIP.cruise };
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      for (let t = 0; t < 100 && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        s = step(s, a.input, 1 / 60).ship;
        expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
      }
      expect(done, id).toBe(true);
      expect(Math.abs(s.pitch), id).toBeLessThan(0.1);
      expect(Math.abs(s.bank), id).toBeLessThan(0.1);
      expect(orbiting(s, null), id).toBe(id);
    }
  }, LONG);

  it('has nowhere to go for anything that is not a place', () => {
    expect(parkAt('nope')).toBeNull();
    expect(autopilot(spawn(null), 'nope').done).toBe(true);
  }, LONG);

  it('flies from one universe to the next all the way round', () => {
    let s = spawn(ORDER[0]);
    for (let i = 1; i <= ORDER.length; i++) {
      const id = ORDER[i % ORDER.length];
      const park = parkAt(id, [s.x, s.z]);
      let done = false;
      // (the longest leg, from the Caribbean out to Invincible at the end of the spiral, takes the best part of 150 seconds of free flight on the spread map, scale.js's SPREAD: the lanes, hyperlanes.js, are the quick way)
      for (let t = 0; t < 170 && !done; t += 1 / 60) {
        const a = autopilot(s, id, park);
        done = a.done;
        s = step(s, a.input, 1 / 60).ship;
        expect(inside(s), `${id} at ${t.toFixed(2)}s`).toBe(false);
      }
      expect(done, id).toBe(true);
    }
  }, LONG);
});
