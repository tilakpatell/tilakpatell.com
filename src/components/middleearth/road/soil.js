// A stage’s ground close up: its soil’s photo scans (public/cc0/galaxy/,
// Poly Haven, CC0; lib/three/scansNodes) laid over the ground map’s colour:
// the grass scan where the map grows grass, the road’s where it is worn,
// the rock’s where the land is steep (from the three axes, so a bank is
// never stretched), each at two sizes so it doesn’t tile, mostly its light
// and shade over the map’s colour; and their relief. It fades to the map
// alone with distance. Everything is read in the stage’s own frame
// (positionLocal: the ground is drawn in its stage’s group), so a stage
// placed ahead or behind reads its own map.
//
//   soilHook(material, { groundMap, soil, tier }) → the node material
//     groundMap: groundmapNodes’ map; soil: stages/soils.js’s row; on low
//     the map’s colour alone

import * as THREE from 'three';
import { abs, cameraPosition, cameraViewMatrix, dot, length, mat2, mix, normalWorldGeometry, normalize, positionLocal, positionWorld, pow, smoothstep, texture, uniform, vec3, vec4 } from 'three/tsl';
import { loadScan, scanOf } from '../../../lib/three/scansNodes';
import { asNode, onColor, onNormal } from '../../../lib/three/hookNodes';

const blank = (r, g, b) => {
  const t = new THREE.DataTexture(Uint8Array.from([r, g, b, 255]), 1, 1);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
};
const WHITE = blank(255, 255, 255);
const FLAT = blank(128, 128, 255);
const LUMA = vec3(0.2126, 0.7152, 0.0722);
const ROLES = ['grass', 'road', 'steep'];
const HUE = 0.35; // how much of a scan’s own colour comes through (the rest its light and shade)
const NEAR = 24; // m: the scans whole to here
// m: gone by here (from 120: a two-metre scan's tile, its grain too fine to see
// beyond about forty, still showed its repeat, a lattice over every far slope)
const FAR = 80;
const TURN = mat2(0.8, -0.6, 0.6, 0.8); // (the second size turned, so the two never line up)

export function soilHook(material, { groundMap, soil, tier = 'high' }) {
  const m = asNode(material);
  const at = positionLocal.xz;
  const scans = tier === 'low' ? null : soil?.scans;
  if (!scans) return onColor(m, (d) => d.rgb.mul(groundMap.groundColour(at)), 'soil:map', groundMap.uniforms);

  // each role’s maps (blank till they come) and { 1 / metres, mean (linear), relief }
  const u = {};
  for (const r of ROLES) {
    u[r] = { map: texture(WHITE), normal: texture(FLAT), k: uniform(new THREE.Vector3(0.5, 0.6, 0)) };
    const role = scans[r];
    const row = scanOf(role);
    if (!row) continue;
    loadScan(role).then((got) => {
      if (!got) return;
      u[r].map.value = got.map;
      if (got.normalMap) u[r].normal.value = got.normalMap;
      u[r].k.value.set(1 / (row.metres ?? 2), Math.pow(row.mean ?? 0.8, 2.2), got.normalMap ? 1 : 0);
    });
  }
  const nodes = { ...groundMap.uniforms };
  for (const r of ROLES) Object.assign(nodes, { [`${r}Map`]: u[r].map, [`${r}N`]: u[r].normal, [`${r}K`]: u[r].k });

  const near = () => smoothstep(NEAR, FAR, length(positionWorld.sub(cameraPosition))).oneMinus();
  const steepOf = () => smoothstep(0.32, 0.55, normalize(normalWorldGeometry).y.oneMinus());
  // a scan read flat on the ground at two sizes, over its mean
  const flat = (r, xz) => {
    const { map, k } = u[r];
    const a = map.sample(xz.mul(k.x)).rgb;
    const b = map.sample(TURN.mul(xz).mul(k.x.mul(0.37))).rgb;
    const s = mix(a, a.mul(b).div(k.y.max(0.05)), 0.5).div(k.y.max(0.05));
    return mix(vec3(dot(s, LUMA)), s, HUE);
  };
  // the rock’s scan from the three axes, by which way the ground faces
  const tri = (r, p) => {
    const { map, k } = u[r];
    const w = pow(abs(normalize(normalWorldGeometry)), vec3(4)).toVar();
    w.divAssign(w.x.add(w.y).add(w.z));
    const q = p.mul(k.x);
    const s = map.sample(q.zy).rgb.mul(w.x).add(map.sample(q.xz).rgb.mul(w.y)).add(map.sample(q.xy).rgb.mul(w.z)).div(k.y.max(0.05));
    return mix(vec3(dot(s, LUMA)), s, HUE);
  };

  onColor(
    m,
    (d) => {
      const g = groundMap.groundGrass(at);
      const detail = mix(flat('road', at), flat('grass', at), smoothstep(0.15, 0.85, g)).toVar();
      detail.assign(mix(detail, tri('steep', positionLocal), steepOf()));
      return d.rgb.mul(groundMap.groundColour(at)).mul(mix(vec3(1), detail, near().mul(0.9)));
    },
    'soil',
    nodes,
  );
  // the relief: the ground’s scan’s normal where it lies flat (the rock’s keeps the land’s own)
  onNormal(
    m,
    (normal) => {
      const g = smoothstep(0.15, 0.85, groundMap.groundGrass(at));
      const read = (r) => u[r].normal.sample(at.mul(u[r].k.x)).xyz.mul(2).sub(1).mul(u[r].k.z);
      const t = mix(read('road'), read('grass'), g);
      // (a gentle relief: a strong one sparkled at the distance the grain fades to)
      const k = near().mul(near()).mul(steepOf().oneMinus()).mul(0.5);
      return normalize(normal.add(cameraViewMatrix.mul(vec4(t.x.mul(k), 0, t.y.mul(k), 0)).xyz));
    },
    'soil:relief',
    nodes,
  );
  return m;
}
