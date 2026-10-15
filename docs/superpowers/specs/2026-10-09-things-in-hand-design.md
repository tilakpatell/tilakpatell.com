# Things in hand, and a word on E: one grip for every figure, the walk under it, the body's answer to the key

The site's rigged figures hold things five ways, and none of them is right in every world. Middle-earth's cast (`middleearth/cast3d.js` `hold`) takes the toy's built staff, sword, bow, axe, horn, tankard or carrot and attaches it to the Meshy hand bone at the hand's bind-pose world matrix with the item's rotation reset to zero: the item sits where the hand's origin was, not in the palm, keeps whatever tilt its builder gave it, and swings with the walk's arm so a staff ploughs the ground. The Rick and Morty wardrobe (`rickmorty/wardrobe/gear.js`) works a hand frame from the forearm's bind pose alone, a quarter of the way past the wrist, which is not where a palm is. The interiors' `inHand` (`world/interiors/people.js`) puts a glass a fixed reach down the forearm, and asks to be called only once the figure is posed. Portal panic sets the hero's gun by three hand-typed numbers (`portal/Portal3D.js`). Only the galaxy's guns (`universe/gunplay.js`) read the hand's own vertices for a palm frame and close the fingers round the grip (`universe/grip.js`), and that code is private to guns and lives in a world's folder.

Nothing gives an item a carry: no arm holds a staff upright while the legs walk, no wrist keeps a tankard level, no second hand takes a two-handed haft. The arm the walk clip swings is the arm the item is in.

The E key, which the HUD promises everywhere as "E Talk · Name", does nothing to a person in Middle-earth: its thirteen towns bind E to spots (doors, benches, the trail), and a person's lines play by walking up to them (`shire/rules.js` `nearCast`). Rick and Morty (`world/RmWorld.jsx` `act`, `world/npc.js` `heard`) and the galaxy (`galaxy/surface/scene.js` `act`, `actors.js` `say`) do answer E with a line and `react('say')`, each through its own route; whom E picks (the nearest, or the one you face), how far it reaches, and what the body does (a head turn, a wave, a turn of the body past the neck's range) differ by world and are untested.

And whether a model works at all, as a figure that walks and holds, is checked for the galaxy only (`scripts/galaxy-figures-audit.mjs`): Middle-earth's twenty-nine and Rick and Morty's cast have no audit that says each has hands with enough skin to grip, toes to pace its walk, and the three locomotion clips.

This is the design for one held-item layer every figure goes through, the carry over the walk, one rule for whom E talks to and what the body does when it's pressed, and the audit and browser checks that prove the models work, in Rick and Morty and Middle-earth first and then on the galaxy's many figures. It keeps the site's pattern: pure rules on plain numbers tested in Node, drawn by a thin three.js layer, each world moving on in its own pull request.

## What it is not

- **Not a change of any world's gameplay or art.** Every key, line, quest, save key and dev hook works after as before. Middle-earth stays its toy look; a town's story beat that plays on approach still does.
- **Not a rewrite of the guns.** `gunplay.js` keeps its grip, aim and kick; it imports the palm frame from the library instead of owning it.
- **Not new models or clips.** No Meshy spend, no desktop job is waited on. A figure the audit finds unfit to hold (no hand skin, no hand bone) keeps a stand-in: the item where its hand would hang, as `heldBlade` does today.
- **Not a dependency.** three.js, the site's own IK and rig code, tests in Node.

## The held layer: `src/lib/three/held.js`

### The grip frame, from the hand itself

