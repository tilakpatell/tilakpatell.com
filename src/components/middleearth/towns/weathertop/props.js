// Weathertop and the Ford of Bruinen, made in code: the kit the third
// walkable town is built from. The broken ring of Amon Sûl on the summit and
// the crags round it, the hobbits' camp in the dell, the three stone trolls,
// Asfaloth with Arwen and Frodo, the horses of the flood, athelas and the
// weeds it hides among, dead trees on the heath, pines and birches for the
// road to the Ford, a pine fallen across it, and a burning brand.
//
// Built with the Shire's kit (../../shire/props.js) as Bree's is: its
// materials and helpers, and a few of its own for old stone, water and fire.
// The same conventions: each builder's group stands on y = 0 at its origin,
// creatures face +x, and fixed parts are merged one mesh per material.
//
// Its builders free of GLSL are in ./build.js (the ruin, the crags, the
// camp, the brand, the canvases) and ./trollshaws.js (the trolls, plants
// and trees, Asfaloth and gallop), so the Road can build with them; this
// file keeps what a node renderer can't run: the flood's shaders and the
// kit, whose materials take shader hooks.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, mix, normalFromField, smooth } from '../../../../lib/paint';
import { createShireKit, rng, tube } from '../../shire/props';
import { V3, camp, haloCanvas, rockGeo, ruin, torch, weatheredCanvas, woolCanvas } from './build';
import { asfaloth, athelas, birchGeo, deadTree, fallenTree, gallop, loft, pineGeo, trolls, weed } from './trollshaws';
import { churnMaterial, emberGlow, floodWaterMaterial, hairBothSides, sprayPoints } from '../../nodes/towns/weathertop/propsShaders';

// Edoras and Minas Tirith ride their horses with Asfaloth's gallop.
export { gallop };

// ── the flood ──





