// Cybertron's robots and vehicles, loaded from the catalogue and made to
// move. A robot that came with a skeleton lib/three/rig.js can read (High
// Moon's War for Cybertron and Fall of Cybertron rigs, the Prime game's)
// walks and runs on rig.js's stride, jumps, aims and is knocked back, and
// stands about on its own idle clip where it has one. One without a usable
// skeleton bobs and sways as it goes. A model whose clip is a whole
// transformation (Megatron's, Barricade's) can be held at any moment of it.
// Until a model loads, or if it can't be had, a stand-in made here takes
// its place, in its colours, so the world always plays.
//
//   loadModel(kind) → Promise<{ scene, animations, spec } | null>
//   makeFigure(kind, opts) → Promise<Figure>
//   standIn(kind) → THREE.Group
//
// Figure: { group, kind, spec, height, rigged, play(state, { speed, aim }),
// update(dt), hold(clip, t), tint(hex, k), look(point | null), dispose() };
// `group` stands on y = 0 facing +z, as every model does. A state of
// 'crouch' is down behind cover; look turns the head where rig.js found one.

import * as THREE from 'three';
import { loadGltf, copy } from '../../../lib/three/gltf';
import { POSES, figure as rigFigure } from '../../../lib/three/rig';
import { autorig } from './autorig';
import { MODELS } from './catalog';

const cache = new Map(); // kind → Promise<{ scene, animations, spec } | null>

export function loadModel(kind) {
  if (!cache.has(kind)) {
    const spec = MODELS[kind];
    cache.set(kind, spec ? loadGltf(spec.file).then((g) => (g ? { scene: g.scene, animations: g.animations ?? [], spec } : null)) : Promise.resolve(null));
  }
  return cache.get(kind);
}

// ── stand-ins ──

const COLOURS = {
  'optimus-wfc': ['#b3202a', '#2a4fa8'],
  'optimus-tfp': ['#c41e2a', '#2550b0'],
  'bumblebee-wfc': ['#e3b51c', '#222'],
  'bumblebee-tfp': ['#f2c400', '#1b1b1b'],
  megatron: ['#8d929c', '#5d2b8f'],
  arcee: ['#3b5bd6', '#d74d9a'],
  ratchet: ['#e8e8e8', '#c4202a'],
  bulkhead: ['#47613a', '#2a2a2a'],
  vehicon: ['#3a3d48', '#7b2fb0'],
  trooper: ['#4a4f63', '#7d3fc4'],
};
const colourOf = (kind) => COLOURS[kind] ?? COLOURS[Object.keys(COLOURS).find((k) => kind.startsWith(k.split('-')[0]))] ?? ['#7d8592', '#3d4450'];

// A blocky robot (or a vehicle, or a prop) the right size, in its colours
export function standIn(kind) {
  const spec = MODELS[kind] ?? { metres: 7, role: 'npc' };
  const [main, trim] = colourOf(kind);
  const g = new THREE.Group();
  const m1 = new THREE.MeshStandardMaterial({ color: main, metalness: 0.6, roughness: 0.4 });
  const m2 = new THREE.MeshStandardMaterial({ color: trim, metalness: 0.6, roughness: 0.45 });
  const glow = new THREE.MeshBasicMaterial({ color: '#7fd8ff' });
  const box = (w, h, d, x, y, z, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const H = spec.metres ?? 7;
  if (spec.role === 'vehicle') {
    const L = H;
    box(L * 0.42, L * 0.16, L, 0, L * 0.14, 0, m1);
    box(L * 0.36, L * 0.14, L * 0.4, 0, L * 0.29, -L * 0.05, m2);
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) box(L * 0.06, L * 0.14, L * 0.14, x * L * 0.22, L * 0.07, z * L * 0.33, m2);
  } else if (spec.role === 'landmark' || spec.role === 'prop') {
    box(H * 0.5, H, H * 0.3, 0, H / 2, 0, m1);
  } else {
    const u = H / 10;
    box(u * 2.2, u * 2.6, u * 1.4, 0, u * 6.6, 0, m1); // chest
    box(u * 1.6, u * 1.2, u * 1.2, 0, u * 4.8, 0, m2); // waist
    box(u * 0.9, u * 1.0, u * 0.9, 0, u * 8.5, 0, m2); // head
    box(u * 0.5, u * 0.15, u * 0.1, 0, u * 8.6, u * 0.46, glow); // eyes
    for (const s of [-1, 1]) {
      box(u * 0.8, u * 3.4, u * 0.8, s * u * 1.6, u * 6.0, 0, m1); // arms
      box(u * 0.9, u * 4.2, u * 1.0, s * u * 0.6, u * 2.1, 0, s < 0 ? m2 : m1); // legs
    }
  }
  g.userData.standIn = true;
  return g;
}

