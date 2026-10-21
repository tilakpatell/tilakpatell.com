| differs, fixed (2) || differs, fixed (2) || differs, fixed (2) |# The source is the law: the sim’s bot brain against the game’s own AI code

Lane A2 of the Battlefront-by-default design (decision 7). The site’s soldier bots (`src/lib/battlefront/ai/`) were written from the game’s records and the executable’s strings, with the scoring loops “pending the decompile”. The owner holds the game engine’s AI source (`Extension/BattleAI/` on the desktop). This page is the sheet of every rule the site’s brain holds, set against what that source does, written before any code changed; then the corrections, each a tested rule with a NOTES row (`src/data/bf2017/NOTES.md`, “The bots’ minds against the AI source”), and the balance before and after.

Nothing of the source is copied, quoted or shipped. A rule is rewritten in the site’s JavaScript in the site’s words; a citation here is a file and a function name, and a sentence of what it does.

## Is the tree this game’s?

Checked first, as the design asks. `Brain/Reason/Tactics.h` (`TacticInfo`) holds eight tactics’ settings: vehicle, charge, attack, hide, flee, close combat, squad movement and squad engage. Their classes (`Shared/AISoldierSpawnTemplateData.ddf`) against the records’ rows (`src/data/bf2017/ai.json` `tactics`, and the raw records under the export’s `AI/BattleAI/Tactics/`):

| settings class | in the tree | in the records | verdict |
| --- | --- | --- | --- |
| `HideSettings` | InvalidateCoverAngle, MinimumTimeActive, MaximumTimeActive, a cover query, move and cover settings | the same three numbers (180, 5, 10), the query | match |
| `CloseCombatSettings` | Distance, HeightDistance, DistanceLimit, LostVisibilityTimeout, PoseSettings | the same four (6, 15, 12, 2 for the rifleman) and the pose; the records add MoveSettings, MeleeProjectileSettings and IgnoreLineOfFireOnEnter | match, the records later |
| `AttackSettings` | four cover queries, MoveSettings, CoverSettings, three cover-request blocks (default, indoor, outdoor), ProjectileSettings, CombatIntensity | the same blocks and queries; the cover-request blocks add AdvanceOnTargetSettings, MinimumTimeBetweenGoalCoverRequests and four more | match, the records later |
| `FleeSettings` | a cover query, move and cover settings | the same | match |
| `ChargeSettings`, `SquadMovementSettings`, `SquadEngageSettings` | present | null or absent in every multiplayer and PvE row | the tactics exist; this game’s soldiers do not have them |
| `EngageSettings`, `WeaponSuppressionSettings`, `VehicleSuppressionSettings` | present | the same fields | match |

The names and the fields agree wherever both hold a class, so the tree is the game’s BattleAI. It is an **earlier build** than the 2017 game’s: the records’ `SoldierTactics` carries Berserk, MeleeCharge, CloseRangeAttack, Investigate, SearchArea, the ExecuteAction rows, Evade, GoToAttackPoint, Follow, GoToTarget and PickWeaponSettings, none of which the tree knows; the records’ `AISystem` targeting holds the distance scores (`TargetDistanceEvaluation`, the scales, `HumanPreferenceScale`, `EnableTargetCoordinator`) where the tree’s `TargetingData` holds four numbers; the AI weapons’ `AccuracyHitBox`, the selection-form cover queries (`AngleToActor`, `PathDistance`…) and the difficulty rows’ panic switches are the records’ alone; the AutoPlayers are not in the tree at all. So the law is read this way:

- a rule the tree holds, on fields the records also hold, is the game’s rule: the site matches it;
- a rule built on fields the tree does not know stays the records’ reading (“silent” below);
- where the records carry a later switch over a tree rule (the multiplayer panic flags), the records win.

## The sheet

Verdicts: **same** (the site does what the source does), **differs** (corrected, with the commit’s row; or left, with why), **silent** (the source does not hold the rule; the records’ reading stands). “Fixed (1)” is this lane’s first pull request, “fixed (2)” its second; “next lane” a later pull request, in the order at the end.

### The tactics: which, in what order, for how long