// One of the horses of the flood at the Ford of Bruinen: the river rising in
// the shape of a horse, its head and arched neck and striking forelegs
// surging out of a cresting wave, spray for its mane, white water churning
// at its foot. Faces +x, downstream; its local y = 0 is the river's surface.
// update(t, k): k is how far it has risen (0 hidden under the water, 1 up,
// about 4 m tall).
function floodHorse(K, seed = 1) {
  const g = new THREE.Group();
  g.name = 'floodHorse';
  const r = rng(seed * 19 + 7);
  const rise = new THREE.Group();
  rise.name = 'rise';
  g.add(rise);
  const water = floodWaterMaterial();
  const list = [];
  // the forequarters, rearing out of the wave
  list.push(loft([
    [-1.6, 0.7, 0.3, 0.3], [-1.1, 1.15, 0.42, 0.5], [-0.5, 1.65, 0.5, 0.6], [0.1, 2.0, 0.48, 0.6], [0.6, 2.25, 0.4, 0.52], [0.95, 2.35, 0.26, 0.36], [1.12, 2.36, 0.08, 0.12],
  ].map(([x, y, w, h]) => ({ p: [x, y], w, up: h, dn: h, wt: 0.6, wb: 0.6 })), { radial: 18, sq: 2.1 }));
  // the neck, arched, flung up and forward
  const NECK = [[-0.14, -0.12, 0.2, 0.3, 0.32], [0.04, 0.04, 0.19, 0.27, 0.28], [0.2, 0.24, 0.16, 0.2, 0.22], [0.34, 0.44, 0.13, 0.15, 0.16], [0.44, 0.62, 0.11, 0.12, 0.13], [0.52, 0.74, 0.1, 0.11, 0.12], [0.56, 0.8, 0.07, 0.08, 0.08]];
  const neckAt = V3(0.35, 2.35, 0);
  const NX = 2.1; // the neck: further forward than up, and thick
  const NY = 1.55;
  const NT = 2.15;
  const neckGeo = loft(NECK.map(([x, y, w, up, dn]) => ({ p: [x * NX, y * NY], w: w * NT, up: up * NT * 1.05, dn: dn * NT, wt: 0.55, wb: 0.85 })), { radial: 14, sq: 2.1 });
  neckGeo.translate(neckAt.x, neckAt.y, 0);
  list.push(neckGeo);
  // the head, thrust forward, ears flat back
  const HEAD = [[-0.07, 0.05, 0.06, 0.06], [0.0, 0.1, 0.1, 0.13], [0.08, 0.108, 0.075, 0.15], [0.19, 0.092, 0.07, 0.11], [0.31, 0.072, 0.064, 0.08], [0.43, 0.064, 0.058, 0.07], [0.52, 0.072, 0.06, 0.08], [0.58, 0.06, 0.05, 0.065], [0.615, 0.03, 0.025, 0.03]];
  const HS = 2.2;
  const headGeo = loft(HEAD.map(([x, w, up, dn]) => ({ p: [x * HS, 0], w: w * HS, up: up * HS, dn: dn * HS * 1.1, wt: 0.8, wb: 0.7 })), { radial: 14, sq: 2.2 });
  const poll = V3(0.53 * NX, 0.78 * NY, 0).add(neckAt);
  headGeo.rotateZ(-0.78).translate(poll.x, poll.y, 0);
  list.push(headGeo);
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.075, 0.32, 6);
    ear.rotateZ(1.75).rotateX(s * 0.35).translate(poll.x - 0.12, poll.y + 0.2, s * 0.14);
    list.push(ear);
  }
  // the forelegs: one folded high, one striking out
  const legs = [
    [[0.55, 2.0, 0.3], [1.0, 2.2, 0.34], [1.45, 2.05, 0.36], [1.55, 1.5, 0.36], [1.7, 1.25, 0.36]],
    [[0.55, 2.0, -0.3], [0.95, 1.65, -0.34], [1.3, 1.25, -0.36], [1.75, 1.05, -0.36], [2.05, 0.95, -0.36]],
  ];
  for (const pts of legs) list.push(tube(pts, 0.25, 0.11, { seg: 12, radial: 9 }));
  for (const pts of legs) {
    const h = pts[pts.length - 1];
    list.push(new THREE.SphereGeometry(0.15, 8, 6).translate(h[0], h[1], h[2]));
  }
  // the wave the horse bursts from: cresting and curling forward, highest
  // behind the horse, running out along the river either side
  const W = 2.7 + r() * 0.5;
  const prof = [[-4.0, -0.4], [-3.0, 0.15], [-2.0, 0.75], [-1.1, 1.35], [-0.4, 1.85], [0.15, 2.05], [0.6, 1.95], [0.95, 1.65], [1.05, 1.25], [0.8, 0.95], [0.75, 0.5], [0.9, -0.4]];
  const zs = 30;
  const wpos = [];
  const widx = [];
  for (let i = 0; i <= zs; i++) {
    const z = mix(-W, W, i / zs);
    const hz = Math.pow(Math.max(0, 1 - (z / W) ** 2), 0.6) * (1 + 0.12 * Math.sin(z * 1.7 + seed));
    for (const [x, y] of prof) wpos.push(x * (0.75 + 0.25 * hz) - (1 - hz) * 0.6, y > 0 ? y * hz : y, z);
  }
  const m = prof.length;
  for (let i = 0; i < zs; i++) for (let k = 0; k < m - 1; k++) {
    const a = i * m + k;
    widx.push(a, a + m, a + 1, a + 1, a + m, a + m + 1);
  }
  const wave = new THREE.BufferGeometry();
  wave.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wave.setIndex(widx);
  wave.computeVertexNormals();
  list.push(wave);
  const form = new THREE.Mesh(mergeGeometries(list.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k);
    if (!y.attributes.normal) y.computeVertexNormals();
    y.setAttribute('aWave', new THREE.BufferAttribute(new Float32Array(y.attributes.position.count).fill(x === wave ? 1 : 0), 1));
    return y;
  }), false), water);
  form.renderOrder = 2;
  form.frustumCulled = false;
  rise.add(form);

  // white water on the river round its foot
  const churn = churnMaterial();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(9, 8, 1, 1).rotateX(-Math.PI / 2).translate(0.2, 0.04, 0), churn);
  disc.renderOrder = 1;
  g.add(disc);

  // spray
  const N = 900;
  const seeds = new Float32Array(N * 4);
  const from = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const crest = (z) => {
    const hz = Math.pow(Math.max(0, 1 - (z / W) ** 2), 0.6);
    return [0.3 * hz, 2.0 * hz];
  };
  for (let i = 0; i < N; i++) {
    seeds.set([r(), r(), r(), r()], i * 4);
    const kind = i % 3;
    let f;
    let v;
    if (kind === 0) {
      // off the crest of the wave, flung forward and up
      const z = mix(-W, W, r());
      const [x, y] = crest(z);
      f = [x + 0.2, y, z];
      v = [1.2 + r() * 1.5, 1.4 + r() * 1.6, (r() - 0.5) * 1.2];
    } else if (kind === 1) {
      // the mane: streaming back off the crest of the neck
      const t = r();
      const nx = mix(-0.15, 0.5, t) * NX + neckAt.x;
      const ny = mix(0.2, 0.85, t) * NY + neckAt.y + 0.25;
      f = [nx - 0.1, ny + 0.15, (r() - 0.5) * 0.25];
      v = [-2.6 - r() * 1.6, 1.4 + r() * 1.4, (r() - 0.5) * 1.4];
    } else {
      // bursting off the chest and the striking hooves
      const leg = legs[i % 2];
      const h = r() < 0.5 ? leg[leg.length - 1] : [0.95 + r() * 0.3, 1.6 + r() * 0.8, (r() - 0.5) * 0.8];
      f = [h[0], h[1], h[2]];
      v = [0.6 + r() * 1.4, 0.6 + r() * 1.8, (r() - 0.5) * 2.0];
    }
    from.set(f, i * 3);
    vel.set(v, i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  pg.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  pg.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  const spray = sprayPoints(pg);
  spray.frustumCulled = false;
  spray.renderOrder = 3;
  rise.add(spray);

  const _v2 = new THREE.Vector2();
  const update = (t, k = 1) => {
    const e = clamp01(k);
    const up = 1 - Math.pow(1 - e, 3);
    g.visible = e > 0.001;
    rise.position.y = mix(-4.6, 0, up);
    rise.position.x = mix(-1.2, 0, up);
    rise.rotation.z = mix(0.35, 0, up) + Math.sin(t * 1.3 + seed) * 0.03;
    g.updateWorldMatrix(true, false);
    const wy = g.matrixWorld.elements[13];
    water.uniforms.uTime.value = t + seed * 3.1;
    water.uniforms.uWater.value = wy;
    churn.uniforms.uTime.value = t + seed;
    churn.uniforms.uRise.value = smooth(0, 0.35, e);
    const sp = spray.material.uniforms;
    sp.uTime.value = t + seed * 1.7;
    sp.uRise.value = smooth(0.15, 0.7, e);
    sp.uWater.value = wy;
    const renderer = K.renderer;
    if (renderer) {
      renderer.getDrawingBufferSize(_v2);
      sp.uScale.value = _v2.y * 0.9;
    }
  };
  update(0, 0);
  return { group: g, update };
}

// ── the kit ──

export function createWeathertopKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = weatheredCanvas(S, 7);
  const wool = woolCanvas(S, 13);
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 3), { srgb: false }),
    wool: T(wool.c, { repeat: [3, 3] }),
    woolN: T(normalFromField(wool.field, S, S, 2.4), { srgb: false, repeat: [3, 3] }),
    halo: T(haloCanvas(), { wrap: false }),
  };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  Object.assign(mats, {
    ruin: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.94 }),
    rock: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.96 }),
    troll: M({ map: tex.stone, normalMap: tex.stoneN, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.95 }),
    earth: M({ vertexColors: true, roughness: 1 }),
    scorch: M({ vertexColors: true, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    grass: M({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    // the fire's embers: pulse them by emissiveIntensity
    ember: M({ color: 0x140804, emissive: new THREE.Color(0xff5a1c), emissiveIntensity: 1.6, vertexColors: true, roughness: 0.9 }),
    char: M({ vertexColors: true, roughness: 0.95 }),
    blanket: M({ map: tex.wool, normalMap: tex.woolN, vertexColors: true, roughness: 0.97, side: THREE.DoubleSide }),
    copper: M({ color: 0xa8643a, metalness: 0.75, roughness: 0.42 }),
    leaf: M({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(0) }),
    petal: M({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, emissive: new THREE.Color(0) }),
    deadwood: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x8e8a84, roughness: 0.95 }),
    pinebark: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x6a5446, roughness: 0.95 }),
    tree: M({ vertexColors: true, roughness: 0.9 }),
    pitch: M({ color: 0x0b0907, roughness: 0.38, metalness: 0.1 }),
    brand: M({ color: 0x100604, emissive: new THREE.Color(0xff7a2a), emissiveIntensity: 2.2, roughness: 0.9 }),
    // Asfaloth, and Arwen
    coat: M({ vertexColors: true, roughness: 0.52 }),
    silverHair: M({ vertexColors: true, roughness: 0.42, metalness: 0.2, side: THREE.DoubleSide }),
    silver: M({ color: 0xdde2ea, metalness: 0.9, roughness: 0.26 }),
    eye: M({ color: 0x0c0a0a, roughness: 0.12 }),
    skin: M({ color: 0xf0ddd2, roughness: 0.6 }),
    hair: M({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }),
    riding: M({ map: tex.wool, normalMap: tex.woolN, color: 0x4a5670, roughness: 0.93, side: THREE.DoubleSide }),
    dress: M({ color: 0x2e3546, roughness: 0.82 }),
    leather: M({ color: 0x2a1f18, roughness: 0.6 }),
    gold: M({ color: 0xd8a840, metalness: 0.9, roughness: 0.25, emissive: hot(0xffc040, 0.6) }),
  });
  // an ember's vertex colour dims its glow too, so the coals aren't all alike
  mats.ember = emberGlow(mats.ember);
  // hair in ribbons is lit by the normals it was given, from either side
  for (const k of ['silverHair', 'hair']) mats[k] = hairBothSides(mats[k]);
  K.tex = { ...K.tex, ...tex };
  const rocks = [rockGeo(3), rockGeo(8), rockGeo(21)];
  return {
    ...kit,
    mats,
    ruin: (RUIN) => ruin(K, RUIN),
    rocks,
    camp: () => camp(K),
    trolls: () => trolls(K),
    athelas: () => athelas(K),
    weed: (seed) => weed(K, seed),
    deadTree: (seed) => deadTree(K, seed),
    pine: (seed) => pineGeo(seed),
    birch: (seed) => birchGeo(seed),
    fallenTree: (seed) => fallenTree(K, seed),
    torch: () => torch(K),
    asfaloth: () => asfaloth(K),
    floodHorse: (seed) => floodHorse(K, seed),
    gallop,
  };
}

