// ../../shire/propsShaders.js on the node renderer: the flowers' tint as a
// node hook (lib/three/hookNodes) in place of the GLSL's color_vertex.
//
// A node material multiplies its diffuse colour by the instance's colour
// whole (NodeMaterial.setupDiffuseColor), so the hook keeps the instance's
// colour from it while the colour is set up and multiplies it in after,
// mixed by the geometry's `tint` as the GLSL had it. Returns the node
// material, which a classic one handed in becomes.

import {
  attribute,
  diffuseColor,
  instanceColor,
  mix,
  vec3,
  vec4,
} from "three/tsl";
import { asNode, keyed } from "../../../../lib/three/hookNodes";

// the flowers' heads take an instance's colour, their stems don't: the
// geometry's `tint` (1 on the petals) says how much
export function flowerTint(material) {
  if (!material) return material;
  const m = asNode(material);
  const before = m.setupDiffuseColor;
  m.setupDiffuseColor = function (builder, ...rest) {
    const object = builder.object;
    const colours = object?.instanceColor ?? null;
    if (!colours) return before.call(this, builder, ...rest);
    // (the instance's colour left out of three's own multiply, for this
    // one build, and put back by the tint)
    object.instanceColor = null;
    let out;
    try {
      out = before.call(this, builder, ...rest);
    } finally {
      object.instanceColor = colours;
    }
    const tint = attribute("tint", "float");
    diffuseColor.assign(
      vec4(
        diffuseColor.rgb.mul(mix(vec3(1), instanceColor, tint)),
        diffuseColor.a,
      ),
    );
    return out;
  };
  return keyed(m, "flowerTint");
}
