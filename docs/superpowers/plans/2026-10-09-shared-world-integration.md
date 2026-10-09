# Shared World Integration Plan (lane D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/fly/:planet`, other pilots' ships appear and move (volatile, by cell), a turret or structure placed by a key stays for everyone (durable), turrets fire at ships, and a turret's health is worn down through the database.

**Architecture:** The flight world joins room `fly-v1:<planetId>` with `cells` from `src/lib/net/cells.js`, sends poses through `flightProtocol.js`, draws peers from one instanced pool; `createEntityLoader` follows the ship and `structures.js` draws its entities from pools; a placement goes to the loader, then a `built` hint on the room; turrets aim and fire locally; a hit on a turret calls `damage`. Nothing new in the lib: this lane composes lanes A, B and C.

**Tech Stack:** what A, B and C shipped.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 3, decisions 8 to 10)

## Global Constraints

- Starts from `main` after lanes A, B and C are merged; touches `src/components/expanse/flight/` and `scripts/online-check.mjs` only, plus a paragraph of docs.
- The key to build is `B`, to take down your own `X`; the prompt is key first (“B Build turret”); one toast a sentence; British spelling, curly quotes.
- Rates and tags are `flightProtocol.js`'s; the loader's `radius` is 1 unless the measurement in Task 5 says 2.
- No model names in code, docs or commits. Commits end with the harness's attribution lines.
- Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth`, `node scripts/online-check.mjs --fly`.

## Review Focus

1. **No durable layer** (no env): `B` says “Nothing is kept on this build” once and builds a local-only turret that vanishes on leave. Task 3.
2. **A `built` hint for a cell the loader does not hold**: ignored. Task 3.
3. **Two pilots place in the same cell in the same second**: both see both (realtime or hint, whichever first; the second arrival is a `change`, not a double). Task 3's loader fake.
4. **A turret's hp reaches 0 from someone else's shots**: it leaves every client (realtime `DELETE`); the local pool slot is freed. Task 4.
5. **A pilot's pose from two cells away after they stopped being in your 3 × 3**: their ship goes stale and is hidden after `STALE_MS` as the universe's are. Task 2.

---

### Task 1: The room, joined by cell

**Files:**
- Create: `src/components/expanse/flight/online.js`, `online.test.js`
- Modify: `scene.js`

**Interfaces:**
- Consumes: `joinRoom` (lane C's `cells`, `setCell`, `setCells`), `netCellOf`, `netCellsAround`, `cellTag`, `flightProtocol.js`, `visitKeys` as `middleearth/towns/travellers.js` uses them.
- Produces: `createFlightOnline({ planetId, join = joinRoom, hidden }) → { status, update(ship, dt) (a pose at POSE_MS, the cell tag kept current, the 3 × 3 re-asked on a cell change), peers() → [{ id, name, pose, at }], shot(at, v), built(id, cell), gone(id), on(fn), leave() }`.

- [ ] **Step 1: Failing test** with a fake `join`: `update` at `(0, 0)` sets the cell tag `hoth/0,0` and `setCells` the 9 round it; a move to `(2100, 0)` sets `hoth/1,0` and re-asks; poses go out at `POSE_MS` at most; a peer's pose comes back through `peers()`; a peer not heard for `STALE_MS` is dropped.
- [ ] **Step 2:** FAIL. **Step 3:** Write it. **Step 4:** PASS. **Step 5: Commit** `The flight's room, listened to by cell`.

### Task 2: The other ships

**Files:**
- Create: `src/components/expanse/flight/peers.js` (one pool of the ship wedge, a slot a peer, poses eased as `universe/online/pilots.js` eases them: read its `slerp` use), a kit tag through `src/runtime/hud/` for the callsign
- Modify: `scene.js`

- [ ] Draw peers from `online.peers()` each frame; a stale peer frees its slot. Check in two browsers (`npm run dev`, two windows on `/fly/hoth`): the other wedge moves; fly two cells apart: it is gone after `STALE_MS`.
- [ ] **Commit** `Other pilots on the planet, drawn from the cells round you`.

### Task 3: Building

**Files:**
- Create: `src/components/expanse/flight/structures.js` (pools per `entity_type`: `turret` a cylinder and a barrel, `structure` a dome, `beacon` a pole with a light, `wreck` the ship wedge tipped; a slot an entity id), `buildRules.js`, `buildRules.test.js`
- Modify: `scene.js`, `FlightHud.jsx` (the prompt, the toast)

**Interfaces:**
- Consumes: `createEntityLoader`, `client`, `signIn` (lane B), `online.built`.
- Produces: `canBuild(ship, groundY, pois) → { ok, why }` (under 60 m up, over ground not a POI's flat, speed under 120); `placementFor(ship, groundY) → { x, y, z, rot: [0, yaw, 0], scale: 1 }`.

- [ ] **Step 1: Failing test** `buildRules.test.js`: too high, too fast, inside Echo Base's `r + edge`: `ok: false` with a `why` sentence each; else `ok` and a placement on the ground with the ship's yaw.
- [ ] **Step 2:** FAIL. **Step 3:** Write. **Step 4:** PASS.
- [ ] **Step 5:** Wire: `signIn` on entering the world (`client()` null: the toast once, local-only mode); `loader.update(ship.x, ship.z)` each frame; `loader.on` events into `structures.js`; `B` → `canBuild` → `loader.place({ type: 'turret', ...placementFor, hp: 100, metadata: { pilot: name } })` → on success `online.built(id, cellTag)`, a toast “Turret built”; `X` on your own nearest within 30 m → `loader.remove` → `online.gone`; a `built`/`gone` from a peer → `loader.refetch(cell)`.
- [ ] **Step 6:** Two browsers: build in one, see it in the other within a second; reload both, still there. **Commit** `Build a turret that stays for everyone`.

### Task 4: Turrets that fire, and take damage

**Files:**
- Create: `src/components/expanse/flight/turretRules.js`, `turretRules.test.js`
- Modify: `structures.js`, `scene.js`

**Interfaces:**
- Produces: `TURRET = { range: 600, rate: 1.5, damage: 8, turn: 2.0 }`; `aimTurret(turret, targets, dt) → { yaw, pitch, fireAt: target | null }` (the nearest target in range, not its owner's ship, one shot a `1 / rate` s).

- [ ] **Step 1: Failing test**: picks the nearest in range, never its owner, fires at the rate, turns no faster than `turn` a second.
- [ ] **Step 2:** FAIL. **Step 3:** Write. **Step 4:** PASS.
- [ ] **Step 5:** Each client runs every turret it holds against the ships it sees (its own included); a bolt at your own ship is your hit (the universe's shield path); your bolt on a turret → `loader.damage(id, 8)`, the bar on its tag; hp 0 → the slot frees. **Commit** `Turrets fire, and wear down through the database`.

### Task 5: The two-browser check and the measurement

- [ ] `scripts/online-check.mjs --fly`: two headless browsers on `/fly/hoth`; one at cell `0,0`, one at `5,5`: no pose crosses; the second flies to `1,1`: a pose crosses within 2 s; one builds, the other sees it. Record how many poses a second each took with 2 pilots and, by a third fake sender, with 10: if a client at `radius: 1` takes over 60 messages a second at 10 pilots, keep 1; if the fastest ship outruns its 3 × 3 between re-asks, set 2 and say so in the handoff.
- [ ] Docs: a paragraph in `docs/architecture.md`; the handoff's lane D row and Left. Merge `origin/main`, the checks, push, PR with the two-browser numbers, CI, merge commit.
