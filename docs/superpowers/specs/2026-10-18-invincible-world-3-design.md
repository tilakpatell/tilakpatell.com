# Invincible world, part 3: the Viltrumite truth, the Guardians and the worlds beyond

Date: 2026-10-18. The ask, in the owner’s words: “architect a way to make the Invincible world amazing and better. Use inspiration from the lore and everything and making cooler features and different stuff.” This page is the architecture; the plan beside it (`docs/superpowers/plans/2026-10-18-invincible-world-3.md`) is the order of work. Merge to main as it is built, one pull request a task.

Part 1 is `2026-10-05-invincible-world-design.md` (the city, the flying, space, the Flaxans, Dad’s rings, the cards, the rescues). Part 2 is `2026-10-07-invincible-world-2-design.md` (legibility, brains, Eve and Dad as companions, the villains, the seven episodes). Where they were left is `docs/superpowers/HANDOFF-invincible-world.md`. This part keeps every one of their decisions: the world stays on the HQ games’ engine (`avengers/hq/engine.js`), rules stay pure and tested, drawing stays apart, nothing is fetched at run time, and no file goes over 800 lines.

## What the world is today, and what is wrong with it

An audit on 2026-10-18 read every file under `src/components/invincible/` against the handoffs. The short form; the numbers are in the code it cites.

**What it has.** A 6.4 km city (6,810 towers, 5,560 houses, 12,735 trees, `world/map.js`), flight from a walk to 260 m/s with a boom at 120 m/s (`world/flight.js`), space with the Moon and Mars (`world/orbit.js`), seven episodes and a radio of side calls (`world/missions.js`), three villains (the Flaxans, the Maulers, Doc Seismic; `world/foes.js`), Eve and Dad as companions (`world/companions.js`), a crowd with brains, traffic, a cast of fourteen Meshy figures with clips (`cast.js`), fifty-eight voiced lines, a four-chapter brawler (Think, Mark!), a viewer and the GDA files.

**What is wrong.**

1. **The season cannot be played through.** Episode 1 never counts a ring: `quests.js` sends `ring` events for rings 1 to 9 and reports ring 0 as `lesson-start`, while `missions.js` waits for ring 0 first, so the episode fails on time after 240 s. Episode 3 soft-locks when Doc Seismic is knocked out before the four students are caught (no more quakes, nobody falls, and the defeat step waits for a knockout that cannot come). Episode 6 soft-locks when a Mauler is knocked out during the hold (fewer than six remain for the defeat step and none spawn). The tests pass because `scripts/inv-world-check.mjs` and `missions.test.js` feed events to the rules directly instead of playing.
2. **Episode 6 is trivial** if Mark stays away: the hangar only loses health to a swing within 32 m of it and the Maulers only chase Mark.
3. **Any rescue counts for episode 3**: the city’s own rescues send the same `caught` event.
4. **Fights are shallow.** One punch, one lunge, a ram. Nothing can be grabbed, thrown, carried or blocked. The city takes no mark from a fight: a Mauler’s car bounces off a tower that stays whole.
5. **Episode 8 is a title card and nothing else.** The whole of season one builds to “Where I Really Come From”, and the world stops before it.
6. **Dead paths.** `invade('cecil')` and its voiced call are never used; `heli.glb` is never drawn; Eve’s `ghost` flag and the `dadHome` and `eveFight` line sets are never read. Forty-nine of the fifty companion and mission lines are unvoiced.
7. **Three files are over the 800-line rule**: `world/InvWorld.jsx` (1,305), `world/scene.js` (1,054), `thinkmark/rules.js` (1,065).
8. **Space is empty**: Allen and Thragg float by the Moon and Mars; nothing else is there.
9. **Three times of day, no weather, no consequence.** Collateral damage, the show’s whole argument, is not counted.

## Decisions

