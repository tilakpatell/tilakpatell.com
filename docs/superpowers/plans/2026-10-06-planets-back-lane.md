# The planets overhaul, back lane — implementation plan

> **For agentic workers:** the owner asked for no subagents. Execute with
> superpowers:executing-plans, task by task, merging to `main` after each.
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Run the planets overhaul from the back of its queue while
another session runs it from the front: the Outer Rim and Scarif (CP11),
then Coruscant, Kamino and Geonosis (CP10), then Kashyyyk, Dagobah and
Yavin 4 (CP9), plus the planets as seen from space.

**Architecture:** No engine changes. Worlds get real models through the
existing catalogue (`catalog/<group>.js`) and import script
(`scripts/sketchfab-surface.mjs`), placed from `sites/<group>.js`. Kinds
new to a world get new names, so a shared built kind (`adobe`, `tent`,
`crates`) never changes under Tatooine. Space planets get a shader pass in
`bodyShaders.js` and `bodies.js` (`LOOKS`).

**Tech Stack:** three r186, Vitest, `@gltf-transform`, Sketchfab Data API,
Meshy (fallback), playwright-core (`scripts/galaxy-check.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-06-planets-overhaul-design.md`
(goals, asset ladder, quality gate, budgets). Lane split agreed with the
owner on 2026-10-06: this lane takes CP11, CP10, CP9 in that order, and
the space-side planets; the front lane (`claude/sharp-carson-h9c6mp`)
keeps the engine and CP3 onwards. Whoever reaches a checkpoint the other
has claimed skips it.

## Global Constraints

- No subagents. No sequel-trilogy (Ep 7–9) content.
- Never print or commit `SKETCHFAB_API_TOKEN`, `MESHY_API_KEY`, `MESHY_KEY`.
- Don't edit the front lane's engine files: `placer.js`, `scene.js`,
  `actors.js`, `near.js`, `terrain.js`, `walker.js`, `blaster.js`,
  `quests.js`, `figures.js`, `activity.js`, `ground.js`. Don't edit
  `catalog/desert.js`, `sites/desert.js`, `props/desert.js`, or Naboo's
  parts of `sites/core.js`.
- Don't touch the ship-customisation files (`shipModels.js`, `hulls.js`,
  `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`) or
  swap `xwing-hd.glb` / `falcon-hd.glb`.
- Asset ladder: Sketchfab first, and only models that look like the films
  or shows and are properly textured; Meshy from a real reference when
  Sketchfab has nothing good. Licences CC-BY family or CC0, credited in
  `src/data/modelCredits.json`; nothing ripped from a game.
- Per model: small props ≤ 15k tris / 512 maps; houses and vehicles ≤ 40k
  / 1024; landmarks ≤ 90k / 2048. LOD1 over 20k tris. GLB ≤ 2.5 MB (≤ 4 MB
  with `hero: true`).
- Per world at the landing, high quality: calls and triangles ≤ baseline
  +10%, never over 600 calls or 2.5M triangles; models ≤ 40 MB.
- British spelling, curly quotes, comments say why.
- Merge to `main` after every task that is green (lint, tests, build,
  browser check). Merge `origin/main` in first; never rebase or force-push.

## Review Focus

1. **A model that fails to load.** The built prop the kind falls back to
   still stands there, or the place is empty but walkable: a new kind
   with no built prop must not throw. Pinned by `catalog.test.js` (every
   kind used by a site is a model or a built prop).
2. **A model floating or sunk** at its place on sloped ground. Each place
   with a model is `flat` or the model has `sink`; checked by shot.
3. **Phones and low tier.** `QUALITY=low` galaxy-check on each world.
4. **Credits drift.** `modelCredits.test.js` requires every credited file
   to exist; a dropped model drops its credit.
5. **A space planet at a glancing angle or in eclipse.** The shader pass
   must hold its terminator and limb, checked by shots of two systems at
   two times.

---

### Task 0: Claim the lane

