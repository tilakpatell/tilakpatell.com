import { describe, expect, it } from 'vitest';
import { SPURS } from './spurs';
import { CORE, LANES, RIM } from './systems';
import { ROUTES, laneGraph, routeBetween, viaLanes } from './routes';
import { NEIGHBOURS } from './gcwRules';

describe('the lesser routes', () => {
  it('each has a name, an id of its own and points on the disc', () => {
    const ids = ROUTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SPURS) {
      expect(LANES.map((l) => l.id), s.id).not.toContain(s.id);
      expect(typeof s.name).toBe('string');
      expect(s.pts.length, s.id).toBeGreaterThanOrEqual(2);
      for (const [x, z] of s.pts) expect(Math.hypot(x - CORE[0], z - CORE[1]), s.id).toBeLessThan(RIM);
    }
  });

  it('meet the great routes, so every course can use them', () => {
    const { nodes, edges } = laneGraph();
    // (one web: laneGraph's own test walks it; here, each spur has a node another route shares)
    for (const s of SPURS) {
      const mine = new Set(edges.filter((e) => e.lane === s.id).flatMap((e) => [e.a, e.b]));
      expect([...mine].some((n) => nodes[n].lanes.length > 1), s.id).toBe(true);
    }
  });

  it('take the charted worlds on them where the atlas has them', () => {
    expect(routeBetween('mygeeto', 'coruscant').lanes).toContain('braxant');
    expect(routeBetween('ordmantell', 'coruscant').lanes).toContain('celanon');
    expect(routeBetween('eadu', 'kessel').onLane).toBe(true);
    expect(viaLanes(routeBetween('eadu', 'tatooine'))).toContain('the Triellus Trade Route');
  });

  it('add ways to fly, not fronts: the war still runs along the great routes alone', async () => {
    // (gcwRules.js's neighbours read LANES, never the spurs: a front from Tatooine to Kessel would be the Triellus's)
    expect(NEIGHBOURS.tatooine).not.toContain('kessel');
  });
});
