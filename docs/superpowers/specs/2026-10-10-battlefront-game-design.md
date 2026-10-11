# Battlefront on the web: the 2017 game's modes, mechanics and AI, rebuilt from its own data. The design

Date: 2026-10-10. Status: **design, approved by the owner on 2026-10-10 (approach 1: a new world on the real maps), plans written for lanes 0 to 2**, by an architecting session for Opus 5.5 implementation sessions, one lane each. The plans: `docs/superpowers/plans/2026-10-10-battlefront-lane0-data.md`, `-lane1-soldier-ai.md`, `-lane2-galactic-assault.md`; later lanes get theirs as they start. The hand-off: `docs/superpowers/HANDOFF-battlefront.md`. The asset side is the sibling design `2026-10-10-battlefront-2017-asset-pipeline-design.md` (models, textures, clips through the bucket); the streaming of those assets to the page is another account's lane (`2026-10-09-asset-hosting.md` and its successors). This design is the **game**: rules, modes, mechanics, the bots, the world that plays them.

## What the owner asked

"A current session in this account and other PRs are taking (legally) the source code of BF2 and uploading it, and some are testing the textures. We want you to move the game logic and actual mini games like Galactic Assault and stuff, with the maps and textures, to this repo (it will be a private local game; we have all the licences). Architect how to do that: one session on another account is already working out how to do streaming, so start with other parts like game AI logic and NPC logic, then give it to Opus 5.5 to implement." Then: "Nobody cares about budget as long as it works and is good." Then: "Add all game mechanics, like Battle Points and stuff, and Frostbite engine mechanics." Then: "As long as it gets it from the game files for NPC logic, textures, models and mechanics, and converts it to JS that runs on the web in our repo, I'm happy. Do it."

The owner chose approach 1 on 2026-10-10: the game is its own world on the real maps, not a retrofit of the galaxy surface's assault.

## What the game files hold (measured, 2026-10-10)

Everything below was read from the owner's Frosty export at `C:\Users\tilak\Downloads\BF2_Extract` (`web\` masters, `web_opt\` the web build; `web_opt\README.md` and `GUIDE.md` describe it; game build 489592, Frostbite data version 20171117). The same files are going up to the private `bf2017-assets` bucket (`data/` had 45,224 of the 83,983 records on 2026-10-10; the maps, clips, physics and terrain are in `web_opt\` and go up on the same queue). Nothing here is decompiled: the game's logic runs in its executable, which is not read. What is read is the **data that parameterises it**, which is most of what makes the game feel like itself.

| what | count | where | what it gives this design |
| --- | --- | --- | --- |
| Gameplay data as JSON | 83,983 assets of 351 types | `web/data/**.json`, index `web/data.tsv` | every number below |
| Maps, built | 74 (34 multiplayer, 6 space, 30 campaign, 4 menu) | `web_opt/maps/<path>.json` + `.bin` | every placed model's transform, terrain, sky, vehicle spawns; Hoth is 24,518 instances of 599 meshes |
| Terrain heightfields | 39 levels | `web_opt/terrain/` 16-bit PNG, 2 m and 0.5 m per pixel | the ground |
| Havok collision | 10,530 assets, 114,377 shapes | `web_opt/physics/` GLB, hulls and trimeshes | walls the player and bolts hit |
| Animation clips | 10,270 (RAW, DCT, FRAME; 11,720 VBR not exported) | `web_opt/anims/<skeleton>/<clip>.glb`, `anims.jsonl` | the bots' and heroes' motion on the game's rigs |
| Strings | 19,482 | `web_opt/strings/English.json` | every objective, kit, ability and weapon name |
| Level logic layers | per level, per mode | `web/data/Levels/MP/<level>/<Mode>_*.json` | spawn points, capture volumes, defend areas, out-of-bounds, vehicle waypoints, which prefabs a mode uses |

### The modes, as the data names them

Internal names, read from the sublevels every multiplayer level carries:

| data name | the game's mode | what the layers hold |
| --- | --- | --- |
| `FantasyBattle` (prefab `PF_GameMode_Conquest_Staged`, `PlanetaryBattleStateManager`) | **Galactic Assault** | 219 `AlternateSpawnEntityData` on Hoth by team and priority, 16 `VolumeVectorShapeData` capture and objective volumes, 54 `SpawnLocationFinderShapeData` polygons by team, 19 `VehicleWaypointData` (the AT-ATs' path), `PF_EscortTracker`, `PF_CapturePoint`, `SW02_VO_BombInteract`, stage strings `ID_FANTASYBATTLES_HOTH_STAGE1_TEAM1` … `STAGE3_TEAM2`, objective strings `_FUEL_SILO`, `_FUEL_DEPOT`, `_FUEL_STATION`, `_EAST_HANGAR`, `_WEST_HANGAR` |
| `HeroArena` | **Heroes vs Villains** | arena volumes, hero spawns, the intro |
| `TeamDeathmatch` | **Blast** | spawns, kill counter |
| `Mode9` | **Strike** | `Mode9_Inf_Shapes_CaptureAreas` (8 volumes), `_DefendAreas`, `_OOBTeam1/2` (6 volumes), spawns per team |
| `Mode1` | **Capital Supremacy** (2019) | `PF_CapturePoint_Mode1`, `PF_Mode1_Ticket_Control`, boarding ships, `PF_DestroyableObjective_Venator` |
| `Mode6`, `Mode8` | **Extraction** and **Ewok Hunt** (by elimination; confirm in lane 6) | |
| `PlanetaryMissions` | **Arcade / Instant Action** | `InstantActionParams` (BP rate, enemy hero count, difficulty) |
| `SpaceBattles` (`PF_GameMode_SpaceBattle`) | **Starfighter Assault** | the six `SB_*` levels, `SquadronAI` |

On Hoth: Galactic Assault, Heroes vs Villains, Blast, Strike, Extraction, Arcade. On Tatooine, Yavin, Death Star II and Naboo also Capital Supremacy.

### The numbers that make the mechanics (samples)

| mechanic | number read | asset |
| --- | --- | --- |
| Blaster rifle fire | `RateOfFire 600`, burst of 3 at `BurstsPerMinute 110`, bolt `InitialSpeed 700` m/s, `OverHeatThreshold 0.8`, `OverHeatPenaltyTime 3`, `HeatDropPerSecond 0.2`, `DeployTime 0.8` | `Gameplay/Equipment/Rifles/A280C/WeaponFiring_A280C` (`WeaponFiringDataAsset`) |
| Heat per bolt | `HeatPerBullet 0.03334` (weapon), `0.042` with `HeatDropPerSecond 0.3`, `OverheatedDropMultiplier 1.5`, `OverheatDropDelay 5`, `HeatWarningThreshold 0.7` (config) | `W_BlasterRifle_A280C`, `OverheatConfig_Rifle_A280C` |
| Active cooling | success window `0.8 → 0.65` of the bar, shrinking by `OnSuccess 1`, reset `OnFailure −100`; `SuccessPenaltyTime 0.2`, `FailurePenaltyTime 0.3`, `MinimumTriggerHeat 0.1`; venting `1.0` s; a super window `0.4 → 0.3` | `OverheatConfig_Rifle_A280C` (`ActiveCooldownSettings`) |
| Dispersion by stance | six stances: hip `MaxAngle 0.8`, `IncreasePerShot 0.08`, `DecreasePerSecond 1.0`, `NoFireTimeThreshold 0.2`; moving `MinAngle 0.5`, `MaxAngle 1.5`; zoomed `0.7`, `0.05` a shot | `WeaponSway_A280C` (`GunSwayData.Dispersion[]`) |
| Recoil | camera spring `SpringConstant 3000`, `SpringDamping 0.84` | `WeaponSway_A280C` (`CameraRecoilData`) |
| Range | `MaxRangeMeterDistance 200` | `W_BlasterRifle_A280C` (`SoldierWeaponData`) |
| Class health | Assault `MaxHealth 150`; regen `RegenerationRate 30` a second after `RegenerationDelay 6` | `Kits/MP/Assault/Affector_AssaultHealth`, `Affector_AssaultHealthRegen` (`MaxHealthAffectorAsset`, `SoldierHealthRegenerationAffectorAsset`) |
| Combat roll | `TriggerCost 0.5` (two rolls a bar), `RechargeTime 4`, `ActiveTime 0.1`, speed and damage modifiers `0.85`, `0.95`, `0.8`, `0.9` by star card rank | `Ability_Assault_CombatRoll_CharacterState` |
| Soldier body | `FallDamageThreshold 30`, `LowHealthThreshold 20`, `TimeForCorpse 4.5`, `DyingMaxTimeInAir 6`, walk and run sound thresholds `1.0` and `5.5` m/s, third-person arm `1.2` m, `MaxPitch 55` | `Characters/Heroes/Hero_Lightsaber` (`SoldierEntityData`, `WSSoldierHealthComponentData`, `SoldierThirdPersonCameraData`) |
| Ragdoll | 15 bodies by bone (hips, spine, head, arms, legs), `MaxImpulse 1000`, `ImpulseLifetime 10`, `DismembermentProbability 20` (droids) | `WSEACharacterPhysicsComponentData`; `B1Dismemberment` |
| Hero health | Vader `800`, saber heroes `650`; armour multipliers | `Kits/Hero/DarthVader/Affector_Health_DarthVader`, `Hero_Lightsaber` |
| Hero ability | Force Choke `RechargeTime 25`, `ActiveTime 1.5` (`2.1`, `1.8` with cards), `ActivationTime 0.1`, seven modifiers | `Ability_DarthVader_ForceChoke_02` (`BasicPlayerAbilityAsset`) |
| Explosive | `BlastDamage 140`, `InnerBlastRadius 1.2`, `BlastRadius 1.7`, `ShockwaveRadius 8`, `BlastImpulse 500`; missile `MaxSpeed 200`, `TimeToLive 8` | a `ProjectileBlueprint` (`ExplosionEntityData`, `WSMissileEntityData`) |
| Damage over time | `InitialDamage`, `DamageToDealPerSecond`, `DamageInterval 0.5` by rank | `DamageAffectorAsset` (172 of them) |
| Capture point | meter thresholds `0.33`, `0.66`; a `60` s value; overtime function | `GameModes/Shared/CapturePoints/PF_CapturePoint`, `PF_CapturePoint_Overtime_Function` |
| Staged conquest | stage delays `120`, `10`, `9`, `7.2`, `6`, `5.8` s; a `12` or `2` s conditional; `StopWatch TriggerOnTime 5`; kill counters `MaxKillCount 65000`, compare `50` and `30` | `PF_GameMode_Conquest_Staged`, `PlanetaryBattleStateManager` |
| Battle Points | a local prefab with an `IntEntityData` default `1000`, event selections `1..4`, a stat trigger | `Prefabs/GameplaySupply/PF_Gameplay_BattlePoints_Local`; costs not found as numbers (see the hand table below) |
| Teams by era and map | `Team_Light_Orig_HO`: `Faction_Light_Orig`, `Heroes_Light`, `Specials_Light_Orig_HO`, `Vehicles_Light_Orig_HO`, `AllPlayerAbilities` (weapons `A280C`, `CR2`, `EL16HFE`, star cards `SC_Trooper_01_AssaultTraining` …), emotes, voice lines | `Gameplay/Teams/MP/Orig/*` (220 `WSTeamData`) |
| AI tactics | `EngageSettings.DistanceToTarget 40`, `SuppressionValue 0.15`; weapon suppression `0.75` for `10` s over `5` m; vehicle suppression `15` m | `AI/BattleAI/Tactics/AIRebelSoldierTactics` (15 tables: rifleman, heavy, officer, sniper, launcher, melee, jumptrooper, flametrooper, close range) |
| AI templates | `TargetLostTime 10`, `AlertPropagationSpeed 2`, `FireHeightOffset −0.5`, a projectile, a melee, locomotion settings | `AI/BattleAI/Templates/*_Template` (10) |
| AI firing patterns | 24 bit-pattern bursts with `Delay` 8 to 30 frames | `AI/BattleAI/Weapons/AIFiringPatterns` |
| Cover | `SlotSpacing 2.2`, `CrouchHeight 0.94`, `MediumHeight 1.1`, `StandHeight 1.7`, fire heights `0.3`, `0.6`, `1.24`, `1.3`; vault `1.4 → 0.5` m, ledge drop `2.5` to `3.5` m; occlusion ratio `0.7` | `AI/BattleAI/Cover/CoverConstants`; 60 scored cover queries (`Attack_*`, `Hide_*`, `Flee_*`, `Protective_*`, `MeleeAdvance`) |
| AI difficulty | accuracy curve `30` at 0 to 30 m falling to `15` at 60 m; a second curve `0 → 0.5` from 40 to 60 m | `Gameplay/Settings/GameDifficultySettings` (89 objects, `FloatCurve`s) |
| Spawning | spawn polygons by team with `Height`, `Tension`, `Points`; spawn points with `Team`, `Priority`, `Enabled`, a transform | `Levels/MP/Hoth_01/FantasyBattle_Shapes`, `FantasyBattle_Logic` |
| Out of bounds | 6 volumes per team | `Mode9_OOBTeam1`, `Mode9_OOBTeam2` |

### The look, the camera and the GUI (measured on Hoth)

| part | what the data holds | asset |
| --- | --- | --- |
| Visual environment | per weather: sun colour `(1.0, 0.956, 0.918)`, sky Rayleigh coefficients `(5.8e-6, 1.35e-5, 3.31e-5)`, cloud layer colours, fog curve `(2.23, −4.57, 2.92, −0.0088)` with depth and height media, exposure `EV 10`, bloom `BloomScale 0.1` with five Gaussian colours (`0.062/0.077/0.098` … `0.407/0.569/0.815`), colour correction (brightness, contrast, saturation, hue, `ColorGradingMaxHdrValue`), HBAO (`HbaoRadius 1.5`, `AngleBias 15`, `Attenuation 0.7`, `Contrast 0.65`, `PowerExponent 2`), shadows, sub-surface scattering, sun flare curves, motion blur, wind (`WindStrength 5`, `Direction 0`, turbulence), Enlighten sky colours (`SkyBoxSkyColor (0.84, 1.58, 3.0)`, `TerrainColor (0.55, 0.59, 0.64)`, `SunScale 0.5`) | `Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01` (`VisualEnvironmentBlueprint`, 30 components); `Sunset_01`, `Blizzard_01`, `Interior_01` likewise; 192 records across the game |
| Grading LUT | a 3D LUT per weather | `T_CC_Hoth_Sunny_01` (`GradingLutAsset`), the texture in the bucket |
| Placed lights | **exported**, in the level's lighting layer: 63 `PbrSphereLightEntityData` (colour `(22.3, 34.9, 48.0)`, `Intensity 55000`, `AttenuationRadius 30`, shadow near radius), 40 `PbrSpotLightEntityData` (`InnerAngle 70`, `OuterAngle 90`, `Intensity 65500`, `AttenuationRadius 20`), 56 `SimpleVolumetricsEntityData` (emission `(0.90, 1.21, 1.5)`, `Exponent 2`, `EmissionScale 0.2`), 4 `LightProbeVolumeData` (`5 × 5 × 5`, `BlendDistance 1`), and 416 lighting prefabs (`pf_lightwall_s_01_hoth_lit` × 93, `pf_lightceiling_m_01_hoth_lit` × 91 … each a fixture mesh plus its light), each with a transform; the hangar's own probe volumes and lights in `Hangar_01_Architecture` | `Levels/MP/Hoth_01/Default_Lighting` (589 objects), `Levels/Lighting/Hoth/Prefabs/*` |
| Probes and far shadow | 128² HDR cube probes per level and the distant shadow caches (#810's count) | `textures/levels/<level>/reflectionvolumetexture/*`, `distantshadowcachetexture/*` |
| Soldier camera | third person: `MaxPitch 55`, arm `1.2` m (`ThirdPersonCameraArmLength`), `MaxReducedArmLength 0.5` between pitch `5` and `70`, `CollisionWidthPadding 0.17`, collision blend in `5` and out `3`, `SoundListenerFov 55`, `ShakeFactor 1`; cull distances by stance (`StandCameraCullYDistance 1.8`, crouch `1.5`, prone `0.32`, dead `0.2`); shoulder side option (`OptionDefaultSoldierCameraShoulderSide`) | `Hero_Lightsaber` (`SoldierThirdPersonCameraData`, `SoldierCameraComponentData`); `Gameplay/Profiles/OptionDefaultSoldierCamera*` |
| Aim camera | `RenderFov 55` per zoom level, zoom in and out speeds | `W_BlasterRifle_A280C` (`WeaponZoomLevelData`) |
| Vehicle camera | a chain of camera transformers: `ThirdPersonCameraTransformerEntityData` (pitch `−35` to `24` for the AT-AT driver, `−35` to `42` and `−5` to `25` for its gunners, yaw and pitch inertia `0.8` with input and `0.5` without), `VelocityRedirectCameraTransformerEntityData` (conversion rates `6`, `100`, `−1.5`, `−10`), float curves | `Vehicle_Ground_AT-AT_MP_Camera` (and every vehicle's `_Camera`) |
| Deploy and outro cameras | 12 `CameraEntityData` per mode layer with transforms (`FocalLength 35`, `Aperture 8`, `ShutterSpeed 50`, `ISO 100`, `FocusDistance 1000`), one per objective and spawn group, and 23 locators the cinematics and the end card use | `Levels/MP/Hoth_01/FantasyBattle_Logic`, `Cinematics_Outro_Team1/2`, `EOR` |
| The HUD | 656 widget assets under `UI/InGame/Hud/`: `Abilities` (per hero screens, `AbilityRecharge`, `AbilityState`), `Weapons` (the heat bar), `Health`, `Objectives`, `InworldMarkers`, `Radar`, `KillLog`, `KillMessage`, `ScoreLog`, `DamageIndicator`, `Targeting`, `SquadMemberList`, `StarCards`, `Supply`, `Vehicles`, `Soldier`, `CommoRose`, `Warning`, `IngameMessages`, `Subtitles`, `TalkingHead`, `Progression`; `InGame/Death/DeathBattlepoints`, `InGame/Scoreboard`, `InGame/EndOfRound` (`OutcomeDeclarationHudWidget`, scoreboard cells), `Customize/Screens/SpawnOverlayScreen`, `UI/Art/HUD/_TextureMappings/GenericSoldierHUDTextures` (which icon goes where), `UI/Configuration/*`; each widget a tree of shapes, text fields, anchors and animations (`UI/Animation/*`) | `web/data/UI/**` (4,269 assets) |
| Icons and fonts | 702 SVGs (class, hero and ability icons, vehicle icons, objective markers, faction marks) and 23 fonts (the game's HUD faces: `LinotypeUnivers-*Cn*`, `RaxusPrimeNumericalMonospace_*` for the numbers, `Cuprum`, `Aurebesh`) | `web_opt/svg/**`, `web_opt/fonts/**` |

What is **not** in the data and is therefore authored, marked `source: "hand"` wherever it lands: Battle Point earn and cost tables (the prefab holds its logic as a graph, not a table), the stage order and objective types of each Galactic Assault map (a logic graph of `Delay`, `Compare`, `IntHub` nodes; readable by a person, not by a script), the bots' decision code (in the executable), the animation state machines (in the banks, not exported), the navigation mesh (opaque blobs). Each of these is written from the game as played and the strings it ships, and each is a small file a later session can correct against the graph.

## Where the repo is today (not rebuilt)

- **The asset pipeline** (`2026-10-10-battlefront-2017-asset-pipeline-design.md`, phase 0 merged as PR #805): `scripts/bf2017-fetch.mjs`, `scripts/bf2017-import.mjs`, `scripts/lib/bf2017-*.mjs`, the credit rule, the sequel-era refusal, `catalog/bf2017.js`. Phase 1 (`plans/2026-10-10-bf2017-phase1-heroes.md`) brings `src/lib/three/walrus.js`, a loader for figures on the game's skeleton driven by bone name, and `walrusRig.js` with the socket names. This design uses both and adds nothing to them.
- **AI toolkit** `src/lib/ai/` (utility, trees, perception, search, steer, spatial, influence, squad, social, needs; 62 tests). The bots here are built on it.
- **Combat rules** `src/lib/combat/` (aim, accuracy, bolt, blade, contact, duel, lockOn). The heroes' sabers use `duel.js` and `blade.js`.
- **Runtime** `src/runtime/` (chunkGrid, workers, origin, hud kit, look, gfx). The world uses the HUD kit and the look controller.
- **The galaxy surface's assault** (`galaxy/surface/missions/assault.js`): a homegrown staged battle with squads and cover on hand-drawn sites. Left as it is; this design does not touch it.
- **Physics** `@dimforge/rapier3d-compat` (`docs/stack/physics-rapier.md`) is in. **Supabase** is in. No new dependency is needed.
- **The second asset design, PR #810** (`2026-10-10-bf2017-levels-lighting-sabers-design.md`, written the same day by another session on this account): lane **L** builds a level pack from a map, its heightmap and its shapes (`scripts/bf2017-level.mjs`, `scripts/lib/bf2017-level.mjs`, `level-cells.mjs`) and draws it cell-streamed (`surface/level/levelPack.js`, `levelScene.js`, `levelStream.js`, `src/lib/level/collision.js`, the `image` ground layer in `src/lib/land/layers.js`); lane **G** derives lighting from the VisualEnvironment records; lane **X** measures each hero's strikes, blocks and reactions from the game's clips into stroke tables (`src/data/bf2017/strokes/<hero>.json`, `stanceFromTable.js`); lane **S** (amended) is the fetch pool over the shipped `src/lib/assetBase.js`; lane **V** brings the vehicle models. This design **consumes** those: the game's world (lane 5) runs lane L's pack builder and loader on the whole map in the map's own frame with fitting off (decision 15); its heroes (lane 3) read lane X's stroke tables; its vehicles (lane 4) wear lane V's models; its assets adapter sits on `assetBase.js` and lane S's pool. Nothing of theirs is rebuilt here.

## Decisions

1. **The game is its own world: `src/components/battlefront/`, route `/battlefront` and `/battlefront/:level/:mode`**, with its rules in `src/lib/battlefront/` and its data in `src/data/bf2017/`. It imports the galaxy only through `index.js` (the oath and the credits), as the rules of the architecture say. The galaxy's systems page links to it; nothing in the galaxy changes.
2. **Data first, by extraction, committed small.** `scripts/bf2017-data.mjs` reads the export (local `--root`, or the bucket's `data/` through `bf2017-fetch.mjs data`) and writes **rulebooks**: plain JSON under `src/data/bf2017/`, each number traceable to an asset (`_source` fields name the asset and property). The JSON is what the site ships; the 84,000-record dump is never in the repo. A hand-authored value carries `"source": "hand"` and a comment in its sidecar `.notes.md`.
3. **Rules are pure, seeded, deterministic, headless.** `src/lib/battlefront/sim.js` steps a whole battle at 20 Hz in Node with no three.js and no DOM: entities, teams, bolts swept against bodies and the nav solids, hits, deaths, objectives, Battle Points, events. The page is one more input source and one more listener. A whole Galactic Assault with no player runs in a test. This is the repo's pattern (`assault.js`, `battleDirector.js`) and the only way parallel sessions can build the bots, the modes and the world at once.
4. **Frostbite's blueprint and affector model is translated, not emulated.** An entity is a bag of components with a stack of affectors (max health, regen, damage, speed, remove), abilities on channels that block one another, and a state (stand, crouch, roll, dying, down). The logic graphs (schematics) are read by the extractor for their constants and by a person for their shape; they are not interpreted at run time.
5. **No budget rows for this world** (the owner, 2026-10-10). The galaxy's triangle, call, download and file-size budgets do not apply under `src/components/battlefront/`; `health.mjs`'s `big-files` and layer rules still do (files under 800 lines; `src/lib` imports no React and no world). Quality tiers exist only so a phone can play: the desktop default is the game's own LOD0 and 2048 textures.
6. **Assets reach the page through one adapter** (`src/components/battlefront/assets.js`), with two backends: the shipped asset host (`src/lib/assetBase.js`, by content hash, with lane S's pool and aborts) for what is committed or uploaded by hash, and a dev backend that serves the local export through Vite (`BF2_ROOT`). The level itself comes as lane L's pack (decision 15). The adapter's contract is in section 7 so the streaming session builds to it; until it lands, every lane runs on the dev backend.
7. **Navigation is built, not read.** A 2 m navgrid per level from the terrain heightfield and the physics hulls, with cover slots found as the game's `CoverConstants` describe, A* with a path cache and portals between coarse regions. The game's `PathfindingBlobAsset`s are opaque; the owner's export notes say so.
8. **One sim, many renderers.** The page draws what the sim says; a headless checker (`scripts/battlefront-check.mjs`) drives the same sim through Playwright for screenshots; the balance runner (`scripts/battlefront-balance.mjs`) runs it in Node a hundred times.
9. **Online is a later lane, not a redesign.** The sim takes inputs as timestamped events and is deterministic from a seed and a clock, so the repo's shared-battle pattern (`battleDirector.js`: one battle from the wall clock, only what changes it sent) applies when lane 7 comes.
10. **Sequel era out, as the standing rule.** The extractor refuses `NewEra` factions, `ep7`/`ep9` outfits, `Jakku`, `Takodana`, `StarKiller`, `Resurgent`, `Crait` and the First Order and Resistance kits. Hoth, Endor, Tatooine, Yavin, Death Star II, Kashyyyk, Kamino, Naboo, Geonosis, Scarif, Bespin, Felucia and the six space maps stay.
11. **Everything unlocked, no grind.** Star cards at their top rank, every weapon and mod, every hero: the deploy screen offers them; progression and loot are not built (section 10).
12. **It looks like the desktop game, on three.js, from the game's own records** (the owner: "improve it whichever way makes it look amazing, like the packaged desktop game"). The render stack is the game's, translated: physically based materials with the game's colour, normal and ORM maps as KTX2 on the GPU; the sun, sky, fog, exposure, bloom, grading LUT, ambient occlusion, sun flare and wind from the level's `VisualEnvironmentBlueprint` (lane G's derivation, applied to this world by `look.js`); the level's **placed lights** (sphere and spot lights with their colours, intensities and attenuation radii, the volumetric cones, the lighting prefabs' fixtures) as three.js point and spot lights culled by distance and screen area as the records say (`CullScreenArea 0.005`, `FadeScreenArea 0.01`), the probe volumes as the environment maps of the places they cover, the distant shadow cache under the far ground; cascaded shadow maps for the sun with the records' shadow settings; HBAO with the records' radius and bias; bloom with the records' scale and threshold through the site's post; the LUT as a 3D texture; motion blur and depth of field as options off by default. The world module declares `shading: 'nodes'` (`src/runtime/module.js`), so `src/runtime/backend.js`'s `pickBackend` gives it `WebGPURenderer` where the browser has WebGPU and the same node renderer on WebGL 2 otherwise (`docs/stack/webgpu-tsl.md`): one code path, TSL materials and a post chain of three's own display nodes (`three/addons/tsl/display/`: `BloomNode`, `GTAONode` for the ambient occlusion, `Lut3DNode` for the grading, `SMAANode`, `DepthOfFieldNode` and `MotionBlurNode` as options) and `three/addons/csm/CSMShadowNode.js` for the sun; no `ShaderMaterial`, no `onBeforeCompile`, no `EffectComposer` (the node renderer refuses them). The runtime's `gfx.post(passes)` gains the passes this world needs (`ao`, `lut`, `smaa`) as data, built in `src/runtime/webgpu.js`'s `buildPostProcessing` and `webgl.js`'s, which is the one runtime change this design asks for. This is the first shipped `'nodes'` world, so it is also the WebGPU design's proof. Quality tiers exist only for phones; the desktop default is everything on.
13. **The camera is the game's.** The soldier's third-person camera from `SoldierThirdPersonCameraData` and `SoldierCameraComponentData` (arm 1.2 m, pitch to 55°, the arm shortening to 0.5 between pitch 5 and 70, collision padding 0.17 with blend in 5 and out 3, the shoulder side option, the aim's 55° render FOV and zoom speeds, the camera spring from the weapon's recoil data); each vehicle's transformer chain (pitch limits and inertia per seat, velocity redirect) from its `_Camera` asset; the deploy screen's overview cameras and the outro's from the level's `CameraEntityData` and locators (35 mm, f/8, the game's framing). `camera.js` is pure (a pose from state and input), `cameraRig.js` places three's camera.
14. **The GUI is the game's, rebuilt in React on the HUD kit, never Lua.** The widget trees under `UI/InGame/Hud` say what each HUD part shows, where it anchors, which icon and which string; the extractor flattens the ones this game needs (`ui.json`: per widget its anchor, size, children, text fields by string id, icon by SVG name, colours, animation timings) and `hud/` draws them as kit parts skinned with the game's faces (the Univers condensed family for labels, the Raxus Prime monospace for numbers, through local files under `public/battlefront/fonts/`), the game's 702 SVG icons as inline symbols, and the game's strings. The deploy screen (`SpawnOverlayScreen`), the heat bar, the abilities with their recharge rings, the objective bar with the capture thirds, the in-world markers, the radar, the kill log and kill message, the damage indicator, the squad list, the Battle Points on death, the scoreboard and the end-of-round outcome declaration are the first set. The commo rose, subtitles, talking head and progression come later. Every HUD part stays a `src/runtime/hud` kit part under the house rules (readable sizes, glass under text), skinned by this world's class.
15. **The map is lane L's pack, whole and in the map's frame.** Lane L's `bf2017-level.mjs` gains two flags this world uses: `--frame map` (no rebase: the pack's coordinates are the export's, so the rulebooks' spawns and volumes land where they should) and `--no-fit` (no `fitTo` against a budget row; every instance and the plain cut everywhere on desktop). The game loads it with lane L's `levelPack.js`, `levelStream.js` and `collision.js` and its heights with the `image` layer; lane 5 writes only what those lack (the whole-map stream policy: nearest cells first round the player, the far ring as `far` cuts, no drop on leave since the arena is the whole map). The flags are lane L's two small PRs or lane 5's first task against lane L's files, whichever lands first; the navgrid (decision 7) is built at pack time from the same heightmap and shapes and shipped beside the pack as `nav.bin`.

## The mechanics catalogue

Every mechanic of the 2017 game this design builds, its rule, where its numbers come from, and the module that owns it. The modules are named here once; the plans use these names.

### 1. Soldiers and classes (`soldier.js`, `classes.json`)

- **Four classes**, Assault, Heavy, Officer, Specialist, each per era and faction with its default primary weapon (`DefaultWeapon_L_Assault_Orig`, `_D_`, by `Orig`, `Preq`), its health and regen affectors, three ability slots (left, middle, right) and the star cards that may fill its three card slots. From `Gameplay/Kits/MP/<Class>/*`: `Class_<Class>`, `GP_<Class>` (the gameplay prefab), `Kit_<L|D>_<Class>_<Era>_<MAP>` (the per-map appearance kit), `Affector_<Class>Health`, `Affector_<Class>HealthRegen`, `Ability_<Class>_*`.
- **Health**: `MaxHealth` from the class affector; regen at `RegenerationRate` after `RegenerationDelay` with no damage taken; `LowHealthThreshold` for the HUD; `ArmorMultiplier`, `BlasterDamageModifier`, `ExplosionDamageModifier`, `SelfDamageModifier` as affectors on the entity's stack.
- **Movement**: walk, sprint (`SprintMultiplier`), crouch (`CrouchHeight 0.94`), the combat roll as a character-state ability (two charges, `RechargeTime 4`), melee as a short-range damage affector with a `0.1` s delay, vault and ledge drop where the navgrid marks a cover edge or a ledge (`VaultOverPathLinkConfig`, `LedgeJumpDownPathLinkConfig`), jump packs for aerial reinforcements. Fall damage above `FallDamageThreshold 30` m/s of impact.
- **States**: standing, crouching, rolling, zoomed, overheated, suppressed (for bots), dying (`DyingMaxTimeInAir 6`), down (`TimeForCorpse 4.5` then gone).
- **Bone collision**: a capsule per body part (`DefaultSoldierBoneCollision`, the droid variants); a hit names its part; the head multiplies damage (the value is read if the data holds it under a bone's damage multiplier; otherwise `source: "hand"` from the game's headshot rule).

### 2. Weapons (`weapons.js`, `weapons.json`)

- **Firing**: `RateOfFire`, bursts (`NumberOfBulletsPerBurst`, `BurstsPerMinute`), hold-and-release charge (`HoldAndRelease.MaxHoldTime`, power `1.0 → 2.0` at `0.1` a second), bolt action, `DeployTime`, `PendingFireWindow`. From `WeaponFiring_*` (`FiringFunctionData`).
- **Bolts are projectiles**, not hitscan: `InitialSpeed` (700 m/s for a rifle), gravity where the projectile says so, `TimeToLive`, swept each step against bodies and solids (`lib/combat/bolt.js`'s sweep is the base). Damage with falloff from the projectile's damage data (start and end damage over start and end distance where present; the `BlasterWeaponData` multipliers `MinDamageMultiplier`, `MaxDamageMultiplier` on top). Blaster colour by faction from `BlasterProjectileColorUnlockUserData_{Red,Green,Blue}`.
- **Heat** in place of ammunition: `HeatPerBullet`, `HeatDropPerSecond` after `OverheatDropDelay`, `OverHeatThreshold`, `OverHeatPenaltyTime`, `OverheatedDropMultiplier`, `HeatWarningThreshold`; **active cooling**: on overheat a bar with a success window (`DifficultyInterval` start `0.8 → 0.65`, shrinking by `OnSuccess`, reset by `OnFailure`), a super window (`0.4 → 0.3`), penalties `0.2` and `0.3` s, venting `1.0` s. Weapons with magazines (`Ammo.MagazineCapacity > 0`) reload instead (`ReloadTimeBulletsLeft`, `ReloadThreshold`).
- **Dispersion and recoil**: a cone per stance from `GunSwayData.Dispersion[]` (`MinAngle`, `MaxAngle`, `IncreasePerShot`, `DecreasePerSecond`, `NoFireTimeThreshold`), the stance index by standing, crouching, moving, zoomed, and a camera spring (`SpringConstant`, `SpringDamping`) for the player.
- **Zoom** levels (`WeaponZoomLevelData`) and **mods** (`U_<Weapon>_Barrel`, `_Cell`, `_Scope`: each a `ValueUnlockAsset` whose modifiers change heat, dispersion or zoom).
- **Weapon families**: rifles, heavy, pistols, long range, short range, special, hero (`Gameplay/Equipment/<Family>/<Weapon>/`). Range `MaxRangeMeterDistance`.
- **Explosives and gadgets**: grenades (thermal detonator, smart ion, dioxis, impact, flash), launchers, the Officer's turret and the Heavy's sentry as spawned entities with their own weapon rows; `ExplosionEntityData` (`BlastDamage`, inner and outer radius, impulse, shockwave) and `DamageAffectorAsset` ranks for damage over time.

### 3. Abilities and star cards (`abilities.js`, `affectors.js`, `cards.json`)

- **Active abilities** (`BasicPlayerAbilityAsset`): `ActivationTime`, `ActiveTime`, `RechargeTime`, `TriggerCost` (a fraction of the bar, so some abilities have two or three charges), `BlockingChannels` (an ability on a channel blocks another on the same), `AbilityModifiers` (what the ability does, as property changes: speed, damage, heat, health, a spawned entity, a character state). The input queue holds 3 presses for `0.5` s (`WSPlayerAbilitySetComponentData`).
- **Character-state abilities** (`CharacterStatePlayerAbilityAsset`): the roll, Vader's saber throw, the Heavy's shield, the Officer's battle command.
- **Passive abilities and star cards** (`PassivePlayerAbilityAsset`, `ValueUnlockAsset`, `SC_*` in a team's `AllPlayerAbilities`): a card is a stack of **affectors by rank** (`RankData[0..3]`, Common to Epic). The game's card list per class comes from the team data; this design offers every card at its top rank (decision 11) and keeps the rank data so a later lane can add progression.
- **Affectors** (`MaxHealthAffectorAsset`, `SoldierHealthRegenerationAffectorAsset`, `DamageAffectorAsset`, `BasicAffectorAsset`, `RemoveAffectorAsset`): a stack on the entity; the sim resolves the stack each step (max health is the base × multipliers + adds; a `RemoveAffector` takes one off, as `Affector_RemoveAffector_HealthMaxed` does).

### 4. Reinforcements, heroes and Battle Points (`battlePoints.js`, `reinforcements.json`, `heroes.json`, `points.json`)

- **Battle Points** are earned by score events and spent at the deploy screen. The earn table (kill, assist, objective capture tick, objective damage, vehicle kill, hero damage, squad spawn) and the cost table (aerial, enforcer, infiltrator, each vehicle, each hero) are **hand** tables in `points.json` from the game as shipped, marked `source: "hand"`, with the prefab's constants (`1000`, the `1..4` selector) noted beside them for a later session to reconcile against `PF_Gameplay_BattlePoints_Local`'s graph. Instant Action's BP rate option (`InstantActionBPRate`) scales the earn table for bots.
- **Reinforcements** (`Gameplay/Kits/Specials/*`: Wookiee warrior, death trooper, B2, droideka, ARC, clone commando, clone and rebel and imperial jump troopers, flametrooper, ISB agent, BX, ewok): each a class with its own health, abilities and weapons, offered by era through the team's `SpecialSoldiers` list, bought with Battle Points, limited per team at once (`PF_KitLimitations_PlanetaryBattles`).
- **Heroes** (`Gameplay/Kits/Hero/*`, 24, OT and PT only after the refusal): health affectors with armour ranks, three abilities each, a saber or a blaster, their clip sets by name (`A_Vader_*`, `C_Luke_*`, `T_Maul_*`), emotes and voice lines from the team data; bought with Battle Points, one of each at once, the team's `Heroes` list by era. **Hero vehicles** (`Kits/HeroVehicle/*`: Falcon, Slave I, TIE Advanced, Red Five, Yoda's starfighter, Scimitar) the same way on space and some ground maps.
- **Lightsaber combat** on `lib/combat/duel.js` and `blade.js`, timed by **lane X's stroke tables** (`src/data/bf2017/strokes/<hero>.json`: each strike's duration, contact window, direction and root travel measured from `A_<Hero>_AttackLoop_Strike1..4`, the blocks by direction, the staggers, dodges, dash and jump attack; PR #810): the sim's `heroes.js` reads the same table the page's `stanceFromTable.js` reads, so a hero bot's strike lands when the figure's does. Block and deflect as a stamina bar (`U_Lightsaber_Deflect_<Hero>`), Force abilities as `BasicPlayerAbilityAsset`s (choke, push, pull, lightning, heal), saber throw as a `ProjectileBlueprint` (`Projectile_DarthVader_SaberThrow`) that returns.

### 5. Vehicles (`vehicles.js`, `vehicles.json`)

- **Ground**: AT-AT (the objective vehicle on Hoth: health as the escort's objective, waypoints from the level, `UG_WalkerStomps`), AT-ST, AT-RT, AT-TE, AAT, MTT, hailfire, spider droids, STAP, BARC, speeder bikes, X-34, turbo tank; **air**: X-wing, Y-wing, A-wing, U-wing, TIE fighter, bomber, interceptor, LAAT, ARC-170, N-1, V-wing, vulture, tri-fighter, hyena; **stationary**: DF.9, Atgar, E-web, turbolaser; **mounts**: tauntaun. From `Gameplay/Vehicles/<Kind>/<Name>/` (`VehicleBlueprint`, `_Gameplay`, `_Weapons`, `_AI`, `_DriverLogic`, `_Camera`): health, seats, speed, weapons and abilities (`Vehicles/Abilities/{GroundVehicles,Gunships,Starfighters}`), `OverheatConfig_Default_Vehicles`. Spawned at the map's `vehicleSpawns` (31 on Hoth: 4 AT-AT and tauntaun spawns, DF.9s, Atgars), bought with Battle Points, or free at a spawn as the game does for turrets and mounts.
- **Starfighter flight** (`SquadronAI/LocomotionSettings`, `CollisionAvoidance`, `AimingAbilitySettings`) for the space maps in lane 6; the universe's `flightRules.js` is the reference, not the base.

### 6. Modes (`modes/*.js`, `maps/<level>.json`, `maps/<level>.stages.json`)

- **Galactic Assault** (`galacticAssault.js`): staged conquest. A stage names its objectives (capture volumes, an escort, an arm-and-destroy, a hold), its attackers' and defenders' spawn sets, its ticket top-up and its timer. A capture point's meter moves by the advantage inside its volume (thresholds `0.33`, `0.66` for the HUD's thirds, overtime while contested); an escort objective is the AT-ATs' health walking their waypoints with the ion cannon disabling them; arm-and-destroy is a timed interaction and a countdown; a hold is a defend volume with a timer. Attackers' tickets fall with deaths and are topped up at a stage; defenders win when the tickets or the timer run out; attackers win the last stage. Stage order per map is `maps/<level>.stages.json` (hand, from the game and the stage strings), objectives point at extracted volumes by id.
- **Blast** (`blast.js`): two teams, kills to `100` (hand, the game's rule; the kill counter's `MaxKillCount 65000` is a cap), spawns from the mode's layer.
- **Heroes vs Villains** (`hvv.js`): 4 against 4 heroes, a target per team, a kill of the target scores, `10` points (hand), the arena's volumes.
- **Strike** (`strike.js`): attackers take an item from a capture area to a delivery area within a timer; one round each way; the OOB volumes per team.
- **Extraction**, **Ewok Hunt**, **Capital Supremacy**, **Starfighter Assault**, **Arcade**: lane 6 and after; the data is there.
- **Out of bounds**: a team's OOB volumes; a soldier outside for `10` s (hand) dies; the HUD counts down.
- **Spawning** (`spawn.js`): the deploy screen on death and at the start; the spawn set of the stage; a point is chosen by priority among enabled points away from enemies (`SpawnLocationFinderShapeData` polygons give the area, points give the exact spots), or on a living squadmate out of combat (squad spawn, the game's rule, `source: "hand"`); spawn protection `3` s (hand); respawn waves for bots so they arrive as squads.
- **End of round** (`eor.js`): the winner, the scoreboard, the best players, the outro cinematic's camera (`Cinematics_Outro_Team1/2` locators).

### 7. The bots (`ai/*`, `ai.json`)

- **Roles from the game's templates** (`AI/BattleAI/Templates/*`: rifleman, heavy, officer, sniper, launcher, melee, close range, jumptrooper, flametrooper, scattergun) and **tactics tables** (`Tactics/*`): engage distance, suppression (given and taken), hide and flee settings, close combat; **spawner prefabs** per faction and role (`Spawners/AISoldierSpawnerPrefab_<Faction>_<Role>`) say which kit a bot of a faction and role wears; **weapon data** (`Weapons/AI_<Family>`) says how a bot's gun differs from a player's (damage, spread), with the **firing patterns** (`AIFiringPatterns`: 24 bit patterns, a `1` fires that frame, a `Delay` between repeats).
- **Perception** on `lib/ai/perception` with the template's `TargetLostTime 10`, `AlertPropagationSpeed 2` (an alert spreads to squadmates at 2 m/s), line of sight against the navgrid's solids, the difficulty curves for aim error by distance (`GameDifficultySettings`).
- **Cover** as the game does it: cover slots on the navgrid (`SlotSpacing 2.2`, protected cover width `0.7`, crouch and stand heights, fire heights), chosen by a **scored query** (`Cover/Queries/*`: distance to enemy, distance to objective, protection from the threat direction, not near enemies, in the squad's zone) exactly as the game's `CoverZones` and `CommonScores` name the terms; the query tables are extracted, the scorer is `ai/cover.js`.
- **The brain** (`ai/soldierBrain.js`) is a utility pick on `lib/ai/utility` over the tactics table's branches: attack (from cover, open, advance by firing pattern), hide, flee, close combat, follow the squad leader, go to the objective, use an ability (`Prefabs/Skirmish/Abilities/PF_Skirmish_AI_Ability_*`: grenade, turret, shield, sentry, scan, battle command, disruptor), mount a vehicle or turret.
- **Squads and orders** (`ai/squad.js`, `ai/commander.js`): a team's bots in squads of four on `lib/ai/squad`; the commander assigns squads across the stage's live objectives (attackers split by weight, defenders hold and counter the most threatened), spends the team's Battle Points on reinforcements, heroes and vehicles by Instant Action's counts (`InstantActionEnemyHeroCount`, `EnemyReinforcementCount`, `EnemyVehicleCount`), and paces respawn waves.
- **Hero bots** (`ai/heroBrain.js`): saber heroes close and chain attacks with blocks when a bolt comes (`duel.js`), ranged heroes kite; abilities on cooldown by situation.
- **Vehicle bots** (`ai/vehicleBrain.js`): the AT-AT walks its waypoints and fires at what its gunner sees (`Vehicle_Ground_AT-AT_MP_AI`); `AT-ST_Combat` for walkers that hunt; speeders strafe; stationary turrets track.
- **The living world** (`FantasyBattle_LivingWorld`, `Characters/LivingWorld/*`: creature locomotion settings and bindings): ambient creatures on the map, later.

### 8. Frostbite engine mechanics, translated

| Frostbite | what it is | here |
| --- | --- | --- |
| `*Blueprint` with components (`SoldierEntityData`, `WSSoldierHealthComponentData`, `BoneCollisionComponentData` …) | an entity's parts | `sim.js` entities as component bags; the extractor flattens each blueprint's components into the rulebook row |
| Affectors (`MaxHealthAffectorAsset`, `DamageAffectorAsset`, `RemoveAffectorAsset`, `BasicAffectorAsset`) | stackable property modifiers with ranks | `affectors.js`: a stack per entity, resolved each step |
| Abilities and channels (`BasicPlayerAbilityAsset`, `BlockingChannels`, `CharacterStatePlayerAbilityAsset`) | timed actions that block one another | `abilities.js` |
| Schematics (`PropertyConnections`, `EventConnections`, `LinkConnections`) | the logic graphs of prefabs and levels | constants read by the extractor; the shape hand-authored in `stages.json`; never interpreted at run time |
| `Synced*EntityData` | networked state | sim events; the online lane later |
| `WeaponFiringData`, `GunSwayData`, `OverheatConfig` | the gun model | `weapons.js` |
| `ProjectileBlueprint`, `ExplosionEntityData`, `WSMissileEntityData` | bolts, missiles, blasts | `bolts.js` on `lib/combat/bolt.js` |
| `BoneCollision*` | hit zones | `soldier.js` capsules per part |
| `WSEACharacterPhysicsComponentData` | ragdoll bodies | the world's ragdoll on `lib/three/ragdollPhysics` with the game's 15 bodies |
| Havok `*_Physics_Win32` | collision | Rapier trimeshes and hulls from `physics/`, built once per level |
| `TerrainStreamingTree` | the heightfield quadtree | the 16-bit PNG, decoded with a 16-bit reader, one heightfield collider and a mesh by distance |
| `LayerData`, `SubWorldData`, `StaticModelGroup` | placement | the map manifest and bin (already built by the export) |
| `VisualEnvironmentBlueprint` (outdoor light, sky, fog, tonemap, colour correction, HBAO, shadows, sun flare, wind, Enlighten) | lighting, sky and post presets per weather | `lighting.json` per level and weather; `look.js` applies it: sun and hemisphere from the colours, Rayleigh sky, the fog curve, exposure from `EV`, bloom from `BloomScale` and the Gaussian colours, the grading LUT, HBAO, CSM shadows, the sun flare, wind on cloth and foliage |
| `PbrSphereLightEntityData`, `PbrSpotLightEntityData`, `SimpleVolumetricsEntityData`, `LightProbeVolumeData`, the lighting prefabs | placed lights, volumetric cones, probe volumes | `lighting.json`'s `lights[]`, `volumetrics[]`, `probes[]` with transforms; three.js point and spot lights with the records' cull and fade, cones as additive meshes, probe volumes as local environment maps |
| `GradingLutAsset` | a colour LUT per weather | a `Data3DTexture` in the post |
| `SoldierThirdPersonCameraData`, `SoldierCameraComponentData`, `WeaponZoomLevelData`, `*CameraTransformerEntityData`, `CameraEntityData` | the cameras | `cameras.json`; `camera.js` (pure poses), `cameraRig.js` |
| `UIWidgetBlueprint`, `SvgImage`, the fonts, the strings, `_TextureMappings` | the HUD and screens | `ui.json`; `hud/*` on the runtime kit, the SVGs inline, the fonts local |
| `AntStateAsset` and the banks | animation state machines | `locomotion.js`: our state machine over the game's clip names (`C_HM_*` cycles, `A_*` actions, `T_*` transitions, `Cover_Left/Right/Pose_*`, `Death_*`, `AI_<Role>_<Faction>_*`); root motion from `AITrajectory` |
| `PathfindingBlobAsset` | navmesh | built navgrid (decision 7) |
| `MeshVariationDatabase`, `ObjectVariation` | skins and team colours | a later variations lane; the default variation now |
| `EmitterGraph`, `EffectBlueprint` | VFX | our own by name map (muzzle, impact, explosion, saber) |
| `SoundPatchAsset`, `VoiceLineAsset`, `SW02_VO_*` | audio and VO schematics | reserved names; audio is not exported yet |
| `GameDifficultySettings` `FloatCurve`s | bot skill | `ai.json` curves, evaluated by `lib/ai/utility`'s curves |

## Architecture

```
scripts/bf2017-data.mjs                       the extractor CLI (lane 0)
scripts/lib/bf2017-ebx.mjs                    pure parsers: load, $ref, $asset, transforms, number walks, string ids
scripts/lib/bf2017-rulebook.mjs               builders: weapons, classes, heroes, reinforcements, vehicles, teams, ai, map
scripts/fixtures/bf2017/data/**               six cut EBX files and one cut level layer for the tests
scripts/battlefront-balance.mjs               runs the sim headless N times, prints who won and when
scripts/battlefront-check.mjs                 Playwright: the page through its dev hooks, screenshots

src/data/bf2017/                              the rulebooks (committed JSON; src/data imports nothing)
  weapons.json classes.json cards.json heroes.json reinforcements.json vehicles.json
  teams.json ai.json points.json strings.json cameras.json ui.json
  maps/hoth.json maps/hoth.stages.json maps/hoth.lighting.json  (then endor, tatooine, yavin, deathstar2, kashyyyk, kamino, naboo, geonosis, scarif, bespin)

src/lib/battlefront/                          pure rules (no three, no DOM, no React)
  rulebook.js      typed accessors over the JSON, era and faction filters, the sequel refusal re-checked
  affectors.js     the stack
  abilities.js     channels, timers, charges
  weapons.js       heat, cooling, dispersion, fire timing, damage by range
  soldier.js       classes, states, movement, bone capsules, health and regen
  heroes.js        hero rows, saber and Force rules on lib/combat
  vehicles.js      vehicle rows, seats, weapons, waypoint walking
  bolts.js         projectiles swept against bodies and solids
  battlePoints.js  earn and spend
  spawn.js         points, polygons, squad spawn, protection, waves
  nav.js           navgrid, A*, cover slots, line of sight
  sim.js           the step: entities, teams, bolts, events; inputs in, events out
  modes/galacticAssault.js  modes/blast.js  modes/hvv.js  modes/strike.js  eor.js
  ai/soldierBrain.js ai/cover.js ai/squad.js ai/commander.js ai/heroBrain.js ai/vehicleBrain.js
  arena.test.js    a whole battle with no player, under test:ai

src/components/battlefront/                   the world (lane 5)
  BattlefrontWorld.jsx  assets.js  input.js  index.js
  look.js  lighting.js  post.js             the visual environment applied: sun, sky, fog, exposure, bloom, LUT, HBAO, CSM; the placed lights, volumetrics and probes
  camera.js (pure)  cameraRig.js            the soldier, aim, vehicle, deploy and outro cameras from cameras.json
  map/  (lane L's levelPack, levelStream and collision on the whole-map pack; the image ground layer; the far shadow cache)
  figures/  (walrus figures, locomotion.js, ragdolls, weapons in Wep_Root, team variations)
  vehicles/  fx/  audio/
  hud/  (the game's widgets on the kit: DeployScreen, ObjectiveBar, Tickets, Heat, Abilities, Health, Markers, Radar, KillLog, KillMessage, DamageIndicator, SquadList, DeathPoints, Scoreboard, EndOfRound; icons.js over the SVGs; fonts)
src/pages/Battlefront.jsx                     the route
```

### Data flow

1. The extractor turns the export into rulebooks (once per lane that needs new rows; committed).
2. `rulebook.js` loads the JSON for a level, mode, era: the two teams' kits, heroes, reinforcements, vehicles; the map's spawns, volumes, waypoints; the stage list.
3. `sim.js` is made from that with a seed; the commander fills both teams with bots; the page adds the player as one entity whose inputs arrive each frame.
4. Each step: inputs → abilities and weapons → bolts → hits and affectors → deaths and Battle Points → mode objectives → spawns → events. Bots think on a stagger (a quarter a step).
5. The page reads the sim's entities to place figures, vehicles and bolts, drives `locomotion.js` per figure, and draws the HUD from the sim's view; events feed the toasts, the kill feed and the VO hooks.

### Determinism

Every random draw goes through the sim's seeded `rand` (`lib/seeded.js`). Steps are fixed at 50 ms; the page accumulates frame time and steps whole steps, interpolating figures between. Inputs are timestamped to a step. The arena test asserts two runs with one seed give one event log.

## 7. The assets adapter (contract for the streaming session)

`src/components/battlefront/assets.js` exports one object:

```
loadModel(name, { lod = 0 }) → Promise<Object3D>       name: the manifest's model name; textures resolved by the backend
loadClip(name) → Promise<AnimationClip>                 name: anims.jsonl's clip name
loadMap(level) → Promise<{ manifest, bin: ArrayBuffer }> level: 'levels/mp/hoth_01/hoth_01'
loadTerrain(level) → Promise<{ meta, height: Uint16Array, width, height }>  16-bit decoded
loadPhysics(name) → Promise<{ hulls: Float32Array[], meshes: { positions, indices }[] }>
loadStrings() → Promise<Record<string, string>>
```

Two backends behind it, chosen by `import.meta.env.VITE_BF2_BACKEND`:

- `dev`: Vite serves `BF2_ROOT` (the local export's `web_opt/`) at `/bf2/` through a `server.fs.allow` entry and an alias; nothing is copied. For the owner's machine and local sessions.
- `bucket`: the streaming lane's loader (authenticated Supabase Storage with the signed-in user's token, as `web_opt/README.md` shows; cache headers and the service worker as `2026-10-09-asset-hosting.md` decides). The streaming session owns this file's backend and the gate in front of the route.

Both return the same shapes; `assets.test.js` runs the dev backend against the committed fixture (`scripts/fixtures/bf2017/web/`) so the contract is pinned without the export.

## 8. Rulebook formats

Every rulebook is `{ "_from": { "export": "<build 489592>", "date": "...", "root": "<hash of data.tsv>" }, "rows": { ... } }` and every numeric leaf that came from the data may carry a `_source` beside it (`"MaxHealth": 150, "MaxHealth_source": "Gameplay/Kits/MP/Assault/Affector_AssaultHealth#MaxHealthAffectorAsset.MaxHealth"`); hand values carry `"_source": "hand"` and a line in `src/data/bf2017/NOTES.md`. The extractor's tests assert that no row is without a source.

- `weapons.json`: `{ id, name (string id resolved), family, era[], factions[], firing: { rof, burst, burstsPerMinute, speed, bulletsPerShot, deploy, charge? }, heat: { perBullet, dropPerSecond, dropDelay, threshold, penalty, overheatedDrop, warning, cooling: { window: [a, b], shrink, reset, successPenalty, failurePenalty, minHeat, vent, super: [a, b] } } | ammo: { magazine, magazines, reload }, damage: { start, end, startDistance, endDistance, min, max }, dispersion: [{ stance, min, max, perShot, decay, noFireDelay }], recoil: { spring, damping }, zoom: [...], range, mods: [...], colour }`.
- `classes.json`: `{ id, era, faction, name, health, regen: { rate, delay }, speed: { walk, sprint }, weapon (default id), abilities: [{ slot, id }], cards: [ids] }`.
- `cards.json` and ability rows: `{ id, name, kind: 'active' | 'state' | 'passive', activation, active, recharge, cost, channels: [], ranks: [{ modifiers: [{ property, op, value }] }] }`.
- `heroes.json`: a class row plus `{ side, health, armour: [], saber: { hilt, colour, chains: [clip names], block, deflect }, abilities, clips: { idle, run, sprint, attack: [], block, dodge, death }, emotes, voice }`.
- `reinforcements.json`: class rows with `{ kind: 'aerial' | 'enforcer' | 'infiltrator', cost, limit }`.
- `vehicles.json`: `{ id, kind, name, health, seats: [{ role, weapons: [] }], speed, abilities, overheat, waypointsKey?, cost, model }`.
- `teams.json`: per `(era, level)`: `{ light: { faction, classes: [], heroes: [], reinforcements: [], vehicles: [], heroVehicles: [] }, dark: { ... } }`.
- `ai.json`: `{ templates: {}, tactics: {}, weapons: {}, patterns: [{ bits, delay }], cover: { constants, zones, queries }, difficulty: { curves } , instantAction: {} }`.
- `points.json` (hand): `{ earn: { kill, assist, objectiveTick, objectiveDamage, vehicleKill, heroKill, squadSpawn }, cost: { aerial, enforcer, infiltrator, vehicles: {}, heroes: {} }, limits: {}, bpRate }`.
- `maps/<level>.json`: `{ level, modes: [], terrain, bounds, spawns: [{ id, team, priority, at: [x, y, z], yaw, layer, enabledBy? }], polygons: [{ id, team, points: [[x, z]], y, height }], volumes: [{ id, points, y, height, layer, name? }], spheres, boxes, waypoints: [{ id, points }], vehicleSpawns: [...], oob: { team1: [], team2: [] }, locators, cameras }`.
- `maps/<level>.stages.json` (hand): `{ mode: 'galacticAssault', attackers: 'dark' | 'light', stages: [{ id, name (string id), objectives: [{ type: 'capture' | 'escort' | 'arm' | 'hold', volume, name, ... }], spawns: { attack: [spawn ids or polygon ids], defend: [...] }, tickets, timer, vehicles: [] }] }`.
- `strings.json`: only the ids the other rulebooks reference.
- `maps/<level>.lighting.json`: `{ weathers: { [name]: { sun: { colour, direction? }, sky: { rayleigh, cloudColours, light1, light2 }, fog: { curve, depth, height }, exposure: { ev }, bloom: { scale, gaussians: [[r, g, b] × 5], lensDirt }, grading: { brightness, contrast, saturation, hue, maxHdr, lut }, ao: { hbao: {...}, aao: {...} }, shadows, sss, flare: { elements: [...] }, motionBlur, wind: { direction, strength, variation, turbulence }, enlighten: { skyColor, groundColor, terrainColor, sunScale } } }, default: name, lights: [{ kind: 'sphere' | 'spot', at, yaw, pitch, colour, intensity, radius, inner?, outer?, shadow: { near, far, dimmer }, cull: { screenArea, fadeArea, distance }, layer }], volumetrics: [{ at, yaw, emission, exponent, scale, fade }], probes: [{ at, half, yaw, res: [x, y, z], blend, priority }], prefabs: [{ name, at, yaw, light: ref }], farShadow, probesTextures: [...] }` from `Levels/Lighting/<World>/<Weather>/VE_*`, `T_CC_*`, `Levels/MP/<Level>/Default_Lighting`, `*_Lighting*`, `Hangar_*_Architecture` and the sub-level that names each weather (`Sunset`, `Cloudy`, `HighEnd`).
- `cameras.json`: `{ soldier: { arm, maxPitch, reducedArm: { length, minPitch, maxPitch }, collision: { padding, blendIn, blendOut }, cull: { stand, crouch, prone, dead }, shoulder, listener: { radius, fov }, shake }, aim: { [weaponId]: [{ fov, zoomIn, zoomOut }] }, vehicles: { [vehicleId]: { seats: [{ pitch: [min, max], inertia: { input, none }, redirect: [{ inertia, rate }], curves }] } }, hero: {...overrides} }` from the soldier blueprints, `W_*` zoom levels and `_Camera` assets; the per-mode `CameraEntityData` and locators are in `maps/<level>.json` (`cameras`, `locators`) already.
- `ui.json`: `{ widgets: { [name]: { anchor, size, children: [...], texts: [{ id, stringId, font, size, colour }], icons: [{ id, svg }], colours, animations: [{ name, duration, curve }] } }, textures: { [slot]: svg }, icons: { [name]: 'svg path' }, fonts: [{ file, family, weight }], colours: { factions, teams, heat: [...], health: [...] } }` for the widgets decision 14 lists, from `UI/InGame/**`, `UI/Customize/Screens/SpawnOverlayScreen`, `UI/Art/HUD/_TextureMappings/*`, `UI/Configuration/*`, `web_opt/svg`, `web_opt/fonts`; the SVGs and fonts themselves are copied under `public/battlefront/{icons,fonts}/` by the extractor (OT and PT only, under 2 MB together).

## 9. Testing and gates

- Every module under `src/lib/battlefront/` and `scripts/lib/bf2017-*.mjs` has a test beside it, under a second, no network. The extractor's tests run on the committed fixtures; a lane that needs a new fixture cuts it from the export (one asset, under 40 KB) and commits it.
- `arena.test.js` (lane 1 and after, under `npm run test:ai`): a whole Galactic Assault on Hoth with no player; asserts the stages advance, both sides win across seeds (attackers 40 to 60 percent over 20 seeds at the default difficulty once lane 2 lands), no bot stands still for more than 20 s while alive and not in cover, no bot leaves the navgrid, two runs with one seed give one event log, and the whole run takes under 120 s of Node.
- `scripts/battlefront-balance.mjs` prints the table the arena asserts, per map and difficulty, for the PR body.
- The world (lane 5 and after): `scripts/battlefront-check.mjs` drives the page through `window.__battlefront` (deploy, advance N seconds without drawing, win, lose) in headless Chromium with a screenshot a step; `anim-check.mjs` on the figures; the usual `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- No pixel gate on the galaxy: this world adds a route and touches nothing of the others.

## 10. What this design does not do

- Does not decompile or read the executable; the bots are this repo's, parameterised by the game's tables.
- Does not interpret schematics at run time.
- Does not build progression, loot, credits or crates; everything is unlocked (decision 11).
- Does not ship the export in the repo; rulebooks and fixtures only. Models, textures, clips, maps and physics come through the streaming lane or the dev backend.
- Does not gate the route; the streaming lane owns the gate and the authenticated bucket.
- Does not touch the galaxy surface's assault, the universe's battles or any other world.
- Does not do audio until the bucket has it; names are reserved.
- Does not run the game's Lua UI scripts or its widget animation graphs; the HUD is React on the kit, shaped and dressed by the widget data.
- Does not reproduce Enlighten's run-time radiosity; the probes, the sky colours and the far shadow cache stand in for it.
- Does not build the sequel era (the standing rule).
- Does not do online in lanes 0 to 6; the sim is shaped for it.

## 11. Lanes

| lane | what | branch | needs | plan |
| --- | --- | --- | --- | --- |
| 0 | the extractor, the parsers, the rulebooks for Hoth's Galactic Assault (weapons, classes, cards, heroes, reinforcements, vehicles, teams, ai, points, strings, cameras, ui, `maps/hoth.json`, `maps/hoth.stages.json`, `maps/hoth.lighting.json`, the icons and fonts) | `claude/bf-data` | nothing | `plans/2026-10-10-battlefront-lane0-data.md` |
| 1 | the sim, soldiers, weapons, bolts, nav, cover and the soldier bots; the arena test with two teams of bots on Hoth and no mode (a skirmish) | `claude/bf-ai` | 0 | `plans/2026-10-10-battlefront-lane1-soldier-ai.md` |
| 2 | Galactic Assault: stages, capture, escort, arm, tickets, spawning, Battle Points, reinforcements, the commander; the balance runner | `claude/bf-assault` | 1 | `plans/2026-10-10-battlefront-lane2-galactic-assault.md` |
| 3 | heroes: abilities, saber combat on lane X's stroke tables, hero bots | `claude/bf-heroes` | 1; #810's lane X for the tables | when 1 merges |
| 4 | vehicles: AT-AT escort, walkers, speeders, turrets, mounts, vehicle bots (rules and bots; the models are #810's lane V) | `claude/bf-vehicles` | 2 | when 2 merges |
| 5 | the world: assets adapter (dev backend), the whole-map pack through lane L's loader, the look from the lighting records and the placed lights, the cameras, figures on the game's clips (phase 1's walrus loader), input, the game's HUD, the route | `claude/bf-world` | 0; #810's lane L and phase 1; the streaming lane for the bucket backend | `plans/2026-10-10-battlefront-lane5-world.md` |
| 6 | Blast, Heroes vs Villains, Strike, then Extraction, Capital Supremacy, Starfighter Assault, Arcade; the other eleven maps' rulebooks | `claude/bf-modes` | 2, 5 | when 5 merges |
| 7 | online: one battle from the wall clock, inputs as events, squads and lobbies | `claude/bf-online` | 6 | later |

Lanes 1, 3 and 5 run in parallel once 0 merges; 2 after 1; 4 after 2; 6 after 5.

## 12. Open assumptions, marked

1. **Battle Point costs and earns** are hand values until a session reads `PF_Gameplay_BattlePoints_Local`'s graph and the deploy screen's `UIWidgetBlueprint`s for the numbers. If found, `points.json` gains `_source`s and loses `hand`.
2. **Headshot multipliers**: `DefaultSoldierBoneCollision` showed aim-assist priorities, not damage multipliers, in the sample read; lane 0 reads the `BoneCollisionData` entries in full and takes the multipliers if present.
3. **Hoth's stage order** is written from the game (the walkers' advance to the shield generator and the ion cannon, the hangars, the transports' fuel) and the stage and objective strings; a later session can check it against `FantasyBattle_Logic`'s graph.
4. **Blaster damage fields**: the rifle's `W_` blueprint showed `MinDamageMultiplier` and `MaxDamageMultiplier`; the per-bolt start and end damage is expected in the projectile the weapon's `Ability_Weapon_*` references. Lane 0's first task resolves the chain on the A280C and writes the field names it found into `bf2017-rulebook.mjs`; if the chain gives none, damage is `hand` from the game's known values until found.
5. **Clip coverage**: 10,270 clips cover the human rig, B1, B2, the heroes and the creatures; VBR (not exported) holds about 1,100 body clips. A state the locomotion wants and no clip covers falls back by the `CLIP_FALLBACK` rule of `walrusRig.js`.
6. **The export's coordinate frame** is glTF's (metres, +Y up, +Z forward); spawn transforms are `right/up/forward/trans` 3×4; yaw is `atan2(forward.x, forward.z)`.

## Departures

Where a lane's code goes another way than this page, one line each, added by the lane when it merges.

- **Lane 0** (the data): Hoth's Galactic Assault has three stages, not four (the strings name `STAGE1` to `STAGE3`: walkers, hangars, escape; the fuel pipes, depot and station are the escape's objectives). The walkers' paths are `AIWaypointsShapeData.Points` (`VehicleWaypointData` hold only speeds and stops). Firing patterns are 202, not 24, signed 64-bit masks read from the record's text. Weapon names are `ID_W_<id>`; abilities and star cards have no derivable string key and go without names. A class row is read from its kit (`Kit_<F>_<Cls>_<Era>_<MAP>`), its default weapon from the kit's `DefaultWeapon_*` or, for five of Hoth's eight classes, its weapon table's default. Reinforcement kinds come from each kit's `Class_Special_*`, not a table. Damage is in the bolt (`WSBulletEntityData.StartDamage`, `EndDamage`, falloff 20 to 40 m on the A280C), so no hand damage values were needed. `abilities.json` joins the rulebooks. Ability modifiers name their property by its output hash (the data has no name). Vehicle weapons are listed per vehicle, not per seat. Weathers come from the map manifest's `sky` list. The soldier camera is the trooper's (`StormTrooperShared`); hero overrides wait for lane 3. Probe and volumetric volumes carry their size, not half extents. Mounts' own health is 1 (the rider takes the hits). To fit 2 MB, cover queries, zones and HUD nodes carry one source per record and linear curves keep only their points.
- **Lane 5** (the world): Hoth is lane L's committed pack drawn in a group at its origin, which restores the export's frame, not a rebuild with `--frame map --no-fit --nav` (the battle's west 200 m are horizon cuts only, the base inside the glacier is out, `nav.bin` waits for lane 1). Lane R built the light, so there is no `lighting.js` or `post.js` and the runtime's passes are untouched; `weather.js` feeds lane 0's records to `applyGameLight`, a placed light's Intensity read as its lumens and its colour as a tint (the colours run to 1,181). Lane L's code comes through `galaxy/shared/level.js`. The ground is drawn from the pack's heightmaps; the camera and the player meet the ground only (the pack has no Havok shapes yet). The clip families are the export's real names (`C_HM_Rifle_*`, `P_HM_Rifle_*`, `A_HM_Death_Stand_*`), not the plan's globs, and the figures play phase 1's humanoid pack on phase 2's snowtrooper and Hoth trooper (every class alike); no weapon in the hand, no squad list. The fallen play the death clip’s first 0.2 s and then fall as the game’s fifteen-body ragdoll (`figures/ragdolls.js` on lane P2’s `ragdoll2017.js`: the bolt’s 50 N·s `ImpactImpulse` at the bone it struck, the level’s ground as the floor, at most 6/4/2 by tier within 60 m, frozen once settled, lying the trooper’s `TimeForCorpse` 10 s, 24 at most); the sim’s kill event carries the shot’s `dir`, `at` and `weapon` for it. Icons are `<img>`, not a symbol sheet. The HUD redraws from an 8 Hz snapshot. The battle is lane 1's sim with 8 bots a side on a navgrid built from the drawn ground (not a `nav.bin`); `battle.js` holds the deploy screen, the stage line and the kill log until lane 2's mode lands. `/bf2/` is served by `scripts/bf2-dev.mjs`.
- **Lane 1** (the sim and the bots): The walk speeds are the character physics' (`soldier.json`'s `OnGroundStateData`: 3.8 m/s, sprint × 1.57, crouch 2.5), not hand values; the capsules take the game's radii (`DefaultSoldierBoneCollision`) on a stance skeleton, since the sim poses no bones. The roll has no row in `abilities.json`, so `ROLL` carries the survey's numbers. `OverheatDropDelay` (5 s) is read as the hold after an overheat; the ordinary drop starts `COOL_DELAY` after the last shot. Bots aim inside their AI weapon's `AimBox*` (it shrinks as they hold a target), not by a difficulty curve: no accuracy curve is in `GameDifficultySettings`'s multiplayer rows. The cover scorer reads the query styles (`CoverQueryStyle_Angle`, `_Distance`, `_ProjectedDistance` and the filters), so both sides use `Attack_Rebel_Soldier`, `Hide`, `Flee` and `Protective`; the Empire's own queries are in the older numbered-curve form. A near miss fills the target's suppression by the shooter's `SuppressionValue` and a bot hides at full; a squad's confidence weighs every friend and believed enemy within 60 m. The skirmish opens each side 40 m back from the front's middle (Hoth's front spawns overlap), and `skirmish.js` is the arena's runner beside `sim.js`. Bots' damage is the weapon row's, not `AI_*`'s `damageModifierExtended`.
- **Lane 2** (Galactic Assault): Hoth has three stages, so the tickets go 90 → +40 → +40, not 300 → 360 → 420 → 480; the stage file holds no tickets or timers, so `TICKETS_START` and `TICKETS_TOP_UP` are constants of the mode, by hand, and no stage has a timer. The walkers’ stage has a fifth objective kind, the `uplink`: a defender holds a console 6 s (`ARM_SECONDS`) to call a bombing run, one in the air at a time and only with a walker within 250 m, which takes a fifth of each walker’s health and opens them to the defenders’ fire for 30 s; the walkers are bodies in the sim (a 20 m column, by hand until lane 4), hurt only while open. A stage is won when its objectives are all done at once, the escorts when any one walker arrives; the uplinks do not count. Capture points open at 0 (the defenders’), and the defenders can push one on to −1. `ADVANTAGE_MAX` is 6, not 4, and both sides’ bots aim three times wider in this mode than in the skirmish (`AIM_SCALE` 3, set on the sim): the levers that brought the attackers to 11 of 20 at a 15-minute median ([the record](../evidence/battlefront-lane2/balance.md)). A spawn set is the stage’s spawn areas; its points are the team’s spawn points inside them, all of them (the data’s `enabled` flag is the graph’s start state, not the stage’s), by priority, safe ones first. Hoth’s out-of-bounds volumes are Strike’s (`Mode9_OOB*`), so Galactic Assault on Hoth has none; `createSim` takes `oob` per team and kills after 10 s where given. Heroes and reinforcements deploy on their own health as their side’s first class until lanes 3 and 4 give them their kits; vehicles are offered at their price and refused (`why 'vehicles'`). The twenty-seed band is the balance runner’s, not the arena’s: the arena runs seed 1 and a three-minute replay, inside the 120 s. Two changes reach lane 1’s code: a goal over 80 m is walked to by 40 m legs, each search capped at 6,000 cells (the long searches were most of the run’s time), and a bot that cannot step into its path’s next cell leaves it out for 10 s; the arena fixture no longer walls in a volume too small for a door (the uplinks), so the skirmish’s “both sides kill” asks for more than 3.
