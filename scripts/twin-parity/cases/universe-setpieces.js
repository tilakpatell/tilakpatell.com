// universe/setpieces.js against its twin, universe/setpiecesNodes.js: two
// of the Council’s portals open, a rift half open, the comet with its two
// tails, a capital ship (a stand-in box: its model is the fleet’s, not the
// set pieces’) dropped in with its shield parts marked, and a flare’s
// shell running out. Stepped by hand and seeded, so each side draws the same.
import * as PO from '../../../src/components/universe/setpieces.js';
import * as PN from '../../../src/components/universe/setpiecesNodes.js';

// (the dice the set pieces throw, seeded; a node material’s uuids keep the
// real Math.random, so they don’t shift the sequence)
const seededRandom = (run) => {
  const had = Math.random;
  let s = 7;
  Math.random = () => (/generateUUID/.test(new Error().stack) ? had() : ((s = (s * 16807) % 2147483647) - 1) / 2147483646);
  try {
    return run();
  } finally {
    Math.random = had;
  }
};

// a fleet that makes a grey box for any ship
const fleet = (THREE) => ({
  loaded: () => true,
  want() {},
  make: () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 1), new THREE.MeshBasicMaterial({ color: '#606870' })));
    return { group, model: true, update() {}, dispose() {} };
  },
});

const FAR = { x: 0, y: 0, z: 400, heading: 0, speed: 3 }; // (well clear of the map's sun, so a rift has room)

const make = (S, play) => (world) =>
  seededRandom(() => {
    const pieces = S.createSetPieces(world.scene, { fleet: fleet(world.THREE), solids: () => [] });
    play(pieces, world);
  });

const portals = (p, { THREE, camera }) => {
  p.portals([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.6, 0.6, -1.2)]);
  p.update(1, 2, camera);
};
const rift = (p, { camera }) => {
  p.rift(FAR);
  p.riftAt.set(0, 0, 0);
  p.update(0.2, 3.4, camera);
};
const comet = (p, { camera }) => {
  p.comet(FAR);
  p.update(6, 6, camera);
  const head = p.cometAt;
  // looking at the head from off its side, the tails running away
  camera.position.copy(head).add({ x: 24, y: 30, z: 70 });
  camera.lookAt(head.x - 10, head.y, head.z + 10);
  p.update(0.01, 6.01, camera);
};
const destroyer = (p, { camera }) => {
  const ship = { x: 0, y: 0, z: 28, heading: 0, speed: 0 };
  p.destroyer(ship);
  for (let i = 0; i < 30; i++) p.update(0.1, i * 0.1, camera, ship);
  const at = p.capital.at;
  camera.position.set(at[0] + 6, at[1] + 9, at[2] + 18);
  camera.lookAt(at[0], at[1], at[2]);
  p.update(0.01, 3.01, camera, ship);
};
const flare = (p, { camera }) => {
  camera.position.set(14, 10, 22);
  camera.lookAt(0, 0, 0);
  p.flare({ at: [0, 0, 0], r: 2, color: '#ffcc88' }, { x: 30, y: 4, z: -60 });
  for (const dt of [1, 1, 1, 0.08]) p.update(dt, 4 + dt, camera);
};

const pair = (play) => ({ node: make(PN, play), classic: make(PO, play) });

export default {
  'universe:setpieces:portals': pair(portals),
  'universe:setpieces:rift': pair(rift),
  'universe:setpieces:comet': pair(comet),
  'universe:setpieces:destroyer': pair(destroyer),
  'universe:setpieces:flare': pair(flare),
};
