import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateModule } from '../../../runtime/module';
import { WORLD_MB } from '../../worlds/worlds';
import { fakeRt } from '../road/fixtures/rt';
import { installCanvas } from './fixtures/canvas';
import { KEEP } from './keep';
import { PAGES } from './pages';
import { TURN } from './book';
import redbook from './module';

let uninstall;
beforeAll(() => {
  uninstall = installCanvas();
});
afterAll(() => uninstall());

const run = (world, s, input) => {
  for (let i = 0; i < Math.round(s * 30); i++) world.step(1 / 30, input);
};

describe('the Red Book, the world module', () => {
  it('keeps the module contract, on the node renderer, at Middle-earth’s download', () => {
    expect(() => validateModule(redbook)).not.toThrow();
    expect(redbook).toMatchObject({ id: 'redbook', shading: 'nodes' });
    expect(redbook.mb).toBe(WORLD_MB['/middle-earth']);
  });

  it('opens itself on arrival and says so, then tells the page it is at Bag End', () => {
    const rt = fakeRt();
    const world = redbook.create(rt, { reduced: false });
    for (const k of ['draw', 'resize', 'dispose', 'step', 'anchor', 'lowerQuality']) expect(typeof world[k]).toBe('function');
    world.resize(1440, 900);
    world.attached();
    run(world, 4);
    expect(rt.emitted.some((e) => e.type === 'cover')).toBe(true);
    expect(rt.emitted.find((e) => e.type === 'page')).toMatchObject({ index: 0, id: 'bag-end' });
    world.draw();
    expect(rt.gfx.renderer.render).toHaveBeenCalled();
    world.dispose();
  });

  it('opens at the page the address names, and turns', () => {
    const rt = fakeRt();
    const world = redbook.create(rt, { page: 'bree', reduced: true });
    world.attached();
    world.step(1 / 30);
    expect(world.page).toBe(2);
    world.turn(1);
    run(world, 0.1);
    expect(world.page).toBe(3);
    world.dispose();
  });

  it('turns through every page and onto the back pages without falling over', () => {
    const rt = fakeRt();
    const world = redbook.create(rt, { reduced: false });
    world.attached();
    for (let i = 0; i < PAGES.length + 2; i++) {
      world.turn(1);
      run(world, TURN + 0.1);
    }
    expect(world.page).toBe(PAGES.length + 1);
    world.dispose();
  });

  it('puts the Ring on, and has it torn off when the Eye comes', () => {
    const rt = fakeRt();
    const world = redbook.create(rt, { reduced: true });
    world.attached();
    world.wearRing(true);
    run(world, 1);
    expect(world.ring.vision).toBe(1);
    run(world, 41);
    expect(rt.emitted.some((e) => e.type === 'torn')).toBe(true);
    expect(world.ring.worn).toBe(false);
    world.dispose();
  });

  it('puts the Ring down, and says so, when the stone is taken up', () => {
    const rt = fakeRt();
    const world = redbook.create(rt, { reduced: true });
    world.attached();
    world.holdRing(true);
    expect(rt.emitted.filter((e) => e.type === 'ring').at(-1)).toMatchObject({ held: true });
    world.set({ stone: true });
    expect(rt.emitted.filter((e) => e.type === 'ring').at(-1)).toMatchObject({ held: false });
    world.dispose();
  });

  it('opens the Doors to the right word only, and only at Moria', () => {
    const rt = fakeRt();
    const world = redbook.create(rt, { page: 'moria', reduced: true });
    world.attached();
    world.step(1 / 30);
    expect(world.say('friend')).toBe(false);
    expect(world.say('Mellon')).toBe(true);
    world.goTo('bree');
    world.step(1 / 30);
    expect(world.say('mellon')).toBe(false);
    world.dispose();
  });

  it('keeps what it keeps under its key', () => {
    const rt = fakeRt();
    rt.saves.set(KEEP.key, { met: ['gandalf'], found: ['bree'], toys: [] });
    const world = redbook.create(rt, { reduced: true });
    expect(world.keep.met).toEqual(['gandalf']);
    world.dispose();
    expect(rt.saves.get(KEEP.key).found).toEqual(['bree']);
  });
});
