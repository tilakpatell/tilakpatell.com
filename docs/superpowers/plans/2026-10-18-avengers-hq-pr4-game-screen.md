# Avengers HQ PR 4: the game screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every building’s game fills the window under one slim bar (the place’s name, its own 3D switch, Pause, Back with Esc), keeps its 3D choice to itself, ends on one results card with a way on and hands back to a compound that is fetched ahead, veiled until it draws and says what is next. This is PR 4 of the seven in spec §11.

**Architecture:**
- A new frame, `hq/HQGame.jsx`, wraps the unchanged `hq/HQFrame.jsx` (Invincible imports it) and draws the bar. `world/Place.jsx` stops drawing a header and hands the place to the game through a `GameScreen` context.
- Each game’s 3D choice lives in its own key, `tp-hq-3d-<game>`, read by `hq/useGame3D.js`. One optional flag in the runtime’s `useWorld` lets such a page decide alone, so a game can draw in 3D while the site’s switch is off and the compound is never dropped to 2D.
- Every rule is in pure, tested modules: `hq/gameScreen.js` (keys, the switch’s words, touch help, the way on, scores, the hidden-tab pause), `world/warm.js` (doors fetched ahead) and `world/welcome.js` (the welcome back and the return veil). `hq/Results.jsx` is the one end card.

**Tech Stack:** React 19, react-router-dom 7, three 0.186 on the site’s world runtime (the HQ games stay `'glsl'`), Vite 8, Vitest 5 (node environment: no DOM, so components are tested with `react-dom/server` and pure helpers), playwright-core under the check scripts.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md` (as amended in `30dd1241`): §5 (the game screen), §3 (rules kept), §11 step 4 and §12 (the checks). The spec wins over any brief. PR 4 of 7; the index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`.

## Global Constraints

- **Order.** PR 4 of 7, merged in order. Branch from `origin/main` with PRs 1–3 merged. It consumes only these:
  - PR 1: `PLACES`, `START`, `nearPlace(x, z, r = DOOR_R)` and `progress` through the `world/rules.js` barrel. `CompoundHud.jsx` takes `Toast` from `'../../../runtime/hud/Toast'`; any kit part this PR adds comes the same way, never from the barrel (PR 1’s `CompoundWorld.test.js` fails otherwise).
  - PR 2: in `world/labels.js`, `HALF_OF = { 'soul-clint': 'Clint’s', 'soul-natasha': 'Natasha’s' }` and `stoneById` (which this PR takes back out of the games). In `labels.test.js`, the test “gives every game’s stone badge the stone’s own colour, and keeps the table in one place”, with its `GAMES` list and `read` helper. In `hq.css`, `.hq-game .btn:disabled`. In `HoldTheLawn.jsx`, the `checkpoint` state, `start` and `startBoss`. In `Thwip.jsx`, the loss’s `res.why` (`'bell' | 'street'`) and the title `Late for school.`
  - PR 3: `linkOf(id) → '/avengers/<slug>' | null` from `world/links.js`; `CompoundWorld` takes `inside` from the route and renders `<Place key={inside} id={inside} onLeave={leave} onPortal={portal} />`; `leave()` is the one way out; `TesseractToy({ onPortal, space })`; `scripts/hq-links-check.mjs [--3d]`, whose last line is `all ok` or `N problems`.
