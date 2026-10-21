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
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, mix, normalFromField } from '../../../../lib/paint';
import { stoneTextures } from '../../nodes/kit';
import { createShireKit, rng } from '../../shire/props';
import { sharpen } from '../../../../lib/three/textures';
import { archFillCanvas, beechGeo, bedroom, birchGeo, bookCanvas, bridge, carvingCanvas, cliffGeo, colonnade, court, courtCanvas, elfstoneCanvas, fallenLeavesGeo, gate, glassCanvas, house, inscriptionCanvas, lamp, linenCanvas, mapCanvas, muralCanvas, notesCanvas, pavilion, puffCanvas, ring, rockCanvas, roofCanvas, rugCanvas, shaftCanvas, shards, skyCanvas, terrace, traceryCanvas } from './build';
import { fallMaterial, foamMaterial, mistMaterial, waterfallUniforms } from '../../nodes/towns/rivendell/propsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// ── falling water ──



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
  const uniforms = waterfallUniforms();
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
  const foamMat = foamMaterial(uniforms, w);
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
