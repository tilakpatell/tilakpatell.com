// The Expanse's face for the universe map: the endless space drawn
// (scene/expanse.js) and the seed it's made from, so the map takes them
// without reaching inside. It lends three.js with it; a page that wants only
// the generator takes gen.js, the pure face, instead.
//
// createExpanse, sectorPools (scene/expanse.js); UNIVERSE (gen/seed.js)

export { createExpanse, sectorPools } from '../scene/expanse';
export { UNIVERSE } from '../gen/seed';