- **Line numbers** are `main` at `ddb364bf`. PRs 1–3 move lines in `CompoundWorld.jsx`, `CompoundHud.jsx`, `Place.jsx` and the eight games, so find each place by the quoted text. `world.css`, `useWorld.js`, `useStage.js`, `HQFrame.jsx` and `docs/architecture.md` are as they were at `ddb364bf`.
- **Content (§3).** Nothing here draws a figure, suit or mark of any Marvel character. The only new drawings are the touch help’s icons: a dot, rings, an arrow, chevrons and a rounded rectangle.
- **Copy (RULES.md UI 7).** British spelling, curly quotes (’ “ ”) in strings, sentence case, no Oxford comma, one sentence to a toast. A half stone reads as whose half: “Clint’s half of the Soul Stone”.
- **Shared code (§3).** `hq/` is shared with Invincible (ThinkMark imports `HQFrame` at `ThinkMark.jsx:2`; `invincible/pack.js:13` lists it). `HQFrame.jsx` is not edited, byte for byte. Every new `hq.css` rule is scoped under a new class, and `hq.css:1-27` is not edited, so `.hq-screen`’s 16:9 still sizes ThinkMark. The Invincible shots must stay pixel-identical (Task 6).
- **The site’s 3D switch stays in Settings (§5).** No code in this PR calls `three.set` of `use3D()` or `setMode3D`. `src/runtime/useWorld.js` gains one optional flag, `own3D = false`. Every other caller keeps today’s behaviour. Say so to the engine-floor (FL2) session in the PR body, since it owns `src/runtime`.
- **Keys.** New keys only: `tp-hq-3d-repulsor`, `-lawn`, `-ricochet`, `-trickshot`, `-widow`, `-smash`, `-thwip`, `-tesseract`. Each holds JSON `"on"` or `"off"`; no key means `auto`. They are unregistered with `runtime/saves`. No existing key changes. `__HQ__` and `__HQWORLD__` keep every name.
- **Kit and UI (§3, RULES.md UI).** The bar and the results card are the frame of a page game, drawn with the shell’s `.btn` and tokens. Every control there is at least 44 px on a coarse pointer. Text over the 3D sits on glass at alpha 0.78 or more. Nothing new under 0.7 rem. No new `kbd` rule: `kbd-styles` falls by one. No bare page-level `z-index` of 10 or more.
- **Limits.** Files under 800 lines (`TesseractRun.jsx` is 792 today, so check it with `wc -l`). No new dependency, renderer or animation loop. No edit to `src/components/guide/pages.js` or `src/runtime/hud/*` (open draft #1028): the games keep their own key lists, and the touch help is data in `hq/gameScreen.js`.
- **Tests.** Beside their files, each under one second, no network. No test is skipped, loosened or deleted. PR 2’s `stoneById(` assertion is replaced by one of equal strength (Task 4).
- **Commits.** A plain sentence as the subject; the body says why, with the measured numbers; end with the harness’s attribution lines. No model names anywhere. Never force-push.
- **What later PRs rely on.**
  - PR 5: `writeLocal3D(GAME_AT[placeId], 'on')` for a card’s per-game Try 3D and the line “The stone here is won in the 3D game.”
  - PR 6: each game’s start is what Results’ Play again calls. Repulsor’s `start()` begins with the `startable` guard, and PR 6’s `recordTry('stark')` goes after it.
  - PR 7: `HQGame`’s `flat` prop and `switchFor`’s “Play in 2D” and “Play in 3D” branches, the `html`, `stage` and `three` helpers in `HQGame.test.jsx`, the `playing` and `onPause` props (PR 7 feeds `playing={live || flatLive}`) and `TOUCH_HELP` (PR 7 adds `ricochet-flat` and `widow-flat`, and widens the keys test).

## Review Focus

1. **Storage that throws, is missing or holds junk** (a private window, an old value). The game reads `auto` and plays, nothing throws and `tp-3d` is never written. Pinned in Task 1 (“reads junk, broken storage and no storage as auto…”, “never touches the site’s 3D setting”).
2. **The site’s 3D off in Settings, then Try 3D in one game.** That game draws in 3D. The compound stays on its cards and Settings is unchanged. Pinned in Task 1 (`wants3D`), Task 3 (every game passes `own3D: true` and calls no `use3D`) and Task 6’s `siteoff` part.
3. **A tab hidden mid-run.** Every game pauses, including Ricochet and Infiltration, which had no pause. Pinned in Task 1 (“pauses a game when its tab is hidden…”, on a fake document), Task 3 (every game passes `onPause`) and Task 6’s `pause` part.
4. **Closing a game opened from a cold link**, before the compound was ever drawn. The veil says it is flying in, with real progress, not “Back to the compound” at 100%. Pinned in Task 5 (“shows the way back as one draw…”).
5. **Losing in the building that is next, winning only a half, winning the last stone.** Next never points back at this building or at the gate. A half still earns the welcome. With every stone won there is no Next, and the toast names the portal. Pinned in Task 1 (“points the way on…”) and Task 5 (“welcomes you back…”).

---

## Files

| File | Task | Responsibility |
| --- | --- | --- |
| `src/components/avengers/hq/gameScreen.js` + `.test.js` | 1, 5 | pure: the per-game 3D key, the switch’s words, touch help, the way on, scores, the hidden-tab watch, `startable` |
| `src/components/avengers/hq/useGame3D.js` | 1 | the site’s `use3D()` with this game’s own `on`, `mode` and `set` |
| `src/runtime/useWorld.js` + `.test.js` | 1 | `wants3D`; the `own3D` option |
| `src/components/avengers/hq/useStage.js` | 1 | passes `own3D` through |
| `src/components/avengers/hq/HQGame.jsx` + `.test.jsx` | 2 (tests also 3–5) | the full-screen frame: `HQGame`, `GameScreen`, `GameBar`, `StartNote`, `TouchHelp` |
| `src/components/avengers/hq/Results.jsx` + `.test.jsx` | 2 | the one end card: `Results`, `ResultsCard` |
| `src/components/avengers/hq/hq.css` | 2 | appended rules for the screen, bar, toy, touch help and card |
| `src/components/avengers/world/Place.jsx` | 3 | provides `GameScreen`; no header of its own |
| `src/components/avengers/world/world.css` | 3, 5 | drops the old head rules; adds the stones chip’s pulse |
| the eight games (`repulsor/RepulsorRange.jsx`, `lawn/HoldTheLawn.jsx`, `ricochet/Ricochet.jsx`, `trickshot/TrickShot.jsx`, `widow/Infiltration.jsx`, `smash/SmashRun.jsx`, `thwip/Thwip.jsx`, `tesseract/TesseractRun.jsx`) | 3, 4 (Repulsor also 5) | onto `HQGame`, `useGame3D`, a Pause, `StartNote`, `TouchHelp` and `Results` |
| `ricochet/ricochet.css`, `tesseract/tesseract.css` | 4 | rules the card leaves unused go |
| `src/components/avengers/world/labels.test.js` | 4 | PR 2’s badge assertion, to the new truth |
| `src/components/avengers/world/warm.js` + `.test.js` | 5 | doors fetched and warmed within 15 m |
| `src/components/avengers/world/welcome.js` + `.test.js` | 5 | the welcome back and the return veil |
| `src/components/avengers/world/CompoundWorld.jsx`, `CompoundHud.jsx` | 5 | veil, welcome, chip pulse, warming |
| `docs/architecture.md` | 3, 5 | one clause on the game screen and the warming |
| `docs/superpowers/evidence/avengers-hq/pr4/` | 6 | README and pictures |

### Before Task 1: the before numbers

- [ ] **Branch and check PRs 1–3 are in.** Run `git fetch origin main && git switch -c claude/avengers-hq-pr4-game-screen origin/main`, then `ls src/components/avengers/world/links.js scripts/hq-links-check.mjs src/components/avengers/world/rules/progress.js && grep -n "HALF_OF" src/components/avengers/world/labels.js`. Expected: three paths and one `HALF_OF` line. `S` below is the session’s scratchpad directory, never under the repo.
- [ ] **The closure, before.** Save PR 1’s manifest script (`2026-10-18-avengers-hq-pr1-splits.md`, Task 1 Step 2) as `$S/closure.mjs`, unchanged. Run `npx vite build && node $S/closure.mjs | tee $S/closure-before.txt`. Expected: one total line, close to PR 3’s stated size (about `707 kB raw 260 kB gzip` after PR 1).
- [ ] **The pages, before.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers/workshop,/invincible --shots avhq-pr4 --before`, then the same with `--shots avhq-pr4-phone --phone`. Move both `public/changes/avhq-pr4*-before.webp` to `$S/`. Expected: each run ends `everything green`.
- [ ] **The worlds and links, before.** With `npx vite --port 5173 --strictPort` up, run `OUT=$S/links-before node scripts/hq-links-check.mjs`, `OUT=$S/inv-before node scripts/inv-world-check.mjs` and `OUT=$S/hq-before node scripts/hq-world-check.mjs`. Expected: `all ok`, then `no page errors` twice.
- [ ] **Write the scratch browser script** `$S/hq-pr4-check.mjs` (not committed). It takes part names and prints `ok <part>` or `FAIL <part>: <why>` for each. It ends `all ok` or `N problems` and exits 1 on any FAIL.
  - **Launch.** Copy `scripts/hq-links-check.mjs`’s chromium launch and init block. Base `http://localhost:5173/?quality=low#`. Init: `tp-intro` = `'1'`, `tp-worlds` = `'load'`, `tp-3d` = `'on'` (raw, as `lib/gpu.js` stores it) unless the part says otherwise, plus the part’s own keys. Count every console error not in `scripts/lib/noise.mjs`’s noise as a FAIL of the part.
  - **`fit`** runs at 1024 × 640, then at 390 × 844 with `isMobile` and `hasTouch`. For each row of `LINKS` (imported from `world/links.js`), use a fresh page at `#/avengers/<slug>` and wait up to 240 s for `.cw-place .hq-canvas[data-on]`. Record the start control’s bounding-box bottom. That is the first `.cw-place .hq-overlay .btn-primary`, or for Ricochet, whose menu starts from its room buttons, the first enabled `.cap-room-btn`. Pass: bottom ≤ the viewport height. After this PR, also: `.hq-bar` is at most 56 px tall at 1024 × 640. On the phone, `.hq-touch` is visible, no `.hq-keys` is visible, and every `.hq-bar .btn` is at least 44 px tall. Write a table `slug, w × h, bottom` to `$S/fit-<when>.txt` (`<when>` is the first argument after the parts: `before` or `after`).
  - **`gate`:** open `#/avengers/workshop`. Before `.hq-canvas[data-on]`, the button reading `Suit up` is `disabled` and `__HQ__.repulsor.state.phase` is `'ready'`. After `data-on`, a click makes the phase `'wave'`.
  - **`pause`:** open `#/avengers/lab`, wait for `data-on` and click `Hulk out`. After 1 s, click the bar’s `Pause`. Pass: it has `aria-pressed="true"`, `.sr-overlay .hq-overlay-title` reads `Paused`, and `__HQ__.smash.state.t` doesn’t change over 1 s. Then open `#/avengers/gate`, click `Swing` and run `Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))`. Pass: `.tw-overlay .hq-overlay-title` reads `Paused`.
  - **`own3d`** (init `tp-hq-3d-repulsor` = `'"off"'`): open `#/avengers/workshop`.
    - Pass: `.hq-toy-note` reads `The stone here is won in the 3D game.` and holds a `Try 3D` button, and there is no `.hq-screen`.
    - Click the bar’s Back. Pass: `#hq-world[data-mode="3d"]`, and `localStorage['tp-3d']` is still `'on'`.
    - Wait for `.cw-canvas[data-on]`, run `__HQWORLD__.enter('stark')` and click `Try 3D`. Pass: `.hq-screen` appears, and `tp-hq-3d-repulsor` is `'"on"'`.
  - **`siteoff`** (init `tp-3d` = `'off'`): open `#/avengers/workshop` and click `Try 3D`. Pass: `.hq-canvas[data-on]` within 240 s. Then click Back. Pass: `#hq-world[data-mode="cards"]` and `tp-3d` is still `'off'`.
  - **`results`:**
    - Open `#/avengers/lab`, click `Hulk out`, then run `__HQ__.smash.setState('lost')`.
    - Pass: `.hq-results` holds `Play again`, `Back to the compound` and an `a` whose text starts `Next: ` and whose `href` is `#/avengers/<slug>` for that place. Record `history.length` and click the link. Pass: the hash is that link, `history.length` is unchanged (a replace), and `#hq-bar-title` reads that place’s name.
    - Open `#/avengers/hangar` and await `__HQ__.tesseract.setState('won')`. Pass: the `.hq-results` primary button reads `Open the portal`.
  - **`back`** (init `tp-hq-stones` = `'[]'`):
    - Open `#/avengers`, wait for `.cw-canvas[data-on]`, run `__HQWORLD__.enter('banner')` and wait for `.hq-bar`.
    - Run `localStorage.setItem('tp-hq-stones', '["time"]')`, then click the bar’s Back. Poll every 50 ms. Pass: until `.cw-canvas[data-on]` is set again, `.loading-veil:not(.is-done)` exists and `.loading-veil-title` reads `Back to the compound`.
    - Pass, after the veil: `.cw-stones[data-pulse]` exists and `.hud-toast` reads `Next: Tony Stark’s workshop`.
  - **`warm`:**
    - Open `#/avengers` and wait for `data-on`. Set `__HQWORLD__.sim.h.x` and `.z` to the workshop door’s `x + 12` and `z` (from `PLACES`), and wait 1.5 s.
    - Pass: `performance.getEntriesByType('resource')` now names `repulsor/RepulsorRange.jsx` and `repulsor/scene.js`.
    - Run `__HQWORLD__.enter('stark')` while polling for the text `Opening the door…`. Pass: it never shows, and `.hq-bar` is there within 1 s.
- [ ] **Run the fit, before.** With the dev server still up, run `node $S/hq-pr4-check.mjs fit before`. Expected: FAIL rows wherever Start is below the fold in the old dialog. Keep `$S/fit-before.txt`; it is the PR’s before table. Stop the server.

---

### Task 1: A game’s own 3D, and the game screen’s pure helpers

**Files:**
- Create: `src/components/avengers/hq/gameScreen.js`, `src/components/avengers/hq/gameScreen.test.js`, `src/components/avengers/hq/useGame3D.js`
- Modify: `src/runtime/useWorld.js:54` (beside `recoverNow`), `:107` (the options), `:124` (`const wanted`); `src/runtime/useWorld.test.js:2` (the import) and a new `describe`; `src/components/avengers/hq/useStage.js:117` (the signature), `:143` (the `useWorld` call)

**Interfaces:**
- Consumes: `use3D() → { on, can, auto, mode, set, info, status, held, hold }` (`src/lib/gpu.js:104-125`); `progress` and `PLACES` (PR 1 barrel); `linkOf` (PR 3), passed in rather than imported.
- Produces, in `hq/gameScreen.js` (which imports nothing):
  - `GAMES = ['repulsor', 'lawn', 'ricochet', 'trickshot', 'widow', 'smash', 'thwip', 'tesseract']`: the `useStage` ids, which the best keys `tp-hq-<id>-best` already use.
  - `GAME_AT`: place id → game id (`stark: 'repulsor'` … `vault: 'tesseract'`), in `PLACES` order.
  - `local3DKey(game) → 'tp-hq-3d-' + game`.
  - `readLocal3D(game, store = browserStore()) → 'auto' | 'on' | 'off'`.
  - `writeLocal3D(game, mode, store = browserStore()) → void`. `browserStore()` returns `globalThis.localStorage` inside a try, or `null`.
  - `resolveLocal3D(local, { on, can, held }) → boolean`.
  - `switchFor({ can, on, status, flat = false, stone = true }) → { bar: { label, next, pressed? } | null, note: { text, action: { label, next: 'on' | 'off' | 'retry' } | null } | null }`.
  - `TOUCH_ICONS = ['tap', 'hold', 'drag', 'swipe', 'button']`; `TOUCH_HELP: { [game]: { icon, text }[] }`.
  - `nextFor(prog, here, linkOf) → { id, label, to } | null`.
  - `fmt(n) → '12,340'`.
  - `scoreLine({ score, best = 0, newBest = false, format = fmt }) → { big, small } | null`.
  - `stoneWords(name, half = null) → string`.
  - `watchHidden(doc, onHide) → stop()`.
- Produces elsewhere:
  - `hq/useGame3D.js`: `useGame3D(game) → { ...use3D(), local, on, mode, set(mode) }`.
  - `runtime/useWorld.js`: `wants3D(enabled, siteOn, own3D = false) → boolean`; `useWorld(module, { …, own3D = false })`.
  - `hq/useStage.js`: `useStage(module, { enabled, id, forced, options, props, own3D = false })`.

- [ ] **Step 1: Write the failing tests.** In `hq/gameScreen.test.js`, import `{ describe, expect, it, vi }` from `vitest`, the names above, `PLACES` and `progress` from `'../world/rules'`, `linkOf` from `'../world/links'` and `readFileSync` from `node:fs`. Copy `memoryStorage` from `hq.test.js:41-44`.

```js
const site = (o) => ({ on: false, can: true, held: false, ...o });
const ALL = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time', 'space'];

describe('a game’s own 3D', () => {
  it('keeps one key a game, tp-hq-3d-<game>, with auto as no key', () => {
    const store = memoryStorage();
    expect(local3DKey('repulsor')).toBe('tp-hq-3d-repulsor');
    expect(readLocal3D('repulsor', store)).toBe('auto');
    writeLocal3D('repulsor', 'off', store);
    expect(store.getItem('tp-hq-3d-repulsor')).toBe('"off"');
    expect([readLocal3D('repulsor', store), readLocal3D('lawn', store)]).toEqual(['off', 'auto']);
    writeLocal3D('repulsor', 'auto', store);
    expect(store.getItem('tp-hq-3d-repulsor')).toBe(null);
    expect(store.getItem('tp-3d')).toBe(null);
  });
  it('reads junk, broken storage and no storage as auto, and never throws', () => {
    const store = memoryStorage();
    store.setItem('tp-hq-3d-thwip', '{nope');
    expect(readLocal3D('thwip', store)).toBe('auto');
    store.setItem('tp-hq-3d-thwip', '"maybe"');
    expect(readLocal3D('thwip', store)).toBe('auto');
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
    expect(readLocal3D('thwip', broken)).toBe('auto');
    expect(() => writeLocal3D('thwip', 'on', broken)).not.toThrow();
    expect(readLocal3D('thwip', null)).toBe('auto');
    expect(() => writeLocal3D('thwip', 'on', null)).not.toThrow();
    expect(readLocal3D('thwip')).toBe('auto'); // node: no localStorage at all
    expect(() => writeLocal3D('thwip', 'on')).not.toThrow();
  });
  it('draws in 3D by the game’s own choice first, and the site’s only on auto', () => {
    expect(resolveLocal3D('off', site({ on: true }))).toBe(false);
    expect(resolveLocal3D('on', site())).toBe(true);
    expect(resolveLocal3D('on', site({ can: false }))).toBe(false);
    expect(resolveLocal3D('on', site({ held: true }))).toBe(false);
    expect(resolveLocal3D('auto', site({ on: true }))).toBe(true);
    expect(resolveLocal3D('auto', site())).toBe(false);
  });
  it('never touches the site’s 3D setting', () => {
    const src = readFileSync(new URL('./useGame3D.js', import.meta.url), 'utf8');
    expect(src).toContain('readLocal3D(game)');
    expect(src).not.toMatch(/setMode3D|site\.set\b/);
  });
});

describe('the switch, the touch help and the games', () => {
  it('says what the switch says: 3D game on, Try 3D, Play in 2D and Try 3D again', () => {
    expect(switchFor({ can: true, on: true, status: 'on' })).toEqual({ bar: { label: '3D game: on', pressed: true, next: 'off' }, note: null });
    expect(switchFor({ can: true, on: false, status: 'idle' })).toEqual({ bar: null, note: { text: 'The stone here is won in the 3D game.', action: { label: 'Try 3D', next: 'on' } } });
    expect(switchFor({ can: true, on: false, status: 'idle', stone: false }).note.text).toBe('This game is played in 3D.');
    expect(switchFor({ can: true, on: true, status: 'on', flat: true })).toEqual({ bar: { label: 'Play in 2D', next: 'off' }, note: null });
    expect(switchFor({ can: true, on: false, status: 'idle', flat: true })).toEqual({ bar: { label: 'Play in 3D', next: 'on' }, note: null });
    expect(switchFor({ can: false, on: false, status: 'idle' })).toEqual({ bar: null, note: { text: 'The stone here is won in the 3D game.', action: null } });
    expect(switchFor({ can: false, on: false, status: 'idle', flat: true })).toEqual({ bar: null, note: null });
    for (const [status, text] of [['failed', '3D couldn’t start here, so here is the simple version.'], ['slow', 'This device was struggling with 3D, so here is the simple version.'], ['lost', 'The graphics chip reset, so here is the simple version.']]) {
      expect(switchFor({ can: true, on: true, status })).toEqual({ bar: null, note: { text, action: { label: 'Try 3D again', next: 'retry' } } });
    }
  });
  it('has touch words for every game, each with an icon it can draw', () => {
    expect(Object.keys(TOUCH_HELP).sort()).toEqual([...GAMES].sort());
    for (const rows of Object.values(TOUCH_HELP)) {
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows.length).toBeLessThanOrEqual(3);
      for (const { icon, text } of rows) {
        expect(TOUCH_ICONS).toContain(icon);
        expect(text).toMatch(/^[A-Z]/);
        expect(text).not.toMatch(/\.$/);
        expect(text).not.toContain("'");
      }
    }
  });
  it('names the game at every door', () => {
    expect(Object.keys(GAME_AT)).toEqual(PLACES.map((p) => p.id));
    expect(Object.values(GAME_AT)).toEqual(GAMES);
  });
});

describe('the way on and the score', () => {
  it('points the way on at the next stone not yet won, never this building nor the gate', () => {
    expect(nextFor(progress(['power']), 'stark', linkOf)).toEqual({ id: 'thor', label: 'Mjolnir', to: '/avengers/lawn' });
    expect(nextFor(progress([]), 'stark', linkOf).id).toBe('thor');
    expect(nextFor(progress([]), 'thor', linkOf).id).toBe('stark');
    expect(nextFor(progress(['power', 'reality', 'mind', 'soul-clint', 'time', 'space']), 'spidey', linkOf).id).toBe('widow');
    expect(nextFor(progress(ALL), 'vault', linkOf)).toBe(null);
    expect(nextFor(progress([]), 'stark', () => null)).toBe(null);
  });
  it('reads a score against the best, and words a stone whole or whose half', () => {
    expect(scoreLine({ score: 12340, best: 15200 })).toEqual({ big: '12,340', small: 'best 15,200' });
    expect(scoreLine({ score: 15300, best: 15200, newBest: true }).small).toBe('a new best');
    expect(scoreLine({ score: 40 }).small).toBe('points');
    expect(scoreLine({ score: 1840.6, best: 2000, format: (n) => `${fmt(n)} m` })).toEqual({ big: '1,841 m', small: 'best 2,000 m' });
    expect(scoreLine({ score: null })).toBe(null);
    expect(stoneWords('Power Stone')).toBe('The Power Stone is yours.');
    expect(stoneWords('Soul Stone', 'Clint’s')).toBe('Clint’s half of the Soul Stone is yours.');
  });
});

describe('a hidden tab', () => {
  it('pauses a game when its tab is hidden, and stops listening when asked', () => {
    const doc = { hidden: false, on: null, addEventListener(t, f) { if (t === 'visibilitychange') this.on = f; }, removeEventListener(t, f) { if (this.on === f) this.on = null; } };
    const hide = vi.fn();
    const stop = watchHidden(doc, hide);
    doc.on();
    expect(hide).not.toHaveBeenCalled();
    doc.hidden = true;
    doc.on();
    expect(hide).toHaveBeenCalledTimes(1);
    stop();
    expect(doc.on).toBe(null);
    expect(() => watchHidden(null, hide)()).not.toThrow();
  });
});
```

In `src/runtime/useWorld.test.js`, add `wants3D` to the import at `:2` and a new block:

```js
describe('whether a page draws in 3D', () => {
  it('a page with its own 3D switch decides alone; every other page still asks the site', () => {
    expect(wants3D(true, true)).toBe(true);
    expect(wants3D(true, false)).toBe(false);
    expect(wants3D(true, false, true)).toBe(true);
    expect(wants3D(false, true, true)).toBe(false);
    expect(wants3D(false, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/hq/gameScreen.test.js src/runtime/useWorld.test.js`. Expected: `Failed to resolve import "./gameScreen"`, and `wants3D is not a function` (or “does not provide an export named wants3D”).
- [ ] **Step 3: Write `hq/gameScreen.js`.**
  - Header comment: the game screen’s rules, with no React and no storage of its own (the caller passes a store).
  - `readLocal3D` JSON-parses the key and returns `'on'` or `'off'`, otherwise `'auto'`. A `null` store or a throw also gives `'auto'`. `writeLocal3D` removes the key for `'auto'`, otherwise sets `JSON.stringify(mode)`, and swallows throws.
  - `resolveLocal3D`: `'off'` → false; `'on'` → `Boolean(can && !held)`; `'auto'` → `Boolean(on)`.
  - `switchFor` checks in this order:
    1. `!can` → `{ bar: null, note: flat ? null : { text: toyLine, action: null } }`.
    2. `!on` → with `flat`, bar `Play in 3D` / `'on'`; otherwise note `toyLine` with `Try 3D` / `'on'`.
    3. `status` failed, slow or lost → note with `HQFrame.jsx:37-39`’s line (verbatim) and `Try 3D again` / `'retry'`.
    4. Otherwise → with `flat`, bar `Play in 2D` / `'off'`; otherwise bar `3D game: on`, `pressed: true`, `'off'`.

    `toyLine` is `stone ? 'The stone here is won in the 3D game.' : 'This game is played in 3D.'`.
  - `TOUCH_HELP`, verbatim (curly apostrophes, no full stops):

    | game | rows (icon: text) |
    | --- | --- |
    | `repulsor` | hold: Touch and hold to aim and fire · button: The arrows strafe; Beam fires the unibeam once it’s charged |
    | `lawn` | drag: To lift the hammer, hold and slide to keep the needle in the green · tap: Tap to throw the hammer, and again to call it back · button: The arrows walk; the bolt brings down lightning |
    | `ricochet` | drag: Drag to aim the shield · button: Throw throws it; ↺ starts the room again |
    | `trickshot` | hold: Press to draw, drag to aim, lift to loose · button: Full or Half sets the draw; Trick nocks a trick arrow |
    | `widow` | tap: Tap a tile to step towards it, or a guard to bite him · button: Or use the pad: the middle button waits a turn |
    | `smash` | swipe: Swipe sideways to change lanes, and up to leap · tap: Tap to smash |
    | `thwip` | hold: Hold anywhere to swing, and let go to fly · drag: Hold on the left or right of the screen to steer |
    | `tesseract` | button: Hold Thrust, and the lean buttons · hold: Or hold a finger on the view: the jet leans towards it |

  - `nextFor`: the first of `prog.places` with `p.stone && !p.done && p.id !== here`. Its `to` is `linkOf(p.id)`. Return `to ? { id, label: p.name, to } : null`. It skips this building because a loss here would otherwise point back at it.
  - `fmt = (n) => Math.round(n).toLocaleString('en-US')`.
  - `scoreLine`: `null` for a `null` score. Otherwise `big = format(score)`, and `small` is `'a new best'`, else `` `best ${format(best)}` `` when there is a best, else `'points'`.
  - `stoneWords`: `` half ? `${half} half of the ${name} is yours.` : `The ${name} is yours.` ``.
  - `watchHidden`: without a `doc`, return a no-op stop. Otherwise add a `visibilitychange` listener that calls `onHide()` when `doc.hidden`, and return its removal.
- [ ] **Step 4: Write `hq/useGame3D.js`.** `useGame3D(game)`:
  - `site = use3D()`; `[local, setLocal] = useState(() => readLocal3D(game))`.
  - `set = useCallback((m) => { writeLocal3D(game, m); setLocal(m); if (m !== 'off' && site.held) site.hold?.load(); }, …)`.
  - Return `{ ...site, local, on: resolveLocal3D(local, site), mode: local === 'auto' ? site.mode : local, set }`.
  - Comment: never the site’s switch, which stays in Settings (spec §5).
- [ ] **Step 5: The runtime’s say.**
  - In `src/runtime/useWorld.js`, beside `recoverNow` (`:54`): `export const wants3D = (enabled, siteOn, own3D = false) => Boolean(enabled && (own3D || siteOn));`. One comment line: a page with a 3D switch of its own (an HQ game, `hq/useGame3D.js`) decides with `enabled` alone; every other page still asks the site.
  - Add `own3D = false` to `useWorld`’s options (`:107`), and make `:124` read `const wanted = wants3D(enabled, three.on, own3D);`.
  - In `hq/useStage.js`, add `own3D = false` to the options at `:117` and pass `own3D` in the `useWorld` options at `:143`. Invincible’s calls are unchanged.
- [ ] **Step 6: Run them to see them pass.** Run `npx vitest run src/components/avengers/hq/gameScreen.test.js src/runtime/useWorld.test.js src/components/avengers/shared`, then `npx eslint src/components/avengers/hq src/runtime/useWorld.js`. Expected: every file passes, each under 1 s (`shared/runtime.test.js` still pins its five names). ESLint prints nothing.
- [ ] **Step 7: Commit.** `git add` the six files. Subject: `Avengers HQ: each game keeps its own 3D choice, and the game screen’s rules in one pure module`.

### Task 2: The game screen’s parts: HQGame and its bar, the start note, touch help and the results card

**Files:**
- Create: `src/components/avengers/hq/HQGame.jsx`, `src/components/avengers/hq/HQGame.test.jsx`, `src/components/avengers/hq/Results.jsx`, `src/components/avengers/hq/Results.test.jsx`
- Modify: `src/components/avengers/hq/hq.css` (append only, after PR 2’s `.hq-game .btn:disabled`)

**Interfaces:**
- Consumes: Task 1’s `switchFor`, `TOUCH_HELP`, `scoreLine`, `stoneWords`, `fmt` and `watchHidden`. `HQFrame({ stage, three, fallback, children, label, screenProps = {}, className = '', accent })` (`hq/HQFrame.jsx:9`, unchanged). `hasEarned` (`hq/stones.js:38`). `STONES` (`interests/stones.js`). `Link` from `react-router-dom`.
- Produces:
  - `hq/HQGame.jsx`:
    - default `HQGame({ game, stage, three, fallback, flat = null, playing = false, paused = false, onPause = null, accent, className = '', children, ...frame })`, where `frame` is HQFrame’s `label` and `screenProps`.
    - `GameScreen = createContext(null)`. Its value is `{ id, name, blurb, accent, stone: { id, name, color, half } | null, onBack(), next() → { id, label, to, state } | null }`, where `half` is `HALF_OF[id]` or `null`.
    - `GameBar({ name, onBack, backRef, children })`, `StartNote()` and `TouchHelp({ game })`.
  - `hq/Results.jsx`:
    - default `Results(props)`.
    - `ResultsCard({ won = false, kicker = '', title, line = '', stone = null, half = null, stoneText = '', score = null, best = 0, newBest = false, format, stars = null, onward = null, againLabel = 'Play again', onAgain, onBack = null, next = null, more = null, className = '', children })`.
    - `stars` is `{ got, of }`. `onward` and `more` are `{ label, onClick }`. `next` is `{ id, label, to, state }`.
  - CSS hooks: `.hq-full`, `.hq-bar`, `#hq-bar-title`/`.hq-bar-title`, `.hq-bar-acts`, `.hq-bar-back`, `.hq-bar-more`, `.hq-bar-key`, `.hq-game-full`, `.hq-toy`, `.hq-toy-note`, `.hq-start-blurb`, `.hq-touch`, `.hq-touch-icon`, `.hq-results`, `.hq-results-actions`, `.hq-stars`.

- [ ] **Step 1: Write the failing tests.** `hq/HQGame.test.jsx` keeps its helpers at the top level, because PR 7 reuses them:

```jsx
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import HQGame, { GameScreen, StartNote, TouchHelp } from './HQGame';
import { GAMES } from './gameScreen';

const SCREEN = { id: 'hawkeye', name: 'The range', blurb: 'A clearing past the hangar.', accent: '#c9a2ff', stone: { id: 'soul-clint', name: 'Soul Stone', color: '#ff8a00', half: 'Clint’s' }, onBack() {}, next: () => null };
const stage = (o) => ({ wrap: { current: null }, host: { current: null }, status: 'on', retry() {}, ...o });
const three = (o) => ({ on: true, can: true, auto: true, mode: 'auto', local: 'auto', set() {}, ...o });
const html = (el, screen = SCREEN) => renderToStaticMarkup(<GameScreen.Provider value={screen}>{el}</GameScreen.Provider>);
const barOf = (out) => out.slice(out.indexOf('<header'), out.indexOf('</header>') + 9);
const noteOf = (out) => (out.match(/<p class="hq-toy-note"[\s\S]*?<\/p>/) ?? [''])[0];
const game = (o = {}) => <HQGame game="trickshot" stage={stage(o.stage)} three={three(o.three)} fallback={<p>toy</p>} label="Trick Shot" playing={o.playing ?? true} paused={o.paused ?? false} onPause={() => {}} flat={o.flat}><i>hud</i></HQGame>;

describe('the game screen', () => {
  it('puts the game under a slim bar: the place, its 3D switch, Pause while playing and Back with Esc', () => {
    const out = html(game());
    const bar = barOf(out);
    expect(bar).toContain('class="hq-bar"');
    expect(bar).toContain('id="hq-bar-title"');
    expect(bar).toContain('The range');
    expect(bar).toMatch(/aria-pressed="true"[^>]*>3D game: on</);
    expect(bar).toMatch(/aria-pressed="false"[^>]*>Pause</);
    expect(bar).toContain('<kbd>Esc</kbd>');
    expect(out).toContain('hq-game-full');
    expect(out).toContain('class="hq-screen"');
    expect(out).toContain('<i>hud</i>');
    expect(out).not.toContain('<p>toy</p>');
    expect(barOf(html(game({ playing: false })))).not.toContain('Pause');
    expect(barOf(html(game({ paused: true })))).toMatch(/aria-pressed="true"[^>]*>Resume</);
  });
  it('shows the toy, the place’s note, one line and Try 3D when this game’s 3D is off', () => {
    const out = html(game({ stage: { status: 'idle' }, three: { on: false } }));
    expect(out).toContain('<p>toy</p>');
    expect(noteOf(out)).toContain('The stone here is won in the 3D game.');
    expect(noteOf(out)).toContain('>Try 3D<');
    expect(out).toContain('A clearing past the hangar.');
    expect(out).not.toContain('class="hq-screen"');
  });
  it('offers Try 3D again when the 3D failed', () => {
    const note = noteOf(html(game({ stage: { status: 'failed' } })));
    expect(note).toContain('3D couldn’t start here, so here is the simple version.');
    expect(note).toContain('>Try 3D again<');
  });
  it('draws a 2D view in place of the toy, keeps the failure line and leaves the start note to the view', () => {
    const off = html(game({ stage: { status: 'idle' }, three: { on: false }, flat: <i>flat</i> }));
    expect(off).toContain('<i>flat</i>');
    expect(off).not.toContain('<p>toy</p>');
    expect(barOf(off)).toContain('>Play in 3D<');
    expect(off).not.toContain('The stone here is won in the 3D game.');
    expect(off).not.toContain('A clearing past the hangar.');
    const failed = html(game({ stage: { status: 'failed' }, flat: <i>flat</i> }));
    expect(failed).toContain('<i>flat</i>');
    expect(noteOf(failed)).toContain('>Try 3D again<');
  });
  it('is the bare frame outside a game screen', () => {
    const out = renderToStaticMarkup(game());
    expect(out).not.toContain('hq-bar');
    expect(out).toContain('hq-game-full');
  });
  it('brings the place’s blurb and its stone line into the start overlay', () => {
    const out = html(<StartNote />);
    expect(out).toContain('A clearing past the hangar.');
    expect(out).toContain('Win it, and Clint’s half of the Soul Stone comes back to the compound.');
    expect(out).toContain('--glow:#ff8a00');
    expect(html(<StartNote />, { ...SCREEN, stone: { id: 'power', name: 'Power Stone', color: '#8e2de2', half: null } })).toContain('Win it, and the Power Stone comes back to the compound.');
    expect(html(<StartNote />, { ...SCREEN, stone: null })).not.toContain('hq-stone');
    expect(renderToStaticMarkup(<StartNote />)).toBe('');
  });
  it('lists a game’s touch controls in words and icons', () => {
    const out = renderToStaticMarkup(<TouchHelp game="smash" />);
    expect(out).toContain('class="hq-touch"');
    expect(out).toContain('Swipe sideways to change lanes, and up to leap');
    expect(out).toContain('Tap to smash');
    expect(out.match(/<svg/g)).toHaveLength(2);
    for (const g of GAMES) expect(renderToStaticMarkup(<TouchHelp game={g} />)).not.toMatch(/<svg[^>]*><\/svg>/);
    expect(renderToStaticMarkup(<TouchHelp game="nope" />)).toBe('');
  });
});
```

`hq/Results.test.jsx` imports `{ describe, expect, it, vi }` from `vitest`, `renderToStaticMarkup`, `{ Link, MemoryRouter }` from `react-router-dom`, `Results, { ResultsCard }` from `./Results`, `{ GameScreen }` from `./HQGame` and `{ STONES }` from `../../interests/stones`. It copies the `walk` element-tree helper from `src/pages/Worlds.test.jsx:14-21`, and defines `const noop = () => {}`, `const r = (p) => renderToStaticMarkup(<MemoryRouter><ResultsCard onAgain={noop} onBack={noop} {...p} /></MemoryRouter>)` and `const byLabel = (els, t) => els.find((e) => e.type === 'button' && [e.props.children].flat().join('') === t)`.

```jsx
describe('the results card', () => {
  it('a win: the stone in its own colour, the score against the best and the way on', () => {
    const out = r({ won: true, kicker: 'Stark Industries · test field', title: 'Ultron Prime is down.', score: 12340, best: 15200, stone: 'power', stoneText: 'The Power Stone is yours.', next: { id: 'thor', label: 'Mjolnir', to: '/avengers/lawn' } });
    expect(out).toContain('data-tone="won"');
    expect(out).toContain('12,340');
    expect(out).toContain('best 15,200');
    expect(out).toContain('--glow:#8e2de2');
    expect(out).toContain('href="/avengers/lawn"');
    expect(out).toMatch(/btn-primary[^>]*>Next: Mjolnir</);
    expect(out).toContain('Play again');
    expect(out).toContain('Back to the compound');
  });
  it('takes each whole stone’s colour from the gauntlet’s table', () => {
    for (const s of STONES) expect(r({ won: true, title: 'x', stone: s.id })).toContain(`--glow:${s.color}`);
  });
  it('a loss: Play again first, no stone and no way on when there is none', () => {
    const out = r({ won: false, title: 'Armour failed.', score: 900, best: 15200, next: null });
    expect(out).toContain('data-tone="lost"');
    expect(out).not.toContain('Next:');
    expect(out).not.toContain('hq-stone');
    expect(out).toMatch(/btn-primary[^>]*>Play again</);
    expect(r({ won: true, title: 'x', score: 16000, best: 15200, newBest: true })).toContain('a new best');
    expect(r({ won: true, title: 'x', stone: 'soul', half: 'Clint’s' })).toContain('Clint’s half of the Soul Stone is yours.');
  });
  it('stars where the game keeps them, a way on inside the game first and its own way back last', () => {
    const out = r({ won: true, title: 'Nice throwing.', stars: { got: 2, of: 3 }, onward: { label: 'Next room', onClick: noop }, more: { label: 'All rooms', onClick: noop } });
    expect(out).toContain('aria-label="2 of 3 stars"');
    expect(out.match(/data-on/g)).toHaveLength(2);
    expect(out.indexOf('Next room')).toBeLessThan(out.indexOf('Play again'));
    expect(out).toMatch(/btn-primary[^>]*>Next room</);
    expect(out.indexOf('All rooms')).toBeGreaterThan(out.indexOf('Back to the compound'));
  });
  it('says what Play again says when the game names it', () => {
    const again = vi.fn();
    const out = r({ won: false, title: 'The line broke.', onAgain: again, againLabel: 'From wave 1', onward: { label: 'Restart at the boss', onClick: noop } });
    expect(out).toContain('>From wave 1<');
    expect(out).not.toContain('Play again');
    expect(out).toMatch(/btn-primary[^>]*>Restart at the boss</);
    expect(byLabel(walk(ResultsCard({ title: 't', onAgain: again, againLabel: 'From wave 1' })), 'From wave 1').props.onClick).toBe(again);
  });
  it('hands each button its callback, and Next replaces the address', () => {
    const again = vi.fn(), back = vi.fn(), on = vi.fn(), more = vi.fn();
    const els = walk(ResultsCard({ won: true, title: 't', onAgain: again, onBack: back, onward: { label: 'Next room', onClick: on }, more: { label: 'All rooms', onClick: more }, next: { id: 'cap', label: 'The training center', to: '/avengers/training', state: { hq: true } } }));
    expect(byLabel(els, 'Play again').props.onClick).toBe(again);
    expect(byLabel(els, 'Back to the compound').props.onClick).toBe(back);
    expect(byLabel(els, 'Next room').props.onClick).toBe(on);
    expect(byLabel(els, 'All rooms').props.onClick).toBe(more);
    const link = els.find((e) => e.type === Link);
    expect([link.props.to, link.props.replace, link.props.state]).toEqual(['/avengers/training', true, { hq: true }]);
  });
  it('reads Back and Next from the game screen when the game doesn’t say', () => {
    const screen = { onBack: noop, next: () => ({ id: 'cap', label: 'The training center', to: '/avengers/training' }) };
    const out = renderToStaticMarkup(<MemoryRouter><GameScreen.Provider value={screen}><Results won title="Done." onAgain={noop} /></GameScreen.Provider></MemoryRouter>);
    expect(out).toContain('Next: The training center');
    expect(out).toContain('href="/avengers/training"');
    expect(out).toContain('Back to the compound');
    expect(renderToStaticMarkup(<MemoryRouter><Results won title="Done." onAgain={noop} /></MemoryRouter>)).not.toContain('Next:');
  });
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/hq/HQGame.test.jsx src/components/avengers/hq/Results.test.jsx`. Expected: `Failed to resolve import "./HQGame"` and `"./Results"`.
- [ ] **Step 3: Write `hq/HQGame.jsx`.**
  - `GameBar` renders `<header className="hq-bar">`. Inside:
    - `<h2 id="hq-bar-title" className="hq-bar-title">`;
    - then `<div className="hq-bar-acts">`, holding `{children}` and the Back button: `type="button"`, `className="btn btn-ghost btn-sm hq-bar-back"`, `ref={backRef}`, `onClick={onBack}`. Its content is `Back<span className="hq-bar-more"> to the compound</span> <span className="hq-bar-key"><kbd>Esc</kbd></span>`.
    - The `<kbd>` is styled by the existing `.cw-place kbd` (`world.css:71`). Add no `kbd` rule.
  - `HQGame`:
    - `screen = useContext(GameScreen)`. `sw = switchFor({ can: three.can, on: three.on, status: stage.status, flat: Boolean(flat), stone: Boolean(screen?.stone) })`. `act(next)`: `'retry'` → `stage.retry()`; otherwise `three.set(next)`. Never the site’s switch.
    - Renders `<div className="hq-full" data-game={game} style={{ '--hq-accent': accent ?? screen?.accent }}>`.
    - The bar comes first, only when `screen` is set. It holds the `sw.bar` button (`aria-pressed` only when `pressed` is defined), and, when `onPause && playing`, a Pause button: `aria-pressed={paused}`, reading `Pause` or `Resume`.
    - Then `` <HQFrame stage={stage} three={three} fallback={toy} className={`${className} hq-game-full`.trim()} {...frame}>{children}</HQFrame> ``.
    - `toy` is `<div className="hq-toy">` holding: `{!flat && <StartNote />}`; then `sw.note` as `<p className="hq-toy-note" role="status">` (its text, then its action as a `btn btn-ghost btn-sm` button); then `{flat ?? fallback}`.
  - `HQGame` effects:
    - On mount, focus `stage.wrap.current?.querySelector('.hq-screen') ?? backRef.current`, with `preventScroll`.
    - While `playing && !paused && onPause`: `return watchHidden(document, () => onPauseRef.current?.(true))`.
    - The Pause button’s click is `onPause(!paused)`. On resume, focus `.hq-screen`.
  - `StartNote()`:
    - Without a screen, return `null`.
    - With a blurb, render `<p className="hq-start-blurb">`.
    - With a stone, render `<p className="hq-stone" style={{ '--glow': stone.color }}><span className="stone-dot" aria-hidden="true" />…</p>`. Its text is `Place.jsx:200`’s, verbatim: `` won ? `You won ${lead}${name} back here.` : `Win it, and ${lead}${name} comes back to the compound.` ``, where `` lead = half ? `${half} half of the ` : 'the ' `` and `won = hasEarned(stone.id)`, read at render.
  - `TouchHelp({ game })`:
    - Returns `null` without rows. Otherwise `<ul className="hq-touch" aria-label="Touch controls">`, each `<li>` holding `<svg className="hq-touch-icon" viewBox="0 0 24 24" aria-hidden="true">{ICON[icon]}</svg>` and the text.
    - `ICON` uses abstract shapes only:
      - `tap`: a filled circle r 4 in a ring r 8;
      - `hold`: a filled circle r 6 in a ring r 10, stroke 3;
      - `drag`: a dot at (6, 12), a line to (19, 12) and an arrowhead;
      - `swipe`: two chevrons;
      - `button`: a rect at 4, 7, 16 × 10, rx 3.
- [ ] **Step 4: Write `hq/Results.jsx`.**
  - `ResultsCard` is hook-free, so the test can call it.
  - It renders `` <div className={`hq-overlay hq-results ${className}`.trim()} data-tone={won ? 'won' : 'lost'}> ``, holding in order:
    1. the kicker (`.hq-overlay-kicker`);
    2. `<p className="hq-overlay-title" role="status">`;
    3. stars as `` <p className="hq-stars" aria-label={`${got} of ${of} stars`}> ``, with `of` spans of `★` and `data-on` on the first `got`;
    4. the line (`.hq-overlay-text`);
    5. `scoreLine` as `<p className="hq-overlay-score">{big}<small>{small}</small></p>`;
    6. with a stone, `<p className="hq-stone" style={{ '--glow': row.color }}>` with a stone dot and `stoneText || stoneWords(row.name, half)`, where `row` comes from `STONES`;
    7. `{children}`;
    8. `<div className="hq-results-actions">`.
  - The actions, in order:
    1. `onward`;
    2. `againLabel` (`onAgain`);
    3. `next` as `<Link to={next.to} replace state={next.state}>` with the text `` {`Next: ${next.label}`} `` (one string, so the server markup has no separator);
    4. `Back to the compound` (`onBack`), when set;
    5. `more`.

    The primary is `onward` if given, otherwise Next when `won && next`, otherwise Play again. Every other action is `btn-ghost`. All are full `.btn`, 44 px.
  - The default `Results(props)` reads `s = useContext(GameScreen)` and renders `<ResultsCard {...props} onBack={props.onBack ?? s?.onBack ?? null} next={props.next !== undefined ? props.next : (s?.next?.() ?? null)} />`.
- [ ] **Step 5: Append to `hq/hq.css`.** Start with a comment: `/* the game screen (hq/HQGame): the game over the whole window under a slim bar */`. All rules are scoped under the new classes:
  - **Frame and bar.**
    - `.hq-full`: `flex: 1; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); background: #05070b`.
    - `.hq-bar`: flex, space-between, gap `0.75rem`, `min-height: 3rem`, padding `0.35rem clamp(0.75rem, 3vw, 1.5rem)`, `world.css:207`’s gradient and ink, and `border-bottom: 2px solid var(--hq-accent, var(--cw-accent))`.
    - `.hq-bar-title`: `world.css:210`’s Bebas Neue at `clamp(1.15rem, 1rem + 0.6vw, 1.5rem)`, nowrap with an ellipsis.
    - `.hq-bar .btn`: `world.css:208`’s glass.
  - **Coarse pointers and narrow screens.** `@media (hover: none) and (pointer: coarse) { .hq-bar .btn, .hq-toy-note .btn { min-height: 44px } .hq-bar-key { display: none } }` and `@media (max-width: 560px) { .hq-bar-more { display: none } }`.
  - **The screen.**
    - `.hq-game-full`: `height: 100%; min-height: 0; grid-template-rows: minmax(0, 1fr); gap: 0`.
    - `.hq-game-full > .hq-switch { display: none }`, because the bar and the note say it instead.
    - `.hq-game-full .hq-screen`: `height: 100%; aspect-ratio: auto; max-height: none; border: 0; border-radius: 0`.
    - `.hq-game-full .hq-overlay`: `overflow-y: auto; place-content: safe center`.
  - **The toy.**
    - `.hq-toy`: `height: 100%; overflow-y: auto; padding: 1.5rem clamp(1rem, 4vw, 2.5rem); background: var(--bg)`.
    - `.hq-toy-note`: flex, gap `0.75rem`, `0.85rem`, `var(--muted)`.
  - **The start overlay.**
    - `.hq-start-blurb`: `max-width: 54ch`, the `.hq-overlay-text` size.
    - `.hq-overlay .hq-start-blurb`: `rgba(255, 255, 255, 0.84)`.
    - `@media (max-height: 700px) { .hq-overlay .hq-start-blurb { display: none } }`, which keeps Start in view at 1024 × 640. The stone line always shows.
  - **Touch help.** `.hq-touch { display: none }`, shown as a wrapping centred flex row (`0.8rem`, `max-width: 48ch`, `margin-top: 0.8rem`) under the same coarse-pointer query that hides `.hq-keys` (`hq.css:22`). `.hq-touch-icon`: `1.3rem`, `flex: none`.
  - **The card.**
    - `.hq-results`: `background: rgba(4, 7, 12, 0.82)` (glass, 0.78 or more).
    - `.hq-results .hq-overlay-score small`: `font-size: 0.72rem` (the shared `0.68rem` is under the floor).
    - `.hq-results-actions`: flex wrap, centred, gap `0.75rem`, `margin-top: 1.25rem`.
    - `.hq-results .btn-ghost`: white ink on `rgba(255, 255, 255, 0.08)`, border `rgba(255, 255, 255, 0.4)`.
    - `.hq-stars`: takes `ricochet.css:20-22`’s three `.cap-stars` rules, renamed. Task 4 deletes the originals.
- [ ] **Step 6: Run them to see them pass.** Run `npx vitest run src/components/avengers/hq` and `npx eslint src/components/avengers/hq`. Expected: every file passes, each test under 1 s. ESLint prints nothing.
- [ ] **Step 7: Commit.** `git add src/components/avengers/hq/HQGame.jsx src/components/avengers/hq/HQGame.test.jsx src/components/avengers/hq/Results.jsx src/components/avengers/hq/Results.test.jsx src/components/avengers/hq/hq.css`. Subject: `Avengers HQ: the game screen’s parts: a slim bar, the start note, touch help and one results card`.

### Task 3: Every building’s game full screen in HQGame, with its own 3D and a Pause

**Files:**
- Modify:
  - `src/components/avengers/world/Place.jsx`: the imports (`:1-16`), and `Place` (`:155-214`: the `back` ref, its focus, the header, the blurb and the stone pill).
  - `src/components/avengers/world/world.css`: delete `:207-215` and `:233`.
  - The eight games: the `HQFrame` import (`:2`), the `use3D` import (`:7` or `:8`), the `three`/`stage` lines and the `<HQFrame`/`</HQFrame>` tags, as listed below.
  - `docs/architecture.md:27`.
- Test: `src/components/avengers/hq/HQGame.test.jsx`

**Interfaces:**
- Consumes: Task 1’s `useGame3D`, `nextFor`, `GAMES` and `useStage`’s `own3D`; Task 2’s `HQGame`, `GameBar` and `GameScreen`; `HALF_OF` and `stoneFor` (PR 2, `world/labels.js`); `linkOf` (PR 3); `progress`, `placeById`; `earnedStones`, `SOUL_HALVES` and `hasEarned` (`hq/stones.js`).
- Produces: all eight games inside `HQGame` with `game="<id>"`, `playing` and `onPause`. Place provides `GameScreen`, and its dialog is labelled by `#hq-bar-title`. The 3D-off toy branch shows `StartNote` and the note. In every game, `paused` is the game’s own state, and `pause(p)` releases held input as its Esc/P handler does.

- [ ] **Step 1: Write the failing tests.** Add to `HQGame.test.jsx` (Task 4 and Task 5 reuse `FILES` and `src`):

```jsx
const FILES = { repulsor: 'repulsor/RepulsorRange.jsx', lawn: 'lawn/HoldTheLawn.jsx', ricochet: 'ricochet/Ricochet.jsx', trickshot: 'trickshot/TrickShot.jsx', widow: 'widow/Infiltration.jsx', smash: 'smash/SmashRun.jsx', thwip: 'thwip/Thwip.jsx', tesseract: 'tesseract/TesseractRun.jsx' };
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('the eight games on the game screen', () => {
  it.each(GAMES)('%s sits in HQGame with its own 3D and a Pause', (id) => {
    const s = src(FILES[id]);
    expect(s).toContain(`useGame3D('${id}')`);
    expect(s).toContain('own3D: true');
    expect(s).toContain(`game="${id}"`);
    expect(s).toMatch(/onPause=\{/);
    expect(s).not.toMatch(/\buse3D\(/);
    expect(s).not.toContain('hq/HQFrame');
  });
  it('leaves Invincible’s game on HQFrame as it was', () => {
    expect(src('../invincible/thinkmark/ThinkMark.jsx')).toContain("import HQFrame from '../../avengers/hq/HQFrame'");
  });
  it('lets Place hand the game its place, with no header of its own', () => {
    const place = src('world/Place.jsx');
    expect(place).toContain('<GameScreen.Provider');
    expect(place).toContain('aria-labelledby="hq-bar-title"');
    expect(place).not.toContain('cw-place-head');
    expect(src('world/world.css')).not.toMatch(/\.cw-place-(head|sub|title|body|intro|stone)\b/);
  });
});
```

- [ ] **Step 2: Run it to see it fail.** Run `npx vitest run src/components/avengers/hq/HQGame.test.jsx`. Expected: each `%s sits in HQGame…` case fails (for example, expected the source to contain `useGame3D('repulsor')`), and so does the Place case.
- [ ] **Step 3: Place provides the game screen.**
  - Imports: `useMemo`; `useLocation` from `react-router-dom`; `{ GameBar, GameScreen }` from `'../hq/HQGame'`; `{ nextFor }` from `'../hq/gameScreen'`; `{ SOUL_HALVES, earnedStones, hasEarned }` from `'../hq/stones'`; `{ HALF_OF, stoneFor }` from `'./labels'`; `{ placeById, progress }` from `'./rules'`; `{ linkOf }` from `'./links'`.
  - Keep the Esc, scroll-lock and focus-restore effect (`:160-174`). Keep the `back` ref, but only for the Suspense fallback’s `GameBar`, so focus lands in the dialog while a cold chunk loads.
  - Build `screen` with `useMemo`:
    - `{ id, name: p.name, blurb: p.blurb, accent: p.accent }`;
    - `stone: st && { id: p.stone, name: st.name, color: st.color, half: HALF_OF[p.stone] ?? null }`, where `st = stoneFor(p)`;
    - `onBack: () => leaveRef.current()`;
    - `next: () => { const n = nextFor(progress([...earnedStones(), ...SOUL_HALVES.filter(hasEarned)]), id, linkOf); return n && { ...n, state: location.state }; }`.

    Carrying `location.state` keeps PR 3’s Back working after Next.
  - The portal body becomes `<div className="cw-place" role="dialog" aria-modal="true" aria-labelledby="hq-bar-title" style={{ '--cw-accent': p.accent }}><GameScreen.Provider value={screen}><Suspense fallback={<><GameBar name={p.name} onBack={onLeave} backRef={back} /><p className="shell py-6 text-muted">Opening the door…</p></>}><Game id={id} onPortal={onPortal} /></Suspense></GameScreen.Provider></div>`.
  - The header, the blurb, the stone pill and the `won` and `half` lines go: `StartNote` says them now.
- [ ] **Step 4: Drop the old head in `world.css`.** Delete `:207-215` (`.cw-place-head` through `.cw-place-stone:not([data-won]) .stone-dot`) and `:233` (`.cw-place-head .btn kbd { display: none; }`, a key-cap rule, so `kbd-styles` falls by one). Keep `:71`, `:87`, `:206` and `:216`.
- [ ] **Step 5: Each game onto HQGame.** Make the same four edits in each of the eight files:
  1. `import HQFrame from '../hq/HQFrame'` becomes `import HQGame from '../hq/HQGame'`.
  2. `import { use3D } from '../../../lib/gpu'` becomes `import { useGame3D } from '../hq/useGame3D'`.
  3. The two hook lines become `const three = useGame3D('<id>'); const stage = useStage(gameModule, { enabled: three.on, id: '<id>', forced: three.mode === 'on', own3D: true });`.
  4. `<HQFrame` becomes `<HQGame game="<id>" playing={…} paused={paused} onPause={pause}`, with the tag closed to match. Keep every other prop.

  `playing` and `pause` for each game:

  | game (frame tag at `ddb364bf`) | `playing` | `pause = (p) => …` |
  | --- | --- | --- |
  | Repulsor (`:359`) | `playing` | `game.current.input.firing = false; setPaused(p)` (as `:318-323`) |
  | Lawn (`:453`) | `playing \|\| lifting` | `input.current.keys.clear(); setPaused(p)` (as `:406-410`) |
  | Trick Shot (`:412`) | `live` | `letDown(game.current); setPaused(p)` (as `:365-369`) |
  | Smash (`:339`), Thwip (`:290`) | `playing` | `setPaused(p)` |
  | Tesseract (`:410`) | `playing` | `input.current.keys.clear(); setPaused(p)` (as `:354-358`) |
  | Ricochet (`:241`) | `live` | `aim.current.pointer = false; setPaused(p)` |
  | Infiltration (`:382`) | `playing` | `setPaused(p)` |

- [ ] **Step 6: A pause for the two games without one.**
  - **Ricochet:**
    - Add `const [paused, setPaused] = useState(false)`. `enter()` sets it to `false`.
    - The tick’s `live` (`:167`) gains `&& !paused`, and `paused` joins its deps. `onPointerDown`, `onKeyDown` and `doThrow` return when paused. `.cap-touch` (`:264`) renders only when `live && !paused`.
    - The overlay condition (`:279`) becomes `(!live || paused)`. Its first branch is `paused`: `Paused`, the text `Room {index + 1} of {ROOMS.length}, {def.name}.`, and a `btn btn-primary mt-4` `Resume` that calls `setPaused(false)` and focuses the screen.
  - **Infiltration:**
    - Add `paused`; `enter()` sets it to `false`. `onKeyDown` returns after its `!playing` block when paused. `doAction` and the tile clicks return when paused. The `caught` timer may finish.
    - Add `{playing && paused && <div className="hq-overlay iw-overlay">…</div>}`, holding `Paused`, `Level {index + 1}, {def.name}.` and `Resume`.
- [ ] **Step 7: The architecture page.** In `docs/architecture.md:27`, after “`Place.jsx` opens each building’s game”, add: “full screen in `../hq/HQGame.jsx` (each with its own 3D switch) with `../hq/Results.jsx` at its end”. Add `tp-hq-3d-<game>` to that line’s saves.
- [ ] **Step 8: Run it to see it pass.**
  - Run `npx vitest run src/components/avengers src/runtime/useWorld.test.js`. Expected: all pass, none skipped.
  - Run `npx eslint src/components/avengers`. Expected: no output.
  - Run `npm run build && git checkout public/github.json`. Expected: `✓ built`.
  - Run `wc -l` on the eight games. Expected: each under 800.
- [ ] **Step 9: Commit.** Subject: `Avengers HQ: every building’s game full screen under a slim bar, with its own 3D and a Pause`.

### Task 4: Every game opens on its start note and ends on the results card

**Files:**
- Modify: the eight games’ overlay blocks (at `ddb364bf`: Repulsor `:432-487`, Lawn `:545-603`, Ricochet `:279-341`, Trick Shot `:494-571`, Infiltration `:466-526`, Smash `:387-443`, Thwip `:334-382`, Tesseract `:489-588`); `ricochet/ricochet.css:20-22`; `tesseract/tesseract.css:51-59, :64-67, :76, :81`
- Test: `src/components/avengers/hq/HQGame.test.jsx`, `src/components/avengers/world/labels.test.js` (PR 2’s)

**Interfaces:**
- Consumes: Task 2’s `Results`, `StartNote` and `TouchHelp`, and Task 3’s `FILES` and `src`; `HALF_OF` (PR 2); PR 2’s Lawn `checkpoint`, `start` and `startBoss`, and Thwip’s `res.why`.
- Produces: every end of a run is a `Results`; every start overlay holds `<StartNote />` and `<TouchHelp game="<id>" />`; no game imports `stoneById` or draws `.hq-stone` itself; every `onAgain` is the game’s own start (PR 6 counts tries there).

- [ ] **Step 1: Write the failing tests.** In `HQGame.test.jsx`:

```jsx
describe('the start and the end of every game', () => {
  it.each(GAMES)('%s opens on its start note and touch help and ends on the results card', (id) => {
    const s = src(FILES[id]);
    expect(s).toContain('<StartNote />');
    expect(s).toContain(`<TouchHelp game="${id}" />`);
    expect(s).toMatch(/<Results\b/);
    expect(s).not.toContain('className="hq-stone"');
    expect(s).not.toMatch(/stoneById/);
  });
  it('Hold the Lawn keeps both ways back in after a loss past the checkpoint', () => {
    const s = src(FILES.lawn);
    expect(s).toMatch(/label: 'Restart at the boss', onClick: startBoss/);
    expect(s).toContain("'From wave 1'");
  });
});
```

In PR 2’s `world/labels.test.js`, in “gives every game’s stone badge the stone’s own colour, and keeps the table in one place”, replace `expect(read(f), f).toMatch(/stoneById\('/);` with:

```js
expect(read(f), f).toMatch(/<Results\b/);
expect(read(f), f).not.toContain('className="hq-stone"');
```

Keep its name, its `not.toMatch(/'--glow': '#/)` and its `STONE_OF =` loop. The colour’s source is pinned in `Results.test.jsx` (“takes each whole stone’s colour…”), so the test keeps its strength.
- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/hq/HQGame.test.jsx src/components/avengers/world/labels.test.js`. Expected: the eight scan cases and the Lawn case fail. `labels.test.js` fails on `<Results`.
- [ ] **Step 3: The common pattern.**
  - Import `HQGame, { StartNote, TouchHelp }` and `Results from '../hq/Results'`. Delete the `stoneById` import that PR 2 added. Halves import `HALF_OF` from `'../world/labels'` instead.
  - Each overlay `{(!playing || paused) && <div className="hq-overlay X">…</div>}` becomes `{(!playing || paused) && (ended && !paused ? <Results className="X" … /> : <div className="hq-overlay X">{paused ? (unchanged) : (the start only)}</div>)}`.
  - The start branch loses its dead `ended`/`res` conditionals. It gains `<StartNote />` right after its `.hq-overlay-text` and `<TouchHelp game="<id>" />` right after its `.hq-keys` (or after the text, where there is none).
  - Each `.hq-stone` pill, with its colour, goes into `Results`.
  - Results props for each game. Copy each “line” verbatim from the overlay it replaces. Every card without its own `next` reads Next and Back from `GameScreen`.

  | game | ends | `Results` props |
  | --- | --- | --- |
  | Repulsor | won, lost | `className="ir-overlay" won={ui.phase === 'won'} kicker="Stark Industries · test field" title={ui.phase === 'won' ? 'Ultron Prime is down.' : 'Armour failed.'} line={ui.message} score={ui.score} best={best} newBest={ui.newBest} stone={ui.phase === 'won' && ui.stone ? 'power' : null} stoneText="The Power Stone is yours. It’s waiting in Thanos’s gauntlet." onAgain={start}` |
  | Lawn | `res` | `className="tl-overlay" won={res.won} kicker="The front lawn · a storm" title={res.won ? 'Cull Obsidian is down.' : 'The line broke.'} line={(:562-565’s won and lost sentences)} score={res.score} best={best} newBest={res.newBest} stone={res.won && res.stone ? 'reality' : null} stoneText="The Reality Stone is yours, out of the Aether." onAgain={start} onward={!res.won && checkpoint ? { label: 'Restart at the boss', onClick: startBoss } : null} againLabel={!res.won && checkpoint ? 'From wave 1' : undefined}` (PR 2’s two labels, kept) |
  | Smash | `res` | `` className="sr-overlay" won={Boolean(res.stone)} kicker="Midtown · 2012 · the portal is open" title="Banner’s back." line={(:405-407)} score={res.d} format={(n) => `${fmt(n)} m`} best={best} newBest={res.newBest} stone={res.stone ? 'time' : null} stoneText="The Time Stone is yours." onAgain={start} `` |
  | Thwip | `res` | `className="tw-overlay" won={res.won} kicker="Queens · the morning after the press conference" title={(PR 2’s :347 ternary, with Late for school.)} line={(PR 2’s :348-353)} score={res.score} best={best} newBest={res.newBest} onAgain={start}`. No stone: the gate has none. |
  | Ricochet | `cleared` | `` className="cap-overlay" won kicker={`Room ${index + 1} clear`} title={(:284’s stars line)} line={(:292-295)} stars={{ got: ui.result.stars, of: 3 }} stone={ui.result.stone ? 'mind' : null} stoneText="The Mind Stone is yours, out of Loki’s sceptre." onAgain={() => enter(index)} onward={index < ROOMS.length - 1 ? { label: 'Next room', onClick: () => enter(index + 1) } : null} more={{ label: 'All rooms', onClick: () => setUi((u) => ({ ...u, phase: 'menu' })) }} `` |
  | Ricochet | `failed` | `` className="cap-overlay" kicker={`Room ${index + 1}`} title={(:319)} line={(:320)} onAgain={() => enter(index)} `` |
  | Trick Shot | `done` only (the between-rounds card stays as it is) | `className="ts-overlay" won={Boolean(res?.stone)} kicker="The range · bow work" title={res?.stone ? 'He never misses.' : 'Out of rounds.'} line={(:527-529, PR 2’s copy)} score={res?.total ?? 0} best={best} newBest={res?.newBest} stone={res?.stone ? 'soul' : null} half={res?.whole ? null : HALF_OF['soul-clint']} stoneText={(:541’s ternary)} onAgain={() => begin(0)}` |
  | Infiltration | `cleared` (no loss: `caught` restarts the level) | `` className="iw-overlay" won kicker={`Level ${index + 1} · ${def.name} · clear`} title={(:473)} line={(:474-478)} stone={ui.result?.stone ? 'soul' : null} half={ui.result?.both ? null : HALF_OF['soul-natasha']} stoneText={(:482)} onAgain={() => enter(index)} onward={index + 1 < total ? { label: 'Next level', onClick: () => enter(index + 1) } : null} more={{ label: 'All levels', onClick: () => setUi((u) => ({ ...u, phase: 'menu' })) }} ``, with `<Dossier cleared={cleared} fresh={ui.fresh} onPick={enter} />` as children |
  | Tesseract | `crashed` (`:520-537`) | `` className="tr-overlay" kicker={`Leg ${game.current.leg + 1} · ${L.title}`} title={(:524)} line={(:525-527)} onAgain={() => start(game.current.leg)} more={{ label: 'Legs', onClick: (:532’s handler) }} `` |
  | Tesseract | `delivered` (`:538-588`) | `` className="tr-overlay" won kicker={`Leg ${res.leg + 1} · ${LEGS[res.leg].title}`} title={ui.won ? 'The Tesseract is home.' : 'Delivered.'} score={res.score} best={progress.best[res.leg] ?? res.score} newBest={res.isBest} stone={ui.won && ui.stone ? 'space' : null} stoneText="The Space Stone is yours. It opens a portal." onAgain={() => start(res.leg)} onward={ui.won ? { label: 'Open the portal', onClick: () => onPortal?.() } : { label: `Fly leg ${res.leg + 2}`, onClick: () => start(res.leg + 1) }} ``, with the set-down line (`set down at {res.touch.toFixed(1)} m/s`, from `:546`) and the `<dl className="tr-score">` (`:547-564`) as children |

  The Tesseract’s ready overlay (`:489-519`) gets `<StartNote />` after its text and `<TouchHelp game="tesseract" />` after its `.hq-keys`.
- [ ] **Step 4: The CSS the card leaves unused.** Delete `.cap-stars` (`ricochet.css:20-22`, now `.hq-stars`). Delete the `.tr-card*` rules: `tesseract.css:51-59` (the comment, `.tr-card`, its only user `@keyframes tr-rise` and the `.tr-card-*` rules), `:64-65`, the `.tr-card` halves of `:66-67`, `:76` and `:81`. Keep `.tr-score*` (`:60-63`) and `.tr-overlay .btn-ghost`. Check with `grep -rn "tr-card\|cap-stars" src`. Expected: no output.
- [ ] **Step 5: Run them to see them pass.**
  - Run `npx vitest run src/components/avengers`. Expected: all pass, `labels.test.js` included.
  - Run `npx eslint src/components/avengers`. Expected: no output, so no import is left unused.
  - Run `wc -l src/components/avengers/*/*.jsx | sort -n | tail -4`. Expected: `TesseractRun.jsx`, `TrickShot.jsx` and `HoldTheLawn.jsx` all under 800.
- [ ] **Step 6: Commit.** Subject: `Avengers HQ: every game opens on its place and ends on one results card, with the way on`. Body: PR 2’s badge assertion now reads `<Results`, and Results pins the colour to `STONES`.

### Task 5: Loading and coming back: doors fetched ahead, the veil on the way back, a welcome and Repulsor waits for its stage

**Files:**
- Create: `src/components/avengers/world/warm.js`, `warm.test.js`, `welcome.js`, `welcome.test.js`
- Modify:
  - `src/components/avengers/hq/gameScreen.js` + `.test.js` (`startable`);
  - `src/components/avengers/hq/HQGame.test.jsx`;
  - `src/components/avengers/repulsor/RepulsorRange.jsx` (`start` at `:88-98` and the `Suit up` button);
  - `src/components/avengers/world/CompoundWorld.jsx`: the top-level component; `World`’s signature, its `was` effect (`// out of a building: back outside its door`), the tick’s door lookup (`const door = grounded ? nearPlace(`), the `<LoadingVeil` and the `<CompoundHud` line;
  - `src/components/avengers/world/CompoundHud.jsx`: the signature, the stones chip (`cw-chip cw-stones`) and the `<Toast`;
  - `src/components/avengers/world/world.css` (after `:69`, and the reduced-motion list at `:236`);
  - `docs/architecture.md:27`.

**Interfaces:**
- Consumes: `nearPlace`, `progress`, `PLACES` and `START` (PR 1 barrel); `hqModule(...).warm = () => load()` (`hq/module.js:52`; each game’s `module.js` default-exports one); `LoadingVeil({ shown, progress, step, title })` (`worlds/LoadingVeil.jsx:21`) and the step `'first draw'` (`worlds/loadingSteps.js:7`); `Toast({ toast: { key, text, bad }, className })` (`runtime/hud/Toast.jsx`, imported from its file since PR 1); the runtime reports `'on'` only after drawing (`runtime/runtime.js:222-225`).
- Produces:
  - `world/warm.js`: `WARM_R = 15`; `doorNear(x, z) → placeId | null`; `LOADERS: { [placeId]: () => Promise<[Place, component, module]> }`; `warmDoor(id, { loaders = LOADERS, warmed = WARMED } = {}) → Promise | null`.
  - `world/welcome.js`: `gained(before, after) → string[]`; `welcomeFor(before, after) → string | null`; `returnVeil({ gl, back, prep }) → { shown, progress, step, title }`.
  - `hq/gameScreen.js`: `startable(status) → status === 'on'`.
  - CSS: `.cw-stones[data-pulse]`.

- [ ] **Step 1: Write the failing tests.** `world/warm.test.js` imports `{ describe, expect, it, vi }`, `{ LOADERS, WARM_R, doorNear, warmDoor }` from `./warm` and `{ PLACES, START }` from `./rules`. `world/welcome.test.js` imports `{ gained, returnVeil, welcomeFor }` from `./welcome`.

```js
describe('the doors, fetched ahead', () => {
  it('names the door within 15 m, and none from the start', () => {
    expect(WARM_R).toBe(15);
    for (const p of PLACES) {
      expect(doorNear(p.x + 10, p.z)).toBe(p.id);
      expect(doorNear(p.x + 16, p.z)).toBe(null);
    }
    expect(doorNear(START.x, START.z)).toBe(null); // the nearest door is 33 m from the start; doors are 36 m apart at the closest
  });
  it('has a game to fetch for every door', () => {
    expect(Object.keys(LOADERS).sort()).toEqual(PLACES.map((p) => p.id).sort());
  });
  it('fetches a door’s game once, and warms its module', async () => {
    const warm = vi.fn(() => Promise.resolve());
    const loaders = { stark: vi.fn(() => Promise.resolve([{}, {}, { default: { warm } }])) };
    const warmed = new Set();
    const a = warmDoor('stark', { loaders, warmed });
    expect(warmDoor('stark', { loaders, warmed })).toBe(null);
    await a;
    expect(loaders.stark).toHaveBeenCalledTimes(1);
    expect(warm).toHaveBeenCalledTimes(1);
    expect(warmDoor('nowhere', { loaders, warmed })).toBe(null);
  });
  it('tries again after a fetch that failed', async () => {
    const loaders = { stark: vi.fn(() => Promise.reject(new Error('offline'))) };
    const warmed = new Set();
    await warmDoor('stark', { loaders, warmed });
    expect(warmed.has('stark')).toBe(false);
    const again = warmDoor('stark', { loaders, warmed });
    expect(again).not.toBe(null);
    await again;
    expect(loaders.stark).toHaveBeenCalledTimes(2);
  });
});
```

`world/welcome.test.js`:

```js
const SEVEN = ['power', 'reality', 'mind', 'soul-clint', 'soul-natasha', 'soul', 'time'];
describe('coming back to the compound', () => {
  it('welcomes you back only with a new stone, naming the next building', () => {
    expect(gained(['power'], ['power', 'soul-clint'])).toEqual(['soul-clint']);
    expect(welcomeFor(['power'], ['power'])).toBe(null);
    expect(welcomeFor([], ['power'])).toBe('Next: Mjolnir');
    expect(welcomeFor(['power'], ['power', 'soul-clint'])).toBe('Next: Mjolnir');
    expect(welcomeFor([], ['time'])).toBe('Next: Tony Stark’s workshop');
    expect(welcomeFor(SEVEN, [...SEVEN, 'space'])).toBe('Every stone is back: walk under the portal over the helipad');
  });
  it('shows the way back as one draw of the compound, and a first visit as flying in', () => {
    const prep = { value: 0.4, step: 'load' };
    expect(returnVeil({ gl: 'on', back: true, prep })).toEqual({ shown: true, progress: 1, step: 'first draw', title: 'Back to the compound' });
    expect(returnVeil({ gl: 'loading', back: true, prep })).toEqual({ shown: true, progress: 0.4, step: 'load', title: 'Flying in to the compound' });
    expect(returnVeil({ gl: 'on', back: false, prep })).toEqual({ shown: false, progress: 0.4, step: 'load', title: 'Flying in to the compound' });
  });
});
```

In `gameScreen.test.js`:

```js
it('starts a game only on a stage that has drawn', () => {
  expect(startable('on')).toBe(true);
  for (const s of ['idle', 'loading', 'failed', 'slow', 'lost']) expect(startable(s)).toBe(false);
});
```

In `HQGame.test.jsx`:

```jsx
it('Repulsor Range waits for its stage before wave 1', () => {
  const s = src(FILES.repulsor);
  expect(s).toMatch(/if \(!startable\(stage\.status\)\) return;/);
  expect(s).toMatch(/disabled=\{!startable\(stage\.status\)\}/);
});
```

- [ ] **Step 2: Run them to see them fail.** Run `npx vitest run src/components/avengers/world/warm.test.js src/components/avengers/world/welcome.test.js src/components/avengers/hq`. Expected: `Failed to resolve import "./warm"` and `"./welcome"`, `startable is not a function` and the Repulsor scan fails.
- [ ] **Step 3: Write `world/warm.js`.**
  - It imports `nearPlace` from `'./rules'`.
  - `WARM_R = 15`, with the comment: about two seconds’ run from a door, so its game is fetched before he’s at it.
  - `doorNear = (x, z) => nearPlace(x, z, WARM_R)?.id ?? null`.
  - `LOADERS` has one entry a door, each a literal `() => Promise.all([import('./Place'), import('../<game>/<Component>'), import('../<game>/module')])`: `stark` repulsor/RepulsorRange, `thor` lawn/HoldTheLawn, `cap` ricochet/Ricochet, `hawkeye` trickshot/TrickShot, `widow` widow/Infiltration, `banner` smash/SmashRun, `spidey` thwip/Thwip, `vault` tesseract/TesseractRun. `Place.jsx` lazy-loads the same specifiers, so the chunks are shared.
  - `warmDoor` returns `null` without a loader, or when `warmed.has(id)`. Otherwise it adds `id` and returns `load().then((m) => m[2].default.warm()).catch(() => { warmed.delete(id); })`.
  - `WARMED` is a module-level `Set`, so each door warms at most once a page.
- [ ] **Step 4: Write `world/welcome.js`.**
  - It imports `progress` from `'./rules'`.
  - `gained = (before, after) => after.filter((s) => !before.includes(s))`.
  - `welcomeFor` returns `null` when nothing was gained. Otherwise, with `q = progress(after)`: `` q.finished ? 'Every stone is back: walk under the portal over the helipad' : `Next: ${q.places.find((x) => x.id === q.next).name}` ``.
  - `returnVeil`: `const returning = back && gl === 'on'`, then `{ shown: gl === 'loading' || returning, progress: returning ? 1 : prep.value, step: returning ? 'first draw' : prep.step, title: returning ? 'Back to the compound' : 'Flying in to the compound' }`. A compound never drawn (PR 3’s cold link) is flying in.
- [ ] **Step 5: Repulsor waits for its stage.**
  - In `gameScreen.js`: `export const startable = (status) => status === 'on';`.
  - In `RepulsorRange.jsx`, `start()` begins `if (!startable(stage.status)) return;`, and `stage.status` joins its deps.
  - The `Suit up` button gets `disabled={!startable(stage.status)}`. PR 2’s `.hq-game .btn:disabled` dims it by colour.
  - `:269` (`useStageFrame`) is unchanged. PR 6 puts its try after this guard.
- [ ] **Step 6: The compound’s side.**
  - `CompoundWorld` (top level):
    - Import `{ doorNear, warmDoor }` from `'./warm'` and `{ returnVeil, welcomeFor }` from `'./welcome'`.
    - Add `entered = useRef(null)`, `welcomes = useRef(0)`, `[welcome, setWelcome] = useState(null)` and `clearWelcome = useCallback(() => setWelcome(null), [])`.
    - `useEffect` on `[inside]`. If `inside` is set, `entered.current ??= readHeist()`; a Next from game to game keeps the first snapshot. Otherwise, if `entered.current` is set, take `text = welcomeFor(entered.current, readHeist())` and clear the snapshot. If there is `text`, `setWelcome({ n: ++welcomes.current, text })`.
    - Pass `welcome` and `onWelcomed={clearWelcome}` to `<World>`.
  - `World`:
    - Takes `welcome` and `onWelcomed`, and adds `[back, setBack] = useState(false)`.
    - In the `was` effect, right after `if (inside || !from) return;`, call `setBack(true)`.
    - Add `useEffect(() => { if (back && stage.status === 'on') setBack(false); }, [back, stage.status])`.
    - Add the welcome timer, from when the veil is down: `useEffect(() => { if (!welcome || back) return undefined; const t = setTimeout(onWelcomed, 4200); return () => clearTimeout(t); }, [welcome, back, onWelcomed])`.
    - `const veil = returnVeil({ gl, back, prep })`. The `<LoadingVeil` takes `veil`’s four fields. `<CompoundHud` gets `welcome={veil.shown ? null : welcome}`.
  - The tick, after the door lookup, grounded or not (swinging past counts): `if (s.frame % 20 === 0) { const d = doorNear(s.h.x, s.h.z); if (d) warmDoor(d); }`.
  - `CompoundHud.jsx`:
    - The signature adds `welcome`.
    - The stones chip gets `key={welcome?.n ?? 0}` and `data-pulse={welcome ? '' : undefined}`.
    - The `<Toast` gets `` toast={tourMsg ? { key: tourMsg, text: tourMsg } : welcome ? { key: `back-${welcome.n}`, text: welcome.text } : null} ``, so the HUD keeps one toast, and the tour wins.
  - `world.css`:
    - After `:69`: `.cw-stones[data-pulse] { animation: cw-pulse 0.7s ease-out 3; }` and `@keyframes cw-pulse { 50% { transform: scale(1.08); border-color: var(--cw-cyan); box-shadow: 0 0 14px color-mix(in srgb, var(--cw-cyan) 55%, transparent); } }`.
    - Add `.cw-stones[data-pulse]` to the reduced-motion `animation: none` list at `:236`.
  - `docs/architecture.md:27`: add “; `warm.js` fetches a door’s game within 15 m”.
- [ ] **Step 7: Run them to see them pass.**
  - Run `npx vitest run src/components/avengers`. Expected: all pass, each new file under 1 s. PR 1’s `CompoundWorld.test.js` still passes: no kit barrel; `warm.js`’s imports are dynamic.
  - Run `npx eslint src/components/avengers`. Expected: no output.
  - Run `wc -l src/components/avengers/world/CompoundWorld.jsx`. Expected: under 800.
- [ ] **Step 8: Commit.** Subject: `Avengers HQ: doors fetched ahead, the veil until the compound draws again, a welcome naming the next building and Repulsor waits for its stage`.

### Task 6: Verify the PR and open it

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr4/README.md`, plus the pictures it lists under `before/` and `after/` (`.webp` or `.png`, each under 1 MB, committed as PR 1’s and PR 2’s are)

**Interfaces:**
- Consumes: Tasks 1–5; `$S/hq-pr4-check.mjs`, `$S/closure-before.txt`, `$S/fit-before.txt` and the before pictures from “Before Task 1”.
- Produces: the pull request. For PRs 5–7, everything listed under “What later PRs rely on”.

- [ ] **Step 1: The gates.** Run `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`, then `git checkout public/github.json`. Expected:
  - lint clean;
  - every test file passes, none skipped;
  - `✓ built`;
  - the health table `within budget`, with `kbd-styles` one lower than on `main`, `big-files` unchanged and `renderers`, `loops` and `hud-kit` unchanged.

  Don’t ratchet a budget: the steward does it after the merge.
- [ ] **Step 2: The closure.** Run `npx vite build && node $S/closure.mjs | tee $S/closure-after.txt; git checkout public/github.json`. Expected: within a few kB of `$S/closure-before.txt`, since only `warm.js` and `welcome.js` join the page’s static closure. `Place`, `HQGame`, `Results` and the games stay lazy chunks. Zero files means the page key isn’t `src/pages/Avengers.jsx`: grep the manifest for it.
- [ ] **Step 3: The links.** With `npx vite --port 5173 --strictPort` up, run `OUT=$S/links node scripts/hq-links-check.mjs`, then `OUT=$S/links-3d node scripts/hq-links-check.mjs --3d`. Expected: `all ok` both times. Read `$S/links-3d/hq-links-3d.png`: the compound is drawn.
- [ ] **Step 4: The screen in a browser.** Run `node $S/hq-pr4-check.mjs fit gate pause own3d siteoff results back warm after | tee $S/check-after.txt`. Expected: `ok` for every part and `all ok`.
  - `$S/fit-after.txt` shows every Start within the viewport at both sizes.
  - If one game’s Start is below the fold, hide that game’s own long text under the height it needs, as `tesseract.css:49` already does for its keys. Don’t hide Start, the stone line or the bar.
- [ ] **Step 5: The pages, after.** Run `node scripts/autopilot-check.mjs --only smoke --routes /avengers/workshop,/invincible,/avengers --shots avhq-pr4`, then `node scripts/autopilot-check.mjs --only smoke --routes /avengers/workshop,/avengers/gate --shots avhq-pr4-phone --phone`. Expected: both end `everything green`.
  - Read `avhq-pr4-a.webp` beside `$S/avhq-pr4-before.webp`. The game fills the window under one slim bar (the name, `3D game: on`, `Back Esc`).
  - Read the phone pair. The touch help shows, the key list doesn’t and the bar fits.
  - Move the pictures into the evidence folder. `git status --short public/changes` is empty.
- [ ] **Step 6: The worlds that share `hq/`.**
  - Run `node docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs --out $S/hq-main --ref origin/main --only thinkmark,viewer,invworld`, then the same with `--out $S/hq-pr4` and no `--ref`, then `--compare $S/hq-main $S/hq-pr4`. Expected: `0 pixels differ` for all three, exit 0. The eight HQ game targets change by design and are not compared.
  - Run `OUT=$S/inv-after node scripts/inv-world-check.mjs` and `OUT=$S/hq-after node scripts/hq-world-check.mjs`. Expected: `no page errors` from both. The compound’s shots match `$S/hq-before` by eye.
  - Stop the server.
- [ ] **Step 7: The evidence README** at `docs/superpowers/evidence/avengers-hq/pr4/README.md`:
  - one line a picture: what it shows, before or after;
  - the before and after fit table (`$S/fit-before.txt` against `fit-after.txt`): where Start sat at 1024 × 640 and at 390 × 844 for each of the eight games;
  - the closure’s total line before and after;
  - `kbd-styles` before and after;
  - the test counts in `src/components/avengers`, before and after;
  - the `hq-shots` compare table for the three Invincible targets;
  - each `$S/hq-pr4-check.mjs` part and its result.

  Commit with the subject `Avengers HQ PR 4: the evidence`.
- [ ] **Step 8: Open the pull request.**
  - Run `git push -u origin claude/avengers-hq-pr4-game-screen`, then open the PR with base `main` and the title `Avengers HQ 4 of 7: the game screen`.
  - The body:
    - one paragraph each on the full screen and its bar, each game’s own 3D, touch help and Pause, the results card and the way back (veil, welcome, doors fetched ahead, Repulsor’s gate);
    - the numbers from the README, before → after: the fit table, the closure, `kbd-styles` and the tests;
    - the screenshots as images from `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/claude/avengers-hq-pr4-game-screen/docs/superpowers/evidence/avengers-hq/pr4/<file>`: the workshop before and after, the phone pair, a results card and the toy with “Try 3D”;
    - the checks that ran (Steps 1–6) with their results, `hq-links-check` both ways included;
    - a note for the engine-floor session: `src/runtime/useWorld.js` gains `wants3D` and an optional `own3D` flag, off by default;
    - a note that the start overlay’s blurb hides under 700 px of height, so Start stays in view at 1024 × 640;
    - the plan’s path and the harness’s PR footer.
  - It is one PR, merged with a merge commit once CI is green. Never force-push; a requested change is a new commit.

---

## Self-review against the spec

- **§5 Full screen.** The bar holds the name, Pause and Back (Esc); `.hq-screen` takes the height under the bar (Tasks 2, 3). The blurb and the stone pill move into the start overlay (Tasks 3, 4). Start is in view at both sizes (Task 6, `fit`).
- **§5 A 3D switch for this game only.** `local3D` is kept per game, and nothing calls `three.set`. “Play in 2D” waits for PR 7’s `flat`. Without 3D, the toy shows the line and Try 3D (Tasks 1–3, `own3d`, `siteoff`).
- **§5 Touch.** Touch words and icons replace the hidden keys, and every game has a Pause in the bar and pauses when hidden (Tasks 1–4, `fit`, `pause`).
- **§5 One results card.** The stone or the half, score against best, stars, Play again, Back and Next as its link. The games keep their title and pause overlays (Tasks 2, 4, `results`).
- **§5 Coming back.** The chip pulses and a toast names the next building (Task 5, `back`).
- **§5 Loading.** Doors are warmed within 15 m, the veil shows until the first frame and Repulsor waits for `'on'` (Task 5, `warm`, `back`, `gate`).
- **§3.** HQFrame is unchanged and the Invincible shots identical; no figures; the kit’s sizes on the bar and card; the keys kept (Global Constraints, Task 6).
- **§12.** Start in view, the per-game switch leaving the compound in 3D, the veil then the compound and no console errors (Task 6). Also `hq-links-check`, `inv-world-check` (since `hq/` changed), the closure’s size and the four gates.
- **Cross-check fixes applied.**
  - PR 2’s `labels.test.js` assertion becomes `<Results` and no `hq-stone`, with the colour pinned in `Results.test.jsx` and the `stoneById` imports removed (Task 4).
  - `againLabel` for the lawn’s “From wave 1” (Tasks 2, 4).
  - The half wording from `HALF_OF` (Tasks 2, 3).
  - The prefetch file is `world/warm.js` (Task 5).
  - `hq-links-check` is rerun, with `--3d` once (Task 6).
  - The `flat` branches and test helpers are PR 7’s to use without changing `HQGame` (Task 2).
  - `GAME_AT` and `writeLocal3D` give PR 5 a per-game Try 3D (Task 1).
  - Repulsor’s guard comes first in `start()`, for PR 6 (Task 5).
