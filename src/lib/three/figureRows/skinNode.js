// The vertex stage of a figure drawn as a row: three's own skinning
// (three/src/nodes/accessors/Skinning.js, r186: getSkinnedPosition and
// getSkinnedNormalAndTangent, kept term for term), with the joints read from
// the rows' texture by the instance's index in place of the object's own
// skeleton.
//
// The texture is rows.js's: two rows an instance, the pose now and the pose
// of the frame before (pose.js lays a row out: the root's matrix, then four
// texels a joint). three skins in the mesh's own frame and lets the mesh's
// world matrix place the result:
//
//   world = meshWorld × (bindMatrixInverse × Σ wᵢ · boneᵢ × bindMatrix × p).xyz
//
// A row's root stands for both: its joints are held as rootInverse × boneᵢ
// (pose.js) and its first matrix is the root, so the same sum is read and
// the root places it. The normal and the tangent go through the same
// weighted matrix, then the root as an instance's matrix turns them
// (three's transformNormal, as its instancing does). The position of the
// frame before is skinned from the second row whenever the pass writes
// velocity, so a row moves in the temporal filter's eyes by its own bones
// and its own root; a part with no skin (a gun in the hand) is the root
// alone.
//
// Everything is assigned as three's skinning assigns it (positionPrevious,
// normalLocal, tangentLocal in place) and the position returned for the
// material's positionNode. The drawn Mesh stands at the origin: the root is
// the whole of the model matrix.
//
//   ROWS_AN_INSTANCE: 2 (now, before)
//   rowNodes(tsl, { map, skinned, bindMatrix = null }) → { rows, position }
//     map: the DataTexture; rows: its texture node (rows.value = a grown one);
//     position(): the node for material.positionNode
//   rowVertex(array, layout, instance, { index, weight, position, bind, before }) → [x, y, z]
//     the same sum on the CPU, for the tests: where the vertex lands in the world

import { TEXELS_A_MATRIX } from './pose.js';

export const ROWS_AN_INSTANCE = 2;

// m × (x, y, z, w) for a matrix held as sixteen floats at `at`
const times = (a, at, [x, y, z, w]) => [a[at] * x + a[at + 4] * y + a[at + 8] * z + a[at + 12] * w, a[at + 1] * x + a[at + 5] * y + a[at + 9] * z + a[at + 13] * w, a[at + 2] * x + a[at + 6] * y + a[at + 10] * z + a[at + 14] * w, a[at + 3] * x + a[at + 7] * y + a[at + 11] * z + a[at + 15] * w];

export function rowVertex(array, layout, instance, { index = null, weight = null, position, bind = null, before = false }) {
  const base = (instance * ROWS_AN_INSTANCE + (before ? 1 : 0)) * layout.floatsARow;
  let p = [position[0], position[1], position[2], 1];
  if (index && weight) {
    if (bind) p = times(bind, 0, p);
    const sum = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const v = times(array, base + layout.jointsAt + index[k] * 16, p);
      for (let c = 0; c < 3; c++) sum[c] += v[c] * weight[k];
    }
    p = [sum[0], sum[1], sum[2], 1];
  }
  return times(array, base + layout.rootAt, p).slice(0, 3);
}

export function rowNodes(tsl, { map, skinned, bindMatrix = null }) {
  const { Fn, add, attribute, instanceIndex, int, ivec2, mat3, mat4, normalLocal, positionLocal, positionPrevious, tangentLocal, texture, transformNormal, uniform, vec4 } = tsl;
  const rows = texture(map);
  const bind = bindMatrix ? uniform(bindMatrix) : null;
  // a matrix of row `y`, its four texels from `x` on
  const matrixAt = (x, y) => mat4(rows.load(ivec2(x, y)), rows.load(ivec2(x.add(1), y)), rows.load(ivec2(x.add(2), y)), rows.load(ivec2(x.add(3), y)));
  const rootOf = (y) => matrixAt(int(0), y).toConst();

  const position = Fn((builder) => {
    const now = int(instanceIndex).mul(ROWS_AN_INSTANCE).toConst();
    const before = now.add(1).toConst();
    const previous = builder.needsPreviousData();
    const hasNormal = builder.hasGeometryAttribute('normal');
    const hasTangent = hasNormal && builder.hasGeometryAttribute('tangent');
    const root = rootOf(now);

    if (!skinned) {
      if (previous) positionPrevious.assign(rootOf(before).mul(vec4(positionPrevious, 1)).xyz);
      if (hasTangent) tangentLocal.assign(mat3(root).mul(tangentLocal));
      if (hasNormal) normalLocal.assign(transformNormal(normalLocal, root));
      return root.mul(vec4(positionLocal, 1)).xyz;
    }

    const skinIndex = attribute('skinIndex', 'uvec4');
    const skinWeight = attribute('skinWeight', 'vec4');
    // (the root's four texels first, then a joint's four)
    const joint = (index, y) => matrixAt(int(index).mul(TEXELS_A_MATRIX).add(TEXELS_A_MATRIX), y).toConst();
    const jointsOf = (y) => [joint(skinIndex.x, y), joint(skinIndex.y, y), joint(skinIndex.z, y), joint(skinIndex.w, y)];
    // three's getSkinnedPosition: the weights need not sum to one (a file's are bytes), so the sum keeps its own w
    const skin = ([x, y, z, w], p) => {
      const vertex = bind ? bind.mul(vec4(p, 1)) : vec4(p, 1);
      return add(x.mul(skinWeight.x).mul(vertex), y.mul(skinWeight.y).mul(vertex), z.mul(skinWeight.z).mul(vertex), w.mul(skinWeight.w).mul(vertex)).xyz;
    };
    const joints = jointsOf(now);

    if (previous) positionPrevious.assign(rootOf(before).mul(vec4(skin(jointsOf(before), positionPrevious), 1)).xyz);

    if (hasNormal) {
      // three's getSkinnedNormalAndTangent
      let skinMatrix = add(skinWeight.x.mul(joints[0]), skinWeight.y.mul(joints[1]), skinWeight.z.mul(joints[2]), skinWeight.w.mul(joints[3]));
      if (bind) skinMatrix = skinMatrix.mul(bind);
      const skinMatrix3 = mat3(skinMatrix).toConst();
      if (hasTangent) tangentLocal.assign(mat3(root).mul(skinMatrix3.mul(tangentLocal)));
      normalLocal.assign(transformNormal(skinMatrix3.mul(normalLocal), root));
    }

    return root.mul(vec4(skin(joints, positionLocal), 1)).xyz;
  });

  return { rows, position };
}
