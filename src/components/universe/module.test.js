import { describe, expect, it, vi } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import universe from './module';

// the scene, stood in for: what fromScene hands it, and what it hands back
const made = [];
const create = vi.fn((canvas, ctx) => {
  const s = { ctx, render: vi.fn(() => true), resize: vi.fn(), update: vi.fn(), dispose: vi.fn(), lowerQuality: vi.fn(), dive: vi.fn(() => 1600) };
  made.push(s);
  return s;
});
vi.mock('./scene', () => ({ create: (...a) => create(...a) }));

const fakeRt = () => {
  const emitted = [];
  return { emitted, gfx: { canvas: { c: 1 }, renderer: {} }, host: {}, events: { emit: (type, data) => emitted.push({ type, ...data }) }, invalidate: vi.fn(), lost: vi.fn() };
};

describe('the universe map as a world module', () => {
  it('a glsl module, as heavy as the worlds list says, capped at 2×, softened through its own post and calibrated by itself', () => {
    expect(universe).toMatchObject({ id: 'universe', shading: 'glsl', mb: WORLD_MB['/universe'], ratio: 2, sharpness: 'own', calibrate: false });
  });

  it("makes its scene on the runtime's canvas, with the runtime to hand and the page's props", async () => {
    const rt = fakeRt();
    const w = await universe.create(rt, { selected: 'marvel', reduced: true });
    const s = made.at(-1);
    expect(create).toHaveBeenCalledWith(rt.gfx.canvas, expect.objectContaining({ rt, selected: 'marvel', reduced: true, el: rt.host }));
    expect(w.scene).toBe(s);
    expect(w.scene.dive('marvel')).toBe(1600);
    w.draw({ dt: 0.016, now: 16 });
    expect(s.render).toHaveBeenCalledWith(16, 16);
    w.lowerQuality(2);
    expect(s.lowerQuality).toHaveBeenCalledWith(2);
    w.dispose();
    expect(s.dispose).toHaveBeenCalled();
  });

  it("keeps what it says quiet till its page listens (the scene's onEvent is the runtime's)", async () => {
    const rt = fakeRt();
    const w = await universe.create(rt, {});
    made.at(-1).ctx.onEvent({ type: 'launch' });
    expect(rt.emitted).toEqual([]);
    w.attached();
    expect(rt.emitted).toEqual([{ type: 'launch' }]);
  });
});
