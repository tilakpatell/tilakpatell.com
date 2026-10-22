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
//   createRoomHost({ rt, scene, camera, house, tier, reduced, outside, lights, tell, load, context, lesson })
//     → { enter(id, { at, yaw, props, walk, from }) → Promise<room>, back() → bool, leave(), room, id,
//         step(dt, input, touch) → bool, place(at, yaw), walk(at, yaw), word(text), dispose() }
//     outside: the grounds’ objects hidden while in a room; lights: the grounds’ lights, dimmed
//     context() → props every room is built with (the house, the Sorting’s password, the hour)
//     out() → the world’s way out to the grounds (a room’s great doors)
//     lesson(id, { p, yaw }) → a lesson started where a classroom sets it out (p in the world), Lane E’s;
//       left out, a classroom’s lesson door says the lesson isn’t on
//     tell('room', { id, name } | null) as one is entered or left; tell('near', { door } | null) at a door inside
//     back(): out of a room gone into from another, back into that one at the door you took; false if none
//
// A room may stand in the world instead (`at`: [x, y, z], where its own
// frame’s origin goes; the Astronomy Tower’s top on the far castle’s
// gallery), and then the grounds stay up round it: everything the walk and
// the doors read is offset by where it stands, and frame([x, z]) gives the
// room’s own coordinates back (the Map’s).
//
// A room’s module (its default export) has build(rt, ctx) → room, or a
// Promise of one; ctx: { house, tier, renderer, props, from, leave(), say(text),
// tell(type, data), place(at, yaw), hold(on) }. A room: { id, name, group,
// spawn: { at: [x, y, z], yaw }, colliders, floors, doors: [{ id, at: [x, z],
// r, faces, name, verb?, to: 'out' | roomId, act?() }], places, bounds,
// level?, floorAt(x, z) → y, solidsNow?(), step(dt, ctx), set(props), word?(text),
// info(), dispose() }: every place in the room’s own frame (the host stands it
// at the origin). A door with `act` does what it says (a stair climbed, a
// password asked) rather than lead anywhere; `level` is the floor the walk
// may not step down from (a landing’s edge), read every step.

import { Color } from 'three';
import { createWalker } from '../play/walk';
import { ROOM_ORIGIN } from './origin';

export { ROOM_ORIGIN };

