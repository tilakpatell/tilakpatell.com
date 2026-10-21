// The town round the Smiths' street, drawn from ./plan.js in the street's
// own paint: the side roads level with the lawns (no kerb: the main road
// keeps its), their sidewalks and centre lines; the park's pond (its water a
// painted ripple that drifts), the gravel paths, the bandstand, the
// statue on its plinth (the Reverse Giraffe, cast in bronze from its model),
// flowerbeds and rocks; the row of shops with their names and awnings, the
// cinema with its marquee and its blade sign, the parking lot and its cars,
// the water tower; the missing-cat posters on their posts; and the street
// lights, stop signs, flowers and rocks from Quaternius's CC0 kits
// (public/models/quaternius), each drawn as instances. The houses, their
// drives and the trees are ./street.js's to draw with the street's own.
//
// buildTown(kit, { group, b, flat, m, mats }) → { noInk, update(t), load(), dispose() }
//   b, flat: the street's batches (what's merged, what's ground); m: its
//   building materials; load(): fetches the models, after the street's up

import * as THREE from 'three';
import { at, coloured, rng, speckle } from '../kit';
import { canvasTexture } from '../../stage';
import { fitText } from '../interiors/shell';
import { gltfLoader } from '../../../../lib/three/gltf';
import { instanced, partsOf, stoodOn } from '../models';
import { BANDSTAND, CROSS, FLOWERBEDS, LIGHTS, LOT, LOT_CARS, PATHS, PATH_RING, POND, POSTERS, ROCKS, ROADS, SHOPS, SIDE, SIGNS, STATUE, WATER_TOWER } from './plan';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const UP = 0.012; // a side road's top, a hair over the lawn
const WALK_TOP = 0.03; // and its sidewalk's

// the Quaternius kits' models the town stands about, by the node each is in its family's file
const KIT = {
  light: { url: '/models/quaternius/props/street.glb', node: 'Streetlight_Single', tall: 5.6 },
  stop: { url: '/models/quaternius/props/street.glb', node: 'Sign_Stop', tall: 2.4 },
  flowerA: { url: '/models/quaternius/nature/flowers.glb', node: 'Flower_3_Single', tall: 0.6 },
  flowerB: { url: '/models/quaternius/nature/flowers.glb', node: 'Flower_1_Single', tall: 0.5 },
  bush: { url: '/models/quaternius/nature/trees.glb', node: 'Bush_Common_Flowers', tall: 1.2 },
  reed: { url: '/models/quaternius/nature/trees.glb', node: 'Bush_Long_1', tall: 1.3 },
  rock: { url: '/models/quaternius/nature/rocks.glb', node: 'Rock_Medium_1', tall: 0.7 },
};

