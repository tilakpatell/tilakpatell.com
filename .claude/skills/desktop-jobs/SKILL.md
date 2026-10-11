---
name: desktop-jobs
description: Use when a change needs a new 3D model (GLB), voice lines (recorded dialogue) or an animation clip from a text prompt that only the owner's GPU desktop can make, when asked to request, check on or retry a gen3d, voices or motion job, when a bf2017 picture job (HDR panoramas, Enlighten atlases, not-uploaded textures, the UASTC ultra row, the depot probe, the ultra frame gate) is to be run, dry-run or checked, or when a gen3d/voices/motion/bf2017 issue, workflow run or self-hosted runner is queued, failed or stuck.
---

# Desktop jobs: 3D models and voice lines

The owner's desktop GPU makes 3D models (gen3d), cloned-voice lines
(voices) and clips on Meshy's skeleton from a sentence (motion,
`scripts/motion/README.md`). A cloud session can't run them. It asks with a labelled GitHub
issue, and the desktop's self-hosted Actions runner answers with a pull
request when the desktop is awake. Full guide: `scripts/desktop/README.md`.

## Ask

```
node scripts/desktop/ask.mjs gen3d NAME --what "what it is" --image URL [--faces 30000] [--options "tex: 2048"] [--note "why, where it goes"]
node scripts/desktop/ask.mjs gen3d NAME --what "…" --prompt "…, plain white background" --faces 4000     # only for designs an image model knows
node scripts/desktop/ask.mjs voices NAME [--only rick,morty] [--line "rick: text"]…                       # no lines: every unrecorded line on main
node scripts/desktop/ask.mjs motion NAME --prompt "what the body does" [--seconds 3] [--options "seed: 7  with: sword.a"]
```

Add `--dry-run` first to see the issue. The same works as
`gh workflow run gen3d.yml -f name=… -f what=… -f image=…`.

- A **picture** beats a prompt: three-quarter view, whole subject, plain background. Fandom/wiki image URLs work.
- **faces** sets the top cut: rock 4000, prop 10000, character 30000 (default 120000).
- The model lands as `public/models/gen3d/NAME{.hq,,.lo}.glb`. Wiring it into a scene is your own follow-up PR after theirs merges.
- A clip lands as `public/games/meshy/ual-gen.NAME.glb` with a sheet beside a library clip; HY-Motion's licence excludes the EU, the UK and South Korea, so shipping one is the owner's call (`docs/research/2026-10-08-motion-spike.md`).
- Voice lines for code not on main yet: list them as `who: text`. The id is `lineId(who, text)` (src/lib/voiced.js).

## The bf2017 picture jobs (lane W)

Six jobs the owner starts by hand, not issues: `bf2017-desktop.yml`
(Actions → *bf2017 desktop* → *Run workflow*, or
`gh workflow run bf2017-desktop.yml -f job=<panoramas|atlases|textures|uastc|depots|gate|all>`,
`-f only=hoth -f limit=2` for a first run). Each opens its own pull request
with its evidence under `docs/superpowers/evidence/bf2017-picture/`.
From a cloud session, prove a job’s plan with
`node scripts/desktop/bf2017-<job>.mjs --dry` (or `-f dry=true`, on
GitHub’s runner); ask the owner to run the real one. What each makes and
needs: `scripts/desktop/README.md`, “bf2017 picture jobs”.

## Follow

`node scripts/desktop/status.mjs` shows the runner, the queue and recent runs.
The issue's comments say Started (run link), Made (PR link) or Failed (log
tail and hint).

| state | meaning | do |
|---|---|---|
| queued, runner offline | desktop asleep | wait; nothing is lost |
| waiting for the GPU | another job holds VRAM | wait for the hourly sweep |
| failed | see the comment | fix the issue body, remove the `gen3d:failed`/`voices:failed`/`motion:failed` label |

Desktop healthy? `gh workflow run desktop-doctor.yml`, then read that run's summary.

Don't poll in a loop. Check once, and tell the user it's queued.
