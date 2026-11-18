import { beforeAll, describe, expect, it } from 'vitest';
import { KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { pathSpeed, rowAt } from '../paths';
import { UNIVERSE } from '../seed';
import { fullSector } from '../space';
import { NEBULA_SHOW } from './place';
import { CLOUDS } from './clouds';


const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CUBE = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) if (x || y || z) CUBE.push([x, y, z]);
const sectors = [];
beforeAll(() => {
  for (const [x, y, z] of CUBE) sectors.push(fullSector(UNIVERSE, x, y, z, { lattice: false }));
});
const LISTS = ['remnant', 'storm', 'pocket', 'herd', 'debris'];
const middle = (r) => (r.path ? r.path.centre : r.at);

describe('clouds and life between the systems', () => {
  it('makes each list within its count, in every sector round home', () => {
    for (const s of sectors)
      for (const l of LISTS) {
        const n = s.extras[l].length;
        expect(n, `${s.id} ${l}`).toBeLessThanOrEqual(CLOUDS[l].count[1]);
        expect(n, `${s.id} ${l}`).toBeGreaterThanOrEqual(1);
      }
  });
  it('puts one swarm in each pocket, and in a legacy nebula only where it keeps clear of the hand-made places', () => {
    for (const s of sectors) {
      const nebulae = s.wonders.filter((w) => w.kind === 'nebula');
      const sw = s.extras.swarm;
      expect(sw.length).toBeLessThanOrEqual(Math.min(9, s.extras.pocket.length + nebulae.length));
      for (const p of s.extras.pocket) expect(sw.filter((w) => w.nebula === p.id)).toHaveLength(1);
      for (const n of nebulae.slice(0, 9 - s.extras.pocket.length))
        if (!sw.some((w) => w.nebula === n.id)) expect(KEEP_OUTS.some((k) => len(n.at, k.at) < k.r + 9 * 200 + 0.35 * n.size)).toBe(true);
      for (const w of sw) {
        const home = [...s.extras.pocket, ...nebulae].find((n) => n.id === w.nebula);
        for (const t of [0, 3e4, 1e10]) expect(len(rowAt(w, t), home.at)).toBeLessThanOrEqual(0.35 * home.size + 1e-6);
      }
    }
  });
  it('makes none of them in the core', () => {
    const core = fullSector(UNIVERSE, 0, 0, 0, { lattice: false });
    for (const l of [...LISTS, 'swarm']) expect(core.extras[l], l).toEqual([]);
  });
  it('keeps clouds out of sight of every hand-made place, and the rest clear of them, all of KEEP_OUTS', () => {
    for (const s of sectors) {
      for (const r of [...s.extras.pocket, ...s.extras.remnant]) expect(clearOfKeepOuts(r.at, NEBULA_SHOW + r.size, KEEP_OUTS)).toBe(true);
      for (const r of [...s.extras.storm, ...s.extras.herd, ...s.extras.debris, ...s.extras.swarm]) expect(clearOfKeepOuts(middle(r), 9 * r.size + (r.extent ?? 0), KEEP_OUTS)).toBe(true);
    }
  });
  it('lets no two overlap, a swarm in its own nebula aside', () => {
    for (const s of sectors) {
      const rows = LISTS.flatMap((l) => s.extras[l]);
      for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++) expect(len(middle(rows[i]), middle(rows[j]))).toBeGreaterThanOrEqual(rows[i].size + (rows[i].extent ?? 0) + rows[j].size + (rows[j].extent ?? 0) - 1e-6);
    }
  });
  it('drifts storms and herds slowly, and colours the clouds from the palette', () => {
    for (const s of sectors) {
      for (const r of s.extras.storm) expect(pathSpeed(r.path)).toBeLessThan(2.5);
      for (const r of s.extras.herd) expect(pathSpeed(r.path)).toBeLessThan(4);
      for (const r of [...s.extras.pocket, ...s.extras.remnant]) {
        expect(r.colors).toHaveLength(2);
        expect(r.colors[0]).not.toBe(r.colors[1]);
        for (const c of r.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
        expect(['cloud', 'shell']).toContain(r.form);
      }
    }
  });
  it('numbers them at their low ids, as plain data', () => {
    const s = sectors.find((x) => x.id === 'E:1,0');
    expect(s.extras.pocket[0].id).toBe('E:1,0:w22');
    expect(s.extras.swarm[0].id).toBe('E:1,0:w28');
    expect(s.extras.debris[0].id).toBe('E:1,0:w40');
    for (const l of [...LISTS, 'swarm']) expect(structuredClone(s.extras[l])).toEqual(s.extras[l]);
  });
});
