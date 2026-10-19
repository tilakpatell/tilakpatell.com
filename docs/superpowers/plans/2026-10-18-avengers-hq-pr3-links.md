# Avengers HQ PR 3: links and navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every building on the compound an address of its own (`/avengers/<slug>`, from one pure table) that opens its game at once and closes it the same way by Back, Esc, the button or the browser. The portal opens only with the Space Stone, and the palette, the checklist, the guide and the tour point at the buildings. This is PR 3 of the seven in spec §11.

**Architecture:**
- `world/links.js` is the one table of addresses and the one rule for the way back. It is pure and imports nothing, so `App.jsx`, the palette, the tour and the check script read it without loading the compound.
- The route is `/avengers/:place?`, and every `/avengers…` address shares one page key, so the page and the compound stay mounted while a game opens and closes over them.
- `CompoundWorld` stops keeping the open building in state and reads it from the route. A door pushes the address with a navigation state (`hqState`, as the feed’s `feedState`). The way out pops back to the page’s own `/avengers` when a door opened the game, and otherwise replaces the game with `/avengers`. A committed browser script, `scripts/hq-links-check.mjs`, proves it, and PRs 4 to 7 rerun it.

**Tech Stack:** React 19, react-router-dom 7.18 (`HashRouter`, `useParams`, `useLocation`, `useNavigate`, `matchPath`), Vitest 5 (node environment), Vite 8 (its manifest at `dist/.vite/manifest.json`), playwright-core 1.56 under the check scripts.

**Spec:** `docs/superpowers/specs/2026-10-18-avengers-hq-fix-and-hub-design.md`, as amended in `30dd1241`: §4 (links and navigation), §3 (the rules this work keeps), §11 step 3 and §12 (the checks). The plan index is `docs/superpowers/plans/2026-10-18-avengers-hq.md`. Where an earlier brief and the spec disagree, the spec wins.

## Global Constraints

- **Order.** PR 3 of 7, merged in order. Branch from `origin/main` with PRs 1 and 2 merged. This PR consumes only:
  - PR 1: the `world/rules.js` barrel with the same 91 names, among them `PLACES` (ids `stark`, `thor`, `cap`, `hawkeye`, `widow`, `banner`, `spidey`, `vault`, in that order), `placeById`, `outside` and `behindYaw`.
  - PR 2: the tour sentence at `tour/chapters/player.js:57`, kept verbatim; `world/labels.js`’s `stoneLine`, which reads a won half as “Clint’s half of the Soul Stone: won back”; `.hq-game .btn:disabled` in `hq/hq.css`.
- **Line numbers** are `main` at `ddb364bf`. PR 1 rewrites `CompoundWorld.jsx:16` in place. PR 2 adds a line after `CompoundWorld.jsx:68` (`const { unlocked } = useAchievements();`) and edits `:664`. It also rewrites `Place.jsx:10`, `:153`, `:176` and `:178`. When a number is off, find the code by the quoted text.
- **The addresses (§4), exactly:**

  | link | place id | game |
  | --- | --- | --- |
  | `/avengers/workshop` | `stark` | Repulsor Range |
  | `/avengers/lawn` | `thor` | Hold the Lawn |
  | `/avengers/training` | `cap` | Ricochet |
  | `/avengers/range` | `hawkeye` | Trick Shot |
  | `/avengers/operations` | `widow` | Infiltration |
  | `/avengers/lab` | `banner` | Smash Run |
  | `/avengers/gate` | `spidey` | Thwip! |
  | `/avengers/hangar` | `vault` | Tesseract Run |

  The gate’s game is written “Thwip!”, with the bang, as its title screen (`thwip/Thwip.jsx:347`), the checklist and the guide write it. PR 5 expects that spelling.
- **Behaviour (§4).**
  - An unknown slug gives `null`, and the page replaces the address with `/avengers`.
  - Going through a door pushes `/avengers/<slug>`, and Back (the button, Esc or the browser) goes back.
  - A game opened from outside the page (a shared link, the palette, the checklist, the tour) is closed by the in-page Back or Esc with a replace to `/avengers`, so the site is never left. The browser’s own Back on a shared link leaves, as any browser does.
  - A cold deep link opens the game at once and does not wait for the compound. The page keeps one live 3D view, so the compound is built when the game closes, behind its loading veil. Without 3D, the no-3D view is there at once.
  - The portal opens only with the Space Stone, in every mode.
- **Content (§3).** Nothing here draws a figure, suit or mark of any Marvel character, and this PR adds no drawing at all.
- **Copy (RULES.md UI 7).** British spelling, curly quotes (’ “ ”) inside strings, sentence case, no Oxford comma. “Esc”, never “Escape”, in prose (`lib/words.js` retires it).
- **Keys and hooks (§3).** No `tp-*` key changes name or shape, and this PR adds none. `__HQWORLD__.enter(id)` keeps its name and still opens the place (the FL2 shots at `docs/superpowers/evidence/engine-floor/FL2-avengers/tools/hq-shots.mjs:224` call it). It now does so by pushing the address.
- **Islands (RULES.md).** `App.jsx`, `CommandPalette.jsx`, `tour/` and `guide/` are not worlds, so their imports of `avengers/world/links.js` cross no line. `universe/online/where.js` is in a world, so it does not import `links.js` and matches the prefix itself.
- **Shared code.** Nothing under `src/components/avengers/hq/` changes, so `scripts/inv-world-check.mjs` is not run. Task 5 proves the diff there is empty.
- **Open draft #1028** edits `src/App.jsx` (`:8`, about `:403` and `:472`), `src/components/guide/pages.js` (`:15-36`, `:103-140`) and `pages.test.js` (about `:112-135`). This PR’s hunks are disjoint: `App.jsx` `:25`, `:78-108`, `:325-345`, `:439`; `pages.js` one row after `:449`; `pages.test.js` two lines in existing tests. No edit to `src/runtime/hud/*`.
- **Tests.** Beside their file, each under one second, no network. No test is skipped, loosened or deleted; the `pages.test.js` and `where.test.js` changes only add assertions.
- **Limits.** Files stay under 800 lines (`CompoundWorld.jsx` is 707 today; this PR adds about 20). No new dependency, renderer or animation loop.
- **Commits.** A plain sentence as the subject; the body says why. End with the session’s attribution lines. No model names anywhere. Never force-push; if `main` moves, merge it in.
- **What later PRs rely on.**
  - PR 4 imports `linkOf` and `gameOf`, keeps `Place({ id, onLeave, onPortal })` with `onLeave` as this PR’s `leave`, and makes its results card’s “Next: <building>” navigate with `{ replace: true, state: location.state }`. A door-opened game stays door-opened, so Back from the next game still pops to `/avengers`.
  - PR 5 imports `gameOf`, `linkOf` and `hqState`, and renders each board card’s Play as `<Link to={linkOf(id)} state={hqState}>`. In `hq-links-check.mjs` it changes the two lines `CARD` and `PLAY` to `(id) => `#hq-card-${id}`` and `'a.btn-primary'`.
  - PR 6 renders its “Next” link as `<Link to={gate.next.to} state={hqState}>`.
  - PRs 4, 5, 6 and 7 each run `OUT=… node scripts/hq-links-check.mjs` (and `--3d` once) and expect `all ok`. The script finds the dialog’s title through `.cw-place`’s `aria-labelledby` and Back as the button in `.cw-place` whose text starts “Back”, so PR 4’s new bar keeps it working.

## Review Focus