// ── figures ──


// a figure of a model that isn't rigged (or not in a way rig.js can read)
function stillFigure(kind, spec, scene, animations) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const model = copy(scene);
  inner.add(model);
  const mixer = animations.length ? new THREE.AnimationMixer(model) : null;
  const actions = new Map(animations.map((a) => [a.name, mixer.clipAction(a)]));
  let state = 'idle';
  let speed = 0;
  let phase = 0;
  let clock = 0;
  const idle = spec.clips?.idle && actions.get(spec.clips.idle);
  if (idle) idle.play();
  return {
    group,
    kind,
    spec,
    height: spec.metres ?? 7,
    rigged: false,
    mixer,
    actions,
    play(s, { speed: v = 0 } = {}) {
      state = s;
      speed = v;
    },
    hold(name, t) {
      const a = actions.get(name);
      if (!a) return 0;
      for (const other of actions.values()) if (other !== a) other.stop();
      a.play();
      a.paused = true;
      a.time = Math.min(t, a.getClip().duration);
      mixer.update(0);
      return a.getClip().duration;
    },
    // back from a held clip to its idle
    release() {
      if (!idle || idle.isRunning()) return;
      for (const a of actions.values()) a.stop();
      idle.reset().play();
    },
    update(dt) {
      clock += dt;
      const moving = state === 'walk' || state === 'run' || state === 'drive';
      phase += dt * (moving ? Math.max(1.5, speed * 0.9) : 0);
      // a stomp in the step, a sway, a lean into it; breathing standing still
      const h = this.height;
      const bob = moving && state !== 'drive' ? Math.abs(Math.sin(phase)) * h * 0.012 : Math.sin(clock * 1.6) * h * 0.003;
      inner.position.y = bob;
      inner.rotation.z = moving && state !== 'drive' ? Math.sin(phase) * 0.035 : 0;
      inner.rotation.x = state === 'run' ? 0.08 : state === 'hurt' ? -0.2 : 0;
      if (state === 'dead') inner.rotation.x = Math.min(Math.PI / 2, inner.rotation.x + dt * 3);
      if (mixer) mixer.update(dt);
    },
    tint(hex, k) {
      model.traverse((o) => {
        if (!o.isMesh || !o.material?.emissive) return;
        if (!o.userData.ownMaterial) {
          o.material = o.material.clone();
          o.userData.ownMaterial = true;
        }
        o.material.emissive.set(hex);
        o.material.emissiveIntensity = k;
      });
    },
    dispose() {
      mixer?.stopAllAction();
      model.traverse((o) => o.userData.ownMaterial && o.material.dispose());
    },
  };
}

// crouched behind cover (the figure's frame: +z ahead, +x its left): the
// thighs forward and down, the shins back under them, hunched over the gun
const CROUCH = {
  ...POSES.stand,
  thighL: [0.18, -0.45, 0.9],
  thighR: [-0.18, -0.45, 0.9],
  calfL: [0.05, -1, -0.45],
  calfR: [-0.05, -1, -0.45],
  footL: [0, -0.2, 1],
  footR: [0, -0.2, 1],
  torso: { pitch: 0.3, yaw: 0, roll: 0 },
};

