// Dimension C-137, the world, in WebGL: the Smiths' street (./street.js),
// the rooms and the alien street (registered in AREA_BUILDERS below), Morty
// walking about as the rigged Meshy Morty, and Rick's space cruiser, parked
// in the driveway or flown with Morty at the wheel. Toon-shaded and inked
// like the show (portal/toon.js), on lib/stage3d's renderer with
// lib/device's budget, drawn less sharp while frames come late
// (lib/three/pace).
//
// It draws what the component hands it each frame and decides nothing;
// ./rules.js has the rules.
//
// createRmWorld(canvas, { onLost }) resolves to { render(state, ms),
// resize(w, h), dispose(), lost, fx(type, data), act(area, name, ...args),
// info() }, where state is
// { area, morty: { x, z, face, speed, running }, flying, cruiser: { x, z, y,
// yaw, speed, bank }, camYaw, camPitch, near: { link, hotspot }, done, fed:
// { x, y, z, yaw, mode } (the Federation's patrol ship, as ./ship.js flies it) }.

import * as THREE from 'three';
import { createStage, disposeTree } from '../../../lib/stage3d';
import { budget, device } from '../../../lib/device';
import { createPace } from '../../../lib/three/pace';
import { InkPass, toon, toonify } from '../portal/toon';
import { createMeshyCast } from '../portal/meshyCast';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { defaultLook } from '../wardrobe/looks';
import { bodyAsset, bodyKind, dress, withWardrobe } from '../wardrobe/wear';
import { CANS, CREW, TALL, glassDome } from '../cruiser3d';
import { ARCADE, AREAS, BUILDINGS, CEILING, CRUISER, FURNITURE, HOTSPOTS, LINKS, MORTY, OUTDOOR, ROAD, TREES, behindYaw, supportAt, wallsIn } from './rules';
import { gentleRamp, kitMaterials } from './kit';
import { ROAD_Y, STREET_LIGHT, buildStreet } from './street';
import { STREET_SKY, SUN_DIR, makeSky } from './sky';
import { createFx, portalMaterial } from './fx';
import { ANNEX_LIGHT, ANNEX_SKY, buildAnnex } from './annex';
import { buildArcade } from './arcade';
import { buildGarage, buildHouse, buildSchoolRoom, buildUpstairs } from './interiors';
import { buildBasement } from './interiors/basement';
import { buildMindBlowers } from './interiors/mindblowers';
import { buildOval } from './interiors/oval';
import { buildDiner } from './interiors/diner';
import { gltfLoader } from '../../../lib/three/gltf';

export { kitMaterials };

// Each area's builder: (kit) → { group, update?(t, dt, state, camera),
// noInk?: Object3D[], light?: { sun: [colour, intensity], hemi: [sky,
// ground, intensity], fog: [colour, near, far] | null, background }, dispose?,
// actions?: { [name]: (...args) => any } } (or a promise of one). actions are
// what the component can ask of an area once it's built, through
// api.act(area, name, ...args) (the arcade's setBoard(best)). noInk is for what never stands in front of
// anything inked (a sky, glows, marks on the floor): what the ink can't see,
// it outlines what's behind straight through. Its group is drawn at the area's own place in
// rules.js's AREAS and shown only while Morty is there. An area with no
// builder gets a plain lit room (or, outdoors, plain ground under a sky).
// The kit: { renderer, models (the toon-painted GLBs by name), cast, need(names,
// { clips }) (the cast loaded once each, however many ask), mats (kitMaterials),
// tier, camera, fit (lib/device's budget), portal (the swirl's material) }.
// The rooms and the annex add theirs here.
export const AREA_BUILDERS = { street: buildStreet, house: buildHouse, upstairs: buildUpstairs, garage: buildGarage, school: buildSchoolRoom, annex: buildAnnex, arcade: buildArcade, basement: buildBasement, mindblowers: buildMindBlowers, oval: buildOval, diner: buildDiner };

// The cruiser's headlights, which are its eyes (the saucer's, in the hull's
// frame: its nose is +z): where each is, and how far round it looks out
const EYES = [
  { x: -0.79, y: 0.86, z: 1.37, turn: -0.5 },
  { x: 0.79, y: 0.86, z: 1.37, turn: 0.5 },
];
const EYES_STANDIN = EYES.map((e) => ({ ...e, y: 0.95, z: 1.45 }));