- **The world stays on the HQ engine.** The runtime move is still the handoff’s open item and still not this part’s: it would be a repair that changes no pixel and belongs in its own lane after this one.
- **Rules apart from drawing, tests first**, as everywhere. Every new behaviour is a pure module beside a test: `brawl.js`, `demolish.js`, `heroes.js`, `standing.js`, `clock.js`, `weather.js`, `guardians.js`, `dimensions.js`, `season2.js`, `offworld/*.js`, `boards.js`. Drawing goes in `ruins.js`, `storm.js`, `offworld/*Scene.js`, `panels.jsx` and the existing scene files.
- **Nothing waits for a model.** Every new figure is first a tinted body on the humanoid kit (`people.js`’s way), with its name over it, and a `gen3d` issue is opened for the real one with a reference picture and the style line from part 2. When a model lands, `cast.js` gains a row and the stand-in is replaced; no rule changes. Voice lines likewise: the lines are written and listed in a `voices` issue; until they are recorded the bubble shows the text.
- **Durable state is optional.** Leaderboards use `lib/durable/supabase.js`; with no client (a fork, CI, a visitor who has blocked it) the race ends with its time and no board, and the HUD says nothing about one.
- **No gore.** The show’s fight is bloody; the site’s is not. Damage is cracks, craters, dust, glass and a city that remembers. Nobody dies; a beaten foe is down, a beaten Mark gets up.
- **The order is: play through, then feel, then the story, then the worlds.** A visitor who arrives mid-lane must find a season that finishes.

## 1. The season plays through

Fixes, each with a test that plays the mission by moving Mark rather than feeding the rules:

- `quests.js` sends `ring` for every ring including the first, and `lesson-start` as well; `missions.js`’s step for episode 1 accepts either.
- A defeat step counts knockouts from the start of the mission, not from the start of the step (`progress.kos` by foe id, kept across steps). Episode 3 becomes: reach the school, then “catch four students and beat Doc Seismic” as one step with two counters, in either order. Episode 6’s defeat step wants six Maulers beaten in all, and `foes.js` spawns up to the total.
- Episode 6’s Maulers pick a target: the hangar when Mark is over 60 m away or 30 m up, else Mark (`foes.js`’s Mauler gets `target: 'hangar' | 'mark'`, tested). The hangar’s health is the mission’s clock.
- A rescue carries its source (`{ caught, source: 'mission' | 'city' }`); episode 3 counts mission ones.
- `scripts/inv-world-check.mjs` gains `--play <ep>`: it starts the mission and drives Mark through it with the sim hook (fly to, land, punch), never `api.feed`, and fails unless the mission reaches `done`. One run a merge for every episode touched.
- The dead paths go: `invade('cecil')` is wired to the radio as a side call (“Cecil: a portal, downtown, now”), which uses the recorded line; `heli.glb` draws the news helicopter in section 7; the unread flags and line sets are read or deleted.
- `InvWorld.jsx` splits by the repair recipe (`docs/health/RULES.md`, “A repair changes no pixel”): `InvWorld.jsx` keeps the component, the clock and the HUD; `input.js` the keys, pad and touch; `events.js` the mission `out` handling and the achievements; `online.js` the travellers. `world/scene.js` splits its space and villain parts out (`spaceScene.js`, `villainScene.js`). `thinkmark/rules.js` splits `bosses.js` out. Shots before and after, compared.

## 2. Hitting things: the brawl and the city that breaks

### The brawl (`brawl.js`, pure; `foes.js` calls it)

Mark’s moves, all on the keys he has (J or F or click punches; hold is a grab; Space in the air with a target below is a dive):

| move | input | what it does |
| --- | --- | --- |
| punch | tap | as today: reach 4.5 m, lunge to 18 m at 70 m/s, 0.35 s cooldown |
| grab | hold 0.25 s within reach | takes a foe (any size up to Mauler), a car or a lamp post; Mark carries it; flight continues at 0.7 speed |
| throw | release while carrying | at Mark’s speed plus 30 m/s; a thrown foe takes a hit on landing, a thrown car does 22 as today |
| carry-slam | carrying, fly into ground or a tower over 40 m/s | the thing takes two hits; a crater; the tower takes damage (below) |
| dive | Space over a target from 30 m up or more | drops at 90 m/s onto the target; damage scales with height, 1 hit at 30 m to 3 hits at 200 m; a crater at the landing |
| block | hold Shift on the ground facing a foe | halves damage; a blocked swing staggers the foe 0.8 s and opens a counter window of 0.6 s in which a punch counts double |
| ground pound | C on the ground near foes | a ring at 20 m/s to 40 m that floors small foes and staggers big ones; 4 s cooldown |

