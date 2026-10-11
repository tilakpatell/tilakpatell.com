# Research: squad (the Battlefront world's follow-up, 2026-10-10)

**Squad list: research report and implementation plan** (read-only; nothing tracked was edited)

The data settles three things the task assumed:
- **Squad size is 4.** `TacticalSpawnManagerEntityData.MaxPlayersPerSquad` = 4 in `Gameplay/GameModes/Shared/SpawnManager_Shared_MP`.
- **A HUD cell has no health or distance.** It shows a class icon, a name, a colour for alive, dead or party, and an objective letter when the member has an order.
- **The +25 squad-spawn Battle Points stays a hand value.** The award "SQUAD SPAWN ON YOU" exists in the game, but no record holds its value.

Two things in the repo get in the way:
- `battle.js` runs the sim with no `mode`, so lane 2's `sim.deploy` and its squad spawn are never used by the page.
- The player is in no squad: `createSquads` takes bots only.

## (1) What the game files hold

Fetched into `lab/assets/bf2017/` (about 2 MB in all):
```
NODE_USE_ENV_PROXY=1 node scripts/bf2017-fetch.mjs data 'UI/InGame/Hud/SquadMemberList/*' 'UI/Shapes/InGame/HUD/SquadList/*' 'Gameplay/Profiles/ui/OptionHUDSquadListVisibility' 'UI/InGame/Spawn/FastSpawn/*' 'UI/InGame/Spawn/FastSpawnScreen' 'UI/InGame/Spawn/TacticalSpawn/*' 'Online/Killswitches/SquadSpawn_*' 'UI/InGame/Hud/Soldier/Screens/*' 'Gameplay/GameModes/Shared/SpawnManager_Shared_MP' 'Persistence/Scoring/MPScoring' 'Persistence/StatCategories/*Stat*' 'UI/MetaData/ScoreUIMetaData' 'UI/Data/GameModes/PlanetaryBattles' 'default/settings'
NODE_USE_ENV_PROXY=1 node scripts/bf2017-fetch.mjs --raw strings/English.json   # and strings/keys.json
```
- The bucket folder is `UI/MetaData/`, not the index's `UI/Metadata/`. A glob in the index's spelling matches nothing.
- Field names are hashed. The hash is djb2-xor (start 5381; for each character, `h = (h*33) ^ c`). Brute force resolved most of them (`Out`, `Color`, `Visible`, `IsAlive`, `IsLocalPlayer`, `IsInMyParty`, `PlayerName`, `ClassIcon`, `ObjectiveName`, `ObjectiveNameVisible`, `OutlineColor`, `InColor`, …).

**How squads form and spawn.** All from `Gameplay/GameModes/Shared/SpawnManager_Shared_MP` (52,901 B):

