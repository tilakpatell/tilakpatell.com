// The expanse's face for the universe: the whole generator, so the universe's
// places, its resolver and the terminal make and read sectors without
// reaching inside. Every source is pure (no React, DOM or three.js), so this
// face is too. It isn't lane 2's space.js: that face lends the drawn Expanse,
// and so three.js with it. A page that loads the nav takes orbits.js, the
// light face, instead.
//
// UNIVERSE, universeOf (seed.js); fullSector, placeOf, placeIn (space.js);
// orbitAt, moonAt, bodiesAt, spaceTime (orbits.js); systemReach (systems.js);
// THING_BASE, THING_CELLS, THING_NEAR, THING_KINDS, SECTOR_EXTRAS, thingRow
// (things.js); WONDER_KINDS (tables.js); STATION_BASE, stationsOf
// (stations.js); extentOf (extent.js)

export { UNIVERSE, universeOf } from '../gen/seed';
export { fullSector, placeIn, placeOf } from '../gen/space';
export { bodiesAt, moonAt, orbitAt, spaceTime } from '../gen/orbits';
export { systemReach } from '../gen/systems';
export { SECTOR_EXTRAS, THING_BASE, THING_CELLS, THING_KINDS, THING_NEAR, thingRow } from '../gen/things';
export { WONDER_KINDS } from '../gen/tables';
export { STATION_BASE, stationsOf } from '../gen/stations';
export { extentOf } from '../gen/extent';
