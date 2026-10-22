# The Rick and Morty adventure, P8: Fairy tales

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 9, *Fairy tales*, is built and played. Fantasy World becomes a game on the new `climb` kind: past the stairs that bite (three Stair Goblins, each a flight of three steps, biting in turn), then up the beanstalk's shoots to its crown, level with the giants' cloud, where a giant waits. Froopyland's step (get to Tommy past the Froopylanders) is played as the place already plays it.

**Architecture:** A place's solids may carry a `top` and `ledge: true`. `rules.js` passes them through to the walker, and a ledge is stood on however high it is, as long as it's reached one hop at a time. C-137's own rooms keep the old reach (`CLIMB`). Fantasy World's ledges come from a pure, import-free generator, `dimensions/beanstalk.js` (the goblins' treads cut to the model's own three steps, the landings, a bridge shoot, two rings of shoots round the stalk, the crown). `climb` is a pure, import-free rule in `world/games/climb.js`. The stage steps it in the place's update on Morty's own position, as it steps `freeze` (`state.morty`). It wins through `done`, with the place's achievement, and loses through `caught` (a bite), both of which RmWorld already handles. Its HUD is the one meter under a sixth title, and the map's marker follows it through `gameGoal`.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader, Vite's `ssrLoadModule` for the check's data.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md`:
- §4: episode 9 is `task fantasy` ↑ · `task froopyland`.
- §5, Fantasy World: "past the stairs that bite, up the beanstalk to the giants", on a new `climb`: "solids with a `top` that Morty walks on, as the stoop is (`rules.js` `STOOP`)".
- §5, every game: a goal, a way to fail with a quick retry, and a win that ticks the place's task as today. Failing puts Morty back at the place's way in, as `caught` does, and nothing done is undone. The hotspots' lines stay as the place's colour. Each new kind takes `perks`, all at zero.
- §5, Bird World (P10) is `climb` + `collect`, so the ledges must work without the game.

`docs/superpowers/specs/2026-10-21-rm-worlds-not-rooms-design.md`:
- Fantasy World's row: Stair Goblins on the tavern's steps; the giants' castle on a cloud at the beanstalk's top.
- "growing a box is left for a place whose game needs room (Fantasy World's climb in P8)". This plan keeps the box.

**Index:** P8. What landed before: P0 #1089 to P7 #1170.

**Research:** five readers and a critic (scratch `p8/research.json`). Then a design panel: three stances, three judges and a synthesis, whose layout was checked against the real `rules.js` through Vite with an in-memory patch (scratch `p8/panel.json`, `p8/panel/final/`).

## Global Constraints

- `READY` is 9 at the end. Episode 9's data in `episodes.js` stays as written.
- `RmWorld.jsx` gets one call-site argument: the `gameGoal` call gains `climb: d.climb && act(to, 'climb')`.
- `scene.js` gets one edited line, the hotspot pin's height `2.3 + (spot.y ?? 0)`. It gains no line (988).
- No new `requestAnimationFrame` (loops stay 58/58), no `eslint-disable` (54/54) and no new import cycle (5/5): `climb.js` and `beanstalk.js` import nothing.
- No file past 800 lines: `stage.js` goes from 441 to under 500, `rows1.js` from 606 to under 640, and each new file stays under 250.
- No new models and no new audio files:
  - The goblins are the three already in the square, moved and resized.
  - The second giant is the giant model stood on the cloud.
  - The shoots, the crown and the tip are code, as the beanstalk already is (no beanstalk, leaf or cloud model exists).
  - The bite is heard through the catch the place already has.
- The frame at low stays under the 0.8M-triangle cap (Fantasy World is 477,798 today), measured with `INFO=1`.
- The box, the way in, the portal home and the `fantasy` shot's coordinates stay as they are.
- The kind takes `perks` and reads none. No earn deed. `economy.js` and the arsenal's files are untouched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast. The places' existing lines stay word for word, except Fantasy World's task name and hint, the Meeseeks' line (which said he'd done the task) and the achievement's description. All three would otherwise say something false.
- Every moved test assertion stays as strict, with a sentence each in its commit. New ids are unique across the dimensions.

## Review Focus

1. **A returner with `fantasy` done** (the Meeseeks' talk used to tick it). No meter at the foot. The goblins stand still and never bite. The achievement is handed over once on the visit if it's missing. The ledges still carry him up, but no `fell` note is said.
   - Pinned in Task 3 (the readout off once done), Task 7 (the stage skips a done task) and Task 9 (the `returner` seed).
2. **Bitten mid-climb, then back up.** The climb is dealt afresh: its clock goes back to 0, so each stair keeps still for its lag. Morty is at the way in, standing on the ground. The meter is off there and comes on again within 6 m of the foot.
   - Pinned in Task 3 (`stairPose` before the lag) and Task 9.
3. **Held (a list open, dt 0) or a long frame.** At no time nothing moves: no bite, and no change of mood. A frame counts a tenth of a second at most, so a stair can't skip its shiver.
   - Pinned in Task 3.
4. **After the win.** Walking off the crown drops him through the cloud to the ground with a thud. The game stays won (terminal) and nothing is said.
   - Pinned in Task 3 (won is terminal) and Task 7 (done skips the step).
5. **The giants' spot from below.** It can't be used from the ground or from a shoot, only from the crown. The map's pin floats over the crown, not 2.3 m off the ground.
   - Pinned in Task 6 (the reach test) and Task 7 (the pin's `y`).

---

### Task 1: The adventure at READY 9

**Files:**
- Modify `src/components/rickmorty/adventure/episodes.js:21` (`READY = 9`).
- Modify the tests that pin the frontier: `episodes.test.js`, `story.test.js`, `hud.test.js`, `adventure.test.js`, `StoryList.test.jsx` and `EpisodeCard.test.jsx`.
- Modify the story check's frontier: `scripts/rm-story/helpers.mjs` (`FAIRY = EPISODES[8]`) and `scripts/rm-story/late.mjs`'s episode-8 tail.

The edits follow P7's commit `0ae58fc77`, with every moved assertion as strict as before.

**Interfaces:** Produces `READY === 9`, and `FAIRY` in `helpers.mjs`.

- [ ] **Step 1: Write and move the tests.**
  - `episodes.test.js`:
    - 'has thirteen episodes, the first nine ready' (`READY` 9).
    - New 'goes on with Fairy tales': its steps are `['fantasy', 'froopyland']`, each a `task` at its own place, and its unlocks are `['citadel', 'frundles']`.
  - `story.test.js`:
    - The real story walks on through episode 9. Get Schwifty now ends episode 8 with episode 9's card (`[{done,7},{episode,8}]`). Fantasy World is step 1 (`[{step,8,1}]`). Froopyland ends it with `[{done,8}]` and no card, then every place is open.
    - 'crosses into episode 3' finishes episode 8 with episode 9's card, and episode 9 with both its tasks known (Rick's line, no card).
    - New 'counts Fantasy World done early, and opens episode 9 at Froopyland'.
    - `lockNote('citadel')` is 'Opens after episode 9, “Fairy tales”.'.
  - `hud.test.js`:
    - Past the last ready episode is episode 9.
    - The marker at 8.0 is Fantasy World and at 8.1 is Froopyland.
    - After episode 8 the dial opens these 22: `['annex','customs','fantasy','microverse','anatomy','needful','jerryboree','simulation','storytrain','fortress','froopyland','nimbus','gromflomites','gloopynoops','schwifty','prison','cablestudio','dream','agency','meeseeksgolf','vat','dim35c']`. `citadel` and `frundles` read 'Opens after episode 9, “Fairy tales”.'.
    - The lead at 8 reads 22 of 32, and at 9 reads 32 of 32.
  - `adventure.test.js`:
    - `jump(8)` opens Fantasy World and Froopyland, with the Citadel shut. `jump(9)` opens it. `jump(99)` stays at 9.
    - `intro()` at 9.0 is null.
    - A P7 finisher with both tasks done gets episode 9's card.
    - New 'opens episode 9 for a visitor who finished episode 8 before it was built'.
  - `StoryList.test.jsx`:
    - Every built episode done is nine ticks.
    - New 'ticks Froopyland done before its step comes up'.
  - `EpisodeCard.test.jsx`: new 'names episode 9 too'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure`.
  - Expected: FAIL, the frontier's tests only (9 assertions in 4 files, as the critic measured, plus the new ones).
