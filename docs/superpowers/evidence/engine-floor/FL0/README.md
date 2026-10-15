# Lane FL0: the measure and the ratchet

The design’s §4.6, on 2026-10-15, pull request #1007. Four new counts in `scripts/health/` and budgets for seven, written by `node scripts/health.mjs --ratchet --pr 1007`.

| metric | counts | measured | budget |
| --- | --- | --- | --- |
| `renderers` | `new WebGLRenderer(` and `new WebGPURenderer(` in code outside `src/runtime/`, comments, quoted strings and tests left out | 16 | 16 |
| `loops` | files calling `requestAnimationFrame(` outside `src/runtime/`, `src/lib/three/loop.js` and `src/lib/shownLoop.js`, tests left out | 58 | 58 |
| `client-json-kb` | kilobytes of each `.json` over 64 KB a file under `src/` imports statically (no `?url`, no script, no test), once a record | 4,041 | 4,045 (the ratchet’s 5 kB step) |
| `doc-binaries` | files committed under `docs/` over 1 MB, sizes from git’s tree at `HEAD` | 1 | 1 |
| `glsl-sites` | as it was | 619 | 619 |
| `boundary-breaks` | as it was | 480 | 480 |
| `cycles` | as it was | 5 | 5 |

## Against the inventory

- `renderers` is 16 where the inventory says 17: its grep (`evidence/engine-floor/README.md`, “the floors”) counted `src/runtime/webgpu.js`’s own `WebGPURenderer`, the one the metric exempts.
- `loops` is 58: the inventory’s 61 files less the three allowed loops, as the plan expected.
- `client-json-kb` is 4,041 kB, not the 2,065 of §1.6’s four rows: seventeen Battlefront records are over the floor (`screens.json` 738, `ai.json` 518, `ui.json` 380, `physics/soldier.json` 334, `collection.json` 305, `maps/hoth.json` 291 and eleven more; `node scripts/health.mjs --only client-json-kb` lists them). A dynamic `import()` of a record is not counted: the design names it as one of FL1’s remedies.
- Measured on `main` as merged at 21:35 UTC: #1000’s Echo Base light grew `maps/hoth.lighting.json` from 218 to 254 kB and #974’s hero kit grew `abilities.json` from 117 to 163 kB, `collection.json` and `weapons.json` by 9 more, and #1002’s Hoth charges grew `maps/hoth.json` from 282 to 291 kB (3,941 → 4,041), and the galaxy’s space hulls (f5f72fe9) added `galaxy/scene.js → universe/hunterRules.js`, a world reaching into another (479 → 480). Both were on `main` before any budget held them, so the budgets start at the merged numbers; FL1’s slice and FL2’s ports lower them.
- `doc-binaries` is 1, `bf2017-coverage/ledger.json.gz`: the docs audit (#1009) took the three pictures over 1 MB out before this landed. Moving the rest shrinks no clone without a history rewrite, the owner’s call alone; the budget only stops the pile growing.
