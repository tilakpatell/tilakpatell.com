# Handoff: Middle-earth kitchens, side games, the hidden places

For whoever picks this up next (another session, or the same one after a
break). State as of 2026-10-05.

## Asked for

- An Overcooked-style co-op kitchen in every chapter, played online
  (Nostr relays, no backend). Other players in the walkable towns are
  ghosts from "another dimension": visible, no interaction.
- New games and tasks inside the walkable worlds.
- The inside of Orthanc, found through an Easter egg.
- Keep merging whatever is done into main, agent worktrees included.

## Done (on main)

- Ten kitchens, `src/components/middleearth/rush/`, one per chapter:
  party (Shire), pony (Bree), weathertop, rivendell, moria, lorien,
  amonhen, ithilien (dead-marshes), tower (cirith-ungol), cormallen
  (mordor). Mounted in `src/pages/MiddleEarth.jsx`, one block each.
  - Pure rules, tested: `rules.js` (mechanics: fishing line F, leaf table
    L, patch G, carving table A, webs ',', `fuel`, `thief`, multi-recipe
    ovens via `ovenFor`). Wire: `protocol.js`. Host/guest: `online.js`.
  - Look: `scene.js` + a theme per kitchen in `rush/themes/` (see the
    header of `themes/common.js` for what a theme can say). Things:
    `items.js`. Levels: `rush/levels/*.js`.
  - Append-only rule: new KINDS, new states on a kind, new event types go
    on the END of their lists (the wire indexes them).
  - Spec: `docs/superpowers/specs/2026-10-05-pony-rush-design.md` (table
    of all ten).
- Ghost travellers in the towns: `towns/travellers.js`, `ghosts.js`,
  `useTravellers.js`.
- Merged from the agents (their branches `worktree-agent-*`):
  - Orthanc: `towns/orthanc/`, hidden route `#/middle-earth/orthanc`,
    found by clicking Orthanc on the map; `middleearth/hidden.js`; spec
    `docs/superpowers/specs/2026-10-05-orthanc-design.md`.
  - Side games: Hobbiton (Bilbo's spoons), Lothlórien (Legolas's
    targets), Amon Hen (ducks and drakes), Dead Marshes (Sméagol's safe
    way). Shared `towns/side.js`. Their achievements are NOT in any
    chapter's `seals` (a chapter is "won" when all its seals are).

## Agents stopped (org spend limit), 2026-10-05

Their unfinished, uncommitted work was saved as patches in
`docs/superpowers/handoff-patches/`; both are applied and finished now
(see below), and the folder is gone.

## Done since (this session)

- All eleven places (the ten chapters and Orthanc) load clean headless
  (`lab/world-errs.mjs`). The western side games (Bree's song, Gandalf's
  mark, Bilbo's riddles, the plank) each start from the list's "Go there"
  and run without page errors (`lab/side-smoke.mjs`).
- Cirith Ungol's side game, "Crumbs on Sam's cloak" (`towns/cirithungol/`,
  achievement `notacrumb`): the night on the stair; brush Gollum's lembas
  crumbs off before Frodo wakes. Open once the stairs are climbed.
- Mount Doom's side game, "Do you remember the Shire?" (`towns/doom/`,
  achievement `remembertheshire`): Sam tells the Shire a thing at a time
  and Frodo says them back, two to six. Open once Gorgoroth is crossed.
- Both keep `{ won, best }` under `tp-cirithungol-side` and
  `tp-doom-side` (`towns/side.js`), lower is better.
- Orthanc: Gwaihir and the moth were children of the tower's group (at
  AT.tower) but placed in world coordinates, so they drew 3 km off and
  Gandalf flew on nothing. They hang off the scene now. The agent's
  patch over it (the hall's hanging lamp, the shafts fading as the camera
  comes into one, Saruman of Many Colours as a shader, the stair camera
  ahead of you, the brighter tower moods) is in too.

## Still in flight when this was written (superseded above)

Three background agents, each in its own worktree under
`.claude/worktrees/agent-*` (git-ignored), committing one world at a time
on its own branch:

- western side games: Shire done; Bree, Weathertop, Rivendell, Moria to go
- eastern side games: Lórien, Amon Hen, Dead Marshes done; Cirith Ungol,
  Mount Doom to go
- Orthanc: first commit merged; may keep polishing

To pick up their work: `git log origin/main..worktree-agent-<id>` for new
commits, `git merge worktree-agent-<id>`, resolve (usually
`MiddleEarth.jsx` blocks or `Achievements.jsx` lists: keep both sides),
lint, test, PR, merge. If the worktrees are gone, the branches may still
exist locally; if not, the work in them was lost, so redo from the list
above.

## Done since (2026-10-06)

