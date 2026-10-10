# Lane H: Heroes vs Villains and Blast on the surface engine. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (one session, task by task; no review loops). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Two more Battlefront modes playable on the galaxy's worlds today: **Heroes vs Villains** (four light-side heroes against four dark, one target a team, in the level's hero arena) and **Blast** (ten a side, kills to 100, on the level's team-deathmatch spawns), as pure, seeded mission kinds beside the galactic assault, with the game's HUD lines, on Hoth first and then every world whose level carries the layer.

**Architecture:** `missions/hvv.js` and `missions/blast.js` are pure rules in the pattern of `missions/assault.js` (seeded, stepped, tested headless); `hvvScene.js` and `blastScene.js` draw them as `assaultScene.js` does; the arenas and spawns come from lane 0's map rulebook (`maps/<level>.json`: the `HeroArena` volumes, the `TeamDeathmatch` spawns; the extractor is run for Endor, Tatooine, Geonosis and Kashyyyk); HvV's saber bots take `duellists.js`'s mind and blaster bots `hostiles.js`'s; the HUDs are small React parts beside `AssaultHud.jsx`.

**Spec:** `2026-10-10-battlefront-flow-and-mods-design.md`, decision 5; the game design's modes table (`HeroArena`, `TeamDeathmatch`) and section 6.

## Global constraints

- Start from `main`. Own: `src/components/galaxy/surface/missions/{hvv.js,hvv.test.js,hvvScene.js,blast.js,blast.test.js,blastScene.js,arenas.js}`, `surface/{HvvHud.jsx,BlastHud.jsx}`, `surface.css` (`.hvv-*`, `.blast-*`), `missions/index.js` (two rows per world, additive), `scene.js` (the two kinds beside `assault`: additive, in the same switch), `pages/GalaxySurface.jsx` (mount the two HUDs; the best and the achievements), `src/data/bf2017/maps/{endor,tatooine,geonosis,kashyyyk}.json` (the extractor's output; lane 0's script, no change to it beyond `--level`), `scripts/hvv-check.mjs`.
- Numbers from the rulebooks where they exist (the arena volumes, the spawns, the heroes' hit points from `bf2017Abilities.json`); the target rule, 10 points and 100 kills are `hand` with a `NOTES.md` line until lane D2 reads the mode graphs.
- The galaxy's budgets hold; a hero bot's body is the hero's light cut (`walrusCuts.js`'s ledger admits full cuts by share); no sequel heroes.
- Files under 800 lines; the usual gates.

## Tasks

### Task 1: The arenas and spawns from the levels

- [ ] `node scripts/bf2017-data.mjs map --root <web dir> --level endor_01` (and `tatooine_01`, `geonosis_01`, `kashyyyk_01`) → `src/data/bf2017/maps/<world>.json`; check each has `HeroArena` (or `HeroesVsVillains`) volumes and `TeamDeathmatch` spawns in `rows.volumes` and `rows.spawns` (`layer` field); sizes in the PR.
- [ ] `missions/arenas.js`: `arenaFor(world)` → the HvV arena as site coordinates (the level pack's frame to the site's, `sites/<world>.js`'s level offset as lane L placed Hoth: `--spot`), its bounds and the team spawn clusters; `blastSpawnsFor(world)` likewise; a world whose site has no level pack yet (Endor, Tatooine…) takes the same volumes at the site's own scale around its landing spot with a `hand` note, so the modes play there too.

### Task 2: Heroes vs Villains, the rules

- [ ] `hvv.js`: `newHvv(map, { seed, you, side })`: 4 v 4 from `HEROES` by `lean` (you one of yours; the rest bots), a **target** per team drawn at the start and on each target's death (the game's rule: only the target's death scores; everyone else respawns), 10 points wins; `stepHvv` moves bots (saber bots: `duellists.js`'s `duelFor` against their mark, the nearest enemy, the target first; blaster bots: `hostiles.js`'s burst and strafe toward their mark), tracks hp from `bf2017Abilities.json`'s hero hit points scaled as `abilityRules.js` scales them, respawn at the team's spawn cluster after `RESPAWN` s (`hand`, 10), the arena's bounds as out-of-bounds (10 s, the game's rule), the end; `hvvView` for the HUD (the two scores, both targets, who is up).
- [ ] `hvv.test.js`: a target's death scores and a non-target's does not; a side reaches 10 and the mission ends; a no-player run ends under 10 minutes on three seeds; nobody leaves the arena.

### Task 3: Heroes vs Villains, on screen

- [ ] `hvvScene.js`: the bots as the crew's hero figures (the walrus loader, `cutAt`), the target marks (the game's target icon over the head, the colour of the side), the arena's edge as a soft wall light; the barks from `heroes.js`'s `lines`; `scene.js`'s `hvv` kind: your strokes and shots hit the bots' capsules as the assault's do, `hurt()` to nothing puts you down and respawns you, Again.
- [ ] `HvvHud.jsx`: the two scores, your team's target and theirs, the respawn count; the end card the assault's with the side's name.
- [ ] `scripts/hvv-check.mjs`: play through the dev hooks (`missionDo('score', side)`), shots to `docs/superpowers/evidence/bf-hvv-blast/`.

### Task 4: Blast

- [ ] `blast.js`: two sides of ten on the `TeamDeathmatch` spawns, `assault.js`'s soldiers (`newBattle` with `posts: []`, the same squads, cover and suppression), a kill counter to 100 (`hand`), respawn waves as the assault's, no tickets; `blastView`.
- [ ] `blastScene.js` reuses `assaultScene.js`'s drawing (export what it needs rather than copy); `BlastHud.jsx`: the two counters as the game's score bar.
- [ ] `blast.test.js`: kills count once; 100 ends it; a no-player run ends under 15 minutes at the mid tier.

### Task 5: The rows and the menu

- [ ] `missions/index.js`: `hvv` and `blast` rows for Hoth, Endor, Tatooine, Geonosis, Kashyyyk (the worlds whose levels carry the layers and whose sites can land); `index.test.js` covers them as the assaults.
- [ ] When lane F has merged: `modes.js`'s `hvv` and `blast` cards go `live` from these rows (if F is not merged yet, the rows are enough: F reads `MISSIONS`); the briefing's `game.also` lines for the two on Hoth.
- [ ] `Achievements.jsx`: `heroesvsvillains`, `blast`.

### Task 6: Docs, checks, PR

- [ ] `HANDOFF-battlefront.md` "The flow and the mods": lane H's row with the numbers; the spec's Departures; `docs/architecture.md`; `guide/pages.js` tips.
- [ ] Gates: lint, test, build, health; `hvv-check`; `galaxy-check surface hoth` with `BUDGET=1`.
- [ ] PR `Battlefront lane H: Heroes vs Villains and Blast on the worlds`; merge `origin/main` first (lane A's `missions/index.js` keys: keep both).
