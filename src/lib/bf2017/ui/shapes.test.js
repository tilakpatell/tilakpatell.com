import { describe, expect, it } from 'vitest';
import { SHAPES, shape, shapeSvg } from './shapes';

describe("the game's vector shapes", () => {
  it('holds the HUD crosshairs, markers, game-mode and end-of-round shapes', () => {
    expect(SHAPES.filter((n) => n.startsWith('Crosshairs_')).length).toBeGreaterThan(40);
    expect(SHAPES.length).toBeGreaterThan(250);
  });

  it("gives a shape its view box on its layout rect and its paths in the game's colour", () => {
    const s = shape('Crosshairs_Ability_Dooku');
    expect(s.viewBox).toBe('0 0 4 8');
    expect(s.paths).toHaveLength(2);
    expect(s.paths[0]).toMatchObject({ d: 'M0 2L2 8L4 2L2 0Z', fillRule: 'evenodd', opacity: 0.85 });
    expect(s.paths[0].fill).toMatch(/^rgb\(/);
    expect(shape('NoSuchShape')).toBeNull();
  });

  it('draws a ring crosshair even-odd, its inner path in the same element', () => {
    const name = SHAPES.find((n) => shape(n).paths.some((p) => p.d.split('M').length > 2));
    expect(name).toBeTruthy();
    const p = shape(name).paths.find((x) => x.d.split('M').length > 2);
    expect(p.fillRule).toBe('evenodd');
  });

  it("draws an outline or lines shape as a stroke, never a fill", () => {
    const name = SHAPES.find((n) => shape(n).paths.some((p) => p.stroke));
    const p = shape(name).paths.find((x) => x.stroke);
    expect(p.fill).toBe('none');
    expect(p.strokeWidth).toBeGreaterThan(0);
  });

  it('writes a shape as SVG in a colour asked for, at a size', () => {
    const svg = shapeSvg(shape('Crosshairs_Ability_Dooku'), { colour: 'red', size: 32 });
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 4 8"/);
    expect(svg).toContain('width="32"');
    expect(svg).toContain('fill="red"');
    expect(svg).toContain('fill-rule="evenodd"');
  });
});

describe('a crosshair put together from the game’s parts', () => {
  it('places the dot in the middle and a notch on each side, each by a transform', async () => {
    const { blasterCrosshair } = await import('./shapes');
    const c = blasterCrosshair();
    expect(c.viewBox).toBe('-20 -20 40 40');
    expect(c.paths).toHaveLength(2 + 4);
    expect(c.paths.filter((p) => /rotate\(90 /.test(p.transform))).toHaveLength(1);
    expect(c.paths[0].transform).toBe('translate(-2 -2) scale(1)');
  });
});

describe('every shape’s view box', () => {
  it('holds its triangulated points (LayoutRect is its two corners)', () => {
    for (const n of SHAPES) {
      const s = shape(n);
      const [, , w, h] = s.viewBox.split(' ').map(Number);
      expect(w, n).toBeGreaterThanOrEqual(0);
      expect(h, n).toBeGreaterThanOrEqual(0);
    }
    const pill = shape('CountdownPill');
    expect(pill.viewBox).toBe('0 -26 12 26');
  });
});

describe('the game’s crosshairs put together as its widgets build them', () => {
  it('gives the blaster rifle its dot and three short lines at 24, the heavy blaster three arcs, the pistol lines left, below and right, the default the dot', async () => {
    const { crosshairFor, CROSSHAIR_BOX } = await import('./shapes');
    const rifle = crosshairFor('rifle');
    expect(rifle.viewBox).toBe(CROSSHAIR_BOX);
    // (the dot's two paths and three lines of two each)
    expect(rifle.paths).toHaveLength(2 + 3 * 2);
    for (const turn of [240, 360, 480]) expect(rifle.paths.filter((p) => new RegExp(`rotate\\(${turn} `).test(p.transform))).toHaveLength(2);
    // (the line at 0° stands 24 above the middle: its 3 × 16 box's top-left at (-1.5, -32))
    expect(rifle.paths.find((p) => / rotate\(360 /.test(p.transform)).transform).toMatch(/^translate\(-1\.5 -32\)/);
    const heavy = crosshairFor('heavy');
    expect(heavy.paths).toHaveLength(3 * 2);
    expect(heavy.name).toBe('Crosshairs_ArcShort+Crosshairs_ArcShort+Crosshairs_ArcShort');
    const pistol = crosshairFor('pistol');
    expect(pistol.paths).toHaveLength(2 + 3 * 2);
    for (const turn of [90, 180, 270]) expect(pistol.paths.filter((p) => new RegExp(`rotate\\(${turn} `).test(p.transform))).toHaveLength(2);
    expect(crosshairFor('default').paths).toHaveLength(2);
    expect(crosshairFor('nonsense').paths).toHaveLength(2);
  });
});

describe('the hit and kill markers put together from the game’s parts', () => {
  it('sets four ticks on the diagonals round the middle, each turned to point out', async () => {
    const { hitMarker, killMarker } = await import('./shapes');
    for (const m of [hitMarker(), killMarker()]) {
      expect(m.viewBox).toBe('-20 -20 40 40');
      // (each part is the game's two paths: its dark edge and its white)
      expect(m.paths).toHaveLength(2 * 4);
      for (const turn of [45, -45, 135, -135]) expect(m.paths.filter((p) => new RegExp(`rotate\\(${turn} `).test(p.transform))).toHaveLength(2);
      // (the white path takes the ink the HUD gives it: rgb(255 255 255), which the kit maps to currentColor)
      expect(m.paths.filter((p) => p.fill === 'rgb(255 255 255)')).toHaveLength(4);
    }
  });
});
