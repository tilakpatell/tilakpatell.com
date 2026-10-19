// The heavy rounds (weapons.js's ordnance line), for any scene that flies
// the universe's ships (the universe map; the galaxy, through
// shared/flying.js): a glowing slug with a halo and a tail of fire, homing
// on what the guns had locked when it went (roundRules.js), in the crew's
// own colour. The pool is drawn in the scene's world; what a round meets is
// the scene's to say (its targets differ), so `fly` hands each step to it.
//
// createRounds(parent, count) → {
//   list,                         the meshes (each its userData: { life, v, punch, damage, heavy, homing, target, age })
//   setColor(hex),                the crew's (arsenalOf(kind).heavy)
//   launch(at, dir, speed, { life, punch, damage, homing, target }) → mesh,
//   fly(dt, hit, expire) → bool,  each round on a step: hit(m, from, to) → true when it's spent (the scene drew
//                                 the bang); expire(m) when its life runs out; true while any's in flight
//   dispose() }

import * as THREE from 'three';
import { aimAngles } from './targeting';
import { nearTarget, steerRound } from './roundRules';

export function createRounds(parent, count) {
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g2 = c.getContext('2d');
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const mat = new THREE.MeshBasicMaterial({ color: '#ffb347', toneMapped: false });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffb347', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const geo = new THREE.OctahedronGeometry(0.035, 0).scale(1, 1, 2.6);
  const tailGeo = new THREE.ConeGeometry(0.03, 0.5, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.3); // (out behind it, along +z)
  const list = Array.from({ length: count }, () => {
    const m = new THREE.Mesh(geo, mat);
    const halo = new THREE.Sprite(glowMat);
    halo.scale.setScalar(0.42);
    const tail = new THREE.Mesh(tailGeo, tailMat);
    m.add(halo, tail);
    m.visible = false;
    m.rotation.order = 'YXZ';
    m.userData = { life: 0, v: [0, 0, 0], target: null };
    parent.add(m);
    return m;
  });
  const from = new THREE.Vector3();
  const toNear = new THREE.Vector3();
  const scratch = [0, 0, 0];
  const dir = [0, 0, 0];

  return {
    list,
    setColor(hex) {
      mat.color.set(hex).multiplyScalar(3);
      glowMat.color.set(hex).multiplyScalar(2.2);
      tailMat.color.set(hex).multiplyScalar(2);
    },
    launch(at, d, speed, { life, punch, damage, homing, target }) {
      const m = list.find((x) => !x.visible) ?? list[0];
      m.position.copy(at);
      const { heading, pitch } = aimAngles(d);
      m.rotation.set(pitch, heading, 0);
      m.userData = { life, v: [d[0] * speed, d[1] * speed, d[2] * speed], punch, damage, heavy: true, homing, target, age: 0 };
      m.visible = true;
      return m;
    },
    fly(dt, hit, expire) {
      let any = false;
      for (const m of list) {
        if (!m.visible) continue;
        const d = m.userData;
        d.life -= dt;
        d.age += dt;
        if (d.life <= 0) {
          expire(m);
          continue;
        }
        any = true;
        steerRound(d, m.position, dt, scratch);
        from.copy(m.position);
        m.position.x += d.v[0] * dt;
        m.position.y += d.v[1] * dt;
        m.position.z += d.v[2] * dt;
        dir[0] = d.v[0];
        dir[1] = d.v[1];
        dir[2] = d.v[2];
        const { heading, pitch } = aimAngles(dir);
        m.rotation.set(pitch, heading, 0);
        // (right by its target: straight into its middle; a hunter's `at` is a plain { x, y, z }, copied into a Vector3 for the tests after)
        const to = nearTarget(d, m.position) ? toNear.set(d.target.at.x, d.target.at.y, d.target.at.z) : m.position;
        hit(m, from, to);
      }
      return any;
    },
    dispose() {
      for (const m of list) parent.remove(m);
      geo.dispose();
      tailGeo.dispose();
      mat.dispose();
      glowMat.dispose();
      tailMat.dispose();
      glowTex.dispose();
    },
  };
}