// the models the world loads (public/models/c137/), shared with the builders by name
const MODELS = ['smith-house', 'school', 'arcade', 'roy-cabinet', 'shoneys', 'limo', 'fedship'];
const MORTY_H = 1.7; // how tall Morty stands here
const SAUCER = 2.4; // the cruiser's height (it's 3.8 m across): cruiser3d.js's saucer, bigger
const K = SAUCER / TALL; // and its measurements to match
// how far round the camera may swing (radians) to get out from behind a piece of furniture
const SWING = [0.5, 1, 1.5, 2, 2.6];
const ROOM_LIGHT = { sun: [0xfff1dc, 0.7], hemi: [0xfff4e6, 0x8a7a68, 1.7], fog: null, background: 0x15110d };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V = new THREE.Vector3();

// looks: the wardrobe's ({ rick, morty }): Morty's is the one he wears here
export async function createRmWorld(canvas, { onLost, looks = null } = {}) {
  const dev = device();
  const tier = dev.tier;
  const fit = budget();
  const stage = createStage(canvas, { shadows: true, fov: 55, near: 0.3, far: 1000, exposure: 1.05, bloom: { strength: 0.55, radius: 0.45, threshold: 1.15 }, onLost });
  const { renderer, scene, camera } = stage;
  // a tone map that keeps the show's flat bright colours bright
  renderer.toneMapping = THREE.NeutralToneMapping;
  stage.grade({ contrast: 0.06, saturation: 1.12, vignette: 0.12, grain: 0.008, shadow: [0, 0.004, 0.012], high: [0.012, 0.008, 0] });
  renderer.info.autoReset = false; // counted over the whole frame, every pass
  const big = Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800) >= 700;

  // ── light ──
  const hemi = new THREE.HemisphereLight(0xd6f0ff, 0x6a9a4a, 1.3);
  const sun = new THREE.DirectionalLight(0xfff3df, 2.4);
  const sunDir = SUN_DIR; // (the sky's sun is where the light comes from)
  sun.castShadow = renderer.shadowMap.enabled;
  sun.shadow.mapSize.set(fit.shadowMap, fit.shadowMap);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const fx = createFx();
  scene.add(fx.group);
  const mats = kitMaterials(renderer);

  // ── the models and the cast ──
  const loader = gltfLoader();
  // (figures out of view aren't drawn: a skinned mesh's bounds don't follow its pose)
  const cast = createMeshyCast(withWardrobe({ cull: true })); // (any body the wardrobe has, for Morty)
  // each of the cast loaded once, however many builders ask, at the same time
  // or not (the clips of the first ask for a name are the ones it gets)
  const asked = new Map();
  const need = (names, { clips = ['idle', 'walk', 'run'] } = {}) =>
    Promise.all(
      names.map((n) => {
        if (!asked.has(n)) asked.set(n, cast.load(null, [n], { clips }));
        return asked.get(n);
      }),
    );
  const [loaded] = await Promise.all([
    Promise.all(MODELS.map((n) => loader.loadAsync(`/models/c137/${n}.glb`).then((g) => [n, toonify(g.scene, { gradientMap: gentleRamp(), aniso: fit.aniso, dispose: true })], () => [n, null]))),
    need(['morty', 'saucer', bodyAsset(looks?.morty ?? defaultLook('morty'))], { clips: ['idle', 'walk', 'run', 'sit'] }),
  ]);
  const models = new Map(loaded);

  // ── the areas ──
  const kit = { renderer, models, cast, need, mats, tier, camera, fit, portal: portalMaterial };
  const areas = {};
  const building = {};
  const build = async (id) => {
    const make = AREA_BUILDERS[id] ?? (OUTDOOR.includes(id) ? plainGround : plainRoom);
    let a = null;
    try {
      a = await make(kit, id);
    } catch (err) {
      if (import.meta.env.DEV) console.warn(`C-137: the ${id} builder failed`, err);
      a = (OUTDOOR.includes(id) ? plainGround : plainRoom)(kit, id);
    }
    a.group.visible = false;
    scene.add(a.group);
    areas[id] = a;
    return a;
  };
  await Promise.all(Object.keys(AREA_BUILDERS).map(build));

  // ── Morty, walking, and sat at the cruiser's wheel, as the wardrobe has him ──
  let look = looks?.morty ?? defaultLook('morty');
  const makeMorty = (l) => cast.make(bodyKind(l)) ?? cast.make('morty');
  let morty = makeMorty(look) ?? standInMorty();
  morty.group.scale.setScalar(MORTY_H / (morty.height ?? MORTY_H));
  scene.add(morty.group);
  let undress = dress(morty, look);
  const mortyShadow = fx.blob(0.55);

  // others online in the street (RmWorld's useTravellers), as the Middle-earth
  // towns and the Avengers compound show theirs: each a Morty from another
  // dimension, pale and shimmering, with their name over him. In the street
  // or a room, whichever you're in (only those in it are listed; up in the
  // cruiser they're not shown), and nothing here touches them, nor they
  // anything here.
  const ghosts = createGhosts({
    height: (x, z) => (shown === 'street' && Math.abs(z - ROAD.z) < ROAD.w / 2 ? ROAD_Y : 0),
    make: () => {
      const c = cast.make('morty');
      const fig = c ?? standInMorty();
      fig.group.scale.setScalar(MORTY_H / (fig.height ?? MORTY_H));
      fig.group.rotation.y = Math.PI / 2; // (a ghost's face, like Morty's, is measured from +x; a figure faces +z)
      const group = new THREE.Group();
      group.add(fig.group);
      // (a Meshy Morty's mesh and materials are the cast's: not the ghost's to dispose)
      return c ? { group, top: MORTY_H, morty: c, shared: true, dispose: () => c.mixer?.stopAllAction() } : { group, top: MORTY_H, morty: fig };
    },
    animate: (f, t, p) => f.morty.update?.(t, clamp((p.speed ?? (p.moving ? MORTY.walk : 0)) / MORTY.run, 0, 1), 0),
    tag: 0.34,
    halo: 0.9,
  });
  scene.add(ghosts.group);

  const cruiser = new THREE.Group();
  cruiser.rotation.order = 'YXZ';
  const hull = new THREE.Group();
  hull.position.y = -SAUCER / 2;
  cruiser.add(hull);
  const saucer = cast.prop('saucer', SAUCER);
  if (saucer) {
    hull.add(saucer);
    glassDome(saucer);
  } else hull.add(standInSaucer(mats));
  // Morty at the wheel (where cruiser3d.js sits Rick), sat, as big as he'd be beside him
  const seatPilot = (l) => {
    const p = makeMorty(l);
    if (!p) return null;
    p.group.scale.setScalar((CREW.morty[0] * K) / p.height);
    p.group.position.set(CREW.rick[1] * K, CREW.y * K, CREW.z * K);
    for (const [n, a] of Object.entries(p.act ?? {})) a.setEffectiveWeight(n === 'sit' ? 1 : 0);
    hull.add(p.group);
    p.undress = dress(p, l);
    return p;
  };
  let pilot = seatPilot(look);
  // the exhaust cans' glow, at the back
  const glowMat = new THREE.SpriteMaterial({ map: fx.spot, color: new THREE.Color(0x9dff6a).multiplyScalar(2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = CANS.map(([x, y, z]) => {
    const g = new THREE.Sprite(glowMat);
    g.position.set(x * K, y * K, z * K);
    hull.add(g);
    return g;
  });
  const eyes = shipEyes(hull, saucer ? EYES : EYES_STANDIN);
  scene.add(cruiser);
  const cruiserShadow = fx.blob(2.1);

  // the doors' rings and where a hotspot is
  for (const l of LINKS) fx.markAt(l.id, l.x, l.area === 'street' && Math.abs(l.z) < ROAD.w / 2 ? ROAD_Y : 0, l.z).userData.area = l.area;
  const marks = [...fx.marks];
  const hotspots = new Map(HOTSPOTS.map((h) => [h.id, h]));

  // the ink: none on the effects, the exhaust or what each area leaves out
  // (its sky), and thinning out into the distance as the show draws its
  // backgrounds, with no line along the horizon
  const unInked = {};
  const ink = new InkPass(scene, camera, { hide: () => unInked[shown] ?? glows, width: big ? 1.35 : 1.05, fade: [110, 300] });
  stage.composer.insertPass(ink, 1);

  // ── the camera ──
  const cam = { at: new THREE.Vector3(), look: new THREE.Vector3(), area: null, flying: null };
  const want = { at: new THREE.Vector3(), look: new THREE.Vector3() };
  // how far from the head to the camera it can go before it's inside a
  // building or a tree (outdoors), or through a wall or into the furniture
  // (indoors), as a share
  const solid = { street: BUILDINGS, annex: [ARCADE] };
  const parked = { x: 0, z: 0, on: false }; // the cruiser, while it stands in the street
  // a room's furniture as boxes, turned as they stand (each a little bigger,
  // but by less than Morty's radius, so where he stands is never inside one)
  const pieces = {};
  for (const f of FURNITURE) (pieces[f.area] ??= []).push({ x: f.x, z: f.z, hw: f.w / 2 + 0.3, hd: f.d / 2 + 0.3, top: f.h + 0.3, c: Math.cos(f.turn), s: Math.sin(f.turn) });
  const inPiece = (area, x, y, z) => {
    const list = pieces[area];
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (y > f.top) continue; // (over a table or a bed, the camera can look down past it)
      const dx = x - f.x;
      const dz = z - f.z;
      if (Math.abs(dx * f.c - dz * f.s) < f.hw && Math.abs(dx * f.s + dz * f.c) < f.hd) return true;
    }
    return false;
  };
  // what's at (x, y, z): 0 nothing, 1 something, 2 the parked cruiser (which
  // the camera can rise over), 3 a piece of furniture (which it can swing round)
  const blocked = (area, x, y, z) => {
    if ((solid[area] ?? []).some((b) => y < b.roof + 0.5 && Math.abs(x - b.x) < b.w / 2 + 0.35 && Math.abs(z - b.z) < b.d / 2 + 0.35)) return 1;
    if (inPiece(area, x, y, z)) return 3;
    if (area !== 'street') return 0;
    if (TREES.some((tr) => y < 8 * tr.s && Math.hypot(x - tr.x, z - tr.z) < 0.45 * tr.s + 0.35)) return 1;
    if (!parked.on) return 0;
    // its hull, and the dome on it
    const d = Math.hypot(x - parked.x, z - parked.z);
    return (d < CRUISER.radius + 0.3 && y < SAUCER * 0.8) || (d < CRUISER.radius * 0.68 && y < SAUCER * 1.17) ? 2 : 0;
  };
  const crossesWall = (area, ax, az, bx, bz) =>
    wallsIn(area).some(([x0, z0, x1, z1, , low]) => {
      if (low) return false;
      const d1 = (bx - ax) * (z0 - az) - (bz - az) * (x0 - ax);
      const d2 = (bx - ax) * (z1 - az) - (bz - az) * (x1 - ax);
      const d3 = (x1 - x0) * (az - z0) - (z1 - z0) * (ax - x0);
      const d4 = (x1 - x0) * (bz - z0) - (z1 - z0) * (bx - x0);
      return d1 * d2 < 0 && d3 * d4 < 0;
    });
  // where the walking camera wants to be, `turn` round Morty (indoors, kept in the room)
  const aim = (area, m, turn, pitch, dist) => {
    want.at.set(m.x + Math.sin(turn) * Math.cos(pitch) * dist, eyeY + 1.5 + Math.sin(pitch) * dist, m.z + Math.cos(turn) * Math.cos(pitch) * dist);
    if (OUTDOOR.includes(area)) return;
    const a = AREAS[area];
    want.at.x = clamp(want.at.x, a.x0 + 0.3, a.x1 - 0.3);
    want.at.z = clamp(want.at.z, a.z0 + 0.3, a.z1 - 0.3);
    want.at.y = Math.min(want.at.y, CEILING[area] - 0.25);
  };
  let hitBy = 0; // what clearance() last stopped at
  const clearance = (area, from, to) => {
    const N = 16;
    hitBy = 0;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      const x = from.x + (to.x - from.x) * k;
      const y = from.y + (to.y - from.y) * k;
      const z = from.z + (to.z - from.z) * k;
      hitBy = blocked(area, x, y, z) || (!OUTDOOR.includes(area) && crossesWall(area, from.x, from.z, x, z) ? 1 : 0);
      if (hitBy) return Math.max(0.2, (i - 1) / N);
    }
    return 1;
  };

  // ── per-area light ──
  let shown = null;
  const fog = new THREE.Fog(0xffffff, 1e4, 2e4); // one, so a room without fog doesn't recompile every shader
  scene.fog = fog;
  const showArea = (id) => {
    if (!areas[id]) {
      building[id] ??= build(id); // (a plain one, built on the way in)
      return false;
    }
    for (const [k, a] of Object.entries(areas)) a.group.visible = k === id;
    unInked[id] ??= [fx.group, ...glows, ...(areas[id].noInk ?? [])];
    const L = areas[id].light ?? (OUTDOOR.includes(id) ? ANNEX_LIGHT : ROOM_LIGHT);
    sun.color.set(L.sun[0]);
    sun.intensity = L.sun[1];
    hemi.color.set(L.hemi[0]);
    hemi.groundColor.set(L.hemi[1]);
    hemi.intensity = L.hemi[2];
    if (L.fog) {
      fog.color.set(L.fog[0]);
      fog.near = L.fog[1];
      fog.far = L.fog[2];
    } else {
      fog.near = 1e4;
      fog.far = 2e4;
    }
    scene.background = L.background != null ? new THREE.Color(L.background) : null;
    for (const m of fx.marks.values()) m.visible = m.userData.area === id;
    shown = id;
    return true;
  };

  // every shader compiled before the first frame, an area at a time (each
  // with its own lights, which pick which shaders the materials need)
  for (const id of Object.keys(areas)) {
    showArea(id);
    await stage.precompile();
  }
  shown = null;

  // ── each frame ──
  const pace = createPace();
  const pending = []; // effects asked for, for the next frame
  let sharp = 1;
  let t = 0;
  let mortyY = 0;
  let groundY = 0; // the ground under him (the road's a little lower)
  let standY = 0; // what he stands on over it, eased: the camera's level, which doesn't bob with his jumps
  let eyeY = 0;
  let craftY = CRUISER.hover;
  const render = (state, ms = 16) => {
    if (stage.lost || stage.disposed) return;
    const now = performance.now();
    const s = pace.frame(now);
    if (s !== null) {
      sharp = s;
      resize(stage.size.w, stage.size.h);
    }
    const dt = Math.min(0.1, ms / 1000);
    t += dt;
    const area = state.area ?? 'street';
    if (area !== shown && !showArea(area)) return;
    const jump = cam.area !== area || cam.flying !== !!state.flying;
    const outdoors = area === 'street';

    // Morty
    const m = state.morty;
    const ground = outdoors && Math.abs(m.z - ROAD.z) < ROAD.w / 2 ? ROAD_Y : 0;
    groundY = jump ? ground : groundY + (ground - groundY) * Math.min(1, dt * 14);
    const stand = supportAt(area, m.x, m.z, m.y ?? 0);
    standY = jump ? stand : standY + (stand - standY) * Math.min(1, dt * 6);
    mortyY = groundY + (m.y ?? 0);
    eyeY = groundY + standY;
    ghosts.update(state.travellers ?? [], t, dt);
    morty.group.visible = !state.flying;
    morty.group.position.set(m.x, mortyY, m.z);
    morty.group.rotation.y = (m.face ?? 0) + Math.PI / 2;
    morty.update?.(t, clamp((m.speed ?? 0) / MORTY.run, 0, 1), 0);
    mortyShadow.visible = morty.group.visible;
    mortyShadow.position.set(m.x, groundY + stand + 0.02, m.z);

    // the cruiser: in the street only; its pilot only while flying; its
    // height eased over the step its floor makes at a roof's edge
    const c = state.cruiser;
    cruiser.visible = outdoors && !!c;
    if (c && outdoors) {
      craftY = jump ? c.y : craftY + (c.y - craftY) * Math.min(1, dt * (c.y > craftY ? 10 : 4));
      const bob = Math.sin(t * 2.2) * (state.flying ? 0.12 : 0.05);
      cruiser.position.set(c.x, craftY + 0.15 + bob, c.z);
      cruiser.rotation.set(-clamp((c.vy ?? 0) * 0.03, -0.22, 0.22), c.yaw ?? 0, -(c.bank ?? 0));
      // its eyes: on Morty while it's parked, ahead while it flies, narrowed flat out
      eyes.update(t, dt, state.flying ? null : m, Math.abs(c.speed ?? 0) / CRUISER.top);
      if (pilot) {
        pilot.group.visible = !!state.flying;
        pilot.mixer?.update(dt);
      }
      glowMat.opacity = 0.7 + Math.sin(t * 19) * 0.15;
      for (let i = 0; i < glows.length; i++) {
        glows[i].visible = !!state.flying;
        glows[i].scale.setScalar(0.5 + Math.sin(t * 13 + i * 2) * 0.05);
      }
      const hy = cruiser.position.y;
      cruiserShadow.visible = true;
      cruiserShadow.position.set(c.x, Math.abs(c.z - ROAD.z) < ROAD.w / 2 ? ROAD_Y + 0.03 : 0.03, c.z);
      cruiserShadow.scale.setScalar(clamp(1 - (hy - 1.4) / 40, 0.4, 1));
      cruiserShadow.material.opacity = clamp(0.4 - (hy - 1.4) / 60, 0.08, 0.4);
    } else cruiserShadow.visible = false;
    parked.on = !!c && outdoors && !state.flying;
    if (parked.on) {
      parked.x = c.x;
      parked.z = c.z;
    }

    // the rings at the doors, the marker over what you're next to
    const link = state.near?.link;
    for (let i = 0; i < marks.length; i++) marks[i][1].userData.near = marks[i][0] === link;
    const spot = state.near?.hotspot && hotspots.get(state.near.hotspot);
    fx.pin.visible = !!spot && spot.area === area && !state.flying;
    if (fx.pin.visible) {
      fx.pin.position.x = spot.x;
      fx.pin.position.z = spot.z;
      fx.pin.userData.y = 2.3;
    }

    // the camera: behind Morty at the component's yaw, or chasing the cruiser
    if (state.flying && c && outdoors) {
      const fx0 = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      want.at.set(c.x - fx0 * 12.5, craftY + 4.6, c.z - fz * 12.5);
      want.look.set(c.x + fx0 * 6, craftY + 0.2, c.z + fz * 6);
    } else {
      const yaw = state.camYaw ?? behindYaw(m.face ?? 0);
      const pitch = clamp(state.camPitch ?? 0.17, -0.25, 1.2);
      const dist = outdoors || OUTDOOR.includes(area) ? 5.6 : 3.6;
      // (looking a little over his head, so more of the street is in view)
      want.look.set(m.x, Math.min(eyeY + 1.75, CEILING[area] - 0.2), m.z);
      // indoors: kept in the room first, then pulled in front of whatever's in the way
      aim(area, m, yaw, pitch, dist);
      let k = clearance(area, want.look, want.at);
      // backed up against a piece of furniture: round to the side that's clear
      // (the side the camera is on now, first) rather than into it
      if (hitBy === 3 && k < 0.5) {
        const now = Math.atan2(cam.at.x - m.x, cam.at.z - m.z) - yaw;
        const side = Math.sin(now) < 0 ? -1 : 1;
        let best = k;
        let bestYaw = yaw;
        for (let i = 0; i < SWING.length && best < 0.5; i++)
          for (let j = 0; j < 2; j++) {
            const dir = j ? -side : side;
            aim(area, m, yaw + dir * SWING[i], pitch, dist);
            const k2 = clearance(area, want.look, want.at);
            if (k2 > best + 1e-3) {
              best = k2;
              bestYaw = yaw + dir * SWING[i];
            }
          }
        aim(area, m, bestYaw, pitch, dist);
        k = clearance(area, want.look, want.at);
      }
      // only the parked cruiser in the way: up over it, rather than in close
      for (let i = 0; i < 8 && hitBy === 2; i++) {
        want.at.y += 0.75;
        k = clearance(area, want.look, want.at);
      }
      if (k < 1) want.at.lerpVectors(want.look, want.at, k);
      want.at.y = Math.max(want.at.y, eyeY + 0.4);
    }
    const ease = jump ? 1 : 1 - Math.exp(-dt * (state.flying ? 4.5 : 10));
    cam.at.lerp(want.at, ease);
    cam.look.lerp(want.look, ease);
    cam.area = area;
    cam.flying = !!state.flying;
    camera.position.copy(cam.at);
    camera.lookAt(cam.look);

    // the sun's shadows follow whoever you are
    const focus = state.flying && c ? V.set(c.x, 0, c.z) : V.set(m.x, 0, m.z);
    sun.target.position.copy(focus);
    sun.position.copy(focus).addScaledVector(sunDir, 70);
    sun.castShadow = renderer.shadowMap.enabled;

    // effects asked for since the last frame, where everyone is now
    for (let i = 0; i < pending.length; i++) fire(pending[i][0], pending[i][1]);
    pending.length = 0;
    areas[area].update?.(t, dt, state, camera);
    if (fx.portal.visible) fx.portal.rotation.y = Math.atan2(camera.position.x - fx.portal.position.x, camera.position.z - fx.portal.position.z);
    fx.update(dt, t);
    renderer.info.reset();
    stage.render(ms);
  };

  // drawn a step less sharp than the stage's own ratio while pace says so
  const resize = (w, h) => {
    stage.resize(w, h);
    if (sharp < 1) {
      const pr = renderer.getPixelRatio() * sharp;
      renderer.setPixelRatio(pr);
      renderer.setSize(stage.size.w, stage.size.h, false);
      stage.composer.setPixelRatio(pr);
      stage.composer.setSize(stage.size.w, stage.size.h);
    }
  };

  const fire = (type, d) => {
    const m = morty.group.position;
    if (type === 'done') fx.burst(m.x, m.y + 2.1, m.z, 110, 4.5);
    else if (type === 'portal') {
      const p = d.at ?? { x: m.x, z: m.z };
      fx.openPortal(p.x, p.z, 0);
    } else if (type === 'board') {
      fx.ring(cruiser.position.x, 0, cruiser.position.z, 0x9dff5a, 3.5, 0.6);
      fx.burst(cruiser.position.x, cruiser.position.y + 0.6, cruiser.position.z, 40, 3);
    } else if (type === 'land') fx.ring(cruiser.position.x, 0, cruiser.position.z, 0xf2efe6, 6, 0.9);
  };
  const fxEvent = (type, d = {}) => {
    if (pending.length < 16) pending.push([type, d]);
  };

  // a new look from the wardrobe: Morty made again in it, where he was, and
  // at the wheel
  const setLooks = async (next) => {
    const l = next?.morty;
    if (!l || JSON.stringify(l) === JSON.stringify(look)) return;
    look = l;
    await need([bodyAsset(l)], { clips: ['idle', 'walk', 'run', 'sit'] });
    if (stage.disposed || look !== l) return;
    const was = morty;
    const fresh = makeMorty(l);
    if (fresh) {
      undress();
      fresh.group.scale.setScalar(MORTY_H / fresh.height);
      fresh.group.position.copy(was.group.position);
      fresh.group.rotation.copy(was.group.rotation);
      fresh.group.visible = was.group.visible;
      was.group.removeFromParent();
      scene.add(fresh.group);
      morty = fresh;
      undress = dress(morty, l);
    }
    if (pilot) {
      pilot.undress?.();
      pilot.group.removeFromParent();
    }
    pilot = seatPilot(l);
  };

  const api = {
    render,
    resize,
    fx: fxEvent,
    setLooks,
    // an area builder's own action, if it has one (the arcade's setBoard(best)); nothing otherwise
    act(area, name, ...args) {
      const actions = areas[area]?.actions;
      return actions && Object.hasOwn(actions, name) ? actions[name](...args) : undefined;
    },
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, sharp, tier, models: MODELS.filter((n) => models.get(n)), cast: !!saucer };
    },
    get lost() {
      return stage.lost;
    },
    dispose() {
      if (stage.disposed) return;
      for (const a of Object.values(areas)) a.dispose?.();
      ghosts.dispose();
      // models a builder never put in the scene
      for (const o of models.values()) if (o && !o.parent) disposeTree(o);
      fx.dispose();
      ink.dispose(); // (the composer doesn't free its passes)
      glowMat.dispose();
      saucer?.traverse((o) => o.userData.glass?.dispose());
      cast.dispose();
      mats.dispose();
      stage.dispose();
      if (import.meta.env.DEV && window.__C137__?.api === api) delete window.__C137__;
    },
  };
  if (import.meta.env.DEV) window.__C137__ = { ...(window.__C137__ ?? {}), api, scene };
  return api;
}

