// The sky over the Black Lake: a dome round the camera whose colour is a TSL
// function of the view's direction (the Road's sky's shape, copied: worlds
// are islands), set each frame from rules/dusk.js's light. The zenith and
// the horizon by the hour, the sunset's glow low where the sun went down,
// long thin bands of cloud catching the last of it, the stars as the dark
// comes on, and the moon over the castle's right shoulder with its halo.
// Every number is a uniform, so the dusk deepens without a recompile.
//
//   createSky({ radius }) → { mesh, uniforms, set(light), update(camera, dt), dispose }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, dot, float, floor, max, mix, normalize, positionLocal, pow, smoothstep, step, uniform, vec2, vec3 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';

const STAR_GRID = 300; // cells round the dome a star may sit in
const LUMA = vec3(0.2126, 0.7152, 0.0722);

export function createSky({ radius = 2400 } = {}) {
  const u = {
    zenith: uniform(new THREE.Color(0.01, 0.015, 0.04)),
    horizon: uniform(new THREE.Color(0.8, 0.35, 0.12)),
    sunDir: uniform(new THREE.Vector3(-0.8, 0.03, -0.6)),
    glow: uniform(new THREE.Color(0.8, 0.4, 0.2)),
    moonDir: uniform(new THREE.Vector3(0.38, 0.3, -0.87)),
    moon: uniform(0.5),
    stars: uniform(0),
    drift: uniform(0),
    seed: uniform(new THREE.Vector3(4.7, 2.2, 8.9)),
  };
  const { noise, hash13 } = noiseWith(u.seed, { octaves: 3 });

  const colour = Fn(() => {
    const dir = normalize(positionLocal);
    const up = max(dir.y, 0);
    const sky = mix(u.horizon, u.zenith, pow(up, 0.45)).toVar();
    // the sunset's glow: wide and low on the side the sun went down, warming the horizon there
    const c = max(dot(dir, normalize(u.sunDir)), 0);
    const low = float(1).sub(smoothstep(0.0, 0.4, up));
    sky.addAssign(u.glow.mul(pow(c, 3).mul(low).mul(1.1)));
    // long bands of cloud, stretched east to west, lit from under by the sunset or silvered by the moon
    const flat = dir.xz.div(max(dir.y, 0.05));
    const n1 = noise(vec3(flat.mul(vec2(0.35, 1.6)).add(vec2(u.drift, 0)), 0), u.seed);
    const n2 = noise(vec3(flat.mul(vec2(1.1, 3.2)).add(vec2(u.drift.mul(1.6), 5)), 1), u.seed);
    const cover = smoothstep(0.52, 0.8, n1.mul(0.7).add(n2.mul(0.3))).mul(smoothstep(0.02, 0.2, dir.y)).mul(0.85);
    const rim = mix(u.zenith.mul(1.5), u.glow.mul(1.1), pow(c, 2));
    const silver = vec3(0.32, 0.36, 0.48).mul(pow(max(dot(dir, normalize(u.moonDir)), 0), 8).mul(u.moon));
    sky.assign(mix(sky, rim.add(silver), cover.mul(0.75)));
    // the stars, where the sky is dark and no cloud is over them
    const cell = floor(dir.mul(STAR_GRID));
    const dark = smoothstep(0.12, 0.02, dot(sky, LUMA));
    const twinkle = hash13(cell.add(vec3(7, 3, 1)), u.seed);
    const star = step(0.9966, hash13(cell, u.seed)).mul(u.stars).mul(dark).mul(smoothstep(0.03, 0.25, dir.y)).mul(cover.oneMinus()).mul(twinkle.mul(0.7).add(0.5));
    sky.addAssign(vec3(star.mul(1.1)));
    // the moon: a disc, a little warm, and a soft halo round it
    const m = max(dot(dir, normalize(u.moonDir)), 0);
    // (a little over the moon's half a degree: it reads as the moon, not a star)
    const disc = smoothstep(0.99989, 0.99993, m);
    sky.addAssign(vec3(1.0, 0.97, 0.88).mul(disc.mul(u.moon).mul(2.4)));
    sky.addAssign(vec3(0.6, 0.66, 0.85).mul(pow(m, 400).mul(u.moon).mul(0.25)));
    // under the horizon: the haze, darker downward (the far shore stands in front of it)
    return mix(u.horizon.mul(0.55), sky, step(float(0), dir.y).max(smoothstep(-0.06, 0.0, dir.y)));
  });

  const material = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.colorNode = colour();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  return {
    mesh,
    uniforms: u,
    // rules/dusk.js's light, its colours sRGB
    set(light) {
      u.zenith.value.setRGB(...light.zenith, THREE.SRGBColorSpace);
      u.horizon.value.setRGB(...light.horizon, THREE.SRGBColorSpace);
      u.sunDir.value.set(...light.sun.dir);
      u.glow.value.setRGB(...light.glow, THREE.SRGBColorSpace);
      u.moonDir.value.set(...light.moon.dir);
      u.moon.value = 0.55 + 0.45 * light.moon.light;
      u.stars.value = light.stars;
    },
    update(camera, dt = 0) {
      mesh.position.copy(camera.position);
      u.drift.value += dt * 0.003;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
