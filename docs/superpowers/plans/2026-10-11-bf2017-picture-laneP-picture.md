# Lane P: the picture on every world. Each world passes its record’s picture

The design: `docs/superpowers/specs/2026-10-11-bf2017-picture-everywhere-design.md` (§3.3, §4 “P”). Branch `claude/bf2017-p-picture` from `origin/main`. One PR. The rules: `docs/health/RULES.md` and `.claude/skills/autopilot/SKILL.md`.

Read first: `docs/superpowers/plans/2026-10-10-bf2017-surfaces-laneQ6-picture.md` and `docs/superpowers/evidence/bf2017-surfaces/Q6/README.md` (what `picture` is, what the textures turned out to say, what is left), `scripts/bf2017-picture.mjs`, `src/lib/three/light/grade.js`, `src/data/bf2017/light/hoth.picture.json` (the one written), `scripts/bf2017-light.mjs` (the VE records to `light/<world>.json`), `src/components/galaxy/surface/gameLit.js` (`applyGameLight`, the weather crossfade), `src/components/galaxy/surface/sites/*.js` (where a site names its record).

The bucket needs `SUPABASE_URL` and `SUPA_KEY` in the environment; stop at once and say so if they are absent. Never print a key. List the bucket with the scripts (`scripts/bf2017-fetch.mjs --folder …`, `NODE_USE_ENV_PROXY=1`), never through the Supabase connector (its permission prompt blocks an unattended session).

## Tasks

1. **The records.** `node scripts/bf2017-picture.mjs <world>` for bespin, endor, geonosis, kamino, kashyyyk, naboo, scarif, tatooine, yavin, and every weather each `light/<world>.json` names (the day, the sunset, the interior): `src/data/bf2017/light/<world>.picture.json` with the panorama, fog gradient, cloud-shadow and LUT urls through the manifest (`scripts/assets-publish.mjs`, published by hash), each number with its `_source`. Where a record names no panorama (an interior, a space level), the file says so and `applyGameLight` keeps the model’s sky.
2. **The LUT at 33³.** `bf2017-light.mjs` cuts the LUT to 17³; keep the game’s 33³ for the picture file (the strip is small), with a test that the middle of the ramp is read where the record puts it.
3. **The sites.** Every `galaxy-surface` site whose world has a record passes `picture: '<world>.picture.json'` (the sixth design’s picture lane left this; `sites.test.js` pins it for all that have one).
4. **The crossfade.** `gameLit.js`’s weather crossfade carries the panorama texture, the LUT and the Gaussians, not only the gain (Q6’s “Left”): the second weather’s textures are loaded ahead, the chain rebuilt once at the fade’s end, the gain eased across.
5. **Calibration.** For each world, the mean linear luminance of the fixture frame with and without `picture` (`node scripts/light-fixture.mjs --picture … --tier ultra --legs webgl`), against lane S’s band (`docs/superpowers/evidence/bf2017-light/`); a world outside the band is a finding, not a constant.
6. **Evidence.** `docs/superpowers/evidence/bf2017-picture/p/README.md`: the table per world (panorama size, LUT size, weathers, luminance before and after) and a shot per world with `picture` at ultra on the fixture.
7. **The hand-off** row; merge `origin/main`; the full checks; the PR.

## Not this lane

Drawing the picture on the galaxy surface (T2 wires `picture` into `scene.js`; until it lands, the fixture is where the picture shows); the HDR panoramas (the desktop’s re-encode, listed in the hand-off).
