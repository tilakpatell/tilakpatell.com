import { describe, expect, it } from 'vitest';
import { LANDMARKS, SEEN, skyLandmark } from './landmarks';
import { SYSTEMS, gridAt, systemById } from './systems';

describe('the landmarks', () => {
  it('each sits in the square the atlas gives it, with a kind, a size and colours', () => {
    const ids = LANDMARKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LANDMARKS) {
      if (l.grid) expect(gridAt(l.pos), l.id).toBe(l.grid);
      expect(['nebula', 'blackhole', 'galaxy'], l.id).toContain(l.kind);
      expect(l.r, l.id).toBeGreaterThan(0);
      expect(l.r, l.id).toBeLessThan(1);
      for (const c of l.colors) expect(c, l.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(l.name, l.id).toMatch(/^The /);
      expect(l.about, l.id).not.toMatch(/'/);
    }
  });

  it('puts the nearest nebula in a system’s sky, where it is from there', () => {
    expect(skyLandmark(systemById('kessel')).id).toBe('maelstrom');
    expect(skyLandmark(systemById('naboo')).id).toBe('kaliida');
    expect(skyLandmark(systemById('hoth')).id).toBe('ivax');
    // (a black hole isn't a cloud in the sky: the Maw is the Maelstrom's)
    for (const s of SYSTEMS) expect(['maw', 'endorgate', 'rishi'], s.id).not.toContain(skyLandmark(s)?.id);
    for (const s of SYSTEMS) {
      const n = skyLandmark(s);
      if (!n) continue;
      expect(Math.hypot(...n.dir), s.id).toBeCloseTo(1, 6);
      expect(n.size, s.id).toBeGreaterThanOrEqual(0.18);
      expect(n.size, s.id).toBeLessThanOrEqual(0.45);
      expect(n.color, s.id).toMatch(/^#[0-9a-f]{6}$/);
    }
    // (east of Kessel, south a little: the way the map has it)
    const k = skyLandmark(systemById('kessel')).dir;
    expect(k[0]).toBeGreaterThan(0);
    // and none past SEEN squares off
    const far = SYSTEMS.filter((s) => LANDMARKS.every((l) => l.kind !== 'nebula' || Math.hypot(l.pos[0] - s.pos[0], l.pos[1] - s.pos[1]) > SEEN));
    expect(far.length).toBeGreaterThan(0);
    for (const s of far) expect(skyLandmark(s), s.id).toBeNull();
  });

  it('shows a nebula bigger from nearer', () => {
    const maelstrom = LANDMARKS.find((l) => l.id === 'maelstrom');
    const at = (d) => skyLandmark({ id: 'x', pos: [maelstrom.pos[0] - d, maelstrom.pos[1]] }).size;
    expect(at(0.5)).toBeGreaterThan(at(3));
  });
});
