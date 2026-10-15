# The existing onboarding, tour and guide system

A map of what is in the repo today (`/home/user/new-portfolio-website`, HEAD d2cb3535, 2026-10-07), written so an architect can extend it into three audience-specific site-wide tours (recruiter, player, mixed) without re-reading the code. Every path is relative to the repo root; `file:line` points at the line that makes the claim.

The design the current code follows is `docs/superpowers/specs/2026-10-07-site-tour-design.md` (38 lines) and its handoff `docs/superpowers/HANDOFF-universe.md` (25 lines). The architecture notes for the tour and the guide are `docs/architecture.md:16-17`. The last commits touching the tour are `a3cf3f77` (the tour), `e7d2d3e9` (each world's basics), `a2489b4b` (the map's first-flight basics), `010c594e` (stops kept with the run they loaded for), `3640245e` (basics module moved beside the tour) and `39f85d34` (Minecraft's basics).

There are three things that share the same cards:

| Thing | Kind | Data | When |
|---|---|---|---|
| The site tour (two of them: `universe`, `classic`) | `kind: 'tour'` | `src/components/tour/steps.js` | Offered once on a first arrival; started by ⌘K, the guide, the terminal |
| A world's basics ("The basics · 1 of 5") | `kind: 'brief'` | `src/components/tour/briefs.js` | First arrival in a world, or the guide's "Show me the basics" |
| A page's own basics it asks for itself (today only the map's first flight, `/universe/fly`) | `kind: 'brief'` | `src/components/tour/briefs.js` | `askBrief(key)` from the page, first time only |

A fourth, unrelated thing is also called a "tour": the universe map's **grand tour**, a guided flight past every place on the map (`src/pages/Universe.jsx:138-147`, `:372-382`, the pill at `:450-453`; `src/components/universe/nav.js:202-207`; the Nav map button `src/components/universe/NavMap.jsx:236`; the `grandtour` achievement `src/components/Achievements.jsx:129`, unlocked at `src/pages/Universe.jsx:297`). It has nothing to do with the cards. Anyone naming new things should avoid the bare word "tour" in the universe code.

---

## 1. Runtime flow from first load to the tour offer

### 1.1 The shell, and what wraps what

`src/App.jsx:380-392` is `App`: `HashRouter` → `ThemeProvider` → `AchievementProvider` → `FunProvider` → `Shell`. `Shell` (`src/App.jsx:294-378`) renders, in order: `OnlineProvider` (316), the backdrop (317), `Ambience` (318), `ScrollToTop` (319), `Nav` (320), `<main id="main">` (321) holding `ErrorBoundary resetKey={pathname}` (323) → `Suspense` (324) → `<div key={page} className="page-enter">` (325) → `WorldGate` (327) → `Routes` (328-361); then `Footer` (367, not on the terminal, the Death Star, the universe, the galaxy or a surface), `ScrollSaber` (368), `Guide` (369), `TourHost` (370), `Lightspeed` (371), `PaletteHost` (372) and `IntroJump` inside its own `ErrorBoundary` (373-375).

Every page is a lazy chunk (`src/App.jsx:25-49`). The page key (`src/App.jsx:283-292`) keeps one mounted element across `/` and `/universe/*` (`'/universe'`), across `/middle-earth/*`, across `/galaxy` and `/galaxy/:system`, and across the six feed pages (`'/feed'`, via `categoryAt`, `src/components/feed/feed.js:19-23`). Any other path change remounts the page subtree.

`TourHost` and `Guide` sit outside `<main>`, so they survive every route change; `Tour` and `GuidePanel` render through `createPortal` to `document.body` (`src/components/tour/Tour.jsx:150`, `:209`; `src/components/GuidePanel.jsx:147`, `:172`).

### 1.2 The gates, in order

1. **The inline intro gate** (`index.html:29-37`). Before React: if `localStorage['tp-intro']` is unset, the hash is `''`, `'#'` or `'#/'`, and the visitor does not prefer reduced motion, it sets `html[data-intro="1"]` (`index.html:35`). The CSS cover `html[data-intro] body::before` (z-index 94, `index.html:42`) blanks the page and removes itself after 4 s even if nothing else runs (`index.html:42-43`). A deep link to any other hash never gets the intro.

2. **IntroJump** (`src/App.jsx:145-223`). Its stage starts as `'welcome'` when `data-intro === '1'` (148). On any stage it writes `tp-intro = '1'` (153) and preloads the crawl, the front page, the universe scene and the cockpit (157-162). While the stage is `welcome`, `crawl` or `cockpit` it sets `html[data-covered]` through `cover()` (137-144, 164-167); clearing it dispatches `tp:uncover` (142). `lib/stale`'s `introPlaying` is told so a stale-build reload during the intro replays it (169; `src/lib/stale.js:58-65` removes `tp-intro` while it plays).
   - **Welcome** (`src/components/cockpit/Welcome.jsx`): a portal dialog with `aria-modal="true"` (`:48`), deletes `data-intro` on mount (`:25`), locks scroll (`:35`), Escape skips (`:27-31`). "Start the intro" → stage `crawl`; "Skip to the site" → stage `null` and focus to the front door's choice (`src/App.jsx:191-197`).
   - **Crawl** (`OpeningCrawl`, `src/App.jsx:200-205`; `.crawl` is z-index 90, `src/styles/extras.css:523`; it deletes `data-intro` at `src/components/experience/OpeningCrawl.jsx:60`). Closing it sets `data-intro = '1'` again to keep the cover up until the cockpit's first frame (`src/App.jsx:181-185`).
   - **Cockpit** (`src/components/cockpit/Cockpit.jsx`): portal dialog `aria-modal="true"` (`:292`), z-index 95/96 (`src/components/cockpit/cockpit.css:7`, `:196`), deletes `data-intro` on its first frame (`:115`). Launch or Skip calls `peak` (`:49-59`): saves the ship under `tp-universe-ship` (`:53`, `SHIP_KEY` from `src/components/universe/crews.js:2963`), notes the arrival sector (`:55`, `src/lib/arrival.js:10`) and dispatches `tp:arrive` (`:56`). `onPeak` in App navigates to `/universe` unless already on the map and uncovers (`src/App.jsx:210-215`); `onDone` clears the stage (`:216-219`). The last cockpit is `tp-cockpit` (`Cockpit.jsx:19`, written at `:181`, `:195`, `:277`). ⌘K's "Back to the cockpit" replays it by `tp:cockpit` (`src/App.jsx:171-180`; `src/components/CommandPalette.jsx:149`).
   - Where WebGL cannot draw the cockpit, `Hyperspace` plays instead with the same callbacks (`Cockpit.jsx:282`).

3. **The front door's choice** (`src/pages/Front.jsx:12-17`). At `/`, if `tp-start` is `'home'` it redirects to `/home` (`:15`); otherwise it renders `Universe` with `ask = atRoot && start !== 'universe'` (`:16`). `Universe` keeps `asking` state (`src/pages/Universe.jsx:126`) and renders `StartChoice` while asking (`:502`). `StartChoice` is a dialog with `aria-modal="true"` (`src/components/universe/StartChoice.jsx:12`), "Explore the universe" / "Go to the home page" (`:22-27`), and "Remember my choice" defaulting to on (`:8`, `:29-31`). `start(where, remember)` (`src/pages/Universe.jsx:268-272`) saves `tp-start` when remembered (`saveStart`, `src/lib/view.js:64-71`, which also dispatches `tp:view`) and either navigates to `/home` or stops asking. Note `.start-choice` is z-index 5 inside the page (`src/components/universe/universe.css:1475-1477`), so the tour's veil (z 88) would sit over it.

4. **A world gate** (`src/components/worlds/WorldGate.jsx`). Around every route (`src/App.jsx:327`). For a world path (`worldAt`, `src/components/worlds/worlds.js:32`) on a device that would feel the download (`worldCheck`), it holds the 3D (`Hold3D`, `:109-114`) and shows an `<aside class="world-gate" role="dialog" aria-modal="false">` (`:85`) or, after "Keep it light", a pill (`:81-83`). Choices: `tp-world:<to>` in sessionStorage (`:20`, `:65`, `:72`) and `tp-worlds = 'load'` in localStorage for "Always load" (`:19`, `:66`). A desktop never sees it (`:17`). z-index 60 (`src/components/worlds/worldgate.css:5`, `:31`).

