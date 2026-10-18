# Audience tours and one house UI: design

Date: 2026-10-07. Research: `docs/research/2026-10-07-tours-and-ui-audit/` (the map of the existing tour, the inventory of 686 things to do, three UI audits). Builds on `2026-10-07-site-tour-design.md`, which stays true for the parts it covers.

The owner's ask: a site-wide, in-depth tour system that shows what there is to do, in a recruiter version, a player version and a mixed one; and a UI audit that finds what good design is here and brings the rest in line, above all the universe's language and spacing, the worlds' spacing, and "not too many different things for the same thing".

## 1. The problem

The site has one short tour (nine or ten spotlight stops of the shell, one per view) and a set of first-arrival cards per world. Neither says what there is to *do*. A recruiter lands and does not know the Game Boy emulator is playable, that the multiplayer is serverless, or that the résumé filters by skill. A player lands and does not know there are seventeen walkable planets, co-op kitchens, a Battlefront-style assault or a voxel engine. The inventory counts 686 things; the site tells a newcomer about nine.

The UI grew by accretion. The audits count, for one concept, twelve interact prompts, seven objective lines, fifty-eight key-cap styles, twelve words for "menu", twenty wordings for "leave", eight names for the nav map and seven words for going fast. The pieces are individually good; they do not agree with one another.

## 2. Goals and non-goals

Goals:

1. Three site-wide tours, resumable, startable from a link the owner can send: the hiring tour under five minutes, the player's under eight, the whole tour under twelve, by the estimate in 3.8.
2. A "Things to do" checklist in the guide, filtered by audience, with done-state, that the tours draw their stops from, so the two never disagree.
3. A written house UI rule set, a glossary (one word per thing), and one component per concept, applied to the shell, the universe map and every world's HUD.
4. Every rule testable: the pure parts under `vitest`, the walk-through under headless Chromium.

Non-goals: new worlds, new games, new content in `src/data/` (roles, projects, résumé), a redesign of the look (colours, fonts, the house look), any change to game rules, and auto-loading a heavy world inside a tour.

## 3. The tours

### 3.1 Audiences

| Audience | Who | What the tour shows | Length |
| --- | --- | --- | --- |
| `recruiter` (shown as **the hiring tour**) | To hire | The work: pages, projects, the résumé, and the engineering under the site (the map, multiplayer, the autopilot, the terminal). Every stop is on a light route. | about 5 min, 8 chapters |
| `player` (**the player’s tour**) | To play | The map and the ship, the galaxy, the worlds and what to do in each, the games, multiplayer, achievements, the checklist. | about 7 min, 10 chapters |
| `mixed` (**the whole tour**) | Both | The recruiter spine with the player's chapters folded in after the universe chapter. Not a third set of copy: a composition. | about 10 min |

The existing `universe` and `classic` tours stay as they are and become the first chapter ("The shell") of every audience tour, picked by the view the visitor is in when the tour starts.

### 3.2 Shape

A **tour** is an ordered list of **chapters**. A **chapter** is `{ id, title, path, stops }`: one route, and the stops on it. A **stop** keeps the shape it has today (`id`, `title`, `text` as a string or a function of `{ key }`, optional `at` naming a `data-tour` target, optional `keys`/`touch` rows) and gains:

