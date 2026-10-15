# Infinite worlds: install packs, chunked space, a seeded universe and saves that keep. The design

Date: 2026-10-07. Status: design, written from the owner's brief by an architecting session, for Opus 5.5 implementation sessions working in parallel. The plan is `docs/superpowers/plans/2026-10-07-infinite-worlds.md`; the hand-off is `docs/superpowers/HANDOFF-universe.md`.

## What the owner asked

"Is there a way to architect chunking and a way to improve the generation of the worlds and universe to be more dynamic so it's easier to load (also like a wait 2 mins download and then open the game) and so we can create infinite worlds as they are saved. If it requires persistence is that possible to do easily? How does it work?"

Four asks in one:

1. **Chunking** as an architecture, not a one-off: space loaded in cells round the player, work done off the main thread, a bounded amount sent to the graphics chip each frame.
2. **A load model of "download, wait, then play"**: a world is fetched whole, with a progress bar, and opens from the device after that, instead of pulling models in as it goes.
3. **Dynamic generation**: worlds and the universe made from seeds, so there is no end to them and nothing to download for the new ones.
4. **Persistence** of those worlds: the ones made and changed stay, on this device and ideally for others, and the question of whether that needs a server.

## Where the site is today

Everything below was read from the code in this session.

- **Hosting**: a static site on GitHub Pages (`deploy.yml`, `public/CNAME`). No server, no functions, no `.env`. The only network beyond static files: four public Nostr relays over WebSocket (`universe/online/nostr.js`'s `RELAYS`), carrying ephemeral events (kind 22742: passed on, never kept), and the GitHub API read-only.
- **Assets**: `public/` is 767 MB, 1,521 GLB files (516 MB). Each world fetches its own at run time through `lib/three/gltf.js` and `lib/three/textures.js` (in-memory per-URL caches) under `src/runtime/assets.js`'s ownership. No service worker, no Cache API, no asset manifests. A phone sees `WorldGate.jsx` first, which quotes `WORLD_MB` and asks before loading.
- **The world runtime** (`src/runtime/`, built per `2026-10-06-world-runtime-design.md`): one renderer, loop, input, quality, saves, assets and audio shared by the world modules. `rt.saves` is JSON over `localStorage` (about 5 MB per origin, synchronous).
- **Chunking exists once.** The Minecraft world (`src/components/minecraft/`) is the one chunked, seeded, endless place: 16 × 16 × 256 chunks made and meshed in a worker (`worker.js`, `rules/jobs.js`), asked for nearest first with a cap in flight, let go behind (`module.js`'s `wanted`/`load`/`dropFar`), its save the seed plus the player's edits only (`rules/save.js`, key `tp-mc`). Nothing else uses it: `lib/three/lod.js` has no importer, the universe and the galaxy keep their whole world on the graphics chip.
- **The smooth-worlds design** (`2026-10-07-smooth-worlds-design.md`, plan with 12 tasks) is approved and unshipped: `lib/three/gpuWork.js`, `frameGuard.js`, `calibrate.js`, `LoadingVeil.jsx` do not exist yet. It is the budgeted GPU work and the loading screen this design relies on.
- **Generation is hand-authored.** The universe map's places are ten fandom planets and the site's pages (`universe/universes.js`), laid on a golden-angle spiral (`layout.js`), 36,000 units to the edge after the spread, with a region/hyperlane graph derived from that layout by pure functions (`regions.js`, `hyperlanes.js`). The galaxy's eighteen systems are a table (`galaxy/systems.js`'s `AS_SET`). Procedural pieces exist at the detail level only: the belt (`belt.js`, seeded), landing props (`landings.js`'s `seedOf`, `scatterSpots`), galaxy surface heights (`galaxy/surface/terrain.js`, `noise.js`'s `fbm`), planet shaders (`galaxy/bodies.js`). Positions are plain floats, no floating origin; the Rick and Morty sector at 48,000 is the proven limit.
- **Saves**: `tp-pilot` (wallet), `tp-gcw` (war), `tp-mc` (Minecraft), a dozen small keys, all in `localStorage`. One IndexedDB user: the N64's ROM store (`n64/romStore.js`).

## How it works: the four answers

### 1. Chunking is three things, and the runtime gets all three as services

Minecraft's chunk loop is the right shape and it is trapped in one module. It becomes three runtime services any world uses:

- **`rt.chunks`**: a grid over 2D space (x, z) with a cell size and a radius. Each frame it is told where the player is and which way they face; it answers with the cells to ask for (nearest and ahead first) and the cells to drop (past the radius plus one, so a cell on the edge does not flicker in and out). It holds the in-flight set with a cap, and a generation number so a late answer for a cell already dropped, or for an older seed, is thrown away. Pure, tested, no three.js.
- **`rt.workers`**: a pool of workers with one message protocol: `request({ type, key, priority, ...}) → promise`, `cancel(key)`, transferable buffers back. Generation and meshing run there. Minecraft's `scene/chunks.js`'s `workerClient` and `rules/jobs.js`'s `makeClient` are the seed of it.
- **`rt.origin`**: a floating origin. Positions handed to three.js are relative to an origin the runtime moves when the player gets more than a cell from it, and the shift is broadcast so every object, the camera and the online poses re-anchor in the same frame. Without it an endless universe drifts at a few hundred thousand units; with it the limit is gone.

What a cell's answer is sent to the graphics chip through is the smooth-worlds design's `gpuWork` queue, under its per-frame budget. That design is the prerequisite: its Phase 0 below.

### 2. "Download, wait, then open" is an install, and an install needs a pack

A world's **pack** is the list of everything it fetches: its JavaScript chunks and every model, texture, sky and sound under `public/` it can ask for, with sizes and content hashes. The pack is made at build time (`scripts/packs.mjs` after `vite build`), from the world's own declaration (`src/components/<world>/pack.js` exports `PACK`, a list of URLs and folder globs) joined to the chunk graph the bundler wrote. A test (`scripts/pack-check.mjs`) fails the build when a world's source mentions a `/models/`, `/textures/`, `/audio/` or `/hdri/` URL that its pack does not cover, so a pack cannot quietly go stale.

An **install** fetches a pack's files into the browser's Cache API under a versioned cache name, a few at a time, with a progress bar in bytes and a time estimate, and skips what is already there, so an interrupted install resumes. A **service worker** (`public/sw.js`) serves anything in an installed pack from the cache first, network second, and nothing else differently (the site stays a normal site; the worker is small and does not precache). The browser is asked once for persistent storage (`navigator.storage.persist()`), so an installed world is not evicted under pressure, and `estimate()` shows what room is left.

The loading screen then has two bars where the smooth-worlds design has one: **Download** (the install, skipped when installed) and **Prepare** (the GPU warm-up, `prepareScene`). The owner's "wait 2 minutes, then open" is exactly those two in order behind the veil, and an installed world skips the first and opens from the device, offline too.

`WorldGate.jsx` becomes the install's front door on every device, not only a phone's gate: a card with the world's true pack size, Install, and after that Open; a `/worlds` page lists what is installed, how big, and lets it go.

### 3. Dynamic generation: the Expanse, seeded all the way down

The authored map stays what it is: the home system, the fandom planets, the galaxy, the Rick and Morty pocket. It becomes **sector `0,0`** of an endless grid of **sectors**, each a square of `SECTOR = 80,000` units, addressed by integers `(sx, sz)`. Everything past the authored edge is generated:

- **A sector** is made by one pure function from one seed: `makeSector(seed, sx, sz)`. The seed is a 64-bit hash of the universe seed and the coordinates, so neighbours agree without talking and a sector is the same on every device and every visit. It yields 8 to 24 star systems (Poisson disc in the sector's disc, never within the authored edge for sector 0,0's neighbours), each with a star (class, colour, size), 1 to 7 planets (type from a table: rock, ice, gas giant, lava, ocean, desert, forest, ringed; radius, colour, moons, rings), a name from a syllable grammar per culture, a faction weighted by distance from home (the authored sides at the core, independents and generated factions further out), a traffic density and a hazard; a few wonders (nebula, pulsar, derelict, rogue planet); and lanes: a hub graph among its systems built with `hyperlanes.js`'s own `build()` over the generated places, and one trunk from each side of the sector to the neighbour's facing beacon, so the web is continuous across the grid.
- **Drawing it** reuses what the universe map has: far places as impostors (`farPlaces.js`), planets as shader spheres (`galaxy/bodies.js`), lanes and traffic (`hyperlanes.js`, `traffic.js`), the director's events with generated places as `where`. The map's sector cell is a chunk in `rt.chunks` with radius 1 (the 3 × 3 of sectors round the ship); the sectors beyond are a star-field sprite layer with the right density.
- **Landing** on a generated planet makes its surface from the planet's seed: a ground style from `landings/ground.js`'s existing styles, a palette, biomes, gravity and sky from the type, and the terrain as cells of a heightmap (`CELL = 64` metres) through `rt.chunks` again, heights from `galaxy/surface/noise.js`'s `fbm` in the worker, props from the CC0 kits already in `public/cc0` and `public/hq` placed per cell by seed as instanced meshes. The walker, the HUD and the take-off are `footScene.js`'s.
- **The universe seed** is one constant for the shared universe, so every pilot flies the same Expanse and the online room agrees on where `E:3,-2:kepler-9` is (`where.js` learns the sector address). A **pocket universe** is the same code with a different seed, reached by `/universe?seed=<word>`, and is one of the worlds the registry below keeps.

Why seeds and not stored content: a generated world costs nothing to store and nothing to download. Minecraft's save already proves the model: the terrain is never saved, only the seed and what the player changed. The Expanse does the same, so "infinite worlds" and "easy to load" are the same decision.

### 4. Persistence: local is easy and enough; shared is a step up and optional

**Is it possible without a server? Yes, in two layers.**

- **On this device** (easy, no server): IndexedDB through a small runtime store, `rt.store`. Asynchronous, hundreds of megabytes, structured values and blobs. A **world registry** in it: one row per world the visitor has (Minecraft seeds, pocket universes, generated planets they named), with name, seed, kind, when played, a thumbnail and the size of its changes. Saves that can grow (Minecraft's edits, the Expanse's claims and names) move from `localStorage` to the store with a one-time migration that keeps today's `tp-mc` working. `rt.saves` stays for the small keys. A `/worlds` page: My worlds (new, continue, rename, delete, export to a file, import), and the installed packs from answer 2.
- **For others** (possible, best-effort, no server): the world's identity is its seed, so a link carries a whole world: `/dot-matrix/minecraft?world=<seed>`, `/universe?seed=<word>`. Changes to a world are small deltas (Minecraft's run-length edits are kilobytes an afternoon), and the Nostr relays the site already talks to keep **replaceable** events (kind 30078, NIP-78 application data, one per `d` tag per key): a world card (seed, kind, name, under 1 KB) and its deltas in parts under 60 KB each. Anyone reading the relays sees "Worlds from others" on `/worlds` and can open one; only the key that published a world can replace it. The limits are the relays': they can prune, they are public, and a popular world could be copied. That is the same footing the multiplayer already stands on, and the owner has accepted it.
- **A server** (a Cloudflare Worker with R2 or D1, or Supabase) is the step up if relays prove too lossy: an account, a deploy pipeline and secrets the site does not have today. This design leaves a seam for it (`rt.store`'s `sync` is a function the Nostr layer implements; a server could implement the same) and does not build it.

**What persists, in one table:**

| What | Where | Size | Survives |
|---|---|---|---|
| Installed packs | Cache API (service worker) | 1 to 200 MB a world | until uninstalled or storage evicted (persist asked) |
| World registry, big saves (edits, claims) | IndexedDB (`rt.store`) | KB to MB | until the visitor deletes |
| Small keys (`tp-pilot`, `tp-gcw`, choices) | `localStorage` (`rt.saves`) | under 5 MB total | as today |
| A world's identity | its seed, in the URL | bytes | forever |
| World cards and deltas for others | Nostr relays, replaceable events | under 1 KB + parts of 60 KB | best-effort |

## Decisions

1. **Smooth-worlds first.** Its plan is approved and nothing here can hold a frame budget without `gpuWork` and `frameGuard`. It is Phase 0, run as written, not folded in.
2. **Three runtime services, not a Minecraft refactor.** `rt.chunks`, `rt.workers`, `rt.origin` are new pure modules in `src/runtime/`. Minecraft moves onto the first two with no change in what it does (its tests prove the same set of chunks is asked for and dropped), and is the reference for every world after.
3. **Packs are declared and checked.** A world owns `pack.js`; the build makes the manifest; a test fails on an undeclared URL. No scraping of the DOM, no guessing at run time.
4. **The service worker is passive.** Cache-first for installed packs only. It never precaches, never updates the app shell, never intercepts the Nostr sockets. Deleting it leaves a working site.
5. **Install is the gate for everyone.** A desktop sees the card too (it may say "Open" at once for a world under 8 MB). A phone's old gate reasons (`WorldGate.jsx`'s `WHY`) stay as the card's warnings.
6. **One universe seed, shared.** `UNIVERSE_SEED = 'tilakverse'` hashed. Pocket universes are a different seed and a registered world. Multiplayer poses carry a sector address.
7. **Generated content is never stored.** Only seeds and deltas are. Deltas are per-world, versioned, migrated like `rt.saves` keys.
8. **Floating origin rebases in whole cells**, `ORIGIN_CELL = 50,000`, so a shift is rare and exact in floats (a multiple of a power-of-two-friendly constant is not required: the shift is applied to every position in one frame, and the test pins that no object moves on screen).
9. **Reuse before new.** Impostors, planet shaders, lanes, traffic, the director, landings' ground styles, the surface noise, the CC0 kits, `footScene.js`: the Expanse composes them. A new renderer piece is written only where none exists (the sector star-field layer).
10. **Sharing is Nostr, replaceable events, best-effort, last.** Phase 6, after local persistence has shipped and been used.

