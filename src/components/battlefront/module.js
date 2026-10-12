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
// { classId }, 'pick' id, 'spawn' a squadmate's id (null for the HQ),
// 'advance' seconds, 'win', 'lose', 'die' (the player down: the kill
// screen), 'weather' name, 'look' { yaw, pitch } (the player's view, for
// a shot toward the sun), 'gpu', 'ragdolls' (how many bodies fall, lie
// and wait: figures/ragdolls.js).

import * as THREE from 'three';
import { textureTier } from '../../lib/video.js';
import { loadNavSearch } from '../../lib/battlefront/navWasm.js';
import { camerasOf, lightingOf, loadRulebook, mapOf, squadsOf } from '../../lib/battlefront/rulebook.js';
import { preloadDecoders } from '../../lib/three/gltf.js';
import { createLook } from '../../runtime/look.js';
import { overviewPose, soldierPose } from './camera.js';
import { createCameraRig } from './cameraRig.js';
import { recoilOf } from '../../lib/battlefront/weapons.js';
import { createFigures } from './figures/figures.js';
import { RAGDOLLS, createRagdolls } from './figures/ragdolls.js';
import { createBolts } from './fx/bolts.js';
import { markerProjection } from './hud/widgets.js';
import { createInput } from './input.js';
import { createLevel } from './map/level.js';
import { armCaster, createLevelCollision, wantsEngine } from './map/collision.js';
import { STEP, addPlayer, createBattle, deploy, step, view } from './battle.js';
import { entryFor, lightsJsonOf } from './weather.js';
import { litWith, picturesOf } from './picture.js';
import { headroom, upscaleKind } from '../../lib/three/light/post.js';
import { headroomAt } from '../../runtime/quality.js';

export const HUD_HZ = 8; // snapshots a second to the page
export const PLAYER_TEAM = 2; // the attackers on Hoth, the Empire (maps/hoth.stages.json)
export const FAR = 12000; // m: the camera's far plane (the record's ViewDistance is 10,000 on Hoth's day)
const MAX_STEPS = 10; // the sim's steps at most a frame (a tab back from the background)

