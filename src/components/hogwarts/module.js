// Hogwarts, the world module (docs/superpowers/specs/2026-10-21-hogwarts-world-design.md):
// on the world runtime, on the node renderer. Lane A's first stretch of it:
// the shore of the Black Lake the night the first-years come, the dusk going
// down into the night, the castle lit across the water, the jetty and its
// four boats, and a shingle shore to walk. The rules are pure files under
// rules/; this file composes the drawing (world/) and the player (play/).
//
// Props: { reduced, at } (at: an arrival beat or part, 'hall' among them: the arrival opened there).
//
// Events to the page (rt.events): 'near' { door: { label } | null } as the
// way in at the boats comes into reach or goes, 'go' { door } when it's
// taken (E, Enter, or the prompt's own button through go()), 'menu' {} on
// Esc.
// The world adds: go() (the prompt's button), stick(x, y) (the touch
// stick), and `scene`, `walker` for the checks. In development,
// window.__HOGWARTS__ = { state(), place(x, z, yaw), dusk(s), world }.
//
// The wand (play/wandfx.js) is stepped beside the walker: its events
// ('spell', 'toast', 'points', 'wand', 'wheel' and the rest it lists) go to
// the page the same way, and the world adds choose(id) (the wheel's pick)
// and press(name, down) (the touch buttons: 'cast'); the development hook
// adds cast(spell, at) (`at` a thing's id, a point [x, y, z], or nothing:
// what the view points at).
//
// Where the rest hooks in (the lanes after this one): the grounds and the
// near castle add to the scene beside the shore (Lane C: world/terrain.js
// and world/castle/ take over from rules/shore.js and the far castle within
// 300 m); the rooms load through a door ('go' for a door that leads in,
// rooms/index.js) and hide the grounds while you're inside (Lane D); the
// wand and the broom are players beside the walker (play/), stepped where
// the walker is (Lane E).

import * as THREE from 'three';
import { loadKit } from '../../lib/three/kitNodes';
import { chainFor, createHogwartsHouse } from './world/hooks';
import { createSky } from './world/sky';
import { createLake } from './world/lake';
import { createShore } from './world/shore';
import { createBoats } from './world/boats';
import { createFarCastle } from './world/castle/far';
import { CRAG, SIZE } from './world/castle/silhouette';
import { KEYS, createWalker } from './play/walk';
import { WAND_KEYS, createWand } from './play/wandfx';
import { practiceSet } from './play/props';
import { createFeel } from '../../lib/three/feel';
import { BOUNDS, CASTLE, DOOR, LEVEL, SPAWN, floorAt, heightAt, nearDoor } from './rules/shore';
import { DUSK, lightAt } from './rules/dusk';
import { ROOM_ORIGIN as ROOM_AT, createRoomHost } from './rooms/host';
import { createArrival } from './world/arrival';
import { ANCHORS_A } from './world/arrival/shots';
import { BEATS, PARTS } from './rules/arrival';

export { KEYS };

