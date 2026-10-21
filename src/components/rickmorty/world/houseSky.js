// The sky the house look (lib/three/house.js) fogs an area into: the
// street's on the street, a place's own where it has one (a destination's
// sky, or a room's outside: dimensions/stage.js sets `skyLook`), Blips and
// Chitz's for an outdoor area with none of its own, and none in a room.
// (Every outdoor place took Blips and Chitz's pink before: a pink seam on
// Pluto's horizon, and on Gear World's.)
export function houseSky(id, area, { outdoor, street, annex }) {
  if (id === 'street') return street;
  if (area?.skyLook) return area.skyLook;
  return outdoor.includes(id) ? annex : null;
}
