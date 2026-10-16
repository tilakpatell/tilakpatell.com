// Hyperspace traffic in the sky (../skyStreaks.js) on the node renderer:
// the same streaks, one quad a streak in one mesh, one draw, its corners
// worked out from the head and the tail on the GPU, line for line with the
// GLSL. The vertex shader is the material’s vertexNode (it writes the clip
// position itself, as the GLSL’s main did, cutting a streak off at the near
// side and throwing one with nothing to draw out past the picture); the
// glow is its colourNode. The same uniforms under the same names (nodes,
// on `material.uniforms`, so `uHalf.value.set(…)` writes them as before),
// the same flags; toneMapped off, as the GLSL had no tone-mapping chunk.
//
// createSkyStreaks({ renderer, rand }) → { group, setSystem(links, r), update(dt), live, dispose() }
//   setSystem: the lanes’ links from here (skyTraffic.js laneLinks) and the
//   planet’s radius; none with no links (the group draws nothing then)

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, If, attribute, clamp, float, length, max, mix, modelViewMatrix, cameraProjectionMatrix, select, smoothstep, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { STREAKS, createSkyTraffic, streakAt } from '../skyTraffic';

function streakMaterial() {
  const u = { uHalf: uniform(new THREE.Vector2(1, 1)), uWidth: uniform(1.3), uColor: uniform(new THREE.Color(1.6, 1.8, 2.4)) };
  const mat = new MeshBasicNodeMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false });
  const aHead = attribute('aHead', 'vec3');
  const aTail = attribute('aTail', 'vec3');
  const aCorner = attribute('aCorner', 'vec3'); // x: 0 the tail, 1 the head; y: -1 or 1 across; z: how bright
  mat.vertexNode = Fn(() => {
    const h = modelViewMatrix.mul(vec4(aHead, 1)).toVar();
    const t = modelViewMatrix.mul(vec4(aTail, 1)).toVar();
    const out = vec4(2, 2, 2, 1).toVar();
    // (behind the camera: none of it; part behind: cut off at the near side)
    const NEAR = float(-0.2);
    If(h.z.greaterThan(NEAR).and(t.z.greaterThan(NEAR)).or(aCorner.z.lessThanEqual(0)).not(), () => {
      If(h.z.greaterThan(NEAR), () => {
        h.assign(vec4(mix(t.xyz, h.xyz, NEAR.sub(t.z).div(h.z.sub(t.z))), h.w));
      });
      If(t.z.greaterThan(NEAR), () => {
        t.assign(vec4(mix(h.xyz, t.xyz, NEAR.sub(h.z).div(t.z.sub(h.z))), t.w));
      });
      const ch = cameraProjectionMatrix.mul(h);
      const ct = cameraProjectionMatrix.mul(t);
      const d = ch.xy.div(ch.w).sub(ct.xy.div(ct.w)).mul(u.uHalf);
      const l = length(d);
      const along = select(l.greaterThan(1e-4), d.div(l), vec2(1, 0));
      const across = vec2(along.y.negate(), along.x);
      const c = mix(ct, ch, aCorner.x).toVar();
      // a few pixels wide, more close to; and out past each end by as much,
      // so a streak seen end on is a spark, not nothing
      const w = u.uWidth.mul(clamp(float(160).div(max(mix(t.z, h.z, aCorner.x).negate(), 1)), 1, 2.6));
      const off = across.mul(aCorner.y).add(along.mul(aCorner.x.mul(2).sub(1))).mul(w).div(u.uHalf).mul(c.w);
      out.assign(vec4(c.xy.add(off), c.z, c.w));
    });
    return out;
  })();
  const side = aCorner.y;
  const a = aCorner.x;
  const core = side.mul(side).oneMinus().pow(3);
  const tail = a.mul(a);
  const head = smoothstep(0.8, 1, a);
  mat.colorNode = u.uColor.mul(core).mul(tail).add(vec3(1.6).mul(core).mul(head)).mul(aCorner.z);
  mat.opacityNode = float(1);
  mat.uniforms = u;
  return mat;
}

export function createSkyStreaks({ renderer, rand = Math.random } = {}) {
  const group = new THREE.Group();
  const n = STREAKS.max;
  const geo = new THREE.BufferGeometry();
  const head = new Float32Array(n * 4 * 3);
  const tail = new Float32Array(n * 4 * 3);
  const corner = new Float32Array(n * 4 * 3);
  const index = [];
  for (let i = 0; i < n; i++) {
    [
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 1],
    ].forEach(([a, s], j) => corner.set([a, s, 0], (i * 4 + j) * 3));
    const o = i * 4;
    index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  }
  geo.setIndex(index);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3)); // (unused: the corners are worked out from the ends)
  geo.setAttribute('aHead', new THREE.BufferAttribute(head, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aTail', new THREE.BufferAttribute(tail, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = streakMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // (left visible with nothing to draw, not hidden: three draws nothing for
  // an empty range, and the scene’s warm-up compiles only what’s visible, so
  // the first ship out doesn’t stall a frame compiling it)
  geo.setDrawRange(0, 0);
  group.add(mesh);

  let traffic = createSkyTraffic({ links: [], rand });
  let radius = 1;
  const px = new THREE.Vector2();
  return {
    group,
    get live() {
      return traffic.live.length;
    },
    setSystem(links, r) {
      traffic = createSkyTraffic({ links, rand });
      radius = r;
    },
    update(dt) {
      const live = traffic.update(dt);
      if (!live.length) {
        geo.setDrawRange(0, 0);
        return;
      }
      renderer?.getDrawingBufferSize(px);
      mat.uniforms.uHalf.value.set(Math.max(1, px.x / 2), Math.max(1, px.y / 2));
      mat.uniforms.uWidth.value = 1.3 * (renderer?.getPixelRatio() ?? 1);
      for (let i = 0; i < n; i++) {
        const s = live[i] ? streakAt(live[i], { r: radius }) : null;
        for (let j = 0; j < 4; j++) {
          const v = (i * 4 + j) * 3;
          if (s) {
            head.set(s.head, v);
            tail.set(s.tail, v);
          }
          corner[v + 2] = s ? s.fade : 0;
        }
      }
      geo.setDrawRange(0, Math.min(live.length, n) * 6);
      geo.attributes.aHead.needsUpdate = true;
      geo.attributes.aTail.needsUpdate = true;
      geo.attributes.aCorner.needsUpdate = true;
    },
    dispose() {
      group.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
