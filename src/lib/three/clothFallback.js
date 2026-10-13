// A 2017 figure's cloth drawn on its fallback skin. The game simulates its
// kamas, capes and robes (a ClothObjectBlueprint: an EACloth sim mesh and a
// wrapping onto the render mesh, 105 of them in the drop) and skins them to
// the leg bones only for when the sim is off; the site has no cloth yet, so
// that skin is what it draws, and a panel whose left half hangs from the left
// leg and right half from the right webs between the legs on every stride,
// out to the trailing shin. Re-weighted here: each vertex's weight on either
// leg's chain (thigh, shin, foot and their helpers) is moved to the two
// thighs, shared by where the vertex sits across the body (the left thigh's
// at the left edge, half each at the middle, the right's at the right), and
// LAG of it to the hips, so the panel swings as one sheet with the thighs
// and never follows a shin. The rest of a vertex's weights stay as they were.
// The geometry is the file's (every copy of the body shares it), so it is
// done once a geometry.
//
//   CLOTH_PART: the material names of the parts the game simulates (the cape
//     slot every soldier and hero body has: mat_cape, *_cape_*, kama, robe)
//   reskinCloth(mesh) → vertices moved (0: none on the legs, or done before)

import * as THREE from 'three';

export const CLOTH_PART = /cape|kama|robe|skirt/i;
export const LAG = 0.4; // of a vertex's leg weight, to the hips
const LEG = /^(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe|KneeLow|KneeUp|UpLegRoll|KneeRoll|Ankle|Heel_Trans)$/;

const smooth = (t) => t * t * (3 - 2 * t);
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();

export function reskinCloth(mesh) {
  const g = mesh?.geometry;
  const bones = mesh?.skeleton?.bones;
  if (!g || !bones || g.userData.clothFallback) return 0;
  const si = g.attributes.skinIndex;
  const sw = g.attributes.skinWeight;
  const pos = g.attributes.position;
  if (!si || !sw || !pos) return 0;
  const index = new Map(bones.map((b, i) => [b.name, i]));
  const hips = index.get('Hips');
  const left = index.get('LeftUpLeg');
  const right = index.get('RightUpLeg');
  if (hips == null || left == null || right == null) return 0;
  // the thighs at bind, in the mesh's bind frame: the line across the body
  const at = (i) => new THREE.Vector3().setFromMatrixPosition(_m.copy(mesh.skeleton.boneInverses[i]).invert());
  const toBind = mesh.bindMatrixInverse;
  const l = at(left).applyMatrix4(toBind);
  const r = at(right).applyMatrix4(toBind);
  const across = l.clone().sub(r);
  const half = across.length() / 2;
  if (!(half > 1e-4)) return 0;
  across.normalize();
  const mid = l.clone().add(r).multiplyScalar(0.5);
  const leg = bones.map((b) => LEG.test(b.name));
  let moved = 0;
  for (let v = 0; v < pos.count; v++) {
    const w = new Map();
    let onLegs = 0;
    for (let k = 0; k < 4; k++) {
      const b = si.getComponent(v, k);
      const x = sw.getComponent(v, k);
      if (!(x > 0)) continue;
      if (leg[b]) onLegs += x;
      else w.set(b, (w.get(b) ?? 0) + x);
    }
    if (onLegs < 1e-3) continue;
    _p.fromBufferAttribute(pos, v);
    const s = THREE.MathUtils.clamp((_p.sub(mid).dot(across) / half + 1) / 2, 0, 1);
    const t = smooth(s);
    const add = (b, x) => w.set(b, (w.get(b) ?? 0) + x);
    add(hips, onLegs * LAG);
    add(left, onLegs * (1 - LAG) * t);
    add(right, onLegs * (1 - LAG) * (1 - t));
    const top = [...w].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, [, x]) => a + x, 0);
    for (let k = 0; k < 4; k++) {
      si.setComponent(v, k, top[k]?.[0] ?? 0);
      sw.setComponent(v, k, top[k] ? top[k][1] / sum : 0);
    }
    moved++;
  }
  g.userData.clothFallback = true;
  si.needsUpdate = true;
  sw.needsUpdate = true;
  return moved;
}
