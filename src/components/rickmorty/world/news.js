// What a place says has happened to Morty (./npc.js's hunters and
// ./dimensions/stage.js's games, through the render state's emit), heard by
// RmWorld or not: only from the place he's in, and nothing while he's fading
// but a win. A room's hunters tick before its game steps, so a catch in the
// frame a game's won is said first and fades him; the win is still his (no
// game says it's won during a fade it shouldn't count through: each skips its
// news while fading). Pure, tested.
//
//   newsHeard(name, sim, e) → whether RmWorld plays the event `name` from `e.area`

export const newsHeard = (name, s, e) => Boolean(s) && s.area === e.area && (!s.fading || name === 'done');
