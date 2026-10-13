# Hoth lands in the game's menu: what was measured

The design is `docs/superpowers/specs/2026-10-13-hoth-landing-game-menu-design.md`, its phase 1 the plan `docs/superpowers/plans/2026-10-13-hoth-landing-game-menu-phase1.md`. This folder holds the numbers its Checks ask for and two pictures.

## How

`scripts/bf-landing-check.mjs` walks an address in headless Edge and prints the time to each mark, the longest main-thread task, the gaps between frames, how many worlds were made and whether a denied address was asked for. The profiler is never on (it makes gaps of its own).

- The machine: the owner's desktop, RTX 5090, headless Edge on WebGPU, 2,560 × 1,440, 2026-10-13.
- Two dev servers (`vite --mode collectioncheck`, the bucket's asset base), each from a clean worktree so neither holds model files the other lacks: `main` at 7cc7b2792 on port 5432, this branch at 49ce1f0c4 on port 5433. Run within the same hour, the two alternated.
- What else was running: other sessions' headless browsers and probes (eight processes when counted), and the game itself, being played. So each number is a size, not an exact figure; the differences below are far larger than the spread.
- A first set of runs compared `main` in a clean worktree with this branch in the lane's own worktree and showed the branch ten seconds slower to ready. That was the worktree, not the code: the lane's worktree holds model files on disk that a clean one fetches differently. On two clean worktrees, four alternated pairs on the straight link to the battle: `main` 24.7, 22.5, 16.2 and 15.1 s; the branch 25.2, 16.5, 17.2 and 15.9 s.

## The way in, before and after

| | before (`main`) | after (this branch) |
| --- | --- | --- |
| `/galaxy/hoth/surface` to something to press | 62.1 s (the surface world built, then its "Choose your battle" menu) | 2.5 s (the game's main menu; no request for the surface's scene, module, models or page) |
| the level ready to deploy into | 19.2 s more, from the battle's address to the waiting screen's Ready | 19.7 s after the menu is drawn, behind the menu |
| the address to ready, both loads | 81.3 s and a click between them | 22.1 s |
| worlds made | two, one after the other | one |
| in the menu, level ready: a click to the next screen | (no menu over a level) | 29 to 287 ms as the check clicks; 10 ms as the page sees it |
| Play on Hoth to the spawn screen, level ready | (the waiting screen was the spawn screen) | 0.3 s |
| Deploy to the field | the wipe | 0.9 s (the wipe: 0.05 s, 0.3 s down, 0.4 s up) |

The menu's own frames, read in the page over four seconds: while the level loads behind it, a median of 4.2 ms and a 95th percentile of 4.4 ms, with one gap of 229 ms; once the level is ready and the world rests under the menu (`stage.js`'s rest), 4.2 and 4.3 ms and no gap over 4.5 ms.

## What did not meet its target

Decision 9 asks that the menu answer within 100 ms throughout the load. After the level is ready it does. During the load it does not yet: in the run above, 36 gaps over 100 ms and a longest of 495 ms, a longest main-thread task of 468 ms. A CPU profile of the load names where the main thread's time goes:

- three's shader builds off the frame (`buildAsync`), three or four to a run before the page gets a turn (`lib/three/pipelineGuard.js`'s `run`): the frames over 100 ms.
- Inside those builds, one line of three's `WGSLNodeBuilder.getUniforms` took 4.0 s of 21 s at 2,560 × 1,440. The cause is found: three r186's `attributeArray` hands a typed array on as a storage buffer's count when it is given an array, and the clustered lights' `lightIndexes` (an `Int32Array` of 76,800 at that size) is made that way; every lit shader's build then compares that array with 0, which turns the whole array into text, 16 to 18 ms a time. It is fixed in its own pull request after this one.
- The frame's own draw while objects' shaders are still unbuilt (`_renderObjectDirect` under the guard).

## Pictures

- `menu.webp`: the game's main menu over Hoth's world, 2.5 s after the old surface address.
- `field.webp`: the field after the menu, Play, the spawn screen and Enter.

## Phase 2: the way to Instant Action, and its setup screen (2026-10-13)

Walked in headless Edge at 1,600 × 900 on the dev server, from `/battlefront/hoth?from=/galaxy/hoth`:

- PLAY's tiles: MULTIPLAYER, CO-OP, SINGLE PLAYER (the running game's third tile; the site said Campaign). SINGLE PLAYER's: CAMPAIGN and ARCADE greyed, INSTANT ACTION live (`single-player.webp`).
- The setup screen (`instant-action-setup.webp`), beside the game's own (`.scratch-check/out/game/02-instant-action.png` and `D:\bf2-ghidra\abil63\live\setup-rows-*.png` on the desktop): the same two headings, the same thirteen rows in the same order with the same words and values (SUPREMACY, HOTH, ROOKIE, MEDIUM, DEFAULT, 20, 20, 2, 2, 4, 4, 1, 1), the help line under the list, the level's panel, the planet, and PLAY, RESET TO DEFAULTS, CHANGE FACTION, BACK. Below the game's thirteen, the list goes on with the switches and the two rows that are the site's own (ERA, BOT LOGIC).
- The keys: down, down, right moved to AI DIFFICULTY and set NORMAL, the help line the game's ("Change the difficulty of combat to your preferred setting.").
- A round begun from it, with ENEMY AI COUNT 6, FRIENDLY AI COUNT 5 and the side changed: PLAY, the loading screen, then the spawn screen over the same world (the host element is the same one, nothing mounted again): Supremacy, five command posts, team 1 (Rebel Alliance) with 5 soldiers beside and 6 against, the Rebel classes on offer. Enter: the field, alive. No page errors.