export const LOCAL = {
  greatHall: { name: 'The Great Hall', load: () => import('./greatHall.js') },
  staircase: { name: 'The Grand Staircase', load: () => import('./staircase.js') },
  gryffindor: { name: 'The Gryffindor common room', load: () => import('./common/gryffindor.js') },
  slytherin: { name: 'The Slytherin common room', load: () => import('./common/slytherin.js') },
  ravenclaw: { name: 'The Ravenclaw common room', load: () => import('./common/ravenclaw.js') },
  hufflepuff: { name: 'The Hufflepuff common room', load: () => import('./common/hufflepuff.js') },
  kitchens: { name: 'The kitchens', load: () => import('./kitchens.js') },
  library: { name: 'The library', load: () => import('./library.js') },
  potions: { name: 'The Potions dungeon', load: () => import('./potions.js') },
  charms: { name: 'The Charms classroom', load: () => import('./charms.js') },
  defence: { name: 'The Defence Against the Dark Arts classroom', load: () => import('./defence.js') },
  requirement: { name: 'The Room of Requirement', load: () => import('./requirement.js') },
  owlery: { name: 'The Owlery', load: () => import('./owlery.js') },
  astronomy: { name: 'The top of the Astronomy Tower', load: () => import('./astronomy.js') },
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

export function createRoomHost({ rt, scene, camera, house, tier = 'high', reduced = false, outside = [], lights = [], tell = () => {}, load = (id) => LOCAL[id]?.load?.(), context = () => ({}), out: out_ = null, lesson = null }) {
  let room = null;
  let id = null;
  let walker = null;
  const behind = []; // the rooms gone through to get here: [{ id, at, yaw }]
  // (out to the grounds, the world’s way: it puts you back where you went in)
  const out = () => {
    behind.length = 0;
    if (out_) out_();
    else host.leave();
  };
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

  // where a room’s own frame stands in the world: its `at`, or far below the grounds
  const originOf = (r) => r?.at ?? ROOM_ORIGIN;
  // (read every step: a room whose floor moves under you, the staircase’s, changes them as you go)
  const worldOf = (r) => {
    const o = originOf(r);
    const shift = (list) => (o[0] || o[2] ? list.map((c) => ({ ...c, at: [c.at[0] + o[0], c.at[1] + o[2]] })) : list);
    const fixed = shift(solidsOf(r.colliders));
    return {
      floorAt: (x, z) => o[1] + (r.floorAt?.(x - o[0], z - o[2]) ?? 0),
      get level() {
        return r.level == null ? -Infinity : o[1] + r.level;
      },
      get bounds() {
        const b = r.bounds ?? null;
        return b && (o[0] || o[2]) ? { x0: b.x0 + o[0], x1: b.x1 + o[0], z0: b.z0 + o[2], z1: b.z1 + o[2] } : b;
      },
      get solids() {
        const now = r.solidsNow?.();
        return now ? shift(now) : fixed;
      },
    };
  };
  let hidden = false;

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
    async enter(roomId, { at = null, yaw = null, props = {}, walk = true, from = null } = {}) {
      const ticket = ++entering;
      const mod = await load(roomId);
      const def = mod?.default ?? mod;
      if (!def?.build) throw new Error(`rooms: no room ${roomId}`);
      const ctx = {
        house,
        tier,
        renderer: rt?.gfx?.renderer ?? null,
        props: { ...context(), ...props },
        from,
        leave: () => host.back() || host.leave(),
        say: (text) => tell('toast', { text }),
        tell,
        place: (to, turn) => {
          const o = originOf(room);
          walker?.place([to[0] + o[0], to[1] + o[2]], turn);
        },
        hold: (on) => (host.hold = Boolean(on)),
        // (on through a door of the room’s own making, Esc coming back; or out to the grounds)
        enter: (to) => host.enter(to, { from: roomId }).catch(() => tell('toast', { text: `${to === 'kitchens' ? 'The kitchens' : 'That way'} is locked. Not today.` })),
        out: () => out(),
        // (a classroom’s spot, in its own frame, given to the lessons in the world’s)
        lesson: lesson ? (lessonId, p, turn = 0) => {
          const o = originOf(room);
          lesson(lessonId, { p: [p[0] + o[0], p[1] + o[1], p[2] + o[2]], yaw: turn });
        } : null,
      };
      const built = await def.build(rt, ctx);
      if (gone || ticket !== entering) {
        built?.dispose?.();
        return null;
      }
      // (gone in from another room: remember where, so Esc goes back to it)
      if (room && from) behind.push({ id, at: walker ? [walker.state.x, walker.state.z] : null, yaw: walker?.state.yaw ?? 0 });
      if (room) host.leave({ quiet: true, keep: true });
      room = built;
      id = roomId;
      const o = originOf(room);
      room.group.position.set(...o);
      scene.add(room.group);
      house?.adopt?.(room.group);
      // (the look’s shade a room’s own warm dark, not the grounds’ night blue; the world’s relight puts it
      // back outside. A room standing in the world keeps the grounds, their light and their fog)
      if (!room.at) {
        house?.set?.({ shadow: new Color(room.shade ?? 0x2e2219) });
        if (!hidden) hideOutside(true);
        hidden = true;
      } else if (hidden) {
        hideOutside(false);
        hidden = false;
      }
      const spawn = at ? { at, yaw: yaw ?? 0 } : { at: [room.spawn.at[0] + o[0], room.spawn.at[2] + o[2]], yaw: yaw ?? room.spawn.yaw ?? 0 };
      walker = walk ? createWalker({ camera, world: worldOf(room), at: spawn.at, yaw: spawn.yaw, reduced }) : null;
      near = null;
      tell('near', { door: null });
      tell('room', { id: roomId, name: room.name ?? def.name ?? roomId });
      return room;
    },
    // out the way you came: into the room you were in before this one, at its door
    back() {
      const was = behind.pop();
      if (!was || !room) return false;
      host.enter(was.id, { at: was.at, yaw: was.yaw }).catch(() => host.leave());
      return true;
    },
    leave({ quiet = false, keep = false } = {}) {
      if (!keep) behind.length = 0;
      if (!room) return;
      room.dispose?.();
      room.group?.removeFromParent();
      room = null;
      id = null;
      walker = null;
      host.hold = false;
      near = null;
      if (hidden) hideOutside(false);
      hidden = false;
      if (!quiet) {
        tell('near', { door: null });
        tell('room', null);
      }
    },
    place(at, yaw) {
      walker?.place(at, yaw);
    },
    // E at a door, or the prompt’s own button on touch: what the door does, or through it
    act() {
      if (!near || !room) return false;
      if (near.act) near.act();
      else if (near.to !== 'out') host.enter(near.to, { from: id }).catch(() => tell('toast', { text: near.locked ?? 'Locked. Not today.' }));
      return true;
    },
    // a word typed into the HUD’s card (a password, a riddle’s answer), for the room that asked
    word(text) {
      room?.word?.(text);
    },
    // a point in the world in the room’s own frame (the Map’s, and the doors’)
    frame([x, z]) {
      const o = originOf(room);
      return [x - o[0], z - o[2]];
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
        const [x, z] = host.frame([walker.state.x, walker.state.z]);
        let door = null;
        for (const d of room.doors ?? []) if (Math.hypot(x - d.at[0], z - d.at[1]) < (d.r ?? 1.5) + NEAR) door = d;
        if ((door?.id ?? null) !== (near?.id ?? null) || (door && door.name !== near?.name)) {
          near = door;
          tell('near', { door: door && (door.act || door.to !== 'out') ? { label: door.name, verb: door.verb ?? null, room: door.to ?? null } : null });
        }
        if (pressed('act')) host.act();
      }
      room.step?.(dt, { camera, input, at: walker ? host.frame([walker.state.x, walker.state.z]) : null, hold: (on) => (host.hold = Boolean(on)) });
      return true;
    },
    dispose() {
      gone = true;
      host.leave({ quiet: true });
    },
  };
  return host;
}
