// The Forbidden Forest from afar: its crowns as one surface over the
// forest’s ground, a lumpy dark roof of pines a tree or so high, so the
// forest reads as a forest across the lake and from the castle’s towers
// without a pine drawn a tree at a time out there (the pools’ pines stop at
// their reach, scatter.js’s REACH). Within RING metres of the camera the
// roof sinks into the ground, easing down where the pools’ real pines are
// shrinking away toward their reach, so the two hand over in a band and
// neither is seen ending. One mesh, one draw, a few tens of thousands of
// triangles; its colour the pines’ dark green, lighter on the crowns’ tops
// and where the sun catches them, by a noise a crown across.
//
//   createCanopy({ land, house, tier, ring }) → { mesh, update(camera), dispose }
//   canopyHeight(land, x, z) → the roof’s height there (−∞ where there’s no forest) (pure)

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, cameraPosition, float, length, mix, positionGeometry, positionWorld, smoothstep, uniform, vec3 } from 'three/tsl';
import { onColor, onPosition } from '../../../lib/three/hookNodes';
import { noiseWith } from '../../../lib/three/noiseNodes';
import { HALF, noise2 } from './terrain';
import { REACH } from './scatter';

const STEP = { low: 12, mid: 9, high: 8, ultra: 8 };
const TALL = 15; // m: the crowns’ tops over the ground

export function canopyHeight(land, x, z, out = {}) {
  land.coverAt(x, z, out);
  const k = Math.min(1, Math.max(0, (out.forest - 0.25) / 0.45));
  if (k <= 0) return -Infinity;
  // (lumps a crown or two across, and a slow swell, so the roof isn’t a plane)
  const lump = noise2(x / 7, z / 7, 21) * 2.6 + noise2(x / 31, z / 31, 23) * 3;
  return land.heightAt(x, z) + (TALL + lump) * Math.sqrt(k);
}

export function createCanopy({ land, house = null, tier = 'high', ring = null } = {}) {
  const step = STEP[tier] ?? 8;
  const n = Math.round((2 * HALF) / step) + 1;
  const pos = new Float32Array(n * n * 3);
  const lift = new Float32Array(n * n); // (how high over the ground the roof stands: the sink eases it down by this)
  const cv = {};
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -HALF + i * step;
      const z = -HALF + j * step;
      const g = land.heightAt(x, z);
      const h = canopyHeight(land, x, z, cv);
      const y = h === -Infinity ? g - 3 : h;
      const k = j * n + i;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      lift[k] = y - g + 3;
    }
  const idx = [];
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      // (a cell with no roof at any corner is left out: most of the grounds isn’t forest)
      if (lift[a] <= 3.01 && lift[a + 1] <= 3.01 && lift[a + n] <= 3.01 && lift[a + n + 1] <= 3.01) continue;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aLift', new THREE.BufferAttribute(lift, 1));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = house ? house.material({ color: 0xffffff }) : new MeshLambertNodeMaterial({ color: 0xffffff });
  const uRing = uniform(ring ?? (REACH.forest[tier] ?? 260) - 30);
  const uSeed = uniform(new THREE.Vector3(9.1, 2.2, 5.5));
  const { noise } = noiseWith(uSeed, { octaves: 2 });
  // within the ring, the roof eased down into the ground by its own height
  onPosition(
    material,
    (p) => {
      const d = length(positionGeometry.xz.sub(cameraPosition.xz));
      const down = smoothstep(uRing, uRing.sub(70), d).mul(attribute('aLift', 'float'));
      return vec3(p.x, p.y.sub(down), p.z);
    },
    'canopy:sink',
    { uRing },
  );
  onColor(
    material,
    (d) => {
      const p = positionWorld;
      const crowns = noise(p.mul(vec3(0.16, 0.25, 0.16)), uSeed).mul(0.5).add(0.5);
      const broad = noise(p.mul(0.02), uSeed).mul(0.5).add(0.5);
      const dark = vec3(0.022, 0.045, 0.028);
      const lit = vec3(0.05, 0.085, 0.045);
      return d.rgb.mul(mix(dark, lit, crowns.mul(0.7).add(broad.mul(0.3)))).mul(float(1.6));
    },
    'canopy:crowns',
    { uSeed },
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hogwarts:canopy';
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  return {
    mesh,
    triangles: idx.length / 3,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
