// A 2017 figure's rig ops: after its clips and additive layers have posed
// the body, the game runs a list of ANT expression rig ops over the pose
// (the body type's ToolRigOpList_Deformation_<type>, chosen by
// Game.Character.BodyType through an EnumRigOpListAsset), and those are
// what drive the helper bones no clip carries: the knees' KneeUp, KneeLow
// and KneeRoll, the thighs' UpLegRoll and HipsRoll, the arms' ArmRoll,
// ForeArmRoll 1–2, ElbowRoll, Armpit and DeltoidBulge, the ankles, the
// collar (3p.Body.Deformation.Exp RigOp), and the body type's own
// secondary bones, the backpack and the arm pouches hung on spring filters
// (3P.BodyType.<type>.Exp RigOp). A trooper's mesh is weighted to them
// (the snowtrooper's body 2,100 vertices to the knees alone), so a figure
// whose helpers stay at bind folds at the knee and the elbow. The kernels
// run on lib/three/exprVm.js, the game's bytecode as bf2-re decoded it.
//
// Each update: the helper DOFs the kernels write and no clip moves are put
// back to bind first (the game's pose holds the rig's default for a DOF its
// clips do not carry, so a kernel reading a helper reads its bind, never
// last frame's answer); then the stateless deformation runs on the frame's
// pose; the body type's filters run once a game tick (30 Hz:
// GameTimeSettings' ForceSimRate; their kernels step by a constant 2 in the
// MotionFilter, the tick in 60ths), their writes held between ticks.
//
//   RIG_LISTS { kind: [kernel…] } (the game's lists by body; NOTES.md says
//     which body type each Hoth kind is read as)
//   createRigOps(model, kernels, { animated }) → { update(dt), stats() } | null
//     kernels: kernel ids from KERNELS; animated: bone names a clip moves

import deformation from '../../data/bf2017/rig/deformation.json';
import rebeltrooper from '../../data/bf2017/rig/rebeltrooper.json';
import rebeltrooperBackpack from '../../data/bf2017/rig/rebeltrooper-backpack.json';
import snowtrooper from '../../data/bf2017/rig/snowtrooper.json';
import hansolohoth from '../../data/bf2017/rig/hansolohoth.json';
import { createMachine, loadKernel } from './exprVm.js';

export const TICK = 1 / 30; // s: the game's simulation tick (GameTimeSettings ForceSimRate 30, findings/24)

const RAW = { deformation, rebeltrooper, 'rebeltrooper-backpack': rebeltrooperBackpack, snowtrooper, hansolohoth };
const loaded = new Map();
export const kernelOf = (id) => {
  if (!loaded.has(id)) loaded.set(id, RAW[id] ? loadKernel(RAW[id]) : null);
  return loaded.get(id);
};
// (stateless: runs on every drawn frame; the rest hold spring or filter state and run on the tick)
const EVERY_FRAME = new Set(['deformation']);

// The lists by the site's body kinds (ToolRigOpList_Deformation_* in the
// game's antstate bank; the LongSkirt and VehicleRider ops of the
// snowtrooper's list drive only its cloth collider and a speeder seat)
export const RIG_LISTS = {
  snowtrooper: ['deformation', 'snowtrooper'],
  hothtrooper: ['deformation', 'rebeltrooper-backpack'],
  rebel: ['deformation', 'rebeltrooper'],
  han: ['deformation', 'hansolohoth'],
  default: ['deformation'],
};
export const rigListOf = (kind) => RIG_LISTS[kind] ?? RIG_LISTS.default;

// the DOF names a kernel writes (its DofWriter and WorldJointWriter targets)
function writtenBy(k) {
  const byReg = new Map(k.dofs.map(([, dof, hreg]) => [hreg, dof]));
  const out = new Set();
  for (const r of k.code) {
    if (r.fn === 'DofWriter') out.add(byReg.get(r.l?.[0]?.[1] ?? r.o?.[1]));
    if (r.fn === 'WorldJointWriter') for (const h of (r.l?.[0] ?? r.o ?? []).slice(3, 6)) out.add(byReg.get(h));
  }
  out.delete(undefined);
  return out;
}

const PATH = { q: 'quaternion', t: 'position', s: 'scale' };

// the ANT pose over a body's bones: 'Bone.q' its local quaternion, '.t' its position, '.s' its scale
export function bonePose(model) {
  const bones = new Map();
  // (a bone before any other node of its name; a bare skeleton's nodes are plain objects)
  model.traverse((o) => o.isBone && o.name && !bones.has(o.name) && bones.set(o.name, o));
  model.traverse((o) => o.name && !bones.has(o.name) && bones.set(o.name, o));
  const split = (dof) => {
    const i = dof?.lastIndexOf('.') ?? -1;
    if (i < 0) return null;
    const bone = bones.get(dof.slice(0, i));
    const path = PATH[dof.slice(i + 1)];
    return bone && path ? bone[path] : null;
  };
  const cache = new Map();
  const target = (dof) => {
    if (!cache.has(dof)) cache.set(dof, split(dof));
    return cache.get(dof);
  };
  return {
    bones,
    has: (dof) => target(dof) != null,
    get(dof) {
      const v = target(dof);
      return v ? v.toArray() : null;
    },
    set(dof, vals) {
      const v = target(dof);
      if (!v || vals.some((x) => !Number.isFinite(x))) return;
      v.fromArray(vals);
    },
  };
}

export function createRigOps(model, ids, { animated = new Set() } = {}) {
  const kernels = ids.map((id) => [id, kernelOf(id)]).filter(([, k]) => k);
  if (!kernels.length || !model) return null;
  const pose = bonePose(model);
  const machines = kernels.map(([id, k]) => ({ id, k, m: createMachine(k, { pose }), every: EVERY_FRAME.has(id), held: [] }));
  // (the helpers to put back to bind each update: written, on this body, and no clip's)
  const reset = [];
  for (const { k } of machines)
    for (const dof of writtenBy(k)) {
      const bone = pose.bones.get(dof.slice(0, dof.lastIndexOf('.')));
      if (!bone || animated.has(bone.name) || !pose.has(dof)) continue;
      reset.push([dof, pose.get(dof)]);
    }
  let acc = TICK; // (the first update ticks)
  let runs = 0;
  let ms = 0;
  return {
    update(dt) {
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      for (const [dof, v] of reset) pose.set(dof, v);
      acc += dt;
      const tick = acc >= TICK;
      if (tick) acc %= TICK;
      for (const x of machines) {
        if (x.every || tick) {
          x.m.run();
          runs++;
          if (!x.every) x.held = x.m.writes;
        } else for (const [dof, v] of x.held) pose.set(dof, v);
      }
      if (t0) ms += performance.now() - t0;
    },
    stats: () => ({ runs, ms, kernels: machines.map((x) => x.id), reset: reset.length }),
  };
}
