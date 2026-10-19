// Where you are aboard, to the others online (Inside.jsx's useTravellers,
// middleearth/towns/travellers.js): each room is an area of its own, so
// only those in the room you're in are listed (the station is one frame of
// metres, its levels stacked, and a room's walls hide the rest anyway).
// The link keeps a height from naught up, and the levels go down to −48 m,
// so the height sent is over the room's lowest floor (`base`, floorOf the
// layout's room: alike for everyone in it), which the scene puts back; up
// stairs or a jump, it counts. Pure: the module sends what this gives each
// step it plays.
//
//   areaOf(station, room) → 'ds1-bay327'
//   floorOf(room) → the room's lowest floor's height (water can lie under its deck)
//   createStepper() → (you, station, dt, base) → [h, flags] for the link's pose(h, flags)

const AREA = /[^a-z0-9-]+/g;
export const areaOf = (station, room) => (room ? `${station}-${room}` : String(station)).toLowerCase().replace(AREA, '-').slice(0, 24);

// (a figure aboard faces −z, turned by −yaw: the ghost is turned by the face it's sent)
export const floorOf = (room) => (room ? Math.min(room.y ?? 0, ...(room.floors ?? []).map((f) => f.y)) : 0);

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const JUMP = 6; // metres in a step that are a lift or a checkpoint, not a stride

export function createStepper() {
  let last = null;
  let speed = 0;
  return (you, station, dt, base = 0) => {
    const moved = last ? Math.hypot(you.x - last.x, you.z - last.z) : 0;
    const now = dt > 0 && moved < JUMP ? moved / dt : 0;
    // (eased: the steps come at their own pace, not the frame's)
    speed += (now - speed) * Math.min(1, dt * 8);
    last = { x: you.x, z: you.z };
    return [{ x: you.x, y: Math.max(0, you.y - base), z: you.z, face: wrap(-(you.yaw ?? 0)), speed }, { area: areaOf(station, you.room) }];
  };
}
