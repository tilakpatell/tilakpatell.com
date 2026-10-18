import { describe, expect, it } from 'vitest';
import { PLACES, SECTORS, SECTOR_RADIUS, sectorOf } from '../../universe/shared/space';
import { HOME_KEEP, KEEP_OUTS, clearOfKeepOuts, keepOutsNear } from './keepOuts';

const ids = (rows) => rows.map((r) => r.id);

describe('keep-outs', () => {
  it('puts home first', () => {
    expect(KEEP_OUTS[0]).toEqual({ id: 'home', at: [0, 0, 0], r: 8000 });
    expect(HOME_KEEP).toBe(8000);
  });

  it('keeps three reaches round each main-map place that is not a station', () => {
    const wanted = PLACES.filter((p) => p.kind !== 'station' && sectorOf(...p.at) === 'main');
    expect(wanted.length).toBeGreaterThan(0);
    for (const p of wanted) {
      // (ids are not unique across the sources, so a row is found by id and where it sits)
      const row = KEEP_OUTS.find((k) => k.id === p.id && k.at.every((v, i) => v === p.at[i]));
      expect(row, p.id).toBeDefined();
      expect(row.r).toBe(3 * p.reach);
      expect(row.at).not.toBe(p.at);
    }
  });

  it('keeps the Rick and Morty pocket out as one sphere', () => {
    const rows = KEEP_OUTS.filter((k) => k.at.every((v, i) => v === SECTORS.rickmorty.origin[i]));
    expect(rows).toEqual([{ id: 'rickmorty', at: SECTORS.rickmorty.origin, r: SECTOR_RADIUS.rickmorty + 4000 }]);
  });

  it('has no row for a station or for a place inside the pocket', () => {
    const wanted = PLACES.filter((p) => p.kind !== 'station' && sectorOf(...p.at) === 'main');
    // home, one per wanted place, and the pocket: nothing else
    expect(KEEP_OUTS).toHaveLength(wanted.length + 2);
    expect(PLACES.some((p) => sectorOf(...p.at) === 'rickmorty' || p.kind === 'station')).toBe(true);
  });

  it('finds the keep-outs that meet a sector', () => {
    expect(ids(keepOutsNear(0, 0, 0))).toContain('home');
    expect(ids(keepOutsNear(0, 0, -1))).toContain('rickmorty');
    expect(keepOutsNear(5, 0, 5)).toEqual([]);
    expect(keepOutsNear(0, 2, 0)).toEqual([]);
  });

  it('clears a point only when it is a sphere plus its extent away', () => {
    expect(clearOfKeepOuts([0, 0, 8040], 50)).toBe(false);
    expect(clearOfKeepOuts([0, 0, 8100], 50)).toBe(true);
    expect(clearOfKeepOuts([0, 0, 8040], 50, [])).toBe(true);
  });
});
