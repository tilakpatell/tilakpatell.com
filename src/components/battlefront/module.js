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
// 'advance' seconds, 'win', 'lose', 'weather' name, 'gpu', 'ragdolls' (how
// many bodies fall, lie and wait: figures/ragdolls.js).

import * as THREE from 'three';
import { camerasOf, lightingOf, loadRulebook, mapOf, squadsOf } from '../../lib/battlefront/rulebook.js';
import { createLook } from '../../runtime/look.js';
import { overviewPose, soldierPose } from './camera.js';
import { createCameraRig } from './cameraRig.js';
import { createFigures } from './figures/figures.js';
import { RAGDOLLS, createRagdolls } from './figures/ragdolls.js';
import { createBolts } from './fx/bolts.js';
import { markerProjection } from './hud/widgets.js';
import { createInput } from './input.js';
import { createLevel } from './map/level.js';
import { armCaster, createLevelCollision, wantsEngine } from './map/collision.js';
import { STEP, addPlayer, createBattle, deploy, step, view } from './battle.js';
import { entryFor, lightsJsonOf } from './weather.js';

export const HUD_HZ = 8; // snapshots a second to the page
export const PLAYER_TEAM = 2; // the attackers on Hoth, the Empire (maps/hoth.stages.json)
export const FAR = 12000; // m: the camera's far plane (the record's ViewDistance is 10,000 on Hoth's day)
const MAX_STEPS = 10; // the sim's steps at most a frame (a tab back from the background)

export default {
  id: 'battlefront',
  shading: 'nodes',
  mb: 0,
  label: 'Hoth from Star Wars Battlefront II (2017), drawn from the game’s own level, light and figures. W A S D to move, the mouse to look and fire, Enter to deploy.',
  async create(rt, { level: levelName = 'hoth', mode = 'galacticAssault' } = {}) {
    const renderer = rt.gfx.renderer;
    const tier = rt.quality?.tier ?? 'high';
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
    const level = createLevel({ scene, tier, renderer, world: levelName, onCell: (k, b, band) => collision?.add(k, b, band), onDrop: (k) => collision?.drop(k) });
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
    const { applyGameLight } = await import('../../lib/three/light/apply.js');
    const light = await applyGameLight(scene, renderer, entryFor(lighting, weather), { tier, camera, lights: lightsJsonOf(lighting.lights) });
    // (?post=off in the address: the scene drawn with no chain, for a check)
    const asked = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search).get('post') : null;
    const post = light.passes.length && asked !== 'off' ? rt.gfx.post(light.passes) : null;

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
        player: p && { id: p.id, state: p.state, at: p.at.slice(), yaw: p.yaw, team: p.team, hp: p.hp, hpMax: p.hpMax, heat: p.heat, warning: p.warning, overheated: p.overheated, coolWindow: p.coolWindow, cls: p.cls, weapon: p.weapon, abilities: [1, 2, 3].map((slot) => ({ slot, recharge: 1, ready: true })) },
        mode: v.mode && { stageName: v.mode.stageName, objectives: v.mode.objectives.map((o) => ({ id: o.id, name: o.name, meter: o.meter, at: o.at })), tickets: v.mode.tickets, result: v.mode.result },
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
          step(sim, [{ id: me, move: once.move, yaw: once.yaw, pitch: once.pitch, fire: once.fire, aim: once.aim, sprint: once.sprint, crouch: once.crouch, vent: once.vent, ability: once.ability }]);
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
          level.update(p.at);
        } else {
          const towards = sim.objectives[0]?.at ?? [0, 0, 0];
          pose = overviewPose(map, towards) ?? pose;
          if (pose) level.update(pose.at);
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
        if (post) post.render();
        else r.render(scene, camera);
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
            sim.force(action, PLAYER_TEAM);
            rt.events.emit('hud', snapshot());
            return { ok: true };
          case 'weather':
            if (!lighting.weathers[arg]) return { ok: false, why: `no weather ${arg}` };
            weather = arg;
            light.setWeather(entryFor(lighting, arg), 0);
            return { ok: true };
          case 'gpu':
            return rt.gfx.backend;
          case 'ragdolls':
            return ragdolls.count();
          default:
            return { ok: false, why: `no action ${action}` };
        }
      },
      view: snapshot,
      dispose() {
        look.detach();
        input.detach();
        post?.dispose?.();
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
    if (typeof window !== 'undefined') window.__battlefront = { world, view: snapshot, do: (a, x) => world.do(a, x) };
    return world;
  },
};