// a figure rig.js can pose: walking, running, jumping, aiming, knocked down
function riggedFigure(kind, spec, scene, animations) {
  const fig = rigFigure({ scene }, { h: spec.metres ?? 7 });
  // High Moon's rigs give a robot's guns and blades skeletons of their own,
  // beside the body's rather than in it: put each in whichever hand it's
  // nearest. How it's held is read off the rest pose, where the model holds
  // it right (its barrel along the forearm, its grip at the hand), and kept
  // to every frame after: the arm's pose, or the idle clip (which still
  // moves the gun as if it hung from the root), would turn it round
  fig.model.updateMatrixWorld(true);
  const guns = [];
  const grips = [];
  fig.model.traverse((o) => o.isBone && /^wep_reference/i.test(o.name) && guns.push(o));
  const at = new THREE.Vector3();
  const near = new THREE.Vector3();
  for (const gun of guns) {
    gun.getWorldPosition(at);
    const body = gun.children.find((c) => c.isBone);
    body?.getWorldPosition(at);
    let hand = null;
    let best = Infinity;
    for (const h of [fig.bones.handL, fig.bones.handR]) {
      if (!h) continue;
      const d = h.getWorldPosition(near).distanceTo(at);
      if (d < best) {
        best = d;
        hand = h;
      }
    }
    if (!hand) continue;
    const elbow = hand.parent;
    const H = hand.getWorldPosition(new THREE.Vector3());
    const fore = H.clone().sub(elbow.getWorldPosition(new THREE.Vector3())).normalize();
    const inv = gun.getWorldQuaternion(new THREE.Quaternion()).invert();
    grips.push({
      gun,
      hand,
      elbow,
      barrel: fore.applyQuaternion(inv),
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(inv),
      grip: gun.worldToLocal(H.clone()),
      scale: gun.getWorldScale(new THREE.Vector3()),
    });
    hand.attach(gun);
  }
  const g1 = new THREE.Vector3();
  const g2 = new THREE.Vector3();
  const g3 = new THREE.Vector3();
  const mL = new THREE.Matrix4();
  const mW = new THREE.Matrix4();
  const qW = new THREE.Quaternion();
  const basis = (m, f, up) => {
    const u = g3.copy(up).addScaledVector(f, -up.dot(f));
    if (u.lengthSq() < 1e-6) u.set(0, 0, 1).addScaledVector(f, -f.z);
    u.normalize();
    return m.makeBasis(f, u, f.clone().cross(u));
  };
  // (the gun along the forearm as it is now, gripped where it was)
  const holdGuns = () => {
    if (!grips.length) return;
    fig.holder.updateMatrixWorld(true);
    for (const g of grips) {
      const H = g.hand.getWorldPosition(g1);
      const F = g2.copy(H).sub(g.elbow.getWorldPosition(g3)).normalize();
      basis(mW, F, new THREE.Vector3(0, 1, 0)).multiply(basis(mL, g.barrel.clone().normalize(), g.up).transpose());
      qW.setFromRotationMatrix(mW);
      const offset = g.grip.clone().multiply(g.scale).applyQuaternion(qW);
      mW.compose(H.clone().sub(offset), qW, g.scale).premultiply(mL.copy(g.hand.matrixWorld).invert());
      mW.decompose(g.gun.position, g.gun.quaternion, g.gun.scale);
    }
  };
  const group = new THREE.Group();
  group.add(fig.holder);
  fig.holder.position.y = fig.hipHeight;
  const mixer = animations.length ? new THREE.AnimationMixer(fig.model) : null;
  const actions = new Map(animations.map((a) => [a.name, mixer.clipAction(a)]));
  const idle = spec.clips?.idle && actions.get(spec.clips.idle);
  let state = 'idle';
  let speed = 0;
  let aim = null;
  let phase = 0;
  let clock = 0;
  let blend = 0; // 0: on its own clip, 1: posed
  let crouch = 0; // 0: standing, 1: down behind cover
  let held = false;
  fig.snap(POSES.stand);
  const stride = (spec.metres ?? 7) * 0.75; // metres a stride (two steps)
  return {
    group,
    kind,
    spec,
    height: fig.height,
    rigged: true,
    mixer,
    actions,
    fig,
    play(s, { speed: v = 0, aim: a = null } = {}) {
      state = s;
      speed = v;
      aim = a;
    },
    hold(name, t) {
      const a = actions.get(name);
      if (!a) return 0;
      held = true;
      for (const other of actions.values()) if (other !== a) other.stop();
      a.play();
      a.paused = true;
      a.time = Math.min(t, a.getClip().duration);
      mixer.update(0);
      return a.getClip().duration;
    },
    // where the gun's muzzle is (in the world), for the shots and the flash:
    // down the forearm from the hand, a gun's length (or a fist's)
    muzzle(out = new THREE.Vector3()) {
      const g = grips.find((x) => x.hand === fig.bones.handR) ?? grips[0];
      const hand = g?.hand ?? fig.bones.handR;
      if (!hand?.parent) return null;
      fig.holder.updateMatrixWorld(true);
      hand.getWorldPosition(out);
      const f = g1.copy(out).sub(hand.parent.getWorldPosition(g2)).normalize();
      return out.addScaledVector(f, fig.height * (g ? 0.32 : 0.1));
    },
    // back from a held clip to standing, walking and the rest
    release() {
      if (!held) return;
      held = false;
      for (const a of actions.values()) a.stop();
      blend = 1;
    },
    update(dt) {
      clock += dt;
      if (held) return;
      const moving = state === 'walk' || state === 'run';
      phase += moving ? (dt * speed * Math.PI * 2) / stride : 0;
      // standing about on its own clip; moving, fighting or falling, posed
      const posed = moving || state === 'jump' || state === 'fall' || state === 'fire' || state === 'hurt' || state === 'dead' || state === 'crouch' || !idle;
      // down on its haunches behind cover: the hips lowered, the knees forward
      crouch += ((state === 'crouch' ? 1 : 0) - crouch) * Math.min(1, dt * 8);
      fig.holder.position.y = fig.hipHeight * (1 - 0.3 * crouch);
      blend += ((posed ? 1 : 0) - blend) * Math.min(1, dt * 8);
      if (blend < 0.02 && idle) {
        if (!idle.isRunning()) idle.reset().play();
        mixer.update(dt);
        holdGuns();
        return;
      }
      idle?.stop();
      let targets;
      if (state === 'jump' || state === 'fall') targets = POSES.leap(state === 'jump' ? 1 : -1);
      else if (state === 'hurt') targets = POSES.hurt();
      else if (state === 'dead') targets = POSES.fall(clock);
      else if (state === 'crouch') targets = CROUCH;
      else targets = moving ? POSES.stride(phase, Math.min(1, speed / 3), state === 'run' ? 1 : 0) : POSES.stand;
      if (aim || state === 'fire') {
        // the gun arm up and out along the aim, the other braced
        const dir = aim ?? [0, 0.05, 1];
        targets = { ...targets, armR: dir, foreR: dir, armL: [0.35, -0.3, 0.85], foreL: [-0.2, 0.15, 1], torso: { ...(targets.torso ?? {}), yaw: (targets.torso?.yaw ?? 0) * 0.3 } };
      }
      fig.pose(targets, dt, state === 'hurt' ? 20 : 12);
      holdGuns();
    },
    tint(hex, k) {
      fig.tint(new THREE.Color(hex), k);
    },
    dispose() {
      mixer?.stopAllAction();
      fig.dispose();
    },
  };
}

