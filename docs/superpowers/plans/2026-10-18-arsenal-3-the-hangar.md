# The Hangar (arsenal, pull request 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One overlay, the Hangar, holds your crew (dressed the way the Wardrobe dresses Rick, for every crew), your arms, your powers and the shipyard. H and C open it on the universe map and in the galaxy's flight.

**Architecture:**
- **The shell.** The Hangar is a new component area, `src/components/hangar/`. Its shell (`HangarPanel.jsx`) is the Shipyard's: a dialog portalled onto the body over a frozen world. It has a head showing the wallet and the level, and a tab list: Crew, Arms, Powers, Shipyard.
- **Moved bodies.** The Shipyard's body and the Wardrobe's controls are split out of their dialogs without changing, then lent through their worlds' `shared/` faces.
- **One crew style.** Each crew member's style (an outfit, a blade, a gun in the hand) is one small save, `tp-crew`, read through `src/lib/crew/crewStyle.js`. It is shape only, so every reader checks the ids against its own tables. The galaxy's worlds read it as the hero's default, and its deploy panel writes back to it.

**Tech Stack:** React 19, three.js (the Wardrobe's turntable, the Shipyard's showroom), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md`, Part 3 (the Skills tab waits for pull request 4). Pull requests 1 and 2 are done: the kit's cluster, and both maps firing the three lines and playing the powers.

## Global Constraints

- **Islands** (`docs/health/RULES.md`):
  - The Hangar reaches the universe, the galaxy and Rick and Morty only through their `shared/` faces (new: `universe/shared/hangar.js`, `rickmorty/shared/wardrobe.js`, `galaxy/shared/arms.js`), and the faces' tests list their names.
  - `boundary-breaks` (482) may not rise.
  - `src/lib/crew/` imports no React and nothing from `src/components`.
- **Saves:**
  - `tp-crew` is version 1, through `runtime/local.js`'s `localSaves()` (`register({ key, version, migrate })`).
  - `tp-wardrobe`, `tp-galaxy-hero`, `tp-pilot` and the shipyard's keys read as they did.
  - The last tab is a per-viewer convenience, in `localStorage` as `tp-hangar-tab` through `lib/hooks`'s `local`, and it never throws.
- **The house UI:**
  - The shipyard's look (`shipyard.css`) in the house tokens, with the ship's `--engine` as the accent.
  - 44 px controls on a coarse pointer; it stacks to one column under 720 px.
  - An ARIA tab list (`role="tablist"`, arrow keys); focus held inside the dialog and given back after.
  - British spelling, no Oxford comma.
- **Keys:**
  - H opens the Hangar on the tab last used (the Shipyard the first time).
  - C opens it on Crew. Esc closes it.
  - Neither works while typing, on foot or over another dialog, which are the Shipyard's own rules (`Shipyard.jsx`'s key handler).
- **Battlefront and the 2017 bodies:** untouched. The Star Wars crew are a card, not a turntable (spec 3.3).
- **Done means:** lint; the suite against the baseline, with 5 s timeouts rerun at 60 s; the health check; the build; and shots of the Hangar on `/universe` and `/galaxy` at 1440x900 and 390x844, every tab.

## Review Focus

1. **The Shipyard is unchanged inside the Hangar.** The draft, Apply, Sell, the record, paste, roll, the hint and the dropped parts all work as they did, and the map stays frozen behind it.
2. **Every save still reads as it did.** A visitor with a `tp-galaxy-hero` (say Han in his Hoth outfit with an E-11) opens the galaxy's worlds as Han, Hoth, E-11, and the Hangar's Crew tab shows the same.
3. **The Wardrobe's own places still dress.** The C-137 street (its `C` key and chip), the Citadel and the RV seats still open and wear the Wardrobe. Only the universe page's standalone dialog goes.
4. **Keys while another dialog is up.** H and C do nothing over the nav map, the phone, the guide or a world's menu, and do nothing while typing in the Shipyard's paste box.
5. **A phone.** The Hangar fills the screen. The tabs scroll sideways and don't wrap into two rows. Every control is 44 px.

---

### Task 1: The crew's style, one save

**Files:**
- Create: `src/lib/crew/crewStyle.js` and `crewStyle.test.js`

**Interfaces:**
- Produces:
  - `CREW_KEY = 'tp-crew'` and `CREW_VERSION = 1`
  - `CREW_WHO = ['luke', 'artoo', 'han', 'chewie', 'rick', 'morty', 'walt', 'jesse']`
  - `readCrew(raw) → { [who]: { skin?: string, saber?: { color, hilt }, gun?: string } }`. It keeps only known `who`s, and only strings of 1–40 characters; anything else is dropped.
  - `styleOf(crew, who) → the entry or {}`
  - `setStyle(crew, who, patch) → a new crew`, where `patch` is a partial entry and `null` in it removes that field
  - `seedFromHero(crew, hero) → crew`. Given `tp-galaxy-hero`'s parsed choice `{ id, skin, color, hilt, gun }`, it copies the skin, the saber (when there's a colour) and the gun into an empty entry for that hero, if the hero is in `CREW_WHO`. It never overwrites an entry that's there.
  - `registerCrew(saves)`, which calls `saves.register({ key: CREW_KEY, version: CREW_VERSION, migrate: (old) => old })`

- [ ] **Step 1: Write the failing tests:**
  - `reads only the crew it knows, in shape`: `readCrew({ han: { skin: 'hanhoth', gun: 'rifle', x: 1 }, vader: { skin: 'vader' }, luke: { saber: { color: 'green', hilt: 'luke' } }, rick: 'junk' })` is `{ han: { skin: 'hanhoth', gun: 'rifle' }, luke: { saber: { color: 'green', hilt: 'luke' } } }`. A JSON string reads the same, and junk reads `{}`.
  - `sets and clears a field without touching the rest`: `setStyle({ han: { skin: 'hanhoth', gun: 'rifle' } }, 'han', { gun: null })` is `{ han: { skin: 'hanhoth' } }`, and the input is unchanged.
  - `seeds the picked hero from the galaxy's choice, once`: `seedFromHero({}, { id: 'han', skin: 'hanhoth', gun: 'rifle', color: 'blue', hilt: 'skywalker' })` gives han's entry. Seeding again over an existing han entry leaves it as it was. A hero not in the crew (`vader`) changes nothing.
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/lib/crew/crewStyle.test.js`.
- [ ] **Step 3: Implement `crewStyle.js`.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit**: `git commit -m "One save for how each crew member's styled: an outfit, a blade and a gun in the hand."`

### Task 2: The galaxy's worlds read and write the crew's style

**Files:**
- Modify:
  - `src/components/galaxy/heroes.js`: `readHero(raw, ship, crew = {})`. For the hero picked, `crew[hero.id]`'s skin, saber colour, hilt and gun win over the raw choice's, each still checked against `skinsOf`, `SABER_COLORS`, `HILTS` and `PICKABLE` as now.
  - `src/components/galaxy/heroes.test.js`
  - `src/pages/GalaxySurface.jsx`:
    - It reads `tp-crew` through `localSaves()` with `registerCrew`, and seeds it from `tp-galaxy-hero` on first read.
    - It passes the crew to `readHero`.
    - Where it writes `HERO_KEY` (its `pick` and `keep` paths), it also writes `setStyle(crew, hero.id, { skin, saber: hero.saber ? { color, hilt } : null, gun })` for a hero in `CREW_WHO`.
  - `src/components/galaxy/travel.js`, `src/pages/Galaxy.jsx`: their `readHero` calls pass the crew too.

**Interfaces:**
- Consumes: Task 1's `readCrew`, `setStyle`, `seedFromHero`, `registerCrew`, `CREW_KEY` and `CREW_WHO`.

- [ ] **Step 1: Write the failing tests** in `heroes.test.js`:
  - `the crew's style wins for the hero picked`: `readHero(JSON.stringify({ id: 'han', skin: 'han', gun: 'blaster' }), 'falcon', { han: { skin: 'hanhoth', gun: 'rifle' } })` gives `skin: 'hanhoth', gun: 'rifle'`, when `hanhoth` is in `skinsOf('han')` (guard the test with that).
  - `a style the hero can't wear falls back`: `{ han: { gun: 'nope' } }` gives the raw choice's gun.
  - `another hero's style is ignored`: `{ luke: { saber: { color: 'red' } } }` with Han picked changes nothing.
