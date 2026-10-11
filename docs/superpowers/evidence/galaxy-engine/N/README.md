# Fidelity lane N: evidence

All on the cloud's SwiftShader WebGL 2 (no GPU in this machine). The WebGPU leg, the frame cost and the shots on a real chip wait for the owner's laptop.

- `run.txt`: `node scripts/bf2017-scatter.mjs hoth endor --ref origin/claude/bf2017-e0-factory`: each paint layer's texture as read from the surface combinations, the mask's shares, the meshes and the maps still missing from the bucket.
- `endor-mask.png`: the derived mask over Endor_01's near map (2.5 km square): each placed layer a colour over the ground's shade, white under placed pieces, grey where the game never painted the ground. Colours: 0 litter (sand), 1 banks (light blue), 2 roots' twigs (brown), 4 clearings (light green), 6 canopy (green), 7 distant ferns (dark green), 9 stream beds (blue).
- `endor-inputs.png`: what it is derived from: red the slope (45° full), green the canopy, blue the play area; grey unpainted.
- `endor-landing-high.webp`: `galaxy-check.mjs surface endor` at high, landing moved to (110, 4) on a scratch copy of E0's branch with this lane's files on top. The check's frame is the landing camera looking up through the trees, so the scatter on the ground is not in it; the frame is byte for byte the same with the scatter off. The scatter's own counts at that spot are the proof below.

| Endor, high, (110, 4), SwiftShader | without scatter | with scatter |
|---|---|---|
| scatter instances / calls / triangles | – | 762 / 6 / 206 k |
| scene calls / triangles | 150 / 1,399,786 | 152 / 1,404,364 |
| frame p50 / p95 (software, only comparable to itself) | 10,633 / 14,283 ms | 10,683 / 14,216 ms |

What draws today: only the solid types (stones, logs, roots in their named colours); the cards (ferns, clover, twigs, the backdrop trees) wait for their maps, which are not in the bucket (`run.txt`'s last line). At (0, 0), the site's landing, nothing grows within reach: the ridge is unpainted or roots' twigs only.

For the laptop: `ANGLE=d3d11 QUALITY=ultra node scripts/galaxy-check.mjs surface endor` once E0's pack is on `main`, with the scatter's stats from `createLevelScatter(...).stats()`; the gate is under 2 ms at 1600 × 900, else lower `DENSITY_CAP.ultra`.
