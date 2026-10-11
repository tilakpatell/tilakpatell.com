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

## `held.json` (the weapons in hand: `node scripts/bf2017-held.mjs --root lab/assets/bf2017`)

Every number is read; these are the hand parts around them.
- **`stance`** is a hand label: the weapon’s `AnimBaseSet` to the stance pack the site packed for it (`wabsRif` → `t`, `wabsPstl` → `p`, `wabsLMG` → `l`: `lib/three/walrusSets/stance.js`’s keys). The game picks its anim set by that name too; the pairing is ours.
- **The muzzle is the bone, the flash its effect’s offset.** The game spawns a bolt at the camera and draws it from `Wep_Muzzle` (the firing records’ `Shot.WeaponBone`, `SpawnVisualAtWeaponBone`), so the bolts start at `muzzle`. On the A280 (11 mm up, 8.5 mm out), DH-17 (26 mm down) and RK-3 (55 mm down) the flash sits off the bone; it is kept for the flash.
- **The converge distance** a drawn bolt takes to slide from the gun onto the sim’s line (`battlefront/fx/bolts.js`’s `CONVERGE`, 15 m) and **the catch-up time** it takes to reach the sim’s bolt, which the sim has a step out when it is first seen (`CATCH_UP`, 0.1 s), are by hand: the game hides the gap behind its camera spawn and the bolt’s speed, and no record holds a number for either.
- **How long a stopped bolt stays drawn** (`battlefront/battle.js`’s `SPENT`, 0.15 s, three of the sim’s steps): a bolt a wall, a body or its range stops is kept in the page’s view, `ended` where it stopped, so the drawing reaches it from the gun; most stop in the step they’re fired (a rifle’s 700 m/s is 35 m a step), and with the nav mask’s walls on Hoth more of them do. By hand, past `CATCH_UP`; a stopped bolt slides onto the sim’s line by where it stopped when that is nearer than `CONVERGE`.
- **The figure’s turn** (`battlefront/figures/facing.js`): the packed clips face +X because the packer drops `AITrajectory`; the clips’ own constant on that node, −90° about y, is put back on each soldier’s body.

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

## `maps/sb_fondor.stages.json`

Fondor’s space level (`Levels/Space/SB_Fondor_01`, the sixth design’s lane fighters): the Rebels (`Team1`, the objective list’s `attacker` 1) attack, the Empire defends a Star Destroyer in the shipyard’s dry dock; the phases are `Phase 1 - Cruisers`, `Phase 2 - Shields`, `Phase 3 - Clamps & Reactor` and an empty `Intermission`. The level’s strings name its parts: the cruisers are Gladiators (`…_GLADIATORS_ATTACK`, `…_NAME_IMPERIAL_CRUISER`), the shields projectors, the clamps couplings.

- **ships**: the mode’s sub-level places the Star Destroyer (`stardestroyer_hull_01`), two Gladiator cruisers (`imperialcruiser_hull_01`, 348 m: drawn as the galaxy’s light cruiser at their own length), the MC80 (`mc80_mainhull_01`) and four CR90s (`corvettecr90_01`). The pack leaves the cruisers and the corvettes to the battle, which sinks them.
- **cruisers**: `Cruiser A` and `B` the two cruisers in the sub-level’s order; each sinks its ship.
- **shields**: `Shield A` to `D` the four `drydock_shield_generator_01` in the sub-level’s order (a guess which is which).
- **clamps, reactor**: the last phase is two stages, as Kamino’s is: `Clamp A` to `D` the four `o_drydock_clamps_lower_01_static`, then the `Reactor`, the Star Destroyer’s `stardestroyer_solarionizationreactor_01`; it breaks the Star Destroyer up.
- **gates and hp**, **bombers** (two Y-wing flights: the level places thirteen Y-wing spawners), **camera**: hand, as Endor’s.
- **area**: Fondor is no system of the galaxy’s yet (E5 adds it), so its battle is fought in an area of its own, entered from Coruscant (`starfighterMaps.js`): the dome 12 km across round the battle, its sky the level’s own star field all the way round (`t_space_no_large_stars_01_c`, the extras’ `PanoramicTexture`, `bf2017-sky.mjs --webp`, its `gain` by eye), no sea, no fog. No light record is read: inside it the galaxy’s own keys light it.

