import { describe, expect, it, vi } from 'vitest';
import { STEPS } from '../lib/three/pace';
import { fromScene, validateModule, validateWorld } from './module';

describe('validateModule', () => {
  it('names what is missing', () => {
    expect(() => validateModule({})).toThrow(/id/);
    expect(() => validateModule({ id: 'x' })).toThrow(/create/);
    expect(() => validateModule({ id: 'x', create() {}, shading: 'wgsl' })).toThrow(/shading/);
    expect(validateModule({ id: 'x', create() {} })).toMatchObject({ id: 'x', shading: 'glsl', mb: 0 });
    expect(validateModule({ id: 'x', create() {}, shading: 'nodes', mb: 3 }).shading).toBe('nodes');
  });
});

describe('validateWorld', () => {
  it('needs draw, resize and dispose', () => {
    expect(() => validateWorld({ draw() {} })).toThrow(/resize/);
    expect(() => validateWorld({ draw() {}, resize() {} })).toThrow(/dispose/);
    expect(() => validateWorld(null)).toThrow(/world/);
    const w = { draw() {}, resize() {}, dispose() {} };
    expect(validateWorld(w)).toBe(w);
  });
});

describe('fromScene', () => {
  const scene = () => {
    const s = { render: vi.fn(() => true), resize: vi.fn(), dispose: vi.fn(), setColors: vi.fn(), setVisible: vi.fn(), update: vi.fn(), warmUp: vi.fn(() => true), lowerQuality: vi.fn(), ready: Promise.resolve() };
    return s;
  };
  const rt = (canvas = {}) => ({ gfx: { canvas }, host: { el: true }, invalidate: vi.fn(), lost: vi.fn() });

  it('makes a scene module a world: render becomes step and draw, its answer wants()', async () => {
    const s = scene();
    const create = vi.fn(() => s);
    const mod = fromScene('universe', create, { shading: 'glsl', mb: 4 });
    expect(mod).toMatchObject({ id: 'universe', shading: 'glsl', mb: 4 });
    const r = rt({ c: 1 });
    const w = await mod.create(r, { colors: [1, 2, 3], reduced: true, ship: 'xwing' });
    expect(create).toHaveBeenCalledTimes(1);
    const [canvas, ctx] = create.mock.calls[0];
    expect(canvas).toEqual({ c: 1 });
    expect(ctx).toMatchObject({ el: r.host, colors: [1, 2, 3], reduced: true, ship: 'xwing' });
    ctx.invalidate();
    expect(r.invalidate).toHaveBeenCalled();
    ctx.onLost();
    expect(r.lost).toHaveBeenCalled();
    w.draw({ dt: 0.016, now: 1000 });
    expect(s.render).toHaveBeenCalledWith(16, 1000);
    expect(w.wants()).toBe(true);
    s.render.mockReturnValue(false);
    w.draw({ dt: 0.016, now: 1016 });
    expect(w.wants()).toBe(false);
    expect(w.ready).toBe(s.ready);
    w.resize(3, 4);
    expect(s.resize).toHaveBeenCalledWith(3, 4);
    w.update({ a: 1 });
    w.setVisible(false);
    w.warmUp(() => 5);
    w.setColors([0, 0, 0]);
    expect(s.update).toHaveBeenCalledWith(expect.objectContaining({ a: 1, onEvent: ctx.onEvent }));
    expect(s.setVisible).toHaveBeenCalledWith(false);
    expect(s.warmUp).toHaveBeenCalled();
    expect(s.setColors).toHaveBeenCalled();
    ctx.onSlow();
    expect(s.lowerQuality).toHaveBeenCalled();
    w.lowerQuality(STEPS.length);
    expect(s.lowerQuality).toHaveBeenCalledTimes(2);
    w.dispose();
    expect(s.dispose).toHaveBeenCalled();
  });

  it("gives the scene the runtime, and holds what it tells the page till the page is listening", async () => {
    const s = scene();
    const create = vi.fn(() => s);
    const mod = fromScene('galaxy', create, { mb: 8, ratio: 1.5, label: 'stars' });
    expect(mod).toMatchObject({ id: 'galaxy', shading: 'glsl', mb: 8, ratio: 1.5, label: 'stars' });
    const emitted = [];
    const r = { ...rt(), events: { emit: (type, data) => emitted.push([type, data]) } };
    const w = await mod.create(r, { onEvent: () => emitted.push('the old page') });
    const [, ctx] = create.mock.calls[0];
    expect(ctx.rt).toBe(r);
    expect(w.scene).toBe(s);
    ctx.onEvent({ type: 'phase', phase: 'landing' });
    expect(emitted).toEqual([]);
    w.attached();
    expect(emitted).toEqual([['phase', { type: 'phase', phase: 'landing' }]]);
    ctx.onEvent({ type: 'found', id: 'x' });
    expect(emitted[1]).toEqual(['found', { type: 'found', id: 'x' }]);
    w.attached(); // (twice is once)
    expect(emitted).toHaveLength(2);
  });

  it('a scene without the optional methods still makes a whole world', async () => {
    const s = { render: () => false, resize() {}, dispose() {} };
    const w = await fromScene('x', () => s).create(rt(), {});
    expect(validateWorld(w)).toBe(w);
    expect(w.ready).toBeUndefined();
    expect(() => w.update({})).not.toThrow();
    expect(() => w.lowerQuality(1)).not.toThrow();
    expect(w.handoff()).toBe(null);
  });
});
