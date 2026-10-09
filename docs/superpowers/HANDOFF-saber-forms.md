# Handoff: lightsaber forms, the look, the hold, the Force and dismemberment (six lanes, one branch each)

A staff and a pair that move as such, each stance with a special; a blade that glows, hums, ignites and lights its wielder; a hilt measured in every hand and the hand layer called when it exists; eight Force powers; a lethal stroke that severs as a clipped twin; duellists with the whole kit. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-09-saber-forms-force-dismemberment-design.md` (what and why; where the site is; the ten pieces; what it is not)
2. `docs/superpowers/plans/2026-10-09-saber-forms-force-dismemberment.md` (your lane’s tasks: files, interfaces, tests)
3. `docs/decisions/2026-10-09-dismemberment-by-a-clipped-twin.md` and `docs/decisions/2026-10-09-forms-from-mirrored-clips.md`
4. `docs/superpowers/HANDOFF-combat.md` (lanes A–E of the revamp this stands on: the look, bolts, strokes from clips, duellists, parity) and `docs/superpowers/specs/2026-10-08-combat-revamp-design.md`
5. The headers of `src/components/galaxy/surface/saber.js`, `combatRules.js`, `duellists.js`, `activity.js`, `heldBlade.js`; `src/lib/combat/blade.js`, `duel.js`, `bolt.js`; `src/lib/three/ragdollPhysics.js`, `combat/trail.js`; `src/components/universe/gunplay.js` and `grip.js`; `src/components/deathstar/inside/scene/saber.js` and `rules/force.js` (what is lifted)
6. The lane beside you: `docs/superpowers/HANDOFF-npc-player-rigging.md` (fingers and the hand layer; a local session is on its Phase 0–1 as this is written, branch `claude/rigging-p0`, no commits past `main` yet)

## Which lane is yours

| Lane | Branch | Tasks | Starts from | Blocked by |
|---|---|---|---|---|
| 0: the tools and the hilt asks | `claude/saber-0-tools` | 1, 2 | `main` | nothing |
| A: the look | `claude/saber-a-look` | 3–7 | `main` after 0 | 0 |
| B: the forms | `claude/saber-b-forms` | 8–11 | `main` after A | A (both edit `saber.js`’s `update`) |
| C: the hold | `claude/saber-c-hold` | 12 | `main` after 0 | 0; merge after A or B if they land first |
| D: the Force | `claude/saber-d-force` | 13–15 | `main` after B | B (the kit rows on the duellist) |
| E: dismemberment | `claude/saber-e-sever` | 16–18 | `main` after B | B (every blade’s sweep); may run beside D |
| F: the close | `claude/saber-f-close` | 19 | `main` after D and E | D, E |

A and C may run at once on separate branches; D and E may run at once after B. One session can take the lanes in order, merging each before the next; stop and write the status table when your context is heavy, and the next session picks up the next lane.

## The map (read in this session from `main` at 9f1e7d15; a line number may drift by a few)

**The saber.** `saber.js:105` `createSaber(gp, { color, hilt, stance, parent, sound, fig, clips })`; `:114` `two` (both hands on one hilt for every stance but dual); `:119-127` the staff’s cloned `blade2` on the pommel at y −0.16; `:129-139` the pair’s `gun2` under `LeftHand` from the right hand’s mirrored quaternion; `:141-142` segs and trails per blade; `:210-260` `pose()` (the two-handed guard, `gp.holdLeft` at `LEFT_DOWN` 0.09); `:267-294` `poseLeft` (the pair’s guard, before the stroke at `:544` so the clip’s off-hand wins mid-stroke); `:343-351` `pushBlades`; `:385-397` the contact-window correction on the main blade only; `:399-407` the sweep over every blade, `hit(target, damage, at, { heavy })`; `:443` `swing(now, { heavy, dir, lock, lunge, clip })`; `:507-511` `guard()` returns `segs[0]` only; `:534-542` the lit scale (`LIGHT` 9/s), the sleeve flicker, the charge swell (main core only); `:543` `gp.twist(0)` every frame, never non-zero (`TWO.twist` unused); `:584-604` `dress`.
**The hilt.** `gunplay.js:789-840` `GUNS.saber` (`hands: 2`, `fore.r` 0.017, the grip drum 0.2 tall, blade group at y 0.16, `muzzle` [0, 1.16, 0]; core `#ffffff` 1.0, sleeve 0.6 × colour, both `toneMapped: false`); `:863-884` `handFrame`; `:912-920` `GRIP_FIX = { built }` only; `:1150-1162` the hilt into the hand; `:1246` the chest takes `st.twist`; `:1370-1377` `placeLeft`; `:1401-1405` `holdLeft`; `:1407-1409` `twist(rad)`; `m.L`/`leftInv` private at `:1118, 1167`.
**The forms today.** `combatRules.js:41-96` `STANCES` (five clips shared); `:100-108` `HEAVY`, `DIRS`, `BLOCK_CLIP`, `DASH_CLIP` (never played); `:120-131` `strokeFor` (no stance branch); `:114-117` `FORCE`; `:175-190` `forceAt`, `pushVelocity` (take an override `f`). `duellists.js:49-53` `duelFor` (the stance’s clip names only); `:85` `t.blade.swing(time, { clip, lock })`; `:169-183` `clashes` on `blades[0]`. `duel.js:27-36` `DUEL`; `:38-39` a hard-coded fallback stroke list; states `approach | circle | attack | recover | block | parry | stagger | dead`.
**The clips.** All 31 UAL2 `Sword_*` baked (`ual-bake.mjs:234-272`); `contactWindow` `:315-337` on the right fist’s tip, `bladeRows` `:356-375`, the `ahead` test at `:371`; no staff, pair, spear or katana motion in UAL1, UAL2 or Meshy’s set (`docs/research/2026-10-08-combat-feel-and-offline-motion.md:737-772`); packs not local (`node scripts/assets-fetch.mjs ual1 ual2`). Unused reaction clips: `dodge` 314, `dodge.roll` 315, `roll` 94, `backflip` 146, `hit.knock` 161, `knockdown` 327, `stand.up` 332, `arise` 331, `electrocuted` 326, `lifted`/`.fall`/`.land` 210-212, `cast`, `cast.double`, `push` 98-101/147-148 (`clipLibrary.js`).
**The look.** `post.js:79` the surface’s bloom `{ 0.8, 0.55, 1.7 }`, `:367-369` `flare(k)`, `:434-440` `lite()`; `scene.js:401-406` four indoor lamps, `:428-431` the muzzle flare light (the pattern for a light made at build); `trail.js:16-44` a uniform strip; `sounds.js:421-505` `saber()`, `:509-549` `combat()`; `sfx.js:601-655` `saberRaw(ac, dest, when, 'jedi' | 'sith')`; `scene.js:670` the sound router calls both `saber` and `combat` (make it one). The Death Star’s `inside/scene/saber.js`: `BLADE` `:61`, `CLASHES` `:78`, `POOLS` `:84-88`, `hum` `:106`, `trailLevel` `:168`, `arcPath` `:212`, the sprite shaders `:241-283`, the trail shader `:285-303`, `lamps` `:763-768`.
**Deaths.** `activity.js:461-465` `fell`; `:563-611` `dying()` (`die.*` through `react('down')` else `fallTurn`, lie 2 s, sink); `:630-658` `hit(t, damage, { breaks, how, push, at })` (`t.how` for `SHOW_KILLS` is the death-kind pattern); `:676-683` `knock`; `:776-790` the knock in flight; `:830` the holder tilt is the whole stagger visual; `:900` shooters skip a knocked figure; `:905-909` the duellist’s push; `:910` duellists skip the melee token. `groundFigures.js:331-352` `fell` with `rigRagdoll` (cap `RAGDOLLS` 4, tier `high` within 40 m: `groundScene.js:42-49`); `:214-217` the drop path. `scene.js:2647` the saber sweeps `activity.targets` only; `:2054-2088` `saberHit`. `ragdollPhysics.js:42` `createBody`; `:206` `rigRagdoll` (needs Hips, Spine, both UpLegs and Arms: not for a loose piece); `portalFx.js:124-139` the clipping-plane material clone; `scene.js:210-211` `localClippingEnabled` on. The meshes: one node, one 24-joint skin, 1–6 primitives by material, shared geometry across clones (`gltfCache.js:53-70`, `footScene.js:341-349`), `grip.js:279-313` the curl geometry shares the source’s index; dominant-joint skinning clean at the neck and forearm, ragged at the torso and thigh.
**The Force.** `scene.js:1871-1961` `power(slot)`; `:828` `state.cool`; `:1964-1985` `stepJet` (the one held ability, slot `power` only; V has no release: `SurfaceView.jsx:167`); `:2131-2156` `stepHud`’s `combat` event; `GalaxySurface.jsx:599, 623-640` the powers list and its gate; `:1848-1864` `pickLock`; `:2838-2841` hit-stop scales every `dt`; `:2955-2967` you pushed by a duellist (before the `state.safe` check). `abilityRules.js:12-24` `ABILITIES`; `:31-35` `abilitiesOf`. `deathstar/inside/rules/force.js:100-200` the channel core; its `POWERS` `:44-60`.
**Tests and tools.** `saber.test.js:17-67` the headless pattern (real clips off disk, `meshyRig`, `createGunplay`, frame stepping); `duellists.test.js:59-74`; `activity.test.js:122-158` (`settle`, `out`, `run`); `vite.config.js:21` excludes `*.scenario.test.js`; `vitest.ai.config.js:10`. `heroes.html:7-24` params and `body[data-metrics]` `:176-197`; `surface-shot.mjs:17-75` the Playwright prelude; `anim-check.mjs --chrome edge`; `window.__surface()`, `__surfaceDo(name, …)` (`advance`, `missionDo`, `teleport`, `zone`, `press`, `release`), `__surfaceScene.swing(o)` (DEV only, so the dev server, not `vite preview`).

