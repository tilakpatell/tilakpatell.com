# Minecraft, a fan tribute on Dot Matrix island

Date: 2026-10-07. Status: design, written for a session on Opus 5.5 to build from. The plan is `docs/superpowers/plans/2026-10-07-minecraft-world.md`; the hand-off is `docs/superpowers/HANDOFF-worlds.md`.

A Minecraft-style survival world to walk, dig and build in, made for this site from scratch in Three.js on the world runtime, the way Super Mario 64 was (`2026-10-06-mario64-design.md`). An infinite seeded Overworld of one-metre blocks in 16 × 16 × 256 chunks: biomes, trees, caves, ores, water and lava, a 20-minute day, the hotbar and the inventory, crafting on the 2 × 2 and 3 × 3 grids, tools that break blocks at Minecraft's own speeds, torches that light the dark, and the mobs that come out at night. It lives under the Gaming planet beside the Mario tribute: `/dot-matrix/minecraft`, and a giant crafting table on the island that opens it.

## What the owner asked for

- "Make the Minecraft world. Architect it deeply." Fidelity to the source decides everything: Minecraft's numbers, Minecraft's look, Minecraft's rules, not a voxel game in the spirit of it.
- Use the ways the site already has to get models, and integrate it smoothly with the codebase.
- Ship in pull requests merged to main as often as possible without breaking main.
- "Java textures are open, right?" They are not, which changes how the textures come in (next section). The owner also said they have permission to use a variety of games; nothing here depends on that, and if it is a written permission from Mojang or Microsoft, one line of the plan changes (the default pack).
- "Can we run an offline Minecraft, as it's lightweight?" The real game is not lightweight in a browser, and the site cannot host it; the section *The real thing* says what is possible and what this design does instead.

## Textures, models and sounds: where they come from

Minecraft is the one world on the site where the models are almost all code. Blocks are cubes; mobs are boxes. What gives it its identity is the pixel art painted on them and the numbers behind them, so the asset question is a texture question.

**The vanilla textures cannot ship with the site.** Minecraft's EULA and its [usage guidelines](https://www.minecraft.net/en-us/usage-guidelines) let anyone use the assets in their own copy of the game and in resource packs with credit, and forbid distributing them. Putting `grass_block_side.png` from the jar in `public/` is distribution. The site also has a standing rule that every asset is licensed and credited.

**The pipeline reads the standard resource-pack layout, so the source of the pixels is a swappable input.** `scripts/mc-atlas.mjs` takes a folder laid out as a Java resource pack (`assets/minecraft/textures/block/*.png`, `item/*.png`, `entity/**/*.png`, with 16 × 16 block tiles) and builds what the world draws: a block texture array, the item sheet, the mob skins and a manifest. Three sources plug into it:

1. **The shipped pack: Pixel Perfection** by XSSheep, CC BY-SA 4.0. The closest thing to vanilla that is free to redistribute: a 16 × 16 pack drawn to be a faithful alternative, used by VoxeLibre on Luanti for the same reason. Its *Legacy* release covers the 1.12-era blocks, items and mobs; its continuation on Modrinth covers newer names. The script's alias table maps 1.12 file names to the modern ids the code uses (`grass_top` → `grass_block_top`, `log_oak` → `oak_log`). Credited in `public/games/credits.json` (`mc/pixel-perfection`), in `public/cc0/README.md`'s "Not CC0" list, and on the page. Share-alike is fine: the site sells nothing and the built atlas is published under the same licence.
2. **The visitor's own copy, 1:1.** The N64 precedent: the emulator runs the visitor's own ROM from their device, and nothing leaves the browser. Here the pause menu's *Textures* panel takes a resource-pack `.zip`, or the game's own `1.21.x.jar` from `.minecraft/versions/` (a jar is a zip with the same `assets/minecraft/textures/` inside). The pack is read in the browser (`fflate`, 8 kB, already a candidate for the N64's ROM store; or the browser's own `DecompressionStream`), the same atlas builder runs in the page (`atlas.js` is shared between the script and the page), and the world re-textures without a reload. The file is kept in IndexedDB (`packStore.js`, after `n64/romStore.js`) so it is there next visit. Anyone who owns Minecraft gets Minecraft's own pixels; the site never has them.
3. **A written permission from Mojang.** Should the owner hold one, the vanilla pack goes through the same script as the default and Pixel Perfection becomes the fallback. Nothing else changes.

