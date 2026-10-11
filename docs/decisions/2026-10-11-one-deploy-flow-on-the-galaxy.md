# Hoth on the game’s own level; the other assaults take the game’s deploy flow until theirs are wired

Date: 2026-10-11. The long version: `docs/superpowers/specs/2026-10-11-galactic-assault-bf2017-flow-design.md`.

## Context

The owner asked for Galactic Assault as Star Wars Battlefront II (2017) has it, with the game’s own assets, not the site’s older battle: pick the mode, spawn as one of the four classes, heroes only once Battle Points afford them. Two assaults existed: the galaxy’s, on eight of the site’s worlds, which put you on the field as the Loadout’s hero for free; and the Battlefront world’s, on the game’s own Hoth level with the game’s screens, HUD and spawn flow, linked from nowhere. The Battlefront world can play a level only with its teams row, its stages’ objectives and its lighting rulebook, which the data holds for Hoth alone.

## Decision

Hoth’s Galactic Assault is the Battlefront world (the galaxy’s card, tile and briefing send the player there, with a way back). The other seven worlds keep the galaxy’s engine and take the game’s deploy flow on it (classes free, the enforcer and heroes at the record’s prices, Battle Points earned in the battle, a bought hero worn for one life), until each level’s rulebooks are wired and it moves over. Battle Points on the galaxy’s engine are a pure module over `points.json`, not the rulebook.

## Consequences

- One flow in the player’s hands on every world; Hoth is the game itself.
- The galaxy’s spawn screen and the Battlefront world’s are two drawings of one idea; the galaxy’s imports nothing from the other island.
- Each world that moves to the game’s level is a lane: its teams row, its stages’ objectives chosen from the map’s volumes, its lighting, weather and picture, from the export on the owner’s desktop.

## Revisit when

A second level’s rulebooks are complete (Endor first: its pack, picture and stages exist), or the owner asks for the galaxy’s battles to go altogether.
