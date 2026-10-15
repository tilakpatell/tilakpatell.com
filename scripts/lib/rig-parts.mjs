// A 2017 composite's parts on one skeleton. A hero comes as several GLBs (a
// body, a cape, hands, a head), each with its own copy of the rig; the
// import joins them so one skeleton drives them all. The rig itself is kept
// whole, as DICE made it (the owner's choice: the game's clips and physics
// drive it as they were made to), so nothing here removes a bone the body
// uses: only a part's duplicate copies go.
import { joinPrimitives } from '@gltf-transform/functions';
import { invert4, mul4 } from './surface-model.mjs';

// A part's JOINTS_n re-indexed from its own joint list to the body's, by
// name. A joint the body hasn't got (a bone only the part's rig has) is
// bound to the body's Hips, so the vertex still moves with the figure, and
// counted, so the import can say how much of a part went stiff.
export function rebindJoints(partJoints, bodyJoints, joints, weights = null) {
  const index = new Map(bodyJoints.map((n, i) => [n, i]));
  const hips = index.get('Hips') ?? 0;
  const map = partJoints.map((n) => index.get(n) ?? -1);
  const unmatched = new Set();
  const out = new joints.constructor(joints.length);
  for (let i = 0; i < joints.length; i++) {
    const to = map[joints[i]];
    // (a slot of no weight may name anything: 0)
    if (weights && !(weights[i] > 0)) out[i] = 0;
    else if (to >= 0) out[i] = to;
    else {
      out[i] = hips;
      unmatched.add(joints[i]);
    }
  }
  return { joints: out, unmatched: unmatched.size };
}

// A part's vertices moved into the body's bind space. Each copy of the rig
// carries its own inverse bind matrices, and gltfpack folds a mesh's
// quantisation into them, so the body's and a part's differ by one matrix
// `m` (the part's bind against the body's, the same for every joint they
// share): a vertex bound to the body's joint lands where it did only once
// it is put through m. With `moves` (a matrix for each of the part's
// joints), each vertex goes through its own joints' moves, blended by its
// weights, where they differ from m. Floats only (dequantize first).
function toBodyBind(prim, m, moves = null) {
  const pos = prim.getAttribute('POSITION');
  if (pos) {
    const a = pos.getArray().slice();
    const sets = [];
    for (let k = 0; prim.getAttribute(`JOINTS_${k}`); k++) sets.push([prim.getAttribute(`JOINTS_${k}`).getArray(), prim.getAttribute(`WEIGHTS_${k}`).getArray()]);
    for (let i = 0, v = 0; i < a.length; i += 3, v++) {
      const x = [a[i], a[i + 1], a[i + 2]];
      const out = [0, 0, 0];
      let sum = 0;
      if (moves)
        for (const [J, W] of sets)
          for (let k = 0; k < 4; k++) {
            const w = W[v * 4 + k];
            if (!(w > 0)) continue;
            const q = apply(moves[J[v * 4 + k]] ?? m, x);
            for (let r = 0; r < 3; r++) out[r] += w * q[r];
            sum += w;
          }
      const at = sum ? out.map((c) => c / sum) : apply(m, x);
      for (let r = 0; r < 3; r++) a[i + r] = at[r];
    }
    pos.setArray(a);
  }
  // (a direction goes through the inverse transpose of m's turn and scale)
  const inv = invert4(m);
  for (const [name, size] of [
    ['NORMAL', 3],
    ['TANGENT', 4],
  ]) {
    const acc = prim.getAttribute(name);
    if (!acc) continue;
    const a = acc.getArray().slice();
    for (let i = 0; i < a.length; i += size) {
      const [x, y, z] = [a[i], a[i + 1], a[i + 2]];
      const d = [0, 1, 2].map((r) => inv[r * 4] * x + inv[r * 4 + 1] * y + inv[r * 4 + 2] * z);
      const l = Math.hypot(...d) || 1;
      for (let r = 0; r < 3; r++) a[i + r] = d[r] / l;
    }
    acc.setArray(a);
  }
}