**Mob models are data in Minecraft's own model convention**, not downloaded. Each is a list of boxes in pixels (16 to a block) with a pivot and a texture offset, unwrapped by the standard cube net (top, bottom, right, front, left, back round the offset), the convention every skin and mob texture is painted to. So a skin from any pack, or the visitor's own, lands on the right faces. The dimensions are the game's: a player's head is 8 × 8 × 8 at a 64 × 64 skin's (0, 0), the body 8 × 12 × 4 at (16, 16), arms and legs 4 × 12 × 4; a creeper's four legs are 4 × 6 × 4; an enderman's limbs are 2 × 30 × 2. The plan has the table.

**Sounds and music are made in code**, as every tribute's are. Minecraft's sounds are not in the jar (they are in the launcher's asset index) and are Mojang's. `sounds.js` synthesises the dig and step sounds per material class (grass, stone, wood, sand, gravel, cloth), place, the item pop, hurt, the creeper's hiss and bang, the zombie's groan, the cow, pig, sheep and chicken, doors, the level-up chime, and a slow ambient piano in the spirit of the game's music, not its tunes. ElevenLabs effects (`threejs-audio-generator`) can replace any of them later; the manifest is the same.

**Other sources, and why not.** gen3d and TRELLIS make smooth meshes: nothing here wants one. Meshy and Tripo likewise, though Tripo's voxel stylisation of a model the site already has is a fun way to make a block statue; `scripts/mc-voxelize.mjs` does that for free in Node from any GLB in `public/models/` (a triangle-to-grid voxeliser with the nearest block by colour), so the X-wing, Optimus and the Ring can stand in the world as builds (Phase 6). Sketchfab's Minecraft uploads are either rips or worse than boxes. Kenney's Voxel Pack (CC0) is the fallback if Pixel Perfection turns out to be missing tiles; the alias table can point any id at any file.

## The real thing

The owner asked whether an actual Minecraft could run in the page, the way the island's N64 runs the real Super Mario 64. What exists:

- **Browsercraft** (Leaning Technologies): Minecraft 1.2.5's unmodified `client.jar`, fetched by the visitor's browser from Mojang's own servers and run on CheerpJ, a JVM in WebAssembly. Nothing is hosted by the page. It takes minutes to start, needs hundreds of megabytes, runs the 2012 game, and CheerpJ's runtime must load from Leaning Tech's CDN at run time, which the site's rules forbid (every world's assets are self-hosted; the N64 ships EmulatorJS in `public/n64/`).
- **Eaglercraft**: a decompiled, ported client. Mojang has taken it down before. Not an option.
- **Luanti in WebAssembly** with VoxeLibre: free software end to end, but an experimental port of a different engine, and tens of megabytes before a block is drawn.
- **Minecraft Classic** at classic.minecraft.net: Mojang's own free browser version of 0.0.23a. It cannot be framed, but it can be linked.

So: the tribute is the world, the pause menu links to Minecraft Classic as "the real thing, Mojang's own, in a new tab", and the visitor's-own-pack path gives the 1:1 textures. If CheerpJ's terms or the self-hosting rule change, a *Browsercraft* mode slots in beside the tribute the way the N64's emulator sits beside the Mario tribute (`DotMatrixWorld.jsx`'s `n64` state takes `'emu' | 'tribute'`); the design leaves that door, and nothing more.

## Architecture

A world module on `src/runtime` (`{ id: 'minecraft', shading: 'glsl', mb: 2, create(rt, props) }`) in `src/components/minecraft/`:

```
rules/                pure JS, no three.js, tested with vitest; runs in the page and in the worker
  blocks.js           the block registry: id, name, faces (texture ids), class (solid, cutout, cross, liquid, light), hardness, tool, drops, light, opaque
  items.js            items and tools: tiers, speeds, durability, stack sizes
  chunk.js            Chunk: 16 × 16 × 256, Uint8Array ids, Uint8Array light (sky << 4 | block), Uint8Array state; get/set; a sparse edit log
  noise.js            seeded simplex and octaves (lib/seeded for the seed)
  worldgen.js         height, biomes, caves, ores, trees, water, bedrock, from a seed; deterministic per chunk
  light.js            sky light and block light, 0–15, flood fill with the game's rules; relight on an edit
  mesher.js           a chunk section's faces: culled by neighbour, vertex AO, per-face shade, light, texture index; typed arrays out
  raycast.js          voxel DDA: the block and the face under the crosshair, reach 4.5
  physics.js          the AABB mover: 0.6 × 1.8, 20 Hz, gravity 0.08, drag 0.98, jump 0.42, step 0.6, water, ladders
  player.js           the player: position, look, health, hunger, air, fall, sneak, sprint, the arm swing
  inventory.js        36 slots, the hotbar's 9, stacks of 64 (16 for some), pick up, move, split, drop
  crafting.js         shaped and shapeless recipes matched on a 2 × 2 or 3 × 3 grid
  recipes.js          the recipe table (data)
  mobs/               the mobs: each { make, step, hurt, die, drops }, the AI in ticks
  time.js             24000 ticks a day; sun angle, sky light level and sky colour by time
  spawn.js            where mobs appear and go: light level, distance, caps, despawn
  game.js             the sim: the loaded chunks, the player, the entities, dropped items, block breaking, placing, saves; events out
  save.js             tp-mc v1: seed, edits per chunk (run-length), player, inventory, time
worker.js             worldgen, lighting and meshing off the main thread; a job queue with cancel; transferables
pack/
  atlas.js            resource pack folder or zip → { blocks: DataArrayTexture pixels, items, skins, manifest }; shared by the script and the page
  packStore.js        the visitor's own pack in IndexedDB
  pixel-perfection/   (public/mc/: the built atlas, committed)
scene/
  terrain.js          chunk sections as meshes (opaque, cutout, water), frustum culled, a material per pass
  shaders.js          the block material: texture array, nearest magnification with mipmaps, AO × light × shade, fog, day tint, water waves
  sky.js              the sky dome, a square sun and moon, the stars, the cloud layer at y = 128, sunset and night colours by time
  models.js           box models from data in the game's convention; a skin on each
  entities.js         the player's arm and held item in first person, mobs with limb swing, dropped items turning, the third-person player
  cursor.js           the block outline and the ten crack stages
  particles.js        block breaking crumbs, torch smoke, water drips, splash
  icons.js            hotbar and inventory icons: isometric block cubes drawn from the atlas, flat items
scene.js              createScene(renderer, rt): the above as one scene; sync(g, alpha); render; resize; dispose
module.js             the world module: input binding, the 20 Hz tick, the worker, events to the page, the save
Minecraft.jsx         the HUD, inventory, crafting, pause, title, textures panel, touch controls
minecraft.css
pages/Minecraft.jsx   the route /dot-matrix/minecraft
```

**Data flow.** `game.js` owns the truth: chunks, entities, the player. It asks the worker for new chunks as the player moves (`worldgen` → `light` → `mesher`, all three in the worker, the chunk's arrays coming back as transferables and the mesh as typed arrays), and re-meshes a section on an edit by sending the edit and the section's neighbours' borders. `scene.js` holds a mesh per section and swaps its geometry when a mesh arrives. The sim runs at a fixed 20 Hz (the game's tick) from the runtime's input snapshot; the scene draws between the last two ticks (`sync(g, alpha)`), so it is smooth at any frame rate. `module.js` tells `Minecraft.jsx` what to show through `rt.events` (`hud`, `inventory`, `ui`, `chat`, `death`), never a React render a frame. The save is `tp-mc`, version 1, through `rt.saves`.

**The look is Minecraft's, on purpose.** No normal maps, no PBR, no bloom. A block's colour is its texel × the face's shade (top 1.0, bottom 0.5, north and south 0.8, east and west 0.6) × its light (the game's brightness curve over the 16 levels, with the night's floor and the torch's warm tint) × its vertex AO (four levels, the classic "smooth lighting"). Grass, leaves and water are tinted by biome. The sky is the game's gradient by time of day, the fog takes the sky's colour at the horizon, and the sun and moon are squares. Like Dot Matrix's dither and Mario's N64 look, this world is left off the house look (`lib/three/house.js`): its flat light is the point. Textures magnify nearest-neighbour and minify through mipmaps, which is why they live in a `DataArrayTexture` (one layer per 16 × 16 tile, 16 × 16 × N, with its own mip chain) rather than a packed atlas that bleeds at the seams.