## What this is not

- Not a rewrite of any authored world, the galaxy, or the universe map's gameplay. Sector 0,0 is the map as it is.
- Not a Minecraft gameplay change. It gains the registry (many worlds by seed), the store (edits in IndexedDB) and the shared chunk services. Its rules do not move.
- Not multiplayer in the Expanse's generated places beyond what the room already does (poses, tags, the roster's "where"). Battles and the fleet war stay in sector 0,0 in this design.
- Not a server. The seam is left; the account is not opened.

## Sub-projects, and what each depends on

Each is one pull request from one session, with its own section in the plan.

| Phase | Name | Depends on | Can run alongside |
|---|---|---|---|
| 0 | Smooth worlds (existing plan `2026-10-07-smooth-worlds.md`) | none | 1, 2 |
| 1 | Install packs: `pack.js`, `scripts/packs.mjs`, `public/sw.js`, `runtime/install.js`, the gate and `/worlds` | none | 0, 2, 3 |
| 2 | The store and the registry: `runtime/store.js`, `worlds/registry.js`, Minecraft saves migrated, `/worlds` My worlds | none | 0, 1, 3 |
| 3 | Chunk services: `runtime/chunkGrid.js`, `workers.js`, `origin.js`, Minecraft on them | 0 (for the GPU queue) | 1, 2 |
| 4 | The Expanse: sectors generated, drawn, laned, in the roster | 3 | 5's generation half |
| 5 | Landing on the Expanse: generated surfaces | 3, 4 | 6 |
| 6 | Worlds for others: Nostr cards and deltas | 2, 4 | 5 |

Three sessions can start at once (1, 2, 3 after 0). Phase 0 is a fourth, started first.

## Testing

Every new module is pure where it can be and tested in Node with Vitest, as the runtime's are. The plan names each test. The browser checks are the repo's own: `node scripts/autopilot-check.mjs --only smoke` on each touched route, `scripts/perf-probe.mjs` for the frame-time claim, Playwright for the install flow (the service worker and the Cache API work in headless Chromium).

## Open assumptions, marked

- Sector size 80,000 and 8 to 24 systems a sector are first numbers; the plan's tests pin a range so a session can tune them.
- The galaxy's authored systems stay out of the Expanse (reached as today by the gate). A later design may seed systems between them.
- Nostr relays' retention of replaceable events is unmeasured; Phase 6 begins by measuring it on the four relays in use for a week before shipping the feed.
