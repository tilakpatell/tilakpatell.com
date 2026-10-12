# The Battlefront menus' walk, 2026-10-12

The runs behind `../bf2017-menus-2026-10-12.md`: `scripts/bf2017-menus-profile.mjs` in headless Edge on the owner's RTX 5090, 2560 × 720 at a device pixel ratio of 2, ultra, the dev server on 127.0.0.1:5533.

| file | what |
| --- | --- |
| `before-first.json` | the worktree's base (547144b, before #945's pipeline guard): the spawn screen took 17.8 s to paint and the walk could not deploy (the dead handle), the font warnings in `console` |
| `before.json` | origin/main (#945) with nothing of this change but the tool: the click deploys through the dev door after 20 s, the reticle stands 8.6 s after; `spawnSettle` and `deploySettle` are the guard's held and pending counts |
| `after.json` | this branch: the click deploys, the reticle in 749 ms (222 to 749 over four runs), the drain as before |
| `before-spawn.webp` | the spawn screen in Arial, the fonts refused |
| `after-main-menu.webp`, `after-loading.webp`, `after-spawn.webp`, `after-deploy.webp` | the screens after, in the game's faces |

A JSON's `steps[]` carry, a click each: `toPaint` (ms to the next screen two frames after it stands), `longTasks`, `frames` (the rAF deltas), `inputs` (Event Timing: each input's wait for the main thread), `rest` (two seconds on the screen), `profile` (the CPU profile's self time by function and file). `loadingBehind` is what the world drew behind the loading screen (`renderer.info` through the draw hook); `deployed.after` the sim's state and the screens every 50 ms round the click; `pace` the controller's changes; `console` a tally.