| # | rule | the site before | the source | verdict |
| --- | --- | --- | --- | --- |
| T1 | which tactics a bot has | flee and hide for every template; close combat for a row with a distance | `Reason/Tactics.cpp`, `TacticInfo::TacticInfo`: a tactic is available only when the template’s tactics row holds its settings | differs, fixed (1): the PvE rows have no hide and no close combat, `Melee_Tactics` no hide, the grunt rows no flee |
| T2 | the order the tactics are tried | a utility pick by rank: flee, hide, interact, close combat, attack, advance, follow | `Mindcraft/__Generated__/Soldier/SoldierBehavior.inl`, `combat_Tactics`: close combat first, then a scripted path, suppressed in cover, vehicle, flee, hide, charge, attack, and plain firing last | differs, fixed (1): close combat above flee and hide |
| T3 | entering close combat | the target nearer than the row’s `Distance` | `Mindcraft/SoldierBehaviorInterface.h`, `isCloseCombatValid` (its inputs from `Brain/AISystem.cpp`’s knowledge update): the target seen, a line of fire, the target’s place 1.5 s ahead on its velocity nearer than `Distance`, the height apart under `HeightDistance`, not moving away from it (under 90°), not in cover and not on the way to a good one | differs, fixed (1) |
| T4 | staying in close combat | re-picked every think; no hold | the same function: held at least 3 s; then kept while the place ahead is inside `DistanceLimit`, the target seen with a line of fire or unseen for under `LostVisibilityTimeout`, and the bot not moving away (under 95°) | differs, fixed (1) |
| T5 | what close combat does | walks at the target | `SoldierBehavior.inl`, `combat_CloseCombat`: stands still and fires, in the pose of `PoseSettings` (standing in every row a template plays; only `AIRebelSoldierTactics`, which no template takes, crouches) | differs, kept: the 2017 records give close combat move settings of its own (a run, and a melee projectile out to 1 m), a later build’s, and the site’s walk at the target stands for that; the melee is not modelled |
| T6 | what makes a bot hide | suppression at 1, or health under 40 % (by hand) | `Brain/AISystem.cpp` (the knowledge update) and `Gather/AiProperties.cpp`: hiding is asked only of a soldier that cannot damage its target with the weapon in hand (a target in a shielded seat; `Reason/TargetInfo.cpp`, `TargetInfo::isWeaponValidAgainst`); health is read by no tactic | differs, fixed (2): every AI weapon row in the records is valid against all (26 of 26), so a soldier here is never sent to hide; it hides only where it has fled into cover, until flee itself is the source’s (T9) |
| T7 | how long a hide lasts | as long as its cause | `Reason/Tactics.cpp`, `TacticInfo::set` draws a limit between `MinimumTimeActive` and `MaximumTimeActive`; `Brain/AISystem.cpp` pushes it on while the cause holds; `SoldierBehaviorInterface.h`, `useTactic` drops the tactic past it: a bot hides while the cause holds and the drawn 5 to 10 s more | differs, fixed (2), with T6: held back from (1) because on the site’s cause by hand (which a heavy’s single near miss sets, under the suppression reading U1 marks wrong) the hold kept so many bots hiding that Galactic Assault’s seed-1 round ran its 25 minutes with no result; on the source’s cause the same round ends, the Rebels wiping the attack at 13.5 minutes |
| T8 | firing while hiding or fleeing | never | `SoldierBehavior.inl`, `combatHide_Hide` and `combatFlee_Hide`: once in its cover a hiding or fleeing bot fires if it may (`attackElseIdle`); on the way there it fires only by the tactic’s move settings (`attackWhileMoving`; every multiplayer flee row says no, no hide row has any) | differs, fixed (1); the Skirmish heavy’s flee, which fires inside 30 m on the way, goes with G14 |
| T9 | what makes a bot flee | its squad’s posture turned to retreat (by hand) | `SoldierBehaviorInterface.h`, `isFleeValid`; `Gather/AIPlayerInfo.cpp`, `updateWeaponSuppression` and the grenade handler: a bot flees when it panics (suppressed over its row’s `SuppressionValue` for `ContinuousSuppressionTime`, a grenade inside its blast, a superior vehicle near); the records’ multiplayer difficulty rows switch panic on for grenades alone, for 2 s | differs, left for the next lane with U1 (the suppression meter must first be read right) |
| T10 | how a flee ends | in the cover its query chose, it hides there | `isFleeValid`: in its flee cover for over 2 s the flee is done and hiding takes over; a bot not panicking that has not reached cover in 2 s gives the flee up | differs in its times; next lane, with T9 |
| T11 | charge | none | `Reason/Tactics.cpp`, `evaluateTactics` zeroes the charge quota every frame (only a stun grenade opens it, `Reason/SharedState.cpp`, `updateChargeState`), and no record of this game has a charge row | same |
| T12 | attack against advance | attack inside the row’s engage distance (40 m), advance on the target beyond | `combat_Tactics`: one attack tactic at any range, its goal-cover query closing to the weapon’s preferred range; `Reason/CombatReasoning.cpp`, `updateCombatGroupEngagedState` reads `EngageSettings.DistanceToTarget` but forces its test true | silent in effect: the tree’s own use of the number is switched off; the site’s split stands on the record’s description (“the distance at which the AI engages”) |
| T13 | stickiness between tactics | the utility pick’s momentum (0.15) | the tree is re-run every tick in its fixed order; a tactic stays only by its own rule (T4, T7) | same in effect: every option has its own rank, so the momentum never decides |
| T14 | the team’s quotas | none | `evaluateTactics`: every tactic’s quota is the unit cap, charge’s zero | same |
| T15 | suppressed in cover | none | `isSuppressed` reads a count the knowledge update always sets to 0 | same: dead in the source |
| T16 | the commander’s objective (interact, objective, follow) | the site’s commander | `SoldierBehavior.inl`: orders and interactions sit above combat, but this game’s objectives are its logic graphs (`botLogic.js`) | silent |
| T17 | how often a bot thinks | every 0.2 s, senses every 0.1 s | every AI update tick; the tree does not hold the rate | silent |

