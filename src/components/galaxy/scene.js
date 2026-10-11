// A galaxy far, far away, in WebGL: one star system at a time (world.js
// builds it: its planet, its moons, the moment from the films it's
// remembered for), under its own sky (sky.js: the galaxy seen from where the
// system is in it), flown in the ship you fly the universe map in, the same
// way (universe/ship.js, free all the way round, Battlefront's controls,
// universe/controls.js's settings): W and S the throttle, A and D the roll,
// the arrows the nose, Space to boost (out in the open, the sublight drive
// opens up: space.js), F to fire, T and Q to change target, V the cockpit,
// a drag on the map like a stick, G the crew's power and X the big one once
// it's charged (powers.js: Force Focus and a torpedo salvo for Luke, the
// corkscrew and Chewie on the guns for Han, the portal gun and the death ray
// for Rick, the magnet and the crystal for Walt and Jesse). The HUD over it is the universe map's: the
// gun line, the lock and the lead, the threats you can't see, the way to
// wherever you're going (the page's markup, UniverseMap.jsx's classes).
//
// Between systems you jump. Every other system's star is in the sky where
// it really is from here (sky.js, systems.js courseTo), named as the nose
// comes near it: point at one and press J (or the Jump button), or fly out
// of the system with the nose on one, and you're away; or plot a course on
// the galaxy map (the page's) and the ship comes round onto it. It spools
// up and you're in hyperspace: the site's own jump, the same as the universe
// map's (components/Hyperspace.jsx, which the page plays over the scene),
// held in its tunnel while the next system's built behind it; then you drop
// out at its planet, on the side you came in from. The page follows the
// system you're in (/galaxy/hoth), and a link to another sends you jumping
// there.
//
// The Galactic Civil War (gcw.js) is on: at a system it's being fought over,
// its battle's there as you drop in (warfront.js: battles.js lays it out at
// the planet, universe/battle.js fights it), and you're in it, on the
// Rebellion's side; what you do there counts in the war, shared online.
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
// boost, climb, seat, power, escape, jump, goTo, flyTo, dispose }.
// Props: system (an id), ship (a crew id), loadout (what's fitted to it in
// the universe map's hangar: outfit.js; its paint and parts, and how they
// make it fly), controls, net, stick,
// shield, hud, powers (the power bar: PowerBar.jsx), tags, labels (refs, as the universe map's), stars (a ref:
// the other systems' names, by id, moved over their stars), frozen,
// onArrive(id, from) (a jump's come out at a system), onAt(goal id or null),
// onBoard(path) (into the Death Star), onCrash(systemId) → bool (into the
// planet: the page takes you down to its surface, or says no), onEvent(e) (for the comms and the
// page; { type: 'aim', id } as the nose comes onto a star or off it; and
// { type: 'earn', what, n, side: 'galaxy' } for a kill that pays, the war
// front's points and wins as well: universe/economy.js's EARN keys).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { capturePointer } from '../../lib/pointer';
import { createFeel, feelGroups } from '../../lib/three/feel';
import { HITSTOP, MAP_FEEL, atLeast, deadZone, knockForce } from './mapFeel';
import { local as remembered } from '../../lib/hooks';
import { plan as cockpitPlan } from '../cockpit/timeline';
import { freeKit } from '../cockpit/kit';
import { audioContext } from '../../lib/audio';
import { clamp01, disposeTree, precompile, precompilePasses, singlePass } from '../../lib/three/renderer';
import { prepareScene } from '../../lib/three/gpuWork';
import { settle as settleWithin } from '../../lib/settle';
import { device } from '../../lib/device';
import { dropTransmission } from '../../lib/three/glass';
import { gltfStats } from '../../lib/three/gltfCache';
import { STEPS } from '../../lib/three/pace';
import { FOV } from '../universe/flight';
import { createPost } from '../universe/post';
import { GLOW, glowAt } from '../universe/battleFx';
import { bloomGroups } from '../../lib/three/bloom';
import { LOOK } from './look';
import { followRatio } from './drawnAt';
import { houseOn } from '../../lib/three/house';
import { SHIP, TUNE, autopilot, forward, spawn, step } from '../universe/ship';
import { REAIM_MS, parkBehind, pilotSpace, reached } from '../universe/pilotGoal';
import { createHunters } from '../universe/hunters';
import { createShipHits, solidsWith } from '../universe/shipHits';
import { contact, keptSpeed } from '../../lib/combat/contact';
import { createFleet } from '../universe/glbFleet';
import { createSetPieces } from '../universe/setpieces';
import { createCrash } from '../universe/crash';
import { createDust } from '../universe/belt';
import { createTrail } from '../universe/trail';
import { ENGINES, SHIP_MODELS, buildShip, BUILT } from '../universe/shipModels';
import { loadModel } from '../universe/planets';
import { lockSound, shieldSound, shipEngine } from '../universe/sounds';
import { AIM, aimAngles, assist, assistAmount, dirTo, edgeOf, intercept, nose, onScreen, track, trackNudge } from '../universe/targeting';
import { DEFAULTS as CONTROL_DEFAULTS, STICK, dragSteers, keyAxes, keyFlies, stickInput } from '../universe/controls';
import { SIZE as PILOT_SIZE, createPilots } from '../universe/online/pilots';
import { GUARD } from '../universe/online/protocol';
import { paintById } from '../universe/paint';
import { FASTEST, STOCK_LOADOUT, readLoadout, statsOf } from '../universe/outfit';
import { readBuildWire, readTune, tuneKey, writeBuild } from '../universe/shipyard/build';
import { SHIP_INFO, buildGalaxyShip } from './fleet';
import { ARRIVAL, HUNTER_GLB, createModels } from './models';
import { createSky } from './sky';
import { createSpeedLines } from './speedLines';
import { T as JUMP_T } from '../hyperspace3d/timeline';
import { DIVE, LAUNCH_KEY, diveAt, planDive } from './travel';
import { INTERDICTION, createInterdiction, cutAt, dropPoint, holdLifts, inWell, interdictorPlace } from './interdiction';
import { createInterdictor } from './interdictor';
import { createWarFront } from './warfront';
import { createGalaxyPowers } from './powers';
import { createCluster } from './cluster';
import { PICKUPS, createPickups, gunsUnder } from './pickups';
import { createPickupFx } from './pickupFx';
import { createRadar } from './radar';
import { drawRadar } from './radarDraw';
import { chargeFor } from '../universe/shipPowers';
import { effectsFor } from './warEffects';
import { warNow } from './warState';
import { createWingmen } from '../universe/wingmen';
import { createBolts, createFlashes } from './fx';
import { buildSystem } from './world';
import { AHEAD, FACTIONS, KINDS, NAMES } from './hunted';
import { createPayLedger, hunterEarn } from '../universe/earnRules';
import { createRoam } from './roam';
import { pick as pickFaction } from '../universe/sides';
import { createSkyStreaks } from './skyStreaks';
import { laneLinks } from './skyTraffic';
import { FAR, PULSE, aligned, atGoal, makeSpace, parkBy, steerToward } from './space';
import { createFinds } from './places';
import { asking } from './asking';
import { jumpTime, routeBetween } from './routes';
import { arrival, courseTo, jumpSeconds, kindsIn, lightYears, starAhead, systemById, wantsDeathStar } from './systems';
import { starfighterAt } from './surface/missions/starfighterMaps';
import { levelOf } from './surface/missions/starfighter';
import { playerKit, tuneFor } from './surface/missions/starfighterKits';
import { listFor, loadNames } from './surface/missions/starfighterPilots';
import { drawSpaceLevel } from './spaceLevel';
import { createAreaLook } from './areaLook';
import { assetUrl } from '../../lib/assetBase';

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
const FOUND_KEY = 'tp-galaxy-found'; // the places found out in the open, per system (places.js)
const EYE = { ahead: 0.035, up: 0.045 };
const CAB_HFOV = 88;
const CAB_VFOV = [52, 94];
const SAFE = 3; // seconds back from a crash when other pilots' shots don't count
const SAFE_BATTLE = 4; // and back behind your line in a battle, when the battle's don't either (till you fire)
const NO_SHIPS = []; // (no big ship moving through: solidsWith's base)
const RAM_CLEARED = 2; // seconds after a ram's kill a pack cleared is the ram's (said as one)
const CRASH = { impact: 0.32, back: 2.6, done: 3.2 };
// seconds, at most, to come round; to spool up (to the site's jump's flash,
// components/Hyperspace.jsx, which the page plays over the scene: the
// system changes behind it); to drop out
const JUMP = { align: 4.5, spool: (JUMP_T.jump + 50) / 1000, exit: 1.1 };
const IDLE = 40000;
const KEYS = { w: 'up', s: 'down', a: 'a', d: 'd', arrowleft: 'left', arrowright: 'right', arrowup: 'pitchUp', arrowdown: 'pitchDown', ' ': 'boost', shift: 'boost', f: 'fire' };
const DRAG = 6;
const NO_TARGETS = Object.freeze([]); // (when there are no hunters to lock on to, the same empty list every time)
const NO_BUFFS = NO_TARGETS; // (and no pickups' effects to show)

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
  // the feel: the shake (trauma², held still under reduced motion) and the
  // hitstop on a kill and a crash (mapFeel.js)
  const feel = createFeel({ calm: reduced, offset: MAP_FEEL.offset });
  feel.set({ decay: MAP_FEEL.decay });
  let disposed = false;
  // the runtime's renderer: shared with whatever world comes next, so what's
  // changed on it here goes back as it was at dispose
  const gfx = rt.gfx;
  const { renderer } = gfx;
  const autoReset = renderer.info.autoReset;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, FAR);
  scene.add(camera);
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cursor = 'crosshair';

  const tier = device().tier;
  const small = tier !== 'high' || Math.min(window.innerWidth, window.innerHeight) < 600;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const post = createPost(renderer, scene, camera, { small, bloom: LOOK.bloom });
  // (the house look, below, on whatever's warmed: patched before it's compiled)
  let house = null;
  const warm = (root, cam = camera, target = scene) => {
    house?.adopt(root);
    return precompile(renderer, singlePass(root), cam, target, post.on ? post.composer.readBuffer : undefined);
  };

  // light: each sun from its way, and a little ambient
  const keys = [new THREE.DirectionalLight('#ffffff', 2.2), new THREE.DirectionalLight('#ffffff', 0)];
  for (const k of keys) scene.add(k, k.target);
  const ambient = new THREE.AmbientLight('#9fb0d8', 0.32);
  // (inside a level's area of its own, the scene under its light: areaLook.js)
  let areaLook = null;
  scene.add(ambient);
  // the house look (lib/three/house), as on the universe map: the ships'
  // and stations' shade one colour, from the space light; the post pass
  // already tone-maps the house's way, and space has no fog
  house = houseOn({ renderer, scene, sun: keys[0], ambient, toneMap: false, look: { fog: false } });
  let houseFrames = 0;

  const sky = createSky({ small, level: device().detail, renderer });
  scene.add(sky.group);
  // ships jumping in and out along the lanes, streaks in the sky (skyStreaks.js): none on a low tier, nor with reduced motion
  const skyStreaks = tier === 'low' || reduced ? null : createSkyStreaks({ renderer });
  if (skyStreaks) scene.add(skyStreaks.group);
  const speedLines = createSpeedLines({ small });
  camera.add(speedLines.group);
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
  const roam = createRoam(); // what happens while you roam: the director on the system's side
  const wingmen = hunters ? createWingmen(scene, { fleet, solids: () => state.space?.solids ?? [] }) : null; // (your side's escort: roamRules.js)
  // who holds the system in the galaxy's war, against the side you swore to
  // (warEffects.js): worked out on entering it and once a second after, and
  // handed to the world (its fleets in orbit) and the director (who comes)
  let effectsAt = -1;
  const effectsNow = (force = false) => {
    const second = Math.floor(Date.now() / 1000);
    if (!force && second === effectsAt) return state.effects;
    effectsAt = second;
    const a = props.allegiance ?? null;
    const next = state.sys ? effectsFor(state.sys.id, warNow(Date.now(), a?.war), a) : null;
    if (force || JSON.stringify(next) !== JSON.stringify(state.effects)) {
      state.effects = next;
      state.world?.setEffects?.(next);
    }
    return state.effects;
  };
  const pieces = reduced ? null : createSetPieces(scene, { small, fleet, solids: () => state.space?.solids ?? [] }); // (clear of this system's planet, not the universe map's)
  // the Empire's count of your jumps, and the Interdictor waiting on the one that's due
  // the places found out in the open (places.js), kept across visits
  const finds = createFinds({ store: { get: () => window.localStorage.getItem(FOUND_KEY), set: (v) => window.localStorage.setItem(FOUND_KEY, v) } });
  const interdiction = createInterdiction({
    store: { get: () => window.sessionStorage.getItem(JUMPS_KEY), set: (v) => (v === null ? window.sessionStorage.removeItem(JUMPS_KEY) : window.sessionStorage.setItem(JUMPS_KEY, v)) },
  });
  const interdictor = reduced ? null : createInterdictor(scene, { models, small });
  // the war's battle in this system, if it's being fought over (and the clipping
  // planes a broken flagship's halves are cut with)
  renderer.localClippingEnabled = true;
  const war = reduced ? null : createWarFront(scene, { models, small, reduced, tier, emit: (e) => emit(e), onSolids: () => respace(), allegiance: () => props.allegiance });

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
    // the hunters you've helped another pilot with (owner:hunter), paid
    // once each: down is only our guess, and a ghost of one can come back
    // and go down again
    helped: createPayLedger(),
    effects: null, // who holds it in the war, against your side (warEffects.js), or null
    world: null, // and what's built of it (world.js's)
    space: null, // space.js's, for flying in it
    kind: null,
    ship: null,
    model: null,
    seat: remembered.get(SEAT_KEY) === 'cockpit' ? 'cockpit' : 'chase',
    view: 'chase',
    cabK: 0,
    fovBase: FOV,
    auto: null, // { id, park } while it flies itself to something in the system; to another pilot here (flyTo), also { pilot (their id), name, space, reaimAt } (universe/pilotGoal.js)
    at: null, // the goal it's at
    keys: {},
    stick: null,
    drag: null,
    boostBtn: false,
    climbBtn: 0,
    fireBtn: false,
    boosting: false,
    boosts: 0,
    odSaid: false, // the crew's said their piece about super speed
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
    respawnSafe: false, // (back behind your line in a battle: safe till you fire, or SAFE_BATTLE's up)
    hurt: 0,
    lowSaid: false,
    heat: 0,
    kills: 0, // this flight's, for the cluster
    navGoal: null, // where the way to go is, for the radar (placeHud's)
    killMark: 0, // the reticle's kill flash, 1 → 0
    jump: null, // { to, from, phase, age, dir, dur }
    aim: null, // { id, angle }: the star the nose is on, if it's on one
    courseSaid: false,
    loadout: readLoadout(ctx.loadout ?? STOCK_LOADOUT), // what's fitted in the hangar
    build: null, // the garage build flown in place of the stock hull (universe/shipyard), or null
    tune: {}, // the crew's own ship tuned with modules ({ slot: module id }); applies while the hull is the stock one
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
    shieldSaid: -1e9, // (the clock when the crew last had their say on Scarif's shield)
    held: null, // { at, hangar, since, pack, to, faction } while an Interdictor's gravity well holds you (interdiction.js)
    heldSaid: -1e9,
    flare: 1,
    eclipse: 1,
  };
  let engine = null;
  let net = null;
  let netOff = null;
  const pilots = createPilots(scene, { colors: BOLT_COLOR, here: () => (state.sys ? `/galaxy/${state.sys.id}` : '/galaxy'), fleet: reduced ? null : fleet, kinds: KINDS });
  // every other small ship, to fly into (shipHits.js; the battle's hulls are solids already)
  const shipHits = createShipHits({ sources: [() => hunters?.bodies, () => wingmen?.bodies, () => pilots.bodies, () => war?.bodies] });
  let rammedDownAt = -Infinity; // (a ram's last kill: the pack cleared by it gets the crew's ram line)
  const pilotRammedAt = new Map(); // (another pilot's id → when you last rammed them: shot down by it, said as a ram)
  let solidsNow = []; // (the frame's, handed to step: the system's and the big ships moving through it, shipHits.js's solidsWith)

  const emit = (e) => props.onEvent?.(e);
  // a kill worth paying for (economy.js's EARN): the page earns it into the
  // wallet. (The war's fighters pay as the war's points: warfront.js.)
  const pay = (what, n = 1) => {
    if (what) emit({ type: 'earn', what, n, side: 'galaxy' });
  };
  const controls = () => props.controls ?? CONTROL_DEFAULTS;
  const flying = () => Boolean(state.ship);
  // the crew's ship powers (powers.js), played out with the scene's own pieces
  // (made before the first frame's shaders are, so its look is made with them)
  const powers = createGalaxyPowers({ parent: scene, reduced, hunters, war, bolts, flashes, crashFx, pops, post, state, emit, controls, strike: (...a) => strike(...a), scored: (...a) => scored(...a), teleport: (pose) => teleport(pose) });
  const cluster = createCluster(); // (the flight cluster's writer: placeShield)
  // what a kill leaves behind (pickups.js: the rules, pickupFx.js: the drawing); none online, and none survive a jump, a landing or a crash
  const pickups = createPickups();
  // the chips over the cluster: the pickups' effects, and, back behind your
  // line in a battle, how long you're shielded (the list kept and reused)
  const safeChip = { kind: 'safe', name: 'Shielded', left: 0, of: SAFE_BATTLE, points: null };
  const chipList = [];
  const buffsNow = () => {
    const list = pickups.buffs();
    if (!state.respawnSafe || state.clock >= state.safeUntil) return list;
    chipList.length = 0;
    for (const b of list) chipList.push(b);
    safeChip.left = state.safeUntil - state.clock;
    chipList.push(safeChip);
    return chipList;
  };
  const pickupFx = createPickupFx(scene, { prepare: (o) => warm(o), reduced });
  const gun = { gap: 0, punch: 1 }; // (the guns' delay and punch with rapid fire on, as gunsUnder writes them)

  // ── The system you're in ──
  const followDrawn = followRatio(post, (r) => (sky.setRatio(r), state.world?.setRatio(r))); // (the ratio the points are sized by: ./drawnAt.js)
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
    const world = buildSystem(sys, { models, bolts, flashes, small, ratio: post.ratio });
    world.setDetail(detail);
    scene.add(world.group);
    state.world = world;
    skyStreaks?.setSystem(laneLinks(sys.id), Math.max(world.solids.find((o) => o.id === 'planet').r, 20));
    war?.enter(sys, world);
    effectsNow(true);
    wingmen?.clear();
    respace();
    // the suns' light
    world.sunLights.forEach((s, i) => {
      keys[i].color.copy(s.color);
      keys[i].position.copy(s.dir).multiplyScalar(100);
    });
    keys[1].intensity = world.sunLights[1] ? 1.1 : 0;
    if (!env) reflect(sys);
    hunters?.clear();
    pickups.clear();
    state.auto = null;
    state.at = null;
    state.lock = null;
    state.pull = 0;
    state.pullSaid = false;
    state.held = null;
    interdictor?.hide();
    models.want([...ARRIVAL, ...(wantsDeathStar(sys) ? ['deathstar'] : [])]);
    return warm(world.group);
  };
  // what the ship flies through: the system's solids, and the war's capital ships' hulls while its battle's on
  function respace() {
    if (!state.world) return;
    const extra = war?.solids ?? [];
    state.space = makeSpace(extra.length ? [...state.world.solids, ...extra] : state.world.solids);
  }
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
    boltMat.color.fromArray(glowAt(boltMat.color.set(coat().bolt ?? BOLT_COLOR[state.kind] ?? '#ff4a3d').toArray(), GLOW.laser)); // as bright as the battle's lasers
  };
  const refit = () => {
    state.stats = statsOf(state.kind, state.loadout, state.build, state.tune);
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

  // The tune on the crew's own ship (shipyard/build.js's): only its numbers
  // change, so the ship is not built again.
  const setTune = (raw) => {
    const next = readTune(raw);
    if (tuneKey(next) === tuneKey(state.tune)) return;
    state.tune = next;
    state.stats = statsOf(state.kind, state.loadout, state.build, state.tune);
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
    powers.setCrew(kind);
    if (!same) {
      state.kills = 0; // (a new ship, a new flight)
      pickups.clear();
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
    // (inside a level's area of its own, the system's places are shut out: no names)
    const inTunnel = Boolean(state.jump && state.jump.phase === 'tunnel') || state.enclosed;
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
    const on = flying() && !state.crash && !props.frozen && !(state.jump && state.jump.phase !== 'align') && !state.enclosed;
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
    dropAuto();
    if (state.jump?.phase === 'align') cancelJump('pilot');
  };
  // (in a Starfighter Assault you fly your side's kit on its game handling, held to what the galaxy's tune allows: missions/starfighterKits.js)
  const flightStats = () => (state.flightTune && war?.on?.starfighter ? { ...state.stats, ...state.flightTune } : state.stats);
  const steering = () => {
    const c = controls();
    let { throttle, turn, climb, roll } = keyAxes(state.keys, c);
    climb += state.climbBtn;
    const st = state.stick;
    if (st?.on) {
      // (a tenth of the throw is no drag: a thumb at rest on the glass doesn't drift the nose)
      const [ddx, ddy] = deadZone(st.dx, st.dy, STICK / (c.drag || 1));
      const d = stickInput(ddx, ddy, c, st.pointer);
      throttle += d.throttle;
      turn += d.turn;
      climb += d.climb;
      roll += d.roll;
    }
    const m = powers.mods; // (a power's hand on the stick: the death ray's heavy, the corkscrew's quick)
    return { throttle: clamp(throttle, -1, 1), turn: clamp(turn, -1, 1) * m.turn, climb: clamp(climb, -1, 1) * m.turn, roll: clamp(roll, -1, 1) * m.turn, boost: Boolean(state.keys.boost || state.boostBtn), turnRate: c.turn * m.agility, pitchRate: c.pitch * m.agility, rollRate: c.roll * m.agility, level: c.level, tune: flightStats() };
  };

  // ── The guns ──
  const fire = () => {
    const s = state.ship;
    const now = performance.now();
    const g = state.stats; // (the guns fitted in the hangar: how fast, how hard; a rapid-fire pickup quicker still, and harder where the quickest they may fire holds it back)
    gunsUnder((CADENCE[state.kind] ?? 0.18) * g.cadence, pickups.mods().delay, FASTEST, gun);
    if (!s || props.frozen || state.crash || state.jump || now - state.lastShot < gun.gap * 1000) return;
    state.lastShot = now;
    state.lastInput = now;
    if (state.respawnSafe) {
      state.respawnSafe = false;
      state.safeUntil = Math.min(state.safeUntil, state.clock);
    }
    const b = myBolts.find((m) => !m.visible) ?? myBolts[0];
    const [fx, fz] = forward(s.heading);
    let dir = nose(s);
    if (state.lead && state.lead.t <= AIM.life) dir = assist(dir, dirTo(s, state.lead), powers.aim(controls()).assist); // (Force Focus's help onto the game's ships only)
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
    b.userData = { life: AIM.life, v: [dir[0] * v, dir[1] * v, dir[2] * v], punch: g.punch * gun.punch };
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
      if (strike(shotFrom, b.position, d.punch ?? 1, { vel: d.v })) b.visible = false;
    }
    return any;
  };
  // a pickup where a kill went up (pickups.js says whether), not once the jump's committed or the ship's lost
  const dropFor = (hit) => {
    if (state.crash || state.dive || state.jump) return;
    pickups.drop(hit.at, { ace: FACTIONS[hit.faction]?.ace === hit.kind, capital: Boolean(hit.capital), shield: state.shield });
  };
  // What a hit did (hunters.hit's or damage's, or the war's: `src` says
  // which), played: where it landed, the hit mark, a kill said, counted and
  // paid for; and the big one charged by what the guns did (a power's own
  // hits, `by` it, charge nothing). A hunter downed by a power pays as one
  // the guns downed: it's as much your kill, and the power was earned by the
  // guns' kills in the first place. (The war's fighters pay as the war's
  // points: warfront.js.)
  // (`ram`: a ram's, said as one)
  const scored = (hit, { src, normal = popDir.set(0, 1, 0), by = null, ram = false }) => {
    const ship = src !== 'war' || (!hit.sub && !hit.capital && !hit.shield);
    landed(src === 'war' ? { at: new THREE.Vector3(hit.at.x, hit.at.y, hit.at.z), size: ship ? hit.size : 0.15, down: ship && hit.down } : hit, normal);
    state.hitMark = 1;
    if (!by) powers.gain(chargeFor(hit, { war: src === 'war', ace: FACTIONS[hit.faction]?.ace === hit.kind }), `${src}:${hit.id}`); // (nothing for a shield or a hull)
    if (ship && hit.down) {
      emit({ type: 'kill', kind: hit.kind, ...(by ? { by } : null), ...(ram ? { ram } : null) });
      if (src === 'hunters') pay(hunterEarn(FACTIONS, hit));
      state.heat += 1;
      state.kills += 1;
      state.killMark = 1;
      if (!reduced) state.shake = Math.max(state.shake, 0.2);
      if (!by) feel.hitstop(HITSTOP.kill);
      dropFor(hit);
    } else if (src === 'war' && hit.capital && hit.down) dropFor(hit); // (a capital ship's hull never goes down to the guns as it is: if it ever does, it always drops one)
    return hit;
  };
  // A shot (a bolt, a torpedo, the death ray) from `from` to `to` this frame,
  // worth `punch` (`warPunch` on the war's battle): the first thing it hit,
  // and what that did; null for nothing. The hunters, then the war's battle
  // (its fighters, its objectives, its capital ships' hulls), then another
  // pilot or one of the hunters after them (it's theirs, so they're told):
  // a bolt's only (`pilots`), never a power's
  const strike = (from, to, punch, { vel = null, pilots: atPilots = true, warPunch = punch, by = null } = {}) => {
    const normal = vel ? popDir.set(-vel[0], 3, -vel[2]).normalize() : popDir.set(0, 1, 0);
    const hh = hunters?.hit(from, to, punch);
    if (hh) return scored(hh, { src: 'hunters', normal, by });
    const wh = war?.hit(from, to, warPunch);
    if (wh) return scored(wh, { src: 'war', normal, by });
    if (!atPilots) return null;
    const ph = pilots.hit(from, to, punch);
    return ph ? pilotShot(ph, punch, normal) : null;
  };
  // a hit on another pilot or one of the hunters after them (a shot's, or a
  // ram's: shipsHit), played: they're told
  const pilotShot = (ph, punch, normal, ram = false) => {
    landed(ph, normal);
    state.hitMark = 1;
    if (ph.hunter) {
      net?.hunterHit(ph.id, ph.hunter, punch);
      powers.gain(ph.down ? 'kill' : 'hit', `pilots:${ph.id}:${ph.hunter}`);
      if (ph.down) {
        state.kills += 1;
        state.killMark = 1;
        emit({ type: 'kill', kind: ph.kind, ...(ram ? { ram } : null) });
        if (state.helped.once(`${ph.id}:${ph.hunter}`)) pay('hunterHelped'); // (one shot off someone else's tail)
        if (!reduced) state.shake = Math.max(state.shake, 0.2);
        feel.hitstop(HITSTOP.kill); // (never a power's: those don't reach the pilots)
      }
    } else net?.hit(ph.id);
    return ph;
  };
  // the ship put somewhere at once (out of a portal): the camera with it, not easing after it
  const teleport = (pose) => {
    state.ship = { ...state.ship, ...pose, rate: 0, tipRate: 0, rollRate: 0 };
    camQOn = false;
    blendTo.k = 1;
    state.bias.fill(0);
  };
  // G or X: the crew's power, or the big one (powers.js), while you're flying
  // (not once a jump's begun, even while the nose swings round to it: the
  // fight's off then, and a portal would hop the ship out of its line)
  const power = (slot) => {
    heard();
    if (!flying() || props.frozen || state.crash || state.dive || state.jump) return false;
    const r = powers.press(slot);
    if (r.ok) takeover();
    ctx.invalidate();
    return r.ok;
  };

  // ── Shields, crashes, being shot down ──
  const startCrash = (e) => {
    powers.cancel();
    pickups.clear();
    const s = state.ship;
    const solid = solidsNow.find((o) => o.id === e.id) ?? state.space.solids.find((o) => o.id === e.id);
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
      kind: solid?.ship ? 'ship' : undefined, // (into a big ship: the crew's crash line)
      speed: e.speed,
    };
    state.auto = null;
    engine?.set({ speed: 0, boost: false, on: false });
    retarget(650);
  };
  const startDestroyed = (by = null, rammed = false) => {
    powers.cancel();
    pickups.clear();
    const s = state.ship;
    const from = new THREE.Vector3(s.x, s.y, s.z);
    state.crash = { age: 0, id: 'shot', shot: true, from, normal: new THREE.Vector3(0, 1, 0), radius: 0.35, point: from.clone(), fwd: forward(s.heading), spin: [6 + Math.random() * 6, 4 + Math.random() * 5], impact: false, back: false };
    state.auto = null;
    hunters?.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    if (by) net?.down(by, rammed);
    emit({ type: 'destroyed' });
    retarget(650);
  };
  const hurt = (damage, by = null, rammed = false) => {
    if (state.crash || !state.ship || state.jump?.phase === 'tunnel') return;
    if (by && state.clock < state.safeUntil) return;
    // (a ghost, jinking or mid-portal, isn't there for the game's own ships to
    // hit; another pilot's hits still count: the powers are for the game's fights)
    if (!by && powers.mods.ghost) return;
    // a bubble shield takes the hit first (pickups.js); what it can't is the deflectors'
    damage = pickups.absorb(damage);
    if (damage <= 0) {
      if (!document.hidden) shieldSound();
      return;
    }
    state.shield = Math.max(0, state.shield - damage * state.stats.armor); // (less, with plating fitted)
    state.hitAt = state.clock;
    state.hurt = 1;
    if (!reduced) state.shake = Math.max(state.shake, 0.3);
    emit({ type: 'laser' });
    if (state.shield < 35 && !state.lowSaid) {
      state.lowSaid = true;
      emit({ type: 'shields' });
    }
    if (state.shield <= 0) startDestroyed(by, rammed);
  };
  // The ship's way this frame swept against every other small ship
  // (shipHits.js; the big ones are solids, in the step): a glance pushes it
  // off with a soft bump, a ram takes the shields (not just back from a
  // crash) and the other ship takes the hit as from a shot (scored, pilotShot).
  // The other ship's knocked off its line where its system can be
  // (body.push: the hunters, the wingmen); another pilot's told (client.js's
  // ram), and takes it off their own shields (onNet's 'rammed')
  const shipsHit = (from, to, dt) => {
    const h = shipHits.sweep(from, to, dt, state.clock);
    if (!h) return;
    const { body, outcome } = h;
    state.ship = { ...state.ship, x: h.touch.x, y: h.touch.y, z: h.touch.z, speed: keptSpeed(state.ship.speed, outcome.keep, SHIP.boost) };
    body.push?.(h.push);
    const bump = { type: 'bump', id: body.kind, hard: outcome.kind !== 'glance', into: h.into };
    if (outcome.kind === 'glance') {
      if (!reduced) state.shake = Math.max(state.shake, 0.25);
      emit({ ...bump, force: knockForce(bump, SHIP.crash) });
      return;
    }
    pops.hit({ point: new THREE.Vector3(h.at.x, h.at.y, h.at.z), normal: popDir.set(h.normal.x, h.normal.y, h.normal.z), radius: 0.3 });
    if (state.clock >= state.safeUntil) hurt(outcome.damage);
    if (!state.ship || state.crash) return; // (that was the last of the shields)
    if (!reduced) {
      state.shake = Math.max(state.shake, 0.9);
      state.kick = Math.max(state.kick, 0.6);
    }
    state.flare = Math.max(state.flare, 1.6);
    emit({ ...bump, force: knockForce(bump, SHIP.crash) });
    if (body.key.startsWith('p:')) {
      net?.ram(body.id, h.into);
      pilotRammedAt.set(body.id, state.clock);
      return;
    }
    const r = body.hit(outcome.punch, from, to);
    if (!r) return;
    const normal = popDir.set(h.normal.x, h.normal.y, h.normal.z);
    if (r.down) rammedDownAt = state.clock;
    if (body.key.startsWith('g:')) pilotShot(r, outcome.punch, normal, true);
    else scored(r, { src: body.key.startsWith('f:') ? 'war' : 'hunters', normal, ram: true });
  };
  // another pilot flew into you (client.js believed it: ramCounts): the
  // law's ram as you'd take one flying into them, their ship the size
  // pilots.js draws it, your speed knocked back
  const rammedBy = (e) => {
    if (!state.ship || state.crash || state.jump?.phase === 'tunnel') return;
    const o = contact(e.into, PILOT_SIZE);
    if (o.kind !== 'ram') return;
    state.ship = { ...state.ship, speed: keptSpeed(state.ship.speed, o.keep, SHIP.boost) };
    if (e.at) pops.hit({ point: new THREE.Vector3((e.at.x + state.ship.x) / 2, (e.at.y + state.ship.y) / 2, (e.at.z + state.ship.z) / 2), normal: popDir.set(state.ship.x - e.at.x, state.ship.y - e.at.y, state.ship.z - e.at.z).normalize(), radius: 0.3 });
    hurt(o.damage, e.from, true);
    if (!state.ship || state.crash) return;
    if (!reduced) {
      state.shake = Math.max(state.shake, 0.9);
      state.kick = Math.max(state.kick, 0.6);
    }
    state.flare = Math.max(state.flare, 1.6);
    const bump = { type: 'bump', id: 'pilot', hard: true, into: e.into };
    emit({ ...bump, force: knockForce(bump, SHIP.crash) });
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
      feel.hitstop(HITSTOP.crash);
      if (!c.shot) emit({ type: 'crash', id: c.id, kind: c.kind, force: knockForce({ type: 'crash', speed: c.speed }, SHIP.crash) });
      if (c.board) {
        c.through = true;
        props.onBoard?.(c.board);
      } else if (c.planet && props.onCrash?.(state.sys?.id ?? null)) {
        // into the planet: on down to its surface (the page says whether
        // there is one to go to; if not, back out of hyperspace as before)
        c.through = true;
      }
    }
    if (c.through) return true;
    if (c.age >= CRASH.back && !c.back) {
      // back again: out of hyperspace off the planet, shields up
      c.back = true;
      // (in a battle you were in: behind your side's line, warfront.js's respawn)
      const home = war?.respawn() ?? null;
      c.home = Boolean(home);
      const a = home ?? arrival(state.sys, null);
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
      state.safeUntil = state.clock + (c.home ? SAFE_BATTLE : SAFE);
      state.respawnSafe = c.home; // (a shot of your own ends it: fire())
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
    powers.cancel();
    // the jump's time by its route along the lanes (routes.js), slower off them
    const route = routeBetween(state.sys.id, to.id);
    const dur = route ? jumpTime(route) : jumpSeconds(state.sys, to);
    state.jump = { to, from: state.sys, phase: state.ship ? 'align' : 'spool', age: 0, dir, dur, route, built: false, dressed: false, why };
    if (state.view === 'map') state.view = state.seat;
    // its ships' models loading and its built ones made, in the seconds before the tunnel
    const kinds = kindsIn(to);
    models.want(kinds);
    models.prebuild(kinds);
    longest = 0;
    emit({ type: 'jump', phase: 'align', to: to.id, ly: lightYears(state.sys, to), seconds: dur, onLane: Boolean(route?.onLane) });
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
        pickups.clear(); // (none go into the next system; before this, a jump the pilot takes back keeps what it had)
        // (the page plays the site's jump over the scene from here, its
        // sound with it, the same as the universe map's: Galaxy.jsx)
        emit({ type: 'jump', phase: 'spool', to: j.to.id });
      }
      return;
    }
    if (j.phase === 'spool') {
      if (!j.counted) {
        // a jump that's spooling up is one the Empire counts: the one that's due is cut short
        // (and off the lanes it's due sooner)
        j.counted = true;
        const verdict = interdiction.jumped(Boolean(j.route && !j.route.onLane));
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
        // (no faster than the drive allows where it comes out: near a planet
        // that's under 46, and the ship was braked to a near stop in a
        // fraction of a second while the streaks still played)
        state.ship = { ...spawn(null, a), speed: Math.min(46, state.space.boostAt(a.x, a.y, a.z)) };
        camQOn = false;
        state.world.group.visible = true;
        j.phase = 'exit';
        j.age = 0;
        import('../../lib/clips').then((c) => c.playClip('hyperspaceExit', { keep: true }));
        props.onArrive?.(j.to.id, j.from.id);
        // (the page lets the site's jump go on out of its tunnel)
        emit({ type: 'jump', phase: 'out', to: j.to.id });
        emit({ type: 'arrive', id: j.to.id, from: j.from.id });
        if (bitten) bite(j);
      } else if (j.age > j.dur + 6 && !j.ready) j.ready = true; // (never stuck in there)
      return;
    }
    if (j.phase === 'exit') {
      const k = clamp01(j.age / JUMP.exit);
      // easing down out of it
      state.ship = step({ ...s, speed: Math.max(SHIP.cruise, s.speed - dt * 36) }, { throttle: 0.6 }, dt, state.space.solids, state.space).ship;
      if (k >= 1) {
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
    chasePilot();
    // the big ships moving through (the capital, the Interdictor): solids for the step, and for the autopilot to steer round
    const moving = solidsWith(NO_SHIPS, pieces?.solids, interdictor?.solids);
    if (state.auto) {
      // (on super speed where it's wide open: space.js)
      const sp = state.auto.space ?? state.space;
      const a = autopilot(state.ship, state.auto.id, state.auto.park, sp, sp.overdriveAt ? sp.overdriveAt(state.ship.x, state.ship.y, state.ship.z) : 1, null, moving);
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
        const n = trackNudge(state.ship, state.lead, powers.aim(controls()).track, input);
        input.turn = clamp(input.turn + n.turn, -1, 1);
        input.climb = clamp(input.climb + n.climb, -1, 1);
      }
    }
    input.surge = pickups.mods().boost; // (Overcharge: the boost and the pull-up both, ×1.35, on top of what's fitted, whoever's flying)
    if (state.keys.fire || state.fireBtn) fire();
    // super speed: boosting well out from everything, the drive opens into the overdrive (space.js wideAlong)
    if (input.boost && input.throttle > 0 && !state.auto) {
      const f = forward(state.ship.heading);
      input.overdrive = state.space.overdriveAt(state.ship.x, state.ship.y, state.ship.z, [f[0], 0, f[1]]);
    }
    // (under the Interdictor's hold, or a battle's gravity wells still up, the sublight drive stays shut: the boost is the boost)
    const before = state.ship;
    solidsNow = solidsWith(state.space.solids, moving);
    const { ship: stepped, events } = step(state.ship, state.held || war?.interdicted ? { ...input, interdicted: true } : input, dt, solidsNow, state.space);
    let ship = powers.afterStep(stepped, dt); // (Han's corkscrew: its sidestep)
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
        // thrown back off it: the shell lit where it was hit (a flash and a
        // ring out across it: bodies.js), the ship shaken and kicked back
        // the way it came, and the crew on it (once, then again a while on)
        const k = (r0 > sh.r ? sh.r + 0.8 : sh.r - 0.8) / r;
        ship = { ...ship, x: ship.x * k, y: ship.y * k, z: ship.z * k, speed: -ship.speed * 0.45 };
        state.world.body?.hit?.(tractorPull.set(ship.x, ship.y, ship.z).multiplyScalar(sh.r / Math.hypot(ship.x, ship.y, ship.z)));
        if (!reduced) {
          state.shake = Math.max(state.shake, 0.7);
          state.kick = Math.max(state.kick, 0.6);
          state.flare = Math.max(state.flare, 1.4);
        }
        emit({ type: 'bump', id: 'shield', hard: true });
        if (state.clock - state.shieldSaid > 45) {
          state.shieldSaid = state.clock;
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
      if (e.type === 'bump') emit({ ...e, force: knockForce(e, SHIP.crash) });
      else if (e.type !== 'crash') emit(e);
      else if (!state.crash) startCrash(e);
    }
    if (state.crash) return true;
    // into another ship (shipHits.js): a glance, or a ram; a ghost (a power's) goes through
    if (!state.dive && !powers.mods.ghost) shipsHit(before, state.ship, dt);
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
      // a place found, the first time (places.js): the crew say so, and it pays
      const g = now && state.space.goals[now];
      if (g?.place && state.sys) {
        const first = finds.mark(state.sys.id, g.id);
        emit({ type: 'find', id: g.id, name: g.name, kind: g.kind, first, ...finds.count(state.sys.id) });
        if (first) {
          emit({ type: 'event', id: 'find' });
          emit({ type: 'earn', what: 'found', n: 1, side: 'galaxy' });
        }
      }
    }
    // the crew's word on super speed, the first time it's well past the sublight drive's
    if (!state.odSaid && ship.speed > PULSE * 1.25) {
      state.odSaid = true;
      emit({ type: 'event', id: 'overdrive' });
    }

    // the guns: the lock, the lead, whether a shot would bend onto it
    let cands = hunters?.targets ?? NO_TARGETS;
    const warCands = war?.targets ?? NO_TARGETS;
    if (pilots.count || warCands.length) {
      candBuf.length = 0;
      for (const c of cands) candBuf.push(c);
      for (const c of warCands) candBuf.push(c);
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
    state.trackable = Boolean(tgt && (hunters?.targets.includes(tgt) || warCands.includes(tgt) || state.lock?.manual || performance.now() - state.lastShot < TRACK_AFTER_SHOT));
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
    m.pivot.rotation.set(reduced ? 0 : clamp(-(input.throttle || 0) * 0.06, -0.08, 0.08), 0, -(ship.lean || 0) - powers.roll);
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
      // (ace: the kind of the faction's ace, when it came along, for its own line)
      const ace = FACTIONS[e.faction]?.ace;
      if (!e.prey) emit({ type: 'hunted', faction: e.faction, ace: ace && e.kinds.includes(ace) ? ace : null });
    } else if (e.type === 'laser') hurt(e.damage);
    else if (e.type === 'shot') emit(e);
    else if (e.type === 'escaped' || e.type === 'cleared') {
      // (the last of them rammed down: the crew's ram line for it)
      emit(e.type === 'cleared' && state.clock - rammedDownAt <= RAM_CLEARED ? { ...e, ram: true } : e);
      if (pieces?.destroyerHere && !hunters.active) pieces.leave();
    }
  };
  const later = [];
  // on the way somewhere (out in the open at speed), a pack comes in ahead of you
  const travelling = (s) => state.space.openness(s.x, s.y, s.z) > 0.5 && Math.abs(s.speed) > 30;
  // the director's events, played out (the universe map's `happen`, for
  // what the galaxy plays so far: roamRules.js's ROAM_EVENTS)
  const happen = (id, ship) => {
    const side = roam.side(state.sys, state.effects);
    if (!side || !hunters) return;
    const ambush = travelling(ship) ? { ahead: true } : {};
    const strength = { heat: state.heat, first: hunts === 0 };
    if (id === 'hunt') {
      const who = pickFaction(side, 'hunt');
      if (!who) return;
      hunts += 1;
      hunters.pack(who, ship, { ...ambush, ...strength });
    } else if (id === 'destroyer') {
      if (!pieces || !side.capitalShip) return;
      const d = pieces.destroyer(ship, side.capitalShip);
      if (!d) return;
      emit({ type: 'event', id: 'destroyer' });
      // its fighters launch a moment after it's here
      const who = pickFaction(side, 'capital') ?? pickFaction(side, 'hunt') ?? 'empire';
      later.push({ at: state.clock + 2.4, run: () => state.ship && !state.crash && !state.jump && hunters.pack(who, state.ship, { from: d.hangar, size: 3, ace: Math.random() < 0.35 }) });
    } else if (id === 'escort') {
      // your side's wing, come to fly with you a while
      if (!wingmen || wingmen.active || !side.escort?.length) return;
      wingmen.join(side.escort[Math.floor(Math.random() * side.escort.length)], ship, 2);
      emit({ type: 'hunted', faction: 'escort', ace: null });
    } else if (id === 'bounty') {
      // one hunter, tough and quick: Boba Fett in Slave I (its model, once
      // it's here: Vader stands in till then), IG-88, Bossk or Dengar
      const who = pickFaction(side, 'bounty');
      if (!who) return;
      if (who === 'fett' && !fleet.loaded('slave1')) {
        fleet.want(['slave1']);
        hunters.pack('empire', ship, { size: 1, ace: true, ...ambush });
      } else hunters.pack(who, ship, { size: 1, ace: false, ...ambush });
    }
  };
  // a pickup taken (pickups.js's step says what it gave): the deflectors back, the power cell's charge, the page told for its note
  const takeOne = (k) => {
    if (k.heal) state.shield = Math.min(100, state.shield + k.heal);
    if (k.charge) powers.pickup();
    emit({ type: 'pickup', kind: k.kind, name: PICKUPS[k.kind].name, line: PICKUPS[k.kind].line });
    if (!document.hidden) lockSound();
  };
  const adventure = (dt, t) => {
    state.clock += dt;
    const live = flying() && !state.crash && !state.jump && !props.frozen ? state.ship : null;
    // (Force Focus slows their clock; a ghost or a magnet rides on the ship they're handed)
    if (hunters) for (const e of hunters.update(dt * powers.mods.slow, t, powers.shipFor(live))) onHunters(e);
    // the escort's shots, put on the hunters after you
    if (wingmen && (wingmen.active || live)) {
      const r = wingmen.update(dt, t, live, live ? hunters.targets.filter((o) => !o.prey) : [], {});
      for (const h of r.hits) {
        const got = hunters.damage(h.id, h.damage);
        if (got?.down) pops.hit({ point: got.at, normal: new THREE.Vector3(0, 1, 0), radius: got.size * 1.8 });
      }
    }
    let busy = pieces ? pieces.update(dt, t, camera) : false;
    if (interdictor) busy = interdictor.update(dt, t) || busy;
    if (war) {
      // (back from a death and safe: the battle's fire flies through you, as a power's ghost's does)
      const opts = powers.warOpts;
      if (state.clock < state.safeUntil) opts.ghost = true;
      const w = war.update(dt, t, camera, live, { shield: state.shield, down: Boolean(state.crash), ...opts });
      if (w.hurt && live) hurt(w.hurt);
      powers.hold = Boolean(live && (w.ship || w.speedCap)); // (no portal out of a set piece's hold)
      // (a set piece's hold on the ship: kept inside a tunnel, slowed to fly it, caught in a reactor's blast)
      if (live && state.ship && !state.crash) {
        if (w.ship) state.ship = { ...state.ship, ...w.ship };
        if (w.speedCap && state.ship.speed > w.speedCap) state.ship = { ...state.ship, speed: w.speedCap + (state.ship.speed - w.speedCap) * Math.exp(-dt * 6) };
        if (w.kill) startDestroyed();
      }
      busy = w.busy || busy;
    }
    powers.frame(dt, live);
    // the pickups: aged and drawn always, taken only while the ship's flying free (not in a jump, a crash or a dive: those clear them)
    const taken = pickups.step(props.frozen ? 0 : dt, state.ship ?? ORIGIN, { live: Boolean(live) && !state.dive });
    for (const k of taken) takeOne(k);
    pickupFx.sync(pickups.list, state.clock);
    if (pickupFx.busy) busy = true;
    if (live) {
      if (state.clock - state.hitAt > state.stats.delay && state.shield < 100) state.shield = Math.min(100, state.shield + dt * 12 * state.stats.regen);
      if (state.shield > 70) state.lowSaid = false;
      state.heat = Math.max(0, state.heat - dt / 45);
      // now and then something happens: the director, run on the system's
      // side (roam.js: whoever holds the system comes for you, the Empire
      // brings a Star Destroyer to launch them, a bounty hunter finds you)
      // (not in the middle of the war's battle: it's busy enough)
      if (hunters && state.flown) {
        const busyHere = hunters.active || Boolean(pieces?.destroyerHere) || Boolean(state.held) || Boolean(war?.battle) || state.view === 'map';
        const fx = effectsNow();
        const id = roam.update(dt, { sys: state.sys, effects: fx, heat: state.heat + (fx?.heat ?? 0), busy: busyHere, travelling: travelling(live), calm: state.shield < 50 });
        if (id) happen(id, live);
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
    placeRadar();
    powers.place(props.powers?.current ?? null, flying() && !state.crash && !state.dive && !props.frozen && !state.jump);
    return busy || Boolean(hunters?.count);
  };

  // ── The HUD (the page's markup, the universe map's classes) ──
  // the flight cluster's numbers (cluster.js writes them where the page put its markup)
  const range = (d) => (d < 10 ? d.toFixed(1) : Math.round(d).toString());
  // (the one record and the one lock it carries, filled each frame: cluster.js compares what's in them)
  const clusterLock = { name: '', dist: 0, hp: null };
  const clusterNow = { on: false, shield: 100, low: false, speed: 0, top: 1, boosting: false, kills: 0, lock: null };
  const placeShield = () => {
    const root = props.cluster?.current;
    if (!root) return;
    const v = clusterNow;
    v.on = flying() && !state.crash && !(state.jump && state.jump.phase !== 'align') && !props.frozen;
    const s = state.ship;
    const t = v.on ? state.lockTarget : null;
    v.shield = state.shield;
    v.low = state.shield < 35;
    v.speed = s?.speed ?? 0;
    v.top = SHIP.boost * clamp(flightStats().boost ?? 1, TUNE.boost[0], TUNE.boost[1]) * pickups.mods().boost;
    v.boosting = Boolean(state.keys.boost || state.boostBtn) && v.speed > SHIP.cruise;
    v.kills = state.kills;
    if (t) {
      clusterLock.name = t.name ?? NAMES[t.kind] ?? SHIP_INFO[t.kind]?.name ?? t.kind;
      clusterLock.dist = apart(t.at.x, t.at.y, t.at.z, s.x, s.y, s.z);
      clusterLock.hp = (t.hpMax ?? 1) > 1 ? t.hp / t.hpMax : null;
    }
    v.lock = t ? clusterLock : null;
    cluster.place(root, v);
    cluster.buffs(props.buffs?.current ?? null, v.on ? buffsNow() : NO_BUFFS);
  };
  // the radar: its contacts gathered and drawn, at most 20 times a second (radar.js keeps its records: nothing's made per tick)
  const radar = createRadar();
  let radarAt = 0;
  let radarLock = null; // (the lock's id this tick)
  const addHostile = (c) => radar.add(c.id, c.threat ? 'threat' : 'hostile', c.at, c.id === radarLock);
  const addAlly = (c) => radar.add(c.id, 'ally', c.at);
  const placeRadar = () => {
    const cv = props.radar?.current;
    if (!cv || !flying() || state.crash || props.frozen || (state.jump && state.jump.phase !== 'align')) return;
    if (state.clock - radarAt < 0.05) return;
    radarAt = state.clock;
    radarLock = state.lockTarget?.id ?? null;
    radar.start(state.ship);
    for (const c of hunters?.targets ?? NO_TARGETS) addHostile(c);
    for (const c of war?.targets ?? NO_TARGETS) addHostile(c);
    if (pilots.count) {
      for (const c of pilots.targets) if (c.threat) addHostile(c);
      for (const c of pilots.mates) addAlly(c);
    }
    if (wingmen?.active) for (const w of wingmen.ships) if (w.alive) radar.add(w.id, 'ally', w.pos);
    const b = war?.battle;
    if (b && b.you?.team !== null && !b.over) for (const f of b.fighters) if (f.alive && f.team === b.you.team) radar.add(f.id, 'ally', f.seen ?? f.pos);
    for (const p of pickups.list) radar.add(p.id, 'pickup', p.at); // (a number: nothing's made for it each tick; it's never the lock)
    if (state.navGoal) radar.add('nav', 'goal', state.navGoal);
    const range = radar.range;
    drawRadar(cv, radar.points(range), { range, dpr: Math.min(2, window.devicePixelRatio || 1) });
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
      hud = { root, reticle: q('.universe-reticle'), lock: q('.universe-lock'), lockName: q('.universe-lock-name'), lockDist: q('.universe-lock-dist'), lead: q('.universe-lead'), nav: q('.universe-nav'), navName: q('.universe-nav-name'), navDist: q('.universe-nav-dist'), threats: [...(root?.querySelectorAll('.universe-threat') ?? [])], mates: [...(root?.querySelectorAll('.universe-mate') ?? [])], text: new Map(), on: new Map() };
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
  // The HUD's goal for the plotted course: its name, light-years and bearing, worked out when the course or the system changes (the key),
  // its `at` moved with the ship each frame. "· J" only where there's a key to press.
  const courseKeep = { key: '', goal: null };
  const finePointer = () => typeof matchMedia !== 'function' || matchMedia('(pointer: fine)').matches;
  const courseGoal = (id) => {
    const key = `${id}>${state.sys?.id}`;
    if (courseKeep.key !== key) {
      const to = systemById(id);
      courseKeep.key = key;
      courseKeep.goal = to && state.sys ? { at: [0, 0, 0], dir: courseTo(state.sys, to), name: `Course: ${to.name}${finePointer() ? ' · J' : ''}`, dist: `${lightYears(state.sys, to).toLocaleString('en-US')} ly`, reach: 0, way: true } : null;
    }
    return courseKeep.goal;
  };
  const threatList = [];
  const mateList = [];
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
      h.reticle.toggleAttribute('data-kill', state.killMark > 0);
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
      for (const c of war?.targets ?? NO_TARGETS) if (c.threat && c.id !== tgt?.id) threatList.push(c);
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
    // your allies off the screen: a green arrow at the edge each, with their
    // callsign (nearest first, as many as there are arrows), so you can find
    // your wing
    let m = 0;
    if (on && h.mates.length && pilots.count) {
      mateList.length = 0;
      for (const c of pilots.mates) mateList.push(c);
      // (and the pilot you're flying to, ally or not, so you can see where the trip's taking you)
      const to = state.auto?.pilot;
      if (to && !mateList.some((c) => c.id === to)) {
        const at = pilots.at(to);
        if (at) mateList.push({ id: to, name: state.auto.name ?? '', at });
      }
      mateList.sort((a, b) => apart(a.at.x, a.at.y, a.at.z, s.x, s.y, s.z) - apart(b.at.x, b.at.y, b.at.z, s.x, s.y, s.z));
      for (const c of mateList) {
        if (m >= h.mates.length) break;
        toScreen(c.at.x, c.at.y, c.at.z, hudAt);
        if (onScreen(hudAt.x, hudAt.y, hudAt.z, rect)) continue;
        const el = h.mates[m++];
        setOn(h, el, true);
        setText(h, el.firstChild, c.name);
        placeMark(el, hudAt);
      }
    }
    for (let i = m; i < h.mates.length; i++) setOn(h, h.mates[i], false);
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
      const g = (state.auto.space ?? state.space).goals[state.auto.id];
      if (g) goal = { at: g.at, name: g.name ?? state.auto.name ?? '', dist: range(apart(g.at[0], g.at[1], g.at[2], s.x, s.y, s.z)), reach: g.reach ?? g.r, way: false };
    }
    // (else the course plotted on the galaxy map: the way to jump, as the jump's own bearing, till J goes)
    else if (on && props.course && props.course !== state.sys?.id) {
      const g = courseGoal(props.course);
      if (g) {
        g.at[0] = s.x + g.dir[0] * 2000;
        g.at[1] = s.y + g.dir[1] * 2000;
        g.at[2] = s.z + g.dir[2] * 2000;
        goal = g;
      }
    }
    state.navGoal = goal ? goal.at : null;
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
    if (e.type === 'war' || e.type === 'fight') {
      war?.onNet(e);
      return;
    }
    if (e.type === 'hit') hurt(e.damage, e.from);
    else if (e.type === 'rammed') rammedBy(e);
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
        state.kills += 1;
        state.killMark = 1;
        const ram = state.clock - (pilotRammedAt.get(e.id) ?? -Infinity) <= GUARD.killWindow / 1000; // (yours by your ram: said as one)
        emit({ type: 'kill', kind: 'pilot', ...(ram ? { ram } : null) });
        pay('killPilot');
        if (!reduced) state.shake = Math.max(state.shake, 0.2);
        feel.hitstop(HITSTOP.kill);
      }
    }
    ctx.invalidate();
  };
  const setNet = (client) => {
    if (client === net) return;
    netOff?.();
    net = client ?? null;
    netOff = net?.on(onNet) ?? null;
    war?.setNet(net);
  };

  // the hunters a system's side meets, made ahead (a pack arriving shouldn't stall a frame)
  const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60));
  const stocked = new Set();
  const stockUp = () => {
    const f = state.effects?.garrison ?? state.sys?.faction;
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
    // what's sized in screen pixels follows the ratio the scene is drawn at
    // (the runtime's quality softens it: ./drawnAt.js), and the planets'
    // detail follows the sharpness
    followDrawn();
    const wanted = capDetail ? 0 : post.sharpness;
    if (Math.abs(wanted - detail) >= 0.05) {
      detail = wanted;
      state.world?.setDetail(detail);
    }
    // (the frame as the game runs it: slowed through a hitstop)
    const dt = feel.step(ms / 1000);
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
    // every shake asked for this frame, as the feel's trauma (held at least
    // that: the map's shakes were a floor, held while a thing goes on)
    if (state.shake > 0) atLeast(feel, state.shake);
    state.shake = 0;
    feel.setBaseFov(fov);
    feel.update(dt, camera);
    camera.updateMatrixWorld();
    tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    if (state.flare > 1) {
      state.flare = 1 + (state.flare - 1) * Math.exp(-dt * 2.5);
      if (state.flare < 1.01) state.flare = 1;
      post.flare(war?.on ? Math.min(state.flare, 1.25) : state.flare); // (held lower in a battle: its boosts and hits come often)
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
    // (inside a level's area of its own, Kamino's storm, its dome is the sky: the galaxy's hidden)
    state.enclosed = Boolean(war?.enclosed?.(camera.position));
    sky.group.visible = !inTunnel && !state.enclosed;
    if (state.enclosed || areaLook?.on) {
      areaLook ??= createAreaLook({ scene, renderer, post, keys, ambient, url: assetUrl });
      areaLook.apply(state.enclosed ? war.area : null, camera);
    }
    if (state.aim && (!flying() || state.crash || state.jump || props.frozen)) aimAt(null);
    sky.focus(state.jump?.phase === 'align' ? state.jump.to.id : (state.aim?.id ?? null));
    sky.update(camera, t);
    if (skyStreaks) {
      skyStreaks.group.visible = !inTunnel && !state.enclosed;
      skyStreaks.update(dt);
    }
    models.update(t);
    bolts.update(dt);
    flashes.update(dt);
    speedLines.update(dt);
    // (both, every frame: a portal's way in is the one and its way out the other, playing at once)
    const crashBusy = crashFx.update(dt, camera);
    const fxBusy = pops.update(dt, camera) || crashBusy;
    const adventuring = adventure(dt, t);
    const shooting = moveBolts(dt);
    // the speed: dust streaming past, the picture rushing out from the ship
    const dustWant = !reduced && flying() && !inTunnel ? 0.35 + 0.65 * clamp01(Math.abs(state.ship.speed) / SHIP.cruise) : 0;
    dustAmount += (dustWant - dustAmount) * clamp01(dt * 3);
    dust.update(camera.position, dustAmount, post.ratio);
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
      speedLines.set({ stretch: fast * 0.18, speed: fast * 80 });
    } else speedLines.set({ stretch: 0, speed: 0 }); // (none through a jump: the site's own is over the scene)
    if (state.hitMark > 0) state.hitMark = Math.max(0, state.hitMark - dt * 4);
    if (state.killMark > 0) state.killMark = Math.max(0, state.killMark - dt / 0.35);
    // the other pilots in this system
    if (net) {
      const s = flying() ? state.ship : null;
      // (hidden too while the page says you're somewhere you've not got to yet:
      // the pilots there would see you where you are, in the wrong system)
      const elsewhere = Boolean(props.system && state.sys && props.system !== state.sys.id);
      net.pose(s, { hidden: Boolean(state.crash || (state.jump && state.jump.phase !== 'align') || props.frozen || elsewhere || powers.hidden), boost: state.streak > 0.3, safe: state.clock < state.safeUntil, shield: state.shield });
      net.pack?.(() => (s && !state.crash && !state.jump && !props.frozen && !elsewhere ? (hunters?.wire() ?? []) : []));
    }
    const piloting = pilots.update(dt, now, net, { project: toScreen, tags: props.tags?.current ?? null, locked: state.lockTarget?.peer ?? null, me: flying() ? state.ship : null, factions: net?.factions ?? null });
    placeHud();
    placeLabels();
    placeStars();
    const showCab = Boolean(cab && cab.kind === state.kind && flying() && state.view === 'cockpit' && state.cabK > 0.6 && !state.crash);
    if (showCab) cabFrame(dt, t);
    post.overlay(showCab ? cabScene : null, camIn);
    // (the shade follows the suns through an eclipse; what's come in since, taken on now and then)
    house.follow({ adopt: houseFrames++ % 30 === 0 });
    renderer.info.reset();
    post.render(size.w, size.h);
    if (first) {
      first = false;
      emit({ type: 'ready' });
    }
    if (props.frozen) return Boolean(state.crash?.through || (state.dive && !state.dive.done));
    return !reduced || moving || shooting || fxBusy || worldBusy || adventuring || piloting || speedLines.busy || bolts.busy || flashes.busy || powers.busy || net?.peers.size > 0 || Boolean(state.model?.modules?.easing) || cabWas !== state.cabK || state.kick > 0 || state.flare > 1 || Boolean(state.stick?.on || state.jump);
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
  const held = new Set(); // the flight keys down now
  const onKeyDown = (e) => {
    if (!flying() || props.frozen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (typeof e.key !== 'string') return; // (an autofill's keydown has none)
    const el = e.target;
    const key = e.key.toLowerCase();
    if (!keyFlies(el, key)) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    const onControl = el instanceof HTMLElement && el !== document.body && el.closest('button, a, [role="button"], [tabindex]:not([tabindex="-1"])');
    if (key === 'm') {
      e.preventDefault();
      if (!e.repeat) emit({ type: 'map' }); // (a held M closed the map once; its repeats mustn't open it again)
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
    if (key === 'g' || key === 'x') {
      e.preventDefault();
      if (!e.repeat) power(key === 'g' ? 'primary' : 'ultimate');
      return;
    }
    if ((key === 'e' || (key === 'enter' && !onControl)) && state.at) {
      e.preventDefault();
      emit({ type: 'action', id: state.at });
      return;
    }
    const k = KEYS[key];
    // (the arrows and Space fly even with a button focused, as on the universe
    // map, unless the control took them itself; Enter is the button's)
    if (!k || e.defaultPrevented) return;
    e.preventDefault();
    heard();
    if (k !== 'boost') takeover();
    held.add(key);
    state.keys[k] = true;
    ctx.invalidate();
  };
  // (two keys to one control, Space and Shift to the boost: letting go of
  // one mustn't let go of the other's hold)
  const onKeyUp = (e) => {
    if (typeof e.key !== 'string') return;
    const key = e.key.toLowerCase();
    held.delete(key);
    const k = KEYS[key];
    if (!k) return;
    let still = false;
    for (const h of held) if (KEYS[h] === k) still = true;
    state.keys[k] = still;
  };
  const onBlur = () => {
    held.clear();
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
    state.auto = { id, park: parkBy(g, [s.x, s.y, s.z], solidsNow.length ? solidsNow : state.space.solids) }; // (clear of the big ships here now too)
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
  // Flying to another pilot in this system (the roster's “Fly to”, through
  // the page): their goal, `pilot:<id>`, is a park behind them while
  // they're flying here in sight (pilots.js's pose), worked out again every
  // REAIM_MS as they move (chasePilot, each frame). False if they aren't
  const flyTo = (id) => {
    const s = state.ship;
    const pose = typeof id === 'string' ? pilots.pose(id) : null;
    const park = parkBehind(pose);
    if (!s || !park || !state.space || state.crash || state.jump || state.dive || props.frozen) return false;
    heard();
    state.auto = { id: `pilot:${id}`, park, pilot: id, name: pose.name, space: pilotSpace(state.space, id, pose), reaimAt: performance.now() + REAIM_MS };
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
  // the trip given up before it's there (the stick taken back, Escape): the
  // page hears, for a trip to a pilot, so its follow is done
  const dropAuto = () => {
    const a = state.auto;
    state.auto = null;
    if (a?.pilot) emit({ type: 'arrived', id: a.id, done: false });
  };
  // each frame of a trip to a pilot, before the autopilot flies it: there
  // once within reach of them, or over if they're gone (offline, hidden,
  // off to another system), the autopilot off and their goal with it; else
  // re-aimed at where they are now, every REAIM_MS. The page notes it
  const chasePilot = () => {
    const a = state.auto;
    if (!a?.pilot) return;
    const pose = pilots.pose(a.pilot);
    const park = parkBehind(pose);
    if (!park) {
      state.auto = null;
      emit({ type: 'lost', id: a.id, name: a.name ?? null });
      return;
    }
    if (reached(state.ship, pose)) {
      state.auto = null;
      emit({ type: 'arrived', id: a.id, done: true, name: a.name ?? null });
      return;
    }
    const now = performance.now();
    if (now < a.reaimAt) return;
    a.reaimAt = now + REAIM_MS;
    a.park = park;
    a.space = pilotSpace(state.space, a.pilot, pose);
  };
  // (on a laptop a drag doesn't steer: dragSteers in universe/controls.js)
  const steersByDrag = dragSteers();
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
    if (d.moved < DRAG || !flying() || !steersByDrag) return;
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
      found: state.sys ? finds.count(state.sys.id) : null,
      wide: state.ship && state.space ? +state.space.wideAlong(state.ship.x, state.ship.y, state.ship.z).toFixed(2) : null,
      solids: state.space?.solids.length,
      war: war?.info ?? null,
      effects: state.effects ?? null,
      powers: powers.info,
      pickups: pickups.list.length,
      buffs: pickups.buffs().map((b) => b.kind),
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
    // one pickup of `kind` put `gap` dead ahead of the nose, for checking from a browser
    const dropAhead = (kind, gap = 12) => {
      const s = state.ship;
      if (!s) return null;
      const [fx, fz] = forward(s.heading);
      return pickups.drop({ x: s.x + fx * gap, y: s.y, z: s.z + fz * gap }, { ace: true, kind, shield: state.shield });
    };
    window.__galaxyDebug = { pickups, drop: dropAhead, THREE, scene, camera, renderer, post, state, models, hunters, pilots, startJump, goTo, flyTo, net: () => net, pin, destroy: () => startDestroyed(), interdiction, finds, interdictor, war, wingmen, effects: () => state.effects, skyStreaks: () => skyStreaks, happen: (id) => state.ship && happen(id, state.ship), powers, power: (slot) => power(slot), charge: () => powers.fill(), ram: (gap = 6, kind = null) => {
      // one of the system's hunters (or `kind`) put `gap` dead ahead at your height, coming at you, for checking a ram from a browser
      const s = state.ship;
      if (!s || !hunters) return null;
      const faction = Object.keys(FACTIONS)[0];
      hunters.pack(faction, s, { size: 1, ace: false, ...(kind ? { kinds: [kind] } : {}) });
      const b = hunters.bodies.at(-1);
      if (!b) return null;
      const [fx, fz] = forward(s.heading);
      Object.assign(b.at, { x: s.x + fx * gap, y: s.y, z: s.z + fz * gap });
      Object.assign(b.prev, b.at);
      Object.assign(b.vel, { x: -fx * 8, y: 0, z: -fz * 8 });
      return b.key;
    } };
    window.__gltfStats = gltfStats; // { requests, parses }: the models asked for, and the files fetched and parsed for them
  }

  return {
    ready,
    // everything sent to the graphics chip before the galaxy's shown (the
    // runtime runs it behind the climb, or the page's loading screen): every
    // picture, shader and one draw of it all, a slice at a time
    // (lib/three/gpuWork)
    async prepare(onProgress, { alive = () => true } = {}) {
      onProgress?.(0, 'load');
      await settleWithin(ready, 20000);
      if (!alive() || disposed) return;
      await prepareScene({ renderer, roots: [scene], scene, camera, target: post.target, render: () => post.render(64, 64), onProgress, alive: () => alive() && !disposed });
    },
    // the war's battle here as warfront.js has it (WarHud.jsx, BattleEnd.jsx), or null
    warInfo: () => war?.info ?? null,
    // the ?debug panel's groups: the feel's numbers (runtime/module.js)
    tune: () => [...bloomGroups(post.bloom), ...feelGroups(feel)],
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      followDrawn();
      measure();
    },
    render,
    update(next) {
      props = next;
      if ((next.ship ?? null) !== state.kind) {
        state.loadout = readLoadout(next.loadout ?? STOCK_LOADOUT); // (a new ship comes fitted as it was left)
        state.build = sameBuild(next.build) ? state.build : readBuildWire(next.build ? writeBuild(next.build) : null); // (and on the hull it was left on)
        state.tune = readTune(next.tune); // (and tuned as it was)
      }
      setShip(next.ship ?? null);
      setBuild(next.build ?? null);
      setLoadout(next.loadout);
      setTune(next.tune);
      setNet(next.net);
      // the page asking for another system (a link, the URL): jump there, but
      // only when it asks anew (asking.js)
      const ask = asking(asked, next.system, { here: state.sys?.id, to: state.jump?.to.id, midJump: Boolean(state.jump && state.jump.phase !== 'align') });
      asked = ask.asked;
      if (ask.act === 'queue') pendingSystem = next.system;
      else if (ask.act === 'jump') startJump(next.system, 'link');
      if (next.frozen) {
        endDrag();
        held.clear();
        state.keys = {};
        engine?.set({ speed: 0, on: false });
      }
    },
    setVisible(on) {
      state.shown = on;
      if (!on) engine?.set({ speed: 0, on: false });
    },
    // the runtime's quality: drawn softer through the post chain, a step at
    // a time, over a canvas that keeps its size (module.js's sharpness 'own': no
    // resize, so no cleared frame and the HUD stays crisp); at the floor
    // (past its last step), the glow and the grade go
    lowerQuality(level = STEPS.length) {
      // (each step the passes less sharp; the canvas keeps its size: module.js's `sharpness`)
      post.sharpness = STEPS[Math.min(level, STEPS.length - 1)];
      followDrawn();
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
      powers.cancel(); // (the ship's going down to the planet: no portal hop out of the dive)
      pickups.clear();
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
    // the crew's power ('primary', G) or the big one ('ultimate', X): whether it went
    power(slot) {
      return power(slot);
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
        dropAuto();
        return true;
      }
      return false;
    },
    // jump to another system (the page's galaxy map): false if it can't now
    jump(id) {
      return startJump(id, 'course');
    },
    // fly itself to something in this system, or to another pilot in it
    goTo,
    flyTo,
    // a space level's Starfighter Assault at this system (the page's
    // ?battle=starfighter: surface/missions/starfighterMaps.js has which), in
    // place of the war's battle, on `side`; you're put behind your side's
    // line. False if there's none here, or you're not here yet
    starfighter(id, { side = null } = {}) {
      const sf = starfighterAt(id);
      if (!war || !sf || state.sys?.id !== id || !state.ship) return false;
      sf.load().then(async ({ map, stages, air }) => {
        // (the bots' names: the bots lane's lists when they're on main, else the air rulebook's)
        const names = await loadNames(air);
        if (disposed || state.sys?.id !== id) return;
        const lv = levelOf(map, stages, air);
        lv.pilots = lv.sides.map((side) => listFor(names, side));
        const draw = drawSpaceLevel(scene, { pack: sf.pack, origin: stages.origin, packOrigin: sf.packOrigin, tier, renderer, area: stages.area ?? null, ships: lv.ships });
        if (!war.starfighter({ level: lv, side, draw, name: sf.name })) return;
        const team = war.info.team;
        if (team === null || !state.ship) return;
        // (your side's fighter kit, on its handling)
        const kit = playerKit(lv.kits?.[team] ?? []);
        state.flightKit = kit;
        state.flightTune = kit && air?.vehicles[kit.id] ? tuneFor(air.vehicles[kit.id], air.vehicles.xwing_t65).tune : null;
        const { pos, fwd } = war.battle.homeFor(team);
        state.ship = { ...spawn(null, { x: pos.x, y: pos.y, z: pos.z, heading: Math.atan2(-fwd.x, -fwd.z) }), speed: 0 };
        state.auto = null;
        retarget(900);
      });
      return true;
    },
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
      powers.dispose();
      pickupFx.dispose();
      crashFx.dispose();
      pops.dispose();
      hunters?.dispose();
      wingmen?.dispose();
      areaLook?.dispose();
      war?.dispose();
      pieces?.dispose();
      interdictor?.dispose();
      netOff?.();
      pilots.dispose();
      fleet.dispose();
      models.dispose();
      bolts.dispose();
      flashes.dispose();
      speedLines.dispose();
      sky.dispose();
      skyStreaks?.dispose();
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