**Performance.** Everything heavy is off the main thread. A section is drawn only when it has faces and is in the frustum; a chunk column is loaded in a spiral from the player and unloaded past the render distance plus two. The render distance follows the tier (`rt.quality.tier`: high 10 chunks, mid 6, low 4) and the quality level steps it down (`lowerQuality`: 10 → 8 → 6 → 4). A whole 16 × 16 × 256 chunk is 128 kB of ids and light; ten chunks out is 441 columns, 55 MB, within a desktop's budget and well under a phone's at 6 (169 columns, 21 MB). Geometry is interleaved into one buffer per section with 8 bytes a vertex (position as three bytes in the section, a packed normal and AO, the texture index and light), so a full forest hill is a few hundred kilobytes on the GPU. The module declares `mb: 2`: the atlas, the item sheet and the skins.

**Phones.** The same world. The touch controls are Minecraft Pocket Edition's: a stick on the left, jump and sneak buttons, look by dragging the right half, tap and hold to dig, tap to place, a hotbar across the bottom, and the inventory button. Render distance 6 at mid and 4 at low.

## The world

**Chunks and height.** Columns of 16 × 16 blocks, 256 high, as in Java 1.2 to 1.17: bedrock at y = 0 (solid, with one to four blocks of it mixed into the stone above by noise), sea level at y = 63 (the top water surface), clouds at y = 128, the build limit at 255. Chunk coordinates are `floor(x / 16)`, `floor(z / 16)`.

