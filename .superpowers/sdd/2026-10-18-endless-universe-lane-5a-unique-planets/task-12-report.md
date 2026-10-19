# Task 12 report

Commit 3b8a18b7b "Keep generated planets read-only: nothing built, nothing written".

Implemented in shared.js: `readOnly = spec.buildable === false`. When true, `db` is null (no loader, no sign-in, no reads or writes; `owner` is 'me' as with no database), `build()` toasts "Nothing can be built on this world." before anything else (so no local turret either), and `prompt()` returns build false. unbuild/kept were already false with `db` null and nothing held. Room (poses, shots) untouched. No `buildable` key behaves as before.

Glossary: none exists for flight toasts (grepped; existing toasts are inline strings in shared.js), so the copy is inline.

TDD: RED with `npx vitest run src/components/expanse/flight/shared.test.js -t "nothing may be built"`: 2 failed, 1 passed (turret placed; loader.update called). GREEN: shared.test.js 18/18; src/components/expanse/flight 26 files, 248 tests passed.

Files: src/components/expanse/flight/shared.js, shared.test.js.

Concerns: none. Lint and full gates not run (per task scope).
