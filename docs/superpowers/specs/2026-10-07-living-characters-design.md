# Living characters: one animation layer and a body for every brain

The site has about a hundred kinds of character across its worlds, and they are animated a dozen ways. There is a shared library: `rickmorty/portal/meshyCast.js` blends idle, walk and run by speed and plays thirteen one-shots made with Meshy's animation library (`clips-<name>.glb`: drink, cheer, wave, happy, hit, fall, scared, shoot, dance, punch, taunt, shot, sitcross) on any figure on the Meshy skeleton, through `clips.js`'s `retarget`. `universe/locomotion.js` paces those clips to the ground a figure covers, turns its hips to walk sideways and backward, leans it into turns, tucks it in a jump. `lib/three/rig.js` poses any skeleton by where its limbs point. `lib/ai/` is the NPCs' toolkit (perception, utility, trees, search, steering, place picking, influence, squads). And most characters use only part of it.

An audit on 2026-10-07 read every character system, world by world (104 of them). What it found, most visible first:

- **Feet slide almost everywhere.** Only `locomotion.js` (the universe and galaxy party), the Bridge's Balrog, Weathertop's gallop and Shelob tie the stride to the ground. `meshyCast`'s pace is `0.75 + 0.45 × move` and each caller divides its speed by its own constant (/3, /5, /6.8, /2.4, a fixed 0.6). Strafing and backpedalling play the forward clip in Portal panic, the galaxy's hostiles, the Battlefront armies and Cybertron.
- **The action library is mostly dark.** Of the thirteen shared clips only punch, hit, fall and sitcross ever play, plus Rick's flask. Wave, cheer, happy, scared, shoot, dance, taunt and shot are never played by an NPC. Galaxy, universe, office, Albuquerque, Invincible, cockpit and Roll out figures stand on the same skeleton and can't reach them: `sharedClip` is private, `footScene`'s figures expose no `play`, and callers drive `c.mixer` straight and bypass the one-shot weights.
- **Library bugs with site-wide reach.** Playing the clip that's already playing hands it to `fadingOut`, which stops it (`meshyCast.js` play/stop), cutting duel punches, Morty's shot and a hit on a hit. A second `play` overwrites `fadingOut` and leaves the old action stuck at a part weight. A missing idle, walk or run leaves the weights summing under 1, so three.js blends toward the bind pose: `dimensions/stage.js` never loads run, so the C-137 hunters chase in their bind pose. The online ghosts' gait clock is `t + g.x` (`middleearth/towns/ghosts.js:150`, shared by ten worlds), so a traveller walking west freezes and one walking east runs several times too fast. The galaxy dodge roll is wiped by `place()`.
- **No brain reaches a body.** Every scene maps its brain's mode to one number, `move`. Search, suspicion and holding are never drawn; the galaxy's hostiles and the Battlefront squads, the best brains on the site, drive the worst bodies.
- **A one-shot replaces the whole body.** There is no upper-body layer, so a wave, a shot or a punch while walking freezes the legs and the figure slides. `rig.js`'s `pose()` stops every clip and resets the bones, so aim and reach can't lie over a clip. Only the Avengers compound's per-bone blend and `saberBody.js` layer properly, and both are one-offs.
- **Nothing turns its head.** Looking at you is the whole body yawing, often by a per-frame factor or a snap.
- **Deaths are planks.** A hit or a death tips the holder rigidly in the galaxy, the Battlefront, Total Rickall and the universe's troops; there are four death systems, and the trooper death clips on disk go unused.
- **Ambient life is thin.** No one waves when you come up, gestures while a line plays, scatters at gunfire or cheers a win. No schedules, no two people talking, no group walking together, no one using a bench or a bar. Albuquerque's cast is desktop-only statues; the Citadel's rally is forty frozen copies.
- **Lockstep and frame rate.** Unrigged props bob on the global clock, sits start at time 0, turns use a per-frame factor, Cybertron's stages update at a fixed 1/60.
- **Fragmentation.** The idle/walk/run blend is written four ways; there are about ten mixer set-ups and seven clip loaders; five kit pose systems ignore `rig.js`; `turnTo` is copied seven times in Middle-earth alone.
- **Legless stand-ins.** The Battlefront remaster import replaced the rigged stormtrooper, clone and super droid with unskinned meshes, so the most numerous NPCs on the site glide as statues. The universe uses built box troopers while rigged trooper GLBs sit unused. Middle-earth has no rigged figure at all.

