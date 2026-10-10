// grass.js on the node renderer: Bruno Simon's one-mesh grass, each blade
// built in the vertex stage on the ground map's height, coloured by it and
// moved at its tip by the world's wind, as node hooks (./hookNodes.js) on
// a MeshLambertNodeMaterial, the same names and uniforms (nodes).
// `ground` is groundmapNodes' map (groundHeight, groundColour,
// groundGrass), `wind` windNodes' (windOffset), `tracks` anything with a
// tracksAt(xz) node function. bladeLayout and grassGeometry are grass.js's,
// copied: importing them would bring its GLSL into a 'nodes' world's closure.
//
//   createGrass({ ground, wind, tracks, side, size, height, width, root, seed })
//     → { mesh, material, uniforms, update(centre), set(opts), dispose() }
//   bladeLayout(opts), grassGeometry(opts)

import * as THREE from 'three';
import { seeded } from '../seeded';
import { attribute } from 'three/tsl';

const attributeOf = (name) => attribute(name, 'vec3');
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { cameraPosition, floor, length, mix, normalLocal, normalize, positionGeometry, smoothstep, step, uniform, varyingProperty, vec2, vec3 } from 'three/tsl';
import { onColor, onLight, onPosition } from './hookNodes';

// GLSL's mod (floored)
const mod = (a, b) => a.sub(b.mul(floor(a.div(b))));

export function bladeLayout({ side = 280, size = 40, seed = 7 } = {}) {
  const rand = seeded(seed);
  const n = side * side;
  const centres = new Float32Array(n * 2);
  const r = new Float32Array(n);
  const cell = size / side;
  for (let iz = 0; iz < side; iz++)
    for (let ix = 0; ix < side; ix++) {
      const k = iz * side + ix;
      centres[k * 2] = -size / 2 + (ix + rand() * 0.98) * cell;
      centres[k * 2 + 1] = -size / 2 + (iz + rand() * 0.98) * cell;
      r[k] = rand();
    }
  return { centres, rand: r };
}

export function grassGeometry({ side = 280, size = 40, seed = 7 } = {}) {
  const { centres, rand } = bladeLayout({ side, size, seed });
  const n = side * side;
  const pos = new Float32Array(n * 9);
  const blade = new Float32Array(n * 9);
  const CORNERS = [-1, 0, 0, 1, 0, 0, 0, 1, 0];
  for (let k = 0; k < n; k++) {
    pos.set(CORNERS, k * 9);
    for (let c = 0; c < 3; c++) blade.set([centres[k * 2], centres[k * 2 + 1], rand[k]], k * 9 + c * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aBlade', new THREE.BufferAttribute(blade, 3));
  return g;
}

export function createGrass({ ground, wind, tracks = null, side = 280, size = 40, height = 0.55, width = 0.07, root = 0.5, seed = 7 } = {}) {
  const geometry = grassGeometry({ side, size, seed });
  const uniforms = {
    uGrassCentre: uniform(new THREE.Vector2()),
    uGrassSize: uniform(size),
    uGrassHeight: uniform(height),
    uGrassWidth: uniform(width),
    uGrassRoot: uniform(root),
  };
  const u = uniforms;
  const vColour = varyingProperty('vec3', 'vGrassColour');
  const vTip = varyingProperty('float', 'vGrassTip');
  const material = new MeshLambertNodeMaterial({ side: THREE.DoubleSide });
  // BLADE_VS, the blade built where its root is in the patch wrapped round
  // the centre; its normal straight up (beginnormal_vertex's swap)
  onPosition(
    material,
    () => {
      const blade = attributeOf('aBlade');
      const rel = mod(blade.xy.sub(u.uGrassCentre).add(u.uGrassSize.mul(0.5)), vec2(u.uGrassSize)).sub(u.uGrassSize.mul(0.5));
      const xz = u.uGrassCentre.add(rel).toVar();
      let grass = ground.groundGrass(xz);
      // (flat where the wheels went: his G × (1 − r))
      if (tracks?.tracksAt) grass = grass.mul(tracks.tracksAt(xz).r.oneMinus());
      const edge = smoothstep(0.32, 0.5, length(rel).div(u.uGrassSize)).oneMinus();
      const noise = wind.uniforms.uWindNoise.sample(xz.mul(0.0321)).level(0).r;
      const h = u.uGrassHeight.mul(blade.z.mul(0.55).add(0.45)).mul(noise.mul(0.6).add(0.55)).mul(smoothstep(0.1, 0.6, grass)).mul(edge).toVar();
      const w = u.uGrassWidth.mul(step(0.1, grass)).mul(step(0.001, h));
      const to = normalize(cameraPosition.xz.sub(xz).add(vec2(1e-4, 0)));
      const across = vec2(to.y.negate(), to.x);
      const p = positionGeometry;
      const spread = across.mul(p.x).mul(w).add(wind.windOffset(xz).mul(p.y).mul(h).mul(2));
      vTip.assign(p.y);
      vColour.assign(ground.groundColour(xz).mul(blade.z.mul(0.2).add(0.9)).mul(p.y.mul(0.3).add(1)));
      normalLocal.assign(vec3(0, 1, 0));
      return vec3(xz.x.add(spread.x), ground.groundHeight(xz).add(p.y.mul(h)), xz.y.add(spread.y));
    },
    tracks ? 'grass|tracks' : 'grass',
    { ...u, ...(ground.uniforms ?? {}), ...(wind.uniforms ?? {}), ...(tracks?.uniforms ?? {}) },
  );
  onColor(material, (d) => d.rgb.mul(vColour), 'grass:colour');
  onLight(material, (light) => light.mul(mix(u.uGrassRoot, 1, vTip)), 'grass:root');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'grass';
  // (placed in the shader, so the mesh's own bounds mean nothing)
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return {
    mesh,
    material,
    uniforms,
    // where the patch is centred: wherever the eye is on (the hobbit, the
    // camera's target), once a frame
    update(centre) {
      uniforms.uGrassCentre.value.set(centre.x, centre.z);
    },
    set({ height: h = null, width: w = null, root: r = null } = {}) {
      if (h != null) uniforms.uGrassHeight.value = h;
      if (w != null) uniforms.uGrassWidth.value = w;
      if (r != null) uniforms.uGrassRoot.value = r;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
