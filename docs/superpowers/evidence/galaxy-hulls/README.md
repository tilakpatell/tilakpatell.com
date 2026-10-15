# Hulls you can hit: the evidence for the damage rules

What was run to prove the rules the hulls and `damage.json` use (the design’s §2.5), and the names of REA’s recordings. The finding is `bf2-re/findings/62-space-hits-and-damage.md`; it quotes the lines, so the scratch files named here are not needed to check it.

## The answers, in one line each

1. **The packed material** (CODE): material bits 12–21, property bits 22–31, bit 11 valid (`FUN_1474bf390`, `FUN_1474bf830`). A shape tag is not a packed material: it is a part index or a slot in the asset’s material table.
2. **What a bolt on a fighter is judged by** (CODE + RECORD): two passes. The hit part’s material (the asset’s part table) spends only the part’s own states unless a weak spot is tied to the part, and no starfighter has one; the fighter’s health loses `m × D × VehicleDamageModifier` for the (bolt, `VehicleEntityData.MaterialPair`) relation if `m × D` reaches its threshold. Every fighter checked has p68 there: a fighter bolt does 1.25 × D, hero ships included.
3. **The multiplier** (CODE): `DamageProtectionMultiplier` × damage, applied only if it reaches `DamageProtectionThreshold`; no relation means the (default, default) relation, 0× under 2.
4. **Part health** (CODE + RECORD): from the first state’s `Health` down; a hit stops at the next state’s `Health`, the part moves to that state and the rest carries on; when the state leaves the part, its child parts take `FLT_MAX`. On a static model the loss is also × the squad bonus where linked (× 1.02 at most) and × `DamageMultiplier` (1.0).
5. **Roots** (RECORD): `CollisionRootShapeIndex 0`, `RaycastRootShapeIndex 1`.

## What was run (2026-10-14)

- **The records**: the five space grids (`Levels/Space/SB_*_01/materialgrid_win32.json`; there is no sixth), the X-wing and the other fighters, the projectiles, the CR90 and its prefab, the difficulty settings, read with small scripts (`scratchpad/py/grid.py`, `gridcmp.py`, `table.py`, `parts.py`, `pen.py`).
- **The raw physics headers**: the exporter’s `resdump` (`BF2_Extract/tool/bin/Release-bundles/bf2export.exe … resdump --types HavokPhysicsData --filter …`), read-only on the install, read with `scratchpad/py/reshdr.py` and `capitals.py` (part → slot → packed material): 666 vehicle assets first; then, with a short output path so the long names fit, 812 capital and space assets in `scratchpad/resdump-capitals` (the Star Destroyer kit 60, the Resurgent 225, the Venator 30, the Lucrehulk 52, the MC80 38, the Providence 1, the Arquitens 13, the Republic cruiser 12, the Fondor dry dock 106, the CR90 31, the Nebulon-B landmark 1, the other landmarks and props 84, the space levels 115, the rest 44).
- **Ghidra 12.1.4**, headless and `-readOnly`, on a C: copy of `D:\bf2-ghidra\render62\proj-live-named` through a copy of `abil63/gh.ps1`: runs `h1`–`h16`, `v1`–`v20`, `r1`–`r3`, every one exit 0 and no `ERROR` (33 logs; the runs that shared another’s command are named in the finding). Nothing was written to D:.
- **REA** (`rea-agents` 6.4.0): its Ghidra provider now finds Ghidra. The whole image still times out (330 s) and a Ghidra project is not a target it opens; on the image cut to the functions (`scratchpad/py/cutpe.py`, 275 KB, the original addresses) it decompiled, built dossiers and traced values, with the same readings as Ghidra. The errors are in the finding’s “Tools”.

## REA’s recordings