1. **Browser Back after winning half a stone.** A visitor who wins Clint’s half in Trick Shot and leaves by the browser’s Back expects the compound to show it at once. A half sends no `tp:stones` event (`hq/stones.js:55`), so only a re-read on every way out shows it. Pinned in Task 3 (`hq-links-check.mjs` part `stones`).
2. **Esc pressed twice before the address has moved.** Expect one step back to the compound, never two and off the site. Pinned in Task 3 (part `double-esc`: two keydowns dispatched in one task).
3. **A reload on a game opened from a door.** Expect the game to open again at once, and Back to return to the `/avengers` entry already in this tab’s history (the entry keeps its state and key through a reload) rather than adding a second one. Pinned in Task 1 (`backTarget` on a reloaded entry) and Task 3 (part `reload`).
4. **From one game to another through the palette while a game is open.** Expect the new game in place (the dialog remounted, titled with the new building) and Esc to put the compound in its place. Pinned in Task 4 (part `jump`).
5. **Online while a game is open.** The other players expect to keep seeing you at Avengers HQ, gone indoors as today. They should not get a roster line “went to Avengers” each time a game opens. Pinned in Task 2 (`where.test.js`).

## Files

| file | change | what for |
| --- | --- | --- |
| `src/components/avengers/world/links.js` | create | the table, `linkOf`, `placeOf`, `gameOf`, `hqState`, `backTarget`, `inHq`; later `HQ_PALETTE` |
| `src/components/avengers/world/links.test.js` | create | the table both ways, the way back, the route, the palette, the checklist and the guide |
| `src/App.jsx` | modify | the route, the page key, `ScrollToTop` |
| `src/theme/themes.js`, `src/theme/themes.test.js` (create), `src/theme/ThemeProvider.jsx` | modify | Stark’s colours under a building’s address |
| `src/components/guide/routes.js`, `pages.test.js` | modify | the compound’s guide under a building’s address |
| `src/components/universe/online/where.js`, `where.test.js` | modify | one place online while a game is open |
| `src/components/avengers/world/CompoundWorld.jsx` | modify | the open building from the route; one way out; the portal’s gate |
| `src/components/avengers/world/Place.jsx` | modify | the Tesseract toy needs the Space Stone |
| `scripts/hq-links-check.mjs` | create | every link in a browser (§12) |
| `docs/architecture.md:27` | modify | one sentence on the addresses and the check |
| `src/components/CommandPalette.jsx` | modify | Avengers HQ and its eight games under Worlds |
| `src/data/todo.js:542` | modify | Thwip!’s row goes to the gate |
| `src/components/guide/pages.js` | modify | one tip naming the links |
| `src/components/tour/chapters/player.js`, `steps.test.js` | modify | the walk’s stop offers the gate |
| `docs/superpowers/evidence/avengers-hq/pr3/README.md` | create | the evidence |

---

### Before Task 1: the before shots and numbers

`S` below is the session’s scratchpad directory (never under the repo).

- [ ] **Branch and check PRs 1 and 2 are in.** `git fetch origin main && git switch -c <branch> origin/main`. Then:
  - `grep -c "most of them for an Infinity Stone" src/components/tour/chapters/player.js` prints `1`.
  - `grep -n "export const HALF_OF" src/components/avengers/world/labels.js` prints one line.
  - `ls src/components/avengers/world/rules/progress.js` prints the path.
  - `ls src/components/avengers/world/links.js` fails.
- [ ] **Draft #1028.** Run `gh pr view 1028 --json state,mergedAt,files`.
  - Merged: its changes are on `main` already.
  - Open: note it for the PR body, and keep every hunk inside the lines Global Constraints names.
- [ ] **Shoot main.**
  - `node scripts/autopilot-check.mjs --skip lint,test --routes /avengers,/invincible --shots 9003 --before`. Expected: it ends `everything green` and writes `public/changes/9003-before.webp`.
  - `mv public/changes/9003-before.webp $S/`, then `git checkout public/github.json`.
- [ ] **Measure main.**
  - `node scripts/health.mjs --check --skip build | tee $S/health-before.txt`. Expected: `within budget`.
  - `npx vitest run 2>&1 | tail -4 | tee $S/tests-before.txt`. Expected: the files and tests counts, all passing.
  - The closure, into `$S/closure-before.txt`, with Task 5 Step 2’s command.
  - Start `npx vite --port 5173 --strictPort` in the background, then `OUT=$S/hq-before node scripts/hq-world-check.mjs`. Expected: `compound up in … s`, nine `hq-*.png` and `no page errors` at the end.

---

### Task 1: The links table and the way back

**Files:**
- Create: `src/components/avengers/world/links.js`
- Test: `src/components/avengers/world/links.test.js` (create)

**Interfaces:**
- Consumes: `PLACES` from `./rules` (PR 1’s barrel), only in the test.
- Produces, all from `src/components/avengers/world/links.js`:
  - `export const HQ_HOME = '/avengers'`
  - `export const LINKS`: 8 rows `{ slug, id, game }` in `PLACES` order, as the table in Global Constraints. Task 4 appends `words` to each row.
  - `export const linkOf = (id) → '/avengers/<slug>' | null`
  - `export const placeOf = (slug) → placeId | null`: an exact, case-sensitive match. Anything else, including non-strings, gives `null`.
  - `export const gameOf = (id) → string | null`: the game’s title, for PR 4’s bar and PR 5’s cards.
  - `export const hqState = { hq: true }`: the state a door on the page pushes with.
  - `export const backTarget = (location) → -1 | '/avengers'`
  - `export const inHq = (pathname) → boolean`: the addresses the route `/avengers/:place?` matches.

- [ ] **Step 1: Write the failing test.**

```js
import { describe, expect, it } from 'vitest';
import { HQ_HOME, LINKS, backTarget, gameOf, hqState, inHq, linkOf, placeOf } from './links';
import { PLACES } from './rules';

describe('the compound’s addresses', () => {
  it('names each building by its place, as the spec’s table does, in the compound’s order', () => {
    expect(HQ_HOME).toBe('/avengers');
    expect(Object.fromEntries(LINKS.map((l) => [l.slug, l.id]))).toEqual({ workshop: 'stark', lawn: 'thor', training: 'cap', range: 'hawkeye', operations: 'widow', lab: 'banner', gate: 'spidey', hangar: 'vault' });
    expect(LINKS.map((l) => l.id)).toEqual(PLACES.map((p) => p.id));
  });

  it('goes both ways', () => {
    for (const p of PLACES) {
      const to = linkOf(p.id);
      expect(to, p.id).toMatch(/^\/avengers\/[a-z]+$/);
      expect(placeOf(to.slice('/avengers/'.length)), p.id).toBe(p.id);
    }
    expect(linkOf('spidey')).toBe('/avengers/gate');
    expect(placeOf('hangar')).toBe('vault');
  });

  it('knows no other slug or place', () => {
    for (const s of ['nowhere', 'stark', 'Gate', 'gate/', ' gate', '', undefined, null, 7]) expect(placeOf(s), String(s)).toBe(null);
    for (const id of ['nobody', 'gate', '', undefined, null]) expect(linkOf(id), String(id)).toBe(null);
  });

  it('names each game as its own title screen does', () => {
    expect(LINKS.map((l) => l.game)).toEqual(['Repulsor Range', 'Hold the Lawn', 'Ricochet', 'Trick Shot', 'Infiltration', 'Smash Run', 'Thwip!', 'Tesseract Run']);
    expect(gameOf('cap')).toBe('Ricochet');
    expect(gameOf('nobody')).toBe(null);
  });

  it('tells the compound’s addresses from the rest, as the router matches them', () => {
    for (const p of ['/avengers', '/avengers/', '/avengers/gate', '/avengers/gate/', '/avengers/nowhere', '/Avengers/Gate']) expect(inHq(p), p).toBe(true);
    for (const p of ['/', '/avengersx', '/avengers/gate/deeper', '/middle-earth/moria', '', undefined, null]) expect(inHq(p), String(p)).toBe(false);
  });

  it('goes back in the page only from a door the page opened, else puts the compound in its place', () => {
    expect(hqState).toEqual({ hq: true });
    expect(backTarget({ state: hqState, key: 'k1' })).toBe(-1);
    expect(backTarget({ state: { hq: true }, key: 'k1' })).toBe(-1); // reloaded: the entry keeps its state and key
    expect(backTarget({ state: null, key: 'k1' })).toBe(HQ_HOME); // the palette, the checklist, the tour
    expect(backTarget({ state: null, key: 'default' })).toBe('/avengers'); // a shared link, the first entry
    expect(backTarget({ state: hqState, key: 'default' })).toBe('/avengers');
    expect(backTarget({ state: { feed: true }, key: 'k1' })).toBe('/avengers');
    expect(backTarget(undefined)).toBe('/avengers');
  });
});
```

