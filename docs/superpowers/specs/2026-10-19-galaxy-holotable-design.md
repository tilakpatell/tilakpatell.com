# The galaxy map as a holotable

2026-10-19. The owner: “This map is so ugly with cluttered and stuff. Look how Helldivers does it and make it 3d … maybe make it full screen.”

## What Helldivers 2 does

Its Galactic War screen (the wiki’s screenshot, and its monthly Galactic Frontier images) is one idea held hard. The galaxy is a disc of rings, each ring cut into sectors with stepped edges, every sector one flat colour: the enemy’s in its colour with diagonal hatching, Super Earth’s dark. Thin white borders, Super Earth’s emblem at the middle, and each faction’s name in huge letters curved along the rim of its side. At that zoom there are no planet names at all. Zoomed into a sector, the plane tilts in perspective over a starfield: the sector’s glowing outline, planets as small spheres, a white ring on the one picked, thin supply lines. The rest of the screen is the title and the war’s numbers top left, the Major Order down the right, the actions along the bottom, and a card over whatever the pointer is on.

## The Star Wars holotable

The galaxy already has rings: the Core Worlds, the Colonies, the Inner Rim, the Expansion Region, the Mid Rim, the Outer Rim Territories and Wild Space past them (`systems.js` `REGIONS`, bulged as `edgeAt` has it), with the Unknown Regions west. So:

- **Sectors** (`holo/sectors.js`, pure, tested): each ring cut into wedges (more of them further out), each ring’s wedges turned a little from the last so the edges step as Helldivers’ do. A sector is held by the side holding the systems in it, else by the nearest system of the war’s within reach, else nobody (dark). A sector with a front, an attack or a battle in it is contested. The sides’ names go along the rim over the longest run of the outer sectors each holds.
- **The scene** (`holo/holoScene.js`): one `THREE.Scene` and camera of its own, drawn by the galaxy world in place of the flight while the map is open (the universe post chain’s `view(scene, camera)`: the bloom and the grade still apply, nothing else renders). In it: the disc’s stars on the 2D map’s two arms (the same formula as `paintGalaxy`), the core’s glow, the sectors as one mesh (a side’s colour clouded where its systems are, as Helldivers’ fills are, finely hatched in world space where it only reaches, faint where it’s yours, as Super Earth’s are dark, the contested ones beating), their borders as thin lines, the rings brighter, the hyperlanes faint on the plane, each system a bright bead on a short pin from the plane (its height, `liftOf`), the attacks as arcs over the disc, the region and the sides’ names lying on the plane.
- **The camera** (`holo/holoCamera.js`, pure, tested): a pose of yaw, pitch, distance and a point on the plane; a drag slides the plane, a right drag (or one with Shift) turns it, a wheel or a pinch zooms about the pointer, a pick flies to the system; eased. (It tipped and tilted till the third pass, below, made the map flat.) The whole disc is the closest pose that has every point of its bulged edge on the free part of the screen, found numerically (in perspective the near side looms). `lensOf` shifts the lens (`setViewOffset`) so the disc’s middle is the middle of what the panels leave: below the header’s row and left of the side panel on a desktop; between the header’s row (with the board and the zoom) and the bottom sheet on a phone.
- **The link** (`holo/link.js`, tested): what the page and the scene share while the map is open, so neither reaches into the other: whether it’s open, what the map shows (the war, where you are, the pick, the era’s lit systems, the layers), the camera’s pose and where it’s going, the label elements, and each system’s place on the screen as last drawn (for the labels, the hover and the pick).
- **The stage** (`HoloStage.jsx`): the full-screen layer the hands work on, one label button a system (positioned by the scene each frame, named only where labelPlace.js finds room), the hover card. The zoom buttons are the map’s own (`HoloMap.jsx`), in its corner as on the 2D map. The page’s controls over the stage are the placer’s `blocks`: no name goes under one, and a dot under one goes unnamed.
- **Full screen**: in 3D the map is the whole window; the header, the war’s board, the key and the layers, and the side panel float over it on glass at 0.78 or more, none blurred (`docs/health/RULES.md`); nothing else of the page shows (the flight’s HUD, radar and sky names are hidden, the world’s canvas alone made visible).

The 2D map stays, whole, for a device without the galaxy’s 3D (no link, or the world not up) and for anyone who picks it (the Layers panel’s 3D map switch, kept in this browser as `tp-galaxy-map-view`). `scripts/galaxy-map-check.mjs` runs the flat map’s checks as before (its `open()` asks for the flat map) and the holotable’s in `galaxy-map-check/holo.mjs`: the stage the whole window, the names apart and clear of every control, + and 0, a press picking, the switch to the flat map and back.

