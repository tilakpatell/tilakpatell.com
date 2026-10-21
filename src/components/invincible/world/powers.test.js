import { describe, expect, it } from 'vitest';
import { POWERS, newPower, stepPower, wallOf, wallStops } from './powers';
import { hero } from './heroes';
import { DAMAGE, hitTower, newRuins } from './demolish';
import { newFoes, spawnFoes } from './foes';

const STREET = [50, 0, 0];
const air = (p, t = 10) => ({ p: [...p], v: [0, 0, 0], mode: 'air', t });
const look = [0, 0, -1];
const towers = [{ key: 'b:1', x: 50, z: -40, w: 20, d: 20, h: 60 }, { key: 'b:2', x: 50, z: -120, w: 20, d: 20, h: 90 }, { key: 'b:3', x: 400, z: 0, w: 20, d: 20, h: 60 }];
const towersNear = (p, r) => towers.filter((t) => Math.hypot(t.x - p[0], t.z - p[2]) <= r);

describe('the wall (Eve)', () => {
  it('stands across her look a few metres ahead, stops what crosses it, and goes after its life', () => {
    const h = air([50, 10, 0]);
    const r = stepPower(newPower(), hero('eve'), { power: true, look }, h, newFoes(), 0.05, { towersNear, ruins: newRuins() });
    expect(r.out[0].type).toBe('construct');
    const w = r.p.wall;
    expect(w.p[2]).toBeCloseTo(-6);
    expect(wallStops(w, [50, 11, -20], [50, 11, 0])).toBe(true); // a bolt coming at her
    expect(wallStops(w, [50 + POWERS.transmute.wall, 11, -20], [50 + POWERS.transmute.wall, 11, 0])).toBe(false); // past its edge
    expect(wallStops(w, [50, 10 + POWERS.transmute.high + 2, -20], [50, 10 + POWERS.transmute.high + 2, 0])).toBe(false); // over it
    expect(wallStops(null, [0, 0, 0], [1, 1, 1])).toBe(false);
    const later = stepPower(r.p, hero('eve'), { power: false, look }, air([50, 10, 0], 10 + POWERS.transmute.life + 0.1), newFoes(), 0.05, {});
    expect(later.p.wall).toBeNull();
  });
  it('takes a bolt and a thrown car out of the air where they cross it', () => {
    const h = air([50, 10, 0]);
    let r = stepPower(newPower(), hero('eve'), { power: true, look }, h, newFoes(), 0.05, { towersNear });
    const f = { ...newFoes(), on: true, bolts: [{ p: [50, 11, -7], v: [0, 0, 45], life: 3, hurt: 12 }, { p: [80, 11, -7], v: [0, 0, 45], life: 3, hurt: 12 }], cars: [{ id: 0, p: [52, 12, -6.5], v: [0, 0, 35], held: null, away: false, life: 4 }] };
    r = stepPower(r.p, hero('eve'), { power: false, look }, h, f, 0.05, {});
    expect(r.foes.bolts).toHaveLength(1);
    expect(r.foes.bolts[0].p[0]).toBe(80);
    expect(r.foes.cars[0].away).toBe(true);
    expect(r.out.filter((e) => e.type === 'wallHit')).toHaveLength(2);
  });
  it('aimed at a damaged tower, mends 0.3 of it instead, never below 0', () => {
    let ruins = hitTower(newRuins(), 'b:1', 0.5).ruins;
    const h = air([50, 10, 0]);
    const r = stepPower(newPower(), hero('eve'), { power: true, look }, h, newFoes(), 0.05, { towersNear, ruins });
    expect(r.out[0].type).toBe('mend');
    expect(r.ruins.damage.get('b:1')).toBeCloseTo(0.2);
    const r2 = stepPower(newPower(), hero('eve'), { power: true, look }, h, newFoes(), 0.05, { towersNear, ruins: r.ruins });
    expect(r2.ruins.damage.has('b:1')).toBe(false);
    // (looking away from it: a wall, not a mend)
    const away = stepPower(newPower(), hero('eve'), { power: true, look: [0, 0, 1] }, h, newFoes(), 0.05, { towersNear, ruins });
    expect(away.out[0].type).toBe('construct');
  });
  it('waits its cooldown, and only in the air', () => {
    const h = air([50, 10, 0]);
    const r = stepPower(newPower(), hero('eve'), { power: true, look }, h, newFoes(), 0.05, {});
    const again = stepPower(r.p, hero('eve'), { power: true, look }, h, newFoes(), 0.05, {});
    expect(again.out).toHaveLength(0);
    const ground = stepPower(newPower(), hero('eve'), { power: true, look }, { ...h, mode: 'ground' }, newFoes(), 0.05, {});
    expect(ground.out).toHaveLength(0);
    expect(stepPower(newPower(), hero('mark'), { power: true, look }, h, newFoes(), 0.05, {}).out).toHaveLength(0);
  });
});