- [ ] **Step 2: Run it to see it fail.** `npx vitest run src/components/avengers/world/links.test.js`. Expected: FAIL with `Failed to resolve import "./links"` and `Test Files 1 failed (1)`.
- [ ] **Step 3: Write `links.js`.**
  - Header comment: the compound’s addresses, one a building, named for the place and not the person (spec 2026-10-18 §4). It is pure and imports nothing, so App, the palette and the tour can read it without loading the compound.
  - `LINKS` as the table. `linkOf`, `placeOf` and `gameOf` are each a `find` over it.
  - `hqState`, with a comment: the state of an address a door on the page pushed, as `feed/feed.js:47`’s `feedState`.
  - `backTarget(location)` is `-1` exactly when `location?.state?.hq === true && location.key !== 'default'`, else `HQ_HOME`. Comment: `-1` when a door here pushed the entry, so the page’s own `/avengers` is behind it. Otherwise (a shared link, the palette, a link from another page) the compound replaces the game and the site is never left.
  - `inHq(pathname)` tests `/^\/avengers(\/[^/]*)?\/?$/i` on a string and is `false` for anything else. The router’s `matchPath` is case-blind and takes a trailing slash, so `pageKey` must agree with it.
- [ ] **Step 4: Run it to see it pass.** Same command. Expected: `Tests 6 passed (6)`, each well under 1 s.
- [ ] **Step 5: Commit.**
  - `git add src/components/avengers/world/links.js src/components/avengers/world/links.test.js`
  - Subject: `Avengers HQ: a link for every building, named for the place`.
  - Body: `world/links.js` is the one table of the compound’s addresses (workshop, lawn, training, range, operations, lab, gate, hangar). It goes both ways and holds the way back: `-1` when a door on the page opened the game, else the compound in its place. Pure, with its tests.

### Task 2: The shell takes the addresses: the route, one page, its colours, its guide and its place online

**Files:**
- Modify: `src/App.jsx`: after `:25` (the import), `:325-345` (the `pageKey` comment and `pageKey`), `:439` (the route)
- Modify: `src/theme/themes.js` (after `:104`), `src/theme/ThemeProvider.jsx:3, :100`
- Test: `src/theme/themes.test.js` (create)
- Modify: `src/components/guide/routes.js` (one row after `:57`)
- Test: `src/components/guide/pages.test.js` (one `expect` in each of two existing tests)
- Modify: `src/components/universe/online/where.js:20-29` (`whereOf`)
- Test: `src/components/universe/online/where.test.js` (one new `it` in `describe('whereOf')`)
- Test: `src/components/avengers/world/links.test.js` (one new `it`)

**Interfaces:**
- Consumes: `inHq`, `HQ_HOME`, `LINKS`, `linkOf` (Task 1).
- Produces:
  - `<Route path="/avengers/:place?" element={<Avengers />} />`; the slug is `useParams().place`.
  - `pageKey(p) === '/avengers'` for every `p` where `inHq(p)`.
  - `export const routeTheme = (pathname) → themeId | null` in `src/theme/themes.js`.
  - `guideKeyFor('/avengers/<slug>') === '/avengers'`.
  - `whereOf('/avengers/<anything>') === '/avengers'`.

- [ ] **Step 1: Write the failing tests.**
  - In `links.test.js`, add `import { readFileSync } from 'node:fs';` and `import { matchPath } from 'react-router-dom';` (as `src/data/todo.test.js:1-3` does) and a `read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')`. Then:

```js
it('is one route App.jsx declares, matched as the router matches, on one page', () => {
  const app = read('../../../App.jsx');
  const pats = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*'); // (the not-found page matches anything)
  expect(pats).toContain('/avengers/:place?');
  expect(pats).not.toContain('/avengers');
  for (const to of [HQ_HOME, ...LINKS.map((l) => linkOf(l.id))]) expect(pats.filter((p) => matchPath({ path: p, end: true }, to)), to).toEqual(['/avengers/:place?']);
  expect(app).toMatch(/inHq\(pathname\)\s*\?\s*'\/avengers'/); // pageKey: one page for every address
});
```

  - Create `src/theme/themes.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { ROUTE_THEMES, routeTheme } from './themes';

describe('the colours a page wears', () => {
  it('keeps Avengers HQ’s under every building’s address', () => {
    for (const p of ['/avengers', '/avengers/', '/avengers/gate', '/avengers/gate/', '/avengers/hangar', '/avengers/nowhere']) expect(routeTheme(p), p).toBe('stark');
  });
  it('reads every other page by its own path, as before', () => {
    for (const [path, id] of Object.entries(ROUTE_THEMES)) expect(routeTheme(path), path).toBe(id);
    for (const p of ['/middle-earth/moria', '/avengers/gate/deeper', '/avengersx', '/nowhere', '', undefined]) expect(routeTheme(p), String(p)).toBe(null);
  });
});
```

  - In `pages.test.js`:
    - In “gives a section’s deeper pages their own kind of guide”, add `expect(guideFor('/avengers/gate').key).toBe('/avengers');`.
    - In “has none for a page it doesn’t know”, add `expect(guideFor('/avengers/gate/deeper')).toBe(null);`.
  - In `where.test.js`, inside `describe('whereOf')`:

```js
it('keeps Avengers HQ one place while a building’s game is open over it', () => {
  for (const p of ['/avengers', '/avengers/gate', '/avengers/nowhere']) expect(whereOf(p), p).toBe('/avengers');
  expect(whereOf('/avengersx')).toBe('/avengersx');
});
```

- [ ] **Step 2: Run them to see them fail.** `npx vitest run src/components/avengers/world/links.test.js src/theme/themes.test.js src/components/guide/pages.test.js src/components/universe/online/where.test.js`. Expected, 4 files failing:
  - `links`: “is one route App.jsx declares” (no `/avengers/:place?`).
  - `themes`: `routeTheme is not a function`.
  - `pages`: a `TypeError` reading `key` of `null`.
  - `where`: `expected '/avengers/gate' to be '/avengers'`.
- [ ] **Step 3: The route and the page key** in `App.jsx`.
  - After `:25`: `import { inHq } from './components/avengers/world/links';`.
  - `:439`: `<Route path="/avengers/:place?" element={<Avengers />} />`.
  - `pageKey`: add `: inHq(pathname) ? '/avengers'` straight after the `'/middle-earth'` branch.
  - Add one sentence to the comment above it: Avengers HQ’s buildings (`/avengers/gate`) keep one page the same way, so the compound stays loaded while a game opens and closes over it.
