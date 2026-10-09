# Space battles: every war with its own ships, fights that decide themselves, and the Venator done properly

Date: 2026-10-09. Written from two read-only audits of `main` at `657d6757` (the galaxy's war battles, scenery battles and ship tables; the universe's fleet-war engine the galaxy borrows) and a look at the `sketchfab-star-wars` release of `tilakpatell/tilakverse-assets`. The plan is `docs/superpowers/plans/2026-10-09-space-battles.md`.

## What the owner asked

"Architect a way to improve the space battles. Also figure out that certain factions have certain ships (and eras) and not to mix them up. Make use of the new assets at tilakverse-assets for Venator and stuff so it looks much better."

Asked and answered in the session:

- **Who decides a battle:** the fighting. Capital ships really sink; the director only paces waves and reinforcements.
- **The Venator hangar kit:** used, for a hangar launch at the start of a Clone Wars battle.
- **Upgrades in scope:** wrecks and debris; capitals that manoeuvre and fire broadsides; weapons per ship; the systems' scenery battles replaced by live ones.

Done looks like this. Swear to the Republic and jump to Coruscant: you launch out of the Resolute's hangar beside two ARC-170s into a sky of Venators and Munificents, blue turbolasers going one way and red the other, never a TIE or a GR-75 in sight. The Venators come round to put their broadsides on the Invisible Hand; flak bursts round your bombers; a Munificent breaks in two and drifts, burning, for the rest of the battle; a vulture droid you hit comes apart in three pieces trailing smoke. Whether the Invisible Hand goes is down to its shield generators and its bridge, and who shot them: you, the other pilots, the Venators' guns. The same jump in the Civil War is Star Destroyers and Mon Cals; in the Remnant War it is the New Republic and the Remnant; and the patrols and standing fleets you fly past on the way belong to the war you are in.

## Where it is today (the evidence)

The galaxy's war battle runs `gcw.js` (what is on where) → `galaxy/warfront.js` → `galaxy/battles.js` (`layBattle`, `templateFor`) → `universe/battle.js` (the engine) → `universe/battleScene.js` (the drawing). The universe map's own Star Wars war is switched off (`universe/wars.js:167`, `ready: false`); only its Rick and Morty and Breaking Bad wars run there, on the same engine.

### Factions and eras are mixed

Three wars are fought at once on one map (`galaxy/sides.js` `WARS`: `clone` Republic against Separatists, `gcw` Rebellion against Empire, `remnant` New Republic against Remnant, the Hutts in all three). A war has an era; a ship kind has none. Every table that picks a ship for a side picks it on its own:

