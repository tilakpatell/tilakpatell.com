# The Red Book: Middle-earth’s front door

Dated 2026-10-19. The owner’s brief, in order: “I want a LOTR page/world besides just games … a nice page and stuff similar to Rick and Morty and it should be really nice and interactive and 3d and stuff than a typical scroll page.” “I want it different than Rick and Morty, even better, and the best imo out of everything.” It is for two people at once: the recruiter or friend who gives it ten seconds, and the visitor who stays. Direction: “Red Book and Palantír and the Ring: figure out a way to do all, or choose one main thing and incorporate the others.” Then: “Yes, build it and don’t ask any questions.” The owner approved section 1 (below). The review gates after it were waived, so the calls in sections 2 to 9 are this session’s, written down here so the next session can see them.

## 1. The experience (approved)

You arrive in Bag End’s study at night: candlelight, the fire, rain on the round window. Three things lie on the desk.

- **The Red Book is the story.** It opens itself as you arrive, and the Shire grows out of the page as a 3D pop-up: that is the first ten seconds. Turning pages walks you through the tale, from Bag End to the Havens. Each page is a scene with three to five things to touch or hear. Every page offers **Play it** (that place’s chapter game) and **Walk it** (the Road from that stage).
- **The Palantír is everywhere at once.** Pick up the seeing-stone and the map swirls up inside it. Turn it to look at any place and go there: the book opens at that page, or the game starts. It replaces today’s map menu as the way to jump around. But the stone looks both ways: linger too long and the Eye looks back.
- **The One Ring is the hidden side.** Put it on and the study drains into the wraith-world. Secret things show only then: moon-letters in the book’s margins, ghosts in the scenes, hidden things to find. The longer you wear it, the closer the Eye comes. Wear it too long and a Nazgûl’s scream tears it off you.
- **Across all three.** Characters you meet go into the book’s back pages with their voices. Things you find are kept (the site’s achievements). The games, the Road and the map all open from here. On a phone the book fills the screen held upright, with the Ring and the stone in the corners.

## 2. Where it lives

| address | what | before |
| --- | --- | --- |
| `/middle-earth` | the study and the Red Book (`src/pages/RedBook.jsx`) | the map hub |
| `/middle-earth?page=bree` | the book opened at a page | — |
| `/middle-earth/map` | the map hub (`MiddleEarth.jsx` with no place), as it was | `/middle-earth` |
| `/middle-earth/<chapter>` | each chapter’s game, unchanged | same |
| `/middle-earth/road` | the Road, unchanged | same |

The chapters’ “The map” buttons go to `/middle-earth/map`. Each chapter’s “where next” card gains **The Red Book**. A bare `/middle-earth/<unknown>` falls back to the study, not the map. Every deep link keeps working. The study is a world of its own (`src/components/middleearth/redbook/module.js`, `shading: 'nodes'`), and the map hub keeps its GLSL module. They are different pages, so each mounts its own world through `useWorld`, and the runtime hands one over to the other.

## 3. The calls made

1. **The pages are pop-ups of painted card, not the chapters’ game scenes.** The builders’ GLSL-free commit (76f0dbd22, the Road’s R3 lane) wasn’t on any pushed branch when this was built. Those builders also make whole towns: Bree alone is hundreds of draws. A page that turns in half a second while three more wait can’t carry that. So each page is cut card and folded paper, painted in code in the ink and watercolour of Tolkien’s own drawings for *The Hobbit*. Real depth comes from the folds. Its pieces are planes and simple solids, each painted on a canvas (`lib/paint`). Once the builders land, a page *may* stand one landmark from its chapter on the card (a `piece` of kind `builder`). Nothing in this design waits on that.
2. **One page a place, fifteen in all,** and two back pages (§4). The Road’s sixteen stages fold into fifteen: Ithilien goes into the Marshes’ page.
3. **The book draws only what is open:** the spread on show, plus the page in the air while it turns. The pop-ups of other pages are built when they are first needed, kept, and disposed with the world.
4. **The wraith-world is the Road’s pattern** (`road/hooks.js`): one uniform, `uVision`, drains every lit material toward a cold grey through `hookNodes.onColor`, so it reads on every tier. A CSS vignette over the canvas (on glass, no blur) stands in for the Road’s grade pass. That costs no pass at all. The code is copied, not imported (the Road’s files are another session’s).
5. **No new dependency, no new model.** The figures are paper cut-outs. The only downloads are the voices and film clips, fetched on a press.
6. **Keys:** ← → turn the pages, R the Ring, P the Palantír, Esc the Menu (or puts down the stone), Enter in the stone goes. Touch: tap a page’s edge to turn it, or swipe. The Ring and the stone are corner buttons.

