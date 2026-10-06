// The Graysons' city in 3D, to fly about as Invincible: the land and the
// water (./ground.js), the city (./city.js), Mark (the page's HD figure,
// posed every frame by lib/three/rig: standing, walking, running, hanging
// in the air, flat out with a fist ahead, down on one knee after a hard
// landing), his father keeping an eye on the city from over downtown, and
// what flying leaves behind (./fx.js). The rules (./flight.js) say where
// he is; this draws it, with a camera behind him that pulls back and
// widens with speed and never ends up inside a building.

import * as THREE from 'three';
import { createEngine } from '../../avengers/hq/engine';
import { createFeel } from '../../avengers/hq/feel';
import { POSES, figure, loadFigure } from '../../../lib/three/rig';
import { CAST, asset } from '../cast';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { createChallenges } from './challenges';
import { buildCity } from './city';
import { createFlaxans } from './flaxans';
import { surfaceAt } from './flight';
import { createFlightFx } from './fx';
import { buildGround } from './ground';
import { buildJet } from './jet';
import { buildLandmarks } from './landmarks';
import { buildLife } from './life';
import { LINES, createNpcs } from './npcs';
import { buildClouds } from './sky';
import { createTraffic, stepTraffic } from './traffic';
import { WATER_Y, WORLD, buildWorld, groundAt, near } from './map';
import { BODIES, altitudeOf } from './orbit';
import { buildPerson, posePerson } from './people';
import { buildSpace } from './space';

const FOV = 64;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (v, to, rate, dt) => v + (to - v) * (1 - Math.exp(-rate * dt));
const Y = new THREE.Vector3(0, 1, 0);

// the times of day: the sky, how it sits, the light, the haze, the night
export const TIMES = ['noon', 'dusk', 'night'];
const LOOK = {
  noon: { sky: 'noon', rotate: 0.6, env: 1, bg: 1, sun: 3, fill: 0.22, fog: { density: 0.00026, tint: 0.95 }, night: 0, exposure: 1, cloud: { lit: [1, 1, 1], shade: [0.62, 0.66, 0.74] } },
  dusk: { sky: 'dusk', rotate: 2.2, env: 0.62, bg: 1, sun: 2.6, sunColor: [1, 0.66, 0.4], fill: 0.16, fog: { density: 0.0003, tint: 0.7 }, night: 0.5, exposure: 1, cloud: { lit: [1, 0.74, 0.52], shade: [0.42, 0.36, 0.42] } },
  night: { sky: 'night', rotate: 0, env: 0.22, bg: 0.2, sun: 0.7, sunDir: [-0.3, 0.75, -0.4], sunColor: [0.62, 0.72, 1], fill: 0.4, fog: { density: 0.00024, color: new THREE.Color(0.05, 0.06, 0.08) }, night: 1, exposure: 1, cloud: { lit: [0.14, 0.16, 0.22], shade: [0.06, 0.07, 0.1], opacity: 0.7 } },
};

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