**Generation** is deterministic per chunk from the world seed, so a chunk is the same whoever asks for it and whenever: the tests make a chunk twice and compare. In order:

1. **Terrain.** Three low-frequency noises, continentalness (land against sea), erosion (flat against rough) and peaks, combined into a height field the way 1.18 does but in one pass; a 3D density noise above and below it carves overhangs and fills nothing below the field. Plains sit at 64 to 72, hills to 100, mountains to 140 and higher with stone and snow above 100, the sea floor at 40 to 60.
2. **Biomes** by temperature and humidity noise: plains, forest, birch forest, taiga, mountains, desert, savanna, swamp, jungle, snowy tundra, ocean and beach. A biome picks the surface (grass, sand, snow, podzol), the tint of grass, leaves and water, the trees and the plants.
3. **Caves.** Two noises: cheese caves (big rooms where a 3D noise is above a threshold, more often below y = 30) and spaghetti caves (long tunnels where the product of two noises is near zero), both opening to the surface at times. Lava fills caves below y = 10.
4. **Ores**, in blobs by depth: coal to 127, iron to 63, gold to 31, redstone to 15, lapis to 30, diamond to 15, with the game's frequencies, and gravel and dirt pockets.
5. **Water** fills the terrain below 63 where it is open; lakes are rare pockets on land.
6. **Trees and plants**, from a per-chunk random: oak and birch with the game's shapes (a 4 to 6 trunk, the leaf cross), spruce in the taiga (the layered cone), jungle giants, acacia in the savanna, cacti and dead bushes in the desert, tall grass, dandelions and poppies, sugar cane at the water's edge, pumpkins now and then. A tree that reaches into the next chunk is placed by whichever chunk owns its trunk and is written into the neighbour when it loads (a feature list per chunk).

**Light** is the game's: sky light 15 where the sky is open and falling by one through each transparent block and to zero through an opaque one; block light from a source (torch 14, glowstone 15, lava 15, redstone ore 9 when touched, the furnace 13 when lit) falling by one a block in all six directions; both as flood fills that stop at opaque blocks. A placed or broken block relights its region. What is drawn is `max(sky × daylight, block)`, where `daylight` follows the time of day, floored at the moon's 4 of 15.