export function buildTown(kit, { group, b, flat, m, mats }) {
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const noInk = [];
  // Every plain colour the town's built of in one vertex-coloured material,
  // and every picture on it (the shops' names and awnings, the marquee, the
  // posters, the plaque, the roofs' stripes) in one atlas: a handful of
  // draws for all of it, merged into the street's batches.
  const vc = mats.toon(0xffffff, { vertexColors: true });
  const tints = new Map();
  const tinted = (geo, hex) => {
    const key = `${geo.uuid}|${hex}`;
    if (!tints.has(key)) tints.set(key, own(coloured(geo, hex)));
    return tints.get(key);
  };
  const put = (geo, hex, mx) => b.add(tinted(geo, hex), vc, mx);
  const lay = (geo, hex, mx) => flat.add(tinted(geo, hex), vc, mx);
  const atlas = makeAtlas(2048, 1024);
  const picture = mats.toon(0xffffff, { map: own(canvasTexture(atlas.canvas, kit.renderer ?? null, { wrap: false })) });
  const show = (geo, name, mx) => b.add(own(atlas.mapped(geo, name)), picture, mx);

  // ── the side roads and their sidewalks ──
  const asphalt = mats.painted('asphalt-side', 256, 256, (g, w, h) => speckle(g, w, h, { base: '#74777c', specks: ['#707378', '#787b80', '#6d7075', '#7c7f84'], n: 1400, size: 1.5, seed: 34 }), { tile: 6 });
  const slab = mats.painted(
    'slab-side',
    128,
    128,
    (g, w, h) => {
      speckle(g, w, h, { base: '#dcd8cf', specks: ['#d4d0c7', '#e2dfd8', '#d0cbc1'], n: 500, size: 1.5, seed: 6 });
      g.fillStyle = '#a9a398';
      g.fillRect(0, 0, w, 3);
      g.fillRect(0, 0, 3, h);
    },
    { tile: 2 },
  );
  for (const r of ROADS) {
    const top = r.kind === 'road' ? UP : WALK_TOP;
    flat.add(BOX, r.kind === 'road' ? asphalt : slab, at((r.x0 + r.x1) / 2, top / 2 - 0.01, (r.z0 + r.z1) / 2, 0, r.x1 - r.x0, top + 0.02, r.z1 - r.z0));
    if (r.kind !== 'road') continue;
    // its centre line, 3 m dashes every 9 m, along its length
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    const [a0, a1] = alongX ? [r.x0, r.x1] : [r.z0, r.z1];
    const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    for (let u = a0 + 4; u < a1 - 3; u += 9) lay(BOX, 0xe8c33a, alongX ? at(u + 1.5, UP + 0.004, mid, 0, 3, 0.01, 0.16) : at(mid, UP + 0.004, u + 1.5, 0, 0.16, 0.01, 3));
  }
  // a stop line across the cross road at each of its stop signs
  for (const s of SIGNS) {
    const c = CROSS.find((x) => Math.abs(s.x - x) < SIDE.w);
    lay(BOX, 0xf2efe6, at(c, UP + 0.004, s.z, 0, SIDE.w - 0.4, 0.01, 0.4));
  }

  // ── the park ──
  const gravel = mats.painted('gravel', 128, 128, (g, w, h) => speckle(g, w, h, { base: '#d9c9a4', specks: ['#cbb991', '#e6d8b8', '#bfae88', '#a8987a'], n: 1400, size: 2, seed: 41 }), { tile: 2.5 });
  const soil = mats.painted('soil', 128, 128, (g, w, h) => speckle(g, w, h, { base: '#6a4a32', specks: ['#5a3e2a', '#7a5a3e', '#4e3524'], n: 900, size: 2, seed: 43 }), { tile: 2 });
  // the ring round the pond, as a strip of quads round the ellipse
  flat.add(ellipseStrip(PATH_RING.x, PATH_RING.z, PATH_RING.rx, PATH_RING.rz, PATH_RING.w, 96), gravel, at(0, 0.018, 0));
  for (const [x0, z0, x1, z1] of PATHS) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    flat.add(BOX, gravel, at((x0 + x1) / 2, 0.008, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), 2, 0.02, len));
  }
  for (const f of FLOWERBEDS) flat.add(new THREE.CylinderGeometry(f.r, f.r + 0.15, 0.08, 24), soil, at(f.x, 0.02, f.z));
  // the pond: a stone rim, a shallow beach and the water, which drifts
  lay(own(ellipseDisc(POND.x, POND.z, POND.rx + 1.3, POND.rz + 1.3, 64)), 0xb8ad96, at(0, 0.014, 0));
  const ripple = new THREE.CanvasTexture(
    (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#3f9ad0';
      g.fillRect(0, 0, 256, 256);
      const r = rng(19);
      g.strokeStyle = 'rgba(214, 240, 255, 0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 26; i++) {
        const x = r() * 256;
        const y = r() * 256;
        g.beginPath();
        g.ellipse(x, y, 10 + r() * 22, 2 + r() * 3, 0, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      }
      return c;
    })(),
  );
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.colorSpace = THREE.SRGBColorSpace;
  ripple.repeat.set(5, 3);
  own(ripple);
  const water = new THREE.Mesh(own(ellipseDisc(POND.x, POND.z, POND.rx, POND.rz, 64)), mats.toon(0xffffff, { map: ripple }));
  water.position.y = 0.03;
  water.receiveShadow = true;
  group.add(water);
  // the stones the skips throw (and the rings they leave), ./skip.js's: kept for the street's actions
  const stone = new THREE.Mesh(own(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 0.45, 1)), mats.toon(0x7a7a80));
  stone.visible = false;
  group.add(stone);
  const ringGeo = own(new THREE.RingGeometry(0.85, 1, 24).rotateX(-Math.PI / 2));
  const rings = Array.from({ length: 10 }, () => {
    const r = new THREE.Mesh(ringGeo, own(new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0, depthWrite: false })));
    r.position.y = 0.045;
    r.visible = false;
    group.add(r);
    noInk.push(r);
    return { mesh: r, at: -1e9 };
  });

  // the bandstand: an octagonal floor a step up, eight white posts, a low
  // rail but where the path comes in, and a striped roof with a finial
  {
    const { x, z, r, h, posts } = BANDSTAND;
    b.add(new THREE.CylinderGeometry(r, r + 0.1, h, posts), m.white, at(x, h / 2, z, Math.PI / posts));
    put(own(new THREE.CylinderGeometry(r - 0.25, r - 0.25, 0.04, posts)), 0xb08a5a, at(x, h + 0.02, z, Math.PI / posts));
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2 + Math.PI / posts;
      const px = x + Math.cos(a) * (r - 0.35);
      const pz = z + Math.sin(a) * (r - 0.35);
      b.add(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 8), m.white, at(px, h + 1.6, pz));
      // (the rail between this post and the next, but on the south-west side, the way in)
      const a2 = a + (Math.PI * 2) / posts;
      const mid = (a + a2) / 2;
      if (Math.abs(Math.atan2(Math.sin(mid - Math.PI * 0.75), Math.cos(mid - Math.PI * 0.75))) < 0.3) continue;
      const qx = x + Math.cos(a2) * (r - 0.35);
      const qz = z + Math.sin(a2) * (r - 0.35);
      const len = Math.hypot(qx - px, qz - pz);
      b.add(BOX, m.white, at((px + qx) / 2, h + 0.85, (pz + qz) / 2, Math.atan2(qx - px, qz - pz), 0.08, 0.08, len));
      b.add(BOX, m.white, at((px + qx) / 2, h + 0.45, (pz + qz) / 2, Math.atan2(qx - px, qz - pz), 0.05, 0.05, len));
    }
    atlas.add('bandstand-roof', 256, 32, (g, w, hh) => {
      for (let i = 0; i < 16; i++) {
        g.fillStyle = i % 2 ? '#f4efe6' : '#c8352e';
        g.fillRect((i * w) / 16, 0, w / 16 + 1, hh);
      }
    });
    show(new THREE.ConeGeometry(r + 0.7, 2.2, posts, 1, true), 'bandstand-roof', at(x, h + 3.2 + 1.1, z, Math.PI / posts));
    b.add(new THREE.CylinderGeometry(r + 0.72, r + 0.72, 0.25, posts, 1, true), m.white, at(x, h + 3.2, z, Math.PI / posts));
    put(own(new THREE.SphereGeometry(0.25, 10, 8)), 0xd8b25a, at(x, h + 5.5, z));
  }
  // the statue's plinth (the bronze comes with the models)
  put(BOX, 0xb9b3a6, at(STATUE.x, 0.6, STATUE.z, 0, 1.8, 1.2, 1.8));
  put(BOX, 0xcfc9bc, at(STATUE.x, 1.22, STATUE.z, 0, 2, 0.1, 2));
  atlas.add('statue-plaque', 256, 128, (g, w, h) => {
    g.fillStyle = '#7a5a2a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8a050';
    g.fillRect(8, 8, w - 16, h - 16);
    fitText(g, 'THE REVERSE GIRAFFE', w / 2, h * 0.4, w - 40, 28, { color: '#3a2a10' });
    fitText(g, 'GIVEN TO THE TOWN. NOBODY ASKED.', w / 2, h * 0.68, w - 40, 18, { color: '#3a2a10', weight: '700' });
  });
  show(BOX, 'statue-plaque', at(STATUE.x - 0.91, 0.75, STATUE.z, -Math.PI / 2, 1.0, 0.5, 0.02));

  // ── the shops ──
  // (a paved forecourt the length of the row, from the sidewalk to their doors)
  {
    const x0 = Math.min(...SHOPS.map((s) => s.x - s.w / 2)) - 1;
    const x1 = Math.max(...SHOPS.map((s) => s.x + s.w / 2)) + 1;
    const z1 = SHOPS[0].front;
    const z0 = Math.max(...ROADS.filter((r) => r.kind === 'walk' && r.z0 > 0 && r.z1 < z1 && r.x0 < 0 && r.x1 > 0).map((r) => r.z1));
    flat.add(BOX, slab, at((x0 + x1) / 2, WALK_TOP / 2 - 0.01, (z0 + z1) / 2, 0, x1 - x0, WALK_TOP + 0.02, z1 - z0));
  }
  for (const s of SHOPS) {
    const top = s.h;
    const back = s.z + s.d / 2;
    put(BOX, s.tint, at(s.x, top / 2, s.z, 0, s.w, top, s.d));
    // a parapet round the flat roof, and its cap
    b.add(BOX, m.white, at(s.x, top + 0.25, s.front + 0.15, 0, s.w + 0.2, 0.5, 0.3));
    put(BOX, 0x8a8d90, at(s.x, top + 0.02, s.z, 0, s.w - 0.4, 0.04, s.d - 0.4));
    // the shop window and the door, glass on a dark frame
    const glassW = s.id === 'cinema' ? 6 : s.w - 7;
    b.add(BOX, m.dark, at(s.x - 1.5, 0.45, s.front - 0.05, 0, glassW + 0.3, 2.5, 0.12));
    b.add(BOX, m.pane, at(s.x - 1.5, 0.6, s.front - 0.08, 0, glassW, 2.2, 0.08));
    b.add(BOX, m.dark, at(s.x + glassW / 2 + 0.6, 0, s.front - 0.05, 0, 1.4, 2.3, 0.12));
    put(BOX, 0x9cc6d8, at(s.x + glassW / 2 + 0.6, 0.05, s.front - 0.09, 0, 1.15, 2.1, 0.06));
    // the name over the window
    atlas.add(`shop-${s.id}`, 512, 96, (g, w, h) => {
      g.fillStyle = '#1d1d24';
      g.fillRect(0, 0, w, h);
      fitText(g, s.name, w / 2, h / 2 + 2, w - 30, 64, { color: s.id === 'cinema' ? '#ffd84a' : '#f7f4ea' });
    });
    show(BOX, `shop-${s.id}`, at(s.x, s.id === 'cinema' ? 7.4 : 3.55, s.front - 0.1, 0, Math.min(s.w - 2, 12), 1.2, 0.08));
    // a striped awning over the window
    if (s.awning != null) {
      atlas.add(`awning-${s.id}`, 128, 32, (g, w, h) => {
        for (let i = 0; i < 10; i++) {
          g.fillStyle = i % 2 ? '#f7f4ea' : `#${s.awning.toString(16).padStart(6, '0')}`;
          g.fillRect((i * w) / 10, 0, w / 10 + 1, h);
        }
      });
      show(BOX, `awning-${s.id}`, at(s.x - 1.5, 2.85, s.front - 0.75, 0, glassW + 1, 0.08, 1.5, -0.45));
    }
    // and its back, a door and a bin
    b.add(BOX, m.dark, at(s.x + s.w / 4, 0, back + 0.05, 0, 1.2, 2.2, 0.1));
  }
  // the cinema: its marquee over the doors, lit round its edge, and its blade sign
  let marquee = null;
  {
    const c = SHOPS.find((s) => s.id === 'cinema');
    atlas.add('cinema-marquee', 512, 160, (g, w, h) => {
      g.fillStyle = '#f7f4ea';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d1d24';
      fitText(g, 'NOW SHOWING', w / 2, h * 0.2, w - 40, 26, { color: '#7d1f24' });
      fitText(g, 'BALL FONDLERS: THE MOVIE', w / 2, h * 0.5, w - 40, 40);
      fitText(g, 'ALSO: TWO BROTHERS (UNCUT)', w / 2, h * 0.8, w - 40, 26);
    });
    put(BOX, 0x3a2050, at(c.x, 3.2, c.front - 1.4, 0, 12, 1.9, 2.6));
    show(BOX, 'cinema-marquee', at(c.x, 3.3, c.front - 2.71, 0, 11.4, 1.6, 0.04));
    const bulb = mats.glow(0xffe08a, 2.2);
    const bulbs = [];
    for (let i = 0; i <= 24; i++) bulbs.push(at(c.x - 5.9 + (i * 11.8) / 24, 4.22, c.front - 2.72, 0, 1, 1, 1));
    atlas.add('cinema-blade', 96, 512, (g, w, h) => {
      g.fillStyle = '#7d1f24';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd84a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `900 ${w * 0.7}px Arial Black, Arial, sans-serif`;
      const word = 'HERPSON';
      for (let i = 0; i < word.length; i++) g.fillText(word[i], w / 2, ((i + 0.6) * h) / (word.length + 0.2));
    });
    show(BOX, 'cinema-blade', at(c.x + c.w / 2 - 1.2, 4.2, c.front - 0.6, 0, 0.3, 5.6, 1.2));
    for (let i = 0; i < 12; i++) for (const s of [-1, 1]) bulbs.push(at(c.x + c.w / 2 - 1.2 + s * 0.17, 1.55 + i * 0.47, c.front - 0.6 + 0.62, 0, 1, 1, 1));
    const lit = new THREE.InstancedMesh(own(new THREE.SphereGeometry(0.07, 8, 6)), bulb, bulbs.length);
    bulbs.forEach((mx, i) => {
      lit.setMatrixAt(i, mx);
      lit.setColorAt(i, new THREE.Color(1, 1, 1));
    });
    group.add(lit);
    noInk.push(lit);
    // (the bulbs chase round: one in three lit brighter, stepping six times a second)
    marquee = { mesh: lit, k: -1 };
  }
  // the parking lot behind, its bays painted, and the cars in it
  const tarmac = mats.painted('lot', 256, 256, (g, w, h) => speckle(g, w, h, { base: '#5f6268', specks: ['#5a5d63', '#64676d', '#585b61'], n: 1400, size: 1.5, seed: 52 }), { tile: 6 });
  flat.add(BOX, tarmac, at((LOT.x0 + LOT.x1) / 2, 0.003, (LOT.z0 + LOT.z1) / 2, 0, LOT.x1 - LOT.x0, 0.026, LOT.z1 - LOT.z0));
  for (let x = LOT.x0 + 3; x <= LOT.x1 - 3; x += 6) for (const z of [LOT.z0 + 6, LOT.z1 - 6]) lay(BOX, 0xf2efe6, at(x, 0.018, z, 0, 0.14, 0.01, 5));
  const wheel = own(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2));
  for (const c of LOT_CARS) car(put, wheel, c);
  // the water tower: four legs braced across, the tank, its roof and its name
  {
    const { x, z, r, legs, h } = WATER_TOWER;
    const steel = 0x9aa6ae;
    const legH = h - 8;
    const leg = own(new THREE.CylinderGeometry(0.22, 0.3, legH, 8));
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      put(leg, steel, at(x + Math.cos(a) * legs, legH / 2, z + Math.sin(a) * legs));
    }
    for (const y of [legH * 0.33, legH * 0.66]) for (const [dx, dz, turn] of [[0, -1, Math.PI / 2], [0, 1, Math.PI / 2], [-1, 0, 0], [1, 0, 0]]) put(BOX, steel, at(x + dx * legs * Math.SQRT1_2, y, z + dz * legs * Math.SQRT1_2, turn, 0.12, 0.12, legs * 2 * Math.SQRT1_2));
    atlas.add('water-tower', 1024, 128, (g, w, hh) => {
      g.fillStyle = '#b8c8d0';
      g.fillRect(0, 0, w, hh);
      for (let i = 0; i < 2; i++) fitText(g, 'HARRY HERPSON HIGH  ·  GO HUMPING HERPSONS', w * (0.25 + i * 0.5), hh / 2, w * 0.46, 64, { color: '#7d1f24' });
    });
    show(new THREE.CylinderGeometry(r, r, 6, 32, 1, true), 'water-tower', at(x, legH + 3, z));
    put(own(new THREE.CylinderGeometry(r, r, 0.3, 32)), steel, at(x, legH + 0.15, z));
    put(own(new THREE.ConeGeometry(r + 0.3, 2.2, 32)), steel, at(x, legH + 6 + 1.1, z));
    put(own(new THREE.SphereGeometry(0.3, 10, 8)), steel, at(x, legH + 8.3, z));
    put(own(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.1, 32, 1, true)), steel, at(x, legH + 0.2, z));
  }

  // ── the posters: a sheet on each post, facing whoever reads it ──
  atlas.add('missing-cat', 128, 176, (g, w, h) => {
    g.fillStyle = '#fbf8ee';
    g.fillRect(0, 0, w, h);
    fitText(g, 'MISSING', w / 2, 18, w - 12, 26, { color: '#c8262e' });
    // the cat, as a child would draw it: a round head, ears, whiskers
    g.fillStyle = '#e8a050';
    g.beginPath();
    g.arc(w / 2, 72, 30, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(w / 2 - 26, 56);
    g.lineTo(w / 2 - 20, 30);
    g.lineTo(w / 2 - 6, 46);
    g.moveTo(w / 2 + 26, 56);
    g.lineTo(w / 2 + 20, 30);
    g.lineTo(w / 2 + 6, 46);
    g.fill();
    g.fillStyle = '#1d1d24';
    g.fillRect(w / 2 - 12, 66, 5, 5);
    g.fillRect(w / 2 + 7, 66, 5, 5);
    fitText(g, 'ANSWERS TO NOTHING', w / 2, 122, w - 14, 13, { weight: '700' });
    fitText(g, 'TALKS. DO NOT LISTEN.', w / 2, 140, w - 14, 13, { weight: '700' });
    fitText(g, 'CALL JERRY', w / 2, 160, w - 14, 14, { color: '#c8262e' });
  });
  for (const p of POSTERS) {
    const post = LIGHTS.find((l) => l.id === p.on);
    // (on the post, turned to the spot it's read from)
    const ox = post ? post.x : BANDSTAND.x + (p.x - BANDSTAND.x) * ((BANDSTAND.r - 0.35) / (BANDSTAND.r + 0.9));
    const oz = post ? post.z : BANDSTAND.z + (p.z - BANDSTAND.z) * ((BANDSTAND.r - 0.35) / (BANDSTAND.r + 0.9));
    const turn = Math.atan2(p.x - ox, p.z - oz);
    const off = post ? 0.2 : 0.16;
    show(BOX, 'missing-cat', at(ox + Math.sin(turn) * off, (post ? 1.75 : BANDSTAND.h + 1.7) - 0.33, oz + Math.cos(turn) * off, turn, 0.45, 0.62, 0.01));
  }

  // (everything's drawn on the atlas now: up to the card)
  picture.map.needsUpdate = true;

  // ── the models: the kits' street lights, signs, flowers, bushes and rocks, and the bronze ──
  const placed = {
    light: LIGHTS.map((l) => ({ x: l.x, z: l.z, turn: l.face })),
    stop: SIGNS.map((s) => ({ x: s.x, z: s.z, turn: s.face })),
    flowerA: [],
    flowerB: [],
    bush: [],
    reed: [],
    rock: ROCKS.map(([x, z, s], i) => ({ x, z, turn: i * 1.7, s: s / KIT.rock.tall })),
  };
  {
    const r = rng(61);
    // (fewer on a lesser device: the beds' flowers a share, their bushes three a bed)
    const share = { high: 1, mid: 0.6, low: 0.3 }[kit.tier ?? 'high'] ?? 1;
    for (const f of FLOWERBEDS) {
      const n = Math.round(f.r * f.r * 3.2 * share);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const d = Math.sqrt(r()) * (f.r - 0.25);
        (r() < 0.5 ? placed.flowerA : placed.flowerB).push({ x: f.x + Math.cos(a) * d, z: f.z + Math.sin(a) * d, turn: r() * 6.3, s: 0.8 + r() * 0.5 });
      }
      const around = share < 1 ? 3 : 5;
      for (let i = 0; i < around; i++) {
        const a = (i / around) * Math.PI * 2 + r();
        placed.bush.push({ x: f.x + Math.cos(a) * (f.r + 0.7), z: f.z + Math.sin(a) * (f.r + 0.7), turn: r() * 6.3, s: 0.8 + r() * 0.4 });
      }
    }
    // reeds round the pond's far side
    for (let i = 0; i < 14; i++) {
      const a = Math.PI * (1.05 + (i / 13) * 0.9);
      placed.reed.push({ x: POND.x + Math.cos(a) * (POND.rx + 2), z: POND.z + Math.sin(a) * (POND.rz + 2), turn: i, s: 0.7 + r() * 0.5 });
    }
  }
  const models = new THREE.Group();
  models.name = 'town-models';
  group.add(models);
  const load = () => {
    const loader = gltfLoader();
    const files = new Map();
    const file = (url) => {
      if (!files.has(url)) files.set(url, loader.loadAsync(url));
      return files.get(url);
    };
    const jobs = Object.entries(KIT).map(([kind, spec]) =>
      file(spec.url)
        .then((g) => {
          const parts = partsOf(g.scene, spec);
          if (parts) for (const mesh of instanced(parts, placed[kind], { shadows: kind === 'light' || kind === 'stop' || kind === 'rock' })) models.add(mesh);
        })
        .catch((e) => import.meta.env.DEV && console.warn('town: no', kind, e)),
    );
    // the statue: the Reverse Giraffe's model, all of it in one bronze
    jobs.push(
      loader
        .loadAsync('/models/c137/rm/reversegiraffe.glb')
        .then((g) => {
          const bronze = mats.toon(0x9a6f3a);
          g.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.material = bronze;
            o.castShadow = true;
          });
          models.add(stoodOn(g.scene, { x: STATUE.x, z: STATUE.z, y: 1.27, h: 3.4, turn: STATUE.face }));
        })
        .catch((e) => import.meta.env.DEV && console.warn('town: no statue', e)),
    );
    for (const j of jobs) kit.track?.(j);
  };

  let thrown = null;
  return {
    noInk,
    load,
    // the water drifts; the marquee's bulbs run; a thrown stone skips (skip(n, power))
    update(t) {
      ripple.offset.set((t * 0.012) % 1, (t * 0.007) % 1);
      const k = Math.floor(t * 6) % 3;
      if (marquee && k !== marquee.k) {
        marquee.k = k;
        const c = new THREE.Color();
        for (let i = 0; i < marquee.mesh.count; i++) marquee.mesh.setColorAt(i, c.setScalar(i % 3 === k ? 1 : 0.4));
        marquee.mesh.instanceColor.needsUpdate = true;
      }
      stepThrow(t);
    },
    throwStone,
    dispose() {
      for (const o of owned) o.dispose?.();
      owned.length = 0;
    },
  };

  // A stone thrown from where Morty stands out over the pond, skipping `n`
  // times, each hop shorter and lower, a ring where it touches; it sinks at
  // the last. (The rules of it are ./skip.js's; this is how it looks.)
  function throwStone(from, n, t) {
    const dx = POND.x - from.x;
    const dz = POND.z - from.z;
    const len = Math.hypot(dx, dz) || 1;
    thrown = { x0: from.x, z0: from.z, ux: dx / len, uz: dz / len, n, t0: t };
    stone.visible = true;
  }
  function stepThrow(t) {
    for (const r of rings) {
      const age = t - r.at;
      r.mesh.visible = age >= 0 && age < 1.6;
      if (!r.mesh.visible) continue;
      r.mesh.scale.setScalar(0.3 + age * 1.6);
      r.mesh.material.opacity = 0.75 * (1 - age / 1.6);
    }
    if (!thrown) return;
    const { x0, z0, ux, uz, n } = thrown;
    // hop i spans [h_i, h_i+1] in time and distance; each hop 0.7 of the last
    let u = t - thrown.t0;
    let along = 0;
    let span = 4.5;
    let dur = 0.55;
    for (let i = 0; i <= n; i++) {
      if (u < dur) {
        const k = u / dur;
        const height = (i === 0 ? 1.4 : 0.9 * 0.7 ** i) * 4 * k * (1 - k);
        stone.position.set(x0 + ux * (along + span * k), (i === 0 ? 1.1 * (1 - k) : 0) + 0.06 + height, z0 + uz * (along + span * k));
        return;
      }
      u -= dur;
      along += span;
      // a touch: a ring there
      const ring = rings.find((r) => t - r.at > 1.6);
      if (ring && i < n) {
        ring.at = t;
        ring.mesh.position.set(x0 + ux * along, 0.045, z0 + uz * along);
      }
      span *= 0.72;
      dur *= 0.78;
    }
    // sunk: the last ring, and it's gone
    const ring = rings.find((r) => t - r.at > 1.6);
    if (ring) {
      ring.at = t;
      ring.mesh.position.set(x0 + ux * along, 0.045, z0 + uz * along);
    }
    stone.visible = false;
    thrown = null;
  }
}

