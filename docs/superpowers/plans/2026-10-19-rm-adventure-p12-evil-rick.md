# The Rick and Morty adventure, P12: Evil Rick

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 13, *Evil Rick*, the last episode, is built and played: the Blood Dome's duel and Evil Rick's as games that read and can be lost, the Morty with the eyepatch after Evil Rick is down, and the gun put back on Rick's bench, which ends the story with Rick's last line read in the clear.

**Architecture:** The places are already games (two duels on `npc.js`'s `hunt.duel`), so P12 mends what a player would hit on the way to the end and lands `READY` 13. A body never hunts and a place whose duellist is down hunts no more (`npc.js`). The duels' achievements are earned at last through `hunt.duel.unlock`, handed over by the stage's existing `grant` (the live win, or a returner on the visit); the lair's builder hands over the Morty with the eyepatch's the same way. He talks only once Evil Rick is down (his spot's `after`). A fight walked out of through the portal is over. The ring and the pods go from reach once used. The marker points at a `use` step's hotspot, so it leads to the bench, and the press that ends the story opens no dial over Rick's last line. A long line that ticks a task is read before the done toast covers it. The Story tab closes with a line for the Checklist. Hemorrhage is tuned so the warm-up is a fight, pinned by a sim of four ways to play it.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader, Vite's `ssrLoadModule` for the check's data.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md`:
- §4: episode 13 is `task blooddome` · `task evilrick` · `task evilmorty` · `use dial` (the gun back on Rick's bench, every coordinate home: `rules.js`'s `dial` hotspot); neither place is marked ↑.
- §5: every game has a goal, a way to fail with a quick retry at the way in, and a win that ticks the place's task; no new models.
- §7: the last episode's outro is a toast.
- The index (`2026-10-19-rm-adventure.md`): P12 is "episode 13 *Evil Rick* (all exist)".

**Index:** P12. What landed before: P0 #1089 to P11 #1243.

**Research:** four readers (the Blood Dome, the lair, the ending, the story and the check) and a critic, then a design panel of three stances (minimal, player, robust) and a judge. This plan follows the judge's synthesis: the robust base (the dead duellist mended in `npc.js`, RmWorld at +1 net, no counts in the tips, scenarios short enough to rerun), with the player design's hint by input, `PICKS` for what starts a duel and the builder's grant for Evil Morty, and the minimal design's bearing search for a firing stand. Two additions over it, from its own Review Focus: Hemorrhage's tuning (the judge's numbers were measured to lose every way in the lair, so Evil Rick keeps his, and the Blood Dome's is pinned by a sim) and the read-time hold (Evil Morty's reveal was covered at 3.2 s).

## Global Constraints

- `READY` is 13 at the end, and lands only after Tasks 1 to 8 (alone it would ship a finale where a fled fight jams the dial, the last line is under the dial and the bench has no marker).
- `RmWorld.jsx` ends at 2429 of 2430 (the flee +2, the finale −1; `PICKS`, `GOAL` and the talk's hold edited in place). `stage.js` under 540 (521 → 523). Every file under 800.
- No new model, audio file, library, light, `requestAnimationFrame` (58/58), `eslint-disable` (54/54) or cycle. `Achievements.jsx`, `duel.js`, `blooddome.js`, `gameGoal.js`, `story.js`, `guide/pages.js` (open PR #1206), `src/components/universe/economy.js`, the galaxy's planet engine and Gazorpazorp are not touched.
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast. Every line said today stays word for word (both duellists' lines and won lines, the ring's, the pods', Evil Morty's, both `caught`s; episode 13's intro, steps and outro). No new line is quoted or has a `who`.
- Achievements: 'A man now' (`blooddome`), 'Close Rick-counters' (`evilrick`) and 'The one behind him' (`evilmorty`) are earned by their tasks, and a returner gets them on the visit.
- Every moved test assertion stays as strict, with a sentence each in its commit; where an API takes the frontier (`ready`), the old assertion is kept under `ready: 12` beside the new one.

## Review Focus

1. **Both fights played by hand.** The check fires from a fresh stand each shot, so it never meets the real tension: shots fly only where Morty faces, and the HUD says keep out of reach. Can a keyboard player who never presses Tab win? Does Hemorrhage at hp 7 read as a fight and not a wall? Is Evil Rick at hp 6 still easier than the warm-up?
2. **A phone, from the ring to the bench.** 'The star fires.' shown, ✦ the fire button, Lock on as he nears; no act button at the ring mid-fight; a flee through the portal gives the chip back; at the last step the chip opens the dial without ending the story, and only the act button at the bench ends it.
3. **The ending read on screen,** desktop and 390 px: Rick's last line readable for its 5.6 s with nothing over it; clear that the story's over with no card; the next E opens the dial; the bench's prompt still says 'Dial' to a player told to "put it back".
4. **Evil Morty's twist.** Before the win he sits with no prompt and barks: does that read as "not yet"? His reveal is now held for its read time before the done toast: is it readable, and does the wait feel long?
5. **The win's moment:** the achievement, the done toast and the won line 0.9 s later together; a bolt in flight during the beaten fade can still win; a revisit in the same page load has Hemorrhage down by the gate while the ring's line speaks of a fight.

---

### Task 0: Before

Shots on `main`: `OUT=… INFO=1 node scripts/c137-shots.mjs blooddome evilrick`. Check the open PRs' files (only #1212 and #1217 on `HANDOFF-worlds.md` at other hunks, #1206 on `guide/pages.js`).

### Task 1: A duellist down stays down, and so does his place

**Files:** `world/npc.js` (in place), `world/npc.test.js`.

- `:182`: `if (!n.hunting && !n.dead && (hunting || h.always || (h.near != null && toM < h.near))) {`
- `hunt`: `hunting = on && !npcs.some((n) => n.dead); if (!hunting) for (const n of npcs) n.hunting = false;` with the comment "(… never while its duel's hunter is down: the fight was the thing)".
- The header's `duel:` line: `{ hp, mortyHp?, task, won?, unlock? }`; "stays down for the page load (never set on Morty again, nor is his place: it hunts no more)", "`unlock` its achievement, handed over by the place's stage once `task` is done" (at most one line added).

- [ ] **Step 1:** `npc.test.js`, new describe 'a duel’s hunter (Hemorrhage, Evil Rick)' (its `run` takes a `fading` option in place): 'says the fight’s on once, and strikes on its beat from the first moment Morty’s in reach, the third beating him with its line'; 'strikes nobody while the screen fades'; 'goes down at nought and stays down through a calm, where one still up goes home with his health back'; 'once he’s down, isn’t set on Morty again, nor is his place: its barks come back' (`hunt(true)` after the win leaves him and `N.hunting` false; a barker 1 m off barks in 20 s).
- [ ] **Step 2:** the last test FAILS (0 barks, both hunting). **Step 3:** the edits. **Step 4:** `npx vitest run src/components/rickmorty/world`: PASS. **Step 5:** commit.

### Task 2: Hemorrhage's fight is a fight

**Files:** new `world/dimensions/duels.test.js`; `world/dimensions/rows3.js:119` (`hp: 5` → `hp: 7`).

A sim of a duel through the real `createNpcs`, a place's own data and solids, Morty turned as the walker turns him (rate 12 towards where he walks) and by the lock-on (rate 8 towards the duellist), F fired every `every` s after 0.3 s, a bolt landing at 90 m/s; four styles: `none` (never fires), `slow` (every 1.2 s, locked), `stand` (every 0.6 s, locked, standing), `kite` (every 0.6 s, locked, stepping back at 3.6 m/s for 0.7 s whenever he's within 2.6 m). Starts: the Blood Dome `[0, -0.1]` from its centre, the lair `[-14, 4]`.

- [ ] **Step 1:** 'Hemorrhage beats a Morty who doesn’t fire or fires slowly, and loses to one who fires steadily, standing or keeping out of reach' (none and slow beaten; stand and kite won inside 30 s) and the same for Evil Rick ('…in the lair').
- [ ] **Step 2:** FAIL: Hemorrhage at hp 5 loses to `slow`. **Step 3:** `hp: 7`. **Step 4:** PASS (Evil Rick holds at hp 6 as he is). **Step 5:** commit.

### Task 3: The two rows

**Files:** `world/dimensions/rows3.js` (in place), new `world/dimensions/rows3.test.js` (imports `ACHIEVEMENTS` from `'../../../Achievements'`).

- `:15` comment: "Evil Rick at his console till the Mortys are freed; then he comes for Morty, and the fight is the thing (its achievement handed over by the stage once he's down)".
- `:16`: Evil Rick's duel gains `unlock: 'evilrick'`.
- `:17` comment: "Evil Morty, sitting in his chair at the back with his arms crossed, till he's spoken to; he talks only once Evil Rick is down (his spot's `after`), and his achievement is the builder's to hand over".
- `:26`: his spot gains `after: 'evilrick'` (the person keeps `until: 'evilmorty'` and no `after`).
- `:119`: Hemorrhage's duel gains `unlock: 'blooddome'`.

- [ ] **Step 1:** `rows3.test.js`, describe "episode 13's places": 'has two duels, Evil Rick’s and Hemorrhage’s, each its place’s task and its achievement'; 'fights Hemorrhage in the Blood Dome’s ring: “A man now” on the win, given one way' (`{ hp: 7, mortyHp: 3, task: 'blooddome', unlock: 'blooddome' }`, `acts` `{ ring: 'fight' }`, `goal` `'ring'`, `unlock` `{}`, no other game key, `blooddome` in no `done` or `unlock` map); 'sets Evil Rick on Morty once the dome’s three Mortys are free: “Close Rick-counters” on the win, given one way' (`collect` `{ task: 'evilrick', spots: ['pod1','pod2','pod3'], start: true }`, the duel `{ hp: 6, mortyHp: 3, task: 'evilrick', unlock: 'evilrick' }`, `goal` `'pod1'`, `unlock` `{}`, `done` `{ evilmorty: 'evilmorty' }`); "keeps the Morty with the eyepatch's word till Evil Rick is down, while he sits and watches" (the spot `{ verb: 'Talk', after: 'evilrick', until: 'evilmorty' }`; `nearHotspot` at his stand with `[]`, `['blooddome']`, `['evilrick']`, both → null, null, 'evilmorty', null; 'The one behind him'); 'says what it always said, word for word' (both duellists' `line` and `won.text`, the ring's, the pods', Evil Morty's, both `caught`).
- [ ] **Step 2:** FAIL. **Step 3:** the edits. **Step 4:** `npx vitest run src/components/rickmorty/world`: PASS. **Step 5:** commit.

### Task 4: The achievements handed over

**Files:** `world/dimensions/stage.js` (+2), `world/dimensions/evilrick.js` (+2). Proved in Task 10.

- stage.js: after `const rh = d.rhythm;`, `const du = d.people.find((p) => p.ai?.hunt?.duel)?.ai.hunt.duel ?? null; // (a duel's: its `unlock` handed over once its task's done)`; after the rhythm's grant, `if (du && state) grant(du, (state.done ?? []).includes(du.task), state);`; the return gains `grant`; the header and the grant's comment name the duel's.
- evilrick.js, at the top of its update: `// (the Morty with the eyepatch's achievement, once he's said his piece: on the talk, or a returner's on the visit)` and `if (state) S.grant({ task: 'evilmorty', unlock: 'evilmorty' }, (state.done ?? []).includes('evilmorty'), state);`; its header says so.

- [ ] Steps: the edits, `npx vitest run src/components/rickmorty/world`, lint, commit.

### Task 5: The marker points at the bench

**Files:** `adventure/hud.js:71` and its comment, `adventure/hud.test.js`, `world/RmWorld.jsx:234` (`GOAL` gains `dial: ['garage', 'spot:dial'],` in place).

- [ ] **Step 1:** 'marks a hotspot to use, never a talk or a walk in' (a small book: `use` → `{ id }`, `talk` → null, `enter` → null), and with `{ ready: 13 }`: `{ episode: 12, step: 3 }` → `{ id: 'dial' }`, `dialLead({ episode: 13 })` → 'Coordinates home: 32 of 32', nothing locked.
- [ ] **Step 2:** FAIL. **Step 3:** `if (part?.type === 'task' || part?.type === 'use') return { id: part.id };` and `GOAL.dial`. **Step 4:** PASS. **Step 5:** commit.

### Task 6: RmWorld and the HUD

**Files:** `world/RmWorld.jsx` (2428 → 2429), `world/RmHud.jsx` (+1). Proved in Task 10.

- `PICKS` (in place): "(a climb's things to pick up, and what starts a duel (the Blood Dome's ring, the lair's pods): gone from reach once used on this visit)" over `new Set(DESTINATIONS.flatMap((d) => [...(d.climb?.picks ?? []), ...(d.people.some((p) => p.ai?.hunt?.duel) ? [...Object.keys(d.acts).filter((k) => d.acts[k] === 'fight'), ...(d.collect?.spots ?? [])] : [])]))`.
- The flee (+2), in `go()`'s arrival block beside the calm: `s.duel = null;` then `setDuel(null);`, the comment "(what he's used is for this visit, the place he's left settles, and a fight he walked out of is over)".
- The finale (−1): `} else if (n.id === 'dial') {` then `if (!tell({ type: 'use', id: 'dial' }).some((o) => o.type === 'end')) openDial(); // (the press that ends the story puts the gun back: Rick's last line read in the clear, not under the dial)`.
- The talk's hold (in place, `:1115`): `if (TALK_DONE[n.id]) later(() => complete(TALK_DONE[n.id]), Math.max(TALK_MS, lineHold(line?.text) * 1000));` with "(done once they've had their say, a long one read first: the President gets in his car then)".
- RmHud `:217`: `{touch ? 'The star fires. Keep out of reach.' : 'F fires. Keep out of reach.'}` and `{!touch && <span className="rm-fight-hint">Tab locks on: Morty turns to face them.</span>}`.