// whether rig.js found enough of a skeleton to walk it
function walkable(scene) {
  const names = [];
  scene.traverse((o) => o.isBone && names.push(o.name.toLowerCase()));
  const has = (re) => names.some((n) => re.test(n));
  return (has(/l_leg01_thigh|thigh\.l|leftupleg|thigh_l/) && has(/r_leg01_thigh|thigh\.r|rightupleg|thigh_r/)) || false;
}

const ROBOTS = new Set(['player', 'npc', 'enemy', 'boss']);
const rigged = new Map(); // kind → its model with a skeleton made for it

export async function makeFigure(kind, { shadows = false } = {}) {
  const spec = MODELS[kind];
  const loaded = spec ? await loadModel(kind) : null;
  let f;
  if (!loaded) {
    const group = new THREE.Group();
    group.add(standIn(kind));
    f = stillFigure(kind, spec ?? { metres: 7 }, group, []);
    f.standIn = true;
  } else if (!spec.rig && !spec.still && ROBOTS.has(spec.role)) {
    // one piece, no skeleton: given one (autorig.js), then posed like the rest
    try {
      if (!rigged.has(kind)) rigged.set(kind, autorig(loaded.scene));
      f = riggedFigure(kind, spec, rigged.get(kind), []);
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('autorig failed for', kind, e);
      f = stillFigure(kind, spec, loaded.scene, loaded.animations);
    }
  } else if (spec.rig && walkable(loaded.scene)) {
    try {
      f = riggedFigure(kind, spec, loaded.scene, loaded.animations);
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('rig failed for', kind, e);
      f = stillFigure(kind, spec, loaded.scene, loaded.animations);
    }
  } else f = stillFigure(kind, spec, loaded.scene, loaded.animations);
  f.group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = shadows;
    o.receiveShadow = false;
    if (o.isSkinnedMesh) o.frustumCulled = false;
  });
  f.group.userData.kind = kind;
  f.look = f.fig?.bones?.head ? looking(f, f.fig.bones.head) : () => {};
  return f;
}

