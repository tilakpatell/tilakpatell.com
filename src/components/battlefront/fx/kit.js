// The kit drawn (lib/battlefront/kit.js's view): the grenades in the air,
// each gliding between the sim's 20 Hz steps; a blast as a bright ball that
// swells to the explosion's own radius and is gone in a third of a second
// (the flash's white, the shock's blue); the shock's field for its 3.7 s
// as a cage of light; the officer's turret; the heavy's shield in front of
// him, a cage too, dimmer as its health goes. Stand-ins, plain shapes: the
// game's own meshes and effects for the detonator, the turret and the
// shield are not in the pack yet. Nothing here is see-through: a blended
// surface is lost on Hoth's snow, or darkened by the chain's passes that
// read the depth behind it; the cages are lines, the balls solid.
//
//   createKitFx(scene) → { update(view, { now, alpha, events }), counts(), dispose() }
//     view: battle.js's (grenades: [{ id, at, kind, resting }], entities with `kind: 'turret'` and `shield`, time)
//     alpha: how far the frame is between the last two steps; events: the steps' 'explosion'
//   blastAt(age, { radius, life }) → { scale, glow } | null      (pure)
//   glide(prev, cur, k, out) → out                                 (pure)

import * as THREE from 'three';

export const MAX_GRENADES = 32;
export const MAX_BLASTS = 24;
export const BLAST_LIFE = 0.35; // s a blast's ball lasts (hand: the game's is an effect, not a record the site reads)
export const FIELD_LIFE = 3.7; // s the shock's field is drawn (grenades.js's field.seconds)
// what each kind of explosion looks like (hand, chosen in the browser against Hoth's lit snow): its colour in the
// scene's light, how long it lasts, a size of its own
const BLASTS = {
  thermal: { colour: [2.5, 1, 0.2], life: BLAST_LIFE },
  botThermal: { colour: [2.5, 1, 0.2], life: BLAST_LIFE },
  impact: { colour: [2.5, 1.1, 0.25], life: BLAST_LIFE },
  turret: { colour: [2.5, 1, 0.2], life: BLAST_LIFE },
  shock: { colour: [0.3, 0.8, 1.8], life: BLAST_LIFE, field: { radius: 2, colour: [0.3, 0.8, 1.8] } },
  flashSub: { colour: [3, 3, 3], life: 0.2, radius: 1.5 },
  dart: { colour: [0.3, 0.8, 1.8], life: 0.25, radius: 0.6 },
};
const GRENADE_LIGHT = { thermal: [1.2, 0.08, 0.05], botThermal: [1.2, 0.08, 0.05], impact: [1.2, 0.5, 0.05], flash: [1.2, 1.2, 1.2], flashSub: [1.2, 1.2, 1.2], shock: [0.1, 0.4, 1.2], dart: [0.1, 0.4, 1.2] };
const SHIELD = { radius: 0.95, height: 1.9, arc: (110 * Math.PI) / 180, colour: [0.45, 1.1, 2.2] };

// a blast's ball at an age: out fast, slowing (1 − (1 − t)³), its glow falling to nothing
export function blastAt(age, { radius = 1, life = BLAST_LIFE } = {}) {
  if (age < 0 || age >= life) return null;
  const t = age / life;
  return { scale: radius * (1 - (1 - t) ** 3), glow: (1 - t) ** 2 };
}

// between a step's place and the next's
export function glide(prev, cur, k, out = [0, 0, 0]) {
  for (let i = 0; i < 3; i++) out[i] = prev[i] + (cur[i] - prev[i]) * k;
  return out;
}

function turretMesh() {
  const g = new THREE.Group();
  g.name = 'turret';
  const metal = new THREE.MeshStandardMaterial({ color: 0x5c6066, metalness: 0.7, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.6, roughness: 0.5 });
  const part = (to, geo, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    to.add(m);
  };
  part(g, new THREE.CylinderGeometry(0.28, 0.36, 0.12, 12), dark, 0, 0.06, 0);
  part(g, new THREE.CylinderGeometry(0.07, 0.09, 0.75, 8), metal, 0, 0.5, 0);
  // (the head turns to its target: the third child)
  const head = new THREE.Group();
  head.position.y = 0.95;
  g.add(head);
  part(head, new THREE.BoxGeometry(0.34, 0.26, 0.42), metal, 0, 0, 0);
  part(head, new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), dark, 0.09, 0.02, 0.45, Math.PI / 2);
  part(head, new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), dark, -0.09, 0.02, 0.45, Math.PI / 2);
  g.userData.own = [metal, dark];
  return g;
}

