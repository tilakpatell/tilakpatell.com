// The Road through Middle-earth, the world module: one continuous ride
// from Bag End to the Grey Havens on the world runtime, on the node
// renderer (docs/superpowers/specs/2026-10-18-the-road-design.md). One
// number, the progress `s` along the sixteen stages, drives everything;
// the rules are pure files beside this one (line, clock, director,
// fellowship, daylight), and this file only draws.
//
// Props: { at: a stage id, or 'id:metres' | null, reduced }.
//
// Events to the page (rt.events): 'stage' { id, name, date, first } as a
// stage opens (not again for a lost context put back within a minute),
// 'mode' { auto, mode, holding } when the clock’s changes, 'progress'
// { s, stage, local } four times a second, 'resume' { id, name } when a
// save past the first stage is there to carry on from (the ride waits for
// the answer), 'menu' {} and 'lore' {} on their keys, 'end' { ridden } at the Havens,
// 'line' { who, text, at } as one of the cast says something (ambience.js).
// The world adds: goTo(stageId), setAuto(on), next() (reduced motion's Next, by touch or click), press(name, down) (the touch
// buttons), carryOn() (from a few metres before a moment the ride was left
// inside: ./carry.js), restart(), skipToEnd(); and set(s), `s`, `scene` for the checks.
// In development, window.__ROAD__ = { set(s), info(), world, weather, ambience, vision(on), fast(k), grid(), group(), land(), floor(x, z) }.

import * as THREE from 'three';
import { PACE, newClock, step as stepClock } from './clock';
import { SAVE, recent, resume, ridden as riddenOf, savedAt, shouldOffer } from './entry';
import { carryFrom } from './carry';
import { ABOVE_GROUND, LOOK_LIMIT, pose, settleLook } from './director';
import { keyLight, light as lightAt, refFloor, shadeOf, skyLight } from './daylight';
import { at as lineAt, sOf, total } from './line';
import { createSky } from './sky';
import { createLands } from './lands';
import { createBackdrop } from './backdrop';
import { soilOf } from './stages/soils';
import { createScatter } from './scatter';
import { createWeather } from './weather';
import { createAmbience } from './ambience';
import { loadKit } from '../../../lib/three/kitNodes';
import { createWind } from '../../../lib/three/windNodes';
import { chainFor, createRoadHouse, gradeNode } from './hooks';
import { newVision, stepVision } from './vision';
import { forgetCast, walker } from './cast';
import { clipFor, walkers as walkersAt } from './fellowship';
import { STAGES, modeAt, stageById } from './stages/index';
import { BEATS_OF } from './stages/registry';
import { createScenes } from './scenes';
import { createLamps } from './lamps';
import { CASTS } from './stages/parts';
import { createDoing } from './doing';
import { createClear, tooNear } from './clear';
import { LINES } from './voicelines';
import { ease as easePose } from './director';
import { MeshBasicNodeMaterial } from 'three/webgpu';

const TOTAL = total(STAGES);
// the marks the clock stops at or steps to: every written beat (with its
// hold) and every stage’s start (Next’s step where a stage has no beats yet)
const STARTS = STAGES.slice(1).map((st) => sOf(STAGES, st.id, 0));
const MARKS = [...STAGES.flatMap((st) => (BEATS_OF[st.id] ?? []).map((b) => ({ s: sOf(STAGES, st.id, b.at), hold: b.hold ?? 0 }))), ...STARTS.map((s) => ({ s, hold: 0 }))].sort((a, b) => a.s - b.s);
const nextMark = (s) => MARKS.find((m) => m.s > s + 1e-9)?.s ?? null;
const holdAt = (s) => MARKS.find((m) => Math.abs(m.s - s) < 1e-9 && m.hold > 0)?.hold ?? 0;
const BLEND = 1.2; // s a cut that is not a cut eases over
const SAVE_EVERY = 5; // s
const PROGRESS_EVERY = 0.25; // s
const LOOK_SPEED = 0.004; // radians a pixel of drag
const LOOK_REST = 0.25; // s after a drag before the look settles back
const FILE = 1.6; // m between walkers in the line
const ABREAST = 0.45; // m either side of the lane’s middle

