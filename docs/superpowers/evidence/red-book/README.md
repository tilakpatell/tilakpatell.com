# The Red Book: the numbers

`lab/redbook/shots.mjs` (desktop at 1440 × 900, phone at 390 × 844) took these from the dev server, on the container’s software GL at the high tier. The draws and triangles are `renderer.info` for the frame shot, read by `window.__REDBOOK__.info()`. The screenshots are remade by the script, not committed.

| shot | draws (desktop) | triangles (desktop) | draws (phone) |
| --- | --- | --- | --- |
| arrival, the book shut in the room | 64 | 6,035 | 59 |
| Bag End, open | 57 | 4,563 | 39 |
| Bree | 59 | 4,567 | 41 |
| Moria | 56 | 4,561 | 38 |
| the beacons | 59 | 4,567 | 41 |
| a leaf in the air, Bree to Weathertop | 54 | 4,649 | — |
| the Ring on, Weathertop | 62 | 3,231 | 46 |
| the stone held | 46 | 3,989 | 42 |

The design’s targets (§7) are ≤ 140 draws and ≤ 150 k triangles. Nothing is fetched beyond the page’s code and the Cinzel font the site already has: every picture is painted in code, and the voices and clips come on a press. On the phone the book fills the frame, so less of the study is in view and fewer draws are made. Its triangle counter read under 200 for the open book, which can’t be the whole frame (the book alone is more), so the phone’s triangles are left out until that is understood; the draws agree with what is on screen. Frame time is the owner’s machines’ to judge; the container draws in software.
