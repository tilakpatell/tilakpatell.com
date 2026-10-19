import { describe, expect, it } from 'vitest';
import { CARRY, FLY, JUMP, ONE, dive, jumpPress, launch, newHero, onWater, speedOf, stepHero, switchHero } from './flight';
import { HIT } from './missions';
import { BRIDGES, RIVER, SPAWN, WATER_Y, WORLD, buildWorld, groundAt } from './map';

const W = buildWorld();
const still = { fwd: 0, side: 0, up: 0, down: 0, boost: false, run: false, jump: false, look: [0, 0, -1] };
// run the rules for t seconds, frame by frame, gathering the events
function fly(h, input, t, dt = 1 / 60) {
  const ev = [];
  for (let s = 0; s < t - 1e-9; s += dt) {
    h = stepHero(h, typeof input === 'function' ? input(h, s) : input, dt, W);
    ev.push(...h.ev);
  }
  return { h, ev };
}
// up in the air over open ground: the big park north of downtown
const AIR = { x: -240, y: 120, z: -880, face: Math.PI };
const airborne = () => ({ ...newHero(AIR), mode: 'air' });

describe('on the ground', () => {
  it('starts standing on the Graysons’ lawn', () => {
    const h = newHero(SPAWN);
    expect(h.mode).toBe('ground');
    expect(h.p[1]).toBe(groundAt(SPAWN.x, SPAWN.z));
  });
  it('walks and runs', () => {
    const walk = fly(newHero(SPAWN), { ...still, fwd: 1, look: [1, 0, 0] }, 1).h;
    const run = fly(newHero(SPAWN), { ...still, fwd: 1, run: true, look: [1, 0, 0] }, 1).h;
    expect(speedOf(walk)).toBeCloseTo(FLY.walk, 0);
    expect(speedOf(run)).toBeCloseTo(FLY.run, 0);
  });
  it('takes off with a jump', () => {
    const { h, ev } = fly(newHero(SPAWN), (_, s) => ({ ...still, jump: s === 0 }), 0.5);
    expect(h.mode).toBe('air');
    expect(h.p[1]).toBeGreaterThan(3);
    expect(ev.filter((e) => e.type === 'takeoff')).toHaveLength(1);
  });
});

describe('in the air', () => {
  it('hangs there with nothing pressed', () => {
    const { h } = fly(airborne(), still, 2);
    expect(Math.hypot(h.p[0] - AIR.x, h.p[1] - AIR.y, h.p[2] - AIR.z)).toBeLessThan(0.01);
    expect(h.mode).toBe('air');
  });
  it('cruises where the camera looks', () => {
    const { h } = fly(airborne(), { ...still, fwd: 1, look: [0, 0, 1] }, 3);
    expect(speedOf(h)).toBeGreaterThan(FLY.cruise - 2);
    expect(speedOf(h)).toBeLessThanOrEqual(FLY.cruise + 1e-6);
    expect(h.v[2]).toBeGreaterThan(0);
  });
  it('climbs and drops', () => {
    expect(fly(airborne(), { ...still, up: 1 }, 1).h.p[1]).toBeGreaterThan(AIR.y + 5);
    expect(fly(airborne(), { ...still, down: 1 }, 1).h.p[1]).toBeLessThan(AIR.y - 5);
  });
  it('goes flat out with a boost, breaking the sound barrier once', () => {
    // north over the hills, high enough to clear them
    const start = { ...newHero({ x: 0, y: 900, z: 2000, face: Math.PI }), mode: 'air' };
    const { h, ev } = fly(start, { ...still, boost: true, look: [0, 0, -1] }, 4);
    expect(speedOf(h)).toBeGreaterThan(240);
    expect(ev.filter((e) => e.type === 'boom')).toHaveLength(1);
  });
  it('slows back to a cruise when the boost is let go, and can break it again', () => {
    const start = { ...newHero({ x: 0, y: 900, z: 2000, face: Math.PI }), mode: 'air' };
    const north = { ...still, look: [0, 0, -1] };
    const { ev } = fly(start, (_, s) => ({ ...north, boost: s < 3 || s > 7, fwd: 1 }), 10);
    expect(ev.filter((e) => e.type === 'boom')).toHaveLength(2);
  });
});