## Sectors first (the second pass)

The owner, on the first pass: “The 3D map is messed up also you should only see planets and stuff when you click on a sector and it expands. Also make it properly fit on the page and able to move and turn”; and “Get rid of the hyperlanes it looks bad”. So, as Helldivers 2 has it:

- **The whole galaxy is its sectors.** No system, name, pin or arc on it, only the sectors in their holders’ colours, their borders, the regions’ and the sides’ names, and where you are: a pulse, its YOU tag and its sector’s edge. The hyperlanes are gone from the 3D map at every level (the flat map keeps them, a layer).
- **A sector opens.** A press on a sector with systems in it (26 of the 97) flies the camera to it, fitted to the free part of the screen, seen straight down as the whole galaxy is (`holoCamera.js`’s `fitTo`; it leant away at 48° at first, which the third pass took out). The sector brightens and is edged, the rest dim to a third, and its systems come in: beads, pins, their holders’ rings, the war’s arcs that touch them, and every one named. The pointer over another sector edges it and shows its card: its name, its ring, who holds it and how many systems are in it.
  - **Names:** `sectors.js`’s `sectorName`: the canon sector most of its systems are in (`systems.js`’s `sector`: Arkanis for Tatooine’s, Anoat for Hoth’s), else its ring and the grid square of its middle.
  - **The crumb**, under the header in the free part’s middle, says where the map is: on the galaxy, how to open a sector; in one, its name, ring, holder and count, and the way back (“The galaxy”). Escape goes back too, before it shuts the map; the find, the side panel and the war card’s picks open the picked system’s sector.
- **Move and turn.** A drag slides the plane; a right drag, or one with Shift or Ctrl, turns it (and tipped it, till the third pass made the map flat); two fingers pinch to zoom, twist to turn and slide together to move it; the turn buttons (beside the zoom on a wide map, in the bottom corner on a phone’s) and Q and E turn it 22.5°.
- **Fit.** The disc, and a sector opened, fill the part of the screen the panels leave. On a phone and a tablet held upright the side panel is a sheet along the foot, folded to its first lines (“You are here · Tatooine”) till it’s opened or a system’s picked, so the map has the window’s width and most of its height.

## Sharp, flat and lit (the third pass)

2026-10-20. The owner: “The 3d map … is blurry angled wrong and just terrible. Fix it and make it much much better.” What was wrong, seen in the browser:

- **Blurry.** The map is drawn through the flight’s post chain, so it took the flight’s softened sharpness (the pace’s steps, down to 0.6 of a pixel), its boost’s rush, a hit’s red edge and its flare, all left standing from the flight’s last frame. The sectors’ clouded fill read as smudges, the core’s glow was a haze over the inner rings, the borders were one-pixel GL lines, and the stars piled into a white blot at the core.
- **Angled wrong.** The whole galaxy was seen at 64°: the near side loomed a third bigger than the far, and the names along the east and west lay on their sides. Seen at 79°, with a sector opening at 57°, the owner said again: “Make it 2d flat I dont like how its angled as it just makes it worse.”

So (`holo/drive.js`, `holoScene.js`, `holoCamera.js`, `holoText.js`, `holoMarks.js`):

- The map draws at the renderer’s whole sharpness, the flight’s put back after it, and with none of the flight’s moment (`drive.test.js`).
- The map is flat: seen straight down at every distance, a sector opened too, round, its near side drawn the size of its far (`holoCamera.test.js`). The hands turn it round (a right drag, two fingers twisting, Q and E) and never tip it. The systems sit on the plane, with no pin, and are drawn no bigger than a flat map’s dot zoomed in (`holoMarks.js`’s `fit`), so a name beside one starts clear of it.
- The sectors are tiles: a flat fill brighter in toward its edge, hatched where held only in reach, their borders drawn in the fill’s own shader a pixel wide at every zoom (a ring’s bolder than a cut), nobody’s a faint blue with its borders alone, the open one swept by the projector’s light. A ticked bezel rings the rim.
- The galaxy under them: a small hot core and its bulge, the two arms’ faint glow, the disc’s stars as sharp points over the tiles (fewer and dimmer at the core, none past the rim), and a far field under the table.
- The regions’ names in a column down the south, the right way up; the Unknown Regions’ straight across their dark; every name over a dark edge of its own, drawn at 128 px and filtered as steeply as the card allows. The systems are small lit globes.

## Not in this pass

Fleets moving along the arcs, a sector’s planets as spheres of their own, the war’s numbers (kills, pilots) in the title block, a keyboard way through the sectors (the find opens any system’s).
