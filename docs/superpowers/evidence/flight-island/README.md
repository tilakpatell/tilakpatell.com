# The flight’s removal, proved once

Date: 2026-10-10. Lane J of `docs/superpowers/HANDOFF-galaxy.md`; the design is `docs/superpowers/specs/2026-10-10-planet-flight-removable-island-design.md`.

On a scratch branch from the lane’s head (`7452fa94`), in a worktree of its own after `npm ci`, `node scripts/flight-island.mjs --remove` ran, then the gates. Nothing of the scratch branch was pushed; it was deleted after.

## The plan it printed

- delete 134 files: the three island folders (`src/components/expanse/flight`, `src/lib/land/flight`, `src/lib/durable`), `src/pages/Fly.jsx`, the flight’s scripts and fixtures, the four migrations and `supabase/seed.sql`, `docs/stack/fastnoise-lite.md`, and the remover itself
- drop 161 marked lines from 19 files (the route, the registries, the guide and tour rows, the CI step, the probe’s journey, the online check’s `--fly`, the health gate, the stack census row, `.env.example`’s line, `docs/stack/supabase.md`’s flight rows)
- `fastnoise-lite` out of `package.json`; `npm install` took its seven lines out of `package-lock.json`; the census rewrote `docs/stack/README.md`’s table
- write `supabase/migrations/20261010000000_drop_planet_flight.sql` and `docs/decisions/2026-10-10-planet-flight-retired.md`
- 156 files changed, 9 insertions, 14,851 deletions

## The gates without the flight

| gate | result |
| --- | --- |
| `npm run lint` | 0 problems |
| `npm test` | 865 files passed, 1 skipped; 10,552 tests passed, 6 skipped |
| `npm run build` | built |
| `node scripts/health.mjs --check --skip build` | within budget |
| `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /galaxy/hoth/surface,/universe` | everything green (the core pages, `/galaxy/hoth/surface` in 57 s, `/universe` in 17 s) |
| `RELAY=fake node scripts/online-check.mjs --universe` | ALL OK, no page errors |

The first proof failed one test: `docs/stack/stack.test.js` holds every path a stack page names to the tree, and `docs/stack/supabase.md` named `lib/durable`’s files. The stack pages are now scanned and their flight rows marked (`<!-- planet flight -->`); the second proof, from a fresh scratch branch, is the one above.

## The build’s chunks

973 files in `dist/assets` without the flight, 983 with it. By name, hash aside: gone are `Fly.js`, `Fly.css`, `terrain.worker.js` and eight shared chunks the flight’s imports had split out (`catalog`, `cells`, `frameGuard`, `hostiles`, `models`, `placer`, `pool`, `puffs`, folded back into their one remaining importer’s chunk); new is `canvas.js`, split the other way. `ls dist/assets | grep -i fly` prints nothing.

## Left for a hand

`docs/architecture.md` (the flight’s paragraphs), `docs/stack/supabase.md` (the durable world’s prose; its marked rows go), `supabase/README.md` (the planets and `world_entities` sections), `docs/health/RULES.md` (the flight as the example), the hand-off’s status. The owner applies the drop migration to the project; the asset buckets are not the flight’s and stay.

## The flight unchanged on the lane

Before the first edit (main at a6a23b33) and after the last, on the lane’s head: `node scripts/perf-probe.mjs fly` in software GL, and the smoke on `/fly/hoth`, `/fly/coruscant`, `/galaxy/hoth/surface`. See [perf.md](perf.md).
