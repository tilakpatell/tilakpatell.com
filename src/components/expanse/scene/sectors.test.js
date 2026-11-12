import { describe, expect, it } from 'vitest';
import { nebula } from './sectors';

// (the rest of a sector, drawn, is tested where it now lives: the far layer's slots in
// universe/farStars.test.js, discs.test.js, near.test.js and expanse.test.js)
describe('a generated nebula, drawn', () => {
  const w = { id: 'E:5,0:w0', kind: 'nebula', at: [0, 0, 0], size: 400, seed: 3n };

  it('is one Points of soft puffs inside its size, the same every time', () => {
    const made = [];
    const a = nebula(w, made);
    const b = nebula(w, []);
    expect(a.isPoints).toBe(true);
    expect(made).toHaveLength(2);
    const p = a.geometry.attributes.position;
    expect(p.count).toBe(48);
    for (let i = 0; i < p.count; i++) expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeLessThanOrEqual(400 + 1e-6);
    expect(Array.from(p.array)).toEqual(Array.from(b.geometry.attributes.position.array));
    for (const m of made) m.dispose();
  });
});
