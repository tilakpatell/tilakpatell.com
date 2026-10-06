import { describe, expect, it } from 'vitest';
import { buildFigure } from './figures';

const mats = (f) => {
  const s = new Set();
  f.model.traverse((o) => o.isMesh && s.add(o.material));
  return s;
};

describe('the built people', () => {
  it('dresses two of the same people in the same materials', () => {
    const a = buildFigure('stormtrooper');
    const b = buildFigure('stormtrooper');
    expect([...mats(a)].every((m) => mats(b).has(m))).toBe(true);
  });

  it("leaves the shared materials alone when one goes", () => {
    const a = buildFigure('stormtrooper');
    const b = buildFigure('stormtrooper');
    let gone = 0;
    for (const m of mats(b)) m.addEventListener('dispose', () => gone++);
    a.dispose();
    expect(gone).toBe(0);
  });
});
