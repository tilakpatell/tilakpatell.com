# The Battlefront rulebooks: the hand values

Everything under `src/data/bf2017/` is written by `node scripts/bf2017-data.mjs all --root <export> --level hoth_01 --era Orig` from the 2017 game’s data, each number with a `_source` naming its record, except the two files below, which carry `"source": "hand"`. One line per hand value: what it is, why it is by hand, and where to look to replace it.

## `maps/hoth.stages.json`

The stage order and objectives of Hoth’s Galactic Assault are a logic graph in the game (`PF_GameMode_Conquest_Staged`, `FantasyBattle_Logic`’s `Delay`, `Compare` and `IntHub` nodes), readable by a person and not by a script. What the data does say, and this file follows:

- **Three stages**, not four: the strings name `STAGE1` to `STAGE3`, each with a line per team (`TAKE OUT THE WALKERS` / `TAKE OUT ANY THREATS TO THE AT-ATS`; `STOP THE IMPERIALS FROM ENTERING THE BASE` / `ADVANCE AND SECURE THE HANGAR AREA`; `HOLD OFF THE IMPERIAL ATTACKERS UNTIL OUR ESCAPE` / `STOP THE REBELS FROM ESCAPING`). The ids are `walkers`, `hangars`, `escape`.
- **walkers**: two escorts, one per walker path: `FantasyBattle_Logic:123` starts beside the AT-AT spawner `FantasyBattle_Logic:59` and `:303` beside `:208`, both ending at the hangar gates. The six `uplink` objectives are the six 3 m-high volumes in `FantasyBattle_Logic` along the paths; that they are the uplinks the Rebels arm to call the bombers is read from where they sit, not from the graph. Check it against `PF_EscortTracker` and the `SW02_VO_Walker` prefab’s links.
- **hangars**: the two 10 m-high volumes `FantasyBattle_Shapes:33` and `:68` sit behind the two hangar gates (the gate spheres `FantasyBattle_Shapes:73` and `:23`, radius 12.09 m, each with a `PF_Hoth_Destruction_Gate` and a `PF_CapturePoint`: `FantasyBattle_Logic:209` and `:134`). Which is east and which west is a guess: east is the larger X (251 m against 179 m), taking +X as east. Swap the two `name`s if the game’s compass says otherwise.
- **escape**: the three `PF_Interact_PlanetaryBattle_Bomb` prefabs deep in the base (`FantasyBattle_Logic:4`, `:131`, `:63`, west to east) take the three fuel strings in that order: depot, pipes (`_FUEL_SILO` reads “FUEL PIPES”), station. The order is a guess; the names are the game’s.
- **spawns**: each stage’s spawn areas (`SpawnLocationFinderShapeData`, Empire team 2 attacking, Rebels team 1 defending) are chosen by how far the front has come, on the Z of each area’s centre: walkers, attack Z −900 to −1150, defend −1150 to −1420; hangars, attack −1150 to −1420, defend −1420 to −1600; escape, attack −1420 to −1720, defend −1600 to −1720. The data’s own switch is each area’s `Enabled` flag, set by the graph; read it there to replace the bands. The drawing behind these choices is `docs/superpowers/evidence/battlefront-lane0/hoth-layout.svg`.
- `vehicles`: the AT-AT in the walkers stage, from the map’s `vehicleSpawns`.

## `points.json`

Battle Points are a logic graph too (`Prefabs/GameplaySupply/PF_Gameplay_BattlePoints_Local`: an `IntEntityData` default 1000 and an `EventToInt` of 1 to 4). Until that graph is read:

- `earn.kill` 100, `assist` 50, `vehicleKill` 150, `heroKill` 250: the game as played.
- `earn.objectiveTick` 10 a second on an objective, `objectiveDamage` 1 a point of damage to one, `squadSpawn` 25: the game as played.
- `cost.aerial` 1000, `enforcer` 2000, `infiltrator` 2000: the deploy screen as played (the three kinds are the data’s `Class_Special_*`).
- `cost.vehicles.default` 500, the AT-ST (`Kit_Vehicle_ATST`) 1500, the AT-AT (`Vehicle_Ground_AT-AT_MP`, the map’s walker) 0 since the mode gives it: as played. Keys are `vehicles.json` row ids.
- `cost.heroes.default` 4000: as played.
- `limits.heroesPerTeam` 1, `reinforcementsPerTeam` 4: as played.
- `bpRate` 1: the Instant Action option `InstantActionBPRate`’s default (“DEFAULT” of SLOW, DEFAULT, FAST; `ai.json`’s `instantAction`) as a multiplier.

## Read, not by hand, but worth knowing

- Weapon names are the strings `ID_W_<id>`; class names `ID_C_<CLASS>_TROOPER` or `ID_C_<CLASS>` (the Specialist has neither: its name is empty); hero names `ID_CHAR_<HERO>`. Ability and star card names follow no key the data shows and are left out.
- Vader’s armour levels read 850, 875, 900, 950 (`Affector_Health_DarthVader_VaderArmor1..4`).
- A mount’s own health is 1 (`WSMountHealthComponentData`): its rider takes the hits.

