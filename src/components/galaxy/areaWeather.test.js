import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAreaWeather } from './areaWeather';

const data = { glows: [[0, 0, 0, 1, 0.5, 0.2, 20]], blinkers: [[53.3, 0, 0]], strikes: [[0, 1000, 0]], clouds: [[0, 2000, 0]] };
const frame = (p) => p.map((x) => x / 53.3);

describe('the storm in a level’s area', () => {
  it('draws the level’s lamps, beacons and clouds, and the rain, each in one draw', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const w = createAreaWeather(group, { data, frame, at: [0, 0, 0], sea: -20, rand: () => 0.5 });
    expect(group.children.filter((o) => o.isPoints)).toHaveLength(3);
    expect(scene.children.some((o) => o.isLineSegments)).toBe(true);
    w.dispose();
    expect(group.children).toHaveLength(0);
    expect(scene.children.filter((o) => o.isLineSegments)).toHaveLength(0);
  });

  it('strikes where the level does, from the clouds to the sea, its flash gone within half a second', () => {
    const group = new THREE.Group();
    const w = createAreaWeather(group, { data, frame, at: [0, 0, 0], sea: -20, rand: () => 0.5 });
    w.strike(0);
    w.update(0.04, 0, null);
    expect(w.flash).toBeGreaterThan(0.8);
    expect(w.strikeAt).toEqual([0, 1000 / 53.3, 0]);
    const bolt = group.children.find((o) => o.isLineSegments);
    expect(bolt.visible).toBe(true);
    const ys = Array.from(bolt.geometry.attributes.position.array).filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(-20, 5);
    expect(Math.max(...ys)).toBeGreaterThan(1000 / 53.3);
    for (let i = 0; i < 20; i++) w.update(0.05, i * 0.05, null);
    expect(w.flash).toBe(0);
    expect(bolt.visible).toBe(false);
  });
});
