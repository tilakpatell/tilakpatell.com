# Avengers HQ PR 5: the ops board and records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put an ops board directly under the compound, in both modes and as the first screen without 3D. It has a records strip and one card a building (its game, its stone, its best, Play, Go there and Try 3D), and the page under it is put in order: the worlds, Titan, one closed Archive, then the credits. This is PR 5 of the seven in spec §11.

**Architecture:**
- `board/records.js` is pure and holds every rule: how each game’s best is read from the key it already writes (through `runtime/saves`’ plain `get`, never registered), the records strip’s numbers and one card a building in the tour’s order. `board/OpsBoard.jsx` draws them with the shell’s parts (`.btn`, `.chip`, the tokens).
- `CompoundWorld` renders the board as the sibling right after `section#hq-world`, so the board, the HUD and the scene read the one `prog`. `progress()` gains `count`, which the HUD and the board both show. The no-3D cards view becomes `Air` (the title, a notice and the map from the air), whose pins scroll to the board’s cards.
- A card’s Try 3D is per game: PR 4’s `writeLocal3D`, then the building’s link. Nothing in this PR touches the site’s 3D setting. Go there reaches `World`’s `travel` through a ref, as `api` already does.

**Tech Stack:** React 19, react-router-dom 7 (`Link`, `MemoryRouter` in tests), Vitest 5 (node environment: `react-dom/server` and element-tree walks, no DOM), Vite 8 (its manifest at `dist/.vite/manifest.json`), playwright-core 1.56 under the check scripts.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md`, as amended in `30dd1241`: §6 (the ops board and records), §3 (the rules every change keeps), §5’s “the site-wide switch stays in Settings only”, §11 step 5 and §12 (the checks). The plan index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`. Where the brief and the spec disagree, the spec wins.

## Global Constraints

- **Order.** PR 5 of 7, merged in order. Branch from `origin/main` with PRs 1–4 merged. This PR consumes only:
  - PR 1: the `world/rules.js` barrel with its 91 names (`PLACES`, `PACKS`, `progress` among them; `progress` lives in `world/rules/progress.js`). `world/CompoundWorld.test.js` with its `loadsWith` closure walk and the rule that no kit barrel comes in. The manifest closure script (PR 1 plan, Task 1 Step 2).
  - PR 2: `progress(earned = [], unlocked = [])`, where the gate is done once `unlocked` includes `'spidey'`. In `CompoundWorld`, `const { unlocked } = useAchievements();` and `progress(heist, unlocked)`. In `world/labels.js`, `HALF_OF = { 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' }`, `stoneFor(p)` and `stoneLine(p)`, whose strings are pinned in `labels.test.js`: “Power Stone: won back”, “Clint’s half of the Soul Stone: won back”, “No stone here: just Peter, and school” and “No stone here: Peter made it to school”. Also `labels.test.js` and its `read` helper.
  - PR 3: in `world/links.js`, `linkOf(id) → '/avengers/<slug>' | null`, `gameOf(id) → string | null` (the gate’s game is “Thwip!”) and `hqState = { hq: true }`. `CompoundWorld`’s `enter(id)`, which pushes `linkOf(id)` with `{ state: hqState }`. `ScrollToTop`, which keeps the scroll on a move between HQ addresses. `scripts/hq-links-check.mjs [--3d]` with its `CARD` and `PLAY` lines.
  - PR 4: in `hq/gameScreen.js` (pure; it imports nothing), `GAME_AT` (place id → game id), `writeLocal3D(game, mode)`, `fmt(n) → '12,340'` and `switchFor(...)`, whose no-3D line is “The stone here is won in the 3D game.”. The game screen’s `useGame3D`, so a game whose own choice is `'on'` draws in 3D while the site’s switch is off.
- **Line numbers** are `main` at `ddb364bf`. PRs 1–4 move lines in `CompoundWorld.jsx` (the route, the veil and the welcome), `CompoundHud.jsx`, `labels.js` and `guide/pages.js`, so find each place by the quoted text. `Avengers.jsx` carries only PR 2’s copy at `:148` and `:219`.
- **Spec §6, exactly.**
  - The board sits directly under the compound and is the first screen without 3D. It replaces the second intro (`Avengers.jsx:158-173`) and the no-3D cards (`CompoundWorld.jsx:654-707`). Without 3D, the map from the air stays on top, and its pins scroll to their cards.
  - One card a building, eight in all, each with: the place and the game’s name; its stone (won, half won, or “won in the 3D game” with Try 3D); the best from the key the game already writes; stars where the game keeps them (only Ricochet does; no game keeps medals yet, §13); Play (its link); Go there (3D only).
  - The records strip: stones out of six, the swing tour’s best, best style, backpacks out of twelve and the Avengers achievements earned.
  - Try 3D on a card sets that game’s own 3D choice and opens it; it never changes the site’s setting.
  - The HUD’s Things to do and the board read the same `progress()`.
  - Under the board: the world switcher, Titan, one `<details>` Archive (closed by default: the soundboard, the GIPHY scenes, the photos), then the credits last.
- **Content (§3).** Nothing here draws a figure, suit or mark of any Marvel character. The board is text, plain dots in the stones’ existing colours and a CSS chevron; the map is the existing `Compound.jsx` with its pins.
- **Copy (RULES.md UI 7).** British spelling, curly quotes (’ “ ”) inside strings, sentence case, no Oxford comma. A half reads as whose half, in `stoneLine`’s words. “Esc”, never “Escape”, in prose.
- **Keys (§3, §6).** No `tp-*` key changes name or shape, and this PR adds none. The board reads through `localSaves().get` (`src/runtime/local.js:20`), unregistered: `register` would rewrite a value as `{ v, data }` (`src/runtime/saves.js:62-69`). The board never writes a `tp-hq-*` key. `tp-hq-3d-<game>` is written only through PR 4’s `writeLocal3D`.
- **The site’s 3D switch (§5, §6).** No code in this PR calls `three.set`, `setMode3D` or `use3D().set`. The no-3D notice’s only actions are a retry when the site’s mode is `'auto'`, loading a world the gate is holding, or opening Settings (`openSettings`, `src/lib/palette.js:25`).
- **Shared code.** Nothing under `src/components/avengers/hq/` or `src/runtime/` changes; `records.js` and `CompoundWorld` only import from `hq/gameScreen.js`. So `scripts/inv-world-check.mjs` is not run, and Task 6 proves the diff there is empty.
- **Islands (RULES.md).** `board/` is part of the Avengers world. It imports only `avengers` modules, `src/lib`, `src/runtime` and `interests/stones` (which `labels.js` already reads). It imports no game’s `rules.js`: the counts (12 rooms, 8 levels, 6 legs) are constants pinned by a test, so those 1,677 lines stay out of the page’s static closure.
- **Open draft #1028** edits `guide/pages.js` (`:15-36`, `:103-140`), `pages.test.js` and `runtime/hud/*`. This PR changes one tip string in `guide/pages.js` (“Without 3D”, `:452`), which it would otherwise make untrue. It does not touch `pages.test.js` or `runtime/hud/*`.
- **Limits.** Files under 800 lines. `CompoundWorld.jsx` is about 750 after PR 4, and this PR is about +5 net (`Cards`, 54 lines, becomes `Air`, about 40). No new dependency, renderer or animation loop. No new `kbd` rule. Sections use `relative z-10`, as the page’s others do.
- **Tests.** Beside their file, each under one second, no network. No test is skipped, loosened or deleted.
- **Commits.** A plain sentence as the subject; the body says why. End with the session’s attribution lines. No model names anywhere. Never force-push; if `main` moves, merge it in.
- **What later PRs rely on.**
  - PR 6 imports `readBest(id, get) → { score, text, stars } | null` from `board/records.js` for the summary’s best per game. `text` reads like “Best 12,345”, “3 of 12 rooms” or “Best 460 · 2 of 6 legs”. `Avengers.jsx` no longer imports `Link`, so PR 6 adds it back with `hqState` for its Next link. Titan’s section is untouched.
  - PR 7 sets `FLAT_READY = ['cap', 'widow']` in `board/records.js` and moves these assertions to the new truth:
    - `FLAT_READY` `toEqual([])`;
    - the `needs3d` list `['thor', 'cap', 'widow', 'banner', 'vault']`;
    - `OpsBoard.test.jsx`’s Try 3D and “won in the 3D game” counts of 6;
    - the browser part `air`’s 7 Try 3D buttons;
    - the `FILE` map’s `cap` and `widow` rows in `records.test.js` (to `ricochet/save.js` and `widow/save.js`).
  - PRs 6 and 7 rerun `hq-links-check.mjs`, with `CARD` now `#hq-card-<id>` and `PLAY` now `a.btn-primary`.

## Review Focus

1. **A returning visitor’s saves, in every shape they come in.** A missing key, a string where a number was, Ricochet stars outside 0–3, a Tesseract array of the wrong length or Infiltration levels over 8 should read as the game itself reads them: as no score, or clamped. Nothing should throw or print `NaN`. Pinned in Task 2 (“is nothing for a key that is missing or holds nonsense”, “clamps Ricochet’s stars and Tesseract Run’s legs as the games do”, “starts clean with nothing kept, and with nonsense kept”).
2. **Opening the page rewrites nothing.** After a visit, every key reads byte for byte as before, with no `{ v, data }` wrapper, so the games’ own raw reads still work. Pinned in Task 2 (“reads through the runtime’s saves without rewriting a key…”) and Task 6’s `records` part.
3. **3D off in Settings, then Try 3D on a card.** That game opens at its own address and draws in 3D. `tp-3d` is unchanged, and the compound stays on its map. Without WebGL there is no Try 3D anywhere. Pinned in Task 3 (“offers Try 3D only on a card whose stone is won in the 3D game…”), Task 4 (“tries 3D one game at a time…”, `airNote`) and Task 6’s `try3d` part.
4. **Back from a game opened on the board.** The visitor expects to land on the board where they were, with one history entry popped and none added. Pinned in Task 3 (the card’s `Link` carries `hqState`) and Task 4 (`hq-links-check.mjs`’s `door`, `double-esc`, `reload` and `stones` parts on `#hq-card-<id>`).
5. **A phone, and a slow line.** At 390 px there is no sideways scroll, every card button and the Archive’s summary is at least 44 px tall, and the closed Archive fetches nothing from GIPHY until it is opened. Pinned in Task 6’s `phone` and `order` parts.