// m for a part's skin against the body's: the body's bind undone, then the
// part's, read at the first joint they share
function bindDelta(partIbm, bodyIbm) {
  return mul4(invert4(bodyIbm), partIbm);
}

const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);

// whether a joint's own move puts the joint itself (its bind, from its
// inverse bind) more than a quarter metre from where the part's move does:
// another bone that happens to share the name
const FAR = 0.25;
function far(d, m, ibm) {
  const at = invert4(ibm).slice(12, 15);
  const a = apply(d, at);
  const b = apply(m, at);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > FAR;
}
function remap(prim, partJoints, bodyJoints) {
  let unmatched = 0;
  for (let set = 0; ; set++) {
    const joints = prim.getAttribute(`JOINTS_${set}`);
    if (!joints) return unmatched;
    const r = rebindJoints(partJoints, bodyJoints, joints.getArray(), prim.getAttribute(`WEIGHTS_${set}`).getArray());
    joints.setArray(r.joints);
    unmatched += r.unmatched;
  }
}

// A node taken out of the tree, its children moved to its parent with its
// local transform folded into theirs, so nothing under it moves in the world.
export function detach(node) {
  const parent = node.getParentNode();
  const m = node.getMatrix();
  for (const child of node.listChildren()) {
    const local = mul4(m, child.getMatrix());
    if (parent) parent.addChild(child);
    else for (const scene of node.listParents().filter((p) => p.propertyType === 'Scene')) scene.addChild(child);
    child.setMatrix(local);
  }
  node.dispose();
}

// A composite's parts (a hero's cape, hands, head) come as GLBs of their
// own, each with its own copy of the skeleton. A part on the body's rig
// (most of its bones in the first skin by name) is moved onto it, so one
// skeleton drives them all and the copies go; each vertex lands where its
// own joints put it, a bone of the body's name bound far from the body's
// binds to the nearest parent they share, and a bone of the part's the
// body lacks binds to Hips (rebindJoints). A part on another rig keeps its own.
// Returns how many skins were joined; `say` hears each part's binding.
export function shareSkins(doc, say = () => {}) {
  const root = doc.getRoot();
  const [body, ...rest] = root.listSkins();
  if (!body) return 0;
  const bodyNames = body.listJoints().map((j) => j.getName());
  const index = new Set(bodyNames);
  const bodyJoints = new Set(body.listJoints());
  let joined = 0;
  for (const skin of rest) {
    const joints = skin.listJoints();
    const names = joints.map((j) => j.getName());
    const bound = names.filter((n) => index.has(n)).length;
    if (bound * 2 < names.length) continue;
    // (the first joint both have, its two inverse binds)
    const at = names.findIndex((n) => index.has(n));
    const ibmOf = (sk, i) => sk.getInverseBindMatrices()?.getElement(i, []) ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const m = bindDelta(ibmOf(skin, at), ibmOf(body, bodyNames.indexOf(names[at])));
    // (each shared joint's own move; the game's copies agree to float noise,
    // 5 mm at most on Obi-Wan's seven, but a head made for another face
    // puts its face bones a centimetre from the body's, and each vertex
    // goes where its own joints put it)
    const deltas = names.map((n, i) => (index.has(n) ? bindDelta(ibmOf(skin, i), ibmOf(body, bodyNames.indexOf(n))) : null));
    // (a joint of the body's name bound somewhere else entirely is another
    // bone: a helmet's PROC_Bone1, its ear flap, against the body's hip
    // flap of that name, metres apart; it's bound to its nearest parent
    // the two share, moving with that)
    const foreign = joints.map((j, i) => deltas[i] && far(deltas[i], m, ibmOf(skin, i)));
    const sharedParent = (j) => {
      for (let p = j.getParentNode(); p; p = p.getParentNode()) {
        const k = joints.indexOf(p);
        if (k >= 0 && deltas[k] && !foreign[k]) return k;
      }
      return names.indexOf('Hips');
    };
    const as = names.map((_, i) => (foreign[i] ? sharedParent(joints[i]) : i));
    const bindAs = as.map((k) => (k >= 0 ? names[k] : 'Hips'));
    const moves = as.map((k) => (k >= 0 ? (deltas[k] ?? m) : m));
    for (let i = 0; i < names.length; i++) if (foreign[i]) say(`part ${names[at]}…: ${names[i]} is bound elsewhere than the body's, so on ${bindAs[i]}`);
    for (const node of root.listNodes().filter((n) => n.getSkin() === skin)) {
      for (const prim of node.getMesh()?.listPrimitives() ?? []) toBodyBind(prim, m, moves);
      let unmatched = 0;
      for (const prim of node.getMesh()?.listPrimitives() ?? []) unmatched += remap(prim, bindAs, bodyNames);
      say(`part ${node.getName() || node.getMesh()?.getName() || '?'}: ${bound} joints bound, ${unmatched} unmatched`);
      node.setSkin(body);
    }
    // (deepest first, so each copy's children have gone up before it goes)
    const depth = (n) => (n.getParentNode() ? 1 + depth(n.getParentNode()) : 0);
    for (const j of [...joints].sort((a, b) => depth(b) - depth(a))) if (!bodyJoints.has(j)) detach(j);
    skin.dispose();
    joined++;
  }
  return joined;
}

