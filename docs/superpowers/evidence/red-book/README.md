# The Red Book: the numbers

`lab/redbook/shots.mjs` (desktop at 1440 × 900, phone at 390 × 844) took these from the dev server, on the container’s software GL at the high tier, after the second pass (the design’s §11). The draws and triangles are `renderer.info` for the frame shot, read by `window.__REDBOOK__.info()`. The screenshots are remade by the script, not committed.

| shot | draws (desktop) | triangles (desktop) | draws (phone) | triangles (phone) |
| --- | --- | --- | --- | --- |
| arrival, the book shut in the room | 111 | 48,033 | 87 | 46,479 |
| Bag End, open | 103 | 46,871 | 68 | 35,573 |
| Bree | 98 | 46,861 | 63 | 35,563 |
| Moria | 98 | 46,861 | 63 | 35,563 |
| the beacons | 96 | 46,857 | 61 | 35,559 |
| a leaf in the air, Bree to Weathertop | 86 | 46,929 | 51 | 35,631 |
| the Ring on, Weathertop | 109 | 41,509 | 77 | 35,591 |
| the stone held, the Eye opening | 66 | 41,183 | 54 | 40,763 |
| the stone, the Eye seeing you | 60 | 41,151 | 54 | 40,763 |
| looking round the study | 130 | 47,961 | 115 | 46,687 |
| the hearth | 62 | 35,853 | 45 | 35,513 |
| the round door | 61 | 40,939 | 33 | 36,083 |
| out of the round window | 48 | 61,545 | 40 | 61,479 |
| the Ring in your hand | 110 | 71,857 | 78 | 65,939 |
| the Ring in the fire | 81 | 66,331 | 61 | 65,999 |

The design’s targets (§7) are ≤ 140 draws and ≤ 150 k triangles; the most is 130 draws, looking round the study with all of it in view. The window’s night is few draws but more triangles: its ground, trees, hedge and lights are instanced, and Gandalf is the site’s own cast model, the one thing fetched (0.52 MB, when the window is first looked out of). Every other picture is painted in code, and the voices and clips come on a press. On the phone the book fills the frame, so less of the study is in view and fewer draws are made. Frame time is the owner’s machines’ to judge; the container draws in software.
