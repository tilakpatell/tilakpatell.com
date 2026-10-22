// Where the rooms stand: far below the grounds, so a room never stands in
// the grounds' fog or their shadow cascades (host.js stands each one here).
// Its own file so a room can read it without importing the host that loads
// it, which would make the two a cycle.
export const ROOM_ORIGIN = [0, -2000, 0];
