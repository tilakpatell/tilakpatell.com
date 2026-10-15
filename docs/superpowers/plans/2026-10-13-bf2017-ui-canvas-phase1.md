# The game's screens on a Canvas 2D painter, phase 1: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start, the main menu, Play and Single Player drawn from the game's own trees by one layout core and a Canvas 2D painter, with invisible buttons for input, in the game's 1920 × 1080 frame.

**Architecture:** `screen()` (lib, pure) resolves a tree at the frame's 1920 × 1080; `layout.js` (lib, pure) turns trees, a screen's values and the selected cells into a flat draw list and the navigable cells; `paint.js` (lib, no React) draws the list on a 2D context; `ScreenCanvas.jsx` (the HUD kit) holds the canvas, the buttons, the films and the fonts. The front end's screens only say what fills the trees.

**Tech Stack:** React 18, Vitest with jsdom, Canvas 2D, `Path2D`, `FontFace` (`document.fonts`), Playwright for the shots. No new package.

**Spec:** `docs/superpowers/specs/2026-10-13-bf2017-ui-canvas-design.md` (decisions 1 to 5, 8, 9 and 11; its phase 1 row, as this plan narrows it below).

## Global Constraints

- A file stays under 800 lines (`docs/health/RULES.md`, Size).
- `src/lib` imports no React; `src/runtime` imports nothing from `src/components` (RULES, Layers).
- Tests beside the file, under a second each, no network; fixtures in a `fixtures/` folder beside the test.
- No new package (`stack-pages` is budgeted at 0).
- The frame: boxes in 1920 × 1080, scaled by `k = min(width / 1920, height / 1080)`, centred; a root box the tree expands to fill (`layout.fill` with expansion `[0, 0, 1, 1]`) stretches to the window.
- Nothing a player reads is drawn under 0.7 rem (11.2 CSS px) in the window: a text's size in frame px is `max(size, 11.2 / k)`.
- Speed: a full screen paints in 2 ms or less at 1920 × 1080 (`performance.measure('bf-ui-paint')`).
- What is missing draws nothing and is counted (a shape, a font, a type the painter does not draw yet).
- A value the tree does not hold has a line in `src/data/bf2017/NOTES.md` marked hand, with its reason.
- Copy: British spelling, curly quotes in prose, the site's words for what the game lacks (“NOT IN THIS WORLD YET”).
- Before a task is done: `npm run lint`, `npm test`; before the last: `npm run build`, `node scripts/health.mjs --check --skip build`.
- Commit messages: one descriptive sentence, the repo's voice, ending with the session's attribution lines.

### Narrowed from the spec's phase 1 row

