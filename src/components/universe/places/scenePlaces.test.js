import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PLACE } from '../words';
import { OPEN_SPACE, PARK_GAP, SOLIDS, headingTo, spawn, step } from '../ship';
import { aimTargets } from '../aim';
import { destinationById } from '../nav';
import { UNIVERSE, fullSector, moonAt, sectorJob, thingRow, universeOf } from '../../expanse/shared/gen';
import { universeBudget } from '../budget';
import { resolvePlace } from './resolve';
import { followPark, parkPlace } from './park';
import { hereZone } from './around';
import { createScenePlaces } from './scenePlaces';

const s = fullSector(UNIVERSE, 1, 0, 0);
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const xyz = (k) => [k.x, k.y, k.z];

// the scene's camera, in the scene's frame: at the ship's point, looking 10 ahead along its heading
function fakeCamera(ship, group = null) {
  const c = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 45000);
  const h = ship.heading ?? 0;
  const at = new THREE.Vector3(ship.x, ship.y, ship.z);
  const ahead = new THREE.Vector3(ship.x - Math.sin(h) * 10, ship.y, ship.z - Math.cos(h) * 10);
  if (group) {
    group.updateWorldMatrix(true, false);
    group.localToWorld(at);
    group.localToWorld(ahead);
  }
  c.position.copy(at);
  c.lookAt(ahead);
  c.updateMatrixWorld();
  return c;
}
// lane 2's own job, in process: its answer comes without moons, on a later microtask, as from the worker
const fakePool = () => ({
  request: vi.fn(async (name, m) => sectorJob(m).answer),
  cancel: vi.fn(),
});
function make({ sectors, universe, workers, startAt, turn = 0, device = { tier: 'mid' } } = {}) {
  const shown = [];
  // (keyed as lane 2's chunk grid names a cell, not by the sector's id)
  const own = sectors ?? new Map([['1,0,0', universe ? fullSector(universe, 1, 0, 0) : s]]);
  const group = new THREE.Group();
  group.rotation.y = turn;
  let camera = null;
  const v = new THREE.Vector3();
  const toScreen = (x, y, z, out) => {
    if (!camera) return Object.assign(out, { x: 0, y: 0, z: -1 }); // (an update made outside tick: nothing on screen)
    group.localToWorld(v.set(x, y, z));
    out.z = -v.clone().applyMatrix4(camera.matrixWorldInverse).z;
    v.project(camera);
    out.x = ((v.x + 1) / 2) * 1280;
    out.y = ((1 - v.y) / 2) * 720;
    return out;
  };
  const events = [];
  const notes = [];
  let now = 0;
  const p = createScenePlaces({
    group,
    universe,
    expanse: { sectors: () => own },
    workers,
    startAt,
    toScreen,
    prepare() {},
    emit: (e) => events.push(e),
    note: (t) => notes.push(t),
    device,
    clock: () => ++now,
    tags: () => ({}),
    makeTags: () => ({ show: (list) => shown.push(list), dispose() {} }),
    frame: () => ({ w: 1280, h: 720 }),
  });
  const tick = (ship, more = {}) => {
    camera = fakeCamera(ship, group);
    p.update({
      ship,
      camera,
      t: 0,
      flying: true,
      nose: [0, 0, -1],
      going: null,
      arrived: null,
      held: false,
      ...more,
    });
  };
  return { p, events, notes, group, tick, shown };
}

