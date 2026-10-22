import { describe, expect, it } from 'vitest';
import { LIGHTS, REF_LEAST, SHADE, keyLight, light, refFloor, shadeOf } from './daylight';
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

  it('Moria has no sun and next to no light but the staff’s, from the Doors to the East-gate; the Dale is a grey day', () => {
    for (const local of [0, 60, 110]) {
      const m = lit('moria', local);
      expect(m.sun.el, local).toBeLessThan(0);
      expect(m.ambient, local).toBeLessThan(0.05);
      expect(Math.max(...m.fog.colour), local).toBeLessThan(0.05);
    }
    const dale = lit('moria', 165);
    expect(dale.sun.el).toBeGreaterThan(0);
    expect(dale.ambient).toBeGreaterThan(0.25);
    expect(dale.murk).toBe(0);
  });

  it('the Redhorn’s shoulder whites out in its storm: thick pale fog over the pass, clear air before and after', () => {
    const before = lit('caradhras', 20);
    const storm = lit('caradhras', 75);
    const after = lit('caradhras', 140);
    expect(storm.fog.density).toBeGreaterThan(0.02);
    expect(before.fog.density).toBeLessThan(0.006);
    expect(after.fog.density).toBeLessThan(0.006);
    expect(Math.min(...storm.fog.colour)).toBeGreaterThan(0.75);
    // (and the sky goes with it)
    expect(storm.murk).toBeGreaterThan(0.95);
    expect(before.murk).toBe(0);
    expect(lit('hobbiton', 50).murk).toBe(0);
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

  it('the key light: the sun by day, the moon by night, none in Moria’s dark', () => {
    const noon = keyLight(light(STAGES, sOf(STAGES, 'hobbiton', 10)));
    expect(noon.intensity).toBeGreaterThan(1);
    expect(noon.dir[1]).toBeGreaterThan(0);
    // (Bree is a wet night: a cold moon, up, a good deal fainter than the sun)
    const bree = keyLight(light(STAGES, sOf(STAGES, 'bree', 60)));
    expect(bree.intensity).toBeGreaterThan(0.2);
    expect(bree.intensity).toBeLessThan(1);
    expect(bree.dir[1]).toBeGreaterThan(0.3);
    expect(bree.colour[2]).toBeGreaterThan(bree.colour[0]);
    // (a direction, its length one)
    expect(Math.hypot(...bree.dir)).toBeCloseTo(1, 6);
    const deep = keyLight(light(STAGES, sOf(STAGES, 'moria', 60)));
    expect(deep.intensity).toBe(0);
  });

  it('the shade: the day’s pale lilac, a fainter blue under the moon, never black', () => {
    const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const noon = shadeOf(light(STAGES, sOf(STAGES, 'hobbiton', 10)));
    expect(luma(noon)).toBeCloseTo(SHADE.day, 3);
    expect(noon[2]).toBeGreaterThan(noon[1]);
    const bree = shadeOf(light(STAGES, sOf(STAGES, 'bree', 60)));
    expect(luma(bree)).toBeLessThan(luma(noon));
    // (blue: its blue over its red more than the day’s lilac has it)
    expect(bree[2] / bree[0]).toBeGreaterThan(noon[2] / noon[0]);
    for (const id of ['moria', 'cirith-ungol', 'gorgoroth']) expect(luma(shadeOf(light(STAGES, sOf(STAGES, id, 60)))), id).toBeGreaterThanOrEqual(SHADE.least - 1e-9);
  });

  it('the light the look measures by: never under the shade floor’s, a day’s left as it is', () => {
    const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    // (Moria's black air: the reference the house falls to, and a red glimmer under the pall)
    expect(luma(refFloor({ r: 1e-3, g: 1e-3, b: 1e-3 }))).toBeCloseTo(REF_LEAST, 6);
    const red = refFloor({ r: 0.02, g: 0.005, b: 0.002 });
    expect(luma(red)).toBeCloseTo(REF_LEAST, 6);
    expect(red.r / red.g).toBeCloseTo(4, 6);
    expect(refFloor({ r: 0, g: 0, b: 0 })).toEqual({ r: REF_LEAST, g: REF_LEAST, b: REF_LEAST });
    const day = { r: 0.9, g: 0.85, b: 0.8 };
    expect(refFloor({ ...day })).toEqual(day);
  });
});