| What | Field | Value |
|---|---|---|
| Squad size | `TacticalSpawnManagerEntityData.MaxPlayersPerSquad` | 4 |
| Wait for squadmates at deploy | `.MaxWaitTime` | 10.0 s (record default) |
| | `.MaxSpawnWaitTime` | 2.0 |
| Spawn rules | `.SpawnSquadOnFirstPlayer` | true |
| | `.SpawnOnSpawnEntityIfSpawnOnPlayerFails` | true (falls back to a spawn point) |
| | `.LockKitOnPlayerEnterWave` | true |
| | `.HashPositionTableId` | 999428329 |
| Squad manager | `SquadManagerEntityData.Enabled` | true |
| | `TacticalGroupManagerEntityData` | `UseLastGroupLevel` true, `LevelCap` true |
| Partners | `AutoPartnerEntityData` | `ResetPartnerHand` true |
| | `FastSpawnManagerEntityData` | `HashPositionTableId` 999428329 |
| Squad-spawn offsets | `SpawnManagerEntityData.FriendlySpawnPositionTables[0]` (id 999428329), x right / y ahead of the mate | (0,−3), (−1.6,−2.25), (1.6,−2.25), (0,−5), (−1.6,−4), (1.6,−4), (0,−7), (−1.6,−6), (1.6,−6), (−2,3), (2,3), (0,3) |
| | Table [1] (id 1645058152) | Same pattern scaled ×4 |
| | `FriendlySpawnPositionAttemptOffset` | (0,0,−6) |
| | `FindFriendlySpawnPositionAttemptCount` | 2 |
| | `CheckSpawnArea` | true |
| | `UseVehicleSquadSpawn` | false |
| Spawn finder | `SpawnLocationFinderEntityData.SpawnSafeEnemyDistance` | 50.0 (lane 2's `SAFE` is 30 by hand) |
| | `.SpawnPointCheckRadius` | 1.5 |
| | `.DeathWeight` / `.EnemyWeight` / `.FriendlyWeight` / `.SpawnWeight` | −50 / −2 / −1 / −100 |
| | `.SpawnRememberDuration` / `.DeathRememberDuration` | 10 / 10 |

- **Wait time by mode:** a `FloatHub` picks `MaxWaitTime` from the interface's 5 / 10 / 0. A Math node selects index 0 for Blast (5 s), 2 for `Mode1` = Supremacy (0 s), and 1 otherwise, which is Galactic Assault (10 s). A second hub, fed from 0xf79143d7 and a `SyncedBool`, makes this a little ambiguous.
- **Squads a team:** `UI/Data/GameModes/PlanetaryBattles` has `GameModeId` "PlanetaryBattles", the name "GALACTIC ASSAULT", `NumberOfPlayers` 40. That is 20 a side, so 5 squads of 4, named by `ID_SPAWN_GROUP_NAME_A` to `_E` ("A" to "E"). The 5 is derived, not stored.
- **When you can't spawn on a mate:** three killswitch names (`Online/Killswitches/…`, `KillswitchData`) say what puts a soldier in combat: `SquadSpawn_InCombat_WhenAffectorAppliedToMe`, `…_WhenAppliedAffectorToOpponent`, `…_WhenNearGrenade`. No duration is recorded.
- **Block reasons on screen:** `ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT` "IN COMBAT", `_OUT_OF_BOUNDS` "OUTSIDE MISSION AREA", `_IN_VEHICLE` "IN VEHICLE", `_NO_PLAYER` "NO PLAYER", `_OTHER` "UNAVAILABLE". Also `ID_HUD_SQUADSPAWN_KILLED` "DEFEATED", `ID_HINT_GENERAL_03` "You can spawn on squad mates unless they are in combat, out of bounds, in a vehicle, or an airborne unit.", `ID_SPAWN_TACTICALSQUAD_FULL` "GROUP FULL / DEPLOYING", and the HQ names `ID_SPAWN_GROUP_NAME_REBELHQ` / `_IMPERIALHQ`.
- **Where those strings are:** the block reasons are in `public/ui/bf2017/strings/squad.json`, not in `src/data/bf2017/strings.json`.

**Squad points and score.**
- `ScoreUIMetaData` (`UIScoreMetaData`) has these entries:
  - "SQUAD SPAWN ON YOU": Identifiers [2793359391], "MP - Squad - Squad Spawn on Player", visibility Minor, colour `SpawnWaveBuddy`.
  - "SQUAD PROXIMITY": 1544296590, "MP - Cut - Spawn Squad Proximity Bonus" (cut from the game).
  - "TEAMPLAY": 764560237, "MP Cut - Spawn Squad Kill".
  - Skirmish versions: 2578556415 and 3832239799.
- None of these identifiers is in `Persistence/Scoring/MPScoring`, so their values are not in the data.
- The one squad value MPScoring does hold: `StatEvent_SavedBySquadmate` Score 50.
- Side finding: `StatEventHandlerData.KillAssistTimeout` is 5.0, against lane 2's hand `ASSIST_WINDOW` of 8.
- Hint text: "Stay with your squad to gain score and ability recharge bonuses." The bonus value is not in the data either.

**Where the squad list sits on the HUD.** From `UI/InGame/Hud/Soldier/Screens/DefaultSoldierHudWidget` (41,771 B):
- Element "Squad Member List" (the `SquadMemberList` blueprint) shares a `StackingContainerData` with the Radar. The container is LeftToRight, reversed, `Spacing` 32, anchor (0,1), offset (90,−46).
- So the order is radar, then the squad list to its right, at the bottom left. Its x is about 90 + 256 + 32 = 378 on the 1920 × 1080 reference; this is derived from element sizes.
- It shows when interface 0x4184dc26 AND a `BoolHub` over `OptionHUDSquadListVisibility` are true. The option's items are Default, NoOutline and Off; only Off hides the list.
- The option's description: "Show full squad list, only squad member class icons or turn the squad list off."

**The widget records.**

`SquadMemberList` (5,789 B):
- A TopDown stack, 320×128: the `LocalPlayer` row (`SquadMemberListLocalPlayer`), then a `StandardListElementData` "Squadmembers".
- The list: `CellSize` 320×32, `MaxRows` 3, `CellTemplate` = `SquadMemberListCell`, fed by `SquadQueryEntityData` with `FilterOwnPlayer` true.
- So it is 1 local row plus up to 3 squadmate rows.

`SquadMemberListCell` (12,875 B) casts its data to `SpawnGroupMemberData`, so a squad is a spawn group. It then sets:
- Name: `PlayerInfo.PlayerName`.
- Class icon: `CharacterClassInfo` → `SvgIcon` → `ClassIcon`.
- Objective letter: `PF_IndexObjectiveIconSelect` (fed by the member's focused objective index) → `ObjectiveName`. `ObjectiveNameVisible` comes from PlayerInfo.
- Name colour (`InColor`):
  - Grey, palette 34 = rgb(120 130 135), if not `IsAlive` or if an unresolved flag (0xf96e5759) is set.
  - Otherwise green, palette 41 = rgb(20 174 0), if `IsInMyParty`.
  - Otherwise orange, palette 42 = rgb(242 174 10).
- Icon, outline and letter colour (`OutlineColor`): palette 35 = rgb(50 60 65) if dead, flagged or in your party; otherwise palette 60 = rgb(94 65 1).
- `IsLocalPlayer`: false.

`SquadMemberListLocalPlayer` (8,807 B) draws your own row:
- `IsLocalPlayer` true.
- `InColor` palette 42, `OutlineColor` palette 60.
- Name from `LocalPlayerEntityData.Name`; class from `OwnerToCharacterId`.

`SquadMemberListContent` (27,735 B) is the row itself:
- **Name text:** at offset (40,0), anchor (0,0.5). Squadmates use "PlayerName" in `Univers520MediumCondensed18px`; you use "LocalPlayerName" in `Univers620BoldCondensed18px`. Minimum size 16, left-aligned, font effect `InGameHudReadableFontEffect`.
- **Bar behind the name:** "BgBlur" is the `SquadListBG` shape with blurred background and `GlowWidth` 18. Its size is (text width + 64, 14); the Math consts are 0x42800000 = 64 and 0x41600000 = 14.
- **Icon:** "IconContainer", 32×32, anchor (0,0.5), holds:
  - `SquadIconBGoutline` and `SquadIconBG` shapes, both 22×22.
  - `SquadOrderLetter`, offset (1,0).
  - `ClassIcon`, an SVG 26×26.
- **Turn on an order:** when `ObjectiveNameVisible` is set, the icon background turns 45° (interface field 0xf79143d5 = 45). A `TransformInterpolator` makes the turn Expo EaseOut over 0.5 s.
- **Icon/letter swap:** a 2 s looping timeline crossfades the icon and the letter. The icon goes 1→0 over 0–0.15 s and back 0→1 over 1.0–1.15 s; the letter does the opposite. It plays on `OnTrue` and stops on `OnFalse` of the `ObjectiveNameVisible` compare.
- **Option:** `NoOutline` (option index 1) hides the bar and both name texts, which leaves the icons only.

Shapes:
- `UI/Shapes/InGame/HUD/SquadList/SquadIconBG` and `…BGoutline`: a 20×20 circle (corner radius 10) with one square corner at the top right, i.e. a pin.
- `SquadListBG`: 64×32, solid alpha from x 0 to 40, then fading to alpha 0 at x 64.

**The deploy screen's squad strip.**

`UI/InGame/Spawn/FastSpawnScreen` (46,412 B):
- "SpawnPoints" is a TopDown stack with spacing 10, anchor (0.5,1), offset (0,−132), 1152×112.
- First row: `FlagSpawnListCell` list, cells 230.4×112, max 6.
- Second row, "PlayersAndDefault": `FastSpawnListCell` list, cells 288×112, `MaxRows` 3, horizontal, fed by `SquadQueryEntityData`; then `HeadquarterCell` 288×112 at x 863.

`FastSpawnListCell` (38,674 B) holds:
- `PlayerSquadSpawnInfoEntityData`.
- "SpawnBlockReasonText".
- "CharacterUnavailablePattern" (a scanline fill).
- A `FastSpawnListCellView`: "CharacterSummary" and "PlayerUsername" (288×56).

`TacticalSpawnCountdownWidget` holds the "SQUAD FULL, SPAWNING" text and a 112×112 countdown.

## (2) What the repo already has, to reuse

**Squads (lane 1).** In `src/lib/battlefront/ai/squad.js`:
- `SQUAD_SIZE = 4` at :15 (marked "by observation"; the data confirms it).
- `createSquads(sim)` at :22: bots only (`e.bot`), chunked by 4, ids `${team}.${n}`.
- `squadOf` at :36.
- `update` at :38: the leader is the first alive member (`alive[0]`) at :41.
- `alert` / `deliver` at :70 / :81.

**Bots.** In `src/lib/battlefront/ai/bots.js`:
- `createBrains` builds the squads at :55.
- `worldFor` at :69 reads `squadOf` and the leader.
- `add(){}` at :59 is a no-op.

**Commander.** `src/lib/battlefront/ai/commander.js`:
- `createCommander({ team, side, ga, squads, … })` at :41 keeps the squad array it is given. `sim.js:132` passes a filtered copy, so a squad added later is invisible to it.
- `spend(c, id, { squadClasses, out })` at :208.
- `ONE_A_SQUAD` (officer and specialist, one a squad) at :36.

**Spawn.** `src/lib/battlefront/spawn.js`:
- `squadSpawn({ squad, me, enemies }) → { at, yaw, mate } | null` at :69. It skips mates that are dead, rolling, suppressed or within `SAFE` of an enemy.
- `BEHIND = 1.5` (hand) at :19; `SAFE = 30` (hand) at :17.

**Sim.** `src/lib/battlefront/sim.js`:
- `deploy(sim, id, { kind, id, spawn: 'squad' })` at :193–240 (squad branch at :204–207; `earn(sim.bp, spot.mate, 'squadSpawn')` at :236).
- Bot waves pick `'squad'` at :409–416.
- `addPlayer` at :173 calls `sim.brains?.add?.(s)`, which does nothing.
- `addSoldier` takes `id: given` at :143.
- `view(sim, { player })` at :466 gives entities `{ id, team, kind, at, yaw, hp, hpMax, state, stance, moving, aim, firing, heat, mode, unit, points, oob }`, plus `mode`, `deploying` and `deploy`. It has no `cls` and no `squad`.

**Battle Points.** `src/lib/battlefront/battlePoints.js` `earn(bp, id, kind)`; `src/data/bf2017/points.json` `earn.squadSpawn: 25` (source "hand").

**Page battle.** `src/components/battlefront/battle.js`:
- `createSim(...)` at :64 has no `mode`.
- `deploy` at :99–112 gives the player a new id every life (`p.id = addSoldier(...)` at :108).
- `BOTS = 8` a side; `nameOf` at :114 names bots "Trooper N".
- `view` at :175.

**Page module.** `src/components/battlefront/module.js` builds `snapshot()` at :115–135 from `view(sim)`.

**HUD.**
- `hud/BattlefrontHud.jsx` (50 lines) holds the parts.
- `hud/widgets.js`: `REF`, `placeWidget({anchor,size,offset},{w,h})` at :27, `FRIEND`/`FOE` slots, `teamColour`.
- `hud/icons.js`: `CLASS_ICON`, `iconSrc`, `offerIcon`; the SVGs are under `public/battlefront/icons/UI/SVG/Classes/`.
- `hud/DeployScreen.jsx`; `hud/Radar.jsx` with `RADAR_RANGE 80`.
- `hud/parts.test.jsx` and `widgets.test.js` set the test pattern.

**Shared UI library** (`src/lib/bf2017/ui/index.js`): `widget(name)`, `colour(index)` (linear to sRGB), `fontFor(gameFont)`. `ui.json` already has the four `SquadMemberList*` trees, but without the list's cell size and rows or the palette picks.

**Strings.** `src/lib/bf2017/strings.js`: `text`, `loadFamily('squad')`. `src/lib/battlefront/rulebook.js`: `stringOf`, `loadRulebook` (add `squads`).

**Extractor.** `scripts/bf2017-data.mjs` `RULEBOOKS` (add a `squads` step). Fixtures live under `scripts/fixtures/bf2017/data/`.

## (3) Implementation plan

**A. Data first: `src/data/bf2017/squads.json`, every value with `_source`.**
- New extractor: `scripts/lib/bf2017-rulebook-squads.mjs`, `export function squadsRow(root, { strings })`. Add `'squads'` to `RULEBOOKS` and `fileOf` in `scripts/bf2017-data.mjs`.
- Build it with: `node scripts/bf2017-data.mjs squads --root lab/assets/bf2017`.
- Copy fixtures for its test with: `node scripts/bf2017-data.mjs fixture Gameplay/GameModes/Shared/SpawnManager_Shared_MP --cut root --root lab/assets/bf2017`. Do the same for the four `SquadMemberList*` records, `DefaultSoldierHudWidget`, `FastSpawnScreen` and `OptionHUDSquadListVisibility`.

The file's shape:
```json
{ "size": 4, "maxWait": 10, "maxSpawnWait": 2, "spawnOnFirstPlayer": true, "fallbackToPoint": true, "lockKitOnWave": true,
  "offsets": [[0,-3],[-1.6,-2.25],…12], "attemptOffset": [0,0,-6], "attempts": 2, "checkRadius": 1.5,
  "names": ["ID_SPAWN_GROUP_NAME_A",…"_E"], "hq": {"light":"ID_SPAWN_GROUP_NAME_REBELHQ","dark":"ID_SPAWN_GROUP_NAME_IMPERIALHQ"},
  "blocked": {"combat":"ID_SQUAD_SPAWN_BLOCK_REASON_IN_COMBAT","oob":"…_OUT_OF_BOUNDS","vehicle":"…_IN_VEHICLE","none":"…_NO_PLAYER","other":"…_OTHER","dead":"ID_HUD_SQUADSPAWN_KILLED"},
  "inCombat": ["AffectorAppliedToMe","AppliedAffectorToOpponent","NearGrenade"],
  "hud": { "place": {"anchor":[0,1],"offset":[90,-46],"afterRadar":32}, "row": [320,32], "maxRows": 3,
           "name": {"offset":[40,0],"font":"Univers520MediumCondensed18px","localFont":"Univers620BoldCondensed18px"},
           "bar": {"extra":64,"height":14,"solidTo":40,"width":64}, "icon": {"box":22,"svg":26},
           "palette": {"dead":34,"party":41,"other":42,"local":42,"iconDead":35,"iconParty":35,"icon":60,"localIcon":60},
           "order": {"turn":45,"seconds":0.5,"blink":{"period":2,"fade":0.15}}, "option": ["Default","NoOutline","Off"] },
  "deploy": {"anchor":[0.5,1],"offset":[0,-132],"size":[1152,112],"cell":[288,112],"maxRows":3},
  "score": {"savedBySquadmate":50, "squadSpawnOnYou": {"id":2793359391,"text":"SQUAD SPAWN ON YOU"}} }
```
- `rulebook.js` gains `squads` in `loadRulebook` and `export const squadsOf = (rb) => rb.squads`.
- Add a line to `NOTES.md` for every hand value: `IN_COMBAT`, the leader rule, the squad-spawn BP 25.

**B. Sim (pure). Write the tests first.**

In `ai/squad.js`:
- `SQUAD_SIZE` stays 4; its comment now cites `TacticalSpawnManagerEntityData.MaxPlayersPerSquad`.
- Leader becomes `alive.find((m) => m.bot) ?? alive[0]` (hand: bots keep following the commander's squad order, not the player).
- New `joinSquad(squads, sim, id) → { squad, created: squad | null }`:
  - Put `id` in the team's first squad with room.
  - If every squad is full, `id` takes the last slot of the team's first squad, and the displaced bot goes to a squad with room, or to a new squad `${team}.${n+1}`, which is returned as `created`.
- New `squadRows(squads, sim, id, { names, letterOf }) → { id, letter, members: [{ id, name, cls, alive, local, order }] }`. The local row comes first. `letter` is the squad's index into `names`. `order` is the objective letter of the member's `brain.task`.

In `spawn.js`:
- New `blocked(mate, { enemies, now }) → null | 'dead' | 'oob' | 'combat' | 'airborne'`:
  - `'combat'` if `now - mate.combatAt < IN_COMBAT` (hand, say 5 s) or `mate.suppressed > 0`.
  - `'oob'` if `mate.oobSince != null`.
  - `'airborne'` if `mate.cls.cls === 'aerial'`.
- `squadSpawn({ squad, me, enemies, now = 0, offsets = OFFSETS, walkable = () => true })`:
  - Tries each offset from the data, turned by the mate's yaw, keeping the first that passes `walkable`.
  - `OFFSETS` comes from `squads.json`.
  - `BEHIND` goes; the first offset is 3 m behind.
  - The existing test's −1.5 becomes −3.

In `sim.js`:
- Stamp `combatAt = sim.time` on both shooter and target on every hit.
- `addPlayer(sim, { team, classId, at, yaw, id })` passes `id` through to `addSoldier`, then calls `joinSquad`. If a squad was `created`, push it into `sim.commanders?.[team]?.squads`.
- `view` adds `e.cls = s.cls?.cls ?? null` and, when given `{ player }`, `v.squad = squadRows(...)`.
- `deploy`'s squad branch takes an optional `choice.mate` and returns `{ ok: false, why: blocked(...) }`.
- `sim.js` is 511 lines, so this stays under the 800 limit.

In `battle.js`:
- Keep the player's id stable ('p1') across lives: `addSoldier(b.sim, { …, id: p.id ?? undefined })`.
- Call `joinSquad` once.
- `deploy(b, id, { classId, spawn = 'point', mate })` runs `squadSpawn` on the chosen mate and calls `earn('squadSpawn')` on that mate if `sim.bp` exists (in `battle.js` it doesn't). Otherwise it adds to the mate's `earned`.
- `view(b)` adds:
  - `out.squad` (names via `nameOf`, "You" for the local row);
  - `out.deploy.spawns = [{ kind: 'hq', name }, ...mates.map((m) => ({ kind: 'mate', id, name, cls, blocked }))]`.

**C. HUD.**
- `hud/widgets.js` gets two pure helpers:
  - `squadRows(squad, palette, { option }) → [{ id, name, local, nameColour, iconColour, icon, letter, turn, showName }]`.
  - `squadListBox(radarBox, { w, h }) → { x, y, w, h }`, using `placeWidget` and the anchor (0,1), offset (90,−46) and spacing 32 above.
- New `hud/SquadList.jsx`, `<SquadList squad={view.squad} option="Default" />`:
  - Up to 4 rows of 32 px.
  - The pin as an inline SVG path from the shape record, turned 45° with a 0.5 s CSS transition when there is an order.
  - The letter and icon crossfade as a 2 s CSS keyframe.
  - The bar is a `linear-gradient`, solid to 40/64 then transparent, with `backdrop-filter`.
  - Class icons from `CLASS_ICON` / `iconSrc`.
- `BattlefrontHud.jsx`: render `<SquadList>` inside the `alive` block.
- `DeployScreen.jsx`: add a "spawns" strip of the HQ cell plus up to 3 mate cells, 288×112 each, showing name, class icon and the block reason. Get the reason text with `loadFamily('squad')`, or add those keys to the strings extractor.
- `module.js` `snapshot()`: pass `squad: v.squad` and `deploy.spawns`. `doDeploy(choice)` passes `{ classId, spawn, mate }`.
- CSS goes in `battlefront.css`.

**Tests to write first:**
- `ai/squad.test.js`: `joinSquad` fills a free slot; when all squads are full it displaces the last bot into a new squad and registers it; the leader stays a bot; `SQUAD_SIZE === squadsOf(rb).size`.
- `spawn.test.js`: lands at the first data offset (3 m behind); skips an unwalkable offset for the next one; `blocked` returns `'combat'` within `IN_COMBAT` of a hit, `'oob'` and `'dead'`; `squadSpawn` returns null when every mate is blocked.
- `sim.mode.test.js`: a player added with mode `'galacticAssault'` has a squad of 4; `view(sim, { player }).squad.members` has the local row first and 3 mates with `cls`; `deploy(sim, p, { kind: 'class', id, spawn: 'squad' })` lands behind a mate and the mate's balance goes up by 25.
- `components/battlefront/battle.test.js`: the view's `squad` names are "You" and "Trooper N"; `deploy` with `spawn: 'squad'` works, and gives `why: 'combat'` for a mate just hit.
- `hud/widgets.test.js`: `squadRows` gives dead → `rgb(120 130 135)`, alive → `rgb(242 174 10)`, icon → `rgb(94 65 1)`; NoOutline sets `showName` false; Off gives []; `squadListBox` sits to the right of the radar.
- `hud/parts.test.jsx`: `SquadList` renders 1 + 3 rows, a dead mate gets `data-dead`, and the deploy screen lists the HQ plus mate cells with "IN COMBAT".
- An extractor test for `squadsRow` on the fixtures: `size` 4 with `size_source` "Gameplay/GameModes/Shared/SpawnManager_Shared_MP#TacticalSpawnManagerEntityData.MaxPlayersPerSquad", and 12 offsets.

Then run: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## (4) Risks and what could not be found

- **The page doesn't run lane 2's mode.** `battle.js` creates the sim without `mode: 'galacticAssault'`, so `sim.deploying`, `sim.bp` and `sim.commanders` are missing on the page. Squad spawn has to be done in `battle.deploy` as well, or `battle.js` moves to the mode (a bigger change that touches lane 2's deploy path). Without the mode there is no commander, so squad order letters will be null on the page.
- **Squad numbers on the page don't match the game.** The page has 8 bots a side; the game has 20 a side in 5 squads. The `joinSquad` displacement rule is my design, not the game's; the game's party and auto-partner logic (`AutoPartner`, `TacticalGroupManager`) is native code.
- **Some hashes are unresolved:** 0xf96e5759 (the second "grey" flag, maybe man-down), 0x23f0993d, 0x1c1a3bdd, 0xde417c4a, 0x9e24da3a. "Party" means friends in a real party; offline every mate shows orange, palette 42.
- **Values not in the data (hand):** how long "in combat" lasts; the squad-spawn BP (25); the squad-proximity bonus; the stay-with-your-squad recharge bonus.
- **Interpretations to check:**
  - That the position table's x is right and y is ahead of the mate is my reading.
  - The squad list's exact x (378) depends on how the stacking container sizes the 256×256 element references.
  - The `MaxWaitTime` hub has two feeds into the same input.
- **`ui.json` lacks** the list's `CellSize` / `MaxRows`, the palette picks and the interface wiring, which is why the extractor in A is needed.
- **Other findings** for lanes 1 and 2: `SpawnSafeEnemyDistance` 50 against `SAFE` 30, and `KillAssistTimeout` 5 against `ASSIST_WINDOW` 8.

Everything fetched is under `/home/user/new-portfolio-website/lab/assets/bf2017/data/` and `/home/user/new-portfolio-website/lab/assets/bf2017/web/strings/`.
