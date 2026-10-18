// ../../../towns/edoras/propsShaders.js on the node renderer: the banners
// and the grass in the wind, their vertex patches node hooks on the kit’s
// materials (the kit’s shared clock, U.uTime, followed). Each returns the
// node material, which the kit puts in the old one’s place. The wind’s
// numbers are rounded as the GLSL wrote them (five places).

import {
  abs,
  attribute,
  cos,
  float,
  normalLocal,
  normalize,
  positionGeometry,
  sin,
  vec3,
} from "three/tsl";
import {
  asNode,
  follow,
  instanceMatrixOf,
  onPosition,
} from "../../../../../lib/three/hookNodes";

const F5 = (v) => Number(v.toFixed(5));
const flat = (v) => vec3(F5(v.x), 0, F5(v.z));

// Banners in the wind: each vertex rides a wave running out from the pole,
// bigger the further out it is (aWave: how far out, a phase, how much, the
// cloth's length), the end dipping as the gusts slacken. The normal leans
// with the wave, so the folds catch the light.
export function windBanner(mat, U, WIND, ACROSS) {
  const n = asNode(mat);
  const uTime = follow(U.uTime);
  const W = flat(WIND);
  const A = flat(ACROSS);
  return onPosition(
    n,
    (p) => {
      const aWave = attribute("aWave", "vec4");
      const bk = aWave.x;
      const gust = sin(uTime.mul(0.83).add(aWave.y))
        .mul(sin(uTime.mul(0.37).add(aWave.y.mul(2.1))))
        .mul(0.28)
        .add(0.72);
      const bs1 = uTime.mul(7).sub(bk.mul(8.5)).add(aWave.y);
      const bs2 = uTime.mul(12).sub(bk.mul(17)).add(aWave.y.mul(1.7));
      const bf = sin(bs1).mul(0.7).add(sin(bs2).mul(0.22));
      const bw = bf.mul(bk).mul(aWave.z).mul(gust);
      const bd = bf
        .add(
          cos(bs1)
            .mul(-8.5 * 0.7)
            .sub(cos(bs2).mul(17.0 * 0.22))
            .mul(bk),
        )
        .mul(aWave.z)
        .mul(gust);
      // (objectNormal, as beginnormal_vertex had it, before the morphs)
      normalLocal.assign(normalize(normalLocal.sub(W.mul(bd).div(aWave.w))));
      const t = p.add(A.mul(bw)).sub(W.mul(abs(bw)).mul(0.4));
      const y = t.y
        .add(
          sin(bs1.mul(0.8).add(1.3).add(positionGeometry.y.mul(0.6)))
            .mul(bk)
            .mul(aWave.z)
            .mul(0.35)
            .mul(gust),
        )
        .sub(bk.mul(bk).mul(aWave.w).mul(0.07).mul(gust.negate().add(1.25)));
      return vec3(t.x, y, t.z);
    },
    "edoras-banner",
    { uTime },
  );
}

// Grass (instanced, unturned) bends with the wind, more at the tip, gusting.
export function windGrass(mat, U, WIND, k = 0.5) {
  const n = asNode(mat);
  const uTime = follow(U.uTime);
  return onPosition(
    n,
    (p, builder) => {
      const im = instanceMatrixOf(builder);
      const root = im ? im.element(3).xyz : vec3(0);
      const bend = positionGeometry.y.mul(positionGeometry.y);
      const sway = sin(
        uTime.mul(2.3).add(root.x.mul(0.21)).add(root.z.mul(0.13)),
      )
        .mul(sin(uTime.mul(0.9).add(root.x.mul(0.05))))
        .mul(0.45)
        .add(0.55);
      const gust = sway.add(0.6);
      return vec3(
        p.x.add(float(F5(WIND.x)).mul(bend).mul(F5(k)).mul(gust)),
        p.y.sub(bend.mul(F5(k * 0.25)).mul(sway)),
        p.z.add(float(F5(WIND.z)).mul(bend).mul(F5(k)).mul(gust)),
      );
    },
    `edoras-grass${k}`,
    { uTime },
  );
}
