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

**Draw calls and triangles at mid** (`node scripts/universe-check.mjs --quality mid --frames 3`, main at `6ae5a82b` and this branch run side by side, each from its own checkout with its own `node_modules`; side by side because the generated orbits and traffic run on the wall clock, so runs at different times differ by tens of triangles even on main):

| pose | main calls | branch calls | main triangles | branch triangles |
| --- | --: | --: | --: | --: |
| overview | 97 | 96 | 518,697 | 518,617 |
| falcon-sun | 79 | 79 | 503,595 | 503,595 |
| middleearth-limb | 37 | 37 | 67,387 | 67,387 |
| rickmorty | 38 | 38 | 68,513 | 68,513 |
| gaming | 41 | 41 | 75,121 | 75,121 |
| caribbean | 41 | 41 | 117,147 | 117,147 |
| middleearth | 37 | 37 | 67,387 | 67,387 |
| breakingbad | 62 | 62 | 61,585 | 61,585 |
| office | 39 | 39 | 52,891 | 52,891 |
| belt | 44 | 44 | 450,953 | 450,953 |
| maw | 41 | 41 | 103,909 | 103,929 |
| landing-middleearth | 117 | 117 | 138,056 | 138,078 |
| station | 67 | 67 | 488,869 | 488,869 |
| far-rim | 40 | 40 | 70,261 | 70,259 |

No pose gains a call. Maw’s and landing-middleearth’s twenty-odd triangles are the clock’s: a second maw visit in the same run gave 103,905 on the branch against main’s 103,907, and a list of every visible mesh and instance count at maw is the same on both trees (51 each). The first run found a rogue world 18.7 of its sizes from the breakingbad camera (+1 call, +720 triangles, the near layer’s default sphere): the new weights had moved a lattice thing inside the near layer’s 30-size mesh hand-over, which lane 2 had held by measurement alone. The lattice now keeps `THING_CLEAR` (31) of its sizes off every keep-out, every baseline pose being inside one, and `things/clear.test.js` holds every lattice thing over 30 sizes from every pose. That also takes a rock off the overview (one call, 80 triangles fewer).

**The endless check** (`node scripts/universe-endless-check.mjs --quality mid`): every step ok, no pop, at least 10 places within 9,000 and the nearest within 4,700 at each.
