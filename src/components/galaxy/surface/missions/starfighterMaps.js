// The systems with a Starfighter Assault, by system id: the space level's
// map rulebook and hand stages (src/data/bf2017/maps/), fetched only when
// one's flown (./starfighter.js makes them a battle), and the level pack
// the flight draws (public/models/galaxy/bf2017/levels/<pack>/). Endor's in
// orbit, Kamino's in an area of its own over Tipoca City's sea; Fondor's
// shipyard and the droid battleship over Ryloth (the sixth design's lane
// fighters) each in an area of its own as well, entered from the systems
// the galaxy has nearest them until it has theirs: Fondor from Coruscant
// (the E5 lane adds Fondor's system; its row's key moves then), the droid
// battleship from Naboo, where the space lane set the level's blockade
// (docs/superpowers/HANDOFF-battlefront.md).

// a level's rulebook and stages, with the air rulebook (the fighters' kits and handling: starfighterKits.js)
const loadLevel = (map, stages) => Promise.all([map, stages, import('../../../../data/bf2017/air.json')]).then(([m, s, a]) => ({ map: m.default, stages: s.default, air: a.default }));

export const STARFIGHTER = {
  endor: {
    level: 'sb_endor_01',
    // (the pack: /models/galaxy/bf2017/levels/sb_endor/level.json, the level's
    // fleet, debris and wrecks without its planet, its moon or its corvettes)
    pack: 'sb_endor',
    packOrigin: [-259, 0, -665], // (its --spot, no ground)
    name: 'Starfighter Assault: Endor',
    load: () => loadLevel(import('../../../../data/bf2017/maps/sb_endor.json'), import('../../../../data/bf2017/maps/sb_endor.stages.json')),
  },
  kamino: {
    level: 'sb_kamino_01',
    // (the pack: /models/galaxy/bf2017/levels/sb_kamino/level.json, Tipoca City and
    // the fleets over it without the Republic's cruisers, which the battle draws and
    // sinks; fought in an area of its own, its sky and sea round it: levelArea.js)
    pack: 'sb_kamino',
    packOrigin: [-466, 0, -1390], // (its --spot, no ground)
    name: 'Starfighter Assault: Kamino',
    load: () => loadLevel(import('../../../../data/bf2017/maps/sb_kamino.json'), import('../../../../data/bf2017/maps/sb_kamino.stages.json')),
  },
  coruscant: {
    level: 'sb_fondor_01',
    // (the pack: /models/galaxy/bf2017/levels/sb_fondor/level.json, the dry dock,
    // its Star Destroyer and the MC80 without the Gladiator cruisers or the
    // corvettes, which the battle draws and sinks; in an area of its own)
    pack: 'sb_fondor',
    packOrigin: [246, 0, -130], // (its --spot, no ground)
    name: 'Starfighter Assault: Fondor',
    load: () => loadLevel(import('../../../../data/bf2017/maps/sb_fondor.json'), import('../../../../data/bf2017/maps/sb_fondor.stages.json')),
  },
  naboo: {
    level: 'sb_droidbattleship_01',
    // (the pack: /models/galaxy/bf2017/levels/sb_droidbattleship/level.json, the
    // Lucrehulk and the fleets round it without the Republic's cruisers; in an
    // area of its own, over Ryloth)
    pack: 'sb_droidbattleship',
    packOrigin: [47, 0, 44], // (its --spot, no ground)
    name: 'Starfighter Assault: the droid battleship over Ryloth',
    load: () => loadLevel(import('../../../../data/bf2017/maps/sb_droidbattleship.json'), import('../../../../data/bf2017/maps/sb_droidbattleship.stages.json')),
  },
};

export const starfighterAt = (sys) => STARFIGHTER[sys] ?? null;
