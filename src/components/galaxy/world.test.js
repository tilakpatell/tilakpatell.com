import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SYSTEMS, goalsOf, kindsIn, systemById } from './systems';
import { placesOf, spaceGoals } from './places';
import { makeSpace } from './space';
import { buildSystem } from './world';
import { LASER } from './fx';
import { dishAt } from './stationFx';

// the parts that draw (the planets' shaders, the rocks, the ships) stood in
// for: these are about what's built, where, and what it does over time
const made = vi.hoisted(() => []); // (the bodies it was asked for)
vi.mock('./bodies', () => ({
  buildBody: (look, { r }) => {
    const b = { group: new THREE.Group(), radius: r, reach: r * 1.08, update() {}, setSuns() {}, set() {}, setDetail: vi.fn(), dispose() {} };
    made.push(b);
    return b;
  },
}));
vi.mock('./rocks', () => ({
  createRocks: ({ at = [0, 0, 0] }) => ({ group: new THREE.Group(), solids: [{ id: 'rock-1', at: [at[0] + 3, at[1], at[2]], r: 2, reach: 2 }], update() {}, dispose() {} }),
}));

const kit = () => ({
  models: { slot: (kind, size) => ({ kind, size, holder: new THREE.Group(), real: false }), drop: () => {} },
  bolts: { fire: vi.fn(() => true) },
  flashes: { at: vi.fn() },
});
const T0 = 1_790_000_000; // some time on the wall clock
const camera = new THREE.PerspectiveCamera();

