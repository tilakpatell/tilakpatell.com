// A figure's pose as one row of floats: what a bone texture holds for one
// instance of an instanced skin (rows.js draws from it, skinNode.js reads
// it). A row is the part's own place in the world and then each joint's skin
// matrix, sixteen floats each (four texels of an RGBA32F texture), column by
// column as three's Matrix4 keeps them.
//
// A joint's skin matrix is three's own: bone.matrixWorld × boneInverse, what
// Skeleton.update() leaves in skeleton.boneMatrices. three holds it in the
// world, as float32; a row holds it re-based on the part's root
// (rootInverse × it), and the root itself in the row's first matrix, so the
// shader skins in the part's own frame and the root places the result, as
// three's bindMatrixInverse and the mesh's world matrix do for a skinned
// mesh. The product is worked out here from the bones themselves, in
// JavaScript's doubles, and only the re-based result is stored: near the
// root the floats stay small (a body 1,300 m from the level's origin keeps
// its hundredths of a millimetre, where skeleton.boneMatrices keeps a
// tenth), and one pose can stand under many roots.
//
// Pure: no three.js; a skeleton is read by its shape.
//
//   rowLayout(joints) → { joints, texelsARow, floatsARow, rootAt, jointsAt }
//     (four texels a joint, and four for the root before them)
//   writeRow(array, row, layout, skeleton, rootInverse, root) → void
//     skeleton: { bones: [{ matrixWorld: { elements } }], boneInverses: [{ elements }] }
//     (three's Skeleton, its bones' world matrices up to date), or null for a
//     part with no skin; rootInverse, root: 16 floats each (Matrix4.elements)
//   copyRow(array, layout, from, to) → void (a row's floats, to another row)
//   growRows(array, layout, rows) → Float32Array (what was written kept)

export const TEXELS_A_MATRIX = 4;
const FLOATS = 16;

export function rowLayout(joints) {
  const n = Math.max(0, joints | 0);
  return { joints: n, texelsARow: TEXELS_A_MATRIX * (n + 1), floatsARow: FLOATS * (n + 1), rootAt: 0, jointsAt: FLOATS };
}

// a matrix that only moves: its turn and scale the identity's
const onlyMoves = (m) => m[0] === 1 && m[5] === 1 && m[10] === 1 && m[1] === 0 && m[2] === 0 && m[4] === 0 && m[6] === 0 && m[8] === 0 && m[9] === 0;

export function writeRow(array, row, layout, skeleton, rootInverse, root) {
  const base = row * layout.floatsARow;
  if (root) for (let k = 0; k < FLOATS; k++) array[base + layout.rootAt + k] = root[k];
  if (!skeleton) return;
  const { bones, boneInverses } = skeleton;
  const r = rootInverse;
  const moves = onlyMoves(r);
  const joints = Math.min(layout.joints, bones.length);
  for (let j = 0, at = base + layout.jointsAt; j < joints; j++, at += FLOATS) {
    // bone.matrixWorld × boneInverse, as Skeleton.update() multiplies them: both affine (their last
    // row 0 0 0 1), so twelve sums of three products and the bone's own place
    const a = bones[j].matrixWorld.elements;
    const b = boneInverses[j].elements;
    const a0 = a[0], a1 = a[1], a2 = a[2], a4 = a[4], a5 = a[5], a6 = a[6], a8 = a[8], a9 = a[9], a10 = a[10];
    const m0 = a0 * b[0] + a4 * b[1] + a8 * b[2];
    const m1 = a1 * b[0] + a5 * b[1] + a9 * b[2];
    const m2 = a2 * b[0] + a6 * b[1] + a10 * b[2];
    const m4 = a0 * b[4] + a4 * b[5] + a8 * b[6];
    const m5 = a1 * b[4] + a5 * b[5] + a9 * b[6];
    const m6 = a2 * b[4] + a6 * b[5] + a10 * b[6];
    const m8 = a0 * b[8] + a4 * b[9] + a8 * b[10];
    const m9 = a1 * b[8] + a5 * b[9] + a9 * b[10];
    const m10 = a2 * b[8] + a6 * b[9] + a10 * b[10];
    const m12 = a0 * b[12] + a4 * b[13] + a8 * b[14] + a[12];
    const m13 = a1 * b[12] + a5 * b[13] + a9 * b[14] + a[13];
    const m14 = a2 * b[12] + a6 * b[13] + a10 * b[14] + a[14];
    if (moves) {
      // (a root that only moves, a skin's in rows.js: the joint's place less the root's)
      array[at] = m0;
      array[at + 1] = m1;
      array[at + 2] = m2;
      array[at + 4] = m4;
      array[at + 5] = m5;
      array[at + 6] = m6;
      array[at + 8] = m8;
      array[at + 9] = m9;
      array[at + 10] = m10;
      array[at + 12] = m12 + r[12];
      array[at + 13] = m13 + r[13];
      array[at + 14] = m14 + r[14];
    } else {
      array[at] = r[0] * m0 + r[4] * m1 + r[8] * m2;
      array[at + 1] = r[1] * m0 + r[5] * m1 + r[9] * m2;
      array[at + 2] = r[2] * m0 + r[6] * m1 + r[10] * m2;
      array[at + 4] = r[0] * m4 + r[4] * m5 + r[8] * m6;
      array[at + 5] = r[1] * m4 + r[5] * m5 + r[9] * m6;
      array[at + 6] = r[2] * m4 + r[6] * m5 + r[10] * m6;
      array[at + 8] = r[0] * m8 + r[4] * m9 + r[8] * m10;
      array[at + 9] = r[1] * m8 + r[5] * m9 + r[9] * m10;
      array[at + 10] = r[2] * m8 + r[6] * m9 + r[10] * m10;
      array[at + 12] = r[0] * m12 + r[4] * m13 + r[8] * m14 + r[12];
      array[at + 13] = r[1] * m12 + r[5] * m13 + r[9] * m14 + r[13];
      array[at + 14] = r[2] * m12 + r[6] * m13 + r[10] * m14 + r[14];
    }
    array[at + 3] = 0;
    array[at + 7] = 0;
    array[at + 11] = 0;
    array[at + 15] = 1;
  }
}

export function copyRow(array, layout, from, to) {
  if (from === to) return;
  array.copyWithin(to * layout.floatsARow, from * layout.floatsARow, (from + 1) * layout.floatsARow);
}

export function growRows(array, layout, rows) {
  const out = new Float32Array(rows * layout.floatsARow);
  if (array) out.set(array.length > out.length ? array.subarray(0, out.length) : array);
  return out;
}