`handFrame(points, axes, body, left)` and `handPoints(root, hand)` move out of `gunplay.js` into `held.js` (gunplay imports them; nothing else changes there). `gripFrame(model, hand, { left, forward, inward }) → { along, thumb, normal, mean, bind }`: the hand's vertices in the bone's space, as they were skinned, give `along` (out the fingers), `thumb` (across the knuckles), `normal` (out of the palm) and `mean` (the palm's middle); `bind` is the bone's bind-pose matrix from its skeleton's `boneInverses`, so the frame is the same whatever the figure is doing when it's asked. A hand under 40 skinned vertices (a low-poly glove) gives no frame; the caller falls back.

### `HELD`: what a kind of thing is, in a hand

A table of kinds, each `{ axis, up, hands, carry }`:

- `axis`: which of the item's own axes runs along the grip (the shaft of a staff, a hilt, a haft, a handle, a glass's height): `'y'` for every kind built upright at its origin, as the toys' and the interiors' are.
- `up`: which way the item's top is when carried: `'thumb'` (a staff, a torch, a lantern, a tankard, an umbrella, a cane: the top past the thumb), `'fingers'` (a sword, an axe, a horn: the blade or bell out past the fingers' line), `'palm'` (a tray, a plate: flat on the palm, the normal up).
- `hands`: 1, or 2 with a second grip the other hand reaches for (`ik.reach`, as a long gun's foregrip): a two-handed axe, a staff held across.
- `carry`: how the arm behaves while the body moves: `still` (the arm from the figure's idle laid over the walk on its own layer, so a planted staff doesn't swing), `upright` (the wrist and forearm turned after the mixer so the item's `up` points up in the world, within the wrist's range, weighted: a tankard stays level, a staff stays planted through a turn), or nothing (a sword swings with the arm, as it should).

The kinds: `staff`, `white-staff`, `torch`, `lantern`, `cane`, `umbrella`, `tankard`, `glass`, `bottle` (`thumb`, `upright`; staffs and the torch `still`), `sword`, `axe`, `dagger`, `horn`, `gaffi`, `spear` (`fingers`; the spear and the gaffi stick `hands: 2`), `bow` (`thumb`, left hand, the bow's plane across the body), `tray`, `plate`, `bag` (`palm`, `upright`), `portalgun`, `plumbus`, `laser` (`fingers`, the gun kinds the wardrobe gives a hand), `carrot`, `pipe`, `ring` (small things: `fingers`, no carry).

### `holdItem(fig, item, kind, { hand, grip, left, scale, curl })`

The one call every world makes. `fig`: `{ model, bones? }` (the animator's figure, or anything with a model that has the hand bone). `item`: an Object3D, built in its own units, its grip at its origin or at a child named `grip`. It:

1. Finds the hand (`RightHand` by `kind`'s default, `LeftHand` for a bow or when asked; `rig.js`'s `findBones` roles for the rigs that name them otherwise).
2. Gets the grip frame once per model template (cached by the template's key and the hand), or falls back to the forearm frame `gear.js` uses today when the hand has too little skin.
3. Puts the item as a child of the hand bone with a local transform from the bind frame: its grip at the palm's `mean` nudged a finger's width out the `normal`, its `axis` along the frame's `thumb`, turned about that axis so its `up` faces as the kind says. `scale`: the item's units to the model's (the toys' props are in the toy's units; `cast3d` passes the toy-to-cast ratio). Attach time no longer matters.
4. Returns `{ item, hand, update(dt, { moving }), release(), hide(on) }`. `update` is the carry: for `still`, the figure's own `idle` on the `arm.r` (or `arm.l`) layer, weight eased to 0.85 while moving and 0 standing; for `upright`, after the animator's `after`, the wrist bent and the forearm twisted toward the item's `up` meeting the world's up, weighted and clamped (±1.2 rad wrist, ±1.4 twist), by `ik.rotateWorld`. `hands: 2`: the other hand's reach to the item's second grip (`grip2`) by `ik.reach`, weight 1 standing and while walking, let go when the figure plays a full-body clip. `curl`: the fingers closed on the grip through `grip.js`'s morphs, for the lead and named cast only (a crowd's hands stay as sculpted).

`fig.after` is the hook: a world that already calls the animator's `after` calls the holds' `update` right after it, as `saber.js` lays the arms. `animator.js` gains two masks beside `upper` and `lower`: `arm.r` (RightShoulder, RightArm, RightForeArm, RightHand) and `arm.l`, each a layer slot of its own, and `MESHY_MASKS` lists them.

### `grip.js` moves

`universe/grip.js` (the finger curl) moves to `src/lib/three/grip.js`; a re-export stays at the old path and gunplay keeps importing it from there in this change. It's a repair: the same exports, no pixel changed.

## Whom E talks to, and what the body does: `src/lib/ai/talk.js`

Pure, three.js-free, tested in Node:

- `talkTarget(people, you, { reach = 3, cone = 1.2, facing = null })` → the person E would address, or null: among `people` (`{ id, x, z, y?, reach?, lines? }`) within `reach` (a person's own `reach` beats it: a Hutt on his dais) and on the same floor, the one nearest the line you face when `facing` (your yaw) is given and within `cone` of it, else the nearest. One who has no `lines` (nothing to say and no quest) is never a target, so the prompt never promises a talk that gives nothing.
- `onTalk(person, you, { t })` → `{ line, react: { event: 'say', hold, target }, face: boolean }`: the next of the person's lines, round and round (`said` kept on the person), the hold from the line's length (1.5 to 6 s, as the galaxy has it), `target` your eyes, and `face` true when you're beyond what their neck can turn (over 1.05 rad off their facing), so the body turns. A line that's only what they do, in brackets, reacts with nothing to say but still looks at you.
- `greetOn(person, you, { near, far })`: the map's greeter (`castRules.createGreeter`) brought here unchanged: a wave once as you come within `near`, armed again past `far`.

Every world keeps its own key handling (the thirteen Middle-earth towns and the two others bind E where they always did); what changes is that the target comes from `talkTarget`, the line and the body from `onTalk`, and the HUD's prompt reads `promptText('E', 'Talk', name)` from the kit. The figure's side is one call: `fig.react('say', react)` on its animator (`figureCalls`) and `fig.look(target)`, with the body's turn where `face` is true (`cast3d.attend`'s rule, `actors.js`'s `faceAt`, `npc.js`'s `turnTo`: each world's own turn stays).

**Middle-earth's change.** A town's cast figure with lines gets the prompt when you're within reach and no spot is nearer; E plays the next line through `onTalk`, the figure reacts (`talk` on the upper body for the hold, the head to you, the body round past the neck's range), and the Bubble shows it as today's proximity talk does. A story beat a town's `rules.js` starts on approach (Gandalf at the bench, Butterbur at the bar) starts as it did; after it, E continues the conversation. Proximity alone now gives the greeting (the wave, the look), not the line, so a crowd doesn't talk at you as you pass. Every press of E makes the body answer, even on a repeated line.

## The audit and the checks

- **`scripts/cast-audit.mjs`** (generalising `galaxy-figures-audit.mjs`, which stays): for a world (`--world middleearth | rickmorty | galaxy`), reads its manifest (`castRules.CAST`, `meshyCast.MESHY` and the wardrobe's `BODIES`, `crewList.CREW` and `heroes.HEROES` and the catalogue's `people`) and, for each figure's GLB on disk: present, size, bones by role (hips, both hands, toes, head), whether the hand has grip skin (40 vertices or more), the locomotion clips it carries or borrows, and whether its walk's stride can be measured. A table in Markdown and JSON to `docs/superpowers/evidence/things-in-hand/audit-<world>.md`. Exit 1 on a missing file or a figure the world says holds something whose hand can't take it.
- **`scripts/anim-check.mjs` gains `--held`**: for every held item in view, the distance from its grip to the palm's middle each frame (under 0.03 m scaled) and the angle between its axis and the hand's `thumb` line (under 15°), reported per figure; a `still` carry's arm swing under 0.25 rad while walking; an `upright` item's `up` within 25° of the world's. And `--talk`: the route's dev hook names its talkers (`__talkers()`: id, x, z); the check teleports beside each, reads the prompt from the HUD (`[data-prompt]`, "E Talk · Name"), presses E, and asserts a clip on the upper layer within 0.5 s and the head's look set, per talker. Exit 1 on any failure in view.
- **Foot slide**, as before: `anim-check` on every route of the three worlds (the thirteen towns and the hub, C-137, the Citadel, the eight planets and Portal panic, the seventeen surfaces), under 0.15 m/s planted-toe drift. What fails is fixed per figure: a `clipSpeed` row for a figure without toes, `faceAhead` for a clip that walks sideways, the missing run handed to the walk.
- **Shots**: one per world route with a held item in frame and one mid-talk, in `docs/superpowers/shots/things-in-hand/`, taken in headless Chromium and checked by eye.

## The worlds, in order

Each wave is its own commit series on the branch, green before the next starts; the user merges.

### W-A: the library

`held.js`, the masks and layers in `animator.js`, `grip.js` moved, `lib/ai/talk.js`, `cast-audit.mjs`, `anim-check`'s `--held` and `--talk`, with their tests. No caller changes but gunplay's imports. `docs/architecture.md`'s "Where things live" names `held.js` and `talk.js`.

### W-B: Middle-earth

`cast3d.hold` becomes `holdItem` (its signature kept: `hold(obj, boneName)` reads the toy's `userData.held` for the kind, `scale` the toy-to-cast ratio); the toys' item builders (`mapFigures.js`, `kit.js`'s Gandalf, `shire/people.js`'s umbrella, Bree's carrot, Edoras's tankards and bunch) name their kind in `userData.held` and put a `grip` child where the hand holds them. Gandalf's and Saruman's staffs carry `still` and `upright`; the elves' bows go to the left hand; Gimli's axe two-handed in the hall. The towns' E: `talkTarget` over the town's cast within reach, the prompt, `onTalk`, the reaction and the turn; the proximity line becomes the greeting except for the rules' story beats. The audit's table for the twenty-nine; `anim-check --held --talk` on every town; shots.

### W-C: Rick and Morty

The wardrobe's hand slot (`gear.js`) through `holdItem` (the head and face frames stay); the interiors' `inHand` and `holding` through it (the glass `upright`); Portal panic's hero gun and Roy's cane and football; the Citadel's, Mortytown's and the planets' props that are in hands. E's target through `talkTarget` in `RmWorld.jsx`, the Citadel and `RmSurface.jsx`, the body through `onTalk` (`npc.js`'s `heard` reads the reaction instead of making its own). The audit for `MESHY` and the wardrobe's bodies; `anim-check` on C-137, the Citadel, the eight planets and Portal panic; shots.

### W-D: the galaxy

The audit over the crews (56), the heroes (11), the troops (10) and the catalogue's people, and what it finds fixed: a figure the galaxy says holds something gets it through `holdItem` (the Tusken's gaffi stick two-handed, the cantina's glasses, Dex's tray, the Jawa's ion blaster where it's not a gunplay gun, the Death Star's officers' datapads where the inside's figures hold them); guns stay gunplay's, with `held.js`'s frame. The surface's E through `talkTarget` (`scene.js`'s `target()` keeps its order: a step's use, a door, a ride, then a talk) and `onTalk` in `actors.say`. `anim-check --held --talk` on the seventeen surfaces and the Death Star inside; shots.

## Tests

- `held`: the grip frame from a synthetic hand (the Meshy fixture given a hand's skin: a plate of vertices out the fingers, a thumb to the side) finds `along`, `thumb`, `normal` the right way for a right and a left hand; an item's grip lands at the palm's middle within 1 cm whatever pose the figure is in when it's attached; `axis` lies along `thumb`; `up` faces as the kind says for each of `thumb`, `fingers`, `palm`; too little skin falls back to the forearm frame; `still` lays the idle's arm over the walk only on the arm's bones and only while moving; `upright` turns the wrist within its clamp and the item's `up` ends nearer the world's up; `hands: 2` reaches the second grip; `release` puts the item back where it was; a model with no hand returns null and nothing throws.
- `animator`: the `arm.r` and `arm.l` layers move only their bones, each its own slot, cut by a full-body play as the upper is.
- `grip`: its tests move with it; the old path's re-export is tested to be the same functions.
- `talk`: the nearest within reach when no facing; the one you face when facing is given, within the cone; a person's own reach; no lines, no target; lines go round; the hold from the length; `face` past 1.05 rad; a bracketed line says nothing but looks; the greeter once per approach.
- `cast-audit`: on the fixtures' tiny GLBs, the table's rows and the exit code.
- Each world keeps its tests and adds: Middle-earth's staff at the cast's palm in any pose and still over the walk, E's target and prompt in one town's rules; Rick and Morty's wardrobe hand gear at the palm, `inHand` no longer order-dependent, E's target in the world's rules; the galaxy's `actors.say` reaction from `onTalk`, `target()`'s order kept.

## Risks

- **A clip's hand pose.** The grip frame is from the bind pose; a clip that curls or splays the hand moves the palm but not the item's local transform, so the item follows the bone, as a real one would. A clip that opens the hand wide (a wave) shows the item floating a finger off; that's the layer's cost, taken.
- **The toys' units.** A toy's staff is in the toy's units and scale; `holdItem`'s `scale` is the only place that ratio is applied, and the test asserts the world length of a staff is the toy's.
- **Blast radius.** `cast3d.hold` is called from seven places, `gear.js` from the wardrobe and the party, `gunplay`'s frame from every armed figure. The library's move changes nothing until a world calls `holdItem`; each world's wave is checked in the browser, and gunplay's output on the party figure is asserted unchanged by its existing tests.
- **Middle-earth's proximity lines.** Moving a line from approach to E changes what a player hears passing by. The rules' story beats are kept on approach by name (each town's `rules.js` says which), and everything else needs E. A town's existing tests on `nearCast` keep passing: it still finds the person; what's played changes.
- **Headless time.** `anim-check` with `--talk` presses E per talker and waits 0.5 s of world time each; a town with twenty talkers adds a minute in software rendering. The check runs per route, and the evidence folder keeps the JSON.

## Done when

- `src/lib/three/{held,grip}.js` and `src/lib/ai/talk.js` exist with their tests; `animator.js` has the arm layers; `gunplay.js` imports its frame from the library; `docs/architecture.md` names them.
- No world attaches an item to a hand by its own arithmetic: `cast3d`, `gear.js`, `interiors/people.js`, `Portal3D.js`, the Roy scene, the galaxy's and the Death Star's non-gun props all go through `holdItem`.
- In every Middle-earth town, C-137, the Citadel, the planets, Portal panic, every galaxy surface and the Death Star inside: the prompt names whom E addresses, E plays a line and the body answers, `anim-check --held --talk` exits 0, feet under 0.15 m/s.
- `docs/superpowers/evidence/things-in-hand/` holds the three audits and the check JSON; `docs/superpowers/shots/things-in-hand/` the shots.
- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` clean.
- `docs/superpowers/HANDOFF-universe.md` says what's done per world, what each audit found, and what's left.