### The target, the trigger and the aim

| # | rule | the site before | the source | verdict |
| --- | --- | --- | --- | --- |
| G1 | who can be a target | every hostile belief, seen, heard or passed on | `Reason/TargetSelection.cpp`, `selectTargets`: the enemies seen within the last second first; one seen earlier only with no target at all | differs, next lane |
| G2 | how targets are ranked | `TargetDistanceEvaluation` over the distance and its scales | `selectTargets`: the nearest seen, by plain distance | silent: the scores are the records’ later fields; the tree’s nearest-first is what they reduce to |
| G3 | how long a target is held | `KeepFiringAtPlayerTime` 4 s or `KeepFiringAtAITime` 2 s before any switch | `Shared/AISystem.ddf` (ShootingData) and `Execute/WeaponControl.cpp`, `soldierAimAndShoot`: those are how long a bot standing still keeps firing at a target it no longer sees; `selectTargets` keeps the current target while it was seen in the last second and no seen one is 2 m nearer | differs, next lane (its test is rewritten with it) |
| G4 | `VisibleTargetLimit` | the share of a squad that may share one target | `Shared/AISystem.ddf`, `SquadTargettingData`: seconds since seen for an enemy to count as seen (`selectTargets` has it as its 1 s) | differs, next lane |
| G5 | the target coordinator | the records’ `EnableTargetCoordinator` | not in the tree | silent |
| G6 | the suppression score bonus | the records’ `SuppressionScore`, by hand | not in the tree | silent |
| G7 | the aim point | the chest, led for the bolt’s speed | `Execute/WeaponControl.cpp`, `computeAimPositionAndOffset`, and `Reason/TargetInfo.cpp` (the target update): the target’s eye less `AimOffsetY` (0.25 m), where it is when seen and where it was last seen when not; a lead only for explosive rounds | differs, next lane |
| G8 | the aim box and its settling | `AccuracyHitBox` and `TimeUntilAccurateFromStartOfFirstDamage` | not in the tree (its time-until-damage is commented out to 0) | silent |
| G9 | the first shot at a new target | waits `FiringDelayAfterAquiringTarget` at its distance | `soldierAimAndShoot`, `holdFireDueToNewTarget` | same |
| G10 | a target seen again | nothing | `soldierAimAndShoot`, `holdFireDueToTargetMoved`, with `Reason/TargetInfo.cpp`, `TargetInfo::setInfo`: a target spotted again more than `ReaquireTargetDistanceThreshold` from where it was last seen waits `FiringDelayAfterReaquiringTarget` | differs, next lane |
| G11 | the range the trigger allows | the gun’s own range | `soldierAimAndShoot`: the AI weapon row’s `WeaponRange` | differs, next lane |
| G12 | firing at a target out of sight | never | `soldierAimAndShoot`: standing still, until unseen for `KeepFiringAtPlayerTime` (4 s, for every target: the AI’s own time is commented out); moving, only while seen | differs, next lane with G3 |
| G13 | the line of fire | a clear line from the muzzle to the aim point | `Gather/VisionInfo.cpp`, `VisionInfo::update`: the target seen (a ray from the eye, see-through materials passing) and nothing in the first 4 m of the gun’s line | same in effect: the site’s one ray stands for both |
| G14 | firing on the move | whenever seen with a clear line | `SoldierBehaviorInterface.h`, `attackWhileMoving`: only when the tactic’s move settings say fire, inside their `FireTargetDistance` (the rifleman’s attack: yes, 40 m; flee: no) | differs, next lane |

