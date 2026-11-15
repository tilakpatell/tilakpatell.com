import { describe, expect, it, vi } from 'vitest';
import { expanseNebulae, nebulaOf } from './expanse';
import { checkDesc } from './rules';

const W = { id: 'E:5,0:w0', kind: 'nebula', at: [400000, 0, -20000], size: 400, seed: 1n };

describe('the Expanse’s nebulae', () => {
  it('describes a wonder as a nebula at its own absolute place', () => {
    const d = nebulaOf(W);
    expect(d).toMatchObject({ id: 'E:5,0:w0', at: [400000, 0, -20000], r: 400, seed: 1n, form: 'cloud' });
    expect(d.colors[0]).toBe('#b48cff');
    expect(d.colors[1]).toMatch(/^#[0-9a-f]{6}$/);
    expect(nebulaOf(W)).toEqual(d);
    expect(nebulaOf({ ...W, seed: 2n }).colors[1]).not.toBe(d.colors[1]);
    expect(() => checkDesc(d)).not.toThrow();
  });
  it('hands each to the renderer and takes it back once', () => {
    let h = 0;
    const nebulae = { add: vi.fn(() => ++h), remove: vi.fn() };
    const draw = expanseNebulae(nebulae);
    const a = draw(W);
    expect(nebulae.add).toHaveBeenCalledWith(nebulaOf(W));
    expect(a.object.isObject3D).toBe(true);
    expect(a.object.children).toHaveLength(0);
    a.dispose();
    expect(nebulae.remove).toHaveBeenCalledWith(1);
  });
});