The spec's phase 1 names “the bar and the breadcrumb kept inside PLAY”. The tree puts the main menu's tabs and its breadcrumb in the same place (`MainMenuScreen`: `BreadcrumbWidget` at y 118, `MainMenuWidget` at y 110), so this plan shows the tabs on a tab's own page (HOME, PLAY) and the breadcrumb deeper (PLAY / SINGLE PLAYER). The game's own footer of key prompts (`FooterActionBarFullScreen`) waits for phase 2's bound fields; until then the site's keys line (`GameScreen`'s `.bf-game-keys`) stays. Line, single-pixel line, polygon, texture and icon boxes are phase 2's: the painter counts them as skipped.

## Review Focus

1. **A window that is not 16:9** (2560 × 1080, a 390 × 844 phone): the frame centres, and every button lies over the cell it stands for. Test in Task 3 (`frameOf`, `navigables`) and Task 5 (button placement).
2. **The game's fonts not loaded at the first paint**: the canvas paints again once `document.fonts.load` resolves, so no screen is left in the fallback face. Test in Task 5.
3. **A 2× screen**: the backing store is the window's size times the pixel ratio (at most 3), the painter scaled to match. Test in Task 5.
4. **Reduced motion or a saver connection**: a film's poster is drawn and no video plays (`mayPlay`). Test in Task 5.
5. **The keyboard across two groups** (the tabs, then a page's tiles): arrows move within a group, Tab moves between groups, Enter activates, Escape goes back. Test in Task 5.

---

### Task 1: The reader keeps a dynamic list's cell template

The game fills a `standardList` (the breadcrumb, 1 in the main menu) from code, one cell a datum, from its `CellTemplate`. The reader keeps none of it.

**Files:**
- Modify: `scripts/lib/bf2017-rulebook-ui.mjs` (`elementOf`, about line 196)
- Test: `scripts/lib/bf2017-rulebook-ui.test.mjs`
- Fixture: `scripts/fixtures/bf2017/data/data/UI/Frontend/Widgets/Breadcrumbs/BreadcrumbListCell.json` (cut with `node scripts/bf2017-data.mjs fixture UI/Frontend/Widgets/Breadcrumbs/BreadcrumbListCell --root lab/assets/bf2017`), and the `BreadcrumbWidget` fixture beside it if it is not there
- Regenerate: `src/data/bf2017/screens.json`

**Interfaces:**
- Produces: an element of type `standardList` carries `dynamic: { template: string, cellSize: [w, h], spacing: number, horizontal: boolean, sized: boolean }` (`sized` from `CellsUseDynamicSize`); the template's widget is in `screens.json`'s `widgets`.

- [ ] **Step 1: Write the failing test** in the file's `describe('the screens')`:

```js
it('keeps a dynamic list’s cell template, its cell size and direction, and reads the template as a widget', () => {
  const crumbs = book.widgets['UI/Frontend/Widgets/Breadcrumbs/BreadcrumbWidget'];
  const list = find(crumbs.elements, 'BreadcrumbList');
  expect(list.dynamic).toEqual({ template: 'UI/Frontend/Widgets/Breadcrumbs/BreadcrumbListCell', cellSize: [200, 32], spacing: 0, horizontal: true, sized: true });
  expect(book.widgets['UI/Frontend/Widgets/Breadcrumbs/BreadcrumbListCell']).toBeTruthy();
});
```

(`find(elements, id)`: a depth-first search by `id`, added to the test file if it has none.)

- [ ] **Step 2: Run it and see it fail**: `npx vitest run scripts/lib/bf2017-rulebook-ui.test.mjs` fails on `list.dynamic` undefined.
- [ ] **Step 3: Implement**: in `elementOf`, for `o.$type === 'StandardListElementData'`, set `el.dynamic` from `CellTemplate` (`asset()`), `CellSize` (`xy(o.CellSize)`), `Spacing`, `Horizontal`, `CellsUseDynamicSize`, and `ctx.want.add(template)` (the era rule as for a widget reference).
- [ ] **Step 4: Run it and see it pass.**
- [ ] **Step 5: Regenerate the book**: fetch what the screens rulebook reads (`SUPABASE_URL` and `SUPA_KEY` in the environment) with `node scripts/bf2017-fetch.mjs data 'type:UIWidgetBlueprint' 'type:UIElementFontStyle' 'type:UILinkTargetAsset' 'type:DiceUIVectorShapeAsset'` and `node scripts/bf2017-fetch.mjs web 'strings/English.json'`, then `node scripts/bf2017-data.mjs screens --root lab/assets/bf2017` (one rulebook: it writes `screens.json` alone). Check: `git diff --stat src/data/bf2017/screens.json` shows the file changed, and `node -e` over the old (`git show HEAD:src/data/bf2017/screens.json`) and new books finds every old screen and widget name still there and `rows.screens` still 232. If anything else moved, stop and report it.
- [ ] **Step 6: Run `npm test`**; all pass.
- [ ] **Step 7: Commit** the reader, its test, the fixture and `screens.json`.

### Task 2: A widget's expanding parts grow with it; a dynamic list's cells; a root box that bleeds

`placeIn` sizes a `PositionExpansion` element by its own `size` alone, so the Play tile's outline (`BasicTileWidget`'s `Outline`, recorded 256 × 256 with expansion `[0, 0, 1, 1]`) draws 256 × 256 inside a 504 × 736 tile. The reading, from the 813 such elements in the book (169 of them recorded at 1920 × 1080 with expansion `[0, 0, 1, 1]`, 71 at 256 × 256 inside widgets whose own size is 256 × 256, as `BasicTileWidget`'s is): `size` and `position` are the element's at its parent's own recorded size, and the expansion says how much of the parent's growth past that it takes. So `x = parent.x + (position.x + ex.X × (parent.w − design.w)) × k` and `w = (size.w + ex.W × (parent.w − design.w)) × k`, where `design` is the parent's recorded size (a widget's own `size` for its top elements, a container's recorded `size` for its children); likewise for y and h.

**Files:**
- Modify: `src/lib/bf2017/ui/index.js` (`placeIn`), `src/lib/bf2017/ui/screens.js` (`expand`, `boxOf`, `screen`)
- Test: `src/lib/bf2017/ui/index.test.js`, `src/lib/bf2017/ui/screens.test.js`

**Interfaces:**
- Consumes: Task 1's `dynamic`.
- Produces: `placeIn(el, parent, k)` where `parent` may carry `design: [w, h]` (reference px); boxes gain `bleed: true` (a root-level element with `layout.fill` and expansion `[0, 0, 1, 1]`); `screen(name, { viewport, data, strings, items })` where `items: { [listId]: [{ id, label }] }` lays a dynamic list's cells from its template, each a `type: 'cell'` box with `label`, each of its texts whose text is empty taking the label.

- [ ] **Step 1: Write the failing tests**:

```js
// index.test.js
it('grows an expanding element with its parent past the parent’s recorded size', () => {
  const el = { size: [256, 256], layout: { fill: true, expansion: [0, 0, 1, 1], position: [0, 0] } };
  expect(placeIn(el, { x: 97, y: 224, w: 504, h: 736, design: [256, 256] }, 1)).toEqual({ x: 97, y: 224, w: 504, h: 736 });
  const half = { size: [1728, 736], layout: { fill: true, expansion: [0.5, 0.5, 0, 0], position: [97, 224] } };
  expect(placeIn(half, { x: 0, y: 0, w: 2120, h: 1080, design: [1920, 1080] }, 1)).toEqual({ x: 197, y: 224, w: 1728, h: 736 });
});
// screens.test.js
it('draws a Play tile’s outline round the whole tile', () => {
  const tree = screen('PlayScreen');
  const tile = findBox(tree, 'Multiplayer');
  const outline = boxesUnder(tile).find((b) => b.id.endsWith('/Outline'));
  expect([outline.x, outline.y, outline.w, outline.h]).toEqual([tile.x, tile.y, tile.w, tile.h]);
});
it('lays a dynamic list’s cells from its template, the crumbs’ words in its empty texts', () => {
  const tree = screen('MainMenuScreen', { items: { BreadcrumbList: [{ id: 'play', label: 'PLAY' }, { id: 'single', label: 'SINGLE PLAYER' }] } });
  const cells = findBox(tree, 'BreadcrumbList').children;
  expect(cells.map((c) => c.label)).toEqual(['PLAY', 'SINGLE PLAYER']);
  expect(cells[1].x).toBeGreaterThan(cells[0].x);
  expect(boxesUnder(cells[0]).some((b) => b.type === 'text' && b.text === 'PLAY')).toBe(true);
});
it('marks a root box the tree expands over the whole frame as bleeding to the window', () => {
  expect(findBox(screen('PairingScreen'), 'Background').bleed).toBe(true);
});
```

(`findBox` from `src/components/battlefront/screens/tree.js` cannot be imported by `src/lib`: write a local `findBox` and `boxesUnder` in the test.)

- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/lib/bf2017/ui`.
- [ ] **Step 3: Implement**: `placeIn` takes `parent.design` (absent: the old behaviour, so the DOM screens and the HUD's `placeWidget` are unchanged where no design is passed); `expand` passes each child's parent `design` (a widget reference: the widget's `size`; a container: its element's recorded `size`); `boxOf` sets `bleed`; `expand` lays `el.dynamic` cells from `ctx.items[el.id]` through the template widget as `cellsOf` lays a static list's, sized by `dynamic.cellSize` unless `sized` (then `cellSize()`'s existing estimate, the letters' 0.6 em: already hand in `NOTES.md`).
- [ ] **Step 4: Run them and see them pass**; then `npm test`: the DOM screens' tests still pass.
- [ ] **Step 5: Commit.**

### Task 3: The layout core

**Files:**
- Create: `src/lib/bf2017/ui/layout.js`
- Test: `src/lib/bf2017/ui/layout.test.js`

**Interfaces:**
- Consumes: `screen()` trees at 1920 × 1080 (Task 2).
- Produces:
  - `FRAME = [1920, 1080]`
  - `frameOf({ width, height }) → { k, x, y, w, h }`: `k = min(width / 1920, height / 1080)`, `x = (width − 1920k) / 2`, `y = (height − 1080k) / 2`, `w = 1920k`, `h = 1080k`.
  - `drawList(layers, { selected = new Set(), values = null } = {}) → Item[]`: `layers` an array of trees, drawn in order; `Item = { id, layer, type, x, y, w, h, alpha, colour, text, font, align, wrap, shape, film, fill, line, bleed, cell }` in frame px; `id` is `${layer}:${box.id}`; `cell` the id of the navigable it is inside, or null.
  - `navigables(layers, { values = null } = {}) → Nav[]`: `Nav = { id, layer, x, y, w, h, label, link, screen, group, index, horizontal, coming }`.
  - `values(box, path) → { text?, hidden?, film?, coming? } | null`, `path` the ids' last parts from the layer's root to the box.

The rules `drawList` keeps (each a test):
1. A box of a passive type (`input`, `measurement`, `navigatableElementCollection`, `navigatableElementZone`, `inputConceptIcon`, `spacer`) is not drawn; its children are.
2. A hidden box is not drawn, nor what is under it, unless the selected rule shows it.
3. Alpha multiplies down the tree.
4. A widget reference recorded at alpha 0 is drawn at 1, and so is a box marked `reveal`: phase 1 draws an enter animation's end, not its move (hand: the animations are a later design).
5. The selected rule: inside a navigable in `selected`, a box whose name matches `/^Select|Selected/` is drawn even if hidden, at alpha 1 if recorded at 0; a box `X` with a sibling `XSelected` or `SelectedX` is not drawn. Inside a navigable that is not selected, a box matching the pattern is not drawn; outside every navigable the rule does not apply. (Hand, the DOM screens' existing rule, made exact: until the cells' schematics are read.)
6. A `values` patch is laid on its box before the rules: `hidden` hides, `text` replaces, `film` sets the film.
7. `NewThingAvailable` widgets are not drawn unless a patch shows them (the game shows the mark only on what is new; the site has nothing new to mark).

`navigables`: every `cell` box, and for every `navigatableElementZone` the nearest widget reference above it (a Play tile's zone sits in its `AnimContainer`; the navigable is the tile, `Multiplayer`); `group` is the navigable's parent box's id (the tiles' stack), `index` the order in it, `horizontal` true when the group's first two differ in x; `label` the cell's own, else its text named `Title`, else its first drawn text with words (a tile's `NotInBeta` comes before its `Title` in the tree); `coming` from its patch; a hidden one is left out.

- [ ] **Step 1: Write the failing tests**, one per rule above, plus:

```js
it('centres the frame in a window of another shape', () => {
  expect(frameOf({ width: 2560, height: 1080 })).toEqual({ k: 1, x: 320, y: 0, w: 1920, h: 1080 });
  expect(frameOf({ width: 390, height: 844 }).k).toBeCloseTo(390 / 1920);
});
it('finds the main menu’s tabs and a page’s tiles as two groups to walk', () => {
  const navs = navigables([screen('MainMenuScreen'), screen('PlayScreen')]);
  const tabs = navs.filter((n) => n.layer === 0);
  expect(tabs.map((n) => n.label)).toContain('PLAY');
  expect(new Set(tabs.map((n) => n.group)).size).toBe(1);
  const first = navs.find((n) => n.layer === 1 && n.label === 'MULTIPLAYER');
  const tiles = navs.filter((n) => n.group === first.group);
  expect(tiles.map((n) => n.id.split('/').pop())).toEqual(['Multiplayer', 'COOP', 'Campaign']);
  expect(tiles.every((n) => n.horizontal)).toBe(true);
});
it('draws a tab’s selected line and bold words only when it is selected', () => {
  const tree = screen('MainMenuScreen');
  const play = navigables([tree]).find((n) => n.label === 'PLAY');
  const ids = (sel) => drawList([tree], { selected: new Set(sel) }).filter((i) => i.cell === play.id).map((i) => i.id.split('/').pop());
  expect(ids([])).toContain('MenuText');
  expect(ids([])).not.toContain('SelectedLineLeft');
  expect(ids([play.id])).toEqual(expect.arrayContaining(['SelectedLineLeft', 'MenuTextSelected']));
  expect(ids([play.id])).not.toContain('MenuText');
});
```

- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/lib/bf2017/ui/layout.test.js`.
- [ ] **Step 3: Implement** `frameOf`, `drawList`, `navigables` in `layout.js` (one walk over each layer's boxes with the path, the inherited alpha and the enclosing navigable).
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.**

### Task 4: The painter

**Files:**
- Create: `src/lib/bf2017/ui/paint.js`, `src/lib/bf2017/ui/fixtures/fakeContext.js`
- Test: `src/lib/bf2017/ui/paint.test.js`

**Interfaces:**
- Consumes: Task 3's `Item[]` and `frameOf`; `shape()` from `./shapes`.
- Produces:
  - `resolveFamily(value, read) → string`: every `var(--name)` replaced by `read('--name')`, again until none is left (`'var(--font-bf-hud)'` → `"'BF Univers Condensed', 'Cuprum', …"`).
  - `fontOf(item, k, read) → string`: `` `${weight} ${max(size, 11.2 / k)}px ${resolveFamily(family, read)}` ``.
  - `paint(ctx, items, { frame, window: { width, height }, ratio = 1, read, media = {} }) → { ms, drawn, skipped: { [type]: n }, missing: { shapes: n } }`: clears the whole backing store, sets the transform to `ratio × k` from the frame's corner (a `bleed` item at the window's whole rect), and draws in order.
  - `fakeContext()` (fixture): every method the painter calls, recorded as `[name, ...args]` in `calls`, and every property set recorded as `['set', name, value]`; `measureText(t)` returns `{ width: t.length * 10 }`.

What each type draws (the DOM `Screen.jsx`'s rules, so the move changes no look but the frame's):
- `rectangle`, `fill`: `fillRect` in `colour` when it has one and `fill` is not `'none'`; `rectangle` with `line` and `colour` and `fill` `'none'`: `strokeRect`, line width `max(1 / k, line)`. `fill: 'blurred'` draws nothing (counted as skipped `blurred`; hand: the game blurs what is behind, phase 2).
- `circle`: an ellipse in the box, filled or stroked by the same rule.
- `text`: `fontOf`; `textAlign` left, center or right (`startofreadingdirection` left, `endofreadingdirection` right); `textBaseline` top, middle or bottom by the vertical align; `wrap` breaks at spaces to the box's width, lines `1.25 × size` apart; `colour` or `#f6f3ea`.
- `vectorShape`: each of `shape(name).paths` as a `Path2D`, scaled uniformly into the box and centred (SVG's `xMidYMid meet`), filled even-odd or stroked; the item's `colour` over the path's own unless it is `rgb(255 255 255)`; a name `shape()` does not know counts in `missing.shapes`.
- `video`: `media[film.url]` (a playing `<video>`, `readyState >= 2`) else `media[film.poster]` (a loaded `Image`), drawn to cover the box; neither, nothing.
- Every other type counts in `skipped`.
- `globalAlpha` is the item's alpha; `ms` from `performance.now()`, and `performance.measure('bf-ui-paint', { start, end })` where `performance.measure` exists.

- [ ] **Step 1: Write the failing tests**:

```js
it('resolves the game’s font variables down to the faces', () => {
  const vars = { '--font-bf-hud': "'BF Univers Condensed', var(--font-bf-cjk), sans-serif", '--font-bf-cjk': "'BF HS Gothic'" };
  expect(resolveFamily('var(--font-bf-hud)', (n) => vars[n])).toBe("'BF Univers Condensed', 'BF HS Gothic', sans-serif");
});
it('keeps type at 0.7 rem in a small window', () => {
  expect(fontOf({ font: { family: 'x', size: 10, weight: 500 } }, 0.5, () => '')).toBe('500 22.4px x');
});
it('draws a tab: its line as a filled rect, its words centred in its face', () => {
  const ctx = fakeContext();
  paint(ctx, [{ id: '0:a', type: 'fill', x: 284, y: 110, w: 2, h: 48, colour: 'rgb(242 174 10)', alpha: 1 }, { id: '0:b', type: 'text', x: 284, y: 110, w: 190, h: 48, text: 'PLAY', font: { family: 'BF', size: 24, weight: 700 }, align: ['center', 'center'], alpha: 1 }], { frame: frameOf({ width: 1920, height: 1080 }), window: { width: 1920, height: 1080 }, read: () => '' });
  expect(ctx.calls).toContainEqual(['fillRect', 284, 110, 2, 48]);
  expect(ctx.calls).toContainEqual(['fillText', 'PLAY', 379, 134]);
  expect(ctx.calls).toContainEqual(['set', 'textAlign', 'center']);
});
it('scales to the frame and the pixel ratio, and counts what it cannot draw yet', () => {
  const ctx = fakeContext();
  const r = paint(ctx, [{ id: '0:l', type: 'line', x: 0, y: 0, w: 10, h: 1, alpha: 1 }], { frame: frameOf({ width: 2560, height: 1080 }), window: { width: 2560, height: 1080 }, ratio: 2, read: () => '' });
  expect(ctx.calls).toContainEqual(['setTransform', 2, 0, 0, 2, 640, 0]);
  expect(r.skipped).toEqual({ line: 1 });
});
```

Plus one each for: a `bleed` item drawn at the window's whole rect; a wrapped text's second line `1.25 × size` below its first; a vector shape filled `'evenodd'` in the item's colour; a white shape keeping its path's colour; an unknown shape counted; a `video` drawing its poster when no video is ready.

- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/lib/bf2017/ui/paint.test.js`.
- [ ] **Step 3: Implement** `paint.js` (`Path2D` built once per shape name and kept in a `Map`).
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit.**

### Task 5: The canvas screen in the HUD kit

**Files:**
- Create: `src/runtime/hud/ScreenCanvas.jsx`, `src/runtime/hud/screenCanvas.css`
- Modify: `src/runtime/hud/index.js` (export `ScreenCanvas`)
- Test: `src/runtime/hud/ScreenCanvas.test.jsx`

**Interfaces:**
- Consumes: Task 3 (`frameOf`, `drawList`, `navigables`), Task 4 (`paint`), `screenKey` (`./screenKey`), `fitCanvas` (`./canvas`), `mayPlay` (`lib/bf2017/films`).
- Produces: `<ScreenCanvas layers={Tree[]} label values active={string[]} onLink onAction contextOf fonts className>{children}</ScreenCanvas>`:
  - `active`: navigable ids drawn selected without focus (the open tab);
  - `contextOf(canvas) → ctx` (default `canvas.getContext('2d')`; a test passes `fakeContext`);
  - `fonts` (default `document.fonts`): `load(font) → Promise`.
  - The root `<div className="hud-screen-canvas" data-screen={last layer's name} role="region" aria-label={label}>`: a `<canvas aria-hidden="true">` filling it; one `<button type="button" className="hud-screen-hit">` per navigable at the window's px (`left = frame.x + n.x × k`, and so on), with `aria-label`, `data-id` (the navigable's box id without its layer), `data-link`, `aria-disabled` when coming, `tabIndex` 0 for each group's first, −1 for the rest; and a `<div className="sr-only">` listing the drawn texts not inside a navigable, in order.
  - Focus and pointer: a button's focus, blur, pointer enter and leave set the selected set (`active` ∪ focus ∪ hover), and the list is made again and painted.
  - Keys: `screenKey(e, { index, cells: group, horizontal, onLink, onAction })` on a button; `{ focus: i }` focuses the group's i-th button.
  - Activation: a navigable with `link` or `screen` calls `onLink(screen ?? link, nav)`, else `onAction(lastPart(nav.id), nav)`; a coming one calls neither.
  - Paints: once on mount and on every change of the list or the window's size (a `ResizeObserver` on the root, else `resize`); again after each distinct `fontOf` among the items has loaded; on every animation frame only while a `<video>` it made is playing.
  - Films: a `video` item's `film` makes one muted, looping, inline `<video crossOrigin="anonymous">` (kept off-screen, not in the page's flow) when `mayPlay({ reduced, saveData })`, and always an `Image` of its poster; both go in `media` by URL.
  - The canvas carries `data-paint-ms` (the last paint's `ms`, rounded to 0.01) and `data-missing` (the sum of `skipped` and `missing`), for the shots script.
- `screenCanvas.css`: `.hud-screen-canvas` fills its parent (`position: absolute; inset: 0`); the canvas fills it; `.hud-screen-hit` is absolutely placed, transparent, borderless, `outline: none` (the focus is drawn by the painter: a comment saying so), `cursor: pointer`, `cursor: default` when `aria-disabled`.

- [ ] **Step 1: Write the failing tests** (jsdom, `@testing-library/react` as the kit's other tests use it; check with `grep -l testing-library src/runtime/hud/*.test.jsx` and follow the same imports):
  - a button over each tab and each tile, in window px at 1920 × 1080 and at 2560 × 1080 (the tabs 320 px further right);
  - focusing the PLAY tab's button paints again with PLAY selected (the fake context's `fillText` calls include the selected words' weight: `['set', 'font', '700 24px …']`);
  - ArrowRight on HOME focuses PLAY; Enter on PLAY calls `onLink` with `'UI/Frontend/Screens/Play/PlayScreen'`; a coming tile's Enter calls nothing;
  - a `fonts.load` that resolves later causes a second paint;
  - `devicePixelRatio` 2 gives a backing store twice the box (through `fitCanvas`);
  - with `mayPlay` false (reduced motion mocked through `matchMedia`) no `<video>` is made and the poster is drawn;
  - the screen reader's list holds “PRESS ENTER TO START” on the Start layer with a values patch giving that text.
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/runtime/hud/ScreenCanvas.test.jsx`.
- [ ] **Step 3: Implement** `ScreenCanvas.jsx` and its CSS; export it from `index.js`.
- [ ] **Step 4: Run them and see them pass**; `npm run lint`.
- [ ] **Step 5: Commit.**

### Task 6: The front end on the canvas

**Files:**
- Modify: `src/components/battlefront/screens/useTree.js` (add `useFrameTree`), `GameScreen.jsx` (a `layers` prop), `Start.jsx`, `MainMenu.jsx`, `Play.jsx`, `FrontEnd.jsx`, `screens.css`, `screens.test.jsx`, `src/data/bf2017/NOTES.md`
- Create: `src/components/battlefront/screens/menuHeader.js` (pure)
- Test: `src/components/battlefront/screens/menuHeader.test.js`

**Interfaces:**
- Consumes: Task 5's `ScreenCanvas`, Task 2's `items`.
- Produces:
  - `useFrameTree(name, { data, items } = {})`: `screen(name, { viewport: { width: 1920, height: 1080 }, data, items })`, memoised on its inputs' JSON.
  - `menuHeader({ tab, crumbs }) → { items, values, active }` (pure): `tab` one of `'Start' | 'Play' | 'Characters'` (the tab cells' ids), `crumbs` an array of words. With crumbs: `items.BreadcrumbList` the crumbs as `{ id, label }`, `MainMenuWidget` hidden. Without: `BreadcrumbWidget` hidden, `active` the tab cell's navigable id. Always: the `Store` cell hidden (it has no key: the game names it at run time), `NewThingAvailable` left hidden.
  - `GameScreen` with `layers` (and `values`, `active`) draws `<ScreenCanvas>` in place of `<Screen>`; with `tree` it is as it was (the screens not in this plan).

The screens:
- **Start**: the layers `[PairingScreen]` (the game's press-start screen). Values: `Press %% To Play As` takes `pressStart()`; `Open Account Picker`, `OPEN BETA DISCLAIMER` and its backing rectangle `e1` hidden (a console's and the beta's: hand). The hand button, title and press line go; any key or a click anywhere still goes on (the window's `keydown` as now, and a click on the root). The backdrop film stays until the `Background` texture is drawn (phase 2): hand.
- **Main menu (HOME)**: the layers `[MainMenuScreen, StartScreen]`: the header with `tab: 'Start'`, the HOME page the game's own `StartScreen`, its online parts hidden by values (`FooterBar`, `TimedChallengesWidget`, `LootBoxButton`: the site is offline). The tab cells' links as `MainMenu.jsx`'s `onLink` today; `first` as `frontEndWays` gives it.
- **Play, its category, Single Player**: the layers `[MainMenuScreen, <stage's screen>]`: `tab: 'Play'` and no crumbs on the PLAY page; crumbs `['PLAY', 'MULTIPLAYER']` on the category and `['PLAY', 'SINGLE PLAYER']` on Single Player (words through `word()` where the game has them: `ID_MAINMENU_SCR_PLAY`, `ID_PLAY_SCR_MULTIPLAYER`). The tiles are the tree's own (`PlayTile`): no `Card` over them. Values per tile, by the tile's name in the path (the names `Play.jsx`'s `tiles` table already keys by): `Title` the table's title where the tree's is the wrong one (the third PLAY tile reads SINGLE PLAYER: the running game's, photographed); `AurebeshTitle` the title's words (the game's Aurebesh face draws them); `VideoWidget/Video` the table's film; `NotInBeta` shown with “NOT IN THIS WORLD YET” on a coming tile, hidden on a live one; `RequiresConnection`, `SplitScreen`, `PlayScenarioWidget`, `EmblemsWidget` hidden (online, split screen, the Arcade's scenarios and factions: not this screen's); the tile navigable `coming` where the table has no `go`. `onAction(tileName)` goes where `go` does. The multiplayer modes and levels stages keep their cards as they are (not this plan's).
- `screens.css`: the `.bf-start-*` rules go; `.bf-card*` stays (the modes and levels stages use it).
- `NOTES.md`, a section “The screens on the canvas (phase 1)”: each hand rule above (the selected rule; an enter animation's end; `fill: 'blurred'` drawn as nothing; the Pairing screen's hidden console and beta parts; the Start backdrop; the tiles' hidden parts; “NOT IN THIS WORLD YET” in `NotInBeta`; the tabs on a tab's page and the breadcrumb deeper), each with its reason.

- [ ] **Step 1: Write the failing tests**: `menuHeader.test.js` (crumbs hide the tabs and fill the list; no crumbs hide the breadcrumb and make the tab active; the Store cell hidden either way), and in `screens.test.jsx`, with `renderToStaticMarkup` as the file does now:
  - Start: `data-screen="UI/Frontend/Screens/StartFlow/PairingScreen"` and “PRESS ENTER TO START” (the screen reader's list);
  - the main menu: a `hud-screen-hit` with `data-link="UI/Data/LinkAssets/Play/PlayScreen"`, none with “OPEN SOCIAL HUB”;
  - Play: buttons labelled MULTIPLAYER, CO-OP and SINGLE PLAYER, CO-OP's `aria-disabled="true"`; the words of the Multiplayer tile's description in the screen reader's list;
  - Single Player: “SINGLE PLAYER” in the breadcrumb's words and no tab buttons.
  Change the existing Start, main menu and Play tests to these; leave every other test as it is.
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/components/battlefront/screens`.
- [ ] **Step 3: Implement** `useFrameTree`, `menuHeader.js`, the `layers` path in `GameScreen`, and the four screens as above.
- [ ] **Step 4: Run them and see them pass**; then `npm test` and `npm run lint`.
- [ ] **Step 5: Look at it**: `npm run dev`, then `#/battlefront` at 1920 × 1080: Start, Enter, the main menu, PLAY, SINGLE PLAYER. The tabs show one selected; the tiles show their outline round the whole tile, their title, their description and their film; Single Player shows its breadcrumb. Note anything wrong for Task 7's README.
- [ ] **Step 6: Commit.**

### Task 7: The shots, the numbers and the evidence

**Files:**
- Create: `scripts/bf-ui-shots.mjs`, `docs/superpowers/evidence/bf-ui-canvas/README.md`
- Modify: `docs/superpowers/HANDOFF-battlefront.md` (a row for this lane), `docs/superpowers/specs/2026-10-13-bf2017-ui-canvas-design.md` (its status line: phase 1 done)

**Interfaces:**
- Consumes: the dev or preview server; the canvas's `data-paint-ms` and `data-missing`.
- Produces: `node scripts/bf-ui-shots.mjs [--base http://127.0.0.1:5431] [--out <dir>] [--sizes 1920x1080,2560x1080]`: walks `#/battlefront` (Start, Enter, the main menu, the PLAY tab, SINGLE PLAYER) in headless Chromium (`executablePath` `/opt/pw-browsers/chromium` when it is there), shoots each screen at each size into `--out` (default the scratch folder `.scratch-check/bf-ui/`, git-ignored: check `.gitignore` and add it if not), and prints one JSON line: `{ screens: [{ name, size, paintMs, missing, errors }] }`; the paint time is the 95th percentile of `performance.getEntriesByName('bf-ui-paint')` on that screen. It exits 1 on a page error or a screen whose paint is over 2 ms at 1920 × 1080.

- [ ] **Step 1: Write the script**, then run it against `npm run dev`; it prints the line and the pictures are there.
- [ ] **Step 2: Write the evidence README**: the reference pictures' addresses for each of the four screens (the web's: the vanilla game's and, for the setup screen later, the Instant Action Overhaul V2's), what the shots show beside them, the differences left, the paint times and the missing counts from Step 1, and the SwiftShader caveat (the cloud's software GL: the times are the CPU's, the desktop's GPU will be lower).
- [ ] **Step 3: Run the gates**: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; all pass.
- [ ] **Step 4: Commit and push** to the branch.