## 4. The pages

Each row lists the page’s id, its title (the caption’s heading), its date (the Road’s, from the Tale of Years), what to touch, what the Ring shows (one ghost each, a thing to find), **Play it** (the chapter) and **Walk it** (the Road’s stage). The data is `redbook/pages.js`, tested against `chapters.js` and the Road’s `STAGES`.

| id | title | toys (3–5) | under the Ring | play | walk |
| --- | --- | --- | --- | --- | --- |
| bag-end | An unexpected party | Gandalf’s dragon firework; the party tree’s lanterns; Bilbo’s round door (knock); Gandalf | Bilbo’s ring glinting in the envelope | shire | hobbiton |
| shire-edge | Get off the road | the Black Rider (it sniffs); the roots to hide under; Farmer Maggot’s mushrooms | the Rider as he is, a pale king | shire | shire-edge |
| bree | The Prancing Pony | Butterbur’s bell; the swinging sign; the rain; Strider in the corner | the Ring’s eye in a pint | bree | bree |
| weathertop | Amon Sûl | the fire (light it); five Nazgûl on the summit; Sam’s pans | the five as wraiths, swords drawn | weathertop | weathertop |
| ford | The Ford of Bruinen | the river (call the flood: white horses); Arwen’s horse; the Riders | the Elf-lord in his light | weathertop | ford |
| rivendell | The house of Elrond | Narsil’s shards; the Council’s chairs; Bilbo’s book | the Ring on the plinth, burning | rivendell | rivendell |
| caradhras | The Redhorn Gate | the crebain (they flock); the snow; Gimli | a voice in the wind | — | caradhras |
| moria | Speak, friend | the moon (lights the ithildin); the word (say mellon); the Watcher’s pool; the drum | Durin’s crown on the doors | moria | moria |
| lorien | The Mirror | the basin (look in); the mallorn’s lamps; Galadriel | the Eye in the water | lorien | lorien |
| anduin | The Argonath | the kings (their hands rise); the boats; the falls | Isildur’s ghost | amon-hen | anduin |
| marshes | The Dead Marshes | the candles; Sméagol; the stepping tussocks | faces under the water | dead-marshes | marshes |
| cirith-ungol | The stair | the phial (light it); the web; the tower’s eye | Shelob’s eyes | cirith-ungol | cirith-ungol |
| beacons | The beacons are lit | the beacons (they light along the peaks); Minas Tirith | the dead of Dunharrow | minas-tirith | minas-tirith |
| doom | Mount Doom | the Cracks (the Ring goes in, as it’s won); the Eye; Sam | the Ring on the brink | mordor | gorgoroth |
| havens | The Grey Havens | the white ship (it sails); the gulls; the lamp | the Straight Road west | — | havens |

The back pages are **Those you met** (each character as a portrait, with their line said again on a press: `sayVoiced`, or a clip where the films said it) and **Things kept** (the Ring’s finds, the toys found, the achievements Middle-earth gives). A character is met by touching them. The book keeps that, and the finds, through `rt.saves` (`keep.js`).

A toy’s line is the site’s own words. Film lines come only through the clips: Gandalf’s `wizardLate` at the firework, `secondBreakfast` at the Shire’s edge, `andMyAxe` at Caradhras, `youShallNotPass` at the drum, `kingsArrival` at the beacons, `nazgul` at the scream.

## 5. The three objects

**The book** (`book.js`, pure: the turning). State `{ page, turning: null | { from, to, t } }`. A turn takes 0.9 s, or 0 under reduced motion. The leaf curls as it lifts: the curl is the page plane’s vertices, set on the CPU during the turn only, 24 × 6 segments. A pop-up’s pieces rise with the spread’s opening angle (`popup.js`, pure: `rise(open, at)`, each piece lifting through its own share of the opening, the far ones last). Arrival: the closed book, 1.2 s of rest, the cover swings, the first spread opens and Bag End grows (about 3 s, or opened at once under reduced motion).

**The Palantír** (`stone.js`, pure). Tap it, or press P, and the camera leans in. The stone fills the view, and the map (`paintMap`, the same sheet as the hub’s) swirls up inside it as a disc under dark glass. Dragging turns it. The place nearest the centre is the one looked at, and its name shows on glass. Tap or Enter goes: to the book’s page for a place with one, to its chapter or the Road for one without. **The whole map** opens `/middle-earth/map`. Linger: `gaze` grows while the stone is held (it rests while you drag). After 25 s held still the Eye opens inside the stone. At 30 s the stone is dropped with a toast (“The Eye has seen you.”), the dread jumps, and an achievement (`palantir`) is won once.