## `maps/sb_droidbattleship.stages.json`

The droid battleship’s level (`Levels/Space/SB_DroidBattleShip_01`, over Ryloth): the Republic (`Team1`) attacks the Separatists’ Lucrehulk; the phases are `Phase 1 - Tractor Beams`, `Phase 2 - Generators`, `Phase 3 - Towers & Reactor` and an empty `Intermission`, the last two stages by its strings (`…_PHASE_3` the towers, `…_PHASE_3A` the core).

- **ships**: of the Venators the sub-level places, the two within 8 km (`venatorstardestroyer_hull_01#1` the flagship, `#0`); of the dreadnoughts, `#3` and `#2`; two of the three Republic cruisers (`jedicruiser_hull_01#0`, `#2`): the third, `#1`, is held by the tractor beams inside the Lucrehulk’s ring, where the battle’s hull spheres round the ring would hold it. The Lucrehulk is the ring’s centre sphere (`…_centersphere_exterior_01`), 3,170 m.
- **tractors**: `TractorBeam A` and `B` the two `…_tractor_01_base` in order; **generators** `PowerGenerator A` to `D` the four `…_transmissiontowerpowergenerator_01`; **towers** the two control bridge towers by side; **core** the `Reactor`, `…_thecore_conceptobjective_01`, which breaks the battleship up.
- **gates and hp**, **bombers** (two BTL Y-wing flights: the level places thirty-one), **camera**: hand.
- **area**: fought in an area of its own entered from Naboo, where the space lane set this level’s blockade (Ryloth is no system of the galaxy’s): a dome 20 km across, the level’s star field round it, no sea, no fog.

The game’s Team1 is the light side’s on Fondor and the droid battleship as well; there the light side attacks.

## Heroes vs Villains and Blast (`maps/arenas.json`, `surface/missions/hvv.js`, `blast.js`)

