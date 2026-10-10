// What's in the air round you (../weather.js) on the node renderer: the
// same particles in a box that rides with the camera, drawn by the GPU
// from one clock, their shaders line for line. The node renderer draws a
// point one pixel wide, so a flake is a sprite instanced once a particle
// (three's PointsNodeMaterial on a Sprite with a count), its size the
// GLSL's gl_PointSize; the streaks are line segments, as before. The same
// arguments, the same layers and uniforms (nodes, under the GLSL's names).
//
//   createWeather(site, { small }) → { group, gust, update(t, camera, heightAt, viewportH), dispose() }
//   KINDS

import * as THREE from 'three';
import { LineBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { abs, attribute, cos, dot, floor, instancedBufferAttribute, max, positionView, screenDPR, sin, smoothstep, uniform, uv, vec3 } from 'three/tsl';

// GLSL's mod (floored, for the negatives too)
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));

export const KINDS = {
  // streaks along the wind, low over the ground
  sand: { lines: false, count: 2200, box: [60, 5, 60], drop: [11, -0.3, 2.5], size: 0.045, color: '#f0dcb0', alpha: 0.55, wobble: 0.3, low: true },
  // flakes falling, drifting
  snow: { lines: false, count: 5000, box: [60, 34, 60], drop: [1.4, -1.8, 0.6], size: 0.09, color: '#ffffff', alpha: 0.85, wobble: 0.6 },
  // rain, slanting
  rain: { lines: true, count: 3500, box: [50, 30, 50], drop: [2.4, -24, 1.2], len: 0.035, color: '#b8cde6', alpha: 0.28 },
  // ash, slow
  ash: { lines: false, count: 2600, box: [60, 30, 60], drop: [0.8, -0.7, 0.4], size: 0.07, color: '#5a5450', alpha: 0.7, wobble: 0.5 },
  // embers rising off the lava
  embers: { lines: false, count: 900, box: [70, 30, 70], drop: [0.6, 1.6, 0.2], size: 0.07, color: '#ff8a3a', alpha: 1, glow: 3.2, wobble: 0.8 },
  // motes, drifting and glinting (swamp, forest light)
  motes: { lines: false, count: 900, box: [40, 14, 40], drop: [0.15, 0.05, 0.1], size: 0.05, color: '#e8f5b0', alpha: 0.9, glow: 2.2, wobble: 1.2 },
  // sea spray, blown
  spray: { lines: false, count: 1400, box: [60, 12, 60], drop: [7, -0.4, 2], size: 0.06, color: '#e6f2ff', alpha: 0.5, wobble: 0.4, low: true },
};

