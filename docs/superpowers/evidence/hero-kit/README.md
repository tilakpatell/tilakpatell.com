# The game's blaster heroes, row by row: what a hero's kit and its star cards are made of

Read on 2026-10-13 by a read-only agent for the design `docs/superpowers/specs/2026-10-13-gpu-site-and-guest-heroes-design.md` (lanes B4 and B5, and the guests' table). Nothing here was read from the running game or from a new decompile: the site's rulebooks (`src/data/bf2017/`, generated from the export) and the export's own records under `C:\Users\tilak\Downloads\BF2_Extract\web\data\Gameplay\` (cited as `X <path>#<Type>.<Field>`). "n/k" means the site's row has no such key. `PC` is the channel list `["PublicChannels:26cadeec-e42f-4058-b6cc-525e503e566c"]`.

## 1. The sixteen heroes (`heroes.json` `rows[id]`)

| id | side | health | regen delay / rate | abilities left, middle, right |
| --- | --- | --- | --- | --- |
| luke | light | 750 | 2.7 / 100 | Ability_Luke_ForcePush, Ability_Luke_ForceRepulse, Ability_Luke_Dash |
| leia | light | 650 | not in the row (export: `X Kits/Hero/Leia/Affector_LeiaHealthRegen#RankData` rate 50, delay 4.5, cap 225 / 250 / 275 / 300) | Ability_Leia_ThermalDetonator_Fake, Ability_BlasterRifle_E11_Leia, Ability_Leia_BubbleShield |
| hansolo | light | 650 | 5 / 50 | Ability_HanSolo_DemolitionGrenade, Ability_HanSolo_Sharpshooterz, Ability_HanSolo_ShoulderCharges |
| chewbacca | light | 700 | 5 / 50 | Ability_Chewbacca_GrenadeStun, Ability_Weapon_FuriousBowcaster, Ability_Chewbacca_Leap |
| lando | light | 650 | 5 / 50 | Ability_GrenadeSmoke_Lando, Ability_Lando_SharpShot, Ability_Lando_Disruptor |
| yoda | light | 700 | 5 / 50 | (saber) |
| obiwan | light | 750 | 4.5 / 50 | (saber) |
| anakin | light | 800 | 4.5 / 50 | (saber) |
| bobafett | dark | 600 | 5 / 50 | Ability_BobaFett_Concussion_Rocket, Ability_BobaFett_Ping, Ability_BobaFett_RocketBarrage |
| bossk | dark | 600 | 5 / 25 | Ability_Bossk_GrenadeDioxis, Ability_Bossk_PredatorInstincts, Ability_Bossk_ExplosiveTraps_New |
| darthvader | dark | 800 (armour 850 / 875 / 900 / 950) | 5 / 50 | (saber) |
| emperor | dark | 700 | 5 / 75 | (lightning) |
| maul | dark | 700 | 5 / 50 | (saber) |
| iden | dark | 650 | 5 / 50 | Ability_Iden_Droid_Stun, Ability_Iden_Pulse_Cannon, Ability_Iden_Droid_Shield |
| grievous | dark | 800 | 5 / 50 | (saber) |
| dooku | dark | 750 | 5 / 50 | (saber) |

The sequel era is refused (`NOTES.md:241`): Kylo, Rey, Finn, Phasma, BB-8, BB-9E. Every hero costs 4,000 battle points (`points.json` `cost.heroes`, default 4,000; `battlePoints.js:30` gives an unlisted id the default).

## 2. The seven blaster heroes' abilities

Columns: the `abilities.json` row (kind, activation, active, recharge, cost), the name and text from `collection.json` `abilities['hero.slot']`, then the numbers that define the effect, which are **not** in the site's row and come from the export.

| ability | kind | activation / active / recharge / cost | what it does | effect numbers (export) |
| --- | --- | --- | --- | --- |
| hansolo.left DETONITE CHARGE | weapon | 0.4 / n/k / 18 / n/k | a sticky charge, detonated at will | `X Kits/Hero/HanSolo/HanSolo_DetonateGrenade_Projectile#ExplosionEntityData` damage 200, inner 5, radius 10, impulse 5,000; gravity −14, attachable |
| hansolo.middle SHARPSHOOTER | weapon | 0 / until overheat / 15 / n/k | the DL-44 fired rapidly for a few seconds | `X Equipment/Heroes/DL44/WeaponFiring_DL44_Sharpshooter_HanSolo` 350 rounds a minute, automatic; bolt 65 to 40 over 15 to 35 m; its life is heat: 0.08 a bullet, 0.04 a second, drop delay 0.7 |
| hansolo.right SHOULDER CHARGE | state | 0.5 / 0 / 10 / 1 | a charge forward, knocking over the first enemy hit | reach 1 m; 200 to a trooper, 150 to a hero; pushed 3 m for 3 s; damage taken × 0.75 / 0.7 / 0.65 / 0.6 by card rank |
| leia.left THERMAL DETONATORS | state | 0 / 10,000 / 13 / 1 | up to three thrown; recharges when all are thrown | damage 250, inner 2.5, radius 7, impulse 1,500; gravity −9.8, lives 7 s |
| leia.middle RAPID FIRE | weapon | 0 / until overheat / 15 / n/k | her blaster swapped for an E-11 | 650 rounds a minute; 36 to 19 over 20 to 40 m; heat 0.009 a bullet; damage taken × 0.9 / 0.85 / 0.8 / 0.75. The record's 10 to 13 by rank is not the state's timer: the active time is flagged infinite, and the code then takes the duration as zero whatever value is bound (section 7); what the 10 to 13 feed was not traced |
| leia.right SQUAD SHIELD | weapon | 0.5 / 0.3 / 20 / n/k | a shield at her place; those inside are shielded from blasters and heal | shield health 3,000; heal 5 every 0.5 s; radius 4; the shield stands 30 s on its own clock, started 1 s after it is placed (a graph value) |
| lando.left SMOKE GRENADE | weapon | 0.4 / 0 / 14 / n/k | smoke that hides enemies from all but his scope | radius 10; hides within 6 m (a graph value over the field's 5) and blocks spotting within 8 m; no damage; lasts 7 s from its first bounce (a graph delay; 7 + 2 / 3 / 4 / 6 with card 1) |
| lando.middle SHARP SHOT | active | 0 / 7 / 12 / n/k | marks up to five enemies, then a flurry at each | range 40 m; the mark lasts 6 s; one shot of 200 at each marked enemy, 0.15 s apart; fires on a second press after 1 s, or when the 7 s run out |
| lando.right DISABLER | active | 0.4 / 25 (33 to 40 by rank; 40 read in the running game with the top card worn) / 19 / n/k | a sticky device that reveals and jams; overcharged at will to shock | radius 12 (18 by modifier); shock 1.1 s, radar jam 2 s, reveal 2 s; no damage |
| chewbacca.left SHOCK GRENADE | weapon | 0.4 / 1 / 15 / n/k | a grenade that splits into shocking missiles | splits into six; each shocks 0.75 s within 3 m (its blast radius is 1.5); no damage; a target cannot be shocked again for 3.5 s (graph values) |
| chewbacca.middle FURIOUS BOWCASTER | weapon | 0 / until overheat / 20 / n/k | full-charge shots with no charge time | 90 rounds a minute; 40 to 35 over 30 to 50 m plus a blast of 25 within 1.5 m; heat 0.075 a bullet |
| chewbacca.right CHARGE SLAM | state | 1 / 0 / 15 / 1 | a charge, then a slam | 200 to a trooper, 150 to a hero; radii 4 and 5; damage taken × 0.5 / 0.4 / 0.3 / 0.2 |
| bobafett.left CONCUSSION ROCKET | weapon | 0.7 / 0 / 15 / n/k | dazes those in the blast and disables their blaster 1.2 s | radius 5, query 18; flash 3 s (distance 18, angle 90); disruption 1.2 s; no damage |
| bobafett.middle FOR THE HUNT | active | 0.5 / 8 / 10 / n/k | reveals enemies around him to his team; he leaves their radars; unlimited jetpack | range 30 m; while it is active the jetpack's fuel does not regenerate and its reading is held up, so it does not run dry (a graph rule) |
| bobafett.right ROCKET BARRAGE | weapon | 0.5 / 1.3 / 20 / n/k | a hail of small rockets | 10 rockets at 300 a minute; each 75, inner 1.5, radius 3 |
| bossk.left DIOXIS GRENADE | weapon | 0.4 / 0 / 20 / n/k | a cloud that damages those inside | radius 10 (query 9); 15 at once, then 5 a second on a 0.5 s tick; the cloud stays 6 s after it bursts (a graph delay; 6 + 2 / 3 / 4 / 6 with card 2). The record's 10 s is the grenade's flight fuse, not the cloud |
| bossk.middle PREDATOR INSTINCTS | weapon | 1.1 / until overheat / 25 / n/k | micro-grenades, thermal vision, more strength | 90 rounds a minute, single; each 80, inner 1, radius 3; heat 0.055 a bullet; damage taken × 0.9 / 0.87 / 0.84 / 0.8 |
| bossk.right PROXIMITY MINES | active | 0.6 / 0.1 / 20 / n/k | three sticky mines | each 76, inner 5, radius 6, impulse 5,000; trigger 0.2 m |
| iden.left STUN DROID | active | 10 / 1.8 / 20 / n/k | her droid stuns a target ahead; the stun chains | 40 damage; shock 0.9 s; chain radius 5 |
| iden.middle PULSE CANNON | weapon | 0 / n/k / 1 / n/k | a long rifle, charged while scoped | 100 a minute, hold and release (4 s to full, 1.7 a second); 30 to 50 over 30 to 50 m plus 20 within 1.5 m |
| iden.right DROID SHIELD | active | 0 / 12 (16 to 22 by rank) / 10 / n/k | a shield round her against blasters | shield health 250 |

`abilities.json`'s `weapon` key is not a usable join for the ability weapons: only `hansolo`, `leia` and `chewbacca` match a `weapons.json` row, and those are the primaries. The ability weapons' numbers live only in the export, as cited.

## 3. Primaries (`weapons.json` `rows[id]`; every row: one bullet a shot, range 200)

| id (hero) | rounds a minute, mode | damage over distance | heat a bullet / drop a second / drop delay / threshold / penalty |
| --- | --- | --- | --- |
| hansolo (DL-44) | 175, single | 80 to 55 over 20 to 50 m | 0.13 / 0.75 / 0.5 / 0.8 / 3 |
| leia (Defender) | 700, bursts of 2 at 200 | 40 to 20 over 20 to 40 | 0.03 / 0.8 / 2.5 / 0.8 / 3 |
| x8nightsniper (Lando) | 400, single | 40 to 25 over 20 to 50 | 0.07 / 1 / 0.6 / 0.8 / 3 |
| chewbacca (bowcaster) | 60, automatic | 40 to 35 over 30 to 50 | n/k / 0.2 / n/k / 0.8 / 2 |
| boba (EE-3) | 800, bursts of 3 at 120 | 35 to 25 over 20 to 40 | the row's heat is empty (export: 0.037 a bullet, drop 1, delay 0.7) |
| v10 (Bossk's Relby) | 100, hold and release | 55 to 35 over 50 to 100 | 0.14 / 0.7 / 1 / 0.8 / 3; zoom to 55° |
| iden (TL-50) | 700, automatic | 20 to 10 over 30 to 50 | 0.02 / 1.5 / 3 / 0.8 / 3 |
| s5 (officer) | 140, single | 67 to 45 over 15 to 50 | 0.1 / 0.3 / 1.5 / 0.8 / 3 |
| se44c, blurrg1120, dl18mod, rk3 | 300 automatic; 400 bursts of 2; 300 single; 300 single | 31 to 15; 30 to 12; 41 to 15; 34 to 17 | 0.06; 0.05; 0.04; 0.05 a bullet |

The troopers' own DL-44 is not a site row (export: 250 single, 45 to 15 over 10 to 30 m, heat 0.09).

## 4. Class abilities a kit can reuse (`trooperKit.json`, `grenades.js`)

- **Blaster turret** (officer): activation 0.4, recharge 25; the turret fires bursts of 5 at 340 a minute, 25 to 15 over 10 to 30 m, locks in 1 s within 5° out to 60 m, health 250.
- **Battle command** (officer): active 1, recharge 40; radius 13, overhealth 100 for 4 s.
- **Flash (splitter) grenade** (officer): recharge 35; five splits; flashed within 10 m and 90° for 5 s.
- **Thermal detonator** (assault): recharge 35; damage 200, inner 2, radius 6.
- **Shock grenade** (specialist): recharge 35; 30 damage, radius 5; a field of radius 2 for 3.7 s at 10 a second.
- **Impact grenade** (heavy): recharge 40; 120 damage, radius 5.

## 5. Star cards

Every hero has nine (`collection.json` `cards`), each with four levels; three are worn at once (`collection.js:28`, `CARD_SLOTS = 3`); the picks are kept under `bf-collection` as `{ [hero id]: { skin, pose, cards: [ids], emotes, voiceLines } }`. No level is stored or chosen anywhere; the game design rules the top rank, which is `levels[3]`. Nothing in the sim reads a card (`NOTES.md:182`).

Han's, Lando's, Leia's and Bossk's, as `name: text [levels]`:

- **hansolo** 1 HEAVILY MODIFIED BLASTER: the DL-44 has {0} % less overheat build-up [10, 14, 18, 25]. 2 SHARPSHOOTING FRENZY: each defeat while Sharpshooter is active extends it by {0} % [25, 30, 35, 40]. 3 ALL IN: each defeat with Shoulder Charge cuts its recharge by {0} % [20, 30, 40, 50]. 4 BROAD SHOULDERS: {0} % less damage while using Shoulder Charge [25, 30, 35, 40]. 5 SHARPSHOOTER'S CALM: Sharpshooter shots cost {0} % less active time [10, 15, 20, 25]. 6 KEEP YOUR HEAD COOL: each headshot kill disables overheat for {0} s [1, 1.5, 2, 2.5]. 7 AIR BURST: a Detonite Charge detonated in the air deals {0} % more [10, 13, 16, 20]. 8 BIG BANG: its blast is {0} % larger after five seconds attached [10, 15, 20, 25]. 9 SMUGGLER'S WITS: an extra dodge, and every cooldown {0} s longer [3.5, 3, 2.5, 2].
- **lando** 1 LINGERING SMOKE: +{0} s [2, 3, 4, 6]. 2 WELCOME TO CLOUD CITY: a {0} % larger cloud [15, 20, 25, 30]. 3 DISABLER LIFETIME: +{0} s [8, 10, 12, 15]. 4 DISABLER GROWTH: {0} % wider in the first five seconds [15, 20, 25, 30]. 5 QUICK SHOCK: shocks {0} % longer if detonated within five seconds [15, 20, 25, 30]. 6 WIDE EYED: Sharp Shot reaches {0} % farther [25, 30, 35, 40]. 7 MAXIMIZED EFFICIENCY: three or more hits make the next recharge {0} % shorter [25, 30, 35, 40]. 8 BUCKLE UP, BABY: each defeat cuts the X-8's heat a shot by 2 % up to {0} %, lost on defeat [10, 18, 26, 34]. 9 HOT AND COLD: +{0} maximum health [50, 75, 100, 150].
- **leia** 1 OPTIMIZED SHIELD DEPLOYMENT: Squad Shield recharges {0} % sooner [10, 15, 20, 30] (the card's text; the ability's own record sets the recharge to 18 / 17 / 16 / 15 of 20, so the top rank gives 25 %, and the record is what the game runs). 2 SHIELD DURABILITY: +{0} % shield health [10, 15, 20, 25]. 3 HIGH SPIRIT: regenerates {0} more health [25, 50, 75, 100]. 4 FEARLESS: detonators' blast +{0} m [0.25, 0.5, 0.75, 1]. 5 HANDY DEVICE: their cooldown −{0} s [0.5, 1, 1.25, 1.5]. 6 REBEL HEART: {0} % less damage with the E-11 [10, 15, 20, 25]. 7 RELENTLESS FIRING: Rapid Fire's time lost a shot −{0} % [25, 35, 45, 55]. 8 STAY TOGETHER: within 15 m of two allies, all three take {0} % less [4, 6, 8, 10]. 9 LASER BRAIN: the Defender's alternate fire +{0} damage [20, 25, 30, 35].
- **bossk** 1 SPREADING THE DISEASE: a {0} % larger cloud [10, 13, 16, 20]. 2 LINGERING DIOXIS: +{0} s [2, 3, 4, 6]. 3 TRAP ARMING SPEED: {0} % faster [30, 40, 50, 60]. 4 MULTI-TRAPS: two more mines, {0} % wider (export: radius 6.6 / 6.9 / 7.2 / 7.5) [10, 15, 20, 25]. 5 NAME YOUR POISON: heals {0} a second in his own cloud [15, 20, 25, 30]. 6 UNRELENTING PREDATOR: each defeat during Predator Instincts shortens his other recharges by {0} % [5, 8, 11, 14]. 7 SNIPER EXPERT: a headshot disables the Relby's overheat for {0} s [1, 1.5, 2, 2.5]. 8 ULTIMATE PREDATOR: each kill extends it by {0} % [15, 20, 25, 30]. 9 PREDATOR RESILIENCE: {0} % less damage during it [10, 13, 16, 20].

The thirteen kinds of effect across all sixteen heroes' cards, with one example each:

| kind | example |
| --- | --- |
| T1 an ability recharges sooner | leia.1 [10, 15, 20, 30] %; leia.5 by seconds |
| T2 recharge given back on a kill or a hit count | hansolo.3; lando.7; bossk.6 |
| T3 an ability lasts longer, in seconds | lando.3 [8, 10, 12, 15]; bossk.2 |
| T4 its time extended a kill, or drained less a shot | bossk.8; hansolo.2; hansolo.5; leia.7 |
| T5 a larger radius, area or range | lando.2; leia.4 in metres; lando.6 |
| T6 more ability damage, flat or on a condition | hansolo.7; leia.9 |
| T7 less damage taken while an ability is active | hansolo.4 [25, 30, 35, 40] %; leia.6; bossk.9 |
| T8 less damage taken always, or on a condition | leia.8 |
| T9 more maximum health, more regeneration, a self-heal | lando.9 +[50, 75, 100, 150]; leia.3; bossk.5 |
| T10 the primary's heat | hansolo.1 [10, 14, 18, 25] % less; hansolo.6 and bossk.7 |
| T11 stacks that are lost on defeat | lando.8 |
| T12 an extra charge or count, with a stated penalty | hansolo.9; bossk.4 |
| T13 an enemy made weaker, revealed or held longer | lando.5 |

**How the game applies a card** (this paragraph is from the records; what the code and the running game add is in section 7): a card is its own `PassivePlayerAbilityAsset` in the kit's `PlayerAbilityCustomization.AdditionalAbilities`, with an unlock and a list of modifiers of four kinds. A `PlayerAbilityPropertyOutputModifier` sets a named float the ability's prefab reads, one value a level (`StarCard_HanSolo_1_LessOverheat`: 0.9 / 0.86 / 0.82 / 0.75, the card's 10 to 25 %). A `PlayerAbilityPropertyModifier` on the ability itself, gated by the card's unlock id, replaces a timer (`Ability_HanSolo_Sharpshooterz`: recharge 18.5 / 18 / 17.5 / 17 under card 9). A damage-taken card is a rank on an affector the ability's prefab applies (`Affector_HanSolo_SharpshooterDMGReduction1`: 0.75 / 0.7 / 0.65 / 0.6). A card that needs another round swaps the projectile's blueprint (Bossk's wider mines).

## 6. The site's Wardrobe, which a guest's look comes from

The owner, 2026-10-13: a guest wears "whatever the user chooses for skin in the character designer (we have one already)". That designer is the **Wardrobe** (`src/components/rickmorty/wardrobe/`), a dialog opened from the universe page's hangar, the C-137 world and the Citadel.

- It covers `CASTS = { rickmorty: ['rick', 'morty'], breakingbad: ['walt', 'jesse'] }` (`looks.js:25`). Bodies: Rick 12, Morty 3 (morty, evilmorty, copmorty), Walt 3 (walt, mrwhite, heisenberg, one file), Jesse 2.
- A look is `{ body, colors: { outer, inner, legs, hair, shoes: swatch id }, gear: { head, face, hand } }`, kept under `localStorage['tp-wardrobe']` as `{ rick, morty, walt, jesse }` and read by `readLook(who, raw)` (`looks.js:186`) or, outside React, `lookFor(who, looks)` (`universe/footFigures.js:158`).
- It is put on by one call, `dress(figure, look)` (`wardrobe/wearNodes.js` on the node renderer). The recolour is in the shader: vertices carry a zone from their strongest skin bone's **name** (`dressCore.js:38`, `addZones(geometry, boneNames)`), and a texel inside a region's zones and colour window is mixed to the swatch. Gear is built in code and parented to the bones `Head` (its frame from `head_end` and `headfront`) and `RightHand` (its frame from `RightForeArm`), with offsets a body in `gear.js`'s `FIT`. Hand gear becomes the gun held: `HAND_GUNS = { portalgun: 'portal', laserpistol: 'laser' }`.
- The galaxy's surfaces already dress the party through `figuresWith({ bodyAsset, bodyKind, dress })` (`galaxy/surface/nodes/figures.js:11`). `galaxy/heroes.js:90` already holds rows for all four (weapons portal, laser, revolver, pistol; abilities hop / overcharge, sprint / medpack, fulminate / overcharge, sprint / overcharge). Nothing under `components/battlefront`, `lib/battlefront` or `lib/bf2017` names any of them.
- The Battlefront Collection is a second, separate store (`bf-collection`): a skin there is a whole other body file, and it has cards, poses and emotes but no colours or gear. The wardrobe has colours and gear but no cards.
- The Wardrobe's figures wear a toon paint and a rim light, and no outline, on the galaxy's worlds today; the inverted-hull outline (`lib/three/ink.js`) is drawn only in the cruiser.

## 7. What the game's code and the running game add (2026-10-13)

Sections 2 to 5 are from the exported records. This section is from two other sources, and each line says which: **CODE** is the game's decompiled code (the named Ghidra image; pseudocode under `D:\bf2-ghidra\abil63\out\core\`), **LIVE** is a read-only read of the running game's memory in an offline round (`D:\bf2-ghidra\abil63\live\reads.md`, with every address and raw value). Neither folder is in this repository.

**An ability is one state and one timer.**

- CODE + LIVE. The state is one of six: 0 Disabled, 1 Recharge, 2 Blocked, 3 Ready, 4 Activating, 5 Active. The previous state is kept beside it.
- CODE. The timer is the seconds left in the current state. One function ticks it (`145b68520`), one changes the state (`145b67a10`), one sets the timer (`145b68fd0`). The durations come from the ability's asset: ActivationTime, ActiveTime, RechargeTime, each with an "infinite" flag.
- CODE + LIVE. The timer counts down and is loaded afresh at each change of state. The recharge begins at the full RechargeTime when Active ends, not when the ability is pressed. Watched for ten minutes at 20 samples a second while Lando's abilities were pressed (`poll-server.txt`):
  - Sharp Shot (0 / 7 / 12): Ready to Active at once (a zero ActivationTime skips Activating), Active for 7.03 s, Recharge for 11.98 s, Ready. Five cycles, each within 0.1 s of 7 and 12.
  - Smoke Grenade (0.4 / 0 / 14): Activating for 0.44 s, then straight to Recharge for 13.97 s (a zero ActiveTime gives Active no length). Six cycles.
  - Disabler (0.4 / 25 / 19): Activating 0.41 s, Active 24.93 s, Recharge 19.05 s. Pressed again 4.6 s into Active (the detonation), Active ended at once and the full 19 s recharge began; the unused 20 s of Active were not given back.
- LIVE. A press that cannot act is held for half a second: a second timer is set to 0.5 s and runs down (the smoke and the Disabler pressed during Sharp Shot's Active, the Disabler pressed while recharging).
- CODE. Six events force a state from outside (GotoDisabled, GotoRecharge, GotoBlocked, GotoReady, GotoActivating, GotoActive), and two are sent out (OnActiveTimeFinished, OnDeactivated).
- CODE. A card's value object replaces a duration outright; it does not scale it. This agrees with the records' `PlayerAbilityPropertyModifier` in section 5 (Sharpshooter's recharge 18.5 / 18 / 17.5 / 17 under a card). A value is chosen by level: the first whose MinAbilityLevel to MaxAbilityLevel holds the ability's level, counted from zero. LIVE, with Lando's DISABLER LIFETIME worn at its top rank (+15 s): the asset's ActiveTime still read 25, a value object holding 40 was bound to the ability, and the Active timer started at 39.97. So the card's value replaced the duration, and the card itself sat in the set as one more passive ability (slot 12). One throw was seen; the round ended before a second.
- CODE. With an "infinite" flag set the duration is zero and the tick idles, whatever value is bound: such an ability ends by something else (a weapon's overheat, a second press).
- CODE. A character-state ability (the dodge, Han's Shoulder Charge, Chewbacca's Charge Slam, Leia's detonators) pays a TriggerCost out of a bar that refills over its RechargeTime while it is not active; that is the dodge's charge.
- CODE + LIVE. An ability names the abilities it blocks, and blocks them while it is Activating or Active as its two flags say; a blocked ability's press goes back to Ready and leaves the half-second held press.
- CODE. Recharge speed is divided by a product of multipliers; and one event cuts the running timer by a fraction of the full duration, which is how a card that gives recharge back on hits (Lando's 7) works.
- CODE. Damage-multiplier affectors on one soldier combine as a product, each taking its rank's value with the rank held inside the list.

**The durations in the records are the ones the game runs on.** LIVE, on Lando in a round, the three assets held Sharp Shot 0 / 7 / 12 s, Smoke Grenade 0.4 / 0 / 14 s and Disabler 0.4 / 25 / 19 s (activation / active / recharge), the same as his rows in section 2. No number in this file moves.

**A soldier carries eighteen ability slots, and more things are abilities than the three on the HUD.** LIVE, Lando's slots:

| slot | what | the game's class | activation / active / recharge |
| --- | --- | --- | --- |
| 0, 6 | passives | `PassivePlayerAbility` | none |
| 1 | the primary weapon | `SoldierWeaponPlayerAbility` | infinite active; always Active |
| 2 | Sharp Shot (the middle ability) | `RetriggerablePlayerAbility` | 0 / 7 / 12 |
| 3 | Smoke Grenade (left) | `InactiveSoldierWeaponPlayerAbility` | 0.4 / 0 / 14 |
| 4 | Disabler (right) | `DemolitionChargePlayerAbility` | 0.4 / 25 / 19 |
| 5 | the dodge roll | `CharacterStatePlayerAbility` | 0 / 0.4 / 2.2 |
| 7, 8 | two more character-state abilities, not identified | `CharacterStatePlayerAbility` | 0.4 / 0 / 0 and 1 / 0.1 / 0 |
| 9 | not identified | `BasicPlayerAbility` | 0 / 0 / 0 |
| 10 | the emote | `EmoteCharacterStatePlayerAbility` | 0.3 / 0 / 1 |
| 11 | the voice line | `VoiceLinePlayerAbility` | 0.3 / 5 / 0 |

So the slot order is middle, left, right (2, 3, 4), not the order of the Category enum; and the primary weapon and the dodge run on the same state and timer as the three abilities. For the site: one state machine serves all of them.

**The dodge is not read like the other three.** LIVE, two rolls: it rests in Recharge with a timer of zero and never shows Ready; a roll takes it to Active with the timer counting up to 0.4, and 1.26 s after the press it is back in Recharge with 1.1 s on the timer (half of its 2.2), counting down. So a character-state ability's readiness is a charge, not the Ready state, and each of the two rolls costs half the recharge. How the charges are counted was not read; the site's dodge keeps two charges that each come back in 1.1 s until a read says otherwise.

**The server's copy is the one that counts.** LIVE: in an offline round the server runs in the same process, and each ability's state lives twice, once in the server's ability-set component (the eighteen states in a row) and once in the client's ability object. CODE: the three functions above write the server's copy. The site has no such split and needs none; it matters only for where the next read looks.

**Every ability carried a level of 3 and a mask of 0x1F in this round, with no card worn.** LIVE. CODE: levels count from zero, so 3 is the fourth and last (`PlayerAbilityLevel_4`), which agrees with section 5's rule that the top rank is `levels[3]`.

**Also read LIVE, for the render lanes:** `SunShadowmapLevel` is 3 at the game's Ultra preset (`WorldRenderSettings` +0x40), with `ShadowmapResolution` 2048, `ShadowmapSliceCount` 5, `ShadowmapViewDistance` 100 and `DistantShadowCacheResolution` 6400 in the same object. The level's own visual environment can lay a shorter distance over the settings' 100 (its record says 70 for Hoth); which of the two the frame used was not read.
