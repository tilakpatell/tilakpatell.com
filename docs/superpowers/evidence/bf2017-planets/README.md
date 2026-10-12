# The planet skins, from orbit

Lane K (`docs/superpowers/plans/2026-10-10-bf2017-phaseK-planet-skins.md`), 2026-10-10. Each shot is `scripts/galaxy-check.mjs space <id>` at the default spawn, headless Chromium in software GL; `before` is the same build with `src/data/planetSkins.json` empty (the procedural look, byte for byte main's shader), `after` wears the game's maps.

| world | high | ultra | what it wears |
|---|---|---|---|
| Naboo | `naboo-high-{before,after}.jpg` | `naboo-ultra-{before,after}.jpg` | colour, relief, clouds; the lakes from the colour's smoothness |
| Endor | `endor-high-…` | `endor-ultra-…` | colour, relief, clouds, its air's colour (`#7c94b2`, from the atmosphere picture) |
| Bespin | `bespin-high-…` | `bespin-ultra-…` | colour |
| Kamino | `kamino-high-…` | `kamino-ultra-…` | colour, all of it sea; the site's storms over it |
| Geonosis | `geonosis-high-after.jpg` | | the rings only (the game's strip), behind the site's own asteroid field |

The counts, after against before (`galaxy-check`): draw calls unchanged on every world; textures +3 to +7; programs +0 to +1.

The bucket on 2026-10-10: 103 planet textures listed, 69 non-sequel fetched, all as PNG. What the maps are and why the rest stay procedural: `docs/superpowers/HANDOFF-bf2017.md`, lane K.

Not shot: a grazing sun (the relief's sign, `greenDown`, is unchecked); flying down to a skinned world (the skin's ease-out is unit-tested in `bodySkin.test.js`).

## Lane E5: the six new worlds (2026-10-11)

`docs/superpowers/plans/2026-10-10-bf2017-every-asset-laneE5-new-systems.md`, task 2. Each shot is `QUALITY=high` (or `ultra`) `scripts/galaxy-check.mjs space <id>` at the default spawn, headless Chromium in software GL, through a dev server with `VITE_ASSET_BASE` at the public bucket. The maps were looked at as PNGs before the import (`bf2017-planets.mjs`), and the choice is in `scripts/lib/bf2017-planets.mjs`’s `SKINS` and `PICTURES`.

| world | high | ultra | what it wears |
|---|---|---|---|
| Fondor | `fondor-high.jpg` | `fondor-ultra.jpg` | colour and relief, SB_Fondor_01’s `T_Planet_Fondor_03_CS` and `_NI` (2048², lilac land and green seas as the game paints it) |
| Pillio | `pillio-high.jpg` | | colour and clouds, the campaign’s `Objects/Planets/Pillio_Alive` (teal ocean, brown land; `T_Pillio_Alive_01_CA` is the cloud map, white on black with a solid alpha, read from its brightness) |
| Sullust | `sullust-high.jpg` | | colour and clouds, `Objects/Planets/Sullust` (black rock, lava red, ice-blue flats) |
| Vardos | `vardos-high.jpg` | | colour and clouds, `Objects/Planets/Vardos_Alive` (the world before Operation Cinder: red-brown with the city grid’s lines) |
| Felucia | `felucia-high.jpg` | | the procedural lush look (`bodies.js`’s `felucia`): the drop has only the front end’s globe, `T_PlanetFrontendFelucia_01_CA`, which is the galaxy map’s disc |
| Kessel | `kessel-high.jpg` | | the procedural desert look (`kessel`, salt and spice rock): the front end’s globe `T_PlanetFrontendKessel_01` is the galaxy map’s disc |

The clouds of the three campaign worlds keep their coverage in the RGB (the alpha is 254 to 255 all over): `SKINS[id].cloudsIn: 'rgb'`, and `coveragePng` reads the brightness (its test). Sizes as lane K’s tiers: mid 1024 WebP, high 2048 WebP, ultra 2048 KTX2 for the colour and relief (never larger than the game drew them: every one of these is 2048²), clouds at half. Fondor 8.30 MB, Pillio 6.39, Sullust 7.41, Vardos 6.15 (every tier’s files summed, `git ls-tree -r -l` at this commit), in git as lane K’s are (the body loads a skin through `assets-manifest.json` and `public/`, which `assets-upload.mjs` mirrors from the files on disk; `assets-publish.mjs --files` is refused for the site’s manifest).

Sullust’s first orbit run sat on its loading screen, as Kessel’s did. A rename in the lava family’s shader was committed as the cause and then reverted: `sullust-high.jpg` is drawn with `main`’s lava shader unchanged (shot again with the rename undone: the same 45 calls, 182,562 triangles). The blank runs were the dev server’s: a page error before it had `VITE_ASSET_BASE`, then `src/data/galaxyAssets.json` answering 500 while `assets-publish.mjs` rewrote it. A gate never shares the machine with a publish.

### Fondor’s space level from orbit (lane E5, 2026-10-12)

With Fondor a system, the galaxy’s flight draws the space lane’s pack round it (`SPACE_LEVELS.fondor`, `src/data/galaxy/space/fondor.json`: 66 pieces, the two dry docks, eight capital ships, 54 stations and two backdrops, at [1000, 0, −800]; `spacePieces.js`). `fondor-space-level-high.jpg` is `QUALITY=high` with galaxy-check’s page set-up, the ship put 140 units off the docks and facing them; `fondor-space-level-hidden-high.jpg` is the same frame with the level’s group hidden; `fondor-space-level.json` has the counts: 66 pieces placed, 193 meshes, the frame 52 draws and 166,928 triangles with them and 31 and 40,374 without (the level’s 21 and 126,554).

In this sandbox the first such run placed nothing. Every space model is the bucket’s alone, and the galaxy’s first bucket fetch missed `lib/assetBase`’s 12 s first-answer wait under load, which sends every later load of the visit to the site’s own files (here the app’s HTML, “short body: 4774 of 7974620 bytes”). The run above cleared the flag (`forgetDown`) and entered the system again; nothing else differs. A visit whose first fetch answers in time places the same pieces on arrival, with no second entry.