- [ ] **Step 4: The colours.**
  - In `themes.js`, after `ROUTE_THEMES`, add a module-private `UNDER = ['/avengers']`. Its comment: pages whose places have addresses of their own and keep the page’s colours under them. Middle-earth’s chapters theme themselves, so it is not listed.
  - Add `routeTheme(pathname)`: `ROUTE_THEMES[pathname]`; else the theme of the `UNDER` page that `pathname` is, with one segment under it and an optional trailing slash; else `null`. A non-string is `null`.
  - `ThemeProvider.jsx:3` imports `{ DEFAULT_THEME, THEMES, routeTheme }` (`ROUTE_THEMES` has no other use there), and `:100` becomes `const active = pinned || scrollTheme || routeTheme(pathname) || DEFAULT_THEME;`.
  - Why: `ThemeProvider.jsx:100` matches `ROUTE_THEMES` exactly, so `/avengers/gate` would switch Stark’s colours to AWS’s under an open game.
- [ ] **Step 5: The guide.** In `guide/routes.js` `RULES`, after the `middle-earth` row (`:57`), add `[/^\/avengers\/[^/]+$/, '/avengers'],` with the comment: a building’s game opens over the compound, so it’s the compound’s guide. Two side effects, both wanted:
  - The visited list ticks `/avengers` for a cold link, so the checklist’s swing row counts it.
  - `TourHost`’s `busy()` (`:59-62`) treats the game’s `aria-modal` dialog as covering, so the first-arrival brief still waits for the game to close.
- [ ] **Step 6: Online.**
  - In `whereOf`, before the last `return pathname`, add `if (pathname.startsWith('/avengers/')) return '/avengers';`.
  - Its comment: a building’s game opens over the compound, so the others still see you at Avengers HQ (the compound tells them you’ve gone indoors), and the roster doesn’t say you left each time a game opens.
  - The match is written here because `universe/` is a world and may not import `avengers/world/links.js`.
  - Today `/avengers/gate` would be a room of its own: `client.js:311` feeds “… went to Avengers” to everyone on the compound.
- [ ] **Step 7: Run them to see them pass.**
  - `npx vitest run src/components/avengers/world/links.test.js src/theme/themes.test.js src/components/guide/pages.test.js src/components/universe/online/where.test.js src/data/todo.test.js src/components/tour/steps.test.js`. Expected: all 6 files pass; `links.test.js` 7, `themes.test.js` 2.
  - `npx eslint src/App.jsx src/theme src/components/guide src/components/universe/online src/components/avengers/world/links.test.js`. Expected: no output.
- [ ] **Step 8: Commit.**
  - Subject: `Avengers HQ: /avengers/:place? is the compound’s page, in its colours, its guide and its place online`.
  - Body: every `/avengers` address shares one page key, so the compound stays mounted while a game opens over it. Stark’s colours, the HQ’s guide and the online room hold under a building’s address (`ROUTE_THEMES` was matched exactly; `whereOf` would have made each game a room of its own).

### Task 3: A building’s address opens its game, with one way back; the portal needs the Space Stone

**Files:**
- Create: `scripts/hq-links-check.mjs`
- Modify: `src/components/avengers/world/CompoundWorld.jsx`:
  - `:1` (add the router import);
  - after `:22` (the links import);
  - `:24-30` (the header comment);
  - `:65-112` (`CompoundWorld`: `inside`, `enter`, `leave`, `portal`, the `Place` render).
- Modify: `src/components/avengers/world/Place.jsx:79-128` (`TesseractToy`), `:146-147` (the `vault` case)
- Modify: `src/App.jsx:78-108` (`ScrollToTop`)
- Modify: `docs/architecture.md:27`

**Interfaces:**
- Consumes: Task 1’s `HQ_HOME`, `LINKS`, `backTarget`, `hqState`, `inHq`, `linkOf` and `placeOf`; Task 2’s route param `place`; `hasEarned`, `earnedStones` and `SOUL_HALVES` from `../hq/stones` (already imported at `CompoundWorld.jsx:8`); `noisy(text)` from `scripts/lib/noise.mjs:20`.
- Produces:
  - In `CompoundWorld`:
    - `enter(id)` pushes `linkOf(id)` with `{ state: hqState }`.
    - `leave()` is the one way out, passed to `Place` as `onLeave`.
    - `portal()` does nothing unless `hasEarned('space')`.
    - `<Place key={inside} id={inside} onLeave={leave} onPortal={portal} />`.
  - `Place.jsx`: `function TesseractToy({ onPortal, space })`.
  - `ScrollToTop`: a move between two HQ addresses neither scrolls to the top nor stops the page’s clips.
  - `scripts/hq-links-check.mjs [--3d]`:
    - It needs the dev server on `:5173`; `OUT=<dir>` is where its screenshots go.
    - It prints `ok   <what>` or `FAIL <what>` for each check.
    - Its last line is `all ok` or `<n> problems`, with exit code 1 on problems.
    - `CARD(id)` and `PLAY` are the two lines PR 5 changes.

- [ ] **Step 1: Write the browser check** `scripts/hq-links-check.mjs`, in the shape of `scripts/door-check.mjs`:

