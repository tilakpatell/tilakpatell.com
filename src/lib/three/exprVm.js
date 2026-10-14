// The EA expression VM of Star Wars Battlefront II (2017), as the site runs
// it: the bytecode the game's ANT rig ops are compiled to (an
// ExpressionAsset's kernel, the game's interpreter at 0x149c477c0, opcode
// table 0x143ad1070), here a kernel decoded by bf2-re's tools/rig-export.py
// (src/data/bf2017/rig/*.json) and walked record by record exactly as
// bf2-re's reference evaluator tools/expr_eval.py walks it, with the
// expression functions it calls re-implemented from their decompiles
// (bf2-re data/ghidra-out-named/src/_exprvm/impl/; findings/52, findings/57).
// This file follows expr_eval.py line for line; exprVm.test.js holds it to
// that evaluator's writes on the Walrus bind pose and two bent poses.
//
// Conventions (expr_eval.py's, checked against the decompiles): matrices are
// 16 floats row-major with row vectors (p' = p · M; world = local · parent);
// quaternions (x, y, z, w), Hamilton products, inverse = conjugate; Euler in
// radians, EulerToQuaternion = Qz ⊗ Qy ⊗ Qx. The pose is the ANT pose: one
// value a DOF ('Bone.q', 'Bone.t', 'Bone.s'), each bone's local transform,
// which on a 2017 figure is its three.js bone's own quaternion, position and
// scale (the export keeps the game's numbers: walrus.glb's local TRS are the
// skeleton asset's LocalPose).
//
//   loadKernel(json) → kernel (the consts unpacked, the records by offset)
//   createMachine(kernel, { pose }) → { run(), mem, writes }
//     pose: { get(dof, n) → number[] | null, set(dof, values) } (a DOF the
//     pose lacks reads the kernel's own value register, as the game does)
//   FUNCS: the expression functions by name; a kernel calling one not here
//     leaves that call's outputs as they were (kernel.unported names them)

const EPS = 1.52587890625e-5; // (2^-16: the decompiles' small-number guard)
const END = 0x80000000;

// ── vector helpers (expr_eval.py's) ──

