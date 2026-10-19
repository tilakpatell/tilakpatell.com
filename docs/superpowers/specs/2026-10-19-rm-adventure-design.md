# The Rick and Morty adventure: one story, Schmeckles, and a game in every place. The design

Date: 2026-10-19. Status: design, agreed with the owner section by section in a brainstorming session. The plan comes next (`docs/superpowers/plans/2026-10-19-rm-adventure.md`); the hand-off is `docs/superpowers/HANDOFF-worlds.md`.

## What the owner asked

“Improve the Rick and Morty universe and in general the Rick and Morty stuff. Make it more cohesive and things to do; it seems really boring.”

Their picks, question by question:

- The spine: **a story and Schmeckles**, one save across C-137, the Citadel and the planets.
- The story's shape: **a long campaign**, every place in it, the dull places made into games as they join.
- What Schmeckles buy: **portal gun upgrades, dial coordinates and wardrobe outfits**. Another session is building the site's currency on a branch of the owner's (not yet pushed): the Rick and Morty side must fit it, or wait for it.
- The approach: **a story layer over the worlds that exist** (not a new hub world, and not a port onto the galaxy's planet engine).
- The dial: **locked for a new visitor**, opened by the story or by Schmeckles; **everyone with progress already saved keeps every place**; a **Free roam** switch opens them all.

## Where the site is today

Read from the code on 2026-10-18 (`main` at `50c23802`).

- **No story.** C-137's progress is a flat checklist of 54 things (`world/rules.js` `TASKS`); the objective line is the first one not done, in array order (`progress()`). The Citadel (`tp-citadel-done`), the C-137 checklist (`tp-c137-done`) and Gazorpazorp (`tp-rm-*`) keep their progress apart and none reads another's.
- **Half the dial is look-and-press-E.** Of the 26 dial destinations (`world/dimensions/destinations.js` `DIAL`, with Blips and Chitz), ten have nothing to do but walk up and press E (fantasy, microverse, anatomy, needful, jerryboree, heistcon, gloopynoops, schwifty, cablestudio, vat), and so do three of the map's small planets (birdworld, pluto, gearworld). About 116 of the destinations' 178 hotspots only say a line.
- **The toys tick when they open.** Cable, the butter robot, the Meeseeks box, the plumbus, the Portal Panic cabinet and the cruiser tick their task the moment their overlay opens or the cruiser lifts off (`RmWorld.jsx`'s `PLACES`, its cruiser), not when anything is done in them.
- **Dead ends.** Nothing in C-137's 3D world leads to the Citadel or the planets; the Citadel leads back only to the top of the page; a planet's portal only to space (`planetMode.js` `backLink`). When C-137's list runs out it says the rest are on the map, with no link.
- **The real games stand alone.** Total Rickall, Portal Panic, Roy, the sewer run, the pop quiz, the escapes and hunts on the dial, the two duels, the Vindicators' questions and the Citadel's five-step chain all work, and none leads to another.
- **The wallet exists.** `src/components/universe/economy.js` is the site's one wallet (`tp-pilot`, credits and xp, the `rickmorty` side in `SIDE_RATES`), held by `EconomyProvider` and paid into through `useEarn`; the /c-137 pages do not pay into it. The owner's currency work will change it; draft PR #1028 (“One arsenal”) touches it too.

## The decision

A pure story layer, `src/components/rickmorty/adventure/`, drives the worlds that exist. The story is thirteen episodes; each is a list of steps, and a step waits for an event the worlds already raise or can raise in a line or two (a C-137 task done, an area entered, a game won, a Citadel step). One save holds where the story is. Each episode lands the places it visits as real games, so the campaign is also the plan for making every place worth a visit. Schmeckles come last, through one adapter, so the owner's currency can land first.

The paths not taken: a hub world with a mission board (one more world beside the others, against the cohesion asked for, and a copy of what C-137 already is); and moving C-137 and the Citadel onto the galaxy's planet engine first (months before a story ships).

## The pieces

### 1. The story engine (`src/components/rickmorty/adventure/`)

Pure: no three.js and no React in the rules, each file with its test beside it.

- **`episodes.js`**: the episodes as data. An episode is `{ id, title, intro: [who, text][], steps: step[], outro: [who, text][], unlocks: placeId[] }`. A step is `{ type, …, text }`, where `text` is the objective line while it's current:
  - `task` `id`: a C-137 `TASKS` id is done (the dial's places, the planets' small tasks and the toys all tick through `TASKS`).
  - `win` `game`: a game raised a win that is not a task (`cabinet`, `chase`); the games that tick a task use `task`.
  - `enter` `area`: Morty walks into an area (`rules.js` `AREAS`, or a page: `page:/c-137/citadel`).
  - `talk` `who`, `use` `id`: as the galaxy's quests have them (`galaxy/surface/quests.js`).
  - `citadel` `id`: a step of `citadel/story.js`'s `QUESTS` is done (`daycare` … `citadelout`).
  - `all` `steps`: every one of its steps, in any order (the sector's four planets).
- **`story.js`**: `fresh()`; `feed(state, event) → { state, out }` where `out` lists `{ type: 'step' | 'episode' | 'unlock' | 'end', … }`; `current(state) → { episode, step } | null`; `objective(state) → { text, to? }` (`to` when the step is on another page); `coordinates(state) → Set` of the places the story has opened; `dialOpen(state, id)` (open if free roam is on, or the story has opened it, or it's bought); `catchUp(state, done)` feeds every id already in `tp-c137-done` and `tp-citadel-done`, so a visitor's past counts and the story starts where their play already reaches. Feeding an event twice changes nothing.
- **`useAdventure.js`**: the one hook the three Rick and Morty pages mount. It loads the save, catches up, and returns `{ objective, episode, feed, coordinates, dialOpen, freeRoam, setFreeRoam }`. A dev hook `window.__RMSTORY__` (`state`, `feed`, `jump(episode)`) for the checks, in DEV builds only, as `__C137__` is.

**The save** is one key, `tp-rm-story`, registered on `src/runtime/saves.js` at version 1: `{ episode, step, got: [], wins: [], freeRoam }` (`got`: the parts of an `all` step done; `wins`: the games won, so a win before its step still counts). The coordinates the story has opened are worked out from `episode`, never stored, so they can't disagree with it. When it's first made, a visitor is a returner if `tp-c137-done` or `tp-citadel-done` holds anything, and a returner starts with `freeRoam: true`. The keys the worlds keep stay as they are; the story only reads them. Nothing a visitor has done is lost.

**Who feeds it.** `RmWorld.jsx`'s `complete()` runs on every task already, so it feeds `{ type: 'task', id }`; its area change feeds `enter`; a hotspot used feeds `use` and a person talked to feeds `talk`; a game's win feeds `win`. The Citadel feeds `citadel` from where it records a step (`CitadelWorld.jsx`), and a planet's page from where it ticks one. `RmWorld.jsx` is 2,068 lines, over the 1,500 ceiling already: it gains a few lines that call the hook, and everything else goes in `adventure/` and the new files below.

### 2. The links: every place has a way in and a way home

- The dial (`destinations.js` `DIAL`, `DimensionDial.jsx`) gains **the Citadel** (the garage's portal opens `/c-137/citadel`) and the four sector planets the story visits. A planet's area is in C-137's world already (`scripts/c137-shots.mjs` shoots them there), so dialled from the garage it is a destination like any other, with the portal home to the garage; landed on from the map it stays `/c-137/<planet>` with its way back to space. Their rows go on the end of `DIAL`.
- The Citadel gets **a portal home** to the garage (`/c-137`, arriving at `GARAGE_BACK`). A planet's exit (`planetMode.js`) offers **Home to C-137** beside “Back to space”.
- When the current step is on another page, the objective line is a link to it (`objective().to`). When everything is done, the closing line links to the map.
- The dial's default, `portalTarget`, falls back to the first open place rather than Blips and Chitz when that is locked.

### 3. The dial lock

A new visitor's dial opens **Customs** only. The lock bites only as far as the story is built: `episodes.js` says how many episodes are ready (`READY`, a count from the first), and once a visitor has finished the last ready one, every place is open. Each phase raises `READY` by one, so the live site never leaves a visitor stuck behind an episode that isn't there yet. Each episode's `unlocks` opens the next episode's places and one or two places outside the story (the side places), so the whole dial is open by the end of episode 12 without Schmeckles. Before the shop lands, the story is the only way to open a place early; after it, a place still locked can be bought (section 6). A locked place shows on the dial, dimmed by colour (RULES, UI 6), with the episode that opens it and, once the shop is in, its price. Free roam (a switch in Things to do, beside the ship's voice: C-137's HUD has no kit Menu) opens every place and doesn't change the story. Pages are never locked: the Citadel's page and the map stay where they are; only the dial's entries wait.

`episodes.test.js` holds the lock to its promise: every dial place is opened by some episode, every step's place is open by the time that step is current, and a fresh save can finish the story.

| after | opens (story places · side places) |
| --- | --- |
| start | customs |
| 1 | annex (Blips and Chitz) · meeseeksgolf |
| 2 | agency (the sewer) · simulation |
| 3 | microverse, anatomy · storytrain |
| 4 | gromflomites · fortress |
| 5 | needful, vat · nimbus |
| 6 | jerryboree, gloopynoops · prison |
| 7 | cablestudio, schwifty · dream |
| 8 | fantasy, froopyland · dim35c |
| 9 | the Citadel · frundles |
| 10 | birdworld, gearworld, pluto, squanch (the dial's sector entries) |
| 11 | heistcon, vindicators |
| 12 | blooddome, evilrick |

### 4. The thirteen episodes

The premise, in the site's own words: a Galactic Federation raid on the garage wipes the coordinate chip in Rick's portal gun. Rick kept backups, scattered across the multiverse the way only Rick would scatter them. Each episode wins some back while the Federation closes in; it ends at Evil Rick's lair, with every coordinate home. The lines are the site's own; the show's short famous lines only where they're already used. ↑ marks a place made into a game in that episode (section 5).

| # | episode | steps |
| --- | --- | --- |
| 1 | Wiped | `task diner` (the agent at Shoney's says what the raid took) · `task basement` · `task mindblowers` (the backup chip is in the chair) · `task customs` (get out of Customs with the first coordinates) |
| 2 | Arcade money | `task roy` · `win cabinet` ↑ (beat a Blips and Chitz cabinet's target: Rick bet the next coordinates on it) |
| 3 | House guests | `task rickall` · `task wong` · `task sewer` |
| 4 | Small problems | `task microverse` ↑ · `task anatomy` ↑ |
| 5 | Heat | `win chase` ↑ (shake the Federation ship in the cruiser) · `task gromflomites` |
| 6 | Bad deals | `task needful` ↑ · `task vat` ↑ |
| 7 | The Jerry problem | `task jerryboree` ↑ · `task gloopynoops` ↑ |
| 8 | Prime time | `task cablestudio` ↑ · `task schwifty` ↑ |
| 9 | Fairy tales | `task fantasy` ↑ · `task froopyland` |
| 10 | The Citadel | `enter page:/c-137/citadel` · `citadel citadelout` (the Citadel's own chain, to the escape) |
| 11 | The sector | `all`: `task birdworld` ↑ · `task gearworld` ↑ · `task pluto` ↑ · `task squanch` |
| 12 | Big score | `task heistcon` ↑ · `task vindicators` |
| 13 | Evil Rick | `task blooddome` · `task evilrick` · `task evilmorty` · `use dial` (the gun back on Rick's bench, every coordinate home: `rules.js`'s `dial` hotspot) |

Every place in the story was reachable before the step that sends you there (table above). Gazorpazorp, on the galaxy's planet engine, belongs to `2026-10-08-rm-worlds-design.md`'s phases and is not a step here; it can join episode 11 once it has quests.

### 5. The dull places made into games

A place is made a game with the keys `place()` already takes (`escape`, `collect`, `hunt`, `duel`) where a mix of them is a real game, and with a new kind where it isn't. A new kind is a pure rule in `src/components/rickmorty/world/games/<kind>.js` with its test, taken by `place()` as one more key and drawn by the stage (`dimensions/stage.js`) with the models the place already stands. No new models (the owner's rule: never a figure or a prop drawn in code where a model can stand; these games add rules, not figures).

| place | the game | how |
| --- | --- | --- |
| Blips and Chitz, a walkway cabinet | a short arcade game behind the cabinet's screen, scored, with a target to beat | new `cabinet`: a DOM overlay as Roy is, on `world/arcade.js`'s made-up games |
| The Microverse | carry cells from Zeep's lab to the stompers before the world's charge runs down | new `power`: a collect under a draining meter |
| Anatomy Park | find the park map's pieces while the diseases hunt you, then reach the exit | `collect` + `hunt` + `escape` |
| The cruiser | shake the Federation ship: through rings over the neighbourhood, a hit meter, the ship on your tail | new `chase`, on `world/ship.js`'s patrol (it already tails the cruiser) |
| Needful Things | look the free things over and take only the ones with no curse on them | new `deal`: choose n of m, each with a hidden flag a look reveals |
| The vat of acid | play dead: hold still while the buyers look, move when they turn | new `freeze` |
| The Jerryboree | find your Jerry among the Jerrys by what only he'd do; a wrong pick costs time | new `find` |
| St. Gloopy Noops | get past the doctors to the theatre, take back what's Jerry's, get out | `hunt` + `collect` + `escape` |
| The cable studio | switch the channels' sets on in order before the studio goes live | new `sequence`: spots in order, against a clock |
| Get Schwifty | four lanes on the beat; the heads' meter must stay up to the end | new `rhythm`: a DOM overlay |
| Fantasy World | past the stairs that bite, up the beanstalk to the giants | new `climb`: solids with a `top` that Morty walks on, as the stoop is (`rules.js` `STOOP`) |
| Bird World | the crystals in the grass, some on the clay towers' tops | `climb` + `collect` |
| Gear World | wind the city's cogs in order while the gear police hunt | `sequence` + `hunt` |
| Pluto | tell the king what he wants to hear, and only the true parts | `deal` |

Every game has a goal, a way to fail with a quick retry, and a win that ticks the place's task as today. Failing puts Morty back at the place's way in, as `caught` does; nothing done is undone. The hotspots' lines stay as the place's colour. Each new kind takes `perks` (section 6) with everything at zero until the shop lands.

### 6. Schmeckles, the shop and the coordinates (last)

**The adapter.** `adventure/purse.js` is the only file that knows where money lives: `createPurse(backend) → { balance(), earn(deed), canBuy(item), buy(item), owns(id), on(fn) → off }`. A Rick and Morty page holds a purse and nothing else of the wallet's. Today's backend would be the site's wallet (`useEconomy`, side `rickmorty`), its deeds mapped onto the wallet's own earn keys so `economy.js` isn't edited. The HUD shows the balance as Schmeckles in Rick and Morty places.

**Waiting for the owner's currency.** This section is built last, as its own phase, and only once the owner's currency work is on `main`; until then the episodes go on without it. The phase starts by reading what landed and pointing `purse.js` at it; nothing else in this design changes with it.

**Earning** (`adventure/pay.js`, a table): an episode finished; a game won the first time, and a tenth of that for a win again (three a visit at most); a place's first visit; a planet's quest done. The amounts are set in P13 against the prices, so an episode's pay buys about one upgrade.

**The shop** has two counters, both where there's something already: **Rick's bench** in the garage (the gun's upgrades and coordinates) and **the Schmeckles Exchange** on the Citadel's concourse (its sign is in `citadel/concourse.js`): the outfits.

- **Gun upgrades**: `adventure/perks.js`, `perks(owned) → { hearts, stun, slow, laser }`, tested, read by the kinds and the existing games: `heart` (+1 heart in the duels, three tiers), `stun` (one shot a visit that holds a hunter still four seconds), `slow` (a fifth more on an escape's clock), `laser` (the sewer run's laser lasts longer).
- **Coordinates**: each dial place still locked has a price; bought, it opens. Free roam and returners never pay for a place.
- **Outfits**: tints of the wardrobe's looks (`rickmorty/wardrobe/`, `src/lib/three/dye.js`); no new models.

### 7. The HUD

From the kit in `src/runtime/hud/` only (RULES, “The worlds' HUDs”).

- **The objective line** reads the story's step first, then the checklist's next hint; a step on another page is a link.
- **The episode card**: on an episode's start, its number, title and intro line on glass, gone at the first move; its outro as a toast.
- **Things to do (M)** has two tabs, **Story** (the episodes, the current one's steps ticked) and **Checklist** (the 54, as today).
- **The dial** shows how many coordinates are home, the locked places dimmed by colour with the episode that opens them.
- **Things to do** gains the **Free roam** switch, beside the ship's voice.
- **The Citadel and the planets** show the same objective line and card through `useAdventure`.
- The Schmeckles chip comes with section 6.

### 8. The toys tick when they're played

Each toy ticks when it's been used, not when it opens: cable after three channels watched; the butter robot when the butter's passed; a Meeseeks when its task is done; the plumbus at the end of its line; Portal Panic after its first wave survived; the cruiser when its first `chase` is won (the `fly` task's hint says so). What's ticked already stays ticked.

## The phases

One pull request each, merged to `main` before the next starts.

- **P0, the foundation**: `adventure/` (`episodes.js` with all thirteen episodes as data, `story.js`, `useAdventure.js`), the save and the returners, the dial lock and Free roam, the links, the toys ticking when played, the HUD's parts, and episode 1 playable from the street to Customs and back. Its places all exist, so no kind is needed.
- **P1 to P12**: episodes 2 to 13, in order, each with its places made games (section 5), the kinds it needs first used, its lines, and its step in `scripts/rm-story-check.mjs`.
- **P13, Schmeckles** (section 6), once the owner's currency is on `main`.
- **The close**: the worlds' hand-off, `docs/architecture.md`'s Rick and Morty paragraph, the README's lines, the backlog; and the copy that disagrees with itself (the tour's “thirty-six destinations”, `tour/chapters/player.js`; the guide's twenty-six, `guide/abouts.js`) made right.

Done for an episode: played start to finish in the browser on a fresh save (the check below), every new rule tested, the shots of its places before and after, and the CLAUDE.md four green (`npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`).

## Testing

- **Rules first** (test-driven): `story.js` (feeding, `all`, catching up, feeding twice), `episodes.test.js` (the lock's promise above; every `task` id is in `TASKS`; every `citadel` id is in `QUESTS`; every `enter` area exists), each kind in `world/games/`, `perks.js`, `purse.js` against a fake backend, the save's returner rule.
- **The browser**: `scripts/rm-story-check.mjs`, on the dev server as `scripts/c137-shots.mjs` is: a fresh save, then each landed episode played through `window.__C137__` (`goto`, `act`, `complete`) and `window.__RMSTORY__`, failing on a step that doesn't advance or a dial place opened out of turn. Shots of each new game through `scripts/c137-shots.mjs`, before and after.
- **Nothing loosened**: the existing tests stay as they are; a test that pinned a toy ticking on open is changed to pin it ticking on play, with a sentence in the commit.

## The owner's rules this keeps

From `HANDOFF-worlds.md`: no figure or prop drawn in code where a model can stand, and no new models here; NPCs do things; Coach Feratu is never drawn and Gwendolyn is left out; the people's lines are the site's own; the map's fandoms don't move; the planets on the engine aren't touched. From the standing rules: pure rules first; nothing a visitor has done is lost (the returners, the catch-up); new rows go on the end of their lists; no model names in code, docs or commits. From `docs/health/RULES.md`: files under 800 lines (the new ones), `RmWorld.jsx` not grown beyond its few calls, HUDs from the kit, tests beside their files.

## Not in this design

Gazorpazorp's quests and mission (the rm-worlds plan); the map's moons on its mini-map, the NX-5 online and the sector's other open items (`HANDOFF-worlds.md`); the `gazorp` achievement that nothing unlocks since Gazorpazorp moved to the engine; voice clips for the new lines (keys can go in `world/voicelines.js` for the desktop's voices job later). Anything in draft PR #1028's files.