- [ ] **Step 3: Implement** `READY = 9`. In the story check:
  - add `FAIRY`;
  - the episode-8 tail becomes `cardFor(8)`, `at(8, 0)`, `FAIRY.unlocks` shut and `reads(FAIRY.steps[0].text)`.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty/adventure src/components/rickmorty/world/RmHud.test.jsx`.
  - Expected: PASS.
- [ ] **Step 5: Commit**: "The adventure at READY 9: episode 9 is built", with the moved assertions listed as P7's were.

### Task 2: A place's ledges are stood on however high

**Files:**
- Modify `src/components/rickmorty/world/rules.js`:
  - `:728`: a destination's solids keep `turn`, `top` and `ledge`;
  - `:835` `standable`: true for a `ledge` at any height, with its comment.
- Modify `src/components/rickmorty/world/rules.test.js`: a new describe.

**Interfaces:**
- Produces: a destination solid `{ id, dx, dz, w, d, turn?, top, ledge: true }` or `{ id, dx, dz, r, top, ledge: true }`.
  - It is in `COLLIDERS[area]` with its `top`, `turn` and `ledge`.
  - It is never in `solidIn(area)`.
  - `supportAt(area, x, z, y)` stands Morty on it once he's within a step of its top.
- Consumes: nothing new.

- [ ] **Step 1: Write the tests.** describe 'a place’s ledges'. The rows with ledges come in Task 6, so these tests use C-137's own data and a pure check of the predicate:
  - 'keeps C-137’s reach': no collider in any C-137 area (street, house, upstairs, garage, school, arcade, basement, mindblowers, oval, diner, wong, annex) carries `ledge`. Every C-137 collider with a `top` above `CLIMB` is in `solidIn` (among them the school's chalkboard, the oval's fireplace and the arcade's cabinets).
  - 'leaves a place with no ledges as it was': every solid of a place with no ledge (Froopyland) is in `solidIn`. Task 6 asserts the ledges on `COLLIDERS` once they land.

  Then export the predicate so it's tested on its own: `standable(area, c)` becomes `export const standable`, and the test asserts:
  - `standable('street', { top: 1.5, ledge: true })` is true;
  - `standable('street', { top: 1.5 })` is false;
  - `standable('house', { top: 1.2, ledge: true })` is false, because `1.2 + 1.6 > 2.6`, the ceiling;
  - `standable('street', { top: 0.45 })` is true.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/rules.test.js -t "ledges"`.
  - Expected: FAIL (`standable` not exported; a ledge above `CLIMB` not standable).
