// noiseGlsl.js on the node renderer: the same 3D value noise with analytic
// derivatives, now TSL functions over a seed the caller holds (the GLSL
// declared `uniform vec3 uSeed` inside NOISE; a node material has no shared
// text to declare it in, so each material passes its own uniform node).
// Ported line for line, the hashes included, so a world drawn with it is
// the same picture as the GLSL drew, pixel for pixel.
//
//   noiseWith(uSeed, { octaves }) → { hash13, hash33, noised, noise, fbmd, noised2, fbm }
//     (each a TSL function, built as a function of its own in the shader,
//     not inlined at every call: fbmd's ten octaves of noised would be
//     eighty hashes written out; `octaves` is the GLSL's FBM_OCT)
//   M3, M3T: the turn between octaves and its transpose (mat3 nodes)
//   FBM_OCT: fbmd's most octaves unless asked for more (10)

import * as THREE from "three";
import {
  Break,
  Fn,
  If,
  Loop,
  clamp,
  dot,
  float,
  floor,
  fract,
  mat3,
  mix,
  vec3,
  vec4,
} from "three/tsl";

export const FBM_OCT = 10;

// each octave turned (so the lattice never lines up) and doubled: the
// GLSL's mat3(…) is column by column, as Matrix3.fromArray reads it
const turn = (cols) => mat3(new THREE.Matrix3().fromArray(cols));
export const M3 = turn([0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64]);
export const M3T = turn([0.0, -0.8, -0.6, 0.8, 0.36, -0.48, 0.6, -0.48, 0.64]);