```js
/* global window, document */
// A browser check of Avengers HQ’s addresses (components/avengers/world/links.js):
// each opens its building’s game, cold, and every way back (the button, Esc,
// the browser) closes it without leaving the page. Spec 2026-10-18 §4 and §12;
// every Avengers HQ PR from the links on runs it. With the dev server up
// (npx vite --port 5173 --strictPort):
//   OUT=/tmp/hq-links node scripts/hq-links-check.mjs [--3d]
// Without --3d the games are their simple versions (seconds each, in software
// GL); --3d opens one cold over the compound and builds the compound after it.
import { chromium } from 'playwright-core';
import { noisy } from './lib/noise.mjs';
import { HQ_HOME, LINKS, linkOf } from '../src/components/avengers/world/links.js';

const BASE = 'http://localhost:5173/?quality=low#';
// (rules.js’ PLACES names: that module imports without extensions, which Node can’t)
const NAME = { stark: 'Tony Stark’s workshop', thor: 'Mjolnir', cap: 'The training center', hawkeye: 'The range', widow: 'Operations', banner: 'Bruce Banner’s lab', spidey: 'The front gate', vault: 'The hangar' };
// the no-3D view’s card for a place, and its way in (PR 5’s board changes these two lines)
const CARD = (id) => `.cw-cards li:nth-child(${LINKS.findIndex((l) => l.id === id) + 1})`;
const PLAY = 'button';
```

  - **Helpers.**
    - Chromium as `scripts/autopilot-check.mjs:151` finds it (`CHROMIUM`, else the first `/opt/pw-browsers/chromium-*/chrome-linux/chrome`). Launch it with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --enable-webgl`.
    - `check(ok, what)` prints and collects the problem.
    - `fresh({ stones = [], three = false } = {}) → page` is a new context at 1024 × 640 whose init script sets:
      - `tp-intro` to `'1'` and `tp-worlds` to `'"load"'`;
      - `tp-3d` to `'"on"'` or `'"off"'`;
      - `tp-hq-stones` to `JSON.stringify(stones)`.
    - `fresh` also reports every `pageerror` and every console `error` that `noisy()` doesn’t know as a `FAIL` line.
    - `at(page) → { hash, idx, length, y, open, title }` is one `evaluate`:
      - `hash` is `window.location.hash`, `idx` is `window.history.state?.idx`, `length` is `window.history.length` and `y` is `window.scrollY`;
      - `open` is whether `.cw-place` exists;
      - `title` is the text of the element `.cw-place`’s `aria-labelledby` names.
    - `until(page, hash, open, ms = 20000) → boolean` waits for that hash and that state of the dialog.
    - `backButton(page)` is the button in `.cw-place` whose trimmed text starts with `Back`.
    - Reach browser globals through `window.` so the header’s `/* global window, document */` covers them. Use a new page for each cold link: a hash `goto` on a live page is a same-document move, not a cold load.
  - **Parts without `--3d`.** Each part starts from `fresh()` unless it says otherwise.
    - **`cold`.** For each `LINKS` row:
      - `goto(BASE + linkOf(id))`. Then `until` the address with the dialog open, `title === NAME[id]` and `document.documentElement.dataset.theme === 'stark'`.
      - Read `n = at().length` and `i = at().idx`, then press `Escape`. `until('#/avengers', false)`, `length === n` and `idx === i`: replaced, not pushed or popped.
      - Screenshot the first one, open, to `OUT/hq-links-cold.png`.
    - **`door`.**
      - `goto(BASE + HQ_HOME)` and scroll `CARD('cap')` to the middle. Read `y0`, `i0` and `n0`.
      - Click `${CARD('cap')} ${PLAY}`: `until('#/avengers/training', true)`, `idx === i0 + 1`, `length === n0 + 1` and `|y − y0| ≤ 4`.
      - Close it three ways in turn, reopening the same way between them: `page.goBack()`, `Escape`, then a click on `backButton`. After each: `until('#/avengers', false)`, `idx === i0` and `|y − y0| ≤ 4`.
    - **`double-esc`.** Open `cap` from its card as in `door`. Then, in one `evaluate`, dispatch two `keydown` events with `key: 'Escape'` on `window`. After 1 s: `hash === '#/avengers'`, `open === false` and `idx === i0`, so it is still on the page.
    - **`reload`.** Open `cap` from its card, then `page.reload()`. Then `until('#/avengers/training', true)` with `title === NAME.cap`. Press `Escape`: `until('#/avengers', false)` and `idx === i0`.
    - **`stones`.**
      - Open `hawkeye` from its card.
      - In the page, `window.localStorage.setItem('tp-hq-stones', '["soul-clint"]')`, with no event, as a half is won.
      - `page.goBack()`. `until('#/avengers', false)`, then within 2 s `CARD('hawkeye')`’s text matches `/Clint’s half of the Soul Stone: won/`.
    - **`unknown`.** `goto(BASE + '/avengers/nowhere')`: `until('#/avengers', false)`, and after 1 s still no dialog.
    - **`toy`.**
      - With `fresh()`, `goto(BASE + linkOf('vault'))`. The button whose text is `Space` is `disabled`, and the dialog’s text contains `won in the 3D game`.
      - With `fresh({ stones: ['space'] })`, click `Space`. `until('#/avengers', false)`, then within 5 s `#thanos`’s top is between −8 and 120 px.
  - **Parts with `--3d`.** Both run on one `fresh({ three: true })` page.
    - **`3d-cold`.**
      - `goto(BASE + linkOf('spidey'))`. `until('#/avengers/gate', true, 30000)`, with no `.cw-canvas[data-on]` at that moment: the compound is not built behind the game.
      - Read `n`, click `backButton`. `until('#/avengers', false)` and `length === n`.
      - Then `.cw-canvas[data-on]` within 240 s. Screenshot to `OUT/hq-links-3d.png`.
    - **`3d-hook`.**
      - Read `i0`, then `window.__HQWORLD__.enter('spidey')`. `until('#/avengers/gate', true)` and `idx === i0 + 1`.
      - `page.goBack()`. `until('#/avengers', false)` and `idx === i0`.
      - Then `window.__HQWORLD__.sim.near === 'spidey'` within 120 s: he is back outside the gate (`outside(p)` is 1.6 m out, inside `DOOR_R` 3.4).
- [ ] **Step 2: Run it to see it fail.** With the dev server up and Tasks 1 and 2 in: `OUT=$S/links node scripts/hq-links-check.mjs`. Expected:
  - `FAIL` for every cold link (no dialog).
  - `door`’s address stays `#/avengers`.
  - `double-esc`, `reload` and `stones` cannot open by address, and `unknown` stays `#/avengers/nowhere`.
  - `toy`: no dialog.
  - Last line `<n> problems`, exit code 1.
- [ ] **Step 3: The compound reads the building from the route** (`CompoundWorld.jsx`).
  - Imports:
    - After `:1`, add `import { useLocation, useNavigate, useParams } from 'react-router-dom';`.
    - After `:22`: `import { HQ_HOME, backTarget, hqState, linkOf, placeOf } from './links';`.
  - The header comment `:24-30`: each game opens over the page at its own address (`./links.js`), and Back, Esc or the button closes it.
  - In `CompoundWorld`, replace `const [inside, setInside] = useState(null);` and today’s `enter`, `leave` and `portal` (`:83-99`) with:

```js
const { place: slug } = useParams();
const inside = placeOf(slug);
const where = useLocation();
const here = useRef(where);
here.current = where;
const navigate = useNavigate();
const leaving = useRef(false); // one way out per move: a second Esc before the address has moved would go back twice, off the page
// an address that is no building is the compound (as MiddleEarth.jsx:200-202)
useEffect(() => {
  if (slug && !inside) navigate(HQ_HOME, { replace: true });
}, [slug, inside, navigate]);
// out of a building however it happened (the browser's Back included), the stones read again: halves send no tp:stones
useEffect(() => {
  if (!inside) setHeist(readHeist());
}, [inside]);
useEffect(() => {
  leaving.current = false;
}, [where.key]);
const enter = useCallback((id) => {
  const to = linkOf(id);
  if (!to) return;
  audioContext(); // in the key press or click, so the game can be heard
  api.current?.fx('enter', { id });
  navigate(to, { state: hqState });
}, [navigate]);
const leave = useCallback(() => {
  if (!inside || leaving.current) return;
  leaving.current = true;
  const to = backTarget(here.current);
  if (to === -1) navigate(-1);
  else navigate(to, { replace: true });
}, [inside, navigate]);
// through the portal (only with the Space Stone, in every mode): out of the hangar, or out from under it, to Titan down the page
const portal = useCallback(() => {
  if (!hasEarned('space')) return;
  audioContext();
  leave();
  api.current?.fx('portal');
  onPortal?.();
}, [leave, onPortal]);
```

  - The render: `<Place key={inside} id={inside} onLeave={leave} onPortal={portal} />`. The key remounts `Place` on a jump from one game to another, so its focus and overflow effect (`Place.jsx:160-174`) runs again.
  - Leave `:104` alone. `Place` renders on `inside` in both branches, so a cold link opens it over the loading veil (3D, with the compound’s stage disabled while `inside`, `:229`) or over the cards (no 3D). That is the spec’s cold link: the compound builds when the game closes.
  - Every way in already calls `enter`, so none changes:
    - the door card (`CompoundHud.jsx:149`) and the M list (`:219`);
    - E, Enter and a pad’s A (`go()`, `:276-281`);
    - the cards’ pins and buttons (`:684`, `:698`);
    - `__HQWORLD__.enter` (`:249`).
  - Go there (`travel`, `:616-623`) only moves him to the door, so the address does not change.
  - `useNavigate()` changes identity when the path does, so `enter` and `leave` change with it and World’s key and dev-hook effects (`:246-253`, `:284-342`) re-subscribe. That is harmless. Don’t add `enter` to anything that rebuilds the stage.
