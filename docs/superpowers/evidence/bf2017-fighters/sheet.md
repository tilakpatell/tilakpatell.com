# The fighters' sheet (the sixth design's lane fighters, task 3)

`fleet.webp`: left the model the galaxy flew, right the game's (Star Wars Battlefront II, 2017, EA DICE; used with permission), each shot by `scripts/glb-shot.mjs` (three-quarter view, headless Chromium, SwiftShader).

| kind | the galaxy's (before) | the game's (now) | far copy | written by |
| --- | --- | --- | --- | --- |
| X-wing T-65, Starfighter Assault's (`xwing65`, new) | gen3d `x-wing.lo.glb`: 19,879 triangles, 656 KB (the hunters, wingmen and trench run keep it) | `xwing65.glb`: 6,918 triangles, 676 KB (lane V's light cut) | 3,994 triangles, 28 KB | `bf2017-fleet.mjs xwing65` |
| V-wing (`vwing`) | Meshy remake: 15,593 triangles, 820 KB | 6,422 triangles, 531 KB | 1,431 triangles, 14 KB | `bf2017-fleet.mjs vwing` |
| Hyena bomber (`hyena`) | Meshy remake: 14,998 triangles, 651 KB | 3,980 triangles, 423 KB | 1,476 triangles, 13 KB | `bf2017-fleet.mjs hyena` |

The other kits Starfighter Assault flies were the game's already (lane V's fleet rows: the TIE fighter, interceptor and bomber, the A- and Y-wings, the ARC-170, the vulture and the tri-fighter). Every kind the game's kit lists name has its cuts: none failed (lane V imported twenty fighters and fourteen cockpits; the full and ultra cuts are in `site-assets`, `catalog/bf2017-vehicles.js`). Yoda's starfighter, a hero ship the bots never fly, was not imported.

The light cuts the fleet reads (`public/models/galaxy/surface/<kind>.lod1.glb`) are published, not in git: fetch them by the manifest's hash from `site-assets` first (`src/data/galaxyAssets.json`). The far copies' colours come from the game's maps unpacked by an import into `lab/` (`galaxy-lod.mjs` reads `lab/assets/bf2017/unpacked/`).
