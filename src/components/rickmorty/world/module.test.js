import { describe, expect, it, vi } from 'vitest';
import { validateModule, validateWorld } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';

const stage = { hold: vi.fn(() => true), giveBack: vi.fn(), lowerQuality: vi.fn() };
const api = { stage, lost: false, hasArea: vi.fn(() => false), ensureArea: vi.fn(async () => {}), fx: vi.fn(), resize: vi.fn(), prepare: vi.fn(async () => {}), dispose: vi.fn() };
vi.mock('./scene', () => ({ createRmWorld: vi.fn(async () => api) }));

const { default: street, rmWorldModule } = await import('./module');

describe('C-137’s module', () => {
  it('is a module, glsl until FL3, at the route’s size', () => {
    const m = validateModule(street);
    expect(m.id).toBe('c137');
    expect(m.shading).toBe('glsl');
    expect(m.mb).toBe(WORLD_MB['/c-137']);
    expect(m.calibrate).toBe(false);
    expect(m.sharpness).toBe('own');
  });

  it('is one module a landing, the same one each time it’s asked for', () => {
    const planet = { id: 'gazorpazorp', name: 'Gazorpazorp', area: 'gazorpazorp', back: { x: 1, z: 2 } };
    expect(rmWorldModule(planet)).toBe(rmWorldModule(planet));
    expect(rmWorldModule(planet).id).toBe('c137-gazorpazorp');
    expect(rmWorldModule(planet).label).toMatch(/^Gazorpazorp in 3D/);
    expect(rmWorldModule()).toBe(street);
  });

  it('builds a planet’s area and opens its portal before it’s prepared', async () => {
    const planet = { id: 'squanch', name: 'Squanch', area: 'squanch', back: { x: 3, z: 4 } };
    validateWorld(await rmWorldModule(planet).create({ gfx: {} }, {}));
    expect(api.ensureArea).toHaveBeenCalledWith('squanch');
    expect(api.fx).toHaveBeenCalledWith('portal', { at: planet.back });
    expect(api.prepare).not.toHaveBeenCalled();
  });

  it('draws the page’s frame held the stage’s way, and wants none without one', async () => {
    const frame = { current: null };
    const world = await street.create({ gfx: {} }, { frame });
    expect(world.wants()).toBe(false);
    const tick = vi.fn();
    frame.current = tick;
    stage.hold.mockClear();
    stage.giveBack.mockClear();
    world.draw({ dt: 0.016, now: 7 });
    expect(tick).toHaveBeenCalledWith(16, 7);
    expect(stage.hold).toHaveBeenCalledTimes(1);
    expect(stage.giveBack).toHaveBeenCalledTimes(1);
    world.lowerQuality(3);
    expect(stage.lowerQuality).toHaveBeenCalledWith(3);
  });
});
