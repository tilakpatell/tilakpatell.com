import { describe, expect, it } from 'vitest';
import { ROAD_MILES } from './geography';
import { STOPS } from './road';
import { placeAt } from './sheet';

describe('the road the Ring took', () => {
  it('has a stop for each of the road’s places, in its order', () => {
    expect(STOPS.map((s) => s.id)).toEqual(Object.keys(ROAD_MILES));
    for (const s of STOPS) {
      expect([s.x, s.y], s.id).toEqual(placeAt(s.id));
      expect(s.name && s.text, s.id).toBeTruthy();
    }
  });
  it('runs east from Hobbiton to the Black Gate, then south into the Ephel Dúath and east to the Mountain', () => {
    const gate = STOPS.findIndex((s) => s.id === 'black-gate');
    for (let i = 1; i <= gate; i++) expect(STOPS[i].x, STOPS[i].id).toBeGreaterThan(STOPS[i - 1].x);
    const [g, c, d] = STOPS.slice(gate);
    expect(c.y).toBeGreaterThan(g.y);
    expect(d.x).toBeGreaterThan(c.x);
  });
});
