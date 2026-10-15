// rv.js on the node renderer: the sky, the land’s haze and the world
// outside the windshield (the mesas, the scrub, the power line and the
// fences), the shapes copied line for line. What differs, and why:
// - The sky dome’s ShaderMaterial (SKY_VERT, SKY_FRAG) is a basic node
//   material whose colourNode is SKY_FRAG line for line, and the land’s
//   haze below the horizon (LAND_FRAG) the same; the uniforms are uniform
//   nodes under the GLSL’s names, on `material.uniforms`, so the frame code
//   writes `.value` as before. The ShaderMaterial’s defaults are kept: no
//   fog, one pass.
// - hazy()’s onBeforeCompile (the distance haze before the tone mapping)
//   is an onLight hook (lib/three/hookNodes.js) on the light leaving the
//   surface, keyed as the GLSL’s program was; its `rush` (the map read with
//   a bias, the blur of speed) is the material’s colourNode, and its
//   `extra` takes that colour and gives it back changed (the ground’s
//   large-scale variation) where the GLSL’s took the shader. A classic
//   material (a model’s) is hazed as its node twin, which hazy returns: the
//   caller puts it on the model in the original’s place.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, asin, atan, clamp, degrees, dot, exp, float, materialColor, materialReference, max, mix, normalize, positionLocal, positionView, pow, select, sin, smoothstep, texture, vec2, vec3, vec4 } from 'three/tsl';
import { asNode, onLight } from '../../../lib/three/hookNodes';
import { rng, tubeAlong } from '../kitNodes';
import { LANE, POLE_GAP, POLE_X, POST_GAP, ROAD_Y, TAU, V3, beam } from './rvNodesKit';

// ── the sky ──

// The sky: the photographed evening sky (range-compressed in the file, as
// the games store it), sinking as the sun goes down; the dusk after it, the
// night, the sun itself, far ranges along the horizon, and the haze the
// land fades into. `uLift` is the RV rising: the far ranges go, and the
// land’s haze (landMaterial, below the horizon) is all that’s left of the
// ground. SKY_FRAG’s photo() and ridge(), as nodes.
const photoOf = (u, d) => {
  const el = degrees(asin(clamp(d.y, -1, 1))).add(u.uSink);
  const pu = atan(d.z, d.x).div(6.2831853).add(0.5).add(u.uShift);
  const pv = float(1).sub(float(90).sub(clamp(el, -11, 90)).div(101.25));
  const l = pow(u.uPhoto.sample(vec2(pu, clamp(pv, 0.002, 0.998))).rgb, vec3(2.2));
  return l.div(max(vec3(1).sub(l), vec3(0.004)));
};
const ridge = (a) =>
  float(0.004).add(
    float(0.011).mul(
      float(0.5)
        .add(sin(a.mul(3).add(1.3)).mul(0.3))
        .add(sin(a.mul(7).add(2.1)).mul(0.16))
        .add(abs(sin(a.mul(19).add(0.4))).mul(0.08))
        .add(abs(sin(a.mul(43).add(2.7))).mul(0.04)),
    ),
  );

// u: { uPhoto (a texture node, or none), uHasPhoto, uShift, uSink, uDusk,
// uNight, uSunK, uLift, uTint, uSun, uSunCol, uHaze }, uniform nodes
export function skyMaterial(u) {
  // (vDir: the dome’s own position, its direction from your eye)
  const d = normalize(positionLocal);
  const h = d.y;
  const dir = normalize(d.xz.add(vec2(1e-5)));
  const toward = max(dot(dir, normalize(u.uSun.xz)), 0);
  const plain = mix(vec3(0.95, 0.66, 0.42), vec3(0.24, 0.38, 0.66), smoothstep(0, 0.5, h));
  // (no photograph, no texture to read: the GLSL’s other side of uHasPhoto)
  const day = u.uPhoto?.isTextureNode ? select(u.uHasPhoto.greaterThan(0.5), photoOf(u, d).mul(u.uTint), plain) : plain;
  // dusk: the afterglow low where the sun went, violet over it, blue up high
  const glow = mix(vec3(0.42, 0.16, 0.12), vec3(1.15, 0.42, 0.13), pow(toward, 3));
  let dusk = mix(glow, vec3(0.16, 0.11, 0.27), smoothstep(0, 0.2, h));
  dusk = mix(dusk, vec3(0.03, 0.045, 0.12), smoothstep(0.12, 0.65, h));
  const night = mix(vec3(0.028, 0.04, 0.09).add(vec3(0.05, 0.022, 0.018).mul(pow(toward, 4))), vec3(0.003, 0.005, 0.016), smoothstep(0, 0.4, h));
  let c = mix(day, mix(day.mul(0.22), dusk, 0.85), u.uDusk);
  c = mix(c, night, u.uNight);
  const sd = max(dot(d, normalize(u.uSun)), 0);
  c = c.add(u.uSunCol.mul(u.uSunK).mul(smoothstep(0.99993, 0.99997, sd).mul(26).add(pow(sd, 900).mul(3)).add(pow(sd, 60).mul(0.35)).add(pow(sd, 8).mul(0.1))));
  // far ranges along the horizon, then the haze
  const a = atan(d.x, d.z.negate());
  const rh = ridge(a);
  const keep = float(1).sub(u.uLift);
  c = mix(c, u.uHaze.mul(0.8), float(1).sub(smoothstep(rh.sub(0.0015), rh.add(0.0015), h)).mul(keep));
  c = mix(c, u.uHaze, float(1).sub(smoothstep(-0.004, 0.07, h)).mul(0.55).mul(keep));
  // from up high: the air along the horizon, faintly lit, over the dark land
  c = c.add(vec3(0.012, 0.02, 0.05).mul(u.uLift).mul(exp(max(h, 0).negate().mul(26))));
  const m = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  m.forceSinglePass = true; // (a ShaderMaterial's)
  m.colorNode = vec4(c, 1);
  m.uniforms = u;
  return m;
}

