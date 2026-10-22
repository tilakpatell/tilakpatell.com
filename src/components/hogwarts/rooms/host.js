// The rooms, hosted (the design’s §4.4): a room is built when its door is
// gone through and disposed on leaving; the grounds stay built but hidden
// under it, so going out is instant. Rooms are built in their own frame and
// stood at ROOM_ORIGIN, far below the grounds, so a room never stands in the
// grounds’ fog or their shadow cascades. Inside, you walk as you walk on the
// shore (play/walk.js) on the room’s floor, round its colliders, inside its
// walls; Esc is the way out (the kit’s Exit says so), and E at one of its
// doors goes on into the next room or out.
//
//   ROOM_ORIGIN: [x, y, z]   (rooms/index.js’s, Lane C’s, when it lands)
//   LOCAL: { id: { name, load } } the rooms this lane has made, until the registry lists them
//   solidsOf(colliders) → [{ at, r }]: circles for the walk (a box laid as a row of them)
//   createRoomHost({ rt, scene, camera, house, tier, reduced, outside, lights, tell, load })
//     → { enter(id, { at, yaw, props, walk }) → Promise<room>, leave(), room, id, step(dt, input, touch) → bool, place(at, yaw), walk(at, yaw), dispose() }
//     outside: the grounds’ objects hidden while in a room; lights: the grounds’ lights, dimmed
//     tell('room', { id, name } | null) as one is entered or left; tell('near', { door } | null) at a door inside
//
// A room’s module (its default export) has build(rt, ctx) → room, or a
// Promise of one; ctx: { house, tier, renderer, props, from, leave(), say(text) }.
// A room: { id, name, group, spawn: { at: [x, y, z], yaw }, colliders, floors,
// doors: [{ id, at: [x, z], r, faces, name, to: 'out' | roomId }], places,
// bounds, floorAt(x, z) → y, step(dt, ctx), set(props), info(), dispose() }:
// every place in the room’s own frame (the host stands it at the origin).

import { createWalker } from '../play/walk';

export const ROOM_ORIGIN = [0, -2000, 0];

export const LOCAL = {
  greatHall: { name: 'The Great Hall', load: () => import('./greatHall.js') },
};

export function solidsOf(colliders = []) {
  const out = [];
  for (const c of colliders) {
    if (!c) continue;
    if (c.kind === 'box') {
      // (a box as a row of circles down its longer side, each as wide as its shorter)
      const long = Math.max(c.w, c.d);
      const short = Math.min(c.w, c.d);
      const n = Math.max(1, Math.ceil(long / short));
      const along = c.w >= c.d ? [Math.cos(c.turn ?? 0), -Math.sin(c.turn ?? 0)] : [Math.sin(c.turn ?? 0), Math.cos(c.turn ?? 0)];
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n - 0.5;
        out.push({ at: [c.at[0] + along[0] * k * long, c.at[1] + along[1] * k * long], r: short / 2 });
      }
    } else out.push({ at: c.at, r: c.r });
  }
  return out;
}

const NEAR = 2.2; // m from a door’s middle, beyond its own reach, its prompt shows

export function createRoomHost({ rt, scene, camera, house, tier = 'high', reduced = false, outside = [], lights = [], tell = () => {}, load = (id) => LOCAL[id]?.load?.() }) {
  let room = null;
  let id = null;
  let walker = null;
  let wasFog = null;
  const lit = new Map();
  let near = null;
  let gone = false;
  let entering = 0;

  const hideOutside = (hide) => {
    for (const o of outside) if (o) o.visible = !hide;
    for (const l of lights) {
      if (!l) continue;
      if (hide) {
        lit.set(l, l.intensity);
        l.intensity = 0;
      } else if (lit.has(l)) l.intensity = lit.get(l);
    }
    if (hide) {
      wasFog = scene.fog;
      scene.fog = null;
    } else if (wasFog) scene.fog = wasFog;
  };

  const worldOf = (r) => ({
    floorAt: (x, z) => ROOM_ORIGIN[1] + (r.floorAt?.(x, z) ?? 0),
    level: -Infinity,
    bounds: r.bounds ?? null,
    solids: solidsOf(r.colliders),
  });

  const host = {
    // (the checks’ named views hold the camera where they put it: the walk doesn’t move it)
    hold: false,
    get room() {
      return room;
    },
    get id() {
      return id;
    },
    get walker() {
      return walker;
    },
    async enter(roomId, { at = null, yaw = null, props = {}, walk = true } = {}) {
      const ticket = ++entering;
      const mod = await load(roomId);
      const def = mod?.default ?? mod;
      if (!def?.build) throw new Error(`rooms: no room ${roomId}`);
      const built = await def.build(rt, { house, tier, renderer: rt?.gfx?.renderer ?? null, props, from: null, leave: () => host.leave(), say: (text) => tell('toast', { text }) });
      if (gone || ticket !== entering) {
        built?.dispose?.();
        return null;
      }
      if (room) host.leave({ quiet: true });
      room = built;
      id = roomId;
      room.group.position.set(...ROOM_ORIGIN);
      scene.add(room.group);
      house?.adopt?.(room.group);
      hideOutside(true);
      const spawn = at ? { at, yaw: yaw ?? 0 } : { at: [room.spawn.at[0], room.spawn.at[2]], yaw: yaw ?? room.spawn.yaw ?? 0 };
      walker = walk ? createWalker({ camera, world: worldOf(room), at: spawn.at, yaw: spawn.yaw, reduced }) : null;
      tell('room', { id: roomId, name: room.name ?? def.name ?? roomId });
      return room;
    },
    leave({ quiet = false } = {}) {
      if (!room) return;
      room.dispose?.();
      room.group?.removeFromParent();
      room = null;
      id = null;
      walker = null;
      host.hold = false;
      near = null;
      hideOutside(false);
      if (!quiet) {
        tell('near', { door: null });
        tell('room', null);
      }
    },
    place(at, yaw) {
      walker?.place(at, yaw);
    },
    // (a room gone into without walking, the arrival’s: walk in it from here)
    walk(at, yaw = 0) {
      if (!room) return;
      walker = createWalker({ camera, world: worldOf(room), at, yaw, reduced });
      host.hold = false;
    },
    // a frame in the room: the walk, the room’s own life, the way out
    step(dt, input, touch, pressed = () => false) {
      if (!room) return false;
      if (walker && !host.hold) {
        walker.step(dt, input, touch);
        const s = walker.state;
        let door = null;
        for (const d of room.doors ?? []) if (Math.hypot(s.x - d.at[0], s.z - d.at[1]) < (d.r ?? 1.5) + NEAR) door = d;
        if ((door?.id ?? null) !== (near?.id ?? null)) {
          near = door;
          tell('near', { door: door && door.to !== 'out' ? { label: door.name, room: door.to } : null });
        }
        if (pressed('act') && near && near.to !== 'out') host.enter(near.to).catch(() => tell('toast', { text: 'Locked. Not today.' }));
      }
      room.step?.(dt, { camera, input, at: walker ? [walker.state.x, walker.state.z] : null });
      return true;
    },
    dispose() {
      gone = true;
      host.leave({ quiet: true });
    },
  };
  return host;
}
