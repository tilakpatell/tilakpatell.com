// The Graysons' city in 3D, to fly about as Invincible: the land and the
// water (./ground.js), the city (./city.js), Mark (the page's HD figure,
// posed every frame by lib/three/rig: standing, walking, running, hanging
// in the air, flat out with a fist ahead, down on one knee after a hard
// landing), his father keeping an eye on the city from over downtown, and
// what flying leaves behind (./fx.js). The rules (./flight.js) say where
// he is; this draws it, with a camera behind him that pulls back and
// widens with speed and never ends up inside a building (nor, with a wall
// right behind him, inside him: it swings off the wall instead), and a light
// from over its shoulder, so he's never a dark shape on a dark street.

import * as THREE from 'three';
import { createStage } from '../../avengers/hq/stage';
import { createFeel, feelGroups } from '../../avengers/hq/feel';
import { createSpring, springGroups } from '../../../lib/spring';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { CAST, asset } from '../cast';
import { createChallenges } from './challenges';
import { DAD, newDad, stepDad } from './companions';
import { buildCity } from './city';
import { anyOf, standing } from './foes';
import { createVillains } from './villains';
import { createFlightFx } from './fx';
import { buildGround } from './ground';
import { buildJet } from './jet';
import { buildLandmarks } from './landmarks';
import { buildLife } from './life';
import { LINES } from './lines';
import { createNpcs } from './npcs';
import { buildClouds, buildHaze, skyBands } from './sky';
import { carAt, createTraffic, stepTraffic } from './traffic';
import { CITY, WORLD, buildWorld, groundAt, near } from './map';
import { BODIES, altitudeOf } from './orbit';
import { castMaterial, loadCast, setCastRim } from './people';
import { groundWorld } from '../../../lib/three/groundwork';
import { LOOK as ART } from './look';
import { createCourse, createMarker, loadProps } from './missionScene';
import { createOnlineGhosts } from './onlineScene';
import { createSpaceScene } from './spaceScene';
import { VILLAIN_EV, villainFeel } from './villainScene';
import { GUARD, HOLD_UP, brawlFeel } from './brawlScene';

const FOV = 64;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
const luma = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

// the times of day: the sky, how it sits, the light, the haze, the night,
// the light that follows Mark (`spot`) and the rim round the cast (`rim`).
// The haze takes the sky photo's colour at the horizon (skyBands); a fog's
// `tint` or `color` is only for a photo that can't be read.
export const TIMES = ['noon', 'dusk', 'night'];
const LOOK = {
  noon: { sky: 'noon', rotate: 0.6, env: 1.15, bg: 1, sun: 4.2, fill: 0.3, fog: { density: 0.00026, tint: 0.95 }, night: 0, exposure: 1, spot: 0, rim: 0.35, cloud: { lit: [1, 1, 1], shade: [0.62, 0.66, 0.74] } },
  dusk: { sky: 'dusk', rotate: 2.2, env: 0.62, bg: 1, sun: 2.6, sunColor: [1, 0.66, 0.4], fill: 0.16, fog: { density: 0.0003, tint: 0.7 }, night: 0.5, exposure: 1, spot: 20, rim: 0.7, cloud: { lit: [1, 0.74, 0.52], shade: [0.42, 0.36, 0.42] } },
  night: { sky: 'night', rotate: 0, env: 0.22, bg: 0.2, sun: 0.7, sunDir: [-0.3, 0.75, -0.4], sunColor: [0.62, 0.72, 1], fill: 0.4, fog: { density: 0.00024, color: new THREE.Color(0.05, 0.06, 0.08) }, night: 1, exposure: 1, spot: 45, rim: 1.2, cloud: { lit: [0.14, 0.16, 0.22], shade: [0.06, 0.07, 0.1], opacity: 0.7 } },
};

// The camera hovering or standing: `back` metres behind him, `pull` more
// flat out (the pull-back with speed, as it was), aimed so his feet sit
// `feet` of the screen's height up from its bottom. Close enough that he's
// a third of the frame tall, the one thing on it the player has to find
// (at FOV 64 that's 3.6 m; from further his black and blue were a few
// pixels wide against the street). Leaning into a flight, it aims `ahead`
// metres past him instead, as it always has (his feet trail behind him then).
const CAM = { back: 3.6, pull: 1.5, feet: 0.35, ahead: 4, over: 0.9, overFoot: 0.7 };

// His suit: the atlas's black, raised to `floor` (people.js castMaterial),
// the show's navy, which keeps his arms and legs on a dark street or at night.
const SUIT = { floor: 0x2a3754 };

// The light that follows him: from over the camera's shoulder, `back`
// metres toward the camera and `up` over his chest, at his chest. Warm
// white, `range` metres, so it lights him, and the street in a disc round
// his feet when he's down near it, and not the city. Never off, only dark
// (its intensity is the time's `spot`): a light switched on and off would
// recompile every lit material in the city at the turn of the time.
const SPOT = { color: 0xffeedd, range: 12, angle: 0.5, penumbra: 0.6, back: 2, up: 2.2, chest: 1.25 };

// Down on one knee, a fist on the ground: how a hard landing ends.
const LAND = {
  thighL: [0.1, -0.3, 0.95],
  calfL: [0.05, -1, -0.05],
  footL: [0, -0.3, 1],
  thighR: [-0.1, -1, -0.2],
  calfR: [-0.05, -0.12, -1],
  footR: [0, -0.2, -1],
  armR: [-0.15, -1, 0.4],
  foreR: [-0.05, -1, 0.1],
  armL: [0.65, -0.15, -0.7],
  foreL: [0.5, 0.15, -0.85],
  torso: { pitch: 0.55, yaw: 0.1, roll: 0 },
};

