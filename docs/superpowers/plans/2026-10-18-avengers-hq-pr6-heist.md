# Avengers HQ PR 6: the heist record and the earned snap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/avengers` the snap is earned. The gauntlet shows only the stones won in play and can’t be toggled. While it is locked, the page says how many stones are left and links to the next building. A new record, `tp-hq-heist`, keeps when each stone was first won and how many tries each game took, and Tony’s earned snap raises a summary of it on glass over Titan’s dust. This is PR 6 of the seven in spec §11.

**Architecture:**
- `hq/heist.js` is the record’s pure rules: it cleans and migrates what was stored and adds a first win or a try. It also words the summary. It imports nothing, so `hq/stones.js` → `hq/heist.js` is the only edge and no import cycle is added. `hq/stones.js` is the glue: `earnStone` writes the first-win time, `recordTry(placeId)` counts a start and `heistRecord()` reads the record, all through a `runtime/saves` instance registered at version 1.
- `titan/gate.js` is the snap’s pure gate over `progress()` and PR 3’s links. `Titan.jsx` loses its socket buttons (they were the toggle). `Avengers.jsx` draws the read-only list, the locked line and the Next link, and holds the summary’s state.
- `titan/HeistSummary.jsx` is text on a glass panel, laid over the existing scene. Titan’s `scene.js`, `models.js` and `module.js` are not touched, and nor is the classic page’s free gauntlet.

**Tech Stack:** React 19, react-router-dom 7 (`Link`, `HashRouter`), `src/runtime/saves.js` (`createSaves`, `register`), Vitest 5 in the node environment (components rendered with `react-dom/server`, the page checked by its source), Vite 8 (its manifest at `dist/.vite/manifest.json`), playwright-core 1.56 under a scratch browser script.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md` (as amended in `30dd1241`): §7 (the heist and the finale), §3 (rules kept), §11 step 6 and §12 (the checks). The spec wins over any brief. PR 6 of 7; the index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`.

## Global Constraints

- **Order.** PR 6 of 7, merged in order. Branch from `origin/main` with PRs 1–5 merged. It consumes only these:
  - PR 1: `PLACES`, `placeById(id)` and `progress` through the `world/rules.js` barrel. Ids in order: `stark`, `thor`, `cap`, `hawkeye`, `widow`, `banner`, `spidey`, `vault`.
  - PR 2: `progress(earned = [], unlocked = [])` (this PR passes only `earned`; it reads `.next`, a place id with a stone or `null`, and `.stones`, whole stones 0–6). `HoldTheLawn.jsx`’s `begin(open)`, which both `start` and `startBoss` call. The notify text `'Every stone, won back on the compound. Thanos is dust; this page is not.'`, kept. `labels.test.js`’s `not.toMatch(/army/)` on `Avengers.jsx`.
  - PR 3: `linkOf(id) → '/avengers/<slug>' | null` and `hqState = { hq: true }` from `world/links.js`; `scripts/hq-links-check.mjs [--3d]`, whose last line is `all ok`.
  - PR 4: Repulsor’s `start()` begins `if (!startable(stage.status)) return;`. Every game’s results card calls the game’s own start (`start`, `begin(0)`, `enter(index)`, `start(leg)`), so a try counted in the start covers Play again.
  - PR 5: `readBest(id, get) → { score, text, stars } | null` in `board/records.js` (text like `'Best 12,345'`, `'3 of 12 rooms'`). PR 5 deleted `import { Link } from 'react-router-dom'` from `Avengers.jsx`, and this PR adds it back. Also `src/pages/Avengers.test.js`, the page’s source guard.
- **Line numbers** are `main` at `ddb364bf`. PRs 2, 4 and 5 move lines in `Avengers.jsx`, the eight games and `avengers.css`, so find each place by the quoted text. `hq/stones.js`, `hq/hq.test.js`, `titan/Titan.jsx` and `runtime/saves.js` are as they were at `ddb364bf`.
- **The record (§7), exactly:** `tp-hq-heist`, registered with `runtime/saves` at version 1, holding `{ stones: { [id]: firstWonAt }, tries: { [game]: n } }`. `earnStone` writes the time a stone is first won, and each game’s start writes a try. Old visitors who already hold stones get `firstWonAt: null` for them, and the summary says “before records began” for those.
- **Decisions the spec leaves open:**
  - `tries` is keyed by place id (`stark` … `vault`), the key `PLACES`, the links and the board already share.
  - Only the six whole stones are timed. Soul’s time is the moment its second half lands.
  - `runtime/saves` never migrates a missing key (`saves.js:62-63`), so the migration from no key happens on read (`loadHeist` merges every held stone as `null`) and is stored with the first write. Reading never writes a missing key.
  - `firstWonAt` is the first win ever: `forgetStones` (tests only) leaves `tp-hq-heist` alone.
