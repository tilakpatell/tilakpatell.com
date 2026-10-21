# Avengers HQ PR 7: Ricochet and Infiltration in 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors without 3D, or who pick “Play in 2D”, play Ricochet and Infiltration as SVG views over the games’ own rules, and win the Mind Stone and Natasha’s half of the Soul Stone there on any device. This is PR 7 of the seven in spec §11, the last.

**Architecture:**
- Each 2D view is a whole game in its own folder: `ricochet/Flat.jsx` and `widow/Flat.jsx`, each with its own menu, room or level, input, loop, save, stone and results card. The 3D component hands it to PR 4’s frame as `flat={<…Flat paused={paused} onLive={setFlatLive} />}`, and `HQGame` draws it in place of the toy whenever that game’s own 3D is off, unavailable or failed.
- All the rules a test can reach are pure: `ricochet/flatInput.js` and `widow/flatInput.js` (geometry, aim, taps, keys, the danger preview, the fixed step), and the modules both views now share, so a name, a shape or a word cannot drift: `save.js` (the one reader and writer of each `tp-hq-*` key) and `ends.js` (the end card’s words). Scripted players win through the controllers on the real `rules.js`.
- The drawing is pure too: `RoomView.jsx` and `GridView.jsx` take state and return SVG made of abstract markers only. Per-frame values are written straight to SVG attributes inside `lib/shownLoop.js`’s frame, so no new loop and no React state a frame.

**Tech Stack:** React 19, react-router-dom 7, SVG (no canvas and no three.js in the 2D views), `src/lib/shownLoop.js` for Ricochet’s frames, Vitest 5 (node environment: pure modules and components through `react-dom/server`), Vite 8 (its manifest at `dist/.vite/manifest.json`), playwright-core 1.56 under the check scripts.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md` (as amended in `30dd1241`): §8 (two games in 2D), with §5’s switch and results card, §6’s board cards, §3 (rules kept), §11 step 7 and §12 (the checks). The spec wins over any brief. PR 7 of 7; the index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`.

## Global Constraints

- **Order.** PR 7 of 7, merged in order. Branch from `origin/main` with PRs 1–6 merged. It consumes only these:
  - PR 2: `HALF_OF = { 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' }` in `world/labels.js`.
  - PR 3: the addresses `/avengers/training` (`cap`) and `/avengers/operations` (`widow`); `scripts/hq-links-check.mjs [--3d]`, whose last line is `all ok`.
  - PR 4:
    - `HQGame({ game, stage, three, fallback, flat = null, playing = false, paused = false, onPause = null, accent, className = '', children, ...frame })`, which draws `flat ?? fallback` in its toy branch and leaves `StartNote` to the 2D view; `StartNote()`, `TouchHelp({ game })` and `GameScreen` from `hq/HQGame.jsx`.
    - `Results(props)` from `hq/Results.jsx`, with `ResultsCard`’s props (`won`, `kicker`, `title`, `line`, `stone`, `half`, `stoneText`, `stars: { got, of }`, `onward`, `onAgain`, `more`, `className`, `children`); Next and Back come from `GameScreen`.
    - In `hq/gameScreen.js`: `GAMES`, `TOUCH_ICONS`, `TOUCH_HELP` and `switchFor({ can, on, status, flat = false, stone = true })`, whose `flat` branches already say “Play in 2D” and “Play in 3D”.
    - In `hq/HQGame.test.jsx`, the top-level helpers `stage`, `three`, `html`, `barOf`, `noteOf`, `game`, `FILES` and `src`.
    - In `ricochet/Ricochet.jsx`: `three = useGame3D('ricochet')`, `paused`, `pause`, `live` and the two `<Results` cards (`cleared`, `failed`). In `widow/Infiltration.jsx`: `three`, `paused`, `pause`, `playing` and the `cleared` `<Results` card.
  - PR 5: in `board/records.js`, `FLAT_READY = []`, `boardCards(prog, { get, can3D, flat = FLAT_READY })` and the `'flat'` state with `play: 'Play in 2D'`; in `records.test.js`, the `FILE` map, the `needs3d` list and `FLAT_READY`’s assertion; in `OpsBoard.test.jsx`, the Try 3D counts and “hands each button its place”.
  - PR 6: `recordTry(placeId)` from `hq/stones.js`, keyed by place id; in `hq/heist.test.js`, `read`, `bodyOf` and `STARTS` (`[placeId, file, startCallback, callsInFile]`).
- **Line numbers** are `main` at `ddb364bf`. PRs 2, 4, 5 and 6 move lines in `Ricochet.jsx` and `Infiltration.jsx`, so find each place by the quoted text. `ricochet/rules.js`, `ricochet/scene.js`, `widow/rules.js`, `widow/scene.js` and `widow.css` are as they were at `ddb364bf`; PR 4 removed `ricochet.css:20-22` (`.cap-stars`).
- **Content (§3, §8).** Nothing draws a figure, suit or mark of any Marvel character. The views are abstract markers only: lines, hatched bands, dashed lines, small toggles, squares, circles, chevrons, triangles, wedges, rectangles and plain discs. Names (Cap, Natasha) appear as words only. A test holds every room and every level to the tag set `svg defs pattern g line rect circle polygon polyline path`: no text, image or `use`.
- **§8, exactly.** Each view is an SVG over its game’s own `rules.js`, in its own folder, stepped by the same fixed step the 3D game uses (Ricochet’s `1 / 120` s; Infiltration has no clock, a turn is one `act`). It wins its stone through `earnStone` exactly as the 3D game does and saves to the same key: `tp-hq-ricochet` (`{ reached, stars }`) and `tp-hq-widow-level` (a bare count). Both are keyboard playable, have a `role="status"` line, respect `prefers-reduced-motion` and end on §5’s results card.
- **Shared code (§3).** Under `hq/` only `gameScreen.js` changes (two lines’ wording and two touch rows), with its tests and `HQGame.test.jsx`. `HQFrame.jsx`, `HQGame.jsx` and `Results.jsx` are not edited. `scripts/inv-world-check.mjs`’s shots stay the same. Of FL2’s `hq-shots` targets, `invworld`, `thinkmark` and `viewer` read `0 pixels differ` against `main` as they are, and `compound` against at least one of two `main` runs (the index’s two-run rule; Task 6).
- **Keys (§3).** No new key. One writer a key: `ricochet/save.js` and `widow/save.js`, used by both views, with today’s names and shapes. The per-game 3D keys change only through PR 4’s bar switch. `__HQ__` gains `ricochet-flat` and `widow-flat` (dev only, through `register`); every existing name stays.
- **The site’s 3D switch (§5).** Nothing here calls `setMode3D`, `use3D().set` or the site’s `three.set`.
- **One renderer, no new loop (RULES.md).** No `requestAnimationFrame` outside `lib/shownLoop.js`: `loops`, `renderers` and `cycles` stay as on `main`. Dossier and the room picker move to their own files so neither `Flat.jsx` imports its 3D sibling.
- **UI (RULES.md UI).** The 2D HUD sits in rows above and below the SVG, never over it. Nothing a player reads is under 0.72 rem. Every button is at least 44 px on a coarse pointer. No new `kbd` rule (the start cards use `hq.css`’s `.hq-keys`). No bare `z-index` of 10 or more. Under reduced motion nothing transitions and the laser warning is a steady dashed line.
- **Draft #1028.** No edit to `src/components/guide/pages.js` or `src/runtime/hud/*`. The 2D keys are written on each view’s start card, as the 3D games keep theirs (spec §3). PR 5’s “Without 3D” tip stays true.
- **Limits.** Files under 800 lines (`Infiltration.jsx` is 654 at `ddb364bf` and loses about 60 here). No new dependency.
- **Tests.** Beside their files, each under one second, no network. No test is skipped, loosened or deleted; PR 5’s assertions that this PR moves are moved to the new truth with equal strength. `ricochet/rules.test.js`’s room 6 and room 12 cases already run over 1 s; they predate this PR and are left as they are.
- **Copy (RULES.md UI 7).** British spelling, curly quotes (’ “ ”) inside strings, sentence case, no Oxford comma, the key first in a prompt.
- **Commits.** A plain sentence as the subject; the body says why; end with the harness’s attribution lines. No model names anywhere. Never force-push.

## Review Focus

1. **Progress made in one view, then the other view.** A visitor clears room 3 in 2D, presses “Play in 3D” and expects room 4 open in the 3D menu (and the reverse). The 3D component is mounted the whole time and holds its own copy of the save, so it re-reads the key when its 3D comes back. Pinned in Task 2 and Task 4 (the wiring test’s re-read assertion) and Task 6’s `switch` part.
2. **Space or Enter on a focused button inside a 2D view.** A room button on the menu, ↺, Wait or Bite does what the button says and never throws a shield or takes a turn, and nothing is thrown at the room drawn behind the menu. Pinned in Task 1 (“takes no input until a room is entered…”), Tasks 2 and 4 (the wiring test’s `closest('button')` assertion) and Task 6’s `keys` part.
3. **Pause or a hidden tab mid-flight or mid-level.** The shield stops where it is, no tap or key lands and Resume carries on with the same flight. Pinned in Tasks 2 and 4 (`paused={paused}` and `playing={… || flatLive}` in the wiring test) and Task 6’s `pause` part.
4. **A phone in portrait on the widest level** (14 × 10 tiles at about 25 px a tile). The first tap shows which tile was hit and whether it gets her caught before anything happens, a tap in the letterbox or on a far tile does nothing and nothing scrolls sideways. Pinned in Task 3 (`tileFromPoint`’s letterbox, `tapInput`’s far tile) and Task 6’s `touch` part.
5. **A drag that never ends cleanly.** A finger that slides off the screen, a call that steals the pointer or a release back on the thrower throws nothing; a release anywhere else throws at the clamped aim. Pinned in Task 1 (“letting go on the thrower, or losing the pointer, throws nothing”).

---

## Files

| File | Task | Responsibility |
| --- | --- | --- |
| `src/components/avengers/ricochet/rules.js` | 1 | `STEP`, the fixed step both views use |
| `src/components/avengers/ricochet/save.js` + `.test.js` | 1 | the one reader and writer of `tp-hq-ricochet` and the room-12 reward |
| `src/components/avengers/ricochet/ends.js` + `.test.js` | 1 | the end card’s words for a cleared or failed room |
| `src/components/avengers/ricochet/flatInput.js` + `.test.js` | 1 | pure 2D controller: view box, pointer to metres, aim, preview, disc, fixed-step tick |
| `src/components/avengers/ricochet/RoomView.jsx` + `.test.jsx` | 2 | pure SVG of a room |
| `src/components/avengers/ricochet/Rooms.jsx` | 2 | the room picker, moved word for word out of `Ricochet.jsx` |
| `src/components/avengers/ricochet/Flat.jsx` | 2 | `RicochetFlat`: menu, HUD rows, frame, input, events, results, status, dev hook |
| `src/components/avengers/ricochet/ricochet.css` | 2 | appended `.rf*` rules |
| `src/components/avengers/ricochet/Ricochet.jsx` | 1, 2 | uses the shared modules; hands the frame its 2D view |
| `src/components/avengers/widow/save.js` + `.test.js` | 3 | the one reader and writer of `tp-hq-widow-level` |
| `src/components/avengers/widow/ends.js` + `.test.js` | 3 | the end card’s words and who caught her |
| `src/components/avengers/widow/Dossier.jsx` | 3 | her file and the level picker, moved word for word out of `Infiltration.jsx` |
| `src/components/avengers/widow/flatInput.js` + `.test.js` | 3 | pure 2D controller: grid, taps, keys, the danger preview, lasers |
| `src/components/avengers/widow/GridView.jsx` + `.test.jsx` | 4 | pure SVG of a level |
| `src/components/avengers/widow/Flat.jsx` | 4 | `InfiltrationFlat`: menu, HUD rows, tools, input, events, results, status, dev hook |
| `src/components/avengers/widow/widow.css` | 4 | appended `.iwf*` rules |
| `src/components/avengers/widow/Infiltration.jsx` | 3, 4 | uses the shared modules; hands the frame its 2D view |
| `src/components/avengers/hq/gameScreen.js` + `.test.js`, `hq/HQGame.test.jsx` | 2, 4 | “the 2D version” in the fallback lines, the two touch rows, the wiring pins |
| `src/components/avengers/hq/heist.test.js` | 2, 4 | the two `Flat.jsx` rows in `STARTS` |
| `src/components/avengers/board/records.js`, `records.test.js`, `OpsBoard.test.jsx` | 1, 3, 5 | `FLAT_READY` and PR 5’s assertions, moved to the new truth |
| `docs/architecture.md:27` | 5 | one clause |
| `docs/superpowers/evidence/avengers-hq/pr7/` | 6 | README and pictures |

### Task 0: The before numbers

**Files:** none committed.