5. **`busy()`** (`src/components/tour/TourHost.jsx:22-25`). True when any of `covered`, `intro`, `menu`, `touring` is in `document.documentElement.dataset`, or anything matches `[aria-modal="true"], .world-gate`. The things that set those flags: `data-covered` by `cover()` (`src/App.jsx:139-141`), read also by `src/lib/three/useScene.js:44` and `src/runtime/index.js:25` (scenes draw nothing while covered); `data-intro` by `index.html:35`, `src/App.jsx:183`, `src/lib/restart.js:35`; `data-menu = 'open'` by the phone menu (`src/components/Nav.jsx:345`, deleted at `:354`); `data-touring` by the running tour (`src/components/tour/Tour.jsx:78`, deleted at `:84`). `aria-modal="true"` dialogs in the shell: the command palette (`src/components/CommandPalette.jsx:204`), Welcome, Cockpit, StartChoice, the tour card itself (`Tour.jsx:159`), the lightbox, the nav map, the hangar, flight settings, and many worlds' own dialogs (the full list is the 26 files from `grep -rl 'aria-modal="true"' src`). The lightspeed jump (`.hyperspace-canvas`, z 95, `pointer-events: none`, `src/styles/extras.css:570`) sets no flag and is **not** caught by `busy()`.

6. **The offer** (`src/components/tour/TourHost.jsx:100-114`). `here = offerHere(pathname, null) ? kind : null` (`:100`); `offerHere` (`src/lib/tour.js:23`) is true on the map (`isMapPath`, `src/lib/view.js:11`: `/`, `/universe`, `/universe/*`) and the feed's pages (`FEED` regex `src/lib/tour.js:21`: `/home`, `/experience`, `/experience/x`, `/projects`, `/resume`, `/contact`, `/travel`), never a world, a project page, the terminal or `/changes`. The effect resets `offer` to false on every `here` change (`:102`), returns at once if `local.get('tp-tour')` is not null (`:103`), then polls every **1200 ms** (`:112`): `calm` counts consecutive not-busy checks and resets to 0 on busy (`:106`); at `calm >= 2` (so about 2.4 s of nothing covering the page) it clears the interval, writes `tp-tour = 'offered'` (`:109`), preloads the Tour chunk (`:110`, `loadTour` at `:16`) and shows the card (`:111`). The card (`:130-146`): `.tour-offer card` with `role="status"`, "New here?", "Take the tour" → `openTour` (`:137`), "Not now" → `notNow` (`:123-126`: hides it and writes `tp-tour = 'skipped'`). It only renders while `offer && !run` (`:130`). CSS: bottom left on a laptop, above the map's corner buttons on the universe page (`src/components/tour/offer.css:25`), at the top under the nav on a phone (`:26-28`), hidden while the phone menu is open (`:29`), z-index 47 (`:8`).

7. **A world's basics gate** (`src/components/tour/TourHost.jsx:80-93`). Independent of the offer: `briefKey = asked?.page === page ? asked.key : briefKeyFor(pathname)` (`:80`); if `briefHere(key, local.get('tp-briefs', []), navigator.webdriver)` (`:82`; `briefHere` at `src/components/tour/brief.js:49-52` is false when the key is already in the list or the browser is script-driven) it preloads the Tour chunk and polls every **700 ms** (`:91`) for two calm checks, then writes the key into `tp-briefs` (`:89`, `sawBrief` keeps the last 60, `brief.js:55`) and sets `run = { kind: 'brief', name, page }` unless a run is already up (`:90`). The handoff says the offer waits for the first-flight basics; mechanically that is because a running brief sets `data-touring`, which `busy()` sees.

8. **The guide's first-visit note** (`src/components/Guide.jsx:74-103`) is a parallel gate: for pages with `nudge: true` in `GUIDES` that are **not** in `BRIEFED` (`:79`), it polls every 1800 ms (`:95`) for a single not-covered check (its own check at `:89`: `covered`, `intro`, `menu`, any `aria-modal="true"`; it does **not** look at `touring` or `.world-gate`), writes the key into `tp-guide-seen` (`:91`, last 60), shows the note for 9 s (`:94`). Today every nudged page is in `BRIEFED` (`pages.test.js:51-56` lists the nudged ones; `brief.js:15-34`), so the note never shows anywhere in practice.

### 1.3 Starting a tour

`openTour()` (`src/lib/tour.js:12`) dispatches a plain `Event('tp:tour')` with no detail. `TourHost` hears it (`:41-44`): hides the offer and sets `run = { kind: 'tour', name: tourFor(where.current) }`, where `where` is a ref of the current pathname (`:37-38`) and `tourFor` is `'universe'` on map paths else `'classic'` (`src/lib/tour.js:16`). The run's list loads by dynamic import (`:18`, `:59-66`): `steps.js`'s `TOURS[name]` or `briefs.js`'s `BRIEFS[name]`; `loaded` is kept with the run it was loaded for and `list` is only used when `loaded.run === run` (`:67`, commit `010c594e`). The `Tour` component (lazy, `:17`) renders with `key={`${run.kind}:${run.name}`}` (`:149`) under `Suspense fallback={null}` (`:148`).

Ending: `end(how)` (`:116-122`) clears the run; for `kind === 'tour'` only, writes `tp-tour = how` (`'done'` or `'skipped'`) and on `'done'` unlocks the `tour` achievement ("Shown around", `src/components/Achievements.jsx:16`). A brief's end writes nothing (it was recorded when it showed, `:89`).

### 1.4 Inside `Tour` (`src/components/tour/Tour.jsx`)

- Steps are resolved **once**, in the `useState` initialiser (`:54`): `resolveSteps(list, (at) => Boolean(targetOf(at)), kind === 'brief')`.
- Touch is decided once by `(pointer: coarse)` (`:46`, `:55`).
- `useLayoutEffect` on mount (`:75-89`): sets `html[data-touring]`, makes `#main`, `.site-nav`, `.guide-btn` and every `footer` inert (`inertBehind`, `:38-43`), focuses Next on the next frame (`:80`). On unmount it restores all of it and returns focus to the element that had it, or `#main` (`:85-87`).
- Keys (`:94-116`): one capturing `keydown` listener on `window` that calls `e.stopImmediatePropagation()` on **every** key (`:96`), so nothing underneath sees any key while the tour runs (not the guide's `?`, not ⌘K, not the universe's flight keys). Tab cycles the card's buttons (`:97-102`), Escape skips (`:103-105`), → or Enter (not on a button) goes forward (`:106-108`), ← goes back (`:109-111`).
- Placement (`:122-146`): on each step change, find the target; if it is off screen, `scrollIntoView({ block: 'center' })` (`:124`, smooth unless reduced motion); then a `requestAnimationFrame` loop measures every frame: re-finds the target if it disconnected (`:128`), computes `litBox` (`:131`) and `placeCard` (`:134`), and sets state only when the JSON changes (`:136-140`).
- Render (`:150-210`): `.tour[data-kind][data-lit]` → `.tour-veil` (`:153`), `.tour-spot` when lit (`:154`), `.tour-card card` with `role="dialog" aria-modal="true"`, `aria-labelledby`/`aria-describedby` (`:155-164`), hidden until placed (`:163`); the count line "Tour · 2 of 10" / "The basics · 1 of 5" (`:165-167`, words at `:48-51`); title (`:168-170`); text (`:171-173`); a `KeyTable` for a brief stop's rows (`:174`); dots (`:175-179`); buttons: Skip (not on the last stop, `:181-185`), Back (not on the first, `:186-190`), Next / Done ("Done" for a tour, "Let's go" for a brief, `:191-201`); an `aria-live="polite"` sentence per stop from the second on (`:204-206`).

### 1.5 Restart

`restartSite()` (`src/lib/restart.js:27-38`) removes `VISIT_KEYS` (`:8-15`: `tp-intro`, `tp-start`, `tp-cockpit`, `tp-universe-ship`, `tp-tour`, `tp-briefs`), sets `data-intro = '1'`, rewrites the hash to `#/` and reloads, so the whole flow above plays again. Entry points: ⌘K "Restart the site from the beginning" (`src/components/CommandPalette.jsx:93`), the phone menu's Start over (`src/components/Nav.jsx:15` imports it), the terminal's `restart`/`reboot` (`src/pages/Terminal.jsx:522-529`). `tp-guide-seen` and `tp-visited` are **not** forgotten by a restart.