// Everything below the horizon, in the land's own haze: the colour the ground
// fades to with distance. Drawn over the sky and its stars and under the
// land, so wherever the ground ends (its edge, the far end of the view) there
// is no seam, and no star shows through from under the world. As the RV
// rises (`uLift`) the haze stands a little higher: the air along the horizon.
// u: { uHaze, uLift }, the sky’s own
export function landMaterial(u) {
  const h = normalize(positionLocal).y;
  const a = float(1).sub(smoothstep(float(-0.004).sub(u.uLift.mul(0.012)), float(0.002).add(u.uLift.mul(0.06)), h));
  const m = new MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, fog: false });
  m.forceSinglePass = true;
  m.colorNode = vec4(u.uHaze, a);
  m.uniforms = u;
  return m;
}

// The photographed sky's colour just above the horizon, ahead of you (the
// sun's own glow counts for less): the day's haze.
export function horizonColour(img, shift, tint) {
  const fallback = new THREE.Color(0.62, 0.48, 0.38);
  if (!img) return fallback;
  try {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 72;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 256, 72);
    const row = x.getImageData(0, Math.round(((90 - 2) / 101.25) * 72), 256, 1).data;
    const dec = (v) => {
      const l = (v / 255) ** 2.2;
      return l / Math.max(1 - l, 0.004);
    };
    const sum = [0, 0, 0];
    let n = 0;
    // straight ahead (−z) is atan(−1, 0): a quarter round from the photograph's u = 0.5
    const u0 = 0.25 + shift;
    for (let k = -64; k <= 64; k++) {
      const px = (((Math.floor((u0 + k / 256) * 256) % 256) + 256) % 256) * 4;
      const w = 1 / (1 + dec(row[px]) + dec(row[px + 1]));
      for (let ch = 0; ch < 3; ch++) sum[ch] += dec(row[px + ch]) * w;
      n += w;
    }
    return new THREE.Color((sum[0] / n) * tint[0] * 0.86, (sum[1] / n) * tint[1] * 0.86, (sum[2] / n) * tint[2] * 0.86);
  } catch {
    return fallback;
  }
}


// ── the world outside ──

// Distance haze over the land's materials, in linear light before the tone
// mapping, the colour shared (it follows the time of day). `rush`: the
// surface is one that scrolls under you (the ground, the road).
// haze: { color, k, rush }, uniform nodes; extra(colour, material) → the
// surface’s colour changed, or nothing. Returns the material hazed: the one
// given, or a classic one’s node twin.
export function hazy(material, haze, key, extra, { rush = false } = {}) {
  const mat = asNode(material);
  // what rushes by under the wheels is read from a coarser copy of its
  // picture the faster it goes (the blur of speed), so its grain doesn't
  // crawl or strobe from frame to frame in the time-lapse
  let colour = rush && mat.map ? materialReference('color', 'color').mul(texture(mat.map).bias(haze.rush)) : null;
  if (extra) colour = extra(colour ?? materialColor, mat) ?? colour;
  if (colour) mat.colorNode = colour;
  onLight(
    mat,
    (light) => {
      const hz = float(1).sub(exp(positionView.length().negate().mul(haze.k)));
      return mix(light, haze.color, hz.mul(hz).mul(float(3).sub(hz.mul(2))));
    },
    `rv-haze-${key}${rush ? '-rush' : ''}`,
    haze,
  );
  return mat;
}

