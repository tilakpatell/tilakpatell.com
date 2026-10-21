// grass.js on the node renderer: Bruno Simon's one-mesh grass, each blade
// built in the vertex stage on the ground map's height, coloured by it and
// moved at its tip by the world's wind, as node hooks (./hookNodes.js) on
// a MeshLambertNodeMaterial, the same names and uniforms (nodes).
// `ground` is groundmapNodes' map (groundHeight, groundColour,
// groundGrass), `wind` windNodes' (windOffset), `tracks` anything with a
// tracksAt(xz) node function. bladeLayout and grassGeometry are grass.js's,
// copied: importing them would bring its GLSL into a 'nodes' world's closure.
// `near` (m, this twin's own; 0: none) lays the blades down within that of
// the camera, so a low camera never looks through a few huge blades.
// `faceCamera` (this twin's own) turns each blade's front to the camera:
// unset, the camera sees its back, and three turns a double-sided
// material's normal over on a back face, so the blades are lit from below
// (the sky light's ground half) and never by the sun; the worlds before
// it were tuned so, and keep it.
// `shape: 'blade'` (this twin's own; one triangle, 'tri', unless asked):
// each blade three triangles, tapering to its tip and curving over under
// the wind and a lean of its own, its tip turned yellow on some and blue on
// others; `tufts` (this twin's own) grows each two by two of them from one
// root, splayed a few centimetres, as a field's grass grows.
//
//   createGrass({ ground, wind, tracks, side, size, height, width, root, seed, near, faceCamera, shape, tufts })
//     → { mesh, material, uniforms, update(centre), set(opts), dispose() }
//   bladeLayout(opts), grassGeometry(opts)

import * as THREE from 'three';
import { seeded } from '../seeded';
import { attribute } from 'three/tsl';

const attributeOf = (name) => attribute(name, 'vec3');
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { cameraPosition, cos, floor, fract, length, mix, modelWorldMatrix, normalLocal, normalize, positionGeometry, sin, smoothstep, step, uniform, varyingProperty, vec2, vec3, vec4 } from 'three/tsl';
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

// a blade's corners: the one triangle, or the tapering three (a pair at the
// root, a pair at a little under half its height, the tip), and the blade's triangles
const SHAPES = {
  tri: { corners: [-1, 0, 0, 1, 0, 0, 0, 1, 0], index: null },
  blade: { corners: [-1, 0, 0, 1, 0, 0, -0.62, 0.45, 0, 0.62, 0.45, 0, 0, 1, 0], index: [0, 1, 2, 1, 3, 2, 2, 3, 4] },
};
const TUFT = 0.8; // of a cell: how far a tuft's blades splay from its root

export function grassGeometry({ side = 280, size = 40, seed = 7, shape = 'tri', tufts = false } = {}) {
  const { centres, rand } = bladeLayout({ side, size, seed });
  const n = side * side;
  const { corners, index } = SHAPES[shape] ?? SHAPES.tri;
  const per = corners.length / 3;
  const pos = new Float32Array(n * per * 3);
  const blade = new Float32Array(n * per * 3);
  const cell = size / side;
  for (let k = 0; k < n; k++) {
    pos.set(corners, k * per * 3);
    let x = centres[k * 2];
    let z = centres[k * 2 + 1];
    // (a tuft: the four blades of a two-by-two block of cells from the first's root, each splayed its own way)
    if (tufts) {
      const ix = k % side;
      const iz = (k - ix) / side;
      const root = (iz - (iz % 2)) * side + (ix - (ix % 2));
      const a = rand[k] * 40.7;
      const r = (0.25 + 0.75 * ((rand[k] * 13.3) % 1)) * TUFT * cell;
      x = centres[root * 2] + Math.cos(a) * r;
      z = centres[root * 2 + 1] + Math.sin(a) * r;
    }
    for (let c = 0; c < per; c++) blade.set([x, z, rand[k]], (k * per + c) * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aBlade', new THREE.BufferAttribute(blade, 3));
  if (index) {
    const idx = new Uint32Array(n * index.length);
    for (let k = 0; k < n; k++) for (let i = 0; i < index.length; i++) idx[k * index.length + i] = k * per + index[i];
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

export function createGrass({ ground, wind, tracks = null, side = 280, size = 40, height = 0.55, width = 0.07, root = 0.5, seed = 7, near = 0, faceCamera = false, shape = 'tri', tufts = false } = {}) {
  const geometry = grassGeometry({ side, size, seed, shape, tufts });
  const curved = shape === 'blade';
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
      // (from the camera in the world: the mesh may stand in a group of its own)
      if (near > 0) h.mulAssign(smoothstep(near * 0.35, near, length(cameraPosition.sub(modelWorldMatrix.mul(vec4(xz.x, ground.groundHeight(xz), xz.y, 1)).xyz))));
      const w = u.uGrassWidth.mul(step(0.1, grass)).mul(step(0.001, h));
      const to = normalize(cameraPosition.xz.sub(xz).add(vec2(1e-4, 0)));
      const across = faceCamera ? vec2(to.y, to.x.negate()) : vec2(to.y.negate(), to.x);
      const p = positionGeometry;
      // (a curved blade bends over along its length, the tip most, under the wind and a lean of its own)
      const bend = curved ? p.y.mul(p.y) : p.y;
      const lean = curved ? vec2(cos(blade.z.mul(44.1)), sin(blade.z.mul(44.1))).mul(h.mul(0.24)) : vec2(0);
      const spread = across.mul(p.x).mul(w).add(wind.windOffset(xz).mul(h).mul(2).add(lean).mul(bend));
      vTip.assign(p.y);
      let colour = ground.groundColour(xz).mul(blade.z.mul(0.2).add(0.9)).mul(p.y.mul(0.3).add(1));
      // (and its own hue: here and there a tip gone yellow, here and there a cooler blade)
      if (curved) {
        const hue = fract(blade.z.mul(7.31));
        colour = mix(colour, colour.mul(vec3(1.3, 1.14, 0.55)), smoothstep(0.7, 0.95, hue).mul(p.y.mul(p.y)).mul(0.85));
        colour = mix(colour, colour.mul(vec3(0.84, 1.0, 0.96)), smoothstep(0.04, 0.22, hue).oneMinus().mul(0.7));
      }
      vColour.assign(colour);
      normalLocal.assign(vec3(0, 1, 0));
      return vec3(xz.x.add(spread.x), ground.groundHeight(xz).add(p.y.mul(h)), xz.y.add(spread.y));
    },
    `grass${tracks ? '|tracks' : ''}${curved ? '|blade' : ''}`,
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
