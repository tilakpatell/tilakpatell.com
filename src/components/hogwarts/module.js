// Hogwarts, the world module (docs/superpowers/specs/2026-10-21-hogwarts-world-design.md):
// on the world runtime, on the node renderer. The grounds and the castle
// outside (Lane C, world/grounds.js: the land, the Black Lake, the sky and
// the day’s clock, the weather, the castle near and far and its doors), the
// player on foot (play/walk.js) and the rooms behind the doors (rooms/,
// Lane D’s, through rooms/index.js). The rules are pure files under rules/;
// this file composes the drawing (world/) and the player (play/).
//
// Props: { at: an hour (‘dusk’, ‘noon’, ‘night’, ‘18:30’) or a place’s id
// (rules/places.js) to stand at, week (the term’s, a prop until the term
// lands), reduced }.
//
// Events to the page (rt.events): 'near' { door: { label, verb, key } | null }
// as a door comes into reach or goes (its prompt, key first), 'toast'
// { text } when something has a line to say (a locked door: “Locked. Not
// today.”), 'enter' { room, name } and 'leave' {} as you go into a room and
// out again, 'menu' {} on Esc.
// The world adds: go() (the prompt’s own button: what E does), stick(x, y)
// (the touch stick), enter(roomId, from) and leave() (a room in and out; a
// door does it itself), and `scene`, `walker`, `grounds` for the checks. In
// development, window.__HOGWARTS__ = { state(), place(x, z, yaw), view(at, look),
// go(placeId), time(hour), term(week), dusk(s), world }.
//
// Where the rest hooks in (the lanes after the grounds): the arrival
// (Lane D) is a ride before the walk; the rooms register in rooms/index.js
// and load through their doors, the grounds hidden while you’re in one;
// the wand and the broom are players beside the walker (play/), stepped
// where the walker is (Lane E); the term’s week comes from rules/term.js
// (Lane F) through grounds.setWeek.

import * as THREE from 'three';
import { createGroundsHouse } from './world/hooks';
import { createGrounds } from './world/grounds';
import { KEYS, createWalker } from './play/walk';
import { ARRIVE, parseAt } from './rules/clock';
import { HALF, placeById } from './rules/places';
import { ROOM_ORIGIN, loadRoom, roomName } from './rooms/index';

export { KEYS };

// where you stand when the world opens: the lawn below the castle’s east
// front, the castle up the slope to the west with the lake beyond it
export const SPAWN = { at: [196, -14], yaw: 1.36 };
const BOUNDS = { x0: -HALF + 12, x1: HALF - 12, z0: -HALF + 12, z1: HALF - 12 };
const REACH = 26; // m round you the walls are looked at for the walk
const STEP_AROUND = 0.7; // m between the stones a wall is walked round as

// a box’s outline as a row of small circles, which is what the walk goes round
function outline(box) {
  const c = Math.cos(box.turn ?? 0);
  const s = Math.sin(box.turn ?? 0);
  const P = (u, v) => [box.at[0] + u * c + v * s, box.at[1] - u * s + v * c];
  const hw = box.w / 2;
  const hd = box.d / 2;
  const corners = [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
  const r = Math.min(0.5, Math.max(0.25, Math.min(box.w, box.d) / 2));
  const out = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i];
    const [bx, bz] = corners[(i + 1) % 4];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP_AROUND));
    for (let k = 0; k < n; k++) out.push({ at: [ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n], r });
  }
  return out;
}
export function solidsOf(colliders) {
  return colliders.flatMap((c) => (c.kind === 'box' ? outline(c) : [{ at: c.at, r: c.r }]));
}
const near = (list, x, z, reach = REACH) => list.filter((s) => Math.abs(s.at[0] - x) < reach + s.r && Math.abs(s.at[1] - z) < reach + s.r);

