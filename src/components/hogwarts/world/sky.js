// The sky over the grounds: the Road’s dome (middleearth/road/sky.js), its
// colour a TSL function of the view’s direction set each frame from the
// day’s light (rules/clock.js through daylight.js), without the Ring and
// Mordor’s pall, with the moon. The gradient by the sun’s height, the low
// sun’s glow along the horizon, the sun’s disc and halo; the stars as the
// sky darkens; the moon, its disc lit to its phase with a halo in the haze;
// two layers of cloud drifting on the wind, their cover the weather’s (a
// grey lid over a wet day, broken cloud on a fair one) and lit from the
// sun’s side at dusk. Every number is a uniform, so the day changes the sky
// without a recompile. The enchanted ceiling (Lane D’s Great Hall) can draw
// the same function: `colourAt(dir)`.
//
//   createSky({ radius }) → { mesh, uniforms, colourAt(dirNode), set(light), update(camera, dt), dispose }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, cross, dot, float, floor, length, max, mix, normalize, positionLocal, pow, smoothstep, step, uniform, vec2, vec3 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';

const NIGHT = new THREE.Color(0.006, 0.01, 0.03);
const DAY = new THREE.Color(0.2, 0.38, 0.72);
const STAR_GRID = 520; // cells round the dome a star may sit in (a star a point inside its cell, not the cell)

