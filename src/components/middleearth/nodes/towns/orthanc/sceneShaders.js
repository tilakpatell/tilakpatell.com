// ../../../towns/orthanc/sceneShaders.js on the node renderer: Saruman’s
// robe of many colours, its patch a node hook on the robe’s physical
// material, the scene’s `robeTime` followed. It returns the node material,
// which the scene puts on the robe.

import {
  Fn,
  abs,
  clamp,
  dot,
  floor,
  fract,
  mix,
  normalViewGeometry,
  normalize,
  positionView,
  positionWorld,
  vec3,
} from "three/tsl";
import { asNode, follow, onColor } from "../../../../../lib/three/hookNodes";

// (GLSL’s mod, floored)
const robeHue = Fn(([h]) => {
  const x = h.mul(6).add(vec3(0, 4, 2));
  const m = x.sub(floor(x.div(6)).mul(6));
  return clamp(abs(m.sub(3)).sub(1), 0, 1);
}, "vec3");

// Bands of every colour down the robe, moving, and turning with the angle:
// `manyColours` patched, `robeTime` the scene’s clock for it.
export function manyColoursRobe(manyColours, robeTime) {
  const n = asNode(manyColours);
  const uRobeTime = follow(robeTime);
  return onColor(
    n,
    (dc) => {
      // (vNormal: the geometry’s, in the view, before any side’s flip)
      const robeAngle = abs(
        dot(normalize(positionView), normalize(normalViewGeometry)),
      ).oneMinus();
      return dc.rgb.mul(
        mix(
          vec3(1),
          robeHue(
            fract(
              positionWorld.y
                .mul(1.3)
                .add(robeAngle.mul(0.9))
                .add(uRobeTime.mul(0.2)),
            ),
          ),
          0.6,
        ),
      );
    },
    "orthanc-many-colours",
    { uRobeTime },
  );
}
