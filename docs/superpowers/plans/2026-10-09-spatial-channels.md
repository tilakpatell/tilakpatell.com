# Spatial Channels Implementation Plan (lane C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Nostr room that listens only to the grid cells round the player: events tagged `g` with the sender's cell, a filter on `#g` for the 3 × 3 round you, re-asked on the open sockets when the set changes, and a small wire for the flight world; every existing room unchanged.

**Architecture:** A pure cell grid in `src/lib/net/cells.js`; `pool.js` gains `refresh()` on a subscription (the REQ sent again under its id); `nostr.js`'s `joinRoom` takes `cells` and gains `setCell` and `setCells`; a targeted send carries the target's cell; `flightProtocol.js` (pure) is the flight's wire over `protocol.js`'s `createLimiter`.

**Tech Stack:** Nostr NIP-01 (`#g` single-letter tag filters, REQ replacement by id), `@noble/secp256k1` through `nostr.js` as today, Vitest with the existing fake sockets (`pool.test.js`, `nostr.test.js`).

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 3, decisions 8 to 10)

## Global Constraints

- A room joined without `cells` behaves exactly as before: every existing test in `src/components/universe/online/` passes unchanged.
- `NET_CELL = 2048`; the cell tag is `<planetId>/<cx>,<cz>`; the tag letter is `g`; the room id for the flight is `fly-v1:<planetId>`.
- Rates verbatim: `pose [20, 30]`, `shot [10, 12]`, `hit [10, 12]`, `built [1, 3]`, `gone [1, 3]`, `hi [1, 4]`.
- No model names in code, docs or commits. Commits end with the harness's attribution lines.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/online-check.mjs` (the existing case still passes; the `--fly` case is lane D's, once the world exists).

## Review Focus

1. **A pilot crossing a cell boundary while others watch**: their next pose carries the new tag; a watcher whose 3 × 3 holds both cells sees no gap; one whose 3 × 3 holds only the old cell stops hearing them after that pose. Task 3's test with two fake rooms.
2. **A relay that drops the socket between `setCells` calls**: on reopen the REQ carries the *current* cells (the filter is a function). Task 2.
3. **A `hit` sent to a pilot two cells away**: it carries the target's cell tag, so it passes their filter. Task 3.
4. **A pose whose tag says one cell and whose coordinates say another, far off**: dropped by `flightProtocol.js`'s reader (a tag lie). Task 4.
5. **`setCells` with the same set**: no REQ is re-sent (the relays count REQs). Task 3.

---

### Task 1: The grid

**Files:**
- Create: `src/lib/net/cells.js`, `src/lib/net/cells.test.js`

**Interfaces:**
- Produces: `NET_CELL = 2048`, `netCellOf(x, z) → [cx, cz]`, `netCellsAround(cx, cz, r = 1) → 'cx,cz'[]` nearest first, `cellTag(planetId, key) → '<planetId>/<key>'`, `parseTag(tag) → { planetId, cx, cz } | null`, `sameCells(a: string[], b: string[]) → boolean`.

- [ ] **Step 1: Failing test**: `netCellOf(−1, 2048)` is `[−1, 1]`; `netCellsAround(0, 0)` has 9 keys, `'0,0'` first; `cellTag('hoth', '0,0') === 'hoth/0,0'`; `parseTag('hoth/-2,3')` is `{ planetId: 'hoth', cx: −2, cz: 3 }` and `parseTag('x')` is `null`; `sameCells` is order-free.
- [ ] **Step 2:** FAIL. **Step 3:** Write. **Step 4:** PASS. **Step 5: Commit** `The net's grid: cells and their tags`.

### Task 2: `refresh()` on a pool subscription

**Files:**
- Modify: `src/components/universe/online/pool.js`, `pool.test.js`

**Interfaces:**
- Produces: `subscribe(...)` returns `{ send, up, close, refresh() }`; `refresh` sends `['REQ', id, filter()]` on every socket that is open now and nothing on the others (they ask on open as before).

