# Task 7 report
Status: DONE.
Built: layout.js now imports from src/lib/space/address.js (parseSectorKey, sectorAt, sectorCentre, sectorKey). sectorOf: rickmorty = 3D ball (hypot over x,y,z from pocket origin <= edge+1, z < SECTOR_SPLIT); main = sector [0,0,0] and level hypot(x,z) <= main edge+1; else sectorKey(...sectorAt). sectorById parses 2/3-number keys via parseSectorKey, same result shape. sectorOut unchanged (sectorOf(x,0,z)).
RED: new test failed on HEAD layout.js (Expected "E:0,0,1", Received "main"; 1 failed, 14 passed). GREEN after change.
Tests: layout, sector, ship, regions, gunPortal, nav, portals, deep, sectorFleet, wars: 10 files, 170 tests pass.
Lint: clean on both files. Health: within budget; boundary-breaks 486 (was 487).
Files: src/components/universe/layout.js, layout.test.js.
Callers checked (grep sectorOf/sectorById): expanse.js passes y=0; gunPortal, scene.js, protocol.js pass ship/camera y (small); nav.js, portals.js, regions.js, ship.js pass body/portal/wonder `at` (|y| under ~1,400, pocket moons within 300 of y 0); none rely on y being ignored at these heights, middle-layer results unchanged. starfield.js has its own unrelated local sectorOf.
Self-review: grid.js untouched; existing assertions untouched. Concern: none. Unknown keys passed to sectorById via inExpanse but unparseable fall back to [0,0,0] origin (previously NaN).
