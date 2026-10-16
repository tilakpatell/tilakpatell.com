// Walt and Jesse's RV, from the driver's seat: the 1986 Fleetwood Bounder of
// Breaking Bad, a Class A motorhome. A wide dashboard of tan moulded plastic
// with dark brown and woodgrain trim, the hooded binnacle of gauges in front
// of you, the thin beige two-spoke wheel on its column with the shifter, the
// carpeted engine hump between the seats, Jesse in the passenger's seat and
// Mr. White standing in the aisle behind him in his yellow suit. Out of the
// two-pane windshield, the New Mexico high desert at the golden hour: a
// straight road to the horizon, scrub, a ranch fence, power poles and mesas.
//
// Going (click the wheel or the shifter): into drive, the RV pulls away and
// keeps gathering speed while the day goes by in a time-lapse: the sun sets,
// the stars come out, the headlights and the gauges come on. At dusk a pair
// of wings swings out of the RV's sides (you turn to watch the left one) and
// the jets under them catch; the road falls away and the RV rises into the
// night sky. Then you see it from outside, climbing for space with Walt's
// blue crystals spilling out of the back and Hank's SUV after it, lights
// going, and the peak is a fade through the dark into the universe.
//
// The cab's floor is y = 0, a metre above the road; you sit on the left,
// looking down −z. Units are metres.
//
// This is rv.js on the node renderer: the same exports, the same build and
// the same frame, every line of it copied but the materials. Split by what
// it builds, each part under the 800 lines a file may have: the measures,
// the loaders and the geometry helpers (./rvNodesKit.js), the painted
// surfaces (./rvNodesPaint.js) and instruments (./rvNodesDials.js), the cab
// to the wheel (./rvNodesCab.js), the rest of the cab and the coach
// (./rvNodesCoach.js), the sky and the land (./rvNodesLand.js,
// ./rvNodesOutside.js), and the wings (./rvNodesWings.js). What differs:
// - every material is a node material, the same settings: the MeshStandard
//   and MeshBasic ones their node twins, the kit’s the node kit’s
//   (../kitNodes.js), the stars the node space’s (../spaceNodes.js), and
//   Jesse and Walt dressed by the wardrobe’s node twin (wearNodes.js);
// - the sky dome, the land’s haze and the haze over the land were GLSL (two
//   ShaderMaterials and an onBeforeCompile): they are node materials and a
//   node hook now, their uniforms nodes under the same names
//   (./rvNodesLand.js says how);
// - the town’s lights, points sized in pixels, are instanced sprites (the
//   node renderer draws a point one pixel wide);
// - the reflections that dim with the light are found among node materials
//   too (a MeshStandardNodeMaterial isn’t a MeshStandardMaterial by its flag).

import * as THREE from 'three';
import { loadCrew, nudge, prefetchCrew } from '../crew';
import { retarget } from '../../rickmorty/portal/clips';
import { LOOK_KEY, bodyById, readLooks } from '../../rickmorty/wardrobe/looks';
import { dress } from '../../rickmorty/wardrobe/wearNodes';
import { local } from '../../../lib/hooks';
import { createModels } from '../../../lib/models';
import { disposeTree } from '../../../lib/three/renderer';
import { clamp01, due, smooth } from '../timeline';
import { vehicleById } from '../vehicles';
import { EYE, POLE_GAP, POST_GAP, REST, SUN_BEARING, SUN_EL, V3, calmly, driveAt, loadClip, loadEnv, loadSet, loadTex } from './rvNodesKit';
import { DIALS } from './rvNodesDials';
import { buildCab } from './rvNodesCab';
import { buildCoach } from './rvNodesCoach';
import { FENCE_PERIOD, PERIOD } from './rvNodesLand';
import { buildOutside } from './rvNodesOutside';
import { CRYSTALS, DOOR, FLYER_URL, LATE, SUV_URL, WING_URL, chaseAt, chaserOf, crystals, flightAt, flyerOf, loadModel, wingPair } from './rvNodesWings';

export function prefetch() {
  prefetchCrew(['jesse', 'jesse-sit', 'walt', 'walt-idle']);
  for (const url of [WING_URL, FLYER_URL, SUV_URL]) fetch(url).catch(() => {});
}