This is the design for one animation layer every figure goes through, a seam from every brain to its body, the reactions and ambient life that make a world feel inhabited, and the order the worlds move onto it. It keeps the site's pattern: pure rules on plain numbers, seeded and tested in Node, drawn by a thin three.js layer.

## What it is not

- **Not a rewrite of any world's gameplay.** Every key, line, event, save key, achievement and dev hook works after as before. A brain's intent is kept; what changes is how its body shows it.
- **Not a big bang.** `meshyCast`'s figure (`c.mixer`, `c.act`, `c.update(t, move, hit)`, `c.play`, `c.stop`), `footScene`'s figures and `rig.js`'s `figure()` keep their shapes and delegate to the new layer, so a world nobody touches keeps working, and each world moves in its own pull request.
- **Not a change of art style.** Middle-earth stays its Overcooked-like toy look, Dot Matrix its boxes, Minecraft its blocks, the Rick and Morty cast its toon shading.
- **Not a dependency.** No animation middleware; three.js's mixer, the site's own retargeting, and code tested in Node.

## The animation layer: `src/lib/three/`

### `clipLibrary.js`: every clip, by what it is

`rickmorty/portal/clips.js` moves here (a re-export stays at the old path). One registry names each action by what it is and where it comes from:

- `CLIPS = { name: { url, take?, hips?, loop?, mask? } }`. `url` the GLB, `take` the clip's name in it (else its first), `hips` the hips' height it was made for (read from the file as `borrowClips` does when absent), `loop` whether it repeats, `mask` the bones it may move when played as a layer (`'upper'`, `'lower'`, `'full'`, default full).
- The sets, by source:
  - **Rick's** `idle`, `walk`, `run`, `sit` (`rick-*.glb`), for any figure without its own.
  - **Meshy's** thirteen (`clips-*.glb`).
  - **Quaternius UAL** (CC0; the pack is on disk, git-ignored, from PR #529's spike): `talk` (Idle_Talking_Loop), `sit.enter`, `sit.idle`, `sit.talk`, `sit.exit`, `crouch` (Crouch_Idle_Loop), `crouch.walk`, `interact`, `pickup` (PickUp_Table), `kneel.fix` (Fixing_Kneeling), `hit.chest`, `hit.head`, `die` (Death01), `aim.pistol` and `aim.pistol.up`/`.down`, `shoot.pistol`, `reload`, `jab`, `cross`, `roll`, `jump.start`, `jump.loop`, `jump.land`, `push`, `cast.enter`, `cast.idle`, `cast`, `sprint`, `walk.formal`, `torch`, `dance.ual` (Dance_Loop), `swim`, `swim.idle`, `drive`.
  - **The troopers'** `die.back`, `die.fwd`, `die.blown`, `kneel`, `taunt.trooper`, `hit.trooper` (`public/models/galaxy/troops/clip-*.glb`).
  - **Invincible's** embedded mocap (`talk.phone`, `look.around`, `land`, `charge`, `throw`, `stomp`, `down`), taken by name from the models that carry them and retargeted only onto figures of their own rig family.
  - **Meshy's library, later** (the credit track below): `strafe.left`, `strafe.right`, `walk.back`, `run.back`, `point`, `clap`, `salute`, `shrug`, `typing`, `phone`, `eat`, `laugh`, `angry`, `sleep`, `lie`, `sit.ground`, `lean.wall`, `look.around`, `block`, `dodge`, `kick`.
- `loadClip(name)`: fetched once, a promise. `forFigure(name, fig)`: a copy retargeted to the figure's hips and turned to face where its walk faces (`faceAhead`), cached per name and figure template. `preload(names)`: a world names its reactions' clips up front, so the first wave isn't late.
- `scripts/ual-bake.mjs` grows a set list: it bakes each UAL clip above onto Luke's rest skeleton (the retarget is `scripts/preview/ualRetarget.js`'s, proven to 0.01 on the mannequin) into its own `public/games/meshy/ual-<name>.glb` (9–34 KB each), full body, the mask applied at play time. `ual-saber.glb` stays as it is. Nothing ships the 6.7 MB pack.

