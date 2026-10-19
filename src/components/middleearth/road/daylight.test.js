import { describe, expect, it } from 'vitest';
import { LIGHTS, light } from './daylight';
import { sOf } from './line';
import { STAGES } from './stages/index';

const lit = (id, local) => light(STAGES, sOf(STAGES, id, local));

describe('daylight: the sky, the sun and the air along the Road', () => {
  it('has a start and an end for every stage', () => {
    for (const st of STAGES) {
      expect(LIGHTS[st.id].start.sun).toBeTruthy();
      expect(LIGHTS[st.id].end.sun).toBeTruthy();
    }
  });

  it('Hobbiton opens on a September morning and ends under the stars', () => {
    expect(Math.abs(lit('hobbiton', 0).sun.el - 0.35)).toBeLessThan(0.05);
    const night = lit('hobbiton', STAGES[0].length - 1);
    expect(night.sun.el).toBeLessThan(-0.2);
    expect(night.stars).toBeGreaterThan(0.8);
  });

  it('Moria has no sun and next to no light but the staff’s', () => {
    const m = lit('moria', 150);
    expect(m.sun.el).toBeLessThan(0);
    expect(m.ambient).toBeLessThan(0.05);
  });

  it('Gorgoroth lies under the pall, from the east', () => {
    const g = lit('gorgoroth', 0);
    expect(g.pall.amount).toBeGreaterThan(0.8);
    expect(g.pall.from[0]).toBeGreaterThan(0.9);
  });

  it('eases from a stage’s start to its end', () => {
    const a = lit('hobbiton', 0).sun.el;
    const mid = lit('hobbiton', STAGES[0].length / 2).sun.el;
    const b = lit('hobbiton', STAGES[0].length - 1).sun.el;
    expect(mid).toBeLessThan(a);
    expect(mid).toBeGreaterThan(b);
  });

  it('hands over without a jump in the sun’s colour: a stage ends in the colour the next begins in', () => {
    for (let i = 0; i < STAGES.length - 1; i++) {
      const end = LIGHTS[STAGES[i].id].end.sun.colour;
      const next = LIGHTS[STAGES[i + 1].id].start.sun.colour;
      for (let c = 0; c < 3; c++) expect(Math.abs(end[c] - next[c])).toBeLessThan(0.02);
    }
  });

  it('answers whole numbers everywhere along the ride', () => {
    for (let s = 0; s <= 1; s += 0.01) {
      const l = light(STAGES, s);
      for (const v of [l.sun.az, l.sun.el, ...l.sun.colour, l.ambient, ...l.fog.colour, l.fog.density, l.moon.phase, l.moon.el, l.stars, l.pall.amount, ...l.pall.from, l.exposure]) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