- [ ] **Step 4: The hangar’s toy needs the stone** (`Place.jsx`).
  - `TesseractToy({ onPortal, space })`; its button gets `disabled={open || !space}`.
  - Its line becomes `{space ? 'The Space Stone opens a portal. Thanos is on the other side.' : 'The Space Stone opens a portal, and it’s won in the 3D game. Thanos is on the other side.'}`.
  - The `vault` case passes `<TesseractToy onPortal={onPortal} space={hasEarned('space')} />`. `hasEarned` is already imported at `:13`, and PR 2’s `.hq-game .btn:disabled` dims the button by colour.
  - There is no unit test here: importing `Place.jsx` takes 1.7 s in Vitest, over the 1 s rule. The `toy` part covers it, and `progress(['space']).portal` is tested already.
- [ ] **Step 5: One page, one scroll** (`App.jsx` `ScrollToTop`). Opening a game from the cards (and in PR 5, from the board) would otherwise throw the page to the top, and closing would leave it there.
  - Add `const was = useRef(pathname);` and `const hq = was.current !== pathname && inHq(pathname) && inHq(was.current);`.
  - Put `!hq &&` at the front of `top`, and set `now.current = { top, feed, hq }`.
  - The clips effect runs `if (!now.current.feed && !now.current.hq)`.
  - Add a last effect: `useEffect(() => { was.current = pathname; }, [pathname]);`.
  - Comment: a game opening or closing over Avengers HQ is the same page, so there is no jump to the top and the page’s clips play on. A load or reload has `was === pathname`, so its scroll is unchanged.
- [ ] **Step 6: The architecture page.** In `docs/architecture.md:27`, after “`Place.jsx` opens each building’s game.”, add: “Each building has an address of its own (`links.js`, tested: `/avengers/workshop` to `/avengers/hangar`), which opens its game over the compound; `scripts/hq-links-check.mjs` checks every one in a browser.”
- [ ] **Step 7: Run it to see it pass.**
  - `OUT=$S/links node scripts/hq-links-check.mjs`. Expected: every line `ok`, last line `all ok`, exit code 0. Read `$S/links/hq-links-cold.png`: the workshop’s toy is under the dialog’s header, and Stark’s colours are on.
  - `OUT=$S/links node scripts/hq-links-check.mjs --3d`. Expected: `all ok`. Read `$S/links/hq-links-3d.png`: the compound is drawn, not the gradient.
- [ ] **Step 8: Lint and the tests.** `npm run lint && npx vitest run src/components/avengers src/components/tour src/data`. Expected: lint has no problems and no new `eslint-disable`, and every test file passes (PR 1’s `CompoundWorld.test.js` included: `links.js` imports nothing).
- [ ] **Step 9: Commit.**
  - Subject: `Avengers HQ: a building’s address opens its game, and Back, Esc and the button close it the same way`.
  - Body:
    - `CompoundWorld` reads the open building from the route, and a door pushes its link.
    - The way out goes back in the page, or replaces the game with `/avengers` when it came from outside the page.
    - An unknown building is the compound. A cold link opens the game at once, and the compound builds when it closes.
    - The portal needs the Space Stone in every mode, so the Tesseract toy stops opening it for free.
    - A move between the addresses keeps the scroll and the clips.
    - `scripts/hq-links-check.mjs` checks all of it in a browser.

### Task 4: Every way in names the building: the palette, the checklist, the guide and the tour

**Files:**
- Modify: `src/components/avengers/world/links.js` (append `words` to each `LINKS` row; add `HQ_PALETTE`)
- Test: `src/components/avengers/world/links.test.js` (three new `it`s)
- Modify: `src/components/CommandPalette.jsx`: after `:43` (the import), delete `:146` (`w-av` under “Easter eggs”), insert after `:155` (`w-citadel`)
- Modify: `src/data/todo.js:542` (the `thwip` row’s `to`)
- Modify: `src/components/guide/pages.js` (one tip row after `:449`, “The stones”)
- Modify: `src/components/tour/chapters/player.js` (import after `:4`; the `walk('avengers', …)` stop, `:55-58`)
- Test: `src/components/tour/steps.test.js` (import after `:12`; one new `it` at the end of `describe('the player’s worlds')`)
- Modify: `scripts/hq-links-check.mjs` (parts `palette` and `jump`)

**Interfaces:**
- Consumes: Task 1’s `LINKS`, `linkOf`, `placeOf` and `HQ_HOME`; Task 2’s route (the checklist’s and the tour’s routes are tested against `App.jsx`); Task 3’s script helpers.
- Produces:
  - Each `LINKS` row gains `words`, a string of lowercase search words that holds the game’s name without its bang.
  - `export const HQ_PALETTE`: 9 rows `{ id, label, keywords, to }`.
    - The first is `{ id: 'w-av', label: 'Avengers HQ', keywords: <CommandPalette.jsx:146’s keywords, moved verbatim>, to: '/avengers' }`.
    - Then one per `LINKS` row, in order: ``{ id: `w-av-${slug}`, label: `Avengers HQ · ${game}`, keywords: `marvel avengers hq game ${words}`, to: linkOf(id) }``.
  - Palette ids `w-av` and `w-av-<slug>`, all in the group `'Worlds'`.

- [ ] **Step 1: Write the failing tests.**
  - `links.test.js` imports `HQ_PALETTE` too, plus `{ THINGS_TO_DO } from '../../../data/todo'` and `{ PAGES } from '../../guide/pages'`.
  - Read the palette as text, as `deathstar/inside/module.test.js:413-416` reads its files: importing the `.jsx` would bring React and the whole shell.

