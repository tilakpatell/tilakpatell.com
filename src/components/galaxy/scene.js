// A galaxy far, far away, in WebGL: one star system at a time (world.js
// builds it: its planet, its moons, the moment from the films it's
// remembered for), under its own sky (sky.js: the galaxy seen from where the
// system is in it), flown in the ship you fly the universe map in, the same
// way (universe/ship.js, free all the way round, Battlefront's controls,
// universe/controls.js's settings): W and S the throttle, A and D the roll,
// the arrows the nose, Space to boost (out in the open, the sublight drive
// opens up: space.js), F to fire, T and Q to change target, V the cockpit,
// a drag on the map like a stick. The HUD over it is the universe map's: the
// gun line, the lock and the lead, the threats you can't see, the way to
// wherever you're going (the page's markup, UniverseMap.jsx's classes).
//
// Between systems you jump. Every other system's star is in the sky where
// it really is from here (sky.js, systems.js courseTo), named as the nose
// comes near it: point at one and press J (or the Jump button), or fly out
// of the system with the nose on one, and you're away; or plot a course on
// the galaxy map (the page's) and the ship comes round onto it. It spools
// up, the stars stretch into lines, a flash, and you're in hyperspace
// (hyperspace.js) while the next system's built behind it; then you drop
// out at its planet, on the side you came in from. The page follows the
// system you're in (/galaxy/hoth), and a link to another sends you jumping
// there.
//
// Out there: hunters by who holds the system (galaxy/hunted.js through
// universe/hunters.js), now and then a Star Destroyer dropping out of
// hyperspace to launch its TIEs at you (universe/setpieces.js), traffic
// going about its business, and online (universe/online/), the other pilots
// in the same system, in their own ships: allies, or fair game. Crash into
// the planet too fast and you come back out of hyperspace off it; fly into
// the Death Star and you're aboard (the page goes to it); stray into its
// tractor beam at Alderaan and it pulls you in.
//
// Keep jumping and the Empire counts (interdiction.js): the tenth to
// fifteenth jump of a cycle is cut short, an Interdictor cruiser
// (interdictor.js) dropping in across the bow where you fall out, a long
// way short of the planet, its TIEs launching and its gravity well holding
// the hyperdrive (and the sublight drive) down till you're clear of it: its
// fighters gone, out past the well, or a minute ridden out.
//
// A scene module, a world on the world runtime through ./module.js
// (src/runtime's fromScene): create(canvas, ctx) draws with the runtime's
// renderer (ctx.rt.gfx: the runtime sizes it and sets its sharpness) and
// returns { ready, resize, render, update, setVisible, lowerQuality, fire,
// boost, climb, seat, escape, jump, goTo, dispose }.
// Props: system (an id), ship (a crew id), loadout (what's fitted to it in
// the universe map's hangar: outfit.js; its paint and parts, and how they
// make it fly), controls, net, stick,
// shield, hud, tags, labels (refs, as the universe map's), stars (a ref:
// the other systems' names, by id, moved over their stars), frozen,
// onArrive(id, from) (a jump's come out at a system), onAt(goal id or null),
// onBoard(path) (into the Death Star), onEvent(e) (for the comms and the
// page; { type: 'aim', id } as the nose comes onto a star or off it).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { capturePointer } from '../../lib/pointer';
import { local as remembered } from '../../lib/hooks';
import { plan as cockpitPlan } from '../cockpit/timeline';
import { freeKit } from '../cockpit/kit';
import { audioContext } from '../../lib/audio';
import { clamp01, disposeTree, precompile, precompilePasses, singlePass } from '../../lib/three/renderer';
import { device } from '../../lib/device';
import { dropTransmission } from '../../lib/three/glass';
import { gltfStats } from '../../lib/three/gltfCache';
import { STEPS } from '../../lib/three/pace';
import { FOV } from '../universe/flight';
import { createPost } from '../universe/post';
import { SHIP, autopilot, forward, spawn, step } from '../universe/ship';
import { createHunters } from '../universe/hunters';
import { createFleet } from '../universe/glbFleet';
import { createSetPieces } from '../universe/setpieces';
import { createCrash } from '../universe/crash';
import { createDust } from '../universe/belt';
import { createTrail } from '../universe/trail';
import { ENGINES, SHIP_MODELS, buildShip, BUILT } from '../universe/shipModels';
import { loadModel } from '../universe/planets';
import { lockSound, shipEngine } from '../universe/sounds';
import { AIM, aimAngles, assist, assistAmount, dirTo, edgeOf, intercept, nose, onScreen, track, trackNudge } from '../universe/targeting';
import { DEFAULTS as CONTROL_DEFAULTS, STICK, keyAxes, stickInput } from '../universe/controls';
import { createPilots } from '../universe/online/pilots';
import { paintById } from '../universe/paint';
import { FASTEST, STOCK_LOADOUT, readLoadout, statsOf } from '../universe/outfit';
import { readBuildWire, writeBuild } from '../universe/shipyard/build';
import { SHIP_INFO, buildGalaxyShip } from './fleet';
import { HUNTER_GLB, createModels } from './models';
import { createSky } from './sky';
import { createJump } from './hyperspace';
import { DIVE, LAUNCH_KEY, diveAt, planDive } from './travel';
import { INTERDICTION, createInterdiction, cutAt, dropPoint, holdLifts, inWell, interdictorPlace } from './interdiction';
import { createInterdictor } from './interdictor';
import { createBolts, createFlashes } from './fx';
import { buildSystem } from './world';
import { AHEAD, FACTIONS, KINDS, NAMES } from './hunted';
import { aligned, atGoal, makeSpace, parkBy, steerToward } from './space';
import { asking } from './asking';
import { arrival, courseTo, jumpSeconds, kindsIn, lightYears, starAhead, systemById, wantsDeathStar } from './systems';

const BOLTS = 16;
const CADENCE = { xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 };
const BOLT_COLOR = { falcon: '#ff4a3d', xwing: '#ff3b30', cruiser: '#9df06b', rv: '#5cc8ff' };
const PLUME = {
  cruiser: { color: '#4dff3a', core: '#e6ffd2', width: 0.036, life: 0.42, length: 0.32, wobble: 1.3, sparks: 40 },
  falcon: { color: '#5cbcff', core: '#eef8ff', width: 0.034, life: 0.45, length: 0.36, wobble: 0 },
  xwing: { color: '#ff6a36', core: '#fff0dc', width: 0.017, life: 0.38, length: 0.3, wobble: 0 },
  rv: { color: '#ff9a3c', core: '#fff0d8', width: 0.02, life: 0.4, length: 0.3, wobble: 0 },
};
const CABS = {
  falcon: () => import('../cockpit/vehicles/falcon'),
  xwing: () => import('../cockpit/vehicles/xwing'),
  cruiser: () => import('../cockpit/vehicles/cruiser'),
  rv: () => import('../cockpit/vehicles/rv'),
};
const SEAT_KEY = 'tp:universe-seat'; // (the universe map's: one seat, wherever you fly)
const JUMPS_KEY = 'tp:galaxy-jumps'; // (session) the Empire's count of your jumps
const EYE = { ahead: 0.035, up: 0.045 };
const CAB_HFOV = 88;
const CAB_VFOV = [52, 94];
const SAFE = 3; // seconds back from a crash when other pilots' shots don't count
const CRASH = { impact: 0.32, back: 2.6, done: 3.2 };
const JUMP = { align: 4.5, spool: 0.95, exit: 1.1 }; // seconds, at most, to come round; to spool up; to drop out
const IDLE = 40000;
const KEYS = { w: 'up', s: 'down', a: 'a', d: 'd', arrowleft: 'left', arrowright: 'right', arrowup: 'pitchUp', arrowdown: 'pitchDown', ' ': 'boost', shift: 'boost', f: 'fire' };
const ARROWS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ']);
const DRAG = 6;
const NO_TARGETS = Object.freeze([]); // (when there are no hunters to lock on to, the same empty list every time)

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TRACK_AFTER_SHOT = 1500; // ms: a lock the guns picked is followed this long after a shot at it
const apart = (ax, ay, az, bx, by, bz) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz));
// the wall clock, in seconds: every pilot's set pieces keep the same time
const wall = () => Date.now() / 1000;

// what metal reflects in a system: its star, a little of the sky
function systemEnvironment(renderer, sys) {
  const env = new THREE.Scene();
  const made = [];
  const add = (geo, mat, pos) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    env.add(m);
    made.push(geo, mat);
  };
  add(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: '#0c1220', side: THREE.BackSide }));
  sys.suns.forEach((s, i) => add(new THREE.SphereGeometry(i ? 1.1 : 1.5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color).multiplyScalar(i ? 5 : 8) }), new THREE.Vector3(...s.dir).normalize().multiplyScalar(7)));
  add(new THREE.SphereGeometry(2.4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.38, 0.9) }), new THREE.Vector3(...s3(sys.suns[0].dir)).multiplyScalar(-7));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  for (const x of made) x.dispose();
  return rt;
}
const s3 = (d) => [d[0], -d[1] * 0.5, d[2]];

// Just taken off from a system's planet (the surface page leaves its id in
// the session as it goes): just off the planet on its sunny side, nose
// out, climbing. Once only.
function takeOff(sys) {
  let id = null;
  try {
    id = window.sessionStorage.getItem(LAUNCH_KEY);
    if (id) window.sessionStorage.removeItem(LAUNCH_KEY);
  } catch {
    return null;
  }
  if (id !== sys.id || !sys.body) return null;
  const r = sys.body.r;
  const sun = sys.suns[0].dir;
  const l = Math.hypot(sun[0], sun[2]) || 1;
  const dx = sun[0] / l;
  const dz = sun[2] / l;
  const d = r * 1.18 + 4;
  return { x: dx * d, y: r * 0.12, z: dz * d, heading: Math.atan2(-dx, -dz) };
}

