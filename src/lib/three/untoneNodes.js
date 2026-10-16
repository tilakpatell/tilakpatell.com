// A colour that leaves the node renderer as it was written, under the
// renderer's tone mapping: the twin of a GLSL shader with no tone-mapping
// chunk (a sky dome's ShaderMaterial), which the classic renderer sends out
// untoned. The node renderer tone-maps the whole frame in its framebuffer
// pass, so a material's `toneMapped = false` is not heard there; the colour
// is put through the tone mapper backwards first, and comes out where the
// GLSL one did.
//
//   untoned(colour) → a vec3 node: `colour` where the renderer has no tone
//     mapping, the colour three's Neutral (the house's, lib/three/
//     houseNodes) takes to `colour` where it has Neutral
//
// Only Neutral is run backwards, the one tone mapper the house uses; under
// another a colour goes as it is (the GLSL original's under that one too
// has no twin that needs this yet). A colour Neutral never reaches (a
// channel at 1 or more) comes out at the brightest it can reach.

import { NeutralToneMapping } from 'three';
import { Fn, float, max, min, select, sqrt, toneMappingExposure } from 'three/tsl';

// three's own (nodes/display/ToneMappingFunctions.js, neutralToneMapping)
const START = 0.8 - 0.04;
const D = 1 - START;
const DESATURATION = 0.15;

// neutralToneMapping run backwards: the peak first (the mix with the new
// peak keeps it the colour's brightest channel), the squeeze and the
// desaturation undone above the start of the compression, then the offset
// (x − m in both of its cases: x − 6.25x² below 0.08, 0.04 above), then the
// exposure
const unNeutral = Fn(([toned, exposure]) => {
  const newPeak = min(max(toned.r, max(toned.g, toned.b)), 0.9999);
  const peak = float(D * D).div(newPeak.oneMinus()).sub(D).add(START);
  const g = float(1).sub(float(1).div(peak.sub(newPeak).mul(DESATURATION).add(1)));
  const squeezed = toned.sub(g.mul(newPeak)).div(g.oneMinus()).mul(peak.div(newPeak));
  const c = select(newPeak.lessThan(START), toned, squeezed);
  const m = max(min(c.r, min(c.g, c.b)), 0);
  const x = select(m.lessThan(0.04), sqrt(m).div(2.5), m.add(0.04));
  return c.add(x.sub(m)).div(exposure);
}).setLayout({
  name: 'unNeutral',
  type: 'vec3',
  inputs: [
    { name: 'toned', type: 'vec3' },
    { name: 'exposure', type: 'float' },
  ],
});

// (the renderer's tone mapping read as the material is built: a world sets
// it before its first frame, as houseOn does, and a later change is not
// heard. The render target is not asked: the renderer draws a frame into
// targets of its own and the runtime's (its framebuffer, the resolution
// controller's) and tone-maps on the way out, so a material drawn into a
// target that never reaches the screen tone-mapped would come out darker;
// no twin that uses this draws into one)
export const untoned = (colour) => Fn((builder) => (builder.renderer?.toneMapping === NeutralToneMapping ? unNeutral(colour, toneMappingExposure) : colour))();
