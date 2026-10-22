import { describe, expect, it } from 'vitest';
import { FLATS, HALF, LAKE, LOCH, PATHS, cover, heightAt, isWater, noise2, pathAt, shoreAt, slopeAt } from './terrain';
import { CASTLE_FLOOR, placeById } from '../rules/places';

const at = (id) => placeById(id).at;

describe('the grounds’ heights', () => {
  it('are a pure field: the same every read, finite everywhere it is drawn', () => {
    for (let x = -1300; x <= 1300; x += 130)
      for (let z = -1300; z <= 1300; z += 130) {
        const h = heightAt(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(heightAt(x, z)).toBe(h);
      }
  });

  it('read their noise from a table, −1…1, smooth between the corners', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const v = noise2(i * 0.37, i * 0.71, 3);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(-1);
    expect(hi).toBeLessThanOrEqual(1);
    expect(Math.abs(noise2(5.5, 7.25) - noise2(5.5001, 7.25))).toBeLessThan(1e-3);
  });

  it('stand the castle level on its crag, cliffs to the lake below it', () => {
    expect(heightAt(-6, -46)).toBe(CASTLE_FLOOR);
    expect(heightAt(-12, 11)).toBe(CASTLE_FLOOR);
    // (from the cliff’s top over the Great Hall to the water under it, inside fifty metres)
    expect(heightAt(-12, 30) - heightAt(-12, 80)).toBeGreaterThan(CASTLE_FLOOR - 4);
    expect(isWater(-12, 120)).toBe(true);
  });

  it('lay the Black Lake along its spine, deep in the middle, a strand at its edge', () => {
    for (const [x, z] of LOCH.slice(1, -1)) {
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      expect(heightAt(x, z)).toBeLessThan(LAKE - 8);
      expect(shoreAt(x, z)).toBeLessThan(0);
    }
    expect(heightAt(...at('shore'))).toBeGreaterThan(LAKE);
    expect(heightAt(...at('shore'))).toBeLessThan(LAKE + 6);
  });

  it('level what stands on the flats: the pitch at its height, the boathouse’s ledge just over the water', () => {
    const [px, pz] = at('pitch');
    for (const [dx, dz] of [[0, 0], [30, 60], [-30, -60], [40, 0]]) expect(heightAt(px + dx, pz + dz)).toBeCloseTo(8, 1);
    const boat = FLATS.find((f) => f.id === 'boathouse');
    expect(heightAt(...boat.at)).toBeCloseTo(boat.y, 1);
  });

  it('keep every worn way out of the water', () => {
    for (const p of PATHS)
      for (const [x, z] of p.points) {
        expect(heightAt(x, z)).toBeGreaterThan(LAKE + 0.2);
        expect(pathAt(x, z)).toBeLessThan(0);
      }
    expect(pathAt(-600, 600)).toBeGreaterThan(20);
  });

  it('say what the ground is: the forest, the moor, the lawn, rock on the cliffs', () => {
    expect(cover(...at('forest')).forest).toBeGreaterThan(0.8);
    expect(cover(...at('moor')).moor).toBeGreaterThan(0.5);
    expect(cover(...at('lawn')).lawn).toBeGreaterThan(0.6);
    expect(slopeAt(-12, 46)).toBeGreaterThan(1);
    expect(cover(-12, 46).rock).toBeGreaterThan(0.5);
  });

  it('raise the land into hills past the ground’s edge, under the far range', () => {
    let high = 0;
    for (let x = -1200; x <= 1200; x += 100) high = Math.max(high, heightAt(x, -1250));
    expect(high).toBeGreaterThan(120);
  });
});
