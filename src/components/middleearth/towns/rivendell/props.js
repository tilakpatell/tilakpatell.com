// Rivendell, made in code: the kit the fourth walkable town is built from.
// The house of Elrond on its terraces, its open arcades of slender columns
// and pointed arches under upswept, leaf-like roofs; the room where Frodo
// wakes; Bilbo's pavilion; the hall of Narsil with its painting, its statue
// and the shards; the Council's court, its chairs and its plinth; the bridge
// over the gorge, the falls and the cliffs they fall from; beeches and
// birches in their autumn gold, and the leaves they drop; the south gate,
// lanterns, and the Ring.
//
// Built with the Shire's kit (../../shire/props.js) as Bree's is: its
// materials and helpers, and its own for pale carved stone, bronze-green
// roofs, gilding, glass, water and leaves. The same conventions: each
// builder's group stands on y = 0 at its origin, buildings face +z, figures
// and seats face +x, and fixed parts are merged one mesh per material.
//
// The builders and the canvases themselves are in ./build.js (and the
// ./parts.js, ./valley.js and ./canvases.js it re-exports), free of GLSL
// for the Road; this file keeps what has shaders, the falls, and makes the
// kit the builders are given.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/stage3d';
import { clamp01, mix, normalFromField } from '../../../../lib/paint';
import { stoneTextures } from '../../kit';
import { createShireKit, rng } from '../../shire/props';
import { sharpen } from '../../../../lib/three/textures';
import { archFillCanvas, beechGeo, bedroom, birchGeo, bookCanvas, bridge, carvingCanvas, cliffGeo, colonnade, court, courtCanvas, elfstoneCanvas, fallenLeavesGeo, gate, glassCanvas, house, inscriptionCanvas, lamp, linenCanvas, mapCanvas, muralCanvas, notesCanvas, pavilion, puffCanvas, ring, rockCanvas, roofCanvas, rugCanvas, shaftCanvas, shards, skyCanvas, terrace, traceryCanvas } from './build';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// ── falling water ──