## `maps/sb_endor.stages.json`

Endor’s space level (`Levels/Space/SB_Endor_01`) says its Starfighter Assault plainly: `SpaceBattle_Gameplay`’s `SpaceBattleObjectiveListEntityData` lists the phases in order (`Phase 1 - Corvettes`, `Phase 2 - Mines`, `Phase 3 - MC80`, then an empty `Intermission`), each with its objectives by name, the attacker (`Team2`, the Empire) and the defender (`Team1`, the Rebels), and its side objectives (the TIE bomber flights). The map row keeps it as `spaceBattle`. What the hand file adds:

- **Five stages, from three phases**: the MC80’s phase is three in the game’s strings (`…_PHASE_3` the top, `…_PHASE_3B` from beneath, `…_PHASE_3C` the rear engines), so the stages are `corvettes`, `mines`, `top`, `beneath`, `engines`, the last breaking the MC80 up.
- **corvettes**: `CR90_A`, `_B`, `_C` are the three `PF_CorvetteCR90_01` in `SpaceBattle_SecondaryObjective_Cruisers` (`:69`, `:377`, `:875`), in the layer’s order; each sinks its corvette.
- **mines**: the six `PF_Endor_SpaceBattles_Transmitter_Objective` in `SpaceBattle_ScriptedEvents` (named `REBEL MINE` in the prefab) take `Destroy Mine A` to `F` in the layer’s order: a guess.
- **top, beneath, engines**: the MC80 target prefabs (`Objectives/PF_SpaceBattles_MC80_target_*`) each hold one part of the MC80 the mode’s sub-level places (`TL01` the large nodule 01, `TL02` 02, `TR01` 04, `TR02` 03, `bottom_front` 05, `bottom_left` 06, `bottom_right` the nodule hangar, the final stage’s engines the engine target collision); `MC80 A1` to `A4` and `B1` to `B3` take them in that order: a guess.
- **gates and hp** (`opensAt` 0, 150, 270, 360, 440 s; hp 210, 240, 200, 170, 160): hand, so a battle the AI fights alone runs its ten minutes about as the galaxy’s battles do (`universe/battlePlan.js`’s `PLAN`).
- **bombers**: four of the eleven TIE bomber flights, one a stage, three bombers each (the layer’s `Vehicle_Air_TieBomber` spawns stand in threes), at hand times.
- **camera**: the level’s intro and outro cameras are Cinematics tracks (`Partition_*` `GroupTrackRootData`), not `CameraEntityData`; the hand camera is behind the Star Destroyer, looking at the MC80.
- **fighters**: the level’s own classes as the galaxy’s kinds: X-wing, A-wing, Y-wing; TIE fighter, TIE interceptor, TIE bomber.

## `maps/sb_kamino.stages.json`

Kamino’s space level (`Levels/Space/SB_Kamino_01`), read the same way: the Separatists (`Team2`) attack, the Republic (`Team1`) defends; the phases are `Phase  - Venator Bridges` (the game’s own double space), `Phase 2 - Cruisers`, `Phase 3 - Venator Returns`, and the last is two stages by its strings (`…_PHASE_3` the engines, `…_PHASE_3_A` the beam weapon). Its launch points are its phases’ own layers (`SpaceBattle_Phase1` to `3`; Fondor’s `_EmpireSpawns` and `_RebelSpawns`, the droid battleship’s `Spacebattle_Phase1`), each spawn kept with its `phase`.

- **ships**: the mode’s sub-level places two Venators (`venatorstardestroyer_hull_01`, `#0` and `#1` in its order), three Republic cruisers (`jedicruiser_hull_01`, 318 m, drawn as the galaxy’s corvette at their own length) and three Providence dreadnoughts. The Venator with the engines’ and the beam weapon’s health states is the one that returns: the flagship.
- **bridges**: `Bridge A` and `B` are the first Venator’s two control towers (`venatorcontroltowerleft_healthstate#0`, `right#0`): which is A is a guess.
- **cruisers**: `Cruiser A` to `C` the three cruisers in the sub-level’s order; each sinks its ship.
- **engines, beam**: `Engine A` the left engines’ health state, `B` the right’s (a guess); `Laser` the laser base’s.
- **gates and hp**, **bombers** (two of the droid bomber flights), **camera**: hand, as Endor’s.
- **area**: the level is fought low over Tipoca City in the storm, not in orbit, so it has an area of its own (`galaxy/levelArea.js`): a dome 9 km across round the battle, well off the planet on its night side, with the level’s own storm panorama for its sky (`T_Kamino_Stormy_01_Panoramic_C`; `Stormy_02`’s export is clipped to white), a sea under the city, and the storm’s fog. The export has no water: the city’s “endless” pillars run from −1,090 m down past −2,400 m, so the sea’s −1,400 m is hand, as are the fog’s thickness (about 8 km to see) and how much its colour, the light record’s horizon, is dimmed for the storm (`dim`). The area is lit by the space level's own records (`light/sb_kamino.json`, `light`; its sun, fog distance and no grade), its fill the outdoor light's stored sky and ground colours (`fill`), its shine multiplayer Kamino's probe (`probe`: the space level's own sees a black sky).
- The game’s Team1 is the light side’s in every level read so far (Hoth, Endor, Kamino), as the battle’s team 0 is.

