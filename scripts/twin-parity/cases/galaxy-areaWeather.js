// The storm in a level’s area (galaxy/areaWeather.js against
// galaxy/nodes/areaWeather.js), from the levels’ own area.json: Kamino’s
// lamps, beacons, backlit clouds and rain on its record’s wind, a strike
// in its first flicker (the bolt, the clouds lit), and Fondor’s shipyard’s
// lamps alone (a space level’s: no rain). The dice are seeded (`rand`), so
// both sides throw the same drops, phases and bolt.
import * as THREE from 'three';
import * as WO from '../../../src/components/galaxy/areaWeather.js';
import * as WN from '../../../src/components/galaxy/nodes/areaWeather.js';
import { lookOf } from '../../../src/components/galaxy/nodes/levelArea.js';
import { LIGHTS } from '../../../src/data/bf2017/light/index.js';
import KAMINO from '../../../src/data/bf2017/maps/sb_kamino.stages.json';
import FONDOR from '../../../src/data/bf2017/maps/sb_fondor.stages.json';

const METRES = 53.3;
const seeded = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const areaOf = async (pack) => (await fetch(`/models/galaxy/bf2017/levels/${pack}/area.json`)).json();

const storm = (W, pack, stages, { strike = null, t = 3.3, eye, to, space = false, without = [] }) => async ({ scene, camera }) => {
  camera.position.set(...eye);
  camera.lookAt(...to);
  camera.fov = 70;
  camera.far = 400;
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(0x0b141a);
  const data = await areaOf(pack);
  for (const k of without) delete data[k];
  const frame = (p) => p.map((x, k) => (x - stages.origin[k]) / METRES);
  const group = new THREE.Group();
  scene.add(group);
  const sea = stages.area.sea === null ? null : frame([0, stages.area.sea, 0])[1];
  const wind = stages.area.light ? lookOf(LIGHTS[stages.area.light])?.wind : null;
  const w = W.createAreaWeather(group, { data, frame, at: [0, 0, 0], sea, wind, rand: seeded(41), space });
  if (strike !== null) w.strike(strike);
  // (a strike’s first flicker, or none: the next one’s seconds away)
  w.update(strike !== null ? 0.04 : 0.5, t, camera);
};
const pair = (...a) => ({ node: storm(WN, ...a), classic: storm(WO, ...a) });

export default {
  'galaxy:areaWeather:kamino': pair('sb_kamino', KAMINO, { eye: [0, 4, -45], to: [10, 0, 40] }),
  'galaxy:areaWeather:kamino-strike': pair('sb_kamino', KAMINO, { strike: 0, eye: [0, 4, -45], to: [12, 0, 60] }),
  // (the bolt itself, the clouds it lights left out: lit, they fill the frame)
  'galaxy:areaWeather:kamino-bolt': pair('sb_kamino', KAMINO, { strike: 0, without: ['clouds'], eye: [0, 0, 20], to: [14, 0, 84] }),
  'galaxy:areaWeather:kamino-beacons': pair('sb_kamino', KAMINO, { t: 1.2, eye: [8, 8, 0], to: [8, 7, 30] }),
  'galaxy:areaWeather:fondor': pair('sb_fondor', FONDOR, { space: true, eye: [-10, 5, -40], to: [0, -5, 30] }),
};