- `battles.js` `FIGHTERS`, `DEFAULT`, `HUTTS`, `GCW_TEMPLATES`, `BATTLE_KINDS[*].runners.kind`, `LOOKS`; `battlesWars.js` (the Clone Wars' and the Remnant War's templates); `warEffects.js` `OWNERS`; `roamRules.js` `ROLES`, `ESCORTS`; `hunted.js` `FACTIONS`; `battlePlans.js` `GIDEON`; `scene.js` (the interdiction's pack); `fx.js` `LASER`.

What that gets wrong, found:

| where | what | why it is wrong |
| --- | --- | --- |
| `battles.js:128`, `battlesWars.js:174, 197, 365` | an Interdictor in the Separatists' line | an Imperial ship; `battles.test.js:99-102` asks for it |
| `battlesWars.js:175, 199, 222, 294, 366, 412`; `battles.js:76` | Gozantis with the Separatists; Gozantis as their blockade runners | Imperial (and Hutt) |
| `battlesWars.js:213, 234-236, 258-259, 282-284, 403`; `battles.js:65` | GR-75 transports with the Clone Wars Republic, and as its evacuation runners | the Rebellion's |
| `warEffects.js:40` | a Lambda shuttle as Republic traffic | Imperial |
| `scene.js:1332`, `interdiction.js` | the hyperspace interdiction: always an Imperial Interdictor and TIEs, often led by a TIE Advanced, whatever the war | Clone Wars pilots are pulled out by Vader |
| `warEffects.js:68`, `roamRules.js:63` | Separatist droids hunt in the Civil War and the Remnant War | vulture droids against a Rebel's X-wing escort |
| `warEffects.js:83-90` `piecesShown` | only `fleet` and `battle` pieces are filtered | Yavin's TIE patrol, the Devastator chasing the Tantive IV, Naboo's vultures and Hoth's GR-75s show in every war |
| `world.js:432-531` | a standing battle shows in any war while the system is contested and the war battle is not on (always, with reduced motion) | Endor's Executor fight in the Clone Wars |
| `battlePlans.js:210` | the Remnant's ace is always Gideon in a TIE Defender | he flew a TIE fighter; the Defender is Thrawn's, Civil War |
| `battles.js:242` / `fx.js:17` / `hunted.js` | Republic fighters' bolts red in the war battle, blue in the scenery, red again for the hunters | one side, three colour tables |
| `universe/setpieces.js:502`, `capitalRules.js:292` | a Republic Venator or Mon Cal dropping in fires green Imperial turbolasers on the Star Destroyer's part layout | the drop-in knows one ship |
| `models.js:176` `STAND_IN` | until its model loads, every Venator is drawn as the built Imperial Star Destroyer | the first second of every Clone Wars battle |

### The battles look and play thin

- **Capital ships sit still.** The only movement is the final push at 480 s, the attacker's escorts 1.2 units a second for 40 s, turned at most 25° (`battleFleet.js:36-45, 125-145`). Every battery fires in every direction (no arcs, so no broadsides) every 1.2–2.6 s at a random point on a random ship, 40% of them misses on purpose (`battleCapitals.js:97-109`). Flak is a single unled rod (`:111-135`, `battleFx.js:20`).
- **The fighting decides nothing.** The galaxy's director (`battleDirector.js`) decides the battle from a seeded pressure curve and the pilots' tally; the AI's fire never sinks a capital (`battleCapitals.js:144-149`). Escorts die at seeded times.
- **One gun.** Every fighter has the same laser (range 14, cone 0.1, damage 1, bursts of 3: `wars.js:246`); bombers add a homing torpedo. No ion, no missiles, no bombs.
- **Nothing breaks.** A fighter down is a 0.9 s flash and its model hidden (`battleScene.js:153, 283`); an escort lost is a flash and gone (`:189-191`). Only the defender's flagship breaks in two (`:113-138`).
- **The systems' standing battles loop.** Fighters fly fixed ellipses in pairs; a hit hides the target 3–6 s and it reappears across its loop (`world.js:467-499`).

### The models

| kind | today | in the assets release |
| --- | --- | --- |
| Venator | `/models/universe/venator.glb`, 14k triangles, one 1024 map; LOD 4k | ForkyForklift's *Venator Class Star Destroyer*, CC BY 4.0: 402k triangles, 12 materials, 44 maps at 1024, 74 MB. The site's import (`scripts/sketchfab-import.mjs`) stops at 91–107k triangles and 6–14 MB: its simplifier keeps seams and its 44 maps stay 44. It needs its own import. |
| TIE fighter | `/models/galaxy/tie.glb`, 8k triangles, flat materials | Mickael Boitte's *3D T.I.E Fighter*, CC BY 4.0: 20k triangles, 4 maps at 2048; through the site's import, 12.7k triangles, 320 KB |
| Venator hangar | none | ShineyFX's *The Clone Wars: Venator Prefab*, CC BY 4.0: a hangar interior kit (doors, wall panels, floor, wall lights), 31 × 2.75 × 15.75 m, 294k triangles, 13 maps at 2048, 47 MB |

`scripts/assets-fetch.mjs starwars venator tie venatorcw` already fetches all three into `lab/assets/starwars/`.

## The design

Nine pieces, each its own pull request, in this order. The first two are the owner's "not mix them up"; the third is the assets; the rest are the battles, the looks first.

### 1. The roster: one table says which ships each side flies in each war

`src/components/galaxy/roster.js`, pure data and a few functions, tested.

```js
// a ship kind: who flies it, in which wars, as what
export const SHIPS = {
  venator:    { sides: ['republic'], wars: ['clone'], class: 'capital' },
  acclamator: { sides: ['republic'], wars: ['clone'], class: 'capital' },
  corvette:   { sides: ['republic', 'rebel', 'newrepublic', 'hutt'], wars: ['clone', 'gcw', 'remnant'], class: 'frigate' },
  arc170:     { sides: ['republic'], wars: ['clone'], class: 'fighter', guns: ['laser', 'torpedo'], tail: true },
  ywing:      { sides: ['republic', 'rebel', 'newrepublic'], wars: ['clone', 'gcw', 'remnant'], class: 'bomber', guns: ['laser', 'ion', 'torpedo'] },
  interdictor:{ sides: ['empire', 'remnant'], wars: ['gcw', 'remnant'], class: 'capital' },
  tieadvanced:{ sides: ['empire'], wars: ['gcw'], class: 'fighter', guns: ['laser', 'missile'] },
  // … every kind the galaxy's battles, fleets, patrols, hunters and traffic name
};
// each side's colours: its fighters' bolts and its batteries'
export const LOOKS = { republic: { laser, turbo }, separatists: { … }, … };
export const allowed = (kind, war, side) => boolean;
export const rosterOf = (war, side, cls) => [kind, …];
```

The canon it holds (no sequel trilogy, as the site's rule is; after Episode 6 only The Mandalorian and Ahsoka):

- **Clone Wars.** Republic: Venator, Acclamator, CR90 corvette (the Tantive IV is the Republic's in Episode 3), ARC-170, Delta-7, Y-wing (the BTL-B is a Clone Wars ship), N-1, the Nubian. Separatists: Providence, Lucrehulk and its core ship, Munificent, vulture droid, tri-fighter.
- **Civil War.** Empire: Star Destroyer, Executor, Interdictor, Arquitens light cruiser, Gozanti, Lambda shuttle, TIE, interceptor, bomber, Advanced, striker, Defender. Rebellion: Mon Cal, Nebulon-B, Hammerhead, CR90, GR-75, X-, A-, Y-, B- and U-wing, the Ghost, the Falcon, a stolen Lambda.
- **Remnant War.** New Republic: the Rebellion's fleet less the GR-75's evacuation role, and the N-1. Remnant: Star Destroyer, Arquitens, Gozanti, Interdictor, TIE, interceptor, bomber; no Executor, no Advanced, no Defender.
- **The Hutts**, in every war: Gozanti, CR90, skiff, freighter.
- **Bolts**: Republic fighters red and batteries blue; Separatists red; Empire and Remnant green; Rebellion and New Republic red; the Hutts orange.

`fleetRebels.js`, `fleetRepublic.js` and `fleetExtras.js` keep their `INFO` (a name, a length, a side for the holotable); the roster is about wars and is the only thing that says who may fly what.

**The audit.** `roster.test.js` walks every place a ship is chosen, in every war, and fails on a kind that side may not fly there: each war's `DEFAULT` and templates (flagship, escorts, fighters, aces), `HUTTS`, the runners of each battle kind, `OWNERS`, `ROLES` and `ESCORTS`, `hunted.js`'s factions, the interdiction pack, the plans' aces, and every scenery piece the war shows. `scripts/roster-audit.mjs` prints the same as a table (war, side, source, kinds), and exits 1 on a mix.

**The fixes it forces**, in the same pull request:

- Clone Wars lines: the Interdictors and Gozantis out of the Separatists' lines (a Munificent or a Providence in their place); the GR-75s out of the Republic's (CR90s and Acclamators). `battles.test.js:99-102` turns round: it asks that no Separatist line has one.
- Runners by war and side, not by stance: the Republic's evacuation runs CR90s, the Separatists' blockade runs core ships, the Empire's and the Remnant's run Gozantis.
- The interdiction battle kind needs an Interdictor on the raider's roster; a war without one (the Clone Wars) fights that system's battle as a siege.
- `OWNERS` by war: the Republic's traffic is ARC-170s, Acclamators and CR90s (no Lambda).
- The Separatists' leftover droids hunt only in the Clone Wars.
- The hyperspace interdiction is the Empire's in the Civil War and the Remnant's in the Remnant War (TIEs and interceptors, no Advanced); in the Clone Wars there is none.
- Gideon's ace is a TIE fighter.
- One colour table: `battles.js`'s `LOOKS`, `fx.js`'s `LASER` and `hunted.js`'s lasers all read `roster.js`'s `LOOKS`; the drop-in capital (`setpieces.js`) fires its own side's turbolasers.
- `STAND_IN.venator` becomes `acclamator` (a Republic ship that is built in code), not the Star Destroyer.

### 2. The scenery belongs to the war you are in

`piecesShown(sys, effects, war)` (`warEffects.js`) shows a piece only if every ship in it is on the roster of the war being fought, for one of that war's sides or the Hutts; a piece may also name its war (`wars: ['gcw']`) where it is a moment from a film (the Devastator and the Tantive IV over Tatooine; Home One at Endor). A patrol hidden for its war is replaced by the holder's own: `patrolFor(sys, war, owner)` flies a pair of the owner's fighters from the roster round the patrol's path, so Yavin in the Clone Wars has ARC-170s where it had TIEs. The audit in piece 1 covers what is shown.

### 3. The models from the assets repo

- **`scripts/venator-import.mjs`**: ForkyForklift's Venator for the galaxy. Joined by material, the faces you cannot see at battle range (the hangar's inside, the undersides of greebles) dropped, simplified with seams unlocked, its 44 maps baked into one 2048 atlas (base colour, a packed metal-roughness-emissive) or, if the atlas costs it its lit windows, the hull's three body maps at 1024 and the rest flat. Targets: a high cut under 2.5 MB and 60k triangles (`venator.hq.glb`, high and ultra), a mid cut near today's 14k at under 900 KB (`venator.glb`), and the LOD (`lod/venator.glb`) re-made from it. Compared against today's on a sheet (`scripts/glb-shot.mjs`) and in the battle at the size it is seen (`scripts/galaxy-war-check.mjs` at Coruscant in the Clone Wars); it goes in only if it reads better there. If it cannot get under budget and read better, the PR says why and today's stays.
- **The TIE fighter**: Boitte's through `scripts/sketchfab-import.mjs` (12.7k triangles, 1024 maps, about 320 KB), compared the same way against `galaxy/tie.glb`; it replaces it only if it wins.
- **The hangar kit**: cut down to one bay (two wall runs, the floor, the big door, its lights) under 2 MB, for piece 9.
- Credits: each in `src/data/modelCredits.json` and `CREDITS.md`, CC BY 4.0, by their authors, from the release's README.

### 4. Things break

In `battleScene.js` and a new `universe/wrecks.js` (drawing) with `wreckRules.js` (pure, tested):

- **A fighter down** breaks into three to five pieces (cut from its LOD model by planes through its middle, once per kind, cached), each tumbling off with the fighter's speed and a spin, a smoke trail behind the biggest, a fire in it; gone after 6 s. A pool of 24 at high, 12 at mid, 6 at low; past it, the oldest goes.
- **An escort lost** goes as the flagship does now (a chain of explosions down the hull, then in two by the clipping plane), and its halves stay, drifting, burning and dark, for the rest of the battle. A capital that jumps out still jumps.
- **Hits** on a capital leave fires on its hull (as now) and blacken a patch round them.
- **Engine trails** behind fighters within 40 units of you: short ribbons, instanced, in the engine's colour.

Every effect is pooled, has a per-tier count, and is off with reduced motion beyond a flash.

### 5. Capital ships that fight like capital ships

In `battleCapitals.js` and `battleFleet.js`:

- **Arcs.** Each turret faces out from the hull where it sits (port, starboard, dorsal, ventral, from its place in `TURRETS`) and fires only inside its arc (120° each side of its normal). A ship's broadside is the arc with the most guns.
- **Manoeuvre on the clock.** A fleet's course is worked out from the battle's shared clock, as the final push is now, so a pilot arriving late sees the ships where one there all along does: closing to engagement range in the first 90 s (the attacker's line at 1.2 units a second, the defender's holding), then every escort turned to bring its broadside on its focus (up to 70°), the flagships turned to keep their bow guns on; the final push as now. A ship held by a set piece is not moved.
- **Salvos.** A battery's guns fire together on one target in a ripple 0.3 s long, then reload (2.5–4 s); the bolts are bigger the bigger the ship.
- **Flak bursts.** A flak round bursts where it meets a fighter's path or at its range: a dark puff with a flash in it, hurting what is within 1.5 units.

### 6. Weapons per ship

The roster's `guns` give each fighter its kit; `battleAi.js` picks the gun for the target and `BATTLE.bolts` gains:

- **ion**: a blue bolt that hurts little and stuns: a fighter's guns and steering for 1.5 s, a turret for 4 s; a capital's shields take double (Y-wings, B-wings).
- **missile**: a concussion missile, fast and homing hard, short range (A-wings, the TIE Advanced).
- **torpedo**: as now (X-wings, ARC-170s, Y-wings, TIE bombers).
- **bomb**: unguided, slow, heavy, only at capital ships (TIE bombers).
- **discord**: a tri-fighter's: it sticks and eats a fighter's hull over 4 s, a shot from a wingmate clears it; on you, the HUD says so.
- The ARC-170's tail gun shoots back at what is on its tail.

You keep your own ship's guns (the hangar's); this is the AI's.

### 7. The fighting decides: a fleet ledger every pilot shares

The director exists because every pilot in a system must see the same battle, and their dogfights cannot agree (a phone flies 10 fighters a side, a desktop 32). The capital ships can: there are the same ones on every screen. So the fight between them becomes a ledger, stepped from the battle's seed at one step a second, the same on every peer and worked out cold for a pilot who arrives late (600 steps is under a millisecond):

- Each step, each ship's batteries in arc of their target (piece 5's courses, worked out from the clock) deal their damage to it: to its shields until its shield generators are down, then to its hull, its bridge, its reactor. A ship's turrets lost (shot out by the pilots: the tally's `t:<id>`) fire no more in the ledger either.
- The fighters are in it as squadrons, not ships: each side's strength (a share of its fighters' weight from the roster) lands on the other's ships as bomber runs and is worn down by the other's interceptors and flak. Bomber waves (`battlePlans.js`) are squadrons with a time.
- The pilots' tally goes in as it does now: shots on an objective (scaled by how many pilots there are), intercepts, aces, runners.
- A ship sinks when its hull or its reactor is at nothing; an escort runs when its hull is under 15% (as now). The attacker wins when the objective ship sinks; the defender when the attacker's flagship sinks or the clock runs out; the runners decide an evacuation or a blockade as now.

