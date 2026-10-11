import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CELL_TRIS, COARSE, CELL_KB, IMPOSTOR_BYTES, coarseKey, horizonCells, impostorsOf, lastFile } from './bf2017-horizon.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
// Hoth's pack as main has it (level.json is committed; its horizon.bin, 7.5 KB, is the fixture)
const pack = JSON.parse(readFileSync(join(ROOT, 'public/models/galaxy/bf2017/levels/hoth/level.json'), 'utf8'));
const horizon = new Uint8Array(readFileSync(join(ROOT, 'scripts/fixtures/bf2017/horizon/hoth-horizon.bin'))).buffer;

describe('lastFile', () => {
  it('is the coarsest shipped LOD', () => {
    expect(lastFile({ glb: ['a', null, 'c', null], lods: [100, 50, 25, 12] })).toEqual({ glb: 'c', lod: 2, tris: 25 });
    expect(lastFile({ glb: [null], lods: [1] })).toBeNull();
  });
});

describe('impostorsOf', () => {
  it('picks the repeated compact props on Hoth, a few at most', () => {
    const list = impostorsOf(pack);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(4);
    for (const i of list) {
      expect(pack.meshes[i].radius).toBeGreaterThanOrEqual(1);
      expect(pack.meshes[i].radius).toBeLessThanOrEqual(8);
    }
    // (the snow piles, 542 of them at 391 triangles, are the heaviest)
    expect(pack.meshes[list[0]].name).toMatch(/snowpile_medium_08/);
  });

  it('leaves a flat board of few triangles out, however many there are', () => {
    expect(
      impostorsOf(pack)
        .map((i) => pack.meshes[i].name)
        .join(),
    ).not.toMatch(/floorboards/);
  });

  it('takes none from a pack with no repeats', () => {
    expect(
      impostorsOf({
        meshes: [{ radius: 2, glb: ['a'], lods: [100] }],
        far: { draws: [{ mesh: 0, count: 3 }] },
      }),
    ).toEqual([]);
  });
});

describe('horizonCells on Hoth', () => {
  const cells = horizonCells(pack, { horizon });

  it('cuts the 2 km arena into its 16 coarse cells, and places the horizon beyond', () => {
    const arena = Object.keys(cells).filter((k) => k.split(',').every((c) => Math.abs(Number(c) + 0.5) <= 2));
    expect(arena).toHaveLength(16);
    expect(Object.keys(cells).length).toBeGreaterThan(16);
  });

  it('holds every cell under 400 KB by estimate', () => {
    for (const c of Object.values(cells)) expect(c.bytes).toBeLessThanOrEqual(CELL_KB * 1000);
  });

  it('keeps small things for the fine path and the impostors’ props out of the proxies', () => {
    const imp = new Set(impostorsOf(pack));
    for (const c of Object.values(cells)) {
      for (const p of c.proxies) {
        expect(pack.meshes[p.mesh].radius).toBeGreaterThanOrEqual(1.5);
        expect(imp.has(p.mesh)).toBe(false);
      }
      for (const i of c.impostors) expect(imp.has(i.mesh)).toBe(true);
    }
  });

  it('simplifies a full cell’s merge to its triangle target', () => {
    const base = cells['-1,0'];
    expect(base.ratio).toBeLessThan(1);
    expect(base.tris).toBeLessThanOrEqual(CELL_TRIS);
    expect(base.tris).toBeGreaterThan(CELL_TRIS * 0.95);
    const sparse = Object.values(cells).find((c) => c.proxies.length === 1);
    expect(sparse.ratio).toBe(1);
  });

  it('drops the smallest first past the cap', () => {
    const tight = horizonCells(pack, { horizon }, { kb: 20, cellTris: 1e9 });
    const all = horizonCells(pack, { horizon }, { kb: 1e6, cellTris: 1e9 });
    const key = Object.keys(all).sort((a, b) => all[b].proxies.length - all[a].proxies.length)[0];
    expect(tight[key].bytes).toBeLessThanOrEqual(20000);
    const kept = Math.min(...tight[key].proxies.map((p) => p.r));
    const gone = all[key].proxies.filter((p) => !tight[key].proxies.some((q) => q.table === p.table && q.index === p.index));
    expect(gone.length).toBeGreaterThan(0);
    expect(Math.max(...gone.map((p) => p.r))).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
    expect(tight[key].impostors.length * IMPOSTOR_BYTES).toBeLessThanOrEqual(tight[key].bytes);
  });

  it('keys a place by its 512 m cell', () => {
    expect(COARSE).toBe(512);
    expect(coarseKey(-1, 511)).toBe('-1,0');
    expect(coarseKey(1023, -1024)).toBe('1,-2');
  });
});