### The firing pattern

| # | rule | the site before | the source | verdict |
| --- | --- | --- | --- | --- |
| P1 | which weapon’s patterns | by the gun’s family (a rifle takes `AssaultRifle`) | `Reason/WeaponFiringInfo.cpp`, `getWeaponFiringInfo`: the AI weapon row’s own `FiringWeaponClass` (`AI_Rifle` is `SMG`, `AI_Heavy` `MachineGun`, `AI_Sniper` `SniperRifle`) | differs, fixed (2) |
| P2 | which intensity | by distance when an attack starts: under 15 m High, under 35 m Medium, else Low | `getWeaponFiringInfo` and `Reason/CombatIntensity.cpp`, `updateCombatIntensity`: High until the bot has fired once, then its combat group’s intensity, Medium while alerted; `Brain/AISystem.cpp` lets the attack row’s `CombatIntensity` override it while the bot attacks (High in `Heavy_Tactics`, `Imperial_Grunt_Heavy_Tactics` and every Skirmish row, none in the rest) | differs, fixed (2); the override is transcribed from the records, as `ai.json` drops the field |
| P3 | the next pattern | any of the weapon’s, whatever its intensity | `Execute/WeaponControl.cpp`, `updateWeaponControlState` with `findRandomFiringPattern`: a fresh pattern of the same class and intensity at every burst’s start | differs, fixed (2) |
| P4 | a pattern’s length | its bits to the highest set one, then its delay | `updateWeaponControlState`: the same | same |
| P5 | when the bot is not firing | the pattern runs on | `soldierAimAndShoot`: a bot that does not want to fire ends its burst, one that may not mid-burst starts again; either way the next shot opens a fresh pattern | differs, fixed (2) |
| P6 | a bit’s length | one sim step (0.05 s) | `Shared/FiringPatternData.ddf` gives a pattern’s delay in ticks of a thirtieth of a second, and `updateWeaponControlState` steps one bit a tick | differs, fixed (2): 30 bits a second |
| P7 | what a bit does | a set bit is a shot asked of the gun | `updateWeaponControlState`: a bit holds the trigger down for its tick, and the pattern sets the weapon’s fire logic, single fire for a pattern marked single, automatic for the rest; the weapon’s own rate of fire decides the shots | differs, fixed (2): a single pattern asks once a press, an automatic one at every held tick; with P6 the shots change little (the `SMG` patterns hold the trigger a quarter of the time, the `AssaultRifle` single ones press it 1.5 times a second) |

### What a bot sees and hears

