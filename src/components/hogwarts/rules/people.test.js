import { describe, expect, it } from 'vitest';
import { CURFEW, HOUR_S, ROSTER, dayKind, dayName, dayOf, everyone, positionAt, whereIs } from './people';
import { spotById } from './paths';

// a Monday, a Tuesday and a Saturday of the fourth week (a village
// Saturday), from the arrival’s midnight
const MON = 3 * 24;
const SAT = 5 * 24;
const at = (id, time, week = 4) => positionAt(id, time, week);
const near = (p, spot, r = spotById(spot).r + 3) => Math.hypot(p.x - spotById(spot).at[0], p.z - spotById(spot).at[1]) <= r;

describe('everyone’s day', () => {
  it('names every figure the Map shows', () => {
    const ids = ROSTER.map((r) => r.id);
    for (const id of ['harry', 'ron', 'hermione', 'malfoy', 'hagrid', 'dumbledore', 'mcgonagall', 'snape', 'filch', 'norris', 'percy', 'nick', 'greylady', 'friar', 'baron', 'peeves']) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ROSTER.filter((r) => r.ghost).map((r) => r.id).sort()).toEqual(['baron', 'friar', 'greylady', 'nick']);
  });

  it('has a place for every figure at every hour of every kind of day', () => {
    for (const week of [1, 3, 4, 6, 12])
      for (const r of ROSTER)
        for (let h = 0; h < 72; h += 1) {
          const w = whereIs(r.id, h, week);
          expect(spotById(w.place), `${r.id} at ${h} in week ${week}`).not.toBeNull();
          const p = positionAt(r.id, h, week);
          expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
        }
  });

  it('walks, never jumps: no figure moves faster than it can between two looks', () => {
    // (a carriage at 9 m/s, Peeves at 4.5; nobody else over a brisk walk)
    const dt = 1 / 20; // h: three real seconds
    for (const r of ROSTER) {
      let prev = null;
      for (let t = MON - 2; t < SAT + 26; t += dt) {
        const p = positionAt(r.id, t, 4);
        if (prev) expect(Math.hypot(p.x - prev[0], p.z - prev[1]), `${r.id} at ${t.toFixed(2)}`).toBeLessThanOrEqual(9 * dt * HOUR_S + 0.5);
        prev = [p.x, p.z];
      }
    }
  });

  it('keeps every third day for Saturday', () => {
    expect([0, 1, 2, 3, 4, 5].map(dayKind)).toEqual(['weekday', 'weekday', 'weekend', 'weekday', 'weekday', 'weekend']);
    expect(dayName(5)).toBe('Saturday');
  });

  it('puts Hagrid at his hut by day and in the Three Broomsticks on a Saturday night', () => {
    const noon = at('hagrid', MON + 13);
    expect(noon.place).toBe('hut');
    expect(near(noon, 'hut')).toBe(true);
    const night = whereIs('hagrid', SAT + 20, 4);
    expect(night.place).toBe('broomsticks');
    expect(night.inside).toBe('broomsticks');
    // (and back home by the small hours)
    expect(whereIs('hagrid', SAT + 24 + 3, 4).place).toBe('hut');
  });

  it('keeps Snape in his dungeons', () => {
    const p = whereIs('snape', MON + 11, 4);
    expect(p.place).toBe('potions');
    expect(spotById(p.place).below).toBe(true);
    expect(whereIs('snape', MON + 2, 4).place).toBe('slytherin');
  });

  it('sends Filch on his rounds after curfew with Mrs Norris a step ahead', () => {
    const h = MON + CURFEW + 1.5;
    expect(whereIs('filch', h, 4).round).toBe('filch');
    for (let t = h; t < h + 2; t += 0.25) {
      const f = at('filch', t);
      const n = at('norris', t);
      const d = Math.hypot(f.x - n.x, f.z - n.z);
      expect(d, `at ${t}`).toBeGreaterThan(3);
      expect(d, `at ${t}`).toBeLessThan(14);
      // (ahead: the way he is going)
      expect((n.x - f.x) * f.dx + (n.z - f.z) * f.dz).toBeGreaterThan(-2);
    }
    // (by day he keeps his office and the halls)
    expect(whereIs('filch', MON + 7, 4).place).toBe('filch-office');
  });

  it('goes on with a round through midnight rather than starting it over', () => {
    const before = at('filch', MON + 23.99);
    const after = at('filch', MON + 24.01);
    expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeLessThan(3);
    expect(whereIs('filch', MON + 24.5, 4).round).toBe('filch');
  });

  it('sets the prefects on the Grand Staircase in the evening', () => {
    for (const id of ['percy', 'penelope']) {
      const w = whereIs(id, MON + 21.2, 4);
      expect(w.round).toBe('prefects');
      expect(['staircase', 'castle']).toContain(w.inside);
    }
  });

  it('feeds the students at their tables, teaches them and puts them to bed', () => {
    for (const r of ROSTER.filter((x) => x.kind === 'student')) {
      const lunch = at(r.id, MON + 13.9);
      expect(lunch.place, r.id).toBe(`table-${r.house}`);
      const night = whereIs(r.id, MON + 2, 4);
      expect(night.place, r.id).toBe(r.house);
      expect(night.rest).toBe(true);
    }
    expect(whereIs('hermione', MON + 20.5, 4).place).toBe('library');
  });

  it('takes the school to Hogsmeade on a village Saturday, and to the pitch on a match’s', () => {
    expect(['honeydukes', 'broomsticks', 'high-street']).toContain(whereIs('ron', SAT + 13.5, 4).place);
    expect(whereIs('ron', SAT + 11, 3).place).toBe('pitch');
    // (and not in the first weeks)
    expect(whereIs('ron', SAT + 13.5, 2).place).not.toBe('broomsticks');
  });

  it('seats everyone at the feasts', () => {
    expect(whereIs('harry', MON + 19.5, 6).place).toBe('table-gryffindor');
    expect(whereIs('dumbledore', MON + 19.5, 12).place).toBe('high-table');
    expect(whereIs('nick', MON + 19.5, 6).place).toBe('table-gryffindor');
    expect(dayOf('hagrid', 3, 6).some(([, w]) => w === 'high-table')).toBe(true);
  });

  it('keeps the ghosts on their floors and Peeves anywhere, the same anywhere every time', () => {
    expect(whereIs('greylady', MON + 10, 4).place).toBe('library');
    expect(whereIs('friar', MON + 15, 4).place).toBe('kitchens');
    const a = whereIs('peeves', MON + 9.3, 4).place;
    expect(whereIs('peeves', MON + 9.3, 4).place).toBe(a);
    const haunts = new Set();
    for (let h = 0; h < 24; h += 0.7) haunts.add(whereIs('peeves', MON + h, 4).place);
    expect(haunts.size).toBeGreaterThan(6);
  });

  it('lands everyone where they would be whatever order they are asked in', () => {
    const late = at('ron', SAT + 16.2);
    const fresh = everyone(SAT + 16.2, 4).find((p) => p.id === 'ron');
    expect(fresh.x).toBeCloseTo(late.x, 6);
    expect(fresh.z).toBeCloseTo(late.z, 6);
    expect(everyone(MON, 4)).toHaveLength(ROSTER.length);
  });

  it('rides the carriages on the road', () => {
    let rode = false;
    for (let t = SAT + 8; t < SAT + 12; t += 0.05) rode ||= at('harry', t).ride;
    expect(rode).toBe(true);
  });
});
