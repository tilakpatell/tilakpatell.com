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
// A room’s module (its default export) is rooms/host.js’s shape, which the
// world module (module.js) loads through: { id, name, build(rt, ctx) → room
// | Promise<room> }, ctx { house, tier, renderer, props (the host’s
// context: the house, the Sorting’s password, the hour, the week), from,
// leave(), say(text), tell(type, data), place(at, yaw), hold(on) }; a room
// { id, name, group, spawn: { at: [x, y, z], yaw }, colliders, floors,
// doors: [{ id, at: [x, z], r, faces, name, to: 'out' | a room id, act? }],
// places, bounds, floorAt(x, z), step?(dt, ctx), set?(props), info(),
// dispose() }, every place in its own frame (the host stands it at
// ROOM_ORIGIN, far below the grounds, so a room never stands in their fog
// or their shadow cascades). Lane D’s rooms are the host’s LOCAL until
// they are listed here; the grounds’ Hagrid’s hut registers itself.

export { ROOM_ORIGIN } from './origin';

export const ROOMS = {
  greatHall: { name: 'The Great Hall', load: () => import('./greatHall.js') },
  // (the courtyard door’s: the common rooms and the kitchens are gone into from it, through the host)
  staircase: { name: 'The Grand Staircase', load: () => import('./staircase.js') },
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