export function qmul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [bz * ay - by * az + bx * aw + ax * bw, bx * az - bz * ax + by * aw + ay * bw, by * ax - bx * ay + bz * aw + az * bw, bw * aw - (bz * az + by * ay + bx * ax)];
}
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
function qrotRows(q) {
  const [x, y, z, w] = q;
  return [
    [1 - 2 * y * y - 2 * z * z, 2 * x * y + 2 * w * z, 2 * x * z - 2 * w * y],
    [2 * x * y - 2 * w * z, 1 - 2 * x * x - 2 * z * z, 2 * w * x + 2 * y * z],
    [2 * w * y + 2 * x * z, 2 * y * z - 2 * w * x, 1 - 2 * x * x - 2 * y * y],
  ];
}
export function compose(s, q, t) {
  const r = qrotRows(q);
  return [r[0][0] * s[0], r[0][1] * s[0], r[0][2] * s[0], 0, r[1][0] * s[1], r[1][1] * s[1], r[1][2] * s[1], 0, r[2][0] * s[2], r[2][1] * s[2], r[2][2] * s[2], 0, t[0], t[1], t[2], 1];
}
// (rows of a pure rotation to a quaternion: the game's branch order)
function matToQuat(r0, r1, r2) {
  const [m00, m01, m02] = r0;
  const [m10, m11, m12] = r1;
  const [m20, m21, m22] = r2;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1);
    const f = 0.5 / s;
    return [(m12 - m21) * f, (m20 - m02) * f, (m01 - m10) * f, 0.5 * s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(m00 - (m22 + m11) + 1);
    const f = 0.5 / s;
    return [0.5 * s, (m01 + m10) * f, (m20 + m02) * f, (m12 - m21) * f];
  }
  if (m11 > m22) {
    const s = Math.sqrt(m11 - (m00 + m22) + 1);
    const f = 0.5 / s;
    return [(m01 + m10) * f, 0.5 * s, (m12 + m21) * f, (m20 - m02) * f];
  }
  const s = Math.sqrt(m22 - (m11 + m00) + 1);
  const f = 0.5 / s;
  return [(m20 + m02) * f, (m21 + m12) * f, 0.5 * s, (m01 - m10) * f];
}
export function decompose(m) {
  const rows = [m.slice(0, 3), m.slice(4, 7), m.slice(8, 11)];
  const s = rows.map((r) => Math.hypot(r[0], r[1], r[2]));
  if (Math.min(...s) <= EPS) return [s, [0, 0, 0, 1], m.slice(12, 15)];
  const rn = rows.map((r, i) => r.map((v) => v / s[i]));
  return [s, matToQuat(rn[0], rn[1], rn[2]), m.slice(12, 15)];
}
export function matmul(a, b) {
  const o = new Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) o[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
  return o;
}
// (Gauss-Jordan with partial pivoting; a singular matrix inverts to the identity, as the evaluator's)
export function matinv(m) {
  const a = [0, 1, 2, 3].map((i) => m.slice(i * 4, i * 4 + 4));
  const inv = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)));
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-20) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    [a[c], a[p]] = [a[p], a[c]];
    [inv[c], inv[p]] = [inv[p], inv[c]];
    const f = a[c][c];
    a[c] = a[c].map((v) => v / f);
    inv[c] = inv[c].map((v) => v / f);
    for (let r = 0; r < 4; r++)
      if (r !== c && a[r][c] !== 0) {
        const g = a[r][c];
        a[r] = a[r].map((x, i) => x - g * a[c][i]);
        inv[r] = inv[r].map((x, i) => x - g * inv[c][i]);
      }
  }
  return inv.flat();
}
export function e2q(e) {
  const [hx, hy, hz] = [0.5 * e[0], 0.5 * e[1], 0.5 * e[2]];
  const [sx, sy, sz] = [Math.sin(hx), Math.sin(hy), Math.sin(hz)];
  const [cx, cy, cz] = [Math.cos(hx), Math.cos(hy), Math.cos(hz)];
  return [cy * cz * sx - sy * sz * cx, sy * cz * cx + cy * sz * sx, cy * sz * cx - sy * cz * sx, cy * cz * cx + sy * sz * sx];
}
function q2e(q) {
  const [x, y, z, w] = q;
  const r00 = 1 - 2 * y * y - 2 * z * z;
  const r01 = 2 * x * y + 2 * w * z;
  const c = Math.sqrt(r00 * r00 + r01 * r01);
  const sy = -(2 * x * z - 2 * w * y);
  if (c <= 0.001) return [Math.atan2(-(2 * y * z - 2 * w * x), 1 - 2 * x * x - 2 * z * z), Math.atan2(sy, c), 0];
  return [Math.atan2(2 * w * x + 2 * y * z, 1 - 2 * x * x - 2 * y * y), Math.atan2(sy, c), Math.atan2(r01, r00)];
}
const norm3 = (v) => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 0];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function wsAim(p, target, up) {
  let a = [target[0] - p[0], target[1] - p[1], target[2] - p[2]];
  let u = [up[0] - p[0], up[1] - p[1], up[2] - p[2]];
  if (dot3(a, a) <= EPS || dot3(u, u) <= EPS) return [0, 0, 0, 1];
  a = norm3(a);
  u = norm3(u);
  if (Math.abs(dot3(a, u)) >= 0.9999847412109375) return [0, 0, 0, 1];
  const s = norm3(cross(a, u));
  const t = cross(s, a);
  return matToQuat(a, t, s);
}
function nlerp(a, b, t) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const r = d > 0 ? a.map((x, i) => x + (b[i] - x) * t) : a.map((x, i) => x - (b[i] + x) * t);
  const n = Math.hypot(...r) || 1;
  return r.map((v) => v / n);
}

// ── the kernel and the machine ──

