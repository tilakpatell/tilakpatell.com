### Task 9: The mini-map on the same projection and data

**Files:**
- Modify: `src/components/universe/MiniMap.jsx`, rewritten. Gone: `:14-34` (its own square-root scale and `ORBITS`), `:54-56` (the orbit rings that match nothing) and `:60-64` (the portal's special case, now a wonder mark).
- Modify: `src/components/universe/universe.css:5-38` (`.minimap-orbit` goes; stems, ship and tools added)
- Modify: `src/components/universe/UniverseMap.jsx:459` (`<MiniMap … interactive />`)
- Modify: `src/lib/words.test.js:23` (add `'MiniMap'`)
- Test: `src/components/universe/MiniMap.test.jsx`

**Interfaces:**
- Consumes: `HAND_MARKS`, `placeMarks`, `placeShip`, `miniView`, `FRAMES.mini`, `useChartView`, `ChartTools`, `ringStep`.
- Produces: `MiniMap({ selected, onSelect, linkTo, kind, className, interactive = false, ship = null })`:
  - **Which marks.** Exactly `HAND_MARKS.filter((m) => m.pickable || m.id === 'chart:sun')`, or with `kind="fandom"` (the teaser, `Interests.jsx:22`) the worlds whose `byId(id).kind === 'fandom'` plus `chart:sun`. The sun and the `belt` region are drawn in the SVG in both modes, as today (`:58-59`); every other shown mark gets an `li`.
  - **The view.** `miniView(shown)`.
    - With `interactive`, it goes through `useChartView(box, { open, frame: FRAMES.mini, orbit: false })`.
    - A `ChartTools` row (zoom in, zoom out, show everything) uses `buttonClass="chip"`.
    - `chartKey` on its `onKeyDown` (the focus inside it) zooms, and `0` goes back to `open`.
    - The root carries `data-level`.
  - **Placing.** Through `placeMarks(view, shown, FRAMES.mini, { levels: false, sides: ['under'], keep: [selected] })`. The labels hang under their dots, as `.minimap-hit` does (`universe.css:10-25`).
  - **Labels.** A label's text is `byId(id)?.label ?? mark.name`, so the teaser still reads "Marvel", not the world's name. A hidden name keeps the button's `aria-label`.
  - **The ship.** Drawn pinned when given (`.minimap-ship[data-edge]`). Nothing passes one yet: with 3D off there is no position until lane 4c saves one.
  - **Keys.** `ringStep` over the shown ids replaces `keyStep` (`:42-49`), so the arrows reach the wonders and moons too.

- [ ] **Step 1: Write the failing test** `MiniMap.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MiniMap from './MiniMap';
import NavChart from './chart/NavChart';
import { DESTINATIONS } from './nav';
import { byId } from './universes';
import { FRAMES } from './chart/projection';
import { HAND_MARKS } from './chart/marks';
import { miniView } from './chart/place';

const ids = (html) => [...html.matchAll(/<li[^>]*data-id="([^"]+)"/g)].map((m) => m[1]);
const uv = (html, id, f) => {
  const tag = html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))[0];
  const [, l, t] = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(tag);
  return [((l / 100) * f.w - f.cx) / f.r, ((t / 100) * f.h - f.cy) / f.r];
};

describe('the mini-map', () => {
  it('shows every hand-made place, wonder and moon, and no orbit rings', () => {
    const html = renderToStaticMarkup(<MiniMap onSelect={() => {}} />);
    expect(ids(html)).toEqual(expect.arrayContaining(DESTINATIONS.filter((d) => d.kind !== 'system').map((d) => d.id)));
    expect(html).not.toContain('minimap-orbit');
    expect(html).not.toContain('minimap-ship');
  });
  it('keeps the teaser to the worlds, by their own labels', () => {
    const html = renderToStaticMarkup(<MemoryRouter><MiniMap kind="fandom" linkTo={(id) => `/universe/${id}`} /></MemoryRouter>);
    expect(ids(html).every((id) => byId(id)?.kind === 'fandom')).toBe(true);
    expect(html).toContain(byId('marvel').label);
  });
  it('places each mark where the nav map would on the same view: one projection', () => {
    const mini = renderToStaticMarkup(<MiniMap onSelect={() => {}} />);
    const shown = HAND_MARKS.filter((m) => m.pickable || m.id === 'chart:sun');
    const nav = renderToStaticMarkup(<NavChart view={miniView(shown)} marks={shown} />);
    const both = ids(mini).filter((id) => ids(nav).includes(id));
    expect(both.length).toBeGreaterThan(10);
    for (const id of both) {
      const a = uv(mini, id, FRAMES.mini);
      const b = uv(nav, id, FRAMES.nav);
      expect(a[0]).toBeCloseTo(b[0], 9);
      expect(a[1]).toBeCloseTo(b[1], 9);
    }
  });
  it('keeps a far ship on the map when it is given one', () => {
    const html = renderToStaticMarkup(<MiniMap onSelect={() => {}} ship={{ x: 5e6, y: 0, z: 0, heading: 0 }} />);
    expect(html.match(/<g[^>]*class="minimap-ship"[^>]*>/)?.[0]).toContain('data-edge');
  });
});
```
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/MiniMap.test.jsx`. Expected: FAIL (no wonders or moons; `minimap-orbit` present; no `data-id` on the `li`).
- [ ] **Step 3: Rewrite `MiniMap.jsx`; edit `universe.css` and `UniverseMap.jsx:459`.**
  - The `li` carries `data-id` and the `left`/`top` style, in that order.
  - Dots stay `5 + min(7, size × 0.2)` for a universe or moon (`:32`) and 5 for a wonder.
- [ ] **Step 4: Run it and see it pass.** Then run `npx vitest run src/components src/lib`. Expected: PASS.
- [ ] **Step 5: Measure the bundle.** Run `npm run build` on this commit and on Task 8's, and note the `Interests` chunk's size from Vite's report both times. The mini-map now reads `nav.js` (the same data, as the spec asks), which brings `ship.js` into the home page's lazy section. The two numbers go in the evidence README.
- [ ] **Step 6: Commit.**
```bash
git add src/components/universe/MiniMap.jsx src/components/universe/MiniMap.test.jsx src/components/universe/universe.css src/components/universe/UniverseMap.jsx src/lib/words.test.js
git commit -m "Mini-map on the chart's projection and marks: wonders and moons on it, no orbit rings"
```

---

