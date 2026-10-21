# Lane C2: the ships are the game’s

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 3. Branch `claude/bf-default-c2-ships`. One PR. Wave 1: C1, A1 and A2 run beside it; touch none of `crewList.js`, `src/lib/cast/`, `src/lib/battlefront/`, `surface/ground/`.

## Read first

- `src/components/galaxy/models.js` (every row, `HIGH_CUTS`, `HQ`, `withHq`, the lod table and `scripts/galaxy-lod.mjs`), `models.test.js`, `fit.js` and `fit.test.js` (sizes and `tune()`), `cabs.js`.
- `src/components/galaxy/surface/catalog/bf2017-vehicles.js` (the native rows: `metres`, `far`, `lod`, `ultra`, `from`), `catalog/index.js` (`modelUrlFor`, `surfaceFarUrl`, `lodUrlFor`).
- `src/lib/combat/hulls.js`, `src/components/galaxy/hulls.js` (the hulls are loaded with the models: a swapped model must keep a hull or fall back to its sphere, and say which).
- `src/components/universe/glbFleet.js`, `shipFit.js`, `src/components/galaxy/shared/models.js` and `shared/shared.test.js`.
- `docs/superpowers/specs/2026-10-14-galaxy-space-hulls-design.md` and `2026-10-15-galaxy-space-fidelity-design.md` (what a desktop downloads on arrival; the fleet cut’s maps).
- The owner’s rule: the ship-customisation files are not touched (`universe/shipModels.js`, `hulls.js`, `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`).

## Tasks

1. **The thirteen kinds.** In `models.js`, point `tie`, `tiebomber`, `tieadvanced`, `awing`, `ywing`, `uwing`, `arc170`, `n1`, `vulture`, `trifighter`, `cloudcar` (and `laat` where a row flies it) at the game’s cuts: the plain cut from `catalog/bf2017-vehicles.js`’s kind (`surfaceUrl(kind)`), the far copy from its `.far` cut (today the lod table under `public/models/galaxy/lod/`). Keep each row’s `nose` right for the native file (facing +z, so `nose: 0` unless measured otherwise) and measure each span against `fit.js`’s sizes and `tune()`; a changed number says why in its comment. Where a kind’s hull exists for the game’s file (`src/lib/combat/hulls.js`, `src/data/bf2017/damage.json`), keep it; where it does not, the sphere stands and the comment says so.
2. **What a desktop downloads.** Measure a system’s arrival (the Hoth fleet war, `scripts/galaxy-war-check.mjs`) in MB and triangles before and after; the far copies must stay small (the `.far` cuts are 256 maps). Say the numbers in the PR. `WORLD_MB` for `/galaxy` moves only with the measure and a sentence.
3. **The universe’s fleet.** `glbFleet.js`’s `ywing`, `awing`, `tiebomber`, `interceptor`, `slave1` take the game’s light or far cuts through `src/components/galaxy/shared/models.js` (add the re-export the universe needs; `shared.test.js` pins the face’s names). The universe’s own `destroyer` and `corvette` stay (the hand-off’s rule). A fighter on that map is a few pixels long: the far cut.
4. **Shots.** Each swapped kind in flight beside the old, at the same pose (`scripts/galaxy-check.mjs`’s poses or `scripts/galaxy-war-check.mjs` with `KIND=`), in the PR body as images from the branch.
5. **Docs.** `models.js`’s head comment; `docs/superpowers/HANDOFF-galaxy.md` “The models” line; `HANDOFF-universe.md` one line for the fleet.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green; `scripts/galaxy-check.mjs`, `scripts/galaxy-war-check.mjs`, `scripts/universe-war-check.mjs` run and green.
- No kind the game has flies a Sketchfab or Meshy model on the galaxy map or the universe map; the PR lists the thirteen with their old and new file sizes and triangle counts.