---

## Files

| file | task | change |
| --- | --- | --- |
| `src/components/avengers/world/rules/progress.js` | 1 | `count` appended to the return |
| `src/components/avengers/world/rules.test.js` | 1 | the count test |
| `src/components/avengers/world/CompoundHud.jsx:29` | 1 | the Menu’s count is `prog.count` |
| `src/components/avengers/world/CompoundWorld.test.js` | 1, 4 | the HUD’s count; the board’s place, the site’s switch, the closure |
| `src/components/avengers/board/records.js`, `records.test.js` | 2 | create: the readers |
| `src/components/avengers/board/OpsBoard.jsx`, `OpsBoard.test.jsx` | 3 | create: the board |
| `src/styles/lazy/avengers.css` | 3, 5 | append: the board’s rules, the Archive’s summary |
| `src/components/avengers/world/CompoundWorld.jsx` | 4 | the board under the compound, `Air`, Go there, Try 3D |
| `src/components/avengers/world/labels.js`, `labels.test.js` | 4 | `airNote` |
| `src/components/avengers/world/world.css:218-224` | 4 | the cards’ rules go; `.cw-air` |
| `scripts/hq-links-check.mjs` | 4 | `CARD` and `PLAY` |
| `src/components/guide/pages.js:452` | 4 | the “Without 3D” tip |
| `docs/architecture.md:27` | 4 | one clause |
| `src/pages/Avengers.jsx`, `src/pages/Avengers.test.js` (create) | 5 | the page’s order and the Archive |
| `docs/superpowers/evidence/avengers-hq/pr5/` | 6 | README and pictures |

### Before Task 1: the before numbers

`S` below is the session’s scratchpad directory (never under the repo).

- [ ] **Branch and check PRs 1–4 are in.** Run `git fetch origin main && git switch -c claude/avengers-hq-pr5-ops-board origin/main`. Then:
  - `grep -n "export function progress(earned = \[\], unlocked = \[\])" src/components/avengers/world/rules/progress.js` prints one line.
  - `grep -n "export const HALF_OF" src/components/avengers/world/labels.js` prints one line.
  - `grep -cE "export const (gameOf|hqState)" src/components/avengers/world/links.js` prints `2`.
  - `grep -cE "export (const|function) (GAME_AT|writeLocal3D|fmt)\b" src/components/avengers/hq/gameScreen.js` prints `3`.
  - `grep -nE "^const (CARD|PLAY) = " scripts/hq-links-check.mjs` prints PR 3’s two lines.
  - `ls src/components/avengers/board` fails.
- [ ] **Draft #1028.** Run `gh pr view 1028 --json state,mergedAt`. If it is open, note it for the PR body. If it is merged, find the “Without 3D” tip by its text.
- [ ] **Measure main.**
  - Save PR 1’s manifest script unchanged as `$S/closure.mjs`. Run `npx vite build && node $S/closure.mjs | tee $S/closure-before.txt; git checkout public/github.json`. Expected: one total line, close to PR 4’s stated size.
  - `node scripts/health.mjs --check --skip build | tee $S/health-before.txt`. Expected: `within budget`.
  - `npx vitest run 2>&1 | tail -4 | tee $S/tests-before.txt`. Expected: all passing.
- [ ] **Shoot main.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr5 --before`, then the same with `--shots avhq-pr5-phone --phone`. Move both `public/changes/avhq-pr5*-before.webp` to `$S/`, then `git checkout public/github.json`. Expected: each ends `ok   everything green`.
- [ ] **Write the scratch browser script** `$S/hq-pr5-check.mjs` (not committed). It takes part names and then `before` or `after`. It prints `ok <part>` or `FAIL <part>: <why>` for each part, ends `all ok` or `N problems`, and exits 1 on any FAIL.
  - **Launch.** Copy `scripts/hq-links-check.mjs`’s chromium launch. Base `http://localhost:5173/?quality=low#`. Every page starts from a new context whose init script copies `scripts/hq-world-check.mjs:28-34` (`tp-intro`, `tp-worlds`, `tp-software`). Set `tp-3d` to raw `'off'` (as `lib/gpu.js:84` stores it), unless the part says 3D, which removes it. Add the part’s own keys. Every `pageerror`, and every console error that `scripts/lib/noise.mjs`’s `noisy()` doesn’t know, is a FAIL of the part. Record every request URL.
  - **The records fixture** sets:
    - `tp-hq-swing-tour` = `'41.3'`, `tp-hq-style-best` = `'2450'`, `tp-hq-packs` = `'["hangar","prow"]'`;
    - `tp-hq-ricochet` = `'{"reached":4,"stars":[3,2,1]}'`;
    - `tp-hq-stones` = `'["power","soul-clint"]'` and `tp-achievements` = `'["spidey","worthy"]'`.
  - **`height`** (390 × 844, `isMobile`, `hasTouch`, no 3D): open `#/avengers`, wait 3 s, and write `document.documentElement.scrollHeight` to `$S/height-<when>.txt`. With `after`, pass when it is lower than `$S/height-before.txt`.
  - **`air`** (1440 × 900, no 3D, a clean profile):
    - Pass: `#hq-world[data-mode="cards"]`; `.hq-hero-map` is visible and its top is above `#hq-board`’s; `[...document.querySelectorAll('#hq-board .hq-card')].map((li) => li.id)` is `hq-card-stark` … `hq-card-vault` in `LINKS` order (import `LINKS` from `src/components/avengers/world/links.js`).
    - Pass: no button’s text starts with `Go there`; exactly 7 buttons read `Try 3D`; the notice reads “3D is switched off in Settings, so here’s the compound from the air.” beside a `Settings` button, and no button reads `Turn 3D on`.
    - Click the third `.hq-pin[data-pick]`. Pass: within 1.5 s, `document.activeElement.id === 'hq-card-cap'` and its rect lies inside the viewport.
    - Screenshot to `OUT/pr5-air.png`.
  - **`try3d`** (1024 × 640, no 3D): click the `Try 3D` button in `#hq-card-cap`.
    - Pass: the hash is `#/avengers/training`, `localStorage['tp-hq-3d-ricochet'] === '"on"'`, `.cw-place .hq-canvas[data-on]` appears within 240 s and `localStorage['tp-3d'] === 'off'`.
    - Press `Escape`. Pass: the hash is `#/avengers`, the compound is still `#hq-world[data-mode="cards"]` and `tp-3d` is still `'off'`.
  - **`order`** (1440 × 900, no 3D):
    - Pass: by `compareDocumentPosition`, `#hq-world` < `#hq-board` < `nav.world-switcher` < `#thanos` < `details.hq-archive` < `#av-credits`, and `#av-credits` is the last `section` in `.hq-page`.
    - Pass: `details.hq-archive` has `open === false`, and no recorded request URL contains `giphy`.
    - Click its `summary`. Pass: `open === true`, and the first `.clip-board-btn` is visible.
  - **`records`** (1440 × 900, no 3D, the records fixture):
    - Pass: `.hq-records`’ text contains `1 of 6`, `3/8`, `0:41.3`, `2,450`, `2 of 12` and `2 of 14`.
    - Pass: `#hq-card-cap` contains `3 of 12 rooms · 6 of 36 stars`, and `#hq-card-hawkeye` contains `Clint’s half of the Soul Stone: won back`.
    - Pass: `localStorage.getItem('tp-hq-swing-tour') === '41.3'` and `localStorage.getItem('tp-hq-ricochet') === '{"reached":4,"stars":[3,2,1]}'`: nothing was rewritten.
    - Screenshot `#hq-board` to `OUT/pr5-records.png`.
  - **`hud`** (960 × 540, 3D, the records fixture): wait for `.cw-canvas[data-on]` (240 s, as `hq-world-check.mjs`), then click the `.cw-menu` button. Pass: the menu’s text contains `Things to do · 3/8`, and `.hq-records` contains `3/8`.
  - **`go`** (960 × 540, 3D): wait for `.cw-canvas[data-on]`. Scroll `#hq-card-cap` into view and click its `Go there`. Pass, within 5 s:
    - `Math.abs(document.getElementById('hq-world').getBoundingClientRect().top) <= 2`;
    - `document.activeElement.id === 'hq-world'`;
    - `window.__HQWORLD__.sim.near === 'cap'`.
  - **`phone`** (390 × 844, `isMobile`, `hasTouch`, no 3D):
    - Pass: `document.documentElement.scrollWidth <= 390`.
    - Pass: every `.hq-card-acts .btn` and `details.hq-archive > summary` is at least 44 px tall.
    - Pass: every `.hq-card` has the same `left`, so the cards are one column.
    - Screenshot the board to `OUT/pr5-phone.png`.
- [ ] **Run the before parts.** Start `npx vite --port 5173 --strictPort` in the background, then:
  - `OUT=$S/links-before node scripts/hq-links-check.mjs`. Expected: `all ok`.
  - `OUT=$S/hq-before node scripts/hq-world-check.mjs`. Expected: `compound up in … s`, nine `hq-*.png` and `no page errors`.
  - `OUT=$S/before node $S/hq-pr5-check.mjs height before`. Expected: `ok height`, and the page’s height in `$S/height-before.txt` (the spec measured 9,587 px on a phone with 3D; this is without), the README’s before.
  - Stop the server.

---

### Task 1: Things to do counts once, in `progress()`

**Files:**
- Modify: `src/components/avengers/world/rules/progress.js` (the returned object)
- Modify: `src/components/avengers/world/CompoundHud.jsx:29`
- Test: `src/components/avengers/world/rules.test.js` (one `it` at the end of `describe('The compound, the world: the heist')`), `src/components/avengers/world/CompoundWorld.test.js` (one new `describe`)

