# Global constraints binding every lane-2 task (verbatim from the plan and spec)

From the plan's Global Constraints:
- `expanse/gen/*`, `runtime/*`, `universe/budget.js` and `expanse/scene/levels.js` import no React, DOM or three.js.
- Generated content is never stored. There is no new dependency, no new asset and no new on-screen word, so `WORLD_MB['/universe']` is unchanged.
- A test that describes behaviour the spec removes (the rim's wake and sleep, the floating origin in the Expanse, the 2D starfield ring, the ±1,300 pose clamp) is replaced in the same PR by a test of what replaces it, and the PR lists each one. No other test changes.
- `src/components/universe/scene.js` doesn't grow. New files stay under 800 lines.
- Space: sectors are cubes with `SECTOR = 120000`. Ids are Task 0's (`src/lib/space/address.js`: consume it, never redefine it). On the middle layer, everything `makeSector` gives today keeps its index, type and seed.
- Keep-outs (spheres): home 8,000; each fandom planet and wonder 3 × its reach; the Rick and Morty pocket `SECTOR_RADIUS.rickmorty + 4000` round `SECTORS.rickmorty.origin`.
- Density: from 1,000 seeded points across the 27 sectors round home, every point has at least 3 things within 9,000 and the nearest no more than 6,000 away.
- Placement: the placement cube's half is 58,000. Systems are at least 6,000 apart in 3D; wonders and beacons are kept 3,000 from any system. Systems appended a sector: 200 to 300, or 100 to 150 in the core sector `0,0,0`.
- Things: a lattice of 20 × 20 × 20 cells (6,000 each) a sector, one candidate a cell, jittered up to 0.8 of half a cell; indices `w64` and up (`w3` to `w63` kept for whole-sector lists); `THING_NEAR = 8`.
- Orbits: `ORBIT_CYCLE = 65536` s and `REV_K = 4`. The shared clock is wall-clock seconds, `Date.now() / 1000`.
- Lane 5a reads moons as planet rows' `moonList` of `{ id, k, name, type: 'rocky'|'icy', seed, radius, orbit, phase, revs, tilt }` and resolves ids through `placeOf(universe, id)`. Keep those names.

From the repo's rules (docs/health/RULES.md, HANDOFF-universe.md):
- Pure first: every rule has its Node test before its drawing half. Tests go beside the file; fixtures in a `fixtures/` folder beside the test.
- Never skip, quieten, loosen or delete a test to get green. Don't reformat lines you aren't moving. Comments say why, British spelling.
- Health (`node scripts/health.mjs --check --skip build`) stays within budget; boundary-breaks was 487 of 489 at the lane's start. Controller ruling: lane 2's NEW imports from `src/components/expanse/**` into `src/components/universe/**` go through the face `src/components/universe/shared/space.js` (plain re-exports, with its row in `universe/shared/shared.test.js`).
- Commit messages end with the two trailer lines `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01PJqkNSL8smFuirsPmEJGyM` (mandated by the operating brief; not a defect).
