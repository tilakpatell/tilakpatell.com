// Moria, made in code: the kit the fifth walkable town is built from. The
// West-gate, the Doors of Durin drawn in ithildin on a sheer cliff with the
// holly trees either side, and the Watcher's arms coming up out of the pool;
// the Dwarrowdelf, a hall of great square pillars rising out of sight; the
// fork of three passages; the Chamber of Mazarbul, Balin's tomb in its shaft
// of grey daylight, the well, the dead and their broken arms, Ori's book;
// the stairs, broken, and the Bridge of Khazad-dûm over the abyss and its
// fire. And those who come: a cave troll, the goblins in their swarms, and
// Durin's Bane. Gandalf's staff-light, fallen stone and a fallen pillar to
// dress it all with.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are:
// its helpers, and its own materials for polished dark stone, carved
// dwarf-work, ithildin, wet hide, rock with fire in its cracks, smoke and
// flame. The same conventions: each builder's group stands on y = 0 at its
// origin, buildings and doorways face +z, creatures face +x, and fixed parts
// are merged one mesh per material. The shaders share one clock, the kit's
// tick(t); the creatures' own update calls move it too.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/three/canvasTexture';
import { greyFromField, normalFromField } from '../../../../lib/paint';
import { createShireKit } from '../../shire/props';
import { balrog, crackCanvas } from './balrog';
import { bridge } from './bridge';
import { ashlarCanvas, basaltCanvas, carvingCanvas, floorCanvas, glowCanvas, hollyCanvas, noiseCanvas, rockCanvas } from './canvases';
import { chamber, mailCanvas, pageCanvas, tombCanvas } from './chamber';
import { GATE, ithildinCanvas, tentacle, tentacleCanvas, westGate } from './gate';
import { fork, hall, rubbleGeo, staffLight, stairs } from './halls';
import { C, V3 } from './helpers';
import { caveTroll, goblin, wartCanvas } from './orcs';
import { abyssMaterial, beamMaterial, caveEnv, dustMaterial, fireSolidMaterial, flameMaterial, FOG_ADD, hide, nightEnv, revealable, smokeMaterial, sparkMaterial, sunlitMaterial, underglow, wingMaterial } from './shaders';

// ── the kit ──

