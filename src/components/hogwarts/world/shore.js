// The ground the world opens on: the shingle shore of the Black Lake, the
// grass bank up from it and the heather of the moor beyond (rules/shore.js
// says where each is), in the house's look; the far shore's hills all
// round the water, dark with forest, fading into the evening's haze; and
// what the MegaKit gives the shore (boulders at the water's edge, pebbles on
// the shingle, grass on the bank, a pinewood up behind and down either
// side) through its instanced pools.
//
//   createShore({ house, kitFor, tier }) → { group, scatter, solids, update(camera, dt), dispose }

import * as THREE from 'three';
import { cameraPosition, distance, dot, float, max, mix, positionWorld, smoothstep, uniform, vec3 } from 'three/tsl';
import { createKitScatter } from '../../../lib/three/kitScatter';
import { onColor } from '../../../lib/three/hookNodes';
import { noiseWith } from '../../../lib/three/noiseNodes';
import { GROUND, heightAt, inland, scatterOf, solidsOf } from '../rules/shore';

// the shore's colours, sRGB: the wet stones at the water's edge, the dry
// shingle, the grass, the heather and the bracken of the moor
const C = Object.fromEntries(
  Object.entries({ bed: '#2d2c2a', wet: '#3f3d39', shingle: '#857f74', shingleHi: '#9a948a', sand: '#6e6658', grass: '#3d5530', grassHi: '#4f6838', heather: '#5b3f55', bracken: '#6a5634', moss: '#33452a' }).map(([k, v]) => [k, new THREE.Color().setStyle(v, THREE.SRGBColorSpace)]),
);

const hash = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// the colour of the ground at (x, z)
function colourAt(x, z, out) {
  const d = inland(x, z);
  const n = hash(Math.round(x * 2), Math.round(z * 2));
  const patch = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.sin(z * 0.13 - x * 0.03);
  out.copy(C.bed);
  out.lerp(C.wet, smooth(-1, 0.2, d));
  out.lerp(n > 0.5 ? C.shingleHi : C.shingle, smooth(0.4, 2.2, d) * (0.75 + 0.25 * n));
  out.lerp(C.sand, smooth(9, 13, d) * 0.5);
  const green = smooth(12.5, 16, d);
  out.lerp(n > 0.6 ? C.grassHi : C.grass, green);
  out.lerp(C.heather, green * smooth(0.55, 0.8, patch) * smooth(18, 34, d));
  out.lerp(C.bracken, green * smooth(46, 70, d) * (0.4 + 0.4 * patch));
  out.lerp(C.moss, green * smooth(0.7, 0.95, n) * 0.4);
  return out;
}

// the ground as a grid fine where you walk (`step` metres) and coarse out
// along the hills either side, where it's only seen far off
// The stones of the shingle, up close: the ground's colour broken into
// pebbles a hand across and the bigger stones among them, each lighter on
// top and darker in the gaps, fading out with distance (where it would only
// shimmer) and on the grass, where it reads as tussocks instead
function stones(material) {
  const uSeed = uniform(new THREE.Vector3(3.7, 8.1, 1.9));
  const { noise } = noiseWith(uSeed, { octaves: 2 });
  onColor(
    material,
    (d) => {
      const p = positionWorld.xz;
      const small = noise(vec3(p.mul(6.5), 0.5), uSeed).mul(0.5).add(0.5);
      const big = noise(vec3(p.mul(1.7), 2.5), uSeed).mul(0.5).add(0.5);
      // (a stone's crown catches the light, the gaps between hold the dark)
      const crown = smoothstep(0.35, 0.75, small).mul(0.6).add(smoothstep(0.45, 0.8, big).mul(0.4));
      const near = float(1).sub(smoothstep(12, 60, distance(positionWorld, cameraPosition)));
      // (grey ground, the shingle, takes it whole; the greens a third of it)
      const grey = float(1).sub(smoothstep(0.02, 0.12, max(d.g.sub(d.r), d.r.sub(d.b))));
      const k = near.mul(mix(0.35, 1, grey));
      const lum = dot(d.rgb, vec3(0.2126, 0.7152, 0.0722));
      return mix(d.rgb, d.rgb.mul(crown.mul(0.9).add(0.6)).add(lum.mul(crown).mul(0.12)), k);
    },
    'hogwarts:stones',
    { uSeed },
  );
  return material;
}

