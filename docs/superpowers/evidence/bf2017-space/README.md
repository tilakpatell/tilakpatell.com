# The space lane’s evidence (the fifth design’s Q)

Shots by `scripts/space-shots.mjs` (headless Chromium, software GL, the page’s clock held), 2026-10-10:

- `endor-level-far.webp`, `endor-level-near.webp`: SB_Endor_01 over Endor at high, the ring, the broken Star Destroyer, the debris belts and the second Death Star’s debris on its asteroid tracks; near, the Star Destroyer of the starfighter assault.
- `naboo-blockade.webp`: SB_DroidBattleShip_01 at Naboo, the Lucrehulk, the Venators and a landing ship.
- `kamino-fleet.webp`: SB_Kamino_01’s fleet over Kamino.
- `seam-endor-level.webp`, `seam-endor-up.webp`: Endor’s sky at ultra facing −x, where the game’s panorama (`t_space_endor01_c`, `endor.4096.ktx2`) wraps from u = 1 to u = 0: no line.
- `globes.webp`: the map’s six globes (lane K’s `PICTURES`, 96 pixels).

`galaxy-check space endor,fondor,kamino,naboo` (the ship off each planet on its sun side, the check’s own pose; Fondor is not a system on main, so its row is the route’s fallback):

| quality | endor calls · tris | kamino calls · tris | naboo calls · tris | row (calls · tris) |
| --- | --- | --- | --- | --- |
| low | 56 · 171,886 | 46 · 151,969 | 60 · 183,287 | 350 · 0.8M |
| mid | 57 · 171,886 | 47 · 151,753 | 61 · 183,297 | 500 · 1.5M |
| high | 57 · 199,337 | 48 · 179,397 | 61 · 210,721 | 700 · 3M |
| ultra | 57 · 272,809 | 48 · 252,869 | 61 · 320,799 | 1,500 · none |

The levels sit 1,100 to 1,400 units from their planets, so from the check’s pose they’re mostly past the frustum or far copies; a level in full view at high (the near shot) adds its hulls’ plain cuts (36,000 to 60,000 triangles each) and, at Endor, half the debris (about 1,100 instances in about 30 draws).
