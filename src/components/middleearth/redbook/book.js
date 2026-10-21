// The book, pure: which page is open, how far the cover is, and the leaf
// in the air while a page turns (the design’s §5). Pages are the tale’s
// fifteen (./pages.js) and then the two back pages, so the book’s places
// run 0 … LAST. A turn of any length is one leaf (a jump riffles), and a
// turn asked while one is in the air waits for it to land.
//
//   newBook({ reduced, page, cover }) → the book
//   stepBook(book, dt) → the next
//   turnTo(book, page) → the book with that turn begun (or queued)
//   open(book, 'from' | 'to') → 0…1, how open the spread on show is, for its pop-up
//   leaf(book) → 0…1 the leaf’s way over, or null
//   pageFromAddress(id) → the place a ?page= names, or null

import { BACK, PAGES, pageIndex } from './pages';

export const LAST = PAGES.length + BACK.length - 1;
export const TURN = 1.4; // s a turn takes: the pop-up folds, the leaf goes over, the next stands
const REST = 1.2; // s the shut book lies before it opens itself
const OPENING = 1.6; // s the cover takes to swing

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const within = (n) => clamp(Math.round(n), 0, LAST);

export function newBook({ reduced = false, page = 0, cover } = {}) {
  return { page: within(page), cover: cover ?? (reduced ? 1 : 0), rest: REST, turning: null, queued: null, reduced };
}

export function turnTo(book, page) {
  const to = within(page);
  if (book.turning) return { ...book, queued: to === book.turning.to ? null : to };
  if (to === book.page) return book;
  if (book.reduced) return { ...book, page: to, cover: 1 };
  return { ...book, cover: 1, turning: { from: book.page, to, t: 0 } };
}

export function stepBook(book, dt) {
  let b = book;
  if (b.cover < 1) {
    const rest = Math.max(0, b.rest - dt);
    const spare = Math.max(0, dt - b.rest);
    b = { ...b, rest, cover: rest > 0 ? b.cover : clamp(b.cover + spare / OPENING) };
  }
  if (!b.turning) return b;
  const t = b.turning.t + dt / TURN;
  if (t < 1) return { ...b, turning: { ...b.turning, t } };
  const landed = { ...b, page: b.turning.to, turning: null, queued: null };
  return b.queued == null ? landed : turnTo(landed, b.queued);
}

// A turn in three parts: the spread going folds flat (the first FOLD of
// it), the leaf goes over (LEAF), the spread coming stands up (the rest).
const FOLD = 0.3;
const LEAF = [0.3, 0.85];

// how open a spread stands: the one going, falling flat before the leaf
// lifts; the one coming, rising as the leaf lands; at rest, the cover’s
export function open(book, which = 'from') {
  if (!book.turning) return which === 'to' ? 0 : book.cover;
  const t = book.turning.t;
  return which === 'to' ? clamp((t - 0.7) / 0.3) : clamp(1 - t / FOLD);
}

// the leaf’s way over, 0 lying where it began to 1 where it lands; null at rest
export function leaf(book) {
  if (!book.turning) return null;
  return clamp((book.turning.t - LEAF[0]) / (LEAF[1] - LEAF[0]));
}

export function pageFromAddress(id) {
  if (!id) return null;
  const i = pageIndex(id);
  if (i >= 0) return i;
  const back = BACK.findIndex((b) => b.id === id);
  return back >= 0 ? PAGES.length + back : null;
}
