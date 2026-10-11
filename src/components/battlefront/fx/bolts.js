// The sim's bolts drawn: a bright streak each, as long as the bolt goes in
// a fortieth of a second, in the weapon row's colour (`red`, `blue`, …),
// glowing past the bloom's threshold. One InstancedMesh, filled each frame.
//
// A bolt leaves the gun. The game spawns its hit-testing bolt at the camera
// and draws it from the weapon's muzzle bone (the firing records'
// `ForceSpawnToCamera`, `SpawnVisualAtWeaponBone`); the sim keeps the first
// (core.js's muzzleOf, the eye's line) and this draws the second: the
// first frame a bolt is seen its head is at its owner's muzzle (the
// figure's, figures.muzzleOf, taken once: the bolt doesn't follow the gun),
// it catches up with the sim's bolt (first seen a step out: the sim fires
// and moves a bolt in one step) over CATCH_UP, and its sideways gap from
// the sim's line closes within CONVERGE metres of the start. Without a
// figure it starts at the sim's own start. A bolt the sim has stopped (a
// wall, a body: the view's `ended`, kept a moment by battle.js) is drawn on
// to where it stopped, its gap closed by there.
//
//   createBolts(scene, { max }) → { mesh, update(bolts, { muzzleOf, now }), count(), dispose() }
//   drawnBolt(bolt, { muzzle, age, first, converge, catchUp }) → { head, tail }   (pure)

import * as THREE from 'three';

export const MAX_BOLTS = 256;
export const STREAK = 1 / 40; // s of travel one streak shows
export const BOLT_SPEED = 700; // m/s where a bolt carries none (lane 1's view: the rifles' InitialSpeed)
// m from its start in which a drawn bolt's gap from the sim's line closes
// (hand: no record holds it; src/data/bf2017/NOTES.md, held.json)
export const CONVERGE = 15;
// s a drawn bolt takes to catch the sim's up from the muzzle (hand: two
// frames at 60 Hz, a step of the sim's 20 Hz and a bit)
export const CATCH_UP = 0.1;
const COLOURS = { red: [6, 0.35, 0.25], blue: [0.35, 0.8, 6], green: [0.4, 6, 0.5], yellow: [5, 4, 0.5] };

// bolt: the view's (from, dir, travelled, speed, ended); first: how far the sim had
// it when it was first seen; age: s since then
export function drawnBolt(b, { muzzle = null, age = 0, first = 0, converge = CONVERGE, catchUp = CATCH_UP } = {}) {
  const from = b.from ?? b.at;
  const travelled = b.travelled ?? 0;
  const len = (b.speed ?? BOLT_SPEED) * STREAK;
  const s = Math.max(0, travelled - first * Math.max(0, 1 - age / catchUp));
  const off = muzzle ? [muzzle[0] - from[0], muzzle[1] - from[1], muzzle[2] - from[2]] : [0, 0, 0];
  const n = Math.hypot(b.dir[0], b.dir[1], b.dir[2]) || 1;
  // (a bolt the sim stopped nearer than `converge`: on its line by where it stopped)
  const reach = b.ended ? Math.max(1e-6, Math.min(converge, travelled)) : converge;
  const at = (d) => {
    const w = Math.max(0, 1 - d / reach);
    return [0, 1, 2].map((i) => from[i] + (b.dir[i] / n) * d + off[i] * w);
  };
  return { head: at(s), tail: at(Math.max(0, s - len)) };
}

export function createBolts(scene, { max = MAX_BOLTS } = {}) {
  const geo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6, 1, true);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.name = 'bolts';
  scene.add(mesh);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const z = new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3();
  const h = new THREE.Vector3();
  const c = new THREE.Color();
  const gun = new THREE.Vector3();
  const seen = new Map(); // bolt id → { muzzle, born, first }
  let frame = 0;

  // a streak from tail to head (a bolt with no start of its own: back from `at`)
  function place(n, b, now, muzzleOf) {
    if (b.id == null || !b.from) {
      const len = (b.speed ?? BOLT_SPEED) * STREAK;
      d.fromArray(b.dir).normalize();
      h.fromArray(b.at);
      p.copy(h).addScaledVector(d, -len / 2);
      s.set(1, 1, len);
    } else {
      let a = seen.get(b.id);
      if (!a) {
        const got = b.owner != null && muzzleOf ? muzzleOf(b.owner, gun) : null;
        a = { muzzle: got ? got.toArray() : null, born: now, first: b.travelled ?? 0 };
        seen.set(b.id, a);
      }
      a.frame = frame;
      const { head, tail } = drawnBolt(b, { muzzle: a.muzzle, age: now - a.born, first: a.first });
      h.fromArray(head);
      d.fromArray(head).sub(p.fromArray(tail));
      const len = d.length();
      if (len > 1e-6) d.divideScalar(len);
      else d.fromArray(b.dir).normalize();
      p.addScaledVector(d, len / 2);
      s.set(1, 1, Math.max(len, 1e-4));
    }
    q.setFromUnitVectors(z, d);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, c.setRGB(...(COLOURS[b.colour] ?? COLOURS.red)));
  }

  return {
    mesh,
    update(bolts, { muzzleOf = null, now = 0 } = {}) {
      frame++;
      let n = 0;
      for (const b of bolts) {
        if (n >= max) break;
        place(n, b, now, muzzleOf);
        n++;
      }
      // (a bolt the sim has let go of: its anchor too)
      for (const [id, a] of seen) if (a.frame !== frame) seen.delete(id);
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    count: () => seen.size,
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      seen.clear();
    },
  };
}
