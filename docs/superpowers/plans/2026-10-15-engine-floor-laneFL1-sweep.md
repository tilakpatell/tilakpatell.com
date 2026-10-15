# Engine floor, lane FL1: the sweep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The nine scripts nothing names deleted; the exports no other file names removed folder by folder; the Battlefront rulebook’s three records out of the JavaScript chunks (`instantAction` 2,223,619 B → under 600 KB, `FrontEnd` 859,669 B → under 300 KB).

**Architecture:** Deletions with the test suite as the net; a Vite plugin `scripts/data-slice.mjs` after `scripts/library-slice.mjs`’s shape, serving each record as the keys its readers read, proven complete by a test that walks the readers; where a reader walks the whole record, a `fetch` of the JSON at the world’s `create` instead.

**Tech Stack:** Vite 8 (rolldown), Vitest, the evidence folder’s `tools/unused-exports.mjs` (nothing added to `package.json`).

**Spec:** `docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §1.6 and §4.7.

## Global Constraints

- No file under `src/data/` is deleted or edited (the records are the game’s).
- No test is skipped, quietened or deleted except one whose only subject is a removed export.
- `src/lib/battlefront/rulebook.js` and `src/lib/bf2017/ui/` are touched in their imports only; pull requests #1000 to #1004 own `components/battlefront/`.
- Every removal commit says what the thing was for (`git log --oneline -3 -- <path>` in the body).
- The four checks before the pull request.

## Review Focus

1. An export reached only by a built path (`import(\`./${x}.js\`)`), a DEV hook (`window.__X__`), a fixture or a script must not be removed: a scan row is a claim, verified by `grep -rn` of the name before the cut.
2. A slice must contain every key a reader reads, including keys read through a variable (`ai[name]`): a reader that indexes by a runtime value walks the whole record and gets the fetch, not the slice.
3. The Battlefront world’s first screen must come no later: the fetch starts in `create` before the level stream, and `ready` waits on it.
4. `npm run test:ai` and `scripts/x2-profile.mjs` read the records through Vite too: the plugin serves them in Vitest and SSR as `library-slice` does (`vite.config.js`’s `ssr.noExternal` note).
5. The nine scripts’ deletion must not break a workflow: `.github/workflows/*.yml` grepped for each name (done in the inventory: none), and `docs/` grepped again at deletion time.

---

### Task 1: The nine scripts

**Files:**
- Delete: `scripts/capital-check.mjs`, `scripts/standing-check.mjs`, `scripts/galaxy-respawn-check.mjs`, `scripts/black-check.mjs`, `scripts/earth-plane-livery.mjs`, `scripts/wanted-check.mjs`, `scripts/outlaw-check.mjs`, `scripts/m64-island-check.mjs`, `scripts/glb-retex.mjs`

- [ ] **Step 1:** For each, `grep -rn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git -F "<name>" package.json .github docs scripts .claude src` → no hit but the file itself; `git log --oneline -3 -- scripts/<name>` noted.
- [ ] **Step 2:** `git rm` the nine; `npm test` (green) and `npm run lint`.
- [ ] **Step 3: Commit** `Nine scripts nothing names, gone` with the nine `git log` lines in the body.

### Task 2: The exports no other file names, folder by folder

**Files:**
- Modify: the files `docs/superpowers/evidence/engine-floor/FL1/unused-exports-before.txt` names under `src/` and `scripts/` (531 rows in 324 files on 2026-10-15), one commit a top-level folder (`src/lib/three`, `src/lib`, `scripts/lib`, each `src/components/<world>`, …)
- Create: `docs/superpowers/evidence/engine-floor/FL1/README.md` (the count before, the count after, the exceptions each with its reason, the chunk table of Task 3)

**Interfaces:**
- Consumes: `node docs/superpowers/evidence/engine-floor/tools/unused-exports.mjs` (about two minutes; `--json` for a machine-readable map).

- [ ] **Step 1:** Run the scan; diff its output against `unused-exports-before.txt` (the tree has moved since: work the current list).
- [ ] **Step 2:** For each folder (the biggest first), for each row: `grep -rn "\b<name>\b" src scripts docs .claude` → a reader anywhere (a DEV hook, a built path such as `import(\`./${x}.js\`)`, a fixture, a doc that quotes the number as the source of a rule) keeps it, listed in the README with the reason; else drop the `export` keyword if the file itself uses the name, or the declaration if nothing does, and the test whose only subject it was.
- [ ] **Step 3:** `npx vitest run <folder>` after each folder; `npm test` after every third folder; `npm run lint` (an unused declaration left behind is a lint error).
- [ ] **Step 4: Commit** per folder: `Sweep: <folder>, N exports nobody reads`.
- [ ] **Step 5:** Run the scan again → `FL1/unused-exports-after.txt`; every remaining row is in the README’s exceptions.
- [ ] **Step 6:** A `knip` run is welcome where a machine has the memory (`tools/knip.json` is the config; 12 GB was not enough in the container): its rows are claims to read the same way, never cut on its word.

