import { describe, expect, it } from 'vitest';
import { archOutline, createMesh } from './mesh';
import { PARTS } from './parts';
import { heightAt } from '../terrain';

// (each triangle’s winding agrees with its normal: the face is seen from the side it faces)
function windingAgrees(g) {
  const p = g.attributes.position.array;
  const n = g.attributes.normal.array;
  let bad = 0;
  for (let t = 0; t < p.length / 9; t++) {
    const k = t * 9;
    const e1 = [p[k + 3] - p[k], p[k + 4] - p[k + 1], p[k + 5] - p[k + 2]];
    const e2 = [p[k + 6] - p[k], p[k + 7] - p[k + 1], p[k + 8] - p[k + 2]];
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const area = Math.hypot(...c);
    if (area < 1e-9) continue;
    const avg = [0, 1, 2].map((i) => n[k + i] + n[k + 3 + i] + n[k + 6 + i]);
    if (c[0] * avg[0] + c[1] * avg[1] + c[2] * avg[2] < 0) bad += 1;
  }
  return bad;
}

// (the kit’s parts, one of each kind it was built of, as the kit castle laid
// them out before the hero castle took its place: the kit still builds the
// doors’ arches, and may build more)
const KIT = [
  { kind: 'hall', id: 'great-hall', at: [-12, 11], len: 70, w: 22, h: 24, roof: { h: 20 }, windows: { n: 7, w: 3.2, h: 14, sill: 5.5 }, ends: { window: { w: 7, h: 15, sill: 4.5 } }, dormers: 5 },
  { kind: 'tower', id: 'sw-tower', at: [-55, 6], r: 8, h: 56, roof: 'both', cone: { h: 24 }, windows: { rows: [10, 18, 26, 34, 42, 50], per: 6 } },
  { kind: 'square', id: 'entrance-hall', at: [37, 8], w: 26, d: 30, h: 28, roof: 'battlement', turrets: { r: 2.8, h: 35, cone: 9 }, windows: { rows: [7, 15, 22], per: 3, side: 3, w: 1.6, h: 3.6 } },
  { kind: 'wall', id: 'terrace', from: [-58, 33], to: [-18, 36], h: 1.3, thick: 0.7, battlement: false },
];

describe('the castle’s mesh', () => {
  it('gathers a box into its material’s bucket, six faces facing out', () => {
    const m = createMesh();
    m.box('ashlar', { at: [0, 0, 0], size: [2, 3, 4], bottom: true });
    expect(m.count('ashlar')).toBe(12);
    const g = m.geometries().ashlar;
    expect(windingAgrees(g)).toBe(0);
    expect(g.attributes.uv.count).toBe(36);
    expect(g.attributes.color.count).toBe(36);
  });

  it('marks a window’s threshold on its glass alone', () => {
    const m = createMesh();
    m.lit(0.4).shape('glass', { at: [0, 0, 0], outline: archOutline(1, 2) });
    m.lit(0).box('ashlar', { at: [0, 0, 0], size: [1, 1, 1] });
    const g = m.geometries();
    expect(g.glass.attributes.aLit.array.every((v) => Math.abs(v - 0.4) < 1e-6)).toBe(true);
    expect(g.ashlar.attributes.aLit).toBeUndefined();
  });

  it('draws a pointed arch: level sill, upright sides, its point on the middle at the top', () => {
    const o = archOutline(2, 5);
    expect(o[0]).toEqual([0, 0]);
    const top = Math.max(...o.map((p) => p[1]));
    expect(top).toBeCloseTo(5, 6);
    expect(o.find((p) => p[1] === top)[0]).toBeCloseTo(0, 6);
    for (const [x] of o) expect(Math.abs(x)).toBeLessThanOrEqual(1 + 1e-9);
    const round = archOutline(2, 5, { pointed: false });
    expect(Math.max(...round.map((p) => p[1]))).toBeCloseTo(5, 6);
  });

  it('builds the kit’s parts, every face seen from its own side, in a few materials', () => {
    const m = createMesh();
    let r = 0;
    const ctx = { mesh: m, ground: heightAt, far: true, rng: () => ((r = (r * 9301 + 49297) % 233280) / 233280) };
    for (const p of KIT) PARTS[p.kind](ctx, p);
    const g = m.geometries();
    expect(Object.keys(g).length).toBeLessThanOrEqual(8);
    let tris = 0;
    for (const geo of Object.values(g)) {
      tris += geo.attributes.position.count / 3;
      expect(windingAgrees(geo)).toBe(0);
    }
    // (the far cut: the whole castle in a few tens of thousands of triangles)
    expect(tris).toBeLessThan(60000);
  });
});