**Interfaces:**
- Consumes: PRs 1–6 as listed under Global Constraints; PR 1’s manifest script (PR 1 plan, Task 1 Step 2); `scripts/hq-links-check.mjs`’s chromium launch; `scripts/hq-world-check.mjs:28-34` (its init lines).
- Produces, all in `$S` and all consumed by Task 6:
  - `closure.mjs` (PR 1’s manifest script, unchanged), `closure-before.txt` and `chunks-before.txt`;
  - `health-before.txt` and `tests-before.txt`;
  - `avhq-pr7-before.webp` and `avhq-pr7-phone-before.webp`;
  - `hq-pr7-check.mjs`, the scratch browser script (its parts below);
  - `fit-before.txt` and its screenshots in `shots/`, the before fit table and pictures;
  - `links-before/` and `inv-before/`, the two checks’ pictures.

- [ ] **Step 1: Branch and check PRs 1–6 are in.** `S` below is the session’s scratchpad directory, never under the repo. Run `git fetch origin main && git switch -c claude/avengers-hq-pr7-flat-games origin/main`. Then each of these prints one line: `grep -n "export function recordTry" src/components/avengers/hq/stones.js`, `grep -n "export const FLAT_READY = \[\];" src/components/avengers/board/records.js`, `grep -n "flat = null" src/components/avengers/hq/HQGame.jsx`, `grep -n "const STARTS = \[" src/components/avengers/hq/heist.test.js`. And `ls src/components/avengers/ricochet/Flat.jsx` fails.
- [ ] **Step 2: Measure main.** If `$S/closure.mjs` isn’t there from an earlier PR, save PR 1’s manifest script (`2026-10-18-avengers-hq-pr1-splits.md`, Task 1 Step 2) as it, unchanged. Run `npx vite build && node $S/closure.mjs | tee $S/closure-before.txt`, then note the sizes of the manifest’s chunks for `src/components/avengers/ricochet/Ricochet.jsx` and `src/components/avengers/widow/Infiltration.jsx` in `$S/chunks-before.txt`, then `git checkout public/github.json`. Also `node scripts/health.mjs --check --skip build | tee $S/health-before.txt` and `npx vitest run src/components/avengers 2>&1 | tail -4 | tee $S/tests-before.txt`. Expected: one closure total line close to PR 6’s stated size, `within budget`, all passing.
- [ ] **Step 3: Shoot main.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers/training,/avengers/operations,/avengers,/invincible --shots avhq-pr7 --before`, then the same with `--shots avhq-pr7-phone --phone`. Move both `public/changes/avhq-pr7*-before.webp` to `$S/`. Expected: each ends `everything green`.
- [ ] **Step 4: Write the scratch browser script** `$S/hq-pr7-check.mjs` (not committed). It takes part names, then `before` or `after`, prints `ok <part>` or `FAIL <part>: <why>` for each, ends `all ok` or `N problems` and exits 1 on any FAIL.
  - **Launch.** Copy `scripts/hq-links-check.mjs`’s chromium launch. Base `http://localhost:5173/?quality=low#`. Each part opens a new context whose init script copies `scripts/hq-world-check.mjs:28-34`’s lines (`tp-worlds` as JSON, `'"load"'`, among them) and overrides only `tp-3d`: raw `'off'` (as `lib/gpu.js` `setMode3D` stores it; a JSON string reads as auto), or raw `'on'` where the part says 3D; then the part’s own keys. Every `pageerror`, and every console error `scripts/lib/noise.mjs`’s `noisy()` doesn’t know, is a FAIL of the part. Screenshots go to `$S/shots/`.
  - **`fit`** (1024 × 640, then 390 × 844 with `isMobile` and `hasTouch`): for `#/avengers/training` wait for `.rf-room`, and for `#/avengers/operations` for `.iwf-grid`. Start is the first enabled `.cap-room-btn` (training) or `.iw-overlay .btn-primary` (operations). Pass: its bottom ≤ the viewport’s height; the bar’s switch reads `Play in 3D`; `.cw-place` has no text `won in the 3D game`. Write `slug, w × h, bottom` to `$S/fit-<when>.txt`.
  - **`mind`** (1024 × 640): open `#/avengers/training`, wait for `.rf-room`, then evaluate `h = window.__HQ__['ricochet-flat']; h.enter(11); for (const a of [40, 67.3, -12.9]) { h.aim((a * Math.PI) / 180); h.throw(); h.land(); }`. Pass: `JSON.parse(localStorage['tp-hq-stones'])` includes `'mind'`; `tp-hq-ricochet` parses to `reached === 12` and `stars[11] === 3`; `.hq-results` contains `The Mind Stone is yours`; `JSON.parse(localStorage['tp-hq-heist']).data.tries.cap ≥ 1` (the runtime’s `{ v, data }` wrapper). Screenshot.
  - **`soul`** (1024 × 640): open `#/avengers/operations`, wait for `.iwf-grid`, evaluate `window.__HQ__['widow-flat'].setState('won')`. Pass: `tp-hq-stones` includes `'soul-natasha'`; `localStorage['tp-hq-widow-level'] === '8'`; `.hq-results` contains `Natasha’s half of the Soul Stone`; the heist record’s `data.tries.widow ≥ 1`. Screenshot.
  - **`touch`** (390 × 844, `isMobile`, `hasTouch`): open `#/avengers/operations` and evaluate `__HQ__['widow-flat'].start(0)`. Tap the centre of tile (3, 5), computed from `.iwf-grid`’s rect and its 9 × 7 view box as `tileFromPoint` inverts it (scale `min(width / 9, height / 7)`, centred). Pass: `[data-preview]` exists, `state.turns === 0` and `.iwf-line` reads `Tap again to go.` Tap it again. Pass: `state.turns === 1`. Then `start(7)`. Pass: `document.documentElement.scrollWidth ≤ 390`; record `.iwf-grid`’s width / 14 as the tile size. Then open `#/avengers/training` and `__HQ__['ricochet-flat'].enter(0)`. Pass: no sideways scroll, every `.rf-tools button` and `.iwf-tools button` at least 44 px tall. Screenshot both.
  - **`switch`** (1440 × 900, 3D): open `#/avengers` and wait for `.cw-canvas[data-on]` (240 s). Evaluate `__HQWORLD__.enter('cap')` and wait for `.cw-place .hq-canvas[data-on]` (240 s). Pass: the bar has a button reading `Play in 2D`. Click it. Pass: `.rf-room` within 5 s, the button reads `Play in 3D`, `localStorage['tp-hq-3d-ricochet'] === '"off"'` and `localStorage['tp-3d'] === 'on'`. Evaluate `h.enter(0); h.aim(Math.atan2(0.6, 8.1)); h.throw(); h.land()` on `__HQ__['ricochet-flat']`, then click `Play in 3D` and wait for `.hq-canvas[data-on]`. Pass: the second `.cap-room-btn` is enabled (the save was re-read). Click the bar’s Back. Pass: `#hq-world[data-mode="3d"]` and `.cw-canvas[data-on]` within 240 s.
  - **`pause`** (1024 × 640): open `#/avengers/training`; evaluate `h.enter(0); h.aim(0.3); h.throw()`; then `Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`. Pass: the bar’s button reads `Resume` with `aria-pressed="true"`, `h.state.phase === 'flying'` and `h.state.t` is unchanged over 1 s. Set `hidden` back to false, dispatch again and click `Resume`. Pass: `h.state.phase !== 'flying'` within 3 s.
  - **`keys`** (1024 × 640): open `#/avengers/training`; focus the first `.cap-room-btn` and press Space. Pass: `h.state.phase === 'aim'` and `h.state.throws === 0`. Focus `.rf-tools button` and press Space. Pass: still `aim` and `throws === 0`. Focus `.hq-screen.rf` and press Space. Pass: `phase === 'flying'` and `throws === 1`.
  - **`board`** (1440 × 900, a clean profile): open `#/avengers`. Pass: exactly 5 buttons’ text starts with `Try 3D`; `#hq-card-cap a.btn-primary` and `#hq-card-widow a.btn-primary` start with `Play in 2D`; `#hq-card-cap` contains `Win the Mind Stone here in 2D`. With `tp-hq-stones` = `'["mind"]'`: `#hq-card-cap` contains `Mind Stone: won back`.
- [ ] **Step 5: Run the fit, before.** With `npx vite --port 5173 --strictPort` up, run `node $S/hq-pr7-check.mjs fit before`. Expected: FAIL for both (no `.rf-room` or `.iwf-grid`: main shows the toy and “The stone here is won in the 3D game.”). Keep `$S/fit-before.txt` and its screenshots as the before pictures. Also run `OUT=$S/links-before node scripts/hq-links-check.mjs` and `OUT=$S/inv-before node scripts/inv-world-check.mjs`. Expected: `all ok`, then `no page errors`. Stop the server.

---

### Task 1: Ricochet: one fixed step, one save and one ending for both views, and the 2D controller

**Files:**
- Modify: `src/components/avengers/ricochet/rules.js:15` (after `SHIELD`)
- Create: `src/components/avengers/ricochet/save.js`, `save.test.js`, `ends.js`, `ends.test.js`, `flatInput.js`, `flatInput.test.js`
- Modify: `src/components/avengers/ricochet/Ricochet.jsx`: the `local` import (`:8`), the rules import (`:11`), `SAVE` and `STEP` (`:24-25`), `loadSave` (`:28-32`), the `'cleared'` case (`:132-150`) and PR 4’s two `<Results` cards
- Modify: `src/components/avengers/board/records.test.js` (PR 5’s `FILE` map, the `cap` row)

**Interfaces:**
- Consumes: `ROOMS`, `SHIELD`, `newRoom`, `simulateThrow`, `throwShield`, `stepRoom`, `starsFor`, `limitFor` (`ricochet/rules.js`); `local.get` and `local.set` (`lib/hooks.js:166`); PR 4’s Ricochet `Results` props; PR 5’s `FILE` map.
- Produces:
  - `ricochet/rules.js`: `export const STEP = 1 / 120`.
  - `ricochet/save.js`: `SAVE = 'tp-hq-ricochet'`; `readSave(raw) → { reached: 1..12, stars: number[] }`; `loadSave() → Save`; `withClear(save, index, stars) → Save`; `saveClear(save, index, stars) → Save` (writes it); `clearReward(index) → { stone: 'mind', achievement: 'captain' } | null`.
  - `ricochet/ends.js`: `roomEnd(phase: 'cleared' | 'failed', result, index) → { won, kicker, title, line, stars, stone, stoneText }`.
  - `ricochet/flatInput.js`: `VIEW = { x: -8.6, y: -6.6, w: 17.2, h: 13.2 }`; `viewBox = '-8.6 -6.6 17.2 13.2'`; `AIM = { step: 0.012, fine: 0.002, max: 1.55, still: 0.2, cancel: 0.8 }`; `TAIL = 2.6`; `assistFor(index) → boolean`; `toWorld(rect, clientX, clientY) → [x, z]`; `aimFromDrag(origin, point) → radians | null`; `keyAim(angle, key, fine = false) → radians | null`; `aimWords(angle) → string`; `previewPath(room, angle, assist) → [x, z][]`; `discAt(flight) → [x, z] | null`; `createFlat(index) → { room, angle, dragging, live, enter(i), aim(a), press(p), move(p), release(p) → flight | null, cancel(), key(key, { shift }) → { handled, flight }, throw() → flight | null, tick(dt) → events[] }` (the first four are getters).

- [ ] **Step 1: Write the failing tests.** `save.test.js` copies `memoryStorage` from `hq/hq.test.js:41-44`.

