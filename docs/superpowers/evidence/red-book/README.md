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

## After the study’s light and surfaces (the design’s §12)

The same script on the desktop, and `lab/redbook/room.mjs` for the study from the chair (the look view, its head turned to each thing):

| shot | draws | triangles |
| --- | --- | --- |
| arrival, the book shut in the room | 115 | 49,515 |
| Bag End, open | 100 | 46,967 |
| looking round the study | 134 | 49,443 |
| Sting drawn | 117 | 43,761 |
| the mithril coat | 105 | 43,713 |
| the hearth | 77 | 41,361 |
| the lantern knocked | 124 | 43,895 |
| out of the round window | 48 | 61,937 |
| the Ring in your hand | 107 | 71,953 |

Still inside 140 draws and 150 k triangles. The new lights cost no draws; on the container’s software GL a frame of the study took 1.30 s against 1.13 s before (the book 1.46 s against 1.35 s), the lights and the relief together. The surfaces are painted at load: 1.2 s in all on the container against 0.8 s before (the bookcase, the desk, the panels and the floor the most of it), less on a real machine, colour alone on the low tier.
