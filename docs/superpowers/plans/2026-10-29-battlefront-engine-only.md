# Battlefront is bf2-web's engine: the site's own game goes, Hoth comes back as free roam

The owner, 2026-10-29: "clean up the repo currently for Star Wars galaxy and make it cleaner to cleanly integrate the new
engine and game code". The answers:
- bf2-web stays its own repo. The site keeps consuming its built engine (R2, `cloudflare/play.js`) and holds no engine
  source.
- "We will add the site's Hoth as free roam but remove everything else; Battlefront is the focus."

## What that means here

- **Battlefront is bf2-web's engine.** The site's own Battlefront ground game goes:
  - its code, data, sounds, scripts and checks;
  - the JS port of bf2-web's rules.

  Since #1262 none of it is mounted, and the port was never wired into anything.
- **Hoth's surface comes back as free roam.** That is the galaxy's own level (`galaxy/surface/sites/ice.js`, the Hoth
  level packs), walked and flown with no game on it.
  - Hoth's ground missions stay off: the transport quest, the Battle of Hoth assault, the Heroes vs Villains and Blast
    arenas.
  - The engine comes first: flying into Hoth or landing on it opens the engine, as now. "Free roam" is a button on
    Hoth.
- **The galaxy's own games stay:** flight between planets, the space battles (Hoth's "Evacuation" among them),
  Starfighter Assault, and every other planet's open world as it is. None of them uses the site's Battlefront game.
  The engine and bf2-web's game logic are on Hoth alone for now; they will reach other planets later. Confirmed by the
  owner, 2026-10-29.

## PR 1: the site's Battlefront ground game goes (dead code since #1262)

This PR touches none of the files the open Codex PRs edit (#1267, #1268, #1269: `cloudflare/*`, `wrangler.jsonc`,
`bf2web.yml`, the publisher).

**Delete:**
- **`src/components/battlefront/`**, all but the engine launch: `engine.js` and its test, and `index.js`'s route helpers
  without the `module.js` re-export. That takes:
  - `BattlefrontWorld`, `EngineChoice`, `engine.css`, `module.js`, `battle.js`;
  - camera, input, stage, send, waiting, weather, baseLight, picture, look, assets, wipe;
  - the `hud/`, `screens/`, `map/`, `fx/`, `sound/`, `backdrop/` and `figures/` folders. `figures/facing.js`,
    `held.js` and `fixtures/glb.js` move to the guest-preview scripts that use them.
- **`src/lib/battlefront/`**, all but `ai/creature.js`, `ai/names.js` and `ai/squadron.js`, which the galaxy uses. They
  move to `src/lib/bf2017/ai/`, so `lib/battlefront` goes. The JS port of bf2-web's rules, `bf2web/`, goes with its
  fixtures.
- **Libraries only the game used:**
  - `lib/bf2017/collection.js` and `lib/bf2017/ui/screens.js` (if only its tests use the latter);
  - `lib/land/holes.js`, `lib/three/{clothFallback,skinPrune}.js`, `lib/three/figureRows/`, `lib/three/ground/snow*`;
  - `lib/wasm/navsearch` and the `wasm/navsearch` crate.

  `galaxy/shared/{level,stage}.js` are the re-exports the game borrowed; they go with their test rows.
- **Data:**
  - the `src/data/bf2017` files only the game read: backdrop, classes, collection, gameSettings, held, heroKit,
    trooperKit, squads, sounds, loading, `maps/hoth.stages`, `mods/iao-v2`, screens;
  - the rulebook records `data-slice.mjs` served to `rulebook.js` alone, where no script still reads them.
- **Public:**
  - `public/audio/galaxy/bf2017/`: 352 mp3, 13 MB in git;
  - `public/models/galaxy/bf2017/levels/hoth/ga/`, `nav.bin` and `navmesh.bin`, with their manifest rows.
- **Scripts:**
  - the game's browser drivers and checks: `battlefront-check`, `battlefront-balance`, `bf-landing-check`,
    `bf-ui-shots`, `bf2017-abilities-check`, `bf2017-sound-check`, `bf2017-walk-check`, `bf2017-menus-profile`,
    `x2-profile`;
  - `bf2-dev.mjs` and its `vite.config.js` hooks;
  - the nav scripts;
  - the game-only data producers: held, sounds, level-mode, mods, arcade, and the rulebook cards, collection,
    settings and squads steps. `bf2017-data.mjs` is edited to drop their calls;
  - `bf2web-golden` and `lib/bf2web-scenarios`.