// an address’s `at`: an hour, or a place to stand at
export function startOf(at) {
  const hour = parseAt(at);
  const place = hour == null && at ? placeById(String(at)) : null;
  return { hour: hour ?? ARRIVE, at: place ? [place.at[0], place.at[1]] : SPAWN.at, yaw: place ? (place.faces ?? 0) : SPAWN.yaw };
}

export default {
  id: 'hogwarts',
  shading: 'nodes',
  mb: 9,
  label: 'Hogwarts: the castle on its crag over the Black Lake, its grounds, the lake and the forest’s edge',
  async create(rt, props = {}) {
    const reduced = Boolean(props.reduced);
    const tier = rt.quality?.tier ?? 'high';
    const scene = new THREE.Scene();
    // (out past the far hills: the lake’s far shore and the range beyond, 2 km and more)
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
    const { house } = createGroundsHouse({ edge: [0.1, 0.55] });
    const start = startOf(props.at);
    camera.position.set(start.at[0], 60, start.at[1]);

    const grounds = await createGrounds(rt, { scene, camera, tier, house, hour: start.hour, week: Number(props.week) || 1 });
    const post = rt.gfx?.post?.(grounds.passes) ?? null;
    const renderer = rt.gfx?.renderer ?? null;

    rt.input?.bind?.(KEYS);
    const touch = { x: 0, y: 0 };
    // what the walk stands on and goes round: the grounds (a bridge’s deck or
    // a stair’s step near the height you were at), or a room’s while you’re in one
    let lastY = null;
    let room = null; // { id, name, built, mod, from }
    // (the castle’s standing parts once; the gates, which open and shut, each frame)
    const castleWalls = solidsOf(grounds.castle?.colliders ?? []);
    let walls = castleWalls;
    const ground = {
      floorAt: (x, z) => (room?.built.floorAt ? room.built.floorAt(x, z) : grounds.groundAt(x, z, lastY)),
      level: 0,
      bounds: BOUNDS,
      solids: [],
    };
    const walker = createWalker({ camera, world: ground, at: start.at, yaw: start.yaw, reduced });

    // what's said before the page listens is held for it (fromScene's way)
    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };

    let shown = null; // the prompt the page has
    let fixed = null; // { at, look }: the development hook’s view, for the checks’ poses
    let act = false;
    let busy = false; // (a room loading: the doors wait)
    const go = () => {
      act = true;
    };

    // into a room through a door, and out again the way you came
    let outside = [];
    const enter = async (id, from = null) => {
      if (busy || room) return false;
      busy = true;
      try {
        const mod = await loadRoom(id);
        const built = await mod.build(rt, house, { tier, renderer, from, origin: ROOM_ORIGIN, hour: grounds.hour, leave: () => world.leave() });
        outside = scene.children.filter((o) => o.visible);
        for (const o of outside) o.visible = false;
        scene.add(built.group);
        room = { id, name: roomName(id) ?? mod.name ?? id, built, mod, from, back: { at: [walker.state.x, walker.state.z], yaw: walker.state.yaw + Math.PI } };
        const s = built.start ?? built.spawn ?? null;
        if (s) walker.place(s.at.length === 3 ? [s.at[0], s.at[2]] : s.at, s.yaw ?? 0);
        walls = solidsOf(built.colliders ?? []);
        tell('enter', { room: id, name: room.name });
        return true;
      } catch {
        tell('toast', { text: 'Locked. Not today.' });
        return false;
      } finally {
        busy = false;
      }
    };
    const leave = () => {
      if (!room) return false;
      scene.remove(room.built.group);
      room.built.dispose?.();
      for (const o of outside) o.visible = true;
      outside = [];
      walker.place(room.back.at, room.back.yaw);
      room = null;
      walls = castleWalls;
      tell('leave', {});
      return true;
    };

    const world = {
      ready: rt.gfx?.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        const pressed = (name) => KEYS[name].some((c) => input?.pressed?.has?.(c));
        if (pressed('menu')) tell('menu');
        if (pressed('act')) act = true;
        // (the walls near you, and the gates as they stand this frame)
        const s0 = walker.state;
        ground.solids = near(room ? walls : [...walls, ...solidsOf(grounds.doors?.colliders() ?? [])], s0.x, s0.z);
        const stick = input?.stick ?? touch;
        // (a check’s fixed view holds the camera where it was put; the walk waits)
        if (fixed) {
          camera.position.set(...fixed.at);
          camera.lookAt(...fixed.look);
        } else walker.step(dt, input, { x: stick.x || touch.x, y: stick.y || touch.y });
        const s = walker.state;
        lastY = ground.floorAt(s.x, s.z);
        const awake = Boolean(input?.pressed?.size || input?.pointer?.drag);
        const out = grounds.step(dt, { at: room ? null : [s.x, lastY, s.z], act: act && !busy, awake });
        room?.built.step?.(dt, { at: [s.x, lastY, s.z], act, hour: grounds.hour });
        act = false;
        const prompt = out.prompt ? { label: out.prompt.name, verb: out.prompt.verb, key: out.prompt.key } : null;
        if ((prompt?.label ?? null) !== (shown?.label ?? null) || (prompt?.verb ?? null) !== (shown?.verb ?? null)) {
          shown = prompt;
          tell('near', { door: prompt });
        }
        if (out.toast) tell('toast', { text: out.toast });
        if (out.enter) enter(out.enter.room, out.enter.from);
      },
      draw(f) {
        const r = f?.renderer ?? renderer;
        if (!room) grounds.beforeDraw(r);
        if (post) post.render();
        else r?.render(scene, camera);
      },
      wants: () => true,
      scene,
      walker,
      grounds,
      get room() {
        return room?.id ?? null;
      },
      anchor: () => camera.position.toArray(),
      lowerQuality() {},
      update() {},
      attached() {
        const was = held ?? [];
        held = null;
        for (const [type, data] of was) rt.events?.emit?.(type, data);
      },
      // the prompt's own button, and the touch stick
      go,
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      enter,
      leave,
      dispose() {
        rt.input?.unbind?.();
        if (room) {
          scene.remove(room.built.group);
          room.built.dispose?.();
          room = null;
        }
        grounds.dispose();
        post?.dispose?.();
        if (typeof window !== 'undefined' && window.__HOGWARTS__?.world === world) delete window.__HOGWARTS__;
      },
    };

    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      // the checks' view of it: where you are, what's in reach, the hour, and the last frame's draws and triangles
      const state = () => {
        const r = renderer?.info?.render ?? {};
        const s = walker.state;
        return { at: [s.x, lastY ?? 0, s.z].map((v) => Math.round(v * 100) / 100), yaw: s.yaw, pitch: s.pitch, speed: s.speed, near: shown?.label ?? null, room: room?.id ?? null, hour: grounds.hour, week: grounds.stats().week, tier, calls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0, memory: renderer?.info?.memory ?? null };
      };
      const goTo = (id) => {
        const p = placeById(id);
        if (p) walker.place([p.at[0], p.at[1] + (p.kind === 'door' ? 4 : 0)], p.kind === 'door' ? (p.faces ?? 0) + Math.PI : walker.state.yaw);
        return Boolean(p);
      };
      window.__HOGWARTS__ = {
        world,
        renderer,
        state,
        place: (x, z, yaw) => {
          fixed = null;
          walker.place([x, z], yaw);
        },
        // (a camera put anywhere, a boat on the lake among them, looking at a point; view(null) gives the walk back)
        view: (at, look) => void (fixed = at ? { at, look } : null),
        go: goTo,
        time: (h) => grounds.setHour(parseAt(h) ?? Number(h)),
        term: (w) => grounds.setWeek(w),
        // (Lane A’s: s seconds into the first night’s dusk)
        dusk: (sec) => grounds.setHour(ARRIVE + sec / 60),
      };
    }
    return world;
  },
};
