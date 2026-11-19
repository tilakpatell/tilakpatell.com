# Ships lane 2: the market — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Goods that differ by area, stations that make and need them, prices that drift and fall as you sell, a hold for each crew, mining and salvage into it, and a Market tab at a docked station.

**Architecture:** Pure modules in `src/components/universe/market/`. The market store is made beside the wallet in `EconomyProvider.jsx` with the same saves and handed out by `useEconomy()` as `market`. The hold is the wallet’s cargo (`economy.setCargo`), so Mk IV and Mk V take their rares from it. The scene stows what mining and salvage give through `createThingPlay`’s new `stow`.

**Tech Stack:** plain ES modules, Vitest, React (the tab only).

**Spec:** `docs/superpowers/specs/2026-11-18-ships-market-exploration-design.md`, section 2.

## Global Constraints

- Pure first: `market/*.js` import no React, DOM or three.js; each has its test beside it.
- Seeds and deltas only: the saves keep holds, your sales and buys at a station with when, the fields emptied with when, the wrecks salvaged; never a generated thing.
- Prices are whole credits, at least 1; a station sells for 12 % more than it buys, so a round trip at one station never pays.
- Nothing lost: `tp-pilot` reads as before; no hold saved reads as an empty hold.
- The layout session’s `src/lib/space/regions.js` isn’t on `main` yet: `areas.js` takes a region source (`setRegions(fn)`) and has a stand-in of the same shape till it lands.

## Review Focus

- A sale or buy with no wallet or no hold: refused, nothing changes. Pinned in Task 5.
- Selling more than the hold has, buying more than the room or the credits: clamped or refused, never negative. Pinned in Tasks 3 and 5.
- A field mined, then the page reloaded: still empty for 2 hours. Pinned in Task 4.
- A drifting price: the same station, good and clock give the same number anywhere. Pinned in Task 2.
- A junk save (`tp-ships`, `tp-market`): read as empty, never thrown on. Pinned in Task 4.

---

### Task 1: Areas and stations
**Files:** `market/areas.js`, `market/stations.js` and their tests.
- `AREAS`: the spec’s table, `{ [id]: { name, kind, specialties, wants, rares } }`, for `core`, the neighbourhoods (`heroes`, `fantasy`, `earth`, `music`, `arcade`), the portals (`maelstrom`, `rift`), the pockets (`starwars`, `curve`) and the region kinds (`ice`, `reef`, `grave`, `haven`, `cradle`, `deep`, `forge`).
- `distanceOf([sx, sy, sz])`: Chebyshev from the Core. `areaOf(sector) → { id, kind, name, danger, richness }` from the region source (null from it is the Core); the stand-in: sector 0 the Core, else a region kind for each 3 × 3 × 3 block by its hash, danger and richness growing with distance. `raresAt(area, d)`: the area’s rares from 10 sectors out, their pure grade from 25.
- `STATION_TYPES`: mining, industry, farming, research, military, frontier with `makes` and `needs`; `stationTypeOf(seed, area)`, weighted by the area’s kind; `tradesOf(type, area) → { sells, buys }`: it sells what it makes, its area’s specialties and the basics; it buys every good.
- Tests: every good an area names exists; the same seed gives the same type; a forge mostly makes industry stations; `raresAt` gives none under 10.

### Task 2: Prices
**Files:** `market/prices.js` and its test.
- `PRICE = { make: 0.6, need: 1.5, home: 0.5, haulPer: 0.1, haulMost: 2, spread: 1.12, drift: 0.25, step: 0.015, halfLife: 15 min, floor: 0.5, ceil: 1.5 }`. The spec’s haul (to 3 at 10 sectors) is halved to start, a finding the lane 4 pacing test settles.
- `drift(stationId, goodId, t)`: two waves, periods 2 to 8 hours from the hash, ±`drift` together.
- `yoursAt(entry, t)`: your net units sold there, halved every `halfLife`.
- `priceOf({ stationId, type, area, good, from, at, t, shock, yours }) → { sell, buy }`.
- Tests: buy ≥ sell + 1 at any clock; selling ten drops the next sale; the same input gives the same price; a specialty hauled 10 sectors sells for twice its home sale or more.

### Task 3: The hold
**Files:** `market/hold.js` and its test.
- `readHold(raw)` (lots: `{ good, n, from }`, junk dropped); `holdOps(lots, room)` → `{ used, room, count(good), add(good, n, from) → added, remove(good, n) → removed lots (oldest first), has(goods), take(goods), goods() → [{ id, name, n }] }`.
- Tests: add stops at the room; remove takes the oldest first and keeps each lot’s origin; `has`/`take` by good across lots.

### Task 4: The store
**Files:** `market/store.js` and its test.
- `createMarket({ saves, now })`: `tp-ships` v1 `{ [crew]: { hold: lots } }`, `tp-market` v1 `{ yours: { 'station|good': { n, t } }, emptied: { id: t }, salvaged: [ids] }` (each capped at 2,000, the oldest dropped). `{ hold(crew, room), cargo(crew, room) → { has, take }, yours(stationId, good, t), note(stationId, good, n, t), empty(id, t), isEmpty(id, t) (2 h), salvage(id), salvaged(id), shock(stationId, good, mul, until), shockOf(stationId, good, t), on(fn) → off, flush() }`.
- Tests: a reload keeps the hold, a field emptied and a wreck salvaged; junk saves read empty.

### Task 5: Trading
**Files:** `economy.js` (`credit(n, why)`: credits and earned, log kind `credit`), `market/trade.js` and its test.
- `boardOf({ market, economy, station, crew, room, t }) → [{ id, name, have, sell, buy, canSell, canBuy }]`; `buyGood(...)`, `sellGood(...)`, `jettison(...)`. Buying spends through `economy.spend`, selling credits through `credit`.
- Tests: no wallet, nothing; selling what you haven’t got refused; a buy past the room or the credits refused; a sale moves the credits and the hold, and lowers the next price.

### Task 6: What mining and salvage give
**Files:** `market/yields.js` and its test; `things/index.js` (`stow`); `scene.js` (passes `stow` with the current crew’s hold and the sector’s area).
- `yieldOf({ kind, id, seed, sector, area }) → [{ good, n }]`: a field iron or titanium, an ice field ice or comet water, a wreck, outpost or debris scrap, components and data cores; each a chance of the area’s rare by `raresAt`.
- A field emptied stays empty 2 hours; a wreck salvaged gives nothing again.

### Task 7: The Market tab, the cargo, and the hand-off
**Files:** `EconomyProvider.jsx` (the market made beside the wallet; `useEconomy()` returns `market`), `UniverseMap.jsx` (`economy.setCargo(market.cargo(ship, room))`), `places/MarketTab.jsx` on `PlaceCard` when docked at a station, `ships/sheet.js` (`LIVE` gains `hold`; the hold read-out), the hand-off, the spec’s haul finding.
- Check in the browser: earn, dock at a generated station, buy one good, sell it back for less, and the hold and credits move.
