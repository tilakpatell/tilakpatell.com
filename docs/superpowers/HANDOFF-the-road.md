# Hand-off: the Road, and the sheet made true

Middle-earth as a journey: one continuous three.js ride from Bag End to the Grey Havens at `/middle-earth/road`, sixteen stages performing the films’ set pieces round the visitor, the games waiting at its end on the desk; and the map’s sheet remade from Tolkien’s geography as data. The design: `docs/superpowers/specs/2026-10-18-the-road-design.md`. The research the sheet rests on: `docs/research/2026-10-18-middle-earth-map-geography.md`. The plans: `docs/superpowers/plans/2026-10-18-the-road.md` (35 tasks) and `docs/superpowers/plans/2026-10-18-middle-earth-sheet.md` (6 tasks, done and removed: lane S’s row). The rules every session keeps: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md`. The hand-off this one sits beside: `HANDOFF-worlds.md` (Middle-earth’s chapters) and `HANDOFF-engine-floor.md` (#1023 puts the chapters on the runtime; the Road is a `'nodes'` module from its first commit and waits for nothing of it except where the hub and the page are edited, Task 33 and the whole sheet plan).

## Done (2026-10-18, the design session)

- The design, the research note, the two plans, this hand-off (pull request: the design docs).

## The lanes

| lane | what | plan | tasks | branch | session | pull request | state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 the spine | the module, the line, the clock, the director, the fellowship, daylight, the face, the rows, the cast, the measure | `…-the-road.md` | 1 to 10 | `claude/the-road-1-spine` | 2026-10-18 | #1034 | done: tasks 1 to 10; the numbers in `evidence/the-road/README.md`; next R2 (Task 11) |
| S the sheet | the geography, the projection, the consumers, the painter, the shots | `…-middle-earth-sheet.md` (done, removed) | 1 to 6 | `claude/middle-earth-sheet` | 2026-10-18 | #1036 | done: every task, then the map made less crowded on the owner’s word (names ranked and placed, Tolkien’s forests, the hub’s foot on two lines, the frame on the whole road); main with #1023 merged in |
| R2 the systems | the ground, the scatter, the water, the weather, the ambience, the house and the vision, Hobbiton in full | `…-the-road.md` | 11 to 17 | `claude/the-road-2-systems` | 2026-10-19 (session_01Pa7Th5Ndiq8Vz332ijCx2w) | #1088 | done: tasks 11 to 17 (the ground, the scatter, the water, the weather, the ambience, the house, the Ring vision and the chain, Hobbiton in full); the numbers in `evidence/the-road/README.md`; next R3 (Task 18, the Shire’s edge) |
| R3 stages 2 to 6 | the Shire’s edge, Bree, Weathertop, the Ford, Rivendell | the same | 18 to 22 | `claude/the-road-3-eriador` | 2026-10-19 (session_015Er4bG6AGb2eoh5zdZEaMK, then session_011VvN2wZk3G1EWPerQB4Ycq) | #1098 | done: tasks 18 to 22 (the five stages’ beats, lore, lines and scenes, drawn with their chapters’ builders); every beat under the targets on both tiers; the numbers and the pictures in `evidence/the-road/README.md`; next R4 (Task 23, Caradhras) |
| R4 stages 7 to 10 | Caradhras and the Doors, Moria, Lothlórien, the Anduin | the same | 23 to 26 | `claude/the-road-4-mountains` | 2026-10-19 (session_01UzfodGSzW2TB9FFiJxSmHP; session_01KdZySbYwzyVSuhX44PRfB5 took it at 14:32 while the first was measuring, not stalled) | #1112 | built, looked at and measured: the four stages, every beat under the targets on both tiers; the numbers and pictures in `evidence/the-road/README.md`; done: merged; next R5 (Task 27, the Marshes) |
| R5 stages 11 to 14 | the Marshes and the Gate, Ithilien and the Vale, Cirith Ungol, Gorgoroth and the Mountain | the same | 27 to 30 | `claude/the-road-5-mordor` | 2026-10-19 (session_018jwwjWBJ86aYFYdmv9GjYB) | | in progress: Task 27, the Marshes and the Gate |
| R6 the end | the White City, the Havens, the desk, the hub’s first step, the journal, the achievement | the same | 31 to 33 | `claude/the-road-6-end` | | | free: #1023 has merged |
| R7 polish | the numbers at every stage, the phone, reduced motion, the docs, the riders online | the same | 34, 35 | `claude/the-road-7-polish` | | | |

A session takes the next lane whose state allows it, runs until its budget, merges what is green, fills its row and leaves the next unchecked task for the next session. A lane that does not finish in one session is continued on the same branch by the next.

## What the other work must know

- **The sheet is true (lane S)**: `geography.js` holds the miles, `sheet.js`’s `placeAt(id)` is where anything stands on the sheet; the stops, chapters, hidden places, the map’s cast and the diorama read it, and `sheet.test.js` holds the research note’s §5 relations. A new place goes in `geography.js` with its source, never as a literal. A new name goes in `mapNames.js` with its rank; the placer decides where it sits, and `mapNames.test.js` holds that no two names touch. `mapDiorama.js` is at 799 lines: the next thing it gains splits it (its ranges and woods block first).
- **#1023 (FL2 Middle-earth) has merged** (2026-10-18), so `src/components/middleearth/module.js`, `stage.js`, `tick.js`, the towns, `rush/Rush.jsx`, `shire/ShireWorld.jsx`, `src/pages/MiddleEarth.jsx`, `src/runtime/views.js` and `runtime.js` are free; S and R6 wait for nothing. Each lane still keeps to the files its plan’s tasks name.
- **The Road imports from Middle-earth only** `chapters.js`, `road.js`, `record.js`, `hidden.js`, `creatures.js`, `castRules.js`, `ease.js`, `feel.js`, `pack.js`, `mapPaint.js`, `mapData.js`, `sheet.js`, `geography.js`. Never a town, `kit.js`, `cast3d.js`, `mapFigures.js`: their closures carry GLSL and `src/runtime/shading.test.js` would fail. Since R3 the chapters’ builders stand apart from their shaders, and the Road may import these too: `shire/build.js`, `stoneTextures.js`, `towns/bree/build.js`, `towns/weathertop/build.js` and `trollshaws.js`, `towns/rivendell/build.js`, `parts.js`, `valley.js` and `canvases.js` (code and painted canvases only; a town’s `props.js`, `scene.js` or kit still never). Since R4 also Moria’s, Lothlórien’s and Amon Hen’s parts (`towns/{moria,lorien,amonhen}/*.js`), never their `shaders.js`, `props.js` or `scene.js`. `shading.test.js` holds it: a builder that gains a shader hook fails it.
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

## R2’s notes for the next lanes

- **The recipe** is Hobbiton’s: `stages/<id>/beats.js` (data, with `entered`/`left` re-exported), `lore.js`, `props.js`, `index.js`’s `build(ctx)` (`ctx = { road, heightAt, rt, weather, tier }`; `update(local, dt, { since, speed })`, each beat’s scene a function of `since[id]`, so walking back puts it back). Register the stage in `stages/registry.js` (its beats and lore: the ledger and the lore sweep read them) and its scene’s import in `scenes.js`’s `SCENES`. `stages/index.js` takes its `ground` (rivers as `points`, `depth`, `width`, `bank`).
- **Beats**: the clock stops on every written beat’s mark for its `hold`; Next under reduced motion steps beat to beat. A beat’s `params.above: true` puts its camera’s heights over the land. A `crane` takes `params.top` and `params.lookAt`. `fx: [{ kind: 'black' | 'vision', at, seconds }]` (`beats.js`’s `fxAt`). `clip` plays once as the beat is reached; `lines` are `voicelines.js` ids, said and told as `'line'` events (the Bubble is the face’s to draw).
- **Water**: `water.js`’s `createWater({ along: { line, width, level } | area, kind: 'river' | 'still' | 'lava', sky, ground })`; rivers in a stage’s ground get theirs from `lands.js` (`riverLevel`, and `land.wet` keeps the scatter out). `uRise` is the Ford’s.
- **Weather**: `weather.kind(name, { count, box, follow, scale })` → `{ at, rate, stop }`; a kind is one draw. Under the chain its quads write the scene pass’s normal and throw away clear texels (`weather.js`), or AO leaves squares behind them.
- **The vision**: `road.uVision` is on every lit material (swept once a second) and in the grade; `vision.js` is the state.
- **The worst frames** are node shaders built in the frame (the evidence README); compiling each stage off the frame as lands.js finishes it is the mend (R7, or the next lane that feels it).
- `lab/road/common.mjs` sets `tp-worlds` to load, as the probe does: at `low` the site otherwise holds the Road behind its Load 3D card and the lab scripts time out.

## R3’s notes for the next lanes

- **Drawn as the chapters are**: a stage whose chapter exists builds with that chapter’s builders (`shire/build.js`, `towns/<town>/build.js`) on `road/townKit.js`’s kit (`createTownKit(road, renderer, { wild, elven })`: the Shire’s and Bree’s materials, Weathertop’s and the Ford’s with `wild`, Rivendell’s with `elven`), at `0.8` (the Road’s man over the chapter’s Big Folk). Caradhras, Moria, Lothlórien and the rest have chapters too: split their builders from their shaders as `76f0dbd22` did, verbatim, before the Road imports them.
- **Merge after building**: the builders draw a building in a mesh a material, a dozen draws a house; `stages/parts.js`’s `mergeStatics(group, { keep })` merges a stage’s still meshes one a material, leaving what the scene moves. Bree went from 261 draws to 118 on `low`.
- **A figure is never culled** (`cast.js`: a skinned mesh’s bounds don’t follow its pose), so a stage’s own figures cost their triangles wherever the camera looks: show them only near their beat (Rivendell’s guests come in from the bridge). On `low` a figure has no ink hull.
- **Look before you trust a rig’s numbers**: two of this lane’s beats were black because the camera stood inside a wall (the hollow, Amon Sûl’s ring). Under the vision Weathertop’s one point light turns cold and goes to the five.
- `lab/road/shots.mjs` edits under its feet reload the page: a beat shot taken while files change can time out; take the pictures once the code is still.
- **Things knocked flying**: `road/tumble.js` puts a beat’s crates and barrels on Rapier (`lib/physics/world.js`, loaded the first time, not on `low`) with the beat’s movers (Bree’s Riders) as kinematic boxes on the paths the scene draws them on. `tumble.rules.js`’s `replay` runs it from the beat’s seconds, so walking back stands everything up again and walking on falls the same way. A stage gives it `{ items, movers, ground }` and calls `update(since[id])`.
- **A season’s colour on the kit’s leaves**: a scatter row’s `tint: { Leaves_Birch: { recolour } }` keeps the leaf’s cut-out now (`lib/three/recolourNodes.js` kept the map’s light but not its alpha, and an alpha-tested leaf stood as a dark card).

## R4’s notes for the next lanes

- **The ledger is tight**: stages 7 to 10 came in at 170, 180, 150 and 170 m with 47, 54, 34 and 42 s of holds, and the ride on auto is 1,749 s with stages 11 to 16 still counted at half a minute of holds each. Their real holds (the table’s, about 330 s) will not fit in the 51 s left at their table lengths: R5 and R6 must shorten their stages (about 150 m each) or trim holds, and `clock.test.js` says when it is over.
- **Three more chapters split**: `towns/moria`, `towns/lorien` and `towns/amonhen` now split by what they draw (as `docs/health/RULES.md`’s own example), the GLSL alone in each `shaders.js` and the kit in `props.js`; a builder that wanted a shader asks the kit (`K.shaders`). The Road makes those chapters’ materials in `road/moriaKit.js` (`addMoria(town, …, { gate, deep })`) and `road/lorienKit.js` (`addLorien`), the shaders as node stand-ins. Each split was proved by building every builder from the old file and the parts on one stand-in kit (the same meshes, vertices, positions). Ithilien, Cirith Ungol, Doom (`towns/doom`), Minas Tirith and the Marshes have chapters too: split them the same way.
- **New on the line**: `daylight.js`’s `STORMS` (a stretch of a stage under its own air: Caradhras’ white-out, Moria’s dark; `murk` takes the sky into the fog); `fxAt`’s `shake`; `ground.js`’s paint from a stage’s `ground.paint` (greens, dirt, snow above a height, rock where it is steep); `stages/parts.js`’s `waterOn(land, i)`; `stages/boats.js` (the boats under the company while afloat); `creatures/eye.js`’s `eyeColour` (the Mirror now, Barad-dûr next); a scene is given the `sky`; the camera’s lead stands where a scene carries the walkers; and `scenes.js` warns in development when a stage will not build (Lothlórien sat empty for an hour on a wrong import before it did).
- **A mark is a hair short**: the clock holds a beat a hair before its metre, so a travel mode meant to start at a beat starts a metre before it (the Anduin’s boat).
- **A seat or wide shot is in absolute heights over the ground under each point** (`above`): over a pit or a flet, give the height you mean (the Bridge looks back from the far bank; the dais shot is 19.9 m up).
- **What still falls short, for R7**: Caradhras’ flakes do not show in the white-out (the fog carries it); the Watcher’s arms read best lit by the Doors’ glow, and Frodo on the arm is small; Moria’s goblins are dark shapes on the pillars; the Balrog’s fire cards are the chapter shader’s to place and show here as its sword, whip and red glow only; Lothlórien’s boats’ sitters stand; the Seat’s four pictures are hazy under the vision; the Uruks at the horn run outside the shot; Tol Brandir is a far grey spire.

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
