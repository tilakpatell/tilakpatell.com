// Cybertron's world, drawn: whichever area you're in (its stage), Optimus
// as a robot or a truck and the change between them piece by piece
// (chunks.js), the Autobots standing about (looking round at him as he
// comes, turning on their feet when he's well round, greeting him each in
// their own way and talking with their hands while their lines play), the
// Decepticons closing in (walking where their brains move them, strafing
// with their legs to it and their guns on him, kicking with each shot,
// flinching, a boss's taunt and the brace before its heavy shot, going over
// the way they were shot), the bolts, flashes and fireballs, energon lying
// about, the mission's beacon, and the chase camera. sim.js says where
// everything is; this only shows it (bodies.js says how it looks).
//
// createGame(canvas, { tier, onLost }) → Promise<{ setArea(id), render(sim, view, dt, now),
//   events(list, sim), resize(w, h), precompile(), info(), dispose() }>
// `view` is the camera: { yaw, pitch, zoom } (GameWorld.jsx turns it).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { budget } from '../../../lib/device';
import { createPace } from '../../../lib/three/pace';
import { guard } from '../../../lib/three/frameGuard';
import { precompile, precompilePasses, quiet, releaseContext } from '../../../lib/three/renderer';
import { prepareScene } from '../../../lib/three/gpuWork';
import { settle } from '../../../lib/settle';
import { createPost } from '../../universe/post';
import { makeFigure, makeThing } from './bots';
import { bake, centresOf, cluster, makeTransformer } from './chunks';
import { createEffects } from './effects';
import { ENEMY_KINDS, FORMS, ROBOT, TRANSFORM } from './rules';
import { createFoeBody, createPersonBody, hashSeed, localMotion } from './bodies';
import { groundWorld } from '../../../lib/three/groundwork';
import { houseOn } from '../../../lib/three/house';

const STAGES = {
  iacon: () => import('./stage/iacon'),
  base: () => import('./stage/base'),
  jasper: () => import('./stage/jasper'),
  kaon: () => import('./stage/kaon'),
};
const plainStage = () => import('./stage/plain');

const CAM = {
  robot: { dist: 21, height: 9, look: 7.5, side: 2.6, fov: 58 },
  vehicle: { dist: 25, height: 8.5, look: 3, side: 0, fov: 64 },
};

