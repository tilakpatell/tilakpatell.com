# Lane 4a’s numbers: things in space and gargantuans

The endless universe’s lane 4a (spec sections B and C; the plan is draft #1244’s `docs/superpowers/plans/2026-10-18-endless-universe-lane-4a-things.md`, on `claude/trusting-sagan-tda0fm`). Data and text only; the pictures are remade by the scripts.

## PR 4a.1: the catalogue in the generator

Pure: it changes the generator, lane 3’s `places/` and the words. Today’s drawing (`expanse/scene/discs.js`, `nearThings.js`) draws the lattice and the legacy wonders only, so of this group just the lattice’s four new kinds reach a screen, as far-layer discs (to 20,000) and, within 30 of their sizes, meshes.

**Health,** before (main at `6ae5a82b`) and after: `boundary-breaks` 468 of 475, `cycles` 5 of 5, `big-files` 22 of 22, `glsl-sites` 612 of 613. `scene.js` 6,455 lines, untouched.

**The generator’s time** (lane 2’s “ten middle-layer sectors in under 600 ms”, its loop timed alone, best of three, CPU): 290 ms before the lists, 272 to 346 ms with all sixteen (the machine runs several lanes; no gargantuan sits on the middle layer of the shared universe, whose residues are `[1, 1, 0]`).

**A sector’s lists** (`E:1,0`): wormhole 1, remnant 2, pulsar 3, forming star 1, storm 2, pocket 3, swarm 3, herd 1, debris 4, field 85, comet 65, rig 29, fleet 45, shipyard 16. Its gargantuan and arrival lists are empty (no gargantuan there; the arrival is the core’s).

**Gargantuans near home:** arcs in `E:1,0,1` and `E:1,0,-2`, Dyson swarms in `E:-2,0,1` and `E:-2,0,-2` (ids are `sx,sz,sy`). Their sectors’ appended systems moved; the three endless poses’ sectors hold none.

**Discs over 4 px at the baseline poses,** by kind (`things/clear.test.js`, “counts the discs over 4 px”, 1080 high at 34°, counted to the far plane; today’s drawing stops lattice discs at 20,000 and draws no list row, so these are an upper bound for what 4a.2 shows). At `overview`: rock 817, ice 228, derelict 147, rogue 58 (lane 2’s four); outpost 56, monolith 16, relay 16, beacon 8, comet 4 (this lane’s). The other nine poses are within a few of it; `rickmorty`, `caribbean`, `maw` and `middleearth-limb` add one to four rigs. The core’s beacons are drawn at their own size, not three times it. Every one is a point of farStars’ one `Points`: no draw call, no triangle.

**Tests replaced, each by its successor** (named in its commit): lane 2’s `things.test.js` “has four valid kinds” and `expect(SECTOR_EXTRAS).toEqual([])`; lane 3’s `cards.test.js` `expect(c.far, k).toBe(FAR)` (the five gargantuan cards at 400,000). Lane 3’s `around.test.js` cap test leaves the disc-less list rows out of its capped half, as the new rule lists them outside the cap.