export function createMoriaKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const basalt = basaltCanvas(S, 5);
  const rock = rockCanvas(S, 9);
  const ashlar = ashlarCanvas(S, 11);
  const floor = floorCanvas(512, 13);
  const carving = carvingCanvas();
  const tex = {
    basalt: T(basalt.c),
    basaltN: T(normalFromField(basalt.field, S, S, 1.4), { srgb: false }),
    basaltR: T(greyFromField(basalt.rough, S, S), { srgb: false }),
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    ashlar: T(ashlar.c),
    ashlarN: T(normalFromField(ashlar.field, S, S, 2.2), { srgb: false }),
    floor: T(floor.c),
    floorN: T(normalFromField(floor.field, 512, 512, 2), { srgb: false }),
    carve: T(carving.c),
    carveN: T(normalFromField(carving.field, carving.W, carving.H, 5), { srgb: false }),
    ithildin: T(ithildinCanvas(), { wrap: false }),
    holly: T(hollyCanvas(), { wrap: false }),
    glow: T(glowCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
  };
  // the dressed face of the gate: the rock's texture laid as on the cliff
  // round it (four metres a repeat, lined up), the drawing over the whole
  const rockFace = tex.rock.clone();
  const rockFaceN = tex.rockN.clone();
  for (const t of [rockFace, rockFaceN]) {
    t.repeat.set(GATE.w / 4, GATE.h / 4);
    t.offset.set(-GATE.w / 2 / 4, 0);
  }
  const night = nightEnv(renderer);
  const cave = caveEnv(renderer);

  // the shaders' shared numbers
  const U = {
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uRevealAt: { value: V3() },
    uRevealCam: { value: 1 },
    uRevealColor: { value: new THREE.Color(0.72, 0.84, 1.0) },
    uIthil: { value: 0 },
    uFire: { value: 1 },
    uFireColor: { value: new THREE.Color(1.0, 0.3, 0.07) },
    uNoise: { value: tex.noise },
    uRage: { value: 0 },
  };

  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const stone = { map: tex.basalt, normalMap: tex.basaltN, roughnessMap: tex.basaltR, roughness: 1 };
  Object.assign(mats, {
    // polished stone of the deeps, dark grey-green; dressed walls; carved
    // bands; paving
    basalt: M({ ...stone, color: 0x4c5652, vertexColors: true }),
    ashlar: M({ map: tex.ashlar, normalMap: tex.ashlarN, color: 0x56605c, roughness: 0.62, vertexColors: true }),
    carve: M({ map: tex.carve, normalMap: tex.carveN, normalScale: new THREE.Vector2(1.4, 1.4), color: 0x56605c, roughness: 0.5 }),
    paving: M({ map: tex.floor, normalMap: tex.floorN, color: 0x56605c, roughness: 0.5 }),
    // the gate: the cliff, its dressed face with the ithildin, the passage
    cliff: M({ map: tex.rock, normalMap: tex.rockN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.92 }),
    gateStone: M({ map: tex.rock, normalMap: tex.rockN, color: 0x9a9ea4, roughness: 0.88 }),
    ithildin: M({ map: rockFace, normalMap: rockFaceN, normalScale: new THREE.Vector2(0.45, 0.45), vertexColors: true, roughness: 0.8, emissive: new THREE.Color(0.62, 0.78, 1.0), emissiveMap: tex.ithildin, emissiveIntensity: 1.5 }),
    deep: M({ vertexColors: true, color: 0x8a8e96, roughness: 0.95 }),
    holly: M({ map: tex.holly, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.34, envMap: night, envMapIntensity: 0.6 }),
    hollyDark: M({ color: 0x0d1a0c, roughness: 0.9 }),
    hollyBark: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x8a8a80, roughness: 0.9 }),
  });
  // the Watcher: wet, dark, a ring of ripples on the pool round each arm
  const tskin = tentacleCanvas(256);
  tex.tentacleN = T(normalFromField(tskin, 256, 256, 3.5), { srgb: false, repeat: [1, 1.6] });
  Object.assign(mats, {
    tentacle: M({ vertexColors: true, normalMap: tex.tentacleN, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.2, metalness: 0.05, envMap: night, envMapIntensity: 1.1 }),
    ripple: new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uK: { value: 0 } }]),
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vP;
        #include <fog_pars_vertex>
        void main() {
          vP = position.xz;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform float uK;
        varying vec2 vP;
        #include <fog_pars_fragment>
        void main() {
          float d = length(vP);
          float rings = 0.0;
          for (int i = 0; i < 3; i++) {
            float f = fract(uTime * 0.35 + float(i) / 3.0);
            float rr = 0.6 + f * 2.3;
            rings += smoothstep(0.09, 0.0, abs(d - rr)) * (1.0 - f);
          }
          float foam = smoothstep(0.95, 0.5, d) * 0.12;
          float a = (rings * 0.22 + foam) * uK * smoothstep(3.0, 2.2, d);
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.85) * a, a);
          ${FOG_ADD}
        }`,
    }),
  });

  // the ithildin: lit by the moon (uIthil), coming out line by line in a
  // shimmer as the light finds it
  mats.ithildin.onBeforeCompile = (s) => {
    s.uniforms.uIthil = U.uIthil;
    s.uniforms.uTime = U.uTime;
    s.uniforms.uNoise = U.uNoise;
    s.fragmentShader = 'uniform float uIthil;\nuniform float uTime;\nuniform sampler2D uNoise;\n' + s.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float nI = texture2D(uNoise, vEmissiveMapUv * vec2(2.0, 2.8)).r;
        float on = smoothstep(nI - 0.2, nI + 0.05, uIthil * 1.35 - 0.15);
        float shim = 0.88 + 0.12 * sin(uTime * 1.7 + nI * 23.0) * sin(uTime * 0.6 + nI * 9.0);
        totalEmissiveRadiance *= on * shim * uIthil;
      }`,
    );
  };
  mats.ithildin.customProgramCacheKey = () => 'moria-ithildin';
  // the Chamber of Mazarbul: the tomb, the dead and their gear, the book
  const tomb = tombCanvas();
  const mail = mailCanvas();
  tex.tombTop = T(tomb.c, { wrap: false });
  tex.tombTopN = T(normalFromField(tomb.field, tomb.W, tomb.H, 3), { srgb: false, wrap: false });
  tex.mail = T(mail.c, { repeat: [4, 5] });
  tex.mailN = T(normalFromField(mail.field, 128, 128, 2.5), { srgb: false, repeat: [4, 5] });
  tex.page = T(pageCanvas(), { wrap: false });
  Object.assign(mats, {
    daylight: new THREE.MeshBasicMaterial({ color: hot(0xdfe6f0, 2.4), fog: false }),
    tomb: M({ ...stone, color: 0xd6d2c8, roughness: 0.8 }),
    tombTop: M({ map: tex.tombTop, normalMap: tex.tombTopN, roughness: 0.6 }),
    tombCarve: M({ map: tex.carve, normalMap: tex.carveN, color: 0xd6d2c8, roughness: 0.55 }),
    bone: M({ vertexColors: true, roughness: 0.78 }),
    beard: M({ color: 0x8a8680, roughness: 0.95 }),
    mail: M({ map: tex.mail, normalMap: tex.mailN, color: 0x8a8c90, metalness: 0.75, roughness: 0.5, envMap: cave, envMapIntensity: 0.8, side: THREE.DoubleSide }),
    rustIron: M({ color: 0x4e4038, metalness: 0.55, roughness: 0.62, envMap: cave, envMapIntensity: 0.6 }),
    oldSteel: M({ color: 0x9a9ea4, metalness: 0.85, roughness: 0.35, envMap: cave, envMapIntensity: 0.9 }),
    oldWood: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0x6a5440, roughness: 0.85 }),
    leatherOld: M({ color: 0x3a2a1e, roughness: 0.7 }),
    bookCover: M({ color: 0x4a2418, roughness: 0.6 }),
    paper: M({ color: 0xd8c8a0, roughness: 0.9 }),
    page: M({ map: tex.page, roughness: 0.85 }),
    arrow: M({ color: 0x1a1612, roughness: 0.7 }),
  });

  // the cave troll: warty hide, iron, his club
  const wart = wartCanvas(256);
  tex.wart = T(wart.c, { srgb: false });
  tex.wartN = T(normalFromField(wart.field, 256, 256, 6), { srgb: false });
  Object.assign(mats, {
    trollSkin: hide(M({ vertexColors: true, roughness: 0.58 }), { tex: tex.wart, nrm: tex.wartN, scale: 0.9, bump: 0.9, shade: 0.35, key: 'moria-troll' }),
    trollEye: M({ color: 0x8a7a30, roughness: 0.08, emissive: new THREE.Color(0.08, 0.06, 0.01) }),
    tooth: M({ color: 0xc8b88a, roughness: 0.45 }),
    nail: M({ color: 0x6a5a40, roughness: 0.5 }),
    mouth: M({ color: 0x3a1210, roughness: 0.4 }),
    forged: M({ color: 0x3e3a38, metalness: 0.75, roughness: 0.45, envMap: cave, envMapIntensity: 0.9 }),
    clubWood: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x6a5a48, roughness: 0.9 }),
    hideCloth: M({ map: tex.rock, color: 0x4a3626, roughness: 0.8, side: THREE.DoubleSide }),
  });

  // the goblins: their skin the troll's hide, finer; dark iron, leather
  // and rags; pale eyes that catch any light there is
  Object.assign(mats, {
    goblinSkin: hide(M({ vertexColors: true, roughness: 0.6 }), { tex: tex.wart, nrm: tex.wartN, scale: 3.2, bump: 0.7, shade: 0.4, key: 'moria-goblin' }),
    goblinGear: M({ vertexColors: true, roughness: 0.55, metalness: 0.45, envMap: cave, envMapIntensity: 0.8 }),
    goblinEye: M({ vertexColors: true, color: 0xe8e2c4, roughness: 0.1, emissive: C(0x3a382a), envMap: cave, envMapIntensity: 1.2 }),
  });

  // Durin's Bane: black rock-hide with fire flowing in its cracks, bright
  // enough in the wide ones for the bloom to catch (and brighter in its
  // rage), a dull red glow at its edges as if lit from within; horn; eyes
  // like coals; the fire of its sword and whip, its wings of shadow
  const crack = crackCanvas(256);
  tex.crack = T(crack.c, { srgb: false });
  tex.crackN = T(normalFromField(crack.field, 256, 256, 4), { srgb: false });
  Object.assign(mats, {
    balrogSkin: hide(M({ vertexColors: true, roughness: 0.74, metalness: 0.05, envMap: cave, envMapIntensity: 0.4 }), {
      tex: tex.crack,
      nrm: tex.crackN,
      scale: 0.3,
      bump: 1.3,
      shade: 0.45,
      key: 'moria-balrog',
      uniforms: { uTime: U.uTime, uRage: U.uRage, uNoise: U.uNoise },
      extra: `{
        float cr = smoothstep(0.4, 0.95, hs.r);
        float f1 = texture2D(uNoise, hp.xy * 0.45 + vec2(hp.z * 0.3, -uTime * 0.07)).r;
        float f2 = texture2D(uNoise, hp.zy * 0.6 + vec2(uTime * 0.03, -uTime * 0.11)).g;
        float pulse = 0.8 + 0.2 * sin(uTime * 2.3 + f1 * 12.0);
        float heat = cr * (0.12 + 2.4 * f1 * f2) * pulse * (0.55 + 0.75 * uRage);
        vec3 fire = mix(vec3(0.5, 0.06, 0.01), vec3(2.2, 0.7, 0.1), smoothstep(0.2, 0.8, heat));
        fire = mix(fire, vec3(3.6, 2.0, 0.7), smoothstep(0.95, 1.4, heat));
        totalEmissiveRadiance += fire * heat;
        diffuseColor.rgb *= 1.0 - cr * 0.85;
        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(0.45, 0.07, 0.01) * rim * (0.25 + 0.5 * uRage) * (0.6 + 0.8 * f1);
      }`,
    }),
    horn: M({ color: 0x15110f, roughness: 0.35, metalness: 0.2, envMap: cave, envMapIntensity: 1 }),
    balrogEye: new THREE.MeshBasicMaterial({ color: hot(0xff8a24, 5) }),
    wing: wingMaterial(U),
    fireSolid: fireSolidMaterial(U),
  });

  // the hall's stone, its carving and floor, and fallen stone: the staff's
  // light reaches over them (hall().lightFrom)
  Object.assign(mats, {
    hallStone: revealable(M({ ...stone, color: 0x404a4a, vertexColors: true }), U, 'moria-reveal'),
    hallCarve: revealable(M({ map: tex.carve, normalMap: tex.carveN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0x4a5454, roughness: 0.45 }), U, 'moria-reveal'),
    hallFloor: revealable(M({ map: tex.floor, normalMap: tex.floorN, color: 0x454e4e, roughness: 0.4 }), U, 'moria-reveal'),
    rubble: revealable(M({ ...stone, color: 0x5a6460, vertexColors: true }), U, 'moria-reveal'),
    // stone over the abyss, lit red from below
    abyss: underglow(M({ map: tex.ashlar, normalMap: tex.ashlarN, color: 0x5a6060, vertexColors: true, roughness: 0.7 }), U, 'moria-abyss'),
  });
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  // (the builders reach the shaders through the kit: their own files carry none)
  const shaders = { beam: beamMaterial, sunlit: sunlitMaterial, dust: dustMaterial, abyss: abyssMaterial, spark: sparkMaterial, flame: flameMaterial, smoke: smokeMaterial };
  Object.assign(K, { U, night, cave, shaders, tex: { ...K.tex, ...tex } });

  return {
    ...kit,
    mats,
    K,
    uniforms: U,
    tick: (t) => {
      U.uTime.value = t;
    },
    westGate: () => westGate(K),
    watcher: () => ({ tentacle: (seed = 1) => tentacle(K, seed) }),
    hall: (o) => hall(K, o),
    fork: () => fork(K),
    chamber: () => chamber(K),
    stairs: () => stairs(K),
    bridge: (len = 30) => bridge(K, len),
    caveTroll: () => caveTroll(K),
    goblin: (seed = 1) => goblin(K, seed),
    balrog: () => balrog(K),
    rubble: (seed = 1) => rubbleGeo(seed),
    staffLight: () => staffLight(K),
  };
}
