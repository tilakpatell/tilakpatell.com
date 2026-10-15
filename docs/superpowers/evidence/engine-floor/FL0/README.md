# Lane FL0: the measure and the ratchet

The design’s §4.6, on 2026-10-15, pull request #1007. Four new counts in `scripts/health/` and budgets for seven, written by `node scripts/health.mjs --ratchet --pr 1007`.

| metric | counts | measured | budget |
| --- | --- | --- | --- |
| `renderers` | `new WebGLRenderer(` and `new WebGPURenderer(` in code outside `src/runtime/`, comments, quoted strings and tests left out | 16 | 16 |
| `loops` | files calling `requestAnimationFrame(` outside `src/runtime/`, `src/lib/three/loop.js` and `src/lib/shownLoop.js`, tests left out | 58 | 58 |
| `client-json-kb` | kilobytes of each `.json` over 64 KB a file under `src/` imports statically (no `?url`, no script, no test), once a record | 3,941 | 3,945 (the ratchet’s 5 kB step) |
| `doc-binaries` | files committed under `docs/` over 1 MB, sizes from git’s tree at `HEAD` | 4 | 4 |
| `glsl-sites` | as it was | 619 | 619 |
| `boundary-breaks` | as it was | 479 | 479 |
| `cycles` | as it was | 5 | 5 |

## Against the inventory

- `renderers` is 16 where the inventory says 17: its grep (`evidence/engine-floor/README.md`, “the floors”) counted `src/runtime/webgpu.js`’s own `WebGPURenderer`, the one the metric exempts.
- `loops` is 58: the inventory’s 61 files less the three allowed loops, as the plan expected.
- `client-json-kb` is 3,941 kB, not the 2,065 of §1.6’s four rows: seventeen Battlefront records are over the floor (`screens.json` 738, `ai.json` 518, `ui.json` 380, `physics/soldier.json` 334, `collection.json` 298, `maps/hoth.json` 282 and eleven more; `node scripts/health.mjs --only client-json-kb` lists them). A dynamic `import()` of a record is not counted: the design names it as one of FL1’s remedies.
- `doc-binaries` is 4: `bf2017-hud/hud.png`, `bf2017-coverage/ledger.json.gz`, `bf2017-waiting-screen/field-3s-sunset.png`, `bf2017-guns-2026-10-12/hoth-e11-corrected.png`. Moving them shrinks no clone without a history rewrite, the owner’s call alone; the budget only stops the pile growing.