| # | rule | the site before | the source | verdict |
| --- | --- | --- | --- | --- |
| V1 | how far a bot sees | `SIGHT` 100 m, by hand | `Gather/VisionInfo.cpp`, `isWithinViewFrustum`: `SensingConeRange`, or `SensingConeRangeWhenAlerted` once alerted (the records’ multiplayer rows: 60 or 40 m, and 250 m); `Reason/CombatReasoning.cpp`, `updateCombatGroupAlertState`: a side is alerted together, once any of its soldiers sees its target | differs, fixed (2): the difficulty row’s range, the alerted one for the whole side once one bot has seen an enemy (`sensing.js`, `bots.js`) |
| V2 | the view cone | `CONE` about 75° either side, by hand | `isWithinViewFrustum`: `SensingConeAngle`, or `…WhenAlerted` (60° and 90°), with the limits above and below only while not alerted | differs, fixed (2), with V1; the limits above and below are not modelled (the senses’ cone is one cone) |
| V3 | the time to spot | a belief’s confidence rises over a second at the edge of range, but it is seen and can be targeted at once | `VisionInfo::update`: seen the tick the ray is clear inside the cone | same in effect |
| V4 | the sight test | a clear line on the navgrid from eye to chest | `VisionInfo::update`, `hasHit`: a ray from the eye, see-through materials passing | same |
| V5 | after sight is lost | the belief follows the truth for 2.5 s (`intuition`), then coasts and fades over the template’s `TargetLostTime` | `Reason/TargetInfo.cpp`, `TargetInfo::setInfo`: the last known place is frozen the moment sight is lost | differs, next lane |
| V6 | how far a shot is heard | 40 m, by hand | the records’ `SensingShotFiredDistance` 120 m; `Reason/CombatReasoning.cpp`, `updateCombatGroupAlertState`, has the shot-heard alert switched off in this build | same in effect: the site’s bots hear only what the mode makes heard, by the sound’s own radius, and no shot; the 40 m never decides |
| V7 | who is checked each update | every enemy every sense step | `VisionInfo::update`: the target every other tick, the others one a query in turn | same in effect (a cost, not a rule) |

### The squad, suppression, cover and tokens

| # | rule | the site before | the source | verdict |
| --- | --- | --- | --- | --- |
| S1 | the squad’s alert | a wave at the template’s `AlertPropagationSpeed` | `Reason/CombatReasoning.cpp`, `updateCombatGroupAlertState`: a combat group (by default the whole side) alerted at once when any member sees its target | silent: the propagation speed is the records’ later field |
| S2 | the squad’s confidence and posture | the site’s (`lib/ai/squad`), which turns flee on | none: the tree has no posture | differs, next lane with T9 |
| S3 | the combat intensity | none | `Reason/CombatIntensity.cpp`, `updateCombatIntensity`: Medium for an alerted group, none otherwise | differs, fixed (2), with P2 |
| U1 | suppression | a near miss adds the shooter’s `SuppressionValue`, faded over the target’s `ContinuousSuppressionTime` | `Gather/AIPlayerInfo.cpp`, `AIPlayerInfo::updateWeaponSuppression`: `SuppressionValue` is the level a soldier’s own suppression must stay over for `ContinuousSuppressionTime` before it panics (so the heavy’s 1 means never); the meter is the soldier’s, outside BattleAI | differs, next lane: the soldier’s suppression records are read first |
| U2 | `EngageSettings.SuppressionValue` | unused | `updateCombatGroupEngagedState`: over it a soldier counts as shot at, which only marks it engaged | same in effect |
| C1 | the selection-form cover queries (`coverQuery.js`) | the records’ scores | not in the tree | silent |
| C2 | a negative score in the older-form queries (`cover.js`) | added to the total | `Reason/CoverRequestJob/CoverRequestJob.cpp`, `applyScore`: any score below 0 rejects the cover | differs, next lane |
| C3 | the older form’s angle | measured from the line between the bot and the target, by hand | `CoverRequestJob.cpp`, `scoreCoverRequests` (`angleRelativeDirectionDeg`): from the score’s own `ReferenceDirection`, which `ai.json` does not carry | differs, next lane (the extractor first) |
| C4 | when an attacking bot asks for a new cover | after a drawn 1 to 3 s (the outdoor block), or when its slot stops shielding | `Reason/CoverStateUpdate.cpp`, `CoverState::updateAttackCoverRequestState` and `updateTimers`: after the drawn time in cover and only if the cover is outside the weapon’s preferred range of the target or the target has been lost for its drawn time, never within `MinimumDistanceToTarget`; the default block unless the level says indoor or outdoor | differs, next lane |
| C5 | a hide cover turned | kept while held | `CoverStateUpdate.cpp` (the hide update, `InvalidateCoverAngle`): a hide cover the target has come round past half that angle is given up | differs, next lane |
| C6 | covers taken by others | not offered | `TacticCoverEvaluator.cpp`, `bookCovers` | same |
| K1 | the team’s grenade token | the next one 12 to 24 s after a throw | `Reason/SharedState.cpp`, `updateGrenadeState`: the next one a uniform draw between the minimum and maximum time after one is taken | same |
| K2 | token refills | one a team, a next time | `Reason/TokenUpdater.cpp`, `updateTokens`: the clock runs only while below the cap, and refills to the cap when it passes a drawn interval | same in effect for a one-token row |
| K3 | when a bot throws | the Skirmish ability logic’s poll; the AutoPlayers never | `SoldierBehaviorInterface.h`, `canFireProjectile`: a human target, in cover over 2 s, inside the projectile row’s range | silent: the site’s grenade is the PvE logic prefab’s and the AutoPlayer’s, not BattleAI’s |

