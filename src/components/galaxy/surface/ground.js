// A world's ground, drawn: the height grid (terrain.js) as one mesh, fine
// where you walk and stretched out to the horizon, coloured by a shader
// that reads the site's palette by height and slope (sand in the hollows,
// paler on the crests, rock on the cliffs, snow on the tops), broken up by
// noise at three sizes so no stretch of it repeats, with ripples in the
// light across it (wind-blown sand, wind-scoured snow) and grain close up.
// The material is lib/three/groundLook.js's (moved down so the flight's
// ground wears it too), with the walkable square's HALF. It takes the scene's light, shadows and fog like anything else (it's a
// MeshStandardMaterial underneath). `marks` is a texture over the walkable
// square that tints where something's been (the dark under a footprint,
// footprints in the snow): the scene paints into it.
//
// palette: { low, high, rock, accent, deep? } colours; hLow, hHigh: the
// heights low gives way to high between; rock: the slope (0 flat … 1 a
// wall) rock starts at; accent: how much of the accent there is (0…1) in
// patches; ripple: { strength, scale, wind }; grain: 0…1; sparkle: 0…1
// (snow, salt); wet: { level, color } darkening the ground near the water.
//
// Up close, the ground wears a photo-scanned surface (public/cc0/galaxy/,
// kit.js's scans: sand, snow, grass, a pine floor, leaf litter, mud, ash,
// red soil, gravel, a beach), by the site's `ground.detail` (a role) and
// `ground.detailLook` ({ color, normal, metres, near, far }): its detail
// colour map laid over the palette's colour and its normal map tilting the
// light, at the scan's real size, fading out between `near` and `far`
// metres so the far ground stays the shader's own. Not on the low tier.
//
// At ultra (`splat`, amounts.js's), the ground is layered (splat.js's
// scans): the site's scan at two sizes turned against each other (so no
// tile repeats), a second scan in broad patches, rock wrapped round the
// slopes from the three axes, small blotches of a fourth, all reaching
// further out (never stretched down a cliff: the flat-laid scans give way
// to the wrapped rock there); and it's wet by the water and in the hollows (darker,
// smoother, catching the light). Its own program (SPLAT): high's is as it was.

import * as THREE from 'three';
import { HALF } from './terrain';
import { sharpen } from '../../../lib/three/textures';
import { looks } from './looks';

export const groundMaterial = (site, opts = {}) => looks().groundMaterial(site, { half: HALF, ...opts });

// The mesh, from the height grid: lines × lines vertices, each cell two
// triangles split from (i, j + 1) to (i + 1, j) (as heightGrid reads them),
// where the grid lies
export function groundMesh(grid, material) {
  const mesh = new THREE.Mesh(groundGeometry(grid), material);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

// (its geometry alone: the free roam swaps a new one in as the grid moves round you, roam.js)
export const groundGeometry = (grid) => {
  const build = groundBuild(grid);
  build.step(Infinity);
  return build.geometry;
};

// The same geometry made a few rows at a time, for the free roam's move:
// `step(ms)` works till the time's up (true once it's made), `geometry`
// then. Its normals are three's computeVertexNormals', a row of cells at
// a time: each triangle's (c − b) × (a − b) added to its corners, then
// each corner's made a unit long.
export function groundBuild(grid) {
  const { lines, heights, size: w } = grid;
  const [cx, cz] = grid.centre ?? [0, 0];
  const pos = new Float32Array(w * w * 3);
  const nor = new Float32Array(w * w * 3);
  const index = new Uint32Array((w - 1) * (w - 1) * 6);
  // (the stages, each a row at a time: corners, cells, normals made unit)
  let stage = 0;
  let row = 0;
  let geometry = null;
  const add = (v, x, y, z) => {
    nor[v * 3] += x;
    nor[v * 3 + 1] += y;
    nor[v * 3 + 2] += z;
  };
  // (one triangle's face, its corners a, b, c as the index lists them)
  const face = (a, b, c) => {
    const bx = pos[b * 3];
    const by = pos[b * 3 + 1];
    const bz = pos[b * 3 + 2];
    const cbx = pos[c * 3] - bx;
    const cby = pos[c * 3 + 1] - by;
    const cbz = pos[c * 3 + 2] - bz;
    const abx = pos[a * 3] - bx;
    const aby = pos[a * 3 + 1] - by;
    const abz = pos[a * 3 + 2] - bz;
    const x = cby * abz - cbz * aby;
    const y = cbz * abx - cbx * abz;
    const z = cbx * aby - cby * abx;
    add(a, x, y, z);
    add(b, x, y, z);
    add(c, x, y, z);
  };
  const rows = [
    (j) => {
      for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 3;
        pos[k] = cx + lines[i];
        pos[k + 1] = heights[j * w + i];
        pos[k + 2] = cz + lines[j];
      }
    },
    (j) => {
      if (j >= w - 1) return;
      let t = j * (w - 1) * 6;
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i; // (i, j)
        const b = a + 1; // (i + 1, j)
        const c = a + w; // (i, j + 1)
        const d = c + 1; // (i + 1, j + 1)
        index[t++] = a;
        index[t++] = c;
        index[t++] = b;
        index[t++] = c;
        index[t++] = d;
        index[t++] = b;
        face(a, c, b);
        face(c, d, b);
      }
    },
    (j) => {
      for (let k = j * w * 3; k < (j + 1) * w * 3; k += 3) {
        const l = Math.hypot(nor[k], nor[k + 1], nor[k + 2]) || 1;
        nor[k] /= l;
        nor[k + 1] /= l;
        nor[k + 2] /= l;
      }
    },
  ];
  return {
    step(ms = Infinity) {
      const t0 = performance.now();
      while (stage < rows.length) {
        rows[stage](row++);
        if (row === w) {
          stage++;
          row = 0;
        }
        if (performance.now() - t0 >= ms) break;
      }
      if (stage < rows.length) return false;
      if (!geometry) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        geometry.setIndex(new THREE.BufferAttribute(index, 1));
        geometry.computeBoundingSphere();
      }
      return true;
    },
    get geometry() {
      return geometry;
    },
  };
}

// Where things have been, over the walkable square: a canvas the scene
// paints soft dabs into, as a texture the ground reads (red: how much)
export function createMarks(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  sharpen(texture);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  let dirty = false;
  let sent = -Infinity; // (when it last went up to the graphics chip: a 512² upload, at most four times a second)
  const centre = [0, 0]; // (where the square lies: the free roam moves it round you, roam.js)
  return {
    texture,
    // a dab at (x, z), r metres across, `k` strong (0…1)
    dab(x, z, r = 1.2, k = 0.35) {
      const u = (((x - centre[0]) / (2 * HALF)) + 0.5) * size;
      const v = (((z - centre[1]) / (2 * HALF)) + 0.5) * size;
      if (u < 0 || v < 0 || u > size || v > size) return;
      const px = Math.max(1, (r / (2 * HALF)) * size);
      const grad = c.createRadialGradient(u, v, 0, u, v, px);
      grad.addColorStop(0, `rgba(255,0,0,${k})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      c.fillStyle = grad;
      c.fillRect(u - px, v - px, px * 2, px * 2);
      dirty = true;
    },
    // the square laid round another middle, its marks gone with the old one
    moveTo(x, z) {
      centre[0] = x;
      centre[1] = z;
      c.fillStyle = '#000';
      c.fillRect(0, 0, size, size);
      dirty = true;
    },
    flush(now = performance.now()) {
      if (!dirty || now - sent < 250) return;
      dirty = false;
      sent = now;
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
    },
  };
}