export function loadKernel(json) {
  const bin = typeof atob === 'function' ? atob(json.consts) : globalThis.Buffer.from(json.consts, 'base64').toString('binary');
  const consts = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) consts[i] = bin.charCodeAt(i);
  const recs = new Map(json.code.map((r) => [r.at, r]));
  const unported = [...new Set(json.code.filter((r) => r.fn && !FUNCS[r.fn]).map((r) => r.fn))];
  return { ...json, consts, recs, unported };
}

// (callv's in/out split by opcode: expr_eval.py's table)
const SPLIT = { 0x0a: 1, 0x0b: 1, 0x0c: 1, 0x0d: 1, 0x0e: 2, 0x0f: 2, 0x10: 3, 0x11: 3, 0x12: 4, 0x13: 4 };

export function createMachine(kernel, { pose } = {}) {
  const regions = new Map([
    [0, new DataView(kernel.consts.slice().buffer)],
    [1, new DataView(new ArrayBuffer(kernel.inst + 16))],
    [2, new DataView(new ArrayBuffer(kernel.temp + 16))],
  ]);
  const region = (r) => {
    let v = regions.get(r);
    if (!v) regions.set(r, (v = new DataView(new ArrayBuffer(0x10000))));
    return v;
  };
  const m = {
    kernel,
    pose,
    gamestates: new Map(),
    handles: new Map(), // handle id → DOF name
    writes: [],
    calls: 0,
    rf(op, n) {
      const v = region(op >>> 24);
      const o = op & 0xffffff;
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = v.getFloat32(o + 4 * i, true);
      return out;
    },
    wf(op, vals) {
      const v = region(op >>> 24);
      const o = op & 0xffffff;
      for (let i = 0; i < vals.length; i++) v.setFloat32(o + 4 * i, Number(vals[i]), true);
    },
    ri: (op) => region(op >>> 24).getInt32(op & 0xffffff, true),
    ru: (op) => region(op >>> 24).getUint32(op & 0xffffff, true),
    rh: (op) => region(op >>> 24).getUint16(op & 0xffffff, true),
    wi: (op, x) => region(op >>> 24).setInt32(op & 0xffffff, x | 0, true),
    wu: (op, x) => region(op >>> 24).setUint32(op & 0xffffff, x >>> 0, true),
    rb: (op) => region(op >>> 24).getUint8(op & 0xffffff),
    wb: (op, x) => region(op >>> 24).setUint8(op & 0xffffff, x ? 1 : 0),
    // (a u64 register: the handles and game-state ids are small, the low word holds them)
    r8: (op) => region(op >>> 24).getUint32(op & 0xffffff, true) + region(op >>> 24).getUint32((op & 0xffffff) + 4, true) * 0x100000000,
    w8(op, x) {
      const v = region(op >>> 24);
      v.setUint32(op & 0xffffff, x % 0x100000000, true);
      v.setUint32((op & 0xffffff) + 4, Math.floor(x / 0x100000000), true);
    },
    copy(src, dst, n) {
      const a = region(src >>> 24);
      const b = region(dst >>> 24);
      const so = src & 0xffffff;
      const d = dst & 0xffffff;
      const tmp = new Uint8Array(n);
      for (let i = 0; i < n; i++) tmp[i] = a.getUint8(so + i);
      for (let i = 0; i < n; i++) b.setUint8(d + i, tmp[i]);
    },
    dofGet(hreg, defReg, n) {
      const dof = m.handles.get(m.r8(hreg));
      const v = dof != null ? m.pose?.get(dof, n) : null;
      if (v) {
        const out = v.slice(0, n);
        while (out.length < n) out.push(0);
        return out;
      }
      return m.rf(defReg, n);
    },
    dofSet(hreg, vals) {
      const dof = m.handles.get(m.r8(hreg));
      if (dof == null) return;
      m.pose?.set(dof, vals);
      m.writes.push([dof, vals]);
    },
    // the pose into the kernel's value registers, as the loader does each update
    load() {
      kernel.dofs.forEach(([, dof, hreg, vreg], i) => {
        m.handles.set(i + 1, dof);
        m.w8(hreg, i + 1);
        if (vreg !== 0xffffffff) {
          const v = m.pose?.get(dof, dof.endsWith('.q') ? 4 : 3);
          if (v) m.wf(vreg, v);
        }
      });
      // (each game-state interface holds its asset: an id here, its value the asset's default unless the caller set one)
      (kernel.gamestates ?? []).forEach((g, i) => {
        m.w8(g.reg, 0x1000 + i);
        if (!m.gamestates.has(0x1000 + i)) m.gamestates.set(0x1000 + i, typeof g.default === 'boolean' ? (g.default ? 1 : 0) : g.default);
      });
    },
    // a game state's value by its asset's name (the kernel's gamestates list)
    setState(name, value) {
      (kernel.gamestates ?? []).forEach((g, i) => g.name === name && m.gamestates.set(0x1000 + i, value));
    },
    run(maxSteps = 200000) {
      m.writes = [];
      m.load();
      let pos = 0;
      const stack = [];
      let steps = 0;
      while (pos !== END && steps < maxSteps) {
        steps++;
        const e = kernel.recs.get(pos);
        if (!e) throw new Error(`exprVm: no record at ${pos.toString(16)}`);
        let next = e.n;
        switch (e.k) {
          case 'call':
            m.call(e.fn, e.o, null);
            break;
          case 'callv': {
            const split = SPLIT[e.op];
            m.call(e.fn, null, [e.o.slice(0, split), e.o.slice(split), []]);
            break;
          }
          case 'call3':
            m.call(e.fn, null, e.l);
            break;
          case 'memcpy':
            m.copy(e.o[0], e.o[1], e.o[2]);
            break;
          case 'bfalse':
            if (!m.rb(e.o[0])) next = e.o[1];
            break;
          case 'switch': {
            const w = e.o;
            const v = m.ru(w[0]);
            const n = w[1];
            for (let i = 0; i < n; i++)
              if (v === w[2 + i]) {
                next = w[2 + n + i];
                break;
              }
            break;
          }
          case 'jmpi':
            next = m.ru(e.o[0]);
            break;
          case 'gosub':
            stack.push(next);
            next = e.o[0];
            break;
          case 'ret':
            next = stack.pop();
            break;
          case 'end':
            next = END;
            break;
          case 'nop':
            break;
          default:
            if (e.k.startsWith('mov')) m.copy(e.o[0], e.o[1], 1 << (e.op - 0x14));
            else throw new Error(`exprVm: ${e.k} not handled`);
        }
        pos = next;
      }
      return m;
    },
    call(fn, ops, lists) {
      m.calls++;
      const f = FUNCS[fn];
      if (!f) return; // (unported: its outputs stay as they were)
      if (ops) f(m, ...ops);
      else f(m, lists[0], lists[1], lists[2]);
    },
  };
  return m;
}