export async function build({ rich, coarse, renderer, pmrem, say, added }) {
  const inside = new THREE.Group();
  const outside = new THREE.Group();
  const small = coarse || Math.min(window.innerWidth, window.innerHeight) < 600;
  const models = createModels({ base: '/games/models' });

  // Jesse, sat in the passenger's seat; Mr. White stood in the aisle behind,
  // in his suit. Both as the wardrobe has them (looks.js, kept): Walt’s
  // bodies are all his one figure, the cockpit’s, so only his colours and
  // gear change; Jesse in the lab’s suit is Albuquerque’s figure of him, sat
  // on his own clip.
  const looks = readLooks(local.get(LOOK_KEY));
  const jesseFile = looks.jesse.body === 'jesse' ? null : bodyById(looks.jesse.body)?.asset;
  const jesseP = loadCrew('jesse', { file: jesseFile, clip: 'sit', height: 1.73, hips: [0.6, 0.6, 0.2] });
  // the wings, the winged RV and Hank's SUV: waited for a little (LATE, so
  // they're there to be drawn once with everything else before you see the
  // cab), and after that they come when they come (without them the RV just
  // drives off into the night)
  const wingP = loadModel(WING_URL);
  const flyerP = loadModel(FLYER_URL);
  const suvP = loadModel(SUV_URL);
  const extras = Promise.race([Promise.all([wingP, flyerP, suvP]), new Promise((done) => setTimeout(done, LATE))]);
  const waltP = loadCrew('walt', { clip: 'idle', height: 1.79, hips: [0.6, 0.98, 0.9], face: Math.PI + 0.6 });

  const [bench, panelling, lino, asphalt, dirt, rock, photo, env, jesse, walt, brush, shrub, boulder, stone, sitClip, idleClip] = await Promise.all([
    loadSet('/cc0/materials/rv-bench', { arm: !small }),
    loadSet('/cc0/materials/rv-wall', { normal: !small }),
    loadSet('/cc0/materials/rv-floor', { normal: !small }),
    loadSet('/games/tex/asphalt-desert'),
    loadSet('/games/tex/desert-ground'),
    loadSet('/games/tex/mesa-rock', { normal: false }),
    loadTex('/games/sky/jasper-sky.webp', { srgb: false, repeat: false }),
    loadEnv(pmrem),
    jesseP,
    waltP,
    models.load('brush'),
    models.load('shrub'),
    models.load('boulder'),
    models.load('rock'),
    loadClip('jesse-sit'),
    loadClip('walt-idle'),
    extras,
  ]);

  const { std, M, glassM, bin, glassParts, radioM, faceM, needleM, needles, lamps, wheel, spin, wbin, sbin, gearPointer, shifter, stalk, knob, shifterHit, wheelHit } = buildCab({ inside, bench, panelling, lino });
  const { rearGlass, tree, sideGlass } = buildCoach({ inside, std, M, glassM, bin, glassParts, wheel, spin, wbin, sbin });

  // ── the crew ──
  // in their looks (nothing in Jesse’s hand: it rests on his knee)
  const undress = [jesse && dress(jesse, { ...looks.jesse, gear: { ...looks.jesse.gear, hand: 'none' } }), walt && dress(walt, looks.walt)].filter(Boolean);
  // Jesse sat back, his head turned your way; Mr. White watching the road.
  // Both answer the driving (`ride`, set each frame): pressed back into the
  // seat as it pulls away, swaying with the wheel, Jesse's hands up at the
  // dash as it lifts and his head out at the wings; Walt, stood in the
  // aisle, braces against the pull and leans into the turns.
  const ride = { push: 0, sway: 0, lift: 0, wings: 0 };
  const jesseSit = jesseFile && jesse ? retarget(sitClip, jesse.bones.Hips?.position.y ?? 1, sitClip?.userData.hips ?? jesse.bones.Hips?.position.y ?? 1) : sitClip;
  const jesseMove = calmly(jesse, jesseSit, 9.5, 1.2, 0.5, (b, t) => {
    nudge(b.Spine01, -0.04 - ride.push * 0.16, 0, ride.sway * 0.5);
    nudge(b.Head, -0.06 - ride.push * 0.08 + ride.lift * 0.12, 0.45 + Math.sin(t * 0.23) * 0.12 - ride.wings * 0.9, ride.sway * 0.3);
    // (the arms up and out at the dash while it's lifting: a hold on, a yo)
    nudge(b.LeftArm, -ride.lift * 0.9, 0, ride.lift * 0.5);
    nudge(b.RightArm, -ride.lift * 0.9, 0, -ride.lift * 0.5);
    nudge(b.LeftForeArm, -ride.lift * 0.6, 0, 0);
    nudge(b.RightForeArm, -ride.lift * 0.6, 0, 0);
  });
  const waltMove = calmly(walt, idleClip, 3.2, 0.5, 0.35, (b, t) => {
    nudge(b.Hips, ride.push * 0.1, 0, -ride.sway * 0.4);
    nudge(b.Spine01, ride.push * 0.14, 0, -ride.sway * 0.35);
    nudge(b.Head, 0.04 - ride.push * 0.06 + ride.lift * 0.1, Math.sin(t * 0.17) * 0.15, 0);
  });
  jesseMove?.(0);
  waltMove?.(0);
  if (jesse) inside.add(jesse.group);
  if (walt) {
    // stood on the floor: lift or drop him so his feet are on it
    inside.add(walt.group);
    walt.group.updateMatrixWorld(true);
    const toe = Math.min(walt.bones.LeftToeBase?.getWorldPosition(new V3()).y ?? 0, walt.bones.RightToeBase?.getWorldPosition(new V3()).y ?? 0);
    walt.group.position.y -= toe - 0.035;
  }

  // ── light in the cab ──
  const sunIn = new V3(Math.sin(SUN_BEARING), 0.42, -Math.cos(SUN_BEARING)).normalize();
  const hemi = new THREE.HemisphereLight(0xdfe4ee, 0x6a4c34, 0.4);
  inside.add(hemi);
  const key = new THREE.DirectionalLight(0xffc68e, 2.2);
  key.target.position.set(0, 0.8, -0.3);
  key.position.copy(key.target.position).addScaledVector(sunIn, 5);
  inside.add(key, key.target);
  if (rich) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const c = key.shadow.camera;
    c.left = -2.2;
    c.right = 2.2;
    c.top = 2.2;
    c.bottom = -2.2;
    c.near = 1;
    c.far = 10;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    for (const crew of [jesse, walt])
      crew?.group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = false;
      });
  }
  // the sun off the dash, lifting the wheel and faces from below
  const bounce = new THREE.PointLight(0xffcf9a, 0.5, 3, 1.5);
  bounce.position.set(0, 1.1, -0.75);
  inside.add(bounce);
  // the gauges' glow at night, and the moon
  const dashGlow = new THREE.PointLight(0x7fe2c8, 0, 1.6, 2);
  dashGlow.position.set(-0.6, 0.98, -0.62);
  inside.add(dashGlow);
  const radioGlow = new THREE.PointLight(0xffa04a, 0, 0.9, 2);
  radioGlow.position.set(0.02, 0.8, -0.7);
  inside.add(radioGlow);
  const moon = new THREE.DirectionalLight(0x7d96d0, 0);
  moon.position.set(-2, 3, -1.5);
  inside.add(moon);

  // Reflections dim with the light, night coming on: each surface takes the
  // evening sky as its own reflection (a scene's environment would set its
  // strength for every surface alike)
  const ENV = 0.4;
  const reflective = [];
  inside.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if ((m?.isMeshStandardMaterial || m?.isMeshStandardNodeMaterial) && !reflective.includes(m)) {
        reflective.push(m);
        if (env) {
          m.envMap = env;
          m.envMapIntensity = ENV;
        }
      }
  });
  const { tilt, world, sunDir, setSun, dayHaze, duskHaze, nightHaze, haze, skyU, skyDome, stars, sunGlow, sunHalo, sunLight, landHemi, beams, scrolls, groundM, roadM, mesas, power, fence, town, scatters } = buildOutside({ outside, std, small, rich, photo, dirt, asphalt, rock, models, brush, shrub, boulder, stone });

  // ── the wings ──
  let gone = false;
  let wings = null;
  let flyer = null;
  // (none of these is seen until well into the drive. Here in time, each is
  // drawn once with the cab before you see it; one that comes after tells
  // the scene (`added`), which gets it onto the graphics chip then and not
  // at the moment it's first seen: the wings swinging out, the cut to outside)
  let handed = false;
  wingP.then((m) => {
    if (!m) return;
    if (gone) disposeTree(m);
    else {
      wings = wingPair(m);
      inside.add(wings.group);
      if (handed) added?.(wings.group, 'inside');
    }
  });
  flyerP.then((m) => {
    if (!m) return;
    if (gone) disposeTree(m);
    else {
      flyer = flyerOf(m);
      outside.add(flyer.group);
      if (handed) added?.(flyer.group, 'outside');
    }
  });
  let hank = null;
  suvP.then((m) => {
    if (!m) return;
    if (gone) disposeTree(m);
    else {
      hank = chaserOf(m);
      outside.add(hank.group);
      if (handed) added?.(hank.group, 'outside');
    }
  });
  queueMicrotask(() => (handed = true));
  const blue = crystals(small ? Math.round(CRYSTALS * 0.6) : CRYSTALS);
  outside.add(blue.mesh);
  // moonlight on the RV from outside, at the last (none until then)
  const flyerLight = new THREE.DirectionalLight(0xaabbe8, 0);
  flyerLight.position.set(EYE[0] - 4, EYE[1] + 10, EYE[2] + 6);
  flyerLight.target.position.set(EYE[0], EYE[1] - 6, EYE[2] - 30);
  outside.add(flyerLight, flyerLight.target);
  // where the RV's back door was, `u` through the shot from outside (from
  // your eye's frame, into the scene's)
  const doorOff = new V3();
  const doorTurn = new THREE.Euler();
  const doorAt = (u, into) => {
    const f = flightAt(u);
    doorOff.set(...DOOR).applyEuler(doorTurn.set(f.pitch, f.yaw, f.roll, 'YXZ'));
    return into.set(EYE[0] + f.x, EYE[1] + f.y, EYE[2] + f.z).add(doorOff);
  };
  // what's said on the way, from vehicles.js: as the wings come out, as the
  // RV leaves the road, and as Hank comes after it
  const LINES = vehicleById('rv').lines;
  let cues = null;
  let saidTo = 0;

  // ── the drive ──
  let shiftK = 0;
  let lastD = -1;
  const swing = { a: 0, v: 0, b: 0, w: 0 };
  let lastV = 0;
  const glassLight = new THREE.Color();
  const tmpC = new THREE.Color();
  const hemiSky = [new THREE.Color(0xe4e8f2), new THREE.Color(0x1a2448)];
  const hemiGround = [new THREE.Color(0x6a4c34), new THREE.Color(0x07060a)];
  const landSky = [new THREE.Color(0xa8bce0), new THREE.Color(0x2a3a66), new THREE.Color(0xa07e9c)];
  const landGround = [new THREE.Color(0x6a4a30), new THREE.Color(0x0a0806)];
  const sunCol = [new THREE.Color(0xffb67a), new THREE.Color(0xff5a2a)];
  const mirrorDay = new THREE.Color(1, 1, 1);
  const mirrorNight = new THREE.Color(0.06, 0.07, 0.12);
  const lampLevel = { brake: 1, gauges: 0, beam: 0, left: 0, right: 0 };

  // where a needle points: `f` of the way round its dial
  const point = (id, f) => {
    const D = DIALS[id];
    needles[id].rotation.z = -(D.from + clamp01(f) * D.sweep);
  };

  return {
    inside,
    outside,
    environment: env,
    eye: EYE,
    rest: REST,
    range: [1.95, 0.5],
    hfov: 92,
    vmin: 58,
    vmax: 100,
    exposure: 0.95,
    envIntensity: ENV,
    glance: -1.0,
    bloom: [0.32, 0.45, 0.88],
    flash: '#060914',
    rumble: 0.8,
    triggers: [wheelHit, shifterHit, knob, stalk],
    resize(w, h, px) {
      stars.set({ px });
    },
    launch() {},
    // the head turned for you: out of the left window at the wing as it
    // swings out, back ahead before it lifts; then, outside, after the RV
    aim(lt, p) {
      if (flyer && lt >= p.cut) {
        const f = flightAt(clamp01((lt - p.cut) / (p.peak - p.cut)));
        return [Math.atan2(-f.x, -f.z) - REST[0], Math.atan2(f.y + 1, Math.hypot(f.x, f.z)) - REST[1]];
      }
      const side = smooth((lt - p.wings + 300) / 700) - smooth((lt - p.jets - 500) / 900);
      return [1.42 * side, -0.12 * side];
    },
    update(dt, t, { launching, t: lt, plan }) {
      const dr = launching ? driveAt(plan, lt) : { d: 0, v: 0, k: 0 };
      const { d, v, k } = dr;
      const p = plan;

      // ── the time of day ──
      const sink = 14 * smooth(k / 0.62);
      const dusk = smooth((k - 0.1) / 0.45);
      const night = smooth((k - 0.4) / 0.38);
      const starsK = smooth((k - 0.38) / 0.42);
      const lights = smooth((k - 0.3) / 0.04);
      const glow = smooth((k - 0.26) / 0.18);
      const lift = launching ? smooth((lt - p.lift) / (p.peak - p.lift)) : 0;
      // from outside, at the last: how far through that shot (−1 before it)
      const out = flyer && launching && lt >= p.cut ? clamp01((lt - p.cut) / (p.peak - p.cut)) : -1;
      const el = SUN_EL - sink;
      setSun(el);
      const up = clamp01((el + 1.5) / 6);
      skyU.uSink.value = sink;
      skyU.uDusk.value = dusk;
      skyU.uNight.value = night;
      skyU.uSunK.value = (0.35 + 0.65 * up) * (1 - night);
      skyU.uLift.value = lift;
      skyU.uSunCol.value.setRGB(1, 0.72 - 0.3 * dusk, 0.42 - 0.25 * dusk);
      if (k < 0.55) haze.color.value.copy(dayHaze).lerp(duskHaze, dusk);
      else haze.color.value.copy(duskHaze).lerp(nightHaze, night);
      // the higher you climb, the more air between you and the land: it
      // sinks into its haze, darker, until only the towns' lights are left
      haze.color.value.multiplyScalar(1 - 0.45 * lift);
      haze.k.value = (1 + 5 * lift) / (3200 - 1600 * night);
      // the blur of speed on the ground and the road (hazy's `rush`)
      const rush = smooth((v - 15) / 110);
      haze.rush.value = 8 * rush;
      // (and a lamp as low as a headlight rakes the dirt, every grain of its
      // relief lit or black: it eases off as the lamps come on too)
      groundM.normalScale.setScalar((1.2 - 0.8 * lights) * (1 - rush));
      roadM.normalScale.setScalar(1 - rush);
      stars.set({ fade: starsK });
      sunGlow.position.copy(sunDir).multiplyScalar(2400).add(skyDome.position);
      sunHalo.position.copy(sunGlow.position);
      sunGlow.material.opacity = 0.85 * up;
      sunHalo.material.opacity = 0.13 * up + 0.1 * dusk * (1 - night);
      sunLight.position.copy(sunDir).multiplyScalar(450).add(sunLight.target.position);
      sunLight.intensity = 2.6 * up;
      // once the sun is down nothing casts a shadow (the sun outside and the
      // key light in the cab both go with it): the shadow maps stop being
      // redrawn, which is most of a frame's geometry for the rest of the drive
      sunLight.shadow.autoUpdate = up > 0;
      key.shadow.autoUpdate = up > 0;
      sunLight.color.copy(sunCol[0]).lerp(sunCol[1], dusk);
      landHemi.color.copy(landSky[0]).lerp(landSky[2], dusk).lerp(landSky[1], night);
      landHemi.groundColor.copy(landGround[0]).lerp(landGround[1], night);
      landHemi.intensity = 1.0 - 0.3 * dusk - 0.45 * night;
      town.material.opacity = smooth((k - 0.42) / 0.3);
      // (the headlights are the cab's: seen from outside, the RV is out in
      // front of where they shine from, and would stand in its own beam)
      beams.intensity = out < 0 ? 420 * lights * (1 - lift) : 0;

      // ── the road going by ──
      if (d !== lastD) {
        for (const [tex, tile] of scrolls) tex.offset.y = (d / tile) % 1;
        power.position.z = d % (POLE_GAP * PERIOD);
        fence.position.z = d % (POST_GAP * FENCE_PERIOD);
        mesas.position.z = d;
        for (const s of scatters) s.update(d);
        lastD = d;
      }
      // rising into the night: the land drops, the nose comes up
      world.position.y = -1100 * lift ** 2.2;
      tilt.rotation.x = -0.2 * lift;

      // ── the wings ──
      // out of the sides (the left a moment before the right), a hard lock,
      // then the jets catch and burn hotter as it climbs
      const open = [0, 300].map((lag) => (launching ? smooth((lt - p.wings - lag) / 1200) : 0));
      const lit = launching ? smooth((lt - p.jets) / 450) * (0.75 + 0.25 * smooth((lt - p.lift) / 1500)) : 0;
      const nav = launching ? smooth((lt - p.wings - 1500) / 200) : 0;
      wings?.set(open, lit, nav, night, t);
      if (wings && open[1] > 0.92 && open[1] < 1) swing.v += (Math.random() - 0.5) * 2 * dt * 30; // the lock shakes the little tree
      // and from outside, at the last: the cab gone, the RV ahead of you
      // climbing away into the stars
      inside.visible = out < 0;
      if (flyer) {
        flyer.group.visible = out >= 0;
        if (out >= 0) {
          const f = flightAt(out);
          flyer.group.position.set(EYE[0] + f.x, EYE[1] + f.y, EYE[2] + f.z);
          flyer.group.rotation.set(f.pitch, f.yaw, f.roll + 0.03 * Math.sin(t * 1.7), 'YXZ');
          flyer.set(1, t);
        }
      }
      // the crystals out of the back, and Hank after them
      blue.mesh.visible = out >= 0;
      if (out >= 0) blue.set(out, (p.peak - p.cut) / 1000, doorAt);
      if (hank) {
        hank.group.visible = out >= 0;
        if (out >= 0) {
          const f = flightAt(out);
          const c = chaseAt(out);
          hank.group.position.set(EYE[0] + f.x + c.x, EYE[1] + f.y + c.y, EYE[2] + f.z + c.z);
          hank.group.rotation.set(0.18, f.yaw * 0.6, 0.06 * Math.sin(t * 2.3), 'YXZ');
          hank.set(t);
        }
      }
      flyerLight.intensity = out >= 0 ? 1.3 : 0;

      // ── what's said ──
      if (launching) {
        cues ??= [
          [p.wings + 200, LINES.wings[0]],
          [p.wings + 2700, LINES.wings[1]],
          [p.lift + 100, LINES.lift[0]],
          [p.cut + 250, LINES.chase[0]],
          [p.cut + 1500, LINES.chase[1]],
          [p.cut + 2600, LINES.chase[2]],
        ];
        for (const l of due(cues, saidTo, lt)) say?.(l);
        saidTo = lt;
      } else saidTo = 0;

      // ── in the cab ──
      key.intensity = 2.2 * up;
      key.color.copy(sunCol[0]).lerp(sunCol[1], dusk * 0.6);
      bounce.intensity = 0.5 * up;
      hemi.color.copy(hemiSky[0]).lerp(hemiSky[1], dusk * 0.5 + night * 0.5);
      hemi.groundColor.copy(hemiGround[0]).lerp(hemiGround[1], night);
      const dim = Math.max(dusk * 0.7, night);
      hemi.intensity = 0.4 * (1 - 0.78 * dim);
      moon.intensity = 0.3 * night;
      faceM.emissiveIntensity = 1.3 * glow;
      needleM.emissiveIntensity = 0.25 + 1.6 * glow;
      radioM.emissiveIntensity = 0.15 + 1.2 * glow;
      dashGlow.intensity = 0.5 * glow;
      radioGlow.intensity = 0.15 * glow;
      const envK = 1 - 0.92 * dim;
      for (const m of reflective) m.envMapIntensity = (env ? ENV : 1) * envK;
      glassLight.setRGB(1, 0.9, 0.76).lerp(tmpC.setRGB(0.14, 0.2, 0.34), dim);
      glassM.userData.setLight?.(glassLight);
      for (const g of sideGlass) g.material.color.copy(mirrorDay).lerp(mirrorNight, Math.max(dusk * 0.8, night));
      rearGlass.material.color.copy(mirrorDay).lerp(mirrorNight, Math.max(dusk * 0.8, night) * 0.8);

      // the gauges: the speedometer follows the drive, the rest settle in
      const mph = 85 * (1 - Math.exp(-v / 42));
      point('speed', (mph + (v > 1 ? Math.sin(t * 23) * 0.4 : 0)) / 85);
      point('fuel', 0.62 - 0.05 * k);
      point('temp', 0.47 + 0.06 * smooth(k * 2));
      point('oil', (launching ? 0.45 + 0.2 * clamp01(v / 30) : 0.34) + Math.sin(t * 9) * 0.008);
      point('volts', 0.56 + Math.sin(t * 3.1) * 0.006);
      // lamps: the parking brake's goes out as you go; the high beams come on with the dark
      lampLevel.brake = launching && lt > 260 ? 0 : 1;
      lampLevel.beam = lights;
      for (const [id, m] of Object.entries(lamps)) m.material.color.copy(m.userData.col).multiplyScalar(0.05 + 2.2 * lampLevel[id]);

      // into drive: the shifter comes down through the gate
      const wantShift = launching ? smooth((lt - 120) / 280) : 0;
      shiftK += (wantShift - shiftK) * Math.min(1, dt * 20);
      shifter.rotation.z = 0.22 - 0.5 * shiftK;
      gearPointer.position.x = -0.0285 + 0.0475 * shiftK * 0.67;
      // small corrections at the wheel while the road goes by
      const steer = launching ? (0.05 * Math.sin(t * 0.8) + 0.025 * Math.sin(t * 2.1 + 1)) * clamp01(v / 15) * (1 - lift) : 0;
      spin.rotation.z += (steer - spin.rotation.z) * Math.min(1, dt * 3);

      // the little tree: thrown back as you speed up, set swinging by the road
      const accel = dt > 0 ? (v - lastV) / Math.max(dt, 0.016) : 0;
      lastV = v;
      const sdt = Math.min(dt, 0.05);
      const target = -Math.atan(Math.min(accel, 60) / 9.8) * 0.5;
      swing.v += ((target - swing.a) * 38 - swing.v * 1.6) * sdt + (launching ? (Math.random() - 0.5) * 0.4 * clamp01(v / 20) : 0) * sdt * 30;
      swing.a += swing.v * sdt;
      swing.w += (-swing.b * 30 - swing.w * 1.2) * sdt + (launching ? (Math.random() - 0.5) * 0.3 * clamp01(v / 20) : 0) * sdt * 30;
      swing.b += swing.w * sdt;
      tree.rotation.set(swing.a + Math.sin(t * 1.3) * 0.02, Math.sin(t * 0.5) * 0.4, swing.b + Math.sin(t * 1.7) * 0.015);

      // (how the ride feels to the two of them, eased: the pull of the
      // speed coming on, the sway of the steering, the lift, the wings out)
      {
        const push = launching ? clamp01((v - 2) / 18) * (1 - lift) : 0;
        const sway = launching ? steer * 6 : 0;
        const k = Math.min(1, dt * 4);
        ride.push += (push - ride.push) * k;
        ride.sway += (sway - ride.sway) * k;
        ride.lift += (lift * (1 - smooth((lt - p.peak) / 2500)) - ride.lift) * k;
        ride.wings += (open[0] * (1 - smooth((lt - p.wings - 4500) / 1500)) - ride.wings) * k;
      }
      jesseMove?.(t);
      waltMove?.(t);
    },
    dispose() {
      gone = true;
      for (const off of undress) off();
      jesse?.dispose();
      walt?.dispose();
      models.dispose();
      renderer.shadowMap.enabled = false;
      env?.dispose();
    },
  };
}
