### Task 7: Hands and keys, the hook, the tools and their words

**Files:**
- Create: `src/components/universe/chart/input.js`, test `input.test.js`
- Create: `src/components/universe/chart/useChartView.js` (no unit test: it is DOM wiring over tested parts, as `galaxy/useMapView.js` is; Task 10 checks it in the browser)
- Create: `src/components/universe/chart/ChartTools.jsx`, test `ChartTools.test.jsx`
- Modify: `src/components/universe/words.js` (append `CHART`)

**Interfaces:**
- Consumes: Task 2's `createGesture`; Task 3's view functions and `FRAMES`; Task 5's `reveal`.
- Produces:
  - `words.js` (named `CHART_WORDS` because `projection.js` already exports `CHART`):
    ```js
    export const CHART_WORDS = {
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      toShip: 'Back to the ship',
      flat: 'Look straight down',
      fit: 'Show everything',
      sector: ([sx, sy, sz]) => `Sector ${[sx, sy, sz].map((n) => String(n).replace('-', '−')).join(', ')}`,
      height: (far, side) => (side === 0 ? 'Level with the disc' : `${far} ${side > 0 ? 'above' : 'below'} the disc`),
      keys: 'zoom in and out, 0 back to the ship',
    };
    ```
  - In `input.js`:
    - `ZOOM_STEP = 1.5` (a button's or a key's zoom, the galaxy's).
    - `ORBIT = { yaw: Math.PI, pitch: Math.PI / 2 }`: radians for a drag across the whole box.
  - `chartKey({ key, meta, ctrl, alt }, { typing = false } = {}) → 'zoomIn' | 'zoomOut' | 'back' | null`:
    - `+` and `=` zoom in.
    - `-` and `_` zoom out.
    - `0` goes back.
    - Anything while typing or with a modifier gives null.
  - `wheelFactor(deltaY, deltaMode) → number`: `exp(−clamp(dy, ±60) × 0.0068)`. Lines count ×16 and pages ×120, as `useMapView.js:8`. A non-finite delta gives 1.
  - `panFrom(anchor, total, frame) → View`: `panBy(anchor, [total[0] × frame.w / frame.r, total[1] × frame.h / frame.r])`. `total` is the drag's summed `pan` fractions since its first move, and `anchor` is the view at that first move.
  - `gestureStep(view, message, frame, { orbit = true } = {}) → View`, for everything but `pan`:
    - `orbit` becomes `orbitBy([o[0] × ORBIT.yaw, −o[1] × ORBIT.pitch])`.
    - Two fingers become `zoomBy(zoom)`, then `orbitBy([turn, −tilt × ORBIT.pitch])`.
    - With `orbit: false`, orbit, turn and tilt are ignored (the mini-map).
    - A `pan` message, or one that applied nothing, returns the same view.
  - `ringStep(ids, key, id) → string | undefined`: the arrows step and wrap, Home and End jump to the ends, and an id not in `ids` starts from the end the key points away from.
  - `useChartView(boxRef, { open, ship = null, frame, orbit = true }) → { view, setView, level, zoomIn, zoomOut, back, flatten, show(mark), handlers }`:
    - `view` starts as `open`. An effect on `ship`'s x, y and z calls `track`.
    - The wheel is a non-passive listener on `boxRef`, as `useMapView.js:28-39` is.
    - `handlers` are `onPointerDown`, `Move`, `Up`, `Cancel` and `onClickCapture`, as `useMapView.js:49-71`. `down` gets `{ orbit: orbit && e.shiftKey }`.
    - A drag's `pan` messages sum into a ref `{ anchor, total }` set at its first move and cleared on up, cancel or a second finger. The view becomes `panFrom(anchor, total, frame)`. Every other message goes through `gestureStep`.
    - `back()` re-centres on the ship, or returns to `open` when there is none.
    - `show(mark)` sets the view to `reveal(view, mark)`.
  - `ChartTools({ className, buttonClass, onZoomIn, onZoomOut, onShip = null, atShip = true, onFlat = null, flat = true, onFit = null })`:
    - It renders `<div className={className} role="group">` with buttons in order: zoom in (`+`), zoom out (`−`), back to the ship (`RiFocus3Line`), look straight down (`RiArrowDownCircleLine`), show everything (`RiFullscreenExitLine`, the galaxy's).
    - Each button's `aria-label` and `title` come from `CHART_WORDS`, with the key in the title (for example "Zoom in (+)").
    - A button with nothing to do (`atShip`, `flat`) is `aria-disabled="true"`, not `disabled`, so it keeps the focus (the galaxy's way). Buttons without a handler aren't drawn.

- [ ] **Step 1: Write the failing tests.** `input.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { FRAMES, createView, project } from './projection';
import { ORBIT, chartKey, gestureStep, panFrom, ringStep, wheelFactor } from './input';

describe('the chart’s hands and keys', () => {
  it('reads + − 0, never while typing or with a modifier', () => {
    expect(['+', '=', '-', '_', '0', 'm'].map((key) => chartKey({ key }))).toEqual(['zoomIn', 'zoomIn', 'zoomOut', 'zoomOut', 'back', null]);
    expect(chartKey({ key: '-' }, { typing: true })).toBeNull();
    expect(chartKey({ key: '0' }, { typing: true })).toBeNull();
    expect(chartKey({ key: '+', ctrl: true })).toBeNull();
  });
  it('turns a wheel into a zoom, lines and floods and NaN included', () => {
    expect(wheelFactor(-100, 0)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0)).toBeLessThan(1);
    expect(wheelFactor(-3, 1)).toBeCloseTo(wheelFactor(-48, 0));
    expect(wheelFactor(NaN, 0)).toBe(1);
    expect(wheelFactor(-1e6, 0)).toBeCloseTo(Math.exp(60 * 0.0068));
  });
  it('pans a whole drag from where it began: the middle goes where the hand went', () => {
    const v = createView({ range: 10000 });
    const p = project(panFrom(v, [0.047, 0], FRAMES.nav), v.focus); // (47 of the frame's 1000, over its radius 470: 0.1)
    expect(p.u).toBeCloseTo(0.1, 9);
    expect(p.v).toBeCloseTo(0, 9);
  });
  it('applies the other gestures to the view', () => {
    const v = createView({ range: 10000 });
    expect(gestureStep(v, { pan: [0.047, 0] }, FRAMES.nav)).toBe(v);
    expect(gestureStep(v, { orbit: [0.5, 0] }, FRAMES.nav).yaw).toBeCloseTo(0.5 * ORBIT.yaw);
    expect(gestureStep(v, { orbit: [0.5, 0] }, FRAMES.mini, { orbit: false })).toBe(v);
    const two = { zoom: 2, u: 0.5, w: 0.5, turn: 0.3, tilt: -0.1 };
    expect(gestureStep(v, two, FRAMES.nav)).toMatchObject({ range: 5000, yaw: 0.3, pitch: expect.closeTo(0.1 * ORBIT.pitch, 9) });
    expect(gestureStep(v, two, FRAMES.mini, { orbit: false })).toMatchObject({ range: 5000, yaw: 0, pitch: 0 });
    expect(gestureStep(v, { zoom: 0, u: 0, w: 0, turn: 0, tilt: 0 }, FRAMES.nav).range).toBe(10000);
  });
  it('steps through the places with the arrows, Home and End', () => {
    const ids = ['a', 'b', 'c'];
    expect([['ArrowRight', 'c'], ['ArrowLeft', 'a'], ['ArrowDown', 'a'], ['Home', 'b'], ['End', 'a'], ['ArrowRight', null], ['ArrowLeft', null], ['x', 'a']].map(([k, id]) => ringStep(ids, k, id))).toEqual(['a', 'c', 'b', 'a', 'c', 'a', 'c', undefined]);
  });
});
```
`ChartTools.test.jsx`:
```jsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChartTools from './ChartTools';
import { CHART_WORDS as W } from '../words';

const f = () => {};
const button = (html, label) => html.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? null;

describe('the chart’s tools', () => {
  it('says each in the glossary’s words, marking the ones with nothing to do', () => {
    const html = renderToStaticMarkup(<ChartTools buttonClass="navmap-tool" onZoomIn={f} onZoomOut={f} onShip={f} atShip onFlat={f} flat={false} />);
    for (const w of [W.zoomIn, W.zoomOut, W.toShip, W.flat]) expect(button(html, w), w).not.toBeNull();
    expect(button(html, W.toShip)).toContain('aria-disabled="true"');
    expect(button(html, W.flat)).not.toContain('aria-disabled');
    expect(button(html, W.fit)).toBeNull();
  });
});
```
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/components/universe/chart/input.test.js src/components/universe/chart/ChartTools.test.jsx`. Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** `CHART_WORDS` in `words.js`, then `input.js`, `ChartTools.jsx` and `useChartView.js` to the Interfaces.
- [ ] **Step 4: Run them and see them pass.** Expected: PASS, 6 tests. Then run `npx vitest run src/lib/words.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add src/components/universe/chart/input.js src/components/universe/chart/input.test.js src/components/universe/chart/useChartView.js src/components/universe/chart/ChartTools.jsx src/components/universe/chart/ChartTools.test.jsx src/components/universe/words.js
git commit -m "Chart hands and keys: wheel, drag, Shift-drag, two fingers, + − 0; its tools and words"
```

---