- [ ] **Step 2: Run them and see them fail**: `npx vitest run src/components/galaxy/heroes.test.js`.
- [ ] **Step 3: Implement it and wire the two pages.**
- [ ] **Step 4: Run the tests**: `npx vitest run src/components/galaxy src/lib/crew --testTimeout=60000`. Expected: no new failures.
- [ ] **Step 5: Commit**: `git commit -m "The galaxy's worlds dress the hero picked in the crew's own style, and keep it there when it changes."`

### Task 3: The Shipyard's body and the Wardrobe's controls, lent

**Files:**
- Modify:
  - `src/components/universe/shipyard/Shipyard.jsx`: the dialog shell stays, and renders a new `ShipyardBody.jsx`, which takes the head's text, the catalogue, the stage and the bill as they are.
  - `src/components/rickmorty/wardrobe/Wardrobe.jsx`: the dialog stays, and renders a new `WardrobeControls.jsx` (the who-tabs, the body, the colours, the gear, Reset and credits) and the turntable stage.
- Create:
  - `src/components/universe/shared/hangar.js`, lending `ShipyardBody`, `useShipyardPage`, `crewById`, `arsenalOf`, `armsView`, `createArmory`, `POWERS`, `POWER_KEYS`, `powersOf`, `LINES`, `WEAPONS` and `readout`
  - `src/components/rickmorty/shared/wardrobe.js` with its `shared.test.js`, lending `WardrobeControls`, `WardrobeStage` (the turntable part), `useLooks`, `CASTS`, `castOfCrew` and `NAME`
  - `src/components/galaxy/shared/arms.js`, lending `WEAPONS` (the hand guns), `PICKABLE`, `SABER_COLORS`, `HILTS`, `skinsOf` and `heroById`
