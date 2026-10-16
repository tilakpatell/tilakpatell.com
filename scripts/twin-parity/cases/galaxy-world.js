// A star system, drawn: ../../../src/components/galaxy/world.js against its
// twin, nodes/world.js (its set pieces and its two inline shaders in
// nodes/worldParts.js). The two shaders first, each alone: the second Death
// Star’s shield over Endor (its fresnel rim, half lit by a hit) and
// Coruscant’s skylanes (the ships in convoys round the planet, at one moment
// of their lanes), the original’s taken out of a system built whole, the
// twin’s built by its set piece alone. The ships are stand-ins (models.js’s
// slots, empty) and the clock is held, so both sides are the same picture.
// Then whole systems, Tatooine, Hoth and Endor, each built by buildSystem on
// both sides.
import * as THREE from 'three';
import * as WO from '../../../src/components/galaxy/world.js';
import * as WN from '../../../src/components/galaxy/nodes/world.js';
import { setPieces } from '../../../src/components/galaxy/nodes/worldParts.js';
import { systemById } from '../../../src/components/galaxy/systems.js';

const T = 1_790_000_123.5; // a moment on the wall clock
const slot = (kind, size) => ({ kind, size, holder: new THREE.Group(), real: false });
const kit = () => ({ models: { slot, drop() {} }, bolts: { fire: () => true }, flashes: { at() {} } });

const look = (camera, from, to, far = 2000) => {
  camera.position.set(...from);
  camera.lookAt(...to);
  camera.far = far;
  camera.updateProjectionMatrix();
};

// one set piece of a system built alone by the twin's builders, round a stand-in for the rest
function piece(sys, type, { ratio = 1 } = {}) {
  const group = new THREE.Group();
  const out = { group, solids: [], goals: [], events: [] };
  const ticks = [];
  const dpr = [];
  const k = {
    sys,
    ...kit(),
    small: false,
    ratio,
    group,
    ticks,
    disposers: [],
    dpr,
    events: out.events,
    capitals: [],
    ambient: { holders: [], solids: [], on: false },
    hold: { shield: null, superlaser: null },
    facing: {},
    stations: {},
    out,
    live: { dead: false, camAt: null },
    timers: [],
    tmp: new THREE.Vector3(),
    tmp2: new THREE.Vector3(),
    tmp3: new THREE.Vector3(),
    addSolid: (o) => (out.solids.push(o), o),
    hull() {},
    place: (s, at) => (s.holder.position.set(...at), group.add(s.holder), s),
    aside: (fn) => fn,
  };
  const BUILD = setPieces(k);
  sys.pieces.forEach((p, i) => p.type === type && BUILD[type](p, i));
  for (const tick of ticks) tick(T, 0, null, null);
  return { group, out };
}

// the original's system built whole, and only what `keep` picks left in it
function whole(sys, keep) {
  const w = WO.buildSystem(sys, { ...kit(), small: false, ratio: 1 });
  w.update(T, 0, new THREE.PerspectiveCamera(), null);
  for (const o of [...w.group.children]) if (!keep(o)) w.group.remove(o);
  return w;
}

const isShield = (o) => o.material?.uniforms?.uHit;
const isLanes = (o) => o.material?.uniforms?.uDpr;

const shield = (side, from) => ({ scene, camera }) => {
  const sys = systemById('endor');
  const p = sys.pieces.find((x) => x.type === 'station');
  look(camera, from, p.at);
  scene.background = new THREE.Color(0x05070c);
  const set = (u) => {
    u.uOn.value = 1;
    u.uHit.value = 0.5;
  };
  if (side === 'node') {
    const { group, out } = piece(sys, 'station');
    set(out.dsShield.mat.uniforms);
    scene.add(group);
  } else {
    const w = whole(sys, isShield);
    set(w.dsShield.mat.uniforms);
    scene.add(w.group);
  }
};

const lanes = (side, from, to = [0, 0, 0]) => ({ scene, camera }) => {
  const sys = systemById('coruscant');
  look(camera, from, to);
  scene.background = new THREE.Color(0x05070c);
  const g = side === 'node' ? piece(sys, 'lanes').group : whole(sys, isLanes).group;
  scene.add(g);
};

const pair = (make, ...args) => ({ node: make('node', ...args), classic: make('classic', ...args) });

const CASES = {
  'galaxy-world:shield': pair(shield, [150 + 160, 46 + 60, -190 + 200]),
  'galaxy-world:shield:near': pair(shield, [150 + 70, 46 + 20, -190 + 80]),
  'galaxy-world:lanes': pair(lanes, [0, 30, 110]),
  'galaxy-world:lanes:near': pair(lanes, [10, 20, 62], [0, 0, 20]),
};

// A whole system, both sides built by buildSystem: its planet and moons
// (bodies.js and its twin), the set pieces round them with their ships as
// grey blocks the size of the ship, the places, the rocks; each side given
// a moment for its planets' pictures to come in, then drawn at the same
// second from a few spots.
const block = new THREE.BoxGeometry(0.25, 0.12, 1);
const grey = new THREE.MeshStandardMaterial({ color: '#8a8f98', roughness: 0.7, metalness: 0.2 });
const shipKit = () => ({
  models: {
    slot(kind, size) {
      const holder = new THREE.Group();
      const m = new THREE.Mesh(block, grey);
      m.scale.setScalar(size);
      holder.add(m);
      return { kind, size, holder, real: false };
    },
    drop() {},
  },
  bolts: { fire: () => true },
  flashes: { at() {} },
});
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const system = (W, id, from, to = [0, 0, 0]) => async ({ scene, camera }) => {
  look(camera, from, to, 4000);
  scene.background = new THREE.Color(0x05070c);
  const w = W.buildSystem(systemById(id), { ...shipKit(), small: false, ratio: 1 });
  w.setDetail(1);
  scene.add(w.group);
  w.update(T, 0, camera, null);
  await settle(2500);
  w.update(T, 0, camera, null);
};
const both = (...args) => ({ node: system(WN, ...args), classic: system(WO, ...args) });

Object.assign(CASES, {
  'galaxy-world:tatooine': both('tatooine', [0, 40, 150]),
  'galaxy-world:tatooine:chase': both('tatooine', [60, 70, 110], [0, 20, 60]),
  'galaxy-world:hoth': both('hoth', [160, 110, 300]),
  'galaxy-world:hoth:fleet': both('hoth', [150, 160, 60], [-40, 58, -150]),
  'galaxy-world:hoth:rocks': both('hoth', [170, 60, 60], [230, 30, 150]),
  'galaxy-world:endor': both('endor', [260, 110, 20], [150, 46, -190]),
});

export default CASES;