- [ ] **Step 3: Implement** the two lines:
  - `:728`: `...d.solids.map((o) => ({ ...(o.r ? circle(o.id, o.x, o.z, o.r) : box(o.id, o.x, o.z, o.w, o.d, o.turn)), ...(o.top != null && { top: o.top }), ...(o.ledge && { ledge: true }) }))`.
  - `standable = (area, c) => c.top != null && (c.top <= CLIMB + 1e-9 || c.ledge === true) && c.top + MORTY.height <= CEILING[area] + 1e-9`, exported.
  - The comment over it gains: "(or a place's ledge, `ledge: true`: got onto from the one below it, however high: ./dimensions/beanstalk.js)".
  - A world block's `h` is never read as a top.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty/world/rules.test.js src/components/rickmorty/world/dimensions`.
  - Expected: PASS, the stoop's, the house's and the `CLIMB` pin among them.
- [ ] **Step 5: Commit**: "A place's ledges are stood on however high; C-137's rooms keep their reach".

### Task 3: The climb kind's rules

**Files:** Create `src/components/rickmorty/world/games/climb.js` and `climb.test.js`.

**Interfaces:**

Produces, pure and import-free:
- `TUNING = { still: 2.4, shiver: 1.0, bite: 0.8, lag: 1.2, edge: 0.1, level: 0.02, fall: 4, near: 6, frame: 0.1 }`.
  - A stair's beat is 4.2 s.
  - `edge` is `supportAt`'s margin (`MORTY.radius / 4`, pinned in Task 6).
- `WORDS`:
  - `still`: 'The stair’s keeping still: up you go'
  - `shiver`: 'It’s shivering: it’s about to bite'
  - `bite`: 'It’s biting: wait till it keeps still'
  - `up(m, top)`: `${m} m up the beanstalk: the giants are at ${top} m`
- `standingOn(ledges, morty) → id | null`.
  - null while `morty.air`.
  - Otherwise, the highest ledge whose `top` is within `level` of `morty.y`, with (x, z) over its footprint by `edge`:
    - a turned box: local `lx = dx·cos t − dz·sin t`, `lz = dx·sin t + dz·cos t`, `|lx| < w/2 + edge`, `|lz| < d/2 + edge`;
    - a circle: `hypot < r + edge`.
- `newClimb({ ledges, stairs = [], top, foot = null, perks } = {})` → `{ phase: 'idle', t: 0, on: null, stand: 0, high: 0, near: false, ledges, stairs, top, foot, peak, told: false, events: [] }`.
  - `stairs` is `[{ id, steps: [tread ids, bottom first] }]`.
  - `peak` is the `top` ledge's `top`.
  - `foot` is `{ x, z }` or null.
- `stairPose(g, i) → { mood: 'still' | 'shiver' | 'bite', k }`, with `τ = g.t − i·lag`:
  - `τ < 0` is still.
  - Otherwise `c = τ mod 4.2`: `[0, 2.4)` is still, `[2.4, 3.4)` is shiver, and `[3.4, 4.2)` is bite.
  - `k` is the share of the way through that mood.
