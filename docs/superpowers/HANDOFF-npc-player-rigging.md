# Handoff: NPC and player rigging (six phases, one branch each)

Fingers on every Meshy figure by its own geometry, a hand layer that grips, fists, waves and rests, the library’s finger motion carried along, a crouch that moves in eight directions for the player and the NPCs, toy and show bodies scaled to their proportions with a reach guard, the game-rip figures on the library by role, and a script and a sheet that measure all of it. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md` (what and why; where the site is; the four families; the decisions; what it is not)
2. `docs/superpowers/plans/2026-10-08-npc-player-rigging.md` (your phase’s tasks: files, interfaces, tests)
3. `docs/decisions/2026-10-08-fingers-on-the-meshy-skeleton.md` (why bones are added, not the skeleton replaced)
4. The headers of `src/lib/three/rig.js`, `animator.js`, `locomotion.js`, `clipLibrary.js`, `figureCalls.js`, `ik.js`, `meshyRig.fixture.js`; `src/components/universe/grip.js` and `gunplay.js`; `scripts/ual-bake.mjs` and `scripts/preview/ualRetarget.js`; `scripts/anim-check.mjs`
5. The lanes beside you: `docs/superpowers/HANDOFF-galaxy-asset-upgrade.md` (the retarget by role, `targetMap`, the core set into a Mixamo rig: Phase 2 of that lane is the path Phase 5 here reuses) and the living-characters docs (`docs/superpowers/specs/2026-10-07-living-characters-design.md`, `docs/research/2026-10-07-character-audit.md`)
6. `docs/assets/quaternius.md` (the packs: `node scripts/assets-fetch.mjs ual1 ual2`; the free Godot pack goes at `scripts/preview/.ual/ual.glb`, git-ignored)

## Which phase is yours

| Phase | Branch | Tasks | Starts from | Blocked by |
|---|---|---|---|---|
| 0: the audit, profiles | `claude/rigging-p0` | 1 | `main` | nothing |
| 1: fingers on five figures, the hand layer, the grips, the sheet, the twist | `claude/rigging-p1` | 2–8 | `main` after 0 | 0 |
| 2: every Meshy figure; the library’s fingers | `claude/rigging-p2` | 9, 10 | `main` after 1 | 1 |
| 3: the crouch | `claude/rigging-p3` | 11, 12 | `main` after 1 | 1 (the audit and sheet only) |
| 4: the families | `claude/rigging-p4` | 13, 14 | `main` after 2 | 2 |
| 5: the game rips | `claude/rigging-p5` | 15 | `main` after 2 | 2 |

Phases 3 and 4 may run at once on separate branches after 2 (3 needs only 1, so it may start sooner). One session can take the phases in order, merging each before the next; stop and write the status table when your context is heavy, and the next session picks up the next phase.

## The rules (don’t break)

- **No paid service.** No Meshy, no Sketchfab API, no Tripo. The finger source is the Universal Animation Libraries in the assets repo and the site’s release; a step that would need a key stops and says so in the PR.
- **One skeleton.** Bones are added to the Meshy skeleton; nothing is re-rigged; every existing clip keeps playing. A figure file already extended is left alone (the script is idempotent and the test holds it).
- **Byte identity**: the body tracks of every shipped `ual-*.glb` after Task 10; every `real` figure’s posed bones under `forFigure` after Task 13. The tests are the law.
- **Hand poses are scalars in the canonical frame** (`handPoses.js`), never quaternions on a rig’s names.
- **Layers and sizes** (`docs/health/RULES.md`): `src/lib/three` knows no world; files under 800 lines; a figure file grows under 12 KB; a `ual-*.glb` stays under 80 KB; nothing under `lab/` is committed.
- **Nothing a visitor can do is lost.** `KeyC` is the one key added; every other key, save, achievement, sound and ghost works after as before. An older online client without the crouch bit walks standing.
- **One phase per PR, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never rebase anyone’s branch. Merge `origin/main` in before opening and again before merging; `locomotion.js`, `animator.js` and `gunplay.js` are edited by other lanes too, so a conflict there is resolved by keeping both sides.
- **Before the PR**: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; `node scripts/rig-audit.mjs` before and after; `anim-check` on each route touched with the phase’s flag; the hand sheets (`scripts/hands-sheet.mjs`) under `docs/superpowers/evidence/rigging/`.
- Keep output terse. Commits end with the harness’s attribution lines; no model names in code, docs or commits. British spelling, curly quotes, plain sentences; comments say why.

## What done looks like, per phase

- **0**: `node scripts/rig-audit.mjs` prints the table (family, joints, fingers, twists, clips, tris, textures, profile) for every figure under `public/`, tested; `audit-before.md` saved; every figure GLB carries `extras.profile`; the fixture takes `fingers: true`.
- **1**: Luke, a stormtrooper, Aragorn, Rick and Mark carry 28 finger bones (a thumb has two) and two twist bones in the canonical frame; `hands-real.png`, `hands-toy.png`, `hands-show.png` show a grip round a pistol, a rifle and a saber (thumb on top, no tear at the wrist), a fist, an open wave and a relaxed rest; `gunplay` and `saber` hold through `hands.js` and the morph only on an unextended figure; `anim-check` on `#/galaxy/tatooine/surface`, `#/c-137`, `#/middle-earth/bree`, `#/invincible` reports the same numbers as on `main`.
- **2**: every `meshy24` figure is `meshy54` or listed in `extend-skipped.md` with why; the 118 `ual-*.glb` are re-baked with finger tracks, body tracks byte-identical, total under 5.5 MB; a talk and a sit move the hands on the sheet; the Citadel’s and Edoras’s frame time quoted before and after.
- **3**: `C` crouches on the galaxy surface, the universe on foot, the Rick and Morty world, Invincible’s ground and Middle-earth’s towns; crouch-walking in eight directions keeps the planted toe under 0.15 m/s; the capsule shortens and standing waits for headroom; hostiles shuffle sideways in cover; ghosts crouch; the guide names the key; `anim-check --crouch` passes on each route.
- **4**: `familyOf` sorts the cast; toy and show figures play exaggerated and snapped with the reach guard (a toy’s wave and phone call clear its head on the sheet); `real` is the identity in the test; the family numbers are on the debug panel under `figures`.
- **5**: Thor, the Hulk, Spider-Man and Mario play the core set with their own fingers through an animator; Cybertron’s robots make fists; `hands-game.png`.

