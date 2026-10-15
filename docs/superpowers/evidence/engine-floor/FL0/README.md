# Lane FL0: the measure and the ratchet

The design’s §4.6, on 2026-10-15, pull request #1007. Four new counts in `scripts/health/` and budgets for seven, written by `node scripts/health.mjs --ratchet --pr 1007`.

| metric | counts | measured | budget |
| --- | --- | --- | --- |
| `renderers` | `new WebGLRenderer(` and `new WebGPURenderer(` in code outside `src/runtime/`, comments, quoted strings and tests left out | 16 | 16 |
| `loops` | files calling `requestAnimationFrame(` outside `src/runtime/`, `src/lib/three/loop.js` and `src/lib/shownLoop.js`, tests left out | 58 | 58 |
| `client-json-kb` | kilobytes of each `.json` over 64 KB a file under `src/` imports statically (no `?url`, no script, no test), once a record | 1,256 | 1,260 (the ratchet’s 5 kB step) |
| `doc-binaries` | files committed under `docs/` over 1 MB, sizes from git’s tree at `HEAD` | 1 | 1 |
| `glsl-sites` | as it was | 619 | 619 |
| `boundary-breaks` | as it was | 481 | 481 |
| `cycles` | as it was | 5 | 5 |

## Against the inventory

- `renderers` is 16 where the inventory says 17: its grep (`evidence/engine-floor/README.md`, “the floors”) counted `src/runtime/webgpu.js`’s own `WebGPURenderer`, the one the metric exempts.
- `loops` is 58: the inventory’s 61 files less the three allowed loops, as the plan expected.
- `client-json-kb` is 1,256 kB, eight Battlefront records over the floor (`physics/soldier.json` 334, `collection.json` 305, `physics/bones.json` 133, `damage.json` 127 and four more; `node scripts/health.mjs --only client-json-kb` lists them). It stood at 3,941 when this lane began and at 4,041 on `main` an hour later, as Battlefront lanes grew their records (#1000 `maps/hoth.lighting.json` +36 kB, #974 `abilities.json` +46 and 9 more, #1002 `maps/hoth.json` +9); FL1 (#1013) then served `screens.json`, `ai.json`, `ui.json`, the maps and the rest of the rulebook’s records as slices, which this metric does not count. A dynamic `import()` of a record is not counted either: the design names it as one of FL1’s remedies.
- Measured on `main` as merged at 22:20 UTC. Two imports across a line landed before any budget held them: the galaxy’s space hulls (f5f72fe9) added `galaxy/scene.js → universe/hunterRules.js`, a world reaching into another, and 6dd3caa2’s Hoth address change added `pages/Galaxy.jsx → pages/GalaxyLanding.jsx` (479 → 481). The budgets start at the merged numbers; FL2’s ports lower them.
- `doc-binaries` is 1, `bf2017-coverage/ledger.json.gz`: the docs audit (#1009) took the three pictures over 1 MB out before this landed. Moving the rest shrinks no clone without a history rewrite, the owner’s call alone; the budget only stops the pile growing.