---

## 2. Every localStorage key the shell uses

"The shell" here means everything outside a world's own folder. `local` (`src/lib/hooks.js:166-182`) and `storage` (`:147-163`) are the JSON helpers over `localStorage` and `sessionStorage`; both swallow errors. Values are JSON, so a string is stored quoted (`"universe"`), which the check scripts mirror (`scripts/autopilot-check.mjs:165-167`, `scripts/abq-qa.mjs:76-80`, `scripts/assault-check.mjs:36-40`).

| Key | Store | Holds | Written at | Read at |
|---|---|---|---|---|
| `tp-tour` | local | `'offered'`, `'done'` or `'skipped'`; unset until the offer shows | `TourHost.jsx:109`, `:120`, `:125` | `TourHost.jsx:103`; forgotten by `restart.js:13` |
| `tp-briefs` | local | array of guide keys whose basics have shown, last 60 | `TourHost.jsx:89` | `TourHost.jsx:82`; `restart.js:14` |
| `tp-guide-seen` | local | array of guide keys whose first-visit note has shown, last 60 | `Guide.jsx:91` | `Guide.jsx:83` |
| `tp-intro` | local (raw `'1'`, not JSON) | the intro has played | `index.html` reads; `App.jsx:153` writes; `stale.js:65` removes during the intro | `index.html:35`; `restart.js:9` |
| `tp-start` | local | `'universe'` or `'home'`: the front door's pick | `view.js:64-71` (`saveStart`) | `view.js:55-62` (`readStart`); `Front.jsx:14`; `ViewSwitch.jsx:12-26` (`useView`, also listens to `storage` events); `restart.js:10` |
| `tp-cockpit` | local | the last vehicle id sat in | `Cockpit.jsx:181`, `:195`, `:277` | `Cockpit.jsx:33`; `restart.js:11` |
| `tp-universe-ship` | local | the ship flown on the map (`parseShip`) | `Cockpit.jsx:53` | `crews.js:2963`; `useOnline.js:28`; `restart.js:12` |
| `tp-achievements` | local (falls back to session) | array of unlocked achievement ids | `Achievements.jsx:298` | `Achievements.jsx:280` |
| `tp-visited` | **session** | array of top-level paths visited this visit, for Explorer | `Achievements.jsx:310` | `Achievements.jsx:307` |
| `tp-mode` | local | `'dark'`/`'light'` | `ThemeProvider.jsx:142`, `:163` (also `html[data-mode]`) | `index.html:31`; `ThemeProvider.jsx:59`, `:91` |
| `tp-theme-pin` | local | the pinned colour scheme id | `ThemeProvider.jsx:57` | same |
| `tp-themes-seen` | local | company themes seen, for Cartographer | `ThemeProvider.jsx:58` | `Achievements.jsx:318-320` via `useTheme().seen` |
| `tp-custom-color` | local | the visitor's own colour | `custom.js:6` | same |
| `tp-script` / `tp-aurebesh` / `tp-scripts-read` | local | the script the site reads in (`'theme'` or a script id); the old boolean; the scripts read, for Polyglot | `FunProvider.jsx:58-60`, `:71`, `:78-81` | same |
| `tp-eggs` | local | easter eggs found | `eggs.js:15` | same |
| `tp-sound` | local | sound on/off | `audio.js:6` | same |
| `tp-ambience` | local | the live background setting | `ambience/setting.js:5` (event `tp:ambience`) | same |
| `tp-3d` | local | 3D on/off (`tp:3d` event) | `gpu.js:15-16` | same |
| `tp-quality`, `tp-detail-cap` | local | the pinned quality tier and the detail cap | `device.js:39-40` | same |
| `tp-gpu` | local | the renderer backend | `runtime/backend.js:8`, `runtime/index.js:23` | same |
| `tp-worlds` | local | `'load'`: never ask before a world's 3D | `WorldGate.jsx:19`, `:66` | `:44`, `:53` |
| `tp-world:<to>` | **session** | `'load'` or `'light'` for one world this visit | `WorldGate.jsx:20`, `:65`, `:72` | `:44`, `:53` |
| `tp-stale-reload` | **session** | when the site last reloaded for a stale build | `stale.js:15` | same |
| `tp-arrive-sector` | local | the sector the cockpit's launch arrives in, 20 s fresh | `arrival.js:10-11` | same |
| `tp-universe-panel` | local | `'tucked'` once the map's panel was put away | `Universe.jsx:36` | same |
| `tp-universe-controls`, `tp-universe-drive`, `tp-universe-loadout`, `tp-universe-garage`, `tp-universe-hull`, `tp-universe-online`, `tp-universe-callsign`, `tp-universe-pointers` | local | the map's flight settings, drive, ship outfit, hangar, online state | `controls.js:12`, `nav.js:29`, `outfit.js:23`, `shipyard/build.js:14-15`, `useOnline.js:26-29` | same |
| `tp-near` | local, DEV only | `'off'` disables near maps | `nearMaps.js:50` | same |
| `tp-debug` | local | the debug panel | `debugPanel.js:56` | same |

