import { describe, expect, it } from 'vitest';
import golden from './fixtures/nav.json';
import { differs, lines } from './fixtures/golden.js';
import { navGrid } from './fixtures/navGrid.js';
import { NAV_STATUS, canGoStraight, closestPoint, findArea, findPath, findReachableRandomPosition, findReachableSnappedPosition, isPointReachableFromPoint, loadNavPackage, navFromMesh } from './navMesh.js';

const f = Math.fround;

// bf2-web's nav driver (WebPort/ai/nav-driver.cpp) played through the JavaScript
function pathRecord(nav, start, end) {
  const { ok, points, stats } = findPath(nav, start, end);
  let straight = 0;
  let segments = 0;
  for (let i = 3; i < points.length; i += 3, segments++) if (canGoStraight(nav, points.slice(i - 3, i), points.slice(i, i + 3)).ok) straight++;
  return {
    path: {
      ok, start: start.map(f), end: end.map(f), expanded: stats.expanded, corridor: stats.corridor, points: stats.points, length: stats.length,
      startArea: stats.startArea, endArea: stats.endArea, snappedStart: stats.snappedStart, snappedEnd: stats.snappedEnd, partial: stats.partial,
      segments, straightSegments: straight, xyz: points,
    },
  };
}

function replay(nav, script) {
  const out = [{ nav: { areas: nav.areaCount, edges: nav.edgeCount, components: nav.componentCount } }];
  for (const [verb, ...w] of lines(script)) {
    const n = w.map(Number);
    if (verb === 'closest') {
      const c = closestPoint(nav, n.slice(0, 3), n[3]);
      out.push({ closest: { area: c.area, point: c.area < 0 ? [0, 0, 0] : c.point } });
    } else if (verb === 'area') out.push({ area: findArea(nav, n.slice(0, 3), n[3]) });
    else if (verb === 'path') out.push(pathRecord(nav, n.slice(0, 3), n.slice(3, 6)));
    else if (verb === 'straight') {
      const s = canGoStraight(nav, n.slice(0, 3), n.slice(3, 6));
      out.push({ straight: { ok: s.ok, collision: s.collision } });
    } else if (verb === 'random' || verb === 'pairs') {
      const rng = { seed: n[0] || 1 };
      const count = n[1];
      const start = verb === 'random' ? n.slice(2, 5) : null;
      const [center, radius] = verb === 'random' ? [n.slice(5, 8), n[8]] : [n.slice(2, 5), n[5]];
      for (let i = 0; i < count; i++) {
        if (verb === 'random') {
          const p = findReachableRandomPosition(nav, start, center, radius, rng);
          out.push({ random: { ok: !!p, point: p ?? [0, 0, 0] } });
        } else {
          const a = findReachableRandomPosition(nav, center, center, radius, rng);
          const b = a && findReachableRandomPosition(nav, a, center, radius, rng);
          out.push(a && b ? pathRecord(nav, a, b) : { path: { ok: 0, reason: 'no random position' } });
        }
      }
    } else throw new Error(`unknown verb ${verb}`);
  }
  return out;
}

describe('the planner, against bf2-web', () => {
  it('answers every query the native driver answered on the grid, to the float', () => {
    const { script, records } = golden.scenarios.grid;
    expect(differs(records, replay(navFromMesh(navGrid()), script))).toBeNull();
  });
});

describe('the planner, by hand', () => {
  const nav = navFromMesh(navGrid());

  it('finds two islands on the grid, the east one cut off', () => {
    expect(nav.componentCount).toBe(2);
    expect(isPointReachableFromPoint(nav, [2, 0.2, 2], [30, 3, 30])).toBe(true);
    expect(isPointReachableFromPoint(nav, [2, 0.2, 2], [44, 4, 10])).toBe(false);
  });

  it('paths round a wall, every leg on the mesh, and as near as it can to the island', () => {
    const round = findPath(nav, [14, 1.2, 14], [22, 1.8, 14]);
    expect(round.ok).toBe(true);
    expect(round.stats.points).toBeGreaterThan(2);
    const partial = findPath(nav, [2, 0.2, 2], [44, 4, 10]);
    expect(partial.stats.partial).toBe(true);
    expect(partial.points.at(-3)).toBeLessThan(40);
  });

  it('stops a straight line at the wall it meets', () => {
    const s = canGoStraight(nav, [2, 0.2, 10], [26, 2, 10]);
    expect(s.ok).toBe(false);
    expect(s.collision[0]).toBeCloseTo(16, 3);
  });

  it('snaps a destination to the nearest reachable point', () => {
    const p = findReachableSnappedPosition(nav, [2, 0.2, 2], [18, 0, 10], 5);
    expect(p[0]).toBeCloseTo(16, 3);
    expect(findReachableSnappedPosition(nav, [2, 0.2, 2], [44, 4, 10], 2)).toBeNull();
  });

  it('reads bf2-web’s package and refuses a broken one by name', () => {
    expect(loadNavPackage(new Uint8Array(4)).status).toBe(NAV_STATUS.truncated);
    expect(loadNavPackage(new Uint8Array(32)).status).toBe(NAV_STATUS.magic);
  });
});
