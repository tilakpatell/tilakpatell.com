# Hulls you can hit: the evidence for the damage rules

What was run to prove the rules the hulls and `damage.json` use (the design’s §2.5), and the names of REA’s recordings. The finding is `bf2-re/findings/62-space-hits-and-damage.md`; it quotes the lines, so the scratch files named here are not needed to check it.

## The answers, in one line each

1. **The packed material** (CODE): material bits 12–21, property bits 22–31, bit 11 valid (`FUN_1474bf390`, `FUN_1474bf830`). A shape tag is not a packed material: it is a part index or a slot in the asset’s material table.
2. **The pair a bolt on a fighter is judged by** (CODE + RECORD): the hit part’s material from the asset’s part table, and only if that changes nothing, the vehicle’s `VehicleEntityData.MaterialPair`. The X-wing takes 1.25× on every part.
3. **The multiplier** (CODE): `DamageProtectionMultiplier` × damage, applied only if it reaches `DamageProtectionThreshold`; no relation means the (default, default) relation, 0× under 2.
4. **Part health** (CODE + RECORD): from the first state’s `Health` down; a hit stops at the next state’s `Health`, the part moves to that state and the rest carries on.
5. **Roots** (RECORD): `CollisionRootShapeIndex 0`, `RaycastRootShapeIndex 1`.

## What was run (2026-10-14)

- **The records**: the five space grids (`Levels/Space/SB_*_01/materialgrid_win32.json`; there is no sixth), the X-wing, the projectiles, the CR90, read with small scripts (`scratchpad/py/grid.py`, `gridcmp.py`, `table.py`, `parts.py`).
- **The raw physics headers**: the exporter’s `resdump` (`BF2_Extract/tool/bin/Release-bundles/bf2export.exe … resdump --types HavokPhysicsData --filter gameplay/vehicles/`), read-only on the install; 666 vehicle assets, read with `scratchpad/py/reshdr.py` (part → slot → packed material).
- **Ghidra 12.1.4**, headless and `-readOnly`, on a C: copy of `D:\bf2-ghidra\render62\proj-live-named` through a copy of `abil63/gh.ps1`: runs `h1`–`h11`, `v1`–`v12`, `r1`, `r2`, every one exit 0 and no `ERROR`. Nothing was written to D:.
- **REA** (`rea-agents` 6.4.0): its Ghidra provider now finds Ghidra. The whole image still times out (330 s) and a Ghidra project is not a target it opens; on the image cut to the functions (`scratchpad/py/cutpe.py`, 275 KB, the original addresses) it decompiled, built dossiers and traced values, with the same readings as Ghidra. The errors are in the finding’s “Tools”.

## REA’s recordings

| what | evidence id |
| --- | --- |
| the live site before the change: `https://tilakpatell.com/#/galaxy/hoth`, 65 s (Edge, Chromium 155, headless), screenshots at each step, console and page errors | `ev_ade059ed8af0dda92dd81d8daa035f67949fda3a61765f11b735d69e7c96d6ce` |
| the damage relation reader `0x146a1ad50`, decompiled (first cut, sha256 `8c5066c5…5b8`) | `ev_aa86da1fe76fe2dc924b5b64bb6213ffb4b44bd09d7f2cd755d82a6eb53376b8` |
| the property cell `0x1474bf830`, decompiled (second cut, sha256 `98ebdbc7…7ce`) | `ev_0059529f89dee50eea2203256bf728af838edb5c4fe2cfaa725aeee8bfb7349d` |
| the vehicle health component’s slot 42 `0x141be5a60`, its dossier | `ev_7c391bba6287a8d9d8da8415070d7fa03fc36e6599008305194e559e0b26c7f6` |
| the same, its value trace (two pages) | `ev_0df687c42b65663f09ef3866abdf60f4ef5db37824faca547fd81df1566494e7`, `ev_db64351cad9a1b60bad02b76636ed043ab5a4a11b42cee1983b10a6e34c07f00` |
| the grid thunk `0x14116ed30`, its dossier | `ev_198d6fd2f36b79b8c8803bb8db0a538e9dd16c4c52f77fb9daa2621dca2d7349` |
| the part health spend `0x140c68080`, decompiled | `ev_45ea8665dea95bb52028e3582e959d9c3437071246d7e69969ba280188bc595a` |

The live recording shows the system view of Hoth (the panel: “Galactic Civil War · 3 ABY”, “Held by the Rebellion”) for 65 s, one console message (Edge’s lazy-image notice) and no page error; no battle came into view in that time.
