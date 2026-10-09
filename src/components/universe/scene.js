// The universe map in WebGL: the planets on a tilted disc among the stars,
// a faint orbit for each, and the planets' names as DOM buttons that React
// renders once and the scene moves as it draws (nothing re-renders per
// frame).
//
// Two ways to get round it:
// - With no ship picked, the camera flies between the planets (flight.js
//   does the numbers), a drag turns the map and a click picks a planet.
// - With a ship (Rick's cruiser, Luke's X-wing, the Falcon or Walt and
//   Jesse's RV), you fly it, Battlefront's way, free all the way round (it
//   loops, rolls and flies upside down): W and S for the throttle, A and D
//   to roll, the arrows to swing the nose left and right and pull it up and
//   down, Space to boost, F (held) to fire, T (Shift+T back) to switch
//   target, or drag on the map like a stick (a mouse swings the nose, a
//   finger turns it and works the throttle, with buttons to pull the nose up
//   and down). Let go and it rolls itself back upright. How quick each of
//   those is, and more (A and D can turn instead), is the visitor's to set
//   (controls.js, FlightSettings.jsx). The camera rides behind it, rolling
//   with it and swinging round after it, or, with V, you sit in the cockpit
//   (the intro's, cockpit/vehicles, drawn over the world from the pilot's
//   seat; the choice is kept between visits).
//   Fly close to a planet and you're at it (the panel shows its card); pick
//   one from its name or by clicking it and the ship flies itself there,
//   by the drive picked on the nav map (M, or the map button: NavMap.jsx,
//   nav.js): a jump to lightspeed that brings it out parked there
//   (hyperspeed, J for the place picked), or the autopilot on super speed
//   (the pulse drive pushed past itself) or cruising. The nav map can pull
//   back to the whole map in 3D, too. ship.js has the physics. A new ship starts
//   anywhere, unless a place is picked: at the edge of the home system, or
//   out in deep space off a fandom's planet or a wonder (ship.js's startAt),
//   so pilots joining don't all turn up in one spot.
//   Out past the home system is deep space (deep.js, deepspace.js), vast:
//   the fandoms' planets are far out in it, thousands of units apart, each
//   only a star until you come near it (farStars.js), as the galaxy's other
//   systems are, its name showing where you look, with
//   wonders between them, all reached on the pulse drive (click a wonder
//   and the ship takes you: ship.js's autopilot). You're not alone: traffic
//   (traffic.js), hunters after you (hunters.js, flown by hunterRules.js:
//   the Empire, the Federation, the Council of Ricks, more of them the more
//   trouble you make and nobody new while your shields are low; they steer
//   round the planets, which are cover; a pack that drops in ahead of you on
//   the way somewhere interdicts you: the pulse drive is cut to the boost
//   while they're on you, 40 s at most), with shields that take their hits
//   and come back, and now and then the director (director.js) sets
//   something going (setpieces.js: a Star Destroyer jumping in, portals, a
//   comet; a convoy, someone in distress; a supernova, far off). The guns
//   lock on to a hunter ahead (targeting.js) and a HUD over the canvas
//   (UniverseMap.jsx) shows the gun line, the lock, the lead to shoot at
//   and the way to wherever you're going. Fly into a wonder too fast and
//   it's a crash of its own kind: the Citadel takes you on into its world,
//   a star burns you back, a giant takes you down into its clouds. The
//   black hole, the Maw, pulls you in as you come near it, and past its
//   point of no return (maw.js) you watch your ship spiral down it from a
//   way off, then go in after it (infall.js draws the fall), and the page
//   goes on to what's beyond.
//   The ship is fitted out in the hangar (outfit.js): a paint job on its
//   hull, glow and shots (livery.js), and parts bolted on (modules.js) that
//   change how it flies (ship.js's tune: boosters push the boost, thrusters
//   turn it quicker, mass slows it), how its guns fire (faster, or harder
//   on a hunter, from barrels of their own) and what its shields take; its
//   boosters burn exhausts of their own as it boosts. The autopilot flies
//   it as it came, so it still stops where it means to.
//   Gone online (online/), the other visitors flying it are here too
//   (online/pilots.js): their ships and callsigns, and their shots; the guns
//   lock on to anyone who isn't your ally (nor just back from being shot
//   down), a hit comes off their shields (they're told, and take it
//   themselves), and theirs off yours. The hunters after each pilot are in
//   everyone's sky: yours go out to the others (net.pack), theirs are
//   drawn here and can be shot at, the hit told to whoever they're after.
//
// A scene module for lib/three/useScene: create(canvas, ctx) returns
// { resize, render, update, setVisible, lowerQuality, hover, dive, escape,
//   whole, boost, climb, fire, dispose }.
// Props: selected (an id or null), ship (a crew id or null), loadout (what's
// fitted to it in the hangar: outfit.js's paint job and parts, which it
// wears and flies on), controls (the
// visitor's flying settings: controls.js), labels (a ref
// to { id: element }), stick (a ref to the steering ring), alt (a ref to the
// height gauge), shield (a ref to the shields bar), hud (a ref to the
// targeting HUD's box: the reticle, the lock, the lead and the nav bracket
// are its children), net (online/client.js's link to the other pilots, or
// null), tags (a ref to the box their callsigns go in), frozen (the page
// is leaving: stop drawing), onPick(id), onOpen(id) (a station's sign was
// clicked: go to its page), onEvent(event), onLand(), onCrash(id, page) (the ship
// went into a planet or a station too fast and the impact has played, or
// fell into the black hole and is gone: true if the page goes on into its
// page, or on through to what's beyond the hole, so the ship doesn't come back;
// `page`, where a wonder with a page of its own goes instead).

import * as THREE from 'three';
import { EMOTES } from '../../lib/emote';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { capturePointer } from '../../lib/pointer';
import { local as remembered } from '../../lib/hooks';
import { plan as cockpitPlan } from '../cockpit/timeline';
import { freeKit } from '../cockpit/kit';
import { audioContext } from '../../lib/audio';
import { takeArrival } from '../../lib/arrival';
import { clamp01, createRenderer, disposeTree, easeOut, precompile, precompilePasses, singlePass, uploadTextures } from '../../lib/three/renderer';
import { prepareScene, uploadSlices } from '../../lib/three/gpuWork';
import { calibrate, calibrationKey, recall, remember } from '../../lib/three/calibrate';
import { settle as settleWithin } from '../../lib/settle';
import { device } from '../../lib/device';
import { createPace } from '../../lib/three/pace';
import { CHASE, DIVE_MS, FOV, chaseDist, cover, cameraFrom, focusPose, overviewPose, poseAt, startFlight, worldPos } from './flight';
import { BELT, BODIES, ORDER, POSITIONS, REACH, RIM, RING, SECTORS, SECTOR_OF, SUN, inExpanse, mapSectorOf, sectorOf } from './layout';
import { HOME_SPREAD } from './scale';
import { buildPlanet, loadModel, loadModels, loadTextures } from './planets';
import { buildSun } from './sun';
import { MAP_LENS, aberrationFor, createPost, spaceEnvironment } from './post';
import { grainFor } from '../../lib/three/noise';
import { createFlare, flareWeight, occluded } from '../../lib/three/flare';
import { exposureFor, sunShareOf } from '../../lib/three/exposure';
import { houseOn } from '../../lib/three/house';
import { houseGroups } from '../../lib/three/houseTuning';
import { createFeel, feelGroups } from '../../lib/three/feel';
import { bloomGroups } from '../../lib/three/bloom';
import { createImpacts, impactGroups } from '../../lib/impact';
import { debugOn, debugPanel } from '../../lib/debugPanel';
import { LEAN, OPEN_SPACE, PLANETS, SHIP, SOLIDS, SPACE, autopilot, crashLoud, forward, headingTo, holdReach, isGoal, isPlace, noseOf, orbiting, parkAt, spawn, startAt, step } from './ship';
import { HYPER, destinationById, driveById, hyperState, legOf, parkFor, riftExit, shortDistance } from './nav';
import { REAIM_MS, parkBehind, pilotId, pilotSpace, reached } from './pilotGoal';
import { FACTIONS, HUNTER_KINDS, NAMES, createHunters } from './hunters';
import { ION } from './hunterRules';
import { difficultyOf } from './difficulty';
import { AHEAD_OF, crewAt, factionsOf, kindsOf, pick as pickFaction, sideAt, sideFor, sideOf, wingOf } from './sides';
import { TROOPS } from './foot';
import { GLB, createFleet } from './glbFleet';
import { createDirector, withWhere, zoneOf } from './director';
import { regionAt } from './regions';
import { ECLIPSE, bodyAt, canEclipse, eclipseAt, eclipsePlan } from './eclipse';
import { createSetPieces } from './setpieces';
import { createLeviathans } from './leviathans';
import { createMeteors } from './meteors';
import { createMines } from './mines';
import { ESCORT, escortHull, escortPlan, escortTo } from './escort';
import { DEBRIS_DRIFT, SKY_FAR, buildDeepSpace } from './deepspace';
import { FAR_STARS, createFarStars } from './farStars';
import { createLandmarks } from './landmarks';
import { aimFrom, aimTargets, jumpPhase, nameShows } from './aim';
import { aligned, steerToward } from '../galaxy/space';
import { createSectorPortals } from './sectorPortals';
import { GUN, gunHit, gunTransit } from './gunPortal';
import { createGunPortal } from './gunPortalFx';
import { createCurve } from './curve';
import { createSectorFleet } from './sectorFleetView';
import { portalById, portalHit, transit } from './portals';
import { ROCK_RELIEF } from '../../lib/three/rock';
import { ROCK_HIT, boxOf, nearBox, nearRing, rockDamage, rockGrid, sweep, toBelt } from './rockHits';
import { BEACONS, ZONE as FRONT_ZONE, createFront } from './front';
import { createFarFights, fightLabel, pickFightNode } from './farFights';
import { placeAt } from './skirmish';
import { createModels as createBattleModels } from '../galaxy/models';
import { createTrench } from './trench';
import { PHONE, createPhone } from './phone';
import { SUPERNOVA_SITES, createSupernovae } from './supernova';
import { DEEP, PLACES, WONDERS, moveBinaries, nearestStar, openness, reachOf, wonderById } from './deep';
import { KEY as KEY_FULL, STARS as LIT_STARS, dayYaw, lightAt, sunFor } from './lighting';
import { createCrash } from './crash';
import { createExplosions } from '../../lib/three/explosions';
import { createInfall } from './infall';
import { DISK_N, MAW, captured, fallAt, plungeAt, pullAt, startFall } from './maw';
import { createTraffic } from './traffic';
import { createWingmen } from './wingmen';
import { createSkirmishes } from './skirmishes';
import { createBelt, createDust } from './belt';
import { createTrail } from './trail';
import { CREW_INK, ENGINES, LENGTH, SHIP_MODELS, buildShip } from './shipModels';
import { HERO_ENGINES, capPlume, createEngines } from './engines';
import { paintById } from './paint';
import { FASTEST, PARTS, PARTS_SLOTS, STOCK, STOCK_LOADOUT, readLoadout, statsOf } from './outfit';
import { createNpcs } from './npcs';
import { NPCS, visitorsOf } from './npcs/index';
import { tells } from './npcRules';
import { createStanding } from './standing';
import { createWanted } from './wanted';
import { createLaw } from './law';
import { readBuildWire, writeBuild } from './shipyard/build';
import { readLooks } from '../rickmorty/wardrobe/looks';
import { BUILT_KINDS, buildTraffic } from './trafficModels';
import { entrySound, lockSound, shipEngine, wellSound } from './sounds';
import { AIM, aimAngles, assist, assistAmount, dirTo, edgeOf, intercept, nose, onScreen, track, trackNudge } from './targeting';
import { DEFAULTS as CONTROL_DEFAULTS, STICK, dragSteers, keyAxes, keyFlies, stickInput } from './controls';
import { byId } from './universes';
import { SIZE as PILOT_SIZE, createPilots } from './online/pilots';
import { arsenalOf, createArmory, fan, steer } from './weapons';
import { JAMMED, jumpState } from './words';
import { CORE, GENS, citadelGeometry, createSiege, segmentSphere } from './siege';
import { createCitadelSiege } from './citadelSiege';
import { GUARD, STALE_MS } from './online/protocol';
import { createFoot } from './footScene';
import { createLook } from '../../runtime/look';
import { reticleState } from '../../runtime/hud/reticle';
import { coneFor } from '../../lib/combat/aim';
import { flownInto, wayIn, worldName } from './landings/wayin';
import { figureVoice } from './landings/voicelines';
import { sayVoiced, stopVoiced } from '../../lib/voiced';
import { ENTRY, LANDABLE, airTop, entering } from './entry';
import { createNearMaps } from './nearMaps';
import { poseFor } from './poses';
import { REMOVER, hitRemover, hpLeft, landingOpen, newRemover, stepRemover } from './remover';
import { NX5_LEN, createRemoverView } from './removerView';
import { createSky } from '../galaxy/sky';
import { SYSTEMS } from '../galaxy/systems';
import { createExpanse } from '../expanse/scene/expanse';
import { UNIVERSE } from '../expanse/gen/seed';
import { runtime } from '../../runtime';
import { deedToEarn } from './economy';
import { createPayLedger, hunterEarn } from './earnRules';
import { contact, keptSpeed } from '../../lib/combat/contact';
import { createShipHits, ramNote, solidsWith } from './shipHits';

const STREAKS = 220;
const BOLTS = 40; // shots in flight at once (a spread throws five)
const MISSILES = 8; // heavy rounds in flight at once (weapons.js)
const SIEGE_NEAR = 420; // map units from the Citadel's middle: its parts can be locked on to
// seconds between shots with the trigger held (the X-wing's four cannons
// fire in turn, so it's quickest; the RV is a man with a gun out of the window)
const CADENCE = { xwing: 0.12, falcon: 0.16, cruiser: 0.19, rv: 0.2 };
const BOLT_COLOR = { falcon: '#ff4a3d', xwing: '#ff3b30', cruiser: '#9df06b', rv: '#5cc8ff' };
// each ship's exhaust (trail.js): its colour, its white-hot core, how wide
// and how long it is, and the cruiser's portal-plasma ripple
const PLUME = {
  cruiser: { color: '#4dff3a', core: '#e6ffd2', width: 0.036, life: 0.42, length: 0.32, wobble: 1.3, sparks: 40 },
  falcon: { color: '#5cbcff', core: '#eef8ff', width: 0.034, life: 0.45, length: 0.36, wobble: 0 },
  xwing: { color: '#ff6a36', core: '#fff0dc', width: 0.017, life: 0.38, length: 0.3, wobble: 0 },
  rv: { color: '#ff9a3c', core: '#fff0d8', width: 0.02, life: 0.4, length: 0.3, wobble: 0 },
};
const IDLE = 40000; // ms sitting still before the crew get bored
const PARTS_CHANGED = (a, b) => PARTS_SLOTS.some((slot) => a[slot] !== b[slot]);
const SAFE = 3; // seconds after coming back when other pilots' shots don't count
const NO_SHIPS = []; // (no big ship moving through: solidsWith's base)
const RAM_CLEARED = 2; // seconds after a ram's kill a pack cleared is the ram's (said as one)
const PREFETCH_AFTER = 2.5; // seconds at a planet you could land on before what landing there wants is fetched (not as you fly past)
// the cockpit view: the intro's cockpits, built on demand; the eye sits a
// little ahead of the ship's middle and above it (map units); the lens is
// the intro's, framed for a wide horizontal view, kept within sane vertical limits
const CABS = {
  falcon: () => import('../cockpit/vehicles/falcon'),
  xwing: () => import('../cockpit/vehicles/xwing'),
  cruiser: () => import('../cockpit/vehicles/cruiser'),
  rv: () => import('../cockpit/vehicles/rv'),
};
const SEAT_KEY = 'tp:universe-seat'; // 'chase' or 'cockpit', remembered
const EYE = { ahead: 0.035, up: 0.045 };
const CAB_HFOV = 88;
const CAB_VFOV = [52, 94];
// a crash, in seconds from the moment it hits: on into the planet, the
// impact, on through into its page (a planet or a station, not the sun),
// or else the ship back again, and the end of its coming back. Into the
// black hole there's no impact: the fall plays out instead, on maw.js's
// timings, and goes on through to what's beyond it (and if the page doesn't
// take it on, back out past its reach)
const CRASH = { impact: 0.32, through: 1.6, back: 2.7, done: 3.3 };
const FALL = { through: MAW.through, back: MAW.through + 0.3, done: MAW.through + 0.9 };
// into a giant it's a dive down into the clouds
const DIVE = { impact: 0.55, through: 1.7, back: 2.8, done: 3.4 };
const INTERDICT = 40; // seconds, at most, that a pack holds the pulse drive down
const INTERDICT_IN = 2; // seconds it takes them to hold it all the way down (eased in: a pull, not a wall)
const STREAK_SPEED = 36; // the streaks' speed tops out here: faster they'd be a wall
const TURN = 0.0042; // radians of map per px dragged
const DRAG = 6; // px a press may move and still be a click
const LIGHT = new THREE.Vector3(-0.6, 0.62, 0.48).normalize(); // key light, upper left

