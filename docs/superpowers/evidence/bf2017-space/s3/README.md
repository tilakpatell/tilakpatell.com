# Lane S3’s evidence: the map and the HUD on the game’s front end

Shots through the dev server in headless Chromium (software GL, the page’s clock held at 2026-10-05 12:00 UTC as `galaxy-check.mjs` holds it), 2026-10-11, on `claude/bf2017-s3-map-hud`:

- `globes.webp`: the ten globes of `src/data/galaxy/space/globes.json` at twice their size (`bf2017-sky.mjs --globes`): the six front-end pictures (Geonosis, Hoth, Kashyyyk, Scarif, Tatooine, Yavin 4) and the four rendered from their skins (Bespin, Endor, Kamino, Naboo).
- `hub-1600x900.webp`, `hub-phone.webp`: `/galaxy/hoth` at mid, the system’s card with the game’s planet icon by its name, the flight cluster with the speed-bar icon; at 1,600 × 900 and at a phone’s 390 × 844.
- `holomap-1600x900.webp`, `holomap-phone.webp`: the map open (M) on the same two screens: the globes on the discs, the war’s strip with the game’s faction icons, the side panel’s name with its planet icon.
- `holomap-key-1600x900.webp`: the map’s key open, the fleet’s crest the game’s.
- `war-hoth-high.webp`: a siege forced over Hoth at high (`__galaxyDebug.war.force('empire', 'siege')`, sworn to the Rebellion): the war’s line, and under it the stage row in the game’s objective-bar layout (the defend mark, Univers, the bar).
- `space-endor-high.webp`: Endor’s Starfighter Assault at high (`?battle=starfighter&side=rebel`): the Starfighter Assault panel and the war’s HUD under it.

The dev server had no `VITE_ASSET_BASE`, so a file that lives only in the public bucket (the space packs’ lists) came back as the page itself and the console said so (`Unexpected token '<'`); the published files load through the manifest’s base on the built site, and the smoke check of the built `/galaxy` is in the hand-off.

The checks on the PR’s head are in the hand-off (`docs/superpowers/HANDOFF-bf2017.md`, lane S3).
