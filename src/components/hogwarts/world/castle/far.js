// The castle far off across the water, drawn: ./silhouette.js's parts
// merged by what they're made of into four draws (the crag's rock, the
// stone, the slate and the lit glass), in the house's look on the node
// renderer. The windows glow warm, over the house bloom's threshold, and
// brighten as the dark comes on (`windows`, rules/dusk.js's); each keeps
// its own warmth, so the castle reads as rooms with people in them, not a
// sign. Past 300 m this is the whole castle; Lane C's near castle takes
// over closer in (the design's §4.3).
//
//   createFarCastle({ house, at: [x, z], yaw }) → { group, set(light), dispose }

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, uniform, vec3 } from 'three/tsl';
import { castleParts } from './silhouette';

// a role's parts as one geometry, each part's colour in its vertices (a
// window's a little warmer or cooler than the next, by its seed)
function merged(parts, role, rand) {
  const list = parts
    .filter((p) => p.role === role)
    .map((p) => {
      const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      const c = new THREE.Color().setStyle(p.color, THREE.SRGBColorSpace);
      if (role === 'glass') c.multiplyScalar(0.65 + rand() * 0.55);
      const a = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return g;
    });
  return list.length ? mergeGeometries(list) : null;
}

export function createFarCastle({ house, at = [0, 0], yaw = 0, seed = 7 } = {}) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = castleParts({ seed });
  const group = new THREE.Group();
  group.name = 'castle:far';
  group.position.set(at[0], 0, at[1]);
  group.rotation.y = yaw;
  const uGlow = uniform(1);
  const solid = house.material({ vertexColors: true });
  const glass = new MeshBasicNodeMaterial({ fog: true });
  // (the window's own colour, lifted over 1 so the bloom haloes it, by how dark it's got)
  glass.colorNode = attribute('color', 'vec3').mul(uGlow).mul(vec3(3.2, 2.6, 2.0));
  const geos = [];
  for (const role of ['rock', 'stone', 'roof']) {
    const g = merged(parts, role, rand);
    if (!g) continue;
    geos.push(g);
    const mesh = new THREE.Mesh(g, solid);
    mesh.name = `castle:${role}`;
    group.add(mesh);
  }
  const lit = merged(parts, 'glass', rand);
  geos.push(lit);
  const windows = new THREE.Mesh(lit, glass);
  windows.name = 'castle:windows';
  group.add(windows);
  for (const p of parts) p.g.dispose();

  return {
    group,
    set(light) {
      uGlow.value = 0.55 + 0.6 * light.windows;
    },
    dispose() {
      for (const g of geos) g.dispose();
      solid.dispose();
      glass.dispose();
    },
  };
}
