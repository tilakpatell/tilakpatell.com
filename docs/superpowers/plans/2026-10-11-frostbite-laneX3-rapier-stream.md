# Lane X3: Rapier streams in. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Branch `claude/frostbite-x3-rapier-stream` from `origin/main`. One PR.

**Goal:** The two Rapier builds arrive as bare `.wasm` assets compiled while they download, not as base64 inside a 4 MB module, behind `loadEngine`’s unchanged face and with the same floats.

**Architecture:** The bare packages `@dimforge/rapier3d` and `@dimforge/rapier3d-simd` import their wasm as an ES module (`rapier_wasm3d.js`: `import * as wasm from "./rapier_wasm3d_bg.wasm"`), which Vite does not bundle. A Vite plugin (`scripts/rapier-wasm.mjs`, its rule pure in `scripts/lib/rapier-wasm.mjs`) resolves that one import, for each package, to a shim under `src/lib/physics/raw/` that gets the wasm’s URL as a hashed asset (`?url`), instantiates it through `src/lib/wasm/instantiate.js` (streaming in the browser, bytes as the fallback, `readFile` in Node) with the glue module as its import object, hands the exports to the glue’s `__wbg_set_wasm`, and re-exports the glue. `engine.js` imports the bare packages and no longer calls `init()`.

**Tech Stack:** Vite 8 plugin API (`enforce: 'pre'`, `resolveId(source, importer)`), Vitest 5 (the same plugin runs under `ssrLoadModule`, so the tests load the real engine), `WebAssembly.instantiateStreaming`, `@dimforge/rapier3d@0.21.0`, `@dimforge/rapier3d-simd@0.21.0` (pinned, no caret, the same version as each other).

**Spec:** `docs/superpowers/specs/2026-10-11-frostbite-gaps-design.md` (§1 X3, §3, §4); the audit `docs/research/2026-10-11-frostbite-gap-audit.md` §2.1.

## Global Constraints

- Rapier is imported only under `src/lib/physics/` (`engine.js` and the two shims); the pin stays `0.21.0` on both packages, no caret.
- `src/lib/physics` and `src/lib/wasm` stay pure: no three.js, no DOM beyond `fetch` and `WebAssembly`; `node:fs` reached only by a dynamic import guarded by `typeof window === 'undefined'`.
- Every physics test passes unchanged except the two that name the packages (`world.load.test.js`’s `BUILDS`, `engine.test.js` if it names them); the floats are the same wasm’s.
- No new runtime dependency; the plugin is the repository’s own. The two compat packages leave `package.json`.
- `src/data/health/latest.json` is not committed (the design’s rule 1).
- British spelling, curly quotes in prose; `_source` on every number in the evidence README.

## Review Focus

1. A server that types `.wasm` as `application/octet-stream`: `instantiateStreaming` rejects with a `TypeError`; `instantiate` must fall to `instantiate(await response.arrayBuffer())` and still resolve. Test: Task 1.
2. The SIMD shim imported where the SIMD probe lied (the module compiles but `instantiate` throws `CompileError`): `loadEngine`’s existing fallback to the scalar build must still fire, since the throw now happens inside the shim’s top-level await, which rejects the dynamic import. Test: Task 3 (`engine.test.js`’s fallback case still passes against the real packages).
3. The dev server: `@dimforge/rapier3d` prebundled by the dependency optimizer would hit the `.wasm` import before the plugin; `optimizeDeps.exclude` names both packages. Test: Task 2 (a `vite dev` boot and a fetch of `/node_modules/@dimforge/rapier3d/rapier_wasm3d.js` returns the shim’s code).
4. `scripts/x2-profile.mjs` loads through `ssrLoadModule` with `optimizeDeps.noDiscovery`: the plugin must be in the config it reads (`vite.config.js`, which it inherits). Test: Task 4 runs the profile for ten seconds.
5. `scripts/wasm-check.mjs` now finds two hashed `.wasm` files in `dist/assets/` and must validate both and find each named by a chunk. Test: Task 4.

