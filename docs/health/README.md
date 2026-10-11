# Codebase health

The code is measured, the numbers may not rise, and a scheduled session makes one of them a little better at a time. Design: `docs/superpowers/specs/2026-10-06-codebase-health-design.md`. The rules of the architecture: `RULES.md`.

## The measure

```bash
node scripts/health.mjs                  # the table, and src/data/health/latest.json (`--check` leaves the file)
node scripts/health.mjs --check          # exit 1 when a number is over its budget (CI, on every pull request)
node scripts/health.mjs --ratchet        # lower the budgets to today's numbers; a line in history.jsonl
node scripts/health.mjs --only big-files --json
```

One module per number in `scripts/health/<id>.mjs`; `scripts/health.mjs` lists them in `METRICS`. Each returns `{ id, label, value, unit, better: 'lower', detail: [{ file, n }] }`, detail worst first. The test, `scripts/health.test.mjs`, runs each against the fixture tree in `scripts/health/fixtures/`.

## The ratchet

`budgets.json` here is a ceiling per number. CI fails a pull request that goes over. The steward lowers a budget after every merge that improves its number (`--ratchet`); nothing raises one but a person, in a commit whose message says why. A number without a budget is reported and never fails: a new metric lands measured first and is budgeted a merge later.

## The steward

`.claude/skills/health/SKILL.md` (to come: the plan's task 6) is the protocol a Routine runs every eight hours: one repair, verified with `scripts/autopilot-check.mjs`, one pull request, merged, logged on `/changes` as `kind: "health"`, then the ratchet. It shares the autopilot's pause switch (`docs/autopilot/budget.json`). `backlog.md` here is what it does next when nothing is over budget.

## Files

| Where | What |
| --- | --- |
| `scripts/health.mjs`, `scripts/health/*.mjs` | the runner and the metrics |
| `scripts/health.test.mjs`, `scripts/health/fixtures/` | their tests |
| `docs/health/budgets.json` | the ceilings |
| `docs/health/RULES.md` | what may import what, how big a file may grow, what must have tests |
| `docs/health/backlog.md` | the steward's queue |
| `src/data/health/latest.json`, `history.jsonl` | the latest numbers and every ratchet, for `/changes` |
| `.github/workflows/ci.yml` | `health.mjs --check` after the build |
