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
import { DUSK, lightAt } from './rules/dusk';
import { ROOM_ORIGIN as ROOM_AT, createRoomHost } from './rooms/host';
import { createArrival } from './world/arrival';
import { ANCHORS_A } from './world/arrival/shots';
import { BEATS, PARTS } from './rules/arrival';
import { createNight } from './play/night';
import { createSchool } from './play/school';
import { createNoticeBoard } from './world/noticeBoard';
import { createCurfew } from './play/curfew';
import { createPresence } from './play/presence';
import { createDementors, playNotes } from './world/grounds/dementors';
import { drain, pull } from './rules/dementors';
import { afterHours } from './rules/curfew';
import { inland } from './rules/shore';
import { LOCAL as ROOMS_BUILT } from './rooms/host';
import { frameYaw, fromRoom } from './rules/paths';

export { KEYS };

// the invisibility cloak, on and off, once you have it (the guide’s keys say so)
export const CLOAK_KEYS = { cloak: ['KeyI'] };
const GREY = new THREE.Color(0.42, 0.44, 0.47); // (the cold’s shade: the house look’s shadow drained to it as the dementors close)
const RUN = 3.6; // m/s on foot past which a run is heard down a corridor

// where the shore’s own frame sits on the Map’s (the grounds’, rules/places.js’s): its
// waterline on the Black Lake’s south shore, across the water from the castle
const MAP_SHORE = [24, 445];

