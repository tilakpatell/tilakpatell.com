### Task 8: The nav map draws through the chart

**Files:**
- Create: `src/components/universe/chart/NavChart.jsx`, test `NavChart.test.jsx`
- Modify: `src/components/universe/NavMap.jsx`:
  - `:33-43` (`UNDER`, `fightsOn`) and `:73-78` (`sizeOn`, `sectorAt`) go
  - `:45-71` (`paintStars`) moves to NavChart
  - `:82` (the `view` state) and `:92-98` and `:191-197` (`P`, `shipAt`, `toward`, `homeR`) are replaced
  - `:122-132` gains the chart's keys
  - `:283-431` becomes `<NavChart>`
  - `:538-540` gains the zoom keys
- Modify: `src/components/universe/navmap.css` (`:102-118` and `:284-288`, plus new rules)
- Modify: `src/components/guide/pages.js:106-108` (the universe's keys)
- Modify: `src/lib/words.test.js:23-24` (read the new JSX)

**Interfaces:**
- Consumes: Tasks 3 to 7, and `nav.js`'s `legOf`, `destinationById` and `formatDistance`. `LENGTH` comes from `scale.js`; `sectorAt` from Task 0.
- Produces: `NavChart` (default export). Props:
  - `view`, `marks`
  - `ship` (`{ x, y, z, heading } | null`)
  - `course` (`{ to: [x, y, z], drive } | null`)
  - `front` (`where().front | null`), `onFront`, `frontTitle`, `frontOff`
  - `pick`, `here`, `dim` (a Set of ids)
  - `onChoose(id)`, `onGo(id)`, `onRegion(presetId)`
  - `out` (`{ label, onClick } | null`), `tools` (ChartTools' props)
  - `readout` (`string | null`), `handlers`, `boxRef`
- The DOM:
  ```
  .navmap-stage
    .navmap-chart[data-level][data-pitched]  ← handlers, boxRef: the circle
      canvas, svg, ul.navmap-places, .navmap-out
    .navmap-bar
      p.navmap-readout
      .navmap-tools
  ```
  The bar sits under the circle, so the tools never cover a name and the circle's clip never cuts a 44 px button.
- What the SVG draws (viewBox 1000), in this order:
  - `ringsFor` as `.navmap-ring` ellipses (`ry` = `rx × cos pitch`)
  - `sectorGrid` at neighbourhood (n = 1) and universe (n = 2) as `.navmap-sector` polylines
  - `REGIONS` at their levels as `.navmap-region[data-region]` polylines
  - each mark's stem as `line.navmap-stem[data-dir=up|down]`, where its length is at least 1.5
  - the wonder and sun glyphs as today (`NavMap.jsx:314-333`, `r = max(6, size)`), sorted far first by `depth`
  - the war (`:336-345`, through `project`, never filtered, so `universe-war-check.mjs:165`'s seven stay)
  - the course to `toFrame(…, { pin: true })` of its target
  - pilots and fights
  - the ship: `g.navmap-ship[data-edge]` from `placeShip`, always drawn when `ship` is set
- The places list: one `li[data-id][data-kind][data-side][data-quiet][data-dim]` per placed mark that is pickable, a region (`chart:home`, `chart:curve`) or a fight. The sun and pilots are SVG only.
  - Each `li`'s style starts with `left` then `top`, in % of the frame. The tests read them in that order.
  - Names are hidden when `data-quiet` is set.
  - `chart:home` and `chart:curve` call `onRegion('home' | 'rickmorty')`.
  - Fights are labels only, as today.
  - It measures its px width and a `.navmap-name`'s font size on resize, for `scale` and `fontPx`. In SSR, `scale` is 1 and `fontPx` is 11.
- The chart's attributes:
  - `data-level` is `levelOf(view.range)`.
  - `data-pitched` is present when `view.pitch > 0 || view.yaw !== 0`.
- In NavMap:
  - `const box = useRef(null); const chart = useChartView(box, { open: openView(now?.ship), ship: now?.ship, frame: FRAMES.nav })`. `open` is read once, on mount. `box` is passed down as `boxRef`.
  - The marks are `[...HAND_MARKS, ...liveMarks(now)]`.
  - A chip is `aria-pressed={presetOf(chart.view) === c.id}` and its click is `chart.setView(presetView(c.id, now?.ship))`.
  - A list or search pick calls `chart.show(markById(d.via ?? d.id))`, replacing `:275-276` and `:519-521`.
  - The course target is `destinationById(legOf(now.ship, id)).at`.
  - `.navmap-out` shows when `presetOf` is `home` or `rickmorty`, with today's labels and actions (`:420-430`), and the "out" action becomes `setView(presetView('all', ship))`.
  - The readout is `` `${CHART_WORDS.sector(sectorAt(x, y, z))} · ${CHART_WORDS.height(formatDistance(Math.abs(y)), Math.abs(y) < LENGTH ? 0 : Math.sign(y))}` ``, and none without a ship.
  - The keys go through `chartKey(e, { typing: e.target.matches('input, textarea') })`, in the existing capture listener: `zoomIn`, `zoomOut` or `back` on the hook.
  - The tools are `{ onZoomIn, onZoomOut, onShip: ship ? back : null, atShip: view.follow, onFlat: flatten, flat: !pitched }`.

- [ ] **Step 1: Write the failing test** `NavChart.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NavChart from './NavChart';
import { FRAMES, createView, project, toFrame } from './projection';
import { HAND_MARKS, markById } from './marks';

const view = createView({ range: 120000 });
const li = (html, id) => html.match(new RegExp(`<li[^>]*data-id="${id}"[^>]*>`))?.[0] ?? '';
const at = (html, id) => {
  const m = /left:([-\d.e]+)%;top:([-\d.e]+)%/.exec(li(html, id));
  return m && [Number(m[1]), Number(m[2])];
};
const tags = (html, cls) => html.match(new RegExp(`<[a-z]+[^>]*class="${cls}"[^>]*>`, 'g')) ?? [];
const draw = (props) => renderToStaticMarkup(<NavChart view={view} marks={HAND_MARKS} {...props} />);

describe('the nav map’s chart', () => {
  it('puts each place where the projection says', () => {
    const html = draw({});
    for (const id of ['marvel', 'aurelia', 'veil']) {
      const p = project(view, markById(id).at);
      const { x, y } = toFrame(FRAMES.nav, [p.u, p.v]);
      expect(at(html, id)[0]).toBeCloseTo((x / 1000) * 100, 6);
      expect(at(html, id)[1]).toBeCloseTo((y / 1000) * 100, 6);
    }
  });
  it('always draws the ship: in the middle, or pinned to the rim when it is far', () => {
    expect(tags(draw({ ship: { x: 0, y: 0, z: 0, heading: 0 } }), 'navmap-ship')[0]).toContain('translate(500 500)');
    expect(tags(draw({ ship: { x: 9e6, y: 2e5, z: 0, heading: 0 } }), 'navmap-ship')[0]).toContain('data-edge');
  });
  it('draws no ship and no readout with no ship', () => {
    const html = draw({ ship: null, readout: null });
    expect(html).not.toContain('navmap-ship');
    expect(html).not.toContain('navmap-readout');
  });
  it('stands places on stems up and down', () => {
    const marks = [{ id: 'up', kind: 'world', name: 'Up', at: [3000, 2500, 0], priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true }, { id: 'down', kind: 'world', name: 'Down', at: [-3000, -2500, 0], priority: 1, color: '#fff', levels: ['neighbourhood'], pickable: true }];
    const stems = tags(renderToStaticMarkup(<NavChart view={view} marks={marks} />), 'navmap-stem');
    expect(stems.some((t) => t.includes('data-dir="up"'))).toBe(true);
    expect(stems.some((t) => t.includes('data-dir="down"'))).toBe(true);
  });
  it('hides colliding names but never the picked one’s, and shows the readout', () => {
    const pile = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, kind: 'world', name: `Place ${i}`, at: [5000 + i, 0, 0], priority: 10 - i, color: '#fff', levels: ['neighbourhood'], pickable: true }));
    const html = renderToStaticMarkup(<NavChart view={view} marks={pile} pick="p5" readout="Sector 2, 0, 0 · 3,800 ship-lengths above the disc" />);
    expect(li(html, 'p5')).not.toContain('data-quiet');
    expect(pile.some((m) => li(html, m.id).includes('data-quiet'))).toBe(true);
    expect(html).toContain('Sector 2, 0, 0 · 3,800 ship-lengths above the disc');
  });
});
```
- [ ] **Step 2: Run it and see it fail.** Run `npx vitest run src/components/universe/chart/NavChart.test.jsx`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `NavChart.jsx`, then rewire `NavMap.jsx`** as above. NavMap stays under 800 lines and keeps every class and text the checks read:
  - `.navmap-views button`, `.navmap-place[aria-label]`, `.navmap-name`, `.navmap-list button`, `.navmap-go`
  - `.navmap-drive[data-drive]`, `.navmap-status`, `.navmap-note`, `.navmap-back`, `.navmap-keys`
  - `.navmap-frontbtn`, `.navmap-war-sector`, `.navmap-tool`, `.navmap-frame`, `.navmap-chart`, `.navmap-side`
  - The keys line appends `<kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd> {CHART_WORDS.keys}`, with no new `kbd` rule.
- [ ] **Step 4: Rework `navmap.css`:**
  - `.navmap-stage` takes the chart's old size: `width: min(100%, calc(100cqh − 3.25rem))` and `aspect-ratio` on the circle, with the phone's `42svh` at `:285` moved to it.
  - `.navmap-chart` becomes `position: absolute; inset: 0`, keeps its circle, adds `touch-action: none` and `cursor: grab`, and `grabbing` while dragging.
  - `.navmap-bar` is a flex row with the readout on the left and the tools on the right.
  - `.navmap-readout` uses `font-size: var(--fs-xs)` on `rgb(3 6 16 / 0.8)` glass.
  - The tools are 36 px, and 44 px under `@media (pointer: coarse)`.
  - `.navmap-stem`: the blue at 0.45 alpha; `[data-dir='down']` is dashed `2 3`.
  - `.navmap-sector`: the blue at 0.12 alpha, dashed `6 6`.
  - `.navmap-region[data-region='home']`, `belt` and `curve` reuse today's home-ring, belt and edge looks (`:127-129`).
  - `li[data-quiet] .navmap-name { display: none }`.
  - The phone rule at `:287-288` (wonder names hidden unless picked) stays. No z-index.
- [ ] **Step 5: Add the guide's rows and the words test's files.**
  - `pages.js` gets a group after "On foot": `{ label: 'On the nav map', rows: [['+ − 0', 'Zoom in, out, back to the ship'], ['Drag', 'Move the chart'], ['Shift and drag', 'Tilt and turn it; Look straight down puts it back']] }`.
  - Its touch list gets `['Two fingers on the nav map', 'Pinch to zoom; turn or slide them to turn and tilt it']`.
  - `words.test.js`'s `FILES` gains `...list('components/universe/chart/', /\.jsx$/)`.
- [ ] **Step 6: Run the tests.** Run `npx vitest run src/components/universe src/components/guide src/lib/words.test.js src/styles/tokens.test.js`. Expected: PASS, with `nav.test.js` untouched and green.
- [ ] **Step 7: Lint.** Run `npm run lint`. Expected: no new problems.
- [ ] **Step 8: Commit.**
```bash
git add src/components/universe/chart/NavChart.jsx src/components/universe/chart/NavChart.test.jsx src/components/universe/NavMap.jsx src/components/universe/navmap.css src/components/guide/pages.js src/lib/words.test.js
git commit -m "Nav map on the shared chart: ship-centred, zoom, pan, tilt, stems, the ship always on it"
```

---