// Its head turned toward a point (in the world), as far as a neck goes, and
// eased there; null looks ahead again. Turned after the pose (or the idle
// clip) each frame, and undone before the next, so the turn never adds up
// on a bone a clip doesn't move. A figure rig.js found no head on (by its
// ROLES: a stand-in, a still model) looks with its whole body, which the
// scene already turns, so its look is nothing.
const NECK = 1.1; // radians either way
function looking(f, head) {
  let target = null;
  let turned = 0;
  let before = null;
  const at = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const update = f.update.bind(f);
  f.update = (dt) => {
    if (before) head.quaternion.copy(before);
    update(dt);
    let want = 0;
    if (target) {
      head.getWorldPosition(at);
      const yaw = f.group.rotation.y;
      const rel = Math.atan2(target.x - at.x, target.z - at.z) - yaw;
      want = Math.max(-NECK, Math.min(NECK, Math.atan2(Math.sin(rel), Math.cos(rel))));
    }
    turned += (want - turned) * Math.min(1, dt * 6);
    before = head.quaternion.clone();
    if (Math.abs(turned) < 1e-3) return;
    // a turn about the world's up, into the head's own frame: parent⁻¹ · R · parent
    head.parent.getWorldQuaternion(parentQ);
    q.setFromAxisAngle(up, turned);
    head.quaternion.premultiply(parentQ.clone().invert().multiply(q).multiply(parentQ));
  };
  return (point) => {
    target = point && Number.isFinite(point.x) && Number.isFinite(point.z) ? point : null;
  };
}

// A vehicle (or prop) as it stands: a copy of its model, or its stand-in
export async function makeThing(kind, { shadows = false } = {}) {
  const loaded = await loadModel(kind);
  const group = new THREE.Group();
  group.add(loaded ? copy(loaded.scene) : standIn(kind));
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = shadows;
  });
  group.userData.kind = kind;
  return group;
}