- Modify: each face's `shared.test.js`

**Interfaces:**
- Produces:
  - `ShipyardBody({ ...Shipyard's props except open, onOpen, enabled, returnTo })`: the catalogue, the stage and the bill. It runs its showroom while mounted.
  - `WardrobeControls({ cast, who, onWho, looks, onLook, headless })`: the controls column. With `headless`, there is no "Wardrobe" header and no close.
  - `WardrobeStage({ look, who, reduced })`: the turntable, made on mount and gone on unmount.

- [ ] **Step 1: Write the failing tests**: the three faces' name lists.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Split the two files and lend them.** Do it with no behaviour change. The Shipyard's and the Wardrobe's own render tests, if any, still pass. Shoot the Shipyard and the Wardrobe before and after: the same pixels.
- [ ] **Step 4: Run the tests**: `npx vitest run src/components/universe/shipyard src/components/rickmorty/wardrobe src/components/*/shared`.
- [ ] **Step 5: Commit**: `git commit -m "The Shipyard's body and the Wardrobe's controls stand apart from their dialogs, lent for the Hangar."`

### Task 4: The Hangar's shell, its head and its keys

**Files:**
- Create:
  - `src/components/hangar/HangarPanel.jsx` and `hangar.css`
  - `src/components/hangar/hangarRules.js` and `hangarRules.test.js`
  - `src/components/hangar/index.js`, lending `HangarPanel` and `TABS`

**Interfaces:**
- Produces:
  - `TABS = ['crew', 'arms', 'powers', 'shipyard']` and `TAB_LABEL`
  - `TAB_KEY = 'tp-hangar-tab'`
  - `readTab(raw) → a tab`, `'shipyard'` when unknown
  - `tabForKey(key, last) → a tab or null` (`'h'` gives `last`, `'c'` gives `'crew'`)
  - `wantsKey(e, { open, typing, otherDialog, onFoot }) → boolean`, the Shipyard's rules as one pure check
  - `headOf(record) → { level, title, legend: null, xp, toNext (0–1), credits }`, from `economy.record()` and `economy.js`'s `LEVELS` and `TITLES`. `legend` stays null until pull request 4.
  - `HangarPanel({ open, onOpen, tab, onTab, enabled, ship, shipName, live, lastBuild, saves, dropped, onApply, onSell, returnTo, onFoot })` renders the dialog. Its head has "Hangar", the level and title, an xp bar to the next level and the credits. Its tabs, and the current tab's body.

- [ ] **Step 1: Write the failing tests** in `hangarRules.test.js`:
  - `readTab` with `'arms'` is `'arms'`, and with junk is `'shipyard'`.
  - `tabForKey('h', 'powers')` is `'powers'`, `tabForKey('c', 'powers')` is `'crew'`, and `tabForKey('q', 'powers')` is null.
  - `wantsKey` is false while typing, over another dialog or on foot, and true otherwise, open or shut.
  - `headOf({ xp: 200, credits: 1234, level: 3, title: 'Pilot' })` is `{ level: 3, title: 'Pilot', xp: 200, toNext: (200-150)/(350-150), credits: 1234, legend: null }`.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement the rules and the shell.** Take the Shipyard's portal, focus trap and Escape. H and C go through `wantsKey` and `tabForKey`. The tabs are `role="tab"` buttons in a `role="tablist"`, moved through with the arrow keys. The body for now is the Shipyard tab (Task 6 adds the rest), and the others say "Coming in this pull request".
- [ ] **Step 4: Run the tests and see them pass.**
- [ ] **Step 5: Commit**: `git commit -m "The Hangar: one dialog for the crew, the arms, the powers and the shipyard, with the wallet in its head."`

### Task 5: Crew

**Files:**
- Create: `src/components/hangar/CrewTab.jsx`, `crewTabRules.js` and `crewTabRules.test.js`

**Interfaces:**
- Consumes:
  - Task 1's style
  - Task 3's `WardrobeControls`, `WardrobeStage`, `useLooks`, `castOfCrew`, `CASTS`
  - `galaxy/shared/arms`'s `skinsOf`, `SABER_COLORS`, `HILTS` and `heroById`