Each move has an event the world draws (`{ hit, kind, force }` through `hits.js`’s scaling), a 70 ms hit-stop as today, and an onomatopoeia card (section 8). Foes gain a `held` state and a `thrown` arc; `brains.js`’s crowd flees a carried car as it flees a thrown one.

### The city that breaks (`demolish.js`, pure; `ruins.js` draws)

Every tower and house already has a per-instance attribute block. `demolish.js` keeps a `Map` of instance id to damage 0 to 1 and the rules that move it:

- A hit on a tower’s face (Mark or a foe at over 150 m/s, a thrown car, a carry-slam, a foe knocked into it over 45 m/s, a Mauler’s swing) adds damage by the force (`hits.js`’s numbers over 400): a car 0.15, a slam 0.3, a Mach-speed Viltrumite 0.5.
- Damage is drawn by the facade shader from the instance attribute, not by new geometry: 0 to 0.3 cracks and dark glass on the hit face, 0.3 to 0.6 a bite out of the silhouette (the box’s top is lowered by up to a third, the instance matrix rescaled), 0.6 to 1 the top third gone, a smoking stub and rubble at the foot (an instanced rubble set, one draw).
- A hit throws chunks from `lib/three/fx/debris.js` (set `rock`, 24 to 60 by tier) and glass sparkle; dust from the existing crater effect.
- Collateral: every damage step adds to `standing.js` (section 7).
- It is saved: `tp-inv-world-ruins` holds `[id, damage]` for every damaged instance (capped at 400; the least damaged drop first) and the clock of the last repair. Repair is Cecil’s: every real-world day since the last visit heals 0.25 off every instance, and a tower under repair wears scaffolding (an instanced cage, one draw) until it is whole. The city remembers the fight and recovers, which is the story.
- Budget: the attribute is one float per instance (already the shape of `aHouse`); rubble and scaffolding are two instanced draws, capped at 400 each; debris is capped by `fxPlan`. Low tier gets cracks and the stub, no chunks.

## 3. Episode 8: Where I Really Come From

The season’s end, told in five beats, as a mission in `missions.js` with its own step kinds. It starts from Dad on the porch at dusk or night once episodes 1 to 7 are done (episode 7 ends with “We need to talk”; this is the talk). No gore, no train.

1. **The porch.** A panel sequence (section 8): Dad says what he is, the Viltrumite lines. Mom is inside; the lights are on. The player chooses nothing; the fight is the answer.
2. **The hit.** Dad hits Mark through the Graysons’ street at Mach 1: Mark is a projectile (`flight.js` gains `launched`: speed set, no control for 1.2 s, the camera chasing), through three houses that take damage, into the river. The player recovers in the water.
3. **The chase.** Dad is a foe with Omni-Man’s numbers (`foes.js`: 600 hp as Think, Mark!’s, Mach 2, a charge, a grab of his own, and he catches a thrown car and throws it back). Mark must land three hits across downtown; each one Dad answers by driving Mark into a tower (the tower breaks, section 2). The crowd flees for 200 m round; traffic stops.
4. **The people.** Dad throws a tower’s top at the plaza. Mark has 8 s to catch twelve civilians (the rescue rules, twelve at once, falling from the rubble’s arc) or to carry the chunk away (grab works on it; it is the largest thing he can hold). Saving all twelve or carrying the chunk ends the beat; fewer saved is a lower standing, not a fail.
5. **The sky.** Dad takes Mark up through the clouds to 8 km. The “what will you have after five hundred years” exchange over the city at night (panels over the 3D, the 3D still moving). Then the only input: nothing. Mark says “I’d still have you, Dad” (recorded). Dad leaves at 6 km/s straight up; the camera watches the contrail until it is a star. Mark falls, and the world catches him at the GDA pad with Cecil. The title card for episode 8 is found by playing it.