describe('hitting things', () => {
  // the tallest tower, flown at from the west at its middle
  const tower = W.buildings.reduce((a, b) => (b.h > a.h ? b : a));
  const west = (speed) => ({ ...newHero({ x: tower.x - tower.w / 2 - 60, y: tower.h / 2, z: tower.z, face: Math.PI / 2 }), mode: 'air', v: [speed, 0, 0], spd: speed, dir: [1, 0, 0] });
  it('stops at a wall', () => {
    const { h, ev } = fly(west(30), { ...still, fwd: 1, look: [1, 0, 0] }, 4);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
    expect(ev.some((e) => e.type === 'impact')).toBe(false);
  });
  it('bounces off one hit hard, with a crash', () => {
    const { h, ev } = fly(west(200), { ...still, boost: true, look: [1, 0, 0] }, 1);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
    expect(ev.filter((e) => e.type === 'impact')).toHaveLength(1);
  });
  it('names the tower a crash is into', () => {
    const { ev } = fly(west(200), { ...still, boost: true, look: [1, 0, 0] }, 1);
    // (whichever stands in the way first: a building of the city's, by its id)
    const id = ev.find((e) => e.type === 'impact').building;
    expect(W.buildings.some((b) => b.id === id)).toBe(true);
  });
  it('carrying, he flies at 0.7 of his speeds, and a wall met over 40 m/s is a bump', () => {
    // (high over the towers, south, for long enough to reach each top speed and not the world's edge)
    const high = () => ({ ...newHero({ x: -240, y: 420, z: -880, face: 0 }), mode: 'air' });
    const flat = fly(high(), { ...still, boost: true, look: [0, 0, 1] }, 5, 1 / 30).h;
    const laden = fly(high(), { ...still, boost: true, carry: true, look: [0, 0, 1] }, 5, 1 / 30);
    expect(speedOf(flat)).toBeCloseTo(FLY.top, 0);
    expect(speedOf(laden.h)).toBeCloseTo(FLY.top * CARRY, 0);
    const { ev } = fly(west(50), { ...still, fwd: 1, carry: true, look: [1, 0, 0] }, 2);
    const bumped = ev.find((e) => e.type === 'bump');
    expect(W.buildings.some((b) => b.id === bumped.building)).toBe(true);
    expect(fly(west(50), { ...still, fwd: 1, look: [1, 0, 0] }, 2).ev.some((e) => e.type === 'bump')).toBe(false);
  });
  it('dives at 90 m/s onto a point, whatever is held, and lands on it with a slam', () => {
    const start = { ...newHero({ x: -240, y: 150, z: -880, face: 0 }), mode: 'air' };
    const at = [-230, groundAt(-230, -890), -890];
    // (down by 1.6 s; held still, the up and the forward would take him off again once he's up from the slam)
    const { h, ev } = fly(dive(start, at, 90), { ...still, up: 1, fwd: 1, look: [0, 0, 1] }, 2);
    expect(h.mode).toBe('ground');
    expect(Math.hypot(h.p[0] - at[0], h.p[2] - at[2])).toBeLessThan(2);
    expect(ev.find((e) => e.type === 'slam').speed).toBeCloseTo(90, 0);
    expect(h.dive).toBe(null);
    // (one through a point in the air is over once he's there, and he flies on)
    const by = fly(dive(start, [-240, 150, -980], 90, { through: true }), still, 1.5).h;
    expect(by.dive).toBe(null);
    expect(by.mode).toBe('air');
  });
  it('never goes under the ground, even diving flat out', () => {
    const start = { ...newHero({ x: -240, y: 400, z: -880, face: 0 }), mode: 'air' };
    const { h, ev } = fly(start, { ...still, boost: true, look: [0, -1, 0] }, 4);
    expect(h.p[1]).toBeGreaterThanOrEqual(groundAt(h.p[0], h.p[2]) - 1e-6);
    expect(h.mode).toBe('ground');
    expect(ev.some((e) => e.type === 'slam' && e.speed > 100)).toBe(true);
  });
  it('lands softly coming down slowly', () => {
    const start = { ...newHero({ x: -240, y: 6, z: -880, face: 0 }), mode: 'air' };
    const { h, ev } = fly(start, { ...still, down: 1 }, 3);
    expect(h.mode).toBe('ground');
    expect(ev.some((e) => e.type === 'land')).toBe(true);
    expect(ev.some((e) => e.type === 'slam')).toBe(false);
  });
  it('lands on a roof', () => {
    const b = W.buildings.find((x) => x.zone === 'mid' && !x.top && x.w > 20 && x.d > 20);
    const start = { ...newHero({ x: b.x, y: b.h + 8, z: b.z, face: 0 }), mode: 'air' };
    const { h } = fly(start, { ...still, down: 1 }, 3);
    expect(h.mode).toBe('ground');
    expect(h.p[1]).toBeCloseTo(b.h, 3);
  });
  it('stays inside the world and under its ceiling', () => {
    const out = fly({ ...newHero({ x: WORLD.half - 100, y: WORLD.ceiling - 50, z: 0, face: Math.PI / 2 }), mode: 'air' }, { ...still, boost: true, look: [0.7, 0.7, 0] }, 5).h;
    expect(out.p[0]).toBeLessThanOrEqual(WORLD.half);
    expect(out.p[1]).toBeLessThanOrEqual(WORLD.ceiling);
  });
});

