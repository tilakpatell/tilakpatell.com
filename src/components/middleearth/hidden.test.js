import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './chapters';
import { HIDDEN, hidden, hiddenAt } from './hidden';
import { placeAt } from './sheet';

describe('the hidden places', () => {
  it('stand where Tolkien’s geography puts them', () => {
    expect(hidden('orthanc').at).toEqual(placeAt('isengard'));
    // (Minas Tirith was one: a chapter now, on the road after Mount Doom)
    expect(hidden('minas-tirith')).toBeNull();
    expect(hidden('edoras').at).toEqual(placeAt('edoras'));
    expect(hidden('rivendell')).toBeNull();
  });
  it('are found by a click on them, and only there', () => {
    for (const h of HIDDEN) {
      expect(hiddenAt(...h.at)).toBe(h);
      expect(hiddenAt(h.at[0] + h.reach + 1, h.at[1])).not.toBe(h);
    }
  });
  it('sit clear of every chapter’s pin, so a click on a pin never finds one', () => {
    for (const h of HIDDEN) for (const c of CHAPTERS) expect(Math.hypot(h.at[0] - c.at[0], h.at[1] - c.at[1]), `${h.id} ${c.id}`).toBeGreaterThan(20);
    for (const c of CHAPTERS) expect(hiddenAt(...c.at), c.id).toBeNull();
  });
});
