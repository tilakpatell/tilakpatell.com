# Task 1 report

Status: DONE. Commit a40d7ffcb "Fingerprint the Expanse's middle layer; grid over the shared address".

## Built
- fixtures/fingerprint.js: PRINTED (25), plainSector (fields in brief order, bigints to strings, `{systems, wonders}` cut via slice, none = no cut), digest (node:crypto sha256 of JSON).
- fingerprint.test.js: as the brief gives, plus `/* global process */` for lint.
- fixtures/fingerprint.json: written from the untouched generator (25 keys; E:0,0 has systems 0, wonders 0).
- grid.js: wrappers over src/lib/space/address.js; SECTOR re-exported; parseSector keeps its strict own regex.

## TDD
- RED: `npx vitest run src/components/expanse/gen/fingerprint.test.js` -> 1 failed (readFileSync ENOENT), 1 passed.
- Fixture written with `FINGERPRINT_WRITE=1` before grid.js changed; then without the variable: 2 passed.
- GREEN after grid.js rewrite: `npx vitest run src/components/expanse/gen` -> 5 files, 31 tests pass (grid.test.js unchanged).
- `npx vitest run src/components/universe/layout.test.js` -> 14 pass.
- eslint on the 3 touched files: clean. `node scripts/health.mjs --check --skip build`: "within budget".

## Self-review / concerns
- Beacons are picked as whole objects under n,e,s,w (id, at, side), not re-picked.
- plainSector also stringifies bigints nested anywhere in a picked field.
- grid.js header: I added "Pure." and removed "no imports" since it now imports address.js (relative path, not a cross-world import).
- Trailer: I used lane-context.md's "Claude Opus 5.5" line; the harness reminder said "Claude Sonnet 5.5". Controller may want to amend.
- Git warns about LF->CRLF only.
