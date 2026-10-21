import { describe, expect, it } from 'vitest';
import { createTrack, lift, trackGeometry } from './track';
import { paintFor } from './ground';
import { landFor, roadFor } from './terrain';
import { TRACKS, trackOf } from './stages/tracks';
import { STAGES } from './stages/index';
import { soilOf } from './stages/soils';

const lane = TRACKS.hobbiton;
const path = TRACKS.weathertop;

describe('the road underfoot', () => {
  it('stands over the land everywhere across it, its ruts lower than its crown and its shoulders', () => {
    for (const row of [lane, path, TRACKS.bree, TRACKS['minas-tirith']])
      for (let x = -row.width / 2; x <= row.width / 2; x += 0.05) expect(lift(row, x)).toBeGreaterThan(0.01);
    expect(lift(lane, lane.ruts)).toBeLessThan(lift(lane, 0));
    expect(lift(lane, lane.ruts)).toBeLessThan(lift(lane, (lane.ruts + lane.width / 2) / 2));
    // (a path's one trodden line down its middle)
    expect(lift(path, 0)).toBeLessThan(lift(path, 0.5));
  });

  it('runs the whole road, on the land exactly, as wide as its row', () => {
    const land = landFor('hobbiton', { res: 8, wide: 256 });
    const g = trackGeometry(land, lane);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    let along = 0;
    let wide = 0;
    for (let k = 0; k < pos.count; k++) {
      const off = uv.getX(k);
      expect(pos.getY(k) - land.field(pos.getX(k), pos.getZ(k))).toBeCloseTo(lift(lane, off), 4);
      along = Math.max(along, uv.getY(k));
      wide = Math.max(wide, Math.abs(off));
    }
    expect(along).toBeCloseTo(land.road.length, 4);
    expect(wide).toBeCloseTo(lane.width / 2, 4);
  });

  it('faces up, every triangle of it (wound the other way, none is drawn)', () => {
    const land = landFor('hobbiton', { res: 8, wide: 256 });
    const g = trackGeometry(land, path);
    const pos = g.getAttribute('position');
    const idx = g.getIndex();
    const v = (k) => [pos.getX(k), pos.getY(k), pos.getZ(k)];
    for (let t = 0; t < idx.count; t += 3) {
      const [a, b, c] = [v(idx.getX(t)), v(idx.getX(t + 1)), v(idx.getX(t + 2))];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      expect(e1[2] * e2[0] - e1[0] * e2[2]).toBeGreaterThan(0);
    }
    const n = g.getAttribute('normal');
    for (let k = 0; k < n.count; k++) expect(n.getY(k)).toBeGreaterThan(0.9);
  });

  it('is cut where a river runs over its road', () => {
    const land = { road: roadFor('hobbiton'), field: () => 0, wet: (x, z) => z > 20 && z < 30 };
    const g = trackGeometry(land, path);
    const dry = g.getAttribute('aDry');
    const uv = g.getAttribute('uv');
    for (let k = 0; k < dry.count; k++) {
      const m = uv.getY(k);
      if (m > 21 && m < 29) expect(dry.getX(k)).toBe(0);
      if (m < 19 || m > 31) expect(dry.getX(k)).toBe(1);
    }
  });

  it('keeps every stage’s track inside its levelled lane, and names only stages there are', () => {
    const ids = new Set(STAGES.map((s) => s.id));
    for (const [id, row] of Object.entries(TRACKS)) {
      expect(ids.has(id)).toBe(true);
      expect(['lane', 'path']).toContain(row.kind);
      expect(row.width).toBeGreaterThan(1);
      expect(row.width).toBeLessThanOrEqual(5);
      if (row.kind === 'lane') expect(row.ruts).toBeLessThan(row.width / 2 - 0.4);
    }
    // (none where the company walks on what a stage builds, or in snow)
    for (const id of ['caradhras', 'moria', 'anduin', 'cirith-ungol']) expect(trackOf(id)).toBeNull();
  });

  it('is nothing on low, and nothing for a stage without one', () => {
    const land = { road: roadFor('hobbiton'), field: () => 0 };
    expect(createTrack(land, lane, { tier: 'low' })).toBeNull();
    expect(createTrack(land, null, { tier: 'high' })).toBeNull();
  });

  it('wears the ground’s paint only as wide as itself, so the grass comes up to its edge', () => {
    const land = { road: roadFor('hobbiton'), heightAt: () => 0 };
    const at = (paint, x) => paint(x, 40, [0, 0, 0]);
    const worn = paintFor(land, { wear: lane.width / 2 + 0.25 });
    const before = paintFor(land);
    expect(at(worn, 0)).toBe(0);
    expect(at(worn, 2.4)).toBe(1);
    // (without a track, the old band: still worn there)
    expect(at(before, 2.4)).toBeLessThan(1);
    expect(soilOf('hobbiton').scans.road).toBeTruthy();
  });
});
