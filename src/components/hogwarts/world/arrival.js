// The arrival (the design’s §4.2): the first-years’ night, on rails. Hogsmeade
// station with the train steaming and Hagrid’s lantern; down to the water
// and across the Black Lake in the boats, the castle coming up lit over the
// water with the moon over the Astronomy Tower and, once, the giant squid’s
// arm; in under the cliff to the harbour, up the long stair to the great
// doors and McGonagall; the Great Hall under its candles; and the Sorting.
// Three to four minutes with nobody touching anything (rules/arrival.js’s
// clock), skippable with Enter once seen (straight to the steps), opened at
// a beat by ?at= (the hall: ?at=hall), and cut, never glided, under reduced
// motion.
//
// The world module hands over its scene, camera and the shore’s pieces; this
// drives the camera on shots.js’s shots, shows each part’s set, and tells
// the page what happens. Events (tell): 'arrival' { on, part, beat, skippable },
// 'line' { who, name, text }, 'ask' { q }, 'answered' { q, a, by },
// 'sorted' { house, second, password, wand, said }, 'end' {}.
//
//   createArrival({ rt, scene, camera, house, tier, reduced, anchors, heightAt,
//     sky, lake: [objects shown on the lake], hide: [the shore’s own boats],
//     rooms (rooms/host.js), tell, saves, night(), dim(k) })
//     night(): the world’s clock put on to the night; dim(k): the world’s moon and sky light at k of themselves
//     → { active, start(at), skip(), answer(i), step(dt, pressed), info(), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { ASK_AT, BEATS, END, answerRide, canSkip, newRide, rideAt, skipRide, stepRide } from '../rules/arrival';
import { sort } from '../rules/sorting';
import { wandFor } from '../rules/wand';
import { NAMES, say } from '../rules/lines';
import { SAVE, blank, migrate, withArrival, withSorting } from '../rules/save';
import { ANCHORS_A, boatsAt, moonFor, routeOf, shotFor, squidAt } from './arrival/shots';
import { createFlotilla } from './arrival/flotilla';
import { createCliff, createMist, createSquid } from './arrival/water';
import { createStation } from './arrival/station';
import { createSteps } from './arrival/steps';
import { createHat } from './arrival/hat';
import { createRoomKit } from '../rooms/kit';
import { ROOM_ORIGIN } from '../rooms/host';
import { forgetCrowds, prebake } from '../cast/crowd';
import { CROWD, forgetFigures } from '../cast/figures';

// where the sets stand: the station and the steps far off the lake, each
// with nothing round it but the sky (the grounds hidden while you’re there)
export const SETS = { station: [0, -900, 0], steps: [0, -1400, 0], hall: ROOM_ORIGIN };

const BLEND = 1.6; // s a shot eases into the next, where it doesn’t cut
// beats that open on a cut (the rest ease in from the shot before)
const CUTS = new Set(['station', 'hagrid', 'path', 'pushoff', 'glide', 'squid', 'cliff', 'boathouse', 'doors', 'hall', 'hat']);
// the black between the parts: in at a beat’s start, out at its end (seconds)
const FADES = { station: { in: 2.5 }, platform: { out: 1.4 }, path: { in: 1.2 }, cliff: { out: 3 }, boathouse: { in: 1.8 }, doors: { out: 1.2 }, hall: { in: 1.2 }, stool: { out: 0.6 }, hat: { in: 0.8 } };
const PART_OF = Object.fromEntries(BEATS.map((b) => [b.id, b.part]));
const AT_OF = Object.fromEntries(BEATS.map((b) => [b.id, b.at]));
const NEXT_AT = Object.fromEntries(BEATS.map((b, i) => [b.id, BEATS[i + 1]?.at ?? END]));
const SQUID_AT = 2.5; // s into its beat the arm breaks the water

