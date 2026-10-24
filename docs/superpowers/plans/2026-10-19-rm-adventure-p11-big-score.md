# The Rick and Morty adventure, P11: Big score

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 12, *Big score*, is built and played: Heist-Con made a game (Miles Knightly's crew, then Heistotron's job against the clock while the hypnotised crew hunts), and the Vindicators' rooms as they are.

**Architecture:** Heist-Con runs on two keys `place()` already takes. The crew is a `collect` with `start` (the badge and the two recruits: it ticks nothing and only tells the place, `collected`). The job is a `sequence` with a start spot, Heistotron's plan, held till the crew's in: a new pure gate in `games/sequence.js` (`ready`, the game's own say-so, given by the stage's `collected`, dealt away by every calm; a start pressed before it is a `wait`, said as the place's `before`). Once started, the job is four booths lifted in a dealt order against a 45-second clock, each booth's red alarm lit as it's lifted (`sequence({ lamps })`), with the two recruits after Morty (`sequence.hunt`). `RmWorld.jsx` gets no lines; `stage.js` gets four. The story goes to `READY` 12.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader, Vite's `ssrLoadModule` for the check's data.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md`:
- §4: episode 12 is `task heistcon` ↑ · `task vindicators`; it unlocks `blooddome` and `evilrick`.
- §5: every game has a goal, a way to fail with a quick retry back at the way in, a win that ticks the place's task; nothing done is undone; the hotspots' lines stay as the place's colour; no new models; a game is made from the keys `place()` already takes where a mix of them is a real game.
- The index (`2026-10-19-rm-adventure.md`): P11 is "episode 12 *Big score*: Heist-Con (uses `hunt`, `collect`, `sequence`)".

**Index:** P11. What landed before: P0 #1089 to P10 #1241.

**Research:** four readers and a critic, then a design panel of three stances (minimal, player, robust) and a judge (scratch `p11/r-*.md`, `p11/d-*.md`; this plan follows `p11/d-judged.md`: the robust base with the player's booth lamps, the show's double-cross, the collect's order and the Zigerions' line, and the minimal design's unquoted `caught`).

## Global Constraints

- `READY` is 12 at the end, and lands only after Heist-Con's row is a game (today's plain collect would pass the step on three presses, and a tick never unticks).
- `RmWorld.jsx` gets no lines (2428 of 2430). `stage.js` stays under 540 (516 → 520). Every file stays under 800 (`destinations.test.js` 708 → about 765).
- No new model, audio file, library, light, `requestAnimationFrame` (58/58), `eslint-disable` (54/54) or cycle (5/5). `interiors/shell.js`, `Achievements.jsx`, `say.js`, `voicelines.js`, `vindicators*.js`, `rows1.js`, `rows3.js` and `gameGoal.js` are not touched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast. Every line said today stays word for word (Miles, his barks, the recruits, Heistotron, the booth, the badges; episode 12's intro, steps and outro). No new line is quoted or has a `who` (a quoted line would owe a voices run: new audio).
- Achievements stay where they are earned: 'The con is the heist' is earned by the job's win (`sequence.unlock`), as the vat's and the studio's are.
- Every moved test assertion stays as strict, with a sentence each in its commit (two SILENT moves at READY 12 too).

## Review Focus

1. **The chase played by hand:** do the recruits (props, gliding at 2.6 and 2.8 m/s) reach Morty at the booths, or snag on a counter, the badge table or the standing heisters; is it a chase at all against Morty's run of 7 on an 18 s route inside 45 s? If a formality, the cure is data (`s` 35, or faster hunters).
2. **The last booth lifted as a recruit reaches him:** a press is stepped the next frame; a catch in between sets `fading` and the stage drops the press, so the winning lift is lost (Gear World has the same race). Play it; say which way it falls.
3. **A phone:** the prompt card is the game's only control at every booth while the clock runs, and the meter block overlaps its head by about 14 px (P5's debt); the rooms' rows must be tappable at 360 px.
4. **Reading the room:** who's after him (the two wandering heister extras wear the recruits' models); the red lamps seen from across the hall; 'Heistotron’s plan' found 6 m from Heistotron's own prompt; the `before` note and a catch's "get Miles a crew again" understood.
5. **The retry loop's feel:** after each catch, the badge and two voiced recruits again (42 m, three presses); a quick retry inside RmWorld's 8 s guard starts the job with no alarm and no `spotted` line.