describe('buildSystem', () => {
  it('builds every system with its planet and its goals, the ones the map names', () => {
    for (const sys of SYSTEMS) {
      const w = buildSystem(sys, { ...kit(), small: false });
      // (and the game's space level, where the system has one: places.js's SPACE_LEVELS)
      expect(w.goals.map((g) => g.id).sort(), sys.id).toEqual([...goalsOf(sys), ...placesOf(sys), ...spaceGoals(sys.id)].map((g) => g.id).sort());
      const planet = w.solids.find((o) => o.id === 'planet');
      expect(planet, sys.id).toBeTruthy();
      if (sys.body) expect(planet.r).toBe(sys.body.r);
      for (const o of w.solids) for (const v of o.at) expect(Number.isFinite(v), `${sys.id} ${o.id}`).toBe(true);
      w.dispose();
    }
  });

  it('passes the detail it is given to every body it made', () => {
    const sys = systemById('tatooine');
    made.length = 0;
    const w = buildSystem(sys, { ...kit(), small: false });
    expect(made.length).toBe(1 + (sys.parent ? 1 : 0) + sys.moons.length);
    w.setDetail(0.4);
    for (const b of made) expect(b.setDetail).toHaveBeenCalledWith(0.4);
    w.dispose();
  });

  it('sizes its skylanes’ ships for the pixel ratio it is told', () => {
    const lanesOf = (w) => {
      const found = [];
      w.group.traverse((o) => o.material?.uniforms?.uDpr && found.push(o.material));
      return found;
    };
    const w = buildSystem(systemById('coruscant'), { ...kit(), small: false, ratio: 0.75 });
    expect(lanesOf(w).map((m) => m.uniforms.uDpr.value)).toEqual([0.75]); // (built at the ratio it's drawn at)
    w.setRatio(1.25);
    expect(lanesOf(w).map((m) => m.uniforms.uDpr.value)).toEqual([1.25]);
    w.dispose();
  });

  it('keeps every ship and station clear of the planet', () => {
    for (const sys of SYSTEMS) {
      if (!sys.body) continue;
      const w = buildSystem(sys, { ...kit(), small: false });
      w.update(T0, 0, camera, null); // (the moving ones, where they are)
      for (const o of w.solids) {
        if (o.id === 'planet' || o.id.startsWith('moon') || o.id.startsWith('rocks-') || o.id.startsWith('coreship') || o.id === 'cloudcity' || o.id.startsWith('cloudcity-')) continue;
        expect(Math.hypot(...o.at) - o.r, `${sys.id}: ${o.id}`).toBeGreaterThan(sys.body.r);
      }
      w.dispose();
    }
  });

  it('plays out a few minutes of every system without a hitch', () => {
    for (const sys of SYSTEMS) {
      const k = kit();
      const w = buildSystem(sys, { ...k, small: sys.id.length % 2 === 0 });
      const ship = { x: 120, y: 20, z: 120 };
      for (let i = 0; i < 600; i++) w.update(T0 + i * 0.5, 1 / 60, camera, ship);
      for (const o of w.solids) for (const v of o.at) expect(Number.isFinite(v), `${sys.id} ${o.id}`).toBe(true);
      for (const e of w.events) expect(e.type, sys.id).toBe('event');
      w.dispose();
    }
  });

  it('flies in it: a system is a space ship.js can fly through', () => {
    for (const sys of SYSTEMS) {
      const w = buildSystem(sys, { ...kit(), small: false });
      const space = makeSpace(w.solids);
      expect(Object.keys(space.goals).length).toBe(goalsOf(sys).length + placesOf(sys).length + spaceGoals(sys.id).length);
      // (and super speed opens out there, past the places' band)
      expect(Math.max(...[0, 1, 2, 3, 4, 5].map((i) => space.overdriveAt(Math.cos(i) * 2300, 0, Math.sin(i) * 2300)))).toBeGreaterThan(1.5);
      w.dispose();
    }
  });

  it('has its moments: the trench, the tractor beam, the shields', () => {
    const yavin = buildSystem(systemById('yavin'), { ...kit(), small: false });
    expect(yavin.solids.find((o) => o.id === 'deathstar').band).toBeTruthy();
    const alderaan = buildSystem(systemById('alderaan'), { ...kit(), small: false });
    expect(alderaan.tractor.reach).toBeGreaterThan(alderaan.tractor.r);
    const scarif = buildSystem(systemById('scarif'), { ...kit(), small: false });
    expect(scarif.shield.r).toBeGreaterThan(systemById('scarif').body.r);
    expect(scarif.gate.hole).toBeGreaterThan(5);
    const endor = buildSystem(systemById('endor'), { ...kit(), small: false });
    const shell = endor.solids.find((o) => o.id === 'ds2-shield');
    const seen = new Set();
    for (let i = 0; i < 720; i++) {
      endor.update(T0 + i, 1, camera, null);
      seen.add(shell.r > 0);
    }
    expect([...seen].sort()).toEqual([false, true]); // up, and down for a while
    for (const w of [yavin, alderaan, scarif, endor]) w.dispose();
  });

  it('stands its own fleets and battle aside while the war’s battle is on there, and brings them back', () => {
    for (const id of ['hoth', 'endor']) {
      const k = kit();
      const w = buildSystem(systemById(id), { ...k, small: false });
      const hulls = w.solids.filter((o) => /^(fleet|battle)-/.test(o.id));
      expect(hulls.length, id).toBeGreaterThan(0);
      const before = hulls.map((o) => o.r);
      w.quiet(true);
      expect(hulls.every((o) => o.r === 0 && o.reach === 0)).toBe(true);
      // (and quiet: no turbolasers, no ion cannon)
      k.bolts.fire.mockClear();
      for (let i = 0; i < 40; i++) w.update(T0 + i, 1, camera, null);
      expect(k.bolts.fire).not.toHaveBeenCalled();
      w.quiet(false);
      expect(hulls.map((o) => o.r)).toEqual(before);
      w.dispose();
    }
  });

  it('draws the game’s space level where the system has one, and stands it aside with the fleets (a Starfighter Assault draws its own)', () => {
    const w = buildSystem(systemById('endor'), { ...kit(), small: false });
    const level = w.group.getObjectByName('space-level-endor');
    expect(level).toBeTruthy();
    expect(w.goals.some((g) => g.id === 'space-level')).toBe(true);
    w.quiet(true);
    expect(level.visible).toBe(false);
    w.quiet(false);
    expect(level.visible).toBe(true);
    w.dispose();
    const hoth = buildSystem(systemById('hoth'), { ...kit(), small: false });
    expect(hoth.goals.some((g) => g.id === 'space-level')).toBe(false);
    hoth.dispose();
  });

  it('parks only its holder’s fleet: a Rebel-held Mustafar shows no Imperial fleet, but a garrison of the Rebellion’s', () => {
    const k = kit();
    const sys = systemById('mustafar');
    const w = buildSystem(sys, { ...k, small: false });
    const fleet = w.solids.filter((o) => /^fleet-/.test(o.id));
    const before = fleet.map((o) => o.r);
    expect(fleet.length).toBeGreaterThan(0);
    w.setEffects({ fleet: 'rebel', heat: 0 });
    expect(fleet.every((o) => o.r === 0)).toBe(true);
    const garrison = w.solids.filter((o) => /^garrison-/.test(o.id));
    expect(garrison.length).toBeGreaterThan(0);
    expect(w.garrison.map((g) => g.kind).sort()).toEqual(['corvette', 'nebulon']);
    // the Empire's again: its own fleet back, the garrison gone
    w.setEffects({ fleet: 'empire', heat: 0 });
    expect(fleet.map((o) => o.r)).toEqual(before);
    expect(w.solids.some((o) => /^garrison-/.test(o.id))).toBe(false);
    expect(w.garrison).toEqual([]);
    w.dispose();
  });
  it('shows its standing battle only while it’s fought over, and the war’s quiet still wins', () => {
    const k = kit();
    const w = buildSystem(systemById('endor'), { ...k, small: false });
    const battle = w.solids.filter((o) => /^battle-/.test(o.id));
    const before = battle.map((o) => o.r);
    w.setEffects({ fleet: 'empire', heat: 0 });
    expect(battle.every((o) => o.r === 0)).toBe(true);
    k.bolts.fire.mockClear();
    for (let i = 0; i < 20; i++) w.update(T0 + i, 1, camera, null);
    expect(k.bolts.fire).not.toHaveBeenCalled();
    w.setEffects({ fleet: 'empire', heat: 1 });
    expect(battle.map((o) => o.r)).toEqual(before);
    w.quiet(true);
    expect(battle.every((o) => o.r === 0)).toBe(true);
    w.quiet(false);
    expect(battle.map((o) => o.r)).toEqual(before);
    w.setEffects(null);
    expect(battle.map((o) => o.r)).toEqual(before);
    w.dispose();
  });
  it('takes you aboard the second Death Star, at its dock, when you fly into it past its shield', () => {
    const endor = buildSystem(systemById('endor'), { ...kit(), small: false });
    const ds = endor.solids.find((o) => o.id === 'deathstar2');
    const shell = endor.solids.find((o) => o.id === 'ds2-shield');
    expect(ds.board).toBe('/deathstar/inside?station=ds2&side=rebel&at=dock');
    // (the shield’s shell stands round it, so only with the shield down is the station itself reached)
    expect(shell.r).toBeGreaterThan(ds.r);
    endor.dispose();
  });
  it('lets the war hold the second Death Star’s shield, blow a station, and drop Scarif’s shield, and puts it all back', () => {
    const endor = buildSystem(systemById('endor'), { ...kit(), small: false });
    const shell = endor.solids.find((o) => o.id === 'ds2-shield');
    const ds = endor.solids.find((o) => o.id === 'deathstar2');
    endor.quiet(true);
    endor.war.holdShield(false);
    for (let i = 0; i < 400; i += 20) {
      endor.update(T0 + i, 1, camera, null);
      expect(shell.r).toBe(0);
    }
    endor.war.station('deathstar2', false);
    expect(ds.r).toBe(0);
    endor.quiet(false);
    expect(ds.r).toBeGreaterThan(0);
    const scarif = buildSystem(systemById('scarif'), { ...kit(), small: false });
    scarif.quiet(true);
    scarif.war.planetShield(false);
    scarif.war.station('gate', false);
    expect(scarif.shield).toBeNull();
    expect(scarif.solids.filter((o) => o.id.startsWith('gate-')).every((o) => o.r === 0)).toBe(true);
    scarif.quiet(false);
    expect(scarif.shield.r).toBeGreaterThan(systemById('scarif').body.r);
    endor.dispose();
    scarif.dispose();
  });

  it('holds Scarif’s superlaser while the war’s battle is on, brings the Death Star in when the war says, and gives it back its cycle', () => {
    const k = kit();
    const slots = [];
    const slot = k.models.slot;
    k.models.slot = (kind, size) => {
      const s = slot(kind, size);
      slots.push(s);
      return s;
    };
    const scarif = buildSystem(systemById('scarif'), { ...k, small: false });
    const ds = slots.find((s) => s.kind === 'deathstar');
    const fired = () => scarif.events.splice(0).filter((e) => e.id === 'superlaser').length;
    scarif.quiet(true);
    for (let i = 0; i < 160; i += 2) {
      scarif.update(T0 + i, 2, camera, null);
      expect(ds.holder.visible).toBe(false);
    }
    expect(fired()).toBe(0);
    // the gate fallen: in at the second the war says, firing about 18 s on, gone a minute later
    const T = T0 + 1000;
    scarif.war.superlaser(T);
    scarif.update(T - 5, 1, camera, null);
    expect(ds.holder.visible).toBe(false);
    scarif.update(T + 5, 1, camera, null);
    expect(ds.holder.visible).toBe(true);
    for (let i = 6; i <= 24; i += 0.5) scarif.update(T + i, 0.5, camera, null);
    expect(fired()).toBe(1);
    // its dish turned onto the planet
    const dish = dishAt('deathstar', ds.holder, 32).sub(ds.holder.position).normalize();
    const toPlanet = new THREE.Vector3(0, 0, 0).sub(ds.holder.position).normalize();
    expect(dish.dot(toPlanet)).toBeGreaterThan(0.9);
    scarif.update(T + 80, 1, camera, null);
    expect(ds.holder.visible).toBe(false);
    // and once the war's gone, its own cycle
    scarif.quiet(false);
    const shownAt = Math.ceil(T0 / 150) * 150 + 30; // (a third of the way into a cycle of 150 s)
    scarif.update(shownAt, 1, camera, null);
    expect(ds.holder.visible).toBe(true);
    scarif.dispose();
  });

  it('holds the second Death Star turned with its dish on the battle, and eases it back to its spin', () => {
    const k = kit();
    const slots = [];
    const slot = k.models.slot;
    k.models.slot = (kind, size) => {
      const s = slot(kind, size);
      slots.push(s);
      return s;
    };
    const endor = buildSystem(systemById('endor'), { ...k, small: false });
    const ds = slots.find((s) => s.kind === 'deathstar2');
    const P = new THREE.Vector3(-60, 30, 40);
    endor.quiet(true);
    endor.war.face('deathstar2', P);
    for (let i = 0; i < 30; i += 0.5) endor.update(T0 + i, 0.5, camera, null);
    const dish = endor.war.dish('deathstar2');
    const r = systemById('endor').pieces.find((p) => p.kind === 'deathstar2').size * 0.47;
    expect(dish.distanceTo(ds.holder.position)).toBeCloseTo(r * 0.95, 4);
    expect(dish.clone().sub(ds.holder.position).normalize().dot(P.clone().sub(ds.holder.position).normalize())).toBeGreaterThan(0.99);
    // let go: back on its spin, as it would have been with no war
    endor.war.face('deathstar2', null);
    for (let i = 30; i < 60; i += 0.5) endor.update(T0 + i, 0.5, camera, null);
    const held = ds.holder.quaternion.clone();
    const k2 = kit();
    let freeDs = null;
    k2.models.slot = (kind, size) => {
      const s = slot(kind, size);
      if (kind === 'deathstar2') freeDs = s;
      return s;
    };
    const free = buildSystem(systemById('endor'), { ...k2, small: false });
    free.update(T0 + 59.5, 0.5, camera, null);
    expect(Math.abs(held.dot(freeDs.holder.quaternion))).toBeCloseTo(1, 4);
    endor.dispose();
    free.dispose();
  });

  it('puts a TIE on the Razor Crest’s tail over Nevarro, firing the Empire’s green', () => {
    const k = kit();
    const placed = [];
    const slot = k.models.slot;
    k.models.slot = (kind, size) => (placed.push(kind), slot(kind, size));
    const w = buildSystem(systemById('nevarro'), { ...k, small: false });
    expect(placed).toEqual(expect.arrayContaining(['razorcrest', 'tie']));
    for (let i = 0; i < 240; i++) w.update(T0 + i / 30, 1 / 30, camera, null);
    expect(k.bolts.fire.mock.calls.length).toBeGreaterThan(5);
    for (const [, , o] of k.bolts.fire.mock.calls) expect(o.color).toEqual(LASER.remnant);
    w.dispose();
  });

  it('asks for no ship or station that kindsIn did not list, for the models the jump gets ready ahead', () => {
    for (const sys of SYSTEMS) {
      const k = kit();
      const asked = new Set();
      const slot = k.models.slot;
      k.models.slot = (kind, size) => (asked.add(kind), slot(kind, size));
      const w = buildSystem(sys, { ...k, small: false });
      expect([...asked].filter((kind) => !kindsIn(sys).includes(kind)), sys.id).toEqual([]);
      w.dispose();
    }
  });

  it('fires the battles’ guns', () => {
    const k = kit();
    const w = buildSystem(systemById('endor'), { ...k, small: false });
    for (let i = 0; i < 120; i++) w.update(T0 + i / 30, 1 / 30, camera, null);
    expect(k.bolts.fire.mock.calls.length).toBeGreaterThan(20);
    w.dispose();
  });
});
