// What stands on the castle’s shelves, instanced (the design’s §4.14:
// everything that repeats is one draw): the library’s books, thousands of
// them in old leathers, leaning where a gap lets them, a few lying flat;
// and the Potions dungeon’s jars, glass with something in each (a cloudy
// green, an amber, a murk with shapes in it) under a cork or a wax seal.
//
//   placeBooks(shelves, { seed, fill }) → [{ at, ry, rz, s: [w, h, d], colour }]  (pure)
//     shelves: bookcase()’s spots ({ at, ry, w, h }); fill: 0…1, how full they are
//   createBooks(shelves, { seed, fill }) → { mesh, count, dispose() }
//   placeJars(shelves, { seed }) → [{ at, ry, r, h, colour }]  (pure)
//   createJars(shelves, { seed }) → { group, count, dispose() }  (glass, contents, lids: three draws)

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { instanced } from '../kit';

// old bindings: oxblood, bottle green, navy, tan, chocolate, black, a faded plum, vellum
export const LEATHERS = ['#5a1a16', '#1f3a26', '#1c2840', '#8a6236', '#3e2414', '#1a1714', '#4a2a3e', '#c9b893', '#6b2e1c', '#2e3b2a'];
export const BREWS = ['#5fae4a', '#c98a2a', '#3a5a2a', '#8a2a3a', '#d8c86a', '#2a6a7a', '#6a4a8a', '#b8b8a0', '#3a2a1a'];

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// along each shelf from one end: books of their own widths and heights, a
// gap now and then with the next one leaning into it, a stack lying flat
export function placeBooks(shelves, { seed = 5, fill = 0.92 } = {}) {
  const rnd = rng(seed);
  const out = [];
  for (const sh of shelves) {
    const c = Math.cos(sh.ry);
    const s = Math.sin(sh.ry);
    // (along the shelf is its own x: turned by its ry)
    const put = (u, y, rz, w, h, d, colour) => out.push({ at: [sh.at[0] + u * c, sh.at[1] + y, sh.at[2] - u * s], ry: sh.ry, rz, s: [w, h, d], colour });
    let u = -sh.w / 2 + 0.02;
    const end = sh.w / 2 - 0.02;
    let lean = 0;
    while (u < end) {
      const r = rnd();
      if (r > fill && u + 0.12 < end) {
        // a gap, and the next book leans into it
        u += 0.06 + rnd() * 0.08;
        lean = 0.22 + rnd() * 0.18;
        continue;
      }
      const w = 0.025 + rnd() * 0.045;
      const h = Math.min(sh.h - 0.02, (0.6 + rnd() * 0.38) * sh.h);
      const d = 0.15 + rnd() * 0.07;
      const colour = LEATHERS[Math.floor(rnd() * LEATHERS.length)];
      if (r < 0.025 && u + 0.32 < end) {
        // a few lying flat, a little pile
        const n = 2 + Math.floor(rnd() * 3);
        // (a flat book is a standing one turned on its side about its foot: it lies back along the shelf from there)
        for (let i = 0; i < n; i++) put(u + 0.3, 0.02 + i * 0.042, Math.PI / 2, 0.04, 0.28 - i * 0.02, d, LEATHERS[Math.floor(rnd() * LEATHERS.length)]);
        u += 0.32;
        continue;
      }
      // (a leaning book stands on its corner, its top into the gap behind it)
      const rz = lean ? lean : 0;
      put(u + w / 2 + (lean ? (Math.sin(lean) * h) / 2 : 0), 0, rz, w, h, d, colour);
      u += w + 0.002 + (lean ? Math.sin(lean) * h * 0.9 : 0);
      lean = 0;
    }
  }
  return out;
}

export function createBooks(shelves, { seed = 5, fill = 0.92 } = {}) {
  const books = placeBooks(shelves, { seed, fill });
  // (a book’s foot at its middle bottom, so it stands on the shelf and leans from its corner)
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0 });
  const mesh = instanced(
    geo,
    mat,
    books.map((b) => ({ at: b.at, ry: b.ry, rz: b.rz, s: b.s })),
    { colours: books.map((b) => b.colour) },
  );
  mesh.receiveShadow = true;
  mesh.name = 'hogwarts:books';
  return {
    mesh,
    count: books.length,
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose?.();
    },
  };
}

// jars down each shelf, their own sizes, a hand’s width apart, something different in each
export function placeJars(shelves, { seed = 9 } = {}) {
  const rnd = rng(seed);
  const out = [];
  for (const sh of shelves) {
    const c = Math.cos(sh.ry);
    const s = Math.sin(sh.ry);
    let u = -sh.w / 2 + 0.08;
    while (u < sh.w / 2 - 0.08) {
      const r = 0.04 + rnd() * 0.05;
      const h = Math.min(sh.h - 0.04, 0.12 + rnd() * 0.2);
      if (u + r * 2 > sh.w / 2 - 0.04) break;
      const x = u + r;
      out.push({ at: [sh.at[0] + x * c, sh.at[1], sh.at[2] - x * s], ry: rnd() * Math.PI, r, h, colour: BREWS[Math.floor(rnd() * BREWS.length)], fill: 0.45 + rnd() * 0.45 });
      u += r * 2 + 0.03 + rnd() * 0.05;
    }
  }
  return out;
}

export function createJars(shelves, { seed = 9 } = {}) {
  const jars = placeJars(shelves, { seed });
  const group = new THREE.Group();
  group.name = 'hogwarts:jars';
  const glassGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  glassGeo.translate(0, 0.5, 0);
  const brewGeo = new THREE.CylinderGeometry(0.9, 0.9, 1, 10);
  brewGeo.translate(0, 0.5, 0);
  const lidGeo = new THREE.CylinderGeometry(1.05, 0.95, 1, 10);
  lidGeo.translate(0, 0.5, 0);
  const glassMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#cfe0d8'), roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  // (what’s in them gives off a little of its own colour in the dungeon’s dark)
  const brewMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, emissive: new THREE.Color('#0c0c06') });
  const lidMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#7a5a3a'), roughness: 0.9 });
  const brews = instanced(
    brewGeo,
    brewMat,
    jars.map((j) => ({ at: j.at, ry: j.ry, s: [j.r, j.h * j.fill, j.r] })),
    { colours: jars.map((j) => j.colour) },
  );
  const glass = instanced(
    glassGeo,
    glassMat,
    jars.map((j) => ({ at: j.at, ry: j.ry, s: [j.r, j.h, j.r] })),
  );
  glass.renderOrder = 2;
  const lids = instanced(
    lidGeo,
    lidMat,
    jars.map((j) => ({ at: [j.at[0], j.at[1] + j.h, j.at[2]], ry: j.ry, s: [j.r * 0.9, 0.03, j.r * 0.9] })),
  );
  group.add(brews, glass, lids);
  return {
    group,
    count: jars.length,
    dispose() {
      for (const g of [glassGeo, brewGeo, lidGeo]) g.dispose();
      for (const m of [glassMat, brewMat, lidMat]) m.dispose();
      group.removeFromParent();
    },
  };
}