describe('the scene’s generated places', () => {
  const st = s.stations[0];
  const dest = resolvePlace(st.id, { t: 0 });
  const park = parkPlace(dest, [st.at[0] + 2000, st.at[2]], 0);
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('arrives and docks at a station parked still beside it, and says so', () => {
    const { p, events, notes, tick } = make();
    tick({ ...park, speed: 0 });
    expect(events).toEqual([
      { type: 'place', what: 'arrive', id: st.id, name: st.name },
      { type: 'place', what: 'dock', id: st.id, name: st.name, open: false },
    ]);
    expect(notes).toEqual([PLACE.docked(st.name)]);
    expect([p.here()?.id, p.docked()]).toEqual([st.id, st.id]);
  });
  it('opens the hangar only for the trip that ended there, once', () => {
    const { events, tick } = make();
    const arrived = { id: st.id };
    tick({ ...park, speed: 0 }, { arrived });
    expect(events.find((e) => e.what === 'dock').open).toBe(true);
    tick({ ...park, x: park.x + 200, speed: 0 }, { arrived });
    tick({ ...park, speed: 0 }, { arrived });
    expect(events.filter((e) => e.what === 'dock').map((e) => e.open)).toEqual([true, false]);
  });
  it('undocks and leaves as it flies off, back at the system, and arrives nowhere it is only passing', () => {
    const { p, events, tick } = make();
    tick({ ...park, speed: 0 });
    const off = { ...park, x: park.x + 100, speed: 20 };
    tick(off);
    const sysRow = p.around().find((r) => r.id === st.system);
    const back = Math.hypot(off.x - sysRow.at[0], off.y - sysRow.at[1], off.z - sysRow.at[2]) < hereZone(sysRow).in;
    expect(events.slice(2).map((e) => [e.what, e.id])).toEqual([['undock', st.id], ['leave', st.id], ...(back ? [['arrive', st.system]] : [])]);
    const q = make();
    q.tick({ ...park, speed: 0 }, { going: 'E:1,0:5' });
    expect(q.events.some((e) => e.what === 'arrive')).toBe(false);
  });
  it('makes a drawn station solid, so flying into it is a crash with its id', () => {
    const { p, tick } = make();
    tick({ ...park, speed: 0 });
    expect(p.solids()).toContainEqual({
      id: st.id,
      at: st.at,
      r: st.size,
      reach: st.size * 1.5,
    });
    let ship = {
      ...spawn(null),
      x: st.at[0] + 60,
      y: st.at[1],
      z: st.at[2],
      heading: headingTo(-1, 0),
      speed: 40,
    };
    const hit = [];
    for (let i = 0; i < 300 && !hit.some((e) => e.type === 'crash'); i++) {
      // (boosting: on throttle alone, out in the open, it brakes to cruise long before it gets there)
      const r = step(ship, { throttle: 1, boost: true }, 1 / 30, [...SOLIDS, ...p.solids()], OPEN_SPACE);
      hit.push(...r.events);
      ship = r.ship;
    }
    expect(hit.find((e) => e.type === 'crash')?.id).toBe(st.id);
  });
  it('keeps a ship parked at a planet where it parked as a moon goes by, for ten minutes', () => {
    // (the first planet of E:1,0 whose moon comes within its own zone of the park in that time:
    // a carry by the nearest body dragged a quarter of such parks off within five minutes)
    let found = null;
    for (const q of s.systems.flatMap((x) => x.planets).filter((x) => x.moonList.length)) {
      const d = resolvePlace(q.id, { t: 0 });
      const k = parkPlace(d, [d.at[0] + 5000, d.at[2]], 0);
      const passes = (m) => {
        for (let t = 0; t < 600; t++) if (len(xyz(followPark(d, k, t)), moonAt(m, q, t)) < 1.9 * m.radius + PARK_GAP.near + PARK_GAP.in) return true;
        return false;
      };
      if (q.moonList.some(passes)) {
        found = { q, d, k };
        break;
      }
    }
    expect(found).toBeTruthy();
    const { p } = make();
    const arrived = { id: found.q.id }; // (one trip's end, the same object every update, as the scene keeps it)
    let ship = { ...spawn(null), ...found.k, speed: 0 };
    p.update({
      ship,
      camera: fakeCamera(ship),
      t: 0,
      flying: true,
      nose: [0, 0, -1],
      going: null,
      arrived,
      held: false,
    });
    for (let t = 0; t < 600; t += 1) {
      ship = { ...p.carry(ship, t, t + 1), speed: 0 };
      p.update({
        ship,
        camera: fakeCamera(ship),
        t: t + 1,
        flying: true,
        nose: [0, 0, -1],
        going: null,
        arrived,
        held: false,
      });
      expect(p.here()?.id, `t ${t}`).toBe(found.q.id);
    }
    expect(len(xyz(ship), xyz(followPark(found.d, found.k, 600)))).toBeLessThan(1);
  });
  it('resolves from its loaded sectors, and never makes a sector itself', async () => {
    const doctored = {
      ...s,
      systems: s.systems.map((x, i) => (i === 0 ? { ...x, name: 'Testing' } : x)),
    };
    const { p } = make({ sectors: new Map([['E:1,0', doctored]]) });
    expect(p.resolve('e:1,0:0').name).toBe('Testing');
    expect(p.resolve('E:9,0:0')).toBeNull();
    expect(p.missing('E:9,0:0')).toBe(true);
    expect(p.missing('E:1,0:0')).toBe(false);
    expect(p.missing('E:1,0:0:99')).toBe(false); // (its sector is at hand: it's nothing, not on its way)
    expect(p.missing('marvel')).toBe(false);
  });
  it('answers at once, with no request, for a place its sectors hold or say isn’t there', async () => {
    const workers = fakePool();
    const { p, events } = make({ workers });
    expect(p.find('E:1,0:0:99')).toBeNull();
    expect(await p.fetch('E:1,0:0:99')).toBeNull();
    expect((await p.fetch('e:1,0:0'))?.id).toBe('E:1,0:0');
    await flush();
    expect(workers.request).not.toHaveBeenCalled();
    expect(events.filter((e) => e.what === 'found')).toEqual([]);
  });
  it('measures from the camera in the map’s own frame, turned as the map is after an arrival', () => {
    // (map.rotation.y = state.yaw, −heading after any arrival, spawn or pose: scene.js:1843, :2219;
    // the camera is in the scene's frame, the places in the map's)
    const turned = make({ turn: 1.2 });
    const flat = make();
    turned.tick({ ...park, speed: 0 }, { arrived: { id: st.id } });
    flat.tick({ ...park, speed: 0 }, { arrived: { id: st.id } });
    expect(turned.events.find((e) => e.what === 'dock')).toMatchObject({
      id: st.id,
      open: true,
    });
    expect([turned.p.here()?.id, turned.p.docked()]).toEqual([st.id, st.id]);
    expect(turned.events).toEqual(flat.events);
    expect(turned.p.around().map((r) => r.id)).toEqual(flat.p.around().map((r) => r.id));
    expect(turned.p.solids()).toEqual(flat.p.solids());
  });
  it('resolves in a pocket universe: its own loaded sector, and a fetch made in it', async () => {
    const marble = universeOf('marble');
    const workers = fakePool();
    const { p } = make({ universe: marble, workers });
    const mine = fullSector(marble, 1, 0, 0, { things: false });
    expect(p.resolve('E:1,0:0').name).toBe(mine.systems[0].name);
    expect(p.resolve('E:1,0:0').name).not.toBe(s.systems[0].name);
    const far = await p.fetch('E:9,0:0');
    expect(workers.request.mock.calls[0][1]).toMatchObject({
      type: 'sector',
      key: 'place|E:9,0',
      universe: marble,
      sx: 9,
      sy: 0,
      sz: 0,
    });
    expect(far.name).toBe(fullSector(marble, 9, 0, 0, { things: false }).systems[0].name);
    expect(far.name).not.toBe(resolvePlace('E:9,0:0', { t: 0 }).name);
    expect(destinationById('E:9,0:0', p.look)?.name).toBe(far.name);
  });
  it('aims at the hand-made places and the generated stars from one array, kept until the stars refresh', () => {
    const { p, tick } = make();
    const ship = { ...park, speed: 0 };
    tick(ship);
    const a = p.aimTargets('main', null);
    expect(p.aimTargets('main', null)).toBe(a);
    expect(a.slice(0, aimTargets('main', null).length)).toEqual(aimTargets('main', null));
    expect(a.some((x) => x.id === st.system)).toBe(true);
    expect(p.aimTargets('rickmorty', null)).toEqual(aimTargets('rickmorty', null));
    tick(ship);
    expect(p.aimTargets('main', null)).not.toBe(a);
  });
  it('fetches a place outside its sectors from the worker pool, once a sector, and says when it’s found', async () => {
    const workers = fakePool();
    const { p, events, tick } = make({ workers, startAt: 'E:9,0:0:0' });
    expect(workers.request).not.toHaveBeenCalled(); // (the start is asked for on the first update, not as the scene is made)
    tick({ ...park, speed: 0 });
    expect(p.find('E:9,0:1')).toBeNull();
    const [a, b] = await Promise.all([p.fetch('E:9,0:0'), p.fetch('E:9,0:2')]);
    expect([a.id, b.id]).toEqual(['E:9,0:0', 'E:9,0:2']);
    expect(workers.request).toHaveBeenCalledTimes(1);
    expect(workers.request.mock.calls[0][0]).toBe('expanse');
    expect(workers.request.mock.calls[0][1]).toMatchObject({
      type: 'sector',
      key: 'place|E:9,0',
      universe: UNIVERSE,
      sx: 9,
      sy: 0,
      sz: 0,
    });
    expect(p.resolve('E:9,0:0:0')?.id).toBe('E:9,0:0:0');
    await flush();
    expect(
      events
        .filter((e) => e.what === 'found')
        .map((e) => [e.id, e.dest?.id ?? null])
        .sort(),
    ).toEqual([
      ['E:9,0:0:0', 'E:9,0:0:0'],
      ['E:9,0:1', 'E:9,0:1'],
    ]);
    expect(await make().p.fetch('E:9,0:0')).toBeNull(); // (no pool: Node)
    expect(await make({ workers }).p.fetch('E:9,0:9999')).toBeNull();
  });
  it('marks the way to a generated goal, from the trip’s own row or its own sectors', () => {
    const { p, tick } = make();
    tick({ ...park, speed: 0 });
    expect(p.mark(st.id)).toEqual({
      at: st.at,
      reach: st.size * 1.5,
      name: st.name,
    });
    const far = resolvePlace('E:9,0:0', { t: 0 });
    expect(p.mark('E:9,0:0', far)).toMatchObject({
      at: far.at,
      name: far.name,
    });
    expect(p.mark('E:9,0:0')).toBeNull();
    expect(p.mark('marvel')).toBeNull();
  });
  describe('picking and names (Task 13)', () => {
    const tan17 = Math.tan((17 * Math.PI) / 180);
    const sys = s.systems[st.i];
    it('picks a star where it shows while flying, and nothing when not', () => {
      const { p, tick } = make();
      const ship = { ...spawn(null), x: sys.at[0], y: sys.at[1], z: sys.at[2] + sys.reach * 0.5, heading: 0, speed: 0 };
      tick(ship);
      const pt = p.screen(sys.id);
      expect(Math.hypot(pt.x - 640, pt.y - 360)).toBeLessThan(1);
      expect(p.pick(642, 361, { tanHalf: tan17, height: 720 })).toBe(sys.id);
      tick(ship, { flying: false });
      expect(p.pick(642, 361, { tanHalf: tan17, height: 720 })).toBeNull();
      expect(p.screen('marvel')).toBeNull();
    });
    it('names the place it’s at first, and none while held or not flying', () => {
      const { tick, shown } = make();
      tick({ ...park, speed: 0 });
      expect(shown.at(-1)[0].id).toBe(st.id);
      tick({ ...park, speed: 0 }, { held: true });
      expect(shown.at(-1)).toEqual([]);
      tick({ ...park, speed: 0 }, { flying: false });
      expect(shown.at(-1)).toEqual([]);
    });
    it('picks a thing far off where it shows, with the map turned', () => {
      const row = thingRow(s, 40);
      const { p, tick } = make({ turn: 1.2 });
      tick({ ...spawn(null), x: row.at[0] + 5000, y: row.at[1], z: row.at[2], heading: headingTo(-1, 0), speed: 0 });
      const pt = p.screen(row.id);
      expect(pt).not.toBeNull();
      expect(p.pick(pt.x, pt.y, { tanHalf: tan17, height: 720 })).toBe(row.id);
    });
    it('names no more than the tier table says, and fewer at a lower quality step', () => {
      // (a nose on the busiest way from a ship out among the things: a field of them in its cone)
      const at = thingRow(s, 40).at;
      const ship = { ...spawn(null), x: at[0] + 5000, y: at[1], z: at[2], speed: 0 };
      const probe = make();
      probe.tick(ship);
      const rows = probe.p.around();
      const way = (r) => {
        const d = [r.at[0] - ship.x, r.at[1] - ship.y, r.at[2] - ship.z];
        const l = Math.hypot(...d);
        return d.map((x) => x / l);
      };
      const inCone = (n) => rows.filter((r) => way(r).reduce((a, x, i) => a + x * n[i], 0) > Math.cos(0.14)).length;
      const nose = rows.map(way).reduce((best, n) => (inCone(n) > inCone(best) ? n : best));
      expect(inCone(nose)).toBeGreaterThan(6);
      const heading = headingTo(nose[0], nose[2]);
      const count = (device, stepBy = null) => {
        const m = make({ device });
        if (stepBy) m.p.setStep(...stepBy);
        m.tick({ ...ship, heading }, { nose });
        return m.shown.at(-1).length;
      };
      expect(count({ tier: 'low' })).toBe(3);
      expect(count({ tier: 'mid' })).toBe(6);
      expect(count({ tier: 'mid' }, [2, false])).toBe(universeBudget({ tier: 'mid' }, 2).tags);
    });
  });
});