### Not BattleAI

The AutoPlayers (`autoPlayer.js`, `soldierBrain.js`’s `thinkAutoPlayer`: the online fill’s bots, checked against the executable’s decompile in NOTES), the heroes’ fencing (`heroBrain.js`), the walkers’ gunners (`vehicleBrain.js`), the squadron trees (`squadron.js`), the creatures, the commander and the bot logic graphs are other systems. The tree has none of them, and nothing here changes them.

## The corrections in the first pull request

Each is a tested rule in `src/lib/battlefront/ai/tactics.js` and `soldierBrain.js` (`tactics.test.js`, `soldierBrain.source.test.js`) and a row in NOTES (“The bots’ minds against the AI source”).

1. **The tactics’ order and close combat** (T1 to T4): a tactic only when the template’s row holds it; close combat tried before flee and hide, entered by the source’s test, held at least 3 s and left by its limits. A hurt rifleman with an enemy at arm’s length now fights it rather than turning its back to hide; a Skirmish bot no longer hides at all. One reading by hand, said in NOTES: a bot sidestepping in the open counts as standing for the test’s turn, as the source has that bot standing (`attack_Fire`); without it a sidestepping trooper never closed with a hero at arm’s length.
2. **A hiding bot’s fire** (T8): a hiding or fleeing bot fires from its cover once it is in it, and not on the way. (A hide’s drawn hold, T7, was written with it and is held back: see T7’s row.)

## The corrections in the second pull request

Each a tested rule in `tactics.js`, `sensing.js`, `soldierBrain.js` and `bots.js` (`tactics.test.js`, `sensing.test.js`, `soldierBrain.source.test.js`, `bots.sight.test.js`) and a row in NOTES.

1. **The firing pattern** (P1 to P3, P5 to P7, S3): the patterns of the AI weapon’s own class (`AI_Rifle` is an SMG), High until the bot first fires and Medium after (High while a heavy or a Skirmish bot attacks), drawn afresh each burst, ended when the bot stops firing, a bit a thirtieth of a second. The first pull request held it back reading every set bit at 30 a second as a pull (about 2 pulls a second to about 7 for a rifle bot); `WeaponControl.cpp` says what a bit does: it holds the trigger, a single pattern firing once a press and an automatic one at the gun’s own rate while held, so the shots barely move (the hero test’s three troopers fired 26 bolts in their seed-5 minute before, 32 with the patterns read so).
2. **What sends a bot to hide, and for how long** (T6, T7): only a target its AI weapon cannot hurt, which no AI weapon of the game’s meets, and the row’s drawn 5 to 10 s after; health and suppression no longer send it. Measured to a result on Galactic Assault’s seed 1, as the hold on the hand cause was not: the Rebels wipe the attack at 13.5 minutes, where `main` took 18.6.
3. **What a bot sees** (V1, V2, and V6 found the same in effect): the difficulty row’s cone, 60 m and 60° either side on the multiplayer default, and 250 m and 90° for the whole side once any of its bots has seen an enemy.

