# One deploy flow, the game’s, on the galaxy’s eight assaults

Date: 2026-10-11. The long version: `docs/superpowers/specs/2026-10-11-galactic-assault-bf2017-flow-design.md`.

## Context

The owner asked that Galactic Assault deploy as Star Wars Battlefront II (2017) does: pick the mode, spawn as one of the four classes, heroes only once Battle Points afford them. Two assaults existed: the galaxy’s, on eight of the site’s worlds, which put you on the field as the Loadout’s hero for free; and the Battlefront world’s, on the game’s own Hoth level, which already deploys the game’s way but is linked from nowhere.

## Decision

The galaxy’s assault takes the game’s deploy flow (classes, enforcers and heroes at the record’s prices, Battle Points earned in the battle, a bought hero worn for one life) on all eight worlds; the Battlefront world stays as it is and Hoth’s card is not flipped to it. Battle Points are a pure module over `points.json`, not the rulebook.

## Consequences

- Every world’s battle starts you as a trooper; a hero is earned, as in the game. The kept loadout changes to the class you deploy as.
- The Battlefront world’s own spawn screen and the galaxy’s are two drawings of one idea; the galaxy’s imports nothing from the other island.
- The flow design’s decision 3 (flip the card when lane 5 merges) waits on the Battlefront world holding more than Hoth.

## Revisit when

The Battlefront world plays four or more of the galaxy’s worlds on the game’s own levels, or the owner asks for the game’s level on Hoth first.
