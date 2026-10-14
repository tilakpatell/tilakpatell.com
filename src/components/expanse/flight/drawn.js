// The flight drawn as the classic renderer drew it. On the classic renderer
// the flight drew straight to the canvas (module.js's draw: no post chain),
// so each GLSL shader tone mapped and encoded its own fragment and then
// fogged it: three's fog_fragment comes after tonemapping_fragment and
// colorspace_fragment, so the fog was mixed in the canvas's values, toward
// the scene fog's colour in sRGB and the house's sky colours as they are
// (linear numbers read as sRGB ones: the far ground a shade darker than the
// sky behind it). And the sky dome's GLSL has no tone-mapping chunk at all.
// The node renderer draws the frame into a linear buffer and tone maps and
// encodes it once, at the end, after the fog, the dome with the rest. So
// where the two differ the flight writes the colour the frame's end turns
// into what the classic renderer showed: the dome's gradient, and a fogged
// fragment's mix, each through the tone mapper's inverse (the house's,
// Khronos PBR Neutral, has one in closed form).
//
//   shownAs(rgb) → the linear colour to write for the frame's end to show
//     `rgb` (linear, as a GLSL shader had it before its sRGB encoding)
//   classicFog(material) → the material, its fog mixed as the GLSL's was
//   drawnAsClassic(house) → the house, everything it adopts or makes from
//     then on given classicFog
//
// (A renderer whose tone mapping is neither the house's nor none is left
// as it was: its tone mapper isn't undone here.)

import * as THREE from 'three';
import { Fn, densityFogFactor, float, max, min, mix, neutralToneMapping, rangeFogFactor, reference, renderGroup, sRGBTransferEOTF, sRGBTransferOETF, select, sqrt, toneMappingExposure, vec3, vec4 } from 'three/tsl';
import { asNode, viewRay, wrap } from '../../../lib/three/hookNodes';
import { houseSky } from '../../../lib/three/houseNodes';

// three's neutralToneMapping's own numbers
const START = 0.76; // where its compression starts
const DESAT = 0.15;
const D = 1 - START;

// neutralToneMapping undone: the colour (times the exposure) it maps to y.
// Above START the peak was squeezed to y's own and the colour desaturated
// toward it; before that every channel was lowered by an offset read from
// the least of them. Both are undone in turn, from the formula's own steps.
const unNeutral = (y) => {
  const top = max(y.r, max(y.g, y.b));
  const np = top.min(0.9999); // (white has no finite colour behind it)
  const peak = float(D * D).div(np.oneMinus()).sub(D).add(START);
  const g = float(1).sub(float(1).div(peak.sub(np).mul(DESAT).add(1)));
  const c = select(top.lessThan(START), y, y.sub(vec3(np).mul(g)).div(g.oneMinus()).mul(peak.div(np)));
  const lo = min(c.r, min(c.g, c.b));
  const x = select(lo.lessThan(0.04), sqrt(lo.max(0).div(6.25)), lo.add(0.04));
  return c.add(x.sub(lo));
};

export const shownAs = (rgb) =>
  Fn((builder) => (builder.renderer?.toneMapping === THREE.NeutralToneMapping ? unNeutral(rgb).div(toneMappingExposure) : rgb))();

const undoable = (builder) => [THREE.NeutralToneMapping, THREE.NoToneMapping].includes(builder.renderer?.toneMapping);

// A fogged material's fog as its GLSL had it: the fragment tone mapped (if
// the material is) and encoded, then mixed toward three's fogColor (the
// fog's colour in the canvas's values) or, in the house's look, its sky
// (house.js's FOG_SKY), and that colour written through shownAs. Where
// there is no fog the fragment is left as three has it.
export function classicFog(material) {
  if (!material?.isNodeMaterial || material.fog === false || material.userData.__classicFog) return material;
  Object.defineProperty(material.userData, '__classicFog', { value: true, enumerable: false, configurable: true });
  return wrap(
    material,
    'setupFog',
    (out, builder, outputNode) => {
      const f = builder.scene?.fog;
      if (!f || builder.scene.fogNode || !builder.fogNode || !(f.isFog || f.isFogExp2) || !undoable(builder)) return out;
      const factor = f.isFogExp2 ? densityFogFactor(reference('density', 'float', f).setGroup(renderGroup)) : rangeFogFactor(reference('near', 'float', f).setGroup(renderGroup), reference('far', 'float', f).setGroup(renderGroup));
      const fogColour = sRGBTransferOETF(reference('color', 'color', f).setGroup(renderGroup));
      const u = material.userData.house;
      const sky = u ? mix(fogColour, houseSky(u, viewRay()), u.uLookFogMix) : fogColour;
      const lit = outputNode.rgb;
      const toned = material.toneMapped !== false && builder.renderer.toneMapping === THREE.NeutralToneMapping ? neutralToneMapping(lit, toneMappingExposure) : lit;
      const shown = shownAs(sRGBTransferEOTF(mix(sRGBTransferOETF(toned), sky, factor)));
      // (a material the GLSL didn't tone map isn't, fogged or not)
      const clear = material.toneMapped === false ? shownAs(lit) : lit;
      return vec4(select(factor.greaterThan(0), shown, clear), outputNode.a);
    },
    'flight:classic-fog',
  );
}

const classicOf = (m) => classicFog(asNode(m));

export function drawnAsClassic(house) {
  const { adopt, material } = house;
  house.adopt = (root) => {
    const n = adopt(root);
    root?.traverse?.((o) => {
      if (o.material) o.material = Array.isArray(o.material) ? o.material.map(classicOf) : classicOf(o.material);
    });
    return n;
  };
  house.material = (opts) => classicFog(material(opts));
  return house;
}
