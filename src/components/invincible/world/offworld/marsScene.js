// Mars, landed on, drawn (./mars.js has the rules): the base at the site
// facing the Earth (a dome, two huts, a mast), the ship on its pad, the
// four astronauts where the Sequids left them (the kit's stand-ins,
// ../people.js), the host by the base, and the swarm as one instanced
// draw of purple bodies (800 to 2,400 by tier). Everything sits in the
// site's flat frame, turned to lie on the planet (./mars.js's FRAME), so
// a local [x, y, z] is drawn where the rules have it. Built when the
// orbit says Mark is within 30 km of Mars, let go beyond it (../scene.js):
// `dispose` frees every geometry and material it made.

import * as THREE from 'three';
import { PartBuilder } from '../../../avengers/hq/kit/shapes';
import { hot } from '../../../avengers/hq/stage';
import { personFor } from '../people';
import { BASE, FRAME, HOST, SITE, groundAt } from './mars';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, s = 20) => new THREE.CylinderGeometry(r0, r1, h, s);

export function buildMarsScene(parent, { n = 800, calm = false } = {}) {
  const group = new THREE.Group();
  group.name = 'mars-site';
  // the frame: x along e1, y along n (up off the planet), z along e2
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...FRAME.e1), new THREE.Vector3(...FRAME.n), new THREE.Vector3(...FRAME.e2));
  group.quaternion.setFromRotationMatrix(m);
  group.position.set(...SITE);
  parent.add(group);
  const b = new PartBuilder();
  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.6, metalness: 0.2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x6fa3b4, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.7 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x5a4a44, roughness: 0.95 }),
    lamp: new THREE.MeshBasicMaterial({ color: hot(0xfff1c8, 2), toneMapped: false }),
    ship: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.4, metalness: 0.5 }),
    fin: new THREE.MeshStandardMaterial({ color: 0xc8553d, roughness: 0.5, metalness: 0.3 }),
  };
  const g0 = groundAt(0, 0);
  // the base: a dome on a ring, two huts off it with a tunnel each, a mast with a light
  b.add('pad', cyl(BASE.dome + 6, BASE.dome + 7, 0.6, 40), { p: [0, g0 + 0.3, 0] });
  b.add('hull', new THREE.SphereGeometry(BASE.dome, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, g0 + 0.6, 0] });
  b.add('glass', new THREE.SphereGeometry(BASE.dome * 0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, g0 + BASE.dome * 0.5, 0] });
  for (const [x, z] of [
    [-26, 8],
    [20, -24],
  ]) {
    b.add('hull', cyl(4, 4, 14, 16), { p: [x, g0 + 3.2, z], r: [0, 0, Math.PI / 2] });
    b.add('dark', cyl(1.4, 1.4, Math.hypot(x, z) - BASE.dome, 10), { p: [x / 2, g0 + 1.6, z / 2], r: [0, Math.atan2(x, z), Math.PI / 2] });
  }
  b.add('dark', cyl(0.3, 0.4, 18, 8), { p: [12, g0 + 9, 12] });
  b.add('lamp', new THREE.SphereGeometry(0.6, 10, 8), { p: [12, g0 + 18.4, 12] });
  // the ship on its pad: a hull, a nose, three fins, its ramp down
  const [sx, , sz] = BASE.ship;
  const gs = groundAt(sx, sz);
  b.add('pad', cyl(12, 13, 0.5, 32), { p: [sx, gs + 0.25, sz] });
  b.add('ship', cyl(3.2, 3.6, 16, 20), { p: [sx, gs + 8.5, sz] });
  b.add('ship', new THREE.ConeGeometry(3.2, 7, 20), { p: [sx, gs + 20, sz] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.add('fin', box(0.3, 7, 3.6), { p: [sx + Math.sin(a) * 4.2, gs + 4, sz + Math.cos(a) * 4.2], r: [0, a, 0] });
  }
  b.add('dark', box(2.4, 0.2, 9), { p: [sx, gs + 2.2, sz + 7.5], r: [0.5, 0, 0] });
  b.add('lamp', new THREE.SphereGeometry(0.4, 10, 8), { p: [sx, gs + 24, sz] });
  group.add(b.build(mats));

  // the astronauts, the host: the kit's stand-ins at their hips
  const stand = (kind, seed) => {
    const person = personFor(kind, seed);
    const holder = new THREE.Group();
    holder.add(person.root);
    group.add(holder);
    return { person, holder, look: 0, phase: seed * 1.3 };
  };
  const astronauts = BASE.astronauts.map((p, i) => stand('astronaut', 61 + i));
  const host = stand('host', 71);
  const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // the swarm: one instanced draw of little purple bodies
  const swarmMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.16, 0.3, 3, 6), new THREE.MeshStandardMaterial({ color: 0x5a2a8a, emissive: 0x7a2aff, emissiveIntensity: 0.6, roughness: 0.5 }), n);
  swarmMesh.frustumCulled = false;
  swarmMesh.count = 0;
  group.add(swarmMesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  let fx = null;

  return {
    group,
    attachFx(vfx) {
      fx = vfx;
    },
    // each frame: the rules' places into the frame (`mars`: ./mars.js's state; `hero`: his place in it)
    update(mars, dt, t, hero) {
      if (!mars) return;
      mars.astronauts.forEach((a, i) => {
        const s = astronauts[i];
        s.holder.visible = a.state !== 'aboard';
        if (!s.holder.visible) return;
        s.holder.position.set(a.p[0], a.p[1] + s.person.hipY, a.p[2]);
        const dx = hero[0] - a.p[0];
        const dz = hero[2] - a.p[2];
        const to = a.state === 'carried' ? Math.atan2(dx, dz) + Math.PI : Math.hypot(dx, dz) < 30 ? Math.atan2(dx, dz) : s.look;
        s.look += angle(to - s.look) * (1 - Math.exp(-3 * dt));
        s.holder.rotation.y = s.look;
        s.person.pose({ mode: a.state === 'carried' ? 'hover' : 'wave', t, phase: s.phase }, dt);
      });
      const h = mars.host;
      host.holder.position.set(h.p[0], h.p[1] + host.person.hipY * (h.state === 'down' ? 0.3 : 1), h.p[2]);
      host.holder.rotation.set(h.state === 'down' ? -Math.PI / 2 + 0.2 : 0, h.yaw, 0);
      host.person.pose({ mode: h.state === 'stagger' ? 'wave' : h.state === 'down' ? 'idle' : Math.hypot(hero[0] - h.p[0], hero[2] - h.p[2]) < HOST.reach + 1 ? 'talk' : 'walk', t, phase: host.phase }, dt);
      const sw = mars.swarm;
      swarmMesh.count = Math.min(n, sw.bodies.length);
      for (let i = 0; i < swarmMesh.count; i++) {
        const body = sw.bodies[i];
        v.set(body.v[0], body.v[1], body.v[2]);
        if (v.lengthSq() > 0.01) q.setFromUnitVectors(up, v.normalize());
        else q.identity();
        m4.compose(new THREE.Vector3(body.p[0], body.p[1], body.p[2]), q, new THREE.Vector3(1, 1, 1));
        swarmMesh.setMatrixAt(i, m4);
      }
      swarmMesh.instanceMatrix.needsUpdate = true;
      swarmMesh.material.emissiveIntensity = sw.alive ? 0.6 + Math.sin(t * 6) * 0.2 : 0.05;
    },
    // what just happened, as flashes (the rules' events, in the frame; `at` is local)
    fx(e) {
      if (!fx || calm) return;
      const at = (p) => new THREE.Vector3(...p).applyQuaternion(group.quaternion).add(group.position);
      if (e.type === 'scatter') fx.ring(at(e.at), { color: 0xb04dff, from: 1, to: 12, life: 0.5, normal: new THREE.Vector3(...FRAME.n) });
      else if (e.type === 'hostHit') fx.sparks(at(e.at), { count: 18, speed: 12, color: 0xffffff, to: 0xb04dff, life: 0.5 });
      else if (e.type === 'hostDown') fx.flash(at(e.at), { color: 0xb04dff, intensity: 30, distance: 30, life: 0.4 });
      else if (e.type === 'aboard') fx.ring(at([BASE.ship[0], groundAt(BASE.ship[0], BASE.ship[2]) + 2, BASE.ship[2]]), { color: 0xffd23a, from: 1, to: 10, life: 0.6, normal: new THREE.Vector3(...FRAME.n) });
    },
    dispose() {
      group.removeFromParent();
      group.traverse((o) => {
        if (o.geometry && o !== swarmMesh) o.geometry.dispose?.();
      });
      for (const mt of Object.values(mats)) mt.dispose();
      for (const s of [...astronauts, host]) s.person.dispose();
      swarmMesh.geometry.dispose();
      swarmMesh.material.dispose();
    },
  };
}
