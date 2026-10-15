# Handoff: the fleet war

The design is `docs/superpowers/specs/2026-10-06-fleet-war-design.md` and the plan is `docs/superpowers/plans/2026-10-06-fleet-war.md`.

## Done

- **PR #301:** rocks hurt at super speed (`rockHits.js`, the belt, the rim and the debris streams), and the flare's coronal mass ejection was redone (`cme.js`).
- **PR B (this one):** the war and its battles.
  - `wars.js` and `war.js`: the data and the front's state.
  - `battle.js`: the Fleet Assault sim, balanced on seeded AI-only battles. They run 6–12 minutes with mixed outcomes.
  - `battleScene.js` and `battleFx.js`: the drawing.
  - `front.js`: the front on the map.
  - `BattleHud.jsx`: the bar, the side picker and the end card.
  - The crews' lines.
  - The nav map's war line and the trip to the front.
  - The holotable's rings round the systems each side holds.
  - The Star Wars war is live. Rick and Morty's and Breaking Bad's are data only, with `ready: false`.
- **PR F: the Galactic Civil War, in the galaxy** (spec revision 2).
  - `fit.js`: worlds grown wider than their ships.
  - `tally.js`: the shared tally.
  - `gcw.js`: the war on a shared clock. Its balance was simulated over eight campaigns.
  - `battles.js`: a battle at every system.
  - `battle.js`: sized, kept off its planet, on the clock, shared.
  - `warfront.js` and `warState.js`, in the galaxy's flight scene.
  - The holotable's war table.
  - The `war` and `fight` actions on the wire.
  - The universe map lets the Star Wars front go: `BattleHud` is gone, and the universe front puts you in on your crew's side.

- **PR G: the set pieces** (`warpieces/`, `tunnel.js`).
  - **Endor:**
    - the shield generator on the moon holds the Death Star's shield up;
    - the superlaser fires on Rebel cruisers;
    - the Executor dives into the station when its bridge goes;
    - the reactor run.
  - **Hoth:**
    - the ion cannon disables Star Destroyers;
    - while the Empire attacks, GR-75 transports run for the jump. Six out and Hoth's held.
  - **Scarif:** the Hammerhead's ram puts two Star Destroyers onto the Shield Gate, and the shield drops.
  - **Any battle:**
    - a hangar run into a Star Destroyer's reactor;
    - batteries on the hulls as targets.
  - The crews have galaxy lines for all of it.

- **PR C: the capitals’ close-up cut.** A desktop with a graphics card (detail high or ultra) flies Daniel Andersson’s Imperial II (84k triangles) and Nebulon-B (100k) in place of the lighter ones, each with its own far-off copy (`galaxy/models.js` `HQ`, `withHq`; `scripts/sketchfab-galaxy.mjs destroyerhq nebulonhq`; `scripts/galaxy-lod.mjs hq/destroyer hq/nebulon`). The Imperial II is imported barely metal and brightened (`metal`, `gain`), or its grey plates come out near black under one sun. Home One’s close-up cut was tried and left: the same Sketchfab model as `moncal`, it came out plainer in the battle than the 40k one. `SUBSYSTEMS`, `TURRETS` and `HULLS` are shares of the length and hold on both cuts (the shield generators’ markers sit at the domes).
- **PR D: Rick and Morty's war.** On (`ready: true`), at its real places: seven sectors from just off the Citadel to the sky over Earth C-137, which the Federation holds, as in the show. Its flagships were made with Meshy from the show's own pictures (`scripts/meshy-war.mjs`; a still from the Rick and Morty wiki, kept in `lab/meshy/war/ref/`, lifted out by image-to-image, then image-to-3D): the Federation's battleship as the show drew it, dark green and black with red lights, and the Council's dreadnought in the Citadel's look (the Council has no warship of its own in the show). A first try from words alone came out as designs of their own and was dropped. Each stands in as `councilship`/`fedcruiser` till it loads. Their subsystems, batteries and hulls were placed from shots. Objective markers now fit their names (`battleFx.js` `fitPx`; the cards had cut "Destroy: Shield generator" off at both ends, in the galaxy too). `scripts/universe-war-check.mjs [cruiser|rv]` (starts its own Vite, real GPU) flies the front through: auto-joined on the crew's side, the phases down, the flagship broken, the war saved, the nav map's front button. The Federation battleship's bridge and reactor were first set inside its hull spheres, where no bolt reached them (a shot stops at the first sphere it meets); they're on its hull now, the bridge at the glass along its top and the reactor atop the great dome, its hull spheres fitted to the model, and `battle.test.js` fires bolts at every war's flagships' objectives from all round, through `hit()`, to keep each one reachable (Home One's reactor, reached mostly from astern, is the hardest: about 30%).

