# One arsenal and the Hangar: the same guns, HUD and progression in every universe the ship flies through: design

Date: 2026-10-18. Status: written from the owner's request by a
brainstorming session (Opus 5.5), which then builds it. The owner said to
skip the rest of the questions and go, so every decision below is the
session's call unless it is marked as the owner's; the owner can overturn
any of them. Built as seven pull requests, in the order of Part 9; each
has a plan under `docs/superpowers/plans/` when it starts.

## Intent

What the owner said:

> make it so the weapons system is standardized for gui and weapons and
> stuff between all the universes with the ship (ie Star Wars Galaxy and
> Main Universe and Rick and Morty). Make unique weapons and maybe even a
> skill tree progression system throughout the entire site. Like where we
> have a character menu (with customization like we have for rick and
> morty) and also a skill tree and power and shipyard stuff all in one
> space.

Asked what feels most broken when you jump between the three: “The GUI is
off and the weapons and stuff are different. There also differences in
characters which isn't really addressed on how it works and how we get
better weapons and stuff.”

On the skill tree: “It should be difficult to get all skills but possible
and they should have freedom to unlock what they want.”

On scope: “Battlefront is different so ignore battlefront” and “we are
working on reverse engineering that specifically for star wars world”.

### What exists today (the recon, 2026-10-18, `origin/main` at `ba818787`)