const NOISE_GLSL = `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

// The falling sheet's shader: streaks of white water sliding down it,
// faster as they fall (their phase goes as the root of the fall), over a
// translucent blue-white body; ragged at its sides, foam where it pours
// over the lip and where it breaks at the foot. Finer streaks fade with
// distance so it doesn't shimmer far off.
function fallMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute float aLayer;
      uniform float uTime;
      varying vec2 vUv;
      varying float vLayer;
      varying float vDist;
      void main() {
        vUv = uv;
        vLayer = aLayer;
        vec3 p = position;
        p.x += sin(uv.y * 0.35 + uTime * 1.3 + aLayer * 2.0) * 0.06 * uv.y / 10.0;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        vDist = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform float uBright;
      uniform vec3 uLight;
      uniform vec3 uDeep;
      uniform float uFall;
      varying vec2 vUv;
      varying float vLayer;
      varying float vDist;
      ${NOISE_GLSL}
      void main() {
        float across = vUv.x;
        float fall = vUv.y / uFall;
        float ph = sqrt(max(vUv.y, 0.0)) * 2.4 - uTime * (1.5 + vLayer * 0.25) + vLayer * 7.0;
        float far = smoothstep(40.0, 160.0, vDist);
        float s1 = vnoise(vec2(across * 34.0 + vLayer * 5.0, ph * 2.2));
        float s2 = mix(vnoise(vec2(across * 90.0 + 13.0, ph * 5.0 + 3.0)), 0.5, far);
        float body = vnoise(vec2(across * 9.0 + vLayer * 3.0, ph * 0.8));
        float streak = smoothstep(0.42, 0.9, s1 * 0.62 + s2 * 0.48);
        // ragged sides
        float rag = vnoise(vec2(ph * 3.0, across * 4.0 + vLayer)) * 0.12;
        float side = smoothstep(0.0, 0.1 + rag, across) * smoothstep(1.0, 0.9 - rag, across);
        float lip = 1.0 - smoothstep(0.0, 0.06, fall);
        float foot = smoothstep(0.78, 1.0, fall);
        float white = clamp(streak * (0.75 + fall * 0.3) + body * 0.25 + lip * 0.6 + foot * 0.85, 0.0, 1.0);
        // the sheet thins into strands as it falls
        float strands = mix(1.0, 0.45 + 0.55 * smoothstep(0.25, 0.6, s1), smoothstep(0.15, 0.7, fall) * (1.0 - foot));
        float alpha = side * strands * (0.42 + 0.55 * white) * (1.0 - vLayer * 0.25);
        vec3 col = mix(uDeep, vec3(1.0), white) * uLight * uBright;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// Mist and spray at the foot of the falls: camera-facing puffs that rise,
// swell and thin away on their own clocks, from a few metres to many.
function mistMaterial(uniforms, map) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: map } },
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute vec2 corner;
      attribute vec4 seed;
      uniform float uTime;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float life = fract(uTime * seed.y + seed.x);
        vec3 p = position;
        p.y += life * seed.z * 1.6;
        p.xz += normalize(p.xz + vec2(0.001)) * life * seed.z * 0.6;
        float size = seed.z * (0.55 + life * 0.9);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float a = seed.w * 6.2831 + life * 1.5;
        mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
        mvPosition.xy += rot * corner * size;
        vUv = corner * 0.5 + 0.5;
        vA = smoothstep(0.0, 0.15, life) * (1.0 - life);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform sampler2D uMap;
      uniform vec3 uLight;
      uniform float uBright;
      uniform float uMist;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float a = texture2D(uMap, vUv).a * vA * uMist * 0.3;
        gl_FragColor = vec4(uLight * uBright * 0.95, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// A waterfall from a cliff's lip at y = h down to y = 0: it pours over the
// lip (at the origin's x and z, the cliff behind it to -z) and falls out to
// +z in a curve, widening, in two sheets one before the other; foam where
// it lands, and a cloud of mist and spray rising round its foot. update(t)
// runs it (t in seconds). `uniforms.uLight` is the light on it (warm in
// late sun), `uBright` how bright it is (raise it for bloom), `uMist` how
// thick the mist.
function waterfall(K, { h = 30, w = 4 } = {}) {
  const g = new THREE.Group();
  g.name = 'waterfall';
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uLight: { value: new THREE.Color(1.0, 0.92, 0.8) },
    uDeep: { value: new THREE.Color(0.36, 0.5, 0.58) },
    uBright: { value: 1 },
    uFall: { value: 1 },
    uMist: { value: 1 },
  };
  const v0 = 1.4 + Math.sqrt(h) * 0.12;
  const zAt = (d) => v0 * Math.sqrt((2 * d) / 9.8);
  // the centre line, from back on the lip, over, and down
  const line = [[-0.9, h + 0.14], [-0.45, h + 0.12], [-0.12, h + 0.06], [0, h]];
  const NY = 46;
  for (let j = 1; j <= NY; j++) {
    const d = h * Math.pow(j / NY, 1.35);
    line.push([zAt(d), h - d]);
  }
  let total = 0;
  const along = [0];
  for (let j = 1; j < line.length; j++) {
    total += Math.hypot(line[j][0] - line[j - 1][0], line[j][1] - line[j - 1][1]);
    along.push(total);
  }
  uniforms.uFall.value = total;
  const sheet = (layer, width, push) => {
    const NX = 12;
    const pos = [];
    const uv = [];
    const lay = [];
    const idx = [];
    line.forEach(([z, y], j) => {
      const fall = clamp01((h - y) / h);
      const half = (width / 2) * (1 + 0.5 * fall);
      for (let i = 0; i <= NX; i++) {
        const u = i / NX;
        const a = u * 2 - 1;
        const bulge = (1 - a * a) * (0.3 + fall * 0.5);
        pos.push(a * half + Math.sin(fall * 5 + layer * 2) * 0.15 * fall * width, y, z + bulge + push * (0.3 + fall));
        uv.push(u, along[j]);
        lay.push(layer);
        if (i && j) {
          const p = (j - 1) * (NX + 1) + i - 1;
          const q = p + NX + 1;
          idx.push(p, q, p + 1, p + 1, q, q + 1);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(lay, 1));
    geo.setIndex(idx);
    return geo;
  };
  const fallMat = fallMaterial(uniforms);
  const back = new THREE.Mesh(sheet(0, w, 0), fallMat);
  const front = new THREE.Mesh(sheet(1, w * 0.72, 0.35), fallMat);
  back.renderOrder = 1;
  front.renderOrder = 2;
  g.add(back, front);
  // foam where it lands: a churned ring on the water
  const zf = zAt(h);
  const foot = V3(0, 0, zf + 0.5);
  const foamMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 vP;
      void main() {
        vP = position.xy;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uLight;
      uniform float uBright;
      varying vec2 vP;
      ${NOISE_GLSL}
      void main() {
        float r = length(vP);
        float t = uTime;
        float n = vnoise(vP * 1.6 + vec2(t * 0.7, -t * 0.4)) * 0.6 + vnoise(vP * 4.0 - vec2(t * 1.1, t * 0.6)) * 0.4;
        float ring = smoothstep(${(w * 1.6).toFixed(2)}, ${(w * 0.3).toFixed(2)}, r);
        float a = ring * smoothstep(0.3, 0.75, n + ring * 0.35);
        gl_FragColor = vec4(uLight * uBright, a * 0.9);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const foam = new THREE.Mesh(new THREE.CircleGeometry(w * 1.6, 32), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.06, zf + 0.3);
  foam.renderOrder = 3;
  g.add(foam);
  // the mist: puffs round the foot, and a few up the face
  const r = rng(Math.round(h * 7 + w * 13));
  const N = 64;
  const pos = [];
  const corner = [];
  const seed = [];
  const idx = [];
  for (let k = 0; k < N; k++) {
    const up = k < N * 0.2;
    const a = r() * TAU;
    const rad = up ? r() * w * 0.4 : w * (0.3 + r() * 1.0);
    const x = Math.cos(a) * rad;
    const y = up ? r() * h * 0.6 : 0.4 + r() * 1.2;
    const z = (up ? zAt(h - y) + 0.6 : zf) + Math.sin(a) * rad * 0.8;
    const size = up ? w * (0.25 + r() * 0.3) : w * (0.5 + r() * 0.8);
    const own = [r(), 0.05 + r() * 0.08, size, r()];
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      pos.push(x, y, z);
      corner.push(cx, cy);
      seed.push(...own);
    }
    const b = k * 4;
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mg.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  mg.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 4));
  mg.setIndex(idx);
  mg.boundingSphere = new THREE.Sphere(V3(0, h * 0.3, zf), h + w * 4);
  const mist = new THREE.Mesh(mg, mistMaterial(uniforms, K.tex.puff));
  mist.renderOrder = 4;
  mist.frustumCulled = false;
  g.add(mist);
  return {
    group: g,
    uniforms,
    foot,
    update(t) {
      uniforms.uTime.value = t;
    },
  };
}

// ── the kit ──

export function createRivendellKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = elfstoneCanvas(S, 3, { rows: 2, across: 1 });
  const fine = elfstoneCanvas(S, 8, { rows: 1, across: 1, joint: 0 });
  const carving = carvingCanvas();
  const roof = roofCanvas(S);
  const rock = rockCanvas(S, 5);
  const linen = linenCanvas(128);
  // a sky for polished metal and glass to show
  const sky = new THREE.CanvasTexture(skyCanvas());
  sharpen(sky);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 2), { srgb: false }),
    fine: T(fine.c),
    fineN: T(normalFromField(fine.field, S, S, 1.5), { srgb: false }),
    carving: T(carving.c),
    carvingN: T(normalFromField(carving.field, carving.W, carving.H, 6), { srgb: false }),
    roof: T(roof.c),
    roofN: T(normalFromField(roof.field, S, S, 3), { srgb: false }),
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 1.8), { srgb: false }),
    linen: T(linen.c, { repeat: [2, 2] }),
    linenN: T(normalFromField(linen.field, 128, 128, 1.5), { srgb: false, repeat: [2, 2] }),
    tracery: T(traceryCanvas()),
    archFill: T(archFillCanvas(), { wrap: false }),
    glass: T(glassCanvas(), { wrap: false }),
    court: T(courtCanvas(), { wrap: false }),
    mural: T(muralCanvas(), { wrap: false }),
    map: T(mapCanvas(), { wrap: false }),
    book: T(bookCanvas(), { wrap: false }),
    rug: T(rugCanvas(), { wrap: false }),
    notes: T(notesCanvas(), { wrap: false }),
    inscription: T(inscriptionCanvas()),
    puff: T(puffCanvas(), { wrap: false }),
    shaft: T(shaftCanvas(), { wrap: false }),
    sky,
  };
  const pave = stoneTextures(renderer, { seed: 44, courses: 4, dark: [170, 156, 134], light: [246, 238, 220], joint: 0.3, relief: 2 });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const traced = { alphaTest: 0.5, side: THREE.DoubleSide };
  Object.assign(mats, {
    // pale warm stone: walls, carved work, a carved frieze, paving
    elfstone: M({ map: tex.stone, normalMap: tex.stoneN, color: 0xf0e4cc, roughness: 0.82 }),
    carve: M({ map: tex.fine, normalMap: tex.fineN, color: 0xfaf0dc, roughness: 0.72 }),
    frieze: M({ map: tex.carving, normalMap: tex.carvingN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0xf2e2c4, roughness: 0.78 }),
    pave: M({ map: pave.map, normalMap: pave.normalMap, color: 0xf2e6cc, roughness: 0.78 }),
    court: M({ map: tex.court, roughness: 0.66 }),
    // bronze-green leaf roofs, gilding, warm wood
    roof: M({ map: tex.roof, normalMap: tex.roofN, color: 0x6e927c, metalness: 0.45, roughness: 0.48, envMap: sky, envMapIntensity: 0.8 }),
    gilt: M({ color: 0xe6b85a, metalness: 0.9, roughness: 0.3, envMap: sky }),
    elfwood: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0x7e5434, roughness: 0.6 }),
    soffit: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0xa87a52, roughness: 0.75 }),
    // tracery cut through panels and the heads of arches
    tracery: M({ map: tex.tracery, color: 0xf2e4c8, roughness: 0.75, ...traced }),
    stoneFill: M({ map: tex.archFill, color: 0xf2e4c8, roughness: 0.75, ...traced }),
    giltTracery: M({ map: tex.archFill, color: 0xe6b85a, metalness: 0.85, roughness: 0.32, envMap: sky, ...traced }),
    // glass, dark by day, warm at night; the bedroom's full of sun
    pane: M({ map: tex.glass, color: 0x56656e, roughness: 0.1, metalness: 0.3, envMap: sky, emissive: hot(0xffb060, 2.4), emissiveMap: tex.glass, emissiveIntensity: 0 }),
    sunpane: new THREE.MeshBasicMaterial({ map: tex.glass, color: hot(0xfff0d0, 1.9) }),
    shaft: new THREE.MeshBasicMaterial({ map: tex.shaft, color: hot(0xffd49a, 1), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    glow: M({ color: 0xffe6b0, emissive: hot(0xffb04a, 2.8), emissiveIntensity: 0.25, roughness: 0.3 }),
    linen: M({ map: tex.linen, normalMap: tex.linenN, color: 0xfbf8f0, roughness: 0.92 }),
    curtain: M({ map: tex.linen, color: 0xfdf8ee, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }),
    coverlet: M({ map: tex.linen, normalMap: tex.linenN, color: 0xf0e2c0, roughness: 0.9, side: THREE.DoubleSide }),
    velvet: M({ map: tex.linen, color: 0x6e1c1a, roughness: 0.88, side: THREE.DoubleSide }),
    moss: M({ map: tex.linen, color: 0x3e5a3a, roughness: 0.9 }),
    glaze: M({ color: 0xe9e2d2, roughness: 0.28 }),
    leafGold: M({ color: 0xe0a030, roughness: 0.7, side: THREE.DoubleSide }),
    rug: M({ map: tex.rug, roughness: 0.95 }),
    // Bilbo's things
    map: M({ map: tex.map, roughness: 0.9, side: THREE.DoubleSide }),
    book: M({ map: tex.book, roughness: 0.85, side: THREE.DoubleSide }),
    notes: M({ map: tex.notes, roughness: 0.85 }),
    parchment: M({ color: 0xe8d8b0, roughness: 0.85 }),
    redLeather: M({ color: 0x7a1e16, roughness: 0.6 }),
    inkpot: M({ color: 0x1a1a24, roughness: 0.15, metalness: 0.2, envMap: sky }),
    quill: M({ color: 0xf4efe4, roughness: 0.8, side: THREE.DoubleSide }),
    wicker: M({ map: K.tex.thatch, color: 0xc89a5a, roughness: 0.9 }),
    wax: M({ color: 0xf6eedc, roughness: 0.5, emissive: C(0xffb060), emissiveIntensity: 0.15 }),
    flame: new THREE.MeshBasicMaterial({ color: hot(0xffb048, 3) }),
    // the hall of Narsil: the painting, the statue, the shards
    mural: M({ map: tex.mural, roughness: 0.92 }),
    marble: M({ map: tex.fine, normalMap: tex.fineN, color: 0xeae6de, roughness: 0.55 }),
    blade: M({ color: 0xdfe3e8, metalness: 0.9, roughness: 0.18, envMap: sky }),
    hiltSteel: M({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.28, envMap: sky }),
    leather: M({ map: K.tex.planks, color: 0x3a2214, roughness: 0.75 }),
    // the valley: rock, trees, leaves on the ground
    cliff: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.95 }),
    tree: M({ vertexColors: true, roughness: 0.88 }),
    leaves: M({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
  });
  // each material named for its key, to tell them apart in a profiler
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  K.tex = { ...K.tex, ...tex };
  const shireNight = kit.setNight;
  // dusk and night: windows and lanterns glow
  const setNight = (k) => {
    shireNight(k);
    const t = clamp01(k);
    mats.pane.emissiveIntensity = t;
    mats.glow.emissiveIntensity = mix(0.25, 1, t);
  };
  return {
    ...kit,
    mats,
    K,
    setNight,
    house: () => house(K),
    bedroom: () => bedroom(K),
    pavilion: () => pavilion(K),
    colonnade: (o) => colonnade(K, o),
    shards: () => shards(K),
    court: () => court(K),
    bridge: (len = 16) => bridge(K, len),
    waterfall: (o) => waterfall(K, o),
    cliff: (seed = 1) => cliffGeo(seed),
    beech: (seed = 1) => beechGeo(seed),
    goldBirch: (seed = 1) => birchGeo(seed),
    fallenLeaves: (seed = 1) => fallenLeavesGeo(seed),
    gate: () => gate(K),
    lamp: () => lamp(K),
    ring: (o) => ring(K, o),
    terrace: (w = 20, d = 8, h = 2.5) => terrace(K, w, d, h),
  };
}