// ── stand-ins and plain areas ──

// A room with nothing in it yet: floor and walls, at the area's place, lit
// by the room light (no lamp of its own: a light more or less makes every
// material's shader change).
function plainRoom(kit, id) {
  const a = AREAS[id];
  const group = new THREE.Group();
  const w = a.x1 - a.x0;
  const d = a.z1 - a.z0;
  const cx = (a.x0 + a.x1) / 2;
  const cz = (a.z0 + a.z1) / 2;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), kit.mats.floor(0xc4a77a));
  floor.position.set(cx, -0.05, cz);
  floor.receiveShadow = true;
  group.add(floor);
  const wallMat = kit.mats.wall(0xe9dfc8);
  for (const [x, z, ww, dd] of [[cx, a.z0, w, 0.2], [cx, a.z1, w, 0.2], [a.x0, cz, 0.2, d], [a.x1, cz, 0.2, d]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, 2.8, dd), wallMat);
    wall.position.set(x, 1.4, z);
    wall.receiveShadow = true;
    group.add(wall);
  }
  return { group, light: ROOM_LIGHT };
}

// Outdoors with nothing built yet: ground under its own sky.
function plainGround(kit, id) {
  const a = AREAS[id];
  const group = new THREE.Group();
  const sky = makeSky(560, id === 'street' ? STREET_SKY : { ...ANNEX_SKY, moons: 1 }); // (the annex's builder draws its own moons; this one borrows the sky's)
  group.add(sky.dome);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), kit.mats.floor(id === 'street' ? 0x62b347 : 0x7b5aa6));
  ground.position.set((a.x0 + a.x1) / 2, 0, (a.z0 + a.z1) / 2);
  ground.receiveShadow = true;
  group.add(ground);
  return { group, noInk: [sky.dome], light: id === 'street' ? STREET_LIGHT : ANNEX_LIGHT, update: (t, dt, s, camera) => sky.update(t, camera) };
}

