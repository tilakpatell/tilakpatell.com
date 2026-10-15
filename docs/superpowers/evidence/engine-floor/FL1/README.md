# Lane FL1: the sweep

The design’s §1.6 and §4.7; the plan `docs/superpowers/plans/2026-10-15-engine-floor-laneFL1-sweep.md`. Read in the cloud container on 2026-10-15, on `claude/engine-floor-fl1-sweep`.

## The nine scripts

Deleted in one commit (`Nine scripts nothing names, gone`), each grepped again across `package.json`, `.github`, `docs`, `scripts`, `.claude`, `src` and `index.html` first: only the design and this plan named them. The commit’s body holds each one’s last three commits. 1,008 lines.

## The exports no other file names

| | rows | files |
| --- | ---: | ---: |
| before (`unused-exports-before.txt`, and the scan re-run on this branch’s start) | 531 | 324 |
| after (`unused-exports-after.txt`) | 87 | 50 |

Of the 444 gone, 408 were names their own file reads (the `export` keyword dropped) and 38 were read by nothing at all (the declaration cut, with what only it used: a dead import, a dead helper, the header line that listed it). One commit a folder (`Sweep: <folder>, N exports nobody reads`), each folder’s tests run after it, `npm test` and `npm run lint` over the lot. Each row was read before the cut; how:

- the scan already counts a name any other file mentions (code, tests, docs, skills), so a DEV hook, a fixture or a doc that quotes a name keeps it;
- a file another file reaches as a whole (an `import * as ns` that is spread, walked or passed on, a dynamic `import()` or `import.meta.glob` whose module is indexed by a runtime name) was read by hand: `scripts/health/*.mjs` (only `default` is taken), `scripts/ultra/*` (named `BUILDINGS`), `src/stages/*.jsx` (`pick(loader, name)` takes names written in `stages/index.js`, so the four stages it never names were dead and went) are not, the exceptions below are.

`unused-exports-after.txt` was taken before this README was written: the scan counts a name a doc mentions, so run on this tree it now reads lower than 87.

### The exceptions (87)

