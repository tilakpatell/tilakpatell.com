// The floating candles (the design’s §4.4): an instanced field of candles
// over the tables, each bobbing and drifting on its own phase, its flame
// flickering on its own clock: three draws for the whole field (the wax,
// the flames, the glow round them), however many there are, and nothing
// done a frame on the CPU. Their light is faked as a warm hemisphere over
// the hall (the room’s) and, on mid and up, a few real point lights hung
// in the field, breathing with it.
//
//   placeCandles(count, box, { seed }) → [[x, y, z, phase]]  (pure)
//   createCandles({ count, box, tier, seed }) → { group, lights, count, step(dt), set({ dim }), wax(geometry), dispose() }
//     dim: 0…1, how brightly they burn (lower by day; out for the dark)
//     wax: a model's wax in place of the plain cylinder (./hallModels.js's
//       waxOf), sized to it: its drips down every candle in the field

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, attribute, cameraProjectionMatrix, cos, float, length, mix, modelViewMatrix, positionGeometry, positionLocal, sin, smoothstep, time, uniform, uv, vec3, vec4 } from 'three/tsl';

const WAX_H = 0.26; // m
const WAX_R = 0.024;
const FLAME_Y = WAX_H + 0.045;

// A field of candles in the box, roughly even (jittered rows, so none
// stack and none form a visible grid), each with its own phase.
export function placeCandles(count, box, { seed = 11 } = {}) {
  let a = seed >>> 0 || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const [x0, x1] = box.x;
  const [y0, y1] = box.y;
  const [z0, z1] = box.z;
  const step = Math.sqrt(((x1 - x0) * (z1 - z0)) / count);
  const cols = Math.max(1, Math.round((x1 - x0) / step));
  const rows = Math.ceil(count / cols);
  const out = [];
  for (let r = 0; r < rows && out.length < count; r++)
    for (let c = 0; c < cols && out.length < count; c++) {
      const x = x0 + ((c + 0.5 + (rnd() - 0.5) * 0.8) / cols) * (x1 - x0);
      const z = z0 + ((r + 0.5 + (rnd() - 0.5) * 0.8) / rows) * (z1 - z0);
      out.push([x, y0 + rnd() * (y1 - y0), z, rnd() * Math.PI * 2]);
    }
  return out;
}

