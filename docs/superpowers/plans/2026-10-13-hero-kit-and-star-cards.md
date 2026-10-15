# A hero's own kit, and star cards that do something: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A hero deployed on the page fights with its own weapon and its own three abilities, at the game's numbers, and the three star cards picked for it in the Collection change those numbers as the game's cards do.

**Architecture:** Today a deployed hero is its side's first class with the hero's health (`src/lib/battlefront/sim.js`, "until lanes 3 and 4 give it its own kit"), and a star card is text (`rulebook.js`'s `cardOf` has no caller). A stopped lane already holds the saber heroes' kit (`origin/claude/bf-heroes-deploy`); this plan carries it forward, gives the seven blaster heroes theirs from the export's records, and adds one small pure module that turns a picked card into modifiers on the stack `affectors.js` already has, applied at the deploy. Nothing is built for a guest here: the guests' rows arrive later in the same shapes.

**Tech Stack:** plain JavaScript in `src/lib/battlefront/` (pure: no three.js, no DOM), the generated rulebooks under `src/data/bf2017/`, vitest, the arena's AI tests (`npm run test:ai -- src/lib/battlefront`), `node scripts/battlefront-balance.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-13-gpu-site-and-guest-heroes-design.md`, section 4, lanes B4 and B5. **The numbers:** `docs/superpowers/evidence/hero-kit/README.md` (every ability's effect, every primary, the cards, the thirteen kinds of card effect, how the game applies a card), each with its export record.

## Global Constraints