- Produces:
  - `crewOf(ship) → ['rick','morty'] | ['walt','jesse'] | ['luke','artoo'] | ['han','chewie']`
  - `cardOf(who, style) → { name, outfit (name or null), blade ({ hex, hilt name } or null), gun (name or null), line }` (pure)
- Behaviour:
  - Rick, Morty, Walt and Jesse: `WardrobeStage` and `WardrobeControls`, headless.
  - Luke, Artoo, Han and Chewie: a card from `cardOf`, plus:
    - an outfit chip row (`skinsOf(who)`; Artoo has none, and the row says "Worn on the galaxy's worlds")
    - for Luke, a blade colour swatch row and a hilt chip row
  - Each change goes through `setStyle`, saved at once with `localSaves().set(CREW_KEY, …)`.

- [ ] **Step 1: Write the failing tests:** `crewOf` for each of the four ships. `cardOf('luke', { saber: { color: 'green', hilt: 'luke' } })` has `blade.hex` `'#5cff6a'`. `cardOf('artoo', {})` has no outfit and no blade.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass, then shoot the Crew tab for the cruiser and the X-wing.**
- [ ] **Step 5: Commit**: `git commit -m "The Hangar's Crew: the Wardrobe for Rick, Morty, Walt and Jesse, and Luke, Artoo, Han and Chewie's outfits and blades."`

### Task 6: Arms and Powers

**Files:**
- Create: `src/components/hangar/ArmsTab.jsx`, `PowersTab.jsx`, `armsTabRules.js` and `armsTabRules.test.js`

**Interfaces:**
- Produces:
  - `shipLines(ship, loadout) → [{ line, name, weapon (id), damage, rate (shots a second at the ship's stock cadence), rack: { ammo, reload } | null }]`. It is built from `createArmory(ship, loadout)` and `WEAPONS` (selecting each line in turn), with the cadences from `galaxy/scene.js`'s and `universe/scene.js`'s `CADENCE`. Read them out of a shared table if one exists; otherwise pass `{ xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 }` in and say so in a ruling.
  - `handGuns(who) → [{ id, name, about, damage, rate, range, heat }]`. It is the galaxy's `PICKABLE` in its order, with the character's own gun first (from `heroById(who).weapon`, or the universe's party for Rick, Morty, Walt and Jesse: portal, laser, revolver, pistol).
- Behaviour:
  - **Arms:** the ship's three lines, read-only, each with "Change in the Shipyard", which switches to the Shipyard tab on that slot. Then each crew member's gun, a chip row of `handGuns(who)` with the picked one pressed, saved to `tp-crew`. A hero with a saber (Luke) shows "His blade" in place of guns.
  - **Powers:** the G and X cards of the ship's crew (`powersOf`, `POWERS`: name, about, cool or charge), and a line that other crews' powers are earned in Skills (pull request 4).

- [ ] **Step 1: Write the failing tests:**
  - `shipLines('xwing', STOCK_LOADOUT)` is three lines named 'Laser cannons', 'Ion scatter' and 'Proton torpedoes'. The third has `rack: { ammo: 4, reload: 6.5 }`.
  - `handGuns('han')[0].id` is `'blaster'`, and no id repeats.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit**: `git commit -m "The Hangar's Arms and Powers: the ship's three lines, each crew member's gun, and the crew's two powers."`

### Task 7: The pages open the Hangar

**Files:**
- Modify:
  - `src/pages/Universe.jsx`: mount `HangarPanel` (lazy) in the Shipyard's place, with `tab` and `onTab` state seeded from `readTab(local.get(TAB_KEY))`. Remove the page's standalone `Wardrobe` and its `onCrew`.
  - `src/pages/Galaxy.jsx`: the same, in its Shipyard's place.
  - `src/components/universe/Hangar.jsx`: the door's label becomes "Open the hangar".
  - `src/components/guide/pages.js`: H is "The Hangar: crew, arms, powers and the shipyard", and C is "The Hangar, on your crew", on both maps.
  - `src/components/galaxy/keyRows.js`: H is "Hangar".

- [ ] **Step 1: Update the guide's test** (if it names the shipyard's row) **and the keys card's test** to the new words, and run them: they fail.
- [ ] **Step 2: Wire both pages, then run the tests.**
- [ ] **Step 3: Shoot it.** On `/universe` and `/galaxy`, at 1440x900 and 390x844: H opens on Shipyard; C opens on Crew; Tab and the arrows move between tabs; Esc closes, with the map unfrozen; and every tab's body appears.
- [ ] **Step 4: Commit**: `git commit -m "H opens the Hangar on both maps, and C opens it on the crew."`

### Task 8: Prove it and hand it over

- [ ] Lint; the full suite against the baseline (timeouts rerun at 60 s); `node scripts/health.mjs --check --skip build` (boundary-breaks ≤ 482); the build, with `public/github.json` restored.
