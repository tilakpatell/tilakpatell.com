# The Rick and Morty adventure, P0: the foundation and episode 1 — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a pure story layer that C-137, its planets and the Citadel all feed and read, one save, a dial that opens as the story goes, links so no place is a dead end, toys that tick when played, and episode 1 *Wiped* playable from the street to Customs and back.

**Architecture:** `src/components/rickmorty/adventure/` holds the episodes as data (`episodes.js`), the pure rules (`story.js`), a store over the runtime's saves (`adventure.js`) and one React hook (`useAdventure.js`). `RmWorld.jsx` and `CitadelWorld.jsx` feed it events where they already record progress, and read its objective and dial lock; nothing else in them moves.

**Tech Stack:** React 19, react-router, Vitest (node environment; components rendered with `renderToStaticMarkup`), Playwright (`playwright-core`) for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-19-rm-adventure-design.md` (sections 1, 2, 3, 7 and 8; episode 1 of section 4). Index: `docs/superpowers/plans/2026-10-19-rm-adventure.md`.

## Global Constraints

- Pure rules: no `three` and no `react` import in `episodes.js`, `story.js` or `adventure.js`; each has its test beside it, each test under a second, no network.
- The save key is `tp-rm-story`, version 1, registered on `src/runtime/saves.js` through `localSaves()` (`src/runtime/index.js`). `tp-c137-done`, `tp-citadel-done`, `tp-rm-dial` and the planets' keys are read, never rewritten by the story.
- `READY = 1` at the end of P0.
- `RmWorld.jsx` (2,068 lines) gains calls only; logic goes in `adventure/`. `CitadelWorld.jsx` (1,282) stays under 1,500. New files under 800 lines. `node scripts/health.mjs --check` stays green (`big-files` 30).
- HUD parts from `src/runtime/hud/` where one fits; C-137's objective stays its own `.rm-objective` element (it is today), its text changed.
- Copy: British spelling, curly quotes (’ “ ”), sentence case, no exclamation mark, the site's own words. An objective text is over 10 characters (`rules.test.js` holds hints to that).
- Nothing a visitor has done is lost: a returner (anything in `tp-c137-done` or `tp-citadel-done`) starts with Free roam on; ticks already saved stay.
- New entries go on the end of their lists (`DIAL`).
- No model names in code, docs or commits. No new models.

## Review Focus

1. **The live site between phases**: a new visitor who finishes episode 1 while episode 2 isn't built must find every place open, not a dial stuck at three places. Pinned in Task 3 (`dialOpen` past `READY`).
2. **A stale or locked dial setting**: `tp-rm-dial` holding a place that's locked (or a name no longer on the dial) must not open a portal to it; the portal falls back to the first open place. Pinned in Task 1 and Task 7.
3. **Done before it's asked**: a visitor who saw Dr. Wong before episode 3 mustn't have to see her again; a task already in `tp-c137-done` satisfies its step the moment the step comes up. Pinned in Task 3.
4. **The same event twice** (a talk's delayed tick and a second press of E; the Citadel's `complete` called again): the story moves one step, not two. Pinned in Task 3.
5. **Two tabs** (the Citadel in one, C-137 in another): a step done in one shows in the other without a reload. Pinned in Task 4 (the store hears `saves.watch`).

---

### Task 1: The dial's new entries and a portal that knows what's open

**Files:**
- Modify: `src/components/rickmorty/world/dimensions/destinations.js:52-54`
- Test: `src/components/rickmorty/world/dimensions/destinations.test.js`

**Interfaces:**
- Produces: `DIAL` (32 entries: today's 27, then `citadel`, `birdworld`, `gearworld`, `pluto`, `squanch`, in that order, each `{ id, name, note }`, the Citadel's with `to: '/c-137/citadel'`); `pageOf(id: string) → string | null` (the Citadel's `to`, else null); `portalTarget(dial: string, open?: (id) => boolean) → string` (the dial if it's on `DIAL` and open, else the first open `DIAL` id, else `'customs'`).

- [ ] **Step 1: Write the failing tests** in `destinations.test.js`:

```js
it('puts the Citadel and the four sector planets on the end of the dial', () => {
  expect(DIAL.slice(-5).map((d) => d.id)).toEqual(['citadel', 'birdworld', 'gearworld', 'pluto', 'squanch']);
  expect(DIAL).toHaveLength(32);
  expect(DIAL[0].id).toBe('annex');
});
it('sends the Citadel to its page, and every other dial place through the garage portal', () => {
  expect(pageOf('citadel')).toBe('/c-137/citadel');
  expect(pageOf('customs')).toBe(null);
  expect(pageOf('birdworld')).toBe(null);
});
it('opens the portal on an open place only', () => {
  const open = (id) => id === 'customs' || id === 'annex';
  expect(portalTarget('annex', open)).toBe('annex');
  expect(portalTarget('vat', open)).toBe('annex');      // locked: the first open place
  expect(portalTarget('nowhere', open)).toBe('annex');  // not on the dial
  expect(portalTarget('vat')).toBe('vat');              // no lock given: as today
  expect(portalTarget('vat', () => false)).toBe('customs');
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/world/dimensions/destinations.test.js` — Expected: FAIL (`pageOf` is not exported; `DIAL` has 27).

- [ ] **Step 3: Implement** in `destinations.js`. The four planets' `{ id, name, note }` come from their `DESTINATIONS` rows (`destinationById`); the Citadel's note is the site's own line (“The Citadel of Ricks: every Rick there is, and a Council to keep them in line.”). `linkTarget` already sends a dialled planet to its area (the planets' areas are in C-137's world); check it does, and leave it be.

- [ ] **Step 4: Run** the same command — Expected: PASS, and the file's other tests still pass.

- [ ] **Step 5: Commit** — `git commit -m "The dial gains the Citadel and the sector's four planets, and the portal opens only on an open place"`

---

### Task 2: The thirteen episodes as data

**Files:**
- Create: `src/components/rickmorty/adventure/episodes.js`
- Test: `src/components/rickmorty/adventure/episodes.test.js`

**Interfaces:**
- Consumes: `DIAL` (Task 1), `TASKS` (`world/rules.js`), `QUESTS` (`citadel/story.js`).
- Produces: `EPISODES: Episode[]`; `READY: number` (= 1); `START: string[]` (= `['customs']`); `WINS: string[]` (= `['cabinet', 'chase']`); `STEP_TYPES` (= `['task', 'win', 'enter', 'talk', 'use', 'citadel', 'all']`). `Episode = { id, title, intro: [who, text][], steps: Step[], outro: [who, text][], unlocks: string[] }`; `Step = { type, text, id?, game?, area?, who?, place?, steps? }` (`place`: the dial place the step needs, if any).

- [ ] **Step 1: Write the failing tests** (`episodes.test.js`):

```js
it('has thirteen episodes, the first ready', () => { expect(EPISODES).toHaveLength(13); expect(READY).toBe(1); });
it('knows every step it waits for', () => {
  const tasks = new Set(TASKS.map((t) => t.id)); const quests = new Set(QUESTS.map((q) => q.id));
  for (const s of allSteps()) {           // allSteps: every step, an `all`'s parts included
    expect(STEP_TYPES).toContain(s.type);
    if (s.type === 'task') expect(tasks.has(s.id)).toBe(true);
    if (s.type === 'citadel') expect(quests.has(s.id)).toBe(true);
    if (s.type === 'win') expect(WINS).toContain(s.game);
    expect(s.text.length).toBeGreaterThan(10); expect(s.text).not.toMatch(/!/);
  }
});
it('opens every dial place, each once', () => {
  const opened = [...START, ...EPISODES.flatMap((e) => e.unlocks)];
  expect(new Set(opened).size).toBe(opened.length);
  expect(new Set(opened)).toEqual(new Set(DIAL.map((d) => d.id)));
});
it('opens a step’s place before the step comes up', () => {
  EPISODES.forEach((e, i) => {
    const open = new Set([...START, ...EPISODES.slice(0, i).flatMap((x) => x.unlocks)]);
    for (const s of stepsOf(e)) if (s.place) expect(open.has(s.place), `${e.id}: ${s.place}`).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/episodes.test.js` — Expected: FAIL (no module).

- [ ] **Step 3: Write `episodes.js`** with this data (exact copy; `place` on every step that needs the dial). A header comment in the file's voice says what an episode and a step are, and that each phase raises `READY`.

```js
// 1 Wiped — unlocks ['annex', 'meeseeksgolf']
intro: [['Rick', 'The Federation came through the garage at dawn and wiped my portal gun. Every coordinate. I keep backups, Morty. I’m not an animal.']]
steps:
  task diner        'A Federation agent is in a booth at Shoney’s, up the street. Find out what the raid took.'
  task basement     'Rick keeps backups under the garage. Find the hatch in the floor.'
  task mindblowers  'The backup chip is in the Mind Blowers chair, through the clone lab. Sit in it.'
  task customs  place customs  'Dial Customs on the portal gun and get back out with the first coordinates.'
outro: [['Rick', 'One set home. The rest are scattered, because past me was a genius and also kind of a jerk.']]
// 2 Arcade money — ['agency', 'simulation']
  task roy  place annex  'Dial Blips and Chitz and live a life as Roy.'
  win cabinet  place annex  'Rick bet the next set on a walkway cabinet at Blips and Chitz. Beat its target.'
// 3 House guests — ['microverse', 'anatomy', 'storytrain']
  task rickall  'Somebody new is in the family photos. Find the egg on the living-room bookcase.'
  task wong     'Rick won’t go to therapy. Go anyway: Dr. Wong’s office is next to Shoney’s.'
  task sewer  place agency  'Dial the agency and get down the hole into the sewer.'
// 4 Small problems — ['gromflomites', 'fortress']
  task microverse  place microverse  'The car’s battery has gone flat. Dial the Microverse and power Zeep’s world.'
  task anatomy     place anatomy     'A set of coordinates went into Ruben. Dial Anatomy Park and get it out.'
// 5 Heat — ['needful', 'vat', 'nimbus']
  win chase  'The Federation ship is over the street. Take the cruiser up and shake it.'
  task gromflomites  place gromflomites  'Dial the Gromflomites’ office and take back what the raid took.'
// 6 Bad deals — ['jerryboree', 'gloopynoops', 'prison']
  task needful  place needful  'Needful Things has something of Rick’s. Take it, and nothing cursed.'
  task vat      place vat      'Dial the vat of acid and sell the fake death.'
// 7 The Jerry problem — ['cablestudio', 'schwifty', 'dream']
  task jerryboree   place jerryboree   'Dad’s at the Jerryboree, with a lot of other Dads. Find ours.'
  task gloopynoops  place gloopynoops  'Dial St. Gloopy Noops and take back what’s Jerry’s.'
// 8 Prime time — ['fantasy', 'froopyland', 'dim35c']
  task cablestudio  place cablestudio  'Dial the cable studio and get every channel on before it goes live.'
  task schwifty     place schwifty     'The Cromulons want a hit. Dial the Get Schwifty show and give them one.'
// 9 Fairy tales — ['citadel', 'frundles']
  task fantasy     place fantasy     'Dial Fantasy World and climb the beanstalk to the giants.'
  task froopyland  place froopyland  'Dial Froopyland and get out without being found.'
// 10 The Citadel — ['birdworld', 'gearworld', 'pluto', 'squanch']
  enter page:/c-137/citadel  place citadel  'Dial the Citadel. The Council has a set of coordinates, and opinions.'
  citadel citadelout  'Get through the Citadel’s business, then out past the Cop Ricks.'
// 11 The sector — ['heistcon', 'vindicators']
  all 'Four sets are out on the sector’s planets. Dial each one.' steps:
    task birdworld  place birdworld  'Bird World: the crystals in the grass.'
    task gearworld  place gearworld  'Gear World: the city’s cogs.'
    task pluto      place pluto      'Pluto: tell the king what he wants to hear.'
    task squanch    place squanch    'Planet Squanch: get out in time.'
// 12 Big score — ['blooddome', 'evilrick']
  task heistcon     place heistcon     'Dial Heist-Con and run the job.'
  task vindicators  place vindicators  'Dial the Vindicators and answer for it.'
// 13 Evil Rick — []
  task blooddome  place blooddome  'Dial the Blood Dome and win.'
  task evilrick   place evilrick   'Dial Evil Rick’s lair and beat him.'
  task evilmorty  place evilrick   'Talk to the Morty at the lair.'
  use dial  'Take the gun home and put it back on Rick’s bench.'
```

Episodes 2 to 13 get a one-line `intro` and `outro` each in the same voice (Rick or Morty); their phases may rewrite them.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "The Rick and Morty adventure's thirteen episodes, as data"`

---

### Task 3: The story's rules

**Files:**
- Create: `src/components/rickmorty/adventure/story.js`
- Test: `src/components/rickmorty/adventure/story.test.js`

**Interfaces:**
- Consumes: `EPISODES`, `READY`, `START` (Task 2).
- Produces (each takes `{ episodes = EPISODES, ready = READY }` as a last optional argument, so tests pass small books):
  - `State = { episode: number, step: number, got: number[], wins: string[], freeRoam: boolean }`; `episode === episodes.length` once it's all done.
  - `fresh({ returner = false } = {}) → State`
  - `valid(x) → boolean` (the shape above, integers in range)
  - `feed(state, event, { known = { tasks: [], citadel: [] } } = {}) → { state, out }`. `event`: `{ type: 'task', id } | { type: 'win', game } | { type: 'enter', area } | { type: 'talk', who } | { type: 'use', id } | { type: 'citadel', id } | { type: 'none' }`. `out`: a list of `{ type: 'step', episode, step } | { type: 'done', episode } | { type: 'episode', episode } | { type: 'end' }`.
  - `current(state) → { episode: Episode, index: number, step: Step } | null` (null when all done or the episode isn't ready)
  - `objective(state) → { text: string, to: string | null } | null` (`to`: the page of an `enter page:…` step)
  - `coordinates(state) → Set<string>`
  - `dialOpen(state, id) → boolean`
  - `lockNote(id) → string | null` ('Opens after episode 4, “Small problems”.')

- [ ] **Step 1: Write the failing tests** (`story.test.js`), against a small book (`BOOK`: two episodes; the first `task a` then `all [task b, win w]`, unlocks `['p2']`; the second `task c place p2`, unlocks `['p3']`; `START` `['p1']`):

```js
it('moves on when the step’s event comes', () => {
  const { state, out } = feed(fresh(), { type: 'task', id: 'a' }, { episodes: BOOK, ready: 2 });
  expect(state).toMatchObject({ episode: 0, step: 1 });
  expect(out).toEqual([{ type: 'step', episode: 0, step: 1 }]);
});
it('ignores what the step isn’t waiting for, and the same event twice', () => {
  let s = feed(fresh(), { type: 'task', id: 'x' }, o).state; expect(s.step).toBe(0);
  s = feed(s, { type: 'task', id: 'a' }, o).state; s = feed(s, { type: 'task', id: 'a' }, o).state;
  expect(s.step).toBe(1);
});
it('finishes an `all` step in any order', () => { /* win w, then task b → episode 1, out has done 0 and episode 1 */ });
it('counts a task done before its step came up', () => {
  const s = feed(fresh(), { type: 'task', id: 'a' }, { ...o, known: { tasks: ['b', 'c'], citadel: [] } }).state;
  expect(s).toMatchObject({ episode: 0, step: 1, got: [0] }); // b counted; w still to win
});
it('keeps a win for later', () => { /* feed win w first: step stays 0, wins ['w']; then task a, task b → done */ });
it('catches up on what was done before the story existed', () => {
  const s = feed(fresh(), { type: 'none' }, { ...o, known: { tasks: ['a', 'b'], citadel: [] } }).state;
  expect(s).toMatchObject({ episode: 0, step: 1, got: [0] });
});
it('opens the start, then each finished episode’s unlocks', () => {
  expect([...coordinates(fresh(), o)]).toEqual(['p1']);
  expect(coordinates({ ...fresh(), episode: 1 }, o).has('p2')).toBe(true);
});
it('opens every place once the last ready episode is done', () => {
  const s = { ...fresh(), episode: 1 };                      // ready: 1, episode 1 not built
  expect(dialOpen(s, 'p3', { episodes: BOOK, ready: 1 })).toBe(true);
  expect(objective(s, { episodes: BOOK, ready: 1 })).toBe(null);
  expect(feed(s, { type: 'task', id: 'c' }, { episodes: BOOK, ready: 1 }).state.episode).toBe(1);
});
it('opens everything on free roam, and starts a returner on it', () => {
  expect(fresh({ returner: true }).freeRoam).toBe(true);
  expect(dialOpen({ ...fresh(), freeRoam: true }, 'p3', o)).toBe(true);
});
it('points an enter-a-page step at the page', () => { /* step { type: 'enter', area: 'page:/c-137/citadel' } → objective().to === '/c-137/citadel' */ });
it('says which episode opens a place', () => { expect(lockNote('vat')).toBe('Opens after episode 5, “Heat”.'); });
it('turns away a broken save', () => { expect(valid({ episode: -1 })).toBe(false); expect(valid(fresh())).toBe(true); });
```

(`o` is `{ episodes: BOOK, ready: 2 }`; the bodies in comments are written out in full in the test.)

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/story.test.js` — Expected: FAIL (no module).

- [ ] **Step 3: Implement `story.js`.** `feed` applies the event to the current step only when that episode is ready (a `win` is kept in `wins` either way, deduped), then fast-forwards: while the current step is satisfied by `known` (`task` in `known.tasks`, `citadel` in `known.citadel`, `win` in `state.wins`; an `all` part likewise), advance. Advancing an `all` adds the part's index to `got`; the step ends when every part is in `got`. The end of an episode's steps pushes `done`, moves to the next episode at step 0 with `got: []`, then `episode` if that one is ready or `end` if there are no more. `coordinates` = `START` ∪ the unlocks of episodes before `state.episode` ∪ (every episode's unlocks once `state.episode >= ready`). `dialOpen` = `freeRoam` or `coordinates().has(id)`. Never mutate the state passed in.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "The adventure's rules: steps, catching up, and a dial that opens as it goes"`

---

### Task 4: The store over the saves, and the hook

**Files:**
- Create: `src/components/rickmorty/adventure/adventure.js`, `src/components/rickmorty/adventure/useAdventure.js`
- Test: `src/components/rickmorty/adventure/adventure.test.js`

**Interfaces:**
- Consumes: `story.js` (Task 3); `createSaves` (`src/runtime/saves.js`) in the test; `localSaves` (`src/runtime/index.js`) and `local` (`src/lib/hooks.js`) in the hook.
- Produces:
  - `STORY_KEY = 'tp-rm-story'`
  - `createAdventure({ saves, read: { tasks: () => string[], citadel: () => string[] }, episodes?, ready? }) → { started: boolean, get() → State, feed(event) → out[], objective(), dialOpen(id), coordinates(), lockNote(id), setFreeRoam(on: boolean), on(fn) → off, jump(n) }`. `started` is true when this load made a new save for a visitor who isn't a returner (the card shows episode 1 then). On creation it registers the key (version 1, `migrate` → `fresh()` for anything older), loads it (`valid`, else fresh with `returner = tasks().length > 0 || citadel().length > 0`), feeds `{ type: 'none' }` to catch up, and saves. Every feed reads `known` from `read` at that moment. It listens to `saves.watch(STORY_KEY)` and tells its listeners when another tab writes. `jump(n)` (for the checks only) puts the story at episode `n`, step 0.
  - `useAdventure() → { started, state, objective, feed, dialOpen, coordinates, lockNote, setFreeRoam }`: one store a page visit (module-level, made on first use with `localSaves()` and `local.get('tp-c137-done', [])`, `local.get('tp-citadel-done', [])`), read through `useSyncExternalStore`. In DEV builds it sets `window.__RMSTORY__ = { get, feed, dialOpen, jump, reset }` (`reset`: back to `fresh()`).

- [ ] **Step 1: Write the failing tests** (`adventure.test.js`), with `createSaves({ local: memoryStore(), session: memoryStore(), win: fakeWin })` (a `memoryStore` of `getItem/setItem/removeItem` over a `Map`; `fakeWin` an `addEventListener` that keeps the `storage` handler):

```js
it('starts a new visitor at episode 1 with the dial shut', () => {
  const a = createAdventure({ saves, read: none });
  expect(a.started).toBe(true);
  expect(a.get()).toMatchObject({ episode: 0, step: 0, freeRoam: false });
  expect(a.dialOpen('customs')).toBe(true); expect(a.dialOpen('vat')).toBe(false);
});
it('starts a returner on free roam, caught up', () => {
  const a = createAdventure({ saves, read: { tasks: () => ['diner', 'basement'], citadel: () => [] } });
  expect(a.get()).toMatchObject({ episode: 0, step: 2, freeRoam: true });
  expect(a.started).toBe(false);
});
it('keeps the story in tp-rm-story, version 1', () => {
  createAdventure({ saves, read: none }).feed({ type: 'task', id: 'diner' });
  expect(JSON.parse(store.getItem('tp-rm-story'))).toMatchObject({ v: 1, data: { step: 1 } });
});
it('starts again on a broken save', () => { store.setItem('tp-rm-story', '{"v":1,"data":{"episode":"x"}}'); expect(createAdventure({ saves, read: none }).get().episode).toBe(0); });
it('hears another tab', () => {
  const a = createAdventure({ saves, read: none }); const heard = vi.fn(); a.on(heard);
  const other = JSON.stringify({ v: 1, data: { ...fresh(), step: 2 } });
  store.setItem('tp-rm-story', other); fakeWin.storage({ key: 'tp-rm-story', newValue: other });
  expect(heard).toHaveBeenCalled(); expect(a.get().step).toBe(2);
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/adventure.test.js` — Expected: FAIL (no module).

- [ ] **Step 3: Implement `adventure.js`**, then `useAdventure.js` over it (no test of its own: it is the store and `useSyncExternalStore`).

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "The adventure's store on the runtime's saves, and the hook every Rick and Morty page reads"`

---

### Task 5: The toys tick when they're played

**Files:**
- Modify: `src/components/rickmorty/ButterRobot.jsx:16,40-45`, `Cable.jsx:103,109-117`, `MeeseeksBox.jsx:21,50-55`, `PlumbusFactory.jsx:20,24-30`, `portal/PortalPanic.jsx:59-63,219-221`
- Modify: `src/components/rickmorty/world/RmWorld.jsx:348-357` (`openPlace`), `:1979-2019` (`Place`)

**Interfaces:**
- Produces: each toy takes `onUsed?: () => void`, called once a mount at its “used” moment: ButterRobot when the scene is `served` (:40-45); Cable on the third channel flip (`flip`, :109-117); MeeseeksBox on the first `poof` (:50-55); PlumbusFactory when `n === STEPS.length` (:26); PortalPanic on the first `'cleared'` (:219-221), passed through `GpuGate` to `Game`. Without `onUsed` they behave as today (the page's own toys, `src/pages/RickMorty.jsx`, pass nothing).
- `openPlace(id)` no longer calls `complete`; `Place` passes `onUsed={() => complete(PLACES[id].task)}` to the toy for ids with a `task`.

- [ ] **Step 1: Shoot the before**: with the dev server on 5197, `OUT=$SCRATCH/p0-before HUD=1 node scripts/c137-shots.mjs street garage living` — Expected: three PNGs.

- [ ] **Step 2: Make the change** in the five toys and in `openPlace`/`Place`. Check `WorldCards.jsx:116` (the cards without 3D) opens the same `Place`, so a card's toy ticks on use too.

- [ ] **Step 3: Run** `npx vitest run src/components/rickmorty` — Expected: PASS (no test pins ticking on open; `rules.test.js`'s seventeen tasks are unchanged).

- [ ] **Step 4: Commit** — `git commit -m "C-137's toys tick their task when they're played, not when they open"`

(The browser proof is Task 9's toy scenario.)

---

### Task 6: C-137 feeds the story and shows its objective

**Files:**
- Modify: `src/components/rickmorty/world/RmWorld.jsx` — `RmWorld` (:297), `complete` (:331-346), `go` (:784, after `s.area = l.to`), `act` (:882-931: the `dial` branch and the `SAY` branch's talk at :906-909), the `prog` passed to `RmHud` (:430, :1723-1728)
- Modify: `src/components/rickmorty/world/RmHud.jsx:132-135`

**Interfaces:**
- Consumes: `useAdventure()` (Task 4).
- Produces: `RmWorld` holds `const story = useAdventure()` and feeds `{ type: 'task', id }` from `complete` (after its own checks pass), `{ type: 'enter', area: s.area }` after an area change, `{ type: 'use', id: 'dial' }` from the dial branch, `{ type: 'talk', who: person.id }` when the `SAY` branch finds a person. `RmHud` gets `objective: { text, to } | null`; its `.rm-objective` shows `objective.text` when there is one, else `prog.objective`. A `to` makes the text a `RouterLink` to it. When the checklist's closing line says the rest are on the map, it links to `/universe`.
- Feeding `done` events: each `out` of type `done` raises the episode's `outro` as a toast (`say({ kind: 'say', who, text })`, the first line), and each `episode` sets the card's episode (Task 8).

- [ ] **Step 1: Make the change.** Keep every addition to `RmWorld.jsx` to a call or a prop; anything longer goes in `adventure/`.

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty && npm run lint` — Expected: PASS, no lint errors.

- [ ] **Step 3: Check in the browser** (dev server on 5197): load `/#/c-137` in a fresh profile; the objective reads “A Federation agent is in a booth at Shoney’s, up the street. Find out what the raid took.”; `window.__C137__.complete('diner')` changes it to the basement line.

- [ ] **Step 4: Commit** — `git commit -m "C-137 tells the adventure what's done, and shows its objective first"`

---

### Task 7: The lock on the dial, the Citadel through the portal, and the ways home

**Files:**
- Modify: `src/components/rickmorty/world/dimensions/DimensionDial.jsx:9,45-52`
- Modify: `src/components/rickmorty/world/RmWorld.jsx` — `pickDial` (:476-484), `go` (:763, where `linkTarget(via, dialRef.current)` is read), the start position, the HUD's `back`
- Modify: `src/components/rickmorty/world/RmHud.jsx:111-115,216,472-473`
- Modify: `src/components/rickmorty/citadel/CitadelWorld.jsx:369-373`, `src/pages/Citadel.jsx:20-25`

**Interfaces:**
- Consumes: `DIAL`, `pageOf`, `portalTarget` (Task 1); `story.dialOpen`, `story.lockNote`, `story.coordinates` (Task 4); `GARAGE_BACK` (`dimensions/place.js`).
- Produces:
  - `DimensionDial` items may carry `locked: string | null`; a locked item is drawn dimmed by colour (`--muted`, RULES UI 6) with its note under its name, and still calls `onPick`. The dial's `lead` reads “Coordinates home: n of 32”.
  - `pickDial(id)`: a locked id says its `lockNote` as a toast and changes nothing; an open one does as today. `dialRef.current = portalTarget(id, story.dialOpen)` (here and wherever `portalTarget` is called).
  - Stepping through the garage portal with a dial that has a `pageOf` navigates there (`useNavigate`), with `state: { from: 'c137' }`.
  - `/c-137` opened with `location.state.arrive === 'garage'` starts Morty at `GARAGE_BACK` in the garage (the same path the DEV hook's `goto` takes, :1144).
  - `Citadel.jsx`: leaving to C-137 navigates `'/c-137'` with `{ state: { arrive: 'garage' } }` (the portal terminal and the hangar both go through `onLeave`); from the map it stays `/universe/citadel`.
  - A planet landed on from the map (`planet` set): the HUD shows “Home to C-137” beside “Back to space” (`RouterLink` to `/c-137`, state `{ arrive: 'garage' }`), in the corner and in the list (:111-115, :472-473).

- [ ] **Step 1: Make the change.**

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty && npm run lint` — Expected: PASS.

- [ ] **Step 3: Check in the browser:** a fresh profile's dial shows Customs open and the rest dimmed with their notes; picking the vat says “Opens after episode 5, “Heat”.”; `localStorage['tp-rm-dial'] = '"vat"'` on a fresh profile still opens the portal on Customs; on free roam (Task 8) the Citadel dialled from the garage opens `/c-137/citadel`, and its portal terminal comes back to the garage.

- [ ] **Step 4: Commit** — `git commit -m "The dial opens as the story goes, the garage's portal reaches the Citadel, and every place has a way home"`

---

### Task 8: The episode card, the Story tab and Free roam

**Files:**
- Create: `src/components/rickmorty/adventure/EpisodeCard.jsx`, `src/components/rickmorty/adventure/StoryList.jsx`, `src/components/rickmorty/adventure/adventure.css`
- Test: `src/components/rickmorty/adventure/StoryList.test.jsx`
- Modify: `src/components/rickmorty/world/RmHud.jsx:430-473` (`ThingsToDo`), `RmWorld.jsx` (the card's state)

**Interfaces:**
- Consumes: `EPISODES`, `READY` (Task 2); `current` (Task 3); the hook (Task 4).
- Produces:
  - `EpisodeCard({ episode: Episode, n: number, onDone: () => void })`: “Episode n”, the title, the intro's first line with its speaker, on glass (alpha ≥ 0.78, no blur: RULES, the worlds' HUDs); gone on the next key or tap, or after 7 s. Shown for episode 1 when `story.started`, and on each `episode` out.
  - `StoryList({ state })`: the ready episodes in order; a finished one ticked; the current one with its steps (done ones ticked, an `all`'s parts listed); a later ready one by its title; then “More of the story soon.” while `READY < 13`.
  - `ThingsToDo` gets two tabs, **Story** (`StoryList`) and **Checklist** (the list as today), Story first; and a **Free roam** switch beside “The ship’s voice” (`story.setFreeRoam`), its line “Every place on the dial, open.”

- [ ] **Step 1: Write the failing test** (`StoryList.test.jsx`, rendered with `renderToStaticMarkup` as `planets/RmSurface.test.jsx` does):

```jsx
it('shows the current episode’s steps and ticks what’s done', () => {
  const html = renderToStaticMarkup(<StoryList state={{ episode: 0, step: 2, got: [], wins: [], freeRoam: false }} />);
  expect(html).toContain('Wiped');
  expect(html).toContain('Find the hatch in the floor');
  expect((html.match(/data-done="true"/g) ?? []).length).toBe(2);
  expect(html).toContain('More of the story soon.');
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/adventure/StoryList.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Implement** the three files and the `ThingsToDo` tabs.

- [ ] **Step 4: Run** the same command — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "The episode card, the Story tab and the Free roam switch"`

---

### Task 9: The Citadel feeds the story, and the check that plays episode 1

**Files:**
- Modify: `src/components/rickmorty/citadel/CitadelWorld.jsx:97-117` (`complete`), its mount
- Create: `scripts/rm-story-check.mjs`

**Interfaces:**
- Consumes: the hook (Task 4); `window.__C137__` (`goto`, `act`, `complete`, `ready`, `dial`) and `window.__RMSTORY__` (Task 4).
- Produces: `CitadelWorld` feeds `{ type: 'citadel', id }` from `complete` (inside its own guard) and `{ type: 'enter', area: 'page:/c-137/citadel' }` once on mount. `scripts/rm-story-check.mjs` (launch and waits copied from `scripts/c137-shots.mjs:100-148`; `BASE` default `http://127.0.0.1:5197`; exits 1 with the scenario's name on a failure) runs four scenarios, each in a fresh browser context:
  1. **Episode 1**: the objective reads step 1's text; `complete('diner')`, `complete('basement')`, `complete('mindblowers')` move it a step each; `__RMSTORY__.get()` agrees; the dial has Customs open and the vat locked; `complete('customs')` ends the episode, the outro's toast shows, and (`READY = 1`) `__RMSTORY__` says every place is open.
  2. **Returner**: `tp-c137-done = ["cable"]` before load → `freeRoam: true`, the vat open.
  3. **Toys**: open cable through `act` at its hotspot (`goto('house', …)` at the TV, from `c137-shots.mjs`'s `living` view); `tp-c137-done` lacks `cable` after it opens; after three flips (the overlay's next-channel button) it has it.
  4. **Citadel**: on free roam, `/#/c-137/citadel` loads, `__RMSTORY__.get()` is unchanged by entering (episode 10 isn't ready), `window.__CITADEL__.complete('daycare')` leaves no error in the console.

- [ ] **Step 1: Make the Citadel change**, then write the script.

- [ ] **Step 2: Run** the dev server on 5197, then `node scripts/rm-story-check.mjs` — Expected: `ok episode-1`, `ok returner`, `ok toys`, `ok citadel`, exit 0.

- [ ] **Step 3: Commit** — `git commit -m "The Citadel tells the adventure its steps, and a check plays episode 1 through"`

---

### Task 10: Prove it and hand it over

**Files:**
- Modify: `docs/superpowers/HANDOFF-worlds.md` (the C-137 paragraph: the adventure's folder, the save, the dial's lock, the check; the “Left” list: P1 next)

- [ ] **Step 1: Shoot the after**: `OUT=$SCRATCH/p0-after HUD=1 node scripts/c137-shots.mjs street garage living` and compare with Task 5's before: the objective line and the chips differ; the world's pixels don't.

- [ ] **Step 2: Run the four**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` — Expected: all green; `big-files` still 30.

- [ ] **Step 3: Run** `node scripts/rm-story-check.mjs` once more on the built site (`npx vite preview --port 5197`) — Expected: exit 0.

- [ ] **Step 4: Update the hand-off and commit** — `git commit -m "The worlds' hand-off: the Rick and Morty adventure's foundation"`

- [ ] **Step 5: Push the branch and open the pull request** (title: “The Rick and Morty adventure, P0: one story, the dial's lock, and episode 1”), body from the template if the repo has one, the before and after shots linked.
