# Lane Q1: the game material on the lit fixture

`node scripts/light-fixture.mjs --materials --legs webgl --size 1280x720`, the WebGL 2 leg (the node renderer on a WebGL 2 context, SwiftShader in the cloud). The WebGPU leg waits for the owner's laptop: the cloud's SwiftShader loses the WebGPU device.

Seven cubes, left to right from the sun's side: Luke's head, the large vehicle, the emissive light, the vegetation, the character, the melanin hair and the props (`scripts/fixtures/bf2017/materials/`). Each cube is its mesh's own GLB material, under its recipe. Behind them is a 4 × 2.5 m wall under the props recipe (the catwalk panel with `T_MetalDetail_02_NS` at its `NormalDetailScalar` of 2), with its UVs a unit a metre, seen at 2 m.

| shot | what |
| --- | --- |
| `fixture-glb-webgl.png`, `wall-glb-webgl.png` | the GLB's own materials (before) |
| `fixture-low-webgl.png`, `wall-low-webgl.png` | low: the GLB as it is |
| `fixture-mid-webgl.png`, `wall-mid-webgl.png` | mid: the detail and the emissive |
| `fixture-high-webgl.png`, `wall-high-webgl.png` | high: everything, parallax 8 steps |
| `fixture-ultra-webgl.png`, `wall-ultra-webgl.png` | ultra: everything, parallax 16 steps |

- **Low equals the GLB** (`materials-webgl.json`): mean difference 0 on both views. The wall is identical. In the row, 30 channel values differ, by at most 17/255.
- **Against the GLB**: the wall differs by a mean of 5.34/255 at mid and up, with 28% of channel values over 4/255. That is the detail normal's grain over the panels. The row differs by a mean of 1.99/255 at high and ultra.
- **Features drawn at ultra**:

  | cube | features |
  | --- | --- |
  | props | detail |
  | vehicle | detail, grunge (its slot holds a normal: dents), paint, metal |
  | character | weathering |
  | vegetation | reflectance, translucency, alphaTest, doubleSided |
  | emissive | emissive, alphaTest |
  | hair | melanin, tipTint, kajiyaKay, doubleSided |
  | head | none |

- **Missing from the bucket at shot time** (drawn without them):
  - the character's detail array `TA_CharacterDetail_17_NS`;
  - the hair's strand map `T_haskHairCap_RGBA`;
  - the head's `T_Heads_Luke_01_RSSSAO`.

  So the character shows no detail, the head has no scattering, and the hair's lobes run along the UVs' v.
- The vehicle mesh's GLB has no images (its look is bound in the game's variation database), so its cube is its flat factor colour.
- Hoth's own before/after waits for lane T's switch of `galaxy-surface` to the node renderer. Until then the classic renderer keeps the GLB's materials, by design. In Node, the game material changes 6 of the 123 meshes Hoth's pack draws (detail 5, emissive 1). The hand-off says why so few.
