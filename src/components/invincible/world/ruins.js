// The ruins drawn (./demolish.js says what they are): rubble at the foot of
// every broken tower, scaffolding round every one being mended, and smoke
// off the broken stubs at high tier. Two instanced draws, each capped at
// 400; the towers' own cracks, dark glass and cut-down tops are the
// facade's (./facade.js, ./city.js's setDamage).
//
// createRuins(parent, world, { level, vfx }) → { group, set(ruins), hit(e), update(dt, t), dispose() }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { biteOf, chunksFor, mending, stageOf } from './demolish';
import { rng } from './map';

const CAP = 400;
const ROCKS = 7; // at a broken tower's foot
const SMOKE = { every: 0.35, most: 8 }; // s between puffs, and how many stubs smoke at once

// a cage of poles and boards round a unit box (−0.5…0.5, 0…1), to be
// stretched over a tower: eight uprights and a ring of boards every tenth
function cage() {
  const parts = [];
  const pole = (x, z) => parts.push(new THREE.BoxGeometry(0.012, 1, 0.012).translate(x, 0.5, z));
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]) pole(x, z);
  for (let k = 1; k <= 10; k++) {
    const y = k / 10 - 0.004;
    parts.push(new THREE.BoxGeometry(1, 0.008, 0.016).translate(0, y, -0.5), new THREE.BoxGeometry(1, 0.008, 0.016).translate(0, y, 0.5));
    parts.push(new THREE.BoxGeometry(0.016, 0.008, 1).translate(-0.5, y, 0), new THREE.BoxGeometry(0.016, 0.008, 1).translate(0.5, y, 0));
  }
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return g;
}

export function createRuins(parent, world, { level = 'high', vfx = null } = {}) {
  const group = new THREE.Group();
  group.name = 'ruins';
  parent.add(group);
  const byId = new Map(world.buildings.map((b) => [b.id, b]));

  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.95, flatShading: true });
  const rubble = new THREE.InstancedMesh(rockGeo, rockMat, CAP);
  rubble.count = 0;
  rubble.castShadow = level !== 'low';
  rubble.receiveShadow = true;
  rubble.frustumCulled = false;
  const cageGeo = cage();
  const cageMat = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.8, metalness: 0.2 });
  const scaffold = new THREE.InstancedMesh(cageGeo, cageMat, CAP);
  scaffold.count = 0;
  scaffold.frustumCulled = false;
  group.add(rubble, scaffold);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let stubs = [];

  // the ruins as they are now: rubble round the broken ones, cages round the mended
  function set(ruins) {
    let n = 0;
    stubs = [];
    for (const [id, d] of ruins.d) {
      const b = byId.get(id);
      if (!b || stageOf(d) < 3) continue;
      stubs.push({ b, top: (b.h + (b.top?.h ?? 0)) * (1 - biteOf(d)) });
      const r = rng(1000 + id);
      for (let k = 0; k < ROCKS && n < CAP; k++) {
        // round its foot, a few metres out from the walls
        const side = Math.floor(r() * 4);
        const along = r() - 0.5;
        const out = 1 + r() * 4;
        const x = b.x + (side === 0 ? -b.w / 2 - out : side === 1 ? b.w / 2 + out : along * b.w);
        const z = b.z + (side === 2 ? -b.d / 2 - out : side === 3 ? b.d / 2 + out : along * b.d);
        const size = 1.2 + r() * 2.6;
        rubble.setMatrixAt(n++, m.compose(p.set(x, size * 0.4, z), q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3)), s.set(size, size * 0.7, size)));
      }
    }
    rubble.count = n;
    rubble.instanceMatrix.needsUpdate = true;
    let c = 0;
    for (const id of mending(ruins)) {
      const b = byId.get(id);
      if (!b || c >= CAP) continue;
      const stands = (b.h + (b.top?.h ?? 0)) * (1 - biteOf(ruins.d.get(id)));
      scaffold.setMatrixAt(c++, m.compose(p.set(b.x, 0, b.z), q.identity(), s.set(b.w + 2, stands + 2, b.d + 2)));
    }
    scaffold.count = c;
    scaffold.instanceMatrix.needsUpdate = true;
  }

  let puff = 0;
  return {
    group,
    set,
    // a tower hit (./events.js's `ruin`): chunks by the tier, glass, and dust
    hit(e) {
      if (!vfx) return;
      const at = new THREE.Vector3(...e.at);
      const n = chunksFor(level);
      if (n) vfx.debris(at, { count: n, speed: 14, size: 0.5, spread: 1, color: 0x77706a });
      vfx.sparks(at, { count: 16 + Math.round(e.delta * 80), speed: 12, color: 0xffffff, to: 0x9fd8ff, life: 0.7 });
      vfx.smoke(at, { size: 4, count: 3, life: 2, color: 0x8a8070, to: 0xb0a898, rise: 2 });
    },
    // smoke off the broken stubs, at high tier
    update(dt, t) {
      if (level !== 'high' || !vfx || !stubs.length) return;
      puff += dt;
      if (puff < SMOKE.every) return;
      puff = 0;
      for (let i = 0; i < Math.min(SMOKE.most, stubs.length); i++) {
        const { b, top } = stubs[(i + Math.floor(t)) % stubs.length];
        vfx.smoke(new THREE.Vector3(b.x, top + 2, b.z), { size: Math.min(14, b.w * 0.5), count: 1, life: 3, color: 0x4a4644, to: 0x9a948e, rise: 6 });
      }
    },
    dispose() {
      group.removeFromParent();
      rockGeo.dispose();
      rockMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
    },
  };
}