export function createCandles({ count, box, tier = 'high', seed = 11 }) {
  const spots = placeCandles(count, box, { seed });
  const n = spots.length;
  const group = new THREE.Group();
  group.name = 'hogwarts:candles';
  const uDim = uniform(1);
  const at = new Float32Array(n * 4);
  spots.forEach((s, i) => at.set(s, i * 4));
  const spot = new THREE.InstancedBufferAttribute(at, 4);
  const aSpot = attribute('aSpot', 'vec4');

  // where a candle is now: its spot, a slow bob and a little drift, all on its phase
  const bob = (p) => {
    const ph = aSpot.w;
    const y = sin(time.mul(0.55).add(ph)).mul(0.07).add(sin(time.mul(0.23).add(ph.mul(1.7))).mul(0.04));
    return p.add(aSpot.xyz).add(vec3(sin(time.mul(0.31).add(ph.mul(2.1))).mul(0.03), y, cos(time.mul(0.27).add(ph)).mul(0.03)));
  };
  const flick = (k) => {
    const ph = aSpot.w;
    return sin(time.mul(13 * k).add(ph.mul(5)))
      .mul(0.5)
      .add(sin(time.mul(29 * k).add(ph.mul(3))).mul(0.3))
      .mul(0.5)
      .add(0.85);
  };
  // a card centred at `y` up the candle, turned to the camera: `upright` keeps
  // its up the world’s (a flame), else it faces the camera whole (a glow)
  const card = (y, upright) => {
    const centre = modelViewMatrix.mul(vec4(bob(vec3(0, upright ? positionGeometry.y : float(y), 0)), 1));
    return cameraProjectionMatrix.mul(centre.add(vec4(positionGeometry.x, upright ? 0 : positionGeometry.y.sub(y), 0, 0)));
  };

  // the wax: a thin cylinder, lit warm from within near its flame
  const waxGeo = new THREE.CylinderGeometry(WAX_R * 0.92, WAX_R, WAX_H, 7, 1);
  waxGeo.translate(0, WAX_H / 2, 0);
  waxGeo.setAttribute('aSpot', spot);
  const wax = new MeshStandardNodeMaterial({ color: new THREE.Color('#efe4cc'), roughness: 0.55, metalness: 0 });
  // (warm toward its top, read off its height: a model's wax has no UVs to say)
  wax.emissiveNode = vec3(1.0, 0.62, 0.3).mul(smoothstep(WAX_H * 0.55, WAX_H, positionGeometry.y).mul(0.45).mul(uDim));
  wax.positionNode = bob(positionLocal);

  // the flame: a teardrop, bright at the root, narrowing to the tip
  const flameGeo = new THREE.PlaneGeometry(0.045, 0.1);
  flameGeo.translate(0, FLAME_Y, 0);
  flameGeo.setAttribute('aSpot', spot);
  const flame = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  flame.userData.noHouse = true;
  const p = uv();
  const tear = smoothstep(1, 0.2, abs(p.x.sub(0.5)).div(mix(float(0.5), float(0.06), p.y)))
    .mul(smoothstep(0, 0.12, p.y))
    .mul(smoothstep(1, 0.55, p.y));
  flame.colorNode = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.93, 0.72), p.y.oneMinus().mul(0.8)).mul(tear).mul(flick(1)).mul(2.6).mul(uDim);
  flame.vertexNode = card(FLAME_Y, true);

  // the glow: a soft disc round each flame, so the field reads as light from far off
  const glowGeo = new THREE.PlaneGeometry(0.46, 0.46);
  glowGeo.translate(0, FLAME_Y, 0);
  glowGeo.setAttribute('aSpot', spot);
  const glow = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  glow.userData.noHouse = true;
  const r = length(uv().sub(0.5)).mul(2);
  glow.colorNode = vec3(1.0, 0.6, 0.26).mul(smoothstep(1, 0, r).pow(2.4)).mul(0.34).mul(flick(0.6)).mul(uDim);
  glow.vertexNode = card(FLAME_Y, false);

  // (the instances’ own matrices are identity: the spot is the attribute, and
  // the field is never culled piece by piece)
  const meshes = [new THREE.InstancedMesh(waxGeo, wax, n), new THREE.InstancedMesh(flameGeo, flame, n), new THREE.InstancedMesh(glowGeo, glow, n)];
  const ident = new THREE.Matrix4();
  meshes.forEach((m, k) => {
    for (let i = 0; i < n; i++) m.setMatrixAt(i, ident);
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = k;
    group.add(m);
  });

  // a few real lights in the field (none on low), each over a stretch of the tables
  const lights = [];
  const points = { low: 0, mid: 3, high: 6, ultra: 8 }[tier] ?? 4;
  for (let i = 0; i < points; i++) {
    const z = box.z[0] + ((i + 0.5) / points) * (box.z[1] - box.z[0]);
    const l = new THREE.PointLight(0xffc48a, 30, 24, 1.4);
    l.position.set(i % 2 ? 3.6 : -3.6, box.y[0] - 0.2, z);
    l.userData.base = l.intensity;
    l.userData.phase = i * 1.7;
    lights.push(l);
    group.add(l);
  }
  let t = 0;
  let dim = 1;
  return {
    group,
    lights,
    count: n,
    step(dt) {
      t += dt;
      // (the real lights breathe with the field, never in step with each other)
      for (const l of lights) l.intensity = l.userData.base * dim * (0.92 + 0.05 * Math.sin(t * 7.3 + l.userData.phase) + 0.03 * Math.sin(t * 13.1 + l.userData.phase * 2));
    },
    set({ dim: d = dim } = {}) {
      dim = Math.max(0, Math.min(1, d));
      uDim.value = dim;
    },
    wax(geometry) {
      const g = geometry.clone();
      g.computeBoundingBox();
      const b = g.boundingBox;
      const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2;
      g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      g.scale(WAX_R / r, WAX_H / (b.max.y - b.min.y), WAX_R / r);
      g.setAttribute('aSpot', spot);
      meshes[0].geometry.dispose();
      meshes[0].geometry = g;
    },
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        m.material.dispose();
        m.dispose?.();
      }
      group.removeFromParent();
    },
  };
}