```js
// ricochet/save.test.js
describe('Ricochet’s save, one for both views', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reads tp-hq-ricochet in the shape the 3D game writes, clamped', () => {
    expect(SAVE).toBe('tp-hq-ricochet');
    expect(readSave(null)).toEqual({ reached: 1, stars: [] });
    expect(readSave({ reached: 99, stars: [5, -1, '2', null] })).toEqual({ reached: 12, stars: [3, 0, 2, 0] });
    expect(readSave({ reached: 0 }).reached).toBe(1);
  });
  it('keeps the best stars and opens the next room', () => {
    expect(withClear({ reached: 1, stars: [] }, 0, 2)).toEqual({ reached: 2, stars: [2] });
    expect(withClear({ reached: 5, stars: [3] }, 0, 1)).toEqual({ reached: 5, stars: [3] });
    expect(withClear({ reached: 12, stars: [] }, 11, 3).reached).toBe(12);
  });
  it('writes { reached, stars } to tp-hq-ricochet and reads it back', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    saveClear({ reached: 1, stars: [] }, 0, 3);
    expect(JSON.parse(window.localStorage.getItem('tp-hq-ricochet'))).toEqual({ reached: 2, stars: [3] });
    expect(loadSave()).toEqual({ reached: 2, stars: [3] });
  });
  it('gives the Mind Stone and Cap’s achievement for the last room only', () => {
    expect(clearReward(11)).toEqual({ stone: 'mind', achievement: 'captain' });
    expect(clearReward(0)).toBeNull();
    expect(clearReward(10)).toBeNull();
  });
});

// ricochet/ends.test.js
describe('a room’s end card, in the 3D game’s words', () => {
  it('words a cleared room', () => {
    expect(roomEnd('cleared', { stars: 3, throws: 1, catches: 0, stone: false }, 0)).toEqual({ won: true, kicker: 'Room 1 clear', title: 'He could do this all day.', line: 'One throw, par 1.', stars: { got: 3, of: 3 }, stone: null, stoneText: 'The Mind Stone is yours, out of Loki’s sceptre.' });
    const last = roomEnd('cleared', { stars: 2, throws: 4, catches: 2, stone: true }, 11);
    expect([last.title, last.line, last.stone]).toEqual(['Nice throwing.', '4 throws, par 3 · caught it 2 times.', 'mind']);
    expect(roomEnd('cleared', { stars: 2, throws: 3, catches: 1, stone: false }, 6).line).toBe('3 throws, par 2 · caught it once.');
  });
  it('words a failed room: the hostage, or out of throws with the room’s tip', () => {
    expect(roomEnd('failed', { reason: 'hostage' }, 8)).toEqual({ won: false, kicker: 'Room 9', title: 'You hit the hostage.', line: 'The orange dummy is a hostage. Find a way around it.', stars: null, stone: null, stoneText: '' });
    expect(roomEnd('failed', { reason: 'throws' }, 0)).toMatchObject({ title: 'Out of throws.', line: 'Par is 1; you get 4. Aim at the bot and throw. The shield comes back if it passes you.' });
  });
});
```

`flatInput.test.js` imports `{ ROOMS, STEP, newRoom, simulateThrow, starsFor, throwShield }` from `./rules`, `{ clearReward }` from `./save` and the names above.

```js
const deg = (d) => (d * Math.PI) / 180;
const land = (c, dt = 1 / 60) => { const ev = []; for (let i = 0; i < 4000 && c.room.phase === 'flying'; i++) ev.push(...c.tick(dt)); return ev; };
const started = (i) => { const c = createFlat(i); c.enter(i); return c; };

describe('Ricochet from above: geometry and aim', () => {
  it('holds every room inside the view box, metres as the SVG’s units', () => {
    expect(viewBox).toBe('-8.6 -6.6 17.2 13.2');
    for (const r of ROOMS) for (const w of r.walls) for (const [x, z] of [w.a, w.b]) {
      expect(x).toBeGreaterThanOrEqual(VIEW.x); expect(x).toBeLessThanOrEqual(VIEW.x + VIEW.w);
      expect(z).toBeGreaterThanOrEqual(VIEW.y); expect(z).toBeLessThanOrEqual(VIEW.y + VIEW.h);
    }
  });
  it('turns the point under the pointer into the room’s metres, letterboxed', () => {
    const rect = { left: 0, top: 0, width: 860, height: 1000 };
    const [x, z] = toWorld(rect, 430, 500);
    expect(x).toBeCloseTo(0); expect(z).toBeCloseTo(0);
    const [x0, z0] = toWorld(rect, 0, 170);
    expect(x0).toBeCloseTo(-8.6); expect(z0).toBeCloseTo(-6.6);
  });
  it('aims along the drag from the thrower: 0 up the room, positive to the right, as the 3D’s angleAt', () => {
    expect(aimFromDrag([0, 4.6], [0, 0])).toBe(0);
    expect(aimFromDrag([0, 4.6], [1, 3.6])).toBeCloseTo(Math.PI / 4);
    expect(aimFromDrag([0, 4.6], [-5, 5])).toBe(-1.55);
    expect(aimFromDrag([0, 4.6], [0.1, 4.6])).toBeNull();
  });
  it('nudges the aim with the arrow keys as the 3D game does, and says it in words', () => {
    expect(keyAim(0, 'ArrowRight')).toBeCloseTo(0.012);
    expect(keyAim(0, 'd')).toBeCloseTo(0.012);
    expect(keyAim(0, 'ArrowLeft', true)).toBeCloseTo(-0.002);
    expect(keyAim(1.545, 'ArrowRight')).toBe(1.55);
    expect(keyAim(-1.55, 'a')).toBe(-1.55);
    expect(keyAim(0, 'x')).toBeNull();
    expect([aimWords(0), aimWords(deg(0.4)), aimWords(deg(12.4)), aimWords(deg(-30))]).toEqual(['straight ahead', 'straight ahead', '12° right', '30° left']);
  });
  it('previews as far as the 3D game does in that room', () => {
    expect([assistFor(2), assistFor(3)]).toEqual([true, false]);
    const r = newRoom(0);
    const f = simulateThrow(r, deg(30));
    const p = previewPath(r, deg(30), true);
    expect(p).toHaveLength(4);
    expect(p[0]).toEqual([0, 4.6]);
    expect(p[2][0]).toBeCloseTo(f.path[2].x);
    expect(Math.hypot(p[3][0] - p[2][0], p[3][1] - p[2][1])).toBeCloseTo(2.6);
    const q = previewPath(r, deg(30), false);
    expect(q).toHaveLength(3);
    expect(Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])).toBeCloseTo(2.6);
    const short = previewPath(newRoom(0), 0, true); // caught at z 3.6 on the way back
    expect(short).toHaveLength(3);
    expect(short[2][1]).toBeCloseTo(3.6);
  });
  it('puts the disc where the flight is', () => {
    const r = newRoom(0);
    expect(discAt(r.flight)).toBeNull();
    throwShield(r, 0);
    expect(discAt(r.flight)).toEqual([0, 4.6]);
    r.flight.elapsed = 0.3;
    const [x, z] = discAt(r.flight);
    expect(x).toBeCloseTo(0); expect(z).toBeCloseTo(4.6 - 17 * 0.3);
  });
});

describe('Ricochet from above: the controller on the real rules', () => {
  it('takes no input until a room is entered, nor after it ends', () => {
    const c = createFlat(0);
    expect(c.live).toBe(false);
    expect(c.key(' ')).toEqual({ handled: false, flight: null });
    c.press([0.6, -3.5]);
    expect(c.dragging).toBe(false);
    expect([c.throw(), c.tick(1), c.room.t]).toEqual([null, [], 0]);
    c.enter(0);
    expect(c.live).toBe(true);
    c.aim(Math.atan2(0.6, 8.1)); c.throw(); land(c);
    expect([c.room.phase, c.live, c.key(' ').handled]).toEqual(['cleared', false, false]);
  });
  it('a scripted player clears room 1 by dragging at the bot and letting go', () => {
    const c = started(0);
    c.press([0, 4]);
    c.move([0.6, -3.5]);
    expect(c.angle).toBeCloseTo(Math.atan2(0.6, 8.1));
    expect(c.release([0.6, -3.5])).toBeTruthy();
    const ev = land(c);
    expect(c.room.phase).toBe('cleared');
    expect(ev.at(-1)).toMatchObject({ type: 'cleared', throws: 1, stars: 3 });
  });
  it('a scripted player clears room 1 from the keyboard: three nudges right, then Space', () => {
    const c = started(0);
    for (let i = 0; i < 3; i++) expect(c.key('ArrowRight').handled).toBe(true);
    expect(c.angle).toBeCloseTo(0.036);
    expect(c.key(' ').flight).toBeTruthy();
    expect(c.key(' ')).toEqual({ handled: true, flight: null });
    land(c);
    expect([c.room.phase, starsFor(c.room)]).toEqual(['cleared', 3]);
  });
  it('letting go on the thrower, or losing the pointer, throws nothing', () => {
    const c = started(0);
    c.press([0.6, -3.5]);
    expect(c.release([0, 4.6])).toBeNull();
    c.press([0.6, -3.5]);
    c.cancel();
    expect(c.release([0.6, -3.5])).toBeNull();
    expect([c.room.throws, c.room.phase, c.dragging]).toEqual([0, 'aim', false]);
  });
  it('steps the room at the rules’ fixed step, never more than 0.05 s a frame', () => {
    expect(STEP).toBe(1 / 120);
    const c = started(5);
    c.tick(1);
    expect(c.room.t).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(c.room.t).toBeGreaterThanOrEqual(0.05 - STEP);
    for (let i = 0; i < 60; i++) c.tick(1 / 60);
    expect(Math.abs(c.room.t - 1.05)).toBeLessThanOrEqual(STEP);
  });
  it('a scripted player clears room 12 in three throws at any frame rate and earns the Mind Stone', () => {
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      const c = started(11);
      for (const a of [40, 67.3, -12.9]) { c.aim(deg(a)); expect(c.throw()).toBeTruthy(); land(c, dt); }
      expect([c.room.phase, c.room.throws, starsFor(c.room)]).toEqual(['cleared', 3, 3]);
      expect(clearReward(c.room.index)).toEqual({ stone: 'mind', achievement: 'captain' });
    }
  });
});
```

In PR 5’s `records.test.js` (“names the very keys the games and the compound write”), change the `FILE` map’s `cap: 'ricochet/Ricochet.jsx'` to `cap: 'ricochet/save.js'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/ricochet src/components/avengers/board/records.test.js`. Expected: `Failed to resolve import "./save"` (and `"./ends"`, `"./flatInput"`), and `ENOENT … ricochet/save.js` in `records.test.js`. `rules.test.js` still passes.
- [ ] **Step 3: Write the shared modules and the controller.**
  - `rules.js`: `export const STEP = 1 / 120;` after `SHIELD` (`:15`), commented as the step both views step a room at.
  - `save.js` (imports `local` from `'../../../lib/hooks'` and `ROOMS` from `'./rules'`): `readSave(raw)` is `Ricochet.jsx:29-31`’s body on a raw value; `loadSave = () => readSave(local.get(SAVE, null))`; `withClear` is `:136-138` (best stars kept, `reached = max(save.reached, min(12, index + 2))`); `saveClear` is `withClear` then `local.set(SAVE, next)`, returning `next`; `clearReward(index)` is `:143`’s rule, `index === ROOMS.length - 1`.
  - `ends.js` (imports `ROOMS` and `limitFor`): the words of PR 4’s two Ricochet cards, verbatim (at `ddb364bf`: the title `:284`, the line `:293-294`, the stone line `:299`, the failure `:319-320`). `stoneText` is `''` for a failed room.
  - `flatInput.js` (imports `STEP`, `newRoom`, `simulateThrow`, `throwShield`, `stepRoom` from `'./rules'`):
    - `assistFor = (i) => i < 3` (`Ricochet.jsx:181`).
    - `toWorld` inverts `preserveAspectRatio="xMidYMid meet"` over `VIEW`: scale `min(width / VIEW.w, height / VIEW.h)`, centred.
    - `aimFromDrag`: `null` within `AIM.still` of the origin, else `scene.js:571-578`’s `atan2(px − ox, −(pz − oz))` clamped to ±`AIM.max`.
    - `keyAim`: `Ricochet.jsx:220-228` (`arrowleft`/`a` subtract, `arrowright`/`d` add, `fine` for Shift), clamped; any other key `null`.
    - `aimWords`: `Math.round` of the degrees; 0 is `straight ahead`, else `` `${n}° right` `` or `` `${n}° left` ``.
    - `previewPath`: `[]` unless `room.phase === 'aim'`; otherwise `simulateThrow`’s `path[0]` and then the ends of the first 3 stretches with `assist`, 2 without, the last one cut to `TAIL` (`scene.js:392-415`’s `drawAim`).
    - `discAt`: `null` without a flight, else `scene.js:379-390`’s `pointOnPath` at `flight.elapsed`.
    - `createFlat(index)` has the signature above, and the controller tests define the rest. Two values are pinned: `tick(dt)` adds `Math.min(0.05, dt)` to an accumulator and runs `stepRoom(room, STEP)` while it holds a whole step, collecting the events (`Ricochet.jsx:166-174` without the 3D’s hitstop); `release` within `AIM.cancel` of `room.def.cap` throws nothing.
  - `Ricochet.jsx`: delete `:24-25` and `:28-32` (keep `deg` at `:26`), drop the unused `local` import, add `STEP` to the rules import and import `loadSave`, `saveClear` and `clearReward` from `'./save'` and `roomEnd` from `'./ends'`. The `'cleared'` case becomes `setSave((s) => saveClear(s, i, e.stars))`, then `const reward = clearReward(i); if (reward) { unlock(reward.achievement); stone = earnStone(reward.stone) || hasEarned(reward.stone); play('victory'); }`. Each `<Results` card spreads `{...roomEnd('cleared' | 'failed', ui.result, index)}` in place of its `won`, `kicker`, `title`, `line`, `stars`, `stone` and `stoneText`, keeping `className`, `onAgain`, `onward` and `more`. Nothing a player sees changes.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run src/components/avengers` (PR 4’s source pins on `Ricochet.jsx` and PR 2’s `labels.test.js` included). Expected: every file passes; each new test under 50 ms (room 12 is a few ms of simulation a frame rate). Then `npx eslint src/components/avengers/ricochet`. Expected: no output.
- [ ] **Step 5: Commit.** `git add` the eight ricochet files and `board/records.test.js`. Subject: `Ricochet: one fixed step, one save and one ending for both views, and the 2D controller`. Body: the save’s key and shape and the card’s words now have one home each, so the 2D view can’t drift from the 3D one; scripted players clear room 1 by drag and by keys and room 12 at 30, 60 and 144 frames a second.

### Task 2: Ricochet in 2D: the room from above

**Files:**
- Create: `src/components/avengers/ricochet/RoomView.jsx`, `RoomView.test.jsx`, `Rooms.jsx`, `Flat.jsx`
- Modify: `src/components/avengers/ricochet/ricochet.css` (append), `ricochet/Ricochet.jsx` (the room picker at `:330-340`, the `<HQGame` element, a `flatLive` state and the save’s re-read)
- Modify: `src/components/avengers/hq/gameScreen.js` (`switchFor`’s fallback lines, `TOUCH_HELP`), `hq/gameScreen.test.js`, `hq/HQGame.test.jsx`, `hq/heist.test.js` (`STARTS`)

**Interfaces:**
- Consumes: Task 1’s modules; PR 4’s `HQGame`, `StartNote`, `TouchHelp`, `Results`, `switchFor`, `TOUCH_HELP`, the test helpers and Ricochet’s `paused`, `pause` and `live`; PR 6’s `recordTry`; `botAt`, `botsLeft`, `limitFor`, `ROOMS`, `SHIELD` (`rules.js`); `shownLoop(el, frame)` (`lib/shownLoop.js:16`); `capturePointer` (`lib/pointer.js`); `audioContext` (`lib/audio.js`); `register(id, api) → undo` (`hq/useStage.js:194`); `earnStone`, `hasEarned` (`hq/stones.js`); `useAchievements().unlock`.
- Produces:
  - `RoomView({ room, angle, assist })` (default): `<svg class="rf-room">` with `data-wall` (`steel`, `mat`, `glass`, `door`), `data-pillar`, `data-switch`, `data-toggle`, `data-bot` (`bot`, `armored`, `hostage`), `data-patrol`, `data-down`, `data-open`, `data-on`, `data-preview`, `data-thrower`, `data-disc`.
  - `Rooms({ save, onPick })` (default): `.cap-rooms` and the stars line, as the 3D menu has them.
  - `RicochetFlat({ paused = false, onLive = null })` (default); dev hook `window.__HQ__['ricochet-flat'] = { state, angle, enter(i), aim(a), throw(), land() }`.
  - `switchFor(…, flat: true)`’s failed, slow and lost lines end “so here is the 2D version.”; `TOUCH_HELP['ricochet-flat']`.

- [ ] **Step 1: Write the failing tests.** `RoomView.test.jsx` imports `renderToStaticMarkup`, `{ ROOMS, newRoom, throwShield }`, `{ assistFor, previewPath }` and `RoomView`:

```jsx
const html = (i, f) => { const r = newRoom(i); f?.(r); return renderToStaticMarkup(<RoomView room={r} angle={0} assist={false} />); };
const ALLOWED = new Set(['svg', 'defs', 'pattern', 'g', 'line', 'rect', 'circle', 'polygon', 'polyline', 'path']);