// A mesa: a flat cap of pale rock, a cliff, and the slope of fallen rock
// round its foot, on a ragged footprint. Faceted, coloured by height.
export function mesaGeometry(r, { radius, height }) {
  const prof = [
    [0, 1],
    [0.9, 1],
    [0.96, 0.985],
    [1.0, 0.9],
    [1.03, 0.62],
    [1.2, 0.46],
    [1.55, 0.2],
    [1.95, 0],
  ];
  const tones = [
    [0.96, 0.9, 0.82],
    [0.96, 0.9, 0.82],
    [0.94, 0.84, 0.76],
    [0.98, 0.66, 0.54],
    [0.92, 0.6, 0.5],
    [0.86, 0.66, 0.54],
    [0.82, 0.68, 0.56],
    [0.8, 0.7, 0.58],
  ];
  const seg = 44;
  const ph = Array.from({ length: 6 }, () => r() * TAU);
  const foot = (a) => 1 + 0.16 * Math.sin(2 * a + ph[0]) + 0.09 * Math.sin(3 * a + ph[1]) + 0.05 * Math.sin(7 * a + ph[2]);
  const rings = prof.map(([f, hf], j) =>
    Array.from({ length: seg }, (_, i) => {
      const a = (i / seg) * TAU;
      const cliff = j >= 2 && j <= 4 ? 0.05 * Math.sin(a * 17 + ph[3]) + 0.03 * Math.sin(a * 31 + ph[4]) : 0;
      const rr = radius * f * foot(a) * (1 + cliff + (j > 4 ? (r() - 0.5) * 0.06 : 0));
      return [Math.cos(a) * rr, height * hf + (j > 4 && j < 7 ? (r() - 0.5) * height * 0.05 : 0), Math.sin(a) * rr];
    }),
  );
  const pos = [];
  const col = [];
  const uv = [];
  const put = (p, j, a) => {
    pos.push(...p);
    col.push(...tones[j]);
    uv.push(j <= 1 ? p[0] / 40 : (a * radius) / 40, j <= 1 ? p[2] / 40 : p[1] / 40);
  };
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const i2 = (i + 1) % seg;
      const a0 = (i / seg) * TAU;
      const a1 = ((i + 1) / seg) * TAU;
      if (j === 0) {
        put([0, height, 0], 0, a0);
        put(rings[1][i2], 1, a1);
        put(rings[1][i], 1, a0);
        continue;
      }
      const A = rings[j][i];
      const B = rings[j][i2];
      const C = rings[j + 1][i2];
      const D = rings[j + 1][i];
      put(A, j, a0);
      put(B, j, a1);
      put(C, j + 1, a1);
      put(A, j, a0);
      put(C, j + 1, a1);
      put(D, j + 1, a0);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A model scattered beside the road in a band that recycles as you drive:
// each copy that falls behind comes back at the far end, somewhere new
// (from its index and how many times round it has been).
export function scatter(models, model, o) {
  const inst = models.instanced(model, o.count, { receive: true, shadow: !!o.shadow });
  const n = o.count;
  const span = o.near - o.far;
  const r = rng(o.seed);
  const z0 = Float32Array.from({ length: n }, (_, i) => o.far + ((i + r()) / n) * span);
  const lap = new Int32Array(n).fill(-99999);
  const x = new Float32Array(n);
  const sc = new Float32Array(n);
  const turn = new Float32Array(n);
  const lean = new Float32Array(n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new V3();
  const s = new V3();
  const unit = 1 / Math.max(model.size.y, 0.01);
  const update = (d) => {
    for (let i = 0; i < n; i++) {
      const zz = z0[i] + d - o.far;
      const l = Math.floor(zz / span);
      if (l !== lap[i]) {
        lap[i] = l;
        const rr = rng(o.seed * 7919 + i * 131 + l * 104729);
        const side = rr() < (o.left ?? 0.5) ? -1 : 1;
        x[i] = LANE + side * (o.clear + Math.pow(rr(), o.spread ?? 1.6) * o.width);
        sc[i] = (o.h[0] + rr() * (o.h[1] - o.h[0])) * unit;
        turn[i] = rr() * TAU;
        lean[i] = (rr() - 0.5) * (o.lean ?? 0.12);
      }
      p.set(x[i], ROAD_Y - (o.sink ?? 0.05) * sc[i] * model.size.y, o.far + zz - l * span);
      q.setFromEuler(e.set(lean[i], turn[i], 0));
      inst.setMatrixAt(i, m.compose(p, q, s.setScalar(sc[i])));
    }
    inst.commit();
  };
  update(0);
  return { meshes: inst.meshes, update };
}

// The power line along the right of the road: poles with their crossarms,
// braces and insulators, a transformer now and then, and the wires sagging
// between them. Its pattern repeats every PERIOD poles, so the line can
// slide along by the length of one pattern and nobody sees the join.
export const PERIOD = 4;
export function powerLine({ wood, hardware, wire }) {
  const woods = [];
  const hard = [];
  const wires = [];
  const N = 34;
  const tops = [];
  const up = new V3(0, 0, 1);
  for (let i = 0; i < N; i++) {
    const z = 120 - i * POLE_GAP;
    const lean = [0.022, -0.012, 0.006, -0.026][i % PERIOD];
    const m = new THREE.Matrix4().makeRotationZ(lean).setPosition(POLE_X, ROAD_Y, z);
    woods.push(new THREE.CylinderGeometry(0.12, 0.16, 11.2, 8).translate(0, 5.6, 0).applyMatrix4(m));
    woods.push(new THREE.BoxGeometry(2.6, 0.13, 0.13).translate(0, 10.1, 0).applyMatrix4(m));
    woods.push(beam(new V3(0, 9.25, 0.08), new V3(-0.85, 10.04, 0.08), 0.06, 0.05, up).applyMatrix4(m));
    woods.push(beam(new V3(0, 9.25, 0.08), new V3(0.85, 10.04, 0.08), 0.06, 0.05, up).applyMatrix4(m));
    const pins = [
      [-1.15, 10.17],
      [1.15, 10.17],
      [0, 11.2],
    ];
    for (const [x, y] of pins) hard.push(new THREE.CylinderGeometry(0.045, 0.065, 0.2, 7).translate(x, y + 0.1, 0).applyMatrix4(m));
    tops.push(pins.map(([x, y]) => new V3(x, y + 0.18, 0).applyMatrix4(m)));
    if (i % PERIOD === 1) {
      hard.push(new THREE.CylinderGeometry(0.27, 0.27, 0.95, 12).translate(-0.42, 8.3, 0).applyMatrix4(m));
      hard.push(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 12).translate(-0.42, 8.8, 0).applyMatrix4(m));
    }
  }
  for (let i = 0; i + 1 < N; i++)
    for (let w = 0; w < 3; w++) {
      const a = tops[i][w];
      const b = tops[i + 1][w];
      const pts = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const p = a.clone().lerp(b, t);
        p.y -= 0.9 * 4 * t * (1 - t);
        pts.push(p.toArray());
      }
      wires.push(tubeAlong(pts, 0.016, { segs: 10, radial: 3 }));
    }
  const group = new THREE.Group();
  const merge = (list, mat) => {
    const mesh = new THREE.Mesh(mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))), mat);
    list.forEach((g) => g.dispose());
    group.add(mesh);
  };
  merge(woods, wood);
  merge(hard, hardware);
  merge(wires, wire);
  return group;
}

