// dye.js on the node renderer: a material dyed a colour, keeping its light
// and shade and the luminance of its texture, taking the dye’s hue in place
// of its own (dye.js’s header says why), as a node material with the same
// name, arguments and uniforms (uniform nodes under the GLSL’s names, on
// `userData.dye`). The dye is laid in where the GLSL laid it, after the map
// and before the vertex and instance colours: the material’s colour node.
//
//   dyed(material, { color, gain = 2, keep = 0, skin = true, roughness?, metalness? }) → a node copy
//     (a classic material is copied into its node twin; a node one is cloned)

import * as THREE from 'three';
import { clamp, dot, materialColor, max, mix, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import { asNode } from './hookNodes';

// (skin: a warm texel, red over green over blue, is a face or a hand and keeps its colour; an olive
// or a blue cloth has its green or its blue over its red)
function dyeOf(own, u) {
  const lum = dot(own, vec3(0.299, 0.587, 0.114));
  const skin = u.uDyeSkin.mul(smoothstep(0.04, 0.12, own.r.sub(own.b))).mul(smoothstep(0, 0.03, own.r.sub(own.g)));
  return mix(u.uDye.mul(clamp(lum.mul(u.uDyeGain), 0, 1.6)), own, max(u.uDyeKeep, skin));
}

export function dyed(material, { color, gain = 2, keep = 0, skin = true, roughness, metalness } = {}) {
  // (a copy of its own: the original stays as it was, as dye.js’s clone leaves it)
  const m = material.isNodeMaterial ? material.clone() : asNode(material.clone());
  // (the dye is the colour: a texture’s own colour would be multiplied in under it; a material
  // with no texture is its colour alone, and that is the luminance to dye)
  if (m.color && m.map) m.color.set(0xffffff);
  if (roughness !== undefined) m.roughness = roughness;
  if (metalness !== undefined) m.metalness = metalness;
  const uniforms = {
    uDye: uniform(new THREE.Color(color)),
    uDyeGain: uniform(gain),
    uDyeKeep: uniform(keep),
    uDyeSkin: uniform(skin ? 1 : 0),
  };
  // (its own colour node, if it had one, is what is dyed; else three’s: the colour times the map)
  const own = vec4(m.colorNode ?? materialColor);
  m.colorNode = vec4(dyeOf(own.rgb, uniforms), own.a);
  Object.defineProperty(m.userData, 'dye', { value: uniforms, enumerable: false, configurable: true });
  m.needsUpdate = true;
  return m;
}
