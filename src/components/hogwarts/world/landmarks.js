// The grounds’ landmarks (the design’s §4.3), each a file in grounds/,
// put together for grounds.js: the Whomping Willow on its slope, Hagrid’s
// hut with its pumpkins and its paddock, the greenhouses’ insides and their
// Tentacula, the Quidditch pitch, the forest’s edge, the covered bridge’s
// sway and the stone circle, Hogsmeade station. What each does to you comes
// back as one answer a frame for the module to act on: a prompt, a line, a
// throw, a turn about, the forest’s fog, and the events the term’s lane
// counts.
//
//   createLandmarks({ house, materials, ground, tier, castle, renderer }) → {
//     group, colliders, doors (the hut’s, for castle/doors.js), pitch (for play/snitch.js),
//     willow: { knot, KNOT_R }, step(dt, { at, act, camera, speed, wind }) → {
//       prompt: { key, verb, name } | null, toast, events: [{ type, … }],
//       throw: [dx, dz] | null, turn: { to, yaw } | null, fog: 0…1, creak: 0…1, whoosh: 0…1,
//       enter: { room, from } | null (the road’s end: on into Hogsmeade) },
//     knock() (something struck the Willow’s knot), dispose() }
//   LINES: what the landmarks say, the site’s own words

import * as THREE from 'three';
import { createWillow, KNOT_R } from './grounds/willow';
import { HUT, createHut } from './grounds/hut';
import { createGreenhouses } from './grounds/greenhouses';
import { createPitch } from './grounds/pitch';
import { createForest } from './grounds/forest';
import { createBridge } from './grounds/bridge';
import { createStation } from './grounds/station';
import { createMesh } from './castle/mesh';
import { TONES } from './castle/materials';
import { PATHS } from './terrain';
import { placeById } from '../rules/places';

export const LINES = {
  hit: 'The Willow caught you a clout. A point gone.',
  frozen: 'The Willow goes still, for now.',
  thawed: 'The Willow stirs again.',
  snapped: 'The Tentacula snaps at your sleeve.',
  book: 'The library’s book, a little chewed.',
};
const BOOK_REACH = 1.8; // m from the book its prompt shows
// the road’s end past the station, where Hogsmeade begins (Lane F’s village, a set the room host stands)
const ROAD = PATHS.find((p) => p.id === 'road').points;
export const ROAD_END = ROAD[ROAD.length - 2];
const ROAD_REACH = 4.5;