### `locomotion.js`: feet on the ground

`universe/locomotion.js` moves here (re-exported from the old path). It already paces clips to ground covered (`strideOf`), turns the hips to walk sideways and backward, leans into turns and starts, tucks in the air, crouches on landing, flinches when hit and goes down at the knees. It gains:

- `strideOf` cached per clip and figure template (today it plays each clip through for every spawned figure: 96 mixer updates per trooper).
- A hand-off when a clip is missing: no run plays the walk faster, no walk plays the idle, so the weights always sum to 1 and nothing ever blends toward the bind pose.
- A `pace` fallback for figures without toe bones (the Sketchfab, High Moon and auto-rigged ones): a per-model `clipSpeed` (metres a second the clip covers at 1×), from the model's catalog row.
- Room for the layers above it: the base weights scale by `1 − over` while a full-body one-shot plays.

### `animator.js`: one body per figure

`createAnimator(model, { clips, hipsY, bones, unit = 1, seed, frame })` wraps a figure's mixer. Every rigged figure on the site gets one, through `meshyCast.make`, `footScene`'s `rigged`/`loadModel`/`rigScene`, and `rig.js`'s `figure` when its template has clips.

- `locomote({ speed, side, turn, air, hurt, knock, down, move })`: `locomotion.js`'s update. A caller that knows only `move` keeps today's look.
- `base(name | null, { fade })`: a looping base state in place of locomotion: `sit.idle`, `sitcross`, `crouch`, `sleep`, `drive`, `swim.idle`. Sitting down plays `sit.enter` into it and standing plays `sit.exit` out of it, when those clips exist. This replaces the three hand-written sit drivers.
- `play(name, { layer = 'full' | 'upper' | 'lower', loop, hold, fade, speed, at }) → Promise<'done' | 'cut'>`: a one-shot or a loop on a layer. Each layer has one slot. Playing the clip already in its slot restarts it where it is, never cancels it. Playing another fades the one before out, and a stale fading action is stopped first, so nothing is ever left at a part weight. `at` starts part way in (a crowd's cheer doesn't start on one frame).
- `stop(layer, fade)`, `queue([{ play | base | wait | look }…])`: steps one after another (stand up, turn, walk off), cut by any `play` on the same layer.
- `look(target | null, { weight = 1, yaw = 1.1, pitch = 0.6, rate = 6 })`: the neck and head turned toward a point in the world, clamped, eased, shared between the two bones (the neck a third), after the mixer. A target behind beyond the clamp turns the chest a little and stops. This is `office/people.js`'s look generalised to the bones `rig.js` already finds by role (Meshy, Mixamo, Unreal, Character Creator, High Moon).
- `idles({ fidgets: [name…], every: [lo, hi] })`: now and then, standing still and not in a fight, a fidget clip on the upper layer (the flask, a stretch, a look round), times drawn from the figure's seed.
- `update(dt, { lodRate })`: in this order, every frame: locomotion's weights and phase; `mixer.update(dt × lodRate)`; locomotion's bones (hips, lean, tuck, flinch, knees); the layers; custom layers a world adds (`saberBody`, `gunplay`'s aim); `look`; IK hooks.
- `seed`: every figure's clocks (its idle's start, its fidget times, its walk's start) come from it, so a crowd never breathes in unison.

**How the layers lie over the clips.** three.js's mixer averages every action on a bone by its weight and fills a total under 1 with the bind pose, so a partial layer can't be one more action on it. The base (locomotion, a base state, a full-body one-shot) is the mixer, its weights always summing to exactly 1. An upper or lower layer is laid over the mixer's result by hand, as `saberBody.js` lays the saber's body today: the layer's clip is sampled through its own interpolants at its own time, and each masked bone is slerped `w` of the way from where the mixer put it toward where the layer has it. That costs a dozen bone samples a layer a frame, needs no second copy of the base clips, and is the one layering method on the site already proven in play.

Masks for the Meshy skeleton: **upper** is Spine, Spine01, Spine02, neck, Head and both shoulders, arms, forearms and hands; **lower** is the Hips (turn only) and both legs, feet and toes. Other rigs map to the same roles through `rig.js`'s `ROLES`.

### `gait.js`: the figures without clips

A pure helper for the procedural families that can't take clips: Middle-earth's toy figures (`mapFigures.js` `pose()`) and its creatures, the office's people, Dot Matrix, `cast.js`'s shapes, `footScene`'s built figures, Mario, the Battlefront statues until they're rigged.

- `createGait({ stride, cadence: [lo, hi], seed })` → `step(dt, speed) → { phase, amount, run }`: the phase accumulated from distance over stride (never from absolute time, so changing pace never pops a leg), `amount` eased from 0 standing to 1 moving, `run` eased between walk and run. A pose function reads those instead of `t × 13`.
- `turn(current, want, dt, rate)`: eased yaw, by time not frame. The seven Middle-earth copies, `watchers.js`'s and the Citadel's per-frame `0.08` all become this.
- `breathe(t, seed)`: an idle's rise and fall at a per-figure rate and phase.
- A statue's sway: for a static model that has to move until it can be rigged, a step-in-time sway and bob from the same phase (feet hidden by the bob's timing), and a breath when still, so none is frozen and none glides at a constant height.

