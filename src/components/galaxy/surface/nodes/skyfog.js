// The fog the sky's own colour (../skyfog.js) on the node renderer: three's
// fog factor for the scene's FogExp2, its colour mixed toward the dome's
// along the view ray by uSfMix, as a fog hook (lib/three/hookNodes' onFog)
// on each material that takes fog. The uniforms are the dome's own nodes
// (./sky.js's), shared, and its own under the GLSL's names.
//
//   createSkyFog(sky) → { uniforms, patch(material), scene(root), look({ halo, below }), indoors(on) }
//   skyFogColour(uniforms, dir) → the sky's colour that way (SKY_FOG's)
//
// `sky` is the node sky ({ uniforms } from ./sky.js's skyMaterial). A
// classic material met by scene(root) is swapped on its object for its
// node twin.

import * as THREE from 'three';
import { abs, dot, exp, max, mix, pow, select, smoothstep, uniform } from 'three/tsl';
import { asNode, onFog, viewRay } from '../../../../lib/three/hookNodes';
import { rev } from './common';
import { MAX_SUNS } from './sky';

export function skyFogColour(u, dir) {
  const el = dir.y;
  let c = mix(u.uSfHorizon, u.uSfZenith, pow(smoothstep(0, 0.75, el), 0.6));
  c = mix(c, u.uSfBelow.mul(u.uSfBelowK), rev(0, -0.12, el));
  c = mix(c, u.uSfHaze, exp(abs(el).mul(-9)).mul(u.uSfHazeK));
  for (let i = 0; i < MAX_SUNS; i++) {
    // (a sun that isn't there adds nothing: its size's z is 0)
    const size = u.uSfSunSize.nodes[i];
    c = c.add(u.uSfSunColor.nodes[i].mul(pow(max(dot(dir, u.uSfSunDir.nodes[i]), 0), 12)).mul(0.32).mul(size.y).mul(select(size.z.greaterThan(0), 1, 0)));
  }
  // (the world's look: a halo round its sun, the house's)
  return c.add(u.uSfHalo.mul(pow(max(dot(dir, u.uSfSunDir.nodes[0]), 0), 6)));
}

export function createSkyFog(sky) {
  const u = sky.uniforms;
  const uniforms = {
    uSfZenith: u.uZenith,
    uSfHorizon: u.uHorizon,
    uSfBelow: u.uBelow,
    uSfHaze: u.uHaze,
    uSfHazeK: u.uHazeK,
    uSfSunDir: u.uSunDir,
    uSfSunColor: u.uSunColor,
    uSfSunSize: u.uSunSize,
    uSfMix: uniform(1),
    uSfHalo: uniform(new THREE.Color(0, 0, 0)),
    uSfBelowK: uniform(1),
  };
  const patch = (material) => {
    if (!material || material.userData.skyFog || !material.fog || !material.isNodeMaterial) return material;
    material.userData.skyFog = true;
    onFog(material, (fogColor) => mix(fogColor, skyFogColour(uniforms, viewRay()), uniforms.uSfMix), 'skyfog');
    return material;
  };
  const twin = (m) => (m && !m.isNodeMaterial && !m.isShaderMaterial ? asNode(m) : m);
  return {
    uniforms,
    patch,
    scene(root) {
      root.traverse((o) => {
        if (!o.material) return;
        if (Array.isArray(o.material)) o.material = o.material.map((m) => patch(twin(m)));
        else o.material = patch(twin(o.material));
      });
    },
    look({ halo = null, below = null } = {}) {
      if (halo != null) uniforms.uSfHalo.value.set(halo);
      if (below != null) uniforms.uSfBelowK.value = below;
    },
    indoors(on) {
      uniforms.uSfMix.value = on ? 0 : 1;
    },
  };
}