**Edit the rows that name the game:**
- `galaxy-check`'s battlefront mode;
- `perf-routes`, `perf-probe`, `reference-frames`;
- `worlds/looks.js`, `worlds/worlds.js` (the 13 MB sound budget), `guide/pages.js` (the game's controls);
- `Galaxy.jsx`'s prefetch of the game's screens;
- the arena globs in `vite.config.js` and `vitest.ai.config.js`;
- `rulebook.test.js`'s file list;
- `ci.yml`'s `wasm-check` (navsearch).

`bf2web.yml`'s vitest path is left to the Codex PRs.

**Keep:**
- the bf2017 pipeline that feeds the galaxy's levels, sky, textures, physics and the rulebooks the galaxy reads;
- `public/battlefront/icons`;
- `galaxy/surface/catalog/{battlefront,bf2017-frontend}.js` and `scripts/battlefront-import.mjs`.

**Docs:**
- The old game's decisions (2026-10-10 to 2026-10-14) are marked superseded by
  `2026-10-28-hoth-on-bf2-web.md`, not deleted.
- `HANDOFF-battlefront.md` becomes the engine's hand-off.
- `docs/architecture.md`, `docs/README.md`, `README.md` and the decisions index are updated.
- `2026-10-28-hoth-on-bf2-web.md` no longer says "its rules under the fallback".

**Checks:** lint, `npm test`, `npm run build`, health; `galaxy-check` on two other planets' surfaces and in flight; no
route reaches a deleted file.

## PR 2: Hoth's free roam, on a button

- `/galaxy/hoth/surface` draws Hoth again. `GalaxyLanding.jsx`'s redirect goes.
- **The engine comes first.** Flying into Hoth or landing on it still opens the engine (`gameLevels.js`'s
  `GAME_MENU`, `Galaxy.jsx`'s `wayDown`).
  - Hoth's panel (`GalaxyPanel.jsx`, which omits "Free roam" for Hoth today) and its briefing (`GalaxyMission.jsx`)
    offer "Free roam", which goes to `/galaxy/hoth/surface`.
  - The surface's own menu offers "Play Battlefront", which goes back to the engine.
- **Free roam only.**
  - Hoth's transport quest, its Battle of Hoth assault and its Heroes vs Villains and Blast arenas stay withheld
    (`systems.js` and `missions/*`, as they are today), with the reason renamed from "the engine plays Hoth" to "free
    roam".
  - The other planets are untouched.
- The nightly `worlds.yml` Hoth surface check lands on a surface again.
- Tests: `gameLevels`, `modes`, the landing.

## PR 3: one way in for the engine (after #1267, #1268, #1269 merge)

- **Which planets the engine plays comes from the build.** `play.json` gains `levels` and `modes`, read from the
  build's `play-config.json` as the adopt step writes it.
  - The galaxy's `GAME_MENU` is made from them, so a planet shows "Play Battlefront" when the live build lists its
    level.
  - When bf2-web adds Endor, the site lights it up with no code change.
- **One list of the engine's files** in its hand-off, as one table:
  - `components/battlefront/{engine,index}.js`;
  - `lib/bf2web/`;
  - `data/bf2web/play.json`;
  - `cloudflare/{play,playReturn,playTimers,engineCache,source}.js`;
  - `scripts/bf2web-*` and `lib/bf2web-site.mjs`;
  - `bf2web.yml`.

  No moves while other sessions are editing them.
- `/battlefront` with no level, and the way back with no world, go to the galaxy, not into the engine again (this
  joins #1267's fix, without overlapping it).
  - Done by #1267 alone: its way back with no world goes to the site's home, so a bare `/battlefront` opening the
    engine is no loop. `modes` is left out of `play.json` until something reads it (`hoth-a82a3be8` lists
    `SkirmishOnslaught`).

## Out of scope

- bf2-web's own changes (the PC list).
- The galaxy's space battles.
- The universe.
- Other planets' surfaces and their ground modes.