**Interfaces:**
- Consumes: PR 2’s `progress(earned = [], unlocked = [])`, where the gate is done when `unlocked` includes `'spidey'`.
- Produces: `progress(...)` returns every field it had, plus `count: number`, the places done (0–8). The barrel’s names are unchanged, so PR 1’s list of 91 stays as it is.

- [ ] **Step 1: Write the failing tests.** In `rules.test.js`:

```js
it('counts the places done, the gate by Thwip!’s win alone, for the HUD and the board', () => {
  const all = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space'];
  expect(progress(all).count).toBe(7);
  expect(progress(all, ['spidey']).count).toBe(8);
  expect(progress([], ['spidey']).count).toBe(1);
  expect(progress(['soul-clint']).count).toBe(1);
  expect(progress([], ['ironman', 'worthy', 'hulk']).count).toBe(0);
  for (const [earned, unlocked] of [[[], []], [['power'], ['spidey']], [all, ['worthy']]]) {
    const p = progress(earned, unlocked);
    expect(p.count, String(earned)).toBe(p.places.filter((q) => q.done).length);
  }
});
```

In `CompoundWorld.test.js`:

```js
describe('the compound’s HUD', () => {
  it('counts Things to do from progress()’s count, as the ops board does', () => {
    const hud = readFileSync(new URL('./CompoundHud.jsx', import.meta.url), 'utf8');
    expect(hud).toMatch(/const won = prog\.count;/);
    expect(hud).toMatch(/Things to do · \{won\}\/\{prog\.places\.length\}/);
  });
});
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run src/components/avengers/world/rules.test.js src/components/avengers/world/CompoundWorld.test.js`. Expected: 2 failed: `expected undefined to be 7`, and the `const won = prog\.count;` regex not matched.
- [ ] **Step 3: Add the count.**
  - In `progress.js`, append `count: places.filter((p) => p.done).length` to the returned object, after `done`. One line in the comment above: the count is what Things to do shows, in the HUD and on the board.
  - In `CompoundHud.jsx:29`, `const won = prog.places.filter((p) => p.done).length;` becomes `const won = prog.count;`. Line `:75` is unchanged.
- [ ] **Step 4: Run them to see them pass.** Same command. Expected: both files pass; `rules.test.js` has one more test than on `main`. Then `npx eslint src/components/avengers/world`. Expected: no output.
- [ ] **Step 5: Commit.** `git add` the four files. Subject: `Avengers HQ: Things to do counts once, in progress(), for the HUD and the board`.

### Task 2: `board/records.js`, the bests, the records and the cards, read as the games read them

**Files:**
- Create: `src/components/avengers/board/records.js`
- Test: `src/components/avengers/board/records.test.js` (create)

**Interfaces:**
- Consumes:
  - `PACKS` (barrel; 12 rows, ids `hangar`, `prow`, …).
  - `HALF_OF`, `stoneFor`, `stoneLine` (PR 2, `world/labels.js`); `linkOf`, `gameOf` (PR 3, `world/links.js`); `fmt` (PR 4, `hq/gameScreen.js`).
  - Tests only: `createSaves` (`src/runtime/saves.js:36`); `PLACES`, `progress`; `ACHIEVEMENTS` (`src/components/Achievements.jsx:13`); `ROOMS` (`ricochet/rules.js:26`), `LEVEL_COUNT` (`widow/rules.js:185`), `LEGS` (`tesseract/rules.js:135`); `switchFor` (PR 4).
- Produces, all from `src/components/avengers/board/records.js`:
  - `BESTS: { [placeId]: { key: string, read(raw) → Best | null } }`, in `PLACES` order. `Best` is `{ score: number, text: string, stars: { have, of } | null }`.
  - `RECORD_KEYS = { tour: 'tp-hq-swing-tour', style: 'tp-hq-style-best', packs: 'tp-hq-packs' }`
  - `COUNTS = { rooms: 12, levels: 8, legs: 6 }`
  - `AVENGERS_ACHIEVEMENTS`: the 14 ids of `Achievements.jsx:213-226`, in that order (`worthy` … `showboat`). `snap` (`:62`) is the classic page’s free snap and is left out.
  - `FLAT_READY = []`: the places whose game has a 2D view. PR 7 sets it.
  - `export function readBest(id, get) → Best | null`, where `get(key, fallback)` is `runtime/saves`’ plain `get`. PR 6 greps for this exact declaration.
  - `export function readRecords(get, { stones = 0, unlocked = [] } = {}) → { stones: { have, of: 6 }, tour: number | null, style: number, packs: { have, of: 12 }, feats: { have, of: 14 } }`
  - `export function stoneState(place, { can3D, flat }) → 'gate' | 'won' | 'half' | 'open' | 'flat' | 'needs3d'`
  - `export function stoneText(place, state) → string`
  - `export function boardCards(prog, { get, can3D, flat = FLAT_READY }) → Card[]`, in `PLACES` order. `Card` is `{ id, n, name, where, game, link, glow, state, stoneText, done, next, best, play }`, with `n` 1–8 as the map’s pins.

- [ ] **Step 1: Write the failing test.**

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { ACHIEVEMENTS } from '../../Achievements';
import { switchFor } from '../hq/gameScreen';
import { ROOMS } from '../ricochet/rules';
import { LEVEL_COUNT } from '../widow/rules';
import { LEGS } from '../tesseract/rules';
import { PACKS, PLACES, progress } from '../world/rules';
import { AVENGERS_ACHIEVEMENTS, BESTS, COUNTS, FLAT_READY, RECORD_KEYS, boardCards, readBest, readRecords } from './records';

const from = (o) => (k, f) => (k in o ? o[k] : f);
// saves.test.js:4-7’s store, seeded with raw strings
const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const at = (cs, id) => cs.find((c) => c.id === id);

describe('the ops board’s bests', () => {
  it('reads every game’s best from its own key and shape', () => {
    const get = from({ 'tp-hq-repulsor-best': 12345, 'tp-hq-lawn-best': 800, 'tp-hq-ricochet': { reached: 4, stars: [3, 2, 1] }, 'tp-hq-trickshot-best': 1310, 'tp-hq-widow-level': 3, 'tp-hq-smash-best': 2140, 'tp-hq-thwip-best': 9876, 'tp-hq-tesseract-best': [120, 340, 0, 0, 0, 0] });
    expect(readBest('stark', get)).toEqual({ score: 12345, text: 'Best 12,345', stars: null });
    expect(readBest('thor', get).text).toBe('Best 800');
    expect(readBest('cap', get)).toEqual({ score: 3, text: '3 of 12 rooms', stars: { have: 6, of: 36 } });
    expect(readBest('hawkeye', get).text).toBe('Best 1,310');
    expect(readBest('widow', get)).toEqual({ score: 3, text: '3 of 8 levels', stars: null });
    expect(readBest('banner', get).text).toBe('Best 2,140 m');
    expect(readBest('spidey', get).text).toBe('Best 9,876');
    expect(readBest('vault', get)).toEqual({ score: 460, text: 'Best 460 · 2 of 6 legs', stars: null });
  });
  it('is nothing for a key that is missing or holds nonsense', () => {
    for (const id of Object.keys(BESTS)) expect(readBest(id, from({})), id).toBe(null);
    expect(readBest('nowhere', from({}))).toBe(null);
    const bad = from({ 'tp-hq-repulsor-best': 'abc', 'tp-hq-lawn-best': -40, 'tp-hq-ricochet': { reached: 'x', stars: 'nope' }, 'tp-hq-trickshot-best': {}, 'tp-hq-widow-level': 99, 'tp-hq-smash-best': null, 'tp-hq-thwip-best': [1, 2], 'tp-hq-tesseract-best': 'oops' });
    expect(Object.keys(BESTS).filter((id) => readBest(id, bad) !== null)).toEqual(['widow']);
    expect(readBest('widow', bad).text).toBe('8 of 8 levels'); // clamped, as Infiltration.jsx:41 clamps
  });
  it('clamps Ricochet’s stars and Tesseract Run’s legs as the games do', () => {
    expect(readBest('cap', from({ 'tp-hq-ricochet': { stars: [9, -1, '2', null] } }))).toEqual({ score: 2, text: '2 of 12 rooms', stars: { have: 5, of: 36 } });
    expect(readBest('vault', from({ 'tp-hq-tesseract-best': [-5, 'x', 99.6, null, 1, 2, 3, 4] }))).toEqual({ score: 103, text: 'Best 103 · 3 of 6 legs', stars: null });
  });
  it('reads through the runtime’s saves without rewriting a key, and a key that won’t parse is missing', () => {
    const local = store({ 'tp-hq-repulsor-best': '{bad', 'tp-hq-swing-tour': '41.3', 'tp-hq-ricochet': '{"reached":2,"stars":[3]}' });
    const saves = createSaves({ local, session: store() });
    expect(readBest('stark', saves.get)).toBe(null);
    expect(readBest('cap', saves.get).text).toBe('1 of 12 rooms');
    expect(readRecords(saves.get, {}).tour).toBe(41.3);
    expect(local.getItem('tp-hq-swing-tour')).toBe('41.3');
    expect(local.getItem('tp-hq-ricochet')).toBe('{"reached":2,"stars":[3]}');
    expect(local.getItem('tp-hq-repulsor-best')).toBe('{bad');
  });
  it('names the very keys the games and the compound write', () => {
    expect(Object.values(BESTS).map((b) => b.key)).toEqual(['tp-hq-repulsor-best', 'tp-hq-lawn-best', 'tp-hq-ricochet', 'tp-hq-trickshot-best', 'tp-hq-widow-level', 'tp-hq-smash-best', 'tp-hq-thwip-best', 'tp-hq-tesseract-best']);
    const FILE = { stark: 'repulsor/RepulsorRange.jsx', thor: 'lawn/HoldTheLawn.jsx', cap: 'ricochet/Ricochet.jsx', hawkeye: 'trickshot/TrickShot.jsx', widow: 'widow/Infiltration.jsx', banner: 'smash/SmashRun.jsx', spidey: 'thwip/Thwip.jsx', vault: 'tesseract/TesseractRun.jsx' };
    for (const [id, f] of Object.entries(FILE)) expect(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), f).toContain(`'${BESTS[id].key}'`);
    const world = readFileSync(new URL('../world/CompoundWorld.jsx', import.meta.url), 'utf8');
    for (const k of Object.values(RECORD_KEYS)) expect(world, k).toContain(`'${k}'`);
  });
});