**Files:** Modify `docs/superpowers/plans/2026-10-06-planets-overhaul.md`
(a "Lanes" note under the header), create this plan.

- [ ] Add the note: CP9, CP10, CP11 and the space-side planets belong to
  the back lane (`claude/wizardly-noether-5dlsg9`, this plan).
- [ ] Commit, push, PR, merge to `main`.

### Task 1: Scout tool

**Files:** Create `scripts/sketchfab-scout.mjs`, `scripts/sketchfab-scout.test.mjs`.

**Interfaces:** `usable(model) → boolean` (downloadable, licence in
`by, by-sa, by-nc, by-nc-sa, cc0`, and its name, description and tags
free of `rip|ripped|extracted|game asset from`); CLI
`node scripts/sketchfab-scout.mjs "<query>" [n]` prints uid, name,
faces, licence, author, and writes a thumbnail contact sheet to `$OUT`.

- [ ] Test `usable` on a CC-BY model (true), an all-rights-reserved one
  (false), a "ripped from" one (false). Run, see it fail, implement, pass.
- [ ] Commit.

### Task 2: CP11, the Outer Rim (Nevarro, Mandalore, Lothal, Sorgan)

**Files:** `catalog/outer.js`, `sites/outer.js`, `props/` only if a new
built kind is needed, `public/models/galaxy/surface/*.glb`,
`src/data/modelCredits.json`.

Heroes and dressing, each a new kind:

| World | Kinds |
|---|---|
| Nevarro | `nevarrohouse` (the town's domed huts), `nevarrocantina` exterior, `remnantbase`, volcanic rock scatter |
| Mandalore | `sundaridome` (the broken dome), Mandalorian camp props, glass shard scatter |
| Lothal | tall-grass scatter, `lothspire` (the tall rock spires), `lothtower` (Ezra's tower), loth-cats |
| Sorgan | forest scatter (trees, ferns), `stilthut` (the krill farmers' huts) |

- [ ] Scout each (Task 1), shortlist, download, gate by render.
- [ ] Add catalogue entries; run `node scripts/sketchfab-surface.mjs outer <kinds>`.
- [ ] Place them in `sites/outer.js`; teleport-check each place.
- [ ] `npx vitest run src/components/galaxy/surface src/data`, lint, build.
- [ ] `galaxy-check surface nevarro,mandalore,lothal,sorgan` at high and
  low, against this lane's baseline; before/after shots to the owner.
- [ ] Commit per world, merge to `main`.

### Task 3: CP11, Scarif

Kinds: `citadel` (hero, LOD), a beach-and-lagoon dressing pass (palms
denser by the shore, sand nearer the water), `scarifpad`, bunkers.
Same steps as Task 2 with group `edge`.

### Task 4: The planets from space

**Files:** `src/components/galaxy/bodyShaders.js`, `src/components/galaxy/bodies.js`.

- [ ] Shots of every family from orbit (`galaxy-check space`), as the
  before set.
- [ ] Fix what reads wrong: Hoth's smeared ice (crevasse and rock
  patterns), Endor's flat forest (canopy relief and colour variation),
  lava worlds' cartoon cracks. Keep the octave budget (`uMaxOct`, the
  footprint-based octave count) and the per-family `#define`s.
- [ ] `npx vitest run src/components/galaxy`; shots after; merge.

### Task 5: CP10, Coruscant, Kamino, Geonosis

Kinds from the overhaul plan's CP10 table (skyscraper ×18 shared with LOD,
senate, republica, kpad, kmast, slave1, hive ×14 with LOD, atte,
coresphere, solarsailer, commandpost, pillars). Steps as Task 2 with group
`core`; Naboo's parts of `sites/core.js` untouched.

### Task 6: CP9, Kashyyyk, Dagobah, Yavin 4

Kinds from the overhaul plan's CP9 table. Steps as Task 2 with group
`forest`; Endor's parts untouched (CP6 is the front lane's).
