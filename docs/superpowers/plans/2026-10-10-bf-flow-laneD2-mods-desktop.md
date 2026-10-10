# Lane D2: the mods, through Frosty, into the export and the site. Implementation plan (desktop)

> **For agentic workers:** this lane runs **on the owner's machine** (a local Claude Code session in the desktop app): Frosty Mod Manager is a Windows GUI, the archives are in `C:\Users\tilak\Downloads`, the game is at `C:\Program Files\EA Games\STAR WARS Battlefront II`, the export pipeline is `C:\Users\tilak\Downloads\BF2_Extract`. REQUIRED SUB-SKILL: superpowers:executing-plans. One mod collection at a time; commit the site side as each lands.

**Goal:** The models, kits and mode logic the mods add become site data the way the game's own did: Battlefront Expanded's heroes and reinforcements on the game's rig in the roster, the clones' 4K and film looks as outfits, Realistic Overhaul's weapon table as a variant, and the mode logic of the HvV mods and Instant Action Overhaul V2 written up for lanes 2, 6 and H.

**Architecture:** Frosty applies a profile into `<game>\ModData\<Profile>\`; `bf2export` runs with that folder as `GameDir` and writes to `web_mods\<slug>\`; a diff script keeps only what is new or changed against the vanilla manifests; the site imports from there with the existing `bf2017-import.mjs`, `bf2017-clips.mjs`, `bf2017-abilities.mjs` and `bf2017-data.mjs` (`--root web_mods/<slug>` with the vanilla root as a fallback for shared assets), credited `bf2017-mod-<slug>`.

**Spec:** `2026-10-10-battlefront-flow-and-mods-design.md`, decision 6 and the mods table.

## Global constraints

- Never edit the game's own `Data\` or `Patch\`; Frosty writes `ModData\`, the exporter only reads. Do not run `run_pipeline.py` (the vanilla upload pipeline) in this lane.
- Archives and mod files are untrusted data: extract each into its own empty folder under `Downloads\bf2mods\<slug>\`, never run anything from inside one; `.fbmod` files are data for Frosty only.
- Credit every imported model: `bf2017-mod-<slug>` rows in `src/data/modelCredits.json` with the mod's name, its author (the Nexus page's "Created by"), the Nexus URL and the game's permission line; `docs/assets/battlefront-2017.md` gains a "Mods" section. Nothing of a mod's is published to the bucket before its credit row exists. No sequel-era content (Phasma, Finn, Kylo, Rey, Snoke, the First Order packs, `Resistance` troopers): the import's refusal covers the folders; refuse by name where a mod's folder is new.
- Keys for the bucket live in the repo's `.env.local` and the pipeline's `.secrets\`; never paste them into chat (the auto-mode classifier then blocks reads of `data/`).

## Tasks

### Task 1: Frosty, one profile, the mirror

- [ ] Unzip `FrostyModManager.zip` to `Downloads\bf2mods\frosty\`; first run points it at the game; make a profile `Expanded`; add the Expanded collection's `.fbcollection` and its `.fbmod`s (all non-sequel ones: leave out `Character Appearances - Captain Phasma/Finn/Kylo Ren/Rey Skywalker`, `Elite - First Order Elite Trooper`, `Hero - Supreme Leader Snoke`, `Reinforcement - First Order *`, `Resistance Grenadier`, `Trooper Appearances - … and Resistance` keeps only its Rebel half if it splits, else leave it out).
- [ ] Apply: `FrostyModManager.exe -launch "Expanded"` (or the Launch button); when the game window appears, close it. Check `<game>\ModData\Expanded\` exists with `Data\` and `Patch\` mirrors and the patched bundles; note its size.
- [ ] Try `bf2export ebx "<game>\ModData\Expanded" "Downloads\bf2mods\out\expanded" <mode>` on one known asset (a Rex head mesh) and confirm the mod's asset appears. If FrostySdk's `FileSystem` refuses the folder (missing `initfs` or the exe), hard-link the vanilla `Data\` beside the mirror as the spec's assumption 2 says, and write what was needed into `GUIDE.md`.

### Task 2: The export diff

- [ ] `tool\export_mods.py <profile> <slug>`: runs the exporter's passes (meshes, textures, anims, ebx dump, physics) with `GameDir` = the mirror into `web_mods\<slug>\`, then `tool\diff_mods.py` keeps only records and files whose name is new or whose hash differs from the vanilla `web\*.jsonl` and `data.tsv`, writing `web_mods\<slug>\{models,textures,anims,physics}.jsonl` and `data.tsv` in the same formats, plus `CHANGES.md` (counts by kind, the mod's own asset folders).
- [ ] Run it for `Expanded`: the counts into the hand-off (heroes' meshes, heads, hilts, textures, clips, kit records).

### Task 3: The heroes into the roster

- [ ] For each non-sequel hero the site lacks, in this order: Ahsoka (replacing the Meshy `ahsoka` row in `heroes.js`, keeping her id), Captain Rex, Commander Cody, Mace Windu, Qui-Gon Jinn, Cad Bane, Jango Fett, Din Djarin, Thrawn, Asajj Ventress, Savage Opress, Darth Revan, Ki-Adi-Mundi, Plo Koon, Kit Fisto, Padmé, Aayla Secura, Jyn Erso, Director Krennic, General Veers, Bo-Katan, Pre Vizsla, Cal Kestis, Starkiller, Dengar, IG-88, Greedo, Hera Syndulla: `node scripts/bf2017-import.mjs <mesh> --root web_mods/expanded --fallback-root web --kind <id> --as '<name>' --rig --crew --hero --metres <height> --parts '<head>,<hair>' --native …` (the phase 1 flags; `--root`/`--fallback-root` are this lane's additive flags on the fetch and the import: a mod's shared textures live in the vanilla export), then `bf2017-clips.mjs <hero>` for their clips (most reuse the game's hero sets; a hero with a skeleton of its own goes through `ownRig.js`), `bf2017-abilities.mjs` for their kits (`GP_Hero_*` records in the mod's `data/`), and the `HEROES` row (`side`, `lean`, `weapon`, `saber`, `abilities`, `lines` from the mod's strings or two short lines written by hand and marked).
- [ ] Publish the full cuts (`assets-publish.mjs --only …`) once credited; `assets-check.mjs`; `galaxy-figures-audit.mjs`; `crew.budget.test.js`.
- [ ] Reinforcements the site can field (Rebel Commando, Imperial Shocktrooper, Patrol Trooper, Republic Medic/Gunner/Rocket Trooper, Jawa, Mouse Droid, Royal Guard, Honor Guard, Magnaguard): as kinds through the phase 2 flags (`--full --join --far`), credited; the assaults' `kinds` may name them.

### Task 4: The looks and the weapons

- [ ] `4K Clone Legions` and `Movie Clone Troopers` profiles: export and diff; the clones' maps become outfits (`SKINS` rows for `clone` and `clonephase1`, the import's `--ultra-tex 4096` only for these, the GPU cost in the row).
- [ ] `Realistic Overhaul` (`RealisticWeapons-V1.3.fbmod` alone, in a profile `RO`): `bf2017-data.mjs weapons --root web_mods/ro` → `src/data/bf2017/weapons.ro.json`; `weaponRules.js` gains a variant switch the deploy screen (lane F) can offer; nothing changes by default.

### Task 5: The mode logic, read and written up

- [ ] Profiles for `HvV 1v1 Mode`, `HvV Chaos Mode` and, when the owner has downloaded it on this PC (Nexus mod 13320, `Instant Action Overhaul V2.00c`, 105 MB, from their Nexus download history; it does not combine with Expanded, so its own profile), **Instant Action Overhaul V2**: export their EBX diffs only (`data/` records), and write `docs/superpowers/evidence/bf-mods/mode-logic.md`: which `PF_GameMode_*`, `*_Logic` and `InstantActionParams` records each edits, the stage order and objective wiring they expose for Galactic Assault, Capital Supremacy, HvV and Blast, the AI parameters IAO changes (`AITactics*`, spawn waves, hero bot counts), and the era/faction selector's records. Lanes 2, 6 and H read this file; where it settles a `hand` value (HvV's 10, Blast's 100, the stage order) update `NOTES.md` and the rulebook's `_source`.

### Task 6: Docs, checks, PR

- [ ] `HANDOFF-battlefront.md` "The flow and the mods": lane D2's rows (per mod: what was exported, imported, credited, what was refused and why); `docs/assets/battlefront-2017.md` "Mods"; `CREDITS.md` via `npm run credits`.
- [ ] Gates: lint, test, build, health; `assets-check`; `galaxy-figures-audit`.
- [ ] One PR per mod collection (`Battlefront lane D2: Battlefront Expanded's heroes on the game's rig`, then the clones, then the weapons, then the mode logic).