describe('the water', () => {
  // over the middle of the river, between the bridges at z = −1160 and −440
  const MID = (RIVER.x0 + RIVER.x1) / 2;
  const diving = (y, z, dir, speed) => ({ ...newHero({ x: MID, y, z, face: 0 }), mode: 'air', v: dir.map((c) => c * speed), spd: speed, dir });
  // fly, noting how low his feet went
  const watch = (h, input, t) => {
    let low = Infinity;
    const { h: end, ev } = fly(h, (hh) => ((low = Math.min(low, hh.p[1])), input), t);
    return { h: end, ev, low: Math.min(low, end.p[1]) };
  };
  const kinds = (ev, type) => ev.filter((e) => e.type === type);
  it('stops a dive into the river at 250 m/s at the surface, with one splash', () => {
    const { h, ev, low } = watch(diving(60, -800, [0, -1, 0], 250), { ...still, boost: true, look: [0, -1, 0] }, 3);
    expect(kinds(ev, 'splash')).toHaveLength(1);
    expect(kinds(ev, 'splash')[0].speed).toBeGreaterThan(200);
    expect(kinds(ev, 'splash')[0].at[1]).toBeCloseTo(WATER_Y, 6);
    expect(kinds(ev, 'slam')).toHaveLength(0); // no crater in the water
    expect(kinds(ev, 'impact')).toHaveLength(0);
    expect(low).toBeGreaterThanOrEqual(WATER_Y - 1e-6);
    expect(h.p[1]).toBeCloseTo(WATER_Y, 6);
    expect(speedOf(h)).toBeLessThan(1);
    expect(h.mode).toBe('air'); // (he can't stand on it)
  });
  it('splashes once on a shallow dive flat out, then skims the surface', () => {
    const dir = [0, -0.5, -Math.sqrt(0.75)]; // 30° down, north up the river
    const { h, ev, low } = watch(diving(40, -700, dir, 250), { ...still, boost: true, look: dir }, 2);
    expect(kinds(ev, 'splash')).toHaveLength(1);
    expect(kinds(ev, 'slam')).toHaveLength(0);
    expect(kinds(ev, 'impact')).toHaveLength(0);
    expect(low).toBeGreaterThanOrEqual(WATER_Y - 1e-6);
    expect(h.p[1]).toBeCloseTo(WATER_Y, 6);
    expect(h.p[2]).toBeGreaterThan(BRIDGES[0] + 30); // short of the next bridge
  });
  it('comes down softly onto it with a small splash, and hangs there', () => {
    const start = { ...newHero({ x: MID, y: WATER_Y + 3, z: -800, face: 0 }), mode: 'air' };
    const { h, ev, low } = watch(start, { ...still, down: 1 }, 2);
    expect(kinds(ev, 'splash')).toHaveLength(1);
    expect(kinds(ev, 'splash')[0].speed).toBeLessThan(FLY.slam);
    expect(kinds(ev, 'land')).toHaveLength(0);
    expect(low).toBeGreaterThanOrEqual(WATER_Y - 1e-6);
    expect(h.p[1]).toBeCloseTo(WATER_Y, 6);
    expect(h.mode).toBe('air');
  });
  it('slams onto a bridge over it, not into the water', () => {
    const { h, ev } = watch(diving(60, BRIDGES[1], [0, -1, 0], 100), { ...still, boost: true, look: [0, -1, 0] }, 1);
    expect(kinds(ev, 'slam')).toHaveLength(1);
    expect(kinds(ev, 'splash')).toHaveLength(0);
    expect(h.mode).toBe('ground');
    expect(h.p[1]).toBeCloseTo(0.4, 6);
  });
});

