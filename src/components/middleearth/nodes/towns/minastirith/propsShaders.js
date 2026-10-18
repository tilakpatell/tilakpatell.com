// ../../../towns/minastirith/propsShaders.js on the node renderer: the
// banners’ sway and the houses’ fronts and roofs, the patches line for line
// as node hooks (hookNodes.js). Each returns the node material, and the kit
// uses what it returns.
//
// What runs differently: a node material has no chunks to swap, so where
// the GLSL replaced map_fragment and emissivemap_fragment the twin sets the
// material’s colour and emissive nodes (its colour, emissive and intensity
// read from the material as three’s own nodes read them), and the roof’s
// normal map is perturbed by the slates’ own uv, as perturbNormal2Arb took
// vNormalMapUv (three’s TBN reads the geometry’s uv). The instance’s scale
// comes from its matrix as the GLSL read instanceMatrix.

import * as THREE from 'three';
import {
  Fn,
  abs,
  attribute,
  clamp,
  dFdx,
  dFdy,
  dot,
  float,
  floor,
  fract,
  length,
  materialReference,
  max,
  normalGeometry,
  normalLocal,
  normalView,
  normalize,
  positionView,
  select,
  sign,
  sin,
  smoothstep,
  step,
  texture,
  varying,
  varyingProperty,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { asNode, follow, instanceMatrixOf, keyed, onPosition } from '../../../../../lib/three/hookNodes';

// the instance’s scale, as the GLSL’s hsc (a lone mesh: one)
const scaleOf = (builder) => {
  const im = instanceMatrixOf(builder);
  if (!im) return vec3(1);
  return vec3(length(im.element(0).xyz), length(im.element(1).xyz), length(im.element(2).xyz));
};

// Banners sway: each vertex moves along the cloth's normal, more the further
// it is from the bar it hangs on (aWave: how far down, a phase, how much).
export function swayBanner(mat, U) {
  const n = asNode(mat);
  const uTime = follow(U.uTime);
  const aWave = attribute('aWave', 'vec3');
  onPosition(
    n,
    (p) => {
      const wk = aWave.x;
      const wv = sin(uTime.mul(1.9).add(aWave.y).add(wk.mul(2.6)))
        .mul(0.65)
        .add(sin(uTime.mul(3.7).add(aWave.y.mul(1.7)).add(wk.mul(5.2))).mul(0.25));
      return p.add(normalGeometry.mul(wv).mul(wk).mul(aWave.z));
    },
    'minas-banner',
    { uTime },
  );
  return n;
}

const hh = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');

// The houses, instanced: each a unit box scaled to its size, with offsets in
// metres on top (cornice, parapet, chimney, gables keep their own size). The
// shader paints the front from the atlas by the metre: bays across, storeys
// up, a door or a window or plain wall in each by the house's own dice, and
// lights some windows at night (the emissive map is the glass).
export function houseShader(mat) {
  const n = asNode(mat);
  const aOff = attribute('aOff', 'vec3');
  const aPart = attribute('aPart', 'float');
  const aSeed = attribute('aSeed', 'float');
  const aKind = attribute('aKind', 'float');
  const vM = varyingProperty('vec3', 'vM');
  const vSz = varyingProperty('vec3', 'vSz');
  onPosition(
    n,
    (position, builder) => {
      const hsc = scaleOf(builder);
      const hide = aPart
        .greaterThan(2.5)
        .and(aPart.lessThan(3.5))
        .and(aKind.greaterThan(0.5))
        .or(aPart.greaterThan(4.5).and(aKind.lessThan(0.5)))
        .or(
          aPart
            .greaterThan(3.5)
            .and(aPart.lessThan(4.5))
            .and(fract(aSeed.mul(13.7)).lessThan(0.45)),
        );
      vM.assign(position.mul(hsc).add(aOff));
      vSz.assign(hsc);
      return select(hide, vec3(0, 0.3, 0), position.add(aOff.div(hsc)));
    },
    'minas-house',
  );
  const vLN = varying(normalGeometry, 'vLN');
  const vPart = varying(aPart, 'vPart');
  const vSeed = varying(aSeed, 'vSeed').setInterpolation(THREE.InterpolationSamplingType.FLAT);
  // map_fragment: the front’s cell, and what is painted in it
  const qAn = abs(vLN);
  const top = qAn.y.greaterThan(0.5);
  const sideways = qAn.x.greaterThan(qAn.z);
  const qFm = select(top, vM.xz, select(sideways, vec2(vM.z, vM.y), vec2(vM.x, vM.y)));
  const qFw = select(top, vSz.z, select(sideways, vSz.z, vSz.x));
  const qNb = max(1, floor(qFw.div(2.5).add(0.5)));
  const qHTot = vSz.y.sub(0.34);
  const qSh = clamp(qHTot.div(max(1, floor(qHTot.div(3.2).add(0.5)))), 2.8, 3.6);
  const qNs = floor(qHTot.div(qSh).add(0.01));
  const qGq = vec2(qFm.x.add(qFw.mul(0.5)).div(qFw.div(qNb)), qFm.y.div(qSh));
  const qCl = floor(qGq);
  const qFr = fract(qGq);
  const qSide = select(sideways, select(vLN.x.greaterThan(0), float(0), float(2)), float(1));
  const qSd = floor(vSeed.mul(997).add(0.5));
  const qHr = hh(qCl.add(vec2(qSd.mul(0.37), qSide.mul(11))));
  const qRow = select(qCl.y.lessThan(0.5), float(0), float(1));
  const pick = (cuts, last) => cuts.reduceRight((rest, [at, v]) => select(qHr.lessThan(at), float(v), rest), float(last));
  const front = select(
    qRow.lessThan(0.5),
    pick(
      [
        [0.42, 0],
        [0.66, 1],
        [0.84, 3],
      ],
      2,
    ),
    pick(
      [
        [0.4, 0],
        [0.7, 1],
        [0.88, 3],
      ],
      2,
    ),
  );
  const other = select(qHr.lessThan(0.62), float(2), select(qRow.lessThan(0.5), float(1), pick([[0.82, 0]], 3)));
  const qCol = select(vPart.lessThan(0.5).and(qAn.y.lessThan(0.5)).and(qCl.y.lessThan(qNs)), select(qSide.lessThan(0.5), front, other), float(2));
  const qAuv = vec2(qCol.add(0.004).add(qFr.x.mul(0.992)).div(4), qRow.add(0.004).add(qFr.y.mul(0.992)).div(2));
  const qGd = qGq.div(vec2(4, 2));
  const texel = texture(n.map, qAuv).grad(dFdx(qGd), dFdy(qGd));
  const shade = select(
    vPart.greaterThan(0.5).and(vPart.lessThan(1.5)),
    vec3(1.04),
    select(vPart.greaterThan(1.5).and(vPart.lessThan(2.5)), vec3(0.56, 0.58, 0.62), select(vPart.greaterThan(3.5).and(vPart.lessThan(4.5)), vec3(0.9), vec3(1))),
  );
  const rgb = texel.rgb.mul(shade).mul(smoothstep(0, 2.2, vM.y).mul(0.28).add(0.72));
  n.colorNode = vec4(materialReference('color', 'color').mul(rgb), texel.a);
  // emissivemap_fragment: the glass lit in some windows
  const qLit = step(0.6, hh(qCl.mul(1.7).add(vec2(qSd.mul(0.53), 3)))).mul(select(qCol.greaterThan(1.5).and(qCol.lessThan(2.5)), float(0), float(1)));
  const glass = texture(n.emissiveMap, qAuv).grad(dFdx(qGd), dFdy(qGd)).r;
  n.emissiveNode = materialReference('emissive', 'color').mul(materialReference('emissiveIntensity', 'float')).mul(glass.mul(qLit));
  return keyed(n, 'minas-house:paint');
}

// The houses' pitched roofs: the same instancing, the slopes' normals put
// right for each house's own pitch, slates laid by the metre.
// (EAVE and RIDGE are the unit house’s, in metres: ./props.js builds the
// gables to them)
export function roofShader(mat, { EAVE, RIDGE }) {
  const n = asNode(mat);
  const aOff = attribute('aOff', 'vec3');
  const vMapUv = varyingProperty('vec2', 'vMapUv');
  const ridge = Number(RIDGE.toFixed(2));
  const eave = Number(EAVE.toFixed(2));
  onPosition(
    n,
    (position, builder) => {
      const hsc = scaleOf(builder);
      // beginnormal_vertex: the slopes’ normals, before the instance turns them
      const o = normalGeometry;
      const slope = abs(o.x).greaterThan(0.1).and(abs(o.y).greaterThan(0.1));
      normalLocal.assign(select(slope, normalize(vec3(sign(o.x).mul(ridge), sign(o.y).mul(hsc.x.mul(0.5).add(eave)), 0)).mul(hsc), normalLocal));
      const rm = position.mul(hsc).add(aOff);
      vMapUv.assign(vec2(rm.z, abs(rm.x).mul(1.16)).div(2.6));
      return position.add(aOff.div(hsc));
    },
    'minas-roof',
  );
  n.colorNode = vec4(materialReference('color', 'color').mul(texture(n.map, vMapUv).rgb), texture(n.map, vMapUv).a);
  if (n.normalMap) {
    // perturbNormal2Arb on the slates’ uv
    const q0 = dFdx(positionView);
    const q1 = dFdy(positionView);
    const st0 = dFdx(vMapUv);
    const st1 = dFdy(vMapUv);
    const N = normalView;
    const q1perp = q1.cross(N);
    const q0perp = N.cross(q0);
    const T = q1perp.mul(st0.x).add(q0perp.mul(st1.x));
    const B = q1perp.mul(st0.y).add(q0perp.mul(st1.y));
    const det = max(dot(T, T), dot(B, B));
    const s = select(det.equal(0), float(0), det.inverseSqrt());
    const mapN = texture(n.normalMap, vMapUv).xyz.mul(2).sub(1);
    const xy = mapN.xy.mul(materialReference('normalScale', 'vec2'));
    n.normalNode = normalize(T.mul(s).mul(xy.x).add(B.mul(s).mul(xy.y)).add(N.mul(mapN.z)));
  }
  return n;
}
