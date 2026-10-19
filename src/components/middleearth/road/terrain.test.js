import { describe, expect, it } from 'vitest';
import { roadOf } from './line';
import { FILL, FRAME_BACK, SEAM_EASE, SPECS, buildHeights, landFor, landJob, riverLevel, specFor, wetBy } from './terrain';
import { STAGES } from './stages/index';

const flat = { seed: 1, relief: [] };
const road = roadOf([
  [0, 0, -40],
  [0, 0, 300],
]);

describe('the stage’s heights', () => {
  it('a flat spec and a straight road: 0 on the road, w × d / res² heights', () => {
    const t = buildHeights(flat, { size: [256, 128], res: 4, road });
    expect(t.heights.length).toBe((256 * 128) / 16);
    expect(t.w).toBe(256);
    expect(t.d).toBe(128);
    expect(t.res).toBe(4);
    expect(t.heightAt(0, 20)).toBe(0);
    expect(t.heightAt(60, 70)).toBe(0);
  });

  it('the frame: x across the road about 0, z from FRAME_BACK behind the start', () => {
    const t = buildHeights({ seed: 1, relief: [{ type: 'swell', scale: 40, height: 6 }] }, { size: [64, 64], res: 2, road });
    // (the first sample is a cell's middle: half a res in from the corner)
    expect(t.x0).toBe(-32);
    expect(t.z0).toBe(-FRAME_BACK);
    expect(t.heights[0]).toBeCloseTo(t.field(-31, -FRAME_BACK + 1), 6);
    expect(FRAME_BACK).toBe(40);
  });

  it('a river channel of depth 2 lowers heightAt on its line by 2', () => {
    const river = { line: roadOf([[-100, 0, 60], [100, 0, 60]]), depth: 2, width: 10 };
    const t = buildHeights(flat, { size: [256, 128], res: 2, road, rivers: [river] });
    expect(t.heightAt(40, 60)).toBeCloseTo(-2, 6);
    expect(t.heightAt(40, 20)).toBe(0);
  });

  it('a flat levels a pad', () => {
    const hills = { seed: 3, relief: [{ type: 'hills', scale: 30, height: 12 }] };
    const t = buildHeights(hills, { size: [256, 128], res: 2, road, flats: [{ at: [60, 40], r: 10, h: 7 }] });
    expect(t.heightAt(60, 40)).toBeCloseTo(7, 6);
  });

  it('the road is levelled across: the same height either side of its middle', () => {
    const tilt = { seed: 1, base: 0, relief: [{ type: 'swell', scale: 60, height: 10 }] };
    const t = buildHeights(tilt, { size: [256, 128], res: 1, road });
    for (const z of [10, 30, 55]) expect(t.heightAt(-2, z)).toBeCloseTo(t.heightAt(2, z), 1);
  });

  it('heightAt interpolates: the midpoint of two samples is their mean', () => {
    const t = buildHeights({ seed: 5, relief: [{ type: 'hills', scale: 20, height: 9 }] }, { size: [64, 64], res: 2, road: null });
    const a = t.heightAt(-21, 3);
    const b = t.heightAt(-19, 3);
    expect(t.heightAt(-20, 3)).toBeCloseTo((a + b) / 2, 6);
  });

  it('builds a whole stage, 1,024 × 512 at 2 m, in good time', () => {
    const spec = specFor('hobbiton');
    const t0 = performance.now();
    const t = buildHeights(spec, { size: [1024, 512], res: 2, road });
    const ms = performance.now() - t0;
    expect(t.heights.length).toBe(512 * 256);
    // (the browser's main thread is measured in the module; Node's is the guard here)
    expect(ms).toBeLessThan(250);
  });

  it('every stage has a spec of known layers', () => {
    for (const st of STAGES) {
      const spec = specFor(st.id);
      expect(Array.isArray(spec.relief)).toBe(true);
      for (const l of spec.relief) expect(['swell', 'hills', 'ridges', 'mountains', 'dunes', 'mesas', 'level', 'channels', 'island']).toContain(l.type);
    }
    expect(Object.keys(SPECS).length).toBeGreaterThan(0);
  });

  it('neighbouring stages meet at their seam: the same heights across it', () => {
    for (let i = 0; i + 1 < STAGES.length; i++) {
      const a = landFor(STAGES[i].id, { res: 4, wide: 256 });
      const b = landFor(STAGES[i + 1].id, { res: 4, wide: 256 });
      for (const x of [-100, -30, 0, 12, 90]) expect(a.field(x, a.end)).toBeCloseTo(b.field(x, 0), 6);
    }
  });

  it('a stage’s own land is back past the seam’s ease', () => {
    const t = landFor('caradhras', { res: 4, wide: 256 });
    const mid = t.end / 2;
    expect(mid).toBeGreaterThan(SEAM_EASE);
    // (the ridges are the stage’s, not the seam’s gentle swell)
    const spread = [-100, -60, 60, 100].map((x) => t.field(x, mid));
    expect(Math.max(...spread) - Math.min(...spread)).toBeGreaterThan(1);
  });

  it('the land runs FRAME_BACK past each end of the road', () => {
    const t = landFor('hobbiton', { res: 2, wide: 256 });
    expect(t.z0).toBe(-FRAME_BACK);
    expect(t.z0 + t.d).toBeGreaterThanOrEqual(t.end + FRAME_BACK);
  });

  it('the job yields a row at a time and ends with the same land', () => {
    const job = landJob('bree', { res: 4, wide: 128 });
    let steps = 0;
    let r;
    while (!(r = job.next()).done) steps++;
    const whole = landFor('bree', { res: 4, wide: 128 });
    expect(steps).toBe(whole.rows);
    expect(Array.from(r.value.heights)).toEqual(Array.from(whole.heights));
  });
});

