# Putting a figure on the site’s skeleton

Every person on the site stands on Meshy’s 24-bone skeleton and plays the
clip library (`src/lib/three/clipLibrary.js`: Meshy’s `act-*`, Quaternius’s
UAL `ual-*`, Rick’s idle, walk and run). A figure made here on the GPU
(`scripts/gen3d`) comes out as a statue. This folder gives it the skeleton,
so it walks, sits, casts and falls on the same clips as everyone else, with
no Meshy key:

```
node scripts/rig/skin.mjs FIGURE.glb OUT.glb --height 1.45
```

`FIGURE.glb` is a figure standing up, facing +z (what `scripts/gen3d` makes;
`--turn 90|180|-90|auto` turns one that faces elsewhere). `OUT.glb` has Meshy’s
24 bones by the names, the parents and the turns at rest of
`src/lib/three/meshyRig.fixture.js` (Luke’s), under an `Armature` node scaled
to metres with the bones in centimetres, as Luke’s file is; the mesh bound by
Blender’s automatic (heat) weights; the soles on y = 0 and the crown at
`--height` metres. `lib/three/rig.js` finds every bone by name, and
`clipLibrary.forFigure` retargets every clip by the hips’ height.

## The files

| file | what it does |
| --- | --- |
| `skin.mjs` | the pure half: the bone table, the joints read off the shape (`estimate`), the bones fitted to them (`fit`), Blender’s job, and the skeleton rebuilt round Blender’s weights (`assemble`); and `skin()`, which runs it all |
| `skin.py` | Blender’s half, headless: the bones put where `skin.mjs` says, the weights made by heat, the GLB written |
| `bake.py` | `scripts/gen3d/bake.py` for a figure: its low mesh remeshed into one closed skin before it’s decimated (a generated mesh is shells with hairline gaps, which open at every joint once it bends, and cost a third of the vertices), and the bake’s cage pushed out to 0.08 so the remesh’s rounded hair still finds the hair. Each cut is baked at its own size with its own atlas: simplifying one bake for the others dragged its 3,500 chart edges and painted skin on the hair |
| `transfer.mjs` | one cut of a figure weighted like another, vertex by nearest vertex: the cuts are baked from one raw model, so the top cut is weighted by heat and the others take its weights in a second |
| `clips.mjs` | a figure’s own idle, walk and run beside it (`NAME-idle.glb`…), as Meshy’s figures have theirs: the UAL’s calm idle, formal walk and sprint, each bone’s turn as it is and the hips’ height scaled |
| `rig-check.mjs`, `rig-check.html` | the check: the figure in headless Chromium with the site’s loader, every clip played, the feet followed |
| `fixtures/figure.mjs` | a toy figure of capsules and a ball, with its true joints, for the tests |

## How the joints are found

The figure is cut into 80 slices, sole to crown, and each slice into runs
along x (where there’s body and where there’s a gap). Then, as
`cybertron/game/autorig.js`’s `joints()` reads a robot, but by the shape
where the shape says:

- **the feet**: what’s lowest each side, heel to toe from the spread along z;
- **the crotch**: going up, where the two legs’ runs become one; a robe’s hem
  (a run round both legs for a slice or two) is gone through, and a crotch
  lower than 15 % of the height is a robe to the shins, not a crotch;
- **the hips**: 7 % of the height over the crotch, else a third of the way
  up (the big-headed figures’ share, Frodo’s file);
- **the neck**: under the head’s widest, the narrowest the body gets before it
  widens to the shoulders, in slices the arms aren’t in; with no narrowing (a
  beard, a high collar) a ball as deep as the head is wide ends at the chin;
- **the shoulders**: at the neck’s foot the body is as wide as the shoulders’
  tops and no wider, since an A-pose takes the arms down from there;
- **the hands**: what reaches furthest out each side between the hips and the
  neck, the A-pose holding them there; the wrist a hand’s length back toward
  the shoulder, the elbow the arm’s own middle.

A figure whose shape misleads is given a share (`shares: { neck: 0.62 }` in
`scripts/hogwarts-cast-figures.mjs`), which wins over the shape.

Each bone is then turned as Luke’s is at rest and swung, with no twist, to
point down this figure’s own limb, so a clip made on Luke turns each part of
it as it turns Luke’s. The head is bound 20° forward of the head it moves:
the library’s clips carry the head 20° to 25° further down than Luke’s rest
does, and on a head a third of the height that reads as staring at the feet.

## Blender’s half

Bone heat wants one closed surface, and gives up on the whole figure (every
vertex bare) when it gets pieces: a pair of glasses, a scarf’s tassel. So the
weights are made on a stand-in and carried over by nearest face: the figure’s
biggest piece when that’s nearly all of it, else a voxel remesh (a hundredth
of the height), coarser each time the solver still fails. Whatever is left
bare takes its nearest neighbour’s. Blender’s skeleton is thrown away: only
the weights come back, and `assemble` builds the skeleton the site plays on.

Blender is found as `scripts/gen3d/bake.mjs` finds it (Windows, or Linux in
WSL). Without it the pure tests still run and the round trip is skipped.

## The check

```
node scripts/rig/rig-check.mjs OUT.glb [--sheet out.webp] [--rows idle,walk,cast]
```

starts a dev server of its own (or `--base`), loads the figure with
`lib/three/gltf.js`, and fails on a bone of the 24 missing by name, a role
`rig.js` can’t find, a clip that won’t load or moves a bone the figure hasn’t,
the soles more than 4 cm off the floor at any frame of the walk or 2 cm of
the idle, or a planted toe sliding faster than `scripts/anim-check.mjs`’s
LIMIT (0.15 m/s) as `createAnimator` and locomotion walk it at its own
stride. It plays idle, walk, run, `ual-cast`, `act-sit.down` and
`act-knockdown`, and reports how low each takes the body. `--sheet` draws four
views of the figure in its idle, its walk and the cast (or `--rows`).

## Clips on auto-weighted figures

Heat weights spread a limb’s pull a little into what’s next to it, and a robe
has no legs inside it to follow, so some clips read worse on these figures
than on Meshy’s rigged ones. From the Hogwarts cast’s sheets:

- **A robe to the floor walks as a bell.** The hem is weighted to the shins,
  so it swings with each leg and stretches between them; the formal walk’s
  short stride keeps it tidy, the sprint and the jogs pull the hem into a
  point between the knees. Hogwarts’ robed staff should run as little as
  their dignity suggests.
- **`act-sit.down`, `ual-sit.*` and `ual-crouch`** fold the thigh up through
  the robe’s front: the cloth over the lap is weighted to the thighs and the
  hips together, and it creases into the belly. Seated figures read best from
  the front and the side, not from above.
- **`act-knockdown` and the deaths** end on the floor as they should, but a
  wide sleeve folds through the chest as the arms go across; the falls want
  a camera that isn’t close.
- **`ual-cast` and the other arm clips** read well: the A-pose arms are clear
  of the body, so the heat gives the sleeve to the arm, and the hand leads.
- **Big beards** (the giant’s, the headmaster’s) are weighted to the head and
  the neck: a look down pushes the beard into the chest a little.

## Tests

`skin.test.mjs` (the table against the fixture, the joints of the toy figure
in three A-poses and a robe, the fit giving Luke back from his own joints,
Blender’s job and command, `assemble`’s skeleton and its inverse bind
matrices; and, where Blender is, the round trip on the toy figure),
`clips.test.mjs` and `rig-check.test.mjs` (the check’s verdict, on results
shaped as its page makes them).
