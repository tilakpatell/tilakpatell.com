# Engine floor, lane FL0: the measure and the ratchet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three new health metrics (`renderers`, `loops`, `client-json`, `doc-binaries`) and budgets for the three unbudgeted ones (`glsl-sites`, `boundary-breaks`, `cycles`), so CI fails any lane that adds a renderer, a loop, GLSL, a boundary break or a big JSON import.

**Architecture:** One module a metric in `scripts/health/`, each a pure walk over `ctx.src` (the context of `scripts/health/context.mjs`), returning `metric({ id, label, unit, value, detail })`; tests against `scripts/health/fixtures/` as the existing metrics have; the budgets written by `--ratchet`, which also appends the history line.

**Tech Stack:** Node 22 ESM, Vitest, the existing `scripts/health.mjs` runner.

**Spec:** `docs/superpowers/specs/2026-10-15-engine-floor-design.md`, §4.6.

## Global Constraints

- British spelling, curly quotes, comments say why (`docs/health/RULES.md`).
- No new dependency.
- Each metric’s `value` is a count; `better: 'lower'` (the `metric()` helper sets it).
- `src/data/health/latest.json` is never committed by this lane (`--check` leaves it; `--ratchet` writes `budgets.json` and `history.jsonl` only, which are committed).
- The four checks before the pull request: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`.

## Review Focus

1. A renderer made inside a string or a comment (`// new WebGLRenderer` in `runtime/webgpu.js`’s notes) must not count: strip comments with `graph.mjs`’s `uncomment` first, as `glsl-sites` does.
2. A `requestAnimationFrame` in a test or a fixture must not count; a `cancelAnimationFrame` alone is not a loop.
3. A JSON import with a query (`?url`, `?raw`) is a fetch, not a parse: it does not count in `client-json`.
4. The budgets file stays sorted by key (`ratchet()` sorts it); a lane that lands with a lower number ratchets and commits `budgets.json` only.
5. `doc-binaries` must read `git ls-files`, not the working tree, so an untracked screenshot in a checkout does not fail CI.

---

### Task 1: `renderers`

**Files:**
- Create: `scripts/health/renderers.mjs`
- Create: `scripts/health/fixtures/renderers/src/a/stage.js` (`new THREE.WebGLRenderer({ canvas })`), `fixtures/renderers/src/runtime/webgpu.js` (`new WebGPURenderer({})`, exempt), `fixtures/renderers/src/b/note.js` (`// new WebGLRenderer in a comment`, `const s = 'new WebGLRenderer'` not counted either: a string is a comment’s cousin here; count only code outside quotes by stripping string literals the same way `uncomment` strips comments, or accept the string case as counted and say so in the header: pick the first)
- Modify: `scripts/health.mjs:30` (`METRICS` gains `'renderers'` after `'glsl-sites'`)
- Test: `scripts/health.test.mjs` (a case for the fixture: value 1, detail `[{ file: 'src/a/stage.js', n: 1 }]`)

**Interfaces:**
- Produces: `export default async function renderers(ctx) → metric` with `id: 'renderers'`, `unit: 'sites'`; `export const EXEMPT = ['src/runtime/']`; `export const RE` (the alternation `new (THREE\.)?(WebGLRenderer|WebGPURenderer)\s*\(`).

- [ ] **Step 1: Write the failing test** in `scripts/health.test.mjs`, in the style of the `art-mix` case: `makeContext(fixture('renderers'))`, `renderers(ctx)`, expect `value` 1 and the one detail row.
- [ ] **Step 2: Run** `npx vitest run scripts/health.test.mjs -t renderers` → fails (module missing).
- [ ] **Step 3: Implement** `renderers.mjs`: for each `ctx.src` file not a test and not under an `EXEMPT` folder, `uncomment` then count `RE` matches; `metric({ id: 'renderers', label: 'renderer constructors outside the runtime', unit: 'sites', value: total, detail })`. Header: why (the design’s §2, one renderer).
- [ ] **Step 4: Run** the test → passes. Run `node scripts/health.mjs --only renderers` → value 17 on this tree.
- [ ] **Step 5: Commit** `feat(health): renderers, the constructors outside the runtime`.

### Task 2: `loops`

**Files:**
- Create: `scripts/health/loops.mjs`, fixtures `fixtures/loops/src/a/spin.js` (`requestAnimationFrame(tick)`), `fixtures/loops/src/lib/shownLoop.js` (exempt), `fixtures/loops/src/a/spin.test.js` (not counted)
- Modify: `scripts/health.mjs` (`METRICS` gains `'loops'`)
- Test: `scripts/health.test.mjs`

**Interfaces:**
- Produces: `export default async function loops(ctx) → metric` (`id: 'loops'`, `unit: 'files'`, a file counts once); `export const EXEMPT = ['src/runtime/', 'src/lib/three/loop.js', 'src/lib/shownLoop.js']`.