After it: Dad is gone from the porch and the sky (`companions.js`’s Dad has `gone`), the beacons are out for one play session, Mom’s lines change (four new ones), Cecil’s board gains season two, the city carries the ruins of beats 3 and 4, and Omni-Man becomes playable (section 4). The achievement is `truth`.

Measured: `--play ep8` drives every beat; the shot `ep8sky` reads the city from 8 km at night with the contrail; beat 4’s catch is tested as twelve rescues against a chunk’s arc.

## 4. Who you fly as (`heroes.js`, pure)

The figures with flight clips already in `cast.js` (Mark, Eve, Omni-Man, Thragg) become playable. `heroes.js` is one table and one function: `hero(id) → { flight: multipliers on flight.js’s numbers, fists: multipliers on brawl.js’s, power, voice, figure }` and `canPlay(id, saves)`. The Menu gains “Fly as”. Flight and brawl take the multipliers as an argument, never a global.

| hero | unlocked by | flight | power (hold F in the air) |
| --- | --- | --- | --- |
| Mark | always | as today | none; he is the baseline |
| Atom Eve | Eve’s race won | 0.8 top speed, 1.3 agility | **Transmute**: a pink construct where she looks: a wall 12 m wide that stops a thrown car or a bolt for 6 s, or, aimed at a damaged tower, 0.3 of its damage mended at once (section 2’s repair) |
| Omni-Man | episode 8 played | 1.6 top speed (Mach 1.2), 1.5 fists, the boom at 90 m/s | **Line-break**: 2 s at Mach 2 in a straight line; every window under the line within 60 m shatters (glass fx, 0.05 damage), the crowd is floored, and Cecil calls |
| Thragg | Think, Mark! won on Viltrumite | 1.8 top speed, 2 fists | **The Regent’s shout**: a ring to 40 m that throws every foe and car, 8 s cooldown |

Hero lines: Eve, Dad and Thragg already have voices; each gets four flying lines (“You know you can just float…” for Eve is reused). The HUD’s title chip reads the hero’s name. Online ghosts carry the hero id (`h`, one byte; an unknown id draws Mark). Missions stay Mark’s: starting one switches to Mark with a toast, since the story is his.

## 5. The Guardians of the Globe (`guardians.js`, pure)

Season two’s team, as companions and as a fight’s cavalry. Each is a row: name, tint for the stand-in, model id when one lands, a flight or ground mode, a signature. They live in the hall; two at a time join a big fight (a mission fight or any fight with four or more foes within 400 m), picked by what the fight needs (`pick(fight) → [a, b]`, tested).

| Guardian | mode | signature in a fight |
| --- | --- | --- |
| Immortal | flies | leads; hits like Mark; takes a hit for a civilian in reach |
| Rex Splode | ground | charges a car and throws it: a blast at the landing (`lib/three/explosions.js`) |
| Dupli-Kate | ground | four copies; each holds a foe for 2 s |
| Shrinking Rae | flies | shrinks to nothing and reappears behind a foe: a stagger |
| Monster Girl | ground | a monster for 12 s: three hits a swing, then a girl again, winded |
| Robot | flies (a drone) | marks the strongest foe on the compass; drones draw its bolts |
| Black Samson | ground | the suit: a shield wall round the civilians |
| Bulletproof | flies | the fastest; catches falling people before Mark can |

The hall gets an inside at last, the one interior in this part: a round room under the dome with the eight on their plinths, Cecil’s board moved there from the GDA door, and the door at (0, 21) a way in (`E Go in · Guardians’ hall`, the kit’s Exit the way out). It is the season’s hub. Each Guardian answers E with four lines. The first time all eight stand there, the achievement is `guardians`.

## 6. Season two: the villains and the worlds beyond

### Angstrom Levy and the dimensions (`dimensions.js`, pure)