`createLedger({ plan, seed, lines })` gives the same `state(t, value)` the director does (its objectives' hp, its stages, the losses with their times, the winner), so `battleStages.js`, `warfront.js` and the HUD keep working; the director keeps its pacing (the stages' gates, the waves, the aces) and loses its curve. The local battle's capitals take their hull and their fate from the ledger (the AI's fire there still only lights them up), so what a pilot sees sink is what sank. The ledger is tuned so the AI alone gives each side a fair chance by seed (between 40% and 60% over 200 seeds, `battleLedger.scenario.test.js`), and a pilot's runs on the generators and turrets tip it.

### 8. The systems' standing battles, live

`world.js`'s `battle` piece is replaced by a small battle on the real engine: `layBattle(sys, war)` for the war you are in (so it is era-correct by piece 1), 6 fighters a side (3 at low), its own capitals' arcs and salvos, its fighters launched from their carriers again when they are down, no director, no plan, no end; stepped at a quarter rate beyond 400 units and frozen beyond 1,200. It is on only while the war battle is not, as now.

### 9. Launch from a Venator's hangar

A Clone Wars battle you join on the Republic's side starts you in a hangar bay of its flagship (the hangar kit, piece 3): your ship on the deck between two ARC-170s, the door open on the battle, a clone's call, and you fly out through the door into the fight. It is a set piece like the hangar run (`warpieces/hangar.js`), placed in the bay of the flagship's model, and it leaves when you are out (or after 20 s, the ship pushed out). Not in a battle already more than 8 minutes old, and not on a second join in one battle.

