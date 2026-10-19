// What the skill tree's four ship weapons look like (lib/arms/behaviours.js
// says what they do; uniqueArms.js says where and when): the seismic
// charge, a dark ball with a light blinking on it, and its ring, a flat band
// of pale blue light on a low wall of it, swelling out level and fading; the
// dark matter, a black core in a green glow; the Blue sky cluster's round, a
// spinning blue gem; and the Energon arc, lightning drawn as short bright
// struts from point to point. Plain materials, so the node renderer draws them as the
// WebGL one does. Each pool is made once and hidden while it isn't wanted,
// so a ship with none of these fitted draws nothing more than it did.
//
// createUniqueFx(parent) → { charges(list), rings(list), orbs(list), gems(list), arcs(list), update(dt), clear(), dispose() }
// charges, orbs and gems take [{ x, y, z }] (at most CHARGES, ORBS and GEMS
// of them; a charge's `blink`, 0…1); rings [{ x, y, z, r, k }] (k: 1 bright
// … 0 gone); arcs [{ points: [{ x, y, z }], k }]. Points are in `parent`'s
// space (the map's, where the ship flies).

import * as THREE from 'three';

const CHARGES = 6;
const RINGS = 4;
const ORBS = 6;
const GEMS = 6;
const STRUTS = 96; // the arcs' bright segments, all of them at once
const Y = new THREE.Vector3(0, 1, 0);
const SONIC = new THREE.Color(0.6, 1.3, 2.4); // the seismic ring's pale blue
const DARK = new THREE.Color(0.25, 2.2, 0.6); // the dark matter's glow
const GEM = new THREE.Color(0.9, 2.6, 3.6); // Walt's blue
const ENERGON = new THREE.Color(1.2, 3.4, 4.2); // Cybertron's

const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