// A fresh set of functions for this seed (and this many octaves): each set
// is its own functions in the shader, so two seeds never share one.
export function noiseWith(uSeed, { octaves = FBM_OCT } = {}) {
  // hashes of lattice points (Dave Hoskins’ “hash without sine”)
  const hash13 = Fn(
    ([p0]) => {
      const p = fract(p0.add(uSeed).mul(0.1031)).toVar();
      p.addAssign(dot(p, p.zyx.add(31.32)));
      return fract(p.x.add(p.y).mul(p.z));
    },
    { p: "vec3", return: "float" },
  );

  const hash33 = Fn(
    ([p0]) => {
      const p = fract(p0.add(uSeed).mul(vec3(0.1031, 0.103, 0.0973))).toVar();
      p.addAssign(dot(p, p.yxz.add(33.33)));
      return fract(p.xxy.add(p.yxx).mul(p.zyx));
    },
    { p: "vec3", return: "vec3" },
  );

  // value noise in -1..1 and its gradient (xyz of .yzw)
  const noised = Fn(
    ([x]) => {
      const i = floor(x).toVar();
      const w = fract(x).toVar();
      const u = w
        .mul(w)
        .mul(w)
        .mul(w.mul(w.mul(6.0).sub(15.0)).add(10.0))
        .toVar();
      const du = float(30.0)
        .mul(w)
        .mul(w)
        .mul(w.mul(w.sub(2.0)).add(1.0))
        .toVar();
      const a = hash13(i).toVar();
      const b = hash13(i.add(vec3(1.0, 0.0, 0.0))).toVar();
      const c = hash13(i.add(vec3(0.0, 1.0, 0.0))).toVar();
      const d = hash13(i.add(vec3(1.0, 1.0, 0.0))).toVar();
      const e = hash13(i.add(vec3(0.0, 0.0, 1.0))).toVar();
      const f = hash13(i.add(vec3(1.0, 0.0, 1.0))).toVar();
      const g = hash13(i.add(vec3(0.0, 1.0, 1.0))).toVar();
      const h = hash13(i.add(vec3(1.0, 1.0, 1.0))).toVar();
      const k1 = b.sub(a).toVar();
      const k2 = c.sub(a).toVar();
      const k3 = e.sub(a).toVar();
      const k4 = a.sub(b).sub(c).add(d).toVar();
      const k5 = a.sub(c).sub(e).add(g).toVar();
      const k6 = a.sub(b).sub(e).add(f).toVar();
      const k7 = a
        .negate()
        .add(b)
        .add(c)
        .sub(d)
        .add(e)
        .sub(f)
        .sub(g)
        .add(h)
        .toVar();
      const v = a
        .add(k1.mul(u.x))
        .add(k2.mul(u.y))
        .add(k3.mul(u.z))
        .add(k4.mul(u.x).mul(u.y))
        .add(k5.mul(u.y).mul(u.z))
        .add(k6.mul(u.z).mul(u.x))
        .add(k7.mul(u.x).mul(u.y).mul(u.z));
      const grad = vec3(
        k1.add(k4.mul(u.y)).add(k6.mul(u.z)).add(k7.mul(u.y).mul(u.z)),
        k2.add(k5.mul(u.z)).add(k4.mul(u.x)).add(k7.mul(u.z).mul(u.x)),
        k3.add(k6.mul(u.x)).add(k5.mul(u.y)).add(k7.mul(u.x).mul(u.y)),
      );
      return vec4(
        float(-1.0).add(float(2.0).mul(v)),
        float(2.0).mul(du).mul(grad),
      );
    },
    { x: "vec3", return: "vec4" },
  );

  // value noise alone (cheaper: clouds, colour variation), -1..1
  const noise = Fn(
    ([x]) => {
      const i = floor(x).toVar();
      const f = fract(x).toVar();
      f.assign(f.mul(f).mul(float(3.0).sub(float(2.0).mul(f))));
      const at = (dx, dy, dz) => hash13(i.add(vec3(dx, dy, dz)));
      const near = mix(
        mix(at(0, 0, 0), at(1, 0, 0), f.x),
        mix(at(0, 1, 0), at(1, 1, 0), f.x),
        f.y,
      );
      const far = mix(
        mix(at(0, 0, 1), at(1, 0, 1), f.x),
        mix(at(0, 1, 1), at(1, 1, 1), f.x),
        f.y,
      );
      return float(-1.0).add(float(2.0).mul(mix(near, far, f.z)));
    },
    { x: "vec3", return: "float" },
  );

  // fbm with its gradient; n octaves, the last one faded in by its fraction
  const fbmd = Fn(
    ([p0, n, gain]) => {
      const p = vec3(p0).toVar();
      const a = float(0.5).toVar();
      const v = float(0.0).toVar();
      const g = vec3(0.0).toVar();
      const J = mat3(new THREE.Matrix3()).toVar();
      Loop(octaves, ({ i }) => {
        const fi = float(i);
        If(fi.greaterThanEqual(n), () => {
          Break();
        });
        const w = a.mul(clamp(n.sub(fi), 0.0, 1.0)).toVar();
        const k = noised(p).toVar();
        v.addAssign(w.mul(k.x));
        g.addAssign(w.mul(J.mul(k.yzw)));
        p.assign(M3.mul(p).mul(2.03));
        J.assign(J.mul(M3T).mul(2.03));
        a.mulAssign(gain);
      });
      return vec4(v, g);
    },
    { p: "vec3", n: "float", gain: "float", return: "vec4" },
  );

  // two octaves of value noise turned against each other (one alone shows
  // its lattice, squared off, wherever it’s cut into lines or coasts)
  const noised2 = Fn(
    ([p]) => {
      const a = noised(p).toVar();
      const b = noised(M3.mul(p).mul(1.7).add(7.3)).toVar();
      return vec4(
        float(0.8).mul(a.x).add(float(0.55).mul(b.x)),
        float(0.8)
          .mul(a.yzw)
          .add(float(0.55).mul(1.7).mul(M3T.mul(b.yzw))),
      );
    },
    { p: "vec3", return: "vec4" },
  );

  // (always ten at most, as the GLSL's: FBM_OCT is fbmd's alone)
  const fbm = Fn(
    ([p0, n]) => {
      const p = vec3(p0).toVar();
      const a = float(0.5).toVar();
      const v = float(0.0).toVar();
      Loop(10, ({ i }) => {
        const fi = float(i);
        If(fi.greaterThanEqual(n), () => {
          Break();
        });
        v.addAssign(a.mul(clamp(n.sub(fi), 0.0, 1.0)).mul(noise(p)));
        p.assign(M3.mul(p).mul(2.03));
        a.mulAssign(0.5);
      });
      return v;
    },
    { p: "vec3", n: "float", return: "float" },
  );

  return { hash13, hash33, noised, noise, fbmd, noised2, fbm };
}
