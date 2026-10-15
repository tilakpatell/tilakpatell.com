# Lane S3’s evidence: the map and the HUD on the game’s front end

Shots through the dev server in headless Chromium (software GL, the page’s clock held at 2026-10-05 12:00 UTC as `galaxy-check.mjs` holds it, moved on a second after a battle is forced so the HUD re-renders), 2026-10-11, on `claude/bf2017-s3-map-hud` after the review’s fixes:

- `globes.webp`: the ten globes of `src/data/galaxy/space/globes.json` at twice their size (`bf2017-sky.mjs --globes`): Bespin, Endor, Geonosis, Hoth, Kamino in the top row, Kashyyyk, Naboo, Scarif, Tatooine, Yavin 4 below. Bespin, Endor, Kamino and Naboo are rendered from their skins; the other six are the front end’s pictures.
- `hub-1600x900.webp`: `/galaxy/hoth` at mid, flown, so the flight cluster is on: its speed line led by the game’s speed-bar icon with the number beside it; the war’s line and stage row at the top; the system’s card with its name alone (the drop’s planet icons are a placeholder: the hand-off says why).
- `hub-phone.webp`: the same at a phone’s 390 × 844: the touch cluster (the speed line is hidden there by design), the war HUD at 0.7 rem under the map button. The war’s line sits over the first flight’s tip toast, as on `main`; the hand-off names it.
- `holomap-1600x900.webp`, `holomap-phone.webp`: the map open (M) on the same two screens: the globes on the discs, the strength strip with the game’s faction icons for the Rebellion and the Empire beside the Hutts’ crest, the fleets’ crests on the map.
- `holomap-key-1600x900.webp`: the map’s key open and scrolled to its fleet row, the Empire’s fleet crest the game’s icon, cropped to its art.
- `war-hoth-high.webp`: a siege forced over Hoth at high (`__galaxyDebug.war.force('empire', 'siege')`, sworn to the Rebellion, so you defend): “Hold the siege line”, and under it the stage row in the game’s objective-bar layout led by the defend mark. The script measured the row’s foot at 125 px against the crew line’s slide-in at 126 and its rest at 132 (the page’s nav 76 px) at 1,600 × 900, 1,920 × 1,080 and 2,560 × 1,440.
- `space-endor-high.webp`: Endor’s Starfighter Assault at high (`?battle=starfighter&side=rebel`, defending): the Starfighter Assault panel, and the war’s line and stage row under it with the defend mark.

The dev server had no `VITE_ASSET_BASE`, so a file that lives only in the public bucket came back as the page itself and the console said so (`Unexpected token '<'`); the built site reads the published files through the manifest’s base, and the smoke check of the built `/galaxy` is in the hand-off. The shot script is not committed (it lived in the ignored `lab/`); its steps are the ones `galaxy-hud-check.mjs` takes: fly two seconds, force the battle until the front reports it, then shoot.

The checks on the PR’s head are in the hand-off (`docs/superpowers/HANDOFF-battlefront.md`, lane S3).
