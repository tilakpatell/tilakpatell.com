import { describe, expect, it, vi } from 'vitest';

// (the grounds are baked and drawn in the browser; here a stand-in with the
// same face answers for them: a flat lawn, the castle’s one wall, one door)
const DOOR_AT = [10, 0];
let doorAct = null;
let reflected = 0;
vi.mock('./world/grounds', () => ({
  createGrounds: async (rt, { scene }) => {
    const { Group } = await import('three');
    const lawn = new Group();
    scene.add(lawn);
    let hour = 19.9;
    let week = 1;
    return {
      passes: [],
      castle: { colliders: [{ id: 'wall', kind: 'box', at: [0, -20], w: 40, d: 2, turn: 0 }] },
      doors: { colliders: () => [] },
      get hour() {
        return hour;
      },
      get clock() {
        return { t: hour, rate: 1 };
      },
      groundAt: () => 2,
      setHour: (h) => (hour = h),
      pass: () => {},
      setCold: () => {},
      setWeek: (w) => (week = w),
      beforeDraw: () => (reflected += 1),
      step(dt, { at, act }) {
        const by = at && Math.hypot(at[0] - DOOR_AT[0], at[2] - DOOR_AT[1]) < 3;
        if (by && act) doorAct?.();
        return { prompt: by ? { key: 'E', verb: 'Go in', name: 'The Great Hall' } : null, enter: null, toast: by && act ? 'Locked. Not today.' : null };
      },
      stats: () => ({ week }),
      dispose: vi.fn(),
    };
  },
}));
import { validateModule } from '../../runtime/module';
import { WORLD_MB } from '../worlds/worlds';
import hogwarts, { KEYS, SPAWN, solidsOf, startOf } from './module';
import { registerRoom, ROOMS } from './rooms/index';
import { placeById } from './rules/places';

// (`saved`: what tp-hogwarts holds; a visitor who has seen the arrival starts on the grounds)
const ARRIVED = { v: 1, data: { house: 'gryffindor', arrived: 1 } };
const fakeRt = (saved = ARRIVED) => {
  const emitted = [];
  const store = new Map(saved ? [['tp-hogwarts', saved.data]] : []);
  return {
    emitted,
    store,
    saves: { register: vi.fn(), get: (k, fallback = null) => (store.has(k) ? store.get(k) : fallback), set: (k, v) => store.set(k, v) },
    events: { emit: (type, data) => emitted.push({ type, ...data }) },
    input: { bind: vi.fn(), unbind: vi.fn() },
    quality: { tier: 'high' },
    gfx: { renderer: { render: vi.fn(), toneMappingExposure: 1, info: { render: {} } }, compile: () => Promise.resolve() },
  };
};
// an input snapshot holding `held` (action names) and pressing `pressed` (codes) this frame
const snap = (held = [], pressed = []) => ({ pressed: new Set(pressed), keys: new Set(), action: (n) => held.includes(n), pointer: { drag: null }, stick: { x: 0, y: 0 } });

