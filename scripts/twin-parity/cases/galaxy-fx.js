// The galaxy’s battles: ../../../src/components/galaxy/fx.js against its
// twin, nodes/fx.js. Bolts in each side’s colour, mid-flight; flashes at a
// few ages, drawn as they always were and with the game’s look (a burst
// sheet and a ramp made here, as cases/fx.js makes them: the bucket’s are
// not in the checkout).
import * as THREE from 'three';
import * as FO from '../../../src/components/galaxy/fx.js';
import * as FN from '../../../src/components/galaxy/nodes/fx.js';

// a sheet: a disc in red, rays in green, a ring in blue
const sheet = () => {
  const n = 64;
  const d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const fx = (x - 32) / 32;
      const fy = (y - 32) / 32;
      const r = Math.hypot(fx, fy);
      const i = (y * n + x) * 4;
      d[i] = r < 0.8 ? 255 * (1 - r / 0.8) : 0;
      d[i + 1] = Math.abs(Math.sin(Math.atan2(fy, fx) * 4)) > 0.8 && r < 1 ? 255 : 0;
      d[i + 2] = Math.abs(r - 0.7) < 0.12 ? 255 : 0;
      d[i + 3] = 255;
    }
  const t = new THREE.DataTexture(d, n, n);
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.look = { name: 'impact', grid: [1, 1], channels: { burst: 'g' } };
  return t;
};
const ramp = () => {
  const d = new Uint8Array(32 * 4);
  for (let i = 0; i < 32; i++) d.set([Math.min(255, i * 16), Math.max(0, i * 8 - 40), Math.max(0, i * 8 - 160), 255], i * 4);
  const t = new THREE.DataTexture(d, 32, 1);
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  t.userData.look = { rampV: 0.5 };
  return t;
};

const bolts = (F) => ({ scene }) => {
  const b = F.createBolts(scene, { count: 12 });
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  b.fire(v(-6, 0.5, 0), v(6, 0.5, 0), { color: F.LASER.empire, speed: 20, width: 0.08, length: 2.4 });
  b.fire(v(5, -1, -3), v(-5, 1.5, 2), { color: F.LASER.rebel, speed: 30, width: 0.12, length: 3 });
  b.fire(v(0, 3, -6), v(0, -1, 4), { color: F.LASER.republic, speed: 25, width: 0.05, length: 1.6 });
  b.fire(v(-3, -1, 3), v(3, 2, -3), { color: F.LASER.ion, speed: 15, width: 0.15, length: 2 });
  b.update(0.2);
  b.update(0.05);
};
const flashes = (F, look) => ({ scene }) => {
  const f = F.createFlashes(scene, { count: 8, look: null });
  if (look) f.setLook({ burst: sheet(), ramp: ramp() });
  f.at(new THREE.Vector3(0, 0.5, 0), { size: 1.6, life: 1 });
  f.at(new THREE.Vector3(-2, 1, -1), { size: 1.2, color: [1.2, 1.8, 3.2], life: 0.8 });
  f.update(0.15);
  f.at(new THREE.Vector3(2, -0.5, 1), { size: 1, color: [0.8, 3.5, 0.8], life: 1.2, bright: 0.6 });
  f.at(new THREE.Vector3(1.2, 1.8, -2), { size: 2, life: 2 });
  f.update(0.05);
};

export default {
  'galaxy:fx:bolts': { node: bolts(FN), classic: bolts(FO) },
  'galaxy:fx:flashes': { node: flashes(FN, false), classic: flashes(FO, false) },
  'galaxy:fx:flashes:look': { node: flashes(FN, true), classic: flashes(FO, true) },
};
