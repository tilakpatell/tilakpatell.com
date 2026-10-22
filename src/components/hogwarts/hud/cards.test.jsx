import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SortingCard from './SortingCard';
import WandCard, { Scarf } from './WandCard';
import { sortingTree } from './sortingTree';
import { QUESTIONS, sort } from '../rules/sorting';
import { wandFor } from '../rules/wand';

describe('the Sorting card', () => {
  it('puts the Hat’s question on the kit’s Screen with its four answers as buttons', () => {
    const out = renderToStaticMarkup(<SortingCard q={0} onAnswer={() => {}} />);
    expect(out).toContain('class="hud-screen');
    expect(out.match(/<button/g)).toHaveLength(4);
    expect(out).toContain('The Sorting Hat · 1 of 3');
    for (const a of QUESTIONS[0].answers) expect(out).toContain(a.text.replace(/’/g, '’'));
    expect(out).toContain('role="dialog"');
  });

  it('lays the answers two by two when wide and one under another when tall, inside the card', () => {
    for (const tall of [false, true]) {
      const t = sortingTree(1, { tall });
      const [w, h] = t.size;
      const cells = t.boxes.find((b) => b.type === 'staticList').children;
      expect(cells).toHaveLength(4);
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(w);
        expect(c.y + c.h).toBeLessThanOrEqual(h);
        expect(c.h).toBeGreaterThan(40);
      }
      expect(new Set(cells.map((c) => c.x)).size).toBe(tall ? 1 : 2);
    }
    expect(sortingTree(5)).toBeNull();
  });

  it('says the house, its head and how to get in, once sorted', () => {
    const result = sort([0, 0, 0]);
    const out = renderToStaticMarkup(<SortingCard result={result} />);
    expect(out).toContain('Gryffindor');
    expect(out).toContain('Professor McGonagall');
    expect(out).toContain(result.password);
    expect(renderToStaticMarkup(<SortingCard />)).toBe('');
  });
});

describe('the wand card and the scarf', () => {
  const wand = wandFor([2, 3, 1], 'slytherin');

  it('says the wand whole at the Sorting', () => {
    expect(renderToStaticMarkup(<WandCard wand={wand} size="full" />)).toContain(wand.said);
  });

  it('keeps a short chip after: wood, core and length', () => {
    const out = renderToStaticMarkup(<WandCard wand={wand} />);
    expect(out).toContain(wand.wood);
    expect(out).toContain(wand.core);
    expect(out).toMatch(/\d+[¼½¾]? in/);
    expect(renderToStaticMarkup(<WandCard wand={null} />)).toBe('');
  });

  it('hangs a scarf in the house’s colours, and none before the Sorting', () => {
    expect(renderToStaticMarkup(<Scarf house="hufflepuff" />)).toContain('A Hufflepuff scarf');
    expect(renderToStaticMarkup(<Scarf house={null} />)).toBe('');
  });
});
