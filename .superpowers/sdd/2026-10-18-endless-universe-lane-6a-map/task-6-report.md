# Task 6 report
Implemented chart/marks.js: HAND_MARKS (frozen, built once), markById (null if unknown), REGIONS, liveMarks, presetView, presetOf, openView, per the brief. Range clamped via `within` (R2; Infinity clamps to max).
TDD: RED = `npx vitest run src/components/universe/chart/marks.test.js` failed (module not found, no tests). GREEN = `npx vitest run src/components/universe/chart src/components/universe/nav.test.js`: 5 files, 60 tests passed. eslint on both files: clean.
Files: src/components/universe/chart/marks.js, marks.test.js (brief's 4 tests verbatim plus 3 of mine: preset range bounds, frozen/null, odd where() input).
Concerns: chart:sun priority not specified in brief; I used 80. Colours in one TINT constant. Portal priority 30 applies to any mark with type Portal.

## Fix round 1
Changed: new marks.edge.test.js mocks '../nav' (scoped to that file) so CHART_VIEWS.all.r is Infinity, and asserts presetView('all'), openView(null) and openView(undefined) give CHART.range.max, home preset stays below max, Curve opening is the Curve's edge, an ordinary opening is CHART.range.open. marks.js: ALL and NEAR level arrays frozen; fight name is `f.label ?? ''`.
RED: with `within` replaced by identity, marks.edge.test.js fails at `presetView('all', null).range` (1 failed, 1 passed). Restored, both pass.
within is NOT redundant: createView's num() turns Infinity into the opening range (120,000), not the max, so without within an unbounded edge would silently open at the wrong zoom. Kept.
Command: npx vitest run src/components/universe/chart src/components/universe/nav.test.js -> 8 files, 68 tests passed. eslint on the three files clean.

## Fix round 2
Changed: marks.edge.test.js only. Scoped mock now gives all.r and rickmorty.r as Infinity and home.r as 1. New assertions: openView for a Curve point and presetView('rickmorty') give CHART.range.max; presetView('home') gives CHART.range.min; a far fight with no label has name ''.
RED: with `within` as identity, 2 of 4 fail (the universe/no-ship test and the Curve/home test). Restored: marks.edge + marks tests 11 passed; eslint clean. Earlier chart+nav run: 69/70 with one nav.test.js timeout under machine load (35s); nav.test.js alone re-run: 30/30 passed.
Finding: I first used 1e9 for the Curve and the identity run still passed that test, because createView already clamps any finite range. `within` only matters for a non-finite range (createView turns it into the opening range, not the max), so the pins use Infinity. Finite out-of-range (1 for home) is covered by createView and still asserted.