**The Ring** (`ring.js`, pure). `{ worn, vision, dread, torn, cooldown }`. On: `vision` ramps up at 2.5 a second and `dread` climbs at 1/40 a second. Off: `vision` falls at 2.5 a second and `dread` at 1/20. At `dread` 1 the Ring is torn off: the scream (`nazgul` clip), a cooldown of 8 s before it can go on again, and the achievement `wraithworld`. Under the Ring the ghosts show (their opacity is `vision`), the margins’ moon-letters show (a second canvas layer on the page, its opacity `vision`), and the Eye in the window grows with `dread`. A find is collected only while `vision` > 0.5. All fifteen finds win `redbook`.

## 6. The study

A room built in code. The desk is an oak box with a wood-grain canvas. The round window has rain: about 300 streaks on one instanced quad, drawn on high only. The fireplace’s fire is three additive flame cards and a flickering point light. Two candles, each with a flame card and a light (one light on low). The rest: a shelf of books, the map pinned on the wall (`paintMap` at 1024), Bilbo’s pipe, and Sting on the wall. The camera rests over the book, leaning into it. A drag looks about the desk a little, then settles back (the Road’s settle).

## 7. Performance

Measured in the container’s software Chromium (`renderer.info`), on the arrival spread and the busiest one (bag-end, beacons), desktop and phone:

| | target | why |
| --- | --- | --- |
| draws | ≤ 140 (high), ≤ 90 (low) | the study ~45, a spread ≤ 40, the turning leaf’s next spread ≤ 40, the stone and the ring ~10 |
| triangles | ≤ 150 k | card is flat; the solids are low-segment |
| boot download | ≤ 1 MB beyond the page’s JS | nothing fetched but the Cinzel font the site already has; voices and clips on a press |
| page JS | ≤ 120 KB gzip for the study’s own chunk | measured by the build’s sizes |
| textures | ≤ 40 MB of canvases on high, half on low | each piece’s canvas sized to its size on screen at 1440 wide, 512 at most (1024 for the page’s text and the wall map) |

**What each tier sheds** (`lib/device`’s `budget()` and the runtime governor’s `lowerQuality`): *ultra/high* everything; *mid* the rain and the bloom; *low* one candle light instead of two, the fire’s light only when the fire is in view, canvases at half size, pixel ratio 1. Phones start at mid. Reduced motion: no arrival animation, turns cut, the stone doesn’t swirl, and the rain is still.

## 8. The page around it

- The world fills the window under the site’s nav (`WorldHost`). The HUD is the kit’s (`src/runtime/hud`): the brand top left (“The Red Book · Bree”), the Menu top right (Those you met, Things kept, The whole map, The Road, Start the book again, the way out), and the foot. On glass in the foot: the page’s caption (title, date, two or three sentences), **Back** and **Turn the page**, **Play it** and **Walk it**. The corner buttons are the Ring and the Palantír (44 px or more, labelled).
- On a phone (portrait) the camera frames the book upright, filling the screen. The caption is a collapsed glass strip that a tap opens, and the Ring and the stone sit in the bottom corners as `TouchButton`s.
- Copy: British spelling, curly quotes, sentence case, no exclamation marks, the key first in a prompt (“P Look into the Palantír”).
- Toasts: one at a time, top centre (“Met: Gandalf.” “Found: the Rider’s crown.” “The Eye has seen you.”).

## 9. Tests and checks

- Pure, with tests beside them: `pages.js` (fifteen pages; ids unique; each `play` a chapter in `CHAPTERS`, each `walk` a Road stage; 3–5 toys a page; one find each), `book.js` (turning, bounds, reduced motion, `pageFromAddress`), `popup.js` (rise is 0 shut and 1 open, monotonic, staggered), `ring.js` (ramps, dread, the tear, cooldown), `stone.js` (pick nearest, gaze, the Eye, dropping), `keep.js` (met and found merged, saved shape, versioned), `routes.js` (where a pick goes).
- `module.test.js`: the module contract, `mb` equal to `WORLD_MB['/middle-earth']`, a world made on a fake runtime that turns, wears the ring and disposes. `shading.test.js` reads it as a `nodes` module and fails it on any GLSL.
- Screenshots (Playwright, `lab/redbook/shots.mjs`) at 1440 × 900 and 390 × 844: the arrival, a mid-book spread, the Ring on, the stone up. Each is looked at before anything is claimed.
- Before a push: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## 10. Left for later

- A page’s landmark from its chapter’s builder, once 76f0dbd22 is on main.
- The Road’s `?at=` resuming from a page’s Walk it at the page’s own metres.
- Voiced lines for the toys that have no recording (`desktop-jobs`).