function layer(spec, { small, seed }) {
  const k = { ...KINDS[spec.kind], ...spec };
  const n = Math.round((spec.count ?? k.count) * (small ? 0.45 : 1));
  const verts = k.lines ? 2 : 1;
  const seeds = new Float32Array(n * verts * 3);
  const ends = new Float32Array(n * verts);
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < n; i++) {
    const a = [rand(), rand(), rand()];
    for (let v = 0; v < verts; v++) {
      seeds.set(a, (i * verts + v) * 3);
      ends[i * verts + v] = v;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * verts * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const drop = new THREE.Vector3(...k.drop).multiplyScalar(spec.speed ?? 1);
  const uniforms = {
    uTime: uniform(0),
    uSize: uniform(k.size ?? 0.1),
    uLen: uniform(k.len ?? 0),
    uWobble: uniform(k.wobble ?? 0),
    uScale: uniform(600),
    uBox: uniform(new THREE.Vector3(...k.box)),
    uDrop: uniform(drop),
    uCam: uniform(new THREE.Vector3()),
    uColor: uniform(new THREE.Color(k.color)),
    uAlpha: uniform(k.alpha ?? 1),
    uGlow: uniform(k.glow ?? 1),
  };
  const u = uniforms;
  // VERT: where it is in its box, which rides along with the camera
  const at = (seed, end) => {
    const p0 = seed.mul(u.uBox).add(u.uDrop.mul(u.uTime).mul(seed.y.mul(0.5).add(0.75)));
    const p1 = vec3(p0.x.add(sin(u.uTime.mul(0.9).add(seed.z.mul(40))).mul(u.uWobble)), p0.y, p0.z.add(cos(u.uTime.mul(0.7).add(seed.x.mul(40))).mul(u.uWobble)));
    const p = mod(p1.sub(u.uCam).add(u.uBox.mul(0.5)), u.uBox).sub(u.uBox.mul(0.5)).add(u.uCam);
    return end ? p.sub(u.uDrop.mul(end).mul(u.uLen)) : p; // (a streak's tail, behind its head)
  };
  // fading out toward the box's edges, so nothing pops
  const edge = (p) => {
    const e = abs(p.sub(u.uCam)).div(u.uBox.mul(0.5));
    return smoothstep(0.7, 1, max(max(e.x, e.y), e.z)).oneMinus();
  };
  const blending = k.glow ? THREE.AdditiveBlending : THREE.NormalBlending;
  let obj;
  if (k.lines) {
    const p = at(attribute('aSeed', 'vec3'), attribute('aEnd', 'float'));
    const material = new LineBasicNodeMaterial({ transparent: true, depthWrite: false, blending, fog: false });
    material.positionNode = p;
    material.colorNode = u.uColor.mul(u.uGlow);
    material.opacityNode = u.uAlpha.mul(edge(p).toVarying('vAlpha'));
    obj = new THREE.LineSegments(geo, material);
  } else {
    // one sprite a particle: its seed an instance attribute
    const seed = instancedBufferAttribute(new THREE.InstancedBufferAttribute(seeds, 3));
    const p = at(seed, null);
    const material = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending, fog: false, sizeAttenuation: false });
    material.positionNode = p;
    // gl_PointSize, in the canvas's pixels (three's sprite multiplies by the DPR again)
    material.sizeNode = u.uSize.mul(u.uScale).div(max(0.5, positionView.z.negate())).div(screenDPR);
    const q = uv().sub(0.5);
    const d = dot(q, q);
    material.colorNode = u.uColor.mul(u.uGlow);
    material.opacityNode = d.mul(4).oneMinus().mul(u.uAlpha).mul(edge(p).toVarying('vAlpha'));
    material.maskNode = d.lessThanEqual(0.25);
    obj = new THREE.Sprite(material);
    obj.count = n;
  }
  obj.frustumCulled = false;
  obj.renderOrder = 5;
  // (a sprite's quad is three's, shared: what's ours to free is the geometry made here)
  return { obj, geo, uniforms, low: k.low, box: k.box, alpha: k.alpha ?? 1 };
}

export function createWeather(site, { small = false } = {}) {
  const group = new THREE.Group();
  group.name = 'weather';
  const layers = (site.weather ?? []).filter((w) => KINDS[w.kind]).map((w, i) => layer(w, { small, seed: 977 + i * 131 }));
  for (const l of layers) group.add(l.obj);
  let strength = 1;
  return {
    group,
    // how hard it's blowing (0…1+): gusts of sand, a squall
    set gust(k) {
      strength = k;
    },
    update(t, camera, heightAt, viewportH) {
      for (const l of layers) {
        l.uniforms.uTime.value = t;
        l.uniforms.uCam.value.copy(camera.position);
        // sand keeps low: its box sits on the ground under the camera
        if (l.low && heightAt) l.uniforms.uCam.value.y = heightAt(camera.position.x, camera.position.z) + l.box[1] * 0.45;
        l.uniforms.uScale.value = viewportH * 0.9;
        l.uniforms.uAlpha.value = l.alpha * strength;
      }
    },
    dispose() {
      for (const l of layers) {
        l.geo.dispose();
        l.obj.material.dispose();
      }
    },
  };
}