### `animBudget.js`: many figures, one frame

`createAnimBudget({ near, far, max })` → `rate(fig, camera)`: 1 near and in view; every second frame further off; every fourth far away; 0 (paused, last pose held) off screen. It replaces the Citadel's every-third-frame and `actors.js`'s every-fourth throttles, and lets crowds grow on a desktop while the device tier keeps phones in budget.

## The seam from brain to body: `src/lib/ai/`

Both modules are pure, seeded, three.js-free and tested in Node, as the rest of `lib/ai` is.

### `body.js`: what a step looks like

`bodyFrom(prev, next, dt, { table, unit })` → `{ motion, look, base, action }`. A brain's step is `{ x, z, yaw, mode, aim?, look?, events? }`, as every brain on the site can give it.

- `motion` from the displacement in the figure's own frame: `speed` along its facing, `side` across it, `turn` from the yaw's change, `down` and `hurt` from its state. Callers stop computing `move`; it replaces the Citadel's `walkTo` arithmetic, `actors.js`'s, `activity.js`'s, `assault.js`'s and `npc.js`'s.
- A world's `MODE_BODY` table says what each of its brain's modes looks like, with defaults every world gets:

  | mode | body |
  | --- | --- |
  | `hold`, `watch` | idle, looking at what it watches |
  | `suspicious` | stops, a half turn, stares at where it heard you |
  | `search` | walks, the head sweeping (`look` across the cone) |
  | `chase` | runs, looking at its belief of you |
  | `strafe`, `back` | hips toward travel, chest and aim at the target |
  | `cover` | `crouch` base, up to fire |
  | `flee` | runs, a look back now and then |
  | `talk` | idle, `talk` on the upper layer, looking at whom it talks to |
  | `use:<want>` | the want's advertised clip as a base or a loop |

- `look` from the brain's `look`, else its `aim`, else its belief of you within a range, else nothing.

### `react.js`: what happens to it

`createReactions(table, { rand })` → `on(event, ctx) → { clip, layer, hold, look? } | null`, with `utility.cooldown` and a chance per event, so a reaction is never twice in a row and a crowd's reactions spread out. The site's default table:

| event | reaction |
| --- | --- |
| `greet` (you come within a few metres, it knows you or talks) | `wave`, upper, looking at you |
| `say` (a line of its plays, voiced or a bubble) | `talk` on the upper layer for the line's length, looking at whom it says it to |
| `hit` | `hit.chest` or `hit.head` by where; on the upper layer while moving |
| `down` | `die.fwd`, `die.back` or `die.blown` by the hit's direction and force, else `fall`, else `die`; never the holder tipped |
| `gunfire` near, or a feared kind seen | `scared`, then its brain flees |
| `win` (its side took the post, the duel's over, the quest's done) | `cheer`, `happy` or `taunt` |
| `fire` | `aim.pistol` and `shoot.pistol` on the upper layer, or the world's own aim |
| `caught` (a watcher reaches you) | `jab` or the world's own strike |
| `alert` (a watcher sees you) | `point` once the credit track lands, else a sharp `look` and `hit.head`'s first frames as a start |

### The player

The player's figure gets the same animator and reactions: `hit` and `down` as above, `win` on a quest or a capture, `scared` when caught, each short, on the upper layer where it can be, and cut by any input, so control never waits on a clip. And an **emote** key: hold for a wheel of five (wave, cheer, dance, taunt, sit), tap to repeat the last. It goes into the input bindings as `emote` on `B`, checked free per world in the plan (where `B` is taken the next free of `Z`, `U`), and onto the wire: the ghosts' and peers' packets gain `emote` (an id and a start time) and `motion` (speed, side, turn), so other travellers see you wave and see your feet match your speed.

## Ambient and social life: `src/lib/ai/`

### `needs.js`: what people want

The galaxy's `surface/needs.js` generalised. A person has needs that rise over time (rest, food, company, work, a look at the view), each at its own rate. A place advertises what it gives: `{ id, at, need, slots, clip, base?, duration, face? }`: a bench gives rest with `sit.enter` → `sit.idle` and two slots; a bar gives food with `drink`; a droid gives work with `kneel.fix`; a stall gives food with `interact`. A person picks by `utility.pick` (the need's level, the distance, momentum, a little chance), reserves a slot, walks there, faces as the place says, plays its clip for the duration, and its need falls. A world's sky clock gives a schedule on top (`{ from, to, want }`): the Citadel's workers go to the factory by day, the cantina fills at night, the office sits at its desks from nine to five. Off by default; a world opts in with its places and schedule.

### `social.js`: people with each other

- **Conversations.** Two or three people with company to want meet, face one another a step apart, and take turns: the speaker plays `talk` and the others look at the speaker; the turns run seeded lengths; a laugh or a shrug now and then; then they part. A conversation in the way of your path makes room.
- **Groups.** A group walks together: a leader on its route, the rest following with `steer.js`'s follow and separate, side by side where the path is wide.
- **Making way.** A walker ahead of you steps aside (a danger slot along your heading in its context steering) instead of walking through you, and one you walk into plays a short shove reaction and a look.
- **Greeting.** One who knows you, or has a line, turns its head when you come within range, waves the first time, and watches you go.

### Perception for everyone