- Every number names its game record (`<key>_source`), or carries `"source": "hand"` and a line in `src/data/bf2017/NOTES.md`; `src/data/bf2017/rulebook.test.js` enforces it. The generated rulebooks are rewritten whole by `scripts/bf2017-data.mjs`: a number that should be in them is added through the generator (`scripts/lib/bf2017-rulebook*.mjs`), never by hand in the JSON.
- Star cards sit at top rank (the game design of 2026-10-10, "everything unlocked"): `levels[3]`.
- Three cards a unit (`src/lib/bf2017/collection.js`, `CARD_SLOTS = 3`); the picks are `localStorage['bf-collection'][heroId].cards`.
- No sequel-era unit, string or record.
- The sim lane's ground as it stands on `main` (7cc7b2792): a round's bot thinks in `ai/soldierBrain.js`'s `thinkAutoPlayer` when `brain.ap` is set, so a hero bot's rules for a round go there and not in the BattleAI modes; `autoPlayerFor` already returns the sword rows (`ap.sword`), unused; `module.js`'s `sim`, `me`, `team`, `director`, `park` and `castArm` are rebindable because a round is swapped in place.
- `figures/figures.js`'s `BODIES` and `kindOf`, the screens under `src/components/battlefront/screens/` and `BattlefrontWorld.jsx` belong to the UI lane: not edited here. What the HUD and the deploy list need from this plan is data in the view, named in each task's Interfaces.
- Before the branch is done: `npm run lint`, `npx vitest run src/lib/battlefront src/components/battlefront src/data/bf2017`, `npm run test:ai -- src/lib/battlefront`, `npx vite build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

- A hero with a card picked that names an ability it does not have (a stale store, another hero's id): the card is ignored, nothing throws.
- A fourth card in the store: three are applied, in the store's order.
- A hero deployed twice in one round: the cards' modifiers are applied once each time, never stacked from the life before.
- A bot hero (no store): the hero's base numbers, no cards.
- An ability whose effect numbers the export does not name (Lando's smoke seconds, Sharp Shot's damage): the row says so and the ability still has its timings and its other effects; no number is invented without `"source": "hand"`.

---

### Task 1: The stopped hero lane, carried forward

**Files:** whatever `origin/claude/bf-heroes-deploy` (8af51f376) changes, and the uncommitted work in its worktree `C:\Users\tilak\source\repos\new-portfolio-website\.claude\worktrees\agent-abfeade4c03499d31` (read with `git -C … status` and `git -C … diff`; that worktree is never edited).

**Interfaces:**
- Produces: on this branch, `src/data/bf2017/heroKit.json`, `src/lib/battlefront/hero.js`, `heroKit.js` (`createHero`, `heroInput`, `jump`, `onHeroAbility`, `stepHeroes`, `deflect`), `heroAbilities.js` (`KINDS`), `ai/heroBrain.js`, as that lane left them, merged with `main`.

- [ ] Merge `origin/claude/bf-heroes-deploy` into the branch; resolve against `main`'s sim (51 commits moved under it). Bring over the worktree's uncommitted files where they are coherent with what was committed; list in the report what was brought and what was left, and why.
- [ ] `npx vitest run src/lib/battlefront` and `npm run test:ai -- src/lib/battlefront` green before anything new is written. Commit.

### Task 2: A unit's own body size

**Files:**
- Modify: `src/lib/battlefront/soldier.js`, `sim.js` (the deploy), `src/components/battlefront/battle.js` (the chest it aims at)
- Test: `src/lib/battlefront/soldier.body.test.js`

**Interfaces:**
- Produces: a unit row may carry `body: { stand, crouch, chest, eye }` in metres; `bodyOf(unitRow) → { stand, crouch, chest, eye }` with the present values as the default (`stand 1.7`, `crouch 1.15`, `chest 1.4`, and the eye the code uses today); the view's entity carries `body`.

- [ ] Tests first: a unit with no `body` behaves as before to the number; a unit with `stand 1.47` is hit and aimed at by its own heights.
- [ ] Implement; run; commit.

### Task 3: The blaster heroes' weapons and abilities

**Files:**
- Modify: `scripts/lib/bf2017-rulebook.mjs` (the ability row's effect block, read from the export records the evidence file names), `scripts/bf2017-data.mjs` if a new file is written, `src/lib/battlefront/heroKit.js`, `heroAbilities.js`, `sim.js` (a hero deploys with `heroes.json`'s `primary` weapon and its own three abilities)
- Create: `src/lib/battlefront/heroBlaster.js`
- Test: `src/lib/battlefront/heroBlaster.test.js`, cases in `scripts/lib/bf2017-rulebook.test.mjs`

**Interfaces:**
- Consumes: Task 1's `onHeroAbility`, `KINDS`.
- Produces: `abilities.json` rows for the seven blaster heroes gain `effect: { kind, … }` with `<key>_source` on every number, `kind` one of `charge | thrown | weaponSwap | dash | deployShield | cloud | scan | reveal | mines | barrage | stunDroid | selfShield | slam | marks`; `heroBlaster.js` exports one handler a kind; the view's player carries `abilities: [{ slot, id, name, recharge, ready, active }]` for the HUD (it already carries slots for a class).

- [ ] Tests first, one a hero, with the evidence file's numbers: Han's Detonite Charge deals 200 at its centre and nothing past 10 m; Sharpshooter fires at 350 a minute and ends by heat; Shoulder Charge deals 200 to a trooper and 150 to a hero and Han takes 0.75 of damage while charging; Leia's Rapid Fire lasts 13 s; her shield has 3,000 health; Bossk's cloud deals 15 and then 5 a second; Boba's barrage is ten rockets of 75; Iden's shield has 250 health; Chewbacca's slam deals 200 and 150.
- [ ] Implement the kinds. Where a kind already exists in `KINDS` (a dash, a slam), the blaster hero's row is given to it; do not write a second.
- [ ] `node scripts/battlefront-balance.mjs --skirmish` before and after; put both tables in the report. Commit.

### Task 4: Cards into modifiers (pure)

**Files:**
- Create: `src/lib/battlefront/cards.js`
- Test: `src/lib/battlefront/cards.test.js`
- Modify: `scripts/lib/bf2017-rulebook-collection.mjs` (each hero card row gains `effect: { type, target, … }` where the export's card asset names it), `src/data/bf2017/NOTES.md`

**Interfaces:**
- Produces: `modifiersOf(card, level = 3) → [{ on, property, op: 'mul' | 'add' | 'set', value, while?: abilityId }]` (empty for a card whose kind is not modelled); `cardsFor(unitId, picked, rulebook) → cards` (the unit's own, at most three, in the picked order); `MODELLED = ['T1', 'T3', 'T5', 'T6', 'T7', 'T9', 'T10']`, the evidence file's kinds. The other six kinds are listed in `NOTES.md` under "Not modelled" with one line each.

- [ ] Tests first, with the game's numbers: Han's card 1 multiplies the DL-44's heat a bullet by 0.75; Leia's card 1 multiplies Squad Shield's recharge by 0.7; her card 5 takes 1.5 s off the detonators' recharge; Lando's card 9 adds 150 to maximum health; Han's card 4 multiplies damage taken by 0.6 while Shoulder Charge is active; Leia's card 4 adds 1 m to the detonators' blast; Lando's card 3 adds 15 s to the Disabler; a card of an unmodelled kind returns `[]`; the five lines of Review Focus.
- [ ] Implement; run; commit.

### Task 5: Cards at the deploy

**Files:**
- Modify: `src/lib/battlefront/sim.js` (the deploy takes `cards: [ids]`), `affectors.js` if a property is new, `src/components/battlefront/battle.js`, `module.js` (the deploy reads the picks through `src/lib/bf2017/collection.js`'s `readStore` and `picksOf`, as it already reads the skin)
- Test: `src/lib/battlefront/sim.cards.test.js`

**Interfaces:**
- Consumes: Task 4's `cardsFor`, `modifiersOf`.
- Produces: `deploy(sim, id, { kind, id, appearance, cards })`; the view's player carries `cards: [{ id, name }]`.

- [ ] Tests first: Han deployed with card 1 overheats after more shots than without, by the card's ratio; the same Han deployed again has the modifier once; a bot hero has none.
- [ ] Implement; run the whole of `src/lib/battlefront`; commit.

### Task 6: The page

- [ ] On the dev server (`--mode bucketcheck`), grant the points through the check door (`window.__battlefront.do('points', …)`), deploy as Han, fire, use each ability; then pick card 1 in the store and deploy again. Record what the view reports (the weapon, the abilities' states, the heat a shot) in the report. A picture of each ability is not asked for: this world draws stand-ins for effects (`fx/kit.js`), and drawing the heroes' effects is another lane.
- [ ] Global Constraints' checks. Push the branch; open a draft pull request that says what a hero has now, which abilities' numbers the export did not give, and which card kinds are not modelled; do not merge.
