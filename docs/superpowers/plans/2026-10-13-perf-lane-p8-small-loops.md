# Performance lane P8, the small loops: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the portal swirl, the TV static, the hangar, the wardrobe and the Collection’s hero cost the main thread nothing when nobody can see them, and less when someone can.

**Architecture:** one helper, `src/lib/shownLoop.js`, runs a frame loop only while its element is on screen and the tab is showing (an IntersectionObserver and `visibilitychange`; no frame asked for at all out of view). The four canvas loops take it. The static becomes a picture of noise made once and moved by CSS. The wardrobe and the hero stage draw at the hangar’s 30 a second unless dragged.

**Tech Stack:** plain DOM and three.js; Vitest.

**Spec:** `docs/superpowers/HANDOFF-performance-lanes.md` (lane P8), `docs/superpowers/HANDOFF-every-world-on-webgpu.md` items 8, 15, 16 and 18.

## Global constraints

- Only P8’s files: `rickmorty/swirl.js`, `rickmorty/Cable.jsx`, `universe/shipyard/showroom.js`, `rickmorty/wardrobe/preview.js`, `galaxy/surface/heroStage.js`; and the new helper, and the static’s rule in `rickmorty/rickmorty.css`.
- Reduced motion keeps its one still frame a change.
- Measured before and after: the main thread’s ms a second with each one shown.

## Review focus

1. A loop whose element starts out of view: no frame until it scrolls in.
2. A tab hidden and shown again while the element is out of view: still no frames.
3. The still portal under reduced motion before its shader has linked: drawn once it has, not never.
4. A drag on the wardrobe or the hero: drawn at the display’s rate while dragged.
5. A canvas resized under a still portal: drawn again at the new size.

---

### Task 1: `shownLoop`

**Files:** Create `src/lib/shownLoop.js`, `src/lib/shownLoop.test.js`.

**Produces:** `shownLoop(el, frame, { IO, doc, raf, caf, onShown }) → { stop(), running }`.

- [x] Tests: frames while shown; none out of view and again when back; none in a hidden tab; stays stopped in a visible tab while out of view; never two loops; `onShown` on each change; `stop()` lets go of the observer and the document; runs without an observer.
- [x] Implement; pass; commit.

### Task 2: the loops on it

**Files:** Modify the five files above and `rickmorty.css`.

- [x] `runSwirl` on `shownLoop`; its still frame drawn only when the opening or the box changes, and only counted once painted (`draw` returns whether it painted).
- [x] The static: noise made once (`noiseUrl`, 80 × 60, tiled twice), `rm-static-jump` moving it.
- [x] The hangar, the wardrobe and the hero stage on `shownLoop`; the wardrobe and the hero at 30 a second unless dragged.
- [ ] Measure before and after (`portal`, `wardrobe`, `hangar`, `collection`); the four checks; pull request; merge on green.
