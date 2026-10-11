// A district on another of the game's maps (lane E3): its pack is in its own
// frame, so the main map's places, cast, scatter and quests would stand in
// the wrong spots on it. The district's `site` clears them and its `ground`
// is the pack's own; the pack's actors and vehicles (level/index.js's
// levelPlaced) are its people. Hoth's base and Endor's bunker are in the main
// map's frame and keep the world as it is.
//
//   ownMap(level) → { ground, site } for a district row

export const ownMap = (level) => ({
  ground: { layers: [{ type: 'image', pack: level }], flats: [], pits: [] },
  site: { places: [], things: [], things_all: [], scatter: [], flora: null, life: [], wants: [], rides: [], quests: [] },
});
