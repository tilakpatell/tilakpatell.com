// The GPU scene's draws (GPU-first lane N1): one Mesh a material group, the
// CPU's whole part in a frame. A group is the parts (a GLB mesh at one LOD
// file) that draw alike: one batch key (the material's userData.batchKey,
// as lane U's levelBatch.js reads it), one set of attributes and one set of
// maps. Its geometry is every part's vertices end to end, each part's local
// matrix baked in and its LOD file as an attribute (gpuLod), and one index
// buffer with, for a mirrored mesh, the part's triangles again wound the
// other way (Review Focus 3: an indirect draw cannot switch its winding,
// but two sub-draws of one Mesh can read two index ranges, so a mirrored
// row's faces face out and FrontSide holds, as levelScene.js's flipped
// copy does). Each part is a draw slot: one drawIndexedIndirect whose
// arguments cullPass.js writes every frame (its key's count, its key's
// base as firstInstance), and the Mesh draws all its slots from the one
// indirect buffer through three's setIndirect with an offset each.
//
// The vertex pulls its row: instance_index (which carries firstInstance)
// into the key's list, the list into the rows; the row's quaternion and
// three scales turn the vertex, the normal by the inverse scale (as an
// instance matrix's normal matrix would), the previous position the same
// (a level's rows do not move, so the velocity is the camera's, as N2's TRAA
// wants). lodFade.js's dither keeps the fading files' pixels apart.
//
// The shadow pass draws the same Mesh from the shadow lists (onBeforeShadow
// swaps the offsets; a caster out of view still casts). Static groups sit
// in one BundleGroup, recorded again only when a part comes (the arguments
// change on the GPU, the commands do not). The prepass draws the opaque
// groups' steady rows (no fading, no cut-out) into a depth target with this
// frame's camera, the occluders for the pyramid: last frame's visible rows,
// where they are now, so nothing visible is hidden by a stale depth.
//
//   texturesOf(material) → Set (the maps it samples, by its own fields)
//   groupsOf(parts, { keyOf, maxTextures = 16 }) → { groups: [{ key, parts, material, textures }], refused: parts }
//   mergeParts(THREE, [{ geometry, local, file, mirrored }]) → { geometry, ranges: [{ baseVertex, firstIndex, indexCount, mirrored? }] }
//   createDraws(renderer, { cull, three, parent, keyOf, bundle = true }) → {
//     add(parts, keys) → slots added, groups, meshes, bundle, setStatic(groupKey, on), rerecord(),
//     prepass(camera, width, height) → depthTexture | null, stats() → { groups, slots, refused }, dispose() }

import { FADE } from './cull.js';
import { fadeNodes } from './lodFade.js';
import { setIndirect } from './three.js';

export const MAX_TEXTURES = 16;

export function texturesOf(material) {
  const out = new Set();
  for (const v of Object.values(material)) if (v?.isTexture) out.add(v);
  return out;
}

const attributeKey = (g) => `${Object.keys(g.attributes).sort().join(',')}`;

export function groupsOf(parts, { keyOf = (m) => m.userData?.batchKey ?? m.uuid, maxTextures = MAX_TEXTURES } = {}) {
  const groups = new Map();
  const refused = [];
  for (const p of parts) {
    const textures = texturesOf(p.material);
    if (textures.size > maxTextures || Array.isArray(p.material)) {
      refused.push(p);
      continue;
    }
    // (the maps in the key: a group draws with its first part's material,
    // so two parts whose maps differ never share one)
    const maps = [...textures].map((t) => t.uuid).sort().join(',');
    const key = `${keyOf(p.material)}|${attributeKey(p.geometry)}|${maps}`;
    if (!groups.has(key)) groups.set(key, { key, parts: [], material: p.material, textures });
    groups.get(key).parts.push(p);
  }
  return { groups: [...groups.values()], refused };
}

