import { beforeAll, describe, expect, it } from 'vitest';
import { HOME_KEEP, KEEP_OUTS, clearOfKeepOuts } from '../keepOuts';
import { pathSpeed, rowAt } from '../paths';
import { UNIVERSE } from '../seed';
import { fullSector, placeOf } from '../space';
import { COMET, FIELD, tailOf } from './systems';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const CUBES = [[1, 0, 0], [2, 0, 0], [1, 1, 0], [0, 0, 0]];
const sectors = [];
beforeAll(() => {
  for (const [x, y, z] of CUBES) sectors.push(fullSector(UNIVERSE, x, y, z));
});
const all = (list) => sectors.flatMap((s) => s.extras[list]);
const systems = () => sectors.flatMap((s) => s.systems);

describe('fields round the systems', () => {
  it('gives one system in three a field, three in ten of them ice', () => {
    const f = all('field');
    const share = f.length / systems().length;
    expect(share).toBeGreaterThanOrEqual(0.25);
    expect(share).toBeLessThanOrEqual(0.4);
    const ice = f.filter((x) => x.kind === 'icefield').length / f.length;
    expect(ice).toBeGreaterThanOrEqual(0.18);
    expect(ice).toBeLessThanOrEqual(0.42);
  });
  it('sits each at its system’s edge, near its height, clear of the hand-made places and the other systems', () => {
    for (const s of sectors)
      for (const f of s.extras.field) {
        const sys = s.systems.find((x) => x.id === f.system);
        const d = len(f.at, sys.at);
        expect(d).toBeGreaterThanOrEqual(1.15 * sys.reach - 1e-6);
        expect(d).toBeLessThanOrEqual(Math.hypot(1.6 * sys.reach, FIELD.height) + 1e-6);
        expect(Math.abs(f.at[1] - sys.at[1])).toBeLessThanOrEqual(FIELD.height);
        expect(clearOfKeepOuts(f.at, 9 * f.size)).toBe(true);
        for (const o of s.systems) if (o !== sys) expect(len(f.at, o.at)).toBeGreaterThanOrEqual(o.reach + f.size);
      }
  });
});

describe('comets', () => {
  it('gives about one system in four a comet, slow enough to park at', () => {
    const c = all('comet');
    const share = c.length / systems().length;
    expect(share).toBeGreaterThanOrEqual(0.12);
    expect(share).toBeLessThanOrEqual(0.3);
    for (const x of c) expect(pathSpeed(x.path)).toBeLessThan(COMET.fast);
  });
  it('keeps each on its ellipse, clear of every other system, its tail longest at perihelion', () => {
    for (const s of sectors)
      for (const c of s.extras.comet) {
        expect(rowAt(c, 0)).toEqual(c.at);
        const Q = (c.path.q * (1 + c.path.e)) / (1 - c.path.e);
        expect(c.extent).toBeCloseTo(Q, 6);
        for (let i = 0; i < 64; i++) {
          const at = rowAt(c, (i / 64) * c.path.period);
          const r = len(at, c.star);
          expect(r).toBeGreaterThanOrEqual(c.path.q - 1e-6);
          expect(r).toBeLessThanOrEqual(Q + 1e-6);
          let gap = Infinity;
          for (const o of s.systems) if (o.id !== c.system) gap = Math.min(gap, len(at, o.at) - c.tail - o.reach);
          expect(gap).toBeGreaterThanOrEqual(-1e-6);
        }
        const peri = c.path.phase === 0 ? 0 : (1 - c.path.phase) * c.path.period;
        expect(tailOf(c, peri).length).toBeCloseTo(c.tail, 6);
      }
  });
  it('shortens a tail far out to 0.15 of it', () => {
    const c = all('comet')[0];
    const row = { ...c, star: [0, 0, 0], path: { ...c.path, focus: [0, 0, 0], q: 10, e: 0.95, phase: 0 } };
    const aph = row.path.period / 2;
    expect(len(rowAt(row, aph), [0, 0, 0])).toBeGreaterThan(13.3 * 10);
    expect(tailOf(row, aph).length).toBeCloseTo(0.15 * c.tail, 9);
    expect(tailOf(row, 0).length).toBeCloseTo(c.tail, 9);
  });
});

describe('rigs', () => {
  it('puts one in about one field in three, at its middle', () => {
    const r = all('rig');
    const f = all('field');
    const share = r.length / f.length;
    expect(share).toBeGreaterThanOrEqual(0.2);
    expect(share).toBeLessThanOrEqual(0.5);
    for (const x of r) expect(x.at).toEqual(f.find((y) => y.id === x.field).at);
  });
});

describe('the core and its neighbours', () => {
  it('has fields and comets in the core, clear of every hand-made place, and no rig near home', () => {
    const core = sectors[3];
    expect(core.extras.field.length).toBeGreaterThan(0);
    expect(core.extras.comet.length).toBeGreaterThan(0);
    for (const f of core.extras.field) expect(clearOfKeepOuts(f.at, 9 * f.size)).toBe(true);
    for (const c of core.extras.comet) expect(clearOfKeepOuts(c.star, c.extent + c.tail + 9 * c.size)).toBe(true);
    for (const r of core.extras.rig) expect(len(r.at, [0, 0, 0])).toBeGreaterThanOrEqual(HOME_KEEP + 9 * r.size);
  });
  it('keeps the neighbours’ fields and comets clear of every hand-made place, all of them', () => {
    for (const [x, y, z] of [[-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const s = fullSector(UNIVERSE, x, y, z);
      for (const f of s.extras.field) expect(clearOfKeepOuts(f.at, 9 * f.size, KEEP_OUTS)).toBe(true);
      for (const c of s.extras.comet) expect(clearOfKeepOuts(c.star, c.extent + c.tail + 9 * c.size, KEEP_OUTS)).toBe(true);
    }
  });
});

describe('ids', () => {
  it('names each row by its list and place, the same every time, as plain data', () => {
    const s = sectors[0];
    expect(placeOf(UNIVERSE, 'E:1,0:w20000').row).toEqual(s.extras.field[0]);
    expect(s.extras.comet[1].id).toBe('E:1,0:w30001');
    expect(placeOf(UNIVERSE, 'e:1,0:w30000').row).toEqual(s.extras.comet[0]);
    expect(fullSector(UNIVERSE, 1, 0, 0).extras).toEqual(s.extras);
    for (const list of Object.values(s.extras)) expect(structuredClone(list)).toEqual(list);
  });
});