describe('the line (Omni-Man)', () => {
  it('is two seconds straight on at Mach 2, marking each tower under it once', () => {
    let h = air([50, 30, 40]);
    let ruins = newRuins();
    let r = stepPower(newPower(), hero('omniman'), { power: true, look }, h, newFoes(), 0.05, { towersNear, ruins });
    expect(r.out[0].type).toBe('linebreak');
    expect(r.p.line).toBeTruthy();
    const hits = [];
    let steps = 0;
    while (r.p.line && steps++ < 100) {
      h = { ...h, t: h.t + 0.05, p: h.p.map((c, i) => c + (r.push?.[i] ?? 0) * 0.05) };
      r = stepPower(r.p, hero('omniman'), { power: true, look }, h, newFoes(), 0.05, { towersNear, ruins: r.ruins });
      ruins = r.ruins;
      hits.push(...r.out.filter((e) => e.type === 'lineHit'));
    }
    expect(Math.hypot(...(hits.length ? [POWERS.linebreak.speed] : [0]))).toBe(POWERS.linebreak.speed);
    expect(hits.map((e) => e.key)).toEqual(['b:1', 'b:2']); // (b:3 is 350 m off the line)
    expect(ruins.damage.get('b:1')).toBeCloseTo(DAMAGE.line);
    expect(h.t).toBeCloseTo(10 + POWERS.linebreak.time, 0);
    expect(r.out.some((e) => e.type === 'lineEnd')).toBe(true);
  });
});

describe('the shout (Thragg)', () => {
  it('throws every foe and car within 40 m: the small ones out, the big ones away', () => {
    let f = spawnFoes(newFoes(), 'mauler', 1, [STREET[0] + 10, 0, STREET[2]]);
    f = { ...f, foes: [...f.foes, { id: 50, kind: 'flaxan', state: 'fight', p: [STREET[0], 12, STREET[2] - 15], v: [0, 0, 0], hits: 0, cool: 9, phase: 0, t: 0 }, { id: 51, kind: 'flaxan', state: 'fight', p: [STREET[0] + 90, 12, STREET[2]], v: [0, 0, 0], hits: 0, cool: 9, phase: 0, t: 0 }], cars: [{ id: 0, p: [STREET[0] - 10, 4, STREET[2]], v: [0, 0, 0], held: f.foes[0].id, away: false, life: 4 }] };
    const r = stepPower(newPower(), hero('thragg'), { power: true, look }, air([STREET[0], 8, STREET[2]]), f, 0.05, {});
    expect(r.out.find((e) => e.type === 'shout').n).toBe(3);
    expect(r.foes.foes.find((e) => e.id === 50).state).toBe('ko');
    expect(r.foes.foes.find((e) => e.id === 51).state).toBe('fight');
    expect(r.foes.foes[0].state).toBe('thrown');
    expect(r.foes.foes[0].v[0]).toBeGreaterThan(0);
    expect(r.foes.cars[0].away).toBe(true);
    expect(r.p.cool).toBe(POWERS.shout.cool);
  });
});

describe('wallOf', () => {
  it('puts the wall 6 m ahead along the flat of the look', () => {
    const w = wallOf(air([0, 5, 0]), [0.6, 0.8, 0], 3);
    expect(w.p[0]).toBeCloseTo(6);
    expect(w.p[1]).toBe(5);
    expect(w.until).toBe(3 + POWERS.transmute.life);
  });
});