A dimension is the same `map.js` world drawn another way: a seed for the palettes, a water level, a sky, a crowd rule and a ruin level. Four: **home**; **the burnt city** (ruins at 0.7 everywhere, night, no crowd, embers), where this world’s Mark lost; **the drowned city** (water at 12 m, the towers standing out of it, boats for cars); **the mirror city** (the map reflected in x, a cold palette, the crowd walking backwards). A portal is the Flaxan one with Angstrom’s green. The mission “Every version of you” (Cecil): Angstrom opens three portals round downtown; through each, in that dimension, a thing to do (a rescue in the burnt city, a race over the water, a fight with the mirror Mark, who is Mark’s own foe row), then home, where Angstrom waits at the hall, a six-hit foe who portals away when hit and comes back behind Mark. The achievement is `levy`.

Only the home dimension saves ruins or standing; the others are visited.

### The Sequids on Mars (`offworld/mars.js`)

Mars already exists in orbit. It gets a landing on the Moon’s pattern: the Martian base, the astronauts, and the Sequids as a swarm: one instanced draw of 800 to 2,400 purple bodies by tier that flock (`lib/ai/steer.js`, already pure) toward a host. The mission “The Martian mission” (Cecil, after episode 8): fly to Mars, find the four astronauts (compass marks), carry each to the ship (grab), and the swarm hunts them and Mark; the host, a Martian under them, is the thing to beat (12 hits; punching the swarm scatters it for 3 s). Then the ship home: a gate run over Mars at 600 m/s. The achievement is `sequids`.

### Battle Beast (`foes.js`)

The fight that nearly ends Mark. A boss at the GDA after the Machine Head call (“Cecil: Machine Head hired something. It is not from here.”): 14 hits, a mace, blocks Mark’s punches unless Mark has staggered him (block and counter, section 2, is the lesson), a leap that craters the pad. He leaves when beaten, “Unworthy.” The achievement is `beast`.

### Thraxa (`offworld/thraxa.js`)

Where Nolan went. A purple world in `orbit.js` past Mars (radius 8 km), a landing: Nolan’s tower, the Thraxans (insect people with nine-month lives, a crowd on the kit in violet), and Oliver, a child who flies. The mission “Here goes nothing, again” (Allen brings it, after episode 8 and the Martian mission): find Dad; he does not want to be found; then Anissa, Lucan and Vidor arrive (three Viltrumite foes with Omni-Man’s numbers at 0.7) and Mark and Dad fight them side by side, Dad as a companion again for one fight. It ends with Dad taken, and Oliver on Mark’s arm. Oliver comes home: he is on the porch after, with Mom. The achievement is `thraxa`.

### Talescria (`offworld/talescria.js`)

The Coalition of Planets. Allen opens a gate by the Moon (a ring, `galaxy/gateway.js`’s look, drawn here); through it, a station the size of a city with the council hall and the flags of the worlds. No fight: Thaedus and the council, Allen’s lines, the Viltrumite map (the viewer’s turntable with Viltrum on it), and a race against Allen round the station’s ring. It is where season two’s board lives once Cecil’s is full. The achievement is `coalition`.

Each offworld place is a module `offworld/<name>.js` (pure: the landing’s ground, its spawn, its people and their lines, its mission steps) and `offworld/<name>Scene.js` (drawing), loaded only when the orbit says Mark is within 30 km of it and disposed when he leaves, on the Moon’s pattern.

## 7. The city alive

