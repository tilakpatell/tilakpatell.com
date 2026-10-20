import { describe, expect, it } from 'vitest';
import { CLIPS } from '../../../lib/clips';
import { ROOM, VIEWS, nextLine, nextView, roomThing } from './room';

describe('the study’s things', () => {
  it('names each thing once, says something, and does something the room knows', () => {
    const acts = new Set(['stoke', 'snuff', 'rings', 'draw', 'glint', 'swing', 'book', 'map', 'door', 'window']);
    expect(new Set(ROOM.map((t) => t.id)).size).toBe(ROOM.length);
    for (const t of ROOM) {
      expect(t.name, t.id).toMatch(/^\S/);
      expect(acts.has(t.act), `${t.id}: ${t.act}`).toBe(true);
      expect(nextLine(t, 0).length, t.id).toBeGreaterThan(10);
    }
  });

  it('speaks in the site’s voice, and the films only through clips the site has', () => {
    for (const t of ROOM) {
      for (const s of [t.say ?? '', ...(t.lines ?? [])]) {
        expect(s, t.id).not.toMatch(/!/);
        expect(s, t.id).not.toMatch(/['"]/);
      }
      if (t.clip) expect(CLIPS[t.clip], `${t.id}: ${t.clip}`).toBeTruthy();
      if (t.to) expect(t.to).toMatch(/^\/middle-earth\//);
    }
  });

  it('says Sting is drawn, then put back, in turn with it', () => {
    const sting = roomThing('sting');
    expect(nextLine(sting, 0)).toMatch(/Drawn/);
    expect(nextLine(sting, 1)).toMatch(/Back on its peg/);
    expect(nextLine(sting, 2)).toBe(nextLine(sting, 0));
  });

  it('turns the books’ pages one title at a time, round again', () => {
    const books = roomThing('books');
    expect(nextLine(books, 0)).not.toBe(nextLine(books, 1));
    expect(nextLine(books, books.lines.length)).toBe(nextLine(books, 0));
    expect(nextLine(books, -1)).toBe(books.lines.at(-1));
    expect(roomThing('nowhere')).toBeNull();
  });

  it('moves the view by its keys, and back to the book on the same key', () => {
    expect(VIEWS).toContain('window');
    expect(nextView('book', 'KeyW')).toBe('window');
    expect(nextView('window', 'KeyW')).toBe('book');
    expect(nextView('book', 'KeyL')).toBe('look');
    expect(nextView('look', 'KeyB')).toBe('book');
    expect(nextView('look', 'KeyQ')).toBe('look');
  });
});