describe('Hogwarts, the world module', () => {
  it('keeps the module contract, on the node renderer, its download what WORLD_MB says', () => {
    expect(() => validateModule(hogwarts)).not.toThrow();
    expect(hogwarts).toMatchObject({ id: 'hogwarts', shading: 'nodes' });
    expect(hogwarts.mb).toBe(WORLD_MB['/hogwarts']);
    expect(hogwarts.label).toMatch(/Hogwarts/);
  });

  it('makes a world with everything the runtime asks of one, and binds the walk’s keys', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    for (const k of ['draw', 'resize', 'dispose', 'step', 'anchor', 'go', 'stick', 'enter', 'leave']) expect(typeof world[k]).toBe('function');
    expect(rt.input.bind.mock.calls[0][0]).toMatchObject({ forward: KEYS.forward, act: KEYS.act });
    world.resize(800, 600);
    world.step(1 / 60, snap());
    const before = reflected;
    world.draw({ renderer: rt.gfx.renderer });
    expect(rt.gfx.renderer.render).toHaveBeenCalled();
    expect(reflected).toBe(before + 1);
    expect(world.anchor()).toHaveLength(3);
    world.dispose();
    expect(rt.input.unbind).toHaveBeenCalled();
    expect(world.grounds.dispose).toHaveBeenCalled();
  });

  it('starts you on the lawn, or where the address says, at the hour it says', () => {
    expect(startOf(null)).toMatchObject({ at: SPAWN.at, yaw: SPAWN.yaw });
    expect(startOf('noon').hour).toBe(12.5);
    expect(startOf('owlery').at).toEqual(placeById('owlery').at);
    expect(startOf('nowhere-at-all').at).toEqual(SPAWN.at);
  });

  it('stands you on the grounds’ floor and stops you at the castle’s wall', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    world.walker.place([0, -16], 0);
    // (walking north, into the wall at z = −20, two metres thick)
    for (let i = 0; i < 240; i++) world.step(1 / 60, snap(['forward']));
    expect(world.walker.state.z).toBeGreaterThan(-19.2);
    expect(world.anchor()[1]).toBeCloseTo(2 + 1.45, 1);
    world.dispose();
  });

  it('offers a door’s prompt in reach, takes it on E, and passes on what the door says', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    world.attached();
    world.walker.place(DOOR_AT, 0);
    world.step(1 / 60, snap());
    expect(rt.emitted.filter((e) => e.type === 'near').at(-1)).toMatchObject({ door: { label: 'The Great Hall', verb: 'Go in', key: 'E' } });
    world.step(1 / 60, snap([], ['KeyE']));
    expect(rt.emitted.at(-1)).toMatchObject({ type: 'toast', text: 'Locked. Not today.' });
    // (the prompt’s own button does what E does)
    let taken = 0;
    doorAct = () => (taken += 1);
    world.go();
    world.step(1 / 60, snap());
    expect(taken).toBe(1);
    doorAct = null;
    world.walker.place([60, 60], 0);
    world.step(1 / 60, snap());
    expect(rt.emitted.filter((e) => e.type === 'near').at(-1)).toMatchObject({ door: null });
    world.dispose();
  });

  it('goes into a registered room, the grounds hidden, and out again the way it came', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    world.attached();
    const { Group } = await import('three');
    const disposed = vi.fn();
    registerRoom('test-hall', { name: 'A hall for the test', load: async () => ({ default: { build: () => ({ name: 'A hall for the test', group: new Group(), spawn: { at: [0, 0, 5], yaw: 0 }, floorAt: () => 0, colliders: [], floors: [], doors: [], dispose: disposed }) } }) });
    world.walker.place([30, 30], 1);
    // (what was showing outside: the wand's and the broom's own hidden things stay hidden)
    const showing = world.scene.children.filter((o) => o.visible);
    expect(await world.enter('test-hall', 'great-doors')).toBe(true);
    expect(world.room).toBe('test-hall');
    expect(rt.emitted.filter((e) => e.type === 'room').at(-1)).toMatchObject({ id: 'test-hall', name: 'A hall for the test' });
    // (the grounds and the things on the lawn gone; what you carry, the lights and the room left)
    const inside = world.scene.children.filter((o) => o.visible && !o.isLight);
    expect(inside.some((o) => o.name.startsWith('hogwarts-'))).toBe(false);
    expect(showing.filter((o) => inside.includes(o)).length).toBeLessThan(showing.length / 2);
    expect(inside.some((o) => o.position.y < -1000)).toBe(true);
    expect(world.rooms.walker.state.z).toBe(5);
    world.leave();
    expect(world.room).toBeNull();
    expect(disposed).toHaveBeenCalled();
    expect(world.walker.state.x).toBe(30);
    expect(showing.every((o) => o.visible)).toBe(true);
    expect(world.scene.children.filter((o) => o.visible)).toHaveLength(showing.length);
    expect(await world.enter('no-such-room')).toBe(false);
    expect(rt.emitted.at(-1)).toMatchObject({ type: 'toast' });
    delete ROOMS['test-hall'];
    world.dispose();
  });

  it('plays the arrival on a first visit, from the station, and opens at its beat for ?at=', async () => {
    const rt = fakeRt(null);
    const world = await hogwarts.create(rt, {});
    world.attached();
    expect(rt.emitted.find((e) => e.type === 'arrival')).toMatchObject({ on: true, part: 'station' });
    world.dispose();
    const back = fakeRt();
    const hall = await hogwarts.create(back, { at: 'hall' });
    hall.attached();
    hall.step(1 / 60, snap());
    expect(back.emitted.find((e) => e.type === 'arrival')).toMatchObject({ on: true, beat: 'hall' });
    hall.dispose();
  });

  it('walks round a wall as a row of stones', () => {
    const stones = solidsOf([{ kind: 'box', at: [0, 0], w: 10, d: 2, turn: 0 }, { kind: 'circle', at: [5, 5], r: 3 }]);
    expect(stones.at(-1)).toEqual({ at: [5, 5], r: 3 });
    expect(stones.length).toBeGreaterThan(30);
    expect(stones.every((s) => s.r <= 3)).toBe(true);
  });

  it('holds what it says till the page listens', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    world.step(1 / 60, snap([], ['Escape']));
    expect(rt.emitted.filter((e) => e.type === 'menu')).toHaveLength(0);
    world.attached();
    expect(rt.emitted.map((e) => e.type)).toContain('menu');
    world.dispose();
  });
});
