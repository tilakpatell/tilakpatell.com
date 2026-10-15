import { describe, expect, it, vi } from 'vitest';
import { validateModule, validateWorld } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';
import { hqModule } from './module';
import { STEPS } from '../../../lib/three/pace';

// a runtime as far as an HQ module reads it
const fakeRt = ({ renderer = {}, rect = { width: 800, height: 450 } } = {}) => {
  const events = [];
  return {
    gfx: { renderer, lost: false },
    host: { getBoundingClientRect: () => rect },
    events: { emit: (type, data) => events.push({ type, ...data }) },
    emitted: events,
  };
};
const fakeView = () => {
  const engine = {
    renderOnce: vi.fn(),
    lowerQuality: vi.fn(),
    precompile: vi.fn(() => Promise.resolve()),
    prepare: vi.fn(() => Promise.resolve()),
    tuneGroups: vi.fn(() => [{ title: 'Bloom' }]),
    rest: vi.fn(),
  };
  return { engine, resize: vi.fn(), dispose: vi.fn() };
};

describe('an HQ game as a world module', () => {
  it('is a classic module with the route’s download, drawn at its tier, never calibrated', () => {
    const mod = validateModule(hqModule({ id: 'hq-test', route: '/avengers', label: 'A test.', load: async () => () => fakeView() }));
    expect(mod).toMatchObject({ id: 'hq-test', shading: 'glsl', mb: WORLD_MB['/avengers'], label: 'A test.', calibrate: false });
    expect(mod.ratio).toBeGreaterThan(0);
  });

  it('makes the scene on the runtime and runs the page’s frame from its draw', async () => {
    const view = fakeView();
    const make = vi.fn(() => view);
    const frame = { current: null };
    const rt = fakeRt();
    const world = validateWorld(await hqModule({ id: 'hq-test', route: '/avengers', load: async () => make }).create(rt, { frame, options: { calm: true } }));
    expect(make).toHaveBeenCalledWith(rt, expect.objectContaining({ calm: true }));
    expect(world.view).toBe(view);
    expect(world.wants()).toBe(false);
    const tick = vi.fn();
    frame.current = tick;
    expect(world.wants()).toBe(true);
    world.draw({ dt: 0.016, now: 1234 });
    expect(tick).toHaveBeenCalledWith(16, 1234);
    world.resize(640, 360);
    expect(view.resize).toHaveBeenCalledWith(640, 360);
    world.lowerQuality(2);
    expect(view.engine.lowerQuality).toHaveBeenCalledWith(2);
    expect(world.tune()).toEqual([{ title: 'Bloom' }]);
  });

  it('says slow through the runtime’s events when its engine is at the floor', async () => {
    let options = null;
    const rt = fakeRt();
    await hqModule({
      id: 'hq-test',
      route: '/avengers',
      load: async () => (r, o) => {
        options = o;
        return fakeView();
      },
    }).create(rt, {});
    options.onSlow();
    expect(rt.emitted).toEqual([{ type: 'slow', module: 'hq-test' }]);
    expect(STEPS.length).toBeGreaterThan(0);
  });

  it('warms a game’s shaders, or prepares a world in full, at its box’s size first', async () => {
    const warm = fakeView();
    const w1 = await hqModule({ id: 'a', route: '/avengers', load: async () => () => warm }).create(fakeRt(), {});
    await w1.prepare(() => {}, { alive: () => true });
    expect(warm.resize).toHaveBeenCalledWith(800, 450);
    expect(warm.engine.precompile).toHaveBeenCalled();
    expect(warm.engine.prepare).not.toHaveBeenCalled();
    const full = fakeView();
    const w2 = await hqModule({ id: 'b', route: '/avengers', prepare: 'full', load: async () => () => full }).create(fakeRt(), {});
    const report = () => {};
    const opts = { alive: () => true };
    await w2.prepare(report, opts);
    expect(full.engine.prepare).toHaveBeenCalledWith(report, opts);
  });

  it('keeps a kept world while its page wants it, and comes back to it at once', async () => {
    const renderer = {};
    const views = [];
    const load = vi.fn(async () => () => {
      const v = fakeView();
      views.push(v);
      return v;
    });
    const mod = hqModule({ id: 'kept', route: '/avengers', keep: true, load });
    mod.keep(true);
    const first = await mod.create(fakeRt({ renderer }), {});
    first.dispose();
    expect(views[0].dispose).not.toHaveBeenCalled();
    expect(views[0].engine.rest).toHaveBeenCalled();
    const again = await mod.create(fakeRt({ renderer }), {});
    expect(again.view).toBe(views[0]);
    expect(again.prepare).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(1);
    // let go by the page: the kept one goes with it
    again.dispose();
    mod.keep(false);
    expect(views[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('makes a kept world again on another renderer, and lets the old one go', async () => {
    const views = [];
    const mod = hqModule({
      id: 'kept',
      route: '/avengers',
      keep: true,
      load: async () => () => {
        const v = fakeView();
        views.push(v);
        return v;
      },
    });
    mod.keep(true);
    (await mod.create(fakeRt({ renderer: {} }), {})).dispose();
    const fresh = await mod.create(fakeRt({ renderer: {} }), {});
    expect(fresh.view).toBe(views[1]);
    expect(views[0].dispose).toHaveBeenCalled();
  });

  it('runs a frame asked for once, ahead of the page’s, and takes the frame of a page that adopts it', async () => {
    const frame = { current: vi.fn() };
    const world = await hqModule({ id: 'g', route: '/avengers', load: async () => () => fakeView() }).create(fakeRt(), { frame });
    const once = vi.fn();
    frame.once = once;
    expect(world.wants()).toBe(true);
    world.draw({ dt: 0.016, now: 1 });
    expect(once).toHaveBeenCalledTimes(1);
    expect(frame.current).not.toHaveBeenCalled();
    expect(frame.once).toBeNull();
    const next = { current: vi.fn() };
    world.update({ frame: next });
    world.draw({ dt: 0.016, now: 2 });
    expect(next.current).toHaveBeenCalledWith(16, 2);
  });

  it('draws its first frame again once placed, for a module with one', async () => {
    const view = fakeView();
    const first = vi.fn();
    const world = await hqModule({ id: 'titanish', route: '/avengers', first, load: async () => () => view }).create(fakeRt(), {});
    await world.prepare(() => {}, { alive: () => true });
    expect(first).toHaveBeenCalledWith(view, {});
    expect(world.wants()).toBe(true);
    world.draw({ dt: 0, now: 0 });
    expect(view.engine.renderOnce).toHaveBeenCalledTimes(1);
    expect(world.wants()).toBe(false);
  });

  it('never keeps a world whose frame threw', async () => {
    const view = fakeView();
    const mod = hqModule({ id: 'kept', route: '/avengers', keep: true, load: async () => () => view });
    mod.keep(true);
    const frame = {
      current: () => {
        throw new Error('a bad frame');
      },
    };
    const world = await mod.create(fakeRt(), { frame });
    expect(() => world.draw({ dt: 0.016, now: 0 })).toThrow('a bad frame');
    world.dispose();
    expect(view.dispose).toHaveBeenCalled();
  });

  it('starts at the tier’s pixels over the box its page measured', () => {
    const mod = hqModule({ id: 'g', route: '/avengers', load: async () => () => fakeView() });
    mod.measure(800, 450);
    expect(mod.ratio).toBeGreaterThan(0);
  });

  it('lets a world go at once when it isn’t kept', async () => {
    const view = fakeView();
    const mod = hqModule({ id: 'game', route: '/avengers', load: async () => () => view });
    mod.keep(true); // (a module that doesn't keep ignores it)
    (await mod.create(fakeRt(), {})).dispose();
    expect(view.dispose).toHaveBeenCalled();
  });
});

// every HQ game's module: the compound, its games, Titan, Invincible's three
const MODULES = import.meta.glob(['../*/module.js', '../../invincible/*/module.js'], { eager: true });
describe('the HQ games’ modules', () => {
  const mods = Object.entries(MODULES)
    .filter(([, m]) => m.default)
    .map(([path, m]) => [path, m.default]);
  it('are all thirteen, one a game, each its own id', () => {
    expect(mods.length).toBe(13);
    expect(new Set(mods.map(([, m]) => m.id)).size).toBe(13);
  });
  for (const [path, mod] of mods) {
    it(`${path} is a classic module with its route’s download`, () => {
      const route = path.includes('invincible') ? '/invincible' : '/avengers';
      expect(validateModule(mod)).toMatchObject({ shading: 'glsl', mb: WORLD_MB[route], calibrate: false });
      expect(typeof mod.warm).toBe('function');
    });
  }
  it('keep the two worlds made once, and no game', () => {
    expect(mods.filter(([, m]) => m.id.endsWith('-compound') || m.id === 'invincible-world').length).toBe(2);
  });
});