describe('the rivers’ water', () => {
  const across = roadOf([
    [-100, 0, 60],
    [100, 0, 60],
  ]);
  const river = { line: across, depth: 2, width: 10, bank: 5 };

  it('stands FILL of the way up its channel on flat land', () => {
    const t = buildHeights(flat, { size: [256, 160], res: 2, rivers: [river] });
    const level = riverLevel(t.field, river);
    for (const m of [0, 50, 100, 150, 200]) expect(level(m)).toBeCloseTo(-2 + 2 * FILL, 5);
  });

  it('follows the land down a slope, smoothly, never rising on the way down', () => {
    const slope = (x) => -x * 0.05;
    const cut = (x, z) => slope(x) - (Math.abs(z - 60) < 5 ? 2 : 0);
    const level = riverLevel(cut, river);
    let last = Infinity;
    for (let m = 0; m <= across.length; m += 1) {
      const h = level(m);
      expect(h).toBeLessThanOrEqual(last + 1e-9);
      last = h;
    }
    expect(level(100)).toBeCloseTo(-2 + 2 * FILL, 1);
  });

  it('a bump in the bed does not lift the water over its banks', () => {
    const bumpy = (x, z) => (Math.abs(z - 60) < 5 ? (Math.abs(x) < 3 ? 1.5 : 0) - 2 : 0);
    const level = riverLevel(bumpy, river);
    expect(level(100)).toBeLessThan(0);
  });

  it('wet: on the river, not off it', () => {
    const wet = wetBy([river]);
    expect(wet(0, 60)).toBe(true);
    expect(wet(0, 64)).toBe(true);
    expect(wet(0, 80)).toBe(false);
    expect(wetBy([])(0, 60)).toBe(false);
  });

  it('a stage’s land carries its rivers, lines made, and wet', () => {
    const land = landFor('hobbiton', { res: 4, wide: 256 });
    expect(land.rivers.length).toBeGreaterThan(0);
    for (const r of land.rivers) {
      expect(r.line.length).toBeGreaterThan(0);
      const mid = r.line.pointAt(r.line.length / 2);
      expect(land.wet(mid.x, mid.z)).toBe(true);
    }
    expect(land.wet(0, 100)).toBe(false);
  });
});
