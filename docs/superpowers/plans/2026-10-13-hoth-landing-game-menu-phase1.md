# Hoth lands in the game's menu, phase 1: the implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flying into Hoth opens the game's main menu with the game's level loading behind it; the site's waiting screen and Hoth's old landing are gone.

**Architecture:** The galaxy asks one small table which worlds land in the game and navigates to `/battlefront/hoth`. That page mounts the Battlefront world once and draws the game's front end over it; leaving the menu shows the game's loading screen until the level is ready, then the game's spawn screen, then the wipe. What stands over the world at each moment is one pure function, tested in Node.

**Tech Stack:** React 19, react-router-dom 7, three.js through `src/runtime`, Vitest 5 (Node, `renderToStaticMarkup`; there is no DOM test environment), Playwright with Edge for the browser checks.

**Spec:** `docs/superpowers/specs/2026-10-13-hoth-landing-game-menu-design.md` (approved 2026-10-13). This plan is its phase 1. Phases 2, 2b, 3 and 4 get their own plans.

## Global Constraints

- Hoth only. Every other planet's landing, surface and mode menu behave exactly as before.
- From the galaxy into Hoth, nothing of the surface world is fetched or built (`/models/galaxy/surface/`, `surface/scene`, `surface/module`).
- One world for the visit: going from the menu to the battle must not mount the Battlefront world again. The address stays `/battlefront/hoth` for the visit (App.jsx keys a page by its pathname, so a new pathname would mount it again).
- The site's waiting screen is deleted with its day picker, machine line and quality button. Nothing replaces them. The game's coin picks the day (`pickVariant()`).
- Worlds are islands (`docs/health/RULES.md`): the galaxy does not import `src/components/battlefront/`. The route string the galaxy uses is the galaxy's own constant, held equal to the Battlefront world's by a test under `src/pages/`.
- `src/components/battlefront/module.js` and `battle.js` are not edited (another session is changing them).
- The branch is based on `main` after the sim lane's pull request (branch `claude/bf-instant-action`: the page's battle runs the sim's own mode). From then the page sends a pick and a deploy as the offer, `{ kind, id }`; every send this plan moves keeps the shape `main` has.
- Budgets already at their limit (`node scripts/health.mjs`): no new file over the big-file line, no new `eslint-disable`, no new `kbd` style rule.
- Comments and commit messages in the repo's voice (plain sentences, what and why). Every commit ends with the session's attribution lines.
- Before the pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **A link straight to the battle** (`/battlefront/hoth/galacticAssault`, the galaxy panel's tile, old bookmarks): no menu; the loading screen, then the spawn screen. Pinned in Task 2 (`standing` with `inMenu: false`) and walked in Task 6.
2. **The screens' code fails to load** (offline, a blocked chunk): the parked camera's view must not be shown raw, and Deploy must still be possible. Pinned in Task 2 (`cover` in `standing`) and Task 3 step 6 (the HUD's own deploy screen stands in).
3. **Play pressed before the level is ready**: the loading screen, never a spawn screen whose Deploy does nothing. Pinned in Task 2.
4. **Back and old addresses**: `/galaxy/hoth/surface` (with any `?mission=` or `?mode=`) reaches the menu with a replace, so Back does not bounce; the menu's own back goes to `/galaxy/hoth`, never to the redirecting address. Pinned in Task 1 (`wayBack`) and walked in Task 6.
5. **Keyboard alone**: from the menu to the field with Enter and the arrows, the focus landing on the first spawn cell when that screen comes up. Walked in Task 6 (no DOM tests here).

---

## File structure

| file | responsibility |
| --- | --- |
| `src/components/battlefront/index.js` (modify) | the world's face: adds `menuRouteFor`, `firstModeOf` |
| `src/components/galaxy/gameLevels.js` (create) | which galaxy worlds land in the game's menu, and the way down from the galaxy |
| `src/pages/battlefrontRoutes.test.js` (create) | holds the galaxy's constant to the Battlefront world's route |
| `src/components/battlefront/stage.js` (create) | pure: what stands over the world (`standing`) |
| `src/components/battlefront/Wipe.jsx`, `wipe.css` (create) | the game's black wipe, moved out of the waiting screen |
| `src/components/battlefront/BattlefrontWorld.jsx` (modify) | the page body: menu, loading, spawn, wipe, field |
| `src/components/battlefront/screens/FrontEnd.jsx` (modify) | `onExit`: the main menu's back when the front end stands over a world |
| `src/components/battlefront/screens/Spawn.jsx` (modify) | focus on the first cell that can be afforded |
| `src/pages/Battlefront.jsx` (modify) | `/battlefront/:level` with no mode mounts the world with the menu |
| `src/pages/GalaxyLanding.jsx` (create) | `/galaxy/:system/surface`: the redirect for a game world, the surface page for the rest |
| `src/pages/Galaxy.jsx`, `src/App.jsx` (modify) | the two ways down; the route's element |
| `src/components/galaxy/systems.js`, `surface/modes.js`, `surface/landLine.js`, `GalaxyPanel.jsx`, `surface/missions/index.js` (modify) | Hoth's old landing unlinked |
| deleted | `battlefront/WaitingScreen.jsx`, `waiting.css`, `WaitingScreen.test.jsx` |
| `scripts/bf-landing-check.mjs` (create) | the browser checks and the numbers |

---

### Task 1: The routes

**Files:**
- Modify: `src/components/battlefront/index.js`, `src/components/battlefront/index.test.js`
- Create: `src/components/galaxy/gameLevels.js`, `src/components/galaxy/gameLevels.test.js`, `src/pages/battlefrontRoutes.test.js`

**Interfaces:**
- Produces: `menuRouteFor(level = 'hoth', { from = null } = {}) → string`; `firstModeOf(level) → string | null`; `GAME_MENU: { [system]: string }`; `gameMenuFor(system) → string | null`; `wayDown(system, district = null) → { to: string, game: boolean }`.

- [ ] **Step 1: Write the failing tests**

`src/components/battlefront/index.test.js`, added to the existing `describe`:

```js
it('names the menu a level lands in, with the way back, and the level’s first mode', () => {
  expect(menuRouteFor()).toBe('/battlefront/hoth');
  expect(menuRouteFor('hoth', { from: '/galaxy/hoth' })).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
  expect(wayBack('?from=%2Fgalaxy%2Fhoth')).toEqual({ label: 'Back to Hoth', to: '/galaxy/hoth' });
  expect(wayBack('?from=%2Fgalaxy%2Fhoth%2Fsurface')).toBe(null);
  expect(firstModeOf('hoth')).toBe('galacticAssault');
  expect(firstModeOf('nowhere')).toBe(null);
});
```

`src/components/galaxy/gameLevels.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { GAME_MENU, gameMenuFor, wayDown } from './gameLevels';
import { canLand } from './surface/sites';

describe('the worlds that land in the game', () => {
  it('Hoth, and only Hoth, and it is a world the galaxy lets you land on', () => {
    expect(Object.keys(GAME_MENU)).toEqual(['hoth']);
    expect(gameMenuFor('hoth')).toBe('/battlefront/hoth?from=%2Fgalaxy%2Fhoth');
    expect(gameMenuFor('endor')).toBe(null);
    expect(gameMenuFor(undefined)).toBe(null);
    for (const s of Object.keys(GAME_MENU)) expect(canLand(s)).toBe(true);
  });
  it('the way down: the game’s menu for Hoth whatever the district, the surface for the rest', () => {
    expect(wayDown('hoth')).toEqual({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', game: true });
    expect(wayDown('hoth', 'echo base')).toEqual({ to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth', game: true });
    expect(wayDown('endor')).toEqual({ to: '/galaxy/endor/surface', game: false });
    expect(wayDown('coruscant', 'level 1313')).toEqual({ to: '/galaxy/coruscant/surface?district=level%201313', game: false });
  });
});
```

`src/pages/battlefrontRoutes.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { menuRouteFor, wayBack } from '../components/battlefront';
import { GAME_MENU } from '../components/galaxy/gameLevels';

describe('the galaxy’s way into the game', () => {
  it('each row is the Battlefront world’s own menu route, and its way back is that world', () => {
    for (const [system, to] of Object.entries(GAME_MENU)) {
      expect(to).toBe(menuRouteFor(system, { from: `/galaxy/${system}` }));
      expect(wayBack(to.slice(to.indexOf('?')))).toMatchObject({ to: `/galaxy/${system}` });
    }
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/components/battlefront/index.test.js src/components/galaxy/gameLevels.test.js src/pages/battlefrontRoutes.test.js`
Expected: FAIL (`menuRouteFor` is not exported; `./gameLevels` not found).

- [ ] **Step 3: Implement**

In `index.js`: `menuRouteFor` beside `routeFor`, built the same way (`ROUTE/level`, then `?from=` through `encodeURIComponent`); `firstModeOf = (level) => LEVEL_MODES[level]?.[0] ?? null`. `gameLevels.js` is pure and imports nothing from the Battlefront world: `GAME_MENU = { hoth: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth' }`, with a header comment saying what the table is and that `src/pages/battlefrontRoutes.test.js` holds it to the world's route.

- [ ] **Step 4: Run the tests and see them pass**

Run: the command of step 2. Expected: PASS.

- [ ] **Step 5: Commit**

`git add` the five files; message: `Battlefront: the menu's route for a level, and the galaxy's table of the worlds that land in it`.

---

### Task 2: What stands over the world, and the menu over it

**Files:**
- Create: `src/components/battlefront/stage.js`, `src/components/battlefront/stage.test.js`
- Modify: `src/components/battlefront/screens/FrontEnd.jsx`, `src/components/battlefront/screens/screens.test.jsx`, `src/components/battlefront/BattlefrontWorld.jsx`, `src/pages/Battlefront.jsx`

**Interfaces:**
- Consumes: `menuRouteFor`, `firstModeOf` (Task 1).
- Produces: `standing({ inMenu, phase, ready, loaded = true, screens = true }) → { menu: boolean, loading: boolean, spawn: boolean, wipe: 'down' | 'up' | null, cover: boolean, name: 'menu' | 'loading' | 'spawn' | 'field' }`, where `phase` is `'pre' | 'down' | 'up' | 'in'` (`'pre'`: before the first deploy). `<FrontEnd start="menu" onExit={fn} />`. `<BattlefrontWorld level mode menu back playable={(level, mode) => boolean} />`.

- [ ] **Step 1: Write the failing tests**

`stage.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { standing } from './stage';

const s = (o) => standing({ inMenu: false, phase: 'pre', ready: false, ...o });

describe('what stands over the Battlefront world', () => {
  it('the menu, while it is open, whatever the level has done', () => {
    expect(s({ inMenu: true, ready: true })).toMatchObject({ menu: true, loading: false, spawn: false, wipe: null, name: 'menu' });
    expect(s({ inMenu: true })).toMatchObject({ menu: true, loading: false, spawn: false, name: 'menu' });
  });
  it('out of the menu before the level is ready: the loading screen, never the spawn screen', () => {
    expect(s({})).toMatchObject({ menu: false, loading: true, spawn: false, wipe: null, name: 'loading' });
  });
  it('ready: the first spawn screen, kept under the wipe’s black on the way down', () => {
    expect(s({ ready: true })).toMatchObject({ loading: false, spawn: true, wipe: null, name: 'spawn' });
    expect(s({ ready: true, phase: 'down' })).toMatchObject({ spawn: true, wipe: 'down', name: 'spawn' });
  });
  it('the wipe lifting, then the field: nothing of the way in is left', () => {
    expect(s({ ready: true, phase: 'up' })).toMatchObject({ menu: false, loading: false, spawn: false, wipe: 'up', name: 'field' });
    expect(s({ ready: true, phase: 'in' })).toMatchObject({ loading: false, spawn: false, wipe: null, name: 'field' });
  });
  it('in the field with the level gone back to streaming: the loading screen as a veil', () => {
    expect(s({ ready: false, phase: 'in', loaded: false })).toMatchObject({ loading: true, spawn: false, name: 'loading' });
  });
  it('covers the parked camera until the game’s screens have come, and not after the first deploy', () => {
    expect(s({ screens: false })).toMatchObject({ cover: true });
    expect(s({ inMenu: true, screens: false })).toMatchObject({ cover: true });
    expect(s({ screens: true })).toMatchObject({ cover: false });
    expect(s({ ready: true, phase: 'in', screens: false })).toMatchObject({ cover: false });
  });
});
```

`screens.test.jsx`, a new case:

```js
it('the front end over a world: lands in the main menu, and draws it from the game’s tree', () => {
  const h = html(<FrontEnd start="menu" onExit={() => {}} />);
  expect(h).toContain('data-front-end="menu"');
  expect(h).toContain('data-screen="UI/Frontend/Screens/Start/MainMenuScreen"');
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/components/battlefront/stage.test.js src/components/battlefront/screens/screens.test.jsx`
Expected: FAIL (`./stage` not found). The `screens.test.jsx` case may already pass; it pins behaviour the next steps must keep.

- [ ] **Step 3: Implement `standing` in `stage.js`**

Pure, no imports. The rules the tests fix: `menu = inMenu`; `loading = !inMenu && ((phase === 'pre' && !ready) || (phase === 'in' && !loaded))`; `spawn = !inMenu && ((phase === 'pre' && ready) || phase === 'down')`; `wipe` is the phase when it is `'down'` or `'up'`; `cover = !screens && (phase === 'pre' || phase === 'down')`; `name` is `'menu'`, else `'loading'`, else `'spawn'`, else `'field'`.

- [ ] **Step 4: `FrontEnd` takes `onExit`**

Signature: `FrontEnd({ playable, onPlay, start = 'start', onExit = null })`. The main menu's `onStart` is `onExit` when one is given, else the Start screen as today. Update the header comment's usage line.

- [ ] **Step 5: `BattlefrontWorld` takes `menu`**

Signature: `BattlefrontWorld({ level = 'hoth', mode = 'galacticAssault', back = null, menu = false, playable = () => true })`. New state `inMenu`, first `menu`. While `standing(...).menu`, draw `screens.FrontEnd` with `start="menu"`, `playable` (the page's rule, passed down as a prop `playable`), `onPlay={() => setInMenu(false)}` and `onExit={() => navigate(way.to)}`. While `standing(...).cover`, draw `<div className="bf-cover" />` (fixed, inset 0, black, under the screens: one rule in `hud/battlefront.css`). Put `data-bf-stage={standing(...).name}` on the `WorldHost`. The waiting screen is untouched in this task: it shows only when `!inMenu`.

- [ ] **Step 6: The page**

In `pages/Battlefront.jsx`: with a `level` in `LEVELS` and no `mode`, render `<BattlefrontWorld level={level} mode={firstModeOf(level)} menu back={back} playable={playable} />`; with a `level` not in `LEVELS`, `<Navigate to="/battlefront" replace />`. `/battlefront` alone and `/battlefront/<level>/<mode>` are as today.

- [ ] **Step 7: Run the tests, then the page in the browser**

Run: `npx vitest run src/components/battlefront src/pages` → PASS.
Run the dev server (`npx vite --port 5431 --mode collectioncheck > .scratch-check/dev.log 2>&1 &`, or reuse the one listening on 5431) and open `http://127.0.0.1:5431/#/battlefront/hoth?from=/galaxy/hoth`: the game's main menu, `[data-bf-stage="menu"]`; PLAY → Multiplayer → Assault → Galactic Assault → Hoth closes the menu onto today's waiting screen with no second load in the network log; Escape on the main menu goes to `/galaxy/hoth`.

- [ ] **Step 8: Commit**

Message: `Battlefront: a level's address mounts the world behind the game's main menu`.

---

### Task 3: The first life through the game's loading and spawn screens; the waiting screen deleted

**Files:**
- Create: `src/components/battlefront/Wipe.jsx`, `src/components/battlefront/wipe.css`
- Modify: `src/components/battlefront/BattlefrontWorld.jsx`, `src/components/battlefront/waiting.js`, `src/components/battlefront/waiting.test.js`, `src/components/battlefront/screens/Spawn.jsx`, `src/components/battlefront/screens/Loading.jsx` (its comment only), `src/components/battlefront/sound/loading.js` (its comment only), `scripts/bf2017-abilities-check.mjs:67-69`, `scripts/bf2017-sound-check.mjs:202-209`
- Delete: `src/components/battlefront/WaitingScreen.jsx`, `src/components/battlefront/waiting.css`, `src/components/battlefront/WaitingScreen.test.jsx`

**Interfaces:**
- Consumes: `standing` (Task 2).
- Produces: `Wipe({ phase })` from `./Wipe.jsx` (as it was in `WaitingScreen.jsx`); `waiting.js` exports `DARKROOM_EV`, `ADAPT_S`, `MAX_STOPS`, `WIPE`, `QUIET_S`, `HUD_QUIET`, `PROGRESS_SHARE`, `VARIANTS`, `pickVariant`, `readiness`, `stopsFrom`, `arrivalExposure` and nothing else. Browser hooks: `[data-bf-stage="menu|loading|spawn|field"]` on the stage; `.bf-spawn-screen-cell[data-kind="class"]` is the first life's Deploy.

- [ ] **Step 1: Change the tests first**

In `waiting.test.js`: delete the cases for `recommend`, `machineLine` and `recommendationLine`, and add:

```js
it('keeps the rules of the way in and none of the old screen’s lines', async () => {
  const m = await import('./waiting.js');
  for (const gone of ['recommend', 'machineLine', 'recommendationLine', 'COIN']) expect(m[gone]).toBeUndefined();
  for (const kept of ['readiness', 'pickVariant', 'WIPE', 'arrivalExposure', 'stopsFrom']) expect(m[kept]).toBeDefined();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/components/battlefront/waiting.test.js` → FAIL (`recommend` is defined).

- [ ] **Step 3: Move the wipe out**

`Wipe.jsx` holds the `Wipe` component as it is in `WaitingScreen.jsx` and imports `./wipe.css`, which takes the four `.bf-wipe` rules from `waiting.css` (lines 49 to 51, and the two inside its media queries: reduced motion and the `up` state), each media query kept around its rule.

- [ ] **Step 4: `waiting.js`**

Remove `recommend`, `machineLine`, `recommendationLine`, `COIN`, the helper `n` and the `LEVELS` import. Rewrite the header comment: the way in is the game's menu, loading screen and spawn screen; the day is the coin's.

- [ ] **Step 5: `BattlefrontWorld.jsx`**

- The day: `const [day] = useState(() => pickVariant())`, sent once as the world's `weather` prop. The `variant`, `rolled`, `applied`, `sentDay` state and the effect that sends `'weather'` go.
- The machine and recommendation lines, `canApply`, `onApply`, and the imports they needed (`stepsAt`, `device`, `quality`, `setQuality`, `gpu`) go.
- `phase` starts at `'pre'` (it was `'waiting'`).
- `<Loading mode={mode} level={level} progress={progress.value} waiting={progress.line} />` while `standing(...).loading`. The plain “Bringing Hoth in” paragraph goes.
- The HUD's `deployAs`: `Nothing` while `menu` or `loading`; else `screens.Spawn` when the screens came, else the HUD's own default. Its `onDeploy`: `deployThrough` while `phase === 'pre'` (the wipe, as the waiting screen's Deploy ran it; its guard becomes `phase !== 'pre' || !progress.ready`), the direct send after.
- The loading cue: one effect, `startLoadingMusic(level)` while `!inMenu && phase === 'pre'`, its return the cleanup (so it stops at the wipe's swap and never plays under the menu).
- The header comment rewritten to the new order.

- [ ] **Step 6: `Spawn.jsx`**

In `SpawnTree`, an effect on mount focuses the first cell that is not `aria-disabled` (`preventScroll`), so Enter deploys from the keyboard. The fallback (`<DeployScreen>` when there is no tree) stays: it is what stands when the game's trees fail.

- [ ] **Step 7: Delete the waiting screen and repoint what waited on it**

Delete the three files. In `scripts/bf2017-abilities-check.mjs` and `scripts/bf2017-sound-check.mjs`: wait for `[data-bf-stage="spawn"]` where they waited for `[data-deploy]:not([disabled])`; click `.bf-spawn-screen-cell[data-kind="class"]` where they clicked `[data-deploy]`; wait for `[data-bf-stage="field"]` where one waited for `.bf-waiting` to detach. In `Loading.jsx` and `sound/loading.js`, the comments that name `WaitingScreen.jsx` say the page (`BattlefrontWorld.jsx`) instead.

- [ ] **Step 8: Run everything of the world**

Run: `npx vitest run src/components/battlefront src/lib/bf2017 src/runtime/hud` → PASS.
Run: `grep -rn "WaitingScreen\|bf-waiting\|data-deploy\|machineLine\|recommendationLine" src scripts` → no output.
Run: `npx eslint src/components/battlefront scripts/bf2017-abilities-check.mjs scripts/bf2017-sound-check.mjs` → no output.

- [ ] **Step 9: Walk it in the browser**

`#/battlefront/hoth`: menu → Play → Hoth: the game's loading screen until ready, then the spawn screen with the first class focused; Enter: black down, black up, the field; no `.bf-waiting` in the page. `#/battlefront/hoth/galacticAssault`: no menu, the same from the loading screen on. Dying and deploying again: no wipe, as before.

- [ ] **Step 10: Commit**

Message: `Battlefront: the first life goes through the game's loading and spawn screens; the site's waiting screen goes`.

---

### Task 4: The galaxy's two ways down, and the old address

**Files:**
- Create: `src/pages/GalaxyLanding.jsx`
- Modify: `src/pages/Galaxy.jsx` (`onCrash`, `land`, the prefetch effect near line 339), `src/App.jsx:39` (the lazy import)

**Interfaces:**
- Consumes: `wayDown`, `gameMenuFor` (Task 1).
- Produces: `GalaxyLanding` (default export): the element of `/galaxy/:system/surface`.

- [ ] **Step 1: `GalaxyLanding.jsx`**

Reads `useParams().system`; when `gameMenuFor(system)` is a string, `<Navigate to={it} replace />`; else the surface page, imported lazily inside this file (`lazy(() => import('./GalaxySurface'))`) so a redirect fetches none of it. `App.jsx`'s `GalaxySurface` lazy import points at `./pages/GalaxyLanding`; the route line is unchanged.

- [ ] **Step 2: `Galaxy.jsx`**

- `onCrash(id)`: `const down = wayDown(id)`. A game world: no `prefetchSurface()`; `setLeaving({ to: down.to, crash: true })` and the same 700 ms timer to `navigate(down.to)`.
- `land(id, district)`: a game world leaves by the route (`leave(down.to, { land: true })`) and never calls `runtime().handover(surfaceModule, …)`.
- The prefetch effect: near a game world it fetches the Battlefront page and the game's screens instead (`import('./Battlefront')`, `import('../components/battlefront/screens/index.js')`, each with `.catch(() => {})`), and neither `prefetchSurface()` nor `./GalaxySurface`.

- [ ] **Step 3: Check in the browser, with the network log**

Run: `node scripts/bf-landing-check.mjs --url "/#/galaxy/hoth/surface?mission=transport" --until "[data-bf-stage=menu]" --deny "surface/(scene|module)|/models/galaxy/surface/"` (Task 6 writes the script; until then, the same by hand in Edge's network panel).
Expected: the address ends at `#/battlefront/hoth?from=%2Fgalaxy%2Fhoth`; no denied request; Back does not return to the surface address. In the galaxy at Hoth, the Land button and flying into the planet both end in the menu; at Endor both end on its surface as before.

- [ ] **Step 4: Run the galaxy's and the pages' tests**

Run: `npx vitest run src/pages src/components/galaxy/gameLevels.test.js` → PASS. `npx eslint src/pages` → no output.

- [ ] **Step 5: Commit**

Message: `Galaxy: flying into Hoth or landing on it opens the game's menu; its old surface address goes there too`.

---

### Task 5: Hoth's old landing unlinked

**Files:**
- Modify: `src/components/galaxy/systems.js` (Hoth's `game`, near line 226), `src/components/galaxy/surface/modes.js:57-58,73,86`, `src/components/galaxy/surface/landLine.js:15`, `src/components/galaxy/GalaxyPanel.jsx:57`, `src/components/galaxy/surface/missions/index.js:285` (the `MISSIONS.hoth` block), and the tests that pin them: `surface/modes.test.js` (cases at lines 28 and 67), `systems.test.js`, `surface/missions/index.test.js`

**Interfaces:**
- Consumes: `GAME_MENU` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Change the tests first**

In `modes.test.js`: the Hoth case (line 28) becomes “Hoth has no landing menu of the site's: its landing is the game's”, asserting `gameMenuFor('hoth')` is a string and that `MISSIONS.hoth` is `undefined`; the case that walks every landable world (line 67 and the one at line 13) skips worlds for which `gameMenuFor(id)` is a string. In `systems.test.js`: Hoth's briefing is live and its `to` is `GAME_MENU.hoth`, and it has no `also` row whose `to` contains `/galaxy/hoth/surface`.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/components/galaxy/surface/modes.test.js src/components/galaxy/systems.test.js` → FAIL.

- [ ] **Step 3: Unlink**

- `systems.js`: Hoth's `game` is the battle alone: the title and text of today's `also` row `assault` become the briefing's own (`title: 'The Battle of Hoth'`), `to: '/battlefront/hoth?from=%2Fgalaxy%2Fhoth'`, `status: 'live'`, no `also`. The transport mission's words go.
- `modes.js`: the `BATTLEFRONT` table, the `battlefront` parameter and its branch go.
- `landLine.js` and `GalaxyPanel.jsx`: the pattern that knows a Battlefront address takes the menu's too: `/^\/battlefront\/[a-z0-9-]+(\/galacticAssault|\?|$)/`.
- `missions/index.js`: the `MISSIONS.hoth` block goes. A mission module that only that block imported goes with it; one that another world's block imports stays. The code that makes Hoth's ground (`surface/sites/ice.js`, `surface/props/ice.js`, `surface/catalog/ice.js`) is not touched: `canLand('hoth')` must stay true, and the owner keeps the ground for a later free-roam mode.

- [ ] **Step 4: Run the galaxy's tests and the health check**

Run: `npx vitest run src/components/galaxy` → PASS. `npx eslint src/components/galaxy` → no output. `node scripts/health.mjs --check --skip build` → `within budget`.

- [ ] **Step 5: Commit**

Message: `Galaxy: Hoth's briefing, panel and menus point at the game; its old surface missions go`.

---

### Task 6: The checks, and the numbers

**Files:**
- Create: `scripts/bf-landing-check.mjs`, `docs/superpowers/evidence/bf-landing-menu/README.md`
- Modify: `docs/superpowers/HANDOFF-battlefront.md` (a section for this lane)

**Interfaces:**
- Produces: `node scripts/bf-landing-check.mjs --url <hash path> --until <selector> [--then <selector to click>…] [--deny <regex>] [--base http://127.0.0.1:5431] [--size 2560x1440] [--gpu webgpu]` → JSON on stdout: `{ url, finalUrl, ms, longestTaskMs, gapsOver100, p95GapMs, denied: [url…], errors: [text…], worlds }`; exit code 1 when `denied` or `errors` is not empty.

- [ ] **Step 1: Write the script**

After `scripts/battlefront-check.mjs` (playwright-core, Edge by `CHROME=`, the same init script for `tp-` keys). It starts a `PerformanceObserver` for `longtask` and a `requestAnimationFrame` gap recorder before navigation (`addInitScript`), logs every request URL, goes to the address, waits for `--until`, clicks each `--then` in turn waiting for the next, and reads `window.__battlefront` once for the count of worlds made (1 expected). No frame time is gated; the numbers are reported.

- [ ] **Step 2: Measure before and after on the same machine in the same hour**

Before (a worktree of `origin/main` as it was before this branch, its own dev server): `--url "/#/galaxy/hoth/surface" --until ".mode-menu"` (the surface down and its menu up) and `--url "/#/battlefront/hoth/galacticAssault" --until ".bf-waiting[data-ready]"`; the old path's load is their sum.
After (this branch): `--url "/#/battlefront/hoth?from=/galaxy/hoth" --until "[data-bf-stage=menu]"` (the hit to the menu drawn), then the same with `--then` through Play to `[data-bf-stage=spawn]` (the menu to ready, and Play to the spawn screen), and `--url "/#/galaxy/hoth/surface" --until "[data-bf-stage=menu]" --deny "surface/(scene|module)|/models/galaxy/surface/"` (one world, no surface request).
Before measuring, list the other sessions' probes (`node.exe` command lines) and say in the README what else was running.

- [ ] **Step 3: Decision 9, measured**

From the after run: the longest task and the count of gaps over 100 ms while the menu is up. If the longest task is over 100 ms, take a CPU profile of the load (`--profile out.cpuprofile`, Chrome DevTools Protocol `Profiler`) and name the top three functions by self time in the README. What is the render path's goes to the frame-time lane with the profile. What is the load path's own (the level's stream, the physics shapes queued on the main thread) is split or moved in this phase, as the design's decision 9 says: that work is Task 7, written into this plan from the profile and shown to the owner before it is done, because its files cannot be named until the profile names them.

- [ ] **Step 4: Write the evidence and the handoff**

`README.md`: the commands, the machine and what else ran, the before and after table, the screenshots' names (menu, loading, spawn, field), and what did not meet its target. `HANDOFF-battlefront.md`: where this lane stands and what phases 2, 2b, 3 and 4 are, with the spec's path.

- [ ] **Step 5: The repo's four checks, then the pull request**

Run: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` → all pass.
Commit (`Battlefront: the landing's check and its numbers`), push, open the pull request with the numbers in its body. Tell sessions tilak-19 and tilak-a6 that `.bf-waiting` and `[data-deploy]` are gone and what replaces them.
