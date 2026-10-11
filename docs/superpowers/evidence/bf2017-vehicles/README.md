# Lane V's evidence: the vehicles, in depth

The cast is [`cast.md`](cast.md). Every picture here was looked at before the lane shipped.

## The sheets

- **Native, before and after** (the owner, 2026-10-10: the game's textures as they are):
  - [`native-ground.webp`](native-ground.webp): the walkers, ground vehicles and droids;
  - [`native-fighters-1.webp`](native-fighters-1.webp) and [`native-fighters-2.webp`](native-fighters-2.webp): the fighters.

  Each row puts the earlier WebP cut (left) beside the native one (right). The patchwork of the left column was the pipeline's, not the game's.
- [`xwing-uv-sets.webp`](xwing-uv-sets.webp): the X-wing's maps read through its first UV set (top) and through its second (bottom), the one the game's vehicle shader reads its atlas through.
- [`sheet-ground-turrets.webp`](sheet-ground-turrets.webp), [`sheet-fighters.webp`](sheet-fighters.webp), [`sheet-cockpits.webp`](sheet-cockpits.webp): the first WebP sheets, before the UV and decal fixes.
- [`fleet.webp`](fleet.webp): the space layer's ships, old on the left and the game's on the right. Rows: the close-up Star Destroyer, the Nebulon-B, the MC80, the TIE fighter. The game's Nebulon-B and TIE went in. The close-up Star Destroyer and the MC80 stayed, and so did the close-up Nebulon-B: the game's are 16,000-triangle backdrops. (Lane S1 of the galaxy-in-space design put the space levels' kits in their place, by the owner's rule: `../bf2017-space/fleet-2017.webp`, the sheet re-shot with the kits.)

## The walkers on their own rigs

`node scripts/rig-shot.mjs <file> <rig> <out.png> <clips>`: a row a clip, four moments across, the lowest foot's height at each.

- [`rig-atst.webp`](rig-atst.webp): the AT-ST bound to `ATST_Ske01` at import, playing idle, walk, die and turn. Feet at 0.08 to 0.09 m through the walk.
- [`rig-atat.webp`](rig-atat.webp): the AT-AT, the game's own skin on `ATAT_Ske`: idle, walk, and the tow cable's fall.
- [`rig-atat-composite-bound.webp`](rig-atat-composite-bound.webp): the gameplay composite bound to the same rig. It was not taken: 4.0 MB, and a plate tore between the legs.
- [`rig-atte.webp`](rig-atte.webp), [`rig-atrt.webp`](rig-atrt.webp), [`rig-droideka.webp`](rig-droideka.webp): walk, turn, the big gun's stance, the droideka's roll and deploy, each death.
- In the world: [`world-hoth-atat.webp`](world-hoth-atat.webp) and [`world-endor-atst.webp`](world-endor-atst.webp).
- `anim-check` saw every AT-AT in view on Hoth, and the AT-ST on Endor, at 0 m/s of planted drift, none at bind pose. On Hoth an AT-AT at 2.2 m/s crossfades from the idle into the walk, paced 1.73 times the clip's 1.27 m/s.

## The cost on the worlds

`BUDGET=1 QUALITY=<q> JSON=1 node scripts/galaxy-check.mjs surface hoth,endor,geonosis,kashyyyk,scarif,tatooine,naboo`, held to the level's own row (`lib/budgets.js`).

Measured on 2026-10-10:

- **main:** `85d92f8b`, lane S merged (`surface-<q>-main.json`);
- **lane V:** native, the plain cut's colour at 1024 and its normal and ORM maps at 512 (`surface-<q>.json`).

**High** (the laptop's default look; the row: 3M triangles, 700 calls, 60 MB)

| world | draw calls (main → lane V) | triangles | models |
| --- | --- | --- | --- |
| Hoth | 156 → 122 | 865,338 → 819,586 | 14.7 → 40.7 MB |
| Endor | 167 → 167 | 2,046,229 → 2,046,229 | 12.3 → 19.2 MB |
| Geonosis | 196 → 172 | 1,022,138 → 1,016,357 | 22.9 → 47.9 MB |
| Kashyyyk | 108 → 90 | 1,301,214 → 1,320,590 | 12.3 → 19.3 MB |
| Scarif | 147 → 140 | 1,743,891 → 1,783,241 | 12.4 → 24.8 MB |
| Tatooine | 95 → 84 | 707,257 → 722,385 | 24.3 → 28.5 MB |
| Naboo | 597 → 588 | 1,968,520 → 1,899,004 | 24.4 → 33.3 MB |

Every world passes its high row. With the plain cut's maps all at 1024, Hoth came to 60.1 MB and Geonosis to 72.9, over the row; 512 for normal and ORM gave the row back.

**Low** (the phone's; the row: 0.8M triangles, 350 calls, 20 MB; a native kind draws its light cut alone)

| world | draw calls | triangles | models |
| --- | --- | --- | --- |
| Hoth | 156 → 120 | 671,170 → 596,126 | 14.7 → 18.5 MB |
| Endor | 167 → 167 | 1,362,301 → 1,362,301 | 12.3 → 13.9 MB |
| Geonosis | 196 → 172 | 781,010 → 743,867 | 22.9 → 26.9 MB |
| Kashyyyk | 108 → 90 | 934,094 → 902,126 | 12.3 → 13.9 MB |
| Scarif | 147 → 132 | 1,149,765 → 1,133,700 | 12.4 → 12.1 MB |
| Tatooine | 97 → 84 | 530,185 → 515,545 | 24.3 → 25.7 MB |
| Naboo | 595 → 586 | 1,396,467 → 1,326,951 | 24.4 → 26.3 MB |

- **Draw calls:** fewer or the same on every world, at both levels.
- **Triangles:** fewer on every world at low; at high within 2.3% of main's either way (Scarif +2.3%, Naboo −3.5%).
- **Model bytes:** what native costs. The game's KTX2 is lossless against the game and a quarter of an RGBA8 WebP's GPU memory, but more bytes on the wire. At high every world is within its 60 MB row. At low, Geonosis, Tatooine and Naboo were already over the 20 MB row on main (by 2.9 to 4.4 MB) and are 1.4 to 4.0 MB further over. Hoth stays under it at 18.5 MB. Endor, Kashyyyk and Scarif break the low row's triangles on main as they do here.
- **No world fails a row it passed on main**, at either level.

## The space layer

`BUDGET=1 QUALITY=high node scripts/galaxy-check.mjs space endor,hoth,scarif`. Calls and triangles are unchanged; models Endor 10.4 → 10.8 MB, Hoth 7.8 → 8.1, Scarif 7.5 → 7.4, against the 60 MB row.

## The console

One error shows on every surface world on main and here alike: a `MeshBasicMaterial`'s fog shader without `mvPosition` (`skyfog.js`). Main logged five on Hoth's run, this branch one. Nothing in this lane touches it.
