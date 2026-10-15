# Hoth, made right: a cast of models, the snowspeeders’ tow cables, and Echo Base alive

Date: 2026-10-09. Written from a read of `origin/main` at `657d6757` and a
live probe of `/galaxy/hoth/surface` at quality high (headless Chromium on
Metal, the clock held, `scripts/surface-shot.mjs`’s set-up). Built in the
steps `docs/superpowers/plans/2026-10-09-hoth.md` lists.

## What the owner asked for

“Architect a way to make the planet Hoth better. Make sure ALL NPC’s are
models and not the weird custom blobs. Make it robust and make pr and merge
to main regularly. Architect a spec first.”

Done looks like this. You come down on the ice outside Echo Base and every
living thing you see is a model: the Rebel troopers, the snowtroopers, the
astromechs, the tauntauns, the wampa, the probe droid, General Rieekan in
the command centre, Leia beside him, Han and Chewie in the hangar, 2-1B in
the medical bay, Veers beside Vader at the walkers’ line, and Luke hung by
his ankles in the wampa’s cave. Nothing on Hoth is a figure built from
capsules and boxes, and nothing can fall back to one when a file is slow
or missing. A test fails the build if a Hoth kind has no model, and a probe
fails a PR if one is drawn. Then the planet gets the thing it is famous
for: take a snowspeeder up, fire the harpoon, and wind the tow cable round
an AT-AT’s legs till it falls.

## Assumptions (the owner was not here to ask; their standing notes decide)

1. “Hoth” is the surface at `/galaxy/hoth/surface` (`sites/ice.js`, site
   `hoth`), its Echo Base zone, and the Battle of Hoth assault
   (`missions/assaults.js` `hoth`). The orbit view, the galaxy map and the
   galaxy war sim are not changed.
2. “NPC” is everyone and everything that lives and moves: the site’s
   `life`, the zone’s `life`, the ground war’s soldiers on Hoth, the
   assault’s troops, the rides, and the people inside props (Luke in the
   cave). Ambient machines far off (the three `atatfar` walkers, the
   `speederflight` snowspeeders) are counted too: they move, so they are
   models.
3. New models come from Meshy on the owner’s third account
   (`~/.tilakverse-meshy3.env`, 2,882 credits on 2026-10-09), through the
   existing `scripts/meshy-galaxy.mjs` steps (images 9, models 30, rig 5,
   fetch free). The owner’s standing rule is “quote the total once, then go”;
   the total is in section 4. Existing GLBs are reused first: they cost
   nothing.
4. The standing rules hold (`docs/health/RULES.md`, the autopilot’s): no
   sequel trilogy; rules in pure tested files; files under 800 lines; a
   move changes no pixel; models credited; no runtime calls to Meshy;
   British spelling and curly quotes; budgets in `docs/health/budgets.json`.