`arenas.json` is cut from the five ground maps by `scripts/bf2017-arenas.mjs` (every number the rulebooks', checked by `arenas.test.js`). What the two modes add by hand, until lane D2 reads the `HeroArena` and `TeamDeathmatch` logic graphs (the HvV mods' and Instant Action Overhaul V2's):

- **The teams**: team 1's spawns are the light side's, team 2's the dark's, team 0's either's to come back at: a reading of the layers (each of HvV's two four-spawn clusters a side, the many team 0 spawns spread over the ground). Swap them if the graph says otherwise.
- **Geonosis_01's spawns** are all `Enabled: false` in the data (the mode's graph turns them on), so the cut takes every spawn, on or off.
- **Endor_01's Blast** has no spawns and no ground volume, only its two `TeamDeathmatch_Skirmish_DefendAreas`: the ground is the box round both, each side's spawns its area's corners drawn halfway in.
- **Where the grounds stand** (`arenas.js`'s `ARENA_AT`): Hoth's are inside Echo Base under the glacier (the level frame puts them 70 m up on the ice of the site), the other four worlds have no level pack, so each ground's middle goes on an open, level spot of the site: Hoth [320, 20], Endor [−40, 320], Tatooine [220, 100], Geonosis [110, −360], Kashyyyk [60, −400].
- **HvV, the game as played**: a target a side, drawn at the start and again when one falls; only a target's death scores; **10 points** win; 4 a side; 10 s to come back; 10 s out of the arena and you're down.
- **HvV, the bots' tuning** (measured, not the game's): a saber stroke takes 150 of a hero's health, lands 0.35 s into it; a blaster bot fires a burst at its gun's rate but no more often than every 1.2 s (the guns' trigger rates are a player's: Lando's 400 a minute out-shot everyone), hits 75 % point blank to 30 % at 60 m, a saber hero turns 70 % of what it sees; one of yours takes 100; the enemy's target counts 40 m nearer when a bot picks its mark. The heroes' health, healing and guns are the rulebooks' (`bf2017Abilities.json`, `heroes.json`'s regen, `weapons.json`).
- **Blast, the game as played**: **100 kills**, 10 a side (the tier's soldiers cap it). Tuning: a soldier's hit takes 14 more than the assault's (three hits down, not four), they roam within 0.3 of the ground's size round the point halfway between the two sides' spawns, and come back at the level's spawn nearest that point with no enemy within 30 m.

## The other Galactic Assault maps’ stages (`maps/{endor,tatooine,geonosis,kashyyyk,yavin,kamino,deathstar02}.stages.json`)

Each map’s stage order is a logic graph, as Hoth’s is. What these files take from the data: the stages’ count and order as the level’s own stage strings number them (`ID_FANTASYBATTLES_<LEVEL>_STAGE<n>_TEAM<k>`; Geonosis’s `ID_FANTASYBATTLE_GEONOSIS_{REP,CIS}_PHASE_<n>`), each team’s line in English. By hand:

- **`attackers`**: the side whose first stage line does not defend (`DEFEND`, `STOP`, `HOLD`, `KEEP`, `FEND OFF`, `TAKE OUT THE` the escorted vehicles): Endor, Geonosis and the Death Star II the light side; Tatooine, Kashyyyk, Yavin and Kamino the dark. It agrees with the game.
- **`objectives`: empty.** No route plays these maps’ Galactic Assault yet; the lane that does chooses each stage’s capture volumes, prefabs and spawns from the map rulebook as Hoth’s were chosen (its section above), not this lane.
- Naboo_01 has no stage strings of its own (its Galactic Assault layer names only the planetary missions’), so it has no file.

## Every map rulebook (`maps/<world>[.<n>].json`, the sixth design’s lane maps)

`node scripts/bf2017-data.mjs map --root lab/assets/bf2017 --level <key>` for each of the 44 usable maps (`scripts/lib/bf2017-map-audit.mjs`’s `USABLE`): `hoth_02` → `maps/hoth.2.json`, a campaign map `a1_m0lib_ds02` → `maps/a1_m0lib_ds02.json`. The mode layers are the game’s own ids (`UI/Data/GameModes/<id>`’s `GameModeId` and Aurebesh name): `Domination` is Strike (its prefabs `PF_Strike_Bombs`, `PF_Strike_CTF`, `Pf_FlagDropOff`), `Mode1` Supremacy, `Mode3` Ewok Hunt, `Mode5` and the Strike/Extraction maps’ `Extraction` Extraction, `Mode6` Hero Showdown, `Mode9` the co-op missions, `ModeC` Jetpack Cargo, `Mode7` Hero Starfighters. Until this lane, the reader named `Mode9` Strike and `Mode6` Extraction; nothing read those rows. `unplaced` lists an objective prefab a mode’s layer names with no transform (a mode refuses that map until it is placed); the file’s `_from.unplaced` says how many, and the ledger’s check holds the two together. A campaign map’s rulebook is its mission’s `ObjectivesDefinition` tree (`objectives`), its manifest’s vehicle spawns and terrain; the front end’s two stages have none.

## The other modes (`src/lib/battlefront/modes/strike.js`, `extraction.js`, `ewokHunt.js`, `supremacy.js`; lane 6)

Each mode reads its map rulebook: the spawns of its layer by team, its prefabs, and the `inputs` its sub-world wires into them (the property connections across its layers; the field names are the logic graphs’ djb2-xor hashes, read where a name was found). From the records:

- **Strike**: `DefendingTeam` (Naboo_01’s interface: Team1), `BombALocation` and `BombBLocation` (two of the layer’s locators); the carried objective’s return, 20 s (`PF_Strike_CTF`’s `FloatEntityData` 171 into the `StopWatch` the drop starts; `OnPickedUp` resets the delays); sixteen players (`UI/Data/GameModes/Domination`). By hand: the round’s 600 s, the setup and pause (Galactic Assault’s 12 s and 6 s), the drop-off’s 4 m (`DROP_RADIUS`), the light side defending where no team is wired, the match to the side with more rounds and at one each the faster attack.
- **Extraction**: `CheckpointPosition1` to `3` and `CP1Overtime` to `CP3Overtime` (Jabba’s palace: 240, 270, 300 s), read as the time to reach each checkpoint; the cargo where the level places `PF_Mode5_Objective_*`; the light side carrying (`PF_GameMode_Mode5`’s own interface, `TeamId Team1`). By hand: Kessel’s checkpoint times (its level wires none and the prefab’s defaults are empty in the export: 300 s), the checkpoint’s 6 m, the dropped cargo lying until taken up again.
- **Ewok Hunt**: the night’s 480 s (`PF_GameMode_Mode3`’s interface), the extraction opening with 121 s left (its `CompareFloatEntityData` 83), the extraction points (`PF_UI_ExtractionPoint_Marker_Mode3`, one by the seed), the stormtroopers’ 200 health (`Affector_Mode3Health`) and the Ewoks’ 80 (`Affector_Special_Health_Ewok`), twenty players (`UI/Data/GameModes/EwokHunt`). By hand: the troopers the dark side and the attackers, the extraction’s 8 m, the arena’s split of 15 troopers and 5 Ewoks.
- **Supremacy’s ground half**: the five `PF_CapturePoint_Mode1` in `ObjectiveIndex` order with their `CaptureDuration` (20 s), each side’s `MaxReinforcements` (`PF_UI_Mode1`: 70), forty players (`UI/Data/GameModes/Mode1`). By hand: the bleed (one every 5 s from the side holding fewer posts), a post’s 10 m, the ground’s 1,200 s cap. The capital ships’ half (`PF_DestroyableObjective_Venator`, `MaxBoardingTickets`) is not played; the mode’s `gaps` says so.
- **The arenas** (`src/lib/battlefront/fixtures/modeArena.js`): each map’s field is a plane through its mode’s spawns, crates round its objectives, walled on the edge of a 250 m margin; the sides are Hoth’s Original-era soldiers (`teams.json` holds Hoth’s alone). A bot fled to its flee query’s cover slot counts as in cover for the arena’s stuck rule.

## The Battlefront world's collision with buildings (`levels/hoth/nav.bin`, `lib/battlefront/navMask.js`, `battlefront/map/collision.js`)

The game's navmesh (`PathfindingBlobAsset`) is opaque, so the navgrid's mask is built from the game's own Havok shapes (the pack's `physics/*.bin`) by `scripts/bf2017-nav.mjs`: a cell is blocked when the soldier's capsule meets a shape at its middle. The capsule is the records' (`DefaultSoldierPhysics#CharacterPhysicsData.PhysicalRadius` 0.3, from `Poses[0].StepHeight` 0.4 to `Poses[0].Height` 1.7, read from `physics/soldier.json` and written into the file's header with their sources); what is by hand:

- **The fine grid's 0.5 m** (the walkable test's): four to a navgrid cell. The game's `CoverConstants.TerrainHeightSamplingStep` is 0.25; half as fine measured clean (22 of 22 paths a side) at an eighth of the bytes.
- **Where the fine grid is sampled**: only in a cell whose middle a capsule grown to the cell's corners (2 m × √½ + 0.3) meets, so a wall thinner than a cell between two middles is still in the fine grid.
- **A blocked cell's top** (for the line of sight and the cover slots) is a ray down from 25 m over the ground (`TOP_REACH`: a byte of decimetres); where the ray misses though the capsule met a shape, the capsule's height, 1.7 m.
- **The mask's cover slots** come one to a navgrid cell along its edges (2 m apart, not `SlotSpacing`'s 2.2: the mask has no faces longer than a cell), set back `OcclusionCheckDist` 0.7 from the face, crouch or stand by `CrouchHeight` 0.94 and `StandHeight` 1.7 as the box slots are. The game's `CoverZones` are not exported.
- **The camera's sweep radius** is `StormTrooperShared#SoldierCameraComponentData.CameraCullSphereRadius` 0.15, read as the ball swept along the arm; the records name no camera collision radius beyond `SoldierThirdPersonCameraData.CollisionWidthPadding` 0.17, which `camera.js` already takes off the hit. The ground march's 0.2 m step and 0.25 m clearance are the page's own, as before.
- **A box solid blocks only above a step** (`nav.js`'s `STEP_UP`, the record's `StepHeight` 0.4): a box whose top is under the ground plus a step (13,000 of Hoth's 47,000 hull boxes are buried) blocks nothing.

## Squads (`squads.json`, read by `lib/battlefront/ai/squad.js` and `spawn.js`)

`squads.json` is read from the game (`scripts/lib/bf2017-rulebook-squads.mjs`); what the code around it adds by hand:

- `IN_COMBAT` 5 s (`spawn.js`): how long a soldier hit, or hitting, cannot be spawned on. The game names what puts a soldier in combat (the killswitches `Online/Killswitches/SquadSpawn_InCombat_When*`, kept as `inCombat`) but keeps no time for it.
- `SQUAD_SAFE` (`spawn.js`) is the record’s `safeEnemyDistance` 50 m (`SpawnLocationFinderEntityData.SpawnSafeEnemyDistance`); that an enemy that near makes a mate “in combat” (`ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT`) is by hand. `pickSpawn`’s `SAFE` 30 m for spawn points stays by hand, as before.
- The block reasons by hand (`blocked`, `spawn.js`): a mate in the air (`'airborne'`) and a rolling mate show `ID_SQUAD_SPAWN_BLOCK_REASON_OTHER` (“UNAVAILABLE”), as the game has no airborne or rolling string.
- The leader (`ai/squad.js`): the first bot alive, else the first alive, so the bots keep to the commander’s order and not the player’s. The game’s squad leading is native code.
- `joinSquad` (`ai/squad.js`): a player takes the team’s first squad with room; with every squad full, the last bot of the first squad moves to a new one. The game’s parties and auto-partners (`AutoPartnerEntityData`, `TacticalGroupManagerEntityData`) are native code.
- The squad-spawn Battle Points stay `points.json`’s `earn.squadSpawn` 25: `UI/MetaData/ScoreUIMetaData` has the award “SQUAD SPAWN ON YOU” (identifier 2793359391) but `Persistence/Scoring/MPScoring` holds no score for it.
- The palette picks’ roles (`hud.palette`): the picks are the records’, in order; which feeds the name and which the icon is read by hand from the cell’s hashed graph (`docs/superpowers/evidence/battlefront-lane5b/research-squad.md`).
- An order’s letter is the objective’s place (A for the first), as the page names its objectives.

## The bots' minds (the sixth design's bots lane)

`ai.json`'s `system`, `coverQueries`, `coverScores`, `difficulties`, `skirmish` and `vehicles`, `ai.names.json` and `ai.creatures.json` are read from the records, every number with its `_source`. What the bots do with them is code (`src/lib/battlefront/ai/`), and where the game's own use of a number is compiled, the reading is by hand:

- **Targeting** (`targeting.js`): the distance scales (`TargetVisibleDistScale`, `CurrentTargetDistScale`, `ElevationDistScaleY`, `CurrentHumanTargetLowHealthDistScale`) multiply the distance read through `TargetDistanceEvaluation`, and `HumanPreferenceScale` multiplies the score: the names say so, the order is ours. `SuppressionScore` (front 0.5, back 0.7) is read as a bonus on a target facing the bot or turned from it (`source: "hand"`: the game uses it for its suppression targets). `VisibleTargetLimit` is read as the share of a squad that may share one target under the coordinator (1 in multiplayer: all of it). `PreferredRange` (start 10, ideal 0.5, end 30) is kept in the rulebook and not used.
- **Cover queries** (`coverQuery.js`): each score's x is read from its type's name (the angle at the slot between the solid's face and the target, the distance to the nearest enemy, the line of fire, …); a curve value of −1 or less rejects the slot, as the records' "[-] Reject" comments say; the cover-shape variants of `AngleToActor` (a `RuntimeFilter` with low bits) count by their best, since the navgrid's slots carry no shape; `CoverFilter`'s mask 3801088 ("Protected Covers") is read as a full-height slot. By hand: `MAX_SEARCH` 40 m (the farthest a query looks, under `Attack_PvE`'s 70), `STAND` 1.7 m (the game's `StandHeight`) and `SIDE` 1 m (the step round a tall solid for a line of fire). Path avoidance, nav probes and the follow and exposure scores are not read (`unreadScores`).
- **Difficulty** (`difficulty.js`): a bot's first shot at a new target waits `FiringDelayAfterAquiringTarget` at its distance, its aim settles over `TimeUntilAccurateFromStartOfFirstDamage` (in place of the brain's hand `AIM_SETTLE` when a difficulty is set), its aim box widens by the `AccuracyPenaltySettings` multiplier when its target sprints, crouches or lies prone, and its bolts on a player are scaled by `BucketDamageAiVsHuman.DamageMultiplier`. By hand: the difficulty's one aim number (`aim.scale`, the mode's aim lever) is its sprint penalty over the Medium row's (rookie 1.5, normal 1, expert 0.7); the damage buckets' timings are not modelled; a sim with no difficulty plays as before (lanes 1 and 2's tables).
- **The Skirmish bots** (`skirmish.js`): which AI logic prefab drives which class ability is read from their names (`ABILITY_LOGIC`: the four grenades → `Grenade`, Sentry, Combat Shield → `Shield`, Battle Command, Blaster Turret → `Turret`, Infiltration → `Infiltration02`, Scan Dart → `ScanPistol`; Vanguard and the Scout Binoculars have none); the logic's poll (its auto-starting 3–6 s delay), each prefab's gap between uses (a delay of 5 s or more), the shield's health threshold (0.5) and the sentry's range (50 m) are its data; `THROW` 25 m, the farthest a bot throws a grenade, is by hand.
- **Heroes vs Villains** (`missions/hvv.js`): the bots' decisions stay hand rules (no hero-bot record exists: the heroes' minds are logic graphs); a difficulty row scales a blaster bot's chance to hit by its aim scale and a bot's damage to you by its damage.
- **Names** (`names.js`): the game has no multiplayer list: a faction with no list for a mode takes its Skirmish list; a list that runs out numbers its names (`TK-772 2`); the Rebels' lists are the files named `Rebel_Resistance`.
- **The squadron trees** (`squadron.js`): the fighters fly `PF_DogfightBehaviour` (the multiplayer dogfight tree) unless told another; `FIRE_CONE` 10°, the cone the cannon fires and the missile locks inside, is by hand (the rules hold the timings, not the cone).
- **The creatures** (`creature.js`): `ExternalInfluence_Act` is read as a startle-run away from the player, out of the reaction's range, at the settings' medium speed; the wander's reach (`ROAM` 6 m) and pauses (`PAUSE` 2 to 6 s) are by hand; `FakeMass` is not used.
- **The walkers' gunners** (`vehicleBrain.js`): `ATAT_AI` holds the class (the firing patterns) and the range, not the gun: the gun is the AT-AT's chin cannon from `vehicles.json`; the turret's place (`TURRET` 15 m up, 8 m ahead), its sight (`GUNNER_SIGHT` 250 m: the row's 1,500 m is the gun's reach) and its spread (`SPREAD` 0.02: the row has no aim box) are by hand.

## `saber.json`

Written by `node scripts/bf2017-data.mjs saber` (`scripts/lib/bf2017-rulebook-saber.mjs`, which says how each record is read). One block carries `"_source": "hand"`:

- **`hand.broken`** 1.2 s: how long a hero reels when its block breaks at no stamina. The deflect prefab sets the state machine’s `OutOfStamina` channel when the `AbilityResource` falls under 1 (`stamina.out`, read), but the reaction it plays and its length are the Ant state machine’s, which the export doesn’t hold. Replace it with the length of the hero’s guard-break clip if one is measured into the stroke tables.
- **`hand.standIn`** `luke`: a figure on the game’s rig with no saber of its own in the game (the Emperor, a clone) fences by Luke’s row, so there is one set of rules.
- **`hand.combo`** 0.45 s: after a strike ends, how long the next continues the chain rather than starting it again. The chain is the Ant state machine’s (`HeroMelee_Attack_StrikeIndex` counts it), not exported; this is the site’s number from before, kept.
- **`hand.roll`** 3.5 m over 0.63 s: the dodge of a figure with no dodge clip of the game’s (the crews from elsewhere, on the clip library’s `roll`). Every figure on the game’s rig dodges by its own pack’s `dodge.<way>` clip and that clip’s root travel (Luke’s: 3.3–3.5 m by 0.6–0.7 s); this is Luke’s `dodge.front`, measured from `clips-luke.glb`, so the others dodge as far.
