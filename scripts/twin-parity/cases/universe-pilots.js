// universe/online/pilots.js against its twin, online/pilotsNodes.js:
// another pilot’s ship (a kind with no model to fetch, so the built
// stand-in is what both draw, in the livery) and the three shots they
// fire (a blaster bolt, a spread’s fan and a heavy round).
import * as IO from '../../../src/components/universe/online/pilots.js';
import * as IN from '../../../src/components/universe/online/pilotsNodes.js';
import { STOCK_LOADOUT } from '../../../src/components/universe/outfit.js';

const look = (camera, [x, y, z], at) => {
  camera.position.set(x, y, z);
  camera.lookAt(...at);
  camera.updateMatrixWorld();
};

// one pilot flying past, their three shots on their way
const pilot = (P) => ({ scene, camera }) => {
  look(camera, [0.5, 0.25, 0.7], [0, 0, -0.1]);
  const pilots = P.createPilots(scene, { colors: { tie: '#4aff6a' } });
  const snaps = [0, 100].map((at) => ({ at, x: 0, y: 0, z: 0, heading: 0.6, pitch: 0.15, bank: 0.3, speed: 0, vy: 0, hidden: false, safe: false, shield: 100 }));
  const p = { id: 'ann', kind: 'tie', name: 'ann', snaps, ally: 'none', hitAt: -Infinity, loadout: STOCK_LOADOUT };
  const shots = [
    { p: [-0.1, 0.05, -0.2], v: [0, 0, -1], kind: 'tie', paint: 'stock', w: 0 },
    { p: [0.1, -0.05, -0.3], v: [0.2, 0, -1], kind: 'tie', paint: 'stock', w: 1 },
    { p: [0.15, 0.1, -0.1], v: [0, 0, -1], kind: 'xwing', paint: 'stock', w: 2 },
  ];
  pilots.update(0.001, 100, { peers: new Map([[p.id, p]]), takeShots: () => shots }, null);
};

export default {
  'universe-pilots:ship': { node: pilot(IN), classic: pilot(IO) },
};
