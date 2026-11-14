import { beforeAll, describe, expect, it } from 'vitest';
import { CATALOGUE, KINDS } from './catalogue';
import { companionsOf } from './companions';
import { EXTRA_LISTS } from './extras';
import { nearestOfKind, kindsIn } from './finder';
import { GARGANTUAN, GARGANTUAN_FORMS } from './gargantuans';
import { rowAt } from './paths';
import { UNIVERSE } from './seed';
import { fullSector, placeOf } from './space';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const block = (c, o) => {
  const out = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) out.push(fullSector(UNIVERSE, c[0] + x, c[1] + y, c[2] + z, o));
  return out;
};
const LATTICE_ONLY = ['rogue', 'outpost', 'beacon', 'relay', 'monolith'];
let home;
let far;
beforeAll(() => {
  home = block([0, 0, 0], {});
  far = block([5, 2, -9], { lattice: false });
}, 120000);

describe('the catalogue holds', () => {
  it('has every one of the 23 entries round home, and every kind but the gargantuans’ forms', () => {
    const k = kindsIn(home);
    for (const c of CATALOGUE) expect(c.kinds.some((x) => k.get(x) > 0), c.name).toBe(true);
    for (const kind of Object.keys(KINDS)) if (!GARGANTUAN_FORMS.includes(kind) && kind !== 'nebula') expect(k.get(kind) ?? 0, kind).toBeGreaterThan(0);
  });
  it('has every list kind out there too, the lattice off', () => {
    const k = kindsIn(far);
    for (const c of CATALOGUE) if (!c.kinds.every((x) => LATTICE_ONLY.includes(x) || GARGANTUAN_FORMS.includes(x) || ['rock', 'ice', 'derelict', 'nebula'].includes(x))) expect(c.kinds.some((x) => k.get(x) > 0), c.name).toBe(true);
  });
  it('holds one gargantuan a block', () => {
    for (const b of [home, far]) expect(b.flatMap((s) => s.extras.gargantuan)).toHaveLength(1);
  });
  it('fills every sector round home but the core with its lists', () => {
    for (const s of home) {
      if (!s.sx && !s.sy && !s.sz) continue;
      for (const l of ['wormhole', 'remnant', 'pulsar', 'protostar', 'storm', 'pocket', 'herd', 'debris']) expect(s.extras[l].length, `${s.id} ${l}`).toBeGreaterThan(0);
      const n = Object.values(s.extras).reduce((t, r) => t + r.length, 0);
      expect(n, s.id).toBeGreaterThanOrEqual(60);
      expect(n, s.id).toBeLessThanOrEqual(400);
    }
  });
  it('keeps the core lighter: only the kinds that may sit there, and no gargantuan near home', () => {
    const core = home.find((s) => !s.sx && !s.sy && !s.sz);
    for (const rows of Object.values(core.extras)) for (const r of rows) expect(KINDS[r.kind].core, r.kind).toBe(true);
    for (const s of home) for (const g of s.extras.gargantuan) expect(len(g.at, [0, 0, 0])).toBeGreaterThanOrEqual(GARGANTUAN.home);
  });
});

describe('the finder', () => {
  it('finds the nearest comet where it is now, a binary and the gargantuan', () => {
    const t = 1234;
    const comets = home.flatMap((s) => s.extras.comet);
    const want = comets.reduce((a, b) => (len(rowAt(b, t), [0, 0, 0]) < len(rowAt(a, t), [0, 0, 0]) ? b : a));
    expect(nearestOfKind(home, 'comet', [0, 0, 0], t).id).toBe(want.id);
    const bin = nearestOfKind(home, 'binary', [0, 0, 0]);
    expect(companionsOf(home.flatMap((s) => s.systems).find((x) => x.id === bin.id)).length).toBe(1);
    const gs = home.flatMap((s) => [...s.extras.gargantuan, ...s.extras.arrival]);
    const g = gs.reduce((a, b) => (len(b.at, [0, 0, 0]) < len(a.at, [0, 0, 0]) ? b : a));
    expect(nearestOfKind(home, 'gargantuan', [0, 0, 0]).id).toBe(g.id);
    expect(nearestOfKind(new Map(home.map((x) => [x.id, x])).values(), 'comet', [0, 0, 0], t)).toEqual(nearestOfKind(home, 'comet', [0, 0, 0], t));
  });
});

describe('ids', () => {
  it('resolves every list row of E:1,0 by its id, either case, and makes the same lists whatever the order', () => {
    const s = home.find((x) => x.id === 'E:1,0');
    const rows = Object.values(s.extras).flat();
    const step = Math.max(1, Math.floor(rows.length / 400));
    for (let i = 0; i < rows.length; i += step) {
      expect(placeOf(UNIVERSE, rows[i].id).row, rows[i].id).toEqual(rows[i]);
      expect(placeOf(UNIVERSE, rows[i].id.toLowerCase()).row).toEqual(rows[i]);
    }
    fullSector(UNIVERSE, 2, 0, 0, { lattice: false });
    expect(fullSector(UNIVERSE, 1, 0, 0).extras).toEqual(s.extras);
  });
  it('names the lists in their order', () => {
    expect(EXTRA_LISTS).toEqual(['gargantuan', 'arrival', 'wormhole', 'remnant', 'pulsar', 'protostar', 'storm', 'pocket', 'swarm', 'herd', 'debris', 'field', 'comet', 'rig', 'fleet', 'shipyard']);
  });
});
