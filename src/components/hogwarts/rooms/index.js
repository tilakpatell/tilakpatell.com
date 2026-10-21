// The rooms behind the castle’s doors (the design’s §4.4): one lazy module a
// room, loaded when its door is gone through and disposed on leaving, the
// grounds kept built but hidden under it so going out is instant. This is
// the registry: a room is in it or its door is locked (doors.js says so in
// character: “Locked. Not today.”). Lane D adds its rooms to ROOMS here, one
// line each; a room made elsewhere (Hagrid’s hut, world/grounds/) is added
// with registerRoom from its own file.
//
//   ROOMS: { [id]: { name, load: () => import('./greatHall.js') } }
//   registerRoom(id, { name, load }) → the registry (a later one replaces an earlier)
//   hasRoom(id) → whether a room of that id can be gone into
//   roomName(id) → its name, or null
//   loadRoom(id) → Promise<the room’s module>, rejects for an id not registered
//
// A room’s module (its default export):
//   { build(rt, ctx) → Promise<{ group, spawn: { at: [x, y, z], yaw }, colliders, floors, doors, places }> | the same,
//     step?(dt, input, ctx), dispose?() }
//   ctx: { house, tier, from (the door’s id it was entered by), leave() (out the way you came), say(text) (a toast) }
//   group: the room, drawn where it is built (rooms are built at ROOM_ORIGIN, far below the grounds, so
//     a room never stands in the grounds’ shadow cascades or their fog);
//   spawn: where you stand in it as you come in; colliders and floors: plan.js’s shapes;
//   doors: [{ id, at: [x, z], y, faces, name, to: 'out' | a room id }] its own ways out and on;
//   places: [{ id, name, at, r }] what the Map names in it.

export const ROOM_ORIGIN = [0, -2000, 0];

export const ROOMS = {
  // greatHall: { name: 'The Great Hall', load: () => import('./greatHall.js') },
  // staircase: { name: 'The Grand Staircase', load: () => import('./staircase.js') },
};

export function registerRoom(id, { name, load }) {
  ROOMS[id] = { name, load };
  return ROOMS;
}

export const hasRoom = (id) => Boolean(id && ROOMS[id]?.load);
export const roomName = (id) => ROOMS[id]?.name ?? null;

export async function loadRoom(id) {
  if (!hasRoom(id)) throw new Error(`rooms: no room ${id}`);
  const mod = await ROOMS[id].load();
  return mod.default ?? mod;
}