// Morty in shapes, if his model won't load: yellow shirt, blue trousers.
function standInMorty() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const part = (geo, color, x, y, z) => {
    const mesh = new THREE.Mesh(geo, toon(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  const legs = [-0.12, 0.12].map((x) => part(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), 0x3b5fa8, x, 0.38, 0));
  part(new THREE.CapsuleGeometry(0.24, 0.36, 4, 10), 0xf2d23c, 0, 0.98, 0);
  const arms = [-1, 1].map((s) => {
    const a = part(new THREE.CapsuleGeometry(0.07, 0.45, 4, 8), 0xf2d23c, s * 0.3, 1.0, 0);
    a.rotation.z = s * 0.25;
    return a;
  });
  part(new THREE.SphereGeometry(0.27, 16, 12), 0xf6d2b0, 0, 1.48, 0);
  part(new THREE.IcosahedronGeometry(0.29, 1), 0x6b3a1e, 0, 1.56, -0.05).scale.set(1, 0.8, 1);
  // his eyes: white, round, a dot in each
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.075, 10, 8), 0xffffff, s * 0.09, 1.5, 0.23);
    part(new THREE.SphereGeometry(0.02, 6, 4), 0x111111, s * 0.09, 1.5, 0.3);
  }
  return {
    group,
    body,
    height: 1.78,
    update(t, move) {
      legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 9 + i * Math.PI) * 0.5 * move));
      arms.forEach((a, i) => (a.rotation.x = -Math.sin(t * 9 + i * Math.PI) * 0.5 * move));
      body.position.y = Math.abs(Math.sin(t * 9)) * 0.05 * move;
    },
  };
}

