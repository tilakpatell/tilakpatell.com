# The way into Hoth is the game's: a waiting screen in the darkroom, then the wipe; no flown landing

**Date:** 2026-10-12 · **Status:** accepted · **Where:** `src/components/battlefront/waiting.js`, `WaitingScreen.jsx`, `waiting.css`, `module.js`, `BattlefrontWorld.jsx`, `src/lib/three/pipelineGuard.js` (`guardOf`), `src/runtime/runtime.js` (`rt.gpuClock`)

## Context

The Battlefront world came up while its level still streamed and its shaders still built, and the first seconds on the field were the worst: the 2026-10-12 shader-guard note measured frames of 100 to 800 ms as the cells round the player came in, after a loading screen that said only "per cent". The owner asked for a waiting screen instead of a slow landing: pick what to do, wait until it has fully loaded, see the machine's recommended settings, and arrive smooth. The owner's study of the game (`bf2-re/findings/14`, `22`) says the game itself has no fly-in: a loading movie over a bar, the spawn screen in a darkroom at a clamped EV 8, a 0.75 s black wipe (0.05, 0.3, 0.4 s) and a 0.25 s exposure adaptation onto the field; the day is a server coin, the sunset 70 and the clear day 30. The galaxy's flown dive lands on the site's own surfaces and is not this world's way in (the Hoth card, tile and briefing link straight here), so it stays as it is.

## Decision

The Battlefront world takes the game's sequence. Until the first deploy the camera is parked in the soldier's pose at the side's spawn, so the level streams round where the player will land and the frame guard builds the shaders of what they will see; the waiting screen covers it (the darkroom) with the level and mode, the day by the game's coin or by name, the classes and the heroes, a bar fed by the stream's progress and the guard's pending, held and building counts, the machine's line and the pace's recommendation from the chip's own clock, and Deploy, which takes only once nothing has built for 0.6 s. Deploy runs the wipe with the world's deploy at its swap, and the renderer's exposure jumps by the darkroom's stops under the day's clamp and settles over 0.25 s through the chain's tonemap pass. The day asked for reaches the module at mount so its chain is built once; a pick on the screen rebuilds it behind the screen and the bar waits for it. The game's own spawn screen stays for every later life.

## Consequences

- On the owner's desk (an RTX 5090, 5,120 × 1,440 at ultra): Deploy to the first drawn field frame 430 ms, the worst frame of the next 3 s 54 ms (one over 50; the rest the world's steady 27 ms frame on that buffer), no shader built after the swap. Rebased onto main's HUD port and HDR sky the arrival is the same (504 ms, nothing built) on a heavier steady frame (the draw 40 to 48 ms, a median frame of 54 ms), where main with no screen reads 176 ms. The evidence: `docs/superpowers/evidence/bf2017-waiting-screen-2026-10-12.md`.
- The wait is the load's whole length (41 s there, the level's stream most of it), shown honestly; the player chooses while it runs.
- The screen's picks and Deploy go through `send.js`'s `sendTo` (the 2026-10-12 page-turn decision), as the game's spawn screen's do.
- Two counts are new on public faces: `guardOf(renderer)` on the guard, `rt.gpuClock` on the runtime.

## Revisit when

The level's stream gets shorter than the builds (then the bar's shares move), a second level lands with its own day coin, or the per-draw cost falls enough that the steady frame no longer brushes 50 ms on a 5K buffer.
