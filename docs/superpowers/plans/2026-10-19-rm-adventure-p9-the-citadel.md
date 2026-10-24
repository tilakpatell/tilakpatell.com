# The Rick and Morty adventure, P9: The Citadel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Episode 10, *The Citadel*, is built and played. The Citadel shows the story as C-137 does: the story's step heads its objective line while the step is played there, an episode's card shows there when the visit's card is the Citadel's to show, and the episode's closing line is said there, after the escape's own.

**Architecture:** The Citadel already feeds the story (P0: `enter page:/c-137/citadel` on mount, `citadel <id>` for each scene taken) and throws away what it says back. P9 keeps what it says in a queue in `CitadelWorld`'s parent, added to and never replaced (StrictMode runs the mount feed twice), and World says it once the world is live and the toast before it has gone. Which story the Citadel tells is a pure file, `citadel/storyline.js`: `ENTER` (the event), `atDoor` (the story waiting at its door: fed again if it comes there while the page is open), `asksCard` (the visit's card is asked for only in an episode with a step here, so a new visitor's first card still waits for C-137) and `storyLead` (the story's step over the Citadel's own line, only while it's played here). A `citadel` step's objective links to the Citadel's page from C-137 (`stepPage` in `story.js`), as spec §2 says of a step on another page. The world holds under the card (no clock, herd, line, Cop Rick or Loco moves on), and a pad's press or push closes it as a key does (`stirs` in `games/pad.js`). The line becomes the kit's `Objective`. The Story tab ticks the escape done before its step comes up, as it does C-137's tasks.

