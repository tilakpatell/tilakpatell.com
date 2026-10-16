import { describe, expect, it, vi } from 'vitest';
import { validateModule, validateWorld } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';

const calls = [];
const stage = {
  hold: vi.fn(() => true),
  giveBack: vi.fn(),
  lowerQuality: vi.fn(),
};
vi.mock('./scene', () => ({
  createCitadelWorld: vi.fn(async (rt, opts) => {
    calls.push({ rt, opts });
    return { stage, resize: vi.fn(), prepare: vi.fn(async () => {}), dispose: vi.fn() };
  }),
}));

const { default: citadel } = await import('./module');

describe('the Citadel’s module', () => {
  it('is a module, glsl until FL3, at the route’s size', () => {
    const m = validateModule(citadel);
    expect(m.id).toBe('citadel');
    expect(m.shading).toBe('glsl');
    expect(m.mb).toBe(WORLD_MB['/c-137']);
    // (the runtime's walk through the pace's steps would draw it softer than lib/stage3d did)
    expect(m.calibrate).toBe(false);
    expect(m.sharpness).toBe('own');
    expect(m.ratio).toBeGreaterThan(0);
  });

  it('makes the scene on the runtime', async () => {
    const rt = { gfx: { renderer: {} } };
    const world = validateWorld(await citadel.create(rt, { looks: { rick: 'x' } }));
    expect(calls.at(-1).rt).toBe(rt);
    expect(calls.at(-1).opts.looks).toEqual({ rick: 'x' });
    expect(world.api).toBeTruthy();
  });

  it('frees the stage a build that fails made', async () => {
    const { createCitadelWorld } = await import('./scene');
    const made = { dispose: vi.fn() };
    createCitadelWorld.mockImplementationOnce(async (rt, { track }) => {
      track.push(made);
      throw new Error('no models');
    });
    await expect(citadel.create({ gfx: {} }, {})).rejects.toThrow('no models');
    expect(made.dispose).toHaveBeenCalledTimes(1);
  });

  it('draws the page’s frame, held the stage’s way, and wants none without one', async () => {
    const frame = { current: null };
    const world = await citadel.create({ gfx: {} }, { frame });
    expect(world.wants()).toBe(false);
    world.draw({ dt: 0.016, now: 5 });
    const tick = vi.fn();
    frame.current = tick;
    expect(world.wants()).toBe(true);
    stage.hold.mockClear();
    stage.giveBack.mockClear();
    world.draw({ dt: 0.016, now: 5 });
    expect(tick).toHaveBeenCalledWith(16, 5);
    expect(stage.hold).toHaveBeenCalledTimes(1);
    expect(stage.giveBack).toHaveBeenCalledTimes(1);
  });

  it('gives the renderer back when the page’s frame throws', async () => {
    const frame = { current: () => { throw new Error('boom'); } };
    const world = await citadel.create({ gfx: {} }, { frame });
    stage.giveBack.mockClear();
    expect(() => world.draw({ dt: 0.016, now: 0 })).toThrow('boom');
    expect(stage.giveBack).toHaveBeenCalledTimes(1);
  });

  it('lowers itself on the stage’s ladder at the governor’s level', async () => {
    const world = await citadel.create({ gfx: {} }, {});
    world.lowerQuality(2);
    expect(stage.lowerQuality).toHaveBeenCalledWith(2);
  });
});