- Orthanc's tower rebuilt (`towns/orthanc/props.js`, `tower()`): four
  fluted piers lofted from one faceted section (`PIER`, `loftPier`), root
  feet on a stepped plinth, buttresses, lancet windows in the clefts,
  Saruman's balcony, claw horns, lesser blades and spikes; the stone gets a
  rim of storm light and the pits' fire from below (`towerStone`'s
  `onBeforeCompile`). On the pinnacle the camera keeps out of the horns
  (`insideTop`, sharing the horns' shapes).
- Minas Tirith, the second hidden place (`towns/minastirith/`,
  `#/middle-earth/minas-tirith`, found by clicking the white city on the
  map): spec `docs/superpowers/specs/2026-10-06-minas-tirith-design.md`.
  `hidden.js` has two entries now; the map's road so far counts the
  places off the road and names one only once it's found
  (`record.js`: `HIDDEN_SEALS`, `offRoad`).
- Space and E go to the world, not to a page button that has focus
  (`towns/keys.js` `ownButton`, in every town).
- Edoras, the third hidden place (`towns/edoras/`, `#/middle-earth/edoras`,
  found by clicking the golden hall on its hill on the map), played as
  Gimli: spec `docs/superpowers/specs/2026-10-06-edoras-design.md`. Seals
  `edoras`, `rohanwillanswer`, and `drinkinggame` on the side (a dozen
  tankards before going under; best kept in `tp-edoras-side`). Lab:
  `lab/ed-tour.sh` (every step shot), `lab/ed-play.mjs` (played through
  with key presses).
- Amon Hen's kitchen: ducks between the boats, the mist of Rauros on the water.
- Moria's shore under the West-gate: stones, reeds, dead trees, lake mist.

## Ideas not done yet

- Kitchen dressing: Amon Hen (ducks, the falls' mist). The orcs' mess is
  dressed now (`rush/themes/tower.js`: torches on every wall, the Eye's
  banner, a slit window on Mordor with the beam sweeping, Frodo's cage on
  its chain, spears, a whip, skulls on the spikes, spilt draught, grime,
  embers and ash, and Shelob's children creeping down the side walls as
  the round goes on). All ten shot and looked at (`lab/rush-shots.mjs`).
- Shots of every walkable world after the side games land, then dress
  what looks bare.
- Done: the road so far on the map hub (`middleearth/record.js`, tested;
  `MapHub.jsx`'s "The road so far" button): every chapter's seals, its
  side game's star and its kitchen's stars and best coins, with totals.
  `rush/levels/index.js` now holds the level list (`LEVELS`, `levelOf`,
  `bestKey`) for the hub and `Rush.jsx` both.

## How to check things (local, `lab/`, not committed)

- 2026-10-06's scripts (recreate if gone): `lab/browser.mjs` (Vite +
  Chromium; forces `preserveDrawingBuffer` on every WebGL canvas so any
  canvas can be read back; `TIER=high` pins the device tier through
  `tp-quality`), `lab/kit-shot.mjs` + `lab/kit.html` + `lab/kit-entry.js`
  (one kit piece on its own: `mod=…&fn=…&call=…&args=[…]&cam=…&look=…`),
  `lab/world-shot.mjs <route> <hook> <out> '<js with s=sim>'` (a world,
  with `s.debugCam = { at, look, fov }`), `lab/town-shots.mjs <prefix>
  place:HOOK …` (each world's opening view), `lab/rush-shot.mjs <place>
  <out>` (a chapter's kitchen).

- `lab/browser.mjs`: Vite in-process + the container's Chromium
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, SwiftShader).
  Never `playwright install`.
- `lab/rush.html?level=<id>` (+ `lab/rush-entry.jsx`): one kitchen on its
  own page, no town above it (much lighter).
- `lab/rush-smoke.mjs [ids]`: load, play, set up mid-service
  (`lab/rush-setups.mjs`), run; fails on any page error.
- `lab/rush-shots.mjs <prefix> [ids]`: canvas read straight back
  (preserveDrawingBuffer); Playwright's own screenshot hangs on this
  page's fonts, so don't use it here.
- `lab/world-errs.mjs <place ids>`: loads each Middle-earth place and
  prints page errors. `lab/side-smoke.mjs <town ids> [--shot=prefix]
  [--keys=a,b,W:800,none]`: finishes a town's story in localStorage, opens
  the list, clicks the side game's "Go there", presses keys, shoots the
  canvas before and after. Under SwiftShader the sim's dt is clamped to
  0.05 s a frame, so everything runs in slow motion: a 1.5 s wait can
  still show the frame before.
- (`lab/` is git-ignored: recreate these from this note if they're gone.)
- Under heavy load (several agents rendering) shots take minutes and long
  simulation tests elsewhere time out at 5 s; rerun with
  `--testTimeout=120000` before calling anything broken.
- `window.__RUSH__` = { api, sim } in dev; `sim.speedup` speeds the clock.

## Conventions

- Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the
  session's `Claude-Session:` line.
- Branch for this work: `claude/zealous-bohr-se2l0t`. After its PR
  merges, restart it from main before new work.
- The towns session (another session) owns the walkable towns; tell it
  before large changes there.

## Steps left (in order)

1. The ideas list above, less what's done (the orcs' mess is dressed, the
   hub has the road so far). Shots of every walkable world after the side
   games, then dress what looks bare, is the big one left.
2. Amon Hen's kitchen could still take ducks on the lake and the falls'
   mist; the Pony's floor is fine as it is (looked at: flagstones under a
   plaster room, reads well).