Everything else matching `tp-` (about 140 more keys) belongs to one world: best scores, "done" lists (`tp-office-done`, `tp-shire-done`, `tp-c137-done`, every Middle-earth town's `-done`/`-at`/`-side`), found cartridges (`tp-dmg-found`, `src/components/dotmatrix/found.js:8`, with a `tp:dmg-found` event), Earth's stamps (`tp-earth-stamps`, `src/components/earth/stamps.js:9`, event `tp:earth-stamps`), the galaxy's quests and landings (`tp-galaxy-quests`, `tp-galaxy-found`, `tp-galaxy-landed`, `tp-galaxy-missions`), and so on. They matter to a progress model (section 11) as the places a "done" signal already exists.

Window events the shell uses, for completeness (`grep -rho "'tp:[a-z0-9-]*'" src`): `tp:tour` (`tour.js:9`), `tp:brief` (`brief.js:11`), `tp:guide` (`palette.js:5`), `tp:palette` (`palette.js:2`), `tp:view` (`view.js:53`), `tp:cockpit`, `tp:hyperspace`, `tp:uncover`, `tp:arrive`, `tp:board`, `tp:3d`, `tp:ambience`, and the worlds' own.

---

## 3. The data model

### 3.1 A stop

From `src/components/tour/steps.js:1-6` and `briefs.js:7-10`:

```
{ id, title, text, at?, keys?, touch? }
```

- `id`: unique within its list (tested, `steps.test.js:35`, `briefs.test.js:45`); used as the React key of the dots (`Tour.jsx:177`).
- `title`: a string (tested truthy).
- `text`: a string, or a function of `ctx = { key }` where `key` is `shortcutLabel()` (`'⌘K'` on Apple, `'Ctrl K'` elsewhere; `src/lib/palette.js:7-8`). `textOf(step, ctx)` resolves it (`steps.js:115`; used `Tour.jsx:148`). Briefs' texts are plain strings (the brief test reads `s.text.length`, `briefs.test.js:48`).
- `at`: the `data-tour` name to light; absent → a card in the middle.
- `keys` / `touch` (briefs only): rows `[keysString, whatItDoes]` written as `guide/keys.js` parses them (`keyTokens`, `src/components/guide/keys.js:9-20`: space-separated keys, the words `or and then hold tap double to while in on the` stay words, `/` reads "or", `Drag Click Tap Scroll Swipe Right-click Pinch Stick` are pointer keys). `rowsFor(step, touch)` picks `touch` rows on a coarse pointer else `keys`, null when the device has none (`briefs.js:727`).

### 3.2 A tour

`TOURS` (`steps.js:44-113`) is `{ universe: Stop[], classic: Stop[] }`. Shared stop objects are module constants reused in both lists (`search` 8-13, `menu` 14-19, `colours` 20-25, `guide` 26-31, `resume` 32-37, `done(where)` 38-42).

- `universe` (45-81): `hello` (no target), `panel`, `ships`, `navmap`, `view`, `search`, `menu`, `colours`, `guide`, `resume`, `done` → 11 stops.
- `classic` (82-112): `hello`, `pages`, `view`, `search`, `menu`, `colours`, `terminal`, `guide`, `resume`, `done` → 10 stops.

(The handoff's "ten and nine" counts predate nothing; it counts stops that survive on a laptop, where `menu` drops out.)

### 3.3 A brief

`BRIEFS` (`briefs.js:30-725`) is keyed by **guide key** (section 6), one list per key, 19 keys: `/universe/fly` (32), `/galaxy` (82), `/galaxy/surface` (130), `/deathstar` (180), `/caribbean` (214), `/invincible` (252), `/middle-earth` (293), `/middle-earth/place` (313), `/avengers` (343), `/scranton` (390), `/cybertron` (416), `/albuquerque` (452), `/c-137` (484), `/c-137/citadel` (515), `/dot-matrix` (540), `/dot-matrix/64` (573), `/dot-matrix/minecraft` (614), `/earth` (660), `/music` (694). Each ends with `help(where)` (`briefs.js:12-17`), the only brief stop with an `at` (`'guide'`). Shared row constants `WALK` and `WALK_TOUCH` (`:20-28`).

The brief's run record in `TourHost` is `{ kind: 'brief', name: guideKey, page: guideKeyFor(pathname) }` (`TourHost.jsx:30-32`, `:49`, `:90`); `page` is what the route-change effect compares (`:74`).

`brief.js` holds the small side that the shell needs from the first page: `BRIEF_KEY` (`:10`), `BRIEF_EVENT` (`:11`), `BRIEFED` (`:15-34`, 18 keys), `ASKED` (`:38`, `['/universe/fly']`), `briefKeyFor` (`:41-44`: the guide key if it is in `BRIEFED`), `briefHere` (`:49-52`), `sawBrief` (`:55`), `openBrief(key = null)` (`:59`: `CustomEvent('tp:brief', { detail: { key } })`), `askBrief(key)` (`:63`: `detail: { key, first: true }`). `TourHost.onBrief` (`:45-50`) resolves the key from the detail or the current path, and either stores an `asked` `{ key, page }` (first-time path, which then goes through the calm gate) or starts a run at once.

### 3.4 `resolveSteps`, `targetOf`, `placeCard`, `litBox`

- `resolveSteps(steps, has, keep = false)` (`src/lib/tour.js:30-31`): with `keep` false (tours) it **filters out** any stop whose `at` is not present; with `keep` true (briefs) it keeps every stop and blanks `at` for the missing ones so they become centre cards. Tests: `tour.test.js:28-44`.
- `targetOf(name)` (`Tour.jsx:24-30`): `document.querySelectorAll('[data-tour~="name"]')` (so a space-separated list on one element works) and returns the **first** element with a rect ≥ 1×1 px and `visibility !== 'hidden'`. This is how the guide's `?` resolves to the corner button on most pages and the universe panel's own `GuideLink` on the map (the corner button is `display: none` there, `src/components/universe/universe.css:178`, so its rect is 0×0).
- `litBox(rect, view, pad)` (`tour.js:37-43`): the target's rect padded by `PAD = 6` (`Tour.jsx:20`), clamped 2 px inside the window, whole pixels, `null` when nothing is on screen.
- `placeCard(target, card, view, { gap = 14, margin = 16 })` (`tour.js:51-69`): below, above, right, left, whichever fits with `card + gap + margin` of room; else the taller of top/bottom; always clamped on screen; `{ side: 'center', … }` with no target. Tests `tour.test.js:46-88`.

---

## 4. Every `data-tour` target in the codebase

`grep -rn 'data-tour' src --include=*.jsx`:

| Name | Element | File:line | Shows when |
|---|---|---|---|
| `view` | the Universe/Classic switch `div.view-switch[role=group]` | `src/components/ViewSwitch.jsx:60` | always in the nav bar (`Nav.jsx:388`); a second copy exists only while the phone menu is open (`Nav.jsx:453-457`, a portal), and the menu closes on every route change (`:291`), so in practice the bar's copy is the one found |
| `pages` | the nav's links `div.hidden.md:flex` | `src/components/Nav.jsx:392` | `md` and up, and only while `!collapsed` (`:391`, `:258`) |
| `terminal` | the Terminal `NavLink` | `src/components/Nav.jsx:404` | `lg` and up, and only while `!gone('terminal')` (`:403`) |
| `search` | the search button `button.nav-search` | `src/components/Nav.jsx:415` | `md` and up |
| `colours` | the wrapper round `ThemePicker` | `src/components/Nav.jsx:419` | `lg` and up |
| `resume` | the Résumé `Link.btn-primary` | `src/components/Nav.jsx:435` | `sm` and up |
| `menu` | the menu button | `src/components/Nav.jsx:441` | `lg:hidden` unless `menu` is true (`:442`, `:263`: something was dropped from the bar) |
| `guide` | the corner `button.guide-btn` | `src/components/Guide.jsx:142` | every page; `display: none` wherever a `.universe-panel` is on the page (`src/components/universe/universe.css:178`: the map and the galaxy), where the panel carries its own |
| `guide` | the panel's `GuideLink` button | `src/components/guide/GuideLink.jsx:8`, used `src/components/universe/UniversePanel.jsx:96` (open panel) and `:149` (tucked panel), `src/components/galaxy/GalaxyPanel.jsx:173`, `:184` | on the map and in the galaxy |
| `panel` | `aside.universe-panel` | `src/components/universe/UniversePanel.jsx:140` (tucked), `:157` (a wonder), `:189` (the whole map), `:286` (a place) | the map; one of the four is rendered |
| `ships` | `div.universe-ships[role=group]` | `src/components/universe/UniversePanel.jsx:27` | inside the panel on the whole-map view |
| `navmap` | the "Nav map" button | `src/components/universe/UniversePanel.jsx:164`, `:194`, `:293` | the map, when `onNav` is passed |

Nothing in a world, the feed's pages, the terminal, the guide panel, the command palette or the footer carries a target. The universe panel's "All the controls and tips" button (`UniversePanel.jsx:245`) opens the guide but is not a target.

The two tests that keep steps honest both walk `src/components/**/*.jsx` with the regex `/data-tour="([^"]+)"/` and split on spaces (`steps.test.js:7-18`, `briefs.test.js:10-21`); a target written as a computed attribute (`data-tour={name}`), in a `.js` file, or outside `src/components` would not be seen.

---

## 5. Every entry point that starts a tour or a brief

| Entry | What it does | File:line |
|---|---|---|
| The first-arrival offer, "Take the tour" | `openTour` | `src/components/tour/TourHost.jsx:137` |
| ⌘K → "Take the tour of the site" (hint "Under a minute"; keywords `tour help onboarding walkthrough new here first time show around how to get about start`) | `openTour` | `src/components/CommandPalette.jsx:92` |
| ⌘K → "Guide: the controls and tips for this page" | `openGuide` | `src/components/CommandPalette.jsx:91` |
| The guide's "The site" tab → "Take the tour" | closes the panel (`onLeave`) then `openTour` | `src/components/GuidePanel.jsx:86-95` |
| The guide's "On this page" tab → "Show me the basics" (only where `briefKeyFor(pathname)` is non-null) | `onLeave()` then `openBrief()` | `src/components/GuidePanel.jsx:42-46`, `:159-166` |
| The terminal's `tour` command | `setTimeout(openTour, 500)` and prints "Showing you round…" | `src/pages/Terminal.jsx:518-521`; listed in help at `:92` |
| The universe map, the first time a ship is under you with the 3D on | `askBrief('/universe/fly')` | `src/components/universe/UniverseMap.jsx:129-131` |
| A world's first arrival | `TourHost` itself, by path | `src/components/tour/TourHost.jsx:80-93` |

Ways to the guide, which a tour's last card points at: the `?` key (`Guide.jsx:53-55`, ignored while typing or touring, `:52`), the corner button (`:138-155`), `tp:guide` (`:64-66`; dispatched by `openGuide`, `src/lib/palette.js:5`), the universe panel's "All the controls and tips" (`UniversePanel.jsx:245`), the galaxy surface's `H` key and help button (`src/pages/GalaxySurface.jsx:407`, `:592`).

Nothing starts a tour from the URL, from the nav, from the footer, from a world, or from an achievement.

---

## 6. How the guide keys pages and what it knows per page

Two modules, by weight:

- `src/components/guide/routes.js` loads with the shell. `GUIDES` (`:9-38`) maps 28 guide keys to `{ title, nudge? }`. `RULES` (`:42-50`) fold deeper paths onto a key: `/`, `/universe`, `/universe/*` → `/universe`; `/experience/x` → `/experience`; `/projects/x` → `/project`; `/galaxy/x/surface` → `/galaxy/surface`; `/galaxy/x/mission` → `/galaxy/mission`; `/galaxy/x` → `/galaxy`; `/middle-earth/x` → `/middle-earth/place`. `guideKeyFor(pathname)` (`:52`) returns the exact key if present, else the first rule's key, else `null`. `guideMeta` (`:55-58`) adds `nudge: false` by default. Unknown paths (`/changes`, `/dickansh`, `/nowhere`, `/galaxy/x/surface/deeper`) have no guide.
- `src/components/guide/pages.js` loads with the panel. `PAGES` (`:37-531`) has the same 28 keys (tested equal, `pages.test.js:40`), each `{ about?, tips?: [[heading, text]], keys?: [{ label?, rows: [[keys, does]] }], touch?: same }`. Shared rows: `FLY` (`:12-23`), `WALK` (`:25-31`, whose `M` row is "The list of things to do"), `WALK_TOUCH` (`:32-35`), `FEED_TIP` (`:10`). `SHORTCUTS` (`:533-537`: `?`, `Esc`, the Konami code) and `SITE` (`:539-547`: "Two ways round", "Getting around", "Colors", "Languages", "Easter eggs", "Achievements") are the site tab. `guideFor(pathname)` (`:549-552`) merges `{ key, ...GUIDES[key], ...PAGES[key] }`.

The panel (`src/components/GuidePanel.jsx`): tabs "On this page" and "The site" (`:126`, `:150-153`), starting on the page tab when the page has a guide (`:118`); the page tab shows the title, `about`, the "Show me the basics" button where a brief exists, the controls as `KeyTable`s with a Keyboard/Touch switch when both exist (`:51-60`, initial choice by `(pointer: coarse)` or whichever exists, `:36`), then tips; the site tab shows "Take the tour", the shortcuts with ⌘K/Ctrl+K first (`:97`), the `SITE` tips and a link per world from `WORLDS` (`:102-111`). The panel is `aria-modal="false"` (`:148`), z-index 80 (`src/styles/extras.css:968`), closes on route change (`Guide.jsx:72`) and on Escape (`:56-61`).

`GuideCue` (`src/components/guide/GuideCue.jsx:3`) is the "· ? all the controls" tail that each world's own first hint ends with (`docs/architecture.md:16`).

Tests (`pages.test.js`): keys agree between the two modules (`:40`), titles agree (`:43-49`), every world in `WORLDS` has a guide (`:33-35`), nudged pages have controls (`:52`), rows parse to at least one key (`:69-79`), no duplicate keys in a group (`:81-87`), the universe's flying keys say what they really do (`:89-95`).

---

## 7. How achievements are unlocked and listed

`src/components/Achievements.jsx`:

- `ACHIEVEMENTS` (`:11-253`) is `{ id: { name, desc } }`, about 240 entries. The shell-level ones: `explorer` Explorer (12), `hacker` Slicer (13), `order66` Contingency (14), `konami` Cheat code (15), `tour` Shown around (16), `deathstar` Fully operational (17), `trench`, `rebels`, `empire` (18-20), `resume` Recruited (21), `cartographer` Cartographer (22), `player` High score (23), `castle` Super Tilak (24), `tetris` Four at once (25), `aurebesh` Linguist (26), `polyglot` Polyglot (27), `heisenberg` (28), `bluesky`, `purity` (29-30), `snap` (31), `dundie` (32), `raga`, `jugalbandi` (33-34), `rollout` (35), `savvy` (36), `collector` Collector "Found every hidden easter egg" (103), `palette` Power user "Opened the command palette" (243), `grandtour` Seen it all (129), `wanted` (130), `rifted` (128), `globetrotter` (207), `passport`, `roundtheworld` (211-212). The rest are one world's: Cybertron `cy*` (37-55), Rick and Morty (56-102, the Citadel 120-126), Middle-earth (104-181), Avengers (182-195), Invincible (196-206), Dot Matrix (208-210), the galaxy (213-242), Scranton (245-252).
- Storage: `tp-achievements` (`:273`), read with a session fallback and filtered to known ids (`:279-282`).
- `unlock(id)` (`:292-303`): no-op for unknown or already-unlocked ids; appends, saves, and queues a toast ("Achievement unlocked", or a theme toast when a `FAN_THEMES` entry names this achievement, with "New in your ship's hangar" lines from `paintsFor`/`partsUnlockedBy`, `:264-272`).
- `notify(title, desc, kind, gif, hangar)` (`:288-290`) queues a plain note toast (used by `useView().switchTo`, `src/components/ViewSwitch.jsx:35-43`, and the palette's "Copied").
- Route-driven unlocks (`:305-316`): every path visited is appended to session `tp-visited` (top-level, `:306-310`); when all of `PAGES = ['/', '/experience', '/projects', '/travel', '/contact', '/terminal']` (`:255`) are in it, `explorer`; `/terminal` → `hacker`; `/deathstar` → `deathstar`; `/resume` → `resume`. Seeing all six company themes → `cartographer` (`:318-320`). `palette` on opening ⌘K (`CommandPalette.jsx:74`). `konami` in `Lightspeed` (`App.jsx:104`). `tour` on finishing a tour (`TourHost.jsx:121`).
- The toast host (`:337-359`) is fixed bottom-centre, z-index 60, `aria-live="polite"`, one toast at a time for 3.8 s (7 s with a GIF, `:325`).
- `useAchievements()` (`:365`) returns `{ unlock, notify, unlocked }`; `unlocked` is the array of ids (also the source of the palette's unlocked fan themes, `CommandPalette.jsx:156`).
- Listing to the visitor: the Dundies in Scranton (`SITE` tip, `pages.js:545`: "the Dundies in Scranton show you where you stand"; `.dundies` grid `src/styles/extras.css:520`). There is no shell-level achievements page; `/changes` is the ship's log, not a progress page.

---

## 8. Behaviour across route changes, and what a multi-page tour would hit

### 8.1 What `TourHost` does on a route change (`src/components/tour/TourHost.jsx`)

- `kind = tourFor(pathname)` and `page = guideKeyFor(pathname)` recompute every render (`:72-73`).
- One effect (`:74`): `setRun((r) => (r && (r.kind === 'tour' ? r.name !== kind : r.page !== page) ? null : r))`. A **tour** ends only when the view kind flips (map ↔ not map). A **brief** ends when the guide key changes. So a classic tour survives `/home` → `/projects` → `/terminal` → `/c-137` (all `'classic'`), and a universe tour survives `/` → `/universe/marvel` (map stays map), but a universe tour dies the moment the path leaves the map, and a classic tour dies the moment it enters it.
- The `Tour` element's key is `kind:name` (`:149`), so within one kind it is **not** remounted on a route change: its resolved `steps` (`Tour.jsx:54`), its index `i` and its listeners persist.
- The offer effect (`:101-114`) re-runs whenever `here` changes (map ↔ feed ↔ elsewhere), always hiding the offer first (`:102`). The brief effect re-runs whenever `briefKey` changes (`:81`), which a tour that navigates into an unseen world would trigger: `busy()` is true while `data-touring` is set, so `calm` never reaches 2 until the tour ends, and then the brief fires (`:90`, unless a run is still up). The `asked` state is only cleared by the next `onBrief` (`:48`); it is not cleared on route change, but it is ignored unless `asked.page === page` (`:80`).
- `Guide` closes its panel on every pathname change (`Guide.jsx:72`); `Nav` closes the phone menu (`Nav.jsx:291`) and un-hides itself on every non-feed move (`Nav.jsx:330-332`); `ScrollToTop` scrolls to 0 on a new pathname unless it is a feed move, a `?role=` link or a `/experience/x` / `/universe/x` path (`App.jsx:64-75`), and stops the page's music (`:77-79`).

### 8.2 Does anything support a multi-page tour today?

No. Concretely:

- There is no `navigate` in `Tour.jsx` or `TourHost.jsx`; stops have no `to`/`path` field; `openTour` carries no detail (`tour.js:12`) and `onStart` reads none (`TourHost.jsx:41-44`); the list is chosen by the current path only (`:43`).
- Steps are resolved **once at mount** against the DOM (`Tour.jsx:54`). A stop whose target lives on another page is filtered out before the tour starts (tours) or blanked to a centre card (briefs). The per-frame re-query (`Tour.jsx:128`) only helps a stop that survived resolution and whose element later re-mounts.
- While it runs, the page is inert (`Tour.jsx:38-43`) and every key is swallowed (`:96`), so the visitor cannot navigate; only code could.

### 8.3 What would break, in order of certainty

1. **The kind flip.** Navigating between the map and anything else nulls the run (`TourHost.jsx:74`). A mixed tour (universe + classic) is impossible without changing that rule or making `name` independent of `kind`.
2. **Lazy chunks and Suspense.** Every page is `lazy` (`App.jsx:25-49`); the route-level `Suspense` fallback is an empty full-height div (`App.jsx:324`), and the feed's pages load on their own (`Feed.jsx:27-35`). After a programmatic navigate, the target is absent for the chunk's download and the page's first render; `targetOf` returns null; with a stop whose `at` is set but unresolved, `box` is null, so the veil darkens the whole page (`tour.css:6`) and the card sits in the middle until the frame loop finds the element. A tour needs an explicit "wait for target (with a timeout)" state per stop.
3. **The page key remount and `page-enter`.** A path outside the shared keys remounts the page subtree (`App.jsx:325`), replays the enter animation and, for 3D pages, rebuilds a scene (the universe builds planets and ships; the galaxy, Middle-earth and the worlds build their own). `html[data-covered]` is not set by this, so nothing tells the tour the scene is still warming up; `useScene`'s `READY_WAIT` (`src/lib/three/useScene.js:36`) can hold a first frame up to 4 s.
4. **The intro.** A tour cannot start under it because `busy()` sees `intro`/`covered`; but a tour that navigates to `/` on a browser whose `tp-intro` is unset would not trigger the intro (the gate is inline, before React, `index.html:35`), so this is only a first-load concern. The intro's covers (z 90-96) sit above the tour (z 88, `tour.css:4`), by design (`tour.css:1-3`).
5. **The front door's choice.** Navigating to `/` with `tp-start` unset renders `StartChoice` (`Front.jsx:16`); it is `aria-modal="true"` but inside `#main`, so it is inert and under the veil while the tour runs, then pops up when the tour ends. If `tp-start === 'home'`, `/` redirects to `/home` (`Front.jsx:15`) and the kind flips back, killing a universe tour. A tour should navigate to `/universe` (never `/`) and treat `/universe` as the map.
6. **World gates.** A world path on a phone or weak device renders `.world-gate` (`WorldGate.jsx:85`, z 60) under the veil, and holds the 3D (`Hold3D`), so the page shows its 2D version; any target inside the 3D does not exist. A tour entering a world needs to either skip gated worlds, answer the gate (`storage.set('tp-world:<to>', 'load')` is what "Load" does, `:65`), or point only at 2D elements.
7. **Worlds' own intros and first hints.** Beyond the gate, worlds have their own first screens: the galaxy's "long time ago" (`tp-galaxy-intro`, session, `src/pages/Galaxy.jsx:35`), Middle-earth's opening (`tp-me-opening`, `src/components/middleearth/opening.js:7`), each world's first hint ending in `GuideCue`, and the world's own `aria-modal` dialogs (26 files). None of these look at `data-touring`; a tour arriving in a world would be stacked over them (z 88) or, for those with capture key handlers, fight for keys.
8. **The world's basics firing after the tour.** As in 8.1: entering an unseen `BRIEFED` world during a tour queues its brief for the moment the tour ends; `tp-briefs` is written then (`TourHost.jsx:89`). An audience tour that visits worlds should decide whether to mark briefs seen, suppress them, or fold them in.
9. **The feed's scroll-driven address.** On the feed, scrolling moves the address with `navigate(..., { replace: true, state: feedState })` (`Feed.jsx:77`); `isFeedMove` (`feed.js:48`) lets the shell ignore it. `TourHost` ignores it too (kind stays `classic`). But: (a) the feed mounts the next page only when a sentinel a viewport above the bottom comes into view (`Feed.jsx:16-19`), so a target on a later feed page does not exist until the visitor is near it; (b) `Tour.jsx:124` calls `scrollIntoView` on an off-screen target, which moves the feed's "middle" and replaces the address; (c) navigating to another feed category by code "starts the feed over there, at the top" (`Feed.jsx:23-25`), remounting pages; (d) only the page on the address is "active" (`src/lib/page.js:9-11`) and sets the title (`src/lib/hooks.js:91-96`), so a tour's stop on a non-active feed page is pointing at a page that believes it is off screen.
10. **Focus and inertness across navigation.** `inertBehind()` captures the elements present at mount (`Tour.jsx:40`); after a remount of `#main`'s children the new `#main` is the same element (it is in `Shell`, not the page), so `inert` on `#main` still holds, but a new `footer` or a page's own fixed buttons portaled to `body` (the world gate's pill, a world's HUD) are not inert. The return-focus target captured at mount (`Tour.jsx:77`) may be disconnected by the end; the code already falls back to `#main` (`:86`).
11. **The nav's fit.** The nav drops items to fit the bar (`Nav.jsx:251-275`, `navFit.js`), so `terminal`, `colours`, `pages` exist or not per width and per theme name length; `resolveSteps` handles presence at start, but a route change can refit (`:275`: `[active, pinned, script, view]`), changing which targets exist mid-tour. The frame loop copes with a target that vanishes (card goes to the middle, veil darkens) but never re-adds a filtered stop.
12. **Keys and the palette.** Because `Tour` stops every keydown at capture (`Tour.jsx:96`), a tour that wants the visitor to *try* ⌘K or `?` at a stop must release those keys deliberately.
13. **`busy()` blind spots.** The lightspeed jump (`.hyperspace-canvas`) and world-local overlays without `aria-modal` are invisible to `busy()`; the offer can appear over them.

### 8.4 Where a cross-route tour could plug in without fighting the above

- `TourHost` is inside `HashRouter` (`App.jsx:382`, `:370`), so it can call `useNavigate`. The run record is the natural place for "which stop, which path" state; `Tour` is the natural place for "wait until the target exists, then light it".
- `Tour`'s key (`TourHost.jsx:149`) decides remount; keeping the key stable across the tour's pages keeps `i`.
- `busy()` is already the shared "is the page clear" predicate; a "stop may proceed" predicate could add "target present and not `aria-busy`".
- `html[data-touring]` is the hook other components already respect (`Guide.jsx:52`, `tour.css:46-47`); `Nav`, `Feed`, the worlds' first hints and the brief gate could respect it too.

---

## 9. Test conventions

- Runner: `vitest run` (`package.json:10`), Node environment, no jsdom or testing-library (`package.json` lists only `playwright-core` at `:72` for the check scripts; no `vitest-environment` pragma anywhere in `src`). Everything in a test must run without a DOM. `vite.config.js:19` excludes `.claude`, `.agents`, `lab`, health fixtures, `scripts/ai-e2e`, `*.fuzz.test.js` and `*.scenario.test.js` (the AI suite has its own configs, `package.json:11-13`).
- Placement: `x.js` has `x.test.js` beside it (`docs/health/RULES.md:34-36`); 439 test files in `src`; a test runs under a second and touches no network; fixtures go in a `fixtures/` folder beside the test. "Anything that can be tested without a canvas is tested" (`RULES.md:32`). Never skip or quieten a test to get green (`RULES.md:48`).
- The tour's tests:
  - `src/lib/tour.test.js` (pure): which tour a path gets (`:4-12`), the offer's rules (`:14-26`), `resolveSteps` (`:28-44`), `placeCard` (`:46-88`), `litBox` (`:90-104`).
  - `src/components/tour/steps.test.js`: `TOURS` keys are exactly `['classic', 'universe']` (`:23-25`); first and last stops have no `at` (`:27-32`); ids unique, title truthy, text > 20 chars with `ctx = { key: '⌘K' }` (`:34-42`); **every `at` is marked somewhere**: `marked()` (`:7-18`) walks `src/components` recursively, reads every `.jsx`, matches `/data-tour="([^"]+)"/g` and splits on spaces (`:44-47`); the search stop's text contains the given key label (`:49-52`); the last stop's text matches `/guide/` (`:54-56`).
  - `src/components/tour/brief.test.js`: every world in `WORLDS` has a brief key (`:7-9`); deeper paths share one (`:11-17`); the site's pages, the map and a mission briefing have none (`:19-21`); `ASKED` keys never resolve by path (`:23-25`); `BRIEFED` keys resolve to themselves (`:27-29`); `briefHere` once per world and never for `webdriver` (`:32-45`); `sawBrief` keeps 60 (`:47-52`).
  - `src/components/tour/briefs.test.js`: `BRIEFS` keys equal `[...BRIEFED, ...ASKED]` (`:24-26`); every nudged guide page has a brief (`:28-30`); first stop has no `at`/`keys`/`touch`, last stop's `at === 'guide'` and text contains `?` (`:32-39`); 3 to 6 stops, unique ids, text > 20 (`:41-51`); at least one stop with `keys` and one with `touch` (`:53-58`); each row has ≤ 5 entries, 2 cells, parses to a key, a description > 1 char (`:60-71`); every `at` is marked (`:73-76`); `rowsFor` picks per device (`:78-84`).
  - `src/components/guide/pages.test.js` and `keys.test.js` as in section 6; `src/lib/restart.test.js:15-18` checks `VISIT_KEYS` includes `tp-tour`.
- The handoff's command: `npx vitest run src/lib/tour.test.js src/components/tour/brief.test.js src/components/tour` (`docs/superpowers/HANDOFF-universe.md:25`).
- Browser checks are Playwright scripts, not tests: `scripts/autopilot-check.mjs:164-167` seeds `tp-intro`, `tp-start` and `tp-quality` so the intro and the choice are skipped; the offer would still show on those routes after 2.4 s unless the script also seeds `tp-tour`; briefs are suppressed by `navigator.webdriver` (`brief.js:49-50`).

---

## 10. CSS conventions of the tour card

Files: `src/components/tour/tour.css` (imported by `Tour.jsx:10`, so it loads with the tour chunk) and `src/components/tour/offer.css` (imported by `TourHost.jsx:9`, in the shell). Both are plain CSS, one rule per line, comments in prose, no Tailwind in the files (the JSX uses a few Tailwind utilities for icon sizes, `Tour.jsx:188`, `:194`, `:198`).

Classes (`tour.css`):

- `.tour` fixed, inset 0, z-index 88 (`:4`); `[data-kind='tour'|'brief']` and `[data-lit]` attributes drive variants.
- `.tour-veil` the dim `rgb(2 6 14 / 0.62)` (`:5`), transparent when something is lit (`:6`), lighter `0.45` for a brief (`:37`).
- `.tour-spot` fixed, radius 14 px, a 2 px `var(--accent)` ring and a `200vmax` shadow in the same dim colour that *is* the dim when lit (`:7-13`); transitions on `top/left/width/height` with `var(--ease-smooth)`.
- `.tour-card` fixed, width `min(340px, calc(100vw - 32px))` (`390px` for a brief, `:39`), padding `1.1rem 1.15rem 1rem`, `background: var(--surface)`, `color: var(--text)`, a dark drop shadow, position transitions, `tour-in` entry animation (`:14-23`, `:43`). It also carries the site's `.card` class (`Tour.jsx:157`) for the border, radius `var(--r-card)` and `var(--shadow-card)` (`src/index.css:472-479`).
- `.tour-count` mono eyebrow in `var(--muted)`, `var(--font-mono)`, 0.7 rem, uppercase (`:24`); `.tour-title` 1.1 rem/600 (`:25`); `.tour-text` 0.875 rem, `opacity: 0.88` (`:26`).
- `.tour-dots` 6 px dots in `var(--border-strong)`, past ones `color-mix(var(--accent) 55%, var(--border-strong))`, the current one 18 px wide in `var(--accent)` (`:27-30`).
- `.tour-buttons` flex right-aligned (`:31`); `.tour-skip` pushed left with `margin-right: auto`, `var(--muted)`, underline on hover (`:32-33`); the other buttons are the site's `.btn .btn-ghost .btn-sm` and `.btn .btn-primary .btn-sm` (`Tour.jsx:187`, `:191`; `.btn-primary` uses `--btn-bg`/`--btn-ink`, `src/index.css:448`).
- Focus ring `2px solid var(--accent-text, var(--accent))` (`:34`).
- `.tour-keys` reuses the guide's `.guide-keys` table (`Tour.jsx:174` passes `className="guide-keys tour-keys"`; base styles `src/styles/extras.css:984-989`, `.guide-kbd` at `:989`), with tighter padding (`:40-42`).
- `html[data-touring]` un-hides the scroll-hidden nav and the tucked guide button (`:46-47`; the tuck itself is `src/styles/extras.css:960-963`).
- Reduced motion removes the transitions and the entry animation (`:49-52`); print hides it (`:53`).

The offer (`offer.css`): `.tour-offer` fixed bottom-left, 16 px in, `bottom: calc(22px + env(safe-area-inset-bottom))`, z-index 47 (above the guide button's 46, below the toast's 60 and the panel's 80), width `min(330px, calc(100vw - 32px))`, `var(--surface)`/`var(--text)`, a `color-mix` shadow off `var(--text)`, `tour-offer-in` (`:4-18`, `:23`); icon in `var(--accent-text)` (`:19`); title 0.95 rem/600, text `var(--muted)` 0.82 rem (`:20-21`); buttons wrap (`:22`); on `body:has(.universe-page)` it moves up to 128 px to clear the map's corner buttons (`:25`; `.universe-page` is on `src/pages/Universe.jsx:416` and `src/pages/Galaxy.jsx:364`); at `max-width: 767px` it goes to the top, `calc(var(--nav-h) + 8px)` (`:26-28`); hidden under the phone menu (`:29`); reduced motion and print (`:30-31`).

Tokens and theming: every colour comes from the theme tokens on `:root` / `[data-theme]` (`--surface`, `--surface-2`, `--border`, `--border-strong`, `--text`, `--text-body`, `--muted`, `--accent`, `--accent-text`, `--btn-bg`, `--btn-ink`, `--saber`; the default set is in `src/index.css`, a per-company set per `[data-theme='…']`, e.g. `src/styles/extras.css:48-72` for travel), with dark mode as `html[data-mode='dark']` overriding the same tokens (`src/index.css:233-256`; `--accent` becomes `var(--saber)` there, `:243`). `data-theme` is set by `ThemeProvider` (`src/theme/ThemeProvider.jsx:116`), `data-mode` by `index.html:32` and `ThemeProvider.jsx:142`, `:163`. The tour's dim colour `rgb(2 6 14 / …)` is the only hard-coded colour and is the same in both modes. Easing is `var(--ease-smooth)` from the site's family (`src/index.css:39-44`); `--nav-h` is 68 px / 76 px from 768 px (`src/index.css:56`, `:65`); `--font-mono` at `:47`.

Breakpoints the tour and guide use: `767px` (offer to the top), `639px` (guide button tuck and panel full-width, `src/styles/extras.css:960`, `:1016`); the nav's own breakpoints are Tailwind's `sm/md/lg/xl` (`Nav.jsx:392-449`), which is what decides which targets exist on a phone.

---

## 11. Extension points and risks

### 11.1 Audience-specific tours (recruiter, player, mixed)

Extension points:

- `TOURS` is a plain map keyed by name (`steps.js:44`); stops are already shared constants (`:8-42`), so a recruiter list can reuse `resume`, `search`, `guide`, `done()` and add its own. `loadList` picks `TOURS[run.name]` (`TourHost.jsx:18`), so any name works once `run.name` can be something other than `tourFor(pathname)`.
- `openTour` dispatches a bare `Event` (`tour.js:12`); switching it to `CustomEvent('tp:tour', { detail: { name | audience, stop? } })` and reading `e.detail` in `onStart` (`TourHost.jsx:41-44`) is the one change every entry point then benefits from: the palette (`CommandPalette.jsx:92`, add three items), the guide's site tab (`GuidePanel.jsx:86-95`, three buttons or a choice), the terminal (`Terminal.jsx:518-521`, `tour recruiter`), the offer (`TourHost.jsx:137`, which could ask "Here to hire, or here to play?" instead of one button).
- `WORDS` per kind (`Tour.jsx:48-51`) and the `data-kind` attribute (`:151`) are where an audience's wording and styling hang.
- The `tour` achievement is one id (`Achievements.jsx:16`) and `tp-tour` is one tri-state (`tour.js:8`): to remember *which* tour was taken, either store an object/array under `tp-tour` (keep `offerHere`'s `seen == null` semantics, `tour.js:23`) or add a key such as `tp-tours-done`; `restart.js:8-15` must list any new key for Start over to forget it; `restart.test.js:18` checks the list.

Risks:

- `steps.test.js:23-25` asserts the keys are exactly `['classic', 'universe']`, `:27-32` that the first and last stops point at nothing, `:54-56` that the last text mentions the guide: these will need updating with the new names, and are good places to add "every audience tour exists in both views" if the design is `{audience}:{view}`.
- The view split is real: the universe and classic shells have different targets (`panel`, `ships`, `navmap` only on the map; `pages`, `terminal` only in the classic nav). A recruiter who landed in the universe needs the universe's stops, so audience × view is 6 lists unless the tour switches view itself (which is a route change across kinds, section 8.3 #1). `useView().switchTo` (`ViewSwitch.jsx:28-44`) saves `tp-start` and navigates (and toasts), so a tour that switches views also changes the visitor's remembered front door; a tour should probably navigate with `navigate(classicPathFor(...))` directly instead.
- On a phone the nav's stops fold into `menu` (`resolveSteps`), so a recruiter tour of "experience, projects, résumé" that points at nav links has, on a phone, only the menu button to point at; the feed's own page headings have no targets today (section 4).
- `offerHere` only fires on the map and the feed (`tour.js:21-23`); a recruiter arriving by a deep link to `/resume` is on the feed and would get the offer; one arriving at `/projects/gameboy` would not.

### 11.2 Tours that span routes

Extension points: `TourHost` has the router (`App.jsx:370` inside `:382`); `busy()` (`TourHost.jsx:22-25`) and `targetOf` (`Tour.jsx:24-30`) are the two predicates to build "navigate, then wait for the target" on; the run record (`TourHost.jsx:30-35`) can carry `{ i, path }`; the `Tour` key (`:149`) can stay stable across the tour's pages; `html[data-touring]` is the flag the rest of the shell can be taught to respect; `tp:uncover` (`App.jsx:142`) and `tp:3d` / `useScene` are the signals that a 3D page is drawing.

Risks (section 8.3 in full): the kind-flip rule (`TourHost.jsx:74`); one-shot step resolution (`Tour.jsx:54`); lazy chunks with an empty fallback (`App.jsx:324`); the page-key remount and 3D warm-up (`App.jsx:325`, `useScene.js:36`); `/` redirecting to `/home` or showing `StartChoice` (`Front.jsx:15-16`); world gates and 2D fallbacks (`WorldGate.jsx:76-107`); worlds' own intros and modals; briefs queued behind the tour (`TourHost.jsx:81-93`); the feed's scroll-replace and lazy page mounting (`Feed.jsx:16-25`, `:77`); `ScrollToTop` (`App.jsx:73-75`) and page music stopping (`:77-79`); inert captured once (`Tour.jsx:38-43`); nav refit changing targets (`Nav.jsx:275`); every key swallowed (`Tour.jsx:96`); `busy()`'s blind spots (lightspeed, non-modal overlays). A route-spanning tour also has to decide what "Back" means across a page boundary, and what happens if the visitor reloads mid-tour (today nothing persists: `i` is component state, `Tour.jsx:57`).

### 11.3 A progress / checklist model ("things to do" with done-state)

What exists to build on:

- Achievements are already a durable, site-wide done-set with names and descriptions (`Achievements.jsx:11-253`, `:279-282`), an `unlock` that is idempotent (`:294`), a toast, and `unlocked` exposed by context (`:365`). Many "things to do" already have an id: `tour`, `resume`, `palette`, `hacker` (opened the terminal), `explorer` (every page), `cartographer` (every theme), `grandtour`, `globetrotter`, and each world's headline achievement. A checklist that reads `unlocked` needs no new storage for those.
- Route-driven unlocks (`Achievements.jsx:305-316`) show the pattern for "visited X": `tp-visited` is **session** storage, so "visited every page" resets per visit; a site-wide checklist needs a local list.
- Per-world "things to do" already exist inside worlds with their own storage and events: `M` opens "The list of things to do" in every 3D walk (`pages.js:30`), `tp-*-done` keys per town/world, `tp-dmg-found` with `tp:dmg-found` (`found.js:8-9`), `tp-earth-stamps` with `tp:earth-stamps`, `tp-galaxy-quests`/`-found`/`-landed`. A shell checklist can subscribe to those events rather than re-implement them, but the keys are world-private by the island rule (`RULES.md:13-15`): read them through each world's `index.js` or move a shared "done" helper down to `src/lib`.
- The guide's `SITE` tips (`pages.js:539-547`) and the palette's items (`CommandPalette.jsx:87-159`) are the de facto catalogue of "things the site can do", each with a `run`; a checklist item could be `{ id, label, run, doneWhen: achievementId | predicate }`.
- Seen-lists with a 60 cap (`tp-briefs`, `tp-guide-seen`) are the house pattern for "shown once" state (`brief.js:55`, `Guide.jsx:91`).

Risks: `tp-achievements` is read once at mount into state and a ref (`Achievements.jsx:279-282`, `:296`); another tab or a world writing the key directly would not be seen (only `useView` listens to `storage` events, `ViewSwitch.jsx:19`). The toast shows one item at a time, so a checklist that unlocks several things at once queues 3.8 s each (`:322-327`). A checklist UI has to find a place in a shell that already has the guide button (z 46, bottom right), the nudge (z 46), the offer (z 47, bottom left), the toast (z 60, bottom centre), the universe's corner buttons (the offer moves up 128 px for them, `offer.css:25`) and, on a phone, the guide button tucking on scroll (`Guide.jsx:108-134`).

### 11.4 Deep links that start a tour at a stop

Extension points: `TourHost` has `useLocation()` (`TourHost.jsx:28`) and could read `search` (`?tour=recruiter&stop=resume`) or a hash suffix; `openTour` could take `{ name, stop }`; `Tour` could take an initial index (`useState(0)` at `Tour.jsx:57`). The palette already uses query strings for deep links (`/travel?place=…`, `CommandPalette.jsx:105`), and `ScrollToTop` ignores search-only changes (`App.jsx:66-75`), so a `?tour=` param does not scroll the page.

Risks: the router is a `HashRouter` (`App.jsx:382`), so the link looks like `/#/resume?tour=recruiter`; the inline intro gate only skips the intro for hashes other than `''`/`'#'`/`'#/'` (`index.html:35`), so `/#/?tour=…` would still get the intro on a first visit and the tour would wait behind it (`busy()`), while `/#/universe?tour=…` would not; `tp-start` unset means `/` shows `StartChoice` (`Front.jsx:16`); feed pages use `usePageParams` to keep their own search strings and put them back when the page becomes current again (`src/lib/page.js:18-40`), so a leftover `?tour=` on a feed page could be re-applied to the address when the visitor scrolls back, re-triggering the tour unless `TourHost` strips it with a `navigate(..., { replace: true })` the moment it has read it; the first-arrival offer (`tp-tour == null`) and a deep-linked tour would both try to show, so the deep link should write `tp-tour` (or the new key) before the 2.4 s poll fires; a stop named in the link whose target is not on this screen is filtered out by `resolveSteps`, so the start index must be resolved by id after filtering, not by position; and a stop on another page is the multi-page problem again.