export async function create(canvas, ctx) {
  const { reduced, rt } = ctx;
  let props = ctx;
  let disposed = false;
  // the runtime's renderer: shared with whatever world comes next, so what's
  // changed on it here goes back as it was at dispose
  const gfx = rt.gfx;
  const { renderer } = gfx;
  const autoReset = renderer.info.autoReset;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 9000);
  scene.add(camera);
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cursor = 'crosshair';

  const tier = device().tier;
  const small = tier !== 'high' || Math.min(window.innerWidth, window.innerHeight) < 600;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const post = createPost(renderer, scene, camera, { small });
  const warm = (root, cam = camera, target = scene) => precompile(renderer, singlePass(root), cam, target, post.on ? post.composer.readBuffer : undefined);

  // light: each sun from its way, and a little ambient
  const keys = [new THREE.DirectionalLight('#ffffff', 2.2), new THREE.DirectionalLight('#ffffff', 0)];
  for (const k of keys) scene.add(k, k.target);
  const ambient = new THREE.AmbientLight('#9fb0d8', 0.32);
  scene.add(ambient);

  const sky = createSky({ small, renderer });
  scene.add(sky.group);
  const jumpFx = createJump({ small });
  camera.add(jumpFx.group);
  const dust = createDust({ small });
  scene.add(dust.points);

  const models = createModels({ prepare: (o) => warm(o) });
  const bolts = createBolts(scene, { count: small ? 90 : 180 });
  const flashes = createFlashes(scene, { count: small ? 32 : 56 });
  const crashFx = createCrash(scene);
  const pops = createCrash(scene);
  const fleet = createFleet({ build: buildGalaxyShip, glb: HUNTER_GLB });
  fleet.prepare = (o) => warm(o);
  const hunters = reduced ? null : createHunters(scene, { small, fleet, factions: FACTIONS, kinds: KINDS, solids: () => state.space?.solids ?? [] });
  let hunts = 0; // packs sent this visit (the first is a small one)
  const pieces = reduced ? null : createSetPieces(scene, { small, fleet });
  // the Empire's count of your jumps, and the Interdictor waiting on the one that's due
  const interdiction = createInterdiction({
    store: { get: () => window.sessionStorage.getItem(JUMPS_KEY), set: (v) => (v === null ? window.sessionStorage.removeItem(JUMPS_KEY) : window.sessionStorage.setItem(JUMPS_KEY, v)) },
  });
  const interdictor = reduced ? null : createInterdictor(scene, { models, small });

  // your guns
  const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6).rotateX(Math.PI / 2);
  const boltMat = new THREE.MeshBasicMaterial({ color: '#ff4a3d', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const myBolts = Array.from({ length: BOLTS }, () => {
    const m = new THREE.Mesh(boltGeo, boltMat);
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: [0, 0, 0] };
    scene.add(m);
    return m;
  });

  const size = { w: 1, h: 1 };
  const state = {
    sys: null, // the system you're in (systems.js's)
    world: null, // and what's built of it (world.js's)
    space: null, // space.js's, for flying in it
    kind: null,
    ship: null,
    model: null,
    seat: remembered.get(SEAT_KEY) === 'cockpit' ? 'cockpit' : 'chase',
    view: 'chase',
    cabK: 0,
    fovBase: FOV,
    auto: null, // { id, park } while it flies itself to something in the system
    at: null, // the goal it's at
    keys: {},
    stick: null,
    drag: null,
    boostBtn: false,
    climbBtn: 0,
    fireBtn: false,
    boosting: false,
    boosts: 0,
    streak: 0,
    flown: false,
    shown: true,
    lastInput: performance.now(),
    idleSaid: false,
    side: 1,
    lastShot: 0,
    crash: null,
    shake: 0,
    kick: 0,
    clock: 0,
    shield: 100,
    hitAt: -1e9,
    safeUntil: -1e9,
    hurt: 0,
    lowSaid: false,
    heat: 0,
    nextHunt: 35 + Math.random() * 25, // seconds of flying till they come
    jump: null, // { to, from, phase, age, dir, dur }
    aim: null, // { id, angle }: the star the nose is on, if it's on one
    courseSaid: false,
    loadout: readLoadout(ctx.loadout ?? STOCK_LOADOUT), // what's fitted in the hangar
    build: null, // the garage build flown in place of the stock hull (universe/shipyard), or null
    stats: statsOf(null, STOCK_LOADOUT), // and what it does to how it flies
    lock: null,
    lockTarget: null,
    lead: null,
    hot: false,
    cycle: 0,
    hitMark: 0,
    bias: [0, 0, 0],
    pull: 0, // the tractor beam's hold on you
    pullSaid: false,
    held: null, // { at, hangar, since, pack, to, faction } while an Interdictor's gravity well holds you (interdiction.js)
    heldSaid: -1e9,
    flare: 1,
    eclipse: 1,
  };
  let engine = null;
  let net = null;
  let netOff = null;
  const pilots = createPilots(scene, { colors: BOLT_COLOR, here: () => (state.sys ? `/galaxy/${state.sys.id}` : '/galaxy'), fleet: reduced ? null : fleet, kinds: KINDS });

  const emit = (e) => props.onEvent?.(e);
  const controls = () => props.controls ?? CONTROL_DEFAULTS;
  const flying = () => Boolean(state.ship);

  // ── The system you're in ──
  let ratioSeen = renderer.getPixelRatio(); // the pixel ratio the sky and the skylanes were last sized for
  let detail = 1; // how finely the planets are drawn (0…1), as the world was last told
  let capDetail = false; // set when the scene is told to give up quality: the planets at their coarsest
  let env = null;
  let envOf = null; // the system `env` was made for
  let warmed = false;
  // what metal reflects here: made once for a system. The first is made as it's
  // entered, since the shaders made then are made against an environment; a
  // jump's world is made against the last system's (the same shaders), and its
  // own comes with dressSystem
  const reflect = (sys) => {
    if (envOf === sys) return;
    envOf = sys;
    env?.dispose();
    env = systemEnvironment(renderer, sys);
    scene.environment = env.texture;
  };
  // The system built: its world, its space, its lights, its models asked for.
  // Not its sky's bake and its environment (dressSystem): those are a good few
  // milliseconds of the GPU's each, and a jump makes them a frame later than this
  const enter = (sys) => {
    state.world?.dispose();
    state.world = null;
    state.sys = sys;
    sky.setSystem(sys);
    const world = buildSystem(sys, { models, bolts, flashes, small, ratio: ratioSeen });
    world.setDetail(detail);
    scene.add(world.group);
    state.world = world;
    state.space = makeSpace(world.solids);
    // the suns' light
    world.sunLights.forEach((s, i) => {
      keys[i].color.copy(s.color);
      keys[i].position.copy(s.dir).multiplyScalar(100);
    });
    keys[1].intensity = world.sunLights[1] ? 1.1 : 0;
    if (!env) reflect(sys);
    hunters?.clear();
    state.auto = null;
    state.at = null;
    state.lock = null;
    state.pull = 0;
    state.pullSaid = false;
    state.nextHunt = 30 + Math.random() * 30;
    state.held = null;
    interdictor?.hide();
    models.want(['destroyer', 'corvette', 'xwing', 'interceptor', ...(wantsDeathStar(sys) ? ['deathstar'] : [])]);
    return warm(world.group);
  };
  // the system's sky drawn into its cube (once, for as long as you're here), and what its metal reflects
  const dressSystem = (sys) => {
    sky.bake();
    reflect(sys);
  };

  // ── The ship ──
  let plumes = [];
  const nozzle = new THREE.Vector3();
  const setPlumes = (kind, engines) => {
    for (const pl of plumes) {
      scene.remove(pl.trail.mesh);
      pl.trail.dispose();
    }
    plumes = [];
    if (!kind) return;
    const look = PLUME[kind] ?? PLUME.falcon;
    plumes = engines.map((at) => {
      const trail = createTrail(look);
      trail.setColors(look.color, look.core);
      scene.add(trail.mesh);
      return { trail, at: new THREE.Vector3(...at) };
    });
  };
  const updatePlumes = (dt, t, amount, stretch = 1) => {
    const m = state.model;
    if (!m) return;
    m.group.updateMatrixWorld(true);
    for (const pl of plumes) {
      m.pivot.localToWorld(nozzle.copy(pl.at));
      pl.trail.update(dt, t, nozzle, amount, camera.position, stretch);
    }
  };

  const heard = () => {
    if (!state.kind) return;
    audioContext();
    if (!engine) engine = shipEngine(state.kind);
  };

  // What's fitted in the hangar (the universe map's, outfit.js): the paint
  // job the ship wears (paint.js), on its hull and in its shots; the parts
  // bolted on, and what they do to how it flies (state.stats, ship.js's tune)
  const coat = () => paintById(state.loadout.paint);
  const dress = () => {
    if (!state.kind) return;
    state.model?.paint?.(coat());
    boltMat.color.set(coat().bolt ?? BOLT_COLOR[state.kind] ?? '#ff4a3d').multiplyScalar(4); // hot enough to bloom
  };
  const refit = () => {
    state.stats = statsOf(state.kind, state.loadout, state.build);
    if (state.kind && state.model) state.model.outfit?.(state.loadout);
  };
  const setLoadout = (raw) => {
    const next = readLoadout(raw ?? STOCK_LOADOUT);
    const was = state.loadout;
    if (Object.keys(next).every((k) => next[k] === was[k])) return;
    state.loadout = next;
    if (next.paint !== was.paint) dress();
    refit();
    ctx.invalidate();
  };

  // The garage build flown in place of the stock hull (or null): the ship
  // built again when it changes, where it was.
  const buildKey = (b) => (b ? writeBuild(b).join() : '');
  const sameBuild = (b) => buildKey(b) === buildKey(state.build);
  const setBuild = (raw) => {
    if (sameBuild(raw)) return;
    state.build = raw ? readBuildWire(writeBuild(raw)) : null;
    if (state.kind) setShip(state.kind, true);
  };

  // (force: the same crew, built again: its garage build changed)
  const setShip = (kind, force = false) => {
    if (kind === state.kind && !force) return;
    // (forced: the same crew, a new hull: only the model's made again)
    const same = force && kind === state.kind;
    if (!same) {
      engine?.stop();
      engine = null;
    }
    if (state.model) {
      scene.remove(state.model.group);
      state.model.dispose();
      disposeTree(state.model.group);
      state.model = null;
    }
    state.kind = kind;
    if (!same) {
      dropCab();
      cabWanted = null;
      if (kind && state.seat === 'cockpit') buildCab(kind);
    }
    setPlumes(kind, ENGINES[kind] ?? []);
    if (!kind) {
      state.ship = null;
      state.auto = null;
      state.crash = null;
      if (state.jump?.phase === 'align') state.jump = null;
      hunters?.clear();
      return;
    }
    state.model = buildShip(kind, {}, { build: state.build });
    scene.add(state.model.group);
    if (state.build) setPlumes(kind, state.model.engines); // (its own engines)
    refit();
    dress();
    if (state.build) {
      // a garage build is whole as it is: no model to load over it
    } else if (SHIP_MODELS[kind]) {
      const model = state.model;
      loadModel(SHIP_MODELS[kind])
        .then((m) => m && (dropTransmission(m), warm(model.dress ? model.dress(m) : m).then(() => m))) // (the Falcon's glass, without its extra pass; in its paint before its shaders are made)
        .then((m) => {
          if (!m) return;
          if (disposed || state.kind !== kind || !state.model?.mount(m)) disposeTree(m);
          ctx.invalidate();
        });
    } else if (kind === 'cruiser') {
      const model = state.model;
      import('../rickmorty/cruiser3d')
        .then((m) => m.buildCruiser({ ink: BUILT / 2.7 }))
        .then((c) => {
          if (!c) return;
          if (disposed || state.model !== model || !model.mount(c.group, { update: c.update, dispose: c.dispose, ownGlow: true, tint: c.tint })) {
            c.dispose();
            disposeTree(c.group);
            return;
          }
          if (c.engines?.length) {
            model.group.updateMatrixWorld(true);
            setPlumes('cruiser', c.engines.map((g) => model.pivot.worldToLocal(g.getWorldPosition(new THREE.Vector3())).toArray()));
          }
          ctx.invalidate();
        })
        .catch(() => {});
    }
    state.view = state.seat;
  };

  // ── The cockpit view: the intro's cockpit, from the pilot's seat ──
  const cabScene = new THREE.Scene();
  const camIn = new THREE.PerspectiveCamera(60, 1, 0.02, 60);
  cabScene.add(camIn);
  let cab = null;
  let cabWanted = null;
  let roomEnv = null;
  function dropCab() {
    post.overlay(null);
    if (!cab) return;
    cabScene.remove(cab.built.inside);
    cab.built.dispose?.();
    disposeTree(cab.built.inside);
    disposeTree(cab.built.outside);
    if (cabScene.environment && cabScene.environment !== roomEnv) cabScene.environment.dispose?.();
    cabScene.environment = null;
    freeKit();
    cab = null;
  }
  async function buildCab(kind) {
    if (!kind || !CABS[kind] || cabWanted === kind || cab?.kind === kind) return;
    cabWanted = kind;
    try {
      const mod = await CABS[kind]();
      if (disposed || cabWanted !== kind) return;
      if (!roomEnv) {
        const pm = new THREE.PMREMGenerator(renderer);
        roomEnv = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
      }
      const pmrem = new THREE.PMREMGenerator(renderer);
      const built = await mod.build({ renderer, pmrem, rich: tier === 'high' && !coarse, reduced, coarse, say: () => {} });
      pmrem.dispose();
      if (disposed || cabWanted !== kind) {
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      dropCab();
      cabScene.add(built.inside);
      cabScene.environment = built.environment ?? roomEnv;
      cabScene.environmentIntensity = built.envIntensity ?? 0.35;
      camIn.position.set(...built.eye);
      await warm(cabScene, camIn, cabScene);
      if (disposed || cabWanted !== kind) {
        cabScene.remove(built.inside);
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      cab = { kind, built, plan: cockpitPlan(kind), look: { yaw: 0, pitch: 0 } };
      cabWanted = null;
      ctx.invalidate();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[galaxy] cockpit', err);
      if (cabWanted === kind) cabWanted = null;
    }
  }
  const setSeat = (seat) => {
    if (seat === state.seat) return;
    state.seat = seat;
    remembered.set(SEAT_KEY, seat);
    state.view = seat;
    if (seat === 'cockpit') buildCab(state.kind);
    ctx.invalidate();
  };

  // ── The camera ──
  const shipQ = new THREE.Quaternion();
  const camQ = new THREE.Quaternion();
  const shipEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  let camQOn = false;
  const TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.21);
  const leanQ = new THREE.Quaternion();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const camF = new THREE.Vector3();
  const camU = new THREE.Vector3();
  const camR = new THREE.Vector3();
  const camP = new THREE.Vector3();
  const headQ = new THREE.Quaternion();
  const orientOf = (s, q) => q.setFromEuler(shipEuler.set(s.pitch || 0, s.heading, -(s.bank || 0), 'YXZ'));
  // The camera's views are made into these, never new ones (a frame's worth of
  // vectors and quaternions, sixty times a second, is a lot to leave for the
  // collector): the view the ship and the crash give, the blend towards it, and
  // the one it eases from. `view` is whichever of the first two was last drawn
  const viewTo = { target: new THREE.Vector3(), quat: new THREE.Quaternion(), dist: 1 };
  const viewBlend = { target: new THREE.Vector3(), quat: new THREE.Quaternion(), dist: 1 };
  const blendTo = { k: 1, dur: 1, from: { target: new THREE.Vector3(), quat: new THREE.Quaternion(), dist: 1 } };
  const lookM = new THREE.Matrix4();
  const ORIGIN = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  let view = null; // { target, quat, dist }, eased between

  const chaseView = () => {
    const s = state.ship;
    camF.set(0, 0, -1).applyQuaternion(camQ);
    camU.set(0, 1, 0).applyQuaternion(camQ);
    camR.set(1, 0, 0).applyQuaternion(camQ);
    const bias = state.bias;
    viewTo.target
      .set(s.x + bias[0], s.y + bias[1], s.z + bias[2])
      .addScaledVector(camF, 0.4)
      .addScaledVector(camU, 0.06)
      .addScaledVector(camR, (s.lean || 0) * 0.45);
    viewTo.quat.copy(camQ).multiply(TILT);
    viewTo.dist = 1.7 + Math.min(Math.abs(s.speed), 30) * 0.045 + state.streak * 0.7;
    return viewTo;
  };
  const cockpitView = () => {
    const s = state.ship;
    viewTo.quat.copy(camQ).multiply(leanQ.setFromAxisAngle(Z_AXIS, -(s.lean || 0) * 0.85));
    viewTo.target.set(0, EYE.up, -EYE.ahead).applyQuaternion(camQ).add(camP.set(s.x, s.y, s.z)).addScaledVector(camF.set(0, 0, -1).applyQuaternion(viewTo.quat), 1);
    viewTo.dist = 1;
    return viewTo;
  };
  // after a crash: back and up from where it went in
  const crashView = () => {
    const c = state.crash;
    camP.copy(c.point).addScaledVector(c.normal, c.radius * 1.4 + 2.6);
    camP.y += 1.2;
    viewTo.quat.setFromRotationMatrix(lookM.lookAt(camP, c.point, UP));
    viewTo.target.copy(c.point);
    viewTo.dist = c.radius * 1.4 + 3;
    return viewTo;
  };
  const cabFov = () => {
    const a = size.w / size.h;
    const vf = (2 * Math.atan(Math.tan((CAB_HFOV * Math.PI) / 360) / a) * 180) / Math.PI;
    return clamp(vf, CAB_VFOV[0], CAB_VFOV[1]);
  };
  const follow = (dt) => {
    orientOf(state.ship, shipQ);
    if (!camQOn || reduced) camQ.copy(shipQ);
    else camQ.slerp(shipQ, 1 - Math.exp(-dt * (state.view === 'cockpit' ? 20 : 4.5 * controls().camera)));
    camQOn = true;
  };
  const applyView = (v) => {
    camera.quaternion.copy(v.quat);
    camera.position.copy(v.target).addScaledVector(camF.set(0, 0, -1).applyQuaternion(v.quat), -v.dist);
    camera.updateMatrixWorld();
  };
  const retarget = (ms = 700) => {
    if (reduced || !view) return;
    blendTo.from.target.copy(view.target);
    blendTo.from.quat.copy(view.quat);
    blendTo.from.dist = view.dist;
    blendTo.k = 0;
    blendTo.dur = ms / 1000;
  };

  // a point on the canvas: x, y in px, z its depth in front of the camera
  const hudPoint = new THREE.Vector3();
  const hudDepth = new THREE.Vector3();
  const toScreen = (x, y, z, out) => {
    hudPoint.set(x, y, z);
    out.z = -hudDepth.copy(hudPoint).applyMatrix4(camera.matrixWorldInverse).z;
    hudPoint.project(camera);
    out.x = ((hudPoint.x + 1) / 2) * size.w;
    out.y = ((1 - hudPoint.y) / 2) * size.h;
    return out;
  };
  let tanHalf = Math.tan((FOV * Math.PI) / 360);
  const rect = { x: 0, y: 0, w: 1, h: 1 };
  const measure = () => {
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    const box = (rt.host ?? ctx.el).getBoundingClientRect(); // (the box it's in now: a handover moves it)
    const top = Math.max(0, nav - box.top);
    Object.assign(rect, { x: 0, y: top, w: size.w, h: size.h - top });
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
  };

  // ── Names over what's here (the page's buttons, moved as the scene draws) ──
  const labelAt = { x: 0, y: 0, z: 0 };
  const shownLabel = new Map();
  const placeLabels = () => {
    const els = props.labels?.current;
    const world = state.world;
    if (!els || !world) return;
    const inTunnel = Boolean(state.jump && state.jump.phase === 'tunnel');
    for (const g of world.goals) {
      const el = els[g.id];
      if (!el) continue;
      toScreen(g.at[0], g.at[1], g.at[2], labelAt);
      const r = labelAt.z > 0 ? ((g.reach ?? g.r) / (labelAt.z * tanHalf)) * (size.h / 2) : 0;
      const ly = labelAt.y + Math.min(r * 0.55, size.h * 0.3) + 8;
      const off = inTunnel || labelAt.z <= 0.5 || labelAt.x < -60 || labelAt.x > size.w + 60 || ly < -40 || ly > size.h + 40 || state.view === 'cockpit';
      const near = state.at === g.id;
      const tf = off ? '' : `translate3d(${labelAt.x.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      const was = shownLabel.get(el);
      const flag = `${off}${near}`;
      if (was && was.tf === tf && was.flag === flag) continue;
      shownLabel.set(el, { tf, flag });
      if (tf) el.style.transform = tf;
      el.toggleAttribute('data-off', off);
      el.toggleAttribute('data-here', near);
    }
  };

  // ── The other systems' names, over their stars near the nose (the page's
  // buttons), and the one it's on (or a jump's coming round to) bracketed ──
  const starAt = { x: 0, y: 0, z: 0 };
  const starPoint = new THREE.Vector3();
  const shownStar = new Map();
  const STAR_NEAR = Math.cos((30 * Math.PI) / 180);
  const placeStars = () => {
    const els = props.stars?.current;
    if (!els) return;
    const s = state.ship;
    const on = flying() && !state.crash && !props.frozen && !(state.jump && state.jump.phase !== 'align');
    const [nx, ny, nz] = on ? nose(s) : [0, 0, 0];
    const target = state.jump?.phase === 'align' ? state.jump.to.id : (state.aim?.id ?? null);
    for (const b of sky.beacons) {
      const el = els[b.id];
      if (!el) continue;
      let shown = on && (b.dir.x * nx + b.dir.y * ny + b.dir.z * nz > STAR_NEAR || b.id === target);
      let tf = '';
      if (shown) {
        starPoint.copy(b.dir).multiplyScalar(1000).add(camera.position);
        toScreen(starPoint.x, starPoint.y, starPoint.z, starAt);
        shown = starAt.z > 0 && starAt.x > -40 && starAt.x < size.w + 40 && starAt.y > rect.y - 20 && starAt.y < size.h + 20;
        if (shown) tf = `translate3d(${starAt.x.toFixed(1)}px, ${starAt.y.toFixed(1)}px, 0)`;
      }
      const lock = shown && b.id === target;
      const flag = `${shown}${lock}`;
      const was = shownStar.get(el);
      if (was && was.tf === tf && was.flag === flag) continue;
      shownStar.set(el, { tf, flag });
      if (tf) el.style.transform = tf;
      el.toggleAttribute('data-on', shown);
      el.toggleAttribute('data-lock', lock);
    }
  };

  // ── Steering ──
  const takeover = () => {
    state.lastInput = performance.now();
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    if (state.auto) state.auto = null;
    if (state.jump?.phase === 'align') cancelJump('pilot');
  };
  const steering = () => {
    const c = controls();
    let { throttle, turn, climb, roll } = keyAxes(state.keys, c);
    climb += state.climbBtn;
    const st = state.stick;
    if (st?.on) {
      const d = stickInput(st.dx, st.dy, c, st.pointer);
      throttle += d.throttle;
      turn += d.turn;
      climb += d.climb;
      roll += d.roll;
    }
    return { throttle: clamp(throttle, -1, 1), turn: clamp(turn, -1, 1), climb: clamp(climb, -1, 1), roll: clamp(roll, -1, 1), boost: Boolean(state.keys.boost || state.boostBtn), turnRate: c.turn, pitchRate: c.pitch, rollRate: c.roll, level: c.level, tune: state.stats };
  };

  // ── The guns ──
  const fire = () => {
    const s = state.ship;
    const now = performance.now();
    const g = state.stats; // (the guns fitted in the hangar: how fast, how hard)
    if (!s || props.frozen || state.crash || state.jump || now - state.lastShot < Math.max(FASTEST, (CADENCE[state.kind] ?? 0.18) * g.cadence) * 1000) return;
    state.lastShot = now;
    state.lastInput = now;
    const b = myBolts.find((m) => !m.visible) ?? myBolts[0];
    const [fx, fz] = forward(s.heading);
    let dir = nose(s);
    if (state.lead && state.lead.t <= AIM.life) dir = assist(dir, dirTo(s, state.lead), controls().assist);
    const { heading, pitch } = aimAngles(dir);
    // from the guns fitted, their barrels in turn; or the ship's own
    const mods = state.model?.modules;
    if (mods?.muzzles.length) {
      state.barrel = ((state.barrel ?? 0) + 1) % mods.muzzles.length;
      state.model.pivot.localToWorld(b.position.set(...mods.muzzles[state.barrel]));
      mods.fire();
    } else {
      const side = state.kind === 'xwing' ? (state.side = -state.side) * 0.12 : 0;
      b.position.set(s.x + dir[0] * 0.16 - fz * side, s.y + dir[1] * 0.16, s.z + dir[2] * 0.16 + fx * side);
    }
    b.rotation.set(pitch, heading, 0);
    b.scale.set(g.bolt, g.bolt, 1 + (g.bolt - 1) * 0.4);
    const v = AIM.bolt + Math.max(0, s.speed);
    b.userData = { life: AIM.life, v: [dir[0] * v, dir[1] * v, dir[2] * v], punch: g.punch };
    b.visible = true;
    net?.shot(b.position, b.userData.v);
    emit({ type: 'fire' });
    ctx.invalidate();
  };
  const popDir = new THREE.Vector3();
  const shotFrom = new THREE.Vector3();
  // where a shot landed on a hunter or a pilot (hit: { at, size, down }): a kill goes up in the one big burst; a hit that doesn't kill is a
  // flash (the burst is shared, so each hit would cut off the one before it)
  const landed = (hit, normal) => {
    if (hit.down) pops.hit({ point: hit.at, normal, radius: hit.size * 1.8 });
    else flashes.at(hit.at, { size: 0.4, life: 0.5 });
  };
  const moveBolts = (dt) => {
    let any = false;
    for (const b of myBolts) {
      if (!b.visible) continue;
      const d = b.userData;
      d.life -= dt;
      if (d.life <= 0) {
        b.visible = false;
        continue;
      }
      any = true;
      shotFrom.copy(b.position);
      b.position.x += d.v[0] * dt;
      b.position.y += d.v[1] * dt;
      b.position.z += d.v[2] * dt;
      const hh = hunters?.hit(shotFrom, b.position, d.punch ?? 1);
      if (hh) {
        b.visible = false;
        landed(hh, popDir.set(-d.v[0], 3, -d.v[2]).normalize());
        state.hitMark = 1;
        if (hh.down) {
          emit({ type: 'kill', kind: hh.kind });
          state.heat += 1;
          if (!reduced) state.shake = Math.max(state.shake, 0.2);
        }
        continue;
      }
      // another pilot, or one of the hunters after them (it's theirs, so they're told)
      const ph = pilots.hit(shotFrom, b.position, d.punch ?? 1);
      if (ph) {
        b.visible = false;
        landed(ph, popDir.set(-d.v[0], 3, -d.v[2]).normalize());
        state.hitMark = 1;
        if (ph.hunter) {
          net?.hunterHit(ph.id, ph.hunter, d.punch ?? 1);
          if (ph.down) {
            emit({ type: 'kill', kind: ph.kind });
            if (!reduced) state.shake = Math.max(state.shake, 0.2);
          }
        } else net?.hit(ph.id);
      }
    }
    return any;
  };

  // ── Shields, crashes, being shot down ──
  const startCrash = (e) => {
    const s = state.ship;
    const solid = state.space.solids.find((o) => o.id === e.id);
    const center = new THREE.Vector3(...(solid?.at ?? [s.x, s.y, s.z]));
    const from = new THREE.Vector3(s.x, s.y, s.z);
    const normal = from.clone().sub(center).normalize();
    // into the Death Star: you're aboard
    const board = solid?.board ?? (solid?.hull === undefined && e.id === 'deathstar' ? '/deathstar' : null);
    state.crash = {
      age: 0,
      id: e.id,
      board,
      from,
      normal,
      radius: solid?.r ?? 1,
      point: center.clone().addScaledVector(normal, solid?.r ?? 0),
      fwd: forward(s.heading),
      spin: [3 + Math.random() * 5, 2 + Math.random() * 4],
      impact: false,
      back: false,
      planet: Boolean(solid?.planet),
    };
    state.auto = null;
    engine?.set({ speed: 0, boost: false, on: false });
    retarget(650);
  };
  const startDestroyed = (by = null) => {
    const s = state.ship;
    const from = new THREE.Vector3(s.x, s.y, s.z);
    state.crash = { age: 0, id: 'shot', shot: true, from, normal: new THREE.Vector3(0, 1, 0), radius: 0.35, point: from.clone(), fwd: forward(s.heading), spin: [6 + Math.random() * 6, 4 + Math.random() * 5], impact: false, back: false };
    state.auto = null;
    hunters?.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    if (by) net?.down(by);
    emit({ type: 'destroyed' });
    retarget(650);
  };
  const hurt = (damage, by = null) => {
    if (state.crash || !state.ship || state.jump?.phase === 'tunnel') return;
    if (by && state.clock < state.safeUntil) return;
    state.shield = Math.max(0, state.shield - damage * state.stats.armor); // (less, with plating fitted)
    state.hitAt = state.clock;
    state.hurt = 1;
    if (!reduced) state.shake = Math.max(state.shake, 0.3);
    emit({ type: 'laser' });
    if (state.shield < 35 && !state.lowSaid) {
      state.lowSaid = true;
      emit({ type: 'shields' });
    }
    if (state.shield <= 0) startDestroyed(by);
  };
  const crashing = (dt) => {
    const c = state.crash;
    c.age += dt;
    const m = state.model;
    updatePlumes(dt, performance.now() / 1000, 0);
    m.drive?.(dt, {}); // (the engines are out)
    if (c.age < CRASH.impact) {
      const k = c.age / CRASH.impact;
      m.group.position.copy(c.from).addScaledVector(c.normal, -k * k * (SHIP.radius + 0.25));
      m.pivot.rotation.x += dt * c.spin[0];
      m.pivot.rotation.z += dt * c.spin[1];
    } else if (!c.impact) {
      c.impact = true;
      m.group.visible = false;
      const body = c.planet ? state.world?.body : null;
      crashFx.hit({ point: c.point, normal: c.normal, body: body?.surface ?? null, radius: c.radius, colour: null });
      state.shake = reduced ? 0 : 1;
      state.flare = reduced ? 1 : 2;
      if (!c.shot) emit({ type: 'crash', id: c.id });
      if (c.board) {
        c.through = true;
        props.onBoard?.(c.board);
      }
    }
    if (c.through) return true;
    if (c.age >= CRASH.back && !c.back) {
      // back again: out of hyperspace off the planet, shields up
      c.back = true;
      const a = arrival(state.sys, null);
      state.ship = { ...spawn(null, a), speed: 0 };
      camQOn = false;
      state.shield = 100;
      state.lowSaid = false;
      // an Interdictor's hold doesn't survive a crash: it's gone when you're
      // back (and nothing's earned for getting clear that way)
      if (state.held) {
        state.held = null;
        interdictor?.hide();
        emit({ type: 'wellclear', why: 'crash' });
      }
      m.group.visible = true;
      m.pivot.rotation.set(0, 0, 0);
      crashFx.arrive({ point: new THREE.Vector3(a.x, a.y, a.z), kind: state.kind, heading: a.heading });
      emit({ type: 'respawn' });
      retarget(900);
    }
    if (c.back) {
      const k = clamp01((c.age - CRASH.back) / (CRASH.done - CRASH.back));
      const s = state.ship;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.set(s.pitch || 0, s.heading, -(s.bank || 0), 'YXZ');
      const grow = 1 - (1 - k) ** 3;
      m.group.scale.set(grow, grow, grow * (1 + (1 - k) * 5));
    }
    if (c.age >= CRASH.done) {
      state.crash = null;
      state.safeUntil = state.clock + SAFE;
      m.group.scale.setScalar(1);
      m.group.visible = true;
      state.lastInput = performance.now();
    }
    return true;
  };

  // ── The dive: down on the planet, flown (the page hands over to its
  // surface as it ends: pages/Galaxy.jsx, travel.js) ──
  function stepDive(dt) {
    const d = state.dive;
    d.age += reduced ? DIVE : Math.min(dt, 0.05);
    const p = diveAt(d, d.age);
    const s = state.ship;
    s.x = p.x;
    s.y = p.y;
    s.z = p.z;
    s.heading = p.heading;
    s.pitch = 0;
    s.bank = 0;
    s.speed = SHIP.boost * (0.6 + p.k);
    state.streak = Math.max(state.streak, p.k);
    state.shake = Math.max(state.shake, p.k * 0.8);
    if (p.k >= 1 && !d.done) {
      d.done = true;
      engine?.set({ speed: 0, on: false });
      emit({ type: 'dove', system: state.sys?.id });
    }
    return !d.done;
  }

  // ── Hyperspace ──
  // (the way the reticle is, from the eye: the star you see behind it, in
  // the chase view as in the cockpit; the jump then comes round onto it)
  const sight = new THREE.Vector3();
  const aimDir = [0, 0, 0];
  const aimOpts = { keep: null, dirs: null }; // (the sky's stars' bearings are the ones it looks along, not worked out again every frame)
  const aimAt = (ship) => {
    const was = state.aim?.id ?? null;
    let dir = null;
    if (ship && state.sys) {
      const [nx, ny, nz] = nose(ship);
      sight.set(ship.x + nx * 6, ship.y + ny * 6, ship.z + nz * 6).sub(camera.position);
      if (sight.lengthSq() > 1e-6) dir = sight.normalize().toArray(aimDir);
      else {
        aimDir[0] = nx;
        aimDir[1] = ny;
        aimDir[2] = nz;
        dir = aimDir;
      }
    }
    aimOpts.keep = was;
    aimOpts.dirs = sky.beacons;
    state.aim = dir ? starAhead(state.sys, dir, aimOpts) : null;
    const id = state.aim?.id ?? null;
    if (id === was) return;
    emit({ type: 'aim', id });
    // (the first time, the crew say what it means)
    if (id && !state.courseSaid) {
      state.courseSaid = true;
      emit({ type: 'event', id: 'course' });
    }
  };
  let longest = 0; // (DEV) the longest frame, in ms, since the last jump started
  let pendingSystem = null; // the system the URL asks for, if a jump to it is waiting
  let asked = props.system ?? null; // the system the page last asked for
  const jumpDir = new THREE.Vector3();
  const spoolQ = new THREE.Quaternion();
  const startJump = (toId, why = 'course') => {
    const to = systemById(toId);
    if (!to || !state.sys || to.id === state.sys.id || state.crash || state.dive) return false;
    if (state.jump && state.jump.phase !== 'align') return false;
    // the Interdictor's well: no jump till you're clear of it
    if (state.held) {
      if (state.clock - state.heldSaid > 2.5) {
        state.heldSaid = state.clock;
        emit({ type: 'jump', phase: 'held', to: to.id });
        import('../../lib/sfx').then((x) => x.buzz());
      }
      return false;
    }
    const dir = courseTo(state.sys, to);
    jumpDir.set(...dir);
    state.auto = null;
    state.jump = { to, from: state.sys, phase: state.ship ? 'align' : 'spool', age: 0, dir, dur: jumpSeconds(state.sys, to), built: false, dressed: false, why };
    if (state.view === 'map') state.view = state.seat;
    // its ships' models loading and its built ones made, in the seconds before the tunnel
    const kinds = kindsIn(to);
    models.want(kinds);
    models.prebuild(kinds);
    longest = 0;
    emit({ type: 'jump', phase: 'align', to: to.id, ly: lightYears(state.sys, to) });
    heard();
    ctx.invalidate();
    return true;
  };
  function cancelJump(why) {
    if (!state.jump || state.jump.phase !== 'align') return;
    state.jump = null;
    emit({ type: 'jump', phase: 'cancel', why });
  }
  // the Interdictor's well bites: the jolt, the cruiser dropping in across
  // the bow, and the hold (adventure() launches its TIEs and lets it go)
  const bite = (j) => {
    const place = interdictorPlace(state.ship, Math.random() < 0.5 ? -1 : 1);
    interdictor.arrive(place);
    state.held = { at: place.at, hangar: place.hangar, since: state.clock, pack: 'coming', to: j.to.id, faction: state.sys?.faction === 'remnant' ? 'remnant' : 'empire' };
    state.heldSaid = -1e9;
    state.flare = Math.max(state.flare, 2.2);
    state.shake = Math.max(state.shake, 0.9);
    state.kick = 1;
    import('../../lib/sfx').then((x) => x.alarm());
    emit({ type: 'interdicted', to: j.to.id, from: j.from.id });
  };
  const jumpFrame = (dt) => {
    const j = state.jump;
    j.age += dt;
    const s = state.ship;
    if (j.phase === 'align') {
      // come round onto the course, easing off to cruise
      const input = { throttle: s.speed > SHIP.cruise ? 0 : 0.35, ...steerToward(s, j.dir) };
      state.ship = step(s, input, dt, state.space.solids, state.space).ship;
      if (aligned(state.ship, j.dir) > 0.996 || j.age > JUMP.align) {
        j.phase = 'spool';
        j.age = 0;
        emit({ type: 'jump', phase: 'spool', to: j.to.id });
        import('../../lib/clips').then((c) => c.playClip('hyperspaceEnter', { offset: Math.max(0, 1.17 - JUMP.spool), keep: true }).then((h) => !h && import('../../lib/sfx').then((x) => x.hyperspace())));
      }
      return;
    }
    if (j.phase === 'spool') {
      if (!j.counted) {
        // a jump that's spooling up is one the Empire counts: the one that's due is cut short
        j.counted = true;
        const verdict = interdiction.jumped();
        if (verdict.interdicted && interdictor) {
          j.interdicted = true;
          j.cut = cutAt(j.dur);
        }
      }
      const k = clamp01(j.age / JUMP.spool);
      // pointing true, and away: faster and faster, the stars drawn out
      const q = orientOf(s, headQ);
      const want = spoolQ.setFromRotationMatrix(lookM.lookAt(ORIGIN, jumpDir, UP)); // (the nose, −z, along the course)
      q.slerp(want, clamp01(dt * 6));
      const e = shipEuler.setFromQuaternion(q, 'YXZ');
      state.ship = { ...s, heading: e.y, pitch: e.x, bank: -e.z, speed: s.speed + dt * (20 + k * 160), rate: 0, tipRate: 0, rollRate: 0 };
      const [fx, fz] = forward(state.ship.heading);
      const cp = Math.cos(state.ship.pitch);
      state.ship.x += fx * cp * state.ship.speed * dt;
      state.ship.z += fz * cp * state.ship.speed * dt;
      state.ship.y += Math.sin(state.ship.pitch) * state.ship.speed * dt;
      jumpFx.set({ stretch: k * k, tunnel: 0, flash: k > 0.92 ? (k - 0.92) / 0.08 : 0, speed: k * 300 });
      if (k >= 1) {
        j.phase = 'tunnel';
        j.age = 0;
        state.world.group.visible = false;
        hunters?.clear();
        emit({ type: 'jump', phase: 'tunnel', to: j.to.id });
      }
      return;
    }
    if (j.phase === 'tunnel') {
      const k = clamp01(j.age / 0.35);
      jumpFx.set({ stretch: 1 - k * 0.4, tunnel: k, flash: Math.max(0, 1 - j.age * 3), speed: 300 });
      // the next system, built behind the tunnel (a frame in, so the flash is up first)
      if (!j.built && j.age > 0.12) {
        j.built = true;
        enter(j.to).then(() => (j.ready = true));
        if (state.world) state.world.group.visible = false;
      } else if (j.built && !j.dressed) {
        // (and its sky and environment the frame after, not in the same one)
        j.dressed = true;
        dressSystem(j.to);
      }
      const bitten = Boolean(j.interdicted && j.age >= j.cut);
      if (j.ready && j.dressed && (j.age >= j.dur || bitten)) {
        // out: off the new system's planet, on the side you came in from;
        // or, pulled out by the Interdictor's well, a long way short of it
        const a = bitten ? dropPoint(arrival(j.to, j.from)) : arrival(j.to, j.from);
        state.ship = { ...spawn(null, a), speed: 46 };
        camQOn = false;
        state.world.group.visible = true;
        j.phase = 'exit';
        j.age = 0;
        import('../../lib/clips').then((c) => c.playClip('hyperspaceExit', { keep: true }));
        props.onArrive?.(j.to.id, j.from.id);
        emit({ type: 'arrive', id: j.to.id, from: j.from.id });
        if (bitten) bite(j);
      } else if (j.age > j.dur + 6 && !j.ready) j.ready = true; // (never stuck in there)
      return;
    }
    if (j.phase === 'exit') {
      const k = clamp01(j.age / JUMP.exit);
      jumpFx.set({ stretch: (1 - k) ** 2, tunnel: Math.max(0, 1 - k * 4), flash: Math.max(0, 1 - k * 3) * 0.9, speed: (1 - k) * 300 });
      // easing down out of it
      state.ship = step({ ...s, speed: Math.max(SHIP.cruise, s.speed - dt * 36) }, { throttle: 0.6 }, dt, state.space.solids, state.space).ship;
      if (k >= 1) {
        jumpFx.set({ stretch: 0, tunnel: 0, flash: 0, speed: 0 });
        // (the first system's arrival, said as you come out into it)
        if (!j.from) emit({ type: 'arrive', id: j.to.id, from: null });
        state.jump = null;
        state.safeUntil = state.clock + SAFE;
        if (pendingSystem && pendingSystem !== state.sys.id) startJump(pendingSystem, 'link');
        pendingSystem = null;
      }
    }
  };

  // ── Flying ──
  const tractorPull = new THREE.Vector3();
  const candBuf = []; // (what the guns can lock on to: the hunters and the other pilots, in one list, kept)
  const fly = (dt, t) => {
    if (state.crash) return crashing(dt);
    if (state.jump) {
      jumpFrame(dt);
      shipToModel(dt, t, { throttle: 1 });
      return true;
    }
    let input;
    if (state.auto) {
      const a = autopilot(state.ship, state.auto.id, state.auto.park, state.space);
      input = a.input;
      if (a.done) {
        state.auto = null;
        emit({ type: 'parked' });
      }
    } else {
      input = steering();
      // the nose follows the lock (targeting.js: a nudge toward the lead,
      // as much as the lock-tracking setting allows, giving way to the stick)
      if (state.trackable && state.lead && state.lead.t <= AIM.life) {
        const n = trackNudge(state.ship, state.lead, controls().track, input);
        input.turn = clamp(input.turn + n.turn, -1, 1);
        input.climb = clamp(input.climb + n.climb, -1, 1);
      }
    }
    if (state.keys.fire || state.fireBtn) fire();
    // (under the Interdictor's hold the sublight drive stays shut: the boost is the boost)
    const { ship: stepped, events } = step(state.ship, state.held ? { ...input, interdicted: true } : input, dt, state.space.solids, state.space);
    let ship = stepped;
    // the tractor beam (Alderaan's Death Star): drawn in, and harder the nearer
    const tr = state.world.tractor;
    if (tr) {
      tractorPull.set(tr.at.x - ship.x, tr.at.y - ship.y, tr.at.z - ship.z);
      const d = tractorPull.length();
      const k = clamp01((tr.reach - d) / (tr.reach - tr.r * 1.25));
      state.pull = k;
      if (k > 0) {
        const v = tractorPull.normalize().multiplyScalar((4 + 18 * k) * dt);
        ship = { ...ship, x: ship.x + v.x, y: ship.y + v.y, z: ship.z + v.z };
        if (!state.pullSaid && k > 0.15) {
          state.pullSaid = true;
          emit({ type: 'tractor' });
        }
        if (!reduced) state.shake = Math.max(state.shake, k * 0.25);
        // into its hangar: you're aboard
        if (d < tr.r * 1.18) {
          state.crash = { age: 0, id: 'deathstar', board: tr.board, from: new THREE.Vector3(ship.x, ship.y, ship.z), normal: new THREE.Vector3(ship.x - tr.at.x, ship.y - tr.at.y, ship.z - tr.at.z).normalize(), radius: tr.r, point: new THREE.Vector3(ship.x, ship.y, ship.z), fwd: forward(ship.heading), spin: [0.2, 0.1], impact: false, back: false, tractor: true };
          state.crash.age = CRASH.impact - 0.01;
          emit({ type: 'boarded' });
        }
      } else state.pullSaid = false;
    }
    // Scarif's shield: solid, but for the gate
    const sh = state.world.shield;
    if (sh) {
      const r = Math.hypot(ship.x, ship.y, ship.z);
      const r0 = Math.hypot(state.ship.x, state.ship.y, state.ship.z);
      const gate = state.world.gate;
      const through = gate && apart(ship.x, ship.y, ship.z, gate.at.x, gate.at.y, gate.at.z) < gate.hole + 2;
      if (!through && (r - sh.r) * (r0 - sh.r) < 0) {
        const k = (r0 > sh.r ? sh.r + 0.3 : sh.r - 0.3) / r;
        ship = { ...ship, x: ship.x * k, y: ship.y * k, z: ship.z * k, speed: -ship.speed * 0.3 };
        emit({ type: 'bump', id: 'shield', hard: true });
        if (!state.shieldSaid) {
          state.shieldSaid = true;
          emit({ type: 'event', id: 'scarif-shield' });
        }
      }
    }
    state.ship = ship;
    // the star the nose is on, if it's on one; flying out of the system
    // with it there, you're on your way to it
    aimAt(ship);
    if (state.aim && !state.auto && !state.pull && Math.hypot(ship.x, ship.z) > state.space.edge - 10 && ship.speed > 1) {
      const [fx, fz] = forward(ship.heading);
      if (fx * ship.x + fz * ship.z > 0) startJump(state.aim.id, 'edge');
    }
    for (const e of events) {
      if (e.type === 'bump' && e.id === 'ds2-shield') state.world.shieldHit?.();
      if (e.type !== 'crash') emit(e);
      else if (!state.crash) startCrash(e);
    }
    if (state.crash) return true;

    const boosting = input.boost && input.throttle > 0 && ship.speed > SHIP.cruise * 0.7;
    if (boosting && !state.boosting) {
      emit({ type: 'boost', first: state.boosts++ === 0 });
      if (!reduced) {
        state.flare = Math.max(state.flare, 1.5);
        state.kick = 1;
      }
    }
    state.boosting = boosting;
    const want = !reduced && ship.speed > SHIP.cruise + 0.2 ? clamp01((ship.speed - SHIP.cruise) / (SHIP.boost - SHIP.cruise)) : 0;
    state.streak += (want - state.streak) * clamp01(dt * 4);

    // at something: arriving, and leaving
    const now = atGoal(ship, state.space.goals, state.at);
    if (now !== state.at) {
      state.at = now;
      props.onAt?.(now);
      if (now) emit({ type: 'at', id: now });
    }

    // the guns: the lock, the lead, whether a shot would bend onto it
    let cands = hunters?.targets ?? NO_TARGETS;
    if (pilots.count) {
      candBuf.length = 0;
      for (const c of cands) candBuf.push(c);
      for (const c of pilots.targets) candBuf.push(c);
      cands = candBuf;
    }
    const was = state.lock?.id ?? null;
    state.lock = cands.length || state.lock ? track(ship, cands, state.lock, dt, { cycle: state.cycle }) : null;
    state.cycle = 0;
    const tgt = state.lock ? (cands.find((c) => c.id === state.lock.id) ?? null) : null;
    state.lockTarget = tgt;
    // (the nose follows only a lock on a hunter, one picked by hand, or one
    // being shot at: not a passing pilot or a part of the Citadel the guns
    // happened on)
    state.trackable = Boolean(tgt && (hunters?.targets.includes(tgt) || state.lock?.manual || performance.now() - state.lastShot < TRACK_AFTER_SHOT));
    if (tgt && tgt.id !== was && state.shown && !document.hidden) lockSound();
    state.lead = tgt ? intercept(ship, AIM.bolt + Math.max(0, ship.speed), tgt.at, tgt.vel) : null;
    state.hot = Boolean(state.lead && state.lead.t <= AIM.life && assistAmount(nose(ship), dirTo(ship, state.lead), controls().assist) >= 1);
    let bx = 0;
    let by = 0;
    let bz = 0;
    if (tgt && !reduced) {
      const vx = tgt.at.x - ship.x;
      const vy = tgt.at.y - ship.y;
      const vz = tgt.at.z - ship.z;
      const l = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      const k = Math.min(0.3, l * 0.08) / l;
      bx = vx * k;
      by = vy * k;
      bz = vz * k;
    }
    const ease = 1 - Math.exp(-dt * 3);
    state.bias[0] += (bx - state.bias[0]) * ease;
    state.bias[1] += (by - state.bias[1]) * ease;
    state.bias[2] += (bz - state.bias[2]) * ease;

    shipToModel(dt, t, input);
    if (!state.idleSaid && !state.auto && Math.abs(ship.speed) < 0.05 && state.shown && !document.hidden && performance.now() - state.lastInput > IDLE) {
      state.idleSaid = true;
      emit({ type: 'idle' });
    }
    return true;
  };
  const shipToModel = (dt, t, input) => {
    const ship = state.ship;
    const m = state.model;
    m.update(t);
    m.group.visible = state.cabK < 0.6 && !(state.jump?.phase === 'tunnel' && state.view === 'cockpit');
    m.group.position.set(ship.x, ship.y + (reduced ? 0 : Math.sin(t * 2.1) * 0.012), ship.z);
    m.group.rotation.set(ship.pitch || 0, ship.heading, -(ship.bank || 0), 'YXZ');
    m.pivot.rotation.set(reduced ? 0 : clamp(-(input.throttle || 0) * 0.06, -0.08, 0.08), 0, -(ship.lean || 0));
    const spooling = state.jump && state.jump.phase !== 'align' ? 1 : 0;
    m.setThrottle(Math.max(spooling, clamp01(Math.abs(ship.speed) / SHIP.cruise) * (0.7 + state.streak * 0.3)));
    updatePlumes(dt, t, Math.max(spooling, clamp01((ship.speed - 0.5) / SHIP.cruise) * (0.7 + 0.3 * state.streak)), 1 + state.streak * 1.3 + spooling * 2);
    // the parts fitted in the hangar: their vanes and glows with the throttle and the stick
    m.drive?.(dt, { throttle: Math.max(spooling, clamp01(Math.abs(ship.speed) / SHIP.cruise)), boost: state.streak > 0.3 || spooling > 0, turn: input.turn || 0, climb: input.climb || 0 });
    engine?.set({ speed: Math.min(ship.speed, SHIP.boost * 1.2), boost: state.streak > 0.3 || spooling > 0, on: state.shown && !props.frozen && !document.hidden });
  };

  // ── What goes on round you ──
  const onHunters = (e) => {
    if (e.type === 'hunted') {
      if (!e.prey) emit({ type: 'hunted', faction: e.faction, ace: e.kinds.includes('tieadvanced') });
    } else if (e.type === 'laser') hurt(e.damage);
    else if (e.type === 'shot') emit(e);
    else if (e.type === 'escaped' || e.type === 'cleared') {
      emit(e);
      if (pieces?.destroyerHere && !hunters.active) pieces.leave();
    }
  };
  const later = [];
  const adventure = (dt, t) => {
    state.clock += dt;
    const live = flying() && !state.crash && !state.jump && !props.frozen ? state.ship : null;
    if (hunters) for (const e of hunters.update(dt, t, live)) onHunters(e);
    let busy = pieces ? pieces.update(dt, t, camera) : false;
    if (interdictor) busy = interdictor.update(dt, t) || busy;
    if (live) {
      if (state.clock - state.hitAt > state.stats.delay && state.shield < 100) state.shield = Math.min(100, state.shield + dt * 12 * state.stats.regen);
      if (state.shield > 70) state.lowSaid = false;
      state.heat = Math.max(0, state.heat - dt / 45);
      // now and then, whoever holds the system comes for you; the Empire (and
      // what's left of it) sometimes brings a Star Destroyer to launch them
      const faction = state.sys?.faction;
      if (hunters && faction && state.flown && !hunters.active && !pieces?.destroyerHere && !state.held) {
        if (state.shield >= 50) state.nextHunt -= dt * (1 + state.heat * 0.4); // (not while your shields are low)
        if (state.nextHunt <= 0) {
          state.nextHunt = 50 + Math.random() * 45;
          const travelling = state.space.openness(live.x, live.y, live.z) > 0.5 && Math.abs(live.speed) > 30;
          if ((faction === 'empire' || faction === 'remnant') && pieces && Math.random() < 0.3) {
            const d = pieces.destroyer(live);
            if (d) {
              emit({ type: 'event', id: 'destroyer' });
              later.push({ at: state.clock + 2.4, run: () => state.ship && !state.crash && !state.jump && hunters.pack(faction, state.ship, { from: d.hangar, size: 3, ace: faction === 'empire' && Math.random() < 0.35 }) });
            }
          } else hunters.pack(faction, live, { ahead: travelling, heat: state.heat, first: hunts++ === 0 });
        }
      }
      // the Interdictor's hold: its TIEs launch a moment after it's here, and
      // it lets go once they're gone, once you're out past the well, or once
      // it's had its go (interdiction.js); then it jumps away
      const h = state.held;
      if (h && hunters) {
        if (h.pack === 'coming' && state.clock - h.since >= INTERDICTION.launch) {
          h.pack = 'here';
          hunters.pack(h.faction, live, { from: { x: h.hangar[0], y: h.hangar[1], z: h.hangar[2] }, size: INTERDICTION.pack, ace: Math.random() < INTERDICTION.ace, interdict: true });
        } else if (h.pack === 'here' && !hunters.active) h.pack = 'gone';
        const why = holdLifts({ since: h.since, now: state.clock, pack: h.pack, inWell: inWell(live, h.at) });
        if (why) {
          state.held = null;
          state.nextHunt = 50 + Math.random() * 45;
          emit({ type: 'wellclear', why });
        }
      }
      if (interdictor?.here && !state.held && !hunters?.active) {
        interdictor.leave();
        emit({ type: 'event', id: 'leave' });
      }
      for (let i = 0; i < later.length; ) {
        const l = later[i];
        if (state.clock < l.at) i++;
        else {
          later.splice(i, 1);
          l.run();
        }
      }
    } else later.length = 0;
    if (state.hurt > 0) {
      state.hurt = Math.max(0, state.hurt - dt * 2.2);
      busy = true;
    }
    post.hit(state.hurt);
    placeShield();
    return busy || Boolean(hunters?.count);
  };

  // ── The HUD (the page's markup, the universe map's classes) ──
  let shieldOn = false;
  const placeShield = () => {
    const el = props.shield?.current;
    if (!el) return;
    const on = flying() && !state.crash && !state.jump && !props.frozen && Boolean(hunters?.active || state.shield < 99.5 || state.pull > 0);
    if (on !== shieldOn) {
      shieldOn = on;
      el.toggleAttribute('data-on', on);
    }
    if (!on) return;
    el.style.setProperty('--shield', (state.shield / 100).toFixed(3));
    el.toggleAttribute('data-low', state.shield < 35);
  };
  const placeStick = () => {
    const el = props.stick?.current;
    if (!el) return;
    const st = state.stick;
    if (!st?.on) {
      el.removeAttribute('data-on');
      return;
    }
    el.setAttribute('data-on', '');
    el.style.transform = `translate3d(${st.x}px, ${st.y}px, 0)`;
    const k = Math.min(1, (Math.hypot(st.dx, st.dy) * controls().drag) / STICK);
    const a = Math.atan2(st.dy, st.dx);
    el.style.setProperty('--kx', `${(Math.cos(a) * k * 28).toFixed(1)}px`);
    el.style.setProperty('--ky', `${(Math.sin(a) * k * 28).toFixed(1)}px`);
  };
  let hud = { root: null };
  const hudEls = () => {
    const root = props.hud?.current ?? null;
    if (root !== hud.root) {
      const q = (c) => root?.querySelector(c) ?? null;
      hud = { root, reticle: q('.universe-reticle'), lock: q('.universe-lock'), lockName: q('.universe-lock-name'), lockDist: q('.universe-lock-dist'), lead: q('.universe-lead'), nav: q('.universe-nav'), navName: q('.universe-nav-name'), navDist: q('.universe-nav-dist'), threats: [...(root?.querySelectorAll('.universe-threat') ?? [])], text: new Map(), on: new Map() };
    }
    return hud;
  };
  const setText = (h, el, s) => {
    if (!el || h.text.get(el) === s) return;
    h.text.set(el, s);
    el.textContent = s;
  };
  const setOn = (h, el, on) => {
    if (!el || h.on.get(el) === on) return;
    h.on.set(el, on);
    el.toggleAttribute('data-on', on);
  };
  const hudAt = { x: 0, y: 0, z: 0 };
  const placeMark = (el, p, r = 0) => {
    const off = !onScreen(p.x, p.y, p.z, rect);
    let x = p.x;
    let y = p.y;
    if (off) {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const k = p.z > 0 ? 1 : -1;
      const edge = edgeOf((p.x - cx) * k, (p.y - cy) * k, rect);
      x = edge.x;
      y = edge.y;
      el.style.setProperty('--a', `${edge.angle.toFixed(3)}rad`);
    }
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.toggleAttribute('data-off', off);
    if (r) el.style.setProperty('--r', `${Math.round(r)}px`);
  };
  const range = (d) => (d < 10 ? d.toFixed(1) : Math.round(d).toString());
  const threatList = [];
  const placeHud = () => {
    const h = hudEls();
    if (!h.root) return;
    const s = state.ship;
    const on = flying() && !state.crash && !props.frozen && !(state.jump && state.jump.phase !== 'align');
    const [nx, ny, nz] = on ? nose(s) : [0, 0, 0];
    const retOn = on && !state.auto && !state.jump;
    setOn(h, h.reticle, retOn);
    if (retOn) {
      toScreen(s.x + nx * 6, s.y + ny * 6, s.z + nz * 6, hudAt);
      h.reticle.style.transform = `translate3d(${hudAt.x.toFixed(1)}px, ${hudAt.y.toFixed(1)}px, 0)`;
      h.reticle.toggleAttribute('data-hot', state.hot);
      h.reticle.toggleAttribute('data-hit', state.hitMark > 0);
    }
    const tgt = on ? state.lockTarget : null;
    setOn(h, h.lock, Boolean(tgt));
    if (tgt) {
      toScreen(tgt.at.x, tgt.at.y, tgt.at.z, hudAt);
      const px = hudAt.z > 0 ? (tgt.size / (hudAt.z * tanHalf)) * (size.h / 2) * 2.6 : 0;
      placeMark(h.lock, hudAt, clamp(px, 30, 140));
      h.lock.toggleAttribute('data-hot', state.hot);
      setText(h, h.lockName, tgt.name ?? NAMES[tgt.kind] ?? SHIP_INFO[tgt.kind]?.name ?? tgt.kind);
      setText(h, h.lockDist, range(apart(tgt.at.x, tgt.at.y, tgt.at.z, s.x, s.y, s.z)));
      const tough = (tgt.hpMax ?? 1) > 1;
      h.lock.toggleAttribute('data-tough', tough);
      if (tough) h.lock.style.setProperty('--hp', (tgt.hp / tgt.hpMax).toFixed(3));
    }
    let n = 0;
    if (on && h.threats.length) {
      threatList.length = 0;
      for (const c of hunters?.targets ?? NO_TARGETS) if (c.threat && c.id !== tgt?.id) threatList.push(c);
      // (and a pilot whose shots have been landing on you)
      if (pilots.count) for (const c of pilots.targets) if (c.threat && c.id !== tgt?.id) threatList.push(c);
      threatList.sort((a, b) => apart(a.at.x, a.at.y, a.at.z, s.x, s.y, s.z) - apart(b.at.x, b.at.y, b.at.z, s.x, s.y, s.z));
      for (const c of threatList) {
        if (n >= h.threats.length) break;
        toScreen(c.at.x, c.at.y, c.at.z, hudAt);
        if (onScreen(hudAt.x, hudAt.y, hudAt.z, rect)) continue;
        const el = h.threats[n++];
        setOn(h, el, true);
        placeMark(el, hudAt);
      }
    }
    for (let i = n; i < h.threats.length; i++) setOn(h, h.threats[i], false);
    const lead = tgt && state.lead && state.lead.t <= AIM.life ? state.lead : null;
    let leadOn = false;
    if (lead) {
      toScreen(lead.x, lead.y, lead.z, hudAt);
      leadOn = onScreen(hudAt.x, hudAt.y, hudAt.z, rect, 8);
      if (leadOn) {
        h.lead.style.transform = `translate3d(${hudAt.x.toFixed(1)}px, ${hudAt.y.toFixed(1)}px, 0)`;
        h.lead.toggleAttribute('data-hot', state.hot);
      }
    }
    setOn(h, h.lead, leadOn);
    // the way to go: the jump's bearing while coming round onto it, else
    // wherever the autopilot's taking you
    let goal = null;
    if (on && state.jump) goal = { at: [s.x + state.jump.dir[0] * 2000, s.y + state.jump.dir[1] * 2000, s.z + state.jump.dir[2] * 2000], name: `Jump: ${state.jump.to.name}`, dist: `${lightYears(state.jump.from, state.jump.to).toLocaleString('en-US')} ly`, reach: 0, way: true };
    else if (on && state.auto) {
      const g = state.space.goals[state.auto.id];
      if (g) goal = { at: g.at, name: g.name, dist: range(apart(g.at[0], g.at[1], g.at[2], s.x, s.y, s.z)), reach: g.reach ?? g.r, way: false };
    }
    setOn(h, h.nav, Boolean(goal));
    if (goal) {
      toScreen(goal.at[0], goal.at[1], goal.at[2], hudAt);
      const px = hudAt.z > 0 && goal.reach ? (goal.reach / (hudAt.z * tanHalf)) * (size.h / 2) * 2.2 : 0;
      placeMark(h.nav, hudAt, clamp(px, 34, 260));
      h.nav.toggleAttribute('data-way', goal.way);
      setText(h, h.navName, goal.name);
      setText(h, h.navDist, goal.dist);
    }
  };

  // ── Being online ──
  const onNet = (e) => {
    if (e.type === 'hit') hurt(e.damage, e.from);
    else if (e.type === 'hunterHit') {
      // another pilot's bolt into one of the hunters after you
      const r = hunters?.damage(e.id, e.damage);
      if (r) {
        landed(r, popDir.set(0, 1, 0));
        if (r.down) net?.helped?.(e.from, NAMES[r.kind] ?? 'hunter');
      }
    } else if (e.type === 'downed') {
      const at = pilots.at(e.id);
      if (at) pops.hit({ point: at, normal: new THREE.Vector3(0, 1, 0), radius: 0.55 });
      if (e.by && e.by === net?.selfId) {
        emit({ type: 'kill', kind: 'pilot' });
        if (!reduced) state.shake = Math.max(state.shake, 0.2);
      }
    }
    ctx.invalidate();
  };
  const setNet = (client) => {
    if (client === net) return;
    netOff?.();
    net = client ?? null;
    netOff = net?.on(onNet) ?? null;
  };

  // the hunters a system's side meets, made ahead (a pack arriving shouldn't stall a frame)
  const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60));
  const stocked = new Set();
  const stockUp = () => {
    const f = state.sys?.faction;
    if (reduced || !f || stocked.has(f) || !warmed) return;
    stocked.add(f);
    const want = Object.entries(AHEAD[f] ?? {});
    const next = () => {
      if (disposed) return;
      const job = want.find(([k, n]) => fleet.stocked(k) < n && !fleet.loaded(k));
      if (!job) return;
      const model = buildGalaxyShip(job[0]);
      singlePass(model.group);
      fleet.stock(job[0], model);
      idle(next);
    };
    idle(next);
  };

  // ── Frames ──
  const t0 = performance.now();
  const sunWorld = new THREE.Vector3();
  const toShip = new THREE.Vector3();
  let first = true;
  let lastNow = 0;
  function render(ms, now) {
    if (import.meta.env.DEV) {
      // (the gap between this frame and the last, as the page saw it: a tab that was hidden shows as one long frame)
      if (lastNow) longest = Math.max(longest, now - lastNow);
      lastNow = now;
    }
    // what's sized by the pixel ratio (the runtime's quality changes it) follows it,
    // and the planets' detail follows the sharpness
    const ratio = gfx.ratio;
    if (ratio !== ratioSeen) {
      ratioSeen = ratio;
      sky.setRatio(ratio);
      state.world?.setRatio(ratio);
    }
    const wanted = capDetail ? 0 : post.sharpness;
    if (Math.abs(wanted - detail) >= 0.05) {
      detail = wanted;
      state.world?.setDetail(detail);
    }
    const dt = ms / 1000;
    const t = reduced ? 0 : (now - t0) / 1000;
    const wt = wall();
    if (!flying() && props.ship) setShip(props.ship);
    if (!state.ship && state.kind && state.sys) {
      // a new pilot: out of hyperspace into the system you asked for, or,
      // just taken off from its planet (pages/GalaxySurface.jsx), climbing
      // away from it out of its air
      const launched = takeOff(state.sys);
      const a = launched ?? arrival(state.sys, null);
      state.ship = { ...spawn(null, a), speed: reduced ? 0 : launched ? 30 : 46, pitch: launched ? 0.25 : 0 };
      camQOn = false;
      if (launched) emit({ type: 'launch' });
      else if (!reduced) {
        state.jump = { to: state.sys, from: null, phase: 'exit', age: 0, dir: [0, 0, -1], dur: 0, built: true, dressed: true, ready: true };
        jumpFx.set({ stretch: 1, tunnel: 0, flash: 1, speed: 300 });
      }
    }
    let moving = false;
    if (state.dive && flying()) moving = stepDive(dt);
    else if (flying() && !props.frozen) moving = fly(dt, t);
    if (flying()) follow(dt);

    // the camera: behind the ship or in it, or watching a crash
    if (flying()) {
      const to = state.crash && !state.crash.back ? crashView() : state.view === 'cockpit' ? cockpitView() : chaseView();
      let v = to;
      if (blendTo.k < 1) {
        blendTo.k = Math.min(1, blendTo.k + dt / blendTo.dur);
        const k = blendTo.k * blendTo.k * (3 - 2 * blendTo.k);
        viewBlend.target.copy(blendTo.from.target).lerp(to.target, k);
        viewBlend.quat.copy(blendTo.from.quat).slerp(to.quat, k);
        viewBlend.dist = blendTo.from.dist + (to.dist - blendTo.from.dist) * k;
        v = viewBlend;
      }
      view = v;
      applyView(v);
    } else {
      // no ship yet: looking at the planet from a way off
      const r = state.sys?.body?.r ?? 40;
      camera.position.set(r * 1.6, r * 0.7, r * 3.4);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
    }
    const cabWant = flying() && state.view === 'cockpit' && !state.crash ? 1 : 0;
    const cabWas = state.cabK;
    state.cabK += (cabWant - state.cabK) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(state.cabK - cabWant) < 0.002) state.cabK = cabWant;
    if (flying() && state.cabK > 0.001 && !state.crash && cab) {
      camera.rotateY(cab.look.yaw * state.cabK);
      camera.updateMatrixWorld();
    }
    const baseWant = flying() && state.view === 'cockpit' ? cabFov() : FOV;
    state.fovBase += (baseWant - state.fovBase) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    const spool = state.jump && state.jump.phase !== 'align' ? 1 : 0;
    const fov = state.fovBase + (state.dive ? 34 * diveAt(state.dive, state.dive.age).k ** 2 : 0) + (reduced || !flying() ? 0 : 8 * state.streak ** 1.4 + 4 * state.kick * (1 - state.kick * 0.5) + 14 * spool * (state.jump?.phase === 'spool' ? clamp01(state.jump.age / JUMP.spool) : state.jump?.phase === 'tunnel' ? 1 : 1 - clamp01((state.jump?.age ?? 0) / JUMP.exit)));
    if (Math.abs(camera.fov - fov) > 0.005) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      tanHalf = Math.tan((fov * Math.PI) / 360);
    }
    if (state.kick > 0) state.kick = Math.max(0, state.kick - dt * 1.8);
    if (state.shake > 0) {
      const k = state.shake * state.shake * 0.09;
      camera.position.x += Math.sin(now * 0.047) * k + Math.sin(now * 0.091) * k * 0.5;
      camera.position.y += Math.sin(now * 0.061 + 1) * k;
      camera.updateMatrixWorld();
      state.shake = Math.max(0, state.shake - dt * 1.4);
    }
    if (state.flare > 1) {
      state.flare = 1 + (state.flare - 1) * Math.exp(-dt * 2.5);
      if (state.flare < 1.01) state.flare = 1;
      post.flare(state.flare);
    }

    // the system: its moment playing out, its light
    const world = state.world;
    let worldBusy = false;
    if (world) {
      worldBusy = world.update(wt, dt, camera, state.ship);
      const evs = world.events;
      while (evs.length) {
        const e = evs.shift();
        if (!state.jump) emit(e);
      }
      // in the planet's shadow, the sun's gone
      let eclipse = 1;
      if (world.body && state.ship) {
        sunWorld.copy(world.sunLights[0].dir);
        toShip.set(state.ship.x, state.ship.y, state.ship.z);
        const along = toShip.dot(sunWorld);
        const off = toShip.addScaledVector(sunWorld, -along).length();
        const r = world.body.radius ?? 40;
        if (along < 0) eclipse = clamp01((off - r * 0.97) / (r * 0.08));
      }
      state.eclipse += (eclipse - state.eclipse) * clamp01(dt * 4);
      const light = state.eclipse;
      keys[0].intensity = 2.2 * light;
      keys[1].intensity = world.sunLights[1] ? 1.1 * light : 0;
      ambient.intensity = 0.22 + 0.12 * light;
    }
    const inTunnel = state.jump?.phase === 'tunnel';
    sky.group.visible = !inTunnel;
    if (state.aim && (!flying() || state.crash || state.jump || props.frozen)) aimAt(null);
    sky.focus(state.jump?.phase === 'align' ? state.jump.to.id : (state.aim?.id ?? null));
    sky.update(camera, t);
    models.update(t);
    bolts.update(dt);
    flashes.update(dt);
    jumpFx.update(dt, t);
    const fxBusy = crashFx.update(dt, camera) || pops.update(dt, camera);
    const adventuring = adventure(dt, t);
    const shooting = moveBolts(dt);
    // the speed: dust streaming past, the picture rushing out from the ship
    const dustWant = !reduced && flying() && !inTunnel ? 0.35 + 0.65 * clamp01(Math.abs(state.ship.speed) / SHIP.cruise) : 0;
    dustAmount += (dustWant - dustAmount) * clamp01(dt * 3);
    dust.update(camera.position, dustAmount, gfx.ratio);
    if (!reduced && flying() && (state.streak > 0.001 || spool)) {
      const k = Math.max(state.streak, state.jump?.phase === 'spool' ? clamp01(state.jump.age / JUMP.spool) : 0);
      if (state.view === 'cockpit') post.rush(k * 0.8, 0.5, 0.5);
      else if (state.model) {
        state.model.group.getWorldPosition(camP).project(camera);
        post.rush(k, (camP.x + 1) / 2, (camP.y + 1) / 2);
      }
    } else post.rush(0);
    // out in the open on the sublight drive, the stars stretch a little
    if (!state.jump && flying()) {
      const fast = clamp01((Math.abs(state.ship.speed) - SHIP.boost) / 40);
      jumpFx.set({ stretch: fast * 0.18, tunnel: 0, flash: 0, speed: fast * 80 });
    }
    if (state.hitMark > 0) state.hitMark = Math.max(0, state.hitMark - dt * 4);
    // the other pilots in this system
    if (net) {
      const s = flying() ? state.ship : null;
      // (hidden too while the page says you're somewhere you've not got to yet:
      // the pilots there would see you where you are, in the wrong system)
      const elsewhere = Boolean(props.system && state.sys && props.system !== state.sys.id);
      net.pose(s, { hidden: Boolean(state.crash || (state.jump && state.jump.phase !== 'align') || props.frozen || elsewhere), boost: state.streak > 0.3, safe: state.clock < state.safeUntil, shield: state.shield });
      net.pack?.(() => (s && !state.crash && !state.jump && !props.frozen && !elsewhere ? (hunters?.wire() ?? []) : []));
    }
    const piloting = pilots.update(dt, now, net, { project: toScreen, tags: props.tags?.current ?? null, locked: state.lockTarget?.peer ?? null });
    placeHud();
    placeLabels();
    placeStars();
    const showCab = Boolean(cab && cab.kind === state.kind && flying() && state.view === 'cockpit' && state.cabK > 0.6 && !state.crash);
    if (showCab) cabFrame(dt, t);
    post.overlay(showCab ? cabScene : null, camIn);
    renderer.info.reset();
    post.render(size.w, size.h);
    if (first) {
      first = false;
      emit({ type: 'ready' });
    }
    if (props.frozen) return Boolean(state.crash?.through || (state.dive && !state.dive.done));
    return !reduced || moving || shooting || fxBusy || worldBusy || adventuring || piloting || jumpFx.busy || bolts.busy || flashes.busy || net?.peers.size > 0 || Boolean(state.model?.modules?.easing) || cabWas !== state.cabK || state.kick > 0 || state.flare > 1 || Boolean(state.stick?.on || state.jump);
  }
  let dustAmount = 0;
  const cabFrame = (dt, t) => {
    const s = state.ship;
    const look = cab.look;
    let wantYaw = (s.rate || 0) * 0.05;
    if (state.lockTarget) {
      const at = state.lockTarget.at;
      camP.set(at.x - s.x, at.y - s.y, at.z - s.z).applyQuaternion(orientOf(s, headQ).invert());
      wantYaw += clamp(Math.atan2(-camP.x, -camP.z) * 0.2, -0.16, 0.16);
    }
    const k = 1 - Math.exp(-dt * 4);
    look.yaw += (wantYaw - look.yaw) * k;
    look.pitch += ((s.tipRate || 0) * -0.012 - look.pitch) * k;
    camIn.projectionMatrix.copy(camera.projectionMatrix);
    camIn.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    camIn.rotation.set(look.pitch + (reduced ? 0 : Math.sin(t * 0.7) * 0.003), look.yaw + (reduced ? 0 : Math.sin(t * 0.43) * 0.004), 0);
    camIn.updateMatrixWorld();
    cab.built.update(dt, t, { launching: false, t: 0, phase: null, throttle: 0, plan: cab.plan, look });
  };

  // ── Keys ──
  const onKeyDown = (e) => {
    if (!flying() || props.frozen || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    const key = e.key.toLowerCase();
    const onControl = el instanceof HTMLElement && el !== document.body && el.closest('button, a, [role="button"], [tabindex]:not([tabindex="-1"])');
    if (key === 'm') {
      e.preventDefault();
      emit({ type: 'map' });
      return;
    }
    if (key === 'j') {
      e.preventDefault();
      heard();
      // to the star the nose is on; on none, the page opens the map
      if (state.aim && !state.jump && startJump(state.aim.id, 'aim')) return;
      if (!state.jump) emit({ type: 'jumpKey' });
      return;
    }
    if (key === 'v') {
      e.preventDefault();
      heard();
      setSeat(state.seat === 'cockpit' ? 'chase' : 'cockpit');
      return;
    }
    if (key === 'f') {
      e.preventDefault();
      heard();
      if (!e.repeat) fire();
      state.keys.fire = true;
      ctx.invalidate();
      return;
    }
    if (key === 't' || key === 'q') {
      e.preventDefault();
      heard();
      state.cycle = key === 'q' || e.shiftKey ? -1 : 1;
      ctx.invalidate();
      return;
    }
    if ((key === 'e' || (key === 'enter' && !onControl)) && state.at) {
      e.preventDefault();
      emit({ type: 'action', id: state.at });
      return;
    }
    const k = KEYS[key];
    if (!k || (onControl && ARROWS.has(key))) return;
    e.preventDefault();
    heard();
    if (k !== 'boost') takeover();
    state.keys[k] = true;
    ctx.invalidate();
  };
  const onKeyUp = (e) => {
    const k = KEYS[e.key.toLowerCase()];
    if (k) state.keys[k] = false;
  };
  const onBlur = () => {
    state.keys = {};
    state.boostBtn = false;
    state.climbBtn = 0;
    state.fireBtn = false;
  };
  const onHidden = () => engine?.set({ speed: 0, on: !document.hidden && state.shown });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onHidden);

  // ── Pointer: a drag steers; a tap on a hunter locks on, on something here flies you there ──
  const localXY = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const tapped = { x: 0, y: 0, z: 0 };
  const pickHunter = (px, py) => {
    let best = null;
    for (const c of [...(hunters?.targets ?? []), ...pilots.targets]) {
      toScreen(c.at.x, c.at.y, c.at.z, tapped);
      const d = Math.hypot(px - tapped.x, py - tapped.y);
      if (tapped.z > 0.3 && d <= 48 && (!best || d < best.d)) best = { id: c.id, d };
    }
    return best?.id ?? null;
  };
  const pickGoal = (px, py) => {
    let best = null;
    for (const g of state.world?.goals ?? []) {
      toScreen(g.at[0], g.at[1], g.at[2], tapped);
      if (tapped.z <= 0.5) continue;
      const r = ((g.reach ?? g.r) / (tapped.z * tanHalf)) * (size.h / 2);
      const d = Math.hypot(px - tapped.x, py - tapped.y);
      if (d <= Math.max(Math.min(r * 0.6, 200), 22) && (!best || tapped.z < best.z)) best = { id: g.id, z: tapped.z };
    }
    return best?.id ?? null;
  };
  const goTo = (id) => {
    const s = state.ship;
    const g = state.space?.goals[id];
    if (!s || !g || state.crash || state.jump || state.dive || props.frozen) return false;
    if (state.at === id) return false;
    heard();
    state.auto = { id, park: parkBy(g, [s.x, s.y, s.z], state.space.solids) };
    state.view = state.seat;
    state.lastInput = performance.now();
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    retarget(700);
    ctx.invalidate();
    return true;
  };
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (state.drag || props.frozen) return;
    const [x, y] = localXY(e);
    capturePointer(e, canvas);
    heard();
    state.drag = { id: e.pointerId, x, y, moved: 0 };
    ctx.invalidate();
  };
  const onMove = (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    const [x, y] = localXY(e);
    d.moved = Math.max(d.moved, Math.hypot(x - d.x, y - d.y));
    if (d.moved < DRAG || !flying()) return;
    if (!state.stick) takeover();
    state.stick = { id: e.pointerId, x: d.x, y: d.y, dx: x - d.x, dy: y - d.y, on: true, pointer: e.pointerType };
    placeStick();
    ctx.invalidate();
  };
  const endDrag = () => {
    state.drag = null;
    state.stick = null;
    placeStick();
  };
  const onUp = (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    endDrag();
    if (d.moved < DRAG && flying()) {
      const [x, y] = localXY(e);
      const hid = pickHunter(x, y);
      if (hid) state.lock = { id: hid, out: 0, manual: true };
      else {
        const gid = pickGoal(x, y);
        if (gid) goTo(gid);
      }
    }
    ctx.invalidate();
  };
  const onCancel = (e) => {
    if (state.drag?.id !== e.pointerId) return;
    endDrag();
    ctx.invalidate();
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);

  // ── Start: the system asked for, every shader made before the first frame ──
  const start = systemById(props.system) ?? systemById('tatooine');
  // (the sky's bake shader, the one big one, starts linking now and the first bake waits for it, so that no bake after waits for a link, a jump's least of all)
  const prepared = sky.prepare();
  const built = enter(start);
  const dressed = prepared.then(() => {
    if (!disposed) dressSystem(start);
  });
  setShip(props.ship ?? null);
  setNet(props.net);
  const spares = new THREE.Group();
  spares.visible = false;
  const stock = [];
  if (!reduced) {
    for (const k of Object.values(AHEAD[start.faction] ?? {}).length ? Object.keys(AHEAD[start.faction]) : []) {
      const made = buildGalaxyShip(k);
      spares.add(made.group);
      stock.push([k, made]);
    }
  }
  scene.add(spares);
  const ready = Promise.all([built, dressed, warm(scene), post.composer ? precompilePasses(renderer, post.composer, camera) : null]).then(() => {
    scene.remove(spares);
    if (disposed) return;
    for (const [k, model] of stock) fleet.stock(k, model);
    warmed = true;
    stocked.add(start.faction);
    stockUp();
  });

  if (import.meta.env.DEV) {
    window.__galaxy = () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      system: state.sys?.id,
      ship: state.ship && { ...state.ship },
      jump: state.jump && { to: state.jump.to.id, phase: state.jump.phase, age: +state.jump.age.toFixed(2) },
      longest: Math.round(longest),
      aim: state.aim?.id ?? null,
      at: state.at,
      auto: state.auto?.id ?? null,
      view: state.view,
      shield: +state.shield.toFixed(1),
      pull: +state.pull.toFixed(2),
      held: state.held && { pack: state.held.pack, for: +(state.clock - state.held.since).toFixed(1), inWell: state.ship ? inWell(state.ship, state.held.at) : null },
      jumps: interdiction.jumps,
      due: interdiction.due,
      hunters: hunters?.packs ?? [],
      lock: state.lock?.id ?? null,
      goals: state.world?.goals.map((g) => g.id),
      solids: state.space?.solids.length,
    });
    // the ship put at `pose` (x, y, z, heading, pitch, bank), stopped, and the camera there behind it as it would be after
    // an arrival, not still easing to it: a check then sees the same view, however many frames it took to get there
    const pin = (pose) => {
      state.ship = { ...state.ship, ...pose, speed: 0, rate: 0, tipRate: 0, rollRate: 0 };
      state.auto = null;
      camQOn = false; // (the next follow() takes the ship's turn whole)
      blendTo.k = 1;
      state.bias.fill(0);
      state.streak = 0;
      state.kick = 0;
      state.shake = 0;
      ctx.invalidate();
    };
    window.__galaxyDebug = { THREE, scene, camera, renderer, post, state, models, hunters, pilots, startJump, goTo, pin, interdiction, interdictor };
    window.__gltfStats = gltfStats; // { requests, parses }: the models asked for, and the files fetched and parsed for them
  }

  return {
    ready,
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      sky.setRatio(gfx.ratio);
      measure();
    },
    render,
    update(next) {
      props = next;
      if ((next.ship ?? null) !== state.kind) {
        state.loadout = readLoadout(next.loadout ?? STOCK_LOADOUT); // (a new ship comes fitted as it was left)
        state.build = sameBuild(next.build) ? state.build : readBuildWire(next.build ? writeBuild(next.build) : null); // (and on the hull it was left on)
      }
      setShip(next.ship ?? null);
      setBuild(next.build ?? null);
      setLoadout(next.loadout);
      setNet(next.net);
      // the page asking for another system (a link, the URL): jump there, but
      // only when it asks anew (asking.js)
      const ask = asking(asked, next.system, { here: state.sys?.id, to: state.jump?.to.id, midJump: Boolean(state.jump && state.jump.phase !== 'align') });
      asked = ask.asked;
      if (ask.act === 'queue') pendingSystem = next.system;
      else if (ask.act === 'jump') startJump(next.system, 'link');
      if (next.frozen) {
        endDrag();
        state.keys = {};
        engine?.set({ speed: 0, on: false });
      }
    },
    setVisible(on) {
      state.shown = on;
      if (!on) engine?.set({ speed: 0, on: false });
    },
    // the runtime's quality: the sharpness is its own; at the floor (past
    // its last step), the glow and the grade go
    lowerQuality(level = STEPS.length) {
      sky.setRatio(gfx.ratio);
      if (level < STEPS.length) return;
      post.lite();
      capDetail = true;
      ctx.invalidate();
    },
    // down on the planet you're over: true if the dive's begun (it ends with a 'dove' event)
    dive() {
      const s = state.ship;
      const r = state.sys?.body?.r;
      if (!s || !r || state.dive || state.crash || state.jump) return false;
      state.dive = planDive(s, r);
      aimAt(null);
      ctx.invalidate();
      return true;
    },
    // what the next world is told as it takes over: where you were, and on what
    handoff() {
      return { from: 'galaxy', system: state.sys?.id ?? null, ship: state.kind ?? null, dove: Boolean(state.dive?.done) };
    },
    fire(down = true) {
      heard();
      state.fireBtn = down;
      if (down) fire();
      ctx.invalidate();
    },
    boost(on) {
      heard();
      state.boostBtn = on;
      if (on) takeover();
      ctx.invalidate();
    },
    seat() {
      heard();
      setSeat(state.seat === 'cockpit' ? 'chase' : 'cockpit');
    },
    climb(way) {
      heard();
      state.climbBtn = way;
      if (way) takeover();
      ctx.invalidate();
    },
    // Escape: stop flying itself, or coming round for a jump
    escape() {
      if (state.jump?.phase === 'align') {
        cancelJump('escape');
        return true;
      }
      if (state.auto) {
        state.auto = null;
        return true;
      }
      return false;
    },
    // jump to another system (the page's galaxy map): false if it can't now
    jump(id) {
      return startJump(id, 'course');
    },
    // fly itself to something in this system
    goTo,
    dispose() {
      disposed = true;
      engine?.stop();
      dropCab();
      roomEnv?.dispose();
      state.model?.dispose();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onHidden);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      props.stick?.current?.removeAttribute('data-on');
      for (const el of props.hud?.current?.children ?? []) el.removeAttribute('data-on');
      if (import.meta.env.DEV) delete window.__galaxy, delete window.__galaxyDebug, delete window.__gltfStats;
      disposeTree(spares);
      state.world?.dispose();
      crashFx.dispose();
      pops.dispose();
      hunters?.dispose();
      pieces?.dispose();
      interdictor?.dispose();
      netOff?.();
      pilots.dispose();
      fleet.dispose();
      models.dispose();
      bolts.dispose();
      flashes.dispose();
      jumpFx.dispose();
      sky.dispose();
      for (const pl of plumes) pl.trail.dispose();
      boltGeo.dispose();
      boltMat.dispose();
      disposeTree(scene);
      post.dispose();
      env?.dispose();
      renderer.info.autoReset = autoReset;
      canvas.removeAttribute('aria-hidden');
      canvas.style.cursor = '';
    },
  };
}