- `actions?: [{ label, to?, href?, download?, tour? }]` (at most four, rendered as their own row above the buttons): `to` is a route, `href` an outside link or the PDF, `tour` an audience to start next. A `to` into a world or the galaxy **ends the tour** with the progress saved at that chapter (the tour never loads a world by itself; it offers). A `to` on a light route is an **excursion**: the tour goes there, drops its veil, and a notice says "Carry on the tour · chapter 5 of 8" with Carry on and Stop. (Revised 2026-10-18: the note's title names the tour and the chapter is the line under it; Stop stays a visible button and the × is Not now. `docs/decisions/2026-10-18-one-question-on-arrival.md`.)
- `todo?: string`: the id of the catalogue item this stop shows (section 4), so the card can show a tick when it is done and the checklist can start the tour at this stop.
- `release?: ['?', 'palette']`: the keys the tour lets through at this stop so the visitor can try them (`keys` and `touch` stay the key-table rows).
- `wait?: true`: the stop's target mounts late (a lazy section); the tour waits for it rather than dropping the stop.

A chapter may also carry `brief: '/universe/fly'` (its stops are that brief's cards, and passing it marks the brief seen), `heavy: true` (on a coarse pointer the engine shows the chapter's `phone` version, a card, instead of navigating), and `path: null` (stay where the previous chapter was: the end cards).

**Amended 2026-10-08 (the owner's call):** the player's tour does walk into eight worlds (the galaxy at Hoth, Avengers HQ, Middle-earth, Scranton, Invincible, C-137, Albuquerque, Dot Matrix), one chapter each marked `world: true` (`chapters/player.js`'s `WALKED`). Such a chapter is the one exception to the light routes below: the engine opens the world and waits for it, its download gate included, for as long as the gate asks (`waitUntil`'s `hold`: the eight seconds count from the answer), with the veil lifted and the keys let through so the visitor can answer it; a world kept light is toured as it is, with a notice on the chapter's first card. A phone takes the whole tour too. The other worlds stay offered by their cards.

A chapter's `path` may only be a **light route**: a feed page (`/home`, `/experience`, `/projects`, `/resume`, `/contact`, `/travel`), a project page, `/terminal`, `/changes`, or `/universe` (never `/`, which may redirect or show the front door's choice). Worlds, the galaxy and the Death Star are reached by `cta` only. The data test enforces this.

### 3.3 The engine: a tour that crosses routes

Changes in `src/components/tour/TourHost.jsx` and `Tour.jsx`, with the pure parts in `src/lib/tour.js`:

- `openTour({ audience, chapter?, stop? })` dispatches `tp:tour` with detail; a bare event still means "the view's tour", as today. `TourHost` reads the detail and sets `run = { kind: 'tour', name: audience, chapter, stop }`.
- The run's `Tour` element keeps a stable key for the whole tour (`tour:<audience>`), so its index survives route changes. The "kind flip ends the run" effect (`TourHost.jsx:74`) only applies to the two view tours; an audience tour ends on a route change the tour did not make (the visitor clicked a link under it cannot happen, the page is inert, so this is: the browser's Back button, or a `cta`).
- Moving to a stop whose chapter `path` is not the current location: `TourHost` calls `navigate(path)` and the stop enters a **waiting** state: the veil stays, the card shows the chapter's title and "One moment…", and the stop proceeds when `readyFor(stop)` holds: nothing covers the page (`busy()` as today, minus `touring`), the lazy chunk has rendered (`#main` has a child that is not the Suspense fallback), and the target is on screen or the stop has none. A timeout of 8 s gives up on the target and shows the card in the middle (the text still reads), never a hang.
- `Back` across a chapter boundary navigates back to the previous chapter's path and waits the same way.
- Keys stay swallowed as today, except at a stop that says `keys: 'release'`: there the tour lets `?` and the palette shortcut through, so the visitor can try them. (Used by the "Go anywhere" and "Stuck? Press ?" stops.)
- Feed pages: a programmatic navigate starts the feed at that page's top, which mounts it, so its targets exist. The tour does not scroll the feed on to the next page; each feed page is its own chapter.
- A world's basics cards are not shown under a tour (they already wait on `busy()`); a tour's `cta` into a world ends the tour first, so the basics show as they do today.
- Reduced motion: no glide, as today. Screen readers: the waiting card is announced once.

### 3.4 Progress and storage

`tp-tour` becomes a JSON value `{ offered: true, audience?, chapter?, stop?, done: ['recruiter', …] }`. Reading accepts the old strings (`'offered'`, `'done'`, `'skipped'`) as `{ offered: true, done: ['view'] }` for `'done'`. `offerHere` keeps its "unset means offer" rule. The key is already in `restart.js`'s list, so Start over forgets it.

Progress is written at every stop. The guide's "The site" tab shows "Carry on the recruiter tour (chapter 4 of 8)" when a tour is unfinished.

Finishing an audience tour unlocks `tour` (as today) and a new achievement per audience: `tourRecruiter` "Took the recruiter's tour", `tourPlayer` "Took the player's tour"; `mixed` unlocks both.

### 3.5 Entry points

