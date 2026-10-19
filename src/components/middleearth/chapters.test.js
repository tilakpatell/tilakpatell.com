import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapter, neighbours, stopOf } from './chapters';
import { STOPS } from './road';
import { SHEET } from './mapData';

describe('the places on the map', () => {
  it('each has its own id and sits on the sheet', () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    for (const c of CHAPTERS) {
      expect(c.at[0]).toBeGreaterThan(0);
      expect(c.at[0]).toBeLessThan(SHEET.w);
      expect(c.at[1]).toBeGreaterThan(0);
      expect(c.at[1]).toBeLessThan(SHEET.h);
    }
  });
  it('finds a place by id, and nothing for one not on the map', () => {
    expect(chapter('moria').name).toBe('Moria');
    expect(chapter('narnia')).toBeNull();
    expect(chapter(undefined)).toBeNull();
  });
  it('goes along the road from the Shire to Mordor', () => {
    expect(neighbours('shire')).toEqual({ prev: null, next: chapter('bree') });
    expect(neighbours('bree')).toEqual({ prev: chapter('shire'), next: chapter('weathertop') });
    expect(neighbours('weathertop')).toEqual({ prev: chapter('bree'), next: chapter('rivendell') });
    expect(neighbours('moria').prev.id).toBe('rivendell');
    expect(neighbours('mordor').next).toBeNull();
    expect(neighbours(undefined)).toEqual({ prev: null, next: null });
  });
  it('stands each place where its stop is, so a fly-down lands on its landmark', () => {
    for (const c of CHAPTERS) {
      const s = STOPS[stopOf(c.id)];
      expect(s.id, c.id).toBe(c.stop);
      expect(c.at, c.id).toEqual([s.x, s.y]);
    }
  });
});