- **The finale (§7).** On `/avengers` the gauntlet shows the stones won in play (`earnedStones()`) and cannot be toggled. Locked, it says how many stones are left and links to the next building. All six won: Snap plays Tony’s snap as today. The free Thanos snap (`useFun().snap`, the `'iAmInevitable'` clip) leaves this page. It lives on in the classic card, the typed “snap” egg and the soundboard.
- **Untouched (§7).** The classic page’s free gauntlet: `src/components/interests/*` and `src/styles/extras.css`. Titan’s scene: `titan/scene.js`, `titan/models.js` and `titan/module.js`. Task 4 proves both with a `git diff`.
- **Content (§3).** Nothing here draws a figure, suit or mark of any Marvel character. The summary is text on a plain glass panel and the list is text and the stones’ existing colours. The gauntlet drawing is the existing one.
- **Copy (RULES.md UI 7).** British spelling, curly quotes (’ “ ”) inside strings, sentence case, no Oxford comma. No “army” (PR 2’s test).
- **Keys and hooks (§3).** `tp-hq-stones` keeps its name and shape (a JSON array of ids), pinned in Task 2. The one new key is `tp-hq-heist`. `__HQ__` and `__HQWORLD__` keep every name, and `__HQ__.titan.view` still exposes `dusting`.
- **Shared code (§3).** `hq/` is shared with Invincible, Mario 64 and the Marvel landing. This PR changes `hq/stones.js` and adds `hq/heist.js`, which none of them import, so `scripts/inv-world-check.mjs` and the FL2 shots of `thinkmark`, `viewer` and `invworld` must stay identical (Task 6).
- **UI (RULES.md UI).** The summary is a page panel over the 3D: glass at alpha 0.78 or more, no blur, nothing under 0.7 rem, every hard-coded value commented. No bare `z-index` of 10 or more. No new `kbd` rule.
- **Limits.** Files under 800 lines (`TesseractRun.jsx` is 792 at `ddb364bf`: check it with `wc -l` after Task 3). No new dependency, renderer or animation loop. No edit to `src/components/guide/pages.js` or `src/runtime/hud/*` (open draft #1028).
- **Tests.** Beside their files, each under one second, no network. No test is skipped, loosened or deleted.
- **Commits.** A plain sentence as the subject; the body says why; end with the harness’s attribution lines. No model names anywhere. Never force-push.
- **What PR 7 relies on.**
  - `recordTry(placeId)` from `hq/stones.js`: `RicochetFlat` calls `recordTry('cap')` in its `enter`, and `InfiltrationFlat` calls `recordTry('widow')` in its `enter` and in its caught auto-reset.
  - The `STARTS` rows in `hq/heist.test.js`, `[placeId, file, startCallback, callsInFile]`. PR 7 appends `['cap', 'ricochet/Flat.jsx', 'enter', 1]` and `['widow', 'widow/Flat.jsx', 'enter', 2]`.

## Review Focus

1. **A returning visitor’s record.** Stones won before the record existed, a `tp-hq-heist` that holds junk (raw or inside a `{ v: 1, data }` wrapper) or storage that throws in a private window. Nothing throws, junk is dropped, those stones read “Before records began” and reading never writes a missing key. Pinned in Task 1 (“keeps the record through runtime/saves…”, with the wrapped-junk assertion) and Task 2 (“keeps no record, and never throws, when storage is blocked”).
2. **Half a Soul Stone.** With only Clint’s half held, the Soul Stone doesn’t count: the line reads “1 stone left”, Next is Operations and the list says the Soul Stone is not yet won. Soul’s time is when the second half lands. Pinned in Task 2 (“writes when each stone was first won…”) and Task 4 (“counts a half of the Soul Stone as no stone…”).
3. **A click that starts nothing new.** Suit up before the stage is on, Thwip’s title-screen demo, Tesseract’s Legs button and Trick Shot’s second and third rounds count no try. Pinned in Task 3 (“counts no try for a click that starts nothing new”, and the per-file call counts).
4. **Next from the locked gauntlet, then Back.** The game opens over the compound. Back returns to `/avengers` by a pop, not a replace, so there is no duplicate entry and a second browser Back leaves for the page before. Pinned in Task 4 (the page’s source check for `state={hqState}`, and the browser part `next`).
5. **The summary on a phone, with reduced motion and without 3D.** At 390 × 844 the panel fits inside the 4:3 stage and scrolls. Nothing in it is under 0.7 rem, and focus lands on its title. With reduced motion it appears without rising, and without 3D it sits over the gauntlet drawing. Pinned in Task 5 (the title’s focus in `HeistSummary.test.jsx`, and the browser parts `summary` and `flat`).

---

## Files

| File | Task | Responsibility |
| --- | --- | --- |
| `src/components/avengers/hq/heist.js` + `.test.js` | 1, 3 | pure record rules and the summary’s words; the test also pins every game’s try |
| `src/components/avengers/hq/stones.js`, `hq/hq.test.js` | 2 | `earnStone` writes first wins; `recordTry`, `heistRecord` |
| the eight games (`repulsor/RepulsorRange.jsx`, `lawn/HoldTheLawn.jsx`, `ricochet/Ricochet.jsx`, `trickshot/TrickShot.jsx`, `widow/Infiltration.jsx`, `smash/SmashRun.jsx`, `thwip/Thwip.jsx`, `tesseract/TesseractRun.jsx`) | 3 | one `recordTry` where a run starts |
| `src/components/avengers/titan/gate.js` + `.test.js` | 4 | `snapGate`, `HEIST_ROWS` |
| `src/components/avengers/titan/Titan.jsx` | 4 | no socket buttons, no `onSet` |
| `src/pages/Avengers.jsx`, `src/pages/Avengers.test.js` | 4, 5 | the earned gauntlet, the locked line, Next, the summary’s state |
| `src/components/avengers/titan/HeistSummary.jsx` + `.test.jsx` | 5 | the panel |
| `src/styles/lazy/avengers.css` | 4, 5 | read-only stone rows, dead socket rules out, the glass panel |
| `docs/architecture.md` | 5 | one sentence |
| `docs/superpowers/evidence/avengers-hq/pr6/` | 6 | README and pictures |

### Before Task 1: the before numbers

- [ ] **Branch and check PRs 1–5 are in.** Run `git fetch origin main && git switch -c claude/avengers-hq-pr6-heist origin/main`. Then run `ls src/components/avengers/world/links.js src/components/avengers/board/records.js src/pages/Avengers.test.js scripts/hq-links-check.mjs` and `grep -n "export function readBest\|export const hqState" src/components/avengers/board/records.js src/components/avengers/world/links.js`. Then run `grep -n "if (!startable(stage.status)) return;" src/components/avengers/repulsor/RepulsorRange.jsx` and `grep -n "const begin = useCallback" src/components/avengers/lawn/HoldTheLawn.jsx`. Expected: four paths, then one line from each grep. `S` below is the session’s scratchpad directory, never under the repo.
- [ ] **The closure, before.** Save PR 1’s manifest script (`2026-10-18-avengers-hq-pr1-splits.md`, Task 1 Step 2) as `$S/closure.mjs`, unchanged. Run `npx vite build && node $S/closure.mjs | tee $S/closure-before.txt; git checkout public/github.json`. Expected: one total line, close to PR 5’s stated size.
- [ ] **The pages, before.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr6 --before`, then the same with `--shots avhq-pr6-phone --phone`. Move `public/changes/avhq-pr6*-before.webp` to `$S/`. Expected: each run ends `everything green`.
- [ ] **The tests, before.** Run `npx vitest run src/components/avengers src/pages 2>&1 | tail -4 | tee $S/tests-before.txt`. Expected: all pass. Keep the counts for the PR.
- [ ] **The worlds and links, before.** With `npx vite --port 5173 --strictPort` up, run `OUT=$S/links-before node scripts/hq-links-check.mjs` and `OUT=$S/inv-before node scripts/inv-world-check.mjs`. Expected: `all ok`, then `no page errors`.
- [ ] **Write the scratch browser script** `$S/hq-pr6-check.mjs` (not committed). Run it as `node $S/hq-pr6-check.mjs <part…> <when>`, where `<when>` is `before` or `after`. It prints `ok <part>` or `FAIL <part>: <why>` for each part, ends `all ok` or `N problems` and exits 1 on any FAIL.
  - **Launch.** Copy `scripts/hq-links-check.mjs`’s chromium launch and init block. Base `http://localhost:5173/?quality=low#`. Use a fresh context per part, at 1440 × 900 unless the part says otherwise. Init `tp-intro` = `'1'` and `tp-worlds` = `'"load"'`. Set `tp-3d` = `'on'` (raw, as `lib/gpu.js` stores it) unless the part says otherwise, plus the part’s own keys. Count every console error not in `scripts/lib/noise.mjs`’s noise as a FAIL of the part.
  - **Fixtures.**
    - `ALL` = `'["power","reality","mind","soul-clint","soul-natasha","soul","time","space"]'`.
    - `HEIST` = `'{"v":1,"data":{"stones":{"power":1760000000000,"mind":1760003600000,"reality":1760007200000,"time":1760010800000,"space":1760086400000,"soul":1760094000000},"tries":{"stark":4,"thor":2,"cap":1,"hawkeye":3,"widow":5,"banner":2,"vault":6}}}'`. The span from the first stone to the sixth is 94,000,000 ms, which reads “1 day 2 hours”.
  - **`locked`** (`tp-hq-stones` = `'["power","mind"]'`): open `#/avengers` and scroll `#thanos` into view.
    - Pass: the `#thanos` button reading `Snap` is `disabled`, with `aria-describedby="snap-left"`, and `#snap-left` reads `4 stones left`.
    - Pass: an `a` reading `Next: Mjolnir` has `href="#/avengers/lawn"`.
    - Pass: `#thanos button.socket, #thanos .stone-list button` matches nothing, and `.stone-list li[data-on]` matches 2.
    - Screenshot `#thanos` to `$S/titan-locked-<when>.png`.
  - **`next`** (the same keys): open `#/avengers` and record `history.state.idx`. Click `Next: Mjolnir`.
    - Pass: the hash is `#/avengers/lawn`, and the open game’s title (the element named by `.cw-place`’s `aria-labelledby`) reads `Mjolnir`.
    - Click the button in `.cw-place` whose text starts `Back`. Pass: the hash is `#/avengers`, `history.state.idx` equals the recorded value (a pop, not a second `/avengers` entry) and `.cw-place` is gone.
  - **`tries`** (`tp-hq-stones` = `'[]'`, no `tp-hq-heist`):
    - Open `#/avengers/workshop`, wait up to 240 s for `.hq-canvas[data-on]` and run `__HQ__.repulsor.start()` twice.
    - Open `#/avengers/lawn`, wait the same way and run `__HQ__.lawn.checkpoint()`.
    - Pass: `JSON.parse(localStorage.getItem('tp-hq-heist'))` deep-equals `{ v: 1, data: { stones: {}, tries: { stark: 2, thor: 1 } } }`, and `tp-hq-stones` is still `'[]'`.
  - **`summary`** runs at 1440 × 900, then at 390 × 844 with `isMobile` and `hasTouch`. Keys: `tp-hq-stones` = `ALL`, `tp-hq-heist` = `HEIST`, `tp-hq-repulsor-best` = `'12345'`, `tp-hq-ricochet` = `'{"reached":4,"stars":[3,2,1]}'`.
    - Open `#/avengers`, scroll to `#thanos` and wait up to 240 s for `.titan-canvas[data-on]`. Click `Snap: I am Iron Man`, wait until `__HQ__.titan.view.dusting` is true, then wait 1.5 s.
    - Pass, the content: `.heist-summary` holds `First stone to sixth` and `1 day 2 hours`, and `.heist-summary tbody tr` matches 7. The row for `Tony Stark’s workshop` reads `4 tries` and `12,345`, and the row for `The training center` reads `1 try` and `3 of 12 rooms`.
    - Pass, the fit: `document.activeElement.id` is `heist-summary-title`. The panel’s box lies inside `.gauntlet-stage`’s, its `scrollWidth` is at most its `clientWidth` and no element in it has a computed font size under 11.2 px.
    - Pass: `JSON.parse(localStorage.getItem('tp-achievements'))` includes `whatever`.
    - Screenshot `#thanos .gauntlet-stage` to `$S/summary-<width>-<when>.png`. Click `Close the heist summary`. Pass: `.heist-summary` is gone.
  - **`migration`** (`tp-hq-stones` = `ALL`, no `tp-hq-heist`): the same snap. Pass: the span and all seven Tries cells read `Before records began`. Afterwards, `localStorage.getItem('tp-hq-heist')` is `null`. Screenshot `#thanos .gauntlet-stage` to `$S/migration-<when>.png`.
  - **`flat`** (`tp-3d` = `'off'`, `tp-hq-stones` = `ALL`, `tp-hq-heist` = `HEIST`, the context made with `reducedMotion: 'reduce'`): open `#/avengers` and scroll to `#thanos`.
    - Pass: `.gauntlet-wrap svg.gauntlet` is visible and there is no `.titan-canvas`.
    - Click `Snap: I am Iron Man`. Pass: `.heist-summary` is visible within 300 ms, and its computed `animation-name` is `none`.
  - **`free`**: open `#/home` and scroll the Marvel interests card’s `.gauntlet-sockets` into view. Click its first `button.socket`.
    - Pass: the card reads `<that stone’s name> set. 5 to go.`.
    - Click the other five. Pass: the card’s `Snap` button is enabled.
- [ ] **Run it, before.** With the dev server still up, run `node $S/hq-pr6-check.mjs locked free before`. Expected: `FAIL locked` (the stone list has Set buttons and there is no Next link), `ok free` and `1 problems`. Keep `$S/titan-locked-before.png`; it is the PR’s before picture. Stop the server.

---

### Task 1: The heist record’s pure rules

**Files:**
- Create: `src/components/avengers/hq/heist.js`, `src/components/avengers/hq/heist.test.js`

**Interfaces:**
- Consumes: `createSaves({ local, session }) → { get(key, fallback), set(key, value), register({ key, version, migrate }) }` (`src/runtime/saves.js:36-95`). In the test only: `STONE_IDS` (`hq/stones.js:11`) and `PLACES` (the `world/rules.js` barrel).
- Produces, in `hq/heist.js` (which imports nothing):
  - `HEIST_KEY = 'tp-hq-heist'`, `HEIST_VERSION = 1` and `BEFORE = 'Before records began'`.
  - `HEIST_STONES = ['space', 'mind', 'reality', 'power', 'time', 'soul']` and `HEIST_GAMES = ['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'spidey', 'vault']`.
  - `cleanHeist(raw) → { stones: { [stone]: number | null }, tries: { [placeId]: number } }`.
  - `migrateHeist(raw, held = []) → record`.
  - `withStone(rec, id, at) → record` and `withTry(rec, game) → record`.
  - `registerHeist(saves) → void` and `loadHeist(saves, held = []) → record`.
  - `spanWords(ms) → string`.
  - `heistSummary(rec, { games: { id, name }[], bests = {} }) → { span: string, rows: { id, name, tries, best }[] }`.

- [ ] **Step 1: Write the failing tests** in `hq/heist.test.js`. Import `{ describe, expect, it }` from `vitest`, `createSaves` from `'../../../runtime/saves'`, `PLACES` from `'../world/rules'`, `STONE_IDS` from `'./stones'` and every name above from `'./heist'`. Copy `store()` from `src/runtime/saves.test.js:4-7`.

```js
const M = 60e3, H = 60 * M, D = 24 * H;
const games = [{ id: 'stark', name: 'Tony Stark’s workshop' }, { id: 'cap', name: 'The training center' }];

describe('the heist record', () => {
  it('names its key, its version and the stones and games it keeps', () => {
    expect(HEIST_KEY).toBe('tp-hq-heist');
    expect(HEIST_VERSION).toBe(1);
    expect(HEIST_STONES).toEqual(STONE_IDS);
    expect(HEIST_GAMES).toEqual(PLACES.map((p) => p.id));
  });
  it('keeps the time a stone was first won, never a later one', () => {
    const empty = cleanHeist(null);
    const a = withStone(empty, 'power', 1000);
    expect(a).toEqual({ stones: { power: 1000 }, tries: {} });
    expect(empty).toEqual({ stones: {}, tries: {} });
    for (const id of ['power', 'soul-clint', 'aether']) expect(withStone(a, id, 5000)).toBe(a);
  });
  it('counts a try per start, for the eight games only', () => {
    const r = withTry(withTry(withTry(cleanHeist(null), 'stark'), 'stark'), 'vault');
    expect(r.tries).toEqual({ stark: 2, vault: 1 });
    expect(withTry(r, 'nowhere')).toBe(r);
  });
  it('cleans junk out of what was stored', () => {
    for (const junk of ['{not a record', ['power'], { stones: null, tries: 'x' }, 42]) expect(cleanHeist(junk)).toEqual({ stones: {}, tries: {} });
    expect(cleanHeist({ stones: { power: 5, mind: null, aether: 3, time: 'soon', space: -1 }, tries: { stark: 2.7, thor: -1, nowhere: 4, cap: 'x' } }))
      .toEqual({ stones: { power: 5, mind: null }, tries: { stark: 2 } });
  });
  it('gives stones held before records began no time (the migration from no key)', () => {
    expect(migrateHeist(null, ['power', 'mind', 'soul-clint'])).toEqual({ stones: { power: null, mind: null }, tries: {} });
    expect(migrateHeist({ stones: { power: 7 }, tries: {} }, ['power', 'time'])).toEqual({ stones: { power: 7, time: null }, tries: {} });
  });
  it('keeps the record through runtime/saves at version 1', () => {
    const local = store();
    const saves = createSaves({ local, session: store() });
    registerHeist(saves);
    expect(loadHeist(saves, ['space'])).toEqual({ stones: { space: null }, tries: {} });
    expect(local.map.has('tp-hq-heist')).toBe(false); // reading writes nothing
    saves.set(HEIST_KEY, withTry(loadHeist(saves, ['space']), 'cap'));
    expect(JSON.parse(local.getItem('tp-hq-heist'))).toEqual({ v: 1, data: { stones: { space: null }, tries: { cap: 1 } } });
    local.setItem('tp-hq-heist', JSON.stringify({ stones: { mind: 9, x: 1 }, tries: {} })); // unversioned
    expect(loadHeist(saves)).toEqual({ stones: { mind: 9 }, tries: {} });
    expect(JSON.parse(local.getItem('tp-hq-heist')).v).toBe(1);
    local.setItem('tp-hq-heist', JSON.stringify({ v: 1, data: { stones: { power: 'x', time: 4 }, tries: { stark: -3, vault: 2 } } }));
    expect(loadHeist(saves)).toEqual({ stones: { time: 4 }, tries: { vault: 2 } });
  });
});

describe('the heist summary', () => {
  it('says a span in days, hours and minutes', () => {
    for (const ms of [20e3, -5, NaN]) expect(spanWords(ms)).toBe('Under a minute');
    expect(spanWords(M)).toBe('1 minute');
    expect(spanWords(42 * M)).toBe('42 minutes');
    expect(spanWords(H)).toBe('1 hour');
    expect(spanWords(3 * H + 12 * M)).toBe('3 hours 12 minutes');
    expect(spanWords(D + H)).toBe('1 day 1 hour');
    expect(spanWords(2 * D + 30 * M)).toBe('2 days');
  });
  it('times the first stone to the sixth, with tries and the best per game', () => {
    const rec = { stones: { power: 0, mind: H, reality: 2 * H, time: 3 * H, space: D, soul: D + 2 * H }, tries: { stark: 4, cap: 1 } };
    expect(heistSummary(rec, { games, bests: { stark: '12,400' } })).toEqual({
      span: '1 day 2 hours',
      rows: [
        { id: 'stark', name: 'Tony Stark’s workshop', tries: '4 tries', best: '12,400' },
        { id: 'cap', name: 'The training center', tries: '1 try', best: 'No best kept' },
      ],
    });
  });
  it('says “before records began” for what was won before the record', () => {
    const rec = migrateHeist({ stones: { space: 5 * D }, tries: { stark: 2 } }, ['power', 'mind', 'reality', 'time', 'soul', 'space']);
    const s = heistSummary(rec, { games });
    expect(BEFORE).toBe('Before records began');
    expect(s.span).toBe(BEFORE);
    expect(s.rows.map((r) => r.tries)).toEqual(['2 tries', BEFORE]);
  });
  it('writes its copy in sentence case, with no straight quotes', () => {
    const s = heistSummary(cleanHeist(null), { games });
    for (const t of [s.span, ...s.rows.flatMap((r) => [r.tries, r.best])]) {
      expect(t).toMatch(/^[A-Z0-9]/);
      expect(t).not.toMatch(/["']/);
      expect(t).not.toMatch(/\.$/);
    }
  });
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/hq/heist.test.js`. Expected: `Failed to resolve import "./heist"`, `Test Files 1 failed`.
- [ ] **Step 3: Write `hq/heist.js`** with the constants and functions in Interfaces.
  - **Header comment.** What `tp-hq-heist` holds, that it is kept through `runtime/saves` at version 1 and that the file is pure. It imports nothing, not even `./stones`, so `stones.js → heist.js` is the only edge and the measure’s `cycles` doesn’t move. That is why `HEIST_STONES` copies `STONE_IDS`, and a test holds them equal.
  - **`cleanHeist(raw)`.** A non-object or an array gives `{ stones: {}, tries: {} }`. `stones` keeps only `HEIST_STONES` keys whose value is `null` or a finite number ≥ 0. `tries` keeps only `HEIST_GAMES` keys whose value is finite, as `Math.floor(n)` when that is ≥ 1.
  - **`migrateHeist(raw, held)`.** Starts from `cleanHeist(raw)`, then sets each `held` id that is in `HEIST_STONES` and missing from `stones` to `null`.
  - **`withStone` and `withTry`.** Each returns `rec` itself when nothing changes: `id` not a whole stone or already a key, or `game` not in `HEIST_GAMES`. Otherwise it returns a shallow copy with the one field set (`at`) or incremented (from 0).
  - **`registerHeist(saves)`** is `saves.register({ key: HEIST_KEY, version: HEIST_VERSION, migrate: (old) => cleanHeist(old) })`. The registered `migrate` only cleans an unversioned stored value.
  - **`loadHeist(saves, held)`** is `migrateHeist(saves.get(HEIST_KEY, null), held)`. It cleans even a wrapped value, so a `{ v: 1, data: junk }` reads clean.
  - **`spanWords(ms)`.** `!(ms >= 60e3)` gives `'Under a minute'`. Under an hour: minutes. Under a day: hours, plus `' N minutes'` when there are any. Otherwise: days, plus `' N hours'` when there are any. Floor every unit and use `1 minute`, `1 hour` and `1 day` in the singular.
  - **`heistSummary(rec, { games, bests })`.** `span` is `spanWords(max − min)` when all six `HEIST_STONES` values are finite, else `BEFORE`. Each row is `` tries: n >= 1 ? (n === 1 ? '1 try' : `${n} tries`) : BEFORE `` and `best: bests[id] ?? 'No best kept'`.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run src/components/avengers/hq/heist.test.js`. Expected: `Tests  10 passed (10)`, each well under 1 s.
- [ ] **Step 5: Commit.** Run `git add src/components/avengers/hq/heist.js src/components/avengers/hq/heist.test.js`. Subject: `Avengers HQ: the heist record’s rules: first wins, tries and the summary’s words`. Body: `tp-hq-heist` is kept at version 1 through `runtime/saves`; stones held before the record have no time (spec §7).

### Task 2: `hq/stones.js` writes the record

**Files:**
- Modify: `src/components/avengers/hq/stones.js:1-4` (the header), `:5` (the imports), `:44-62` (`earnStone`) and new exports after `:71`
- Test: `src/components/avengers/hq/hq.test.js:3` (the import), and four tests appended in `describe('the stone heist')` after “forgets everything on request” (`:101-105`)

**Interfaces:**
- Consumes: Task 1’s `HEIST_GAMES`, `HEIST_KEY`, `loadHeist`, `registerHeist`, `withStone` and `withTry`; `createSaves` from `'../../../runtime/saves'`.
- Produces, in `hq/stones.js`:
  - `heistRecord() → { stones, tries }`: the record read, with the stones held before it began as `null`. It never writes.
  - `recordTry(game: string) → void`: counts one start for a place id in `HEIST_GAMES` and ignores any other id. It dispatches no event and never throws.
  - `earnStone(id) → boolean`, unchanged in what it returns and dispatches. It now also writes the first-win time of a whole stone it completes.

- [ ] **Step 1: Write the failing tests.** Add `heistRecord` and `recordTry` to the `'./stones'` import at `hq.test.js:3`, then append:

```js
it('writes when each stone was first won to the heist record, and adds no event', () => {
  const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
  earnStone('power');
  now.mockReturnValue(9000);
  earnStone('power');
  earnStone('soul-clint');
  now.mockReturnValue(12000);
  earnStone('soul-natasha');
  expect(heistRecord()).toEqual({ stones: { power: 1000, soul: 12000 }, tries: {} });
  expect(JSON.parse(window.localStorage.getItem('tp-hq-heist')).v).toBe(1);
  expect(JSON.parse(window.localStorage.getItem('tp-hq-stones'))).toEqual(['power', 'soul-clint', 'soul-natasha', 'soul']);
  expect(window.dispatchEvent).toHaveBeenCalledTimes(2);
  now.mockRestore();
});
it('gives stones held before the record no time, and the next stone its own', () => {
  window.localStorage.setItem('tp-hq-stones', JSON.stringify(['power', 'mind']));
  expect(heistRecord()).toEqual({ stones: { power: null, mind: null }, tries: {} });
  expect(window.localStorage.getItem('tp-hq-heist')).toBe(null);
  const now = vi.spyOn(Date, 'now').mockReturnValue(5000);
  earnStone('time');
  expect(heistRecord().stones).toEqual({ power: null, mind: null, time: 5000 });
  now.mockRestore();
});
it('counts a try each time a game starts', () => {
  for (const g of ['stark', 'stark', 'cap', 'nowhere']) recordTry(g);
  expect(heistRecord().tries).toEqual({ stark: 2, cap: 1 });
  expect(window.dispatchEvent).not.toHaveBeenCalled();
});
it('keeps no record, and never throws, when storage is blocked', () => {
  vi.stubGlobal('window', { get localStorage() { throw new Error('blocked'); }, dispatchEvent: vi.fn() });
  expect(() => recordTry('stark')).not.toThrow();
  expect(() => earnStone('mind')).not.toThrow();
  expect(heistRecord()).toEqual({ stones: {}, tries: {} });
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/hq/hq.test.js`. Expected: 4 failed (`heistRecord is not a function`, `recordTry is not a function`). The existing 16 still pass.
- [ ] **Step 3: Write the record from `hq/stones.js`.**
  - **The header** gains one sentence: each stone’s first win and each game’s tries are kept in the heist’s record (`./heist.js`, `tp-hq-heist`, through `runtime/saves`).
  - **Imports:** `createSaves` from `'../../../runtime/saves'`, and the six Task 1 names from `'./heist'`.
  - **Storage, per call.** `localStore()` returns `window.localStorage` inside a try, or `null`. `heistSaves()` makes `createSaves({ local: localStore() })` and calls `registerHeist` on it. `noteHeist(change, held)` takes a fresh `heistSaves()` and sets `HEIST_KEY` on it to `change(loadHeist(saves, held))`. The instance is made on each call, as `read()` and `write()` read `window` today. The cached `localSaves()` (`runtime/local.js:20-24`) would keep the first test’s stubbed storage.
  - **`earnStone`.** Straight after `write(next)` (`:54`), add `if (got) noteHeist((r) => withStone(r, got, Date.now()), STONE_IDS.filter((s) => have.includes(s)))`. It is seeded from `have`, the stones held before this win, so the new stone gets its time rather than `null`. The returns and the event are unchanged.
  - **The new exports.** `heistRecord = () => loadHeist(heistSaves(), earnedStones())`. `recordTry(game)` returns at once unless `HEIST_GAMES.includes(game)`, then runs `noteHeist((r) => withTry(r, game), earnedStones())`.
  - `forgetStones` is unchanged: the record keeps the first-ever times.
- [ ] **Step 4: Run them to see them pass.** Run `npx vitest run src/components/avengers/hq src/runtime/saves.test.js`. Expected: `hq.test.js` has 20 passed (16 + 4), `heist.test.js` has 10 and every `saves.test.js` test passes. No existing test is changed.
- [ ] **Step 5: Commit.** Run `git add src/components/avengers/hq/stones.js src/components/avengers/hq/hq.test.js`. Subject: `Avengers HQ: write the heist record when a stone is won or a game starts`. Body: `tp-hq-stones` keeps its name and shape; stones held before the record read `null`.

### Task 3: Every game counts a try where its run starts

**Files:**
- Modify (each at `ddb364bf`; find it by the quoted text):
  - `repulsor/RepulsorRange.jsx:5` and `start` (`:88-98`, which begins with PR 4’s `startable` guard);
  - `lawn/HoldTheLawn.jsx:5` and PR 2’s `begin` (once `start`, `:85-95`);
  - `ricochet/Ricochet.jsx:5` and `enter` (`:51-62`);
  - `trickshot/TrickShot.jsx:5` and `begin` (`:63-80`, inside `if (round === 0) {` at `:66-69`);
  - `widow/Infiltration.jsx:5`, `enter` (`:69-83`) and the caught reset (`:119-127`, before `game.current = newLevel(g.index);` at `:122`);
  - `smash/SmashRun.jsx:5` and `start` (`:73-84`);
  - `thwip/Thwip.jsx`: a new import after `:3` and `start` (`:57-69`);
  - `tesseract/TesseractRun.jsx:5` and `start` (`:94-116`).
- Test: `src/components/avengers/hq/heist.test.js` (a new `describe`)

**Interfaces:**
- Consumes: Task 2’s `recordTry(game)`; PR 4’s guard text `if (!startable(stage.status)) return;`; PR 2’s `begin`.
- Produces: one `recordTry('<placeId>')` where each game’s run, room, level or leg starts. Infiltration also has one in its caught reset. `STARTS` and `bodyOf` in `heist.test.js`, for PR 7 to extend.

- [ ] **Step 1: Write the failing tests.** Add `import { readFileSync } from 'node:fs';` to `heist.test.js`, then:

```js
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
// a component's `const <fn> = useCallback(`, up to its next declaration
const bodyOf = (src, fn) => {
  const at = src.indexOf(`const ${fn} = useCallback(`);
  return at < 0 ? '' : src.slice(at, src.indexOf('\n  const ', at + 1));
};
// [place id, file, the callback a run starts in, recordTry calls in the file]
const STARTS = [
  ['stark', 'repulsor/RepulsorRange.jsx', 'start', 1],
  ['thor', 'lawn/HoldTheLawn.jsx', 'begin', 1],
  ['cap', 'ricochet/Ricochet.jsx', 'enter', 1],
  ['hawkeye', 'trickshot/TrickShot.jsx', 'begin', 1],
  ['widow', 'widow/Infiltration.jsx', 'enter', 2],
  ['banner', 'smash/SmashRun.jsx', 'start', 1],
  ['spidey', 'thwip/Thwip.jsx', 'start', 1],
  ['vault', 'tesseract/TesseractRun.jsx', 'start', 1],
];

describe('every game', () => {
  it('counts a try where its run starts', () => {
    expect([...new Set(STARTS.map(([id]) => id))]).toEqual(HEIST_GAMES);
    for (const [id, file, fn, calls] of STARTS) {
      const src = read(file);
      expect(bodyOf(src, fn), file).toContain(`recordTry('${id}')`);
      expect(src.split('recordTry(').length - 1, file).toBe(calls);
    }
  });
  it('counts no try for a click that starts nothing new', () => {
    const repulsor = read('repulsor/RepulsorRange.jsx');
    const guard = repulsor.indexOf('if (!startable(stage.status)) return;');
    expect(guard).toBeGreaterThan(-1);
    expect(repulsor.indexOf("recordTry('stark')")).toBeGreaterThan(guard);
    expect(bodyOf(read('trickshot/TrickShot.jsx'), 'begin')).toMatch(/if \(round === 0\) \{[^}]*recordTry\('hawkeye'\)/);
    expect(read('widow/Infiltration.jsx')).toMatch(/recordTry\('widow'\);\s*game\.current = newLevel\(g\.index\)/);
  });
});
```

The call counts of 1 keep Thwip’s title-screen demo (`:200-201`, inside `tick`) and Tesseract’s `Legs` button (`:532`) from counting.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/hq/heist.test.js -t "every game"`. Expected: 2 failed, the first on `repulsor/RepulsorRange.jsx: expected '…' to contain "recordTry('stark')"`.
- [ ] **Step 3: Add the calls.**
  - **Imports.** The seven games that import from `'../hq/stones'` add `recordTry` to that import. `Thwip.jsx` gets `import { recordTry } from '../hq/stones';` after its `'../hq/useStage'` import.
  - **Where each call goes.** One call at the top of each start callback, straight after `audioContext()` and after any early return. In Repulsor that means after PR 4’s `startable` guard, so a blocked “Suit up” counts nothing.
    - Repulsor: `recordTry('stark')` in `start`.
    - Lawn: `recordTry('thor')` in `begin`, which covers `start` and `startBoss`.
    - Ricochet: `recordTry('cap')` in `enter`, so every room entered, R included.
    - Trick Shot: `recordTry('hawkeye')` as the first line inside `if (round === 0) {` (the test reads up to the block’s first `}`). Rounds 2 and 3 are the same try.
    - Infiltration: `recordTry('widow')` in `enter`, and in the caught reset straight before `game.current = newLevel(g.index);`, since being caught starts the level again.
    - Smash: `recordTry('banner')` in `start`.
    - Thwip: `recordTry('spidey')` in `start`.
    - Tesseract: `recordTry('vault')` in `start`, so every leg flown.
  - `recordTry` is a module import, so no `useCallback` deps change.
- [ ] **Step 4: Run them to see them pass.**
  - Run `npx vitest run src/components/avengers`. Expected: every file passes, with `heist.test.js` at 12. No game’s rules test changes.
  - Run `npx eslint src/components/avengers`. Expected: no output.
  - Run `wc -l src/components/avengers/tesseract/TesseractRun.jsx`. Expected: under 800.
  - With `npx vite --port 5173 --strictPort` up, run `node $S/hq-pr6-check.mjs tries after`. Expected: `ok tries` and `all ok`. Stop the server.
- [ ] **Step 5: Commit.** Run `git add src/components/avengers/hq/heist.test.js` and the eight games. Subject: `Avengers HQ: count a try where each game’s run starts`. Body: a run, a room, a level or a leg; Trick Shot counts its first round only; Repulsor counts after its stage guard; a test pins each call.

### Task 4: The earned snap: the gate, the read-only gauntlet and the locked line

**Files:**
- Create: `src/components/avengers/titan/gate.js`, `src/components/avengers/titan/gate.test.js`
- Modify:
  - `src/components/avengers/titan/Titan.jsx`: `:6` (the `STONES` import), `:9-12` (the comment), `:14` (the signature), `:16` (`buttons`), `:32-45` (`place`), `:48-51` (`tick`), `:56-59` (the calm draw) and `:79-98` (the socket buttons);
  - `src/pages/Avengers.jsx` (at `ddb364bf`): imports `:1-19`, `:67` (`useFun`), `:72` (`have`), `:131-152` (merge, toggle, `all`, `heist`, `doSnap`), `:183-211` (Titan and its fallback), `:217-249` (lead, list, buttons);
  - `src/styles/lazy/avengers.css:30-35` (`.stone-pick`) and `:126-127` (`.titan-sockets`, `.titan-socket`).
- Test: `src/components/avengers/titan/gate.test.js`; one test appended to PR 5’s `src/pages/Avengers.test.js`

**Interfaces:**
- Consumes:
  - `PLACES`, `placeById` and `progress` from `'../world/rules'` (PR 1; PR 2’s `unlocked` is not passed);
  - `linkOf` and `hqState` from `world/links.js` (PR 3);
  - `useStones()`, `hasEarned(id)` and `SOUL_HALVES` from `hq/stones.js`;
  - `STONES` from `interests/stones`;
  - Titan’s handle `snap(tony, done) → boolean` (`Titan.jsx:66-72`, unchanged).
- Produces:
  - `titan/gate.js`: `snapGate(earned = []) → { ready: boolean, left: number, label: string | null, next: { id, name, to } | null }`, and `HEIST_ROWS: { id, name }[]` (the seven places with a stone, in `PLACES` order).
  - `Titan({ have, fallback }, ref)`: `onSet` is gone and the ref handle is unchanged.
  - `Avengers.jsx`: `gate` (from `snapGate`) in scope for Task 5, with `#snap-left`, `.stone-list li[data-on] .stone-pick` and the Next link in the page.

- [ ] **Step 1: Write the failing tests.** `titan/gate.test.js` imports `snapGate` and `HEIST_ROWS` from `'./gate'` and `linkOf` from `'../world/links'`.

```js
describe('the snap’s gate', () => {
  it('is locked with no stones: six left, the workshop next', () => {
    expect(snapGate([])).toEqual({ ready: false, left: 6, label: '6 stones left', next: { id: 'stark', name: 'Tony Stark’s workshop', to: '/avengers/workshop' } });
    expect(snapGate([]).next.to).toBe(linkOf('stark'));
  });
  it('counts a half of the Soul Stone as no stone, and sends you to the other half', () => {
    const g = snapGate(['space', 'mind', 'reality', 'power', 'time', 'soul-clint']);
    expect(g).toMatchObject({ ready: false, left: 1, label: '1 stone left' });
    expect(g.next).toEqual({ id: 'widow', name: 'Operations', to: linkOf('widow') });
  });
  it('opens only with all six won in play', () => {
    expect(snapGate(['space', 'mind', 'reality', 'power', 'time', 'soul-clint', 'soul-natasha', 'soul'])).toEqual({ ready: true, left: 0, label: null, next: null });
    expect(snapGate(['space', 'mind', 'reality', 'power', 'time', 'soul'])).toMatchObject({ ready: true, next: null });
    expect(snapGate(['power', 'mind']).next.id).toBe('thor');
  });
  it('ignores anything that is not a stone', () => {
    expect(snapGate(['aether', 'spidey', 'soul-clint'])).toMatchObject({ ready: false, left: 6 });
  });
  it('lists the seven buildings with a stone, in the tour’s order', () => {
    expect(HEIST_ROWS.map((r) => r.id)).toEqual(['stark', 'thor', 'cap', 'hawkeye', 'widow', 'banner', 'vault']);
    expect(HEIST_ROWS[0]).toEqual({ id: 'stark', name: 'Tony Stark’s workshop' });
  });
});
```

Append to `src/pages/Avengers.test.js`, reading files the way its existing tests do (Review Focus 4, and §7’s “cannot be toggled”):

```js
it('earns the snap: nothing set by hand, and Next keeps the page behind its game', () => {
  const page = readFileSync(new URL('./Avengers.jsx', import.meta.url), 'utf8');
  const titan = readFileSync(new URL('../components/avengers/titan/Titan.jsx', import.meta.url), 'utf8');
  expect(page).toMatch(/<Link\s+to=\{gate\.next\.to\}\s+state=\{hqState\}/);
  expect(page).toMatch(/disabled=\{!gate\.ready\}/);
  for (const gone of ['toggleStone', 'setHave', 'onSet=', 'Take them out', 'useFun', 'playClip(heist']) expect(page).not.toContain(gone);
  expect(titan).not.toMatch(/onSet|titan-socket|<button/);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/titan/gate.test.js src/pages/Avengers.test.js`. Expected: `Failed to resolve import "./gate"`, and the page test fails on the missing `<Link to={gate.next.to}`.
- [ ] **Step 3: Write `titan/gate.js`.** It is pure and imports only `PLACES`, `placeById` and `progress` (`'../world/rules'`) and `linkOf` (`'../world/links'`).
  - **`snapGate(earned)`** takes `const p = progress(earned)` and returns:
    - `left = 6 - p.stones` and `ready = left === 0`;
    - `` label = ready ? null : `${left} ${left === 1 ? 'stone' : 'stones'} left` ``;
    - `next = ready || !p.next ? null : { id: p.next, name: placeById(p.next).name, to: linkOf(p.next) }`.

    The `ready ||` matters: the whole Soul Stone without its halves leaves `p.next` at the range.
  - **`HEIST_ROWS`** is `PLACES.filter((p) => p.stone).map((p) => ({ id: p.id, name: p.name }))`.
- [ ] **Step 4: Take the toggle out of `Titan.jsx`.**
  - Signature `function Titan({ have, fallback }, ref)`.
  - Delete the `STONES` import, `buttons`, `place()` and the `.titan-sockets` block.
  - `tick` becomes `(dt) => view.current?.render(dt / 1000)`, and the calm draw renders `1 / 60` only. Keep its `eslint-disable-next-line` (the `lint-disables` count must not move).
  - The comment at `:9-12` now says the stones are set from the page, with no buttons over the sockets.
  - `useStage`, the `setStones` effect, `register('titan')` and `useImperativeHandle` stay as they are.
- [ ] **Step 5: Earn the snap in `Avengers.jsx`.**
  - **Imports.**
    - `{ SOUL_HALVES, hasEarned, useStones }` from `'../components/avengers/hq/stones'` (`earnedStones` goes);
    - `{ STONES }` from `'../components/interests/stones'` (`VIEW` goes);
    - `import { Link } from 'react-router-dom'` and `import { hqState } from '../components/avengers/world/links'` (PR 5 removed `Link`; ESLint proves the import);
    - `import { snapGate } from '../components/avengers/titan/gate'`.

    Remove `useFun` and its `snap`: on this page it was only the free path.
  - **State.**
    - Remove `have`/`setHave`, the merge effect, `toggleStone` and `heist`.
    - Add `const held = [...earned, ...SOUL_HALVES.filter(hasEarned)]`, `const gate = snapGate(held)` and `const all = gate.ready`.
    - A half sends no event, but every route change re-renders the page (`App.jsx:364`, `useLocation` in `Shell`), so Back from a game reads the halves again.
  - **`doSnap`.**
    - It begins `if (!gate.ready) return;`, then `audioContext()` and `playClip('ironMan')`.
    - `after()` plays the thunder, `unlock('whatever')` and the notify with PR 2’s text, unchanged.
    - Then `if (titan.current?.snap(true, after)) return; after();`.
  - **Titan:** `<Titan ref={titan} have={earned} fallback={<div className="gauntlet-wrap"><Gauntlet have={earned} all={all} /></div>} />`. The fallback’s socket buttons go.
  - **Lead** (exact copy):
    - ready: `'You took every stone back from the compound. Snap, and this time it’s Tony’s: Thanos turns to dust, and the page stays.'`
    - locked: `'He has the gauntlet. Win the six stones back on the compound, one building at a time, and the snap is Tony’s.'`
  - **List:** `<ul className="stone-list mt-6" aria-label="The stones">`. Each `li` keeps `data-on` and `--glow` and holds a `<div className="stone-pick">` (not a button). It has the dot, the name, `WHERE[s.id]` and `<span className="stone-pick-state">`, which reads `Won` or `Not yet`. `on` is `earned.includes(s.id)`.
  - **Buttons**, in this order:
    1. Snap: `<button type="button" className="btn btn-primary" disabled={!gate.ready} aria-describedby={gate.ready ? undefined : 'snap-left'} onClick={doSnap}>`, reading `Snap: I am Iron Man` when ready and `Snap` when locked.
    2. Next, when there is one: `<Link to={gate.next.to} state={hqState} className="btn btn-ghost">Next: {gate.next.name}</Link>`.
    3. `Back through the portal`, as before.

    “Take them out” goes. Under the row: `{!gate.ready && <p id="snap-left" className="mt-3 text-sm text-muted">{gate.label}</p>}`.
- [ ] **Step 6: The stone rows read, not press (`avengers.css`).**
  - `.stone-pick` loses `cursor: pointer` and its `transition`.
  - Delete `.stone-pick:hover` and `.stone-pick:focus-visible`.
  - `.stone-pick[aria-pressed='true']` becomes `.stone-list li[data-on] .stone-pick`, and its `.stone-pick-state` rule becomes `.stone-list li[data-on] .stone-pick-state`.
  - Delete `.titan-sockets` and `.titan-socket` (`:126-127`).
  - `extras.css`’s `.socket`, shared with the classic card, is not touched.
- [ ] **Step 7: Run them to see them pass.**
  - Run `npx vitest run src/components/avengers/titan src/pages src/components/avengers/world/labels.test.js`. Expected: `gate.test.js` has 5 passed, `Avengers.test.js` passes with its new test and `labels.test.js` (PR 2’s “army” check) passes.
  - Run `npx eslint src/pages/Avengers.jsx src/components/avengers/titan`. Expected: no output (no unused `STONES`, `VIEW`, `useFun` or `setHave`, and `Link` is defined).
  - Run `git diff --exit-code origin/main -- src/components/interests src/styles/extras.css src/components/avengers/titan/scene.js src/components/avengers/titan/models.js src/components/avengers/titan/module.js`. Expected: no output, exit 0.
  - With the dev server up, run `node $S/hq-pr6-check.mjs locked next free after`. Expected: `all ok`. Read `$S/titan-locked-after.png`: the list reads Won and Not yet, Snap is dimmed, “Next: Mjolnir” and “4 stones left” show. Stop the server.
- [ ] **Step 8: Commit.** `git add` `titan/gate.js`, `titan/gate.test.js`, `titan/Titan.jsx`, `src/pages/Avengers.jsx`, `src/pages/Avengers.test.js` and `src/styles/lazy/avengers.css`. Subject: `Avengers HQ: earn the snap; the gauntlet shows the stones won in play`. Body: the stones can no longer be set by hand on the page or over Titan’s sockets. Snap opens with all six won; locked, the page says how many are left and links to the next building. The classic interests card keeps its free gauntlet.

### Task 5: The heist summary over Titan’s dust

**Files:**
- Create: `src/components/avengers/titan/HeistSummary.jsx`, `src/components/avengers/titan/HeistSummary.test.jsx`
- Modify: `src/pages/Avengers.jsx` (imports, state, `doSnap`’s `after`, the gauntlet panel); `src/styles/lazy/avengers.css` (append after the Titan block, `:122-127` at `ddb364bf`); `docs/architecture.md:27` (the `avengers/world/` bullet, after PR 3’s and PR 4’s clauses)

**Interfaces:**
- Consumes:
  - `heistRecord()` (Task 2), `heistSummary` (Task 1) and `HEIST_ROWS` (Task 4);
  - `readBest(id, get)` from `'../components/avengers/board/records'` (PR 5);
  - `localSaves()` from `'../runtime/local'`;
  - `CloseButton({ label, className, ...rest })` (`src/components/ui.jsx:116`).
- Produces: `HeistSummary({ summary: { span, rows }, onClose })` (default export); `.heist-summary` and `@keyframes heist-rise` in `avengers.css`.

- [ ] **Step 1: Write the failing tests** in `titan/HeistSummary.test.jsx`, after `src/pages/Worlds.test.jsx:1-2`: `renderToStaticMarkup` from `react-dom/server`, and `HeistSummary` from `'./HeistSummary'`.

```js
const summary = { span: '1 day 2 hours', rows: [
  { id: 'stark', name: 'Tony Stark’s workshop', tries: '4 tries', best: '12,400' },
  { id: 'cap', name: 'The training center', tries: 'Before records began', best: 'No best kept' },
] };
const html = renderToStaticMarkup(<HeistSummary summary={summary} onClose={() => {}} />);

describe('the heist summary', () => {
  it('shows the span, and each building’s tries and best', () => {
    expect(html).toContain('class="heist-summary"');
    for (const t of ['The heist', 'First stone to sixth', '1 day 2 hours', 'Tony Stark’s workshop', '4 tries', '12,400', 'Before records began', 'No best kept']) expect(html).toContain(t);
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toMatch(/<th scope="row">The training center<\/th>/);
  });
  it('closes with the house close button, its title ready for focus', () => {
    expect(html).toContain('aria-label="Close the heist summary"');
    expect(html).toContain('class="close-btn');
    expect(html).toMatch(/<h3 id="heist-summary-title" tabindex="-1"/);
  });
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/titan/HeistSummary.test.jsx`. Expected: `Failed to resolve import "./HeistSummary"`.
- [ ] **Step 3: Write `HeistSummary.jsx`.**
  - **The section:** `<section className="heist-summary" aria-labelledby="heist-summary-title">`.
  - **The header:** `<h3 id="heist-summary-title" tabIndex={-1}>The heist</h3>` (its ref focused once on mount with `{ preventScroll: true }`) and `<CloseButton label="Close the heist summary" onClick={onClose} />`.
  - **The span:** `<p className="heist-summary-span"><span>First stone to sixth</span> <strong>{summary.span}</strong></p>`.
  - **The table:** a `<thead>` row of `Building`, `Tries` and `Best`, then one `<tr>` a row: `<th scope="row">{name}</th><td>{tries}</td><td>{best}</td>`.
  - It draws nothing but text.
- [ ] **Step 4: Show it when the earned snap plays (`Avengers.jsx`).**
  - **Imports:** `heistRecord` (add it to the `hq/stones` import), `heistSummary` from `'../components/avengers/hq/heist'`, `HEIST_ROWS` (add it to the gate import), `HeistSummary` from `'../components/avengers/titan/HeistSummary'`, `readBest` from `'../components/avengers/board/records'` and `localSaves` from `'../runtime/local'`.
  - **State:** `const [summary, setSummary] = useState(null)`.
  - **The end of `after()`:**

    ```js
    setSummary(heistSummary(heistRecord(), { games: HEIST_ROWS, bests: Object.fromEntries(HEIST_ROWS.map((r) => [r.id, readBest(r.id, localSaves().get)?.text.replace(/^Best /, '')])) }));
    ```

    The leading “Best ” goes because the column is headed Best. A building with no best stays `undefined` and reads “No best kept”.
  - **The panel:** inside `div.stones-panel.gauntlet-stage`, after `<Titan … />`, add `{summary && <HeistSummary summary={summary} onClose={() => setSummary(null)} />}`.
    - With 3D, `after()` runs as the fingers meet (`titan/scene.js:417-418`, `snapT` 0.44), and the dust starts at `snapT` 1.05 (`:422`). Without 3D it runs at once, over the drawing.
    - The panel stays until closed, so it outlasts the 8 s of dust (`:438`). A new snap replaces it.
- [ ] **Step 5: The glass (`avengers.css`, appended after the Titan block).**
  - **`.heist-summary`:**
    - placement: `position: absolute; z-index: 1;`, `0.75rem` from the left, right and bottom, `max-height: calc(100% - 1.5rem); overflow-y: auto;`;
    - box: padding `0.75rem 1rem`, a `1px` border in `var(--border-strong)` and `border-radius: var(--r-card)`;
    - glass: `background: rgba(8, 12, 20, 0.86)`;
    - text: `color: var(--text-body)` and `font-size: var(--fs-sm)`;
    - motion: `animation: heist-rise var(--t-slow) ease-out 0.6s both`.

    Comment the literals: the glass is over the 3D at the kit’s 0.78 or more with no blur (RULES.md UI 5). The 0.6 s delay is because the dust starts 0.61 s after the fingers meet.
  - **The rest:**
    - the title and the span’s value take `color: var(--text)`;
    - the column heads (`thead th`) and the span’s label take `font-size: var(--fs-xs)` (0.8125 rem, over the 0.7 floor);
    - `@keyframes heist-rise { from { opacity: 0; translate: 0 1.5rem; } }`;
    - `@media (prefers-reduced-motion: reduce) { .heist-summary { animation: none; } }`.
- [ ] **Step 6: The architecture page.** Append to `docs/architecture.md:27`’s `avengers/world/` bullet: “The heist is `../hq/stones.js` (`tp-hq-stones`) with its record `../hq/heist.js` (`tp-hq-heist`, through `runtime/saves`, tested); Titan’s snap on `/avengers` opens only with all six won in play (`../titan/gate.js`), and the classic interests card keeps the free gauntlet.”
- [ ] **Step 7: Run them to see them pass.**
  - Run `npx vitest run src/components/avengers/titan src/pages`. Expected: `HeistSummary.test.jsx` has 2 passed, and everything else still passes.
  - Run `npx eslint src/pages/Avengers.jsx src/components/avengers/titan`. Expected: no output.
  - With the dev server up, run `node $S/hq-pr6-check.mjs summary migration flat after`. Expected: `all ok`. Read `$S/summary-1440-after.png` and `$S/summary-390-after.png`. The dust is behind a dark glass panel reading “First stone to sixth 1 day 2 hours” over seven rows, and at 390 it fits the stage and scrolls. Stop the server.
- [ ] **Step 8: Commit.** `git add` the two new files, `Avengers.jsx`, `avengers.css` and `docs/architecture.md`. Subject: `Avengers HQ: the heist summary on glass over Titan’s dust`. Body: when Tony’s earned snap plays, the time from the first stone to the sixth and each building’s tries and best; Titan’s scene is unchanged.

### Task 6: Verify the PR and open it

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr6/README.md`, plus the pictures it lists under `before/` and `after/` (`.webp` or `.png`, each under 1 MB)

**Interfaces:**
- Consumes: Tasks 1–5; `$S/hq-pr6-check.mjs`, `$S/closure-before.txt`, `$S/tests-before.txt` and the before pictures.
- Produces: the pull request, and for PR 7 everything under “What PR 7 relies on”.

- [ ] **Step 1: The gates.** Run `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`, then `git checkout public/github.json`. Expected:
  - lint clean;
  - every test file passes, none skipped;
  - `✓ built`;
  - the health table ends `within budget`, with `cycles`, `lint-disables`, `big-files`, `renderers`, `loops` and `kbd-styles` as on `main`.

  Don’t ratchet a budget: the steward does it after the merge.
- [ ] **Step 2: The closure.** Run `npx vite build && node $S/closure.mjs | tee $S/closure-after.txt; git checkout public/github.json`. Expected: within a few kB of `$S/closure-before.txt`. `hq/heist.js`, `titan/gate.js` and `HeistSummary.jsx` join the page’s static closure. `runtime/saves.js` and `board/records.js` were already in it through PR 5’s board. Zero files means the page key isn’t `src/pages/Avengers.jsx`: grep the manifest for it.
- [ ] **Step 3: The links.** With `npx vite --port 5173 --strictPort` up, run `OUT=$S/links node scripts/hq-links-check.mjs`, then `OUT=$S/links-3d node scripts/hq-links-check.mjs --3d`. Expected: `all ok` both times.
- [ ] **Step 4: The heist in a browser.** Run `node $S/hq-pr6-check.mjs locked next tries summary migration flat free after | tee $S/check-after.txt`. Expected: `ok` for every part and `all ok`.
- [ ] **Step 5: The pages, after.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr6`, then `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible --shots avhq-pr6-phone --phone`. Expected: both end `everything green`.
  - Read each `-a.webp` beside its before. The top of `/avengers` and `/invincible` are unchanged.
  - Move the pictures into the evidence folder. `git status --short public/changes` is empty.
- [ ] **Step 6: The worlds that share `hq/`.**
  - Run `node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --out $S/hq-main --ref origin/main --only compound,invworld,thinkmark,viewer`, then the same with `--out $S/hq-pr6` and no `--ref`, then `--compare $S/hq-main $S/hq-pr6`. Expected: `0 pixels differ` for all four, exit 0. Leave out `titan`: its viewport shot holds the changed text column.
  - Run `OUT=$S/inv-after node scripts/inv-world-check.mjs` and `OUT=$S/hq-after node scripts/hq-world-check.mjs`. Expected: `no page errors` from both. The Invincible shots match `$S/inv-before` by eye.
  - Stop the server.
- [ ] **Step 7: The evidence README** at `docs/superpowers/evidence/avengers-hq/pr6/README.md`:
  - one line a picture: what it shows, before or after (Titan’s column before with its Set buttons and after, locked; the summary at 1440 and at 390; the migration’s panel);
  - the closure’s total line, before and after;
  - the test counts in `src/components/avengers` and `src/pages`, before and after;
  - the `hq-shots` compare table for the four targets;
  - each `$S/hq-pr6-check.mjs` part and its result, and `hq-links-check`’s results both ways.

  Commit with the subject `Avengers HQ PR 6: the evidence`.
- [ ] **Step 8: Open the pull request.**
  - Run `git push -u origin claude/avengers-hq-pr6-heist`, then open the PR with base `main` and the title `Avengers HQ 6 of 7: the heist record and the earned snap`.
  - The body:
    - one paragraph each on the earned snap (read-only list, locked line, Next), the record (`tp-hq-heist`, first wins, tries, the migration on read) and the summary over the dust;
    - the numbers from the README, before → after: the closure and the tests;
    - the screenshots as images from `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/claude/avengers-hq-pr6-heist/docs/superpowers/evidence/avengers-hq/pr6/<file>`: Titan’s column before and after, and the summary on desktop and on a phone;
    - the checks that ran (Steps 1–6) with their results;
    - a note for the owner: the free Thanos snap leaves `/avengers` but stays on the classic interests card, as the typed “snap” and on the soundboard; tries are keyed by building; a stone held before this PR reads “Before records began”;
    - the plan’s path and the harness’s PR footer.
  - It is one PR, merged with a merge commit once CI is green. Never force-push; a requested change is a new commit.

---

## Self-review against the spec

- **§7 The snap is earned.**
  - The gauntlet shows `earned` and cannot be toggled: no list buttons, no sockets, no `onSet` (Task 4, the page’s source test, `locked`).
  - Locked, it says how many stones are left and links to the next building (Task 4, `snapGate`, `next`).
  - All six won: Tony’s snap (Task 4).
- **§7 The classic page keeps the free gauntlet.** `interests/*` and `extras.css` are unchanged (Task 4’s `git diff`, `free`).
- **§7 A heist record.**
  - `tp-hq-heist` is registered at version 1 with the spec’s shape (Task 1).
  - `earnStone` writes the first win and each start writes a try (Tasks 2, 3).
  - Held stones read `null` and “before records began” (Tasks 1, 2, `migration`).
- **§7 The summary over the dust.** A glass text panel with the span, the tries and the best per game; Titan’s scene is unchanged (Task 5, `summary`, `flat`, Task 4’s `git diff`).
- **§7 Copy fixes.** PR 2 made them. This PR keeps “army” out of the page (its test) and adds no half-stone wording.
- **§3.** No figure is drawn and keys keep their shapes. `hq/` changes leave Invincible’s shots identical, and the kit’s readability floors hold for the panel (Global Constraints, Tasks 5 and 6).
- **§12.** The heist record’s writes and migration from no key, and the snap’s gate, are in Vitest. In the browser: `autopilot-check` with `--before`, `--routes /avengers,/invincible`, `--shots` and `--phone`, then `hq-world-check`, `inv-world-check` (since `hq/` changed) and `hq-links-check`. The closure’s size is stated and the four gates run (Task 6).
- **Cross-check fixes applied.**
  - The Next link is `<Link to={gate.next.to} state={hqState}>`, pinned by the page’s source test (Task 4).
  - `Avengers.jsx` re-imports `Link` from `react-router-dom` and `hqState` from `world/links`, and ESLint proves it (Task 4).
  - The bests are `readBest(r.id, localSaves().get)?.text` over `HEIST_ROWS`, with the leading “Best ” stripped, and the fixtures stay plain strings (Task 5).
  - `recordTry` sits after any early return, after PR 4’s `startable` guard in Repulsor, and a test pins the order (Task 3).
  - `recordTry` is keyed by place id, so PR 7 calls `recordTry('cap')` and `recordTry('widow')`. The `STARTS` rows take PR 7’s two `Flat.jsx` files (Task 3).
  - `hq-links-check.mjs` runs both ways and ends `all ok` (Task 6).
  - The lawn’s try is in PR 2’s `begin`, so it covers both its starts (Task 3).
  - The checks run on the spec’s routes, `/avengers,/invincible`; `/home` is a core page that `autopilot-check` always opens.