- [ ] Steps: the edits, `wc -l RmWorld.jsx` = 2429, the Rick and Morty tests, lint, commit.

### Task 7: The Story tab's last line

**Files:** `adventure/StoryList.jsx:68` (a ternary, 0 lines) and header, `adventure/StoryList.test.jsx`.

- `{ready < episodes.length ? <p className="rm-list-rest">More of the story soon.</p> : state.episode >= episodes.length && <p className="rm-list-rest">That’s the whole story: the Checklist tab has the rest.</p>}` (keeping the existing element's class).

- [ ] **Step 1:** 'closes the story with a line for the Checklist once it’s all done, and only then' with `ready={13}`: `{13,0}` → 13 ticks, the closing line, no 'More…'; `{12,1}` → no closing line; `ready={12}` at `{13,0}` → 'More…' only. **Step 2:** FAIL. **Step 3:** the ternary. **Step 4:** PASS. **Step 5:** commit.

### Task 8: The guide

**Files:** `guide/c137.js` (+2 tips on the end), `guide/pages.test.js`.

- `['The Blood Dome', 'Step into the ring and Hemorrhage comes down to fight. F fires the way Morty faces, so keep Hemorrhage in front of you and out of his reach: Tab turns Morty to face him, and on a phone the star fires and Lock comes on by itself as he nears. His hits take your health, and with none left you’re back at the portal, the ring there to try again.']`
- `['Evil Rick’s lair', 'Free the three Mortys from the pods on the west wall and Evil Rick leaves his console to come for you: fight him as you fight Hemorrhage. With no health left you’re back at the door, every Morty plugged in again. Once he’s down, the Morty with the eyepatch in the chair at the back will talk.']`

- [ ] **Step 1:** the tail `slice(-7)` ends `…'Heist-Con', 'The Blood Dome', 'Evil Rick’s lair'`; 'tips episode 13’s fights on C-137’s page: the ring and the pods, facing him, and the Morty with the eyepatch after' (`/ring/`, `/the way Morty faces/`, `/Tab/`, `/Lock/`, `/back at the portal/`; `/three Mortys/`, `/pods/`, `/back at the door/`, `/plugged in again/`, `/eyepatch/`; neither `/!/`, `/['"]/`, `/hearts|\d/`). **Step 2:** FAIL. **Step 3:** the tips. **Step 4:** PASS. **Step 5:** commit.

### Task 9: The adventure at READY 13 (after Tasks 1 to 8, never before)

**Files:** `adventure/episodes.js:21` and its comment ("Each phase raised it by one, to all thirteen."), `episodes.test.js`, `story.test.js`, `hud.test.js`, `adventure.test.js`, `StoryList.test.jsx`, `EpisodeCard.test.jsx`.

Moved, each as strict (the old frontier kept under `ready: 12` where the API takes it):
- `episodes.test.js`: 'has thirteen episodes, every one ready', `READY` 13 and equal to `EPISODES.length`.
- `story.test.js`: the walk's title gains episode 13 and Rick's bench; the Vindicators' feed under `{ ready: 12 }` → `[done 11]` and objective null (kept); by default `[done 11, episode 12]`, then `blooddome` → `[step 12 1]`, `evilrick` → `[step 12 2]`, `evilmorty` → `[step 12 3]`, each step's objective, `use dial` → `[done 12, end]`, `{13,0}`, objective null, every place open, a second `use dial` → `[]`. The "both known" case under `{ ready: 12 }` as it was; by default types `[done, episode, step, done, episode]` and `newsOf` → episode 12's outro with card 12.
- `hud.test.js`: `markedTask({ episode: 12 }, next, { ready: 12 })` → `next` (kept); `{ episode: 13 }` → `next`; `{ episode: 12, step }` for 0..3 → `blooddome`, `evilrick`, `evilmorty`, `dial`.
- `adventure.test.js`: `{12,0}` intro null under `ready: 12` (kept), 12 by default, `{13,0}` null; the "both known" case likewise (intro 12 by default); `jump(13)` → `{13,0}` and Evil Rick's lair open; the silent comments in place.
- `StoryList.test.jsx`: 'More of the story soon.' under `ready={12}` (kept), not by default; `{12,0}` → 12 ticks, no 'More…', no closing line.
- `scripts/rm-story/basics.mjs:71`'s comment: "(the story's end: every place open)".

