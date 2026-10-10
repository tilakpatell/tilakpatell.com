# Battlefront 2017, lane O: the object library, and the worlds without a map. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every placeable object in the drop (architecture, props, landmarks, nature, living world, clouds, the seasons' sets) is in an index the placer can draw from by name; the seven Star Wars worlds with no game map are dressed from it by biome recipe; every world's generic props are the game's where the game has the same thing; the sky's clouds are the game's cloud meshes on high and ultra.

**Architecture:** An index (`src/data/bf2017/library.json`) from the manifest and the data's blueprint tags; a catalogue group whose rows are made on demand (`catalog/bf2017-library.js`, `game:<name>` kinds) and imported through the existing kit and import scripts; `GAME_FOR` maps the site's prop kinds to game objects; `flora.js`'s biomes gain game nature sets; each unmapped site's `things`/`scatter`/`flora` rows change.

**Tech Stack:** `scripts/lib/bf2017-manifest.mjs`, `scripts/bf2017-import.mjs` (`--native`, `--far`), `scripts/bf2017-kit.mjs`, `scripts/assets-publish.mjs`, `src/components/galaxy/surface/catalog/index.js` (`GROUPS`, `modelUrlFor`), `placer.js` (`kit:<pack>/<Name>` hook), `flora.js`, `surface/sky.js`, `sites/{nevarro,coruscant,edge,outer}.js` and the Mandalorian, Dagobah, Mustafar, Sorgan, Lothal sites (`grep -n "dagobah\|mustafar\|sorgan\|lothal\|mandalore" sites/*.js`), Vitest, `galaxy-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§3 lane O).

## Global Constraints

- The era rule in the index: `isSequel` rows absent, and the sets `takodana`, `jakku`, `jak`, `starkiller`, `crait`, `firstorder`, `resistance`, `paintball` absent by set name too.
- The native rule and the caps for every imported object (plain 16 MB, light 5 MB; `--far` for anything scattered); a scattered kind's light cut at `--lod1-tex 512 --lod1-maps 256`.
- The budgets' rows unmoved: each dressed world passes `BUDGET=1` at four tiers, before and after in the PR.
- A recipe uses sets by world and biome as the spec names them; no sequel set.
- Credits written by the import; the Meshy and Sketchfab rows `GAME_FOR` replaces go with their credits in the same commit.
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines.

## Review Focus

1. **A `game:` kind whose import has not run** (a row in the index, no cut on disk or in the manifest): the placer must draw nothing and say so once, never throw (task 2's test with an index row and an empty manifest).
2. **A prop kind `GAME_FOR` maps on a world at low**: the site's own model, not the game's heavier cut (task 3's test on `modelFor(kind, 'low')`).
3. **A recipe set that has no row in the index** (a typo, a set the era rule removed): `flora.js`'s rows must skip it and the sites test must name it (task 4).
4. **A cloud mesh on a world with no `clouds` row** draws nothing (task 5).
5. **A living-world creature with a skeleton** stays rigid until lane A's pack exists: the index row says `rig` and the placer refuses rigged models as it does today (task 6).

---

### Task 1: The index

**Files:**
- Create: `scripts/bf2017-library.mjs`, `scripts/lib/bf2017-library.mjs`, `src/data/bf2017/library.json`
- Test: `scripts/lib/bf2017-library.test.mjs` (fixture: `scripts/fixtures/bf2017/web/models.jsonl` plus thirty rows across the sets)

**Interfaces:**
- Produces: `indexRows(manifest, { tags }) → [{ name, set, biome, kind: 'architecture' | 'prop' | 'landmark' | 'nature' | 'life' | 'cloud' | 'frontend', size: 'small' | 'medium' | 'large' | 'huge' (the manifest box's longest side: < 1, < 4, < 16, else), tris, lods, rig: bool, tags: [word] }]`; `setOf(name)`, `biomeOf(name)` (the folder words: `arctic`, `desert`, `forest`, `volcanic`, `beach`, `valley`, `yavin`…); `tagsOf(name, blueprintTags)`; the script writes the JSON sorted by name, and `--count` prints rows by kind and set.

- [ ] **Step 1: Failing tests**: a kamino architecture row → `{ kind: 'architecture', set: 'kamino', size }`; `objects/nature/volcanic/x` → `biome: 'volcanic'`; `s9/paintball/...` and `objects/architecture/takodana/...` absent; `levels/clouds/clouds_03/x` → `kind: 'cloud'`; `objects/livingworld/geejaw_01/geejaw_01_mesh` → `kind: 'life'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; run on the bucket's manifest (`node scripts/bf2017-fetch.mjs manifest` first) and commit the JSON (about 9,000 rows, under 2 MB; gzip if over). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The drop's placeable objects, indexed by set, biome, size and kind`.

### Task 2: The catalogue group and the on-demand import

**Files:**
- Create: `src/components/galaxy/surface/catalog/bf2017-library.js` (`gameKind(name) → 'game:' + name`; `rowFor(name, index, manifest) → row | null` in `SURFACE_MODELS`' shape (`url`, `lodUrl`, `farUrl`, `size`, `credit`) when the cuts are published, else null), `scripts/bf2017-library-import.mjs` (`node scripts/bf2017-library-import.mjs <name>[,<name>…] | --set <set> | --world <id>`: fetches, runs `bf2017-import.mjs --native --far --as <from the index's tags>` into `public/models/galaxy/surface/game/<slug>.glb` with `.lod1` and `.far`, publishes, writes the credit)
- Modify: `catalog/index.js` (`GROUPS.library2017` from `bf2017-library.js`, last; `modelUrlFor` unchanged), `placer.js` (a spec whose `model` is `game:<name>` resolves through `rowFor`; null → nothing drawn, said once)
- Test: `catalog/bf2017-library.test.js` (Review Focus 1), `catalog/catalog.test.js` (the group's rows pass the size checks through the manifest)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Any of the drop's objects placeable by name, imported on demand`.

### Task 3: The site's props, the game's

**Files:**
- Create: `scripts/lib/bf2017-game-for.mjs` (`GAME_FOR: { [site kind]: name }` for crate, console, barrier, lamp, pipe, generator, vaporator, table, bench, antenna, cargo, fuelcell, tent, banner, and every landmark kind the sites place that the drop has (read `catalog/common.js` and `fill.js` for the kinds); `modelFor(kind, level) → 'game:<name>' | kind` (the game's on mid and up))
- Modify: `placer.js` (`modelFor` applied to a spec's kind before the catalogue lookup), the catalogue files whose rows are replaced (removed with their credits), `public/games/credits.json` / `modelCredits.json` as the import writes
- Test: `scripts/lib/bf2017-game-for.test.mjs` (Review Focus 2; every `GAME_FOR` value is in the index)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement**; `node scripts/bf2017-library-import.mjs` on every `GAME_FOR` value; publish. **Step 4: Run** → PASS; `galaxy-check surface hoth` and `tatooine` with `BUDGET=1` at four tiers.
- [ ] **Step 5: Commit** `The worlds' crates, consoles, lamps and landmarks are the game's`.

### Task 4: The seven worlds dressed

**Files:**
- Modify: `flora.js` (`BIOMES` gain game sets: `swamp` (forest + kashyyyk roots and fungi, yavin undergrowth), `volcanic` (nature/volcanic, sullust works), `badlands` (desert + vardos ruins), `woods` (forest + naboo), `plains-imperial` (imperial + `_galacticempire`), `city` (naboo + `_galacticrepublic` + bespin facades); each a list of `game:` names from the index with shares and scales), the seven sites (`flora.biome`, `things` rows for the recipe's architecture, `scatter` rows for the props), `sites.test.js`
- Test: `flora.test.js` (Review Focus 3: a biome naming a missing set → skipped and reported by `floraNames`), `sites.test.js` (each of the seven has a game recipe)

- [ ] **Step 1: Failing tests.** **Step 2: Run** → FAIL. **Step 3: Implement**; import the recipes' sets (`--set`); publish. **Step 4: Run** → PASS; `galaxy-check surface <each>` at four tiers; shots before and after in `docs/superpowers/evidence/bf2017-library/<world>/`.
- [ ] **Step 5: Commit** one a world: `Dagobah's swamp from the game's forests`, `Mustafar's works from Sullust's`, `Nevarro from the game's desert and ruins`, `Mandalore's ruins`, `Sorgan's woods`, `Lothal under the Empire's towers`, `Coruscant's upper city from Theed and Cloud City`.

### Task 5: The clouds

**Files:**
- Modify: `surface/sky.js` (`clouds.game: true` draws `levels/clouds` meshes through `rowFor` on high and ultra, the sheet from `textures/levels/clouds`, moving at `clouds.speed`; off below high), `sites/{bespin,core,ice,forest}.js` and the Scarif site (`clouds.game: true`)
- Test: `surface/sky.test.js` (Review Focus 4; `clouds.game` on low → no mesh)

- [ ] Failing test → FAIL → implement, import `levels/clouds` (`--set clouds`) → PASS; shots. Commit `The sky's clouds are the game's`.

### Task 6: The living world

**Files:**
- Modify: the sites by biome (`scatter` rows for the 67 living-world creatures where their biome is: crabs and fish on Scarif's and Kamino's shores, geejaws and whisperbirds in Yavin's and Endor's trees, sand skitters and rockmites on Tatooine, spiders in Kashyyyk, lanternbirds on Sorgan, iguanas on Nevarro), `placer.js` (nothing: a rigged row is refused as today; lane A gives the rigged ones clips)
- Test: `sites.test.js` (Review Focus 5: a `game:` row with `rig: true` is not in any `scatter` until its clip pack exists)

- [ ] Failing test → FAIL → implement → PASS; commit `The small creatures of the living world, where their biome is`.

### Task 7: The hand-off and the PR

- [ ] `HANDOFF-bf2017.md`'s fifth-design table: O's rows, the index's counts, which sets were imported, the seven worlds' before and after tables; the ledger refreshed.
- [ ] `npm run lint`, `npm test`, `npx vite build`; merge `origin/main`; PR titled `The drop's object library: every set indexed, the mapless worlds dressed from it, the props and clouds the game's`.
