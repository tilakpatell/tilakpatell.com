# Ships lane 3: exploring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sectors charted on the way in, a scan on Z that banks exploration data, the bank sold at a station, and a jump into generated space held to the hyperdrive’s range, going on in hops past it.

**Architecture:** Pure modules in `src/components/universe/explore/` (`route.js`, `values.js`, `record.js`, `scan.js`). The record is made beside the wallet and the market in `EconomyProvider.jsx` and handed out as `record`; the scene charts in the expanse’s `onSector`, scans on Z, sells the bank when `places.docked()` turns to a station, and `trips.js`’s `go` sends a generated target past the range as a hop, the scene going on from it once the hyperdrive’s charged.

**Spec:** `docs/superpowers/specs/2026-11-18-ships-market-exploration-design.md`, section 3.

## Global Constraints

- Only an `E:` target is held to the range; every hand-made place and both portals stay one jump away. A target past the range is never refused.
- `tp-explore` keeps sector keys, a bitset of systems scanned a sector, up to 64 thing ids a sector, the unsold data and the counts. Nothing generated.
- Every `EARN` row stays whole credits and whole xp (an existing test): data is sold in fives, 5 credits and 1 xp a unit.

## Review Focus

- A scan with nothing in reach: says so, banks nothing. Pinned in `scan.test.js` and the browser check.
- The pilot flying off between hops: the hops are called off (60 units from where the last left it), as is a trip somewhere else.
- A dock with no wallet loaded yet: the bank is kept, not lost.
- A reload: the record’s charts, scans and bank come back. Pinned in `record.test.js`.

## Tasks

1. `route.js` (`isGenerated`, `sectorGap`, `hyperRoute`, `hopPoint`) and its test.
2. `values.js` (`WORTH`, `SURVEYED`, `worthOf`) and its test.
3. `record.js` (`createRecord`) and its test.
4. `scan.js` (`sweep`) and its test.
5. The scene: `chartSector` in `onSector`, `scan` on Z, `sellData` on docking, the hops’ going on; `trips.js`’s hop in `go`; `EARN.data`; the record in `EconomyProvider.jsx` and `UniverseMap.jsx`; the words (`HOPS`, `EXPLORE`); the Z key in `guide/pages.js`.
6. The Systems tab sells the scanner and says the hyperdrive’s range; `shipSheet` reads the record; `scripts/explore-check.mjs`; the hand-off.