describe('the records strip', () => {
  it('counts the stones, the tour, the style, the backpacks and the Avengers achievements', () => {
    const r = readRecords(from({ 'tp-hq-swing-tour': 41.3, 'tp-hq-style-best': 2450, 'tp-hq-packs': [PACKS[0].id, PACKS[1].id, PACKS[1].id, 'nonsense'] }), { stones: 3, unlocked: ['worthy', 'spidey', 'explorer', 'snap'] });
    expect(r).toEqual({ stones: { have: 3, of: 6 }, tour: 41.3, style: 2450, packs: { have: 2, of: 12 }, feats: { have: 2, of: 14 } });
  });
  it('starts clean with nothing kept, and with nonsense kept', () => {
    const clean = { stones: { have: 0, of: 6 }, tour: null, style: 0, packs: { have: 0, of: 12 }, feats: { have: 0, of: 14 } };
    expect(readRecords(from({}), {})).toEqual(clean);
    expect(readRecords(from({}))).toEqual(clean);
    expect(readRecords(from({ 'tp-hq-swing-tour': '41.3', 'tp-hq-style-best': {}, 'tp-hq-packs': 'abc' }), { stones: 9 })).toEqual({ ...clean, stones: { have: 6, of: 6 } });
  });
  it('names the fourteen Avengers achievements, and pins its counts to the games’ own rules', () => {
    const ids = Object.keys(ACHIEVEMENTS);
    expect(AVENGERS_ACHIEVEMENTS).toEqual(ids.slice(ids.indexOf('worthy'), ids.indexOf('showboat') + 1));
    expect(AVENGERS_ACHIEVEMENTS).toHaveLength(14);
    expect(AVENGERS_ACHIEVEMENTS).not.toContain('snap');
    expect(COUNTS).toEqual({ rooms: ROOMS.length, levels: LEVEL_COUNT, legs: LEGS.length });
  });
});