### Task 3: The records out of the chunks

**Files:**
- Create: `scripts/data-slice.mjs` (the plugin), `scripts/lib/data-slice.mjs` (pure: `sliceFor(record, keys) → object`, `keysReadBy(source, ident) → string[]` reading `ident.foo`, `ident['foo']` and destructures `const { a, b } = ident` out of a reader’s source; `walksWhole(source, ident) → boolean` true on `ident[<non-literal>]`, `Object.keys(ident)`, `for … of`/`in ident`, `ident.map`, a spread), `scripts/lib/data-slice.test.mjs`
- Modify: `vite.config.js` (`dataSlice()` after `librarySlice()` in `plugins`), `vitest.ai.config.js` and `vitest.render.config.js` if they list plugins
- Modify: `src/lib/battlefront/rulebook.js:14,30` (`import ai from 'virtual:bf2017-ai'`, `import ui from 'virtual:bf2017-ui'`), `src/lib/bf2017/ui/screens.js:21`, `src/lib/bf2017/ui/index.js:28`
- Test: `scripts/lib/data-slice.test.mjs`; the existing `src/lib/battlefront/*.test.js` and `src/lib/bf2017/ui/*.test.js` unchanged and green

**Interfaces:**
- Produces: `export const RECORDS = [{ specifier: 'virtual:bf2017-ai', file: 'src/data/bf2017/ai.json', readers: ['src/lib/battlefront/rulebook.js'] }, { specifier: 'virtual:bf2017-ui', file: 'src/data/bf2017/ui.json', readers: ['src/lib/battlefront/rulebook.js', 'src/lib/bf2017/ui/index.js'] }, { specifier: 'virtual:bf2017-screens', file: 'src/data/bf2017/screens.json', readers: ['src/lib/bf2017/ui/screens.js'] }]`; `export default function dataSlice() → plugin` (`resolveId`, `load` with `addWatchFile` on the record and its readers).

- [ ] **Step 1: Test** `keysReadBy('const x = ai.soldier; ai["hero"]; const { squad } = ai;', 'ai')` → `['soldier', 'hero', 'squad']`; `walksWhole('ai[name]', 'ai')` → true; `sliceFor({ a: 1, b: 2 }, ['a'])` → `{ a: 1 }`; and a test that, for each row of `RECORDS`, reads the readers from disk and asserts `!walksWhole` or lists the row as `whole: true`.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** `scripts/lib/data-slice.mjs`; then read the four readers: for a record whose every reader slices, `load` returns `export default ${JSON.stringify(sliceFor(record, keys))}`; for one a reader walks whole, the row gets `whole: true` and the reader is changed to `const ai = await fetchRecord('/data/bf2017/ai.json')` at the world’s `create` (the file served from `public/data/bf2017/` by a `copy` in the plugin’s `generateBundle`, or imported with `?url` and fetched), behind the loading screen, `ready` waiting on it.
- [ ] **Step 4: Run** the test and `npx vitest run src/lib/battlefront src/lib/bf2017` → green.
- [ ] **Step 5:** `npm run build`; `node docs/superpowers/evidence/engine-floor/tools/chunks.mjs | head -20` → `instantAction` under 600 KB, `FrontEnd` under 300 KB; `git checkout public/github.json`.
- [ ] **Step 6:** `node scripts/perf-probe.mjs battlefront` (BASE unset, QUALITY=low in the container) → the ready time no later than the before run (recorded in `FL1/README.md` first).
- [ ] **Step 7:** `node scripts/health.mjs --only client-json-kb` → down by the three records (if FL0 has landed; else note the bytes).
- [ ] **Step 8: Commit** `The rulebook’s records out of the chunks: instantAction 2.2 MB → N KB` with the chunk table in the body.

### Task 4: The pull request

- [ ] `git fetch origin main && git merge origin/main`; the four checks; `git checkout public/github.json`.
- [ ] Push `claude/engine-floor-fl1-sweep`; open the pull request with the before and after tables; FL1’s row in `docs/superpowers/HANDOFF-engine-floor.md`; merge when CI is green.