describe('the top of the sky', () => {
  const at = (y, extra = {}) => ({ ...newHero({ x: -240, y, z: -880, face: 0 }), mode: 'air', ...extra });
  const exits = (h, input, t) => fly(h, input, t).ev.filter((e) => e.type === 'exit');
  it('lets him out from a standstill against it', () => {
    expect(exits(at(WORLD.ceiling), { ...still, up: 1 }, 1)).toHaveLength(1);
    expect(exits(at(WORLD.ceiling), { ...still, boost: true, look: [0, Math.sin(Math.PI / 3), -0.5] }, 1)).toHaveLength(1);
  });
  it('lets him out climbing gently into it', () => {
    const look = [0, Math.sin(0.35), -Math.cos(0.35)]; // 20° up
    expect(exits(at(WORLD.ceiling - 50), { ...still, fwd: 1, look }, 8)).toHaveLength(1);
  });
  it('keeps him in, flying level along it', () => {
    const level = at(WORLD.ceiling, { v: [0, 0, -40], spd: 40, dir: [0, 0, -1] });
    expect(exits(level, { ...still, fwd: 1, look: [0, 0, -1] }, 2)).toHaveLength(0);
  });
  it('lets him straight back out after coming down from space', () => {
    // as ./orbit.js's outOfSpace leaves him: under the top, coming down, the last exit still noted
    const back = at(WORLD.ceiling - 300, { v: [0, -40, 0], spd: 40, dir: [0, -1, 0], exited: true });
    expect(exits(back, { ...still, boost: true, look: [0, 1, 0] }, 5)).toHaveLength(1);
  });
});

describe('frame rate', () => {
  it('goes the same way at any frame rate', () => {
    const input = { ...still, fwd: 1, up: 0.3, look: [0.6, 0, 0.8] };
    const a = fly(airborne(), input, 2, 1 / 30).h;
    const b = fly(airborne(), input, 2, 1 / 144).h;
    expect(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2])).toBeLessThan(1);
  });
  it('takes a long frame (a tab coming back) without going through a tower', () => {
    const tower = W.buildings.reduce((a, b) => (b.h > a.h ? b : a));
    const h0 = { ...newHero({ x: tower.x - tower.w / 2 - 5, y: tower.h / 2, z: tower.z, face: Math.PI / 2 }), mode: 'air', v: [260, 0, 0], spd: 260, dir: [1, 0, 0] };
    const h = stepHero(h0, { ...still, boost: true, look: [1, 0, 0] }, 0.25, W);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
  });
});

