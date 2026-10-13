# The site asks for the graphics card everywhere, and a visitor on the built-in graphics is told how to reach theirs

**Date:** 2026-10-13 · **Status:** accepted · **Where:** `src/lib/gpuHint.js`, `src/components/worlds/` (`GpuHint.jsx`, `WorldGate.jsx`, `UnfitCard.jsx`, `worldgate.css`)

## Context

The owner asked for the site to force the high-performance GPU, to detect a computer with two GPUs that is not set to use the card, and to say so. Chrome's WebGPU troubleshooting guide is plain about Windows: Chrome takes one adapter for all its work, on a laptop usually the processor's built-in graphics, and the page's `powerPreference` changes nothing (crbug 369219127); the way out is the visitor's, the system's Graphics setting or `chrome://flags/#force-high-performance-gpu`. No browser on Windows shows a page a second GPU. A Mac switches by itself for a high-performance context.

## Decision

Every context the site makes asks for `powerPreference: 'high-performance'`. A page cannot force more, and cannot see a second chip, so it looks for the symptom instead: lib/gpuHint calls a chip built in by its name (Intel UHD, Iris and Arc Graphics; AMD's Radeon Graphics, 7x0M and Vega 3–11), on Windows or Linux, never on a phone, a Mac, a Snapdragon laptop or a software renderer. Over a world, once for each chip, a panel says which chip is drawing, that the site asks for the card but the browser and the system choose, and, if the computer has one, how to reach it: Windows' Graphics setting, the flag in Chrome and Edge (with a Copy button), the NVIDIA control panel; on Linux `prime-run` or `DRI_PRIME=1`. The Star Wars worlds' card for a weak chip gives the same steps.

## Consequences

- A laptop with only built-in graphics (the owner's 740M) sees the panel once too, worded “if this computer also has a card”; Got it keeps the chip told (`tp-gpu-hint`), and a new chip is told again.
- Nothing is detected for certain: the panel cannot say a card is there. Where a browser one day names a second adapter, the hint can say so outright.
- The classic pages carry no panel: they draw little.

## Revisit when

- Chrome on Windows honours `powerPreference` (crbug 369219127) or lets a page use a second adapter (crbug 329211593): then the card is reached without the visitor, and the panel goes.
- A browser exposes whether an adapter is integrated or discrete.
