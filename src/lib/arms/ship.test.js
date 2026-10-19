import { describe, expect, it } from 'vitest';
import { WEAPONS, burstOf, byCode, rackOf } from './ship';

describe('the ships’ weapons, one table for every world that flies them', () => {
  it('gives every weapon a wire code of its own under 16, its line and the numbers a shot needs', () => {
    const codes = Object.values(WEAPONS).map((w) => w.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(Number.isInteger(w.code) && w.code >= 0 && w.code < 16, id).toBe(true);
      expect(['primary', 'secondary', 'ordnance'], id).toContain(w.line);
      for (const k of ['cadence', 'count', 'life', 'speed', 'damage', 'punch', 'scale']) expect(Number.isFinite(w[k]), `${id}.${k}`).toBe(true);
    }
  });
  it('reads a shot’s weapon from its code, the blaster for one it doesn’t know', () => {
    expect(byCode(WEAPONS.heavy.code)).toBe('heavy');
    expect(byCode(99)).toBe('blaster');
  });
  it('keeps the skill tree’s four on codes of their own, after the seven there were', () => {
    const unique = Object.entries(WEAPONS).filter(([, w]) => w.unique);
    expect(unique.map(([id]) => id)).toEqual(['seismic', 'darkmatter', 'crystal', 'energon']);
    expect(unique.map(([, w]) => w.code)).toEqual([7, 8, 9, 10]);
    expect([WEAPONS.seismic.ammo, WEAPONS.seismic.reload, WEAPONS.crystal.ammo]).toEqual([2, 10, 3]);
    for (const [id, w] of unique) expect(w.heavy === true, id).toBe(w.line === 'ordnance');
  });
  it('weighs a rack and a burst against the hunters', () => {
    expect(rackOf(WEAPONS.heavy)).toBeCloseTo((8 * 4) / 6.5);
    expect(burstOf(WEAPONS.spread)).toBeCloseTo((5 * 0.6) / 2.4);
  });
});
