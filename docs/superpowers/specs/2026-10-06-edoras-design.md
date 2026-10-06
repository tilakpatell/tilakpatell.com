# Edoras (design)

## Intent

A third hidden chapter, beside Orthanc and Minas Tirith: **Gimli at Edoras**, at `#/middle-earth/edoras`. The court of Rohan, from the doors of the Golden Hall to the morning the Rohirrim rode for Gondor (The Two Towers and The Return of the King, as the films showed them).

## Finding it

- Click (or tap) the golden hall on its hill on the map's diorama; on the flat map, its name. It's in ⌘K too.
- Finding it wins `edoras`; the end wins `rohanwillanswer`; a dozen tankards before you go under wins `drinkinggame` (on the side).

## What you do

1. **Weapons at the door** (`weapons`). Walk in from the barrows, through the gate and up the road and the great stair to the doors of Meduseld. Háma keeps the door: hand over the axe (or try not to).
2. **Théoden King** (`king`). Gandalf breaks Saruman's hold on the king while Wormtongue's men come out of the shadows at him: walk among them and knock them down (E/Space). One who reaches Gandalf sets his work back.
3. **Simbelmynë** (`flowers`). Théodred is laid in his barrow by the road. Gather the white flowers from seven barrows of his fathers, and lay them at the foot of his.
4. **The drinking game** (`feast`). At the feast, Legolas reckons an Elf can drink any Dwarf under the table: drink when the tankard comes to your lips; the more you drink, the faster and wobblier it swings and the narrower the moment. You go under in the end (around a dozen); the best is kept.
5. **The beacons are lit** (`beacon`). At night on the terrace, look along the White Mountains (A/D) and say when you see the fire (E). Aragorn runs in; the king answers.
6. **Rohan will answer** (`muster`). Dawn: ride out with the host of Rohan (hold W). Seal `rohanwillanswer`.

## The place

- **The hill** (`hill`, `terrace`, `muster`): the oval mound in the plain (`HILL`, `hillHeight`), the stockade and its gate, the road and the great stair, the terrace, Meduseld outside, the thatched halls (`HOUSES`, seeded), the barrows with simbelmynë outside the gate (`BARROWS`, `FLOWERS`, `GRAVE`), the White Mountains to the south and the beacon peaks east (`PEAKS`).
- **Meduseld** inside (`hall`), drawn apart: the carved pillars, the long hearth, the dais and throne, the tables for the feast.

## The games, as rules (`rules.js`, tested)

- `newBrawl`, `stepBrawl`, `bash`: Théoden King.
- `newDrink`, `stepDrink`, `drink`: the drinking game.
- `newWatch`, `stepWatch`, `spot`: the beacon.

## How it fits

- **`towns/edoras/`:** `layout.js`, `story.js`, `rules.js` and their tests; `props.js` (the town, the hall, the barrows, the peaks), `folk.js` (Gimli and the court of Rohan, the horses and the host), `sounds.js`; `scene.js`, `EdorasWorld.jsx`, `edoras.css`.
- **Wiring:** `middleearth/hidden.js` (a third entry), `mapDiorama.js` (Edoras clickable), `MiddleEarth.jsx`, `record.js` (`HIDDEN_SEALS`), `Achievements.jsx`, `CommandPalette.jsx`.
- **Storage:** `tp-edoras-done`, `tp-edoras-at`, `tp-edoras-side` (the drinking game's best); dev hook `window.__EDORAS__`.
- **Online:** other travellers show on the hill as pale Gimlis.