- **The first-arrival offer** (`TourHost.jsx`): "New here? I’ll show you round" and "Here to hire, to play or both?", with three buttons side by side (To hire, To play, Both), each with its length from `TOUR_MINUTES`, and an × for "Not now". Same timing and gates as today. (Revised 2026-10-18: `docs/decisions/2026-10-18-one-question-on-arrival.md`.)
- **⌘K**: "Take the recruiter's tour", "Take the player's tour", "Take the whole tour", in the Actions group, replacing the one item.
- **The guide's "The site" tab** (`GuidePanel.jsx`): the three tours as buttons, the chapters of each listed under a disclosure so any chapter can be taken alone, and "Carry on…" when one is unfinished.
- **The terminal**: `tour` (as today), `tour recruiter`, `tour player`, `tour all`; `help` lists them.
- **A link**: `/#/<any light route>?tour=recruiter|player|all[&chapter=<id>]`. `TourHost` reads `search` on mount and on change, writes `tp-tour` so the offer does not race it, strips the parameter with `navigate(…, { replace: true })`, and starts the tour at that chapter. The owner's résumé link becomes `https://tilakpatell.com/#/home?tour=recruiter`.
- **The checklist** (section 4): every row's "Show me" starts the tour at that row's stop.

### 3.6 Content

The copy lives in `src/components/tour/chapters/` (`recruiter.js`, `player.js`, `shared.js`), one file per audience, loaded with the tour as `steps.js` is today; `steps.js` exports `TOURS` extended with `recruiter`, `player`, `mixed` (composed) beside `universe` and `classic`. The voice is the existing one (`steps.js`, `briefs.js`): short sentences, the site's own words, British spelling, curly quotes, no exclamation marks in a row.

Recruiter chapters (targets to add are in section 3.7):