## How to check

- Vite on 5188 in your worktree (`.claude/launch.json` entry, `preview_start`); on Windows `CHROME=` Edge for every shot script (see the galaxy walk-layer notes in the repo’s memory: the hidden browser pane stalls the universe page, so shoot headless).
- `node scripts/anim-check.mjs --route '#/galaxy/tatooine/surface' [--hands|--reach|--crouch --do 'key:KeyC'] --json out.json`.
- `node scripts/hands-sheet.mjs real public/models/galaxy/crew/luke.glb`.
- Dev hooks: `window.__hands` on the sheet page; a figure’s `fig.hands.curl('R')` in a world’s debug.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan’s line in your PR and say so in the PR body in one sentence. If `handShape` cannot live in `src/components/universe/grip.js` for a script’s import (the layer rule), move it and `bendFinger` to `src/lib/three/handShape.js` with the same names and have `grip.js` import them; say so.

## Status

| Phase | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/npc-player-rigging-arch-7699df` | (this PR) |
| 0 | the rigging session | `claude/rigging-p0` | (this PR) |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

Findings for the next phase go here: which hands the clustering skipped and why, the sizes before and after, the frame time on the Citadel and Edoras, which worlds took the crouch and which key was free, the family numbers as tuned.

**Phase 0.** 270 figure files, 657 clip files. 225 stand on Meshy’s 24 bones (no fingers); 7 Mixamo (C-3PO, the Ithorian, the rebel pilot and tech, IG-11, Thor, and the bantha’s Mixamo-named rig), 2 Unreal (the Hulk, Spider-Man), 1 Rigify (Mario), 20 High Moon, 4 on the Transformers: Prime game’s rig (`prime`, a family the design didn’t name: Arcee, Bulkhead and his car, the Vehicon), 11 none (walkers, beasts, Black Widow’s Auto-Rig Pro, Predaking, Shockwave, the Biped Optimus). Every figure keeps `extras.profile` on its default scene now, written into the JSON chunk alone (117 bytes a file, no vertex moved). Measures to know: Meshy places `head_end` anywhere from the brow to a hand over the crown, so the head and the hand are measured from the vertices each bone mostly moves, never from the joints. The head over the height (least, median, most): Middle-earth 0.234, 0.292, 0.402; Rick and Morty 0.095, 0.141, 0.312; the office 0.081, 0.114, 0.141; the galaxy crew 0.062, 0.088, 0.149; troops, Invincible and Albuquerque under 0.12. The spec’s `toy` line (over 0.11) would take half the office and most of Rick and Morty: tune it in Phase 4. The finger count is 28 a figure (a thumb has two, as the spec’s names say), plus two twists: `meshy54`. UAL’s thumbs have three joints: Phase 2 maps two of them. The canonical frame is right-handed (+x = y × z), so +x points to the thumb on the left hand only; a curl closes about −x on both.