---

### Task 1: `instantiate`, pure and tested

**Files:**
- Create: `src/lib/wasm/instantiate.js`, `src/lib/wasm/instantiate.test.js`

**Interfaces:**
- Produces: `instantiate(url: string, imports: object, { fetch = globalThis.fetch, WebAssembly: WA = globalThis.WebAssembly, node = typeof window === 'undefined' && typeof process !== 'undefined' } = {}) → Promise<{ instance, module, how: 'streaming' | 'bytes' | 'file' }>`.

- [ ] **Step 1: the failing tests.** `instantiate.test.js`, with a 8-byte valid wasm module (`\0asm\1\0\0\0`) as the fixture bytes:
  - `streams when the response is application/wasm`: a fake `fetch` returning `new Response(bytes, { headers: { 'content-type': 'application/wasm' } })` and a fake `WebAssembly` whose `instantiateStreaming` records its call → `how === 'streaming'`.
  - `falls to bytes when streaming throws TypeError`: `instantiateStreaming` throws `new TypeError('wrong MIME')`, `instantiate(bytes)` succeeds → `how === 'bytes'`; the response is read once (`clone()` before the streaming attempt, or a second `fetch`; the test counts fetches as at most 2).
  - `reads the file in Node`: `node: true` and a `url` that is a path to a temp file holding the bytes → `how === 'file'` (the real `WebAssembly`).
  - `rejects with the cause when the module is bad`: bytes `\0asm\9\0\0\0` → rejects with a `CompileError`.
- [ ] **Step 2: run** `npx vitest run src/lib/wasm/instantiate.test.js`: FAIL (module not found).
- [ ] **Step 3: implement.** Node path: `const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')`; the path is `url` with a leading `/@fs` stripped and `file://` resolved (`fileURLToPath`). Browser path: `fetch(url)`, try `instantiateStreaming(response.clone(), imports)` when the function exists, catch `TypeError` → `instantiate(await response.arrayBuffer(), imports)`.
- [ ] **Step 4: run**: PASS.
- [ ] **Step 5: commit** `instantiate: a wasm from a URL, streamed where the type is right, bytes else, a file in Node`.

### Task 2: the plugin and the two shims

**Files:**
- Create: `scripts/lib/rapier-wasm.mjs` (pure: `shimFor(source, importer, { root }) → string | null`), `scripts/lib/rapier-wasm.test.mjs`, `scripts/rapier-wasm.mjs` (the plugin), `src/lib/physics/raw/scalar.js`, `src/lib/physics/raw/simd.js`
- Modify: `vite.config.js` (the plugin in `plugins`, `optimizeDeps.exclude: ['@dimforge/rapier3d', '@dimforge/rapier3d-simd']`), `package.json` (remove the two compat packages, add `"@dimforge/rapier3d": "0.21.0"`, `"@dimforge/rapier3d-simd": "0.21.0"`), `package-lock.json` by `npm install`

**Interfaces:**
- Produces: `shimFor('./rapier_wasm3d', '<root>/node_modules/@dimforge/rapier3d-simd/raw.js', { root })` → `'<root>/src/lib/physics/raw/simd.js'`; the scalar package → `.../scalar.js`; any other source or importer → `null`. The plugin: `{ name: 'rapier-wasm', enforce: 'pre', resolveId(source, importer) { return shimFor(source, importer, { root }) } }`.
- Each shim:
  ```js
  import * as bg from '@dimforge/rapier3d/rapier_wasm3d_bg.js';
  import url from '@dimforge/rapier3d/rapier_wasm3d_bg.wasm?url';
  import { instantiate } from '../../wasm/instantiate.js';
  const { instance } = await instantiate(url, { './rapier_wasm3d_bg.js': bg });
  bg.__wbg_set_wasm(instance.exports);
  export * from '@dimforge/rapier3d/rapier_wasm3d_bg.js';
  ```
  (`-simd` in the SIMD shim’s three specifiers.)

