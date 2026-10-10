// puffs.js on the node renderer: Bruno Simon's crowns of cards, their
// cut-out turned by the wind and their two tones, as node hooks
// (./hookNodes.js) on node materials, with the same names, arguments and
// uniforms (uniform nodes under the GLSL's names). `wind` is windNodes'
// createWind (its windOffset), `house` houseNodes'. puffGeometry and blob
// are puffs.js's, copied: importing them would bring its GLSL into a
// 'nodes' world's closure.
//
//   createPuffs({ species, count, wind, facing, sun, seed }) → as puffs.js's
//   puffFor(tones, { radius, height, trunk, wind, sun, bark, seed, house }) → { geometry, material }
//   puffGeometry(opts), blob(size)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded } from '../seeded';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { Discard, If, attribute, cos, dot, length, mat2, mix, modelWorldMatrix, normalWorldGeometry, normalize, select, sin, smoothstep, texture as tslTexture, uniform, uv, vec4 } from 'three/tsl';
import { spherifyNormals } from './foliageNodes';
import { instanceMatrixOf, onColor } from './hookNodes';

const TRUNK = 5; // his tree collider is a cylinder 2.5 half-high
const CROWN = 1.9; // the crown's radius at scale 1
const STEM = 0.3; // a far puff's trunk at most this share of its crown's sphere

export function puffGeometry({ cards = 80, size = 0.8, seed = 1 } = {}) {
  const rand = seeded(seed);
  const pos = new Float32Array(cards * 18);
  const uv = new Float32Array(cards * 12);
  const nrm = new Float32Array(cards * 18);
  const h = size / 2;
  const corners = [[-h, -h, 0, 0], [h, -h, 1, 0], [h, h, 1, 1], [-h, -h, 0, 0], [h, h, 1, 1], [-h, h, 0, 1]];
  for (let c = 0; c < cards; c++) {
    // a point in the unit sphere, shell-heavy, and a roll for the card
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const r = 1 - rand() ** 3;
    const s = Math.sqrt(1 - u * u);
    const cx = Math.cos(a) * s * r;
    const cy = u * r;
    const cz = Math.sin(a) * s * r;
    const roll = rand() * Math.PI * 2;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    corners.forEach(([x, y, ux, uy], k) => {
      const o = (c * 6 + k) * 3;
      pos[o] = cx + x * cr - y * sr;
      pos[o + 1] = cy + x * sr + y * cr;
      pos[o + 2] = cz;
      nrm[o + 2] = 1;
      uv[(c * 6 + k) * 2] = ux;
      uv[(c * 6 + k) * 2 + 1] = uy;
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return spherifyNormals(g, { centre: new THREE.Vector3(), radii: new THREE.Vector3(1, 1, 1), keep: 0.15 });
}

// a soft round blob, bright in the middle, for the cards' cut-out
export function blob(size = 64) {
  const px = new Uint8Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const d = Math.hypot((i + 0.5) / size - 0.5, (j + 0.5) / size - 0.5) * 2;
      px[j * size + i] = Math.round(Math.max(0, Math.min(1, 1 - d)) * 255);
    }
  const t = new THREE.DataTexture(px, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// puffShader's lines as node hooks: the cut-out after the map (the blob,
// its UV turned by the wind where the tree stands, a card's fragment gone
// where it's thin), the two tones by the crown's normal to the sun, and a
// trunk's fragment (puffTrunk) bark, never cut out
function puffHooks(m, u, { trunk = false, wind = null } = {}) {
  const tag = `puff${trunk ? ':trunk' : ''}${wind ? '' : ':still'}`;
  onColor(
    m,
    (d, builder) => {
      const flag = trunk ? attribute('puffTrunk', 'float').toVarying('vPuffTrunk') : null;
      const im = instanceMatrixOf(builder);
      const at = modelWorldMatrix.mul(im ? im.mul(vec4(0, 0, 0, 1)) : vec4(0, 0, 0, 1)).xz.toVarying('vPuffXz');
      let puv = uv();
      if (wind) {
        const a = length(wind.windOffset(at)).mul(2.2);
        const q = puv.sub(0.5);
        puv = mat2(cos(a), sin(a).negate(), sin(a), cos(a)).mul(q).add(0.5);
      }
      const cut = u.uPuffBlob.sample(puv).r.sub(0.3);
      const thin = cut.lessThan(0.1);
      If(flag ? thin.and(flag.lessThan(0.5)) : thin, () => Discard());
      const tone = mix(u.uPuffA, u.uPuffB, smoothstep(0, 1, dot(normalize(normalWorldGeometry), normalize(u.uPuffSun))));
      return d.rgb.mul(flag ? select(flag.greaterThan(0.5), u.uPuffBark, tone) : tone);
    },
    tag,
    { ...u, ...(wind?.uniforms ?? {}) },
  );
  return m;
}

export function createPuffs({ species, count = 256, wind, facing = [1, 1, 1], sun = [0.4, 1, 0.3], seed = 1 } = {}) {
  const texture = blob();
  const uniforms = {
    uPuffBlob: tslTexture(texture),
    uPuffA: uniform(new THREE.Color(species.a)),
    uPuffB: uniform(new THREE.Color(species.b)),
    uPuffSun: uniform(new THREE.Vector3(...sun).normalize()),
  };
  const geometry = puffGeometry({ seed });
  // (a white map so three gives the shader its UVs; the blob cuts it out)
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const material = puffHooks(new MeshLambertNodeMaterial({ color: 0xffffff, map: white, side: THREE.DoubleSide }), uniforms, { wind });
  const crowns = new THREE.InstancedMesh(geometry, material, count);
  crowns.name = 'tree crowns';
  crowns.castShadow = true;
  const trunkGeometry = new THREE.CylinderGeometry(0.12, 0.18, TRUNK, 6);
  trunkGeometry.translate(0, TRUNK / 2, 0);
  const trunkMaterial = new MeshLambertNodeMaterial({ color: species.bark });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  trunks.name = 'tree trunks';
  trunks.castShadow = true;
  // every card faces the camera's fixed way: one turn for every crown
  const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...facing).normalize());
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const free = [];
  for (let i = count - 1; i >= 0; i--) {
    free.push(i);
    crowns.setMatrixAt(i, zero);
    trunks.setMatrixAt(i, zero);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    crowns,
    trunks,
    uniforms,
    take() {
      return free.length ? free.pop() : -1;
    },
    set(i, x, y, z, scale = 1, yaw = 0) {
      trunks.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromAxisAngle(up, yaw), s.setScalar(scale)));
      crowns.setMatrixAt(i, m.compose(p.set(x, y + (TRUNK - 0.6) * scale, z), face, s.setScalar(CROWN * scale)));
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
    },
    free(i) {
      crowns.setMatrixAt(i, zero);
      trunks.setMatrixAt(i, zero);
      crowns.instanceMatrix.needsUpdate = true;
      trunks.instanceMatrix.needsUpdate = true;
      free.push(i);
    },
    // (the wind's own update moves the cut-outs)
    update() {},
    dispose() {
      geometry.dispose();
      trunkGeometry.dispose();
      material.dispose();
      trunkMaterial.dispose();
      texture.dispose();
      white.dispose();
    },
  };
}

