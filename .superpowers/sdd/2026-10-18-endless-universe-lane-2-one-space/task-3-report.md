# Task 3 report: keep-outs

Built: `expanse/gen/keepOuts.js` (HOME_KEEP, KEEP_OUTS, keepOutsNear, clearOfKeepOuts; plain loop, no allocation, squared distances), its test, and the lending face `universe/shared/space.js` (PLACES, SECTORS, SECTOR_RADIUS, sectorOf) with its row in shared.test.js FACE.
RED: `npx vitest run src/components/expanse/gen/keepOuts.test.js` failed (cannot resolve ./keepOuts). GREEN: `npx vitest run src/components/expanse/gen src/components/universe/shared` -> 8 files, 46 tests pass.
Lint clean on touched files. Health: boundary-breaks 487 (unchanged), "within budget".
Finding: ids are not unique across sources. PLACES holds a planet `home` and a planet `rickmorty` (in the main sector, at their own coordinates) besides my home sphere and pocket sphere; the first draft of two tests failed on this. Tests now match rows by id plus position, and the count test pins length = wanted + 2. Duplicate-id rows are harmless to clearOfKeepOuts.
Order: home, PLACES rows, rickmorty last.
Concern: none beyond the duplicate ids above (a later task keying by id should key by index or id+at).