| what | evidence id |
| --- | --- |
| **the war on the live site before the change**: `https://tilakpatell.com/#/galaxy/scarif`, 2026-10-14 about 13:00–13:01 UTC, 65 s (Edge, Chromium 155, headless), screenshots at each step, console and page errors | `ev_571050b5830768582e8f277d37b1ce4073d8fc6fc1b160fe87d2c5479c115acb` |
| the live site at Hoth, the first try (no battle in the Galactic Civil War there at the time) | `ev_ade059ed8af0dda92dd81d8daa035f67949fda3a61765f11b735d69e7c96d6ce` |
| the damage relation reader `0x146a1ad50`, decompiled (first cut, sha256 `8c5066c5…5b8`) | `ev_aa86da1fe76fe2dc924b5b64bb6213ffb4b44bd09d7f2cd755d82a6eb53376b8` |
| the property cell `0x1474bf830`, decompiled (second cut, sha256 `98ebdbc7…7ce`) | `ev_0059529f89dee50eea2203256bf728af838edb5c4fe2cfaa725aeee8bfb7349d` |
| the vehicle health component’s slot 42 `0x141be5a60`, its dossier | `ev_7c391bba6287a8d9d8da8415070d7fa03fc36e6599008305194e559e0b26c7f6` |
| the same, its value trace (two pages) | `ev_0df687c42b65663f09ef3866abdf60f4ef5db37824faca547fd81df1566494e7`, `ev_db64351cad9a1b60bad02b76636ed043ab5a4a11b42cee1983b10a6e34c07f00` |
| the grid thunk `0x14116ed30`, its dossier | `ev_198d6fd2f36b79b8c8803bb8db0a538e9dd16c4c52f77fb9daa2621dca2d7349` |
| the part health spend `0x140c68080`, decompiled | `ev_45ea8665dea95bb52028e3582e959d9c3437071246d7e69969ba280188bc595a` |

**How the war was found.** The site’s own war clock (`src/components/galaxy/gcw.js` `warTables(Date.now())`, run in Node with no online points; a step’s battles fight for its first 10 minutes) gave, at 13:00 UTC, battles in all three wars: the Galactic Civil War’s at Mustafar, Naboo, Kashyyyk, Kamino and Scarif, the Clone Wars’ at Coruscant, Kashyyyk, Geonosis and Scarif, the Remnant war’s at Tatooine, Hoth, Coruscant, Kamino, Scarif and Mandalore. The first recording’s Hoth panel named the Galactic Civil War, which had no battle at Hoth, hence nothing to see; Scarif has a battle in every war. The Scarif recording’s panel reads “Galactic Civil War · 0 ABY”, “Held by the Empire · 95% liberated”, “The Battle of Scarif: Siege · 8:42 left” at its end, with a timer “Siege · 8:42 left” over the planet and the sides offered (“Fly for the Rebel Alliance”, “Fly for the Galactic Empire”); nothing was clicked, so the recording watches the battle unsworn. One console message (Edge’s lazy-image notice) and no page error, as at Hoth.

## Part 2 (2026-10-15): the queries wired, what was run

The design: `docs/superpowers/specs/2026-10-15-galaxy-space-fidelity-design.md`. In a cloud session with no reach to the drop or the bucket, so everything here is Node:

- **The fixture hulls** (`scripts/fixtures/bf2017/physics/xwing-hull.bin`, `destroyer-hull.bin`), read through `lib/combat/hulls.js`: the X-wing 8 parts, 430 ray triangles, 2 solids, 18 probes, box ±0.441 × ±0.095 × −0.501…0.498 of its length; the Star Destroyer 123 parts, 2,121 ray triangles, 128 solids, box ±0.282 × ±0.142 × ±0.5. Vertical bolts down the Star Destroyer at shares of its length: the wing’s plate is met out to x = 0.25 at z = −0.35 and to 0.2 at z = −0.4, property 132 everywhere on it; the hull is a shell of thin plates (a point in the thick of the ship is in no solid), so a contact is a sweep across a plate, pushed back the side it came from.
- **The tests** (`npx vitest run src/components/universe src/lib/combat src/components/galaxy`): a bolt straight down at [0.25, 0, −0.35] of a Star Destroyer in the war meets it (property 132) where the chain of spheres met nothing, and [0.5, 0, −0.35] meets nothing on either; a bolt 0.2 lengths over an X-wing’s back misses on the hull and hits on the sphere, one through its body hits with property 68 at the body’s height; a fighter diving at the wing at 20 units a second (a step’s 0.67 through a plate about 0.2 thick) ends over the plate on the hull and 0.2 under it on the spheres; the same for the hunters and for the set piece’s Star Destroyer.
- **The texture counts** in the design’s §1.1 are `src/lib/glbTextures.js` on the committed GLBs (a scratch script over `public/models/galaxy/*.glb`); the published cuts’ sizes are `src/data/galaxyAssets.json`’s bytes and the surface catalog’s rows.

Not run here: the browser checks, the frame-time probe, the hull measure of the surface plain cuts, and REA’s recordings (no browser with a graphics card, no bucket): the design’s §4 lists them as the desktop’s.
