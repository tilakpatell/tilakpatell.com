// A fire in a grate, a hearth or under a cauldron (the Great Hall’s two,
// every common room’s, the kitchens’ ranges, the Potions dungeon’s): a few
// flame cards side by side, each its own noise rising through a teardrop,
// turned to the camera; a glow on the embers; and a real light that
// flickers with it (a weaker one on mid, none on low, where the room’s own
// light stands in). One draw for the flames however many tongues.
//
//   createFire({ at: [x, y, z], w, h, tongues, tier, colour, light }) → { group, light, step(dt), set({ on, k }), dispose() }
//     on: lit or out (Incendio’s business, Lane E); k: how high it burns, 0…1

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, attribute, cameraProjectionMatrix, float, length, mix, modelViewMatrix, mx_fractal_noise_float, positionGeometry, pow, smoothstep, time, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

export function createFire({ at = [0, 0, 0], w = 1.1, h = 1.0, tongues = 4, tier = 'high', colour = '#ff8a3c', light = true } = {}) {
  const group = new THREE.Group();
  group.name = 'hogwarts:fire';
  group.position.set(...at);
  const uK = uniform(1);
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  // each tongue: [x offset, its width, its height, its seed]
  const seeds = new Float32Array(tongues * 4);
  for (let i = 0; i < tongues; i++) {
    const t = tongues === 1 ? 0.5 : i / (tongues - 1);
    const mid = 1 - Math.abs(t - 0.5) * 1.2;
    seeds.set([(t - 0.5) * w * 0.8, w * (0.35 + 0.25 * mid), h * (0.55 + 0.45 * mid), i * 3.17 + 1], i * 4);
  }
  geo.setAttribute('aTongue', new THREE.InstancedBufferAttribute(seeds, 4));
  const a = attribute('aTongue', 'vec4');
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  mat.userData.noHouse = true;
  // the card: up the world’s up, across the view, its size the tongue’s
  const centre = modelViewMatrix.mul(vec4(a.x, positionGeometry.y.mul(a.z).mul(uK.mul(0.5).add(0.5)), 0, 1));
  mat.vertexNode = cameraProjectionMatrix.mul(centre.add(vec4(positionGeometry.x.mul(a.y), 0, 0, 0)));
  const p = uv();
  const n = mx_fractal_noise_float(vec3(p.x.mul(2.6).add(a.w), p.y.mul(1.8).sub(time.mul(1.7)), a.w), 3);
  const sway = n.mul(0.22).mul(p.y);
  const width = pow(float(1).sub(p.y), 0.8).mul(0.46).add(0.02);
  const body = smoothstep(1, 0.15, abs(p.x.sub(0.5).add(sway)).div(width)).mul(smoothstep(1.05, 0.25, p.y.add(n.mul(0.35)))).mul(smoothstep(0, 0.08, p.y));
  const base = new THREE.Color(colour);
  const hot = mix(vec3(base.r, base.g * 0.6, base.b * 0.3), vec3(1, 0.9, 0.62), pow(body, 2));
  mat.colorNode = hot.mul(body).mul(1.9).mul(uK);
  const flames = new THREE.InstancedMesh(geo, mat, tongues);
  const ident = new THREE.Matrix4();
  for (let i = 0; i < tongues; i++) flames.setMatrixAt(i, ident);
  flames.frustumCulled = false;
  flames.renderOrder = 6;
  group.add(flames);

  // the embers’ glow under the tongues
  const glowGeo = new THREE.PlaneGeometry(w * 1.3, w * 0.6).rotateX(-Math.PI / 2);
  const glowMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  glowMat.userData.noHouse = true;
  const r = length(uv().sub(0.5).mul(vec2(1, 2)));
  glowMat.colorNode = vec3(1, 0.32, 0.08).mul(smoothstep(0.5, 0, r)).mul(mx_fractal_noise_float(vec3(uv().mul(6), time.mul(0.6)), 2).mul(0.5).add(0.7)).mul(0.9).mul(uK);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = 0.04;
  group.add(glow);

  let lamp = null;
  const power = { low: 0, mid: 6, high: 12, ultra: 14 }[tier] ?? 10;
  if (light && power) {
    lamp = new THREE.PointLight(base, power, 12, 1.7);
    lamp.position.set(0, h * 0.45, 0.35);
    group.add(lamp);
  }
  let t = Math.random() * 10;
  let k = 1;
  let on = true;
  return {
    group,
    light: lamp,
    step(dt) {
      t += dt;
      if (lamp) lamp.intensity = on ? power * k * (0.82 + 0.1 * Math.sin(t * 9.1) + 0.06 * Math.sin(t * 17.3 + 1) + 0.04 * Math.sin(t * 31)) : 0;
    },
    set({ on: o = on, k: kk = k } = {}) {
      on = Boolean(o);
      k = Math.max(0, Math.min(1, kk));
      uK.value = on ? k : 0;
      flames.visible = glow.visible = on;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      flames.dispose?.();
      group.removeFromParent();
    },
  };
}