export default {
  id: 'hogwarts',
  shading: 'nodes',
  mb: 21,
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

    rt.input?.bind?.({ ...KEYS, ...WAND_KEYS, ...BROOM_KEYS, ...CLOAK_KEYS });
    const touch = { x: 0, y: 0, rise: false, sink: false, catch: false };
    const ground = { floorAt, level: LEVEL, bounds: BOUNDS, solids: shore.solids };
    const walker = createWalker({ camera, world: ground, at: SPAWN.at, yaw: SPAWN.yaw, reduced });

    // what's said before the page listens is held for it (fromScene's way);
    // the term and the night hear everything on its way out (Lane F's `ears`)
    let held = [];
    let ears = null;
    const tell = (type, data = {}) => {
      ears?.(type, data);
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };

    // the term (Lane F, play/school.js): the week, the house points and the
    // quests, kept in tp-hogwarts beside the Sorting's keys; it knows which
    // spells you've learnt, so it's here before the wand
    const hours = () => 19.9 + clock / 60;
    const school = createSchool({ saves: rt.saves, tell, week: props.week ?? null });

    // the wand, and the things beside the jetty for it to take hold of;
    // the feel's knocks and punches on the camera after the walk has placed it
    const feel = createFeel({ baseFov: camera.fov, calm: reduced });
    const wand = createWand({ rt, scene, camera, house, houseName: school.house, floorAt, tell, feel, learnt: school.learnt });
    wand.place(practiceSet({ at: SPAWN.at, yaw: SPAWN.yaw, floorAt, house, rt }));

    // the notice board (Lane F, world/noticeBoard.js): to the right of where
    // you come up from the boats, past the practice set, turned to face you
    const boardAt = (() => {
      const [x, z] = [6.8, 2.4];
      const c = Math.cos(SPAWN.yaw);
      const s = Math.sin(SPAWN.yaw);
      const at = [SPAWN.at[0] + x * c - z * s, SPAWN.at[1] - x * s - z * c];
      return { at: [at[0], floorAt(...at), at[1]], yaw: Math.atan2(SPAWN.at[0] - at[0], SPAWN.at[1] - at[1]) };
    })();
    const board = createNoticeBoard({ house, tier, renderer: rt.gfx?.renderer ?? null, ...boardAt });
    scene.add(board.group);
    ground.solids = [...shore.solids, ...board.solids];
    board.set(school.view());

    // the night half (Lane F, play/night.js): the castle’s people on their days
    // for the Marauder’s Map. The shore’s dusk is the arrival night’s, its clock
    // read as the world’s hours from 19:54 (Lane C’s rules/clock.js’s ARRIVE)
    const night = createNight({
      timeOf: hours,
      weekOf: () => school.week,
      // (in a room, its walk in its own frame turned onto the Map's: rules/paths.js's ROOM_FRAMES)
      me: () => {
        const inRoom = Boolean(rooms.room && rooms.walker);
        const w = inRoom ? rooms.walker.state : walker.state;
        const [x, z] = inRoom ? fromRoom(rooms.id, [w.x, w.z]) : [w.x + MAP_SHORE[0], w.z + MAP_SHORE[1]];
        return { x, z, yaw: w.yaw + (inRoom ? frameYaw(rooms.id) : 0), moving: w.speed > 0.3, inside: inRoom ? rooms.id : null };
      },
    });

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
    const lessons = createLessons({ rt, scene, camera, house, houseName: school.house, wand, broom, walker, floorAt, tell, said, cards: air, feel, figure: null, fly, places });
    // where a lesson is held: until the grounds and the rooms give each its
    // place, a stretch of the shingle by the jetty, looking along the shore
    // (so a duel or a ride's start isn't out on the water); you're put there
    const STATION = { at: [SPAWN.at[0] + 2, SPAWN.at[1] + 5], yaw: -Math.PI / 2 };
    const lesson = (id) => {
      walker.place(STATION.at, STATION.yaw);
      return lessons.start(id, { p: [STATION.at[0], floorAt(...STATION.at), STATION.at[1]], yaw: STATION.yaw });
    };

    // the rooms behind the doors (Lane D, rooms/host.js): built far below as
    // you go in, the shore hidden and its lights down while you're inside
    // (every room is told the house and the Sorting's password: the common rooms' doors ask for it)
    const rooms = createRoomHost({ rt, scene, camera, house, tier, reduced, outside: [sky.mesh, shore.group, lake.mesh, castle.group, boats.group, board.group], lights: [key, hemi], tell, context: () => ({ house: arrival.save.house, password: arrival.save.password, hour: 21 }), out: () => world.out() });
    // the Great Hall as the term has it: the hourglasses at every house’s
    // points, the twelve trees at Christmas, and at the leaving feast the
    // tables laid and the banners in the colours of the house that won
    const dress = (settle = false) => {
      if (rooms.id !== 'greatHall' || !rooms.room?.set) return;
      const v = school.view();
      rooms.room.set({ points: v.totals, settle, christmas: v.christmas, ...(v.leaving && v.feasted ? { feast: true, cup: v.standings[0]?.house ?? null } : {}) });
    };
    // the leaving feast: in the Great Hall, wherever you were; the Cup’s card comes with it
    const feast = async () => {
      if (arrival.active) return null;
      const cup = school.feast();
      if (!cup) return null;
      if (rooms.id !== 'greatHall') await rooms.enter('greatHall', { props: { feast: true, points: cup.totals, cup: cup.winner } }).catch(() => null);
      dress();
      return cup;
    };
    // the night (Lane F): the dementors at the shore past the sixth week, the
    // curfew in the castle after 21:00 with Filch, his cat, the prefects and
    // Snape walking their rounds where you can see them, and the cloak
    const dementors = createDementors({ rt, scene, house, floorAt, shoreAt: inland, reduced });
    const presence = createPresence({ rt, scene, house });
    let cloaked = false;
    const wear = (on) => {
      if ((on && !school.cloak) || on === cloaked) return;
      cloaked = on;
      tell('cloak', { on });
    };
    // back to bed (caught, or fainted): your common room once it’s built, until then the boats
    const toBed = () => {
      tell('cut', {});
      wear(false);
      if (ROOMS_BUILT[school.house]) {
        rooms.enter(school.house).catch(() => {});
        return;
      }
      if (rooms.room) rooms.leave();
      walker.place(SPAWN.at, SPAWN.yaw);
      relight();
    };
    const curfew = createCurfew({ tell, onCaught: toBed });
    const COME = 'The lake has gone flat and still, and a cold is coming off it.';
    let coldWas = 0;
    const dementorsStep = (dt) => {
      const h = hours();
      const out = !rooms.room && !broom.riding;
      const events = dementors.step(dt, { week: school.week, day: Math.floor(h / 24), hour: h % 24, player: { x: walker.state.x, z: walker.state.z }, inside: out ? null : (rooms.id ?? 'broom') });
      for (const e of events) {
        if (e.type === 'come') tell('toast', { text: COME });
        else if (e.type === 'faint') {
          tell('toast', { text: e.toast });
          toBed();
        } else if (e.type === 'driven') {
          tell('toast', { text: e.toast });
          tell('driven', {});
          playNotes(rt);
        }
      }
      const cold = dementors.cold;
      ground.pace = pull(cold);
      if (Math.abs(cold - coldWas) > 0.04 || (cold === 0 && coldWas !== 0)) {
        coldWas = cold;
        tell('cold', { k: Math.round(cold * 100) / 100 });
      }
    };
    // the curfew where you are, and the watchers walking their rounds in the room you’re in
    const nightWatch = (dt) => {
      const v = night.view();
      const s = rooms.room ? rooms.walker?.state : walker.state;
      const people = night.people();
      curfew.step(dt, { hour: hours() % 24, player: { x: v.me.x, z: v.me.z, inside: v.me.inside ?? null, cloak: cloaked, lit: Boolean(wand.state().lit), running: (s?.speed ?? 0) > RUN }, figures: people, house: school.house });
      presence.step(dt, { room: rooms.id, origin: ROOM_AT, floorAt: rooms.room?.floorAt ?? (() => 0), people, night: v.night, filch: curfew.filch });
    };
    // (time on to an hour: the Menu’s “Wait for nightfall”; the clock only ever goes forward)
    const waitFor = (hour) => {
      const now = hours();
      if (afterHours(now % 24)) {
        tell('toast', { text: 'It’s dark already.' });
        return false;
      }
      const ahead = (((hour - now) % 24) + 24) % 24;
      clock += ahead * 60;
      relight();
      return true;
    };
    // Things to do’s “Go there” for the Patronus: the lesson until it’s learnt, then the water’s edge after dark
    const goTo = (id) => {
      if (id !== 'patronus') return;
      if (!school.knows('patronus')) {
        lesson('patronus');
        return;
      }
      waitFor(21.5);
      const edge = [SPAWN.at[0] + 6, SPAWN.at[1] - 8];
      walker.place(edge, SPAWN.yaw);
      tell('toast', { text: 'Down to the water’s edge, then, and wait.' });
    };

    // (the term hears everything from here on; what it says back dresses the board and the Great Hall)
    ears = (type, data) => {
      school.hear(type, data);
      if (type === 'school') board.set(data);
      if (type === 'school' || type === 'room') dress(type === 'room');
      if (type === 'patronus') dementors.patronus();
    };

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
      // (and as the dementors close, the cold drains it toward grey)
      house.set({ shadow: shade.setRGB(...light.hemi.sky, THREE.SRGBColorSpace).lerp(sky.uniforms.horizon.value, 0.4).multiplyScalar(0.95).lerp(GREY, drain(dementors.cold) * 0.85) });
      if (renderer) renderer.toneMappingExposure = light.exposure;
    };

    // the one prompt: the broom at your feet before the boats' way in
    let near = null;
    const heldAct = new Set(); // (E's codes held last step: a lesson hears it let go)
    const promptNow = () => {
      if (broom.riding) return null;
      if (nearBroom()) return 'broom';
      if (board.near(walker.state.x, walker.state.z)) return 'board';
      return nearDoor(walker.state.x, walker.state.z) ? 'door' : null;
    };
    const go = () => {
      const what = promptNow();
      if (what === 'broom') fly();
      else if (what === 'board') tell('board', {});
      else if (what === 'door') {
        tell('go', { door: { label: DOOR.label } });
        // (the boats: the arrival from the push off; Enter skips it to the steps once it has been seen)
        arrival.start('pushoff');
      }
    };
    const frame = (dt) => {
      key.position.copy(camera.position).addScaledVector(keyDir, 200);
      key.target.position.copy(camera.position);
      sky.update(camera, dt);
      shore.update(camera, dt);
      const now = promptNow();
      if (now !== near) {
        near = now;
        tell('near', { door: near === 'broom' ? { verb: 'Fly', label: 'The broom' } : near === 'board' ? { verb: 'Read', label: 'The notice board' } : near === 'door' ? { label: DOOR.label } : null });
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
        const pressed = (name) => (KEYS[name] ?? CLOAK_KEYS[name] ?? []).some((c) => input?.pressed?.has?.(c));
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
        // (inside a room: its walk and its life; Esc is the way out, back where you came in.
        // The world’s time goes on in there: the people walk, the term counts, the curfew bites)
        if (rooms.room) {
          if (pressed('menu')) world.leave();
          else rooms.step(dt, input, touch, pressed);
          if (pressed('cloak')) wear(!cloaked);
          clock += dt;
          night.step(dt);
          school.step(dt, hours());
          nightWatch(dt);
          dementorsStep(dt);
          return;
        }
        if (pressed('cloak')) wear(!cloaked);
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
        night.step(dt);
        school.step(dt, hours());
        nightWatch(dt);
        dementorsStep(dt);
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
      // the prompt's own button (a room's door while you're in one), and the touch stick
      go: () => (rooms.room ? rooms.act() : go()),
      // a word typed into the HUD's card: a password, a riddle's answer
      word: (text) => rooms.word(text),
      // into a room (rooms/host.js) and out again, back on the shore where you stood
      enter: (id, opts) => rooms.enter(id, opts),
      // the arrival: the Menu's “The arrival”, the Sorting card's answers, Enter's skip
      arrive: (at = null) => arrival.start(at),
      answer: (i) => arrival.answer(i),
      skip: () => arrival.skip(),
      arrival,
      leave() {
        // (out of a room gone into from another: back into that one)
        if (rooms.back()) return;
        world.out();
      },
      // out of the castle to the grounds, whatever room you're in, back where you stood
      out() {
        rooms.leave();
        walker.place([walker.state.x, walker.state.z], walker.state.yaw);
        relight();
      },
      rooms,
      wand,
      // the Marauder’s Map’s view of everyone (hud/MaraudersMap.jsx reads it every frame)
      map: () => night.view(),
      // the night’s: the cloak on and off (the page’s chip), and time on to an hour
      cloak: (on = !cloaked) => wear(on),
      wait: (hour = 21.5) => waitFor(hour),
      goTo,
      // the term's view for the HUD, and the leaving feast held (the Menu's, until the Great Hall holds it)
      school: () => school.view(),
      feast,
      nextYear: () => school.nextYear(Math.floor(hours() / 24)),
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
        arrival.dispose();
        rooms.dispose();
        rt.input?.unbind?.();
        if (exposureWas != null) renderer.toneMappingExposure = exposureWas;
        sky.dispose();
        lake.dispose();
        shore.dispose();
        castle.dispose();
        boats.dispose();
        board.dispose();
        dementors.dispose();
        presence.dispose();
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
      window.__HOGWARTS__ = {
        world,
        state,
        place: (x, z, yaw) => walker.place([x, z], yaw),
        dusk,
        cast: (spell, at) => wand.cast(spell, at),
        wand: () => wand.state(),
        curfew: () => curfew.state(),
        dementors: () => dementors.state(),
        presence: () => presence.info(),
        // (eye(at, look): the camera held at a point looking at another, in a room, for the checks)
        eye: (at, look) => {
          rooms.hold = true;
          if (rooms.walker) rooms.walker.place([at[0] - ROOM_AT[0], at[2] - ROOM_AT[2]], Math.atan2(-(look[0] - at[0]), -(look[2] - at[2])));
          camera.position.set(...at);
          camera.lookAt(...look);
        },
        cloak: (on) => wear(on),
        wait: (hour) => waitFor(hour),
        night: () => night.view(),
        school: () => school.view(),
        term: (w) => school.setWeek(w),
        hear: (type, data) => tell(type, data),
        fly: () => world.fly(),
        practice: () => world.practice(),
        match: (n) => world.match(n),
        lesson: (id) => world.lesson(id),
        lessons: () => lessons.state(),
        room,
        view,
        info: () => rooms.room?.info?.() ?? null,
        arrive: (at) => arrival.start(at),
        arrival: () => arrival.info(),
        answer: (i) => arrival.answer(i),
        quidditch: () => ({ ...quidditch.state(), rider: broom.rider && { p: broom.rider.p.map((v) => Math.round(v * 10) / 10), spd: Math.round(broom.rider.spd * 3.6), mode: broom.rider.mode } }),
      };
    }
    return world;
  },
};
