# Lane X: the sabers in the browser

Luke on Hoth at high quality, then Vader five metres ahead (`__surfaceDo('duel', 'vader', { ahead: 5 })`), through the dev server with `VITE_ASSET_BASE` on the public `site-assets` bucket, headless Chromium drawing in software (SwiftShader). The check is `lab/probe/duel.mjs` (not committed: `lab/` is the session's own).

| shot | what |
| --- | --- |
| `luke-stroke-1.jpg` | Luke's first stroke: `A_Luke_AttackLoop_Strike1`, its clip found by the game's name, timed by the stroke table's window `[0.14, 0.293]` (the pack's own said `[0.05, 0.101]`, the guard snap); the blade's light green on the snow at his feet |
| `luke-vader-duel.jpg` | Vader closing (`approach`, rigged, the saber in his hand), the two blades crossing |
| `luke-vader-clash-1..3.jpg` | three more of Luke's strokes into him |

Read off the page: two saber lights in the scene, Luke's and Vader's, each at 1.2 (high); no page error; no asset request failed.

Not measured here: the frame time with four lit blades. SwiftShader drew a frame in 4.8 s (median of 120), so the number says nothing of a GPU; the chain past the first stroke didn't run either, the game's clock barely moving between calls at that rate. Both want a machine with a GPU (`HANDOFF-battlefront.md`'s "How to check").
