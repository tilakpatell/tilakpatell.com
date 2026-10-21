// Hogwarts, the world module (docs/superpowers/specs/2026-10-21-hogwarts-world-design.md):
// on the world runtime, on the node renderer. Lane A's first stretch of it:
// the shore of the Black Lake the night the first-years come, the dusk going
// down into the night, the castle lit across the water, the jetty and its
// four boats, and a shingle shore to walk. The rules are pure files under
// rules/; this file composes the drawing (world/) and the player (play/).
//
// Props: { reduced }.
//
// Events to the page (rt.events): 'near' { door: { label } | null } as the
// way in at the boats comes into reach or goes, 'go' { door } when it's
// taken (E, Enter, or the prompt's own button through go()), 'menu' {} on
// Esc.
// The world adds: go() (the prompt's button), stick(x, y) (the touch
// stick), and `scene`, `walker` for the checks. In development,
// window.__HOGWARTS__ = { state(), place(x, z, yaw), dusk(s), world }.
//
// The night half (play/night.js, Lane F) keeps the castle’s people on their
// days (rules/people.js) and the world adds map(): the Marauder’s Map’s
// view of everyone and you, on the Map’s frame, read every frame by
// hud/MaraudersMap.jsx; the development hook adds night() for the same.
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
import { lightAt } from './rules/dusk';
import { createNight } from './play/night';

export { KEYS };

// where the shore’s own frame sits on the Map’s (the grounds’, rules/places.js’s): its
// waterline on the Black Lake’s south shore, across the water from the castle
const MAP_SHORE = [24, 445];

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

    // the night half (Lane F, play/night.js): the castle’s people on their days
    // for the Marauder’s Map. The shore’s dusk is the arrival night’s, its clock
    // read as the world’s hours from 19:54 (Lane C’s rules/clock.js’s ARRIVE)
    const week = props.week ?? 1;
    const night = createNight({
      timeOf: () => 19.9 + clock / 60,
      weekOf: () => week,
      me: () => ({ x: walker.state.x + MAP_SHORE[0], z: walker.state.z + MAP_SHORE[1], yaw: walker.state.yaw, moving: walker.state.speed > 0.3, inside: null }),
    });

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
      key.intensity = light.key.intensity;
      hemi.color.setRGB(...light.hemi.sky, THREE.SRGBColorSpace);
      hemi.groundColor.setRGB(...light.hemi.ground, THREE.SRGBColorSpace);
      hemi.intensity = light.hemi.intensity;
      scene.fog.color.setRGB(...light.fog.colour, THREE.SRGBColorSpace);
      scene.fog.density = light.fog.density;
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

    let since = 0;
    const world = {
      ready: rt.gfx?.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        const pressed = (name) => KEYS[name].some((c) => input?.pressed?.has?.(c));
        if (pressed('menu')) tell('menu');
        if (pressed('act')) go();
        const stick = input?.stick ?? touch;
        walker.step(dt, input, { x: stick.x || touch.x, y: stick.y || touch.y });
        feel.update(dt, camera);
        wand.step(dt, input);
        night.step(dt);
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
      wand,
      // the Marauder’s Map’s view of everyone (hud/MaraudersMap.jsx reads it every frame)
      map: () => night.view(),
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
      window.__HOGWARTS__ = { world, state, place: (x, z, yaw) => walker.place([x, z], yaw), dusk, cast: (spell, at) => wand.cast(spell, at), wand: () => wand.state(), night: () => night.view() };
    }
    return world;
  },
};
