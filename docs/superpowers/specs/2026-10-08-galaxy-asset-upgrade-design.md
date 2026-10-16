# The galaxy's people and props, upgraded and rigged from the assets repo. The design

Date: 2026-10-08. Status: design, written from the owner's brief by an architecting session, for an Opus 5.5 implementation session (phases in order, one branch each). The plan is `docs/superpowers/plans/2026-10-08-galaxy-asset-upgrade.md`; the hand-off is `docs/superpowers/HANDOFF-galaxy.md`.

## What the owner asked

"We have a lot of planets and worlds that need asset upgrading and rigging. Architect a solution to go and see how we can use the assets at tilakverse-assets repo which houses them and start with the Star Wars galaxy worlds."

Two things are asked for: a way to use what is in `tilakpatell/tilakverse-assets` (the Quaternius CC0 packs and the Sketchfab Star Wars originals) in the site's worlds, and the Star Wars galaxy's seventeen landable worlds brought up first: better models where they are poor, and figures that move where they stand like statues or are built from boxes.

## Where the site is today

Read from the code in this session (`main` at a84e1c59).

**The seventeen worlds** (`galaxy/surface/sites/index.js`): tatooine, hoth, endor, kashyyyk, dagobah, yavin, naboo, kamino, geonosis, coruscant, mustafar, scarif, bespin, nevarro, mandalore, lothal, sorgan. Their people are `life` entries by kind; `actors.js`'s `figureFor` resolves a kind in this order: a `WALKERS` machine (`walkers.js`), a crew figure on the Meshy skeleton (`crew.js`, `crewList.js`'s `CREW`), a catalogue model (`catalog/*.js`, `modelFigure`: its own clips if `anim` names them, else `legRig.js` if `legs` says so, else a sway), a built figure (`figures.js`, boxes and cylinders), a prop.

**How every life kind is drawn now**, counted across the seventeen sites' `life` and their zones' `life` (a Node script in this session; the plan makes it a kept script, `scripts/galaxy-figures-audit.mjs`):

| how it is drawn | kinds | examples |
|---|---|---|
| crew figure on the Meshy skeleton, walks with every shared clip | 37 | stormtrooper, clone, luke, vader, tusken, wookiee, the troops |
| catalogue model with its own clips | 7 | atat, atst, atte, atap, bantha, c3po, ig11 |
| catalogue model, legs found at run time (`legs`) | 4 | ewok, gungan, geonosian, kaminoan |
| catalogue model rigged but with no clips named (`rig: true`, no `anim`): stands at bind pose | 3 | ithorian, rebelpilot, rebeltech |
| catalogue model, a statue (no skeleton): sways | 37 | thirteen people: anakin, cassian, jyn, krennic, k2so, baze, chirrut, armorer, clonephase1, dindjarin, sullustan, jawa, yoda; seventeen beasts: tauntaun, wampa, dewback, reek, nexu, acklay, kaadu, fambaa, blurrg, happabore, lothcat, lothwolf, bogwing, lavaflea, eopie, ronto, aiwha; seven droids and machines that are right still: astromech, r5, mousedroid, dwarfspider, probe, cloudcar, grogu |
| built in code (boxes) | 8 | villager (nine worlds), farmer, pilot, kenobi, jocasta, zam, caretaker, droid (the built astromech) |
| crew figure, still | 2 | hutt, dex |
| nothing (no model, no figure, a prop) | 3 | ghostben, shaak, wa7 |

So the gap is not "no models": it is figures that stand still. Twenty-four humanoid kinds are statues, bind poses or boxes, and the villager, the most-placed person in the galaxy, is boxes on nine worlds.

**The rigging the site already has**, and what each needs:

- `scripts/ual-bake.mjs` with `scripts/preview/ualRetarget.js`: Quaternius's Universal Animation Library (UAL1 and UAL2, Rigify `DEF-*` or Unreal `pelvis`/`thigh_l` names) retargeted onto the Meshy skeleton, rest-pose aware, baked to one GLB a clip in `public/games/meshy/ual-*.glb`. It only targets the Meshy 24-bone skeleton, by hard-coded name (`UAL_MAP`), read off `public/models/galaxy/crew/luke.glb`.
- `scripts/rig-transfer.mjs` (`rigFrom(donor, mesh, out, { tex })`): a crew figure's skin weights moved onto a new unrigged mesh of the same build in the same A-pose. Free. Needs a pose-matched donor; the arms-down Sketchfab statues do not match any donor (the Meshy rig step refused them for the same reason, `crewList.js`'s note).
- `legRig.js` (`leggedFigure`, `findLegs`): legs found in a statue by its shape at run time, skinned and walked. Needs only `legs: { crotch }` in the catalogue row. Works for anyone whose legs part below the crotch (not a Jawa's robe, not Yoda's).
- `src/lib/three/rig.js`: bones found by role (`ROLES`: Meshy, Mixamo, Unreal, Character Creator names) and posed by where each limb points, so one pose fits every skeleton. Not exported for the retarget's use, and it poses, it does not play clips.
- Meshy's rig step (5 credits, pose-fussy) and gen3d (the owner's desktop GPU, unrigged output) make new figures; neither runs in a cloud session.

**The assets repo** (`tilakpatell/tilakverse-assets`, public, 2,674 files, about 2.2 GB): nine Quaternius CC0 packs as downloaded (UAL1, UAL2 with the female mannequin, the city megakit, the street pack, furniture, the Ultimate Space Kit, farm animals, the stylized nature pack, the Stylized Nature MegaKit with 150 glTF plants, trees, rocks and paths), and `sketchfab/star-wars/README.md` listing six Sketchfab Star Wars originals on the `sketchfab-star-wars` release, split into 8 MB parts named `<file>.glb.part-aa`, `-ab`… with a `SHA256SUMS`. Read in this session: the AT-AT there is the same Sketchfab model `ice.js` already imports (uid 7eab3f41); the Venator and the TIE are ships the galaxy already has (`/models/universe/venator.glb`, `galaxy/tie.glb`); the B1 battle droid (20,431 triangles, four 4096 maps, 53 joints) has no clips and its joints are unnamed (`Bone.001_01`…), so neither the role finder nor the retarget can use it by name. `scripts/assets-fetch.mjs` fetches the Quaternius packs as zips from the site repo's own `assets-quaternius` release into `lab/assets/<pack>/`; nothing fetches the Star Wars release, and nothing reads the assets repo itself.

**Budgets** (`src/lib/budgets.js`, `scripts/galaxy-budget.mjs`): a world at high is held to 3M triangles; Endor is on `KNOWN_OVER` at 3.35M (its redwoods), Coruscant and Kashyyyk are near the line. A surface model is under 2.5 MB (4 MB for a `hero`), `catalog.test.js`.

## What of the assets repo the galaxy can use, and what it cannot

The Quaternius kits are toy-style low-poly; the galaxy's worlds are photo-real scans and film-matched models. `docs/assets/quaternius.md` already says the kits suit the stylized worlds more. For the galaxy, three things in the repo are right, and the rest is not:

1. **UAL1 and UAL2's clips**, on any humanoid skeleton. The galaxy's figures stand still for want of clips, not meshes. The libraries have 250 clips; the site bakes 115 of them, onto one skeleton. Baking them onto the other skeletons the worlds already have (Mixamo's on the Ithorian, the pilots and the technicians; the run-time leg rig's) is the biggest upgrade per hour of work, and it is free.
2. **The Nature MegaKit's ground cover and far trees**, where a low-poly shape reads fine: ferns, clover, mushrooms, pebbles, rock paths and grass clumps under the site's foliage shading (`lib/three/foliage.js` lifts their normals), close up on Endor, Dagobah, Yavin, Kashyyyk, Naboo, Sorgan and Lothal; and the giant pines and dead trees as the *far* instanced silhouettes (beyond the near ring, where Endor's `lo` redwoods already stand), which is where Endor's triangles go.
3. **The B1 battle droid**, only if it rigs by geometry from the site's own battle droid (the Battlefront one on the Meshy skeleton, `troops/battledroid.glb`) through `rig-transfer.mjs`, and only if it looks better on the sheet. It is 2.5× the triangles and sixteen times the texture of the one placed now.

Not for the galaxy: the city, street and furniture kits (Albuquerque's, Invincible's, the office's), the space kit (the Rick and Morty dimensions'), the farm animals (Middle-earth's), the Venator and TIE (already there, the built ones match the fleet's look; compare on a sheet before replacing, never by default), the female mannequin (no Star Wars figure is a mannequin).

## The pieces

### 1. `scripts/galaxy-figures-audit.mjs`: how every life kind is drawn, as a kept script

The table above, made every time, pure and tested: `drawnAs(kind, { CREW, SURFACE_MODELS, FIGURES, WALKERS }) → 'walker' | 'crew' | 'crew-still' | 'own-clips' | 'legs' | 'rig-noanim' | 'still' | 'built' | 'none'`, and `audit(SITES, …) → [{ kind, how, worlds }]`. The script prints the table as Markdown (`--json` as JSON) and exits 1 when a kind the plan has moved (its row names the `how` it should have reached) has slipped back. It is the measure of every phase.

### 2. The assets repo as a source: `scripts/assets-fetch.mjs` learns it

`assets-fetch.mjs` keeps its release zips and adds two ways in: `--repo` sparse-checks a pack's folder out of the assets repo into `lab/assets/<pack>/` (`git clone --filter=blob:none --sparse` once into `lab/assets/.repo/`, then `sparse-checkout add`), for a session with git but no release zip; and a `starwars` pack that fetches the `sketchfab-star-wars` release's parts by URL (`https://github.com/tilakpatell/tilakverse-assets/releases/download/sketchfab-star-wars/<file>.part-aa`…, joined, checked against `SHA256SUMS`) into `lab/assets/starwars/<file>`. Each named model's credit (author, licence, source URL) is in `PACKS.starwars.models`, copied from the assets repo's README, so an import can write `modelCredits.json` without Sketchfab's API. `docs/assets/quaternius.md` gets a section on the Star Wars release and the repo route.

### 3. The retarget for any skeleton: `scripts/preview/ualRetarget.js` targets bones by role

Today `retargetUal(src, clip, target)` writes tracks on the Meshy names in `UAL_MAP`. It gains a target map found by role: `rig.js` exports `findBones(root, named)` (it exists, unexported) and the retarget builds its map from the roles (`hips`, the spine chain, `head`, `armL`…`toeR`) for whatever skeleton the target has, falling back to `UAL_MAP` on a Meshy rig so every existing bake is byte-for-byte what it was (the plan's first test). Bones the target lacks (a shoulder, a toe) are skipped; a spine with a different count of bones takes the source's spine turn spread over its own (the existing `AIM` swing, per bone).

`scripts/ual-bake.mjs` gains `--rig <figure.glb> --into <out.glb> [--set core|life|pro|ual2]`: the figure's own file read as the rest skeleton, the set's clips retargeted onto it and written *into a copy of the figure's GLB* as its animations (names as `clipLibrary.js` names them: `idle`, `walk`, `run`, `talk`, `hit.chest`, `die`…), so no loader changes: the catalogue row names them in `anim` and `modelFigureOf` plays them as it plays any model's own. A `core` set is added: `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Idle_Talking_Loop`, `Hit_Chest`, `Death01`, `Sitting_Idle_Loop` (seven clips; at thirty frames a second as shorts, under 60 KB a figure). The set is what a surface figure needs to live (`actors.js`: walk, idle, talk, sit, hit, die); the full `life` set is there for a hero.

### 4. Statues that walk: `legs` on every still humanoid whose legs part

No code: catalogue rows. `anakin`, `armorer`, `baze`, `cassian`, `chirrut`, `clonephase1`, `dindjarin`, `jyn`, `k2so`, `krennic`, `sullustan` get `legs: { crotch }` measured on the model sheet (`scripts/preview/surface.html`), as the Ewok's and the Gungan's were. `jawa` and `yoda` stay swaying (robes). `anim-check.mjs` on Scarif, Kamino, Nevarro and Coruscant says their planted feet hold.

### 5. The rigged-but-silent three: Mixamo skeletons given the core set

`ithorian`, `rebelpilot`, `rebeltech` (`catalog/fill.js`, `rig: true`, no `anim`) are re-baked through piece 3 (`--rig public/models/galaxy/surface/<kind>.glb --into` the same path, `--set core`) and their rows get `anim: { idle: 'idle', walk: 'walk', run: 'run' }`. They are the proof of the retarget on a skeleton that is not Meshy's, and the first three statues to move for free.

### 6. The B1 battle droid, by geometry

Fetched by piece 2, brought to web size (`scripts/sketchfab-import.mjs --keep --tris 12000 --tex 1024`), then `rig-transfer.mjs`'s `rigFrom` with `troops/battledroid.glb` as the donor (the same build, both standing). If the result's `spread` is sane and it walks on the sheet with the shared clips, it is written to `troops/battledroid.glb` (the crew kind every world uses; the Battlefront file is kept beside it as `battledroid.bf.glb` and the credit swapped to leoxx300's CC BY 4.0). If it does not rig (pose mismatch, or the legs tear), nothing changes and the hand-off says why.

### 7. Quaternius ground cover and far trees for the forest worlds: `scripts/quaternius-import.mjs`

A new importer, modelled on `kenney.mjs` and `sketchfab-surface.mjs`: `node scripts/quaternius-import.mjs <pack> <Model> --kind <kind> --metres … [--tex 512]`, from `lab/assets/<pack>/glTF/`, through `scripts/lib/surface-model.mjs` (metal-rough, welded, meshopt, WebP, grounded), to `public/models/galaxy/surface/<kind>.glb`; its line goes into `public/cc0/README.md`'s Quaternius list (CC0: `madeKinds` finds it; no Sketchfab credit), and `scripts/credits.mjs`'s CC0 kits name Quaternius. A new catalogue group `catalog/quaternius.js` (`made: 'quaternius'`) with, to start: `qfern` (Fern_1/2), `qclover`, `qmushroom` (Mushroom_Common, RedCap), `qpebble` (Pebble_Round_1), `qgrass` (Grass_Common_Tall), `qpine` (GiantPine_1), `qdeadtree` (DeadTree_1), one model file a kind (variety comes from the scatter's `scale` and the seed, as the redwoods'). They go in through the sites' `scatter` lists, which the placer draws instanced near and as light copies far (`placer.js`'s `scatter`, `splits`); the forest sites add them: ferns and mushrooms within 60 m on Endor and Dagobah, clover and grass on Naboo, Sorgan and Lothal, and `qpine` as Endor's far ring in place of the `lo` redwoods beyond 640 m, `solid: false`. The gate: `scripts/galaxy-check.mjs surface endor` under 3M at high, and `endor` comes off `KNOWN_OVER`.

### 8. The built people: gen3d asks, rigged by transfer when they land

`villager`, `farmer`, `pilot`, `kenobi` (young Obi-Wan on Coruscant and Tatooine), `jocasta`, `zam`, `caretaker`, and the three with nothing (`ghostben`, `wa7`, `shaak`) are asked for from the owner's desktop through `scripts/desktop/ask.mjs gen3d` (one issue each, `--faces 30000`, a Wookieepedia picture, and in `--what` the words "standing in an A-pose, arms out from the sides, so it can be rigged from the site's crew"), `--dry-run` first and the issue bodies kept in `docs/superpowers/evidence/galaxy-asset-upgrade/gen3d-asks.md`. When one lands in `public/models/gen3d/`, `rig-transfer.mjs` with the crew donor of the same build (`officer` for the men, `twilek` for Zam, `jedi3` for old Ben, `ugnaught` for the Jawa-sized) writes `public/models/galaxy/crew/<kind>.glb`, and `crewList.js`'s `CREW` gets the row, so `actors.js` takes it over the built one with no other change. The droids (`droid`, `wa7`) are props, not rigged (an astromech rolls). `shaak` is a beast: a prop, swaying.

### 9. The beasts: out of scope, said so

The seventeen still beasts stay as they are. A four-legged `legRig` (four clusters, a trot gait) is the right next design, not this one: `findLegs` is two-cluster by construction, and a wrong trot reads worse than a sway. The audit script keeps counting them so the next design starts from the number.

## Decisions (for the owner to overturn)

- **Clips are baked into each figure's GLB, not into a shared library file.** A shared file per skeleton would need a loader to match files to skeletons; embedding needs nothing (`modelFigureOf` already plays a model's own clips) and costs under 60 KB a figure for the core set. The crew on the Meshy skeleton keep the shared library as they are.
- **Rigging is by retarget and transfer, never by a paid service.** Meshy's rig step is not run; gen3d asks are filed, not waited for. Everything in phases 1 to 4 completes in a cloud session with no key.
- **Quaternius goes in as ground cover and far silhouettes only.** Not as near trees, not as buildings, not as people: the style clash is the reason, and the owner's own note says so.
- **The crew's resolution order is not changed.** A kind in `CREW` still wins over the catalogue; that is why the B1 is written as the troops file and the built people as crew rows, not as new catalogue kinds.
- **The B1, the Venator and the TIE are compared, not assumed better.** Only the B1 is tried; the two ships stay.
- **Nothing the sequels touched comes in** (the surfaces hand-off's first rule): the asks name no sequel-era figure.

## What this is not

Not a Meshy or Sketchfab spend; not a new world; not a change to the universe map, the Death Star interior, the other fandoms' worlds, or the galaxy's ships; not a retarget of the beasts; not a change to `clipLibrary.js`'s registry or `animator.js`.

## Phases and dependencies

| Phase | Pieces | Depends on | Done when |
|---|---|---|---|
| 1 | 1, 4 | nothing | the audit script runs and is tested; eleven statues walk on the sheet and in `anim-check` |
| 2 | 2, 3, 5 | 1 (the audit measures it) | `ual-bake --rig` bakes the core set onto a Mixamo skeleton; the three silent figures walk; every existing `ual-*.glb` re-bakes byte-identical |
| 3 | 6 | 2 | the B1 walks as the troops' battle droid, or the hand-off says why not |
| 4 | 7 | 2 (the fetch) | Endor under 3M at high and off `KNOWN_OVER`; ferns and mushrooms on the forest floors |
| 5 | 8 | 2 (rig-transfer path proven on the B1 or the sheet) | ten gen3d issues filed with A-pose wording; a `CREW` row and a transfer command ready for each in the hand-off |

## Testing

Pure modules in Node (`vitest`): the audit's `drawnAs` and `audit`; the retarget's role map on `meshyRig.fixture.js` and on a Mixamo fixture (the Ithorian's skeleton, nodes only, as `restRig` reads Luke's); the bake's byte-identity on `ual-talk.glb`; `catalog.test.js` as it is (every new kind credited or listed, under size). Browser: `anim-check.mjs` per world touched (planted toes under 0.15 m/s, no figure at bind pose), `galaxy-check.mjs surface endor` for the budget, `surface-shot.mjs` for a picture of each change in the PR.

## Open assumptions, marked

- The three `fill` figures' skeletons are Mixamo's with a suffix (`mixamorig:Hips_52`, `mixamorig:LeftArm_16`, read in this session), which `rig.js`'s `plain` does not strip. `findBones` learns to drop a trailing `_<digits>` before matching. (The Ithorian already carries one clip, `walk-ip`; the core set is baked beside it.)
- `rig-transfer.mjs`'s donor match tolerates the B1's thinner limbs (its `turn` weighting keeps one thigh off the other). If not, Phase 3 ends with the hand-off note.
- The Nature MegaKit's glTF files carry their own maps (`Leaves_GiantPine`, `Bark_PineTree`): the importer keeps them and WebPs them at 512.
- The owner's desktop runner takes gen3d issues filed from a cloud session (`scripts/desktop/ask.mjs` uses `gh`; in a session where `gh` is refused, the bodies are written to the evidence file for the owner to file).
