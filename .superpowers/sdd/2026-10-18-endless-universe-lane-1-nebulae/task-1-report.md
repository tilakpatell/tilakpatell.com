# Task 1 report: before, on main (ddb364bf3)

Status: DONE_WITH_CONCERNS. Commit ba920b4cd "Nebulae lane: the before shots and numbers, from main". Numbers: see docs/superpowers/evidence/endless-lane1/README.md.

## What ran (all with MSYS_NO_PATHCONV=1 and CHROMIUM=<playwright chromium-1248 chrome.exe>)

- `npm run build` (needed first: autopilot-check's own `npx vite build` step fails on Windows, spawn without a shell). Then `--skip lint,test,build`.
- `node scripts/autopilot-check.mjs --skip lint,test,build --routes /universe --shots endless-lane1 --before`: exit 0, shot taken. (Without MSYS_NO_PATHCONV Git Bash turned `/universe` into a Program Files path.)
- `/galaxy` via the same command: exit 1, "no canvas", because the software-renderer gate card ("Try anyway") shows under SwiftShader and the script only clicks the "Walk the tribute" gate. Fix without editing scripts: a scratch script (lab/universe/galaxy-shot.cjs, gitignored) with the same context, viewport, 960x600 webp crop; it clicks "Try anyway", waits for the loading text to go, then 8 s. Result is a real Tatooine shot (before-galaxy.webp).
- `node scripts/universe-check.mjs --quality {high,mid,low} --out lab/universe/lane1-before/<tier>`: high exit 0 (14 ok). mid exit 1 because the overview pose timed out in page.goto (180 s); the other 13 ok. mid overview re-run alone (`--poses overview`) ok, kept as before-mid-overview-rerun.json; README uses it. low exit 0 (14 ok). (First high attempt was cut off by my 600 s tool timeout at 8 poses; re-run in background.)
- perf-probe: `QUALITY=mid|low OUT=... node scripts/perf-probe.mjs universe`, twice each, all exit 0. OUT is a directory in the script, so the brief's `.json` names came out as folders; I moved `perf-probe.json` to `before-perf-<tier>[-2].json` and the table to `.md` beside it.
- wc -l scene.js = 6226. health: glsl-sites 607, big-files 30 (as expected).

## Things to know

- The cpu-quiet lock message arrived mid-task. The high run had in fact already finished (exit 0) before I read it; my chained loop had started mid, which I stopped, deleted its partial output, and re-ran mid and low after the lock cleared. Later heavy runs waited on the lock.
- Pose counts are noisy: several cells are 0 calls / 0 tris (missed frames): high maw, landing-middleearth, far-rim; mid middleearth-limb, belt, landing-middleearth. Task 11 should re-measure those poses and not trust a 0. Also a partial earlier high run differed (overview 107 vs 99 calls; falcon-sun 801601 vs 561609 tris).
- perf-probe on this machine uses the real GPU (D3D11), so frame times are fast (p50 about 1 ms) and not comparable with the SwiftShader universe-check frame times. mid run 2 showed 19 late pipelines vs 0 in the other runs.
- Spread between runs: p50 up to 0.5 ms (mid fly); p95 up to 30.5 ms (mid load, a 31 ms hitch in one run only).
- public/github.json was modified by the build; reverted. public/changes/ files deleted after copying.

## Files committed

docs/superpowers/evidence/endless-lane1/: README.md, before-{high,mid,low}.json, before-mid-overview-rerun.json, before-universe.webp, before-galaxy.webp, before-perf-{mid,low}{,-2}.json and .md.

## Fix round 1 (commit 768eb2c1a)

Ran, each after the cpu-quiet wait: `universe-check --quality {high,mid,low} --out lab/universe/lane1-before-2/<tier>` (all three exit 0, 14 poses each). Cells 0/0 or error in both samples: high landing-middleearth, mid middleearth-limb, mid landing-middleearth. Re-ran each alone (lab/universe/rerun.sh, cap 3): high landing-middleearth 60 calls / 158146 tris (try 1); mid middleearth-limb try 1 failed to start, try 2 gave 43 / 68469; mid landing-middleearth 85 / 166221 (try 1). Every cell now has a non-zero before. Evidence added: before-{high,mid,low}-2.json and before-rerun-*.json.
README now shows both samples, the re-run and a "before" column (larger non-zero calls and tris), the rule in one sentence, and says Task 11 gates perf on idle and fly p50 (the load p95 is a one-off hitch).
Concerns: the landing-middleearth befores at high (60) and mid (85) rest on one re-run each and look low against low's 99; the README says so. Sample 2 mid breakingbad was 0/0 (its before is from sample 1). Only docs/superpowers/evidence/endless-lane1 was committed (pathspec commit).
