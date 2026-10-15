# Invincible world, part 2: seen, alive, with a story

Date: 2026-10-07. The ask, in the owner's words: the Invincible world “is hard to see, has bugs, and nothing to do and needs better NPC AI, missions, everything”. The references given were igloo.inc and bruno-simon.com: worlds that read at a glance, feel good to move in, and always have something next to do. Merge to main as it is built, one pull request per part.

Part 1 is `2026-10-05-invincible-world-design.md` and its hand-off `docs/superpowers/HANDOFF-worlds.md`: the city, the flying, space, the Flaxans, Dad's rings, the title cards and the rescues. This part does not restructure any of it. It fixes what is wrong, makes the city legible, gives the people brains, and puts a season of missions on top of what exists.

## What is wrong today (seen in headless Chromium on 2026-10-07)

Screenshots: `OUT=… node scripts/inv-world-check.mjs spawn street downtown streetnight high porch`.

1. **Mark is hard to see.** His suit is dark blue and black. At noon he is a small silhouette against grey streets; at night he vanishes against the road. Nothing in the scene says where the player is.
2. **Noon is flat.** Every tower's windows are black holes, the sun is weak, the streets and walls are one grey. There is no depth cue beyond fog.
3. **From high up the city is murk.** At 1,400 m the land is a dark blur with no landmark readable; the player cannot tell where to go.
4. **The HUD fights itself.** The `FLY, MARK.` title sits over the compass; the compass's place labels (“Burger Mart”, “Guardians' hall”) sit under the Noon and Controls buttons; four yellow buttons share the top edge with the compass and the prompt.
5. **The time label can lie.** The scene's time of day and the HUD's time button come from two places (`api.setTime` and React state); the dev hook sets one without the other. The fix is one source of truth, so a mismatch cannot happen in the game either.
6. **Nothing tells you what to do.** Dad's rings, the cards and the rescues exist, but nothing points at them: no objective, no marker, no distance, no story.
7. **The people are furniture.** Everyone stands where they were put and turns to look. Eve flies a fixed circle. Omni-Man hangs in the air for ever.

A bug sweep is the first task (see Testing): what is listed here is what one session saw, not all of it.

## Decisions

- **Models.** The owner asks for better, better-textured models, in one cohesive style, made with Meshy, the PC's gen3d runner, or Sketchfab. Section 8 is the style and the pipeline. Nothing is fetched at runtime; models are committed under `public/models/invincible/` and credited in `src/data/modelCredits.json`.
- **Rules apart from drawing**, as everywhere on the site. New pure modules, each tested: `brains.js` (the crowd), `companions.js` (Eve and Dad), `foes.js` (the villains), `missions.js` (the story and the side calls), `hud.js` (the layout rules the HUD cannot get wrong). The drawing goes in `npcs.js`, a new `villains.js`, `challenges.js` and `scene.js`.
- **One step engine for missions**, data driven, modelled on `galaxy/surface/quests.js` (`start`, `feed(progress, quest, event) → { progress, out }`) but with flight's step kinds. Dad's rings, the title cards and the rescues keep their modules (`quests.js`); missions wrap them with events.
- **No multiplayer, no interiors, no runtime move** in this part. The world stays on the HQ engine, not `src/runtime/`. These are the hand-off's open items and stay so.

## 1. Seeing it

### Mark
- His materials get a Fresnel rim in `onBeforeCompile` (after `lib/three/facade.js`'s pattern): a cool blue-white edge, strength 0.35 at noon, 0.7 at night, so his outline reads against anything.
- A spotlight rides the camera rig and points at him (range 12 m, angle 0.5, intensity 0 at noon, 6 at dusk, 14 at night, warm white); it lights him and a disc of ground under him. It is the only light that follows him.
- The camera, hovering and standing, sits closer: distance 5.2 m (was wider), 0.35 of the screen height above his feet, so he is a third of the frame tall. At speed the pull-back is unchanged.
- The suit's yellow stays the HUD's yellow (`#f5c518`), the one accent the whole section shares.

### The city
- Noon: sun intensity 3 → 4.2, fill 0.22 → 0.3, the sky's env 1 → 1.15; facade windows at noon reflect the sky (a lighter pane tone with a 0.25 reflection) instead of black; the facade's lowest two storeys keep the street colour from the bake.
- Dusk and night keep their looks, with the window lights raised 20 %.
- Aerial perspective: fog colour is sampled from the sky at the horizon for each time, not a fixed tint, so far towers fade into the sky instead of into grey.
- From height: the land's streets stay drawn to 2 km (the shader's line widths scale with distance up to 2×), the river and the coast get a 1-pixel bright edge, and the five places get a landmark beacon (a thin vertical light, 400 m tall, faint at noon, bright at night) that is visible from 3 km.
- The night sky keeps its stars; the ground under the player gets the spotlight above, so he is never on black.

