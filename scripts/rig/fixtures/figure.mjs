// A toy figure for skin.mjs's tests, made of capsules, a ball and boxes:
// big-headed (a third of its height is head), in an A-pose, facing +z,
// standing on y = 0, with its true joints, so the estimate can be held to
// them. Pure: no file, no randomness.
//
//   figure({ H = 1.4, arm = 35, robe = false, turn = 0 }) → { positions, indices, joints }
//     arm: degrees below the horizontal the arms hang at; robe: a skirt
//     from the hips to the ankles round the legs (they can't be seen
//     apart); turn: degrees about +y it's stood at (so it faces elsewhere)
//   docOf(fig) → Promise<Document>: it as a glTF document, one mesh

const TAU = Math.PI * 2;

// a tube from a to b of radius r: rings of `around` points, `along` of them, capped by its ends' points
function tube(out, a, b, r, around = 16, along = 10) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  // two directions across it
  const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const n1 = cross(u, ref);
  const l1 = Math.hypot(...n1);
  const v1 = n1.map((v) => v / l1);
  const v2 = cross(u, v1);
  const base = out.positions.length / 3;
  for (let i = 0; i <= along; i++) {
    const t = i / along;
    for (let j = 0; j < around; j++) {
      const ang = (j / around) * TAU;
      const [c, s] = [Math.cos(ang) * r, Math.sin(ang) * r];
      out.positions.push(a[0] + d[0] * t + v1[0] * c + v2[0] * s, a[1] + d[1] * t + v1[1] * c + v2[1] * s, a[2] + d[2] * t + v1[2] * c + v2[2] * s);
    }
  }
  for (let i = 0; i < along; i++)
    for (let j = 0; j < around; j++) {
      const p = base + i * around + j;
      const q = base + i * around + ((j + 1) % around);
      out.indices.push(p, q, p + around, q, q + around, p + around);
    }
  // the ends closed with a point each
  for (const [k, end] of [
    [0, a],
    [along, b],
  ]) {
    const c = out.positions.length / 3;
    out.positions.push(...end);
    for (let j = 0; j < around; j++) {
      const p = base + k * around + j;
      const q = base + k * around + ((j + 1) % around);
      if (k === 0) out.indices.push(c, q, p);
      else out.indices.push(c, p, q);
    }
  }
}

// a ball of radius r at c
function ball(out, c, r, rings = 14, around = 20) {
  const base = out.positions.length / 3;
  for (let i = 0; i <= rings; i++) {
    const th = (i / rings) * Math.PI;
    for (let j = 0; j < around; j++) {
      const ph = (j / around) * TAU;
      out.positions.push(c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.cos(th), c[2] + r * Math.sin(th) * Math.sin(ph));
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < around; j++) {
      const p = base + i * around + j;
      const q = base + i * around + ((j + 1) % around);
      out.indices.push(p, p + around, q, q, p + around, q + around);
    }
}

// a box from lo to hi, its faces subdivided so slices find points in it
function box(out, lo, hi, n = 4) {
  for (let axis = 0; axis < 3; axis++)
    for (const side of [0, 1]) {
      const base = out.positions.length / 3;
      const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
      for (let i = 0; i <= n; i++)
        for (let j = 0; j <= n; j++) {
          const p = [0, 0, 0];
          p[axis] = side ? hi[axis] : lo[axis];
          p[u] = lo[u] + ((hi[u] - lo[u]) * i) / n;
          p[v] = lo[v] + ((hi[v] - lo[v]) * j) / n;
          out.positions.push(...p);
        }
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const p = base + i * (n + 1) + j;
          if (side) out.indices.push(p, p + n + 1, p + 1, p + 1, p + n + 1, p + n + 2);
          else out.indices.push(p, p + 1, p + n + 1, p + 1, p + n + 2, p + n + 1);
        }
    }
}

export function figure({ H = 1.4, arm = 35, robe = false, turn = 0 } = {}) {
  const out = { positions: [], indices: [] };
  const k = (v) => v * H;
  const a = (arm * Math.PI) / 180;
  const J = { L: {}, R: {} };
  J.hips = [0, k(0.32), 0];
  J.neck = [0, k(0.615), 0];
  J.chest = [0, k(0.55), 0];
  // the head: a ball, a third of the height, on a thin neck
  ball(out, [0, k(0.815), 0], k(0.185));
  tube(out, [0, k(0.56), 0], [0, k(0.66), 0], k(0.04));
  // the torso: a fat tube from the hips to the shoulders
  tube(out, [0, k(0.26), 0], [0, k(0.585), 0], k(0.105), 24, 16);
  for (const s of [1, -1]) {
    const side = s > 0 ? J.L : J.R;
    side.shoulder = [s * k(0.09), k(0.565), 0];
    const dir = [s * Math.cos(a), -Math.sin(a), 0];
    const along = (l) => side.shoulder.map((v, j) => v + dir[j] * k(l));
    side.elbow = along(0.13);
    side.wrist = along(0.25);
    side.tip = along(0.3);
    tube(out, side.shoulder, side.wrist, k(0.03), 14, 14);
    tube(out, side.wrist, side.tip, k(0.026), 12, 4);
    side.hip = [s * k(0.065), k(0.28), 0];
    side.ankle = [s * k(0.07), k(0.06), 0];
    side.knee = [s * k(0.0675), k(0.17), 0];
    tube(out, side.hip, side.ankle, k(0.042), 16, 14);
    // the foot: a box from behind the ankle to the toes
    box(out, [s * k(0.07) - k(0.03), 0, -k(0.04)], [s * k(0.07) + k(0.03), k(0.06), k(0.09)]);
  }
  if (robe) tube(out, [0, k(0.3), 0], [0, k(0.05), 0], k(0.15), 32, 12);
  J.H = H;
  J.top = [0, H, 0];
  if (turn) {
    const t = (turn * Math.PI) / 180;
    const [c, s] = [Math.cos(t), Math.sin(t)];
    for (let i = 0; i < out.positions.length; i += 3) {
      const [x, z] = [out.positions[i], out.positions[i + 2]];
      out.positions[i] = c * x + s * z;
      out.positions[i + 2] = -s * x + c * z;
    }
  }
  return { positions: Float32Array.from(out.positions), indices: Uint32Array.from(out.indices), joints: J };
}



// the figure as a glTF document (gltf-transform's), one mesh, one material
export async function docOf(fig) {
  const { Document } = await import('@gltf-transform/core');
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(fig.positions).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(fig.indices).setBuffer(buf))
    .setMaterial(doc.createMaterial('toy'));
  doc.createScene().addChild(doc.createNode('toy').setMesh(doc.createMesh('toy').addPrimitive(prim)));
  return doc;
}
