// The Road’s sky: a dome round the camera whose colour is a TSL function
// of the view’s direction, set each frame from daylight.js’s light. The
// gradient by the sun’s height, the sun’s disc and its halo, the stars as
// the sun goes down, two layers of cloud drifting, and Mordor’s pall as a
// dark lid coming from one side. Every number is a uniform, so the ride
// changes the sky without a recompile. Under the Ring (`vision`, hooks.js’s
// uVision) the clouds stretch into streaks along the vision’s wind and race,
// and the sky drains toward a cold grey. In a storm (`murk`) the dome is
// lost in the fog.
//
//   createSky({ radius, vision }) → { mesh, uniforms, set(light), wind(angle), update(camera, dt), dispose }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, dot, float, floor, max, mix, normalize, positionLocal, pow, smoothstep, step, uniform, vec2, vec3 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';

const NIGHT = new THREE.Color(0.008, 0.012, 0.035);
const DAY = new THREE.Color(0.22, 0.42, 0.78);
const LID = new THREE.Color(0.09, 0.035, 0.025);
const STAR_GRID = 260; // cells round the dome a star may sit in

export function createSky({ radius = 2500, vision = uniform(0) } = {}) {
  const u = {
    sunDir: uniform(new THREE.Vector3(0, 0.3, 1)),
    sunCol: uniform(new THREE.Color(1, 0.95, 0.85)),
    horizon: uniform(new THREE.Color(0.75, 0.8, 0.85)),
    day: uniform(1),
    stars: uniform(0),
    pall: uniform(0),
    pallFrom: uniform(new THREE.Vector3(1, 0.2, 0)),
    drift: uniform(0),
    seed: uniform(new THREE.Vector3(3.1, 7.7, 1.3)),
    vision,
    windDir: uniform(new THREE.Vector2(1, 0)),
    murk: uniform(0),
  };
  const { noise, hash13 } = noiseWith(u.seed, { octaves: 3 });

  const colour = Fn(() => {
    const dir = normalize(positionLocal);
    const up = max(dir.y, 0);
    const zenith = mix(vec3(NIGHT.r, NIGHT.g, NIGHT.b), vec3(DAY.r, DAY.g, DAY.b), u.day);
    const sky = mix(u.horizon, zenith, pow(up, 0.55)).toVar();
    // the halo round the sun and the low sun’s glow along the horizon
    const c = max(dot(dir, u.sunDir), 0);
    const low = smoothstep(0.5, 0.0, u.sunDir.y).mul(smoothstep(-0.25, 0.0, u.sunDir.y));
    sky.addAssign(u.sunCol.mul(pow(c, 6).mul(low.mul(0.5).add(0.12))));
    // two layers of cloud, flattened onto a ceiling over the land
    const flat0 = dir.xz.div(max(dir.y, 0.06));
    // (the vision’s streaks: the cloud stretched along its wind, so the noise runs long that way)
    const along = dot(flat0, u.windDir);
    const flat = flat0.sub(u.windDir.mul(along.mul(u.vision.mul(0.8))));
    const n1 = noise(vec3(flat.mul(0.9).add(vec2(u.drift, 0)), 0), u.seed);
    const n2 = noise(vec3(flat.mul(2.3).add(vec2(u.drift.mul(1.7), 3)), 1), u.seed);
    const cover = smoothstep(0.45, 0.75, n1.mul(0.65).add(n2.mul(0.35))).mul(smoothstep(0.0, 0.25, dir.y));
    const lit = mix(u.horizon.mul(0.6), u.sunCol, u.day.mul(0.6)).add(u.day.mul(0.2));
    sky.assign(mix(sky, lit, cover.mul(0.7)));
    // the stars, where the sky is dark enough and no cloud covers them (none
    // in a dusk still bright: they come out as the sky round them darkens)
    const cell = floor(dir.mul(STAR_GRID));
    const dark = smoothstep(0.16, 0.04, dot(sky, vec3(0.2126, 0.7152, 0.0722)));
    const star = step(0.9965, hash13(cell, u.seed)).mul(u.stars).mul(dark).mul(smoothstep(0.02, 0.2, dir.y)).mul(cover.oneMinus());
    sky.addAssign(vec3(star.mul(0.9)));
    // the sun’s disc, above the horizon only
    const disc = smoothstep(0.9994, 0.9997, c).mul(smoothstep(-0.03, 0.02, u.sunDir.y));
    sky.addAssign(u.sunCol.mul(disc.mul(6)));
    // Mordor’s lid: the side it comes from and the top of the sky darken
    const lid = smoothstep(-0.4, 0.6, dot(dir, normalize(u.pallFrom)).add(up.mul(0.6))).mul(u.pall);
    sky.assign(mix(sky, vec3(LID.r, LID.g, LID.b).add(u.sunCol.mul(0.04)), lid.clamp(0, 0.95)));
    sky.assign(mix(sky, vec3(0.55, 0.6, 0.7).mul(dot(sky, vec3(0.2126, 0.7152, 0.0722)).mul(1.3)), u.vision.mul(0.7)));
    // a storm’s murk: the whole dome lost in the fog’s colour (the white-out on the Redhorn)
    sky.assign(mix(sky, u.horizon, u.murk));
    // under the horizon: the haze, darker downward
    return mix(u.horizon.mul(0.7), sky, step(float(0), dir.y).max(smoothstep(-0.08, 0.0, dir.y)));
  });

  const material = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.colorNode = colour();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  const dir = new THREE.Vector3();
  return {
    mesh,
    uniforms: u,
    set(light) {
      const { az, el, colour: c } = light.sun;
      dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      u.sunDir.value.copy(dir);
      u.sunCol.value.setRGB(c[0], c[1], c[2]);
      u.horizon.value.setRGB(...light.fog.colour);
      u.day.value = Math.min(1, Math.max(0, (el + 0.15) / 0.45));
      u.stars.value = light.stars;
      u.pall.value = light.pall.amount;
      u.pallFrom.value.set(...light.pall.from);
      u.murk.value = light.murk ?? 0;
    },
    wind(angle) {
      u.windDir.value.set(Math.cos(angle), Math.sin(angle));
    },
    update(camera, dt = 0) {
      mesh.position.copy(camera.position);
      // (the clouds race under the Ring)
      u.drift.value += dt * 0.004 * (1 + 12 * u.vision.value);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
