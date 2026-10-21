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
// window.__HOGWARTS__ = { state(), world }.
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
import { BOUNDS, CASTLE, DOOR, LEVEL, SPAWN, floorAt, heightAt, nearDoor } from './rules/shore';
import { lightAt } from './rules/dusk';

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

    rt.input?.bind?.(KEYS);
    const touch = { x: 0, y: 0 };
    const ground = { floorAt, level: LEVEL, bounds: BOUNDS, solids: shore.solids };
    const walker = createWalker({ camera, world: ground, at: SPAWN.at, yaw: SPAWN.yaw, reduced });

    // what's said before the page listens is held for it (fromScene's way)
    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };

    let clock = 0;
    let light = null;
    const keyDir = new THREE.Vector3();
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
      // (the house's fog takes the sky's own colours: the horizon low, the zenith high)
      house.sky({ low: sky.uniforms.horizon.value, high: sky.uniforms.zenith.value, sunDir: keyDir });
      house.light({ sun: key, hemi });
      house.set({ shadow: new THREE.Color().setRGB(...light.hemi.sky, THREE.SRGBColorSpace).multiplyScalar(0.55) });
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
      window.__HOGWARTS__ = { world, state, place: (x, z, yaw) => walker.place([x, z], yaw) };
    }
    return world;
  },
};
