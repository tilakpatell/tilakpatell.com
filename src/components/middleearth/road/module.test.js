import { describe, expect, it } from 'vitest';
import { validateModule } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';
import road, { KEYS, sFromAddress } from './module';
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

// an input snapshot that holds nothing and presses `pressed` (codes) this frame
const snap = (pressed = [], held = []) => ({ pressed: new Set(pressed), action: (n) => held.includes(n), pointer: { drag: null } });

describe('the face’s wiring: keys, events, the save', () => {
  it('binds the Road’s keys', async () => {
    const rt = fakeRt();
    await road.create(rt, { at: null });
    expect(rt.input.bind).toHaveBeenCalledWith(KEYS);
    expect(KEYS.walk).toEqual(['KeyW', 'ArrowUp']);
    expect(KEYS.auto).toEqual(['Space']);
    expect(KEYS.stage10).toEqual(['Digit0']);
  });

  it('opens the first stage with the Road’s own card once the page listens', async () => {
    const rt = fakeRt();
    const world = await road.create(rt, { at: null });
    world.attached();
    expect(rt.emitted.find((e) => e.type === 'stage')).toMatchObject({ id: 'hobbiton', first: true });
  });

  it('offers to carry on from a save past the first stage, and waits for the answer', async () => {
    const rt = fakeRt();
    rt.saves.set('tp-road', { v: 1, s: sOf(STAGES, 'moria', 10), ridden: false, at: 0 });
    const world = await road.create(rt, { at: null });
    world.attached();
    expect(rt.emitted.find((e) => e.type === 'resume')).toMatchObject({ id: 'moria', name: 'Moria' });
    expect(rt.emitted.some((e) => e.type === 'stage')).toBe(false);
    const was = world.s;
    world.step(1, snap());
    expect(world.s).toBe(was);
    world.carryOn();
    expect(rt.emitted.find((e) => e.type === 'stage')).toMatchObject({ id: 'moria' });
    world.step(1, snap());
    expect(world.s).toBeGreaterThan(was);
  });

  it('a lost context put back within a minute carries on with no card and no offer', async () => {
    const rt = fakeRt();
    rt.saves.set('tp-road', { v: 1, s: sOf(STAGES, 'moria', 10), ridden: false, at: Date.now() - 5000 });
    const world = await road.create(rt, { at: null });
    world.attached();
    expect(world.s).toBe(sOf(STAGES, 'moria', 10));
    expect(rt.emitted.some((e) => e.type === 'stage' || e.type === 'resume')).toBe(false);
  });

  it('a number key jumps to its stage; Space turns auto off', async () => {
    const rt = fakeRt();
    const world = await road.create(rt, { at: null });
    world.attached();
    world.step(1 / 60, snap(['Digit8']));
    expect(world.s).toBeCloseTo(sOf(STAGES, 'moria', 0), 4);
    world.step(1 / 60, snap(['Space']));
    expect(rt.emitted.filter((e) => e.type === 'mode').at(-1)).toMatchObject({ auto: false });
  });

  it('skipping to the end ends the ride and keeps the save', async () => {
    const rt = fakeRt();
    const world = await road.create(rt, { at: null });
    world.attached();
    world.skipToEnd();
    expect(rt.emitted.some((e) => e.type === 'end')).toBe(true);
    expect(rt.saves.get('tp-road')).toMatchObject({ v: 1, s: 1, ridden: true });
  });
});
