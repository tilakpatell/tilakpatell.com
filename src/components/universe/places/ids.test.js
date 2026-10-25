import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FROM, SIDE_EFFECT, uncomment } from '../../../../scripts/health/graph.mjs';
import { moonAt, orbitAt } from '../../expanse/shared/orbits';
import { atTime, canonicalPlace, isPlaceId } from './ids';

const importsOf = (p) => {
  const code = uncomment(readFileSync(new URL(p, import.meta.url), 'utf8'));
  return [...code.matchAll(FROM), ...code.matchAll(SIDE_EFFECT)].map((m) => m[2]).sort();
};

// (rows shaped as the generator makes them, by hand, so these need no sector)
const planet = { id: 'E:2,-1:4:0', at: [240300, 12, -119500], centre: [240000, 0, -120000], revs: 7 };
const moon = { id: 'E:2,-1:4:0:1', orbit: 30, phase: 1.1, revs: 40, tilt: 0.3, radius: 3 };
const rock = { id: 'E:2,-1:w70', at: [241000, 500, -118000], size: 40 };

describe('generated ids, and where a place is', () => {
  it('stands apart from the generator: only the address and the light face', () => {
    expect(importsOf('./ids.js')).toEqual(['../../../lib/space/address.js', '../../expanse/shared/orbits']);
  });
  it('keeps the resolver off React, the DOM and three.js', () => {
    expect(importsOf('./resolve.js').filter((p) => /react|three|scene|document/.test(p))).toEqual([]);
  });
  it('writes one form for every spelling, and none for an id that wouldn’t read back', () => {
    expect(canonicalPlace('e:-0,01:007')).toBe('E:0,1:7');
    expect(canonicalPlace('E:2,-1,0:4:0:1')).toBe('E:2,-1:4:0:1');
    expect(canonicalPlace('e:2,-1,-3:w10004')).toBe('E:2,-1,-3:w10004');
    const huge = `E:${'9'.repeat(400)},0:0`; // (a number past what a double holds exactly)
    expect(canonicalPlace(huge)).toBeNull();
    expect(isPlaceId(huge)).toBe(false);
    for (const id of ['E:1,0:0', 'e:1,0,0:w3', 'E:1,0:0:1:2']) {
      expect(isPlaceId(id), id).toBe(true);
      expect(canonicalPlace(canonicalPlace(id))).toBe(canonicalPlace(id));
    }
  });
  it('puts a planet on its orbit, a moon round its planet, a mover where it says and the rest where they are', () => {
    expect(atTime({ place: 'planet', src: { row: planet } }, 1234.5)).toEqual(orbitAt(planet, 1234.5));
    expect(atTime({ place: 'moon', src: { row: moon, planet } }, 99)).toEqual(moonAt(moon, planet, 99));
    const drift = (row, t) => [row.at[0] + t, row.at[1], row.at[2]];
    expect(atTime({ place: 'thing', move: drift, src: { row: rock } }, 5)).toEqual([241005, 500, -118000]);
    expect(atTime({ place: 'thing', move: null, src: { row: rock } }, 5)).toEqual(rock.at);
  });
  it('writes into an array it’s handed, so a frame’s carry makes none', () => {
    const drift = (row, t) => [row.at[0] + t, row.at[1], row.at[2]];
    const places = [
      [{ place: 'planet', src: { row: planet } }, orbitAt(planet, 77)],
      [{ place: 'moon', src: { row: moon, planet } }, moonAt(moon, planet, 77)],
      [{ place: 'thing', move: drift, src: { row: rock } }, [241077, 500, -118000]],
      [{ place: 'thing', src: { row: rock } }, rock.at],
    ];
    for (const [place, want] of places) {
      const out = [0, 0, 0];
      expect(atTime(place, 77, out)).toBe(out);
      expect(out).toEqual(want);
    }
    expect(atTime({ place: 'thing', src: {} }, 77, [0, 0, 0])).toBeNull();
  });
  it('hands back a position of its own, so the generator’s rows stay as they are', () => {
    const at = atTime({ place: 'thing', src: { row: rock } }, 0);
    at[0] = 0;
    expect(rock.at[0]).toBe(241000);
  });
});
