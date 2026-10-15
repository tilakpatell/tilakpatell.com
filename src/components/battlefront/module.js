// The Battlefront world (the game design's lane 5): Hoth whole from lane L's
// pack in the export's frame, under the game's own light (lane R's stack,
// fed from lane 0's lighting records), the player as a 2017 trooper on the
// game's skeleton through the game's third-person camera, the battle from
// the sim. A 'nodes' module: the runtime gives it the node renderer, on
// WebGPU where the browser has it and on WebGL 2 otherwise; nothing here is
// GLSL (src/runtime/shading.test.js reads this folder).
//
// The page (BattlefrontWorld.jsx) draws the HUD from the 'hud' events, a
// snapshot a few times a second, and sends the deploy screen's choices
// through world.do. `window.__battlefront` is the same door for
// scripts/battlefront-check.mjs: { view(), do(action, arg) } with 'deploy'
// { classId, appearance } (the crew kind to wear; without one, the skin the
// Collection keeps for that class: screens/Collection.jsx), 'pick' id, 'spawn' a squadmate's id (null for the HQ),
// 'advance' seconds, 'win', 'lose', 'die' (the player down: the kill
// screen), 'weather' name, 'look' { yaw, pitch } (the player's view, for
// a shot toward the sun; it answers with the recoil), 'fire' { on } (the
// trigger), 'ability' { slot } held or { tap } pressed, 'roll', 'kit' (what
// fx/kit.js draws and the player's gun: scripts/bf2017-abilities-check.mjs),
// 'gpu', 'ragdolls' (how many bodies fall, lie and wait: figures/ragdolls.js),
// 'bots' (each living bot's side, mode, target, whether it fires, its order's key (`post2`), its yaw, health, whether it interacts and the enemies it believes in (`+` seen), and for a round's bot the enemy whose line it watches and whether that line is clear),
// 'nav' (the battle's navgrid, for a check), 'doors' (the mode part's doors and gates: each one's open fraction, and what its scene draws), 'place' [x, z, y?] (the player's soldier stood there, on the sim's ground without a y: a check's walk of the map), 'where' (the player's place, and whether its body walks the level's shapes), 'walkersHome' (each escort's walker at its route's end: a check's way into stage 2), 'captured' (each capture point of the stage at a full meter: a check's way into stage 3), 'objectives' (the stage's objectives as the mode has them: a charge's keypad, hold, fuse and holder),
// 'instantActionSchema' (a promise of the setup screen's options),
// 'instantAction' options (a promise of { ok, props } to mount the round with:
// create's `instantAction`, lib/battlefront/instantAction.js) and 'round'
// options (a promise of { ok, round }: the round begun in place, the battle
// made again for it and everything drawn from the old one let go, the level,
// its light and its shaders kept; the world is then as before a first
// deploy).
// `sounds()` is the sound player's counter.
//
// Until the first deploy the camera is parked in the soldier's own pose at
// the side's spawn (the game's darkroom: the waiting screen covers it),
// so the level streams round where the player will land and the shaders
// of what they will see build behind the screen (waiting.js has the
// rules; the snapshot's `shaders` carries lib/three/pipelineGuard's
// counts, `machine` the chip's numbers for the recommendation). The
// deploy is the game's wipe's swap: the exposure then adapts from the
// darkroom's stops to the day's over a quarter second.

import * as THREE from 'three';
import { device } from '../../lib/device.js';
import { floorRatio } from '../../lib/floorRatio.js';
import { CAPPING } from '../../lib/gpuProbe.js';
import { textureTier } from '../../lib/video.js';
import { loadNavSearch } from '../../lib/battlefront/navWasm.js';
import { camerasOf, levelForMode, levelKey, lightingOf, loadLevel, loadRulebook, mapOf, squadsOf, teamsFor } from '../../lib/battlefront/rulebook.js';
import { preloadDecoders } from '../../lib/three/gltf.js';
import { createLook } from '../../runtime/look.js';
import { overviewPose, soldierPose } from './camera.js';
import { createCameraRig } from './cameraRig.js';
import { recoilOf } from '../../lib/battlefront/weapons.js';
import { appearanceOf, characterOfOffer, picksOf, readStore } from '../../lib/bf2017/collection.js';
import { KINDS, SIDE_OF_TEAM, createFigures, figureCuts, preloadBody } from './figures/figures.js';
import { RAGDOLLS, createRagdolls } from './figures/ragdolls.js';
import { createBolts } from './fx/bolts.js';
import { createKitFx } from './fx/kit.js';
import { markerProjection } from './hud/widgets.js';
import { createInput } from './input.js';
import { createLevel } from './map/level.js';
import { armCaster, createPartsCollision, wantsEngine } from './map/collision.js';
import { createWalker } from './map/walk.js';
import { arrive as arriveRoute, createDoors, destroy as destroyVehicle, stepDoors } from './map/doors.js';
import { createDoorsScene } from './map/doorsScene.js';
import { sideOf } from '../../lib/battlefront/modes/galacticAssault.js';
import { holesOf } from '../../lib/land/holes.js';
import SOLDIER_BODY from '../../data/bf2017/physics/soldier.json';
import { PLAYER_ID, STEP, addPlayer, botsAt, createBattle, deploy, grant, roundBattle, spawnFor, step, view } from './battle.js';
import { entryFor } from './weather.js';
import { levelLightOf } from './baseLight.js';
import { guardOf } from '../../lib/three/pipelineGuard.js';
import { ADAPT_S, arrivalExposure, stopsFrom } from './waiting.js';
import { createSoundPlayer } from './sound/player.js';
import { PRELOAD, createDirector } from './sound/director.js';
import { NAMES } from './sound/sounds.js';
import { litWith, picturesOf } from './picture.js';
import { headroom, upscaleKind } from '../../lib/three/light/post.js';
import { headroomAt } from '../../runtime/quality.js';
import { loadSettings, optionsFor, roundFor, sideCap } from '../../lib/battlefront/instantAction.js';
import { heightAt as navHeight, walkable } from '../../lib/battlefront/nav.js';