// (Battlefront's: W and S the throttle, A and D the roll, the arrows the
// nose, as a stick: controls.js's keyAxes)
const KEYS = { w: 'up', s: 'down', a: 'a', d: 'd', arrowleft: 'left', arrowright: 'right', arrowup: 'pitchUp', arrowdown: 'pitchDown', ' ': 'boost', shift: 'boost', f: 'fire' };
// on foot: W A S D or the arrows walk and turn, Space jumps, Shift runs, Q and E step sideways (and F fires, footKey)
const FOOT_KEYS = { ...KEYS, a: 'left', d: 'right', arrowup: 'up', arrowdown: 'down', ' ': 'jump', shift: 'boost', q: 'strafeL', e: 'strafeR', f: null };
const FOOT_FOV = 56; // the lens on foot: a person's, wider than the chase's
const SHIP_NAMES = { rv: 'The RV', cruiser: 'The cruiser', xwing: 'The X-wing', falcon: 'The Falcon' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TRACK_AFTER_SHOT = 1500; // ms: a lock the guns picked is followed this long after a shot at it
// how far apart, in three dimensions (a square root: Math.hypot makes garbage
// of its arguments, and these run every frame)
const apart = (ax, ay, az, bx, by, bz) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// one faint circle per station round the sun, all in one draw (the far
// planets don't orbit it: they're worlds of their own out in deep space)
function orbits() {
  const SEG = 160;
  const pts = [];
  for (const id of ORDER) {
    if (byId(id).kind !== 'core') continue;
    const [x, y, z] = POSITIONS[id];
    const R = Math.hypot(x, z);
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const b = ((i + 1) / SEG) * Math.PI * 2;
      pts.push(Math.cos(a) * R, y, Math.sin(a) * R, Math.cos(b) * R, y, Math.sin(b) * R);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#9fb0d0', transparent: true, opacity: 0.05, depthWrite: false }));
}

// Stars streaming past when the ship boosts: thin streaks of light round
// the camera's line of sight (none down the middle, where the ship is),
// riding with the camera, rushing at it out of the distance. Each is a
// sliver that turns its face to the lens, brightest at its head and fading
// to nothing down its tail, faint far off and gone before it reaches you;
// longer, brighter and more of them the harder it boosts, white with a
// touch of the ship's own colour (portal green, hyperspace blue, the
// X-wing's orange). It all moves on the GPU: one draw, no per-frame upload.
const STREAK_VERT = `
attribute vec4 aStreak; // angle round the line of sight, distance out from it, where along the run, a random
attribute vec2 aCorner; // across (−1, 1), along (0 the tail, 1 the head)
uniform float uTravel;
uniform float uLen;
uniform float uAmount;
varying float vHead;
varying float vSide;
varying float vFade;
void main() {
  float run = fract(aStreak.z + uTravel * (0.8 + 0.4 * aStreak.w) / 17.6); // 0 far ahead … 1 at the camera
  float z = -17.0 + run * 17.6;
  float len = uLen * (0.55 + 0.9 * aStreak.w);
  vec2 dir = vec2(cos(aStreak.x), sin(aStreak.x));
  vec3 p = vec3(dir * aStreak.y * vec2(1.0, 0.72), z - len * (1.0 - aCorner.y));
  // a little wider the closer it is, and the heavier ones a little wider still
  p.xy += vec2(-dir.y, dir.x) * aCorner.x * (0.003 + 0.0035 * aStreak.w * aStreak.w);
  vHead = aCorner.y;
  vSide = aCorner.x;
  // in from the dark ahead, out before the lens; only some show at a low boost
  float shown = smoothstep(aStreak.w * 0.75, aStreak.w * 0.75 + 0.2, uAmount);
  vFade = smoothstep(0.0, 0.25, run) * (1.0 - smoothstep(0.8, 0.97, run)) * shown;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const STREAK_FRAG = `
uniform vec3 uColor;
uniform float uAmount;
varying float vHead;
varying float vSide;
varying float vFade;
void main() {
  float across = clamp(1.0 - abs(vSide), 0.0, 1.0);
  float head = vHead * vHead;
  gl_FragColor = vec4(uColor * head * across * vFade * (0.3 + 0.4 * uAmount), 1.0);
}`;
function streaks(rand) {
  const info = new Float32Array(STREAKS * 4 * 4);
  const corner = new Float32Array(STREAKS * 4 * 2);
  const index = [];
  for (let i = 0; i < STREAKS; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.6 + rand() ** 0.8 * 2.3;
    const along = rand();
    const weight = rand();
    for (let c = 0; c < 4; c++) {
      info.set([a, r, along, weight], (i * 4 + c) * 4);
      corner.set([c % 2 ? 1 : -1, c < 2 ? 0 : 1], (i * 4 + c) * 2);
    }
    const o = i * 4;
    index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 4 * 3), 3));
  g.setAttribute('aStreak', new THREE.BufferAttribute(info, 4));
  g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
  g.setIndex(index);
  const mat = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: { uTravel: { value: 0 }, uLen: { value: 1 }, uAmount: { value: 0 }, uColor: { value: new THREE.Color('#dfe9ff') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const lines = new THREE.Mesh(g, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  lines.renderOrder = 2;
  const tint = new THREE.Color();
  return {
    lines,
    // white, with a touch of the ship's colour (brighter than white at the
    // head, so the nearest catch the bloom)
    setTint(color) {
      tint.set(color);
      mat.uniforms.uColor.value.set('#ffffff').lerp(tint, 0.35).multiplyScalar(1.5);
    },
    update(dt, speed, amount) {
      lines.visible = amount > 0.01;
      if (!lines.visible) return;
      const u = mat.uniforms;
      u.uAmount.value = amount;
      u.uTravel.value += speed * dt * 2.2;
      u.uLen.value = (0.4 + speed * 0.13) * (0.4 + 0.8 * amount);
    },
  };
}

// The moment a boost lights: a ring of the engines' light bursting out
// behind the ship, square to its line of flight, rippling (the cruiser's
// swirls, like a portal's edge), gone in half a second.
const BURST_FRAG = `
uniform vec3 uColor;
uniform float uAge;
uniform float uSwirl;
varying vec2 vUv;
void main() {
  vec2 c = vUv * 2.0 - 1.0;
  float r = length(c);
  float a = atan(c.y, c.x);
  float grow = 1.0 - (1.0 - uAge) * (1.0 - uAge);
  float front = 0.25 + 0.7 * grow;
  float wobble = uSwirl * 0.03 * sin(a * 7.0 + r * 18.0 - uAge * 14.0);
  float d = (r - front + wobble) / (0.03 + 0.05 * uAge);
  float band = exp(-d * d);
  // a flash at the nozzles (the cruiser's turning, like a portal opening)
  float spiral = mix(1.0, 0.5 + 0.5 * sin(a * 3.0 + r * 16.0 - uAge * 12.0), uSwirl);
  float inner = exp(-r * r * 14.0) * (1.0 - grow) * 0.5 * spiral;
  float fade = (1.0 - uAge) * (1.0 - uAge);
  // white-hot along the crest of the ring, the engines' colour either side
  vec3 col = uColor * (band + inner) + vec3(1.6) * band * band * band * band;
  gl_FragColor = vec4(col * fade * step(r, 1.0), 1.0);
}`;
function boostBurst() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: BURST_FRAG,
    uniforms: { uColor: { value: new THREE.Color() }, uAge: { value: 0 }, uSwirl: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    forceSinglePass: true, // (added light on a flat plane: one pass draws the same)
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.visible = false;
  mesh.frustumCulled = false;
  let age = 1;
  const LIFE = 0.55;
  return {
    mesh,
    // on the ship (its pivot, so it pitches and banks with it), at the
    // middle of its engines (in the pivot's units, nose toward −z)
    fire(pivot, at, color, swirl) {
      age = 0;
      pivot.add(mesh);
      mesh.position.copy(at);
      mat.uniforms.uColor.value.set(color).multiplyScalar(2.6);
      mat.uniforms.uSwirl.value = swirl;
      mesh.visible = true;
    },
    // it drifts back from the engines a little as it grows
    update(dt) {
      if (!mesh.visible) return false;
      age += dt / LIFE;
      if (age >= 1) return (this.clear(), false);
      mat.uniforms.uAge.value = age;
      mesh.scale.setScalar(0.18 + age * 0.5);
      mesh.position.z += dt * 0.5;
      return true;
    },
    // off the ship (before it's changed or thrown away, which would take this with it)
    clear() {
      mesh.visible = false;
      mesh.removeFromParent();
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

export async function create(canvas, ctx) {
  const { reduced } = ctx;
  let props = ctx;
  let disposed = false;

  // (at most 1.5 device pixels to a CSS one: the whole sky, bloom and all,
  // filling a retina screen at 2 is more than most graphics chips draw
  // smoothly while flying, and the names and the HUD are crisp DOM anyway;
  // and no antialiasing on the canvas: the post's target has its own, post.js)
  const gl = createRenderer(canvas, { ratio: 1.5, antialias: false, onLost: ctx.onLost, onSlow: ctx.onSlow, guard: { invalidate: ctx.invalidate } });
  const { renderer } = gl;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.08, 30000); // (out to the far side of deep space; the near plane follows the view, place())
  scene.add(camera); // it carries the streaks
  const map = new THREE.Group(); // turned (yaw) by a drag, or to keep the camera behind the ship
  scene.add(map);

  // the names under the planets are the way in by keyboard and screen reader
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cursor = 'grab';

  // light: a key from the star that lights where you are, a fill from the
  // second (or a cool one from the far side), a little ambient (lighting.js;
  // set each frame by lights(), below). Until the first frame, the map's old
  // key from the upper left.
  const key = new THREE.DirectionalLight('#fff8f0', 2.35);
  key.position.copy(LIGHT).multiplyScalar(50);
  const fill = new THREE.DirectionalLight('#8ea2ff', 0.45);
  fill.position.set(0.7, -0.4, -0.3).multiplyScalar(50);
  const ambient = new THREE.AmbientLight('#b8c4ff', 0.4);
  scene.add(key, fill, ambient);
  // the house look (lib/three/house) on the map's ships, stations and
  // landmarks: their shade the colour of the space light, as in every world.
  // (The post pass tone-maps the house's way itself, and space has no fog:
  // both left as they are. The planets draw in shaders of their own.)
  const house = houseOn({ renderer, scene, sun: key, ambient, toneMap: false, look: { fog: false } });
  let houseFrames = 0;
  // the key's direction in world space, shared with every planet, which
  // puts its own sun in the key's place (planets.js's keyHook)
  const keyW = { value: LIGHT.clone() };

  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const rings = orbits();
  map.add(rings);
  // the asteroid belt, and dust round the camera to feel the speed by (belt.js)
  // (more rocks for the wider band the home system grew to, scale.js: not
  // the band's whole growth in area, so the triangles grow less than it)
  const belt = createBelt({ small: (window.matchMedia?.('(pointer: coarse)').matches ?? false) || Math.min(window.innerWidth, window.innerHeight) < 600, count: Math.round(3200 * HOME_SPREAD), tier: device().tier });
  map.add(belt.group);
  // and the rim: a ring of ice right round the edge of the map (layout.js's RIM)
  const rim = createBelt({ small: Math.min(window.innerWidth, window.innerHeight) < 600, band: RIM, seed: 2049, tones: ['#c9d8e8', '#9fb4c8', '#dfe8f2', '#8ea0b4'], scale: 14, spin: 0.0012, count: 700, tier: device().tier });
  map.add(rim.group);
  const dust = createDust({ small: Math.min(window.innerWidth, window.innerHeight) < 600 });
  map.add(dust.points);
  const camLocal = new THREE.Vector3();
  // (the drawing's own origin, far out: drawn())
  const drawAt = new THREE.Vector3();
  let dustAmount = 0;
  // the ship's exhaust, a plume from each engine (trail.js), and a ring of
  // light that runs out round a place as you arrive
  let plumes = []; // { trail, at: where its engine is, inside the ship's pivot }
  const nozzle = new THREE.Vector3();
  const setPlumes = (kind, engines) => {
    burst.clear();
    for (const pl of plumes) {
      map.remove(pl.trail.mesh);
      pl.trail.dispose();
    }
    plumes = [];
    if (!kind) return;
    const look = PLUME[kind] ?? PLUME.falcon;
    streak.setTint(plumeColor());
    plumes = engines.map((at) => {
      // (under the ship: no longer than 0.6 of it, no brighter than its lit side)
      const trail = createTrail(capPlume(look));
      trail.setColors(plumeColor(), look.core);
      map.add(trail.mesh);
      return { trail, at: new THREE.Vector3(...at) };
    });
  };
  // the boosters' exhausts (modules.js's nozzles), lit only as it boosts
  let boosterPlumes = [];
  const BOOSTER_PLUME = { width: 0.014, life: 0.32, length: 0.24, wobble: 0 };
  const setBoosterPlumes = (nozzles = [], color = null) => {
    for (const pl of boosterPlumes) {
      map.remove(pl.trail.mesh);
      pl.trail.dispose();
    }
    boosterPlumes = [];
    if (!color) return;
    boosterPlumes = nozzles.map((at) => {
      const trail = createTrail(BOOSTER_PLUME);
      trail.setColors(color, '#fff6e2');
      map.add(trail.mesh);
      return { trail, at: new THREE.Vector3(...at) };
    });
  };
  const updatePlumes = (dt, t, amount, stretch = 1, boosting = 0) => {
    const m = state.model;
    if (!m) return;
    m.group.updateMatrixWorld(true);
    const flame = m.modules?.flame ?? 1;
    for (const pl of plumes) {
      map.worldToLocal(m.pivot.localToWorld(nozzle.copy(pl.at)));
      pl.trail.update(dt, t, nozzle, amount, camLocal, 1 + (stretch - 1) * flame);
    }
    for (const pl of boosterPlumes) {
      map.worldToLocal(m.pivot.localToWorld(nozzle.copy(pl.at)));
      pl.trail.update(dt, t, nozzle, boosting, camLocal, 1 + boosting);
    }
  };
  // a boost lighting: the burst at the engines, a flare of the bloom and a
  // kick of the camera's lens (not with reduced motion)
  const burst = boostBurst();
  const ignite = () => {
    const m = state.model;
    if (reduced || !m || !plumes.length) return;
    const mid = new THREE.Vector3();
    for (const pl of plumes) mid.add(pl.at);
    mid.divideScalar(plumes.length);
    mid.z += 0.02;
    burst.fire(m.pivot, mid, plumeColor(), state.kind === 'cruiser' ? 1 : 0);
    state.flare = Math.max(state.flare, 1.5);
    state.kick = 1;
  };
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 128), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  pulse.rotation.x = -Math.PI / 2;
  pulse.visible = false;
  map.add(pulse);
  let pulseAt = null; // { id, age }
  const streak = streaks(rand);
  camera.add(streak.lines);

  // shots: a few glowing bolts, reused
  const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6).rotateX(Math.PI / 2); // (long: they're quick)
  const boltMat = new THREE.MeshBasicMaterial({ color: '#ff4a3d', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const bolts = Array.from({ length: BOLTS }, () => {
    const m = new THREE.Mesh(boltGeo, boltMat);
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: [0, 0, 0] };
    map.add(m);
    return m;
  });

  // the planets' maps first (half size on a phone or anything below a
  // desktop, lib/device), so nothing pops in; a weak device starts with the
  // nearer stars thinned out
  const tier = device().tier;
  const small = tier !== 'high' || Math.min(window.innerWidth, window.innerHeight) < 600;
  const T = await loadTextures({ small });

  // what metal reflects, and the passes after the scene (post.js)
  let env = spaceEnvironment(renderer, T['sky-glow']);
  scene.environment = env.texture;
  const post = createPost(renderer, scene, camera, { small });
  // the map's lens (post.js; the galaxy keeps its picture): a floor under
  // the sky, a little more contrast, and the corners soft but on a low tier
  post.setToe(...MAP_LENS.toe);
  post.contrast(MAP_LENS.contrast);
  post.defocus(tier === 'low' ? 0 : 1);

  // the sky: the Star Wars galaxy's (galaxy/sky.js), its disc and dust,
  // its core and nebulae, as Kashyyyk sees it (the core a third of the way
  // in: bright, not blinding), without its suns (the map has its own) or
  // the other systems' stars to jump to; turning with the map and riding
  // with the camera, baked once into a cube
  const sky = createSky({ small, level: device().detail, renderer, beacons: false });
  sky.setSystem({ ...SYSTEMS.find((s) => s.id === 'kashyyyk'), suns: [] });
  sky.setRatio(gl.ratio);
  map.add(sky.group);
  sky.prepare(renderer).then(() => sky.bake(renderer));

  // deep space, out past the home system: its wonders, and the trench run
  // round the Death Star's middle
  const deep = buildDeepSpace({ small, tier });
  // what the ship can hit among the rocks (rockHits.js): the belt, the rim
  // and the debris streams, each from the same rocks its mesh draws. A rock
  // the ship's smashed is gone a while (`smashed`: field → index → when it's back)
  const BELT_SPIN = 0.006;
  const RIM_SPIN = 0.0012;
  const rockFields = [
    { id: 'belt', grid: rockGrid(belt.rocks), ring: BELT, spin: BELT_SPIN, field: belt },
    { id: 'rim', grid: rockGrid(rim.rocks, 60), ring: RIM, spin: RIM_SPIN, field: rim },
    { id: 'debris', grid: rockGrid(deep.debris.rocks, 20), box: boxOf(deep.debris.rocks), field: deep.debris },
  ];
  const smashed = new Map(rockFields.map((f) => [f.id, new Map()]));
  map.add(deep.group);
  // the portals between the map's sectors (sectorPortals.js; flown through below: portalThrough)
  const sectorPortals = createSectorPortals(map);
  // and Rick's portal gun's, fired from the cruiser in flight (gunPortal.js; flown through below: gunThrough)
  const gunPortal = createGunPortal(map);
  let gunAt = -Infinity;
  // the cockpit's launch came through Rick's portal (cockpit/vehicles.js's
  // `arrive`, lib/arrival.js): the cruiser comes out in that sector, once
  // it's flying (fly, below); taken now if the map came up after the flash
  let arriving = null; // { sector, until }
  const takeArrive = () => {
    const sector = takeArrival();
    if (!sector) return;
    arriving = { sector, until: wall() + 12 };
    ctx.invalidate();
  };
  // and the Rick and Morty sector's edge, the Central Finite Curve (curve.js)
  const curve = createCurve(map);
  const trenches = PLANETS.filter((p) => p.trench).map((p) => createTrench({ at: p.at, r: p.r, trench: p.trench }, { small }));
  for (const tr of trenches) map.add(tr.group);
  // and a phone out past the belt that nothing mentions (phone.js)
  const phone = createPhone();
  map.add(phone.group);
  // the supernovas, when the director sets one off
  const novae = createSupernovae({ small });
  map.add(novae.group);

  // the sun in the middle, warming the stations round it
  const sun = buildSun(T);
  map.add(sun.group);
  // (its strength grown with the ring, so a light falling off as
  // distance^1.4 is as bright on the stations as it was at the first ring,
  // 85 out; its reach with the home system, scale.js, past the belt)
  const sunLight = new THREE.PointLight('#ffd6a8', 890 * (RING / 85) ** 1.4, 320 * HOME_SPREAD, 1.4);
  map.add(sunLight);

  // each planet lit from its own star (lighting.js's sunFor, in the map's
  // axes; turned with the map into the world's each frame: lights())
  const sunInMap = Object.fromEntries(BODIES.map((id) => [id, sunFor(id)]));
  const planets = BODIES.map((id) => {
    const p = buildPlanet(byId(id), T, { sun: new THREE.Vector3(...sunInMap[id]), tier, key: keyW });
    p.group.position.set(...POSITIONS[id]);
    map.add(p.group);
    return p;
  });
  const planetOf = Object.fromEntries(planets.map((p) => [p.id, p]));
  // the Expanse past the rim (expanse/scene/expanse.js): asleep inside it;
  // its floating origin is the runtime's (re-anchored here as it moves)
  const origin = runtime().origin;
  origin.reset();
  const expanse = createExpanse(map, {
    universe: typeof ctx.universe === 'bigint' ? ctx.universe : UNIVERSE,
    origin,
    tier,
    reduced,
    onSector: (id) => {
      if (inExpanse(id)) state.note = { text: `The Expanse · ${id}`, until: wall() + 3 };
    },
  });
  // and every place past where it's real drawn as a star instead, the
  // galaxy's way (farStars.js): from anywhere, the other worlds are stars
  const farStars = createFarStars(map, { places: FAR_STARS.map((p) => ({ ...p, group: planetOf[p.id]?.group ?? deep.groupOf(p.id) ?? null })), skyFar: SKY_FAR });
  // and the big things, the Maw, the nebulae and the big stars, as landmarks
  // on the sky, at least so big across from anywhere (landmarks.js)
  const landmarks = createLandmarks(map, { renderer, small, level: device().detail, skyFar: SKY_FAR });
  const landmarkGroup = (id) => deep.groupOf(id) ?? (id === 'sun' ? sun.group : null);
  // the aim (aim.js): while flying, the star the nose is on (the way the
  // reticle is from the eye, the ship's nose six units ahead), in this
  // sector, not the place you're at; the page hears when it changes (its
  // Jump button), and J jumps to it
  const aimSight = new THREE.Vector3();
  const aimNose = [0, 0, 0];
  const aimAt = () => {
    const was = state.aim ?? null;
    const s = state.ship;
    let id = null;
    if (s && flying() && !onFoot() && !state.crash && !state.dive && state.view !== 'map' && !props.frozen && !(state.jump && state.jump.phase !== 'align')) {
      const [nx, ny, nz] = noseOf(s);
      aimSight.set(s.x + nx * 6, s.y + ny * 6, s.z + nz * 6).sub(camLocal);
      if (aimSight.lengthSq() > 1e-6) aimSight.normalize().toArray(aimNose);
      const sector = mapSectorOf(s.x, s.y, s.z);
      id = aimFrom([camLocal.x, camLocal.y, camLocal.z], aimNose, aimTargets(sector, state.at), was)?.id ?? null;
    }
    state.aim = id;
    if (id !== was) emit({ type: 'aim', id, name: id ? (destinationById(id)?.name ?? null) : null });
  };
  // whose name shows (aim.js's nameShows): while flying, a place's only
  // where you look (within NAME_CONE of the nose), where it's real, picked
  // or where you're going; on foot, only near or picked; with no ship (or
  // the whole map in view), all
  const named = (id, at) => {
    let noseDot = -1;
    const s = state.ship;
    if (s && at && flying() && !onFoot()) {
      const [nx, ny, nz] = noseOf(s);
      const dx = at[0] - s.x;
      const dy = at[1] - s.y;
      const dz = at[2] - s.z;
      noseDot = (nx * dx + ny * dy + nz * dz) / (Math.hypot(dx, dy, dz) || 1);
    }
    return nameShows({
      k: farStars.kOf(id) ?? landmarks.kOf(id) ?? 1,
      station: byId(id)?.kind === 'core',
      picked: id === state.sel || id === state.aim || id === state.auto?.id || id === state.jump?.id,
      viewAll: (!flying() && !onFoot()) || state.view === 'map',
      onFoot: onFoot(),
      noseDot,
    });
  };
  const near = createNearMaps({ small, upload: (ts) => uploadSlices(renderer, ts, { sliceMB: 8 }) }); // (the finer maps for the two planets nearest, nearMaps.js)
  const crashFx = createCrash(map);
  // out of the ship and on foot on a planet (footScene.js)
  // (a shot's assist cone, aim.js's: the look's mode says a mouse, a drag or a finger)
  const footCone = () => coneFor({ coarse, mode: looker.mode });
  const foot = createFoot({ map, emit: (e) => emit(e), reduced, small, planetOf, renderer, prepare: (roots, alive) => prepareLanding(roots, alive), cone: () => footCone() });
  const onFoot = () => Boolean(foot.phase);
  // the other pilots whose crews are down on a planet now (the scene hands
  // the ones on yours to the foot scene)
  const guestsOnFoot = (now) => {
    const out = [];
    for (const p of net?.peers?.values() ?? []) if (!p.blocked && p.name && p.foot && now - p.foot.at < STALE_MS) out.push({ id: p.id, name: p.name, ally: p.ally === 'ally', foot: p.foot, looks: p.looks ?? null });
    return out;
  };
  // everyone else out here (none with reduced motion), and the pops when a shot hits one
  const fleet = createFleet(); // the ships that are models, shared
  // every ship's engines alight with its throttle, yours, the traffic's and
  // the hunters', as one draw (engines.js)
  const engines = createEngines({ parent: map });
  let heroEngine = null;
  const traffic = reduced ? null : createTraffic(map, { small, fleet, engines });
  const pops = createCrash(map);
  // the camera's shake and the hitstop (lib/three/feel.js): each place that
  // shakes still says its k (state.shake, the most of them), and the feel
  // takes it as trauma, decaying at 1.4 a second as the old shake did and as
  // far (0.09 at 1), position only; a crash and a kill stop the game a moment
  const feel = createFeel({ calm: reduced, offset: 0.09 });
  feel.set({ decay: 1.4, roll: 0 });
  const HITSTOP = { crash: 90, kill: 60 }; // ms
  // a bump (ship.js's force; a rock's below): on the hit law (lib/impact.js)
  // a puff where it touched and a nudge of the camera; its thud is Comms.jsx's
  const bumpLaw = createImpacts();
  const bumped = (force, point, normal) => {
    const r = bumpLaw.hit(force, 'bump');
    if (!r) return;
    if (point) pops.hit({ point, normal, radius: 0.08 + 0.22 * r.gain }); // (a rock's has its own, where it was)
    // (the law's 0.15 at full doesn't show at the chase's distance: the map's own shakes are a rock's 0.9, a laser's 0.3)
    if (!reduced) state.shake = Math.max(state.shake, r.shake * 4);
  };
  // ?debug: the shake and the hitstop, the bumps' law, and on foot the
  // knocks' law and the jump's press, on sliders (lib/debugPanel)
  const titled = (name) => (g) => ({ ...g, name });
  // (the ship's lean, ship.js's spring: shared with the galaxy map, set here for both)
  const leanGroups = () => [{ name: 'lean', items: [['k', 'stiffness', 0, 300, 1], ['c', 'damping', 0, 40, 0.1]].map(([key, label, min, max, step]) => ({ key, label, type: 'range', min, max, step, get: () => LEAN[key], set: (v) => (LEAN[key] = v) })) }];
  const panel = debugOn() ? debugPanel({ title: 'The universe', id: 'universe', groups: [...bloomGroups(post.bloom), ...houseGroups(house), ...feelGroups(feel), ...leanGroups(), ...impactGroups(bumpLaw).map(titled('bumps')), ...foot.tune().map((g) => (g.name === 'hits' ? titled('knocks, on foot')(g) : g))] }) : null;
  // and what's shot down burns: a fireball, shards and (bigger than a
  // fighter) a ring, pooled (lib/three/explosions); just the pop on a weak
  // device, once the quality's been lowered, or from the pace's step 2
  const blasts = createExplosions({ parent: map, small });
  const burn = (at, size, tint = null) => blasts.burst(at, size, tint);
  if (tier === 'low') blasts.setMode('pop');

  // heavy rounds (weapons.js): a glowing slug with a halo and a tail of
  // fire, homing on what the guns had locked when it went
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const missileMat = new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false });
  const missileGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const missileTailMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const missileGeo = new THREE.OctahedronGeometry(0.035, 0).scale(1, 1, 2.6);
  const missileTailGeo = new THREE.ConeGeometry(0.03, 0.5, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.3); // (out behind it, along +z)
  const missiles = Array.from({ length: MISSILES }, () => {
    const m = new THREE.Mesh(missileGeo, missileMat);
    const halo = new THREE.Sprite(missileGlowMat);
    halo.scale.setScalar(0.42);
    const tail = new THREE.Mesh(missileTailGeo, missileTailMat);
    m.add(halo, tail);
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: [0, 0, 0], target: null };
    map.add(m);
    return m;
  });

  // the Citadel's siege (siege.js has the rules, citadelSiege.js draws it):
  // what's left of it is shared with everyone online, and comes back
  const CITADEL = wonderById('citadel');
  const citadelGeo = CITADEL ? citadelGeometry(CITADEL) : null;
  // (your siege id: this page's, or the save's from before a reload, kept with your shares so a reload counts once)
  const SIEGE_KEY = 'tp-citadel-siege';
  const siegeSaves = runtime().saves;
  const siege = createSiege({ id: [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('') });
  siege.load(siegeSaves?.get(SIEGE_KEY, null), Date.now());
  const siegeView = citadelGeo ? createCitadelSiege({ parent: map, model: deep.groupOf('citadel'), geo: citadelGeo, small }) : null;
  const SOLIDS_OPEN = SOLIDS.filter((o) => o.id !== 'citadel' && !o.id.startsWith('citadel-')); // (with it gone, there's nothing there to hit)
  let solidsNow = SOLIDS; // (the frame's, handed to step: the map's and the big ships moving through it, shipHits.js's solidsWith)
  let siegeSt = siege.state();
  let siegeLook = 0; // when siegeSt was last read (for its countdowns)
  let siegeSent = 0; // when your word on it last went out
  let siegeOwed = false; // something of yours to tell, soon
  let siegeMine = false; // you've hit it this life (for the achievement)
  const still3 = new THREE.Vector3();
  const genTargets = citadelGeo ? citadelGeo.gens.map((p, i) => ({ id: `cit:g${i}`, siegePart: i, at: new THREE.Vector3(...p), vel: still3, size: citadelGeo.gen * 1.2, kind: 'generator', name: 'Shield generator', hp: 1, hpMax: 100 })) : [];
  const coreTarget = citadelGeo ? { id: 'cit:core', siegePart: CORE, at: new THREE.Vector3(), vel: still3, size: citadelGeo.core * 0.3, kind: 'citadel', name: 'Citadel core', hp: 1, hpMax: 100 } : null;
  const citadelMid = citadelGeo ? new THREE.Vector3(...citadelGeo.center) : null;
  // what of it the guns can lock on to, from where the ship is: the
  // generators still running, then (with the shield down) the core, at the
  // point of it nearest the ship
  const siegeTargets = (s) => {
    if (!citadelGeo || siegeSt.down) return [];
    const d = apart(s.x, s.y, s.z, citadelMid.x, citadelMid.y, citadelMid.z);
    if (d > SIEGE_NEAR) return [];
    const out = [];
    for (let i = 0; i < GENS; i++) {
      if (siegeSt.gens[i]) continue;
      genTargets[i].hp = Math.max(1, siegeSt.hp[i] * 100);
      out.push(genTargets[i]);
    }
    if (!siegeSt.shield) {
      coreTarget.at.set(s.x - citadelMid.x, s.y - citadelMid.y, s.z - citadelMid.z).setLength(citadelGeo.core).add(citadelMid);
      coreTarget.hp = Math.max(1, siegeSt.core * 100);
      out.push(coreTarget);
    }
    return out;
  };
  const readSiegeState = () => {
    siegeSt = siege.state(Date.now());
    siegeLook = performance.now();
  };
  // shaders made off the main thread before something is first drawn
  // (KHR_parallel_shader_compile), so nothing new stalls a frame: a ship
  // arriving, a loaded model, the cockpit
  // (drawn into the passes' buffer while they're on, so made for it)
  // (one pass for what can be drawn in one, renderer.js's singlePass, first:
  // that's part of the shader made; and for the map, the house look, which
  // house.follow puts on everything in it within half a second: put on
  // after, it made each of these shaders again)
  const warm = (root, cam = camera, target = scene) => {
    if (target === scene) house.adopt(root);
    return precompile(renderer, singlePass(root), cam, target, post.on ? post.composer.readBuffer : undefined);
  };
  fleet.prepare = (o) => warm(o); // (the fleet's models too: none is made before the first frame)
  // a landing (footScene's), readied before it's shown: the look on, its
  // pictures sent and its shaders made, a slice at a time behind the frames
  // (lib/three/gpuWork), all at once rather than a thing at a time
  const prepareLanding = (roots, alive) => {
    for (const root of roots) {
      house.adopt(root);
      singlePass(root);
    }
    return prepareScene({ renderer, roots, scene, camera, target: post.target, sliceMB: 8, alive: () => alive() && !disposed });
  };
  // who comes after you, what the director sets going, and its set pieces
  // (none of it with reduced motion)
  // whose space the ship's in (sides.js sideAt): the Rick and Morty sector's
  // hunters, traffic and goings-on are the Rick and Morty side's, whoever's
  // flying; anywhere else the crew's own
  const sideHere = () => sideAt(state.kind, state.ship ? mapSectorOf(state.ship.x, state.ship.y, state.ship.z) : 'main');
  const FACTIONS_ALL = factionsOf(null);
  // how hard the fight is (the flight setting: difficulty.js), now
  const diff = () => difficultyOf(controls().difficulty);
  const hunters = reduced ? null : createHunters(map, { small, fleet, solids: SOLIDS, factions: FACTIONS_ALL, kinds: kindsOf(null), engines }); // (every side's: another pilot's hunters, whoever they are)
  if (hunters) hunters.difficulty = diff;
  const wingmen = hunters ? createWingmen(map, { fleet, solids: SOLIDS }) : null; // (friends in a long fight)
  const skirmishes = hunters ? createSkirmishes(map, { fleet, solids: SOLIDS }) : null; // (someone else's fight, out ahead)
  const farFights = createFarFights(map); // (and seen from afar, as flickering light: farFights.js)
  const npcMemory = {}; // what each character remembers of you this visit (npcRules.js)
  // your standing with the law, the ordinary ships and the pirates
  // (standing.js): what you've done, remembered across visits, read by the
  // director, the law's inspectors, the merchants, Hondo and the traffic
  const standing = createStanding({ storage: remembered });
  const LAW_NAME = { empire: 'The Empire', federation: 'The Federation', dea: 'The DEA' };
  // a level of it reached: the crew say so, and the HUD notes it (a level
  // lost: nothing said)
  const stood = (e) => {
    if (!e.level) return;
    const side = sideFor(state.kind);
    emit({ type: 'event', id: 'standing', sub: e.level, side: side?.id ?? null }); // (whose: a good level pays, for that universe)
    const who = { law: LAW_NAME[side?.law] ?? 'The law', civil: 'The ordinary ships', outlaw: 'The pirates' }[e.axis];
    const word = { wanted: 'have you marked: wanted', suspect: 'are watching you', trusted: 'trust you', feared: 'fear you', hero: 'call you a hero', friend: 'call you a friend' }[e.level];
    if (word) state.note = { text: `${who} ${word}`, until: wall() + 5 };
  };
  // something worth paying for (economy.js's EARN): the page earns it into
  // the wallet, for the universe you're in
  const pay = (what, n = 1) => {
    if (what) emit({ type: 'earn', what, n, side: sideHere()?.id ?? null });
  };
  // something you did: noted, and if it changed what you are, said; and
  // paid for, if it pays (`as`: what it pays as, when it's more than the
  // deed says, an ace for a hunter)
  const deed = (what, n = 1, as = deedToEarn(what)) => {
    for (const e of standing.note(what, n)) stood(e);
    pay(as, n);
    law?.crime(what, state.ship); // (and a crime, if it's one: wanted.js)
  };
  // the law's chase (wanted.js, law.js): stars and a price on your head,
  // the side's police sent by stars, bounty hunters by the bounty, paid off
  // out of the wallet where you land
  const wanted = createWanted({ storage: remembered });
  const lawSaid = (e) => wantedNote(e);
  const law = hunters
    ? createLaw({
        wanted,
        hunters,
        traffic,
        side: () => sideFor(state.kind),
        difficulty: diff,
        bounty: (tier, ship) => {
          happen('bounty', ship);
          if (tier >= 2) hunters.pack(pickFaction(sideFor(state.kind), 'bounty'), ship, { size: 1, ace: false });
        },
        say: lawSaid,
      })
    : null;
  // what the law's doing, on the HUD's note and from the crew (Comms: an
  // event, by what happened)
  const STAR = '★';
  const wantedNote = (e) => {
    const note = (text, s = 4) => (state.note = { text, until: wall() + s });
    if (e.type === 'wanted' && e.stars > e.was) {
      note(`Wanted ${STAR.repeat(e.stars)}: ${wanted.bounty} ¢ on your head`);
      emit({ type: 'event', id: 'wanted', sub: e.stars });
    } else if (e.type === 'witness') note('A witness is running to the law: stop them, or get clear');
    else if (e.type === 'silenced') note('No witnesses left', 2.5);
    else if (e.type === 'search') {
      note('Out of sight: they’re searching for you');
      emit({ type: 'event', id: 'wanted', sub: 'search' });
    } else if (e.type === 'resighted') note('Spotted again', 2.5);
    else if (e.type === 'lost') {
      note(wanted.bounty ? `You lost them. The bounty stands: ${wanted.bounty} ¢` : 'You lost them');
      emit({ type: 'event', id: 'wanted', sub: 'lost' });
    } else if (e.type === 'cops' && e.stars >= 3) note(`Police inbound ${STAR.repeat(e.stars)}: they’ll hold your drive down`, 3);
    else if (e.type === 'hunter') note(e.tier >= 3 ? 'The price on your head has every hunter out' : 'A bounty hunter has come for your bounty', 3.5);
    else if (e.type === 'paid') note(`Bounty paid off: −${e.amount} ¢`);
    else if (e.type === 'owed') note(`A ${e.bounty} ¢ bounty on you: ${e.need} ¢ more to pay it off`, 4);
  };
  const npcs = hunters ? createNpcs(map, { fleet, memory: npcMemory }) : null; // (the named characters: npcRules.js's brains)
  // the crew's war (front.js): its front out in deep space, a battle there
  // to fly into (the Star Wars crews' war is fought in the galaxy far, far
  // away instead: galaxy/gcw.js; Rick and Morty's and Breaking Bad's are here). Made for the crew's side, again if the crew changes; its
  // ships are the galaxy's models (galaxy/models.js), loaded once the
  // front's in sight. Not with reduced motion (nor are the hunters)
  let front = null;
  let frontSide = null;
  let battleModels = null;
  // the Rick and Morty sector's standing ships: the Federation's fleet and
  // the Council's patrol, in the war's own models (sectorFleet.js)
  const sectorFleet = createSectorFleet(map, () => (battleModels ??= createBattleModels({ prepare: (o) => warm(o) })));
  const frontFor = () => {
    if (reduced) return null;
    const side = sideFor(state.kind);
    if ((side?.id ?? null) === frontSide) return front;
    front?.dispose();
    frontSide = side?.id ?? null;
    battleModels ??= createBattleModels({ prepare: (o) => warm(o) });
    let store = null;
    try {
      store = window.localStorage;
    } catch {
      // (storage blocked: the war is this visit's alone)
    }
    front = createFront(map, { side, beacons: BEACONS, models: battleModels, small, tier, reduced, storage: store, emit });
    return front;
  };
  renderer.localClippingEnabled = true; // (the broken flagship's halves are cut by planes)
  let hunts = 0; // packs the director has sent this visit (the first is a small one)
  const SPOTTED_EVERY = 60; // seconds between the law's patrols reporting you (traffic.js's spotted)
  let spottedAt = -1e9;
  const director = createDirector();
  const pieces = createSetPieces(map, { small, fleet });
  // the Federation's NX-5 Planet Remover, Rick's universe's (remover.js has
  // the rules, removerView.js draws it): one at a time, and the planets it's
  // removed (planet id → the clock it's back at)
  const removerView = createRemoverView(map, { small });
  let remover = null;
  const removed = {};
  const removerTarget = { id: 'nx5', at: new THREE.Vector3(), vel: new THREE.Vector3(), size: NX5_LEN * 0.12, kind: 'capital', name: 'NX-5 Planet Remover', hp: 100, hpMax: 100 };
  // what of it the guns can lock on to: its cannon, while it's charging
  const removerTargets = (s) => {
    if (!remover || (remover.phase !== 'arriving' && remover.phase !== 'charging')) return [];
    const bow = removerView.bow;
    if (apart(s.x, s.y, s.z, bow.x, bow.y, bow.z) > 900) return [];
    removerTarget.at.copy(bow);
    removerTarget.hp = Math.max(1, (hpLeft(remover) / REMOVER.hp) * 100);
    return [removerTarget];
  };
  const leviathans = createLeviathans(map, { small }); // (purrgil, or a Cromulon)
  const meteors = createMeteors(map, { small, tier }); // (a stream of rocks across your path)
  const mines = createMines(map, { small }); // (a minefield across your way)
  // a ship you're seeing to the next place (escort.js): { plan, run (traffic's), t0, sent, hull, side }
  let escort = null;
  // an eclipse (eclipse.js): { plan, t0, star }, its moon (made when first
  // wanted), how much of the sun it hides now (the key light and its glare
  // dim by it), and the moon as something that hides a star from the lens
  let eclipse = null;
  let eclipseMoon = null;
  let eclipseK = 0;
  const eclipseSolid = { id: 'eclipse', at: [0, 0, 0], r: 0 };
  const eclipseEye = new THREE.Vector3();
  const dropEclipse = () => {
    eclipse = null;
    eclipseK = 0;
    eclipseSolid.r = 0;
    if (eclipseMoon) eclipseMoon.visible = false;
  };
  const dropEscort = () => {
    escort = null;
  };
  let leviathanSaidAt = -1e9; // the crew's last word about shooting one
  const later = []; // { at, run }: what the director set going, a moment on
  // the other pilots, once online (with reduced motion too: they're people)
  const pilots = createPilots(map, { T, colors: BOLT_COLOR, fleet: reduced ? null : fleet, kinds: HUNTER_KINDS });
  // every other small ship, to fly into (shipHits.js; `front` is made later, read when swept)
  const shipHits = createShipHits({ sources: [() => hunters?.bodies, () => wingmen?.bodies, () => skirmishes?.active && skirmishes.bodies, () => npcs?.count && npcs.bodies, () => pilots.bodies, () => traffic?.bodies(state.ship, 6 + wayNow), () => front?.bodies] });
  let wayNow = 0; // (how far the ship went this frame: a long frame's traffic is looked for along all of it)
  let rammedDownAt = -Infinity; // (a ram's last kill: the pack cleared by it gets the crew's ram line)
  const pilotRammedAt = new Map(); // (another pilot's id → when you last rammed them: shot down by it, said as a ram)
  let net = null;
  let netOff = null;

  // the models arrive after the map is up (their shaders made first, off
  // the main thread, so one coming into view doesn't stall a frame)
  // (`modelsIn`: all of them mounted, for prepare() to wait on)
  const modelsIn = loadModels((id, model, spot) => {
    if (disposed) {
      disposeTree(model);
      return null;
    }
    return warm(model).then(() => {
      if (disposed || !planetOf[id]?.mount(model, spot)) disposeTree(model);
      ctx.invalidate();
    });
  });

  const size = { w: 1, h: 1 };
  const state = {
    armed: false, // the guns used at least once (the readout waits for it)
    through: null, // a gate flown into (galaxy/gateway.js): the page's taking you through
    yaw: 0,
    vel: 0, // radians per ms, after a flick
    sel: props.selected ?? null,
    then: null, // a trip on from the far side of a portal: { id, drive, name } (travel, portalThrough; name: a pilot's, flown to)
    hover: null,
    drag: null,
    flight: null,
    blend: null, // flying, the camera's way from one view to the next: { from, start, dur }
    cam: null, // the view the camera had last frame (in the map's own frame: viewOfPose)
    dive: null,
    low: false,
    rect: cover({ w: 1, h: 1 }),
    overview: null,
    pose: null,
    tLow: 0, // where the orbits stopped when quality went down
    yawTo: null, // where the map is turning to bring the picked place round to the front
    // flying
    kind: null, // the ship picked
    ship: null, // ship.js's numbers
    model: null,
    seat: remembered.get(SEAT_KEY) === 'cockpit' ? 'cockpit' : 'chase', // where you ride: behind the ship, or in its cockpit
    view: 'chase', // the seat, or 'map' (the whole map, keeping the ship)
    cabK: 0, // how far into the cockpit view the camera is, 0 to 1, eased
    fovBase: FOV, // the lens, eased between the chase's and the cockpit's
    auto: null, // { id, park, od } while it flies itself somewhere (od: super speed's overdrive, 1 cruising); to another pilot, also { pilot (their id), name, drive, space, reaimAt } (pilotGoal.js)
    hotSaid: null, // the planet whose air it's going through too fast to land, said so on the HUD
    jump: null, // { id, park, at }: a jump to lightspeed under way (out at the place at `at`, wall()'s seconds)
    hyperAt: null, // when it last jumped, wall()'s seconds (the hyperdrive charges again: nav.js)
    odSaid: false, // the crew's said their piece about super speed
    note: null, // { text, until }: a word on the HUD a moment (why a jump didn't happen)
    at: null, // the universe it's at
    keys: {},
    stick: null, // { id, x, y, dx, dy, on }
    boostBtn: false,
    climbBtn: 0, // the phone's nose-up (1) or nose-down (−1) button, held
    fireBtn: false, // the phone's fire button, held
    boosting: false,
    boosts: 0,
    streak: 0,
    flown: false, // has anyone touched the controls yet
    shown: true,
    lastInput: performance.now(),
    idleSaid: false,
    side: 1, // which wing the X-wing fires from next
    barrel: 0, // and which of the fitted guns' barrels
    loadout: STOCK_LOADOUT, // what's fitted in the hangar (outfit.js)
    build: null, // the garage build flown in place of the stock hull (shipyard/), or null
    stats: statsOf(null, STOCK_LOADOUT), // and what it does
    lastShot: 0,
    crash: null, // { age, id, … } while a crash plays out (startCrash)
    shake: 0,
    kick: 0, // the lens's kick as a boost lights, 1 fading to 0
    clock: 0, // seconds of frames
    shield: 100, // the ship's shields: hunters' lasers take them down, and they come back
    hitAt: -1e9,
    safeUntil: -1e9, // just back from being shot down or a crash: other pilots' hits don't count
    hurt: 0, // the red flash of a hit, 1 fading to 0
    static: 0, // seconds of the HUD scrambling (a flare's shockwave, a spotlight)
    spotSaid: -Infinity, // when the crew last said so about a spotlight
    lowSaid: false,
    heat: 0, // trouble made lately (ships shot down): the director sends more hunters
    huntFor: 0, // seconds the hunters have been after you, this time
    wingAsked: false, // whether a wing's been asked for, this hunt
    skirmishAt: 50 + Math.random() * 40, // when the next skirmish may be (state.clock)
    npcAt: 70 + Math.random() * 50, // when the next character may come by (state.clock)
    npcLast: null, // who came by last (someone else next time)
    skirmishHelped: 0, // hunters you've hit in this one
    saw: new Set(), // the wonders out in deep space you've come up on, and the places you've been
    // the hunters you've helped another pilot with (owner:hunter), paid
    // once each: down is only our guess, and a ghost of one can come back
    // and go down again
    helped: createPayLedger(),
    phoneNear: false, // at the phone out past the belt (phone.js)
    phoneIn: false, // flown right into it (it asks once, until you back off)
    deepSaid: false,
    trench: 0, // seconds down in the Death Star's trench
    trenchAt: -1e9,
    interdicted: false, // hunters have the pulse drive held down
    interdictAt: -1e9,
    flare: 1,
    // the guns (targeting.js)
    lock: null, // { id, out }: the hunter they're locked on to
    lockTarget: null, // and what it is this frame: { id, at, vel, size, kind }
    held: null, // (development: one of poses.js's fixed poses, the ship and the map held still to be measured; its camera's view, or null for the whole map)
    lead: null, // where to shoot to hit it: { x, y, z, t }
    hot: false, // the nose is near enough the lead that a shot bends onto it
    cycle: 0, // T was pressed: on to the next target (1), or Shift+T, back one (−1)
    hitMark: 0, // the reticle's flash as a shot lands, 1 fading to 0
    bias: [0, 0, 0], // the camera's lean toward the lock, eased (the map's own frame)
    pull: 0, // how hard the Maw has you (maw.js), 0 … 1
    pullSaid: false,
    camFrom: null, // { pos, quat, start, dur }: the camera easing over from where it was (onto your feet, or back behind the ship)
    landable: null, // the planet you could land on and step out onto, where you are
    landableFor: 0, // (how long it's been that: seconds)
  };
  const t0 = performance.now();
  let engine = null;
  let well = null; // the Maw's hum, while it has you
  let roar = null; // the air roaring past, on the way in (sounds.js's entrySound)
  const quietRoar = () => {
    roar?.stop();
    roar = null;
  };
  let infall = null; // the fall into it, drawn

  // The open part of the canvas: the panel covers the right side on a
  // desktop and the bottom on a phone (or, put away, a corner or a slim
  // bar), the nav the top.
  const panelEl = () => ctx.el.closest('.universe-page')?.querySelector('.universe-panel');
  const measure = () => {
    const box = ctx.el.getBoundingClientRect();
    const panel = panelEl()?.getBoundingClientRect();
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    let side = 0;
    let sheet = 0;
    if (panel && panel.width > 0) {
      // put away on a desktop, it's a bar up in the corner: the map has the width
      if (panel.width >= box.width * 0.75) sheet = Math.max(0, box.bottom - panel.top);
      else if (!panelEl().hasAttribute('data-tucked')) side = Math.max(0, box.right - panel.left);
    }
    state.rect = cover({ w: size.w, h: size.h, panel: side, sheet, top: Math.max(0, nav - box.top) });
    state.overview = overviewPose(size, state.rect);
    camera.aspect = size.w / size.h;
    camera.setViewOffset(size.w, size.h, -state.rect.sx, -state.rect.sy, size.w, size.h);
    camera.updateProjectionMatrix();
  };
  // the panel changes height on a phone (the sheet) without the canvas resizing
  const panelRO = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => size.w > 1 && (measure(), ctx.invalidate())) : null;
  const watchPanel = () => {
    panelRO?.disconnect();
    const el = panelEl();
    if (el) panelRO?.observe(el);
  };
  watchPanel();

  // A point in the map's own frame, in the turned one (the map's turn,
  // `yaw`, is applied to the planets, not the camera)
  const rotate = (x, z) => {
    const c = Math.cos(state.yaw);
    const s = Math.sin(state.yaw);
    return [x * c + z * s, -x * s + z * c];
  };

  // Flying, the camera works in views: { target, quat, dist } in the map's
  // own frame (so the map turning under it doesn't move it), the camera
  // `dist` back from `target` along the way `quat` looks. It rides with the
  // ship's own way round, rolls and all (`camQ`: easing after the ship, so
  // it swings round after it through a turn, a loop or a roll), and goes
  // from one view to the next (behind the ship, the cockpit, the whole map,
  // a crash) by easing the target, the distance and the way it looks
  // together, so it never flips over the top of a loop.
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const yawQ = new THREE.Quaternion();
  const lookM = new THREE.Matrix4();
  const shipQ = new THREE.Quaternion();
  const headQ = new THREE.Quaternion();
  const shipEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const camQ = new THREE.Quaternion();
  let camQOn = false; // (off: it's put straight onto the ship's, next frame)
  const TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.21); // looking down at the ship a little
  const leanQ = new THREE.Quaternion();
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const camF = new THREE.Vector3();
  const camU = new THREE.Vector3();
  const camR = new THREE.Vector3();
  const camP = new THREE.Vector3();
  const orientOf = (s, q) => q.setFromEuler(shipEuler.set(s.pitch || 0, s.heading, -(s.bank || 0), 'YXZ'));

  // a pose (flight.js's, in the turned frame) as a view
  const viewOfPose = (pose) => {
    const { position, target } = cameraFrom(pose);
    const t = new THREE.Vector3(...target);
    const quat = new THREE.Quaternion().setFromRotationMatrix(lookM.lookAt(camP.set(...position), t, Y_AXIS));
    yawQ.setFromAxisAngle(Y_AXIS, -state.yaw);
    return { target: t.applyQuaternion(yawQ), quat: quat.premultiply(yawQ), dist: pose.dist };
  };
  // and a view as near a pose as there is (for the things that start from
  // one: the dive into a planet, landing back on the overview)
  const poseOfView = (v) => {
    yawQ.setFromAxisAngle(Y_AXIS, state.yaw);
    const t = v.target.clone().applyQuaternion(yawQ);
    camF.set(0, 0, -1).applyQuaternion(v.quat).applyQuaternion(yawQ);
    return { target: t.toArray(), dist: v.dist, pitch: Math.asin(clamp(-camF.y, -0.999, 0.999)) };
  };
  const blendView = (a, b, k) => ({
    target: a.target.clone().lerp(b.target, k),
    quat: a.quat.clone().slerp(b.quat, k),
    dist: Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * k),
  });
  const applyView = (v) => {
    yawQ.setFromAxisAngle(Y_AXIS, state.yaw);
    camera.quaternion.copy(v.quat).premultiply(yawQ);
    camera.position.copy(v.target).applyQuaternion(yawQ).addScaledVector(camF.set(0, 0, -1).applyQuaternion(camera.quaternion), -v.dist);
    camera.updateMatrixWorld();
    lens(clamp(v.dist * 0.02, 0.06, 6)); // (close in behind the ship, further out the further off the view)
  };

  // The camera's own way round eases after the ship's (quickly in the
  // cockpit, where it's your head; as the settings say behind it). The map
  // turns with the way it looks, as far as it looks along the disc (so the
  // light stays where it was on the screen, and the whole map comes up the
  // way the ship was going)
  const follow = (dt) => {
    const s = state.ship;
    orientOf(s, shipQ);
    if (!camQOn || reduced) camQ.copy(shipQ);
    else camQ.slerp(shipQ, 1 - Math.exp(-dt * (state.view === 'cockpit' ? 20 : 4.5 * controls().camera)));
    camQOn = true;
    if (state.view === 'map' || (state.crash && !state.crash.back)) return;
    camF.set(0, 0, -1).applyQuaternion(camQ);
    const level = camF.x * camF.x + camF.z * camF.z;
    if (level > 1e-6) state.yaw += wrap(-Math.atan2(-camF.x, -camF.z) - state.yaw) * (1 - Math.exp(-dt * 8 * level));
  };

  // Behind the ship and a little above it (above as the ship sees it:
  // upside down, the camera's upside down too), looking past it the way it
  // points, further back the faster it goes; sliding out the way it leans
  // into a turn, so you see where it's going, and leaning a little toward
  // whatever the guns are locked on
  const chaseView = () => {
    const s = state.ship;
    camF.set(0, 0, -1).applyQuaternion(camQ);
    camU.set(0, 1, 0).applyQuaternion(camQ);
    camR.set(1, 0, 0).applyQuaternion(camQ);
    const [bx, by, bz] = state.bias;
    const target = new THREE.Vector3(s.x + bx, s.y + by, s.z + bz)
      .addScaledVector(camF, CHASE.ahead)
      .addScaledVector(camU, CHASE.up)
      .addScaledVector(camR, (s.lean || 0) * 0.45);
    return { target, quat: camQ.clone().multiply(TILT), dist: chaseDist({ speed: s.speed, boost: SHIP.boost, streak: state.streak }) };
  };

  // From the pilot's seat: the eye a little ahead of the ship's middle and
  // above it, looking along the nose, the horizon tilting a little more with
  // the lean of a turn
  const cockpitView = () => {
    const s = state.ship;
    const quat = camQ.clone().multiply(leanQ.setFromAxisAngle(Z_AXIS, -(s.lean || 0) * 0.85));
    const eye = new THREE.Vector3(0, EYE.up, -EYE.ahead).applyQuaternion(camQ).add(camP.set(s.x, s.y, s.z));
    return { target: eye.addScaledVector(camF.set(0, 0, -1).applyQuaternion(quat), 1), quat, dist: 1 };
  };
  const cabFov = () => {
    const a = size.w / size.h;
    const vf = (2 * Math.atan(Math.tan((CAB_HFOV * Math.PI) / 360) / a) * 180) / Math.PI;
    return clamp(vf, CAB_VFOV[0], CAB_VFOV[1]);
  };

  const flying = () => Boolean(state.ship);
  // the whole map: the home system; out in deep space, the view pulls back
  // over the ship far enough to take in the sun (the way home) and the
  // places round it
  const mapPose = () => {
    const s = state.ship;
    const r = s ? Math.hypot(s.x, s.z) : 0;
    if (!state.overview || r < DEEP.system) return state.overview;
    const [wx, wz] = rotate(s.x * 0.55, s.z * 0.55);
    return { target: [wx, s.y * 0.5, wz], dist: clamp(r * 1.25, 700 * HOME_SPREAD, 7000), pitch: 0.62 };
  };
  // the turn of the map that brings a place round to the front, nearest the
  // camera, with nothing between (the rest of the ring to its sides); a
  // station comes round a little past the front, so the sun in the middle
  // sits off to the left of it rather than right behind
  const frontYaw = (id) => {
    const [x, , z] = POSITIONS[id];
    const u = byId(id);
    // (a world: round so its sun's behind the camera, and it's seen lit, not
    // as a black disc; lighting.js)
    const a = u.kind !== 'core' && !u.portal ? dayYaw(sunInMap[id]) : Math.atan2(z, x) - Math.PI / 2 + (u.kind === 'core' ? 0.62 : 0);
    return state.yaw + Math.atan2(Math.sin(a - state.yaw), Math.cos(a - state.yaw));
  };

  // where the camera's going: with no ship, a pose (flight.js); flying, a view
  const goal = () => (state.sel ? focusPose(state.sel, state.yaw, size, state.rect) : state.overview);
  const flightView = () => {
    if (state.held?.view) return state.held.view;
    const whole = state.view === 'map' ? mapPose() : null;
    if (whole) return viewOfPose(whole);
    if (state.crash && !state.crash.back) return viewOfPose(crashPose());
    return state.view === 'cockpit' ? cockpitView() : chaseView();
  };

  const apply = (pose) => {
    const { position, target } = cameraFrom(pose);
    camera.position.set(...position);
    camera.lookAt(target[0], target[1], target[2]);
    camera.updateMatrixWorld();
    // the near plane: close in behind the ship (or the cockpit), further out
    // the further off the view is (so the depth holds up across the map)
    lens(flying() && state.view !== 'map' ? 0.06 : clamp(pose.dist * 0.02, 0.08, 6));
  };
  // Drawn round the camera, far out: what goes to the graphics chip goes in
  // 32-bit floats, a few thousandths of a unit apart at the Rick and Morty
  // sector, 40000 off (layout.js's SECTORS), and the figures' bones and the
  // shaders' world positions shake and tear there. So for the drawing only,
  // past a few thousand out, the camera's put at the middle and the map
  // moved round it; both are put back after, for the names, the picks and
  // the next frame, which all go by the map as it is.
  const DRAW_FAR = 3000;
  const drawn = (draw) => {
    if (camera.position.lengthSq() < DRAW_FAR * DRAW_FAR) return draw();
    drawAt.copy(camera.position);
    map.position.sub(drawAt);
    camera.position.sub(drawAt);
    try {
      draw();
    } finally {
      map.position.add(drawAt);
      camera.position.add(drawAt);
      scene.updateMatrixWorld();
    }
  };
  const lens = (near) => {
    if (Math.abs(camera.near - near) < near * 0.02) return;
    camera.near = near;
    camera.updateProjectionMatrix();
  };
  // how far the camera draws: out to deep space's far side, but on foot
  // under a full day's sky only as far as the sky (footScene's far(): it
  // hides the rest of the universe), so nothing past it is drawn, nor any
  // place's own motion worked out there (it's out of view)
  const FAR = camera.far;
  const reach = (far) => {
    if (camera.far === far) return;
    camera.far = far;
    camera.updateProjectionMatrix();
  };

  // ── Where each planet is on screen: for the names and for picking ──
  const screen = planets.map((p) => ({ id: p.id, x: 0, y: 0, r: 0, z: -1 }));
  // and each of deep space's wonders (its reach, as a radius in px), for
  // picking one to fly to
  const wscreen = WONDERS.map((wd) => ({ id: wd.id, x: 0, y: 0, r: 0, z: -1 }));
  const hudPoint = new THREE.Vector3();
  const hudDepth = new THREE.Vector3();
  // a point in the map's space, on the canvas: x, y in px and z its depth in
  // front of the camera (behind it, the projection is mirrored)
  const toScreen = (x, y, z, out) => {
    map.localToWorld(hudPoint.set(x, y, z));
    out.z = -hudDepth.copy(hudPoint).applyMatrix4(camera.matrixWorldInverse).z;
    hudPoint.project(camera);
    out.x = ((hudPoint.x + 1) / 2) * size.w;
    out.y = ((1 - hudPoint.y) / 2) * size.h;
    return out;
  };
  // the stations' signs on screen, as boxes: { id, x0, y0, x1, y1, z }
  const signs = planets.filter((p) => p.sign).map((p) => ({ id: p.id, p, x0: 0, y0: 0, x1: 0, y1: 0, z: -1 }));
  const corner = new THREE.Vector3();
  const CORNERS = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const shown = new Map(); // what each name element was last given
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  let tanHalf = Math.tan((FOV * Math.PI) / 360); // follows the lens (it widens boosting)
  // what's in view, for which places' own motion is worth working out
  const viewFrustum = new THREE.Frustum();
  const viewProj = new THREE.Matrix4();
  const placeBound = new THREE.Sphere();

  const locate = () => {
    planets.forEach((p, i) => {
      const s = screen[i];
      p.group.getWorldPosition(v);
      const z = -w.copy(v).applyMatrix4(camera.matrixWorldInverse).z;
      v.project(camera);
      s.x = ((v.x + 1) / 2) * size.w;
      s.y = ((1 - v.y) / 2) * size.h;
      s.z = z;
      s.r = z > 0 ? (p.radius / (z * tanHalf)) * (size.h / 2) : 0;
    });
    if (flying()) {
      WONDERS.forEach((wd, i) => {
        const s = toScreen(wd.at[0], wd.at[1], wd.at[2], wscreen[i]);
        s.r = s.z > 0 ? (reachOf(wd) / (s.z * tanHalf)) * (size.h / 2) : 0;
      });
    }
    for (const g of signs) {
      const m = g.p.sign;
      const [sw, sh] = m.userData.size;
      g.x0 = g.y0 = Infinity;
      g.x1 = g.y1 = -Infinity;
      m.getWorldPosition(w);
      g.z = -w.applyMatrix4(camera.matrixWorldInverse).z;
      for (const [cx, cy] of CORNERS) {
        corner.set((cx * sw) / 2, (cy * sh) / 2, 0);
        m.localToWorld(corner).project(camera);
        const px = ((corner.x + 1) / 2) * size.w;
        const py = ((1 - corner.y) / 2) * size.h;
        g.x0 = Math.min(g.x0, px);
        g.x1 = Math.max(g.x1, px);
        g.y0 = Math.min(g.y0, py);
        g.y1 = Math.max(g.y1, py);
      }
    }
  };

  // on foot: a place below the horizon (behind the ground you stand on) has no name showing
  const underground = (id) => {
    const h = foot.horizon();
    if (!h) return false;
    const [x, y, z] = POSITIONS[id];
    const dx = x - h.at.x;
    const dy = y - h.at.y;
    const dz = z - h.at.z;
    return (dx * h.up.x + dy * h.up.y + dz * h.up.z) / (Math.hypot(dx, dy, dz) || 1) < -0.03;
  };
  const placeLabels = () => {
    const els = props.labels?.current;
    if (!els) return;
    const entering = onFoot() && Boolean(foot.entry()); // (once, not for every name)
    // (the sector the ship's in: the other sector's places, tens of thousands off, have no name here)
    const sector = state.ship ? mapSectorOf(state.ship.x, state.ship.y, state.ship.z) : 'main';
    for (const s of screen) {
      const el = els[s.id];
      if (!el) continue;
      // (none while the ship falls into the Maw: nothing to pick, and the
      // camera's going in; nor, on foot, the planet you're on or anything
      // below its horizon, nor anything on the way in through its air)
      const off = Boolean(state.crash?.swallow) || SECTOR_OF[s.id] !== sector || !named(s.id, POSITIONS[s.id]) || s.z <= 0.3 || s.x < -60 || s.x > size.w + 60 || s.y < -60 || s.y > size.h + 60 || entering || (onFoot() && (s.id === foot.id || underground(s.id)));
      // tucked behind a nearer planet, or a station's sign
      const ly = s.y + s.r + 10;
      let behind = false;
      // (plain loops and squares: this runs for every name, every frame)
      for (let i = 0; i < screen.length && !behind; i++) {
        const o = screen[i];
        const dx = o.x - s.x;
        const dy = o.y - s.y;
        behind = o !== s && o.z > 0 && o.z < s.z && dx * dx + dy * dy < o.r * o.r * 0.81;
      }
      for (let i = 0; i < signs.length && !behind; i++) {
        const g = signs[i];
        behind = g.id !== s.id && g.z > 0 && g.z < s.z && s.x > g.x0 && s.x < g.x1 && ly > g.y0 && ly < g.y1;
      }
      const tf = off ? '' : `translate3d(${s.x.toFixed(1)}px, ${(s.y + s.r + 4).toFixed(1)}px, 0)`;
      const was = shown.get(el);
      const flag = `${off ? 'off' : ''}${behind ? 'behind' : ''}`;
      if (was && was.tf === tf && was.flag === flag) continue;
      shown.set(el, { tf, flag });
      if (tf) el.style.transform = tf;
      el.toggleAttribute('data-off', off);
      el.toggleAttribute('data-behind', behind && !off);
    }
  };

  // the nearest sign under the point, if any
  const pickSign = (px, py) => {
    let best = null;
    for (const g of signs) if (g.z > 0.3 && px >= g.x0 && px <= g.x1 && py >= g.y0 && py <= g.y1 && (!best || g.z < best.z)) best = g;
    return best?.id ?? null;
  };
  let signHover = null;
  const setSignHover = (id) => {
    if (id === signHover) return;
    if (signHover) planetOf[signHover].setSignHover(false);
    signHover = id;
    if (id) planetOf[id].setSignHover(true);
    ctx.invalidate();
  };

  const pick = (px, py) => {
    let best = null;
    for (const s of screen) {
      if (s.z <= 0) continue;
      if (Math.hypot(px - s.x, py - s.y) <= Math.max(s.r * 1.3, 18) && (!best || s.z < best.z)) best = s;
    }
    return best?.id ?? null;
  };
  // a wonder out in deep space under the point (while flying: somewhere to
  // go), the nearest first; a big one close by only round its middle
  const pickWonder = (px, py) => {
    if (!flying()) return null;
    let best = null;
    for (const s of wscreen) if (s.z > 0.3 && Math.hypot(px - s.x, py - s.y) <= Math.max(Math.min(s.r, 160), 24) && (!best || s.z < best.z)) best = s;
    return best?.id ?? null;
  };
  // the phone under the point: flying or looking at the whole map (its
  // height on screen, from its middle and its top)
  const phoneAt = { x: 0, y: 0, z: 0 };
  const phoneTop = { x: 0, y: 0, z: 0 };
  const pickPhone = (px, py) => {
    if (onFoot()) return false;
    const p = phone.group.position;
    toScreen(p.x, p.y, p.z, phoneAt);
    if (phoneAt.z <= 0.3) return false;
    toScreen(p.x, p.y + phone.radius, p.z, phoneTop);
    const r = Math.hypot(phoneTop.x - phoneAt.x, phoneTop.y - phoneAt.y);
    return Math.hypot(px - phoneAt.x, py - phoneAt.y) <= Math.max(r, 22);
  };
  // a hunter under the point, or near it (they're small and quick): a tap
  // locks the guns on to the nearest
  const tapped = { x: 0, y: 0, z: 0 };
  const pickHunter = (px, py) => {
    if (!flying()) return null;
    let best = null;
    for (const c of [...(hunters?.targets ?? []), ...pilots.targets]) {
      toScreen(c.at.x, c.at.y, c.at.z, tapped);
      const d = Math.hypot(px - tapped.x, py - tapped.y);
      if (tapped.z > 0.3 && d <= 48 && (!best || d < best.d)) best = { id: c.id, d };
    }
    return best?.id ?? null;
  };

  // a trooper under the point, on foot (a click shoots at it)
  const pickTrooper = (px, py) => {
    const info = foot.info();
    let best = null;
    for (const c of info?.troops ?? []) {
      toScreen(c.at.x, c.at.y, c.at.z, tapped);
      if (tapped.z > 0.01 && Math.hypot(px - tapped.x, py - tapped.y) <= 34 && (!best || tapped.z < best.z)) best = { id: c.id, z: tapped.z };
    }
    return best?.id ?? null;
  };

  const paintStates = () => {
    for (const p of planets) p.setState({ hover: state.hover === p.id, selected: state.sel === p.id, dim: Boolean(state.sel) && state.sel !== p.id });
    const els = props.labels?.current;
    if (els) for (const [id, el] of Object.entries(els)) el?.toggleAttribute('data-hover', state.hover === id);
  };

  const setHover = (id) => {
    if (id === state.hover) return;
    state.hover = id;
    paintStates();
    ctx.invalidate();
  };

  const emit = (e) => {
    if (e.type === 'kill') feel.hitstop(HITSTOP.kill); // (yours: a hunter, a pilot, a ship of the traffic)
    props.onEvent?.(e);
  };

  // the camera eases from wherever it is to wherever it's going next
  const retarget = (dur) => {
    if (flying()) {
      state.flight = null;
      state.blend = reduced || !state.cam || !dur ? null : { from: state.cam, start: performance.now(), dur };
      return;
    }
    state.flight = reduced || !state.pose ? null : startFlight(state.pose, performance.now(), dur);
  };

  const select = (id) => {
    if (id === state.sel) return;
    state.sel = id;
    if (onFoot()) {
      // (on foot, the panel just shows it: there's no flying off from here)
    } else if (flying()) {
      // the ship takes you there, by the drive picked (or, with reduced
      // motion, is simply there); unless it's on its way there already
      if (id && id !== state.at) {
        if (state.auto?.id !== id && state.jump?.id !== id) travel(id);
      } else if (!id && isPlace(state.auto?.id)) dropAuto(); // (a trip out to a wonder isn't the page's to stop)
    } else {
      state.yawTo = id ? frontYaw(id) : null;
      state.vel = 0;
      if (reduced && id) state.yaw = state.yawTo;
      retarget();
    }
    paintStates();
    ctx.invalidate();
  };

  // Off to a place (a station, a world or a wonder out in deep space), by
  // `drive` (nav.js's: the one picked on the nav map, unless it says):
  // hyperspeed jumps (once the hyperdrive's charged, and not while hunters
  // have it interdicted: then it goes on super speed instead, and says why),
  // super speed and cruising fly it there on the autopilot. With reduced
  // motion it's simply there. (A planet picked by the page comes through
  // select(), with its URL; a wonder clicked on the map comes straight here.)
  // False when it can't go: no ship, on foot, mid-crash or mid-jump.
  // (a jump keeps to the wall clock, not the frames': the site's jump plays
  // over the page in real time, and the ship has to be out under its flash
  // however slowly the frames come)
  const wall = () => performance.now() / 1000;
  // the autopilot's trip dropped before it's done (the pilot, a rift, the
  // page): the page hears, so a tour or a trip on through the gate ends
  const dropAuto = () => {
    state.then = null; // (and a trip on through a portal with it)
    if (!state.auto) return;
    const id = state.auto.id;
    state.auto = null;
    emit({ type: 'arrived', id, done: false });
  };
  const travel = (id, drive = props.drive) => {
    const s = state.ship;
    // (another pilot, `pilot:<id>`, is somewhere to go while they're flying
    // here in sight: pilots.js's pose, and pilotGoal.js)
    const pid = pilotId(id);
    const pose = pid ? pilots.pose(pid) : null;
    if (!s || state.crash || state.dive || state.jump || props.frozen || onFoot() || !(isGoal(id) || (id === 'front' && front) || pose)) return false;
    // (somewhere in the other sector of the map: to the portal first, and on
    // from its far end once through: portalThrough. nav.js legOf)
    const leg = id === 'front' ? id : legOf(s, id, pose);
    if (leg !== id) {
      if (!travel(leg, drive)) return false;
      state.then = { id, drive, name: pose?.name ?? null };
      return true;
    }
    state.then = null;
    // (the Maw's own spot is past its point of no return: to the edge of its pull instead; the
    // front's is just inside the fight, on your side of it; a pilot's, behind them)
    const park = id === 'front' ? frontPark([s.x, s.z]) : pose ? parkBehind(pose) : parkFor(id, [s.x, s.z]);
    if (!park) return false;
    heard();
    state.view = state.seat;
    state.lastInput = performance.now();
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    if (reduced) {
      state.auto = null;
      arriveAt(park);
      if (pose) withPilot(pose.name);
      ctx.invalidate();
      if (!portalById(id)) setTimeout(() => emit({ type: 'arrived', id, done: true }), 0); // (there: the page's tour and a trip through the gate go on; after the page's own select. Through a portal, its trip ends at the far end: portalThrough)
      return true;
    }
    const hyper = drive === 'hyper' ? hyperState({ last: state.hyperAt, now: wall(), interdicted: state.interdicted }) : null;
    if (hyper?.ready) {
      // the jump, the galaxy's way: the ship comes round onto the place
      // first (fly(): `align`, aim.js), then spools up, the page plays the
      // site's own jump over the map, and at its flash the ship's out at
      // the place
      state.auto = null;
      const dx = park.x - s.x;
      const dy = park.y - s.y;
      const dz = park.z - s.z;
      const l = Math.hypot(dx, dy, dz) || 1;
      state.jump = { id, park, phase: 'align', age: 0, dir: [dx / l, dy / l, dz / l], at: Infinity, name: pose?.name ?? null };
    } else {
      if (hyper) {
        // (not yet: on super speed instead, and the HUD says why)
        emit({ type: 'hyper', why: hyper.why, wait: hyper.wait });
        state.note = { text: hyper.why === 'interdicted' ? JAMMED.long : `${jumpState(false, hyper.wait)}: super speed instead`, until: wall() + 3.5 };
      }
      state.auto = { id, park, od: driveById(hyper ? 'super' : drive).od };
      // (a pilot moves: where they'll be parked behind is worked out again every REAIM_MS, chasePilot)
      if (pose) Object.assign(state.auto, { pilot: pid, name: pose.name, drive, space: pilotSpace(SPACE, pid, pose), reaimAt: performance.now() + REAIM_MS });
    }
    retarget(700);
    ctx.invalidate();
    return true;
  };
  // the ship put straight down at a parking spot, still, level and facing
  // the place (reduced motion's trip, and a jump's way out of hyperspace)
  const arriveAt = (park) => {
    state.ship = { ...state.ship, ...park, speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, edge: false };
    state.yaw = -state.ship.heading;
    camQOn = false;
  };
  const navTo = (id) => travel(id);
  // the war's front as somewhere the autopilot can go (front.js's goal):
  // parked just inside the fight on the side you come from, facing it
  const frontPark = ([x, z]) => {
    const g = front?.goal();
    if (!g) return null;
    const dx = x - g.at[0];
    const dz = z - g.at[2];
    const l = Math.hypot(dx, dz) || 1;
    return { x: g.at[0] + (dx / l) * g.reach, y: g.at[1], z: g.at[2] + (dz / l) * g.reach, heading: headingTo(-dx / l, -dz / l) };
  };
  const frontSpace = () => ({ ...SPACE, goals: { ...SPACE.goals, front: front.goal() } });
  // Flying to another pilot (travel's `pilot:<id>`): there once within reach
  // of them, the HUD says who you're with; gone (offline, hidden, down on a
  // planet, blocked, off to another page) and the trip ends, the autopilot
  // off and their goal with it, and the HUD says so. Their name is only
  // ever the note's text (placePrompt sets it as textContent)
  const withPilot = (name) => {
    state.note = { text: `With ${name ?? 'them'}`, until: wall() + 3.5 };
  };
  const pilotGone = (id, name) => {
    state.note = { text: `${name ?? 'They'} ${name ? 'has' : 'have'} gone`, until: wall() + 3.5 };
    emit({ type: 'lost', id, name: name ?? null });
  };
  // each frame of a trip to a pilot, before the autopilot flies it (or on
  // the way to the portal, for one in the other sector): ended if they're
  // gone or reached, else re-aimed at where they are every REAIM_MS
  const chasePilot = () => {
    const a = state.auto;
    const then = !a?.pilot && state.then && pilotId(state.then.id) ? state.then : null;
    if (!a || !(a.pilot || then)) return;
    const id = a.pilot ? a.id : then.id;
    const name = a.pilot ? a.name : then.name;
    const pose = pilots.pose(pilotId(id));
    const park = parkBehind(pose);
    if (!park) {
      // (dropAuto: the page hears the trip's off; then why)
      dropAuto();
      pilotGone(id, name);
      return;
    }
    if (!a.pilot) return; // (on to the portal: the trip on to them is worked out at its far end)
    if (reached(state.ship, pose)) {
      state.auto = null;
      withPilot(name);
      emit({ type: 'arrived', id, done: true });
      return;
    }
    const now = performance.now();
    if (now < a.reaimAt) return;
    // (gone through a portal ahead of you: after them, by it)
    if (legOf(state.ship, id, pose) !== id) {
      state.auto = null;
      if (!travel(id, a.drive === 'hyper' ? 'super' : a.drive)) emit({ type: 'arrived', id, done: false });
      return;
    }
    a.reaimAt = now + REAIM_MS;
    a.park = park;
    a.space = pilotSpace(SPACE, a.pilot, pose);
  };

  // ── The ship ──
  const heard = () => {
    // the first key or press: sound may start now
    if (!state.kind) return;
    audioContext();
    if (!engine) engine = shipEngine(state.kind);
  };

  // ── The cockpit view: the intro's cockpit, from the pilot's seat ──
  // (cockpit/vehicles builds it; its outside world isn't drawn here)
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const cabScene = new THREE.Scene();
  const camIn = new THREE.PerspectiveCamera(60, 1, 0.02, 60);
  camIn.rotation.order = 'YXZ'; // the head turns, then nods
  cabScene.add(camIn);
  let cab = null; // { kind, built, plan, look } once a cockpit is built
  // where you're looking from the seat, past the nose: the mouse out toward
  // an edge of the view turns your head that way (as far round as the
  // cockpit allows: Jesse beside you, Mr. White behind), and now and then
  // the head turns to the crew by itself (sitting down, arriving somewhere)
  const cabLook = { ty: 0, tp: 0, glanceAt: -1e9 };
  const smoothstep = (a, b, x) => {
    const k = clamp01((x - a) / (b - a));
    return k * k * (3 - 2 * k);
  };
  let cabWanted = null; // the kind on its way
  let roomEnv = null;
  const dropCab = () => {
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
  };
  const buildCab = async (kind) => {
    if (!kind || !CABS[kind] || cabWanted === kind || cab?.kind === kind) return;
    cabWanted = kind;
    try {
      const mod = await CABS[kind]();
      if (disposed || cabWanted !== kind) return;
      if (!roomEnv) {
        const pm = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        roomEnv = pm.fromScene(room, 0.04).texture;
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
      await warm(cabScene, camIn, cabScene); // now, and off the main thread, not on its first frame
      if (disposed || cabWanted !== kind) {
        cabScene.remove(built.inside);
        if (cabScene.environment === built.environment) cabScene.environment = null;
        if (built.environment && built.environment !== roomEnv) built.environment.dispose?.();
        built.dispose?.();
        disposeTree(built.inside);
        disposeTree(built.outside);
        return;
      }
      cab = { kind, built, plan: cockpitPlan(kind), look: { yaw: 0, pitch: 0 } };
      cabLook.glanceAt = state.clock; // a look over at the crew, a moment after you sit down
      camIn.position.set(...built.eye);
      cabWanted = null;
      ctx.invalidate();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[universe] cockpit', err);
      if (cabWanted === kind) cabWanted = null;
    }
  };
  // where you ride: behind the ship, or in its cockpit (kept between visits)
  const setSeat = (seat) => {
    if (seat === state.seat) return;
    state.seat = seat;
    remembered.set(SEAT_KEY, seat);
    if (flying() && state.view !== 'map') {
      state.view = seat;
      retarget(800);
    }
    if (seat === 'cockpit') buildCab(state.kind);
    ctx.invalidate();
  };
  // the cockpit each frame it's shown: the same lens as the world's, a
  // little head (into the turn, toward the lock), its own life
  const cabFrame = (dt, t) => {
    const s = state.ship;
    const look = cab.look;
    // (rotateY's positive is a look to the left: the way a left turn goes,
    // and the other way from something off to the right)
    let wantYaw = (s.rate || 0) * 0.05;
    if (state.lockTarget) {
      // (where it is as the ship sees it, whichever way up it is)
      const at = state.lockTarget.at;
      camP.set(at.x - s.x, at.y - s.y, at.z - s.z).applyQuaternion(orientOf(s, headQ).invert());
      wantYaw += clamp(Math.atan2(-camP.x, -camP.z) * 0.2, -0.16, 0.16);
    }
    // looking about: your own look, or else the glance over at the crew
    // (out, a moment there, and back)
    let ty = cabLook.ty;
    if (import.meta.env.DEV && typeof window.__CABYAW__ === 'number') ty = window.__CABYAW__;
    const since = state.clock - cabLook.glanceAt;
    const glance = reduced || ty ? 0 : (cab.built.glance ?? 0) * (smoothstep(1.2, 2.2, since) - smoothstep(3.6, 4.8, since));
    wantYaw += ty + glance;
    const k = 1 - Math.exp(-dt * 4);
    look.yaw += (wantYaw - look.yaw) * k;
    look.pitch += ((s.tipRate || 0) * -0.012 + cabLook.tp + (ty || glance ? (cab.built.rest?.[1] ?? 0) : 0) - look.pitch) * k;
    camIn.projectionMatrix.copy(camera.projectionMatrix);
    camIn.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    camIn.rotation.set(look.pitch + (reduced ? 0 : Math.sin(t * 0.7) * 0.003), look.yaw + (reduced ? 0 : Math.sin(t * 0.43) * 0.004), 0);
    camIn.updateMatrixWorld();
    cab.built.update(dt, t, { launching: false, t: 0, phase: null, throttle: 0, plan: cab.plan, look });
  };

  // What's fitted in the hangar (outfit.js): the paint job the ship wears
  // (paint.js), on its hull, in its engines' glow and exhaust and in its
  // shots (the factory's is each ship's own); and the parts bolted on, with
  // what they do to how it flies and fights (state.stats).
  const coat = () => paintById(state.loadout.paint);
  const plumeColor = () => coat().glow ?? (PLUME[state.kind] ?? PLUME.falcon).color;
  const dress = () => {
    if (!state.kind) return;
    state.model?.paint(coat());
    boltMat.color.set(coat().bolt ?? BOLT_COLOR[state.kind] ?? '#ff4a3d').multiplyScalar(4); // hot enough to bloom
    const heavy = arsenalOf(state.kind).heavy;
    missileMat.color.set(heavy).multiplyScalar(3);
    missileGlowMat.color.set(heavy).multiplyScalar(2.2);
    missileTailMat.color.set(heavy).multiplyScalar(2);
    const look = PLUME[state.kind] ?? PLUME.falcon;
    streak.setTint(plumeColor());
    for (const pl of plumes) pl.trail.setColors(plumeColor(), look.core);
  };
  const refit = () => {
    state.stats = statsOf(state.kind, state.loadout, state.build);
    if (!state.kind || !state.model) return setBoosterPlumes();
    const mods = state.model.outfit(state.loadout);
    state.barrel = 0;
    setBoosterPlumes(mods.nozzles, mods.boosterColor);
  };
  const setLoadout = (raw) => {
    const next = readLoadout(raw);
    const was = state.loadout;
    state.loadout = next;
    armory?.refit(next); // (the same line stays picked; the rack's rounds carry over)
    if (next.paint !== was.paint) dress();
    if (PARTS_CHANGED(was, next)) refit();
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
  // the wardrobe's new looks: the cruiser's crew in their seats sat down
  // again in them, the cruiser as it is
  const onLooks = (e) => {
    if (!disposed) state.model?.setLooks?.(readLooks(e.detail));
  };
  window.addEventListener('tp:looks', onLooks);

  // (force: the same crew, built again: its garage build changed)
  const setShip = (kind, force = false) => {
    if (kind === state.kind && !force) return;
    // (forced: the same crew, a new hull: only the model's made again; the
    // fight, the autopilot, the engine's sound and the cockpit go on)
    const same = force && kind === state.kind;
    if (onFoot()) foot.end();
    seatCrew = null;
    if (!same) {
      engine?.stop();
      engine = null;
      well?.stop();
      well = null;
      quietRoar();
    }
    if (state.model) {
      engines.remove(heroEngine);
      heroEngine = null;
      map.remove(state.model.group);
      state.model.dispose();
      disposeTree(state.model.group);
      state.model = null;
    }
    const was = state.kind;
    state.kind = kind;
    setPlumes(kind, ENGINES[kind] ?? []);
    if (!same) {
      traffic?.setCrew(crewAt(kind, mapSectorOf(state.ship?.x ?? 0, 0, state.ship?.z ?? 0)));
      hunters?.clear();
      meteors.clear();
      mines.clear();
      dropEscort();
      dropEclipse();
      wingmen?.clear();
      skirmishes?.clear();
      npcs?.clear();
      dropCab();
      cabWanted = null;
      if (kind && state.seat === 'cockpit') buildCab(kind);
      stockUp(); // (the hunters this ship's side meets)
      state.auto = null;
      state.flown = false;
    }
    if (!kind) {
      refit();
      state.ship = null;
      state.at = null;
      state.yaw = 0;
      retarget();
      return;
    }
    state.model = buildShip(kind, T, { build: state.build });
    map.add(state.model.group);
    // its engines' glow (a garage build's where its own exhausts are)
    heroEngine = engines.add(kind, state.model.pivot, { list: state.build ? state.model.engines.map((at) => ({ at, r: 0.03, colour: '#ffc080' })) : (HERO_ENGINES[kind] ?? HERO_ENGINES.cruiser) });
    if (state.build) setPlumes(kind, state.model.engines); // (its own engines)
    refit();
    dress();
    // its shaders (and its exhaust's) made now, off the main thread, not on
    // its first frame: it may be set under the intro's cockpit, before the
    // flash (pages/Universe's tp:board)
    for (const root of [state.model.group, ...plumes.map((pl) => pl.trail.mesh)]) precompile(renderer, root, camera, scene, post.on ? post.composer.readBuffer : undefined);
    if (state.build) {
      // a garage build is whole as it is: no model to load over it
    } else if (SHIP_MODELS[kind]) {
      const model = state.model;
      loadModel(SHIP_MODELS[kind])
        .then((m) => m && warm(model.dress(m)).then(() => m)) // (in its paint before its shaders are made)
        .then((m) => {
          if (!m) return;
          if (disposed || state.model !== model || !model.mount(m)) disposeTree(m); // (the ship it was dressed for)
          else uploadTextures(renderer, m); // (its pictures on the graphics chip now, not as it first comes into view)
          ctx.invalidate();
        });
    } else if (kind === 'cruiser') {
      // the C-137 page's cruiser, crew aboard; its ink drawn to our scale (it's
      // 2.7 across there, LENGTH here), theirs finer (they're drawn big)
      const model = state.model;
      import('../rickmorty/cruiser3d')
        .then((m) => m.buildCruiser({ ink: LENGTH / 2.7, crewInk: CREW_INK }))
        .then((c) => {
          if (!c) return;
          if (disposed || state.model !== model || !model.mount(c.group, { update: c.update, dispose: c.dispose, ownGlow: true, tint: c.tint, setLooks: c.setLooks })) {
            c.dispose();
            disposeTree(c.group);
            return;
          }
          uploadTextures(renderer, c.group);
          precompile(renderer, c.group, camera, scene, post.on ? post.composer.readBuffer : undefined);
          seatCrew = c.seated;
          // its exhaust leaves from its own exhaust cans
          if (c.engines?.length) {
            model.group.updateMatrixWorld(true);
            setPlumes('cruiser', c.engines.map((g) => model.pivot.worldToLocal(g.getWorldPosition(new THREE.Vector3())).toArray()));
          }
          ctx.invalidate();
        })
        .catch(() => {});
    }
    if (!state.ship) {
      // a new pilot: at the universe picked, or anywhere (ship.js's STARTS),
      // so those joining don't all turn up in the same place
      // (a link out to a wonder, /universe/aurelia, starts parked beside it: props.startAt)
      // (never by the Maw, whose pull would have a new ship before it had flown)
      state.ship = spawn(state.sel, !state.sel && props.startAt && props.startAt !== MAW.id && isGoal(props.startAt) ? parkFor(props.startAt, [0, 0]) : startAt());
      camQOn = false;
      state.at = state.sel && orbiting(state.ship, null) === state.sel ? state.sel : null;
      state.yaw = -state.ship.heading;
    }
    state.view = state.seat;
    if (!was) retarget(state.pose ? 1600 : 0);
    if (state.pose && engine === null && navigator.userActivation?.hasBeenActive) heard();
  };

  // A pack of hunters comes in four or five at once, and a built ship takes
  // a few milliseconds to make: made then, they'd stall the fight's first
  // frames. So a few of the ones your side meets (sides.js's `ahead`) are made ahead,
  // one at a time while the page has nothing else to do.
  const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 60));
  const stockedFor = new Set();
  let warmed = false; // (none made ahead before the map's own shaders are)
  const stockUp = () => {
    if (reduced || !warmed) return;
    const side = sideHere();
    if (!side || stockedFor.has(side.id)) return;
    stockedFor.add(side.id);
    const want = Object.entries(AHEAD_OF(side));
    const next = () => {
      if (disposed) return;
      const job = want.find(([k, n]) => fleet.stocked(k) < n && !fleet.loaded(k));
      if (!job) return;
      const model = buildTraffic(job[0]);
      singlePass(model.group); // (as the ones made with the map were: the same shaders)
      fleet.stock(job[0], model);
      idle(next);
    };
    idle(next);
  };

  const takeover = () => {
    state.lastInput = performance.now();
    // (the stick calls off a jump that's still coming round onto its place:
    // the trip's dropped, as the autopilot's is, so a tour ends here)
    if (state.jump?.phase === 'align' && jumpPhase(state.jump, { aligned: 0, age: 0, input: true }) === 'cancel') {
      const id = state.jump.id;
      state.jump = null;
      emit({ type: 'arrived', id, done: false });
    }
    if (!state.flown) {
      state.flown = true;
      emit({ type: 'launch' });
    }
    if (state.auto) {
      // the pilot has the stick now (and the page hears the trip's off: a tour or a trip on through the gate ends here)
      const id = state.auto.id;
      state.auto = null;
      emit({ type: 'arrived', id, done: false });
    }
    if (state.view === 'map') {
      state.view = state.seat;
      retarget(700);
    }
  };

  // the visitor's flying settings (controls.js), as the page last passed them
  const controls = () => props.controls ?? CONTROL_DEFAULTS;
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
    return {
      throttle: clamp(throttle, -1, 1),
      turn: clamp(turn, -1, 1),
      climb: clamp(climb, -1, 1),
      roll: clamp(roll, -1, 1),
      boost: Boolean(state.keys.boost || state.boostBtn),
      turnRate: c.turn,
      pitchRate: c.pitch,
      rollRate: c.roll,
      level: c.level,
    };
  };

  // a shot from the nose (the X-wing's from each wingtip in turn): along
  // the nose, bent onto the lead point when the guns are locked on and the
  // nose is near enough to it (targeting.js, as much as the aim-assist
  // setting allows); held, the guns keep firing at the ship's own pace
  // the guns fitted for each ship (weapons.js): the blaster, and the
  // secondary and ordnance the loadout fits (stock: the spread and the
  // heavy rack), R or 1 2 3 to change
  let armory = null;
  const arms = () => {
    if (!armory || armory.kind !== state.kind) armory = Object.assign(createArmory(state.kind, state.loadout), { kind: state.kind });
    return armory;
  };
  const shotAt = new THREE.Vector3();
  const jitter = () => Math.random() * 2 - 1;
  // one bolt away, from `at` along `d` (unit) at `speed`
  const spawnBolt = (at, d, speed, w, g) => {
    const b = bolts.find((m) => !m.visible) ?? bolts[0];
    b.position.copy(at);
    const { heading, pitch } = aimAngles(d);
    b.rotation.set(pitch, heading, 0);
    const k = g.bolt * w.scale;
    b.scale.set(k, k, 1 + (k - 1) * 0.4);
    b.userData = { life: AIM.life * w.life, v: [d[0] * speed, d[1] * speed, d[2] * speed], punch: (g.punch ?? 1) * w.punch, damage: w.damage, heavy: false };
    b.visible = true;
  };
  // a heavy round away, homing on whatever the guns have locked
  const launch = (at, d, speed, w, g) => {
    const m = missiles.find((x) => !x.visible) ?? missiles[0];
    m.position.copy(at);
    const { heading, pitch } = aimAngles(d);
    m.rotation.set(pitch, heading, 0);
    m.userData = { life: AIM.life * w.life, v: [d[0] * speed, d[1] * speed, d[2] * speed], punch: (g.punch ?? 1) * w.punch, damage: w.damage, heavy: true, homing: w.homing, target: state.lockTarget, age: 0 };
    m.visible = true;
    state.kick = Math.max(state.kick, 0.4);
  };

  // a shot from the nose (the X-wing's from each wingtip in turn): along
  // the nose, bent onto the lead point when the guns are locked on and the
  // nose is near enough to it (targeting.js, as much as the aim-assist
  // setting allows); held, the guns keep firing at the ship's own pace,
  // each weapon at its own multiple of it
  const fire = () => {
    state.armed = true; // (the weapon readout shows from the first shot: placeArms)
    const s = state.ship;
    const now = performance.now();
    const g = state.stats;
    if (!s || props.frozen || state.crash) return;
    const arm = arms();
    const cadence = Math.max(FASTEST, (CADENCE[state.kind] ?? 0.18) * g.cadence);
    if (!arm.ready(now, cadence)) {
      if (arm.weapon.heavy && arm.ammo < 1 && now - (state.dryAt ?? 0) > 700) {
        state.dryAt = now;
        emit({ type: 'dry' });
      }
      return;
    }
    arm.fired(now);
    const w = arm.weapon;
    state.lastShot = now;
    state.lastInput = now;
    const [fx, fz] = forward(s.heading);
    let dir = nose(s);
    if (state.lead && state.lead.t <= AIM.life) dir = assist(dir, dirTo(s, state.lead), controls().assist);
    // from the guns fitted, their barrels in turn; or the ship's own
    const mods = state.model?.modules;
    if (mods?.muzzles.length) {
      state.barrel = (state.barrel + 1) % mods.muzzles.length;
      map.worldToLocal(state.model.pivot.localToWorld(shotAt.set(...mods.muzzles[state.barrel])));
      mods.fire();
    } else {
      const side = state.kind === 'xwing' ? (state.side = -state.side) * 0.12 : 0;
      shotAt.set(s.x + dir[0] * 0.16 - fz * side, s.y + dir[1] * 0.16, s.z + dir[2] * 0.16 + fx * side);
    }
    const speed = AIM.bolt * w.speed + Math.max(0, s.speed);
    if (w.heavy) launch(shotAt, dir, speed, w, g);
    else for (const d of fan(dir, w.count, w.cone, jitter)) spawnBolt(shotAt, d, speed, w, g);
    net?.shot(shotAt, [dir[0] * speed, dir[1] * speed, dir[2] * speed], w.code);
    emit({ type: 'fire', weapon: arm.id });
    ctx.invalidate();
  };
  // change weapons: R (Shift+R back), 1 2 3, or the phone's button
  const pickWeapon = (i) => {
    state.armed = true;
    const arm = arms();
    if (i === 'next' || i === 'back') arm.cycle(i === 'back' ? -1 : 1);
    else if (!arm.select(i)) return;
    emit({ type: 'weapon', id: arm.id, name: arm.name });
    ctx.invalidate();
  };

  // a shot's step (from → to) into the Citadel: its generators, its shield
  // while that's up, then its core (siege.js). → where it hit, or null
  const sFrom = [0, 0, 0];
  const sTo = [0, 0, 0];
  const siegePoint = new THREE.Vector3();
  // a shot's step (from → to) into the NX-5: where it struck, or null
  const removerHit = (from, to, punch) => {
    if (!remover) return null;
    sFrom[0] = from.x;
    sFrom[1] = from.y;
    sFrom[2] = from.z;
    sTo[0] = to.x;
    sTo[1] = to.y;
    sTo[2] = to.z;
    let first = null;
    for (const sp of removerView.spheres()) {
      const k = segmentSphere(sFrom, sTo, sp.c, sp.r);
      if (k !== null && (first === null || k < first)) first = k;
    }
    if (first === null) return null;
    const ev = hitRemover(remover, punch);
    if (!ev) return null;
    const point = from.clone().lerp(to, first);
    removerView.hit();
    state.hitMark = 1;
    pops.hit({ point, normal: popDir.copy(from).sub(to).normalize(), radius: 0.4 });
    if (ev === 'destroyed') {
      removerView.down();
      pops.hit({ point: removerView.bow.clone(), normal: popDir.set(0, 1, 0), radius: NX5_LEN * 0.3 });
      emit({ type: 'event', id: 'removerDown' });
      state.heat += 1;
      if (!reduced) state.shake = Math.max(state.shake, 0.9);
    }
    return point;
  };
  const siegeHit = (from, to, punch, heavy) => {
    if (!citadelGeo || siegeSt.down) return null;
    if (apart(to.x, to.y, to.z, citadelMid.x, citadelMid.y, citadelMid.z) > citadelGeo.shield + 40) return null;
    sFrom[0] = from.x;
    sFrom[1] = from.y;
    sFrom[2] = from.z;
    sTo[0] = to.x;
    sTo[1] = to.y;
    sTo[2] = to.z;
    let part = null;
    let first = Infinity;
    for (let i = 0; i < GENS; i++) {
      if (siegeSt.gens[i]) continue;
      const k = segmentSphere(sFrom, sTo, citadelGeo.gens[i], citadelGeo.gen);
      if (k !== null && k < first) {
        first = k;
        part = i;
      }
    }
    const k = segmentSphere(sFrom, sTo, citadelGeo.center, siegeSt.shield ? citadelGeo.shield : citadelGeo.core);
    if (k !== null && k < first) {
      first = k;
      part = siegeSt.shield ? 'shield' : CORE;
    }
    if (part === null) return null;
    siegePoint.copy(from).lerp(to, first);
    const ev = siege.strike(part, punch, heavy, Date.now());
    readSiegeState();
    if (!ev) return siegePoint;
    if (ev.type === 'shielded') {
      siegeView?.shieldHit(siegePoint);
      emit({ type: 'siege', what: 'shielded' });
    } else if (ev.type === 'deflected') {
      pops.hit({ point: siegePoint, normal: popDir.copy(siegePoint).sub(citadelMid).normalize(), radius: 0.3 });
      emit({ type: 'siege', what: 'deflected' });
    } else {
      // it took it: tell everyone soon, and the Council of Ricks takes notice.
      // Only your own strike pays (here, a generator or the core): another
      // pilot's arrives through the net and pays them.
      if (!siegeMine) {
        siegeMine = true;
        state.heat += 2;
        director?.soon?.('council');
      }
      siegeOwed = true;
      state.hitMark = 1;
      if (typeof ev.part === 'number' && ev.part < GENS) siegeView?.genHit(ev.part);
      if (ev.type === 'gen') {
        pops.hit({ point: new THREE.Vector3(...citadelGeo.gens[ev.part]), normal: popDir.copy(siegePoint).sub(citadelMid).normalize(), radius: citadelGeo.gen * 1.2 });
        if (!reduced) state.shake = Math.max(state.shake, 0.5);
        emit({ type: 'siege', what: 'gen', left: ev.left, near: true });
        pay('siegePart');
      } else if (ev.type === 'down') {
        siegeDown(true);
        pay('siegePart'); // (the core is the siege's last part, and pays like one)
      }
      else pops.hit({ point: siegePoint, normal: popDir.copy(siegePoint).sub(citadelMid).normalize(), radius: heavy ? 0.8 : 0.2 });
    }
    return siegePoint;
  };
  // it's gone up (yours, or news of it)
  const siegeDown = (mine) => {
    readSiegeState();
    siegeOwed = true;
    const near = Boolean(state.ship) && apart(state.ship.x, state.ship.y, state.ship.z, citadelMid.x, citadelMid.y, citadelMid.z) < 1600;
    if (near && !reduced) {
      state.shake = Math.max(state.shake, 1.2);
      state.flare = Math.max(state.flare, 3);
      state.kick = 1;
    }
    emit({ type: 'siege', what: 'down', mine: mine || siegeMine, near });
  };
  const popDir = new THREE.Vector3();
  const shotFrom = new THREE.Vector3();
  const moveBolts = (dt) => {
    let any = false;
    for (const b of bolts) {
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
      if (npcs?.count) npcWorld.stims.push({ type: 'shot', at: { x: shotFrom.x, y: shotFrom.y, z: shotFrom.z }, aim: { x: b.position.x, y: b.position.y, z: b.position.z }, radius: 160, from: 'you', loudness: 1 });
      // into someone: a pop (the big ships just take it)
      // a hunter: down, or (the tougher ones) a hit that sparks off it
      const hh = hunters?.hit(shotFrom, b.position, d.punch ?? 1) ?? farHit(shotFrom, b.position, d.punch ?? 1) ?? frontHit(shotFrom, b.position, d.punch ?? 1);
      if (hh) {
        b.visible = false;
        state.hitMark = 1; // the reticle flashes
        hunterShot(hh, popDir.set(-d.v[0], 3, -d.v[2]).normalize());
        continue;
      }
      // another pilot: they're told, and it comes off their shields
      // (or one of the hunters after them: it's theirs, so they're told that too)
      const ph = pilots.hit(shotFrom, b.position, d.punch ?? 1);
      if (ph) {
        b.visible = false;
        state.hitMark = 1;
        pilotShot(ph, d.punch ?? 1, d.damage, popDir.set(-d.v[0], 3, -d.v[2]).normalize());
        continue;
      }
      // the Citadel (its shield, a generator, its core)
      if (citadelGeo && siegeHit(shotFrom, b.position, d.punch ?? 1, false)) {
        b.visible = false;
        continue;
      }
      // the capital ship: a shield part or its bridge (down, or a hit that
      // sparks off it), or its hull (a splash off its shield, or a spark)
      const ch = capitalHit(shotFrom, b.position, d.punch ?? 1);
      if (ch) {
        b.visible = false;
        pops.hit({ point: ch.at, normal: popDir.set(-d.v[0], 3, -d.v[2]).normalize(), radius: ch.down ? ch.size * 1.8 : ch.type === 'shielded' ? 0.45 : 0.2 });
        continue;
      }
      // the NX-5
      if (remover && removerHit(shotFrom, b.position, d.punch ?? 1)) {
        b.visible = false;
        continue;
      }
      const h = traffic?.hit(shotFrom, b.position) ?? null;
      if (h) {
        b.visible = false;
        trafficShot(h, popDir.set(-d.v[0], 3, -d.v[2]).normalize());
      } else if (leviathans.hit(shotFrom, b.position)) {
        b.visible = false;
        leviathanShot();
      } else {
        const mh = meteors.hit(shotFrom, b.position) ?? mines.hit(shotFrom, b.position);
        if (mh) {
          b.visible = false;
          pops.hit({ point: mh.at, normal: popDir.set(-d.v[0], 3, -d.v[2]).normalize(), radius: mh.size * 1.6 });
          state.hitMark = 1;
        }
      }
    }
    return any;
  };
  // what a hit on each kind of ship does (a shot's, or a ram's: shipsHit),
  // written once: a hunter (or a skirmish's, a character, a front fighter),
  // another pilot or the hunters after them, and the traffic
  // (`ram`: a ram's, said as one)
  const hunterShot = (hh, normal, ram = false) => {
    pops.hit({ point: hh.at, normal, radius: hh.down ? hh.size * 1.8 : 0.2 });
    if (hh.down) burn(hh.at, hh.size);
    if (hh.down) {
      emit({ type: 'kill', kind: hh.kind, hunter: true, ...(ram ? { ram } : null) });
      state.heat += 1;
      killed(hh);
      if (!reduced) state.shake = Math.max(state.shake, 0.2);
    }
  };
  const pilotShot = (ph, punch, damage, normal, ram = false) => {
    pops.hit({ point: ph.at, normal, radius: ph.down ? ph.size * 1.8 : 0.2 });
    if (ph.down) burn(ph.at, ph.size);
    if (ph.hunter) {
      net?.hunterHit(ph.id, ph.hunter, punch);
      if (ph.down) {
        emit({ type: 'kill', kind: ph.kind, hunter: true, ...(ram ? { ram } : null) });
        if (state.helped.once(`${ph.id}:${ph.hunter}`)) pay('hunterHelped'); // (one shot off someone else's tail)
        if (!reduced) state.shake = Math.max(state.shake, 0.2);
      }
    } else net?.hit(ph.id, damage);
  };
  const trafficShot = (h, normal, ram = false) => {
    pops.hit({ point: h.at, normal, radius: h.glance ? 0.25 : h.size * 1.6 });
    if (!h.glance) burn(h.at, h.size);
    if (!h.glance) {
      emit({ type: 'kill', kind: h.kind, ...(ram ? { ram } : null) });
      state.heat += h.civil ? 1.5 : 1;
      deed(h.civil ? 'killCivil' : 'killPatrol');
    }
  };
  const leviathanShot = () => {
    if (state.clock - leviathanSaidAt < 20) return;
    leviathanSaidAt = state.clock;
    emit({ type: 'event', id: 'leviathanHit' });
  };

  // a shot into one of the hunters in someone else's fight (skirmishes.js):
  // the same answer as hunters.hit's, counted as help
  const farHit = (from, to, punch) => {
    const r = skirmishes?.active ? skirmishes.hit(from, to, punch) : null;
    if (!r) return npcs?.count ? npcs.hit(from, to, punch) : null; // (or a character who's after you: Evil Morty)
    return skirmishHelp(r);
  };
  const skirmishHelp = (r) => {
    state.skirmishHelped += 1;
    return { id: r.id, kind: r.kind, at: new THREE.Vector3(r.at.x, r.at.y, r.at.z), size: r.size, down: r.down };
  };

  // a shot into the battle at the front (front.js), where you fly on your
  // crew's side: one of the other side's fighters (down, or a spark off it), one of
  // the objectives, or a capital ship's hull or shield (a spark; the battle
  // has its own flashes for those, and the crew their own lines)
  const frontHit = (from, to, punch) => {
    const r = front?.hit(from, to, punch);
    return r ? frontShip(r) : null;
  };
  const frontShip = (r) => {
    const ship = !r.sub && !r.capital && !r.shield;
    return { id: r.id, kind: r.kind, at: new THREE.Vector3(r.at.x, r.at.y, r.at.z), size: ship ? r.size : 0.15, down: ship && r.down };
  };

  // a hunter shot down: what it does to your standing (one of the law's,
  // a pirate on someone else, or a character who turned on you)
  const killed = (hh) => {
    if (!hh.faction) return;
    // (one of the law's: a crime, and it pays nothing)
    if (law?.killed(hh.faction, state.ship)) {
      for (const e of standing.note('killHunter')) stood(e);
      return;
    }
    const pays = hunterEarn(FACTIONS_ALL, hh); // (its faction's ace pays more)
    if (FACTIONS_ALL[hh.faction]?.role === 'pirates' || hh.prey) deed('killPirate', 1, pays);
    else deed('killHunter', 1, pays);
  };

  // a shot into the director's capital ship (setpieces.js, capitalRules.js):
  // the reticle flashes for a hit on a part; a splash off its shield gets a
  // word from the crew, once
  const capitalHit = (from, to, punch) => {
    if (!pieces.destroyerHere) return null;
    const r = pieces.hit(from, to, punch);
    if (!r) return null;
    if (r.type === 'part' || r.type === 'bridge') {
      state.hitMark = 1;
      if (capFight) capFight.hurt = true;
    } else if (r.type === 'shielded') capitalSay('shielded');
    return r;
  };
  // what the crew say of the fight with it, once each a visit
  const capitalSay = (sub) => {
    if (!capFight || capFight.said.has(sub)) return;
    capFight.said.add(sub);
    emit({ type: 'event', id: 'capital', sub });
  };

  // the heavy rounds: steered onto what they were locked on to, and off
  // with a bang at the first thing they meet (or right by their target)
  const toTarget = [0, 0, 0];
  const missileTo = new THREE.Vector3();
  const boom = (m, point, big = false) => {
    m.visible = false;
    pops.hit({ point, normal: popDir.set(-m.userData.v[0], 3, -m.userData.v[2]).normalize(), radius: big ? 1.6 : 1 });
    if (!reduced) state.shake = Math.max(state.shake, big ? 0.6 : 0.3);
    state.flare = Math.max(state.flare, 1.4);
    emit({ type: 'boom', big });
  };
  const moveMissiles = (dt) => {
    let any = false;
    for (const m of missiles) {
      if (!m.visible) continue;
      const d = m.userData;
      d.life -= dt;
      d.age += dt;
      if (d.life <= 0) {
        boom(m, m.position.clone());
        continue;
      }
      any = true;
      // homing, after a moment's straight run off the rails
      const tg = d.target;
      if (tg?.at && d.age > 0.12) {
        toTarget[0] = tg.at.x - m.position.x;
        toTarget[1] = tg.at.y - m.position.y;
        toTarget[2] = tg.at.z - m.position.z;
        const l = Math.sqrt(toTarget[0] * toTarget[0] + toTarget[1] * toTarget[1] + toTarget[2] * toTarget[2]) || 1;
        toTarget[0] /= l;
        toTarget[1] /= l;
        toTarget[2] /= l;
        steer(d.v, toTarget, d.homing, dt);
      }
      shotFrom.copy(m.position);
      m.position.x += d.v[0] * dt;
      m.position.y += d.v[1] * dt;
      m.position.z += d.v[2] * dt;
      const { heading, pitch } = aimAngles([d.v[0], d.v[1], d.v[2]]);
      m.rotation.set(pitch, heading, 0);
      // right by its target: straight into it (a step to its middle meets it)
      // (a hunter's `at` is a plain { x, y, z }, not a Vector3: the distance
      // worked out by hand, and the point copied into one, since what's
      // tested against it next wants a Vector3)
      const near = tg?.at && tg.siegePart === undefined && Math.hypot(tg.at.x - m.position.x, tg.at.y - m.position.y, tg.at.z - m.position.z) < (tg.size ?? 0.3) + 0.35;
      const to = near ? missileTo.set(tg.at.x, tg.at.y, tg.at.z) : m.position;
      const hh = hunters?.hit(shotFrom, to, d.punch) ?? farHit(shotFrom, to, d.punch) ?? frontHit(shotFrom, to, d.punch);
      if (hh) {
        if (hh.down) {
          emit({ type: 'kill', kind: hh.kind, hunter: true });
          state.heat += 1;
          killed(hh);
        }
        state.hitMark = 1;
        boom(m, hh.at, hh.down);
        if (hh.down) burn(hh.at, hh.size);
        continue;
      }
      const ph = pilots.hit(shotFrom, to, d.punch);
      if (ph) {
        state.hitMark = 1;
        if (ph.hunter) {
          // one of the hunters after another pilot: theirs to take down
          net?.hunterHit(ph.id, ph.hunter, d.punch);
          if (ph.down) {
            emit({ type: 'kill', kind: ph.kind, hunter: true });
            if (state.helped.once(`${ph.id}:${ph.hunter}`)) pay('hunterHelped');
          }
        } else net?.hit(ph.id, d.damage);
        boom(m, ph.at, Boolean(ph.down));
        if (ph.down) burn(ph.at, ph.size);
        continue;
      }
      if (citadelGeo) {
        const at = siegeHit(shotFrom, m.position, d.punch, true);
        if (at) {
          boom(m, at.clone(), true);
          continue;
        }
      }
      const ch = capitalHit(shotFrom, to, d.punch);
      if (ch) {
        boom(m, ch.at, ch.down || ch.type === 'shielded');
        continue;
      }
      if (remover) {
        const at = removerHit(shotFrom, to, d.punch);
        if (at) {
          boom(m, at, true);
          continue;
        }
      }
      const h = traffic?.hit(shotFrom, to) ?? null;
      if (h) {
        if (!h.glance) {
          emit({ type: 'kill', kind: h.kind });
          state.heat += h.civil ? 1.5 : 1;
          deed(h.civil ? 'killCivil' : 'killPatrol');
        }
        boom(m, h.at, !h.glance);
        if (!h.glance) burn(h.at, h.size);
      } else if (leviathans.hit(shotFrom, to)) {
        boom(m, m.position.clone());
        leviathanShot();
      } else {
        const mh = meteors.hit(shotFrom, to) ?? mines.hit(shotFrom, to);
        if (mh) boom(m, mh.at);
      }
    }
    return any;
  };

  // the weapon readout (its name, the heavy rounds left, the next one
  // filling) and the Citadel's state while you're near it; written only
  // when something in them changes
  let armsSig = '';
  let siegeSig = '';
  const placeArms = () => {
    const el = props.arms?.current;
    if (el) {
      // (not till the guns are first used: the first minute has enough on it)
      const on = state.armed && flying() && !onFoot() && state.view !== 'map' && !state.crash && !props.frozen;
      const arm = arms();
      const sig = on ? `${arm.index}|${arm.id}|${arm.ammo}/${arm.ammoMax}|${Math.floor(arm.filling * 10)}` : '';
      if (sig !== armsSig) {
        armsSig = sig;
        el.toggleAttribute('data-on', on);
        if (on) {
          el.dataset.weapon = arm.id;
          el.dataset.line = arm.line;
          const name = el.querySelector('.universe-arms-name');
          if (name) name.textContent = arm.name;
          el.querySelectorAll('.universe-arms-pip').forEach((pip, i) => {
            pip.hidden = i >= arm.ammoMax; // (as many as the fitted rack holds)
            pip.toggleAttribute('data-full', i < arm.ammo);
            pip.style.setProperty('--fill', i === arm.ammo ? arm.filling.toFixed(2) : '0');
          });
        }
      }
    }
    const sl = props.siege?.current;
    if (!sl || !citadelGeo) return;
    const s = state.ship;
    const d = s ? apart(s.x, s.y, s.z, citadelMid.x, citadelMid.y, citadelMid.z) : Infinity;
    const show = flying() && !onFoot() && !props.frozen && (d < 900 || (siegeSt.down && d < 3000));
    let text = '';
    if (show) {
      if (siegeSt.down) {
        const sec = Math.ceil(siegeSt.rebuildIn / 1000);
        text = `Destroyed · the Ricks rebuild it in ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      } else if (siegeSt.shield) text = `Shield up · ${siegeSt.gensLeft} of ${GENS} generators running · knock them out`;
      else text = `Shield down · core ${Math.max(1, Math.round(siegeSt.core * 100))}% · ${arsenalOf(state.kind).names[2].toLowerCase()} only (3)`;
    }
    const sig = show ? text : '';
    if (sig === siegeSig) return;
    siegeSig = sig;
    sl.toggleAttribute('data-on', show);
    if (!show) return;
    sl.dataset.phase = siegeSt.down ? 'down' : siegeSt.shield ? 'shield' : 'core';
    const line = sl.querySelector('.universe-siege-state');
    if (line) line.textContent = text;
  };

  // the height gauge: where the ship is between the floor and the ceiling,
  // shown while you fly it (brighter while it climbs or dives)
  let altOn = false;
  const placeAlt = () => {
    const el = props.alt?.current;
    if (!el) return;
    const on = flying() && !onFoot() && state.view !== 'map' && !state.crash && !state.dive && !props.frozen;
    if (on !== altOn) {
      altOn = on;
      el.toggleAttribute('data-on', on);
    }
    if (!on) return;
    const s = state.ship;
    el.style.setProperty('--alt', clamp(s.y / SHIP.ceiling, -1, 1).toFixed(3));
    el.toggleAttribute('data-moving', Math.abs(s.vy || 0) > 0.4);
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

  // ── The HUD: the gun line, the lock, the lead and the way to go ──
  // (DOM in UniverseMap.jsx, moved here as the scene draws, like the names)
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
  const threatList = [];
  const mateList = [];
  // a bracket at its point when that's in view, else an arrow at the edge of
  // the open area pointing the way (its size `r`, in px, when it has one)
  const placeMark = (el, p, r = 0) => {
    const off = !onScreen(p.x, p.y, p.z, state.rect);
    let x = p.x;
    let y = p.y;
    if (off) {
      const cx = state.rect.x + state.rect.w / 2;
      const cy = state.rect.y + state.rect.h / 2;
      const k = p.z > 0 ? 1 : -1;
      const edge = edgeOf((p.x - cx) * k, (p.y - cy) * k, state.rect);
      x = edge.x;
      y = edge.y;
      el.style.setProperty('--a', `${edge.angle.toFixed(3)}rad`);
    }
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.toggleAttribute('data-off', off);
    if (r) el.style.setProperty('--r', `${Math.round(r)}px`);
  };
  // (in the nav map's measure, ship-lengths, so the two agree: nav.js)
  const range = (d) => shortDistance(d);
  // where you're going: the autopilot's goal, the picked place you're not
  // yet at, or, out in deep space with nowhere picked, the nearest wonder
  // ahead (as a waypoint, fainter)
  const navGoal = (s) => {
    const id = state.auto?.id ?? (state.sel && state.sel !== state.at ? state.sel : null);
    if (id) return { id, way: false };
    if (openness(s.x, s.y, s.z) < 0.25) return null;
    let best = null;
    for (const wd of WONDERS) {
      const d = apart(s.x, s.y, s.z, wd.at[0], wd.at[1], wd.at[2]);
      if (d > 6500 || d < reachOf(wd) * 1.3) continue;
      const [nx, ny, nz] = nose(s);
      const ahead = ((wd.at[0] - s.x) * nx + (wd.at[1] - s.y) * ny + (wd.at[2] - s.z) * nz) / d;
      if (ahead < 0.45) continue; // within about 63° of the nose
      const score = d * (2 - ahead);
      if (!best || score < best.score) best = { id: wd.id, way: true, score };
    }
    return best;
  };
  let footReticle = null; // (the on-foot crosshair's last state: placeFootHud)
  const placeHud = () => {
    const h = hudEls();
    if (!h.root) return;
    if (onFoot()) return placeFootHud(h);
    if (footReticle?.shown) {
      footReticle = reticleState(footReticle, {});
      emit({ type: 'reticle', state: footReticle });
    }
    const s = state.ship;
    const on = flying() && state.view !== 'map' && !state.crash && !state.dive && !props.frozen;
    // the gun line: a little way out along the nose (not while it flies itself)
    const [nx, ny, nz] = on ? nose(s) : [0, 0, 0];
    const retOn = on && !state.auto;
    setOn(h, h.reticle, retOn);
    if (retOn) {
      toScreen(s.x + nx * 6, s.y + ny * 6, s.z + nz * 6, hudAt);
      h.reticle.style.transform = `translate3d(${hudAt.x.toFixed(1)}px, ${hudAt.y.toFixed(1)}px, 0)`;
      h.reticle.toggleAttribute('data-hot', state.hot);
      h.reticle.toggleAttribute('data-hit', state.hitMark > 0);
    }
    // the lock: brackets round the hunter, its name and range; the lead pip
    // where a shot would meet it
    const tgt = on ? state.lockTarget : null;
    setOn(h, h.lock, Boolean(tgt));
    if (tgt) {
      toScreen(tgt.at.x, tgt.at.y, tgt.at.z, hudAt);
      const px = hudAt.z > 0 ? (tgt.size / (hudAt.z * tanHalf)) * (size.h / 2) * 2.6 : 0;
      placeMark(h.lock, hudAt, clamp(px, 30, 140));
      h.lock.toggleAttribute('data-hot', state.hot);
      setText(h, h.lockName, tgt.name ?? NAMES[tgt.kind] ?? tgt.kind);
      setText(h, h.lockDist, range(apart(tgt.at.x, tgt.at.y, tgt.at.z, s.x, s.y, s.z)));
      // what it has left, for the ones that take a few hits
      const tough = (tgt.hpMax ?? 1) > 1;
      h.lock.toggleAttribute('data-tough', tough);
      if (tough) h.lock.style.setProperty('--hp', (tgt.hp / tgt.hpMax).toFixed(3));
    }
    // the ones coming at you that you can't see: an arrow at the edge each
    // (nearest first), so a fight behind you isn't a surprise
    let n = 0;
    if (on && h.threats.length) {
      threatList.length = 0;
      for (const c of hunters?.targets ?? []) if (c.threat && c.id !== tgt?.id) threatList.push(c);
      // (and a pilot whose shots have been landing on you)
      if (pilots.count) for (const c of pilots.targets) if (c.threat && c.id !== tgt?.id) threatList.push(c);
      threatList.sort((a, b) => apart(a.at.x, a.at.y, a.at.z, s.x, s.y, s.z) - apart(b.at.x, b.at.y, b.at.z, s.x, s.y, s.z));
      for (const c of threatList) {
        if (n >= h.threats.length) break;
        toScreen(c.at.x, c.at.y, c.at.z, hudAt);
        if (onScreen(hudAt.x, hudAt.y, hudAt.z, state.rect)) continue;
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
        if (onScreen(hudAt.x, hudAt.y, hudAt.z, state.rect)) continue;
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
      leadOn = onScreen(hudAt.x, hudAt.y, hudAt.z, state.rect, 8);
      if (leadOn) {
        h.lead.style.transform = `translate3d(${hudAt.x.toFixed(1)}px, ${hudAt.y.toFixed(1)}px, 0)`;
        h.lead.toggleAttribute('data-hot', state.hot);
      }
    }
    setOn(h, h.lead, leadOn);
    // the way to go
    const goal = on ? navGoal(s) : null;
    setOn(h, h.nav, Boolean(goal));
    if (goal) {
      // (another pilot: the diamond's on them, their name as its text)
      const mate = pilotId(goal.id) ? pilots.pose(pilotId(goal.id)) : null;
      const place = !mate && isPlace(goal.id) ? byId(goal.id) : null;
      // (the war's front is neither a place nor a wonder: its own goal, front.js's)
      const war = goal.id === 'front' ? front?.goal() : null;
      const wd = place || war || mate ? null : wonderById(goal.id);
      const at = mate ? [mate.x, mate.y, mate.z] : place ? POSITIONS[goal.id] : war ? war.at : wd?.at;
      if (!at) {
        setOn(h, h.nav, false);
        return;
      }
      toScreen(at[0], at[1], at[2], hudAt);
      // (the Citadel gone, the diamond is round where its core was, not round the empty reach of its arms)
      const reach = mate ? 0.5 : place ? REACH[goal.id] : war ? war.r : wd.id === 'citadel' && siegeSt.down && citadelGeo ? citadelGeo.core * 0.5 : reachOf(wd);
      const px = hudAt.z > 0 ? (reach / (hudAt.z * tanHalf)) * (size.h / 2) * 2.2 : 0;
      // no bigger than a quarter of the frame's height: close in, the place itself shows the way
      placeMark(h.nav, hudAt, clamp(px, 34, Math.min(260, size.h * 0.25)));
      h.nav.toggleAttribute('data-way', goal.way);
      setText(h, h.navName, mate ? mate.name : place ? place.label : war ? 'The front' : wd.name);
      setText(h, h.navDist, range(apart(at[0], at[1], at[2], s.x, s.y, s.z)));
    }
  };

  // ── A crash: into something too fast ──
  const startCrash = (e) => {
    const s = state.ship;
    const solid = solidsNow.find((o) => o.id === e.id) ?? SOLIDS.find((o) => o.id === e.id);
    const center = new THREE.Vector3(...solid.at);
    const from = new THREE.Vector3(s.x, s.y, s.z);
    const normal = from.clone().sub(center).normalize();
    // into a wonder, it's a crash of its own kind
    const wonder = wonderById(e.id) ?? (e.id.includes('-') ? wonderById(e.id.split('-')[0]) : null);
    // (a wonder with a world of its own, the Citadel, crashes under its own name)
    const kind = !wonder || (wonder.id !== e.id && !solid.part) ? null : wonder.kind === 'star' || wonder.kind === 'pulsar' || wonder.kind === 'binary' || wonder.kind === 'graveyard' ? 'star' : wonder.kind.endsWith('giant') || wonder.kind === 'rogue' ? 'giant' : wonder.world ? wonder.id : null;
    const swallow = Boolean(e.swallowed);
    state.crash = {
      age: 0, // seconds of frames since the hit (a hidden tab pauses it)
      id: e.id,
      sun: e.id === 'sun' || kind === 'star',
      kind,
      world: wonder?.world ?? null,
      page: wonder?.page ?? null, // (the Citadel: its own world, inside)
      colour: kind === 'giant' ? (wonder.color ?? wonder.colors?.[0] ?? null) : null, // (the rogue's: its auroras, not its near-black rock)
      swallow, // into the black hole: the fall, then on through to what's beyond it
      fall: swallow ? startFall([s.x, s.y, s.z], camLocal.toArray()) : null, // (maw.js)
      fell: null, // where the ship is in it (fallAt)
      yaw: 0, // the way the camera looks at it, while it falls (below)
      from,
      into: normal.clone().negate(),
      normal,
      radius: solid.r,
      point: center.clone().addScaledVector(normal, solid.r), // where it goes in
      fwd: forward(s.heading),
      speed: e.speed,
      spin: [3 + Math.random() * 5, 2 + Math.random() * 4],
      impact: false,
      asked: false, // has the page been told (props.onCrash)
      through: false, // and gone on into the place's page
      back: false,
    };
    // (into a big ship: the crew's crash line, and back out from where its middle was)
    if (solid.ship) Object.assign(state.crash, { kind: 'ship', ship: true, centre: [...solid.at] });
    state.auto = null;
    state.boosting = false;
    state.interdicted = false;
    burst.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    if (swallow) {
      // pulled well back, to watch it go down (maw.js says from where)
      const [vx, , vz] = state.crash.fall.view;
      state.crash.yaw = -headingTo(-vx, -vz);
      state.view = 'chase'; // (from outside, whichever seat you were in)
      hunters?.clear();
      meteors.clear();
      mines.clear();
      dropEscort();
      dropEclipse();
      wingmen?.clear();
      skirmishes?.clear();
      npcs?.clear();
      infall?.dispose();
      infall = createInfall(map, { color: plumeColor(), shadow: MAW.shadow, at: MAW.at });
      infall.start();
      retarget(reduced ? 0 : 1700);
      emit({ type: 'crash', id: e.id, swallowed: true }); // (said as the fall begins: there's no impact to wait for)
    } else retarget(650); // the camera pulls back to watch it
  };
  // ── Shot down: the hunters' lasers (or another pilot's, `by`) took the
  // last of the shields ──
  const startDestroyed = (by = null, rammed = false) => {
    const s = state.ship;
    const from = new THREE.Vector3(s.x, s.y, s.z);
    state.crash = {
      age: 0,
      id: 'shot',
      shot: true,
      sun: false,
      from,
      into: new THREE.Vector3(), // it tumbles where it is
      normal: new THREE.Vector3(0, 1, 0),
      radius: 0.35,
      point: from.clone(),
      fwd: forward(s.heading),
      speed: s.speed,
      spin: [6 + Math.random() * 6, 4 + Math.random() * 5],
      impact: false,
      asked: false,
      through: false,
      back: false,
    };
    state.auto = null;
    state.boosting = false;
    burst.clear();
    hunters?.clear();
    meteors.clear();
    mines.clear();
    dropEscort();
    dropEclipse();
    wingmen?.clear();
    skirmishes?.clear();
    npcs?.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    if (by) net?.down(by, rammed); // everyone hears who got you
    law?.down(); // (the chase is over; the bounty isn't)
    emit({ type: 'destroyed' });
    retarget(650);
  };

  // a laser into the shields: down they go (shot down at nothing left).
  // `by`: the pilot whose shot it was, if it was one (`rammed`: their ram)
  const hurt = (damage, by = null, rammed = false) => {
    if (state.crash || !state.ship) return;
    if (by && state.clock < state.safeUntil) return;
    state.shield = Math.max(0, state.shield - damage * state.stats.armor); // (less, with plating fitted)
    state.hurtNow = (state.hurtNow ?? 0) + damage; // (the director's intensity: what you've taken this frame)
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

  // The ship's way this frame, from `from` to `to`, swept against the rock
  // fields it comes near (each in its own frame: the belt and the rim turn,
  // the streams drift). The first rock it meets is smashed (gone a while);
  // at the boost or under that's a bump, faster it's off the shields, more
  // the faster and the bigger the rock, and the ship's knocked back down
  // under the pulse drive.
  let rockCool = -1e9;
  let rockSaidAt = -1e9;
  const rockMap = new THREE.Vector3();
  const rockShip = new THREE.Vector3();
  const rocksHit = (from, to, t) => {
    for (const f of rockFields) {
      const gone = smashed.get(f.id);
      for (const [i, back] of gone) {
        if (state.clock < back) continue;
        gone.delete(i);
        f.field.show(i);
      }
    }
    if (state.clock < rockCool || Math.abs(to.speed) < 2) return;
    let hit = null;
    for (const f of rockFields) {
      let a;
      let b;
      if (f.ring) {
        if (!nearRing(from, to, f.ring)) continue;
        a = toBelt(from, t * f.spin);
        b = toBelt(to, t * f.spin);
      } else {
        const d = DEBRIS_DRIFT(t);
        a = { x: from.x - d.x, y: from.y - d.y, z: from.z - d.z };
        b = { x: to.x - d.x, y: to.y - d.y, z: to.z - d.z };
        if (!nearBox(a, b, f.box)) continue;
      }
      const h = sweep(f.grid, a, b, SHIP.radius, smashed.get(f.id));
      if (h && (!hit || h.t < hit.t)) hit = { ...h, f };
    }
    if (!hit) return;
    const { f } = hit;
    const o = f.grid.rocks[hit.i];
    f.field.hide(hit.i);
    smashed.get(f.id).set(hit.i, state.clock + ROCK_HIT.gone);
    rockCool = state.clock + ROCK_HIT.cool;
    // where the rock is on the map, and the ship as it met it
    if (f.ring) {
      const m = toBelt(o, -t * f.spin);
      rockMap.set(m.x, m.y, m.z);
    } else {
      const d = DEBRIS_DRIFT(t);
      rockMap.set(o.x + d.x, o.y + d.y, o.z + d.z);
    }
    rockShip.set(from.x + (to.x - from.x) * hit.t, from.y + (to.y - from.y) * hit.t, from.z + (to.z - from.z) * hit.t);
    pops.hit({ point: rockMap.clone(), normal: popDir.copy(rockShip).sub(rockMap).normalize(), radius: o.r * 1.6 });
    const speed = Math.abs(to.speed);
    const damage = rockDamage(speed, o.r);
    if (damage <= 0) {
      // (as hard as the law's full at the speed a rock starts to hurt)
      const force = (speed / ROCK_HIT.fast) * bumpLaw.values().full;
      bumped(force);
      emit({ type: 'bump', id: 'rock', hard: false, speed, force });
      return;
    }
    if (state.clock >= state.safeUntil) hurt(damage);
    if (!state.ship || state.crash) return;
    if (!reduced) state.shake = Math.max(state.shake, 0.9);
    state.flare = Math.max(state.flare, 1.6);
    state.ship = { ...state.ship, speed: Math.sign(state.ship.speed || 1) * Math.max(SHIP.boost, speed * ROCK_HIT.slow) };
    state.note = { text: `Hit a rock at speed: shields −${Math.round(damage)}`, until: wall() + 2.5 };
    if (state.clock - rockSaidAt > 8) {
      rockSaidAt = state.clock;
      emit({ type: 'event', id: 'rock' });
    }
  };

  // The ship's way this frame swept against every other small ship
  // (shipHits.js; the big ones are solids, in the step): a glance pushes it
  // off with a soft bump, a ram takes the shields (not just back from a
  // crash) and the other ship takes the hit as from a shot, through the same
  // path a shot's takes (hunterShot, pilotShot, trafficShot). The other
  // ship's knocked off its line where its system can be (body.push: the
  // hunters, the wingmen); another pilot's told (client.js's ram), and takes
  // it off their own shields (onNet's 'rammed')
  const shipsHit = (from, to, dt) => {
    wayNow = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const h = shipHits.sweep(from, to, dt, state.clock);
    if (!h) return;
    const { body, outcome } = h;
    state.ship = { ...state.ship, x: h.touch.x, y: h.touch.y, z: h.touch.z, speed: keptSpeed(state.ship.speed, outcome.keep, SHIP.boost) };
    body.push?.(h.push);
    if (outcome.kind === 'glance') {
      if (!reduced) state.shake = Math.max(state.shake, 0.25);
      emit({ type: 'bump', id: body.kind, hard: false });
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
    state.note = { text: ramNote(NAMES[body.kind] ?? body.kind, outcome.damage), until: wall() + 2.5 };
    emit({ type: 'bump', id: body.kind, hard: true });
    if (body.key.startsWith('p:')) {
      net?.ram(body.id, h.into);
      pilotRammedAt.set(body.id, state.clock);
      return;
    }
    const r = body.hit(outcome.punch, from, to);
    if (!r) return;
    const normal = popDir.set(h.normal.x, h.normal.y, h.normal.z);
    if (body.key.startsWith('t:') ? !r.glance : r.down) rammedDownAt = state.clock;
    if (body.key.startsWith('t:')) trafficShot(r, normal, true);
    else if (body.key.startsWith('g:')) pilotShot(r, outcome.punch, outcome.damage, normal, true);
    else if (body.key.startsWith('sk:')) hunterShot(skirmishHelp(r), normal, true);
    else if (body.key.startsWith('f:')) hunterShot(frontShip(r), normal, true);
    else hunterShot(r, normal, true);
  };
  // another pilot flew into you (client.js believed it: ramCounts): the
  // law's ram as you'd take one flying into them, their ship the size
  // pilots.js draws it, your speed knocked back
  const rammedBy = (e) => {
    if (!state.ship || state.crash || state.view === 'map') return;
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
    const who = net?.peers?.get(e.from)?.name;
    state.note = { text: `Rammed by ${who || 'another pilot'}: shields −${Math.round(o.damage)}`, until: wall() + 2.5 };
    emit({ type: 'bump', id: 'pilot', hard: true });
  };

  // what the link to the other pilots reports: their hits on you, and
  // someone going down (a pop where they were; yours, if it was your shot)
  const onNet = (e) => {
    if (e.type === 'siege') {
      // another pilot's word on the Citadel: behind (an older life of it)? tell them how it is
      if (e.msg.e < siege.epoch) {
        siegeOwed = true;
        return;
      }
      const near = Boolean(state.ship) && apart(state.ship.x, state.ship.y, state.ship.z, citadelMid?.x ?? 0, citadelMid?.y ?? 0, citadelMid?.z ?? 0) < 1600;
      for (const ev of siege.receive(e.from, e.msg, Date.now())) {
        readSiegeState();
        if (ev.type === 'gen') emit({ type: 'siege', what: 'gen', left: ev.left, near });
        else if (ev.type === 'down') siegeDown(false);
        else if (ev.type === 'rebuilt') {
          siegeMine = false;
          emit({ type: 'siege', what: 'rebuilt', near });
        }
      }
      return;
    }
    if (e.type === 'hit') hurt(e.damage, e.from);
    else if (e.type === 'rammed') rammedBy(e);
    else if (e.type === 'hunterHit') {
      // another pilot's bolt into one of the hunters after you
      const r = hunters?.damage(e.id, e.damage);
      if (r) {
        pops.hit({ point: r.at, normal: new THREE.Vector3(0, 1, 0), radius: r.down ? r.size * 1.8 : 0.2 });
        if (r.down) burn(r.at, r.size);
        if (r.down) net?.helped?.(e.from, NAMES[r.kind] ?? 'hunter');
      }
    } else if (e.type === 'downed') {
      const at = pilots.at(e.id);
      if (at) pops.hit({ point: at, normal: new THREE.Vector3(0, 1, 0), radius: 0.55 });
      if (e.by && e.by === net?.selfId) {
        const ram = state.clock - (pilotRammedAt.get(e.id) ?? -Infinity) <= GUARD.killWindow / 1000; // (yours by your ram: said as one)
        emit({ type: 'kill', kind: 'pilot', ...(ram ? { ram } : null) });
        pay('killPilot');
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

  // whose universe each ship flies in: the crew's side (sides.js)
  const TRENCHED = SOLIDS.filter((o) => o.band); // what has a trench to fly down
  // what the hunters report
  const onHunters = (e) => {
    if (e.type === 'hunted') {
      // (ace: the kind of the faction's ace, when it came along, for its own line)
      const ace = FACTIONS_ALL[e.faction]?.ace;
      if (!e.prey) emit({ type: 'hunted', faction: e.faction, ace: ace && e.kinds.includes(ace) ? ace : null });
      // dropped in ahead of you on the way somewhere: they hold the pulse
      // drive down while they're on you (a jolt as it cuts)
      if (e.interdict && !state.interdicted && state.ship) {
        state.interdicted = true;
        state.interdictAt = state.clock;
        if (!reduced) {
          state.flare = Math.max(state.flare, 1.8);
          state.shake = Math.max(state.shake, 0.6);
          state.kick = 1;
        }
        emit({ type: 'interdicted', faction: e.faction });
      }
    } else if (e.type === 'laser') {
      hurt(e.damage * diff().damage);
      state.hitBy = e.by ?? null; // (the wing goes for the one that hit you last)
      // (a bomb's burst shakes the ship as a laser doesn't, nor a missile's, nor a rammer's)
      if ((e.bomb || e.missile || e.ram) && !reduced) state.shake = Math.max(state.shake, e.ram ? 0.8 : 0.5);
      // an ion bolt holds the boost and the pulse drive down a moment
      if (e.ion) {
        state.ionUntil = state.clock + ION.slow;
        if (!reduced) state.static = Math.max(state.static, 0.6);
        state.note = { text: 'Ion hit: drives down', until: wall() + 2 };
      }
    } else if (e.type === 'shot') emit(e);
    else if (e.type === 'missile') {
      // a missile after you: the HUD says so (once a few seconds)
      if (state.clock - (state.missileSaid ?? -1e9) > 4) {
        state.missileSaid = state.clock;
        state.note = { text: 'Missile inbound: break hard, or outrun it', until: wall() + 2.5 };
      }
    } else if (e.type === 'rammed') burn(new THREE.Vector3(e.at.x, e.at.y, e.at.z), e.size * 2.2);
    else if (e.type === 'spotlit') {
      // pinned in a spotlight: the HUD whites out a moment, and the lock with it
      state.static = Math.max(state.static, 1.5);
      if (state.clock - state.spotSaid > 20) {
        state.spotSaid = state.clock;
        emit({ type: 'event', id: 'spotlit' });
      }
    }
    else if (e.type === 'stage') {
      // an ace hurt into its next stage (hunterRules.js): the crew say so (by
      // who), and whoever it calls in comes
      emit({ type: 'event', id: 'stage', sub: e.kind });
      if (e.summon && state.ship && !state.crash) {
        hunters.pack(e.summon, state.ship, { size: 2, ace: false, heat: state.heat });
        hunts += 1;
      }
    } else if (e.type === 'escaped' || e.type === 'cleared') {
      if (e.rescued) deed('rescued');
      // (the last of them rammed down: the crew's ram line for it)
      emit(e.rescued ? { type: 'event', id: 'rescued' } : e.type === 'cleared' && state.clock - rammedDownAt <= RAM_CLEARED ? { ...e, ram: true } : e);
      // the Star Destroyer's fighters gone: another wave, or it jumps away
      // (capitalRules.js decides; its events below); the roadblock's helicopter climbs off
      if (pieces.destroyerHere && !hunters.active) pieces.cleared();
      else if (pieces.chopperHere && !hunters.active) pieces.leave();
    }
  };

  // what the director sets going
  // on the way somewhere (out in the open at speed), a pack comes in ahead
  // of you and interdicts you: an ambush (laid where you'll be once they've
  // pulled the drive down, not where you are: at the pulse drive's speed
  // that's a few hundred units on)
  const travelling = (s) => openness(s.x, s.y, s.z) > 0.5 && Math.abs(s.speed) > 40;
  const leadOf = (s) => holdReach(s, { ramp: INTERDICT_IN, solids: siegeSt.down ? SOLIDS_OPEN : SOLIDS });
  const happen = (id, ship) => {
    const side = sideHere();
    if (!side) return;
    const ambush = travelling(ship) ? { ahead: true, interdict: true, lead: leadOf(ship) } : {};
    // (more of them, and the ace more often, the more trouble you've made; the first pack is a small one)
    const strength = { heat: state.heat, first: hunts === 0 };
    if (id === 'hunt' || id === 'council' || id === 'roadblock') hunts += 1;
    if (id === 'hunt') hunters.pack(pickFaction(side, 'hunt'), ship, { ...ambush, ...strength });
    else if (id === 'council') pieces.portals(hunters.pack(pickFaction(side, 'council'), ship, { ...ambush, ...strength }));
    else if (id === 'roadblock') {
      // the DEA across your bows: in ahead, and holding you there
      const lead = ambush.lead ?? 0;
      hunters.pack('dea', ship, { ahead: true, interdict: true, lead, ace: Math.random() < 0.5, ...strength });
      pieces.roadblock(ship, lead); // (and a helicopter over it, its searchlight on you)
      emit({ type: 'event', id: 'roadblock' });
    } else if (id === 'destroyer') {
      if (!pieces.destroyer(ship, side.capitalShip)) return;
      emit({ type: 'event', id: 'destroyer' });
      // (its fighters launch a moment after it's here: its 'launch' event, in adventure)
      capFight = { interdict: Boolean(ambush.interdict), said: new Set(), hurt: false };
    } else if (id === 'remover') {
      if (remover) return;
      // over the planet you're at, or the nearest one near enough to see it
      let pick = null;
      for (const pid of ORDER) {
        const u = byId(pid);
        if (u.kind === 'core') continue;
        const [px, py, pz] = POSITIONS[pid];
        const d = apart(ship.x, ship.y, ship.z, px, py, pz);
        if (d < u.size * 5 && (!pick || d < pick.d)) pick = { id: pid, d, size: u.size };
      }
      if (!pick || removed[pick.id]) return;
      const c = new THREE.Vector3(...POSITIONS[pick.id]);
      // beside it, round from you a little, its nose on it
      const out = new THREE.Vector3(ship.x - c.x, 0, ship.z - c.z);
      if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
      out.normalize().applyAxisAngle(Y_AXIS, (Math.random() < 0.5 ? -1 : 1) * 0.6);
      const at = c.clone().addScaledVector(out, pick.size + NX5_LEN * 1.15).add(new THREE.Vector3(0, pick.size * 0.22, 0));
      remover = newRemover(pick.id);
      removerView.start(at, c);
      emit({ type: 'event', id: 'remover' });
    } else if (id === 'distress') {
      const prey = traffic?.distress(ship, side);
      if (!prey) return;
      hunters.pack(pickFaction(side, 'pirates'), ship, { prey, size: 2, ace: false });
      emit({ type: 'event', id: 'distress' });
    } else if (id === 'convoy') traffic?.convoy(ship, side);
    else if (id === 'comet') {
      pieces.comet(ship);
      later.push({ at: state.clock + 5, run: () => emit({ type: 'event', id: 'comet' }) });
    } else if (id === 'supernova') {
      // the nearest site that's still a good way off (so it's a sight, not a blast)
      const sites = SUPERNOVA_SITES.map((at) => ({ at, d: Math.hypot(at[0] - ship.x, at[1] - ship.y, at[2] - ship.z) })).filter((o) => o.d > 1100).sort((a, b) => a.d - b.d);
      const site = (sites[Math.floor(Math.random() * Math.min(2, sites.length))] ?? sites[0])?.at;
      if (!site) return;
      novae.explode(site, { color: ['#9fc6ff', '#ffd9a0', '#ffffff'][Math.floor(Math.random() * 3)] });
      later.push({ at: state.clock + 2.2, run: () => emit({ type: 'event', id: 'supernova' }) });
    } else if (id === 'flare') {
      // the nearest star flares; its shockwave reaches you a while after
      const { star } = nearestStar(ship.x, ship.y, ship.z);
      const f = pieces.flare(star, ship);
      if (!f) return;
      emit({ type: 'event', id: 'flare' });
      later.push({
        at: state.clock + f.arrives,
        run: () => {
          if (!state.ship || state.crash) return;
          hurt(15);
          state.static = 4;
          state.flare = Math.max(state.flare, 2.2);
          if (!reduced) state.shake = Math.max(state.shake, 0.8);
        },
      });
    } else if (id === 'rift') {
      if (!pieces.rift(ship)) return;
      emit({ type: 'event', id: 'rift' });
      state.note = { text: 'A rift has opened ahead: fly into it', until: wall() + 5 };
    } else if (id === 'leviathan') {
      const sub = leviathans.pass(ship, side);
      if (!sub) return;
      later.push({ at: state.clock + 3, run: () => emit({ type: 'event', id: 'leviathan', sub }) });
    } else if (id === 'meteors') {
      if (meteors.storm(ship)) emit({ type: 'event', id: 'meteors' });
    } else if (id === 'eclipse') {
      // a moon across the sun that lights you, from where you are
      const star = litBy.key && LIT_STARS.find((st) => st.id === litBy.key.id);
      if (!star || eclipse) return;
      // (from the eye: the chase camera sits a few units off the ship, enough
      // to put the moon off the sun's middle 70 units out)
      camera.getWorldPosition(eclipseEye);
      eclipse = { plan: eclipsePlan({ eye: map.worldToLocal(eclipseEye).toArray(), sun: star }), t0: state.clock, star };
      if (!eclipseMoon) {
        // (round, its night side to you: a dark disc on the sun)
        eclipseMoon = new THREE.Mesh(new THREE.SphereGeometry(1, small ? 32 : 64, small ? 24 : 48), new THREE.MeshStandardMaterial({ color: '#3a3634', roughness: 0.95, metalness: 0 }));
        eclipseMoon.name = 'eclipse moon';
        map.add(eclipseMoon);
      }
      eclipseMoon.scale.setScalar(eclipse.plan.r);
      eclipseMoon.visible = true;
      emit({ type: 'event', id: 'eclipse' });
    } else if (id === 'minefield') {
      if (mines.lay(ship)) emit({ type: 'event', id: 'minefield' });
    } else if (id === 'escort') {
      // beside you and a little ahead, bound for the next place along
      if (escort || !traffic) return;
      const to = escortTo(ship, PLACES.map((p) => ({ id: p.id, at: p.at, r: p.reach })));
      if (!to) return;
      const [fx, fz] = forward(ship.heading);
      const from = [ship.x + fx * 10 - fz * 6, ship.y + 1.5, ship.z + fz * 10 + fx * 6];
      const plan = escortPlan({ from, to: to.at, reach: to.r });
      if (plan.length < 40) return;
      const run = traffic.escort(plan.path, ESCORT.speed, side);
      if (!run) return;
      escort = { plan, run, t0: state.clock, sent: 0, hull: 1, side, to: to.id };
      if (side.id === 'rickmorty') pieces.portals([new THREE.Vector3(...from)]); // (Rick's universe goes by portal)
      emit({ type: 'event', id: 'escort' });
    } else if (id === 'bounty') {
      // one hunter, tough and quick: Boba Fett in Slave I (its model, once it's
      // here: Vader stands in till then), Phoenixperson, or the Cousins
      const who = pickFaction(side, 'bounty');
      if (who === 'fett' && !fleet.loaded('slave1')) {
        fleet.want(['slave1']);
        hunters.pack('empire', ship, { size: 1, ace: true, interdict: ambush.interdict });
      } else if (who) hunters.pack(who, ship, { size: 1, ace: false, interdict: ambush.interdict });
    }
  };

  // the light bending round the black hole: where it is on the canvas and
  // how big its shadow looks there (none behind you, or too far to matter),
  // how far off its near side is (what's nearer, the ship, isn't bent), and
  // its spin's twist, and the shadow's edge (inside it nothing gets out, not
  // even the bloom's glow off the ring). Close in, the bending's held back,
  // or its shadow would fill the screen from a long way off and hide
  // everything round it; falling in after the ship, it's let go, and the
  // shadow takes the screen
  const lensAt = new THREE.Vector3();
  const lensCam = new THREE.Vector3();
  const bend = () => {
    const L = deep.lens?.();
    if (!L || reduced) return post.lens(0, 0, 0);
    map.localToWorld(lensAt.copy(L.at));
    const d = lensAt.distanceTo(camera.position);
    const plunge = state.crash?.swallow ? plungeAt(state.crash.age) : 0;
    if (d < L.r * 1.05) return post.lens(0.5, 0.5, 4, { front: 0, black: 9 }); // in past it: nothing but black
    const front = Math.min(lensAt.clone().applyMatrix4(camera.matrixWorldInverse).z * -1 - L.r * 1.6, 625);
    lensAt.project(camera);
    if (d > 3500 || lensAt.z > 1 || Math.abs(lensAt.x) > 1.6 || Math.abs(lensAt.y) > 1.6) return post.lens(0, 0, 0);
    const z = L.r / (d * tanHalf) / 2; // (as a share of the canvas's height)
    const held = z / Math.sqrt(1 + (z / 0.3) ** 2);
    const r = held + (z - held) * plunge;
    // the shadow's edge on the canvas: the sphere's, pushed out by the bending
    const S = Math.tan(Math.asin(Math.min(1, L.r / d))) / tanHalf / 2;
    const edge = (S + Math.sqrt(S * S + 4 * r * r)) / 2;
    // turned the way its disk goes round, as seen from this side of it
    map.worldToLocal(lensCam.copy(camera.position)).sub(L.at);
    const facing = Math.sign(lensCam.dot(new THREE.Vector3(...DISK_N))) || 1;
    const twist = -(0.1 + 0.45 * state.pull + 1.6 * plunge) * facing;
    post.lens((lensAt.x + 1) / 2, (lensAt.y + 1) / 2, r, { front, twist, black: edge });
  };

  // the shields bar: shown while there's trouble about or they're down at all
  let shieldOn = false;
  // the law's strip (UniverseMap's): its stars, what it's doing (wanted, a
  // witness's report on its way, searching, or just the bounty), the bounty
  let wantedKey = '';
  const placeWanted = () => {
    const el = props.wanted?.current;
    if (!el) return;
    const r = wanted.report;
    const on = flying() && !onFoot() && state.view !== 'map' && !state.crash && !props.frozen && (wanted.stars > 0 || wanted.bounty > 0 || Boolean(r));
    const word = wanted.stars ? (wanted.phase === 'search' ? `Searching ${Math.ceil(wanted.searchLeft)}s` : 'Wanted') : r ? `Witness ${Math.ceil(r.left)}s` : 'Bounty';
    const key = `${on}|${wanted.stars}|${word}|${wanted.bounty}`;
    if (key === wantedKey) return;
    wantedKey = key;
    el.toggleAttribute('data-on', on);
    el.toggleAttribute('data-search', wanted.phase === 'search');
    el.querySelectorAll('.universe-wanted-stars i').forEach((star, i) => star.toggleAttribute('data-lit', i < wanted.stars));
    const w = el.querySelector('.universe-wanted-word');
    const b = el.querySelector('.universe-wanted-bounty');
    if (w) w.textContent = word;
    if (b) b.textContent = wanted.bounty ? `${wanted.bounty} ¢` : '';
  };
  const placeShield = () => {
    const el = props.shield?.current;
    if (!el) return;
    // (on foot, it's your health: while there's trouble about or you're hurt)
    const info = onFoot() && foot.phase === 'walk' ? foot.info() : null;
    const on = info ? Boolean(info.troops.length || info.health < 0.995) && !props.frozen : flying() && !onFoot() && state.view !== 'map' && !state.crash && !state.dive && !props.frozen && Boolean(hunters?.active || state.shield < 99.5);
    if (on !== shieldOn) {
      shieldOn = on;
      el.toggleAttribute('data-on', on);
    }
    if (!on) return;
    const k = info ? info.health : state.shield / 100;
    el.style.setProperty('--shield', k.toFixed(3));
    el.toggleAttribute('data-low', k < 0.35);
  };

  // friends in a long fight (wingmen.js): once a hunt has dragged on, or
  // the shields are low in one, a wing comes up from behind you (once a
  // hunt, more often than not: X-wings for Luke and Han, Birdperson for
  // Rick, either for Walt and Jesse), and what it hits is put on the hunters
  const WING_CALL = { after: 14, low: 55, lowAfter: 5, chance: 0.7 };
  const wingTargets = []; // (the hunters after you, not pirates on someone else: reused)
  const helpFrom = (dt, t, live) => {
    wingTargets.length = 0;
    if (live) for (const o of hunters.targets) if (!o.prey) wingTargets.push(o);
    const fighting = Boolean(live && hunters.active);
    state.huntFor = fighting ? state.huntFor + dt : 0;
    if (!fighting) state.wingAsked = false; // (a wing still flying off from the last fight comes back of itself if another starts)
    if (fighting && !state.wingAsked && !wingmen.active && (state.huntFor > WING_CALL.after || (state.shield < WING_CALL.low && state.huntFor > WING_CALL.lowAfter))) {
      state.wingAsked = true;
      const many = wingTargets.length;
      if (many >= 2 && Math.random() < WING_CALL.chance) {
        const kind = wingOf(sideFor(state.kind));
        if (kind) wingmen.join(kind, live, many >= 4 ? 3 : 2);
      }
    }
    const r = wingmen.update(dt, t, live, wingTargets, { grudge: state.hitBy ?? null });
    for (const h of r.hits) {
      // (only a kill goes off: there's one burst for the whole map, and
      // the wing's hits mustn't cut short your own)
      const got = hunters.damage(h.id, h.damage);
      if (got?.down) {
        pops.hit({ point: got.at, normal: popDir.set(0, 1, 0), radius: got.size * 1.8 });
        burn(got.at, got.size);
      }
    }
    for (const e of r.events) {
      if (e.type === 'joined') emit({ type: 'event', id: 'wingmen', sub: e.kind });
      else if (e.type === 'leaving' && live) emit({ type: 'event', id: 'wingmenGone' });
    }
  };

  // the named characters (npcs/index.js, npcRules.js): now and then, while
  // nothing's after you, one of your side's comes by on their own (Saul to a
  // station with a deal, Mike alongside with word of what's coming, Evil
  // Morty for a duel); what they say, the crew's comms say, their shots land
  // where they hit, and one that's the wing's or the hunt's is handed over
  const NPC_EVERY = [85, 150]; // seconds between them
  const STATIONS = PLANETS.map((p) => ({ id: p.id, at: { x: p.at[0], y: p.at[1], z: p.at[2] }, r: p.r }));
  const npcWorld = { you: null, hunters: [], stations: STATIONS, solids: SOLIDS, next: null, heat: 0, shield: 100, stims: [] }; // (stims: your shots this frame, heard by the characters, and dodged by a nemesis they're aimed at)
  const meet = (dt, t, live) => {
    const side = sideHere();
    if (live && side && !npcs.count && state.clock > state.npcAt && !hunters.count && !skirmishes?.active && !pieces.destroyerHere && !leviathans.busy && state.view !== 'map') {
      state.npcAt = state.clock + NPC_EVERY[0] + Math.random() * (NPC_EVERY[1] - NPC_EVERY[0]);
      const who = visitorsOf(side.id).filter((c) => c.id !== state.npcLast);
      const npc = who[Math.floor(Math.random() * who.length)] ?? visitorsOf(side.id)[0];
      const at = npc && skirmishSpot(live);
      if (at) {
        npcs.add(npc, at);
        state.npcLast = npc.id;
      }
    }
    npcWorld.you = live;
    npcWorld.hunters = live ? hunters.targets : [];
    npcWorld.heat = state.heat;
    npcWorld.shield = state.shield;
    npcWorld.wanted = standing.wanted;
    npcWorld.feared = standing.feared;
    npcWorld.friend = standing.friend;
    // (what's coming next, picked now, only while there's someone to tell you)
    npcWorld.next = live && npcs.live.some((m) => tells(m.npc.brain)) ? director.foretell(side) : null;
    const npcEvents = npcs.update(dt, t, npcWorld);
    npcWorld.stims.length = 0;
    for (const e of npcEvents) {
      const id = npcs.live.find((m) => m.n === e.n)?.npc.id ?? e.id;
      if (e.type === 'say') {
        emit({ type: 'npc', id: e.id, key: e.key });
        if (e.key === 'clean') deed('clean');
      } else if (e.type === 'offer') emit({ type: 'npc', id, key: 'offer', part: offerFor()?.name ?? null });
      else if (e.type === 'tip') {
        emit({ type: 'npc', id, key: 'tip', sub: e.next?.id ?? null });
        if (npcs.live.find((m) => m.n === e.n)?.npc.brain === 'trickster') deed('paidToll'); // (you held still for a pirate)
      } else if (e.type === 'shot' && e.hit) {
        if (e.at === 'you') hurt(e.damage);
        else {
          const got = hunters.damage(e.at, e.damage);
          if (got?.down) {
            pops.hit({ point: got.at, normal: popDir.set(0, 1, 0), radius: got.size * 1.8 });
            burn(got.at, got.size);
          }
        }
      } else if (e.type === 'delegate' && live) {
        // (the wing or the hunt flies this one: Birdperson, Fett)
        if (e.via === 'wing') wingmen?.join(e.kind, live, 1);
        else hunters.pack(e.faction, live, { size: 1 });
        npcs.remove(e.n);
      } else if ((e.type === 'busted' || e.type === 'calls') && live && !state.crash) {
        // the law (or a pirate) calling its friends in on you, or a nemesis
        // bringing some: a pack of its faction, in behind you
        const f = FACTIONS_ALL[e.faction] ? e.faction : (pickFaction(side, 'hunt') ?? 'empire');
        hunters.pack(f, live, { size: e.size ?? (e.type === 'calls' ? 2 : 3), ace: false, heat: state.heat });
        hunts += 1;
        // (and your standing: with the law, by why; with the pirates, for angering one of theirs)
        if (e.type === 'busted') {
          if (FACTIONS_ALL[f]?.role === 'pirates') deed('angeredPirates');
          else deed(e.why === 'run' ? 'ran' : e.why === 'shot' ? 'shotLaw' : 'busted');
        }
      }
    }
  };
  // a part the hangar has that this ship hasn't got fitted (a merchant's offer)
  const offerFor = () => {
    const fitted = new Set(Object.values(state.loadout ?? {}));
    const open = PARTS.filter((p) => p.id !== STOCK && !p.achievement && !fitted.has(p.id));
    return open[Math.floor(Math.random() * open.length)] ?? null;
  };

  // someone else's fight (skirmishes.js): now and then, while nothing's
  // after you, out ahead of you: a freighter under attack and its escort
  // fighting the attackers off. Fly in and help; the crew have a word when
  // it starts, and the freighter's crew thank you if you did
  const SKIRMISH_EVERY = [110, 180]; // seconds between them
  // a spot out ahead of the ship, near enough to see, clear of anything solid
  const skirmishSpot = (s) => {
    const n = nose(s);
    const l = Math.hypot(n[0], n[2]) || 1;
    for (let i = 0; i < 6; i++) {
      const d = 70 + Math.random() * 40;
      const side = (Math.random() - 0.5) * 50;
      const at = { x: s.x + (n[0] / l) * d - (n[2] / l) * side, y: s.y + (Math.random() - 0.5) * 16, z: s.z + (n[2] / l) * d + (n[0] / l) * side };
      if (SOLIDS.every((o) => Math.hypot(at.x - o.at[0], at.y - o.at[1], at.z - o.at[2]) > o.r + 50)) return at; // (the freighter goes round in a ring 40-odd across)
    }
    return null;
  };
  // (at a waypoint in the region you're headed for, or a beacon, further
  // than farFights.js's FAR: seen from afar, somewhere to go)
  const fightGoal = () => (state.auto ? destinationById(state.then?.id ?? state.auto.id) : null);
  const farFight = (dt, t, live) => {
    if (!skirmishes.active && live && state.clock > state.skirmishAt && !hunters.count && !pieces.destroyerHere && !leviathans.busy && !meteors.count && state.view !== 'map') {
      state.skirmishAt = state.clock + SKIRMISH_EVERY[0] + Math.random() * (SKIRMISH_EVERY[1] - SKIRMISH_EVERY[0]);
      const side = sideHere();
      const goal = fightGoal();
      const node = side && pickFightNode({ ship: live, headedFor: goal ? (regionAt(...goal.at)?.id ?? null) : null });
      const at = node && placeAt(node, SOLIDS);
      if (at && skirmishes.start({ at, heading: Math.random() * Math.PI * 2, ...side.skirmish })) {
        state.skirmishHelped = 0;
        state.skirmishFamily = side.id;
        later.push({ at: state.clock + 1.5, run: () => emit({ type: 'event', id: 'skirmish', sub: side.id }) });
      }
    }
    for (const e of skirmishes.update(dt, t, live)) {
      if (e.type === 'down') {
        const at = new THREE.Vector3(e.at.x, e.at.y, e.at.z);
        pops.hit({ point: at, normal: popDir.set(0, 1, 0), radius: e.side === 'freighter' ? 2.4 : 0.6 });
        burn(at, e.side === 'freighter' ? 1.3 : 0.35);
      }
      // the freighter jumping away (to lightspeed, or through a portal)
      if (e.type === 'away' || (e.type === 'over' && e.winner === 'jumped')) crashFx.arrive({ point: new THREE.Vector3(e.at.x, e.at.y, e.at.z), kind: state.skirmishFamily === 'rickmorty' ? 'cruiser' : 'xwing', heading: e.heading ?? 0 });
      else if (e.type === 'over' && live) {
        if (e.winner === 'escort' && state.skirmishHelped > 0) {
          emit({ type: 'event', id: 'skirmishThanks' });
          deed('helped');
        }
        else if (e.winner === 'enemy' && state.skirmishHelped > 0) emit({ type: 'event', id: 'skirmishLost' });
      }
    }
  };

  // the fights going on (a skirmish, the war's front), as the far fights'
  // impostors and the chart see them (the front's battle is drawn within its own ZONE.near)
  const fightsNow = () => {
    const list = [];
    const sk = skirmishes?.active && skirmishes.info;
    if (sk?.freighter) list.push({ id: 'skirmish', at: sk.freighter.at, size: 1 + sk.hunters.length + sk.escort.length, hot: sk.over ? 0.15 : Math.min(1, sk.hunters.length / 4) });
    const w = front?.where();
    if (w) list.push({ id: 'front', at: w.at, size: 40, hot: 0.7, near: FRONT_ZONE.near });
    return list;
  };

  // the fight with the director's capital ship (capitalRules.js's events,
  // through setpieces.js): its fighters out of its belly (and a second wave
  // if the first is seen off while its shields stand), its turbolasers at
  // you, its shield parts going, its bridge open, it running or going up
  let capFight = null; // { interdict, said, hurt } while one's here
  const capitalEvent = (e, live) => {
    const side = sideHere();
    if (e.type === 'launch') {
      if (live && !state.crash && side) hunters.pack(pickFaction(side, 'capital') ?? 'empire', live, { from: new THREE.Vector3(...e.from), size: e.wave > 1 ? 4 : 3, ace: Math.random() < 0.35, interdict: Boolean(capFight?.interdict) });
      if (e.wave > 1) capitalSay('wave');
    } else if (e.type === 'volley') {
      emit({ type: 'shot' });
      capitalSay('fired');
    } else if (e.type === 'hit') {
      if (!live) return;
      hurt(e.damage);
      if (!reduced) state.shake = Math.max(state.shake, 0.45);
    } else if (e.type === 'part') {
      if (e.left > 0) capitalSay('dome');
      deed('capitalHurt');
    } else if (e.type === 'open') capitalSay('open');
    else if (e.type === 'dying') {
      capitalSay('bridge');
      if (!reduced) state.shake = Math.max(state.shake, 0.5);
    } else if (e.type === 'blast') {
      pops.hit({ point: new THREE.Vector3(...e.at), normal: popDir.set(0, 1, 0), radius: e.size * 1.6 });
      emit({ type: 'boom', big: e.size > 1.2 });
      if (!reduced) state.shake = Math.max(state.shake, 0.25);
    } else if (e.type === 'dead') {
      state.heat += 4;
      deed('capitalKill');
      state.flare = Math.max(state.flare, 2.4);
      if (!reduced) {
        state.shake = Math.max(state.shake, 1);
        state.kick = 1;
      }
      emit({ type: 'boom', big: true });
      emit({ type: 'event', id: 'capital', sub: 'dead' });
      capFight = null;
    } else if (e.type === 'leaving') {
      emit({ type: 'event', id: 'leave' }); // (the jump's sound)
      if (e.reason === 'fled') emit({ type: 'event', id: 'capital', sub: 'fled' });
      else if (capFight?.hurt) emit({ type: 'event', id: 'capital', sub: 'gone' });
    } else if (e.type === 'gone') capFight = null;
  };

  // everything that goes on round you while you fly: the hunters, the
  // director and its set pieces, your shields, the wonders you come up on
  let staticOn = false;
  const adventure = (dt, t) => {
    state.clock += dt;
    standing.side(sideOf(state.kind));
    for (const e of standing.tick(dt)) stood(e);
    const live = flying() && !onFoot() && !state.crash && !state.dive && !props.frozen ? state.ship : null;
    if (hunters) for (const e of hunters.update(dt, t, live)) onHunters(e);
    if (law) law.step(dt, live, { heat: state.heat });
    else wanted.side(sideOf(state.kind));
    if (wingmen) helpFrom(dt, t, live);
    if (skirmishes) farFight(dt, t, live);
    if (!state.fights || state.clock - state.fightsAt > 0.25) [state.fights, state.fightsAt] = [fightsNow(), state.clock]; // (four times a second is plenty for a far flicker's place)
    farFights.update(dt, state.fights, camera);
    if (npcs) meet(dt, t, live);
    let busy = pieces.update(dt, t, camera, live);
    for (const e of pieces.drain()) capitalEvent(e, live);
    // the NX-5: charging, firing on its planet, going up, leaving; and the
    // planets it's removed, back when their minute's up
    if (remover) {
      const e = stepRemover(remover, dt);
      if (e === 'fired') {
        const id = remover.planet;
        removed[id] = state.clock + REMOVER.gone;
        removerView.fire(new THREE.Vector3(...POSITIONS[id]));
        removerView.scar(id, planetOf[id].group, byId(id).size);
        emit({ type: 'event', id: 'removerFired' });
        if (!reduced) {
          state.shake = Math.max(state.shake, 0.9);
          state.flare = Math.max(state.flare, 1.6);
        }
      } else if (e === 'left') {
        if (remover.firedAt !== null) removerView.leave();
        remover = null;
      }
    }
    for (const id of Object.keys(removed)) {
      if (state.clock < removed[id]) continue;
      delete removed[id];
      removerView.unscar(id);
    }
    removerView.update(remover, dt, t);
    busy = removerView.busy || busy;
    busy = leviathans.update(dt, t, camera) || busy;
    // the war's front: the battle there, while you're in sight of it
    const fr = frontFor();
    if (fr) {
      const r = fr.update(dt, t, camera, camLocal, live);
      busy = r.busy || busy;
      if (r.hurt > 0 && live && state.clock >= state.safeUntil) hurt(r.hurt);
    }
    if (meteors.count) {
      busy = true;
      for (const e of meteors.update(dt, live)) {
        pops.hit({ point: e.at, normal: popDir.set(0, 1, 0), radius: e.size * 1.6 });
        if (state.clock >= state.safeUntil) hurt(e.damage); // (just back: not even the rocks count)
        if (!reduced) state.shake = Math.max(state.shake, 0.5);
      }
    }
    // the minefield: a mine set off (by you flying close, or a bolt) goes up,
    // and its neighbours with it; what reaches you comes off the shields
    if (mines.count) busy = true;
    for (const e of mines.update(dt, live)) {
      burn(e.at, e.size * 4);
      pops.hit({ point: e.at, normal: popDir.set(0, 1, 0), radius: e.size * 3 }); // (and on a low tier, where a blast is only this)
      if (e.damage > 0 && state.clock >= state.safeUntil) hurt(e.damage);
      if (e.damage > 0 && !reduced) state.shake = Math.max(state.shake, 0.4 + e.damage / 60);
    }
    // the eclipse: the moon along its way, and how much of the sun it hides
    // from the eye (the light and the lens's glare dim by it)
    if (eclipse) {
      busy = true;
      const since = state.clock - eclipse.t0;
      if (since > eclipse.plan.time) dropEclipse();
      else {
        camera.getWorldPosition(eclipseEye);
        const eye = map.worldToLocal(eclipseEye).toArray();
        const at = bodyAt(eclipse.plan, since, eye, eclipse.star);
        eclipseMoon.position.set(at[0], at[1], at[2]);
        eclipseMoon.rotation.y = since * 0.02;
        eclipseSolid.at = at;
        eclipseSolid.r = eclipse.plan.r;
        eclipseK = eclipseAt({ eye, sun: eclipse.star, bodies: [eclipseSolid] })?.k ?? 0;
      }
    }
    // the escort: the pirates when the plan says, its hull worn down by the
    // ones on it, and how it ends (there, or lost)
    if (escort) {
      busy = true;
      const e = escort;
      const ship = e.run.ship;
      const since = state.clock - e.t0;
      while (live && ship.parent && e.sent < e.plan.pirates.length && since >= e.plan.pirates[e.sent].at) {
        hunters?.pack(pickFaction(e.side, 'pirates'), live, { prey: ship, size: 2, ace: false });
        if (e.sent === 0) emit({ type: 'event', id: 'escortPirates' });
        e.sent += 1;
      }
      let on = 0;
      if (ship.parent && hunters) for (const h of hunters.wire()) if (Math.hypot(h[2] - ship.position.x, h[3] - ship.position.y, h[4] - ship.position.z) < ESCORT.near) on += 1;
      e.hull = escortHull(e.hull, on, dt);
      if (e.hull <= 0 && ship.parent) {
        const at = e.run.kill();
        if (at) burn(at, 1.4);
        emit({ type: 'event', id: 'escortLost' });
        escort = null;
      } else if (!ship.parent) {
        if (e.run.arrived) {
          if (e.side.id === 'rickmorty') pieces.portals([new THREE.Vector3(...e.plan.path[2])]);
          deed('rescued');
          emit({ type: 'event', id: 'escorted' });
        } else emit({ type: 'event', id: 'escortLost' });
        escort = null;
      }
    }
    if (live) {
      // shields come back once you've been out of trouble a while
      if (state.clock - state.hitAt > state.stats.delay && state.shield < 100) state.shield = Math.min(100, state.shield + dt * 12 * state.stats.regen * diff().regen);
      if (state.shield > 70) state.lowSaid = false;
      state.heat = Math.max(0, state.heat - dt / 45);
      if (hunters) {
        // (where you are: a sun lighting you, at a station, in the gate)
        const sunNow = litBy.key && litBy.key.strength > 1.2 ? LIT_STARS.find((st) => st.id === litBy.key.id) : null;
        const where = { sun: Boolean(sunNow && canEclipse({ eye: [live.x, live.y, live.z], sun: sunNow })), station: Boolean(state.at && byId(state.at)?.kind === 'core'), gate: state.at === 'starwars' };
        const zone = zoneOf(live, { regionAt });
        const id = director.update(dt, { zone, hurt: state.hurtNow ?? 0, side: withWhere(sideHere(), where), heat: state.heat, busy: Boolean(law?.busy) || hunters.active || pieces.destroyerHere || Boolean(remover) || leviathans.holds(live) || meteors.count > 0 || mines.count > 0 || Boolean(escort) || Boolean(eclipse) || state.view === 'map' || Boolean(props.charting) || Boolean(state.held) || Boolean(front?.near), travelling: travelling(live), calm: state.shield < 50, wanted: standing.wanted, pace: diff().pace });
        state.hurtNow = 0;
        if (id) happen(id, live);
        // the drive comes back once they're off you (or have had their go)
        if (state.interdicted && (!hunters.active || state.clock - state.interdictAt > INTERDICT)) state.interdicted = false;
      }
      for (const l of [...later]) {
        if (state.clock < l.at) continue;
        later.splice(later.indexOf(l), 1);
        l.run();
      }
      // out into deep space, and coming up on its wonders
      if (!state.deepSaid && openness(live.x, live.y, live.z) > 0.6) {
        state.deepSaid = true;
        emit({ type: 'event', id: 'deep' });
      }
      for (const w of WONDERS) {
        if (state.saw.has(w.id) || apart(live.x, live.y, live.z, w.at[0], w.at[1], w.at[2]) > reachOf(w) * 1.6 + 250) continue;
        state.saw.add(w.id);
        emit({ type: 'wonder', id: w.id });
      }
      // the phone: at it, the prompt says so (and G or E asks for its
      // password); flown right into it, it asks by itself, once
      const toPhone = apart(live.x, live.y, live.z, PHONE.at[0], PHONE.at[1], PHONE.at[2]);
      const nearPhone = toPhone < PHONE.reach * (state.phoneNear ? 1.3 : 1);
      if (nearPhone !== state.phoneNear) {
        state.phoneNear = nearPhone;
        emit({ type: 'phone', what: nearPhone ? 'near' : 'far' });
      }
      if (toPhone < PHONE.touch && !state.phoneIn && !state.auto && !state.jump) {
        state.phoneIn = true;
        emit({ type: 'phone', what: 'open' });
      } else if (toPhone > PHONE.reach * 0.6) state.phoneIn = false;
      // down in the Death Star's trench a moment: the trench run (with Luke
      // or Han, Vader comes down it after you), now and then
      const ds = TRENCHED.find((o) => Math.abs(live.y - o.at[1]) < o.band.half && apart(live.x, live.y, live.z, o.at[0], o.at[1], o.at[2]) < o.r - 0.4);
      state.trench = ds ? state.trench + dt : 0;
      if (state.trench > 1.2 && state.clock - state.trenchAt > 120) {
        state.trenchAt = state.clock;
        emit({ type: 'event', id: 'trench' });
        if (hunters && sideFor(state.kind)?.id === 'starwars' && !hunters.active) hunters.pack('empire', live, { size: 3, ace: true });
      }
    } else {
      later.length = 0;
      state.interdicted = false;
    }
    if (state.hurt > 0) {
      state.hurt = Math.max(0, state.hurt - dt * 2.2);
      busy = true;
    }
    post.hit(state.hurt);
    // the HUD scrambled a while (a flare's shockwave through the ship)
    if (state.static > 0) {
      state.static = Math.max(0, state.static - dt);
      busy = true;
    }
    if ((state.static > 0) !== staticOn) {
      staticOn = state.static > 0;
      props.hud?.current?.toggleAttribute('data-static', staticOn);
    }
    placeShield();
    placeWanted();
    return busy || Boolean(hunters?.count) || later.length > 0;
  };

  // the camera during a crash: back and up from the impact, so you see the
  // ship go in and the shockwave run out over the planet
  const crashPose = () => {
    const c = state.crash;
    if (c.swallow) {
      // well off and nearly level with the disk (maw.js), the whole of the
      // hole in view while the ship goes down it; then in after it: its
      // shadow grows steadily over the screen (as one over the distance)
      // till it's all of it, and on in through it
      const k = plungeAt(c.age);
      const near = MAW.shadow * 2.2;
      const dist = k < 0.8 ? 1 / (1 / MAW.witness + (1 / near - 1 / MAW.witness) * (k / 0.8) ** 1.3) : near + (MAW.shadow * 0.5 - near) * ((k - 0.8) / 0.2);
      const [wx, wz] = rotate(MAW.at[0], MAW.at[2]);
      return { target: [wx, MAW.at[1], wz], dist, pitch: Math.asin(clamp(c.fall.view[1], -0.95, 0.95)) };
    }
    const [wx, wz] = rotate(c.point.x, c.point.z);
    return { target: [wx, c.point.y, wz], dist: c.radius * 1.4 + 2.6, pitch: 0.42 };
  };
  // the fall into the black hole (maw.js): round and down its disk, faster
  // and faster, nose first and drawn out thin (spaghetti, as Rick says),
  // rolling as it goes; then held at the edge of the shadow, shrinking as
  // its light fades, and gone. No impact and nothing thrown out: nothing
  // comes back out of it. The camera pulls back to watch (crashPose)
  const NOSE = new THREE.Vector3(0, 0, -1);
  const along = new THREE.Vector3();
  const swallowing = (dt) => {
    const c = state.crash;
    const m = state.model;
    const s = fallAt(c.fall, reduced ? MAW.horizon : c.age);
    c.fell = s;
    // the camera comes round to where it watches from. The map turns about
    // its middle, far off, so where the camera's flying from turns with it
    // (or the view would swing off into empty space)
    const turn = state.view !== 'map' ? wrap(c.yaw - state.yaw) * clamp01(dt * 1.6) : 0;
    if (Math.abs(turn) > 1e-6) {
      state.yaw += turn;
      const f = state.flight;
      if (f) {
        const [x, y, z] = f.from.target;
        const [cs, sn] = [Math.cos(turn), Math.sin(turn)];
        f.from = { ...f.from, target: [x * cs + z * sn, y, -x * sn + z * cs] };
      }
    }
    if (!s.gone) {
      m.group.position.set(...s.at);
      m.group.quaternion.setFromUnitVectors(NOSE, along.set(...s.dir));
      m.pivot.rotation.z += dt * (1.2 + s.stretch * 9);
      const fade = s.held ? s.glow : 1;
      const thin = (1 - s.stretch * 0.85) * fade;
      m.group.scale.set(thin, thin, (1 + s.stretch * 8) * fade);
    } else if (!c.impact) {
      c.impact = true;
      m.group.visible = false;
      m.group.scale.setScalar(1);
      m.group.quaternion.identity();
      m.pivot.rotation.set(0, 0, 0);
    }
  };
  const crashing = (dt) => {
    const c = state.crash;
    c.age += dt;
    const age = c.age;
    const m = state.model;
    const T = c.swallow ? FALL : c.kind === 'giant' ? DIVE : CRASH;
    updatePlumes(dt, (performance.now() - t0) / 1000, 0); // the engines are out
    state.model?.drive(dt, {});
    if (c.swallow) swallowing(dt);
    else if (age < T.impact) {
      // on into it, tumbling, a little way under the surface (into a giant,
      // down into the clouds)
      const k = age / T.impact;
      const depth = k * k * (c.kind === 'giant' ? SHIP.radius + 2.5 : SHIP.radius + 0.25);
      m.group.position.copy(c.from).addScaledVector(c.into, depth);
      m.group.position.x += c.fwd[0] * k * 0.1;
      m.group.position.z += c.fwd[1] * k * 0.1;
      m.pivot.rotation.x += dt * c.spin[0];
      m.pivot.rotation.z += dt * c.spin[1];
    } else if (!c.impact) {
      c.impact = true;
      m.group.visible = false;
      crashFx.hit({ point: c.point, normal: c.normal, body: planetOf[c.id]?.surface ?? null, radius: c.radius, sun: c.sun, colour: c.colour });
      // (and your ship goes up as theirs do, into the shockwave)
      if (!c.sun) burn(c.point, LENGTH * 2);
      state.shake = reduced ? 0 : c.kind === 'giant' ? 1.4 : 1;
      state.flare = reduced ? 1 : c.sun ? 2.6 : 2;
      feel.hitstop(HITSTOP.crash);
      if (!c.shot) emit({ type: 'crash', id: c.id, kind: c.kind ?? undefined, speed: c.speed, loud: crashLoud(c.speed) }); // (shot down said so as it began)
    }
    if (age >= (c.swallow && reduced ? 0.3 : T.through) && !c.asked && !c.sun && !c.shot && (isPlace(c.id) || c.world || c.swallow)) {
      // the shockwave running out over the surface (or the ship gone into
      // the black hole): the page takes it from here, if it's going on into
      // the place's page (a wonder with a world of its own, the Citadel,
      // takes you into that), or on through to what's beyond the hole
      c.asked = true;
      c.through = Boolean(props.onCrash?.(c.world ?? c.id, c.page));
    }
    if (c.through) return true; // the camera holds on the crater till the page goes
    if (age >= T.back && !c.back) {
      // back again: parked off the planet on the side it hit (well clear of the sun)
      c.back = true;
      let at;
      if (c.shot) {
        // shot down: back at the nearest place, shields up again
        const near = ORDER.reduce((a, b) => (Math.hypot(...POSITIONS[a].map((v, i) => v - c.from.getComponent(i))) <= Math.hypot(...POSITIONS[b].map((v, i) => v - c.from.getComponent(i))) ? a : b));
        at = parkAt(near, [c.from.x, c.from.z]);
        arms().reload();
      } else if (c.sun || !isPlace(c.id)) {
        // the sun (or a star), or a wonder out in deep space: back out the way it went in, facing away
        const solid = c.ship ? { at: c.centre, r: c.radius } : (SOLIDS.find((o) => o.id === c.id) ?? { at: SUN.at, r: SUN.r });
        const out = c.from.clone().sub(new THREE.Vector3(...solid.at));
        if (c.id === 'sun') out.y = 0;
        out.normalize();
        const r = solid.r + 12;
        at = { x: solid.at[0] + out.x * r, y: c.id === 'sun' ? SHIP.height : solid.at[1] + out.y * r, z: solid.at[2] + out.z * r, heading: headingTo(out.x, out.z) };
      } else at = parkAt(c.id, [c.from.x, c.from.z]);
      state.ship = { ...state.ship, x: at.x, y: at.y, z: at.z, heading: at.heading, speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, edge: false };
      camQOn = false; // (the camera's straight on behind it)
      if (c.swallow) {
        // (the page didn't take it on through: back out past the Maw's reach)
        const out = new THREE.Vector3(c.from.x - MAW.at[0], 0, c.from.z - MAW.at[2]).normalize();
        Object.assign(state.ship, { x: MAW.at[0] + out.x * (MAW.reach + 10), y: MAW.at[1], z: MAW.at[2] + out.z * (MAW.reach + 10), heading: headingTo(out.x, out.z) });
        infall?.clear();
        state.view = state.seat;
        m.group.scale.setScalar(1);
        m.group.quaternion.identity();
      }
      state.shield = 100;
      state.lowSaid = false;
      m.group.visible = true;
      m.pivot.rotation.set(0, 0, 0);
      crashFx.arrive({ point: new THREE.Vector3(at.x, state.ship.y, at.z), kind: state.kind, heading: at.heading });
      emit({ type: 'respawn' });
      retarget(900);
    }
    if (c.back) {
      // coming out of the portal, or out of hyperspace (long, then snapping to size)
      const k = clamp01((age - T.back) / (T.done - T.back));
      const s = state.ship;
      m.group.position.set(s.x, s.y, s.z);
      m.group.rotation.set(s.pitch || 0, s.heading, -(s.bank || 0), 'YXZ');
      const grow = 1 - (1 - k) ** 3;
      m.group.scale.set(grow, grow, state.kind === 'cruiser' ? grow : grow * (1 + (1 - k) * 5));
    }
    if (age >= T.done) {
      state.crash = null;
      state.safeUntil = state.clock + SAFE;
      m.group.scale.setScalar(1);
      m.group.visible = true;
      state.lastInput = performance.now();
    }
    return true;
  };

  // into the rift: out of it somewhere else on the map (as a jump comes
  // out: parked there, the hunters left behind, a flash where it comes out)
  const riftThrough = () => {
    const s = state.ship;
    const exit = riftExit(state.at, Math.random, mapSectorOf(s.x, s.y, s.z), state.saw); // (out in the sector it opened in, somewhere you haven't been)
    const park = parkFor(exit, [s.x, s.z]);
    pieces.closeRift();
    if (!park) return;
    dropAuto();
    arriveAt(park);
    hunters?.clear();
    meteors.clear();
    mines.clear();
    dropEscort();
    dropEclipse();
    wingmen?.clear();
    skirmishes?.clear();
    npcs?.clear();
    state.interdicted = false;
    state.safeUntil = state.clock + SAFE;
    state.flare = Math.max(state.flare, 2.4);
    crashFx.arrive({ point: new THREE.Vector3(park.x, park.y, park.z), kind: state.kind, heading: park.heading });
    // (out at a wonder, nothing's picked: the panel goes back to the map's; at a place, arriving picks it)
    if (!isPlace(exit) && state.sel) {
      state.sel = null;
      props.onPick?.(null);
    }
    emit({ type: 'event', id: 'rifted' });
    emit({ type: 'rifted', id: exit });
  };

  // into a portal (portals.js): out by its far end, in the other sector,
  // going on the way it went in at half the speed, a green flash where it
  // comes out, the hunters and the traffic left behind. A trip to the portal
  // is done there (the page takes a trip on through it on from here); a
  // trip anywhere else that went through it is dropped
  const portalThrough = (id, out = transit(state.ship, id)) => {
    if (!out) return;
    const then = state.then;
    state.then = null;
    if (state.auto) {
      const going = state.auto.id;
      state.auto = null;
      if (!(then && going === id)) emit({ type: 'arrived', id: going, done: going === id });
    }
    state.ship = out.ship;
    hunters?.clear();
    meteors.clear();
    wingmen?.clear();
    skirmishes?.clear();
    npcs?.clear();
    traffic?.clear();
    traffic?.setCrew(crewAt(state.kind, out.sector)); // (the sector's own traffic: sides.js)
    stockUp();
    state.interdicted = false;
    state.safeUntil = state.clock + SAFE;
    state.flare = Math.max(state.flare, 2.4);
    camQOn = false;
    crashFx.arrive({ point: new THREE.Vector3(out.ship.x, out.ship.y, out.ship.z), kind: 'cruiser', heading: out.ship.heading }); // (a portal, whatever the ship)
    state.note = { text: `Through the portal: ${SECTORS[out.sector].name}`, until: wall() + 3.5 };
    emit({ type: 'sector', id: out.sector, through: id });
    // (on to where the trip was going: the jump's charging now, so at super speed)
    if (then && !travel(then.id, then.drive === 'hyper' ? 'super' : then.drive) && pilotId(then.id)) pilotGone(then.id, then.name); // (a pilot gone while it went through)
  };

  // Rick's portal gun (P, or the HUD's Portal button): in any ship, flying
  // (Rick's cruiser, or whoever's got hold of one: crews.js has how), a
  // portal splats open ahead on the way it's going (gunPortal.js), on Rick's
  // dimension from anywhere at home, on home from there. False if it can't
  // be fired now (on foot, mid-jump, too soon)
  const portalGun = () => {
    if (!state.kind || !flying() || onFoot() || state.crash || state.jump || state.held || state.view === 'map') return false;
    if (state.clock - gunAt < GUN.cool || !gunPortal.fire(state.ship)) return false;
    gunAt = state.clock;
    heard();
    const home = sectorOf(state.ship.x, state.ship.y, state.ship.z) !== 'rickmorty';
    emit({ type: 'event', id: 'portalgun', sub: home ? 'out' : 'home' });
    ctx.invalidate();
    return true;
  };
  // through it: out by the far end of the sector portal it's the other end
  // of, facing what's worth seeing there (the Citadel, or the C-137 planet)
  const gunThrough = () => {
    const { via, out } = gunTransit(state.ship);
    gunPortal.shut();
    if (!out) return;
    portalThrough(via, out);
    if (out.label) state.note = { text: `Through the portal: ${out.label}, in Rick’s dimension`, until: wall() + 4 };
    emit({ type: 'event', id: 'gunThrough', sub: out.sector });
  };

  const fly = (dt, t) => {
    if (state.crash) return crashing(dt);
    // out of the cockpit through Rick's portal: the cruiser comes out in
    // his dimension, as soon as it's flying (it may still be being made)
    if (arriving && wall() > arriving.until) arriving = null;
    if (arriving && state.kind === 'cruiser' && state.ship && !state.jump && !state.held) {
      const { sector } = arriving;
      arriving = null;
      if (mapSectorOf(state.ship.x, state.ship.y, state.ship.z) !== sector) gunThrough();
    }
    let input;
    // coming round onto the jump (aim.js's jumpPhase): pointing true (or
    // long enough), it spools up and the page plays the jump
    if (state.jump?.phase === 'align') {
      const j = state.jump;
      j.age += dt;
      if (jumpPhase(j, { aligned: aligned(state.ship, j.dir), age: j.age, input: false }) === 'spool') {
        j.phase = 'spool';
        j.at = wall() + HYPER.flash;
        state.hyperAt = wall();
        emit({ type: 'jump', id: j.id });
      }
    }
    if (state.jump?.phase === 'spool' && wall() >= state.jump.at) {
      // out of hyperspace, under the jump's flash: parked at the place, the
      // hunters left behind, and a flash and a ring of light (or a portal,
      // for the cruiser) where it comes out
      const j = state.jump;
      state.jump = null;
      // (to a pilot: parked behind them as they are now, at the flash; gone,
      // and it comes out where they were when it jumped)
      const pid = pilotId(j.id);
      const pose = pid ? pilots.pose(pid) : null;
      const park = parkBehind(pose) ?? j.park;
      if (pid && pose) withPilot(pose.name);
      else if (pid) pilotGone(j.id, j.name);
      arriveAt(park);
      hunters?.clear();
      meteors.clear();
      mines.clear();
      dropEscort();
      dropEclipse();
      wingmen?.clear();
      skirmishes?.clear();
      npcs?.clear();
      state.interdicted = false;
      state.safeUntil = state.clock + SAFE;
      crashFx.arrive({ point: new THREE.Vector3(park.x, park.y, park.z), kind: state.kind, heading: park.heading });
      emit({ type: 'jumped', id: j.id });
    }
    if (!state.jump && pieces.riftAt && pieces.riftInside(state.ship)) riftThrough();
    if (!state.jump) chasePilot();
    // the big ships moving through (the capital, the sector fleet, the big traffic): solids for the step, and for the autopilot to steer round
    const moving = solidsWith(NO_SHIPS, pieces.solids, sectorFleet.solids, traffic?.solids(state.ship, 12));
    if (state.jump?.phase === 'align') input = { throttle: state.ship.speed > SHIP.cruise ? 0 : 0.35, ...steerToward(state.ship, state.jump.dir) }; // (coming round onto it, easing off to cruise)
    else if (state.jump) input = { throttle: 1, boost: true }; // (spooling up: straight on, flat out)
    else if (state.auto) {
      const od = state.interdicted ? 1 : (state.auto.od ?? 1);
      // (and the battle's hold on the drive, so it plans its stop for it: front.js holdAt, as it would be coming straight in)
      const hold = front ? (x, y, z) => front.holdAt(x, y, z, null) : null;
      const a = autopilot(state.ship, state.auto.id, state.auto.park, state.auto.space ?? (state.auto.id === 'front' && front ? frontSpace() : undefined), od, hold, moving);
      input = a.input;
      if (a.done) {
        const id = state.auto.id;
        state.auto = null;
        emit({ type: 'arrived', id, done: true }); // (the page's tour, and a trip on through the gate, go on from here)
      }
      // the crew's word on super speed, the first time it's past the pulse drive
      if (od > 1 && !state.odSaid && state.ship.speed > SHIP.pulse * 1.2) {
        state.odSaid = true;
        emit({ type: 'event', id: 'overdrive' });
      }
    } else {
      input = steering();
      input.tune = state.stats; // (what's fitted; the autopilot flies it as it came, so it stops where it means to)
      // the nose follows the lock (targeting.js: a nudge toward the lead,
      // as much as the lock-tracking setting allows, giving way to the
      // stick); not in the whole-map view, where there's no lock to see
      if (state.view !== 'map' && state.trackable && state.lead && state.lead.t <= AIM.life) {
        const n = trackNudge(state.ship, state.lead, controls().track, input);
        input.turn = clamp(input.turn + n.turn, -1, 1);
        input.climb = clamp(input.climb + n.climb, -1, 1);
      }
    }
    // the pulse drive held down: by hunters, pulled down over INTERDICT_IN;
    // coming in to a battle, eased down the closer it is (front.js holdAt)
    const pack = state.interdicted ? clamp((state.clock - state.interdictAt) / INTERDICT_IN, 0, 1) : 0;
    const fight = front ? front.holdAt(state.ship.x, state.ship.y, state.ship.z, noseOf(state.ship)) : 0;
    input.interdicted = Math.max(pack * pack * (3 - 2 * pack), fight);
    // an ion hit: no boost and no pulse drive till it wears off
    if (state.clock < (state.ionUntil ?? -1)) {
      input.boost = false;
      input.interdicted = 1;
    }
    if (state.keys.fire || state.fireBtn) fire(); // (the trigger held: at the guns' own pace)
    const before = state.ship;
    solidsNow = solidsWith(siegeSt.down ? SOLIDS_OPEN : SOLIDS, moving);
    const { ship: stepped, events } = step(state.ship, input, dt, solidsNow, OPEN_SPACE);
    // the Maw's pull (maw.js): drawn in, and carried round with its disk
    const g = pullAt(stepped.x, stepped.y, stepped.z);
    const ship = g ? { ...stepped, x: stepped.x + g.v[0] * dt, y: stepped.y + g.v[1] * dt, z: stepped.z + g.v[2] * dt } : stepped;
    // (held at a pose: still, and out of the Maw's pull, so every frame measured is the same picture)
    if (!state.held) state.ship = ship;
    state.pull = state.held ? 0 : (g?.k ?? 0);
    // into a rock (rockHits.js): a bump at the boost or under, the shields
    // past it
    if (!state.jump && !state.held) rocksHit(before, ship, t);
    for (const e of events) {
      // into a gate (the way into a galaxy far, far away): not a crash nor a
      // bump, but through (the page jumps you to lightspeed)
      if ((e.type === 'crash' || e.type === 'bump') && byId(e.id)?.portal) {
        if (state.through !== e.id) emit({ type: 'portal', id: e.id });
        state.through = e.id;
        continue;
      }
      if (e.type === 'bump' && e.at) bumped(e.force, new THREE.Vector3(...e.at), new THREE.Vector3(...e.normal));
      if (e.type !== 'crash') emit(e);
      else if (!state.crash) startCrash(e);
    }
    if (state.crash) return true;
    // into another ship (shipHits.js): a glance, or a ram
    if (!state.jump && !state.held && !state.dive && state.view !== 'map') shipsHit(before, state.ship, dt);
    if (state.crash) return true;
    if (!state.jump && !state.held) {
      const into = portalHit(before, state.ship);
      if (into) portalThrough(into);
      else if (gunPortal.spot && gunHit(before, state.ship, gunPortal.spot, gunPortal.age)) gunThrough();
    }
    // into a planet's air (entry.js): at a speed it can land at, straight on
    // into its world (flyInto); any faster it's no way in (it goes on into
    // the ground, and that's the crash above, as ever), and the HUD says so.
    // Not while the autopilot's taking it somewhere else
    if (!state.jump && !state.auto) {
      const air = entering(state.ship, LANDABLE);
      // (a planet the NX-5 removed: no landing on it till it's back)
      if (air?.kind === 'enter' && !landingOpen(removed, air.id, state.clock)) {
        if (state.removedSaid !== air.id) {
          state.removedSaid = air.id;
          state.note = { text: `${placeName(air.id)} has been removed. Give it a minute.`, until: wall() + 3 };
        }
      } else if (air?.kind === 'enter' && flyInto(air.id)) return true;
      if (air?.kind !== 'enter') state.removedSaid = null;
      if (air?.kind !== 'hot') state.hotSaid = null;
      else if (state.hotSaid !== air.id) {
        state.hotSaid = air.id;
        state.note = { text: `Too fast to fly into ${placeName(air.id)}: ease off the boost`, until: wall() + 2.5 };
      }
    }
    if (g) {
      if (!state.pullSaid && g.k > 0.3) {
        state.pullSaid = true;
        emit({ type: 'pulled' });
      }
      // the hum of it, and the ship shaking in its grip
      if (!well && engine) well = wellSound();
      well?.set(g.k);
      if (!reduced) state.shake = Math.max(state.shake, Math.max(0, g.k - 0.2) * 0.55);
      // past the point of no return: the fall
      if (captured(ship.x, ship.y, ship.z)) {
        startCrash({ id: MAW.id, swallowed: true, speed: ship.speed });
        return true;
      }
    } else {
      state.pullSaid = false;
      well?.set(0);
    }

    // a burst of speed
    const boosting = input.boost && input.throttle > 0 && ship.speed > SHIP.cruise * 0.7;
    if (boosting && !state.boosting) {
      emit({ type: 'boost', first: state.boosts++ === 0 });
      ignite();
    }
    state.boosting = boosting;
    const want = !reduced && ship.speed > SHIP.cruise + 0.2 ? clamp01((ship.speed - SHIP.cruise) / (SHIP.boost - SHIP.cruise)) : 0;
    state.streak += (want - state.streak) * clamp01(dt * 4);

    // at a universe: arriving, and leaving
    const target = state.auto?.id;
    const now = orbiting(ship, state.at);
    if (now !== state.at && (!target || now === target || now === null)) {
      const left = state.at;
      state.at = now;
      if (now) {
        if (state.sel !== now) {
          state.sel = now;
          props.onPick?.(now);
        }
        emit({ type: 'arrive', id: now });
        // (the spacedock at the projects station: the Shipyard's door, once an approach)
        if (now === 'projects' && !onFoot()) state.note = { text: 'Dock at the shipyard (H)', until: wall() + 3 };
        law?.arrive(props.wallet ?? null); // (a bounty on your head paid off here, out of the wallet)
        state.saw.add(now); // (been here: a rift takes you somewhere else)
        pulseAt = { id: now, age: 0 };
        cabLook.glanceAt = state.clock; // the crew have their say: a look over at them
      } else if (left && state.sel === left && !target) {
        state.sel = null;
        props.onPick?.(null);
      }
      paintStates();
    }

    // the guns: what they're locked on to (a tick as they pick one up),
    // where to shoot to hit it, and whether the nose is near enough to it
    // that a shot bends onto it
    const siegeCands = [...siegeTargets(ship), ...removerTargets(ship)];
    // (the rocks only while nobody's after you: a hunter's the thing to lock on to)
    const rocks = (meteors.count || mines.count) && !hunters?.active ? [...meteors.targets, ...mines.targets] : [];
    // (someone else's fight's hunters, while nothing's after you: yours come first)
    const farCands = [...(skirmishes?.active && !hunters?.active ? skirmishes.targets : []), ...(npcs?.targets ?? [])];
    const battleCands = front?.joined !== null && front?.joined !== undefined ? front.targets : []; // (the other side's, at the front)
    const capitalCands = pieces.destroyerHere ? pieces.targets : []; // (the capital ship's shield parts, then its bridge)
    const cands = pilots.count || siegeCands.length || rocks.length || farCands.length || battleCands.length || capitalCands.length ? [...(hunters?.targets ?? []), ...battleCands, ...farCands, ...capitalCands, ...pilots.targets, ...siegeCands, ...rocks] : (hunters?.targets ?? []);
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
    // (hot: a shot now would bend all the way onto it)
    state.hot = Boolean(state.lead && state.lead.t <= AIM.life && assistAmount(nose(ship), dirTo(ship, state.lead), controls().assist) >= 1);
    // and the camera leans a little toward the lock (eased, so a lock coming
    // or going doesn't jolt it)
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

    const m = state.model;
    m.update(t);
    m.group.visible = state.cabK < 0.6; // (from inside, the ship is the cockpit)
    m.group.position.set(ship.x, ship.y + (reduced ? 0 : Math.sin(t * 2.1) * 0.012), ship.z);
    // which way round it is, exactly (loops, rolls, upside down); inside
    // that, the lean into a turn and a dip of the nose with the throttle
    m.group.rotation.set(ship.pitch || 0, ship.heading, -(ship.bank || 0), 'YXZ');
    m.pivot.rotation.set(reduced ? 0 : clamp(-input.throttle * 0.06, -0.08, 0.08), 0, -(ship.lean || 0));
    m.setThrottle(clamp01(Math.abs(ship.speed) / SHIP.cruise) * (0.7 + state.streak * 0.3));
    engines.set(heroEngine, { throttle: clamp01(Math.abs(ship.speed) / SHIP.cruise), boost: state.streak });
    updatePlumes(dt, t, clamp01((ship.speed - 0.5) / SHIP.cruise) * (0.7 + 0.3 * state.streak), 1 + state.streak * 1.3, clamp01(state.streak * 1.4));
    m.drive(dt, { throttle: clamp01(Math.abs(ship.speed) / SHIP.cruise), boost: state.streak > 0.3, turn: input.turn || 0, climb: input.climb || 0 });
    engine?.set({ speed: Math.min(ship.speed, SHIP.boost * 1.2), boost: state.streak > 0.3, on: state.shown && !props.frozen && !document.hidden });
    // sitting still a good while: the crew notice
    if (!state.idleSaid && !state.auto && Math.abs(ship.speed) < 0.05 && state.shown && !document.hidden && performance.now() - state.lastInput > IDLE) {
      state.idleSaid = true;
      emit({ type: 'idle' });
    }
    return Boolean(
      state.auto ||
        g ||
        m.modules?.easing || // (a part just fitted, swinging into place)
        input.throttle ||
        input.turn ||
        input.climb ||
        input.roll ||
        Math.abs(ship.speed) > 0.01 ||
        Math.abs(ship.vy) > 0.01 ||
        Math.abs(ship.rate || 0) > 0.002 ||
        Math.abs(ship.tipRate || 0) > 0.002 ||
        Math.abs(ship.rollRate || 0) > 0.002 ||
        Math.abs(ship.lean || 0) > 0.002 ||
        state.streak > 0.01 ||
        state.lock ||
        camQ.angleTo(shipQ) > 0.002 ||
        apart(state.bias[0], state.bias[1], state.bias[2], 0, 0, 0) > 0.001,
    );
  };

  // ── On foot: down onto a planet, out of the ship, and back in ──
  const camWas = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  // the camera eases over from where it is now (`dur` ms)
  const handOff = (dur) => {
    if (reduced) return;
    state.camFrom = { pos: camera.position.clone(), quat: camera.quaternion.clone(), start: performance.now(), dur };
  };
  const easeCamera = (now) => {
    const c = state.camFrom;
    if (!c) return;
    const k = clamp01((now - c.start) / c.dur);
    const e = k * k * (3 - 2 * k);
    camera.position.lerpVectors(c.pos, camera.position, e);
    camWas.quat.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(c.quat, camWas.quat, e);
    camera.updateMatrixWorld();
    if (k >= 1) state.camFrom = null;
  };
  // the key light's way, in the map's space (it's day where it falls)
  const lightInMap = () => LIGHT.clone().applyAxisAngle(Y_AXIS, -state.yaw);
  // Down onto a planet, and out they get. Flown down into its air (`entry`,
  // entry.js's entering(): where it went in, how fast and which way), the
  // ship flies on down through it onto the ground; without one (the dev
  // hooks' way, and the landing checks'), it's set down from where it is
  const startFoot = ({ id = state.landable, entry = null } = {}) => {
    if (!flying() || onFoot() || state.crash || state.dive || props.frozen || !state.model) return false;
    if (!id) {
      emit({ type: 'foot', id: 'nowhere' });
      return false;
    }
    if (!landingOpen(removed, id, state.clock)) {
      state.note = { text: `${placeName(id)} has been removed. Give it a minute.`, until: wall() + 3 };
      return false;
    }
    handOff(entry ? 600 : 1400);
    // anyone already down on this planet: come down beside them (an ally first)
    const down = guestsOnFoot(performance.now()).filter((g) => g.foot.planet === id);
    const friend = down.find((g) => g.ally) ?? down[0] ?? null;
    const near = friend && { ...friend.foot.ship, kind: friend.foot.kind };
    if (!foot.begin({ id, ship: state.ship, model: state.model, kind: state.kind, light: sunInMap[id] ?? lightInMap().toArray(), near, entry })) return false;
    dropAuto();
    state.hotSaid = null;
    if (entry) {
      // the air roaring past, as loud as the burn (footFrame)
      quietRoar();
      roar = entrySound();
      // (the ship that flies on is footScene's now: the flying numbers wait
      // out of the air over where it went in, still, so however the landing
      // ends, even without the take-off, it isn't left heading back into it)
      const p = LANDABLE.find((o) => o.id === id);
      const up = airTop(p) + ENTRY.clear + 0.6;
      const [nx, ny, nz] = entry.n;
      state.ship = { ...state.ship, x: p.at[0] + nx * up, y: p.at[1] + ny * up, z: p.at[2] + nz * up, speed: 0, vy: 0, lift: 0, rate: 0, tipRate: 0, rollRate: 0, pitch: 0, bank: 0, heading: Math.hypot(nx, nz) > 0.05 ? headingTo(nx, nz) : state.ship.heading };
    }
    state.streak = 0;
    state.boosting = false;
    state.lock = null;
    state.lockTarget = null;
    state.lead = null;
    burst.clear();
    engine?.set({ speed: 0, boost: false, on: false });
    emit({ type: 'foot', id: 'land' });
    ctx.invalidate();
    return true;
  };
  // Flown down into a planet's air (fly's entering()): straight on into its
  // world, the way E and the panel's button go (the page dives in), not a
  // landing beside the ship first. The ship's stopped where it is, so the
  // next frame isn't another way in, nor on into the ground
  const flyInto = (id) => {
    const to = flownInto(id);
    if (!to || !props.onOpen) return false;
    dropAuto();
    state.hotSaid = null;
    state.ship = { ...state.ship, speed: 0, vy: 0, lift: 0, rate: 0, tipRate: 0, rollRate: 0 };
    state.streak = 0;
    state.boosting = false;
    engine?.set({ speed: 0, boost: false, on: false });
    props.onOpen(to);
    return true;
  };
  // what a planet's landing is called, as the panel's Land button has it (Middle-earth, not The Lord of the Rings)
  const placeName = (id) => byId(id).place ?? byId(id).label;
  // up and away: flying again from where the ship rose to (out past the
  // planet's air, its nose away from it: footScene's liftFrame)
  const endFoot = (done) => {
    quietRoar();
    handOff(1200);
    const m = state.model;
    state.ship = { ...state.ship, x: done.x, y: done.y, z: done.z, heading: done.heading, speed: 0, vy: 0, lift: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, pitch: 0, bank: 0, edge: false };
    foot.end();
    seated(true);
    m.group.quaternion.identity();
    m.group.rotation.set(0, done.heading, 0);
    m.pivot.rotation.set(0, 0, 0);
    m.group.scale.setScalar(1);
    m.park?.(false);
    state.view = state.seat;
    if (state.seat === 'cockpit') buildCab(state.kind);
    state.lastInput = performance.now();
    emit({ type: 'foot', id: 'off' });
  };
  // Rick and Morty in the cruiser's seats, or not (they're out walking)
  let seatCrew = null;
  const seated = (on) => seatCrew?.(on);
  const footInput = () => {
    const k = state.keys;
    let move = (k.up ? 1 : 0) - (k.down ? 1 : 0);
    let turn = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const strafe = (k.strafeR ? 1 : 0) - (k.strafeL ? 1 : 0);
    const st = state.stick;
    if (st?.on) {
      move = clamp(move - st.dy / STICK, -1, 1);
      turn = clamp(turn + st.dx / STICK, -1, 1);
    }
    return { move, turn, strafe, run: Boolean(k.boost || state.boostBtn), jump: Boolean(k.jump || state.climbBtn > 0) };
  };
  const footFrame = (dt, t) => {
    const was = foot.phase;
    foot.update(dt, t, props.frozen ? {} : footInput());
    if (was !== 'walk' && foot.phase === 'walk' && state.kind === 'cruiser') seated(false);
    if (foot.phase === 'board' && state.kind === 'cruiser') seated(true);
    const m = state.model;
    m.update(t);
    m.group.visible = true;
    m.park?.(foot.phase !== 'land' && foot.phase !== 'lift');
    updatePlumes(dt, t, foot.phase === 'land' || foot.phase === 'lift' ? 0.25 : 0);
    engine?.set({ speed: foot.phase === 'land' || foot.phase === 'lift' ? SHIP.cruise * 0.6 : 0, boost: false, on: state.shown && !props.frozen && !document.hidden && (foot.phase === 'land' || foot.phase === 'lift') });
    foot.day(sunInMap[foot.id] ? footSun.set(...sunInMap[foot.id]) : lightInMap());
    // on the way in through the air: shaken by the burn and the clouds (not
    // with reduced motion), the roar as loud as the burn
    const entry = foot.entry();
    if (entry) {
      if (!reduced) state.shake = Math.max(state.shake, entry.fx.shake * 0.75);
      roar?.set(props.frozen || document.hidden ? 0 : Math.min(1, entry.fx.burn + entry.fx.cloud * 0.45));
    } else if (roar) quietRoar();
    const info = foot.info();
    if (info && info.hurt > 0.95 && !reduced) state.shake = Math.max(state.shake, 0.08);
    if (info) state.hurt = Math.max(state.hurt, info.hurt * 0.8);
    const done = foot.takeoff();
    if (done) endFoot(done);
    return true;
  };
  const camLook = new THREE.Vector3();
  const footCamera = (dt) => {
    const v = foot.view(dt);
    if (!v) return;
    // (only the map's own turn is wanted: the frame's already brought it up to date)
    map.updateWorldMatrix(true, false);
    map.localToWorld(camera.position.copy(v.pos));
    camera.up.copy(v.up).transformDirection(map.matrixWorld);
    camera.lookAt(map.localToWorld(camLook.copy(v.look)));
    camera.up.set(0, 1, 0);
    camera.updateMatrixWorld();
    lens(0.004);
    reach(foot.far() ?? FAR);
  };
  // the HUD on foot: the sights where the gun points, brackets on the
  // trooper it's on, the way back to the ship, and your health in the
  // shields' bar
  // (the crosshair on foot is the kit's Reticle, in the middle where the
  // camera's ray goes (footAim.js): the page draws it from 'reticle', sent
  // only when it changes: footReticle, kept with placeHud)
  const placeFootHud = (h) => {
    const info = foot.info();
    const on = Boolean(info) && foot.phase === 'walk' && !props.frozen;
    setOn(h, h.reticle, false);
    const ret = reticleState(footReticle, { gun: on && info.gun, hitAt: on && info.landed != null ? -info.landed : null, now: 0, lock: on && info.locked }); // (landed: ms ago)
    if (ret !== footReticle) {
      footReticle = ret;
      emit({ type: 'reticle', state: ret });
    }
    const lock = on ? info.lock : null;
    setOn(h, h.lock, Boolean(lock));
    if (lock) {
      toScreen(lock.at.x, lock.at.y, lock.at.z, hudAt);
      const px = hudAt.z > 0 ? (lock.size / (hudAt.z * tanHalf)) * (size.h / 2) * 1.6 : 0;
      placeMark(h.lock, hudAt, clamp(px, 26, 120));
      h.lock.toggleAttribute('data-hot', true);
      setText(h, h.lockName, TROOPS[lock.kind]?.name ?? lock.kind);
      setText(h, h.lockDist, `${Math.round(lock.dist)} m`);
    }
    setOn(h, h.lead, false);
    const back = on && info.ship.dist > 30 ? info.ship : null;
    setOn(h, h.nav, Boolean(back));
    if (back) {
      toScreen(back.at.x, back.at.y, back.at.z, hudAt);
      placeMark(h.nav, hudAt, 40);
      h.nav.toggleAttribute('data-way', false);
      setText(h, h.navName, SHIP_NAMES[state.kind] ?? 'The ship');
      setText(h, h.navDist, `${Math.round(back.dist)} m`);
    }
  };
  // G at a landing's door (footScene's door()): into the planet's page
  const intoDoor = () => {
    const d = foot.door();
    if (!d) return false;
    props.onOpen?.(d.id);
    return true;
  };
  // the way into the planet's world while the crew are down on it (wayin.js):
  // the HUD's button and Enter, there the whole time, not only at the door
  const wayInNow = () => (onFoot() ? wayIn({ id: foot.id, phase: foot.phase, frozen: props.frozen, crashing: Boolean(state.crash) }) : null);
  const intoWorld = () => {
    const w = wayInNow();
    if (!w) return false;
    props.onOpen?.(w.id);
    return true;
  };
  let enterWas = null;
  const placeEnter = () => {
    const el = props.enter?.current;
    if (!el) return;
    const label = wayInNow()?.label ?? '';
    if (label === enterWas) return;
    enterWas = label;
    el.hidden = !label;
    const text = el.querySelector('.universe-wayin-label');
    if (text) text.textContent = label;
  };
  // the line over the map: what G does here
  let promptWas = null;
  let figureSaid = null; // the line of whoever's near, said or waiting its turn (lib/speech.js)
  const placePrompt = () => {
    const el = props.prompt?.current;
    if (!el) return;
    let text = '';
    let say = null; // (a line someone says to you, { name, line }: nothing for G to do)
    let plain = false; // (a word on the HUD: nothing for G to do either)
    let cap = 'G'; // (the key the prompt's for)
    const info = onFoot() ? foot.info() : null;
    if (props.frozen) text = '';
    else if (state.note && wall() < state.note.until && !onFoot()) {
      text = state.note.text;
      plain = true;
    } else if (info && foot.phase === 'walk' && info.emote?.open) {
      text = EMOTES.map((id, i) => `${i + 1} ${id}`).join(' · ');
      plain = true;
    } else if (info && foot.phase === 'walk' && info.emote?.fresh && info.emote.on) {
      text = `${info.emote.on[0].toUpperCase()}${info.emote.on.slice(1)} · Z again, hold Z for more`;
      plain = true;
    } else if (info && foot.phase === 'walk' && info.gadget?.fresh) {
      text = `${info.gadget.name} · B for the next`;
      plain = true;
    } else if (info && foot.phase === 'walk' && info.near?.label) text = `Go in · ${info.near.label}`;
    else if (info && foot.phase === 'walk' && info.ship.near) text = `Get back in ${SHIP_NAMES[state.kind]?.replace(/^The /, 'the ') ?? 'the ship'}`;
    else if (info && foot.phase === 'walk' && info.near?.say) {
      text = `${info.near.say.name}: “${info.near.say.line}”`;
      say = info.near.say;
    }
    else if (!onFoot() && state.landable && !state.auto && Math.abs(state.ship?.speed ?? 0) < SHIP.boost && LANDABLE.some((p) => p.id === state.landable)) {
      // (no key for it: flying in is the way in)
      text = `Fly down into the air to enter ${worldName(state.landable) ?? placeName(state.landable)}`;
      plain = true;
    }
    else if (!onFoot() && state.phoneNear && !state.auto && !state.jump && flying()) text = 'Unlock the phone';
    else if (!onFoot() && state.jump?.phase === 'align' && flying()) {
      text = `Coming round to jump · ${destinationById(state.jump.id)?.name ?? state.jump.name ?? ''}`;
      plain = true;
    } else if (!onFoot() && state.aim && !state.jump && flying()) {
      // (the star the nose is on: J jumps to it)
      text = `Jump · ${destinationById(state.aim)?.name ?? state.aim}`;
      cap = 'J';
    }
    if (text === promptWas) return;
    promptWas = text;
    // what they say, in their own voice where it's been made (landings/voicelines.js); walking off stops it, and only it
    figureSaid?.stop();
    figureSaid = say ? sayVoiced(figureVoice(say), say.line) : null;
    // the key first, as a real cap (read with the words), unless there's no
    // key to press: a word on the HUD, someone talking
    if (text && !plain && !say) {
      const key = document.createElement('kbd');
      key.className = 'hud-kbd universe-prompt-key';
      key.textContent = cap;
      el.replaceChildren(key, document.createTextNode(text));
    } else el.textContent = text;
    el.toggleAttribute('data-on', Boolean(text));
    el.toggleAttribute('data-say', Boolean(say));
    el.toggleAttribute('data-plain', plain);
  };

  // ── Frames ──
  const still = () => reduced || state.low;
  let last = 0;
  // drawn less sharp, at once, while frames come late (a fight, a boost),
  // and sharp again once they don't (lib/three/pace)
  const pace = createPace();

  // The finish (post.js): grain and the edges' aberration with the boost's
  // rush and a hit; the glare in the lens (lib/three/flare) of the two stars
  // that light you (lighting.js's key and fill, where the fill is a star: two
  // suns, two flares), each hidden by whatever's between the eye and it, the
  // ship too, as strong as the star's light is where you are, and gone at
  // the pace's step 2 or on a low tier; and the exposure easing with how
  // much of the frame they fill (lib/three/exposure). Not on foot: the
  // landing has its own sky.
  const flares = tier === 'low' ? [] : [createFlare({ small }), createFlare({ small })];
  for (const f of flares) camera.add(f.group);
  const starOf = Object.fromEntries(LIT_STARS.map((st) => [st.id, st]));
  const shipSolid = { at: [0, 0, 0], r: 0 };
  // (what can hide each star: everything but the star itself, made once a star)
  const hiders = new Map();
  const hidersOf = (id) => {
    if (!hiders.has(id)) hiders.set(id, [...SOLIDS.filter((o) => o.id !== id), shipSolid, eclipseSolid]);
    return hiders.get(id);
  };
  const starAt = new THREE.Vector3();
  const eyeAt = new THREE.Vector3();
  const halfTan = () => Math.tan((camera.fov * Math.PI) / 360);
  let exposure = 1;
  const finish = (dt) => {
    post.grain(grainFor({ rush: state.streak, reduced }));
    post.aberration(aberrationFor({ rush: state.streak, hit: state.hurt, tier }));
    let share = 0;
    const s = state.ship;
    shipSolid.r = s ? LENGTH * 0.45 : 0;
    if (s) shipSolid.at = [s.x, s.y, s.z];
    camera.getWorldPosition(eyeAt);
    const eye = map.worldToLocal(eyeAt.clone()).toArray();
    [litBy.key, litBy.fill].forEach((light, i) => {
      const star = light && starOf[light.id];
      let ndc = [0, 0];
      let weight = 0;
      if (star && !onFoot()) {
        map.localToWorld(starAt.set(...star.at));
        const dist = starAt.distanceTo(eyeAt);
        starAt.project(camera);
        if (starAt.z < 1) {
          ndc = [starAt.x, starAt.y];
          const size = star.r / Math.max(dist, star.r) / halfTan();
          const hidden = occluded({ from: eye, to: star.at, solids: hidersOf(star.id) });
          // (as strong as its light is here: a far star a glint, not a glare)
          const k = Math.min(1, light.strength / KEY_FULL);
          share += sunShareOf({ ndc, size }) * (1 - hidden) * k;
          // (half as strong over the map, which is a chart, not a place you're in)
          weight = post.flareOn ? flareWeight({ ndc, occluded: hidden, size }) * k * (flying() && state.view !== 'map' ? 1 : 0.5) : 0;
          if (eclipse && star.id === eclipse.star.id) weight *= 1 - ECLIPSE.dim * eclipseK; // (the moon over it)
        }
      }
      flares[i]?.set({ ndc, weight, colour: star?.colour ?? null, camera });
    });
    // on foot, the landing's sun glares in the lens by day (landings/sky.js:
    // its disc a little over 0.03 radians across), the first flare's
    const sky = onFoot() ? foot.sky : null;
    if (sky && flares[0]) {
      let weight = 0;
      let ndc = [0, 0];
      starAt.copy(sky.sun).transformDirection(map.matrixWorld).multiplyScalar(camera.far * 0.5).add(eyeAt).project(camera); // (inside what the camera draws: footCamera's reach)
      if (starAt.z < 1 && sky.day > 0.02) {
        ndc = [starAt.x, starAt.y];
        weight = post.flareOn ? flareWeight({ ndc, size: 0.032 / halfTan() }) * sky.day : 0;
      }
      flares[0].set({ ndc, weight, colour: '#fff1d6', camera });
    }
    share = Math.min(1, share);
    exposure = exposureFor({ sunShare: share, darkShare: 1 - share, last: exposure, dt, reduced });
    post.exposure(onFoot() ? 1 : exposure);
  };

  // The scene's lights from the stars (lighting.js), at where the camera is:
  // the key and the fill turned to come from the stars that light it, each
  // eased (2 a second on each part of the way and the colour, so flying
  // from the home sun to Ember the light turns orange over the trip), the
  // ambient tinted in a nebula; and every planet's sun turned with the map.
  // A supernova's flash is a star while it burns. All at once on the first
  // frame and under reduced motion.
  const lightNow = { key: new THREE.Vector3().copy(LIGHT), fill: new THREE.Vector3(0.7, -0.4, -0.3).normalize(), first: true };
  // (what lit the last frame: the flares are drawn for its key and fill)
  let litBy = { key: null, fill: null };
  let envStar = null; // (the star the reflections' glow was made for)
  const lightTo = new THREE.Vector3();
  const footSun = new THREE.Vector3(); // (the landed planet's, for the crew's day: its own vector, kept)
  const lightColour = new THREE.Color();
  const toward = (v, to, k) => {
    v.x += Math.max(-k, Math.min(k, to.x - v.x));
    v.y += Math.max(-k, Math.min(k, to.y - v.y));
    v.z += Math.max(-k, Math.min(k, to.z - v.z));
    return v;
  };
  const tint = (c, to, k) => {
    c.r += Math.max(-k, Math.min(k, to.r - c.r));
    c.g += Math.max(-k, Math.min(k, to.g - c.g));
    c.b += Math.max(-k, Math.min(k, to.b - c.b));
  };
  const nearest = planets.map((p) => ({ p, d: 0 }));
  const lights = (dt) => {
    for (const p of planets) {
      const s = sunInMap[p.id];
      p.sun.set(s[0], s[1], s[2]).applyAxisAngle(Y_AXIS, state.yaw);
    }
    // the two planets nearest the camera have their ground come up in detail
    // as it nears them (planets.js); the rest needn't work it out
    for (const n of nearest) {
      const at = POSITIONS[n.p.id];
      n.d = Math.hypot(camLocal.x - at[0], camLocal.y - at[1], camLocal.z - at[2]) / n.p.radius;
    }
    nearest.sort((a, b) => a.d - b.d);
    nearest.forEach((n, i) => n.p.near(i < 2 ? n.d : 1e9));
    const nv = novae.nova();
    const nova = nv && nv.k > 0.05 ? { at: nv.at.toArray ? nv.at.toArray() : nv.at, colour: '#ffffff', strength: 3 * nv.k } : null;
    const l = lightAt(camLocal.toArray(), { nova });
    litBy = l;
    // what metal reflects made again round the new key when the star that
    // lights you changes (a few ms, and only crossing from one star's
    // neighbourhood to another's): its glow where the star is, in its colour
    if (l.key.id !== envStar && !lightNow.first) {
      envStar = l.key.id;
      const next = spaceEnvironment(renderer, T['sky-glow'], { light: lightTo.set(...l.key.dir).negate().applyAxisAngle(Y_AXIS, state.yaw), colour: l.key.colour });
      scene.environment = next.texture;
      env.dispose();
      env = next;
    } else if (lightNow.first) envStar = l.key.id;
    const k = lightNow.first || reduced ? Infinity : 2 * dt;
    lightNow.first = false;
    // (the way toward each light, in the world's axes: back along the way its light goes)
    toward(lightNow.key, lightTo.set(...l.key.dir).negate().applyAxisAngle(Y_AXIS, state.yaw), k).normalize();
    toward(lightNow.fill, lightTo.set(...l.fill.dir).negate().applyAxisAngle(Y_AXIS, state.yaw), k).normalize();
    key.position.copy(lightNow.key).multiplyScalar(50);
    keyW.value.copy(lightNow.key);
    fill.position.copy(lightNow.fill).multiplyScalar(50);
    tint(key.color, lightColour.setRGB(...l.key.colour), k);
    tint(fill.color, lightColour.setRGB(...l.fill.colour), k);
    // (dimmed by a moon across it: the eclipse)
    const covered = eclipse && l.key.id === eclipse.star.id ? 1 - ECLIPSE.dim * eclipseK : 1;
    key.intensity += Math.max(-k, Math.min(k, l.key.strength * covered - key.intensity));
    fill.intensity += Math.max(-k, Math.min(k, l.fill.strength - fill.intensity));
    ambient.color.setRGB(...l.ambient);
    ambient.intensity = 1;
    // (the styles that read the light or the screen: Cybertron's seams, Dot Matrix's dither)
    for (const p of planets) p.light(key.color, post.ratio);
    // and your ship's edges catch the fill's light, so it stands off the dark
    // (livery.js: in the key's complement, so the outline is a line of light)
    state.model?.rim({ colour: fill.color, dir: lightNow.fill, key: key.color });
  };

  // the pace's step on everything that follows it
  const paceTo = () => {
    post.sharpness = pace.scale;
    post.setLevel(pace.level);
    blasts.setMode(pace.level >= 2 || tier === 'low' || state.low ? 'pop' : 'full');
    // (the rocks' relief flat from the pace's step 3, and back: lib/three/rock)
    ROCK_RELIEF.value = pace.level >= 3 ? 0 : 1;
    // (the planets' ground detail goes at the pace's step 2, their real air for
    // the old halo and their clouds' shadows at 3, and they come back)
    for (const p of planets) p.setLevel(pace.level);
  };
  function render(ms, now) {
    gl.watch(now);
    if (pace.frame(now) !== null) paceTo();
    const dt = ms / 1000;
    const t = reduced ? 0 : state.low ? state.tLow : (now - t0) / 1000;
    // (the Twins' suns going round each other: their solids where they're drawn, deep.js)
    moveBinaries(t);
    if (!state.pose && !flying()) {
      // first frame: straight onto a universe from a link; the overview
      // drifts in from a little further out (flying, it's below)
      if (state.sel) {
        state.yaw = frontYaw(state.sel);
        state.yawTo = null;
        map.rotation.y = state.yaw;
        map.updateMatrixWorld();
      }
      const to = goal();
      if (state.sel || reduced) state.pose = to;
      else {
        state.pose = { target: [...(state.overview?.target ?? to.target)], dist: (state.overview?.dist ?? to.dist) * 1.35, pitch: (state.overview?.pitch ?? to.pitch) + 0.12 };
        state.flight = startFlight(state.pose, now, 1800);
      }
    }
    if (!flying() && !state.drag && state.yawTo !== null && !reduced) {
      // swing round with the camera's flight
      const left = state.yawTo - state.yaw;
      state.yaw += left * clamp01((ms / 1000) * 2.6);
      if (Math.abs(left) < 0.002) {
        state.yaw = state.yawTo;
        state.yawTo = null;
      }
    }
    if (!flying() && !state.drag && state.vel && !reduced) {
      state.yaw += state.vel * ms;
      state.vel *= 0.0035 ** (ms / 1000);
      if (Math.abs(state.vel) < 2e-6) state.vel = 0;
    }
    let moving = false;
    if (flying() && !state.dive && !props.frozen) moving = onFoot() ? footFrame(dt, t) : fly(feel.step(dt), t); // (slowed a moment by a hitstop)
    else if (onFoot()) footFrame(0, t); // (frozen: held where it is)
    if (flying() && !state.dive && !onFoot()) follow(dt);
    // somewhere to land and step out: a planet you're at (not a station)
    const landable = flying() && !onFoot() && !state.crash && !state.dive && state.at && byId(state.at)?.kind !== 'core' && !byId(state.at)?.portal ? state.at : null; // (not a station, nor the gate into the galaxy)
    if (landable !== state.landable) {
      state.landable = landable;
      state.landableFor = 0;
      emit({ type: 'landable', id: landable });
    }
    // (and what coming down there will want, fetched while you're still
    // flying: once you've stayed a moment, not as you fly past)
    if (landable) {
      const was = state.landableFor;
      state.landableFor += dt;
      if (was < PREFETCH_AFTER && state.landableFor >= PREFETCH_AFTER) foot.prefetch(landable, state.kind);
    }
    placeAlt();
    map.rotation.y = state.yaw;
    map.updateMatrixWorld();

    let pose;
    if (state.dive) {
      const d = state.dive;
      const k = clamp01((now - d.start) / DIVE_MS);
      const e = k * k * k;
      const to = worldPos(d.id, state.yaw);
      const end = byId(d.id).size * 1.05;
      pose = {
        target: d.from.target.map((x, i) => x + (to[i] - x) * Math.min(1, e * 1.5)),
        dist: Math.exp(Math.log(d.from.dist) + (Math.log(end) - Math.log(d.from.dist)) * e),
        pitch: d.from.pitch,
      };
      // the ship goes in first
      if (state.model) {
        const [px, py, pz] = POSITIONS[d.id];
        const g = state.model.group.position;
        g.set(g.x + (px - g.x) * e * 0.25, g.y + (py - g.y) * e * 0.25, g.z + (pz - g.z) * e * 0.25);
      }
    } else if (!flying()) {
      const r = poseAt(state.flight, goal(), now);
      pose = r.pose;
      if (r.done) state.flight = null;
    }
    if (pose) {
      state.blend = null;
      state.pose = pose;
      apply(pose);
      state.cam = viewOfPose(pose);
    } else {
      // flying: riding with the ship (first frame: straight in behind it
      // parked at a universe from a link, or in from a little way out over
      // the overview)
      if (!state.cam && !state.sel && !reduced && state.overview) {
        const o = state.overview;
        state.blend = { from: viewOfPose({ target: [...o.target], dist: o.dist * 1.35, pitch: o.pitch + 0.12 }), start: now, dur: 1800 };
      }
      const to = flightView();
      let view = to;
      if (state.blend) {
        const k = clamp01((now - state.blend.start) / state.blend.dur);
        if (k >= 1) state.blend = null;
        else view = blendView(state.blend.from, to, easeOut(k));
      }
      state.cam = view;
      applyView(view);
      state.pose = poseOfView(view);
    }
    // on foot, the camera's behind you (footScene.js), eased over from where it was
    if (onFoot()) footCamera(dt);
    else reach(FAR);
    easeCamera(now);
    // into the cockpit and out of it: the ship fades from view and the
    // cockpit takes its place, and your head turns a little (the cockpit
    // with it); the horizon rolls with the ship, all the way round
    const cabWant = flying() && !onFoot() && state.view === 'cockpit' && !state.crash && !state.dive ? 1 : 0;
    const cabWas = state.cabK;
    state.cabK += (cabWant - state.cabK) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    if (Math.abs(state.cabK - cabWant) < 0.002) state.cabK = cabWant;
    const inCab = flying() && !onFoot() && state.cabK > 0.001 && !state.crash;
    if (inCab && cab) {
      camera.rotateY(cab.look.yaw * state.cabK);
      camera.rotateX(cab.look.pitch * state.cabK);
      camera.updateMatrixWorld();
    }
    // boosting, the lens widens (so the speed shows at the edges), with a
    // kick as a boost lights; the cockpit's lens is the intro's, wider (and on
    // foot, a person's); and going in after the ship into the Maw, it widens
    // as it goes
    const baseWant = onFoot() ? FOOT_FOV : flying() && state.view === 'cockpit' ? cabFov() : FOV;
    state.fovBase += (baseWant - state.fovBase) * (reduced ? 1 : 1 - Math.exp(-dt * 5));
    const plunging = state.crash?.swallow ? plungeAt(state.crash.age) : 0;
    const fov = state.fovBase + (reduced || !flying() || onFoot() || state.view === 'map' ? 0 : 8 * state.streak ** 1.4 + 4 * state.kick * (1 - state.kick * 0.5) + 18 * plunging ** 2);
    if (Math.abs(camera.fov - fov) > 0.005) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      tanHalf = Math.tan((fov * Math.PI) / 360);
    }
    if (state.kick > 0) state.kick = Math.max(0, state.kick - dt * 1.8);
    // a crash shakes the camera a moment (not with reduced motion: the
    // feel's calm), and the glare flares. The k said this frame is the
    // feel's trauma if it's more than what's left
    if (state.shake > 0) {
      const left = feel.state().trauma;
      if (state.shake > left) feel.trauma(state.shake - left);
      state.shake = 0;
    }
    if (feel.state().trauma > 0) {
      feel.setBaseFov(camera.fov); // (the lens is the scene's: the feel only shakes)
      feel.update(dt, camera);
      camera.updateMatrixWorld();
    }
    if (state.flare > 1) {
      state.flare = 1 + (state.flare - 1) * Math.exp(-dt * 2.5);
      if (state.flare < 1.01) state.flare = 1;
      post.flare(state.flare);
    }
    if (pulseAt) {
      // the arrival ring: from the planet's edge out past its moons, fading
      pulseAt.age += dt;
      const k = clamp01(pulseAt.age / 1.3);
      const u = byId(pulseAt.id);
      const [px, py, pz] = POSITIONS[pulseAt.id];
      pulse.visible = k < 1;
      pulse.position.set(px, py, pz);
      pulse.scale.setScalar(u.size * (1.05 + k * 1.6));
      pulse.material.color.set(u.swatch).multiplyScalar(2.6 * (1 - k) ** 2);
      if (k >= 1) pulseAt = null;
    }
    const crashBusy = crashFx.update(dt, camera);
    const popBusy = pops.update(dt, camera);
    blasts.update(dt);
    const gunBusy = gunPortal.update(dt);
    const fxBusy = crashBusy || popBusy || gunBusy || Boolean(state.crash?.swallow);
    if (traffic) {
      for (const e of traffic.update(dt, t, flying() && !state.crash && !state.dive ? state.ship : null, { fight: Boolean(hunters?.active), feared: standing.feared, wanted: standing.wanted || wanted.stars > 0 })) {
        if (e.type === 'spotted') {
          law?.spotted(); // (the law's eyes on you: wanted.js)
          // a patrol of the law going past has seen a wanted pilot: they come
          // (once in a while), and the crew say so; with the law (law.js),
          // it's the stars that bring them
          if (hunters && state.ship && !state.crash && !hunters.active && state.clock - spottedAt > SPOTTED_EVERY && !wanted.stars) {
            spottedAt = state.clock;
            if (law) law.crime('busted', state.ship);
            else hunters.pack(e.faction, state.ship, { size: 2, ace: false, heat: state.heat });
            hunts += 1;
            emit({ type: 'event', id: 'spotted' });
          }
        } else if (e.event === 'convoy') emit({ type: 'event', id: 'convoy' });
        else if (!e.event) emit(e); // (someone in distress said so as they came)
      }
    }
    const adventuring = adventure(dt, t);

    // (the streaks' speed tops out at the boost's: at the pulse drive's
    // they'd be a wall; and none in the map view, which isn't the ship's)
    streak.update(dt, state.ship ? Math.min(Math.abs(state.ship.speed), STREAK_SPEED) : 0, state.view === 'map' ? 0 : state.streak);
    const bursting = burst.update(dt);
    // a supernova going: its flash lights the whole sky a moment
    const novaBusy = novae.update(t, dt, camera);
    const nova = novaBusy ? novae.nova() : null;
    if (nova && nova.k > 0.6 && !reduced) state.flare = Math.max(state.flare, 1 + nova.k * 0.6);
    if (!reduced && flying() && state.view === 'cockpit' && state.streak > 0.001) {
      // from the pilot's seat: out from the middle of the view
      post.rush(state.streak * 0.8, (state.rect.x + state.rect.w / 2) / size.w, 1 - (state.rect.y + state.rect.h / 2) / size.h);
    } else if (!reduced && flying() && state.view === 'chase' && state.streak > 0.001 && state.model) {
      // out from the ship, where it is on the canvas
      state.model.group.getWorldPosition(v).project(camera);
      post.rush(state.streak, (v.x + 1) / 2, (v.y + 1) / 2);
    } else post.rush(0);
    // the orbits fade while you fly down among them (edge-on they'd be stripes)
    const ringsWant = flying() && state.view !== 'map' ? 0.012 : 0.05;
    rings.material.opacity += (ringsWant - rings.material.opacity) * clamp01(dt * 3);
    const shooting = moveBolts(dt);
    const launching = moveMissiles(dt);
    if (armory) armory.update(dt);
    sun.update(t, camera);
    sky.setRatio(gl.ratio); // (the watchdog may have changed it)
    // each place's own motion (a station's lights, particles, its screen)
    // only while it's in view and more than a speck
    viewFrustum.setFromProjectionMatrix(viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const p of planets) {
      p.group.getWorldPosition(placeBound.center);
      placeBound.radius = p.radius * 2.6; // (out past its moons and what orbits it)
      const d = camera.position.distanceTo(placeBound.center);
      const px = d > placeBound.radius ? (placeBound.radius / (d * tanHalf)) * (size.h / 2) : Infinity;
      p.update(t, camera, px > 2 && viewFrustum.intersectsSphere(placeBound));
    }
    near.update(camera.position, planets);
    locate();
    placeLabels();
    if (state.hitMark > 0) state.hitMark = Math.max(0, state.hitMark - dt * 4);
    // the other pilots: where you are, out to them; where they are, drawn.
    // Down on a planet, it's your crew that go out (your ship's off the
    // sky: parked, the others see it on the ground), and the crews of
    // anyone down on the same planet walk about with yours
    if (net) {
      const s = flying() ? state.ship : null;
      net.pose(s, { hidden: Boolean(state.crash || state.dive || props.frozen || onFoot()), boost: state.streak > 0.3, safe: state.clock < state.safeUntil, shield: state.shield });
      net.pack?.(() => (s && !state.crash && !state.dive && !props.frozen && !onFoot() ? (hunters?.wire() ?? []) : []));
      net.foot?.(onFoot() && !props.frozen ? foot.crew() : null);
      if (onFoot()) foot.guests(guestsOnFoot(now));
    }
    const piloting = pilots.update(dt, now, net, { project: toScreen, tags: props.tags?.current ?? null, locked: state.lockTarget?.peer ?? null, footOn: onFoot() ? foot.id : null, me: flying() ? state.ship : null, factions: net?.factions ?? null, from: state.ship ?? null });
    placeHud();
    placePrompt();
    placeEnter();
    // the sky and the far stars stay round the camera, wherever it flies;
    // the dust rides with it too, and shows while you fly (more, the faster)
    // (only the map's own turn is wanted here: the drawing brings everything
    // inside it up to date, once)
    map.updateWorldMatrix(true, false);
    map.worldToLocal(camLocal.copy(camera.position));
    lights(dt);
    // (the look follows the lights; what's come into the scene since is taken on every half second or so)
    house.follow({ adopt: houseFrames++ % 30 === 0 });
    deep.update(t, camera, camLocal, { names: onFoot() && foot.entry() ? false : (id) => named(id, wonderById(id)?.at) });
    const skySector = mapSectorOf(camLocal.x, camLocal.y, camLocal.z);
    farStars.update(camera, dt, { focus: state.jump?.id ?? state.aim ?? state.auto?.id ?? null, sector: skySector });
    landmarks.update(camera, t, { sector: skySector, groups: landmarkGroup });
    aimAt();
    expanse.update({ ship: flying() && !state.dive ? state.ship : null, camera, t, dt });
    sectorPortals.update(t, camera);
    curve.update(t, sectorOf(camLocal.x, camLocal.y, camLocal.z) === 'rickmorty');
    sectorFleet.update(t, Boolean(state.ship) && sectorOf(state.ship.x, state.ship.y, state.ship.z) === 'rickmorty');
    // the Citadel's siege: rebuilt or patched up when it's time, what's left
    // of it drawn, and your word on it out to everyone (soon after a hit of
    // yours; every few seconds while there's anything to tell)
    const wallMs = Date.now();
    const tick = siege.tick(wallMs);
    if (tick) {
      siegeMine = false;
      readSiegeState();
      if (tick.type === 'rebuilt') emit({ type: 'siege', what: 'rebuilt', near: camLocal.distanceTo(citadelMid ?? camLocal) < 1600 });
    } else if (performance.now() - siegeLook > 500) readSiegeState();
    const sieging = siegeView ? siegeView.update(t, dt, camLocal, siegeSt) : false;
    if (net?.siege && ((siegeOwed && wallMs - siegeSent > 350) || (siege.active && net.peers.size > 0 && wallMs - siegeSent > 5000))) {
      net.siege(siege.message());
      siegeSaves?.set(SIEGE_KEY, siege.save(wallMs)); // (kept with the shares it told)
      siegeSent = wallMs;
      siegeOwed = false;
    }
    placeArms();
    phone.update(t, camera);
    // the fall into the Maw: the ship's trail and glow, and its last light
    if (infall) {
      if (state.crash?.swallow && !state.crash.back) infall.update(dt, state.crash.fell, camLocal, camera);
      else infall.clear();
    }
    for (const tr of trenches) {
      if (camLocal.distanceTo(tr.group.position) < 3500) tr.wake();
      tr.near(camLocal);
    }
    bend();
    sky.group.position.copy(camLocal);
    const dustWant = !reduced && flying() && !onFoot() && state.view !== 'map' ? 0.35 + 0.65 * clamp01(Math.abs(state.ship.speed) / SHIP.cruise) : 0;
    dustAmount += (dustWant - dustAmount) * clamp01(dt * 3);
    dust.update(camLocal, dustAmount, gl.ratio);
    belt.update(t);
    rim.update(t);
    rim.group.visible = Math.hypot(camLocal.x, camLocal.z) > RIM.inner * 0.6; // (from deep inside the map its rocks are under a pixel: not drawn)
    // the cockpit over the world, once the camera's in the seat
    const showCab = Boolean(cab && cab.kind === state.kind && flying() && !onFoot() && state.view === 'cockpit' && state.cabK > 0.6 && !state.crash);
    if (showCab) cabFrame(dt, t);
    post.overlay(showCab ? cabScene : null, camIn);
    // (the engines placed once everything has moved: three pixels at least in the frame as drawn)
    engines.update(t, camera, size.h * post.ratio);
    finish(dt);
    renderer.info.reset(); // counted over the whole frame, post passes and all
    drawn(() => post.render(size.w, size.h));
    last = now;

    if (state.dive) return now - state.dive.start < DIVE_MS; // then the page takes over
    if (state.crash?.through) return true; // the crater glows on while the page washes out
    if (props.frozen) return false;
    return !still() || moving || shooting || launching || sieging || fxBusy || bursting || novaBusy || adventuring || piloting || net?.peers.size > 0 || state.kick > 0 || state.hitMark > 0 || cabWas !== state.cabK || Math.abs(state.fovBase - baseWant) > 0.01 || pulseAt || traffic?.count > 0 || state.flare > 1 || Boolean(state.jump) || Boolean(state.flight || state.drag || state.vel || state.stick?.on || state.yawTo !== null || state.blend);
  }

  // ── Keys, while flying ──
  const held = new Set(); // the keys down now (as e.key, lower case) that steer
  const onKeyDown = (e) => {
    if (!flying() || props.frozen || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    const key = e.key.toLowerCase();
    if (!keyFlies(el, key)) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    // on a button or link, Enter is its own. The arrows and Space fly anyway
    // (a click on a panel or HUD button leaves the focus on it, and the
    // hangar, the settings and the nav map hand it back to their button: the
    // arrows stopped steering and Space opened the hangar again), unless the
    // control took them itself (preventDefault: the planet labels, the
    // guide's tabs); taken here, Space's keydown is prevented, so no click
    const onControl = el instanceof HTMLElement && el !== document.body && el.closest('button, a, [role="button"], [tabindex]:not([tabindex="-1"])');
    if ((key === 'g' || key === 'e' || (key === 'enter' && !onControl)) && state.phoneNear && !onFoot() && !state.landable && !state.at) {
      // at the phone: it asks for its password
      e.preventDefault();
      emit({ type: 'phone', what: 'open' });
      return;
    }
    if (key === 'g' && onFoot()) {
      // on foot: a door, or back in the ship (in it, there's no key to land:
      // you fly down into a planet's air)
      e.preventDefault();
      heard();
      // (a door you're at first: a big ship's reach can take in one near it)
      if (!intoDoor() && !foot.board()) emit({ type: 'foot', id: 'far' });
      return;
    }
    if (onFoot()) {
      footKey(e, key, onControl);
      return;
    }
    if (key === 'p') {
      // Rick's portal gun
      e.preventDefault();
      portalGun();
      return;
    }
    if (key === 'm') {
      // the nav map (the page opens it); from the whole map in 3D, back to the ship
      heard();
      if (state.view === 'map') {
        state.view = state.seat;
        retarget(900);
        ctx.invalidate();
      } else emit({ type: 'map' });
      return;
    }
    if (key === 'j') {
      // a jump to the star the nose is on (aim.js); else to the place
      // picked, if it's not where you are; or the nav map, to pick one
      e.preventDefault();
      heard();
      const to = state.aim ?? (state.sel && state.sel !== state.at ? state.sel : null);
      if (to) travel(to, 'hyper');
      else emit({ type: 'map' });
      return;
    }
    if (key === 'v') {
      // the other seat: the cockpit, or behind the ship
      e.preventDefault();
      heard();
      setSeat(state.seat === 'cockpit' ? 'chase' : 'cockpit');
      return;
    }
    if (key === 'f') {
      // the trigger, held: the guns keep firing at their own pace (fly())
      e.preventDefault();
      heard();
      if (!e.repeat) fire();
      held.add(key);
      state.keys.fire = true;
      ctx.invalidate();
      return;
    }
    if (key === 'r' || key === '1' || key === '2' || key === '3') {
      // the weapons (weapons.js): R on to the next (Shift+R back), or 1 2 3
      e.preventDefault();
      heard();
      pickWeapon(key === 'r' ? (e.shiftKey ? 'back' : 'next') : Number(key) - 1);
      return;
    }
    if (key === 't' || key === 'q') {
      // the next target round the nose (Q, or Shift+T, the one before)
      e.preventDefault();
      heard();
      state.cycle = key === 'q' || e.shiftKey ? -1 : 1;
      ctx.invalidate();
      return;
    }
    if ((key === 'e' || (key === 'enter' && !onControl)) && state.at === 'citadel' && siegeSt.down) {
      e.preventDefault();
      emit({ type: 'siege', what: 'closed' });
      return;
    }
    if ((key === 'e' || (key === 'enter' && !onControl)) && state.at) {
      e.preventDefault();
      props.onLand?.();
      return;
    }
    const k = KEYS[key];
    if (!k || e.defaultPrevented) return;
    e.preventDefault();
    heard();
    if (k !== 'boost') takeover();
    held.add(key);
    state.keys[k] = true;
    ctx.invalidate();
  };
  // the keys on foot: walking (W A S D, Q E to step sideways), Shift to
  // run, Space to jump, F to fire, T the next trooper, X to play the other
  // one, B Rick's next gadget, Z an emote (held, the wheel of five), V out
  // of your own eyes, Enter into the planet's world (wayin.js)
  const footKey = (e, key, onControl) => {
    // Z held: the emote wheel; 1 to 5 picks one while it's open (lib/emote.js's five)
    if (key === 'z') {
      e.preventDefault();
      if (!e.repeat) foot.emote('down');
      return;
    }
    if (foot.info()?.emote?.open && /^[1-5]$/.test(key)) {
      e.preventDefault();
      foot.emote('pick', Number(key));
      return;
    }
    if (key === 'b') {
      e.preventDefault();
      const gun = foot.gadget();
      if (gun) emit({ type: 'foot', id: 'gadget', gun });
      return;
    }
    if (key === 'f') {
      e.preventDefault();
      const gun = foot.fire();
      if (gun) emit({ type: 'fire', gun });
      return;
    }
    if (key === 't') {
      e.preventDefault();
      foot.cycle();
      return;
    }
    if (key === 'x') {
      e.preventDefault();
      const who = foot.swap();
      if (who) emit({ type: 'foot', id: 'swap', who });
      return;
    }
    if (key === 'v') {
      e.preventDefault();
      foot.first();
      return;
    }
    if (key === 'enter' && !onControl && intoWorld()) {
      e.preventDefault();
      heard();
      return;
    }
    if (key === 'enter' && !onControl && state.at) {
      e.preventDefault();
      props.onLand?.();
      return;
    }
    const k = FOOT_KEYS[key];
    if (!k || e.defaultPrevented) return;
    e.preventDefault();
    held.add(key);
    state.keys[k] = true;
    state.lastInput = performance.now();
    ctx.invalidate();
  };
  // A key let go: what it means is let go, in the ship and on foot (so
  // nothing sticks from one to the other), unless another key still down
  // means the same thing now. (D is the roll in the ship and the turn on
  // foot, and the up arrow the nose in the ship and walking on foot: letting
  // go of D mustn't let go of the right arrow's turn, nor the up arrow of W's
  // throttle.)
  const onKeyUp = (e) => {
    const key = e.key.toLowerCase();
    held.delete(key);
    // (Z let go on foot: the emote pointed at, or a tap's last)
    if (key === 'z' && onFoot() && foot.emote('up')) ctx.invalidate();
    const now = onFoot() ? FOOT_KEYS : KEYS;
    for (const map of [KEYS, FOOT_KEYS]) {
      const k = map[key];
      if (!k) continue;
      let still = false;
      for (const h of held) if (now[h] === k) still = true;
      state.keys[k] = still;
    }
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
  window.addEventListener('tp:arrive', takeArrive);
  takeArrive();
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onHidden);

  // ── Pointer: a click picks a planet; a drag turns the map, or steers ──
  const steersByDrag = dragSteers();
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  // on foot, the look (runtime/look.js): a click locks the pointer and the
  // mouse or the trackpad turns you, Esc lets go, a drag where the lock's
  // refused or Drag was picked (the galaxy's Menu keeps the pick for every
  // world); the click that asks for the lock doesn't also fire
  const looker = createLook({
    host: canvas,
    active: () => onFoot(),
    drag: { yaw: 0.006, pitch: 0.004 },
    onTurn: (dx, dy) => {
      foot.turn(dx, dy);
      ctx.invalidate();
    },
    onLock: () => sendLook(),
  });
  looker.attach();
  // (the page shows the look's prompt on foot from these)
  let lookSent = '';
  const sendLook = () => {
    const now = `${looker.mode}:${looker.locked}`;
    if (now === lookSent) return;
    lookSent = now;
    emit({ type: 'look', mode: looker.mode, locked: looker.locked });
  };
  sendLook();
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (state.drag || state.dive || props.frozen) return;
    const [x, y] = local(e);
    capturePointer(e, canvas);
    heard();
    state.vel = 0;
    const asks = onFoot() && e.pointerType === 'mouse' && looker.mode === 'lock' && !looker.locked && !looker.refused;
    state.drag = { id: e.pointerId, x, y, yaw: state.yaw, moved: 0, lastX: x, lastT: performance.now(), asks };
    ctx.invalidate();
  };
  const onMove = (e) => {
    const [x, y] = local(e);
    const d = state.drag;
    if (d && d.id === e.pointerId) {
      d.moved = Math.max(d.moved, Math.hypot(x - d.x, y - d.y));
      if (d.moved < DRAG) return;
      if (onFoot() && e.pointerType === 'mouse') {
        // on foot, a mouse drag looks about: the look's (above), not the map's
      } else if (flying()) {
        // a stick wherever the press began (not on a laptop: dragSteers)
        if (!steersByDrag) return;
        if (!state.stick) takeover();
        state.stick = { id: e.pointerId, x: d.x, y: d.y, dx: x - d.x, dy: y - d.y, on: true, pointer: e.pointerType };
        placeStick();
      } else {
        const now = performance.now();
        state.yawTo = null;
        const turn = TURN * controls().drag;
        state.yaw = d.yaw + (x - d.x) * turn;
        state.vel = ((x - d.lastX) * turn) / Math.max(1, now - d.lastT);
        d.lastX = x;
        d.lastT = now;
      }
      canvas.style.cursor = 'grabbing';
      ctx.invalidate();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    // from the pilot's seat, out toward an edge looks that way
    if (cab && state.view === 'cockpit') {
      const nx = clamp((x - (state.rect.x + state.rect.w / 2)) / (state.rect.w / 2), -1, 1);
      const ny = clamp((y - (state.rect.y + state.rect.h / 2)) / (state.rect.h / 2), -1, 1);
      const [ry, rp] = cab.built.range ?? [1, 0.4];
      cabLook.ty = -Math.sign(nx) * smoothstep(0.3, 0.97, Math.abs(nx)) * ry;
      cabLook.tp = -Math.sign(ny) * smoothstep(0.45, 0.97, Math.abs(ny)) * rp;
      ctx.invalidate();
    }
    const sign = pickSign(x, y);
    const id = sign ? null : pick(x, y);
    canvas.style.cursor = sign || id || (!id && (pickWonder(x, y) || pickPhone(x, y))) ? 'pointer' : 'grab';
    setSignHover(sign);
    setHover(id);
  };
  const endDrag = () => {
    state.drag = null;
    state.stick = null;
    placeStick();
    canvas.style.cursor = 'grab';
  };
  const onUp = (e) => {
    const d = state.drag;
    if (!d || d.id !== e.pointerId) return;
    endDrag();
    if (d.moved < DRAG && onFoot()) {
      // on foot, a click fires (at a trooper, if it's on one); not the one
      // that asked for the lock
      if (d.asks) return sendLook();
      const [x, y] = local(e);
      const tid = pickTrooper(x, y);
      if (tid) foot.lockOn(tid);
      const gun = foot.fire();
      if (gun) emit({ type: 'fire', gun });
      ctx.invalidate();
      return;
    }
    if (d.moved < DRAG) {
      state.vel = 0;
      const [x, y] = local(e);
      const sign = pickSign(x, y);
      if (sign) {
        props.onOpen?.(sign);
        return;
      }
      if (pickPhone(x, y)) {
        emit({ type: 'phone', what: 'open' });
        return;
      }
      const id = pick(x, y);
      if (id) props.onPick?.(id);
      else if (flying()) {
        // a hunter: the guns lock on to it (picked by hand, so it holds a good
        // while even off the nose); a wonder: the ship flies itself there
        const hid = pickHunter(x, y);
        if (hid) {
          heard();
          state.lock = { id: hid, out: 0, manual: true };
        } else {
          const wid = pickWonder(x, y);
          if (wid) navTo(wid);
        }
      }
    } else if (performance.now() - d.lastT > 80) state.vel = 0; // let go after holding still
    ctx.invalidate();
  };
  const onCancel = (e) => {
    if (state.drag?.id !== e.pointerId) return;
    endDrag();
    state.vel = 0;
    ctx.invalidate();
  };
  const onLeave = (e) => {
    if (e.pointerType !== 'mouse' || state.drag) return;
    cabLook.ty = cabLook.tp = 0;
    setHover(null);
    setSignHover(null);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('pointerleave', onLeave);

  state.loadout = readLoadout(props.loadout);
  setShip(props.ship ?? null);
  setNet(props.net);
  paintStates();

  // a ship of every kind that may come (the hunters, the traffic, the set
  // pieces' big ships, as built until their models load), out of sight, so
  // their shaders are made with everything else's; and then every shader
  // the map draws with, its passes' too, made before the first frame (the
  // page waits for them, so the first look round doesn't stall)
  const spares = new THREE.Group();
  spares.visible = false;
  const stock = []; // [kind, model]: the fleet's, once their shaders are made
  if (!reduced) {
    const kinds = new Set([...Object.values(FACTIONS).flatMap((f) => [...f.kinds.map(([k]) => k), f.ace].filter(Boolean)), ...BUILT_KINDS, ...Object.keys(GLB).filter((k) => GLB[k].built)]);
    for (const k of kinds) {
      const made = buildTraffic(k);
      spares.add(made.group);
      stock.push([k, made]);
    }
    // and the boost's burst, which only joins the ship as it lights (so
    // isn't in the scene: its shader would otherwise be made on the first boost)
    spares.add(burst.mesh);
  }
  map.add(spares);
  // the house look on everything built so far before its shaders are made:
  // put on at the first frame instead, it changed every lit shader after
  // they were compiled, and they were all compiled again in that frame
  house.follow({ adopt: true });
  const ready = Promise.all([warm(scene), post.composer ? precompilePasses(renderer, post.composer, camera) : null]).then(() => {
    // made: out of the scene (so nothing walks them each frame), and the
    // ships on to the fleet, ready to fly (the first of each kind isn't
    // built in the middle of a frame)
    map.remove(spares);
    if (disposed) return;
    for (const [k, model] of stock) fleet.stock(k, model);
    warmed = true;
    stockUp();
  });

  // (development: the ship put just outside a planet's air, level, flying at
  // its middle at `speed` from the way `from` points, for flying in from a
  // script: scripts/entry-check.mjs)
  const diveAt = (id, speed = SHIP.cruise, from = [1, 0, 0]) => {
    const p = LANDABLE.find((o) => o.id === id);
    if (!p || !state.ship || onFoot() || state.crash) return false;
    const l = Math.hypot(from[0], from[2]) || 1;
    const [ux, uz] = [from[0] / l, from[2] / l];
    const r = airTop(p) + 0.6;
    dropAuto();
    state.ship = { ...state.ship, x: p.at[0] + ux * r, y: p.at[1], z: p.at[2] + uz * r, heading: headingTo(-ux, -uz), pitch: 0, bank: 0, speed, vy: 0, lift: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, edge: false };
    ctx.invalidate();
    return true;
  };

  // (development: the ship and the camera put at one of poses.js's fixed
  // poses and held there, nothing coming for it, so every measure of the
  // map is of the same picture: scripts/universe-check.mjs. Resolves after
  // two drawn frames; a landing pose, once the crew are out.)
  const frames = (n) => new Promise((done) => {
    const tick = () => (n-- <= 0 ? done() : (ctx.invalidate(), requestAnimationFrame(tick)));
    tick();
  });
  const holdPose = async (name) => {
    const p = poseFor(name);
    if (!p) throw new Error(`[universe] no pose ${name}`);
    if (!state.ship || onFoot() || state.crash || state.dive) throw new Error('[universe] a pose needs the ship flying (reload for another after a landing)');
    dropAuto();
    state.yawTo = null;
    state.vel = 0;
    state.blend = null;
    state.lock = null;
    state.lockTarget = null;
    state.streak = 0;
    state.boosting = false;
    hunters?.clear();
    meteors.clear();
    mines.clear();
    dropEscort();
    dropEclipse();
    burst.clear();
    const [x, y, z] = p.at;
    state.ship = { ...state.ship, x, y, z, heading: p.heading, speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, leanV: 0, edge: false };
    // (the map turned the way the ship faces, as arriveAt does, so the
    // key light falls the same way every time, not wherever the turn's ease got to)
    state.yaw = -p.heading;
    camQOn = false;
    state.view = p.view === 'map' ? 'map' : 'chase';
    let view = null;
    if (p.eye) {
      // looking from the eye at `look`, but the view's distance no further
      // than the ship (the near plane follows it: applyView's lens)
      const eye = new THREE.Vector3(...p.eye);
      const look = new THREE.Vector3(...p.look);
      const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(eye, look, Y_AXIS));
      const dist = Math.min(eye.distanceTo(look), eye.distanceTo(new THREE.Vector3(x, y, z)));
      view = { target: eye.clone().addScaledVector(look.sub(eye).normalize(), dist), quat, dist };
    }
    state.held = { name, view };
    await frames(2);
    if (p.foot) {
      if (!startFoot({ id: p.foot })) throw new Error(`[universe] couldn't land on ${p.foot}`);
      const t0 = performance.now();
      while (foot.phase !== 'walk' && performance.now() - t0 < 300000) await frames(1);
      await frames(2);
    }
    return { name, at: p.at, view: state.view, foot: foot.phase ?? null };
  };

  // in development, renderer counts and the ship, for checking from a browser
  if (import.meta.env.DEV) {
    window.__universeDebug = { THREE, post, scene, expanse, renderer, camera, traffic, hunters, wingmen, skirmishes, npcs, NPCS, meetNpc: (id) => state.ship && npcs?.add(NPCS[id], skirmishSpot(state.ship) ?? { x: state.ship.x, y: state.ship.y + 5, z: state.ship.z - 40 }), director, pieces, leviathans, meteors, fleet, novae, pilots, standing, deed, wanted, law, wonders: WONDERS.map((w) => ({ id: w.id, name: w.name, at: w.at, reach: reachOf(w) })), state, foot, planets, startFoot, travel: (id, drive) => travel(id, drive), diveAt, net: () => net, siege, citadelGeo, arms, readSiegeState, rockFields, smashed, front: () => front, happen: (id) => happen(id, state.ship), mines, escort: () => escort, eclipse: () => eclipse && { ...eclipse, k: eclipseK, key: key.intensity }, remover: () => remover, removerView, ram: (gap = 6, kind = 'tie') => {
      // a TIE (or `kind`) put `gap` dead ahead at your height, coming at you, for checking a ram from a browser
      const s = state.ship;
      if (!s || !hunters) return null;
      hunters.pack('empire', s, { size: 1, ace: false, kinds: [kind] });
      const b = hunters.bodies.at(-1);
      const [fx, fz] = forward(s.heading);
      Object.assign(b.at, { x: s.x + fx * gap, y: s.y, z: s.z + fz * gap });
      Object.assign(b.prev, b.at);
      Object.assign(b.vel, { x: -fx * 8, y: 0, z: -fz * 8 });
      return b.key;
    } };
    window.__universe = () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      ratio: gl.ratio,
      sharpness: post.sharpness,
      ship: state.ship && { ...state.ship },
      at: state.at,
      auto: state.auto?.id ?? null,
      aim: state.aim ?? null, // (the star the nose is on: aim.js)
      jump: state.jump && { id: state.jump.id, phase: state.jump.phase, age: state.jump.age },
      view: state.view,
      seat: state.seat,
      cab: cab ? cab.kind : cabWanted ? `loading ${cabWanted}` : null,
      crash: state.crash && { id: state.crash.id, age: state.crash.age },
      feel: feel.state(), // (the shake's trauma, the hitstop left, lib/three/feel.js)
      shield: +state.shield.toFixed(1),
      heat: +state.heat.toFixed(2),
      siege: { ...siegeSt },
      weapon: armory ? { id: armory.id, name: armory.name, ammo: armory.ammo } : null,
      hunters: hunters?.packs ?? [],
      wing: wingmen?.live ?? [],
      skirmish: skirmishes?.info ?? null,
      lock: state.lock?.id ?? null,
      near: near.resident(),
      manual: Boolean(state.lock?.manual),
      controls: controls(),
      loadout: { ...state.loadout },
      stats: { ...state.stats },
      modules: state.model?.modules ? { nozzles: state.model.modules.nozzles.length, muzzles: state.model.modules.muzzles.length, flame: state.model.modules.flame } : null,
      pilots: pilots.targets.filter((p) => p.peer).map((p) => ({ id: p.peer, name: p.name, kind: p.kind, loadout: p.loadout, at: p.at.toArray().map((v) => +v.toFixed(2)) })),
      online: net?.snapshot().status ?? null,
      lead: state.lead && { x: +state.lead.x.toFixed(2), y: +state.lead.y.toFixed(2), z: +state.lead.z.toFixed(2), t: +state.lead.t.toFixed(2), hot: state.hot },
      signs: signs.map(({ id, x0, y0, x1, y1, z }) => ({ id, x0, y0, x1, y1, z })),
      foot: foot.phase && { phase: foot.phase, id: foot.id, ...(({ health, who, mate, troops, first }) => ({ health, who, mate, troops: troops.length, first }))(foot.info() ?? { troops: [] }), guests: foot.guestInfo(), spot: foot.crew()?.ship.n ?? null, entry: foot.entry() },
      landable: state.landable,
      last,
      held: state.held?.name ?? null,
      pose: holdPose,
      soon: (id) => director.soon(id), // (the director's next, from the checks)
      frames, // (resolves after n more frames, each one drawn)
      // the ship's box on screen, in CSS px (the chase camera's framing,
      // measured: flight.js's CHASE); null with no ship or behind the camera
      shipPx: () => {
        const g = state.model?.group;
        if (!g) return null;
        camera.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(g);
        const p = new THREE.Vector3();
        let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
        for (let i = 0; i < 8; i++) {
          p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
          if (p.z > 1) return null;
          x0 = Math.min(x0, p.x);
          x1 = Math.max(x1, p.x);
          y0 = Math.min(y0, p.y);
          y1 = Math.max(y1, p.y);
        }
        return { w: Math.round(((x1 - x0) / 2) * size.w), h: Math.round(((y1 - y0) / 2) * size.h), box: [((x0 + 1) / 2) * size.w, ((1 - y1) / 2) * size.h, ((x1 + 1) / 2) * size.w, ((1 - y0) / 2) * size.h].map(Math.round) };
      },
      // a blast `ahead` units in front of your ship, `size` across (to see one at a pose)
      blast: (size = 0.6, ahead = 1.5) => {
        const sh = state.ship;
        if (sh) burn(new THREE.Vector3(sh.x - Math.sin(sh.heading) * ahead, sh.y + 0.3, sh.z - Math.cos(sh.heading) * ahead), size);
      },
    });
  }

  // Everything sent to the graphics chip before the map is first seen
  // (lib/useScene runs it, behind the intro or behind the map's loading
  // screen): the planets' models waited for, then every picture, every
  // shader (hidden things too) and one draw of it all, passes and all, a
  // slice at a time (lib/three/gpuWork). The draw is small: the passes'
  // buffers 64 across and one pixel of the canvas; it's what's sent that
  // counts, not the picture, and the first real frame sizes them back up.
  const prepare = async (onProgress, { alive = () => true, frame } = {}) => {
    onProgress?.(0, 'load');
    await settleWithin(Promise.all([ready, modelsIn]), 20000);
    if (!alive() || disposed) return;
    await prepareScene({
      renderer,
      roots: [scene],
      scene,
      camera,
      target: post.target,
      render: () => post.render(64, 64),
      onProgress,
      frame,
      alive: () => alive() && !disposed,
    });
    if (!alive() || disposed) return;
    // how sharp this machine can afford it, found now rather than see-sawed
    // into while flying (lib/three/calibrate): the pace's ceiling from here
    onProgress?.(0.97, 'tune');
    const key = calibrationKey(renderer, 'universe', size.w, size.h);
    const kept = recall(key);
    const setLevel = (l) => {
      pace.set(l);
      paceTo();
    };
    const level = await calibrate({ renderer, draw: () => post.render(size.w, size.h), setLevel, start: kept ?? 0, frames: kept != null ? 4 : 12, frame, alive: () => alive() && !disposed });
    if (!alive() || disposed) return;
    setLevel(level);
    remember(key, level);
  };

  return {
    // every shader made (the page waits for it before the first frame)
    ready,
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      gl.setSize(size.w, size.h);
      sky.setRatio(gl.ratio);
      measure();
      watchPanel();
    },
    render,
    // sent before it's seen (above); not on a low tier (software WebGL, a
    // budget phone), where the graphics chip's work is the processor's and
    // its memory is short: things go up as they're first seen there, as before
    prepare: tier === 'low' ? undefined : prepare,
    update(next) {
      const picked = props.selected ?? null; // (the page's pick, as it last said)
      props = next;
      if ((next.ship ?? null) !== state.kind) {
        state.loadout = readLoadout(next.loadout); // (a new ship comes fitted as it was left)
        state.build = sameBuild(next.build) ? state.build : readBuildWire(next.build ? writeBuild(next.build) : null); // (and on the hull it was left on)
      }
      setShip(next.ship ?? null);
      setBuild(next.build ?? null);
      setLoadout(next.loadout);
      setNet(next.net);
      // the page's pick, only when it changes. The router moves the address
      // in a transition, so a render that comes first (the HUD's, as the
      // ship leaves a planet and can no longer land) still carries the old
      // pick: taken as a new one, it sent the ship straight back to the
      // planet it was leaving, by hyperspeed after a jump there
      if ((next.selected ?? null) !== picked) select(next.selected ?? null);
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
    lowerQuality() {
      state.tLow = (performance.now() - t0) / 1000;
      state.low = true;
      post.off();
      blasts.setMode('pop');
      ctx.invalidate();
    },
    // a name under the pointer lights its planet too
    hover: setHover,
    // the phone's fire button: true pressed (it fires, and keeps firing
    // while held), false let go
    // the phone's weapon button: on to the next
    weapon() {
      heard();
      if (!onFoot()) pickWeapon('next');
    },
    fire(down = true) {
      heard();
      if (onFoot()) {
        const gun = down && foot.fire();
        if (gun) emit({ type: 'fire', gun });
        return;
      }
      state.fireBtn = down;
      if (down) fire();
      ctx.invalidate();
    },
    // the HUD's Portal button (P): Rick's portal gun, in any ship
    portalGun() {
      return portalGun();
    },
    // the phone's Ship button (G on foot): a door, or back in the ship
    out() {
      heard();
      // (a door you're at first: a big ship's reach can take in one near it)
      if (onFoot() && !intoDoor() && !foot.board()) emit({ type: 'foot', id: 'far' });
    },
    // the look prompt's click, on foot: lock the pointer (runtime/look.js)
    lookLock() {
      looker.request();
    },
    // the HUD's “Enter Albuquerque” button: into the world you're down on
    enter() {
      heard();
      intoWorld();
    },
    // the phone's Switch button, on foot: play the other one
    swap() {
      const who = foot.swap();
      if (who) emit({ type: 'foot', id: 'swap', who });
    },
    // the phone's boost button
    boost(on) {
      heard();
      state.boostBtn = on;
      if (on) takeover();
      ctx.invalidate();
    },
    // the phone's View button: the other seat (the cockpit, or behind the ship)
    seat() {
      heard();
      setSeat(state.seat === 'cockpit' ? 'chase' : 'cockpit');
    },
    // the phone's climb and dive buttons: 1 held to climb, −1 to dive, 0 let go
    climb(way) {
      heard();
      state.climbBtn = way;
      if (way) takeover();
      ctx.invalidate();
    },
    // Escape: back from the map view, or stop flying itself. False when
    // there was nothing to undo.
    escape() {
      if (state.view === 'map' && flying()) {
        state.view = state.seat;
        retarget(900);
        ctx.invalidate();
        return true;
      }
      if (state.auto) {
        dropAuto();
        return true;
      }
      return false;
    },
    // the nav map's: off to a place by a drive (travel above; false if it can't go)
    travel(id, drive) {
      return travel(id, drive);
    },
    // and what it shows: where the ship is and which way it points, where
    // it's going and how, whether the hyperdrive's charged, and the other
    // pilots online (null for the ship with none picked)
    where() {
      const s = state.ship;
      const leg = state.jump ? { id: state.jump.id, drive: 'hyper' } : state.auto ? { id: state.auto.id, drive: (state.auto.od ?? 1) > 1 ? 'super' : 'cruise' } : null;
      // (bound for the other sector: where it's going, and the portal it's going by)
      const going = leg && state.then ? { ...leg, id: state.then.id, via: leg.id } : leg;
      return {
        ship: s ? { x: s.x, y: s.y, z: s.z, heading: s.heading, speed: s.speed } : null,
        at: state.at,
        going,
        foot: onFoot(),
        crashed: Boolean(state.crash),
        interdicted: state.interdicted,
        hyper: hyperState({ last: state.hyperAt, now: wall(), interdicted: state.interdicted }),
        pilots: pilots.chart.map((p) => ({ id: p.id, name: p.name, x: p.x, z: p.z })),
        farFights: (state.fights ?? []).map((f) => ({ id: f.id, x: f.at[0], z: f.at[2], label: fightLabel(f.at) })), // (Fighting near …, for the nav map)
        front: front?.where() ?? null, // (the crew's war, for the nav map)
      };
    },
    // the whole map: the view pulls out while you keep the ship (false
    // without one; the page clears the selection instead)
    whole() {
      if (!flying()) return false;
      state.view = 'map';
      dropAuto();
      retarget(900);
      ctx.invalidate();
      return true;
    },
    // fly into a planet; the page fades to it and goes after `ms`
    dive(id) {
      if (reduced || !planetOf[id] || !state.pose) return 0;
      state.dive = { id, start: performance.now(), from: { ...state.pose, target: [...state.pose.target] } };
      state.flight = null;
      engine?.set({ speed: SHIP.boost, boost: true });
      ctx.invalidate();
      return DIVE_MS;
    },
    dispose() {
      disposed = true;
      stopVoiced(); // (anyone down on a planet, mid-line)
      window.removeEventListener('tp:looks', onLooks);
      engine?.stop();
      well?.stop();
      quietRoar();
      infall?.dispose();
      foot.dispose();
      panel?.dispose();
      near.dispose();
      dropCab();
      roomEnv?.dispose();
      state.model?.dispose();
      setBoosterPlumes();
      panelRO?.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('tp:arrive', takeArrive);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onHidden);
      canvas.removeEventListener('pointerdown', onDown);
      looker.detach();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      const st = props.stick?.current;
      if (st) st.removeAttribute('data-on');
      for (const el of props.hud?.current?.children ?? []) el.removeAttribute('data-on');
      if (import.meta.env.DEV) delete window.__universe, delete window.__universeDebug;
      disposeTree(spares);
      crashFx.dispose();
      pops.dispose();
      blasts.dispose();
      hunters?.dispose();
      wingmen?.dispose();
      skirmishes?.dispose();
      farFights.dispose();
      front?.dispose();
      battleModels?.dispose();
      npcs?.dispose();
      netOff?.();
      pilots.dispose();
      pieces.dispose();
      removerView.dispose();
      leviathans.dispose();
      meteors.dispose();
      mines.dispose();
      eclipseMoon?.geometry.dispose();
      eclipseMoon?.material.dispose();
      fleet.dispose();
      deep.dispose();
      farStars.dispose();
      landmarks.dispose();
      expanse.dispose();
      sectorPortals.dispose();
      gunPortal.dispose();
      curve.dispose();
      sectorFleet.dispose();
      for (const tr of trenches) tr.dispose();
      phone.dispose();
      novae.dispose();
      burst.clear();
      burst.dispose();
      traffic?.dispose();
      engines.dispose();
      for (const f of flares) f.dispose();
      disposeTree(scene);
      post.dispose();
      env.dispose();
      gl.dispose();
    },
  };
}
