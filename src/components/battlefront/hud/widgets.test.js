import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { REF, heatColour, markerProjection, meterThirds, offerRows, placeWidget } from './widgets.js';

describe('the game’s widgets, placed and filled', () => {
  it('anchors a bottom-right widget to the viewport’s bottom right, scaled by the shorter side', () => {
    const s = 720 / REF[1];
    const box = placeWidget({ anchor: [1, 1], size: [256, 128], offset: [-40, -20] }, { w: 1280, h: 720 });
    expect(box.w).toBeCloseTo(256 * s, 6);
    expect(box.h).toBeCloseTo(128 * s, 6);
    expect(box.x).toBeCloseTo(1280 - 256 * s - 40 * s, 6);
    expect(box.y).toBeCloseTo(720 - 128 * s - 20 * s, 6);
    const top = placeWidget({ anchor: [0.5, 0], size: [600, 160], offset: [0, 55] }, { w: 1920, h: 1080 });
    expect(top).toEqual({ x: 660, y: 55, w: 600, h: 160 });
  });

  it('fills a capture meter by thirds', () => {
    expect(meterThirds(0)).toEqual([0, 0, 0]);
    expect(meterThirds(0.5)).toEqual([1, 1, 0]);
    expect(meterThirds(1)).toEqual([1, 1, 1]);
  });

  it('turns the heat red past the weapon’s warning', () => {
    const colours = { normal: '#fff', warning: '#f00' };
    expect(heatColour(0.5, 0.75, colours)).toBe('#fff');
    expect(heatColour(0.9, 0.75, colours)).toBe('#f00');
  });

  it('orders the deploy offers classes, then reinforcements, then heroes, and marks what can be had', () => {
    const rows = offerRows(
      [
        { kind: 'hero', id: 'vader', cost: 6000 },
        { kind: 'class', id: 'd-orig-heavy', cost: 0 },
        { kind: 'reinforcement', id: 'deathtrooper', cost: 2000 },
        { kind: 'class', id: 'd-orig-assault', cost: 0 },
        { kind: 'hero', id: 'boba', cost: 4000, available: false },
      ],
      3000,
    );
    expect(rows.map((r) => r.id)).toEqual(['d-orig-heavy', 'd-orig-assault', 'deathtrooper', 'vader', 'boba']);
    expect(rows.map((r) => r.affordable)).toEqual([true, true, true, false, false]);
  });

  it('projects a marker to the screen, or to its edge with the way to turn', () => {
    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, 10);
    camera.updateMatrixWorld();
    const ahead = markerProjection([0, 0, 10], camera, { w: 1600, h: 900 });
    expect(ahead.onScreen).toBe(true);
    expect(ahead.x).toBeCloseTo(800, 3);
    expect(ahead.y).toBeCloseTo(450, 3);
    const behind = markerProjection([0, 0, -10], camera, { w: 1600, h: 900 });
    expect(behind.onScreen).toBe(false);
    expect(Number.isFinite(behind.edgeAngle)).toBe(true);
    // (looking down +Z, the camera's right is −X: a thing behind and to the right goes on the right edge)
    expect(markerProjection([-5, 0, -10], camera, { w: 1600, h: 900 }).x).toBeGreaterThan(800);
    expect(markerProjection([5, 0, -10], camera, { w: 1600, h: 900 }).x).toBeLessThan(800);
  });
});