describe('the board’s cards', () => {
  it('has one card a building, in the tour’s order, numbered as the map’s pins, each with its link and its game', () => {
    const cards = boardCards(progress([]), { get: from({}), can3D: true });
    expect(cards.map((c) => c.id)).toEqual(PLACES.map((p) => p.id));
    expect(cards.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(cards.map((c) => c.link)).toEqual(['/avengers/workshop', '/avengers/lawn', '/avengers/training', '/avengers/range', '/avengers/operations', '/avengers/lab', '/avengers/gate', '/avengers/hangar']);
    expect(cards.map((c) => c.game)).toEqual(['Repulsor Range', 'Hold the Lawn', 'Ricochet', 'Trick Shot', 'Infiltration', 'Smash Run', 'Thwip!', 'Tesseract Run']);
    expect(cards.filter((c) => c.next).map((c) => c.id)).toEqual(['stark']);
  });
  it('says what each stone is in the HUD’s own words: won, half won, to win, or won in the 3D game', () => {
    const prog = progress(['power', 'soul-clint']);
    const on = boardCards(prog, { get: from({}), can3D: true });
    expect(at(on, 'stark')).toMatchObject({ state: 'won', stoneText: 'Power Stone: won back' });
    expect(at(on, 'hawkeye')).toMatchObject({ state: 'half', stoneText: 'Clint’s half of the Soul Stone: won back' });
    expect(at(on, 'widow')).toMatchObject({ state: 'open', stoneText: 'Win Natasha’s half of the Soul Stone here' });
    expect(at(on, 'thor')).toMatchObject({ state: 'open', stoneText: 'Win the Reality Stone here', play: 'Play' });
    const off = boardCards(prog, { get: from({}), can3D: false });
    expect(off.filter((c) => c.state === 'needs3d').map((c) => c.id)).toEqual(['thor', 'cap', 'widow', 'banner', 'vault']);
    expect(at(off, 'thor').stoneText).toBe('The stone here is won in the 3D game.');
    expect(at(off, 'thor').stoneText).toBe(switchFor({ can: true, on: false, status: 'idle' }).note.text); // the game screen’s words
    expect(at(off, 'stark').state).toBe('won');
  });
  it('plays in 2D where a game has a 2D view, and counts the gate done once Thwip! is won', () => {
    const flat = boardCards(progress(['power', 'soul-clint']), { get: from({}), can3D: false, flat: ['cap'] });
    expect(at(flat, 'cap')).toMatchObject({ state: 'flat', play: 'Play in 2D', stoneText: 'Win the Mind Stone here in 2D' });
    expect(FLAT_READY).toEqual([]);
    expect(at(boardCards(progress([], ['spidey']), { get: from({ 'tp-hq-thwip-best': 9876 }), can3D: true }), 'spidey')).toMatchObject({ state: 'gate', done: true, stoneText: 'No stone here: Peter made it to school', best: { text: 'Best 9,876' } });
    expect(at(boardCards(progress([]), { get: from({}), can3D: false }), 'spidey')).toMatchObject({ state: 'gate', done: false, stoneText: 'No stone here: just Peter, and school', play: 'Play' });
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/components/avengers/board/records.test.js`. Expected: `Failed to resolve import "./records"` and `Test Files 1 failed (1)`.
- [ ] **Step 3: Write `records.js`.**
  - **Header comment:** the ops board’s numbers, read from the keys the games and the compound already write, each the way its own game reads it. The reads go through `runtime/saves`’ plain `get`, never `register`, which would rewrite a key as `{ v, data }` that the games’ raw reads don’t expect (spec §6). The counts are constants pinned by the test, so no game’s rules come into the page.
  - **Imports**, all pure: `PACKS` from `'../world/rules'`; `HALF_OF`, `stoneFor`, `stoneLine` from `'../world/labels'`; `gameOf`, `linkOf` from `'../world/links'`; `fmt` from `'../hq/gameScreen'`.
  - **`pos(v)`** (module-private): `Number(v)` when finite and above 0, else 0. That is the games’ `Number(local.get(BEST, 0)) || 0` (`RepulsorRange.jsx:70`), with 0 or less counting as nothing.
  - **The readers in `BESTS`.** Each returns `null` when its score is 0.

    | place | key | score | `text` | `stars` |
    | --- | --- | --- | --- | --- |
    | `stark`, `thor`, `hawkeye`, `spidey` | their `-best` key | `pos(raw)` | `` `Best ${fmt(score)}` `` | `null` |
    | `banner` | `tp-hq-smash-best` | `pos(raw)` | `` `Best ${fmt(score)} m` `` (`SmashRun.jsx:440`) | `null` |
    | `cap` | `tp-hq-ricochet` (`{ reached, stars[] }`, `Ricochet.jsx:28-32`) | rooms with a star | `` `${score} of 12 rooms` `` | `{ have: sum, of: 36 }` |
    | `widow` | `tp-hq-widow-level` (a count, `Infiltration.jsx:41`) | `Math.floor(Math.min(8, pos(raw)))` | `` `${score} of 8 levels` `` | `null` |
    | `vault` | `tp-hq-tesseract-best` (per leg, `TesseractRun.jsx:59-63`) | the sum of the legs | `` `Best ${fmt(score)} · ${flown} of 6 legs` `` | `null` |

    - Ricochet takes the first 12 entries of `stars` when it is an array, each `Math.max(0, Math.min(3, Math.round(Number(s) || 0)))`; `reached` is not read.
    - Tesseract takes 6 legs, each `Math.round(pos(raw[i]))` when `raw` is an array, else 0. The total is the game’s own “Best across the legs” (`TesseractRun.jsx:518`), and `flown` is the legs above 0.
  - **`readBest(id, get)`**: `BESTS[id]?.read(get(BESTS[id].key, null)) ?? null`.
  - **`readRecords`**:
    - `tour`: the raw value when it is a finite number above 0, else `null` (as `CompoundWorld.jsx:147`).
    - `style`: the same, else `0` (`:210`).
    - `packs.have`: the distinct ids of the raw array that are `PACKS` ids (as `readFound`, `:54-57`).
    - `feats.have`: the count of `AVENGERS_ACHIEVEMENTS` in `unlocked`.
    - `stones.have`: `stones` clamped to 0–6.
  - **`stoneState(p, { can3D, flat })`**, checked in this order: no `p.stone` → `'gate'`; `p.done` → `'half'` when `HALF_OF[p.stone]`, else `'won'`; `can3D` → `'open'`; `flat` → `'flat'`; else `'needs3d'`.
  - **`stoneText(p, state)`**:
    - `gate`, `won` and `half` → `stoneLine(p)`, so the board and the HUD’s list say a stone the same way.
    - `open` → `` `Win ${what} here` ``; `flat` → `` `Win ${what} here in 2D` ``; `needs3d` → `'The stone here is won in the 3D game.'`. That last is PR 4’s line word for word, and the test pins it to `switchFor`.
    - `what` is `` HALF_OF[p.stone] ? `${HALF_OF[p.stone]} half of the ${st.name}` : `the ${st.name}` ``, with `st = stoneFor(p)`.
  - **`boardCards(prog, { get, can3D, flat = FLAT_READY })`** maps `prog.places` in order. Each card is:
    - `{ id, n: i + 1, name, where }`;
    - `game: gameOf(id)`, `link: linkOf(id)`, `glow: stoneFor(p)?.color ?? p.accent`;
    - `state` and `stoneText`, where `state = stoneState(p, { can3D, flat: flat.includes(id) })`;
    - `done: p.done`, `next: id === prog.next`, `best: readBest(id, get)`;
    - `play: state === 'flat' ? 'Play in 2D' : 'Play'`.
- [ ] **Step 4: Run it to see it pass.** Same command. Expected: `Tests 11 passed (11)`, each a few ms. Then `npx eslint src/components/avengers/board`. Expected: no output.
- [ ] **Step 5: Commit.** `git add src/components/avengers/board/records.js src/components/avengers/board/records.test.js`. Subject: `Avengers HQ: read the ops board’s bests and records from the keys the games already write`. Body: each key read as its own game reads it, through the runtime’s saves without registering (no `{ v, data }` rewrite); a card a building in the tour’s order, in the HUD’s words; no game’s rules imported.

### Task 3: `OpsBoard.jsx`, the records strip and a card a building

**Files:**
- Create: `src/components/avengers/board/OpsBoard.jsx`
- Test: `src/components/avengers/board/OpsBoard.test.jsx` (create)
- Modify: `src/styles/lazy/avengers.css` (append after `:130`)

**Interfaces:**
- Consumes: Task 1’s `prog.count`; Task 2’s `boardCards` and `readRecords`; `hqState` (PR 3); `fmt` (PR 4); `clock` (`world/labels.js:6`); `STONES` (`interests/stones.js`); `useInView` (`src/lib/hooks.js:39`); `localSaves` (`src/runtime/local.js:20`); `Link`.
- Produces:
  - `export default function OpsBoard({ prog, can3D, unlocked = [], onGo = null, onTry3D = null, get = localSaves().get })`. Go there shows only when `can3D && onGo`. Try 3D shows only on a `needs3d` card, and only when `onTry3D` is set. `onGo(id)` and `onTry3D(id)` take the place id.
  - `export function BoardCard({ card, onGo = null, onTry3D = null })`: hook-free, so a test can call it.
  - DOM:
    - `section#hq-board`, labelled by `#hq-board-title`, holding `dl.hq-records` and then `ol.hq-cards`;
    - `li#hq-card-<placeId>.hq-card` with `data-state`, `data-done` and `data-next`;
    - Play is the card’s `a.btn-primary`; Go there and Try 3D are its `button.btn-ghost`s.

- [ ] **Step 1: Write the failing test.**

```jsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Link, MemoryRouter } from 'react-router-dom';
import OpsBoard, { BoardCard } from './OpsBoard';
import { boardCards } from './records';
import { hqState } from '../world/links';
import { PLACES, progress } from '../world/rules';

const from = (o) => (k, f) => (k in o ? o[k] : f);
const render = (p) => renderToStaticMarkup(<MemoryRouter><OpsBoard get={from({})} {...p} /></MemoryRouter>);
const count = (h, s) => h.split(s).length - 1;
const ids = (h) => [...h.matchAll(/id="hq-card-([a-z]+)"/g)].map((m) => m[1]);
const ALL = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space'];
// the elements of a tree, depth first (src/pages/Worlds.test.jsx:14-21)
const walk = (el, out = []) => {
  if (Array.isArray(el)) el.forEach((e) => walk(e, out));
  else if (el && typeof el === 'object' && el.props) {
    out.push(el);
    walk(el.props.children, out);
  }
  return out;
};
const words = (e) => [e.props.children].flat().filter((x) => typeof x === 'string').join('');

describe('the ops board', () => {
  it('puts the records strip above the eight cards, in the tour’s order', () => {
    const html = render({ prog: progress([]), can3D: true });
    expect(html).toContain('id="hq-board"');
    expect(html).toContain('aria-labelledby="hq-board-title"');
    expect(ids(html)).toEqual(PLACES.map((p) => p.id));
    expect(html.indexOf('class="hq-records')).toBeLessThan(html.indexOf('id="hq-card-stark"'));
  });
  it('links Play to every building, and offers Go there only when the compound is in 3D', () => {
    const go = render({ prog: progress([]), can3D: true, onGo: () => {} });
    for (const to of ['/avengers/workshop', '/avengers/lawn', '/avengers/training', '/avengers/range', '/avengers/operations', '/avengers/lab', '/avengers/gate', '/avengers/hangar']) expect(go).toContain(`href="${to}"`);
    expect(count(go, '>Go there<')).toBe(8);
    expect(count(render({ prog: progress([]), can3D: false, onGo: () => {} }), '>Go there<')).toBe(0);
    expect(count(render({ prog: progress([]), can3D: true }), '>Go there<')).toBe(0);
  });
  it('offers Try 3D only on a card whose stone is won in the 3D game, and only where 3D can be tried', () => {
    const prog = progress(['power']);
    const off = render({ prog, can3D: false, onTry3D: () => {} });
    expect(count(off, '>Try 3D<')).toBe(6);
    expect(count(off, 'The stone here is won in the 3D game.')).toBe(6);
    expect(count(render({ prog, can3D: false }), '>Try 3D<')).toBe(0);
    expect(count(render({ prog, can3D: true, onTry3D: () => {} }), '>Try 3D<')).toBe(0);
  });
  it('counts Things to do as the HUD does, 8/8 with every stone and Thwip!, and shows the kept records', () => {
    expect(render({ prog: progress(ALL, ['spidey']), can3D: true })).toContain('<dt>Things to do</dt><dd>8/8</dd>');
    expect(render({ prog: progress(ALL), can3D: true })).toContain('<dt>Things to do</dt><dd>7/8</dd>');
    const kept = render({ prog: progress(['power']), can3D: true, unlocked: ['worthy', 'snap'], get: from({ 'tp-hq-swing-tour': 41.3, 'tp-hq-ricochet': { stars: [3, 2, 1] } }) });
    expect(kept).toContain('<dt>Swing tour</dt><dd>0:41.3</dd>');
    expect(kept).toContain('<dt>Best style</dt><dd>Not yet</dd>');
    expect(kept).toContain('<dt>Backpacks</dt><dd>0 of 12</dd>');
    expect(kept).toContain('<dt>Achievements</dt><dd>1 of 14</dd>');
    expect(kept).toContain('3 of 12 rooms · 6 of 36 stars');
    expect(kept).toContain('No score yet');
  });
  it('opens a building with the page’s own state, so Back comes back to the board, and hands each button its place', () => {
    const go = vi.fn();
    const try3D = vi.fn();
    const card = boardCards(progress([]), { get: from({}), can3D: false }).find((c) => c.id === 'cap');
    const els = walk(BoardCard({ card, onGo: go, onTry3D: try3D }));
    const link = els.find((e) => e.type === Link);
    expect(link.props.to).toBe('/avengers/training');
    expect(link.props.state).toBe(hqState);
    expect(link.props.replace).toBeUndefined();
    els.find((e) => e.type === 'button' && words(e) === 'Try 3D').props.onClick();
    els.find((e) => e.type === 'button' && words(e) === 'Go there').props.onClick();
    expect([try3D.mock.calls, go.mock.calls]).toEqual([[['cap']], [['cap']]]);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/components/avengers/board/OpsBoard.test.jsx`. Expected: `Failed to resolve import "./OpsBoard"`.
- [ ] **Step 3: Write `OpsBoard.jsx`.**
  - **Imports:** `Link` from `react-router-dom`; `STONES` from `'../../interests/stones'`; `useInView` from `'../../../lib/hooks'`; `localSaves` from `'../../../runtime/local'`; `fmt` from `'../hq/gameScreen'`; `clock` from `'../world/labels'`; `hqState` from `'../world/links'`; `boardCards` and `readRecords` from `'./records'`; and `'../../../styles/lazy/avengers.css'`, as `Place.jsx:16` imports it.
  - **Reading.** `const [box] = useInView({ rootMargin: '200px 0px' })`, with its ref on the section. Comment: the flag’s flip re-renders the board as it scrolls into view, so the strip re-reads the tour, the style and the backpacks a walk wrote. Then, during render with no memo: `r = readRecords(get, { stones: prog.stones, unlocked })` and `cards = boardCards(prog, { get, can3D })`.
  - **The section:** `<section ref={box} id="hq-board" className="hq-board shell relative z-10 py-14 md:py-20" aria-labelledby="hq-board-title">`. It holds the eyebrow “The compound”, `<h2 id="hq-board-title" className="title mt-4">Ops board</h2>` and `<p className="lead mt-4 max-w-[62ch]">{prog.objective}</p>`.
  - **The strip:** `<dl className="hq-records mt-6">`, one `<div className="chip"><dt>…</dt><dd>…</dd></div>` a row. Each `dd` is one string, so the server markup has no separators.

    | `dt` | `dd` |
    | --- | --- |
    | Stones | six `<i className="stone-dot" aria-hidden="true">` in `.hq-records-dots`, one a `STONES` row with its `--glow` and `data-on` when `prog.have` holds it, then `` `${r.stones.have} of 6` `` |
    | Things to do | `` `${prog.count}/${prog.places.length}` `` |
    | Swing tour | `r.tour ? clock(r.tour) : 'Not yet'` |
    | Best style | `r.style ? fmt(r.style) : 'Not yet'` |
    | Backpacks | `` `${r.packs.have} of 12` `` |
    | Achievements | `` `${r.feats.have} of 14` `` |

  - **The cards:** `<ol className="hq-cards mt-8">`, then `<BoardCard key={c.id} card={c} onGo={can3D ? onGo : null} onTry3D={onTry3D} />` for each.
  - **`BoardCard`** renders `<li id={`hq-card-${c.id}`} className="hq-card" data-state={c.state} data-done={c.done || undefined} data-next={c.next || undefined} style={{ '--glow': c.glow }}>`. Inside, in order:
    1. `<p className="label">{c.n} · {c.where}</p>`, and a `chip chip-sm chip-accent` reading `Next` when `c.next`;
    2. `<h3 className="hq-card-name">{c.name}</h3>` and `<p className="text-sm text-body">{c.game}</p>`;
    3. `<p className="hq-card-stone">`, holding a `stone-dot` (none for `gate`) and `c.stoneText`;
    4. `<p className="hq-card-best mono text-sm">`. Its text is one string: `[best.text, best.stars && `${best.stars.have} of ${best.stars.of} stars`].filter(Boolean).join(' · ')`, or `No score yet`;
    5. `<div className="hq-card-acts">` with, in order:
       - `<Link to={c.link} state={hqState} className="btn btn-primary btn-sm">{c.play}<span className="sr-only"> {c.game}</span></Link>`;
       - with `onGo`, a `btn btn-ghost btn-sm` button `Go there<span className="sr-only">: {c.name}</span>` calling `onGo(c.id)`;
       - when `c.state === 'needs3d' && onTry3D`, a `btn btn-ghost btn-sm` button `Try 3D<span className="sr-only">: {c.name}</span>` calling `onTry3D(c.id)`.
  - **CSS**, appended to `avengers.css` under the comment `/* the ops board (avengers/board): the records strip, then a card a building */`. Tokens and whole 4 px steps only:
    - `.hq-records`: flex, wrap, gap `0.5rem`, margin 0. `.hq-records dt`: `var(--muted)`. `.hq-records dd`: margin 0, `var(--text)`, weight 600.
    - `.hq-records-dots`: inline-flex. Its `.stone-dot`: `0.5rem` square, margin `0 0.25rem 0 0`, no shadow, opacity `0.45`, or 1 with `[data-on]` (a picture dims, never text: RULES.md UI 6).
    - `.hq-cards`: grid, gap `1rem`, `grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr))`, no margin, padding or list style.
    - `.hq-card`: a flex column, `align-items: flex-start`, gap `0.5rem`, padding `1rem`, `1px solid var(--border)`, a `4px solid var(--glow)` left border, `var(--r-card)` corners, `var(--surface)` background and `scroll-margin-top: calc(var(--nav-h) + 1rem)`. `.hq-card[data-next]`: `border-color: var(--border-strong)`, with the left border still `var(--glow)`.
    - `.hq-card-name`: margin 0, `var(--text)`, `var(--fs-lg)`, weight 650.
    - `.hq-card-stone`: flex, centred, gap `0.5rem`, margin 0, `var(--fs-sm)`, `var(--text-body)`. Its `.stone-dot`: margin 0. `.hq-card:not([data-done]) .hq-card-stone .stone-dot`: opacity `0.45`, no shadow.
    - `.hq-card-best`: margin 0, `var(--muted)`.
    - `.hq-card-acts`: flex, wrap, gap `0.5rem`, `margin-top: auto`, `padding-top: 0.5rem`. `@media (pointer: coarse) { .hq-card-acts .btn { min-height: 44px; } }`.
- [ ] **Step 4: Run it to see it pass.** `npx vitest run src/components/avengers/board`. Expected: both files pass (`OpsBoard.test.jsx` 5, `records.test.js` 11), each test under 50 ms. Then `npx eslint src/components/avengers/board`. Expected: no output.
- [ ] **Step 5: Commit.** `git add src/components/avengers/board/OpsBoard.jsx src/components/avengers/board/OpsBoard.test.jsx src/styles/lazy/avengers.css`. Subject: `Avengers HQ: draw the ops board: the records strip, then a card a building`. Body: Play is each building’s link with the page’s state, so Back pops to the board; Go there shows only with 3D; Try 3D only on a card whose stone is won in the 3D game.

### Task 4: The board under the compound, in place of the no-3D cards

**Files:**
- Modify: `src/components/avengers/world/CompoundWorld.jsx`:
  - the imports (`:1-22`, and PR 3’s and PR 4’s additions) and the labels import at `:17`;
  - the header comment (`:24-30`);
  - `CompoundWorld` (`:65-112`: refs, two handlers and the return);
  - `function World(` (its signature) and the lines after `const travel = (id) =>` (`:616-623`);
  - `function Cards` (`:654-707`), which becomes `function Air`.
- Modify: `src/components/avengers/world/labels.js` (append `airNote`)
- Modify: `src/components/avengers/world/world.css:218-224`
- Modify: `scripts/hq-links-check.mjs` (the `CARD` and `PLAY` lines and the comment above them)
- Modify: `src/components/guide/pages.js:452` (the “Without 3D” tip; about `:453` after PR 3)
- Modify: `docs/architecture.md:27`
- Test: `src/components/avengers/world/CompoundWorld.test.js` (one new `describe`), `src/components/avengers/world/labels.test.js` (one new `it`)

**Interfaces:**
- Consumes:
  - Task 3’s `OpsBoard`.
  - PR 2’s `unlocked`; PR 3’s `enter(id)` (it pushes the link with `hqState`); PR 4’s `GAME_AT` and `writeLocal3D`.
  - `jumpTo(event, id, { focus, block })` (`src/lib/anchors.js:7`); `openSettings()` (`src/lib/palette.js:25`).
  - `use3D()`’s `can`, `mode`, `held` and `hold` (`src/lib/gpu.js:104-125`).
  - `Compound({ spots, titles, stones, onPick, className })` (`avengers/Compound.jsx:488`), whose pins are `.hq-pin[data-pick]`.
- Produces:
  - In `world/labels.js`: `airNote({ gl, mode, held }) → { text, action: { label, run: 'retry' | 'load' | 'settings' } | null }`.
  - In `CompoundWorld`: `go = useRef(null)`, which `World` points at `travel`. `goThere(id)` and `tryIn3D(id)`. `<OpsBoard>` is the sibling after `section#hq-world`.
  - The no-3D view is `Air({ prog, three, gl, retry })`; `#hq-world`’s `data-mode` is still `'cards'` without 3D, which PR 4’s checks read.
  - `hq-links-check.mjs`: `CARD = (id) => `#hq-card-${id}``, `PLAY = 'a.btn-primary'`.

- [ ] **Step 1: Write the failing tests.** In `CompoundWorld.test.js` (beside PR 1’s `loadsWith` and `ROOT`):

```js
describe('the compound and its board', () => {
  const world = readFileSync(new URL('./CompoundWorld.jsx', import.meta.url), 'utf8');
  it('puts the ops board directly under the compound, in place of the cards, with the pins finding its cards', () => {
    const open = world.indexOf('<section id="hq-world"');
    expect(open).toBeGreaterThan(-1);
    expect(world.indexOf('<OpsBoard')).toBeGreaterThan(world.indexOf('</section>', open));
    expect(world).not.toMatch(/function Cards\(/);
    expect(world).toMatch(/function Air\(/);
    expect(world).toMatch(/onPick=\{\(id\) => jumpTo\(null, `hq-card-\$\{id\}`/);
    expect(world).toMatch(/go\.current = travel;/);
  });
  it('tries 3D one game at a time, and never touches the site’s 3D setting', () => {
    expect(world).toContain("writeLocal3D(GAME_AT[id], 'on')");
    expect(world).not.toMatch(/three\.set\(|setMode3D/);
  });
  it('brings the board with it, and no game’s rules', async () => {
    const files = await loadsWith(`${ROOT}src/components/avengers/world/CompoundWorld.jsx`);
    expect(files).toEqual(expect.arrayContaining(['src/components/avengers/board/OpsBoard.jsx', 'src/components/avengers/board/records.js']));
    expect(files.filter((f) => /^src\/components\/avengers\/(ricochet|widow|tesseract)\/rules\.js$/.test(f))).toEqual([]);
  });
  it('tells the guide’s readers the same', () => {
    expect(readFileSync(new URL('../../guide/pages.js', import.meta.url), 'utf8')).toMatch(/\['Without 3D', '[^']*the ops board below[^']*'\]/);
  });
});
```

In `labels.test.js` (import `airNote` too):

```js
it('says why the compound is drawn from the air, and offers only what leaves the site’s 3D setting as it is', () => {
  const failed = 'The 3D compound couldn’t start here, so here it is from the air.';
  expect(airNote({ gl: 'failed', mode: 'auto', held: false })).toEqual({ text: failed, action: { label: 'Try 3D again', run: 'retry' } });
  expect(airNote({ gl: 'lost', mode: 'auto', held: false })).toEqual({ text: 'The graphics chip reset, so here’s the compound from the air.', action: { label: 'Try 3D again', run: 'retry' } });
  expect(airNote({ gl: 'failed', mode: 'on', held: false })).toEqual({ text: failed, action: null });
  expect(airNote({ gl: 'loading', mode: 'auto', held: true })).toEqual({ text: 'The 3D compound isn’t loaded yet, so here it is from the air.', action: { label: 'Load the 3D', run: 'load' } });
  expect(airNote({ gl: 'failed', mode: 'off', held: true })).toEqual({ text: '3D is switched off in Settings, so here’s the compound from the air.', action: { label: 'Settings', run: 'settings' } });
});
```

In `scripts/hq-links-check.mjs`, change PR 3’s two lines and the comment above them:

```js
// the ops board’s card for a place, and its way in (avengers/board/OpsBoard.jsx)
const CARD = (id) => `#hq-card-${id}`;
const PLAY = 'a.btn-primary';
```

- [ ] **Step 2: Run them to see them fail.**
  - `npx vitest run src/components/avengers/world/CompoundWorld.test.js src/components/avengers/world/labels.test.js`. Expected: 5 failed. The four in “the compound and its board” fail (no `<OpsBoard`; `three.set(` still there; no `board/OpsBoard.jsx` in the closure; the old tip), and so does `airNote is not a function`.
  - With `npx vite --port 5173 --strictPort` up: `OUT=$S/links node scripts/hq-links-check.mjs`. Expected: `FAIL` on `door`, `double-esc`, `reload` and `stones` (no `#hq-card-cap`), and a last line `<n> problems`.
- [ ] **Step 3: `airNote` in `world/labels.js`.**
  - Comment: why the compound is drawn from the air, and the one thing to do about it. It never changes the site’s 3D setting, which stays in Settings (spec §5).
  - Checks in order:
    1. `mode === 'off'` → “3D is switched off in Settings, so here’s the compound from the air.” with `Settings` / `'settings'`.
    2. `held` → “The 3D compound isn’t loaded yet, so here it is from the air.” with `Load the 3D` / `'load'`.
    3. `gl === 'lost'` → “The graphics chip reset, so here’s the compound from the air.”
    4. Otherwise → “The 3D compound couldn’t start here, so here it is from the air.”

    The last two get `Try 3D again` / `'retry'` only when `mode === 'auto'`, and `null` otherwise.
- [ ] **Step 4: The board under the compound** (`CompoundWorld.jsx`).
  - **Imports.** Add:
    - `import OpsBoard from '../board/OpsBoard';`
    - `import { GAME_AT, writeLocal3D } from '../hq/gameScreen';`
    - `import { jumpTo } from '../../../lib/anchors';`
    - `import { openSettings } from '../../../lib/palette';`

    The labels import becomes `{ airNote, clock, stoneFor }`: `stoneLine` was used only in `Cards`.
  - **The header comment.** Without 3D, the compound is the drawing from the air, and its pins find their buildings on the ops board (`../board/OpsBoard.jsx`). The board sits under the compound in both modes.
  - **In `CompoundWorld`**, beside `api`:
    - `const go = useRef(null);` — `World` points it at `travel`, as it points `api` at its view.
    - `goThere(id)`: `go.current?.(id)`, then `jumpTo(null, 'hq-world', { focus: true })`. Focus leaves the board’s button, so Space then jumps him rather than pressing Go there again.
    - `tryIn3D(id)`: `writeLocal3D(GAME_AT[id], 'on')`; `if (three.held) three.hold?.load()`, as `useGame3D`’s `set` does; then `enter(id)`. Comment: that game’s own 3D, never the site’s (spec §6), opened by its link with the page’s state, so Back comes back here.
  - **The return** becomes a fragment:
    - the unchanged `section#hq-world`, whose no-3D branch is `<Air prog={prog} three={three} gl={gl} retry={() => setGl('loading')} />`, with the open game inside it as before;
    - then `<OpsBoard prog={prog} can3D={world} unlocked={unlocked} onGo={world ? goThere : null} onTry3D={three.can ? tryIn3D : null} />`.

    The board is outside `.cw-world`, so `world.css:87-88`’s glass skin for buttons doesn’t reach it.
  - **`World`** takes `go`. After `travel`, add `useEffect(() => { go.current = travel; return () => { go.current = null; }; });` with no deps, because `travel` is new every render.
  - **`Air({ prog, three, gl, retry })`** replaces `Cards`. It keeps `div.shell.cw-cards-wrap`, the eyebrow and `h1#cw-title`.
    - The lead: “Marvel, all of it. Every building on the compound has a game behind its door; the board below has each one, its stone and your best.” It promises no stone for a toy and drops `{prog.objective}`, which the board shows.
    - When `three.can`, the notice is `note = airNote({ gl, mode: three.mode, held: three.held })`: its text, and its action as today’s `btn btn-ghost btn-sm`. The action runs `retry()` for `'retry'`, `three.hold?.load()` for `'load'` and `openSettings()` for `'settings'`.
    - The map: `<figure className="cw-air m-0 mt-8">` with the same `.hq-hud` wrapper, Suspense fallback and `<CompoundMap spots titles stones className="hq-hero-map" />` as today. `onPick` is `(id) => jumpTo(null, `hq-card-${id}`, { focus: true, block: 'center' })`.
    - The figcaption: “The compound from the air. Pick a pin to find its building on the board.”
    - No list: the board is under it.
- [ ] **Step 5: The rest.**
  - **`world.css:218-224`.** The comment becomes `/* without 3D: the compound from the air; the board below has the buildings */`. Keep `.cw-cards-wrap` (`:219`) and `:89-90`. Delete `.cw-cards-grid`, its media query, `.cw-cards`, `.cw-cards li` and `.cw-cards .cw-list-sub`. Add `.cw-air { max-width: 48rem; }`.
  - **The guide** (`guide/pages.js`, the `'Without 3D'` tip), whose text says the pins open the games: `['Without 3D', 'The compound is drawn from the air. Pick a pin to find its building on the ops board below, where Play opens its game.']`. Change nothing else in the file (draft #1028).
  - **`docs/architecture.md:27`.** After PR 4’s clauses, add: “; `../board/OpsBoard.jsx` is the ops board under the compound in both modes, and `../board/records.js` (tested) reads each game’s best from the key the game writes, unregistered.”
- [ ] **Step 6: Run them to see them pass.**
  - `npx vitest run src/components/avengers src/components/guide src/lib/words.test.js`. Expected: every file passes, `labels.test.js` and PR 2’s “says only what is true” included.
  - `npx eslint src/components/avengers src/components/guide scripts/hq-links-check.mjs`. Expected: no output (no unused `stoneLine`, the hooks rules clean).
  - `wc -l src/components/avengers/world/CompoundWorld.jsx`. Expected: under 800.
  - With the dev server up: `OUT=$S/links node scripts/hq-links-check.mjs`, then `OUT=$S/links-3d node scripts/hq-links-check.mjs --3d`. Expected: `all ok` both times.
- [ ] **Step 7: Commit.** `git add` the eight files. Subject: `Avengers HQ: the ops board under the compound, in place of the no-3D cards`. Body:
  - Go there reaches `World`’s `travel` through a ref and scrolls up to the compound.
  - A card’s Try 3D turns on that game’s own 3D and opens it. The no-3D notice no longer offers “Turn 3D on” (it changed the site’s setting): it retries, loads a held world or opens Settings.
  - The map’s pins find their cards.
  - `hq-links-check.mjs` drives the board’s cards.

### Task 5: The page’s order: the worlds, Titan, a closed Archive, the credits last

**Files:**
- Modify: `src/pages/Avengers.jsx`:
  - `:2` (the `Link` import); `:62-64` (the comment);
  - `:75-76` (`intro`, `playing`); `:86` (`intro.current?.stop();`); `:92-110` (`playIntro`);
  - `:158-173` (the second intro); `:254-287` (the soundboard, the scenes, the credits, the photos).
- Modify: `src/styles/lazy/avengers.css` (append)
- Test: `src/pages/Avengers.test.js` (create)

**Interfaces:**
- Consumes: Task 4’s board, rendered by `<CompoundWorld>`.
- Produces: `details.hq-archive` (closed, `h2#av-archive-title` in its summary); `section#av-credits`, the page’s last section; `Avengers.jsx` without `Link`, `playIntro` or the second intro. Titan’s section `#thanos` is unchanged and is PR 6’s.

- [ ] **Step 1: Write the failing test.** The page can’t render in Node (`lib/gpu` probes WebGL; Titan loads three), so its order is checked in its source, as `words.test.js` reads files. The browser’s `order` part is the proof.

```js
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./Avengers.jsx', import.meta.url), 'utf8');

describe('the Avengers page', () => {
  it('orders the page: the compound and its board, the worlds, Titan, a closed Archive, then the credits', () => {
    const at = ['<CompoundWorld', '<WorldSwitcher', 'id="thanos"', '<details className="hq-archive', '<ClipBoard', '<Scenes', '<WorldPhotos', '</details>', '<ModelCredits'].map((s) => page.indexOf(s));
    expect(at.every((i) => i > -1), String(at)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(page).not.toMatch(/<details className="hq-archive[^>]*\sopen/);
    expect(page.lastIndexOf('<section')).toBe(page.indexOf('<section id="av-credits"'));
  });
  it('has no second intro: the board is the first thing under the compound', () => {
    expect(page).not.toContain('About the compound');
    expect(page).not.toContain('playIntro');
    const next = page.indexOf('<section', page.indexOf('<CompoundWorld'));
    expect(page.slice(next, page.indexOf('</section>', next))).toContain('<WorldSwitcher');
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/pages/Avengers.test.js`. Expected: 2 failed: the order (no `hq-archive`, so `-1` in `at`) and `About the compound`.
- [ ] **Step 3: Reorder `Avengers.jsx`.**
  - **Delete:**
    - `import { Link } from 'react-router-dom';` (`:2`);
    - `intro` and `playing` (`:75-76`);
    - `intro.current?.stop();` from the unmount effect (`:86`). Keep the timers’ cleanup.
    - `playIntro` (`:92-110`);
    - the second intro section (`:158-173`). Its clip is the soundboard’s `marvel` (`:51`), and “Back to the site” is the HUD Menu’s way out and the site’s nav.

    `audioContext`, `useRef` and `useState` stay in use.
  - **The comment** at `:62-64` follows the new order: the compound with its ops board under it (`components/avengers/world`, `components/avengers/board`), the worlds, Titan through the portal, then the Archive and the credits.
  - **After `<CompoundWorld onPortal={openPortal} />`:** the `WorldSwitcher` section, the portal flash, then `section#thanos` verbatim.
  - **Then the Archive:** `<details className="hq-archive shell relative z-10 py-14 md:py-20">`, with no `open`. Its summary is `<summary><h2 id="av-archive-title" className="title">Archive</h2><span className="text-sm text-muted">The soundboard, scenes from the films and the props on display</span></summary>`. Inside, in order:
    1. `<section className="mt-10" aria-labelledby="av-board-title">`: the Soundboard, its lead and `<ClipBoard>`;
    2. `{hasScenes(SCENES) && <section className="mt-14" aria-labelledby="av-scenes-title">…<Scenes names={SCENES} /></section>}`;
    3. `{hasPhotos(ON_DISPLAY) && <section className="mt-14" aria-labelledby="av-display-title">…<WorldPhotos items={ON_DISPLAY} /></section>}`.

    Titles, ids, leads and data are unchanged; each `h2` becomes an `h3` with the same `.title`. The GIPHY embeds are untouched. `Gif.jsx` fetches on intersection (`:27`), and a closed `<details>` renders nothing, so nothing is fetched until it opens.
  - **Last:** `<section id="av-credits" className="shell relative z-10 section-last pt-4"><ModelCredits where="avengers" line className="text-xs text-muted" /></section>`.
  - **CSS**, appended to `avengers.css` under `/* the Avengers page’s Archive: one closed section, a plain chevron to open it */`:
    - `.hq-archive > summary`: flex, centred, gap `0.75rem`, `min-height: 44px`, no list style, `cursor: pointer`. `.hq-archive > summary::-webkit-details-marker { display: none; }`.
    - `.hq-archive > summary::before`: an empty `content`, `flex: none`, `0.5rem` square, `2px solid currentColor` right and bottom borders, `rotate(-45deg)`, `transition: transform var(--t-fast) var(--ease-smooth)`. `.hq-archive[open] > summary::before`: `rotate(45deg)`.
    - `@media (prefers-reduced-motion: reduce) { .hq-archive > summary::before { transition: none; } }`.
- [ ] **Step 4: Run it to see it pass.** `npx vitest run src/pages/Avengers.test.js src/components/avengers/world/labels.test.js`. Expected: both pass; PR 2’s “says only what is true” still finds no `army`. Then `npx eslint src/pages/Avengers.jsx src/pages/Avengers.test.js`. Expected: no output (no unused import).
- [ ] **Step 5: Commit.** `git add src/pages/Avengers.jsx src/pages/Avengers.test.js src/styles/lazy/avengers.css`. Subject: `Avengers HQ: order the page: the board, the worlds, Titan, a closed Archive, then the credits`. Body: the second intro goes (its clip is on the soundboard); the soundboard, the GIPHY scenes and the photos are one Archive, closed by default, so nothing is fetched from GIPHY until it opens.

### Task 6: Verify the PR and open it

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr5/README.md`, plus the pictures it lists (`.webp` or `.png`, each under 1 MB, committed as PRs 1–4’s are)

**Interfaces:**
- Consumes: Tasks 1–5; `$S/closure.mjs`, `$S/hq-pr5-check.mjs` and the before files.
- Produces: the pull request, and for PRs 6 and 7 what Global Constraints lists under “What later PRs rely on”.

- [ ] **Step 1: The gates.** Run `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build | tee $S/health-after.txt`, then `git checkout public/github.json`. Expected:
  - lint clean, with no new `eslint-disable`;
  - every test file passes and none is skipped (record the counts against `$S/tests-before.txt`);
  - `✓ built`, with `pack-check` passing;
  - `within budget`, with `big-files`, `boundary-breaks`, `kbd-styles`, `loops`, `renderers` and `hud-kit` as in `$S/health-before.txt`.

  Don’t ratchet a budget: the steward does it after the merge.
- [ ] **Step 2: The `/avengers` closure.** Run `npx vite build && node $S/closure.mjs | tee $S/closure-after.txt; git checkout public/github.json`. Expected: a few kB above `$S/closure-before.txt`; the board, its readers and `hq/gameScreen.js` join. Zero files means the page’s key isn’t `src/pages/Avengers.jsx`: grep the manifest for it.
- [ ] **Step 3: Nothing shared changed.** `git diff --stat origin/main -- src/components/avengers/hq src/runtime`. Expected: no output. So `scripts/inv-world-check.mjs` is not run (§12 runs it when `hq/` changes); say so in the PR.
- [ ] **Step 4: The links and the board in a browser.** With `npx vite --port 5173 --strictPort` up:
  - `OUT=$S/links node scripts/hq-links-check.mjs` and `OUT=$S/links-3d node scripts/hq-links-check.mjs --3d`. Expected: `all ok` both times. Count the `ok` lines for the PR.
  - `OUT=$S/after node $S/hq-pr5-check.mjs height air try3d order records hud go phone after | tee $S/check-after.txt`. Expected: `ok` for every part, then `all ok`. Read `pr5-air.png`, `pr5-records.png` and `pr5-phone.png`. The map is on top, the board under it, the cards in one column on the phone, and no text over the 3D.
  - `OUT=$S/hq-after node scripts/hq-world-check.mjs`. Expected: `compound up in … s` and `no page errors`. Its nine shots match `$S/hq-before` by eye: the board is below the stage, and with no achievements the gate’s marker is as it was.
  - Stop the server.
- [ ] **Step 5: The pages, after.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr5`, then `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr5-phone --phone`. Expected: each ends `ok   everything green`.
  - Read `avhq-pr5-a.webp` beside `$S/avhq-pr5-before.webp`: the compound is unchanged on top. Read `-b.webp` (`/invincible`): unchanged.
  - Read the phone pair.
  - Move the pictures into the evidence folder, then `git checkout public/github.json`. `git status --short public/changes` is empty.
- [ ] **Step 6: The evidence README** at `docs/superpowers/evidence/avengers-hq/pr5/README.md`:
  - one line a picture: what it shows, before or after;
  - the numbers, before → after:
    - the `/avengers` closure (files, raw, gzip);
    - the page’s height on a phone without 3D (`$S/height-before.txt` → after);
    - the test files and tests;
    - the health metrics (unchanged);
    - `hq-links-check.mjs`’s `ok` lines in 2D and in 3D;
  - each `$S/hq-pr5-check.mjs` part and its result.

  Commit with the subject `Avengers HQ PR 5: the evidence`.
- [ ] **Step 7: Draft #1028, again.** `gh pr view 1028 --json state`.
  - Merged since the branch was cut: `git merge origin/main` (never a rebase), then rerun Step 1.
  - Still open: name this PR’s one tip in `guide/pages.js` in the PR body, for its owner.
- [ ] **Step 8: Open the pull request.**
  - `git push -u origin claude/avengers-hq-pr5-ops-board`, then open the PR with base `main` and title `Avengers HQ 5 of 7: the ops board and records`.
  - The body:
    - one paragraph each on the board and its records (read unregistered, rewriting nothing), the cards (Play with the page’s state, Go there, Try 3D), the no-3D view (map on top, pins to cards) and the page’s order with the closed Archive;
    - **for the owner:** a card’s Try 3D turns on that game’s own 3D, never the site’s. The no-3D notice no longer has “Turn 3D on”: it offers Settings when 3D was switched off there, a retry when the site is on auto, and loading a held world. Ask whether that is what he wants;
    - the numbers table from Step 6;
    - the checks that ran (Steps 1–5) with their results, and why `inv-world-check` did not run;
    - the screenshots as images from `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/claude/avengers-hq-pr5-ops-board/docs/superpowers/evidence/avengers-hq/pr5/<file>`: `/avengers` before and after, the no-3D view with the map and the board, the records strip with a returning visitor’s saves, the phone, the Archive closed;
    - for PRs 6 and 7: `readBest` and its `text`, the `Link` import gone from `Avengers.jsx`, `FLAT_READY` and the assertions PR 7 moves;
    - the plan’s path and the harness’s PR footer.
  - It is one PR, merged with a merge commit once CI is green. Never force-push; a requested change is a new commit.

---

## Self-review against the spec

- **§6, where:** Task 4 puts the board right under `section#hq-world` in both modes. Task 5 removes the second intro, and Task 4 replaces the cards. Without 3D, the map stays on top and its pins scroll to and focus their cards (Task 4; browser `air`).
- **§6, one card a building:** Tasks 2 and 3 cover all eight in the tour’s order, with:
  - the place and the game (“Thwip!” from PR 3);
  - the stone, won or half won in `stoneLine`’s words, or “won in the 3D game” with Try 3D;
  - the best from each game’s own key, and Ricochet’s stars;
  - Play by its link with `hqState`, and Go there only in 3D.
- **§6, the records strip:** stones of six, the tour, best style, backpacks of twelve and the fourteen Avengers achievements, plus Things to do. All are read through `localSaves().get`, unregistered, and a test proves nothing is rewritten (Tasks 2 and 3).
- **§6, Try 3D:** per game through `writeLocal3D`, then the link (Task 4). Nothing calls `three.set` (Task 4’s source pin; browser `try3d`).
- **§6, 8/8:** PR 2’s; Task 1 adds `count`, and the HUD and the board both show it (browser `hud`).
- **§6, the page under the board:** Task 5 (source order; browser `order`, Archive closed and no GIPHY fetch until it opens).
- **§3:** nothing drawn but text, dots in the stones’ colours and a chevron. No key renamed or added. Nothing under `hq/` or `runtime/` changed (Task 6 Step 3). The house’s `.btn` and `.chip` at 44 px on a coarse pointer. Copy in the house style.
- **§12:**
  - Vitest: `progress()` reaching 8/8 through `count` (Task 1), the readers and cards (Task 2), the board (Task 3).
  - Browser: autopilot-check before, after and `--phone` with `/invincible`; `hq-world-check`; `hq-links-check` both ways; no console errors.
  - The closure stated (Task 6).
  - `inv-world-check` is not needed, and Task 6 Step 3 proves it.
- **Cross-check fixes applied:**
  - PR 2 owns 8/8, so Task 1 only appends `count`, sets `CompoundHud.jsx:29` to `prog.count` and tests the count. There is no `DONE_BY`, no signature change and no `CompoundWorld` edit.
  - `HALF_OF` is imported from PR 2, and `stoneLine(p)` gives the gate’s lines (and the won lines, so the HUD and the board agree).
  - `gameOf` comes from PR 3 with “Thwip!”; there is no `links.js` edit.
  - The board’s `Link` carries `hqState`, pinned by an element-tree walk (Task 3).
  - `hq-links-check.mjs`’s `CARD` and `PLAY` move to `#hq-card-<id>` and `a.btn-primary` in the PR that deletes the cards, and it is rerun, `--3d` once (Tasks 4 and 6).
  - A card’s Try 3D is per game (`writeLocal3D` and the link). The compound’s retry is offered only when the site’s mode is `'auto'`, and this is flagged for the owner (Tasks 4 and 6).
  - `readBest`’s shape, the `Link` import’s removal, `FLAT_READY` and the assertions PR 7 moves are all recorded for PRs 6 and 7 (Global Constraints).
- **Ordering:** after PR 4 (`GAME_AT`, `writeLocal3D`, `fmt`, `switchFor`) and before PR 6 (`readBest`).
