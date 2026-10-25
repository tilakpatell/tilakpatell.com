// The expanse's light face for the universe: where a generated planet or moon
// is at a time, and how far a planet reaches. It is apart from gen.js because
// the universe's nav reaches it (through places/ids.js), and so does every
// page that loads the nav: the home page's mini-map, ⌘K and the site's root.
// So it lends only what imports nothing, and never the generator.
//
// orbitAt, moonAt, spaceTime (gen/orbits.js's); extentOf (gen/extent.js's)

export { moonAt, orbitAt, spaceTime } from '../gen/orbits';
export { extentOf } from '../gen/extent';
