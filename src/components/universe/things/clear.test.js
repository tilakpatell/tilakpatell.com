import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GARGANTUAN, KINDS, NEBULA_SHOW, THING_KINDS, THING_NEAR, UNIVERSE, discRadius, fullSector } from '../../expanse/shared/gen';
import { FAR, discPx } from '../../expanse/shared/levels';
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
  it('counts the discs over 4 px each kind adds at the baseline poses, for the owner', () => {
    // (the lattice and every list, at 1080 high and the map's 34°; lane 2's four kinds apart)
    const full = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) full.push(fullSector(UNIVERSE, x, y, z));
    const table = {};
    for (const n of names) {
      const p = poseFor(n);
      const row = (table[n] = {});
      for (const sec of full) {
        const core = !sec.sx && !sec.sy && !sec.sz;
        const t = sec.things;
        const add = (kind, at, size) => {
          const r = discRadius(kind, size, { core });
          if (!r) return;
          const d = len(p.at, at);
          if (d > FAR + r) return;
          if (kind === 'beacon' && core) expect(r).toBeLessThanOrEqual(size);
          if (discPx(d, r, { fov: 34, height: 1080 }) > 4) row[kind] = (row[kind] ?? 0) + 1;
        };
        for (let i = 0; i < t.count; i++) add(THING_KINDS[t.kind[i]].kind, [0, 1, 2].map((k) => sec.origin[k] + t.at[3 * i + k]), t.size[i]);
        for (const rs of Object.values(sec.extras)) for (const r of rs) add(r.kind, r.at, r.size);
      }
      for (const v of Object.values(row)) expect(Number.isInteger(v)).toBe(true);
    }
    console.log('DISCS', JSON.stringify(table));
  }, 120000);
  it('builds no lattice thing near: each is over 30 of its sizes off every pose', () => {
    // (the near layer's mesh hand-over is 30 sizes: lane 2's MESH_NEAR; the lattice keeps 31 off every keep-out)
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const sec = fullSector(UNIVERSE, x, y, z, { extras: [] });
          const t = sec.things;
          for (let i = 0; i < t.count; i++) {
            const at = [0, 1, 2].map((k) => sec.origin[k] + t.at[3 * i + k]);
            for (const pt of points) expect(len(pt, at) / t.size[i], `${sec.id} ${THING_KINDS[t.kind[i]].kind}`).toBeGreaterThan(30);
          }
        }
  }, 120000);
});