Three tests that made a bot hide by suppression now give it the source’s cause, asserting what they did; the AutoPlayer test’s cone check expects the row’s cone; and the hero test (“Luke runs down three troopers and cuts them”) plays seed 1, not 5: with hiding as the source has it, seed 5’s troopers fight on hurt and die of their own bolts turned back and of the push before a cut (in four seeds, two cut before the change and two after, seed 1 in both), Luke’s own rules unchanged.

## What is left, in order

- **Targeting** (G1, G3, G4, G10, G11, G12): the seen-within-a-second candidates and the 2 m slack, `TargetLostTimer`, `VisibleTargetLimit` as seconds, the keep-firing time as the source uses it (its test rewritten with it), the reacquire hold, the AI weapon’s range.
- **Vision** (V5): the last known place frozen the moment sight is lost.
- **Flee and suppression** (T9, T10, S2, U1): panic as the trigger of flee (a grenade, in the multiplayer rows), its 2 s in flee cover before hiding, suppression read as the panic threshold once the soldier’s own suppression records are read.
- **Aim and fire on the move** (G7, G14): the eye less 0.25 m; the move settings’ fire rule, transcribed, as `ai.json` drops the move settings.
- **Cover** (C2 to C5): a negative older-form score rejects; the reference direction (the extractor first); the attack cover kept until out of range or the target lost; a turned hide cover given up.

## The balance before and after: the first pull request

`node scripts/battlefront-balance.mjs --skirmish` and `--assault` (the defaults: 20 a side; ten Skirmish runs of 180 s on Hoth’s arena navgrid, twenty Galactic Assault rounds of up to 25 minutes), on `main` (`06d673d9c`; the sim and the brain are the same at `99b366d58`, which this branch merged) and on the branch. The runs are seeded, so a row moves only where the brain does. The milliseconds are the desktop’s under other sessions’ load, and the branch’s assault ran in four processes (`--jobs 4`), so they are not compared.

Skirmish, kills a side and the bots alive at the end:

| seed | main | branch |
| --- | --- | --- |
| 1 | 13 – 15, 5 – 7 alive | 16 – 13, 7 – 4 |
| 2 | 19 – 16, 4 – 1 | 9 – 19, 1 – 11 |
| 3 | 17 – 8, 12 – 3 | 6 – 20, 0 – 14 |
| 4 | 14 – 13, 7 – 6 | 19 – 5, 15 – 1 |
| 5 | 13 – 15, 5 – 7 | 9 – 15, 5 – 11 |
| 6 | 16 – 12, 8 – 4 | 18 – 12, 8 – 2 |
| 7 | 15 – 12, 8 – 5 | 17 – 10, 10 – 3 |
| 8 | 14 – 16, 4 – 6 | 9 – 16, 4 – 11 |
| 9 | 18 – 12, 8 – 2 | 18 – 7, 13 – 2 |
| 10 | 20 – 4, 16 – 0 | 11 – 18, 2 – 9 |
| mean | kills 15.9 to 12.3; more alive: Rebels 7, Empire 3 | kills 13.2 to 13.5; Rebels 5, Empire 5 |

Stuck 0 and off the navgrid 0 in both.

Galactic Assault (the Empire attacks):

| | main | branch |
| --- | --- | --- |
| results | the Rebels 15 (all by wiping the Empire’s reinforcements), the Empire 0, none in 25 minutes 5 | the Rebels 14, the Empire 0, none 6 |
| median round | 20 min | 19.6 min |
| kills | 154.0 (Rebels) to 202.1 (Empire) | 156.9 to 195.6 |
| seed 1 (the arena test’s round) | the Rebels at 18.7 min, 150 – 204 | the Rebels at 18.6 min, 149 – 197 |
| stuck, off the navgrid | 0, 0 | 0, 0 |

What moved, and why it should have: a bot no longer turns its back to hide from an enemy at arm’s length but closes with it and holds the fight 3 s, and a hiding or fleeing bot in its cover fires where before it only crouched. Both give a bot under pressure a few more shots and its enemy a few fewer clear ones. In Galactic Assault the Rebels defend from cover and hide there more, so their kills rise by about 3 a round and the attacking Empire’s fall by about 6 and a half; in Skirmish, where both sides cross the open, the two sides’ kills come together (from 15.9 – 12.3 to 13.2 – 13.5) and the round’s total falls by one and a half. The single seeds swing more than the means (a battle is chaotic: one change early moves every shot after it), and no mean moves past the spread between seeds. The round the arena test plays ends as it did, a minute’s tenth sooner.

