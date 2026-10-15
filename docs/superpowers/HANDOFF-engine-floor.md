# Hand-off: the engine floor

The design: `docs/superpowers/specs/2026-10-15-engine-floor-design.md` (what was found, the end state, the lanes, the gates). The evidence: `docs/superpowers/evidence/engine-floor/README.md` (the inventory’s commands and numbers; a folder a lane). The plans, one a lane: `docs/superpowers/plans/2026-10-15-engine-floor-lane*.md`. The rules every lane keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`. The hand-offs this one continues: `HANDOFF-every-world-on-webgpu.md` (the ports’ tables), `HANDOFF-performance-lanes.md` (lanes P0 to P8; P1, P2, P5 and P7 are carried on here as FL3, FL2, FL4 and FL5).

The owner’s word (2026-10-15): remove the bloat, every world on WebGPU, everything more performant, in preparation of the Frostbite reconstruction for Battlefront II; a detailed design, then Opus 5.5 sessions to build it. The standing words of 2026-10-13 hold: every world defaults to WebGPU; a TSL twin is as good as its GLSL or better; at least 60 fps on a strong chip and 30 on a weak one; merge each task as it is finished.

## Done (2026-10-15, the design session)

- The inventory (the design’s §1; the evidence README): 605,667 lines of source, three floors (8 modules on the runtime, 17 renderer constructors off it, 61 frame loops, 12 post chains, 619 GLSL sites, 31 twins beside 29 originals), three copies of three.js in the build, 2.06 MB of game records parsed as JavaScript into the two biggest chunks, nine scripts nothing names, no dead source file, 1,090 MB of assets and 97.9 MB of evidence pictures in git.
- The design: one renderer (the node renderer, WebGPU first and WebGL 2 under it), one loop, one material language, one post chain, one world shape, the measure holding it; seven lanes.
- Plans for FL0, FL1, FL2 (one run a world), FL3 (one run a world), FL5. FL4’s and FL6’s plans are written when they start (FL4 by the session that flips the last module; FL6 by its own session, from the design’s §4.9 and the Frostbite audit’s N8).
- No code.

## The lanes

| lane | what | plan | starts | session | branch | PR | state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FL0 | the measure and the ratchet | `…-laneFL0-measure.md` | now | | `claude/engine-floor-fl0-measure` | | |
| FL1 | the sweep: nine scripts, knip, the records out of the chunks | `…-laneFL1-sweep.md` | now | | `claude/engine-floor-fl1-sweep` | | |
| FL2 the universe map | onto the runtime | `…-laneFL2-onto-the-runtime.md` | now, from `claude/perf-p2-universe` | | `claude/engine-floor-fl2-universe` | | |
| FL2 Middle-earth | onto the runtime | the same | now | | `claude/engine-floor-fl2-middleearth` | | |
| FL2 Rick and Morty | onto the runtime | the same | now | | `claude/engine-floor-fl2-rickmorty` | | |
| FL2 the Avengers and Invincible | onto the runtime | the same | now | | `claude/engine-floor-fl2-avengers` | | |
| FL2 Cybertron | onto the runtime | the same | after the four above | | `claude/engine-floor-fl2-cybertron` | | |
| FL2 Scranton and Albuquerque | onto the runtime | the same | after the four above | | `claude/engine-floor-fl2-office` | | |
| FL2 the Death Star | onto the runtime | the same | after the four above | | `claude/engine-floor-fl2-deathstar` | | |
| FL2 the Caribbean, the music room, Dickansh, Dot Matrix | onto the runtime | the same | after the four above | | `claude/engine-floor-fl2-small` | | |
| FL2 the page scenes | onto the runtime | the same | after the four above | | `claude/engine-floor-fl2-pages` | | |
| FL2 Battlefront’s backdrop and the hero stage | onto the runtime | the same | after #1000 to #1004 merge | | `claude/engine-floor-fl2-bf-stages` | | |
| FL3 /fly | the port, rebuilt | `…-laneFL3-ports.md` | now, from `claude/perf-p1-fly` | | `claude/engine-floor-fl3-fly` | | |
| FL3 the Mario 64 tribute and the Death Star’s inside | the ports | the same | now, from `claude/perf-p1-mario64` and `claude/perf-p1-ds-inside` | | `claude/engine-floor-fl3-mario64`, `…-fl3-ds-inside` | | |
| FL3 the galaxy | the port | the same | now | `session_01FVfsnhXZobwg2tJHpsQAkV` | `claude/engine-floor-fl3-galaxy` (the shared twins: `…-fl3-galaxy-shared`) | | in four parts: the shared twins (atmosphere, noise, rock, speed lines), the galaxy’s own, what it borrows, the flip; `evidence/engine-floor/FL3-galaxy/README.md` |
| FL3 each world FL2 lands | the port | the same, by the FL2 session that landed it | as FL2 merges | | `claude/engine-floor-fl3-<world>` | | |
| FL4 | the classic renderer retired | written when FL3’s table is full | after FL2 and FL3 | | `claude/engine-floor-fl4-retire` | | |
| FL5 | the frame off the main thread, a spike | `…-laneFL5-worker.md` | now | | `claude/engine-floor-fl5-worker` | | |
| FL6 | the figures on the GPU | written by its session from the design’s §4.9 | after #1000 to #1004 merge | | `claude/engine-floor-fl6-figures` | | |

Each lane fills its row (session, PR, state) in its own pull request, and merges `origin/main` before it, keeping both sides. A lane never commits `src/data/health/latest.json`.

## What the other work must know

- **The Hoth pull requests** (#1000 to #1004) own `components/battlefront/` and `components/galaxy/surface/level/` until they merge; FL2’s Battlefront stages and FL6 wait.
- **Lane P4** (#993) owns `src/runtime/` except `webgpu.js` and `worker/` until it merges; FL5 adds `worker/` and one guarded line in `index.js`; FL2’s universe session adds `useWorld.js`’s near-the-viewport option after P4 merges or in P4’s pull request.
- **Lane P5** (`claude/perf-p5-pipelines`, pushed, its review’s three risks open): FL4 takes it over when the classic renderer goes; until then it is P5’s.
- **The twins’ rule** (lane T): a GLSL original is never edited while a `'glsl'` module reaches it. FL4 deletes them all at once and renames the twins.
- **The branches that are not pull requests** (`claude/perf-p1-fly`, `perf-p1-mario64`, `perf-p1-ds-inside`, `perf-p2-universe`): FL2’s and FL3’s sessions start from them, merge `main`, and land them under the FL branch names; the old branches are deleted once the FL pull request merges.

## Checks

Before a change is done (CLAUDE.md): `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; `git checkout public/github.json` after a build. A whole-repo scan test can pass its limit under the full suite’s load in the container (the hulls’ 10,000-segment timing tests, the conflict-marker scan, the secret scan): run it alone before calling it real. The browser in the container draws in software (SwiftShader) with no WebGPU device: the `webgpu` rows are the owner’s laptop (Radeon 740M) and desktop (RTX 5090); `?software=on` passes the Star Wars gate.

