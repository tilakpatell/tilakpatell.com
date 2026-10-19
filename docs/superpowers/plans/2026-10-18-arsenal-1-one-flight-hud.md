# One flight HUD (arsenal, pull request 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The universe map and the galaxy show shields, arms and powers with the same kit parts, in the same place (a bottom-centre flight cluster), written the same way.

**Architecture:** The galaxy's flight cluster (`galaxy/FlightCluster.jsx`, `cluster.js`, `flight.css`) is the best-built flight HUD on the site, so it becomes the standard. Its generic pieces move down into the world HUD kit (`src/runtime/hud/`) as four parts: `Cluster`, `Vitals`, `Arms` and `Powers`. They come with one pure writer, `createFlightCluster`, and one stylesheet with tokens. The galaxy keeps its own blocks inside the cluster (radar, speed and kills, target, pickups). The universe map drops its left-side shield bar and weapon readout and mounts the same cluster.

**Tech Stack:** React 19, plain DOM writes from the frame loop, Vitest (Node, no jsdom), CSS with the house tokens.

**Spec:** `docs/superpowers/specs/2026-10-18-one-arsenal-and-hangar-design.md`, Part 1 (and Part 9, row 1).

## Global Constraints

- `src/runtime` imports nothing from `src/components`. Kit parts take plain values only, so icons and names are handed in.
- Numbers are written through refs by the frame loop, never React state. Each value is written only when it changes, and nothing is allocated per frame.
- Nothing a player reads while playing is under 0.7 rem. Text over the 3D sits on glass at alpha 0.78 or more, never blurred.
- Key caps use the house cap (`kbd.hud-cap` / `.hud kbd`) and never a `kbd` rule of their own (`kbd-styles` may only fall).
- Files stay under 800 lines. `universe/scene.js` and `galaxy/scene.js` only change at the lines that write the HUD.
- Copy is in British spelling, sentence case, with no Oxford comma.
- Battlefront and `src/lib/bf2017/` are untouched. `GameIcon` (which reads the bf2017 icons) is only used, as now.
- Done means: `npm run lint`, `npx vitest run` (no new failures against the 28 baseline-failing files in `C:\Users\tilak\AppData\Local\Temp\claude\C--Users-tilak\e70496d3-055d-4871-9478-a1099bb33d1c\scratchpad\baseline-fails.txt`), `npm run build`, `node scripts/health.mjs --check --skip build`, and before/after screenshots of `/universe` and `/galaxy`.

## Review Focus

