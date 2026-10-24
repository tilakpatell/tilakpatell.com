# Lane 6a hand-off notes

For the coordinator to fold into `docs/superpowers/HANDOFF-universe.md`. This lane does not edit that file.

## Task 5: placing marks on a frame

What `src/components/universe/chart/place.js` and `declutter.js` do now, where it differs from the lane plan. Tasks 8 and 9 draw from this, not from the plan's text.

### Landed

- `placeMarks` and the rest of Task 5's exports, in `place.js` (commits 45ef77ce, 24c9ada1 and the review fixes after them).
- A pick's name is firm. It tries to keep off every dot. When no side does, it takes the first side that keeps off the ship, even if it covers another place's dot. It never leaves the frame or covers a name already down. If the ship blocks every side, the pick goes unnamed and its name shows on its `spare` side on a hover or a focus.
- A mark drawn past the rim slides down its own stem to the rim, so its stem stays upright and its height honest. This holds for a pick and for an unpicked mark in range alike (looking down, a high mark's stem is drawn at `stemFloor` of its height, which can take it past the rim). Only a mark whose foot is at the rim or past it (past `PIN`, 0.97 of a round frame's radius) loses its stem: its foot is then its own point. In the mini-map's box, the clamp does the same.
- `reveal` gives back the same view when nothing changes. A mark straight over or under the focus moves nothing, so a followed chart keeps the ship.

### Deviations from the plan

- `declutter(labels, { bounds, sides, dots, hard })` takes a `firm` flag on a label and a `hard` list beside `dots`. `placeMarks` passes the places' dots as `dots` and its `avoid` points (the ship) as `hard`. The plan put both in `dots`, so the pick's name could land on the ship.
- `declutter.js` exports `firstInside(label, { bounds, sides })`: the first side inside the frame, or null.
- `Placed` has a `spare` field the plan does not list: the side a name left off shows on, over the rest, on a hover or a focus. It is null for a mark with a side, no name, or no side inside the frame.
- `projection.js` (Task 3) exports `PIN`, the fraction of a round frame's radius a pinned point sits at, for `place.js` to slide a mark down its stem to it.
- `ringOn` returns `[]` for a centre or radius with no number, and takes at least three sides (64 when `n` has no number).
- `edge` on a `Placed` mark means it is drawn at the rim instead of its true place. That is now true for an unpicked mark in range too, not only for a pick.

### Left

- A pick whose foot is off the frame while its dot is inside draws its stem past the rim (the nav map's circle and the mini-map's box clip it). Nothing in Task 5 changes that.
- `reveal` does not zoom out for a mark straight over or under the focus past the range. A pick is kept and pinned anyway, so it is still on the chart.