---

### Task 0: Before shots

On `main` (before Task 1), `OUT=… INFO=1 node scripts/c137-shots.mjs heistcon` against a dev server of `main`. Read Heistotron's treads against the 0.8 m stage: if they're sunk, Task 2 gives its extra `y: 0.86` at `dz: -13.4`.

### Task 1: The sequence waits for its place's say-so

**Files:** `world/games/sequence.js` and test; `world/dimensions/stage.js` (+4); `world/dimensions/place.js` (+1, the docs).

**Interfaces:**
- `newSequence({ items, order, s, start, ready = true, perks })` → a game with `ready`.
- `stepSequence(game, { use, start, ready }, dt)`: `ready` is kept once given (`ready: prev.ready || ready`, applied before the start); a start while idle with a start spot and not ready pushes `{ type: 'wait' }` and stays idle; ready, it runs as today. Header comment lines gain `ready` and the `wait` event in place.
- stage: `aired()` passes `ready: !sq.before`; after the `early` note, `if (sq.before && airing.events.some((e) => e.type === 'wait')) state.emit?.('note', { area: id, text: sq.before })`; the sequence's actions gain `...(sq.before && { collected: () => switched.push({ ready: true }) })` and the snapshot `ready: airing.ready`.
- place.js docs: "`before?`: with the place's `collect` `start`ed (sharing the task, ticking nothing), the countdown waits for it, and the start spot says `before` till then."

- [ ] **Step 1:** `sequence.test.js`: the first test's `toMatchObject` gains `ready: true` (the default); new 'holds the countdown till the place says it’s ready, a start before then only saying so': unready + start → idle, `left` untouched, `[{ type: 'wait' }]`; a set used then → `[{ type: 'early', id }]`; `{ ready: true }` with 5 s → idle, ready, `left` untouched, no events, kept through a plain step; a start then → `[{ type: 'start' }]`; `{ ready: true, start: true }` in one step runs; a fresh unready game is unready; a lost game given both is unchanged with no events.
- [ ] **Step 2:** FAIL. **Step 3:** implement `sequence.js`, then the stage and place.js lines. **Step 4:** `npx vitest run src/components/rickmorty/world/games`: PASS. **Step 5:** commit.

### Task 2: Heist-Con's job

**Files:** `world/dimensions/rows2.js` (Heist-Con's row), `world/dimensions/heistcon.js` (the booths' lamps, the header), `world/RmHud.jsx` (the `safe` icon: `RiSafe2Line` in the `react-icons/ri` import and `METER_ICON`, two lines edited, none added), `destinations.test.js`, `gameGoal.test.js`, `scripts/rm-story/places.test.mjs`.

