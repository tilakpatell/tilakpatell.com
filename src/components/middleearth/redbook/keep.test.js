import { describe, expect, it } from 'vitest';
import { KEEP, allFound, emptyKeep, find, meet, readKeep } from './keep';
import { PAGES } from './pages';

describe('what the book keeps', () => {
  it('starts empty, and says its save’s key and version', () => {
    expect(emptyKeep()).toEqual({ met: [], found: [], toys: [] });
    expect(KEEP).toMatchObject({ key: expect.any(String), version: expect.any(Number) });
  });

  it('meets a character once, in the order met', () => {
    let k = meet(emptyKeep(), 'gandalf');
    k = meet(k, 'sam');
    k = meet(k, 'gandalf');
    expect(k.met).toEqual(['gandalf', 'sam']);
  });

  it('finds a page’s thing once, and knows when all are found', () => {
    let k = emptyKeep();
    for (const p of PAGES.slice(1)) k = find(k, p.id);
    expect(allFound(k)).toBe(false);
    k = find(k, PAGES[0].id);
    k = find(k, PAGES[0].id);
    expect(k.found).toHaveLength(PAGES.length);
    expect(allFound(k)).toBe(true);
  });

  it('reads a save it can, and starts again on one it cannot', () => {
    expect(readKeep({ met: ['sam'], found: ['bree', 'nowhere'], toys: ['bree:bell'] })).toEqual({ met: ['sam'], found: ['bree'], toys: ['bree:bell'] });
    expect(readKeep(null)).toEqual(emptyKeep());
    expect(readKeep({ met: 'sam' })).toEqual(emptyKeep());
  });
});
