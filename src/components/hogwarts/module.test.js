import { describe, expect, it, vi } from 'vitest';

// (the kit's files are fetched in the browser; here its manifest never comes, so no pool is made)
vi.mock('../../lib/three/kitNodes', () => ({
  loadKit: () => ({ manifest: new Promise(() => {}), info: () => null, dispose() {} }),
  createPool: () => null,
}));
import { validateModule } from '../../runtime/module';
import { WORLD_MB } from '../worlds/worlds';
import hogwarts, { KEYS } from './module';
import { DOOR, SPAWN } from './rules/shore';

const fakeRt = () => {
  const emitted = [];
  return {
    emitted,
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
    for (const k of ['draw', 'resize', 'dispose', 'step', 'anchor', 'go', 'stick']) expect(typeof world[k]).toBe('function');
    expect(rt.input.bind.mock.calls[0][0]).toMatchObject({ forward: KEYS.forward, act: KEYS.act });
    world.resize(800, 600);
    world.step(1 / 60, snap());
    world.draw({ renderer: rt.gfx.renderer });
    expect(rt.gfx.renderer.render).toHaveBeenCalled();
    expect(world.anchor()).toHaveLength(3);
    world.dispose();
    expect(rt.input.unbind).toHaveBeenCalled();
    expect(rt.gfx.renderer.toneMappingExposure).toBe(1);
  });

  it('starts you on the shore and walks you down to the boats, where the way in is offered and taken', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    world.attached();
    expect(world.walker.state.x).toBeCloseTo(SPAWN.at[0], 6);
    // (stood at the jetty's end, facing the boats: the prompt comes, and E takes it)
    world.walker.place(DOOR.at, 0);
    world.step(1 / 60, snap());
    expect(rt.emitted.filter((e) => e.type === 'near').at(-1)).toMatchObject({ door: { label: 'Hogwarts' } });
    world.step(1 / 60, snap([], ['KeyE']));
    expect(rt.emitted.at(-1)).toMatchObject({ type: 'go', door: { label: 'Hogwarts' } });
    // (and walked back up the shingle, it goes)
    world.walker.place(SPAWN.at, SPAWN.yaw);
    world.step(1 / 60, snap());
    expect(rt.emitted.filter((e) => e.type === 'near').at(-1)).toMatchObject({ door: null });
    world.dispose();
  });

  it('holds what it says till the page listens', async () => {
    const rt = fakeRt();
    const world = await hogwarts.create(rt, {});
    world.step(1 / 60, snap([], ['Escape']));
    expect(rt.emitted).toHaveLength(0);
    world.attached();
    expect(rt.emitted.map((e) => e.type)).toContain('menu');
    world.dispose();
  });
});
