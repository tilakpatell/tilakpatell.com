# The Rick and Morty adventure: the close

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the site says what the adventure is now that all thirteen episodes are built: the copy that counts or describes C-137's places tells the truth, and the docs map, hand over and backlog it.

**Architecture:** copy and docs only, and five stale code comments; no behaviour changes. The dial's count is pinned to `DIAL.length` by a test, so it can't drift from the copy again. What needs code (the bench's prompt at the last step, the four dialled planets' hints, the achievements nothing earns, the universe map's Gazorpazorp copy) is the audit's, which follows this.

**Tech Stack:** React copy modules (`guide/`, `tour/`), Vitest, Markdown.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` (§ The phases, "The close"); index `docs/superpowers/plans/2026-10-19-rm-adventure.md`. The facts below were established by a read-only research workflow (scratch `close-research.json`, 44 facts and 49 checked items, each cited).

## Global Constraints

- The dial has **thirty-two** places (`DIAL` in `world/dimensions/destinations.js`): Blips and Chitz, twenty-six from the show, the Citadel and four of the sector's planets. `DESTINATIONS` has thirty-six rows (ten of them planets, six reached only from the universe map).
- `ABOUT['/c-137']` stays at most 22 words (`tour/steps.test.js:289-296`). A tour stop is 12 to 45 words, curly quotes only, and the player tour reads in 660 s (it measures 620 s).
- A new C-137 guide tip goes before 'Fantasy World' (`guide/pages.test.js:61` pins the last seven tips).
- The flight-island's marked rows stay marked (`guide/abouts.js:12`, `tour/briefs.js:220-244`).
- Every said line elsewhere is kept word for word; no model or audio file; not draft PR #1028's files (merged now), the galaxy's planet engine or Gazorpazorp.
- Open PRs touch `docs/architecture.md` (#1206, the galaxy surface line), `guide/pages.js` (#1206) and `HANDOFF-worlds.md` (#1212, #1217, the Hogwarts lanes): edit other hunks only.

## Review Focus

1. A count of C-137's places anywhere a visitor reads it (the guide, the tour, the briefs, the Rick and Morty page, the HUD) that isn't thirty-two, or that counts the thirty-six as the dial.
2. Copy that tells a new visitor everything is open (the story opens the dial an episode at a time from Customs; Free roam opens it all).
3. The hand-off's "Left" listing a debt that's been paid, or missing one P12 left.
4. A doc pointing at a file, a key or a hook that isn't there.
5. A tour stop over its word budget, or straight quotes.

---

### Task 1: The copy counts the dial as it is

**Files:** `src/components/guide/abouts.js:24`, `src/components/guide/c137.js:27` (+ a tip), `src/components/tour/chapters/player.js:78`, `src/components/tour/briefs.js:623,641`, `src/components/rickmorty/world/rules.js:1078,1118`, `src/pages/RickMorty.jsx:74`, `src/components/Achievements.jsx:117`; tests `src/components/guide/pages.test.js`, `src/components/rickmorty/world/hud.test.js` fixture if it copies :1118.

- [ ] **Step 1: the failing tests** in `guide/pages.test.js`:
  - `'counts the portal gun’s places as the dial has them, everywhere it’s told'`: `spell(DIAL.length)` (`'thirty-two'`, a two-line tens-and-units helper in the test) appears in `ABOUT['/c-137']`, the C-137 'The portal gun' tip, the tour's C-137 stop and the C-137 brief's 'Where to start'; none of them says 'twenty-six places' as the whole or 'thirty-six'.
  - `'tells the story on C-137’s page: a tip before Fantasy World'`: the C-137 tips include 'The story', naming Things to do's Story tab and Free roam, before 'Fantasy World'.
- [ ] **Step 2:** run `npx vitest run src/components/guide/pages.test.js` → FAIL (twenty-six, thirty-six; no 'The story').
- [ ] **Step 3:** the copy, from the research's proposals (items 1–6, 14, 15, 11, 44), each in its file's voice and inside its limits.
- [ ] **Step 4:** `npx vitest run src/components/guide src/components/tour src/components/rickmorty src/lib/words.test.js` → PASS.
- [ ] **Step 5:** commit.

### Task 2: Stale comments

**Files:** `world/games/deal.js:2` (Pluto's game is in), `world/RmWorld.jsx:557`, `world/rules.js:1106-1107` (four planets are dialled too), `rickmorty/planets/saves.js:2` (`tp-c137-done`, not `tp-rm-done`).

- [ ] Comments only; `npm run lint`; commit.

### Task 3: The docs

**Files:** `docs/architecture.md` (C-137's entry, a new `adventure/` entry, the Citadel's, "the five hand-offs"), `README.md:83`, `docs/README.md:13`, `docs/superpowers/HANDOFF-worlds.md` (:9, :40, :44, :112 per research items 18–27), `docs/superpowers/plans/2026-10-19-rm-adventure.md` (:3, :32, :34, :42 and the close's place ahead of P13 while its gate holds), the spec (:163, :165), `docs/autopilot/backlog.md` (:40 done, :47 the side roads are in, an item for the adventure's open ends); delete `docs/superpowers/plans/2026-10-19-rm-adventure-p12-evil-rick.md` and `docs/superpowers/plans/2026-10-21-rm-worlds-not-rooms.md` (both merged).

- [ ] Each statement checked against the code as it's written (a path, key or hook that exists); `npx vitest run docs scripts/rm-story` (the docs' own tests); commit.

### Task 4: Prove it, review, PR, merge

- [ ] `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- [ ] `node scripts/rm-story-check.mjs episode-1 dial` (the HUD copy the check reads).
- [ ] One fresh review (a workflow: copy, docs, constraints), its findings re-graded, one fix pass RED→GREEN.
- [ ] PR (draft, then ready), merge on green CI; the branch restarted from `main`.
