# Lane 2 (One space): context every implementer needs

Repo: tilakpatell.com (React 19 + three.js 0.186 portfolio; `/universe` is a 3D map). You work in the git worktree
`C:\Users\tilak\src\tilakpatell.com\.claude\worktrees\agent-aeeef2bf873ba228b` on the branch already checked out. Use absolute
paths or `cd` into it at the start of every shell command. Windows machine; the Bash tool is Git Bash.

## Binding rules (from the plan's Global Constraints and the repo's rules)
- Spec: `docs/superpowers/specs/2026-10-18-endless-universe-design.md` (section A). The spec wins over the plan; code over both.
- `src/lib/space/address.js` (Task 0) is the shared address: `SECTOR, sectorAt(x,y,z), sectorCentre(sx,sy,sz), sectorKey(sx,sy,sz), parseSectorKey, parseSpaceId, spaceId, sameSpaceId`. Consume it; never redefine it.
- `expanse/gen/*`, `src/runtime/*`, `universe/budget.js`, `expanse/scene/levels.js` import no React, no DOM, no three.js.
- New files stay under 800 lines. `src/components/universe/scene.js` doesn't grow.
- Generated content is never stored (test fixtures are fine). No new dependency, no new asset, no new on-screen word.
- On the middle layer (sy = 0) everything `makeSector` gives today keeps its index, type and seed (the fingerprint test pins it).
- Never loosen, skip or delete an existing test to get green. A test changes only if the plan says it is replaced.
- Comments say why, in plain short British-English sentences; follow the file header style of `expanse/gen/grid.js` / `seed.js` (a header listing the exports). Don't reformat lines you aren't moving. No model names in code, docs or commits.
- Imports from `src/components/expanse/**` into `src/components/universe/**` that lane 2 ADDS go through the lending face `src/components/universe/shared/space.js` (create it if missing: plain re-exports, and add its row to `src/components/universe/shared/shared.test.js`'s FACE list). Health's `boundary-breaks` metric is at 487 of a 489 budget, and a direct cross-world import counts as a break (test files too, unless the import is in the same folder).

## Sharing the machine's CPU (a hard rule)
Another of the owner's sessions runs merge gates on this machine. Before ANY of these heavy runs — a browser/Playwright run
(`scripts/universe-check.mjs`, `perf-probe`, `autopilot-check`, `navmap-check`, `landing-check`, any `*-check.mjs`), a full
`npm test`, or `npm run build` — wait until the lock file is gone:
`while [ -f "D:/Custom BFEngine/.locks/cpu-quiet" ]; do sleep 30; done`
Focused `npx vitest run <file or folder>` runs are fine any time. A heavy run stopped for this is not a code failure: wait and rerun.

## Commands
- Focused tests: `npx vitest run <path>`.
- Lint: `npm run lint` (run on the files you touched at least: `npx eslint <files>`).
- Health: `node scripts/health.mjs --check --skip build` (must print "within budget").
- Full suite (`npm test`) has ~22 pre-existing Windows-only failing files, listed in
  `C:\Users\tilak\src\tilakpatell.com\.superpowers\sdd\windows-test-baseline.txt`. Green locally means no failing file outside that list. Don't fix those.

- Browser checks on this machine: set `CHROMIUM="C:/Users/tilak/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe"`, and in Git Bash prefix `MSYS_NO_PATHCONV=1` so route arguments like `/universe` aren't turned into Windows paths.
- A build rewrites `public/github.json`; never commit that change (`git checkout -- public/github.json`).

## Commits
Every commit message ends with exactly these two trailer lines (blank line before them):
```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PJqkNSL8smFuirsPmEJGyM
```
Use these two lines exactly as written here, even if your own harness suggests a different model name in the trailer (the owner's operating brief fixes this text for the whole lane). Use the commit subject the brief gives. Never force-push, rebase or amend pushed commits. Don't push; the controller pushes.