- [ ] **Step 1: Test:** value 1, detail `[{ file: 'src/a/spin.js', n: 1 }]`.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement:** `uncomment`, `/\brequestAnimationFrame\s*\(/`, one row a file.
- [ ] **Step 4: Run** → passes; `--only loops` prints today’s count (about 58: the 61 files less the three exempt).
- [ ] **Step 5: Commit** `feat(health): loops, the frame loops outside the runtime`.

### Task 3: `client-json`

**Files:**
- Create: `scripts/health/client-json.mjs`, fixtures `fixtures/client-json/src/a/reads.js` (`import big from '../data/big.json'` and `import url from '../data/big.json?url'`), `fixtures/client-json/src/data/big.json` (a 70 KB file written by the test, or committed at 70,000 bytes of `{"k":"…"}`), `fixtures/client-json/scripts/tool.mjs` (imports the same file: not counted, scripts are not the client)
- Modify: `scripts/health.mjs`
- Test: `scripts/health.test.mjs`

**Interfaces:**
- Produces: `export default async function clientJson(ctx) → metric` (`id: 'client-json'`, `unit: 'kB'`, `value` the sum in whole kB of every distinct JSON file over `FLOOR` bytes imported statically (no `?` in the specifier) by a non-test file under `src/`; `detail` one row a JSON file, `n` its kB, the importing file in `note`); `export const FLOOR = 65536`.
- Note: an id ending in `-kb` is rounded to 5 kB by `ratchet()`: name it `client-json-kb` so the ratchet’s rounding applies, and say so in the header. (So the id is `client-json-kb`; the design’s `client-json` is this.)

- [ ] **Step 1: Test:** value 69 (70,000 bytes → 68.4 → `Math.ceil` 69 kB), one row.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement:** resolve each `from '…json'` specifier relative to the importer (as `shadingClosure.resolveImport` does, but for `.json`), `stat` the file, sum those over `FLOOR`, dedupe by path.
- [ ] **Step 4: Run** → passes; `--only client-json-kb` prints about 2,065 kB with `ai.json`, `screens.json`, `ui.json`, `modelCredits.json` and the rest in the detail.
- [ ] **Step 5: Commit** `feat(health): client-json-kb, the records parsed as JavaScript`.

### Task 4: `doc-binaries`

**Files:**
- Create: `scripts/health/doc-binaries.mjs` (reads `git ls-files -z docs` through `execFileSync`, counts files whose `stat().size` is over `LIMIT = 1_048_576` bytes; `unit: 'files'`), a fixture is not possible for `git ls-files`: the test passes a `list()` function (`doc-binaries.mjs` exports `countBinaries(files, { stat })` pure, and `default` wires git)
- Modify: `scripts/health.mjs`
- Test: `scripts/health.test.mjs` (the pure `countBinaries` with a fake `stat`)

- [ ] **Step 1: Test:** two paths, sizes 2 MB and 10 KB → value 1.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → passes; `--only doc-binaries` prints today’s count.
- [ ] **Step 5: Commit** `feat(health): doc-binaries, the pictures that should be on the bucket`.

### Task 5: The budgets and the rules

**Files:**
- Modify: `docs/health/budgets.json` (through `node scripts/health.mjs --ratchet --pr <n>`: `glsl-sites` 619, `boundary-breaks` 479, `cycles` 5, `renderers` 17, `loops` <measured>, `client-json-kb` <measured, rounded to 5>, `doc-binaries` <measured>; `src/data/health/history.jsonl` gains the line; then `git checkout src/data/health/latest.json` if the run wrote it: `--ratchet` without `--check` writes it, so run `--ratchet` then restore `latest.json`)
- Modify: `docs/health/RULES.md`: under “Layers”, a paragraph “A renderer, a loop and a post chain are the runtime’s alone” naming `renderers` and `loops`; under “A dependency has a page”, a paragraph “A record a world reads is a slice” naming `client-json-kb` (over 64 KB a file counts; a slice at build, `scripts/library-slice.mjs`’s shape, or a fetch); a new section “Evidence is pictures on the bucket” naming `doc-binaries` (a binary over 1 MB under `docs/` goes to the bucket by hash through `scripts/assets-publish.mjs`, linked from the lane’s README).
- Modify: `docs/health/README.md`’s files table if a row changes.

- [ ] **Step 1:** `node scripts/health.mjs --ratchet --pr <this PR’s number once opened; 0 until then>`; read the printed `budgets:` line.
- [ ] **Step 2:** `git checkout src/data/health/latest.json`; `node scripts/health.mjs --check --skip build` → “within budget”.
- [ ] **Step 3:** Write the three paragraphs in `RULES.md`.
- [ ] **Step 4:** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`; `git checkout public/github.json`.
- [ ] **Step 5: Commit** `The engine floor’s measure: four metrics, seven budgets` with the budgets line in the body; push; open the pull request; `docs/superpowers/evidence/engine-floor/FL0/README.md` with the table of the seven numbers; fill FL0’s row in `docs/superpowers/HANDOFF-engine-floor.md`.