- **A continuous clock** (`clock.js`, pure): a day is 24 minutes of play; noon, dusk and night become presets on it (the T key jumps to the next), and `scene.js`’s sun, fog, windows and crowd read the clock’s fraction instead of the three names. The chip shows the time as a clock. The save keeps the fraction.
- **Weather** (`weather.js`, pure; `storm.js` draws): clear, rain, storm, each 4 to 12 minutes of play, seeded by the day. Rain is a particle sheet round the camera and wet streets (the ground shader’s specular); a storm adds lightning every 8 to 20 s that lights the whole skyline for two frames and thunder from `sfx`, and a wind that pushes flight by 6 m/s. Flying in a storm at Mach speed is the loudest thing in the world.
- **Standing** (`standing.js`, pure): the city’s opinion. Saved lives add, collateral subtracts (damage from section 2 times 100, a crowd floored 5 each). It is a number from −100 to 100 with five names (Menace, Nuisance, Unknown, Hero, Invincible). Crowds cheer or boo by it (`brains.js` gains `boo`), the fans’ lines change at the ends of it, and after every mission Cecil’s debrief card shows the numbers (lives, damage, time, standing). It is the show’s question made a number the player can see.
- **The news helicopter** (`heli.glb`, at last): circles the biggest thing happening within 1 km, 120 m up; a chase, a fight, Mark at Mach speed. Flying within 20 m of it is a photo for standing.
- **Leaderboards** (`boards.js`, pure; `lib/durable/supabase.js`): a table `inv_times (board, user_id, name, ms, hero, at)` with RLS as the entities table has; a row an owner, the best only. Boards: Dad’s rings, Eve’s race, the chase, the Moon gates, Allen’s ring. The race end card shows the top ten and yours. No client, no board, no mention of one.

## 8. Presentation: the comic and the show

- **Panels** (`panels.jsx`): a mission’s intro and its beats are comic panels over the 3D (a strip of one to three panels, black borders, the show’s title yellow, halftone on the figure’s render from the viewer’s turntable), each a line, advancing on E or after 4 s; the 3D keeps moving behind. Every episode gets panels; episode 8 is told in them. Reduced motion shows them without the slide.
- **Onomatopoeia**: a hit puts a word in the air at the hit (`WHAM`, `KRAK`, `THOOM` by force, the show’s block capitals in yellow on black, a 0.4 s pop, one draw for all of them). Off under reduced motion.
- **Season two’s title cards**: eight more, found as season one’s are, at season two’s places (the hall’s inside, the Martian base, Nolan’s tower, the burnt city, Talescria’s council, the GDA pad after Battle Beast, the porch with Oliver, and one in the storm at 3 km).
- **The HUD** keeps the kit. New: the hero’s name on the chip, the standing name under the gauge, the weather glyph by the clock, and Cecil’s debrief card after a mission (the MissionCard’s frame).

## 9. Models and voices

Opened as issues the moment the stand-in is in, so the desktop can work while the code does.

- `gen3d` figures, the part-2 style line, each with a reference picture under `docs/gen3d/invincible/`: Immortal, Rex Splode, Dupli-Kate, Shrinking Rae, Monster Girl (both forms), Robot (the drone), Black Samson, Bulletproof, Angstrom Levy, Battle Beast, a Sequid, a Thraxan, Oliver, Anissa, Lucan, Vidor, Thaedus, Amber and William (for the school steps). Twenty.
- `gen3d` props: the rubble set (three chunks), the scaffold cage, the Martian base, Nolan’s tower, the council hall, the Coalition gate.
- `voices`: the forty-nine unvoiced lines; every new line in sections 3 to 7 (Mom’s four after, the Guardians’ thirty-two, Angstrom’s six, Battle Beast’s four, Oliver’s six, the three Viltrumites’ nine, Thaedus’s four, Cecil’s debriefs and calls, Allen’s Talescria lines). The text shows in the bubble until then.

## Testing

- Every rules module has its test beside it; every mission has a `--play` run that moves Mark.
- `scripts/inv-world-check.mjs` gains shots `brawl ruins ep8porch ep8sky hall levy mars beast thraxa talescria storm night24`, all with `--metrics`, Mark’s contrast at 0.18 or over in each.
- Budgets: low tier at 1.5 M triangles in town with ruins and rubble drawn; the handoff’s four over-budget shots come under it in task 2 (the part-2 target, not yet met). A phone holds 30 fps on the spawn street.
- Before every merge: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, the shots with no console errors.
- A tab hidden a minute, a corrupt save (`tp-inv-world-ruins` with an unknown id, `tp-inv-world-hero` unknown), a storm with reduced motion, a world with no Supabase client: each tested.

## Later, not this part

The runtime move; interiors beyond the hall; co-op fights with shared foe state; Conquest; the Viltrumite war; Think, Mark! chapters for season two; a phone frame-rate lane of its own.