## The rules (don’t break)

- **No new grip.** The hold is `gunplay.js`’s one path; this lane adds `GRIP_FIX` rows and `gripFor(side)` and calls `fig.hands?.hold` when the hand layer exists. `gunplay.js`’s curl block (`:1119-1135`, `:1353-1359`) is the rigging lane’s.
- **No motion-capture output ships.** HY-Motion’s licence excludes the EU and the UK (`docs/research/2026-10-08-motion-spike.md §3`). Forms come from mirrored and layered library clips.
- **No blood.** A sever is a clean cut with a cauterised glow; the Menu’s Dismemberment setting turns it off; it is never on below the high tier or past 40 m, and never more than three at once.
- **Layers and sizes** (`docs/health/RULES.md`): `src/lib/combat` pure; `src/lib/three/combat` knows no world; `scene.js`, `activity.js`, `saber.js` take additive lines only, the new code in new files; every new module under 800 lines with its test beside it. `saber.js` must come out of Lane B shorter than it went in (the stance geometry moves to `saberForms.js`).
- **Nothing a visitor can do is lost.** Q is the one key added (the special); G and V keep their meaning; stored heroes resolve (`STANCE_IDS` unchanged); an older peer reads the walk packet as before.
- **Byte identity**: the `sword` set re-bakes identical after Lane B’s bake changes (the test is the law).
- **One lane per PR, merged on its own.** CI green, a merge commit. Merge `origin/main` in before opening and before merging; `scene.js`, `activity.js`, `gunplay.js` are edited by other lanes (the rigging lane, the feel lanes, #579), so a conflict there is resolved by keeping both sides.
- **Before the PR**: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; the lane’s `saber-check` moments and `saber-sheet` modes, their PNGs under `docs/superpowers/evidence/saber/` and named in the PR; `anim-check` on the vision’s fight reported (it fails the 0.15 m/s bar on `main` already: say the number, don’t gate on it).
- Keep output terse. Commits end with the harness’s attribution lines; no model names in code, docs or commits. British spelling, curly quotes, plain sentences; comments say why.

## What done looks like, per lane

- **0**: `heroes.html` takes `stance`, `who`, `view=hands`; `node scripts/saber-sheet.mjs` writes `hands-<mode>.png` and `hands.json` and judges them; `node scripts/saber-check.mjs` shoots the moments; `hands-guard-before.png` saved from `main`; five `gen3d` issues open for the hilts, their numbers in the table below.
- **A**: a lit blade on Tatooine blooms, hums, ignites over 0.16 s, lights Luke and the sand, trails only when fast; a parry flashes and flares the post; a staff’s two blades flicker out of step; the Death Star’s suite still passes with `arcPath`, `hum`, `trailLevel` imported from `saberFx.js`; `check-ignite/stroke/block-deflect/clash.png` looked at.
- **B**: 13 `sword.mirror.*` files; a pair alternates hands and the left blade hits on the left; a staff whirls and hits behind; Q is a special on every stance; an aerial in the air; duellists evade, go heavy after two blocks, use their special, take turns, get knocked down and get up; `check-special.png` for each stance.
- **C**: `hands-<mode>.png` with every holder (Luke, Ahsoka, Vader, Maul, Dooku, the Inquisitor, the clone, Obi-Wan, the three Jedi) and `hands.json` under the limits; Obi-Wan on Mustafar holds his hilt; `saberHands` calls `hold`/`release` when `fig.hands` exists (tested with a fake).
- **D**: a saber hero picks two of eight powers; lightning chains and drains a guard; a grip lifts and throws; a leap lands a pound; speed halves the world; a trick stands two down; Vader grips you and a dodge in the tell is safe; both slots release on keyboard and touch; `check-power-<kind>.png` for every kind.
- **E**: a lethal overhead on a trooper severs the neck and a rise the shin, cleanly, with a cooling glow; the piece lands and rests; the hilt follows a severed sword arm; capped at three; off by the Menu; `check-sever.png`; the Kashyyyk frame time with three severs quoted.
- **F**: everything at once in the browser; the docs; the backlog rows.

## How to check

- Vite on 5188 in your worktree (an entry in `.claude/launch.json`, `preview_start`); on Windows `CHROME=` Edge’s full path for `saber-sheet`, `saber-check`, `surface-shot` (`anim-check` takes `--chrome edge`). The hidden browser pane stalls the galaxy pages: shoot headless, or keep the pane visible.
- `node scripts/saber-sheet.mjs [--only luke,vader] [--mode guard]`; `node scripts/saber-check.mjs [--only ignite,sever]`.
- In the browser: `/?quality=low&calibrate=off#/galaxy/dagobah/surface?mission=raise` with `localStorage['tp-galaxy-hero'] = '{"id":"luke","stance":"double","force":["lightning","grip"]}'`; `__surfaceDo('missionDo','skip')` twice, `__surfaceDo('teleport', -66, -108.5, Math.PI)`; `__surfaceDo('debug').fight[0].body.duel`; `__surfaceScene.swing({ special: true })`; `__surfaceDo('press', 'power')` / `('release', 'power')`. Maul: `#/galaxy/naboo/surface`, Ric Olié at the hangar (−284, 168). The Inquisitor: `#/galaxy/lothal/surface`, Ahsoka at the temple. Troopers to cut: `#/galaxy/kashyyyk/surface` (the beach).
- `npx vitest run src/lib/combat src/lib/three/combat src/components/galaxy/surface/saber.test.js src/components/galaxy/surface/saberForms.test.js src/components/galaxy/surface/combatRules.test.js src/components/galaxy/surface/duellists.test.js src/components/galaxy/surface/surfaceForce.test.js src/components/galaxy/surface/surfaceSever.test.js scripts/ual-bake.test.mjs`.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan’s line in your PR and say so in the PR body in one sentence. If `arcPath` cannot move out of the Death Star’s file without breaking its tests, re-export it from `saberFx.js` and leave the original; say so. If the mirror bake’s left-hand window is not found on a clip, give that stroke an explicit `contact` in the stance table and list it.

## Status

| Lane | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/lightsaber-combat-force-powers-14935a` | (this PR) |
| 0 | | | |
| A | | | |
| B | | | |
| C | | | |
| D | | | |
| E | | | |
| F | | | |

Hilt issues (`gen3d`): Luke #, Vader #, Maul #, Ahsoka #, Dooku #.

Findings for the next lane go here: which models needed a `GRIP_FIX` row and why, which clips’ left-hand windows were explicit, the frame time with three severs, which powers were tried by hand on a phone, what the peers see.