The row (kept word for word: id, name, note, kind, sizes, Miles and his barks, the four extras, the solids, `kinds`, every `say` entry there today):
- `const low = (l) => l[0].toLowerCase() + l.slice(1);` under the import, as rows1.js has it.
- people: Miles unchanged; `{ id: 'heister-a1', who: 'heister-a', dx: 6, dz: 2, face: W, ai: { wander: [[6, 2], [7.6, 2.8], [6.8, 3.8]], speed: 0.8, pause: 4, hunt: { speed: 2.6, catchR: 1.2, until: 'heistcon' } } }`, `{ id: 'heister-b1', who: 'heister-b', dx: -7, dz: 3, face: E, ai: { wander: [[-7, 3], [-8.6, 3.8], [-7.8, 4.8]], speed: 0.9, pause: 3, hunt: { speed: 2.8, catchR: 1.2, until: 'heistcon' } } }`.
- spots: today's (the cat burglar's at (−7, 3)); new `heistbooth` 'The gadget booth' (14, 10) 'Lift' r 1.8; `heistplan` 'Heistotron’s plan' (6, −10.6) 'Start the job' r 1.8; `heisthire` 'The hiring booth' (−14, 10); `heistskull` 'The skull booth' (14.6, −10); `heistcars` 'The getaway booth' (−14.6, −10); all r 1.8, verb 'Lift'.
- task: `{ id: 'heistcon', name: 'Run the job at Heist-Con', hint: 'Dial Heist-Con on the portal gun, take a badge and recruit a muscle and a cat burglar for Miles Knightly, then start the job at Heistotron’s plan and lift from the four booths in the order the meter gives before the keynote ends, with your own crew after you.' }`.
- say, new: `heistplan` 'Heistotron’s plan for the hall, taped to the edge of the stage: four booths circled in red, in an order of its own.'; `heisthire` 'A board of crews for hire, and Miles Knightly’s name is scrawled across every card on it.'; `heistskull` 'A crystal skull in a glass case, and the Zigerion minding it keeps a spare under the counter.'; `heistcars` 'Getaway cars sold from a brochure, and somebody has left a set of keys on the counter.' (all `who: null`).
- `collect: { task: 'heistcon', spots: ['heistbadge', 'heister-b1', 'heister-a1'], start: true }`.
- `sequence: { task: 'heistcon', start: 'heistplan', items: ['heistbooth', 'heisthire', 'heistskull', 'heistcars'], need: 4, s: 45, hunt: true, who: null, unlock: 'heistcon', before: 'Miles won’t start the job without his crew: take a badge, then recruit a muscle and a cat burglar.', early: 'The job hasn’t started yet: start it at Heistotron’s plan by the stage.', spotted: 'Heistotron’s plan was a double-cross: it’s hypnotised your crew, and they’re coming for you.', lost: 'The keynote ends and the lights come up before the job’s done: back to the door, and get Miles a crew again.', words: { next: (l, on, n) => \`${on} of ${n} lifted: next, ${low(l)}\`, dark: (l) => \`Wrong booth, and the Zigerions take it all back: start again with ${low(l)}\`, again: (l) => \`That one’s lifted already: next, ${low(l)}\` }, meter: { title: 'The job', label: 'Time', icon: 'safe' } }`.
- `caught: 'Glassy-eyed, the recruit you signed up for Miles marches you back to the door and tears up your badge.'`; `goal: 'heistplan'`; `done` and `unlock` `{}`.

The builder: the booth loop carries each set id (`['heistbooth', 15, 12, Math.PI]`, `['heisthire', -15, 12, Math.PI]`, `['heistskull', 17, -10, -Math.PI / 2]`, `['heistcars', -17, -10, Math.PI / 2]`); each booth gains a red alarm glow over its back board (`glow(BOX, 0xff3a3a, 1.6, 0, 2.72, -1.1, 0, 0.9, 0.2, 0.14)` into a list of its own, merged into its own `MeshBasicMaterial` mesh, `color.setScalar(0.15)` to start), `S.sequence({ lamps })` before `S.people()`.

Moved test assertions (each as strict):

