### Task 4: Labels thin out by priority

**Files:**
- Create: `src/components/universe/chart/declutter.js`
- Test: `src/components/universe/chart/declutter.test.js`

**Interfaces:**
- Produces:
  - `SIDES = ['right', 'left', 'under']`. These are `navmap.css`'s `data-side` values: none for right, `left` and `under` at `:162-163`.
  - `boxOf(side, { x, y, w, h }) → { x0, y0, x1, y1 }`, in px, matching the CSS's `translate`s:
    - `right` is `[x − 8, y − h/2, x − 8 + w, y + h/2]`
    - `left` is `[x + 8 − w, y − h/2, x + 8, y + h/2]`
    - `under` is `[x − w/2, y − 8, x + w/2, y + 8 + h]`
  - `declutter(labels, { bounds, sides = SIDES, dots = [] }) → Map<id, side | null>`.
    - `labels` is `[{ id, x, y, w, h, priority }]`.
    - `bounds` is the frame's box in px.
    - `dots` are `{ x, y }` points whose 16 × 16 px box no label may cover. A dot within 8 px of the label's own point never blocks it: it is its own dot, or one drawn on top of it.
    - The algorithm is greedy, in priority order (ties by id, so it is stable). Each label takes the first side that stays inside `bounds` and meets no kept label box and no dot. If none fits, it gets `null`: dot only, no name.

- [ ] **Step 1: Write the failing tests:**
```js
import { describe, expect, it } from 'vitest';
import { boxOf, declutter } from './declutter';

const bounds = { x0: 0, y0: 0, x1: 1000, y1: 1000 };
const L = (id, x, y, priority, w = 120, h = 24) => ({ id, x, y, w, h, priority });
const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

describe('declutter', () => {
  it('keeps the highest priority’s name, and no two kept names meet', () => {
    const pile = Array.from({ length: 8 }, (_, i) => L(`p${i}`, 500 + i, 500, i));
    const sides = declutter(pile, { bounds });
    expect(sides.get('p7')).toBe('right');
    expect([...sides.values()].filter((s) => s === null).length).toBeGreaterThan(0);
    const kept = pile.filter((l) => sides.get(l.id)).map((l) => boxOf(sides.get(l.id), l));
    for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) expect(meet(kept[i], kept[j])).toBe(false);
  });
  it('turns a name left at the frame’s right edge', () => {
    expect(declutter([L('edge', 950, 500, 1)], { bounds }).get('edge')).toBe('left');
  });
  it('keeps a name off another place’s dot', () => {
    expect(declutter([L('a', 500, 500, 1)], { bounds, dots: [{ x: 560, y: 500 }] }).get('a')).toBe('left');
  });
  it('can be held to one side, as the mini-map’s names hang under their dots', () => {
    const s = declutter([L('a', 300, 150, 2), L('b', 302, 150, 1)], { bounds, sides: ['under'] });
    expect([s.get('a'), s.get('b')]).toEqual(['under', null]);
  });
});
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/declutter.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `declutter.js`.** Its header names the galaxy's `labelPlace.js` as the model. It is not imported, because worlds are islands, and the universe hides a name where the galaxy moves it.
- [ ] **Step 4: Run them and see them pass.** Expected: PASS, 4 tests.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/declutter.js src/components/universe/chart/declutter.test.js
git commit -m "Chart labels thin out by priority, never over each other or a dot"
```

---