export function mergeParts(THREE, parts) {
  const names = Object.keys(parts[0].geometry.attributes);
  let verts = 0;
  let indices = 0;
  for (const p of parts) {
    verts += p.geometry.attributes.position.count;
    const n = p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count;
    indices += n * (p.mirrored ? 2 : 1);
  }
  const out = new THREE.BufferGeometry();
  const arrays = {};
  for (const name of names) arrays[name] = new Float32Array(verts * parts[0].geometry.attributes[name].itemSize);
  const lod = new Float32Array(verts);
  const index = new Uint32Array(indices);
  const ranges = [];
  let v = 0;
  let i = 0;
  const normalMatrix = new THREE.Matrix3();
  const _v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.geometry;
    const count = g.attributes.position.count;
    normalMatrix.getNormalMatrix(p.local);
    for (const name of names) {
      const a = g.attributes[name];
      const size = a.itemSize;
      const dst = arrays[name];
      for (let k = 0; k < count; k++) {
        for (let c = 0; c < size; c++) dst[(v + k) * size + c] = a.getComponent(k, c);
        if (name === 'position') _v.fromArray(dst, (v + k) * 3).applyMatrix4(p.local).toArray(dst, (v + k) * 3);
        else if (name === 'normal') _v.fromArray(dst, (v + k) * 3).applyMatrix3(normalMatrix).normalize().toArray(dst, (v + k) * 3);
        else if (name === 'tangent') {
          _v.set(dst[(v + k) * 4], dst[(v + k) * 4 + 1], dst[(v + k) * 4 + 2]).transformDirection(p.local);
          dst.set([_v.x, _v.y, _v.z], (v + k) * 4);
        }
      }
    }
    lod.fill(p.file, v, v + count);
    const src = g.index ? g.index.array : null;
    const n = src ? g.index.count : count;
    const range = { baseVertex: v, firstIndex: i, indexCount: n };
    for (let k = 0; k < n; k++) index[i + k] = src ? src[k] : k;
    i += n;
    if (p.mirrored) {
      range.mirrored = { baseVertex: v, firstIndex: i, indexCount: n };
      for (let k = 0; k + 2 < n; k += 3) {
        index[i + k] = index[range.firstIndex + k];
        index[i + k + 1] = index[range.firstIndex + k + 2];
        index[i + k + 2] = index[range.firstIndex + k + 1];
      }
      i += n;
    }
    ranges.push(range);
    v += count;
  }
  for (const name of names) out.setAttribute(name, new THREE.BufferAttribute(arrays[name], parts[0].geometry.attributes[name].itemSize));
  out.setAttribute('gpuLod', new THREE.BufferAttribute(lod, 1));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return { geometry: out, ranges };
}

// The row's transform pulled in the vertex stage: the nodes three's
// instancing would set (positionLocal, positionPrevious, normalLocal), from
// the row this instance_index names; and the fade's share
function pullNodes(tsl, cull, { fade = FADE } = {}) {
  const { Fn, instanceIndex, uint, vec3, vec4, float, select, unpackHalf2x16, bitcast, positionLocal, positionPrevious, normalLocal, attribute, clamp } = tsl;
  const { rows, visibleRead, stateRead } = cull.nodes;
  const row = () => {
    const i = visibleRead.element(instanceIndex);
    const a = rows.element(i.mul(2));
    const b = rows.element(i.mul(2).add(1));
    const qxy = unpackHalf2x16(a.w);
    const qzw = unpackHalf2x16(b.x);
    const sxy = unpackHalf2x16(b.y);
    return { i, p: vec3(bitcast(a.x, 'float'), bitcast(a.y, 'float'), bitcast(a.z, 'float')), q: vec4(qxy.x, qxy.y, qzw.x, qzw.y), s: vec3(sxy.x, sxy.y, unpackHalf2x16(b.z).x) };
  };
  const turn = (q, v) => {
    const t = q.xyz.cross(v).mul(2);
    return v.add(t.mul(q.w)).add(q.xyz.cross(t));
  };
  const fadeOf = (i) => {
    const st = stateRead.element(i);
    const cur = st.x.bitAnd(uint(15));
    const age = cull.uniforms.now.sub(bitcast(st.y, 'float'));
    const mine = uint(attribute('gpuLod', 'float'));
    // (incoming when this file is the row's own; the old file's draw fades out)
    return { age, incoming: select(mine.equal(cur), float(1), float(0)) };
  };
  const position = Fn(() => {
    const { p, q, s } = row();
    positionPrevious.assign(turn(q, positionPrevious.mul(s)).add(p));
    normalLocal.assign(turn(q, normalLocal.div(s)));
    return turn(q, positionLocal.mul(s)).add(p);
  });
  // (the prepass's: steady rows only; a fading one collapses to a point and draws nothing)
  const steady = Fn(() => {
    const { i, p, q, s } = row();
    const f = fadeOf(i);
    const ok = f.incoming.greaterThan(0.5).and(clamp(f.age.div(fade), 0, 1).greaterThanEqual(1));
    return select(ok, turn(q, positionLocal.mul(s)).add(p), vec3(0));
  });
  // (read in the vertex stage, where instance_index is; lodFade.js's varying carries it on)
  const keep = Fn(() => {
    const f = fadeOf(visibleRead.element(instanceIndex));
    return fadeNodes(tsl, { age: f.age, incoming: f.incoming, duration: float(fade) }).keep;
  });
  return { position, steady, keep };
}