export async function createGame(canvas, { tier = 'high', onLost } = {}) {
  const B = budget(tier);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  // (what arrives late is held back until it's ready, not waited for: lib/three/frameGuard)
  guard(renderer);
  quiet(renderer);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, B.ratio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !!B.shadows && tier === 'high';
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let lost = false;
  const onContextLost = (e) => {
    e.preventDefault();
    lost = true;
    onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAM.robot.fov, 1, 0.6, 9000);
  const post = createPost(renderer, scene, camera, { small: tier !== 'high' });
  const pace = createPace();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = room;
  scene.environmentIntensity = 0.45;
  let skyEnv = null; // (an area's sky, as light: setArea)
  const effects = createEffects(scene, { tier });
  // the house look (lib/three/house), as on the universe map: the shade one
  // colour from the area's light (its key and its sky or ambient light, read
  // through these two, copied from whichever area's on); the post pass
  // already tone-maps the house's way, and each area keeps its own fog
  const lookSun = { color: new THREE.Color(), intensity: 0 };
  const lookSky = { color: new THREE.Color(), intensity: 0 };
  const areaLights = { key: null, sky: null };
  const lightsOf = () => {
    const { key, sky } = areaLights;
    lookSun.color.copy(key?.color ?? lookSun.color);
    lookSun.intensity = key?.intensity ?? 0;
    lookSky.color.copy(sky?.color ?? lookSky.color);
    lookSky.intensity = sky?.intensity ?? 0;
  };
  const house = houseOn({ renderer, scene, sun: lookSun, hemi: lookSky, toneMap: false, look: { fog: false } });
  let houseFrames = 0;

  // what's in the scene for the area you're in
  let stage = null;
  let areaId = null;
  let people = new Map(); // id → figure (and its mind: bodies.js's createPersonBody)
  const foes = new Map(); // id → { figure, boomed }
  const matrixModel = { object: null, loading: null }; // (the Matrix, once a mission puts it down)
  let shake = 0;
  // the hero's light: a soft key from over the camera's shoulder, so the
  // one you play reads against a city at night, as a third-person game lights him
  const heroLight = tier === 'low' ? null : new THREE.PointLight('#e6eeff', 0, 46, 1.4);
  if (heroLight) scene.add(heroLight);
  const muzzleAt = new THREE.Vector3();
  const foeMuzzle = new THREE.Vector3();
  // what's happened since the last frame, for the bodies: hits on Optimus
  // (where the shot was), his own shots, a mission done
  const happened = { hitMe: null, fired: false, won: false };
  let lastFlinch = -1;
  let playerFall = null;
  const player = { root: new THREE.Group(), robot: null, vehicle: null, forms: { robot: null, vehicle: null }, change: null, kinds: null };
  scene.add(player.root);
  // the mission's beacon: a column of light where you're meant to go
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc44a').multiplyScalar(1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const beaconGeo = new THREE.CylinderGeometry(4, 4, 300, 24, 1, true);
  beaconGeo.translate(0, 150, 0);
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  // a drive step's gates, as rings standing on the road
  const gateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb03a').multiplyScalar(2), toneMapped: false });
  const gateGeo = new THREE.TorusGeometry(1, 0.06, 8, 48);
  const gates = new THREE.InstancedMesh(gateGeo, gateMat, 16);
  gates.count = 0;
  gates.frustumCulled = false;
  scene.add(gates);

  let loading = Promise.resolve();
  let generation = 0;

  // each area's floor light, baked when it's built (after Bruno Simon's
  // folio: lib/three/groundwork): the city's soft shadows and the sky's
  // occlusion on its ground, a bounce off it, a soft blob under every robot,
  // and no shadow pass
  let ground = null;
  const clearArea = () => {
    ground?.dispose();
    ground = null;
    if (stage) {
      scene.remove(stage.group);
      stage.dispose();
      stage = null;
    }
    for (const f of people.values()) {
      scene.remove(f.group);
      f.dispose();
    }
    people = new Map();
    // (one still loading is let go when it comes: foeFor's own check)
    for (const { figure } of foes.values()) {
      if (!figure) continue;
      scene.remove(figure.group);
      figure.dispose();
    }
    foes.clear();
  };

  // Optimus's two forms for an area (Fall of Cybertron's on Cybertron,
  // Prime's on Earth), and each cut into chunks once for the changes
  const loadPlayer = async (robotKind, vehicleKind) => {
    if (player.kinds === `${robotKind}/${vehicleKind}`) return;
    player.kinds = `${robotKind}/${vehicleKind}`;
    for (const o of [player.robot?.group, player.vehicle]) if (o) player.root.remove(o);
    player.robot?.dispose();
    const [robot, vehicle] = await Promise.all([makeFigure(robotKind, { shadows: renderer.shadowMap.enabled }), vehicleKind ? makeThing(vehicleKind, { shadows: renderer.shadowMap.enabled }) : null]);
    player.robot = robot;
    player.vehicle = vehicle;
    for (const o of [robot.group, vehicle]) o?.traverse((m) => m.isMesh && m.material && 'envMapIntensity' in m.material && (m.material.envMapIntensity = 1.3));
    player.forms = { robot: null, vehicle: null };
    player.root.add(robot.group);
    robot.update(0.016);
    // (a robot whose own model changes, Megatron, needs no chunks: his clip)
    if (!vehicle || robot.spec?.clips?.toVehicle) return;
    player.root.add(vehicle);
    vehicle.visible = false;
    // the chunks: the truck's once and for all, the robot's from how he stands
    const n = tier === 'low' ? 30 : 48;
    const vParts = bake(vehicle, vehicle);
    player.forms.vehicle = { parts: vParts, ...cluster(vParts, n, 2), kind: 'vehicle' };
    const rParts = bake(robot.group, robot.group);
    player.forms.robot = { parts: rParts, ...cluster(rParts, n, 1), kind: 'robot' };
  };

  const setArea = (area) => {
    const my = ++generation;
    loading = (async () => {
      clearArea();
      areaId = area.id;
      const look = area.look ?? {};
      const fog = look.fog ?? ['#0b1220', 150, 2600];
      scene.fog = new THREE.Fog(fog[0], fog[1], Math.max(fog[2], 1800));
      // (the metal shines with the room it's in: dim at night in Iacon)
      scene.environmentIntensity = look.env ?? 0.45;
      scene.background = new THREE.Color(fog[0]);
      effects.energon(look.energon);
      const make = (STAGES[area.id] ?? plainStage)();
      const [mod] = await Promise.all([make, loadPlayer(area.player.robot, area.player.vehicle)]);
      if (my !== generation) return;
      stage = await mod.buildStage(area, { renderer, tier });
      if (my !== generation) {
        stage.dispose();
        stage = null;
        return;
      }
      scene.add(stage.group);
      areaLights.key = null;
      areaLights.sky = null;
      stage.group.traverse((o) => {
        areaLights.key ??= o.isDirectionalLight ? o : null;
        areaLights.sky ??= o.isHemisphereLight || o.isAmbientLight ? o : null;
      });
      lightsOf();
      // (an area under a roof keeps its own light: the roof would shade all of it)
      if (stage.floor?.length && area.ceiling == null) {
        let key = null;
        stage.group.traverse((o) => (key ??= o.isDirectionalLight ? o : null));
        const B = area.bounds ?? { maxX: 200, maxZ: 200 };
        const R = Math.max(B.maxX, B.maxZ) + 40;
        ground = groundWorld({
          renderer,
          scene,
          floor: stage.floor,
          area: { x0: -R, z0: -R, w: R * 2, d: R * 2 },
          sun: key,
          casters: [stage.group],
          movers: [{ object: player.root, size: [3.2, 3.2] }, ...[...people.values()].map((f) => ({ object: f.group, size: [3.2, 3.2] }))],
          shade: 0x16141c,
          tier,
          auto: true,
          cache: { world: 'cybertron', place: area.id }, // (kept for the next visit: lib/three/bakeCache)
        });
      }
      // the metal shines with the place's own sky (Iacon's fires low on
      // the horizon, the desert's sun), or the room it's in, under a roof
      let sky = null;
      stage.group.traverse((o) => (sky ??= o.userData.sky ? o : null));
      skyEnv?.dispose();
      skyEnv = null;
      if (sky) {
        const env = new THREE.Scene();
        const shell = new THREE.Mesh(sky.geometry, sky.material);
        shell.scale.setScalar(0.02); // (the cube camera sees 100 m; the sky's drawn by direction)
        env.add(shell);
        skyEnv = pmrem.fromScene(env, 0.03).texture;
      }
      scene.environment = skyEnv ?? room;
      // the people of the place, standing where they stand
      const made = await Promise.all(
        area.people.map((p) =>
          makeFigure(p.kind, { shadows: renderer.shadowMap.enabled, seed: hashSeed(p.id) }).then((f) => {
            f.group.position.set(p.x, p.y ?? 0, p.z);
            f.group.rotation.y = p.yaw ?? 0;
            f.home = p.yaw ?? 0;
            f.mind = createPersonBody({ kind: p.kind, home: p.yaw ?? 0, seed: hashSeed(p.id) });
            return [p.id, f];
          }),
        ),
      );
      if (my !== generation) return;
      for (const [id, f] of made) {
        people.set(id, f);
        scene.add(f.group);
        ground?.track(f.group, [3.2, 3.2]);
      }
    })();
    return loading;
  };

  // a Decepticon's figure, made the first time it's seen
  const foeFor = (e) => {
    if (foes.has(e.id)) return foes.get(e.id);
    const entry = { figure: null, boomed: false, pending: true, mind: createFoeBody({ kind: e.model ?? e.kind, boss: e.boss, seed: hashSeed(e.id), cooldown: ENEMY_KINDS[e.kind]?.cooldown ?? 1 }), hit: null, fired: false };
    foes.set(e.id, entry);
    makeFigure(e.model ?? e.kind, { shadows: false, seed: hashSeed(e.id) }).then((f) => {
      if (foes.get(e.id) !== entry) return f.dispose();
      entry.figure = f;
      entry.pending = false;
      scene.add(f.group);
      ground?.track(f.group, [3.2, 3.2]);
    });
    return entry;
  };

  // the change from one form to the other, as it happens
  const startChange = (to) => {
    const { robot, vehicle, forms } = player;
    if (robot?.spec?.clips?.toVehicle && robot.hold) {
      player.change = { clip: true, to };
      return;
    }
    if (!robot || !forms.robot || !forms.vehicle) return;
    // the robot as he stands right now, cut where he was cut before
    const rParts = bake(robot.group, robot.group);
    const rForm = { parts: rParts, ids: forms.robot.ids, centres: centresOf(rParts, forms.robot.ids, forms.robot.centres.length / 3), kind: 'robot' };
    const from = to === 'vehicle' ? rForm : forms.vehicle;
    const into = to === 'vehicle' ? { ...forms.vehicle, kind: 'vehicle' } : { ...rForm, kind: 'robot' };
    const t = makeTransformer(from, into);
    player.change?.t.dispose();
    player.change = { t, to };
    player.root.add(t.group);
    robot.group.visible = false;
    vehicle.visible = false;
  };
  const endChange = (mode) => {
    if (player.change && !player.change.clip) {
      player.root.remove(player.change.t.group);
      player.change.t.dispose();
    }
    player.change = null;
    if (player.robot?.spec?.clips?.toVehicle) {
      // (his own model, either way: held at its vehicle, or let go to stand)
      player.robot.group.visible = true;
      if (mode === 'robot') player.robot.release?.();
      return;
    }
    if (player.robot) player.robot.group.visible = mode === 'robot';
    if (player.vehicle) player.vehicle.visible = mode === 'vehicle';
  };

  // ── the camera ──
  const cam = { pos: new THREE.Vector3(0, 20, -30), look: new THREE.Vector3(), fov: CAM.robot.fov, ready: false };
  const want = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const blocked = (world, x0, y0, z0, x1, y1, z1) => {
    // how far along the line from the player to the camera it can go clear of walls
    const steps = 14;
    for (let k = 1; k <= steps; k++) {
      const f = k / steps;
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f;
      const z = z0 + (z1 - z0) * f;
      for (const s of world.near(x, z, 1.5)) {
        if (y > s.top + 1 || y < (s.base ?? 0) - 1) continue;
        const inside =
          s.kind === 'circle'
            ? Math.hypot(x - s.x, z - s.z) < s.r + 1.5
            : (() => {
                const dx = x - s.x;
                const dz = z - s.z;
                const lx = dx * s.c - dz * s.s;
                const lz = dx * s.s + dz * s.c;
                return Math.abs(lx) < s.hw + 1.5 && Math.abs(lz) < s.hd + 1.5;
              })();
        if (inside) return Math.max(0.15, (k - 1) / steps);
      }
    }
    return 1;
  };

  const placeCamera = (sim, view, dt) => {
    const p = sim.player;
    const c = p.mode === 'vehicle' && !p.shifting ? CAM.vehicle : CAM.robot;
    const zoom = view.zoom ?? 1;
    const fx = Math.sin(view.yaw);
    const fz = Math.cos(view.yaw);
    const cp = Math.cos(view.pitch);
    const sp = Math.sin(view.pitch);
    const dist = c.dist * zoom;
    // behind and above, a little to the side so the robot isn't in the way of the aim
    const rx = -fz;
    const rz = fx;
    want.set(p.x - fx * cp * dist + rx * c.side, p.y + c.height * zoom + sp * dist * 0.9, p.z - fz * cp * dist + rz * c.side);
    lookAt.set(p.x + fx * 12 + rx * c.side * 0.6, p.y + c.look + sp * 10, p.z + fz * 12 + rz * c.side * 0.6);
    // pulled in short of any wall between, and never through the floor or a ceiling
    const k = blocked(sim.world, p.x, p.y + c.look, p.z, want.x, want.y, want.z);
    want.set(p.x + (want.x - p.x) * k, p.y + c.look + (want.y - p.y - c.look) * k, p.z + (want.z - p.z) * k);
    want.y = Math.max(want.y, sim.world.floorAt(want.x, want.z, want.y + 2, 4) + 1.5);
    if (sim.world.ceiling < Infinity) want.y = Math.min(want.y, sim.world.ceiling - 2);
    const ease = cam.ready ? 1 - Math.exp(-dt * 10) : 1;
    cam.pos.lerp(want, ease);
    cam.look.lerp(lookAt, ease);
    cam.ready = true;
    const speedFov = p.mode === 'vehicle' ? Math.min(10, Math.abs(p.speed) * 0.18) : 0;
    cam.fov += (c.fov + speedFov - cam.fov) * Math.min(1, dt * 4);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    if (heroLight) {
      heroLight.position.copy(cam.pos).lerp(player.root.position, 0.55);
      heroLight.position.y += 5;
      heroLight.intensity = sim.area.look?.hero ?? 260;
    }
    // (a jolt: hits taken, rams, Decepticons going up close by)
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake *= Math.exp(-dt * 9);
    }
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
  };

  // ── a frame ──
  const size = { w: 1, h: 1 };
  let clock = 0;
  const spark = [];
  const gm = new THREE.Matrix4();
  const gq = new THREE.Quaternion();
  const gs = new THREE.Vector3();
  const gp = new THREE.Vector3();

  const render = (sim, view, dt, now) => {
    if (lost) return;
    clock += dt;
    const p = sim.player;
    // Optimus
    player.root.position.set(p.x, p.y, p.z);
    player.root.rotation.y = p.yaw;
    if (p.shifting > 0 && !player.change && player.robot) startChange(p.shiftTo);
    const clips = player.robot?.spec?.clips?.toVehicle ? player.robot.spec.clips : null;
    if (player.change?.clip) {
      // Megatron changing on his own clip, a little quicker than it plays
      const k = 1 - p.shifting / TRANSFORM.time;
      const [a, b] = player.change.to === 'vehicle' ? clips.toVehicle : clips.toRobot;
      player.robot.hold(clips.transform, a + (b - a) * Math.min(1, k));
      if (Math.random() < dt * 20) effects.spark(p.x + (Math.random() - 0.5) * 7, p.y + Math.random() * 9, p.z + (Math.random() - 0.5) * 7);
      if (!p.shifting) endChange(p.mode);
    } else if (clips) {
      player.robot.group.visible = true;
      // (a tank while he's one; on his feet otherwise, whatever left him
      // held: getting up after going down in it, or a bridge crossed)
      if (p.mode === 'vehicle') player.robot.hold(clips.transform, clips.vehicle);
      else player.robot.release();
    } else if (player.change) {
      const k = 1 - p.shifting / TRANSFORM.time;
      player.change.t.set(k);
      if (Math.random() < 0.5) {
        const n = player.change.t.sparks(k, spark, 3);
        for (let i = 0; i < n; i++) {
          gp.copy(spark[i]).applyMatrix4(player.root.matrixWorld);
          effects.spark(gp.x, gp.y, gp.z);
        }
      }
      if (!p.shifting) endChange(p.mode);
    } else if (player.robot) {
      player.robot.group.visible = p.mode === 'robot';
      if (player.vehicle) player.vehicle.visible = p.mode === 'vehicle';
    }
    if (player.robot && p.mode === 'robot' && !player.change) {
      // his feet on the ground he covers: along his facing, and across it
      // as he strafes with his gun on something
      const { speed, side } = localMotion(p.vx, p.vz, p.yaw);
      const state = p.dead ? 'dead' : !p.grounded ? (p.vy > 0 ? 'jump' : 'fall') : Math.hypot(speed, side) > 0.8 ? 'walk' : 'idle';
      const aiming = view.firing && !p.dead;
      // the gun arm along the aim, in his own frame
      const rel = view.yaw - p.yaw;
      // hit: thrown back from where it came (not every hit of a burst)
      if (happened.hitMe && !p.dead && clock - lastFlinch > 0.6) {
        lastFlinch = clock;
        const away = [p.x - happened.hitMe.x, p.z - happened.hitMe.z];
        const n = Math.hypot(away[0], away[1]) || 1;
        playerFall = [away[0] / n, away[1] / n];
        const c = Math.cos(p.yaw);
        const sn = Math.sin(p.yaw);
        player.robot.gesture?.('stagger', { dir: [playerFall[0] * c - playerFall[1] * sn, 0, playerFall[0] * sn + playerFall[1] * c] });
      }
      if (happened.fired && aiming) player.robot.recoil?.();
      player.robot.play(state, { speed, side, aim: aiming ? [Math.sin(rel), Math.sin(view.pitch) + 0.05, Math.cos(rel)] : null, fall: p.dead ? playerFall : null });
      player.robot.update(dt);
    }
    const ride = clips ? player.robot?.group : player.vehicle;
    if (ride && p.mode === 'vehicle' && !player.change) {
      // the truck (or the tank) leans into a slide and squats as it pulls away
      ride.rotation.z = Math.max(-0.08, Math.min(0.08, -p.slide * 0.01 - p.steer * Math.min(1, Math.abs(p.speed) / 30) * 0.05));
      ride.rotation.x = Math.max(-0.04, Math.min(0.04, -(view.throttle ?? 0) * 0.02));
    } else if (clips && player.robot) player.robot.group.rotation.set(0, 0, 0);
    // the people of the place: looking round at him as he comes, turning
    // on their feet once he's well round, greeting him, talking with their
    // hands while their lines play, a fist up when a mission's done
    if (stage) {
      const you = p.dead ? null : { x: p.x, z: p.z };
      const eyes = { x: p.x, y: p.y + (p.mode === 'vehicle' ? 2.6 : ROBOT.height * 0.88), z: p.z };
      for (const [id, f] of people) {
        const who = sim.area.people.find((q) => q.id === id);
        if (!who) continue;
        const out = f.mind.step(dt, { me: who, you, say: sim.talk?.id === id ? { token: sim.talk, line: sim.talk.line } : null, win: happened.won && Math.hypot(p.x - who.x, p.z - who.z) < 90 });
        f.group.rotation.y = out.yaw;
        f.look?.(out.look ? eyes : null);
        f.gesture?.(out.gesture?.name ?? null, out.gesture ?? {});
        // (a few heavy steps as it turns on the spot)
        f.play(out.stepSpeed > 0.05 ? 'walk' : 'idle', { speed: out.stepSpeed * f.height * 0.2 });
        f.update(dt);
      }
    }
    // the Decepticons
    const seen = new Set();
    for (const e of sim.enemies) {
      seen.add(e.id);
      const entry = foeFor(e);
      const f = entry.figure;
      if (!f) continue;
      f.group.position.set(e.x, e.y, e.z);
      f.group.rotation.y = e.yaw;
      // Megatron or Barricade as his own model changes: its clip, robot to
      // vehicle and back
      const change = f.spec?.clips?.toVehicle && f.hold ? f.spec.clips : null;
      const F = FORMS[e.kind];
      const alt = F && e.form === F.alt;
      if (change && F && (e.shift > 0 || alt)) {
        const [a, b] = alt ? change.toVehicle : change.toRobot;
        const k = e.shift > 0 ? 1 - e.shift / (alt ? F.shift : F.back) : 1;
        f.hold(change.transform, e.shift > 0 ? a + (b - a) * k : change.vehicle);
        if (e.shift > 0 && Math.random() < dt * 14) effects.spark(e.x + (Math.random() - 0.5) * 8, e.y + Math.random() * e.h * 1.4, e.z + (Math.random() - 0.5) * 8);
        f.update(dt);
        if (e.dead && !entry.boomed) {
          entry.boomed = true;
          effects.boom(e.x, e.y + e.h * 0.4, e.z, e.boss ? 16 : 9);
        }
        f.group.visible = !e.dead || (e.gone ?? 0) < 3;
        entry.hit = null; // (a car or a tank takes its hits without a flinch)
        entry.fired = false;
        continue;
      }
      f.release?.();
      // its body from its brain: where it went this frame, at whom, what hit it
      const hit = entry.hit ? [entry.hit.x - p.x, entry.hit.z - p.z] : null;
      const out = entry.mind.step(dt, { e, you: p.dead ? null : { x: p.x, y: p.y + (p.mode === 'vehicle' ? 1.5 : ROBOT.height * 0.6), z: p.z }, hit, fired: entry.fired });
      entry.hit = null;
      entry.fired = false;
      if (e.dead) {
        if (!entry.boomed) {
          entry.boomed = true;
          effects.boom(e.x, e.y + e.h * 0.4, e.z, e.boss ? 16 : 9);
        }
        f.gesture?.(null);
        f.look?.(null);
        f.play('dead', { fall: out.fall });
        f.group.visible = (e.gone ?? 0) < 3;
      } else {
        f.play(out.state, { speed: out.speed, side: out.side, aim: out.aim });
        f.look?.(out.look ? { x: out.look.x, y: out.look.y + 2, z: out.look.z } : null);
        f.gesture?.(out.gesture?.name ?? null, out.gesture ?? {});
        f.brace?.(out.brace);
        if (out.recoil) f.recoil?.();
      }
      f.update(dt);
      // the flash at its gun, as it holds it now
      if (out.recoil && !e.dead && f.muzzle?.(foeMuzzle)) effects.spark(foeMuzzle.x, foeMuzzle.y, foeMuzzle.z);
    }
    for (const [id, entry] of foes) {
      if (seen.has(id)) continue;
      if (entry.figure) {
        scene.remove(entry.figure.group);
        entry.figure.dispose();
      }
      foes.delete(id);
    }
    // the fighting's light, and energon lying about
    effects.bolts(sim.shots);
    const lying = sim.pickups.filter((k) => !k.mission || k.mission === sim.missions.active);
    effects.pickups(
      lying.filter((k) => k.kind !== 'matrix'),
      clock,
    );
    // the Matrix of Leadership, its own model, turning and glowing where it lies
    const matrix = lying.find((k) => k.kind === 'matrix' && !k.taken);
    if (matrix && !matrixModel.loading) {
      matrixModel.loading = makeThing('matrix').then((m) => {
        m.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color('#7fd8ff');
          o.material.emissiveIntensity = 1.3;
        });
        const light = new THREE.PointLight('#9fe4ff', 900, 60, 2);
        light.position.y = 1;
        m.add(light);
        m.scale.multiplyScalar(3.6);
        matrixModel.object = m;
        scene.add(m);
      });
    }
    if (matrixModel.object) {
      matrixModel.object.visible = !!matrix;
      if (matrix) {
        matrixModel.object.position.set(matrix.x, (matrix.y ?? 0) + 3.4 + Math.sin(clock * 1.8) * 0.3, matrix.z);
        matrixModel.object.rotation.y = clock * 1.2;
      }
    }
    effects.update(dt);
    // where the mission wants you
    const hud = view.hud;
    beacon.visible = !!hud?.target;
    if (hud?.target) {
      beacon.position.set(hud.target.x, sim.world.floorAt(hud.target.x, hud.target.z, 200, 300), hud.target.z);
      // (over a Decepticon, a thin shaft from above his head, not round him)
      beacon.scale.set(hud.target.foe ? 0.3 : 1, 1, hud.target.foe ? 0.3 : 1);
      if (hud.target.foe) beacon.position.y += 14;
      beaconMat.opacity = 0.22 + 0.12 * Math.sin(clock * 3);
    }
    const m = hud?.drive;
    gates.count = 0;
    if (m) {
      m.gates.forEach((g, i) => {
        if (i < m.next) return;
        gp.set(g.x, 9, g.z);
        gq.setFromEuler(new THREE.Euler(0, i + 1 < m.gates.length ? Math.atan2(m.gates[i + 1].x - g.x, m.gates[i + 1].z - g.z) : 0, 0));
        gs.setScalar(g.r * (i === m.next ? 1 + 0.05 * Math.sin(clock * 6) : 0.8));
        gates.setMatrixAt(gates.count++, gm.compose(gp, gq, gs));
      });
      gates.instanceMatrix.needsUpdate = true;
    }
    stage?.update(clock, dt, camera, sim);
    happened.hitMe = null;
    happened.fired = false;
    happened.won = false;
    placeCamera(sim, view, dt);
    const sharp = pace.frame(now);
    if (sharp !== null) post.sharpness = sharp;
    ground?.update();
    // (the shade follows the area's light; what's come in since, taken on now and then)
    lightsOf();
    house.follow({ adopt: houseFrames++ % 60 === 0 });
    post.render(size.w, size.h);
  };

  // Everything on the graphics chip behind the page's loading screen, once
  // the area's built: its floor light baked (or read back from an earlier
  // visit's), the Decepticons it can field (`foes`, their models) fetched
  // and stood in, hidden, the change from robot to vehicle made once (its
  // material kept, so its shader stays made for every change after), the
  // house look taken on, the passes' shaders linked, then lib/three/gpuWork's
  // prepareScene. Each wait is a few seconds at most; what's later still is
  // the frame guard's.
  const BAKE_WAIT = 8000; // ms at most the floor's bake holds up the prepare
  const MODELS_WAIT = 5000; // ms at most the Decepticons' models do
  let warmChange = null; // (the change made once, kept for its shader)
  const prepare = async (onProgress, { alive = () => true, foes: kinds = [] } = {}) => {
    const going = () => alive() && !lost;
    onProgress?.(0, 'load');
    await settle(loading, MODELS_WAIT);
    if (!going()) return;
    if (ground && !ground.stats.started) {
      onProgress?.(0, 'bake');
      await settle(ground.bake(), BAKE_WAIT);
      if (!going()) return;
    }
    onProgress?.(0, 'load');
    const standIns = new THREE.Group();
    standIns.visible = false;
    const made = [];
    let over = false; // (the wait's up: one arriving now is let go)
    const fetching = Promise.all(
      kinds.map((k) =>
        makeFigure(k, { shadows: false })
          .then((f) => {
            if (over || !going()) return f.dispose();
            made.push(f);
            standIns.add(f.group);
          })
          .catch(() => {}),
      ),
    );
    await settle(fetching, MODELS_WAIT);
    over = true;
    if (!going()) {
      for (const f of made) f.dispose();
      return;
    }
    const { forms } = player;
    if (!warmChange && forms.robot && forms.vehicle) {
      try {
        warmChange = makeTransformer(forms.robot, { ...forms.vehicle, kind: 'vehicle' });
        standIns.add(warmChange.group);
      } catch {
        warmChange = null; // (the first change makes it, as before)
      }
    }
    scene.add(standIns);
    lightsOf();
    house.follow({ adopt: true });
    try {
      if (post.on) await settle(precompilePasses(renderer, post.composer, camera), 4000);
      if (!going()) return;
      await prepareScene({ renderer, roots: [scene], scene, camera, target: post.target, render: () => post.render(size.w, size.h), onProgress, alive: going });
    } finally {
      scene.remove(standIns);
      if (warmChange) standIns.remove(warmChange.group);
      // (their materials are their models' own, or clones of them, made
      // the same way: the shaders made for these are the ones theirs use)
      for (const f of made) f.dispose();
    }
  };

  return {
    camera,
    scene,
    prepare,
    // (for the QA scripts: this area's floor light)
    get ground() {
      return import.meta.env.DEV ? ground : null;
    },
    setArea,
    get loading() {
      return loading;
    },
    render,
    // what just happened, as light
    events(list) {
      for (const e of list) {
        if (e.type === 'hit') {
          effects.hit(e.x, e.y, e.z, true);
          // (the one hit flinches, and goes over that way if it's beaten)
          const foe = foes.get(e.id);
          if (foe) foe.hit = { x: e.x, z: e.z };
        } else if (e.type === 'hitMe') {
          effects.hit(e.x, e.y, e.z, false);
          shake = Math.max(shake, 0.6);
          happened.hitMe = { x: e.x, z: e.z };
        } else if (e.type === 'enemyFire') {
          const foe = foes.get(e.id);
          if (foe) foe.fired = true;
        } else if (e.type === 'complete') happened.won = true;
        else if (e.type === 'ram') shake = Math.max(shake, 1.6);
        else if (e.type === 'kill') shake = Math.max(shake, e.boss ? 2.4 : 0.5);
        else if (e.type === 'fire' && e.mode === 'robot') {
          for (const sh of e.shots) effects.spark(sh.x, sh.y, sh.z); // the muzzle's flash
          happened.fired = true;
        }
        else if (e.type === 'pickup') effects.boom(e.x, (e.y ?? 0) + 1, e.z, 2.5);
      }
    },
    resize(w, h) {
      size.w = Math.max(1, Math.round(w));
      size.h = Math.max(1, Math.round(h));
      renderer.setSize(size.w, size.h, false);
      camera.aspect = size.w / size.h;
      camera.updateProjectionMatrix();
    },
    precompile: () => {
      house.adopt(scene);
      return precompile(renderer, scene, camera);
    },
    // the gun's muzzle as the robot holds it now (for where his shots start)
    muzzle: () => (player.robot?.group.visible && player.robot.muzzle?.(muzzleAt) ? [muzzleAt.x, muzzleAt.y, muzzleAt.z] : null),
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, area: areaId }),
    dispose() {
      generation++;
      clearArea();
      endChange('robot');
      if (matrixModel.object) {
        scene.remove(matrixModel.object);
        matrixModel.object.traverse((o) => o.isMesh && o.material?.dispose?.());
      }
      player.robot?.dispose();
      effects.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      gateGeo.dispose();
      gateMat.dispose();
      room.dispose();
      skyEnv?.dispose();
      pmrem.dispose();
      warmChange?.dispose();
      post.composer?.dispose?.();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      renderer.dispose();
      if (!lost) releaseContext(renderer);
    },
  };
}
