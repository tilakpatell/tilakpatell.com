# Battlefront 2017, lane M: the films, the front end, the fonts, the icons, the strings and the UI. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The 32 planet films play on the galaxy's system cards and loading veils; the 50 campaign cinematics are the mission briefings of the worlds they are set on; the UI tiles, tutorials and logo are ready for the Battlefront world; `MT_Volcano2` flows on Mustafar; the open-licence fonts, the 702 icons, the 19,482 strings and the UI bitmaps are the site's through `src/lib/bf2017/`; the Frontend stage stands behind the loadout.

**Architecture:** One script cuts and publishes (`scripts/bf2017-ui.mjs`); four small libraries expose them by the game's names (`src/lib/bf2017/{films,icons,strings,fonts}.js`) plus the HUD widget definitions (`src/lib/bf2017/ui/`); the galaxy's screens consume them in four places (the system panel, the surface veil, the mission page, the loadout).

**Tech Stack:** `scripts/bf2017-fetch.mjs` (`web` and `--raw` forms), `scripts/assets-publish.mjs` (`--files` for non-model files, or a `KINDS` entry for `ui/bf2017` and `films/bf2017`: say which), `src/data/bf2017/ui.json` and `strings.json` (lane 0), `src/components/galaxy/{GalaxyPanel,GalaxyIntro}.jsx`, `src/pages/{GalaxyMission,GalaxySurface}.jsx`, the loadout (`grep -rn "Outfit" src/components/galaxy | head`), `scripts/bf2017-level.mjs` (E0; for the Frontend stage pack), Vitest, the React tests.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane M; §8 A5).

## Global Constraints

