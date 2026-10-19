import { describe, expect, it, vi } from 'vitest';

// (the lands are lands.test.js's; the wiring here walks over a flat stand-in,
// as building a stage's ground at every jump would take the test seconds)
vi.mock('./lands', () => ({
  createLands: () => ({ at() {}, step() {}, water() {}, follow() {}, life() {}, groupOf: () => null, landOf: () => null, heightAt: () => 0, ready: () => true, current: null, dispose() {} }),
}));
import { validateModule } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';
import road, { KEYS, sFromAddress } from './module';
import { sOf } from './line';
import { STAGES } from './stages/index';
import { BEATS_OF } from './stages/registry';
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
    expect(rt.input.bind.mock.calls[0][0]).toMatchObject({ walk: KEYS.walk, auto: KEYS.auto });
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

  it('skipping to the end ends the ride, but counts it ridden only once two thirds were walked', async () => {
    const rt = fakeRt();
    const world = await road.create(rt, { at: null });
    world.attached();
    world.skipToEnd();
    expect(rt.emitted.some((e) => e.type === 'end')).toBe(true);
    expect(rt.saves.get('tp-road')).toMatchObject({ v: 1, s: 1, ridden: false });
    // (jumped most of the way and walked a little is not ridden; two thirds walked is)
    const rt2 = fakeRt();
    const jumped = await road.create(rt2, { at: null });
    jumped.attached();
    jumped.set(0.6);
    for (let i = 0; i < 40; i++) jumped.step(1, snap([], ['run']));
    jumped.skipToEnd();
    expect(rt2.saves.get('tp-road')).toMatchObject({ s: 1, ridden: false });
    const rt3 = fakeRt();
    const walked = await road.create(rt3, { at: null });
    walked.attached();
    for (let i = 0; i < 400; i++) walked.step(1, snap([], ['run']));
    walked.skipToEnd();
    expect(rt3.saves.get('tp-road')).toMatchObject({ s: 1, ridden: true });
  });

  it('a finished ride, come back to, starts again rather than ending at once', async () => {
    const rt = fakeRt();
    rt.saves.set('tp-road', { v: 1, s: 1, ridden: true, at: 0, walked: 1 });
    const world = await road.create(rt, { at: null });
    world.attached();
    world.step(1 / 60, snap());
    expect(world.s).toBeLessThan(0.01);
    expect(rt.emitted.some((e) => e.type === 'end' || e.type === 'resume')).toBe(false);
  });

  it('a lost context after an address puts the ride back where it was, not at the address', async () => {
    const rt = fakeRt();
    rt.saves.set('tp-road', { v: 1, s: sOf(STAGES, 'lorien', 30), ridden: false, at: Date.now() - 3000, walked: 0.1 });
    const world = await road.create(rt, { at: 'moria' });
    world.attached();
    expect(world.s).toBe(sOf(STAGES, 'lorien', 30));
    expect(rt.emitted.some((e) => e.type === 'stage')).toBe(false);
  });

  it('an address doesn’t write over the visitor’s ride until they walk it', async () => {
    const rt = fakeRt();
    const kept = { v: 1, s: sOf(STAGES, 'moria', 10), ridden: false, at: 0, walked: 0.3 };
    rt.saves.set('tp-road', kept);
    const world = await road.create(rt, { at: 'shire-edge' });
    world.attached();
    world.setAuto(false);
    for (let i = 0; i < 10; i++) world.step(1, snap());
    expect(rt.saves.get('tp-road')).toEqual(kept);
    for (let i = 0; i < 6; i++) world.step(1, snap([], ['walk']));
    expect(rt.saves.get('tp-road')).not.toEqual(kept);
    expect(rt.saves.get('tp-road').s).toBeGreaterThan(sOf(STAGES, 'shire-edge', 0));
  });

  it('a first ride holds on Bag End’s mark for the first words, then walks', async () => {
    const rt = fakeRt();
    const world = await road.create(rt, { at: null });
    world.attached();
    for (let i = 0; i < 5 * 60; i++) world.step(1 / 60, snap([]));
    expect(world.s).toBe(0);
    for (let i = 0; i < 2 * 60; i++) world.step(1 / 60, snap([]));
    expect(world.s).toBeGreaterThan(0);
  });

  it('under reduced motion Next steps from beat to beat, to the next stage where a stage has none, never to the end', async () => {
    const rt = fakeRt();
    const world = await road.create(rt, { at: null, reduced: true });
    world.attached();
    world.step(1 / 60, snap(['Enter']));
    expect(world.s).toBeCloseTo(sOf(STAGES, 'hobbiton', 40), 9);
    world.set(sOf(STAGES, 'bree', 10));
    world.step(1 / 60, snap(['Enter']));
    expect(world.s).toBeCloseTo(sOf(STAGES, 'bree', BEATS_OF.bree[0].at), 9);
    // (a stage not yet written steps to the next stage’s start, while there is one)
    const bare = STAGES.findIndex((st, i) => !BEATS_OF[st.id] && i < STAGES.length - 1);
    if (bare >= 0) {
      world.set(sOf(STAGES, STAGES[bare].id, 10));
      world.step(1 / 60, snap(['Enter']));
      expect(world.s).toBeCloseTo(sOf(STAGES, STAGES[bare + 1].id, 0), 9);
    }
    expect(rt.emitted.some((e) => e.type === 'end')).toBe(false);
  });

  it('while the resume card waits nothing walks, and under reduced motion Enter carries on', async () => {
    const rt = fakeRt();
    rt.saves.set('tp-road', { v: 1, s: sOf(STAGES, 'moria', 10), ridden: false, at: 0 });
    const world = await road.create(rt, { at: null, reduced: true });
    world.attached();
    const was = world.s;
    for (let i = 0; i < 5; i++) world.step(1, snap(['Space'], ['walk', 'run']));
    expect(world.s).toBe(was);
    world.step(1 / 60, snap(['Enter']));
    expect(rt.emitted.find((e) => e.type === 'stage')).toMatchObject({ id: 'moria' });
    expect(world.s).toBe(was);
  });

  it('binds Enter only under reduced motion, so a focused button takes it otherwise', async () => {
    const rt = fakeRt();
    await road.create(rt, { at: null });
    expect(rt.input.bind.mock.calls[0][0].next).toBeUndefined();
    const rt2 = fakeRt();
    await road.create(rt2, { at: null, reduced: true });
    expect(rt2.input.bind.mock.calls[0][0].next).toEqual(['Enter']);
  });
});