export async function createInvWorld(canvas, { onLost, onSlow, calm = false } = {}) {
  const engine = createEngine(canvas, { exposure: 1, fov: FOV, near: 0.3, far: 26000, bloom: { strength: 0.5, radius: 0.5, threshold: 0.92 }, onLost, onSlow });
  const { scene, camera } = engine;
  const small = engine.small;
  const world = buildWorld();

  const ground = buildGround(world, { small });
  const city = buildCity(world, { small });
  const landmarks = await buildLandmarks(world, city.uniforms);
  scene.add(ground.group, city.group, landmarks.group);
  // who's about, the clouds, and the airliner going round
  const npcs = createNpcs(scene, world);
  const clouds = buildClouds({ small });
  scene.add(clouds.mesh);
  const jet = buildJet();
  scene.add(jet.group);
  // the traffic and the people on the pavements, always round the camera
  let traffic = createTraffic({ cars: small ? 260 : 420, walkers: small ? 160 : 260 });
  const life = buildLife(traffic);
  scene.add(life.group);
  // (a shadow box this big wants more bias than the HQ games' rooms)
  engine.sun.shadow.normalBias = 0.12;
  engine.sun.shadow.bias = -0.0006;

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
  // Omni-Man, over downtown, hands on his hips
  const OMNI = { p: [40, 150, -60], yaw: Math.PI * 0.85 };

  // ── space: the Earth under him, the Moon, Mars, and who's waiting out there ──
  const space = await buildSpace(engine.renderer, { small });
  scene.add(space.group, space.stars);
  space.stars.visible = false;
  const toEarth = (c) => {
    const l = Math.hypot(...c);
    return c.map((v) => -v / l);
  };
  // Allen, between the Moon and home; Thragg, over Mars, facing Earth
  const moon = BODIES.find((b) => b.id === 'moon');
  const mars = BODIES.find((b) => b.id === 'mars');
  const ALLEN = moon.c.map((v, i) => v + toEarth(moon.c)[i] * (moon.r + 30));
  const THRAGG = mars.c.map((v, i) => v + toEarth(mars.c)[i] * (mars.r + 45));
  const allen = buildPerson('allen', 9);
  const allenHolder = new THREE.Group();
  allen.h.root.position.y = -allen.h.rest.hips.y;
  allenHolder.add(allen.h.root);
  allenHolder.position.set(...ALLEN);
  allenHolder.rotation.y = Math.atan2(-ALLEN[0], -ALLEN[2]);
  space.group.add(allenHolder);
  thragg.holder.removeFromParent();
  space.group.add(thragg.holder);
  const spaceTalk = [
    { id: 'allen', name: 'Allen', p: ALLEN, r: 70, lines: LINES.allen },
    { id: 'thragg', name: 'Thragg', p: THRAGG, r: 90, lines: LINES.thragg },
  ];

  const fx = createFlightFx(scene, { calm, small });
  const challenges = createChallenges(scene, world, fx.vfx);
  const flaxans = createFlaxans(scene, fx.vfx, { calm });
  const feel = createFeel({ calm, baseFov: FOV, offset: 0.4 });

  // ── the time of day ──
  let look = null;
  let haze = 1;
  let timeName = 'noon';
  let zone = 'city';
  const fogBase = new THREE.Color();
  async function setTime(name) {
    const L = LOOK[name] ?? LOOK.noon;
    timeName = name;
    space.setTime(name);
    if (look === L || zone === 'space') return;
    look = L;
    scene.fog = null;
    await engine.setSky(L.sky, { rotate: L.rotate, envIntensity: L.env, bgIntensity: L.bg, sunIntensity: L.sun, sunColor: L.sunColor, sunDir: L.sunDir, fill: L.fill, fog: L.fog });
    engine.renderer.toneMappingExposure = L.exposure;
    ground.setNight(L.night);
    city.setNight(L.night);
    landmarks.setNight(L.night);
    clouds.setLook(L.cloud);
    haze = 1;
    if (scene.fog) fogBase.copy(scene.fog.color);
  }
  await setTime('noon');

  // ── the city or space: one or the other is drawn ──
  const cityOnly = [ground.group, city.group, landmarks.group, clouds.mesh, jet.group, life.group, challenges.group, flaxans.group, omni.holder];
  async function setZone(z) {
    if (z === zone) return;
    zone = z;
    for (const g of cityOnly) g.visible = z === 'city';
    for (const n of npcs.all) n.holder.visible = z === 'city';
    space.group.visible = z === 'space';
    if (z === 'space') {
      scene.background = new THREE.Color(0, 0, 0.004);
      scene.fog = null;
      scene.environmentIntensity = 0.08;
      engine.sun.color.setRGB(1, 0.97, 0.92);
      engine.sun.intensity = 3.4;
      engine.hemi.intensity = 0.04;
      engine.sun.userData.dir = space.sun.clone();
      space.stars.visible = true;
      space.stars.material.color.setScalar(1);
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
  function carry(f, p, yaw, v, dt, { lean = 1, roll = 0, lift = 0 } = {}) {
    f.holder.position.set(p[0], p[1] + f.hipHeight + lift, p[2]);
    f.holder.rotation.set(0, yaw, 0);
    const speed = Math.hypot(v[0], v[1], v[2]);
    const k = clamp((speed - 8) / 30, 0, 1) * lean;
    const dir = speed > 0.1 ? vTmp.set(v[0], v[1], v[2]).divideScalar(speed) : vTmp.copy(Y);
    dir.lerpVectors(Y, dir, k).normalize();
    qYaw.setFromAxisAngle(Y, -yaw);
    dir.applyQuaternion(qYaw); // into his own frame
    qTmp.setFromUnitVectors(Y, dir);
    if (roll) qTmp.multiply(new THREE.Quaternion().setFromAxisAngle(Y, roll));
    f.lean.slerp(qTmp, dt === 0 ? 1 : 1 - Math.exp(-8 * dt));
    f.body.quaternion.copy(f.lean);
    return k;
  }

  // ── the camera: behind him, pulled back and widened with speed ──
  const cam = { dist: 6, fov: FOV, pos: new THREE.Vector3(), at: new THREE.Vector3(), ready: false, near: 0.3 };
  const list = [];
  function placeCamera(h, yaw, pitch, speed, dt) {
    const fly = h.mode === 'air';
    const k = clamp(speed / 260, 0, 1);
    const want = h.mode === 'ground' ? 5.2 : 6.5 + k * 1.5;
    cam.dist = dt === 0 ? want : damp(cam.dist, want, 2.4, dt);
    // standing on the Moon or Mars, "up" is away from it: the camera's frame turns with it
    const upV = h.mode === 'perch' ? new THREE.Vector3(...h.perch.n) : Y;
    const qUp = new THREE.Quaternion().setFromUnitVectors(Y, upV);
    const f3 = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(qUp);
    const fwd = [f3.x, f3.y, f3.z];
    const lift = upV.clone().multiplyScalar(fly ? 1.2 : 1.55);
    const anchor = [h.p[0] + lift.x, h.p[1] + lift.y, h.p[2] + lift.z];
    // (higher over him the faster he goes, so flat out you see his back, not his boots)
    const over = upV.clone().multiplyScalar(fly ? 0.9 + k * 2.6 : 0.7);
    const back = [-fwd[0] * cam.dist + over.x, -fwd[1] * cam.dist + over.y, -fwd[2] * cam.dist + over.z];
    // never inside a building: stop short of the first wall behind him
    let t = 1;
    const reach = cam.dist + 2;
    if (zone === 'city')
      for (const b of near(world, anchor[0], anchor[2], reach, list)) {
        const g = { x0: b.x0 - 0.4, x1: b.x1 + 0.4, y0: b.y0 - 0.4, y1: b.y1 + 0.4, z0: b.z0 - 0.4, z1: b.z1 + 0.4 };
        t = Math.min(t, rayBox(anchor, back, g));
      }
    t = Math.max(0.08, t);
    const pos = new THREE.Vector3(anchor[0] + back[0] * t, anchor[1] + back[1] * t, anchor[2] + back[2] * t);
    if (zone === 'city') pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 0.5, -2);
    else
      for (const b of BODIES) {
        // (and never inside the Moon)
        const d = pos.clone().sub(new THREE.Vector3(...b.c));
        if (d.length() < b.r + 1.5) pos.copy(new THREE.Vector3(...b.c).addScaledVector(d.normalize(), b.r + 1.5));
      }
    const at = new THREE.Vector3(anchor[0] + fwd[0] * 4, anchor[1] + fwd[1] * 4, anchor[2] + fwd[2] * 4);
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
    // the near plane moves out as he climbs (the depth buffer goes further)
    const alt = zone === 'space' ? altitudeOf(h) : h.p[1] - groundAt(h.p[0], h.p[2]);
    const nearWant = zone === 'space' ? 2 : clamp(alt * 0.004, 0.25, 3);
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
    // the shadows: round him, wider the higher he is (in space, just his own)
    if (zone === 'space') engine.setShadowBox(new THREE.Vector3(...h.p), 6, 40);
    else engine.setShadowBox(new THREE.Vector3(h.p[0], Math.max(0, h.p[1] - alt), h.p[2]), clamp(60 + alt * 0.4, 60, 360), 600 + Math.min(alt, 1500));
    // the haze thins as the air does; high up, the sky goes dark and the stars come out
    if (zone === 'city' && scene.fog?.isFogExp2 && look) {
      const thin = clamp(1 - alt / 2600, 0.3, 1);
      const dark = THREE.MathUtils.smoothstep(alt, 2500, WORLD.ceiling);
      if (Math.abs(thin - haze) > 0.005 || dark > 0) {
        haze = thin;
        scene.fog.density = look.fog.density * thin * (1 - dark * 0.5);
        scene.fog.color.copy(fogBase).lerp(new THREE.Color(0.01, 0.015, 0.04), dark * 0.85);
        scene.backgroundIntensity = look.bg * (1 - 0.94 * dark);
      }
      space.stars.visible = dark > 0.02;
      space.stars.material.color.setScalar(dark);
    }
  }

  // ── other players online, in their own worlds, as holograms ──
  // (as the Middle-earth towns show theirs: ../../middleearth/towns/ghosts.js)
  // each a pale, shimmering Mark with his name over him: walking, hanging in
  // the air, flat out, or stood on the Moon. Nothing here touches them, nor
  // they anything here. InvWorld's placeOf says where: in the city, x and z
  // and how high over the land or the water; in space, just where (and
  // which way's up there, and how high over it)
  const gAt = new THREE.Vector3();
  const gUp = new THREE.Vector3();
  const gYaw = new THREE.Quaternion();
  const gQ = new THREE.Quaternion();
  const ghosts = createGhosts({
    height: (x, z) => (zone === 'city' ? Math.max(groundAt(x, z), WATER_Y) : 0),
    make: () => {
      const f = figure(markT, CAST.mark); // (he faces +z, as a ghost's face has it)
      f.snap(POSES.stand);
      const group = new THREE.Group();
      group.add(f.holder);
      return { group, top: CAST.mark.h, fig: f, gait: 0, at: null, v: new THREE.Vector3(), dispose: () => f.dispose() };
    },
    animate: (f, gt, p, gdt) => {
      const fig = f.fig;
      const speed = p.speed ?? 0;
      // off the ground: over the land, the water or a roof (or the Moon, or Mars)
      const y = p.over == null ? Math.max(groundAt(p.x, p.z), WATER_Y) + (p.y ?? 0) : 0;
      const air = (p.over ?? y - surfaceAt(world, p.x, p.z, y + 0.3).y) > 0.8;
      // which way they're going, from how the ghost itself moves (the room says how fast, not where)
      f.group.updateWorldMatrix(true, false);
      gAt.setFromMatrixPosition(f.group.matrixWorld);
      if (f.at && gdt > 0) f.v.lerp(gUp.subVectors(gAt, f.at).divideScalar(gdt), 1 - Math.exp(-4 * gdt));
      f.at = (f.at ?? new THREE.Vector3()).copy(gAt);
      // stood up the way that's up where they are (on the Moon, away from it), turned the way they face
      gYaw.setFromAxisAngle(Y, -f.group.rotation.y);
      if (!air && p.up) gUp.fromArray(p.up);
      else gUp.copy(Y);
      fig.holder.position.copy(gUp).applyQuaternion(gYaw).multiplyScalar(fig.hipHeight);
      // in the air: upright when still, along the way they're going when fast (as Mark is)
      const k = air ? clamp((f.v.length() - 8) / 30, 0, 1) : 0;
      gAt.copy(f.v.lengthSq() > 0.01 ? f.v : Y).normalize();
      gAt.lerpVectors(Y, gAt, k).normalize().applyQuaternion(gYaw);
      fig.body.quaternion.slerp(gQ.setFromUnitVectors(Y, gAt), 1 - Math.exp(-8 * gdt));
      fig.holder.quaternion.setFromUnitVectors(Y, gUp).premultiply(gYaw).multiply(gYaw.invert());
      if (air) fig.pose(k > 0.45 ? POSES.fly() : POSES.hover(gt), gdt, 9);
      else {
        f.gait += speed * gdt * 1.55;
        fig.pose(speed > 0.3 ? POSES.stride(f.gait, clamp(speed / 2, 0, 1), clamp((speed - 4) / 5, 0, 1)) : POSES.stand, gdt, 14);
      }
    },
    tag: 0.5,
    halo: 1.3,
    snap: 150, // (flying, they're tens of metres on from one pose to the next)
  });
  scene.add(ghosts.group);

  // ── every frame ──
  let t = 0;
  let stride = 0;
  function frame(sim, frameDt) {
    // (the QA scripts' `snap`: the camera and his pose straight to where they're going)
    const snap = Boolean(sim.snap);
    const dt = snap ? 1 : frameDt;
    t += frameDt;
    const h = sim.h;
    const speed = Math.hypot(h.v[0], h.v[1], h.v[2]);
    // what happened this frame (and what sends the people and the traffic running)
    const scare = [];
    for (const e of sim.events) {
      if (e.type === 'slam') scare.push({ x: e.at[0], z: e.at[2], r: 25 + e.speed * 0.25 });
      else if (e.type === 'impact') scare.push({ x: e.at[0], z: e.at[2], r: 35 });
      else if (e.type === 'boom' && e.at[1] - groundAt(e.at[0], e.at[2]) < 90) scare.push({ x: e.at[0], z: e.at[2], r: 60 });
      if (e.type === 'boom') {
        fx.boom(e.at, e.dir);
        feel.trauma(0.45);
        feel.punch(6);
      } else if (e.type === 'slam') {
        fx.slam(e.at, e.speed);
        feel.trauma(clamp(e.speed / 150, 0.3, 1));
      } else if (e.type === 'impact') {
        fx.impact(e.at, e.n, e.speed);
        feel.trauma(clamp(e.speed / 120, 0.4, 1));
      } else if (e.type === 'splash') fx.splash(e.at, e.speed);
      else if (e.type === 'takeoff') fx.takeoff(e.at);
      else if (e.type === 'spawn' || e.type === 'ko' || e.type === 'down' || e.type === 'hurt' || e.type === 'won') {
        // the Flaxans: coming through, knocked out, hitting him
        flaxans.fx(e);
        if (e.type === 'ko') {
          feel.trauma(0.3);
          feel.hitstop(60);
          scare.push({ x: e.at[0], z: e.at[2], r: 30 });
        } else if (e.type === 'hurt') feel.trauma(0.35);
      } else if (e.type === 'land' && e.n) {
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
      mark.pose(POSES.proud(), dt, 6);
    } else if (h.mode === 'ground') {
      const flat = Math.hypot(h.v[0], h.v[2]);
      stride += flat * frameDt * 1.55;
      carry(mark, h.p, h.face, [0, 0, 0], dt, { lean: 0, lift: h.crouch > 0 ? -mark.hipHeight * 0.42 : 0 });
      if (h.crouch > 0) mark.pose(LAND, dt, 18);
      else if (flat > 0.3) mark.pose(POSES.stride(stride, clamp(flat / 2, 0, 1), clamp((flat - 4) / 5, 0, 1)), dt, 14);
      else mark.pose(POSES.stand, dt, 8);
    } else if (h.stun > 0) {
      carry(mark, h.p, h.face, h.v, dt, { lean: 0.4, roll: t * 9 });
      mark.pose(POSES.hurt(), dt, 14);
    } else {
      const k = carry(mark, h.p, h.face, h.v, dt, { lean: 1 });
      // a punch thrown hanging in the air (flat out, the fly pose's fist is already ahead)
      mark.pose(k > 0.45 ? POSES.fly() : sim.punchT > 0 ? POSES.punch([0, 0.1, 1]) : POSES.hover(t), dt, sim.punchT > 0 ? 30 : 9);
    }
    if (h.mode === 'ground' && sim.punchT > 0 && h.crouch <= 0) mark.pose(POSES.punch([0, 0.1, 1]), dt, 30);

    if (zone === 'city') {
      // his father, keeping an eye on things
      const bob = Math.sin(t * 0.7) * 1.2;
      carry(omni, [OMNI.p[0], OMNI.p[1] + bob, OMNI.p[2]], OMNI.yaw, [0, 0, 0], dt, { lean: 0 });
      omni.pose(POSES.proud(), dt, 6);
      // (the QA scripts can hold everyone still, to frame them)
      if (!sim.hold) {
        npcs.update(frameDt, t, h);
        jet.update(frameDt, t);
      }
      if (sim.quests) challenges.update(sim.quests, frameDt, t);
      if (sim.fight) flaxans.update(sim.fight, frameDt, t, h);
      // (no traffic to speak of from up where the clouds are)
      if (h.p[1] < 2200 || scare.length) {
        traffic = stepTraffic(traffic, frameDt, { cx: camera.position.x, cz: camera.position.z, yaw: sim.yaw, scare });
        life.update(traffic, frameDt, camera, look?.night ?? 0);
      }
      clouds.update(t, scene.fog);
    } else {
      // Allen, waiting by the Moon; Thragg over Mars
      posePerson(allen, { mode: 'hover', t });
      carry(thragg, [THRAGG[0], THRAGG[1] + Math.sin(t * 0.6), THRAGG[2]], Math.atan2(-THRAGG[0], -THRAGG[2]), [0, 0, 0], dt, { lean: 0 });
      thragg.pose(POSES.proud(), dt, 6);
    }
    space.update(t, camera);
    // other players online: in the city, or out here with him
    ghosts.update(sim.travellers ?? [], t, frameDt);

    placeCamera(h, sim.yaw, sim.pitch, speed, snap ? 0 : dt);
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
    const d = Math.hypot(h.p[0] - OMNI.p[0], h.p[1] - OMNI.p[1], h.p[2] - OMNI.p[2]);
    if (d < 45) out.push({ id: 'omni', role: 'omni', name: 'Dad', lines: LINES.omni, head: [OMNI.p[0], OMNI.p[1] + 1.2, OMNI.p[2]], d });
    return out.sort((a, b) => a.d - b.d);
  };
  const tmpV = new THREE.Vector3();
  const jetDistance = (h) => jet.near(tmpV.set(h.p[0], h.p[1] + 1, h.p[2]));

  return {
    engine,
    world,
    frame,
    setTime,
    project,
    talkers,
    jetDistance,
    setZone,
    get zone() {
      return zone;
    },
    debug: { npcs, jet, world, bodies: BODIES, allen: ALLEN, thragg: THRAGG },
    resize: (w, hh) => engine.resize(w, hh),
    get lost() {
      return engine.lost;
    },
    info: () => ({ ...engine.info(), bound: WORLD.half }),
    dispose() {
      fx.dispose();
      ghosts.dispose();
      mark.dispose();
      omni.dispose();
      thragg.dispose();
      engine.dispose();
    },
  };
}
