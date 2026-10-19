# The Rick and Morty adventure, P2: House guests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 3, *House guests*, is built and played: Total Rickall from the egg, Dr. Wong's therapy, and Pickle Rick's sewer run under the agency, with the sewer counting the moment it's won.

**Architecture:** No new game kind (the index: "all exist"). `READY` goes to 3 and the tests pinned to the old frontier move with it. The sewer tells its win as the cabinet does (an `onWin`, said when the overlay closes, through P1's held news), owns Esc on every card, and gets a DEV hook so the browser check can win it inside its overlay. The Story tab ticks a task done ahead of its step, as it ticks a game won ahead. The map's marker inside Dr. Wong's office points at her.

**Tech Stack:** React 19, Vitest (node, `renderToStaticMarkup`), Playwright-core on SwiftShader for `scripts/rm-story-check.mjs` and `scripts/c137-shots.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` (episode 3's row: `task rickall` · `task wong` · `task sewer`); phase index `docs/superpowers/plans/2026-10-19-rm-adventure.md` (P2). What landed before: P0 (#1089) and P1 (#1097, merged at `f2395f7`).

## Global Constraints

- `READY` is 3 at the end of this phase; episode 3's data in `episodes.js` stays as written.
- `RmWorld.jsx` gets call sites and one-row data changes only (it is 2,268 lines and counted in big-files).
- No new models, no model names; nothing from draft PR #1028; Schmeckles (P13) not built: no earn deed, `economy.js` and `earn.js` untouched.
- Health budgets hold: big-files 30/30, loops 57/58 (no new `requestAnimationFrame`), kbd-styles 68/70 (no key-cap CSS), lint-disables 54/54 (no `eslint-disable`, not even in a comment), cycles 5/5.
- Copy: British spelling, curly quotes, no `!`, no Oxford comma, one sentence a toast, the key first in a prompt.
- An import of a `.jsx` that sits beside a same-named `.js` names its extension (`src/imports.test.js`).
- Every moved assertion stays as strict, with a sentence in its commit (P1's "Nothing loosened").
- New rows go on the end of their lists.

## Review Focus

1. **A visitor who finished episode 2 under P1** (`{ episode: 2, step: 0 }` made at READY 2, every place open since): the dial drops to 5 of 32 and the visit opens with Episode 3's card, also when the catch-up has done Total Rickall; with all three tasks already done, episode 3 finishes on load without a word. Pinned in Task 1 (`intro()`), the silent finish named in the hand-off.
2. **Episode 3's tasks done before their step** (both are in the neighbourhood from the first visit): one cabinet win crosses into episode 3 and past them; episode 2's closing line and Episode 3's card are said, or, with all three done, episode 3's closing line and no card. The Story tab ticks a task done ahead. Pinned in Task 1 (`feed`, `newsOf`) and Task 2.
3. **The sewer won and then left any way** ('Up the drain', Esc on the end card, the Leave button, Again then a loss): it counts at the win, the closing line is said once the overlay is gone, and a run never won counts nothing. Pinned in Task 3 and the browser's `episode-3` scenario.
4. **Total Rickall left mid-game** (stopped, walked out of, a lost game): nothing counts and the story stays at the step. Pinned in the `episode-3` scenario.
5. **Dr. Wong's step** ticks 3.2 s after the talk, and inside her office the marker points at her, not the door. Pinned in Task 3 (the GOAL row) and the `episode-3` scenario.

---

### Task 1: The story at READY 3

**Files:**
- Modify: `src/components/rickmorty/adventure/episodes.js` (`READY = 3`)
- Test: `episodes.test.js`, `story.test.js`, `hud.test.js`, `adventure.test.js`, `StoryList.test.jsx`, `EpisodeCard.test.jsx` (all under `src/components/rickmorty/adventure/`)

**Interfaces:**
- Consumes: P0/P1's `feed`, `dialOpen`, `objective`, `newsOf`, `markedTask`, `dialItems`, `dialLead`, `intro()`, `jump()`.
- Produces: `READY === 3`; no API change.

- [ ] **Step 1: Move the tests to the new frontier and add the new ones.** Each value below was confirmed by running the code at `ready: 3`.
  - `episodes.test.js`: 'has thirteen episodes, the first three ready' (`READY` 3); new 'goes on with House guests: Total Rickall, Dr. Wong, then the sewer' — title 'House guests', step ids `['rickall', 'wong', 'sewer']`, `steps[2]` matches `{ type: 'task', id: 'sewer', place: 'agency' }`, unlocks `['microverse', 'anatomy', 'storytrain']`.
  - `story.test.js`, the real-story case becomes 'opens episode 3’s places after episode 2, and every place once episode 3, the last built, is done': the cabinet win's out is `[{ type: 'done', episode: 1 }, { type: 'episode', episode: 2 }]`; open `annex, meeseeksgolf, agency, simulation`; shut `microverse, anatomy, storytrain, vat, citadel, squanch, evilrick`; `objective` is `{ text: EPISODES[2].steps[0].text, to: null }`; feeding `rickall` then `wong` moves it to steps 1 and 2; feeding `sewer` gives `[{ type: 'done', episode: 2 }]` (no card: episode 4 isn't built), every place open and `objective` null.
  - `story.test.js` 'keeps a cabinet won early': the out's types are `['done', 'episode', 'step', 'done', 'episode']`, the last `{ type: 'episode', episode: 2 }`.
  - `story.test.js` new 'crosses into episode 3 past the tasks already done': from `{ episode: 1, step: 1 }` with known tasks `['roy', 'rickall', 'wong']`, a cabinet win lands at `{ episode: 2, step: 2 }`; and `newsOf` of that out says episode 2's closing line with card 2. With `sewer` known too it lands at `{ episode: 3, step: 0 }` and `newsOf` says episode 3's closing line with card null.
  - `hud.test.js`: `markedTask({ ...fresh(), episode: 3 }, next)` is `next`; at 2.0, 2.1 and 2.2 it is `{ id: 'rickall' }`, `{ id: 'wong' }`, `{ id: 'sewer' }`. `dialItems` at episode 2 opens exactly `annex, customs, simulation, agency, meeseeksgolf`, and microverse's note is 'Opens after episode 3, “House guests”.'; `dialLead` at episode 2 reads 5 of 32, at 3 reads 32 of 32.
  - `adventure.test.js`: `jump(2)` leaves the vat and microverse shut with agency open; `jump(3)` opens the vat; `jump(99)` stays at 3. `intro()`: `{ episode: 2, step: 0 }` → 2; the same save with `rickall` known is caught up to `{ 2, 1 }` and still → 2; with all three known it lands at `{ 3, 0 }` → null (the silent finish, pinned as it stands); `{ episode: 3, step: 0 }` → null.
  - `StoryList.test.jsx` 'ticks every built episode once they're all done': at episode 3, 3 ticks.
  - `EpisodeCard.test.jsx` 'names episode 3 too': 'Episode 3', 'House guests' and Morty's intro line.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure` — Expected: FAIL, on READY 2 (`expected 2 to be 3` and the frontier values).
- [ ] **Step 3:** `export const READY = 3;`
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty/adventure` — Expected: PASS, lint clean.
- [ ] **Step 5: Commit** — "The adventure at READY 3: episode 3 is built", its body naming each moved assertion and what it now pins.

### Task 2: The Story tab ticks a task done ahead

**Files:**
- Modify: `src/components/rickmorty/adventure/StoryList.jsx`, `src/components/rickmorty/world/RmHud.jsx:559` (the call site)
- Test: `src/components/rickmorty/adventure/StoryList.test.jsx`

**Interfaces:**
- Produces: `<StoryList state tasks={doneIds} />`; `tasks` defaults to `[]`. A `task` step whose id is in `tasks` reads done, as a `win` step whose game is in `state.wins` does.

- [ ] **Step 1: Write** 'ticks a task done before its step comes up': at `{ episode: 2, step: 0 }` with `tasks={['wong']}`, Dr. Wong's step is ticked and Total Rickall's isn't; without `tasks`, neither is.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/StoryList.test.jsx` — Expected: FAIL (Wong's step not ticked).
- [ ] **Step 3: Implement** the `tasks` prop beside `won`; pass `tasks={done}` from `ThingsToDo` in RmHud.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty` — Expected: PASS.
- [ ] **Step 5: Commit** — "The Story tab ticks a task done before its step"

### Task 3: The sewer counts at the win and owns its Esc

**Files:**
- Modify: `src/components/rickmorty/world/sewer/Sewer.jsx`, `src/components/rickmorty/world/RmWorld.jsx` (Place's sewer branch passes `onWin`; `PLACES.sewer` gains `wait: 'Down the drain…'`; `GOAL.wong` becomes `['wong', 'spot:therapy']`)
- Create: `src/components/rickmorty/world/sewer/Sewer.test.jsx`

**Interfaces:**
- Produces: `<Sewer onLeave={(won) => …} onWin={() => …} />` — `onWin` once a mount, the step the run is won (`wonRef` turning true); `onLeave` unchanged. The root always carries `data-owns-escape`. DEV only: `window.__SEWER__ = { get state, get phase, set(run) }` (set puts `run` in `run.current` and `view.current`), deleted on unmount. Place: `<Sewer onLeave={onSewer} onWin={() => onTask('sewer')} />` — `complete` is idempotent, so `sewerLeft`'s own `complete('sewer')` stays as the backstop.

- [ ] **Step 1: Write** `Sewer.test.jsx`: 'owns Esc from the first card, so the overlay never closes a won run behind its back' — `renderToStaticMarkup(<Sewer onLeave={() => {}} onWin={() => {}} />)` contains `data-owns-escape`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/sewer` — Expected: FAIL (the loading card has no `data-owns-escape`).
- [ ] **Step 3: Implement** in Sewer.jsx: the attribute unconditional; `onWin` through a ref (as Cabinet.jsx holds its `onWin`), called where the run turns won, guarded by `wonRef`; the DEV hook. In RmWorld: the three one-row changes above. Update Sewer.jsx's header comment for `onWin`.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty && npx eslint src/components/rickmorty` — Expected: PASS, lint clean.
- [ ] **Step 5: Commit** — "The sewer run counts the moment it's won, and owns Esc on every card"

### Task 4: Episode 3 in the browser check

**Files:**
- Modify: `scripts/rm-story-check.mjs`, `scripts/c137-shots.mjs` (an `agencyhole` view on the end of `VIEWS`: `{ area: 'agency', at: [-417.6, 4011.4, -1.02], cam: [0, 0.3] }`)

**Interfaces:**
- Consumes: Tasks 1–3; `__C137__` (`goto`, `act`, `complete`, `ready`, `dial`, `rickall`, `lookAt`, `shoot`, `stopRickall`, `sim`), `__RMSTORY__`, `__SEWER__`.
- Produces: helpers `inArea(page, area)`, `cardFor(page, i)` (waits for `.rm-episode`, checks `Episode ${i + 1}`, the title and the intro line, presses Shift, waits for it to go), `at(page, episode, step)`, `shootAt(page, id)` (lookAt, wait for `sim.rickall.aim === id`, shoot, wait for the shot to land, check the last shot was `id`); `GUESTS = EPISODES[2]`; `inGarage` becomes `inArea(page, 'garage')`.

- [ ] **Step 1: Write the failing scenarios.**
  - `episode-2`'s tail at READY 3: no `.rm-episode` while the overlay is up; after Leave, Morty's closing line, then `cardFor(page, 2)`; the story at 2.0; agency and simulation open, microverse, anatomy, storytrain and the vat shut; the objective reads `GUESTS.steps[0].text`. Its old last two checks (the vat open, the cable hint) move to the end of `episode-3`.
  - `episode-3` (new, on the end, fresh profile): Episode 1's card dismissed; `__RMSTORY__.feed({ type: 'win', game: 'cabinet' })`; Wiped's four tasks by `complete`, `cardFor(page, 1)`; `complete('roy')`, Morty's closing line and `cardFor(page, 2)`; at 2.0. **Total Rickall:** `goto(page, 'house', -305.7, -7.1, -0.5)`, `use(page, 'egg')`, the game on; `stopRickall()` counts nothing (still 2.0); `rickall(23)`, `shootAt('jerry')` loses ('Not a parasite'), nothing counts; `rickall(23)` and `shootAt` each parasite in `game.people`; 'Survive Total Rickall' toast; 'Leave it there'; the objective reads `GUESTS.steps[1].text`. **Dr. Wong:** `goto(page, 'street', 24, -13.2, N)`, `use('wong-door')`, `inArea('wong')`, `goto(page, 'wong', -300, 897.2, N)`, `use('therapy')`; the 'Go to family therapy' toast after 3.2 s; the objective reads `GUESTS.steps[2].text`. **The sewer:** `dial('agency') === 'agency'`; `goto(page, 'agency', -417.6, 4011.4, -1.02)` (clear of the guards' hunt at the portal's arrival), `use('sewer')`; click 'Play anyway (slow)' if the gate shows; Roll; `__SEWER__.set({ ...state, x: 419.9, items: [], next: 1e6 })`; 'Made it'; `sewer` in `tp-c137-done` with the overlay still up and no closing line said; `page.keyboard.press('Escape')` (a real key) closes it; Rick's closing line; at 3.0; microverse, anatomy, storytrain and the vat open; no `.rm-episode` after 1.5 s; the objective reads the cable hint. With `OUT`, a shot mid-run.
  - Update the header comment to name the hooks the scenarios use.
- [ ] **Step 2: Run** them against `main` (its dev server on 5198, which has none of Tasks 1–3): `BASE=http://127.0.0.1:5198 node scripts/rm-story-check.mjs episode-2 episode-3` — Expected: FAIL (`episode-2` on Episode 3's card).
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` against the branch on 5197 — Expected: all ten scenarios ok.
- [ ] **Step 4: Commit** — "Episode 3 plays through in the browser check: Total Rickall, Dr. Wong and the sewer"

If the sewer's scene can't start in headless SwiftShader at all, rule it in the ledger and finish the step with `complete('sewer')` after checking that leaving un-won counts nothing.

### Task 5: The guide's sewer keys

**Files:**
- Modify: `src/components/guide/pages.js` (`'/c-137'`: a key group, a touch group and a tip, each on the end of its list)

- [ ] **Step 1: Add** `{ label: 'Pickle Rick’s sewer run', rows: [['← → / A D', 'Change lanes'], ['Space / ↑ / W', 'Hop'], ['F / Enter', 'Fire, once three screws make the laser'], ['P / Esc', 'Pause']] }`; touch `{ label: 'Pickle Rick’s sewer run', rows: [['Tap', 'Left, Hop, Fire and Right, on their buttons']] }`; tip `['Pickle Rick’s sewer run', 'The hole in the agency’s floor. Roll down the drain to the agency: hop the grates, hop onto the rats, and three screws make the rat-suit’s laser. Three bites and you’re a snack.']`.
- [ ] **Step 2: Run** `npx vitest run src/components/guide src/lib/words.test.js` — Expected: PASS.
- [ ] **Step 3: Commit** — "The guide has the sewer run's keys"

### Task 6: Prove it and hand it over

**Files:**
- Modify: `docs/superpowers/HANDOFF-worlds.md` (the adventure paragraph: the sewer's `onWin` and `__SEWER__`; the Left list: P2 in, P3 next; follow-ups found here: Shoney's marker points at the door from inside, as Wong's did; RoyDown's 'Back to the arcade' shows if the sewer's code fails to load; the sewer's end card has no 600 ms hold; a save past episode 3's three tasks finishes it silently), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (line 3 names P2's plan)
- Delete: `docs/superpowers/plans/2026-10-19-rm-adventure-p1-arcade-money.md`

- [ ] **Step 1: Shoot before and after**: `HUD=1 scripts/c137-shots.mjs rickall wong agency agencyhole` on `main` (5198) and the branch (5197); the game from `rm-story-check` with `OUT`.
- [ ] **Step 2: Run the four**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` — Expected: all green, budgets as above.
- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` on the dev server and on a DEV-flavoured build (`NODE_ENV=development vite build`, previewed) — Expected: every scenario ok.
- [ ] **Step 4: Update the hand-off, retire P1's plan, commit** — "The worlds' hand-off: episode 3, and P1's plan goes"
- [ ] **Step 5: One fresh reviewer on the whole branch, then push and open the pull request** ("The Rick and Morty adventure, P2: House guests"), merged once CI is green.