- **PR E: Breaking Bad's war** (`claude/peaceful-franklin-fvqb3q`, not yet a PR). On (`ready: true`), at its real places: seven sectors from Los Pollos, about 740 units off Albuquerque (the Breaking Bad world), out past the border to Don Eladio's hacienda at `[5800, 120, 300]`, clear of the Twins and the Maw (`wars.test.js` checks it). Its flagships were made with Meshy from words (`scripts/meshy-war.mjs`; the show has no flying ships to work from): Gus's superlab barge, a steel lab-and-laundry hull with hazard stripes and two roof domes, and Don Eladio's hacienda, terracotta and tile round a pool courtyard on a floating rock. They were made a second time: the first pair's tasks were on another Meshy account (moved to `tried` in `scripts/meshy-war-tasks.json`), which this key couldn't fetch. Noses: superlab `π/2` (thrusters at +x), hacienda `0` (Meshy mirrored its thruster block, so it flies with one either side, like the Federation's engine pods). Each stands in as `madrigal`/`lowrider` till it loads. Their subsystems, batteries and hulls were placed from shots, each objective clear of the hull spheres (a shot stops at the first it meets, so a buried one can't be hit): the superlab's shield generators are its two roof domes, its bridge the deckhouse's front, its reactor in the stern among the thrusters; the hacienda's are the back towers' domes, the main house over the front door, and the foot of the rock, with its batteries on the four towers' cannons.

