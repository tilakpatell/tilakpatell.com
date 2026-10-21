// The stages' own landmarks in the site's photo scans. What stages/parts.js
// builds is a primitive in one colour, merged with its stage's others onto
// one flat material: the Last Bridge, Henneth Annûn's window, the quay at
// the Havens, Balin's tomb, all plain colour till now. Each part carries
// what it is made of (`aRole`, parts.js's roleOf: a built shape grey is
// dressed stone, brown is wood; a rough one, a stone of the Ford, is rock),
// and the material wears that scan over its colour at the scan's real size,
// read from the face's own axis (the parts are boxes and cylinders, flat
// faced: a face reads one projection), as coreNodes' dress does a chapter's
// kit. The grain fades by FADE, where a scan's repeat would show.
//
//   wearParts(material, { tier, strength }) → the material (none on low)

import * as THREE from 'three';
import { abs, attribute, cameraPosition, dot, length, mix, normalWorldGeometry, normalize, positionWorld, select, smoothstep, step, texture, uniform, vec3 } from 'three/tsl';
import { coreOf, loadCore } from '../../../lib/three/coreNodes';
import { onColor } from '../../../lib/three/hookNodes';
import { ROLE } from './stages/parts';

const ROLES = ['stone', 'wood', 'rock']; // (ROLE's first three, in its order)
const FADE = [60, 160]; // m: the grain whole to the first, gone by the second
const HUE = 0.3; // how much of a scan's own colour comes through (the rest its light and shade)
const LUMA = vec3(0.2126, 0.7152, 0.0722);

export function wearParts(material, { tier = 'high', strength = 0.5 } = {}) {
  if (!material || tier === 'low') return material;
  // (a blank at each scan's mean till it comes, so nothing changes but the grain when it does)
  const nodes = {};
  const u = ROLES.map((r) => {
    const row = coreOf(r);
    const mean = Math.pow(row?.mean ?? 0.8, 2.2);
    const v = Math.round(255 * (row?.mean ?? 0.8));
    const blank = new THREE.DataTexture(Uint8Array.from([v, v, v, 255]), 1, 1);
    blank.colorSpace = THREE.SRGBColorSpace;
    blank.needsUpdate = true;
    const map = texture(blank);
    const k = uniform(new THREE.Vector2(1 / (row?.metres ?? 2), mean));
    nodes[`${r}Map`] = map;
    nodes[`${r}K`] = k;
    loadCore(r)
      .then((got) => {
        if (got?.map) map.value = got.map;
      })
      .catch(() => {});
    return { map, k, blank };
  });
  const role = attribute('aRole', 'float');
  onColor(
    material,
    (d) => {
      const a = abs(normalize(normalWorldGeometry));
      const p = positionWorld;
      // (the face's own axis: the one its normal lies most along)
      const plane = select(a.x.greaterThan(a.y.max(a.z)), p.zy, select(a.y.greaterThan(a.z), p.xz, p.xy));
      let detail = vec3(1);
      ROLES.forEach((r, i) => {
        const s = u[i].map.sample(plane.mul(u[i].k.x)).rgb.div(u[i].k.y.max(0.05));
        const worn = mix(vec3(dot(s, LUMA)), s, HUE);
        // (this part's role, and no other's)
        detail = mix(detail, worn, step(ROLE[r] - 0.5, role).mul(step(role, ROLE[r] + 0.5)));
      });
      const near = smoothstep(FADE[0], FADE[1], length(p.sub(cameraPosition))).oneMinus();
      return d.rgb.mul(mix(vec3(1), detail, near.mul(strength)));
    },
    'parts:wear',
    nodes,
  );
  material.needsUpdate = true;
  const dispose = material.dispose.bind(material);
  material.dispose = () => {
    for (const { blank } of u) blank.dispose();
    dispose();
  };
  return material;
}
