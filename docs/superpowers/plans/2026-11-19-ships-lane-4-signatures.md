# Ships lane 4: the signatures, the pod and the pacing test — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Each crew’s ship does its own thing (R2, the compartments, the portal gun, the lab), a ship destroyed drops its cargo as a pod, and a pacing test holds the spec’s targets and settles the numbers.

**Architecture:** Pure rules in `src/components/universe/signatures/` (`index.js`, `pod.js`) and a model of a pilot’s play in `ships/pacing.js`, tested by `ships/pacing.test.js`. The scene calls them: R2 in the shields’ recharge, the portal gun through `trips.js`’s `portal`, the lab on the frame, the check at a military dock, the pod at `destroyed` and on E. The pod is kept in `tp-market` (`store.js`’s `pod`, `setPod`).

**Spec:** `docs/superpowers/specs/2026-11-18-ships-market-exploration-design.md`, sections 1 (the signatures), 4 (the pod) and “What a tier costs”.

## Review Focus

- A Falcon going down with contraband: the compartments’ third stays aboard, the rest drops; the check never sees what’s hidden. Pinned in `signatures.test.js`.
- A pod taken aboard with the hold short of room: what doesn’t fit stays in the pod. Pinned.
- A second death before the pod’s recovered: the older pod is replaced (one at a time).
- The portal gun with a sector never charted: the hops, as any ship. Pinned by `portalReady` and the scene’s `isCharted`.
- A price or a pay changed later: the pacing test fails if a target moves by more than a fifth.

## Tasks

1. `signatures/index.js` (`SIGNATURE_LINE`, `rangeOf`, `r2Patch`, `compartmentRoom`, `hidden`, `inspect`, `portalEvery`, `portalReady`, `LAB`, `labEvery`, `labStep`) and `pod.js` (`dropPod`, `nearPod`, `recoverInto`), with `signatures.test.js`.
2. `store.js`’s pod, kept in `tp-market`.
3. The scene: R2, the portal gun, the lab, the check at a military dock, the pod (drop, beacon, E, the note at respawn); the words (`SIGNS`).
4. The Systems tab’s head: the ship’s role and its signature (`sheet.js`’s `signatureLine`).
5. `ships/pacing.js` and `pacing.test.js`; the balance pass it called for (below), the spec’s findings and the hand-off.

## The balance pass

The model’s first run, at the spec’s numbers: the first Mk II at 9.9 minutes, every system at Mk III at 3.2 hours, the first Mk V at 4.2, and exploring far out paying 17 times combat. Changed, each because the test said so:

- `explore/values.js`: a find’s distance bonus 1 + 0.08 a sector (3.4 at 30), not 0.15 (5.5).
- `ships/tiers.js`: Mk III 1,600 (not 2,000), Mk IV 8,000 (6,000), Mk V 25,000 (15,000).
- The haul stays 2 at 10 sectors (lane 2’s start): the targets hold with it.

After: the first Mk II at 10.4 minutes, every system at Mk III at about 2 hours, the first Mk V at about 4.6 hours, and no kind of play more than three times another at any tier.