// shared by every puff puffFor makes, for the page's life: the cut-out, and
// a white map so three gives the shader its UVs
let maps = null;
const shared = () => {
  if (!maps) {
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    maps = { blob: blob(), white };
  }
  return maps;
};

const flagged = (g, v) => g.setAttribute('puffTrunk', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1));

export function puffFor(tones, { radius, height, trunk = 0, wind = null, sun = [0.4, 1, 0.3], bark = [0.16, 0.11, 0.07], seed = 1, house = null } = {}) {
  // the crown: his cards in their unit sphere, scaled and lifted to the tree
  const crown = puffGeometry({ seed });
  crown.computeBoundingBox();
  const { min, max } = crown.boundingBox;
  const p = crown.attributes.position;
  let reach = 0;
  for (let i = 0; i < p.count; i++) reach = Math.max(reach, Math.hypot(p.getX(i), p.getZ(i)));
  const r = Math.min(radius / reach, height / (max.y - min.y));
  const centre = height - r * max.y;
  crown.scale(r, r, r).translate(0, centre, 0);
  // the trunk, open at both ends (its foot is in the ground, its top in the crown)
  const thick = Math.min(trunk, STEM * r);
  const stem = new THREE.CylinderGeometry(thick, thick, centre, 6, 1, true).translate(0, centre / 2, 0).toNonIndexed();
  const geometry = mergeGeometries([flagged(crown, 0), flagged(stem, 1)]);
  crown.dispose();
  stem.dispose();
  geometry.name = 'puff';

  const { blob: cut, white } = shared();
  const uniforms = {
    uPuffBlob: tslTexture(cut),
    uPuffA: uniform(new THREE.Color().fromArray(tones[0])),
    uPuffB: uniform(new THREE.Color().fromArray(tones[1])),
    uPuffSun: uniform(new THREE.Vector3(...sun).normalize()),
    uPuffBark: uniform(new THREE.Color().fromArray(bark)),
  };
  const opts = { color: 0xffffff, map: white, side: THREE.DoubleSide };
  // (the house's look goes on after the puff's colour: hooks run in the
  // order they're put on, and the house's is on the light, after it)
  const material = house ? house.material(opts) : new MeshLambertNodeMaterial(opts);
  material.name = 'puff';
  puffHooks(material, uniforms, { trunk: true, wind });
  return { geometry, material };
}
