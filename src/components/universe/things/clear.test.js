import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GARGANTUAN, KINDS, NEBULA_SHOW, THING_NEAR, UNIVERSE, fullSector } from '../../expanse/shared/gen';
import { poseFor } from '../poses';

// Every baseline pose (lab/universe/baseline/mid.json's) stays as it was: no list row of lane
// 4a's is built near one, and no cloud is drawn there. Over the 27 sectors round home.
const names = Object.keys(JSON.parse(readFileSync(new URL('../../../../lab/universe/baseline/mid.json', import.meta.url), 'utf8')).poses);
const points = names.flatMap((n) => {
  const p = poseFor(n);
  return [p.at, p.eye].filter(Boolean);
});
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rows = [];
beforeAll(() => {
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) rows.push(...Object.values(fullSector(UNIVERSE, x, y, z, { lattice: false }).extras).flat());
});

describe('the baseline poses', () => {
  it('has a point for every pose', () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
    expect(points.length).toBeGreaterThanOrEqual(names.length);
  });
  it('sees no cloud drawn, and builds no thing near', () => {
    expect(rows.length).toBeGreaterThan(100);
    for (const pt of points)
      for (const r of rows) {
        if (r.kind === 'pocket' || r.kind === 'remnant') expect(len(pt, r.at), r.id).toBeGreaterThan(NEBULA_SHOW + r.size);
        else if (KINDS[r.kind]?.near) {
          const mid = r.path ? (r.path.focus ?? r.path.centre) : r.at;
          expect(len(pt, mid), r.id).toBeGreaterThan(THING_NEAR * r.size + (r.extent ?? 0));
        }
      }
  });
  it('builds no gargantuan’s mesh: each is the far plane and its size off', () => {
    const big = rows.filter((r) => r.gargantuan && r.id.endsWith(':w3'));
    expect(big).toHaveLength(1); // (one in the 3 × 3 × 3 round home)
    for (const pt of points) for (const g of big) expect(len(pt, g.at)).toBeGreaterThanOrEqual(GARGANTUAN.far + g.size);
  });
});
