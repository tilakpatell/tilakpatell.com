// dust.js on the node renderer: puffs of dust for a hit, one instanced
// mesh, each card risen, swollen and faded by its age in the vertex stage,
// as a MeshBasicNodeMaterial, with the same names and uniforms (nodes).
//
//   createDust({ count, colour, size, life, up }) → { mesh, uniforms, burst(at, n, up), update(dt), used, dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, attribute, cameraProjectionMatrix, cameraViewMatrix, clamp, cos, length, vec2, materialReference, materialOpacity, modelWorldMatrix, positionGeometry, sin, smoothstep, step, texture, uniform, uv, varyingProperty, vec4 } from 'three/tsl';
import { blob } from './puffsNodes';
import { instanceMatrixOf } from './hookNodes';

const RISE = 0.6; // metres a card climbs over its life
const JITTER = 0.3; // metres a card may start from the place
const NEVER = -1e9; // a start time for a card that hasn’t been used

export function createDust({ count = 256, colour = 0xd9c8a8, size = 0.5, life = 0.8, up = [0, 1, 0] } = {}) {
  const dustMap = blob();
  const geometry = new THREE.PlaneGeometry(size, size);
  const starts = new Float32Array(count).fill(NEVER);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = Math.random();
  const aStart = new THREE.InstancedBufferAttribute(starts, 1);
  aStart.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aStart', aStart);
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const uniforms = { uDustTime: uniform(0), uDustLife: uniform(life), uDustRise: uniform(RISE) };
  const du = uniforms;
  const material = new MeshBasicNodeMaterial({ color: colour, map: dustMap, transparent: true, depthWrite: false });
  const fade = varyingProperty('float', 'vDustFade');
  // dustShader's vertex: the card at its instance's place, risen by its age,
  // facing the camera at the mesh's own scale, turned by its seed
  material.vertexNode = Fn((builder) => {
    const age = du.uDustTime.sub(attribute('aStart', 'float')).div(du.uDustLife);
    const seed = attribute('aSeed', 'float');
    const live = step(0, age).mul(step(age, 1));
    const a = clamp(age, 0, 1);
    // in quickly, out slowly; up fast, then hanging
    fade.assign(live.mul(smoothstep(0, 0.08, a)).mul(a.oneMinus()).mul(a.oneMinus()));
    const up = du.uDustRise.mul(a.oneMinus().mul(a.oneMinus()).oneMinus());
    const im = instanceMatrixOf(builder);
    const local = vec4(0, up, 0, 1);
    const mv = cameraViewMatrix.mul(modelWorldMatrix).mul(im ? im.mul(local) : local);
    const turn = seed.mul(6.2831853).add(a.mul(seed.sub(0.5)).mul(2));
    const c = cos(turn);
    const s = sin(turn);
    const g = positionGeometry;
    const xy = vec2(c.mul(g.x).sub(s.mul(g.y)), s.mul(g.x).add(c.mul(g.y))).mul(a.add(1)).mul(length(modelWorldMatrix.element(0).xyz));
    return cameraProjectionMatrix.mul(vec4(mv.xy.add(xy.mul(live)), mv.z, mv.w));
  })();
  // its fragment: the colour alone (the map is the cut-out, its red the
  // alpha), faded by its age, gone under 0.01
  // (the material's colour alone: three's materialColor is its colour
  // times its map, and the map here is the cut-out, not a colour)
  material.colorNode = materialReference('color', 'color');
  const alpha = materialOpacity.mul(texture(dustMap, uv()).r).mul(fade);
  material.opacityNode = alpha;
  material.maskNode = alpha.greaterThanEqual(0.01);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = 'dust';
  // (the cards are placed in the shader: three’s bounds don’t know where)
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  // (nothing in the air, nothing drawn: no draw call for dust till a hit)
  mesh.visible = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m.identity());
  let time = 0;
  let next = 0; // where the search for a free card starts
  let until = -Infinity; // when the last card out is gone
  const free = (i) => time - starts[i] >= life;
  return {
    mesh,
    uniforms,
    burst(at, n = 1, rise = up) {
      if (!at?.every?.(Number.isFinite) || !(n > 0)) return;
      q.setFromUnitVectors(Y, u.set(...rise).normalize());
      let placed = 0;
      const from = next;
      for (let k = 0; k < count && placed < n; k++) {
        const i = (from + k) % count;
        if (!free(i)) continue;
        const r = () => (Math.random() * 2 - 1) * JITTER;
        p.set(at[0] + r(), at[1] + r(), at[2] + r());
        mesh.setMatrixAt(i, m.compose(p, q, one));
        starts[i] = time;
        placed++;
        next = (i + 1) % count;
      }
      if (!placed) return;
      until = time + life;
      mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true;
      aStart.needsUpdate = true;
    },
    update(dt) {
      time += Math.max(0, dt || 0);
      uniforms.uDustTime.value = time;
      if (mesh.visible && time > until) mesh.visible = false;
    },
    get used() {
      let n = 0;
      for (let i = 0; i < count; i++) if (!free(i)) n++;
      return n;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      dustMap.dispose();
      mesh.dispose?.();
    },
  };
}
