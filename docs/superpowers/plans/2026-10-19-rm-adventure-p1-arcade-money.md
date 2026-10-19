# The Rick and Morty adventure, P1: episode 2, *Arcade money* — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** episode 2 playable on a fresh save: Roy, then Plumbus Smash, a walkway cabinet at Blips and Chitz with a target to beat, its win the story's `win cabinet`; `READY` 2.

**Architecture:** the game is a pure, seeded rule (`src/components/rickmorty/world/games/cabinet.js`) and a DOM overlay beside it (`games/Cabinet.jsx`), opened from the `cabinet2` hotspot as Roy and the sewer are, through RmWorld's `PLACES`/`Place`. The win reaches the story only through RmWorld's `tell`, which now holds the story's news while an overlay is open and says it when it closes. The story layer (`src/components/rickmorty/adventure/`) learns win steps on the map and in the Story tab, and shows an episode's card at the start of a visit.

**Tech Stack:** React 19, Vitest (node; components by `renderToStaticMarkup`), Playwright (`playwright-core`) for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` (§3, §4 episode 2, §5's cabinet row and its paragraph on kinds, §7). Index: `docs/superpowers/plans/2026-10-19-rm-adventure.md`.

## What P0 landed (`git log -- src/components/rickmorty/adventure`, 2cfb9556..1526314e; merged in #1089)

- `episodes.js`: `READY = 1`, `WINS = ['cabinet', 'chase']`; episode 2 (`id: 'arcade'`) is written: `task roy` (place `annex`), then `{ type: 'win', game: 'cabinet', place: 'annex', text: 'Rick bet the next set on a walkway cabinet at Blips and Chitz. Beat its target.' }`, unlocks `['agency', 'simulation']`.
- `story.js`: a win is kept in `state.wins` whatever the step (L73) and passes its step from there. `adventure.js`: `createAdventure(...)` with `intro()` (true once, for a new save only). `hud.js`: `objectiveLine`, `newsOf`, `markedTask` (null for a non-task step), `dialItems`, `dialLead`. `useAdventure.js`, `ways.js`, `StoryList.jsx`, `EpisodeCard.jsx`.
- RmWorld: `tell(e)` feeds and says `newsOf(out)` at once (RmWorld.jsx ~350); `complete()` tells every task; the card's effect `if (gl === 'on' && !planet && intro()) setCard(0)` (~359).
- `scripts/rm-story-check.mjs`: eight scenarios; it imports only `episodes.js` from `src`.

## Global Constraints

- The win is fed as exactly `{ type: 'win', game: 'cabinet' }`, through RmWorld's `tell`; no `TASKS` row (the checklist stays 54) and no earn deed (pay for wins is P13's `pay.js`; `economy.js` and `earn.js` aren't touched).
- `READY = 2` at the end of P1; episode 2's data in `episodes.js` doesn't change.
- RmWorld.jsx (2,249 lines) gains call sites and one-line guards only; logic goes in `adventure/` or `world/games/`. New files under 800 lines; `arcade.js` (986) and `rules.js` (1,117) get one-line edits.
- The kind is a pure rule in `world/games/cabinet.js` with its test beside it: seeded (a uint32 `rng` in the state, as `roy/rules.js`), stepped at a fixed 1/60 s, a goal, a fail with a quick retry, a win. It takes `perks` and, until P13, reads none (spec §6 maps none of the four to it).
- It isn't a `place()` key: Blips and Chitz is a C-137 area, not a `DESTINATIONS` row (spec §5's own row: "a DOM overlay as Roy is"). Never put it in `place()`'s `kinds` (that is the Meshy cast; `models.test.js` holds it).
- No new models, no WebGL, no scene: a DOM overlay. No `requestAnimationFrame` of its own (`loops` 57/58): `useFrameLoop` from `src/lib/hooks.js`. No `kbd` CSS rule (`kbd-styles` 68/70). No `eslint-disable` anywhere (`lint-disables` 54/54).
- The arcade's marquees and posters keep their pixels: the three names move to `games/cabinet.js` with the same strings in the same order.
- Copy: British spelling, curly quotes, sentence case, one sentence a toast, no `!`; "Again" for a retry, "Leave" with Esc for the way out (`src/lib/words.js`). The cabinet's `say.js` line stays as its colour, on the overlay's first card.
- Nothing loosened: the six assertions that pin `READY = 1` move to the new frontier, each as strict, with a sentence in the commit.

## Review Focus

1. **The outro under the overlay**: the cabinet won while its overlay is open, or Roy left with the cabinet already won: episode 2's closing line must be seen once the overlay closes, not under it or replaced by "n of 54 done". Pinned in Task 4 (held news) and the browser's episode-2 scenario.
2. **A win before its step** (Free roam, or the cabinet beaten before Roy): it counts when the step comes up, the Story tab ticks it, and a feed that crosses a whole episode shows no card for an episode already over. Pinned in Task 2.
3. **A visitor who finished P0** (`{ episode: 1, step: 0 }` made under READY 1) is behind the new frontier: the dial shows 3 places open, and the visit opens with Episode 2's card so they see why. Pinned in Task 2 (`intro()`).
4. **Mashing**: pressing every chute every frame must not beat the target. Pinned in Task 1 (the sticky stick).
5. **Leaving mid-game, or a closed tab**: a win already told is saved (`tp-rm-story`); a run left before the target counts nothing. Pinned in Task 3 (`onWin` once, at the win) and the browser scenario (a lost run leaves `wins` empty).

---

### Task 1: Plumbus Smash's rules

**Files:**
- Create: `src/components/rickmorty/world/games/cabinet.js`, `src/components/rickmorty/world/games/cabinet.test.js`
- Modify: `src/components/rickmorty/world/arcade.js:50` (one line)

**Interfaces:**
- Produces: `CABINETS = { cabinet1: { name: 'Space Mortyball' }, cabinet2: { name: 'Plumbus Smash', target: 10000 }, cabinet3: { name: 'Cronenberg Crush' } }`; `MARQUEES` (each name upper-cased, keys in that order); `playable(id) → boolean` (has a target); `TUNING` (frozen: `lanes: 3, lives: 3, smash: 250, reach: 0.62, stuck: 0.5, spawn: [1.1, 0.42], fall: [2.6, 1.25], ramp: 40`); `newCabinet({ game = 'cabinet2', seed = 1, perks = {} } = {}) → State`; `stepCabinet(prev, input = {}, dt = 1 / 60) → State`, where `input.smash` is a chute (0, 1, 2) pressed since the last step and `State = { game, rng, t, score, target, lives, phase: 'play' | 'won' | 'lost', drops: [{ id, lane, y }], next, n, smashed, stuck, events: [{ type: 'drop' | 'smash' | 'whiff' | 'miss' | 'won' | 'lost', lane? }] }`.

The game: plumbuses come down three chutes; a press smashes the lowest one in that chute that's within the hammer's reach (`y >= reach`), for `smash` points; one that reaches the end (`y >= 1`) costs a life; a press at a chute with nothing in reach is a whiff and sticks the stick for `stuck` seconds (presses ignored). The spawn interval and fall time go from the first to the second value of `spawn`/`fall` as `smashed` goes from 0 to `ramp`. Won at `score >= target` (beating the all-nines high score, 9,999); lost at 0 lives; once over, a step changes nothing but `events: []`. `dt` is clamped to 0.1.

- [ ] **Step 1: Write the failing tests** (`cabinet.test.js`, after `sewer/rules.test.js`: a `run(seed, brain, max = 60 * 120)` helper and three brains, `careful` (smash the chute of the lowest drop in reach, when not stuck), `sleeper` (nothing) and `masher` (chute `i % 3` every step)):
  - `names the walkway's three games, and only Plumbus Smash plays`: the three names; `MARQUEES` equals `{ cabinet1: 'SPACE MORTYBALL', cabinet2: 'PLUMBUS SMASH', cabinet3: 'CRONENBERG CRUSH' }` in that key order; `playable('cabinet2')` true, `cabinet1`/`cabinet3`/`'nope'` false.
  - `drops the same plumbuses from the same seed`: the lanes of the first 20 `drop` events equal for seed 7 twice, differ for seeds 7 and 8.
  - `smashes the lowest plumbus in reach, and nothing out of reach`: from a state with drops `[{ id: 1, lane: 0, y: 0.7 }, { id: 2, lane: 0, y: 0.9 }, { id: 3, lane: 1, y: 0.3 }]`, smash 0 removes id 2 and scores 250; smash 1 is a whiff (`stuck` 0.5, score unchanged); a smash while stuck does nothing.
  - `a plumbus that reaches the end costs a life, and three lose`: the sleeper ends `lost` with `smashed: 0` on seeds 1–6, after exactly three `miss` events.
  - `a careful player beats 9,999 on every seed`: seeds 1–6 end `won` with `score >= 10000`.
  - `mashing every chute doesn't beat it`: the masher ends `lost` on at least five of seeds 1–6.
  - `changes nothing once won or lost`, `takes perks and reads none until the shop` (`newCabinet({ seed: 3, perks: { hearts: 1, slow: 1 } })` deep-equals `newCabinet({ seed: 3 })`).
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/cabinet.test.js` — Expected: FAIL (no module).
- [ ] **Step 3: Implement `cabinet.js`** (pure: no three, no React, no import of `arcade.js`). Its rng is `roy/rules.js`'s `rand(state) → [value, next]` shape, carried as `rng`. Tune `TUNING` only if a brain's test asks it to, and say so in the commit.
- [ ] **Step 4: Point `arcade.js:50` at it**: `import { MARQUEES as CABINET_GAMES } from './games/cabinet';` in place of the literal (same strings, same order: the posters at :519 and the marquees at :723 don't change).
- [ ] **Step 5: Run** the test, then `npx vitest run src/components/rickmorty` — Expected: PASS.
- [ ] **Step 6: Commit** — "Plumbus Smash's rules: three chutes, a sticky stick and the all-nines high score to beat"

---

### Task 2: The story at READY 2

**Files:**
- Modify: `src/components/rickmorty/adventure/episodes.js:21`, `hud.js` (`newsOf`, `markedTask`), `adventure.js` (`intro`), `StoryList.jsx` (a win step's tick), `useAdventure.js` (no change of shape)
- Test: `episodes.test.js`, `hud.test.js`, `adventure.test.js`, `story.test.js`, `StoryList.test.jsx`, `EpisodeCard.test.jsx`

**Interfaces:**
- Produces: `READY = 2`. `newsOf(out) → { say, card }` with `say` at most one line (the last episode done's outro) and `card` null when that episode is done later in the same `out`. `markedTask(state, next, opts)` returns `{ id: step.game }` for a `win` step (an `all`'s parts likewise). `intro() → number | null`: the episode whose card opens this visit, asked once a visit: the current episode when it's built, the visitor isn't on Free roam and is at its step 0; else null. `StoryList` ticks a `win` step (and a win part) when `state.wins` holds its game.

- [ ] **Step 1: Write the failing tests and move the frontier** (each change below gets its sentence in the commit):
  - `episodes.test.js`: `has thirteen episodes, the first two ready` (`READY` 2); a sibling of `starts with Wiped`: `Arcade money`'s steps are `roy` then the `cabinet` win (place `annex`), unlocks `['agency', 'simulation']`.
  - `story.test.js`: the real-story test becomes `opens episode 2’s places after episode 1, and every place once episode 2 is done`: after Wiped's four tasks the out ends `[{ type: 'done', episode: 0 }, { type: 'episode', episode: 1 }]`; annex and meeseeksgolf open, agency, vat, citadel, squanch and evilrick shut; the objective is episode 2's first step; `task roy` then `win cabinet` end it with `[{ type: 'done', episode: 1 }]`, every place open, objective null. And `keeps a cabinet won early`: with `wins: ['cabinet']` and roy known, Wiped's last task carries the story to episode 2.
  - `hud.test.js`: `markedTask` at `{ episode: 2 }` is the checklist's next; at `{ episode: 1 }` it's `{ id: 'roy' }`; at `{ episode: 1, step: 1 }` (ready 2) it's `{ id: 'cabinet' }` (was null). `dialItems` at `{ episode: 2 }` all open; at `{ episode: 1 }` the open ones are `['annex', 'customs', 'meeseeksgolf']` and agency reads `Opens after episode 2, “Arcade money”.`. `dialLead` at `{ episode: 2 }` is `32 of 32`, at `{ episode: 1 }` `3 of 32`. `newsOf([{ done 0 }, { episode 1 }, { step 1.1 }, { done 1 }])` is `{ say: [Morty's episode 2 outro], card: null }`.
  - `adventure.test.js`: `jump(1)` leaves the vat shut and annex open; `jump(2)` opens the vat; `jump(99)` stays at 2. `intro()`: a new visitor gets `0`, then `null` that visit; a new store over a save at `{ episode: 1, step: 0 }` gets `1`; one at `{ episode: 1, step: 1 }` gets `null`; a returner (Free roam) gets `null`.
  - `StoryList.test.jsx`: `ticks every built episode once they’re all done` renders `{ episode: 2 }` (2 ticks, "More of the story soon."); the first test also expects `Arcade money` by title without its steps; a new case `ticks a game won before its step`: `{ episode: 1, step: 0, wins: ['cabinet'] }` ticks the cabinet's step.
  - `EpisodeCard.test.jsx`: Episode 2's card (`Episode 2`, `Arcade money`, `<b>Rick</b>`, its intro line).
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL on exactly the new and moved assertions.
- [ ] **Step 3: Implement** the five changes (`READY`, `newsOf`, `markedTask`, `intro`, `StoryList`).
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "The adventure at READY 2: episode 2 is built, a win shows on the map and in the Story tab, and a visit opens with its episode's card"

---

### Task 3: The cabinet's overlay

**Files:**
- Create: `src/components/rickmorty/world/games/Cabinet.jsx`, `src/components/rickmorty/world/games/cabinet.css`, `src/components/rickmorty/world/games/Cabinet.test.jsx`

**Interfaces:**
- Consumes: Task 1's rule; `SAY` (`world/say.js`) for the cabinet's line; `useFrameLoop`, `useMediaQuery` (`lib/hooks`); `readPad` (`../../../games/pad`); sounds lazily (`lib/sfx`, `games/gameAudio`'s `plumbus`).
- Produces: `<Cabinet game="cabinet2" onWin={() => …} onLeave={() => …} />`, filling the overlay: `onWin` once a run, at the step whose events hold `won`; `onLeave` from every way out. Phases `intro | play | paused | won | lost`. The root always carries `data-owns-escape`: Esc pauses while playing and leaves otherwise; B leaves from the intro and the end cards, A starts and plays again; it pauses when the tab is hidden; an end card ignores presses for 600 ms. In DEV, `window.__CABINET__ = { get state(), set(s), step(input) }` (deleted on unmount), as `window.__ROY__` is.
- Copy: the intro card has the game's name, the cabinet's `say.js` line, "Rick’s bet: beat 9,999.", the keys ("← ↓ → or A S D smash a chute; P or Esc pauses"; on touch, "Tap a chute") and Start (focused). Won: "10,000. Rick’s bet is good." with Leave (focused) and Again. Lost: "Game over at n." with Again (focused) and Leave. The score and lives through refs from the loop; the chutes and plumbuses in SVG/CSS (the plumbus as `PlumbusFactory.jsx` draws one); 44 px touch targets; text on its own dark screen at 0.7 rem or more.

- [ ] **Step 1: Write the failing test** (`Cabinet.test.jsx`, `renderToStaticMarkup`): the intro renders `Plumbus Smash`, `Somebody’s high score is all nines, and the stick is sticky.`, `Rick’s bet: beat 9,999.`, `data-owns-escape` and a `Start` button.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/games/Cabinet.test.jsx` — Expected: FAIL (no module).
- [ ] **Step 3: Implement** `Cabinet.jsx` and `cabinet.css` on `Sewer.jsx`'s loop (`STEP` 1/60, `MAX_STEPS` 6, presses buffered into the next step).
- [ ] **Step 4: Run** it, then `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS, no warnings.
- [ ] **Step 5: Commit** — "Plumbus Smash's cabinet: the game on the walkway cabinet's screen"

---

### Task 4: Episode 2 in C-137, and the check that plays it

**Files:**
- Modify: `src/components/rickmorty/world/RmWorld.jsx` (a lazy import; a `PLACES` row; `tell` holding outs while a place is open, said by `close`; `cabinetWon`; one `Place` prop and body row; `Place`'s Suspense reading `p.wait`; a `GOAL` row and a guard in `goalOf`; the card's effect taking `intro()`'s number), `src/components/rickmorty/world/rules.js:765` (`cabinet2`'s label "Plumbus Smash"), `scripts/rm-story-check.mjs`, `scripts/c137-shots.mjs` (an `arcade` view on the end of `VIEWS`)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `PLACES.cabinet2 = { title: 'Plumbus Smash', where: 'Blips and Chitz', full: true, wait: 'Switching the cabinet on…' }`; `GOAL.cabinet = ['arcade', 'spot:cabinet2']`; `goalOf` returns null for an id with no `GOAL` row. `tell(e)`: `const out = feed(e)`; while a place is open the out is held, else said through `newsOf`; `close()` says what was held after its own `tellDone`, so the closing line is last. `VIEWS.arcade = { area: 'arcade', at: [-300, 305, N], cam: [0, 0.25] }`.

- [ ] **Step 1: Write the failing browser scenarios** (`rm-story-check.mjs`; it imports `READY` beside `EPISODES`):
  - `episode-1`'s tail, at READY 2: after Wiped's outro toast, `.rm-episode` shows `Episode 2`, its title and intro line; a key dismisses it; the story is at 1.0; annex and meeseeksgolf open, agency and vat shut; the objective reads episode 2's first step.
  - `ways`: `jump(READY)` in place of `jump(1)`.
  - `episode-2` (new, on the end, fresh profile): Wiped's four tasks by `__C137__.complete` as `episode-1` does, the card dismissed; `complete('roy')` and the objective reads the cabinet step; `goto('arcade', -292.6, 300, 0)`, `use('cabinet2')`, the overlay up and `wins` without `cabinet`; through `__CABINET__`, a lost run shows Again and counts nothing; Again, then a run set one smash short of the target and one press wins; `wins` holds `cabinet` while the overlay is still open; Leave; the place detaches, Morty's outro toast shows, the story is at episode 2, agency and the vat are open, and the objective reads the checklist's first hint. With `OUT`, a shot mid-game.
- [ ] **Step 2: Run** the dev server on 5197, then `node scripts/rm-story-check.mjs episode-1 episode-2` — Expected: FAIL (`episode-1` on the frontier, `episode-2` on the cabinet).
- [ ] **Step 3: Make the change** in RmWorld, `rules.js` and `c137-shots.mjs`.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npm run lint`, then `node scripts/rm-story-check.mjs` — Expected: PASS, and all nine scenarios ok.
- [ ] **Step 5: Commit** — "Episode 2 plays through: Plumbus Smash at Blips and Chitz, its win told when the overlay closes"

---

### Task 5: The guide's keys

**Files:**
- Modify: `src/components/guide/pages.js` (`'/c-137'`: a key group, a touch group and a tip, each on the end of its list)
- Test: `src/components/guide/pages.test.js` (unchanged; it holds the rows)

- [ ] **Step 1: Add** `{ label: 'Plumbus Smash', rows: [['← ↓ → / A S D', 'Smash the left, middle or right chute'], ['P / Esc', 'Pause']] }` after "Through the portal"; touch `{ label: 'Plumbus Smash', rows: [['Tap', 'Smash a chute']] }`; tip `['Plumbus Smash', 'The walkway cabinet at Blips and Chitz. Smash each plumbus at the foot of its chute; a swing at an empty chute sticks the stick. Somebody’s high score is all nines.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has Plumbus Smash's keys"

---

### Task 6: Prove it and hand it over

**Files:**
- Modify: `docs/superpowers/HANDOFF-worlds.md` (C-137's paragraph: the cabinet; the Left list: P1 in, P2 next)
- Delete: `docs/superpowers/plans/2026-10-19-rm-adventure-p0-foundation.md` (`docs/README.md`: a plan goes once its work is merged; this one's is)

- [ ] **Step 1: Shoot before and after**: `scripts/c137-shots.mjs arcade street` on `main` (port 5198) and on the branch (5197), `HUD=1`; the game itself from `rm-story-check` with `OUT`. Expected: the marquees and posters unchanged; the objective and the cabinet's prompt differ.
- [ ] **Step 2: Run the four**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` — Expected: all green; `big-files` 30, `loops` 57, `kbd-styles` 68, `lint-disables` 54.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server and on a DEV-flavoured build (`NODE_ENV=development vite build`, `vite preview` on 5197) — Expected: every scenario ok.
- [ ] **Step 4: Update the hand-off, retire P0's plan, commit** — "The worlds' hand-off: episode 2, and P0's plan goes"
- [ ] **Step 5: One fresh reviewer on the whole branch, then push and open the pull request** ("The Rick and Morty adventure, P1: Arcade money"), merged once CI is green.
