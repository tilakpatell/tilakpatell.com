// The two Guardians at a fight, drawn (./guardians.js says where each is
// and what each does; ./inside.js runs them): each the kit's stand-in of
// ./people.js, upright on the ground or along its flight in the air; three
// more of Dupli-Kate beside her while she holds a foe; Monster Girl twice
// her height while she is the monster; Shrinking Rae shrunk to nothing as
// she blinks; Black Samson's shield wall a ring of light round the people;
// Rex's blast and Robot's bolts through the flight's effects (./fx.js vfx).

import * as THREE from 'three';
import { SIG, guardianOf } from './guardians';
import { personFor } from './people';

const Y = new THREE.Vector3(0, 1, 0);
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createCavalryScene(scene, vfx) {
  const figs = new Map();
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(SIG.shield.r, SIG.shield.r, 3.2, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xe6b84a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  shield.visible = false;
  shield.renderOrder = 5;
  scene.add(shield);
  const tmpQ = new THREE.Quaternion();
  const dir = new THREE.Vector3();

  // a stand-in, made the first time one is sent (and Kate's copies with her)
  function figOf(id) {
    if (figs.has(id)) return figs.get(id);
    const g = guardianOf(id);
    const make = (seed) => {
      const person = personFor(id, seed);
      const holder = new THREE.Group();
      holder.add(person.root);
      holder.visible = false;
      scene.add(holder);
      return { person, holder, lean: new THREE.Quaternion(), look: 0, scale: 1 };
    };
    const f = { g, ...make(41), phase: figs.size * 1.7, copies: g.sig === 'copies' ? Array.from({ length: SIG.copies.n - 1 }, (_, i) => make(50 + i)) : [] };
    figs.set(id, f);
    return f;
  }

  function place(f, p, yaw, v, dt, { fly, mode, t, phase, scale = 1 }) {
    const h = f.holder;
    h.visible = true;
    h.position.set(p[0], p[1] + f.person.hipY * scale, p[2]);
    f.look += angle(yaw - f.look) * (1 - Math.exp(-5 * dt));
    h.rotation.set(0, f.look, 0);
    f.scale += (scale - f.scale) * (1 - Math.exp(-8 * dt));
    h.scale.setScalar(Math.max(0.02, f.scale));
    // a flier lies along its flight when it is going somewhere
    const sp = Math.hypot(v[0], v[1], v[2]);
    const k = fly ? Math.min(1, Math.max(0, (sp - 6) / 20)) : 0;
    dir.set(v[0], v[1], v[2]);
    if (sp > 0.1) dir.divideScalar(sp);
    else dir.copy(Y);
    dir.applyQuaternion(tmpQ.setFromAxisAngle(Y, -f.look));
    dir.lerpVectors(Y, dir, k).normalize();
    tmpQ.setFromUnitVectors(Y, dir);
    f.lean.slerp(tmpQ, 1 - Math.exp(-5 * dt));
    h.quaternion.multiply(f.lean);
    f.person.pose({ mode, t, phase }, dt);
  }

  return {
    update(cav, dt, t, events = []) {
      const out = new Set(cav?.who?.map((w) => w.id) ?? []);
      for (const [id, f] of figs)
        if (!out.has(id)) {
          f.holder.visible = false;
          for (const c of f.copies) c.holder.visible = false;
        }
      let wall = null;
      for (const w of cav?.who ?? []) {
        const f = figOf(w.id);
        if (w.state === 'gone') {
          f.holder.visible = false;
          continue;
        }
        const fly = f.g.mode === 'fly';
        const sp = Math.hypot(w.v[0], w.v[2]);
        const yaw = sp > 1 ? Math.atan2(w.v[0], w.v[2]) : f.look;
        const mode = fly ? (sp > 8 ? 'fly' : 'hover') : sp > 1 ? 'walk' : w.state === 'fight' ? 'talk' : 'idle';
        const scale = f.g.sig === 'blink' && w.blink > 0 ? 0.02 : f.g.sig === 'monster' && w.monster > 0 ? 2.2 : 1;
        place(f, w.p, yaw, w.v, dt, { fly, mode, t, phase: f.phase, scale });
        // Kate's copies, round her while she holds one
        f.copies.forEach((c, i) => {
          if (w.copies > 0) {
            const a = f.look + ((i + 1) * Math.PI * 2) / (f.copies.length + 1);
            place(c, [w.p[0] + Math.sin(a) * 1.4, w.p[1], w.p[2] + Math.cos(a) * 1.4], yaw, w.v, dt, { fly: false, mode: 'talk', t, phase: f.phase + i });
          } else c.holder.visible = false;
        });
        if (w.shield) wall = w.shield;
      }
      shield.visible = Boolean(wall);
      if (wall) {
        shield.position.set(wall[0], wall[1] + 1.6, wall[2]);
        shield.material.opacity = 0.16 + Math.sin(t * 3) * 0.05;
      }
      // the blast where Rex's car came down; a bolt's flash on Robot's mark
      for (const e of events) {
        if (e.type === 'gBlast') {
          const p = new THREE.Vector3(e.at[0], e.at[1] + 0.5, e.at[2]);
          vfx.flash(p, { color: 0xffb347, intensity: 40, distance: 30, life: 0.25 });
          vfx.ring(p, { color: 0xffc46b, from: 1, to: e.r * 2, life: 0.6, normal: Y, opacity: 0.9 });
          vfx.debris(p, { count: 24, speed: 14, size: 0.25, dir: Y, spread: 0.9 });
        } else if (e.type === 'gHit' && e.who === 'robot' && e.at) vfx.flash(new THREE.Vector3(e.at[0], e.at[1] + 1, e.at[2]), { color: 0x4fa3b8, intensity: 12, distance: 12, life: 0.15 });
      }
    },
    dispose() {
      for (const f of figs.values()) {
        f.person.dispose();
        for (const c of f.copies) c.person.dispose();
      }
      shield.geometry.dispose();
      shield.material.dispose();
    },
  };
}
