// The Marshes’ kit, made for the Road: the materials the Marshes chapter’s
// builders read (towns/marshes/props.js’s cliff, face, blackGate and the
// rest; its face takes a kit’s K.shaders.face first; Gollum is
// creatures/gollum.js’s, on every stage he walks),
// under the same names and from the same painted canvases as the chapter’s
// kit (towns/marshes/props.js’s createMarshesKit), added to a town kit
// (townKit.js’s) on the Road’s house look. The chapter’s one shader is the
// drowned faces’; here each face is a node sheet of its painted face, pale
// and fading in as the builder raises its uK, the water’s own sway left to
// the scene.
//
//   addMarshes(town, road, renderer) → { tex, dispose() }
//     town: createTownKit’s, made `wild` (its bark, its void); K gains the
//     Marshes’ mats, tex, faceGeo and shaders

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { texture, uniform, uv } from 'three/tsl';
import { canvasTexture, hot } from '../../../lib/three/canvasTexture';
import { normalFromField } from '../../../lib/paint';
import { eyeCanvas, faceCanvas, faceGeo, flameCanvas, glowCanvas, ironCanvas, rockCanvas, ropeCanvas } from '../towns/marshes/props';

const S = 256;

export function addMarshes(town, road, renderer) {
  const { K, mats } = town;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const made = [];
  const M = (o) => {
    const m = road.material(o);
    made.push(m);
    return m;
  };
  const B = (o) => {
    const m = new MeshBasicNodeMaterial(o);
    made.push(m);
    return m;
  };
  const rock = rockCanvas(S, 23);
  const iron = ironCanvas(S, 29);
  const tex = {
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    iron: T(iron.c),
    ironN: T(normalFromField(iron.field, S, S, 3), { srgb: false }),
    glow: T(glowCanvas(), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    eye: T(eyeCanvas(), { wrap: false }),
    rope: T(ropeCanvas()),
    faces: [0, 1, 2].map((k) => T(faceCanvas(k), { wrap: false })),
  };
  // the drowned faces: a face's picture in, its material out with the
  // uniforms the builder writes (uTime, uK: its fading in is the builder's),
  // as the chapter's node twin takes and gives them
  const face = (map) => {
    const uniforms = { uTime: uniform(0), uK: uniform(0), uLift: uniform(0.72), uTint: uniform(new THREE.Color(0xa4c4b8)) };
    const m = B({ transparent: true, depthWrite: false, fog: true });
    const c = texture(map, uv());
    m.colorNode = c.rgb.mul(uniforms.uTint);
    m.opacityNode = c.a.mul(uniforms.uK);
    m.uniforms = uniforms;
    return m;
  };
  Object.assign(mats, {
    // (warmed: under the Road’s grey sky the chapter’s cold grey reads violet)
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, color: 0xd6ccb8 }),
    wood: M({ map: K.tex.bark, normalMap: K.tex.barkN, vertexColors: true }),
    reeds: M({ vertexColors: true, side: THREE.DoubleSide }),
    easterling: M({ vertexColors: true }),
    elvenRope: M({ map: tex.rope, color: 0xe4e8ec, emissive: new THREE.Color(0x2c3238) }),
    beastHide: M({ vertexColors: true }),
    mouth: M({ color: 0x1a0d0c }),
    beastHorn: M({ color: 0x4a423c }),
    beastEye: B({ color: hot(0xff7a2a, 1.6) }),
    membrane: M({ vertexColors: true, side: THREE.DoubleSide }),
    nazgulRobe: M({ color: 0x0e0e10, side: THREE.DoubleSide }),
    gauntlet: M({ color: 0x2a2a2e }),
    saddle: M({ color: 0x1e1612 }),
    void: mats.void ?? B({ color: 0x000000 }),
    gateStone: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true }),
    gateIron: M({ map: tex.iron, normalMap: tex.ironN, vertexColors: true }),
    slit: B({ color: hot(0xff5a1a, 2.2) }),
    mountain: M({ map: tex.rock, vertexColors: true }),
    lacquer: M({ vertexColors: true, side: THREE.DoubleSide }),
    eastMetal: M({ vertexColors: true }),
    cloak: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, side: THREE.DoubleSide }),
  });
  const geo = faceGeo();
  K.tex = { ...K.tex, ...tex };
  K.faceGeo = geo;
  K.shaders = { ...K.shaders, face };

  return {
    tex,
    dispose() {
      for (const m of made) m.dispose();
      for (const t of [...Object.values(tex).flat()]) t.dispose();
      geo.dispose();
    },
  };
}
