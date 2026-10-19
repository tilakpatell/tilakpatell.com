import { describe, expect, it } from 'vitest';
import { CORE, REGIONS, edgeAt } from './systems';
import { LETTER_SPACING, REGION_FONT, clashesAt, regionAngle, regionInset, regionNamesShown, regionTurn, unknownNameX } from './regionNames';
import { FRAME } from './mapView';

const unit = (box, k = 1) => (box * k) / FRAME.size; // (screen px per map unit, as HoloMap.jsx has it)
const ids = (box, k) => REGIONS.slice(1).map((r) => r.id).filter((id) => regionNamesShown(REGIONS, unit(box, k)).has(id));

describe('regionNames: which of the regions’ names have room', () => {
  it('shows only the wide outer rings’ names on a 617 px map that’s fitted', () => {
    // (the inner rings are 0.4 to 0.5 units, 12 to 15 px, apart: their names would sit on each other)
    expect(ids(617, 1)).toEqual(['mid', 'outer']);
  });
  it('shows them all at k=3, and each name that shows stays showing as you zoom in', () => {
    expect(ids(617, 3)).toEqual(REGIONS.slice(1).map((r) => r.id));
    for (const box of [340, 617, 900]) {
      let was = new Set();
      for (let k = 1; k <= 8; k *= 1.25) {
        const now = regionNamesShown(REGIONS, unit(box, k));
        for (const id of was) expect(now.has(id), `${id} at ${box} px, k=${k.toFixed(2)}`).toBe(true);
        was = now;
      }
    }
  });
  it('counts the space between the letters of a name along its ring: a letter is 0.62 em and 0.18 more', () => {
    expect(LETTER_SPACING).toBe(0.18);
    // the outer ring's name, at the width it needs (0.9 of its letters', each 0.8 em), shows just above it and not just under
    const i = REGIONS.findIndex((r) => r.id === 'outer');
    const r = REGIONS[i];
    const px = (0.9 * r.name.length * REGION_FONT * 0.8) / edgeAt(r.r, regionAngle(i));
    expect(regionNamesShown(REGIONS, px * 1.02).has('outer')).toBe(true);
    expect(regionNamesShown(REGIONS, px * 0.98).has('outer')).toBe(false);
  });
  it('shows no names where the map has no size', () => {
    expect(regionNamesShown(REGIONS, 0).size).toBe(0);
    expect(regionNamesShown(REGIONS, NaN).size).toBe(0);
  });
  it('never shows the Deep Core’s, which has no name on the map', () => {
    expect(regionNamesShown(REGIONS, unit(900, 8)).has('deep')).toBe(false);
  });
  it('sets every name clear of the systems’ dots and names, at the zoom it first shows at, and the right way up along its ring', () => {
    // (the Mid Rim's ran through Yavin 4's name, and the Inner Rim's through Mandalore's: each is where it was, or the nearest
    // angle to it that's clear)
    for (let i = 1; i < REGIONS.length; i++) expect(clashesAt(REGIONS, i, regionAngle(i)), REGIONS[i].id).toBe(0);
    // (MapSvg.jsx turns a name by regionTurn: under a quarter turn either way reads upright, in the south half as in the north)
    const upright = (t) => Math.abs(((t + 540) % 360) - 180) < 90;
    for (let i = 1; i < REGIONS.length; i++) expect(upright(regionTurn(regionAngle(i))), REGIONS[i].id).toBe(true);
    for (const d of [-150, -90, -30, 30, 90, 150]) expect(upright(regionTurn((d * Math.PI) / 180)), `${d}°`).toBe(true);
    // (and its letters inside its ring either way: the baseline further in where they stand up from it)
    expect(regionInset(-Math.PI / 2)).toBeGreaterThan(regionInset(Math.PI / 2));
  });
});

describe('the Unknown Regions’ name', () => {
  // (its left edge on screen, from the map's: mapView.js's square starts FRAME.x0 in)
  const left = (box) => (unknownNameX(unit(box), REGION_FONT, FRAME.x0) - FRAME.x0) * unit(box) - (15 * REGION_FONT * 0.62) / 2;
  it('is where it always was, out west, on a map with the room for it', () => {
    expect(unknownNameX(unit(800), REGION_FONT, FRAME.x0)).toBeCloseTo(CORE[0] - 9.3);
    expect(left(800)).toBeGreaterThan(18);
  });
  it('is kept in off the map’s edge on a phone’s', () => {
    for (const box of [340, 390, 403, 500]) expect(left(box), `${box} px`).toBeGreaterThanOrEqual(18 - 1e-6);
  });
});
