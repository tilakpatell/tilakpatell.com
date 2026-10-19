// The Road’s water: one node material for every river, pool, lake and the
// Mountain’s lava. Two Gerstner octaves lift the surface and give its
// normal, the sky’s colour comes back off it by Fresnel over a body tinted
// by how deep it stands, foam gathers where it is shallow, and the whole
// drifts along its flow. `uRise` swells a river into running crests (the
// Bruinen at the Ford); `lava` is an emissive flow under a crust instead.
//
//   createWater({ area | along, level, flow = [0, 1], kind = 'river' | 'still' | 'lava', sky, ground, speed })
//     → { mesh, uniforms: { uTime, uRise, uFlow }, set(light), update(dt), dispose }
//
// `area` is { x0, z0, w, d }, a flat sheet at `level`; `along` is
// { line, width, level(m) } (terrain.js’s river and riverLevel), a ribbon
// down the river’s line at its own heights, its flow the line’s tangent.
// `ground(x, z)` is the land under it: each vertex keeps how deep it stands
// (aDepth), so the shallows and the foam are read where the ground is, with
// no texture to sample. `uFlow` is the speed along the flow, m/s.
//
// Basic, not standard: its light is the sky’s, shared with the dome through
// `sky.uniforms` (the sun, its colour, the horizon, the day), so the water
// and the sky never disagree and no scene light is asked to reflect a dome.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, attribute, cameraPosition, cos, dot, float, length, max, mix, modelWorldMatrix, normalize, positionGeometry, pow, reflect, sin, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { noiseWith } from '../../../lib/three/noiseNodes';

const STEP = 2; // m between a sheet’s or a ribbon’s rows
const AMP = { river: 0.08, still: 0.01, lava: 0 };
const SPEED = { river: 0.6, still: 0, lava: 0.08 };
const FINE = { river: 1, still: 0.25, lava: 0 }; // the fine ripple’s share: a still pool is nearly a mirror
const RISE = 2.4; // m a full rise lifts the river
// the two octaves: wavelength (m), a share of the amplitude, the angle off the flow
const WAVES = [
  { length: 6.5, share: 1, angle: 0.35 },
  { length: 2.3, share: 0.45, angle: -0.6 },
];
const SHALLOW = new THREE.Color(0.17, 0.27, 0.2);
const DEEP = new THREE.Color(0.03, 0.08, 0.1);
const FOAM = new THREE.Color(0.86, 0.9, 0.9);
const HOT = new THREE.Color(1, 0.32, 0.04);
const CRUST = new THREE.Color(0.06, 0.03, 0.025);

// the rows of a flat sheet, or of a ribbon down a line, as one indexed mesh
function geometryOf({ area, along, level = 0, flow = [0, 1], ground }) {
  const pos = [];
  const dir = [];
  const deep = [];
  let cols;
  let rows;
  const put = (x, y, z, fx, fz) => {
    pos.push(x, y, z);
    dir.push(fx, fz);
    deep.push(ground ? y - ground(x, z) : 4);
  };
  if (along) {
    const { line, width, level: at } = along;
    rows = Math.max(1, Math.ceil(line.length / STEP));
    cols = Math.max(1, Math.ceil(width / STEP));
    for (let j = 0; j <= rows; j++) {
      const m = (j / rows) * line.length;
      const p = line.pointAt(m);
      const l = Math.hypot(p.tangent[0], p.tangent[2]) || 1;
      const [tx, tz] = [p.tangent[0] / l, p.tangent[2] / l];
      const y = at(m);
      for (let i = 0; i <= cols; i++) {
        const o = (i / cols - 0.5) * width;
        // (across to the flow’s right, so the faces wind upward, as the sheet’s)
        put(p.x + tz * o, y, p.z - tx * o, tx, tz);
      }
    }
  } else {
    const l = Math.hypot(flow[0], flow[1]) || 1;
    cols = Math.max(1, Math.ceil(area.w / STEP));
    rows = Math.max(1, Math.ceil(area.d / STEP));
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) put(area.x0 + (i / cols) * area.w, level, area.z0 + (j / rows) * area.d, flow[0] / l, flow[1] / l);
  }
  const index = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + cols + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry().setIndex(index);
  for (const [name, a, n] of [['position', pos, 3], ['aFlow', dir, 2], ['aDepth', deep, 1]]) g.setAttribute(name, new THREE.Float32BufferAttribute(a, n));
  g.computeBoundingSphere();
  return g;
}