export function createLandmarks({ house = null, materials, ground, tier = 'high', castle = null, renderer = null } = {}) {
  const group = new THREE.Group();
  group.name = 'grounds:landmarks';
  const w = placeById('willow').at;
  // (the knot faces the castle, up the slope)
  const willow = createWillow({ house, at: [w[0], ground(w[0], w[1]), w[1]], face: Math.atan2(0 - w[0], -50 - w[1]), tier });
  const hut = createHut({ house, materials, ground, tier });
  const greenhouses = createGreenhouses({ house, materials, ground, tier });
  const pitch = createPitch({ house, materials, ground, tier });
  const forest = createForest({ house, materials, ground, tier });
  const bridge = createBridge({ bridge: castle?.bridge ?? null, materials, ground, tier });
  const station = createStation({ house, materials, ground, tier, renderer });
  // the signpost at the road’s end: a post, its arm pointing on up the road to the village
  const sign = createMesh();
  {
    const [x, z] = ROAD_END;
    const y = ground(x, z);
    const [nx, nz] = ROAD[ROAD.length - 1];
    const a = Math.atan2(nx - x, nz - z);
    sign.tone(TONES.oak);
    sign.box('timber', { at: [x + 2.6 * Math.cos(a), y - 0.4, z - 2.6 * Math.sin(a)], size: [0.22, 3.4, 0.22], turn: a });
    const px = x + 2.6 * Math.cos(a);
    const pz = z - 2.6 * Math.sin(a);
    sign.tone(TONES.timber);
    sign.box('timber', { at: [px + Math.sin(a) * 0.7, y + 2.3, pz + Math.cos(a) * 0.7], size: [0.1, 0.38, 1.6], turn: a });
    sign.tone(TONES.old);
    sign.lathe('rubble', { at: [x - 2.4 * Math.cos(a), y - 0.2, z + 2.4 * Math.sin(a)], profile: [[0.4, 0], [0.38, 0.8], [0.001, 1.1]], sides: 6 });
  }
  const signGeos = sign.geometries();
  const signGroup = new THREE.Group();
  for (const [name, g] of Object.entries(signGeos)) signGroup.add(Object.assign(new THREE.Mesh(g, materials[name]), { castShadow: tier !== 'low', receiveShadow: true }));
  const parts = [willow, hut, greenhouses, pitch, forest, bridge, station];
  for (const p of parts) group.add(p.group);
  group.add(signGroup);
  const colliders = [...willow.colliders, ...hut.colliders, ...greenhouses.colliders, ...pitch.colliders, ...bridge.colliders, ...station.colliders];

  let knocked = false;
  return {
    group,
    colliders,
    doors: [HUT.door],
    pitch: pitch.pitch,
    willow: { knot: willow.knot, KNOT_R, book: willow.book },
    knock() {
      knocked = true;
    },
    step(dt, { at = null, act = false, camera = null, speed = 0, wind = 0.4 } = {}) {
      const out = { prompt: null, toast: null, events: [], throw: null, turn: null, fog: 0, creak: 0, whoosh: 0, enter: null };
      const you = at ? [at[0], at[2]] : null;
      // the Willow, its knot, its book
      for (const e of willow.step(dt, { you, knot: knocked })) {
        if (e.type === 'strike') out.whoosh = 1;
        else if (e.type === 'hit') {
          out.throw = e.throw;
          out.toast = LINES.hit;
          out.events.push({ type: 'points', delta: e.points, why: 'willow' });
        } else if (e.type === 'frozen') {
          out.toast = LINES.frozen;
          out.events.push({ type: 'willow', frozen: true });
        } else if (e.type === 'thawed') out.toast = LINES.thawed;
      }
      knocked = false;
      const book = willow.book;
      if (you && !book.taken && Math.hypot(you[0] - book.at[0], you[1] - book.at[2]) < BOOK_REACH) {
        out.prompt = { key: 'E', verb: 'Take', name: 'The library book' };
        if (act) {
          book.take();
          out.prompt = null;
          out.toast = LINES.book;
          out.events.push({ type: 'pickup', id: 'willow-book' });
        }
      }
      // the road’s end: on up into the village
      if (you && !out.prompt && Math.hypot(you[0] - ROAD_END[0], you[1] - ROAD_END[1]) < ROAD_REACH) {
        out.prompt = { key: 'E', verb: 'Walk on', name: 'Hogsmeade' };
        if (act) out.enter = { room: 'hogsmeade', from: 'road' };
      }
      // the Tentacula at the end of greenhouse three
      for (const e of greenhouses.step(dt, { you })) {
        if (e.type === 'strike') out.whoosh = Math.max(out.whoosh, 0.35);
        if (e.type === 'hit') {
          out.throw = e.throw;
          out.toast = LINES.snapped;
        }
      }
      // the forest’s edge: its fog, and the turn about past its depth
      const f = forest.step(dt, { at });
      out.fog = f.fog;
      if (f.turn) {
        out.turn = f.turn;
        out.toast = f.say;
      }
      out.creak = bridge.step(dt, { at, speed }).creak;
      if (camera) {
        hut.step(dt, camera, { wind });
        station.step(dt, camera);
      }
      pitch.step(dt);
      return out;
    },
    dispose() {
      for (const p of parts) p.dispose();
      for (const g of Object.values(signGeos)) g.dispose();
    },
  };
}
