# Task 4 report: declutter

Implemented `src/components/universe/chart/declutter.js` (SIDES, boxOf, declutter; no imports) and the brief's test file verbatim.

TDD: RED with `npx vitest run src/components/universe/chart/declutter.test.js` failed (module './declutter' not found, no tests run). GREEN after implementing: 1 file, 4 tests passed.

Lint: `npx eslint` on both files, exit 0. (`npm run lint` over the whole repo exceeded the 2 min tool timeout here; not completed.)

Decisions: touching boxes do not meet (strict <, as the test). A dot blocks via its 16x16 box unless its Euclidean distance from the label's own point is <= 8 px. Sort compares priority (no subtraction, so Infinity is safe), ties by id. Every label gets a map entry.

Files: declutter.js, declutter.test.js.

Concerns: whole-repo `npm run lint` not run to completion; full npm test/build not run.