export function createWater({ area = null, along = null, level = 0, flow = [0, 1], kind = 'river', sky = null, ground = null, speed = SPEED[kind] } = {}) {
  const s = sky?.uniforms ?? {};
  const u = {
    uTime: uniform(0),
    uRise: uniform(0),
    uFlow: uniform(speed),
    uLight: uniform(1),
    uSeed: uniform(new THREE.Vector3(5.3, 1.7, 9.1)),
  };
  // (the sky’s own uniforms when there is a sky, else still ones of a grey day)
  const sunDir = s.sunDir ?? uniform(new THREE.Vector3(0.3, 0.6, 0.7).normalize());
  const sunCol = s.sunCol ?? uniform(new THREE.Color(1, 0.95, 0.85));
  const horizon = s.horizon ?? uniform(new THREE.Color(0.75, 0.8, 0.85));
  const day = s.day ?? uniform(1);
  const { noise } = noiseWith(u.uSeed, { octaves: 2 });
  const amp = float(AMP[kind] ?? 0);
  const aFlow = attribute('aFlow', 'vec2');
  const depth = attribute('aDepth', 'float').toVarying('vDepth');
  const flowV = aFlow.toVarying('vFlow');
  const worldOf = modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz;
  const xzOf = worldOf.xz;
  const worldV = worldOf.toVarying('vWaterP');
  const xzV = worldV.xz;

  // the two octaves at a point: the lift and the slope (∂y/∂x, ∂y/∂z), drifting downstream
  const waves = (xz, f) => {
    const p = xz.sub(f.mul(u.uFlow.mul(u.uTime)));
    let y = float(0);
    let sx = float(0);
    let sz = float(0);
    for (const w of WAVES) {
      const c = Math.cos(w.angle);
      const sn = Math.sin(w.angle);
      const d = vec2(f.x.mul(c).sub(f.y.mul(sn)), f.x.mul(sn).add(f.y.mul(c)));
      const k = (2 * Math.PI) / w.length;
      const phase = dot(d, p).sub(u.uTime.mul(Math.sqrt(9.8 / k))).mul(k);
      const a = amp.mul(w.share);
      y = y.add(a.mul(sin(phase)));
      const g = a.mul(k).mul(cos(phase));
      sx = sx.add(d.x.mul(g));
      sz = sz.add(d.y.mul(g));
    }
    // the rise: the river heaped up in crests running down it
    const along = dot(p, f);
    const crest = sin(along.mul(0.35).sub(u.uTime.mul(3))).mul(0.4).add(0.6);
    return { y: y.add(u.uRise.mul(RISE).mul(crest)), sx, sz, crest };
  };

  const material = new MeshBasicNodeMaterial({ transparent: kind !== 'lava', depthWrite: kind === 'lava' });
  material.positionNode = Fn(() => positionGeometry.add(vec3(0, waves(xzOf, aFlow).y, 0)))();

  const lava = Fn(() => {
    const p = xzV.sub(flowV.mul(u.uFlow.mul(u.uTime)));
    const n = noise(vec3(p.mul(0.08), u.uTime.mul(0.05)), u.uSeed).mul(0.5).add(0.5);
    const crust = smoothstep(0.44, 0.56, noise(vec3(p.mul(0.35), 3), u.uSeed).mul(0.5).add(0.5));
    const hot = mix(vec3(HOT.r, HOT.g, HOT.b), vec3(1, 0.85, 0.35), smoothstep(0.55, 0.85, n)).mul(n.mul(1.6).add(1.2));
    return vec4(mix(hot, vec3(CRUST.r, CRUST.g, CRUST.b), crust.mul(0.9)), 1);
  });

  const water = Fn(() => {
    const w = waves(xzV, flowV);
    // the fine ripple on top, from the noise’s slope, drifting with the flow
    const q = xzV.sub(flowV.mul(u.uFlow.mul(u.uTime).mul(1.4))).mul(1.3);
    const n0 = noise(vec3(q, u.uTime.mul(0.3)), u.uSeed);
    const nx = noise(vec3(q.add(vec2(0.15, 0)), u.uTime.mul(0.3)), u.uSeed).sub(n0);
    const nz = noise(vec3(q.add(vec2(0, 0.15)), u.uTime.mul(0.3)), u.uSeed).sub(n0);
    // (faded out with distance, where it would only sparkle in the pixels)
    const toEye = cameraPosition.sub(worldV.add(vec3(0, w.y, 0)));
    const fine = amp.mul(1.5).add(0.004).mul(25 * (FINE[kind] ?? 1)).mul(smoothstep(140, 25, length(toEye)));
    const n = normalize(vec3(w.sx.add(nx.mul(fine)).negate(), 1, w.sz.add(nz.mul(fine)).negate()));
    const view = normalize(toEye);
    const fres = pow(max(dot(n, view), 0).oneMinus(), 5).mul(0.95).add(0.05);
    const r = reflect(view.negate(), n);
    const zenith = mix(vec3(0.01, 0.015, 0.04), vec3(0.22, 0.42, 0.78), day);
    const skyCol = mix(horizon, zenith, pow(max(r.y, 0), 0.5));
    const glint = sunCol.mul(pow(max(dot(r, sunDir), 0), 220).mul(day).mul(5));
    const body = mix(vec3(SHALLOW.r, SHALLOW.g, SHALLOW.b), vec3(DEEP.r, DEEP.g, DEEP.b), smoothstep(0.2, 1.6, depth)).mul(u.uLight);
    const c = mix(body, skyCol, fres).add(glint).toVar();
    // foam at the shallow edge, broken by the noise; and on the rise’s crests
    const edge = smoothstep(0.18, 0.02, depth).mul(smoothstep(0, 0.5, n0));
    const foam = edge.mul(0.55).add(u.uRise.mul(smoothstep(0.75, 1, w.crest))).clamp(0, 1);
    c.assign(mix(c, vec3(FOAM.r, FOAM.g, FOAM.b).mul(u.uLight), foam.mul(0.8)));
    // (none where the land stands above it; thin at the edge, so it meets the bank softly)
    const alpha = smoothstep(0, 0.12, depth).mul(mix(0.82, 0.97, max(fres, foam)));
    return vec4(c, alpha);
  });

  material.colorNode = kind === 'lava' ? lava() : water();
  const mesh = new THREE.Mesh(geometryOf({ area, along, level, flow, ground }), material);
  mesh.name = `water:${kind}`;
  // (the water is drawn after the ground it lies in)
  mesh.renderOrder = 1;

  return {
    mesh,
    uniforms: u,
    // the light the body of the water takes: the day’s ambient, and the sun up
    set(light) {
      const el = light?.sun?.el ?? 0.5;
      u.uLight.value = Math.min(1.2, 0.35 + (light?.ambient ?? 0.5) * 0.9 + Math.max(0, Math.sin(el)) * 0.5);
    },
    update: (dt) => void (u.uTime.value += dt),
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
