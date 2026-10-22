import { describe, expect, it } from 'vitest';
import { CARDS, binder, cardById, cardsIn, find, foundCount, hiddenIn, roomOf, spotFor } from './cards';
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

describe('the cards in the rooms you can go into', () => {
  it('are the ones hidden there and not yet found, your own common room’s among them', () => {
    expect(cardsIn('greatHall').map((c) => c.id)).toEqual(['gryffindor']);
    expect(cardsIn('greatHall', { found: ['gryffindor'] })).toEqual([]);
    expect(cardsIn('ravenclaw', { house: 'ravenclaw' }).map((c) => c.id)).toEqual(['agrippa']);
    expect(cardsIn('ravenclaw', { house: 'slytherin' })).toEqual([]);
    expect(roomOf(cardById('agrippa'), 'hufflepuff')).toBe('hufflepuff');
  });

  it('lie by the place their hint names, or a few steps in from the door', () => {
    const hall = { places: [{ id: 'high-table', at: [0, -20] }], spawn: { at: [0, 0, 20], yaw: 0 } };
    expect(spotFor(cardById('gryffindor'), hall).at).toEqual([1.2, -17.8]);
    const at = spotFor(cardById('bott'), { spawn: { at: [0, 0, 5], yaw: 0 } }).at;
    expect(at[0]).toBeCloseTo(-1.2, 6);
    expect(at[1]).toBeCloseTo(2, 6);
  });
});
