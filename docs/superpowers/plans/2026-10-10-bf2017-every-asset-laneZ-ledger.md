# Battlefront 2017, lane Z: the coverage ledger. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every object in the `bf2017-assets` bucket has one row in a committed ledger that says which site file uses it, which lane owns it, or which rule excludes it, and a check fails when any row is left without one.

**Architecture:** A pure classifier over the bucket's manifests and the site's consumers (`scripts/lib/bf2017-coverage.mjs`), an owners table that is the designs' commitment (`scripts/lib/bf2017-owners.mjs`), a runner that reads the manifests from the bucket or the desktop export and writes `ledger.md` + `ledger.json.gz` (`scripts/bf2017-coverage.mjs`), and `--check`, which CI runs on the committed file with no keys.

**Tech Stack:** Node (`scripts/lib/args.mjs`, `scripts/lib/pool.mjs`, `scripts/bf2017-fetch.mjs`'s `keys`, `getObject`, `listFolder`), `node:zlib`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-every-asset-design.md` (§1, §3 lane Z, §4).

## Global Constraints

- No key is printed or committed; the fetch form takes `SUPABASE_URL` and `BF2017_KEY`/`SUPA_KEY` from the environment as `bf2017-fetch.mjs` does; `--root <dir>` reads a local `web_opt` instead and needs no key.
- The states are exactly `used`, `owned`, `excluded`, `not-uploaded`, `unowned`, decided in that order.
- `data/` is counted by top folder and record type (`data.tsv`'s second column), never one row a record.
- The era rule is `isSequel` from `scripts/lib/bf2017-manifest.mjs`; scaffolding is the list in the spec §6, verbatim in `EXCLUDED_PREFIXES`.
- Files under 800 lines; British spelling and curly quotes in prose; commits one plain sentence with the attribution lines.

## Review Focus

1. **A consumer names a file by a path spelling the manifest does not use** (a `from` with `|lod1`, a lowercased texture, a clip pack's `extras.source` with the `~`→`-` rename): `used` must match by the normalised name (task 1's `normalise` test on the three spellings).
2. **A model used only at one LOD** (a `.lod1` cut) is `used` as a model: the row is the model, its LOD files are its children (task 1: `luke_rotj_01_mesh` with `lod: 2` → `used`).
3. **An `owned` row whose lane's `merged` PR is set** must fail `--check` unless `used` (task 3's test).
4. **A manifest row with no bucket listing row** is `not-uploaded`, never `unowned` (task 2: a texture in `textures.jsonl` and absent from the listing).
5. **The listing's pages** (`listFolder` returns 1,000 a page): the walk must recurse folders and keep going past 1,000 (task 2's fake with 1,001 names).

---

### Task 1: The classifier

