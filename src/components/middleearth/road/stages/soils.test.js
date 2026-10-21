import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { STAGES } from './index';
import { SOILS, soilOf } from './soils';

const index = JSON.parse(readFileSync('public/cc0/galaxy/index.json', 'utf8'));

describe('the stages’ soils', () => {
  it('a soil for every stage, and none for a stage that isn’t', () => {
    expect(Object.keys(SOILS).sort()).toEqual(STAGES.map((s) => s.id).sort());
    expect(soilOf('nowhere')).toBe(SOILS.hobbiton);
  });

  it('each of three colours and a road and a rock, its blades between none and full', () => {
    for (const [id, s] of Object.entries(SOILS)) {
      expect(s.greens, id).toHaveLength(3);
      for (const c of [...s.greens, s.dirt, s.rock]) expect(Number.isInteger(c) && c >= 0 && c <= 0xffffff, id).toBe(true);
      expect(s.blades, id).toBeGreaterThanOrEqual(0);
      expect(s.blades, id).toBeLessThanOrEqual(1);
      if (s.blades > 0) expect(s.blade, id).toBeGreaterThan(0.2);
    }
  });

  it('every scan a role the site has, its colour and relief on disk', () => {
    for (const [id, s] of Object.entries(SOILS))
      for (const role of Object.values(s.scans)) {
        expect(index[role], `${id}: ${role}`).toBeTruthy();
        for (const f of ['color', 'normal']) expect(existsSync(`public/cc0/galaxy/${role}/${f}.webp`), `${role}/${f}`).toBe(true);
      }
  });

  it('no grass where nothing grows: the deeps, the stair and the ash', () => {
    for (const id of ['moria', 'cirith-ungol', 'gorgoroth']) expect(SOILS[id].blades, id).toBe(0);
  });

  it('Mordor’s fires glow up from its ground, a red, and nowhere else', () => {
    for (const [id, s] of Object.entries(SOILS)) {
      if (s.glow == null) continue;
      expect(['cirith-ungol', 'gorgoroth'], id).toContain(id);
      expect(s.glow >> 16, id).toBeGreaterThan(s.glow & 0xff);
    }
    for (const id of ['cirith-ungol', 'gorgoroth']) expect(SOILS[id].glow, id).toBeTruthy();
  });
});
