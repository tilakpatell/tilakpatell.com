import { describe, expect, it } from 'vitest';
import { LAST, TURN, leaf, newBook, open as openOf, pageFromAddress, stepBook, turnTo } from './book';
import { PAGES } from './pages';

describe('the book', () => {
  it('starts shut, at the first page, and opens itself', () => {
    const b = newBook();
    expect(b.page).toBe(0);
    expect(b.cover).toBe(0);
    let s = b;
    for (let i = 0; i < 400; i++) s = stepBook(s, 1 / 60);
    expect(s.cover).toBe(1);
  });

  it('opens at once under reduced motion, or at the page asked', () => {
    const b = newBook({ reduced: true, page: 4 });
    expect(b.cover).toBe(1);
    expect(b.page).toBe(4);
  });

  it('turns a page over TURN seconds, then lands on it', () => {
    let b = turnTo(newBook({ reduced: false, page: 2, cover: 1 }), 3);
    expect(b.turning).toMatchObject({ from: 2, to: 3, t: 0 });
    b = stepBook(b, TURN / 2);
    expect(b.turning.t).toBeCloseTo(0.5);
    expect(b.page).toBe(2);
    b = stepBook(b, TURN);
    expect(b.turning).toBeNull();
    expect(b.page).toBe(3);
  });

  it('cuts a turn under reduced motion', () => {
    const b = turnTo(newBook({ reduced: true, page: 0 }), 5);
    expect(b.turning).toBeNull();
    expect(b.page).toBe(5);
  });

  it('keeps inside the book: the back pages are the last two places', () => {
    expect(LAST).toBe(PAGES.length + 1);
    expect(turnTo(newBook({ reduced: true }), -3).page).toBe(0);
    expect(turnTo(newBook({ reduced: true }), 99).page).toBe(LAST);
  });

  it('takes a turn asked during a turn once the first lands', () => {
    let b = turnTo(newBook({ page: 1, cover: 1 }), 2);
    b = turnTo(b, 3);
    expect(b.queued).toBe(3);
    b = stepBook(b, TURN + 0.01);
    expect(b.page).toBe(2);
    expect(b.turning).toMatchObject({ from: 2, to: 3 });
  });

  it('a jump of many pages riffles as one turn', () => {
    const b = turnTo(newBook({ page: 0, cover: 1 }), 9);
    expect(b.turning).toMatchObject({ from: 0, to: 9 });
  });

  it('says how open the spread on show is, for its pop-up', () => {
    expect(openOf(newBook({ page: 0 }))).toBe(0);
    expect(openOf(newBook({ page: 0, cover: 1 }))).toBe(1);
    const b = stepBook(turnTo(newBook({ page: 0, cover: 1 }), 1), TURN * 0.25);
    // the page going falls flat as the leaf lifts; the one coming rises as it lands
    expect(openOf(b, 'from')).toBeLessThan(1);
    expect(openOf(b, 'to')).toBe(0);
    const late = stepBook(b, TURN * 0.6);
    expect(openOf(late, 'to')).toBeGreaterThan(0);
  });

  it('folds the pop-up flat before the leaf lifts, and stands the next once it lands', () => {
    const b = turnTo(newBook({ page: 0, cover: 1 }), 1);
    expect(leaf(b)).toBe(0);
    const folded = stepBook(b, TURN * 0.3);
    expect(openOf(folded, 'from')).toBeCloseTo(0);
    expect(leaf(folded)).toBeCloseTo(0);
    const over = stepBook(b, TURN * 0.85);
    expect(leaf(over)).toBeCloseTo(1);
    expect(openOf(over, 'to')).toBeGreaterThan(0);
    expect(leaf(newBook())).toBeNull();
  });

  it('reads ?page= from the address', () => {
    expect(pageFromAddress('bree')).toBe(2);
    expect(pageFromAddress('met')).toBe(PAGES.length);
    expect(pageFromAddress('kept')).toBe(PAGES.length + 1);
    expect(pageFromAddress('mordor')).toBeNull();
    expect(pageFromAddress(null)).toBeNull();
  });
});
