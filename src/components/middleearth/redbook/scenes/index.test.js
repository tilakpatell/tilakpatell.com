import { describe, expect, it } from 'vitest';
import { BACK_SCENES, SCENES } from './index';
import { BACK, PAGES } from '../pages';

const ACTS = new Set(['hop', 'sway', 'swing', 'light', 'burst', 'fly', 'rise', 'sail', 'chain', 'show', 'shine', 'sniff', 'creep', 'knock', 'speak', 'tentacle', 'thud', 'raise', 'tear', 'stare']);

describe('the pop-ups', () => {
  it('has one for every page, and a ground for every back page', () => {
    for (const p of PAGES) expect(SCENES[p.id], p.id).toBeTruthy();
    for (const b of BACK) expect(typeof BACK_SCENES[b.id]?.ground, b.id).toBe('function');
    expect(Object.keys(SCENES).sort()).toEqual(PAGES.map((p) => p.id).sort());
  });

  it('gives every toy a piece to touch, and every piece’s toy is the page’s', () => {
    for (const page of PAGES) {
      const pieces = SCENES[page.id].pieces;
      for (const toy of page.toys) expect(pieces.some((x) => x.toy === toy.id), `${page.id}: ${toy.id}`).toBe(true);
      for (const x of pieces) if (x.toy) expect(page.toys.some((t) => t.id === x.toy), `${page.id}: ${x.id}`).toBe(true);
    }
  });

  it('hides one thing to find on each page, under the Ring', () => {
    for (const page of PAGES) {
      const finds = SCENES[page.id].pieces.filter((x) => x.find);
      expect(finds, page.id).toHaveLength(1);
      expect(finds[0].ghost, page.id).toBe(true);
    }
  });

  it('keeps every piece on its spread, with an id once, and acts it knows', () => {
    for (const page of PAGES) {
      const pieces = SCENES[page.id].pieces;
      expect(new Set(pieces.map((x) => x.id)).size, page.id).toBe(pieces.length);
      for (const x of pieces) {
        expect(Math.abs(x.at[0]), `${page.id}: ${x.id}`).toBeLessThanOrEqual(0.24);
        expect(Math.abs(x.at[1]), `${page.id}: ${x.id}`).toBeLessThanOrEqual(0.165);
        expect(['card', 'glow'].includes(x.kind), `${page.id}: ${x.id}`).toBe(true);
        for (const d of x.does ?? []) {
          expect(ACTS.has(d.act), `${page.id}: ${x.id} ${d.act}`).toBe(true);
          for (const t of d.target ?? []) expect(pieces.some((y) => y.id === t), `${page.id}: ${x.id} → ${t}`).toBe(true);
        }
      }
    }
  });

  it('keeps a spread under forty pieces, for the draws', () => {
    for (const page of PAGES) expect(SCENES[page.id].pieces.length, page.id).toBeLessThanOrEqual(40);
  });
});