Measured, not eyeballed: `scripts/inv-world-check.mjs` gains `--metrics`, printing for each shot the mean luminance of the middle band of the frame (rows 35–75 %) and Mark's contrast (the mean luminance of the 60×90 px box round him against the ring 20 px outside it). Targets: band luminance 0.30–0.65 at noon, 0.12–0.35 at night; Mark's contrast ≥ 0.18 in every shot. The numbers go in the hand-off.

### The HUD
`hud.js` is pure and tested: it decides where things go.
- The title shrinks to a chip (`INVINCIBLE · THE GRAYSONS' CITY`) 2.5 s after the first input, or at once when a mission starts.
- The compass's labels are laid out by `layoutCompass(marks, width)`: marks closer than 72 px are stacked on a second row, and no label is drawn in the 220 px the buttons occupy at the right edge. Marks beyond the strip are clipped with an arrow.
- The four top buttons become one `Menu` button (time of day, controls, other players, Think, Mark!) and a time chip showing the current time name. The chip is the only place the time is read from: `time` lives in `InvWorld`'s state, `api.setTime` is called from an effect on it, and the dev hook sets state.
- An objective line under the compass: the mission's step text, the distance to its marker in metres (km above 1,000), and the marker's heading on the compass in the mission's colour. A 3D marker (a chevron that scales with distance, min 24 px on screen) sits over the target.
- The minimap: 200 px on desktop (was smaller), 140 px on phones, with the objective marker and the mission's route.
- Speed reads km/h and Mach as today, plus the zone (`City`, `Sky`, `Space`).

## 2. Bugs

The first task is a sweep, with these checked and fixed where they fail (each fix with a test when it is in a rules module):

- Tab hidden for a minute and back: no tunnelling, no NaN speed, no sound burst. (`dt` is clamped at 0.05 s in `InvWorld`; confirm `stepQuests`, `stepFight` and the NPC update also clamp or tolerate it.)
- Resize and device-pixel-ratio change: the HUD and canvas stay aligned; the minimap stays round.
- WebGL context lost: the cards fallback shows; the page below still works; no loop keeps running.
- Keys held across a blur: cleared (exists); the touch stick after a cancelled touch: cleared.
- Corrupt `localStorage` for `tp-inv-world-at`, `-time`, `-quests`: the world starts at the spawn, noon, nothing found. (`newQuests` tolerates bad input; the position read must too: a saved position inside a building or under the land is rejected.)
- A saved position above the sky's top (y > 9,000) puts him back in the city, not in a stuck state between zones.
- Boost into the river at speed: a splash event and a stop at the surface, not a fall through.
- The rescue beacon when the faller is caught and the hero is in space: no stray beacon.
- Eve stopped by the hero: she resumes when he leaves.
- Time label and scene time agree (section 1).
- `npm run lint`, `npm test`, `npm run build`: clean before and after.

## 3. The people (`brains.js`, `npcs.js`)

Every person on foot has a brain: `{ state, t, home: [x, z], at: [x, z], yaw, target, fear }`, stepped by `stepBrain(b, sense, dt, r)` where `sense = { hero: [x, y, z], heroMode, heroSpeed, slam: [x, z] | null, fight: boolean, time: 'noon' | 'dusk' | 'night' }` and `r` is a seeded random (`lib/seeded`). States and the rules between them:

- `idle` (weight shifting, looking about), `chat` (in a pair or group, turning to each other), `wander` (walks the pavement from `traffic.js`'s lines, `WALK` off the street centre, at 1.3 m/s, 6–20 m, then idle), `look` (turns to the hero within 30 m), `wave` (within 15 m when he hovers or lands; 3 s), `gather` (he lands within 25 m: walks to 4–8 m from him, faces him, phone up; leaves after 12 s or when he takes off), `flee` (a slam, a punch or a bolt within 40 m: runs away from it along the pavement at 4 m/s for 6 s, then `idle` with `fear` decaying over 20 s; a scared person does not `gather`), `cheer` (the fight is won within 80 m: 4 s).
- Time of day changes who is out: at noon the counts in `npcs.js` as today; at dusk 70 %; at night 35 %, and no one on the school steps.
- Groups: the plaza's six and Burger Mart's three are groups with a shared spot; `gather` and `flee` move a group together within 2 m of each other.

`npcs.js` keeps its placement and drawing, and poses each person from the brain's state: `idle`, `walk`, `wave`, `talk`, plus two new poses in `people.js`: `phone` (one arm up, the head tilted back) and `run`.

Traffic already stops when he lands in the road; cars within 60 m of a fight now reverse away for 3 s, then are recycled by `stepTraffic`'s pool (a `scare` entry, which exists).

## 4. Companions (`companions.js`)

Pure: `stepEve(e, sense, dt)` and `stepDad(d, sense, dt)`. `sense` is section 3's plus `lesson` (on or off), `mission` (the current mission id or null), `foes` ([x, y, z] of the live foes).

Eve: `patrol` (her loop, as today), `intercept` (he hovers or stands still within 300 m of her for 4 s: she flies to 6 m beside him, says a line), `escort` (he flies off while she is beside him: she holds 8 m off his left for 40 s, then peels back to `patrol`), `fight` (a fight is on within 400 m: she flies to it and knocks one foe every 8 s; the foe's `ko` event names `eve`), `talk` (E within 6 m: a line, and she waits). She never leads a mission; she helps.

Dad: `watch` (over downtown, as today), `lesson` (Dad's rings are on: he flies 50 m behind and 20 m above Mark, and says one of five lines at each ring: encouragement at the first three, impatience after 90 s), `home` (at dusk and night he stands on the porch beside Debbie; E there starts mission 7 once 1–6 are done), `spar` (mission 7's flight: he flies ahead through four points over the city at 60 m/s, waits at each until Mark is within 20 m).

## 5. Villains (`foes.js`, `villains.js`)

Pure rules in `foes.js`: a foe is `{ id, kind, p, v, yaw, hp, state, t, target }`; `stepFoes(foes, hero, input, dt, world) → { foes, ev, push, stun }` with the same shape as `stepFight`, so the HUD's handling (`push`, `stun`, `ko`, `hurt`) is shared. The Flaxans move into this module unchanged in behaviour (`fight.js` becomes the Flaxan kind's rules; its tests keep passing).

Kinds:
- `flaxan`: as today.
- `flaxanElite`: twice the hp, bolts in threes, 16 damage.
- `mauler`: on the ground, 2.6 m tall. States `approach` (runs at Mark at 8 m/s when he is on the ground or under 6 m up), `swing` (within 3 m: a swing every 1.4 s, 18 damage, knocks him 10 m), `throw` (he is 6–60 m away and above 6 m: picks up the nearest car (traffic's pool; the car vanishes) and throws it at 35 m/s, 22 damage on a hit; a thrown car can be punched away), `stagger` (0.8 s after a punch; three punches or a ram over 45 m/s is a `ko`), `ko`. Two of them in missions 2 and 6.
- `seismic`: Doc Seismic, hovering 20 m up over the school's quad. States `quake` (every 6 s: a ring on the ground at 30 m/s that knocks anyone on the ground over, and shakes a student off the school's roof; the mission's rescue), `blast` (a cone at Mark within 40 m: 14 damage, pushes him 15 m), `stagger`, `ko` after 5 punches. Between quakes he drifts in a 30 m circle.

Drawing in `villains.js`: the Flaxans' drawing moves from `flaxans.js` (the file goes); Maulers and Doc Seismic are section 8's models, posed by the rig (`approach` and `swing` on `POSES.stride` and `POSES.punch`, Doc Seismic on `POSES.hover`). Thrown cars are `life.js`'s car geometry on a tumbling holder. The quake ring is a `fx.js` ring with a dust skirt.

## 6. Missions (`missions.js`)

### The engine
`MISSIONS`: an array of `{ id, ep, title, colour, giver, start: { place | npc }, intro: [[who, text]…], steps: [step…], done: [[who, text]…], achievement }`. A step: `{ type, text, marker?: [x, y, z] | { npc } | { foe }, time? }` with kinds:

- `reach` `at: [x, y, z], r` (fly or walk there; `y` null means any height)
- `land` `at: [x, z], r`
- `slam` `at: [x, z], r, speed` (land harder than `speed` there)
- `talk` `npc`
- `catch` `n` (rescues: `quests.js`'s `caught` events)
- `defeat` `kind, n`
- `race` `gates: [[x, y, z]…], r, time` (Dad's rings: `quests.js`'s `ring` events)
- `escort` `npc, to: [x, y, z], r` (stay within `within` m of them until they arrive)
- `protect` `what, time` (the GDA's hangar: `hp` stays above 0 for `time`)
- `through` `at: [x, y, z], r, speed` (fly through it faster than `speed`: the portal)
- `use` `id` (E somewhere: Think, Mark!)

`startMission(id) → progress`; `feedMission(progress, event) → { progress, out }` with events `{ type: 'at', p, mode, speed }`, `{ type: 'tick', dt }`, `{ type: 'talk', npc }`, `{ type: 'caught' }`, `{ type: 'ko', kind }`, `{ type: 'ring', i }`, `{ type: 'hurt', what, hp }`, `{ type: 'use', id }`, `{ type: 'land', speed, p }`; `out` carries `step`, `count`, `done`, `fail` with a `why`. `nextStory(doneIds) → id | null` gives the next episode. Progress is saved in `tp-inv-world-story` (`{ done: [id…], best: { [id]: seconds } }`).

### Season one
Each named for its episode, in order; each unlocks the next; any done one can be replayed from Cecil.

1. **It's About Time** (Dad, E at home or at Dad over downtown): the flight lesson. Dad's ten rings in order against 240 s, Dad flying behind. Done: `dadsrings` (exists).
2. **Here Goes Nothing** (Cecil at the GDA): the Mauler twins rob the bank downtown. `reach` the bank (a new place on the plaza's east side), a getaway truck pulls out (traffic's van, driven by rules at 22 m/s along the grid, the marker on it), `slam` within 15 m ahead of it to stop it, `defeat mauler ×2`. Achievement `maulers`.
3. **Who You Calling Ugly?** (Cecil): Doc Seismic at the school. `reach` the school; `catch 4` students he shakes off the roof while his quakes come; `defeat seismic`. Achievement `seismic`.
4. **Neil Armstrong, Eat Your Heart Out** (Cecil): up and out. `reach` the Moon's surface (`land`), `talk allen`, then `race` Allen back: three gates from the Moon to the top of the city's air in 150 s. Achievement `moonwalk` (exists as `moonw…`; reuse its id).
5. **That Actually Hurt** (Cecil, or the clock as today): the Flaxans, three waves: 12 flaxans; 10 flaxans and 2 elites; then `through` the portal faster than 120 m/s to shut it. Achievement `flaxans` (exists).
6. **You Look Kinda Dead** (Cecil): the Mauler clones at the GDA. `protect` the hangar (hp 100, a Mauler's swing on it takes 10) for 90 s while two Maulers at a time come up the river bank, six in all; `defeat mauler ×6`. Achievement `gda`.
7. **We Need to Talk** (Dad on the porch, dusk or night, after 1–6): `escort` Dad over his four points, `land` at home, `use thinkmark` (E scrolls to Think, Mark! as today; the game's result comes back as `{ type: 'use', id: 'thinkmark', won }`; either way the mission is done). Achievement `season`.

Dialogue is the site's own, short, in the characters' manner; no lines copied from the show beyond the four the page already has.

### Side calls (the radio)
When no mission is on and he is in the city, every 60–120 s one of:
- a **rescue** (exists);
- a **chase**: a car runs the grid at 28 m/s with a marker; land within 12 m ahead of it to stop it (`slam` or `land`), 45 s;
- a **race with Eve**: she offers it when beside him (`escort`): eight gates round downtown in 60 s, her ghost on the line at the best time;
- a **photo spot**: one of five framed views (the Guardians' hall from the plaza, the river at dusk from the middle bridge, downtown from the coast, home from the street, the city from 2 km): hover in its 20 m sphere facing within 20° of its heading and press E; a shutter, the HUD hides for the frame.
Each is a `missions.js` entry with `side: true`; the call shows on the radio line of the HUD and can be ignored.

### Starting and ending
A mission starts with a 2.5 s title card (the episode's number, its name, its colour, as the page's cards) over a camera that swings once round Mark; the HUD's objective fills. It ends with a card: time, the best, and the next episode's name; `fail` shows why, and `Again` restarts from its start point. `Escape` on a card closes it; `Q` abandons a mission (confirmed on the card).

## 7. Feel

- Mission start and end stingers (`lib/sfx`: `fanfare` and a new low `stinger`), the radio's crackle before a side call, a `shutter`.
- Hits land: 70 ms hit-stop on a punch that connects, the camera's shake scaled by the foe's size.
- A thrown car and a quake ring each have a sound and a dust ring.
- Reduced motion: no camera swing on cards, no hit-stop, no shake (`prefersReducedMotion`, as the page already does).

## 8. The models: one cast, one look

Today the cast is three looks: Mark is a Meshy model, Omni-Man and Thragg are two different Sketchfab artists', and everyone else is boxes on the humanoid kit. The part remakes the whole cast on one pipeline with one style line, so they read as one show.

### The style
The show's look: clean cel shading, flat bold colours in large regions, strong simple shapes, matte surfaces, nothing photoreal. Every figure prompt ends with the same `STYLE` line (a constant in `scripts/meshy-invincible.mjs`): “in the style of a modern American animated superhero series: clean cel shading, flat bold colours, strong simple shapes, matte surfaces, no photorealism; full body, A-pose, plain grey background”. Characters are described, not named (Meshy refuses names).

In the scene one material pass makes them sit together whatever made them (`people.js`'s `castMaterial(mesh)`): roughness 0.78, metalness 0, no environment reflection beyond 0.2, the Fresnel rim of section 1, and the colour map's saturation lifted 10 % so flat colours stay flat under the sun. The kit-built townspeople keep the same pass, so a Meshy Cecil and a kit passer-by share one shading.

### Who is made
Figures (rigged on Meshy's humanoid skeleton, posed by `lib/three/rig` as Mark is): `mark` (remade in the style), `omni-man`, `thragg`, `eve`, `cecil`, `debbie`, `allen`, `mauler`, `seismic`, and three townspeople (`civ-a`, `civ-b`, `civ-c`) for the crowd's variety. Props (unrigged): `bank` (mission 2's bank front, 40 m wide), `heli` (the news helicopter), `truck` (the getaway truck). Budgets: a figure ≤ 30 k triangles with a 2 K atlas and a `-sm` 1 K copy; a prop ≤ 15 k with 1 K. Credits: `src/data/modelCredits.json` for every one (the existing test keeps them honest).

### The pipeline, in order
1. **Meshy** (`scripts/meshy-invincible.mjs`, `MESHY_API_KEY` from the environment or `.env.local`): `ASSETS` gains every name above with its prompt, height and texture size; the steps `images → models → rig → fetch` as today; task ids in `scripts/meshy-invincible-tasks.json` so nothing is paid twice. About 23 credits a figure (3 + 15 + 5), about 250 for the cast; the session says in the hand-off how many it spent. The egress proxy allowed `api.meshy.ai` on 2026-10-07.
2. **The PC** (gen3d) for anything Meshy gets wrong twice: a GitHub issue labelled `gen3d`, the model's name as the title, the body with `what:` and the four-view image Meshy made (as the `image:`), as `scripts/gen3d/README.md` describes. The runner on the owner's desktop makes it and opens a pull request with the judging sheet; the session merges it and wires it in. The runner is not reachable from the cloud session except through those issues.
3. **Sketchfab** (`scripts/sketchfab-characters.mjs`, the owner's downloads) only for a prop no generator gets right, never for a character: a second artist's figure is what the part is removing.

### Judged, not assumed
- `scripts/inv-cast-sheet.mjs` renders every figure and prop in `CAST` at one scale under one light (`scripts/glb-shot.mjs`'s way), four views each, into one contact sheet `docs/gen3d/invincible/cast-sheet.webp`, committed at each change. Cohesion is judged on that sheet: the same line weight, the same saturation, the same height ratios (Mark 1.78 m, Omni-Man 1.95 m, Thragg 2.05 m, a Mauler 2.6 m, Doc Seismic 1.8 m, Eve 1.7 m, Cecil 1.8 m, Debbie 1.68 m, Allen 2.3 m).
- `cast.test.js`: every `CAST` entry names a file that exists under `public/models/invincible/`, a height, and a credit; every figure a mission or `npcs.js` names is in `CAST`.
- A remade figure replaces the old one only when its sheet is at least as good; the old file is deleted in the same commit.

## Out of scope
Interiors, online ghosts, the runtime move, voice lines, a second season, phone performance work beyond not making it worse (the low tier's triangle count stays within 1.5 M in town; new figures are posed only within 260 m as today).

## Testing

- Pure modules, tests first: `brains.test.js`, `companions.test.js`, `foes.test.js` (the Flaxan tests from `fight.test.js` move here unchanged), `missions.test.js`, `hud.test.js`. Each mission is walked end to end in a test by feeding events; every marker is on open ground or in the air; every step's `npc` and `kind` exists.
- `scripts/inv-world-check.mjs`: new shots `bank chase seismic maulers eveescort dadlesson gdasiege photo` and `--metrics`; the shots for the hand-off go in `docs/superpowers/shots/2026-10-07-inv-*.webp`.
- `npm run lint`, `npm test`, `npm run build` before each merge; no console errors in the shots.
- The hand-off `docs/superpowers/HANDOFF-worlds.md` is updated at each merge with what is done, the metrics, and what is left.
