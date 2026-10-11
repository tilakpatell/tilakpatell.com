import { describe, expect, it, vi } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import galaxy from './module';
import surface from './surface/module';

// the scenes, stood in for: what fromScene hands them, and what they hand back
const made = [];
const fake = (name) => ({
  create: vi.fn((canvas, ctx) => {
    const s = { name, ctx, render: vi.fn(() => true), resize: vi.fn(), update: vi.fn(), dispose: vi.fn(), jump: vi.fn(() => true), handoff: vi.fn(() => ({ system: 'tatooine' })) };
    made.push(s);
    return s;
  }),
});
const galaxyScene = fake('galaxy');
const surfaceScene = fake('surface');
vi.mock('./scene', () => ({ create: (...a) => galaxyScene.create(...a) }));
vi.mock('./surface/scene', () => ({ create: (...a) => surfaceScene.create(...a) }));

const fakeRt = () => {
  const emitted = [];
  return { emitted, gfx: { canvas: { c: 1 }, renderer: {} }, host: {}, events: { emit: (type, data) => emitted.push({ type, ...data }) }, invalidate: vi.fn(), lost: vi.fn() };
};

describe('the galaxy and its surfaces as world modules', () => {
  it('the galaxy a glsl module and its surfaces a nodes one, as heavy as the galaxy says, capped at 1.5×', () => {
    expect(galaxy).toMatchObject({ shading: 'glsl', mb: WORLD_MB['/galaxy'], ratio: 1.5 });
    expect(surface).toMatchObject({ shading: 'nodes', mb: WORLD_MB['/galaxy'], ratio: 1.5 });
    expect(galaxy.id).toBe('galaxy');
    expect(surface.id).toBe('galaxy-surface');
  });

  it("make their scene on the runtime's canvas, with the runtime to hand", async () => {
    const rt = fakeRt();
    const w = await galaxy.create(rt, { system: 'hoth', ship: 'xwing', from: null });
    const s = made.at(-1);
    expect(galaxyScene.create).toHaveBeenCalledWith(rt.gfx.canvas, expect.objectContaining({ rt, system: 'hoth', ship: 'xwing' }));
    expect(w.scene).toBe(s);
    expect(w.scene.jump('endor')).toBe(true);
    w.draw({ dt: 0.016, now: 16 });
    expect(s.render).toHaveBeenCalledWith(16, 16);
    expect(w.handoff()).toEqual({ system: 'tatooine' });
    w.dispose();
    expect(s.dispose).toHaveBeenCalled();
  });

  it("the surface made at a landing hears the galaxy's handoff, and keeps quiet till its page listens", async () => {
    const rt = fakeRt();
    const from = { system: 'tatooine', alt: 0.4 };
    const w = await surface.create(rt, { system: 'tatooine', from });
    const s = made.at(-1);
    expect(s.ctx.from).toBe(from);
    s.ctx.onEvent({ type: 'phase', phase: 'landing' });
    expect(rt.emitted).toEqual([]);
    w.attached();
    expect(rt.emitted).toEqual([{ type: 'phase', phase: 'landing' }]);
  });
});