describe('a room from above', () => {
  it('draws every room in abstract markers only', () => {
    for (let i = 0; i < ROOMS.length; i++) {
      const out = renderToStaticMarkup(<RoomView room={newRoom(i)} angle={0} assist={assistFor(i)} />);
      expect([...out.matchAll(/<([a-z]+)/g)].every(([, t]) => ALLOWED.has(t)), `room ${i + 1}`).toBe(true);
    }
  });
  it('draws steel solid, mats hatched, glass dashed and doors and switches as toggles', () => {
    expect(html(0)).toMatch(/<line[^>]*data-wall="steel"/);
    expect(html(0)).not.toMatch(/data-wall="steel"[^>]*stroke-dasharray/);
    expect(html(3)).toMatch(/data-wall="mat"[^>]*fill="url\(#rf-hatch\)"/);
    expect(html(4)).toMatch(/<line[^>]*data-wall="glass"[^>]*stroke-dasharray/);
    expect(html(6)).toContain('data-wall="door"');
    expect(html(6)).toContain('data-switch');
    expect(html(6, (r) => (r.walls.find((w) => w.kind === 'door').open = true))).toMatch(/data-wall="door"[^>]*data-open/);
    expect(html(4, (r) => (r.walls.find((w) => w.kind === 'glass').broken = true))).not.toContain('data-wall="glass"');
  });
  it('draws bots as squares, armoured ones double-outlined, and the hostage an open circle', () => {
    expect(html(0)).toMatch(/<rect[^>]*data-bot="bot"/);
    const armored = html(10).match(/<g[^>]*data-bot="armored".*?<\/g>/s)[0];
    expect(armored.match(/<rect/g)).toHaveLength(2);
    expect(html(8)).toMatch(/<circle[^>]*data-bot="hostage"[^>]*fill="none"/);
    expect(html(0, (r) => (r.bots[0].down = true))).toContain('data-down');
  });
  it('turns the thrower’s chevron to the aim, and shows the plain disc in the accent only in flight', () => {
    const r = newRoom(0);
    const a = (30 * Math.PI) / 180;
    const aim = renderToStaticMarkup(<RoomView room={r} angle={a} assist />);
    expect(aim).toMatch(/<polygon[^>]*data-thrower[^>]*transform="translate\(0 4\.6\) rotate\(30\.0\)"/);
    expect(aim).toMatch(/<circle[^>]*data-disc[^>]*visibility="hidden"/);
    expect(aim.match(/data-preview[^>]*points="([^"]*)"/)[1].trim().split(' ')).toHaveLength(previewPath(r, a, true).length);
    throwShield(r, 0);
    const fly = renderToStaticMarkup(<RoomView room={r} angle={0} assist />);
    expect(fly).toMatch(/<circle[^>]*data-disc[^>]*fill="var\(--hq-accent\)"/);
    expect(fly).not.toMatch(/data-disc[^>]*visibility="hidden"/);
  });
});
```

In `hq/gameScreen.test.js`, change the touch test’s first line to `expect(Object.keys(TOUCH_HELP).sort()).toEqual([...GAMES, 'ricochet-flat'].sort());` and add:

```js
it('says the 2D version when a game that has one falls back from 3D', () => {
  for (const [status, text] of [['failed', '3D couldn’t start here, so here is the 2D version.'], ['slow', 'This device was struggling with 3D, so here is the 2D version.'], ['lost', 'The graphics chip reset, so here is the 2D version.']]) {
    expect(switchFor({ can: true, on: true, status, flat: true })).toEqual({ bar: null, note: { text, action: { label: 'Try 3D again', next: 'retry' } } });
  }
});
it('has touch words for Ricochet in 2D', () => {
  expect(TOUCH_HELP['ricochet-flat'].map((r) => r.icon)).toEqual(['drag', 'tap', 'button']);
});
```

In `hq/HQGame.test.jsx`, after PR 4’s blocks:

```jsx
// [the 2D view, the 3D game's own live flag, its file, how the 3D game re-reads the save]
const FLAT = { ricochet: ['RicochetFlat', 'live', 'ricochet/Flat.jsx', /if \(three\.on\) setSave\(loadSave\(\)\)/] };

