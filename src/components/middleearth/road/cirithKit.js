// Cirith Ungol’s kit, made for the Road: the materials the Cirith Ungol
// chapter’s builders read (towns/cirithungol/props.js’s morgul, witchKing,
// shelob, phial and the rest), under the same names and from the same
// painted canvases as the chapter’s kit (its createCirithKit), added to a
// town kit (townKit.js’s) on the Road’s house look. The chapter’s shaders
// are its own (nodes/towns/cirithungol's twins; its builders take a kit’s
// K.shaders first);
// here each is a node material that keeps what it is for: Minas Morgul’s
// walls a cold green glow strongest at their edges, its beam a green shaft
// that climbs as the builder raises uBeam, the splash a green burst under
// the cloud; the orcs’ and Shelob’s hides their colours without the bump.
//
//   addCirith(town, road, renderer) → { tex, tick(t), dispose() }
//     town: createTownKit’s, made `wild` (its void); K gains Cirith Ungol’s
//     mats, tex, U and shaders

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, color, dot, float, normalView, positionViewDirection, pow, smoothstep, uniform, uv } from 'three/tsl';
import { canvasTexture, hot } from '../../../lib/three/canvasTexture';
import { normalFromField } from '../../../lib/paint';
import { blockCanvas, flagCanvas, flameCanvas, glowCanvas, noiseCanvas, rockCanvas, starCanvas, webCanvas } from '../towns/cirithungol/props';

const S = 256;

// a builder’s uniform, as a node: made once, so what it sets on .value reaches the material
const node = (U, k, fallback = 0) => (U[k]?.isNode ? U[k] : (U[k] = uniform(U[k]?.value ?? fallback)));

export function addCirith(town, road, renderer) {
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
  const block = blockCanvas(S, 31);
  const flag = flagCanvas(S, 37);
  const tex = {
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    block: T(block.c),
    blockN: T(normalFromField(block.field, S, S, 2.5), { srgb: false }),
    flags: T(flag.c),
    flagsN: T(normalFromField(flag.field, S, S, 2.5), { srgb: false }),
    glow: T(glowCanvas(), { wrap: false }),
    star: T(starCanvas(), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    web: T(webCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
  };
  K.U = { uTime: { value: 0 }, uNoise: { value: tex.noise } };
  // (the face turned to the eye: 1 head on, 0 at the rim)
  const facing = abs(dot(normalView, positionViewDirection));

  // Minas Morgul’s walls: pale stone lit cold green from within, most at the edges
  const ghost = (U) => {
    const glow = node(U, 'uGlow', 1);
    const tint = node(U, 'uGhost', new THREE.Color(0.3, 1, 0.46));
    const m = M({ vertexColors: true, color: 0x5c6862 });
    const rim = pow(float(1).sub(facing), 3);
    m.emissiveNode = tint.mul(glow).mul(rim.mul(0.5).add(0.05));
    return m;
  };
  // the beam: a green shaft whose front climbs with uBeam, brightest head on
  const beam = (U, { k = 1, core = 2.2, edge = 3 } = {}) => {
    const b = node(U, 'uBeam');
    const y = uv().y;
    const front = smoothstep(0, 0.7, b).mul(1.05);
    const rise = smoothstep(front, front.sub(0.05), y);
    const head = float(1).sub(smoothstep(0.62, 1, y));
    const on = smoothstep(0, 0.1, b);
    const a = pow(facing, edge).mul(rise).mul(head).mul(on).mul(k);
    const m = B({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    m.colorNode = color(0x57ff75).mul(core).mul(a);
    return m;
  };
  // the splash under the cloud as the beam reaches it
  const splash = (U) => {
    const b = node(U, 'uBeam');
    const d = uv().sub(0.5).length().mul(2);
    const m = B({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    m.colorNode = color(0x4dff73).mul(pow(float(1).sub(d.clamp(0, 1)), 2.4).mul(1.8).mul(smoothstep(0.55, 1, b)));
    return m;
  };
  K.shaders = { ...K.shaders, ghost, beam, splash };
  K.tex = { ...K.tex, ...tex };

  Object.assign(mats, {
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, color: 0xd6ccb8 }),
    web: M({ map: tex.web, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xb8bab6, emissive: new THREE.Color(0x0a0b0c) }),
    orc: M({ vertexColors: true }),
    orcSkin: M({ vertexColors: true }),
    orcGear: M({ vertexColors: true }),
    shelob: M({ vertexColors: true, emissive: new THREE.Color(0x0c0d10) }),
    shelobEye: M({ color: 0x050303, emissive: hot(0x8a9a58, 0.16) }),
    fang: M({ color: 0x2e1e12 }),
    silk: M({ vertexColors: true, emissive: new THREE.Color(0x121210) }),
    bone: M({ vertexColors: true }),
    statue: M({ vertexColors: true, emissive: new THREE.Color(0x9ad0aa), emissiveIntensity: 0.35 }),
    morgulWater: M({ color: 0x020504, emissive: new THREE.Color(0x010402) }),
    beastHide: M({ vertexColors: true }),
    beastHorn: M({ color: 0x4a423c }),
    beastEye: B({ color: hot(0xff7a2a, 1.6) }),
    membrane: M({ vertexColors: true, side: THREE.DoubleSide }),
    nazgulRobe: M({ color: 0x0e0e10, side: THREE.DoubleSide }),
    gauntlet: M({ color: 0x2a2a2e }),
    crownHelm: M({ color: 0x4a4a50, side: THREE.DoubleSide }),
    wraithEye: B({ color: hot(0xd8e6ff, 2.4) }),
    saddle: M({ color: 0x1e1612 }),
    mouth: M({ color: 0x1a0d0c }),
    void: mats.void ?? B({ color: 0x000000 }),
    blackStone: M({ map: tex.block, normalMap: tex.blockN, vertexColors: true }),
    flags: M({ map: tex.flags, normalMap: tex.flagsN, color: 0x5e5650 }),
    slit: B({ color: hot(0xff4410, 1.7) }),
  });

  return {
    tex,
    tick(t) {
      K.U.uTime.value = t;
    },
    dispose() {
      for (const m of made) m.dispose();
      for (const t of Object.values(tex)) t.dispose();
    },
  };
}