- [ ] **Step 1: Failing test** in `pool.test.js`: with two fake relays up and one down, `refresh()` writes one REQ to each of the two, under the subscription's existing id, with the filter function's current answer; the down one gets it when it opens; after `close()` `refresh()` sends nothing.
- [ ] **Step 2:** FAIL. **Step 3:** Write it (the `ask(sub)` the file has, over the open sockets). **Step 4:** PASS. **Step 5: Commit** `A room can ask the relays again for a changed filter`.

### Task 3: Cells in the room

**Files:**
- Modify: `src/components/universe/online/nostr.js`, `nostr.test.js`

**Interfaces:**
- Produces: `joinRoom({ ..., cells = null }, roomId)`: when `cells` is given (a function returning the tags to listen for, or `null` for all), the filter is `{ kinds, '#x': [topic], '#g': cells(), since }` whenever `cells()` is non-empty; the room gains `setCell(tag | null)` (every event sent from now carries `['g', tag]`) and `setCells(tags)` (when `!sameCells(prev, tags)`, `sub.refresh()`); `makeAction(ns).send(data, { target })` adds `['g', <target's last-seen tag>]` when the target's last event carried one (kept per peer as their words come in; `['p', ...]` and whatever a targeted send carries today stay as they are).

- [ ] **Step 1: Failing tests** in `nostr.test.js` (the file's fakes): a room joined with `cells: () => ['hoth/0,0', 'hoth/1,0']` sends a REQ whose filter has `'#g'` equal to that list; `setCell('hoth/0,0')` then a `send` yields an event with a `g` tag of that value; `setCells` with a new set calls refresh (one more REQ on the fake socket), with the same set none; a targeted send to a peer whose last event carried `['g', 'hoth/5,5']` carries that tag; a room joined without `cells` sends the old filter exactly (snapshot the existing test's expectation).
- [ ] **Step 2:** FAIL. **Step 3:** Write it. **Step 4:** PASS; `npx vitest run src/components/universe/online` all green.
- [ ] **Step 5: Commit** `A room listens by cell: the g tag on what goes out, #g on what comes in`.

### Task 4: The flight's wire

**Files:**
- Create: `src/components/expanse/flight/flightProtocol.js`, `flightProtocol.test.js` (the folder may not exist yet on main: create it; lane A adds the world beside it; if A merged first, merge main and put the file next to its `scene.js`)

**Interfaces:**
- Consumes: `createLimiter` from `src/components/universe/online/protocol.js`; `parseTag`, `NET_CELL` from Task 1.
- Produces: `ROOM(planetId) → 'fly-v1:' + planetId`; `APP_ID = 'tilakpatel-portfolio-flight'`; `RATES`; `writePose(ship) → [x, y, z, pitch, yaw, roll, speed, flags]` (rounded to 2 dp; angles wrapped); `readPose(arr, tag) → pose | null` (finite, `speed` clamped to `[0, 400]`, `null` when `hypot(x − cx × NET_CELL, z − cz × NET_CELL) > NET_CELL × 2` against the tag); `writeHi({ name, kind })`, `readHi`; `writeShot`, `readShot`; `readHit` (`d` clamped to 30); `readBuilt({ id, cell })` (a uuid and a tag, else `null`); `readGone`.

- [ ] **Step 1: Failing tests** for each reader: a good packet round-trips; a non-finite number gives `null`; a pose 5 km from its tag's cell gives `null`; `readBuilt` refuses a non-uuid; `RATES` has the spec's six rows.
- [ ] **Step 2:** FAIL. **Step 3:** Write. **Step 4:** PASS. **Step 5: Commit** `The flight's wire: poses, shots, hits and a hint that something was built`.

### Task 5: Docs and the PR

- [ ] One line in `docs/stack/multiplayer-nostr.md`'s “How the site uses it” (cells and `#g`) and in `docs/architecture.md`'s online paragraph; the handoff's lane C row. `node scripts/online-check.mjs` passes as before. Merge `origin/main`, the checks, push, PR, CI, merge commit.
