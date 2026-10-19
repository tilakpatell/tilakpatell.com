# Task 1 report

Status: DONE

## Implemented
- `scripts/navmap-check.mjs`: `BASE` env (default `http://localhost:5173`), `run(m)` dispatch, `minimap` mode (own context, `tp-3d` = off, flat map shot, then home teaser reached by scrolling a screen at a time until `.minimap-teaser` mounts, since LazyMount only mounts near the viewport), `far` mode (ship teleported to x 250000, waits on `__universe().ship.x > 200000`, opens map, waits on `.navmap-place`, shoots).
- `open()` now also waits for `.universe-navmap-btn` to attach (the first full run hit "nothing at .universe-navmap-btn": the UI mounts later than `__universe` under software GL).
- Server: this worktree's vite on port 5266 (main's code, no source change), killed afterwards.

## Full run on main (ddb364bf3)
FAIL: go button reads “Jump to The Citadel”; ship out at The Citadel on first frame past flash (null timing); with the drive charging, it says so and goes at super speed; still on its way out to Aurelia (got `rmportal-back`). All other checks ok; no page errors; 4 FAILED. Expected stale Citadel coordinates.
Mode runs: `minimap` ok, `far` ok (marker missing from the chart, as predicted; the panel reads “Your ship · 820,500 ship-lengths from The Twins”).

## Shots (all PNG, all under 1 MB)
1-navmap 549865; 2-picked 529206; 7-home-system 655014; 8-phone-map 210110; 9-phone-navmap 204703; 10-phone-picked 205350; 11-minimap-flat 87172; 12-minimap-teaser 111062; 13-far-ship ~555000.
Shots 3–6 (Citadel jump) were produced but deleted to match the brief's list.

## Files
scripts/navmap-check.mjs; docs/superpowers/evidence/endless-universe-6a-map/README.md and before/*.png.

## Self-review
Spelling and voice follow the repo. No sleeps added in new code. Teaser shot scrolls the page by polling per frame.

## Concerns
None blocking. The first full run failed once at `.universe-navmap-btn` (flaky mount); fixed with a wait.

## Fix round 1
Evidence README: the 13-far-ship caption now says the ship marker is missing from the chart while the panel reads “Your ship · 820,500 ship-lengths from The Twins” (checked against the picture). Straight apostrophes in prose (main’s, twice) made curly. The report's earlier “No ship” wording was wrong and is corrected above. Doc-only: no checks re-run.