export function createArrival({ rt = null, scene, camera, house = null, tier = 'high', reduced = false, anchors = ANCHORS_A, heightAt = () => 0, sky = null, lake = [], hide = [], rooms = null, tell = () => {}, saves = null, night = () => {}, dim = () => {} }) {
  const route = routeOf(anchors.route);
  const kit = createRoomKit({ house, tier });
  const group = new THREE.Group();
  group.name = 'arrival';
  scene.add(group);
  // the boats, the mist and the squid on the lake
  const flotilla = createFlotilla({ rt, kit, tier, route, water: anchors.water });
  const mist = createMist({ route, water: anchors.water, tier });
  const [qx, qz] = squidAt(route);
  const across = route.at(262);
  const squid = createSquid({ at: [qx, anchors.water, qz], toward: [-across.tz, across.tx] });
  // (a cliff of its own where the world has none: `cliff: false` where the castle’s hill comes down to the water)
  const cliff = anchors.cave && anchors.cliff !== false ? createCliff({ at: anchors.cave, water: anchors.water, kit }) : null;
  // the station and the steps, each at its own place
  const station = createStation({ rt, kit, tier, at: SETS.station });
  const steps = createSteps({ rt, kit, tier, at: SETS.steps });
  const hat = createHat({ kit, tier, load: rt?.assets?.gltf ? (url) => rt.assets.gltf(url) : null });
  group.add(flotilla.group, mist.group, squid.group, station.group, steps.group, hat.group);
  if (cliff) group.add(cliff.group);
  // (the cliff’s rock is the arrival’s own kit’s: merged on the lake with the rest of it)
  const statics = new THREE.Group();
  statics.name = 'arrival:statics';
  kit.build(statics);
  group.add(statics);
  house?.adopt?.(group);
  // (the figures come in late: the house’s look put on them as they do)
  Promise.all([flotilla.ready, station.ready, steps.ready])
    .then(() => !gone && house?.adopt?.(group))
    .catch(() => {});

  // the black between the parts: a sheet just in front of the eye
  const veilMat = new MeshBasicNodeMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
  veilMat.userData.noHouse = true;
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), veilMat);
  veil.renderOrder = 10000;
  veil.frustumCulled = false;
  veil.visible = false;
  scene.add(veil);

  saves?.register?.({ ...SAVE, migrate });
  let save = migrate(saves?.get?.(SAVE.key, null));
  // (the arrival’s own keys only, over what is stored now: the term writes
  // its keys beside them during the visit, and a copy read at the start
  // would put the term back where it was)
  const persist = (next) => {
    save = next;
    const now = migrate(saves?.get?.(SAVE.key, null));
    saves?.set?.(SAVE.key, { ...now, ...Object.fromEntries(Object.keys(blank()).map((k) => [k, next[k]])) });
  };

  let ride = null;
  let beat = null;
  let since = 0; // s into the beat
  let shot = null; // { key, from, t }
  let lastPose = null;
  let part = null;
  let hall = null; // the Great Hall, while the arrival is in it
  let entering = null;
  let sorted = null;
  let queue = []; // the Hat’s words, said one after another
  let sayIn = 0;
  let t = 0;
  let squidPlayed = false;
  let moonSet = null;
  let gone = false;
  let skippable = false;

  const show = (p) => {
    const onLake = p === 'station' ? false : p === 'boats' || p === 'path';
    for (const o of lake) if (o) o.visible = onLake;
    for (const o of hide) if (o) o.visible = false;
    flotilla.set({ visible: onLake });
    statics.visible = onLake;
    if (cliff) cliff.group.visible = onLake;
    // (no moon in the harbour, the stair or the Entrance Hall, and no sky: the torches light them)
    dim(p === 'steps' ? 0.12 : 1);
    if (sky?.mesh) sky.mesh.visible = p !== 'steps';
    mist.group.visible = onLake && p === 'boats';
    station.group.visible = p === 'station';
    steps.group.visible = p === 'steps';
    hat.group.visible = p === 'hall' || p === 'sorting';
  };
  const lineOf = (who, key) => {
    const l = say(who, key);
    tell('line', l);
  };
  const enterHall = () => {
    if (hall || entering || !rooms) return;
    entering = rooms
      .enter('greatHall', { walk: false, props: { hour: 21, people: true } })
      .then((r) => {
        entering = null;
        if (gone || !ride) return rooms.leave({ quiet: true });
        hall = r;
        // (the Hat on its stool before the high table, in the hall’s frame)
        hat.place(hall, ROOM_ORIGIN);
      })
      .catch(() => (entering = null));
  };

  const partOf = (id) => (id === 'path' ? 'path' : PART_OF[id] === 'station' ? 'station' : PART_OF[id] === 'boats' ? 'boats' : PART_OF[id] === 'steps' ? 'steps' : 'hall');

  const onEvents = (events) => {
    for (const e of events) {
      if (e.type === 'beat') {
        beat = e.id;
        since = 0;
        const p = partOf(e.id);
        if (p !== part) {
          part = p;
          show(p);
          // (the hall’s school baked while the boats cross, so its benches are full as the doors open)
          if (p === 'boats' || p === 'steps') prebake(rt, CROWD, { idle: 'sit.idle', cheer: 'sit.cheer' }, { tier }).catch(() => {});
          if (p === 'hall') enterHall();
          else if (hall) {
            rooms?.leave({ quiet: true });
            hall = null;
          }
        }
        tell('arrival', { on: true, part, beat, skippable: (skippable = canSkip(ride, save.arrived)) });
      } else if (e.type === 'line') lineOf(e.who, e.key);
      else if (e.type === 'ask') tell('ask', { q: e.q });
      else if (e.type === 'answer') tell('answered', { q: e.q, a: e.a, by: e.by });
      else if (e.type === 'sort') {
        const result = sort(e.answers);
        const wand = wandFor(e.answers, result.house);
        sorted = { ...result, wand };
        persist(withSorting(save, { answers: e.answers, result, wand, now: Date.now() }));
        // the Hat thinks aloud, then calls it; the table cheers on the call
        queue = result.said.map((text, i) => ({ text, call: i === result.said.length - 1 }));
        sayIn = 0;
        tell('sorted', { house: result.house, second: result.second, password: result.password, wand, said: result.said });
      } else if (e.type === 'end') finish();
    }
  };

  const finish = () => {
    if (!ride) return;
    persist(withArrival(save));
    ride = null;
    veil.visible = false;
    hat.group.visible = false;
    flotilla.set({ visible: false });
    mist.group.visible = false;
    station.group.visible = false;
    steps.group.visible = false;
    statics.visible = false;
    if (cliff) cliff.group.visible = false;
    dim(1);
    // (the shore as it was: its own boats back at the jetty; while you’re in the hall the room keeps it hidden)
    for (const o of hide) if (o) o.visible = true;
    if (!rooms?.room) {
      for (const o of lake) if (o) o.visible = true;
      if (sky?.mesh) sky.mesh.visible = true;
    }
    // (you stay in the hall, stood at your house’s table, the term begun: in
    // the middle of the aisle beside it, clear of the benches and their heads)
    if (hall && rooms) {
      const table = hall.plan?.tables?.find((x) => x.house === sorted?.house) ?? hall.plan?.tables?.[0];
      const at = table ? [table.x + (table.x < 0 ? 2.2 : -2.2), -10] : [0, 20];
      rooms.walk?.(at, 0);
    }
    hall = null;
    tell('arrival', { on: false });
    tell('end', { house: sorted?.house ?? save.house });
  };

  const veilFor = () => {
    const f = FADES[beat];
    if (!f || !beat) return 0;
    const span = NEXT_AT[beat] - AT_OF[beat];
    let k = 0;
    if (f.in) k = Math.max(k, 1 - since / f.in);
    if (f.out) k = Math.max(k, 1 - (span - since) / f.out);
    return Math.max(0, Math.min(1, k));
  };

  const place = (dt) => {
    const span = Math.max(0.1, NEXT_AT[beat] - AT_OF[beat]);
    // (the Hat’s beat holds while the questions are put: its shot holds still with it)
    const k = beat === 'hat' ? Math.min(1, since / Math.max(0.1, ASK_AT - AT_OF.hat)) : since / span;
    const want = shotFor(beat, k, { anchors, route, heightAt, sets: SETS, reduced });
    if (shot?.key !== beat) shot = { key: beat, from: lastPose, t: CUTS.has(beat) || !lastPose || reduced ? BLEND : 0 };
    shot.t += dt;
    const b = Math.min(1, shot.t / BLEND);
    const e = b * b * (3 - 2 * b);
    const mix = (a, c) => a.map((v, i) => v + (c[i] - v) * e);
    const p = shot.from && e < 1 ? { at: mix(shot.from.at, want.at), look: mix(shot.from.look, want.look), fov: shot.from.fov + (want.fov - shot.from.fov) * e } : want;
    lastPose = p;
    camera.position.set(...p.at);
    camera.lookAt(...p.look);
    if (Math.abs(camera.fov - p.fov) > 1e-3) {
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
    }
    // the black, just in front of the eye
    const v = veilFor();
    veil.visible = v > 0.001;
    veilMat.opacity = v;
    if (veil.visible) {
      veil.position.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 0.5);
      veil.quaternion.copy(camera.quaternion);
    }
  };

  const api = {
    get active() {
      return Boolean(ride);
    },
    get save() {
      return save;
    },
    start(at = null) {
      night();
      ride = newRide({ at, seed: (Date.now() >>> 0) ^ 0x5eed });
      beat = null;
      part = null;
      shot = null;
      lastPose = null;
      sorted = null;
      queue = [];
      squidPlayed = false;
      moonSet = null;
      const first = stepRide(ride, 0);
      ride = first.ride;
      onEvents(first.events);
      return true;
    },
    // Enter, once the arrival has been seen whole: straight to the steps
    skip() {
      if (!ride || !canSkip(ride, save.arrived)) return false;
      const s = skipRide(ride);
      ride = s.ride;
      onEvents(s.events);
      return true;
    },
    answer(i) {
      if (!ride) return;
      const s = answerRide(ride, i);
      ride = s.ride;
      onEvents(s.events);
    },
    step(dt, pressed = () => false) {
      if (!ride) return false;
      t += dt;
      if (pressed('skip')) api.skip();
      since += dt;
      const s = stepRide(ride, dt);
      ride = s.ride;
      onEvents(s.events);
      if (!ride) return false;
      place(dt);
      // the boats, the mist and the arm on the water
      if (part === 'boats' || part === 'path') {
        const span = Math.max(0.1, NEXT_AT[beat] - AT_OF[beat]);
        const lead = beat === 'path' ? -6 : boatsAt(beat, Math.min(1, since / span));
        flotilla.place(Math.min(route.length, lead), t, camera, dt);
        mist.update(camera, t);
        mist.set({ thick: beat === 'castle' ? Math.max(0.35, 1 - since / 20) : 1 });
        // (the moon set over the Astronomy Tower from where the castle comes up, once)
        if (!moonSet && sky?.uniforms?.moonDir && (beat === 'glide' || beat === 'castle')) moonSet = moonFor(shotFor('castle', 0.6, { anchors, route }).at, anchors.crown, 0.05);
        if (moonSet && sky?.uniforms?.moonDir) sky.uniforms.moonDir.value.set(...moonSet);
        if (beat === 'squid' && !squidPlayed && since > SQUID_AT) {
          squidPlayed = true;
          squid.play(reduced ? 6 : 9);
        }
        squid.update(dt);
      }
      if (part === 'station') station.step(dt, { camera, beat, since });
      if (part === 'steps') steps.step(dt, { camera, beat, since });
      if (hall) {
        rooms.step(dt, null, null);
        hat.step(dt, { camera, beat, since, under: beat === 'hat' || beat === 'house' });
        // the Hat’s words, one after another, and the cheer on the call
        if (queue.length && (sayIn -= dt) <= 0) {
          const next = queue.shift();
          tell('line', { who: 'hat', name: NAMES.hat, text: next.text });
          sayIn = 3.2;
          if (next.call && sorted) hall.cheer?.(sorted.house, 8);
        }
      }
      return true;
    },
    info: () => ({ beat, part, t: ride?.t ?? null, since, asking: ride?.asking ?? null, sorted: sorted?.house ?? null, flotilla: flotilla.crowd.info(), skippable }),
    // (for the checks: the ride put at a beat)
    jump(at) {
      if (!ride) api.start(at);
      else {
        ride = { ...newRide({ at }), seed: ride.seed };
        const s = stepRide(ride, 0);
        ride = s.ride;
        onEvents(s.events);
      }
    },
    dispose() {
      gone = true;
      flotilla.dispose();
      mist.dispose();
      squid.dispose();
      cliff?.dispose();
      station.dispose();
      steps.dispose();
      hat.dispose();
      kit.dispose();
      forgetCrowds();
      forgetFigures();
      veil.geometry.dispose();
      veilMat.dispose();
      veil.removeFromParent();
      group.removeFromParent();
    },
  };
  // (a visitor sorted on an earlier visit: the HUD takes their house from the start)
  if (save.house) tell('house', { house: save.house, wand: save.wand });
  return api;
}

// (rideAt is the page’s, for ?at= read before the world starts)
export { rideAt };