describe('a press that lands (lib/press.js)', () => {
  const takeoffs = (ev) => ev.filter((e) => e.type === 'takeoff').length;
  // a slam onto the street: he crouches FLY.crouch before he can go again
  const slammed = () => {
    let h = { ...newHero(SPAWN), mode: 'air', p: [SPAWN.x, groundAt(SPAWN.x, SPAWN.z) + 2, SPAWN.z], v: [0, -40, 0], spd: 40, dir: [0, -1, 0] };
    while (h.mode === 'air') h = stepHero(h, { ...still, down: 1 }, 1 / 60, W);
    return h;
  };
  it('takes off on a press made while he was still getting up from a slam', () => {
    const press = jumpPress();
    let h = slammed();
    expect(h.crouch).toBeGreaterThan(0);
    const early = h.crouch - 0.08;
    let ev = [];
    ({ h, ev } = fly(h, { ...still, press }, early));
    press.press(); // 0.08 s before he is up
    ({ h, ev } = fly(h, { ...still, press }, 0.3));
    expect(takeoffs(ev)).toBe(1);
    expect(h.mode).toBe('air');
  });
  it('drops one made too long before (the old flag drops any)', () => {
    const press = jumpPress();
    let h = slammed();
    press.press();
    const { ev } = fly(h, { ...still, press }, FLY.crouch + 0.3);
    expect(takeoffs(ev)).toBe(0);
    h = slammed();
    expect(takeoffs(fly(h, (_, s) => ({ ...still, jump: s === 0 }), FLY.crouch + 0.3).ev)).toBe(0);
  });
  it('jumps on a press just after he went over an edge (coyote time), not a moment later', () => {
    const go = (after) => {
      const press = jumpPress();
      // on his feet, then off: in the air over the park
      fly(newHero(SPAWN), { ...still, press }, 0.1);
      let { h, ev } = fly(airborne(), { ...still, press }, after);
      press.press();
      ({ ev } = fly(h, { ...still, press }, 0.1));
      return takeoffs(ev);
    };
    expect(JUMP.coyote).toBeGreaterThan(0.08);
    expect(go(0.05)).toBe(1);
    expect(go(0.2)).toBe(0);
  });
  it('one press, one takeoff, even with up held too', () => {
    const press = jumpPress();
    press.press();
    const { ev } = fly(newHero(SPAWN), { ...still, up: 1, press }, 0.5);
    expect(takeoffs(ev)).toBe(1);
  });
});

describe('R lets go of the water', () => {
  const MID = (RIVER.x0 + RIVER.x1) / 2;
  const hanging = () => fly({ ...newHero({ x: MID, y: WATER_Y + 3, z: -800, face: 0 }), mode: 'air' }, { ...still, down: 1 }, 2).h;
  it('hangs there with nothing held', () => {
    const h = fly(hanging(), still, 2).h;
    expect(onWater(h, W)).toBe(true);
    expect(h.p[1]).toBeCloseTo(WATER_Y, 6);
  });
  it('lifts him off it on R, as a jump would off the ground', () => {
    const h0 = hanging();
    expect(onWater(h0, W)).toBe(true);
    const { h, ev } = fly(h0, (_, s) => ({ ...still, free: s === 0 }), 0.5);
    expect(ev.filter((e) => e.type === 'takeoff')).toHaveLength(1);
    expect(h.p[1]).toBeGreaterThan(WATER_Y + 3);
    expect(onWater(h, W)).toBe(false);
  });
  it('does nothing away from the water', () => {
    const { ev } = fly(airborne(), (_, s) => ({ ...still, free: s === 0 }), 0.2);
    expect(ev.filter((e) => e.type === 'takeoff')).toHaveLength(0);
  });
});

