# The rig audit, before the rigging lane

`node scripts/rig-audit.mjs` on `main` at 80f05746, 2026-10-09, before any figure was changed: every skinned model file under `public/models` and `public/games/meshy`, what it stands on, and its body at rest. Phase 0 then wrote each row’s profile into its file (`extras.profile` on the default scene, read as `gltf.scene.userData.profile`); nothing else in any file changed.

How to read it: `fingers` counts the bones that bend a finger (never a metacarpal or an end bone), `twists` the forearm and upper-arm twist bones, `clips` the file’s own animations. The profile is in the file’s units (metres for every Meshy figure): `h` the skinned mesh’s height at rest, `hips` the hips over the floor, `leg` hip to ankle and `arm` shoulder to wrist along the bones, `hand` the far end of what each hand carries, `head` half the head’s height from chin to crown, `sh` shoulder to shoulder. A robot’s or a walker’s profile is what its bones say and means little. The head over the height, by folder (least, median, most): Middle-earth’s toy cast 0.234, 0.292, 0.402; Rick and Morty’s (`public/games/meshy`) 0.095, 0.141, 0.312; the office 0.081, 0.114, 0.141; the galaxy’s crew 0.062, 0.088, 0.149 (the Neimoidian); its troops, Invincible, Albuquerque and the cockpits all under 0.12. The spec’s line for `toy` (over 0.11) would catch half the office and most of Rick and Morty: Phase 4 tunes it against these numbers.

`prime` is a family the design didn’t name: the Transformers: Prime game’s rig (`Humerus.l`, `Index1_Finger.l`), which `rig.js` already poses by role.

| family | figures |
|---|---|
| meshy24 | 225 |
| mixamo | 7 |
| unreal | 2 |
| rigify | 1 |
| highmoon | 20 |
| prime | 4 |
| none | 11 |

270 figures, 657 clip files; 0 keep a profile.