```js
it('names the compound and each game for the palette, at its own address', () => {
  expect(HQ_PALETTE.map((r) => [r.id, r.label, r.to])).toEqual([
    ['w-av', 'Avengers HQ', '/avengers'],
    ['w-av-workshop', 'Avengers HQ · Repulsor Range', '/avengers/workshop'],
    ['w-av-lawn', 'Avengers HQ · Hold the Lawn', '/avengers/lawn'],
    ['w-av-training', 'Avengers HQ · Ricochet', '/avengers/training'],
    ['w-av-range', 'Avengers HQ · Trick Shot', '/avengers/range'],
    ['w-av-operations', 'Avengers HQ · Infiltration', '/avengers/operations'],
    ['w-av-lab', 'Avengers HQ · Smash Run', '/avengers/lab'],
    ['w-av-gate', 'Avengers HQ · Thwip!', '/avengers/gate'],
    ['w-av-hangar', 'Avengers HQ · Tesseract Run', '/avengers/hangar'],
  ]);
  expect(HQ_PALETTE[0].keywords).toMatch(/^marvel avengers compound tower .* world$/);
  for (const l of LINKS) {
    const r = HQ_PALETTE.find((x) => x.id === `w-av-${l.slug}`);
    expect(r.keywords, r.id).toMatch(/^marvel avengers hq game [a-z0-9 -]+$/);
    expect(r.keywords, r.id).toContain(l.game.toLowerCase().replace('!', ''));
  }
});

it('is in the command palette under Worlds, none of it an Easter egg', () => {
  const src = read('../../CommandPalette.jsx');
  expect(src).toMatch(/\.\.\.HQ_PALETTE\.map\(\(r\) => \(\{ \.\.\.r, group: 'Worlds', icon: RiArrowRightLine, run: go\(r\.to\) \}\)\)/);
  expect(src).not.toMatch(/id: 'w-av'/);
});

it('is where the checklist and the guide send you for a building', () => {
  expect(THINGS_TO_DO.find((t) => t.id === 'thwip').to).toBe(linkOf('spidey'));
  for (const t of THINGS_TO_DO.filter((t) => t.to.startsWith('/avengers/'))) expect(placeOf(t.to.split('/')[2]), t.id).not.toBe(null);
  const tips = PAGES['/avengers'].tips.map(([, v]) => v).join(' ');
  const slugs = LINKS.map((l) => l.slug);
  expect(tips).toContain(`#${HQ_HOME}/`);
  expect(tips).toContain(`${slugs.slice(0, -1).join(', ')} or ${slugs.at(-1)}`);
});
```

  - In `steps.test.js`, add `import { linkOf } from '../avengers/world/links';`, and at the end of `describe('the player’s worlds')`:

```js
it('walks into Avengers HQ with the gate a button away, and the Space Stone opening the portal', () => {
  const stop = WALKED.find((c) => c.id === 'walk-avengers').stops[0];
  expect(stop.actions).toEqual([{ label: 'Play Thwip! at the gate', to: linkOf('spidey') }]);
  expect(textOf(stop, ctx)).toMatch(/the Space Stone opens a portal to Titan/);
});
```

  - In `hq-links-check.mjs`, two parts (without `--3d`):
    - **`palette`.**
      - `goto(BASE + '/home')`, press `Control+k` and type `ricochet`. `#pal-w-av-training` is the `[aria-selected="true"]` option, and the nearest `.palette-group` above its `li` reads `Worlds`. Screenshot to `OUT/hq-links-palette.png`.
      - Press `Enter`: `until('#/avengers/training', true)` with `title === NAME.cap`. Read `n`, then press `Escape`: `until('#/avengers', false)` and `length === n`, so it was replaced.
      - `page.goBack()` gives `#/home`.
      - Open the palette again and type `avengers hq`: `#pal-w-av` is listed, and the nearest `.palette-group` above it reads `Worlds`.
    - **`jump`.**
      - Open `cap` from its card.
      - Press `Control+k`, type `thwip` and press `Enter`: `until('#/avengers/gate', true)` with `title === NAME.spidey`.
      - Press `Escape`: `until('#/avengers', false)`.
- [ ] **Step 2: Run them to see them fail.**
  - `npx vitest run src/components/avengers/world/links.test.js src/components/tour/steps.test.js`. Expected 4 failures:
    - `HQ_PALETTE` is undefined;
    - the palette text still has `id: 'w-av'`;
    - Thwip!’s `to` is `'/avengers'`;
    - the walk’s stop has no `actions`.
  - `OUT=$S/links node scripts/hq-links-check.mjs`. Expected: `FAIL` on `palette` and `jump` (no `#pal-w-av-training`) and `<n> problems`.
- [ ] **Step 3: The palette.**
  - In `links.js`, give each `LINKS` row its `words`:

    | slug | words |
    | --- | --- |
    | `workshop` | `repulsor range iron man tony stark workshop armour suit ultron friday` |
    | `lawn` | `hold the lawn thor mjolnir hammer chitauri lightning` |
    | `training` | `ricochet captain america steve rogers shield training` |
    | `range` | `trick shot hawkeye clint barton bow arrow archery range` |
    | `operations` | `infiltration black widow natasha romanoff stealth spy operations` |
    | `lab` | `smash run hulk bruce banner lab` |
    | `gate` | `thwip spider-man spiderman peter parker web swing school gate queens` |
    | `hangar` | `tesseract run space stone hangar quinjet portal` |

  - Build `HQ_PALETTE` from `LINKS` as Produces says. Comment: how the command palette names the compound and each building’s game; `CommandPalette.jsx` adds the group, the icon and the move.
  - In `CommandPalette.jsx`:
    - After `:43`, add `import { HQ_PALETTE } from './avengers/world/links';`.
    - Delete `:146`.
    - After `:155` (`w-citadel`, the last of the worlds under “Easter eggs”), add the comment `// Avengers HQ, and each building’s game by its own address (avengers/world/links.js)`, then on one line `...HQ_PALETTE.map((r) => ({ ...r, group: 'Worlds', icon: RiArrowRightLine, run: go(r.to) })),`.
    - Keep it on one line, as every palette row is. A reflow breaks the source test.
  - Why “Worlds” and the arrow: §4 moves Avengers HQ out of “Easter eggs” into a new group, which this makes. The arrow is the “Go to” rows’ icon, not the Easter eggs’ sparkle. The other worlds stay where they are, because the spec moves only Avengers HQ.