- `moods(g) → { [stair id]: mood }`.
- `nextStair(g)` → the index of the first stair whose top tread is above `g.stand`, or −1.
- `stepClimb(g, { morty }, dt) → g`.
  - `t += min(dt, frame)`, in every phase.
  - Sets `on`, `stand` (`on`'s top, or 0 on the ground, or the last stand in the air), `high` and `near` (within `near` metres of `foot`).
  - idle → run on the first frame `on` is any ledge (event `start`).
  - run:
    - `on === top` → won (event `won`);
    - `on` is a tread of stair i while its mood is bite → lost (event `lost { why: 'bitten', stair: id }`);
    - back on the ground after `high ≥ fall` → event `fell { from: high }`, and `high` goes back to 0.
  - won and lost are terminal.
- `climbNews(g, { done, fading }) → 'done' | 'caught' | null`, as `sequenceNews`.
- `climbReadout(g, words = WORDS)` → `{ on: false, vitals: null, line: '' }`, unless phase is run, or phase is idle and `near`. When on:
  - `vitals` is `{ value: round(100·stand/peak), max: 100, low }`, where `low` means the next stair is shivering or biting.
  - `line` is the next stair's mood word, or once past the stairs `up(round(stand), round(peak))`.

Consumes nothing.

- [ ] **Step 1: Write the tests** (`climb.test.js`):
  - 'reads a stair’s mood on its beat': the 2.4, 3.4 and 4.2 edges; `k`; stair 2 still until 2.4 + 2.4.
  - 'stands Morty on a ledge as the walker does':
    - an unturned box, a turned box (π/4) and a circle;
    - margin 0.09 in and 0.11 out;
    - level ±0.02;
    - in the air is null;
    - two footprints at different tops: the one at his height.
  - 'starts on the first ledge, and is won on the top'.
  - 'is lost on a tread while its stair bites, and not': in the air over it, during its shiver, or on a landing beside it.
  - 'says a fall from four metres or more once, and isn’t lost by it': nothing from 3.9.
  - 'keeps won and lost' (terminal).
  - 'moves nothing at no time, and counts a long frame as a tenth of a second': `stepClimb(g, m, 0)` leaves `t`; a 5 s frame adds 0.1.
  - 'says the news once': `climbNews` for won, lost and told.
  - 'reads the meter':
    - off for null;
    - off while idle and far;
    - on while idle and near;
    - low on shiver or bite;
    - the up line past the stairs;
    - `climbReadout(null)` equals `METER_OFF`.
  - 'takes perks and reads none'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/climb.test.js`.
  - Expected: FAIL (no module).
- [ ] **Step 3: Implement** `climb.js` with a header in the other kinds' style.
- [ ] **Step 4: Run** the same.
  - Expected: PASS.
- [ ] **Step 5: Commit**: "The climb kind's rules: up the stairs while they keep still, and to the top".

### Task 4: The one meter takes the climb, and the marker follows it

**Files:**
- Modify `games/meter.js` (+test): `KINDS` gains 'climb' last; `METER.climb = { title: 'Up the beanstalk', label: 'Height' }`.
- Modify `RmHud.jsx`: `METER_ICON.climb = <RiPlantLine aria-hidden="true" />`.
- Modify `world.css`: `.rm-meter-climb .hud-vitals-n` is hidden, as the other four are.
- Modify `dimensions/gameGoal.js` (+test): a `climb` snapshot `{ phase, stand }`, read as `if (cl && climb && !done.includes(cl.task) && climb.phase !== 'lost') return climb.stand > 0 ? cl.spot : cl.foot;`.

**Interfaces:**
- Produces: `kindOf(d) === 'climb'` for a place with `climb`, and `gameGoal(d, { climb })`.
- Consumes: Task 3's readout shape.

- [ ] **Step 1: Write the tests.**
  - `meter.test.js`: the `kindOf` row, the `METER` row and the `METER_OFF` row.
  - `gameGoal.test.js`: new 'points at the stairs’ foot, then at the giants once he’s up'. Also null once done, and null once lost.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/meter.test.js src/components/rickmorty/world/dimensions/gameGoal.test.js`.
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same, plus `npx vitest run src/components/rickmorty/world/RmHud`.
  - Expected: PASS.
- [ ] **Step 5: Commit**: "The one meter takes the climb: up the beanstalk".

### Task 5: The beanstalk's ledges, as data

**Files:** Create `src/components/rickmorty/world/dimensions/beanstalk.js` and `beanstalk.test.js` (pure data checks).

**Interfaces:**

Produces, pure and import-free, in Fantasy World's own metres (dx east, dz south of its middle):
- `GOBLIN = { len: 1.054, wide: 1.0, treads: [['low', 0.59, 0.84, 0.33], ['mid', 0.36, 0.59, 0.65], ['top', 0, 0.36, 1]] }`.
  - The stair model's treads, from its back, as shares of its length, with each tread's top as a share of `h`. Decoded from the model in 20 slices; the feet strip (0.84 to 1) is left open.
- `CLOUD = { at: [-23, -31.2], y: 20, w: 28, d: 22, h: 2 }`.
  - The giants' cloud, a `dome` landmark. Its drum's top `y + 0.45·h` is 20.9.
- `CASTLE = { at: [-23, -34.5], y: 21.4, w: 10, d: 10, h: 22 }`.
- `beanstalk(opts?) → { solids, stairs, path, spots, top }`. `BEANSTALK = beanstalk()` is the layout below.
  - `solids`: each ledge `{ id, dx, dz, w, d, turn?, top, ledge: true }` or `{ id, dx, dz, r, top, ledge: true }`, plus `beanstalk-tip` `{ dx: -23, dz: -19, r: 0.5 }` (no top: in the way at any height).
  - `stairs`: `[{ id: 'g1' | 'g2' | 'g3', steps: [low, mid, top], dx, dz, h, base }]`.
  - `path`: the ledges' ids bottom up.
  - `spots`: `goblins` `{ dx: -15.8, dz: -7.49 }`, and `giants` `{ dx: -23, dz: -19, y: 20.9, r: 1.4 }`.

The layout (all ledges `ledge: true`):

| ledges | where (dx, dz) | footprint | tops |
| --- | --- | --- | --- |
| G1 (h 1.5, base 0) | x −14.3; treads at dz −8.84, −9.22, −9.69 | 1.5 wide; 0.40 / 0.36 / 0.57 deep | 0.49, 0.97, 1.50 |
| landing-1 | (−14.3, −11.12) | 2.3 × 2.4 | 2.30 |
| G2 (h 1.9, base 2.3) | x −14.3; dz −12.37, −12.86, −13.45 | 1.9 wide; 0.50 / 0.46 / 0.72 | 2.93, 3.54, 4.20 |
| landing-2 | (−14.3, −15.06) | 2.7 × 2.6 | 5.00 |
| G3 (h 2.3, base 5.0) | x −14.3; dz −16.46, −17.04, −17.76 | 2.3 wide; 0.61 / 0.56 / 0.87 | 5.76, 6.50, 7.30 |
| shoot-1 (the bridge) | (−15.16, −19.34) | 4.12 × 2.4 | 8.10 |
| shoot-2 to shoot-11 (outer ring, r 3.8–6.0, 23° apart, φ −4 to 203) | round (−23, −19), clockwise on the map | 2.44 × 2.20, turned to the ring | 8.9 to 16.1, 0.8 apart |
| shoot-12 to shoot-16 (inner ring, r 1.7–3.9, 37° apart, φ 195 to 47) | back anticlockwise | 2.52 × 2.20, turned | 16.9 to 20.1 |
| beanstalk (the crown) | (−23, −19) | r 1.8 | 20.90 |

- A ring tread's turn is `atan2(cos φ, sin φ)`, with bearing `φ = atan2(dz, dx)` from the stalk.
- Its width `2·r1·sin(a/2) + 0.05` meets the next tread at its outer edge.

- [ ] **Step 1: Write the tests** (`beanstalk.test.js`, data only, under 50 ms):
  - 'rises a hop at a time': consecutive tops along `path` rise 0.48 to 0.805, and only G1's low and mid treads are within `CLIMB` (1.11) of the ground.
  - 'touches each next ledge': each consecutive pair of footprints is within 0.05 m. No other pair is within `CLIMB` in height and 1.5 m apart.
  - 'can’t be climbed past a goblin': a hop graph (reach 3.5 m, rise ≤ 1.11) reaches the crown, and doesn't once any one goblin's treads are removed.
  - 'cuts each goblin’s treads to the model': each tread is `GOBLIN × h` on its base.
  - 'stands inside the box and clear of the village': every footprint is inside dx ±35 and dz ±25 by Morty's radius, and 0.9 m or more from the row's other solids. The row's solids are given here as the test's own list, the village's from `rows1.js` today with the privy at (−15.6, −3.5).
  - 'puts the crown level with the giants’ cloud': `top === +(CLOUD.y + 0.45·CLOUD.h).toFixed(2)`. The crown's centre is inside the cloud's disc by r − 0.6.
  - 'keeps the shoots under the cloud clear of its underside': top + 2.75 ≤ `CLOUD.y − 0.1·CLOUD.h` for each ledge under the disc.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/beanstalk.test.js`.
  - Expected: FAIL (no module).
- [ ] **Step 3: Implement** the generator from these numbers. The scratch prototype is `p8/panel/final/beanstalk.mjs`; only the final layout's parameters are kept, and the knobs nothing uses are dropped.
- [ ] **Step 4: Run** the same.
  - Expected: PASS, and the generated table matches the one above to the centimetre.
- [ ] **Step 5: Commit**: "The beanstalk's ledges as data: three Stair Goblins, two landings and the shoots round the stalk to the crown".

### Task 6: Fantasy World runs on the climb

**Files:**
- Modify `dimensions/place.js`:
  - `climb = null` in the signature, the header and the return;
  - a spot's `y` is kept, as `w` already keeps every key.
- Modify `dimensions/rows1.js`, Fantasy World's row:
  - solids: the village's own, the privy moved to (−15.6, −3.5), and `...BEANSTALK.solids` in place of the old `beanstalk` post;
  - spots: `goblins` moved to the goblins' foot; `giants` added at the crown (`y` 20.9, Talk);
  - `climb`: `{ task: 'fantasy', top: 'beanstalk', foot: 'goblins', spot: 'giants', stairs, who: null, lost, fell, unlock: 'fantasy' }`;
  - `goal: 'goblins'`, and `done`/`unlock` emptied in the same commit (or `goalOf` throws);
  - the task's name and hint;
  - the Meeseeks' line, and the giants' line.
- Modify `dimensions/worlds.js`: Fantasy World's two landmarks become `CLOUD` and `CASTLE` (style `dome` and `tower`, their looks kept), and the comment.
- Modify `src/components/Achievements.jsx:102` (the description).
- Modify `dimensions/destinations.test.js`: describe 'a place that runs on a climb'.
- Modify `dimensions/beanstalk.test.js`: the physics, on the real walker.

The lines:
- Task name: 'Climb the beanstalk to the giants'.
- Hint: 'Dial Fantasy World on the portal gun in Rick’s garage, go up the Stair Goblins by the tavern while they keep still, and climb the beanstalk to the giants.'
- `lost`: 'The stair bit you. One that shivers is about to bite.'
- `fell`: 'A long way down. Back up the stairs, then.'
- `fmeeseeks`: 'Existence is pain to a Meeseeks, Morty. Give me something to do.' This is his recorded bark, so it stays voiced, and the bark list is untouched.
- `giants`: `{ who: 'A giant', text: 'A little man, all the way up our beanstalk. Wipe your feet. And mind the edge: it’s cloud.' }`.
- Achievement: 'Mind the stairs' keeps its name; the description becomes 'Got past the Stair Goblins and up the beanstalk to the giants in Fantasy World'.
- The goblins' label and line, King Jellybean's, the tavern's, Dale's and the note stay as they are.

**Interfaces:**
- Consumes: Task 2's ledges, Task 3's `standingOn` and `TUNING`, and Task 5's `BEANSTALK`, `CLOUD` and `CASTLE`.
- Produces `destinationById('fantasy').climb`, with `stairs` as `[{ id, steps }]`, the ledges in `d.solids`, and `d.hotspots`' `giants` with `y`.

- [ ] **Step 1: Write the tests.**
  - `destinations.test.js`:
    - 'runs Fantasy World on a climb': the config; `done` and `unlock` are `{}`; `goal` is 'goblins'; every `stairs` step and `top` is a ledge; `foot` and `spot` are spots; the giants spot's `y` is the crown's top.
    - 'gives ledges to no other place'.
  - `beanstalk.test.js` 'on the walker':
    - The ledges are in `COLLIDERS.fantasy` with `top`, `turn` and `ledge`, and none is in `solidIn('fantasy')`.
    - **The exact bot.** A `stepMorty` bot runs from the goblins' spot, ledge by ledge (each goblin by its top tread, then every shoot), to the crown. At dt 1/60 and at dt 0.05 it ends on the crown at 20.9, under 20 s of game time, in under 200 ms of test time.
    - **The sloppy bot.** Over the rings, ±0.35 rad, walking and running, a 0.3 s walk-in, 5 fixed starts per tread. At least 97% of hops land, and none falls from the inner ring to the ground.
    - **Falls.** A step outward off each inner tread lands on the outer ring.
    - **standingOn against supportAt.** `standingOn(ledges, m)` agrees with `supportAt` on at least 2,000 fixed sample points (an x, z, y grid over the ledges).
    - **The edge.** `TUNING.edge === MORTY.radius / 4`.
    - **The giants spot.** It can't be reached from anywhere but the crown: the crown's r plus Morty's radius (2.2) is more than the spot's r (1.4).
    - **The flood.** A 0.5 m flood from the way in leaves no free cell cut off.
    - **The crown.** It holds Morty at 20.9 for a second.
    - **No leap.** A running hop from the ground at shoot-1 stays at 0.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions src/components/rickmorty/world/rules.test.js`.
  - Expected: FAIL (no climb on the row; the ledges aren't in the colliders).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same, plus `npx vitest run src/components/rickmorty src/components/Achievements`.
  - Expected: PASS: the worlds' rules (blocks clear of spots, landmarks over 20 m or 8 m off), the voices, names and achievements tests among them.
- [ ] **Step 5: Commit**: "Fantasy World runs on a climb: the Stair Goblins, the beanstalk's shoots and the crown by the giants' cloud".

### Task 7: The stage plays the climb, and the builder draws it

**Files:**
- Modify `dimensions/stage.js`:
  - the import;
  - setup (`cb`, `ledges`, `foot`, `climbed()`, `ascent`, `posed`);
  - `climbing(t, dt, state)`, in its own block:
    - `grant(cb, done, state)`;
    - unless done or fading: step on `state.morty`; on a `fell` event, `state.emit('note', { area, text: cb.fell })`; then `told(climbNews(…), ascent, cb, state)`;
    - then pose each stair's group from `stairPose`, or 'done' once the task's done;
  - `gameTask` gains `?? d.climb`;
  - `calm()` deals the climb afresh;
  - the update line;
  - `area.actions`: `climb` → `{ phase, t, on, stand, near, moods }`; `meter` → `climbReadout(done ? null : ascent)`; DEV `setClimb(patch)`;
  - the return gains `climb: (o) => (posed = o.stairs ?? null)`.
- Modify `dimensions/fantasy.js`:
  - the old stalk, its leaves and the goblins' hop tick go;
  - the shoots, landings and crown are drawn as green columns from the ground to their tops, each with a leaf slab flush on top: no overhang and nothing to walk under;
  - stumps under G2 and G3;
  - the tip, curling up into the cloud;
  - the goblins stood at their base and turned so their treads rise north (`onPlace` hands their groups to `S.climb({ stairs })`);
  - a giant on the cloud at (−23, −25.6), y 21.8, facing south, h 11;
  - the privy moved.
- Modify `RmWorld.jsx:265`: `climb: d.climb && act(to, 'climb')`.
- Modify `scene.js:634`: `fx.pin.userData.y = 2.3 + (spot.y ?? 0)`.

The goblins' poses are set by the stage and never through `position.y`:
- still: at rest;
- shiver: `rotation.y = rest + 0.12·sin(18πk)`, and scale x and z × (1 + 0.04·|sin 18πk|);
- bite: `q = |sin 2πk|`, scale y × (1 − 0.18q), and `rotation.y + 0.25·sin 4πk`;
- done: `rotation.y + 0.05·sin(1.5t)`.

**Interfaces:**
- Consumes: Tasks 3 to 6.
- Produces the stage's `climb` and `setClimb` actions, and `meter` for the climb (the story check and the HUD read them).

The stage has no unit test of its own (as P7's sequence hadn't). Its behaviour is proved in the browser in this task's Step 4 and in Task 9. The rules it calls are proved in Tasks 3 to 6.

- [ ] **Step 1: Write the smoke script** (scratch `p8/smoke/climb.mjs`, Playwright on the branch's dev server 5197). It goes to Fantasy World and checks:
  - at the way in, the meter is off;
  - at the foot, the meter is on with a mood line;
  - stood on landing-1 (`sim.m`), after 1 s, `climb.phase` is run and y is 2.3;
  - `setClimb({ t: 4.65 })` with Morty on g2-top: caught, back at the way in, phase idle;
  - stood on shoot-16 and hopping to the crown with real keys: `fantasy` done, with the achievement 'Mind the stairs';
  - the pin's height over the giants spot is 23.2.
- [ ] **Step 2: Run** it against `main`'s server (5199).
  - Expected: FAIL (no climb on main).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it against 5197.
  - Expected: PASS.
  - Then `npm run lint` and `npx vitest run src/components/rickmorty`.
  - Then shots (Task 9's views) to fit the goblins' treads to the model and check the coil's look. Data is tuned against a shot only through `beanstalk.js`'s numbers, with Task 5's and 6's tests kept green.
- [ ] **Step 5: Commit**: "The stage plays the climb: the stairs bite on their beat, the crown wins it, and a giant waits on the cloud".

### Task 8: Froopyland's step

**Files:** Modify `dimensions/rows2.js` (Froopyland), and a test in `destinations.test.js`.

- `unlock: { tommy: 'froopyland' }`: 'The ABC’s of Beth' has had no way to be earned.
- froopy-a #2's wander point (2, 16) becomes (8, 15). Its loop came within 2.8 m of the way in, inside its `near` of 5, so a visitor could be caught as they came through.
- Tommy's wander becomes `[[16, -14], [18, -12], [15, -11]]`, within 2.1 m of his Talk spot (it was 5 m).

- [ ] **Step 1: Write the tests.** destinations.test.js 'lets a visitor through Froopyland’s portal':
  - every hunter's wander loop stays at least its `near` + 1 from the way in, segment by segment;
  - Tommy's waypoints are within 2.1 m of his spot;
  - `unlock.tommy` is 'froopyland'.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/destinations.test.js`.
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same, plus `npx vitest run src/components/rickmorty/world`.
  - Expected: PASS: the worlds' rules (a crowd 1 m off wander routes) among them.
- [ ] **Step 5: Commit**: "Froopyland: Tommy hands over its achievement, and a Froopylander no longer waits at the portal".

### Task 9: Episode 9 in the story check, the guide and the shots

**Files:**
- Modify `scripts/rm-story/helpers.mjs`: `standOn(page, area, id, { dx = 0, dz = 0 } = {})` writes `__C137__.sim.m = { ...m, x, z, y: top, vy: 0, air: false }` at a ledge read from the data.
- Modify `scripts/rm-story/places.mjs` (+test): `ledge(area, id) → [x, z, top]`.
- Modify `scripts/rm-story/late.mjs`: an 'episode-9' scenario, built from the Task 7 smoke, then Froopyland:
  - dial; through the portal; `warpUse` 'tommy';
  - task and achievement;
  - `FAIRY.outro`;
  - `at(9, 0)`; `opens(FAIRY.unlocks)`; no `.rm-episode`.
- Modify `scripts/rm-story/basics.mjs`: the returner seeds 'fantasy'. Its climb stays idle, and there's no meter at the foot.
- Modify `scripts/rm-story-check.mjs`: the header lists episode 8's hooks and episode 9's (`__C137__.act('fantasy', 'climb' | 'setClimb')`).
- Modify `scripts/c137-shots.mjs`:
  - a view's `y` sets `sim.m.y` after `goto` (as `fly` sets `sim.c`);
  - views `beanstalk` (the foot), `coil` (on shoot-9), and `giants` (on the crown).
- Modify `src/components/guide/c137.js`: a tip, `['Fantasy World', 'The Stair Goblins by the tavern are the way up the beanstalk. Go up one while it keeps still: one that shivers is about to bite, and a bite puts you back at the portal. A fall only costs you the height. The giants are on the cloud at the top.']`.

Every write to `sim.m` is at least 0.4 m clear of a taller ledge.

- [ ] **Step 1: Write the tests.**
  - `places.test.mjs` 'reads a ledge from the data'.
  - `guide/pages.test.js`: the tip is on C-137's page.
- [ ] **Step 2: Run** `npx vitest run scripts/rm-story src/components/guide`.
  - Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same, then the check against 5197: `node scripts/rm-story-check.mjs episode-9 returner`.
  - Expected: both `ok`.
  - Then the shots before (5199) and after (5197) with `INFO=1`: the frame under the cap.
- [ ] **Step 5: Commit**: "Episode 9 in the story check, the guide's tip and the climb's shots".

### Task 10: Prove it, hand over, review, PR, merge on green

**Files:**
- Modify `docs/superpowers/HANDOFF-worlds.md`: episode 9's paragraph, P8 in and P9 next, and the follow-ups.
- Modify `docs/superpowers/plans/2026-10-19-rm-adventure.md:3`: name P8's plan.
- Delete `docs/superpowers/plans/2026-10-19-rm-adventure-p7-prime-time.md` (merged).

- [ ] **Step 1:** `npm run lint`, `npm test`, `npm run build` (then `git checkout public/github.json`), `node scripts/health.mjs --check --skip build`.
  - Expected: all green; health within budget.
- [ ] **Step 2:** `node scripts/rm-story-check.mjs` against 5197 (the full run).
  - Expected: every scenario `ok`.
- [ ] **Step 3:** A fresh review: a workflow over five dimensions:
  - the climb rule and the ledges;
  - the stage, the builder and the look;
  - integration and the story;
  - the owner's rules;
  - the docs.
  
  A skeptic then checks each finding. Re-grade by effect. Critical and Important findings get one fix pass, each fix RED → GREEN. Minors go to the ledger.
- [ ] **Step 4:** The PR (one for the phase), CI, and a merge on green.
