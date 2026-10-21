import { describe, expect, it, vi } from 'vitest';
import { validateModule } from '../../runtime/module';
import { WORLD_MB } from '../worlds/worlds';
import middleEarth, { askAgain, engine, engineNow, makeWorld, refuse } from './module';

// a stand-in for runtime/views.js: what the world asks of it, recorded
const fakeViews = () => {
  const calls = [];
  return {
    calls,
    frame: () => calls.push('frame'),
    flush: () => calls.push('flush'),
    enter: (el) => calls.push(['enter', el]),
    resize: () => calls.push('resize'),
    dispose: vi.fn(),
  };
};
const fakeRt = (gfx = { renderer: {}, lost: false }) => ({ gfx, invalidate: vi.fn() });
const make = (rt = fakeRt()) => {
  const views = fakeViews();
  const world = makeWorld(rt, { createViews: () => views, doc: null });
  return { world, views, rt };
};

describe('the Middle-earth module', () => {
  it('is a nodes module the runtime takes, with its size from the worlds’ table', () => {
    const mod = validateModule(middleEarth);
    expect(mod).toMatchObject({ id: 'middleearth', shading: 'nodes', mb: WORLD_MB['/middle-earth'], sharpness: 'own', calibrate: false });
    expect(mod.ratio).toBe(1.75);
  });

  it('makes a world with what the runtime draws with', () => {
    const { world } = make();
    for (const k of ['resize', 'step', 'draw', 'dispose', 'wants', 'lowerQuality']) expect(typeof world[k], k).toBe('function');
  });

  it('runs a started tick each frame with the ms since its own last, 16 for its first, at most 50', () => {
    const { world } = make();
    const seen = [];
    const t = world.tick((ms) => seen.push(ms));
    world.step(0.016, {}, 1000);
    expect(seen).toEqual([]);
    t.start();
    world.step(0.016, {}, 1016);
    world.step(0.016, {}, 1033);
    world.step(0.05, {}, 1300);
    expect(seen).toEqual([16, 17, 50]);
    // (stopped and started again: a first frame again)
    t.stop();
    world.step(0.016, {}, 1316);
    t.start();
    world.step(0.016, {}, 1332);
    expect(seen).toEqual([16, 17, 50, 16]);
  });

  it('wants frames while a tick is on, and a tick that says false stops', () => {
    const { world, rt } = make();
    let more = true;
    const t = world.tick(() => more);
    expect(world.wants()).toBe(false);
    t.start();
    expect(rt.invalidate).toHaveBeenCalled();
    expect(world.wants()).toBe(true);
    more = false;
    world.step(0.016, {}, 16);
    expect(t.on).toBe(false);
    expect(world.wants()).toBe(false);
  });

  it('runs the ticks in the order they were started, a restarted one at the back, each with its view’s state on, then flushes', () => {
    const { world, views } = make();
    const order = [];
    const a = { id: 'a' };
    const b = { id: 'b' };
    const ta = world.tick(() => order.push('a'), { el: a });
    ta.start();
    world.tick(() => order.push('b'), { el: b }).start();
    world.tick(() => order.push('none')).start();
    world.step(0.016, {}, 16);
    world.draw({ dt: 0.016, now: 16 });
    expect(order).toEqual(['a', 'b', 'none']);
    expect(views.calls[0]).toBe('frame');
    expect(views.calls).toContainEqual(['enter', b]);
    expect(views.calls.at(-1)).toBe('flush');
    // (stopped and asked for again: behind the others, as a new frame request was)
    ta.stop();
    ta.start();
    order.length = 0;
    world.step(0.016, {}, 32);
    expect(order).toEqual(['b', 'none', 'a']);
  });

  it('runs a tick handed over from a frame loop of its own no sooner than its next frame, its ms as that loop’s', () => {
    const { world } = make();
    const seen = [];
    const t = world.tick((ms) => seen.push(ms));
    t.start(1000);
    world.step(0.016, {}, 1000);
    world.step(0.016, {}, 1016);
    expect(seen).toEqual([16]);
  });

  it('keeps a picture’s failure its own: its tick stops, the others draw on', () => {
    const { world } = make();
    const ok = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = world.tick(() => {
      throw new Error('boom');
    });
    bad.start();
    world.tick(ok).start();
    world.step(0.016, {}, 16);
    expect(bad.on).toBe(false);
    expect(ok).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('lowers every stage by the governor’s level, and a stage made later starts at it', () => {
    const { world } = make();
    const one = { setLevel: vi.fn() };
    world.stage(one);
    world.lowerQuality(2);
    expect(one.setLevel).toHaveBeenLastCalledWith(2);
    const two = { setLevel: vi.fn() };
    world.stage(two);
    expect(two.setLevel).toHaveBeenCalledWith(2);
  });

  it('tells its stages the context is gone when it goes with it', () => {
    const rt = fakeRt({ renderer: {}, lost: true });
    const { world, views } = make(rt);
    const s = { lose: vi.fn(), dispose: vi.fn() };
    world.stage(s);
    world.dispose();
    expect(s.lose).toHaveBeenCalled();
    expect(s.dispose).toHaveBeenCalled();
    expect(views.dispose).toHaveBeenCalled();
  });

  it('publishes its world as it’s made to the pictures waiting for it, and says so when there is none', async () => {
    engineNow()?.dispose(); // (the tests above' last world, published at its frame)
    askAgain();
    const waiting = engine();
    const views = fakeViews();
    vi.doMock('../../runtime/views', () => ({ createViews: () => views }));
    const world = await middleEarth.create(fakeRt());
    await expect(waiting).resolves.toBe(world);
    expect(engineNow()).toBe(world);
    world.dispose();
    expect(engineNow()).toBe(null);
    refuse(new Error('no 3D'));
    await expect(engine()).rejects.toThrow('no 3D');
    askAgain();
    vi.doUnmock('../../runtime/views');
  });
});