describe('a game with a 2D view', () => {
  it('offers Play in 2D over its 3D game, with the 2D view kept out of it', () => {
    const out = html(game({ flat: <i>flat</i> }));
    expect(barOf(out)).toContain('>Play in 2D<');
    expect(out).toContain('<i>hud</i>');
    expect(out).not.toContain('<i>flat</i>');
  });
  it('says the 2D version when its 3D falls back, and shows the 2D view alone without WebGL', () => {
    const slow = html(game({ stage: { status: 'slow' }, flat: <i>flat</i> }));
    expect(noteOf(slow)).toContain('This device was struggling with 3D, so here is the 2D version.');
    expect(slow).toContain('<i>flat</i>');
    const none = html(game({ stage: { status: 'idle' }, three: { on: false, can: false }, flat: <i>flat</i> }));
    expect(none).toContain('<i>flat</i>');
    expect(barOf(none)).not.toMatch(/Play in|3D game/);
    expect(noteOf(none)).toBe('');
  });
  it.each(Object.keys(FLAT))('%s hands the frame its 2D view, live and paused with the game, and re-reads its save on the way back to 3D', (id) => {
    const [name, live, file, reread] = FLAT[id];
    const s = src(FILES[id]);
    expect(s).toContain(`flat={<${name} paused={paused} onLive={setFlatLive} />}`);
    expect(s).toContain(`playing={${live} || flatLive}`);
    expect(s).toMatch(reread);
    expect(src(file)).toContain("e.target.closest('button')");
  });
});
```

In `hq/heist.test.js`, append `['cap', 'ricochet/Flat.jsx', 'enter', 1]` to `STARTS`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/ricochet/RoomView.test.jsx src/components/avengers/hq`. Expected: `Failed to resolve import "./RoomView"`; the 2D-version cases fail on “the simple version”; the touch test fails on the missing `ricochet-flat` key (and `TOUCH_HELP['ricochet-flat']` is undefined); the `ricochet` wiring case fails on `flat={<RicochetFlat`; `heist.test.js` fails with `ENOENT … ricochet/Flat.jsx`. The “Play in 2D” case already passes: it pins PR 4’s frame for this view.
- [ ] **Step 3: The frame’s words.** In `gameScreen.js`, `switchFor`’s third check (failed, slow, lost) words its line with “the 2D version” in place of “the simple version” when `flat` is set; the signature and every other branch are unchanged. Add to `TOUCH_HELP`, verbatim: `'ricochet-flat': [{ icon: 'drag', text: 'Press anywhere in the room to aim there, slide to adjust and lift to throw' }, { icon: 'tap', text: 'Let go back on Cap to keep the shield' }, { icon: 'button', text: 'The ↺ button starts the room again' }]`.
- [ ] **Step 4: `RoomView.jsx`, pure and hook-free.**
  - Root `<svg className="rf-room" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Room ${room.index + 1}, ${room.def.name}, from above`}>`; then `<defs><pattern id="rf-hatch" patternUnits="userSpaceOnUse" width="0.3" height="0.3" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="0.3" /></pattern></defs>` and the floor `<rect className="rf-floor" x="-8" y="-6" width="16" height="12" />`.
  - Every marker puts its `data-*` first among its props, so the markup reads as the tests read it.
  - Walls, by kind: one filled `<rect data-pillar>` per distinct `w.box` under its lines; steel `<line data-wall="steel">`; mat a `<polygon data-wall="mat" fill="url(#rf-hatch)">` band 0.3 m wide centred on a–b; glass, until `broken`, `<line data-wall="glass" strokeDasharray="0.5 0.3">`; door `<line data-wall="door" data-open={w.open || undefined}>` with a 0.36 m `<rect data-toggle>` at its midpoint, filled when open.
  - Switch: `<g data-switch data-on={s.on || undefined} transform="translate(x z)">`, a 0.8 × 0.44 rounded rect and a knob (`r` 0.16) at x −0.2 off, +0.2 on.
  - Bots: a `<g data-patrol={b.patrol ? b.key : undefined} transform={`translate(${x} ${z})`}>` each at `botAt(b, room.t)`, holding a 0.9 m `<rect data-bot="bot">`; or `<g data-bot="armored">` with an outer 0.9 m rect (left out once `dents ≥ 1`) and an inner 0.6 m rect; or `<circle data-bot="hostage" r="0.45" fill="none">`. A down bot carries `data-down`.
  - Then `<polyline data-preview points={previewPath(...).map((p) => p.join(',')).join(' ')} fill="none" />`, the thrower `<polygon data-thrower points="0,-0.6 0.45,0.35 0,0.1 -0.45,0.35" transform={`translate(${cx} ${cz}) rotate(${deg.toFixed(1)})`} />` (an up-pointing chevron, as angle 0 is up the room) and `<circle data-disc r={SHIELD.r} fill="var(--hq-accent)">` at `discAt(room.flight)`, with `visibility="hidden"` and the thrower’s place when there is no flight.
- [ ] **Step 5: `Rooms.jsx`.** Move the room picker and its stars line (`Ricochet.jsx:330-340`, with `totalStars`) word for word into `Rooms({ save, onPick })`. `Ricochet.jsx`’s start card renders `<Rooms save={save} onPick={enter} />` in their place.
- [ ] **Step 6: `Flat.jsx`, `RicochetFlat({ paused = false, onLive = null })`.**
  - **State.** `const [ctl] = useState(() => createFlat(start))`, with `start = Math.min(loadSave().reached, ROOMS.length) - 1`; `save` (`loadSave`), `index`, `ui = { phase: 'menu' | 'aim' | 'flying' | 'cleared' | 'failed', throws, left, result }` and `angleShown`. `live` is `ui.phase` `aim` or `flying`. `useEffect(() => onLive?.(live), [live, onLive])`, and `onLive?.(false)` on unmount.
  - **`const enter = useCallback((i) => { … })`**: `audioContext()`, `recordTry('cap')`, `ctl.enter(i)`, `setIndex(i)`, `ui` to `aim` with `throws: 0`, `left: botsLeft(ctl.room)`, `result: null`, then focus the root. The only `recordTry(` in the file.
  - **The frame.** While `live && !paused`, an effect runs `shownLoop(stageEl, frame)` and returns its `stop`. `frame(now)` takes `dt` from the last `now` (0 on the first), calls `ctl.tick(dt)`, then writes straight to the SVG, queried from it each frame: `[data-disc]`’s `cx`, `cy` and `visibility` from `discAt`, each `[data-patrol]`’s `transform` from `botAt(b, ctl.room.t)`, `[data-thrower]`’s `transform` from `ctl.angle` and `[data-preview]`’s `points` from `previewPath`. Events go to `handle`. No `requestAnimationFrame`, no state a frame.
  - **`handle(events)`.** The 3D game’s sounds on the same events (`Ricochet.jsx:98-131`: `clang`, `knock`, `shatter`, `beeps`, `transform`, `buzz`; `ding` on clear); no vibration. `'cleared'`: `setSave((s) => saveClear(s, i, e.stars))`; `reward = clearReward(i)`, and with it `unlock(reward.achievement)`, `stone = earnStone(reward.stone) || hasEarned(reward.stone)` and `play('victory')`; then `ui` to `cleared` with `{ stars, throws, catches, stone }`. `'failed'`: `ui` to `failed` with `{ reason }`. Otherwise sync `throws` and `left`.
  - **Pointer**, on `<div className="rf-stage">` around `RoomView` (so the HUD rows and buttons take no aim), each point from `toWorld(svg.getBoundingClientRect(), e.clientX, e.clientY)`, nothing while `paused`: down (not on a button) `capturePointer(e)` and `ctl.press(p)`; move `ctl.move(p)` while dragging or for a mouse; up, a non-null `ctl.release(p)` plays `zip` and syncs; cancel `ctl.cancel()`. `touchAction: 'none'` while live.
  - **Keys**, on the root: return at once when `e.target.closest('button')`, when not live or when `paused` (Esc is never prevented, so the frame’s Back works). `r` restarts with `enter(index)`. Otherwise `const r = ctl.key(e.key, { shift: e.shiftKey })`; when handled, `preventDefault`, then a flight plays `zip` and syncs, an aim sets `angleShown`.
  - **Layout.** Root `<div className="hq-screen rf" role="group" tabIndex={0} aria-label="Ricochet in 2D, the room from above. Drag from Cap and let go to throw the shield, or aim with the left and right arrow keys (Shift for fine aim) and throw with Space. R restarts the room.">`, a grid of four rows: `.rf-bar` (`aria-hidden`: `Room n/12 · name`, `{throws} throws · par {par} · max {limitFor(def)}`, `1 bot left` or `{n} bots left`, `{deg.toFixed(1)}°`); `.rf-stage` with `RoomView`; `.rf-tip` (`def.tip`); `.rf-tools` with a `cap-touch-btn` `↺` (`aria-label="Restart the room"`). The room is drawn behind every card.
  - **Cards**, each an `.hq-overlay` over the root:
    - Menu: `.hq-overlay.cap-overlay` with the kicker `Training center · shield work`, the title `Ricochet`, the text “Twelve rooms, from above. Drag from Cap and let go to throw, or aim with ← → and throw with Space. Steel bounces the shield, mats stop it, glass breaks and switches open doors.”, `<StartNote />`, `.hq-keys` (`←` `→` aim · `Shift` fine aim · `Space` throw · `R` restart · or drag and let go), `<TouchHelp game="ricochet-flat" />` and `<Rooms save={save} onPick={enter} />`.
    - Paused (live and `paused`): `Paused` and `Room {index + 1} of 12, {def.name}.`, as PR 4’s 3D card; Resume is the bar’s.
    - End: `<Results className="cap-overlay" {...roomEnd(ui.phase, ui.result, index)} onAgain={() => enter(index)} …/>` with the same `onward` (Next room) and `more` (All rooms, back to the menu) as `Ricochet.jsx`’s cards.
  - **Status.** `<p className="sr-only" role="status">`: while live `` `Room ${i + 1}, ${def.name}. ${bots left}. ${throws} throws. Aim ${aimWords(angleShown)}.` ``, with `angleShown` set by keys and releases only; `Paused.` while paused; otherwise empty (the card’s title is a status of its own).
  - **Dev hook.** `useEffect(() => register('ricochet-flat', { get state() { return ctl.room; }, get angle() { return ctl.angle; }, enter, aim: (a) => ctl.aim(a), throw: doThrow, land() { while (ctl.room.phase === 'flying') handle(ctl.tick(STEP)); } }), [...])`.
- [ ] **Step 7: `ricochet.css`, appended** under `/* Ricochet in 2D (ricochet/Flat.jsx): the room from above */`. Pinned: the `.rf` grid’s stage row is `minmax(0, 1fr)`, so Start fits (Task 6’s `fit`); the colours are `--rf-*` custom properties taken from the 3D room’s materials (`scene.js:116-136`), with the floor and a down bot this view’s own; stroke widths are in metres, the SVG’s units (a comment says so), and `[data-preview]` is a dotted line in `var(--hq-accent)`; `.rf-bar` and `.rf-tip` are no smaller than 0.72 rem (`.cap-touch-btn` is already 48 px); the switch knob’s transition is removed under `prefers-reduced-motion: reduce`.
- [ ] **Step 8: `Ricochet.jsx` hands the frame its 2D view.** Import `RicochetFlat from './Flat'`. Add `const [flatLive, setFlatLive] = useState(false)`. On the `<HQGame` element: `playing={live || flatLive}` (keeping `paused={paused} onPause={pause}`) and `flat={<RicochetFlat paused={paused} onLive={setFlatLive} />}`. Add `useEffect(() => { if (three.on) setSave(loadSave()); }, [three.on]);`, commented: the 2D view writes the same save, so the 3D menu reads it again on the way back.
- [ ] **Step 9: Run them to see them pass.** Run `npx vitest run src/components/avengers/ricochet src/components/avengers/hq src/components/avengers/world`. Expected: every file passes, `RoomView.test.jsx` 4 under 100 ms each. Then `npx eslint src/components/avengers/ricochet src/components/avengers/hq` (no output) and `wc -l src/components/avengers/ricochet/*.jsx` (each under 800).
- [ ] **Step 10: Commit.** `git add` the four new ricochet files, `ricochet.css`, `Ricochet.jsx`, `hq/gameScreen.js`, `hq/gameScreen.test.js`, `hq/HQGame.test.jsx` and `hq/heist.test.js`. Subject: `Ricochet in 2D: the room from above, over the real rules`. Body: §8’s markers, the preview as long as the 3D game gives the room, release or Space to throw, the same save, stone and card; the frame’s fallback lines say “the 2D version”; the bar’s Pause and the hidden tab reach the 2D view through `flatLive`.

### Task 3: Infiltration: one save, one ending and one file for both views, and the 2D controller

**Files:**
- Create: `src/components/avengers/widow/save.js`, `save.test.js`, `ends.js`, `ends.test.js`, `Dossier.jsx`, `flatInput.js`, `flatInput.test.js`
- Modify: `src/components/avengers/widow/Infiltration.jsx`: `SAVE` (`:23`), `KEY_DIRS` (`:26`), `FILE` (`:28-38`), `CAUGHT` (`:39`), `readSave` (`:41`) and its two uses (`:47-48`), the `'won'` case (`:133-141`), PR 4’s `<Results` card, the `Dossier` function (`:535-567`)
- Modify: `src/components/avengers/board/records.test.js` (PR 5’s `FILE` map, the `widow` row)

**Interfaces:**
- Consumes: `LEVELS`, `LEVEL_COUNT`, `DIRS`, `parseLevel`, `newLevel`, `act`, `cloneState`, `biteTargets`, `solid`, `laserOn`, `angleOf` (`widow/rules.js`); `local` (`lib/hooks.js:166`); `HALF_OF` (PR 2).
- Produces:
  - `widow/save.js`: `SAVE = 'tp-hq-widow-level'`; `readCleared() → 0..8`; `recordWin(index) → { cleared, fresh }`.
  - `widow/ends.js`: `CAUGHT = { guard, camera, laser }`; `levelEnd(result, index) → { won: true, kicker, title, line, stone, half, stoneText }`.
  - `widow/Dossier.jsx`: default `Dossier({ cleared, fresh, onPick })`.
  - `widow/flatInput.js`: `viewBoxOf(def) → '-0.5 -0.5 w h'`; `tileFromPoint(rect, clientX, clientY, def) → { x, y } | null`; `dirTo(s, x, y) → 'N' | 'E' | 'S' | 'W' | null`; `foresee(s, action) → { danger, bump, won }`; `KEY_DIRS`; `IDLE = { armed: null, biting: false }` (frozen); `actionAt(s, input, tile) → action | null`; `tapInput(s, input, tile, { touch = false } = {}) → { input, action }`; `keyInput(s, input, key) → { input, action, handled }`; `laserLine(def, laser) → [[x1, y1], [x2, y2]]`; `laserState(def, id, t) → 'on' | 'warn' | 'off'`.

- [ ] **Step 1: Write the failing tests.** `save.test.js` copies `memoryStorage` from `hq/hq.test.js:41-44`; `flatInput.test.js` imports from `./rules` and `./flatInput`.

```js
// widow/save.test.js
afterEach(() => vi.unstubAllGlobals());
it('counts the levels cleared in tp-hq-widow-level, as a bare number', () => {
  vi.stubGlobal('window', { localStorage: memoryStorage() });
  expect(readCleared()).toBe(0);
  expect(recordWin(0)).toEqual({ cleared: 1, fresh: 0 });
  expect(window.localStorage.getItem('tp-hq-widow-level')).toBe('1');
  expect(recordWin(0)).toEqual({ cleared: 1, fresh: -1 });
  window.localStorage.setItem('tp-hq-widow-level', '99');
  expect(readCleared()).toBe(8);
  window.localStorage.setItem('tp-hq-widow-level', '"x"');
  expect(readCleared()).toBe(0);
});

// widow/ends.test.js
it('words a cleared level as the 3D game does', () => {
  expect(levelEnd({ turns: 16, takedowns: 0, bites: 0, stone: false }, 0)).toEqual({ won: true, kicker: 'Level 1 · Patrol · clear', title: 'Unseen.', line: '16 turns. One more line of her file, declassified.', stone: null, half: 'Natasha’s', stoneText: 'Natasha’s half of the Soul Stone. Clint has the other half, at the range.' });
  expect(levelEnd({ turns: 46, takedowns: 2, bites: 1, stone: true, both: true }, 7)).toMatchObject({ kicker: 'Level 8 · The archive · clear', title: 'The file is out.', line: '46 turns · 2 takedowns · 1 bite. Every line of it.', stone: 'soul', half: null, stoneText: 'Natasha’s half of the Soul Stone, and Clint’s: the Soul Stone is yours.' });
  expect(levelEnd({ turns: 30, takedowns: 1, bites: 0, stone: true, both: false }, 7)).toMatchObject({ stone: 'soul', half: 'Natasha’s' });
});
it('says who saw her', () => {
  expect(CAUGHT).toEqual({ guard: 'A guard saw you.', camera: 'The camera saw you.', laser: 'You stood in a live laser.' });
});
```

```js
// widow/flatInput.test.js
const BITE_ROOM = { name: 't', tip: '', charges: 1, map: ['#######', '#S.G.F#', '#....E#', '#######'], guards: [{ dir: 'W', route: 'w' }] };
const PATROL = 'NwNNWNNSSEEENNNE'; // level 1’s 16-turn solution, solveLevel(0)

describe('Infiltration from above', () => {
  it('lays the grid out a tile to a unit, centred on whole numbers', () => {
    const def = parseLevel(0);
    expect(viewBoxOf(def)).toBe('-0.5 -0.5 9 7');
    const rect = { left: 0, top: 0, width: 900, height: 700 };
    expect(tileFromPoint(rect, 350, 650, def)).toEqual({ x: 3, y: 6 });
    expect(tileFromPoint(rect, 899, 0, def)).toEqual({ x: 8, y: 0 });
    const tall = { left: 0, top: 0, width: 900, height: 900 };
    expect(tileFromPoint(tall, 350, 750, def)).toEqual({ x: 3, y: 6 });
    expect(tileFromPoint(tall, 350, 50, def)).toBeNull(); // the letterbox
  });
  it('knows her four neighbours and nothing else', () => {
    const s = newLevel(0);
    expect([dirTo(s, 3, 5), dirTo(s, 2, 6), dirTo(s, 4, 5), dirTo(s, 3, 6), dirTo(s, 3, 4)]).toEqual(['N', 'W', null, null, null]);
  });
  it('foresees the step that gets her caught, on the real rules, without taking it', () => {
    const s = newLevel(0);
    act(s, { type: 'move', dir: 'N' });
    expect(foresee(s, { type: 'move', dir: 'N' })).toEqual({ danger: true, bump: false, won: false });
    expect(foresee(s, { type: 'wait' }).danger).toBe(false);
    expect([s.px, s.py, s.turns, s.phase]).toEqual([3, 5, 1, 'play']);
  });
  it('with a mouse a click steps at once; on touch the first tap previews and the second commits', () => {
    const s = newLevel(0);
    expect(tapInput(s, IDLE, { x: 3, y: 5 }).action).toEqual({ type: 'move', dir: 'N' });
    const a = tapInput(s, IDLE, { x: 3, y: 5 }, { touch: true });
    expect([a.action, a.input.armed]).toEqual([null, { x: 3, y: 5 }]);
    const moved = tapInput(s, a.input, { x: 2, y: 6 }, { touch: true });
    expect([moved.action, moved.input.armed]).toEqual([null, { x: 2, y: 6 }]);
    expect(tapInput(s, a.input, { x: 3, y: 5 }, { touch: true })).toEqual({ input: IDLE, action: { type: 'move', dir: 'N' } });
    expect(tapInput(s, IDLE, { x: 3, y: 6 }).action).toEqual({ type: 'wait' });
    expect(tapInput(s, a.input, { x: 5, y: 4 }, { touch: true })).toEqual({ input: { ...a.input, armed: null }, action: null });
    expect(tapInput(s, a.input, null, { touch: true }).input.armed).toBeNull();
  });
  it('the Widow’s Bite is a button, then a tile or an arrow', () => {
    LEVELS[200] = BITE_ROOM;
    const s = newLevel(200);
    const armed = keyInput(s, IDLE, 'b');
    expect([armed.input.biting, armed.action]).toEqual([true, null]);
    expect(tapInput(s, armed.input, { x: 3, y: 1 })).toEqual({ input: IDLE, action: { type: 'bite', dir: 'E' } });
    expect(keyInput(s, armed.input, 'ArrowRight').action).toEqual({ type: 'bite', dir: 'E' });
    expect(keyInput(s, armed.input, 'Escape')).toMatchObject({ handled: true, input: { biting: false } });
    expect(keyInput(s, IDLE, 'Escape').handled).toBe(false);
    expect(keyInput(newLevel(0), IDLE, 'e').input.biting).toBe(false);
  });
  it('a scripted player wins level 1 from the keyboard, the step ahead caught at turn 1', () => {
    const KEY = { N: 'ArrowUp', E: 'ArrowRight', S: 'ArrowDown', W: 'ArrowLeft', w: ' ' };
    const s = newLevel(0);
    let input = IDLE;
    const ev = [];
    for (const c of PATROL) {
      if (s.turns === 1) expect(foresee(s, { type: 'move', dir: 'N' }).danger).toBe(true);
      const r = keyInput(s, input, KEY[c]);
      input = r.input;
      ev.push(...act(s, r.action));
    }
    expect([s.phase, s.turns]).toEqual(['won', 16]);
    expect(ev).toContainEqual({ type: 'won', index: 0, turns: 16 });
  });
  it('a scripted player wins level 1 by tapping, each tile twice on touch', () => {
    const s = newLevel(0);
    let input = IDLE;
    for (const c of PATROL) {
      const tile = c === 'w' ? { x: s.px, y: s.py } : { x: s.px + DIRS[c][0], y: s.py + DIRS[c][1] };
      const first = tapInput(s, input, tile, { touch: true });
      expect(first.action).toBeNull();
      const second = tapInput(s, first.input, tile, { touch: true });
      input = second.input;
      act(s, second.action);
    }
    expect([s.phase, s.file]).toEqual(['won', true]);
  });
  it('draws each laser across its tile, on, warning or off by the facility’s turn', () => {
    const d4 = parseLevel(3);
    expect([laserState(d4, 0, 0), laserState(d4, 0, 2), laserState(d4, 0, 3)]).toEqual(['on', 'off', 'warn']);
    expect(laserLine(d4, d4.lasers[0])).toEqual([[3, 0.5], [3, 1.5]]);
    const d8 = parseLevel(7);
    expect(laserLine(d8, d8.lasers[0])).toEqual([[1.5, 6], [2.5, 6]]);
  });
});
```

In PR 5’s `records.test.js`, change the `FILE` map’s `widow: 'widow/Infiltration.jsx'` to `widow: 'widow/save.js'`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/widow src/components/avengers/board/records.test.js`. Expected: `Failed to resolve import "./save"` (and `"./ends"`, `"./flatInput"`), `ENOENT … widow/save.js`; `rules.test.js` 14 passed, unchanged.
- [ ] **Step 3: Write the shared modules and the controller.**
  - `save.js` (imports `local` and `LEVEL_COUNT`): `readCleared` is `Infiltration.jsx:41`; `recordWin(index)` is `:134-138`: `n = index + 1`, `fresh = n > readCleared() ? index : -1`, write `n` when fresh, return `{ cleared: readCleared(), fresh }`.
  - `ends.js` (imports `LEVELS`, `LEVEL_COUNT` and `HALF_OF` from `'../world/labels'`): `CAUGHT` moves from `:39` word for word; `levelEnd` holds PR 4’s card words, verbatim (at `ddb364bf`: `:471-482`), with `half = result.both ? null : HALF_OF['soul-natasha']`.
  - `Dossier.jsx`: `FILE` (`:28-38`) and `Dossier` with its comment (`:535-567`) move word for word; it imports `LEVELS` and `LEVEL_COUNT` from `'./rules'`.
  - `flatInput.js` (imports from `'./rules'` only):
    - `viewBoxOf` is `` `-0.5 -0.5 ${def.w} ${def.h}` `` (a tile’s centre is its whole coordinates, `rules.js:12-13`); `tileFromPoint` inverts `meet` over `w × h` and floors, `null` outside the grid.
    - `dirTo`: the `DIRS` key whose step is `[x − s.px, y − s.py]`. `foresee` is `cloneState`, then `act` on the clone (the same two calls as `Infiltration.jsx:262-263`), reporting `caught`, a first `bump` and `won`.
    - `KEY_DIRS` moves from `Infiltration.jsx:26` (the 3D game imports it from here).
    - `actionAt`: while `biting`, the bite towards the `biteTargets(s)` guard on that tile, else `null`; her own tile `wait`; a neighbour a `move`; anything else `null`.
    - `tapInput`: no tile, `s.phase !== 'play'` or no action clears `armed` with no action; on touch, a tile not yet armed is armed with no action; otherwise the action, with `IDLE`.
    - `keyInput`: an arrow or W A S D moves (or bites that way while biting); `' '`, `.` or `enter` waits; `e` or `b` toggles `biting` when `biteTargets(s)` isn’t empty (else `handled` with no change); `escape` while biting cancels; every other key `{ input, action: null, handled: false }`.
    - `laserLine`: `along = l.along ?? (solid(def, x − 1, y) && solid(def, x + 1, y) ? 'x' : 'y')` from the first cell (`scene.js:648`), half a tile past each end. `laserState` is `scene.js:1277-1279`: on now, `warn` when on next turn, else `off`.
  - `Infiltration.jsx`: delete the moved lines, import `readCleared` and `recordWin` from `'./save'`, `CAUGHT` and `levelEnd` from `'./ends'`, `Dossier` from `'./Dossier'` and `KEY_DIRS` from `'./flatInput'`, and drop any import left unused (`LEVELS`). The `'won'` case becomes `const { cleared: c, fresh } = recordWin(e.index); setCleared(c);` and sets `fresh` as before. The `<Results` card spreads `{...levelEnd(ui.result, index)}` in place of `won`, `kicker`, `title`, `line`, `stone`, `half` and `stoneText`. Nothing a player sees changes.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run src/components/avengers`. Expected: every file passes, each new test under 50 ms. Then `npx eslint src/components/avengers/widow` (no output) and `wc -l src/components/avengers/widow/Infiltration.jsx` (about 60 fewer than before).
- [ ] **Step 5: Commit.** `git add` the eight widow files and `board/records.test.js`. Subject: `Infiltration: one save, one ending and one file for both views, and the 2D controller`. Body: the save, the card’s words and her file each have one home; the tap-twice preview and the Bite’s button-then-tile are pure and tested; scripted players win level 1 by keys and by taps.

### Task 4: Infiltration in 2D: the facility’s grid

**Files:**
- Create: `src/components/avengers/widow/GridView.jsx`, `GridView.test.jsx`, `Flat.jsx`
- Modify: `src/components/avengers/widow/widow.css` (append), `widow/Infiltration.jsx` (the `<HQGame` element, `flatLive` and the save’s re-read)
- Modify: `src/components/avengers/hq/gameScreen.js` (`TOUCH_HELP`), `hq/gameScreen.test.js`, `hq/HQGame.test.jsx` (`FLAT`), `hq/heist.test.js` (`STARTS` and the caught reset)

**Interfaces:**
- Consumes: Task 3’s modules; Task 2’s `FLAT` table in `HQGame.test.jsx`; PR 4’s parts as in Task 2 and Infiltration’s `paused`, `pause` and `playing`; PR 6’s `recordTry`; `VISION`, `CAMERA`, `visionPolygon`, `camAngle`, `intent`, `angleOf`, `solveLevel` (`widow/rules.js`); `prefersReducedMotion` (`lib/hooks.js:6`).
- Produces:
  - `GridView({ s, input, preview })` (default): `<svg class="iwf-grid">` with `data-tile`, `data-cone` (`guard`, `camera`), `data-guard`, `data-intent`, `data-camera`, `data-laser` (`on`, `warn`, `off`), `data-terminal`, `data-file`, `data-exit`, `data-player`, `data-target`, `data-preview` (`danger`, `safe`), `data-down`, `data-stun`, `data-off`, `data-used`, `data-open`.
  - `InfiltrationFlat({ paused = false, onLive = null })` (default); dev hook `window.__HQ__['widow-flat'] = { state, start(i), act(a), setState('menu' | 'level1'…'level8' | 'won') }`.
  - `TOUCH_HELP['widow-flat']`.

- [ ] **Step 1: Write the failing tests.** `GridView.test.jsx` imports `renderToStaticMarkup`, `{ LEVELS, LEVEL_COUNT, newLevel }`, `{ IDLE }` and `GridView`:

```jsx
const draw = (s, input = IDLE, preview = null) => renderToStaticMarkup(<GridView s={s} input={input} preview={preview} />);
const ALLOWED = new Set(['svg', 'g', 'line', 'rect', 'circle', 'polygon', 'polyline', 'path']);

describe('a level from above', () => {
  it('draws every level in abstract markers only', () => {
    for (let i = 0; i < LEVEL_COUNT; i++) expect([...draw(newLevel(i)).matchAll(/<([a-z]+)/g)].every(([, t]) => ALLOWED.has(t)), `level ${i + 1}`).toBe(true);
  });
  it('draws guards as triangles with their cones shaded, and Natasha a filled chevron', () => {
    const s = newLevel(0);
    const out = draw(s);
    expect(out.match(/<polygon[^>]*data-guard/g)).toHaveLength(1);
    expect(out.match(/data-cone="guard"/g)).toHaveLength(1);
    expect(out).toMatch(/<polygon[^>]*data-player[^>]*transform="translate\(3 6\) rotate\(90\)"/);
    s.guards[0].down = true;
    expect(draw(s)).not.toContain('data-cone="guard"');
    expect(draw(s)).toMatch(/data-guard[^>]*data-down/);
  });
  it('draws cameras as wedges, lasers as lines by state, and terminals, the file and the exit as simple icons', () => {
    const cam = newLevel(5);
    for (const a of ['data-camera', 'data-cone="camera"', 'data-terminal', 'data-file', 'data-exit']) expect(draw(cam)).toContain(a);
    cam.cams[0].off = true;
    expect(draw(cam)).not.toContain('data-cone="camera"');
    const las = newLevel(3);
    expect(draw(las).match(/data-laser="on"/g)).toHaveLength(4);
    las.t = 3;
    expect(draw(las)).toContain('data-laser="warn"');
  });
  it('marks the previewed tile, red where the step gets her caught, and rings the Bite’s targets', () => {
    const s = newLevel(0);
    expect(draw(s, IDLE, { x: 3, y: 5, danger: true })).toMatch(/<rect[^>]*data-preview="danger"/);
    expect(draw(s, IDLE, { x: 3, y: 5, danger: false })).toMatch(/data-preview="safe"/);
    LEVELS[200] = { name: 't', tip: '', charges: 1, map: ['#######', '#S.G.F#', '#....E#', '#######'], guards: [{ dir: 'W', route: 'w' }] };
    expect(draw(newLevel(200), { armed: null, biting: true })).toMatch(/<circle[^>]*data-target/);
  });
});
```

In `hq/gameScreen.test.js`, widen the touch keys to `[...GAMES, 'ricochet-flat', 'widow-flat'].sort()` and add `expect(TOUCH_HELP['widow-flat'].map((r) => r.icon)).toEqual(['tap', 'tap', 'button']);` to “has touch words for Ricochet in 2D”, renamed “has touch words for the two 2D views”. In `HQGame.test.jsx`, add the row `widow: ['InfiltrationFlat', 'playing', 'widow/Flat.jsx', /if \(three\.on\) setCleared\(readCleared\(\)\)/]` to `FLAT`. In `hq/heist.test.js`, append `['widow', 'widow/Flat.jsx', 'enter', 2]` to `STARTS`, and to “counts no try for a click that starts nothing new” add `expect(read('widow/Flat.jsx')).toMatch(/recordTry\('widow'\);\s*game\.current = newLevel\(g\.index\)/);`.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/widow/GridView.test.jsx src/components/avengers/hq`. Expected: `Failed to resolve import "./GridView"`; the touch keys miss `widow-flat`; the `widow` wiring case fails on `flat={<InfiltrationFlat`; `heist.test.js` fails with `ENOENT … widow/Flat.jsx`.
- [ ] **Step 3: The touch words.** Add to `TOUCH_HELP`, verbatim: `'widow-flat': [{ icon: 'tap', text: 'Tap a tile next to her to see the step, then tap it again to take it' }, { icon: 'tap', text: 'Tap her own tile twice to wait a turn' }, { icon: 'button', text: 'Bite, then a guard’s tile, uses the Widow’s Bite' }]`.
- [ ] **Step 4: `GridView.jsx`, pure and hook-free.** Every marker puts its `data-*` first among its props.
  - Root `<svg className="iwf-grid" viewBox={viewBoxOf(s.def)} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Level ${s.index + 1}, ${s.def.name}, from above`}>`.
  - Tiles: one `<rect data-tile=… x={x − 0.5} y={y − 0.5} width="1" height="1">` a cell: `#` `wall`; `R` and `C` `block`; `=` `glass` (dashed outline); `d` `desk` (an inset 0.7 rect); everything else `floor`.
  - Under the markers, the cones: each awake guard’s `<polygon data-cone="guard" points={visionPolygon(def, g.x, g.y, angleOf(g.dir), VISION)}>` and each camera not `off` its `CAMERA` cone at `camAngle(def, s, c.id)`.
  - Lasers `<line data-laser={laserState(def, l.id, s.t)}>` along `laserLine`. Terminals `<g data-terminal data-used={used || undefined}>`: a 0.6 × 0.44 rect and a 0.3 line. The file, until `s.file`, `<path data-file d="M-0.22 -0.3 H0.1 L0.22 -0.18 V0.3 H-0.22 Z">`. The exit `<g data-exit data-open={s.file || undefined}>`: a 0.7 square outline and a centre line.
  - Guards `<polygon data-guard data-down={g.down || undefined} data-stun={g.stun || undefined} points="0.38,0 -0.3,0.3 -0.3,-0.3" transform={`translate(${g.x} ${g.y}) rotate(${angleOf(g.dir)})`}>` (east-pointing; 0 east, 90 south), with `g.stun` pips (circles, `r` 0.06). An awake guard whose `intent(s, g)` moves or turns gets a hollow dashed `<polygon data-intent>` at the intended tile and facing: the arrow level 2’s tip speaks of.
  - Cameras `<path data-camera data-off={off || undefined} d="M0 0 L0.4 -0.17 A0.44 0.44 0 0 1 0.4 0.17 Z" transform={…rotate(camAngle(def, s, c.id))}>`.
  - Natasha `<polygon data-player points="0.4,0 -0.3,0.32 -0.12,0 -0.3,-0.32" fill="var(--hq-accent)" transform={`translate(${s.px} ${s.py}) rotate(${angleOf(s.face)})`}>`. While `input.biting`, each `biteTargets(s)` guard gets `<circle data-target r="0.48" fill="none">`. With `preview`, its tile gets `<rect data-preview={preview.danger ? 'danger' : 'safe'}>`.
- [ ] **Step 5: `Flat.jsx`, `InfiltrationFlat({ paused = false, onLive = null })`.**
  - **State.** `game = useRef(newLevel(index))`; `cleared` (`readCleared`), `index` (`Math.min(readCleared(), LEVEL_COUNT − 1)`), `ui = { phase: 'menu' | 'play' | 'caught' | 'cleared', result, caught, fresh }`, `input` (`IDLE`), `hover` (a tile or `null`), a refresh counter and `timers`, cleared on unmount. `calm = useMemo(prefersReducedMotion, [])`. `playing` is `ui.phase` `play` or `caught`; `useEffect(() => onLive?.(playing), [playing, onLive])` and `onLive?.(false)` on unmount.
  - **`const enter = useCallback((i) => { … })`**: `audioContext()`, `recordTry('widow')`, clear the timers, `game.current = newLevel(i)`, set `index`, `input` to `IDLE`, `hover` to `null`, `ui` to `play`, then focus the root.
  - **`doAction(a)`**: return when `paused`, without `a` or when `game.current.phase !== 'play'`; else `ev = act(game.current, a)`, then (when `ev.length`) `handle(ev)`, `setInput(IDLE)` and refresh. No `TURN_MS` wait: nothing animates between turns.
  - **`handle(events)`.** The 3D game’s sounds on the same events (`Infiltration.jsx:90-148`); no vibration. `'caught'` plays `alarm`, sets `ui` to `caught` and, after `calm ? 900 : 1250` ms, runs `recordTry('widow'); game.current = newLevel(g.index);` (with `const g = game.current` taken at the top of `handle`), then `input` to `IDLE` and `ui` to `play`. `'won'`: `const { cleared: c, fresh } = recordWin(e.index)`, `setCleared(c)`, `ui` to `cleared` with `fresh` and `{ turns, takedowns, bites, stone: false }`. `'reward'`: `unlock('widow')`, `earnStone('soul-natasha')`, `play('stone')`, `victory` 600 ms on, and `result.stone = true`, `result.both = hasEarned('soul')`.
  - **The preview**, at render: `tile = input.armed ?? hover`, `action = tile && actionAt(game.current, input, tile)`, `preview = action && ui.phase === 'play' ? { ...tile, ...foresee(game.current, action) } : null`.
  - **Pointer**, on `<div className="iwf-stage">` around `GridView`, each tile from `tileFromPoint(svg.getBoundingClientRect(), e.clientX, e.clientY, def)`, only while `ui.phase === 'play'` and not `paused`: a mouse move sets `hover` when the tile changes; leaving clears it; up (not on a button, the left button for a mouse) runs `tapInput(game.current, input, tile, { touch: e.pointerType !== 'mouse' })`, sets `input` and calls `doAction`.
  - **Keys**, on the root: return at once when `e.target.closest('button')` or when `paused`. On the menu, Enter or Space on the root itself enters `nextUnlocked`, as the 3D game does. In play: `r` restarts; otherwise `keyInput(game.current, input, e.key)`, and when handled (repeats ignored) `preventDefault`, set `input` and `doAction`; `e` or `b` with no target plays `knock`. Esc is prevented only while biting, so the frame’s Back still works.
  - **Layout.** Root `<div className="hq-screen iwf" role="group" tabIndex={0} aria-label="Infiltration in 2D, the facility from above. Arrow keys or W A S D move Natasha one tile; Space waits; E or B, then a direction or a guard, uses the Widow’s Bite; R restarts the level. Click a tile next to her to step there; on a touch screen, tap it twice.">`, four rows: `.iwf-bar` (`aria-hidden`: `01/08 · name`, `Get the file` or `Get to the lift`, the turns and the Bite charges); `.iwf-stage` with `GridView`; `.iwf-line`; `.iwf-tools` with `iw-pad-btn` buttons ↺ (`aria-label="Restart the level"`), `Wait`, `Bite` (`aria-pressed={input.biting}`, `disabled={!game.current.charges}`, only when `def.charges > 0`) and ☰ (`aria-label="Levels and the file"`, back to the menu).
  - **`.iwf-line`**: biting, “Widow’s Bite: pick a guard in line (Esc to cancel).”; a dangerous preview, “This step gets you caught.”, with “ Tap again to go.” when armed; armed and safe, “Tap again to go.”; else `def.tip`.
  - **Cards.** Menu: `.hq-overlay.iw-overlay` with `Infiltration.jsx:502-503`’s kicker and title, the text “Plan Natasha’s way in a move at a time: every move she makes, the guards make one too. Tap a tile next to her to step there (twice on a touch screen), or use the arrow keys; Space waits.”, `<StartNote />`, `.hq-keys` (`←` `↑` `↓` `→` move · `Space` wait · `E` Widow’s Bite · `R` restart · or click a tile next to her), `<TouchHelp game="widow-flat" />`, the 3D game’s `Go in` / `Level n` / `Play again` button and `<Dossier cleared={cleared} fresh={-1} onPick={enter} />`. Caught: the `.iw-alert` markup (`role="alert"`) with `CAUGHT[by]` and “Back to the start.”. Paused: `Paused` and `Level {index + 1}, {def.name}.`. Cleared: `<Results className="iw-overlay" {...levelEnd(ui.result, index)} onAgain={() => enter(index)} …>` with `Infiltration.jsx`’s `onward` (Next level) and `more` (All levels); its children are `<Dossier cleared={cleared} fresh={ui.fresh} onPick={enter} />`.
  - **Status.** `<p className="sr-only" role="status">` holds `Infiltration.jsx:529`’s line, with “ This step gets you caught.” added when `preview?.danger`; while paused it reads `Paused.`
  - **Dev hook.** `register('widow-flat', { get state() { return game.current; }, start: enter, act: doAction, setState(name) })`: `menu` and `level1`…`level8` as `Infiltration.jsx:206-214`; `won` enters the last level, runs `solveLevel(LEVEL_COUNT − 1).actions` through `act` on `game.current` and hands the last events to `handle`, as `:230-241` does.
- [ ] **Step 6: `widow.css`, appended** under `/* Infiltration in 2D (widow/Flat.jsx): the facility from above */`. Pinned: the `.iwf` grid’s stage row is `minmax(0, 1fr)`; the colours are `--iwf-*` custom properties taken from the holotable (the guards’ rim `scene.js:335`, the arrows `:401`, the table glow `:309`) and `widow.css:2`’s red, with the floor, walls, blocks, file and exit this view’s own; lasers are in `var(--iw-red)`, `on` solid, `warn` blinking over `var(--t-base)` and a steady dashed line under `prefers-reduced-motion: reduce`, `off` faint and dotted; the `danger` preview is filled red and the `safe` one a dashed outline in `var(--hq-accent)`; `.iwf-bar` and `.iwf-line` are no smaller than 0.72 rem; `.iwf-tools .iw-pad-btn` is at least 44 × 44 px (Task 6’s `touch`).
- [ ] **Step 7: `Infiltration.jsx` hands the frame its 2D view.** Import `InfiltrationFlat from './Flat'`. Add `const [flatLive, setFlatLive] = useState(false)`. On the `<HQGame` element: `playing={playing || flatLive}` (keeping `paused={paused} onPause={pause}`) and `flat={<InfiltrationFlat paused={paused} onLive={setFlatLive} />}`. Add `useEffect(() => { if (three.on) setCleared(readCleared()); }, [three.on]);` with the same comment as Ricochet’s.
- [ ] **Step 8: Run them to see them pass.** Run `npx vitest run src/components/avengers`. Expected: every file passes, `GridView.test.jsx` 4 under 100 ms each. Then `npx eslint src/components/avengers/widow src/components/avengers/hq` (no output) and `wc -l src/components/avengers/widow/*.jsx` (each under 800).
- [ ] **Step 9: Commit.** `git add` the three new widow files, `widow.css`, `Infiltration.jsx`, `hq/gameScreen.js`, `hq/gameScreen.test.js`, `hq/HQGame.test.jsx` and `hq/heist.test.js`. Subject: `Infiltration in 2D: the facility’s grid, over the real rules`. Body: §8’s markers, a turn a tap with the danger preview on hover and on a first tap, the Bite as a button then a tile, the same save, stone and card; both views count tries for `widow`.

### Task 5: The ops board sends Ricochet and Infiltration to their 2D views without 3D

**Files:**
- Modify: `src/components/avengers/board/records.js` (`FLAT_READY`)
- Test: `src/components/avengers/board/records.test.js`, `src/components/avengers/board/OpsBoard.test.jsx`
- Modify: `docs/architecture.md:27`

**Interfaces:**
- Consumes: PR 5’s `boardCards`, `stoneState`, `stoneText` and `BoardCard`; Tasks 2 and 4’s views.
- Produces: `FLAT_READY = ['cap', 'widow']`: without 3D, those two cards read “Win … here in 2D” and “Play in 2D” and offer no Try 3D.

- [ ] **Step 1: Move PR 5’s assertions to the new truth.**
  - `records.test.js`, “says what each stone is…”: the `needs3d` list becomes `['thor', 'banner', 'vault']`.
  - `records.test.js`, “plays in 2D where a game has a 2D view…”: `expect(FLAT_READY).toEqual(['cap', 'widow']);`, and add:

```js
const none = boardCards(progress([]), { get: from({}), can3D: false });
expect(at(none, 'cap')).toMatchObject({ state: 'flat', play: 'Play in 2D', stoneText: 'Win the Mind Stone here in 2D' });
expect(at(none, 'widow')).toMatchObject({ state: 'flat', play: 'Play in 2D', stoneText: 'Win Natasha’s half of the Soul Stone here in 2D' });
expect(at(boardCards(progress([]), { get: from({}), can3D: true }), 'cap')).toMatchObject({ state: 'open', play: 'Play' });
```

  - `OpsBoard.test.jsx`, “offers Try 3D only on a card whose stone is won in the 3D game…”: both counts of 6 become 4 (thor, hawkeye, banner and vault), and add `expect(count(off, '>Play in 2D<')).toBe(2);`.
  - `OpsBoard.test.jsx`, “opens a building with the page’s own state…”: its card is `cap`, which no longer has a Try 3D. Use `thor` instead, with `'/avengers/lawn'` and `[[['thor']], [['thor']]]`, every assertion kept.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/board`. Expected: `FLAT_READY` `expected [] to deeply equal [ 'cap', 'widow' ]`, the `needs3d` list, the two counts (`expected 6 to be 4`) and `cap`’s `state: 'needs3d'` against `'flat'` fail; “opens a building…” passes with `thor`.
- [ ] **Step 3: Flip it.** In `records.js`: `export const FLAT_READY = ['cap', 'widow'];`, its comment naming `ricochet/Flat.jsx` and `widow/Flat.jsx`. In `docs/architecture.md:27`, after PR 6’s clause: “; Ricochet and Infiltration also play in 2D, as SVG over the same rules (`../ricochet/Flat.jsx`, `../widow/Flat.jsx`; their controllers, `flatInput.js`, tested), for visitors without 3D or who pick Play in 2D”.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run src/components/avengers`. Expected: every file passes, none skipped. Then `npx eslint src/components/avengers/board` (no output).
- [ ] **Step 5: Commit.** `git add src/components/avengers/board/records.js src/components/avengers/board/records.test.js src/components/avengers/board/OpsBoard.test.jsx docs/architecture.md`. Subject: `Avengers HQ: the ops board sends Ricochet and Infiltration to their 2D views without 3D`. Body: the two stones are now won in 2D, so their cards stop saying “won in the 3D game” and stop offering Try 3D; PR 5’s counts move from 6 to 4.

### Task 6: Verify the PR and open it

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr7/README.md`, plus the pictures it lists under `before/` and `after/` (`.webp` or `.png`, each under 1 MB)

**Interfaces:**
- Consumes: Tasks 1–5; Task 0’s `$S` files (`closure.mjs`, `hq-pr7-check.mjs`, the `-before` numbers, pictures and checks).
- Produces: the pull request.

- [ ] **Step 1: The gates.** Run `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`, then `git checkout public/github.json`. Expected: lint clean; every test file passes, none skipped; `✓ built`; the health table ends `within budget`, with `loops`, `renderers`, `cycles`, `big-files`, `kbd-styles`, `lint-disables` and `todo-notes` as in `$S/health-before.txt`. Don’t ratchet a budget: the steward does it after the merge.
- [ ] **Step 2: The closure.** Run `npx vite build && node $S/closure.mjs | tee $S/closure-after.txt`, note the two game chunks’ sizes in `$S/chunks-after.txt`, then `git checkout public/github.json`. Expected: the `/avengers` closure within 1 kB of `$S/closure-before.txt` (only `FLAT_READY`’s two ids join it); the 2D views ride in the Ricochet and Infiltration chunks, which `Place.jsx` already loads lazily. Zero files means the page key isn’t `src/pages/Avengers.jsx`: grep the manifest for it.
- [ ] **Step 3: The links.** With `npx vite --port 5173 --strictPort` up, run `OUT=$S/links node scripts/hq-links-check.mjs`, then `OUT=$S/links-3d node scripts/hq-links-check.mjs --3d`. Expected: `all ok` both times. Its `door`, `double-esc` and `reload` parts now open the training center’s 2D view, so this also proves Esc and Back leave it.
- [ ] **Step 4: The 2D games in a browser.** Run `node $S/hq-pr7-check.mjs fit mind soul touch switch pause keys board after | tee $S/check-after.txt`. Expected: `ok` for every part and `all ok`. `$S/fit-after.txt` shows Start within the viewport for both games at 1024 × 640 and 390 × 844. Read the screenshots: only lines, bands, toggles, squares, circles, chevrons, triangles, wedges and rectangles; the disc and Natasha’s chevron in each game’s accent.
- [ ] **Step 5: The pages, after.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers/training,/avengers/operations,/avengers,/invincible --shots avhq-pr7`, then the same with `--shots avhq-pr7-phone --phone`. Expected: both end `everything green`. Read `avhq-pr7-a.webp` and `-b.webp` beside the before: the training center and Operations show their 2D view where they showed the toy (or, if this browser draws 3D, the game with “Play in 2D” in the bar); read the phone pair for fit. Move the pictures into the evidence folder; `git status --short public/changes` is empty.
- [ ] **Step 6: The worlds that share `hq/`.** Shoot `main` twice: `node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --ref origin/main --out $S/hq-main-a --only compound,invworld,thinkmark,viewer`, then the same with `--out $S/hq-main-b`. Shoot the branch with `--out $S/hq-pr7` and no `--ref`, then run `--compare $S/hq-main-a $S/hq-pr7` and `--compare $S/hq-main-b $S/hq-pr7`. Expected: `invworld`, `thinkmark` and `viewer` read `0 pixels differ` against `hq-main-a`, as they are; `compound` reads `0 pixels differ` against at least one main run (the index’s two-run rule: main differs from itself there, FL2 README:31 and :47), so a compare whose only difference is `compound` may exit 1. If `compound` is off both runs by no more than `--compare $S/hq-main-a $S/hq-main-b` shows in the same place, shoot main a third time (`$S/hq-main-c`) before calling it a failure, as PR 1 does. The `ricochet` and `widow` targets are left out: their bar now reads “Play in 2D” by design. Then `OUT=$S/inv-after node scripts/inv-world-check.mjs` and `OUT=$S/hq-after node scripts/hq-world-check.mjs`. Expected: `no page errors` from both; the Invincible shots match `$S/inv-before` by eye. Stop the server.
- [ ] **Step 7: The evidence README** at `docs/superpowers/evidence/avengers-hq/pr7/README.md`: one line a picture (before or after, what it shows); the fit table before and after; the closure’s total line and the two game chunks, before and after; the test counts in `src/components/avengers`, before and after; the tile size on the phone at level 8; the `hq-shots` compare tables against both main runs; each `$S/hq-pr7-check.mjs` part and `hq-links-check`’s results both ways. Commit with the subject `Avengers HQ PR 7: the evidence`.
- [ ] **Step 8: Open the pull request.**
  - Run `git push -u origin claude/avengers-hq-pr7-flat-games`, then open the PR with base `main` and the title `Avengers HQ 7 of 7: Ricochet and Infiltration in 2D`.
  - The body: a paragraph each on Ricochet in 2D (markers, aim, the preview’s length, release or Space), Infiltration in 2D (markers, a turn a tap, the danger preview and the tap twice, the Bite) and what they share with the 3D games (the step, the save, the stone, the card, the tries); the numbers from the README, before → after (the closure, the two chunks, the tests, the fit table); the screenshots as images from `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/claude/avengers-hq-pr7-flat-games/docs/superpowers/evidence/avengers-hq/pr7/<file>` (each room and grid on desktop and phone, both stones won in 2D, the board without 3D); the checks that ran (Steps 1–6) with their results.
  - **For the owner:** on touch every Infiltration step takes two taps (§8 read literally; `tapInput` is the one place to change it); a 2D view’s paused card has no Resume of its own, the bar’s is the way on; the 2D keys live on the start cards until #1028 lets keys move to `guide/pages.js`.
  - The plan’s path and the harness’s PR footer.
  - It is one PR, merged with a merge commit once CI is green. Never force-push; a requested change is a new commit.

---

## Self-review against the spec

- **§8 Ricochet 2D.** The room from above in `ricochet/Flat.jsx`: steel solid, mats hatched, glass dashed, switches and doors small toggles, bots squares (armoured double-outlined), the hostage an open circle, the thrower a chevron, the disc a plain disc in the accent (Task 2’s RoomView tests). Aim by drag or arrows; the preview from `simulateThrow` at the 3D game’s length; Space or release throws (Task 1’s controller tests). Stars and par as in 3D, saved to `tp-hq-ricochet` through the one `save.js` (Task 1).
- **§8 Infiltration 2D.** The level’s grid in `widow/Flat.jsx`: guards triangles with shaded cones, the player a filled chevron, lasers blinking on their cycle, cameras wedges, terminals, the file and the exit simple icons (Task 4). Tap a neighbour or use the arrows; the Bite as a button then a tile; the danger preview on hover and a first tap, a second tap commits (Task 3). Saved to `tp-hq-widow-level` through `save.js` (Task 3).
- **§8 Both.** The same fixed step, `earnStone` as in 3D, keyboard play, `role="status"`, reduced motion and §5’s card (Tasks 1–4); a scripted player wins Ricochet rooms 1 and 12 and Infiltration level 1 through the controllers on the real rules (§12; Tasks 1 and 3).
- **§5.** “Play in 2D” and “Play in 3D” switch this game only (PR 4’s `switchFor`, Task 2’s HQGame tests, Task 6’s `switch`); the 2D views’ touch words in place of the hidden keys (Tasks 2 and 4); the bar’s Pause and the hidden tab reach them (`flatLive`, Task 6’s `pause`).
- **§6.** Without 3D the two cards no longer say “won in 3D” (Task 5).
- **§3.** No figure drawn (the tag-set tests, Tasks 2 and 4); keys keep their names and shapes with one writer each; `hq/` changes leave the Invincible shots identical and the compound at 0 px against one of two main runs (Task 6); no new loop or renderer.
- **§12.** The 2D scripted players in Vitest; in the browser, “with 3D off, the Mind Stone is won in 2D” (`mind`), Start in view at both sizes (`fit`), the per-game switch leaving the compound in 3D (`switch`), no console errors; `autopilot-check` with `--before`, `--routes /avengers,/invincible` and the two game routes, `--shots` and `--phone`; `hq-links-check` both ways; `inv-world-check` and `hq-world-check`; the closure from the manifest; the four gates (Task 6).
- **Cross-check fixes applied.**
  - PR 6 ↔ PR 7: `RicochetFlat` calls `recordTry('cap')` in its `enter`; `InfiltrationFlat` calls `recordTry('widow')` in its `enter` and in its caught reset; both `Flat.jsx` files join `STARTS` (Tasks 2 and 4).
  - PR 5 ↔ PR 7 (the board): no `PLACES.flat`, no `board.js`; `FLAT_READY = ['cap', 'widow']` in `board/records.js`, with PR 5’s assertions moved: `FLAT_READY`, the `needs3d` list `['thor', 'banner', 'vault']`, the Try 3D and “won in the 3D game” counts 6 → 4, a card test for “Win … here in 2D” and “Play in 2D” and the `air` part’s Try 3D count (now `board`’s 5) (Tasks 5 and 6). Also moved: “opens a building with the page’s own state…”, whose `cap` card lost its Try 3D, now uses `thor`.
  - PR 5 ↔ PR 7 (the keys): the `FILE` map’s `cap` and `widow` rows point at `ricochet/save.js` and `widow/save.js` (Tasks 1 and 3).
  - PR 4 ↔ PR 7 (the frame): no `HQGame` code changes; the flat tests use PR 4’s `html`, `three` and `game` helpers inside `GameScreen.Provider`; the one code change is `switchFor`’s fallback lines saying “the 2D version” when `flat` is set, with new `gameScreen.test.js` cases and PR 4’s left as they are (Task 2).
  - PR 4 ↔ PR 7 (pause and touch): the views take `paused` and `onLive`; `Ricochet.jsx` and `Infiltration.jsx` keep `flatLive` and pass `playing={live || flatLive}` (Infiltration’s flag is `playing`) with their `paused` and `onPause` and `flat={<…Flat paused={paused} onLive={setFlatLive} />}`; each view’s menu renders `<StartNote />` and its own touch rows, `ricochet-flat` and `widow-flat` in `TOUCH_HELP`, with PR 4’s keys test widened to them (Tasks 2 and 4).
  - PR 3 ↔ PR 7: `hq-links-check.mjs` runs both ways and ends `all ok` (Task 6).
  - The ordering note: this PR is last, sets `FLAT_READY`, calls `recordTry` by place id and lifts `flatLive` into the 3D components.
