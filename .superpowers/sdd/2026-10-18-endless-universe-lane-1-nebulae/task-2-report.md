# Task 2 report

Implemented `budget.js` (NEBULA_BUDGET, nebulaBudget) and `rules.js` (all named constants and functions, exported) in `src/components/universe/nebula/`, with `budget.test.js` and `rules.test.js` (brief's tests verbatim, imports added). Commit a93fd5fe1 "Nebulae: the pure rules and the tier rows".

RED: `npx vitest run src/components/universe/nebula` -> 2 files failed, "no tests", import of `./budget` / `./rules` unresolved (expected).
GREEN: same command -> Test Files 2 passed, Tests 17 passed.
Lint: `npx eslint src/components/universe/nebula` -> clean.

Self-review notes:
- youngStars uses its own splitmix32 stream seeded from seedOf(desc.seed)[0]; draws follow deepspace.js (gauss spread x r, y*0.45, b = 0.5+u^6*5, size 0.8+u^3*2.5, pal = floor(u*3)). Nothing imported from deepspace.js.
- fogLayers sets first and last exactly; fog <= 1 returns just [far].
- checkDesc pads colours cyclically ([a,b] -> a,b,a); at is copied.
- Unknown forms in envelope/youngStars fall back to cloud.
- git warns about LF->CRLF on the new files (autocrlf); harmless.

## Fix round 1
Changed: fogLayers returns [] when min(0.5r, FOG_FAR) <= FOG_NEAR; Object.hasOwn in nebulaBudget and youngStars' spread lookup. Tests added: fogLayers(high, 5) and (high, 16) are []; nebulaBudget('constructor') is the mid row.
Command: npx vitest run src/components/universe/nebula/rules.test.js src/components/universe/nebula/budget.test.js -> 2 files, 18 tests passed. eslint src/components/universe/nebula -> clean.
