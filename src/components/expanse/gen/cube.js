// How far from a sector's middle generated things keep, each way: appended
// systems (space.js), and lane 4a's lists and gargantuans, whose whole extent
// stays inside it so a neighbour's systems and lattice, which don't know
// them, can't reach them. A leaf: the lists import it, and importing space.js
// from them would be a cycle. Legacy systems sit at least 2,000 inside a
// sector face, so 4,000 more keeps the spec's 6,000 gap across a face.

export const CUBE_HALF = 56000;