// A saucer in shapes, if its model won't load: hull, rim and dome.
function standInSaucer(mats) {
  const g = new THREE.Group();
  const hullMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.9, 0.9, 24), mats.toon(0xa0a6ad));
  hullMesh.position.y = 0.75;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass);
  dome.position.y = 1.2;
  for (const o of [hullMesh, dome]) {
    o.castShadow = true;
    g.add(o);
  }
  return g;
}

// The cruiser's eyes: its headlights, pale yellow and glowing, with dark
// pupils. update(t, dt, at, fast): they turn to look at `at` ({ x, z }, Morty)
// or ahead, blink now and then, and narrow as `fast` (its share of top speed)
// nears one.
function shipEyes(hull, spots) {
  const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2b8).multiplyScalar(1.25) });
  const black = new THREE.MeshBasicMaterial({ color: 0x15121a });
  const ball = new THREE.SphereGeometry(0.24, 16, 10);
  const dot = new THREE.SphereGeometry(0.11, 12, 8);
  const eyes = spots.map((e) => {
    const g = new THREE.Group();
    g.position.set(e.x, e.y, e.z);
    g.rotation.y = e.turn;
    const w = new THREE.Mesh(ball, white);
    w.scale.z = 0.55;
    const p = new THREE.Mesh(dot, black);
    p.position.z = 0.12;
    p.scale.z = 0.4;
    g.add(w, p);
    hull.add(g);
    return { g, p, turn: e.turn };
  });
  const look = { x: 0, y: 0 };
  const v = new THREE.Vector3();
  let blinkAt = 3;
  return {
    update(t, dt, at, fast) {
      // where to look, in the hull's frame: Morty, or straight ahead
      let wx = 0;
      let wy = 0;
      if (at) {
        hull.updateWorldMatrix(true, false);
        v.set(at.x, 1.2, at.z);
        hull.worldToLocal(v);
        const d = Math.hypot(v.x, v.z) || 1;
        wx = clamp(v.x / d, -1, 1);
        wy = clamp((v.y - 0.9) / d, -0.6, 0.6);
        if (v.z < -0.5) wx = Math.sign(wx || 1); // (behind it: as far round as it goes)
      }
      look.x += (wx - look.x) * Math.min(1, dt * 6);
      look.y += (wy - look.y) * Math.min(1, dt * 6);
      // a blink every few seconds
      if (t > blinkAt + 0.16) blinkAt = t + 2.5 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) * 2.2;
      const shut = t > blinkAt ? 0.08 : 1;
      const open = shut * (1 - clamp((fast - 0.6) / 0.4, 0, 1) * 0.5);
      for (const e of eyes) {
        e.g.scale.y = open;
        e.p.position.x = look.x * 0.11 - Math.sin(e.turn) * 0.03;
        e.p.position.y = look.y * 0.1;
      }
    },
  };
}