- The era rule on films (M1TAK, M4JAK, M5STA, the Crait, D'Qar, Jakku, Starkiller, Takodana, Resurgent, Paintball planet films out), icons and bitmaps (by name), strings (kept whole: a string is text, not a model; a sequel name is shown only when a sequel thing asks, which none does).
- The fonts: all 23 ship under `public/fonts/bf2017/` (the owner holds the licence for everything in the drop, said 2026-10-10), used where the game uses them: Univers condensed for the HUD, RaxusPrime for the numerals, Aurebesh for signage; `fontAllowed` is not a gate.
- A film is published as the drop's WebM, untouched (no re-encode), with a poster frame (`ffmpeg -ss 1 -frames:v 1` as WebP, 640 wide) committed; films load only when their card or veil is on screen, muted, and never on a saver connection (`lowData`).
- Nothing raw reaches a visitor except through the published bucket; every file credited (`public/games/credits.json`: `bf2017-ui`, `bf2017-films`).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A system with no film** (nevarro…): `filmFor(system)` → null and the card shows its still, no broken `<video>` (task 2's test).
2. **A film on a saver connection** or with `prefers-reduced-motion`: the poster only (task 2).
3. **An icon name the sprite lacks**: `icon(name)` → null and the HUD draws its own glyph (task 4).
4. **A string key with a `{placeholder}`** (`{0}`, `%s`): `text(key, args)` fills it; a missing key → the key itself, never undefined (task 5).
5. **The loadout's stage on low**: no pack, the flat backdrop as today (task 6).

---

### Task 1: The cut and the publish

- Create: `scripts/bf2017-ui.mjs` (`node scripts/bf2017-ui.mjs films|icons|fonts|strings|bitmaps|all [--dry]`: fetches `web/movies/**`, `web/svg/**`, `web/fonts/*`, `web/strings/*`, `web/textures/ui/**` through the fetch's `web` form; films → `public/films/bf2017/<slug>.webm` (published) + `<slug>.webp` poster (committed); icons → `public/ui/bf2017/<family>.svg` sprites (`<symbol id>` per icon, families by the SVG folders' names) committed; fonts → `public/fonts/bf2017/` with licences; strings → `src/data/bf2017/strings.json` `{ [key]: text }` (lane 0's file extended, its 69 kept); bitmaps → `public/ui/bf2017/bitmaps/<name>.webp` at the widget's size), `scripts/lib/bf2017-ui.mjs` (pure: `filmRows(misc) → [{ slug, path, kind: 'planet' | 'campaign' | 'tile' | 'tutorial' | 'logo' | 'fx', system?, level?, loop }]`, `isSequelFilm`, `spriteOf(svgs)`, `fontAllowed(name)`)
- Test: `scripts/lib/bf2017-ui.test.mjs` (`filmRows` on the fixture `misc.jsonl`: `Planet_Hoth_01` → `{ kind: 'planet', system: 'hoth' }`, `A1_M1END_DS01_S0100_FMV` → `{ kind: 'campaign', level: 'endor' }`, `Planet_Jakku_01` absent; the 23 fonts all listed by `fontRows(misc)`)
- [ ] Failing tests → FAIL → implement; run `all`; publish → PASS. Commit `The game's films, icons, fonts, strings and UI art, cut and published`.

### Task 2: The films on the galaxy

- Create: `src/lib/bf2017/films.js` (`FILMS` from a generated `src/data/bf2017/films.json`; `filmFor({ system } | { mission } | { tile }) → { url, poster, loop } | null`; `<Film film onEnd />`: a muted `<video>` with the poster, `playsInline`, `loop` as the row says, nothing on `lowData` or reduced motion)
- Modify: `GalaxyPanel.jsx` (the planet card plays its film), `GalaxySurface.jsx` (the loading veil plays it while the pack streams; the strings' loading tips below it, task 5), `GalaxyMission.jsx` (the briefing: the world's campaign film, skippable; the mission text after)
- Test: `src/lib/bf2017/films.test.js` (Review Focus 1 and 2), `GalaxyPanel.test.jsx` if it exists
- [ ] Failing tests → FAIL → implement → PASS; a shot of the card and the veil. Commit `Each world's film on its card, its veil and its briefing`.

### Task 3: The tiles, the tutorials, the logo and the lava

- Modify: `src/lib/bf2017/films.js` (`tilesFor(mode)`, `tutorials()`, `logo()` for lane 5), `src/components/galaxy/GalaxyPanel.jsx` (the mode tiles where the galaxy has the mode: assault, Heroes vs Villains, skirmish), the Mustafar site and `src/components/galaxy/surface/water.js` (`kind: 'lava'` with `video: 'volcano'` → `MT_Volcano2` as a `VideoTexture` flowing with the lava's uv on high and ultra; the shader's own lava below)
- Test: `films.test.js`, `water.test.js`
- [ ] Failing tests → FAIL → implement → PASS; a shot of Mustafar's rivers. Commit `The menu tiles for the game's world, and Mustafar's lava from the game's film`.

### Task 4: The icons

- Create: `src/lib/bf2017/icons.js` (`icon(name) → { sprite, id } | null`; `ICON_FOR`: the site's HUD glyph names → the game's icon names (abilities, weapons, vehicles, classes, heroes' portraits, map markers))
- Modify: the galaxy HUD (`grep -rln "glyph\|Icon" src/components/galaxy/*.jsx src/components/galaxy/surface/*.jsx | head`), the loadout, the galaxy map's markers: each draws `icon(name)` when not null
- Test: `icons.test.js` (Review Focus 3; every `ICON_FOR` value is in a sprite)
- [ ] Failing tests → FAIL → implement → PASS; shots. Commit `The HUD's, the loadout's and the map's icons are the game's`.

### Task 5: The strings and the fonts

- Create: `src/lib/bf2017/strings.js` (`text(key, args?) → string`; `nameOf(thing)` for a rulebook row by its `_source` name through lane 0's key method), `src/lib/bf2017/fonts.css` (`@font-face` for all 23; `--font-bf-hud: 'Univers Condensed'…`, `--font-bf-num: 'RaxusPrime'`, `--font-aurebesh`)
- Modify: the HUD and loadout labels for game-sourced things (weapons, abilities, vehicles, heroes, planets) through `text`; the veil's loading tips from the strings' `LoadingTip_*` keys; the galaxy's signage decals use `--font-aurebesh` where a decal is text
- Test: `strings.test.js` (Review Focus 4)
- [ ] Failing tests → FAIL → implement → PASS. Commit `The game's own names and tips, in the game's open fonts`.

### Task 6: The UI widgets and the Frontend stage

- Create: `src/lib/bf2017/ui/index.js` (`widget(name) → { bitmaps: [url], layout }` from `ui.json`'s 656 records and the cut bitmaps: lane 5's consumer), the Frontend stage pack (`node scripts/bf2017-level.mjs levels/frontend/frontend --world frontend --spawn --inside`, published; if E0 is not on `main`, a `bf2017-kit.mjs` kit of its 26 objects instead, said in the PR)
- Modify: the loadout's Outfit tab (the hero stands on the stage, lit by the Frontend's VE record through `gameLight`, in its `UI_FrontEnd_*` pose when lane A's set exists, else its idle; on low the flat backdrop)
- Test: `ui/index.test.js`, the loadout's test (Review Focus 5)
- [ ] Failing tests → FAIL → implement → PASS; a shot. Commit `The game's HUD widgets ready for its world, and its hero stage behind the loadout`.

### Task 7: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: M's rows, one line that every font ships under the owner's licence, what lane 5 takes; `HANDOFF-battlefront.md`: lane 5 consumes `src/lib/bf2017/ui/`, `films.js`'s tiles; the ledger refreshed.
- [ ] `npm run lint`, `npm test`, `npx vite build`; merge `origin/main`; PR titled `The game's films, icons, fonts, strings and UI art on the galaxy's screens`.