export default {
  id: 'battlefront',
  shading: 'nodes',
  mb: 0,
  // The pace's steps are the chain's (lowerQuality): the canvas keeps its
  // size and the chain draws under it, upscaled back (lane U's headroom),
  // then sheds passes. Drawn at the screen's own pixels and no sharper:
  // ultra's budget asks for twice a plain monitor's (device.js's ratio 2),
  // which on a 5,120 × 1,440 desk is 29 million pixels a frame through a
  // chain of thirty passes; TRAA already smooths the edges that extra
  // ratio was for.
  sharpness: 'own',
  // (read as the world starts: the screen the window is on then)
  get ratio() {
    return typeof window !== 'undefined' ? Math.max(1, Math.min(2, window.devicePixelRatio || 1)) : 1;
  },
  label: 'Hoth from Star Wars Battlefront II (2017), drawn from the game’s own level, light and figures. W A S D to move, the mouse to look and fire, Enter to deploy.',
  async create(rt, { level: levelName = 'hoth', mode = 'galacticAssault' } = {}) {
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
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, FAR);
    // (the level's shapes round the player, for the camera's arm: lane P0's
    // engine where the tier and the screen take it, the cells as the stream
    // brings them)
    let collision = null;
    let physics = null;
    // (?level=gpu in the address: the level on GPU-first lane N1's scene,
    // the rows culled by compute and one indirect draw a material group, so
    // the level costs the frame no JavaScript a draw. Wired, not yet the
    // default: on Hoth its cull keeps every row out (5,813 of 6,050 culled,
    // nothing drawn) and the textures its groups hold are disposed under
    // them; lane L's instanced path draws until that is found)
    const flags = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search) : null;
    const gpuScene = rt.gfx.backend === 'webgpu' && flags?.get('level') === 'gpu';
    const level = createLevel({ scene, tier, texTier: textureTier(tier, rt.video), renderer, world: levelName, gpuScene, onCell: (k, b, band) => collision?.add(k, b, band), onDrop: (k) => collision?.drop(k) });
    // (the ragdoll book, 144 KB, comes after the page: no body falls as one until it has)
    const ragdolls = createRagdolls({ book: import('../../data/bf2017/physics/ragdoll.json').then((m) => m.default), floorAt: (x, z) => level.heightAt(x, z), max: RAGDOLLS[tier] ?? RAGDOLLS.mid });
    const figures = createFigures({ scene, ragdolls });
    const bolts = createBolts(scene);
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
      collision = createLevelCollision({ pack: level.pack, loadBin: level.loadBin, physics, tier });
    };
    // (the navgrid's mask, the pack's nav.bin: where the game's shapes leave no room to walk)
    const [mask] = await Promise.all([level.navOf(), engine().catch(() => null)]);
    const sim = createBattle({ rulebook: rb, level: levelName, mode, heightAt: (x, z) => level.heightAt(x, z), mask });
    const me = addPlayer(sim, { team: PLAYER_TEAM });
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
    let weather = lighting.default;
    let clock = 0; // s the world has drawn: a drawn bolt's age

    const look = createLook({
      host: rt.gfx.canvas,
      mode: 'lock',
      onTurn: (dx, dy) => input.turn(dx, dy),
      onButton: (which, down) => input.button(which === 0 ? 'left' : 'right', down),
      active: () => sim.player?.state === 'alive',
    });
    look.attach();

    // the camera's arm against the ground and the level's shapes (the navgrid's with no engine)
    const castArm = armCaster({ heightAt: (x, z) => level.heightAt(x, z), collision, nav: sim.nav });

    const doDeploy = (classId = picked) => {
      const base = classId ? { classId } : {};
      let r = deploy(sim, me, mate ? { ...base, spawn: 'squad', mate } : base);
      // (a mate who cannot be spawned on by now: the HQ, as the game falls back, SpawnOnSpawnEntityIfSpawnOnPlayerFails)
      if (!r.ok && mate && squadsOf(rb).fallbackToPoint) r = deploy(sim, me, base);
      if (r.ok) {
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
    const light = await applyGameLight(scene, renderer, first.entry, { tier, video: rt.video ?? null, camera, lights: lightsJsonOf(lighting.lights), picture: first.picture, cadence: true, onChain: (passes) => swapPost(passes) });
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
    // (the old chain draws until the new one is built, then is let go)
    function swapPost(passes) {
      if (!post) return;
      const next = rt.gfx.post(chainFor(passes));
      Promise.resolve(next.ready).then(() => {
        // (the world left while it was built)
        if (!post) return next.dispose?.();
        const was = post;
        post = next;
        was.dispose?.();
      });
    }

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
        player: p && { id: p.id, state: p.state, at: p.at.slice(), yaw: p.yaw, team: p.team, hp: p.hp, hpMax: p.hpMax, heat: p.heat, warning: p.warning, overheated: p.overheated, coolWindow: p.coolWindow, cls: p.cls, weapon: p.weapon, hitAt: p.hitAt, killAt: p.killAt, evade: 2, abilities: p.abilities?.length ? p.abilities : [1, 2, 3].map((slot) => ({ slot, recharge: 1, ready: true })), shield: p.shield, over: p.over, flashed: p.flashed, ability: p.ability },
        mode: v.mode && { stageName: v.mode.stageName, objectives: v.mode.objectives.map((o) => ({ id: o.id, name: o.name, meter: o.meter, at: o.at })), tickets: v.mode.tickets, result: v.mode.result },
        // (the radar's soldiers: who, where, which side, up or down, firing)
        entities: v.entities.map((e) => ({ id: e.id, team: e.team, kind: e.kind, at: e.at, alive: e.alive, firing: e.firing })),
        killLog: v.killLog.slice(),
        scoreboard: v.scoreboard,
        showScoreboard: scoreboard,
        markers,
        level: { loaded: level.loaded(), progress: level.progress(), ...level.stats(), physics: physicsStats() },
        backend: rt.gfx.backend,
        weather,
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
        const v = view(sim);
        input.swallow(v.deploy.open);
        if (v.deploy.open && read.deploy) doDeploy();
        acc = Math.min(acc + dt, STEP * MAX_STEPS);
        let first = true;
        while (acc >= STEP) {
          acc -= STEP;
          lastAt = body()?.at.slice() ?? null;
          const once = first ? read : { ...read, jump: false, roll: false, ability: 0, vent: false, interact: false };
          first = false;
          step(sim, [{ id: me, move: once.move, yaw: once.yaw, pitch: once.pitch, fire: once.fire, aim: once.aim, sprint: once.sprint, crouch: once.crouch, vent: once.vent, ability: once.ability, abilityHeld: once.abilityHeld }]);
        }
        collision?.update(4);
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
        } else {
          const towards = sim.objectives[0]?.at ?? [0, 0, 0];
          pose = overviewPose(map, towards) ?? pose;
          if (pose) level.update(pose.at);
          rig.aim([0, 0]);
        }
        if (pose) rig.set(pose);
        rig.update(dt);
        figures.update(v.entities, dt, Math.min(1, acc / STEP), camera.position);
        ragdolls.update(dt);
        clock += dt;
        // (each bolt leaves its owner's gun: fx/bolts.js)
        bolts.update(v.bolts, { muzzleOf: figures.muzzleOf, now: clock });
        light.update(dt, camera);
        sinceHud += dt;
        if (sinceHud >= 1 / HUD_HZ) {
          sinceHud = 0;
          rt.events.emit('hud', snapshot());
        }
      },
      draw({ renderer: r }) {
        level.beforeRender(camera);
        if (post) post.render();
        else r.render(scene, camera);
        level.afterRender();
      },
      wants: () => true,
      do(action, arg) {
        switch (action) {
          case 'deploy':
            return doDeploy(arg?.classId ?? picked);
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
            sim.force(action, PLAYER_TEAM);
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
        post?.dispose?.();
        post = null;
        light.dispose();
        bolts.dispose();
        figures.dispose();
        ragdolls.dispose();
        level.dispose();
        collision?.dispose();
        physics?.dispose();
        if (typeof window !== 'undefined' && window.__battlefront?.world === world) delete window.__battlefront;
      },
    };
    // (`light` and `chain`: the light stack's parts and the chain as drawn, for a check in the browser)
    if (typeof window !== 'undefined') window.__battlefront = { world, view: snapshot, do: (a, x) => world.do(a, x), light, level, get chain() { return post?.passes ?? null; }, get paceLevel() { return paceLevel; } };
    return world;
  },
};
