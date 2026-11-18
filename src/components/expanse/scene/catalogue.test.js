import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { companionAt, companionsOf } from '../gen/companions';
import { gargantuanKeeps } from '../gen/gargantuans';
import { rowAt } from '../gen/paths';
import { UNIVERSE } from '../gen/seed';
import { fullSector } from '../gen/space';
import { THING_NEAR } from '../gen/things';
import { createDiscs } from './discs';
import { GIANT } from './giants';
import { createNearThings, pickNear } from './nearThings';

// Lane 4a's rows in lane 2's near and far layers
const s = fullSector(UNIVERSE, 1, 0, 0, { lattice: false });
const none = () => null;
const writer = () => {
  const got = [];
  // (as farStars' writer: a disc with no alpha isn't drawn)
  return { got, begin: () => (got.length = 0), push: (x, y, z, r, cr, cg, cb, lx, ly, lz, alpha) => alpha > 0 && got.push({ at: [x, y, z], r, alpha }), end() {} };
};
const near = (at, k) => [at[0] + k, at[1], at[2]];
const giant = { id: 'E:1,0,1:w3', kind: 'giant', gargantuan: true, at: [200000, 0, 0], size: 2500, body: 2500, axis: [0, 1, 0], light: [1, 0, 0], colors: ['#ff8844', '#ffffff'] };

describe('lane 4a’s rows near', () => {
  it('picks a comet where it is now, with its row, and leaves out the clouds', () => {
    const comet = s.extras.comet[0];
    const t = 5000;
    const at = rowAt(comet, t);
    const rows = pickNear(none, [s], near(at, comet.size * 2), { max: 10, t });
    const e = rows.find((r) => r.id === comet.id);
    expect(e.at).toEqual(at);
    expect(e.row).toBe(comet);
    const pocket = s.extras.pocket[0];
    expect(pickNear(none, [s], pocket.at, { max: 10 }).some((r) => r.id === pocket.id)).toBe(false);
  });
  it('makes what’s solid the catalogue’s: a fleet ship by ship, nothing for a field, a gargantuan its parts', () => {
    const fleet = s.extras.fleet[0];
    const field = s.extras.field[0];
    const things = createNearThings(new THREE.Group(), { max: 8 });
    things.update([...pickNear(none, [s], near(fleet.at, 10), { max: 8 }), ...pickNear(none, [s], field.at, { max: 8 })], new THREE.PerspectiveCamera(), 0);
    expect(things.solids().filter((x) => x.id.startsWith(fleet.id)).length).toBe(fleet.ships);
    expect(things.solids().some((x) => x.id === field.id)).toBe(false);
    const g = pickNear(none, [], [200000 - 2500 - 1000, 0, 0], { max: 1, giants: [giant] });
    expect(g.map((r) => r.id)).toEqual([giant.id]);
    things.update(g, new THREE.PerspectiveCamera(), 0);
    expect(things.solids().map((x) => x.r)).toEqual(gargantuanKeeps(giant).map((k) => k.r));
    expect(pickNear(none, [], [0, 0, 0], { max: 1, giants: [giant] })).toEqual([]);
    things.dispose();
  });
});

describe('lane 4a’s rows far', () => {
  it('draws a list row’s disc at its catalogue size, gives it to its mesh near, and draws none for a cloud', () => {
    const w = writer();
    const d = createDiscs(w, { budget: { discs: 4000 } });
    const beacon = s.extras.wormhole[0];
    d.feed([s], near(beacon.at, 20000), 0);
    expect(w.got.find((x) => x.at[0] === beacon.at[0] && x.at[2] === beacon.at[2]).r).toBeCloseTo(beacon.size * 0.6, 9);
    for (const p of s.extras.pocket) expect(w.got.some((x) => x.at === p.at || (x.at[0] === p.at[0] && x.at[2] === p.at[2]))).toBe(false);
    d.feed([s], near(beacon.at, THING_NEAR * beacon.size * 0.5), 0);
    expect(w.got.some((x) => x.at[0] === beacon.at[0] && x.at[2] === beacon.at[2])).toBe(false);
  });
  it('draws a binary’s companion beside its star, and a gargantuan far past the far plane', () => {
    const sys = s.systems.find((x) => companionsOf(x).length);
    const c = companionsOf(sys)[0];
    const w = writer();
    const d = createDiscs(w, { budget: { discs: 4000 } });
    d.feed([s], near(sys.at, 10000), 1000);
    const at = companionAt(c, sys, 1000);
    expect(w.got.find((x) => x.at[0] === at[0] && x.at[2] === at[2]).r).toBe(c.size);
    const w2 = writer();
    const d2 = createDiscs(w2, { budget: { discs: 4000 } });
    d2.feed([], [0, 0, 0], 0, null, null, null, 1 / 60, [giant]);
    expect(w2.got.map((x) => x.r)).toEqual([giant.size]);
    d2.feed([], [-GIANT.far * 1.3, 0, 0], 0, null, null, null, 1 / 60, [giant]);
    w.got.length = 0;
    w.got.push(...w2.got);
    expect(w.got).toEqual([]);
  });
});