1. **The shell** (the view's existing tour, trimmed to the five stops that matter: where you are, Universe/Classic, ⌘K, the guide, the résumé).
2. **Home** (`/home`): the intro, the live GitHub snapshot (`home-github`), the Game Boy with three hand-built games (`home-gameboy`).
3. **Experience** (`/experience`): the roles (`experience-roles`), the site re-themed per company, each role's own address.
4. **Projects** (`/projects`): the cartridges (`projects-cartridges`), the periodic table (`projects-table`); `cta` "Boot the Game Boy emulator" to `/projects/gameboy-emulator`.
5. **The résumé** (`/resume`): skills filter (`resume-skills`), the PDF (`resume-pdf`).
6. **Contact** (`/contact`): the memo (`contact-form`), copy the address.
7. **Under the hood** (`/universe`): the map is the site (panel), the ship and flight model (ships), multiplayer over Nostr with no server (`online`), the nav map's tested routing (navmap); `cta` "See the ship's log" to `/changes` (the autopilot) and `cta` "Open the terminal".
8. **That's the tour**: PDF, email, LinkedIn, "Take the player's tour".

Player chapters:

1. **The shell** (the view's tour, the universe one if on the map).
2. **Flying** (`/universe`): the panel, the ships, the stick (keys), the nav map and drives, landing and trouble.
3. **The galaxy** (`/universe`, card): seventeen surfaces, missions, galactic assault, the trench run; `cta` "Fly to the galaxy" (`/galaxy`).
4. **The worlds** (`/universe`, one card per world, 13 cards): what the world is and its two or three headline things to do, from the catalogue; each `cta` "Go there". The card says the download size on a phone.
5. **The games** (`/universe`, card): Dot Matrix, the cartridges, Super Mario 64 and Minecraft tributes, the Game Boy on the home page; `cta` to `/dot-matrix`.
6. **Together** (`/universe`): Online (`online`), the shared siege, co-op kitchens, fleet wars.
7. **Achievements** (`/universe`): the list (`achievements`), what unlocks paint and parts.
8. **Things to do** (`/universe`): the guide's checklist (`guide`), filtered to play.
9. **Colours and scripts** (`/universe`): company and fan themes, Aurebesh, Cybertronian, runes (`colours`).
10. **That's the tour**: "Take the recruiter's tour", the checklist.

Mixed: composed **by chapter id**, never by position: `compose(TOURS, [['recruiter', 'home', 'hood'], ['player', 'galaxy', 'colours'], END])`, where `END` is a chapter in `chapters/shared.js` with `path: null`; the player's Flying chapter is skipped because the hiring tour's "Under the hood" already toured the panel, the ship and the nav map. Stored chapter lists never include the shell; `planFor` prepends it for every audience. Test: ids unique, no `at` lit twice in one tour except `guide`.

### 3.7 Targets to add

`data-tour` markers, each on the element itself (a heading, a control), never a wrapper the height of the viewport, and only ones a stop uses: `home-open` (the "open to" line), `home-gameboy` (`#gb-title`) in `src/pages/Home.jsx`; `home-github` on the heading in `src/components/online/FindMeOnline.jsx`; `experience-roles` (the hero title) and `experience-track` (the track `.seg`) in `src/pages/Experience.jsx`; `projects-featured` (the featured grid, `Projects.jsx:127`) and `projects-table`; `resume-skills`, `resume-pdf`; `contact-copy` (the copy button) and `contact-form` (the memo's head line); `changes-log`; `terminal-input`; `online` (`src/components/universe/online/Online.jsx`'s button); and `ships` also on the panel's flying block (`UniversePanel.jsx:220-249`) so the stop lights the ship you are in. No `achievements` target: there is no such control, and the spec adds none. The steps test checks both ways: every `at` is marked, and every page marker is used by a stop (allow-list for the shell's existing markers).

### 3.8 Tests

- `src/lib/tour.test.js`: `readProgress` (old strings, bad JSON, the new shape), `writeProgress`, `parseTourLink('?tour=all&chapter=worlds')`, `planFor(audience, view)` (the shell chapter picked by view; mixed composed in order; every chapter id unique), `nextStop`/`prevStop` across chapter boundaries, `readyFor` with stubbed predicates, the 8 s timeout.
- `src/components/tour/steps.test.js`: extended: `TOURS` keys are the five; every chapter `path` matches the light-route list; every `cta.to` is a route in `App.jsx` (read the file, as `marked()` reads the markers); every `todo` id is in the catalogue; each audience tour's stop count and a rough reading-time estimate (words ÷ 3 per second plus 4 s a stop) under the length in 3.1.
- `scripts/tour-check.mjs` (Playwright, like `autopilot-check.mjs`): seeds the intro keys, opens `/#/home?tour=recruiter`, presses Right until Done, asserting at each stop that within 8 s either `.tour-spot` is visible or the card is centred, and that no console error is new; the same for `player` from `/#/universe` and for `mixed`; desktop and phone. Run by hand and by the autopilot check when a tour file changed.

## 4. The things-to-do catalogue and checklist

### 4.1 The catalogue

`src/data/todo.js`: a curated list, about sixty items, built from the inventory's recruiter shortlist and each world's headline things. Not all 686: the inventory stays in research; the catalogue is what a newcomer should know exists. A row:

```js
{ id: 'gameboy-emulator', title: 'Boot the Game Boy emulator', to: '/projects/gameboy-emulator',
  area: 'projects', kind: 'game', audience: 'both', seconds: 90, phone: true,
  blurb: 'A C++ emulator, every LR35902 opcode, compiled for the browser.',
  done: { achievement: 'player' } }           // or { visited: '/projects/gameboy-emulator' }
```

`area` is one of the guide's keys (`guide/routes.js`), so the checklist groups as the guide does. `done` is an achievement id (checked against `ACHIEVEMENTS` by the test) or a visited route. `src/data` imports nothing but data, as the rules say; the test lives beside it.

### 4.2 Done-state

- Achievements: read from the existing context (`useAchievements().unlocked`).
- Visited routes: a new list `tp-visited-ever` in localStorage (cap 200, the house's seen-list pattern), written by the shell on every pathname change through `src/lib/visited.js` (pure helpers, tested). Added to `restart.js`'s list.
- A world's own done-lists stay private to the world (the island rule); the catalogue uses the world's headline achievement instead.

### 4.3 The checklist

A **"The checklist"** tab in the guide panel (`GuidePanel.jsx`), beside "On this page" and "The site" ("Things to do" stays the name of a world's own list under `M`; one word per thing): a filter row (Hire, Play, Everything: a `.seg` control), "12 of 48 done", then the groups, each row a title, a one-line blurb, the time, a tick when done, and "Show me" (starts the tour at the stop that has this `todo`, or goes to `to` when no stop does). ⌘K gets "Things to do" opening the tab. The terminal gets `todo` listing it with ticks.

## 5. One house UI

The audits' "what is good" sections are the standard; the findings are the work. The rules below are the short form; `docs/health/RULES.md` gains a "UI" section carrying them, so the steward can enforce them.

### 5.1 Rules

1. **Tokens are the only source of a number.** `src/index.css` gains `--z-page/nav/float/sheet/dialog/cover/top`, `--t-fast/base/slow`, `--fs-xs … --fs-display-1` (eleven sizes, nothing under 0.8125 rem in the shell, nothing under 0.7 rem in a HUD), `--shadow-float`, `--shadow-dialog`, `--edge-x/y`, `--page-top`, `--measure`. A hard-coded value in a stylesheet or a Tailwind bracket carries a comment saying why.
2. **Spacing is the 4 px grid**: whole Tailwind steps; sections `py-14 md:py-20`; card padding 24, compact 20; controls 44 px on a coarse pointer, 36 minimum otherwise, 8 px apart.
3. **One component per concept** in the shell: `.btn` (primary, ghost, sm, lg), `.chip`, `.seg`, `.link`, `<Kbd>` (one key-cap style, `.kbd`, replacing the guide's and every world's), `<CloseButton>`, `<Layer>` (one backdrop, three kinds: sheet, dialog, cover), `<Notice>` (one corner notice: the toast, the nudge, the tour offer, the world gate's pill). One icon per meaning from `src/components/icons.js`.
4. **One word per thing**: `src/lib/words.js` holds the glossary (5.2) and every label reads from it or matches it; the test greps the retired words out of user-facing strings in the shell and the universe.
5. **Text over 3D sits on glass**: `--hud-glass` (no blur over a live map), or the arrive title's shadow; never bare.
6. **Phones**: safe-area insets on every fixed element; HUD rows stack by measurement, not by hand sums; the guide's `?` and the world switcher have a reserved corner on every screen.
7. **Copy**: British spelling, curly quotes, sentence case, one sentence per toast, key first in a prompt ("E Go in · Burger Mart").
8. **Dim by colour, never by opacity under 0.55**; muted text keeps 4.5:1 on every theme.

### 5.2 Glossary

| Concept | The word | Retire |
| --- | --- | --- |
| The 3D site | the universe; "Universe" on the switch; "Universe map" on a world's way out | the map, space, the whole map, the whole site as a universe |
| The plain site | the classic site; "Classic" on the switch | the home page, plain pages, the pages, the feed, portfolio pages |
| Help | the guide; "?" | help, controls (as a title), this guide |
| The tours | the tour (of the site); the recruiter's tour, the player's tour, the whole tour | a quick look round (as a name), the grand tour (keep for the nav map's flight, renamed "Fly past everything") |
| The nav map | the nav map; `M` | nav computer, chart, the whole map, 3D view (as its close), the galaxy map |
| Going fast | boost (`Space`); the pulse drive is what boost becomes in the open; jump (`J`, the nav map) | hyperspeed, super speed, hyperdrive, lightspeed (crew lines keep their fiction) |
| Into a page or world | land (a planet), dock (a station), go in (a door) | jump to, go to, fly here, skip the trip, straight in, through the gate, enter, into |
| Kinds of place | a page (station), a world (planet), a wonder, a star system | fandom, the things I love, place (as a kind) |
| Colours | colours; "Site colours" | theme, scheme, color scheme, theme backgrounds |
| Restart | Start over | restart the site, back to the intro |
| Close | Close (every floating thing has one, and `Esc`) | dismiss, keep it light, done, leave it |
| Leave a world | Leave (`Esc`) inside; "Universe map" to the map | back to the car/office/island/courtyard/system/site, take off, stop, exit |
| Retry | Again | try again, start over (in a game), fly it again, respawn, continue |
| The list in a world | Things to do (`M`) | places, missions, cartridges, passport, the compound, this week at…, objectives |
| The menu in a world | Menu | settings, driving, paused, game menu, pause, controls, stop |
| Other players | the players chip: "N others here" | drivers, travellers, visitors, listeners, Ricks, Mortys |
| Keys | `Esc`, `⌘K` / `Ctrl K`, `Enter` | Escape, esc, Ctrl+K |
| The PDF | Download the PDF | open the PDF, download, download résumé |

### 5.3 The shell and the classic pages

From `ui-shell-classic.md`: the tokens in 5.1; fold the six segmented controls into `.seg`, the six key caps into `.kbd`, the ten modal layers into `<Layer>`, the four corner notices into `<Notice>`, the two copy buttons into one, the inlined bullets into `Bullets`, the five link styles into `.link`/`.link-quiet`, the eleven kicker styles into `.eyebrow`/`.label`; apply the glossary; fix the readability floor (nothing under 0.8125 rem, muted text 4.5:1) and the touch targets (44 px on coarse pointers). The page header rhythm of Home, Projects, Contact and Changes is the rhythm for Experience, Résumé and Travel.

### 5.4 The universe map

From `ui-universe.md`: `src/components/universe/hud.css` with `--hud-pad`, three rows (top, foot, thumbs), two surfaces (`hud-sheet` 0.93/14 px, `hud-dialog` 0.96/`--r-card`), three chip roles (`hud-chip`, `hud-toast`, `hud-cta`), one cap (`.kbd`), one amber (`--hud-warn`), four dark alphas; `src/components/universe/words.js` for the glossary's universe rows, imported by the panel, the nav map, the scene's prompts, the guide's page and the briefs; the first-flight hint cut to the five keys that matter (the rest is the guide); the panel's intro paragraph to one sentence; system text plain, crew lines in character; the phone's first minute down from eleven buttons to the thumbs, the panel's handle and the way in. The nav map is the reference and is not restyled.

### 5.5 The worlds' HUDs

From `ui-worlds-games.md`: a shared kit in `src/runtime/hud/` (the runtime already hosts every world's canvas): `hud.js` (pure, tested: `layoutRows`, `titleMode`, `objectiveText`, `markerSize`, `stackUnder`), `Hud.jsx` (the frame: top row with title-that-collapses, objective, counters, one `Menu`), `Prompt.jsx` (pill, key first), `Objective.jsx`, `Toast.jsx` (top centre), `Bubble.jsx` and `QuestList.jsx` (moved out of `TownHud.jsx`), `PlayersChip.jsx`, `Stick.jsx` (116/46) and `TouchButton.jsx` (64, 52), `hud.css` with `--hud-pad`, `--hud-pad-b`, `--guide-reserve`, `--hud-foot`, `--hud-glass`. Invincible's `hud.js` and `InvHud.jsx` are the model and move in first; `TownHud.jsx` second (fourteen worlds in one move, by keeping its CSS variables as the skin); then one world a pull request: Albuquerque, Avengers, C-137, Cybertron, Dot Matrix, Earth, the galaxy surface, the Caribbean, Mario 64, Minecraft, the music room, the Death Star. Each migration keeps the world's own face for the title and big numbers and its own colours through the skin variables; it changes positions only to the kit's rows. Before and after screenshots per world, as the steward's recipe says.

The achievement toast moves off the HUD's foot on world routes. Every world's "Controls" opens the site's guide, so keys are written once (`guide/pages.js`).

### 5.6 Tests for the UI

- `src/lib/words.test.js`: the glossary's retired words do not appear in user-facing strings of the shell, the universe HUD files and the shared HUD kit (a list of files, a list of regexes, a short allow-list for crew lines and fiction).
- `src/runtime/hud/hud.test.js`: the layout rules (Invincible's tests, generalised).
- `scripts/health/` gains `hud-kit` (worlds whose HUD imports nothing from `src/runtime/hud`: lower is better; budgeted once the kit lands) and `kbd-styles` (rules styling `kbd` outside `src/index.css`: lower is better).
- The screenshot walk: `scripts/autopilot-check.mjs --routes` on every migrated world, desktop and phone, before and after.

## 6. Order of work and the sessions

Four streams, each a branch and a pull request series, each run by its own session (the owner asked for Opus 5.5 ultracode sessions):

| Stream | Branch | Scope | Depends on |
| --- | --- | --- | --- |
| A. Tour engine | `claude/tours-engine` | 3.3, 3.4, 3.5, 4 (catalogue, visited, checklist tab), tests in 3.8 except the walker | nothing |
| B. Tour content | `claude/tours-content` | 3.6, 3.7, the walker script, the two achievements | A's interfaces (fixed here: `openTour(detail)`, the chapter shape, `TOURS` keys, `todo` ids) |
| C. Shell, classic, universe UI | `claude/ui-shell-universe` | 5.1, 5.2, 5.3, 5.4, `words.js` and its test, the RULES.md section | nothing |
| D. World HUD kit | `claude/ui-world-huds` | 5.5, 5.6's kit tests and health metrics | C's `.kbd` (D may ship its own `.kbd` in `hud.css` and C reconciles) |

A, C and D start at once. B starts at once too, against the interfaces above, and rebases on A before its pull request. Where B's `data-tour` markers and C's page edits touch the same files, B adds attributes only. Each stream opens one pull request per slice that stands on its own (C and D: one per surface or world), merged when CI is green and the screenshots match the intent.

## 7. Risks

- **A tour's navigate and the page's own gates.** `readyFor` with a timeout is the whole answer: a stop never hangs, and the worst case is a centred card. The walker catches a stop that always times out.
- **The feed's address replace** on scroll is already ignored by `TourHost`; the tour never scrolls the feed on.
- **Glossary churn in the worlds' fiction.** Crew lines and in-world signs keep their words; only system text changes. The retired-words test has an allow-list for them.
- **Migrating fourteen HUDs.** One world a pull request, screenshots before and after, the kit skinned by variables so no world loses its face.

## 8. Revision 2: amendments after review

A three-lens review (engineering, a hiring manager, a player) found 62 defects, none refutable against the code. Each decision below is final and overrides the section it names. The letter says which stream does it.

**Engine (A)**

- A1. **`clear()`** replaces "busy() minus touring": none of `covered`, `intro`, `menu` on `html.dataset`, no `[aria-modal="true"]` other than `.tour-card`, no `.world-gate`. The tour's own card never blocks it. Test: a document whose only modal is the tour card is clear.
- A2. **Two waits, not one.** At a chapter boundary the engine navigates and waits (8 s at most) for the router to have committed the path (`location.pathname` equals it, or for a feed page `categoryAt(pathname)?.to` equals it), `clear()`, and no `.feed-loading` inside the active `.feed-page` (Feed sets `data-ready` when its page has mounted). Then it runs `resolveChapter(stops, hasTarget)` against the DOM: stops whose target is absent are dropped as today (the shell's menu substitution included); only a stop with `wait: true` keeps waiting for its target, and a target inside `[aria-busy="true"]` or at computed opacity 0 does not count. A chapter's first stop centres only when the chapter itself timed out. `rendered()` and `data-fallback` are gone.
- A3. **Ending.** An audience tour ends on POP (the browser's Back) or a PUSH outside the chapter; feed moves (`isFeedMove`) and address replaces within the chapter's feed page never end it. Section 7's sentence about the feed was wrong and is withdrawn.
- A4. **Release stops.** At a stop with `release`, the tour sets `html[data-touring='release']`, hides its veil (`.tour[data-release] .tour-veil { display: none }`), lifts `inert` from the guide's button and the palette host, and lets the named keys through; `Guide.jsx` ignores `?` only when `dataset.touring === ''`. The card stays. The walker presses `?` and `Esc` at that stop. `isPaletteKey(e)` moves into `src/lib/palette.js` with a test and `App.jsx`'s palette host uses it too.
- A5. **`ctx = { key, touch, ship }`** is passed to every stop's `text` function (and the steps test's ctx).
- A6. **`openTour(detail = null)`** ignores a non-plain-object argument (`detail instanceof Event`), so existing `onClick={openTour}` callers stay right; the offer's buttons call `() => openTour({ audience })`. `parseTourLink` accepts `?tour=hiring` as an alias of `recruiter` and `all` as `mixed`; the owner's résumé link uses `hiring`.
- A7. **Dots are chapters** on an audience tour (one per chapter, the current one wide) and the count reads "Chapter 4 of 10 · 3 of 13"; view tours and briefs keep dots per stop. Actions render as their own row above the buttons, wrapping, full width on a phone.
- A8. **A chapter with `brief`** uses `BRIEFS[key]` as its stops; passing its last stop (or ending after it) writes the key with `sawBrief` into `tp-briefs`, so the basics never follow the tour.
- A9. **The panel untucks** while a chapter at `/universe` runs (the panel reads `html[data-touring]`) and goes back after.
- A10. **Excursions and carrying on.** `onAction` branches on `isLightRoute(to)`: light routes are excursions (3.2); a world or the galaxy ends the run. On the first arrival at a light route after a tour was left unfinished, a `<Notice>` once per visit (`tp-tour-nudged`, session) says "Carry on the player's tour · chapter 5 of 10" with Carry on and Not now. The guide's "The site" tab stays the second way back.
- A11. **Toasts queue** while `html[data-touring]` is set and play after the run ends.
- A12. **The scene pauses** under a centred card (no lit target) as it does under `data-covered`; a lit stop keeps drawing.
- A13. **`SHELL_STOPS`**: `recruiter: { classic: ['pages', 'view', 'search', 'menu', 'guide', 'resume'], universe: ['panel', 'view', 'search', 'menu', 'guide', 'resume'] }`, `player: ['view', 'search', 'menu', 'resume']` (the map's own stops belong to Flying). `planFor` drops the view tour's `hello` and `done`; an audience `hello` in `chapters/shared.js` opens every audience tour ("Five minutes, eight chapters. Esc stops it; it remembers where you were.").
- A14. **`addVisited(list, key)`** takes a key already normalised by the caller; `App.jsx` passes `guideKeyFor(pathname) ?? pathname`. `src/lib` imports nothing from `src/components`.
- A15. **The catalogue's `done`** has a third kind, `{ key, is }` for the shell's own localStorage keys (checked against a `SHELL_KEYS` list in `src/lib/visited.js`), and `null` (no tick; Show me only). A `visited` route carries no hash. No row needs a password, a ROM, someone else online or a first-visit flag; the Minecraft and Mario rows are the tributes; nothing under `/dickansh`. The example row's done is `{ visited: '/projects/gameboy-emulator' }`; the `player` achievement belongs to the home Game Boy row.
- A16. **`openGuide({ tab })`** dispatches a CustomEvent; `Guide` passes `initialTab` to the panel; the checklist tab is `'checklist'`; ⌘K "Open the checklist"; the terminal's `checklist`. Inside a world, "Show me" goes to `to` when it is in this world, else reads "Leave <world> and show me".
- A17. **The site tab's "The worlds" list goes**; the checklist's world groups carry the links.
- A18. **Heavy chapters.** `WORLD_MB['/universe']` is measured at phone size and added; on a coarse pointer a chapter with `heavy: true` shows its `phone` version.
- A19. Route tests match `to` against `App.jsx`'s `path="…"` patterns with `matchPath` (after stripping `?` and `#`), never by string equality.

**Content (B)**

- B1. Player chapter 2 "Flying" is `{ id: 'flying', path: '/universe', brief: '/universe/fly' }`: no hand-written copy; the flying keys are written once.
- B2. Chapter 3's subject is the galaxy and the Death Star; chapter 4 has one card per `WORLDS` entry except `/galaxy` and `/deathstar` (13 today; test: every `WORLDS.to` appears exactly once across chapters 3 and 4). A card's first sentence is `PAGES[key].about` for the world's guide key, and `briefs.js`'s `hello` reads the same constant; `pages.test.js` asserts every `BRIEFED` key has an `about` (B writes the missing ones once). On a coarse pointer a card says the size whenever `WORLD_MB[to] > 1` (text is a function of `ctx`).
- B3. No achievements stop; chapter 7 folds into the checklist chapter: a card at `/universe` naming the count, with an action `{ label: 'See yours', to: '/terminal' }`.
- B4. The hiring tour: home order is `home-open` → `home-gameboy` → `home-github`; experience is `experience-roles` (the title) → `experience-track`, no "own address" stop; projects is `projects-featured` (the four, "each opens with a live demo") → `projects-table`, the cartridges only with `wait: true` on `.cartridges[data-on]` and never on touch; contact is `contact-copy` → `contact-form`; chapter 7 "Under the hood" is `heavy: true` with a `phone` version told from `/changes` (`changes-log`) and `/terminal` (`terminal-input`) with an action "Open the universe map · N MB". The end card's actions: Download the PDF (primary), Email me, LinkedIn, "Take the player's tour" (`tour: 'player'`). `travel-globe` is not a target (no stop uses it).
- B5. Budget: words ÷ 3 per second + 4 s a stop + 3 s a chapter change, on stored chapters plus a shell allowance (5 stops, 60 words); the test prints the total. Hiring under 5 min at about 16 stops of 12–30 words; player under 8 min with world cards under 25 words; whole under 12.
- B6. End chapters carry `path: null`. The `ships` stop's text reads from `ctx.ship` ("Your ship" / "Pick a ship").

**Shell and universe UI (C)**

- C1. The `kbd-styles` metric walks `src/**/*.css` itself (the health context lists no CSS), excludes `src/runtime/hud/hud.css` until D's rule is deleted, and is budgeted only after both C's `.kbd` and D's deletion have merged.
- C2. Glossary rows added: "The checklist" (the guide's site-wide tab) and "Things to do (`M`)" (a world's own list); and "The way out of a world" reads `viewOf(pathname, readStart())`: "Universe map" or "Classic site".
- C3. The visitor-facing names: "the hiring tour", "the player's tour", "the whole tour"; the offer's buttons "To hire", "To play", "Both" (revised 2026-10-18 from "I'm hiring", "I'm here to play": `docs/decisions/2026-10-18-one-question-on-arrival.md`).

**World HUD kit (D)**

- D1. Kit components take resolved props only: `Bubble({ voice, name, line })` (the town wrapper passes `personVoice(who)`), `PlayersChip({ count })`, `Menu` opens the guide through `openGuide` from `src/lib/palette.js`, never `GuideLink`. `src/runtime` imports nothing from `src/components`.
- D2. `hud.js` keeps Invincible's signatures (`titleMode(t, movedAt, objectiveOn)`, `objectiveText(step, dist)`, `markerSize(dist, height)`) so its tests move verbatim.
- D3. The Shire's file is `src/components/middleearth/shire/shire.css` (the hand sum at line 99).
- D4. The Menu's way out reads the view (C2).
