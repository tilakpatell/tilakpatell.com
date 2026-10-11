// The bolts drawn (./bolts.js says how), without the flashes' look: the
// streaks, the pool of flashes and setLook, with the flashes' material
// handed in, flashMaterial() → a material whose `uniforms` hold uMap, uRamp,
// uHasMap, uHasRamp, uRampV and uChan: bolts.js's GLSL, or boltsNodes.js's
// nodes.
//
// createBoltMeshesWith(flashMaterial, parent, { pool, flashes, look }) → bolts.js's

import * as THREE from 'three';
import { loadLook } from '../fx/gameLook';

export const CHAN = { r: [1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1, 0] };

const LONG = 1.6; // m, a streak's length at full stretch
const GLOW = 4; // over 1: the bloom catches it

export function createBoltMeshesWith(flashMaterial, parent, { pool = 48, flashes: nFlashes = 12, look = 'game' } = {}) {
  const group = new THREE.Group();
  group.name = 'bolts';
  parent.add(group);
  const geo = new THREE.CylinderGeometry(0.035, 0.035, LONG, 6).rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, pool);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false; // (its bounds would be the first frame's)
  group.add(mesh);
  const colours = new Map();
  const colourOf = (c) => {
    if (!colours.has(c)) colours.set(c, new THREE.Color(c).multiplyScalar(GLOW));
    return colours.get(c);
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const d = new THREE.Vector3();
  const Z = new THREE.Vector3(0, 0, 1);

  // every flash, one draw: a quad facing the camera, swelling and cooling
  const flashGeo = new THREE.PlaneGeometry(1, 1);
  const flashAttr = new THREE.InstancedBufferAttribute(new Float32Array(nFlashes * 2), 2);
  flashAttr.setUsage(THREE.DynamicDrawUsage);
  flashGeo.setAttribute('aFlash', flashAttr);
  const flashMat = flashMaterial();
  const flashMesh = new THREE.InstancedMesh(flashGeo, flashMat, nFlashes);
  flashMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flashMesh.count = 0;
  flashMesh.frustumCulled = false;
  flashMesh.renderOrder = 7;
  group.add(flashMesh);
  const flashes = Array.from({ length: nFlashes }, () => ({ at: new THREE.Vector3(), age: 9 }));
  let nf = 0;
  const setLook = ({ burst = null, ramp = null } = {}) => {
    const u = flashMat.uniforms;
    u.uMap.value = burst;
    u.uHasMap.value = burst ? 1 : 0;
    u.uChan.value.set(...CHAN[burst?.userData.look?.channels?.burst ?? 'g']);
    u.uRamp.value = ramp;
    u.uHasRamp.value = ramp ? 1 : 0;
    u.uRampV.value = ramp?.userData.look?.rampV ?? 0.5;
  };
  let gone = false;
  if (look === 'game') Promise.all([loadLook('impact'), loadLook('ramp.blackbody')]).then(([burst, ramp]) => !gone && burst && setLook({ burst, ramp }));

  return {
    group,
    mesh,
    flashes: flashMesh,
    setLook,
    // each live bolt a streak behind its head, as long as it has flown (so
    // a fresh one doesn't poke back through the gun)
    sync(live) {
      let n = 0;
      for (const b of live) {
        if (n >= pool) break;
        const len = Math.max(0.05, Math.min(LONG, b.flown ?? LONG));
        d.set(b.dir[0], b.dir[1], b.dir[2]);
        p.set(b.pos[0], b.pos[1], b.pos[2]).addScaledVector(d, -len / 2);
        q.setFromUnitVectors(Z, d);
        s.set(1, 1, len / LONG);
        mesh.setMatrixAt(n, m4.compose(p, q, s));
        mesh.setColorAt(n, colourOf(b.colour ?? '#ff3b30'));
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    flash(at) {
      const f = flashes[nf++ % flashes.length];
      if (Array.isArray(at)) f.at.set(at[0], at[1], at[2]);
      else f.at.set(at.x, at.y, at.z);
      f.age = 0;
    },
    update(dt) {
      let n = 0;
      for (const f of flashes) {
        if (f.age > 0.2) continue;
        f.age += dt;
        if (f.age > 0.2) continue;
        // (0.35 m across at first, swelling: the sphere it was; the game's burst a touch wider for its rays)
        flashMesh.setMatrixAt(n, m4.makeTranslation(f.at.x, f.at.y, f.at.z));
        flashAttr.setXY(n, f.age / 0.2, 0.7 * (0.6 + f.age * 3) * (flashMat.uniforms.uHasMap.value ? 1.6 : 1));
        n++;
      }
      flashMesh.count = n;
      if (n) {
        flashMesh.instanceMatrix.needsUpdate = true;
        flashAttr.needsUpdate = true;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
      gone = true;
      flashGeo.dispose();
      flashMat.dispose();
      flashMesh.dispose();
      group.removeFromParent();
    },
  };
}