**Blocks** in the first shipped version (the registry grows after): stone, cobblestone, dirt, grass block, sand, sandstone, gravel, clay, bedrock, water, lava, the five logs and their planks and leaves (oak, birch, spruce, jungle, acacia), coal, iron, gold, redstone, lapis and diamond ore, iron, gold and diamond blocks, glass, bricks, stone bricks, mossy cobblestone, obsidian, snow (layer and block), ice, bookshelf, glowstone, torch, crafting table, furnace, chest, ladder, oak door, oak fence, oak slab and stairs, wool in the sixteen colours, tall grass, fern, dead bush, dandelion, poppy, the five saplings, cactus, sugar cane, pumpkin, jack o'lantern, melon, wheat, farmland, TNT, netherrack, a bed. Each has the game's hardness (dirt 0.5, stone 1.5, obsidian 50, bedrock unbreakable), the tool that mines it fastest and the tier it needs to drop (diamond ore needs iron or better), what it drops (stone drops cobblestone; grass drops dirt; leaves drop a sapling 1 in 20 and an apple 1 in 200 from oak), whether it is opaque to light, how much light it gives, and its shape: a full cube, a cutout (leaves, glass, the sapling's cross), a liquid, a thin face (the ladder, the torch's post), a slab or a stair (their own meshes), a door (two blocks, open or shut, hinge side).

**Breaking and placing.** Holding the button on a block grows a crack over the game's time: `hardness × 1.5 s` by hand, `hardness × 5 s` by hand for a block that needs a tool you do not hold, and with the right tool, `hardness × 1.5 / speed` where wood's speed is 2, stone 4, iron 6, diamond 8, with sneaking, swimming and standing in the air slowing it as the game does. Placing puts the held block on the face under the crosshair, never inside the player or a mob; stairs face away from the player, logs take the axis of the face, torches hang from the face. Water flows: a source spreads to seven levels over open ground and falls, as a 5-tick cellular update; lava flows four and slower, sets wood alight (a flag, no fire spread in the first version) and makes obsidian or cobblestone with water. Sand and gravel fall when unsupported. Saplings grow into trees after a few minutes of ticks. Grass spreads to lit dirt and dies in the dark.

**Time.** 24000 ticks a day at 20 a second, 20 minutes. Sunrise at 0, noon at 6000, sunset at 12000, full night from 13000, midnight at 18000. The sun crosses the sky as a square, the moon follows with its eight phases, stars come out as the sky darkens, and the bed sets the clock to morning when the player sleeps through the night (one player, so the bed just works).

**Mobs** in the first shipped version, with the game's sizes, health, speed and behaviour:

| Mob | Size | Health | Behaviour |
|---|---|---|---|
| Pig, cow, sheep, chicken | 0.9 × 0.9, 0.9 × 1.4, 0.9 × 1.3, 0.4 × 0.7 | 10, 10, 8, 4 | Wander, look at the player, flee when hit; sheep eat grass and regrow wool; chickens flap down and lay eggs. Drop porkchop, beef and leather, wool and mutton, feathers and chicken. Spawn on grass in daylight. |
| Zombie | 0.6 × 1.95 | 20 | Chases the player within 35 blocks at 0.23 blocks a tick, hits for 3, burns at sunrise. Spawns in the dark (light 7 or under). Drops rotten flesh. |
| Skeleton | 0.6 × 1.99 | 20 | Keeps 10 blocks off and shoots an arrow every 2 seconds, 2 to 4 damage; burns at sunrise. Drops bones and arrows. |
| Creeper | 0.6 × 1.7 | 20 | Walks up silently, hisses for 1.5 seconds within 3 blocks, explodes for a 3-block crater; flees cats (none yet). Drops gunpowder. |
| Spider | 1.4 × 0.9 | 16 | Neutral in light, hostile in the dark, climbs walls, leaps. Drops string. |
| Enderman | 0.6 × 2.9 | 40 | Neutral until looked at, then teleports and attacks for 7; picks up and puts down blocks; hates water. Drops an ender pearl. |
| Villager | 0.6 × 1.95 | 20 | In the village (Phase 6): wanders the paths, goes in at night, trades nothing yet. |

A mob's AI is a small state machine stepped at 20 Hz on the same physics as the player, with the game's spawn rules: hostile mobs appear in light 7 or under, 24 to 128 blocks from the player, up to a cap, and despawn beyond 128 or after a while beyond 32; animals appear on grass in daylight at world generation and rarely after.

**The player.** 0.6 wide, 1.8 tall, eyes at 1.62 (1.27 sneaking); walks at 4.317 blocks a second, sprints at 5.612 (double-tap forward, or the key), sneaks at 1.295 and cannot sneak off an edge; jumps with an initial 0.42 blocks a tick under 0.08 a tick² of gravity and 0.98 drag, which is one and a quarter blocks high; steps 0.6; swims, with 15 seconds of air; climbs ladders; takes half a heart a block past a 3-block fall; has 20 health that regenerates when hunger is 18 or more, and 20 hunger that falls with sprinting and jumping and is fed by food. Death drops the inventory where the player fell and respawns at the bed or the spawn. The reach is 4.5 blocks. The first-person arm swings on a dig and a hit, and holds the block or tool.

