// The Expanse's face for generated space on the universe map, so another
// world (the universe's scene, and its ship's tests) takes it without
// reaching inside: the Expanse drawn round the ship (scene/expanse.js) and
// the room its far layer wants, the shared universe's seed, a sector made
// from it with its bodies, and where a planet or moon is on the shared clock.

export { createExpanse, farRoom } from '../scene/expanse';
export { UNIVERSE } from '../gen/seed';
export { makeSector } from '../gen/sector';
export { addBodies } from '../gen/systems';
export { moonAt, orbitAt, spaceTime } from '../gen/orbits';
