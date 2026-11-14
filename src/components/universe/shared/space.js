// The universe's face for its one space: the hand-made places, the sectors
// they sit in and which sector a point is in, and the map's palette, for the
// expanse's generator. palette.js imports nothing, so the worker carries no
// more for it.

export { PLACES } from '../deep';
export { SECTORS, SECTOR_RADIUS, sectorOf } from '../layout';
export { PALETTE, tint } from '../palette';