| file | family | joints | fingers | twists | clips | tris | textures | profile (m) | kept |
|---|---|---|---|---|---|---|---|---|---|
| public/games/meshy/alanrails.glb | meshy24 | 24 | 0 | 0 | 1 | 30895 | 1 | h 2.00 · hips 1.05 · leg 0.79 · arm 0.59 · hand 0.26 · head 0.25 · sh 0.53 | no |
| public/games/meshy/amishcyborg.glb | meshy24 | 24 | 0 | 0 | 1 | 30557 | 1 | h 1.78 · hips 0.92 · leg 0.71 · arm 0.47 · hand 0.28 · head 0.34 · sh 0.45 | no |
| public/games/meshy/annie.glb | meshy24 | 24 | 0 | 0 | 1 | 30920 | 1 | h 1.62 · hips 0.86 · leg 0.67 · arm 0.41 · hand 0.15 · head 0.24 · sh 0.22 | no |
| public/games/meshy/arthricia.glb | meshy24 | 24 | 0 | 0 | 1 | 31006 | 1 | h 1.60 · hips 0.91 · leg 0.72 · arm 0.41 · hand 0.15 · head 0.23 · sh 0.24 | no |
| public/games/meshy/atlantean.glb | meshy24 | 24 | 0 | 0 | 1 | 30542 | 1 | h 1.85 · hips 0.97 · leg 0.75 · arm 0.51 · hand 0.18 · head 0.28 · sh 0.38 | no |
| public/games/meshy/beth.glb | meshy24 | 24 | 0 | 0 | 1 | 12416 | 1 | h 1.68 · hips 0.89 · leg 0.70 · arm 0.40 · hand 0.16 · head 0.24 · sh 0.25 | no |
| public/games/meshy/bigmorty.glb | meshy24 | 24 | 0 | 0 | 1 | 30534 | 1 | h 1.50 · hips 0.72 · leg 0.56 · arm 0.38 · hand 0.16 · head 0.26 · sh 0.27 | no |
| public/games/meshy/birdperson.glb | meshy24 | 24 | 0 | 0 | 1 | 40834 | 1 | h 2.00 · hips 1.05 · leg 0.82 · arm 0.53 · hand 0.79 · head 0.26 · sh 0.38 | no |
| public/games/meshy/brad.glb | meshy24 | 24 | 0 | 0 | 1 | 12448 | 1 | h 1.85 · hips 1.01 · leg 0.79 · arm 0.51 · hand 0.20 · head 0.22 · sh 0.32 | no |
| public/games/meshy/campaignmorty.glb | meshy24 | 24 | 0 | 0 | 1 | 30787 | 1 | h 1.50 · hips 0.81 · leg 0.62 · arm 0.42 · hand 0.15 · head 0.24 · sh 0.25 | no |
| public/games/meshy/constructionrick.glb | meshy24 | 24 | 0 | 0 | 1 | 14439 | 1 | h 1.80 · hips 0.90 · leg 0.68 · arm 0.50 · hand 0.18 · head 0.25 · sh 0.25 | no |
| public/games/meshy/cop.glb | meshy24 | 24 | 0 | 0 | 1 | 8309 | 1 | h 1.80 · hips 0.95 · leg 0.74 · arm 0.49 · hand 0.19 · head 0.26 · sh 0.26 | no |
| public/games/meshy/copmorty.glb | meshy24 | 24 | 0 | 0 | 1 | 14495 | 1 | h 1.50 · hips 0.81 · leg 0.63 · arm 0.39 · hand 0.14 · head 0.25 · sh 0.23 | no |
| public/games/meshy/cornvelious.glb | meshy24 | 24 | 0 | 0 | 1 | 31069 | 1 | h 2.20 · hips 1.22 · leg 0.96 · arm 0.56 · hand 0.40 · head 0.26 · sh 0.36 | no |
| public/games/meshy/councilrick-a.glb | meshy24 | 24 | 0 | 0 | 1 | 14337 | 1 | h 1.80 · hips 0.93 · leg 0.74 · arm 0.46 · hand 0.18 · head 0.25 · sh 0.30 | no |
| public/games/meshy/councilrick-b.glb | meshy24 | 24 | 0 | 0 | 1 | 14236 | 1 | h 1.80 · hips 0.88 · leg 0.69 · arm 0.49 · hand 0.21 · head 0.27 · sh 0.32 | no |
| public/games/meshy/councilrick-c.glb | meshy24 | 24 | 0 | 0 | 1 | 14249 | 1 | h 1.80 · hips 1.00 · leg 0.81 · arm 0.49 · hand 0.20 · head 0.21 · sh 0.32 | no |
| public/games/meshy/cousinnicky.glb | meshy24 | 24 | 0 | 0 | 1 | 30939 | 1 | h 1.80 · hips 0.96 · leg 0.74 · arm 0.58 · hand 0.22 · head 0.21 · sh 0.52 | no |
| public/games/meshy/cowboyrick.glb | meshy24 | 24 | 0 | 0 | 1 | 14425 | 1 | h 1.80 · hips 0.93 · leg 0.72 · arm 0.48 · hand 0.17 · head 0.28 · sh 0.28 | no |
| public/games/meshy/crocubot.glb | meshy24 | 24 | 0 | 0 | 1 | 29974 | 1 | h 1.90 · hips 0.95 · leg 0.69 · arm 0.54 · hand 0.23 · head 0.32 · sh 0.51 | no |
| public/games/meshy/detectiverick.glb | meshy24 | 24 | 0 | 0 | 1 | 14387 | 1 | h 1.80 · hips 0.91 · leg 0.70 · arm 0.49 · hand 0.19 · head 0.27 · sh 0.30 | no |
| public/games/meshy/diane.glb | meshy24 | 24 | 0 | 0 | 1 | 31003 | 1 | h 1.68 · hips 0.95 · leg 0.73 · arm 0.42 · hand 0.16 · head 0.25 · sh 0.24 | no |
| public/games/meshy/drwong.glb | meshy24 | 24 | 0 | 0 | 1 | 30787 | 1 | h 1.72 · hips 0.94 · leg 0.73 · arm 0.42 · hand 0.17 · head 0.22 · sh 0.26 | no |
| public/games/meshy/ethan.glb | meshy24 | 24 | 0 | 0 | 1 | 12440 | 1 | h 1.72 · hips 0.90 · leg 0.69 · arm 0.47 · hand 0.19 · head 0.27 · sh 0.28 | no |
| public/games/meshy/evilmorty.glb | meshy24 | 24 | 0 | 0 | 1 | 14371 | 1 | h 1.50 · hips 0.71 · leg 0.55 · arm 0.40 · hand 0.15 · head 0.23 · sh 0.25 | no |
| public/games/meshy/evilrick.glb | meshy24 | 24 | 0 | 0 | 1 | 30795 | 1 | h 1.85 · hips 0.96 · leg 0.76 · arm 0.55 · hand 0.18 · head 0.25 · sh 0.24 | no |
| public/games/meshy/factoryrick.glb | meshy24 | 24 | 0 | 0 | 1 | 14521 | 1 | h 1.80 · hips 0.92 · leg 0.69 · arm 0.49 · hand 0.18 · head 0.25 · sh 0.27 | no |
| public/games/meshy/fedagent.glb | meshy24 | 24 | 0 | 0 | 1 | 10390 | 1 | h 1.90 · hips 0.91 · leg 0.70 · arm 0.48 · hand 0.24 · head 0.26 · sh 0.28 | no |
| public/games/meshy/flippynips.glb | meshy24 | 24 | 0 | 0 | 1 | 30868 | 1 | h 1.50 · hips 0.33 · leg 0.27 · arm 0.33 · hand 0.17 · head 0.47 · sh 0.60 | no |
| public/games/meshy/frankenstein.glb | meshy24 | 24 | 0 | 0 | 1 | 30578 | 1 | h 2.10 · hips 1.11 · leg 0.83 · arm 0.68 · hand 0.35 · head 0.22 · sh 0.63 | no |
| public/games/meshy/frundlesman.glb | meshy24 | 24 | 0 | 0 | 1 | 41586 | 1 | h 1.80 · hips 0.89 · leg 0.69 · arm 0.49 · hand 0.20 · head 0.23 · sh 0.38 | no |
| public/games/meshy/gazorpian.glb | meshy24 | 24 | 0 | 0 | 1 | 9380 | 1 | h 2.40 · hips 1.33 · leg 1.00 · arm 1.26 · hand 0.58 · head 0.29 · sh 1.22 | no |
| public/games/meshy/gearhead.glb | meshy24 | 24 | 0 | 0 | 1 | 30795 | 1 | h 1.80 · hips 0.86 · leg 0.63 · arm 0.60 · hand 0.23 · head 0.28 · sh 0.53 | no |
| public/games/meshy/general.glb | meshy24 | 24 | 0 | 0 | 1 | 10307 | 1 | h 1.82 · hips 0.93 · leg 0.73 · arm 0.54 · hand 0.16 · head 0.23 · sh 0.33 | no |
| public/games/meshy/glexo.glb | meshy24 | 24 | 0 | 0 | 1 | 30854 | 1 | h 1.85 · hips 0.99 · leg 0.79 · arm 0.56 · hand 0.25 · head 0.22 · sh 0.26 | no |
| public/games/meshy/glipglop.glb | meshy24 | 24 | 0 | 0 | 1 | 30591 | 1 | h 1.80 · hips 0.96 · leg 0.76 · arm 0.44 · hand 0.15 · head 0.28 · sh 0.26 | no |
| public/games/meshy/goldenfold.glb | meshy24 | 24 | 0 | 0 | 1 | 12416 | 1 | h 1.80 · hips 0.94 · leg 0.73 · arm 0.53 · hand 0.21 · head 0.25 · sh 0.43 | no |
| public/games/meshy/gromflomite.glb | meshy24 | 24 | 0 | 0 | 1 | 8356 | 1 | h 1.90 · hips 1.01 · leg 0.80 · arm 0.53 · hand 0.19 · head 0.26 · sh 0.37 | no |
| public/games/meshy/hamurai.glb | meshy24 | 24 | 0 | 0 | 1 | 30953 | 1 | h 1.80 · hips 0.94 · leg 0.73 · arm 0.48 · hand 0.20 · head 0.28 · sh 0.40 | no |
| public/games/meshy/hemorrhage.glb | meshy24 | 24 | 0 | 0 | 1 | 41166 | 1 | h 2.10 · hips 1.15 · leg 0.88 · arm 0.61 · hand 0.28 · head 0.20 · sh 0.57 | no |
| public/games/meshy/jaguar.glb | meshy24 | 24 | 0 | 0 | 1 | 41362 | 1 | h 1.95 · hips 1.04 · leg 0.82 · arm 0.56 · hand 0.18 · head 0.21 · sh 0.46 | no |
| public/games/meshy/jerry.glb | meshy24 | 24 | 0 | 0 | 1 | 12434 | 1 | h 1.78 · hips 0.93 · leg 0.73 · arm 0.52 · hand 0.18 · head 0.24 · sh 0.29 | no |
| public/games/meshy/jessica.glb | meshy24 | 24 | 0 | 0 | 1 | 12330 | 1 | h 1.62 · hips 0.91 · leg 0.72 · arm 0.43 · hand 0.15 · head 0.27 · sh 0.22 | no |
| public/games/meshy/kingjellybean.glb | meshy24 | 24 | 0 | 0 | 1 | 30623 | 1 | h 2.20 · hips 1.17 · leg 0.93 · arm 0.62 · hand 0.20 · head 0.42 · sh 0.49 | no |
| public/games/meshy/krombopulos.glb | meshy24 | 24 | 0 | 0 | 1 | 34095 | 18 | h 1.90 · hips 1.04 · leg 0.79 · arm 0.67 · hand 0.33 · head 0.28 · sh 0.47 | no |
| public/games/meshy/kyle.glb | meshy24 | 24 | 0 | 0 | 1 | 30965 | 1 | h 1.70 · hips 0.89 · leg 0.69 · arm 0.44 · hand 0.17 · head 0.23 · sh 0.24 | no |
| public/games/meshy/loco-a.glb | meshy24 | 24 | 0 | 0 | 1 | 30839 | 1 | h 1.50 · hips 0.82 · leg 0.62 · arm 0.40 · hand 0.15 · head 0.23 · sh 0.25 | no |
| public/games/meshy/loco-b.glb | meshy24 | 24 | 0 | 0 | 1 | 30953 | 1 | h 1.50 · hips 0.75 · leg 0.59 · arm 0.41 · hand 0.15 · head 0.24 · sh 0.25 | no |
| public/games/meshy/loco-c.glb | meshy24 | 24 | 0 | 0 | 1 | 30901 | 1 | h 1.50 · hips 0.78 · leg 0.60 · arm 0.41 · hand 0.15 · head 0.22 · sh 0.25 | no |
| public/games/meshy/marsha.glb | meshy24 | 24 | 0 | 0 | 1 | 30632 | 1 | h 2.30 · hips 1.33 · leg 1.07 · arm 0.63 · hand 0.21 · head 0.32 · sh 0.34 | no |
| public/games/meshy/meeseeks.glb | meshy24 | 24 | 0 | 0 | 1 | 8311 | 1 | h 1.90 · hips 0.86 · leg 0.63 · arm 0.56 · hand 0.23 · head 0.28 · sh 0.26 | no |
| public/games/meshy/miles.glb | meshy24 | 24 | 0 | 0 | 1 | 30695 | 1 | h 1.85 · hips 0.95 · leg 0.73 · arm 0.50 · hand 0.17 · head 0.22 · sh 0.29 | no |
| public/games/meshy/millionants.glb | meshy24 | 24 | 0 | 0 | 1 | 31263 | 1 | h 1.90 · hips 1.04 · leg 0.82 · arm 0.55 · hand 0.23 · head 0.22 · sh 0.36 | no |
| public/games/meshy/morty.glb | meshy24 | 24 | 0 | 0 | 1 | 41147 | 1 | h 1.50 · hips 0.75 · leg 0.58 · arm 0.40 · hand 0.14 · head 0.23 · sh 0.25 | no |
| public/games/meshy/mortyjr.glb | meshy24 | 24 | 0 | 0 | 1 | 30760 | 1 | h 2.00 · hips 1.06 · leg 0.82 · arm 0.62 · hand 0.53 · head 0.23 · sh 0.49 | no |
| public/games/meshy/mrbeauregard.glb | meshy24 | 24 | 0 | 0 | 1 | 30630 | 1 | h 1.85 · hips 0.82 · leg 0.61 · arm 0.56 · hand 0.25 · head 0.30 · sh 0.52 | no |
| public/games/meshy/nancy.glb | meshy24 | 24 | 0 | 0 | 1 | 30563 | 1 | h 1.60 · hips 0.84 · leg 0.63 · arm 0.41 · hand 0.15 · head 0.26 · sh 0.24 | no |
| public/games/meshy/nebulon.glb | meshy24 | 24 | 0 | 0 | 1 | 31064 | 1 | h 1.95 · hips 0.93 · leg 0.73 · arm 0.52 · hand 0.26 · head 0.34 · sh 0.34 | no |
| public/games/meshy/needful.glb | meshy24 | 24 | 0 | 0 | 1 | 30733 | 1 | h 1.85 · hips 0.92 · leg 0.73 · arm 0.48 · hand 0.17 · head 0.28 · sh 0.26 | no |
| public/games/meshy/nimbus.glb | meshy24 | 24 | 0 | 0 | 1 | 41248 | 1 | h 1.95 · hips 0.93 · leg 0.72 · arm 0.55 · hand 0.20 · head 0.25 · sh 0.49 | no |
| public/games/meshy/noobnoob.glb | meshy24 | 24 | 0 | 0 | 1 | 30896 | 1 | h 1.10 · hips 0.57 · leg 0.45 · arm 0.29 · hand 0.10 · head 0.19 · sh 0.18 | no |
| public/games/meshy/pencilvester.glb | meshy24 | 24 | 0 | 0 | 1 | 30454 | 1 | h 1.60 · hips 0.71 · leg 0.53 · arm 0.39 · hand 0.16 · head 0.35 · sh 0.29 | no |
| public/games/meshy/phoenixperson.glb | meshy24 | 24 | 0 | 0 | 1 | 29924 | 1 | h 2.05 · hips 1.06 · leg 0.83 · arm 0.55 · hand 0.20 · head 0.27 · sh 0.43 | no |
| public/games/meshy/poncho.glb | meshy24 | 24 | 0 | 0 | 1 | 30677 | 1 | h 1.75 · hips 0.88 · leg 0.68 · arm 0.54 · hand 0.21 · head 0.24 · sh 0.47 | no |
| public/games/meshy/poopybutthole.glb | meshy24 | 24 | 0 | 0 | 1 | 41243 | 1 | h 1.30 · hips 0.60 · leg 0.46 · arm 0.29 · hand 0.10 · head 0.30 · sh 0.17 | no |
| public/games/meshy/president.glb | meshy24 | 24 | 0 | 0 | 1 | 12403 | 1 | h 1.88 · hips 1.01 · leg 0.81 · arm 0.54 · hand 0.21 · head 0.20 · sh 0.47 | no |
| public/games/meshy/principal.glb | meshy24 | 24 | 0 | 0 | 1 | 12412 | 1 | h 1.70 · hips 0.90 · leg 0.70 · arm 0.49 · hand 0.18 · head 0.25 · sh 0.34 | no |
| public/games/meshy/rick.glb | meshy24 | 24 | 0 | 0 | 1 | 41075 | 1 | h 1.80 · hips 0.93 · leg 0.73 · arm 0.51 · hand 0.18 · head 0.25 · sh 0.27 | no |
| public/games/meshy/rickd3.glb | meshy24 | 24 | 0 | 0 | 1 | 30603 | 1 | h 1.85 · hips 0.97 · leg 0.76 · arm 0.47 · hand 0.18 · head 0.26 · sh 0.26 | no |
| public/games/meshy/rickprime.glb | meshy24 | 24 | 0 | 0 | 1 | 40901 | 1 | h 1.85 · hips 0.99 · leg 0.78 · arm 0.48 · hand 0.20 · head 0.26 · sh 0.28 | no |
| public/games/meshy/risotto.glb | meshy24 | 24 | 0 | 0 | 1 | 30808 | 1 | h 1.90 · hips 1.02 · leg 0.80 · arm 0.58 · hand 0.24 · head 0.20 · sh 0.54 | no |
| public/games/meshy/scaryterry.glb | meshy24 | 24 | 0 | 0 | 1 | 41240 | 1 | h 1.95 · hips 0.96 · leg 0.74 · arm 0.50 · hand 0.30 · head 0.30 · sh 0.32 | no |
| public/games/meshy/scroopy.glb | meshy24 | 24 | 0 | 0 | 1 | 30797 | 1 | h 1.40 · hips 0.42 · leg 0.32 · arm 0.40 · hand 0.17 · head 0.28 · sh 0.46 | no |
| public/games/meshy/secretservice.glb | meshy24 | 24 | 0 | 0 | 1 | 10350 | 1 | h 1.84 · hips 0.96 · leg 0.75 · arm 0.49 · hand 0.19 · head 0.22 · sh 0.37 | no |
| public/games/meshy/simplerick.glb | meshy24 | 24 | 0 | 0 | 1 | 31027 | 1 | h 1.85 · hips 1.00 · leg 0.80 · arm 0.50 · hand 0.19 · head 0.26 · sh 0.26 | no |
| public/games/meshy/sleepygary.glb | meshy24 | 24 | 0 | 0 | 1 | 30807 | 1 | h 1.78 · hips 0.92 · leg 0.73 · arm 0.48 · hand 0.18 · head 0.26 · sh 0.29 | no |
| public/games/meshy/slickmorty.glb | meshy24 | 24 | 0 | 0 | 1 | 30829 | 1 | h 1.50 · hips 0.74 · leg 0.56 · arm 0.40 · hand 0.14 · head 0.24 · sh 0.23 | no |
| public/games/meshy/spacebeth.glb | meshy24 | 24 | 0 | 0 | 1 | 41164 | 1 | h 1.68 · hips 0.91 · leg 0.71 · arm 0.43 · hand 0.15 · head 0.22 · sh 0.28 | no |
| public/games/meshy/squanchy.glb | meshy24 | 24 | 0 | 0 | 1 | 41528 | 1 | h 1.15 · hips 0.43 · leg 0.32 · arm 0.25 · hand 0.12 · head 0.24 · sh 0.17 | no |
| public/games/meshy/storylord.glb | meshy24 | 24 | 0 | 0 | 1 | 40969 | 1 | h 1.90 · hips 1.01 · leg 0.78 · arm 0.56 · hand 0.25 · head 0.20 · sh 0.50 | no |
| public/games/meshy/suitrick.glb | meshy24 | 24 | 0 | 0 | 1 | 14219 | 1 | h 1.80 · hips 0.94 · leg 0.75 · arm 0.50 · hand 0.18 · head 0.23 · sh 0.25 | no |
| public/games/meshy/summer.glb | meshy24 | 24 | 0 | 0 | 1 | 12352 | 1 | h 1.60 · hips 0.86 · leg 0.66 · arm 0.43 · hand 0.17 · head 0.20 · sh 0.23 | no |
| public/games/meshy/supernova.glb | meshy24 | 24 | 0 | 0 | 1 | 41160 | 1 | h 1.85 · hips 1.05 · leg 0.82 · arm 0.47 · hand 0.17 · head 0.28 · sh 0.28 | no |
| public/games/meshy/sweaterrick.glb | meshy24 | 24 | 0 | 0 | 1 | 14449 | 1 | h 1.80 · hips 0.96 · leg 0.76 · arm 0.47 · hand 0.17 · head 0.23 · sh 0.26 | no |
| public/games/meshy/tammy.glb | meshy24 | 24 | 0 | 0 | 1 | 12411 | 1 | h 1.62 · hips 0.90 · leg 0.71 · arm 0.43 · hand 0.15 · head 0.25 · sh 0.24 | no |
| public/games/meshy/ticketsguy.glb | meshy24 | 24 | 0 | 0 | 1 | 30930 | 1 | h 1.75 · hips 0.87 · leg 0.66 · arm 0.48 · hand 0.21 · head 0.26 · sh 0.40 | no |
| public/games/meshy/tinyrick.glb | meshy24 | 24 | 0 | 0 | 1 | 12256 | 1 | h 1.60 · hips 0.83 · leg 0.65 · arm 0.45 · hand 0.16 · head 0.22 · sh 0.22 | no |
| public/games/meshy/tommy.glb | meshy24 | 24 | 0 | 0 | 1 | 31216 | 1 | h 1.80 · hips 0.96 · leg 0.76 · arm 0.51 · hand 0.18 · head 0.25 · sh 0.26 | no |
| public/games/meshy/tricia.glb | meshy24 | 24 | 0 | 0 | 1 | 30833 | 1 | h 1.62 · hips 0.90 · leg 0.70 · arm 0.40 · hand 0.14 · head 0.23 · sh 0.22 | no |
| public/games/meshy/unity.glb | meshy24 | 24 | 0 | 0 | 1 | 31042 | 1 | h 1.75 · hips 0.90 · leg 0.68 · arm 0.41 · hand 0.17 · head 0.35 · sh 0.23 | no |
| public/games/meshy/vance.glb | meshy24 | 24 | 0 | 0 | 1 | 41112 | 1 | h 1.85 · hips 0.94 · leg 0.74 · arm 0.49 · hand 0.20 · head 0.26 · sh 0.35 | no |
| public/games/meshy/watert.glb | meshy24 | 24 | 0 | 0 | 1 | 41466 | 1 | h 1.90 · hips 1.04 · leg 0.78 · arm 0.53 · hand 0.20 · head 0.22 · sh 0.32 | no |
| public/games/meshy/xenonbloom.glb | meshy24 | 24 | 0 | 0 | 1 | 31009 | 1 | h 1.90 · hips 1.01 · leg 0.79 · arm 0.56 · hand 0.20 · head 0.27 · sh 0.27 | no |
| public/games/meshy/zeep.glb | meshy24 | 24 | 0 | 0 | 1 | 41082 | 1 | h 1.80 · hips 0.83 · leg 0.66 · arm 0.43 · hand 0.17 · head 0.33 · sh 0.24 | no |
| public/models/albuquerque/badger.glb | meshy24 | 24 | 0 | 0 | 0 | 12432 | 1 | h 1.80 · hips 0.97 · leg 0.75 · arm 0.51 · hand 0.20 · head 0.18 · sh 0.33 | no |
| public/models/albuquerque/declan.glb | meshy24 | 24 | 0 | 0 | 0 | 12413 | 1 | h 1.83 · hips 0.98 · leg 0.76 · arm 0.50 · hand 0.20 · head 0.17 · sh 0.37 | no |
| public/models/albuquerque/gus.glb | meshy24 | 24 | 0 | 0 | 0 | 12319 | 1 | h 1.78 · hips 0.98 · leg 0.77 · arm 0.51 · hand 0.21 · head 0.15 · sh 0.36 | no |
| public/models/albuquerque/hank.glb | meshy24 | 24 | 0 | 0 | 0 | 12445 | 1 | h 1.85 · hips 1.01 · leg 0.78 · arm 0.56 · hand 0.23 · head 0.15 · sh 0.49 | no |
| public/models/albuquerque/hector.glb | meshy24 | 24 | 0 | 0 | 0 | 12440 | 1 | h 1.73 · hips 0.96 · leg 0.74 · arm 0.46 · hand 0.21 · head 0.19 · sh 0.33 | no |
| public/models/albuquerque/jesse-lab.glb | meshy24 | 24 | 0 | 0 | 0 | 41489 | 1 | h 1.73 · hips 0.96 · leg 0.73 · arm 0.47 · hand 0.21 · head 0.14 · sh 0.37 | no |
| public/models/albuquerque/jesse.glb | meshy24 | 24 | 0 | 0 | 0 | 41548 | 1 | h 1.73 · hips 0.94 · leg 0.70 · arm 0.47 · hand 0.22 · head 0.14 · sh 0.34 | no |
| public/models/albuquerque/lydia.glb | meshy24 | 24 | 0 | 0 | 0 | 12373 | 1 | h 1.70 · hips 0.95 · leg 0.73 · arm 0.44 · hand 0.18 · head 0.19 · sh 0.29 | no |
| public/models/albuquerque/mike.glb | meshy24 | 24 | 0 | 0 | 0 | 12430 | 1 | h 1.80 · hips 1.00 · leg 0.79 · arm 0.51 · hand 0.22 · head 0.16 · sh 0.40 | no |
| public/models/albuquerque/nurse.glb | meshy24 | 24 | 0 | 0 | 0 | 12476 | 1 | h 1.65 · hips 0.91 · leg 0.71 · arm 0.45 · hand 0.18 · head 0.16 · sh 0.31 | no |
| public/models/albuquerque/pete.glb | meshy24 | 24 | 0 | 0 | 0 | 12485 | 1 | h 1.88 · hips 1.01 · leg 0.78 · arm 0.52 · hand 0.20 · head 0.17 · sh 0.32 | no |
| public/models/albuquerque/saul.glb | meshy24 | 24 | 0 | 0 | 0 | 12364 | 1 | h 1.78 · hips 0.96 · leg 0.75 · arm 0.49 · hand 0.21 · head 0.21 · sh 0.35 | no |
| public/models/albuquerque/tuco.glb | meshy24 | 24 | 0 | 0 | 0 | 12486 | 1 | h 1.73 · hips 0.98 · leg 0.76 · arm 0.48 · hand 0.20 · head 0.14 · sh 0.39 | no |
| public/models/albuquerque/walt.glb | meshy24 | 24 | 0 | 0 | 0 | 41350 | 1 | h 1.79 · hips 0.95 · leg 0.73 · arm 0.51 · hand 0.25 · head 0.17 · sh 0.41 | no |
| public/models/cockpit/chewie.glb | meshy24 | 24 | 0 | 0 | 1 | 16583 | 1 | h 2.28 · hips 1.18 · leg 0.91 · arm 0.71 · hand 0.34 · head 0.25 · sh 0.54 | no |
| public/models/cockpit/jesse.glb | meshy24 | 24 | 0 | 0 | 1 | 41548 | 1 | h 1.73 · hips 0.94 · leg 0.70 · arm 0.47 · hand 0.22 · head 0.14 · sh 0.34 | no |
| public/models/cockpit/walt.glb | meshy24 | 24 | 0 | 0 | 1 | 41350 | 1 | h 1.79 · hips 0.95 · leg 0.73 · arm 0.51 · hand 0.24 · head 0.17 · sh 0.41 | no |
| public/models/deathstar/c3po.glb | meshy24 | 24 | 0 | 0 | 0 | 6998 | 2 | h 1.80 · hips 1.00 · leg 0.77 · arm 0.55 · hand 0.19 · head 0.16 · sh 0.39 | no |
| public/models/deathstar/obiwan.glb | meshy24 | 24 | 0 | 0 | 0 | 20625 | 1 | h 1.78 · hips 1.02 · leg 0.79 · arm 0.59 · hand 0.10 · head 0.15 · sh 0.38 | no |
| public/models/galaxy/crew/ackbar.glb | meshy24 | 24 | 0 | 0 | 0 | 16518 | 1 | h 1.80 · hips 0.94 · leg 0.71 · arm 0.48 · hand 0.24 · head 0.20 · sh 0.38 | no |
| public/models/galaxy/crew/ahsoka.glb | meshy24 | 24 | 0 | 0 | 0 | 16268 | 1 | h 1.85 · hips 1.03 · leg 0.80 · arm 0.48 · hand 0.21 · head 0.17 · sh 0.35 | no |
| public/models/galaxy/crew/aqualish.glb | meshy24 | 24 | 0 | 0 | 0 | 16105 | 1 | h 1.80 · hips 0.97 · leg 0.80 · arm 0.51 · hand 0.24 · head 0.20 · sh 0.47 | no |
| public/models/galaxy/crew/bibfortuna.glb | meshy24 | 24 | 0 | 0 | 0 | 16205 | 1 | h 1.80 · hips 0.95 · leg 0.75 · arm 0.52 · hand 0.22 · head 0.18 · sh 0.36 | no |
| public/models/galaxy/crew/bith.glb | meshy24 | 24 | 0 | 0 | 0 | 16698 | 1 | h 1.80 · hips 0.89 · leg 0.69 · arm 0.48 · hand 0.25 · head 0.26 · sh 0.28 | no |
| public/models/galaxy/crew/bobafett.glb | meshy24 | 24 | 0 | 0 | 0 | 16335 | 1 | h 1.83 · hips 1.01 · leg 0.79 · arm 0.51 · hand 0.21 · head 0.18 · sh 0.43 | no |
| public/models/galaxy/crew/bokatan.glb | meshy24 | 24 | 0 | 0 | 0 | 7935 | 1 | h 1.70 · hips 0.97 · leg 0.75 · arm 0.45 · hand 0.21 · head 0.13 · sh 0.39 | no |
| public/models/galaxy/crew/caradune.glb | meshy24 | 24 | 0 | 0 | 0 | 6242 | 1 | h 1.78 · hips 0.98 · leg 0.77 · arm 0.47 · hand 0.18 · head 0.16 · sh 0.41 | no |
| public/models/galaxy/crew/dindjarin.glb | meshy24 | 24 | 0 | 0 | 0 | 29992 | 26 | h 1.85 · hips 1.01 · leg 0.85 · arm 0.47 · hand 0.17 · head 0.19 · sh 0.44 | no |
| public/models/galaxy/crew/dooku.glb | meshy24 | 24 | 0 | 0 | 0 | 16473 | 1 | h 1.93 · hips 1.10 · leg 0.86 · arm 0.50 · hand 0.21 · head 0.16 · sh 0.44 | no |
| public/models/galaxy/crew/fennec.glb | meshy24 | 24 | 0 | 0 | 0 | 5619 | 1 | h 1.70 · hips 0.97 · leg 0.78 · arm 0.49 · hand 0.21 · head 0.16 · sh 0.37 | no |
| public/models/galaxy/crew/gamorrean.glb | meshy24 | 24 | 0 | 0 | 0 | 16611 | 1 | h 1.80 · hips 0.85 · leg 0.62 · arm 0.59 · hand 0.30 · head 0.18 · sh 0.56 | no |
| public/models/galaxy/crew/greedo.glb | meshy24 | 24 | 0 | 0 | 0 | 16581 | 1 | h 1.73 · hips 0.94 · leg 0.72 · arm 0.46 · hand 0.21 · head 0.16 · sh 0.37 | no |
| public/models/galaxy/crew/greef.glb | meshy24 | 24 | 0 | 0 | 0 | 7429 | 1 | h 1.85 · hips 1.02 · leg 0.78 · arm 0.56 · hand 0.26 · head 0.16 · sh 0.52 | no |
| public/models/galaxy/crew/han.glb | meshy24 | 24 | 0 | 0 | 0 | 16387 | 1 | h 1.85 · hips 1.01 · leg 0.78 · arm 0.51 · hand 0.22 · head 0.15 · sh 0.40 | no |
| public/models/galaxy/crew/hondo.glb | meshy24 | 24 | 0 | 0 | 0 | 16485 | 1 | h 1.78 · hips 0.97 · leg 0.81 · arm 0.49 · hand 0.23 · head 0.15 · sh 0.40 | no |
| public/models/galaxy/crew/inquisitor.glb | meshy24 | 24 | 0 | 0 | 0 | 4905 | 3 | h 1.85 · hips 1.04 · leg 0.83 · arm 0.43 · hand 0.28 · head 0.14 · sh 0.41 | no |
| public/models/galaxy/crew/jango.glb | meshy24 | 24 | 0 | 0 | 0 | 14759 | 3 | h 1.83 · hips 1.01 · leg 0.79 · arm 0.47 · hand 0.30 · head 0.18 · sh 0.43 | no |
| public/models/galaxy/crew/jedi.glb | meshy24 | 24 | 0 | 0 | 0 | 16454 | 1 | h 1.75 · hips 1.01 · leg 0.81 · arm 0.48 · hand 0.20 · head 0.15 · sh 0.32 | no |
| public/models/galaxy/crew/jedi2.glb | meshy24 | 24 | 0 | 0 | 0 | 16566 | 1 | h 1.80 · hips 1.01 · leg 0.78 · arm 0.47 · hand 0.20 · head 0.15 · sh 0.35 | no |
| public/models/galaxy/crew/jedi3.glb | meshy24 | 24 | 0 | 0 | 0 | 16298 | 1 | h 1.78 · hips 1.02 · leg 0.79 · arm 0.50 · hand 0.22 · head 0.16 · sh 0.38 | no |
| public/models/galaxy/crew/lando.glb | meshy24 | 24 | 0 | 0 | 0 | 16470 | 1 | h 1.78 · hips 1.01 · leg 0.80 · arm 0.48 · hand 0.21 · head 0.15 · sh 0.39 | no |
| public/models/galaxy/crew/leia.glb | meshy24 | 24 | 0 | 0 | 0 | 32672 | 6 | h 1.50 · hips 0.90 · leg 0.75 · arm 0.41 · hand 0.17 · head 0.12 · sh 0.28 | no |
| public/models/galaxy/crew/lobot.glb | meshy24 | 24 | 0 | 0 | 0 | 16567 | 1 | h 1.75 · hips 0.97 · leg 0.75 · arm 0.49 · hand 0.20 · head 0.14 · sh 0.38 | no |
| public/models/galaxy/crew/luke.glb | meshy24 | 24 | 0 | 0 | 0 | 29950 | 6 | h 1.72 · hips 0.95 · leg 0.74 · arm 0.47 · hand 0.19 · head 0.13 · sh 0.37 | no |
| public/models/galaxy/crew/maul.glb | meshy24 | 24 | 0 | 0 | 0 | 30357 | 8 | h 1.75 · hips 0.98 · leg 0.76 · arm 0.43 · hand 0.22 · head 0.12 · sh 0.39 | no |
| public/models/galaxy/crew/mustafarian.glb | meshy24 | 24 | 0 | 0 | 0 | 16674 | 1 | h 2.00 · hips 1.10 · leg 0.83 · arm 0.53 · hand 0.28 · head 0.19 · sh 0.44 | no |
| public/models/galaxy/crew/neimoidian.glb | meshy24 | 24 | 0 | 0 | 0 | 16225 | 1 | h 1.90 · hips 0.94 · leg 0.74 · arm 0.46 · hand 0.25 · head 0.28 · sh 0.34 | no |
| public/models/galaxy/crew/obiwan.glb | meshy24 | 24 | 0 | 0 | 0 | 29999 | 1 | h 1.82 · hips 1.03 · leg 0.83 · arm 0.55 · hand 0.20 · head 0.11 · sh 0.34 | no |
| public/models/galaxy/crew/officer.glb | meshy24 | 24 | 0 | 0 | 0 | 16499 | 1 | h 1.80 · hips 1.00 · leg 0.77 · arm 0.51 · hand 0.20 · head 0.16 · sh 0.39 | no |
| public/models/galaxy/crew/palpatine.glb | meshy24 | 24 | 0 | 0 | 0 | 48889 | 12 | h 1.73 · hips 1.02 · leg 0.82 · arm 0.50 · hand 0.27 · head 0.13 · sh 0.37 | no |
| public/models/galaxy/crew/quigon.glb | meshy24 | 24 | 0 | 0 | 0 | 16326 | 1 | h 1.93 · hips 1.08 · leg 0.85 · arm 0.55 · hand 0.24 · head 0.17 · sh 0.42 | no |
| public/models/galaxy/crew/rebel.glb | meshy24 | 24 | 0 | 0 | 0 | 16527 | 1 | h 1.78 · hips 1.00 · leg 0.76 · arm 0.48 · hand 0.22 · head 0.15 · sh 0.38 | no |
| public/models/galaxy/crew/rex.glb | meshy24 | 24 | 0 | 0 | 0 | 30961 | 8 | h 1.83 · hips 1.02 · leg 0.81 · arm 0.46 · hand 0.21 · head 0.18 · sh 0.41 | no |
| public/models/galaxy/crew/rodian.glb | meshy24 | 24 | 0 | 0 | 0 | 12082 | 6 | h 1.70 · hips 0.92 · leg 0.71 · arm 0.49 · hand 0.23 · head 0.14 · sh 0.37 | no |
| public/models/galaxy/crew/senateguard.glb | meshy24 | 24 | 0 | 0 | 0 | 15976 | 1 | h 1.85 · hips 1.01 · leg 0.81 · arm 0.49 · hand 0.20 · head 0.21 · sh 0.39 | no |
| public/models/galaxy/crew/shaakti.glb | meshy24 | 24 | 0 | 0 | 0 | 31795 | 6 | h 1.88 · hips 1.05 · leg 0.81 · arm 0.42 · hand 0.39 · head 0.18 · sh 0.23 | no |
| public/models/galaxy/crew/tiepilot.glb | meshy24 | 24 | 0 | 0 | 0 | 6008 | 1 | h 1.80 · hips 1.00 · leg 0.78 · arm 0.53 · hand 0.23 · head 0.21 · sh 0.37 | no |
| public/models/galaxy/crew/tusken.glb | meshy24 | 24 | 0 | 0 | 0 | 16546 | 1 | h 1.90 · hips 1.07 · leg 0.84 · arm 0.54 · hand 0.21 · head 0.17 · sh 0.42 | no |
| public/models/galaxy/crew/twilek.glb | meshy24 | 24 | 0 | 0 | 0 | 16568 | 1 | h 1.70 · hips 0.95 · leg 0.72 · arm 0.47 · hand 0.20 · head 0.14 · sh 0.33 | no |
| public/models/galaxy/crew/ugnaught.glb | meshy24 | 24 | 0 | 0 | 0 | 16592 | 1 | h 1.05 · hips 0.50 · leg 0.37 · arm 0.34 · hand 0.21 · head 0.14 · sh 0.34 | no |
| public/models/galaxy/crew/vader.glb | meshy24 | 24 | 0 | 0 | 0 | 29996 | 10 | h 2.02 · hips 1.13 · leg 0.89 · arm 0.49 · hand 0.28 · head 0.15 · sh 0.47 | no |
| public/models/galaxy/crew/wingguard.glb | meshy24 | 24 | 0 | 0 | 0 | 9007 | 1 | h 1.80 · hips 1.00 · leg 0.77 · arm 0.50 · hand 0.21 · head 0.16 · sh 0.39 | no |
| public/models/galaxy/crew/wuher.glb | meshy24 | 24 | 0 | 0 | 0 | 16606 | 1 | h 1.78 · hips 0.97 · leg 0.74 · arm 0.50 · hand 0.22 · head 0.15 · sh 0.43 | no |
| public/models/galaxy/troops/battledroid.glb | meshy24 | 24 | 0 | 0 | 0 | 2592 | 1 | h 1.91 · hips 1.04 · leg 0.83 · arm 0.56 · hand 0.20 · head 0.13 · sh 0.32 | no |
| public/models/galaxy/troops/clone.glb | meshy24 | 24 | 0 | 0 | 0 | 8622 | 2 | h 1.83 · hips 1.00 · leg 0.80 · arm 0.48 · hand 0.19 · head 0.18 · sh 0.38 | no |
| public/models/galaxy/troops/deathtrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 4159 | 2 | h 1.83 · hips 1.03 · leg 0.83 · arm 0.47 · hand 0.20 · head 0.17 · sh 0.40 | no |
| public/models/galaxy/troops/hothtrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 6919 | 4 | h 1.78 · hips 1.01 · leg 0.77 · arm 0.47 · hand 0.20 · head 0.13 · sh 0.40 | no |
| public/models/galaxy/troops/sandtrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 7590 | 3 | h 1.83 · hips 1.03 · leg 0.83 · arm 0.48 · hand 0.18 · head 0.15 · sh 0.42 | no |
| public/models/galaxy/troops/scouttrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 3842 | 1 | h 1.83 · hips 1.02 · leg 0.80 · arm 0.52 · hand 0.18 · head 0.16 · sh 0.43 | no |
| public/models/galaxy/troops/shoretrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 7693 | 3 | h 1.83 · hips 1.01 · leg 0.79 · arm 0.43 · hand 0.17 · head 0.16 · sh 0.43 | no |
| public/models/galaxy/troops/snowtrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 6947 | 2 | h 1.83 · hips 1.04 · leg 0.79 · arm 0.50 · hand 0.20 · head 0.15 · sh 0.45 | no |
| public/models/galaxy/troops/stormtrooper.glb | meshy24 | 24 | 0 | 0 | 0 | 6895 | 2 | h 1.83 · hips 1.02 · leg 0.81 · arm 0.48 · hand 0.19 · head 0.17 · sh 0.40 | no |
| public/models/galaxy/troops/superdroid.glb | meshy24 | 24 | 0 | 0 | 0 | 5020 | 1 | h 1.93 · hips 1.10 · leg 0.86 · arm 0.65 · hand 0.23 · head 0.13 · sh 0.55 | no |
| public/models/invincible/allen.glb | meshy24 | 24 | 0 | 0 | 9 | 30971 | 1 | h 2.30 · hips 1.30 · leg 1.05 · arm 0.66 · hand 0.32 · head 0.18 · sh 0.65 | no |
| public/models/invincible/cecil.glb | meshy24 | 24 | 0 | 0 | 8 | 30862 | 1 | h 1.80 · hips 1.02 · leg 0.80 · arm 0.51 · hand 0.20 · head 0.14 · sh 0.38 | no |
| public/models/invincible/civ-a.glb | meshy24 | 24 | 0 | 0 | 8 | 11998 | 1 | h 1.75 · hips 1.01 · leg 0.80 · arm 0.46 · hand 0.21 · head 0.15 · sh 0.40 | no |
| public/models/invincible/civ-b.glb | meshy24 | 24 | 0 | 0 | 8 | 11999 | 1 | h 1.66 · hips 0.95 · leg 0.75 · arm 0.41 · hand 0.18 · head 0.16 · sh 0.27 | no |
| public/models/invincible/civ-c.glb | meshy24 | 24 | 0 | 0 | 8 | 11997 | 1 | h 1.72 · hips 0.97 · leg 0.76 · arm 0.46 · hand 0.20 · head 0.14 · sh 0.37 | no |
| public/models/invincible/debbie.glb | meshy24 | 24 | 0 | 0 | 8 | 30945 | 1 | h 1.68 · hips 1.00 · leg 0.78 · arm 0.43 · hand 0.17 · head 0.14 · sh 0.29 | no |
| public/models/invincible/eve.glb | meshy24 | 24 | 0 | 0 | 10 | 30594 | 1 | h 1.70 · hips 0.99 · leg 0.79 · arm 0.45 · hand 0.19 · head 0.17 · sh 0.29 | no |
| public/models/invincible/mark.glb | meshy24 | 24 | 0 | 0 | 10 | 31115 | 1 | h 1.78 · hips 1.01 · leg 0.79 · arm 0.48 · hand 0.19 · head 0.15 · sh 0.37 | no |
| public/models/invincible/mauler.glb | meshy24 | 24 | 0 | 0 | 8 | 31153 | 1 | h 2.60 · hips 1.51 · leg 1.20 · arm 0.76 · hand 0.41 · head 0.19 · sh 0.70 | no |
| public/models/invincible/omni-man.glb | meshy24 | 24 | 0 | 0 | 10 | 31016 | 1 | h 1.95 · hips 1.15 · leg 0.91 · arm 0.54 · hand 0.25 · head 0.15 · sh 0.45 | no |
| public/models/invincible/seismic.glb | meshy24 | 24 | 0 | 0 | 7 | 31017 | 1 | h 1.80 · hips 1.03 · leg 0.79 · arm 0.48 · hand 0.21 · head 0.16 · sh 0.37 | no |
| public/models/invincible/thragg.glb | meshy24 | 24 | 0 | 0 | 10 | 30400 | 1 | h 2.05 · hips 1.25 · leg 1.00 · arm 0.56 · hand 0.28 · head 0.14 · sh 0.49 | no |
| public/models/middleearth/cast/aragorn.glb | meshy24 | 24 | 0 | 0 | 0 | 12481 | 1 | h 1.88 · hips 0.71 · leg 0.51 · arm 0.43 · hand 0.24 · head 0.51 · sh 0.54 | no |
| public/models/middleearth/cast/arwen.glb | meshy24 | 24 | 0 | 0 | 0 | 12462 | 1 | h 1.80 · hips 0.64 · leg 0.51 · arm 0.39 · hand 0.21 · head 0.53 · sh 0.40 | no |
| public/models/middleearth/cast/bilbo.glb | meshy24 | 24 | 0 | 0 | 0 | 12532 | 1 | h 1.12 · hips 0.34 · leg 0.26 · arm 0.28 · hand 0.19 · head 0.33 · sh 0.30 | no |
| public/models/middleearth/cast/boromir.glb | meshy24 | 24 | 0 | 0 | 0 | 12446 | 1 | h 1.90 · hips 0.64 · leg 0.48 · arm 0.43 · hand 0.28 · head 0.58 · sh 0.63 | no |
| public/models/middleearth/cast/breeman.glb | meshy24 | 24 | 0 | 0 | 0 | 12508 | 1 | h 1.80 · hips 0.62 · leg 0.45 · arm 0.34 · hand 0.20 · head 0.53 · sh 0.54 | no |
| public/models/middleearth/cast/butterbur.glb | meshy24 | 24 | 0 | 0 | 0 | 12466 | 1 | h 1.75 · hips 0.63 · leg 0.47 · arm 0.43 · hand 0.25 · head 0.41 · sh 0.47 | no |
| public/models/middleearth/cast/easterling.glb | meshy24 | 24 | 0 | 0 | 0 | 12482 | 1 | h 1.85 · hips 0.59 · leg 0.47 · arm 0.42 · hand 0.28 · head 0.51 · sh 0.48 | no |
| public/models/middleearth/cast/elf.glb | meshy24 | 24 | 0 | 0 | 0 | 12427 | 1 | h 1.88 · hips 0.66 · leg 0.50 · arm 0.38 · hand 0.23 · head 0.65 · sh 0.54 | no |
| public/models/middleearth/cast/elrond.glb | meshy24 | 24 | 0 | 0 | 0 | 12321 | 1 | h 1.92 · hips 0.72 · leg 0.58 · arm 0.42 · hand 0.26 · head 0.57 · sh 0.49 | no |
| public/models/middleearth/cast/eowyn.glb | meshy24 | 24 | 0 | 0 | 0 | 12502 | 1 | h 1.72 · hips 0.74 · leg 0.64 · arm 0.35 · hand 0.17 · head 0.52 · sh 0.42 | no |
| public/models/middleearth/cast/faramir.glb | meshy24 | 24 | 0 | 0 | 0 | 12460 | 1 | h 1.85 · hips 0.76 · leg 0.58 · arm 0.41 · hand 0.24 · head 0.46 · sh 0.51 | no |
| public/models/middleearth/cast/frodo.glb | meshy24 | 24 | 0 | 0 | 0 | 12519 | 1 | h 1.15 · hips 0.39 · leg 0.28 · arm 0.25 · hand 0.18 · head 0.33 · sh 0.29 | no |
| public/models/middleearth/cast/galadriel.glb | meshy24 | 24 | 0 | 0 | 0 | 12454 | 1 | h 1.95 · hips 0.82 · leg 0.69 · arm 0.43 · hand 0.22 · head 0.69 · sh 0.44 | no |
| public/models/middleearth/cast/gandalf.glb | meshy24 | 24 | 0 | 0 | 0 | 12488 | 1 | h 1.85 · hips 0.61 · leg 0.47 · arm 0.37 · hand 0.21 · head 0.58 · sh 0.48 | no |
| public/models/middleearth/cast/gandalfwhite.glb | meshy24 | 24 | 0 | 0 | 0 | 12427 | 1 | h 1.85 · hips 0.70 · leg 0.51 · arm 0.44 · hand 0.29 · head 0.53 · sh 0.56 | no |
| public/models/middleearth/cast/gimli.glb | meshy24 | 24 | 0 | 0 | 0 | 12513 | 1 | h 1.35 · hips 0.52 · leg 0.38 · arm 0.35 · hand 0.23 · head 0.34 · sh 0.48 | no |
| public/models/middleearth/cast/goblin.glb | meshy24 | 24 | 0 | 0 | 0 | 12491 | 1 | h 1.30 · hips 0.43 · leg 0.33 · arm 0.33 · hand 0.23 · head 0.38 · sh 0.36 | no |
| public/models/middleearth/cast/gondorguard.glb | meshy24 | 24 | 0 | 0 | 0 | 12446 | 1 | h 1.85 · hips 0.65 · leg 0.48 · arm 0.38 · hand 0.26 · head 0.51 · sh 0.46 | no |
| public/models/middleearth/cast/hobbit.glb | meshy24 | 24 | 0 | 0 | 0 | 12459 | 1 | h 1.12 · hips 0.39 · leg 0.28 · arm 0.29 · hand 0.18 · head 0.27 · sh 0.34 | no |
| public/models/middleearth/cast/legolas.glb | meshy24 | 24 | 0 | 0 | 0 | 12499 | 1 | h 1.88 · hips 0.66 · leg 0.49 · arm 0.40 · hand 0.21 · head 0.76 · sh 0.43 | no |
| public/models/middleearth/cast/merry.glb | meshy24 | 24 | 0 | 0 | 0 | 12449 | 1 | h 1.14 · hips 0.41 · leg 0.29 · arm 0.26 · hand 0.15 · head 0.31 · sh 0.32 | no |
| public/models/middleearth/cast/orc.glb | meshy24 | 24 | 0 | 0 | 0 | 12430 | 1 | h 1.70 · hips 0.53 · leg 0.40 · arm 0.40 · hand 0.27 · head 0.47 · sh 0.50 | no |
| public/models/middleearth/cast/pippin.glb | meshy24 | 24 | 0 | 0 | 0 | 12500 | 1 | h 1.12 · hips 0.43 · leg 0.32 · arm 0.27 · hand 0.19 · head 0.27 · sh 0.29 | no |
| public/models/middleearth/cast/rohirrim.glb | meshy24 | 24 | 0 | 0 | 0 | 11695 | 1 | h 1.83 · hips 0.44 · leg 0.32 · arm 0.30 · hand 0.19 · head 0.66 · sh 0.47 | no |
| public/models/middleearth/cast/rosie.glb | meshy24 | 24 | 0 | 0 | 0 | 12536 | 1 | h 1.08 · hips 0.46 · leg 0.37 · arm 0.22 · hand 0.14 · head 0.33 · sh 0.20 | no |
| public/models/middleearth/cast/sam.glb | meshy24 | 24 | 0 | 0 | 0 | 12512 | 1 | h 1.12 · hips 0.48 · leg 0.34 · arm 0.25 · hand 0.18 · head 0.28 · sh 0.31 | no |
| public/models/middleearth/cast/saruman.glb | meshy24 | 24 | 0 | 0 | 0 | 12287 | 1 | h 1.90 · hips 0.57 · leg 0.42 · arm 0.39 · hand 0.27 · head 0.59 · sh 0.63 | no |
| public/models/middleearth/cast/theoden.glb | meshy24 | 24 | 0 | 0 | 0 | 12492 | 1 | h 1.83 · hips 0.60 · leg 0.45 · arm 0.39 · hand 0.22 · head 0.58 · sh 0.65 | no |
| public/models/middleearth/cast/uruk.glb | meshy24 | 24 | 0 | 0 | 0 | 12441 | 1 | h 1.95 · hips 0.67 · leg 0.53 · arm 0.57 · hand 0.42 · head 0.59 · sh 0.86 | no |
| public/models/office/cast/andy.glb | meshy24 | 24 | 0 | 0 | 0 | 10323 | 1 | h 1.83 · hips 0.94 · leg 0.72 · arm 0.52 · hand 0.22 · head 0.21 · sh 0.36 | no |
| public/models/office/cast/angela.glb | meshy24 | 24 | 0 | 0 | 0 | 10386 | 1 | h 1.55 · hips 0.88 · leg 0.72 · arm 0.40 · hand 0.15 · head 0.18 · sh 0.23 | no |
| public/models/office/cast/creed.glb | meshy24 | 24 | 0 | 0 | 0 | 10345 | 1 | h 1.78 · hips 0.92 · leg 0.71 · arm 0.53 · hand 0.23 · head 0.19 · sh 0.35 | no |
| public/models/office/cast/darryl.glb | meshy24 | 24 | 0 | 0 | 0 | 10406 | 1 | h 1.85 · hips 1.02 · leg 0.79 · arm 0.54 · hand 0.23 · head 0.15 · sh 0.44 | no |
| public/models/office/cast/dwight.glb | meshy24 | 24 | 0 | 0 | 0 | 10388 | 1 | h 1.88 · hips 1.01 · leg 0.80 · arm 0.52 · hand 0.21 · head 0.22 · sh 0.36 | no |
| public/models/office/cast/erin.glb | meshy24 | 24 | 0 | 0 | 0 | 10324 | 1 | h 1.65 · hips 0.92 · leg 0.73 · arm 0.41 · hand 0.17 · head 0.23 · sh 0.25 | no |
| public/models/office/cast/jim.glb | meshy24 | 24 | 0 | 0 | 0 | 10349 | 1 | h 1.91 · hips 1.04 · leg 0.82 · arm 0.54 · hand 0.22 · head 0.21 · sh 0.35 | no |
| public/models/office/cast/kelly.glb | meshy24 | 24 | 0 | 0 | 0 | 10243 | 1 | h 1.60 · hips 0.88 · leg 0.68 · arm 0.42 · hand 0.17 · head 0.21 · sh 0.28 | no |
| public/models/office/cast/kevin.glb | meshy24 | 24 | 0 | 0 | 0 | 10332 | 1 | h 1.75 · hips 0.91 · leg 0.69 · arm 0.53 · hand 0.23 · head 0.19 · sh 0.49 | no |
| public/models/office/cast/meredith.glb | meshy24 | 24 | 0 | 0 | 0 | 10358 | 1 | h 1.65 · hips 0.91 · leg 0.71 · arm 0.44 · hand 0.18 · head 0.20 · sh 0.29 | no |
| public/models/office/cast/michael.glb | meshy24 | 24 | 0 | 0 | 0 | 10328 | 1 | h 1.75 · hips 0.91 · leg 0.71 · arm 0.50 · hand 0.21 · head 0.19 · sh 0.41 | no |
| public/models/office/cast/oscar.glb | meshy24 | 24 | 0 | 0 | 0 | 10432 | 1 | h 1.73 · hips 0.98 · leg 0.77 · arm 0.47 · hand 0.20 · head 0.18 · sh 0.35 | no |
| public/models/office/cast/pam.glb | meshy24 | 24 | 0 | 0 | 0 | 10348 | 1 | h 1.63 · hips 0.92 · leg 0.73 · arm 0.41 · hand 0.17 · head 0.22 · sh 0.26 | no |
| public/models/office/cast/phyllis.glb | meshy24 | 24 | 0 | 0 | 0 | 10366 | 1 | h 1.60 · hips 0.87 · leg 0.67 · arm 0.41 · hand 0.18 · head 0.19 · sh 0.37 | no |
| public/models/office/cast/ryan.glb | meshy24 | 24 | 0 | 0 | 0 | 10361 | 1 | h 1.76 · hips 0.88 · leg 0.69 · arm 0.49 · hand 0.20 · head 0.20 · sh 0.31 | no |
| public/models/office/cast/stanley.glb | meshy24 | 24 | 0 | 0 | 0 | 10242 | 1 | h 1.80 · hips 0.96 · leg 0.73 · arm 0.52 · hand 0.24 · head 0.18 · sh 0.45 | no |
| public/models/office/cast/toby.glb | meshy24 | 24 | 0 | 0 | 0 | 10347 | 1 | h 1.78 · hips 0.96 · leg 0.75 · arm 0.49 · hand 0.21 · head 0.22 · sh 0.38 | no |
| public/models/galaxy/surface/bantha.glb | mixamo | 50 | 0 | 0 | 1 | 10174 | 9 | h 2.80 · hips 2.04 · leg 1.40 · arm 1.25 · hand 0.56 · head 1.38 · sh 0.75 | no |
| public/models/galaxy/surface/c3po.glb | mixamo | 66 | 30 | 0 | 1 | 6998 | 2 | h 1.67 · hips 0.92 · leg 0.78 · arm 0.47 · hand 0.15 · head 0.12 · sh 0.39 | no |
| public/models/galaxy/surface/ig11.glb | mixamo | 23 | 0 | 0 | 1 | 2990 | 1 | h 2.00 · hips 1.10 · leg 0.95 · arm 0.56 · hand 0.18 · head 0.19 · sh 0.43 | no |
| public/models/galaxy/surface/ithorian.glb | mixamo | 47 | 24 | 0 | 8 | 8054 | 6 | h 2.20 · hips 1.26 · leg 1.02 · arm 0.51 · hand 0.41 · head 0.19 · sh 0.44 | no |
| public/models/galaxy/surface/rebelpilot.glb | mixamo | 53 | 30 | 0 | 7 | 7988 | 5 | h 1.80 · hips 1.04 · leg 0.89 · arm 0.41 · hand 0.28 · head 0.14 · sh 0.36 | no |
| public/models/galaxy/surface/rebeltech.glb | mixamo | 53 | 30 | 0 | 7 | 7971 | 3 | h 1.80 · hips 1.05 · leg 0.91 · arm 0.48 · hand 0.22 · head 0.14 · sh 0.36 | no |
| public/models/sketchfab/avengers/thor.glb | mixamo | 34 | 6 | 0 | 3 | 19580 | 3 | h 1.98 · hips 1.17 · leg 0.98 · arm 0.53 · hand 0.24 · head 0.12 · sh 0.53 | no |
| public/models/marvel/spiderman.glb | unreal | 176 | 30 | 14 | 0 | 26294 | 4 | h 1.67 · hips 0.93 · leg 0.82 · arm 0.49 · hand 0.17 · head 0.11 · sh 0.36 | no |
| public/models/sketchfab/avengers/hulk.glb | unreal | 279 | 46 | 24 | 3 | 32527 | 19 | h 2.55 · hips 1.22 · leg 1.00 · arm 0.75 · hand 0.50 · head 0.18 · sh 0.88 | no |
| public/models/mario64/mario.glb | rigify | 63 | 30 | 0 | 0 | 39990 | 1 | h 1.60 · leg 0.49 · arm 0.34 · hand 0.29 · sh 0.41 | no |
| public/models/cybertron/barricade.glb | highmoon | 183 | 16 | 0 | 1 | 16602 | 11 | h 7.20 · hips 3.37 · leg 3.56 · arm 2.39 · hand 0.72 · head 0.41 · sh 2.95 | no |
| public/models/cybertron/bumblebee-wfc.glb | highmoon | 133 | 16 | 0 | 1 | 15276 | 16 | h 6.20 · hips 3.31 · leg 3.15 · arm 2.11 · hand 0.51 · head 0.40 · sh 2.61 | no |
| public/models/cybertron/grimlock.glb | highmoon | 418 | 28 | 0 | 0 | 12444 | 13 | h 12.00 · hips 6.30 · leg 4.51 · arm 2.56 · head 2.31 · sh 2.49 | no |
| public/models/cybertron/ironhide-foc.glb | highmoon | 377 | 16 | 0 | 0 | 11435 | 12 | h 8.50 · hips 4.28 · leg 3.65 · arm 3.09 · hand 1.35 · head 0.48 · sh 3.10 | no |
| public/models/cybertron/jazz.glb | highmoon | 89 | 16 | 0 | 0 | 9847 | 6 | h 6.60 · hips 3.71 · leg 3.14 · arm 2.11 · hand 0.84 · head 0.33 · sh 2.62 | no |
| public/models/cybertron/jetfire-jet.glb | highmoon | 1881 | 144 | 0 | 0 | 7258 | 3 | h 8.66 · hips 9.98 · leg 7.41 · arm 6.27 · sh 6.28 | no |
| public/models/cybertron/jetfire.glb | highmoon | 1963 | 144 | 0 | 0 | 12199 | 13 | h 10.50 · hips 4.99 · leg 4.27 · arm 3.61 · hand 1.40 · head 1.06 · sh 3.62 | no |
| public/models/cybertron/leaper.glb | highmoon | 687 | 20 | 0 | 0 | 5652 | 5 | h 6.40 · hips 2.79 · leg 2.38 · arm 2.02 · head 0.01 · sh 2.02 | no |
| public/models/cybertron/megatron-foc.glb | highmoon | 320 | 20 | 0 | 1 | 22693 | 29 | h 10.53 · hips 5.30 · leg 5.04 · arm 3.83 · hand 1.41 · head 0.62 · sh 3.99 | no |
| public/models/cybertron/optimus-wfc.glb | highmoon | 164 | 16 | 0 | 1 | 14415 | 11 | h 9.50 · hips 5.08 · leg 4.50 · arm 3.42 · hand 0.57 · head 0.59 · sh 3.72 | no |
| public/models/cybertron/ratchet-foc.glb | highmoon | 529 | 16 | 0 | 0 | 11833 | 10 | h 8.50 · hips 4.43 · leg 3.78 · arm 3.20 · hand 1.43 · head 0.58 · sh 3.20 | no |
| public/models/cybertron/skywarp-jet.glb | highmoon | 239 | 16 | 0 | 0 | 7513 | 6 | h 4.60 · hips 5.66 · leg 4.89 · arm 4.13 · sh 4.14 | no |
| public/models/cybertron/sniper.glb | highmoon | 687 | 20 | 0 | 0 | 5716 | 6 | h 7.40 · hips 5.29 · leg 4.53 · arm 3.83 · head 0.02 · sh 3.84 | no |
| public/models/cybertron/soundwave-foc.glb | highmoon | 228 | 20 | 0 | 1 | 9639 | 9 | h 10.00 · hips 5.48 · leg 4.77 · arm 3.36 · hand 0.78 · head 0.54 · sh 3.92 | no |
| public/models/cybertron/starscream-foc.glb | highmoon | 392 | 16 | 0 | 0 | 12025 | 10 | h 9.50 · hips 4.79 · leg 4.10 · arm 3.47 · hand 1.32 · head 0.49 · sh 3.48 | no |
| public/models/cybertron/thundercracker-jet.glb | highmoon | 239 | 16 | 0 | 0 | 7513 | 7 | h 4.60 · hips 5.66 · leg 4.89 · arm 4.13 · sh 4.14 | no |
| public/models/cybertron/trooper.glb | highmoon | 687 | 20 | 0 | 0 | 10027 | 17 | h 7.00 · hips 3.71 · leg 23.47 · arm 2.69 · head 0.28 · sh 2.69 | no |
| public/models/cybertron/ultra-magnus-foc.glb | highmoon | 149 | 0 | 0 | 0 | 20772 | 20 | h 11.00 | no |
| public/models/cybertron/warpath-foc.glb | highmoon | 535 | 16 | 0 | 0 | 10105 | 10 | h 8.00 · hips 4.31 · leg 3.69 · arm 3.12 · hand 1.31 · head 0.45 · sh 3.13 | no |
| public/models/cybertron/zeta-prime.glb | highmoon | 141 | 16 | 0 | 0 | 14094 | 9 | h 10.00 · hips 5.43 · leg 4.63 · arm 3.52 · hand 1.34 · head 0.70 · sh 4.43 | no |
| public/models/cybertron/arcee.glb | prime | 72 | 30 | 0 | 1 | 29992 | 7 | h 5.60 · hips 3.20 · leg 3.15 · arm 1.48 · hand 0.47 · head 0.41 · sh 0.83 | no |
| public/models/cybertron/bulkhead-car.glb | prime | 57 | 22 | 0 | 0 | 4875 | 6 | h 2.62 · hips 1.62 · leg 1.17 · arm 1.90 · sh 1.63 | no |
| public/models/cybertron/bulkhead.glb | prime | 57 | 22 | 0 | 1 | 6868 | 3 | h 8.00 · hips 3.42 · leg 2.47 · arm 4.01 · hand 0.97 · head 0.46 · sh 3.44 | no |
| public/models/cybertron/vehicon.glb | prime | 32 | 12 | 0 | 0 | 11996 | 0 | h 7.00 · hips 4.05 · leg 3.55 · arm 3.40 · hand 1.09 · head 0.46 · sh 1.69 | no |
| public/models/cybertron/predaking.glb | none | 61 | 0 | 0 | 0 | 26125 | 0 | h 14.00 · head 1.15 | no |
| public/models/cybertron/shockwave-foc.glb | none | 50 | 30 | 0 | 0 | 11517 | 1 | h 11.00 · hips 6.18 · head 0.64 | no |
| public/models/cybertron/soundwave-tfp.glb | none | 130 | 0 | 0 | 0 | 25011 | 0 | h 10.50 · hips 6.34 · head 0.84 · sh 3.60 | no |
| public/models/galaxy/surface/atap.glb | none | 29 | 0 | 0 | 3 | 25454 | 20 | h 10.00 | no |
| public/models/galaxy/surface/atat.glb | none | 72 | 0 | 0 | 3 | 40016 | 9 | h 22.50 · head 2.17 | no |
| public/models/galaxy/surface/atat.ultra.glb | none | 72 | 0 | 0 | 3 | 74295 | 9 | h 22.50 · head 2.17 | no |
| public/models/galaxy/surface/atst.glb | none | 32 | 0 | 0 | 2 | 15744 | 4 | h 8.60 · head 1.74 | no |
| public/models/galaxy/surface/atte.glb | none | 124 | 31 | 0 | 1 | 35997 | 2 | h 10.01 · hips 5.36 · head 4.25 | no |
| public/models/galaxy/surface/rancor.glb | none | 693 | 108 | 80 | 1 | 19996 | 6 | h 5.00 · hips 2.54 · head 0.83 | no |
| public/models/sketchfab/avengers/widow.glb | none | 119 | 30 | 8 | 3 | 28072 | 9 | h 1.70 · hand 0.20 · head 0.14 | no |
| public/models/sketchfab/optimus-transform.glb | none | 83 | 24 | 0 | 1 | 64548 | 38 | h 63.31 · hips 8.44 | no |
