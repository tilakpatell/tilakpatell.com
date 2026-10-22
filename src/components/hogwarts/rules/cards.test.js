import { describe, expect, it } from 'vitest';
import { CARDS, binder, cardById, find, foundCount, hiddenIn } from './cards';
import { spotById } from './paths';

describe('the Chocolate Frog cards', () => {
  it('are twenty witches and wizards, each with a card’s worth of words and somewhere to hide', () => {
    expect(CARDS).toHaveLength(20);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(20);
    for (const c of CARDS) {
      expect(c.name.length, c.id).toBeGreaterThan(3);
      expect(c.title.length, c.id).toBeGreaterThan(3);
      const words = c.text.split(/\s+/).length;
      expect(words, c.id).toBeGreaterThan(15);
      expect(words, c.id).toBeLessThan(45);
      expect(c.text, c.id).toMatch(/\.$/);
      expect(c.hint.length, c.id).toBeGreaterThan(8);
      expect(Boolean(c.where.room) !== Boolean(c.where.place), c.id).toBe(true);
      if (c.where.place) expect(spotById(c.where.place), c.id).not.toBeNull();
    }
  });

  it('hide one to a place, spread through the castle, the grounds and the village', () => {
    const where = CARDS.map((c) => c.where.room ?? c.where.place);
    expect(new Set(where).size).toBe(20);
    expect(hiddenIn({ room: 'requirement' }).map((c) => c.id)).toEqual(['dumbledore']);
    expect(hiddenIn({ place: 'pitch' }).map((c) => c.id)).toEqual(['jones']);
    expect(hiddenIn({ room: 'nowhere' })).toEqual([]);
  });

  it('are each found once', () => {
    let found = [];
    let fresh = 0;
    for (const id of ['merlin', 'merlin', 'circe', 'nobody', 'merlin']) {
      const r = find(found, id);
      found = r.found;
      if (r.fresh) fresh++;
    }
    expect(found).toEqual(['merlin', 'circe']);
    expect(fresh).toBe(2);
    expect(foundCount(found)).toBe(2);
    expect(cardById('merlin').name).toBe('Merlin');
  });

  it('fill the binder in its own order, the empty pockets with their hints', () => {
    const rows = binder(['circe']);
    expect(rows).toHaveLength(20);
    expect(rows[0].id).toBe('dumbledore');
    expect(rows.find((r) => r.id === 'circe').found).toBe(true);
    expect(rows.filter((r) => r.found)).toHaveLength(1);
  });
});
