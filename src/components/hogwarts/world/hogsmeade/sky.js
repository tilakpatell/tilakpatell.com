// The village’s own sky (the room host puts the grounds’ away while you’re
// in one): a dome from the horizon’s colour to the zenith’s, the glow where
// the sun is or went down, the stars coming out as the dark does and the
// moon over the Shack’s hill. Unlit, unfogged, behind everything.
//
//   createSky({ radius }) → { mesh, set(light) (./light.js’s skyAt), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { dot, floor, fract, hash, max, mix, normalize, positionLocal, pow, smoothstep, uniform, vec3 } from 'three/tsl';

export function createSky({ radius = 1700 } = {}) {
  const u = {
    zenith: uniform(new THREE.Color()),
    horizon: uniform(new THREE.Color()),
    glow: uniform(new THREE.Color()),
    sun: uniform(new THREE.Vector3(0, 1, 0)),
    moon: uniform(new THREE.Vector3(0, 0.5, 0.8)),
    stars: uniform(0),
    night: uniform(0),
  };
  const m = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const d = normalize(positionLocal);
  const up = max(d.y, 0);
  let col = mix(u.horizon, u.zenith, pow(up, 0.55));
  // the sun’s glow low in the sky, wide and soft
  col = col.add(u.glow.mul(pow(max(dot(d, u.sun), 0), 5).mul(0.6)));
  // the stars: one in a few hundred cells of the sky, round and of many brightnesses
  const grid = d.mul(260);
  const cell = floor(grid);
  const h = hash(cell.x.add(cell.y.mul(157)).add(cell.z.mul(113)));
  const f = fract(grid).sub(0.5);
  const star = smoothstep(0.996, 0.9995, h).mul(smoothstep(0.0, 0.32, f.length()).oneMinus()).mul(smoothstep(0.02, 0.2, up));
  col = col.add(vec3(1, 0.97, 0.9).mul(star.mul(u.stars).mul(2.2)));
  // the moon: a pale disc and a halo round it
  const mc = dot(d, u.moon);
  const disc = smoothstep(0.99955, 0.9997, mc);
  const halo = pow(max(mc, 0), 180).mul(0.35).add(pow(max(mc, 0), 18).mul(0.08));
  col = col.add(vec3(1.4, 1.38, 1.3).mul(disc).add(vec3(0.6, 0.66, 0.8).mul(halo)).mul(u.night));
  m.colorNode = col;
  m.userData.noHouse = true;
  const geo = new THREE.SphereGeometry(radius, 48, 24);
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = 'hogsmeade:sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return {
    mesh,
    set(light) {
      u.zenith.value.setRGB(...light.zenith, THREE.SRGBColorSpace);
      u.horizon.value.setRGB(...light.horizon, THREE.SRGBColorSpace);
      u.glow.value.setRGB(...light.glow, THREE.SRGBColorSpace).multiplyScalar(light.dusk);
      u.sun.value.set(...light.sun.dir).normalize();
      u.moon.value.set(...light.moon.dir).normalize();
      u.stars.value = light.stars;
      u.night.value = Math.min(1, light.night * 1.2);
    },
    dispose() {
      geo.dispose();
      m.dispose();
    },
  };
}
