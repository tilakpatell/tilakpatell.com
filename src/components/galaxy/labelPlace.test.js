import { describe, expect, it } from 'vitest';
import { SYSTEMS } from './systems';
import { DOT, HIDDEN, PLACES, SMALL_DOT, boxAt, estimateWidth, hangOf, overlapArea, placeLabels, sideOf } from './labelPlace';

// (a charted world's name is optional and its dot small, as the map has them)
const at = (box) => SYSTEMS.map((s) => ({ id: s.id, x: (s.pos[0] / 21) * box, y: (s.pos[1] / 21) * box, w: estimateWidth(s.name), h: 18, prio: 0, ...(s.charted && { optional: true, dot: SMALL_DOT }) }));
// the names shown (an optional one may have no place, its dot alone, or be hidden, dot and all)
const named = (places, id) => Boolean(places[id]) && places[id] !== HIDDEN;
const boxesOf = (items, places) => items.filter((it) => named(places, it.id)).map((it) => ({ id: it.id, ...boxAt(places[it.id], it.x, it.y, it.w, it.h) }));
const dotOf = (i) => {
  const r = i.dot ?? DOT;
  return { x0: i.x - r, y0: i.y - r, x1: i.x + r, y1: i.y + r };
};

// a box shrunk by `tol` all round: overlaps no deeper than that don't count (the browser check's half pixel)
const inner = (b, tol) => ({ ...b, x0: b.x0 + tol, y0: b.y0 + tol, x1: b.x1 - tol, y1: b.y1 - tol });
// the names, other than `id`'s own, whose dot the name of `id` covers
const boxOver = (items, places, id, tol = 0) => {
  const me = items.find((i) => i.id === id);
  if (!named(places, id)) return [];
  const b = inner(boxAt(places[id], me.x, me.y, me.w, me.h), tol);
  return items.filter((o) => o.id !== id && places[o.id] !== HIDDEN && overlapArea([b, dotOf(o)]) > 0).map((o) => o.id);
};