Your shots, explosions and a running crowd become stimuli (`perception.js`'s `world.stims`) in every world with civilians: a civilian that hears gunfire plays `scared` and flees from it, a stall keeper ducks, a crowd parts from a fight. Every world's ambient people read the world through `sense`, as its hostiles already do.

### Combat bodies

Every armed NPC aims and fires with its upper body (`aim.pistol` / `shoot.pistol`, or `gunplay.js`'s arms on a Meshy figure, as the player's are). One in cover crouches and rises to fire; a strafer's hips face its travel while its chest faces you; a death is picked by direction and stays down a moment before it goes. The token pools' `scale` follows the device tier, so a phone sees the same tactics with fewer shots in the air.

## The worlds, wave by wave

Each wave is one pull request (a big wave, one per world in it), merged on its own with its tests, checked in a browser and shown with shots in `docs/superpowers/shots/`.

### W0: the library's bugs

On `meshyCast`, with its first tests (`meshyCast.test.js`: play, stop, replay, weights): a replayed clip restarts rather than cancels; a new `play` stops a stale fading action; a missing clip hands its weight on; `update` takes an explicit `dt`. `scene.js`'s `need()` merges clip lists per name instead of first-ask-wins; `stage.js` and `visitors.js` load run. Shared clips are turned to face ahead. The ghosts' clock becomes a per-ghost phase accumulated from distance. The galaxy's dodge roll survives `place()`. The universe's troops normalise by `FOOT.run`, not their own speed, and go down through `down` instead of snapping flat.

### W1: the layer

`clipLibrary`, `locomotion` (moved, with the stride cache and the hand-off), `animator`, `gait`, `animBudget`, `lib/ai/body` and `lib/ai/react`, with their tests, and the UAL bake. No caller changes except the re-exports.

### W2: Rick and Morty and Star Wars, together, to the highest bar

The showcase. Both universes come up to the same standard in the same wave:

- **Portal panic**: the hero and the enemies on `body.js` (strafers' hips turn, no crab-walk); `shoot`, `hit`, `fall` and `cheer`; enemies die by `die.*` and lie a moment; the allies stop when they punch; Snowball's legs walk; the bosses' yaw eases.
- **The Citadel and Mortytown**: the cast sits through `base`, plays one-shots seated, looks at Rick with its head; the cops' alert, search and catch are drawn (`MODE_BODY`); the Day Care Mortys flee with `scared`; the walking loops become steered walkers with needs and a schedule (the factory, the shops, the council), groups and conversations, who make way for Rick; the rally crowd is promoted to live figures near the camera (`animBudget`), breathing, cheering on the election's beats; the council and clerks gesture when they speak; Rick plays clips on being seen, caught and winning.
- **C-137 and the dimensions**: the hunters run on their run clip; the street's visitors walk round Morty and the limo; the room people look at Morty while they talk to him and gesture as they speak; the sitters breathe out of step; Total Rickall's shot fall on `shot`; the stasis Ricks float without sipping; the regulars walk on high tier again.
- **The galaxy's surface**: the ambient crew on `locomotion` with motion (no sliding, no scissoring), needs at every site that can give them, conversations, greetings with a head turn, scattering at gunfire; the hostiles' modes drawn (strafe, cover crouch, search with the head, `?` over a searching head), firing with raised arms, dying by direction; the duellists' blades in their hands; the creatures stride-matched, no freezing mid-stride, the rancor on a walk; the party mate fights (aims, fires at your target, can be hit) and looks at what you look at; the dodge rolls; the speeder scouts sit; the peers' feet and emotes match. The Battlefront troopers sway in step until the credit track rigs them, then walk on the shared clips.
- **The Battlefront armies**: posture drawn (crouch in cover, advance in halves, retreat looking back), upper-body fire, deaths by direction, and the squads' frontline readable.

### W3: the universe on foot, the cockpits, the wire

The crews and troops out of the ship on the animator and reactions; the rigged trooper GLBs in place of the built box troopers; landing figures that turn and gesture while their lines play (the site's own figures' `look`, `wave`, `nod`, `shrug` finally called); the Avengers HQ heroes greet; the static landing figures breathe. The cockpit crews: Chewie's clip forward, `scared` in the cruiser in place of its hand-written panic, Walt and Jesse react to the RV. The ghosts and peers carry `motion` and `emote` on every world.

### W4: the `rig.js` worlds

`rig.js`'s `figure` builds an animator when its template has clips: `act` crossfades stride-synced (`clipsFor`'s swap); `pose()` becomes a weighted layer over the clips instead of stopping them; `look` through `ROLES`. Then **Invincible** (Mark's walk and run, the townsfolk's heads instead of turret turns, Eve's patrol as a `pick` that answers fights and waves, Allen's talk clip, Think, Mark!'s hover, fly, hit and cheer, the Flaxans' telegraph and tokens), **the Avengers** (the compound's cast greets and gestures, Spider-Man's walk within its rate, Smash Run's Chitauri fire, Infiltration's guards snap their heads on alert) and **Cybertron** (no idle↔pose pop, an aim pose standing, the area people breathe and talk, foot soldiers' real velocity and deaths, bosses taunt, charge and stagger, the stages on real `dt`).

### W5: the office, Albuquerque, the Caribbean

The office's seventeen and Albuquerque's fourteen take borrowed idle, walk and sit under their existing procedural passes (look, reach, typing), stride-matched, sitting down and standing up through `base`, breathing seated. Albuquerque's cast comes to phones at a lower count, looks at the car, and has needs on its sidewalks; Saul waves, Tuco taunts. Jack Sparrow answers the helm, the broadsides and the kraken.

### W6: Middle-earth

First, free: every toy figure on `gait.js` (distance phase, eased start and stop, per-figure seeds, a head that looks, the map hub's greeting brought to every town), the watchers' patrol and chase cadences split, an attack on a catch, the Nazgûl's recoil, Shelob walking home unreared, the followers off their conga line, the goblins fighting, one Gollum and one Balrog builder, the Shire's dogs on `watchers.js` (their `far` and `search` read at last), the sheep's walk in the rules.

Then, on the credit track: the humanoid cast rebuilt as **Meshy figures in the toy style** (big heads, chunky proportions, the films' costumes): Frodo, Sam, Merry, Pippin, Bilbo, Gandalf the Grey and the White, Aragorn and Strider, Legolas, Gimli, Boromir, Faramir, Galadriel, Elrond, Arwen, Théoden, Éowyn, Saruman, Butterbur, and the archetypes for townsfolk (hobbit, Bree man, elf, Rohirrim, Gondor guard) and foes (orc, Uruk-hai, Easterling, goblin). On the shared skeleton they get the whole library. The creatures (Shelob, the Balrog, horses, Gollum, trolls, the Nazgûl's cloth) stay procedural on `gait.js`.

### W7: the stylised rest

Mario (no pop between actions, a run matched to speed, eased turns for Goombas and Toad, the King's defeat on time since, the Chomp's tell), Dot Matrix (stride-matched, villagers who notice the hero), Minecraft's mobs when they're built (on `gait.js`), the Death Star's TIEs. Each keeps its look.

## The credit track

Meshy work spends credits; the balance on 2026-10-07 is 1, so this track waits for a top-up and nothing else waits on it. The user has agreed to the spend and to topping up as it runs out. Estimates at Meshy's prices (image 9, model 30, rig 5, clip 3):

- **Rig the Battlefront humanoids** (stormtrooper, sandtrooper, snowtrooper, scout, shore, death trooper, clone, B1, B2, Hoth rebel): about 10 × 5 = 50. The remaster meshes go up as models to Meshy's rigging; any that won't rig cleanly fall back to the older rigged Sketchfab files at their own paths.
- **Rig the Rick and Morty humanoid props** that should move (about 30 of the 113 C-137 figures): about 150.
- **Meshy library clips UAL lacks** (the list in the clip library above), made once on one Meshy figure and shared through `retarget`: about 25 × 3 = 75.
- **Middle-earth's cast**, Meshy end to end (concept image, model, rig, its own idle) for about 25 figures: about 25 × 53 ≈ 1,300.

Every Meshy step goes through the existing scripts (`scripts/meshy*.mjs`: images, models, rig, clips, fetch) and their task ledgers (`scripts/*-tasks.json`, `scripts/rm-models.json`), checks the balance before it spends, and is judged once (one look at the concept or the model before the next paid step) rather than through review loops.

## The quality bar

What "natural" means here, as checks:

- **Feet don't slide.** `scripts/anim-check.mjs` (new) opens a world in headless Chromium through its dev hook, follows each figure in view for a few seconds, and measures its planted toe's drift in the world while that foot is down: under 0.15 m/s for every figure on clips or `gait.js`, reported per figure.
- **No bind pose, no T-pose.** The animator's tests assert every bone's base weights sum to 1 in every state, including missing clips.
- **No lockstep.** A test spawns a crowd from seeds and asserts their idle phases spread.
- **Every reaction fires.** Each world's dev hook (`window.__universeDebug`, the galaxy's, the Citadel's) can trigger greet, say, hit, down, gunfire and win on a figure, and the check script reads back which clip played.
- **Nothing breaks.** `npm run lint`, `npm test`, `npm run build` and `node scripts/health.mjs --check --skip build` clean (Windows's known flakes re-run alone, CI the gate); `scripts/autopilot-check.mjs --only smoke` on the world's routes; the frame time on the mobile tier no worse than before with `animBudget` on.
- **It looks right.** Shots or a short GIF per world in `docs/superpowers/shots/`, taken in the built-in browser on the GPU, checked by eye against the fandom before the wave is called done.

## Tests

- `clipLibrary`: a registry entry resolves, a retarget scales the hips and keeps only turns, a cached copy is reused.
- `locomotion`: the existing tests, plus the stride cache and the hand-off (no run: walk faster; no walk: idle; the weights sum to 1).
- `animator`, on a synthetic Meshy skeleton in Node: replaying restarts and doesn't cancel; a second play leaves nothing at a part weight; an upper layer moves only upper bones and the legs keep the walk; `base` enters and exits through its clips; `look` clamps and eases; `queue` runs its steps in order and is cut by a play; seeded phases differ.
- `gait`: phase from distance (no pop when the pace changes), eased amount, eased turn by time.
- `body`: displacement to `speed`/`side`/`turn` in the figure's frame; a `MODE_BODY` row to its look and base; `look` priority.
- `react`: the default table, cooldowns, chance spread across a seeded crowd.
- `needs` and `social`: a person picks the right place and reserves a slot; slots never overbook; a schedule changes the pick; a conversation's turns alternate and end; a group keeps its spacing; a walker steps out of your way.
- Every world keeps its existing tests and adds its own for what its wave changes (a hostile's mode reaches its body; a sitter can play a one-shot; a ghost's gait follows its distance).

## Risks

- **Blast radius.** `meshyCast` feeds about twelve consumers; its figure's shape must stay as it is. W0 and W1 change no world's look except the bugs; every wave after checks each world it touches in a browser.
- **Retargeting across proportions.** Clips made on Luke's or Nimbus's proportions can sink a foot or turn a hand on a figure 2.8 m tall or 1.1 m short. The hips scale handles height; a clip that still looks wrong on a body gets a per-figure exclusion in the registry rather than a hack.
- **Meshy's own idle is restless** (the landing people's notes say so): calm idles come from UAL's `Idle_Loop` and `talk` where a figure stands to talk.
- **Toe bones.** Stride measurement needs them; figures without fall back to the catalog's `clipSpeed` or `gait.js`.
- **Determinism.** `body`, `react`, `needs` and `social` stay free of three.js and `Math.random`; the Infiltration guards must stay solvable, so their change is drawn, never decided.
- **Tests that pin files.** The office's and the wardrobe's tests assert their figure GLBs carry no clips; clips stay in their own files.
- **Payload.** Each UAL clip is 9–34 KB and loads on first use; a world preloads only its reactions'.
- **Shared refs.** Many sessions work in sibling worktrees and merge each other's branches; each wave is fetched onto `origin/main` right before it merges, never force-pushed (`-v2` if a branch goes stale), and main isn't protected, so the tests run locally before every merge.

## Done when

- `src/lib/three/{clipLibrary,locomotion,animator,gait,animBudget}.js` and `src/lib/ai/{body,react,needs,social}.js` exist with their tests, and `docs/architecture.md`'s "Where things live" names them.
- Every rigged figure on the site goes through an animator; every procedural one through `gait.js`; no world computes `move` by hand.
- Every world in W0–W7 has its pull request merged with the checks above green and its shots.
- The credit track is done to the balance the user funds, each item recorded in its task ledger.
- `docs/superpowers/HANDOFF-runtime.md` says what's on the layer, what's on the credit track and what's left, for the next session.
