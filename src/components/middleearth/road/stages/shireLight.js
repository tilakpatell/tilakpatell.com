// The Shire chapter’s wheat and hedges, drawn lighter for the Road, which
// stands hundreds of each along its lanes (shire/build.js’s are for the
// chapter, which stands fewer, and are not this lane’s to change).
//
//   wheatClump() → BufferGeometry: the chapter’s fourteen stalks greening at
//     the foot and its bearded ears, but a stalk open at its ends (its caps
//     were never seen) and an ear three-sided of two rings. The chapter’s
//     was 504 triangles a clump, and the Shire’s edge stands 712 of them by
//     its fences: 359,000 triangles, most of the stage’s frame; 252 a clump
//     reads the same at a walk.
//   hedgeBlock() → BufferGeometry: the chapter’s metre of hedge, its box in
//     7 × 5 × 5 rows rather than 10 × 7 × 7 and with no underside: 310
//     triangles for 756. Hobbiton’s 186 blocks drew 140,000 in the picture
//     and as many again in the sun’s cascades.
//
// Both carry their colour in their vertices.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TAU, boxUV, cyl, fillColor, foliageColor, lathe, mergeAll, rng, tf } from '../../shire/build';
import { fbm, makeNoise, mix, smooth } from '../../../../lib/paint';

const FOOT = new THREE.Color(0x8a9a4a);
const GOLD = new THREE.Color(0xe0c27a);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function wheatClump() {
  // (the chapter’s seed, so each stalk stands where the chapter’s does)
  const r = rng(12);
  const geos = [];
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.16;
    const h = 0.85 + r() * 0.25;
    const lean = [(r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25];
    const o = { p: [Math.cos(a) * d, 0, Math.sin(a) * d], r: lean };
    const stalk = tf(cyl(0.006, 0.01, h, 3, true), { p: [0, h / 2, 0] });
    fillColor(stalk, (x, y, z, out) => out.lerpColors(FOOT, GOLD, clamp01(y / h)));
    geos.push(tf(stalk, o));
    const ear = tf(lathe([[0.001, 0], [0.022, 0.05], [0.001, 0.15]], 3), { p: [0, h, 0], r: [0, 0, 0.15] });
    geos.push(tf(fillColor(ear, 0xd9b45a), o));
  }
  return mergeAll(geos, { colors: true });
}

export function hedgeBlock() {
  let g = new THREE.BoxGeometry(1.1, 1, 1, 7, 5, 5);
  // (no underside: it stands on the ground, and the cascades see it from above)
  g = withoutFace(g, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  // (the chapter’s shaping, as it is: a rounded crown, sides that lean in, a lumpy face)
  const n = makeNoise(5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const yy = p.getY(i) + 0.5;
    const z = p.getZ(i);
    const across = Math.abs(z) * 2;
    let y = yy * 1.3;
    if (yy > 0.99) y = 1.3 - 0.3 * Math.pow(across, 2.5);
    let zz = z * (1 - 0.14 * yy);
    if (yy > 0.75 && across > 0.99) y = mix(y, y - 0.12, (yy - 0.75) * 4);
    const bump = (fbm(n, (x + 0.55) * 4, yy * 3 + z * 2, { period: 4, octaves: 3 }) - 0.5) * 0.24;
    const out = yy > 0.99 ? [0, 1] : [Math.sign(z), 0];
    zz += out[0] * bump;
    y += out[1] * bump;
    const tuck = smooth(0.4, 0.55, Math.abs(x));
    p.setXYZ(i, x, Math.max(0, y * (1 - 0.015 * tuck)), zz * (1 - 0.05 * tuck));
  }
  g.computeVertexNormals();
  const geo = g.toNonIndexed();
  boxUV(geo, 1.4);
  fillColor(geo, foliageColor(0, 0.55, 0, 0.75, 6));
  return mergeAll([geo], { colors: true });
}

// a BoxGeometry without one of its six faces (three’s order: +x, −x, +y, −y, +z, −z)
function withoutFace(box, face) {
  const { start, count } = box.groups[face];
  const index = [...box.index.array];
  index.splice(start, count);
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(box.attributes)) g.setAttribute(k, a);
  g.setIndex(index);
  return g;
}
