// A coarse cell's proxy, merged (lane N4): each instance's last-LOD triangles
// moved into the cell's frame and appended to its material's group, so a
// cell is a few draws however many things stand in it. Pure arithmetic over
// plain arrays; the CLI (scripts/bf2017-horizon.mjs) reads the GLBs,
// simplifies the groups and writes the cell.
//
//   compose([x, y, z], [qx, qy, qz, qw], [sx, sy, sz]) → a 4 × 4 matrix (column-major, as glTF's)
//   multiply(a, b) → a × b
//   mergeInto(group, { position, normal, uv, index }, m) → group, its arrays grown
//   newGroup() → { position: [], normal: [], uv: [], index: [] }
//
// A matrix that mirrors (its determinant below 0) turns the triangles inside
// out; their winding is flipped as they are appended, so the proxy's faces
// face out, as the scene's mirrored instances do (levelScene.js's flipped).

export const newGroup = () => ({ position: [], normal: [], uv: [], index: [] });

export function compose([x, y, z], [qx, qy, qz, qw], [sx, sy, sz]) {
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;
  return [(1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0, (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0, (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0, x, y, z, 1];
}

export function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

const det3 = (m) => m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);

// the normals' matrix: the inverse transpose of the upper 3 × 3 (a scale
// that is not uniform leans a normal the other way from its surface)
function normalMatrix(m) {
  const d = det3(m) || 1;
  const [a, b, c, e, f, g, h, i, j] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  // (cofactors, which are the inverse transpose times the determinant)
  return [(f * j - g * i) / d, (g * h - e * j) / d, (e * i - f * h) / d, (c * i - b * j) / d, (a * j - c * h) / d, (b * h - a * i) / d, (b * g - c * f) / d, (c * e - a * g) / d, (a * f - b * e) / d];
}

export function mergeInto(group, { position, normal = null, uv = null, index = null }, m) {
  const base = group.position.length / 3;
  const n = position.length / 3;
  const nm = normalMatrix(m);
  for (let v = 0; v < n; v++) {
    const [x, y, z] = [position[v * 3], position[v * 3 + 1], position[v * 3 + 2]];
    group.position.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    if (normal) {
      const [a, b, c] = [normal[v * 3], normal[v * 3 + 1], normal[v * 3 + 2]];
      const nx = nm[0] * a + nm[3] * b + nm[6] * c;
      const ny = nm[1] * a + nm[4] * b + nm[7] * c;
      const nz = nm[2] * a + nm[5] * b + nm[8] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      group.normal.push(nx / l, ny / l, nz / l);
    } else group.normal.push(0, 1, 0);
    if (uv) group.uv.push(uv[v * 2], uv[v * 2 + 1]);
    else group.uv.push(0, 0);
  }
  const idx = index ?? Array.from({ length: n }, (_, k) => k);
  const flip = det3(m) < 0;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    if (flip) group.index.push(base + idx[t], base + idx[t + 2], base + idx[t + 1]);
    else group.index.push(base + idx[t], base + idx[t + 1], base + idx[t + 2]);
  }
  return group;
}
