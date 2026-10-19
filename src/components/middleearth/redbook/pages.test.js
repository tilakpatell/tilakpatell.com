import { describe, expect, it } from 'vitest';
import { BACK, PAGES, pageById, pageIndex } from './pages';
import { CHAPTERS } from '../chapters';
import { HIDDEN } from '../hidden';
import { STAGES } from '../road/stages/index';
import { place } from '../geography';

const games = new Set([...CHAPTERS, ...HIDDEN].map((c) => c.id));
const stages = new Set(STAGES.map((s) => s.id));

describe('the Red Book’s pages', () => {
  it('runs from Bag End to the Havens, fifteen pages, each id once', () => {
    expect(PAGES).toHaveLength(15);
    expect(PAGES[0].id).toBe('bag-end');
    expect(PAGES.at(-1).id).toBe('havens');
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
  });

  it('gives each page a title, a date, a tale and a place on the map', () => {
    for (const p of PAGES) {
      expect(p.title, p.id).toMatch(/^\S/);
      expect(p.date, p.id).toMatch(/\d{4}$/);
      expect(p.tale.length, p.id).toBeGreaterThan(60);
      expect(() => place(p.place), p.id).not.toThrow();
    }
  });

  it('plays a game that is there and walks a stage of the Road that is there', () => {
    for (const p of PAGES) {
      if (p.play) expect(games.has(p.play), `${p.id} plays ${p.play}`).toBe(true);
      if (p.walk) expect(stages.has(p.walk), `${p.id} walks ${p.walk}`).toBe(true);
      expect(p.play || p.walk, p.id).toBeTruthy();
    }
  });

  it('has three to five toys a page, and one thing to find under the Ring', () => {
    for (const p of PAGES) {
      expect(p.toys.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.toys.length, p.id).toBeLessThanOrEqual(5);
      expect(new Set(p.toys.map((t) => t.id)).size, p.id).toBe(p.toys.length);
      expect(p.find?.id, p.id).toBeTruthy();
      expect(p.find.name, p.id).toMatch(/^\S/);
    }
  });

  it('keeps every find’s id apart from every other page’s', () => {
    const ids = PAGES.map((p) => p.find.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('says a toy’s words in the site’s voice: no exclamation marks, curly quotes', () => {
    for (const p of PAGES) {
      for (const t of [p.tale, p.find.name, ...p.toys.map((x) => x.say ?? '')]) {
        expect(t, p.id).not.toMatch(/!/);
        expect(t, p.id).not.toMatch(/['"]/);
      }
    }
  });

  it('names who a toy is, when it is someone to meet', () => {
    const met = PAGES.flatMap((p) => p.toys.filter((t) => t.who));
    expect(met.length).toBeGreaterThanOrEqual(8);
    for (const t of met) expect(t.who).toMatch(/^[a-z]+$/);
  });

  it('finds a page by id, and its place in the book', () => {
    expect(pageById('bree').title).toBe('The Prancing Pony');
    expect(pageById('nowhere')).toBeNull();
    expect(pageIndex('bag-end')).toBe(0);
    expect(pageIndex('havens')).toBe(14);
    expect(pageIndex('nowhere')).toBe(-1);
  });

  it('ends with the two back pages', () => {
    expect(BACK.map((b) => b.id)).toEqual(['met', 'kept']);
  });
});
