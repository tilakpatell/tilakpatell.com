// The storm in a level’s area of its own (../areaWeather.js) on the node
// renderer: the same lamps, beacons, backlit clouds, lightning and rain,
// from the same area.json and the same dice, their shaders line for line.
// The node renderer draws a point one pixel wide, so a lamp is a sprite
// instanced once a point (three’s PointsNodeMaterial on a Sprite with a
// count, its attributes instance attributes), its size the GLSL’s
// gl_PointSize; the rain and the bolt are line segments, as before. The
// uniforms are nodes under the GLSL’s names, on each `material.uniforms`.
//
//   createAreaWeather(group, { data, frame, at, sea, wind, rand }) →
//     { flash, strikeAt, update(dt, t, camera), strike(i?), dispose() }
//   (`data`: area.json; `frame`: the level’s metres → the battle’s units;
//   `at`: the area’s middle, the group’s place; `sea`: the water’s height;
//   `wind`: { dir (radians, the way it blows from), strength } the record’s)

import * as THREE from 'three';
import { LineBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { attribute, cameraProjectionMatrix, cameraViewMatrix, dot, exp, floor, fract, instancedBufferAttribute, max, min, normalize, positionView, screenDPR, select, step, uniform, uv, vec3, vec4 } from 'three/tsl';
import { METRES } from '../surface/missions/starfighter';

// GLSL’s mod (floored, for the negatives too)
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));

// the largest point WebGL draws where it’s ANGLE’s (D3D11, SwiftShader: 1024
// and 1023 pixels), the gl_PointSize the GLSL’s clouds were clamped to
const MAX_POINT = 1024;

// points in the group’s frame from the level’s metres
const local = (frame, at, p) => frame(p).map((x, k) => x - at[k]);

// GLOW_VERT and GLOW_FRAG: a lamp’s glow, a beacon on for a third of each 1.6 s
function glowMaterial(u, { position, color, size, phase }) {
  const material = new PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: false });
  material.positionNode = position;
  // (a beacon on for a third of each 1.6 s, each at its own moment)
  const on = select(u.uBlink.greaterThan(0.5), step(0.66, fract(u.uTime.div(1.6).add(phase))), 1);
  const vOn = on.mul(u.uFlash.add(1)).toVarying('vOn');
  // gl_PointSize, in the canvas’s pixels (three’s sprite multiplies by the DPR
  // again), held to the GL’s point-size limit as the GLSL’s was: a cloud you’re
  // in is a point of a thousand pixels, not one the size of the sky
  material.sizeNode = min(size.mul(u.uScale).div(max(0.001, positionView.z.negate())), MAX_POINT).div(screenDPR);
  const p = uv().sub(0.5);
  const d = dot(p, p).mul(4);
  const a = exp(d.mul(-4));
  material.maskNode = a.greaterThanEqual(0.01).and(vOn.greaterThan(0));
  material.colorNode = color.toVarying('vColor').mul(a).mul(u.uGain).mul(vOn);
  return material;
}

function points(group, list, { frame, at, color, size, gain, blink = false, rand }) {
  const n = list.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  const ph = new Float32Array(n);
  list.forEach((g, i) => {
    pos.set(local(frame, at, g.slice(0, 3)), i * 3);
    col.set(color ?? g.slice(3, 6), i * 3);
    sz[i] = (size ?? g[6]) / METRES;
    ph[i] = rand();
  });
  // (instance attributes, under the GLSL’s names, held by a geometry of our own to free)
  const geo = new THREE.BufferGeometry();
  const attr = (name, array, k) => {
    const b = new THREE.InstancedBufferAttribute(array, k);
    geo.setAttribute(name, b);
    return b;
  };
  const position = instancedBufferAttribute(attr('position', pos, 3));
  const aColor = instancedBufferAttribute(attr('aColor', col, 3));
  const aSize = instancedBufferAttribute(attr('aSize', sz, 1));
  const aPhase = instancedBufferAttribute(attr('aPhase', ph, 1));
  const uniforms = { uTime: uniform(0), uScale: uniform(600), uBlink: uniform(blink ? 1 : 0), uFlash: uniform(0), uGain: uniform(gain) };
  const material = glowMaterial(uniforms, { position, color: aColor, size: aSize, phase: aPhase });
  material.uniforms = uniforms;
  const mesh = new THREE.Sprite(material);
  mesh.count = n;
  mesh.frustumCulled = false;
  group.add(mesh);
  return { mesh, uniforms, geo };
}

// a bolt from the clouds down to the sea through `p`: a jagged line, with a branch or two
function boltOf(top, bottom, rand) {
  const out = [];
  const seg = (a, b, n, jag) => {
    let prev = a;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const next = i === n ? b : [a[0] + (b[0] - a[0]) * k + (rand() - 0.5) * jag, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k + (rand() - 0.5) * jag];
      out.push(...prev, ...next);
      prev = next;
    }
  };
  const h = top[1] - bottom[1];
  seg(top, bottom, 22, h * 0.08);
  // (drawn three times a hair apart, so a line a pixel wide reads as a bolt)
  const main = out.slice();
  for (const d of [0.06, -0.06]) for (let i = 0; i < main.length; i += 3) out.push(main[i] + d, main[i + 1], main[i + 2] + d);
  for (let b = 0; b < 2; b++) {
    const k = 0.25 + rand() * 0.4;
    const from = [top[0] + (bottom[0] - top[0]) * k, top[1] - h * k, top[2] + (bottom[2] - top[2]) * k];
    seg(from, [from[0] + (rand() - 0.5) * h * 0.5, from[1] - h * 0.3, from[2] + (rand() - 0.5) * h * 0.5], 8, h * 0.05);
  }
  return new Float32Array(out);
}