## The prompt for a lane’s session

```
You are lane <FL-n> of the engine floor on tilakpatell.com. Read, in order:
CLAUDE.md, docs/README.md, docs/superpowers/HANDOFF-engine-floor.md (this
hand-off), docs/superpowers/specs/2026-10-15-engine-floor-design.md (the
design: what was found, the end state, the gates), your plan
docs/superpowers/plans/2026-10-15-engine-floor-lane<FL-n>-….md, and the
hand-offs the design continues where your lane touches them
(HANDOFF-every-world-on-webgpu.md for a port, HANDOFF-performance-lanes.md
for the P lanes' state). docs/health/RULES.md is the law.

Skills: using-superpowers first; executing-plans or subagent-driven-
development for the plan; test-driven-development for any rule;
systematic-debugging on any failure; verification-before-completion before
saying anything is done; requesting-code-review before the pull request;
finishing-a-development-branch to merge. Talk in caveman (ultra); write
docs, comments and commits in the repo's voice (British spelling, curly
quotes, comments say why). Delegate with cavecrew (investigator to locate,
builder for a one- or two-file edit, reviewer on each diff). The
threejs-shaders, threejs-postprocessing, threejs-debug-profiler and
threejs-qa-release skills help a port.

Your lane: <what, one line from the lanes table>. Your branch:
<branch>. Start from <main | the branch named in the table>, merge
origin/main first. Own only the files your plan names; a file another
open pull request owns (the hand-off's "What the other work must know")
is not yours. One pull request (two for an FL2 session, which goes on to
FL3 for the same world), its gates' tables in the description, merged
when CI is green and the gates hold; fill your row in the hand-off and
your folder under docs/superpowers/evidence/engine-floor/. The WebGPU rows
are the owner's machines': leave them empty and say so, never estimate.
Never print or commit a key; never skip or quieten a test; never raise a
budget without a sentence saying why; never commit
src/data/health/latest.json; run the four checks before each push.
```
