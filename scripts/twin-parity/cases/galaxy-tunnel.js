// The tunnel’s twin (src/components/galaxy/nodes/tunnel.js) against
// tunnel.js: down the Death Star’s tube from near its mouth, and in the
// Star Destroyer’s chamber with its reactor hit (the lights gone red).
import * as TO from '../../../src/components/galaxy/tunnel.js';
import * as TN from '../../../src/components/galaxy/nodes/tunnel.js';

const path = TO.tunnelPath('parity', { length: 50, turns: 3, bend: 0.5 });

const down = (T) => ({ scene, camera }) => {
  const t = T.buildTunnel(path, { look: 'ds2' });
  scene.add(t.group);
  camera.position.set(...path.pts[3]);
  camera.lookAt(...path.pts[14]);
  t.update(3.3, 0);
};
const chamber = (T) => ({ scene, camera }) => {
  const t = T.buildTunnel(path, { look: 'isd', small: true });
  scene.add(t.group);
  const C = t.centre;
  camera.position.set(C[0] + 3.5, C[1] + 1.5, C[2] - 3.5);
  camera.lookAt(...C);
  t.update(7.1, 0.6);
};

export default {
  'galaxy-tunnel:down': { node: down(TN), classic: down(TO) },
  'galaxy-tunnel:chamber': { node: chamber(TN), classic: chamber(TO) },
};