// What lets two primitives be one draw: the material, the draw mode, indices
// or none, and the same attributes laid out the same way.
const drawKey = (prim, ids) => {
  const m = prim.getMaterial();
  if (m && !ids.has(m)) ids.set(m, ids.size);
  const attrs = prim
    .listSemantics()
    .sort()
    .map((sem) => {
      const a = prim.getAttribute(sem);
      return `${sem}:${a.getType()}:${a.getComponentType()}:${a.getNormalized()}`;
    });
  return [m ? ids.get(m) : -1, prim.getMode(), Boolean(prim.getIndices()), ...attrs].join('|');
};

// A figure's parts joined per material (the design's section 6: a trooper
// two or three draws, not one a part). glTF-Transform's join leaves skinned
// meshes alone; on one skin a node's own transform is not used (its vertices
// are in the skin's bind space), so the parts' primitives can go into one
// mesh on one node, and those sharing a material and a layout become one.
// Floats only (dequantize first). Returns how many skins' parts were joined.
export function joinSkinned(doc) {
  const root = doc.getRoot();
  const ids = new Map();
  let joined = 0;
  for (const skin of root.listSkins()) {
    const nodes = root.listNodes().filter((n) => n.getSkin() === skin && n.getMesh());
    if (nodes.length < 2 && !nodes.some((n) => n.getMesh().listPrimitives().length > 1)) continue;
    const groups = new Map();
    const before = nodes.reduce((n, node) => n + node.getMesh().listPrimitives().length, 0);
    for (const node of nodes)
      for (const prim of node.getMesh().listPrimitives()) {
        // (a primitive with morph targets keeps a draw of its own)
        const key = prim.listTargets().length ? `own:${groups.size}` : drawKey(prim, ids);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(prim);
      }
    const mesh = doc.createMesh(nodes[0].getMesh().getName());
    for (const prims of groups.values()) mesh.addPrimitive(prims.length > 1 ? joinPrimitives(prims) : prims[0]);
    for (const node of nodes) {
      const old = node.getMesh();
      node.setMesh(null);
      for (const prim of old.listPrimitives()) old.removePrimitive(prim);
      if (!old.listParents().some((p) => p.propertyType !== 'Root')) old.dispose();
    }
    nodes[0].setMesh(mesh);
    // (the other parts' nodes go, when nothing hangs from them)
    for (const node of nodes.slice(1)) if (!node.listChildren().length) node.dispose();
    if (mesh.listPrimitives().length < before || nodes.length > 1) joined++;
  }
  return joined;
}
