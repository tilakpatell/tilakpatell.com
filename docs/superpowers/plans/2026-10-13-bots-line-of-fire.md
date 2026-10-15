# A round's bots and their line of fire on the real ground: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This one is a fault to find before it is a change to make: superpowers:systematic-debugging governs it, and no fix is written before Task 2's cause is written down.

**Goal:** On Hoth's own ground a round's bot has a line of fire whenever the ground between it and its target truly leaves one, so the battle is fought and not walked.

**Architecture:** The game's rule for when an AutoPlayer may fire is already ported and is not what is wrong (`src/lib/battlefront/ai/autoPlayer.js`: `mayFire`, `lofStep`; the code's reading is in `src/data/bf2017/NOTES.md`, "The AutoPlayers"). What answers "is the line clear" on the page is the sim's navgrid, built from the level's heights and its mask. The work is to find which part of that answer says no on real ground, fix that part, and pin it with a test on Hoth's own grid.

**Tech Stack:** plain JavaScript in `src/lib/battlefront/` (no three.js, no DOM there: the game design's rule), vitest, a Playwright probe against the dev server for the page's numbers.

**Spec:** `docs/superpowers/specs/2026-10-13-gpu-site-and-guest-heroes-design.md`, section 7 ("on the level's real ground a round's bots seldom have a line of fire"); the owner, 2026-10-13: "fix all of this".

## Global Constraints

- The symptom as the sim lane reported it: about one in three of the bots within 60 m of an enemy has a line of fire on the page; on flat ground in the sim the same bots fire about 850 shots a minute.
- `src/lib/battlefront/` stays pure: no three.js, no DOM.
- The game's own firing rule is not loosened to make bots shoot. If the evidence says the rule's port is at fault, that is a finding to report with its evidence, not a number to tune.
- A bot must not gain a line of fire through a hill, a rock or a wall. Every fix carries its negative test.
- Every number that enters a data file names its source; one set by hand carries `"source": "hand"` and a line in `src/data/bf2017/NOTES.md`.
- Before the branch is done: `npm run lint`, `npx vitest run src/lib/battlefront src/components/battlefront`, `npx vite build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

- Two soldiers on one slope, both standing: the straight line between their chests runs above the ground the whole way and must be clear.
- A soldier below a crest and one beyond it: not clear.
- A line that crosses a masked cell (a rock, a building): not clear, at any height the mask stands for.
- A line that leaves the grid, or ends in a cell with no height: the answer the code gave before this change, unchanged.
- A crouched soldier: the line starts from the crouched eye, not the standing one.

---

### Task 1: The symptom, measured twice

**Files:**
- Create: `.scratch-check/lof-probe.mjs` (git-excluded: the page's numbers)
- Test: `src/lib/battlefront/nav.lineOfFire.test.js`

**Interfaces:**
- Produces: `lofProbe` output, one JSON line: `{ bots, within60, withLine, shotsPerMinute, why: { heights, mask, offGrid, other } }`; and a test helper `hothGrid()` that loads the same grid the page gives the sim.

- [ ] Find how the page builds the sim's nav for Hoth (`src/components/battlefront/battle.js`, `module.js`, the data under `src/data/bf2017/maps/`) and what `lineClear` reads from it (`src/lib/battlefront/nav.js`). Write the chain down in the report, file and line.
- [ ] Write `hothGrid()` in the test file so the test asks the same question of the same data, with no page.
- [ ] Write `lof-probe.mjs`: the dev server started with `--mode bucketcheck`, an Instant Action round on Hoth at 13 a side (`world.do('round', …)`), run for 90 s of game time; every second, for each bot with an enemy within 60 m, record whether the sim's own line test passes, and count shots. Print the line above.
- [ ] Run it three times; put the three lines in the report. This is the "before".

### Task 2: The cause, written down before any fix

**Files:**
- Modify: `src/lib/battlefront/nav.lineOfFire.test.js`

- [ ] In the test, sample 1,000 pairs of standing places on Hoth's open ground, 10 to 60 m apart (seeded), and for each compare `lineClear` with a reference: the segment between the two chests marched in steps of a quarter cell against the grid's bilinear height. Count where they disagree, and by which part of `lineClear`'s answer (height sampling, the mask, the end points' own cells, the eye height, the step).
- [ ] State the cause in one sentence in the report, with the counts that show it, and the sentence "I think X is the root cause because Y". If the reference and `lineClear` agree and the bots still do not fire, the fault is upstream (who the bot targets, where it stands, the firing rule's port): follow it there, with the same discipline, and say so.

### Task 3: The fix, test first

**Files:**
- Modify: the one file Task 2 names (expected: `src/lib/battlefront/nav.js`, or the page's grid builder)
- Test: `src/lib/battlefront/nav.lineOfFire.test.js`

- [ ] Write the failing tests: the five lines of Review Focus as five tests on small hand-made grids, and one on Hoth: agreement with the reference on the 1,000 pairs of at least 0.95, and no pair the reference calls blocked that `lineClear` calls clear.
- [ ] Run them; see them fail for the reason Task 2 named.
- [ ] Make the one change. Run the tests; then `npx vitest run src/lib/battlefront` whole.
- [ ] Commit.

### Task 4: The page, after

- [ ] Run `lof-probe.mjs` three times on the fixed build; put before and after side by side in the report and in the pull request's text.
- [ ] If shots a minute on the page are still far under the flat-ground figure with the line now clear, say what the next cause is and stop: that is a second fault and gets its own Task 2, not a guess.
- [ ] Add what was found to `src/data/bf2017/NOTES.md` under "The AutoPlayers". Run the Global Constraints' checks. Push the branch and open a draft pull request; do not merge.
