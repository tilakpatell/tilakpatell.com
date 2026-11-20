# The flight menu's ship portraits

The Ship tab's picture of each crew's ship (`src/components/universe/menu/ShipTab.jsx`), 480 px wide at most, on black so a dress's dark panel takes them by `mix-blend-mode: lighten`.

- `falcon.webp`, `xwing.webp`, `rv.webp`: the site's own models (`public/models/galaxy/falcon.glb`, `public/models/galaxy/xwing65.glb`, `public/models/universe/rv-wings.glb`, credited in `src/data/modelCredits.json`), drawn by `scripts/glb-shot.mjs` from three-quarters (`three`, `&bg=000000`) and trimmed.
- `cruiser.webp`: the space cruiser as the universe map builds and flies it, everything else in the scene hidden, cropped and faded to black at its edges.

Made 2026-11-18; to make one again, shoot it the same way and keep it under 16 KB.
