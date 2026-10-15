# Ship contact: big ships are solids, small ships are bodies

Date: 2026-10-09. The long version: `docs/superpowers/specs/2026-10-09-ship-contact-design.md`; where it was left: `docs/superpowers/HANDOFF-galaxy.md`.

## Context

The owner's ask: “if we hit a ship, it does stuff like collisions”. On the universe map and in the galaxy your ship already bumped or crashed on planets, stars, wonders and the galaxy's battle hulls (`ship.js`'s `step` against solids) and was hurt by rocks (`rockHits.js`), but flew straight through every other ship: the hunters, the traffic, wingmen, someone else's skirmish, the characters, the other pilots online and their hunters, the fleet war's fighters, the director's capital ship, the sector fleet, the Interdictor.

Two kinds of thing had to be told apart: a fighter or a freighter, which you can knock about and bring down, and a Star Destroyer, which you can only fly into. And a third party was in some of them: another pilot, whose browser is the one that says what happened to their ship.

## Decision

A ship too big to move is a **solid**: each system with one answers `solids` (`[{ id, at, r, reach, ship: true }]`), and the scene hands them to `step` with the map's, so the planet's rule plays against it unchanged (a bump under `SHIP.crash`, a crash over it). Every other ship is a **body** for one pure law (`src/lib/combat/contact.js`) and one collector (`universe/shipHits.js`): a glance under `CONTACT.soft` closing speed, a ram from it, the ram's hit on the other ship taken through the same path a shot's takes. **Only your ship moves**: the other flies on as its own rules say. A ram on another pilot **tells nobody**: it comes off your shields only.

## Consequences

- One rule for “too big to move”: the galaxy's battle hulls already worked this way, and the capital, the sector fleet, the big traffic and the Interdictor now do too. A crash into one is the planet's crash, said with `kind: 'ship'` (the crew's plain crash line), and you come back out from where its middle was.
- What a kill does is written once per scene: a ram's `down` goes through the scene's own kill path (`hunterShot`, `pilotShot`, `trafficShot` in the universe; `scored` and `pilotShot` in the galaxy), so it pays, counts, is said and draws the law exactly as a shot's kill does.
- No knock-back on the other ship: a hunter, a traffic ship or a pilot is not pushed off its line by a ram. Hunters have `pull` and `breakOff` for the powers; a later change may knock them with it.
- No network ram: the protocol believes a hit only from a pilot who fired a shot that passed near (`online/protocol.js`'s `aimedAt`); a `ram` wire action is a protocol change.
- Every number is in `CONTACT`; the scenes read it, never copy it.

## Revisit when

- Ramming another pilot should hurt them: that needs a `ram` action the receiving browser can check, and is a new entry.
- A ship in the traffic or a fleet grows a hull long enough that one sphere misfits it badly (the sector fleet's one sphere is `size × 0.16`): then a chain of spheres, as the capital's hull is.

Either goes in as a new entry that links this one, not as an edit of it.