export const KEYS = {
  walk: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  run: ['ShiftLeft', 'ShiftRight'],
  auto: ['Space'],
  next: ['Enter'],
  menu: ['Escape'],
  map: ['KeyM'],
  lore: ['KeyL'],
  // (a deed's keys: E to do it, A and D in turn for a rhythm; T for a word with the company)
  act: ['KeyE'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  talk: ['KeyT'],
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => [`stage${i + 1}`, [`Digit${n}`]])),
};

// 'moria' or 'moria:120' → s; anything else, the start
export function sFromAddress(at) {
  if (!at) return 0;
  const [id, metres] = String(at).split(':');
  if (!stageById(id)) return 0;
  return sOf(STAGES, id, Number(metres) || 0);
}

export default {
  id: 'road',
  shading: 'nodes',
  mb: 27, // (WORLD_MB’s, the ride measured whole)
  label: 'The Road through Middle-earth',
  create(rt, props = {}) {
    const scene = new THREE.Scene();
    // (out to 4.5 km: the far mountains on the horizon, backdrop.js)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4500);
    scene.fog = new THREE.FogExp2(0xc0c8d0, 0.004);
    const tier = rt.quality?.tier ?? 'high';
    // the house's look on the ground (and, with the post chain, on the rest);
    // the lands: the stage you are in and its two neighbours, built and placed
    // (the shade’s edge low: under a low sun the lit ground stood half in
    // the look’s shade already, and a shadow cast on it barely showed)
    const road = createRoadHouse({ edge: [0.1, 0.55] });
    const house = road.house;
    // the nature kits (the MegaKit, and the older pack’s maples, birches and
    // dead trees), one a kit and a tint (a season's recolouring), in the house and the wind
    const windTime = { value: 0 };
    const kits = new Map();
    const kitFor = (tint, pack = null) => {
      const kit = pack ?? 'naturemega';
      const key = `${kit}|${tint ? JSON.stringify(tint) : ''}`;
      if (!kits.has(key)) kits.set(key, loadKit(kit, { house, wind: { time: windTime }, tint }));
      return kits.get(key);
    };
    const scatter = createScatter({ kitFor, tier });
    scene.add(scatter.group);
    const sky = createSky({ vision: road.uVision });
    // one wind for the Road’s grass (lib/three/windNodes)
    const wind = createWind({ strength: 0.5 });
    // (the herds’ beasts through the runtime’s asset cache: the farm pack’s, CC0)
    const lands = createLands({ scene, house, tier, scatter, sky, wind, load: (url) => rt.assets?.gltf?.(url) });
    // the mountains on each stage’s horizon (stages/ranges.js)
    const mountains = createBackdrop({ road, tier, load: (url) => rt.assets?.gltf?.(url) });
    scene.add(mountains.mesh);
    // rain, snow, ash, fire: a kind a draw, asked for by the stages and their beats
    // the chain: the house’s bloom on every tier, the grade (the Ring’s, hooks.js) from high
    const passes = chainFor(tier, rt.gfx.backend, { scene, camera, grade: (tex) => gradeNode(tex, road.uVision) });
    const post = rt.gfx.post?.(passes) ?? null;
    // (the quads write the targets the chain’s scene pass has: a normal for AO, a velocity for TRAA)
    const has = (kind) => Boolean(post) && passes.some((p) => p.kind === kind);
    const weather = createWeather(rt.gfx.renderer, { tier, outputs: [has('ao') && 'normal', has('traa') && 'velocity'].filter(Boolean) });
    scene.add(weather.group);
    // the stage’s sound, the beats’ clips and the cast’s lines, on the runtime’s bus
    const ambience = createAmbience(rt);
    // the written stages’ scenes and their beats (scenes.js)
    // (their lamps through a pool of lights the scene always has, so no seam builds every shader again: lamps.js)
    const lamps = createLamps(scene);
    const scenes = createScenes({ rt, road, lands, weather, ambience, tier, sky, backdrop: mountains, lamps });
    // the black the Road’s first words are said over, lifting: a shell round the camera
    const veilMat = new MeshBasicNodeMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.BackSide, fog: false });
    const veil = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), veilMat);
    veil.renderOrder = 10000;
    veil.frustumCulled = false;
    veil.visible = false;
    scene.add(veil);
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x5a5040, 0.6);
    scene.add(sun, sun.target, hemi, sky.mesh);
    // the sun’s (and the moon’s) soft shadows, through cascades round the
    // camera (lib/three/light/sun.js), on mid and up: out to 60 m on high, 40
    // on mid, in two cascades (at 90 and four the cascades drew the Shire's
    // every hole and hedge four times over, a million and a half triangles
    // a frame; its statics are merged in bands, stages/parts.js, so each
    // cascade leaves out what it can't see); none on low. Three’s own PCF,
    // a little softened, on every backend: PCSS (shadows.js) drew no shadow
    // at all on the WebGL fallback, and its noise is a grain wherever no
    // TRAA settles it (its five taps dither too: kept to an edge)
    const renderer = rt.gfx?.renderer ?? null;
    const shadowWas = renderer?.shadowMap ? { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type } : null;
    const exposureWas = renderer?.toneMappingExposure ?? null;
    let cascades = null;
    let unlit = false;
    if (tier !== 'low' && renderer?.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      sun.shadow.radius = 1.5;
      // (and from the stages’ casters, a band’s statics as one shape a cascade, stages/parts.js:
      // a merged mesh a material a band cast, Hobbiton’s were 127 of a frame’s 230 shadow draws;
      // the cascades take this camera’s layers, so the casters are cast and never drawn)
      sun.shadow.camera.layers.enable(CASTS);
      import('../../../lib/three/light/sun')
        .then(async ({ castCascades }) => {
          if (unlit) return;
          const c = await castCascades(sun, null, { tier, filter: null, video: { shadowDistance: tier === 'mid' ? 40 : 60, cascades: 2 } });
          if (unlit) c?.dispose();
          else cascades = c;
        })
        .catch(() => {});
    }

    const reduced = Boolean(props.reduced);
    // (Enter is the Road's only under reduced motion, where it is Next: bound
    // otherwise, the runtime would keep it from a focused button, the resume
    // card's and the ribbon's)
    rt.input?.bind?.(reduced ? KEYS : Object.fromEntries(Object.entries(KEYS).filter(([k]) => k !== 'next')));
    rt.saves?.register?.({ key: SAVE.key, version: SAVE.version });
    const saved = rt.saves?.get?.(SAVE.key, null) ?? null;
    const now = () => Date.now();
    // where the ride starts: the save if it is under a minute old (a lost
    // context put back, whatever the address said); else the address; else
    // the save (carried on, or offered); else Bag End
    const fresh = recent(saved, now());
    const byAddress = Boolean(props.at) && !fresh;
    const back = byAddress ? null : resume(saved, now());
    const offer = !byAddress && back.showTitle && shouldOffer({ s: back.s });
    let clock = newClock({ s: byAddress ? sFromAddress(props.at) : back.s, reduced, auto: !offer });
    // (opened on a beat’s mark, Bag End’s first words among them: it holds there first)
    if (!offer) clock = { ...clock, holdLeft: holdAt(clock.s) };
    let jumped = true; // (the first frame is a jump: nothing behind it plays)
    let lastSince = {}; // (the beats’ seconds, for the development hook’s info)
    let labPace = 1; // (the development hook’s fast(k): k seconds of the ride to a frame’s one)
    let shot = null; // { key, from (pose), t }: the camera’s blend between rigs
    let lastPose = null;
    let fxVision = false;
    let shook = 0; // s the frame has been shaken, for the jolt’s phase
    let wasRidden = riddenOf(saved);
    let riddenOn = saved?.on ?? null; // (the day it was first ridden, for the journal)
    // (the share walked, not jumped: what makes the ride ridden)
    let walked = byAddress || !back.s ? 0 : (saved?.walked ?? 0);
    // (a ride opened by its address writes nothing over the visitor's own
    // until they walk it)
    let saving = !byAddress;
    let stageId = null;
    let quietTitle = !byAddress && (!back.showTitle || offer);
    let lastMode = '';
    let sinceSave = 0;
    let sinceProgress = PROGRESS_EVERY;
    let still = 0; // s since the last drag
    let ended = clock.s >= 1;
    const touch = { walk: false, run: false };
    // (the page's Next, a touch or a click, under reduced motion: taken by the next step, as an Enter)
    let nudged = false;
    // (what's said before the page listens is held for it, as fromScene holds
    // a scene's: the first stage's card is told on the first frame)
    let held = [];
    const tell = (type, data = {}) => {
      if (held) held.push([type, data]);
      else rt.events?.emit?.(type, data);
    };
    // what the visitor does: the deeds the walk waits on, and a word with the company
    const doing = createDoing({ stages: STAGES, beatsOf: BEATS_OF, lines: LINES, tell, say: (who, text) => ambience.say(who, text), clip: (id) => ambience.clip(id), reduced });
    doing.jumped(clock.s);
    let present = []; // the ids walking now, as the last frame had them
    const look = { yaw: 0, pitch: 0 };
    // who walks with you: made as they join, gone as they leave
    const cast = new Map(); // id → walker
    let castKey = '';
    let seeds = 0;
    const company = () => {
      const line = walkersAt(STAGES, clock.s);
      const key = line.map((w) => w.id).join(',');
      if (key !== castKey) {
        castKey = key;
        for (const [id, w] of cast) {
          if (line.some((x) => x.id === id)) continue;
          w.dispose();
          cast.delete(id);
        }
        for (const { id } of line) {
          if (cast.has(id)) continue;
          const w = walker(id, { rt, seed: ++seeds });
          cast.set(id, w);
          scene.add(w.group);
        }
      }
      return line;
    };
    const sunDir = new THREE.Vector3();
    const shade = new THREE.Color();

    // the light for where the ride is: the sky, the sun, the fog
    let daylight = null;
    // the Ring: on while a beat holds it (or the check’s hook), its amount every material’s uVision
    let vision = newVision();
    let visionOn = false;
    let sinceAdopt = Infinity;
    const relight = () => {
      const l = lightAt(STAGES, clock.s);
      daylight = l;
      sky.set(l);
      mountains.set(l);
      weather.light(l);
      // the sun by day, the moon by night (daylight.js’s keyLight)
      const key = keyLight(l);
      sunDir.set(...key.dir);
      sun.color.setRGB(...key.colour);
      sun.intensity = key.intensity;
      hemi.intensity = skyLight(l);
      hemi.color.setRGB(...l.fog.colour);
      // (the light off the ground: the stage’s own grass, or its snow, its stone,
      // its ash; in Mordor the fires’ red glow, its soil’s own `glow`, up under everything)
      const soil = soilOf(lineAt(STAGES, clock.s).stage);
      hemi.groundColor.setHex(soil.glow ?? soil.greens[1]).multiplyScalar(soil.glow ? 1 : 0.6);
      // the stage’s exposure, lifted from a little before sunset as an eye opens to the dark (the chapters’ nights are 1.6)
      if (renderer) renderer.toneMappingExposure = l.exposure * (1 + 0.55 * Math.min(1, Math.max(0, (0.1 - l.sun.el) / 0.45)) * (1 - (l.murk ?? 0)));
      scene.fog.color.setRGB(...l.fog.colour);
      // (the fog throbs with the vision’s pulse)
      scene.fog.density = l.fog.density * (1 + 0.35 * vision.amount * (1 + vision.pulse));
      house.sky({ low: scene.fog.color, high: scene.fog.color, sunDir });
      house.light({ sun, hemi });
      // (never measured against less than the shade's floor stands for: daylight.js's refFloor)
      refFloor(house.uniforms.uLookRef.value);
      // (the shade from the light there is: a clear day’s pale lilac, a fainter blue under the moon)
      house.set({ shadow: shade.setRGB(...shadeOf(l, key)) });
    };

    // a beat’s fixed camera given over the ground: its heights put on the land
    const above = (p) => [p[0], p[1] + lands.heightAt(p[0], p[2]), p[2]];
    // (each walker’s own, so a scene may keep it till its update)
    const tips = new Map();
    const tipOf = (id) => {
      if (!tips.has(id)) tips.set(id, new THREE.Vector3());
      return tips.get(id);
    };
    // nothing walked or seen through (clear.js, on the stage's solids.js grid,
    // in its land's frame: the scene's, moved by where the land stands)
    const clear = createClear();
    const landAt = new THREE.Vector3();
    const inLand = (p) => [p[0] - landAt.x, p[1] - landAt.y, p[2] - landAt.z];
    // the camera on the director’s rig, following the lead along the stage
    const frame = (dt = 0) => {
      const here = lineAt(STAGES, clock.s);
      lands.at(here.index);
      mountains.at(here.stage);
      const grid = scenes.solids(here.index);
      const landGroup = lands.groupOf(here.index);
      if (landGroup) landGroup.getWorldPosition(landAt);
      else landAt.set(0, 0, 0);
      const line = company();
      present = line.map((w) => w.id);
      const mode = modeAt(stageById(here.stage), here.local);
      // the one you follow (Frodo while he walks with you) at the back of the
      // file, the rest ahead of him in their order, so none comes between
      // him and the camera
      const lead = Math.max(0, line.findIndex((w) => w.id === 'frodo'));
      const ahead = line.filter((_, i) => i !== lead);
      const leadAt = { x: -ABREAST, z: here.local };
      // (keeping still at a deed: the company down with the visitor, where the beat isn't placing them itself)
      const stance = doing.stance();
      for (const w of line) {
        const fig = cast.get(w.id);
        const rank = w.order === lead ? 0 : ahead.length - ahead.indexOf(w);
        const x = rank % 2 ? ABREAST : -ABREAST;
        const z = here.local + rank * FILE;
        // (on the land, or on what the stage’s scene carries them over it on)
        const ground = lands.heightAt(x, z);
        const floor = scenes.floor(here.index, x, z);
        const y = floor == null ? ground : Math.max(ground, floor);
        const base = clipFor(w.state, mode, w.id);
        // (and as the beat has them: sat by a fire, a torch in each hand, down on the ground;
        // `tip`: the head of what it holds, last frame, a staff’s where its light goes)
        const o = scenes.pose(here.index, w.id, { x, y, z, base, state: w.state, tip: fig.tip?.(tipOf(w.id)) ?? null, lead: leadAt }) ?? {};
        // (round what stands in their lane, where the beat isn't placing them itself)
        const [lx, , lz] = inLand([x, y, z]);
        const free = o.x == null ? x + clear.walker(w.id, { x: lx, z: lz, y: y - landAt.y }, grid, dt) - lx : x;
        fig.group.visible = !o.hide;
        fig.group.position.set(o.x ?? free, o.y ?? y, o.z ?? z);
        fig.group.rotation.y = o.yaw ?? 0;
        fig.set({ base: o.base !== undefined ? o.base : (stance ?? base), speed: stance && o.base === undefined ? 0 : (o.speed ?? clock.speed) });
        fig.tick(dt);
      }
      // the stage’s scene and its beats; the camera on the beat’s rig, eased into it unless it cuts
      const beat = scenes.at(here.index, here.local, dt, { speed: clock.speed, jumped, waits: doing.waits(here.stage) });
      lastSince = beat.since;
      jumped = false;
      veil.visible = beat.fx.black > 0;
      veilMat.opacity = beat.fx.black;
      fxVision = beat.fx.vision;
      const b = beat.shot && beat.shot.rig !== 'follow' ? beat.shot : null;
      const params = b?.params?.above ? { ...b.params, at: b.params.at && above(b.params.at), lookAt: b.params.lookAt && above(b.params.lookAt) } : (b?.params ?? {});
      // (the camera’s lead stands where the walkers do: up a stair, on a bridge, in a boat)
      const ground = lands.heightAt(-ABREAST, here.local);
      const carried = scenes.floor(here.index, -ABREAST, here.local);
      const leader = { at: [-ABREAST, carried == null ? ground : Math.max(ground, carried), here.local], heading: 0 };
      const want = pose({ rig: b?.rig ?? 'follow', params, lead: leader, tangent: [0, 0, 1], metres: here.local, look, mode: 'walk', reduced: clock.reduced, heightAt: lands.heightAt, t: b ? (beat.since[b.id] ?? 0) : 0 });
      const key = b?.id ?? 'follow';
      if (shot?.key !== key) shot = { key, from: lastPose, t: b?.cut === 0 || !lastPose ? BLEND : 0 };
      shot.t += dt;
      const p = clock.reduced ? want : easePose(shot.from ?? want, want, Math.min(1, shot.t / BLEND) ** 2 * (3 - 2 * Math.min(1, shot.t / BLEND)));
      lastPose = p;
      // (never in a wall: a shot hung off the lead comes in along its boom; a placed one out of what it's in)
      const eye = inLand([leader.at[0], leader.at[1] + 1.1, leader.at[2]]);
      const stand = clear.camera(inLand(p.at), eye, { rig: b?.rig ?? 'follow', lookAt: inLand(p.lookAt) }, grid, dt);
      camera.position.set(stand[0] + landAt.x, stand[1] + landAt.y, stand[2] + landAt.z);
      // (and over the land, whatever eased it or pulled it in: the director keeps the shot it wants
      // over it, but an ease between two shots, or a boom pulled in across a crest, went under a
      // hill, its faces culled from below; a shot placed down in the land, `under`, aside)
      if (!b?.params?.under) camera.position.y = Math.max(camera.position.y, lands.heightAt(camera.position.x, camera.position.z) + ABOVE_GROUND);
      camera.lookAt(...p.lookAt);
      // (nor in a figure: one the camera comes into is not drawn while it's there)
      const eyeAt = camera.position.toArray();
      for (const w of line) {
        const fig = cast.get(w.id);
        if (fig?.group.visible && tooNear(eyeAt, fig.group.position.toArray())) fig.group.visible = false;
      }
      // (a beat’s jolt: the frame knocked about and settling; never under reduced motion)
      if (beat.fx.shake > 0 && !clock.reduced) {
        shook += dt;
        const a = 0.14 * beat.fx.shake;
        camera.position.x += Math.sin(shook * 47) * a;
        camera.position.y += Math.sin(shook * 61 + 1) * a * 0.7;
        camera.rotation.z += Math.sin(shook * 39 + 2) * a * 0.12;
      }
      veil.position.copy(camera.position);
      if (camera.fov !== p.fov) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
      sun.position.copy(camera.position).addScaledVector(sunDir, 100);
      sun.target.position.copy(camera.position);
      cascades?.follow();
      cascades?.update(camera);
      lamps.update(camera);
      sky.update(camera, dt);
      return here;
    };
    // what the page hears: the stage as it opens, the clock’s mode, the
    // progress; and the save, every few seconds
    const report = (here, dt) => {
      if (here.stage !== stageId) {
        stageId = here.stage;
        ambience.stage(stageId);
        const st = stageById(stageId);
        if (!quietTitle) tell('stage', { id: st.id, name: st.name, date: st.date, first: clock.s === 0 && st.id === STAGES[0].id });
        quietTitle = false;
      }
      // (a deed waiting is a beat held too: the letterbox, the prompt out of its way)
      const holding = clock.mode === 'hold' || clock.mode === 'deed';
      const mode = `${clock.auto}:${clock.mode}`;
      if (mode !== lastMode) {
        lastMode = mode;
        tell('mode', { auto: clock.auto, mode: clock.mode, holding });
      }
      if ((sinceProgress += dt) >= PROGRESS_EVERY) {
        sinceProgress = 0;
        tell('progress', { s: clock.s, stage: here.stage, local: here.local });
      }
      if (walked >= 2 / 3) wasRidden = true;
      if ((sinceSave += dt) >= SAVE_EVERY) save();
      if (clock.s >= 1 && !ended) {
        ended = true;
        save();
        tell('end', { ridden: wasRidden });
      } else if (clock.s < 1) ended = false;
    };
    const save = () => {
      sinceSave = 0;
      if (!offerOpen && saving) {
        const next = savedAt(clock.s, now(), wasRidden, walked, riddenOn);
        riddenOn = next.on;
        rt.saves?.set?.(SAVE.key, next);
      }
    };
    let offerOpen = offer;
    const jump = (s) => {
      clock = { ...clock, s: Math.min(1, Math.max(0, s)), holdLeft: 0 };
      doing.jumped(clock.s);
      clear.reset();
      jumped = true;
      relight();
      // (the page told where the ride now is at once: the ribbon and the stage's name, not a quarter second on)
      sinceProgress = PROGRESS_EVERY;
      report(frame(), 0);
    };

    relight();
    frame();

    const world = {
      ready: rt.gfx.compile?.(scene, camera),
      resize(w, h) {
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
      },
      step(dt, input) {
        dt *= labPace; // (1 but in the lab, where a slow software frame is sped up to reach a beat)
        const nudge = nudged;
        nudged = false;
        const pressed = (name) => (name === 'next' && nudge) || KEYS[name].some((c) => input?.pressed?.has?.(c));
        // (while the resume card waits, nothing walks: Enter, under reduced
        // motion, is its yes; the card's own buttons take the rest)
        if (offerOpen) {
          if (clock.reduced && pressed('next')) world.carryOn();
          relight();
          report(frame(dt), dt);
          return;
        }
        if (pressed('menu')) tell('menu');
        if (pressed('lore')) tell('lore');
        // (while a word is to be chosen, the digits choose it rather than a stage)
        const choosing = doing.choosing();
        let pick = null;
        for (let i = 1; i <= 10; i++) {
          if (!pressed(`stage${i}`)) continue;
          if (choosing) pick ??= i - 1;
          else world.goTo(STAGES[i - 1].id);
        }
        const keys = {
          walk: touch.walk || Boolean(input?.action?.('walk')),
          run: touch.run || Boolean(input?.action?.('run')),
          back: Boolean(input?.action?.('back')),
          toggleAuto: pressed('auto'),
          next: pressed('next'),
        };
        // (the first key, touch or drag wakes the sound: the browser starts a context on a gesture only)
        if (keys.walk || keys.run || keys.back || keys.toggleAuto || keys.next || input?.pressed?.size || input?.pointer?.drag) ambience.wake();
        const was = clock.s;
        const at = lineAt(STAGES, clock.s);
        clock = stepClock(clock, dt, keys, { total: TOTAL, holdAt, nextBeat: nextMark, gate: doing.gate, holdAfter: doing.holdAfter, pace: PACE[modeAt(stageById(at.stage), at.local)] ?? 1 });
        // (the deed on the mark, if the walk waits on one; under reduced motion Enter does it too)
        const deedKeys = { act: pressed('act') || (clock.reduced && keys.next), acting: KEYS.act.some((c) => input?.keys?.has?.(c)), left: pressed('left'), right: pressed('right'), pick };
        doing.step(dt, deedKeys, { s: clock.s, stage: at.stage, since: lastSince, present, auto: clock.auto });
        if (pressed('talk')) doing.talk(at.stage, present);
        // (Next under reduced motion is how that ride is walked, so it counts)
        walked += Math.max(0, clock.s - was);
        if (clock.s !== was) saving = true;
        // the visitor’s look: a drag turns it, and it settles back once let go
        const drag = input?.pointer?.drag;
        if (drag && (drag.dx || drag.dy)) {
          look.yaw = Math.max(-LOOK_LIMIT.yaw, Math.min(LOOK_LIMIT.yaw, look.yaw - drag.dx * LOOK_SPEED));
          look.pitch = Math.max(-LOOK_LIMIT.pitch, Math.min(LOOK_LIMIT.pitch, look.pitch - drag.dy * LOOK_SPEED));
          still = 0;
        } else if ((still += dt) > LOOK_REST) Object.assign(look, settleLook(look, dt));
        relight();
        const here = frame(dt);
        report(here, dt);
        lands.step();
        vision = stepVision(vision, dt, { on: visionOn || fxVision });
        road.uVision.value = vision.amount;
        sky.wind(vision.wind);
        // (what has come into the scene since, in the vision’s hook: a stage, a pool, a figure)
        if ((sinceAdopt += dt) > 1) {
          sinceAdopt = 0;
          road.adopt(scene);
        }
        lands.water(dt, daylight);
        weather.update(dt, camera);
        ambience.update(dt);
        windTime.value += dt;
        wind.update(dt);
        lands.follow(camera);
        lands.life(dt);
        mountains.update(camera);
        scatter.update(camera, dt);
      },
      draw(f) {
        if (post) post.render();
        else (f?.renderer ?? rt.gfx.renderer).render(scene, camera);
      },
      wants: () => true,
      scene,
      anchor: () => camera.position.toArray(),
      lowerQuality() {},
      update() {},
      attached() {
        const was = held ?? [];
        held = null;
        for (const [type, data] of was) rt.events?.emit?.(type, data);
        report(frame(), 0);
        if (offerOpen) tell('resume', { id: stageId, name: stageById(stageId).name });
      },
      goTo(id) {
        if (stageById(id)) jump(sOf(STAGES, id, 0));
      },
      setAuto(on) {
        clock = { ...clock, auto: Boolean(on) && !clock.reduced, pausedUntil: 0 };
      },
      next() {
        nudged = true;
      },
      press(name, down) {
        if (name in touch) touch[name] = Boolean(down);
        else doing.press(name, down);
      },
      // (a deed's word, by its button)
      pick(i) {
        doing.pick(i);
      },
      // (a word with the company, by the Talk button)
      talk() {
        doing.talk(lineAt(STAGES, clock.s).stage, present);
      },
      carryOn() {
        if (!offerOpen) return;
        offerOpen = false;
        clock = { ...clock, auto: !clock.reduced };
        // (left inside one of the moments: a few metres before it, so it plays again, ./carry.js)
        const from = carryFrom(clock.s);
        if (from < clock.s) jump(from);
        const st = stageById(stageId);
        tell('stage', { id: st.id, name: st.name, date: st.date, first: false });
      },
      restart() {
        offerOpen = false;
        saving = true;
        // (a ride made this visit stays ridden: starting again only starts the count again)
        wasRidden ||= riddenOf(saved);
        walked = 0;
        stageId = null;
        clock = newClock({ s: 0, reduced: clock.reduced });
        jump(0);
        save();
      },
      skipToEnd() {
        offerOpen = false;
        saving = true;
        jump(1);
      },
      // (the checks’: put the ride at s and draw it there)
      set(s) {
        jump(s);
      },
      get s() {
        return clock.s;
      },
      dispose() {
        save();
        rt.input?.unbind?.();
        lands.dispose();
        wind.dispose();
        mountains.dispose();
        unlit = true;
        cascades?.dispose();
        if (shadowWas) Object.assign(renderer.shadowMap, shadowWas);
        if (exposureWas != null) renderer.toneMappingExposure = exposureWas;
        scatter.dispose();
        for (const k of kits.values()) k.dispose();
        sky.dispose();
        scenes.dispose();
        lamps.dispose();
        weather.dispose();
        veil.geometry.dispose();
        veilMat.dispose();
        post?.dispose?.();
        ambience.dispose();
        for (const w of cast.values()) w.dispose();
        forgetCast();
        if (typeof window !== 'undefined' && window.__ROAD__?.world === world) delete window.__ROAD__;
      },
    };
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      // (info: the last frame's draws and triangles, where the ride is, and the
      // lands' building times)
      const info = () => {
        const r = rt.gfx.renderer?.info?.render ?? {};
        return { calls: r.drawCalls ?? r.calls ?? 0, triangles: r.triangles ?? 0, vision: vision.amount, shot: shot?.key ?? null, mode: clock.mode, s: clock.s, stage: lineAt(STAGES, clock.s).stage, walkers: cast.size, lands: lands.stats, scatter: scatter.stats, since: lastSince, solids: scenes.solids(lineAt(STAGES, clock.s).index)?.filled() ?? null, boom: clear.boom, camera: camera.position.toArray().map((v) => Math.round(v * 100) / 100) };
      };
      // (and the stage the ride is in: its solid grid and its group, for lab/road/probe-walls.mjs)
      const here = () => lineAt(STAGES, clock.s).index;
      window.__ROAD__ = { world, set: (s) => world.set(s), info, weather, ambience, vision: (on) => void (visionOn = Boolean(on)), passes, fast: (k = 1) => void (labPace = Math.max(0, k)), grid: () => scenes.solids(here()), group: () => lands.groupOf(here()), land: () => lands.landOf(here()), floor: (x, z) => scenes.floor(here(), x, z) };
    }
    return world;
  },
};
