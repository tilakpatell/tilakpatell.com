// The Citadel of Ricks in WebGL: the concourse (./concourse.js), the two
// rooms under it (./rooms.js) and the people (./people.js), drawn in the
// show's look (toon shading and the ink line from ../portal/toon.js, bloom
// on the light strips), with the third-person camera the towns use and a
// camera for each room's beat and for the cruiser getting away. The state
// it draws comes from ./CitadelWorld.jsx each frame, with its cues (what's
// just happened, for the people to react to). Every figure is stepped as
// lib/three/animBudget.js says: near and in view every frame, further off
// less often, out of view not at all; the crowd's nearest few are live
// figures of the people's cast (./crowd.js's live).
//
// createCitadelWorld(canvas, { onLost }) → Promise<{ render(state, ms),
// fx(type, at?), screenOf(kind, id), resize, dispose, info, lost,
// suggestYaw }>

import * as THREE from 'three';
import { createStage } from '../../../lib/stage3d';
import { createModels } from '../../../lib/models';
import { device } from '../../../lib/device';
import { allOrUndo } from '../../../lib/settle';
import { createFx } from '../../middleearth/shire/fx';
import { createGhosts } from '../../middleearth/towns/ghosts';
import { createAnimBudget } from '../../../lib/three/animBudget';
import { applyEmote } from '../../../lib/emote';
import { groundWorld } from '../../../lib/three/groundwork';
import { houseOn } from '../../../lib/three/house';
import { createMeshyCast } from '../portal/meshyCast';
import { InkPass } from '../portal/toon';
import { EDGE_BUILDINGS, buildConcourse } from './concourse';
import { createCrowd } from './crowd';
import { LIVE, createPeople } from './people';
import { ROOMS, buildRooms } from './rooms';
import { COLLIDERS, DOORS, PEN, RICK, spot } from './layout';
import { COLLIDERS as TOWN_COLLIDERS, COP, LIFT, MORTYTOWN, ORIGIN as TOWN } from './mortytown';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the buildings at the terrace's edge, which the camera keeps out of
const EDGE = { from: 40.6, to: 46.6 };

// a box in its own frame: how far outside it (x, z) is (negative inside)
function boxDist(b, x, z) {
  const t = b.turn || 0;
  const dx = x - b.x;
  const dz = z - b.z;
  const lx = dx * Math.cos(t) - dz * Math.sin(t);
  const lz = dx * Math.sin(t) + dz * Math.cos(t);
  return Math.max(Math.abs(lx) - b.w / 2, Math.abs(lz) - b.d / 2);
}
// what the camera can't go through
const BLOCKERS = COLLIDERS.filter((c) => !c.low).map((c) => ({ ...c, y: c.top ?? 3 }));
function insideAt(x, y, z) {
  if (y < 0.5) return true;
  const r = Math.hypot(x, z);
  if (r > EDGE.from && r < EDGE.to) {
    const a = Math.atan2(z, x);
    for (const b of EDGE_BUILDINGS) if (y < b.top + 0.4 && Math.abs(Math.atan2(Math.sin(a - b.a), Math.cos(a - b.a))) < b.half + 0.02) return true;
  }
  for (const c of BLOCKERS) {
    if (y > c.y) continue;
    if (c.kind === 'circle') {
      if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return true;
    } else if (boxDist(c, x, z) < 0.3) return true;
  }
  return false;
}
// Mortytown's: its blocks, the lift, and its edge (the camera is in the
// world's frame, the district at TOWN)
const TOWN_BLOCKERS = TOWN_COLLIDERS.filter((c) => !c.low).map((c) => ({ ...c, y: c.top ?? 3 }));
function insideTown(x, y, z) {
  const lx = x - TOWN.x;
  const ly = y - TOWN.y;
  const lz = z - TOWN.z;
  if (ly < 0.5) return true;
  if (ly < 9 && (lx < MORTYTOWN.x0 + 0.4 || lx > MORTYTOWN.x1 - 0.4 || lz < MORTYTOWN.z0 + 0.4 || lz > MORTYTOWN.z1 - 0.4)) return true;
  for (const c of TOWN_BLOCKERS) {
    if (ly > c.y) continue;
    if (c.kind === 'circle') {
      if (Math.hypot(lx - c.x, lz - c.z) < c.r + 0.3) return true;
    } else if (boxDist(c, lx, lz) < 0.3) return true;
  }
  return false;
}
// how far from `from` to `to` the camera can go before it's inside
// something, as a fraction
function clearance(from, to, inside = insideAt) {
  const N = 16;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    if (inside(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z + (to.z - from.z) * k)) return Math.max(0.16, (i - 1) / N);
  }
  return 1;
}