**Files:**
- Create: `scripts/lib/bf2017-coverage.mjs`, `scripts/lib/bf2017-owners.mjs`
- Test: `scripts/lib/bf2017-coverage.test.mjs`
- Fixture: `scripts/fixtures/bf2017/coverage/` (`models.jsonl` 20 rows, `anims.jsonl` 20, `textures.jsonl` 20, `physics.jsonl` 5, `terrain.jsonl` 3, `maps-index.json` 4, `misc.jsonl` 10, `data.tsv` 30, `listing.txt` the bucket paths that exist, `consumers.json` the site's names)

**Interfaces:**
- Produces: `normalise(name) → string` (lowercase, `~`→`-`, `.glb`/`.ktx2`/`.png` and `_lod\d` stripped, a `|cut` suffix dropped); `rowsOf(manifests) → [{ id, part, name, files: [path], bytes }]` (parts: `models`, `anims`, `textures`, `physics`, `collision`, `terrain`, `maps`, `maps.lights`, `maps.decals`, `maps.actors`, `maps.vehicles`, `maps.effects`, `scatter`, `animtracks`, `movies`, `fonts`, `svg`, `strings`, `data`); `classify(row, { consumers, listing, owners }) → { state, by }` (`by`: the consumer file, the lane, or the rule); `OWNERS: [{ match: string | RegExp, lane, design, merged?: number }]`; `EXCLUDED_PREFIXES`; `summarise(rows) → { byPart: { [part]: { used, owned, excluded, notUploaded, unowned, bytes } }, byLane: { [lane]: { owned, used } }, totals }`; `ledgerMarkdown(summary, { at }) → string`.

- [ ] **Step 1: Failing tests**: `normalise('web/anims/walrus_humanmale/A_Luke_Strike1~1a2b3c4d.glb')` equals `normalise('a_luke_strike1-1a2b3c4d')`; `rowsOf(fixture).length` is the fixture's object count; `classify` on a model the consumers name → `{ state: 'used', by: 'src/data/galaxyAssets.json' }`; on `characters/hero/kyloren/...` → `excluded`, `by: 'era'`; on `test/...` and `objects/testranges/...` → `excluded`, `by: 'scaffolding'`; on a texture missing from the listing → `not-uploaded`; on `objects/architecture/kamino/x` with `OWNERS` holding `{ match: 'objects/architecture/', lane: 'O', design: 839 }` → `owned`; on a row no table names → `unowned`; `summarise` counts add up to `rows.length`.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/bf2017-coverage.test.mjs` → FAIL.
- [ ] **Step 3: Implement**; `OWNERS` in `bf2017-owners.mjs` holds every lane in the spec §3 and its "What the running lanes own" table (prefixes: `characters/npc/creatures/{dewback,bantha,eopie,ronto,jawa,aiwha}` B; `characters/hero/{yoda,generalgrievous}` Y; `anims/yoda_01_ske`, `anims/generalgrievous_01_ske` Y; `anims/atat_destruction_*` W; `maps.effects` X; `scatter` N; `objects/` O; `levels/space/`, `cinematics/spacebattles`, `objects/props/_battlebeyond`, `animtracks/.*asteroid` Q; `movies/`, `fonts/`, `svg/`, `strings/`, `textures/ui/` M; `anims/` A (last, after the others); `maps`, `terrain`, `physics`, `collision`, `maps.lights`, `maps.decals`, `maps.actors`, `maps.vehicles`, `animtracks/` E; `data/Sound` D; `textures` with no listing row D).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The coverage classifier and the owners table`.

### Task 2: The runner

**Files:**
- Create: `scripts/bf2017-coverage.mjs`
- Test: `scripts/bf2017-coverage.test.mjs` (the runner's pure helpers: `walkListing`, `readConsumers`)

**Interfaces:**
- Consumes: task 1; `keys()`, `getObject`, `listFolder` from `scripts/bf2017-fetch.mjs`; `readManifest` from `scripts/lib/bf2017-manifest.mjs`.
- Produces: `node scripts/bf2017-coverage.mjs [--root <web_opt>] [--out docs/superpowers/evidence/bf2017-coverage] [--check]`; `readConsumers(root) → { names: Set, by: Map<name, file> }` reading `src/data/galaxyAssets.json` (`from`), `src/data/modelCredits.json` (`source` fields naming the drop), every `public/models/galaxy/bf2017/levels/*/level.json` (`meshes`, `tex`), every clip pack GLB's JSON chunk (`extras.source` per animation; committed packs, and published ones through `galaxyAssets.json` fetched read-only from `site-assets`, no key), `src/data/planetSkins.json`, `src/data/bf2017/light/*.json` (probe ids), `src/data/bf2017Fx.js` (its `file` fields), the rulebooks' `_source` leaves under `src/data/bf2017/`, `src/data/bf2017/library.json` when it exists; `walkListing(list, prefix) → [path]` recursing folders, 1,000 a page.

- [ ] **Step 1: Failing tests**: `walkListing` over a fake `list` that answers 1,001 names for `web/x` then one folder → every name once; `readConsumers` on a temp dir with a `galaxyAssets.json` of two rows and a `level.json` of three meshes → five names with their files.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; the runner writes `ledger.json.gz` (`[{ id, part, name, state, by, bytes }]`) and `ledger.md` (the summary table by part, by lane, and the first 200 `unowned` names when any); with `--root` it reads the desktop's `web_opt` and its `upload_state.tsv` as the listing. **Step 4: Run** → PASS.
- [ ] **Step 5: Run it** against the desktop export if this session has it (`--root C:/Users/tilak/Downloads/BF2_Extract/web_opt`), else against the bucket; commit `ledger.md` and `ledger.json.gz` under `docs/superpowers/evidence/bf2017-coverage/` with a `README.md` saying how it was made and the counts.
- [ ] **Step 6: Commit** `The coverage ledger, written from the bucket`.

### Task 3: The gate

**Files:**
- Modify: `scripts/bf2017-coverage.mjs` (`--check`), `package.json` (`"coverage:bf2017": "node scripts/bf2017-coverage.mjs --check"`), `.github/workflows/ci.yml` (one step after the tests: `npm run coverage:bf2017`), `docs/superpowers/HANDOFF-bf2017.md` (the fifth design's status table gains the four counts)
- Test: `scripts/bf2017-coverage.test.mjs` (`checkLedger`)

**Interfaces:**
- Produces: `checkLedger(rows, owners) → { ok, unowned: [name], stale: [{ name, lane, merged }] }`: `ok` false when `unowned.length > 0` or when a row is `owned` by a lane whose `OWNERS` entry has `merged` set.

- [ ] **Step 1: Failing tests**: Review Focus 3 (`owned` by `{ lane: 'K', merged: 825 }` → stale); an all-`used` ledger → `ok: true`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; `--check` reads the committed `ledger.json.gz`, prints the counts and the first twenty offenders, exits 1 when not ok. Set `merged` on the lanes already merged (K 825, L 831, G 833, V 828, F 829, 1 815, 2 832, P0 834, P1 822, P2 820, P4 821, R 827, 0 824, X-sabers 816, H 840) and make the ledger pass: a row those lanes left `unowned` is the design's first finding, written into the hand-off's section, and assigned to the lane of this design that takes it (E, O, Q, M or A), never hidden. **Step 4: Run** → PASS; `npm run coverage:bf2017` green.
- [ ] **Step 5: Commit** `The coverage gate in CI, and the hand-off's counts`.

### Task 4: The PR

- [ ] `npm run lint`, `npm test`, `npx vite build` (not `npm run build`: the prebuild rewrites `public/github.json`); merge `origin/main`; PR titled `The Battlefront drop's coverage ledger: every object used, owned or excluded, checked in CI`; the hand-off's status row for Z with the PR number.