describe('as another hero (./heroes.js’s multipliers)', () => {
  const W2 = buildWorld();
  // (high over the towers, flying south: room to reach each top speed before the world's edge)
  const air = () => ({ ...newHero({ x: -240, y: 420, z: -880, face: 0 }), mode: 'air' });
  const go = (h, mult, t, look = [0, 0, 1]) => {
    const ev = [];
    for (let s = 0; s < t; s += 1 / 30) {
      h = stepHero(h, { ...still, boost: true, look }, 1 / 30, W2, mult);
      ev.push(...h.ev.map((e) => ({ ...e, t: s })));
    }
    return { h, ev };
  };
  it('flies flat out at his own top speed, and breaks the barrier at his own speed', () => {
    expect(speedOf(go(air(), ONE, 6).h)).toBeCloseTo(FLY.top, 0);
    const omni = go(air(), { top: 1.6, agility: 1, boom: 90 }, 6);
    expect(speedOf(omni.h)).toBeCloseTo(FLY.top * 1.6, 0);
    const first = (ev) => ev.find((e) => e.type === 'boom').t;
    expect(first(go(air(), { top: 1.6, agility: 1, boom: 90 }, 3).ev)).toBeLessThan(first(go(air(), ONE, 3).ev));
  });
  it('turns quicker with more agility', () => {
    const fast = { ...air(), v: [0, 0, -100], spd: 100, dir: [0, 0, -1] };
    const turned = (mult) => {
      const h = stepHero(fast, { ...still, fwd: 1, look: [1, 0, 0] }, 0.3, W2, mult);
      return Math.atan2(h.dir[0], -h.dir[2]);
    };
    expect(turned({ ...ONE, agility: 1.3 })).toBeGreaterThan(turned(ONE) * 1.2);
  });
  it('a switch mid-flight keeps where he is and which way, his speed cut to the new top', () => {
    const h = go(air(), ONE, 6).h;
    const eve = switchHero(h, { top: 0.8, agility: 1.3, boom: FLY.barrier });
    expect(eve.p).toEqual(h.p);
    expect(eve.dir).toEqual(h.dir);
    expect(speedOf(eve)).toBeCloseTo(FLY.top * 0.8, 6);
    expect(switchHero(h, { top: 1.8, agility: 1, boom: FLY.barrier })).toEqual(h);
  });
});

describe('launched (episode 8: Dad’s hit)', () => {
  const W3 = buildWorld();
  const run = (h, t) => {
    const ev = [];
    for (let s = 0; s < t - 1e-9; s += 1 / 30) {
      h = stepHero(h, { ...still, fwd: 1, boost: true, look: [-1, 0, 0] }, 1 / 30, W3);
      ev.push(...h.ev);
    }
    return { h, ev };
  };
  it('carries him along it at its speed for 1.2 s whatever he presses, through three houses, then hands him back', () => {
    const start = { ...newHero({ x: -2050.2, y: 1, z: 256.5, face: 0 }), mode: 'air' };
    const { h, ev } = run(launch(start, HIT, 343), 1.25);
    expect(ev.filter((e) => e.type === 'through')).toHaveLength(3);
    expect(ev.filter((e) => e.type === 'launchEnd')).toHaveLength(1);
    // (past the three, the strip's shops stop him: a crash, which ends it too)
    const along = (h.p[0] - start.p[0]) * HIT[0] + (h.p[2] - start.p[2]) * HIT[2];
    expect(along).toBeGreaterThan(200);
    expect(h.launched).toBe(null);
    // (the three it went through came before the end, at Mach 1 all the way)
    const end = ev.findIndex((e) => e.type === 'launchEnd');
    expect(ev.slice(0, end).filter((e) => e.type === 'through')).toHaveLength(3);
  });
  it('a tower stops him as a crash would, and that’s the end of it', () => {
    const tower = W3.buildings.reduce((a, b) => (b.h > a.h ? b : a));
    const start = { ...newHero({ x: tower.x - tower.w / 2 - 30, y: tower.h / 2, z: tower.z, face: 0 }), mode: 'air' };
    const { h, ev } = run(launch(start, [1, 0, 0], 200, 2), 0.5);
    expect(ev.find((e) => e.type === 'impact').speed).toBeGreaterThan(150);
    expect(ev.some((e) => e.type === 'launchEnd')).toBe(true);
    expect(h.p[0]).toBeLessThan(tower.x - tower.w / 2);
  });
});