export function createUniqueFx(parent) {
  const owned = [];
  const keep = (o) => (owned.push(o), o);
  const pool = (geo, mat, count, name) => {
    const m = new THREE.InstancedMesh(keep(geo), keep(mat), count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    m.visible = false;
    m.name = `unique-${name}`;
    parent.add(m);
    return m;
  };
  const charge = pool(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#1c1f24' }), CHARGES, 'charge');
  const blink = pool(new THREE.SphereGeometry(1, 8, 6), glow(new THREE.Color(4, 0.6, 0.3)), CHARGES, 'blink');
  const core = pool(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: '#020403' }), ORBS, 'orb');
  // (its glow drawn from the inside only, so the core in front hides it: a dark ball ringed in green, not a green disc)
  const halo = pool(new THREE.SphereGeometry(1, 14, 10), Object.assign(glow(DARK), { side: THREE.BackSide }), ORBS, 'halo');
  const gem = pool(new THREE.IcosahedronGeometry(1, 0), glow(GEM), GEMS, 'gem');
  const strut = pool(new THREE.CylinderGeometry(1, 1, 1, 5, 1).translate(0, 0.5, 0), glow(ENERGON), STRUTS, 'arc');
  // (the struts fade one by one: their colours, under an additive blend, are their brightness)
  strut.setColorAt(0, new THREE.Color(1, 1, 1));
  // the rings: one mesh each, so each fades on its own (a band lying flat,
  // its inner edge soft by a second, wider band, and a low wall of light
  // standing on its edge: from the chase camera, at the ship's own height, a
  // flat ring alone is seen edge on and all but vanishes)
  const ringGeo = keep(new THREE.RingGeometry(0.86, 1, 96, 1).rotateX(-Math.PI / 2));
  const softGeo = keep(new THREE.RingGeometry(0.6, 0.86, 96, 1).rotateX(-Math.PI / 2));
  const wallGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true));
  const rings = Array.from({ length: RINGS }, () => {
    const g = new THREE.Group();
    const band = new THREE.Mesh(ringGeo, keep(glow(SONIC.clone())));
    const soft = new THREE.Mesh(softGeo, keep(glow(SONIC.clone().multiplyScalar(0.35))));
    const wall = new THREE.Mesh(wallGeo, keep(glow(SONIC.clone().multiplyScalar(0.5))));
    band.material.side = soft.material.side = wall.material.side = THREE.DoubleSide;
    g.add(band, soft, wall);
    g.visible = false;
    g.frustumCulled = false;
    g.name = 'unique-ring';
    parent.add(g);
    return { g, band, soft, wall };
  });

  let clock = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const d = new THREE.Vector3();
  const c = new THREE.Color();
  const none = new THREE.Quaternion();
  const spin = new THREE.Euler();
  const show = (mesh, n) => {
    mesh.count = n;
    mesh.visible = n > 0;
    if (n) mesh.instanceMatrix.needsUpdate = true;
  };

  return {
    charges(list) {
      const n = Math.min(list.length, CHARGES);
      for (let i = 0; i < n; i++) {
        const t = list[i];
        charge.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z), none, s.setScalar(0.09)));
        const on = 0.012 + 0.03 * (t.blink ?? 0);
        blink.setMatrixAt(i, m4.compose(p.set(t.x, t.y + 0.08, t.z), none, s.setScalar(on)));
      }
      show(charge, n);
      show(blink, n);
    },
    rings(list) {
      for (let i = 0; i < RINGS; i++) {
        const r = rings[i];
        const t = list[i];
        r.g.visible = Boolean(t) && t.k > 0.01;
        if (!r.g.visible) continue;
        r.g.position.set(t.x, t.y, t.z);
        r.g.scale.set(t.r, 1, t.r);
        r.band.material.color.copy(SONIC).multiplyScalar(1.6 * t.k);
        r.soft.material.color.copy(SONIC).multiplyScalar(0.5 * t.k);
        r.wall.scale.y = 0.15 + 0.5 * t.k; // (low, and lower as it fades)
        r.wall.material.color.copy(SONIC).multiplyScalar(0.7 * t.k);
      }
    },
    orbs(list) {
      const n = Math.min(list.length, ORBS);
      for (let i = 0; i < n; i++) {
        const t = list[i];
        const k = t.size ?? 0.16;
        const pulse = 1 + Math.sin(clock * 13 + i * 1.7) * 0.12;
        core.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z), none, s.setScalar(k * 0.62)));
        halo.setMatrixAt(i, m4.compose(p, none, s.setScalar(k * pulse)));
      }
      show(core, n);
      show(halo, n);
    },
    gems(list) {
      const n = Math.min(list.length, GEMS);
      for (let i = 0; i < n; i++) {
        const t = list[i];
        q.setFromEuler(spin.set(clock * 5.3 + i, clock * 3.1, clock * 1.7));
        gem.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z), q, s.setScalar(0.11)));
      }
      show(gem, n);
    },
    arcs(list) {
      let n = 0;
      for (const a of list) {
        for (let i = 1; i < a.points.length && n < STRUTS; i++) {
          const from = a.points[i - 1];
          const to = a.points[i];
          d.set(to.x - from.x, to.y - from.y, to.z - from.z);
          const len = d.length();
          if (len < 1e-4) continue;
          q.setFromUnitVectors(Y, d.divideScalar(len));
          const w = 0.045 * (0.6 + 0.4 * a.k) * (1 + Math.sin(clock * 90 + i) * 0.25);
          strut.setMatrixAt(n, m4.compose(p.set(from.x, from.y, from.z), q, s.set(w, len, w)));
          strut.setColorAt(n, c.setScalar(a.k));
          n += 1;
        }
      }
      show(strut, n);
      if (n) strut.instanceColor.needsUpdate = true;
    },
    update(dt) {
      clock += dt;
    },
    clear() {
      for (const m of [charge, blink, core, halo, gem, strut]) show(m, 0);
      for (const r of rings) r.g.visible = false;
    },
    dispose() {
      for (const m of [charge, blink, core, halo, gem, strut]) parent.remove(m);
      for (const r of rings) parent.remove(r.g);
      for (const o of owned) o.dispose?.();
    },
  };
}
