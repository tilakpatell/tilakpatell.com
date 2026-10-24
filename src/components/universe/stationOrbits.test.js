import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ORDER, POSITIONS } from './layout';
import { byId } from './universes';
import { orbits } from './stationOrbits';

const STATIONS = ORDER.filter((id) => byId(id).kind === 'core');

describe('the stations’ orbits', () => {
  it('draws one faint circle a station round the sun, at its distance and height, in one draw', () => {
    const lines = orbits();
    expect(lines).toBeInstanceOf(THREE.LineSegments);
    expect(STATIONS.length).toBeGreaterThan(0);
    const at = lines.geometry.getAttribute('position');
    // (160 segments a circle, two ends each)
    expect(at.count).toBe(STATIONS.length * 160 * 2);
    STATIONS.forEach((id, i) => {
      const [x, y, z] = POSITIONS[id];
      const R = Math.hypot(x, z);
      for (let k = i * 320; k < (i + 1) * 320; k++) {
        expect(Math.hypot(at.getX(k), at.getZ(k))).toBeCloseTo(R, 2);
        expect(at.getY(k)).toBeCloseTo(y, 4);
      }
    });
    expect(lines.material.opacity).toBe(0.05);
    expect(lines.material.transparent).toBe(true);
    expect(lines.material.depthWrite).toBe(false);
    expect(`#${lines.material.color.getHexString()}`).toBe('#9fb0d0');
  });
});