// a ray against a box: how far along (0…1) it first goes in, or 1
function rayBox(o, d, b) {
  let t0 = 0;
  let t1 = 1;
  const lo = [b.x0, b.y0, b.z0];
  const hi = [b.x1, b.y1, b.z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return 1;
      continue;
    }
    let ta = (lo[a] - o[a]) / d[a];
    let tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return 1;
  }
  return t0;
}

export async function createInvWorld(rt, { onSlow, calm = false } = {}) {
  const engine = createStage(rt, { exposure: 1, fov: FOV, near: 0.3, far: 26000, bloom: ART.bloom, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  const world = buildWorld();

  const ground = buildGround(world, { small });
  const city = buildCity(world, { small });
  const landmarks = await buildLandmarks(world, city.uniforms);
  scene.add(ground.group, city.group, landmarks.group);
  // who's about, the clouds, and the airliner going round
  // (the HD figures for those the cast has; the kit's people for the rest)
  const people = await loadCast(['eve', 'debbie', 'cecil', 'allen', 'civA', 'civB', 'civC', 'mauler', 'seismic']);
  const npcs = createNpcs(scene, world, people);
  const clouds = buildClouds({ small });
  scene.add(clouds.mesh);
  // (and high up, the sky in the haze's colours over the photo: ./sky.js)
  const hazeSky = buildHaze();
  scene.add(hazeSky.mesh);
  const jet = buildJet();
  scene.add(jet.group);
  // the traffic and the people on the pavements, always round the camera
  let traffic = createTraffic({ cars: small ? 260 : 420, walkers: small ? 160 : 260 });
  const life = buildLife(traffic);
  scene.add(life.group);
  // (a shadow box this big wants more bias than the HQ games' rooms)
  engine.sun.shadow.normalBias = 0.12;
  engine.sun.shadow.bias = -0.0006;
  // the city's sky, baked into its streets (after Bruno Simon's folio:
  // lib/three/groundwork): the towers darken the canyons between them and
  // the land at their feet, soft, city-wide, and the lowest storeys take the
  // street's colour. The sun keeps its own shadow pass round Mark: a city
  // this size, flown over this fast, outruns one sun's mask.
  const land = ground.group.getObjectByName('land');
  const skyLight = land
    ? groundWorld({
        renderer: engine.renderer,
        scene,
        floor: [land],
        area: { x0: CITY.x0 - 120, z0: CITY.z0 - 120, w: CITY.x1 - CITY.x0 + 240, d: CITY.z1 - CITY.z0 + 240 },
        sun: engine.sun,
        casters: [city.group, landmarks.group],
        keepShadows: true,
        shade: 0x2a2c34,
        bounce: { color: 0x8a8478, strength: 0.4 },
        tier: engine.tier,
      })
    : null;
  skyLight?.bake();

  // ── the people ──
  const [markT, omniT, thraggT] = await Promise.all(['mark', 'omni', 'thragg'].map((n) => loadFigure(asset(CAST[n].file))));
  const mark = figure(markT, CAST.mark);
  const omni = figure(omniT, CAST.omni);
  const thragg = figure(thraggT, CAST.thragg);
  for (const f of [mark, omni, thragg]) {
    f.lean = new THREE.Quaternion();
    f.snap(POSES.stand);
    scene.add(f.holder);
  }
  // the cast's one finish (./people.js), its rim set by the time of day
  const casts = [mark, omni, thragg].map((f) => castMaterial(f.model, { rim: LOOK.noon.rim, floor: f === mark ? SUIT.floor : null }));
  // the light that follows him (SPOT; with no shadow, one more light's sum on each lit pixel)
  const spot = new THREE.SpotLight(SPOT.color, 0, SPOT.range, SPOT.angle, SPOT.penumbra, 2);
  spot.castShadow = false;
  scene.add(spot, spot.target);
  // Omni-Man: over downtown, hands on his hips, by day; behind his son at
  // the rings; on the porch beside Debbie at dusk and night (./companions.js)
  const home = world.houses.find((q) => q.home);
  const side = home.yaw === 0 ? 1 : -1;
  let dad = newDad({ watch: DAD.watch, porch: [home.x + 1.3, 0.3, home.z + side * (home.d / 2 + 1.4)] });
  const porchYaw = side > 0 ? 0 : Math.PI;
  let dadYaw = Math.PI * 0.85;

  // ── space: the Earth under him, the Moon, Mars, and who's waiting out there (./spaceScene.js) ──
  const { space, allen, ALLEN, THRAGG, spaceTalk, look: lookOfSpace } = await createSpaceScene(engine, scene, { small, people, thragg });

  const fx = createFlightFx(scene, { calm, small });
  const challenges = createChallenges(scene, world, fx.vfx);
  const villains = createVillains(scene, fx.vfx, { calm, templates: { mauler: people.mauler, seismic: people.seismic }, rim: LOOK.noon.rim });
  // the missions' things (./missions.js, run by InvWorld.jsx): the bank on
  // its block, the getaway truck on the grid, the marker over the step's target
  const props = await loadProps(scene, world, { rim: LOOK.noon.rim });
  const marker = createMarker(scene);
  const course = createCourse(scene);
  const feel = createFeel({ calm, baseFov: FOV, offset: 0.4 });
  // a slam's squash (the game-feel design's Tier 2): a spring kicked by how
  // hard he came down, rung out about his feet, never more than 0.3
  const squash = createSpring({ k: 120, c: 8, max: 0.3 });
  const SQUASH = { per: 0.05, most: 4 }; // the kick a m/s of landing, and its cap (a slam from flat out is 260)

  // ── the time of day ──
  let look = null;
  let haze = 1;
  let timeName = 'noon';
  let zone = 'city';
  const fogBase = new THREE.Color();
  // The haze's colours, from the sky photo: along the horizon (`fogBase`,
  // three's fog and the clouds'), overhead (`fogHigh`), and how the haze
  // under the horizon compares (`fogBelow`). Every lit material here is in
  // the engine's house look (lib/three/house), which colours fog by its own
  // sky, by default a fixed cream: the far hills bleached at noon, and the
  // city faded into cream at night. The engine keeps the house to itself,
  // but each material it takes on carries the one set of uniforms it shares
  // (userData.house), so its sky is set from that.
  const fogHigh = new THREE.Color();
  let fogBelow = 1;
  let houseU = null;
  const houseOf = () => {
    if (!houseU)
      scene.traverse((o) => {
        for (const m of houseU ? [] : [o.material].flat()) if (m?.userData?.house) houseU = m.userData.house;
      });
    return houseU;
  };
  // The sky loads before it's put up, so the times are put up one at a time,
  // in the order asked: two quick changes can't land the wrong way round,
  // one time's sky over the other's streets. Each resolves once its time is
  // up (or, if another was asked for meanwhile, once it's been passed over),
  // and fails if its sky won't load, without stopping the ones after it.
  let timeQueue = Promise.resolve();
  function setTime(name) {
    timeName = LOOK[name] ? name : 'noon';
    space.setTime(timeName);
    npcs.setTime(timeName);
    const turn = timeQueue.then(putUpTime);
    timeQueue = turn.catch(() => {
      look = null; // (so the next one puts it up again)
    });
    return turn;
  }
  async function putUpTime() {
    const L = LOOK[timeName];
    // (the cast's rim is the time's, the crowd's too, and out in space)
    setCastRim(L.rim);
    if (zone === 'space') {
      // out there the sun is the only light, and it moves with the time (as
      // it does on the Earth, the Moon and Mars); the city's sky waits till he's back
      engine.sun.userData.dir = space.sun.clone();
      return;
    }
    if (look === L) return;
    look = L;
    scene.fog = null;
    const sky = await engine.setSky(L.sky, { rotate: L.rotate, envIntensity: L.env, bgIntensity: L.bg, sunIntensity: L.sun, sunColor: L.sunColor, sunDir: L.sunDir, fill: L.fill, fog: L.fog });
    if (zone === 'space') {
      // he went up while it loaded: the sky's light is the city's, not space's
      look = null;
      spaceLook();
      return;
    }
    engine.exposure = L.exposure;
    ground.setNight(L.night);
    city.setNight(L.night);
    landmarks.setNight(L.night);
    clouds.setLook(L.cloud);
    spot.intensity = L.spot;
    // the haze is the sky's colour along the horizon as it's drawn (the
    // photo at its brightness), so far towers and hills fade into the sky
    // behind them, not into grey or white; and the sky's overhead above it
    const b = skyBands(sky?.background);
    if (scene.fog) {
      if (b) scene.fog.color.copy(b.horizon).multiplyScalar(L.bg);
      fogBase.copy(scene.fog.color);
      if (b) fogHigh.copy(b.high).multiplyScalar(L.bg);
      else fogHigh.copy(fogBase);
      fogBelow = b ? clamp(luma(b.below) / Math.max(luma(b.horizon), 1e-4), 0.7, 1) : 0.92;
    }
    haze = NaN; // (the next frame puts the haze up, the house's with it)
  }
  await setTime('noon');

  // ── the city or space: one or the other is drawn ──
  const cityOnly = [ground.group, city.group, landmarks.group, clouds.mesh, hazeSky.mesh, jet.group, life.group, challenges.group, villains.group, omni.holder];
  function spaceLook() {
    lookOfSpace(spot);
  }
  async function setZone(z) {
    if (z === zone) return;
    zone = z;
    for (const g of cityOnly) g.visible = z === 'city';
    for (const n of npcs.all) n.holder.visible = z === 'city' && n.out !== false;
    space.group.visible = z === 'space';
    if (z === 'space') {
      spaceLook();
      camera.far = 1300000;
    } else {
      camera.far = 26000;
      look = null;
      await setTime(timeName);
    }
    camera.updateProjectionMatrix();
  }

  // ── a flyer's body: upright when still, along his flight when fast ──
  const qTmp = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const vTmp = new THREE.Vector3();
  // `ahead`: the figure lies along its flight itself (a flying clip, its head
  // ahead), so its front, not its crown, is turned along the flight
  function carry(f, p, yaw, v, dt, { lean = 1, roll = 0, lift = 0, ahead = false } = {}) {
    f.holder.position.set(p[0], p[1] + f.hipHeight + lift, p[2]);
    f.holder.rotation.set(0, yaw, 0);
    const speed = Math.hypot(v[0], v[1], v[2]);
    const k = clamp((speed - 8) / 30, 0, 1) * lean;
    const axis = ahead ? Z : Y;
    qYaw.setFromAxisAngle(Y, -yaw);
    const dir = speed > 0.1 ? vTmp.set(v[0], v[1], v[2]).divideScalar(speed).applyQuaternion(qYaw) : vTmp.copy(axis); // (in his own frame)
    dir.lerpVectors(axis, dir, k).normalize();
    qTmp.setFromUnitVectors(axis, dir);
    if (roll) qTmp.multiply(new THREE.Quaternion().setFromAxisAngle(Y, roll));
    f.lean.slerp(qTmp, dt === 0 ? 1 : 1 - Math.exp(-8 * dt));
    f.body.quaternion.copy(f.lean);
    return k;
  }

  // ── the camera: behind him, pulled back and widened with speed ──
  const cam = { dist: CAM.back, fov: FOV, pos: new THREE.Vector3(), at: new THREE.Vector3(), ready: false, near: 0.3, swing: 0 };
  // Where to look from `from` so his feet (`feet`, `up` his up) sit CAM.feet
  // up the screen, centred across it: the point on the line up through him
  // that's that much above the line to his feet (in the upright plane
  // through the camera and him, the screen's height goes as the tangent).
  const aimFeet = new THREE.Vector3();
  const aimRun = new THREE.Vector3();
  function feetAim(from, feet, up, fov) {
    aimRun.subVectors(feet, from);
    const rise = aimRun.dot(up);
    aimRun.addScaledVector(up, -rise); // (along the ground to the line up through him)
    const run = aimRun.length();
    const a = clamp(Math.atan2(rise, run) + Math.atan((1 - 2 * CAM.feet) * Math.tan(THREE.MathUtils.degToRad(fov / 2))), -1.45, 1.45);
    return { at: aimFeet.copy(from).add(aimRun).addScaledVector(up, run * Math.tan(a)), steep: run / Math.hypot(run, rise) };
  }
  const list = [];
  // how far (0…1) along `back` from `anchor` the camera can go before a wall
  // (`list`: the buildings round him, each kept 0.4 m off). One he's hugging
  // is kept off only as far as leaves 0.15 m round the anchor: he hovers as
  // near as FLY.R (0.45 m) to a face (./flight.js's collide), and from
  // there, with a whole 0.4 m kept off, every way out but straight along
  // the wall would end a few centimetres from him. So the camera can still
  // go along a wall or away from it, and never nearer its face than 0.3 m.
  function clear(anchor, back) {
    let t = 1;
    for (const b of list) {
      const out = Math.hypot(Math.max(b.x0 - anchor[0], 0, anchor[0] - b.x1), Math.max(b.y0 - anchor[1], 0, anchor[1] - b.y1), Math.max(b.z0 - anchor[2], 0, anchor[2] - b.z1));
      const m = clamp(out - 0.15, 0, 0.4);
      t = Math.min(t, rayBox(anchor, back, { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m, z0: b.z0 - m, z1: b.z1 + m }));
    }
    return t;
  }
  // Where it goes when a wall's right behind him (hovering against a tower,
  // or by one on a roof): round him to one side or the other, or up over
  // him, whichever gets furthest from him for the least turn, rather than
  // closing in until it's inside his head. The last two go square to his
  // back, along the wall: with his back flat to it, every other way runs
  // into its face within a few centimetres. [turn about the up axis, rise, cost in metres]
  const SWINGS = [
    [0.5, 0, 0.8],
    [-0.5, 0, 0.8],
    [1, 0, 1.6],
    [-1, 0, 1.6],
    [0, 0.85, 1.4],
    [1.5, 0, 2.6],
    [-1.5, 0, 2.6],
    [0, 1.4, 2.4],
    [Math.PI / 2, 0, 3],
    [-Math.PI / 2, 0, 3],
  ];
  const TIGHT = 2.6; // (metres: closer than this, the camera swings; it comes back once the line behind him is clear to 3.6)
  const swung = [0, 0, 0];
  function swing(back, [turn, rise], up) {
    // (round the up axis, then lifted toward it, kept the same length)
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const l = Math.hypot(...back);
    let x = back[0] * c + back[2] * s;
    let y = back[1];
    let z = -back[0] * s + back[2] * c;
    if (rise) {
      x = x * (1 - rise * 0.6) + up.x * l * rise;
      y = y * (1 - rise * 0.6) + up.y * l * rise;
      z = z * (1 - rise * 0.6) + up.z * l * rise;
    }
    const k = l / (Math.hypot(x, y, z) || 1);
    swung[0] = x * k;
    swung[1] = y * k;
    swung[2] = z * k;
    return swung;
  }
  function placeCamera(h, yaw, pitch, speed, dt) {
    const fly = h.mode === 'air';
    const k = clamp(speed / 260, 0, 1);
    const want = h.mode === 'ground' ? CAM.back : CAM.back + k * CAM.pull;
    cam.dist = dt === 0 ? want : damp(cam.dist, want, 2.4, dt);
    // standing on the Moon or Mars, "up" is away from it: the camera's frame turns with it
    const upV = h.mode === 'perch' ? new THREE.Vector3(...h.perch.n) : Y;
    const qUp = new THREE.Quaternion().setFromUnitVectors(Y, upV);
    const f3 = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(qUp);
    const fwd = [f3.x, f3.y, f3.z];
    const lift = upV.clone().multiplyScalar(fly ? 1.2 : 1.55);
    const anchor = [h.p[0] + lift.x, h.p[1] + lift.y, h.p[2] + lift.z];
    // (higher over him the faster he goes, so flat out you see his back, not his boots)
    const over = upV.clone().multiplyScalar(fly ? CAM.over + k * 2.6 : CAM.overFoot);
    let back = [-fwd[0] * cam.dist + over.x, -fwd[1] * cam.dist + over.y, -fwd[2] * cam.dist + over.z];
    // never inside a building: stop short of the first wall behind him, or,
    // with one right behind him, swing off it (and stay swung until the line
    // behind him is clear again, so it doesn't flick between the two)
    let t = 1;
    if (zone === 'city') {
      near(world, anchor[0], anchor[2], cam.dist + 3, list);
      const len = Math.hypot(...back);
      t = clear(anchor, back);
      if (t * len < (cam.swing ? TIGHT + 1 : TIGHT)) {
        let best = { i: -1, t, score: t * len };
        SWINGS.forEach((s, i) => {
          const tt = clear(anchor, swing(back, s, upV));
          const score = tt * len - s[2] + (i === cam.swing - 1 ? 0.8 : 0);
          if (score > best.score) best = { i, t: tt, score };
        });
        cam.swing = best.i + 1;
        if (best.i >= 0) {
          back = [...swing(back, SWINGS[best.i], upV)];
          t = best.t;
        }
      } else cam.swing = 0;
    } else cam.swing = 0;
    t = Math.max(0.08, t);
    const pos = new THREE.Vector3(anchor[0] + back[0] * t, anchor[1] + back[1] * t, anchor[2] + back[2] * t);
    if (zone === 'city') pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 0.5, -2);
    else
      for (const b of BODIES) {
        // (and never inside the Moon)
        const d = pos.clone().sub(new THREE.Vector3(...b.c));
        if (d.length() < b.r + 1.5) pos.copy(new THREE.Vector3(...b.c).addScaledVector(d.normalize(), b.r + 1.5));
      }
    // hovering or standing, aimed by his feet (CAM.feet); leaning into a
    // flight, or with the camera nearly over him (where the line up
    // through him is nearly the way it looks), at a point ahead of him
    const ahead = new THREE.Vector3(anchor[0] + fwd[0] * CAM.ahead, anchor[1] + fwd[1] * CAM.ahead, anchor[2] + fwd[2] * CAM.ahead);
    const lean = fly ? clamp((speed - 8) / 30, 0, 1) : 0;
    const aim = feetAim(pos, vTmp.set(h.p[0], h.p[1], h.p[2]), upV, FOV + Math.pow(k, 1.2) * 16);
    const at = aim.at.lerp(ahead, Math.max(lean, 1 - THREE.MathUtils.smoothstep(aim.steep, 0.1, 0.25)));
    if (!cam.ready || dt === 0) {
      cam.pos.copy(pos);
      cam.at.copy(at);
      cam.ready = true;
    } else {
      // tight at speed, so he stays where he is on the screen
      const r = 10 + k * 30;
      cam.pos.lerp(pos, 1 - Math.exp(-r * dt));
      cam.at.lerp(at, 1 - Math.exp(-(r + 4) * dt));
    }
    camera.position.copy(cam.pos);
    camera.up.lerp(upV, dt === 0 ? 1 : 1 - Math.exp(-4 * dt)).normalize();
    camera.lookAt(cam.at);
    // the near plane moves out as he climbs (the depth buffer goes further),
    // but never out to him: his height is over the street, and on a roof or
    // by a tower the camera can be nearer him than that would allow
    const alt = zone === 'space' ? altitudeOf(h) : h.p[1] - groundAt(h.p[0], h.p[2]);
    const gap = Math.hypot(cam.pos.x - anchor[0], cam.pos.y - anchor[1], cam.pos.z - anchor[2]);
    const nearWant = Math.min(zone === 'space' ? 2 : clamp(alt * 0.004, 0.25, 3), Math.max(0.1, gap * 0.3));
    // (and the far plane, so from high up the land runs on to the horizon)
    const farWant = zone === 'space' ? 1300000 : clamp(26000 + alt * 3, 26000, 60000);
    if (Math.abs(nearWant - cam.near) > 0.02 || Math.abs(farWant - camera.far) > 500) {
      cam.near = nearWant;
      camera.near = nearWant;
      camera.far = farWant;
      camera.updateProjectionMatrix();
    }
    feel.setBaseFov(FOV + Math.pow(k, 1.2) * 16);
    feel.update(dt, camera);
    // the light that follows him: over the camera's shoulder, above his chest
    if (zone === 'city') {
      const chest = spot.target.position.set(h.p[0], h.p[1] + SPOT.chest, h.p[2]);
      const toCam = vTmp.set(cam.pos.x - chest.x, 0, cam.pos.z - chest.z);
      if (toCam.lengthSq() < 1e-4) toCam.set(-fwd[0], 0, -fwd[2]);
      spot.position.copy(chest).addScaledVector(toCam.normalize(), SPOT.back).add(vTmp.set(0, SPOT.up, 0));
    }
    // the shadows: round him, wider the higher he is (in space, just his own)
    if (zone === 'space') engine.setShadowBox(new THREE.Vector3(...h.p), 6, 40);
    else engine.setShadowBox(new THREE.Vector3(h.p[0], Math.max(0, h.p[1] - alt), h.p[2]), clamp(60 + alt * 0.4, 60, 360), 600 + Math.min(alt, 1500));
    // the haze thins as the air does; high up, the sky goes dark and the stars come out
    if (zone === 'city' && scene.fog?.isFogExp2 && look) {
      const thin = clamp(1 - alt / 2600, 0.3, 1);
      const dark = THREE.MathUtils.smoothstep(alt, 2500, WORLD.ceiling);
      if (Number.isNaN(haze) || Math.abs(thin - haze) > 0.005 || dark > 0) {
        // (until the house has taken the city on, again next frame)
        const u = houseOf();
        haze = u ? thin : NaN;
        scene.fog.density = look.fog.density * thin * (1 - dark * 0.5);
        // the haze dims with the sky behind it, so the land meets the sky
        // at the sky's own tone all the way up (not a cream plain under a
        // dark sky, its photo's clouds dark banks along the horizon)
        const sky = 1 - 0.94 * dark;
        scene.backgroundIntensity = look.bg * sky;
        scene.fog.color.copy(fogBase).multiplyScalar(sky);
        if (u) {
          u.uLookFogLow.value.copy(scene.fog.color);
          u.uLookFogHigh.value.copy(fogHigh).multiplyScalar(sky);
          u.uLookFogBelow.value = fogBelow;
        }
        // and over the photo, as it dims, the sky the haze has
        hazeSky.set(scene.fog.color, u ? u.uLookFogHigh.value : fogHigh, fogBelow, THREE.MathUtils.smoothstep(dark, 0.05, 0.5));
      }
      space.stars.visible = dark > 0.02;
      space.stars.material.color.setScalar(dark);
    }
  }

  // ── other players online, in their own worlds, as holograms (./onlineScene.js) ──
  const ghosts = createOnlineGhosts({ markT, world, zone: () => zone });
  scene.add(ghosts.group);

  // ── every frame ──
  let t = 0;
  let stride = 0;
  const splashed = { t: -1, speed: 0 }; // (the last splash drawn)
  function frame(sim, frameDt) {
    // (the QA scripts' `snap`: the camera and his pose straight to where they're going)
    const snap = Boolean(sim.snap);
    const dt = snap ? 1 : frameDt;
    t += frameDt;
    const h = sim.h;
    const speed = Math.hypot(h.v[0], h.v[1], h.v[2]);
    // what happened this frame (and what sends the people and the traffic running)
    const scare = [];
    // and what the townspeople make of it (./brains.js)
    const crowd = { slam: null, hit: null, fight: Boolean(sim.foes?.on), won: false, time: timeName, lesson: sim.quests?.lesson ?? null, mission: sim.mission?.id ?? null };
    // (Eve goes for the foes still standing)
    crowd.talk = Boolean(sim.talkEve);
    sim.talkEve = false;
    crowd.foes = sim.foes ? standing(sim.foes).map((e) => ({ id: e.id, p: e.p })) : [];
    // (a car he's carrying over their heads: they run from it as from one thrown)
    crowd.carried = sim.brawl?.carry?.kind === 'car' ? [h.p[0], h.p[2]] : null;
    // what Eve and Dad say and do this frame, for ./InvWorld.jsx
    sim.companion ??= [];
    for (const e of sim.events) {
      if ((e.type === 'slam' || e.type === 'impact' || e.type === 'boom' || (e.type === 'brawl' && ['slam', 'diveHit', 'pound'].includes(e.kind))) && !crowd.slam) crowd.slam = [e.at[0], e.at[2]];
      else if ((e.type === 'ko' || e.type === 'down') && !crowd.hit) crowd.hit = [e.at[0], e.at[2]];
      else if (e.type === 'won') crowd.won = true;
      // (a fight near the road: the cars back away from it)
      if (e.type === 'ko' || e.type === 'down' || e.type === 'hurt') scare.push({ x: e.at[0], z: e.at[2], r: 60, reverse: true });
      if (e.type === 'slam') scare.push({ x: e.at[0], z: e.at[2], r: 25 + e.speed * 0.25 });
      else if (e.type === 'splash' && e.speed > 40) scare.push({ x: e.at[0], z: e.at[2], r: 15 + e.speed * 0.15 });
      else if (e.type === 'impact') scare.push({ x: e.at[0], z: e.at[2], r: 35 });
      else if (e.type === 'boom' && e.at[1] - groundAt(e.at[0], e.at[2]) < 90) scare.push({ x: e.at[0], z: e.at[2], r: 60 });
      if (e.type === 'brawl') brawlFeel(e, { fx, feel, scare });
      else if (e.type === 'boom') {
        fx.boom(e.at, e.dir);
        feel.trauma(0.45);
        feel.punch(6);
      } else if (e.type === 'slam') {
        fx.slam(e.at, e.speed);
        squash.kick(Math.min(SQUASH.most, e.speed * SQUASH.per));
        feel.trauma(clamp(e.speed / 150, 0.3, 1));
      } else if (e.type === 'impact') {
        fx.impact(e.at, e.n, e.speed);
        feel.trauma(clamp(e.speed / 120, 0.4, 1));
      } else if (e.type === 'splash') {
        // down onto the water: spray where a slam would crack the street (no
        // crater), and a lighter knock than the street's. A dip and back down
        // straight after (bobbing at the surface) doesn't throw up another.
        if (!(t - splashed.t < 0.3 && e.speed <= splashed.speed)) {
          fx.splash(e.at, e.speed);
          feel.trauma(clamp(e.speed / 260, 0.15, 0.7));
          splashed.t = t;
          splashed.speed = e.speed;
        }
      } else if (e.type === 'takeoff') fx.takeoff(e.at);
      else if (VILLAIN_EV.has(e.type)) traffic = villainFeel(e, { villains, feel, scare, traffic, h });
      else if (e.type === 'land' && e.n) {
        // down on the Moon or Mars: a ring of dust thrown out round him
        const at = new THREE.Vector3(...e.at);
        const n = new THREE.Vector3(...e.n);
        fx.vfx.ring(at.clone().addScaledVector(n, 0.3), { color: e.body === 'mars' ? 0xd99a6a : 0xc8c8c8, from: 1, to: 8 + Math.min(40, e.speed / 60), life: 0.9, normal: n, opacity: 0.8 });
        fx.vfx.debris(at.clone().addScaledVector(n, 0.5), { count: 24, speed: 10, size: 0.25, dir: n, spread: 0.8, color: e.body === 'mars' ? 0xb0603a : 0x9a9a9a });
        feel.trauma(clamp(e.speed / 1500, 0.2, 0.8));
      }
    }
    sim.events.length = 0;

    // Mark
    if (h.mode === 'perch') {
      // standing on the Moon (or Mars): his feet on it, his head away from it
      const n = new THREE.Vector3(...h.perch.n);
      mark.holder.position.set(...h.p).addScaledVector(n, mark.hipHeight);
      mark.holder.quaternion.setFromUnitVectors(Y, n).multiply(new THREE.Quaternion().setFromAxisAngle(Y, h.face));
      mark.lean.identity();
      mark.body.quaternion.identity();
      mark.act('idle') || mark.pose(POSES.proud(), dt, 6);
    } else if (h.mode === 'ground') {
      // his motion-captured clips where he has them (walking at the pace he
      // goes: the clip's own pace is about 1.4 m/s, a run's about 5.5);
      // the landing crouch and a punch are posed, aimed where they go
      const flat = Math.hypot(h.v[0], h.v[2]);
      stride += flat * frameDt * 1.55;
      carry(mark, h.p, h.face, [0, 0, 0], dt, { lean: 0, lift: h.crouch > 0 ? -mark.hipHeight * 0.42 : 0 });
      if (h.crouch > 0) mark.pose(LAND, dt, 18);
      else if (sim.brawl?.guard) mark.act('hit', { speed: 0, fade: 0.1 }) || mark.pose({ ...POSES.stand, ...GUARD }, dt, 20);
      else if (sim.brawl?.carry) mark.pose({ ...POSES.stand, ...HOLD_UP }, dt, 16);
      else if (sim.punchT > 0) mark.pose(POSES.punch([0, 0.1, 1]), dt, 30);
      else if (flat > 4.5) mark.act('run', { speed: clamp(flat / 5.5, 0.7, 1.6) }) || mark.pose(POSES.stride(stride, 1, clamp((flat - 4) / 5, 0, 1)), dt, 14);
      else if (flat > 0.3) mark.act('walk', { speed: clamp(flat / 1.4, 0.6, 2.2) }) || mark.pose(POSES.stride(stride, clamp(flat / 2, 0, 1), 0), dt, 14);
      else mark.act('idle') || mark.pose(POSES.stand, dt, 8);
    } else if (h.stun > 0) {
      carry(mark, h.p, h.face, h.v, dt, { lean: 0.4, roll: t * 9 });
      mark.act('hit', { once: true, fade: 0.1 }) || mark.pose(POSES.hurt(), dt, 14);
    } else {
      // flat out, the fly clip lies along his flight itself
      const fast = clamp((Math.hypot(...h.v) - 8) / 30, 0, 1) > 0.45 && mark.clips.includes('fly');
      const k = carry(mark, h.p, h.face, h.v, dt, { lean: 1, ahead: fast });
      // a punch thrown hanging in the air (flat out, the fly pose's fist is already ahead);
      // carrying, his arms up over his head; diving, a streak behind him
      if (h.dive && !calm) fx.vfx.trail(new THREE.Vector3(h.p[0], h.p[1] + 1, h.p[2]), { size: 1.8, life: 0.35, color: 0xfff2b0, to: 0x4a90ff, a: 0.8 });
      if (sim.brawl?.carry) mark.pose({ ...POSES.hover(t), ...HOLD_UP }, dt, 16);
      else if (sim.punchT > 0 && !fast) mark.pose(POSES.punch([0, 0.1, 1]), dt, 30);
      else if (k > 0.45) mark.act('fly', { fade: 0.4 }) || mark.pose(POSES.fly(), dt, 9);
      else mark.act('hover', { fade: 0.4 }) || mark.pose(POSES.hover(t), dt, 9);
    }
    mark.tick(dt);
    // (on his feet only: off them the squash is let go)
    const sq = h.mode === 'ground' ? squash.step(dt) : 0;
    if (h.mode !== 'ground') squash.reset();
    mark.holder.scale.set(1 + sq / 2, 1 - sq, 1 + sq / 2);
    if (sq) mark.holder.position.y -= mark.hipHeight * sq;

    if (zone === 'city') {
      // his father, keeping an eye on things
      if (!sim.hold) {
        const r = stepDad(dad, { hero: h.p, heroV: h.v, lesson: crowd.lesson, mission: crowd.mission, spar: sim.mission?.spar ?? null, time: timeName }, snap ? 1 : frameDt);
        dad = r.dad;
        sim.companion.push(...r.ev);
      }
      const onPorch = dad.state === 'home' && Math.hypot(dad.p[0] - dad.porch[0], dad.p[1] - dad.porch[1], dad.p[2] - dad.porch[2]) < 1;
      const going = Math.hypot(dad.v[0], dad.v[2]);
      if (onPorch) dadYaw = porchYaw;
      else if (going > 2) dadYaw = Math.atan2(dad.v[0], dad.v[2]);
      else if (dad.state === 'lesson') dadYaw = Math.atan2(h.p[0] - dad.p[0], h.p[2] - dad.p[2]);
      const bob = onPorch ? 0 : Math.sin(t * 0.7) * 1.2;
      carry(omni, [dad.p[0], dad.p[1] + bob, dad.p[2]], dadYaw, dad.v, dt, { lean: onPorch ? 0 : 1 });
      if (onPorch) omni.act('idle') || omni.pose(POSES.stand, dt, 6);
      else if (Math.hypot(...dad.v) > 20) omni.act('fly', { fade: 0.4 }) || omni.pose(POSES.fly(), dt, 9);
      else omni.act('hover', { fade: 0.4 }) || omni.pose(POSES.proud(), dt, 6);
      omni.tick(dt);
      // (the QA scripts can hold everyone still, to frame them)
      if (!sim.hold) {
        sim.companion.push(...npcs.update(frameDt, t, h, crowd));
        jet.update(frameDt, t);
      }
      if (sim.quests) challenges.update(sim.quests, frameDt, t);
      if (sim.foes) {
        villains.update(sim.foes, frameDt, t, h);
        // (a Mauler about: where the traffic's cars are, for him to take one; a car he's taken is nowhere)
        sim.cars = anyOf(sim.foes, 'mauler')
          ? traffic.cars.map((c) => {
              if (c.gone) return [1e9, 0, 1e9];
              const [x, z] = carAt(c);
              return [x, 0, z];
            })
          : null;
      }
      props.update(sim.getaway, frameDt);
      // (no traffic to speak of from up where the clouds are)
      if (h.p[1] < 2200 || scare.length) {
        traffic = stepTraffic(traffic, frameDt, { cx: camera.position.x, cz: camera.position.z, yaw: sim.yaw, scare });
        life.update(traffic, frameDt, camera, look?.night ?? 0);
      }
      clouds.update(t, scene.fog);
      hazeSky.update(camera);
    } else {
      // Allen, waiting by the Moon; Thragg over Mars
      allen.pose({ mode: 'hover', t }, dt);
      carry(thragg, [THRAGG[0], THRAGG[1] + Math.sin(t * 0.6), THRAGG[2]], Math.atan2(-THRAGG[0], -THRAGG[2]), [0, 0, 0], dt, { lean: 0 });
      thragg.act('hover') || thragg.pose(POSES.proud(), dt, 6);
      thragg.tick(dt);
    }
    space.update(t, camera);
    // other players online: in the city, or out here with him
    ghosts.update(sim.travellers ?? [], t, frameDt);

    placeCamera(h, sim.yaw, sim.pitch, speed, snap ? 0 : dt);
    marker.update(sim.marker, t, camera, engine.size.h);
    course.update(sim.gates, sim.photo, t);
    ground.update(t);
    city.update(t, look?.night ?? 0);
    // coming down through the air from space, fast: the air in front of him burns
    const altNow = zone === 'space' ? altitudeOf(h) : h.p[1];
    const down = zone === 'space' ? -(h.v[0] * h.p[0] + h.v[1] * h.p[1] + h.v[2] * h.p[2]) / Math.hypot(...h.p) : -h.v[1];
    const burn = clamp((down - 160) / 260, 0, 1) * (zone === 'space' ? 1 - THREE.MathUtils.smoothstep(altNow, 20000, 40000) : THREE.MathUtils.smoothstep(altNow, 4500, 8000));
    fx.plasma(burn, h.p, h.dir);
    fx.update(frameDt, camera, engine.size.h, h, speed);
    engine.render();
  }

  // where a world point is on the screen
  const project = (p) => engine.project(new THREE.Vector3(p[0], p[1], p[2]));
  // who's near enough to talk to him (his father too, over downtown)
  const talkers = (h) => {
    if (zone === 'space') {
      return spaceTalk
        .map((q) => ({ ...q, head: [q.p[0], q.p[1] + 1.4, q.p[2]], d: Math.hypot(h.p[0] - q.p[0], h.p[1] - q.p[1], h.p[2] - q.p[2]) }))
        .filter((q) => q.d < q.r)
        .sort((a, b) => a.d - b.d);
    }
    const out = npcs.talkers(h);
    const d = Math.hypot(h.p[0] - dad.p[0], h.p[1] - dad.p[1], h.p[2] - dad.p[2]);
    if (d < 45) out.push({ id: 'omni', role: 'omni', name: 'Dad', lines: LINES.omni, head: [dad.p[0], dad.p[1] + 1.2, dad.p[2]], d });
    return out.sort((a, b) => a.d - b.d);
  };
  const tmpV = new THREE.Vector3();
  const jetDistance = (h) => jet.near(tmpV.set(h.p[0], h.p[1] + 1, h.p[2]));

  return {
    ground: import.meta.env.DEV ? skyLight : null, // for the QA scripts
    engine,
    world,
    frame,
    // how much of a real frame the game goes on by (a hitstop: ./InvWorld.jsx's loop)
    timeScale: feel.timeScale,
    // ?debug: the feel's numbers, and ./InvWorld.jsx's (the hits, the jump's press)
    tune: (more = []) => engine.tune([...feelGroups(feel), ...springGroups(squash, 'squash'), ...more], 'invincible'),
    setTime,
    project,
    talkers,
    jetDistance,
    setZone,
    get zone() {
      return zone;
    },
    debug: {
      npcs,
      jet,
      villains,
      world,
      bodies: BODIES,
      allen: ALLEN,
      thragg: THRAGG,
      // Dad's rules, and (given a place, and the way he's facing) Dad put there
      dad: (p, dir) => {
        if (p) dad = { ...dad, p: [...p], dir: dir ?? dad.dir };
        return dad;
      },
    },
    resize: (w, hh) => engine.resize(w, hh),
    get lost() {
      return engine.lost;
    },
    info: () => ({ ...engine.info(), bound: WORLD.half }),
    dispose() {
      skyLight?.dispose();
      fx.dispose();
      villains.dispose();
      props.dispose();
      marker.dispose();
      course.dispose();
      ghosts.dispose();
      for (const c of casts) c.dispose();
      mark.dispose();
      omni.dispose();
      thragg.dispose();
      engine.dispose();
    },
  };
}