export default {
  id: 'hogwarts',
  shading: 'nodes',
  mb: 2,
  label: 'Hogwarts: the shore of the Black Lake at dusk, the castle lit across the water',
  create(rt, props = {}) {
    const reduced = Boolean(props.reduced);
    const tier = rt.quality?.tier ?? 'high';
    const scene = new THREE.Scene();
    // (out past the far hills, 1.7 km off)
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000);
    scene.fog = new THREE.FogExp2(0x1c2236, 0.001);
    const house = createHogwartsHouse({ edge: [0.12, 0.6] });

    // the MegaKit, once, in the house and the wind
    const windTime = { value: 0 };
    let kit = null;
    const kitFor = () => (kit ??= loadKit('naturemega', { house, wind: { time: windTime } }));

    const sky = createSky();
    const shore = createShore({ house, kitFor, tier });
    const lake = createLake({ sky, ground: heightAt, level: LEVEL, castle: { at: CASTLE.at, wide: CRAG.wide, tall: SIZE.tall } });
    const castle = createFarCastle({ house, at: CASTLE.at });
    const boats = createBoats({ house, tier });
    const key = new THREE.DirectionalLight(0xffffff, 1);
    const hemi = new THREE.HemisphereLight(0x5a6890, 0x2e2a22, 0.6);
    scene.add(sky.mesh, shore.group, lake.mesh, castle.group, boats.group, key, key.target, hemi);

    const passes = chainFor(tier, rt.gfx?.backend, { scene, camera });
    const post = rt.gfx?.post?.(passes) ?? null;
    const renderer = rt.gfx?.renderer ?? null;
    const exposureWas = renderer?.toneMappingExposure ?? null;

    rt.input?.bind?.({ ...KEYS, ...WAND_KEYS });
    const touch = { x: 0, y: 0 };
    const ground = { floorAt, level: LEVEL, bounds: BOUNDS, solids: shore.solids };
    const walker = createWalker({ camera, world: ground, at: SPAWN.at, yaw: SPAWN.yaw, reduced });

    // what's said before the page listens is held for it (fromScene's way)
    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };

    // the wand, and the things beside the jetty for it to take hold of;
    // the feel's knocks and punches on the camera after the walk has placed it
    const feel = createFeel({ baseFov: camera.fov, calm: reduced });
    const wand = createWand({ rt, scene, camera, house, floorAt, tell, feel });
    wand.place(practiceSet({ at: SPAWN.at, yaw: SPAWN.yaw, floorAt, house, rt }));

    // the rooms behind the doors (Lane D, rooms/host.js): built far below as
    // you go in, the shore hidden and its lights down while you're inside
    const rooms = createRoomHost({ rt, scene, camera, house, tier, reduced, outside: [sky.mesh, shore.group, lake.mesh, castle.group, boats.group], lights: [key, hemi], tell });

    // the arrival (Lane D, world/arrival.js): the night of the first-years, on
    // rails, from the station to the Sorting; played on a first visit, from
    // the boats when you take them after that, and from its beat for ?at=
    const mooring = [boats.group.getObjectByName('boats:hulls'), boats.group.children.find((c) => c.type === 'Group')];
    const arrival = createArrival({
      rt,
      scene,
      camera,
      house,
      tier,
      reduced,
      anchors: ANCHORS_A,
      heightAt,
      sky,
      lake: [shore.group, lake.mesh, castle.group, boats.group],
      hide: mooring,
      rooms,
      tell,
      saves: rt.saves,
      night: () => {
        clock = Math.max(clock, DUSK.length + 30);
        relight();
      },
      dim: (k) => {
        lightK = k;
        relight();
      },
    });
    let lightK = 1; // (the arrival's: the moon's light down where it can't reach)

    let clock = 0;
    let light = null;
    const keyDir = new THREE.Vector3();
    const sunDir = new THREE.Vector3();
    const haze = new THREE.Color();
    const shade = new THREE.Color();
    const relight = () => {
      light = lightAt(clock, { reduced });
      sky.set(light);
      lake.set(light);
      castle.set(light);
      keyDir.set(...light.key.dir);
      key.color.setRGB(...light.key.colour, THREE.SRGBColorSpace);
      key.intensity = light.key.intensity * lightK;
      hemi.color.setRGB(...light.hemi.sky, THREE.SRGBColorSpace);
      hemi.groundColor.setRGB(...light.hemi.ground, THREE.SRGBColorSpace);
      hemi.intensity = light.hemi.intensity * lightK;
      // (none while a room is up: the host keeps the grounds' fog and puts it back on the way out)
      if (scene.fog) {
        scene.fog.color.setRGB(...light.fog.colour, THREE.SRGBColorSpace);
        scene.fog.density = light.fog.density;
      }
      // (the house's fog takes the sky's own colours: the horizon low, the zenith
      // high, and the sunset's glow toward where the sun went down)
      sunDir.set(...light.sun.dir);
      house.sky({ low: sky.uniforms.horizon.value, high: sky.uniforms.zenith.value, sunDir, halo: haze.copy(sky.uniforms.glow.value).multiplyScalar(0.6) });
      house.light({ sun: key, hemi });
      // (the shade: the sky's own blue, lifted toward the horizon's, so what the low light misses still reads)
      house.set({ shadow: shade.setRGB(...light.hemi.sky, THREE.SRGBColorSpace).lerp(sky.uniforms.horizon.value, 0.4).multiplyScalar(0.95) });
      if (renderer) renderer.toneMappingExposure = light.exposure;
    };

    let near = false;
    const go = () => {
      if (!nearDoor(walker.state.x, walker.state.z)) return;
      tell('go', { door: { label: DOOR.label } });
      // (the boats: the arrival from the push off; Enter skips it to the steps once it has been seen)
      arrival.start('pushoff');
    };
    const frame = (dt) => {
      key.position.copy(camera.position).addScaledVector(keyDir, 200);
      key.target.position.copy(camera.position);
      sky.update(camera, dt);
      shore.update(camera, dt);
      const now = nearDoor(walker.state.x, walker.state.z);
      if (now !== near) {
        near = now;
        tell('near', { door: near ? { label: DOOR.label } : null });
      }
    };

    relight();
    frame(0);
    const known = (at) => Boolean(at) && (PARTS.includes(at) || BEATS.some((b) => b.id === at));
    if (known(props.at) || !arrival.save.arrived) arrival.start(known(props.at) ? props.at : null);

    let since = 0;
    const world = {
      ready: rt.gfx?.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        const pressed = (name) => KEYS[name].some((c) => input?.pressed?.has?.(c));
        // (the arrival on its rails: the night held, the shore drawn where it's on the lake)
        if (arrival.active) {
          clock += dt;
          // (the night's light, but not while the arrival is in a room: the room has its own)
          if (!rooms.room && (since += dt) > 0.25) {
            since = 0;
            relight();
          }
          arrival.step(dt, (name) => (name === 'skip' ? input?.pressed?.has?.('Enter') : pressed(name)));
          if (!rooms.room) {
            windTime.value += dt;
            lake.update(dt);
            boats.update(clock);
            frame(dt);
          }
          return;
        }
        // (inside a room: its walk and its life; Esc is the way out, back where you came in)
        if (rooms.room) {
          if (pressed('menu')) world.leave();
          else rooms.step(dt, input, touch, pressed);
          return;
        }
        if (pressed('menu')) tell('menu');
        if (pressed('act')) go();
        const stick = input?.stick ?? touch;
        walker.step(dt, input, { x: stick.x || touch.x, y: stick.y || touch.y });
        feel.update(dt, camera);
        wand.step(dt, input);
        clock += dt;
        // (the light moves slowly: a few times a second is plenty)
        if ((since += dt) > 0.25) {
          since = 0;
          relight();
        }
        windTime.value += dt;
        lake.update(dt);
        boats.update(clock);
        frame(dt);
      },
      draw(f) {
        if (post) post.render();
        else (f?.renderer ?? renderer)?.render(scene, camera);
      },
      wants: () => true,
      scene,
      walker,
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
      // into a room (rooms/host.js) and out again, back on the shore where you stood
      enter: (id, opts) => rooms.enter(id, opts),
      // the arrival: the Menu's “The arrival”, the Sorting card's answers, Enter's skip
      arrive: (at = null) => arrival.start(at),
      answer: (i) => arrival.answer(i),
      skip: () => arrival.skip(),
      arrival,
      leave() {
        rooms.leave();
        walker.place([walker.state.x, walker.state.z], walker.state.yaw);
        relight();
      },
      rooms,
      wand,
      // the wheel's pick, and the touch buttons held and let go
      choose: (id) => wand.choose(id),
      press(name, down) {
        if (name === 'cast') wand.press(down);
      },
      stick(x, y) {
        touch.x = x;
        touch.y = y;
      },
      dispose() {
        arrival.dispose();
        rooms.dispose();
        rt.input?.unbind?.();
        if (exposureWas != null) renderer.toneMappingExposure = exposureWas;
        sky.dispose();
        lake.dispose();
        shore.dispose();
        castle.dispose();
        boats.dispose();
        wand.dispose();
        kit?.dispose();
        post?.dispose?.();
        if (typeof window !== 'undefined' && window.__HOGWARTS__?.world === world) delete window.__HOGWARTS__;
      },
    };

    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      // the checks' view of it: where you are, what's in reach, the light, and the last frame's draws and triangles
      const state = () => {
        const r = renderer?.info?.render ?? {};
        const s = walker.state;
        return { at: [s.x, floorAt(s.x, s.z), s.z].map((v) => Math.round(v * 100) / 100), yaw: s.yaw, pitch: s.pitch, speed: s.speed, near, clock, dusk: light?.k ?? 0, tier, calls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0 };
      };
      // (place(x, z, yaw): stand somewhere; dusk(s): the light s seconds into the dusk, 240 its night)
      const dusk = (sec) => {
        clock = sec;
        relight();
      };
      // (room(id): go in; view(pose): stand at one of the room's named views, its eye and where it looks; info(): the room's own count)
      const room = (id, opts) => rooms.enter(id, opts).then((r) => r?.info?.() ?? null);
      const view = (name) => {
        const p = rooms.room?.poses?.[name];
        if (!p) return null;
        rooms.walker && (rooms.walker.place([p.at[0], p.at[2]], 0));
        camera.position.set(p.at[0] + ROOM_AT[0], p.at[1] + ROOM_AT[1], p.at[2] + ROOM_AT[2]);
        camera.lookAt(p.look[0] + ROOM_AT[0], p.look[1] + ROOM_AT[1], p.look[2] + ROOM_AT[2]);
        rooms.hold = true;
        return p;
      };
      // (arrive(at): the arrival from a beat; arrival(): where it is)
      window.__HOGWARTS__ = { world, state, place: (x, z, yaw) => walker.place([x, z], yaw), dusk, cast: (spell, at) => wand.cast(spell, at), wand: () => wand.state(), room, view, info: () => rooms.room?.info?.() ?? null, arrive: (at) => arrival.start(at), arrival: () => arrival.info(), answer: (i) => arrival.answer(i) };
    }
    return world;
  },
};
