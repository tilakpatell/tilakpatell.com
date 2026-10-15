import { describe, expect, it } from 'vitest';
import { WIDGETS, colour, fontFor, placeIn, placeWidget, portrait, widget } from './index';

describe('the game’s HUD widgets, for its world', () => {
  it('gives a widget its tree, its layout and its words in the game’s text', () => {
    expect(WIDGETS.length).toBeGreaterThan(80);
    const w = widget('SpawnOverlayScreen');
    expect(w.asset).toBe('UI/Customize/Screens/SpawnOverlayScreen');
    expect(w.children.length).toBeGreaterThan(0);
    expect(Object.values(w.texts).every((t) => typeof t === 'string')).toBe(true);
    expect(w.bitmaps).toEqual([]);
    expect(widget('NoSuchWidget')).toBeNull();
  });

  it('draws each widget in the game’s own face', () => {
    expect(fontFor('Univers620BoldCondensed30px')).toEqual({ family: 'var(--font-bf-hud)', size: 30, weight: 700 });
    expect(fontFor('Univers520MediumCondensed18px')).toMatchObject({ size: 18, weight: 500 });
    expect(fontFor('Univers720HeavyCondensed48px')).toMatchObject({ size: 48, weight: 800 });
    expect(fontFor('RaxusPrimeNumericalMonospaceRegulart54')).toEqual({ family: 'var(--font-bf-numerals)', size: 54, weight: 400, numeric: 'tabular-nums' });
    expect(fontFor('Roboto18px')).toMatchObject({ family: "'Roboto BF', var(--font-bf-text)", size: 18 });
    expect(fontFor('Mystery')).toMatchObject({ family: 'var(--font-bf-hud)' });
  });

  it('places an element on the game’s 1080 reference, scaled to the screen', () => {
    const br = placeWidget({ anchor: [1, 1], size: [300, 100], offset: [0, 0] }, { width: 1280, height: 720 });
    expect(br.x).toBeCloseTo(1080, 6);
    expect(br.y).toBeCloseTo(720 - 100 * (720 / 1080), 6);
    expect(br.w).toBeCloseTo(200, 6);
    expect(placeWidget({ anchor: [0, 0], size: [100, 100], offset: [10, 20] }, { width: 1920, height: 1080 })).toEqual({ x: 10, y: 20, w: 100, h: 100 });
  });

  it('grows an expanding element with its parent past the parent’s recorded size', () => {
    const el = { size: [256, 256], layout: { fill: true, expansion: [0, 0, 1, 1], position: [0, 0] } };
    expect(placeIn(el, { x: 97, y: 224, w: 504, h: 736, design: [256, 256] }, 1)).toEqual({ x: 97, y: 224, w: 504, h: 736 });
    const half = { size: [1728, 736], layout: { fill: true, expansion: [0.5, 0.5, 0, 0], position: [97, 224] } };
    expect(placeIn(half, { x: 0, y: 0, w: 2120, h: 1080, design: [1920, 1080] }, 1)).toEqual({ x: 197, y: 224, w: 1728, h: 736 });
    // (no design given: as before, the element's own size from the parent's corner)
    expect(placeIn(el, { x: 10, y: 20, w: 504, h: 736 }, 1)).toEqual({ x: 10, y: 20, w: 256, h: 256 });
  });

  it('reads the game’s palette, and nothing past it', () => {
    expect(colour(0)).toBe('rgb(255 255 255)');
    expect(colour(999)).toBeNull();
  });

  it('gives a hero’s portrait from the bitmaps the cut has, and none for one it has not', () => {
    expect(portrait('DarthVader')).toMatch(/^\/ui\/bf2017\/bitmaps\/[a-z0-9-]+\.webp$/);
    expect(portrait('NoSuchHero')).toBeNull();
  });
});
