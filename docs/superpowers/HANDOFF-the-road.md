# Hand-off: the Road, and the sheet made true

Middle-earth as a journey: one continuous three.js ride from Bag End to the Grey Havens at `/middle-earth/road`, sixteen stages performing the films’ set pieces round the visitor, the games waiting at its end on the desk; and the map’s sheet remade from Tolkien’s geography as data. The design: `docs/superpowers/specs/2026-10-18-the-road-design.md`. The research the sheet rests on: `docs/research/2026-10-18-middle-earth-map-geography.md`. The plans: `docs/superpowers/plans/2026-10-18-the-road.md` (35 tasks) and `docs/superpowers/plans/2026-10-18-middle-earth-sheet.md` (6 tasks, done and removed: lane S’s row). The rules every session keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`. The hand-off this one sits beside: `HANDOFF-worlds.md` (Middle-earth’s chapters) and `HANDOFF-engine-floor.md` (#1023 puts the chapters on the runtime; the Road is a `'nodes'` module from its first commit and waits for nothing of it except where the hub and the page are edited, Task 33 and the whole sheet plan).

## Done (2026-10-18, the design session)

- The design, the research note, the two plans, this hand-off (pull request: the design docs).

## The lanes

| lane | what | plan | tasks | branch | session | pull request | state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 the spine | the module, the line, the clock, the director, the fellowship, daylight, the face, the rows, the cast, the measure | `…-the-road.md` | 1 to 10 | `claude/the-road-1-spine` | 2026-10-18 | #1034 | done: tasks 1 to 10; the numbers in `evidence/the-road/README.md`; next R2 (Task 11) |
| S the sheet | the geography, the projection, the consumers, the painter, the shots | `…-middle-earth-sheet.md` (done, removed) | 1 to 6 | `claude/middle-earth-sheet` | 2026-10-18 | #1036 | done: every task, then the map made less crowded on the owner’s word (names ranked and placed, Tolkien’s forests, the hub’s foot on two lines, the frame on the whole road); main with #1023 merged in |
| R2 the systems | the ground, the scatter, the water, the weather, the ambience, the house and the vision, Hobbiton in full | `…-the-road.md` | 11 to 17 | `claude/the-road-2-systems` | 2026-10-19 (session_01Pa7Th5Ndiq8Vz332ijCx2w) | | in progress: tasks 11 and 12 done; Task 13 (the water) from the start |
| R3 stages 2 to 6 | the Shire’s edge, Bree, Weathertop, the Ford, Rivendell | the same | 18 to 22 | `claude/the-road-3-eriador` | | | |
| R4 stages 7 to 10 | Caradhras and the Doors, Moria, Lothlórien, the Anduin | the same | 23 to 26 | `claude/the-road-4-mountains` | | | |
| R5 stages 11 to 14 | the Marshes and the Gate, Ithilien and the Vale, Cirith Ungol, Gorgoroth and the Mountain | the same | 27 to 30 | `claude/the-road-5-mordor` | | | |
| R6 the end | the White City, the Havens, the desk, the hub’s first step, the journal, the achievement | the same | 31 to 33 | `claude/the-road-6-end` | | | free: #1023 has merged |
| R7 polish | the numbers at every stage, the phone, reduced motion, the docs, the riders online | the same | 34, 35 | `claude/the-road-7-polish` | | | |

A session takes the next lane whose state allows it, runs until its budget, merges what is green, fills its row and leaves the next unchecked task for the next session. A lane that does not finish in one session is continued on the same branch by the next.

## What the other work must know

- **The sheet is true (lane S)**: `geography.js` holds the miles, `sheet.js`’s `placeAt(id)` is where anything stands on the sheet; the stops, chapters, hidden places, the map’s cast and the diorama read it, and `sheet.test.js` holds the research note’s §5 relations. A new place goes in `geography.js` with its source, never as a literal. A new name goes in `mapNames.js` with its rank; the placer decides where it sits, and `mapNames.test.js` holds that no two names touch. `mapDiorama.js` is at 799 lines: the next thing it gains splits it (its ranges and woods block first).
- **#1023 (FL2 Middle-earth) has merged** (2026-10-18), so `src/components/middleearth/module.js`, `stage.js`, `tick.js`, the towns, `rush/Rush.jsx`, `shire/ShireWorld.jsx`, `src/pages/MiddleEarth.jsx`, `src/runtime/views.js` and `runtime.js` are free; S and R6 wait for nothing. Each lane still keeps to the files its plan’s tasks name.
- **The Road imports from Middle-earth only** `chapters.js`, `road.js`, `record.js`, `hidden.js`, `creatures.js`, `castRules.js`, `ease.js`, `feel.js`, `pack.js`, `mapPaint.js`, `mapData.js`, `sheet.js`, `geography.js`. Never a town, `kit.js`, `cast3d.js`, `mapFigures.js`: their closures carry GLSL and `src/runtime/shading.test.js` would fail.
- **`WORLD_MB['/middle-earth']` says 1** and the cast alone is 15 MB; stale, not these lanes’, noted for whoever owns the chapters.
- **The owner’s steps** (the credit track, after R2): a Gollum figure from Meshy as the cast was made (`public/models/middleearth/cast/gollum{,-idle,-walk,-run}.glb`; `road/cast.js` prefers it when it exists); the Road’s new voiced lines run through `scripts/voices` on the desktop (`road/voicelines.js` lists them; until then they show as words); horses with their own legs only if the farm pack’s read wrong in the shots.

## R1’s notes for the next lanes

- The stage lengths sum to 3,280 m, not the plan’s 3,970 (a 30 s-hold ride was 34 minutes); `clock.test.js` is the ledger, and a stage task that needs more road takes it from a neighbour or shortens its holds.
- Holds are met by crossing `nextBeat(s)` (strictly after `s`) and read by `holdAt(beat)`; until the stages have beats, the module’s `nextBeat` is the next stage’s start (Next under reduced motion steps stage by stage).
- The save is `{ v: 1, s, ridden, at, walked }`: `walked` is the share walked by the clock, never jumped or skipped, and `ridden()` reads it (the design’s two thirds). A ride saved at the end starts again at Bag End; an address writes nothing over the save until the visitor walks.
- Enter is bound only under reduced motion, so a focused button takes it; Space stays the Road’s.
- The one you follow walks at the back of the file (`module.js`’s `frame`), the rest ahead in their order.
- `cast.js`’s `walker.set({ base, speed })`: locomotion for walk and run, a base loop for anything else; the beats will want layers (`play`) added there.
- No MiniMap and no Bubble yet: the first draws nothing until Task 20, the second has no line to say until a beat plays one.
- On a phone the ribbon’s sixteen 44 px dots overlap (R7).
- The container’s SwiftShader draws the Road at about one frame a second (and `/earth` at 1.6): judge frame time on the owner’s machines, draws and triangles here.

## Checks

Before a change is done (CLAUDE.md): `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; `git checkout public/github.json` after a build. The browser in the container draws in software (SwiftShader) with no WebGPU device: the `webgpu` rows are the owner’s laptop and desktop; leave them empty and say so, never estimate. `?gpu=webgl` forces the node renderer over WebGL 2 (`nodes-webgl`), which is what the container measures.

