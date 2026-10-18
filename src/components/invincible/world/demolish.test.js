import { describe, expect, it } from 'vitest';
import { DAMAGE, RUINS, applyRuin, biteOf, chunksFor, forceOf, hitTower, mending, newRuins, parse, repair, serialise, stageOf } from './demolish';
import { buildWorld } from './map';

const known = (id) => Number.isInteger(id) && id >= 0 && id < 1000;

describe('a tower hit', () => {
  it('takes damage by the force, a car’s, a slam’s and a Viltrumite’s at speed, and no more than all of it', () => {
    expect(forceOf('car') / RUINS.per).toBeCloseTo(DAMAGE.car, 9);
    let r = hitTower(newRuins(), 7, forceOf('slam'));
    expect(r.delta).toBeCloseTo(0.3, 9);
    r = hitTower(r.ruins, 7, forceOf('mach'));
    expect(r.ruins.d.get(7)).toBeCloseTo(0.8, 9);
    r = hitTower(r.ruins, 7, forceOf('mach'));
    expect(r.ruins.d.get(7)).toBe(1);
    expect(r.delta).toBeCloseTo(0.2, 9);
    expect(hitTower(newRuins(), 7, -50).delta).toBe(0);
  });
  it('is whole, cracked, bitten or broken: stages from 0.3 and 0.6', () => {
    expect([0, 0.01, 0.29, 0.3, 0.59, 0.6, 1].map(stageOf)).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect(hitTower(newRuins(), 1, forceOf('mach')).stage).toBe(2);
  });
  it('leaves the ruins it was given as they were', () => {
    const a = newRuins();
    hitTower(a, 3, 100);
    expect(a.d.size).toBe(0);
  });
});

describe('the city mends', () => {
  it('a quarter a day, never under nothing, and what’s whole is forgotten', () => {
    let r = hitTower(newRuins(), 1, forceOf('mach')).ruins;
    r = hitTower(r, 2, forceOf('car')).ruins;
    const a = repair(r, 1);
    expect(a.d.get(1)).toBeCloseTo(0.25, 9);
    expect(a.d.has(2)).toBe(false);
    expect(repair(r, 10).d.size).toBe(0);
    expect(repair(r, 0).d.get(1)).toBeCloseTo(0.5, 9);
    expect(repair(r, -3).d.get(1)).toBeCloseTo(0.5, 9);
    expect(repair(r, NaN).d.get(1)).toBeCloseTo(0.5, 9);
  });
  it('wears scaffolding once it has been mended a while, until it is whole', () => {
    let r = hitTower(newRuins(), 1, forceOf('mach')).ruins;
    expect(mending(r)).toEqual([]);
    r = repair(r, 1);
    expect(mending(r)).toEqual([1]);
    r = repair(r, 1);
    expect(mending(r)).toEqual([]);
  });
});

describe('what’s kept (tp-inv-world-ruins)', () => {
  it('keeps the 400 most damaged, the least damaged dropped first, and when it was last mended', () => {
    let r = newRuins(1234);
    for (let i = 0; i < 450; i++) r = hitTower(r, i, ((i % 90) + 1) * 2).ruins;
    const kept = serialise(r);
    expect(kept.at).toBe(1234);
    expect(kept.d).toHaveLength(RUINS.keep);
    const least = Math.min(...kept.d.map(([, d]) => d));
    const dropped = [...r.d.values()].filter((d) => d < least);
    expect(dropped.length).toBeGreaterThan(0);
    expect(parse(JSON.stringify(kept), known).d.size).toBe(RUINS.keep);
  });
  it('reads back what it wrote, mending marks and all', () => {
    let r = hitTower(newRuins(50), 4, forceOf('mach')).ruins;
    r = repair(r, 1, 60);
    const back = parse(serialise(r), known);
    expect(back.d.get(4)).toBeCloseTo(0.25, 9);
    expect(back.at).toBe(60);
    expect(mending(back)).toEqual([4]);
  });
  it('takes garbage, an unknown id, or a damage out of range as no ruins at all', () => {
    for (const bad of ['garbage', '{', null, 7, { d: 'x' }, { d: [[1, 0.5], [5000, 0.5]] }, { d: [[1, 7]] }, { d: [[1, -0.2]] }, { d: [['x', 0.5]] }, { d: [[1]] }, { at: 'soon', d: [[1, 0.5]] }]) {
      const r = parse(typeof bad === 'string' ? bad : JSON.stringify(bad), known);
      expect(r.d.size, JSON.stringify(bad)).toBe(0);
    }
    expect(parse(JSON.stringify({ at: 9, d: [[1, 0.5]] }), known).d.get(1)).toBe(0.5);
  });
});

describe('what a hit throws', () => {
  it('chunks by the tier: none on low (cracks and the stub only), 24 on mid, 60 on high', () => {
    expect(chunksFor('low')).toBe(0);
    expect(chunksFor('mid')).toBe(24);
    expect(chunksFor('medium')).toBe(24);
    expect(chunksFor('high')).toBe(60);
    expect(chunksFor('unknown')).toBe(0);
  });
});

describe('what it leaves standing', () => {
  it('bites a sixth off the top halfway through the second stage, and a third from the third on', () => {
    expect([0, 0.2, 0.3, 0.45, 0.6, 1].map((d) => +biteOf(d).toFixed(6))).toEqual([0, 0, 0, +(1 / 6).toFixed(6), +(1 / 3).toFixed(6), +(1 / 3).toFixed(6)]);
  });
  it('lowers the boxes he collides with to what stands, and puts them back as it mends', () => {
    const W = buildWorld();
    const b = W.buildings.find((q) => q.top);
    const boxes = W.boxes.filter((q) => q.building === b.id);
    const tall = b.h + b.top.h;
    applyRuin(W, b.id, 0.8);
    const stands = tall * (1 - biteOf(0.8));
    // (what stands: the top of the boxes left with any height; the top's own box is cut to nothing at its base)
    expect(Math.max(...boxes.filter((q) => q.y1 > q.y0).map((q) => q.y1))).toBeCloseTo(stands, 6);
    for (const q of boxes) expect(q.y1).toBeGreaterThanOrEqual(q.y0);
    applyRuin(W, b.id, 0);
    expect(boxes.map((q) => q.y1).sort((x, y) => x - y)).toEqual([b.h, tall]);
  });
});