- **Ships.** Four crews and ships (`universe/crews.js`): Rick's cruiser,
  the X-wing, the Falcon and the RV. The universe map and the galaxy fly
  the same flight model (`universe/ship.js`) and keep the same pick
  (`tp-universe-ship`). Rick and Morty's C-137 street flies its own
  cruiser (`rickmorty/world/rules.js`'s `stepCruiser`) and starts fresh
  every time.
- **Ship guns.** The universe map fires three lines (`universe/weapons.js`,
  `weaponTable.js`: primary, secondary, ordnance; F fires, R and 1 2 3
  switch). The galaxy fires the primary only and has the crews' powers
  on G and X instead (`universe/shipPowers.js`, played by
  `galaxy/powers.js`). The powers are written for any ship but are not
  wired into the universe map. The shipyard's own hint in the galaxy says
  the secondary and ordnance “fire on the universe map only”.
- **Guns in the hand.** Four tables: `universe/gunplay.js` (the gun
  models and the universe's foot scene), `galaxy/surface/weaponRules.js`
  (19 guns with heat and mods), `lib/battlefront/weapons.js` (Battlefront:
  out of scope) and `deathstar/inside/rules/combat.js`. Rick and Morty's
  street shoots `lib/combat/bolt.js` bolts with its own ranges and hearts.
- **Health.** Shields are 0–100 in flight, and the player has 100 health
  on foot in the universe (`foot.js`) and on the galaxy's worlds
  (`surface/scene.js`). Enemies and guns are counted in hits in both: a
  stormtrooper has 2, the universe's troops 1–6. A saber hero is weighed
  on the 2017 game's 750 (the reverse-engineering lane's). Rick and
  Morty's duels use hearts (3 and 6).
- **HUDs.** The universe map draws its own (`UniverseMap.jsx`, dark glass
  and amber), the galaxy its own (`FlightCluster.jsx` and friends), Rick
  and Morty an inked toon one (`RmHud.jsx`), and the Citadel borrows
  Middle-earth's. The kit (`src/runtime/hud/`) exists, but the flight
  HUDs take only `Reticle`, `Prompt`, `Film` and `GameIcon` from it.
- **Progression.** One wallet for the site (`universe/economy.js`,
  `tp-pilot` v2): credits, xp and eleven levels, Rookie to Legend. The
  universe map and the galaxy pay into it. Rick and Morty and Battlefront
  don't. The shipyard (`universe/shipyard/`) spends it. The galaxy's
  perks (`galaxy/perks.js`) are picked freely and nothing is earned.
  There is no skill tree.
- **Characters.** The Wardrobe (`rickmorty/wardrobe/`, `tp-wardrobe`)
  dresses Rick, Morty, Walt and Jesse wherever they appear, and opens
  from the shipyard's Crew button. Luke, Artoo, Han and Chewie can't be
  dressed. The galaxy's worlds pick a hero, an outfit, a blade and a gun
  on their own panel (`tp-galaxy-hero`).

Done looks like this. Whichever universe you're in, the ship you fly has
the same three guns and the same two powers, on the same keys, read off
the same HUD in the same places. Only the world's colours and type
differ. One overlay, the **Hangar**, holds your crew (dressed as the
Wardrobe dresses Rick today, for every crew), your arms, your powers, your
skill tree and the shipyard. Everything you do across the site (flights,
fights, quests, achievements, in every world) earns xp and achievements.
Those become skill points, which you spend anywhere on the tree you like.
Filling the whole tree takes most of what the site has to do, and it can
be done. Deep in the tree are weapons no one else has: one or two from
each universe, each with a trick of its own.

## Goals

1. **The same arsenal on every ship, everywhere it flies.** Three lines
   (primary, secondary, ordnance) and two powers (G, X) on the universe
   map, in the galaxy and, once Rick and Morty comes aboard (Part 7), on
   the C-137 cruiser.
2. **One flight HUD.** The same kit parts for shields, arms and powers,
   in the same places, with the same keys. Each world keeps its face
   through its own classes over the kit's, as `RULES.md` already says.
3. **The Hangar.** One overlay with five tabs: Crew, Arms, Powers, Skills,
   Shipyard. It opens over every page a ship flies from.
4. **A skill tree for the whole site.** Points come from xp and from
   achievements in every world. The tree has four branches you can take in
   any order. The whole tree costs a little less than every point the site
   can give, so it can be finished but never by accident.
5. **Unique weapons.** Four for the ship and four for the hand, each from
   a universe, each doing something no other weapon does. Each is unlocked
   deep in the tree.
6. **Rick and Morty aboard.** Its worlds pay into the wallet and the tree,
   the Hangar opens there, and the cruiser wears what the shipyard fitted.
7. **One table for guns in the hand, on one health scale**, across the
   universe's foot scene, the galaxy's worlds (outside the
   reverse-engineering lane's pieces) and Rick and Morty.

## Non-goals

- **Battlefront** (`/battlefront`, `src/lib/battlefront/`, `src/lib/bf2017/`,
  `src/components/battlefront/`, `bf-collection`). None of it changes, and
  none of this appears there. Its heroes, star cards, Battle Points and
  collection stay its own.
- **The reverse-engineering lane's pieces of the Star Wars world.** On
  the galaxy's worlds, the 2017 heroes' bodies, rigs, clips, kits
  (`abilityRules.js`, `heroKit`), saber mechanics (`lib/combat/saber2017.js`)
  and the game's UI canvas stay as they are. This design touches the
  galaxy's worlds only at three seams that already exist: the perks'
  multipliers (`perkEffects`), the gun list (`weaponRules.js`) and the
  hero's saved choice (`readHero`).
- **Other pilots.** No skill, power or unique weapon changes what another
  pilot takes online. Powers already never touch other pilots
  (`shipPowers.js`). Skill bonuses to damage apply to the game's own
  ships and troops only, and the wire's caps (`protocol.js`'s `DAMAGE`,
  `DAMAGE_MAX`, codes under 16) stay.
- No server, account or real money. Everything stays local-first in this
  browser, as the wallet is.
- No new 3D models from services. The unique weapons are drawn in code
  (as `gunplay.js` and `modules3d.js` already draw guns and parts), with
  their effects from the existing bolt and impact kits.

## Anti-goals: what would make this a failure even if it works

- **The GUI still differs.** If the shields bar, weapon readout or power
  cooldowns sit in different places, or use different keys, between the
  universe map, the galaxy and Rick and Morty, it has failed, whatever
  else ships.
- **A forced path.** A tree whose order you can't choose, or a class you
  are locked into. Every branch opens from its first row, and nothing
  needs a node in another branch.
- **Unreachable or trivial.** A tree that can't be finished, or one that
  is finished by flying in circles for an evening. Section 5.2 pins both
  sides in a test.
- **Losing what someone has.** Every save keeps reading as it did: owned
  parts, looks, the hero and the wallet. A new save starts from what the
  old ones say.
- **A hub that gets in the way.** The Hangar must open and close at once
  over a frozen world, as the shipyard does now, and never reload a scene.
- **A sequel-trilogy weapon or look.** The standing rule holds: nothing
  from Episodes 7–9.

## Constraints (the house rules this lives inside)

- `docs/health/RULES.md` throughout. Layers run data → lib → lib/three →
  runtime → components → pages. Worlds are islands: what two worlds
  share moves down or goes through a world's `shared/`. Files stay under
  800 lines, with rules in tested pure files and tests beside them. World
  HUDs are built from the kit. Tokens only, the 4 px grid, one drawing per
  concept, numbers written through refs, keys written once in
  `guide/pages.js`, British spelling and no Oxford comma.
- `universe/scene.js` (6,226 lines), `universe/footScene.js` (3,299),
  `galaxy/scene.js` (2,945), `rickmorty/world/RmWorld.jsx` (2,068) and
  `universe/gunplay.js` (1,422) are already over the line or near the
  ceiling. New behaviour goes in new modules that the
  scenes call, so the scenes only grow by those calls. Never move lines
  you aren't changing.
- `boundary-breaks`, `big-files`, `hud-kit` and `kbd-styles` in
  `scripts/health.mjs` may only fall.
- Before a pull request is done: `npm run lint`, `npm test`,
  `npm run build`, `node scripts/health.mjs --check --skip build`, and
  `scripts/autopilot-check.mjs` on the routes touched, with screenshots.

---

## Part 1: One flight HUD

### 1.1 The kit gains three parts

In `src/runtime/hud/`, beside the rest, exported from `index.js`, and
taking plain values only:

- **`Vitals`**: one bar with a label (the world's word: “Shields”,
  “Deflectors”, “Health”), the number, and a low state under a quarter
  (the universe map's red blink). It is built once. The frame loop writes
  it through `writeVitals(el, value, max)` (in `hud.js`, tested), never
  through React state.
- **`Arms`**: what's in your hands or on your guns. It shows the line's
  name, three line marks with the picked one lit, and the rack below:
  ammo pips, the last one filling as a round comes back. A hand gun shows
  its heat bar in place of the rack (the galaxy's vent marker included).
  The keys sit beside it (R, 1 2 3), in the house key cap. Written
  through `writeArms(el, state)`.
- **`Powers`**: the two power slots, each with its key, short name,
  phase (ready, active, cooling, charging) and fill. This is
  `universe/PowerBar.jsx` moved into the kit with its view values handed
  in. The old path stays a re-export until its callers move.

### 1.2 One layout

On every flight HUD:

- shields bottom left
- arms bottom right
- powers above the arms
- the reticle and lock in the middle, as they are

On a phone, the kit's TouchButtons go in the same column: one 76 px fire,
and 64 px weapon and power buttons. The rows are laid out by
`layoutRows`, never summed by hand.

### 1.3 Who moves onto it

- **The universe map** (`UniverseMap.jsx`): its shield bar and its
  `universe-arms` readout become `Vitals` and `Arms`, skinned by
  `universe/hud.css`. It gains `Powers` (Part 2).
- **The galaxy's flight** (`FlightCluster.jsx`): the deflectors become
  `Vitals`, `PowerBar` becomes the kit's `Powers`, and it gains `Arms`
  (Part 2). The radar and target blocks stay the galaxy's own, as does
  its skin (`flight.css`).
- **Rick and Morty**: Part 7.

### 1.4 One set of keys

In a ship, everywhere:

| Key | Does |
| --- | --- |
| F or click | Fire |
| R / Shift+R | Next or previous line |
| 1 2 3 | Pick a line |
| G | Power |
| X | Big power |
| H | The Hangar |
| C | The Hangar, on Crew |

The keys are written once, in `guide/pages.js`'s shared rows (`fly(…)`).
The universe map and the galaxy then list the same rows, and the
galaxy's guide stops saying its secondary and ordnance are the universe
map's only.

The keys that clash today, and what happens to each (the session's
calls):

- **On foot, the keys are the foot's.** Powers are a ship's, so G and X
  stay a door or boarding and the crew swap on the universe map's foot
  scene.
- **The phone wins.** At the phone out past the belt, G still opens it
  (it's a prompt on screen), and the power waits.
- **The C-137 street's cruiser** climbs on R and sinks on F and C
  (`RmWorld.jsx`'s `FLY_KEYS`). Its rise and sink move to keys the street
  doesn't use, chosen in pull request 5's plan, so R, F and C mean what
  they mean in every other ship.
- **Rick and Morty's big planets** open the guide on H
  (`RmSurface.jsx`). It moves to the site's own guide key, and H opens
  the Hangar.

## Part 2: Every ship, every gun

### 2.1 The galaxy fires all three lines

The galaxy's scene makes a `createArmory(kind, loadout)` as the universe
map does, fires the line picked, and flies the ordnance's homing rounds.
To share the rounds rather than copy them:

- the universe map's code for a fan of shots and a homing round (making,
  steering, hitting, drawing) moves out of `universe/scene.js` into a
  module of its own (`universe/rounds.js`, drawing in
  `universe/roundsFx.js`)
- it is lent to the galaxy through `universe/shared/flying.js`
- the universe scene calls it where its code was, and its pixels don't
  change (screenshots before and after)

The rounds hit the galaxy's game ships (its hunters and its war's
battles, through the same `strike` the powers use) and never another
pilot. The shipyard's `hint` in the galaxy goes, along with the line in
the guide.

### 2.2 The universe map plays the powers

`galaxy/powers.js` already plays every crew's powers against a scene's
hunters, bolts and flashes. Its only galaxy import is `LASER` from
`galaxy/fx.js`.

- It moves to `universe/powers.js`, taking the laser's colour as an
  option, and the galaxy imports it back through `universe/shared/flying.js`.
- The universe scene makes one, with its hunters, bolts and flashes and
  no war, and calls it at the same moments the galaxy's scene does:
  press, step, gain on a kill, cancel on being shot down or jumping.
- The charge and cooldown are already kept in the session across a
  landing (`KEPT_KEY`), so they carry between the map and the galaxy.

Siege note: on the universe map, a power's hit on the Citadel's core is
cut as a battle objective's is (`sub`). Ordnance stays the only thing that
takes the core down, as `siege.js` says today.

## Part 3: The Hangar

### 3.1 What it is

One overlay, filling the page under the nav with the world frozen behind
it, exactly as the Shipyard does now (`Shipyard.jsx` is the pattern: a
portal on the body, a modal dialog, focus held inside and given back
after). It has five tabs across the top:

```
┌ Hangar ───────────────────────────────────── Level 7 · Star Pilot  ▓▓▓▓░ 3,240 xp ┐
│ [Crew] [Arms] [Powers] [Skills] [Shipyard]        12,400 ¢   ◆ 4 points    [×]    │
├───────────────────────────────────────────────────────────────────────────────────┤
│                         (the tab's own body: see 3.3–3.7)                         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

The head is shared by every tab. It shows the pilot's level and title, xp
toward the next level, credits and the skill points free. It reads the
economy and the skills, never its own copy of either.

**Keys.** H opens it on the tab last used (Shipyard the first time, so H
still does what it did). C opens it on Crew. Esc closes it. The tabs are
an ARIA tab list, moved through with the arrow keys.

**Where it opens.** It opens on the universe map, in the galaxy's flight
and, from Part 7, on Rick and Morty's pages. The galaxy's worlds keep
their own deploy panel (the reverse-engineering lane's). The Hangar's
Crew tab and that panel read and write the same choice (3.3).

**Look.** It uses the shipyard's house look (`shipyard.css`: dark glass,
the site's tokens), with the ship's engine colour as the accent (the
map's accent rule). A world may skin it through `data-world` on its root
(Rick and Morty's toon ink, Part 7), as `data-cast` skins the Wardrobe
today. One component, one drawing. The standalone Wardrobe dialog and
the Shipyard's own dialog shell go once their pages open the Hangar
instead.

### 3.2 How it's built

- `src/components/hangar/` is a new area. Its shell is `HangarPanel.jsx`:
  the dialog, the head, the tabs and the keys. Each tab is a component of
  its own, and the rules live in pure files beside them. The door button
  stays where it is: `universe/Hangar.jsx` (`.universe-hangar-btn`, which
  the scene's focus handling relies on) opens the panel in place of the
  Shipyard.
- `src/components/hangar/index.js` is its face to the pages. A page
  mounts `<Hangar>` with what it has (the ship, the live fit, the saves,
  `onApply`), the same props the Shipyard takes now.
- The Shipyard's body (catalogue, showroom, bill) becomes the Shipyard
  tab without changing. `Shipyard.jsx` splits into its dialog shell
  (which goes) and `ShipyardBody` (which stays, in `universe/shipyard/`,
  lent through `universe/shared/`).
- The Wardrobe's controls split out of `Wardrobe.jsx` into
  `WardrobeControls.jsx` (in `rickmorty/wardrobe/`, lent through a new
  `rickmorty/shared/`), so the Crew tab and, until Part 7, the C-137
  street's dialog draw the same controls.

### 3.3 Crew

The ship's two crew, side by side as tabs, as the Wardrobe's “Who” tabs
are. One of them is marked as the one who walks out first on foot.

- **Rick, Morty, Walt and Jesse.** These are the Wardrobe's controls,
  unchanged in behaviour: body, colours and gear, kept in `tp-wardrobe`.
- **Luke, Artoo, Han and Chewie.** These are new, but every choice is
  one that already exists:
  - the outfit, from `galaxy/heroes.js`'s `SKINS` (Luke, Han and Chewie
    have them)
  - for Luke, the blade's colour and hilt (`SABER_COLORS`, `HILTS`)
  - the gun in their hand (Part 4's Arms)

  These are kept per character in a new save, `tp-crew` (version 1,
  through `runtime/saves.js`): `{ [who]: { skin, saber: { color, hilt }, gun } }`.
  One choice per character, wherever it is made *(the session's call)*:
  - **The Hangar writes it.**
  - **The galaxy's deploy panel writes it too.** When a hero with a
    `tp-crew` entry is changed there (skin, blade or gun), the change is
    written back to that hero's entry.
  - **`readHero` reads it.** For the hero picked, `tp-crew`'s style wins
    over `tp-galaxy-hero`'s copy of it. `tp-galaxy-hero` keeps who is
    picked and everything else it holds (stance, mods, perks, a trooper
    class), as now.
  - **On first read,** `tp-crew` is seeded from `tp-galaxy-hero`'s
    current hero, so no one's choice is lost.
- **The turntable.** Rick, Morty, Walt and Jesse use the Wardrobe's
  preview (`preview.js`). Luke, Artoo, Han and Chewie get a card: their
  name, the outfit's name, a swatch of the blade, the gun and a line about
  them. *(The session's call. The figure the universe's foot scene walks
  for them comes through the reverse-engineering lane's loaders,
  `universe/footFigures.js` imports them, and the 2017 bodies are large.
  A turntable for them can come later as a lazy, opt-in load.)*

### 3.4 Arms

What you fight with, in one place.

- **The ship's three lines:** what's fitted on each, with its numbers
  (rate, damage, rack). A line opens the Shipyard tab on its slot, since
  ship guns are bought and fitted there and only there.
- **Each crew member's gun in the hand:** a list of the guns they may
  carry (Part 8's table), with the numbers that matter (damage, rate,
  range, heat) and one picked, kept in `tp-crew`.
- **Unique weapons (Part 6)** are listed with the rest. A locked one
  shows the node that opens it (“Skills · Guns · Seismic charge”).

### 3.5 Powers

Two slots, G and X. Each slot lists the powers you may put there:

- your ship's crew's own two, always
- any other crew's pair whose node you've taken (Part 4, the Powers
  branch)

A G power goes only on G and an X power only on X. The choice is kept
per crew in `tp-powers` (version 1): `{ [crew]: { primary, ultimate } }`.
`shipPowers.createPowers(crew, …)` takes the choice in place of
`CREW_POWERS[crew]`, falling back to it. *(The session's call:
`powersOf` and `POWERS` stay the source. The choice only says which
cards a crew carries.)*

### 3.6 Skills

The tree (Part 4), drawn as four columns, one per branch, with rows
going deeper. Each node is a button showing its cost, what it does in a
line, and its state: open (taken), can take, needs a parent, needs a
key, or short of points. Taking a node is one press and is kept at once
(nothing is staged, since a point can always be got back with a reset).
Reset is at the foot of the tab.

### 3.7 Shipyard

The Shipyard as it is, inside the tab (3.2). Apply fits the live ship, as
now. On foot, Apply is greyed with a note (“Board your ship to fit it”).

## Part 4: The skill tree

### 4.1 Points

`skillRules.pointsOf({ xp, achievements })` gives the points earned, from
three sources:

| Source | Points |
| --- | --- |
| Each pilot level past the first (levels 2–11) | 1 each, 10 in all |
| Each Legend rank past level 11: one per 3,000 xp past 11,000 | 1 each, at most 10 |
| Every 5 achievements unlocked, Battlefront's left out | 1 each, at most 50 |

Points spent are the sum of the nodes taken. Points free are earned minus
spent. The economy is not changed: Legend ranks are worked out from xp in
the skill rules, and the head says “Legend II” and so on past level 11.

Battlefront's achievements (`galacticassault`, `heroesvsvillains`,
`blast` and the rest of its own) don't count: it is out of this design.
They are listed by id in `skillTree.js`, and a test fails on an id that
doesn't exist.

### 4.2 Hard but possible

The whole tree costs **60**. The most the site gives is
10 + 10 + 50 = **70**: the cap is reached at 250 achievements, of the
272 there are today, less Battlefront's. So every node needs about
six-sevenths of everything there is, across every world, including the
ones no ship flies to (achievements are site-wide).

A test pins it against the live tables:

    0.8 × maxPoints ≤ treeCost ≤ maxPoints
    maxPoints = 10 + 10 + min(50, floor(countable achievements / 5))

The cap keeps this steady as achievements are added: new ones make the
cap easier to reach, but never move the most. If the tree grows, it must
stay inside the band. *(The session's call, after the builder check: an
uncapped count would have broken the band at 280 achievements.)*

### 4.3 Freedom

- Four branches: **Flight**, **Guns**, **Ground** and **Powers**. Each
  has two first-row nodes that need nothing.
- Any deeper node needs any one node in the row above it in the same
  branch, never one in another branch. Order is the player's choice.
- A few deep nodes also need a **key**: one achievement from a given
  universe. This is what makes the whole tree a whole-site thing without
  forcing an order. The keys:
  - `starwars`: any of the galaxy's achievements
  - `rickmorty`: any of Rick and Morty's
  - `breakingbad`: any of Albuquerque's
  - `universe`: any from the map's own worlds (the Avengers, Cybertron,
    Invincible, Middle-earth, Minecraft …)

  Which achievement ids count for which key is a table in
  `skillTree.js`, sorted by hand from `Achievements.jsx` (it has no
  groups, only a few comments). A test fails on an id that doesn't exist.
- **Reset**: every point back, for credits. The first reset is free and
  each after costs 500 ¢, through `economy.spend`.

### 4.4 The tree

Every number below is a starting point. The builder may tune the
amounts, but not the shape or the total.

**Flight** (15):

| Node | Row | Cost | Needs | Does |
| --- | --- | --- | --- | --- |
| `afterburn` | 1 | 1 | none | boost +10% |
| `trim` | 1 | 1 | none | agility +8% |
| `deflectors` | 2 | 2 | a row-1 node | shield regen ×1.25 |
| `plating` | 2 | 2 | a row-1 node | damage taken ×0.9 (from the game's ships) |
| `slipstream` | 3 | 2 | a row-2 node | cruise +10%, accel +15% |
| `hotdrive` | 3 | 2 | a row-2 node | jump charge time ×0.75 |
| `instinct` | 4 | 2 | a row-3 node | agility +15%, levelling +20% |
| `kesselrun` | 4 | 3 | a row-3 node, key `starwars` | boost +20%, cruise +10% |

**Guns** (15):

| Node | Row | Cost | Needs | Does |
| --- | --- | --- | --- | --- |
| `trigger` | 1 | 1 | none | primary cadence ×0.92 |
| `racks` | 1 | 1 | none | ordnance rack +1 round |
| `scatter` | 2 | 2 | a row-1 node | secondary +1 shot a burst |
| `loader` | 2 | 2 | a row-1 node | ordnance reload ×0.8 |
| `longlock` | 3 | 1 | a row-2 node | lock range ×1.25, homing ×1.3 |
| `u-seismic` | 4 | 2 | `longlock`, key `starwars` | the Seismic charge (6.1) |
| `u-darkmatter` | 4 | 2 | `longlock`, key `rickmorty` | Concentrated dark matter (6.1) |
| `u-crystal` | 4 | 2 | `longlock`, key `breakingbad` | Blue sky cluster (6.1) |
| `u-energon` | 4 | 2 | `longlock`, key `universe` | Energon arc (6.1) |

**Ground** (15):

| Node | Row | Cost | Needs | Does |
| --- | --- | --- | --- | --- |
| `tough` | 1 | 1 | none | health +10% |
| `steady` | 1 | 1 | none | spread ×0.85 |
| `coolant` | 2 | 2 | a row-1 node | heat ×0.85, cooling ×1.15 |
| `medic` | 2 | 2 | a row-1 node | health regen ×1.5 |
| `hardhit` | 3 | 1 | a row-2 node | damage ×1.15 (to the game's troops) |
| `u-amban` | 4 | 2 | `hardhit`, key `starwars` | the Amban rifle (6.2) |
| `u-particle` | 4 | 2 | `hardhit`, key `rickmorty` | Rick's particle beam (6.2) |
| `u-m60` | 4 | 2 | `hardhit`, key `breakingbad` | The M60 from the trunk (6.2) |
| `u-gauntlet` | 4 | 2 | `hardhit`, key `universe` | The repulsor gauntlet (6.2) |

**Powers** (15):

| Node | Row | Cost | Needs | Does |
| --- | --- | --- | --- | --- |
| `quickcharge` | 1 | 1 | none | big power's charge ×1.2 |
| `recovery` | 1 | 1 | none | power cooldown ×0.85 |
| `overdrive` | 2 | 2 | a row-1 node | power duration ×1.2 |
| `scavenger` | 2 | 1 | a row-1 node | pickups charge ×1.5 |
| `overcharge` | 3 | 2 | a row-2 node | big power's punch ×1.25 |
| `b-xwing` | 4 | 2 | a row-3 node, key `starwars` | any ship may carry Force Focus and the Torpedo salvo |
| `b-falcon` | 4 | 2 | a row-3 node, key `starwars` | any ship may carry Never tell me the odds and Chewie on the quad guns |
| `b-cruiser` | 4 | 2 | a row-3 node, key `rickmorty` | any ship may carry the Portal gun and Wubba lubba dub dub |
| `b-rv` | 4 | 2 | a row-3 node, key `breakingbad` | any ship may carry Magnets and Say my name |

The four branches come to 60. In the Powers branch, borrowing your own
crew's pair is allowed but buys nothing new for that crew. The node's
line says so (“Your own crew's already”).

### 4.5 Where the effects land

`skillRules.effectsOf(nodes)` returns one flat object of multipliers and
adders. Each key has one meaning and one consumer:

- **Ship flight and guns.** `outfit.statsOf(kind, loadout, build, tune,
  fx)` applies boost, accel, cruise, agility, level, regen, cadence and
  armor after the parts. Both scenes already fly on `statsOf`.
- **The rack and the burst.** `createArmory(kind, loadout, fx)` applies
  ammo, reload and the extra shot. The universe map and, from Part 2,
  the galaxy build their armoury this way.
- **The lock.** `targeting.js`'s range and the rounds' homing take fx's
  multipliers.
- **Powers.** `createPowers(crew, { charge, cool, picks, fx })` applies
  cool, duration, charge, pickup and the big one's punch.
- **On foot.**
  - The galaxy's worlds: `perkEffects(ids)` is multiplied by
    `groundEffects(fx)` where the scene reads it, which is the one seam.
  - The universe's foot scene: `foot.js`'s health and heal.
  - Rick and Morty: Part 7.
- **Never online.** fx's damage keys apply to the game's own ships and
  troops only. A shot at another pilot carries its weapon's own damage,
  as now.

A page reads the skills from a `SkillsProvider` mounted in `App.jsx`
beside the `EconomyProvider`. It hands fx to its scene the way it hands
the loadout now, and a change made in the Hangar reaches the scene on
close, as a shipyard Apply does.

### 4.6 The save

`tp-skills`, version 1, through `runtime/saves.js`:
`{ nodes: [ids in the order taken], resets }`.
`readSkills(raw, { earned, owns })` is pure and tested. It keeps the nodes
that exist, whose parents and keys are met, in the order taken, while
the points last, and drops the rest. Nothing else is stored: points are
always worked out from xp and achievements.

## Part 5: The arms tables move down

The tables two worlds read move to `src/lib/arms/`, with their old paths
left as re-exports (the barrel rule in `RULES.md`), so no caller changes
in the pull request that moves them:

- `src/lib/arms/ship.js`: `universe/weaponTable.js`'s `WEAPONS`, `byCode`,
  `rackOf` and `burstOf`, plus the unique ship weapons (6.1).
- `src/lib/arms/hand.js`: Part 8's table.
- `src/lib/arms/scale.js`: the one health scale (8.2) and its conversions.

These are pure and tested, and import no React and no three.js.

## Part 6: Unique weapons

Each does one thing nothing else does. Each is drawn in code with the
house bolt and impact kits (`lib/three/combat/`, `lib/impact.js`), so no
new model or texture is needed. A behaviour is a pure step in
`src/lib/arms/behaviours.js`, tested in Node, and the scenes only draw
it.

### 6.1 On the ship

The wire codes are 7–10 of the 16 there are.

| Id | Name | From | Line | What it does |
| --- | --- | --- | --- | --- |
| `seismic` | Seismic charge | Star Wars (Attack of the Clones) | ordnance | Dropped behind you, not fired ahead. After 1.2 s it goes off in a flat ring 14 units across, hitting everything in it (the sound and the ring are the show). Rack 2, one back every 10 s. |
| `darkmatter` | Concentrated dark matter | Rick and Morty | secondary | One slow bolt that goes through every ship in its line, losing a third of its punch at each. |
| `crystal` | Blue sky cluster | Breaking Bad | ordnance | A homing round that bursts into six blue shards near its target, each a small hit. Rack 3. |
| `energon` | Energon arc | The universe's worlds (Cybertron) | secondary | Lightning to the lock and on to up to three more within 12 units of it, each jump weaker. |

The prices are by hand in `catalog.js`'s `NEW`, between 900 and 1,500 ¢.
Each needs its node as a catalogue need (a new kind,
`needs: { skill: 'u-seismic' }`, checked by the wallet's `lock` through a
`skillOf` it is handed, as `standingOf` is now). Another pilot sees the
shot as its own kind (the code), and an older peer draws an unknown code
as the blaster (`byCode`), as now.

### 6.2 In the hand

| Id | Name | From | What it does |
| --- | --- | --- | --- |
| `amban` | Amban phase-pulse rifle | Star Wars (The Mandalorian) | One heavy shot at a time, a long reach and a scope. Whoever it drops goes in a flash of light, the way it does on the show. |
| `particle` | Particle beam | Rick and Morty | Held, not fired: a beam that heats fast and hits ten times a second. |
| `m60` | The M60 from the trunk | Breaking Bad | A heavy repeater: a long stream, slow to heat, and a kick that walks the aim up. |
| `gauntlet` | Repulsor gauntlet | The universe's worlds (the Avengers) | A palm blast at short range that throws whoever it hits back. A charge held makes it bigger. |

These join the hand table (Part 8) and the galaxy's `PICKABLE` list. Each
gets a gun model, built in code, in a new file
(`universe/guns/unique.js`). `gunplay.js` (1,422 lines) only spreads
them into `GUNS`, since adding them there would cross the 1,500-line
ceiling. The kill shows for `amban`, `particle` and `gauntlet` join
`weaponRules.js`'s `SHOW_KILLS`. A hand weapon is free once its node is
taken. Its node is its only lock.

## Part 7: Rick and Morty aboard

- **The wallet.** Rick and Morty's deeds pay through `useEarn` with side
  `rickmorty`, using the keys `EARN` already has:
  - a C-137 task, a Citadel quest or a planet quest done is `questDone`
  - a planet place found is `found`
  - a duel won is `killAce`
  - a Total Rickall parasite is `killPirate`
  - a Portal panic boss beaten is `killCapital`

  The mapping is a table in a tested `rickmorty/earn.js`.
- **The Hangar** opens on the C-137 street, the Citadel and the big
  planets: H opens it, and C opens it on Crew in place of today's
  Wardrobe dialog. The Shipyard tab fits the cruiser, as it would on the
  map.
- **The cruiser** on the C-137 street flies with `statsOf('cruiser', …)`
  over its own `CRUISER` numbers. Those are
  `{ radius, hover, top, accel, turn, climb, ceiling }`, so:
  - `top` takes the cruise and the boost
  - `accel` takes the accel
  - `turn` and `climb` take the agility

  Where the street's cruiser is a different model (`cruiser3dCore.js`),
  its paint is applied and its parts are shown only in the Hangar.
  *(The session's call. Bolting map parts onto a different hull's model
  is a job of its own.)*
- **A fight on the street** *(the session's call: today the Federation
  patrol only follows, with no hp and no guns, so the cruiser would have
  nothing to fire at)*. The patrol stays calm until you open fire on it.
  Then it fights back, with a hunter's laser and hp (`hunterRules.js`'s
  numbers), and is shot down for `killHunter`. The cruiser fires its
  armoury and plays its powers there, as Part 2 does on the map. A new
  patrol comes round its loop a minute later. The rules are in a tested
  `rickmorty/world/patrolRules.js`.
- **On foot.** The street's duels and Total Rickall draw health with the
  kit's `Vitals` in place of the hearts (8.2), and the gun with `Arms`
  (no heat bar: guns heat only where they did already). The toon skin
  stays: `RmHud.jsx`'s classes over the kit's.
- The big planets already use the galaxy's surface engine and the full
  kit, so they get Parts 4 and 8 through it.

## Part 8: One table for guns in the hand

### 8.1 The table

`src/lib/arms/hand.js` is the one source of each hand gun's numbers.
`galaxy/surface/weaponRules.js`'s `WEAPONS` is the most complete, and it
moves there with the old path re-exporting. Then:

- **The universe's foot scene.** Its shot damage (`footScene.js`'s
  fallback, and `gunplay.js`'s freeze and shrink, the only two there
  that carry one) and its bolt range (`foot.js`) are read from the
  table. `gunplay.js` keeps only the models and the grip.
- **Rick and Morty's `rmShots.js`** reads its ranges and damage from
  there.
- **The Death Star's inside** (`deathstar/inside/rules/combat.js`) stays
  its own: it is a scripted set piece, not a place you bring a crew.
- **Heat** is only where it is today. The table's heat numbers are read
  only by the worlds that already heat a gun (the galaxy's and Rick and
  Morty's big planets).

### 8.2 One scale

The scales are mostly one already, and this writes them down in
`src/lib/arms/scale.js`, tested:

- **The player has 100 health on foot,** as the universe and the
  galaxy's worlds already do, and 100 shields in a ship.
- **Enemies and guns count in hits:** a stormtrooper has 2, the universe's
  troops 1–6, and the DL-44 does 2 a shot.
- **Rick and Morty's hearts become health:** a heart is 100 ÷ hearts.
  - Morty's 3 hearts are 100 health, and a hit takes 34.
  - A duel's enemy keeps its 6 hits, as an enemy should.
- **A saber hero's 750** (the 2017 game's, the reverse-engineering
  lane's) is shown on `Vitals` as a share of 100. The number underneath
  is not changed.

Flight keeps its 0–100 shields: that scale is already one between the map
and the galaxy, and it is what the wire carries.

## Part 9: The order of the pull requests

Each stands alone, ships green and is screenshotted on the routes it
touches.

| # | Pull request | Parts | Why here |
| --- | --- | --- | --- |
| 1 | One flight HUD | 1 | The owner's first complaint, and the parts everything after uses |
| 2 | Every ship, every gun | 2 | The other half of “the weapons are different” |
| 3 | The Hangar | 3 (Crew, Arms read-only, Powers own-crew, Shipyard) | The one space, before anything goes in it |
| 4 | Skills | 4, 5 (`ship.js` only) | The tree, the points, the effects, borrowed powers |
| 5 | Rick and Morty aboard | 7 | It needs the HUD, the Hangar and the points to join |
| 6 | Unique weapons | 6, 5 (`hand.js`) | They need the tree to unlock them |
| 7 | One table for guns in the hand | 8 | The clean-up that makes the ground feel the same |

## Left to the builder

- Exact numbers in the tree, the unique weapons' feel and the reset's
  price, inside the shape and the 4.2 band.
- The Hangar's exact layout and its phone layout, inside the house UI
  rules and the shipyard's look.
- Each skill node's copy and each weapon's “about” line, in the site's
  voice.
- How each scene's frame loop writes the kit parts' numbers, through
  refs.
- Which achievements count for which universe key (4.3), from
  `Achievements.jsx`'s groups.