## The prompt for a lane’s session

```
You are lane <R1 | S | R2 …> of the Road on tilakpatell.com. Read, in order:
CLAUDE.md, docs/README.md, docs/superpowers/HANDOFF-the-road.md (this
hand-off), docs/superpowers/specs/2026-10-18-the-road-design.md (the
design: the brief for every stage, the systems, the goals), your plan
(docs/superpowers/plans/2026-10-18-the-road.md, or
2026-10-18-middle-earth-sheet.md for lane S, with
docs/research/2026-10-18-middle-earth-map-geography.md), and
docs/superpowers/HANDOFF-worlds.md where you touch the hub.
docs/health/RULES.md is the law.

Skills: using-superpowers first; subagent-driven-development or
executing-plans for the plan; test-driven-development for any rule;
systematic-debugging on any failure; verification-before-completion before
saying anything is done; requesting-code-review before the pull request;
finishing-a-development-branch to merge. The threejs-shaders,
threejs-materials, threejs-aaa-graphics-builder, threejs-debug-profiler and
threejs-qa-release skills help anything drawn; design-taste-frontend
anything laid out. Talk in caveman (ultra); write docs, comments and
commits in the repo's voice (British spelling, curly quotes, comments say
why, no exclamation marks).

Your lane: <the row from the lanes table>. Your branch: <branch>, from
origin/main (merge origin/main first; for lanes S and R6, only once #1023
has merged). Own only the files your plan's tasks name; a file another
open pull request owns (the hand-off's "What the other work must know") is
not yours. One pull request a lane (or as your plan's tasks group them),
its numbers in the description (draws, triangles, the probe's rows, the
download, the shots desktop and phone), merged when CI is green and the
gates hold; fill your row in this hand-off and your rows in
docs/superpowers/evidence/the-road/README.md. Look at every shot you take
(Read the file): a stage that does not read as its film moment is not
done. The WebGPU rows are the owner's machines': leave them empty and say
so, never estimate. Never print or commit a key; never skip or quieten a
test; never raise a budget without a sentence saying why; never commit
src/data/health/latest.json; run the four checks before each push. When
your budget runs low, finish the task you are in, push, fill your row with
what is done and what is next, and stop.
```