**Inventory and crafting.** 36 slots, the hotbar's 9 under number keys and the wheel, a 2 × 2 grid in the inventory and the 3 × 3 at a crafting table. The recipes are the game's for everything in the registry: planks, sticks, the crafting table, the tools in five tiers, torches, the furnace, the chest, ladders, the door, fences, slabs and stairs, glass from sand in the furnace, iron and gold from ore, charcoal from logs, bread from wheat, cooked meat, the bed from wool and planks, bookshelves, TNT, and the rest. The furnace smelts over 10 seconds an item with coal (8 items), a plank (1.5), a log (1.5), a stick (0.5) or lava (100). Chests hold 27. Dropped items are little turning blocks that the player walks over to pick up, merging into stacks, gone after 5 minutes.

**Saves.** `tp-mc` v1: `{ seed, time, player: { x, y, z, yaw, pitch, health, hunger, spawn }, inventory, edits: { [chunkKey]: rle }, chests: { [pos]: items } }`. Only edits are saved, as a run-length list of `(index, id, state)` per chunk, so a session of digging is kilobytes. A fresh visit gets a new seed; the title screen offers to continue or start again with a seed of the visitor's choosing (a number or a word, hashed).

**Ghosts.** Other visitors walking the world at the same time appear as the third-person player model, like Middle-earth's travellers (`useTravellers`), with their held item. Their edits are not shared; each visitor's world is their own. Phase 7.

## UI, entry and saves