- **Revision 3: the oath, and three wars at once** (the spec's revision 3 and 3a, `docs/superpowers/specs/2026-10-07-gcw-allegiance-design.md`; the plan `docs/superpowers/plans/2026-10-07-gcw-allegiance.md`, PR 1 to PR 8: #437, #440, #443, #449, #457, #462, #465 and these docs).
  - `sides.js`: three wars, one an era, at once on the same map: the Clone Wars (the Republic against the Separatists), the Galactic Civil War (the Rebellion against the Empire) and the Remnant War (the New Republic against the Imperial Remnant). The Hutts are a third power in each, holding Tatooine and Nevarro at the start. The systems are grouped in five areas.
  - `allegiance.js`: you swear to a side of the war you fight in, once a campaign in each war, and may swear again to the other side as a turncoat till the campaign's over. `suggestSide` is what your crew or hero would pick. It's kept in `tp-gcw-side`.
  - `gcw.js`: the wars move both ways along the films' trade routes. The liberator takes fronts, the raider attacks every four hours, and the Hutts raid every twelve. Supply from the systems round a front and a whole area next door speed it up. A war ends early when one side holds everything.
  - Each system fights its own kind of battle (`BATTLE_KINDS`): an assault, an evacuation (runners for the jump), a siege, an interdiction (the Interdictor is the objective when the dark side defends; otherwise it's the flagship), a blockade (runners through the line) or an ambush. `battle.js` has runners, aces (Vader, Wedge, Hera in the Ghost) and objectives on the Interdictor. The Clone Wars' and the Remnant War's fleets are in `battlesWars.js`.
  - `warEffects.js`: holding a system changes who hunts you there (`roamRules.js`), who escorts you (the `escort` event, `universe/wingmen.js`), which fleet parks in orbit (`world.js`'s `setEffects`, `garrisonFleet` where the system has no fleet of the holder's), the heat, and the troops on the ground (`surface/garrison.js`).
  - On the comms, the commander posted at the system (or the side's general where nobody is) speaks first and calls you by your rank (`warCast.js`, `warCastData.js`: 31 commanders, Jabba for the Hutts; `ranks.js`). Then the crew answers for your side, in the place's, the war's or the side's own lines (`battleLines.js`, `battleCrews/`). The heroes say whose side they lean to (`heroes.js`'s `lean`).
  - The holotable's `WarCard.jsx` shows the wars as tabs, the oath, your rank and record, the major order ("Liberate" or "Hold"), the battles on now in their kind for your role, and who holds each area. `WarHud.jsx` is the line over the view while a battle's on where you are. There are five achievements: Sworn, Liberator, Major order, Turncoat and Top brass.
  - The ground battles count: an assault's end posts the posts your side took as points for your side's war, and a win if you won (`GalaxySurface.jsx`). The assault HUD's side buttons swear you.
  - The war's tally keeps a campaign's keys (#476). It used to keep 96, the most a message holds, and dropped every key after that without a word. Now `warState.js`'s `KEYS` is a room of pilots, each in a battle every step and winning it (23,040). Each message is a page of `TALLY.keys`: your newest shares first, then the rest in turn. A pilot heard from for the first time is owed all of it (`owing()`), a page every `warEvery`. Nothing's folded, so every pilot's `history` agrees. A fold into per-system totals was turned down: `history` applies points at their own step, and captures make the order matter.

## The hulls, part 2 (2026-10-15): bolts and contacts on the game’s shapes, the game’s cut on a desktop

The design: `docs/superpowers/specs/2026-10-15-galaxy-space-fidelity-design.md` (what was found: the fleet files’ 256 and 128 maps, and the hulls loaded by #1003 that nothing read).

- `universe/battle.js` takes `hulls` (the war hands in `models.hulls`): a bolt meets a fighter, a runner or a capital ship on its hull through `lib/combat/pose.js`’s poses (a capital’s bob through `battle.drawn`, set by `battleScene.js`); a fighter is kept out of a capital’s hull each step. A kind whose hull is not here is hit as its sphere, as before.
- `universe/hunterRules.js` and `universe/capitalRules.js` take `hulls` too (the hunters’ hulls asked for as a pack comes, `hunters.js`; the set piece’s capital’s as it jumps in, `setpieces.js`, which exposes `shapes`).
- `galaxy/scene.js`’s `heldOffHulls`: your ship kept out of the war’s capitals and the set piece’s after the step, a bump or a crash by the closing speed.
- `galaxy/models.js`: `HIGH_CUTS` (the twelve kit fighters’ plain surface cuts on high and ultra) and the kits’ `ULTRA` cuts on high.

Left, the owner’s: the `high` capital cut (1,024 colour, 512 data, the fleet’s triangles) made on the desktop and published, in place of the ultra cut on high; the fleet cut raised for mid if a phone carries it; `scripts/bf2017-hulls.mjs` run to measure the surface plain cuts against the hulls; the browser and frame-time checks; then the game’s damage (the hulls design §2.4) on the `part` and `property` every hit now carries. Another pilot’s ship and the Interdictor keep their spheres.

## Revision 3: where the code differs from the plan

The plan was written against an older map of the code. Where they disagreed, the code was trusted and the plan's intent kept:

- **Names.**
  - Heroes lean with `lean`, not `side`: `side` was already a hero's field.
  - The areas are `sides.js`'s `AREAS`, not rings of `REGIONS`.
  - The trade routes are `systems.js`'s `LANES`, not `ROUTES`. Each system's neighbours are the lanes', its nearest two, and two links (Kamino to Lothal, Coruscant to Naboo).
- **Teams.** Team 0 is the light side and team 1 the dark side, whoever attacks (`teamsOf`); the Hutts take the other's slot. The set pieces already assumed the Rebels were team 0.
- **The runners** are in the battle engine (`battle.js`'s `runners`), not in a `warpieces/evacuation.js`. Hoth's set piece only counts the transports out.
- **`BATTLE_KINDS.text`** is keyed by role (`attack`, `defend`), not by stance, so an Imperial evacuation reads right.
- **The cast.** The commanders' posts are `warCastData.js`'s `POSTS`, not a `cast` field on each system.
- **The crew's lines.** The blanks are `{us}`, `{them}` and `{place}`; there's no `{flagship}`.
- **The tally.** The keys are `${code}:${sys}:${step}` and `win:${code}:${sys}:${step}`, with a code for each side (`rep`, `sep`, `reb`, `imp`, `nr`, `rem`). Old `hoth:12` keys count as the Rebellion's.
- **The checks.** `scripts/galaxy-war-check.mjs` takes `SIDE=` (it swears you to that side, in its war) and `KIND=` (it forces a battle of that kind). The check scripts set `tp-worlds` to `"load"` so the 3D worlds load without the gate.

## Revision 3: left

- `effects.traffic` is worked out but nothing reads it yet: the galaxy's traffic still flies the system's own kinds.
- Coruscant's siege doesn't raise a planetary shield (`world.war.planetShield` is only Scarif's).
- An ambush is a brawl: half again the fighters, and each side has only its flagship and one escort. It doesn't lay out in a rock field yet (`BATTLE_KINDS.ambush.rocks` is unread), and its objective is still the flagship's subsystems.
- An intercept is a bomber of the attacker's downed by a defender, or any runner of the other side's. Neither is checked against its distance from the flagship.
- Unsworn pilots are hunted by the holder's garrison as if they were its enemy (`roamRules.js`'s `galaxySide`). Only in a battle are they nobody's target.
- On the ground, a garrison changes only who lives in the base (`garrisonLife`). An activity's hostile spawns aren't mapped to the holder's troops yet.
- The new lines and the cast aren't voiced (`npm run voices`, which needs the ElevenLabs key).

## Left, in order

1. **Smaller:**
   - Voice the new lines (`npm run voices`, which needs the ElevenLabs key).
   - Measure frame time with 64 fighters on a real graphics chip.
   - Consider instancing the far fighters if it's slow.

## Checking it

- To check the set pieces, start the dev server with `npx vite --port 5188`, then run `OUT=/tmp/shots node scripts/galaxy-setpieces-check.mjs endor|hoth|scarif|hangar mid`.
  - It forces a battle at the system (`war.force`) and runs the battle on with `war.skip(seconds)`, because software GL steps it at about a twentieth of its pace.
  - At Endor it knocks out the generator, flies in through the mouth, pins into the chamber, shoots the reactor, pins out, cuts the escape short (`run.hurry`), and watches the station go.

- Start the dev server with `npx vite --port 5188`, then run `OUT=/tmp/shots SIDE=empire KIND=siege node scripts/galaxy-war-check.mjs [system] mid`. Allow about four minutes.
  - It swears you to `SIDE` (the Rebellion if it's not given) and makes that side's war the one you fight in.
  - It finds the battle on now (the major order's), or forces one of `KIND` there, drops in, and checks that you're on your side's team and that a kill scores your side's keys.
  - It looks at it from a few places.
  - When you're attacking, it takes the phases down with `hit()`. Then it checks that the war counted it and that the holotable shows your oath and your war.
  - (The pin's heading is `atan2(-dx, -dz)` to face `(dx, dz)`.)
- `OUT=/tmp/shots node scripts/assault-check.mjs hoth` plays Hoth's ground assault through and checks that the win reaches the war's tally.
- `scripts/rocks-check.mjs` and `scripts/flare-check.mjs` check PR A's pieces.
- Dev hooks:
  - `window.__galaxyOath` has `swear(side)`, `theatre(war)` and `get()`.
  - `window.__galaxyDebug.effects()` returns what holding the system you're in means (`warEffects.js`), and `.happen(id)` plays a director event (`escort`, `hunt`).
  - `window.__universeDebug.front()` returns the front: `.where()`, `.info`, `.battle`, `.join(team)` and `.win(team)`.
  - `.rockFields` and `.smashed` hold the rock colliders.
- **Gotchas:**
  - The front is skipped under reduced motion, as the hunters are.
  - A battle's fought only within `ZONE.near` (900 units) of it. Leaving pauses it and coming back resumes it.
  - The save is `localStorage` `tp-war-starwars`. Delete it to start the war again.
