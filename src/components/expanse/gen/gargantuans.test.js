import { describe, expect, it } from 'vitest';
import { SECTOR, spaceId } from '../../../lib/space/address.js';
import { KEEP_OUTS, clearOfKeepOuts, keepOutsNear } from './keepOuts';
import { CUBE_HALF } from './cube';
import { beaconsOf, makeSector } from './sector';
import { UNIVERSE, sectorSeedOf, universeOf } from './seed';
import { addBodies } from './systems';
import { fullSector } from './space';
import { PLANET_SIZE } from './catalogue';
import { ARRIVAL_BASE, ARRIVAL_MAX, GARGANTUAN, GARGANTUAN_FORMS, checkGargantuan, formOf, gargantuanKeeps, gargantuanOf, gargantuanSectors, hasGargantuan, residuesOf } from './gargantuans';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const near = (r) => { const out = []; for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) out.push([x, y, z]); return out; };
// (what fullSector hands gargantuanOf: the middle layer's own on sy 0, and above or below it no systems or wonders and the sector's own beacons, space.js's legacy pass)
const legacy = (u, sx, sy, sz) => (sy === 0 ? addBodies(makeSector(u, sx, sz)) : { systems: [], wonders: [], beacons: beaconsOf(sx, sz, sectorSeedOf(u, sx, sy, sz), sy) });

