// Octahedral impostors on the node renderer (lane N4, the coarse horizon
// grid): many copies of one mesh drawn as camera-facing cards, each card's
// picture blended from the three of its atlas's baked views nearest the
// camera's direction, lit through the baked normals by the scene's own
// lights. One InstancedMesh an atlas. The layout is
// scripts/lib/impostor-layout.mjs's (hemi-octahedral tiles, the card's axes
// from viewBasis, a tile's top row nearer v = 0), the same sums in TSL here.
// The classic renderer draws no impostors (the coarse grid's proxies alone):
// no GLSL is added for them.
//
//   createImpostors({ albedo, normal, views, records }) → { mesh, count, setRecords(records), dispose() }
//   (setRecords: the cards drawn now, no more than it was made with: the
//   coarse grid shows a cell's and hides another's without a new material)
//   (albedo, normal: the atlases' textures; records: [x, y, z, yaw, size] a
//   card, its middle, its turn about +y and its radius, in the parent's frame)
//   impostorAttributes(records) → { centre: Float32Array (x, y, z, size), yaw: Float32Array }

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, abs, attribute, cameraPosition, cameraViewMatrix, clamp, cos, cross, float, floor, min, modelWorldMatrix, modelWorldMatrixInverse, normalize, positionGeometry, select, sin, texture, varyingProperty, vec2, vec3, vec4 } from 'three/tsl';

export function impostorAttributes(records) {
  const centre = new Float32Array(records.length * 4);
  const yaw = new Float32Array(records.length);
  records.forEach(([x, y, z, turn, size], i) => {
    centre.set([x, y, z, size], i * 4);
    yaw[i] = turn;
  });
  return { centre, yaw };
}

export function createImpostors({ albedo, normal = null, views = 16, records }) {
  const { centre, yaw } = impostorAttributes(records);
  const geometry = new THREE.PlaneGeometry(2, 2);
  geometry.setAttribute('aImp', new THREE.InstancedBufferAttribute(centre, 4));
  geometry.setAttribute('aYaw', new THREE.InstancedBufferAttribute(yaw, 1));
  const material = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const n = float(views);
  const dirLocal = varyingProperty('vec3', 'vImpDir');
  const card = varyingProperty('vec2', 'vImpCard');
  const turn = varyingProperty('float', 'vImpYaw');

  // the card: its middle and radius from the record, facing the camera with
  // viewBasis's axes, in the parent's frame (the level's root may be turned)
  material.positionNode = Fn(() => {
    const imp = attribute('aImp', 'vec4');
    const c = imp.xyz;
    const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz;
    const d = normalize(eye.sub(c));
    const right = select(abs(d.y).greaterThan(0.9999), vec3(1, 0, 0), normalize(cross(vec3(0, 1, 0), d)));
    const up = cross(d, right);
    const g = positionGeometry.xy;
    card.assign(g.mul(0.5).add(0.5));
    // (the view in the mesh's own frame: turned back by the record's yaw)
    const a = attribute('aYaw', 'float');
    turn.assign(a);
    const ca = cos(a);
    const sa = sin(a);
    dirLocal.assign(vec3(ca.mul(d.x).sub(sa.mul(d.z)), d.y, sa.mul(d.x).add(ca.mul(d.z))));
    return c.add(right.mul(g.x).add(up.mul(g.y)).mul(imp.w));
  })();

  // the three nearest views and their weights (impostorBlend): the second
  // and third tiles are the same either side of the cell's diagonal
  const tiles = () => {
    const v = normalize(dirLocal);
    const s = abs(v.x).add(v.y.max(0)).add(abs(v.z)).max(1e-6);
    const px = v.x.div(s);
    const pz = v.z.div(s);
    const f = clamp(vec2(px.add(pz), px.sub(pz)).add(1).mul(0.5).mul(n).sub(0.5), 0, n.sub(1));
    const b = min(floor(f), n.sub(2));
    const t = f.sub(b);
    const lower = t.x.add(t.y).lessThanEqual(1);
    const first = select(lower, b, b.add(1));
    const w0 = select(lower, float(1).sub(t.x).sub(t.y), t.x.add(t.y).sub(1));
    const w1 = select(lower, t.x, float(1).sub(t.y));
    const w2 = select(lower, t.y, float(1).sub(t.x));
    return [
      [first, w0],
      [b.add(vec2(1, 0)), w1],
      [b.add(vec2(0, 1)), w2],
    ];
  };
  // a tile's point (atlasUv): the card's v runs up, the tile's top row is nearer v = 0
  const at = (tile) => vec2(tile.x.add(card.x), tile.y.add(float(1).sub(card.y))).div(n);
  const blend = (map) => {
    const [[t0, w0], [t1, w1], [t2, w2]] = tiles();
    return texture(map, at(t0)).mul(w0).add(texture(map, at(t1)).mul(w1)).add(texture(map, at(t2)).mul(w2));
  };

  const colour = blend(albedo);
  material.colorNode = colour.rgb;
  material.opacityNode = colour.a;
  material.maskNode = colour.a.greaterThan(0.5);
  if (normal) {
    // the baked normal in the mesh's frame, turned by the yaw into the parent's, then to the view's
    material.normalNode = Fn(() => {
      const nl = blend(normal).xyz.mul(2).sub(1);
      const c = cos(turn);
      const s = sin(turn);
      const np = vec3(c.mul(nl.x).add(s.mul(nl.z)), nl.y, c.mul(nl.z).sub(s.mul(nl.x)));
      return normalize(cameraViewMatrix.mul(modelWorldMatrix).mul(vec4(np, 0)).xyz);
    })();
  }

  const mesh = new THREE.InstancedMesh(geometry, material, records.length);
  mesh.name = 'impostors';
  // (each card is placed in the shader, so three's bounds do not know where)
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const cap = records.length;
  return {
    mesh,
    get count() {
      return mesh.count;
    },
    setRecords(list) {
      const n = Math.min(cap, list.length);
      const a = impostorAttributes(list.slice(0, n));
      geometry.attributes.aImp.array.set(a.centre);
      geometry.attributes.aYaw.array.set(a.yaw);
      geometry.attributes.aImp.needsUpdate = true;
      geometry.attributes.aYaw.needsUpdate = true;
      mesh.count = n;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose?.();
    },
  };
}