New: `story.test.js` 'counts episode 13’s places done early, waits at Rick’s bench for the gun, and only a press there ends it'; `adventure.test.js` 'opens episode 13 for a visitor who finished episode 12 before it was built' (`{12,0}` with nothing / `blooddome` / all three / `evilmorty` only / the lair's two known → `{12,0}`/`{12,1}`/`{12,3}`/`{12,0}`/`{12,0}`, intro 12 each; Free roam null); `StoryList.test.jsx` 'ticks Evil Rick’s three done before they come up, never the bench'; `EpisodeCard.test.jsx` 'names episode 13 too'.

- [ ] Steps: the tests (FAIL at READY 12), `READY = 13`, PASS, one commit with a sentence per moved assertion.

### Task 10: The story check plays episode 13

**Files:** `scripts/rm-story/helpers.mjs` (`EVIL = EPISODES[12]`; `isDone` and `achieved` lifted from `score.mjs`), `score.mjs` (`over()`: the closing line then card 13, at 12.0, every place open; its tail's line `EVIL.steps[0].text`), new `evil.mjs` (`EVIL_CHECKS`), `places.test.mjs` (`USED`: `blooddome: ['ring']`, `evilrick: ['pod1', 'pod2', 'pod3', 'evilmorty']`), `rm-story-check.mjs` (registration, header).

`evil.mjs`'s own steps: `BENCH = [-301.75, 100.15, Math.PI]`; `WHO = { blooddome: 'hemorrhage', evilrick: 'evilrick' }`; `fightOn`; `standOff(area, him, r)` (8 bearings from the way in round, inside the area less 1 m, 1 m clear of every solid and no solid across the line to him); `win` (fire from a fresh stand 6 m off each shot, up to 3 × hp tries, each landed shot one hp); `lose` (stand 1 m off till the fade, his line, back at the way in, the fight over, the task not done); `fled` (home mid-fight: no panel, `sim.duel` null, the chip, F does nothing, P and the bench open the dial).

Scenarios (each reloads round a hash change):
1. `episode-13` (fresh): `playTo(12)` (card 13 on the way); the line, the Story tab with no closing line, the garage marker; the Dome: the ring, the hint's two lines, the ring gone from reach, `win`, done and 'A man now', the won line, the panel gone, 12.1, the marker on its portal; the lair: the pods in turn with the marker, each freed pod gone from reach, the fight, `win`, done and the achievement, 12.2, the marker on him; the talk: his line, still up 4 s on and not yet done, then done and 'The one behind him', 12.3, the marker on the lair's portal, him gone from reach; the finale: home, the marker on the bench, E, Rick's last line, no dial box (and none 1.5 s on), the toast on top (`elementFromPoint`), 13.0, the checklist's line, no card, the Story tab's 13 ticks and closing line, P reads 'Coordinates home: n of n', E at the bench opens the dial.
2. `dome-fights` (seed 12.0): lost (back at the portal, the ring back), fled, won, and after the win the ring's `fight` sets nobody hunting, then again on a revisit.
3. `lair-fights` (seed 12.1, the Dome done): his spot shut before the win, 'Face him', lost (the pods back), fled, won, `collected` after the win sets nobody hunting, the talk.
4. `evil-returner` (seed 12.0, all three done): card 13, 12.3, the three ticked and not the bench, each achievement on its visit, the bench ends it.
5. `evil-backwards` (seed 12.0, the lair's two done): the Dome's win takes it to 12.3 in one go, then the bench.

Mutations, each checked to bite then put back: READY at 12; the flee lines out; the bench back to `openDial()` first; the spot's `after` dropped; a duel's `unlock` dropped; the stage's duel grant out; the builder's grant out; `markedTask`'s `use` out; `GOAL.dial` out; the `npc.js` edits reverted; `PICKS` back to climbs; the Tab line out; the closing line out; the talk's hold back to `TALK_MS`.

- [ ] Steps: write them, run the five and P11's three on the dev server in batches, the mutations, commit.

### Task 11: Shots, the hand-off and the index

Shots after (`blooddome`, `evilrick`; INFO=1 low, under the 0.8M cap). The hand-off's C-137 paragraph gains episode 13's sentences; 'Left' says P12 is in and the story is whole at READY 13, the phases' `READY` sentence in the past tense, Schmeckles waiting, and a "From P12:" sentence of the debts. The index: "P0's to P11's have; P12's is `2026-10-19-rm-adventure-p12-evil-rick.md`", and a sentence under the P13 gate (its `git log` shows 57da9c70d, the galaxy's Free roam jobs, not the owner's currency). Delete P11's plan.

### Task 12: Prove it, review, PR, merge on green

`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` (`git checkout public/github.json` if the build touched it); the full story check in batches; one fresh review (the Review Focus above, deliberately); one fix pass, each fix red to green; one PR; merge on green.