export const HUD_HZ = 8; // snapshots a second to the page
export const PLAYER_TEAM = 2; // the attackers on Hoth, the Empire (maps/hoth.stages.json)
export const FAR = 12000; // m: the camera's far plane (the record's ViewDistance is 10,000 on Hoth's day)
const MAX_STEPS = 10; // the sim's steps at most a frame (a tab back from the background)

export default {
  id: 'battlefront',
  shading: 'nodes',
  mb: 13, // (WORLD_MB['/battlefront']: the game's sounds; the level pack streams by cell)
  // The pace's steps are the chain's (lowerQuality): the canvas keeps its
  // size and the chain draws under it, upscaled back (lane U's headroom),
  // then sheds passes. Drawn at the screen's own pixels and no sharper:
  // ultra's budget asks for twice a plain monitor's (device.js's ratio 2),
  // which on a 5,120 × 1,440 desk is 29 million pixels a frame through a
  // chain of thirty passes; TRAA already smooths the edges that extra
  // ratio was for.
  sharpness: 'own',
  // (read as the world starts: the screen the window is on then; at Low,
  // the floor, 1,280 × 720 at most, lib/floorRatio)
  get ratio() {
    if (typeof window === 'undefined') return 1;
    return floorRatio(Math.max(1, Math.min(2, window.devicePixelRatio || 1)), { w: window.innerWidth, h: window.innerHeight, detail: device().detail });
  },
  label: 'Hoth from Star Wars Battlefront II (2017), drawn from the game’s own level, light and figures. W A S D to move, the mouse to look and fire, Enter to deploy.',
  async create(rt, { level: levelName = 'hoth', mode = 'galacticAssault', weather: askedWeather = null, instantAction = null } = {}) {
    const renderer = rt.gfx.renderer;
    const tier = rt.quality?.tier ?? 'high';
    // (the meshopt decoder and the Basis transcoder up beside the level's
    // first fetches, not behind its first model: lib/three/wasmDecoders.js)
    preloadDecoders({ renderer, basis: true });
    // (the bots' A* in WebAssembly where it comes up: the same paths, a third
    // of the time; the JavaScript meanwhile and where it can't, navWasm.js)
    loadNavSearch();
    const rb = loadRulebook();
    const cams = camerasOf(rb);
    const map = mapOf(rb, levelName);
    const lighting = lightingOf(rb, levelName);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.7, 0.78, 0.88);
    // (the graph's world matrices once a frame, in draw: three works them
    // out on every render() call, the field's pass and each shadow cascade,
    // 5,700 objects walked three or four times a frame)
    scene.matrixWorldAutoUpdate = false;
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, FAR);
    // (the level's shapes round the player, for the camera's arm: lane P0's
    // engine where the tier and the screen take it, the cells as the stream
    // brings them)
    let collision = null;
    let physics = null;
    let walker = null; // the player's body on the level's shapes (map/walk.js), with the engine
    // (the cells the stream has handed on, kept so a collision made after them is given them too)
    const streamed = new Map();
    // (on WebGPU the level is GPU-first lane N1's scene: the rows culled by
    // compute and one indirect draw a material group, so the level costs
    // the frame no JavaScript a draw; Hoth at ultra on the owner's 5090,
    // 1,600 × 900: 12.3 ms a frame against lane L's instanced path's 32.1,
    // the world's draw 9.7 ms of JavaScript against 27.9, the picture the
    // same to 46.7 dB with the chain off (docs/superpowers/evidence/gpu-first/N1).
    // ?level=cpu in the address keeps the instanced path, for a check; a
    // device without indirect-first-instance and WebGL 2 keep it always:
    // levelScene.js's canDrawGpuScene; and a chip that is T0 for being weak
    // by its name, slow on the probe or lost (lib/gpuProbe's CAPPING), whose
    // compute cull and depth pyramid cost it more than they save: GPU-first
    // lane N6's “level path: batched” on T0. A T0 for want of a feature, a
    // strong desktop's WebGPU without timestamp-query, keeps the GPU scene)
    const flags = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search) : null;
    const weak = rt.tier === 'T0' && CAPPING.has(rt.tierWhy);
    const gpuScene = rt.gfx.backend === 'webgpu' && !weak && flags?.get('level') !== 'cpu';
    // (?ground=flat: the ground in its flat colour, the game's snow maps left
    // off, for a check that measures what the snow costs; `detail` is the
    // quality level in force, 'ultra' on a strong card where the tier is
    // 'high': the ground's 1 m patch and its map sizes read it)
    // (`mode`: the mode's own part of the level where it has one, Hoth's Galactic Assault: map/level.js's MODES)
    const level = createLevel({ scene, tier, detail: device().detail, texTier: textureTier(tier, rt.video), renderer, world: levelName, mode, gpuScene, snow: flags?.get('ground') !== 'flat', ...(flags?.get('inside') === 'off' ? { inside: null } : {}) /* (?inside=off: the level without its interior pack, a check's measure of what Echo Base costs) */, onCell: (k, b, band, part) => {
        streamed.set(`${part}|${k}`, [k, b, band, part]);
        collision?.add(k, b, band, part);
      },
      onDrop: (k, part) => {
        streamed.delete(`${part}|${k}`);
        collision?.drop(k, part);
      },
    });
    // (the ragdoll book, 144 KB, comes after the page: no body falls as one until it has)
    const ragdolls = createRagdolls({ book: import('../../data/bf2017/physics/ragdoll.json').then((m) => m.default), floorAt: (x, z) => level.heightAt(x, z), max: RAGDOLLS[tier] ?? RAGDOLLS.mid });
    // (each body's cut by its distance, the game's LOD0 near on a level that upgrades: figures.js)
    const cuts = figureCuts({ level: device().detail, lowData: Boolean(device().saveData) });
    // (?skin=whole in the address: every part on the file's whole rig, for a check that measures what the cut skins save)
    const figures = createFigures({ scene, ragdolls, cuts, prune: flags?.get('skin') !== 'whole' });
    // (the player's side's near body fetched behind the waiting screen, so the first deploy is already on it)
    preloadBody(KINDS[SIDE_OF_TEAM[PLAYER_TEAM]], cuts);
    const bolts = createBolts(scene);
    // (the grenades, their blasts, the turrets and the shields: fx/kit.js)
    const kitFx = createKitFx(scene);
    const booms = []; // the steps' explosions since the last frame drawn
    // (a press read on a frame with no step of the sim's, two frames in three at 60 Hz, waits for the next that has one)
    const pressed = { ability: 0, jump: false, roll: false, vent: false };
    const rig = createCameraRig(camera);
    const input = createInput({ maxPitch: (cams.soldier.maxPitch * Math.PI) / 180 });
    input.attach();
    // (the navgrid is built from the ground the world draws: the pack's
    // heightmaps first; lane 1's bots walk it, the player too)
    await level.ready;
    const small = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) < 600;
    const engine = async () => {
      if (!level.pack || !wantsEngine({ pack: level.pack, tier, small })) return;
      // (preloaded: the engine's first step is otherwise 50–107 ms, mid-play)
      const { createPhysics, preload } = await import('../../lib/physics/world.js');
      await preload();
      physics = await createPhysics();
      // (the outside's and its interior's, Hoth's Echo Base: map/level.js's inner)
      collision = createPartsCollision({ parts: { outside: { pack: level.pack, loadBin: level.loadBin }, inside: level.inner, mode: level.modePart }, physics, tier });
      // (the ground's own holes left out of its collider: the hangar mouths and the trench tunnels, lib/land/holes.js)
      collision.setTerrain((px, pz) => level.packHeightAt(px, pz) ?? 0, { holes: holesOf(level.pack.terrain) });
      for (const a of streamed.values()) collision.add(...a);
      walker = createWalker({ physics, pack: level.pack, row: SOLDIER_BODY.rows[SOLDIER_BODY.default], ground: (x, z) => level.heightAt(x, z) });
    };
    // (the navgrid's mask, the pack's nav.bin: where the game's shapes leave no room to walk)
    // (the navmesh asked for only where the pack says it has one: Hoth's, scripts/bf2017-navmesh.mjs)
    const meshFile = level.pack?.navmesh?.file ?? null;
    const [mask, navBytes] = await Promise.all([level.navOf(), meshFile ? level.loadBin(meshFile).catch(() => null) : null, engine().catch(() => null)]);
    // (the level's own navmesh, its NavPower polygons: the bots' floors one over another, battle.js's NAVMESH_OF;
    // their feet on the level's shapes where the engine has them round the player)
    const navmesh = navBytes ? { bytes: new Uint8Array(navBytes), floor: (x, y, z) => collision?.floor(x, y, z) ?? null } : null;
    // (the mode part's doors, gates and state props: map/doors.js's rule, map/doorsScene.js's things, a round's own state)
    const part = level.modePart;
    const doorsFor = (m) => (part?.mode && m === 'galacticAssault' ? createDoors(part.mode, { origin: part.pack.origin }) : null);
    let doors = doorsFor(mode);
    const doorsScene = part?.mode ? createDoorsScene({ part, physics }) : null;
    // (an Instant Action round, the setup screen's choices: lib/battlefront/instantAction.js reads the
    // server's rows for them, and the sim takes the round at its making: sim.js's roundIn)
    // (the machine's share of a round's bots, by its quality level: every bot is a body drawn and a mind stepped)
    const cap = sideCap(device().detail);
    const profile = rb.ai?.instantAction ?? null;
    const round = instantAction ? roundFor(await loadSettings(), { ...instantAction, level: levelName, mode, team: instantAction.team ?? PLAYER_TEAM }, { cap, profile }) : null;
    // (the player's side: the round's, the screen's Change Faction; the Empire's where none is asked)
    let team = round?.team ?? PLAYER_TEAM;
    // (the mode played: the route's, then a round's begun in place)
    let battleMode = mode;
    // (the level of this world that holds the mode: Hoth's Supremacy is its second level's, on the same
    // ground, played with the world's own sides, the teams table holding the first level's alone)
    const battleLevel = levelForMode(rb, levelName, mode);
    const elsewhere = battleLevel !== levelKey(levelName);
    if (elsewhere) await loadLevel(battleLevel);
    const worldSides = elsewhere ? teamsFor(rb, levelName, round?.era ?? 'Orig') : null;
    let sim = createBattle({ rulebook: rb, level: elsewhere ? battleLevel : levelName, mode, heightAt: (x, z) => level.heightAt(x, z), mask, navmesh, ...(worldSides ? { teams: { 1: worldSides.light, 2: worldSides.dark } } : {}), ...(round ? { bots: round.bots, era: round.era, difficulty: round.difficulty, instantAction: round } : { bots: botsAt(device().detail) }) });
    let me = addPlayer(sim, { team });
    // the game's sounds (sound/): the player on the runtime's bus, the
    // director on the sim's events; the one-shots the first minute needs
    // fetched now, the stems streamed as they play; nothing heard behind
    // the waiting screen, where the page plays the loading cue
    const sound = createSoundPlayer({ context: rt.audio.context, output: () => rt.audio.bus(), load: (url) => rt.assets.audio(url) });
    // (`me` to the sim is the input's 'player'; the soldier the events name is PLAYER_ID)
    let director = createDirector({ player: sound, me: PLAYER_ID, team });
    sound.preload([...PRELOAD, ...NAMES.filter((n) => (n.startsWith('blaster.') || n.startsWith('ambience.')) && !PRELOAD.includes(n))]).catch(() => {});
    // the player's soldier in lane 1's sim, once deployed
    const body = () => (sim.player?.id ? sim.sim.entities.get(sim.player.id) : null);
    let picked = null;
    let mate = null; // the squadmate the deploy screen would spawn the player on (null: the HQ)
    let lastAt = null; // the player's place before the last step
    let pose = null;
    let acc = 0;
    let size = { w: 1, h: 1 };
    let sinceHud = Infinity;
    let scoreboard = false;
    // (the day asked for at mount, the waiting screen's coin or pick, so the chain is built once for it)
    let weather = askedWeather && lighting.weathers[askedWeather] ? askedWeather : lighting.default;
    let clock = 0; // s the world has drawn: a drawn bolt's age
    let parked = true; // the camera at the spawn until the first deploy (the darkroom)
    let arrival = null; // { t, stops }: the exposure adapting after the wipe's swap
    let arrivedAt = null; // ms (performance.now) of the first deploy, and of the first frame drawn after it
    let firstFieldAt = null;
    // (the way in's marks, ms of the page's clock: the world made, the level's boot in; waiting.js's loadLine)
    let madeAt = null;
    let levelAt = null;
    let building = 0; // post chains being built (a weather's, the pace's)
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const look = createLook({
      host: rt.gfx.canvas,
      mode: 'lock',
      onTurn: (dx, dy) => input.turn(dx, dy),
      onButton: (which, down) => input.button(which === 0 ? 'left' : 'right', down),
      active: () => sim.player?.state === 'alive',
    });
    look.attach();

    // the camera's arm against the ground and the level's shapes (the navgrid's with no engine)
    let castArm = armCaster({ heightAt: (x, z) => level.heightAt(x, z), collision, nav: sim.nav });

    // the Collection's skin for the class or hero a deploy is, as the crew kind it wears
    const pickedLook = (id) => {
      const c = id ? characterOfOffer({ id }) : null;
      if (!c) return null;
      let store = {};
      try {
        store = readStore(window.localStorage);
      } catch {
        store = {};
      }
      return appearanceOf(store, c.id, { faction: c.faction });
    };
    // the Collection's star cards for a hero a deploy is: their ids, in the store's order (the sim wears three of its own)
    const pickedCards = (id) => {
      const c = id ? characterOfOffer({ id }) : null;
      if (!c) return [];
      try {
        return picksOf(readStore(window.localStorage), c.id, { faction: c.faction }).cards;
      } catch {
        return [];
      }
    };
    // (a choice: an offer { kind, id } from the deploy screen, { classId }, a class id, or nothing for the side's first class)
    const choiceOf = (c) => (typeof c === 'string' ? { classId: c } : c?.kind ? { kind: c.kind, id: c.id } : c?.classId ? { classId: c.classId } : {});
    const doDeploy = (choice = picked, appearance = null) => {
      const base = choiceOf(choice);
      // (the skin the Collection keeps for what is deployed, where the screen sent none)
      const look = appearance ?? pickedLook(base.id ?? base.classId ?? null);
      if (look) base.appearance = look;
      // (a hero's star cards, as the Collection keeps them)
      if (base.kind === 'hero') base.cards = pickedCards(base.id);
      let r = deploy(sim, me, mate ? { ...base, spawn: 'squad', mate } : base);
      // (a mate who cannot be spawned on by now: the HQ, as the game falls back, SpawnOnSpawnEntityIfSpawnOnPlayerFails)
      if (!r.ok && mate && squadsOf(rb).fallbackToPoint) r = deploy(sim, me, base);
      if (r.ok) {
        if (parked) {
          // (the wipe's swap: the darkroom's EV 8 to the day's clamp, settling over ADAPT_S)
          parked = false;
          arrival = { t: 0, stops: stopsFrom(lighting.weathers[weather]?.exposure?.minEv) };
          arrivedAt = now();
          firstFieldAt = null;
        }
        input.setLook(body().yaw, 0);
        // (the next life's deploy screen starts from its own highlight)
        picked = null;
        mate = null;
        lastAt = null;
        input.swallow(false);
        pose = null;
      }
      return r;
    };

    // the light: lane R's stack on the level's records (await: the passes
    // need the sun and the sky before the chain is built)
    // (with the record's picture, lane P: the painted sky, the fog gradient,
    // the cloud texture, the 33³ LUT and the five Gaussians; a weather's
    // change carries them, the chain built again once it lands)
    const { applyGameLight } = await import('../../lib/three/light/apply.js');
    const pictures = await picturesOf(levelName);
    const lit = (w) => litWith(pictures, entryFor(lighting, w), w);
    const first = lit(weather);
    // (cadence: lane N3's far cascades drawn every fourth frame, the near
    // ones every frame; the whole level was drawn into all four each frame)
    const light = await applyGameLight(scene, renderer, first.entry, { tier, video: rt.video ?? null, camera, ...(await levelLightOf({ lighting, pictures, level, tier, off: flags?.get('light'), volumes: flags?.get('volumes') === 'on' })) /* (the lamps, the interiors' VEs, the base's probes: baseLight.js; ?light=lamps,inside,probes leaves those out, ?volumes=on marches the volumetrics, for a check) */, picture: first.picture, cadence: true, onChain: (passes) => swapPost(passes) });
    // (?post=off in the address: the scene drawn with no chain, for a check)
    const asked = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search).get('post') : null;
    // The pace's level on the chain (runtime/quality's headroomAt): first
    // the internal resolution, 0.77, 0.67, 0.5 of the screen brought back
    // up by TAAU, then the passes shed from the top (post.js's SHED). On
    // the GPU clock the controller's own scale is the internal one.
    let paceLevel = rt.quality?.level ?? 0; // (the pace's step; `level` is the pack, `step` the sim's)
    const pixels = () => Math.round((rt.gfx.size?.w ?? 1) * (rt.gfx.size?.h ?? 1) * (rt.gfx.ratio ?? 1) ** 2);
    const chainFor = (passes) => {
      const h = headroomAt(paceLevel, { tier, pixels: pixels() });
      const scale = rt.quality?.source === 'gpu' ? (rt.quality.internal ?? h.scale) : h.scale;
      return headroom(passes, { scale, shed: h.shed }, upscaleKind(passes));
    };
    let post = light.passes.length && asked !== 'off' ? rt.gfx.post(chainFor(light.passes)) : null;
    // (the chain's tonemap pass reads the renderer's exposure: the arrival scales it from here)
    const baseExposure = renderer.toneMappingExposure ?? 1;
    // (the old chain draws until the new one is built, then is let go)
    function swapPost(passes) {
      if (!post) return;
      const next = rt.gfx.post(chainFor(passes));
      building++;
      Promise.resolve(next.ready)
        .catch(() => null)
        .then(() => {
          building--;
          // (the world left while it was built)
          if (!post) return next.dispose?.();
          const was = post;
          post = next;
          was.dispose?.();
        });
    }
    // where the side deploys: the camera's park until the first deploy
    const parkOf = () => {
      const s = spawnFor(sim.map, sim.stage, team, sim.ga?.attackers);
      return { at: [s.at[0], level.heightAt(s.at[0], s.at[2]), s.at[2]], yaw: s.yaw };
    };
    let park = parkOf();

    // A round begun in place (the setup screen's Start): the battle made again for the round on the same
    // navgrid (battle.js's roundBattle), and what mirrored the old one let go: its bodies and their
    // ragdolls, its bolts, its sounds' bed, the player's seat and the deploy screen's picks. The level, its
    // light, the chain and the shaders stay; the camera parks again and the world waits for a first deploy.
    async function beginRound(options = {}) {
      let next;
      let fresh;
      try {
        next = roundFor(await loadSettings(), { ...options, level: levelName, mode: options.mode ?? battleMode, team: options.team ?? team }, { cap, profile });
        await loadLevel(levelForMode(rb, levelName, next.mode));
        fresh = roundBattle(sim, next, { heightAt: (x, z) => level.heightAt(x, z), mask });
      } catch (err) {
        return { ok: false, why: err.message };
      }
      figures.update([], 0);
      bolts.update([], { muzzleOf: figures.muzzleOf, now: clock });
      director.dispose();
      sim = fresh;
      team = next.team;
      battleMode = next.mode;
      me = addPlayer(sim, { team });
      director = createDirector({ player: sound, me: PLAYER_ID, team });
      castArm = armCaster({ heightAt: (x, z) => level.heightAt(x, z), collision, nav: sim.nav });
      doors = doorsFor(battleMode);
      park = parkOf();
      picked = null;
      mate = null;
      lastAt = null;
      pose = null;
      acc = 0;
      Object.assign(pressed, { ability: 0, jump: false, roll: false, vent: false });
      booms.length = 0;
      parked = true;
      arrival = null;
      arrivedAt = null;
      firstFieldAt = null;
      renderer.toneMappingExposure = baseExposure;
      input.swallow(true);
      kitFx.update(view(sim), { now: clock, alpha: 1, events: [] });
      rt.events.emit('hud', snapshot());
      return { ok: true, round: next };
    }
    const guard = guardOf(renderer);
    const machine = () => {
      const gpuClock = rt.gpuClock ?? null;
      return {
        backend: rt.gfx.backend,
        tier: rt.tier ?? null,
        level: paceLevel,
        internal: rt.quality?.internal ?? 1,
        source: rt.quality?.source ?? 'cpu',
        gpuMs: gpuClock?.available ? (gpuClock.median ?? null) : null,
        pixels: pixels(),
        // (three keeps the adapter's info on the device, not on its backend: runtime/webgpu.js)
        adapter: (({ description, device } = {}) => description || device || null)(renderer.backend?.device?.adapterInfo ?? renderer.backend?.adapter?.info),
      };
    };

    const physicsStats = () => {
      const s = collision?.stats();
      return s ? { cells: s.cells, bodies: s.bodies, colliders: s.colliders, queued: s.queued, mask: Boolean(sim.nav.mask) } : { mask: Boolean(sim.nav.mask) };
    };

    const snapshot = () => {
      const v = view(sim);
      const p = v.player;
      const markers = p?.state === 'alive' ? (v.mode?.objectives ?? []).map((o) => ({ id: o.id, label: o.name, dist: Math.hypot(o.at[0] - p.at[0], o.at[2] - p.at[2]), ...markerProjection(o.at, camera, size) })) : [];
      return {
        time: v.time,
        deploy: { open: v.deploy.open, offers: v.deploy.offers, team: v.deploy.team, spawns: v.deploy.spawns },
        squad: v.squad,
        points: v.points,
        // (evade: the game's two rolls, HealthEvade's charges; the sim's rolls are not counted, so the two stand)
        player: p && { id: p.id, state: p.state, at: p.at.slice(), yaw: p.yaw, team: p.team, hp: p.hp, hpMax: p.hpMax, heat: p.heat, warning: p.warning, overheated: p.overheated, coolWindow: p.coolWindow, cls: p.cls, weapon: p.weapon, hitAt: p.hitAt, killAt: p.killAt, evade: p.evade, abilities: p.abilities?.length ? p.abilities : [1, 2, 3].map((slot) => ({ slot, recharge: 1, ready: true })), shield: p.shield, over: p.over, flashed: p.flashed, flash: p.flash, ability: p.ability, unit: p.unit ?? null, cards: p.cards ?? [] },
        mode: v.mode && { stageName: v.mode.stageName, objectives: v.mode.objectives.map((o) => ({ id: o.id, name: o.name, meter: o.meter, at: o.at })), tickets: v.mode.tickets, result: v.mode.result, gates: v.mode.gates },
        // (the radar's soldiers: who, where, which side, up or down, firing)
        entities: v.entities.map((e) => ({ id: e.id, team: e.team, kind: e.kind, at: e.at, alive: e.alive, firing: e.firing })),
        killLog: v.killLog.slice(),
        scoreboard: v.scoreboard,
        showScoreboard: scoreboard,
        markers,
        level: { loaded: level.loaded(), progress: level.progress(), ...level.stats(), physics: physicsStats() },
        shaders: { pending: guard?.pending() ?? 0, held: guard?.held() ?? 0, building },
        machine: machine(),
        marks: { arrivedAt, firstFieldAt, madeAt, levelAt: (levelAt ??= level.loaded() ? now() : null) },
        backend: rt.gfx.backend,
        weather,
        parked,
      };
    };

    const world = {
      ready: Promise.all([level.ready, rt.gfx.compile(scene, camera), post?.ready]).then(() => undefined),
      resize(w, h) {
        size = { w, h };
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
      step(dt) {
        const read = input.read();
        scoreboard = read.scoreboard;
        // (the recoil's kick is part of the view: the shot goes where the kicked camera looks)
        const kicked = rig.offset();
        read.yaw += kicked.yaw;
        read.pitch += kicked.pitch;
        // (the frame's lean view: the HUD's snapshot alone makes the deploy
        // screen's rows, the squad's and the scoreboard, battle.js's view)
        const v = view(sim, { lean: true });
        input.swallow(v.deploy.open);
        // (the first deploy is the waiting screen's, through the wipe: the input's Enter waits for it)
        const deploying = v.deploy.open && read.deploy && !parked;
        if (deploying) doDeploy();
        acc = Math.min(acc + dt, STEP * MAX_STEPS);
        pressed.ability = v.deploy.open ? 0 : read.ability || pressed.ability;
        pressed.jump = !v.deploy.open && (read.jump || pressed.jump);
        pressed.roll = !v.deploy.open && (read.roll || pressed.roll);
        pressed.vent = !v.deploy.open && (read.vent || pressed.vent);
        let first = true;
        let stepped = 0;
        const heard = [];
        while (acc >= STEP) {
          acc -= STEP;
          stepped += STEP;
          lastAt = body()?.at.slice() ?? null;
          // (the player walks the level's shapes where the engine is: map/walk.js)
          if (walker && body() && body().mover !== walker.mover) body().mover = walker.mover;
          const once = first ? { ...read, ...pressed } : { ...read, jump: false, roll: false, ability: 0, vent: false, interact: false };
          if (first) Object.assign(pressed, { ability: 0, jump: false, roll: false, vent: false });
          first = false;
          // (every event to the sound director; the explosions to the kit drawing too)
          const events = step(sim, [{ id: me, move: once.move, yaw: once.yaw, pitch: once.pitch, fire: once.fire, aim: once.aim, sprint: once.sprint, crouch: once.crouch, jump: once.jump, roll: once.roll, vent: once.vent, ability: once.ability, abilityHeld: once.abilityHeld, interact: once.interact, interactHeld: once.interactHeld }]);
          heard.push(...events);
          for (const e of events) if (e.type === 'explosion') booms.push(e);
        }
        // (the view again, after the steps: its entities' `at` are the sim's
        // own arrays, live, while their step time `t` and the rest are read
        // when it is taken; the figures pair a step's place with its time to
        // glide between two steps, and read before the steps the pair was
        // one step out, the body drawn a step forward then a step back. One
        // view after the steps serves the sound and the drawing, the
        // colliders' streaming between them touching no sim; a frame with
        // no step and no deploy draws the view it began with: the view is
        // one object refilled, and building it three times a frame was the
        // world's own main-thread cost)
        const after = stepped > 0 || deploying ? view(sim, { lean: true }) : v;
        if (stepped > 0) director.update(after, heard, stepped, { waiting: parked });
        // (the doors moved before the world steps: a leaf's body goes where it is drawn; the
        // gates' run is lib/battlefront/gates.js's, through Galactic Assault's view where the
        // sim has them: until then shut)
        if (doors) {
          const ga = sim.sim.ga ?? null;
          const soldiers = [];
          for (const e of sim.sim.entities.values()) if (e.kind === 'soldier' && e.alive) soldiers.push({ at: e.at, team: e.team, side: ga ? sideOf(ga, e.team) : null, alive: true });
          // (the frame's own view's: built once already)
          const gates = after.mode?.gates ?? {};
          stepDoors(doors, dt, { soldiers, ga, gates });
          doorsScene?.update(doors);
        }
        // (a soldier held in the air for want of a floor gets the frame's time for the shapes under it)
        collision?.update(walker?.held ? 16 : 4, body()?.at ?? null);
        walker?.step();
        const drawn = after;
        const p = body();
        if (sim.player.state === 'alive' && p) {
          const look = input.look();
          // (the body as it is drawn, between the last two steps, so the
          // camera does not jump at the sim's 20 Hz while the figure glides)
          const k = Math.min(1, acc / STEP);
          const from = lastAt ?? p.at;
          const drawn = { ...p, at: p.at.map((v, i) => from[i] + (v - from[i]) * k) };
          pose = soldierPose(drawn, cams, { yaw: look.yaw, pitch: look.pitch, aiming: read.aim, weaponId: p.weapon, dt, prev: pose, castArm });
          // (the gun's recoil amplitude is the camera spring's target: the climb and the recovery)
          rig.aim(recoilOf(p.gun));
          level.update(p.at);
        } else if (parked) {
          // (the darkroom: the soldier's own camera at the spawn, the level streaming round it)
          pose = soldierPose({ at: park.at, stance: 'stand' }, cams, { yaw: park.yaw, pitch: 0, dt, prev: pose, castArm });
          level.update(park.at);
        } else {
          const towards = sim.objectives[0]?.at ?? [0, 0, 0];
          pose = overviewPose(map, towards) ?? pose;
          if (pose) level.update(pose.at);
          rig.aim([0, 0]);
        }
        if (pose) rig.set(pose);
        rig.update(dt);
        figures.update(drawn.entities, dt, Math.min(1, acc / STEP), camera.position);
        ragdolls.update(dt);
        clock += dt;
        // (each bolt leaves its owner's gun: fx/bolts.js)
        bolts.update(drawn.bolts, { muzzleOf: figures.muzzleOf, now: clock });
        kitFx.update(drawn, { now: clock, alpha: Math.min(1, acc / STEP), events: booms });
        booms.length = 0;
        light.update(dt, camera);
        if (arrival) {
          arrival.t += dt;
          renderer.toneMappingExposure = baseExposure * arrivalExposure(arrival.t, { stops: arrival.stops, seconds: ADAPT_S });
          if (arrival.t >= ADAPT_S) arrival = null;
        }
        sinceHud += dt;
        if (sinceHud >= 1 / HUD_HZ) {
          sinceHud = 0;
          rt.events.emit('hud', snapshot());
        }
      },
      draw({ renderer: r }) {
        level.beforeRender(camera);
        scene.updateMatrixWorld();
        if (post) post.render();
        else r.render(scene, camera);
        level.afterRender();
        if (arrivedAt !== null && firstFieldAt === null) firstFieldAt = now();
      },
      wants: () => true,
      do(action, arg) {
        switch (action) {
          case 'deploy':
            return doDeploy(arg?.kind || arg?.classId ? arg : picked, arg?.appearance ?? null);
          case 'points':
            // (a check's Battle Points for the player, to buy a hero: battle.js's grant)
            return { ok: true, points: grant(sim, arg ?? 0) };
          case 'pick':
            picked = arg;
            return { ok: true };
          case 'spawn':
            mate = arg ?? null;
            return { ok: true };
          case 'advance': {
            const n = Math.round((arg ?? 1) / STEP);
            for (let i = 0; i < n; i++) step(sim, [{ id: me, move: [0, 0] }]);
            return { ok: true, time: sim.sim.time };
          }
          case 'win':
          case 'lose':
          case 'die':
            sim.force(action, team);
            rt.events.emit('hud', snapshot());
            return { ok: true };
          case 'weather': {
            if (!lighting.weathers[arg]) return { ok: false, why: `no weather ${arg}` };
            weather = arg;
            const next = lit(arg);
            light.setWeather(next.entry, 0, { picture: next.picture });
            return { ok: true };
          }
          case 'look': {
            // (a check turns the player's view: radians, yaw 0 down +Z, pitch up positive)
            const l = input.look();
            input.setLook(arg?.yaw ?? l.yaw, arg?.pitch ?? l.pitch);
            return { ok: true, ...input.look(), recoil: rig.offset(), amplitude: recoilOf(body()?.gun) };
          }
          case 'fire':
            // (a check's trigger: held down until told to let go)
            input.button('left', Boolean(arg?.on ?? true));
            return { ok: true, on: Boolean(arg?.on ?? true) };
          case 'interact':
            // (a check's finger on the interact: held down until told to let go)
            input.holdInteract(Boolean(arg?.on ?? true));
            return { ok: true, on: Boolean(arg?.on ?? true) };
          case 'ability':
            // (a check's finger on an ability key: { slot } pressed, held until { slot: 0 }; { tap: slot } pressed and let go)
            if (arg?.tap) input.press('ability', arg.tap);
            else input.holdAbility(arg?.slot ?? 0);
            return { ok: true };
          case 'roll':
            input.press('roll');
            return { ok: true };
          case 'kit':
            // (what the kit draws, and the player's soldier as the sim has it: for a check)
            return { drawn: kitFx.counts(), grenades: view(sim).grenades.map((g) => ({ id: g.id, kind: g.kind, at: g.at.slice(), resting: g.resting })), state: body()?.state ?? null, gun: body()?.gun?.row?.id ?? null, heat: body()?.gun?.heat ?? null, spin: body()?.gun?.spin ?? null, hp: body()?.hp ?? null, shield: body()?.shield?.hp ?? null, over: body()?.over?.hp ?? 0 };
          case 'instantActionSchema':
            // (the setup screen's options, each with the row it reads; a promise, the settings being a chunk of their own)
            return loadSettings().then((gs) => optionsFor(gs, { rulebook: rb, level: levelName, team, cap }));
          case 'instantAction':
            // (the choices checked: the props to mount the round with, or why not)
            return loadSettings().then((gs) => {
              try {
                const r = roundFor(gs, { ...arg, level: arg?.level ?? levelName, mode: arg?.mode ?? battleMode, team: arg?.team ?? team }, { cap, profile });
                return { ok: true, props: { level: r.level, mode: r.mode, instantAction: { ...arg } }, round: r };
              } catch (err) {
                return { ok: false, why: err.message };
              }
            });
          case 'round':
            // (the round begun in place: a promise of { ok, round } or { ok: false, why })
            return beginRound(arg ?? {});
          case 'bots':
            // (the bots as the sim has them, for a check: each one's side, what it is doing, whom it is after, whether it is firing)
            return [...sim.sim.entities.values()].filter((e) => e.bot && e.kind === 'soldier' && e.alive).map((e) => ({ id: e.id, team: e.team, mode: e.brain?.intent?.mode ?? null, target: e.brain?.target ?? null, firing: e.gun ? sim.sim.time - e.gun.lastShot < 0.2 : false, at: e.at.map((n) => Math.round(n)), watching: e.brain?.apCandidate ?? null, order: e.brain?.task?.key ?? null, lineClear: e.brain?.apLof ? e.brain.apLof.clearSince !== null : null, yaw: Math.round((e.yaw ?? 0) * 100) / 100, hp: Math.round(e.hp ?? 0), interact: !!e.interact, believes: Object.values(e.brain?.me?.beliefs ?? {}).filter((b) => b.hostile).map((b) => `${b.id}${b.visible ? '+' : ''}`), way: e.brain?.path ? { n: e.brain.path.length, wp: e.brain.wp, goal: e.brain.intent?.goal?.map((n) => Math.round(n)) ?? null, stuck: Math.round((e.brain.stuck ?? 0) * 10) / 10 } : null }));
          case 'nav':
            // (the battle's navgrid itself, for a check of a way over it; its navmesh by name only)
            return { ...sim.nav, mesh: sim.nav.mesh ? { name: sim.nav.mesh.name, polys: sim.nav.mesh.polyCount, links: sim.nav.mesh.links.length } : null };
          case 'doors':
            // (a check's read of the mode part: each door's and gate's open fraction, the scene's counts;
            // { arrive: path } a walker home by its route, { destroyed: [spawner ids] } their vehicles down, as the game's events)
            if (doors && arg?.arrive) arriveRoute(doors, arg.arrive);
            if (doors && arg?.destroyed) for (const id of arg.destroyed) destroyVehicle(doors, id);
            return doors ? { doors: Object.fromEntries([...doors.doors, ...doors.gates].map((d) => [d.def.id, Math.round(d.ip.value * 1000) / 1000])), stage: doors.stage, scene: doorsScene?.stats() ?? null } : null;
          case 'walkersHome': {
            // (a check's way into stage 2: each escort's walker at the end of its route, so its gate unlocks)
            const ga = sim.sim.ga;
            if (!ga?.objectives) return { ok: false, why: 'no Galactic Assault' };
            const homed = ga.objectives.filter((o) => o.type === 'escort' && o.walker?.alive);
            for (const o of homed) o.walker.dist = o.walker.length;
            return { ok: true, walkers: homed.length };
          }
          case 'captured': {
            // (a check's way into the next stage: each capture point of the stage the attackers' at a full meter)
            const ga = sim.sim.ga;
            if (!ga?.objectives) return { ok: false, why: 'no Galactic Assault' };
            const points = ga.objectives.filter((o) => o.type === 'capture');
            for (const o of points) o.meter = 1;
            return { ok: true, points: points.length, stage: ga.stage };
          }
          case 'objectives': {
            // (a check's read of the stage's objectives as the mode has them: a charge's keypad, hold, fuse and holder)
            const ga = sim.sim.ga;
            if (!ga?.objectives) return { ok: false, why: 'no Galactic Assault' };
            return { ok: true, stage: ga.stage, phase: ga.phase, result: ga.result, objectives: ga.objectives.map((o) => ({ type: o.type, name: o.name, id: o.def?.prefab ?? null, at: o.at, keypad: o.charge?.keypad?.at ?? null, done: o.done, armed: o.armed ?? null, wait: o.wait ?? null, progress: o.progress ?? null, defuse: o.defuse ?? null, fuse: o.fuse ?? null, paused: o.paused ?? null, holder: o.holder ?? null, by: o.by ?? null, meter: o.meter ?? null, inside: o.inside ?? null })) };
          }
          case 'where': {
            // (a check's read of the player: the place, and whether the body on the level's shapes moves it)
            const b = body();
            return b ? { at: b.at.map((v) => Math.round(v * 100) / 100), body: Boolean(b.mover), grounded: b.grounded ?? null, interact: Boolean(b.interact) } : null;
          }
          case 'place': {
            // (a check's walk of the map: the player's soldier stood at [x, z] on the sim's ground, and what the ground and the mask say there)
            const b = body();
            if (!b || !sim.nav) return { ok: false, why: b ? 'no nav' : 'not deployed' };
            const [x, z, y = null] = arg;
            b.at[0] = x;
            b.at[2] = z;
            b.at[1] = y ?? navHeight(sim.nav, x, z);
            return { ok: true, at: b.at.slice(), terrain: level.heightAt(x, z), walkable: walkable(sim.nav, x, z) };
          }
          case 'gpu':
            return rt.gfx.backend;
          case 'ragdolls':
            return ragdolls.count();
          default:
            return { ok: false, why: `no action ${action}` };
        }
      },
      view: snapshot,
      // a video control turned in the settings (lane V1): the chain built again
      // for the live fields (the shadows, the lights' pool and the maps take a
      // reload, which the panel offers)
      onVideo(values) {
        light.setVideo(values);
      },
      // the pace's step (the runtime, through quality.js): the chain built
      // again under it; the same level again changes nothing
      lowerQuality(next = 0) {
        const l = Math.max(0, Math.floor(next));
        if (l === paceLevel) return;
        paceLevel = l;
        swapPost(light.passes);
      },
      dispose() {
        look.detach();
        input.detach();
        director.dispose();
        sound.dispose();
        renderer.toneMappingExposure = baseExposure;
        post?.dispose?.();
        post = null;
        light.dispose();
        bolts.dispose();
        kitFx.dispose();
        figures.dispose();
        ragdolls.dispose();
        doorsScene?.dispose();
        level.dispose();
        walker?.dispose();
        collision?.dispose();
        physics?.dispose();
        if (typeof window !== 'undefined' && window.__battlefront?.world === world) delete window.__battlefront;
      },
    };
    // (`light` and `chain`: the light stack's parts and the chain as drawn, for a check in the browser)
    // (`sounds`: the player's counter by name and kind, the duck and the stem in force, the HDR window, for scripts/bf2017-sound-check.mjs)
    if (typeof window !== 'undefined') window.__battlefront = { world, view: snapshot, do: (a, x) => world.do(a, x), light, level, sounds: () => ({ ...sound.stats(), duck: sound.duckKind, music: sound.musicName, window: { ...director.state.window }, suppressed: director.state.suppressed, listener: director.state.listener }), get chain() { return post?.passes ?? null; }, get paceLevel() { return paceLevel; } };
    madeAt = now();
    return world;
  },
};