- [ ] **Step 4: The checklist, the guide and the tour.**
  - `todo.js:542`: the `thwip` row’s `to` becomes `'/avengers/gate'`.
    - The `avengers` row (the swing; its `to` at `:530`) and `infinity-stones` (every building; its `to` at `:554`) talk about the compound as a whole, so they keep `'/avengers'`.
    - The checklist’s Show me follows the new `to`, with no navigation state, so its Back replaces.
  - `guide/pages.js`, after “The stones” (`:449`), add one tip row: `['A link to each game', 'Each game has an address of its own, #/avengers/ and its building: workshop, lawn, training, range, operations, lab, gate or hangar. It opens at once over the compound; Esc or Back closes it.']`.
    - Tips render as plain text (`GuidePanel.jsx:27-38`), so the tip names the links. The hash is in it because the site is a `HashRouter`.
    - No keys row changes (draft #1028).
  - `player.js`:
    - Add `import { linkOf } from '../../avengers/world/links';` after `:4`.
    - In the `walk('avengers', …)` stop, add `actions: [{ label: 'Play Thwip! at the gate', to: linkOf('spidey') }]`.
    - Keep PR 2’s `text` exactly as it is.
    - An action with `to` ends the tour, as every Go there does (`TourHost.jsx:318-333`).
- [ ] **Step 5: Run them to see them pass.**
  - `npx vitest run src/components/avengers/world/links.test.js src/components/tour/steps.test.js src/data/todo.test.js src/lib/words.test.js src/components/guide/pages.test.js`. Expected: 5 files pass; `links.test.js` has 10 tests. The reading-times log keeps the player’s tour where PR 2 left it (597 s, against a budget of 660), because an action adds no words.
  - `OUT=$S/links node scripts/hq-links-check.mjs`. Expected: `all ok`. Read `$S/links/hq-links-palette.png`: “Avengers HQ · Ricochet” under a Worlds header.
- [ ] **Step 6: Lint.** `npx eslint src/components/CommandPalette.jsx src/components/avengers/world src/components/tour src/components/guide src/data scripts/hq-links-check.mjs`. Expected: no output.
- [ ] **Step 7: Commit.**
  - Subject: `Avengers HQ: the palette, the checklist, the guide and the tour link to the building`.
  - Body:
    - The palette gets one entry per game under Worlds, and the compound’s entry leaves the Easter eggs.
    - Thwip!’s checklist row goes to the gate.
    - The guide names each building’s address.
    - The tour’s walk offers the gate.
    - The check script drives the palette.

### Task 5: Verify the PR and open it

**Files:**
- Create: `docs/superpowers/evidence/avengers-hq/pr3/README.md`, plus the pictures it lists (`.webp` or `.png`, each under 1 MB, so committed rather than published to the bucket)

**Interfaces:**
- Consumes: everything Tasks 1–4 produce; the before files from “Before Task 1”.
- Produces: the pull request.

- [ ] **Step 1: The gates.**
  - Run `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build | tee $S/health-after.txt`, then `git checkout public/github.json`.
  - Expected: lint clean; every test file passes (record the counts against `$S/tests-before.txt`); the build is green.
  - Expected from health: `within budget`, with `big-files`, `boundary-breaks`, `lint-disables`, `loops`, `kbd-styles` and `hud-kit` as in `$S/health-before.txt`.
  - Don’t ratchet a budget: the steward lowers budgets after the merge.
- [ ] **Step 2: The `/avengers` closure.**

```bash
npx vite build && node --input-type=module -e "import{readFileSync as r}from'node:fs';import{gzipSync as g}from'node:zlib';const m=JSON.parse(r('dist/.vite/manifest.json','utf8'));const seen=new Set(),rows=[];const v=(k)=>{const c=m[k];if(!c||seen.has(k)||c.isEntry)return;seen.add(k);for(const f of[c.file,...(c.css??[])]){const b=r('dist/'+f);rows.push([c.name??k,b.length,g(b).length,f])}(c.imports??[]).forEach(v)};v('src/pages/Avengers.jsx');const kb=(n)=>(n/1024).toFixed(0)+' kB';console.log('/avengers static closure, app entry left out:',rows.length,'files',kb(rows.reduce((s,x)=>s+x[1],0)),'raw',kb(rows.reduce((s,x)=>s+x[2],0)),'gzip');for(const x of rows.sort((a,b)=>b[1]-a[1]))console.log(' ',String(x[0]).padEnd(28),kb(x[1]).padStart(7),kb(x[2]).padStart(7),x[3])" | tee $S/closure-after.txt; git checkout public/github.json
```

  - Expected: within 1 kB of `$S/closure-before.txt`. `links.js` is about 2 kB and is shared with the app’s entry, which the count leaves out.
  - Zero files means the page’s key isn’t `src/pages/Avengers.jsx`: grep the manifest for it.
- [ ] **Step 3: Nothing shared changed.** `git diff --stat origin/main -- src/components/avengers/hq src/runtime/hud`. Expected: no output, so `scripts/inv-world-check.mjs` is not run (§12 runs it when `hq/` changes). Say so in the PR.
- [ ] **Step 4: The pages in a browser.**
  - `node scripts/autopilot-check.mjs --only smoke --routes /avengers,/invincible,/avengers/gate,/avengers/nowhere --shots 9003`, then the same with `--phone` and without `--shots`.
  - Each must end `everything green`: no page error, no console error beyond `scripts/lib/noise.mjs`’s noise, and a canvas on every route (`/avengers/nowhere` lands on `/avengers`).
  - Read `public/changes/9003-a.webp` (`/avengers`) beside `$S/9003-before.webp`. The compound must look the same. Read `-b.webp` (`/invincible`): unchanged.
  - Move the shots into the evidence folder, then `git checkout public/github.json`.
- [ ] **Step 5: The links, the world.** With `npx vite --port 5173 --strictPort` up:
  - `OUT=$S/links node scripts/hq-links-check.mjs` and `OUT=$S/links node scripts/hq-links-check.mjs --3d`. Each must end `all ok`. Count the `ok` lines for the PR.
  - `OUT=$S/hq-after node scripts/hq-world-check.mjs`: it prints `compound up in` and ends `no page errors`. Its nine shots match `$S/hq-before` by eye; the compound is unchanged.
  - Copy `hq-links-cold.png`, `hq-links-3d.png` and `hq-links-palette.png` into the evidence folder.
- [ ] **Step 6: The evidence README** at `docs/superpowers/evidence/avengers-hq/pr3/README.md`.
  - One line per picture: what it shows, and before or after.
  - The numbers, before → after:
    - the `/avengers` closure (files, raw, gzip);
    - the test files and tests;
    - the health metrics (unchanged);
    - the addresses (0 → 8);
    - the palette (“Avengers HQ” under Easter eggs → nine rows under Worlds);
    - `hq-links-check.mjs`’s `ok` lines in 2D and in 3D.
  - Commit: `Avengers HQ PR 3: the evidence`.
- [ ] **Step 7: Draft #1028, again.** `gh pr view 1028 --json state`.
  - Merged since the branch was cut: `git merge origin/main` (never a rebase), then rerun Step 1.
  - Still open: name this PR’s hunks in `App.jsx`, `guide/pages.js` and `pages.test.js` in the PR body, for its owner.
- [ ] **Step 8: Open the pull request.**
  - `git push -u origin <branch>`, then open the PR with base `main` and title `Avengers HQ 3 of 7: links and navigation`.
  - The body:
    - one paragraph per task, with the decisions a reviewer should weigh:
      - Back reads navigation state (`hqState`), not `location.key` alone;
      - a cold link builds the compound when the game closes;
      - `routeTheme` and `whereOf` keep Stark’s colours and the online room under a building’s address;
      - only Thwip!’s checklist row moves;
    - the numbers table from Step 6;
    - the checks that ran (Steps 1–5) with their outcomes, and why `inv-world-check` did not run;
    - the screenshots as images from `https://raw.githubusercontent.com/tilakpatell/tilakpatell.com/<branch>/docs/superpowers/evidence/avengers-hq/pr3/<file>`: `/avengers` before and after, a cold link, the compound after a cold 3D link, the palette;
    - for the PRs after it: `hqState` on the board’s and Titan’s links, Next with `{ replace: true, state: location.state }`, `CARD` and `PLAY` in the check;
    - the harness’s PR footer.
  - It is one PR, merged with a merge commit once CI is green. Never force-push; a requested change is a new commit.

---

## Self-review against the spec

- **§4, the route and one page:** Task 2 (`/avengers/:place?`, `pageKey` through `inHq`), with Task 3’s `ScrollToTop`.
- **§4, the table:** Task 1 (`links.js`, `linkOf`, `placeOf`; an unknown slug is `null`). Task 3 replaces it with `/avengers`.
- **§4, from the route:** Task 3. A door pushes; Back by the button, Esc or the browser goes back; from outside the page, Back replaces. The rule is Task 1’s `backTarget`.
- **§4, a cold deep link:** Task 3. The game opens at once and the compound builds behind its veil when it closes (part `3d-cold`). Without 3D, the cards are there at once; PR 5’s board takes their place.
- **§4, the palette, the checklist, the tour and the guide:** Task 4. One entry per game under Worlds, and the bare entry out of “Easter eggs”. Thwip!’s row goes to the gate. The walk offers the gate. A tip names the links.
- **§4, the portal:** Task 3. Space Stone only, in every mode, through one choke point; the toy is disabled and says why.
- **§3:** no drawing; no key renamed; `__HQWORLD__.enter` kept and checked (`3d-hook`); nothing under `hq/`; copy in the house style; `guide/pages.js` one row.
- **§12:**
  - Vitest: `links.js` both ways and unknown slugs (Task 1).
  - Browser: every link opens its game and Back closes it, `scripts/hq-links-check.mjs` added here (Tasks 3 and 4).
  - Autopilot-check before, after and `--phone`, and `hq-world-check` (Task 5).
  - The closure’s size stated (Task 5).
  - `inv-world-check` is not needed, and Task 5 Step 3 proves it.
- **Cross-checks applied:**
  - The tour keeps PR 2’s sentence and only gains the action.
  - The check script’s selectors survive PR 4’s bar, and `CARD` and `PLAY` are PR 5’s to change.
  - `hqState` is exported for PR 5’s board and PR 6’s Next link.
  - `gameOf` is exported and the gate’s game is “Thwip!” for PR 5.