**A file another open pull request owns** (the hand-off’s “What the other work must know”: `components/battlefront/` and `components/galaxy/surface/level/` for #1000 to #1004, `src/runtime/` for #993, `src/lib/battlefront/rulebook.js` and `src/lib/bf2017/ui/` touched in their imports only, `src/data/` the game’s), 45 rows:

  - `src/components/battlefront/assets.js`: BACKENDS
  - `src/components/battlefront/backdrop/host.js`: roomState
  - `src/components/battlefront/battle.js`: BACK_TO_DEPLOY, KILL_LOG
  - `src/components/battlefront/figures/figures.js`: bodyUrl
  - `src/components/battlefront/figures/locomotion.js`: STRIDE_MATCH, STRIDES_MAX
  - `src/components/battlefront/fx/kit.js`: MAX_GRENADES, MAX_BLASTS
  - `src/components/battlefront/hud/icons.js`: ICON_BASE
  - `src/components/battlefront/hud/widgets.js`: MARKER_SCALE, KILL_LOG_ROWS, KILL_LOG_SHOWN
  - `src/components/battlefront/map/ground.js`: FAR_STEP, PATCH_STEP, MASK_ORDER, holeMaskNode
  - `src/components/battlefront/module.js`: PLAYER_TEAM
  - `src/components/battlefront/screens/cards.js`: SITE_LEVEL
  - `src/components/battlefront/screens/useTree.js`: useViewport
  - `src/components/battlefront/sound/director.js`: WALKER_VO_GAP, ABILITY_EARSHOT
  - `src/components/battlefront/sound/mix.js`: HIFI, TOP_SPEED, WINDOW_FLOOR, RELEASE_DB_PER_S, TOP_RELEASE, TENSION_METER, HIGH_METER, LAST_TICKETS
  - `src/components/galaxy/surface/level/levelGltf.js`: COLOUR_SLOTS, isKtx2
  - `src/components/galaxy/surface/level/occlusion.js`: KEEP_NEAR
  - `src/data/bf2017/strokes/index.js`: STROKE_TABLES
  - `src/data/roles.js`: parseMonth, careerStats
  - `src/lib/bf2017/ui/info.js`: MODE_IDS
  - `src/lib/bf2017/ui/screens.js`: WIDGETS_IN_SCREENS, hintsFor
  - `src/lib/bf2017/ui/shapes.js`: composeShapes
  - `src/runtime/cadence.js`: FPS_KEY
  - `src/runtime/dynres.js`: DYNRES_30, FLOOR_T0, PAUSE_MS
  - `src/runtime/install.js`: PERSIST_KEY
**A file an open pull request changes** (#912, #968, #970, #974, #975, #982, #984, #993, #1000 to #1004, #1006: cut here, they would conflict there; the next sweep takes them once those merge), 33 rows:

  - `scripts/bf2017-data.mjs`: levelPath
  - `scripts/bf2017-terrain-masks.mjs`: TIER_SCALE, tierWidths
  - `scripts/lib/bf2017-rulebook-collection.mjs`: META, metaRows
  - `scripts/lib/bf2017-rulebook-look.mjs`: ELEMENT_TYPES, HUD_FONTS
  - `scripts/lib/bf2017-rulebook-spawnlogic.mjs`: GA_PREFAB
  - `scripts/lib/bf2017-rulebook.mjs`: MAP_CODES, mapCode
  - `src/components/galaxy/surface/ground/groundFigures.js`: GROUND_BODY
  - `src/components/worlds/looks.js`: ARTS, MIN_APART
  - `src/lib/battlefront/ai/commander.js`: HOLD_RADIUS, ESCORT_RADIUS, COUNTER_RADIUS, THREAT
  - `src/lib/battlefront/kit.js`: BOT_BINOCULARS
  - `src/lib/battlefront/sim.js`: WALKER_BODY, squadSpot
  - `src/lib/three/light/apply.js`: WEATHER_FADE
  - `src/lib/three/light/entry.js`: MIE_G, SKY_TO_SUN
  - `src/lib/three/light/passes.js`: MRT_RG
  - `src/lib/three/light/placed.js`: CULL_AREA, FADE_AREA
  - `src/lib/three/light/post.js`: MOTION_SAMPLES, FSR_SHARPNESS, UPSCALERS
  - `src/lib/three/light/probes.js`: BAKE_BUDGET
  - `src/lib/three/light/volumetrics.js`: VOLUME_GAIN, UPSAMPLE
  - `src/runtime/webgpu.js`: buildLitPost
**Read through a namespace, whole**, 7 rows: the four modes’ constants are spread into the mode table (`modes/index.js`: `{ ...extraction, create: … }`), so they travel with the mode; `groundmapNodes.js` and `windNodes.js` are handed whole to the twin-parity cases (`scripts/twin-parity/cases.js`: `pair(…, [LN, MN])`), which look a function up by its name.

  - `src/lib/battlefront/modes/ewokHunt.js`: EXTRACT_RADIUS
  - `src/lib/battlefront/modes/extraction.js`: CHECKPOINT_SECONDS, CHECKPOINT_RADIUS
  - `src/lib/battlefront/modes/strike.js`: ROUND_PAUSE
  - `src/lib/battlefront/modes/supremacy.js`: CAPTURE_DURATION
  - `src/lib/three/groundmapNodes.js`: groundFns
  - `src/lib/three/windNodes.js`: windFns

**A documented switch**, 2 rows: `src/components/galaxy/surface/missions/starfighterPilots.js`’s `hasSquadron` and `loadMinds`, the header’s named way to the bots lane’s squadron trees (`src/lib/battlefront/ai/squadron.js`, now on main); the mission that takes them is the bots lane’s to write, so they stay rather than be written again.

`knip` was not run (the container’s memory; the plan’s Task 2 step 6): the scan above is its stand-in.

## The records out of the chunks

`scripts/data-slice.mjs` (the plugin, after `library-slice.mjs`) and `scripts/lib/data-slice.mjs` (the rule, tested). Every reader of every record takes `.rows` and hands it on (`rulebook.js`: `ai: ai.rows`; `ui/index.js` and `screens.js`: `const ROWS = X.rows`), so no slice below the whole record is provable: each record is whole, and in the client build is fetched as JSON behind a top-level await. The test holds `RECORDS` to the readers on disk (a reader that starts reading only some keys turns its row’s `whole` false, and the slice is served).

Two findings changed the plan:

1. **The three named records were not enough for the gate.** With `ai.json` and `screens.json` out, `instantAction` was 1,693,496 B: the rulebook’s other records are in it too. The ten only the rulebook imports joined (Hoth’s map and lighting, weapons, cards, abilities, kits, teams, vehicles, arcade, reinforcements); the seven the galaxy imports itself (strings, points, classes, heroes, modes, cameras, squads) stay JSON imports, since served as well they would be in two chunks (a test checks no record is imported as JSON by shipping code).
2. **`ui.json` stays inline.** It was never in `instantAction`: it sits in the `shapes` chunk every world with a HUD loads (`src/runtime/hud/Reticle.jsx` → `lib/bf2017/ui/shapes.js` → `ui/index.js`’s `css` → the widget trees). A fetch there would hold every world’s start on 389 KB of Battlefront’s UI. Its row says `fetch: false`; it flips once `css` (the palette) no longer comes from the module that reads the widget trees, a change in `ui/index.js` (imports-only here) and `runtime/hud/` (#993’s).

All the fetched requests are made at once, from one module (`\0bf2017-records`) the first of them to run imports: rolldown joins a chunk’s modules into one scope, so an await in each queued them one behind another (seen in the first build: `ai` waited on its chunk, `screens` on the front end’s).

### The chunks (`npm run build`; `node docs/superpowers/evidence/engine-floor/tools/chunks.mjs`)

| chunk | before | after | gate |
| --- | ---: | ---: | --- |
| `instantAction` | 2,223,666 B | 529,346 B | under 600 KB: holds |
| `FrontEnd` | 859,669 B | 104,029 B | under 300 KB: holds |
| `shapes` (the HUD’s, with `ui.json`) | 548,733 B | 513,293 B | |

2,453,044 B of JSON (twelve records) now load as `dist/assets/*.json`, listed as the `instantAction` chunk’s assets in the manifest, so the galaxy’s offline pack (`scripts/packs.mjs`) carries them. `client-json-kb` is FL0’s and has not landed: the bytes are the line above.

### The first screen

`scripts/perf-probe.mjs battlefront` (QUALITY=low, BASE at `vite preview` of each build, since its own server is dev, where the records are inline either way), ready time: before 51.4 s and 45.4 s, after 42.2 s, 47.1 s and 61.6 s. SwiftShader’s shader links are most of it (the worst load frames are `getProgramParameter`), so the spread is wider than any difference the records could make.

A narrower measure: a cold page importing the Battlefront route (`src/pages/Battlefront.jsx`), then the front end (`screens/FrontEnd.jsx`), twelve runs a build, interleaved, Chromium headless against `vite preview`. Both builds show the same random 1.5 to 2 s stall in either step about one run in two (the container’s CPU); with those runs left out, the medians:

| | route | front end | together |
| --- | ---: | ---: | ---: |
| before | ~870 ms | ~290 ms | ~1,160 ms |
| after | ~940 ms | ~240 ms | ~1,180 ms |

Locally, the same within the noise: the route waits on the requests (made once its chunks have run) and the front end no longer downloads and parses 756 KB. Rolldown already wrote each JSON module as `JSON.parse('…')`, so the parse saving is smaller than the design’s §1.6 supposed. Over a real network the requests add one round trip after the chunks arrive; a `preload` for them in the route’s HTML is the follow-up if the owner’s machines show it.