1. **Galaxy pixels.** Its cluster must look the same after the move: the same glass, sizes, colours and order (radar, ship, target, powers). Compare screenshots before and after.
2. **The universe on foot.** The shield bar became Health on foot (`placeShield`'s `foot.info()` branch). The cluster must still show Health, and only Health, while you walk with trouble about or hurt.
3. **Touch screens.** On a coarse pointer the galaxy's cluster keeps to the radar and deflectors, and its powers stay round buttons beside Fire and View. The universe's cluster must not cover its Fire, Boost, Weapon and View buttons.
4. **A rack bigger than its pips.** Skills (pull request 4) will add a round, and the Mk II has 3 while missiles have 6. The writer must hide pips past `max` and cope with `max` up to 8.
5. **Frozen and map views.** With the Shipyard open (`frozen`), the nav map up (`view === 'map'`), crashed or diving, the universe's cluster hides, as the shield bar and readout did.

---

### Task 1: The kit's flight-cluster writer

**Files:**
- Create: `src/runtime/hud/cluster.js`
- Test: `src/runtime/hud/cluster.test.js`

**Interfaces:**
- Produces: `createFlightCluster() → { place(root, v) }`, where `v` is:
  - `{ on: boolean, vitals: { value: number, max: number, low: boolean } | null, arms: ArmsView | null }`
  - `ArmsView` is `{ name: string, line: 'primary' | 'secondary' | 'ordnance', index: 0 | 1 | 2, ammo: number, max: number, filling: number (0–1) }`
- Produces: `PIPS = 8` (the most rack pips drawn) and `vitalsPct(value, max) → 0–100` (whole number, clamped).
- The DOM it writes (Task 2's markup):
  - root `[data-on]`
  - `.hud-vitals`: `--v` (pct/100 as a string), `[data-low]`
  - `.hud-vitals-n`: text `"${pct}%"`
  - `.hud-arms`: `[data-on]` and `data-line`
  - `.hud-arms-name`: text
  - `.hud-arms-line` × 3: `[data-on]` on the one at `index`
  - `.hud-arms-pip` × 8: `hidden` past `max`, `[data-full]` under `ammo`, and `--fill` (two decimals) on the pip at `ammo`

- [ ] **Step 1: Write the failing tests** in `cluster.test.js`, using the stand-in element pattern from `src/components/galaxy/cluster.test.js` (add `querySelectorAll`, `hidden` and `dataset`):
  - `writes the vitals`: `place(root, { on: true, vitals: { value: 82, max: 100, low: false }, arms: null })` gives `.hud-vitals-n` text `'82%'`, `.hud-vitals` `--v` `'0.82'`, and root `data-on`.
  - `flags low vitals and clears it`: low true, then low false, toggles `.hud-vitals[data-low]`.
  - `writes a line and its rack`: `arms: { name: 'Proton torpedoes', line: 'ordnance', index: 2, ammo: 2, max: 4, filling: 0.5 }`. Expect:
    - `.hud-arms[data-on]` and `data-line` `'ordnance'`
    - the name written
    - the third `.hud-arms-line` lit and the others not
    - pips 0–1 `data-full`, pip 2 `--fill` `'0.50'`
    - pips 4–7 `hidden`
  - `hides the arms with none`: `arms: null` gives `.hud-arms` without `data-on`.
  - `writes nothing that hasn't changed`: two identical `place` calls; the second sets no attribute (count calls on a spy element).
  - `vitalsPct clamps`: `vitalsPct(130, 100) === 100`, `vitalsPct(-4, 100) === 0`, `vitalsPct(1, 3) === 33`.
  - `off writes only the root`: `on: false` leaves the children untouched.

- [ ] **Step 2: Run them and see them fail**
  Run: `npx vitest run src/runtime/hud/cluster.test.js`
  Expected: FAIL, cannot resolve `./cluster`.

- [ ] **Step 3: Implement `cluster.js`.** Follow `galaxy/cluster.js`'s shape: writers made once, and `put(el, key, value, write)` comparing a cached number or string. Elements are looked up again only when `root` changes. Arms values compare as whole numbers, with filling to hundredths.

- [ ] **Step 4: Run them and see them pass**
  Run: `npx vitest run src/runtime/hud/cluster.test.js`
  Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "The HUD kit's flight-cluster writer: vitals and arms, written only when they change."`

### Task 2: The kit's cluster parts and their stylesheet

**Files:**
- Create:
  - `src/runtime/hud/Cluster.jsx`, `Vitals.jsx`, `Arms.jsx`, `Powers.jsx`
  - `src/runtime/hud/cluster.css`
- Modify:
  - `src/runtime/hud/index.js` (export the four parts, `createFlightCluster` and `PIPS`; import `./cluster.css`)
  - `src/runtime/hud/parts.test.jsx`

**Interfaces:**
- Consumes: Task 1's class names and `PIPS`.
- Produces:
  - `<Cluster rootRef className label over>{children}</Cluster>` renders `div.hud-cluster[role=group][aria-label]`, with `over` (a node) in `div.hud-cluster-over` and children in `div.hud-cluster-row`.
  - `<Vitals label icon className>{children}</Vitals>` renders `div.hud-glass.hud-vitals-block`, holding:
    - a `.hud-line` with the icon, `span.hud-label` and `b.hud-vitals-n`
    - `span.hud-bar.hud-vitals > span`
    - the children (more lines)
  - `<Arms className keys>` renders `div.hud-glass.hud-arms[aria-hidden]`, holding:
    - a `.hud-line` with `b.hud-arms-name` and, when `keys` is true, the caps `R` and `1 2 3`
    - `span.hud-arms-lines` with three `i.hud-arms-line`
    - `span.hud-arms-rack` with `PIPS` × `i.hud-arms-pip`
  - `<Powers slots barRef onPress placement data>` takes `slots: [{ slot: 'primary' | 'ultimate', id, name, short, about, key, icon }]` and renders `PowerBar`'s markup with kit classes:
    - `div.hud-powers[data-place]`, holding `button.hud-power[data-slot][data-power][data-phase]`
    - inside each button: `.hud-power-icon` (the given `icon` node in its svg), `.hud-power-name`, `.hud-power-state`, `.hud-power-key > kbd.hud-cap` and `small`
    - `data` is spread on the root as `data-*` attributes (the galaxy passes `ship`)
    - it renders nothing when `slots` is empty

- [ ] **Step 1: Write the failing tests** in `parts.test.jsx`:
  - `the cluster holds its row and what goes over it`: `renderToStaticMarkup(<Cluster label="Flight" over={<i id="o" />}><b id="c" /></Cluster>)` contains `role="group"`, `aria-label="Flight"`, `id="o"` inside `hud-cluster-over` and `id="c"` inside `hud-cluster-row`.
  - `vitals reads its label and keeps its extra lines`: label `'Deflectors'`, with a child `<span className="x" />`; the text includes `Deflectors`, and the markup includes `class="x"`.
  - `arms draws three lines and eight pips`: count `hud-arms-line` = 3 and `hud-arms-pip` = 8; with `keys`, the text includes `R` and `1 2 3`.
  - `powers draws a tile per slot, key first in its label`: two slots give two `hud-power` buttons with `aria-label="Force Focus (G)"` and `data-phase="ready"` on primary, `data-phase="charging"` on ultimate; `slots={[]}` renders `''`.

- [ ] **Step 2: Run them and see them fail**
  Run: `npx vitest run src/runtime/hud/parts.test.jsx`
  Expected: FAIL on the missing imports.

- [ ] **Step 3: Implement the four parts.** `Powers` takes `PowerBar.jsx`'s markup and handlers verbatim (pointer-down press, keyboard click via `e.detail === 0`, context menu prevented), with the class prefix `hud-power`.

- [ ] **Step 4: Write `cluster.css`.** It is the generic half of `galaxy/flight.css`, plus all of `universe/powers.css`, renamed `.fc*` to `.hud-*` and `.ship-power*` to `.hud-power*`:
  - **Tokens with the galaxy's values as defaults:** `--hud-cluster-glass: rgb(3 6 14 / 0.8)`, `--hud-cluster-line: rgb(127 214 255 / 0.28)`, `--hud-cluster-ink: #e8f4ff`, `--hud-cluster-left: 16px`, `--hud-cluster-right: 16px`, `--hud-vitals-fill: linear-gradient(90deg, #4fd2ff, #9ef3ff)`, `--hud-power`.
  - **Arms:** the name coloured by `data-line` (secondary `#9fd8ff`, ordnance `#ffc070`, from `universe.css`'s readout), the lit line mark in the cluster's ink, and pips styled as `universe.css`'s `.universe-arms-pip`.
  - **Phones:** the `@media (pointer: coarse), (max-width: 767px)` rules come with it. On a phone the cluster shows only its first child block and the vitals, and `.hud-arms` is hidden: the world's Weapon button stands in.
  - **Never** use `backdrop-filter`, and add no `kbd` rule.

- [ ] **Step 5: Run the tests and see them pass**
  Run: `npx vitest run src/runtime/hud`
  Expected: PASS.

- [ ] **Step 6: Commit**: `git commit -m "The HUD kit's flight cluster: Cluster, Vitals, Arms and Powers, with one stylesheet."`

### Task 3: The galaxy flies on the kit's cluster

**Files:**
- Modify:
  - `src/components/galaxy/FlightCluster.jsx` and `FlightCluster.test.jsx`
  - `src/components/galaxy/cluster.js` and `cluster.test.js`
  - `src/components/galaxy/flight.css`
  - `src/components/universe/PowerBar.jsx`
  - `src/components/galaxy/powers.js` (the bar writer's selectors only)
  - `src/components/galaxy/scene.js` (the line that calls `cluster.place`)
- Delete: `src/components/universe/powers.css` (moved into the kit)
- Modify the check scripts: `scripts/galaxy-hud-check.mjs`, `scripts/galaxy-hud-check/*.mjs` and `scripts/galaxy-powers-check.mjs` (selectors `.ship-power` becomes `.hud-power`; `.fc-ship` stays, as a class the galaxy puts on its `Vitals`)

**Interfaces:**
- Consumes: Task 2's parts and Task 1's `createFlightCluster`.
- Produces:
  - `PowerBar({ ship, reduced, barRef, onPress, placement })` keeps its signature. It renders the kit's `Powers`, with `slots` built from `powersOf(ship)`, `POWERS` and its own `ICONS`, and `data={{ ship }}`.
  - The galaxy's `createCluster().place(root, v)` keeps its `v` and gains `v.arms`. It writes speed, kills, target and buffs itself, and hands `{ on, vitals: { value: shield, max: 100, low }, arms }` to a `createFlightCluster()` it holds.

- [ ] **Step 1: Shoot the galaxy before.**
  Run: `npm run build && node scripts/autopilot-check.mjs --routes /galaxy --before`
  Expected: screenshots saved. Note their paths for Step 7.

- [ ] **Step 2: Update `cluster.test.js`**. Its parts list gains the kit's (`.hud-vitals`, `.hud-vitals-n`, `.hud-arms`, `.hud-arms-name`, plus three `.hud-arms-line` and eight `.hud-arms-pip` through `querySelectorAll`). Its assertions on `.fc-shield`/`.fc-shield-n` become assertions on `.hud-vitals`/`.hud-vitals-n` with the same values (`'82%'`, `'0.82'`, low flag). Add `writes the primary line`: `v.arms = { name: 'Laser cannons', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 }` writes the name, and every pip is hidden.

- [ ] **Step 3: Run it and see it fail**
  Run: `npx vitest run src/components/galaxy/cluster.test.js`
  Expected: FAIL on the vitals assertions.

- [ ] **Step 4: Rebuild `FlightCluster.jsx` on the kit.** It becomes `<Cluster className="fc" rootRef label="Flight" over={buffs}>`, holding, in this order:
  - the radar canvas
  - `<Vitals className="fc-ship" label="Deflectors" icon={<RiShieldLine …/>}>` with the speed and kills lines as its children
  - `<Arms keys />`
  - the target glass
  - `<PowerBar placement="cluster" />`

  Then:
  - `galaxy/cluster.js` delegates the vitals and arms as above.
  - `galaxy/scene.js`'s call passes `arms: { name: arsenalOf(state.kind).names[0], line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 }`. `arsenalOf` comes through `universe/shared/flying.js`; add it to that face and its test. Pull request 2 replaces this with the armoury's view.
  - `galaxy/powers.js`'s bar writer reads `.hud-power-state` and `small` under `[data-slot]`.
  - `flight.css` keeps only the galaxy's skin and its own blocks. It sets `--hud-cluster-left: var(--fc-left)` and `--hud-cluster-right: var(--fc-right)` on `.galaxy-page`, and keeps the radar, speed, target and buff rules.

- [ ] **Step 5: Run the galaxy's and the kit's tests**
  Run: `npx vitest run src/components/galaxy src/runtime/hud src/components/universe/shipPowers.test.js`
  Expected: PASS, with no new failures against the baseline list.

- [ ] **Step 6: Commit**: `git commit -m "The galaxy's flight cluster is built from the HUD kit's parts, its arms on it."`

- [ ] **Step 7: Shoot the galaxy after and compare.**
  Run: `npm run build && node scripts/autopilot-check.mjs --routes /galaxy --shots arsenal1-galaxy`
  Expected: the cluster is the same as before, except for the new Arms block between the ship and the target. Fix any other pixel change in `cluster.css` or `flight.css` before going on.

### Task 4: The universe map flies on the same cluster

**Files:**
- Modify:
  - `src/components/universe/UniverseMap.jsx` (remove the `shield` and `arms` divs and refs; add the cluster)
  - `src/components/universe/scene.js` (`placeShield` and `placeArms` become one `placeCluster`, using a writer made once)
  - `src/components/universe/universe.css` (remove the `.universe-shield*` and `.universe-arms*` rules, about lines 346–380 and 438–478)
  - `src/components/universe/hud.css` (the map's skin of the cluster)
  - `src/components/universe/module.js` (if it lists `shield`/`arms` props)
- Create: `src/components/universe/clusterView.js` and `clusterView.test.js`

**Interfaces:**
- Consumes: `createFlightCluster` (Task 1); `Cluster`, `Vitals` and `Arms` (Task 2).
- Produces: `clusterView({ flying, onFoot, view, crash, dive, frozen, armed, hunted, shield, footInfo, armory }) → v` for Task 1's `place`. It is pure, and it holds the visibility rules that `placeShield` and `placeArms` had:
  - In flight: `on` is `flying && !onFoot && view !== 'map' && !crash && !dive && !frozen`.
  - In flight, `vitals` is `{ value: shield, max: 100, low: shield < 35 }`.
  - In flight, `arms` is the armoury's view while `armed`, else `null`.
  - On foot, `on` is `Boolean(footInfo.troops.length || footInfo.health < 0.995) && !frozen`.
  - On foot, `vitals` is `{ value: footInfo.health * 100, max: 100, low: footInfo.health < 0.35 }` and `arms` is `null`.
- Produces: `armsView(armory) → ArmsView`, exported from `universe/weapons.js` (tested in `weapons.test.js`). It gives `{ name: a.name, line: a.line, index: a.index, ammo: a.ammo, max: a.ammoMax, filling: a.filling }`, with `max` 0 for a line that isn't ordnance (no rack shown).

- [ ] **Step 1: Shoot the universe before.**
  Run: `node scripts/autopilot-check.mjs --routes /universe --before`

- [ ] **Step 2: Write the failing tests** in `clusterView.test.js`:
  - flying calm: `on` true, the vitals at 100, and `arms` null until `armed`
  - flying armed: `arms.name` is the armoury's
  - the nav map, frozen, crashed and diving: each gives `on` false
  - on foot: hurt (health 0.6, no troops) gives `on` true, vitals 60 and `arms` null; well and alone gives `on` false
  - low under 35

  And in `weapons.test.js`:
  - `armsView of a fresh X-wing armoury`: `{ name: 'Laser cannons', line: 'primary', index: 0, ammo: 4, max: 0, filling: 0 }`
  - after `select(2)`, `max` is 4

- [ ] **Step 3: Run them and see them fail**
  Run: `npx vitest run src/components/universe/clusterView.test.js src/components/universe/weapons.test.js`

- [ ] **Step 4: Implement `clusterView.js` and `armsView`.** Then wire them in:
  - `UniverseMap.jsx` renders `<Cluster rootRef={cluster} className="universe-cluster" label="Flight"><Vitals label={onFoot ? 'Health' : 'Shields'} /><Arms keys /></Cluster>` where the shield div was, and passes `cluster` in the world's props in place of `shield` and `arms`.
  - `scene.js` calls `placeCluster()` where it called `placeShield()` and `placeArms()`. The siege half of `placeArms` stays, renamed `placeSiege`.

- [ ] **Step 5: The map's skin.** In `universe/hud.css`, on `.universe-page`:
  - `--hud-cluster-left: 176px` and `--hud-cluster-right: calc(var(--panel-w, 0px) + 24px)`, the galaxy's band
  - `--hud-cluster-glass: var(--hud-sheet-bg)`
  - the line in the ship's `--engine` at 0.35

  Move the `universe-shield-blink` animation onto `.hud-vitals[data-low]` under `prefers-reduced-motion: no-preference`, as the galaxy has it. Check that `.universe-hint-fly` (bottom 24 px) still reads above or beside the cluster on a tucked panel; if they meet, the hint lifts by the cluster's height via `--hud-under`.

- [ ] **Step 6: Run the tests**
  Run: `npx vitest run src/components/universe src/runtime/hud`
  Expected: PASS, with no new failures against the baseline list (`universe/foot.test.js` and `landings/*` fail there already).

- [ ] **Step 7: Shoot the universe after and look.**
  Run: `npm run build && node scripts/autopilot-check.mjs --routes /universe --shots arsenal1-universe`
  Expected: no page errors, the old left-side shield bar and readout gone, and the cluster at the bottom centre once flying.

  Then fly it in a browser (`npm run dev`, `/universe`, pick a ship, F, R, take a hit, land and walk), with these checks:
  - the cluster fades in
  - the arms show after the first shot, and R and 1 2 3 move the lit line
  - the rack fills a pip at a time
  - Health shows on foot only with trouble about
  - Fire, Boost, Weapon and View stay clear on a 390 px wide touch emulation

- [ ] **Step 8: Commit**: `git commit -m "The universe map's shields and arms are the HUD kit's flight cluster, as the galaxy's are."`

### Task 5: Prove it and hand it over

- [ ] **Step 1:** Run `npm run lint`. Expected: no errors.
- [ ] **Step 2:** Run `npx vitest run > …\scratchpad\after1.log`, then compare its `FAIL` files with `baseline-fails.txt`. Expected: no file that isn't on the baseline list.
- [ ] **Step 3:** Run `node scripts/health.mjs --check --skip build`. Expected: no budget over. `kbd-styles`, `hud-kit` and `big-files` are not up.
- [ ] **Step 4:** Commit any fixes, then write a short note in the pull request body with the before and after screenshots.
