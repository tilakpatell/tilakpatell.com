// Moria’s kit, made for the Road: the materials the Moria chapter’s builders
// read (towns/moria/{gate,halls,chamber,bridge,orcs,balrog}.js), under the
// same names and from the same painted canvases as the chapter’s kit
// (towns/moria/props.js’s createMoriaKit), added to a town kit
// (townKit.js’s) on the Road’s house look. The chapter’s shaders are its
// own (GLSL, for its classic renderer); here each is a node material that
// keeps what it is for: the tomb’s beam a pale additive sheet, the dust and
// the sparks soft points, the fire and smoke the same cards rising from
// their emitters, the ithildin an emissive drawing whose glow the scene
// raises, the wings a dark membrane.
//
//   addMoria(town, road, renderer, { gate, deep }) → { U, tick(t), setIthildin(k), dispose() }
//     town: createTownKit’s, made `wild` (its rope, its void); K gains Moria’s mats, U, shaders
//     gate: the West-gate, its holly and the Watcher’s arms (Caradhras)
//     deep: the halls, the chamber, the bridge, the troll, the goblins, the Balrog (Moria)

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { attribute, float, fract, length, positionGeometry, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import { canvasTexture, hot } from '../../../lib/three/canvasTexture';
import { greyFromField, normalFromField } from '../../../lib/paint';
import { ashlarCanvas, basaltCanvas, carvingCanvas, floorCanvas, glowCanvas, hollyCanvas, rockCanvas } from '../towns/moria/canvases';
import { GATE, ithildinCanvas, tentacleCanvas } from '../towns/moria/gate';
import { mailCanvas, pageCanvas, tombCanvas } from '../towns/moria/chamber';
import { wartCanvas } from '../towns/moria/orcs';
import { crackCanvas } from '../towns/moria/balrog';

const S = 256;

// what a builder sets on its shader’s uniforms, taken and kept (a node material has none to read them)
const uniforms = () => new Proxy({}, { get: (o, k) => (typeof k === 'string' ? (o[k] ??= { value: new THREE.Vector3() }) : undefined) });
const withUniforms = (m) => {
  m.uniforms = uniforms();
  m.userData.fit = () => {};
  return m;
};

export function addMoria(town, road, renderer, { gate = false, deep = false } = {}) {
  const { K, mats } = town;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const made = [];
  const textures = [];
  const keep = (t) => {
    textures.push(t);
    return t;
  };
  const M = (o) => {
    const { emissiveMap, ...rest } = o;
    const m = road.material(rest);
    if (emissiveMap) m.emissiveMap = emissiveMap;
    made.push(m);
    return m;
  };
  const B = (o) => {
    const m = new MeshBasicNodeMaterial(o);
    made.push(m);
    return m;
  };
  const tNode = uniform(0);
  const U = new Proxy({ uTime: { value: 0 }, uIthil: { value: 0 }, uRage: { value: 0 }, uFire: { value: 1 } }, { get: (o, k) => (typeof k === 'string' ? (o[k] ??= { value: new THREE.Vector3() }) : undefined) });

  const rock = rockCanvas(S, 9);
  const tex = {
    rock: keep(T(rock.c)),
    rockN: keep(T(normalFromField(rock.field, S, S, 3), { srgb: false })),
    glow: keep(T(glowCanvas(), { wrap: false })),
  };
  // the fire and the smoke: the cards a cloud is drawn with, each risen from
  // its emitter (aEmit) over its life and gone, a soft round sprite
  const cards = (U0, { size = 1, rise = 2, heat = 1, rate = 1, smoke = false }) => {
    const seed = attribute('aSeed', 'vec4');
    const life = fract(tNode.mul(rate * (smoke ? 0.25 : 0.8)).add(seed.x));
    const m = withUniforms(
      B({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, fog: true }),
    );
    m.uniforms.uHeat = { value: heat };
    const grow = smoke ? life.mul(1.4).add(0.6) : life.oneMinus().mul(0.7).add(0.3);
    m.positionNode = attribute('aEmit', 'vec3').add(positionGeometry.mul(float(size).mul(grow))).add(vec3(seed.y.sub(0.5).mul(size), life.mul(rise), seed.z.sub(0.5).mul(size)));
    const round = smoothstep(1, 0.2, length(uv().sub(0.5)).mul(2));
    m.colorNode = smoke ? vec3(0.06, 0.05, 0.05) : vec3(2.2, 0.75, 0.16).mul(heat);
    m.opacityNode = round.mul(smoke ? life.oneMinus().mul(0.5) : life.oneMinus().mul(0.85));
    return m;
  };
  const shaders = {
    // the shaft of grey daylight down onto the tomb
    beam: () => withUniforms(B({ color: hot(0xdfe6f0, 0.7), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })),
    // the pool of light it throws
    sunlit: () => withUniforms(B({ color: hot(0xd0d8e4, 0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })),
    // dust in the beam, sparks up out of the abyss
    dust: () => withUniforms(Object.assign(new PointsNodeMaterial({ color: 0xc8d0dc, size: 0.04, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }), {})),
    spark: () => withUniforms(Object.assign(new PointsNodeMaterial({ color: hot(0xff8a30, 2), size: 0.08, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), {})),
    // the abyss’s red glow from below, on its floor and the cards up its walls
    abyss: (U0, card) => withUniforms(B({ map: tex.glow, color: hot(0xff4a12, card ? 0.5 : 0.9), transparent: true, opacity: card ? 0.35 : 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    flame: (U0, o = {}) => cards(U0, o),
    smoke: (U0, o = {}) => cards(U0, { ...o, smoke: true }),
  };
  for (const k of Object.keys(shaders)) {
    const make = shaders[k];
    shaders[k] = (...a) => {
      const m = make(...a);
      if (!made.includes(m)) made.push(m);
      return m;
    };
  }

  if (gate) {
    const ith = keep(T(ithildinCanvas(), { wrap: false }));
    const rockFace = keep(tex.rock.clone());
    const rockFaceN = keep(tex.rockN.clone());
    for (const t of [rockFace, rockFaceN]) {
      t.repeat.set(GATE.w / 4, GATE.h / 4);
      t.offset.set(-GATE.w / 2 / 4, 0);
      t.needsUpdate = true;
    }
    const holly = keep(T(hollyCanvas(), { wrap: false }));
    const tskin = tentacleCanvas(256);
    const tentN = keep(T(normalFromField(tskin, 256, 256, 3.5), { srgb: false, repeat: [1, 1.6] }));
    Object.assign(mats, {
      cliff: M({ map: tex.rock, normalMap: tex.rockN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true }),
      gateStone: M({ map: tex.rock, normalMap: tex.rockN, color: 0x9a9ea4 }),
      // the drawing’s glow is the scene’s: setIthildin
      ithildin: M({ map: rockFace, normalMap: rockFaceN, normalScale: new THREE.Vector2(0.45, 0.45), vertexColors: true, emissive: new THREE.Color(0.62, 0.78, 1.0), emissiveMap: ith, emissiveIntensity: 0 }),
      deep: M({ vertexColors: true, color: 0x8a8e96 }),
      holly: M({ map: holly, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true }),
      hollyDark: M({ color: 0x0d1a0c }),
      hollyBark: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x8a8a80 }),
      tentacle: M({ vertexColors: true, normalMap: tentN, normalScale: new THREE.Vector2(1.2, 1.2) }),
    });
    // rings spreading on the lake round each arm: a pale additive ring, made for each arm
    const ripple = () => {
      const m = withUniforms(B({ map: tex.glow, color: new THREE.Color(0.62, 0.72, 0.85), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.clone = ripple;
      return m;
    };
    mats.ripple = ripple();
  }

  if (deep) {
    const basalt = basaltCanvas(S, 5);
    const ashlar = ashlarCanvas(S, 11);
    const floor = floorCanvas(512, 13);
    const carving = carvingCanvas();
    Object.assign(tex, {
      basalt: keep(T(basalt.c)),
      basaltN: keep(T(normalFromField(basalt.field, S, S, 1.4), { srgb: false })),
      basaltR: keep(T(greyFromField(basalt.rough, S, S), { srgb: false })),
      ashlar: keep(T(ashlar.c)),
      ashlarN: keep(T(normalFromField(ashlar.field, S, S, 2.2), { srgb: false })),
      floor: keep(T(floor.c)),
      floorN: keep(T(normalFromField(floor.field, 512, 512, 2), { srgb: false })),
      carve: keep(T(carving.c)),
      carveN: keep(T(normalFromField(carving.field, carving.W, carving.H, 5), { srgb: false })),
    });
    const stone = { map: tex.basalt, normalMap: tex.basaltN };
    const tomb = tombCanvas();
    const mail = mailCanvas();
    const wart = wartCanvas(256);
    const crack = crackCanvas(256);
    Object.assign(tex, {
      tombTop: keep(T(tomb.c, { wrap: false })),
      tombTopN: keep(T(normalFromField(tomb.field, tomb.W, tomb.H, 3), { srgb: false, wrap: false })),
      mail: keep(T(mail.c, { repeat: [4, 5] })),
      page: keep(T(pageCanvas(), { wrap: false })),
      wart: keep(T(wart.c, { srgb: false })),
      wartN: keep(T(normalFromField(wart.field, 256, 256, 6), { srgb: false })),
      crack: keep(T(crack.c, { srgb: false })),
      crackN: keep(T(normalFromField(crack.field, 256, 256, 4), { srgb: false })),
    });
    Object.assign(mats, {
      basalt: M({ ...stone, color: 0x4c5652, vertexColors: true }),
      ashlar: M({ map: tex.ashlar, normalMap: tex.ashlarN, color: 0x56605c, vertexColors: true }),
      carve: M({ map: tex.carve, normalMap: tex.carveN, normalScale: new THREE.Vector2(1.4, 1.4), color: 0x56605c }),
      paving: M({ map: tex.floor, normalMap: tex.floorN, color: 0x56605c }),
      deep: mats.deep ?? M({ vertexColors: true, color: 0x8a8e96 }),
      // (the chapter reveals the hall by the staff’s light in its shader; here the staff is a light)
      hallStone: M({ ...stone, color: 0x404a4a, vertexColors: true }),
      hallCarve: M({ map: tex.carve, normalMap: tex.carveN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0x4a5454 }),
      hallFloor: M({ map: tex.floor, normalMap: tex.floorN, color: 0x454e4e }),
      rubble: M({ ...stone, color: 0x5a6460, vertexColors: true }),
      abyss: M({ map: tex.ashlar, normalMap: tex.ashlarN, color: 0x5a6060, vertexColors: true, emissive: new THREE.Color(0x3a0c04), emissiveIntensity: 1 }),
      daylight: B({ color: hot(0xdfe6f0, 2.4), fog: false }),
      tomb: M({ ...stone, color: 0xd6d2c8 }),
      tombTop: M({ map: tex.tombTop, normalMap: tex.tombTopN }),
      tombCarve: M({ map: tex.carve, normalMap: tex.carveN, color: 0xd6d2c8 }),
      bone: M({ vertexColors: true }),
      beard: M({ color: 0x8a8680 }),
      mail: M({ map: tex.mail, color: 0x8a8c90, side: THREE.DoubleSide }),
      rustIron: M({ color: 0x4e4038 }),
      oldSteel: M({ color: 0x9a9ea4 }),
      oldWood: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0x6a5440 }),
      leatherOld: M({ color: 0x3a2a1e }),
      bookCover: M({ color: 0x4a2418 }),
      paper: M({ color: 0xd8c8a0 }),
      page: M({ map: tex.page }),
      arrow: M({ color: 0x1a1612 }),
      trollSkin: M({ vertexColors: true, normalMap: tex.wartN }),
      trollEye: M({ color: 0x8a7a30, emissive: new THREE.Color(0.08, 0.06, 0.01) }),
      tooth: M({ color: 0xc8b88a }),
      nail: M({ color: 0x6a5a40 }),
      mouth: M({ color: 0x3a1210 }),
      forged: M({ color: 0x3e3a38 }),
      clubWood: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x6a5a48 }),
      hideCloth: M({ map: tex.rock, color: 0x4a3626, side: THREE.DoubleSide }),
      goblinSkin: M({ vertexColors: true, normalMap: tex.wartN }),
      goblinGear: M({ vertexColors: true }),
      goblinEye: M({ vertexColors: true, color: 0xe8e2c4, emissive: new THREE.Color(0x3a382a) }),
      // Durin’s Bane: black rock-hide, fire in its cracks (the crack map as its glow), horn, coal eyes
      balrogSkin: M({ vertexColors: true, color: 0x2a2220, normalMap: tex.crackN, emissive: hot(0xff5a14, 1.6), emissiveMap: tex.crack, emissiveIntensity: 1 }),
      horn: M({ color: 0x15110f }),
      balrogEye: B({ color: hot(0xff8a24, 5) }),
      wing: B({ color: 0x0a0807, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }),
      fireSolid: B({ color: hot(0xff7a20, 2.6) }),
    });
  }
  Object.assign(K, { U, shaders });

  return {
    U,
    tick(t) {
      U.uTime.value = t;
      tNode.value = t;
    },
    // the ithildin brought out by the moon, 0…1 (over 1 at full, for the bloom)
    setIthildin(k) {
      U.uIthil.value = Math.min(1, Math.max(0, k));
      if (mats.ithildin) mats.ithildin.emissiveIntensity = 1.8 * U.uIthil.value;
    },
    dispose() {
      for (const m of made) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
