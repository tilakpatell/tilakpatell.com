// livery.js on the node renderer: the same paint job and rim, the same
// workings (./liveryCore.js) and uniforms, taught as node hooks
// (lib/three/hookNodes.js) where livery.js swaps three's chunks:
//
//   map_fragment's paint           onColor (diffuseColor once the texture's read)
//   emissivemap_fragment's rim     onLight (added to the light out, as the emissive is)
//   the fill's light, scaled       onDirect (the directional light from the rim's way)
//
// A classic material comes back as its node twin, on the mesh in its
// place. Every material a livery teaches reads one node a uniform, so they
// share their programs as the GLSL's did.
//
// createLivery() → { apply(root, fit, { clone, only }), set(paint),
//   rim({ colour, dir, key }), dispose() }
// complement(key) → [r, g, b]

import { cameraViewMatrix, clamp, dot, max, min, mix, normalView, normalize, positionViewDirection, pow, select, smoothstep, vec3, vec4 } from 'three/tsl';
import { asNode, follow, isSun, onColor, onDirect, onLight } from '../../lib/three/hookNodes';
import { createLiveryWith } from './liveryCore';

export { complement } from './liveryCore';

// one uniform node a { value } (the core's are shared by the whole ship)
const nodes = new WeakMap();
const held = (holder) => {
  if (!nodes.has(holder)) nodes.set(holder, follow(holder));
  return nodes.get(holder);
};

function teach(material, uniforms) {
  const m = asNode(material);
  const u = Object.fromEntries(Object.entries(uniforms).map(([k, h]) => [k, held(h)]));
  // after the texture's been read into diffuseColor (linear)
  onColor(
    m,
    (diffuse) => {
      const bare = diffuse.rgb;
      const lum = dot(bare, vec3(0.2126, 0.7152, 0.0722));
      const top = max(bare.r, max(bare.g, bare.b));
      const sat = select(top.greaterThan(0.0001), min(bare.r, min(bare.g, bare.b)).div(top).oneMinus(), 0);
      const marked = max(smoothstep(u.paintFit.y, u.paintFit.z, sat), u.paintDark.z.mul(smoothstep(u.paintDark.x, u.paintDark.y, lum).oneMinus()));
      const shade = clamp(pow(lum.div(u.paintFit.x), 0.7), 0.3, 1.5);
      const coat = min(mix(u.paintHull, u.paintTrim, marked).mul(shade), vec3(1));
      return select(u.paintOn.greaterThan(0), mix(bare, coat, u.paintOn.mul(smoothstep(u.paintFit.w.mul(0.5), u.paintFit.w, lum))), bare);
    },
    'paint',
    u,
  );
  // with the emissive: the edges (n·v grazing, cubed) that face the rim's light
  const rimV = () => normalize(cameraViewMatrix.mul(vec4(u.uRimDir, 0)).xyz);
  onLight(
    m,
    (light) => {
      const edge = pow(clamp(dot(normalView, positionViewDirection), 0, 1).oneMinus(), 3);
      return light.add(u.uRimColour.mul(u.uRimStrength).mul(edge).mul(max(0, dot(normalView, rimV()))));
    },
    'paint:rim',
  );
  // the directional light that comes from the rim's way (the fill), scaled
  onDirect(
    m,
    (input, call) => {
      if (!isSun(input.lightNode)) return call();
      const k = select(dot(input.lightDirection, rimV()).greaterThan(0.9999), u.uFillScale, 1);
      return call({ ...input, lightColor: input.lightColor.mul(k) });
    },
    'paint:fill',
  );
  m.userData.painted = true;
  // (its uniform nodes, for a look in: kept out of a clone's copy of userData)
  Object.defineProperty(m.userData, 'paint', { value: u, enumerable: false, configurable: true });
  return m;
}

export const createLivery = () => createLiveryWith(teach);
