# Durable World Implementation Plan (lane B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The durable layer: the Supabase schema applied and checked, and a client module that loads a planet's entities cell by cell as the view moves, places, removes and damages them, and folds realtime changes in, tested against a fake client.

**Architecture:** `supabase/migrations/20261009000000_world_entities.sql` (already in the repo) is the schema; `scripts/supabase-seed.mjs` writes the 50 planets and the POIs from `planetSpec.js` (lane A's; until it merges, from a local copy of its `PLANETS` table in the script, replaced when A lands); `src/lib/durable/` is the client: one `supabase.js` that makes the client or `null`, a pure `entities.js`, and `entityLoader.js` as the spec's code. No three.js, no React.

**Tech Stack:** `@supabase/supabase-js@^2.117.3` (new), PostGIS, Supabase Realtime, Vitest with a hand-written fake client.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 2, decisions 7 and 8; `docs/decisions/2026-10-09-supabase-for-durable-shared-state.md`)

## Global Constraints

- The stack page `docs/stack/supabase.md` and the census row come before the import; `node scripts/health.mjs --check --skip build` stays green.
- The anon key and URL come from `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only; nothing is read from `localStorage`; no key is printed or committed; `.env.local` is ignored (`.gitignore`).
- `CELL = 2048`; the envelope asked for is exactly one cell; the loader never asks for more than `inFlight = 4` cells at once; `STALE_MS = 20000`.
- `entityToRow` never sends `id`, `owner`, `version`, `created_at`, `updated_at`.
- No model names in code, docs or commits. Commits end with the harness's attribution lines.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **No environment at all** (a fork, a local dev run): `client()` is `null`, the loader answers every call with nothing and emits no error, the game plays. Task 2's null tests.
2. **The RPC fails** (network, a bad envelope): the cell is not marked fetched, is retried on the next `update` past `inFlight`, an `error` event is emitted once per failure. Task 3.
3. **A realtime `UPDATE` for an entity in a cell the loader does not hold**: ignored, no `add`. Task 3.
4. **A cell left and re-entered**: its entities are removed on leaving and fetched afresh (not from a stale map) on return. Task 3.
5. **Placing inside a POI**: the database refuses; the loader returns `null` and emits `error` with `where: 'place'`; nothing is drawn. Task 3 (fake refuses), Task 5 (the real check).

---

### Task 1: The stack page, the dependency, the build's environment

**Files:**
- Create: `docs/stack/supabase.md` (from `_template.md`)
- Modify: `scripts/stack-census.mjs` (`...group('supabase.md', ['@supabase/supabase-js'])`), `package.json` (`npm install @supabase/supabase-js@^2.117.3`), `docs/stack/README.md` (`node scripts/stack-census.mjs --write`), `.github/workflows/deploy.yml` (the build step's `env` gains `VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}` and `VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}`), `.github/workflows/ci.yml` (nothing: CI builds without them and must pass)

- [ ] **Step 1:** Write the page: what it is (the client to the durable world's database; the site has no other server), where used (`src/lib/durable/supabase.js` only), rules (the client is made in that file alone; every table has RLS; no service-role key), upgrading, gotchas (anonymous sign-in must be enabled in the project; Realtime respects RLS for `SELECT`). Add the census row, install, `--write`, health check green.
- [ ] **Step 2:** `deploy.yml` env lines. `npm run build` with no env: succeeds.
- [ ] **Step 3: Commit** `Supabase-js, with its page, and the build reads its URL and anon key from secrets`.

### Task 2: The client and the pure entity module

**Files:**
- Create: `src/lib/durable/supabase.js`, `supabase.test.js`, `entities.js`, `entities.test.js`

**Interfaces:**
- Produces: `client({ url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY, make = createClient } = {}) → SupabaseClient | null` (one per page, kept; `null` when either is empty); `signIn(client) → Promise<userId | null>` (`getSession` first, else `signInAnonymously`); `CELL = 2048`, `cellOf(x, z) → [cx, cz]`, `cellsAround(cx, cz, r = 1) → 'cx,cz'[]` nearest first, `bboxOf(cx, cz) → { minX, maxX, minZ, maxZ }`, `diffCells(prev: string[], next: string[]) → { gone, came }`, `rowToEntity(row)`, `entityToRow(entity)` as the spec says.

- [ ] **Step 1: Failing tests.** `supabase.test.js`: `client({ url: '', key: 'k' })` is `null`; with both, `make` is called once with `(url, key, { auth: { persistSession: true } })` and the same object comes back on a second call; `signIn` with a fake whose `getSession` has a user returns its id without calling `signInAnonymously`, and calls it when there is none. `entities.test.js`: `cellOf(−1, 2048)` is `[−1, 1]`; `cellsAround(0, 0)` has 9 keys starting `'0,0'`; `bboxOf(1, −1)` is `{ minX: 2048, maxX: 4096, minZ: −2048, maxZ: 0 }`; `diffCells(['a','b'], ['b','c'])` is `{ gone: ['a'], came: ['c'] }`; `rowToEntity(entityToRow(e))` equals `e` on the fields the client sets, and `entityToRow(e)` has no `id`, `owner`, `version` keys.
- [ ] **Step 2:** Run. FAIL. **Step 3:** Write them. **Step 4:** Run. PASS.
- [ ] **Step 5: Commit** `The durable client, made or null, and the entity grid as pure rules`.

### Task 3: The loader

**Files:**
- Create: `src/lib/durable/entityLoader.js`, `entityLoader.test.js`, `fixtures/fakeClient.js` (a fake with `rpc`, `from().insert().select().single()`, `from().delete().eq().select('id')` (RLS turns a delete of someone else's row into a delete of nothing, so the loader asks which ids went), `channel().on().subscribe()`, scripted answers and a log of calls)

**Interfaces:**
- Consumes: Task 2's `entities.js`.
- Produces: `createEntityLoader({ client, planetId, radius, inFlight, staleMs, now, realtime })` as the spec's code and its events.

- [ ] **Step 1: Failing tests**, one per line: `update(0, 0)` asks the RPC for 4 of the 9 cells (`inFlight`) with `planet_id` and the cell's bbox, the ship's own first; answers emit `add` once per row; a second `update` asks the next cells; after `staleMs` a held cell is asked again with `since` equal to the last row's `updated_at`; moving two cells over emits `remove` for every entity of the cells left and asks the new ones; an RPC error emits `error` once and leaves the cell unfetched; a realtime `INSERT` for a held cell emits `add`, for an unheld cell nothing, a `DELETE` emits `remove`; `place` sends `entityToRow` and emits `add` from the returned row, a refused insert returns `null` and emits `error`; `damage` returning `0` emits `remove`; with `client: null` every call answers `null`/`false`/nothing and emits nothing; `dispose` unsubscribes the channel and a late RPC answer after it emits nothing.
- [ ] **Step 2:** Run. FAIL. **Step 3:** Write it from the spec. **Step 4:** Run. PASS, under a second.
- [ ] **Step 5: Commit** `The entity loader: a planet's built things, cell by cell as the view moves`.