// ── the expression functions (expr_eval.py's FUNCS) ──

export const FUNCS = {};
const unary = (name, n, op) => (FUNCS[name] = (m, a, o) => m.wf(o, m.rf(a, n).map(op)));
function binary(name, ca, cb, co, op) {
  FUNCS[name] = (m, a, b, o) => {
    let va = m.rf(a, ca);
    let vb = m.rf(b, cb);
    if (ca === 1 && cb > 1) va = Array(cb).fill(va[0]);
    if (cb === 1 && ca > 1) vb = Array(ca).fill(vb[0]);
    m.wf(o, va.map((x, i) => op(x, vb[i])).slice(0, co));
  };
}
const div = (x, y) => (y !== 0 ? x / y : 0);
for (const [nm, c] of [
  ['Float', 1],
  ['Float2', 2],
  ['Float3', 3],
  ['Float4', 4],
]) {
  binary(`Add${nm}`, c, c, c, (x, y) => x + y);
  binary(`Subtract${nm}`, c, c, c, (x, y) => x - y);
  binary(`Multiply${nm}${nm}${nm}`, c, c, c, (x, y) => x * y);
  binary(`Divide${nm}${nm}${nm}`, c, c, c, div);
  binary(`Min${nm}`, c, c, c, Math.min);
  binary(`Max${nm}`, c, c, c, Math.max);
  unary(`Absolute${nm}`, c, Math.abs);
  unary(`Negate${nm}`, c, (v) => -v);
  if (c > 1) {
    binary(`MultiplyFloat${nm}${nm}`, 1, c, c, (x, y) => x * y);
    binary(`Multiply${nm}Float${nm}`, c, 1, c, (x, y) => x * y);
    binary(`Divide${nm}Float${nm}`, c, 1, c, div);
  }
}
FUNCS.MultiplyFloatFloat3Float3 = (m, a, b, o) => m.wf(o, m.rf(b, 3).map((v) => m.rf(a, 1)[0] * v));
FUNCS.MultiplyFloat3FloatFloat3 = (m, a, b, o) => m.wf(o, m.rf(a, 3).map((v) => v * m.rf(b, 1)[0]));
FUNCS.DivideFloat3FloatFloat3 = (m, a, b, o) => m.wf(o, m.rf(a, 3).map((v) => v / m.rf(b, 1)[0]));
FUNCS.MultiplyFloatFloatFloat = (m, a, b, o) => m.wf(o, [m.rf(a, 1)[0] * m.rf(b, 1)[0]]);
FUNCS.DivideFloatFloatFloat = (m, a, b, o) => m.wf(o, [div(m.rf(a, 1)[0], m.rf(b, 1)[0])]);
FUNCS.DivideFloat3Float = FUNCS.DivideFloat3FloatFloat3;
FUNCS.ClampFloat = (m, x, a, b, o) => {
  const [v, lo, hi] = [m.rf(x, 1)[0], m.rf(a, 1)[0], m.rf(b, 1)[0]];
  m.wf(o, [Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi))]);
};
FUNCS.ClampFloat3 = (m, x, a, b, o) => {
  const [v, lo, hi] = [m.rf(x, 3), m.rf(a, 3), m.rf(b, 3)];
  m.wf(
    o,
    v.map((vi, i) => Math.min(Math.max(vi, Math.min(lo[i], hi[i])), Math.max(lo[i], hi[i]))),
  );
};
FUNCS.RangeChange = (m, x, a, b, c, d, o) => {
  const [vx, va, vb, vc, vd] = [x, a, b, c, d].map((r) => m.rf(r, 1)[0]);
  if (Math.abs(vb - va) <= EPS) return m.wf(o, [vc]);
  const t = Math.min(Math.max((vx - va) / (vb - va), 0), 1);
  m.wf(o, [t * (vd - vc) + vc]);
};
FUNCS.DistanceFloat3 = (m, a, b, o) => {
  const [va, vb] = [m.rf(a, 3), m.rf(b, 3)];
  m.wf(o, [Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2])]);
};
FUNCS.MultiplyFloat44Float44Float44 = (m, a, b, o) => m.wf(o, matmul(m.rf(a, 16), m.rf(b, 16)));
FUNCS.InverseFloat44 = (m, a, o) => m.wf(o, matinv(m.rf(a, 16)));
FUNCS.Matrix44Compose = (m, s, q, t, o) => m.wf(o, compose(m.rf(s, 3), m.rf(q, 4), m.rf(t, 3)));
FUNCS.Matrix44Decompose = (m, a, s, q, t) => {
  const [sv, qv, tv] = decompose(m.rf(a, 16));
  m.wf(s, sv);
  m.wf(q, qv);
  m.wf(t, tv);
};
FUNCS.MultiplyQuaternionQuaternionQuaternion = (m, a, b, o) => m.wf(o, qmul(m.rf(a, 4), m.rf(b, 4)));
FUNCS.InverseQuaternion = (m, a, o) => m.wf(o, qconj(m.rf(a, 4)));
FUNCS.EulerToQuaternion = (m, a, o) => m.wf(o, e2q(m.rf(a, 3)));
FUNCS.QuaternionToEuler = (m, a, o) => m.wf(o, q2e(m.rf(a, 4)));
FUNCS.WSAim = (m, p, tgt, up, o) => m.wf(o, wsAim(m.rf(p, 3), m.rf(tgt, 3), m.rf(up, 3)));
FUNCS.Aim = FUNCS.WSAim;
FUNCS.EqualsInt = (m, a, b, o) => m.wb(o, m.ri(a) === m.ri(b));
FUNCS.DofReader = (m, ins, outs) => m.wf(outs[0], m.dofGet(ins[1], ins[2], m.rb(ins[3]) >> 2));
FUNCS.DofWriter = (m, ins) => m.dofSet(ins[1], m.rf(ins[2], m.rb(ins[3]) >> 2));
FUNCS.WorldJointReader = (m, ins, outs) => {
  let M = m.rf(ins[1], 16);
  const count = m.rh(ins[2]);
  for (let j = 0; j < count; j++) {
    const [sh, qh, th, sd, qd, td] = ins.slice(3 + 6 * j, 9 + 6 * j);
    M = matmul(compose(m.dofGet(sh, sd, 3), m.dofGet(qh, qd, 4), m.dofGet(th, td, 3)), M);
  }
  const [sv, qv, tv] = decompose(M);
  m.wf(outs[0], sv);
  m.wf(outs[1], qv);
  m.wf(outs[2], tv);
  m.wf(outs[3], M);
};
FUNCS.WorldJointWriter = (m, ins) => {
  const local = matmul(m.rf(ins[2], 16), matinv(m.rf(ins[1], 16)));
  const [s, q, t] = decompose(local);
  m.dofSet(ins[3], s);
  m.dofSet(ins[4], q);
  m.dofSet(ins[5], t);
};
FUNCS.RootJointReader = (m, ins, outs) => {
  const has = (h) => m.pose?.get(m.handles.get(m.r8(h)), 1) != null;
  const s = m.dofGet(ins[2], ins[3], 3);
  const q = has(ins[4]) ? m.dofGet(ins[4], ins[3], 4) : [0, 0, 0, 1];
  const t = has(ins[5]) ? m.dofGet(ins[5], ins[3], 3) : [0, 0, 0];
  const M = compose(s, q, t);
  const [sv, qv, tv] = decompose(M);
  m.wf(outs[0], sv);
  m.wf(outs[1], qv);
  m.wf(outs[2], tv);
  m.wf(outs[3], M);
};
FUNCS.InterpolateQuaternion = (m, a, b, t, o) => m.wf(o, nlerp(m.rf(a, 4), m.rf(b, 4), m.rf(t, 1)[0]));
FUNCS.NLerpQuat = (m, a, b, t, o) => m.wf(o, nlerp(m.rf(a, 4), m.rf(b, 4), Math.min(Math.max(m.rf(t, 1)[0], 0), 1)));
FUNCS.InterpolateFloat3 = (m, a, b, t, o) => {
  const k = m.rf(t, 1)[0];
  const vb = m.rf(b, 3);
  m.wf(
    o,
    m.rf(a, 3).map((x, i) => x + (vb[i] - x) * k),
  );
};
FUNCS.InterpolateFloat = (m, a, b, t, o) => {
  const x = m.rf(a, 1)[0];
  m.wf(o, [x + (m.rf(b, 1)[0] - x) * m.rf(t, 1)[0]]);
};
FUNCS.TransformFloat44 = (m, v, M, o) => {
  const p = [...m.rf(v, 3), 1];
  const mm = m.rf(M, 16);
  m.wf(
    o,
    [0, 1, 2, 3].map((j) => p[0] * mm[j] + p[1] * mm[4 + j] + p[2] * mm[8 + j] + p[3] * mm[12 + j]),
  );
};
FUNCS.CrossVec3 = (m, a, b, o) => m.wf(o, cross(m.rf(a, 3), m.rf(b, 3)));
FUNCS.DotFloat3 = (m, a, b, o) => m.wf(o, [dot3(m.rf(a, 3), m.rf(b, 3))]);
FUNCS.NormalizeFloat3 = (m, a, o) => m.wf(o, norm3(m.rf(a, 3)));
FUNCS.MagnitudeFloat3 = (m, a, o) => m.wf(o, [Math.hypot(...m.rf(a, 3))]);
FUNCS.AddFloat44 = (m, a, b, o) => {
  const vb = m.rf(b, 16);
  m.wf(
    o,
    m.rf(a, 16).map((x, i) => x + vb[i]),
  );
};
FUNCS.GreaterThanFloat = (m, a, b, o) => m.wb(o, m.rf(a, 1)[0] > m.rf(b, 1)[0]);
FUNCS.GreaterThanOrEqualsFloat = (m, a, b, o) => m.wb(o, m.rf(a, 1)[0] >= m.rf(b, 1)[0]);
FUNCS.LessThanFloat = (m, a, b, o) => m.wb(o, m.rf(a, 1)[0] < m.rf(b, 1)[0]);
FUNCS.LessThanOrEqualsFloat = (m, a, b, o) => m.wb(o, m.rf(a, 1)[0] <= m.rf(b, 1)[0]);
FUNCS.EqualsFloat = (m, a, b, o) => m.wb(o, m.rf(a, 1)[0] === m.rf(b, 1)[0]);
FUNCS.GreaterThanInt = (m, a, b, o) => m.wb(o, m.ri(a) > m.ri(b));
FUNCS.NotEqualsInt = (m, a, b, o) => m.wb(o, m.ri(a) !== m.ri(b));
FUNCS.AddInt = (m, a, b, o) => m.wi(o, m.ri(a) + m.ri(b));
FUNCS.IntToFloat = (m, a, o) => m.wf(o, [m.ri(a)]);
FUNCS.ClampInt = (m, x, a, b, o) => {
  const [v, lo, hi] = [m.ri(x), m.ri(a), m.ri(b)];
  m.wi(o, Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi)));
};
FUNCS.And = (m, a, b, o) => m.wb(o, m.rb(a) && m.rb(b));
FUNCS.Or = (m, a, b, o) => m.wb(o, m.rb(a) || m.rb(b));
FUNCS.Not = (m, a, o) => m.wb(o, !m.rb(a));
FUNCS.OrMulti = (m, a, b, c, d, e, o) => m.wb(o, [a, b, c, d, e].some((r) => m.rb(r)));
FUNCS.AndMulti = (m, a, b, c, d, e, o) => m.wb(o, [a, b, c, d, e].every((r) => m.rb(r)));
FUNCS.EqualsBool = (m, a, b, o) => m.wb(o, Boolean(m.rb(a)) === Boolean(m.rb(b)));
FUNCS.OrientationToLocalAxes = (m, q, ox, oy, oz) => {
  const r = qrotRows(m.rf(q, 4));
  m.wf(ox, [...r[0], 0]);
  m.wf(oy, [...r[1], 0]);
  m.wf(oz, [...r[2], 0]);
};
FUNCS.NormalizeAngleZeroToTwoPi = (m, a, o) => {
  const v = m.rf(a, 1)[0] % (2 * Math.PI);
  m.wf(o, [v < 0 ? v + 2 * Math.PI : v]);
};
FUNCS.NormalizeAngleMinusPiToPi = (m, a, o) => {
  const v = (m.rf(a, 1)[0] + Math.PI) % (2 * Math.PI);
  m.wf(o, [(v < 0 ? v + 2 * Math.PI : v) - Math.PI]);
};
// (the game's LCG, x · 0x41c64e6d + 0x3039, its high half over [-1, 1))
FUNCS.RandomFloat = (m, seed, o, init, state, last) => {
  if (!m.rb(init) || m.ri(last) !== m.ri(seed)) {
    m.wb(init, 1);
    m.wi(last, m.ri(seed));
    m.wi(state, m.ri(seed));
  }
  const v = (BigInt(m.ru(state)) * 0x41c64e6dn + 0x3039n) & 0xffffffffffffffffn;
  m.wu(state, Number(v & 0xffffffffn));
  m.wf(o, [Number((v >> 16n) & 0xffffn) / 32768 - 1]);
};
// (game-state interfaces: ins[0] holds the interface's asset id, its value the caller's or the asset's default)
const gsRead = (kind) => (m, ins, outs) => {
  const v = m.gamestates.get(m.r8(ins[0])) ?? 0;
  if (kind === 'b') m.wb(outs[0], v);
  else if (kind === 'f') m.wf(outs[0], [Number(v)]);
  else if (kind === 'i') m.wi(outs[0], Number(v));
  else m.wf(outs[0], Array.isArray(v) && v.length ? v : [0, 0, 0, 0]);
};
FUNCS.IBoolReader = gsRead('b');
FUNCS.IFloatReader = gsRead('f');
FUNCS.IIntegerReader = gsRead('i');
FUNCS.IVector3Reader = gsRead('v');
for (const w of ['IBoolWriter', 'IFloatWriter', 'IIntegerWriter', 'IVector3Writer']) FUNCS[w] = () => {};
FUNCS.LinearSpringFilter = (m, x, k, c, dt, o, pos, vel, init) => {
  const xv = m.rf(x, 1)[0];
  if (!m.rb(init)) {
    m.wf(pos, [xv]);
    m.wf(vel, [0]);
    m.wb(init, 1);
  }
  const h = m.rf(dt, 1)[0];
  const inv = Math.abs(h) >= EPS ? 1 / h : 1;
  const kk = m.rf(k, 1)[0];
  if (kk > 0) {
    const p = m.rf(pos, 1)[0];
    const v = m.rf(vel, 1)[0];
    const lim = Math.abs(xv - p);
    const step = Math.min(Math.max(((kk * (xv - p) - v * m.rf(c, 1)[0]) * h + v) * h, -lim), lim);
    const np = p + step;
    m.wf(vel, [(np - p) * inv]);
    m.wf(pos, [np]);
    m.wf(o, [np]);
  } else {
    m.wf(pos, [xv]);
    m.wf(o, [xv]);
  }
};
FUNCS.MotionFilterPositionToLocalSpace = (m, M, k, c, dt, reset, o, init, pos, _unused, vel) => {
  const Mv = m.rf(M, 16);
  const tgt = Mv.slice(12, 16);
  const h = m.rf(dt, 1)[0];
  const inv = Math.abs(h) >= EPS ? 1 / h : 1;
  if (!m.rb(init) || m.rb(reset)) {
    m.wf(pos, tgt);
    m.wb(init, 1);
  }
  const p = m.rf(pos, 4);
  const v = m.rf(vel, 4);
  const kk = m.rf(k, 1)[0];
  const cc = m.rf(c, 1)[0];
  let np = tgt.slice();
  if (kk > 0) {
    const d = tgt.map((x, i) => x - p[i]);
    const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    let step = d.map((di, i) => ((kk * di - cc * v[i]) * h + v[i]) * h);
    if (dd > EPS) {
      const ss = step[0] * step[0] + step[1] * step[1] + step[2] * step[2];
      // (never past the target: the step cut to |target − pos|)
      if (dd < ss) {
        const f = Math.sqrt(dd) / Math.sqrt(ss);
        step = step.map((x) => x * f);
      }
      np = p.map((x, i) => x + step[i]);
    } else np = p;
  }
  m.wf(
    vel,
    np.map((x, i) => (x - p[i]) * inv),
  );
  m.wf(pos, np);
  const im = matinv(Mv);
  const q = [np[0], np[1], np[2], 1];
  m.wf(
    o,
    [0, 1, 2, 3].map((j) => q[0] * im[j] + q[1] * im[4 + j] + q[2] * im[8 + j] + q[3] * im[12 + j]),
  );
};
FUNCS.IncDec = (m, up, init, inc, dec, lo, hi, _x, o, state, flag) => {
  if (!m.rb(flag)) {
    m.wf(state, m.rf(init, 1));
    m.wb(flag, 1);
  }
  const v = Math.min(Math.max(m.rf(state, 1)[0] + (m.rb(up) ? m.rf(inc, 1)[0] : -m.rf(dec, 1)[0]), m.rf(lo, 1)[0]), m.rf(hi, 1)[0]);
  m.wf(state, [v]);
  m.wf(o, [v]);
};