describe('labelPlace', () => {
  it('puts a lone name on the right', () => {
    expect(placeLabels([{ id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 }])).toEqual({ a: 'r' });
  });
  it('moves a name off a neighbour that would cover it', () => {
    const p = placeLabels([
      { id: 'a', x: 100, y: 100, w: 80, h: 18, prio: 1 },
      { id: 'b', x: 140, y: 102, w: 60, h: 18, prio: 0 },
    ]);
    expect(p.b).not.toBe('l');
    const boxes = boxesOf([{ id: 'a', x: 100, y: 100, w: 80, h: 18 }, { id: 'b', x: 140, y: 102, w: 60, h: 18 }], p);
    expect(overlapArea(boxes)).toBe(0);
    // neither name's label covers the other's dot
    const dot = (i) => ({ x0: i.x - DOT, y0: i.y - DOT, x1: i.x + DOT, y1: i.y + DOT });
    const a = { x: 100, y: 100, w: 80, h: 18 };
    const b = { x: 140, y: 102, w: 60, h: 18 };
    expect(overlapArea([boxAt(p.a, a.x, a.y, a.w, a.h), dot(b)])).toBe(0);
    expect(overlapArea([boxAt(p.b, b.x, b.y, b.w, b.h), dot(a)])).toBe(0);
  });
  it('places every system on a 600 px map with no name over another', () => {
    const items = at(600);
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 600, y1: 600 } });
    expect(overlapArea(boxesOf(items, p))).toBe(0);
  });
  it('places every system on a 600 px map with no name over another system’s dot', () => {
    const items = at(600);
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 600, y1: 600 } });
    const boxes = boxesOf(items, p);
    const covered = [];
    for (const box of boxes) for (const other of items) if (other.id !== box.id && p[other.id] !== HIDDEN && overlapArea([box, dotOf(other)]) > 0) covered.push(`${box.id} over ${other.id}`);
    expect(covered).toEqual([]);
  });
  it('keeps a name inside the map before it keeps it off a neighbour’s dot', () => {
    // a dot 6 px from the right edge of a 346 px map, a neighbour's dot 7 px to its left: the right's cut off by the edge (r, tr, br), the left covers the dot (l)
    const items = [
      { id: 'edge', x: 340, y: 100, w: 39, h: 20, prio: 0 },
      { id: 'next', x: 333, y: 100, w: 30, h: 20, prio: 5 },
    ];
    const bounds = { x0: 0, y0: 0, x1: 346, y1: 346 };
    const p = placeLabels(items, { bounds });
    const b = boxAt(p.edge, 340, 100, 39, 20);
    expect(b.x1).toBeLessThanOrEqual(346);
    expect(b.x0).toBeGreaterThanOrEqual(0);
  });
  it('keeps a name from under a control drawn over the map', () => {
    const lone = { id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 };
    const block = { x0: 105, y0: 80, x1: 200, y1: 120 };
    expect(placeLabels([lone])).toEqual({ a: 'r' });
    expect(placeLabels([lone], { blocks: [] })).toEqual({ a: 'r' });
    const p = placeLabels([lone], { blocks: [block] });
    expect(p.a).not.toBe('r');
    expect(overlapArea([boxAt(p.a, 100, 100, 60, 18), block])).toBe(0);
  });
  it('takes the place no control covers, when there is one', () => {
    const lone = { id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 };
    // controls over the right and the left of the dot: above or below is what's left
    const blocks = [{ x0: 105, y0: 92, x1: 200, y1: 108 }, { x0: 0, y0: 92, x1: 95, y1: 108 }];
    const p = placeLabels([lone], { blocks });
    expect(['t', 'b']).toContain(p.a);
    for (const k of blocks) expect(overlapArea([boxAt(p.a, 100, 100, 60, 18), k])).toBe(0);
  });
  it('counts a control as it counts a dot: a name goes under neither if there is room', () => {
    const items = [
      { id: 'a', x: 100, y: 100, w: 60, h: 18, prio: 0 },
      { id: 'b', x: 200, y: 200, w: 60, h: 18, prio: 0 },
    ];
    const dotOver = { x0: 118, y0: 92, x1: 132, y1: 108 }; // (b's dot's size, over a's right)
    const p = placeLabels(items, { blocks: [dotOver] });
    expect(overlapArea([boxAt(p.a, 100, 100, 60, 18), dotOver])).toBe(0);
  });
  it('leaves a dot under a control unnamed when asked, and its neighbours named as if it weren’t there', () => {
    // (the war's board over two dots whose names, out of sight, would only have crowded each other)
    const board = { x0: 0, y0: 0, x1: 120, y1: 60 };
    const items = [
      { id: 'yavin', x: 40, y: 30, w: 50, h: 18, prio: 0 },
      { id: 'mandalore', x: 46, y: 36, w: 80, h: 18, prio: 0 },
      { id: 'hoth', x: 200, y: 200, w: 50, h: 18, prio: 0 },
    ];
    const p = placeLabels(items, { blocks: [board], hideUnder: true });
    expect(p).toEqual({ yavin: null, mandalore: null, hoth: 'r' });
    // (not asked, as at the whole map: every name is placed, clear of the board where it can be)
    const whole = placeLabels(items, { blocks: [board] });
    expect(whole.yavin).toBeTruthy();
    expect(whole.mandalore).toBeTruthy();
    // (a name beside the board keeps clear of it, its dot out in the open)
    const edge = placeLabels([{ id: 'a', x: 130, y: 30, w: 60, h: 18, prio: 0 }], { blocks: [board], hideUnder: true });
    expect(edge.a).toBe('r');
  });
  it('does better than all-right on a phone-sized map', () => {
    const items = at(380);
    const right = Object.fromEntries(items.map((i) => [i.id, 'r']));
    const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: 380, y1: 380 } });
    expect(overlapArea(boxesOf(items, p))).toBeLessThan(overlapArea(boxesOf(items, right)) * 0.25);
  });
  it('gives a contested place to the higher priority', () => {
    const two = (pa, pb) => placeLabels([
      { id: 'here', x: 100, y: 100, w: 80, h: 18, prio: pa },
      { id: 'low', x: 100, y: 115, w: 80, h: 18, prio: pb },
    ]);
    const a = two(100, 0);
    expect(a.here).toBe('r');
    expect(a.low).not.toBe('r');
    const b = two(0, 100);
    expect(b.low).toBe('r');
    expect(b.here).not.toBe('r');
  });

  it('has the edge-hung places: above or below, from the dot’s left or right edge', () => {
    expect(PLACES).toEqual(expect.arrayContaining(['bs', 'be', 'ts', 'te']));
    const bs = boxAt('bs', 100, 100, 60, 16);
    expect(bs.x0).toBe(100 - DOT);
    expect(bs.y0).toBeGreaterThan(100 + DOT);
    const be = boxAt('be', 100, 100, 60, 16);
    expect(be.x1).toBe(100 + DOT);
    expect(boxAt('ts', 100, 100, 60, 16).y1).toBeLessThan(100 - DOT);
    expect(boxAt('te', 100, 100, 60, 16).x1).toBe(100 + DOT);
    // (the war's marks on a dot see them as above and below, hung from the left or the right)
    expect(['bs', 'be', 'b', 'ts', 'te', 't', 'r', 'tl'].map(sideOf)).toEqual(['b', 'b', 'b', 't', 't', 't', 'r', 'tl']);
    expect(['bs', 'be', 'ts', 'te', 'b', 't', 'r', 'tl'].map(hangOf)).toEqual(['s', 'e', 's', 'e', undefined, undefined, undefined, undefined]);
  });
  // three names 40 x 16, the first of the highest priority
  const three = (dots) => dots.map(([id, x, y], i) => ({ id, x, y, w: 40, h: 16, prio: 3 - i }));
  const clear = (items, p) => items.every((it) => boxOver(items, p, it.id, 0.5).length === 0) && overlapArea(boxesOf(items, p).map((b) => inner(b, 0.5))) === 0;
  it('moves a name placed early when a later one would be left with nowhere', () => {
    // a above b's dot, c's dot between them: greedy gives c the right, and it covers b's dot; a name that looks again moves
    const items = three([['a', 76, 68], ['b', 76, 82], ['c', 77, 77]]);
    const p = placeLabels(items);
    expect(clear(items, p)).toBe(true);
  });
  it('takes a place hung from the dot’s edge when it is the one that is clear', () => {
    // a's and b's dots 2 px apart, and c's near them: b's name goes below, hung from the dot's left edge, and covers no dot
    const items = three([['a', 90, 72], ['b', 90, 70], ['c', 96, 61]]);
    const p = placeLabels(items);
    expect(clear(items, p)).toBe(true);
    expect(Object.values(p).some((place) => ['bs', 'be', 'ts', 'te'].includes(place))).toBe(true);
  });
  it('is the same for the same input, and keeps the right where nothing is near', () => {
    const items = three([['a', 60, 60], ['b', 300, 60], ['c', 60, 300]]);
    expect(placeLabels(items)).toEqual({ a: 'r', b: 'r', c: 'r' });
    expect(placeLabels(items)).toEqual(placeLabels(items));
  });
  it('names an optional item only where its name covers nothing, after all the others', () => {
    // a named dot, and an optional one 30 px right of it: the named one keeps the right, and the optional name goes where it's clear
    const lead = { id: 'a', x: 100, y: 100, w: 60, h: 16, prio: 0 };
    const opt = { id: 'b', x: 130, y: 100, w: 40, h: 16, prio: 0, optional: true, dot: SMALL_DOT };
    const p = placeLabels([lead, opt]);
    expect(p.a).not.toBe('r'); // (its right would cover the optional dot; it has room elsewhere)
    expect(named(p, 'b')).toBe(true);
    const boxes = boxesOf([lead, opt], p);
    expect(overlapArea(boxes)).toBe(0);
    expect(overlapArea([boxes[1], dotOf(lead)])).toBe(0);
    // walled in by controls on every side: no place, its dot alone
    const walls = [{ x0: 0, y0: 0, x1: 400, y1: 80 }, { x0: 0, y0: 120, x1: 400, y1: 400 }, { x0: 140, y0: 0, x1: 400, y1: 400 }, { x0: 0, y0: 0, x1: 122, y1: 400 }];
    expect(placeLabels([opt], { blocks: walls }).b).toBe(null);
    // and its dot under a name that isn't optional is hidden, name and all, rather than the other name moved onto a dot of its own
    const wide = { id: 'w', x: 100, y: 100, w: 90, h: 16, prio: 0 };
    const walled = [{ x0: 0, y0: 0, x1: 400, y1: 91 }, { x0: 0, y0: 109, x1: 400, y1: 400 }, { x0: 0, y0: 0, x1: 92, y1: 400 }];
    const under = { ...opt, x: 140 };
    const p3 = placeLabels([wide, under], { blocks: walled });
    expect(p3.w).toBe('r');
    expect(p3.b).toBe(HIDDEN);
    // where the other name has a clear place too, it takes that one and leaves the dot be
    const p4 = placeLabels([wide, under]);
    expect(p4.b).not.toBe(HIDDEN);
    expect(overlapArea([boxAt(p4.w, wide.x, wide.y, wide.w, wide.h), dotOf(under)])).toBe(0);
  });
  it('shows and names more of the optional ones the more room there is', () => {
    const count = (box) => {
      const items = at(box);
      const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: box, y1: box } });
      const opt = items.filter((it) => it.optional);
      return { shown: opt.filter((it) => p[it.id] !== HIDDEN).length, named: opt.filter((it) => named(p, it.id)).length };
    };
    const charted = SYSTEMS.filter((s) => s.charted).length;
    expect(count(380).named).toBeLessThan(charted);
    expect(count(1400).named).toBeGreaterThan(count(380).named);
    expect(count(1400).shown).toBeGreaterThanOrEqual(count(380).shown);
    expect(count(2400)).toEqual({ shown: charted, named: charted });
  });
  it('puts every system clear of every name and dot on a phone-sized map, with the controls over it, but for a graze', () => {
    const PHONE_GRAZE = 2.5; // (px)
    // the names' widths on a phone (11.2 px type), the war's board, the Layers chip and the key chip as they sit on the map
    const W = { tatooine: 89, hoth: 48, endor: 54, yavin: 46, alderaan: 55, bespin: 45, dagobah: 56, mustafar: 54, coruscant: 94, naboo: 57, kashyyyk: 59, kamino: 62, geonosis: 59, scarif: 39, nevarro: 50, mandalore: 64, lothal: 41, sorgan: 47, felucia: 50, kessel: 44, sullust: 48, pillio: 40, vardos: 47, fondor: 47 };
    const blocks = [{ x0: 16, y0: 43, x1: 170, y1: 130 }, { x0: 6, y0: 236, x1: 102, y1: 272 }, { x0: 6, y0: 274, x1: 79, y1: 310 }];
    const worst = [];
    for (let box = 331; box <= 560; box += 3) {
      const items = SYSTEMS.map((s) => ({ id: s.id, x: (s.pos[0] / 21) * box, y: (s.pos[1] / 21) * box, w: W[s.id] ?? estimateWidth(s.name, 11.2), h: 16, prio: s.id === 'tatooine' ? 100 : s.id === 'coruscant' ? 50 : 0, ...(s.charted && { optional: true, dot: SMALL_DOT }) }));
      const p = placeLabels(items, { bounds: { x0: 0, y0: 0, x1: box, y1: box }, blocks });
      const boxes = boxesOf(items, p);
      const bad = [];
      // (a graze no deeper than PHONE_GRAZE is none: since Kamino went past the southern rim, where the canon atlas has
      // it, the south's names on a phone can't all part, and Mustafar's grazes Sullust's by 2.3 px at the narrowest, as
      // Bespin's does Dagobah's by 1 at 451 px. The browser check, galaxy-map-check/lib.mjs, allows 5 on a phone)
      for (const it of items) bad.push(...boxOver(items, p, it.id, PHONE_GRAZE).map((o) => `${it.id} over ${o}`));
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlapArea([inner(boxes[i], PHONE_GRAZE / 2), inner(boxes[j], PHONE_GRAZE / 2)]) > 0) bad.push(`${boxes[i].id} meets ${boxes[j].id}`);
      if (boxes.some((b) => b.x0 < 0 || b.y0 < 0 || b.x1 > box || b.y1 > box)) bad.push('off the map');
      for (const b of boxes) for (const k of blocks) if (overlapArea([inner(b, 0.5), k]) > 0) bad.push(`${b.id} under a control`);
      if (bad.length) worst.push(`${box}: ${bad.join(', ')}`);
    }
    expect(worst).toEqual([]);
  });
});
