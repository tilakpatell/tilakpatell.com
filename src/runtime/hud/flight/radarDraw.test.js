import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drawRadar } from './radarDraw';

// (Node has no canvas: a stand-in context that counts the dots drawn, each an arc of 2.6 or 3.6 round)
const canvas = () => {
  const dots = [];
  const g = new Proxy({}, { get: (_, k) => (k === 'arc' ? (x, y, r) => r < 4 && dots.push([x, y]) : () => {}), set: () => true });
  return { dots, width: 0, height: 0, clientWidth: 100, getContext: () => g };
};
const point = (x, y) => ({ id: 'a', kind: 'hostile', x, y, up: 0, rim: false, lock: false });

describe('drawRadar', () => {
  const was = globalThis.getComputedStyle;
  beforeEach(() => {
    globalThis.getComputedStyle = () => ({ fontFamily: 'monospace' });
  });
  afterEach(() => {
    globalThis.getComputedStyle = was;
  });

  it('draws only the points in use, not the ones left in the list from a busier tick', () => {
    const cv = canvas();
    const points = [point(0.1, 0.1), point(0.2, 0.2), point(0.3, 0.3)];
    points.n = 1;
    drawRadar(cv, points, { range: 40, dpr: 1 });
    expect(cv.dots).toHaveLength(1);
  });
  it('sizes the canvas by its own box and the pixel ratio', () => {
    const cv = canvas();
    drawRadar(cv, [], { range: 160, dpr: 2 });
    expect(cv.width).toBe(200);
  });
});