### Task 4: The seed and the check script

**Files:**
- Create: `scripts/supabase-seed.mjs` (writes `supabase/seed.sql`: 50 `planets` rows and the POIs, from `src/lib/land/flight/planetSpec.js` when it exists on main, else from `scripts/fixtures/planets.json` carrying the same 50 ids; say which in the file's header), `supabase/seed.sql`, `scripts/supabase-check.mjs` (reads `.env.local`; signs in anonymously; the spec's six steps; prints one line each; exits 1 on any failure)
- Modify: `supabase/README.md` if a step differs from what it says.

- [ ] **Step 1:** Write the seed script and run it (the planets' id check takes upper case: Expanse ids start `E:`); `supabase/seed.sql` has 50 inserts into `planets` and one `pois` row for Echo Base on `hoth` at `(1200, −800)`, `r = 380` (the flat's `r + edge`).
- [ ] **Step 2:** Write the check script. Without `.env.local` it prints `no project linked: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local` and exits 2.
- [ ] **Step 3: Commit** `The planets seeded and a check that walks the schema by hand`.

### Task 5: Against a real project (by hand, if the owner has made one)

- [ ] If `.env.local` holds a project: `npx supabase db push`, apply `seed.sql`, `node scripts/supabase-check.mjs`. Expected: six lines, all `ok`. Put the output in the PR. If there is no project: say so in the PR and in the handoff's Left; the owner applies `supabase/README.md`'s steps.

### Task 6: Docs and the PR

- [ ] A paragraph in `docs/architecture.md` (“The durable world”); the handoff's lane B row. Merge `origin/main`, the checks, push, PR, CI, merge commit. If lane A merged first, `npm install` on main and `node scripts/stack-census.mjs --write` once more before the last push.
