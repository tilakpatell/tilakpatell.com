// The smoke off Hogsmeade’s chimneys: soft grey puffs, each born at a pot,
// rising, swelling and drifting off on the wind as it thins away, a few at
// a time from every chimney on its own beat; all of them one instanced draw,
// turned to the camera each frame. Grey-white by day, a blue-grey against
// the night. The puffs’ life is pure (puffAt), the drawing in a browser.
//
//   puffAt(t, { life, rise, drift, wind }) → { up, out, size, alpha } a puff t seconds into its life
//   createSmoke({ tops: [[x, y, z]], per, life }) → { mesh, step(dt, camera), set({ colour }), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, pow, smoothstep, uniform, uv } from 'three/tsl';

export function puffAt(t, { life = 7, rise = 1.1, drift = 0.55 } = {}) {
  const k = Math.min(1, Math.max(0, t / life));
  // (quick off the pot, slowing as it cools; thickest early, gone at the end)
  return { up: rise * life * (1 - (1 - k) ** 1.6) * 0.62, out: drift * t * (0.3 + k), size: 0.32 + k * 2.6, alpha: Math.min(1, k * 6) * (1 - k) ** 1.1 };
}

export function createSmoke({ tops = [], per = 14, life = 8, wind = [0.8, 0.3] } = {}) {
  const count = Math.max(1, tops.length * per);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  fade.setUsage(THREE.DynamicDrawUsage);
  const colour = uniform(new THREE.Color(0.6, 0.62, 0.66));
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const r = uv().sub(0.5).length().mul(2);
  m.colorNode = colour;
  m.opacityNode = pow(smoothstep(0.05, 1, r).oneMinus(), 1.8).mul(instancedBufferAttribute(fade)).mul(0.42);
  m.userData.noHouse = true;
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, m, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.name = 'hogsmeade:smoke';
  const w = new THREE.Vector2(...wind).normalize();
  // each puff its chimney, its own start in the cycle, a little sideways wander
  const puffs = [];
  tops.forEach((top, i) => {
    for (let k = 0; k < per; k++) puffs.push({ top, t: (k / per) * life + i * 0.37, side: Math.sin(i * 7.1 + k * 3.3) * 0.4 });
  });
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const step = (dt, camera) => {
    if (camera) _q.copy(camera.quaternion);
    puffs.forEach((p, i) => {
      p.t = (p.t + dt) % life;
      const s = puffAt(p.t, { life });
      _p.set(p.top[0] + w.x * s.out + w.y * p.side * s.out * 0.3, p.top[1] + s.up, p.top[2] + w.y * s.out - w.x * p.side * s.out * 0.3);
      _s.setScalar(s.size);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      fade.array[i] = s.alpha;
    });
    mesh.instanceMatrix.needsUpdate = true;
    fade.needsUpdate = true;
  };
  step(0, null);
  return {
    mesh,
    step,
    set({ colour: c = null } = {}) {
      if (c) colour.value.setRGB(...c, THREE.SRGBColorSpace);
    },
    dispose() {
      geo.dispose();
      m.dispose();
      mesh.removeFromParent();
    },
  };
}