**Tech Stack:** React 19, three.js, Vitest (node), Playwright-core on SwiftShader, Vite's `ssrLoadModule` for the check's data.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md`:
- §4: episode 10 is `enter page:/c-137/citadel` · `citadel citadelout` (the Citadel's own chain, to the escape).
- §2: "When the current step is on another page, the objective line is a link to it (`objective().to`)."
- §7: "The objective line reads the story's step first, then the checklist's next hint" and "The Citadel and the planets show the same objective line and card through `useAdventure`."
- §3: pages are never locked: any episode can be current on the Citadel.

**Index:** P9. What landed before: P0 #1089 to P8 #1230.

**Research:** four readers and a critic (scratch `p9/r-*.md`), then a design panel of three stances (minimal, player, risk) and a judge (scratch `p9/d-*.md`; this plan follows `d-judged.md`).

## Global Constraints

- `READY` is 10 at the end. Episode 10's data in `episodes.js` stays as written (no `place` on its second step).
- `RmWorld.jsx` is not touched. `RmHud.jsx` gains at most 4 lines (the Story tab's Citadel list).
- `CitadelWorld.jsx` grows by at most 60 lines (1309 → under 1370; the ceiling is 1500). Its logic goes in `citadel/storyline.js` (new, under 80 lines) with its test beside it.
- No new `requestAnimationFrame` (loops stay 58/58), no `eslint-disable` (54/54), no new import cycle (5/5): `citadel/` imports `adventure/`, never the reverse. No new boundary break (`runtime/hud` and `games/pad` are allowed).
- No new models, no new audio, no dependency. The outro is silent, as C-137's are.
- The HUD rule (`docs/health/RULES.md`, "The worlds' HUDs"): one toast (the Citadel's own), one card, the line from the kit; nothing a player reads under 0.7 rem; text over 3D on glass at alpha 0.78 or more; no bare `z-index` of 10 or more; no `kbd` rule.
- The Citadel's line at `{0,0}` looks as it does today after the kit swap (before and after shots).
- Copy: British, curly quotes, no `!`, no Oxford comma, one sentence a toast. The only new visible string is one guide tip; the lead, the outro and its speaker are data.
- Every moved test assertion stays as strict, with a sentence each in its commit.
- `economy.js`, the arsenal's files (draft PR #1028) and any model file are untouched.

## Review Focus

1. **A new visitor lands on the Citadel first** (from the map, the palette or a link). No card there, no lead, the Citadel's own line; back in C-137, episode 1's card.
   - Pinned in Task 3 (`asksCard` false at `{0,0}`) and Task 5 (`citadel-first`).
2. **The escape's own line and the outro.** 'The cruiser’s away…' is never erased by the outro; the outro follows it once, named Morty, under StrictMode's double mount.
   - Pinned in Task 7 (the drain's `!toast` gate, the queue only added to and sliced by what was taken) and Task 5 (`episode-10`, through the real `enter('hangar')`).
3. **No self-link and no lead at the door.** The Citadel never links to itself; `{9,0}` shows no lead, and if the story comes to the door while the page is open (another tab, a jump) it is fed again.
   - Pinned in Task 3 (`storyLead`, `atDoor`) and Task 5 (`citadel-door`).
4. **A card over red alert.** The world is held under it (no Cop Rick sees Rick, no clock runs) and a pad closes it.
   - Pinned in Task 3 (`stirs`) and Task 5 (`citadel-door`).
5. **Left mid-chain.** Back in C-137 at `{9,1}`, the line is a link to the Citadel, and following it shows no second card.
   - Pinned in Task 1 (`stepPage`), Task 2 (the walk's `{9,1}` objective) and Task 5 (`episode-10`).

---

### Task 1: A step at the Citadel links there

**Files:**
- Modify `src/components/rickmorty/adventure/story.js` (`objective`, around :91-97).
- Test `src/components/rickmorty/adventure/story.test.js`.

**Interfaces:** Produces `CITADEL_PAGE = '/c-137/citadel'`, `stepPage(step) → string | null` (an `enter` step's page when its area is `page:…`; a `citadel` step's, `CITADEL_PAGE`; else null), and `objective(state, opts) → { text, to: stepPage(step) } | null`.

- [ ] **Step 1: Write the tests.** 'points the Citadel’s steps at its page': on a small book, a `citadel` step's objective is `{ text, to: '/c-137/citadel' }`; `stepPage` of an `enter page:/x` step is `'/x'`, of `enter` `garage`, a `task` and an `all` step null; `CITADEL_PAGE === EPISODES[9].steps[0].area.slice('page:'.length)`.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/story.test.js`. Expected: FAIL (`stepPage` is not exported; the small book's `to` is null).
- [ ] **Step 3: Implement** `CITADEL_PAGE`, `stepPage` and `objective` on it. The name is `stepPage`, not `pageOf` (`world/dimensions/destinations.js` exports a `pageOf(id)`).
- [ ] **Step 4: Run** the adventure's tests. Expected: PASS (inert at READY 9: no `citadel` step is current in the real book).
- [ ] **Step 5: Commit**: "A step played at the Citadel links there from C-137".

### Task 2: The adventure at READY 10

**Files:**
- Modify `src/components/rickmorty/adventure/episodes.js:21` (`READY = 10`).
- Modify the frontier's tests: `episodes.test.js`, `story.test.js`, `hud.test.js`, `adventure.test.js`, `StoryList.test.jsx`, `EpisodeCard.test.jsx`.
- Modify the story check's frontier: `scripts/rm-story/helpers.mjs` (`CITADEL = EPISODES[9]`) and `late.mjs`'s episode-9 tail.

The edits follow P8's commit `afcc81b25`, every moved assertion as strict.

**Interfaces:** Produces `READY === 10`, and `CITADEL` in `helpers.mjs`.

- [ ] **Step 1: Write and move the tests.**
  - `episodes.test.js`: 'has thirteen episodes, the first ten ready'; new 'goes on with The Citadel': step types `['enter', 'citadel']`, the first's area `page:/c-137/citadel` at place `citadel`, the second's id `citadelout`, unlocks `['birdworld', 'gearworld', 'pluto', 'squanch']`.
  - `story.test.js`:
    - The walk's title names episode 10's places after episode 9 and every place once episode 10, the last built, is done.
    - Froopyland ends episode 9 with `[{done,8},{episode,9}]`; the Citadel and Frundles are open, the sector's four and `evilrick` shut; the objective is `{ text: EPISODES[9].steps[0].text, to: '/c-137/citadel' }`; `enter` gives `[{step,9,1}]` and `{ text: EPISODES[9].steps[1].text, to: '/c-137/citadel' }`; `citadelout` gives `[{done,9}]` with no card, every place open, objective null.
    - 'crosses into episode 3': both of episode 9's known gives episode 10's card; with `citadel: ['citadelout']` known too, the story still stops at `{9,0}` (an `enter` step is never caught up).
    - The early-Get-Schwifty case gains a trailing `'episode'` (episode 10's card).
    - New 'counts the Citadel’s escape done early': `enter` at `{9,0}` with `citadelout` known gives `[{step,9,1},{done,9}]`, `{10,0}`, Morty's line, no card.
    - `lockNote` for the sector's four reads 'Opens after episode 10, “The Citadel”.'.
  - `hud.test.js`: past the last ready episode is episode 10, and `markedTask` at `{9,0}` and `{9,1}` is null (the link goes there); after episode 9 the dial opens 24 of 32 with the sector's four locked on episode 10's note; the lead at 9 reads 'Coordinates home: 24 of 32', at 10 '32 of 32'.
  - `adventure.test.js`: `jump(9)` opens the Citadel with Bird World shut, `jump(10)` opens it, `jump(99)` stays at 10; `intro()` at `{10,0}` is null; a P8 finisher with both tasks done gets episode 10's card; new 'opens episode 10 for a visitor who finished episode 9 before it was built'.
  - `StoryList.test.jsx`: every built episode done is ten ticks.
  - `EpisodeCard.test.jsx`: new 'names episode 10 too' (`EPISODES[9]`, 'Episode 10', 'The Citadel', `<b>Rick</b>`, its intro line).
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure`. Expected: FAIL, the frontier's tests only.
- [ ] **Step 3: Implement** `READY = 10`. In the check: `CITADEL`; the episode-9 tail becomes `cardFor(9)`, `at(9, 0)`, `opens(FAIRY.unlocks, true)`, `opens([...CITADEL.unlocks, 'evilrick'], false)`, `reads(CITADEL.steps[0].text)`, and the line's link ends `#/c-137/citadel`.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty`. Expected: PASS.
- [ ] **Step 5: Commit**: "The adventure at READY 10: episode 10 is built", the moved assertions listed as P8's were.

### Task 3: What the Citadel tells of the story, pure

**Files:**
- Create `src/components/rickmorty/citadel/storyline.js` and `storyline.test.js`.
- Modify `src/components/games/pad.js` and `pad.test.js` (`stirs`).

**Interfaces:**
- Consumes `CITADEL_PAGE`, `stepPage` (Task 1), `current` (story.js).
- Produces:
  - `ENTER = { type: 'enter', area: 'page:/c-137/citadel' }`.
  - `atDoor(state, opts) → boolean`: the current step is that `enter`.
  - `asksCard(state, opts) → boolean`: the current episode has a step whose `stepPage` is the Citadel's.
  - `storyLead(state, { town = false, ...opts }) → string | null`: the current step's text when it is played here (`stepPage` is the Citadel's and it is not the door) and Rick is not in Mortytown; else null.
  - `stirs(now, before) → boolean` in `games/pad.js`: a button newly pressed (`edges`) or a stick off rest.

- [ ] **Step 1: Write the tests.**
  - 'knows the story’s at the Citadel’s door': `ENTER.area === EPISODES[9].steps[0].area`; `{9,0}` true; `{9,1}`, `fresh()` and `{10,0}` false; `{9,0}` with `{ ready: 9 }` false.
  - 'asks for the visit’s card only in an episode with a step here': `fresh()`, `{8,0}`, `{8,1}` and `{10,0}` false; `{9,0}` and `{9,1}` true; `{9,0}` with `{ ready: 9 }` false.
  - 'puts the story’s step over the Citadel’s line only while it’s played here': `{9,1}` gives `EPISODES[9].steps[1].text`; `{9,1}` with `{ town: true }` null; `{9,0}`, `{8,1}`, `fresh()` and `{10,0}` null; `{9,1}` on Free roam still gives the text.
  - `pad.test.js` 'a press or a push stirs, a hold doesn’t': null false; a resting pad false; `x` newly pressed true; `a` held since before false; `lx` 0.4 true; `ry` −0.3 true.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/citadel/storyline.test.js src/components/games/pad.test.js`. Expected: FAIL (no module; no `stirs`).
- [ ] **Step 3: Implement** both.
- [ ] **Step 4: Run** the same. Expected: PASS.
- [ ] **Step 5: Commit**: "What the Citadel tells of the story, as a pure rule, and a pad's first move".

### Task 4: The Story tab ticks the Citadel's escape done early

**Files:** Modify `src/components/rickmorty/adventure/StoryList.jsx` (`citadel = []`; `ahead` adds `s.type === 'citadel' && citadel.includes(s.id)`), `StoryList.test.jsx`, and `src/components/rickmorty/world/RmHud.jsx`'s `ThingsToDo` (reads `tp-citadel-done` once, as an array, and passes `citadel`).

- [ ] **Step 1: Write the test.** 'ticks the Citadel’s escape done before its step comes up': at `{9,0}` with `citadel={['citadelout']}`, ten ticks, 'Get through the Citadel’s business' ticked, 'Dial the Citadel' not; nine without the prop.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/StoryList.test.jsx`. Expected: FAIL (nine).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty`. Expected: PASS.
- [ ] **Step 5: Commit**: "The Story tab ticks the Citadel’s escape when it was made before its step".

### Task 5: The story check at the Citadel, written red

**Files:**
- Modify `scripts/rm-story/places.mjs` (also `ssrLoadModule` `citadel/story.js`: `citadel(done) → citadelProgress(done).objective`).
- Modify `scripts/rm-story/helpers.mjs`: `CITADEL_LINE`, `citadelUp(page)` (3D up, scrolled into view, canvas on), `citadelLine(page) → { story, text, link }` from `.citadel-stage .shire-objective` (the lead is `b.citadel-objective-story`; `text` the rest, without the ◆), `citadelReads(page, story, text)`, `citadelToast(page, text, name = null)`.
- Modify `scripts/rm-story/late.mjs`: `episode-10` (fresh save), and its header.
- Create `scripts/rm-story/citadel.mjs`: `citadel-first`, `citadel-door`, `citadel-early`, `citadel-cards`.
- Modify `scripts/rm-story-check.mjs` (the import, `SCENARIOS`, the header's hooks: `window.__CITADEL__` with `enter`) and `basics.mjs`'s `citadel` (its comment; no card; the Citadel's own line before and after the day care).

The scenarios, as the judged design writes them (scratch `p9/d-judged.md` §10):
- `episode-10`: `playTo(9)`; the episode-9 tail; through the garage portal; no card at the Citadel; `{9,1}`; the lead over day care's line; the first three scenes, then the lead over the vote's line; home by 'Back to Dimension C-137'; the line is a link back; follow it, no second card; the vote, red alert, the lead over the cruiser's line; `__CITADEL__.enter('hangar')`: 'The cruiser’s away…' stays up, then Morty's outro, named; `{10,0}`, every place open, no card, the Locos' line with no lead.
- `citadel-first`: a fresh save lands on the Citadel: no card, `{0,0}`, not on Free roam, the Citadel's own line; home: episode 1's card.
- `citadel-door`: seeded `{9,0}` and the chain to the vote done: card 10 on red alert, `sim.t` still under it and 'Wanted: Rick C-137'; shots at 1280×720 and 390×844; a stubbed pad's press closes it and the clock runs; a reload shows no card; `jump(9)` is fed again within 2 s (`{9,1}`, the lead, no link); home shows no card.
- `citadel-early`: seeded `{9,0}` and all six done: card 10 in C-137; the Story tab ticks the escape; the link to the Citadel; Morty's outro once, no card, `{10,0}`, 'The Citadel’s behind you. Portal home, or look round once more.'.
- `citadel-cards`: seeded `{9,0}`, 3D off: cards mode, `{9,1}`, no card, the lead paragraph has the Citadel's line and not the story's; 'Turn 3D on' shows card 10.

- [ ] **Step 1: Write them.**
- [ ] **Step 2: Run** `node scripts/rm-story-check.mjs citadel-first citadel ways planet` on the dev server (5197). Expected: PASS (they pin today's right behaviour against the new ask). Then each of `episode-10`, `citadel-door`, `citadel-early`, `citadel-cards`. Expected: FAIL at their first new assertion (no lead, no card, no outro).
- [ ] **Step 3: Commit**: "The story check plays episode 10 at the Citadel (red: the Citadel shows none of it yet)".

### Task 6: The Citadel's line and card

**Files:**
- Modify `src/components/rickmorty/citadel/CitadelWorld.jsx`:
  - imports: `Objective` from `runtime/hud`, `EpisodeCard`, `EPISODES`, `storyline.js`, `stirs`;
  - World: `story = useAdventure()`; `card`, `closeCard`, `cardRef`; the ask effect `if (!live || !asksCard(story.state)) return; const n = intro(); if (n != null) setCard(n);`;
  - `lead = storyLead(story.state, { town: inTown })` and the line as `<Objective className="shire-objective" glyph="◆" text={<>{lead && <b className="citadel-objective-story">{lead}</b>}{objective}</>} />`;
  - the card after the toast;
  - the hold: `still = cardRef.current != null`; `dt` is 0 while still; the watchers' `active` and the Locos' step skip while still; `if (still && stirs(raw, before)) closeCard()`;
  - the header comment.
- Modify `src/components/rickmorty/citadel/citadel.css`: the line's words in its ink (`.citadel-stage .shire-objective .hud-objective-text`); the lead (`.citadel-objective-story`: block, the Citadel's cyan, red on red alert, at least 0.72 rem); the card in the Citadel's glass and edge (`--rm-glass: var(--shire-glass-hi)`, `--rm-lime: var(--shire-gold)`, `--rm-ink`, the panels' border and radius).
- Modify `src/components/rickmorty/adventure/EpisodeCard.jsx` (imports `./adventure.css`; its comment) and `adventure.css` (its comments).

- [ ] **Step 1: Run** `citadel-first`, `citadel-door` (to its outro-free part), `citadel-cards`, `citadel`, `ways`, `planet`. Expected: `citadel-door` and `citadel-cards` FAIL as in Task 5.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** the same, and `episode-10` up to the escape. Expected: PASS.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty src/components/games` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: "The Citadel shows the story’s step over its own line, and an episode’s card when it’s the Citadel’s".

### Task 7: The Citadel hears the story

**Files:**
- Modify `src/components/rickmorty/citadel/CitadelWorld.jsx`:
  - the parent: `news` state; `tell(e)` adds what `feed(e)` returns; `heardNews(k)` slices off the first k; `door = atDoor(storyAt)`; the mount effect `tell(ENTER)` with deps `[tell, door]`; `complete` tells `{ type: 'citadel', id }`; World gets `news` and `heardNews`;
  - World: the drain effect, `if (!news.length || !live || toast) return;` then `newsOf(news)`, `heardNews(news.length)`, the last line as a toast `{ text, name: who }`, the card if any;
  - the toast draws `<b>{name}</b>` and stays 5600 ms when it has a name (C-137 keeps a story line as long), `data-story` on it;
  - `enterRef` and `__CITADEL__.enter(id)` (the real escape, for the check); the hook deleted on unmount when it's this world's.
- Modify `citadel.css` (the toast's name in the Citadel's cyan and Orbitron; the story toast's animation 5.2 s) and `adventure/hud.js`'s header comment (the Citadel calls `newsOf` too).

- [ ] **Step 1: Run** `episode-10` and `citadel-early`. Expected: FAIL at the outro.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** `episode-10`, `citadel-early`, `citadel-door`, `episode-9`. Expected: PASS.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit**: "The Citadel says the story’s closing line after the escape’s own".

### Task 8: The guide, the shots and the hand-off

**Files:**
- Modify `src/components/guide/pages.js` (the Citadel page's tips gain `['The story', 'The Citadel is episode 10 of the story: its step heads the line at the top, and getting away in the cruiser ends it.']`) and `pages.test.js` ('tips the story on the Citadel’s page').
- Shots: `HUD=1 OUT=… node scripts/citadel-shots.mjs lift`, on main (5199) and the branch (5197), at 1280×720 and `W=390 H=844`: the `{0,0}` line looks the same. The check's `OUT` shots: `episode-10-line`, `episode-10-outro`, `citadel-door` at 1280 and 390.
- Modify `docs/superpowers/HANDOFF-worlds.md`: episode 10's paragraph; 'P9 in, P10 next'; follow-ups for P10 (`playTo` past episode 10; the Citadel's home link once its step is C-137's; the outro and card 11 arriving together at READY 11; C-137's card and a pad).
- Modify `docs/superpowers/plans/2026-10-19-rm-adventure.md:3` (P8's merged; P9's is this file) and delete the P8 plan.

- [ ] **Step 1: Write the guide's test.** Expected FAIL, then the tip, then PASS (`npx vitest run src/components/guide`).
- [ ] **Step 2: Take the shots** and compare the `{0,0}` line on main and the branch.
- [ ] **Step 3: Write the hand-off.**
- [ ] **Step 4: Commit**: "The guide tips the story at the Citadel, and the hand-off says what P9 landed".

### Task 9: Prove it, review, PR, merge on green

- [ ] **Step 1:** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, then `git checkout public/github.json`.
- [ ] **Step 2:** the full `node scripts/rm-story-check.mjs` on 5197.
- [ ] **Step 3:** a review workflow (five dimensions: the story rules and links, the Citadel's wiring and hold, the look and HUD rule, the check, the owner's rules and docs), a skeptic for each finding, then one fix pass red to green for Critical and Important findings; Minors to the ledger.
- [ ] **Step 4:** one PR; CI; merge on green.