// a car in the lot, as Shoney's are drawn (./shoneys.js), in the town's
// colours: a body, a cabin, its windows and four wheels, nose north
function car(put, wheel, d) {
  put(BOX, d.tint, at(d.x, 0.55, d.z, 0, d.w - 0.1, 0.55, d.d));
  put(BOX, d.tint, at(d.x, 1.0, d.z + 0.3, 0, d.w - 0.3, 0.45, d.d * 0.5));
  put(BOX, 0x9cc6d8, at(d.x, 1.02, d.z + 0.3, 0, d.w - 0.26, 0.34, d.d * 0.46));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(wheel, 0x1a1b1e, at(d.x + sx * (d.w / 2 - 0.12), 0.34, d.z + sz * (d.d / 2 - 0.8)));
}

// A picture atlas: regions packed in rows on one canvas, each drawn once
// (draw(ctx, w, h), clipped to it, a 4 px gutter round it so a mip doesn't
// bleed), and a geometry's uvs moved into one. makeAtlas(w, h) → { add(name,
// w, h, draw), mapped(geo, name) → a copy of geo on that region, canvas }
function makeAtlas(W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const GUT = 4;
  const at0 = { x: 0, y: 0, row: 0 };
  const regions = new Map();
  return {
    canvas,
    add(name, w, h, draw) {
      if (regions.has(name)) return;
      if (at0.x + w + GUT * 2 > W) Object.assign(at0, { x: 0, y: at0.y + at0.row, row: 0 });
      if (import.meta.env.DEV && at0.y + h + GUT * 2 > H) console.warn('town: the atlas is full at', name);
      const x = at0.x + GUT;
      const y = at0.y + GUT;
      g.save();
      g.translate(x, y);
      g.beginPath();
      g.rect(0, 0, w, h);
      g.clip();
      draw(g, w, h);
      g.restore();
      // (a texel in from the edges)
      regions.set(name, { u0: (x + 1) / W, u1: (x + w - 1) / W, v0: 1 - (y + h - 1) / H, v1: 1 - (y + 1) / H });
      at0.x += w + GUT * 2;
      at0.row = Math.max(at0.row, h + GUT * 2);
    },
    mapped(geo, name) {
      const r = regions.get(name);
      const out = geo.clone();
      const uv = out.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
      return out;
    },
  };
}

// a flat ellipse round (cx, cz), `seg` sides, lying face up on the ground
function ellipseDisc(cx, cz, rx, rz, seg) {
  const g = new THREE.CircleGeometry(1, seg).rotateX(-Math.PI / 2);
  g.scale(rx, 1, rz);
  g.translate(cx, 0, cz);
  return g;
}
// a strip `w` wide round the ellipse (cx, cz, rx, rz), as quads lying on the ground
function ellipseStrip(cx, cz, rx, rz, w, seg) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // the outward normal of the ellipse there
    const nx = c / rx;
    const nz = s / rz;
    const nl = Math.hypot(nx, nz);
    const x = cx + rx * c;
    const z = cz + rz * s;
    pos.push(x - (nx / nl) * (w / 2), 0, z - (nz / nl) * (w / 2), x + (nx / nl) * (w / 2), 0, z + (nz / nl) * (w / 2));
    if (i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // (facing up, whichever way the indices wound)
  const n = g.attributes.normal;
  if (n.getY(0) < 0) {
    idx.reverse();
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}
