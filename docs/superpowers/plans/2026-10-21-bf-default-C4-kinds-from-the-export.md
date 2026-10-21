# Lane C4: the kinds the game has, brought in from the export

Design: `docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md`, decision 5. Branch `claude/bf-default-c4-kinds`. One PR (or one a kind if the first proves slow: each stands alone). Wave 2: starts once C1 is on `main`. **The desktop’s lane**: the export is at `C:\Users\tilak\Downloads\BF2_Extract\web` and nowhere else.

## Read first

- `scripts/bf2017-import.mjs` (its head: `--root`, `--rig`, `--crew`, `--full`, `--join`, `--far`, `--cuts`, `--bind`), `scripts/lib/bf2017-manifest.mjs`, `scripts/bf2017-fauna.mjs` (a kind on its own rig, end to end), `scripts/bf2017-rigclips.mjs`, `scripts/bf2017-clips.mjs`.
- `src/lib/three/ownRig.js`, `rigSets.js`, `walrusSets/fauna.js`, `walrusClips.js` (`OWN_RIGS`), `src/lib/cast/bodies.js` (C1’s table).
- `docs/superpowers/evidence/bf2017-phase2/cast.md` (how each phase-2 kind was judged), `docs/superpowers/specs/2026-10-10-bf2017-cast-left-design.md`.
- The owner’s rules in `HANDOFF-battlefront.md`: the 2017 rig in full, the game’s textures untouched (a smaller cut only by dropping mip levels), a surface model under 2.5 MB (4 MB for a hero), no sequel era (`isSequel`), credits in `src/data/modelCredits.json`.
- `scripts/clip-shot.mjs` (the sheet), `scripts/assets-publish.mjs` (the full cut to the bucket by hash; needs the owner’s key in the environment: if it is not there, publish nothing, commit the light cut, and say so).

## Tasks

1. **The root.** Check that `--root C:\Users\tilak\Downloads\BF2_Extract\web` reads the export as `lab/assets/bf2017/` would (`models.jsonl`, `textures.jsonl`, the models’ files, the data records). If one path differs, add it to the script, tested, and say so.
2. **The B1’s markings.** Find the B1’s markings map in the export (`textures/characters/markings/…`, `textures.jsonl`), import the game’s B1 (`characters/dark/d_assault_preq/…`: the walking body, not the folded static) with `--rig --crew`, and compare its sheet with `public/models/galaxy/troops/battledroid.glb`’s. Swap `battledroid`’s row to the game’s only if the sheet says it is better (the hand-off’s B1 note: the tan). Either way, the row’s `could` says what was found.
3. **Yoda and Grievous** (`characters/hero/yoda/yoda_01/yoda_01_mesh`, `characters/hero/generalgrievous/generalgrievous_01/generalgrievous_01_mesh`), each on its own rig with its own pack (the game’s clips for that skeleton, `bf2017-rigclips.mjs`), `hero: true`. A cast row each (`source: 'game'`); `heroes.js` lists them `soon` until a saber hero on an own rig fences (the saber is one path on the humanoid rig: `HANDOFF-battlefront.md`); as surface people they walk now.
4. **Iden Versio**, act 1 (`characters/hero/iden/…`; refuse any `a3/` path: `isSequel` and the owner’s rule), on the humanoid skeleton with the humanoid pack; a cast row; a hero candidate with her blaster (the TL-50 is `weapons.json`’s).
5. **The Jawa, the dewback, the bantha** on their own rigs (`bf2017-fauna.mjs`’s pattern), `far` cuts; cast rows; placed where the worlds already place a jawa, a dewback or a bantha (`surface/sites/`: Tatooine), swapping only where the sheet says better than the site’s (`catalog/`’s).
6. **Credits, sizes, bytes.** Each kind credited; each file within the size rule; `WORLD_MB` unchanged or measured.
7. **Docs.** `HANDOFF-battlefront.md` “The cast”: the kinds brought in and what is left; `evidence/bf2017-phase2/cast.md` a row each.

## Done when

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `npm run coverage:bf2017` green.
- Each kind’s clip sheet in the PR beside the site’s (where one existed), each a sentence on which is better and why.
