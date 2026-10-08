import { describe, expect, it } from 'vitest';
import { TAG, distText, fontPx, keepIn, tagMode } from './tagRules';

describe('tagMode', () => {
  it('near under 40 with no distance', () => {
    expect(tagMode(10, { ally: false })).toEqual({ mode: 'near', scale: 1, fade: 1, showDist: false, faint: false });
    expect(tagMode(39.9, { ally: false })).toMatchObject({ mode: 'near', showDist: false });
  });
  it('distance shows from 40', () => {
    expect(tagMode(40, { ally: false })).toMatchObject({ mode: 'near', fade: 1, showDist: true });
    expect(tagMode(139, { ally: false })).toMatchObject({ mode: 'near', showDist: true });
  });
  it('far mode from 140, fading to nothing at 600', () => {
    expect(tagMode(140, { ally: false })).toMatchObject({ mode: 'far', fade: 1, showDist: true });
    expect(tagMode(370, { ally: false }).fade).toBeCloseTo(0.5);
    expect(tagMode(599, { ally: false }).fade).toBeGreaterThan(0);
    expect(tagMode(600, { ally: false }).mode).toBeNull();
    expect(tagMode(5000, { ally: false }).mode).toBeNull();
  });
  it('a stranger faded to all but nothing is faint, so not a spot to click; an ally never is', () => {
    expect(tagMode(140, { ally: false }).faint).toBe(false);
    expect(tagMode(370, { ally: false }).faint).toBe(false); // (half faded: still a tag)
    expect(tagMode(530, { ally: false }).faint).toBe(false); // (fade 0.15: just not)
    expect(tagMode(540, { ally: false }).faint).toBe(true);
    expect(tagMode(599, { ally: false }).faint).toBe(true);
    for (const d of [10, 300, 599, 2000]) expect(tagMode(d, { ally: true }).faint, `ally at ${d}`).toBe(false);
  });
  it('an ally never fades', () => {
    for (const d of [10, 100, 300, 599, 600, 2000]) {
      const m = tagMode(d, { ally: true });
      expect(m.mode, `at ${d}`).not.toBeNull();
      expect(m.fade, `at ${d}`).toBe(1);
    }
  });
  it('far mode keeps the minimum size', () => {
    for (const ally of [false, true])
      for (let d = 0; d <= 3000; d += 7) {
        const m = tagMode(d, { ally });
        if (!m.mode) continue;
        expect(m.scale, `at ${d}`).toBeGreaterThanOrEqual(0.8);
        expect(m.scale, `at ${d}`).toBeLessThanOrEqual(1);
        // the font grows as the tag shrinks: never under 12 px on screen
        expect(fontPx(m.scale) * m.scale, `at ${d}`).toBeGreaterThanOrEqual(TAG.minPx - 1e-9);
        // (and as written in the page, to a tenth of a px)
        expect(Number(fontPx(m.scale).toFixed(1)) * Number(m.scale.toFixed(3)), `at ${d}`).toBeGreaterThanOrEqual(TAG.minPx - 0.01);
      }
  });
  it('shows nothing for no distance at all', () => {
    expect(tagMode(NaN, { ally: true }).mode).toBeNull();
    expect(tagMode(-1, { ally: false }).mode).toBeNull();
  });
});

describe('distText', () => {
  it('distText rounds', () => {
    expect(distText(32)).toBe('320 m');
    expect(distText(32.4)).toBe('320 m');
    expect(distText(4.06)).toBe('40 m');
    expect(distText(99.9)).toBe('1.0 km');
    expect(distText(120)).toBe('1.2 km');
    expect(distText(600)).toBe('6.0 km');
  });
});

describe('keepIn', () => {
  it('pushes a tag at the edge of a phone back inside the box', () => {
    // (a tag sits over its point: centred across, its bottom on it)
    expect(keepIn(358, 300, 120, 30, 360, 640)).toEqual({ x: 296, y: 300 });
    expect(keepIn(2, 10, 120, 30, 360, 640)).toEqual({ x: 64, y: 34 });
    expect(keepIn(180, 640, 120, 30, 360, 640)).toEqual({ x: 180, y: 636 });
  });
  it('leaves one well inside where it is', () => {
    expect(keepIn(180, 300, 120, 30, 360, 640)).toEqual({ x: 180, y: 300 });
  });
  it('hides one whose point is off the box', () => {
    expect(keepIn(-5, 300, 120, 30, 360, 640)).toBeNull();
    expect(keepIn(180, 700, 120, 30, 360, 640)).toBeNull();
  });
  it('centres one wider than the box', () => {
    expect(keepIn(10, 300, 400, 30, 360, 640)).toEqual({ x: 180, y: 300 });
  });
});