export function createSky({ radius = 2500 } = {}) {
  const u = {
    sunDir: uniform(new THREE.Vector3(0, 0.3, 1)),
    sunCol: uniform(new THREE.Color(1, 0.95, 0.85)),
    moonDir: uniform(new THREE.Vector3(0, 0.5, -1).normalize()),
    moonPhase: uniform(1),
    horizon: uniform(new THREE.Color(0.75, 0.8, 0.85)),
    day: uniform(1),
    stars: uniform(0),
    cloud: uniform(0.35),
    drift: uniform(0),
    seed: uniform(new THREE.Vector3(3.1, 7.7, 1.3)),
    windDir: uniform(new THREE.Vector2(0.8, 0.6)),
    murk: uniform(0),
  };
  const { noise, hash13 } = noiseWith(u.seed, { octaves: 3 });

  const colourAt = Fn(([d]) => {
    const dir = normalize(d);
    const up = max(dir.y, 0);
    const zenith = mix(vec3(NIGHT.r, NIGHT.g, NIGHT.b), vec3(DAY.r, DAY.g, DAY.b), u.day);
    const sky = mix(u.horizon, zenith, pow(up, 0.5)).toVar();
    // the halo round the sun, and a low sun’s glow along the horizon on its side
    const c = max(dot(dir, u.sunDir), 0);
    const low = smoothstep(0.5, 0.0, u.sunDir.y).mul(smoothstep(-0.3, 0.0, u.sunDir.y));
    const side = pow(max(dot(normalize(vec3(dir.x, 0, dir.z)), normalize(vec3(u.sunDir.x, 0, u.sunDir.z))), 0), 3);
    sky.addAssign(u.sunCol.mul(pow(c, 6).mul(low.mul(0.6).add(0.1))));
    sky.addAssign(u.sunCol.mul(side.mul(low).mul(smoothstep(0.35, 0.0, dir.y)).mul(0.35)));
    // two layers of cloud, flattened onto a ceiling over the land, drifting with the wind
    const flat = dir.xz.div(max(dir.y, 0.05));
    const n1 = noise(vec3(flat.mul(0.8).add(u.windDir.mul(u.drift)), 0), u.seed);
    const n2 = noise(vec3(flat.mul(2.4).add(u.windDir.mul(u.drift.mul(1.6))).add(vec2(0, 3)), 1), u.seed);
    // (the weather’s cover moves the threshold: a wet day a lid, a fair one broken cloud)
    const thick = n1.mul(0.65).add(n2.mul(0.35));
    const cover = smoothstep(float(0.62).sub(u.cloud.mul(0.95)), float(0.86).sub(u.cloud.mul(0.7)), thick).mul(smoothstep(0.0, 0.2, dir.y));
    // lit from the sun’s side at a low sun, grey under, dark at night
    const litSide = pow(max(dot(dir, u.sunDir), 0), 2).mul(low);
    const base = mix(u.horizon.mul(0.55), u.sunCol.mul(0.85).add(0.12), u.day.mul(0.55)).mul(float(1).sub(u.murk.mul(0.35)));
    const lit = base.add(u.sunCol.mul(litSide.mul(0.9)));
    sky.assign(mix(sky, lit, cover.mul(0.82)));
    // the stars, where the sky is dark and no cloud covers them
    const grid = dir.mul(STAR_GRID);
    const cell = floor(grid);
    const dark = smoothstep(0.12, 0.03, dot(sky, vec3(0.2126, 0.7152, 0.0722)));
    const h = hash13(cell, u.seed);
    // (a point in the cell, put somewhere in it by a second hash, round and soft-edged)
    const spot = vec3(hash13(cell.add(17.3), u.seed), hash13(cell.add(41.9), u.seed), hash13(cell.add(73.1), u.seed)).mul(0.5).add(0.25);
    const point = smoothstep(0.32, 0.06, length(grid.sub(cell).sub(spot)));
    const star = step(0.9982, h).mul(point).mul(u.stars).mul(dark).mul(smoothstep(0.02, 0.2, dir.y)).mul(cover.oneMinus());
    sky.addAssign(vec3(star.mul(h.sub(0.9982).mul(900).add(0.45))));
    // the sun’s disc, above the horizon only
    const disc = smoothstep(0.9994, 0.9997, c).mul(smoothstep(-0.03, 0.02, u.sunDir.y)).mul(cover.mul(0.85).oneMinus());
    sky.addAssign(u.sunCol.mul(disc.mul(6)));
    // the moon: a disc lit to its phase (the dark limb toward where the sun is), a halo in the haze
    const m = dot(dir, u.moonDir);
    const moonDisc = smoothstep(0.99955, 0.9997, m);
    const across = normalize(cross(u.moonDir, vec3(0, 1, 0)));
    const off = dir.sub(u.moonDir.mul(m));
    // (across the disc, −1 … 1: lit where it is past the terminator, the whole of it at the full)
    const sAcross = dot(off, across).div(0.0276);
    const edge = float(1).sub(u.moonPhase.mul(2));
    const lit2 = smoothstep(edge.sub(0.12), edge.add(0.12), sAcross);
    const night = float(1).sub(u.day);
    const moonUp = smoothstep(-0.02, 0.04, u.moonDir.y);
    sky.addAssign(vec3(0.85, 0.88, 0.95).mul(moonDisc.mul(lit2.max(u.moonPhase.mul(0.15))).mul(moonUp).mul(night.mul(1.6).add(0.25)).mul(cover.mul(0.8).oneMinus())));
    sky.addAssign(vec3(0.5, 0.56, 0.7).mul(pow(max(m, 0), 60).mul(0.08).add(pow(max(m, 0), 600).mul(0.18)).mul(u.moonPhase).mul(night).mul(moonUp)));
    // a storm’s murk: the dome lost in the haze
    sky.assign(mix(sky, u.horizon, u.murk.mul(0.75)));
    // under the horizon: the haze, darker downward
    return mix(u.horizon.mul(0.7), sky, step(float(0), dir.y).max(smoothstep(-0.08, 0.0, dir.y)));
  });

  const material = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.colorNode = colourAt(positionLocal);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.name = 'hogwarts:sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  const dir = new THREE.Vector3();
  return {
    mesh,
    uniforms: u,
    colourAt,
    set(light) {
      const { az, el, colour: c } = light.sun;
      dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      u.sunDir.value.copy(dir);
      u.sunCol.value.setRGB(c[0], c[1], c[2]);
      const mo = light.moon;
      u.moonDir.value.set(Math.sin(mo.az ?? 0) * Math.cos(mo.el), Math.sin(mo.el), Math.cos(mo.az ?? 0) * Math.cos(mo.el));
      u.moonPhase.value = mo.phase;
      u.horizon.value.setRGB(...light.fog.colour);
      u.day.value = Math.min(1, Math.max(0, (el + 0.15) / 0.45));
      u.stars.value = light.stars;
      u.cloud.value = light.cloud ?? 0.35;
      u.murk.value = light.murk ?? 0;
    },
    wind(angle) {
      u.windDir.value.set(Math.cos(angle), Math.sin(angle));
    },
    update(camera, dt = 0) {
      mesh.position.copy(camera.position);
      u.drift.value += dt * 0.006;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