## What is not in it

- No new models beyond the assets release; a kind with no model (a Hyena bomber, a V-19) is not added, and its role is filled from the roster.
- No change to the player's own ship, its guns or the hangar's upgrades.
- Places stay in every war: the Death Stars, the Shield Gate and Cloud City are not ships, and Endor's and Scarif's set pieces and obstacles hang on them. Whether the second Death Star should hang over Endor in the Clone Wars is a question for the owner, not this design.
- No sound beyond what each effect already plays.
- The universe map's Rick and Morty and Breaking Bad wars change only where they share the engine: arcs and salvos, wrecks and the ledger behave the same there, each piece checked on the Rick and Morty war (`scripts/universe-war-check.mjs`).

## How each piece is checked

- `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- Pieces 1 and 2: `node scripts/roster-audit.mjs` exits 0 and its table goes in the PR.
- Pieces 3, 4, 5, 8, 9: screenshots from `scripts/galaxy-war-check.mjs` (Coruscant in the Clone Wars as the Republic, Endor in the Civil War as the Rebellion, Mandalore in the Remnant War) at high, with the before and after under `docs/superpowers/evidence/space-battles/`.
- Piece 7: the scenario test's win rates, and a two-browser check that two pilots see the same ships sink at the same second.
- Frame time at high in a 32-a-side battle within 10% of today's (`scripts/galaxy-check.mjs`'s timing).
