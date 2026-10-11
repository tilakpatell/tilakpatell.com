// marks.js on the node renderer: the same sheets, pool and instances
// (./marksCore.js), drawn by a MeshBasicNodeMaterial with the same flags
// and uniform names, line for line with marks.js's GLSL (its `defines` a
// choice made here, by the mode). A sprite faces the camera as the GLSL's
// did: its instance's centre in view space, the quad laid flat on the
// screen about it at the instance's scale.
//
// createSheetFx(parent, { texture, ramp, mode, channel, count, life, fog })
//   → { mesh, add(at, normal, { size, frame, tint, bright, life, grow }), update(dt), clear(), dispose() }

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, clamp, dot, float, floor, length, mix, modelViewMatrix, positionGeometry, select, smoothstep, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { instanceMatrixOf, wrap } from '../hookNodes';
import { createSheetFxWith } from './marksCore';

const CHAN = { r: [1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1, 0] };

// (the GLSL's sampler left null where there's no ramp: one black texel,
// never read, uHasRamp says so)
const NONE = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

function sheetMaterial({ texture: map, ramp, mode, channel, fog, grid, additive }) {
  const u = {
    uGrid: uniform(new THREE.Vector2(...grid)),
    uChan: uniform(new THREE.Vector4(...CHAN[channel])),
    uHasRamp: uniform(ramp ? 1 : 0),
    uRampV: uniform(ramp?.userData.look?.rampV ?? 0.5),
    uMap: texture(map),
    uRamp: texture(ramp ?? NONE),
  };
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    fog,
    // (a mark sits on what it marks, not in it)
    polygonOffset: !additive,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  const info = attribute('aInfo', 'vec4'); // age 0…1, frame, unused, brightness
  const tint = attribute('aTint', 'vec3');
  const col = info.y.sub(u.uGrid.x.mul(floor(info.y.div(u.uGrid.x))));
  const row = floor(info.y.div(u.uGrid.x));
  const vUv = uv().add(vec2(col, u.uGrid.y.sub(1).sub(row))).div(u.uGrid).toVarying('vUv');
  if (mode === 'sprite') {
    wrap(
      mat,
      'setupPositionView',
      (pv, builder) => {
        const im = instanceMatrixOf(builder);
        if (!im) return pv;
        const mv = modelViewMatrix.mul(im.mul(vec4(0, 0, 0, 1)));
        return mv.xyz.add(vec3(positionGeometry.xy.mul(length(im.element(0).xyz)), 0));
      },
      'sheet:sprite',
    );
  }
  const t = u.uMap.sample(vUv);
  const age = info.x;
  const fade = smoothstep(0.7, 1, age).oneMinus();
  if (mode === 'decal') {
    mat.colorNode = tint;
    mat.opacityNode = dot(t, u.uChan).mul(fade).mul(info.w);
  } else if (mode === 'decal-colour') {
    const l = dot(t.rgb, vec3(0.333));
    mat.colorNode = t.rgb.mul(tint);
    mat.opacityNode = clamp(l.mul(4), 0, 1).mul(fade).mul(info.w);
  } else {
    const m = dot(t, u.uChan);
    const heat = age.oneMinus();
    // the game's ramp, or the site's own cooling where it has none (both
    // read, then chosen)
    const ramped = u.uRamp.sample(vec2(heat.mul(0.96).add(0.02), u.uRampV)).rgb;
    const cooling = mix(vec3(0.5, 0.08, 0.02), vec3(1, 0.95, 0.85), heat.mul(heat));
    const fire = select(u.uHasRamp.greaterThan(0.5), ramped, cooling);
    mat.colorNode = fire.mul(tint).mul(m).mul(info.w).mul(heat);
    mat.opacityNode = float(1);
  }
  mat.uniforms = u;
  return mat;
}

export const createSheetFx = (parent, opts) => createSheetFxWith(sheetMaterial, parent, opts);
