// Hogsmeade as a room for the host (rooms/host.js): the village’s set
// (world/hogsmeade.js), entered from the grounds (the Menu’s “Hogsmeade”
// on a Hogsmeade weekend, until the grounds’ road reaches it), its shops’
// doors leading on into their insides and the road at the station’s end
// back out. Its frame on the Map is rules/paths.js’s ROOM_FRAMES.hogsmeade.

import { createHogsmeade } from '../world/hogsmeade';

export default { id: 'hogsmeade', name: 'Hogsmeade', build: (rt, ctx) => createHogsmeade(rt, ctx) };
