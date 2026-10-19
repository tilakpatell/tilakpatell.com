### Task 10: `navmap-check` fixed and extended; the phone layout; the after shots

**Files:**
- Modify: `scripts/navmap-check.mjs:86-100` (the jump's goal), plus new steps in the desktop, phone, minimap and far modes
- Create: `scripts/lib/navmap.mjs`
- Modify: `docs/superpowers/evidence/endless-universe-6a-map/README.md`, and add `after/*.png`

**Interfaces:**
- Produces: `shipOnChart(page) → { drawn, inside, edge, readout }` in `scripts/lib/navmap.mjs`.
  - It presses `m` if `.navmap` isn't open and waits for `.navmap-ship`.
  - `inside` means the marker's centre is within the `.navmap-chart` circle (+2 px).
  - It closes with Escape if it opened the map.
  - Lane 2's `universe-endless-check.mjs` calls it at every step.

- [ ] **Step 1: Pick the jump's wonder by name** (HANDOFF "Left").
  - Read `window.__universeDebug.wonders` (`scene.js:5802`: `{ id, name, at, reach }`).
  - Take the first of `['Ember', 'Halcyon']`, both main-sector, whose `at` is further than `reach + 600` from the start.
  - `gx` and `gz` come from its `at`, and the arrival test (`:109`, `:121`, `:129`) is `< reach + 600` in place of `< 800`.
  - No coordinates are left in the file. Check with `grep -nE '[0-9]{4}, ?-?[0-9]{4}' scripts/navmap-check.mjs`: expected, no match.
- [ ] **Step 2: Add the desktop chart steps** after the first shot. Each is a `check(…)` waiting on a condition, never a sleep:
  - **On open.** `.navmap-ship` is within 3 px of `.navmap-chart`'s centre.
    - The expected values come from `__universe().ship`, because a start can be by the Citadel (`:88`).
    - `data-level` is `system` in the Curve and `neighbourhood` elsewhere.
    - `.navmap-readout` starts with `Sector ${sx}, ${sy}, ${sz} · `, by `Math.round(v / 120000) + 0` per axis, with a minus written `−`.
  - **No overlaps.** No two visible `.navmap-name` boxes (width over 0) meet.
  - **Wheel zoom.** `page.mouse.wheel(0, -400)` over the centre, until `data-level` is `system` (at most 12 turns). Then `-` until it is `neighbourhood` again.
  - **Typing doesn't zoom.** Type `-` into `.navmap-search input`: `data-level` is unchanged. Clear the field.
  - **A drag pans with the hand.** A drag of 120 px right in 8 steps, starting on a `.navmap-place` button:
    - The ship marker ends within 6 px of 120 px right of the centre: the middle moves with the hand, `panFrom`.
    - The button's `aria-pressed` is unchanged, and no trip starts (`__universe().auto` unchanged).
    - "Back to the ship" loses `aria-disabled`. Click it: the ship is back within 3 px.
  - **Shift-drag tilts.** A Shift-drag of 120 px up: `data-pitched` appears and "Look straight down" loses `aria-disabled`. Click it: `data-pitched` is gone. Shoot `15-tilted` before the click.
- [ ] **Step 3: Extend the `far` mode.**
  - After the shot, `shipOnChart` gives `drawn` and `inside`. The readout's sector, computed from the ship as above, has `sx ≥ 2`.
  - Drag 400 px left, up to three times, until `.navmap-ship[data-edge]` appears. It must sit inside the circle. Shoot `16-far-ship-pinned`.
- [ ] **Step 4: Extend the phone mode** (390 × 844, `hasTouch`). Force the `(pointer: coarse)` rules on, as `scripts/galaxy-map-check/lib.mjs:241-258`'s `asTouch` does: Chromium won't emulate the pointer. Then check:
  - Each `.navmap-tools button` is at least 44 × 44, inside the frame, clear of the others and of `.navmap-readout`.
  - The readout is visible.
  - `.navmap-side` scrolls: when `scrollHeight > clientHeight`, setting `scrollTop = 200` reads back more than 0.
  - A wonder's `.navmap-name` is hidden until it is picked from the list.
  - Tapping zoom in changes `data-level`. Shoot `14-phone-zoomed`.
  - Turned sideways (844 × 390): the frame, the chart, the bar and the side panel's top are all inside the viewport. Shoot `17-phone-sideways`.
- [ ] **Step 5: Extend the `minimap` mode.**
  - The flat map has a `[data-id]` for `aurelia`, `veil` and one moon (`squanch`), and no `.minimap-orbit`.
  - `+` with the focus inside it changes its `data-level`.
  - The teaser has no `[data-id]` that isn't a world.
- [ ] **Step 6: Run the whole check on the lane's dev server.** Run `OUT=docs/superpowers/evidence/endless-universe-6a-map/after CHROME=… node scripts/navmap-check.mjs`. Expected: `all ok` and `no page errors`.
- [ ] **Step 7: Run the checks that read the nav map** on the lane's server, each per its header. Expected: each passes as on `main`.
  - `scripts/sector-check.mjs` ("The Curve" pressed)
  - `scripts/universe-war-check.mjs` (seven war sectors, the front button)
  - `scripts/wonders-check.mjs`
  - `scripts/links-check.mjs`
  - Any that fails on `main` too is noted, not fixed here.
- [ ] **Step 8: Fill in the evidence README.** Before and after side by side, the checks' outputs, the Interests chunk's two sizes from Task 9, and the statement that the scene is unchanged, so draw calls and triangles are as before. The phone layout's rows answer HANDOFF "Left": the chart over the panel, the panel's scroll, wonder names hidden unless picked, and the map button clear of the Multiplayer pill (`:173-179`, kept).
- [ ] **Step 9: Commit.**
```bash
git add scripts/navmap-check.mjs scripts/lib/navmap.mjs docs/superpowers/evidence/endless-universe-6a-map
git commit -m "Nav map check: a wonder picked by name, the chart's zoom, pan, tilt, far ship and phone layout; after shots"
```

---

