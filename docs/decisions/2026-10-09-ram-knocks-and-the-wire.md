# A ram knocks the other ship, and another pilot is told

Date: 2026-10-09. Follows [Ship contact: big ships are solids, small ships are bodies](2026-10-09-ship-contact.md), which left both out. Where it was left: `docs/superpowers/HANDOFF-ship-contact.md`.

## Context

Ship contact shipped with only your ship moving: a rammed hunter flew straight on, and a ram on another pilot came off your own shields and nobody else's. The protocol believed a hit only after a shot that passed near (`online/protocol.js`'s `aimedAt`), so a ram couldn't be sent as a hit. Two more gaps came with it: the autopilot steered round the map's own solids only, so it could fly you into a capital that had dropped in across your way; and a kill by ramming was said as a gun's ("Great shot, kid").

## Decision

**The other ship is knocked off its line** where its system flies it by a velocity: the law gains `shove(into, size)` (half the closing speed, less for a ship longer than 0.5, at most 6) and `knock(o, dv)`, and a body may answer `push(dv)`. The hunters (universe, galaxy, a skirmish's) and the wingmen do. Their rules turn the nose back at its own rate, so the knock reads, then mends.

**A ram on another pilot is a `ram { v }` wire action**, to them alone. Their browser decides how hard it was. It believes the ram only from a pilot who isn't blocked or an ally, was last seen within touching distance (1.5, and 0.35 s of both your speeds for the pose's age), and hasn't rammed in the last `CONTACT.cool`. It caps the closing speed at both speeds together and runs the contact law itself (`contact(into, pilots.js's SIZE)`). A pilot rammed out of the sky is the rammer's kill, as a shot's is.

**The autopilot takes the moving big ships** (`autopilot(…, moving)`) and steers round them as it does the planets. A stop one has come down on is moved clear of it (`clearPark`).

## Consequences

- Traffic, the battle's fighters and the characters aren't knocked: they fly on lanes or in the battle's own step, which a velocity added once doesn't move.
- A third pilot watching doesn't credit a ram kill: they don't see the `ram` message. They credit only a pilot who has just fired, as before.
- The ram's closing speed is the rammer's word, capped by what both poses allow. A cheat can claim the cap, but no more than two ships at those speeds could do.
- A kill by ramming, and a pack cleared by one, have their own crew lines (`crews.js`'s `ram`). They have no recordings yet, so they play as blips until the voices batch makes them.

## Revisit when

- Traffic or the battle's fighters should be knocked too: each needs an offset its own step carries.
- Rams between pilots get abused: then the receiver's own sweep of the rammer's poses should decide, not the rammer's word.