5. Two lanes are live on the same files. The living-layer lane
   (`docs/superpowers/specs/2026-10-09-galaxy-surfaces-living-layer-design.md`)
   owns the `flora`, `look` and `grade` keys of `sites/ice.js`; this lane
   does not touch them. The Naboo lane (PR #768) edits `sites/index.js` and
   `sites/validity.js`; this lane does not touch those either.
6. The owner asked for “PR and merge regularly”: every phase below is one
   PR, merged with a merge commit after the trial-merge against every open
   branch (`merge-via-pr-check-other-branches`).

## What is there today (the evidence)

The probe counted Hoth’s people after the landing (`window.__surface().people`)
and every `CapsuleGeometry` mesh in the scene by its nearest named parent:

| kind | how many | drawn as |
|---|---|---|
| `mercenary` | 21 | **built** (`figures.js:53`): the ground war’s Hutt enforcers |
| `droid` | 4 | **built** (`figures.js:56`, `creature: 'astromech'`): R2-D2 and the astromechs |
| `hothtrooper`, `rebel`, `vader` | 5 | crew GLBs, rigged (`crewList.js`) |
| `rebelpilot`, `c3po`, `atat` | 8 | catalogue GLBs, rigged |
| `tauntaun`, `wampa`, `probe` | 9 | catalogue GLBs, **not rigged** (a bob, no stride) |

Capsule meshes: 153 under `life`, 252 under `ground`, 36 under
`life-inside`, 5 under `things`. Every one is a built person or creature.

Why:

- **No model for two kinds.** `anyFigure` (`actors.js:455`) tries a walker,
  a crew model, a catalogue model, then `buildFigure` (`figures.js:704`),
  then a prop. `droid` has no crew row and no catalogue row, though
  `catalog/people.js:23` has an `r2d2` model. `mercenary` has neither.
- **The ground war’s soldiers are kinds by side, not by world.**
  `population.js:71,83,99` calls `kindFor(t.side)`; `KINDS_OF_SIDE`
  (`troops.js`) gives the Empire `stormtrooper`, the Rebels `rebel` and the
  Hutts `mercenary` on every world, so Hoth’s ground war wears Tatooine’s
  kit and its Hutt turf is all blobs.
- **A slow or missing file falls to a blob.** `loadGlb`
  (`placer.js:75-88`) resolves `null` on any failure, and `modelFigure` and
  `crewFigure` then return `null`, so `anyFigure` goes on to `buildFigure`.
  A dropped request on a phone gives a capsule man.
- **People inside props.** `wampacave` (`props/ice.js:599-667`) builds Luke
  from seven boxes and spheres, hung from the roof. `props/ice.js:757-795`
  keeps built `vader` and `hothtrooper` humanoids as prop fallbacks.
- **Named people share one face.** General Rieekan, Toryn Farr, the
  controller, the medic, the deck officer and the loadmaster are all the one
  `rebel` or `hothtrooper` model. Han, Leia, Chewie and 2-1B are not on Hoth
  at all; Luke is only the player’s pick.
- **The famous fight is scenery.** The snowspeeders fly a fixed ring
  (`speederflight`, built); the fallen AT-AT is a prop; you cannot fly a
  speeder or trip a walker. `HANDOFF-galaxy.md:47` lists the tow
  cable as never built.
- **The rest of the planet** (Echo Base’s zone, three quests, eight places,
  the assault, the ion cannon, the shield generator) is in good order and
  is kept as it is.

## Approaches considered

1. **Give the two missing kinds a model and stop.** Cheapest; fixes what the
   probe found today. It leaves the fall-to-blob path for the next missing
   file, Hoth’s ground war in desert kit, and the named people faceless. It
   is not robust, which the owner asked for.
2. **Delete `figures.js` everywhere.** Every world would lose whatever it
   still builds in code, at once, and no test says which those are. Too
   wide for one planet’s lane, and it would break worlds this lane does not
   look at.
3. **A models-only cast for Hoth, enforced, then Hoth’s content on top**
   (chosen). A site can say `cast: 'models'`. Under it the resolver never
   builds a figure: it retries the file, then takes a named stand-in model,
   then draws nothing. A test proves every kind Hoth asks for resolves to a
   file on disk; a probe proves none is drawn built. Other worlds opt in
   later with one line. Then the cast, the snowspeeder and Echo Base’s life
   go on top as data and small pure modules.

## Goals

- Zero built figures on Hoth, outside and inside Echo Base, in the ground
  war and the assault, at every quality tier.
- A Hoth kind without a model fails `npm test`; a built figure drawn on
  Hoth fails the probe.
- A file that fails to load retries once, then shows a stand-in model of
  the same silhouette, then nothing; never a blob.
- Hoth’s named people are themselves: Rieekan, Toryn Farr, Leia, Han,
  Luke, Veers, 2-1B, plus Chewie, C-3PO, R2-D2 and Vader as now.
- The tauntauns and the wampa walk on their legs.
- The snowspeeder is a ride, and tripping an AT-AT with its tow cable is a
  quest with tested rules and an ending.
- Within budget on every tier.

## Non-goals

- The galaxy war sim: who holds Hoth stays its choice. If the Hutts hold
  it, their men are models.
- Other worlds’ blobs. The resolver change lands for all; the policy is
  switched on for Hoth only. The `mercenary` and `droid` models help every
  world that has them.
- Hoth’s ground colour, flora and grade (the living-layer lane’s).
- Voice lines. New people’s lines go into the site’s `says`; nothing plays
  an unrecorded voice.
- Removing `figures.js` or the built prop humanoids: other worlds still use
  them.

## 1. The models-only cast (Phase 1)

### 1.1 The policy

A site gets one new key, `cast: 'models'`. `sites/ice.js` sets it on
`hoth`. `createActors` (`actors.js:474`) takes `cast` from the scene and
passes it to `anyFigure` as `{ only: true }`. The ground war’s
`createFigures` (`ground/groundFigures.js`) takes the same flag from the
site, as do the rides.

Under `only`, `anyFigure` is:

```
walker(kind) ?? crew(kind) ?? model(kind)           // as today
  ?? (retry once)  crew(kind) ?? model(kind)       // loadGlb already drops a failed url from its cache
  ?? standIn(kind)                                  // STAND_INS: a model of the same silhouette
  ?? null                                           // the actor stays hidden; it still talks and quests still find it
```

`buildFigure` and `propFigure` are never called. Without `only`, nothing
changes for any other world.

### 1.2 Stand-ins

`catalog/standIns.js`, plain data, tested: `STAND_INS[kind] → kind`, every
value a kind with a model row. Hoth’s:

| kind | stand-in |
|---|---|
| `rebel`, `rebelpilot`, named Rebels | `hothtrooper` |
| `hothtrooper` | `rebel` |
| `snowtrooper` | `stormtrooper` |
| `veers` | `officer` |
| `lukehoth`, `hanhoth`, `leiahoth` | `luke`, `han`, `leia` |
| `droid`, `twoonebee` | `r2d2` |
| `mercenary` | `rodian` |
| `wampa`, `tauntaun`, `probe`, `atat` | none (a creature or machine has no near likeness; it stays hidden) |

### 1.3 The two missing kinds

- **`droid`.** A catalogue row with its own `url` (`modelUrlFor` reads
  it): the `r2d2` file, `machine: true` so it glides, not walks.
  `catalog/people.js`. Every world’s astromechs become R2 at once; Phase 2
  gives Hoth’s generic ones two coloured variants.
- **`mercenary`.** A `CREW` row (`crewList.js`) on the existing crew
  files, taking faces in turn: `rodian`, `aqualish`, `greedo`, `bith`,
  `gamorrean`. Every world’s Hutt enforcers become Jabba’s men at once,
  rigged, armed as the ground war arms any crew figure (`universe/gunplay`).

### 1.4 The ground war in Hoth’s kit

`site.ground.uniforms` (optional), a map from side to kinds:

```js
uniforms: { empire: ['snowtrooper'], rebel: ['hothtrooper'], hutt: ['mercenary'] }
```

`kindFor(side, rand, uniforms)` (`troops.js`) takes it before
`KINDS_OF_SIDE`; `population.js` passes `site.ground?.uniforms`. A world
without it is as today. `sideOfKind` already knows `snowtrooper` and
`hothtrooper` (`standing.js`), so friend and foe are unchanged.

### 1.5 Luke in the cave

The boxes go from `wampacave`; the prop keeps the ice, the icicles and the
saber (its `signal('saber')` still hides the saber). Luke becomes a life
entry in the cave: `{ kind: 'luke', id: 'hungluke', at: <the cave’s own (0, −10)
in the world’s frame>, still: true, hang: 4.9, ... }`. `hang` (new, `actors.js`): the holder is
turned upside down about its own middle and raised so the feet meet the
roof at that height. The quest’s saber step adds `{ hide: 'hungluke' }` to
its `end`, as the probe quest already hides its droid. Phase 2 swaps `luke`
for `lukehoth`.

### 1.6 The far walkers and the flying speeders

- `atatfar` (`props/ice.js:943`) draws the `atat` model, cloned, walked on
  its own `Walk` clip at a slowed rate, where today it builds a walker of
  boxes (`model: false` in the site). Three clones of a loaded file: no new
  download.
- `speederflight` (`props/ice.js:900`) flies clones of the `snowspeeder`
  model on its ring, where it builds one today.

Both fall back to nothing, not to the built ones, when the model isn’t
there.

### 1.7 Proof

- **`sites/ice.test.js`** (beside `ice.js`): every kind in Hoth’s `life`,
  zone `life`, `rides`, the assault’s sides, `ground.uniforms` and the
  `atatfar`/`speederflight` things resolves to a walker, a crew row or a
  catalogue row, and the file it names exists under `public/`. None is in
  `FIGURES` without one. Every `STAND_INS` value has a model.
- **`actors.test.js`** additions: with `only`, a kind with no model gives
  `null`, not a built figure; a failing loader is called twice, then the
  stand-in is tried.
- **A mark on every built figure.** `buildFigure` and `propFigure` set
  `model.userData.built = true`, so a built figure can be found in any
  scene without guessing from its geometry.
- **`scripts/hoth-check.mjs`** (a probe, as `galaxy-check`): lands on Hoth
  at low and high, walks into Echo Base, starts the assault, and fails if
  any object in the scene has `userData.built`, or if any person’s figure
  is missing after 30 s. It prints the per-kind table
  above. Run before every Hoth PR; the PR body carries its output.

## 2. Hoth’s cast (Phase 2)

Made with `scripts/meshy-galaxy.mjs` (a new `HOTH` list in it), rigged on
Meshy’s skeleton so they take the crew’s idle, walk and run, compressed into
`public/models/galaxy/crew/`, credited `meshy/<name>`:

| name | who | where on Hoth |
|---|---|---|
| `rieekan` | a grey-haired general in a Rebel officer’s parka | the command centre (replaces the `rebel` there) |
| `torynfarr` | a young controller with a headset, Rebel grey uniform | at the console |
| `leiahoth` | a young woman in a white quilted snowsuit, braids round her head | the command centre, beside Rieekan |
| `hanhoth` | a scruffy pilot in a blue parka with fur hood, gloves | the hangar, then the shelter after the quest |
| `lukehoth` | a young pilot in a tan snow parka and goggles | hung in the cave; in the bacta tank after |
| `veers` | an Imperial general in a grey uniform and black cap | beside Vader at the walkers’ line |
| `twoonebee` | a slim medical droid, grey, with a transparent chest | the medical bay (still, not rigged) |
| `astromech2`, `astromech3` | an astromech, red-domed; an astromech, orange-trimmed | the hangar and the landing (still) |

Plus two rigs of existing models (`rigurl`, 5 each): the `wampa` and the
`tauntaun`, so they stride on clips. If Meshy’s humanoid rig does not take
the tauntaun (a biped with a tail and a long neck), `legRig.js`’s found
legs walk it instead, as the statue people walk today.

Chewie is the cockpit’s model (`crewList.js` `chewie`), already rigged.

## 3. The snowspeeder and the tow cable (Phase 3)

- **The ride.** `rides.js` gets `snowspeeder`, on the airspeeder’s flying
  movement (`walker.js`’s `fly`), its own numbers: top 46, alt 7, floor 3,
  the `snowspeeder` model, the gunner’s seat empty. Two parked by Echo
  Base’s mouth become rides.
- **The harpoon.** On the snowspeeder, fire (F) is the harpoon. It hits an
  AT-AT within 30 m ahead and below; the cable is drawn from the speeder’s
  tail to the walker’s near leg, a catenary of 24 points.
- **The wrap.** `missions/towcable.js`, pure, tested: given the speeder’s
  path round the walker’s legs, the cable’s angle swept about the legs’
  middle while within 4–14 m of it and under 12 m up. Three full turns
  (6π) trip it. Leaving the band for more than 2 s, or flying more than 40 m
  off, cuts the cable. Turning back on yourself unwinds it.
- **The fall.** A tripped walker plays its fall: it pitches toward the
  side the cable pulls, over 2.6 s, to the fallen walker’s pose (roll 1.45,
  sunk 3, as the `walker` place), and lies there, smoking, a solid.
- **The quest.** “Tow cables” (`sites/ice.js` quests): given by a Rogue
  Group pilot at the landing; steps: take a snowspeeder, harpoon a walker,
  wrap it three times, bring it down. Achievement `towcable`. Lines from the
  film’s famous calls, short, as the site’s quests already use them.

## 4. Echo Base alive (Phase 4)

- **The command centre**: Rieekan, Leia, Toryn Farr at the scopes; Leia’s
  “Prepare for ground assault” chain of lines; C-3PO fussing.
- **The medical bay**: a `bacta` prop (a glass cylinder of green water, a
  breathing mask, bubbles), `lukehoth` floating in it after the rescue
  quest; 2-1B beside it; the medic’s lines.
- **The hangar**: Han and Chewie by a snowspeeder, arguing over a
  hydrospanner.
- **Polish the probe flagged**: the plain white trench slabs (`snowtrench`)
  get a cut floor, sandbag-coloured parapets and duckboards; the blank
  crate cubes get the hothcrate model’s material.

`props/ice.js` is 1,048 lines (over 800). Phase 4 first splits it, as the
Naboo lane split `props/core.js`, into `props/ice/` behind a barrel
(`index.js` with the same `PROPS` and `SCATTER`), builders moved verbatim,
before/after shots byte-equal for still things; then adds `bacta` there.

## 5. Budget and cost

- **Credits** (account 3): 6 rigged people × 44 = 264; 3 still droids × 39
  = 117; 2 rigs × 5 = 10. **391 credits**, 2,491 left.
- **Download**: each crew GLB is 0.3–0.7 MB (the existing ones). Hoth adds
  about 4 MB at high, loaded when near (the zone’s on entering it). The site
  stays under `WORLD_MB`; Phase 2 updates it.
- **Draws**: the far walkers and speeders share their geometry with the
  near ones. The ground war’s pool already caps soldiers by tier.

## 6. Error handling

- A model that fails twice: its stand-in, else hidden. A dev-only
  `console.warn('[hoth] no model for', kind)` names it once.
- A hidden actor keeps its brain and its place, so `find` and a quest step
  that names it still work. The plan checks that talking to one works
  without a figure, and makes it so if it does not: a quest must never
  stall on a missing file.
- Meshy refusals (IP filter) at the image step: the script’s `SOFT` look,
  as it already does; failing that, the stand-in stays and the row waits.

## 7. Phases and PRs

| PR | Phase | Holds |
|---|---|---|
| 1 | Models-only cast | §1 whole: `cast`, stand-ins, `droid`, `mercenary`, uniforms, Luke hung, far walkers and speeders as models, the test, the probe |
| 2 | Hoth’s cast | §2: the Meshy people and rigs, placed in the site |
| 3 | Tow cables | §3: the ride, the harpoon, `towcable.js`, the fall, the quest |
| 4 | Echo Base alive | §4: the split, the bacta tank, the people placed, the trench and crate polish |

Each PR: `npm run lint`, `npm test`, `npm run build`,
`node scripts/health.mjs --check --skip build`, `scripts/hoth-check.mjs`
at low and high, before/after shots, the trial-merge against every open
branch, then merged.