- **Title.** "Minecraft", a fan tribute, over a slow pan of a generated world. Continue, New world (seed), Textures, Sound. The disclaimer line.
- **HUD:** the crosshair, the hotbar with the selected slot, hearts, hunger, the air bubbles under water, the armour row when there is armour (there is none in the first version), the experience bar (levels, from mining and mobs, spent on nothing yet). The debug line on F3: coordinates, chunk, biome, light, facing, frames a second.
- **Inventory** (E): the 36 slots, the 2 × 2 grid, the player's model turning, drag and drop, shift-click, right-click to split, Q to drop.
- **Crafting table** and **furnace** and **chest** on use (right-click).
- **Pause** (Esc): Back to game, Options (render distance, mouse sensitivity, sound, touch layout), Textures (the pack panel), *The real thing* (the link), Save and quit (to the title, or to the island when opened from it).
- **Textures panel:** which pack is on; "Use your own: a resource pack .zip or your Minecraft .jar", a file picker, what was read ("412 block textures, 189 items, 24 skins"), and "Back to the shipped pack". The file stays on this device.
- **Death screen:** "You died!", the score, Respawn, Title.
- **Desktop controls:** WASD, Space, Shift sneak, Ctrl or double-tap sprint, the mouse under pointer lock to look, left to dig, right to place or use, the wheel and 1 to 9 for the hotbar, E inventory, Q drop, F3 debug, F5 third person, Esc pause.
- **Touch:** as *Phones* above.
- **The island:** a giant crafting table beside the N64 in the square; `nearAction` gets the kind `'craft'`, with the prompt "Play Minecraft"; B opens the game full-screen over the island, as the N64 does (`DotMatrixWorld.jsx`'s overlay state grows a `'minecraft'` case), and the island stops drawing while it is open.
- **The route:** `#/dot-matrix/minecraft` mounts the same component, full-bleed. Without 3D it says what the game is and how to turn 3D on. It is a page of the Gaming universe (`universes.js`'s `pages`), so the prerender, the sitemap, the guide (`guide/routes.js`, `guide/pages.js`) and the world switcher pick it up; the command palette gets an entry; `WORLD_MB` gets `'/dot-matrix/minecraft': 2`; the README's world table and disclaimer gain Minecraft and Mojang; `public/cc0/README.md` and `public/games/credits.json` carry Pixel Perfection's credit; the page shows it.

## Phases, each a pull request to main

1. **Blocks and a chunk you can walk on.** The registry, chunk storage, the noise and a first terrain pass (height, surface, trees), the mesher with AO and shade, the worker, the terrain material on the texture array built from Pixel Perfection, the player's physics, the sky with a fixed noon, the module, the HUD's crosshair and hotbar, the route, the island's table. Done: walk, jump and swim across an infinite seeded landscape at 60 frames a second on the high tier, 30 on a phone.
2. **Dig and build.** The raycast, the outline and cracks, breaking with hardness and tools, placing with facing, dropped items, the inventory and hotbar, the 2 × 2 crafting, saves of edits. Sand and gravel fall. Done: cut a tree, make planks, a table, a pickaxe; build a hut; reload and find it.
3. **Light and the day.** Sky and block light with relighting, torches and glowstone, the day's clock with the sun, moon, stars and sky colours, the brightness curve, the bed. Done: the night comes, a torch pushes it back, sleep brings the morning.
4. **Underground.** Caves, ores, lava, water flow, lava flow and obsidian, the furnace and smelting, the chest, ladders, doors, slabs and stairs, the 3 × 3 recipes, hunger and food, fall damage, the death screen. Done: mine down to diamonds and come back up by ladder with a chest full.
5. **Mobs.** The box models and skins from the pack, the animals by day, the hostile mobs by night, combat with the sword, drops, the mob sounds, spawning and despawning. Done: survive a night.
6. **Biomes and builds.** The full biome set with its surfaces, tints, trees and plants; the village (houses, a well, a farm, paths, villagers); `scripts/mc-voxelize.mjs` and three block statues of the site's own models near spawn; the textures panel with the visitor's own pack. Done: the world looks like the game's, and the X-wing stands in blocks.
7. **Polish.** Particles, third person, the debug line, ghosts of other visitors, the touch layout options, the browser check script, the handoff's remaining items.

Each phase merges green, with `scripts/mc-check.mjs` (Playwright, after `m64-check.mjs`) opening the route, generating, walking, digging and screenshotting, and failing on console errors.

## Testing

- **Unit (vitest), the rules only, no three.js:**
  - `chunk`: get and set at every corner, the edit log, the run-length round trip.
  - `noise`: the same seed gives the same field; the range is −1 to 1.
  - `worldgen`: a chunk twice is identical; the surface at sea level is sand on a beach and grass inland; bedrock at 0 and nowhere above 4; no tree floats; ores within their depths.
  - `light`: 15 under the open sky, 0 under a solid roof, 14 beside a torch and 13 one block on, relighting after a block is placed and after it is broken, no light through bedrock.
  - `mesher`: a lone block has six faces, two touching blocks have ten, a glass block beside stone keeps the stone's face, a water surface has a top face only, AO at a corner is darker than in the open, each face's shade.
  - `raycast`: hits the near face of a block 3 away, misses at 5, picks the face by the entry axis, passes through water and cutouts' air.
  - `physics`: the jump peaks between 1.25 and 1.26 blocks; a 3-block drop does no damage and a 4-block drop does a half heart; sneaking stops at the edge; a 0.6 step is taken and a 1-block step is not; swimming rises; a ladder climbs at 0.15 a tick.
  - `inventory` and `crafting`: stacks merge to 64 and no further, planks from a log in any cell, a pickaxe only in its shape, shift-click to the hotbar, every recipe in the table makes something in the registry.
  - `mobs` and `spawn`: a zombie walks toward a player and hits in reach, a creeper's fuse and crater, nothing hostile spawns in light 8, animals only on grass, despawn past 128.
  - `game`: break time by hand and with each tool, the drop rules, placing refused inside the player, water flowing seven and lava four, sand falling, the day's clock, saving and loading edits.
- **Browser:** `scripts/mc-check.mjs`.
- **Gates:** `npm run lint`, `npm test`, `npm run build` before every push; `node scripts/autopilot-check.mjs --routes /dot-matrix/minecraft` for the screenshots.

## Standing rules that apply

- No Mojang texture, sound, model or code in the repository. The shipped pack is Pixel Perfection, credited; the visitor's own pack never leaves their browser.
- The rules never import three.js; they run in the worker and in vitest.
- Every scene starts from the tier, lowers itself under the quality controller, loads only when near and disposes itself.
- British spelling, curly quotes, plain sentences; comments say why.
- Commit messages are one plain sentence; the body says why, with numbers.