- [ ] **Step 1: the failing tests** in `rapier-wasm.test.mjs`: the three cases above; `source` spelt `./rapier_wasm3d`, `./rapier_wasm3d.js` and `../rapier_wasm3d` all match; a Windows importer path with backslashes matches.
- [ ] **Step 2: run** `npx vitest run scripts/lib/rapier-wasm.test.mjs`: FAIL.
- [ ] **Step 3: implement** the rule and the plugin; `npm uninstall @dimforge/rapier3d-compat @dimforge/rapier3d-simd-compat && npm install --save-exact @dimforge/rapier3d@0.21.0 @dimforge/rapier3d-simd@0.21.0`; write the two shims; the config.
- [ ] **Step 4: run**: PASS; then `npx vite dev --port 5199 &` and `curl -s localhost:5199/node_modules/@dimforge/rapier3d/rapier_wasm3d.js | head -3` shows the shim’s imports (Review Focus 3); kill the server.
- [ ] **Step 5: commit** `Rapier’s wasm import resolved to a shim a build that streams the binary; the bare packages in, the compat ones out`.

### Task 3: `engine.js` and the physics tests on the bare packages

**Files:**
- Modify: `src/lib/physics/engine.js` (`IMPORTERS` → `import('@dimforge/rapier3d-simd')` and `import('@dimforge/rapier3d')`; `up()` drops `await RAPIER.init()`; the header’s “-compat” paragraph rewritten), `src/lib/physics/world.load.test.js:6` (`BUILDS` the bare names), `scripts/cpu-profile.test.mjs:17,28` (the dev-server module names, `@dimforge_rapier3d-simd.js`, `@dimforge_rapier3d.js`)

- [ ] **Step 1: run** `npx vitest run src/lib/physics`: FAIL (the compat packages are gone).
- [ ] **Step 2: implement** the three edits.
- [ ] **Step 3: run** `npx vitest run src/lib/physics scripts/cpu-profile.test.mjs`: PASS, every test, including `engine.test.js`’s fallback (Review Focus 2) and `world.load.test.js`’s both builds.
- [ ] **Step 4: commit** `loadEngine on the bare builds; no init() to await`.

### Task 4: the build, the check, the profile, the docs, the PR

**Files:**
- Modify: `scripts/stack-census.mjs:28` (the group’s package names), `docs/stack/physics-rapier.md` (the version line, “Where it is used” gains the two shims, “How the site uses it” says how the wasm arrives, “Upgrading” names `rapier_wasm3d.js`’s import as the internal the plugin wraps), `docs/stack/webassembly.md` (Rapier’s row: streamed, not inlined; `instantiate.js` beside `load.js`), `docs/stack/README.md` by `node scripts/stack-census.mjs --write`, `scripts/wasm-check.mjs:7` (the comment no longer says Rapier’s wasm is inlined)
- Create: `docs/superpowers/evidence/frostbite-gaps/x3/README.md`

- [ ] **Step 1**: `npm run build && node scripts/wasm-check.mjs dist`: two `rapier_wasm3d_bg-<hash>.wasm` under `dist/assets/`, both valid, both named by a chunk (Review Focus 5); record the physics chunk’s and the wasm’s sizes raw and gzipped in the README beside the audit’s before (4.14 MB / 1.58 MB gzipped for the scalar module).
- [ ] **Step 2**: `node scripts/x2-profile.mjs --seconds 10` runs and names Rapier’s build (Review Focus 4); the replay line reads `0 … differ`.
- [ ] **Step 3**: the docs; `node scripts/stack-census.mjs --write`; `npm run lint && npm test && node scripts/health.mjs --check --skip build && npm run coverage:bf2017 && npm run maps:bf2017`; `git checkout -- src/data/health/latest.json`.
- [ ] **Step 4**: merge `origin/main`; push; draft PR `Lane X3: Rapier streams in`; the design’s table row.
