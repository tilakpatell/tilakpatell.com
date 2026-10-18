import { describe, expect, it } from 'vitest';
import { CHARGE, CREW_POWERS, KEPT_KEY, POWERS, POWER_KEYS, aimHelp, beamOf, blastPunch, cancel, chargeFor, clearOfSolids, createPowers, crossesShell, finish, firstAlong, gain, hasten, isObjective, jinkStep, mods, pickTargets, portalExit, picksFor, powersOf, press, pullStep, readCooling, readKept, retune, shotAt, step, turretPick, view, writeKept } from './shipPowers';
import { CREWS } from './crews';
import { spawn, step as fly } from './ship';
import { makeSpace } from '../galaxy/space';

// the state a few seconds on, a tenth of a second at a time; the events it said
const run = (st, seconds, opts) => {
  const out = [];
  for (let t = 0; t < seconds - 1e-9; t += 0.1) out.push(...step(st, 0.1, opts));
  return out;
};
const ship = { x: 0, y: 0, z: 0, heading: 0, pitch: 0 }; // (the nose along −z)
const T = (id, x, z, threat = 0, more = {}) => ({ id, at: { x, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, size: 0.5, threat, ...more });
// the real ship flown on from a portal's exit for `seconds` with the stick
// held as `input` says: the first crash it comes to, or null
const flown = (exit, input, seconds, space) => {
  let s = { ...spawn('x'), x: exit.x, y: exit.y, z: exit.z, heading: exit.heading, pitch: exit.pitch, bank: 0, speed: exit.speed };
  for (let t = 0; t < seconds; t += 1 / 30) {
    const r = fly(s, { throttle: 0, turn: 0, climb: 0, roll: 0, ...input }, 1 / 30, space.solids, space);
    s = r.ship;
    const crash = r.events.find((e) => e.type === 'crash');
    if (crash) return { ...crash, t };
  }
  return null;
};

describe('the crews’ ship powers', () => {
  it('gives every crew a power on G with a cooldown and a big one on X, and nobody else anything', () => {
    expect(POWER_KEYS).toEqual({ primary: 'g', ultimate: 'x' });
    for (const c of CREWS) {
      const own = powersOf(c.id);
      expect(own, c.id).toBeTruthy();
      expect(POWERS[own.primary].slot, c.id).toBe('primary');
      expect(POWERS[own.primary].crew, c.id).toBe(c.id);
      expect(POWERS[own.primary].cool, c.id).toBeGreaterThan(0);
      expect(POWERS[own.ultimate].slot, c.id).toBe('ultimate');
      expect(POWERS[own.ultimate].crew, c.id).toBe(c.id);
      for (const id of [own.primary, own.ultimate]) {
        expect(POWERS[id].name.length, id).toBeGreaterThan(3);
        expect(POWERS[id].about.length, id).toBeGreaterThan(10);
        expect(POWERS[id].dur, id).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(CREW_POWERS)).toEqual(['xwing', 'falcon', 'cruiser', 'rv']);
    expect(powersOf('nope')).toBeNull();
    expect(createPowers('nope')).toBeNull();
    expect(createPowers(null)).toBeNull();
  });

  it('names the big ones apart from the universe map’s heavy rounds', () => {
    expect(POWERS.salvo.name).toBe('Torpedo salvo');
    expect(POWERS.heisenberg.name).toBe('Say my name');
    expect(POWERS.quad.name).toBe('Chewie on the quad guns');
    expect(POWERS.wubba.name).toBe('Wubba lubba dub dub');
  });

  it('refuses a press while it charges, while it is on and while it cools, and says why', () => {
    const st = createPowers('xwing');
    expect(press(st, 'ultimate')).toEqual({ ok: false, why: 'charging' });
    expect(press(st, 'primary')).toEqual({ ok: true, id: 'focus' });
    expect(press(st, 'primary')).toEqual({ ok: false, why: 'active' });
    run(st, 5.05);
    expect(press(st, 'primary')).toEqual({ ok: false, why: 'cooling' });
    expect(press(null, 'primary')).toEqual({ ok: false, why: 'none' });
    expect(press(st, 'third')).toEqual({ ok: false, why: 'none' });
  });

  it('has Force Focus on for 5 s, then cooling 22 s, then ready, saying so as it goes', () => {
    const st = createPowers('xwing');
    press(st, 'primary');
    const on = run(st, 4.9, { flying: false });
    expect(st.primary.phase).toBe('active');
    expect(on).toEqual([]);
    const ended = run(st, 0.2, { flying: false });
    expect(st.primary.phase).toBe('cooling');
    expect(ended).toContainEqual({ type: 'end', slot: 'primary', id: 'focus' });
    run(st, 21.7, { flying: false });
    expect(st.primary.phase).toBe('cooling');
    const back = run(st, 0.4, { flying: false });
    expect(st.primary.phase).toBe('ready');
    expect(back).toContainEqual({ type: 'ready', slot: 'primary', id: 'focus' });
  });

  it('fills the big one with five kills: four don’t, the fifth does', () => {
    const st = createPowers('falcon');
    for (let i = 0; i < 4; i++) expect(gain(st, 'kill')).toBe(false);
    expect(st.ultimate.phase).toBe('charging');
    expect(gain(st, 'kill')).toBe(true);
    expect(st.ultimate.phase).toBe('ready');
    expect(st.ultimate.charge).toBe(1);
    // (an ace is worth more, and a hit a little)
    expect(CHARGE.ace).toBeGreaterThan(CHARGE.kill);
    expect(CHARGE.hit).toBeGreaterThan(0);
    expect(CHARGE.hit).toBeLessThan(CHARGE.kill);
  });

  it('a pickup charges the big one a quarter, and hastens the cooldown', () => {
    const st = createPowers('xwing');
    gain(st, 'pickup');
    expect(st.ultimate.charge).toBeCloseTo(0.25);
    st.primary.phase = 'cooling';
    st.primary.left = 4;
    expect(hasten(st, 1)).toBe(false);
    expect(st.primary.left).toBe(3);
    expect(hasten(st, 5)).toBe(true);
    expect(st.primary.phase).toBe('ready');
    expect(hasten(st, 5)).toBe(false);
    expect(hasten(null, 5)).toBe(false);
  });

  // (Every hit that downed nothing used to charge it, a battle's shield and a
  // capital ship's hull among them: holding fire on a shielded Star
  // Destroyer at the X-wing's 8.3 shots a second filled it in 6 s.)
  it('charges the big one only from what the guns can take down, and a little from hits on any one of them', () => {
    expect(chargeFor({ down: false, shield: true }, { war: true })).toBeNull();
    expect(chargeFor({ down: false, capital: true }, { war: true })).toBeNull();
    expect(chargeFor(null)).toBeNull();
    expect(chargeFor({ down: false })).toBe('hit');
    expect(chargeFor({ down: false, sub: 'shield' }, { war: true })).toBe('hit');
    expect(chargeFor({ down: true, sub: 'shield' }, { war: true })).toBe('objective');
    expect(chargeFor({ down: true, turret: true }, { war: true })).toBe('objective');
    expect(chargeFor({ down: true }, { war: true })).toBe('kill');
    expect(chargeFor({ down: true }, { ace: true })).toBe('ace');
    // a minute's fire into a shield at the quickest the guns go: nothing
    const st = createPowers('xwing');
    for (let i = 0; i < 60 / 0.12; i++) {
      const what = chargeFor({ down: false, shield: true }, { war: true });
      if (what) gain(st, what, 1, 'war:7');
    }
    expect(st.ultimate.charge).toBe(0);
    // hits on any one thing charge it CHARGE.hitCap at most (a 120-hp
    // objective takes thirty: they'd have been most of a fill), but on
    // several, each its own share
    for (let i = 0; i < 30; i++) gain(st, 'hit', 1, 'war:2000123');
    expect(st.ultimate.charge).toBeCloseTo(CHARGE.hitCap, 6);
    for (let i = 0; i < 3; i++) gain(st, 'hit', 1, `hunters:${i}`);
    expect(st.ultimate.charge).toBeCloseTo(CHARGE.hitCap + 3 * CHARGE.hit, 6);
    // (and a long session's targets don't pile up without end)
    for (let i = 0; i < 1000; i++) gain(st, 'hit', 0, `hunters:${i + 10}`);
    expect(st.hits.size).toBeLessThanOrEqual(64);
  });

  it('never charges the big one from its own kills, and a cancel ends it into charging again', () => {
    const st = createPowers('cruiser', { charge: 1 });
    expect(st.ultimate.phase).toBe('ready');
    expect(press(st, 'ultimate')).toEqual({ ok: true, id: 'wubba' });
    expect(st.ultimate.charge).toBe(0);
    expect(gain(st, 'kill', 3)).toBe(false);
    expect(st.ultimate.charge).toBe(0);
    expect(cancel(st)).toContainEqual({ type: 'end', slot: 'ultimate', id: 'wubba' });
    expect(st.ultimate.phase).toBe('charging');
    expect(cancel(st)).toEqual([]);
  });

  it('ends one power early when its work is done (the last torpedo home), and only that one', () => {
    const st = createPowers('xwing', { charge: 1 });
    press(st, 'primary');
    press(st, 'ultimate');
    expect(finish(st, 'ultimate')).toEqual([{ type: 'end', slot: 'ultimate', id: 'salvo' }]);
    expect(st.ultimate.phase).toBe('charging');
    expect(st.primary.phase).toBe('active');
    expect(finish(st, 'ultimate')).toEqual([]);
  });

  it('fills the big one by flying 150 s, but not standing still', () => {
    const idle = createPowers('rv');
    run(idle, 150, { flying: false });
    expect(idle.ultimate.charge).toBe(0);
    const flown = createPowers('rv');
    const said = run(flown, 151, { flying: true });
    expect(flown.ultimate.phase).toBe('ready');
    expect(said.filter((e) => e.slot === 'ultimate' && e.type === 'ready')).toHaveLength(1);
  });

  it('tells the scene what to change: time slowed and the guns helped only while Focus is on, a ghost while Han jinks or Rick portals, a heavy hand on the death ray', () => {
    // (Force Focus no longer quickens the guns: the X-wing's own cadence,
    // 0.12 s, is already the quickest the wire lets in, so ×0.7 changed
    // nothing on any gun but the fusion cannon, and a power that does nothing
    // as the ship comes reads as broken)
    const none = { slow: 1, assist: 0, track: 0, ghost: false, turn: 1, agility: 1 };
    expect(mods(null)).toEqual(none);
    const x = createPowers('xwing');
    expect(mods(x)).toEqual(none);
    press(x, 'primary');
    expect(mods(x)).toEqual({ ...none, slow: 0.35, assist: 2.5, track: 2 });
    expect(POWERS.focus.cadence).toBeUndefined();
    run(x, 5.1);
    expect(mods(x).slow).toBe(1);
    const f = createPowers('falcon');
    press(f, 'primary');
    expect(mods(f)).toMatchObject({ ghost: true, agility: 1.3, slow: 1 });
    const c = createPowers('cruiser', { charge: 1 });
    press(c, 'primary');
    expect(mods(c).ghost).toBe(true);
    run(c, 0.4);
    expect(mods(c).ghost).toBe(false);
    press(c, 'ultimate');
    expect(mods(c).turn).toBe(0.6);
  });

  it('turns the guns’ help up onto the game’s own ships only, never onto another pilot', () => {
    const own = { assist: 1, track: 0.5 };
    const x = createPowers('xwing');
    press(x, 'primary');
    expect(aimHelp(mods(x), own, true)).toEqual({ assist: 2.5, track: 2 });
    // (locked on another pilot: the visitor's own settings, as with no power on)
    expect(aimHelp(mods(x), own, false)).toEqual(own);
    expect(aimHelp(mods(null), own, true)).toEqual(own);
    // (and never less than the visitor's own)
    expect(aimHelp(mods(x), { assist: 3, track: 2.2 }, true)).toEqual({ assist: 3, track: 2.2 });
  });

  it('gives the HUD its keys, names and how far round each ring is', () => {
    const st = createPowers('xwing');
    const v = view(st);
    expect(v.primary).toMatchObject({ id: 'focus', name: 'Force Focus', key: 'G', phase: 'ready', k: 0 });
    expect(v.ultimate).toMatchObject({ id: 'salvo', key: 'X', phase: 'charging', k: 1, charge: 0 });
    press(st, 'primary');
    expect(view(st).primary.k).toBe(0);
    run(st, 2.5, { flying: false });
    expect(view(st).primary.k).toBeCloseTo(0.5, 2); // (on: the ring runs down with the time left)
    expect(view(st).primary.left).toBe(3);
    run(st, 2.6, { flying: false });
    const ks = [];
    for (let i = 0; i < 22; i++) {
      ks.push(view(st).primary.k);
      run(st, 1, { flying: false });
    }
    expect(ks[0]).toBeGreaterThan(0.95);
    for (let i = 1; i < ks.length; i++) expect(ks[i]).toBeLessThan(ks[i - 1]);
    expect(view(st).primary.k).toBe(0);
    gain(st, 'kill', 2);
    expect(view(st).ultimate.k).toBeCloseTo(0.6, 5);
    expect(view(null)).toBeNull();
  });

  it('picks the torpedoes’ targets: the ones coming at you in the cone first, then nearest the nose, never one behind; none ahead, the nearest', () => {
    const picked = pickTargets(ship, [T(1, 0, -20), T(2, 3, -30, 1), T(3, 0, 20), T(4, 1, -50), T(5, 0, -70)], { count: 4 });
    expect(picked.map((t) => t.id)).toEqual([2, 1, 4]);
    expect(pickTargets(ship, [T(3, 0, 20), T(6, 0, 10)]).map((t) => t.id)).toEqual([6, 3]);
    expect(pickTargets(ship, [T(1, 0, -20), T(4, 1, -50)], { count: 1 }).map((t) => t.id)).toEqual([1]);
    expect(pickTargets(ship, [])).toEqual([]);
  });

  it('lets the portal out behind a moving target, facing the way it goes; past a still one, away from you', () => {
    const fleeing = { id: 9, at: { x: 0, y: 0, z: -30 }, vel: { x: 10, y: 0, z: 0 } };
    const out = portalExit(ship, fleeing, POWERS.portal);
    expect(out.x).toBeCloseTo(-5, 6);
    expect(out.z).toBeCloseTo(-30, 6);
    expect(out.heading).toBeCloseTo(-Math.PI / 2, 6); // (facing +x)
    const still = portalExit(ship, { id: 1, at: { x: 0, y: 0, z: -30 }, vel: { x: 0, y: 0, z: 0 } }, POWERS.portal);
    expect(still.z).toBeCloseTo(-25, 6);
    expect(still.heading).toBeCloseTo(0, 6);
  });

  it('hops 40 along the nose with no target, at cruise at least, never past the edge, the ceiling or the floor', () => {
    const hop = portalExit(ship, null, POWERS.portal);
    expect(hop.z).toBeCloseTo(-40, 6);
    expect(hop.speed).toBe(POWERS.portal.out);
    expect(hop.short).toBe(false);
    expect(portalExit({ ...ship, speed: 9 }, null, POWERS.portal).speed).toBe(9);
    const edged = portalExit(ship, null, POWERS.portal, [], { edge: 30 });
    expect(Math.hypot(edged.x, edged.z)).toBeLessThanOrEqual(25 + 1e-6);
    // (nose down near the floor: it used to let you out 40 under the floor)
    const low = { ...ship, y: -400, pitch: -1.2 };
    expect(portalExit(low, null, POWERS.portal).y).toBeLessThan(-420);
    const floored = portalExit(low, null, POWERS.portal, [], { ceiling: () => 420 });
    expect(Math.abs(floored.y)).toBeLessThanOrEqual(415 + 1e-6);
    const high = portalExit({ ...ship, y: 400, pitch: 1.2 }, null, POWERS.portal, [], { ceiling: () => 420 });
    expect(Math.abs(high.y)).toBeLessThanOrEqual(415 + 1e-6);
  });

  // (A hop into a planet used to be pushed out to a unit off its ground, the
  // nose still on it and at cruise at least: a crash no pilot could fly out
  // of. Now it stops short, with room ahead to turn off, at the ship's own
  // speed; and with no room for a hop worth having, there's none.)
  it('stops a hop short of a planet in its way, with room to turn off it, at the ship’s own speed', () => {
    const P = POWERS.portal;
    const planet = [{ id: 'planet', at: [0, 0, -90], r: 60, reach: 70, planet: true }];
    const space = makeSpace(planet);
    // 30 off the ground, stopped, the nose on its middle
    const out = portalExit(ship, null, P, planet);
    expect(out.short).toBe(true);
    expect(out.speed).toBe(0);
    expect(-out.z).toBeGreaterThanOrEqual(P.least - 1e-6); // (still a hop)
    expect(out.z - -30).toBeGreaterThanOrEqual(P.room - 1e-6); // (room before the ground)
    // flown on from there with the real ship: no crash in a second with no
    // hand on the stick, nor in four with it pulled full up, however fast it went in
    for (const speed of [0, 3.3, 6, 9, 12]) {
      const exit = portalExit({ ...ship, speed }, null, P, planet);
      expect(exit, `at ${speed}`).not.toBeNull();
      expect(flown(exit, {}, 1, space), `at ${speed}, no hands`).toBeNull();
      expect(flown(exit, { climb: 1 }, 4, space), `at ${speed}, pulling up`).toBeNull();
    }
    // nowhere to come out with room ahead, and not a hop worth having short
    // of that: none (6 off the ground; or 30 off it but going in at 20, a
    // second and a half from it already)
    expect(portalExit({ ...ship, z: -24 }, null, P, planet)).toBeNull();
    expect(portalExit({ ...ship, speed: 20 }, null, P, planet)).toBeNull();
  });

  it('lets the portal out short of a hull a still target sits on, facing it, or not at all', () => {
    const P = POWERS.portal;
    const hull = [{ id: 'war-7-0', at: [0, 0, -40], r: 8 }];
    const space = makeSpace(hull);
    // a battery on the hull's near face: past it, away from you, is inside the hull
    const battery = { id: 3, at: { x: 0, y: 0, z: -31.6 }, vel: { x: 0, y: 0, z: 0 } };
    const out = portalExit(ship, battery, P, hull);
    expect(out.short).toBe(true);
    expect(out.heading).toBeCloseTo(0, 6); // (facing it)
    expect(out.z - -32).toBeGreaterThanOrEqual(P.room - 1e-6);
    expect(flown(out, {}, 1, space)).toBeNull();
    // and one in a hollow of hulls, with no room anywhere behind it: none
    const boxed = [...hull, { id: 'war-7-1', at: [0, 0, -14], r: 11 }];
    expect(portalExit(ship, battery, P, boxed)).toBeNull();
  });

  it('keeps a ship that’s down in a trench in it, clearing it to the trench’s floor, not out over the top', () => {
    // (Yavin's Death Star: its rim at 34, the trench's floor at 31.98, round its middle)
    const ds = [{ id: 'deathstar', at: [0, 0, 0], r: 34, band: { half: 1.2, floor: 31.98, home: 0, arc: Math.PI } }];
    expect(clearOfSolids({ x: 32.99, y: 0, z: 0 }, ds, 0.5).x).toBeCloseTo(32.99, 6);
    expect(clearOfSolids({ x: 31, y: 0, z: 0 }, ds, 0.5).x).toBeCloseTo(32.48, 6);
    const above = clearOfSolids({ x: 0, y: 33, z: 0 }, ds, 0.5);
    expect(above.y).toBeCloseTo(34.5, 6);
    // and a hop along the trench comes out in it, not thrown up over the rim
    const inTrench = { x: 32.99, y: 0, z: 0, heading: 0, pitch: 0, speed: 3 };
    const out = portalExit(inTrench, null, { ...POWERS.portal, hop: 5, least: 2 }, ds);
    expect(Math.hypot(out.x, out.y, out.z)).toBeLessThan(34);
  });

  it('knows when a hop crosses a shield round the middle (Scarif’s)', () => {
    expect(crossesShell({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 10 }, 30)).toBe(true);
    expect(crossesShell({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 50 }, 30)).toBe(true);
    expect(crossesShell({ x: 0, y: 0, z: 50 }, { x: 0, y: 0, z: 40 }, 30)).toBe(false);
  });

  it('runs the death ray from the nose, its length on', () => {
    const b = beamOf({ ...ship, heading: Math.PI / 2 }, 45); // (the nose along −x)
    expect(b.from.x).toBeCloseTo(-0.2, 6);
    expect(b.to.x).toBeCloseTo(-45, 6);
    expect(b.to.z).toBeCloseTo(0, 6);
  });

  it('hits hardest in a blast’s middle, less at its rim, nothing past it', () => {
    expect(blastPunch(0)).toBe(10);
    expect(blastPunch(5)).toBeCloseTo(6.5, 6);
    expect(blastPunch(10)).toBe(3);
    expect(blastPunch(10.1)).toBe(0);
  });

  it('pulls one toward the magnet no faster than it may, and never past it', () => {
    expect(pullStep({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 16, 1)).toEqual({ x: 0, y: 0, z: 0 });
    const p = pullStep({ x: 10, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4, 1);
    expect(p.x).toBeCloseTo(6, 6);
    expect(pullStep({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('corkscrews 3 units sideways and twice round over the whole of it, either way', () => {
    for (const side of [1, -1]) {
      let moved = 0;
      let roll = 0;
      for (let t = 0; t < POWERS.odds.dur - 1e-9; t += 0.01) {
        const j = jinkStep(t, 0.01, POWERS.odds, side);
        moved += j.step;
        roll = j.roll;
      }
      expect(moved).toBeCloseTo(3 * side, 6);
      expect(roll).toBeCloseTo(4 * Math.PI * side, 6);
    }
    // (quickest in the middle)
    expect(Math.abs(jinkStep(1.1, 0.01).step)).toBeGreaterThan(Math.abs(jinkStep(0.05, 0.01).step));
  });

  it('has Chewie shoot at the nearest coming at you, and stay on the one he’s on while it’s in range', () => {
    expect(turretPick(ship, [T(1, 0, -10), T(2, 0, -20, 1)]).id).toBe(2);
    expect(turretPick(ship, [T(1, 0, -10), T(2, 0, -20, 1)], 35, 1).id).toBe(1);
    expect(turretPick(ship, [T(1, 0, 40)], 35)).toBeNull();
    expect(turretPick(ship, [T(1, 0, 30)], 35).id).toBe(1); // (all the way round: behind too)
  });

  it('tells a battle’s objectives from its fighters, and what a shot meets first along its way', () => {
    expect(isObjective({ kind: 'turret' })).toBe(true);
    expect(isObjective({ kind: 'subsystem', sub: 'shield' })).toBe(true);
    expect(isObjective({ kind: 'tie' })).toBe(false);
    // (and the war's set pieces' own: Endor's generator, a run's reactor, Hoth's ion cannon)
    for (const kind of ['shieldgen', 'reactor', 'cannon']) expect(isObjective({ kind, id: 5e6 }), kind).toBe(true);
    const near = T(1, 0, -10);
    const far = T(2, 0, -20, 0, { kind: 'subsystem' });
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [far, near], 1 / 60)).toBe(near);
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [T(3, 5, -10)], 1 / 60)).toBeNull();
    // (one crossing the way in the frame is met where it was on the way: still, where it is now, it would be missed)
    const crossing = T(4, 1.5, -10, 0, { vel: { x: 120, y: 0, z: 0 } });
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [crossing], 1 / 60)).toBe(crossing);
    expect(firstAlong({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, [{ ...crossing, vel: { x: 0, y: 0, z: 0 } }], 1 / 60)).toBeNull();
  });

  it('aims a power’s shot at a target: from just off it on the side it comes from, ending where it is now', () => {
    const t = T(1, 0, -10);
    const s = shotAt(t, { x: 0, y: 0, z: 0 });
    expect(s.to).toEqual({ x: 0, y: 0, z: -10 });
    expect(s.to).not.toBe(t.at); // (a copy: the target moves on)
    expect(s.from.x).toBeCloseTo(0, 6);
    expect(s.from.z).toBeCloseTo(-10 + 0.5 + 0.6, 6);
    // (from right where it is: from above it)
    const over = shotAt(t, { x: 0, y: 0, z: -10 });
    expect(over.from.y).toBeGreaterThan(0);
    expect(over.from.z).toBeCloseTo(-10, 6);
  });

  // (Only the charge used to be kept, so landing and taking off again gave
  // G back at once, however long its cooldown had left.)
  it('keeps the power’s cooldown across a landing too, running on while you’re down', () => {
    const T0 = 1_700_000_000_000;
    const st = createPowers('falcon');
    press(st, 'primary');
    run(st, POWERS.odds.dur + 2); // (2 s into its 12 s cooldown)
    expect(st.primary.phase).toBe('cooling');
    const raw = writeKept(st, T0);
    expect(readCooling(raw, 'falcon', T0)).toBeCloseTo(st.primary.left, 3);
    // five seconds on the ground, and it's five seconds nearer
    const left = readCooling(raw, 'falcon', T0 + 5000);
    expect(left).toBeCloseTo(st.primary.left - 5, 3);
    const back = createPowers('falcon', { charge: readKept(raw, 'falcon'), cool: left });
    expect(back.primary).toEqual({ id: 'odds', phase: 'cooling', left: expect.closeTo(left, 3) });
    // a long while down: ready again; another crew's, or anything broken: nothing to wait for
    expect(readCooling(raw, 'falcon', T0 + 60_000)).toBe(0);
    expect(readCooling(raw, 'rv', T0)).toBe(0);
    for (const bad of [null, '', '{bad', JSON.stringify({ crew: 'falcon', charge: 0, coolUntil: 'soon' })]) expect(readCooling(bad, 'falcon', T0), String(bad)).toBe(0);
    // (never more than the card's own cooldown, whatever the clock says)
    expect(readCooling(JSON.stringify({ crew: 'falcon', charge: 0, coolUntil: T0 + 9e9 }), 'falcon', T0)).toBe(POWERS.odds.cool);
    expect(createPowers('falcon', { cool: 0 }).primary.phase).toBe('ready');
    expect(createPowers('falcon', { cool: NaN }).primary.phase).toBe('ready');
    // ready when it lands: nothing kept to wait for
    expect(readCooling(writeKept(createPowers('falcon'), T0), 'falcon', T0)).toBe(0);
  });

  it('keeps the big one’s charge across a landing for the same crew, and starts again for another', () => {
    expect(KEPT_KEY).toBe('tp:ship-powers');
    const st = createPowers('xwing');
    gain(st, 'kill', 3);
    const raw = writeKept(st);
    expect(readKept(raw, 'xwing')).toBeCloseTo(0.6, 6);
    expect(readKept(raw, 'falcon')).toBe(0);
    expect(createPowers('xwing', { charge: readKept(raw, 'xwing') }).ultimate.charge).toBeCloseTo(0.6, 6);
    for (const bad of [null, '', '{bad', '[]', '3', JSON.stringify({ crew: 'xwing', charge: 'lots' }), JSON.stringify({ crew: 'nope', charge: 1 })]) expect(readKept(bad, bad?.includes('nope') ? 'nope' : 'xwing'), String(bad)).toBe(0);
    expect(readKept(JSON.stringify({ crew: 'rv', charge: 7 }), 'rv')).toBe(1);
    expect(writeKept(null)).toBeNull();
  });
});

describe('a crew carrying another crew’s powers (the skill tree’s borrowed pairs)', () => {
  it('carries its own pair by default', () => {
    expect(picksFor('xwing', {}, [])).toEqual({ primary: 'focus', ultimate: 'salvo' });
    expect(picksFor('xwing', null, null)).toEqual({ primary: 'focus', ultimate: 'salvo' });
  });
  it('carries a borrowed one only where it may, and only in its own slot', () => {
    expect(picksFor('xwing', { xwing: { primary: 'portal' } }, [])).toEqual({ primary: 'focus', ultimate: 'salvo' });
    expect(picksFor('xwing', { xwing: { primary: 'portal' } }, ['cruiser'])).toEqual({ primary: 'portal', ultimate: 'salvo' });
    expect(picksFor('xwing', { xwing: { ultimate: 'portal' } }, ['cruiser'])).toEqual({ primary: 'focus', ultimate: 'salvo' });
    expect(picksFor('xwing', { xwing: { primary: 'nope' } }, ['cruiser'])).toEqual({ primary: 'focus', ultimate: 'salvo' });
  });
  it('plays the picks it’s handed', () => {
    const st = createPowers('xwing', { picks: { primary: 'portal', ultimate: 'wubba' } });
    expect(st.primary.id).toBe('portal');
    expect(st.ultimate.id).toBe('wubba');
  });
});

describe('the powers with the skill tree’s (hangar/skills’ fx)', () => {
  it('cools down sooner with quick recovery, and lasts longer with overdrive', () => {
    const st = createPowers('xwing', { fx: { powerCool: 0.85, powerDur: 1.2 } });
    press(st, 'primary');
    expect(st.primary.left).toBeCloseTo(POWERS.focus.dur * 1.2);
    step(st, POWERS.focus.dur * 1.2 + 0.01);
    expect(st.primary.phase).toBe('cooling');
    expect(st.primary.left).toBeCloseTo(POWERS.focus.cool * 0.85, 1);
  });
  it('charges the big one quicker, and more from a pickup with a scavenger', () => {
    const st = createPowers('xwing', { fx: { charge: 1.2, pickup: 1.5 } });
    gain(st, 'kill');
    expect(st.ultimate.charge).toBeCloseTo(CHARGE.kill * 1.2);
    gain(st, 'pickup');
    expect(st.ultimate.charge).toBeCloseTo(CHARGE.kill * 1.2 + CHARGE.pickup * 1.2 * 1.5);
  });
  it('reads its ring against the lengths it has, not the cards’', () => {
    const st = createPowers('xwing', { fx: { powerDur: 2 } });
    press(st, 'primary');
    step(st, POWERS.focus.dur);
    expect(view(st).primary.k).toBeCloseTo(0.5, 2);
  });
  it('is as the cards have it with no skills', () => {
    const st = createPowers('xwing');
    press(st, 'primary');
    expect(st.primary.left).toBe(POWERS.focus.dur);
  });
});

describe('the powers retuned for the same crew (new skills or picks in the Hangar)', () => {
  it('keeps a power that’s on running, its new lengths for after', () => {
    const st = createPowers('xwing');
    press(st, 'primary');
    step(st, 1);
    const left = st.primary.left;
    expect(retune(st, { fx: { powerCool: 0.5 } }).cut).toBe(false);
    expect(st.primary.phase).toBe('active');
    expect(st.primary.left).toBeCloseTo(left);
    step(st, left + 0.01);
    expect(st.primary.left).toBeCloseTo(POWERS.focus.cool * 0.5, 1);
  });
  it('keeps the big one’s charge, and puts the new pick in an idle slot', () => {
    const st = createPowers('xwing', { charge: 0.4 });
    expect(retune(st, { picks: { primary: 'portal', ultimate: 'salvo' } }).cut).toBe(false);
    expect(st.primary).toMatchObject({ id: 'portal', phase: 'ready' });
    expect(st.ultimate.charge).toBeCloseTo(0.4);
  });
  it('ends a power that’s on when its slot is given another, cooling as the new one does', () => {
    const st = createPowers('xwing');
    press(st, 'primary');
    expect(retune(st, { picks: { primary: 'portal', ultimate: 'salvo' } }).cut).toBe(true);
    expect(st.primary).toMatchObject({ id: 'portal', phase: 'cooling' });
    expect(st.primary.left).toBeCloseTo(POWERS.portal.cool);
  });
});
