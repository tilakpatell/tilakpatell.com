// A world in a galaxy far, far away, from the ground (pages/GalaxySurface.jsx,
// /galaxy/tatooine/surface): you come down out of the sky in your ship, it
// sets down, and you and your crewmate climb out onto the sand (or the
// snow, or the forest floor, or a platform over the clouds). Then it's
// yours to walk: the stick or WASD to go (from the camera), Shift to run,
// Space to jump, a drag (or the right of the screen, on a phone) to look
// round, E to do whatever's to hand: talk to whoever's there, climb onto
// a speeder or a tauntaun (and off again), or get back in the ship and
// take off, back up to the system. Each world has its places to find (the
// Lars homestead, Echo Base, the Ewok village…), each named on the compass
// till you've been; its people and creatures about their business; ships
// going over; the weather. Hold B for a wheel of emotes (wave, cheer,
// dance, taunt, sit: lib/emote.js), point at one and let go; tap it to do
// the last again.
//
// The two of you are bodies on the animation library (lib/three/animator.js,
// through footScene's figures): you flinch when you're hit and go down
// by the way the shot came, cheer a quest done or a post taken, tuck into a
// roll, sit what you ride; each short and cut by whatever you do next, so
// control never waits on a clip. Your mate looks where you look, fires at
// what you're fighting (gunplay.js's arms, from the muzzle), takes the
// bolts that come its way, and goes down and gets up again.
//
// What's built, from the site (sites/*.js): the land (terrain.js, ground.js)
// under its sky (sky.js) with its water (water.js) and its weather
// (weather.js); its things (placer.js: models where there are models,
// props built in code where there aren't); its life (actors.js); what you
// can ride (rides.js). Moving about is walker.js's.
//
// A scene module, a world on the world runtime through ./module.js
// (src/runtime's fromScene): create(canvas, ctx) draws with the runtime's
// renderer (ctx.rt.gfx: the runtime sizes it and sets its sharpness) and
// returns { ready, resize, render, update, setVisible, input, dispose }.
// Props: system (the world's id), or site (one already made whole:
// sites/index.js's siteFrom) and missionSpec (a mission object) in place of
// looking them up by system and `mission`; models, rides, props, scatter (a
// page's own books, catalog's and props' and rides' shapes) and figures
// (cast → (kind, spec, i) → figure | null, asked before the galaxy's
// figures) for a world outside the galaxy; ship (the crew's ship: xwing, falcon…),
// loadout (its paint), onEvent(e), compass (a ref: the compass bar, its
// marks by data-id), found (the places already found, by id), net (the
// online client, universe/online/client.js: your crew goes out to the
// others, and theirs, down on the same world, are drawn here: peers.js).
// Events: { type: 'phase', phase } (landing, walk, ride, leaving),
// { type: 'prompt', text } (what E does, or null), { type: 'found', id },
// { type: 'here', id } (the place you're in, or null), { type: 'talk',
// who, text }, { type: 'edge' }, { type: 'fell' }, { type: 'leave' } (the
// ship's away: back to space), { type: 'emote', open, hover, last, on }
// (the wheel: whether it's open, the one pointed at, the one a tap does,
// and the emote you're doing, for a page that draws it).

import { PLACES } from '../battleLines';
import { systemById } from '../systems';
import { readBuildWire, writeBuild } from '../../universe/shipyard/build';
import * as THREE from 'three';
import { disposeTree, precompile, precompilePasses, singlePass } from '../../../lib/three/renderer';
import { nextFrame as breathe, prepareScene } from '../../../lib/three/gpuWork';
import { STEPS } from '../../../lib/three/pace';
import { settle as settleWithin } from '../../../lib/settle';
import { dropTransmission } from '../../../lib/three/glass';
import { device } from '../../../lib/device';
import { detailLevel } from '../../../lib/detail';
import { createPost } from '../../universe/post';
import { SHIP_MODELS, buildShip, LENGTH } from '../../universe/shipModels';
import { loadModel } from '../../universe/planets';
import { paintById } from '../../universe/paint';
import { readLoadout, STOCK_LOADOUT } from '../../universe/outfit';
import { flybySound, gadgetSound, gunSound, impactSound, popSound, portalSound, shipEngine } from '../../universe/sounds';
import { PARTY, loadPartyFigure } from '../../universe/footScene';
import { GUNS, createGunplay } from '../../universe/gunplay';
import { createGameFx } from '../../../lib/three/fx/gameFx';
import { createGunFx } from '../../universe/gunfx';
import { spring } from '../../../lib/three/ik';
import { METRE } from '../../universe/foot';
import { createMeshyCast } from '../../rickmorty/portal/meshyCast';
import { withWardrobe } from '../../rickmorty/wardrobe/wear';
import { buildGalaxyShip } from '../fleet';
import { audioContext } from '../../../lib/audio';
import { SURFACE_MODELS } from './catalog';
import { heightGrid, makeHeight } from './terrain';
import { createMarks, groundMaterial, groundMesh } from './ground';
import { createSky } from './sky';
import { wearScanSet } from '../../../lib/three/scans';
import { createSkyFog } from './skyfog';
import { createWater } from './water';
import { floatPose } from './floats';
import { createWeather } from './weather';
import { createKit } from './kit';
import { createHouse } from '../../../lib/three/house';
import { adoptLater, exposureOf, groundPieces, lookOf } from './look';
import { surfaceTuning, siteCode } from './tune';
import { debugOn, debugPanel } from '../../../lib/debugPanel';
import { createFeel, feelGroups } from '../../../lib/three/feel';
import { createPress, pressGroups } from '../../../lib/press';
import { rideFov } from './rides';
import { downAt } from './respawn';
import { createSquash } from './squash';
import { createKnocks, loosePlaces } from './knocks';
import { wireImpacts } from '../../../lib/three/impacts';
import { createDust } from '../../../lib/three/dust';
import { createGrass } from '../../../lib/three/grass';
import { amountsFor } from './amounts';
import { createWind } from '../../../lib/three/wind';
import { createGroundMap } from '../../../lib/three/groundmap';
import { groundPainter, mapAreaOf } from './groundPaint';
import { floorShadow } from '../../../lib/three/grounding';
import { PROPS as GALAXY_PROPS, SCATTER as GALAXY_SCATTER } from './props';
import { createPlacer } from './placer';
import { createLevel, levelGround } from './level';
import { anyFigure, createActors, modelFigure } from './actors';
import { RIDES as GALAXY_RIDES } from './rides';
import { SEATS, poseRider } from './riders';
import { createPeers } from './peers';
import { createSounds } from './sounds';
import { createActivity } from './activity';
import { snapToTexel } from './shadow';
import { createShadowPhase } from './near';
import { createBlaster } from './blaster';
import { createBoltPlay } from './boltPlay';
import { applyEmote, createEmoteWheel, emoteFor, emotePacket, keepEmote, readEmote } from '../../../lib/emote';
import { preload } from '../../../lib/three/clipLibrary';
import { fallTurn } from '../../../lib/three/locomotion';
import { createSaber } from './saber';
import { DODGE, FORCE, GUARD, HEAVY, PARRY, dodgeStep, forceAt, guardHit, guardStep, hitStop, pushVelocity } from './combatRules';
import { DUEL } from '../../../lib/combat/duel';
import { incomingAt, met, swingingOf } from './duellists';
import { heatShot, heatStep, spreadAt, vent, ventSpot, withMods } from './weaponRules';
import { heroById, heroSpec, partyFor, refitOf, writeHero } from '../heroes';
import { perkEffects } from '../perks';
import { ABILITIES, JET, SABER_THROWS, abilitiesOf, forceOf, hitOf, holdOf, jetStep, kindOf, newJet, takenOf, throwOf } from './abilityRules';
import { createPowers } from './powers';
import { SABER } from './saberRules';
import { feed, isOffered, nextQuest, questsOf, start as startQuest, stepTarget, stepText } from './quests';
import { buildFigure } from './figures';
import { WALK, createSolids, groundAt, lineClear, pushOut, ride, rider, turnToward, walk, walker } from './walker';
import { aimDir, lookFriction } from './aimShot';
import { createSurfaceLockOn } from './surfaceLockOn';
import { surfaceLook } from './surfaceLook';
import { coneFor } from '../../../lib/combat/aim';
import { rng } from './noise';
import { endRun, newRun, tickRun, worldOf } from './missions';
import { createChaseMission } from './missions/chaseScene';
import { createAssaultMission } from './missions/assaultScene';
import { RULES as ASSAULT } from './missions/assault';
import { groundWorld } from '../../../lib/three/groundwork';
import { garrisonLife, garrisonProbe } from './garrison';
import { createGround, landingFor } from './ground/index';
import { standable } from './sites/validity';
import { floraTint } from './flora';
import { footprintOf, impactOf, loadMaterials, tagOf } from '../../../lib/physics/materials';
import { landingLook, printOf } from './impactLook';
import { gameSite } from '../../../lib/three/gameLight';
import { gameLightOf } from '../../../data/bf2017/light/index';
import { createGameLit } from './gameLit';
import { createPlayerBody } from './playerBody';
import { assetPool, worldScope } from '../../../lib/assetLoad';
import { victoryFor } from '../../../lib/three/walrusSets/emotes';
import { createFirstView } from './firstView';
import { rideClip } from '../../../lib/three/walrusSets/vehicles';
import { richClips } from '../../../lib/three/walrus';

const V = THREE.Vector3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the ships you land in: how long they are (m), how high their belly sits
const SHIPS = { xwing: { metres: 12.5, lift: 0.4 }, falcon: { metres: 34.7, lift: 1.2 }, cruiser: { metres: 6.5, lift: 0.3 }, rv: { metres: 11, lift: 0.3 } };
const LAND = { descend: 7.5, settle: 1.2, out: 1.6 }; // seconds
// the crew who have models of their own on the worlds (catalog/people.js), by
// who they are in the universe's crews (footScene.js's PARTY)
export const CREW_MODELS = { artoo: 'r2d2' };
const LEAVE = { lift: 3.2, away: 3.4 };
const CAM = { dist: 4.8, up: 1.55, pitch: [-0.45, 1.15], far: 14, near: 2.2 };
const REACH = 3.2; // metres: close enough to use something
const ROLL_PIVOT = 0.55; // metres up from the feet: where a dodge's roll turns about (a tucked body's middle)
const KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'run', z: 'crouch', ' ': 'jump', e: 'act', enter: 'act', f: 'fire', r: 'throw', c: 'block', x: 'dodge', g: 'power', v: 'second', b: 'emote', p: 'view' };
const FIRE_EVERY = 0.24; // seconds between shots
const SABER_IDLE = 8; // seconds without a stroke before the blade goes out
const LOCK = { range: 14, cone: 0.9 }; // metres and radians: what a stroke homes on
const HUD_EVERY = 0.1; // seconds between the combat HUD's updates
const HOLD_FULL = 1; // (a held ability's tank, on the HUD, as a cooldown of one second)
const BIKE_FIRE_EVERY = 0.3; // (a bike's cannon: a touch slower)
// your mate in a fight: how far it'll shoot (m), the seconds between its
// shots, the share that land (a hit is one), how long after your last shot
// it keeps on at what you were shooting, its health, how long it lies when
// it's down (s), and how close a bolt of theirs has to pass to hit it (m)
const MATE = { range: 26, every: [0.8, 1.6], land: 0.35, keen: 6, hp: 100, down: 6, girth: 0.45, lookEvery: 0.2 };
const AWAY = 1.2; // radians (about 70°): what the mate's looking at, this far off its facing, turns its body too
// your roll's clip (the library's `roll`, 1.47 s), started this far in and
// paced to the dodge, and a little over, for it to stand back up
const ROLL = { at: 0.12, length: 1.467, over: 0.08 };
// you, sat on what you ride: your hips this far over its seat (m), and
// what you sit in on it (a vehicle's controls, a creature's back)
const SEAT = { pad: 0.08, low: 0.55 };
const STILL = Object.freeze({ speed: 0, side: 0, turn: 0, air: 0 });
const BACK = new THREE.Vector3(0, 0, -1); // (a figure's own back, falling over it)
const AHEAD = new THREE.Vector3(0, 0, 1);
const WHEEL_PX = 90; // the pointer this far from where it was when the wheel opened is all the way out