export function createDraws(renderer, { cull, three, parent, keyOf, bundle: useBundle = true, fade = FADE }) {
  const { THREE, tsl, BundleGroup } = three;
  const pull = pullNodes(tsl, cull, { fade });
  const root = new THREE.Group();
  root.name = 'gpuScene';
  parent.add(root);
  const bundle = useBundle && BundleGroup ? new BundleGroup() : null;
  if (bundle) {
    bundle.name = 'gpuScene:static';
    root.add(bundle);
  }
  const groups = new Map(); // key → { key, material, parts: [{ geometry, local, file, mirrored, slots }], mesh, depth, static }
  const refused = [];
  let slots = 0;
  const prepassScene = new THREE.Scene();
  let target = null;

  const fadeKeep = pull.keep();

  function materialFor(base) {
    const m = base.isNodeMaterial ? base.clone() : renderer.library.fromMaterial(base);
    m.positionNode = pull.position();
    m.maskNode = base.maskNode ? base.maskNode.and(fadeKeep) : fadeKeep;
    m.userData = { ...base.userData, gpuScene: true };
    return m;
  }

  function depthFor(base) {
    if (base.transparent || base.alphaTest > 0 || base.alphaMap || base.userData?.game?.alphaFromMap) return null;
    const m = new THREE.MeshBasicNodeMaterial({ colorWrite: false, side: base.side });
    m.positionNode = pull.steady();
    return m;
  }

  function offsets(group, shadow) {
    const out = [];
    for (const p of group.parts) for (const s of p.slots) out.push((shadow ? cull.slots + s : s) * 5 * 4);
    return out;
  }

  function rebuild(group) {
    const { geometry, ranges } = mergeParts(THREE, group.parts);
    group.parts.forEach((p, k) => {
      const r = ranges[k];
      for (const [j, s] of p.slots.entries()) {
        const at = p.slotRanges[j] === 'mirrored' ? r.mirrored : r;
        cull.setSlot(s, { key: p.keys[j], indexCount: at.indexCount, firstIndex: at.firstIndex, baseVertex: at.baseVertex });
      }
    });
    const cam = offsets(group, false);
    const sh = offsets(group, true);
    setIndirect(geometry, cull.indirect, cam);
    if (!group.mesh) {
      group.mesh = new THREE.Mesh(geometry, materialFor(group.material));
      group.mesh.name = `gpuScene:${group.key.split('|')[0]}`;
      group.mesh.frustumCulled = false;
      group.mesh.castShadow = true;
      group.mesh.receiveShadow = true;
      group.mesh.onBeforeShadow = () => (group.mesh.geometry.indirectOffset = group.shadowOffsets);
      group.mesh.onAfterShadow = () => (group.mesh.geometry.indirectOffset = group.cameraOffsets);
      (group.static && bundle ? bundle : root).add(group.mesh);
      const dm = depthFor(group.material);
      if (dm) {
        group.depth = new THREE.Mesh(geometry, dm);
        group.depth.frustumCulled = false;
        prepassScene.add(group.depth);
      }
    } else {
      group.mesh.geometry.dispose();
      group.mesh.geometry = geometry;
      if (group.depth) group.depth.geometry = geometry;
    }
    group.cameraOffsets = cam.length === 1 ? cam[0] : cam;
    group.shadowOffsets = sh.length === 1 ? sh[0] : sh;
    if (bundle) bundle.needsUpdate = true;
  }

  return {
    root,
    bundle,
    get groups() {
      return [...groups.values()];
    },
    meshes: () => [...groups.values()].map((g) => g.mesh).filter(Boolean),
    // a LOD file's parts: [{ geometry, material, local }], keys: [{ key, file, mirrored }] (the
    // file's keys from meshTable: one, or two for a mirrored mesh)
    add(parts, keys) {
      const plain = keys.filter((k) => !k.mirrored);
      const mir = keys.filter((k) => k.mirrored);
      const file = keys[0]?.file ?? 0;
      const { groups: found, refused: no } = groupsOf(parts, { keyOf });
      refused.push(...no);
      let added = 0;
      for (const f of found) {
        if (!groups.has(f.key)) groups.set(f.key, { key: f.key, material: f.material, parts: [], mesh: null, depth: null, static: true });
        const group = groups.get(f.key);
        for (const p of f.parts) {
          const entry = { geometry: p.geometry, local: p.local, file, mirrored: mir.length > 0, slots: [], keys: [], slotRanges: [] };
          for (const k of plain) entry.slots.push(slots++), entry.keys.push(k.key), entry.slotRanges.push('plain');
          for (const k of mir) entry.slots.push(slots++), entry.keys.push(k.key), entry.slotRanges.push('mirrored');
          added += entry.slots.length;
          group.parts.push(entry);
        }
        rebuild(group);
      }
      return added;
    },
    setStatic(key, on) {
      const g = groups.get(key);
      if (!g || g.static === on) return;
      g.static = on;
      if (g.mesh) (on && bundle ? bundle : root).add(g.mesh);
      if (bundle) bundle.needsUpdate = true;
    },
    rerecord() {
      if (bundle) bundle.needsUpdate = true;
    },
    // the occluders' depth with this frame's camera, for hzb.update
    prepass(camera, width, height) {
      if (!prepassScene.children.length) return null;
      if (!target || target.width !== width || target.height !== height) {
        target?.dispose();
        target = new THREE.RenderTarget(width, height, { depthTexture: new THREE.DepthTexture(width, height, THREE.FloatType) });
      }
      const was = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(prepassScene, camera);
      renderer.setRenderTarget(was);
      return target.depthTexture;
    },
    stats: () => ({ groups: groups.size, slots, refused: refused.length }),
    dispose() {
      for (const g of groups.values()) {
        g.mesh?.geometry.dispose();
        g.mesh?.material.dispose();
        g.depth?.material.dispose();
      }
      target?.dispose();
      parent.remove(root);
      groups.clear();
    },
  };
}