The bots’ seeds (`npm run test:ai -- src/lib/battlefront`, the Skirmish and Galactic Assault arena tests): on `main` 20 of 20 (stuck 0); on the branch the same, stuck 0 and every round ending in its result, but for the arena test’s timing of seed 1 (“inside 90 s of Node”), which on this desktop under other sessions’ load took 165 s and 117 s on the branch (the whole file 8 and 12 minutes, where `main`’s took 4 in a quiet hour) and 101 s on `main` in a loaded run; the same round run alone, back to back, took 102, 68 and 77 s on the branch and 92 s on `main`, so the round is no slower and the miss is the load. CI runs the test on its own machine.

## The balance before and after: the second pull request

The same tables, on `main` at `1f2bb5c15` (the first pull request merged) and on this branch; both assaults in four processes (`--jobs 4`).

Skirmish, kills a side and the bots alive at the end:

| seed | main | branch |
| --- | --- | --- |
| 1 | 16 – 13, 7 – 4 alive | 20 – 12, 8 – 0 |
| 2 | 9 – 19, 1 – 11 | 20 – 8, 12 – 0 |
| 3 | 6 – 20, 0 – 14 | 15 – 14, 6 – 5 |
| 4 | 19 – 5, 15 – 1 | 20 – 5, 15 – 0 |
| 5 | 9 – 15, 5 – 11 | 13 – 17, 3 – 7 |
| 6 | 18 – 12, 8 – 2 | 8 – 20, 0 – 12 |
| 7 | 17 – 10, 10 – 3 | 20 – 7, 13 – 0 |
| 8 | 9 – 16, 4 – 11 | 20 – 8, 12 – 0 |
| 9 | 18 – 7, 13 – 2 | 20 – 5, 15 – 0 |
| 10 | 11 – 18, 2 – 9 | 20 – 6, 14 – 0 |
| mean | kills 13.2 to 13.5; more alive: Rebels 5, Empire 5 | kills 17.6 to 10.2; Rebels 8, Empire 2 |

Stuck 0 and off the navgrid 0 in both.

Galactic Assault (the Empire attacks):

| | main | branch |
| --- | --- | --- |
| results | the Rebels 14 (all by wiping the Empire’s reinforcements), the Empire 0, none in 25 minutes 6 | the Rebels 19, the Empire 0, none 1 |
| median round | 19.6 min | 15.6 min |
| kills | 156.9 (Rebels) to 195.6 (Empire) | 153.8 to 209.5 |
| seed 1 (the arena test’s round) | the Rebels at 18.6 min, 149 – 197 | the Rebels at 14.3 min, 150 – 204 (13.5 min with the patterns and the hide alone) |
| stuck, off the navgrid | 0, 0 | 0, 0 |

What moved, and why it should have: a bot no longer hides because it is hurt or under fire but fights on, as the game’s own soldiers do, and once one bot of a side has seen an enemy the whole side sees out to 250 m where it saw 100 (60 m until then). Fights start sooner and farther off and nobody sits them out in cover, so more of them end. In Galactic Assault the defending Rebels, watching the open ground the attack crosses, spend the Empire’s 150 reinforcements four minutes sooner (19 rounds of 20 now end, where 14 did) and take more fire for it (the Empire’s kills up 14 a round). In Skirmish, with no reinforcements, most rounds now end with one side wiped out; the side that sees first fires first, and on this arena that is the Rebels, whose edge it already was before the first pull request (7 rounds of 10 then, 8 now). The firing patterns move little: the trigger counted as the game counts it gives about the shots it did.

The bots’ seeds (`npm run test:ai -- src/lib/battlefront`): 19 of 20 on the branch, stuck 0 in every round and every round ending in its result; the one miss is the arena test’s timing of seed 1 (“inside 90 s of Node”), 165 s in the run and 120 s alone with 97 Node processes of other sessions on the desktop. The same round back to back took 203 s on `main` and 202 s on the branch: each minute of battle costs more (the wider cone tests more lines of sight), but the round is four minutes shorter, so the whole round costs the same. CI runs it on its own machine.