export async function create(canvas, ctx) {
  const { reduced, rt } = ctx;
  let props = ctx;
  let disposed = false;
  // every file this world asks for belongs to it (lib/assetLoad): leaving
  // stops whatever is still queued or downloading, and a late answer reaches
  // nothing
  const net = worldScope('surface');
  const tier = device().tier;
  const small = tier !== 'high' || Math.min(window.innerWidth, window.innerHeight) < 600;
  // how much it draws: the level's row of the budget table (amounts.js)
  const level = detailLevel();
  const amounts = amountsFor({ level, small });
  // the site: one handed in already made whole (a page's own book: the Rick
  // and Morty planets), or the galaxy's for the system; and a mission played
  // down here (missions/: handed in, or the system's by id), you starting in
  // it, not landing, its own sky laid over the site's while it runs
  const { site: own, mission } = worldOf(ctx);
  if (!own) throw new Error(`no surface for ${ctx.system}`);
  // under the game's light where the world has a record (gameLit.js): its
  // sky, sun, bounce and fog derived from the level's, the rest the site's;
  // a mission's own sky wins; (dev: ?gamelight=off, the site's own light, for
  // the before shots)
  const gameOff = import.meta.env.DEV && /[?&]gamelight=off\b/.test(window.location.search);
  const gameLight = gameOff || mission?.site?.sky || mission?.site?.light ? null : gameLightOf(own);
  const site = gameSite(own, gameLight, 'clear');
  // the models kinds are looked up in: the galaxy's, with a page's own book
  // laid over it (the Rick and Morty planets'), never written into it
  const models = ctx.models ? { ...SURFACE_MODELS, ...ctx.models } : SURFACE_MODELS;
  // (and its rides and its built things: the galaxy's, or a page's own whole
  // book of them, the galaxy's merged in by the page)
  const RIDES = ctx.rides ?? GALAXY_RIDES;
  const PROPS = ctx.props ?? GALAXY_PROPS;
  const SCATTER = ctx.scatter ?? GALAXY_SCATTER;
  const emit = (e) => props.onEvent?.(e);

  // ── The renderer, the camera, the light ──
  // (the runtime's: shared with whatever world comes next, so its shadows go back as they were at dispose)
  const { renderer } = rt.gfx;
  const shadowMapWas = { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type };
  const clipWas = renderer.localClippingEnabled;
  renderer.localClippingEnabled = true; // (a portal kill clips the figure at the portal's plane: lib/three/portalFx.js)
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.12, 16000);
  scene.add(camera);
  canvas.setAttribute('aria-hidden', 'true');
  const post = createPost(renderer, scene, camera, { small });
  // the house look (lib/three/house: shade is a colour, never grey) over
  // everything lit, from the site's look (look.js); the fog stays the
  // surface's own (skyfog.js: the dome's very colour), so the house leaves
  // three's fog line be. The post tone-maps with its own shoulder, so the
  // exposure is the site's, through it.
  const siteLook = lookOf(site);
  // (a Star Wars world on the game's own maps wears them, the props' trims
  // and the ground's grain alike: lib/three/scans.js; set before the kit is
  // made, which loads them)
  wearScanSet(site.look?.scanned ?? 'cc0');
  const house = createHouse({ ...siteLook, fog: false });
  post.exposure(exposureOf(site));
  // (fogged in the sky's colour and in the look before its shaders are
  // made, so they're made once)
  const warm = (root) => {
    skyFog.scene(root);
    adoptLater(house, root);
    return precompile(renderer, singlePass(root), camera, scene, post.on ? post.composer.readBuffer : undefined);
  };

  const sky = createSky(site, { clouds: amounts.clouds });
  // (the fog the sky's colour that way: everything fogged with it, as it's put in the world)
  const skyFog = createSkyFog(sky, THREE.ShaderChunk);
  // (the look's halo round the sun, and its haze below the horizon where the
  // site says: the fog is the surface's, so they go on it)
  skyFog.look({ halo: siteLook.halo, below: typeof site.look?.fogBelow === 'number' ? siteLook.fogBelow : null });
  scene.add(sky.mesh);
  const sunDir = sky.sunDirs[0] ?? new V(0.3, 0.8, 0.4).normalize();
  const sun = new THREE.DirectionalLight(site.sky.suns?.[0]?.color ?? '#ffffff', site.light.sun ?? 3);
  sun.castShadow = !small;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -42;
    sc.right = sc.top = 42;
    // (SHADOW below says the same, for the snapping)
    sc.near = 1;
    sc.far = 600;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
  }
  scene.add(sun, sun.target);
  // the shadow camera's right and up (it looks down the sun's way, up as three
  // turns it), for its focus to be snapped to whole texels along them (shadow.js)
  const SHADOW = { extent: 42, map: 2048 };
  const shadowFrame = new THREE.Matrix4().lookAt(sunDir, new V(), new V(0, 1, 0));
  const shadowRight = new V().setFromMatrixColumn(shadowFrame, 0);
  const shadowUp = new V().setFromMatrixColumn(shadowFrame, 1);
  // (the sun moved, by a weather's fade: the shadow camera's frame after it)
  const reframe = () => {
    shadowFrame.lookAt(sunDir, new V(), new V(0, 1, 0));
    shadowRight.setFromMatrixColumn(shadowFrame, 0);
    shadowUp.setFromMatrixColumn(shadowFrame, 1);
    house.sky({ sunDir });
  };
  const second = sky.sunDirs[1] ? new THREE.DirectionalLight(site.sky.suns[1].color, site.light.second ?? 1) : null;
  if (second) {
    second.position.copy(sky.sunDirs[1]).multiplyScalar(300);
    scene.add(second);
  }
  const hemi = new THREE.HemisphereLight(site.light.sky ?? '#bcd0ee', site.light.ground ?? '#8a7a66', site.light.ambient ?? 0.9);
  scene.add(hemi);
  scene.fog = new THREE.FogExp2(site.fog.color, site.fog.density);
  // (the look's sky is the dome's: its horizon and zenith, the sun's way)
  house.sky({ low: sky.uniforms.uHorizon.value, high: sky.uniforms.uZenith.value, sunDir });
  house.light({ sun, hemi });
  // what shiny things reflect: the sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSky = sky.envScene();
  const env = pmrem.fromScene(envSky.scene, 0, 1, 2000);
  envSky.dispose();
  pmrem.dispose();
  scene.environment = env.texture;
  scene.environmentIntensity = 0.4;
  // the level's probe for it once it lands, its grade (high and ultra) and
  // its weathers, where the game lights this world
  const gameLit = createGameLit({ light: gameLight, scene, sun, hemi, sky, house, post: post.on ? post : null, renderer, grade: !small && (level === 'high' || level === 'ultra'), fogFloor: own.fog?.density ?? 0, reframe });

  // (a frame's breath between the build's big steps: it's made behind the
  // dive, which goes on drawing meanwhile, and one long task stopped it)
  await breathe();
  // ── The land ──
  // (a world on the game's level: its heightmaps decoded first, so the grid
  // is the game's ground; any other world's ground is as it was)
  const height = makeHeight(await levelGround(site.ground), { relief: amounts.relief });
  const grid = heightGrid(height, amounts.grid);
  // (water you wade in: not lava, not cloud, and not a sea far under a
  // platform with nothing else under it, which you'd fall into)
  const wade = site.water && !site.noGround && site.water.kind !== 'clouds' && site.water.kind !== 'lava' ? site.water.level : null;
  // where the scattered things go (worked out before anything's placed: the
  // ground map is painted with the trees' crowns over it)
  const r = rng(site.ground.seed ?? 1);
  const avoid = [...site.places.map((p) => ({ at: p.at, r: p.flat?.r ?? p.r * 0.6 })), { at: site.land.at, r: 30 }];
  // (on a world drawn from the game's level, what the game places itself is left to it)
  const scattered = site.scatter.filter((s) => !(site.level && s.game)).map((s) => {
    const items = [];
    const [r0, r1] = s.within ?? [20, site.reach];
    let tries = 0;
    while (items.length < Math.round(s.n * amounts.scatter) && tries++ < s.n * 20 * Math.max(1, amounts.scatter)) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r0 * r0 + r() * (r1 * r1 - r0 * r0));
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (avoid.some((v) => Math.hypot(x - v.at[0], z - v.at[1]) < v.r + (s.clear ?? 4))) continue;
      if (s.flat && grid.normalAt(x, z)[1] < s.flat) continue;
      if (wade != null && s.dry !== false && grid.heightAt(x, z) < wade + (s.above ?? 0.2)) continue;
      const [lo, hi] = s.scale ?? [1, 1];
      items.push({ at: [x, z], yaw: r() * Math.PI * 2, scale: lo + (hi - lo) * r() ** 1.6, sink: s.sink ?? 0.1, stretch: s.stretch ? s.stretch[0] + r() * (s.stretch[1] - s.stretch[0]) : 1 });
    }
    return { s, items };
  });
  // the ground as data (lib/three/groundmap): its colour and its grass
  // painted once over the walkable square (groundPaint.js), darker and
  // thinner under the trees' crowns; the floor and the grass read it, and
  // the house bounces it up onto everything low. None where there's no
  // ground (look.js's groundPieces).
  const pieces = groundPieces(site);
  let groundMap = null;
  if (pieces.map) {
    const shade = scattered.flatMap(({ s, items }) => {
      const canopy = s.canopy ?? SCATTER[s.kind]?.canopy; // (a kit tree's row says its own: flora.js)
      return canopy ? items.map((it) => ({ at: it.at, r: canopy * it.scale })) : [];
    });
    const painter = groundPainter(site, grid, { shade });
    const mapSize = amounts.map;
    groundMap = createGroundMap({ area: mapAreaOf(), size: mapSize, heightSize: mapSize / 2, paint: painter.paint, height: painter.height });
    if (pieces.bounce) house.ground(groundMap);
  }
  const gmat = groundMaterial(site, { small, map: groundMap, splat: amounts.splat });
  const marks = createMarks(amounts.marks);
  gmat.uniforms.uMarks.value = marks.texture;
  // what its surfaces are made of, where the 2017 game's material grid has
  // the world (lib/physics/materials.js): a bolt's landing and the prints you
  // leave pick by it (impactLook.js); `picks` the last few, for the checks
  let surfaces = null;
  let groundPrint = null;
  const DAB = { r: 0.7, k: 0.18 }; // (a step's mark where the material isn't known)
  const picks = [];
  loadMaterials(site.materials?.level)
    .then((book) => {
      surfaces = book;
      groundPrint = book && printOf(footprintOf(book, tagOf(site.materials, { ground: true }))?.family);
    })
    .catch(() => {});
  const ground = groundMesh(grid, gmat.material);
  if (!site.noGround) scene.add(ground);
  const water = site.water ? createWater(site, sunDir, site.sky.suns?.[0]?.color ?? '#ffffff', { heightAt: site.noGround ? null : grid.heightAt, small, id: site.id, rings: amounts.rings, depthN: amounts.depthN, foam: amounts.splat }) : null;
  if (water) {
    scene.add(water.mesh);
    if (water.glow) scene.add(water.glow);
    if (water.spray) scene.add(water.spray);
  }
  const world = {
    heightAt: site.noGround ? () => site.fall ?? -1000 : grid.heightAt,
    normalAt: site.noGround ? () => [0, 1, 0] : (x, z) => grid.normalAt(x, z),
    solids: createSolids(),
    floors: [...(site.floors ?? [])],
    reach: site.reach,
    water: wade,
    // (how deep the water can be before you're turned back: the lagoon on Kashyyyk)
    wadeMax: wade != null ? site.water.wadeMax : undefined,
  };
  const weather = reduced ? null : createWeather(site, { small });
  if (weather) scene.add(weather.group);

  await breathe();
  // ── What's on it ──
  // one wind for the world (lib/three/wind): the grass's, and the way the
  // kit's plants and cloth lean
  const windAngle = site.ground.wind ?? 0;
  const wind = createWind({ strength: site.grass?.wind ?? 0.4, angle: windAngle });
  const kit = createKit({ seed: 31, wind: { angle: windAngle } });
  // (the scatter casts its shadow only near you: near.js; a kit model it's
  // given is in the house's look from the start)
  const shadowPhase = sun.castShadow ? createShadowPhase(scene, sun) : null;
  const placer = createPlacer({ parent: scene, kit, world, warm, shadowOnly: shadowPhase?.only ?? null, seated: amounts.seat, house, kitTint: floraTint(site), models, props: PROPS, scatter: SCATTER });
  // the game's own level, cell by cell round you (lane L; null for a world without one)
  const gameLevel = createLevel({ scene, site, tier: level, renderer, walk: world });
  // (things that float, a bongo on Lake Paonga, ride the waves: floats.js)
  const floaters = [];
  for (const t of site.things_all) {
    if (site.level && t.game) continue;
    const put = placer.put(t);
    if (t.float && water?.height) put.then((o) => o && floaters.push({ o, x: o.position.x, z: o.position.z, yaw: t.yaw ?? 0, float: t.float }));
  }
  for (const { s, items } of scattered) placer.scatter(s.kind, items, { opts: s.opts, solid: s.solid ?? true, model: s.model ?? true, shadow: s.shadow !== false });
  // the grass round you (lib/three/grass, Bruno's: a triangle a blade, one
  // draw, the patch going with you), standing on the ground map and its
  // colour, where the site grows it
  const grass = pieces.grass
    ? createGrass({ ground: groundMap, wind, side: amounts.grass.side, size: amounts.grass.size, height: site.grass.h?.[1] ?? 0.5, width: site.grass.w ?? 0.05, root: 0.35 })
    : null;
  if (grass) scene.add(grass.mesh);
  // ?debug: the look, the grass and the wind on sliders, copied out as the
  // site's own blocks (lib/debugPanel, tune.js)
  // the feel: every knock's shake (state.shake, drained into it each frame:
  // trauma², held still under reduced motion), and the jump's press
  const feel = createFeel({ calm: reduced, offset: 0.3 });
  const jumpPress = createPress();
  // your landing's squat, on a spring (squash.js)
  const squash = createSquash({ calm: reduced });
  const panel = debugOn() ? debugPanel({ title: site.id, groups: [...surfaceTuning({ house, skyFog, post, exposure: exposureOf(site), grass, wind }), ...feelGroups(feel), ...pressGroups(jumpPress)], code: siteCode }) : null;
  // the Meshy cast (the cruiser's two, the peers'): made here, before the
  // people, where a page's figure maker draws on it too (ctx.figures(cast)
  // → (kind, spec, i) → figure | null: the Rick and Morty planets' people);
  // otherwise made when it's first wanted, as it always was
  let cast = ctx.figures ? createMeshyCast(withWardrobe()) : null;
  const life = createActors({ parent: scene, world, life: [...garrisonLife(site.life, ctx.effects?.troops, site.uniforms ?? null), ...garrisonProbe(site, ctx.effects, systemById(site.id)?.faction ?? null)], wants: site.wants, talk: () => ({ era: PLACES[site.id] ?? null, owner: ctx.effects?.owner ?? null, side: ctx.effects?.side ?? null, hero: ctx.hero?.id ?? ctx.hero ?? null, done: state.done, rank: ctx.effects?.rank ?? 0 }), seed: (site.ground.seed ?? 1) + 7, warm, small, kit, fog: () => scene.fog.density, water, models, figure: ctx.figures?.(cast) ?? null, only: site.cast === 'models', place: site.id });

  await breathe();
  // ── The places you go into (zones): built high over the world, out of
  // sight, each with its own lamps ──
  for (const z of site.zones) {
    placer.put({ kind: z.inside.build, at: [z.origin[0], z.origin[2]], y: z.origin[1], abs: true, model: false, opts: z.inside.opts, zone: true });
    for (const t of z.things) placer.put(t);
  }
  // (hidden outdoors: a light with nothing to light still costs every pixel of
  // every lit thing, and four of them a good deal; the warm-up compiles both ways)
  const lamps = Array.from({ length: 4 }, () => {
    const l = new THREE.PointLight('#ffffff', 0, 30, 1.6);
    l.visible = false;
    scene.add(l);
    return l;
  });

  await breathe();
  // ── Things to do: the quest you're on, out in the world, and the blaster ──
  // (Rick's guns' kills, heard: the portal's swirl and snap, the shatter, the squeak and the pop)
  const showSound = (how, ev) => {
    if (how === 'portal') {
      if (ev === 'open') portalSound();
      else if (ev === 'cut') popSound();
    } else gadgetSound(how, ev);
  };
  // (a walker or droideka falling goes up in lane F's blast: gameFx, made just below, by then)
  const activity = createActivity({ parent: scene, world, warm, kit, color: site.accent, onShow: showSound, blast: (at, cls) => gameFx.explode(at, cls) });
  // (a battle fills the air with bolts: room for them)
  const blaster = createBlaster({ parent: scene, world, pool: mission?.kind === 'assault' ? 72 : undefined });
  // the ground war: who holds which turf, and its soldiers, made round you as you go (ground/)
  const groundWar = createGround({ parent: scene, world, site, effects: mission ? null : ctx.effects, tier, kit, warm, blaster, sparks: (at, c) => fx.sparks(new V(...at), UP, c, 8), standable: (p) => standable(site, p), seesThrough: (a, b) => lineClear(world.solids, a, b) });
  const boltPlay = createBoltPlay({ blaster, ground: groundWar });
  // what a shot does round the gun and where it lands (universe/gunfx.js),
  // and a light that flares with each muzzle flash: in the scene from the
  // start and dark between shots, so the count of lights never changes and
  // nothing recompiles when you fire (not on a small screen or a low tier)
  const UP = new V(0, 1, 0);
  const flare = small || reduced ? null : new THREE.PointLight('#ffd36b', 0, 7, 2);
  if (flare) {
    flare.userData.peak = 2.5;
    scene.add(flare);
  }
  const fx = createGunFx({
    parent: scene,
    unit: 1,
    ground: (p) => ({ h: p.y - groundAt(world, p.x, p.z, p.y + 0.3), n: UP }),
    light: flare && { obj: flare, place: (p) => flare.position.copy(p) },
  });
  // and the same in the 2017 game's look where the bucket had it (lib/three/
  // fx/gameFx.js: its scorch and metal marks, burst, ring, chunks and Force
  // push); each part says whether it drew, and gunfx's own stands in where not
  const gameFx = createGameFx(scene, { level, groundAt: (x, z) => groundAt(world, x, z), site });
  const fwdV = new V();
  const rightV = new V();
  // (a world that takes models only: its quests' spawns too, cast.js)
  if (site.cast === 'models') activity.modelsOnly();
  // (scratch for the bodies: a fall's turn, the mate's aim, a sitter's hips)
  const _fall = new THREE.Quaternion();
  const _mateDir = new V();
  const _mateFrom = new V();
  const _hips = new V();
  // (a quest mission's quest is the mission's own, not one of the world's)
  // (a quest keeps the enemies it was written with: the garrison dresses the world's people, not its fights)
  const questOf = (id) => site.quests.find((q) => q.id === id) ?? (mission?.quest?.id === id ? mission.quest : null);
  // who gives each quest, with a mark over them till it's done
  const givers = [];
  const markMat = new THREE.SpriteMaterial({ map: (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffd36a';
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1206';
    g.font = 'bold 40px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })(), depthWrite: false, transparent: true });

  // what you can ride, where it's parked
  const rides = [...site.rides, ...(mission?.ride ? [{ kind: mission.ride, at: mission.start, yaw: mission.yaw }] : [])]
    .filter((x) => RIDES[x.kind])
    .map((x) => {
      const spec = RIDES[x.kind];
      const y0 = groundAt(world, x.at[0], x.at[1]);
      const state = rider(x.at[0], x.at[1], y0 + (spec.hover ?? 0), x.yaw ?? 0);
      const holder = new THREE.Group();
      scene.add(holder);
      const ridee = { spec, kind: x.kind, state, holder, fig: null, body: null, solid: null };
      if (spec.figure) {
        // (a world that takes models only waits for the model: surface/cast.js)
        const fig = site.cast === 'models' ? null : buildFigure(spec.figure);
        if (fig) {
          holder.add(fig.model);
          ridee.fig = fig;
        }
        // its catalogue model in place of the build once it's here (the
        // herd grazing round it is that model: the ridden one should match)
        (site.cast === 'models' ? anyFigure(spec.figure, {}, kit, 0, models, { only: true }) : modelFigure(spec.figure, models))
          .then((model) => {
            if (!model || !holder.parent) return;
            if (ridee.fig) holder.remove(ridee.fig.model);
            ridee.fig?.dispose?.();
            holder.add(model.model);
            ridee.fig = model;
          })
          .catch(() => {});
      } else {
        // its model (or its build), held in the holder so it can bank
        const tmp = new THREE.Group();
        placer
          .put({ kind: x.kind, at: [0, 0], abs: true, solid: false })
          .then((o) => {
            if (!o || disposed) return;
            // (it moves: a built one's scans go with it, kit.js's twins)
            kit.moving(o);
            tmp.add(o);
            o.position.set(0, 0, 0);
            o.rotation.set(0, 0, 0);
          });
        holder.add(tmp);
        ridee.body = tmp;
      }
      return ridee;
    });

  await breathe();
  // ── Ships going over, and hanging in the sky ──
  const flights = [];
  let nextFlight = 12 + r() * 10;
  const flyover = (spec) => {
    const n = spec.n ?? 1;
    const a = r() * Math.PI * 2;
    const dir = new V(Math.sin(a), 0, Math.cos(a));
    const side = new V(dir.z, 0, -dir.x);
    const centre = new V(you.x, 0, you.z).addScaledVector(side, (r() - 0.5) * 200);
    for (let i = 0; i < n; i++) {
      const m = buildGalaxyShip(spec.kind);
      m.group.scale.setScalar(spec.metres ?? 10);
      m.group.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
      });
      const offset = side.clone().multiplyScalar((i - (n - 1) / 2) * (spec.metres ?? 10) * 3).addScaledVector(dir, -i * (spec.metres ?? 10) * 2);
      const from = centre.clone().addScaledVector(dir, -1600).add(offset);
      from.y = (spec.alt ?? 100) + groundAt(world, centre.x, centre.z) + i * 6;
      m.group.position.copy(from);
      m.group.lookAt(from.clone().add(dir));
      scene.add(m.group);
      flights.push({ m, dir, speed: spec.speed ?? 100, age: 0, life: 3200 / (spec.speed ?? 100), kind: spec.kind, heard: false });
    }
  };
  const skyships = site.skyships.map((s) => {
    const m = buildGalaxyShip(s.kind);
    m.group.scale.setScalar(s.metres);
    m.group.position.set(...s.at);
    m.group.rotation.y = s.yaw ?? 0;
    m.group.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) mat.fog = false;
    });
    scene.add(m.group);
    return m;
  });

  await breathe();
  // ── Your ship ──
  const shipKind = SHIPS[ctx.ship] ? ctx.ship : 'xwing';
  const S = SHIPS[shipKind];
  // (on the other side's world, out of sight of the garrison's posts: ground/landing.js)
  const landing = landingFor(site, mission ? null : ctx.effects, { standable: (p) => standable(site, p) && !world.solids.near(p[0], p[1], 9).some((o) => pushOut(o, p[0], p[1], 9)), seesThrough: (a, b) => lineClear(world.solids, a, b), posts: groundWar.posts, height: world.heightAt });
  groundWar.landed(landing.covert ? landing.at : null);
  const landAt = landing.at;
  const landY = groundAt(world, landAt[0], landAt[1]);
  const shipHolder = new THREE.Group(); // where it is
  const shipTilt = new THREE.Group(); // how it's tilted, coming down
  shipHolder.add(shipTilt);
  scene.add(shipHolder);
  const shipBuild = ctx.build ? readBuildWire(writeBuild(ctx.build)) : null; // (a garage build from the hangar's shipyard)
  const ship = buildShip(shipKind, {}, { build: shipBuild });
  ship.group.rotation.y = Math.PI; // (built nose to −z: the world's things face +z)
  ship.group.scale.setScalar(S.metres / LENGTH);
  shipTilt.add(ship.group);
  const loadout = readLoadout(ctx.loadout ?? STOCK_LOADOUT);
  ship.paint?.(paintById(loadout.paint));
  const shipBox = { w: S.metres * 0.5, l: S.metres * 0.5 };
  const seat = () => {
    // sat on its belly: its lowest point on the ground (measured in its own
    // frame: where it is and how it's tilted put by while it's measured)
    const at = shipHolder.position.clone();
    const yaw = shipHolder.rotation.y;
    const tilt = shipTilt.rotation.clone();
    shipHolder.position.set(0, 0, 0);
    shipHolder.rotation.y = 0;
    shipTilt.rotation.set(0, 0, 0);
    ship.group.position.y = 0;
    shipHolder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ship.group);
    ship.group.position.y = -box.min.y;
    const size = box.getSize(new V());
    shipBox.w = size.x / 2;
    shipBox.l = size.z / 2;
    shipHolder.position.copy(at);
    shipHolder.rotation.y = yaw;
    shipTilt.rotation.copy(tilt);
  };
  seat();
  if (shipBuild) {
    // a garage build is whole as it is
  } else if (SHIP_MODELS[shipKind]) {
    loadModel(SHIP_MODELS[shipKind])
      .then((m) => m && (dropTransmission(m), warm(ship.dress ? ship.dress(m) : m).then(() => m))) // (the Falcon's glass, without its extra pass)
      .then((m) => {
        if (!m) return;
        if (disposed || !ship.mount(m)) disposeTree(m);
        else seat();
      })
      .catch(() => {});
  } else if (shipKind === 'cruiser') {
    import('../../rickmorty/cruiser3d')
      .then((mod) => mod.buildCruiser({ ink: 0.36 / 2.7 }))
      .then((c) => {
        if (!c) return;
        if (disposed || !ship.mount(c.group, { update: c.update, dispose: c.dispose, ownGlow: true, tint: c.tint })) {
          c.dispose();
          disposeTree(c.group);
        } else seat();
      })
      .catch(() => {});
  }
  // once it's down it's solid
  let shipSolid = false;
  const solidShip = () => {
    if (shipSolid) return;
    shipSolid = true;
    world.solids.box(landAt[0], landAt[1], shipBox.w * 0.8, shipBox.l * 0.85, site.land.yaw);
  };

  await breathe();
  // ── You, and your crewmate ──
  // (the hero you've picked to play as (heroes.js) walks in the lead; the
  // ship's own crew otherwise, and the one of them you aren't stays your mate.
  // A hero, gun, blade or perk picked down here goes on there and then: setHero)
  const crewOf = PARTY[shipKind] ?? PARTY.xwing;
  let picked = ctx.hero ? writeHero(ctx.hero) : null; // (the choice as kept, to know a new one)
  let hero = ctx.hero ? heroSpec(ctx.hero) : null;
  let perks = perkEffects(hero?.perks ?? []); // (galaxy/perks.js: the multipliers the hero's perks give)
  let guardMax = GUARD.max * perks.guard;
  // (your mate carries their own two abilities too, where they're on the roster)
  const withAbilities = (s) => (s.abilities || !heroById(s.id)?.abilities ? s : { ...s, abilities: heroById(s.id).abilities });
  const party = partyFor(hero, crewOf).map(withAbilities);
  const out = new V(Math.cos(site.land.yaw), 0, -Math.sin(site.land.yaw)); // the ship's right
  // (a mission on foot starts you at its start, facing its way)
  const onFoot = Boolean(mission && !mission.ride);
  const spawnAt = onFoot ? [...mission.start] : [landAt[0] + out.x * (shipBox.w + 2.5), landAt[1] + out.z * (shipBox.w + 2.5)];
  const you = walker(spawnAt[0], spawnAt[1], groundAt(world, ...spawnAt), onFoot ? mission.yaw : site.land.yaw + 0.5);
  const mateAt = [spawnAt[0] + out.x * 1.6, spawnAt[1] + out.z * 1.6];
  const mate = walker(mateAt[0], mateAt[1], groundAt(world, ...mateAt), you.yaw);
  const people = [
    { spec: party[0], st: you, holder: new THREE.Group(), fig: null, fitting: 0 },
    { spec: party[1], st: mate, holder: new THREE.Group(), fig: null, fitting: 0 },
  ];
  let lead = 0; // which of them you are
  for (const p of people) {
    p.holder.visible = false;
    scene.add(p.holder);
  }
  // the gun's numbers (weaponRules.js), with the mods they picked and the hero's perks
  const weaponOf = (spec, fig) => {
    const w = withMods(fig.gun ?? spec.gun, spec.mods ?? []);
    w.heat *= perks.heat;
    w.cool *= perks.cool;
    w.every *= perks.cycle;
    return w;
  };
  // what's in a figure's hand for `spec`: the gun (universe/gunplay.js; the
  // world here is in metres) and a lightsaber on it (surface/saber.js: lit,
  // swung, held up and thrown from here)
  const armsFor = (spec, fig, own) => {
    if (!spec.gun || own) return { gp: null, saber: null, weapon: null };
    const gp = createGunplay(fig, fig.gun ?? spec.gun, { unit: 1, who: fig.built ? 'built' : spec.id });
    const saber = spec.saber && gp ? createSaber(gp, { color: spec.saber.color, hilt: spec.saber.hilt, stance: spec.saber.stance, parent: scene, sound: (what) => sounds.saber?.(what) ?? sounds.combat?.(what), fig }) : null;
    return { gp, saber, weapon: weaponOf(spec, fig) };
  };
  const unarm = (a) => {
    a.saber?.dispose();
    a.gp?.dispose();
  };
  // a person's body and what's in their hand, for `spec`: made and warmed
  // apart from them, so it goes on in one frame (wear) and nobody's ever missing
  async function kitOut(spec) {
    if (spec.src.meshy) {
      cast ??= createMeshyCast(withWardrobe());
      await cast.load(null, [spec.src.meshy]).catch(() => {});
    }
    // (one of the crew with a model of their own here: that, in metres)
    const own = CREW_MODELS[spec.id] ? await modelFigure(CREW_MODELS[spec.id]).catch(() => null) : null;
    const fig = own ?? (await loadPartyFigure(spec, cast).catch(() => null));
    if (!fig) return null;
    const inner = new THREE.Group();
    if (!own) inner.scale.setScalar(1 / METRE);
    inner.add(fig.model);
    fig.model.traverse((o) => {
      if (o.isMesh) o.castShadow = !o.userData.noShadow; // (a 2017 figure's small parts: none)
    });
    inner.updateMatrixWorld(true);
    // (a model of their own reads its motion in metres a second, as the
    // world's people do; a party figure in the map's units)
    const body = { spec, fig, inner, own: Boolean(own), ...armsFor(spec, fig, own) };
    if (!disposed) await warm(inner).catch(() => {});
    return body;
  }
  // what a person had on, gone (each figure frees what's its own: a cast's
  // meshes are the cast's)
  function shed(p) {
    if (!p.fig) return;
    if (emoteFig === p.fig) endEmote();
    unarm(p);
    p.fig.dispose?.();
    p.inner?.removeFromParent();
  }
  function wear(p, body) {
    shed(p);
    p.holder.add(body.inner);
    // (a seat, a fall and a turn are the old body's: the new one takes them up afresh)
    Object.assign(p, { spec: body.spec, fig: body.fig, inner: body.inner, own: body.own, gp: body.gp, saber: body.saber, weapon: body.weapon, seat: null, downed: null, prevYaw: null });
  }
  const dropBody = (body) => {
    if (!body) return;
    unarm(body);
    body.fig.dispose?.();
  };
  // a person in `spec`: the numbers at once; new arms in the same hands at
  // once; a new body when it's made (the last asked for wins). True once
  // it's on them.
  async function fit(p, spec) {
    const how = p.fig ? refitOf(p.spec, spec) : 'body';
    const token = ++p.fitting;
    if (how === 'same') {
      p.spec = spec;
      if (p.gp) p.weapon = weaponOf(spec, p.fig);
      return true;
    }
    if (how === 'arms') {
      if (emoteFig === p.fig) endEmote();
      unarm(p);
      Object.assign(p, { spec, ...armsFor(spec, p.fig, p.own) });
      warm(p.holder).catch(() => {});
      ctx.invalidate();
      return true;
    }
    const body = await kitOut(spec);
    if (disposed || token !== p.fitting) {
      dropBody(body);
      return false;
    }
    if (!body) return false;
    wear(p, body);
    ctx.invalidate();
    return true;
  }
  (async () => {
    await Promise.all(people.map((p) => fit(p, p.spec)));
    // (the clips the two of you react with, fetched now, so a roll or a
    // flinch starts on the frame it's asked for, not a fetch later)
    if (!disposed && people.some((p) => p.fig?.anim)) preload(['roll', 'hit.chest', 'hit.head', ...(mission?.kind === 'assault' ? ['die.fwd', 'die.back', 'die.blown'] : [])]).catch(() => {});
  })();
  // another hero picked (the page's HeroPanel): who you are now walks where
  // you were, and your mate is whoever of the crew isn't them; the guard as
  // full as it was, of the new perks' most (a swap mid-fight refills
  // nothing); a mission, your health and where you are kept
  function setHero(choice) {
    const kept = writeHero(choice);
    if (kept === picked) return;
    picked = kept;
    hero = heroSpec(choice);
    perks = perkEffects(hero.perks ?? []);
    const share = state.guard.value / guardMax;
    guardMax = GUARD.max * perks.guard;
    state.guard = { ...state.guard, value: share * guardMax };
    const [lead1, mate1] = partyFor(hero, crewOf).map(withAbilities);
    // (the page hears once they're on: `ok` false when the body wouldn't load)
    const was = picked;
    fit(me(), lead1).then((ok) => {
      if (!disposed && picked === was) emit({ type: 'hero', who: lead1.id, ok });
    });
    fit(other(), mate1);
    ctx.invalidate();
  }
  // ── Your mate, in a fight (MATE): its health, how long it's been down,
  // what it's shooting at and when it can next, how far its gun's up, the
  // bolts on their way to it, and when it last looked ──
  const mateFight = { hp: MATE.hp, down: 0, foe: null, cool: 0, aim: 0, shoot: false, hurtAt: -10, hitFrom: null, hits: [], lookAt: -1, gaze: new V(), turning: false };

  // ── Sound: the air, your steps, a speeder's whine (once you've touched
  // something: browsers only let sound start then) ──
  const kinds = new Set(site.weather.map((w) => w.kind));
  const sounds = createSounds({
    ...site,
    sound: site.sound ?? {
      wind: kinds.has('sand') ? 0.8 : kinds.has('snow') ? 1 : 0.35,
      rain: kinds.has('rain') ? 1 : 0,
      sea: site.water?.kind === 'sea' ? 0.7 : 0,
      lava: site.water?.kind === 'lava' || kinds.has('embers') ? 0.7 : 0,
      critters: kinds.has('motes') ? 0.6 : 0,
      ground: kinds.has('snow') ? 'snow' : site.water?.kind === 'swamp' ? 'mud' : 'sand',
    },
  });
  let strode = 0;
  // ── The 2017 soldier's body (playerBody.js) ──
  // A level whose shapes are in a physics engine (lane P0's stream) hands it
  // over through the handle's usePhysics; until then, and on a world with no
  // level pack, a phone or a low tier, you walk on walker.js as ever.
  let body = null;
  let bodyPhysics = null;
  let bodyDrives = true;
  let soldierBook = null;
  const bodyFor = (st) => {
    body?.dispose();
    return createPlayerBody({ physics: bodyPhysics, state: st, row: soldierBook.rows[soldierBook.default], world, drive: bodyDrives });
  };

  // ── The other pilots down here (online) ──
  const peers = createPeers({ parent: scene, placer, rides: RIDES, models, only: site.cast === 'models', getCast: () => (cast ??= createMeshyCast(withWardrobe())) });

  await breathe();
  // ── State ──
  const state = {
    phase: mission ? (mission.ride ? 'ride' : 'walk') : reduced ? 'walk' : 'landing',
    age: 0,
    t: 0,
    frames: 0,
    keys: {},
    stick: { x: 0, y: 0 },
    buttons: { run: false },
    // the jump: a moment early or a moment off an edge still lands (lib/press.js)
    jumpPress,
    actQueued: false,
    throwQueued: false,
    dodgeQueued: false,
    powerQueued: false,
    secondQueued: false,
    saberAt: -99, // when the saber last did something (it goes out after SABER_IDLE)
    // ── the fight (combatRules.js, weaponRules.js) ──
    guard: { value: guardMax, hitAt: null, brokenAt: null }, // what blocking spends
    blockAt: null, // when C went down (their blade's contact just after is parried: blockOutcome)
    reelUntil: -99, // till when you reel, your stroke parried (no stroke, no block)
    pressAt: null, // when F went down with a saber (held, it's the heavy stroke)
    dodge: null, // { t0, dx, dz }
    dodgedAt: -99,
    lock: null, // the enemy a stroke homes on
    cool: { power: -99, second: -99 }, // when each ability is ready again
    overcharge: -99, // until when the gun runs hot-free
    sprint: -99, // until when you're sprinting (abilityRules.js's sprint)
    jet: newJet(), // the jetpack's tank, for a hero with one (the held lightning's too)
    rage: null, // { until, taken, shield }: a rage on you (powers.js)
    throwCool: -99, // when a hero's own saber throw is back (abilityRules.js's SABER_THROWS)
    heat: { value: 0, locked: false, lockedAt: null },
    burst: null, // { left, next }: the rest of a burst
    ads: false, // down the sights (right button, or the Aim button)
    adsK: 0,
    hitstop: 0, // seconds the frame holds after a hit
    hudAt: -99,
    bombs: [], // thermal detonators (and the like) in the air: { m, v, t0, spec }
    cam: { yaw: mission ? mission.yaw : you.yaw, pitch: 0.2, dist: mission?.ride ? RIDES[mission.ride].cam[0] : CAM.dist, drag: -10 },
    riding: mission?.ride ? rides[rides.length - 1] : null,
    prompt: null,
    here: null,
    found: new Set(props.found ?? []),
    edgeAt: -10,
    shake: 0,
    dust: 0,
    quest: null, // quests.js's progress on the one you're on
    tracked: null, // the one picked from the list (its giver on the compass)
    done: new Set(props.done ?? []),
    health: 100,
    hurtAt: -10,
    firedAt: -10,
    aim: 0, // your gun up, 1 fading to 0 after a shot
    aimDir: new V(0, 0, 1),
    shot: null, // a shot to send once you've turned to it
    kick: { x: 0, v: 0 }, // the view's kick on a shot
    zone: null, // the place you're in, if you've gone into one
    outside: null, // where you were before you went in
    // a battle (missions/assault.js): off the field while you choose a side
    // ('choose') or you're down ('down'), and how long you've been down
    off: mission?.kind === 'assault' ? 'choose' : null,
    fallen: 0,
    // ── your body (lib/three/animator.js through your figure) ──
    emote: null, // { id, at }: what you're doing off the wheel (lib/emote.js)
    wheelKeys: false, // the keys (or the stick) that pointed at a slice, still down
    reacting: null, // { who, clip, layer, until }: a reaction of yours playing, for the next input to cut
    hitFrom: null, // { x, z }: where the last thing to hurt you came from (the way you fall)
    tg: null, // what E does here, as the last frame had it (what your mate looks at)
  };
  const camPos = new V();
  const camLook = new V();
  let baseFov = 60;
  let camInit = false;
  if (state.phase === 'walk' || state.phase === 'ride') {
    for (const p of people) p.holder.visible = true;
    solidShip();
  }

  // the ship's way down: in from behind, low over the land, onto its spot
  const shipLanded = new V(landAt[0], landY, landAt[1]);
  const approach = new V(-Math.sin(site.land.yaw), 0, -Math.cos(site.land.yaw));
  const shipFrom = shipLanded.clone().addScaledVector(approach, 700).add(new V(0, 320, 0));
  shipHolder.position.copy(state.phase === 'landing' ? shipFrom : shipLanded);
  shipHolder.rotation.y = site.land.yaw;
  ship.park?.(state.phase !== 'landing');
  let engine = null;
  const engineOn = (speed) => {
    if (!engine) {
      if (!audioContext()) return;
      engine = shipEngine(shipKind);
    }
    engine.set({ speed, boost: false, on: true });
  };

  // ── Dust: kicked up landing and taking off, behind a speeder ──
  const DUST = 160;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3));
  const dustVel = new Float32Array(DUST * 3);
  const dustAge = new Float32Array(DUST).fill(99);
  const puff = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const dustMat = new THREE.PointsMaterial({ color: site.dust ?? site.ground.palette.high ?? '#d8c8a8', map: puff, size: 2.4, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);
  let dustNext = 0;
  const kick = (x, y, z, spread, up = 2) => {
    const i = dustNext++ % DUST;
    const a = r() * Math.PI * 2;
    dustGeo.attributes.position.setXYZ(i, x + Math.cos(a) * spread * 0.3, y + 0.2, z + Math.sin(a) * spread * 0.3);
    dustVel.set([Math.cos(a) * spread * (0.6 + r()), up * (0.3 + r()), Math.sin(a) * spread * (0.6 + r())], i * 3);
    dustAge[i] = 0;
  };
  const stepDust = (dt) => {
    const p = dustGeo.attributes.position;
    let any = false;
    for (let i = 0; i < DUST; i++) {
      if (dustAge[i] > 3) {
        if (p.getY(i) > -1e5) p.setY(i, -1e6);
        continue;
      }
      any = true;
      dustAge[i] += dt;
      const k = Math.exp(-dt * 1.4);
      dustVel[i * 3] *= k;
      dustVel[i * 3 + 1] = dustVel[i * 3 + 1] * k - 0.4 * dt;
      dustVel[i * 3 + 2] *= k;
      p.setXYZ(i, p.getX(i) + dustVel[i * 3] * dt, p.getY(i) + dustVel[i * 3 + 1] * dt, p.getZ(i) + dustVel[i * 3 + 2] * dt);
    }
    p.needsUpdate = true;
    dustMat.opacity = any ? 0.5 : 0;
  };

  // ── Input ──
  // (the emote wheel, B: lib/emote.js's; the pointer's where it is, and
  // where it was when the wheel opened, to point at a slice by)
  const emotes = createEmoteWheel();
  const firstView = createFirstView({ camera, phone: device().phone });
  const pointer = { x: 0, y: 0, x0: 0, y0: 0, id: null };
  const onKey = (down) => (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;
    const k = KEYS[e.key.toLowerCase()];
    if (e.key === 'Tab' && down) {
      e.preventDefault();
      swap();
      return;
    }
    if (!k) return;
    if (k === 'jump' || k === 'up' || k === 'down') e.preventDefault();
    if (down && !e.repeat) {
      sounds.start();
      if (state.phase === 'landing') skipLanding();
      if (k === 'jump') state.jumpPress.press();
      if (k === 'act') state.actQueued = true;
      if (k === 'fire') state.fireQueued = true;
      if (k === 'throw') state.throwQueued = true;
      if (k === 'dodge') state.dodgeQueued = true;
      if (k === 'power') state.powerQueued = true;
      if (k === 'second') state.secondQueued = true;
      if (k === 'block') state.blockAt = state.t;
      if (k === 'fire' && me().saber) state.pressAt = state.t;
      if (k === 'emote') emoteDown();
      // (out of your own eyes, and back: firstView.js)
      if (k === 'view') firstView.toggle(me().fig, { seated: state.phase !== 'walk' });
    }
    if (!down && k === 'emote') emoteUp();
    if (!down && k === 'fire' && state.pressAt != null) {
      // a saber's F let go: a stroke, or the heavy one if it was held
      state.swingQueued = state.t - state.pressAt >= HEAVY.hold ? 'heavy' : 'light';
      state.pressAt = null;
    }
    state.keys[k] = down;
    ctx.invalidate();
  };
  const keyDown = onKey(true);
  const keyUp = onKey(false);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  const blur = () => {
    state.keys = {};
    emotes.cancel();
  };
  window.addEventListener('blur', blur);
  // the look (surfaceLook.js): a click locks the pointer, a drag where it
  // can't; its buttons are F and C's
  const wake = () => {
    sounds.start();
    if (state.phase === 'landing') skipLanding();
  };
  const looker = surfaceLook({ canvas, state, me: () => me(), wake, turn: (dx, dy) => turn(dx, dy), emit, invalidate: () => ctx.invalidate() });
  // a click wakes the sound and skips the landing, whatever else it does
  const down = (e) => {
    if (e.pointerType === 'touch') return; // (the page's own look pad, on a phone)
    wake();
  };
  const move = (e) => {
    // (the wheel's pointed at by the pointer that last went down: on a
    // phone the thumb on the Emote button, not one on the stick or the pad;
    // under the lock there's no cursor, so its movement is summed instead)
    if (looker.locked && e.pointerType === 'mouse') {
      pointer.x += e.movementX || 0;
      pointer.y += e.movementY || 0;
    } else if (pointer.id == null || e.pointerId === pointer.id || e.pointerType === 'mouse') {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }
  };
  // where a pointer goes down, anywhere on the page (ahead of what it lands
  // on): a thumb that holds the Emote button and slides off it points at a
  // slice from where it went down
  const spot = (e) => {
    pointer.id = e.pointerId;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  window.addEventListener('pointerdown', spot, true);
  const noMenu = (e) => e.preventDefault();
  canvas.addEventListener('contextmenu', noMenu);
  const wheel = (e) => {
    e.preventDefault();
    state.cam.dist = clamp(state.cam.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12), CAM.near, CAM.far);
    ctx.invalidate();
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  canvas.addEventListener('wheel', wheel, { passive: false });
  // a drag of the page's look pad, in pixels
  function look(dx, dy) {
    turn(dx * 0.0055, dy * 0.0045);
  }
  // a turn in radians; slower over a target with a gun up (the assist's
  // friction, lib/combat/aim.js), and none while the emote wheel's open
  // (the locked pointer is pointing at a slice)
  function turn(dx, dy) {
    if (emotes.open) return;
    let k = 1;
    if (state.phase === 'walk' && !me().saber) {
      camera.getWorldDirection(_lookDir);
      k = lookFriction({ cam: camera.position, dir: _lookDir, targets: shootable(), cone: coneFor({ mode: looker.mode }) });
    }
    state.cam.yaw -= dx * k;
    state.cam.pitch = clamp(state.cam.pitch + dy * k, CAM.pitch[0], CAM.pitch[1]);
    state.cam.drag = state.t;
    ctx.invalidate();
  }
  const _lookDir = new V();
  // where a shot from `from` goes: to what the crosshair's on (aimShot.js),
  // the camera's ray bent by the assist's cone for this input
  const _aimDir = new V();
  function aimed(from) {
    camera.getWorldDirection(_aimDir);
    const d = aimDir({ cam: camera.position, dir: _aimDir, from, targets: shootable(), world, cone: coneFor({ mode: looker.mode }), range: weapon().range });
    return _aimDir.set(d[0], d[1], d[2]);
  }

  // ── Doing things ──
  function skipLanding() {
    if (state.phase !== 'landing' || state.age < 0.6) return;
    state.age = LAND.descend + LAND.settle;
  }
  function swap() {
    if (state.phase !== 'walk') return;
    // (what you were doing stops with you; a mate who's down gets up to be
    // you, and the one you were starts as your mate afresh)
    endEmote();
    firstView.leave(me().fig);
    mateUp();
    mateFight.foe = null;
    mateFight.aim = 0;
    lead = 1 - lead;
    const a = people[lead].st;
    state.cam.yaw = a.yaw;
    emit({ type: 'swap', who: people[lead].spec.id });
  }
  const me = () => people[lead];
  const other = () => people[1 - lead];

  // ── Your body: reactions and emotes ──
  // A reaction of yours (react.js's table, through your figure: a flinch,
  // a cheer), noted so the next thing you do cuts it
  const LASTS = { hit: 0.6, win: 5 }; // seconds: the longest each can be before nothing's left to cut
  function reactYou(event, opts = {}) {
    const p = me();
    const r = p.fig?.react?.(event, { yaw: p.st.yaw, ...opts }) ?? null;
    if (r) state.reacting = { who: p, clip: r.clip, layer: r.layer, until: state.t + (LASTS[event] ?? 2) };
    return r;
  }
  // cut it, if it's still the clip playing (what came after is left be)
  function cutReaction() {
    const c = state.reacting;
    state.reacting = null;
    const a = c?.who.fig?.anim;
    if (!a || state.t > c.until) return;
    if (!a.playing || a.playing(c.layer) === c.clip) c.who.fig.stop?.(0.15, c.layer);
  }
  // both of you, on something won (a quest done, a post taken): yours cut
  // by input as ever; nobody who's down
  function endPose(won) {
    const f = me().fig;
    if (state.fallen > 0 || !f?.clips) return;
    const clip = won ? victoryFor(f.clips, Math.floor(state.t)) : f.clips.defeat ? 'defeat' : null;
    if (!clip) return;
    f.play?.(clip, { hold: 8 });
    // (cut by what you do, as any reaction on the whole body is)
    state.reacting = { who: me(), clip, layer: 'full', until: state.t + 8 };
  }
  function cheer() {
    if (!(state.fallen > 0)) reactYou('win');
    if (mateFight.down <= 0) other().fig?.react?.('win', { yaw: other().st.yaw });
  }
  // the wheel: B down, held, let go (or the page's buttons)
  let wheelSaid = { open: false, hover: null, last: emotes.last, on: null }; // (what the page was last told)
  function emoteDown() {
    if (state.phase !== 'walk' || state.off) return;
    pointer.x0 = pointer.x;
    pointer.y0 = pointer.y;
    emotes.down(state.t);
  }
  function emoteUp() {
    const id = emotes.up(state.t);
    if (id) startEmote(id);
  }
  function startEmote(id) {
    if (state.phase !== 'walk' || state.off || state.dodge || state.fallen > 0) return;
    cutReaction();
    // (a 2017 hero's own emote in the slot's place, as long as it is: lib/emote.js's emoteFor)
    const got = emoteFor(me().fig, id);
    state.emote = { id, at: state.t, length: got?.length, walk: got?.walk };
  }
  let emoteShown = null;
  let emoteFig = null; // (whose figure it's on: a swap leaves it with them)
  function endEmote() {
    state.emote = null;
    emoteShown = applyEmote(emoteFig, null, emoteShown);
  }
  // each frame, before the figures update: the wheel pointed at (by the
  // pointer, or the keys or the stick while it's open), your emote kept or
  // cut, a reaction cut by what you do (anything pressed; one on the whole
  // body by going anywhere too, since it holds the legs; held fire never,
  // since the gun's arms are over it: a flinch still shows in a firefight)
  function stepBody(moving, pressed, held) {
    const acted = pressed || held;
    const k = state.keys;
    const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0) + state.stick.x;
    const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0) - state.stick.y; // (down the screen)
    const steering = Math.hypot(kx, ky) > 0.4;
    if (emotes.open || k.emote || state.buttons.emote) {
      emotes.tick(state.t);
      if (emotes.open) {
        const px = (pointer.x - pointer.x0) / WHEEL_PX;
        const py = (pointer.y - pointer.y0) / WHEEL_PX;
        if (steering) emotes.aim(kx, ky);
        else if (Math.hypot(px, py) > 0.4) emotes.aim(px, py);
      }
    }
    // (the keys that pointed at a slice don't walk you off till they're let go)
    if (emotes.open && steering) state.wheelKeys = true;
    else if (!steering) state.wheelKeys = false;
    const r = state.reacting;
    if (r && (pressed || (r.layer === 'full' && moving) || state.t > r.until)) cutReaction();
    const walking = state.phase === 'walk' && !state.off && !state.dodge && !(state.fallen > 0);
    state.emote = walking ? keepEmote(state.emote, state.t, { moving, acted }) : null;
    if (emoteFig !== me().fig && emoteShown) endEmote();
    emoteFig = me().fig;
    emoteShown = applyEmote(emoteFig, state.emote ? readEmote({ emote: state.emote }, state.t) : null, emoteShown);
    const on = state.emote?.id ?? null;
    const w = wheelSaid;
    if (w.open !== emotes.open || w.hover !== emotes.hover || w.last !== emotes.last || w.on !== on) {
      wheelSaid = { open: emotes.open, hover: emotes.hover, last: emotes.last, on };
      emit({ type: 'emote', ...wheelSaid });
    }
  }

  // ── Your mate's body, and its part in a fight (MATE) ──
  // hit: hurt, and a flinch (the chest or the head); out of health, down
  // (place() plays the fall by the way the hit went, and stands it up again)
  function mateHit(n, from = null) {
    if (mateFight.down > 0) return;
    const q = other();
    mateFight.hp -= n;
    mateFight.hurtAt = state.t;
    mateFight.hitFrom = from;
    if (mateFight.hp <= 0) {
      mateFight.hp = 0;
      mateFight.down = 0.001;
      mateFight.foe = null;
      return;
    }
    q.fig?.react?.('hit', { where: Math.random() < 0.3 ? 'head' : 'chest', yaw: q.st.yaw, ...(from ? { dir: { x: q.st.x - from.x, z: q.st.z - from.z } } : {}) });
  }
  function mateUp() {
    mateFight.down = 0;
    mateFight.hp = MATE.hp;
    mateFight.hits.length = 0;
  }
  // a swipe at you (a rancor's, a blade's) that reaches your mate too
  function swiped(s) {
    const q = other().st;
    const reach = (s.who?.hostile?.reach ?? 2) + 0.4;
    if (Math.hypot(q.x - s.from[0], q.z - s.from[2]) < reach) mateHit(s.damage ?? 25, { x: s.from[0], z: s.from[2] });
  }
  // what it fights: what you're squared up to, else what you last hit,
  // while you're at it; else (out of a battle) the nearest hostile that's
  // after the two of you. Only a mate with a gun, up, out on foot
  let struckLast = null; // { target, at }: what your last shot hit
  function mateFoe() {
    const q = other();
    if (!q.gp || q.saber || mateFight.down > 0 || state.phase !== 'walk' || state.off) return null;
    const st = q.st;
    const near = (t) => Boolean(t) && !t.down && t.holder && Math.hypot(t.holder.position.x - st.x, t.holder.position.z - st.z) < MATE.range;
    const keen = state.t - state.firedAt < MATE.keen;
    // (never the first shot: only at what you're shooting, or what's shooting at you)
    if (near(state.lock) && (keen || (state.lock.hostile && state.lock.aim))) return state.lock;
    if (struckLast && keen && near(struckLast.target) && state.t - struckLast.at < MATE.keen) return struckLast.target;
    if (assaultOn()) return null;
    let best = null;
    let bd = MATE.range;
    for (const t of [...groundWar.targets, ...activity.targets]) {
      if (!t.hostile || !t.aim || t.spec?.side === 'yours') continue;
      const d = Math.hypot(t.holder.position.x - st.x, t.holder.position.z - st.z);
      if (d < bd) {
        best = t;
        bd = d;
      }
    }
    return best;
  }
  // where a figure's chest is (a target's, the soldiers' in a battle)
  const chestOf = (t, out = new V()) => {
    out.copy(t.holder.position);
    out.y += (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1) * 0.55;
    return out;
  };
  // each frame of a walk: the foe, the gun up toward it, a shot when it's
  // due; what it looks at; the bolts reaching it; down and up again
  function stepMate(dt) {
    const q = other();
    // the bolts that pass through it, as each gets there
    for (let i = mateFight.hits.length - 1; i >= 0; i--) {
      const h = mateFight.hits[i];
      if (state.t < h.at) continue;
      mateFight.hits.splice(i, 1);
      mateHit(h.damage, h.from);
    }
    if (mateFight.down > 0) {
      mateFight.down += dt;
      mateFight.aim = Math.max(0, mateFight.aim - dt * 3);
      mateFight.shoot = false;
      if (mateFight.down > MATE.down) mateUp();
      return;
    }
    if (mateFight.hp < MATE.hp && state.t - mateFight.hurtAt > 4) mateFight.hp = Math.min(MATE.hp, mateFight.hp + dt * 12);
    mateFight.foe = mateFoe();
    const foe = mateFight.foe;
    mateFight.aim = foe ? Math.min(1, mateFight.aim + dt * 4) : Math.max(0, mateFight.aim - dt / 2.5);
    mateFight.cool -= dt;
    mateFight.shoot = Boolean(foe) && mateFight.aim > 0.85 && mateFight.cool <= 0;
    // (not through a wall: it waits for a clear line, looking again in a moment)
    if (mateFight.shoot && !lineClear(world.solids, q.st, foe.holder.position)) {
      mateFight.shoot = false;
      mateFight.cool = 0.3;
    }
    if (mateFight.shoot) mateFight.cool = MATE.every[0] + Math.random() * (MATE.every[1] - MATE.every[0]);
    // its head: on what it fights, else on what you're about to talk to,
    // else out along where you're looking
    if (state.t - mateFight.lookAt >= MATE.lookEvery) {
      mateFight.lookAt = state.t;
      const g = mateFight.gaze;
      const a = state.tg?.kind === 'talk' ? state.tg.actor : null;
      if (foe) chestOf(foe, g);
      else if (a?.holder) g.set(a.b?.x ?? a.holder.position.x, a.holder.position.y + (a.fig?.tall ?? 1.6) * (a.spec?.scale ?? 1) * 0.9, a.b?.z ?? a.holder.position.z);
      else {
        camera.getWorldDirection(g);
        g.multiplyScalar(20).add(camera.position);
        g.y = Math.max(g.y, q.st.y + 0.5);
      }
      q.fig?.look?.(g);
    }
  }
  // its shot, once its gun's been posed this frame (place()): from the
  // muzzle at the foe's chest, a little off; in a battle a bolt between
  // them that the battle's own count decides (as every soldier's is)
  function mateShot(q) {
    const foe = mateFight.foe;
    mateFight.shoot = false;
    if (!foe || !q.gp) return;
    const r = q.gp.fire();
    const to = chestOf(foe);
    const dir = to.clone().sub(r.muzzle).normalize();
    const w = q.weapon ?? withMods(q.spec.gun ?? 'blaster', q.spec.mods ?? []);
    const bolt = GUNS[w.kind]?.bolt ?? q.spec.bolt ?? '#ff3b30';
    fx.flash(r.muzzle, dir, q.gp.spec.flash);
    gunSound(q.spec.gun, { soft: true });
    heardBy(r.muzzle, to);
    if (assaultOn()) {
      blaster.tracer(r.muzzle.toArray(), to.toArray(), bolt);
      return;
    }
    // (a bolt at its weapon's scatter, that lands where it lands: boltPlay's yours)
    const sp = spreadAt(w, false) * 2;
    const aim = dir.clone().add(new V((Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp, (Math.random() - 0.5) * sp)).normalize();
    blaster.fire(r.muzzle, aim, [foe], bolt, w.range, null, { mate: true, push: aim });
  }
  // your shots and blasts (and your mate's, and the hostiles' fire), for the
  // people about to hear them: actors.js's `hear` (they startle and run from it), a blast twice
  // as loud as a shot. `aim`: where it went (for a hearer that wants it)
  function heardBy(from, aim = null, kind = 'shot') {
    if (typeof life.hear !== 'function') return;
    life.hear({ at: { x: from.x, z: from.z }, loudness: kind === 'boom' ? 2 : 1, t: state.t, ...(aim ? { aim: { x: aim.x, z: aim.z } } : {}) });
  }

  // what E does here, now
  const target = () => {
    const p = me().st;
    if (state.phase === 'ride') return state.riding.state.speed < 7 && !chaseOn() ? { kind: 'dismount', text: `Get off ${state.riding.spec.name}` } : null;
    if (state.phase !== 'walk' || state.off) return null;
    // a quest's thing to do here
    const step = state.quest && questOf(state.quest.id)?.steps[state.quest.step];
    if (step?.type === 'use' && Math.hypot(p.x - step.at[0], p.z - step.at[1]) < (step.r ?? 3)) return { kind: 'use', id: step.id, text: step.prompt ?? 'Use' };
    // the way out of where you are, or into somewhere
    if (state.zone) {
      const ex = state.zone.inside.exit;
      if (Math.hypot(p.x - (state.zone.origin[0] + ex.at[0]), p.z - (state.zone.origin[2] + ex.at[1])) < (ex.r ?? 2.5)) return { kind: 'leave', text: `Leave ${state.zone.name}` };
    } else
      for (const z of site.zones) if (Math.hypot(p.x - z.door.at[0], p.z - z.door.at[1]) < (z.door.r ?? 3)) return { kind: 'enter', zone: z, text: z.door.prompt ?? `Go into ${z.name}` };
    // the ship
    const sx = p.x - landAt[0];
    const sz = p.z - landAt[1];
    if (!state.zone && Math.hypot(sx, sz) < Math.max(shipBox.w, shipBox.l) + 3.5) return { kind: 'board', text: 'Get in and take off' };
    let best = null;
    let bestD = REACH;
    for (const x of rides) {
      const d = Math.hypot(p.x - x.state.x, p.z - x.state.z) - x.spec.radius;
      if (d < bestD) {
        best = { kind: 'mount', ridee: x, text: `Ride ${x.spec.name}` };
        bestD = d;
      }
    }
    if (best) return best;
    const a = life.talker(p.x, p.z, REACH, p.y);
    if (a) return { kind: 'talk', actor: a, text: `Talk to ${a.spec.named ? '' : 'the '}${a.spec.name ?? a.spec.kind}` };
    return null;
  };

  // ── Quests ──
  // the door into somewhere a step's inside of, when you're not in it
  const doorFor = (step) => {
    const zid = step?.zone ?? (step?.type === 'talk' ? life.find(step.actor)?.spec.zone : null);
    if (!zid || state.zone?.id === zid) return null;
    return site.zones.find((z) => z.id === zid)?.door.at ?? null;
  };
  // where someone is (for a talk step's marker)
  const actorAt = (id) => {
    const a = life.find(id);
    return a ? [a.b.x, a.b.z] : null;
  };
  // lines: a list, or a list for each ship's crew ({ xwing, falcon, …, all })
  const linesFor = (lines) => (Array.isArray(lines) ? lines : lines ? [...(lines.all ?? []), ...(lines[shipKind] ?? [])] : null);
  const say = (raw) => {
    const lines = linesFor(raw);
    if (lines?.length) emit({ type: 'say', lines: lines.map((l) => (Array.isArray(l) ? { who: l[0], text: l[1] } : { who: null, text: l })) });
  };
  const announce = () => {
    const q = state.quest && questOf(state.quest.id);
    const step = q?.steps[state.quest.step];
    emit({ type: 'quest', id: q?.id ?? null, name: q?.name ?? null, text: q ? stepText(q, state.quest) : null, left: step?.time ? Math.max(0, Math.ceil(step.time - state.quest.time)) : null, shoot: step?.type === 'shoot' });
  };
  // what you've got on your back (a step's { carry: kind }: Yoda, on
  // Dagobah's run), a prop of that kind peering over your shoulder; each
  // built once and kept (the kit owns what it's made of, and lets it go
  // with the scene), so carrying it again doesn't build another
  const carriable = new Map();
  let carried = null;
  function carry(kind) {
    carried?.removeFromParent();
    carried = null;
    if (!kind || !PROPS[kind]) return;
    if (!carriable.has(kind)) {
      const o = PROPS[kind](kit, {}).object;
      // (carried about: its scans go with it, kit.js's twins)
      kit.moving(o);
      o.position.set(0, 1.0, -0.3);
      carriable.set(kind, o);
    }
    carried = carriable.get(kind);
    me().holder.add(carried);
  }
  // what a step does as it starts or ends: a trapdoor opens, a gate comes
  // down, the band strikes up, someone's gone, you're thrown out
  function effects(list) {
    for (const e of list ?? []) {
      if (e.signal) placer.signal(e.signal, e.on ?? true);
      if (e.floor) for (const f of world.floors) if (f.tag === e.floor) f.off = Boolean(e.off);
      if (e.solid) for (const x of world.solids.all) if (x.tag === e.solid) x.off = Boolean(e.off);
      if (e.kill) activity.kill(e.kill);
      if (e.hide) life.hide(e.hide, true);
      if (e.show) life.hide(e.show, false);
      if (e.music !== undefined) sounds.music?.(e.music);
      if (e.sound) sounds[e.sound]?.();
      if (e.shake) state.shake = Math.min(1, state.shake + e.shake);
      if (e.say) say(e.say);
      if (e.leave) leaveZone();
      if ('carry' in e) carry(e.carry);
      if (e.to) {
        const p = me().st;
        putAt(p, e.to[0], e.to[1], e.yaw);
        camInit = false;
      }
      // (somewhere else on the site: the page goes there)
      if (e.go) emit({ type: 'go', to: e.go });
    }
  }
  function beginQuest(q) {
    if (!q || state.done.has(q.id) || state.quest) return;
    state.quest = startQuest(q);
    say(q.intro);
    effects(q.steps[0].start);
    say(q.steps[0].lines);
    activity.show(q, state.quest);
    announce();
    emit({ type: 'questStart', id: q.id });
  }
  function questEvent(ev) {
    if (!state.quest) return;
    const q = questOf(state.quest.id);
    const was = state.quest;
    const { progress, out } = feed(state.quest, q, ev);
    state.quest = progress;
    for (const o of out) {
      if (o.type === 'step') {
        effects(q.steps[o.step - 1].end);
        effects(q.steps[o.step].start);
        say(q.steps[o.step].lines);
      }
      if (o.type === 'done') {
        effects(q.steps.at(-1).end);
        effects(q.end);
        state.done.add(q.id);
        say(q.done);
        emit({ type: 'questDone', id: q.id, achievement: q.achievement ?? null });
        cheer(); // (the two of you, glad of it)
        if (q === mission?.quest) endMission('won');
      }
      if (o.type === 'fail') {
        emit({ type: 'questFail', id: q.id, why: o.why });
        if (q === mission?.quest) endMission('lost', o.why);
      }
    }
    if (out.length || (ev.type === 'tick' && Math.ceil(was.time) !== Math.ceil(progress?.time ?? 0))) announce();
    activity.show(q, state.quest);
  }
  const act = (tg) => {
    if (!tg) return;
    if (tg.kind === 'talk') {
      const spec = tg.actor.spec;
      // (what they offer now: their next quest not done, or their last, done)
      const offered = nextQuest(spec, state.done, questOf) ?? questsOf(spec).filter((id) => isOffered(questOf(id), state.done)).at(-1) ?? null;
      const q = offered && questOf(offered);
      const step = state.quest && questOf(state.quest.id)?.steps[state.quest.step];
      if (q && !state.done.has(q.id) && !state.quest) beginQuest(q);
      else if (step?.type === 'talk' && step.actor === spec.id) questEvent({ type: 'talk', actor: spec.id });
      else {
        const line = life.say(tg.actor);
        if (line) emit({ type: 'talk', ...line });
        else if (q && state.done.has(q.id)) say(q.again ?? [[spec.name, 'Thanks again.']]);
      }
    } else if (tg.kind === 'use') questEvent({ type: 'use', id: tg.id });
    else if (tg.kind === 'enter') enterZone(tg.zone);
    else if (tg.kind === 'leave') leaveZone();
    else if (tg.kind === 'mount') {
      state.riding = tg.ridee;
      state.phase = 'ride';
      state.cam.dist = tg.ridee.spec.cam[0];
      emit({ type: 'phase', phase: 'ride', kind: tg.ridee.kind });
      questEvent({ type: 'mount', kind: tg.ridee.kind });
    } else if (tg.kind === 'dismount') {
      const x = state.riding;
      const p = me().st;
      const side = new V(Math.cos(x.state.yaw), 0, -Math.sin(x.state.yaw));
      p.x = x.state.x + side.x * (x.spec.radius + 0.9);
      p.z = x.state.z + side.z * (x.spec.radius + 0.9);
      p.y = groundAt(world, p.x, p.z);
      p.vx = p.vz = p.vy = 0;
      p.grounded = true;
      x.state.speed = 0;
      state.riding = null;
      state.phase = 'walk';
      state.cam.dist = CAM.dist;
      emit({ type: 'phase', phase: 'walk' });
    } else if (tg.kind === 'board') board();
  };
  // into the ship and up: the climb out (stepLeaving; the page hands over to
  // space as it goes, and 'leave' at the end is for a page that can't)
  function board() {
    if (state.phase !== 'walk') return false;
    state.phase = 'leaving';
    state.age = 0;
    for (const q of people) q.holder.visible = false;
    ship.park?.(false);
    emit({ type: 'phase', phase: 'leaving' });
    return true;
  }

  // ── Going in and out ──
  let shadows = sun.castShadow; // (outdoors: the tier's, until lowerQuality)
  const outdoors = { sun: sun.intensity, second: second?.intensity ?? 0, sky: hemi.color.clone(), ground: hemi.groundColor.clone(), ambient: hemi.intensity, fog: scene.fog.color.clone(), density: scene.fog.density, env: scene.environmentIntensity };
  function lighting(z) {
    const L = z?.inside.light;
    sun.intensity = z ? 0 : outdoors.sun;
    if (second) second.intensity = z ? 0 : outdoors.second;
    hemi.color.set(L?.sky ?? outdoors.sky);
    hemi.groundColor.set(L?.ground ?? outdoors.ground);
    hemi.intensity = z ? (L?.ambient ?? 0.4) : outdoors.ambient;
    scene.fog.color.set(L?.fog ?? outdoors.fog);
    scene.fog.density = z ? (L?.density ?? 0.02) : outdoors.density;
    skyFog.indoors(Boolean(z));
    scene.environmentIntensity = z ? 0.15 : outdoors.env;
    sky.mesh.visible = !z;
    if (weather) weather.group.visible = !z;
    if (water) water.mesh.visible = !z;
    if (water?.spray) water.spray.visible = !z;
    // (inside, the world outside isn't drawn, and outside, no room is)
    ground.visible = !z;
    if (water?.glow) water.glow.visible = !z;
    placer.setZone(Boolean(z));
    life.setZone(Boolean(z));
    gameLit?.zone(z);
    // (indoors, the room's lamps and no sun to cast a shadow; outdoors, the sun's
    // shadow unless the frame rate has had it off, lowerQuality)
    sun.castShadow = !z && shadows;
    lamps.forEach((l, i) => {
      const d = z?.inside.lamps?.[i];
      l.intensity = d ? d[4] : 0;
      l.visible = Boolean(d);
      if (d) {
        l.position.set(z.origin[0] + d[0], z.origin[1] + d[1], z.origin[2] + d[2]);
        l.color.set(d[3]);
        l.distance = d[5] ?? 30;
      }
    });
  }
  const putAt = (st, x, z, yaw) => {
    st.x = x;
    st.z = z;
    st.y = groundAt(world, x, z);
    st.vx = st.vz = st.vy = 0;
    st.grounded = true;
    if (yaw != null) st.yaw = yaw;
  };
  function enterZone(z) {
    const p = me().st;
    state.outside = [p.x, p.z, p.yaw];
    state.zone = z;
    world.reach = Infinity;
    const [sx, sz] = z.inside.spawn ?? [0, 0];
    putAt(p, z.origin[0] + sx, z.origin[2] + sz, z.inside.yaw ?? 0);
    putAt(other().st, z.origin[0] + sx + 1.2, z.origin[2] + sz - 1, z.inside.yaw ?? 0);
    state.cam.yaw = p.yaw;
    state.cam.dist = Math.min(state.cam.dist, 3.4);
    camInit = false;
    lighting(z);
    sounds.music(z.music ?? null);
    emit({ type: 'zone', id: z.id, name: z.name });
    questEvent({ type: 'enter', zone: z.id });
  }
  function leaveZone() {
    const z = state.zone;
    if (!z) return;
    state.zone = null;
    world.reach = site.reach;
    const [bx, bz] = z.back ?? z.door.at;
    const yaw = state.outside?.[2] ?? 0;
    putAt(me().st, bx, bz, yaw + Math.PI);
    putAt(other().st, bx + 1.2, bz + 1, yaw + Math.PI);
    state.cam.yaw = yaw + Math.PI;
    state.cam.dist = CAM.dist;
    camInit = false;
    lighting(null);
    sounds.music(site.music ?? null);
    emit({ type: 'zone', id: null });
  }

  // ── A chase (missions/chase.js): the scouts, drawn and run here ──
  const chase = mission?.kind === 'chase' ? createChaseMission({ parent: scene, world, placer, blaster, mission, emit, say, sounds, rides: RIDES }) : null;
  // (on from the start, before the trees are in and it's begun, until it's
  // won or lost: no getting off the bike before then)
  const chaseOn = () => Boolean(chase && !chase.view()?.result);
  let chaseViewAt = -1;

  // ── A battle (missions/assault.js): two armies and the posts, drawn and run here ──
  // (what it tells the page goes on as it was; a post your side takes, or
  // the battle won, and the two of you cheer)
  const battleSaid = (e) => {
    emit(e);
    const ev = e?.type === 'mission' ? e.event : null;
    if ((ev?.type === 'capture' && ev.you) || ev?.type === 'won') cheer();
    // (the battle's end: a 2017 hero in the game's own victory pose, or its defeat)
    if (ev?.type === 'won' || ev?.type === 'lost') endPose(ev.type === 'won');
  };
  const assault = mission?.kind === 'assault' ? createAssaultMission({ parent: scene, world, blaster, mission, emit: battleSaid, say, sounds, kit, warm, tier: small ? 'mid' : tier, reduced, only: site.cast === 'models' }) : null;
  const assaultOn = () => Boolean(assault?.running());
  // what your blaster can hit, and what a hit does: the battle's soldiers while it's on, the quests' targets otherwise
  const shootable = () => [...groundWar.targets, ...(assaultOn() ? assault.targets : activity.targets)];
  const on = (t) => t?.ground ?? activity; // (a ground soldier's own hit, else the quests')
  // a shot that found someone: the weapon's damage (a shield breaks to a
  // blast), the hit marker, the moment's hold on a kill
  const struck = (hit, damage = me().weapon?.damage ?? 1, { breaks = false, how = null, push = null } = {}) => {
    if (!hit.target) return;
    struckLast = { target: hit.target, at: state.t }; // (your mate's foe, while you're at it)
    if (assaultOn() && !hit.target.ground) assault.hit(hit.target, ASSAULT.yours);
    else {
      const t = hit.target;
      const was = t.hp;
      on(t).hit(t, dealt(damage), { breaks, how, push, at: hit.at }); // (`at`: where it landed, the head or the chest, for its flinch)
      const killed = was > 0 && t.hp <= 0;
      emit({ type: 'hit', kill: killed });
      sounds.combat?.(killed ? 'kill' : 'hit');
      if (killed) state.hitstop = Math.max(state.hitstop, hitStop(damage, true) * 0.5);
    }
  };
  const weapon = () => me().weapon ?? withMods(me().spec.gun ?? 'blaster', me().spec.mods ?? []);
  const dealt = (n) => Math.max(1, Math.round(n * perks.damage));
  // a bolt's colour: the gun's own (Rick's gadgets), or the hero's
  const boltOf = (p) => GUNS[weapon().kind]?.bolt ?? p.spec.bolt ?? '#ff3b30';
  // the eyes' line, scattered by the weapon (tighter down the sights)
  const scatter = (dir, w) => {
    const sp = spreadAt(w, state.ads);
    return dir.clone().add(new V((Math.random() - 0.5) * sp * 2, (Math.random() - 0.5) * sp * 2, (Math.random() - 0.5) * sp * 2)).normalize();
  };
  // a side chosen, and onto the field at one of its posts (from the HUD, or the dev hooks)
  function chooseSide(id) {
    assault?.chooseSide(id);
    ctx.invalidate();
  }
  function deployAt(id) {
    const at = assault?.deploy(id);
    if (!at) return;
    leaveZone();
    putAt(me().st, at.x, at.z, at.yaw);
    state.cam.yaw = at.yaw;
    camInit = false;
    state.off = null;
    state.fallen = 0;
    state.health = 100;
    emit({ type: 'health', value: 100 });
    ctx.invalidate();
  }

  // ── A quest mission (missions/index.js): the quest engine runs it, this
  // keeps its clock and says how it ended ──
  let run = null;
  const runOn = () => Boolean(run && !run.result);
  function beginMission() {
    if (mission?.kind !== 'quest') return;
    state.quest = null;
    state.done.delete(mission.quest.id);
    activity.show(null, null);
    effects(mission.reset);
    run = newRun();
    say(mission.lines?.start);
    beginQuest(mission.quest);
    emit({ type: 'mission', view: run });
  }
  function endMission(how, why) {
    if (!runOn()) return;
    run = endRun(run, mission, how, why);
    if (how !== 'won') {
      state.quest = null;
      activity.show(null, null);
      announce();
    }
    say(mission.lines?.[how]);
    emit({ type: 'mission', event: { type: how }, view: run });
  }

  // ── Shooting, and being shot ──
  const camDir = new V();
  function fire() {
    const p = me().st;
    if (state.t - state.firedAt < FIRE_EVERY) return;
    // on a bike in a chase: its cannon, from the nose, where you're looking
    if (state.phase === 'ride' && chase) {
      if (state.t - state.firedAt < BIKE_FIRE_EVERY || !chase.running()) return;
      state.firedAt = state.t;
      camera.getWorldDirection(camDir);
      const b = state.riding.state;
      chase.fire(new V(b.x + Math.sin(b.yaw) * 1.8, b.y + 0.7, b.z + Math.cos(b.yaw) * 1.8), camDir, me().spec.bolt ?? '#ff3b30');
      heardBy(b, { x: b.x + camDir.x * 40, z: b.z + camDir.z * 40 });
      emit({ type: 'fire' });
      return;
    }
    if (state.phase !== 'walk' || state.off) return;
    if (me().saber) return; // (a saber's F is a stroke, on release: stepSaber)
    if (state.dodge) return;
    const w = weapon();
    if (state.t - state.firedAt < w.every) return;
    // too hot: nothing until it's vented or cools
    if (state.heat.locked) {
      if (state.t - state.firedAt > 0.3) {
        state.firedAt = state.t;
        sounds.combat?.('lock');
      }
      return;
    }
    state.firedAt = state.t;
    camera.getWorldDirection(camDir);
    p.yaw = Math.atan2(camDir.x, camDir.z);
    const right = new V(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    const from = new V(p.x, p.y + 1.35, p.z).addScaledVector(right, -0.25).addScaledVector(camDir, 0.5);
    // (aimed at what the crosshair's on, from your eyes' line; the bolt
    // leaves the muzzle once you've turned to it this frame, place() then
    // shot(); what it hits is the bolt's, when it gets there: boltPlay's yours)
    camDir.copy(aimed(from));
    const gp = me().gp;
    state.aim = 1;
    state.aimDir.copy(camDir);
    if (state.t > state.overcharge) state.heat = heatShot(state.heat, w, state.t);
    if (state.heat.locked) sounds.combat?.('lock');
    if (w.burst > 1) state.burst = { left: w.burst - 1, next: state.t + 0.075 };
    if (gp) {
      state.shot = { from, dir: camDir.clone() };
      return;
    }
    const hit = blaster.fire(from, scatter(camDir, w), shootable(), boltOf(me()), w.range, null, { yours: true, how: w.kind, push: camDir.clone() });
    groundWar.passed(from, hit.at); // (a soldier it went close by keeps its head down, and has a grudge)
    activity.heard({ x: from.x, z: from.z }, { x: from.x + camDir.x * 40, z: from.z + camDir.z * 40 }); // (the enemies hear it, and one it's aimed near knows)
    heardBy(from, { x: from.x + camDir.x * 40, z: from.z + camDir.z * 40 }); // (and the people about: actors.js's)
    sounds.blast?.();
    emit({ type: 'fire' });
  }
  // the rest of a burst, a shot at a time
  function stepBurst() {
    const b = state.burst;
    if (!b || state.t < b.next || state.phase !== 'walk') return;
    b.left--;
    b.next = state.t + 0.075;
    if (b.left <= 0) state.burst = null;
    const p = me().st;
    camera.getWorldDirection(camDir);
    const right = new V(-Math.cos(p.yaw), 0, Math.sin(p.yaw));
    const from = new V(p.x, p.y + 1.35, p.z).addScaledVector(right, -0.25).addScaledVector(camDir, 0.5);
    camDir.copy(aimed(from));
    state.aim = 1;
    state.aimDir.copy(camDir);
    if (me().gp) state.shot = { from, dir: camDir.clone() };
  }
  // ── The lightsaber (F a stroke, held up on C, thrown with R): you turn
  // to face where the camera looks, as for a shot, and the blade stays lit
  // a while after ──
  function swing(heavy = false) {
    const p = me();
    if (state.guard.brokenAt != null || state.dodge || state.t < state.reelUntil) return;
    camera.getWorldDirection(camDir);
    // homing on the one you're facing: the stroke turns you to them over its
    // wind-up and its own step carries you in (saber.js); with no one, you
    // face where the camera looks
    const t = state.lock && !state.lock.down ? state.lock : null;
    if (!t) p.st.yaw = Math.atan2(camDir.x, camDir.z);
    state.aim = 1;
    state.aimDir.copy(camDir);
    state.saberAt = state.t;
    // the way held at the click: W overhead, A or D a cut from that side, S rising
    const inp = input();
    const dir = Math.abs(inp.y) >= Math.abs(inp.x) ? (inp.y > 0.5 ? 'up' : inp.y < -0.5 ? 'rise' : null) : inp.x > 0.5 ? 'right' : inp.x < -0.5 ? 'left' : null;
    const sw = p.saber.swing(state.t, { heavy, dir, lock: t, lunge: perks.lunge });
    if (!sw) return;
    emit({ type: 'fire' });
  }
  // the dodge (X): a roll the way you're going (back, if you're still),
  // nothing landing through its first moments
  function dodge() {
    if (state.phase !== 'walk' || state.dodge || state.t - state.dodgedAt < DODGE.cool * perks.dodge || state.off) return;
    const inp = input();
    const p = me().st;
    let dx = Math.sin(inp.heading) * inp.y + Math.cos(inp.heading) * inp.x;
    let dz = Math.cos(inp.heading) * inp.y - Math.sin(inp.heading) * inp.x;
    if (Math.hypot(dx, dz) < 0.2) {
      dx = -Math.sin(p.yaw);
      dz = -Math.cos(p.yaw);
    }
    const m = Math.hypot(dx, dz);
    const d = { t0: state.t, dx: dx / m, dz: dz / m, d: 0 };
    state.dodge = d;
    state.dodgedAt = state.t;
    me().saber?.block(false);
    sounds.combat?.('dodge');
    // a body on the library rolls by its clip (the library's `roll`, paced
    // to the dodge, over the dodge's own way across the ground), turned to
    // the way it goes, and the holder stays upright; going back (or a body
    // that can't have it) tumbles as it always has
    const fig = me().fig;
    if (fig?.anim && fig.play && d.dx * Math.sin(p.yaw) + d.dz * Math.cos(p.yaw) > -0.5) {
      cutReaction();
      p.yaw = Math.atan2(d.dx, d.dz);
      d.clip = true;
      fig
        .play('roll', { layer: 'full', at: ROLL.at, speed: (ROLL.length - ROLL.at) / (DODGE.dur + ROLL.over) })
        .then((ok) => {
          if (!ok) d.clip = false;
        }, () => (d.clip = false));
    }
  }
  function stepDodge() {
    const d = state.dodge;
    if (!d) return false;
    const k = (state.t - d.t0) / DODGE.dur;
    if (k >= 1) {
      state.dodge = null; // (and place() stands you back up)
      return false;
    }
    const at = dodgeStep(k);
    const step = at.d - d.d;
    d.d = at.d;
    const p = me().st;
    p.x += d.dx * step;
    p.z += d.dz * step;
    // (a roll: head over heels along the way, once, head first the way
    // you're going; kept here for place(), which sets the body's turn
    // afresh every frame)
    d.roll = Math.PI * 2 * k * (d.dx * Math.sin(p.yaw) + d.dz * Math.cos(p.yaw) >= 0 ? 1 : -1);
    return at.safe;
  }
  // the ring over the one you're squared up to: a thin additive ring at
  // their chest, facing you, breathing; in your blade's (or bolt's) colour
  const lockRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
  lockRing.visible = false;
  lockRing.renderOrder = 6;
  scene.add(lockRing);
  const lockTicks = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.62, 4, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false }));
  lockRing.add(lockTicks);
  function stepLockRing(dt) {
    const t = state.lock;
    if (!t || t.down || state.phase !== 'walk') {
      lockRing.visible = false;
      return;
    }
    lockRing.visible = true;
    const q = t.holder.position;
    const tall = (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1);
    lockRing.position.set(q.x, q.y + tall * 0.55, q.z);
    lockRing.lookAt(camera.position);
    const breath = 1 + 0.06 * Math.sin(state.t * 5);
    lockRing.scale.setScalar(Math.max(0.6, tall * 0.5) * breath);
    lockTicks.rotation.z += dt * 0.8;
    lockRing.material.color.set(me().spec.bolt ?? '#ffffff');
    lockTicks.material.color.copy(lockRing.material.color);
  }
  // the lock-on (./surfaceLockOn.js): the camera kept on the lock while it's on
  const lockOn = createSurfaceLockOn({ coarse: window.matchMedia?.('(pointer: coarse)').matches ?? false, emit });
  // the one your strokes home on: the nearest in front, within LOCK
  function pickLock() {
    const p = me().st;
    let best = null;
    let bestD = LOCK.range;
    for (const t of shootable()) {
      const q = t.holder.position;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > bestD) continue;
      const off = Math.abs(wrap(Math.atan2(q.x - p.x, q.z - p.z) - state.cam.yaw));
      if (off > LOCK.cone) continue;
      best = t;
      bestD = d;
    }
    if (best !== state.lock) {
      state.lock = best;
      emit({ type: 'lock', name: best ? best.spec.kind : null });
    }
  }
  // the two abilities (G and V) the hero carries (abilityRules.js, named on
  // heroes.js): the Force for a Jedi, a detonator and the overcharge for most
  // with a gun, and each hero's own besides. Each on its own cooldown; the
  // jetpack's held instead (stepJet), and the Emperor's lightning. The 2017
  // heroes' Force powers that last or draw (a choke, lightning, a repulse, a
  // rush, a rage) are powers.js's; a push or a pull from one of them is the
  // Force's own below, at the game's reach, cone, knockback and damage
  const myAbility = (slot) => abilitiesOf(me().spec)[slot];
  // (the game's damage to a hero: a duellist's, or a named one's)
  const isHero = (t) => Boolean(t.duel || t.spec?.named || t.spec?.hostile?.blade);
  const powers = createPowers({ scene, fx, sounds, state, me, targets: shootable, on, isHero, dealt, emit, ground: (x, z, y) => groundAt(world, x, z, y), reach: world.reach });
  function power(slot) {
    if (state.phase !== 'walk' || state.off || powers.busy()) return;
    const p = me();
    const id = myAbility(slot);
    const kind = kindOf(id);
    const a = ABILITIES[id];
    if (a.hold || state.t < state.cool[slot]) return;
    camera.getWorldDirection(camDir);
    p.st.yaw = Math.atan2(camDir.x, camDir.z);
    state.cool[slot] = state.t + a.cool * perks.cooldown;
    if (powers.cast(id, a, camDir)) {
      if (p.saber) state.saberAt = state.t;
      state.aim = 1;
      state.aimDir.copy(camDir);
      emit({ type: 'fire' });
      return;
    }
    if (kind === 'push' || kind === 'pull' || kind === 'roar') {
      // the Force, or a roar: everyone in the cone shoved (or drawn in)
      const f = kind === 'roar' ? a : forceOf(a);
      const way = kind === 'pull' ? 'pull' : 'push';
      if (p.saber) state.saberAt = state.t;
      state.aim = 1;
      state.aimDir.copy(camDir);
      if (a.game) powers.play(kind);
      let any = 0;
      for (const t of shootable()) {
        const q = t.holder.position;
        const at = forceAt(p.st, { x: q.x, z: q.z }, way, f);
        if (!at.hit) continue;
        any++;
        on(t).knock(t, pushVelocity(p.st, { x: q.x, z: q.z }, at.k, way, f));
        const n = kind === 'roar' ? 0 : hitOf(a, isHero(t));
        if (n) {
          const was = t.hp;
          on(t).hit(t, a.game ? dealt(n) : n);
          if (a.game) emit({ type: 'hit', kill: was > 0 && t.hp <= 0 });
        }
        if (kind === 'pull') on(t).stagger(t, 1.2);
        if (a.stagger) on(t).stagger(t, a.stagger);
      }
      // a rush of dust out from you (or in, for a pull)
      const from = new V(p.st.x, p.st.y + 1, p.st.z);
      for (let i = 0; i < 10; i++) {
        const an = p.st.yaw + (Math.random() - 0.5) * f.cone * 2;
        fx.sparks(from.clone().addScaledVector(new V(Math.sin(an), 0, Math.cos(an)), way === 'push' ? 1.5 + Math.random() * 4 : 3 + Math.random() * 6), new V(Math.sin(an) * (way === 'push' ? 1 : -1), 0.3, Math.cos(an) * (way === 'push' ? 1 : -1)), kind === 'roar' ? '#ffd0a0' : '#c8d8ff', 4);
      }
      if (kind !== 'roar') gameFx.push(from, new V(Math.sin(p.st.yaw), 0, Math.cos(p.st.yaw)), { colour: '#c8d8ff', pull: way === 'pull', reach: f.range ?? 6 });
      sounds.combat?.(kind === 'roar' ? 'boom' : 'force');
      state.shake = Math.min(1, state.shake + 0.25);
      if (any) state.hitstop = Math.max(state.hitstop, 0.05);
      emit({ type: 'fire' });
      return;
    }
    if (a.radius != null) {
      // something thrown: in an arc (or flat, a rocket), blowing after its fuse or when it lands
      const m = new THREE.Mesh(bombGeo, bombMat);
      m.position.set(p.st.x, p.st.y + 1.4, p.st.z).addScaledVector(camDir, 0.6);
      scene.add(m);
      state.bombs.push({ m, v: camDir.clone().multiplyScalar(a.speed).add(new V(0, a.lift, 0)), t0: state.t, spec: a });
      state.aim = 1;
      state.aimDir.copy(camDir);
      emit({ type: 'fire' });
      return;
    }
    if (kind === 'overcharge') {
      // no heat, white bolts, a harder hit for a while
      state.overcharge = state.t + a.dur;
      state.heat = { value: 0, locked: false, lockedAt: null };
      sounds.combat?.('perfect');
      return;
    }
    if (kind === 'medpack') {
      state.health = Math.min(100, state.health + a.heal);
      emit({ type: 'health', value: state.health });
      fx.flash(new V(p.st.x, p.st.y + 1, p.st.z), UP, { color: '#8dff9a', size: 0.9 });
      sounds.combat?.('perfect');
      return;
    }
    if (kind === 'sprint') {
      state.sprint = state.t + a.dur;
      sounds.combat?.('perfect');
      return;
    }
    if (kind === 'hop') {
      // a portal a few metres on, and out of it: never past the world's edge
      const to = new V(p.st.x, 0, p.st.z).addScaledVector(new V(camDir.x, 0, camDir.z).normalize(), a.reach);
      if (Math.hypot(to.x, to.z) > world.reach - 1) {
        state.cool[slot] = state.t;
        return;
      }
      const here = new V(p.st.x, p.st.y + 1, p.st.z);
      fx.flash(here, UP, { color: '#8dff5a', size: 1.4 });
      for (let k = 0; k < 8; k++) fx.sparks(here, new V((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2).normalize(), '#8dff5a', 6);
      p.st.x = to.x;
      p.st.z = to.z;
      p.st.y = groundAt(world, to.x, to.z, p.st.y + 2);
      p.st.vy = 0;
      p.st.grounded = true;
      const there = new V(p.st.x, p.st.y + 1, p.st.z);
      fx.flash(there, UP, { color: '#8dff5a', size: 1.4 });
      for (let k = 0; k < 8; k++) fx.sparks(there, new V((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2).normalize(), '#8dff5a', 6);
      sounds.combat?.('force');
      state.shake = Math.min(1, state.shake + 0.2);
      emit({ type: 'fire' });
    }
  }
  // the jetpack (held G, for a hero with one): thrust while there's fuel, the
  // tank refilled on the ground; a plume out of the back
  function stepJet(dt) {
    const p = me();
    const a = ABILITIES[myAbility('power')];
    if (!a?.hold || state.phase !== 'walk' || state.off) {
      state.jet.on = false;
      return;
    }
    const hold = Boolean(state.keys.power || state.buttons.power) && !state.dodge;
    // (the Emperor's lightning: held G too, off its own tank, powers.js's)
    if (a.kind === 'lightning') {
      camera.getWorldDirection(camDir);
      if (powers.held(a, hold && !powers.busy(), dt, camDir)) state.aimDir.copy(camDir);
      return;
    }
    jetStep(state.jet, { hold, grounded: p.st.grounded, dt });
    if (!state.jet.on) return;
    p.st.vy = Math.min(JET.lift, p.st.vy + (WALK.gravity + JET.thrust) * dt);
    if (p.st.grounded) {
      p.st.grounded = false;
      p.st.y += 0.05;
    }
    p.st.air = 0; // (no fall to land from)
    if (Math.random() < dt * 40) {
      const back = new V(-Math.sin(p.st.yaw), 0, -Math.cos(p.st.yaw));
      fx.sparks(new V(p.st.x, p.st.y + 1.2, p.st.z).addScaledVector(back, 0.3), new V(back.x * 0.3, -1, back.z * 0.3), Math.random() < 0.5 ? '#ffd36b' : '#ff8a3d', 2);
    }
    state.aim = Math.max(state.aim, 0.4);
  }
  const bombGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const bombMat = new THREE.MeshStandardMaterial({ color: '#8a9aa8', emissive: new THREE.Color('#ff3b30'), emissiveIntensity: 1.2, metalness: 0.7, roughness: 0.3 });
  function stepBombs(dt) {
    for (let i = state.bombs.length - 1; i >= 0; i--) {
      const b = state.bombs[i];
      b.v.y -= 14 * dt;
      b.m.position.addScaledVector(b.v, dt);
      b.m.rotation.x += dt * 9;
      const g = groundAt(world, b.m.position.x, b.m.position.z, b.m.position.y + 0.5);
      const age = state.t - b.t0;
      bombMat.emissiveIntensity = 1 + Math.sin(age * 20) * 0.8;
      const spec = b.spec ?? ABILITIES.detonator;
      if (b.m.position.y > g + 0.1 && age < spec.fuse) continue;
      // the blast: everyone within its radius hurt by how close they are, shoved off their feet
      const at = b.m.position.clone();
      at.y = Math.max(at.y, g + 0.3);
      scene.remove(b.m);
      state.bombs.splice(i, 1);
      for (const t of shootable()) {
        const q = t.holder.position;
        const d = Math.hypot(q.x - at.x, q.z - at.z);
        if (d > spec.radius) continue;
        const k = 1 - d / spec.radius;
        const was = t.hp;
        on(t).hit(t, Math.max(1, Math.round(spec.damage * (0.4 + 0.6 * k))), { breaks: true });
        on(t).knock(t, { vx: ((q.x - at.x) / Math.max(0.3, d)) * 8 * k, vz: ((q.z - at.z) / Math.max(0.3, d)) * 8 * k, vy: 4 * k });
        emit({ type: 'hit', kill: was > 0 && t.hp <= 0 });
      }
      const you = me().st;
      const dYou = Math.hypot(you.x - at.x, you.z - at.z);
      if (dYou < spec.radius * 0.8 && !state.dodge) hurt(Math.round(30 * (1 - dYou / spec.radius)), { x: at.x, z: at.z });
      // (your mate too, if it's close: as hard, by how close)
      const mt = other().st;
      const dMate = Math.hypot(mt.x - at.x, mt.z - at.z);
      if (dMate < spec.radius * 0.8) mateHit(Math.round(30 * (1 - dMate / spec.radius)), { x: at.x, z: at.z });
      heardBy(at, null, 'boom');
      for (let k = 0; k < 6; k++) fx.sparks(at, new V((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2).normalize(), k % 2 ? '#ffd36b' : '#ff6a3d', 14);
      fx.flash(at, UP, { color: '#ffb060', size: 1.6 });
      if (!gameFx.explode(at, 'grenade')) fx.scorch(at, UP);
      sounds.combat?.('boom');
      state.shake = Math.min(1, state.shake + 0.6 * Math.max(0.3, 1 - dYou / 30));
      state.hitstop = Math.max(state.hitstop, 0.06);
    }
  }
  // the vent (R, with a gun): empties the heat early, or, locked, the
  // sweet spot clears it at once and early jumps half of it
  function ventGun() {
    const w = weapon();
    const was = state.heat;
    const r = vent(state.heat, state.t);
    state.heat = { value: r.value, locked: r.locked, lockedAt: r.lockedAt };
    if (r.perfect) sounds.combat?.('perfect');
    else if (!r.locked && was.value > 0) sounds.combat?.('vent');
    emit({ type: 'vent', perfect: Boolean(r.perfect), weapon: w.name });
  }
  function throwSaber() {
    const p = me();
    if (!p.saber || state.phase !== 'walk') return;
    camera.getWorldDirection(camDir);
    p.st.yaw = Math.atan2(camDir.x, camDir.z);
    state.aim = 1;
    state.aimDir.copy(camDir);
    state.saberAt = state.t;
    // (Vader's and Maul's own, at the game's speed, hit and recharge; anyone else's as it always was)
    const own = SABER_THROWS[p.spec.id];
    if (own && (state.t < state.throwCool || powers.busy())) return;
    const how = throwOf(own, SABER.throw);
    if (!p.saber.throw(state.t, camDir, how)) return;
    if (own) {
      state.throwCool = state.t + how.cool * perks.cooldown;
      powers.play('saberThrow');
    }
    emit({ type: 'fire' });
  }
  // the blade through one of them: their blade turns it (sparks, a clash)
  // or it lands
  function saberHit(t, damage, at, { heavy = false, thrown = false } = {}) {
    // their blade on yours: turned while it's up (each turned stroke drains
    // their guard, a heavy one breaks it and they reel); parried, you reel
    const turn = thrown ? { parried: false, broke: false } : on(t).parry(t, { heavy });
    fx.sparks(at, UP, turn.parried ? '#ffffff' : (me().spec.bolt ?? '#ffffff'), turn.parried ? 16 : heavy ? 22 : 10);
    sounds.saber?.('clash');
    if (turn.broke) {
      sounds.combat?.('parry');
      emit({ type: 'parry', theirs: true });
      state.hitstop = Math.max(state.hitstop, 0.1);
    }
    if (turn.parried) {
      t.flinch = 0.2;
      // your guard takes some of it
      state.guard = guardHit(state.guard, 12, state.t);
      state.hitstop = Math.max(state.hitstop, turn.perfect ? 0.12 : 0.04);
      if (turn.perfect) {
        // (theirs a parry: your stroke stopped, you reeling, open to their riposte)
        me().saber.cancel();
        state.reelUntil = state.t + DUEL.stagger.parried;
        state.shake = Math.min(1, state.shake + 0.3);
        sounds.combat?.('parry');
      }
      return;
    }
    const was = t.hp;
    // (an exposed weakness, Dooku's: the game's more from every stroke while it lasts)
    on(t).hit(t, Math.round(dealt(damage) * takenOf(t, state.t)), { breaks: heavy, at });
    if (heavy) on(t).stagger(t, 1.2);
    const killed = was > 0 && t.hp <= 0;
    emit({ type: 'hit', kill: killed });
    sounds.combat?.(killed ? 'kill' : 'hit');
    state.hitstop = Math.max(state.hitstop, hitStop(damage, killed));
    state.shake = Math.min(1, state.shake + (heavy ? 0.2 : 0.08));
  }
  // the blade lit while there's fighting, out again once it's quiet; held up while C is
  function stepSaber(dt) {
    const p = me();
    const sab = p.saber;
    if (!sab) {
      // a gun: its heat cooling, its burst, the vent on R
      const w = weapon();
      state.heat = heatStep(state.heat, dt, w, state.t);
      stepBurst();
      if (state.throwQueued) ventGun();
      return;
    }
    // the guard: regrowing, or staggered while it's broken
    const wasBroken = state.guard.brokenAt != null;
    state.guard = guardStep(state.guard, dt, state.t, guardMax);
    if (!wasBroken && state.guard.brokenAt != null) {
      sounds.combat?.('broken');
      state.shake = Math.min(1, state.shake + 0.5);
    }
    const broken = state.guard.brokenAt != null;
    // (a press that went down and up inside one frame, a quick click, still raises it: saber.js holds it up for the parry window)
    const tapped = state.blockAt != null && state.t - state.blockAt <= dt;
    const blocking = Boolean(state.keys.block || state.buttons.block || tapped) && state.phase === 'walk' && !broken && !state.dodge && state.t >= state.reelUntil;
    sab.block(blocking, blocking ? incomingAt(activity.targets, p.st) : null); // (on the side the nearest duellist's cut comes in on)
    if (blocking) state.saberAt = state.t;
    // F held: the heavy stroke winding up; let go: the stroke
    if (state.pressAt != null && !sab.busy) sab.setCharge(Math.min(1, (state.t - state.pressAt) / HEAVY.hold));
    else sab.setCharge(0);
    if (state.swingQueued) {
      swing(state.swingQueued === 'heavy');
      state.swingQueued = null;
    }
    // (touch: the Swing button held past the hold is the heavy one too)
    if (state.buttons.fire && state.pressAt == null) state.pressAt = state.t;
    if (!state.buttons.fire && !state.keys.fire && state.pressAt != null && state.touchPress) {
      swing(state.t - state.pressAt >= HEAVY.hold);
      state.pressAt = null;
      state.touchPress = false;
    }
    if (state.throwQueued) throwSaber();
    if (sab.lit && state.t - (state.saberAt ?? -99) > SABER_IDLE && !sab.busy) sab.light(false);
    if (blocking || sab.busy) state.aim = Math.max(state.aim, 0.6);
  }
  // the combat HUD's numbers, a few times a second
  function stepHud() {
    if (state.t - state.hudAt < HUD_EVERY) return;
    state.hudAt = state.t;
    const p = me();
    const w = p.saber ? null : weapon();
    const ab = abilitiesOf(p.spec);
    const lock = state.lock && !state.lock.down ? state.lock : null;
    looker.send();
    emit({
      type: 'combat',
      saber: Boolean(p.saber),
      stance: p.saber ? p.saber.stance.name : null,
      weapon: w ? w.name : null,
      guard: p.saber ? state.guard.value / guardMax : null,
      broken: state.guard.brokenAt != null,
      heat: w ? state.heat.value : null,
      locked: state.heat.locked,
      vent: w ? ventSpot(state.heat, state.t) : null,
      hot: state.t < state.overcharge,
      // (the abilities: named, their cooldowns, and a held one's tank as how much is spent)
      powers: { power: ABILITIES[ab.power].name, second: ABILITIES[ab.second].name, hold: Boolean(ABILITIES[ab.power].hold) },
      cool: { power: ABILITIES[ab.power].hold ? Math.max(0, 1 - state.jet.fuel / holdOf(ABILITIES[ab.power]).tank) * HOLD_FULL : Math.max(0, state.cool.power - state.t), second: Math.max(0, state.cool.second - state.t), dodge: Math.max(0, state.dodgedAt + DODGE.cool * perks.dodge - state.t) },
      cools: { power: ABILITIES[ab.power].hold ? HOLD_FULL : ABILITIES[ab.power].cool * perks.cooldown, second: ABILITIES[ab.second].cool * perks.cooldown, dodge: DODGE.cool * perks.dodge },
      lock: lock ? { name: lock.spec.kind, hp: Math.max(0, lock.hp), max: lock.spec.hp ?? 1, shield: lock.shield } : null,
      ads: state.ads,
    });
  }
  // the shot fired with the gun up: out of the muzzle, a flash, smoke and
  // brass from a powder gun, the gun's own sound, the view kicked a touch
  function shot() {
    const o = state.shot;
    state.shot = null;
    const p = me();
    if (!o || !p.gp) return;
    const r = p.gp.fire();
    const w = weapon();
    const hot = state.t < state.overcharge;
    const n = w.pellets ?? 1;
    let hit = null;
    for (let i = 0; i < n; i++) {
      const h = blaster.fire(o.from, scatter(o.dir, w), shootable(), hot ? '#ffffff' : boltOf(p), w.range, r.muzzle, { yours: true, damage: Math.max(1, Math.round((w.damage + (hot ? 1 : 0)) / (n > 1 ? 2 : 1))), how: w.kind, push: o.dir.clone() });
      groundWar.passed(o.from, h.at);
      hit ??= h;
    }
    activity.heard({ x: o.from.x, z: o.from.z }, { x: o.from.x + o.dir.x * 40, z: o.from.z + o.dir.z * 40 }); // (as for an unrigged shot in fire())
    heardBy(o.from, { x: o.from.x + o.dir.x * 40, z: o.from.z + o.dir.z * 40 });
    const spec = p.gp.spec;
    const out = hit.at.clone().sub(r.muzzle).normalize();
    fx.flash(r.muzzle, out, spec.flash);
    if (spec.smoke) fx.smoke(r.muzzle, out, spec.smoke);
    if (spec.casing && r.eject) fx.casing(r.eject, new V(-1, 0, 0).transformDirection(r.gun.matrixWorld), UP);
    if (!reduced) state.kick.v += spec.kick.up * (w.kick ?? 1) * (state.ads ? 0.6 : 1);
    gunSound(p.spec.gun);
    emit({ type: 'fire' });
  }
  // the bolts in flight on the one step (boltPlay): what each hit, as it
  // gets there; your raised blade turns theirs home
  function stepBolts(dt) {
    const up = (state.phase === 'walk' || state.phase === 'ride') && !state.off;
    const p = me();
    boltPlay.step(dt, {
      you: up && !state.safe ? p.st : null,
      mate: state.phase === 'walk' && mateFight.down === 0 ? other().st : null,
      allies: ctx.effects?.side ? [ctx.effects.side] : [],
      targets: assaultOn() ? assault.targets : activity.targets,
      guard: up && p.saber ? p.saber.guard() : null, // (the raised blade itself, while the block shows: saber.js)
    }, {
      yours(e) {
        const t = e.body.ref;
        const tag = e.bolt.tag ?? {};
        const hit = { target: t, at: new V(...e.at) };
        if (tag.yours) {
          struck(hit, tag.damage, { how: tag.how, push: tag.push });
          impacts.push({ t: state.t, at: hit.at, dir: new V(...e.bolt.dir), ground: false });
        } else if (tag.mate) on(t).hit(t, 1, { push: tag.push, at: hit.at });
        else if (tag.friend && !t.down) on(t).hit(t, e.bolt.damage);
      },
      // (theirs turned home by your blade: what it was fired with, theirs to take)
      home: (e) => struck({ target: e.body.ref, at: new V(...e.at) }, e.damage, { how: 'deflect', push: new V(...e.bolt.dir) }),
      hurt: (n, from) => hurt(n, from),
      mate: (n, from) => mateHit(n, from),
      // (theirs into a friend of yours; a battle counts its own)
      other(e) {
        const t = e.body.ref;
        if (t && !t.down && !assaultOn()) on(t).hit(t, e.bolt.damage);
      },
      deflect(e) {
        fx.sparks(new V(...e.at), UP, '#ffffff', 10);
        sounds.saber?.('deflect');
        state.saberAt = state.t;
        // (each bolt turned costs a little guard)
        if (me().saber) state.guard = guardHit(state.guard, 7 * me().saber.stance.cost * perks.deflect, state.t);
      },
      landed(e) {
        if (e.bolt.tag?.yours) impacts.push({ t: state.t, at: new V(...e.at), dir: new V(...e.bolt.dir), ground: (e.normal?.[1] ?? 1) > 0.7, normal: e.normal ? new V(...e.normal) : null, surface: e.surface, speed: e.bolt.speed });
      },
    });
  }
  // where a shot lands, as the bolt gets there (stepBolts): sparks off it, and on the ground a burn;
  // where the world's surfaces are known, as what it struck takes a bolt (snow puffs, metal sparks)
  const impacts = [];
  function stepImpacts() {
    for (let i = impacts.length - 1; i >= 0; i--) {
      const o = impacts[i];
      if (state.t < o.t) continue;
      impacts.splice(i, 1);
      const p = me().st;
      const near = 1 - Math.min(1, Math.hypot(o.at.x - p.x, o.at.z - p.z) / 40);
      if (near > 0) impactSound(Math.max(0.15, near));
      const pick = surfaces && o.surface ? impactOf(surfaces, { tag: tagOf(site.materials, o.surface), speed: o.speed, by: 'blaster' }) : null;
      const look = landingLook(pick?.family, { ground: o.ground });
      const colour = look.spark === 'bolt' ? (me().spec.bolt ?? '#ffd0a0') : look.spark;
      let n;
      if (o.ground) {
        n = world.normalAt ? new V(...world.normalAt(o.at.x, o.at.z)) : UP.clone();
        o.at.y = groundAt(world, o.at.x, o.at.z, o.at.y + 0.5);
        if (look.sparks) fx.sparks(o.at, n.clone().addScaledVector(o.dir, -0.6).normalize(), colour, look.sparks);
      } else {
        n = o.normal ?? o.dir.clone().negate();
        if (look.sparks) fx.sparks(o.at, o.dir.clone().negate(), colour, look.sparks);
      }
      // (lane F's game marks and chunks by the family the grid picked, where the bucket has them; the site's scorch and dust where not)
      const drawn = gameFx.impact(o.at, n, { ground: o.ground, colour: me().spec.bolt, family: pick?.family ?? null });
      if (look.scorch && !drawn.mark) fx.scorch(o.at, n);
      if (look.smoke) fx.smoke(o.at, n, look.smoke);
      if (look.kick && !drawn.debris) for (let k = 0; k < look.kick.n; k++) kick(o.at.x, o.at.y - 0.2, o.at.z, look.kick.spread, look.kick.up);
      if (pick) {
        picks.push({ family: pick.family, effect: pick.effect, decal: pick.decal, ground: o.ground, at: o.at.toArray().map((v) => +v.toFixed(1)) });
        if (picks.length > 8) picks.shift();
      }
    }
  }
  // `from`: where it came from ({ x, z }), for the way you flinch and fall
  // (else the last shot's at you)
  function hurt(n, from = null) {
    // (in a rage: its shield takes it first, the rest by the game's multiplier)
    if (state.rage) n = powers.soaked(n);
    state.health = Math.max(0, state.health - n * perks.hurt);
    state.hurtAt = state.t;
    state.shake = Math.min(1, state.shake + 0.3);
    if (from) state.hitFrom = from;
    emit({ type: 'health', value: state.health });
    // (a flinch, the chest or the head: on the upper layer while you move,
    // cut by what you do next; an emote's over)
    if (state.emote) endEmote();
    if (state.health > 0 && !state.dodge) reactYou('hit', { where: Math.random() < 0.3 ? 'head' : 'chest' });
    if (state.health > 0) return;
    // in a battle: down where you fell, and the HUD asks where to deploy
    if (assaultOn() && !state.off) {
      state.off = 'down';
      state.fallen = 0.001;
      assault.youDown();
      emit({ type: 'down' });
      return;
    }
    if (chaseOn()) {
      state.health = 100;
      emit({ type: 'health', value: 100 });
      chase.knocked();
      return;
    }
    if (runOn()) {
      state.health = 100;
      emit({ type: 'health', value: 100 });
      endMission('lost', 'down');
      return;
    }
    // down: back on your feet where the quest's step began (or by the ship)
    state.health = 100;
    emit({ type: 'health', value: 100 });
    emit({ type: 'down' });
    if (state.quest) {
      state.quest = { ...state.quest, count: 0, time: 0 };
      const q = questOf(state.quest.id);
      activity.show(null, null);
      activity.show(q, state.quest);
      announce();
    }
    const p = me().st;
    const step = state.quest && questOf(state.quest.id)?.steps[state.quest.step];
    // (inside a zone too: at its door in, not where you fell; respawn.js)
    const [dx, dz, dyaw] = downAt({ step, zone: state.zone, spawn: spawnAt });
    putAt(p, dx, dz, dyaw ?? undefined);
    if (dyaw != null) state.cam.yaw = dyaw;
    camInit = false;
  }

  // loose crates and barrels by the site's stacks, for you to shove and a
  // speeder to scatter (knocks.js): each hit a thud there, a puff, a nudge
  const knockDust = createDust({ count: 48, size: 0.9 });
  scene.add(knockDust.mesh);
  const knockHits = wireImpacts({
    dust: knockDust,
    shake: (k) => feel.trauma(k),
    listener: () => ({ position: camera.position.toArray(), forward: camera.getWorldDirection(new V()).toArray() }),
    toWorld: (at) => (Array.isArray(at) ? at : [at.x, at.y, at.z]),
  });
  let knocks = null;
  createKnocks({ parent: scene, dev: device(), impacts: knockHits, places: loosePlaces(site.things, (x, z) => groundAt(world, x, z)), ground: (x, z) => groundAt(world, x, z), things: site.things })
    .then((k) => {
      if (disposed) k.dispose();
      else knocks = k;
    })
    .catch(() => {});

  // ── Each frame ──
  const tmp = new V();
  const flash = { k: 0 };

  function input() {
    const k = state.keys;
    // (down, or choosing off the emote wheel: the keys and the stick point at
    // its slices, and go on doing nothing till they're let go)
    if (state.off || emotes.open || state.wheelKeys) return { x: 0, y: 0, run: false, heading: state.cam.yaw };
    let x = (k.right ? 1 : 0) - (k.left ? 1 : 0) + state.stick.x;
    let y = (k.up ? 1 : 0) - (k.down ? 1 : 0) + state.stick.y;
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    const run = Boolean(k.run || state.buttons.run || Math.hypot(state.stick.x, state.stick.y) > 0.92);
    const crouch = Boolean(k.crouch || state.buttons.crouch);
    return { x, y, run, crouch, heading: state.cam.yaw };
  }

  function stepLanding(dt) {
    state.age += dt;
    const k = clamp(state.age / LAND.descend, 0, 1);
    const e = ease(k);
    // along, and down (most of the drop near the end)
    const pos = shipFrom.clone().lerp(shipLanded, e);
    pos.y = shipLanded.y + (shipFrom.y - shipLanded.y) * (1 - k) ** 2.2;
    shipHolder.position.copy(pos);
    shipTilt.rotation.x = (1 - k) * 0.12 - Math.sin(k * Math.PI) * 0.05 + (k > 0.85 ? (k - 0.85) * -0.6 : 0);
    shipTilt.rotation.z = Math.sin(state.age * 0.9) * 0.03 * (1 - k);
    ship.setThrottle?.(0.3 + (1 - k) * 0.7);
    engineOn((1 - k) * 60 + 8);
    // dust as it comes in over the ground
    const over = pos.y - groundAt(world, pos.x, pos.z);
    if (over < 30) for (let i = 0; i < 3; i++) kick(pos.x, groundAt(world, pos.x, pos.z), pos.z, 14 * (1 - over / 30) + 2, 3);
    if (state.age >= LAND.descend + LAND.settle) {
      state.phase = 'out';
      state.age = 0;
      shipHolder.position.copy(shipLanded);
      shipTilt.rotation.set(0, 0, 0);
      ship.park?.(true);
      engine?.set({ speed: 0, on: false });
      solidShip();
      for (const p of people) p.holder.visible = true;
      emit({ type: 'phase', phase: 'out' });
    }
  }

  function stepLeaving(dt) {
    state.age += dt;
    const k = clamp(state.age / LEAVE.lift, 0, 1);
    const lift = ease(k) * 26;
    const away = Math.max(0, state.age - LEAVE.lift);
    const fwd = new V(Math.sin(site.land.yaw), 0, Math.cos(site.land.yaw));
    shipHolder.position.copy(shipLanded).add(new V(0, lift + away * away * 22, 0)).addScaledVector(fwd, away * away * 60);
    shipTilt.rotation.x = -Math.min(0.5, away * 0.35);
    ship.setThrottle?.(0.6 + Math.min(1, away));
    engineOn(20 + away * 60);
    if (lift < 20) for (let i = 0; i < 3; i++) kick(shipLanded.x, shipLanded.y, shipLanded.z, 16 - lift * 0.5, 3);
    if (state.age > LEAVE.lift + LEAVE.away && !state.left) {
      state.left = true;
      emit({ type: 'leave' });
    }
  }

  function stepWalk(dt) {
    const inp = input();
    const p = me().st;
    const safe = stepDodge();
    state.safe = safe;
    // (a sprint: abilityRules.js's, the walk and the run both quicker)
    const rules = state.t < state.sprint ? { ...WALK, walk: WALK.walk * ABILITIES.sprint.speed, run: WALK.run * ABILITIES.sprint.speed } : WALK;
    const intent = state.dodge ? { x: 0, y: 0, run: false, heading: inp.heading, jump: false } : { ...inp, jump: state.jumpPress };
    // (on a level with the game's shapes in an engine: the 2017 soldier's body, playerBody.js)
    if (body && body.state !== p) body = bodyFor(p);
    const o = body ? body.step(intent, dt) : walk(p, intent, dt, world, rules);
    stepJet(dt);
    life.shove(p, WALK.radius);
    // (and out of whatever's parked: a speeder, a tauntaun)
    for (const x of rides) {
      const dx = p.x - x.state.x;
      const dz = p.z - x.state.z;
      const d = Math.hypot(dx, dz);
      const min = x.spec.radius * 0.8 + WALK.radius;
      if (d < min && d > 1e-6) {
        p.x = x.state.x + (dx / d) * min;
        p.z = x.state.z + (dz / d) * min;
      }
    }
    if (o.bumped && Math.hypot(p.x, p.z) > world.reach - 1 && state.t - state.edgeAt > 8) {
      state.edgeAt = state.t;
      emit({ type: 'edge' });
    }
    // over the edge: back where you landed (in a place with a drop in it,
    // a zone with `fall`, back at its respawn, or where you came in)
    const z = state.zone;
    const fallAt = z?.inside.fall != null ? z.origin[1] + z.inside.fall : z ? null : site.fall;
    if (fallAt != null && p.y < fallAt) {
      const [bx, bz] = z ? [z.origin[0] + (z.inside.respawn ?? z.inside.spawn ?? [0, 0])[0], z.origin[2] + (z.inside.respawn ?? z.inside.spawn ?? [0, 0])[1]] : spawnAt;
      p.x = bx;
      p.z = bz;
      p.y = z ? groundAt(world, bx, bz, z.origin[1] + (z.inside.bounds?.[2] ?? 30), 0) : groundAt(world, bx, bz);
      p.vy = 0;
      if (z) p.yaw = z.inside.yaw ?? 0;
      emit({ type: 'fell' });
    }
    // your crewmate keeps up: a step behind, beside you (or lies where it
    // went down, a while)
    stepMate(dt);
    const q = other().st;
    const behind = new V(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const side = new V(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const goal = [p.x + behind.x * 1.1 + side.x * 1.7, p.z + behind.z * 1.1 + side.z * 1.7];
    const gd = Math.hypot(goal[0] - q.x, goal[1] - q.z);
    const lying = mateFight.down > 0;
    if (gd > 40 && !lying) {
      q.x = goal[0];
      q.z = goal[1];
      q.y = groundAt(world, q.x, q.z);
    }
    const toward = gd > 0.8 ? Math.atan2(goal[0] - q.x, goal[1] - q.z) : q.yaw;
    const mag = gd > 0.8 && !lying ? clamp((gd - 0.6) / 2, 0, 1) : 0;
    const wasYaw = q.yaw;
    walk(q, { x: 0, y: mag, heading: toward, run: gd > 7, jump: false }, dt, world);
    // its body to what it's doing, never your yaw: square to what it
    // fights (stepping sideways or back to keep up, short of a run); stood
    // still, round to what it's looking at once that's well off its facing
    // (its head takes the rest)
    const foe = mateFight.foe;
    if (lying) q.yaw = wasYaw;
    else if (foe && gd <= 7) q.yaw = turnToward(wasYaw, Math.atan2(foe.holder.position.x - q.x, foe.holder.position.z - q.z), dt * 5);
    else if (mag === 0) {
      const g = mateFight.gaze;
      const want = Math.atan2(g.x - q.x, g.z - q.z);
      const off = Math.abs(wrap(want - q.yaw));
      // (once it's turning, all the way round, not to the edge of AWAY and stuck there)
      if (Math.hypot(g.x - q.x, g.z - q.z) < 0.5 || off < 0.15) mateFight.turning = false;
      else if (off > AWAY) mateFight.turning = true;
      if (mateFight.turning) q.yaw = turnToward(q.yaw, want, dt * 2);
    } else mateFight.turning = false;
    // footprints and marks (as deep as the ground's material prints, where it's known), and footsteps
    const print = surfaces ? groundPrint : DAB;
    if (p.grounded && p.speed > 0.5 && print && site.ground.palette.mark && r() < dt * 6) marks.dab(p.x, p.z, print.r, print.k);
    if (p.grounded) {
      strode += p.speed * dt;
      const stride = p.speed > WALK.walk + 1 ? 1.25 : 0.8;
      if (strode > stride) {
        strode = 0;
        sounds.step(p.speed > WALK.walk + 1 ? 1.3 : 1);
      }
    }
    if (o.landed > 3) sounds.step(1.6);
    squash.land(o.landed);
  }

  function stepRide(dt) {
    const x = state.riding;
    const inp = chase?.stalled() ? { x: 0, y: 0, run: false } : input();
    // (a flyer climbs while jump is held, not only on the press)
    const o = ride(x.state, { ...inp, x: inp.x, y: inp.y, jump: x.spec.fly ? Boolean(state.keys.jump) : state.jumpPress }, dt, world, x.spec);
    if (o.hit > 20 && chaseOn()) chase.knocked();
    if (o.hit > 6) {
      state.shake = Math.min(1, o.hit / 20);
      emit({ type: 'bump', hard: o.hit > 14, speed: o.hit });
    }
    // you, on it
    const p = me().st;
    p.x = x.state.x;
    p.z = x.state.z;
    p.y = x.state.y;
    p.yaw = x.state.yaw;
    // dust behind a fast one, a trail where it marks the ground
    const fast = Math.abs(x.state.speed);
    if (fast > 6 && x.spec.hover > 0 && r() < dt * fast * 0.6) kick(x.state.x, groundAt(world, x.state.x, x.state.z), x.state.z, 3, 1.4);
    if (x.spec.trail && fast > 2) marks.dab(x.state.x, x.state.z, 2.4, Math.min(0.5, fast / 40));
    // your crewmate waits where you got on
    stepMate(dt);
    const q = other().st;
    walk(q, { x: 0, y: 0, heading: q.yaw }, dt, world);
  }

  // Sat on (or got off) what you ride: a vehicle's driving seat (the
  // library's `drive`, the hands on its controls), a creature's back (`sit`,
  // the figure's own or the UAL's); a figure with neither keeps the old
  // stand-in, stood in the seat
  function seatOn(pp, ride) {
    const was = pp.seat;
    pp.seat = null;
    if (!ride) {
      if (was) pp.fig.base?.(null)?.catch?.(() => {});
      return;
    }
    const seat = { lift: null, base: ride.spec.hover > 0 || ride.spec.fly ? 'drive' : 'sit' };
    pp.seat = seat;
    const sat = (name) =>
      pp.fig.base?.(name)?.then?.((r) => {
        // (no driving clip for it: sat on it as on anything else)
        if (r === 'cut' && pp.seat === seat && name === 'drive' && pp.fig.anim) sat('sit');
      }, () => {});
    sat(seat.base);
    // (a 2017 figure on the game's own ride: the game's driver or rider, the
    // `vehicles` pack taken as it gets on: lib/three/walrusSets/vehicles.js)
    const game = rideClip(ride.kind);
    if (game && pp.fig.takePack && richClips(detailLevel()))
      pp.fig.takePack('vehicles').then(() => {
        if (pp.seat === seat && pp.fig.clips?.[game]) pp.fig.anim?.base(game);
      });
  }
  // a ride's frame in the world, as its seat's points are measured in: its
  // holder, and a beast's step (its model's sway, actors.js) under you
  const _rideM = new THREE.Matrix4();
  const _swayM = new THREE.Matrix4();
  function rideFrame(x) {
    x.holder.updateMatrixWorld(true);
    _rideM.copy(x.holder.matrixWorld);
    const s = x.fig?.sway?.();
    if (s) _rideM.multiply(_swayM.makeRotationZ(s.roll).setPosition(0, s.y, 0));
    return _rideM;
  }
  // where its hips are over its feet as it sits (eased: they settle as the
  // clip comes in), so they're put on the seat whatever the clip's height
  function seatLift(pp, dt) {
    const hips = pp.fig?.bones?.Hips;
    if (!hips || !pp.seat) return;
    const up = hips.getWorldPosition(_hips).y - pp.holder.position.y;
    if (!Number.isFinite(up)) return;
    const want = clamp(up, 0.25, 1.1);
    pp.seat.lift = pp.seat.lift == null ? SEAT.low + SEAT.pad : pp.seat.lift + (want - pp.seat.lift) * Math.min(1, dt * 10);
  }
  // Down: the fall by the hit's way (react.js's `down`: die.fwd, die.back,
  // die.blown, else a fall, held where it ends), or with no clip for it,
  // over about the feet (place()). `from`: where the hit came from
  function fallOver(pp, from) {
    const st = pp.st;
    const dir = from ? { x: st.x - from.x, z: st.z - from.z } : null; // (the way the hit went)
    if (pp === me()) cutReaction();
    const r = pp.fig?.react?.('down', { yaw: st.yaw, force: 0.5, ...(dir ? { dir } : {}) }) ?? null;
    const ahead = dir ? dir.x * Math.sin(st.yaw) + dir.z * Math.cos(st.yaw) : -1;
    return { clip: Boolean(r), way: ahead >= 0 ? 1 : -1 };
  }

  function place(dt) {
    // what you can ride (first: whoever's on one sits where it is this frame)
    for (const x of rides) {
      const s = x.state;
      if (state.riding !== x) {
        // parked: hovering where it's left, bobbing
        s.y += (groundAt(world, s.x, s.z) + (x.spec.hover ?? 0) * 0.75 - s.y) * Math.min(1, dt * 3);
        s.bank *= 0.95;
      }
      x.holder.position.set(s.x, s.y + (x.spec.hover > 0 ? Math.sin(state.t * 2 + s.x) * 0.04 : 0), s.z);
      x.holder.rotation.set(-s.pitch, s.yaw, -s.bank, 'YXZ');
      x.fig?.update(dt, clamp(Math.abs(s.speed) / 6, 0, 1));
    }
    // the people
    people.forEach((pp, i) => {
      const st = pp.st;
      const mine = i === lead;
      pp.holder.position.set(st.x, st.y, st.z);
      pp.holder.rotation.y = st.yaw;
      if (mine) {
        squash.step(dt);
        pp.holder.scale.set(...squash.scale());
      }
      // sat on what you ride, or stood off it (the figure's base state:
      // a vehicle's controls, a creature's back)
      const riding = state.phase === 'ride' && mine;
      if (pp.fig && Boolean(pp.seat) !== riding) seatOn(pp, riding ? state.riding : null);
      // down (you in a battle, your mate shot down) or up again
      const fallen = mine ? state.fallen : mateFight.down;
      if (fallen > 0 && !riding && !pp.downed) pp.downed = fallOver(pp, mine ? state.hitFrom : mateFight.hitFrom);
      else if (!(fallen > 0) && pp.downed) {
        // (up off the ground over a moment, not snapped upright)
        if (pp.downed.clip) pp.fig?.stop?.(0.6, 'full');
        pp.downed = null;
      }
      const lying = Boolean(pp.downed?.clip);
      if (riding) {
        const x = state.riding;
        const seat = x.spec.seat;
        const yaw = x.state.yaw;
        // (on an animator, the hips put on the seat as the clip has them; else the old stand-in)
        const low = pp.seat?.lift != null ? pp.seat.lift - SEAT.pad : SEAT.low;
        pp.holder.position.set(x.state.x + seat[0] * Math.cos(yaw) + seat[2] * Math.sin(yaw), x.state.y + seat[1] - low, x.state.z - seat[0] * Math.sin(yaw) + seat[2] * Math.cos(yaw));
        // (turned, pitched and banked as it is)
        pp.holder.quaternion.copy(x.holder.quaternion);
        pp.fig?.update(dt, 0);
        pp.motion = null;
        if (pp.fig?.anim) {
          pp.holder.updateMatrixWorld(true);
          pp.fig.after?.(dt, STILL);
          // (on a ride measured for it: the hips on its seat, the hands on
          // its bars or reins, the feet on its pegs or down its flanks;
          // riders.js. Else the hips put at the seat's height, as before)
          if (!(SEATS[x.kind] && poseRider(pp.fig, pp.holder, rideFrame(x), SEATS[x.kind]))) seatLift(pp, dt);
        }
      } else {
        // (yaw first, so a tip or a roll goes about the body's own side, whichever way it faces)
        pp.holder.rotation.set(0, st.yaw, 0, 'YXZ');
        if (mine && state.fallen > 0) state.fallen += dt;
        const rolling = mine && state.dodge?.roll != null && !state.dodge.clip;
        if (pp.downed && !lying) {
          // down with no clip to fall by: over about the feet, the knees first
          // (locomotion.js's fallTurn), the way the hit sent it
          fallTurn(Math.min(1, fallen / 0.9), pp.downed.way > 0 ? AHEAD : BACK, UP, _fall);
          pp.holder.quaternion.multiply(_fall);
        } else if (rolling) {
          // rolling (X) with no roll of its own: over and over about the
          // waist, not the feet, so the head doesn't go through the ground
          const r = state.dodge.roll;
          pp.holder.rotation.x = r;
          pp.holder.position.x -= ROLL_PIVOT * Math.sin(r) * Math.sin(st.yaw);
          pp.holder.position.y += ROLL_PIVOT * (1 - Math.cos(r));
          pp.holder.position.z -= ROLL_PIVOT * Math.sin(r) * Math.cos(st.yaw);
        }
        // going which way, how fast, turning, off the ground (locomotion.js
        // works in the universe map's units: METRE to the metre)
        fwdV.set(Math.sin(st.yaw), 0, Math.cos(st.yaw));
        rightV.set(-Math.cos(st.yaw), 0, Math.sin(st.yaw));
        const turn = pp.prevYaw == null || dt <= 0 ? 0 : wrap(st.yaw - pp.prevYaw) / dt;
        pp.prevYaw = st.yaw;
        // (tucked up through a roll with no clip, knees in as in a jump)
        const air = rolling ? 0.5 : mine && state.dodge ? 0 : st.grounded ? 0 : Math.max(0, st.y - groundAt(world, st.x, st.z, st.y));
        const speed = st.vx * fwdV.x + st.vz * fwdV.z;
        const side = st.vx * rightV.x + st.vz * rightV.z;
        const hurtAt = mine ? state.hurtAt : mateFight.hurtAt;
        // (down with no clip: the knees going, under the turn over)
        const down = pp.downed && !lying ? Math.min(1, fallen / 0.9) : 0;
        const motion = { speed: speed * METRE, side: side * METRE, turn, air, hurt: Math.max(0, 1 - (state.t - hurtAt) / 0.35), knock: 0.5, down };
        // (in metres a second: what goes out online)
        const out = (pp.motion ??= { speed: 0, side: 0, turn: 0 });
        out.speed = speed;
        out.side = side;
        out.turn = turn;
        const going = clamp(st.speed / WALK.run, 0, 1);
        // (R2's own model: the same, in metres a second)
        pp.fig?.update(dt, going, pp.own ? { ...motion, speed, side } : motion);
        // (the body under a lit blade, over the clips; not over a fall, a roll or an emote of its own)
        const own = lying || (mine && (state.dodge?.clip || emoteShown));
        if (!own) pp.saber?.stand(dt, state.t, going);
        pp.holder.updateMatrixWorld(true);
        pp.fig?.after?.(dt, motion, { forward: fwdV, up: UP });
        const drop = pp.fig?.loco?.drop ?? 0;
        if (drop > 1e-7) {
          pp.holder.position.y -= drop / METRE;
          pp.holder.updateMatrixWorld(true);
        }
      }
      // the gun: up along your aim while there's shooting (your mate's at
      // what it fights), carried otherwise; put away to ride; left in the
      // hand as it is through a fall or an emote
      if (pp.gp) {
        pp.gp.gun.visible = !riding;
        if (!riding) {
          const dir = mine ? (state.aim > 0 ? state.aimDir : null) : mateFight.foe && mateFight.aim > 0 ? chestOf(mateFight.foe, _mateDir).sub(_mateFrom.set(st.x, st.y + 1.35, st.z)).normalize() : null;
          const aimK = mine ? (pp.saber?.lit ? Math.max(state.aim, 0.75) : state.aim) : mateFight.aim;
          if (!lying && !(mine && emoteShown)) pp.gp.set(dt, { aim: aimK, look: mine ? state.aim : mateFight.aim, dir, forward: fwdV.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)), up: UP });
          pp.saber?.update(dt, state.t, { forward: fwdV.set(Math.sin(st.yaw), 0, Math.cos(st.yaw)), up: UP, me: st, targets: mine ? activity.targets : [], hit: saberHit, eye: camera.position });
          if (!mine && mateFight.shoot && !lying) mateShot(pp);
        } else pp.saber?.dark(); // (put away to ride: no update reaches it, so its light goes)
      }
    });
  }

  function follow(dt) {
    const c = state.cam;
    const p = me().st;
    const riding = state.phase === 'ride';
    const focus = new V(p.x, p.y + (riding ? 1.6 : CAM.up), p.z);
    // behind you as you go, unless you've been looking round
    const moving = riding ? Math.abs(state.riding.state.speed) > 1 : p.speed > 0.6 && input().y > 0.2;
    if (moving && state.t - c.drag > 1.6) {
      const want = riding ? state.riding.state.yaw + (state.riding.state.speed < 0 ? Math.PI : 0) : p.yaw;
      c.yaw += wrap(want - c.yaw) * Math.min(1, dt * (riding ? 2.6 : 1.1));
      if (riding) c.pitch += (0.16 - c.pitch) * Math.min(1, dt * 1.5);
    }
    // down the sights: in close over the shoulder, the field narrowed by the weapon's zoom
    const adsWant = state.ads && !riding && state.phase === 'walk' && !me().saber ? 1 : 0;
    state.adsK += (adsWant - state.adsK) * (1 - Math.exp(-dt * 10));
    const zoom = me().weapon?.zoom ?? 1.4;
    const fov = rideFov(baseFov, riding ? state.riding.state.speed : 0, riding ? state.riding.spec : null, { calm: reduced }) / (1 + (zoom - 1) * state.adsK);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    const dist = (c.dist * (1 - state.adsK) + CAM.near * state.adsK) * (riding ? 1 + Math.min(0.35, Math.abs(state.riding.state.speed) / 120) : 1);
    if (state.adsK > 0.01) focus.addScaledVector(new V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)), 0.55 * state.adsK);
    const back = new V(-Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
    const want = focus.clone().addScaledVector(back, dist);
    // never under the ground
    const floor = (state.zone ? groundAt(world, want.x, want.z, p.y + 0.6, 0) : groundAt(world, want.x, want.z, want.y + 2, 4)) + 0.5;
    if (want.y < floor) want.y = floor;
    // (nor under the sea: over the wave that's there)
    if (!state.zone && water?.height) want.y = Math.max(want.y, water.height(want.x, want.z) + 0.6);
    if (!camInit) {
      camPos.copy(want);
      camLook.copy(focus);
      camInit = true;
    }
    // inside, the camera keeps inside the walls (of the room you're in,
    // where it has rooms: [x, z, hw, hd, floor, ceiling], relative to it)
    if (state.zone?.inside.bounds) {
      const o = state.zone.origin;
      const lx = p.x - o[0];
      const lz = p.z - o[2];
      const ly = p.y - o[1];
      const room = state.zone.inside.rooms?.find(([x, z, hw, hd, y0, y1]) => Math.abs(lx - x) <= hw && Math.abs(lz - z) <= hd && ly >= y0 - 0.5 && ly < y1);
      const [cx, cz, hw, hd, y0, y1, round] = room ?? [0, 0, ...state.zone.inside.bounds.slice(0, 2), 0, state.zone.inside.bounds[2]];
      if (round) {
        // (a round room: inside its circle)
        const dx = want.x - o[0] - cx;
        const dz = want.z - o[2] - cz;
        const d = Math.hypot(dx, dz);
        if (d > hw - 0.5) {
          want.x = o[0] + cx + (dx / d) * (hw - 0.5);
          want.z = o[2] + cz + (dz / d) * (hw - 0.5);
        }
      } else {
        want.x = clamp(want.x, o[0] + cx - hw + 0.4, o[0] + cx + hw - 0.4);
        want.z = clamp(want.z, o[2] + cz - hd + 0.4, o[2] + cz + hd - 0.4);
      }
      want.y = clamp(want.y, o[1] + y0 + 0.4, o[1] + y1 - 0.4);
    }
    camPos.lerp(want, 1 - Math.exp(-dt * (riding ? 9 : 12)));
    camLook.lerp(focus, 1 - Math.exp(-dt * 14));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // (out of your own eyes on foot, its arms in the game's first-person poses: firstView.js)
    if (firstView.on) {
      if (state.phase !== 'walk') firstView.leave(me().fig);
      else if (firstView.place(me().fig, c.yaw, c.pitch)) firstView.pose(me().fig, { gun: me().gp?.kind ?? null, ads: state.ads, sprint: Boolean(state.keys.run) });
    }
    if (Math.abs(state.kick.x) > 1e-4) camera.rotateX(state.kick.x * 0.04); // your own shot's kick
    // every knock this frame, as trauma (the k each had is its trauma)
    if (state.shake > 0) feel.trauma(state.shake);
    state.shake = 0;
    feel.setBaseFov(fov);
    feel.update(dt, camera);
  }

  // watching the ship come in (or go), from beside where it lands
  const watchFrom = shipLanded.clone().add(new V(Math.cos(site.land.yaw) * 38 + Math.sin(site.land.yaw) * 30, 7, -Math.sin(site.land.yaw) * 38 + Math.cos(site.land.yaw) * 30));
  watchFrom.y = Math.max(watchFrom.y, groundAt(world, watchFrom.x, watchFrom.z) + 3);
  function watch(dt, k = 1) {
    camPos.lerp(watchFrom, k);
    tmp.copy(shipHolder.position).add(new V(0, 2, 0));
    camLook.lerp(tmp, 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  let qaView = null; // (DEV: __surfaceScene.view)

  // places: found as you come near; the one you're in
  function places() {
    const p = me().st;
    let here = null;
    for (const pl of site.places) {
      const d = Math.hypot(p.x - pl.at[0], p.z - pl.at[1]);
      if (d < pl.r) {
        here = pl.id;
        if (!state.found.has(pl.id)) {
          state.found.add(pl.id);
          emit({ type: 'found', id: pl.id });
        }
        // (a quest that starts when you get there)
        const q = site.quests.find((x) => x.place === pl.id);
        if (q && !state.quest && !state.done.has(q.id)) beginQuest(q);
      }
    }
    if (here !== state.here) {
      state.here = here;
      emit({ type: 'here', id: here });
    }
  }

  // the compass: each place's mark slid along the bar to its bearing
  let compassW = 0;
  let compassT = 0;
  // (the page told only what's changed: a style written is a style the
  // browser works out again)
  const styled = new WeakMap();
  const setStyle = (m, key, v) => {
    let had = styled.get(m);
    if (!had) styled.set(m, (had = {}));
    if (had[key] === v) return;
    had[key] = v;
    m.style[key] = v;
  };
  let compassMarks = [];
  function compass() {
    const el = props.compass?.current;
    if (!el) return;
    if (!compassW || state.t - compassT > 2) {
      compassW = el.clientWidth;
      compassT = state.t;
      compassMarks = [...el.querySelectorAll('[data-id]')];
    }
    const p = me().st;
    const span = Math.PI * 0.75; // the bar's half-width, in radians
    for (const m of compassMarks) {
      const id = m.dataset.id;
      let at;
      if (id === 'quest' && chase && chaseOn()) {
        at = chase.target(p.x, p.z);
        if (!at) {
          setStyle(m, 'opacity', '0');
          continue;
        }
      } else if (id === 'quest' && assaultOn()) {
        at = assault.target(p.x, p.z);
        if (!at || state.off) {
          setStyle(m, 'opacity', '0');
          continue;
        }
      } else if (id === 'quest') {
        const q = state.quest && questOf(state.quest.id);
        const step = q?.steps[state.quest.step];
        const giver = !step && state.tracked ? life.actors.find((x) => questsOf(x.spec).includes(state.tracked)) : null;
        at = step ? (doorFor(step) ?? stepTarget(step, state.quest, actorAt)) : giver ? (giver.spec.zone && state.zone?.id !== giver.spec.zone ? site.zones.find((z) => z.id === giver.spec.zone)?.door.at : [giver.b.x, giver.b.z]) : null;
        if (!at || state.zone) {
          setStyle(m, 'opacity', '0');
          continue;
        }
      } else if (id === 'ship') at = landAt;
      else if (id === 'n') at = [p.x, p.z + 1000];
      else if (id === 'e') at = [p.x - 1000, p.z];
      else if (id === 's') at = [p.x, p.z - 1000];
      else if (id === 'w') at = [p.x + 1000, p.z];
      else at = site.places.find((q) => q.id === id)?.at;
      if (!at) continue;
      const a = wrap(Math.atan2(at[0] - p.x, at[1] - p.z) - state.cam.yaw);
      const x = (-a / span) * 0.5 * compassW;
      const on = Math.abs(a) < span;
      setStyle(m, 'transform', `translateX(${x.toFixed(1)}px)`);
      setStyle(m, 'opacity', on ? (1 - (Math.abs(a) / span) ** 3).toFixed(2) : '0');
      const d = m.querySelector('.d');
      if (d && (state.t * 4) % 1 < 0.3) d.textContent = `${Math.round(Math.hypot(at[0] - p.x, at[1] - p.z))} m`;
    }
  }

  const size = { w: 1, h: 1 };
  let shown = true;
  function render(ms, now) {
    state.frames = (state.frames ?? 0) + 1;
    tick(Math.min(0.05, ms / 1000));
    draw(now);
    return shown && !disposed;
  }

  // the world moving on by dt seconds
  function tick(dt) {
    // a hit holds the frame a moment: time runs slow through it
    if (state.hitstop > 0) {
      state.hitstop = Math.max(0, state.hitstop - dt);
      dt *= 0.12;
    }
    state.t += dt;
    gameLit?.step(dt);
    // the jump's clock: whether you stood (or your ride did) as this step began
    state.jumpPress.ground(state.phase === 'ride' ? Boolean(state.riding?.state.grounded) : state.phase === 'walk' && me().st.grounded, dt);
    const t = state.t;
    // what you're doing this frame, for your body: going somewhere, or
    // anything else (either cuts a reaction of yours, and most emotes)
    // (pressed this frame, or held: firing on, a block up, down the sights)
    const steer = input();
    const moving = Math.hypot(steer.x, steer.y) > 0.1;
    const pressed = Boolean(state.jumpPress.pending || state.actQueued || state.fireQueued || state.dodgeQueued || state.powerQueued || state.secondQueued || state.throwQueued || state.swingQueued);
    const held = Boolean(state.keys.fire || state.buttons.fire || state.keys.block || state.buttons.block || state.keys.power || state.buttons.power || state.ads);
    stepBody(moving, pressed, held);

    if (state.phase === 'landing') {
      stepLanding(dt);
      watch(dt, 1 - Math.exp(-dt * 3));
    } else if (state.phase === 'leaving') {
      stepLeaving(dt);
      watch(dt, 1 - Math.exp(-dt * 1.5));
    } else {
      if (state.phase === 'out') {
        state.age += dt;
        if (state.age > LAND.out) {
          state.phase = 'walk';
          emit({ type: 'phase', phase: 'walk' });
          if (landing.line) emit({ type: 'say', lines: [{ who: null, text: landing.line }] });
        }
      }
      if (state.phase === 'ride') stepRide(dt);
      else stepWalk(dt);
      follow(dt);
      if (state.phase === 'walk' || state.phase === 'ride') {
        const tg = target();
        state.tg = tg;
        const text = tg?.text ?? null;
        if (text !== state.prompt) {
          state.prompt = text;
          emit({ type: 'prompt', text });
        }
        if (state.actQueued) act(tg);
        places();
      }
    }
    // the blaster (F, held to keep firing)
    if ((state.fireQueued || state.keys.fire || state.buttons.fire) && (state.phase === 'walk' || (state.phase === 'ride' && chase))) fire();
    state.fireQueued = false;
    if (state.dodgeQueued) dodge();
    state.dodgeQueued = false;
    if (state.powerQueued) power('power');
    if (state.secondQueued) power('second');
    state.powerQueued = state.secondQueued = false;
    stepSaber(dt);
    state.throwQueued = false;
    stepBombs(dt);
    if (state.phase === 'walk') pickLock();
    else if (state.lock) {
      state.lock = null;
      emit({ type: 'lock', name: null });
    }
    lockOn.step(state, me().st, dt);
    stepLockRing(dt);
    stepHud();
    // the chase: on with it, and a shove when you ride into one
    if (chase && (state.phase === 'walk' || state.phase === 'ride')) {
      const b = state.riding ? state.riding.state : me().st;
      const { push } = chase.update(dt, { x: b.x, y: b.y, z: b.z, vx: b.vx ?? 0, vz: b.vz ?? 0 });
      if (push) {
        b.vx += push[0];
        b.vz += push[1];
        state.shake = Math.min(1, state.shake + 0.5);
      }
      if (state.t - chaseViewAt > 0.1) {
        chaseViewAt = state.t;
        emit({ type: 'mission', view: chase.view() });
      }
    }
    // the battle: on with it, and their bolts at you
    if (assault && state.phase === 'walk') {
      const { atYou } = assault.update(dt, state.off ? null : me().st);
      for (const s of atYou) {
        // (and where it came from, for the way you fall; one through your mate on the way hits it)
        boltPlay.enemy({ from: s.from, spread: s.spread, color: s.color, damage: s.damage }, me().st, state.t);
      }
      if (state.t - chaseViewAt > 0.1) {
        chaseViewAt = state.t;
        emit({ type: 'mission', view: assault.view() });
      }
    }
    // a quest mission's clock
    if (runOn() && (state.phase === 'walk' || state.phase === 'ride')) {
      run = tickRun(run, dt);
      if (state.t - chaseViewAt > 0.1) {
        chaseViewAt = state.t;
        emit({ type: 'mission', view: run });
      }
    }
    // the quest: its clock, where you are, what's out there for it
    if (state.quest && (state.phase === 'walk' || state.phase === 'ride')) {
      const p = me().st;
      questEvent({ type: 'tick', dt });
      questEvent({ type: 'at', x: p.x, z: p.z, riding: state.riding?.kind ?? null });
    }
    for (const ev of activity.update(dt, state.phase === 'walk' || state.phase === 'ride' ? me().st : null, state.t, { actors: actorAt, door: doorFor, swinging: swingingOf(me().saber, state.t, me().st.yaw), eye: camera.position })) questEvent(ev);
    // your blade crossing a duellist's as either strokes: sparks and the clash
    if (state.phase === 'walk')
      for (const c of activity.clashes(me().saber, state.t)) {
        fx.sparks(new V(...c.at), UP, '#ffffff', 18);
        sounds.saber?.('clash');
        state.hitstop = Math.max(state.hitstop, 0.05);
      }
    const groundShots = groundWar.update(dt, state.phase === 'walk' || state.phase === 'ride' ? me().st : null, state.t, { mate: other().st, camera });
    for (const e of groundWar.news()) if (e.text) emit({ type: 'war', what: e.type, side: e.side, text: e.text }); // (the ground war's news, for the HUD's toast)
    if (state.phase === 'walk' || state.phase === 'ride')
      for (const s of [...activity.shooters(dt, me().st, state.t), ...groundShots]) {
        // a duellist's Force: you're shoved away from it, off your feet
        if (s.force) {
          const p = me().st;
          const v = pushVelocity({ x: s.from[0], z: s.from[2] }, { x: p.x, z: p.z }, 1, 'push', { ...FORCE.push, force: s.push });
          p.vx += v.vx;
          p.vz += v.vz;
          p.vy = Math.max(p.vy, v.vy);
          p.grounded = false;
          state.shake = Math.min(1, state.shake + 0.5);
          sounds.combat?.('force');
          fx.sparks(new V(p.x, p.y + 1, p.z), UP, '#d8d0ff', 14);
          continue;
        }
        // (a blaster's shot, heard by the people about as yours are: the
        // townsfolk scatter from it, a trooper stops and looks)
        if (!s.melee) heardBy({ x: s.from[0], z: s.from[2] });
        // at a friend of yours (or by one, at a hostile): a bolt between
        // them that lands where it lands (boltPlay's other and yours); a swipe that mostly does
        if (s.at && s.victim) {
          const friend = s.who?.spec?.side === 'yours';
          if (!s.melee) blaster.shoot({ from: s.from, dir: [s.at[0] - s.from[0], s.at[1] - s.from[1], s.at[2] - s.from[2]], side: friend ? 'you' : 'them', owner: s.who ?? null, damage: s.damage, colour: friend ? '#ffb070' : '#ff4a3d', deflect: true, tag: { friend } });
          else if (Math.random() < 0.8) on(s.victim).hit(s.victim, s.damage);
          continue;
        }
        if (state.safe) continue; // (through the dodge's first moments nothing lands)
        // a melee contact (a duellist's blade swept you; a brawler's swipe
        // lands as it's decided): your block shown at their contact turns it
        // and spends your guard; begun within the window before it, a parry
        const m = s.melee ? met(s, { saber: me().saber, blockAt: state.blockAt, now: state.t, window: PARRY.window * perks.parry, guard: state.guard, cost: me().saber?.stance.cost }) : null;
        const how = m?.how ?? 'hit';
        const p = me().st;
        const spot = s.point ? new V(...s.point) : new V(p.x, p.y + 1.2, p.z);
        if (how === 'parry') {
          fx.sparks(spot, UP, '#ffffff', 26);
          sounds.combat?.('parry');
          if (s.who) on(s.who).parried?.(s.who, PARRY.stagger);
          state.hitstop = Math.max(state.hitstop, 0.12);
          state.shake = Math.min(1, state.shake + 0.3);
          state.blockAt = null;
          emit({ type: 'parry' });
          continue;
        }
        if (how === 'block') {
          // their blade on your raised one: a clash, and nothing lands, but it costs your guard
          fx.sparks(spot, UP, '#ffffff', 14);
          sounds.saber?.('clash');
          state.guard = m.guard;
          state.shake = Math.min(1, state.shake + 0.2);
          state.hitstop = Math.max(state.hitstop, 0.04);
          continue;
        }
        if (s.melee) {
          // a swipe: knocked back, away from it (a blade's cut less: it sparks on you)
          const away = Math.atan2(p.x - s.from[0], p.z - s.from[2]);
          const knock = s.blade ? 2.5 : 6;
          p.vx += Math.sin(away) * knock;
          p.vz += Math.cos(away) * knock;
          p.vy = s.blade ? 1.5 : 3;
          p.grounded = false;
          state.shake = s.blade ? 0.6 : 1;
          if (s.blade) fx.sparks(spot, UP, '#ff8a5a', 12);
          else sounds.roar?.();
          hurt(s.damage, { x: s.from[0], z: s.from[2] });
          if (!s.blade) swiped(s); // (and your mate, if it's in reach of it too: a blade cuts only what it swept)
        } else {
          // (at what it believes: a guess goes wide; none through a wall; a raised blade turns it: boltPlay)
          boltPlay.enemy({ ...s, side: s.who?.soldier?.side ?? 'them' }, me().st, state.t);
        }
      }
    stepBolts(dt);
    if (state.health < 100 && state.t - state.hurtAt > 4) {
      state.health = Math.min(100, state.health + dt * 12 * perks.regen);
      if (Math.round(state.health) % 10 === 0) emit({ type: 'health', value: Math.round(state.health) });
    }
    // the marks over whoever has a quest to give
    for (const a of life.actors) {
      if (!a.spec.quest) continue;
      const q = nextQuest(a.spec, state.done);
      let m = givers.find((g) => g.a === a);
      if (!m) {
        m = { a, sprite: new THREE.Sprite(markMat) };
        m.sprite.scale.set(0.6, 0.6, 1);
        scene.add(m.sprite);
        givers.push(m);
      }
      const on = q && !state.quest && a.fig && !a.hidden;
      m.sprite.visible = Boolean(on);
      if (on) m.sprite.position.set(a.b.x, a.holder.position.y + (a.fig.tall ?? 1.8) * (a.spec.scale ?? 1) + 0.6 + Math.sin(state.t * 3) * 0.08, a.b.z);
    }
    state.actQueued = false;
    place(dt);
    shot();
    stepImpacts();
    knocks?.step(dt, me().st, state.phase === 'ride' ? state.riding : null);
    knockHits.update(dt);
    powers.step(dt); // (a choke, a rush, the arcs and rings: powers.js)
    fx.update(dt);
    gameFx.update(dt);
    spring(state.kick, dt, 240, 22);
    state.aim = Math.max(0, state.aim - dt / 2.5);
    life.update(dt, state.phase === 'walk' ? me().st : null, state.phase === 'walk' || state.phase === 'ride' ? me().st : camera.position);
    placer.update(t, dt, me().st);
    gameLevel?.update([me().st.x, me().st.z]);
    if (!reduced) kit.tick(dt);
    grass?.update(me().st);
    wind.update(dt);
    stepDust(dt);
    storm(dt);
    // (the look's full light follows the lamps and the storms; anything that
    // came into the world without passing through warm is taken on now and
    // then)
    house.light({ sun, hemi });
    if ((state.sweep = (state.sweep ?? 0) + dt) > 2) {
      state.sweep = 0;
      house.adopt(scene);
    }
    online(dt);
    sounds.update(dt, { riding: state.phase === 'ride' ? Math.abs(state.riding.state.speed) + 1 : 0 });
    marks.flush();
    ship.update?.(t);

    // ships over
    if (!reduced && site.flyovers.length && t > nextFlight && state.phase !== 'landing') {
      flyover(site.flyovers[Math.floor(r() * site.flyovers.length)]);
      const spec = site.flyovers[0];
      nextFlight = t + (spec.every ?? 60) * (0.6 + r() * 0.8);
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.age += dt;
      f.m.group.position.addScaledVector(f.dir, f.speed * dt);
      f.m.update?.(t);
      const d = f.m.group.position.distanceTo(camera.position);
      if (!f.heard && d < 400) {
        f.heard = true;
        flybySound(f.kind);
      }
      if (f.age > f.life) {
        scene.remove(f.m.group);
        f.m.dispose?.();
        disposeTree(f.m.group);
        flights.splice(i, 1);
      }
    }
  }

  // what goes out to the others online: your two, where they are (or
  // nothing, while the ship's coming down or going), how each is moving
  // (metres and radians a second, so their feet keep pace on the others'
  // screens: peers.js) and what you're doing off the wheel
  function online(dt) {
    const net = props.net;
    if (!net) return;
    const out = state.phase === 'walk' || state.phase === 'ride' || state.phase === 'out';
    const w = (p) => ({ who: p.spec.id, x: p.st.x, y: p.st.y, z: p.st.z, yaw: p.st.yaw, speed: state.phase === 'ride' && p === me() ? state.riding.state.speed : p.st.speed, aim: p === me() ? state.aim : 0, arms: p.spec.gun ? { gun: p.spec.gun, lit: Boolean(p.saber?.lit), color: p.spec.saber?.color ?? '', stance: p.spec.saber?.stance ?? 'single', swing: Boolean(p.saber?.swinging), stroke: p.saber?.swinging?.name ?? null } : null, emote: p === me() ? emotePacket(state.emote, state.t) : null, motion: p.motion ?? null });
    net.walk?.(out ? { world: site.id, kind: shipKind, lead: w(me()), mate: w(other()), ride: state.riding?.kind ?? null } : null);
    peers.update(net, site.id, dt, camera.position);
  }

  // lightning (Kamino's storms): a flash across the sky now and
  // then, lighting everything up for a moment
  let nextBolt = 4 + r() * 6;
  function storm(dt) {
    if (!site.lightning || reduced) return;
    if (state.t > nextBolt) {
      flash.k = 1;
      nextBolt = state.t + (site.lightning.every ?? 8) * (0.4 + r() * 1.2);
    }
    flash.k = Math.max(0, flash.k - dt * (flash.k > 0.5 ? 6 : 2.5));
    // (a flicker, not a fade)
    const k = flash.k * (0.6 + 0.4 * Math.sin(state.t * 90));
    hemi.intensity = (site.light.ambient ?? 0.9) + k * (site.lightning.strength ?? 2.5);
  }

  const snapped = new V();
  function draw(now) {
    const t = state.t;
    // the sun (and its shadows) follow you about
    // (snapped to whole texels of the shadow map along its right and up, so the
    // shadows don't crawl as you walk: shadow.js)
    const focus = me().st;
    snapped.set(focus.x, focus.y, focus.z);
    const [sr, su] = snapToTexel(snapped.dot(shadowRight), snapped.dot(shadowUp), SHADOW.extent, SHADOW.map);
    const along = snapped.dot(sunDir);
    snapped.copy(sunDir).multiplyScalar(along).addScaledVector(shadowRight, sr).addScaledVector(shadowUp, su);
    sun.position.copy(snapped).addScaledVector(sunDir, 300);
    sun.target.position.copy(snapped);
    sky.update(camera, t, flash.k);
    // (whatever's come into the world since, fogged in the sky's colour before it's drawn)
    skyFog.scene(scene);
    water?.update(t, camera);
    for (const f of floaters) {
      if (Math.hypot(camera.position.x - f.x, camera.position.z - f.z) > 400) continue;
      const pose = floatPose(water.height, f.x, f.z, f.yaw, t, f.float);
      f.o.position.y = pose.y;
      f.o.rotation.set(pose.pitch, f.yaw, pose.roll, 'YXZ');
    }
    weather?.update(t, camera, world.heightAt, size.h);
    compass();
    lit?.update();
    // (DEV: a QA script's held view, __surfaceScene.view)
    if (import.meta.env.DEV && qaView) {
      camera.position.set(...qaView.from);
      camera.lookAt(...qaView.at);
    }
    const tPost = performance.now();
    post.render(size.w, size.h);
    if (import.meta.env.DEV) state.ms = { js: Math.round(tPost - now), post: Math.round(performance.now() - tPost) };
  }

  // (DEV, the effects' before-and-after shots: one fired a few metres before
  // you, in the game's look, or with { look: 'site' } the site's own alone:
  // impact.<metal|stone|snow|sand>, blast.<grenade|speeder|fighter|walker>,
  // push; `at` [x, z] puts it there instead)
  if (import.meta.env.DEV)
    window.__surface = {
      fx(name, { look = 'game', ahead = 6, colour = me().spec.bolt ?? '#ff3b30', at: spot = null } = {}) {
        const st = me().st;
        const fwd = new V(Math.sin(st.yaw), 0, Math.cos(st.yaw));
        const at = spot ? new V(spot[0], 0, spot[1]) : new V(st.x, 0, st.z).addScaledVector(fwd, ahead);
        at.y = groundAt(world, at.x, at.z);
        const game = look !== 'site';
        const [kind, which] = name.split('.');
        if (kind === 'impact') {
          fx.sparks(at, UP, colour, 12);
          if (!game || !gameFx.impact(at, UP, { ground: true, colour, surface: which }).mark) fx.scorch(at, UP);
          return true;
        }
        if (kind === 'blast') {
          const p = at.clone();
          p.y += which === 'fighter' ? 4 : 0.3;
          for (let k = 0; k < 6; k++) fx.sparks(p, new V((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2).normalize(), k % 2 ? '#ffd36b' : '#ff6a3d', 14);
          fx.flash(p, UP, { color: '#ffb060', size: 1.6 });
          if (!game || !gameFx.explode(p, which)) fx.scorch(at, UP);
          return true;
        }
        if (name === 'push') {
          // (from 1.5 m before you, out toward the spot: the camera stays behind it)
          const way = spot ? new V(at.x - st.x, 0, at.z - st.z).normalize() : fwd;
          const from = new V(st.x, st.y + 1, st.z).addScaledVector(way, 1.5);
          for (let i = 0; i < 10; i++) {
            const an = st.yaw + (Math.random() - 0.5) * 1.5;
            fx.sparks(from.clone().addScaledVector(new V(Math.sin(an), 0, Math.cos(an)), 1.5 + Math.random() * 4), new V(Math.sin(an), 0.3, Math.cos(an)), '#c8d8ff', 4);
          }
          if (game) gameFx.push(from, way, { reach: 9 });
          return true;
        }
        return false;
      },
      gameFx,
    };
  if (import.meta.env.DEV)
    window.__surfaceScene = {
      scene,
      post,
      renderer,
      // (for the QA scripts: the ground's height, and a view held from one
      // point at another, metres over the ground at each, till view(null))
      heightAt: (x, z) => world.heightAt(x, z),
      land: landAt,
      landing,
      groundWar,
      put: (x, z) => (state.phase === 'landing' || state.phase === 'out' ? (state.phase = 'walk') : null, putAt(me().st, x, z)), // (you, set down somewhere, out of the ship: the ground war's QA)
      you: () => ({ x: me().st.x, z: me().st.z, health: state.health, phase: state.phase }),
      // (a bolt of yours from one point at another, [x, y, z] each, for the QA scripts: where it lands is debug().surfaces; and the solids near a spot to aim at)
      surfaces: () => ({ level: surfaces?.level ?? null, print: groundPrint, picks: [...picks] }),
      solidsNear: (x, z, r = 60) => world.solids.near(x, z, r).map(({ type, x: sx, z: sz, r: sr, hw, hd, c, s, top, base, tag }) => ({ type, x: sx, z: sz, r: sr, hw, hd, c, s, top, base, tag })),
      shoot: (from, to) => blaster.fire(new V(...from), new V(...to).sub(new V(...from)).normalize(), [], boltOf(me()), 90, null, { yours: true, push: new V() }),
      // (a stroke now, as the button makes one, for the QA scripts: { heavy, dir, lock } as saber.js takes them)
      swing: (o = {}) => me().saber?.swing(state.t, { lock: state.lock, ...o }) ?? null,
      view(from, at) {
        qaView = from ? { from: [from[0], world.heightAt(from[0], from[2]) + from[1], from[2]], at: [at[0], world.heightAt(at[0], at[2]) + at[1], at[2]] } : null;
      },
      // (the world's people, for the QA scripts: actors.js's, with debug, find and hear)
      life,
      // (for the QA scripts: the land's light, once its things are down)
      api: {
        get ground() {
          return lit;
        },
      },
    };

  // ── The land's light, baked once its things stand on it (after Bruno
  // Simon's folio: lib/three/groundwork): every rock's, hut's and walker's
  // soft shadow and the sky's occlusion on the ground, under whichever suns
  // this world has, a bounce off the ground, a soft blob under you and your
  // crewmate, and no shadow pass ──
  let lit = null;
  // ── Ready ──
  const ready = (async () => {
    // (the props' scanned surfaces on before their shaders are made, so
    // they're made once)
    await Promise.all([placer.ready.catch(() => {}), kit.ready.catch(() => {})]);
    if (!disposed && !site.noGround) {
      const R = 170;
      lit = groundWorld({
        renderer,
        scene,
        floor: [ground],
        area: { x0: landAt[0] - R, z0: landAt[1] - R, w: R * 2, d: R * 2 },
        sun,
        // (what moves isn't baked: the folk and beasts about, the speeders)
        skip: [sky.mesh, water?.mesh, water?.glow, water?.spray, weather?.group, weather?.mesh, camera, life.group, grass?.mesh, ...rides.map((x) => x.holder)].filter(Boolean),
        movers: [...people.map((p) => ({ object: p.holder, size: [0.8, 0.8] })), ...life.actors.filter((a) => a.holder).map((a) => ({ object: a.holder, size: [1, 1] })), ...rides.map((x) => ({ object: x.holder, size: [1.4, 2.6] }))],
        shade: site.light.shade ?? site.light.ground ?? '#3a3028',
        height: world.heightAt,
        tier: small ? 'low' : 'mid',
        auto: true,
      });
      // (the grass in the floor's shadows: read where each blade stands)
      if (grass) floorShadow(grass.material, lit.mask);
    }
    // (the look over everything, after the floor's light: its shade then
    // replaces the floor's own tint, and one shadow colour reaches it all)
    if (!disposed) house.adopt(scene);
    // (the scouts' way is planned round the trees, so once they're down)
    if (!disposed) chase?.begin();
    if (!disposed && assault) {
      // (the world's own troopers out of the way of the battle's)
      life.hideKinds(mission.hideLife ?? []);
      assault.begin();
    }
    if (!disposed) beginMission();
    // (both ways the lights can be, so a door doesn't stall on new shaders: the
    // lamps lit and the sun's shadow off, as in a room, then as outdoors)
    const inside = Boolean(state.zone);
    if (site.zones.length && !disposed) {
      for (const l of lamps) l.visible = true;
      sun.castShadow = false;
      await warm(scene).catch(() => {});
      for (const l of lamps) l.visible = false;
      sun.castShadow = shadows;
      if (inside) lighting(state.zone);
    }
    if (!disposed) await warm(scene).catch(() => {});
  })();
  emit({ type: 'phase', phase: state.phase });

  // Everything sent to the graphics chip before the surface is shown
  // (the runtime runs it behind the dive, or behind the page's loading
  // screen): the floor's light baked for the sun where the first frame
  // will put it, the passes' shaders, then every picture, shader and one
  // draw of it all, a slice at a time (lib/three/gpuWork). Drawn as it
  // was, the bake held a frame for seconds on landing and the passes'
  // shaders were compiled mid-frame.
  const prepare = async (onProgress, { alive = () => true } = {}) => {
    const on = () => alive() && !disposed;
    onProgress?.(0, 'load');
    await settleWithin(ready, 20000);
    if (!on()) return;
    if (lit && !lit.stats.started) {
      onProgress?.(0, 'bake');
      sun.target.position.set(landAt[0], world.heightAt(landAt[0], landAt[1]) ?? 0, landAt[1]);
      sun.position.copy(sun.target.position).addScaledVector(sunDir, 300);
      await settleWithin(lit.bake(), 20000);
      if (!on()) return;
    }
    if (post.composer) await precompilePasses(renderer, post.composer, camera);
    if (!on()) return;
    await prepareScene({ renderer, roots: [scene], scene, camera, target: post.target, render: () => post.render(64, 64), onProgress, alive: on });
  };

  return {
    ready,
    prepare,
    resize(w, h) {
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      camera.aspect = size.w / size.h;
      baseFov = size.w < size.h ? 72 : 60;
      camera.fov = baseFov;
      camera.updateProjectionMatrix();
      compassW = 0;
    },
    render,
    update(next) {
      props = next;
      for (const id of next.found ?? []) state.found.add(id);
      for (const id of next.done ?? []) state.done.add(id);
      if (next.hero) setHero(next.hero);
    },
    setVisible(on) {
      shown = on;
    },
    // the runtime's quality: each step draws the passes less sharp (the
    // canvas keeps its size: module.js's `sharpness`); still slow past the
    // last step, no sun shadow, and the post without its bloom (the grade
    // kept, so the colours stay right)
    lowerQuality(level = STEPS.length) {
      post.sharpness = STEPS[Math.min(level, STEPS.length - 1)];
      if (level < STEPS.length) return;
      shadows = false;
      sun.castShadow = false;
      post.lite();
    },
    // from the page's touch controls
    input: {
      stick(x, y) {
        state.stick.x = x;
        state.stick.y = y;
        ctx.invalidate();
      },
      look,
      // the Menu's Look (Click to lock or Drag), and the prompt's click
      lookMode(mode) {
        looker.set(mode);
        looker.send();
      },
      lookLock() {
        looker.request();
      },
      // the Lock button and L: the lock-on, on or off
      lockOn() {
        lockOn.toggle();
        ctx.invalidate();
      },
      press(name) {
        sounds.start();
        if (state.phase === 'landing') skipLanding();
        if (name === 'jump') state.jumpPress.press();
        if (name === 'act') state.actQueued = true;
        if (name === 'run') state.buttons.run = true;
        if (name === 'crouch') state.buttons.crouch = true;
        if (name === 'fire') state.buttons.fire = true;
        if (name === 'block') {
          state.buttons.block = true;
          state.blockAt = state.t;
        }
        if (name === 'throw') state.throwQueued = true;
        if (name === 'dodge') state.dodgeQueued = true;
        if (name === 'power') {
          state.powerQueued = true;
          state.buttons.power = true;
        }
        if (name === 'second') state.secondQueued = true;
        if (name === 'aim') state.ads = !state.ads;
        if (name === 'fire' && me().saber) state.touchPress = true;
        if (name === 'swap') swap();
        if (name === 'emote') {
          state.buttons.emote = true;
          emoteDown();
        }
        ctx.invalidate();
      },
      release(name) {
        if (name === 'run') state.buttons.run = false;
        if (name === 'crouch') state.buttons.crouch = false;
        if (name === 'fire') state.buttons.fire = false;
        if (name === 'block') state.buttons.block = false;
        if (name === 'power') state.buttons.power = false;
        if (name === 'emote') {
          state.buttons.emote = false;
          emoteUp();
        }
      },
      // an emote by name or its place on the wheel (lib/emote.js's EMOTES),
      // from the page's own wheel
      emote(id) {
        const got = emotes.choose(id);
        if (got) startEmote(got);
        ctx.invalidate();
      },
      // the quest list: follow one (its giver on the compass; one with
      // nobody to give it starts), or drop the one you're on
      track(id) {
        const q = questOf(id);
        if (!q || state.done.has(id)) return;
        state.tracked = id;
        if (!q.giver && !q.place && !state.quest) beginQuest(q);
      },
      // a side for the battle, and onto the field at one of its posts
      side: chooseSide,
      deploy: deployAt,
      // a mission again, from the start, on the bike
      restart() {
        if (assault) {
          // a battle again: back where you chose a side, the field cleared
          leaveZone();
          putAt(me().st, mission.start[0], mission.start[1], mission.yaw);
          state.cam.yaw = mission.yaw;
          camInit = false;
          state.off = 'choose';
          state.fallen = 0;
          state.health = 100;
          emit({ type: 'health', value: 100 });
          assault.restart();
          return;
        }
        if (!chase && !run) return;
        const p = me().st;
        leaveZone();
        if (!mission.ride) {
          // on foot, back at the start: off anything you've got on
          if (state.phase === 'ride') {
            state.riding.state.speed = 0;
            state.riding = null;
            state.phase = 'walk';
            state.cam.dist = CAM.dist;
            emit({ type: 'phase', phase: 'walk' });
          }
          putAt(p, mission.start[0], mission.start[1], mission.yaw);
          state.cam.yaw = mission.yaw;
          camInit = false;
          state.health = 100;
          emit({ type: 'health', value: 100 });
          beginMission();
          return;
        }
        const x = rides[rides.length - 1];
        // (back on the mission's own ride, off any other)
        if (state.riding !== x) {
          if (state.riding) state.riding.state.speed = 0;
          state.riding = x;
          state.phase = 'ride';
          state.cam.dist = x.spec.cam[0];
          emit({ type: 'phase', phase: 'ride', kind: x.kind });
        }
        Object.assign(x.state, { x: mission.start[0], z: mission.start[1], y: groundAt(world, mission.start[0], mission.start[1]) + x.spec.hover, yaw: mission.yaw, speed: 0, vx: 0, vz: 0, vy: 0, bank: 0 });
        p.x = x.state.x;
        p.z = x.state.z;
        state.cam.yaw = mission.yaw;
        camInit = false;
        state.health = 100;
        emit({ type: 'health', value: 100 });
        if (chase) chase.restart();
        else beginMission();
      },
      drop() {
        if (!state.quest || runOn()) return;
        state.quest = null;
        activity.show(null, null);
        announce();
      },
    },
    // back to the ship and up, from anywhere outdoors on foot: true once the climb's begun
    takeOff() {
      if (state.zone || state.phase !== 'walk' || state.off) return false;
      return board();
    },
    // (for tests: the world moved on without drawing it, in steps)
    advance(secs) {
      if (!import.meta.env.DEV) return;
      for (let i = 0; i < secs * 30; i++) tick(1 / 30);
      ctx.invalidate();
    },
    // (for tests: finish the chase, 'win' or 'lose')
    missionDo(how, arg) {
      if (!import.meta.env.DEV) return null;
      if (how === 'audit') return chase?.audit() ?? null;
      if (assault) {
        // (a battle: 'side' and 'deploy' as the HUD does them, 'win' or 'lose' to end it)
        if (how === 'side') chooseSide(arg);
        else if (how === 'deploy') deployAt(arg);
        else if (how === 'win' || how === 'lose') assault.force(how);
        ctx.invalidate();
        return assault.view();
      }
      if (run) {
        // (a quest mission: 'win', 'lose', or 'skip' the step you're on)
        if (how === 'win') endMission('won');
        else if (how === 'lose') endMission('lost', 'time');
        else if (how === 'skip' && state.quest) {
          const step = mission.quest.steps[state.quest.step];
          if (step.type === 'race') for (const g of step.gates.slice(state.quest.count)) questEvent({ type: 'at', x: g[0], z: g[1], riding: step.ride });
          else if (step.type === 'use') questEvent({ type: 'use', id: step.id });
          else if (step.type === 'reach') questEvent({ type: 'at', x: step.at[0], z: step.at[1], riding: state.riding?.kind ?? null });
          else if (step.type === 'shoot') activity.kill(step.tag);
        }
        ctx.invalidate();
        return run;
      }
      // (a site's own quest, outside any mission: 'skip' the step you're on)
      if (how === 'skip' && state.quest) {
        const q = questOf(state.quest.id);
        const step = q?.steps[state.quest.step];
        if (step?.type === 'race') for (const g of step.gates.slice(state.quest.count)) questEvent({ type: 'at', x: g[0], z: g[1], riding: step.ride });
        else if (step?.type === 'use') questEvent({ type: 'use', id: step.id });
        else if (step?.type === 'reach') questEvent({ type: 'at', x: step.at[0], z: step.at[1], riding: state.riding?.kind ?? null });
        else if (step?.type === 'enter') questEvent({ type: 'enter', zone: step.zone });
        else if (step?.type === 'shoot') activity.kill(step.tag);
        ctx.invalidate();
        return state.quest;
      }
      if (how === 'near' && state.riding) {
        const b = chase?.behind();
        if (b) {
          Object.assign(state.riding.state, { x: b.x, z: b.z, yaw: b.yaw, y: groundAt(world, b.x, b.z) + state.riding.spec.hover, speed: 30, vx: Math.sin(b.yaw) * 30, vz: Math.cos(b.yaw) * 30 });
          state.cam.yaw = b.yaw;
          camInit = false;
        }
        return b;
      }
      chase?.force(how);
      ctx.invalidate();
      return null;
    },
    // (dev: the bodies, to see each without a fight: 'emote' (arg: wave,
    // cheer, dance, taunt, sit), 'hit', 'win', 'roll' (arg 'back': the
    // tumble back, else ahead, on the clip) for you; 'mateHit', 'mateDown'
    // for your mate; returns what each of you is doing)
    party(how, arg) {
      if (!import.meta.env.DEV) return null;
      // (from ten metres ahead of whoever's hit)
      const ahead = (st) => ({ x: st.x + Math.sin(st.yaw) * 10, z: st.z + Math.cos(st.yaw) * 10 });
      if (how === 'emote') startEmote(arg ?? emotes.last);
      else if (how === 'hit') hurt(arg ?? 10, ahead(me().st));
      else if (how === 'win') cheer();
      else if (how === 'roll') {
        const was = state.stick.y;
        state.stick.y = arg === 'back' ? 0 : 1;
        dodge();
        state.stick.y = was;
      }
      else if (how === 'mateHit') mateHit(arg ?? 20, ahead(other().st));
      else if (how === 'mateDown') mateHit(MATE.hp * 2, ahead(other().st));
      ctx.invalidate();
      const a = (p) => p.fig?.anim;
      return {
        emote: state.emote?.id ?? null,
        you: { full: a(me())?.playing?.('full') ?? null, upper: a(me())?.playing?.('upper') ?? null, seat: me().seat?.base ?? null },
        mate: { full: a(other())?.playing?.('full') ?? null, upper: a(other())?.playing?.('upper') ?? null, hp: Math.round(mateFight.hp), down: mateFight.down > 0, foe: Boolean(mateFight.foe), aim: +mateFight.aim.toFixed(2) },
      };
    },
    // (for tests: pretend others are down here: [{ id, name, walk }])
    fakePeers(list) {
      if (!import.meta.env.DEV) return;
      const at = performance.now();
      const net = { peers: new Map(list.map((p) => [p.id, { ...p, walk: { ...p.walk, at } }])) };
      props = { ...props, net: { ...net, walk() {} } };
    },
    // (dev: a duellist, its saber lit, `ahead` metres away `turn` radians
    // round from where you face, facing you: the duel's browser check)
    duel(kind = 'vader', { ahead = 6, turn = 0, color = '#ff3b3b', stance = 'single', hp = 99 } = {}) {
      if (!import.meta.env.DEV) return;
      const p = me().st;
      const at = [p.x + Math.sin(p.yaw + turn) * ahead, p.z + Math.cos(p.yaw + turn) * ahead];
      const spawn = { kind, at, face: p.yaw + turn + Math.PI, hp, leash: 30, roam: 1, tag: 'devduel', hostile: { range: 16, chase: 2, melee: true, reach: 2.8, every: 1.5, damage: 1, delay: 1, parry: 0.7, guard: 4, blade: { color, stance } } };
      activity.show({ id: 'dev-duel', steps: [{ type: 'shoot', tag: 'devduel', n: 1, text: 'Duel', spawn }] }, { id: 'dev-duel', step: 0 });
      ctx.invalidate();
    },
    // (for tests: put you somewhere, facing somewhere)
    // (dev: into a zone by its id, or out of the one you're in)
    // a level's physics engine (or a promise of it), from the level's stream:
    // the player onto the 2017 soldier's body (drive: this body steps it; false
    // when its owner does); null back to the walker
    async usePhysics(physics, { drive = true } = {}) {
      if (!physics) {
        body?.dispose();
        body = null;
        bodyPhysics = null;
        return;
      }
      soldierBook ??= (await import('../../../data/bf2017/physics/soldier.json')).default;
      if (disposed) return;
      bodyPhysics = physics;
      bodyDrives = drive;
      body = bodyFor(me().st);
    },
    zone(id = null) {
      const z = id && site.zones.find((o) => o.id === id);
      if (z) enterZone(z);
      else leaveZone();
    },
    // (dev: the sky's state, clear, dusk, overcast or storm, faded over
    // `fade` seconds (0: at once), where the game lights this world)
    weather(next, fade = 0) {
      if (!import.meta.env.DEV) return null;
      gameLit?.weather(next, { fade });
      ctx.invalidate();
      return gameLit?.debug() ?? null;
    },
    teleport(x, z, yaw = null, y = null, pitch = null) {
      if (!import.meta.env.DEV) return;
      const p = me().st;
      p.x = x;
      p.z = z;
      // (the highest floor there, or the one nearest a height given: the
      // hangar's floor under the temple's roof)
      p.y = y == null ? groundAt(world, x, z, 1e4, 1e4) : groundAt(world, x, z, y, 2);
      if (yaw != null) {
        p.yaw = yaw;
        state.cam.yaw = yaw;
      }
      // (a look up or down, for the shots of what's in the sky)
      if (pitch != null) state.cam.pitch = clamp(pitch, CAM.pitch[0], CAM.pitch[1]);
      camInit = false;
      ctx.invalidate();
    },
    // (for tests: where you are, what's going on)
    debug: () => ({ surfaces: { level: surfaces?.level ?? null, print: groundPrint, picks: [...picks] }, sky: { zenith: '#' + sky.uniforms.uZenith.value.getHexString(), horizon: '#' + sky.uniforms.uHorizon.value.getHexString() }, site: site.id, ship: { at: shipHolder.position.toArray().map((v) => +v.toFixed(1)), y: +ship.group.position.y.toFixed(2), box: [+shipBox.w.toFixed(1), +shipBox.l.toFixed(1)], visible: ship.group.visible }, ms: state.ms, frames: state.frames, t: +state.t.toFixed(1), phase: state.phase, you: { ...me().st }, body: body ? { ready: body.ready, pose: body.pose } : null, here: state.here, found: [...state.found], prompt: state.prompt, riding: state.riding?.kind ?? null, rideY: state.riding ? +state.riding.state.y.toFixed(2) : null, quest: state.quest, zone: state.zone?.id ?? null, zoneOrigin: state.zone?.origin ?? null, health: state.health, off: state.off, mission: chase?.view() ?? assault?.view() ?? run, who: me().spec.id, saber: me().saber ? { lit: me().saber.lit, busy: me().saber.busy, thrown: me().saber.thrown, stance: me().saber.stance.name, color: me().spec.saber?.color ?? null } : null, mate: other().spec.id, mods: me().spec.mods ?? [], guard: Math.round(state.guard.value), heat: +state.heat.value.toFixed(2), locked: state.heat.locked, lock: state.lock?.spec.kind ?? null, lockGuard: state.lock?.guard ?? null, lockHp: state.lock?.hp ?? null, lockStagger: state.lock?.stagger != null ? +state.lock.stagger.toFixed(1) : null, weapon: me().weapon?.name ?? null, dodging: Boolean(state.dodge), bombs: state.bombs.length, powers: abilitiesOf(me().spec), force: powers.debug(), jet: +state.jet.fuel.toFixed(2), sprinting: state.t < state.sprint, fight: activity.debug(), people: life.debug(), net: { ...net.progress(), pool: assetPool().progress() }, rides: rides.map((x) => ({ kind: x.kind, at: [+x.state.x.toFixed(1), +x.state.z.toFixed(1)], built: Boolean(x.fig || x.body?.children.length) })) }),
    dispose() {
      disposed = true;
      gameLevel?.dispose();
      net.end();
      body?.dispose();
      body = null;
      lit?.dispose();
      gameLit?.dispose();
      knocks?.dispose();
      knockHits.dispose();
      scene.remove(knockDust.mesh);
      for (const p of people) p.saber?.dispose();
      for (const b of state.bombs) scene.remove(b.m);
      lockRing.geometry.dispose();
      lockRing.material.dispose();
      lockTicks.geometry.dispose();
      lockTicks.material.dispose();
      bombGeo.dispose();
      bombMat.dispose();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', spot, true);
      looker.detach();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', noMenu);
      engine?.stop();
      props.net?.walk?.(null);
      sounds.dispose();
      peers.dispose();
      activity.dispose();
      groundWar.dispose();
      chase?.dispose();
      assault?.dispose();
      blaster.dispose();
      markMat.map.dispose();
      markMat.dispose();
      life.dispose();
      placer.dispose();
      grass?.dispose();
      wind.dispose();
      panel?.dispose();
      groundMap?.dispose();
      shadowPhase?.dispose();
      for (const p of people) {
        p.fitting += 1; // (a body still on its way is let go as it comes)
        p.gp?.dispose();
        p.fig?.dispose?.();
      }
      powers.dispose();
      fx.dispose();
      gameFx.dispose();
      cast?.dispose();
      ship.dispose();
      for (const s of skyships) s.dispose?.();
      for (const f of flights) f.m.dispose?.();
      weather?.dispose();
      water?.dispose();
      sky.dispose();
      wearScanSet('cc0');
      marks.dispose();
      puff.dispose();
      env.dispose();
      kit.dispose();
      disposeTree(scene);
      post.dispose();
      Object.assign(renderer.shadowMap, shadowMapWas);
      renderer.localClippingEnabled = clipWas;
      canvas.removeAttribute('aria-hidden');
    },
  };
}