// A ranch fence each side: weathered posts every few metres (a pattern of
// ten, so it slides like the power line) and three strands of wire.
export const FENCE_PERIOD = 10;
export function fences(postMat, wireMat) {
  const posts = [];
  const strands = [];
  const r = rng(41);
  const looks = Array.from({ length: FENCE_PERIOD }, () => [1.12 + r() * 0.16, (r() - 0.5) * 0.08, (r() - 0.5) * 0.06]);
  for (const side of [-1, 1]) {
    const x = LANE + side * 9.6;
    for (let i = 0; i < 75; i++) {
      const [h, lx, lz] = looks[i % FENCE_PERIOD];
      const thick = i % FENCE_PERIOD === 0 ? 0.14 : 0.085;
      const g = new THREE.BoxGeometry(thick, h, thick).translate(0, h / 2, 0);
      g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(lz, 0, lx)).setPosition(x, ROAD_Y - 0.05, 30 - i * POST_GAP));
      posts.push(g);
    }
    for (const y of [0.42, 0.74, 1.04]) strands.push(new THREE.BoxGeometry(0.008, 0.008, 380).translate(x, ROAD_Y + y, 30 - 190));
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(mergeGeometries(posts.map((g) => g.toNonIndexed())), postMat));
  group.add(new THREE.Mesh(mergeGeometries(strands.map((g) => g.toNonIndexed())), wireMat));
  posts.forEach((g) => g.dispose());
  strands.forEach((g) => g.dispose());
  return group;
}
