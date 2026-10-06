# Handoff: the universe map

Branch `claude/elegant-lovelace-o6lpb0` (it carries `claude/universe` and `main`). The spec and plan are in `docs/superpowers/specs/2026-10-04-universe-map-design.md` and `docs/superpowers/plans/2026-10-04-universe-map.md`. Things have grown past them since; this note is the current state.

## What's there

- **`/universe/:id?`**: the whole site as a universe. The intro crawl now jumps to lightspeed into it. Nav, ⌘K, the guide and every world page's switcher link to it.
- **The places**, all in `universes.js`, in map order:
  - Six stations round a sun (`kind: 'core'`): Home, Experience, Projects, Résumé, Contact and Terminal. Each has a big sign (`sign`) that faces you; a click on a sign opens its page. Each has a card in the panel (`stationCards.jsx`).
  - Ten fandom planets further out. Their cards come from `interests/cards.jsx`.
- **The textures** are real planetary maps and CC0 materials, built by `scripts/build-universe-textures.py` into `public/textures/universe/`:
  - Solar System Scope maps (CC BY 4.0), credited in the panel, recoloured per world.
  - Metal and paper from ambientCG.
  - Phones and weak devices get the `-sm` copies; a strong graphics card (lib/detail's `ultra`) gets the `-hq` set, twice the texels (2048 planets, a 4096 Earth, an 8192 sky), built with `--hq` from Solar System Scope's 8K originals; `planets.js`'s `mapFile` (tested) picks the file, and falls back to the standard one where an `-hq` is missing.
- **Ships**: Rick and Morty's cruiser (Portal panic's model, nose −x), Luke's X-wing and the Falcon, both built in `shipModels.js`.
  - `ship.js` is the pure physics and autopilot, tested.
  - `crews.js` is each crew's lines for every place, tested.
  - `Comms.jsx` and `sounds.js` handle the voices, the engine and the arrival sound bites (from `lib/clips.js`).
- **Without a ship** the camera flies between places. Picking a place turns the map so it swings to the front.

## Open

- A Millennium Falcon model is in the owner's Downloads; once it's in the repo (and its licence known), swap it in for the one built in `shipModels.js`.
- `claude/sleepy-bardeen-fem3jp` has a crewed cruiser (`rickmorty/cruiser3d.js`, Rick and Morty in the seats). Once it's on main, the universe's cruiser could reuse it.
- New voice clips (Rick, Morty, Han, Chewie) would slot in through `lib/clips.js` and `sounds.js`.

## Gotchas

- `vitest --root /` hangs; put any throwaway test inside `src/`.
- Headless Chromium draws in software here at about 5 fps, so flights look slow in tests. The physics steps are capped at 50 ms.
- Wikimedia rate-limits; the texture build caches its downloads in `node_modules/.cache/universe`.