function groundGeometry(step) {
  const xs = [];
  for (let x = GROUND.x0; x < -260; x += 40) xs.push(x);
  for (let x = -260; x < 260; x += step) xs.push(x);
  for (let x = 260; x <= GROUND.x1; x += 40) xs.push(x);
  const zs = [];
  for (let z = GROUND.z0; z <= GROUND.z1; z += step) zs.push(z);
  const pos = new Float32Array(xs.length * zs.length * 3);
  const colour = new Float32Array(xs.length * zs.length * 3);
  const c = new THREE.Color();
  let i = 0;
  for (const z of zs)
    for (const x of xs) {
      pos.set([x, heightAt(x, z), z], i * 3);
      colourAt(x, z, c);
      colour.set([c.r, c.g, c.b], i * 3);
      i++;
    }
  const index = [];
  const n = xs.length;
  for (let j = 0; j < zs.length - 1; j++)
    for (let k = 0; k < n - 1; k++) {
      const a = j * n + k;
      const b = a + n;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry().setIndex(index);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// The far shore: a ring of hills round the water, forest dark on them,
// higher behind the castle and to the west where the Forbidden Forest is
function hillsGeometry({ centre = [0, -650], inner = 1250, outer = 1700, segments = 180 } = {}) {
  const pos = [];
  const colour = [];
  const index = [];
  const c = new THREE.Color();
  const rows = 4;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    // (a = 0 is behind you, +z; a = π behind the castle, where the hills rise, and to the west)
    const back = 0.5 - 0.5 * Math.cos(a);
    const west = Math.max(0, -Math.sin(a));
    const top = 60 + 80 * back + 70 * west + 40 * Math.sin(a * 5 + 1) ** 2 + 24 * Math.sin(a * 11 + 2) + 12 * Math.sin(a * 23);
    for (let r = 0; r <= rows; r++) {
      const k = r / rows;
      const rad = inner + (outer - inner) * k;
      // (a slope that rounds over at its brow)
      const h = top * Math.sin((k * Math.PI) / 2) ** 1.4 - 6 * (1 - k);
      pos.push(centre[0] + Math.sin(a) * rad, h, centre[1] + Math.cos(a) * rad);
      c.setStyle(k < 0.25 ? '#20261c' : '#161c17', THREE.SRGBColorSpace).multiplyScalar(0.85 + 0.3 * hash(i, r));
      colour.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < segments; i++)
    for (let r = 0; r < rows; r++) {
      const a = i * (rows + 1) + r;
      const b = a + rows + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry().setIndex(index);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colour, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function createShore({ house, kitFor, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'shore';
  const groundMat = stones(house.material({ vertexColors: true }));
  const ground = new THREE.Mesh(groundGeometry(tier === 'low' ? 4 : 2), groundMat);
  ground.name = 'shore:ground';
  ground.receiveShadow = true;
  const hillsMat = house.material({ vertexColors: true });
  const hills = new THREE.Mesh(hillsGeometry({ segments: tier === 'low' ? 90 : 180 }), hillsMat);
  hills.name = 'shore:hills';
  group.add(ground, hills);

  // the kit's rocks, grass and pines, laid by the rules and stood on the ground
  const items = scatterOf({ tier }).map((i) => ({ ...i, y: heightAt(i.x, i.z) - (i.model.startsWith('Rock') ? 0.25 * i.scale : 0) }));
  const scatter = createKitScatter({ kitFor, tier, name: 'hogwarts:shore' });
  scatter.set('shore', items);
  group.add(scatter.group);

  return {
    group,
    scatter,
    solids: solidsOf(items),
    update(camera, dt) {
      scatter.update(camera, dt);
    },
    dispose() {
      scatter.dispose();
      ground.geometry.dispose();
      hills.geometry.dispose();
      groundMat.dispose();
      hillsMat.dispose();
    },
  };
}
