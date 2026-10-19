# The Red Book: the plan

The spec is `docs/superpowers/specs/2026-10-19-the-red-book-design.md`. This session carries out each task itself, without subagents, and writes every pure rule test-first. Commit after each task, and push at least every 40 minutes after the four checks pass.

All new code goes in `src/components/middleearth/redbook/`, abbreviated `rb/` below.

1. **Rules, test-first.** `rb/pages.js` (+test), `rb/book.js` (+test), `rb/popup.js` (+test), `rb/ring.js` (+test), `rb/stone.js` (+test), `rb/keep.js` (+test), `rb/routes.js` (+test).
2. **Paint.** `rb/paint/` holds the canvases: parchment, ink, watercolour washes, a cut-out’s edge, the page’s text and its moon-letters, wood and leather. Each is a function of its size, so a tier halves it.
3. **The study.** `rb/study.js`: the desk, window and rain, fire, candles, shelf, wall map, pipe, Sting. Lights with tier rules. The wraith patch (`rb/wraith.js`, the Road’s pattern).
4. **The book.** `rb/bookMesh.js`: the cover, the block, the spread, the turning leaf’s curl, the page textures. `rb/popups/`: one file for each group of pages, each exporting `build(kit) → { group, toys, ghost, find, rise(open), tick(dt), tap(id) }`.
5. **The Palantír and the Ring.** `rb/palantir.js` (the stone, the map disc, the pins, the Eye) and `rb/ringMesh.js`.
6. **The module.** `rb/module.js` (`nodes`, `mb` 1): the camera rig, picking, events to the page (`page`, `toast`, `met`, `found`, `stone`, `ring`), the API (`turn`, `goTo`, `tap(nx, ny)`, `hover`, `wearRing`, `holdStone`, `look`), `look.js`, plus `module.test.js`.
7. **The page.** `src/pages/RedBook.jsx` plus `src/styles/lazy/redbook.css`: the HUD from the kit, the caption, the buttons, the back pages, the phone layout. Routes in `App.jsx` (`/middle-earth` and `/middle-earth/map`), MiddleEarth.jsx’s map links, the achievements (`palantir`, `wraithworld`, `redbook`), `looks.js` and the pack.
8. **Look at it.** `lab/redbook/shots.mjs`, desktop and phone. Read every picture, fix what doesn’t read, and measure the draws and triangles.
9. **Ship.** Run the checks, push, open the pull request with the numbers, watch CI, and merge.
