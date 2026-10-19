// The Red Book in 3D: two halves hinged at the spine (the right lies
// still, the left swings over it to shut the book), red leather boards
// under cream page blocks, the title in gold on the cover, and the leaf in
// the air while a page turns, curled as paper is, its front the page
// going and its back the page coming. A spread (./spread.js) is carried by
// the halves: its left group on the left, its right on the right.
//
//   createBook({ mats, size }) → { group, halves: { left, right }, show(which, spread),
//     setCover(open), setLeaf(t, from, to), dispose() }

import * as THREE from 'three';
import { PD, PW, halfGeometry } from './spread';
import { pen, sheet } from './paint';
import { canvasMap } from './mats';

const BLOCK = 0.016; // a half’s pages, m
const BOARD = 0.004; // the leather
const OVER = 0.008; // the board past the pages
const H = BLOCK + BOARD; // the page’s face over the desk
const SEGMENTS = 24; // the leaf across

// the cover: red leather, worn, the title tooled in gold
function coverArt(w, h) {
  const c = sheet(w, h, 41, { tone: '#7e1d17', edge: 0.6 });
  const p = pen(c.getContext('2d'), w, h, 9);
  p.hatch(0, 0, 1, 1, { n: 400, len: 0.02, angle: 0.4, colour: '#3a0806', alpha: 0.25 });
  const gold = '#d9b25a';
  p.ink([[0.08, 0.06], [0.92, 0.06], [0.92, 0.94], [0.08, 0.94]], { width: 0.006, colour: gold, alpha: 0.9 });
  p.ink([[0.11, 0.08], [0.89, 0.08], [0.89, 0.92], [0.11, 0.92]], { width: 0.002, colour: gold, alpha: 0.8 });
  p.text('There and', 0.5, 0.3, { size: 0.07, colour: gold, align: 'center', weight: 700 });
  p.text('Back Again', 0.5, 0.39, { size: 0.07, colour: gold, align: 'center', weight: 700 });
  p.text('The Red Book of Westmarch', 0.5, 0.5, { size: 0.032, colour: gold, align: 'center', font: 'Georgia, serif', italic: true, weight: 500 });
  // the Ring’s circle, and a star of the Elves under it
  p.ink([[0.5, 0.6], [0.56, 0.66], [0.5, 0.72], [0.44, 0.66]], { width: 0.004, colour: gold });
  p.ink((ctx) => ctx.arc(0.5 * w, 0.66 * h, 0.09 * w, 0, Math.PI * 2), { width: 0.004, colour: gold });
  p.text('by Bilbo and Frodo Baggins', 0.5, 0.86, { size: 0.03, colour: gold, align: 'center', font: 'Georgia, serif', italic: true, weight: 500 });
  return c;
}

// the pages’ edges: cream, lined
function edgeArt() {
  const c = sheet(256, 32, 3, { tone: '#eadcb8', edge: 0.1 });
  const p = pen(c.getContext('2d'), 256, 32, 4);
  p.hatch(0, 0, 1, 1, { n: 60, len: 0.9, angle: 0, colour: '#a08a60', alpha: 0.35, width: 0.0015 });
  return c;
}

