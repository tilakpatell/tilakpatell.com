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
// The wand (play/wandfx.js) is stepped beside the walker: its events
// ('spell', 'toast', 'points', 'wand', 'wheel' and the rest it lists) go to
// the page the same way, and the world adds choose(id) (the wheel's pick)
// and press(name, down) (the touch buttons: 'cast'); the development hook
// adds cast(spell, at) (`at` a thing's id, a point [x, y, z], or nothing:
// what the view points at).
//
// The broom (play/broom.js) lies on the shingle by the jetty: E by it (or
// Accio it to you first) and you're up, the walker put away until you land;
// 'broom' { riding } as you get on and off. Quidditch (play/snitch.js): the
// Snitch alone wherever you are (practice), or a match on the pitch (or,
// until the grounds have one, in front of you); its events 'said', 'match',
// 'result' and 'points' go to the page. The world adds fly(), practice(),
// match(n) and bubble(el) (the commentator's bubble, moved over his box);
// press(name, down) takes 'rise', 'sink' and 'catch' too. The development
// hook adds fly(), practice(), match(n) and quidditch() (the match's state).
//
// The lessons (play/lessons.js): one at a time, started by lesson(id) (the
// Menu's, until the term's lane sends you to them), held where you stand
// until the grounds and the rooms give each its place; they have the E key
// while they run, say what to do next ('objective' { id, text }) and what
// a teacher says ('said', the speaker play/said.js moves over them), and
// when one is done 'lesson' { type: 'lesson', id, quest, done } and its
// 'points'. The development hook adds lesson(id) and lessons() (its state).
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
import { BROOM_KEYS, createBroom } from './play/broom';
import { createQuidditch } from './play/snitch';
import { createCards } from './play/glow';
import { createSaid } from './play/said';
import { createLessons } from './play/lessons';
import { practiceSet } from './play/props';
import { createFeel } from '../../lib/three/feel';
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

    rt.input?.bind?.({ ...KEYS, ...WAND_KEYS, ...BROOM_KEYS });
    const touch = { x: 0, y: 0, rise: false, sink: false, catch: false };
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

    // the broom, and Quidditch on it; their motes and the Snitch's glint in a
    // pool of their own (the wand's is busy with its own sparks)
    const air = createCards({ count: 400, parent: scene });
    const broom = createBroom({ rt, scene, camera, house, floorAt, level: LEVEL, solids: shore.solids, bounds: { x0: BOUNDS.x0 - 150, x1: BOUNDS.x1 + 150, z0: BOUNDS.z0 - 60, z1: BOUNDS.z1 + 400 }, feel, reduced, cards: air });
    // (no pitch on the shore: a match is played on a stand-in one out on the
    // lake, the castle behind it, until the grounds' lane builds the real one)
    const said = createSaid({ rt, camera, tell });
    const quidditch = createQuidditch({ rt, scene, camera, house, broom, cards: air, feel, tier, tell, said, stage: { at: [0, LEVEL + 0.15, -200], yaw: 0 } });
    const BROOM_REACH = 2.4; // m: near enough the broom on the ground to get on it
    const broomThing = () => wand.things.get('broom');
    const nearBroom = () => {
      const th = broomThing();
      if (!th || broom.riding || th.held || th.gone) return false;
      const p = th.object.position;
      return Math.hypot(p.x - walker.state.x, p.z - walker.state.z) <= BROOM_REACH;
    };
    const fly = () => {
      if (broom.riding) return;
      const th = broomThing();
      if (th) {
        th.object.visible = false;
        th.gone = true;
      }
      broom.mount([walker.state.x, walker.state.z], walker.state.yaw);
      tell('broom', { riding: true });
      tell('toast', { text: 'W to go, A and D to bank, Space up, C down, Shift flat out.' });
    };
    // down again: off you get, and the broom lies where you landed
    const landed = ([x, z], yaw) => {
      walker.place([x, z], yaw);
      const th = broomThing();
      if (th) {
        th.object.position.set(x + Math.cos(yaw) * 0.9, floorAt(x, z) + 0.12, z - Math.sin(yaw) * 0.9);
        th.object.rotation.y = yaw;
        th.object.visible = true;
        th.gone = false;
      }
      tell('broom', { riding: false });
    };
    // (Buckbeak's ride goes out over the lake and round the far castle)
    const places = { lake: [CASTLE.at[0] * 0.4, LEVEL, CASTLE.at[1] * 0.4], castle: [CASTLE.at[0], 40, CASTLE.at[1]] };
    const lessons = createLessons({ rt, scene, camera, house, houseName: 'gryffindor', wand, broom, walker, floorAt, tell, said, cards: air, feel, figure: null, fly, places });
    // where a lesson is held: until the grounds and the rooms give each its
    // place, a stretch of the shingle by the jetty, looking along the shore
    // (so a duel or a ride's start isn't out on the water); you're put there
    const STATION = { at: [SPAWN.at[0] + 2, SPAWN.at[1] + 5], yaw: -Math.PI / 2 };
    const lesson = (id) => {
      walker.place(STATION.at, STATION.yaw);
      return lessons.start(id, { p: [STATION.at[0], floorAt(...STATION.at), STATION.at[1]], yaw: STATION.yaw });
    };

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

    // the one prompt: the broom at your feet before the boats' way in
    let near = null;
    const heldAct = new Set(); // (E's codes held last step: a lesson hears it let go)
    const promptNow = () => {
      if (broom.riding) return null;
      if (nearBroom()) return 'broom';
      return nearDoor(walker.state.x, walker.state.z) ? 'door' : null;
    };
    const go = () => {
      const what = promptNow();
      if (what === 'broom') fly();
      else if (what === 'door') tell('go', { door: { label: DOOR.label } });
    };
    const frame = (dt) => {
      key.position.copy(camera.position).addScaledVector(keyDir, 200);
      key.target.position.copy(camera.position);
      sky.update(camera, dt);
      shore.update(camera, dt);
      const now = promptNow();
      if (now !== near) {
        near = now;
        tell('near', { door: near === 'broom' ? { verb: 'Fly', label: 'The broom' } : near === 'door' ? { label: DOOR.label } : null });
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
        const stick = input?.stick ?? touch;
        const pad = { x: stick.x || touch.x, y: stick.y || touch.y, rise: touch.rise, sink: touch.sink, catch: touch.catch };
        // (a lesson has E while it runs; let go of it is its too)
        const act = pressed('act') && lessons.act(true);
        if (lessons.active && KEYS.act.some((c) => input?.pressed && !input.keys?.has?.(c) && heldAct.has(c))) lessons.act(false);
        heldAct.clear();
        for (const c of KEYS.act) if (input?.keys?.has?.(c)) heldAct.add(c);
        let landedAt = null;
        if (quidditch.playing) quidditch.step(dt, input, pad);
        else if (broom.riding) {
          const r = broom.step(dt, input, pad);
          if (r?.landed) {
            landed(r.landed, r.yaw);
            landedAt = r.landed;
          }
        } else if (!lessons.holds) {
          if (pressed('act') && !act) go();
          walker.step(dt, input, pad);
        }
        lessons.step(dt, input, pad, { rider: broom.rider, landed: landedAt });
        said.update();
        feel.update(dt, camera);
        wand.step(dt, input);
        air.update(dt, camera);
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
      // the wheel's pick, and the touch buttons held and let go
      choose: (id) => wand.choose(id),
      press(name, down) {
        if (name === 'cast') wand.press(down);
        else if (name in touch) touch[name] = down;
      },
      fly,
      practice: () => {
        if (!broom.riding) fly();
        quidditch.start({ practice: true });
      },
      match: (n = 1) => {
        if (!broom.riding) fly();
        quidditch.start({ n });
      },
      bubble: (el) => said.bubble(el),
      lesson,
      lessons,
      pick: (n) => lessons.pick(n),
      broom,
      quidditch,
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
        quidditch.dispose();
        lessons.dispose();
        broom.dispose();
        air.dispose();
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
      window.__HOGWARTS__ = {
        world,
        state,
        place: (x, z, yaw) => walker.place([x, z], yaw),
        dusk,
        cast: (spell, at) => wand.cast(spell, at),
        wand: () => wand.state(),
        fly: () => world.fly(),
        practice: () => world.practice(),
        match: (n) => world.match(n),
        lesson: (id) => world.lesson(id),
        lessons: () => lessons.state(),
        quidditch: () => ({ ...quidditch.state(), rider: broom.rider && { p: broom.rider.p.map((v) => Math.round(v * 10) / 10), spd: Math.round(broom.rider.spd * 3.6), mode: broom.rider.mode } }),
      };
    }
    return world;
  },
};
