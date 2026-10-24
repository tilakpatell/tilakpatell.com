# The assets pipeline

**Version** `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `meshoptimizer`, `basisu`, `sharp`, `fflate`, `watlas`, `d3-geo`, `topojson-client` and `world-atlas`, each at the version its row in [README.md](README.md) gives · **Page owner** `scripts/` · **Decision** none recorded

## What it is, and why it is here

The tools that turn models, pictures and map data into the files the site serves. None of them ships to a visitor: each is run by a script under `scripts/`, by hand or by a desktop job, and its output is committed under `public/` or `src/data/`. (`fflate` is a runtime dependency in `package.json`, but only scripts import it.)

## Where it is used

The census rows are in [README.md](README.md); every file that imports these is under `scripts/`. The entry points, by kind:

- **Models** (`@gltf-transform/*`, `meshoptimizer`): `scripts/gen3d/web.mjs` makes a generated model ready for the site (welded, simplified to a triangle budget, textures to WebP, meshopt-compressed, credited); the Meshy and Sketchfab importers and `scripts/rig-transfer.mjs` do the same for models from elsewhere.
- **GPU textures** (`basisu`): `scripts/ktx2.mjs` makes KTX2 textures and reports, per texture, whether one earns its bytes.
- **Pictures** (`sharp`): `scripts/photos.mjs` (the travel photos), `scripts/hq-assets.mjs` (the Avengers HQ’s textures and skies) and the AI tests under `scripts/ai-e2e/`.
- **Archives** (`fflate`): `scripts/mc-atlas.mjs` reads a Minecraft resource pack (a folder, `.zip` or `.jar`); `scripts/deathstar-hd.mjs` reads the Death Stars’ source archives.
- **Atlases** (`watlas`): `scripts/reatlas.mjs` puts a Meshy figure on a new texture atlas.
- **The globe** (`d3-geo`, `topojson-client`, `world-atlas`): `scripts/build-globe.mjs` writes `src/data/globe.js`, the dotted globe in “Places I’ve been”; `scripts/planets/earth.mjs` traces the same coasts for the universe map’s two drawn Earths (Marvel’s Earth-616 and C-137’s).

## How the site uses it

- **Every GLB is meshopt-compressed**, and the browser decodes it with three’s own decoder (`src/lib/three/gltf.js` imports `MeshoptDecoder` from `three/examples/jsm/`), so the `meshoptimizer` package itself never ships.
- **A model comes in cuts**: `.hq.glb`, plain and `.lo.glb` for the quality levels, and `.ultra.glb` for a strong card, each held to its triangle budget (`scripts/gen3d/budget.mjs`; `src/lib/budgets.js` says which cut a level draws).
- **Textures are WebP by default; KTX2 where it pays**: normal maps and large maps seen close (`scripts/ktx2.mjs`’s header, after `docs/research/2026-10-05-textures-and-asset-quality.md`).
- **A level pack has a coarse horizon grid** (`scripts/bf2017-horizon.mjs` over `scripts/lib/bf2017-horizon.mjs`): beside its pack, `horizon/` holds a 512 m cell’s things merged at their last LODs (`@gltf-transform/*` to write, `meshoptimizer`’s simplifier to 12,000 triangles, 4,000 in the `.lo` cut low and mid take, meshopt-compressed) and the kit’s repeated props as octahedral impostor atlases (16 × 16 views at 2,048, UASTC, the 1,024 and 512 rows the same file with its top mips dropped by `scripts/lib/ktx2-levels.mjs`), baked by `scripts/impostors.mjs` in headless Chromium; `level.json` names it (`coarse`). The stream fetches it first (`levelStream.js`).
- **A pack map comes in rows**, `tex/<slug>.<size>.ktx2`, its tex row saying each tier’s size: the loader fetches the smallest first and promotes it to the tier’s in place (`levelGltf.js`). A data map’s row may list `uastc` sizes, `tex/<slug>.<size>.uastc.ktx2`, taken on mid and up where the chip transcodes UASTC to BC7, ASTC 4×4 or ETC2 (`levelPack.js`’s `tierTexture`); in October 2026 the packs’ data maps are already UASTC in their plain rows (the evidence README).
- **Every asset is credited.** A model from elsewhere goes into `public/games/credits.json`, which `scripts/credits.mjs` turns into CREDITS.md; a photo’s credit is in `src/data/photos.js`.
- **No map library ships.** The globe’s points are tested against country outlines at build time, and the browser rebuilds the lattice from its size alone (`scripts/build-globe.mjs`’s header).

## What the site does not use, and why

- **A runtime asset service**: no model or texture is made or converted in the visitor’s browser; everything is made ahead and served as a static file.
- **ETC1S, Basis’s smaller mode**: too lossy for anything seen close, so `scripts/ktx2.mjs` defaults to UASTC (its header).
- **Draco**: every model is meshopt-compressed, so the site needs one decoder, not two.

## Rules

- A new texture or model earns its bytes, and the change says what it replaced and how big it is (the autopilot’s standing rules in `.claude/skills/autopilot/SKILL.md`).
- A model is held to its level’s budget (`scripts/gen3d/web.mjs` refuses one over it; `scripts/galaxy-check.mjs` holds every world to its level’s row of `src/lib/budgets.js`).
- An asset from elsewhere is credited (`public/games/credits.json`, `scripts/credits.mjs`; nothing fails without one).
- `docs/assets/quaternius.md` says where the Quaternius kits are kept and how their credits go in.

## Upgrading

```
npm install @gltf-transform/core@<v> @gltf-transform/extensions@<v> @gltf-transform/functions@<v>
npm test
npm run test:ai
```

Keep the three `@gltf-transform` packages on one version. `npm run test:ai` runs the asset tier, which checks the models as shipped (`scripts/ai-e2e/README.md`). Re-run one importer on one model and compare its output’s size and look before trusting an upgrade on all of them. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **meshopt’s careful simplifier stops at borders** (the coarse horizon cells): a cell merged from hundreds of separate meshes is nearly all border, so `simplify` with `LockBorder` left Hoth’s busiest cell at 104,000 triangles against 12,000; `scripts/bf2017-horizon.mjs` runs it unlocked and finishes with `simplifySloppy` where it still falls short.
- **`basisu` is a binary.** The package ships a build per platform, and `scripts/ktx2.mjs` finds the one for this machine (`basisuPath`).
- **Generated models need the desktop.** The gen3d pipeline runs on the owner’s GPU machine; the desktop-jobs skill (`.claude/skills/desktop-jobs/`) says how to request one.
- **`sharp` is native too.** It brings its own libvips build per platform; an `npm ci` on a new platform fetches it.
