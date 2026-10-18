import { describe, expect, it } from 'vitest';
import { validateModule } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';
import road, { sFromAddress } from './module';
import { sOf } from './line';
import { STAGES } from './stages/index';
import { fakeRt } from './fixtures/rt';

describe('the Road, the world module', () => {
  it('keeps the module contract, on the node renderer', () => {
    expect(() => validateModule(road)).not.toThrow();
    expect(road).toMatchObject({ id: 'road', shading: 'nodes' });
    expect(road.mb).toBe(WORLD_MB['/middle-earth/road']);
    expect(road.label).toMatch(/Road/);
  });

  it('makes a world with everything the runtime asks of one', async () => {
    const world = await road.create(fakeRt(), { at: null, reduced: false });
    for (const k of ['draw', 'resize', 'dispose', 'step', 'anchor', 'lowerQuality']) expect(typeof world[k]).toBe('function');
    world.resize(800, 600);
    expect(world.anchor()).toHaveLength(3);
    world.dispose();
  });
});

describe('the address', () => {
  it('?at=moria opens on Moria, ?at=moria:120 120 m in, anything else at Bag End', () => {
    expect(sFromAddress('moria')).toBe(sOf(STAGES, 'moria', 0));
    expect(sFromAddress('moria:120')).toBe(sOf(STAGES, 'moria', 120));
    expect(sFromAddress('mordor')).toBe(0);
    expect(sFromAddress(null)).toBe(0);
  });

  it('the world opens where the address says', async () => {
    const world = await road.create(fakeRt(), { at: 'gorgoroth', reduced: false });
    expect(world.s).toBe(sOf(STAGES, 'gorgoroth', 0));
    world.dispose();
  });
});