describe('gargantuans', () => {
  it('is in exactly one sector of every 3 × 3 × 3, and never the core', () => {
    for (const u of [UNIVERSE, universeOf('marble'), universeOf('ab')]) {
      expect(residuesOf(u).every((v) => v >= 0 && v < 3)).toBe(true);
      expect(hasGargantuan(u, 0, 0, 0)).toBe(false);
      for (const [cx, cy, cz] of [[0, 0, 0], [1, 0, 0], [-7, 3, 12], [250, -250, 40], [0, -1, 0]]) {
        const n = near(1).filter(([x, y, z]) => hasGargantuan(u, cx + x, cy + y, cz + z)).length;
        expect(n, `${cx},${cy},${cz}`).toBe(1);
      }
    }
    for (let i = 0; i < 40; i++) expect(hasGargantuan(universeOf(`w${i}`), 0, 0, 0)).toBe(false);
  });
  it('tests the far rule against keep-outs that keepOutsNear leaves out', () => {
    expect(keepOutsNear(1, 0, 0)).toEqual([]); // (so a test against it would pass for nothing)
  });
  it('places one in every gargantuan sector near home, far from every hand-made place', () => {
    for (const [sx, sy, sz] of near(4).filter((c) => hasGargantuan(UNIVERSE, ...c))) {
      const g = gargantuanOf(UNIVERSE, sx, sy, sz, legacy(UNIVERSE, sx, sy, sz));
      expect(g, `${sx},${sy},${sz}`).not.toBeNull();
      expect(len(g.at, [0, 0, 0])).toBeGreaterThanOrEqual(GARGANTUAN.home);
      expect(clearOfKeepOuts(g.at, GARGANTUAN.far + g.size, KEEP_OUTS)).toBe(true); // every row, not keepOutsNear's
      for (const s of legacy(UNIVERSE, sx, sy, sz).systems) expect(len(g.at, s.at)).toBeGreaterThanOrEqual(s.reach + g.size + 2000);
      for (const b of Object.values(legacy(UNIVERSE, sx, sy, sz).beacons)) expect(len(g.at, b.at)).toBeGreaterThanOrEqual(3000 + g.size);
      for (let a = 0; a < 3; a++) expect(Math.abs(g.at[a] - [sx, sy, sz][a] * SECTOR)).toBeLessThanOrEqual(CUBE_HALF - g.size);
    }
  });
  it('finds room for it in a pocket universe too, so every 3 × 3 × 3 there has one', () => {
    // (the guarantee rests on the darts never all failing; UNIVERSE alone would test one draw of the residues)
    for (const u of [universeOf('marble'), universeOf('ab')]) {
      const c = near(1).find((x) => hasGargantuan(u, ...x));
      expect(gargantuanOf(u, ...c, legacy(u, ...c)), String(c)).not.toBeNull();
    }
  });
  it('is 20 to 200 planets across, and seen from across a sector', () => {
    for (const [sx, sy, sz] of near(4).filter((c) => hasGargantuan(UNIVERSE, ...c))) {
      const g = gargantuanOf(UNIVERSE, sx, sy, sz, legacy(UNIVERSE, sx, sy, sz));
      expect(g.size / PLANET_SIZE).toBeGreaterThanOrEqual(20);
      expect(g.size / PLANET_SIZE).toBeLessThanOrEqual(200);
      const px = ((2 * Math.atan(g.size / SECTOR)) / ((34 * Math.PI) / 180)) * 1080;
      expect(px).toBeGreaterThanOrEqual(20);
    }
  });
  it('comes in five forms, every one of them within six sectors of home, in each universe', () => {
    // (near(6) holds 81 gargantuan sectors: with five forms equally likely, one is missing about 5 × 0.8^81 ≈ 1e-7 of
    // the time; near(4)'s 27 would miss one about 1% of the time, and a seed that did would have no way out)
    for (const u of [UNIVERSE, universeOf('marble'), universeOf('ab')]) {
      const forms = new Set(near(6).filter((c) => hasGargantuan(u, ...c)).map((c) => formOf(u, ...c)));
      expect([...forms].sort(), String(u)).toEqual([...GARGANTUAN_FORMS].sort());
    }
  });
  it('keeps systems out of it and things off its solid parts, at w3', () => {
    const c = near(1).find((x) => hasGargantuan(UNIVERSE, ...x));
    const s = fullSector(UNIVERSE, ...c);
    const g = s.extras.gargantuan[0];
    expect(g.id).toBe(spaceId(c, { wonder: 3 }));
    for (const sys of s.systems.slice(s.legacy.systems)) expect(len(sys.at, g.at)).toBeGreaterThanOrEqual(g.size + 2000 + sys.reach - 1e-6);
    const keeps = gargantuanKeeps(g);
    for (let i = 0; i < s.things.count; i++) {
      const at = [0, 1, 2].map((k) => s.origin[k] + s.things.at[3 * i + k]);
      expect(clearOfKeepOuts(at, 9 * s.things.size[i], keeps)).toBe(true);
    }
  });
  it('holds the arrival’s at w4, one at most, in the core of the shared universe only, and keeps the core off it', () => {
    expect(ARRIVAL_BASE).toBe(4);
    expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.arrival).toEqual([]);
    expect(fullSector(UNIVERSE, 0, 0, 0, { lattice: false }).extras.gargantuan).toEqual([]);
    const row = checkGargantuan({ kind: 'hole', gargantuan: true, name: 'Test', at: [30000, 0, 30000], size: 4000, body: 400, axis: [0, 1, 0], light: [1, 0, 0], colors: ['#000000', '#ffffff'], seed: 7n });
    const s = fullSector(UNIVERSE, 0, 0, 0, { arrivals: [row] });
    expect(s.extras.arrival[0]).toMatchObject({ id: spaceId([0, 0, 0], { wonder: 4 }), at: row.at });
    for (const sys of s.systems.slice(s.legacy.systems)) expect(len(sys.at, row.at)).toBeGreaterThanOrEqual(row.size + 2000 + sys.reach - 1e-6);
    const keeps = gargantuanKeeps(row);
    for (let i = 0; i < s.things.count; i++) {
      const at = [0, 1, 2].map((k) => s.origin[k] + s.things.at[3 * i + k]);
      expect(clearOfKeepOuts(at, 9 * s.things.size[i], keeps)).toBe(true);
    }
    expect(fullSector(universeOf('marble'), 0, 0, 0, { lattice: false }).extras.arrival).toEqual([]);
    // (at most one a sector, spec C: the core holds no generated one, so the arrival's one is the most it may hold)
    expect(ARRIVAL_MAX).toBe(1);
    expect(() => fullSector(UNIVERSE, 0, 0, 0, { lattice: false, arrivals: [row, { ...row, at: [-30000, 0, 30000] }] })).toThrow(RangeError);
    // (and the arrival's keeps the appended systems off it whatever the options: their ids don't depend on them)
    const sys = (o) => fullSector(UNIVERSE, 0, 0, 0, { arrivals: [row], ...o }).systems.map((x) => [x.id, x.at]);
    expect(sys({ things: false })).toEqual(sys({}));
  });
  it('finds the nearest of a form without making a sector', () => {
    const got = gargantuanSectors(UNIVERSE, [0, 0, 0], { form: 'arc', n: 2 });
    expect(got).toHaveLength(2);
    for (const c of got) expect([hasGargantuan(UNIVERSE, ...c), formOf(UNIVERSE, ...c)]).toEqual([true, 'arc']);
    expect(Math.hypot(...got[0])).toBeLessThanOrEqual(Math.hypot(...got[1]));
  });
  it('checks a row by hand, and passes every generated one', () => {
    const ok = { kind: 'hole', gargantuan: true, name: 'T', at: [1, 2, 3], size: 4000, body: 400, axis: [0, 1, 0] };
    expect(checkGargantuan(ok)).toBe(ok);
    for (const bad of [{ ...ok, kind: 'moon' }, { ...ok, at: [1, NaN, 3] }, { ...ok, size: 10 * PLANET_SIZE }, { ...ok, size: 300 * PLANET_SIZE }, { ...ok, axis: undefined }]) expect(() => checkGargantuan(bad)).toThrow(TypeError);
    for (const c of near(2).filter((x) => hasGargantuan(UNIVERSE, ...x))) expect(() => checkGargantuan(gargantuanOf(UNIVERSE, ...c, legacy(UNIVERSE, ...c)))).not.toThrow();
  });
  it('is the same every time, and a pocket universe’s own', () => {
    const c = near(1).find((x) => hasGargantuan(UNIVERSE, ...x));
    expect(gargantuanOf(UNIVERSE, ...c, legacy(UNIVERSE, ...c))).toEqual(gargantuanOf(UNIVERSE, ...c, legacy(UNIVERSE, ...c)));
    expect(residuesOf(universeOf('marble'))).not.toEqual(residuesOf(UNIVERSE)); // (if it happens to match, pick another word and say so)
  });
});