// RAIN_VERT and RAIN_FRAG: each drop’s place wraps round the camera in a box,
// in the world (the GLSL’s projectionMatrix * viewMatrix: no model matrix)
function rainMaterial(u) {
  const material = new LineBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
  const end = attribute('aEnd', 'float');
  const p0 = attribute('position', 'vec3').add(u.uFall.mul(u.uTime));
  const half = vec3(u.uBox.mul(0.5));
  const p1 = mod(p0.sub(u.uCam).add(half), vec3(u.uBox)).add(u.uCam).sub(half);
  const p = p1.sub(normalize(u.uFall).mul(end).mul(u.uBox).mul(0.035));
  material.vertexNode = cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(p, 1));
  material.colorNode = u.uColor.mul(u.uFlash.mul(2).add(1));
  material.opacityNode = end.toVarying('vEnd').oneMinus().mul(0.35);
  return material;
}

// (`space`: a space level’s area, its lamps and beacons only: no rain, no sea for lightning)
export function createAreaWeather(group, { data, frame, at, sea, wind = null, rand = Math.random, space = false }) {
  const parts = [];
  const frees = [];
  const glows = data.glows?.length ? points(group, data.glows, { frame, at, gain: 2.4, rand }) : null;
  const beacons = data.blinkers?.length ? points(group, data.blinkers, { frame, at, color: [1, 0.08, 0.04], size: 30, gain: 4, blink: true, rand }) : null;
  const clouds = data.clouds?.length ? points(group, data.clouds, { frame, at, color: [0.35, 0.45, 0.6], size: 900, gain: 0.18, rand }) : null;
  for (const p of [glows, beacons, clouds])
    if (p) {
      parts.push(p.mesh);
      frees.push(p.geo);
    }

  // the rain: drops in a box round the camera, falling on the wind
  const N = 1800;
  const BOX = 9; // units (about 480 m)
  const rp = new Float32Array(N * 6);
  const re = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const p = [rand() * BOX, rand() * BOX, rand() * BOX];
    rp.set(p, i * 6);
    rp.set(p, i * 6 + 3);
    re[i * 2] = 0;
    re[i * 2 + 1] = 1;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const blow = wind ? Math.min(1, (wind.strength ?? 0) / 8) : 0.3;
  const fall = new THREE.Vector3(-Math.sin(wind?.dir ?? 0) * blow * 1.6, -3.2, -Math.cos(wind?.dir ?? 0) * blow * 1.6);
  const rainU = { uCam: uniform(new THREE.Vector3()), uFall: uniform(fall), uTime: uniform(0), uBox: uniform(BOX), uColor: uniform(new THREE.Color(0.55, 0.62, 0.7)), uFlash: uniform(0) };
  const rainM = rainMaterial(rainU);
  rainM.uniforms = rainU;
  const rain = new THREE.LineSegments(rainGeo, rainM);
  rain.frustumCulled = false;
  rain.visible = !space;
  parts.push(rain);
  frees.push(rainGeo);
  // (the rain’s in world space round the camera, not the group’s frame)
  group.parent?.add(rain);

  // lightning: a strike every few seconds at one of the level’s places
  const strikes = (data.strikes ?? []).map((p) => local(frame, at, p));
  const seaY = (sea ?? at[1]) - at[1];
  const boltU = { uOn: uniform(0) };
  // (BOLT_FRAG: white-blue, far over one, for the bloom)
  const boltM = new LineBasicNodeMaterial({ fog: false });
  boltM.colorNode = vec3(5, 6, 9).mul(boltU.uOn);
  boltM.uniforms = boltU;
  const bolt = new THREE.LineSegments(new THREE.BufferGeometry(), boltM);
  bolt.frustumCulled = false;
  bolt.visible = false;
  group.add(bolt);
  parts.push(bolt);
  frees.push(bolt.geometry);
  let next = 2 + rand() * 4;
  let age = Infinity;

  const w = {
    flash: 0, // 0…1, how much the strike lights the storm now
    strikeAt: null, // where it struck, in the group’s frame (the flash’s light comes from there)
    strike(i = Math.floor(rand() * strikes.length)) {
      const p = strikes[i];
      if (!p) return;
      const top = [p[0] + (rand() - 0.5) * 4, p[1] + 900 / METRES, p[2] + (rand() - 0.5) * 4];
      bolt.geometry.setAttribute('position', new THREE.BufferAttribute(boltOf(top, [p[0], seaY, p[2]], rand), 3));
      bolt.geometry.computeBoundingSphere();
      w.strikeAt = p;
      age = 0;
    },
    update(dt, t, camera) {
      next -= dt;
      if (next <= 0 && strikes.length) {
        w.strike();
        next = 4 + rand() * 9;
      }
      age += dt;
      // (a strike’s light: a bright flicker or two in its first half second, then gone)
      const on = age < 0.5 ? (age < 0.08 || (age > 0.16 && age < 0.26) ? 1 : 0.35) * (1 - age / 0.5) : 0;
      w.flash = on;
      bolt.visible = on > 0.05;
      boltU.uOn.value = on;
      for (const p of [glows, beacons, clouds]) {
        if (!p) continue;
        p.uniforms.uTime.value = t;
      }
      if (clouds) clouds.uniforms.uFlash.value = on * 5;
      rainU.uTime.value = t;
      rainU.uFlash.value = on;
      if (camera?.position) rainU.uCam.value.copy(camera.position);
    },
    dispose() {
      // (a sprite’s quad is three’s, shared: what’s ours to free is the geometry made here)
      for (const m of parts) {
        m.parent?.remove(m);
        m.material.dispose();
      }
      for (const g of frees) g.dispose();
    },
  };
  return w;
}