export function createBook({ mats, size = 1 }) {
  const group = new THREE.Group();
  const made = [];
  const keep = (x) => (made.push(x), x);
  const coverMap = keep(canvasMap(coverArt(Math.round(512 * size), Math.round((512 * size * (PD + OVER * 2)) / (PW + OVER)))));
  const edgeMap = keep(canvasMap(edgeArt()));
  const leather = mats.lit({ color: 0x7a1c16, roughness: 0.7 });
  const leatherOut = mats.lit({ map: coverMap, roughness: 0.6 });
  const pages = mats.lit({ map: edgeMap, roughness: 0.95 });

  const halves = {};
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    half.position.set(0, H, 0);
    const board = new THREE.Mesh(keep(new THREE.BoxGeometry(PW + OVER, BOARD, PD + OVER * 2)), leather);
    board.position.set((side * (PW + OVER)) / 2, -H + BOARD / 2, 0);
    const block = new THREE.Mesh(keep(new THREE.BoxGeometry(PW - 0.002, BLOCK, PD)), pages);
    block.position.set((side * PW) / 2, -BLOCK / 2, 0);
    half.add(board, block);
    if (side < 0) {
      // the cover’s face, under the left board: up when the book is shut
      const face = new THREE.Mesh(keep(new THREE.PlaneGeometry(PW + OVER, PD + OVER * 2)), leatherOut);
      face.rotation.set(Math.PI / 2, 0, Math.PI);
      face.position.set(-(PW + OVER) / 2, -H - 0.0003, 0);
      face.userData.cover = true;
      half.add(face);
      halves.face = face;
    }
    group.add(half);
    halves[side < 0 ? 'left' : 'right'] = half;
  }
  // the spine, a round of leather the halves turn about
  // (under the gutter, its top no higher than the pages’ face)
  const spine = new THREE.Mesh(keep(new THREE.CylinderGeometry(H * 0.5, H * 0.5, PD + OVER * 2, 12)), leather);
  spine.rotation.x = Math.PI / 2;
  spine.position.y = H * 0.48;
  group.add(spine);

  // the leaf: a strip across, its front and back two meshes of one shape
  const front = keep(halfGeometry(1, { segments: SEGMENTS }));
  const backGeo = keep(halfGeometry(1, { segments: SEGMENTS }));
  // (the back faces down until it lands: its triangles wound the other way,
  // and its picture the left page’s, read from the spine outward)
  const idx = backGeo.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const buv = backGeo.attributes.uv;
  for (let i = 0; i < buv.count; i++) buv.setX(i, 1 - buv.getX(i));
  const u0 = Float32Array.from({ length: front.attributes.position.count }, (_, i) => front.attributes.position.getX(i) / PW);
  const leafFront = new THREE.Mesh(front, pages);
  const leafBack = new THREE.Mesh(backGeo, pages);
  const leaf = new THREE.Group();
  leaf.position.y = H + 0.0015;
  leaf.add(leafFront, leafBack);
  leaf.visible = false;
  group.add(leaf);

  const shown = { left: null, right: null };
  const show = (which, spread) => {
    const was = shown[which];
    if (was === spread) return;
    if (was) halves[which].remove(which === 'left' ? was.left : was.right);
    shown[which] = spread;
    if (spread) halves[which].add(which === 'left' ? spread.left : spread.right);
  };

  return {
    group,
    halves,
    H,
    show,
    shown,
    // 0 shut, 1 flat open: the left half swings over on the spine
    setCover(open) {
      halves.left.rotation.z = -(1 - open) * Math.PI;
    },
    // the leaf at t (0 lying right, 1 lying left), or put away (t null)
    setLeaf(t, from, to) {
      if (t == null) {
        leaf.visible = false;
        return;
      }
      leaf.visible = true;
      leafFront.material = from?.groundMat ?? pages;
      leafBack.material = to?.groundMat ?? pages;
      const e = t * t * (3 - 2 * t);
      const theta = e * Math.PI;
      // the curl: the outer edge lags the spine while the leaf is up
      const curl = Math.sin(e * Math.PI) * 1.1;
      for (const geo of [front, backGeo]) {
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const u = u0[i];
          // the angle along the leaf, integrated in closed form: φ(s) = θ − curl·s
          const n = 12;
          let x = 0;
          let y = 0;
          for (let k = 0; k < n; k++) {
            const s = ((k + 0.5) / n) * u;
            const phi = Math.min(Math.PI, Math.max(0, theta - curl * s));
            x += Math.cos(phi) * (u / n) * PW;
            y += Math.sin(phi) * (u / n) * PW;
          }
          pos.setX(i, x);
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
      }
    },
    dispose() {
      for (const x of made) x.dispose();
      leather.dispose();
      leatherOut.dispose();
      pages.dispose();
    },
  };
}
