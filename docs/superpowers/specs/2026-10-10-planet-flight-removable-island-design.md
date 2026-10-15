# The planet flight beside the Battlefront pipeline: kept for now, gone in one move. The design

Date: 2026-10-10. Status: design, written by the architecting session that ran the flight lanes, after reading the Battlefront sessions and the code on `main`. The plan is `docs/superpowers/plans/2026-10-10-flight-island.md` (lane J of `docs/superpowers/HANDOFF-galaxy.md`).

## What the owner asked

“We are revamping the entire asset and models and stuff. Check the new spec based on that. Keep chunk generation and world generation stuff and everything for now, but make it so we can get rid of it. Check in depth first with the other sessions to understand.”

## What the other sessions are doing

The Battlefront II (2017) pipeline (`docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md`, its hand-off `HANDOFF-battlefront.md`) replaces the galaxy’s models with the game’s own, one phase a lane, under one rule: *the game first*. Read from its spec, its plans on `origin/claude/nice-mayer-jqow5k`, and the five sessions running it:

- **Phase 0 (merged, #805)**: the fetch and the import over the private bucket’s manifest; a new catalogue group `catalog/bf2017.js`, last in `GROUPS`, so a kind it names wins over the same kind anywhere else.
- **Phase 1 (running)**: the heroes on the game’s 254-joint rig with their hilts; one shared clip library; `crew.js` learns a `rig: 'walrus'` row.
- **Lane S (running)**: streaming both ways, built on lane I’s asset mirror (#798): the game-derived files are remote-only in the same manifest and bucket, through the same `assetUrl` and `withFallback`.
- **Lane V (running)**: the vehicles in depth, walkers on the game’s rigs, every fighter with its cockpit; the fleets through whichever space roster is on `main`.
- **Lane W (running, Hoth first)**: each galaxy world rebuilt from the game’s modular kits, merged by material, under the game’s own sky and light probe, one world a PR. Its pieces go into `catalog/bf2017-<world>.js` and `lib/three/kit.js`’s keyed pools (lane E’s).
- **Lane F (queued)**: the game’s sprite sheets and effect meshes as the look of the site’s effect systems.
- The bar (spec section 11): the laptop at `high` is the default look, `ultra` for a stronger GPU, both streamed; phones keep `low` and `mid`.

Two things follow for the flight. First, every model the pipeline lands arrives *by kind through the catalogue*, and every kit through `lib/three/kit.js`: a world that resolves its things by kind gets the game’s the day a phase merges, with no change of its own. Second, lane W rebuilds the galaxy’s *walkable* worlds from the game’s level kits; the flight’s endless procedural ground is a different thing and no lane of theirs touches it. The owner’s direction is to keep it for now and be able to drop it whole.

## Where the flight is today

Nine lanes landed it on `main` between 2026-10-09 and 2026-10-10 (#783, #780, #782, #798, #784, #800, #799, #801, #796; lane H, occurrences, is running). What it is, counted from `main` at a6a23b33:

| where | files | lines | what |
| --- | --- | --- | --- |
| `src/components/expanse/flight/` | 62 | 5,000 | the world: the ship, the streamed ground and its worker, life, landmarks, kit clutter, the map, the shared world, the HUD |
| `src/lib/land/flight/` | 27 | 2,284 | pure: the noise, the quadtree, the leaf mesh, the field, the fifty planets’ tables, the life and landmark tables, the map raster |
| `src/lib/durable/` | 7 | 527 | pure: the Supabase client, the entities, the loader |
| `src/lib/net/cells.js` | 2 | | the 2,048 m cell grid, used by the universe’s rooms as well |
| `src/pages/Fly.jsx`, `terrain.worker.js` | | | the page and the worker |
| `supabase/migrations/*` (4), `supabase/seed.sql` | | | the `planets` and `world_entities` schema, RLS, the RPCs, the seed |
| `scripts/supabase-seed.mjs`, `supabase-check.mjs`, `lib/fly-check.mjs`, `lib/fake-durable.mjs`, `conflict-markers.mjs` | | | the flight’s scripts |

And the rows that name it outside those folders, every one of which a removal has to find:

- the route and the page: `src/App.jsx` (the lazy import and `<Route path="/fly/:planet?">`);
- the registries: `worlds/worlds.js` (`WORLD_MB['/fly']`), `worlds/looks.js` (`expanse/flight`), `worlds/packs.js` (the flight’s pack), `universe/universes.js` (the link “Planet flight”), `guide/routes.js`, `guide/pages.js` (`'/fly'`), `guide/abouts.js`, `tour/brief.js`, `tour/briefs.js` (`'/fly'`);
- the checks: `.github/workflows/ci.yml` (the Multiplayer job’s `online-check.mjs --fly` step and its note), `scripts/online-check.mjs` (`--fly`), `scripts/perf-probe.mjs` (the `fly` journey), `scripts/health/art-mix.mjs`, `scripts/stack-census.mjs`;
- the dependency `fastnoise-lite` (`package.json`, `docs/stack/fastnoise-lite.md`, the census row) — `@supabase/supabase-js` is *not* the flight’s alone: lane I’s asset upload and the Battlefront fetch use it, so it stays;
- the docs: three paragraphs of `docs/architecture.md`, `supabase/README.md`’s schema sections, `.env.example`’s flight line, the stack page, the decision entry `2026-10-09-supabase-for-durable-shared-state.md`.

What the flight *borrows*, and should not:

- **From the galaxy’s insides** (fourteen imports, every one a “worlds are islands” break by `scripts/health/boundary-breaks.mjs`): `galaxy/surface/catalog` (`SURFACE_MODELS`, the URL helpers), `placer` (`createPlacer`, `loadModel`, `usesModel`, `clusterSpecs`), `kit` (`createKit`), `figures` (`FIGURES`, `buildFigure`), `galaxy/fleet` (`GALAXY_KINDS`, `buildGalaxyShip`), `sites` (`siteOf`), `terrain` (`makeHeight`), `hostiles` (`sensesFor`, `startBurst`, `stepBurst`, `strafeStep`); and from the universe: `trafficModels` (`BUILT_KINDS`), `hunterRules` (`turnToward`), `online/protocol` (`STALE_MS`, `createLimiter`), `online/names` (`cleanName`).
- **From the Expanse, out of `src/lib`** (eleven “lib knows no page” breaks): `lib/land/flight/planetSpec.js` and `lifeTables.js` import `expanse/gen/seed.js` and `sector.js` to make the thirteen Expanse planets’ specs.

What the flight *gave* the site, which stays whatever happens to it: `lib/land/flats.js` and `layers.js` (the galaxy’s ground uses them: lane A moved them out of `galaxy/surface/terrain.js`, no pixel changed), `lib/three/groundLook.js`, `noiseTex.js`, `splat.js`, `scans.js` (the surfaces’ material), `lib/three/kit.js`’s keyed pools (lane W uses them), the HUD kit’s `MiniMap`, `lib/net/cells.js` and the rooms’ `cells` (the universe’s `nostr.js` reads them), `runtime/chunkGrid.js`, lane I’s asset mirror, the Supabase project itself and its buckets.

## The design

Three moves. Each stands on its own, and together they make the flight a thing the site can lose in one command.

### 1. The galaxy and the universe get a face, and the flight reads only that

`docs/health/RULES.md`: *a world imports another world only through that world’s `index.js` or `shared/` folder*. Today the galaxy has neither, and the flight reaches fourteen things inside it. So:

- `src/components/galaxy/shared/models.js`: what the galaxy lends anyone who draws its things by kind: `SURFACE_MODELS`, `lodUrlFor`, `modelUrlFor`, `wantsLod` (the catalogue), `createPlacer`, `loadModel`, `usesModel`, `clusterSpecs` (the placer), `createKit`, `FIGURES`, `buildFigure`, `GALAXY_KINDS`, `buildGalaxyShip`. Re-exports, no logic, a one-line why each.
- `src/components/galaxy/shared/ground.js`: `siteOf`, `makeHeight`.
- `src/components/galaxy/shared/fight.js`: `sensesFor`, `startBurst`, `stepBurst`, `strafeStep`.
- `src/components/universe/shared/online.js`: `STALE_MS`, `createLimiter`, `cleanName` (the three files the hand-off already allowed “as the towns do”); `universe/shared/flying.js`: `turnToward`, `BUILT_KINDS`.
- The flight’s fourteen imports move to those paths. Nothing else changes. The flight’s “worlds are islands” count goes to zero, and a test under `scripts/health/` holds it there (`boundary-breaks` for files under the three flight folders: 0).

This is the asset seam the owner is revamping behind. A `shared/models.js` export is a *kind*, and `catalog/bf2017*.js` wins by kind: when phase 5 lands the X-wing, lane E’s landmarks and lane G’s patrols draw it; when lane W imports a world’s nature set as a kit, `clutterKitOf` can name it; when phase 2 lands the troopers, `FIGURES` has them. The flight does not need to know, and when the flight goes, `shared/` is still the galaxy’s face for the next world that wants one.

### 2. The pure layer stops reaching up

`lib/land/flight/planetSpec.js` and `lifeTables.js` take the Expanse’s systems as an *argument* instead of importing `expanse/gen`. The composition moves to the component layer, where it belongs: `src/components/expanse/flight/planets.js` builds `PLANETS` from the thirty-seven named worlds (pure tables) and the thirteen Expanse systems (`expanse/gen`, which the universe already imports), and hands each table the rows it needs. `pages/Fly.jsx` and the modules read `PLANETS` from there. The tests keep their fixture of systems (`src/lib/land/flight/fixtures/expanse.json`, written once from `expanse/gen` by a script and pinned). Eleven “lib knows no page” breaks go.

### 3. One script knows the whole island, checks it, and removes it

`scripts/flight-island.mjs`, over a tested pure module `scripts/lib/flight-island.mjs`:

- **The inventory**, in the module, as data: the three folders, the page and the worker, the scripts, the migrations and the seed, the dependency, and every outside row by file and marker. Every outside row carries the comment `// planet flight` (or sits between `// planet flight: begin` and `// planet flight: end` where it is a block, and `# planet flight` in YAML and SQL), so a remover is mechanical and a reader knows why the row is there.
- `--check` (in `npm test`, through its test, and in `node scripts/health.mjs --check`): every file under the island folders is the island’s; every reference to the island from outside (`expanse/flight`, `land/flight`, `lib/durable`, `/fly`, `fastnoise-lite`, `world_entities`, `__FLIGHT__`) is on a marked row or in a doc the inventory lists; nothing outside imports from inside except the page and `packs.js`; the flight imports the galaxy and the universe through `shared/` only. A new unmarked reference fails the check with the line.
- `--remove --dry` prints what it would delete, which rows it would drop, which lines it would leave for a hand (the architecture paragraphs, the stack page’s row, the decision entry to write). `--remove` does it: deletes the folders and files, drops the marked rows, removes `fastnoise-lite` from `package.json` and runs `npm install` and the stack census, writes `supabase/migrations/<date>_drop_planet_flight.sql` (`drop function … get_entities_in_bounding_box, damage_entity; drop table world_entities, planets, entity_hits`, the realtime publication line), prints the owner’s steps (apply the migration; nothing else: the asset buckets are not the flight’s).
- **Proved once, in the lane**: on a scratch branch, `--remove`, then `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` all green, `/galaxy/hoth/surface` and `/universe` smoke green, no `fly` in the build’s chunks; the numbers in `docs/superpowers/evidence/flight-island/`; the branch thrown away. The dry run’s test runs on every push, so the inventory cannot drift from the tree.

### What stays when it goes

Said once here so the remover never takes it: `lib/land/flats.js`, `layers.js`; `lib/three/groundLook.js`, `noiseTex.js`, `splat.js`, `scans.js`, `kit.js`’s pools, `pool.js`, `lod.js`; `runtime/chunkGrid.js`, `runtime/origin.js`; the HUD kit with `MiniMap`; `lib/net/cells.js`, `pool.js`’s `refresh()`, `nostr.js`’s `cells`; `lib/assetBase.js` and the asset mirror; `@supabase/supabase-js` and `docs/stack/supabase.md`; `galaxy/shared/` and `universe/shared/`; the Supabase project, its buckets, its keys; every spec, plan, hand-off, research note and decision entry (docs are history; a removal adds a decision entry, it rewrites none).

### What the flight takes from the pipeline while it lives

Nothing it has to do; this is what falls out of move 1, for the record:

| pipeline phase | the flight gets | through |
| --- | --- | --- |
| 2, troopers and droids | the garrisons’ and settlers’ figures | `shared/models.js`’s `FIGURES` |
| 3, beasts | tauntauns, banthas, dewbacks as the herds’ models | `lifeTables.js` rows naming a catalogue kind |
| 4 and 5, vehicles | the AT-AT at Echo Base, the snowspeeder patrols, Coruscant’s lanes | `GALAXY_KINDS` and the catalogue, by kind |
| 6 to 8, worlds | Echo Base’s hangar, Mos Eisley, Theed as the POIs’ buildings; the game’s nature sets as the clutter | `landmarkTables.js`’s `SITE_PLACES` (the sites’ own places) and `clutterKitOf` naming the imported kit |
| W, skies | a world’s sky and probe | not taken: the flight keeps its shader sky; a later lane could pass `levelSky` the planet’s level |

The flight’s own code-built things (the player’s wedge, the turret, the bolts, `models.js`) are its own and go with it.

## What this design does not do

- Does not move `expanse/gen` into `src/lib` (the universe’s and the flight’s shared seed and sectors). It is the right end, and it is a lane of its own: `sector.js` imports the universe’s `layout` and `regions`.
- Does not add a feature flag: the route is lazy-loaded, so an unmounted route is no bytes for a visitor; hiding the flight is deleting its row, and the script is the switch.
- Does not change what the flight draws, streams, or stores. Lane H (occurrences) runs beside this and keeps its call sites.
- Does not decide when the flight goes: it hands the owner the command and the proof.

## Decisions

1. The flight is kept whole, as an island with a named face, not thinned.
2. A world’s seams are comment-marked rows and `shared/` imports; the island script is the one place that knows them all, tested against the tree.
3. `@supabase/supabase-js` is the site’s, not the flight’s; `fastnoise-lite` is the flight’s.
4. Docs are never deleted by the remover: it adds a decision entry and leaves the history.

## Departures

Where lane J’s code went another way, one line each (the plan’s lines are fixed to match):

- The faces lend two names more than move 1 lists: `PROPS` (`shared/models.js`) and `SITES` (`shared/ground.js`), which the flight’s tests read; the files they come from were already in the flight’s closure, which is unchanged file for file.
- A fifteenth cross-world line the count above missed: `online.js` loaded `universe/online/nostr.js` lazily. It goes through `universe/shared/room.js` (`joinAsVisitor`), still lazily; the build gains a 67-byte chunk and an 88-byte facade for it.
- `planetSpecOf` and `lifeFor` take the Expanse as rows *or a lookup*: the code on `main` flew any sector’s planet by a typed `/fly/e:…` URL, not only the thirteen, so `expanse/flight/planets.js` hands them `expanseRow(id)`. The named worlds’ seed hash (`hash64`, FNV-1a) is copied into `lib/land/flight/hash.js`, `planets.test.js` holding it equal to the generator’s. Row ids are lower case, as `PLANETS`’ always were.
- `scripts/supabase-check.mjs` and `conflict-markers.mjs` are not the flight’s: the asset mirror reads the first’s `projectFrom`, and the second is a check of the whole repository. The durable walk moved out of `supabase-check.mjs` into `scripts/lib/durable-check.mjs`, which is the island’s.
- `scripts/health/art-mix.mjs` names nothing of the flight on `main`, so it carries no marker.
- The stack pages are docs a test holds to the tree (`docs/stack/stack.test.js`), so `docs/stack/supabase.md`’s flight rows are marked (`<!-- planet flight -->`) and go with the flight; the first proof found it. Every other doc is history and is never touched.
- A marked row that uses a name a marked import binds (`packs.js`’s `fly`) counts as a reference, so it is not stale. Lines that named the flight among others were split so a removal drops only its own: `packs.js`’s list, `universes.test.js`’s, `online-check.mjs`’s `own` flag, CI’s log loop (now `*-check.log`).
- The remover deletes itself, its test and its fixture tree with the flight, and the health gate line that runs it.
- Lane H landed first: its `eventPlays.js` reads the galaxy’s weather and lightning through a fourth face, `galaxy/shared/weather.js`; its `occurrences.js` and `eventTables.js` take the Expanse as `lifeTables.js` does (`planets.js`’s `occurrencesOf`, `eventsOf`); `storm-check.mjs` is the island’s. `shared/models.js` also lends the catalogue’s `GROUPS`, the order the game’s groups win by, and the inventory’s `keep` names the Battlefront pipeline’s catalogue groups, models, rigs, sky and the asset manifest, which a removal never deletes or edits.
- The check also fails on a `begin` with no `end` (or the reverse) and on an unmarked row’s code using a name a marked row binds: either would let `--remove` cut too much or leave a dangling name.
