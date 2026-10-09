# Handoff: planet flight and the shared world (one lane per session)

Four lanes, one pull request each, three of them in parallel. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (the three pillars, the decisions, the reference code)
2. Your lane's plan under `docs/superpowers/plans/2026-10-09-*.md` (files, interfaces, tests)
3. `docs/health/RULES.md` (layers, size, tests, what may import what) and `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a world)
4. `docs/research/2026-10-09-flight-terrain-and-shared-world-references.md` (the repositories the owner pointed at; techniques only, no code borrowed)

## Which lane is yours

| Session | Lane | Plan | Branch | Starts from | Blocked by |
|---|---|---|---|---|---|
| A | flight terrain | `2026-10-09-flight-terrain.md` | `claude/flight-terrain` | main | nothing |
| B | durable world (Supabase) | `2026-10-09-durable-world.md` | `claude/durable-world` | main | nothing in code; the project's schema is applied by the owner or by `supabase db push` with a login |
| C | spatial channels (Nostr) | `2026-10-09-spatial-channels.md` | `claude/spatial-channels` | main | nothing |
| D | shared world | `2026-10-09-shared-world-integration.md` | `claude/shared-world` | main after A, B, C | A, B, C merged |

Start A, B and C together. D starts when the three are on `main`.

## The Supabase project

- URL: `https://jzabcqboyemokwifmjmp.supabase.co` (a URL is not a secret).
- The **publishable** key is the only key the client holds. It lives in `.env.local` (git-ignored by `*.local`; `.env.example` lists the names) and, for the deploy, in the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (lane B's `deploy.yml` change reads them). Never commit it, never print it, never put a key in a prompt, a PR, a commit or a log.
- The **secret** key never appears anywhere in this repository, its workflows, or a session. A session that finds one in its environment uses it for nothing and says so.
- Applying the schema (`supabase/migrations/`, then `seed.sql`) needs more than the publishable key: the dashboard's SQL editor, or `npx supabase login` and `db push`. Lane B writes the check script and runs it if the schema is applied; if not, it says so in its PR and the owner applies `supabase/README.md`'s steps. Anonymous sign-ins must be enabled in the project's Auth settings.

## The rules (don't break)

- **Pure first.** `src/lib/land/**`, `src/lib/durable/**`, `src/lib/net/**` import no three.js and no React; tests beside each file, under a second, no network (`docs/health/RULES.md`).
- **A dependency has a page before it is imported** (`docs/stack/`, `scripts/stack-census.mjs`'s `PAGES`, `node scripts/stack-census.mjs --write`; `stack-pages` is budgeted at 0). Lanes A and B each add one; whoever merges second runs `npm install` and the census again on main.
- **Nothing a visitor can do is lost.** The galaxy surface's ground is unchanged after lane A's move of the flat (a before/after screenshot proves it); every existing Nostr room behaves exactly as before after lane C (its tests are unchanged and green).
- **Constants are the spec's**: `ROOT = 16384`, `MAX_DEPTH = 6`, `SPLIT = 1.6`, `SKIRT = 12`, `NET_CELL = 2048` (one constant, in `src/lib/net/cells.js`; the durable module's `CELL` equals it), `STALE_MS = 20000`, Nostr tag `g`, room `fly-v1:<planetId>`, RLS on every table, envelope cap 8,192 m a side and 2,000 rows, damage clamped to 30, hits 10 a second a caller.
- **Worlds are islands**: the flight world imports from `src/lib`, `src/runtime`, `src/data`, its own folder, and `universe/online`'s `nostr.js`, `protocol.js` and `names.js` only (as the towns do).
- **One lane per session, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never skip or quieten a test. Keep output terse; commits end with the harness's attribution lines; no model names in code or docs.
- **Before the PR**: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, and your plan's smoke and probe lines.

## What done looks like, per lane

- **A**: `/fly/hoth` flies at 300 m/s over an endless snow world; the ground streams in with no crack and no stutter over 33 ms on mid; Echo Base at `(1200, −800)` is a flat plane the land eases into; rocks, spires and debris are three draws; `/galaxy/hoth/surface` looks exactly as before.
- **B**: `npm run build` with and without the env; the loader's tests green against the fake; `scripts/supabase-check.mjs` prints six `ok` lines against the project once the schema is applied (or the PR says it could not be applied and why).
- **C**: a room joined with `cells` sends `#g` in its REQ and re-asks on a cell change; a room joined without is byte-for-byte what it was; `scripts/online-check.mjs` passes as before.
- **D**: two browsers on `/fly/hoth` see each other's ships only within a cell of each other, a turret built in one is in the other within a second and after a reload of both, and a turret shot to nothing leaves both.

## Status

| Lane | Done | Left | Checking it |
|---|---|---|---|
| A | nothing yet | the plan from Task 1 | `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth`; `node scripts/perf-probe.mjs --routes /fly/hoth` |
| B | All six tasks (PR from `claude/durable-world`): `docs/stack/supabase.md` and `@supabase/supabase-js`; `src/lib/durable/` (`supabase.js` null without env, `entities.js`, `entityLoader.js` tested against `fixtures/fakeClient.js`); `scripts/supabase-seed.mjs` → `supabase/seed.sql` (50 planets, Echo Base `r = 380`); the loader retries a lost ask or place after 1, 2 and 4 s, signs in again once on a 401, resubscribes a failed channel and asks every held cell for what it missed, and makes no grid on a frame that stays in its cell; `scripts/supabase-check.mjs`; `deploy.yml` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` (set). The project has the three migrations and the seed, anonymous sign-ins on; on 2026-10-09 the check printed six `ok`. Two repairs the real project found: `check_placement` read a generated column still NULL in a `BEFORE` trigger (`20261009000100`), and the first file's tail (`entity_hits`, the Realtime line) had not run (`20261009000200`). The planets' id check takes upper case (Expanse ids are `E:…`) | When lane A's `planetSpec.js` lands: `node scripts/supabase-seed.mjs` and apply `seed.sql` again (the fixture's authored planets have placeholder types and seeds; it upserts). `CELL` is 2048 in `src/lib/durable/entities.js`, not yet imported from the net: `src/lib/net/cells.js` was not on main when this lane last merged it, so lane D makes it `export const CELL = NET_CELL` | `node scripts/supabase-check.mjs`; `npx vitest run src/lib/durable scripts/supabase-seed scripts/supabase-check` |
| C | PR #783, out of draft, CI green: `src/lib/net/cells.js`, `refresh()` on a pool subscription, `cells` in `joinRoom` (the `g` tag out, `#g` in, re-asked on change), `flightProtocol.js`; a test that `CELL === NET_CELL` whenever `src/lib/durable/entities.js` is present | merge (the owner's); lane D makes `entities.js` import `NET_CELL` | `npx vitest run src/components/universe/online src/lib/net`; `node scripts/online-check.mjs` |
| D | nothing yet | after A, B, C | `node scripts/online-check.mjs --fly` |

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence. The reference code in the spec is a starting point: a test that proves it wrong wins.