`maps/sb_fondor.json` and `maps/sb_droidbattleship.json` are the rulebooks alone (their systems are not in the galaxy yet): Fondor’s phases are Cruisers, Shields, Clamps and Reactor; the droid battleship’s Tractor Beams, Generators, Towers and Reactor.

## Heroes vs Villains and Blast (`maps/arenas.json`, `surface/missions/hvv.js`, `blast.js`)

`arenas.json` is cut from the five ground maps by `scripts/bf2017-arenas.mjs` (every number the rulebooks', checked by `arenas.test.js`). What the two modes add by hand, until lane D2 reads the `HeroArena` and `TeamDeathmatch` logic graphs (the HvV mods' and Instant Action Overhaul V2's):

- **The teams**: team 1's spawns are the light side's, team 2's the dark's, team 0's either's to come back at: a reading of the layers (each of HvV's two four-spawn clusters a side, the many team 0 spawns spread over the ground). Swap them if the graph says otherwise.
- **Geonosis_01's spawns** are all `Enabled: false` in the data (the mode's graph turns them on), so the cut takes every spawn, on or off.
- **Endor_01's Blast** has no spawns and no ground volume, only its two `TeamDeathmatch_Skirmish_DefendAreas`: the ground is the box round both, each side's spawns its area's corners drawn halfway in.
- **Where the grounds stand** (`arenas.js`'s `ARENA_AT`): Hoth's are inside Echo Base under the glacier (the level frame puts them 70 m up on the ice of the site), the other four worlds have no level pack, so each ground's middle goes on an open, level spot of the site: Hoth [320, 20], Endor [−40, 320], Tatooine [220, 100], Geonosis [110, −360], Kashyyyk [60, −400].
- **HvV, the game as played**: a target a side, drawn at the start and again when one falls; only a target's death scores; **10 points** win; 4 a side; 10 s to come back; 10 s out of the arena and you're down.
- **HvV, the bots' tuning** (measured, not the game's): a saber stroke takes 150 of a hero's health, lands 0.35 s into it; a blaster bot fires a burst at its gun's rate but no more often than every 1.2 s (the guns' trigger rates are a player's: Lando's 400 a minute out-shot everyone), hits 75 % point blank to 30 % at 60 m, a saber hero turns 70 % of what it sees; one of yours takes 100; the enemy's target counts 40 m nearer when a bot picks its mark. The heroes' health, healing and guns are the rulebooks' (`bf2017Abilities.json`, `heroes.json`'s regen, `weapons.json`).
- **Blast, the game as played**: **100 kills**, 10 a side (the tier's soldiers cap it). Tuning: a soldier's hit takes 14 more than the assault's (three hits down, not four), they roam within 0.3 of the ground's size round the point halfway between the two sides' spawns, and come back at the level's spawn nearest that point with no enemy within 30 m.

## `saber.json`

Written by `node scripts/bf2017-data.mjs saber` (`scripts/lib/bf2017-rulebook-saber.mjs`, which says how each record is read). One block carries `"_source": "hand"`:

- **`hand.broken`** 1.2 s: how long a hero reels when its block breaks at no stamina. The deflect prefab sets the state machine’s `OutOfStamina` channel when the `AbilityResource` falls under 1 (`stamina.out`, read), but the reaction it plays and its length are the Ant state machine’s, which the export doesn’t hold. Replace it with the length of the hero’s guard-break clip if one is measured into the stroke tables.
- **`hand.standIn`** `luke`: a figure on the game’s rig with no saber of its own in the game (the Emperor, a clone) fences by Luke’s row, so there is one set of rules.
- **`hand.combo`** 0.45 s: after a strike ends, how long the next continues the chain rather than starting it again. The chain is the Ant state machine’s (`HeroMelee_Attack_StrikeIndex` counts it), not exported; this is the site’s number from before, kept.
- **`hand.roll`** 3.5 m over 0.63 s: the dodge of a figure with no dodge clip of the game’s (the crews from elsewhere, on the clip library’s `roll`). Every figure on the game’s rig dodges by its own pack’s `dodge.<way>` clip and that clip’s root travel (Luke’s: 3.3–3.5 m by 0.6–0.7 s); this is Luke’s `dodge.front`, measured from `clips-luke.glb`, so the others dodge as far.
