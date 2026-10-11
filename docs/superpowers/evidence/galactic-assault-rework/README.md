# Evidence: the Galactic Assault rework (2026-10-11)

The design: `../../specs/2026-10-11-galactic-assault-bf2017-flow-design.md`. Shot in the cloud container’s headless Chromium on SwiftShader (software GL), the dev server with the bucket base, `/battlefront/hoth/galacticAssault?gpu=webgl&post=off` at the low tier (the node chain loses SwiftShader’s device with the post on; the owner’s desktop runs the chain), 1280 × 720.

| file | what |
| --- | --- |
| `battlefront-hoth-spawn-low.png` | the game’s spawn screen over the level: the four classes at no cost, the Empire’s reinforcements (Death Trooper 1,500, Jump Trooper 1,000, ISB Agent 1,500) and heroes (4,000) at the record’s prices, named as the game’s screen writes them (`hud/widgets.js`’s `offerNameOf`), the squad strip (Imperial HQ, the squadmates), Battle Points 0, the keys |
| `battlefront-hoth-field-low.png` | the field after a deploy and 20 s advanced: the stage line, the objective bar A to F, the markers with their distances, the game’s crosshair, the squad list, the abilities, the radar; the level’s meshes drawn (718,417 triangles, 145 calls, 1,918 instances at the spawn view; 447,447, 93, 1,132 on the field; the nav mask on) once `map/level.js` fetched the pack through the asset base (0 triangles before) |
| `battlefront-hoth-figure-low.png` | the player’s snowtrooper from the game’s third-person camera, its maps bound (the body’s KTX2 through the bucket), before the pack fetch fix (the level behind it the ground alone) |

No console error in any run (`lab/`-style script, `OUT=… QUALITY=low node lab/bfshot/shoot.mjs`; the script is not committed).
