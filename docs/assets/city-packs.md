# City packs (in Cloudflare R2)

The packs the galaxy's cities and towns are built from, kept as downloaded in the owner's Cloudflare R2 bucket `tilak-assets` (account `b12a527c…`, `wrangler.jsonc`'s), not in the repo. Added 2026-10-21, when the owner asked for city packs in R2 to make Coronet City an actual city and to put towns out in the wilds. The models a world draws are imported from these into `public/` and committed, as the Quaternius and Sketchfab ones are (`docs/assets/quaternius.md`): R2 holds the sources, the site serves its own copies.

## The bucket

- Each pack's files are under `packs/<source>/<pack>/<file>`, and `packs/index.json` lists every pack: its name, licence, author, source page, and each file's size and sha256. Its copy is committed as `scripts/r2-packs.json`, so a session knows what's there without the keys.
- The bucket is private. Reading it needs the keys as much as writing it does: `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, the owner's, from the shell only (never a file the repo tracks, never a workflow). `scripts/r2-packs.mjs` signs S3's API itself (signature version 4, Node's `crypto`, no package) and refuses to run in CI.

```
NODE_USE_ENV_PROXY=1 node scripts/r2-packs.mjs list
NODE_USE_ENV_PROXY=1 node scripts/r2-packs.mjs fetch quaternius/downtown-city-megakit     # into lab/assets/downtown-city-megakit/
NODE_USE_ENV_PROXY=1 node scripts/r2-packs.mjs upload <source>/<pack> <file…> --name … --licence CC0 --author … --url …
```

## What's in it

| pack | licence | what | for |
| --- | --- | --- | --- |
| `quaternius/downtown-city-megakit` | CC0 | Downtown City MegaKit (standard): brick and metal facades, three whole tenements of four to eight storeys, two- and four-lane streets with kerbs, sidewalks, crosswalks and corners, road decals, AC units, bollards, planters (zipped from the assets repo's copy, `tilakpatell/tilakverse-assets`) | Coronet City's streets and blocks: imported as `public/kit/city/` (`scripts/kit/import.mjs`), laid by `sites/cityBlocks.js` |
| `quaternius/modular-scifi-megakit` | CC0 | Modular Sci-Fi MegaKit (standard, OpenGameArt): sci-fi walls, floors, doors, columns, platforms, props | sci-fi street furniture and outposts |
| `kenney/city-kit-commercial` | CC0 | City Kit (Commercial): office blocks, skyscrapers, shops, in Kenney's flat toy colours | distant skylines, recoloured |
| `kenney/city-kit-industrial` | CC0 | City Kit (Industrial): factories, warehouses, chimneys, tanks | industrial yards, recoloured |
| `kenney/city-kit-suburban` | CC0 | City Kit (Suburban): houses, fences, trees | not yet used |
| `kenney/city-kit-roads` | CC0 | City Kit (Roads): road tiles, crossings, lights, signs | not yet used |
| `sketchfab/brick-building-shop` | CC-BY 4.0, Orzechu | an old brick building with a shop on its ground floor | Coronet City's tenements |
| `sketchfab/scifi-skyscraper` | CC-BY 4.0, Volodymyr Hrushevskiy | a white sci-fi skyscraper | city centres' towers |
| `sketchfab/scifi-tower` | CC-BY 4.0, Jonathan (jonathan.leclerc96) | a sci-fi tower | city centres' towers |
| `sketchfab/scifi-buildings-lowpoly` | CC-BY 4.0, TampaJoey | a row of low-poly sci-fi towers | skylines |
| `sketchfab/scifi-buildings-pack` | CC-BY 4.0, golukumar | prefab habitat modules in metal panels | towns on bare worlds |
| `sketchfab/starwars-lowpoly-buildings` | CC-BY 4.0, ondrasaur | a city of tan Star Wars blocks | towns and city fill |
| `sketchfab/tatooine-kitbash` | CC-BY 4.0, chuckcg | Tatooine's domes, arches, walls and vaporators | desert towns |
| `sketchfab/coruscant-city` | CC-BY 4.0, Jonteboi | Coruscant's spires | not yet used |

Each Sketchfab pack holds its GLB and the model's page as JSON (the author and licence as Sketchfab gave them). A CC-BY model the site draws is credited in `public/games/credits.json`, which `npm run credits` turns into CREDITS.md; a CC0 one may be credited and is.

## Looked at and left out

- Kenney's style is flat toy colour: next to the galaxy's Meshy buildings and the 2017 game's, it reads as a different game up close, so its kits are for far skylines at most.
- Sketchfab's whole-city scenes (Osaka and Yokohama downtowns, New York) are Earth's streets, with Earth's signs; the Apartment Houses packs are CC-BY-SA.
- Paid packs (Super Icon's Modular Sci-Fi City, Leartes's sci-fi skyscrapers) and engine-only ones (Asset Arena's, for Unity).