// looks: the wardrobe's ({ rick, morty }): Rick's is the one you walk about as
export async function createCitadelWorld(canvas, { onLost, looks = null } = {}) {
  const tier = device().tier;
  const soft = tier === 'low';
  const stage = createStage(canvas, { soft, shadows: false, fov: 52, near: 0.1, far: 520, bloom: { strength: 0.5, radius: 0.42, threshold: 0.9 }, onLost });
  stage.grade({ contrast: 0.08, saturation: 1.08, vignette: 0.2, grain: 0.008, shadow: [0.0, 0.012, 0.02], high: [0.02, 0.012, 0.0] });
  const { scene, camera, renderer } = stage;
  renderer.info.autoReset = false;
  // the city's golden haze
  scene.fog = new THREE.Fog(0xe0b57a, 80, 360);

  // ── light: a cool, even interior light, a key from the dome, and a pool
  // of lamps lent to the concourse round Rick, or to the room he's in ──
  const hemi = new THREE.HemisphereLight(0xffe9c4, 0x4d7a6c, 1.15);
  const key = new THREE.DirectionalLight(0xffe2b4, 1.35);
  key.position.set(-30, 60, 24);
  scene.add(hemi, key, key.target);
  const POOL = tier === 'high' ? 6 : tier === 'mid' ? 4 : 3;
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffffff, 0, 16, 1.6);
    scene.add(l);
    return l;
  });
  const alarm = new THREE.PointLight(0xff3040, 0, 60, 1.2);
  alarm.position.set(0, 14, 0);
  scene.add(alarm);

  // the sparks and puffs that say something happened (the Shire's, pooled)
  const fxRoot = new THREE.Group();
  scene.add(fxRoot);
  const fx = createFx(fxRoot, { scale: tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.35 });

  // ── what's drawn ──
  // (if any of it fails to load, what was made is undone, and the stage
  // with it, before the failure goes on to the page)
  const models = createModels({ base: '/games/kenney' });
  const made = [];
  let concourse, rooms, people, crowd, props;
  try {
    [concourse, rooms] = await allOrUndo([buildConcourse(renderer, { models, tier }), buildRooms(renderer, { models, tier })], made);
    scene.add(concourse.group, rooms.factory, rooms.council);
    [people, crowd] = await allOrUndo([createPeople({ outdoors: concourse.group, factory: rooms.factory, council: rooms.council, places: rooms.places, tier, look: looks?.rick ?? null }), createCrowd(concourse.group, { tier })], made);
    // (the crowd's nearest few, live: figures of the people's cast)
    crowd.live({ make: people.live, free: people.unlive }, LIVE);
    // the cruiser, waiting in the hangar
    props = createMeshyCast();
    made.push(props);
    await props.load(null, ['saucer']);
    concourse.setCruiser(props.prop('saucer', 1.7));
  } catch (e) {
    for (const m of made) m.dispose?.();
    models.dispose();
    stage.dispose();
    throw e;
  }

  // (Mortytown's sky and neon join these when it's built)
  const unlined = [...concourse.hide, fxRoot];
  if (!soft) {
    const big = Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800) >= 700;
    const ink = new InkPass(scene, camera, { hide: () => unlined, width: big ? 1.15 : 1 });
    stage.composer.insertPass(ink, 1);
  }

  // others online here (CitadelWorld's useTravellers), as the Middle-earth
  // towns and the Avengers compound show theirs: each a Rick from another
  // dimension (it's the Citadel: nobody blinks), pale and shimmering, with
  // their name over him. On the concourse only; nothing here touches them.
  const ghosts = createGhosts({
    make: () => {
      const o = people.other('rick');
      const group = new THREE.Group();
      if (!o) {
        group.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 4, 10).translate(0, 0.88, 0), new THREE.MeshStandardMaterial()));
        return { group, top: 1.8 };
      }
      o.f.group.rotation.y = Math.PI / 2; // (a ghost's face, like Rick's, is measured from +x; a figure faces +z)
      group.add(o.f.group);
      return { group, top: 1.95, rick: o, shared: true, dispose: o.stop };
    },
    // their feet paced to how they say they move, and what they've struck off
    // their wheel (an older client's packet has neither: their pace as before)
    animate: (f, t, p) => {
      const m = p.motion ?? null;
      f.rick?.step(t, Math.min(1, Math.abs(m?.speed ?? p.speed ?? (p.moving ? RICK.walk : 0)) / RICK.run), m ? { speed: m.speed ?? 0, side: m.side ?? 0, turn: m.turn ?? 0 } : null);
      if (f.rick) f.shown = applyEmote(f.rick.f, p.emote ?? null, f.shown ?? null);
    },
    tag: 0.36,
    halo: 0.9,
  });
  concourse.group.add(ghosts.group);

  // how often each figure's stepped, and whether it's on screen (by last
  // frame's camera: near enough)
  const budget = createAnimBudget({ near: 12, far: 40, max: tier === 'high' ? 40 : tier === 'mid' ? 24 : 14 });
  const frustum = new THREE.Frustum();
  const viewProj = new THREE.Matrix4();
  const ball = new THREE.Sphere(new THREE.Vector3(), 1.3);
  const view = (p) => {
    ball.center.set(p.x, p.y + 0.9, p.z);
    return frustum.intersectsSphere(ball);
  };
  const figures = { camera, budget, view };

  const A = { t: 0, mode: null, beat: null, room: null, where: null, cam: { at: V(0, 6, 40), look: V(0, 2, 30) }, shake: 0, suggest: null, mood: 'day', red: 0, near: [], nearAt: -1 };
  const FOG = { concourse: [0xe0b57a, 80, 360], mortytown: [0x9a7448, 22, 240] };

  // ── Mortytown, built the first time the lift goes down (./district.js,
  // ./townsfolk.js): its street, its people and its own floor light, far
  // under everything else and shown only while Rick's there ──
  let town = null;
  let townJob = null;
  // the house look (lib/three/house), on once the city's built
  let house = null;
  const enterTown = () => {
    if (town) return Promise.resolve(true);
    if (!townJob) {
      townJob = Promise.all([import('./district'), import('./townsfolk')])
        .then(async ([{ buildDistrict }, { createTownsfolk }]) => {
          const district = await buildDistrict(renderer, { tier });
          if (stage.disposed) {
            district.dispose();
            return false;
          }
          scene.add(district.group);
          const folk = await createTownsfolk({ parent: district.group, tier }).catch(() => null);
          if (stage.disposed) {
            folk?.dispose();
            district.dispose();
            return false;
          }
          unlined.push(...district.hide);
          const lights = district.lights.map(([x, y, z, c]) => [x + TOWN.x, y + TOWN.y, z + TOWN.z, c]);
          const tracked = [...(folk?.movers ?? []), people.rick].filter((f) => f?.group).map(walker);
          const ground = groundWorld({ renderer, scene, floor: [district.floor], sun: key, casters: [district.group], skip: [fxRoot, ...district.hide], movers: tracked, shade: 0x2a2418, blobOpacity: 0.6, tier, auto: true, clip: true, cache: { world: 'citadel', place: 'mortytown' } });
          house?.adopt(district.group);
          await stage.precompile(district.group);
          district.group.visible = false;
          town = { district, folk, ground, lights };
          return true;
        })
        .catch((e) => {
          if (import.meta.env.DEV) console.error(e);
          townJob = null;
          return false;
        });
    }
    return townJob;
  };
  const tmp = V(0, 0, 0);
  const tmp2 = V(0, 0, 0);
  const look = V(0, 0, 0);

  // the grade each frame, changed in place (nothing new made a frame)
  const graded = { vignette: 0.2, high: [0.006, 0.006, 0.014], shadow: [0, 0.008, 0.03] };
  const render = (s, ms, fast = 1) => {
    const dt = Math.min(0.05 * fast, ms / 1000);
    A.t += dt;
    const t = A.t;
    const inside = s.mode === 'inside';
    const h = s.rick;
    // in Mortytown: Rick's spot is in its frame, the district at TOWN
    const away = s.where === 'mortytown' && Boolean(town);
    const ox = away ? TOWN.x : 0;
    const oy = away ? TOWN.y : 0;
    const oz = away ? TOWN.z : 0;
    if (A.where !== (away ? 'mortytown' : 'concourse')) {
      A.where = away ? 'mortytown' : 'concourse';
      const [c, near, far] = FOG[A.where];
      scene.fog.color.set(c);
      scene.fog.near = near;
      scene.fog.far = far;
      A.nearAt = -1;
      // Rick goes where he is
      const rg = people.rick?.group;
      const home = away ? town.district.group : concourse.group;
      if (rg && rg.parent !== home) home.add(rg);
    }

    // the mood: an ordinary day, election day, red alert
    concourse.setMood(s.mood);
    A.red += ((s.mood === 'red' ? 1 : 0) - A.red) * Math.min(1, dt * 1.5);
    const pulse = A.red * (0.55 + 0.45 * Math.sin(t * 4.2));
    hemi.intensity = 1.15 * (1 - A.red * 0.35);
    hemi.color.setRGB(1, 0.91 - A.red * 0.3, 0.77 - A.red * 0.25);
    key.intensity = 1.35 * (1 - A.red * 0.45);
    alarm.intensity = inside || away ? 0 : pulse * 140;
    if (away) {
      // under the city: the dome's light comes down dimmer and warmer
      hemi.intensity *= 0.74;
      hemi.color.setRGB(0.92, 0.82, 0.68 - A.red * 0.2);
      key.intensity *= 0.62;
    }
    graded.vignette = 0.2 + A.red * 0.18 + (s.chased ? 0.12 : 0);
    graded.high[0] = 0.006 + pulse * 0.05;
    graded.shadow[0] = pulse * 0.025;
    stage.grade(graded);

    concourse.update(t, dt, { gateOpen: s.gateOpen, hangarOpen: s.hangarOpen, escapeT: s.escapeT });
    concourse.group.visible = !inside && !away;
    if (town) {
      town.district.group.visible = away;
      if (away) {
        town.district.setMood(s.mood);
        town.district.update(t, dt);
      }
    }
    rooms.factory.visible = inside && s.room === 'factory';
    rooms.council.visible = inside && s.room === 'council';

    // ── the lamps ──
    if (inside) {
      const list = rooms.lights[s.room] ?? [];
      pool.forEach((l, i) => {
        const v = list[i];
        if (!v) return (l.intensity = 0);
        l.position.set(v[0], v[1], v[2]);
        l.color.set(v[3]);
        l.intensity = s.room === 'council' ? (i < 2 ? 22 : 12) : 14;
        l.distance = 18;
        return undefined;
      });
      key.intensity *= 0.25;
      hemi.intensity *= s.room === 'council' ? 0.35 : 0.45;
    } else {
      // the nearest of the concourse's lamps to Rick (or Mortytown's), picked now and then
      if (t - A.nearAt > 0.5) {
        A.nearAt = t;
        A.near = (away ? town.lights : concourse.lights)
          .map((p) => [p, Math.hypot(p[0] - h.x - ox, p[2] - h.z - oz)])
          .sort((a, b) => a[1] - b[1])
          .slice(0, POOL)
          .map((p) => p[0]);
      }
      pool.forEach((l, i) => {
        const v = A.near[i];
        if (!v) return (l.intensity = 0);
        l.position.set(v[0], v[1], v[2]);
        l.color.set(s.mood === 'red' && !away ? 0xff6a70 : v[3]);
        l.intensity = away ? 10 : 8;
        l.distance = away ? 13 : 16;
        return undefined;
      });
    }

    // (the shade follows the dome's light, its colour and how much of it there is)
    house?.follow();

    // ── the people ──
    ghosts.update(s.travellers ?? [], t, dt);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    budget.frame();
    people.update(s, t, camera.position, figures);
    if (away) town.folk?.update(s, t, camera.position, figures);
    crowd.setMood(s.mood);
    if (!inside && !away) crowd.update(t, dt, { ...figures, rick: s.mode === 'walk' || s.mode === 'talk' ? h : null, cues: s.cues });

    // ── the camera ──
    let camAt;
    let camLook;
    if (inside) {
      const c = rooms.update(s.room, s.beat, t, dt, { line: s.line });
      camAt = c?.at ?? tmp.copy(ROOMS[s.room] ?? ROOMS.factory).add(V(0, 3, 6));
      camLook = c?.look ?? look.copy(ROOMS[s.room] ?? ROOMS.factory);
    } else if (s.mode === 'escape') {
      const c = concourse.escapeCam();
      camAt = c.at;
      camLook = c.look;
    } else {
      const yaw = s.camYaw ?? 0;
      const pitch = s.camPitch ?? 0.34;
      const dist = s.mode === 'talk' ? 4.6 : (s.camDist ?? 7);
      look.set(h.x + ox, 1.45 + oy, h.z + oz);
      camAt = tmp.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      const inn = away ? insideTown : insideAt;
      let k = clearance(look, camAt, inn);
      A.suggest = null;
      if (k < 0.6) {
        let best = k;
        for (const dy of [0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
          const y2 = yaw + dy;
          const kk = clearance(look, tmp2.set(look.x + Math.sin(y2) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(y2) * Math.cos(pitch) * dist), inn);
          if (kk > best + 0.15) {
            best = kk;
            A.suggest = y2;
          }
        }
      }
      if (k < 0.55) {
        // backed up against something: look down from higher instead
        const high = tmp2.set(look.x + Math.sin(yaw) * Math.cos(0.85) * dist, look.y + Math.sin(0.85) * dist, look.z + Math.cos(yaw) * Math.cos(0.85) * dist);
        const kh = clearance(look, high, inn);
        if (kh > k) {
          camAt.copy(high);
          k = kh;
        }
      }
      if (k < 1) camAt.lerpVectors(look, camAt, k);
      camLook = look;
    }
    if (import.meta.env.DEV && s.debugCam) {
      camAt = tmp.set(...s.debugCam.at);
      camLook = look.set(...s.debugCam.look);
    }
    const jump = A.mode !== s.mode || A.beat !== s.beat || A.room !== s.room;
    A.mode = s.mode;
    A.beat = s.beat;
    A.room = s.room;
    const ease = jump ? 1 : Math.min(1, dt * (s.mode === 'walk' ? 8 : 2.5));
    A.cam.at.lerp(camAt, ease);
    A.cam.look.lerp(camLook, ease);
    camera.position.copy(A.cam.at);
    if (A.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * A.shake;
      camera.position.y += (Math.random() - 0.5) * A.shake;
      A.shake = Math.max(0, A.shake - dt * 0.8);
    }
    camera.lookAt(A.cam.look);

    fx.step(dt, t, { night: 0, day: 1 });
    ground?.update();
    town?.ground.update();
    renderer.info.reset();
    stage.render(ms / fast);
  };

  // ── events: a burst of sparks, a puff, a shake ──
  const LINE_AT = (x = 0, y = 1.5) => V(ROOMS.factory.x + x * 1.2, ROOMS.factory.y + y, ROOMS.factory.z);
  const fxEvent = (type, at = null) => {
    const p = at ? V(at.x ?? 0, at.y ?? 1.2, at.z ?? 0) : null;
    if (type === 'portal') fx.pop(V(DOORS.portal.x, 2.6, DOORS.portal.z - 1), 'green', 40, 3);
    else if (type === 'penned') fx.pop(p ?? V(PEN.gate.x - 1, 1, 0), 'gold', 18, 1.8);
    else if (type === 'scatter') {
      fx.puff(V(PEN.gate.x + 0.5, 0.6, 0), V(1, 0.3, 0), 12);
      A.shake = Math.max(A.shake, 0.05);
    } else if (type === 'layer') fx.pop(LINE_AT(at?.x ?? 0, at?.y ?? 1.4), 'white', 8, 1.2);
    else if (type === 'cut') rooms.drop(at ?? { x: 0, w: 0.1 });
    else if (type === 'spoilt') {
      rooms.drop({ ...(at ?? { x: 0, w: 1 }), y: 2.2, side: Math.sign(at?.x ?? 1) || 1 });
      fx.pop(LINE_AT(at?.x ?? 0, 1.6), 'red', 14, 1.5);
      A.shake = Math.max(A.shake, 0.06);
    } else if (type === 'good') fx.pop(LINE_AT(0, 1.9), 'gold', 30, 2.2);
    else if (type === 'contempt') {
      fx.pop(V(ROOMS.council.x, ROOMS.council.y + 3.4, ROOMS.council.z - 6.6), 'red', 18, 2);
      A.shake = Math.max(A.shake, 0.06);
    } else if (type === 'vote') {
      const b = spot('ballot');
      fx.pop(V(b.x - 1.3, 2.2, b.z - 1.3), 'gold', 26, 2.2);
      fx.pop(V(b.x - 1.3, 2.2, b.z - 1.3), 'blue', 18, 2);
    } else if (type === 'red') {
      for (let i = 0; i < 6; i++) fx.pop(V(Math.cos(i) * 7, 9, Math.sin(i) * 7), 'red', 16, 2.4);
      A.shake = Math.max(A.shake, 0.25);
    } else if (type === 'seen') A.shake = Math.max(A.shake, 0.08);
    else if (type === 'caught') A.shake = 0.3;
    else if (type === 'found' && at) fx.pop(V(at.x + TOWN.x, 1.9 + TOWN.y, at.z + TOWN.z), 'gold', 18, 1.6);
    else if (type === 'delivered') fx.pop(V(COP.x + TOWN.x, 1.8 + TOWN.y, COP.z + TOWN.z), 'blue', 22, 1.8);
    else if (type === 'locos') {
      fx.pop(V(COP.x + TOWN.x, 2.4 + TOWN.y, COP.z + TOWN.z), 'gold', 34, 2.6);
      fx.pop(V(COP.x + 2 + TOWN.x, 2 + TOWN.y, COP.z + 1 + TOWN.z), 'blue', 24, 2.2);
    } else if (type === 'liftdown') fx.puff(V(LIFT.x + 1.6 + TOWN.x, 1 + TOWN.y, LIFT.z + TOWN.z), V(1, 0.4, 0), 14);
    else if (type === 'liftup') fx.puff(V(DOORS.mortytown.x * 0.95, 1, DOORS.mortytown.z * 0.95), V(0.6, 0.3, -0.6), 14);
    else if (type === 'liftoff') {
      fx.pop(V(DOORS.hangar.x, 1.5, DOORS.hangar.z), 'white', 30, 3);
      A.shake = Math.max(A.shake, 0.15);
    }
  };

  // Where someone is on screen, for the speech bubbles: { x, y } in CSS
  // pixels of the canvas, or null when they're off it
  const screenOf = (kind, id) => {
    const p = kind === 'town' ? (town?.folk?.headOf(id) ?? null) : people.headOf(kind, id);
    if (!p) return null;
    p.project(camera);
    if (p.z > 1 || Math.abs(p.x) > 1.2 || Math.abs(p.y) > 1.2) return null;
    const { w, h } = stage.size;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
  };

  // every shader compiled before the first frame (everything's still
  // visible here, the rooms too)
  // ── the concourse's floor light, baked when it's first drawn (after Bruno
  // Simon's folio: lib/three/groundwork): the buildings' and the terminal's
  // soft shadows and their feet darkened on the deck, a bounce off it, and a
  // blob under everyone who walks it, where nothing grounded them before ──
  const walker = (f) => ({ object: f.group, size: [0.8, 0.8] });
  const ground = concourse.floor
    ? groundWorld({
        renderer,
        scene,
        floor: [concourse.floor],
        sun: key,
        casters: [concourse.group],
        skip: [fxRoot, ghosts.group, ...concourse.hide],
        movers: [people.rick, ...(people.cast?.values() ?? []), ...(people.mortys ?? []), ...(people.cops ?? []), ...(people.crowd ?? [])].filter((f) => f?.group).map(walker),
        shade: 0x3a3424,
        blobOpacity: 0.55, // (the deck is pale and evenly lit: a lighter touch)
        tier,
        auto: true,
        clip: true,
        cache: { world: 'citadel', place: 'concourse' }, // (kept for the next visit: lib/three/bakeCache)
      })
    : null;
  const setRick = (look) => {
    const was = people.rick;
    people.setRick(look);
    if (people.rick !== was) {
      if (was?.group) ground?.untrack(was.group);
      if (people.rick?.group) ground?.track(people.rick.group, [0.8, 0.8]);
      if (was?.group) town?.ground.untrack(was.group);
      if (people.rick?.group) town?.ground.track(people.rick.group, [0.8, 0.8]);
      // (made again on the concourse: back down with him if he's in Mortytown)
      if (A.where === 'mortytown' && people.rick?.group && town) town.district.group.add(people.rick.group);
    }
  };

  // the house look: one shadow colour from the dome's light; the city keeps its own haze
  house = houseOn({ renderer, scene, sun: key, hemi, look: { fog: false } });
  await stage.precompile();

  return {
    ground: import.meta.env.DEV ? ground : null, // for the QA scripts
    scene: import.meta.env.DEV ? scene : null, // for the QA scripts
    people: import.meta.env.DEV ? people : null, // (and their figures: people.cast.get(id).react('greet'), …)
    render,
    prepare: stage.prepare, // (everything sent to the graphics chip before it's seen: lib/stage3d)
    fx: fxEvent,
    // Mortytown: built (once) before the lift takes Rick down; resolves true
    // when it's ready, false if it couldn't be
    enterTown,
    get townReady() {
      return Boolean(town);
    },
    // where a Mortytown walker is now (Evil Rick, to come up to)
    townAt: (id) => town?.folk?.at(id) ?? null,
    screenOf,
    resize: stage.resize,
    // a new look from the wardrobe
    setLooks: (next) => setRick(next?.rick),
    info() {
      const i = renderer.info;
      return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, quality: stage.quality, tier };
    },
    get lost() {
      return stage.lost;
    },
    // a yaw with more room behind Rick, when the camera's boxed in
    get suggestYaw() {
      return A.suggest ?? null;
    },
    dispose() {
      town?.ground.dispose();
      town?.folk?.dispose();
      town?.district.dispose();
      ground?.dispose();
      ghosts.dispose();
      people.dispose();
      crowd.dispose();
      props.dispose();
      concourse.dispose();
      rooms.dispose();
      models.dispose();
      stage.dispose();
    },
  };
}