export function createKitFx(scene) {
  const root = new THREE.Group();
  root.name = 'kit';
  scene.add(root);
  const c = new THREE.Color();
  const instanced = (geo, mat, max, name) => {
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = name;
    // (its colours there before the first draw: the node renderer builds a material for the attributes it finds then)
    mesh.setColorAt(0, c.setRGB(1, 1, 1));
    root.add(mesh);
    return mesh;
  };
  const light = (wireframe = false) => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, wireframe });
  const bodies = instanced(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8d9197, metalness: 0.85, roughness: 0.35 }), MAX_GRENADES, 'grenades');
  bodies.castShadow = true;
  const lights = instanced(new THREE.SphereGeometry(0.03, 8, 6), light(), MAX_GRENADES, 'grenade-lights');
  const balls = instanced(new THREE.IcosahedronGeometry(1, 2), light(), MAX_BLASTS, 'blasts');
  const cages = instanced(new THREE.IcosahedronGeometry(1, 2), light(true), MAX_BLASTS, 'fields');
  const shieldGeo = new THREE.CylinderGeometry(SHIELD.radius, SHIELD.radius, SHIELD.height, 14, 8, true, -SHIELD.arc / 2, SHIELD.arc);
  shieldGeo.translate(0, SHIELD.height / 2, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const at = [0, 0, 0];
  const seen = new Map(); // grenade id → { prev, cur, t }
  const blasts = []; // { at, radius, born, life, colour, field? }
  const turrets = new Map(); // id → mesh
  const shields = new Map(); // soldier id → mesh
  let frame = 0;

  function boom(e, now) {
    const look = BLASTS[e.kind] ?? BLASTS.thermal;
    blasts.push({ at: e.at, radius: look.radius ?? e.radius ?? 1, born: now, life: look.life, colour: look.colour });
    if (look.field) blasts.push({ at: e.at, radius: look.field.radius, born: now, life: FIELD_LIFE, colour: look.field.colour, field: true });
    while (blasts.length > MAX_BLASTS) blasts.shift();
  }

  function drawGrenades(view, alpha) {
    let n = 0;
    for (const g of view.grenades ?? []) {
      if (n >= MAX_GRENADES) break;
      let a = seen.get(g.id);
      if (!a) seen.set(g.id, (a = { prev: g.at, cur: g.at, t: view.time }));
      else if (a.t !== view.time) Object.assign(a, { prev: a.cur, cur: g.at, t: view.time });
      a.frame = frame;
      glide(a.prev, a.cur, alpha, at);
      p.set(at[0], at[1] + 0.075, at[2]);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, ((g.spin ?? 0) * Math.PI) / 180);
      m.compose(p, q, s.setScalar(1));
      bodies.setMatrixAt(n, m);
      // (its light, on top: brighter once it lies still)
      lights.setMatrixAt(n, m.setPosition(at[0], at[1] + 0.155, at[2]));
      lights.setColorAt(n, c.setRGB(...(GRENADE_LIGHT[g.kind] ?? GRENADE_LIGHT.thermal)).multiplyScalar(g.resting ? 1 : 0.45));
      n++;
    }
    for (const [id, a] of seen) if (a.frame !== frame) seen.delete(id);
    bodies.count = lights.count = n;
    bodies.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true;
    if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
  }

  function drawBlasts(now) {
    let n = 0;
    let k = 0;
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i];
      const age = now - b.born;
      // (the field holds its size and flickers out; a blast swells and dims)
      const d = b.field ? (age < b.life ? { scale: b.radius, glow: (0.55 + 0.45 * Math.sin(age * 40)) * Math.min(1, (b.life - age) * 2) } : null) : blastAt(age, b);
      if (!d) {
        blasts.splice(i, 1);
        continue;
      }
      const mesh = b.field ? cages : balls;
      const slot = b.field ? k++ : n++;
      m.compose(p.fromArray(b.at), q.identity(), s.setScalar(Math.max(d.scale, 1e-3)));
      mesh.setMatrixAt(slot, m);
      mesh.setColorAt(slot, c.setRGB(...b.colour).multiplyScalar(0.35 + 0.65 * Math.max(0, d.glow)));
    }
    balls.count = n;
    cages.count = k;
    for (const mesh of [balls, cages]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  function drawBodies(view) {
    for (const e of view.entities ?? []) {
      if (e.kind === 'turret' && e.alive !== false) {
        let t = turrets.get(e.id);
        if (!t) {
          t = turretMesh();
          root.add(t);
          turrets.set(e.id, t);
        }
        t.userData.frame = frame;
        t.position.fromArray(e.at);
        t.children[2].rotation.y = e.yaw ?? 0;
      } else if (e.shield != null && e.alive !== false) {
        let sh = shields.get(e.id);
        if (!sh) {
          sh = new THREE.Mesh(shieldGeo, light(true));
          sh.name = 'shield';
          root.add(sh);
          shields.set(e.id, sh);
        }
        sh.userData.frame = frame;
        sh.position.fromArray(e.at);
        sh.rotation.y = e.yaw ?? 0;
        sh.material.color.setRGB(...SHIELD.colour).multiplyScalar(0.3 + 0.7 * e.shield);
      }
    }
    for (const [id, t] of turrets) {
      if (t.userData.frame === frame) continue;
      t.removeFromParent();
      t.traverse((o) => o.geometry?.dispose());
      for (const mat of t.userData.own) mat.dispose();
      turrets.delete(id);
    }
    for (const [id, sh] of shields) {
      if (sh.userData.frame === frame) continue;
      sh.removeFromParent();
      sh.material.dispose();
      shields.delete(id);
    }
  }

  return {
    root,
    update(view, { now = 0, alpha = 1, events = [] } = {}) {
      frame++;
      for (const e of events) if (e.type === 'explosion') boom(e, now);
      drawGrenades(view, alpha);
      drawBlasts(now);
      drawBodies(view);


    },
    counts: () => ({ grenades: bodies.count, blasts: balls.count, fields: cages.count, turrets: turrets.size, shields: shields.size }),
    dispose() {
      for (const t of turrets.values()) {
        t.traverse((o) => o.geometry?.dispose());
        for (const mat of t.userData.own) mat.dispose();
      }
      for (const sh of shields.values()) sh.material.dispose();
      for (const mesh of [bodies, lights, balls, cages]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      shieldGeo.dispose();
      root.removeFromParent();
      seen.clear();
      turrets.clear();
      shields.clear();
      blasts.length = 0;
    },
  };
}