| where | old | new |
| --- | --- | --- |
| `destinations.test.js` sequence places | `['gearworld', 'cablestudio']` | `['gearworld', 'heistcon', 'cablestudio']` |
| the start branch | `early` pinned | adds `Boolean(sq.before) === Boolean(d.collect?.start)`; with `before`, one sentence, `d.collect` `toMatchObject({ task: sq.task, start: true })`, no `escape` on it |
| the no-start branch | no start spot, no `early`, goal a set | adds `sq.before === undefined`, `!d.collect?.start` |
| the hunter rule | people only, no-start branch only | after the if/else: people and extras, both branches, plus `hunters.length > 0 === Boolean(sq.hunt)` |
| "only the game ticks its task" | `expect(d.collect?.task).not.toBe(sq.task)` | `if (!d.collect?.start)` it; a `start` collect may share the task (it ticks nothing, RmWorld's `COLLECT` `start` branch), as Evil Rick's does |

- [ ] **Step 1: Write and move the tests.** `destinations.test.js`: the moves above, and `describe('Heist-Con')`: 'is Miles Knightly’s job: his crew first, then Heistotron’s plan, four booths lifted in an order dealt each run, forty-five seconds, the crew after him' (collect `toEqual`; sequence `toMatchObject` with `order` undefined; the five strings; the three words on samples, `next('The gadget booth', 1, 4)` → '1 of 4 lifted: next, the gadget booth', `dark('The skull booth')`, `again('The hiring booth')`; the meter; `[goal, done, unlock, spotted]` → `['heistplan', {}, {}, null]`; the task; the five new spots' `[label, verb, dx, dz, r]`; the four new lines and the six kept lines and Miles's barks word for word; `kinds`) and 'sets Miles’s crew on him once the job’s on: the two recruits, kept by their spots, clear of the plan and every booth' (exactly the two hunters at 2.6 and 2.8, verb 'Recruit', a `say.who`; every wander point within 2.1 m of his own spot and at least 7.4 m from the plan and each booth). `gameGoal.test.js`: 'walks him round Heist-Con’s crew first, then to Heistotron’s plan, then booth by booth; round the crew again after a catch' (badge → cat burglar → muscle → plan → `order[on]` → badge again with `used` empty → null lost → null done). `places.test.mjs`' `USED`: Heist-Con's eight and the Vindicators' `saw`.
- [ ] **Step 2:** FAIL. **Step 3:** the row, the builder, the icon. **Step 4:** `npx vitest run src/components/rickmorty scripts/rm-story`: PASS. **Step 5:** commit.

### Task 3: The guide tips Heist-Con

**Files:** `guide/c137.js`, `guide/pages.test.js`.

The tip, on the end: `['Heist-Con', 'Miles Knightly won’t start the job without a crew: take a badge at the table by the door, then recruit a muscle and a cat burglar. Start the job at Heistotron’s plan by the stage and lift from the four booths in the order the meter gives; at a wrong booth the Zigerions take it all back. Heistotron never plays it straight, so watch your crew: caught or out of time, you’re back at the door to find a crew again.']`. The tail moves from the last four to the last five (`…, 'Pluto', 'Heist-Con'`), and a new test pins its words (`/badge/`, `/muscle and a cat burglar/`, `/Heistotron’s plan/`, `/order/`, `/wrong booth/`, `/watch your crew/`, `/back at the door/`, no `!`).

- [ ] Steps: test, FAIL, tip, PASS, commit.

### Task 4: The adventure at READY 12

**Files:** `adventure/episodes.js:21`; `episodes.test.js`, `story.test.js`, `hud.test.js`, `adventure.test.js`, `StoryList.test.jsx`, `EpisodeCard.test.jsx` (the story reader's patch, `p11/r-story-ready12.patch`, re-read against the branch).

The frontier's moves: 'the first twelve ready' (`READY` 12) and a new 'goes on with Big score'; `blooddome` and `evilrick` on 'Opens after episode 12, “Big score”.'; the real story walks on: the sector's last part gives `[done 10, episode 11]`, Heist-Con and the Vindicators open, the last two shut, Heist-Con gives `[step 11 1]`, the Vindicators `[done 11]` and every place opens; a new 'counts Heist-Con done early, and opens episode 12 at the Vindicators'; `markedTask` at 12 is the checklist's, at 11 heistcon then vindicators; nothing locked at 12; after episode 11, 30 open and two on episode 12's note; '30 of 32' at 11, '32 of 32' at 12; the store's `jump(11)` leaves Blood Dome shut (SILENT), `jump(12)` opens it, `jump(99)` stays at 12; intro at 12 is null; a P10 finisher gets card 11; a new 'opens episode 12 for a visitor who finished episode 11 before it was built'; the Story tab's every built episode done is twelve ticks (SILENT), and a new 'ticks the Vindicators done before Heist-Con comes up'; 'names episode 12 too'.

- [ ] Steps: the tests moved (FAIL at READY 11), `READY = 12`, PASS, commit with a sentence per moved assertion. After Task 2, never before.

### Task 5: The story check plays episode 12

**Files:** `scripts/rm-story/helpers.mjs` (lift `dial`, `home`, `notDone`, `ticked`, `low`, `CABLE` from `sector.mjs`; `import { home as homeAt }` from places.mjs; `SCORE = EPISODES[11]`; `export { ROOMS } from …/vindicatorsRules.js`), `places.mjs` (`roomsSay` from `say.js`'s `ROOMS_SAY` through Vite), `sector.mjs` (its tails: `episode-11` ends on card 12, at 11.0, the sector's unlocks open and episode 12's shut, the line Heist-Con's with no link, the marker on the garage portal; `sector-page`: card 12 on Squanch's own page straight after Morty's line, C-137 then card 12 again on its fresh load, Heist-Con's line, Morty's line not said again), new `score.mjs` (`SCORE_CHECKS`: `episode-12`, `score-returner`, `score-backwards`), `rm-story-check.mjs` (registration, header).

`episode-12` (fresh): `playTo(11)`; the frontier (opens, line, no link, garage marker, Blood Dome won't dial); Heist-Con before anything (badge marked, no meter, no hunt); the plan before the crew (`before`, idle, unready); a booth before the job (`early`); the crew alone ticks nothing (`notDone`), ready, the plan marked; home mid-crew and mid-job (unready, no hunt, no meter); the job: `spotted`, both hunting, the meter's next, the marker on `order[0]`; a wrong booth (`dark`), one lifted again (`again`); a catch by the cat burglar (captioned, the way in, no hunt, unready, the badge marked, the plan says `before` again); out of time (`lost`); the win (done, 'The con is the heist' earned, no hunt, no meter, at 11.1, the Vindicators' line, Heist-Con's portal marked, Blood Dome still shut); Rick's rooms played for real (room 1 by keys, room 2 wrong by click: `lost`, retry, Esc mid-trial keeps the room, the rest by clicks; the win: done, achievement, Rick's closing line, no card, at 12.0, every place open); home: the checklist's line; Blood Dome and Evil Rick dial.
`score-returner` (an old save with `heistcon` ticked): card 12, at 11.1, the Story tab ticks Heist-Con, the achievement on the visit, the game at rest (no meter, no hunt, the plan starts nothing and says nothing), the Vindicators end the episode.
`score-backwards` (the Vindicators done first): at 11.0 on Heist-Con's line, the Story tab ticks the Vindicators only; Heist-Con's win ends the episode.

- [ ] **Step 1:** write them. **Step 2:** run against the dev server: PASS; each new assertion checked to bite by mutation (the collect's `start` dropped; `before` dropped; the gate off in `aired`; `collected` left out; the calm keeping ready; the `wait` note left out; `sequence.hunt` off; `unlock` null; READY left at 11; the card dropped on planet pages). **Step 3:** commit.

### Task 6: Shots, the hand-off and the index

**Files:** `scripts/c137-shots.mjs` (a stand `heistplan: { area: 'heistcon', at: [-394, 2790.2, -N], cam: [0, 0.35] }`), `docs/superpowers/HANDOFF-worlds.md` (episode 12's paragraph; 'P11 in, P12 next'; the debts), the index (`:3`), delete P10's plan.

- [ ] Shots after (`heistcon`, `heistplan`), `INFO=1` at low under the 0.8M cap; hand-off; commit.

### Task 7: Prove it, review, PR, merge on green

- [ ] `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` (`git checkout public/github.json` if the build touched it); the full story check in batches; one fresh review (the Review Focus above, deliberately); one fix pass, each fix red to green; one PR; merge on green.
